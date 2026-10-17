-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.sms_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  message text NOT NULL,
  sim_slot integer DEFAULT 0,
  status text DEFAULT 'PENDING'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  target_device_id text DEFAULT 'ALL'::text,
  tenant_id uuid,
  campaign_id uuid,
  scheduled_for timestamp with time zone DEFAULT now(),
  contact_id uuid,
  user_id uuid,
  error_message text,
  failed_at timestamp with time zone,
  sent_at timestamp with time zone,
  CONSTRAINT sms_queue_pkey PRIMARY KEY (id),
  CONSTRAINT sms_queue_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT sms_queue_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT sms_queue_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id),
  CONSTRAINT sms_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.tenants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  status text DEFAULT 'ACTIVE'::text,
  plano text DEFAULT 'FREE'::text,
  max_devices integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  max_sim_slots integer DEFAULT 1,
  max_monthly_sms integer DEFAULT 300,
  max_contacts integer DEFAULT 100,
  allow_scheduling boolean DEFAULT false,
  gateway_subscription_id text,
  subscription_status text DEFAULT 'ACTIVE'::text,
  billing_cycle_start timestamp with time zone DEFAULT now(),
  is_master boolean NOT NULL DEFAULT false,
  CONSTRAINT tenants_pkey PRIMARY KEY (id)
);
CREATE TABLE public.api_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid,
  token text NOT NULL UNIQUE,
  nome text DEFAULT 'Token Padrão'::text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  last_used_at timestamp with time zone,
  CONSTRAINT api_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT api_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.sms_inbound (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_phone text NOT NULL,
  message text NOT NULL,
  sim_slot integer DEFAULT 0,
  device_id text NOT NULL,
  received_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sms_inbound_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sms_sent (
  id uuid NOT NULL,
  phone text NOT NULL,
  message text NOT NULL,
  sim_slot integer DEFAULT 0,
  target_device_id text,
  status text DEFAULT 'DELIVERED'::text,
  created_at timestamp with time zone,
  sent_at timestamp with time zone DEFAULT now(),
  campaign_id uuid,
  CONSTRAINT sms_sent_pkey PRIMARY KEY (id),
  CONSTRAINT sms_sent_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);
CREATE TABLE public.sms_failed (
  id uuid NOT NULL,
  phone text NOT NULL,
  message text NOT NULL,
  sim_slot integer DEFAULT 0,
  target_device_id text,
  status text DEFAULT 'FAILED'::text,
  error_message text DEFAULT 'Falha no modem ou operadora'::text,
  created_at timestamp with time zone,
  failed_at timestamp with time zone DEFAULT now(),
  campaign_id uuid,
  CONSTRAINT sms_failed_pkey PRIMARY KEY (id),
  CONSTRAINT sms_failed_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);
CREATE TABLE public.user_webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id text,
  url text NOT NULL,
  secret_key text NOT NULL,
  events ARRAY NOT NULL DEFAULT '{sms_received,sms_sent,sms_failed}'::text[],
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_webhooks_pkey PRIMARY KEY (id),
  CONSTRAINT fk_user_webhooks_device FOREIGN KEY (device_id) REFERENCES public.devices(id)
);
CREATE TABLE public.webhook_delivery_queue (
  id bigint NOT NULL DEFAULT nextval('webhook_delivery_queue_id_seq'::regclass),
  webhook_id uuid,
  payload jsonb NOT NULL,
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 5,
  status text DEFAULT 'PENDING'::text,
  next_retry_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT webhook_delivery_queue_pkey PRIMARY KEY (id),
  CONSTRAINT webhook_delivery_queue_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.user_webhooks(id)
);
CREATE TABLE public.devices (
  id text NOT NULL,
  user_id uuid,
  name text NOT NULL,
  sim1_operator text,
  sim2_operator text,
  status text DEFAULT 'offline'::text,
  last_ping timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT devices_pkey PRIMARY KEY (id),
  CONSTRAINT devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone text NOT NULL,
  name text,
  tags ARRAY DEFAULT '{}'::text[],
  opted_out boolean NOT NULL DEFAULT false,
  opted_out_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  tipo text,
  CONSTRAINT contacts_pkey PRIMARY KEY (id),
  CONSTRAINT contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.contact_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT contact_groups_pkey PRIMARY KEY (id)
);
CREATE TABLE public.contact_group_members (
  contact_id uuid NOT NULL,
  group_id uuid NOT NULL,
  CONSTRAINT contact_group_members_pkey PRIMARY KEY (contact_id, group_id),
  CONSTRAINT contact_group_members_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id),
  CONSTRAINT contact_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.contact_groups(id),
  CONSTRAINT fk_contact_group_members_contact FOREIGN KEY (contact_id) REFERENCES public.contacts(id)
);
CREATE TABLE public.campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  title text NOT NULL,
  message_template text NOT NULL,
  sim_slot_preference integer DEFAULT 0,
  target_device_id text,
  status text DEFAULT 'DRAFT'::text,
  interval_seconds integer DEFAULT 15,
  scheduled_for timestamp with time zone,
  start_hour_allowed integer DEFAULT 8,
  end_hour_allowed integer DEFAULT 20,
  total_contacts integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  config jsonb,
  total_recipients integer DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT campaigns_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT campaigns_target_device_id_fkey FOREIGN KEY (target_device_id) REFERENCES public.devices(id)
);
CREATE TABLE public.sms_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid,
  user_id uuid,
  target_device_id text NOT NULL,
  sim_slot integer DEFAULT 0,
  phone text NOT NULL,
  message text NOT NULL,
  scheduled_for timestamp with time zone NOT NULL,
  status text DEFAULT 'WAITING'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sms_schedule_pkey PRIMARY KEY (id),
  CONSTRAINT sms_schedule_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT sms_schedule_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.subscription_plans (
  id text NOT NULL,
  name text NOT NULL,
  price_brl numeric NOT NULL,
  price_usd numeric NOT NULL,
  max_devices integer NOT NULL,
  max_sim_slots integer NOT NULL,
  max_monthly_sms integer NOT NULL,
  max_contacts integer NOT NULL,
  allow_scheduling boolean NOT NULL DEFAULT false,
  description text,
  highlight boolean DEFAULT false,
  stripe_price_id text,
  stripe_product_id text,
  CONSTRAINT subscription_plans_pkey PRIMARY KEY (id)
);