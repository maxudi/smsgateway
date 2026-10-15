import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

/** Plano efetivo: limites do tenant têm prioridade sobre os do catálogo; nomes legados mantidos para o restante do app. */
function normalizePlan(sp, tenant) {
  return {
    ...sp,
    max_devices: tenant?.max_devices ?? sp.max_devices,
    max_sms_monthly: tenant?.max_monthly_sms ?? sp.max_monthly_sms ?? sp.max_sms_monthly,
    max_contacts: tenant?.max_contacts ?? sp.max_contacts,
    allow_scheduler: sp.allow_scheduling ?? sp.allow_scheduler,
    min_interval_seconds: sp.min_interval_seconds ?? 0,
  };
}

/** Mantém sessão, perfil (user_profiles), tenant e plano do usuário logado. */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId, email) => {
    const { data: p } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(p);

    // Fonte principal: tenants.plano -> subscription_plans. Legado: user_profiles.plan_id -> plans
    const tenantQuery = supabase.from('tenants').select('*');
    const byLink = p?.tenant_id ? tenantQuery.eq('id', p.tenant_id) : tenantQuery.eq('email', email ?? '');
    let { data: t } = await byLink.maybeSingle();
    if (!t) ({ data: t } = await supabase.from('tenants').select('*').limit(1).maybeSingle());
    setTenant(t ?? null);

    let resolved = null;
    if (t?.plano) {
      const { data: sp } = await supabase.from('subscription_plans').select('*').eq('id', t.plano).maybeSingle();
      if (sp) resolved = normalizePlan(sp, t);
    }
    if (!resolved && p?.plan_id) {
      const { data: pl } = await supabase.from('plans').select('*').eq('id', p.plan_id).maybeSingle();
      resolved = pl;
    }
    setPlan(resolved);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id, data.session.user.email);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      if (s) loadProfile(s.user.id, s.user.email);
      else { setProfile(null); setTenant(null); setPlan(null); }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    tenant,
    plan,
    isMaster: !!tenant?.is_master,
    loading,
    refreshProfile: () => session && loadProfile(session.user.id, session.user.email),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
