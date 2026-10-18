-- ============================================================================
-- MIGRAÇÃO COMPLEMENTAR (2026-10-18)
-- Inclui:
--   1. Proteção de propriedade exclusiva do Device ID + colunas sim1_phone / sim2_phone
--   2. Caixa de Entrada (sms_inbound): is_starred, needs_review, RLS e Pausa Inteligente em Campanhas
--   3. Encurtador Dinâmico de Links (short_links + resolve_short_link)
--   4. Maturador / Conversa entre Chips (warmup_settings + warmup_dialogues)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PROTEÇÃO DE DEVICE ID E TELEFONES DOS CHIPS (sim1_phone / sim2_phone)
-- ============================================================================
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS sim1_phone text,
  ADD COLUMN IF NOT EXISTS sim2_phone text;

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
    IF OLD.user_id IS NOT NULL AND NEW.user_id IS NULL AND auth.uid() IS NULL THEN
      NEW.user_id    := OLD.user_id;
      NEW.name       := COALESCE(NEW.name, OLD.name);
      NEW.sim1_phone := COALESCE(NEW.sim1_phone, OLD.sim1_phone);
      NEW.sim2_phone := COALESCE(NEW.sim2_phone, OLD.sim2_phone);
    END IF;

    IF OLD.user_id IS NOT NULL
       AND NEW.user_id IS NOT NULL
       AND NEW.user_id <> OLD.user_id THEN
      RAISE EXCEPTION 'Este Device ID já está vinculado a outra conta. Remova-o da conta anterior antes de cadastrá-lo aqui.';
    END IF;
  END IF;

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
-- 2. CAIXA DE ENTRADA (sms_inbound) E PAUSA INTELIGENTE DE CAMPANHAS
-- ============================================================================
ALTER TABLE public.sms_inbound
  ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_sms_inbound_device_id ON public.sms_inbound(device_id);
CREATE INDEX IF NOT EXISTS idx_sms_inbound_user_id ON public.sms_inbound(user_id);

UPDATE public.sms_inbound i
SET user_id = d.user_id
FROM public.devices d
WHERE i.device_id = d.id
  AND i.user_id IS NULL
  AND d.user_id IS NOT NULL;

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
  v_clean_phone   text;
  v_tail10        text;
  v_own_chip_cnt  integer := 0;
  v_contact_cnt   integer := 0;
  v_sched_cnt     integer := 0;
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

    IF NOT COALESCE(v_is_master, false) AND COALESCE(v_max_slots, 1) <= 1 AND COALESCE(NEW.sim_slot, 0) > 0 THEN
      RETURN NULL;
    END IF;

    v_clean_phone := regexp_replace(COALESCE(NEW.sender_phone, ''), '[^0-9]', '', 'g');
    IF length(v_clean_phone) >= 10 THEN
      v_tail10 := substr(v_clean_phone, length(v_clean_phone) - 9, 10);

      SELECT COUNT(*)
        INTO v_own_chip_cnt
        FROM public.devices dv
       WHERE dv.user_id = v_owner_user_id
         AND (
           regexp_replace(COALESCE(dv.sim1_phone, ''), '[^0-9]', '', 'g') LIKE '%' || v_tail10
           OR regexp_replace(COALESCE(dv.sim2_phone, ''), '[^0-9]', '', 'g') LIKE '%' || v_tail10
         );

      IF COALESCE(v_own_chip_cnt, 0) = 0 THEN
        SELECT COUNT(*)
          INTO v_contact_cnt
          FROM public.contacts c
         WHERE c.user_id = v_owner_user_id
           AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') LIKE '%' || v_tail10;

        SELECT COUNT(*)
          INTO v_sched_cnt
          FROM public.sms_schedule s
         WHERE s.user_id = v_owner_user_id
           AND s.campaign_id IS NOT NULL
           AND regexp_replace(COALESCE(s.phone, ''), '[^0-9]', '', 'g') LIKE '%' || v_tail10;

        IF COALESCE(v_contact_cnt, 0) > 0 OR COALESCE(v_sched_cnt, 0) > 0 THEN
          NEW.needs_review := true;
          NEW.is_starred   := true;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_sms_opt_out()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_user_id uuid;
  v_clean_phone   text;
  v_tail10        text;
  v_own_chip_cnt  integer := 0;
BEGIN
  v_owner_user_id := NEW.user_id;
  IF v_owner_user_id IS NULL THEN
    SELECT d.user_id
      INTO v_owner_user_id
      FROM public.devices d
     WHERE d.id = NEW.device_id
     LIMIT 1;
  END IF;

  v_clean_phone := regexp_replace(COALESCE(NEW.sender_phone, ''), '[^0-9]', '', 'g');
  IF v_owner_user_id IS NULL OR length(v_clean_phone) < 10 THEN
    RETURN NEW;
  END IF;

  v_tail10 := substr(v_clean_phone, length(v_clean_phone) - 9, 10);

  SELECT COUNT(*)
    INTO v_own_chip_cnt
    FROM public.devices dv
   WHERE dv.user_id = v_owner_user_id
     AND (
       regexp_replace(COALESCE(dv.sim1_phone, ''), '[^0-9]', '', 'g') LIKE '%' || v_tail10
       OR regexp_replace(COALESCE(dv.sim2_phone, ''), '[^0-9]', '', 'g') LIKE '%' || v_tail10
     );

  IF COALESCE(v_own_chip_cnt, 0) > 0 THEN
    RETURN NEW;
  END IF;

  UPDATE public.contacts
  SET opted_out    = TRUE,
      opted_out_at = NOW()
  WHERE user_id = v_owner_user_id
    AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE '%' || v_tail10;

  UPDATE public.sms_schedule
  SET status = 'CANCELLED'
  WHERE user_id = v_owner_user_id
    AND campaign_id IS NOT NULL
    AND status = 'WAITING'
    AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE '%' || v_tail10;

  UPDATE public.sms_queue
  SET status = 'OPTED_OUT'
  WHERE user_id = v_owner_user_id
    AND campaign_id IS NOT NULL
    AND status IN ('PENDING', 'SCHEDULED')
    AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE '%' || v_tail10;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sms_opt_out ON public.sms_inbound;
CREATE TRIGGER trg_sms_opt_out
  AFTER INSERT ON public.sms_inbound
  FOR EACH ROW
  EXECUTE FUNCTION public.process_sms_opt_out();

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

  DROP POLICY IF EXISTS "Allow APK insert inbound sms" ON public.sms_inbound;
  CREATE POLICY "Allow APK insert inbound sms"
    ON public.sms_inbound
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ============================================================================
-- 3. ENCURTADOR DINÂMICO DE LINKS (short_links + resolve_short_link)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.short_links (
  code text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  phone text,
  contact_name text,
  sim_slot integer DEFAULT 0,
  target_device_id text,
  destination_url text NOT NULL,
  clicks integer NOT NULL DEFAULT 0,
  clicked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_short_links_campaign_id ON public.short_links(campaign_id);
CREATE INDEX IF NOT EXISTS idx_short_links_user_id ON public.short_links(user_id);

ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage their own short links" ON public.short_links;
  CREATE POLICY "Users can manage their own short links"
    ON public.short_links
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

  DROP POLICY IF EXISTS "Public can read short link destination" ON public.short_links;
  CREATE POLICY "Public can read short link destination"
    ON public.short_links
    FOR SELECT
    TO anon, authenticated
    USING (true);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE OR REPLACE FUNCTION public.resolve_short_link(p_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
BEGIN
  UPDATE public.short_links
  SET clicks     = COALESCE(clicks, 0) + 1,
      clicked_at = COALESCE(clicked_at, NOW())
  WHERE code = btrim(COALESCE(p_code, ''))
  RETURNING destination_url INTO v_url;

  RETURN v_url;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resolve_short_link(text) TO anon, authenticated;

-- ============================================================================
-- 4. MATURADOR / CONVERSA AUTOMÁTICA ENTRE CHIPS (warmup_settings + warmup_dialogues)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.warmup_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  dialogues_per_pair integer NOT NULL DEFAULT 3,
  last_generated_date text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.warmup_dialogues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text DEFAULT 'Cotidiano',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.warmup_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warmup_dialogues ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users manage own warmup settings" ON public.warmup_settings;
  CREATE POLICY "Users manage own warmup settings"
    ON public.warmup_settings
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

  DROP POLICY IF EXISTS "Users manage own warmup dialogues" ON public.warmup_dialogues;
  CREATE POLICY "Users manage own warmup dialogues"
    ON public.warmup_dialogues
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

COMMIT;

