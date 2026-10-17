-- ==============================================================================
-- Migration: Isolamento Multi-Usuário no Dashboard, Filas, Histórico e Tenants
-- Data: 17/10/2026
-- Descrição:
--   1. Adiciona user_id em sms_sent e sms_failed e faz backfill dos dados de teste
--      para os respectivos donos (e órfãos antigos para o Admin Master).
--   2. Garante que todos os usuários em auth.users possuam seu próprio tenant FREE.
--   3. Corrige processar_resultado_sms_queue() para copiar user_id, campaign_id e error_message.
--   4. Corrige set_sms_queue_tenant() e check_device_limit_before_insert() (remove LIMIT 1 global).
--   5. Corrige get_dashboard_analytics(p_year) para filtrar 100% dos indicadores por auth.uid().
-- ==============================================================================

-- 1. Adicionar coluna user_id em sms_sent e sms_failed
ALTER TABLE public.sms_sent
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

ALTER TABLE public.sms_failed
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_sms_queue_user_id ON public.sms_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_sent_user_id ON public.sms_sent(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_failed_user_id ON public.sms_failed(user_id);

-- 2. Garantir que todo usuário em auth.users tenha seu próprio registro em public.tenants
INSERT INTO public.tenants (
  nome,
  email,
  plano,
  max_devices,
  max_monthly_sms,
  max_contacts,
  allow_scheduling,
  is_master
)
SELECT
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  u.email,
  'FREE',
  1,
  300,
  100,
  false,
  false
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tenants t WHERE lower(t.email) = lower(u.email)
  )
ON CONFLICT (email) DO NOTHING;

-- Garantir que a trigger de criação automática de tenant exista em auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created_tenant'
  ) THEN
    CREATE TRIGGER on_auth_user_created_tenant
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_tenant_user();
  END IF;
END $$;

-- 3. Backfill de user_id nos registros existentes (sms_queue, sms_sent, sms_failed)
DO $$
DECLARE
  v_master_user_id uuid;
BEGIN
  -- Localiza o user_id do Admin Master para vincular eventuais registros antigos de teste sem dono
  SELECT u.id INTO v_master_user_id
  FROM public.tenants t
  JOIN auth.users u ON lower(u.email) = lower(t.email)
  WHERE t.is_master = true
  ORDER BY t.created_at ASC
  LIMIT 1;

  -- 3.1 Backfill em sms_queue
  UPDATE public.sms_queue q
  SET user_id = c.user_id
  FROM public.campaigns c
  WHERE q.user_id IS NULL AND q.campaign_id = c.id AND c.user_id IS NOT NULL;

  UPDATE public.sms_queue q
  SET user_id = d.user_id
  FROM public.devices d
  WHERE q.user_id IS NULL AND q.target_device_id = d.id AND d.user_id IS NOT NULL;

  UPDATE public.sms_queue q
  SET user_id = u.id
  FROM public.tenants t
  JOIN auth.users u ON lower(u.email) = lower(t.email)
  WHERE q.user_id IS NULL AND q.tenant_id = t.id;

  IF v_master_user_id IS NOT NULL THEN
    UPDATE public.sms_queue SET user_id = v_master_user_id WHERE user_id IS NULL;
  END IF;

  -- 3.2 Backfill em sms_sent
  UPDATE public.sms_sent s
  SET user_id = c.user_id
  FROM public.campaigns c
  WHERE s.user_id IS NULL AND s.campaign_id = c.id AND c.user_id IS NOT NULL;

  UPDATE public.sms_sent s
  SET user_id = d.user_id
  FROM public.devices d
  WHERE s.user_id IS NULL AND s.target_device_id = d.id AND d.user_id IS NOT NULL;

  IF v_master_user_id IS NOT NULL THEN
    UPDATE public.sms_sent SET user_id = v_master_user_id WHERE user_id IS NULL;
  END IF;

  -- 3.3 Backfill em sms_failed
  UPDATE public.sms_failed f
  SET user_id = c.user_id
  FROM public.campaigns c
  WHERE f.user_id IS NULL AND f.campaign_id = c.id AND c.user_id IS NOT NULL;

  UPDATE public.sms_failed f
  SET user_id = d.user_id
  FROM public.devices d
  WHERE f.user_id IS NULL AND f.target_device_id = d.id AND d.user_id IS NOT NULL;

  IF v_master_user_id IS NOT NULL THEN
    UPDATE public.sms_failed SET user_id = v_master_user_id WHERE user_id IS NULL;
  END IF;
END $$;

-- 4. Atualizar set_sms_queue_tenant() para sincronizar user_id e tenant_id sem usar LIMIT 1 global
CREATE OR REPLACE FUNCTION public.set_sms_queue_tenant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Resolve user_id se não informado (ex.: disparo via Edge Function send-sms ou n8n)
    IF NEW.user_id IS NULL THEN
        IF NEW.campaign_id IS NOT NULL THEN
            SELECT c.user_id INTO NEW.user_id
            FROM public.campaigns c
            WHERE c.id = NEW.campaign_id;
        END IF;

        IF NEW.user_id IS NULL AND NEW.target_device_id IS NOT NULL AND NEW.target_device_id <> 'ALL' THEN
            SELECT d.user_id INTO NEW.user_id
            FROM public.devices d
            WHERE d.id = NEW.target_device_id;
        END IF;

        IF NEW.user_id IS NULL AND NEW.tenant_id IS NOT NULL THEN
            SELECT u.id INTO NEW.user_id
            FROM public.tenants t
            JOIN auth.users u ON lower(u.email) = lower(t.email)
            WHERE t.id = NEW.tenant_id
            LIMIT 1;
        END IF;

        IF NEW.user_id IS NULL THEN
            NEW.user_id := auth.uid();
        END IF;
    END IF;

    -- Resolve tenant_id a partir do user_id dono da mensagem
    IF NEW.tenant_id IS NULL AND NEW.user_id IS NOT NULL THEN
        SELECT t.id INTO NEW.tenant_id
        FROM public.tenants t
        JOIN auth.users u ON lower(u.email) = lower(t.email)
        WHERE u.id = NEW.user_id
        LIMIT 1;
    END IF;

    RETURN NEW;
END;
$function$;

-- 5. Atualizar processar_resultado_sms_queue() para preservar campaign_id, user_id e error_message
CREATE OR REPLACE FUNCTION public.processar_resultado_sms_queue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_owner_id uuid;
BEGIN
    v_owner_id := COALESCE(
        NEW.user_id,
        (SELECT c.user_id FROM public.campaigns c WHERE c.id = NEW.campaign_id),
        (SELECT d.user_id FROM public.devices d WHERE d.id = NEW.target_device_id)
    );

    -- Caso 1: Sucesso (DELIVERED ou SENT)
    IF NEW.status IN ('DELIVERED', 'SENT') THEN
        INSERT INTO public.sms_sent (
            id,
            phone,
            message,
            sim_slot,
            target_device_id,
            status,
            created_at,
            sent_at,
            campaign_id,
            user_id
        ) VALUES (
            NEW.id,
            NEW.phone,
            NEW.message,
            NEW.sim_slot,
            NEW.target_device_id,
            NEW.status,
            NEW.created_at,
            now(),
            NEW.campaign_id,
            v_owner_id
        )
        ON CONFLICT (id) DO UPDATE 
        SET status = EXCLUDED.status,
            sent_at = now(),
            campaign_id = COALESCE(public.sms_sent.campaign_id, EXCLUDED.campaign_id),
            user_id = COALESCE(public.sms_sent.user_id, EXCLUDED.user_id);

        DELETE FROM public.sms_queue WHERE id = NEW.id;

    -- Caso 2: Falha (FAILED)
    ELSIF NEW.status = 'FAILED' THEN
        INSERT INTO public.sms_failed (
            id,
            phone,
            message,
            sim_slot,
            target_device_id,
            status,
            error_message,
            created_at,
            failed_at,
            campaign_id,
            user_id
        ) VALUES (
            NEW.id,
            NEW.phone,
            NEW.message,
            NEW.sim_slot,
            NEW.target_device_id,
            'FAILED',
            COALESCE(NEW.error_message, 'Falha no modem ou operadora'),
            NEW.created_at,
            now(),
            NEW.campaign_id,
            v_owner_id
        )
        ON CONFLICT (id) DO UPDATE 
        SET status = 'FAILED',
            error_message = COALESCE(EXCLUDED.error_message, public.sms_failed.error_message),
            failed_at = now(),
            campaign_id = COALESCE(public.sms_failed.campaign_id, EXCLUDED.campaign_id),
            user_id = COALESCE(public.sms_failed.user_id, EXCLUDED.user_id);

        DELETE FROM public.sms_queue WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$function$;

-- 6. Atualizar trg_link_campaign_on_dispatch() para não misturar campanhas de usuários diferentes
CREATE OR REPLACE FUNCTION public.trg_link_campaign_on_dispatch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.campaign_id IS NULL OR NEW.user_id IS NULL THEN
        SELECT
            COALESCE(NEW.campaign_id, q.campaign_id),
            COALESCE(NEW.user_id, q.user_id)
        INTO NEW.campaign_id, NEW.user_id
        FROM public.sms_queue q
        WHERE q.id = NEW.id
        LIMIT 1;
    END IF;
    RETURN NEW;
END;
$function$;

-- 7. Atualizar check_device_limit_before_insert() para consultar o tenant do próprio usuário
CREATE OR REPLACE FUNCTION public.check_device_limit_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_max_devices INT := 1;
    v_is_master BOOLEAN := false;
    v_current_count INT := 0;
BEGIN
    -- Quando o app Android registra o aparelho ainda sem user_id, permite o registro inicial
    IF NEW.user_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(t.max_devices, 1), COALESCE(t.is_master, false)
    INTO v_max_devices, v_is_master
    FROM public.tenants t
    JOIN auth.users u ON lower(u.email) = lower(t.email)
    WHERE u.id = NEW.user_id
    LIMIT 1;

    IF COALESCE(v_is_master, false) THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO v_current_count
    FROM public.devices
    WHERE user_id = NEW.user_id
      AND id <> NEW.id;

    IF v_current_count >= COALESCE(v_max_devices, 1) THEN
        RAISE EXCEPTION 'Limite de dispositivos atingido para o seu plano atual (% aparelho(s)). Faça upgrade para conectar mais nós.', COALESCE(v_max_devices, 1);
    END IF;

    RETURN NEW;
END;
$function$;

-- 8. Recriar get_dashboard_analytics(p_year) filtrando estritamente pelo usuário autenticado (auth.uid())
CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(p_year integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id uuid;
    v_target_year integer;
    v_current_month_start timestamptz;
    v_sent_month integer := 0;
    v_recv_month integer := 0;
    v_failed_month integer := 0;
    v_monthly_chart jsonb := '[]'::jsonb;
    v_chips_chart jsonb := '[]'::jsonb;
BEGIN
    v_user_id := auth.uid();
    v_target_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_TIMESTAMP)::integer);
    v_current_month_start := date_trunc('month', CURRENT_TIMESTAMP);

    -- Se não houver usuário autenticado, retorna tudo zerado (nunca vaza dados globais)
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'current_month', json_build_object('sent', 0, 'received', 0, 'failed', 0),
            'year', v_target_year,
            'monthly_evolution', '[]'::jsonb,
            'by_chip', '[]'::jsonb
        );
    END IF;

    /* 1. Métricas do Mês Atual (exclusivas do v_user_id) */
    SELECT 
        COALESCE(
            (SELECT COUNT(*) FROM public.sms_queue q
             WHERE q.status IN ('SENT', 'DELIVERED')
               AND q.created_at >= v_current_month_start
               AND (
                   q.user_id = v_user_id
                   OR (q.user_id IS NULL AND q.target_device_id IN (SELECT d.id FROM public.devices d WHERE d.user_id = v_user_id))
               ))
            +
            (SELECT COUNT(*) FROM public.sms_sent s
             WHERE (s.sent_at >= v_current_month_start OR s.created_at >= v_current_month_start)
               AND (
                   s.user_id = v_user_id
                   OR (s.user_id IS NULL AND s.target_device_id IN (SELECT d.id FROM public.devices d WHERE d.user_id = v_user_id))
               ))
        , 0),
        COALESCE(
            (SELECT COUNT(*) FROM public.sms_queue q
             WHERE q.status = 'FAILED'
               AND q.created_at >= v_current_month_start
               AND (
                   q.user_id = v_user_id
                   OR (q.user_id IS NULL AND q.target_device_id IN (SELECT d.id FROM public.devices d WHERE d.user_id = v_user_id))
               ))
            +
            (SELECT COUNT(*) FROM public.sms_failed f
             WHERE (f.failed_at >= v_current_month_start OR f.created_at >= v_current_month_start)
               AND (
                   f.user_id = v_user_id
                   OR (f.user_id IS NULL AND f.target_device_id IN (SELECT d.id FROM public.devices d WHERE d.user_id = v_user_id))
               ))
        , 0)
    INTO v_sent_month, v_failed_month;

    SELECT COALESCE(COUNT(*), 0)
    INTO v_recv_month
    FROM public.sms_inbound i
    WHERE i.device_id IN (SELECT d.id FROM public.devices d WHERE d.user_id = v_user_id)
      AND i.received_at >= v_current_month_start;

    /* 2. Gráfico Mensal: 12 meses do ano selecionado (exclusivo do v_user_id) */
    WITH months AS (
        SELECT generate_series(
            make_timestamptz(v_target_year, 1, 1, 0, 0, 0),
            make_timestamptz(v_target_year, 12, 1, 0, 0, 0),
            interval '1 month'
        ) AS m_date
    ),
    user_devices AS (
        SELECT d.id FROM public.devices d WHERE d.user_id = v_user_id
    ),
    all_sent AS (
        SELECT q.created_at AS dt
        FROM public.sms_queue q
        WHERE q.status IN ('SENT', 'DELIVERED')
          AND (q.user_id = v_user_id OR (q.user_id IS NULL AND q.target_device_id IN (SELECT id FROM user_devices)))
        UNION ALL
        SELECT COALESCE(s.sent_at, s.created_at) AS dt
        FROM public.sms_sent s
        WHERE (s.user_id = v_user_id OR (s.user_id IS NULL AND s.target_device_id IN (SELECT id FROM user_devices)))
    ),
    all_failed AS (
        SELECT q.created_at AS dt
        FROM public.sms_queue q
        WHERE q.status = 'FAILED'
          AND (q.user_id = v_user_id OR (q.user_id IS NULL AND q.target_device_id IN (SELECT id FROM user_devices)))
        UNION ALL
        SELECT COALESCE(f.failed_at, f.created_at) AS dt
        FROM public.sms_failed f
        WHERE (f.user_id = v_user_id OR (f.user_id IS NULL AND f.target_device_id IN (SELECT id FROM user_devices)))
    ),
    sent_stats AS (
        SELECT date_trunc('month', dt) AS m_date, COUNT(*) AS sent_total
        FROM all_sent
        WHERE EXTRACT(YEAR FROM dt) = v_target_year
        GROUP BY 1
    ),
    failed_stats AS (
        SELECT date_trunc('month', dt) AS m_date, COUNT(*) AS failed_total
        FROM all_failed
        WHERE EXTRACT(YEAR FROM dt) = v_target_year
        GROUP BY 1
    ),
    recv_stats AS (
        SELECT date_trunc('month', i.received_at) AS m_date, COUNT(*) AS recv_total
        FROM public.sms_inbound i
        WHERE i.device_id IN (SELECT id FROM user_devices)
          AND EXTRACT(YEAR FROM i.received_at) = v_target_year
        GROUP BY 1
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'month', to_char(m.m_date, 'Mon'),
                'month_num', EXTRACT(MONTH FROM m.m_date),
                'sent', COALESCE(s.sent_total, 0),
                'failed', COALESCE(f.failed_total, 0),
                'received', COALESCE(r.recv_total, 0)
            ) ORDER BY m.m_date
        ),
        '[]'::jsonb
    )
    INTO v_monthly_chart
    FROM months m
    LEFT JOIN sent_stats s ON s.m_date = m.m_date
    LEFT JOIN failed_stats f ON f.m_date = m.m_date
    LEFT JOIN recv_stats r ON r.m_date = m.m_date;

    /* 3. Desempenho por Chip/Slot no Ano (exclusivo do v_user_id) */
    WITH user_devices AS (
        SELECT d.id FROM public.devices d WHERE d.user_id = v_user_id
    ),
    slot_union AS (
        SELECT q.sim_slot, q.created_at AS dt
        FROM public.sms_queue q
        WHERE q.status IN ('SENT', 'DELIVERED')
          AND (q.user_id = v_user_id OR (q.user_id IS NULL AND q.target_device_id IN (SELECT id FROM user_devices)))
        UNION ALL
        SELECT s.sim_slot, COALESCE(s.sent_at, s.created_at) AS dt
        FROM public.sms_sent s
        WHERE (s.user_id = v_user_id OR (s.user_id IS NULL AND s.target_device_id IN (SELECT id FROM user_devices)))
    ),
    slot_counts AS (
        SELECT 
            COALESCE(sim_slot, 0) AS slot_num,
            COUNT(*) AS total
        FROM slot_union
        WHERE EXTRACT(YEAR FROM dt) = v_target_year
        GROUP BY COALESCE(sim_slot, 0)
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'sim_slot', slot_num,
                'total', total,
                'total_sent', total
            )
        ),
        '[]'::jsonb
    )
    INTO v_chips_chart
    FROM slot_counts;

    RETURN jsonb_build_object(
        'current_month', json_build_object(
            'sent', v_sent_month,
            'received', v_recv_month,
            'failed', v_failed_month
        ),
        'year', v_target_year,
        'monthly_evolution', v_monthly_chart,
        'by_chip', v_chips_chart
    );
END;
$function$;

