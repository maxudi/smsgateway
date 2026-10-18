-- ============================================================================
-- MIGRAÇÃO: Validação Completa dos Planos (SMS/mês, Chips, Contatos, Webhooks e Monitoramento)
-- Data: 2026-10-17
-- Objetivo:
--   1. Sincronizar automaticamente todos os limites de `subscription_plans` para `tenants`
--      (`max_devices`, `max_sim_slots`, `max_monthly_sms`, `max_contacts`, `allow_scheduling`).
--   2. Bloquear envios em `sms_queue` e `sms_schedule` quando o usuário atingir a cota mensal
--      de disparos do plano (`max_monthly_sms`, ex.: 300 SMS/mês no FREE) e forçar `sim_slot = 0`
--      (SIM 1) quando `max_sim_slots <= 1`.
--   3. Bloquear cadastro de novos contatos em `contacts` ao atingir `max_contacts` (ex.: 100 no FREE).
--   4. Monitorar apenas o SIM 1 (`sim_slot = 0`) em `sms_inbound` no plano FREE e isolar o disparo
--      de `webhook_delivery_queue` estritamente para os webhooks do dono do aparelho (`user_id`).
--   5. Limitar a quantidade de Webhooks em `user_webhooks` de acordo com o plano (1 no FREE).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Garantir que `subscription_plans` tenha `max_sim_slots` configurado
--    FREE = 1 chip (SIM 1) | Planos pagos (STARTER, PRO, PLUS/ENTERPRISE) = 2 chips (Dual-SIM)
-- ----------------------------------------------------------------------------
UPDATE public.subscription_plans
SET max_sim_slots = 1
WHERE UPPER(COALESCE(id, '')) = 'FREE'
   OR COALESCE(price_brl, 0) = 0;

UPDATE public.subscription_plans
SET max_sim_slots = 2
WHERE UPPER(COALESCE(id, '')) <> 'FREE'
  AND COALESCE(price_brl, 0) > 0
  AND COALESCE(max_sim_slots, 0) < 2;

-- ----------------------------------------------------------------------------
-- 2. Trigger para sincronizar limites de `subscription_plans` -> `tenants`
--    (Necessário pois o stripe-webhook atualiza apenas `tenants.plano`)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_tenant_plan_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan RECORD;
BEGIN
  IF COALESCE(NEW.is_master, false) = true THEN
    RETURN NEW;
  END IF;

  SELECT
    id,
    max_devices,
    max_sim_slots,
    max_monthly_sms,
    max_contacts,
    allow_scheduling
  INTO v_plan
  FROM public.subscription_plans
  WHERE UPPER(id) = UPPER(COALESCE(NEW.plano, 'FREE'))
  LIMIT 1;

  IF FOUND THEN
    NEW.max_devices      := COALESCE(v_plan.max_devices, 1);
    NEW.max_sim_slots    := COALESCE(v_plan.max_sim_slots, CASE WHEN UPPER(v_plan.id) = 'FREE' THEN 1 ELSE 2 END);
    NEW.max_monthly_sms  := COALESCE(v_plan.max_monthly_sms, 300);
    NEW.max_contacts     := COALESCE(v_plan.max_contacts, 100);
    NEW.allow_scheduling := COALESCE(v_plan.allow_scheduling, false);
  ELSIF UPPER(COALESCE(NEW.plano, 'FREE')) = 'FREE' THEN
    NEW.max_devices      := 1;
    NEW.max_sim_slots    := 1;
    NEW.max_monthly_sms  := COALESCE(NEW.max_monthly_sms, 300);
    NEW.max_contacts     := COALESCE(NEW.max_contacts, 100);
    NEW.allow_scheduling := false;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_tenant_plan_limits ON public.tenants;
CREATE TRIGGER trg_sync_tenant_plan_limits
  BEFORE INSERT OR UPDATE OF plano ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_tenant_plan_limits();

-- Sincronizar todos os tenants atuais não-master com os limites reais do seu plano
UPDATE public.tenants t
SET
  max_devices      = COALESCE(sp.max_devices, 1),
  max_sim_slots    = COALESCE(sp.max_sim_slots, CASE WHEN UPPER(COALESCE(t.plano, 'FREE')) = 'FREE' THEN 1 ELSE 2 END),
  max_monthly_sms  = COALESCE(sp.max_monthly_sms, 300),
  max_contacts     = COALESCE(sp.max_contacts, 100),
  allow_scheduling = COALESCE(sp.allow_scheduling, false)
FROM public.subscription_plans sp
WHERE UPPER(sp.id) = UPPER(COALESCE(t.plano, 'FREE'))
  AND COALESCE(t.is_master, false) = false;

-- Também atualizar handle_new_tenant_user() para já incluir max_sim_slots = 1 no cadastro
CREATE OR REPLACE FUNCTION public.handle_new_tenant_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.tenants (
    nome,
    email,
    plano,
    max_devices,
    max_sim_slots,
    max_monthly_sms,
    max_contacts,
    allow_scheduling,
    is_master
  )
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'FREE',
    1,
    1,
    300,
    100,
    false,
    false
  )
  ON CONFLICT (email) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 3. Controle de Cota Mensal de SMS (`max_monthly_sms`) e Slot (`max_sim_slots`)
--    na fila `sms_queue` e em `sms_schedule`
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_sms_queue_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_master       boolean := false;
  v_tenant_status   text := 'ACTIVE';
  v_max_slots       integer := 1;
  v_max_monthly_sms integer := 300;
  v_month_start     timestamptz := date_trunc('month', now());
  v_used_month      integer := 0;
BEGIN
  -- 1. Resolver user_id se não informado (ex.: disparo via Edge Function send-sms ou n8n)
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

  -- 2. Resolver tenant_id a partir do user_id dono da mensagem
  IF NEW.tenant_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT t.id INTO NEW.tenant_id
    FROM public.tenants t
    JOIN auth.users u ON lower(u.email) = lower(t.email)
    WHERE u.id = NEW.user_id
    LIMIT 1;
  END IF;

  -- 3. Buscar limites e status do plano do tenant
  IF NEW.tenant_id IS NOT NULL THEN
    SELECT
      COALESCE(t.is_master, false),
      UPPER(COALESCE(t.status, 'ACTIVE')),
      COALESCE(t.max_sim_slots, 1),
      COALESCE(t.max_monthly_sms, 300)
    INTO v_is_master, v_tenant_status, v_max_slots, v_max_monthly_sms
    FROM public.tenants t
    WHERE t.id = NEW.tenant_id
    LIMIT 1;
  ELSIF NEW.user_id IS NOT NULL THEN
    SELECT
      COALESCE(t.is_master, false),
      UPPER(COALESCE(t.status, 'ACTIVE')),
      COALESCE(t.max_sim_slots, 1),
      COALESCE(t.max_monthly_sms, 300)
    INTO v_is_master, v_tenant_status, v_max_slots, v_max_monthly_sms
    FROM public.tenants t
    JOIN auth.users u ON lower(u.email) = lower(t.email)
    WHERE u.id = NEW.user_id
    LIMIT 1;
  END IF;

  -- 4. Se não for Admin Master, aplica travas de bloqueio, slot e cota mensal de SMS
  IF NOT COALESCE(v_is_master, false) THEN
    IF v_tenant_status = 'BLOCKED' AND TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Conta bloqueada pelo administrador. Entre em contato com o suporte.';
    END IF;

    -- 4.1 Restrição de chip: se o plano permite apenas 1 chip (FREE), força SIM 1 (slot 0)
    IF COALESCE(v_max_slots, 1) <= 1 THEN
      NEW.sim_slot := 0;
    ELSE
      NEW.sim_slot := COALESCE(NEW.sim_slot, 0);
    END IF;

    -- 4.2 Restrição de cota mensal (apenas em INSERT de novas mensagens)
    IF TG_OP = 'INSERT' AND NEW.user_id IS NOT NULL THEN
      SELECT
        COALESCE((
          SELECT COUNT(*)
          FROM public.sms_sent s
          WHERE s.user_id = NEW.user_id
            AND COALESCE(s.sent_at, s.created_at) >= v_month_start
        ), 0)
        +
        COALESCE((
          SELECT COUNT(*)
          FROM public.sms_queue q
          WHERE q.user_id = NEW.user_id
            AND q.created_at >= v_month_start
            AND q.status IN ('PENDING', 'SCHEDULED', 'PROCESSING', 'SENT', 'DELIVERED')
        ), 0)
      INTO v_used_month;

      IF v_used_month >= v_max_monthly_sms THEN
        RAISE EXCEPTION 'Limite mensal de disparos atingido para o seu plano (% SMS/mês). Faça upgrade para enviar mais mensagens.', v_max_monthly_sms;
      END IF;
    END IF;
  ELSE
    NEW.sim_slot := COALESCE(NEW.sim_slot, 0);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_sms_queue_tenant ON public.sms_queue;
CREATE TRIGGER trg_set_sms_queue_tenant
  BEFORE INSERT OR UPDATE ON public.sms_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sms_queue_tenant();

-- Proteger também a tabela `sms_schedule` (agendamentos)
CREATE OR REPLACE FUNCTION public.enforce_schedule_sim_slot_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_master        boolean := false;
  v_max_slots        integer := 1;
  v_allow_scheduling boolean := false;
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  IF NEW.user_id IS NOT NULL THEN
    SELECT
      COALESCE(t.is_master, false),
      COALESCE(t.max_sim_slots, 1),
      COALESCE(t.allow_scheduling, false)
    INTO v_is_master, v_max_slots, v_allow_scheduling
    FROM public.tenants t
    JOIN auth.users u ON lower(u.email) = lower(t.email)
    WHERE u.id = NEW.user_id
    ORDER BY t.is_master DESC
    LIMIT 1;
  END IF;

  IF NOT COALESCE(v_is_master, false) AND COALESCE(v_max_slots, 1) <= 1 THEN
    NEW.sim_slot := 0;
  ELSE
    NEW.sim_slot := COALESCE(NEW.sim_slot, 0);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_schedule_sim_slot_limit ON public.sms_schedule;
CREATE TRIGGER trg_enforce_schedule_sim_slot_limit
  BEFORE INSERT OR UPDATE ON public.sms_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_schedule_sim_slot_limit();

-- ----------------------------------------------------------------------------
-- 4. Limite de Contatos (`max_contacts`) na tabela `contacts`
--    (Ex.: 100 contatos no FREE, 2.000 no STARTER, etc.)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_contact_limit_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_master     boolean := false;
  v_max_contacts  integer := 100;
  v_current_count integer := 0;
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(t.is_master, false),
    COALESCE(t.max_contacts, 100)
  INTO v_is_master, v_max_contacts
  FROM public.tenants t
  JOIN auth.users u ON lower(u.email) = lower(t.email)
  WHERE u.id = NEW.user_id
  ORDER BY t.is_master DESC
  LIMIT 1;

  IF COALESCE(v_is_master, false) = true THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
    INTO v_current_count
    FROM public.contacts c
   WHERE c.user_id = NEW.user_id;

  IF v_current_count >= v_max_contacts THEN
    RAISE EXCEPTION 'Limite de contatos atingido para o seu plano atual (% contatos). Faça upgrade para cadastrar mais contatos.', v_max_contacts;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_check_contact_limit ON public.contacts;
CREATE TRIGGER trg_check_contact_limit
  BEFORE INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.check_contact_limit_before_insert();

-- ----------------------------------------------------------------------------
-- 5. Monitoramento de Chip (`sms_inbound`) + Isolamento de Webhooks (`webhook_delivery_queue`)
--    - No plano FREE (`max_sim_slots <= 1`), mensagens recebidas no SIM 2 (`sim_slot > 0`)
--      são ignoradas para que apenas 1 chip (SIM 1) seja monitorado.
--    - `enqueue_sms_inbound_webhook` agora enfileira na `webhook_delivery_queue` APENAS
--      para os webhooks do dono do aparelho (`w.user_id = v_owner_user_id`), respeitando
--      o limite de webhooks do plano.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_inbound_sim_slot_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_user_id uuid;
  v_is_master     boolean := false;
  v_max_slots     integer := 1;
BEGIN
  SELECT d.user_id
    INTO v_owner_user_id
    FROM public.devices d
   WHERE d.id = NEW.device_id
   LIMIT 1;

  IF v_owner_user_id IS NOT NULL THEN
    SELECT
      COALESCE(t.is_master, false),
      COALESCE(t.max_sim_slots, 1)
    INTO v_is_master, v_max_slots
    FROM public.tenants t
    JOIN auth.users u ON lower(u.email) = lower(t.email)
    WHERE u.id = v_owner_user_id
    ORDER BY t.is_master DESC
    LIMIT 1;

    -- Se o plano só permite monitorar 1 chip (SIM 1 / slot 0), ignora eventos do SIM 2 (slot > 0)
    IF NOT COALESCE(v_is_master, false) AND COALESCE(v_max_slots, 1) <= 1 AND COALESCE(NEW.sim_slot, 0) > 0 THEN
      RETURN NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_inbound_sim_slot_limit ON public.sms_inbound;
CREATE TRIGGER trg_enforce_inbound_sim_slot_limit
  BEFORE INSERT ON public.sms_inbound
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_inbound_sim_slot_limit();

CREATE OR REPLACE FUNCTION public.enqueue_sms_inbound_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_user_id uuid;
  v_is_master     boolean := false;
  v_max_devices   integer := 1;
  v_limit         integer := 1;
  r_webhook       RECORD;
BEGIN
  -- Identificar o dono do aparelho que recebeu o SMS
  SELECT d.user_id
    INTO v_owner_user_id
    FROM public.devices d
   WHERE d.id = NEW.device_id
   LIMIT 1;

  IF v_owner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(t.is_master, false),
    COALESCE(t.max_devices, 1)
  INTO v_is_master, v_max_devices
  FROM public.tenants t
  JOIN auth.users u ON lower(u.email) = lower(t.email)
  WHERE u.id = v_owner_user_id
  ORDER BY t.is_master DESC
  LIMIT 1;

  v_limit := CASE WHEN COALESCE(v_is_master, false) THEN 1000 ELSE GREATEST(COALESCE(v_max_devices, 1), 1) END;

  -- Busca apenas os webhooks ativos DO DONO DO APARELHO, respeitando o limite do plano
  FOR r_webhook IN
    SELECT id, url, secret_key
    FROM public.user_webhooks
    WHERE user_id = v_owner_user_id
      AND is_active = true
      AND (device_id = NEW.device_id OR device_id IS NULL)
      AND ('sms_received' = ANY(events) OR events IS NULL)
    ORDER BY created_at ASC
    LIMIT v_limit
  LOOP
    INSERT INTO public.webhook_delivery_queue (
      webhook_id,
      payload,
      attempts,
      max_attempts,
      status,
      next_retry_at
    ) VALUES (
      r_webhook.id,
      jsonb_build_object(
        'event', 'sms.received',
        'inbound_id', NEW.id,
        'device_id', NEW.device_id,
        'sim_slot', COALESCE(NEW.sim_slot, 0),
        'from', NEW.sender_phone,
        'message', NEW.message,
        'received_at', NEW.received_at
      ),
      0,
      5,
      'PENDING',
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 6. Limite de criação de Webhooks (`user_webhooks`) no banco de dados
--    Plano FREE (`max_devices = 1`) -> máximo de 1 webhook por usuário.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_webhook_limit_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_master     boolean := false;
  v_max_webhooks  integer := 1;
  v_current_count integer := 0;
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(t.is_master, false),
    GREATEST(COALESCE(t.max_devices, 1), 1)
  INTO v_is_master, v_max_webhooks
  FROM public.tenants t
  JOIN auth.users u ON lower(u.email) = lower(t.email)
  WHERE u.id = NEW.user_id
  ORDER BY t.is_master DESC
  LIMIT 1;

  IF COALESCE(v_is_master, false) = true THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
    INTO v_current_count
    FROM public.user_webhooks w
   WHERE w.user_id = NEW.user_id;

  IF v_current_count >= COALESCE(v_max_webhooks, 1) THEN
    RAISE EXCEPTION 'Limite de Webhooks do plano atingido (máximo: %). Faça upgrade para adicionar mais webhooks.', COALESCE(v_max_webhooks, 1);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_check_webhook_limit ON public.user_webhooks;
CREATE TRIGGER trg_check_webhook_limit
  BEFORE INSERT ON public.user_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.check_webhook_limit_before_insert();

-- ----------------------------------------------------------------------------
-- 7. Funções Administrativas (Painel Admin Master no Frontend)
--    Permitem ao Admin Master listar clientes com uso em tempo real, alterar plano,
--    bloquear/desbloquear conta, excluir usuário e editar catálogo de planos.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_tenants()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month_start timestamptz := date_trunc('month', now());
  v_result      jsonb;
BEGIN
  IF NOT public.is_master() THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Admin Master pode listar todos os usuários.';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'tenant_id', t.id,
        'user_id', u.id,
        'nome', t.nome,
        'email', t.email,
        'plano', COALESCE(t.plano, 'FREE'),
        'status', COALESCE(t.status, 'ACTIVE'),
        'subscription_status', COALESCE(t.subscription_status, 'ACTIVE'),
        'is_master', COALESCE(t.is_master, false),
        'max_devices', COALESCE(t.max_devices, 1),
        'max_sim_slots', COALESCE(t.max_sim_slots, 1),
        'max_monthly_sms', COALESCE(t.max_monthly_sms, 300),
        'max_contacts', COALESCE(t.max_contacts, 100),
        'allow_scheduling', COALESCE(t.allow_scheduling, false),
        'created_at', COALESCE(u.created_at, t.created_at),
        'devices_used', COALESCE((SELECT COUNT(*) FROM public.devices d WHERE d.user_id = u.id), 0),
        'contacts_used', COALESCE((SELECT COUNT(*) FROM public.contacts c WHERE c.user_id = u.id), 0),
        'webhooks_used', COALESCE((SELECT COUNT(*) FROM public.user_webhooks w WHERE w.user_id = u.id), 0),
        'sms_used_month', COALESCE((
          SELECT COUNT(*) FROM public.sms_sent s
          WHERE s.user_id = u.id AND COALESCE(s.sent_at, s.created_at) >= v_month_start
        ), 0) + COALESCE((
          SELECT COUNT(*) FROM public.sms_queue q
          WHERE q.user_id = u.id AND q.created_at >= v_month_start
            AND q.status IN ('PENDING', 'SCHEDULED', 'PROCESSING', 'SENT', 'DELIVERED')
        ), 0)
      )
      ORDER BY t.is_master DESC, COALESCE(u.created_at, t.created_at) DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM public.tenants t
  LEFT JOIN auth.users u ON lower(u.email) = lower(t.email);

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_tenant(
  p_tenant_id uuid,
  p_plano text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_master() THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Admin Master pode alterar usuários.';
  END IF;

  UPDATE public.tenants
  SET
    plano = COALESCE(UPPER(p_plano), plano),
    status = COALESCE(UPPER(p_status), status)
  WHERE id = p_tenant_id;

  -- Se bloquear a conta, desativa os tokens de API HTTP do tenant
  IF UPPER(COALESCE(p_status, '')) = 'BLOCKED' THEN
    UPDATE public.api_tokens
    SET ativo = false, is_active = false
    WHERE tenant_id = p_tenant_id;
  ELSIF UPPER(COALESCE(p_status, '')) = 'ACTIVE' THEN
    UPDATE public.api_tokens
    SET ativo = true, is_active = true
    WHERE tenant_id = p_tenant_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_tenant(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id   uuid;
  v_is_master boolean := false;
BEGIN
  IF NOT public.is_master() THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Admin Master pode excluir usuários.';
  END IF;

  SELECT COALESCE(t.is_master, false), u.id
    INTO v_is_master, v_user_id
    FROM public.tenants t
    LEFT JOIN auth.users u ON lower(u.email) = lower(t.email)
   WHERE t.id = p_tenant_id
   LIMIT 1;

  IF v_is_master THEN
    RAISE EXCEPTION 'Não é permitido excluir a conta Admin Master.';
  END IF;

  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.webhook_delivery_queue WHERE webhook_id IN (SELECT id FROM public.user_webhooks WHERE user_id = v_user_id);
    DELETE FROM public.user_webhooks WHERE user_id = v_user_id;
    DELETE FROM public.sms_schedule WHERE user_id = v_user_id;
    DELETE FROM public.sms_queue WHERE user_id = v_user_id OR tenant_id = p_tenant_id;
    DELETE FROM public.sms_sent WHERE user_id = v_user_id;
    DELETE FROM public.sms_failed WHERE user_id = v_user_id;
    DELETE FROM public.campaigns WHERE user_id = v_user_id;
    DELETE FROM public.contact_group_members WHERE contact_id IN (SELECT id FROM public.contacts WHERE user_id = v_user_id);
    DELETE FROM public.contacts WHERE user_id = v_user_id;
    DELETE FROM public.sms_inbound WHERE device_id IN (SELECT id FROM public.devices WHERE user_id = v_user_id);
    DELETE FROM public.devices WHERE user_id = v_user_id;
  END IF;

  DELETE FROM public.api_tokens WHERE tenant_id = p_tenant_id;
  DELETE FROM public.tenants WHERE id = p_tenant_id;

  IF v_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_user_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_plan(
  p_id text,
  p_name text,
  p_price_brl numeric,
  p_max_devices integer,
  p_max_sim_slots integer,
  p_max_monthly_sms integer,
  p_max_contacts integer,
  p_allow_scheduling boolean,
  p_stripe_price_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_master() THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Admin Master pode editar os planos.';
  END IF;

  UPDATE public.subscription_plans
  SET
    name             = COALESCE(p_name, name),
    price_brl        = COALESCE(p_price_brl, price_brl),
    max_devices      = COALESCE(p_max_devices, max_devices),
    max_sim_slots    = COALESCE(p_max_sim_slots, max_sim_slots),
    max_monthly_sms  = COALESCE(p_max_monthly_sms, max_monthly_sms),
    max_contacts     = COALESCE(p_max_contacts, max_contacts),
    allow_scheduling = COALESCE(p_allow_scheduling, allow_scheduling),
    stripe_price_id  = COALESCE(p_stripe_price_id, stripe_price_id)
  WHERE UPPER(id) = UPPER(p_id);

  -- Sincroniza automaticamente todos os clientes que estão neste plano
  UPDATE public.tenants
  SET plano = plano
  WHERE UPPER(COALESCE(plano, 'FREE')) = UPPER(p_id)
    AND COALESCE(is_master, false) = false;
END;
$function$;

-- ============================================================================
-- 10. PROTEÇÃO DE PROPRIEDADE EXCLUSIVA DO DEVICE ID (IMPEDE ROUBO ENTRE CONTAS)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_device_ownership_and_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_master   boolean := false;
  v_max_devices integer := 1;
  v_cur_devices integer := 0;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Se o APK Android enviar ping (anon) sem mandar user_id, preserva o dono atual
    IF OLD.user_id IS NOT NULL AND NEW.user_id IS NULL AND auth.uid() IS NULL THEN
      NEW.user_id := OLD.user_id;
      NEW.name := COALESCE(NEW.name, OLD.name);
    END IF;

    -- Se já possui dono e outro usuário tentar sobrescrever o user_id, bloqueia!
    IF OLD.user_id IS NOT NULL
       AND NEW.user_id IS NOT NULL
       AND NEW.user_id <> OLD.user_id THEN
      RAISE EXCEPTION 'Este Device ID já está vinculado a outra conta. Remova-o da conta anterior antes de cadastrá-lo aqui.';
    END IF;
  END IF;

  -- Verifica limite de aparelhos do plano quando um usuário vincula um aparelho novo
  IF NEW.user_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
    SELECT COALESCE(t.is_master, false), COALESCE(t.max_devices, 1)
      INTO v_is_master, v_max_devices
      FROM public.tenants t
      JOIN auth.users u ON lower(u.email) = lower(t.email)
     WHERE u.id = NEW.user_id
     LIMIT 1;

    IF NOT COALESCE(v_is_master, false) THEN
      SELECT COUNT(*)
        INTO v_cur_devices
        FROM public.devices d
       WHERE d.user_id = NEW.user_id
         AND d.id <> NEW.id;

      IF v_cur_devices >= COALESCE(v_max_devices, 1) THEN
        RAISE EXCEPTION 'Limite de aparelhos do seu plano atingido (máx: %). Faça upgrade para conectar mais aparelhos.', v_max_devices;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_device_ownership ON public.devices;
CREATE TRIGGER trg_protect_device_ownership
BEFORE INSERT OR UPDATE ON public.devices
FOR EACH ROW
EXECUTE FUNCTION public.protect_device_ownership_and_limit();

CREATE OR REPLACE FUNCTION public.claim_device(
  p_device_id text,
  p_name text DEFAULT 'Meu celular'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid            uuid := auth.uid();
  v_device_id      text := btrim(COALESCE(p_device_id, ''));
  v_name           text := COALESCE(NULLIF(btrim(p_name), ''), 'Meu celular');
  v_existing_owner uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF v_device_id = '' THEN
    RAISE EXCEPTION 'Informe um Device ID válido.';
  END IF;

  SELECT d.user_id
    INTO v_existing_owner
    FROM public.devices d
   WHERE d.id = v_device_id
   LIMIT 1;

  IF v_existing_owner IS NOT NULL AND v_existing_owner <> v_uid THEN
    RAISE EXCEPTION 'Este Device ID já está vinculado a outra conta. Remova-o da conta anterior antes de cadastrá-lo aqui.';
  END IF;

  INSERT INTO public.devices (id, name, user_id, status)
  VALUES (v_device_id, v_name, v_uid, 'offline')
  ON CONFLICT (id) DO UPDATE
    SET name    = EXCLUDED.name,
        user_id = EXCLUDED.user_id;
END;
$function$;

-- ============================================================================
-- 11. CAIXA DE ENTRADA (sms_inbound): MARCAR COMO IMPORTANTE, EXCLUIR E ISOLAMENTO
-- ============================================================================
ALTER TABLE public.sms_inbound
  ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_sms_inbound_device_id ON public.sms_inbound(device_id);
CREATE INDEX IF NOT EXISTS idx_sms_inbound_user_id ON public.sms_inbound(user_id);

-- Backfill do user_id nas mensagens recebidas já existentes a partir do dono do aparelho
UPDATE public.sms_inbound i
SET user_id = d.user_id
FROM public.devices d
WHERE i.device_id = d.id
  AND i.user_id IS NULL
  AND d.user_id IS NOT NULL;

-- Atualiza a função de entrada de SMS para gravar automaticamente o user_id do dono do aparelho
CREATE OR REPLACE FUNCTION public.enforce_inbound_sim_slot_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_user_id uuid;
  v_is_master     boolean := false;
  v_max_slots     integer := 1;
BEGIN
  SELECT d.user_id
    INTO v_owner_user_id
    FROM public.devices d
   WHERE d.id = NEW.device_id
   LIMIT 1;

  IF v_owner_user_id IS NOT NULL THEN
    NEW.user_id := COALESCE(NEW.user_id, v_owner_user_id);

    SELECT
      COALESCE(t.is_master, false),
      COALESCE(t.max_sim_slots, 1)
    INTO v_is_master, v_max_slots
    FROM public.tenants t
    JOIN auth.users u ON lower(u.email) = lower(t.email)
    WHERE u.id = v_owner_user_id
    ORDER BY t.is_master DESC
    LIMIT 1;

    -- Se o plano só permite monitorar 1 chip (SIM 1 / slot 0), ignora eventos do SIM 2 (slot > 0)
    IF NOT COALESCE(v_is_master, false) AND COALESCE(v_max_slots, 1) <= 1 AND COALESCE(NEW.sim_slot, 0) > 0 THEN
      RETURN NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Políticas RLS para garantir isolamento total por usuário/tenant em sms_inbound
ALTER TABLE public.sms_inbound ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their own inbound sms" ON public.sms_inbound;
  CREATE POLICY "Users can view their own inbound sms"
    ON public.sms_inbound
    FOR SELECT
    TO authenticated
    USING (
      user_id = auth.uid()
      OR device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())
    );

  DROP POLICY IF EXISTS "Users can update their own inbound sms" ON public.sms_inbound;
  CREATE POLICY "Users can update their own inbound sms"
    ON public.sms_inbound
    FOR UPDATE
    TO authenticated
    USING (
      user_id = auth.uid()
      OR device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())
    )
    WITH CHECK (
      user_id = auth.uid()
      OR device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())
    );

  DROP POLICY IF EXISTS "Users can delete their own inbound sms" ON public.sms_inbound;
  CREATE POLICY "Users can delete their own inbound sms"
    ON public.sms_inbound
    FOR DELETE
    TO authenticated
    USING (
      user_id = auth.uid()
      OR device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())
    );

  -- Garante que o APK Android possa continuar inserindo os SMS recebidos
  DROP POLICY IF EXISTS "Allow APK insert inbound sms" ON public.sms_inbound;
  CREATE POLICY "Allow APK insert inbound sms"
    ON public.sms_inbound
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

COMMIT;



