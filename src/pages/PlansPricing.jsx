import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, X, Smartphone, Layers, MessageSquare, CalendarClock, Users, Webhook, ShieldCheck, Loader2, Sparkles, Info,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';

const brl = (value) => Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (n) => Number(n ?? 0).toLocaleString('pt-BR');

const DISPLAY_NAMES = { FREE: 'Gratuito', STARTER: 'Starter', PRO: 'Profissional', PLUS: 'Empresarial' };
const POPULAR_PLAN = 'PRO';

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

  const highlights = (p) => {
    const devs = Number(p.max_devices ?? 1);
    const slots = Number(p.max_sim_slots ?? (p.id === 'FREE' ? 1 : 2));
    return [
      {
        icon: Smartphone,
        text: `${num(devs)} aparelho${devs === 1 ? '' : 's'} conectado${devs === 1 ? '' : 's'}`,
        ok: true,
      },
      {
        icon: Layers,
        text: slots === 1 ? 'Monitoramento de 1 chip (SIM 1)' : `Monitoramento de ${num(slots)} chips por aparelho`,
        ok: true,
      },
      {
        icon: Layers,
        text: 'Rotação multi-chip (Dual-SIM)',
        ok: slots > 1,
      },
      {
        icon: MessageSquare,
        text: `${num(p.max_monthly_sms)} disparos por mês *`,
        subtext: 'Cota de processamento do gateway (via seu chip)',
        ok: true,
      },
      {
        icon: Webhook,
        text: devs === 1 ? '1 Webhook + Envio via API HTTP' : `Até ${num(devs)} Webhooks + Envio via API HTTP`,
        ok: true,
      },
      {
        icon: CalendarClock,
        text: 'Agendamento de campanhas',
        ok: !!p.allow_scheduling,
      },
      {
        icon: Users,
        text: `${num(p.max_contacts)} contatos`,
        ok: true,
      },
    ];
  };

  if (loading) return <p className="text-slate-400">Carregando...</p>;

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white">Escolha o plano ideal para o seu volume de SMS</h1>
        <p className="mx-auto max-w-2xl text-slate-400">
          Use os seus próprios aparelhos e chips como gateway, com integração via API HTTP, Webhooks
          e controle total das campanhas.
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
            {num(tenant?.max_devices ?? 1)} aparelho(s) · {num(tenant?.max_sim_slots ?? (currentPlan === 'FREE' ? 1 : 2))} chip(s) por aparelho · {num(tenant?.max_devices ?? 1)} webhook(s) · API HTTP · {num(tenant?.max_monthly_sms ?? 300)} SMS/mês · {num(tenant?.max_contacts ?? 100)} contatos
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
                  {free ? 'Grátis' : `US$ ${(Number(p.price_usd) || Number((price / 5).toFixed(2))).toFixed(2)}`}
                  {!free && <span className="text-sm font-normal text-slate-400">/mês</span>}
                </div>
                <div className="mt-1 text-xs font-medium text-slate-400">
                  {free ? 'US$ 0.00 · R$ 0,00' : `${brl(price)}/mês`}
                </div>
              </div>

              <ul className="flex-1 space-y-3 text-sm">
                {highlights(p).map(({ icon: Icon, text, subtext, ok }) => (
                  <li key={text} className={`flex items-start gap-3 ${ok ? 'text-slate-200' : 'text-slate-500'}`}>
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${ok ? 'bg-accent/15 text-accent' : 'bg-white/5 text-slate-600'}`}>
                      <Icon size={15} />
                    </span>
                    <div className="flex-1 leading-snug">
                      <div>
                        {subtext ? (
                          <a href="#nota-disparos" className="hover:text-accent transition-colors" title="Ver observação importante abaixo">
                            {text.replace(' *', '')}{' '}
                            <span className="inline-flex items-center rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                              * ver nota
                            </span>
                          </a>
                        ) : (
                          text
                        )}
                      </div>
                      {subtext && <div className="text-[11px] text-slate-400 mt-0.5">{subtext}</div>}
                    </div>
                    {ok ? <Check size={14} className="mt-1 shrink-0 text-success" /> : <X size={14} className="mt-1 shrink-0 text-slate-600" />}
                  </li>
                ))}
              </ul>

              {button}
            </div>
          );
        })}
        {!sorted.length && <p className="col-span-full text-center text-slate-400">Nenhum plano disponível.</p>}
      </div>

      <div id="nota-disparos" className="card border-slate-800 bg-surface/60 space-y-2.5 text-xs text-slate-400 leading-relaxed">
        <div className="flex items-center gap-2 font-semibold text-slate-200 text-sm">
          <Info size={16} className="text-accent shrink-0" />
          <span>* Como funcionam os disparos mensais e o uso do seu chip</span>
        </div>
        <p>
          <strong className="text-slate-300">1. Sobre a franquia de disparos:</strong> A nossa plataforma atua como um <strong className="text-slate-300">gateway de automação</strong> e <strong className="text-slate-300">não comercializa pacotes de SMS</strong>. O limite mensal de cada plano refere-se à capacidade de gerenciamento e processamento de fila na plataforma. Como os envios são realizados diretamente através dos seus próprios aparelhos e chips conectados, a entrega efetiva das mensagens depende de um plano ou saldo válido junto à sua operadora de telefonia móvel.
        </p>
        <p>
          <strong className="text-slate-300">2. Boas práticas e políticas das operadoras:</strong> O conteúdo das mensagens, a autorização de recebimento dos contatos (opt-in) e a frequência de disparos são definidos exclusivamente pelo usuário. Recomendamos o uso consciente da ferramenta (evitando práticas de spam), pois as operadoras monitoram o tráfego da rede e podem aplicar bloqueios ou restrições ao chip sem ingerência ou responsabilidade da plataforma, conforme detalhado em nossos{' '}
          <Link to="/termos-de-uso" className="text-accent hover:underline">Termos de Uso</Link>.
        </p>
      </div>
    </div>
  );
}
