import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

/** Plano efetivo: limites do tenant têm prioridade sobre os do catálogo; nomes legados mantidos para o restante do app. */
function normalizePlan(sp, tenant) {
  const maxDevices = tenant?.max_devices ?? sp.max_devices ?? 1;
  const maxSimSlots = tenant?.max_sim_slots ?? sp.max_sim_slots ?? ((tenant?.plano ?? sp.id) === 'FREE' ? 1 : 2);
  return {
    ...sp,
    max_devices: maxDevices,
    max_sim_slots: maxSimSlots,
    max_webhooks: maxDevices,
    max_sms_monthly: tenant?.max_monthly_sms ?? sp.max_monthly_sms ?? sp.max_sms_monthly,
    max_contacts: tenant?.max_contacts ?? sp.max_contacts,
    allow_scheduler: tenant?.allow_scheduling ?? sp.allow_scheduling ?? sp.allow_scheduler,
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
    let t = null;
    if (p?.tenant_id) {
      const { data } = await supabase.from('tenants').select('*').eq('id', p.tenant_id).maybeSingle();
      t = data;
    }
    if (!t && email) {
      const { data } = await supabase.from('tenants').select('*').eq('email', email).maybeSingle();
      t = data;
    }
    setTenant(t ?? null);

    let resolved = null;
    const planKey = t?.plano || (!p?.plan_id ? 'FREE' : null);
    if (planKey) {
      const { data: sp } = await supabase.from('subscription_plans').select('*').eq('id', planKey).maybeSingle();
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
