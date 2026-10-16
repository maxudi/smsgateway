import { useEffect, useMemo, useState } from 'react';
import { Smartphone, Users, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext.jsx';

const count = async (table, filter) => {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count: c } = await q;
  return c ?? 0;
};

const DEFAULT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Normaliza monthly_evolution para 12 posições (jan a dez), aceitando mês numérico ou "AAAA-MM". */
function normalizeMonthly(list, monthLabels = DEFAULT_MONTHS) {
  const out = monthLabels.map((label) => ({ label, sent: 0, received: 0, failed: 0 }));
  (list ?? []).forEach((item, i) => {
    const raw = item.month ?? item.mes ?? i + 1;
    let n = typeof raw === 'string' && raw.includes('-') ? Number(raw.split('-')[1]) : Number(raw);
    if (!(n >= 1 && n <= 12)) n = i + 1;
    if (out[n - 1]) {
      out[n - 1].sent += Number(item.sent ?? 0);
      out[n - 1].received += Number(item.received ?? 0);
      out[n - 1].failed += Number(item.failed ?? 0);
    }
  });
  return out;
}

/** Normaliza by_chip (array ou objeto) para [{ slot, total }] dos slots 0 e 1. */
function normalizeChips(by) {
  const rows = Array.isArray(by)
    ? by.map((x) => ({ slot: Number(x.sim_slot ?? x.slot), total: Number(x.total ?? x.count ?? x.sent ?? 0) }))
    : Object.entries(by ?? {}).map(([slot, total]) => ({ slot: Number(slot), total: Number(total?.total ?? total ?? 0) }));
  return [0, 1].map((slot) => ({ slot, total: rows.filter((r) => r.slot === slot).reduce((a, r) => a + r.total, 0) }));
}

function MonthlyChart({ data, series, fmt }) {
  const max = Math.max(1, ...data.flatMap((m) => series.map(([k]) => m[k])));
  return (
    <div>
      <div className="flex h-44 items-end gap-2">
        {data.map((m) => (
          <div key={m.label} className="flex h-full flex-1 items-end justify-center gap-0.5">
            {series.map(([k, label, cls]) => (
              <div key={k} title={`${m.label} · ${label}: ${fmt(m[k])}`} className={`w-full max-w-[10px] rounded-t ${cls}`}
                style={{ height: `${(m[k] / max) * 100}%`, minHeight: m[k] ? 2 : 0 }} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 text-center text-[10px] text-slate-500">
        {data.map((m) => <span key={m.label} className="flex-1">{m.label}</span>)}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
        {series.map(([k, label, cls]) => (
          <span key={k} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${cls}`} />{label}</span>
        ))}
      </div>
    </div>
  );
}

function DeliveryDonut({ sent, failed, t, fmt }) {
  const total = sent + failed;
  const pct = total ? Math.round((sent / total) * 100) : 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const okLen = total ? (sent / total) * c : 0;
  return (
    <div className="flex items-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke={total ? '#ef4444' : '#1e293b'} strokeWidth="16" />
        {total > 0 && (
          <circle cx="70" cy="70" r={r} fill="none" stroke="#22c55e" strokeWidth="16"
            strokeDasharray={`${okLen} ${c - okLen}`} />
        )}
      </svg>
      <div className="space-y-2 text-sm">
        <div className="text-3xl font-bold text-white">{total ? `${pct}%` : '-'}</div>
        <div className="text-xs text-slate-500">{t('dashboard.deliveryRateSubtitle')}</div>
        <div className="flex items-center gap-2 text-slate-300">
          <span className="h-2 w-2 rounded-full bg-success" />
          {t('dashboard.sent')}: {fmt(sent)}
        </div>
        <div className="flex items-center gap-2 text-slate-300">
          <span className="h-2 w-2 rounded-full bg-danger" />
          {t('dashboard.failed')}: {fmt(failed)}
        </div>
      </div>
    </div>
  );
}

function ChipBars({ chips, t, fmt }) {
  const max = Math.max(1, ...chips.map((c) => c.total));
  return (
    <div className="space-y-4">
      {chips.map((c) => (
        <div key={c.slot}>
          <div className="mb-1 flex justify-between text-sm text-slate-300">
            <span>{t('dashboard.slot')} {c.slot} (SIM {c.slot + 1})</span>
            <span>{fmt(c.total)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-bg">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(c.total / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { t, lang } = useLanguage();
  const [stats, setStats] = useState({});
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [analytics, setAnalytics] = useState(null);
  const [loadingChart, setLoadingChart] = useState(true);
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i);

  const fmt = (n) => Number(n ?? 0).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US');

  const monthLabels = t('dashboard.months') || DEFAULT_MONTHS;
  const series = [
    ['sent', t('dashboard.sent'), 'bg-success'],
    ['received', t('dashboard.received'), 'bg-sky-400'],
    ['failed', t('dashboard.failed'), 'bg-danger'],
  ];

  useEffect(() => {
    (async () => {
      const [devices, online, contacts, queue, sent, failed] = await Promise.all([
        count('devices'),
        count('devices', (q) => q.eq('status', 'online')),
        count('contacts'),
        count('sms_queue'),
        count('sms_sent'),
        count('sms_failed'),
      ]);
      setStats({ devices, online, contacts, queue, sent, failed });
    })();
  }, []);

  useEffect(() => {
    let alive = true;
    setLoadingChart(true);
    supabase.rpc('get_dashboard_analytics', { p_year: year }).then(({ data, error }) => {
      if (!alive) return;
      setAnalytics(error ? null : data);
      setLoadingChart(false);
    });
    return () => { alive = false; };
  }, [year]);

  const monthly = useMemo(() => normalizeMonthly(analytics?.monthly_evolution, monthLabels), [analytics, monthLabels]);
  const chips = useMemo(() => normalizeChips(analytics?.by_chip), [analytics]);
  const yearSent = monthly.reduce((a, m) => a + m.sent, 0);
  const yearFailed = monthly.reduce((a, m) => a + m.failed, 0);

  const cards = [
    { label: t('dashboard.onlineDevices'), value: `${stats.online ?? '-'} / ${stats.devices ?? '-'}`, icon: Smartphone, color: 'text-accent' },
    { label: t('dashboard.contacts'), value: stats.contacts, icon: Users, color: 'text-accent' },
    { label: t('dashboard.inQueue'), value: stats.queue, icon: Clock, color: 'text-yellow-400' },
    { label: t('dashboard.sent'), value: stats.sent, icon: CheckCircle2, color: 'text-success' },
    { label: t('dashboard.failed'), value: stats.failed, icon: XCircle, color: 'text-danger' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t('dashboard.title')}</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card">
            <Icon className={color} size={22} />
            <div className="mt-3 text-2xl font-bold text-white">{value ?? '-'}</div>
            <div className="text-xs text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{t('dashboard.analysisOf')} {year}</h2>
        <select className="input w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loadingChart && <p className="text-sm text-slate-400">{t('dashboard.loadingAnalytics')}</p>}
      {!loadingChart && !analytics && <p className="text-sm text-danger">{t('dashboard.errorAnalytics')}</p>}

      {analytics && (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="card lg:col-span-3 space-y-3">
            <h3 className="font-semibold text-white">{t('dashboard.monthlyEvolution')}</h3>
            <MonthlyChart data={monthly} series={series} fmt={fmt} />
          </section>
          <section className="card space-y-3">
            <h3 className="font-semibold text-white">{t('dashboard.deliveryRate')}</h3>
            <DeliveryDonut sent={yearSent} failed={yearFailed} t={t} fmt={fmt} />
          </section>
          <section className="card lg:col-span-2 space-y-3">
            <h3 className="font-semibold text-white">{t('dashboard.dispatchesByChip')}</h3>
            <ChipBars chips={chips} t={t} fmt={fmt} />
          </section>
        </div>
      )}
    </div>
  );
}
