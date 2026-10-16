-- ==============================================================================
-- Migration: Conformidade LGPD e Termos de Uso (Consentimento de Cadastro)
-- Data: 16/10/2026
-- Descrição: Adiciona colunas para registrar o aceite dos Termos de Uso e
--            Política de Privacidade (LGPD - Lei 13.709/2018) com timestamp.
-- ==============================================================================

-- 1. Adicionar colunas na tabela user_profiles (se existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'user_profiles'
    ) THEN
        ALTER TABLE public.user_profiles 
        ADD COLUMN IF NOT EXISTS accepted_terms BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ;

        COMMENT ON COLUMN public.user_profiles.accepted_terms IS 'Registra se o usuário concordou com os Termos de Uso e Política de Privacidade';
        COMMENT ON COLUMN public.user_profiles.accepted_terms_at IS 'Data e hora em que o consentimento LGPD foi registrado';
    END IF;
END $$;

-- 2. Adicionar colunas na tabela tenants (se existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'tenants'
    ) THEN
        ALTER TABLE public.tenants 
        ADD COLUMN IF NOT EXISTS accepted_terms BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ;

        COMMENT ON COLUMN public.tenants.accepted_terms IS 'Registra se o tenant aceitou os Termos de Uso e Política de Privacidade';
        COMMENT ON COLUMN public.tenants.accepted_terms_at IS 'Data e hora do consentimento legal LGPD';
    END IF;
END $$;
