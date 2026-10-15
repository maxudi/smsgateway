import { useEffect, useMemo, useState } from 'react';
import {
  Check, X, Smartphone, Layers, MessageSquare, CalendarClock, Users, Webhook, ShieldCheck, Loader2, Sparkles, Info,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';

const brl = (value) => Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (n) => Number(n ?? 0).toLocaleString('pt-BR');

const DISPLAY_NAMES = { FREE: 'Gratuito', STARTER: 'Starter', PRO: 'Profissional', PLUS: 'Empresarial' };
const POPULAR_PLAN = 'PRO';

const NOTICE = 'O envio do SMS é realizado via aparelho e chips do usuário; a entrega final e créditos do chip são de responsabilidade da operadora de telefonia celular.';

export default function PlansPricing() {
  const { tenant, isMaster } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.from('subscription_plans').select('*').order('price_brl', { ascending: true }).then(({ data, error: err }) => {
      if (err) setError(err.message);
      setPlans(data ?? []);
      setLoading(false);
    });
  }, []);

  const currentPlan = tenant?.plano ?? 'FREE';
  const sorted = useMemo(() => plans, [plans]);

  const subscribe = async (plan) => {
    setError(null);
    if (!tenant?.id) return setError('Conta (tenant) não encontrada. Não é possível iniciar o pagamento.');
    if (!plan.stripe_price_id) return setError('Este plano ainda não está configurado para pagamento.');
    setPayingId(plan.id);
    const { data: session, error: fnErr } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        planId: plan.id,
        tenantId: tenant.id,
        successUrl: `${window.location.origin}/perfil?pagamento=sucesso`,
        cancelUrl: `${window.location.origin}/perfil?pagamento=cancelado`,
      },
    });
    if (fnErr || !session?.url) {
      setPayingId(null);
      return setError(fnErr?.message ?? 'Não foi possível criar a sessão de pagamento.');
    }
    window.location.href = session.url;
    return undefined;
  };

  const highlights = (p) => [
    { icon: Smartphone, text: `${num(p.max_devices)} aparelho${Number(p.max_devices) === 1 ? '' : 's'} conectado${Number(p.max_devices) === 1 ? '' : 's'}`, ok: true },
    { icon: Layers, text: 'Rotação multi-chip (Dual-SIM)', ok: true },
    { icon: MessageSquare, text: `${num(p.max_monthly_sms)} disparos por mês`, ok: true },
    { icon: CalendarClock, text: 'Agendamento de campanhas', ok: !!p.allow_scheduling },
    { icon: Users, text: `${num(p.max_contacts)} contatos`, ok: true },
    ...(p.allow_webhooks !== undefined ? [{ icon: Webhook, text: 'Webhooks de recebimento', ok: !!p.allow_webhooks }] : []),
  ];

  if (loading) return <p className="text-slate-400">Carregando...</p>;

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white">Escolha o plano ideal para o seu volume de SMS</h1>
        <p className="mx-auto max-w-2xl text-slate-400">
          Use os seus próprios aparelhos e chips como gateway, com rotação automática entre SIM 1 e SIM 2,
          agendamento inteligente e controle total das campanhas.
        </p>
      </div>

      {isMaster && (
        <div className="card flex items-center gap-4 border-yellow-400/40 bg-yellow-400/5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-yellow-400/15 text-yellow-400">
            <ShieldCheck size={26} />
          </div>
          <div>
            <div className="font-semibold text-white">Admin Master · acesso irrestrito</div>
            <p className="text-sm text-slate-300">
              Você possui acesso irrestrito a todos os recursos da plataforma. Não é necessário contratar nenhum plano.
            </p>
          </div>
        </div>
      )}

      {!isMaster && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-accent/30 bg-accent/5">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Seu plano atual</div>
            <div className="text-lg font-semibold text-white">
              {DISPLAY_NAMES[currentPlan] ?? sorted.find((p) => p.id === currentPlan)?.name ?? currentPlan}
            </div>
          </div>
          <div className="text-sm text-slate-400">
            {num(tenant?.max_devices)} aparelho(s) · {num(tenant?.max_monthly_sms)} SMS/mês · {num(tenant?.max_contacts)} contatos
          </div>
        </div>
      )}

      {error && <p className="text-center text-sm text-danger">{error}</p>}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {sorted.map((p) => {
          const price = Number(p.price_brl ?? 0);
          const isCurrent = p.id === currentPlan;
          const popular = p.id === POPULAR_PLAN;
          const free = price === 0;
          const paying = payingId === p.id;

          let button;
          if (isMaster) {
            button = <button className="btn-ghost mt-6 w-full" disabled>Incluso no Admin Master</button>;
          } else if (isCurrent) {
            button = <button className="btn-ghost mt-6 w-full" disabled>Plano atual</button>;
          } else if (free) {
            button = <button className="btn-ghost mt-6 w-full" disabled>Plano gratuito</button>;
          } else {
            button = (
              <button className="btn-primary mt-6 w-full" disabled={!!payingId} onClick={() => subscribe(p)}>
                {paying ? <Loader2 size={16} className="animate-spin" /> : null} Assinar Plano
              </button>
            );
          }

          return (
            <div key={p.id}
              className={`card relative flex flex-col transition duration-200 hover:-translate-y-1 hover:border-accent/40 ${
                popular ? 'ring-2 ring-accent shadow-lg shadow-accent/10' : ''}`}>
              {popular && (
                <span className="badge mb-3 w-fit bg-accent text-bg">
                  <Sparkles size={12} /> Mais popular
                </span>
              )}

              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">{DISPLAY_NAMES[p.id] ?? p.name}</h2>
                {isCurrent && !isMaster && <span className="badge bg-white/10 text-slate-300">Seu plano</span>}
              </div>
              {p.description && <p className="mt-1 text-xs text-slate-400">{p.description}</p>}

              <div className="my-5">
                <div className="text-4xl font-bold text-white">
                  {free ? 'Grátis' : brl(price)}
                  {!free && <span className="text-sm font-normal text-slate-400">/mês</span>}
                </div>
                {Number(p.price_usd) > 0 && <div className="text-xs text-slate-500">US$ {Number(p.price_usd).toFixed(2)}/mo</div>}
              </div>

              <ul className="flex-1 space-y-3 text-sm">
                {highlights(p).map(({ icon: Icon, text, ok }) => (
                  <li key={text} className={`flex items-center gap-3 ${ok ? 'text-slate-200' : 'text-slate-500'}`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${ok ? 'bg-accent/15 text-accent' : 'bg-white/5 text-slate-600'}`}>
                      <Icon size={15} />
                    </span>
                    <span className="flex-1">{text}</span>
                    {ok ? <Check size={14} className="text-success" /> : <X size={14} className="text-slate-600" />}
                  </li>
                ))}
              </ul>

              {button}
            </div>
          );
        })}
        {!sorted.length && <p className="col-span-full text-center text-slate-400">Nenhum plano disponível.</p>}
      </div>

      <p className="flex items-start justify-center gap-2 text-xs text-slate-500">
        <Info size={14} className="mt-0.5 shrink-0" />{NOTICE}
      </p>
    </div>
  );
}
