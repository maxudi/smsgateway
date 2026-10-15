import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { X, Smartphone, MessageSquare, Users, Info, Mail, UserCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';

const num = (n) => Number(n ?? 0).toLocaleString('pt-BR');

// Valores assumidos quando o tenant não é encontrado
const TENANT_FALLBACK = { plano: 'FREE', max_devices: 1, max_monthly_sms: 300, max_contacts: 100 };

function UsageCard({ icon: Icon, label, used, max, unlimited }) {
  const pct = !unlimited && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const bar = pct >= 90 ? 'bg-danger' : pct >= 70 ? 'bg-yellow-400' : 'bg-success';
  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2 text-sm text-slate-400"><Icon size={16} className="text-accent" />{label}</div>
      <div className="text-2xl font-bold text-white">
        {num(used)} <span className="text-base font-normal text-slate-400">/ {unlimited ? 'Ilimitados' : max ? num(max) : '∞'}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-bg">
        <div className={`h-full ${bar} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Profile() {
  const { profile, tenant: ctxTenant, isMaster, refreshProfile } = useAuth();
  const tenant = ctxTenant ?? TENANT_FALLBACK;
  const [searchParams, setSearchParams] = useSearchParams();
  const [authUser, setAuthUser] = useState(null);
  const [usage, setUsage] = useState({ devices: 0, contacts: 0, sms: 0 });
  const [payNotice, setPayNotice] = useState(null); // { ok, text }
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);

  // Retorno do Stripe: mostra o aviso, limpa o parâmetro e recarrega os limites (o webhook pode demorar alguns segundos)
  useEffect(() => {
    const result = searchParams.get('pagamento');
    if (!result) return undefined;
    if (result === 'sucesso') {
      setPayNotice({ ok: true, text: 'Pagamento reconhecido! Seus novos limites foram liberados com sucesso.' });
    } else if (result === 'cancelado') {
      setPayNotice({ ok: false, text: 'Pagamento cancelado. Nenhuma cobrança foi feita.' });
    }
    setSearchParams({}, { replace: true });
    if (result !== 'sucesso') return undefined;
    refreshProfile?.();
    const t = setTimeout(() => { refreshProfile?.(); setReloadKey((k) => k + 1); }, 4000);
    return () => clearTimeout(t);
  }, [searchParams, setSearchParams, refreshProfile]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setAuthUser(user);
      const [devices, contacts, rpc] = await Promise.all([
        supabase.from('devices').select('id', { count: 'exact', head: true }),
        supabase.from('contacts').select('id', { count: 'exact', head: true }),
        supabase.rpc('get_dashboard_analytics'),
      ]);
      setUsage({
        devices: devices.count ?? 0,
        contacts: contacts.count ?? 0,
        sms: rpc.data?.current_month?.sent ?? 0,
      });
      setLoading(false);
    })();
  }, [reloadKey]);

  if (loading) return <p className="text-slate-400">Carregando...</p>;

  const memberSince = authUser?.created_at ? new Date(authUser.created_at).toLocaleDateString('pt-BR') : '—';

  return (
    <div className="space-y-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-white">Perfil / Planos</h1>
      {payNotice && (
        <div className={`card flex items-center gap-2 text-sm ${payNotice.ok ? 'border-success/30 text-success' : 'text-yellow-400'}`}>
          {payNotice.ok ? <CheckCircle2 size={16} /> : <Info size={16} />}{payNotice.text}
          <button type="button" className="ml-auto text-slate-400 hover:text-white" onClick={() => setPayNotice(null)}><X size={14} /></button>
        </div>
      )}

      <section className="card flex flex-wrap items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent"><UserCircle size={32} /></div>
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold text-white">
            {profile?.name || authUser?.user_metadata?.name || 'Usuário'}
            {isMaster && <span className="badge bg-yellow-400/15 text-yellow-400"><ShieldCheck size={12} /> Admin Master</span>}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400"><Mail size={14} />{authUser?.email}</div>
          <div className="text-xs text-slate-500">
            Cliente desde {memberSince}{tenant?.name ? ` · ${tenant.name}` : ''}{!isMaster && tenant?.plano ? ` · Plano ${tenant.plano}` : ''}
          </div>
        </div>
        {!isMaster && <Link to="/planos" className="btn-primary ml-auto">Ver planos</Link>}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Uso atual</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <UsageCard icon={Smartphone} label="Aparelhos" used={usage.devices} max={tenant.max_devices} unlimited={isMaster} />
          <UsageCard icon={MessageSquare} label="SMS no mês" used={usage.sms} max={tenant.max_monthly_sms} unlimited={isMaster} />
          <UsageCard icon={Users} label="Contatos" used={usage.contacts} max={tenant.max_contacts} unlimited={isMaster} />
        </div>
      </section>

      {isMaster && (
        <section className="card flex items-start gap-4 border-yellow-400/40 bg-yellow-400/5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-yellow-400/15 text-yellow-400">
            <ShieldCheck size={26} />
          </div>
          <div className="space-y-2">
            <span className="badge bg-yellow-400/15 text-yellow-400"><ShieldCheck size={12} /> Admin Master</span>
            <h2 className="text-lg font-semibold text-white">Acesso Total - Admin Master</h2>
            <p className="text-sm text-slate-300">
              Esta conta possui privilégios de superadministrador com recursos, envios, contatos e dispositivos sem restrições de cota ou faturamento.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
