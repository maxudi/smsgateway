import { useCallback, useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function QueueManager() {
  const { t, lang } = useLanguage();

  const tabs = useMemo(() => [
    { key: 'sms_queue', label: t('queue.tabCurrentQueue'), order: 'id' },
    { key: 'sms_sent', label: t('queue.tabSent'), order: 'sent_at' },
    { key: 'sms_failed', label: t('queue.tabFailed'), order: 'failed_at' },
  ], [t]);

  const [activeTabKey, setActiveTabKey] = useState('sms_queue');
  const activeTab = tabs.find((x) => x.key === activeTabKey) || tabs[0];

  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});

  const load = useCallback(async () => {
    const current = tabs.find((x) => x.key === activeTabKey) || tabs[0];
    const { data } = await supabase.from(current.key).select('*')
      .order(current.order, { ascending: false }).limit(200);
    setRows(data ?? []);
    const entries = await Promise.all(tabs.map(async (item) => {
      const { count } = await supabase.from(item.key).select('*', { count: 'exact', head: true });
      return [item.key, count ?? 0];
    }));
    setCounts(Object.fromEntries(entries));
  }, [activeTabKey, tabs]);

  // Realtime nas 3 tabelas + polling de segurança caso o Realtime não esteja habilitado
  useEffect(() => {
    load();
    const channel = supabase.channel('queue-watch');
    tabs.forEach((item) => channel.on('postgres_changes', { event: '*', schema: 'public', table: item.key }, load));
    channel.subscribe();
    const timer = setInterval(load, 10000);
    return () => { clearInterval(timer); supabase.removeChannel(channel); };
  }, [load, tabs]);

  const dateOf = (r) => r.sent_at || r.failed_at;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t('queue.title')}</h1>

      <div className="flex gap-2 border-b border-white/5">
        {tabs.map((item) => (
          <button key={item.key} onClick={() => setActiveTabKey(item.key)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition ${
              activeTabKey === item.key ? 'border-accent text-accent' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {item.label} <span className="ml-1 text-xs opacity-70">({counts[item.key] ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-400 border-b border-white/5">
            <tr>
              <th className="p-3">{t('queue.thPhone')}</th>
              <th className="p-3">{t('queue.thMessage')}</th>
              <th className="p-3">{t('queue.thSim')}</th>
              <th className="p-3">{t('queue.thStatus')}</th>
              {activeTabKey !== 'sms_queue' && <th className="p-3">{t('queue.thDate')}</th>}
              {activeTabKey === 'sms_failed' && <th className="p-3">{t('queue.thError')}</th>}
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
                    activeTabKey === 'sms_sent' ? 'bg-success/15 text-success'
                    : activeTabKey === 'sms_failed' ? 'bg-danger/15 text-danger'
                    : 'bg-accent/15 text-accent'}`}>{r.status}</span>
                </td>
                {activeTabKey !== 'sms_queue' && (
                  <td className="p-3 whitespace-nowrap">
                    {dateOf(r) ? new Date(dateOf(r)).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US') : '—'}
                  </td>
                )}
                {activeTabKey === 'sms_failed' && <td className="p-3 text-danger">{r.error_message}</td>}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">{t('queue.noRecords')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
