import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const TABS = [
  { key: 'sms_queue', label: 'Fila Atual', order: 'id' },
  { key: 'sms_sent', label: 'Enviados', order: 'sent_at' },
  { key: 'sms_failed', label: 'Falhas', order: 'failed_at' },
];

export default function QueueManager() {
  const [tab, setTab] = useState(TABS[0]);
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});

  const load = useCallback(async () => {
    const { data } = await supabase.from(tab.key).select('*')
      .order(tab.order, { ascending: false }).limit(200);
    setRows(data ?? []);
    const entries = await Promise.all(TABS.map(async (t) => {
      const { count } = await supabase.from(t.key).select('*', { count: 'exact', head: true });
      return [t.key, count ?? 0];
    }));
    setCounts(Object.fromEntries(entries));
  }, [tab]);

  // Realtime nas 3 tabelas + polling de segurança caso o Realtime não esteja habilitado
  useEffect(() => {
    load();
    const channel = supabase.channel('queue-watch');
    TABS.forEach((t) => channel.on('postgres_changes', { event: '*', schema: 'public', table: t.key }, load));
    channel.subscribe();
    const timer = setInterval(load, 10000);
    return () => { clearInterval(timer); supabase.removeChannel(channel); };
  }, [load]);

  const dateOf = (r) => r.sent_at || r.failed_at;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Fila / Histórico</h1>

      <div className="flex gap-2 border-b border-white/5">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${
              tab.key === t.key ? 'border-accent text-accent' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {t.label} <span className="ml-1 text-xs opacity-70">({counts[t.key] ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-400 border-b border-white/5">
            <tr>
              <th className="p-3">Telefone</th><th className="p-3">Mensagem</th><th className="p-3">SIM</th>
              <th className="p-3">Status</th>
              {tab.key !== 'sms_queue' && <th className="p-3">Data</th>}
              {tab.key === 'sms_failed' && <th className="p-3">Erro</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-white/5 last:border-0">
                <td className="p-3 font-mono">{r.phone}</td>
                <td className="p-3 max-w-xs truncate" title={r.message}>{r.message}</td>
                <td className="p-3">{r.sim_slot}</td>
                <td className="p-3">
                  <span className={`badge ${
                    tab.key === 'sms_sent' ? 'bg-success/15 text-success'
                    : tab.key === 'sms_failed' ? 'bg-danger/15 text-danger'
                    : 'bg-accent/15 text-accent'}`}>{r.status}</span>
                </td>
                {tab.key !== 'sms_queue' && <td className="p-3 whitespace-nowrap">{dateOf(r) ? new Date(dateOf(r)).toLocaleString('pt-BR') : '—'}</td>}
                {tab.key === 'sms_failed' && <td className="p-3 text-danger">{r.error_message}</td>}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Sem registros.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
