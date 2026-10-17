import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  ShieldCheck, Users, CreditCard, Search, RefreshCw, Ban, CheckCircle2, Trash2, Save, AlertTriangle, Smartphone, MessageSquare, Webhook,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';

const num = (n) => Number(n ?? 0).toLocaleString('pt-BR');
const brl = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PLAN_OPTIONS = ['FREE', 'STARTER', 'PRO', 'PLUS'];
const PLAN_LABELS = { FREE: 'Gratuito (FREE)', STARTER: 'Starter', PRO: 'Profissional (PRO)', PLUS: 'Empresarial (PLUS)' };

export default function AdminManager() {
  const { isMaster, loading: authLoading } = useAuth();
  const [tab, setTab] = useState('users'); // 'users' | 'plans'
  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    const [rpcRes, plansRes] = await Promise.all([
      supabase.rpc('admin_list_tenants'),
      supabase.from('subscription_plans').select('*').order('price_brl', { ascending: true }),
    ]);

    if (rpcRes.error) {
      setNotice({
        ok: false,
        text: `Erro ao carregar clientes: ${rpcRes.error.message}. Certifique-se de ter executado a migration 20261017_enforce_plan_slot_and_webhook_limits.sql no Supabase.`,
      });
    } else {
      setTenants(Array.isArray(rpcRes.data) ? rpcRes.data : []);
    }

    if (plansRes.data) {
      setPlans(plansRes.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isMaster) loadAll();
  }, [isMaster, loadAll]);

  const handlePlanChange = async (t, newPlan) => {
    setBusyId(t.tenant_id);
    setNotice(null);
    const { error } = await supabase.rpc('admin_update_tenant', {
      p_tenant_id: t.tenant_id,
      p_plano: newPlan,
      p_status: t.status,
    });
    setBusyId(null);
    if (error) {
      setNotice({ ok: false, text: `Erro ao alterar plano: ${error.message}` });
    } else {
      setNotice({ ok: true, text: `Plano de ${t.email} atualizado para ${newPlan}.` });
      loadAll();
    }
  };

  const handleToggleBlock = async (t) => {
    if (t.is_master) return;
    const nextStatus = t.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
    const actionLabel = nextStatus === 'BLOCKED' ? 'bloquear' : 'desbloquear';
    if (!window.confirm(`Deseja realmente ${actionLabel} o usuário ${t.email}?`)) return;

    setBusyId(t.tenant_id);
    setNotice(null);
    const { error } = await supabase.rpc('admin_update_tenant', {
      p_tenant_id: t.tenant_id,
      p_plano: t.plano,
      p_status: nextStatus,
    });
    setBusyId(null);
    if (error) {
      setNotice({ ok: false, text: `Erro ao ${actionLabel}: ${error.message}` });
    } else {
      setNotice({
        ok: true,
        text: nextStatus === 'BLOCKED'
          ? `Usuário ${t.email} bloqueado (envios e tokens de API pausados).`
          : `Usuário ${t.email} desbloqueado com sucesso.`,
      });
      loadAll();
    }
  };

  const handleDeleteTenant = async (t) => {
    if (t.is_master) return;
    if (!window.confirm(`ATENÇÃO: Deseja excluir permanentemente o usuário ${t.email} e todos os seus aparelhos, contatos e histórico? Esta ação não pode ser desfeita.`)) return;

    setBusyId(t.tenant_id);
    setNotice(null);
    const { error } = await supabase.rpc('admin_delete_tenant', {
      p_tenant_id: t.tenant_id,
    });
    setBusyId(null);
    if (error) {
      setNotice({ ok: false, text: `Erro ao excluir usuário: ${error.message}` });
    } else {
      setNotice({ ok: true, text: `Usuário ${t.email} excluído permanentemente.` });
      loadAll();
    }
  };

  const handlePlanFieldChange = (planId, field, value) => {
    setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, [field]: value } : p)));
  };

  const handleSavePlan = async (p) => {
    setBusyId(p.id);
    setNotice(null);
    const { error } = await supabase.rpc('admin_update_plan', {
      p_id: p.id,
      p_name: p.name,
      p_price_brl: Number(p.price_brl ?? 0),
      p_max_devices: Number(p.max_devices ?? 1),
      p_max_sim_slots: Number(p.max_sim_slots ?? 1),
      p_max_monthly_sms: Number(p.max_monthly_sms ?? 300),
      p_max_contacts: Number(p.max_contacts ?? 100),
      p_allow_scheduling: Boolean(p.allow_scheduling),
      p_stripe_price_id: p.stripe_price_id || null,
    });
    setBusyId(null);
    if (error) {
      setNotice({ ok: false, text: `Erro ao salvar plano ${p.id}: ${error.message}` });
    } else {
      setNotice({ ok: true, text: `Plano ${p.name} (${p.id}) atualizado e sincronizado com todos os clientes!` });
      loadAll();
    }
  };

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants.filter((t) => {
      if (planFilter !== 'ALL' && (t.plano || 'FREE').toUpperCase() !== planFilter) return false;
      if (statusFilter === 'BLOCKED' && t.status !== 'BLOCKED') return false;
      if (statusFilter === 'ACTIVE' && t.status === 'BLOCKED') return false;
      if (statusFilter === 'PAST_DUE' && t.subscription_status !== 'PAST_DUE') return false;
      if (!q) return true;
      return `${t.nome || ''} ${t.email || ''} ${t.plano || ''}`.toLowerCase().includes(q);
    });
  }, [tenants, search, planFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = tenants.length;
    const paid = tenants.filter((t) => !t.is_master && (t.plano || 'FREE').toUpperCase() !== 'FREE').length;
    const blockedOrPastDue = tenants.filter((t) => t.status === 'BLOCKED' || t.subscription_status === 'PAST_DUE').length;
    const totalSmsMonth = tenants.reduce((acc, t) => acc + Number(t.sms_used_month ?? 0), 0);
    return { total, paid, blockedOrPastDue, totalSmsMonth };
  }, [tenants]);

  if (authLoading) return <p className="text-slate-400">Carregando...</p>;
  if (!isMaster) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">Administração · Clientes & Planos</h1>
            <span className="badge bg-yellow-400/15 text-yellow-400">
              <ShieldCheck size={12} /> Admin Master
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Controle os planos de cada cliente, acompanhe o status de pagamento mensal (Stripe), bloqueie ou exclua contas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('users')}
            className={tab === 'users' ? 'btn-primary' : 'btn-ghost'}
          >
            <Users size={16} /> Clientes ({tenants.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('plans')}
            className={tab === 'plans' ? 'btn-primary' : 'btn-ghost'}
          >
            <CreditCard size={16} /> Configurar Planos
          </button>
          <button type="button" onClick={loadAll} className="btn-ghost" title="Atualizar lista">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {notice && (
        <div className={`card flex items-center gap-2 text-sm ${notice.ok ? 'border-success/30 text-success' : 'border-danger/40 text-danger'}`}>
          {notice.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Resumo rápido */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card space-y-1">
          <div className="text-xs text-slate-400">Total de Contas</div>
          <div className="text-2xl font-bold text-white">{num(stats.total)}</div>
        </div>
        <div className="card space-y-1">
          <div className="text-xs text-slate-400">Clientes em Planos Pagos</div>
          <div className="text-2xl font-bold text-accent">{num(stats.paid)}</div>
        </div>
        <div className="card space-y-1">
          <div className="text-xs text-slate-400">Bloqueados / Pagamento Pendente</div>
          <div className="text-2xl font-bold text-yellow-400">{num(stats.blockedOrPastDue)}</div>
        </div>
        <div className="card space-y-1">
          <div className="text-xs text-slate-400">SMS Disparados no Mês (Geral)</div>
          <div className="text-2xl font-bold text-success">{num(stats.totalSmsMonth)}</div>
        </div>
      </div>

      {tab === 'users' && (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                className="input pl-9"
                placeholder="Buscar por nome ou e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select className="input w-auto" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              <option value="ALL">Todos os planos</option>
              {PLAN_OPTIONS.map((p) => (
                <option key={p} value={p}>{PLAN_LABELS[p] ?? p}</option>
              ))}
            </select>

            <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">Todos os status</option>
              <option value="ACTIVE">Contas Ativas</option>
              <option value="BLOCKED">Contas Bloqueadas</option>
              <option value="PAST_DUE">Pagamento Atrasado (Stripe)</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-slate-400">
                  <th className="py-3 px-3">Cliente</th>
                  <th className="py-3 px-3">Plano</th>
                  <th className="py-3 px-3">Uso no Mês / Limites</th>
                  <th className="py-3 px-3">Assinatura & Status</th>
                  <th className="py-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTenants.map((t) => {
                  const isBlocked = t.status === 'BLOCKED';
                  const isPastDue = t.subscription_status === 'PAST_DUE';
                  const isBusy = busyId === t.tenant_id;

                  return (
                    <tr key={t.tenant_id} className={`hover:bg-white/[0.02] ${isBlocked ? 'opacity-60' : ''}`}>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2 font-medium text-white">
                          <span>{t.nome || 'Sem nome'}</span>
                          {t.is_master && (
                            <span className="badge bg-yellow-400/15 text-yellow-400 text-[10px]">
                              <ShieldCheck size={11} /> Master
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">{t.email}</div>
                        <div className="text-[11px] text-slate-500">
                          Desde {t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : '—'}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        {t.is_master ? (
                          <span className="badge bg-yellow-400/15 text-yellow-400">Ilimitado (Master)</span>
                        ) : (
                          <select
                            className="input py-1.5 px-2.5 text-xs font-semibold w-40"
                            value={(t.plano || 'FREE').toUpperCase()}
                            disabled={isBusy}
                            onChange={(e) => handlePlanChange(t, e.target.value)}
                          >
                            {PLAN_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{PLAN_LABELS[opt] ?? opt}</option>
                            ))}
                          </select>
                        )}
                      </td>

                      <td className="py-3 px-3 text-xs text-slate-300 space-y-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span title="SMS enviados/enfileirados no mês">
                            <MessageSquare size={12} className="inline mr-1 text-accent" />
                            <strong>{num(t.sms_used_month)}</strong> / {t.is_master ? '∞' : num(t.max_monthly_sms)} SMS
                          </span>
                          <span title="Aparelhos conectados">
                            <Smartphone size={12} className="inline mr-1 text-accent" />
                            <strong>{num(t.devices_used)}</strong> / {t.is_master ? '∞' : num(t.max_devices)} apar. ({t.is_master ? 2 : t.max_sim_slots} chip{t.max_sim_slots === 1 && !t.is_master ? '' : 's'})
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap text-slate-400">
                          <span>
                            <Users size={12} className="inline mr-1" />
                            {num(t.contacts_used)} / {t.is_master ? '∞' : num(t.max_contacts)} contatos
                          </span>
                          <span>
                            <Webhook size={12} className="inline mr-1" />
                            {num(t.webhooks_used)} / {t.is_master ? '∞' : num(t.max_devices)} webhook(s)
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          {isBlocked ? (
                            <span className="badge bg-danger/15 text-danger">Conta Bloqueada</span>
                          ) : (
                            <span className="badge bg-success/15 text-success">Conta Ativa</span>
                          )}

                          {isPastDue && (
                            <span className="badge bg-yellow-400/15 text-yellow-400 text-[10px]" title="O pagamento mensal falhou no Stripe e a conta voltou para o plano FREE automaticamente">
                              Pagto. Pendente (Rebaixado p/ FREE)
                            </span>
                          )}
                          {t.subscription_status === 'CANCELED' && (
                            <span className="badge bg-white/10 text-slate-400 text-[10px]">
                              Assinatura Cancelada
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right">
                        {!t.is_master && (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleToggleBlock(t)}
                              className={`btn-ghost px-2.5 py-1.5 text-xs ${isBlocked ? 'text-success hover:bg-success/10' : 'text-yellow-400 hover:bg-yellow-400/10'}`}
                              title={isBlocked ? 'Desbloquear usuário' : 'Bloquear usuário (pausa envios e API)'}
                            >
                              {isBlocked ? <CheckCircle2 size={14} /> : <Ban size={14} />}
                              {isBlocked ? 'Desbloquear' : 'Bloquear'}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDeleteTenant(t)}
                              className="btn-ghost px-2.5 py-1.5 text-xs text-danger hover:bg-danger/10"
                              title="Excluir usuário e todos os seus dados"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!loading && !filteredTenants.length && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Nenhum usuário encontrado para o filtro selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'plans' && (
        <section className="space-y-4">
          <div className="card border-accent/30 bg-accent/5 text-xs text-slate-300 leading-relaxed">
            <strong className="text-white">Como funciona a atualização de planos e cobrança automática:</strong>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>
                Ao alterar qualquer limite abaixo e clicar em <strong>Salvar Plano</strong>, todos os clientes que já estão naquele plano recebem os novos limites automaticamente.
              </li>
              <li>
                <strong>Cobrança Mensal Automática (Stripe):</strong> Você <strong>não precisa conferir pagamentos manualmente</strong>. Quando o cliente assina, o Stripe libera o plano sozinho. Se no mês seguinte o cartão recusar ou não cair o pagamento (<code>invoice.payment_failed</code> / <code>past_due</code>), o nosso webhook volta o cliente automaticamente para o plano <strong>FREE</strong> e exibe o aviso <em>"Pagto. Pendente"</em> na tabela de clientes.
              </li>
            </ul>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {plans.map((p) => (
              <div key={p.id} className="card space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div>
                    <span className="badge bg-accent/15 text-accent font-mono">{p.id}</span>
                    <span className="ml-2 font-semibold text-white">{p.name}</span>
                  </div>
                  <div className="text-sm font-bold text-white">{brl(p.price_brl)}/mês</div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="label">Nome de exibição</label>
                    <input
                      className="input"
                      value={p.name ?? ''}
                      onChange={(e) => handlePlanFieldChange(p.id, 'name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Preço Mensal (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={p.price_brl ?? 0}
                      onChange={(e) => handlePlanFieldChange(p.id, 'price_brl', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Máx. Aparelhos (= Webhooks)</label>
                    <input
                      type="number"
                      min={1}
                      className="input"
                      value={p.max_devices ?? 1}
                      onChange={(e) => handlePlanFieldChange(p.id, 'max_devices', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Chips por Aparelho (1 ou 2)</label>
                    <select
                      className="input"
                      value={Number(p.max_sim_slots ?? 1)}
                      onChange={(e) => handlePlanFieldChange(p.id, 'max_sim_slots', Number(e.target.value))}
                    >
                      <option value={1}>1 Chip (Apenas SIM 1)</option>
                      <option value={2}>2 Chips (Dual-SIM com rotação)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Disparos por Mês (SMS)</label>
                    <input
                      type="number"
                      min={1}
                      className="input"
                      value={p.max_monthly_sms ?? 300}
                      onChange={(e) => handlePlanFieldChange(p.id, 'max_monthly_sms', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Máx. Contatos na Agenda</label>
                    <input
                      type="number"
                      min={1}
                      className="input"
                      value={p.max_contacts ?? 100}
                      onChange={(e) => handlePlanFieldChange(p.id, 'max_contacts', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Stripe Price ID (para cobrança automática)</label>
                    <input
                      className="input font-mono text-xs"
                      placeholder="price_1P..."
                      value={p.stripe_price_id ?? ''}
                      onChange={(e) => handlePlanFieldChange(p.id, 'stripe_price_id', e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-accent"
                      checked={Boolean(p.allow_scheduling)}
                      onChange={(e) => handlePlanFieldChange(p.id, 'allow_scheduling', e.target.checked)}
                    />
                    Permitir agendamento de campanhas
                  </label>

                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => handleSavePlan(p)}
                    className="btn-primary py-1.5 px-3 text-xs"
                  >
                    <Save size={14} /> {busyId === p.id ? 'Salvando...' : 'Salvar Plano'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

