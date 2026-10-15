import { useCallback, useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const PAGE = 100;

const ITEM_STYLE = {
  DELIVERED: { label: 'Entregue', cls: 'bg-success/15 text-success' },
  SENT: { label: 'Enviado', cls: 'bg-success/15 text-success' },
  PENDING: { label: 'Pendente', cls: 'bg-accent/15 text-accent' },
  SCHEDULED: { label: 'Agendado', cls: 'bg-accent/15 text-accent' },
  PAUSED: { label: 'Pausado', cls: 'bg-yellow-400/15 text-yellow-400' },
  FAILED: { label: 'Falhou', cls: 'bg-danger/15 text-danger' },
  OPTED_OUT: { label: 'Opt-out', cls: 'bg-orange-400/15 text-orange-400' },
  CANCELLED: { label: 'Cancelado', cls: 'bg-white/10 text-slate-300' },
  DRAFT: { label: 'Rascunho', cls: 'bg-white/10 text-slate-300' },
};

const FILTERS = [
  { key: 'all', label: 'Todos', statuses: null },
  { key: 'sent', label: 'Entregues', statuses: ['SENT', 'DELIVERED'] },
  { key: 'pending', label: 'Pendentes', statuses: ['WAITING', 'PENDING', 'SCHEDULED', 'PAUSED', 'DRAFT'] },
  { key: 'failed', label: 'Falhas', statuses: ['FAILED'] },
  { key: 'optout', label: 'Opt-out', statuses: ['OPTED_OUT'] },
];

// Status válidos por tabela; evita filtrar por valor inexistente
const SCHEDULE_STATUSES = ['WAITING', 'PAUSED', 'DRAFT', 'CANCELLED'];
const QUEUE_STATUSES = ['PENDING', 'SCHEDULED', 'PAUSED', 'DRAFT', 'SENT', 'DELIVERED', 'FAILED', 'OPTED_OUT', 'CANCELLED'];
const fmtDate = (d) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Rótulo e cor por origem: agendado (sms_schedule), em trânsito (sms_queue) ou enviado (sms_sent). */
function describe(r) {
  if (r.source === 'schedule' && r.status === 'WAITING') {
    return { label: `Agendado para ${fmtDate(r.at)}`, cls: 'bg-accent/15 text-accent' };
  }
  if (r.source === 'queue' && ['PENDING', 'SCHEDULED'].includes(r.status)) {
    return { label: 'Na fila de envio', cls: 'bg-yellow-400/15 text-yellow-400' };
  }
  if (r.source === 'sent' && !ITEM_STYLE[r.status]) return { label: 'Enviado', cls: 'bg-success/15 text-success' };
  return ITEM_STYLE[r.status] ?? { label: r.status, cls: 'bg-white/10 text-slate-300' };
}

/** Gaveta lateral com cada número da campanha e o status individual do envio. */
export default function RecipientsDrawer({ campaign, deviceName, onClose, refreshKey }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const statuses = FILTERS.find((f) => f.key === filter).statuses;
    const pick = (known) => (statuses ? statuses.filter((s) => known.includes(s)) : known);
    const wantSent = !statuses || statuses.some((s) => ['SENT', 'DELIVERED'].includes(s));

    const fetchSource = async (table, cols, orderCol, known) => {
      const st = known && pick(known);
      if (known && !st.length) return { data: [], count: 0 };
      let q = supabase.from(table).select(cols, { count: 'exact' }).eq('campaign_id', campaign.id);
      if (st) q = q.in('status', st);
      const { data, count } = await q.order(orderCol, { ascending: true }).range(0, limit - 1);
      return { data: data ?? [], count: count ?? 0 };
    };

    const [sch, que, snt] = await Promise.all([
      fetchSource('sms_schedule', 'id, phone, status, sim_slot, target_device_id, scheduled_for', 'scheduled_for', SCHEDULE_STATUSES),
      // Itens já enviados vivem em sms_sent; na fila só entram os demais
      fetchSource('sms_queue', 'id, phone, status, sim_slot, target_device_id, scheduled_for', 'scheduled_for',
        QUEUE_STATUSES.filter((s) => !['SENT', 'DELIVERED'].includes(s))),
      wantSent ? fetchSource('sms_sent', '*', 'id', null) : { data: [], count: 0 },
    ]);

    const merged = [
      ...sch.data.map((r) => ({ ...r, source: 'schedule', key: `s${r.id}`, at: r.scheduled_for })),
      ...que.data.map((r) => ({ ...r, source: 'queue', key: `q${r.id}`, at: r.scheduled_for })),
      ...snt.data.map((r) => ({
        ...r, source: 'sent', key: `e${r.id}`, status: r.status ?? 'SENT', at: r.sent_at ?? r.created_at ?? null,
      })),
    ].sort((a, b) => new Date(a.at ?? 0) - new Date(b.at ?? 0));

    setRows(merged.slice(0, limit));
    setTotal(sch.count + que.count + snt.count);
    setLoading(false);
  }, [campaign.id, filter, limit]);

  // refreshKey muda a cada evento de Realtime
  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <aside className="flex h-full w-full max-w-lg flex-col bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between border-b border-white/5 p-5">
          <div>
            <h3 className="font-semibold text-white">{campaign.title}</h3>
            <p className="text-xs text-slate-500">Relatório de destinatários · {total} registro(s)</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </header>

        <div className="flex flex-wrap gap-2 border-b border-white/5 p-4">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => { setFilter(f.key); setLimit(PAGE); setLoading(true); }}
              className={`badge border px-3 py-1 ${filter === f.key
                ? 'border-accent bg-accent/15 text-accent' : 'border-white/10 text-slate-400 hover:text-white'}`}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="p-5 text-sm text-slate-400"><Loader2 size={14} className="mr-2 inline animate-spin" />Carregando...</p>}
          {!loading && !rows.length && <p className="p-5 text-sm text-slate-500">Nenhum registro neste filtro.</p>}
          <ul className="divide-y divide-white/5">
            {rows.map((r) => {
              const st = describe(r);
              return (
                <li key={r.key} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <div className="font-mono text-white">{r.phone}</div>
                    <div className="text-xs text-slate-500">
                      {deviceName(r.target_device_id)}{r.sim_slot !== null && r.sim_slot !== undefined && ` · SIM ${Number(r.sim_slot) + 1}`}
                      {r.at && r.source !== 'schedule' && ` · ${new Date(r.at).toLocaleString('pt-BR')}`}
                    </div>
                  </div>
                  <span className={`badge ${st.cls}`}>{st.label}</span>
                </li>
              );
            })}
          </ul>
          {rows.length < total && (
            <div className="p-4">
              <button className="btn-ghost w-full" onClick={() => setLimit((l) => l + PAGE)}>
                Carregar mais ({rows.length} de {total})
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
