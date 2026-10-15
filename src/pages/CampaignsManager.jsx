import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pause, Play, Smartphone, Copy, Trash2, ListChecks, Loader2, Ban } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { useDevices } from '../hooks/useDevices.js';
import { isDeviceOnline } from '../lib/devices.js';
import {
  fetchAll, startCampaign, resumeCampaign, pauseCampaign, cancelCampaign, reassignCampaign, deleteCampaign,
} from '../lib/campaigns.js';
import Modal from '../components/Modal.jsx';
import RecipientsDrawer from '../components/RecipientsDrawer.jsx';

const SENT = ['SENT', 'DELIVERED'];
const PENDING = ['PENDING', 'SCHEDULED'];

const STATUS_STYLE = {
  RUNNING: { label: 'Em andamento', cls: 'bg-success/15 text-success' },
  PAUSED: { label: 'Pausada', cls: 'bg-yellow-400/15 text-yellow-400' },
  COMPLETED: { label: 'Concluída', cls: 'bg-success/15 text-success' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-danger/15 text-danger' },
  SUSPENDED: { label: 'Suspensa', cls: 'bg-danger/15 text-danger' },
  DRAFT: { label: 'Rascunho', cls: 'bg-white/10 text-slate-300' },
};

const emptyStats = () => ({
  sent: 0, pending: 0, paused: 0, failed: 0, optedOut: 0, draft: 0, devices: new Set(), slots: new Set(),
  cold: 0, schedPaused: 0, firing: 0,
});

/** Soma os contadores da sms_schedule (fria); enviados vêm da sms_queue e de campaigns.sent_count. */
function addTableCounts(stats, schedule) {
  for (const r of schedule) {
    const s = (stats[r.campaign_id] ??= emptyStats());
    if (r.status === 'WAITING') s.cold++;
    else if (r.status === 'PAUSED') s.schedPaused++;
    if (r.target_device_id) s.devices.add(r.target_device_id);
    if (r.sim_slot !== null && r.sim_slot !== undefined) s.slots.add(Number(r.sim_slot));
  }
}

/** Agrega as linhas da fila por campanha. */
function buildStats(rows) {
  const stats = {};
  for (const r of rows) {
    const s = (stats[r.campaign_id] ??= emptyStats());
    if (SENT.includes(r.status)) s.sent++;
    else if (r.status === 'PENDING') { s.firing++; s.pending++; }
    else if (PENDING.includes(r.status)) s.pending++;
    else if (r.status === 'PAUSED') s.paused++;
    else if (r.status === 'FAILED') s.failed++;
    else if (r.status === 'OPTED_OUT') s.optedOut++;
    else if (r.status === 'DRAFT') s.draft++;
    if (r.target_device_id) s.devices.add(r.target_device_id);
    if (r.sim_slot !== null && r.sim_slot !== undefined) s.slots.add(Number(r.sim_slot));
  }
  return stats;
}

export default function CampaignsManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { devices } = useDevices(user.id);

  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [chipsFor, setChipsFor] = useState(null); // campanha no modal de chips
  const [chips, setChips] = useState({ deviceMode: 'all', simMode: 'alternate' });
  const [detail, setDetail] = useState(null); // campanha na gaveta
  const [refreshKey, setRefreshKey] = useState(0);

  const deviceName = useCallback(
    (id) => devices.find((d) => d.id === id)?.name ?? (id ? `${String(id).slice(0, 8)}…` : '—'),
    [devices],
  );

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('campaigns').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;

      const ids = data.map((c) => c.id);
      const rows = ids.length
        ? await fetchAll(() => supabase.from('sms_queue')
          .select('id, campaign_id, status, target_device_id, sim_slot').in('campaign_id', ids).order('id'))
        : [];
      const st = buildStats(rows);
      if (ids.length) {
        const schedule = await fetchAll(() => supabase.from('sms_schedule')
          .select('id, campaign_id, status, target_device_id, sim_slot').in('campaign_id', ids).order('id'));
        addTableCounts(st, schedule);
      }

      // Campanha em andamento sem nada mais a enviar passa a Concluída
      const resolved = data.map((c) => {
        const s = st[c.id];
        const open = s ? s.pending + s.paused + s.draft + s.cold + s.schedPaused : 0;
        const done = s ? Math.max(s.sent, c.sent_count ?? 0) + Math.max(s.failed, c.failed_count ?? 0) : 0;
        if (String(c.status).toUpperCase() === 'RUNNING' && s && open === 0 && done + s.optedOut > 0) {
          supabase.from('campaigns').update({ status: 'COMPLETED' }).eq('id', c.id).then(() => {});
          return { ...c, status: 'COMPLETED' };
        }
        return c;
      });
      setCampaigns(resolved);
      setStats(st);
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
    setLoading(false);
  }, [user.id]);

  // Realtime em sms_queue e campaigns; o debounce evita recarregar a cada SMS enviado
  useEffect(() => {
    load();
    let timer;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { load(); setRefreshKey((k) => k + 1); }, 1500);
    };
    const channel = supabase.channel(`campaigns-manager-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sms_queue' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sms_schedule' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, schedule)
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(channel); };
  }, [load, user.id]);

  const run = async (c, fn, doneText) => {
    setBusyId(c.id);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: doneText });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
    setBusyId(null);
    load();
  };

  const progress = (label) => (done, total) => setMsg({ ok: true, text: `${label} ${done}/${total}` });

  const openChips = (c) => {
    setChips({
      deviceMode: c.target_device_id ?? 'all',
      simMode: c.sim_slot_preference === null || c.sim_slot_preference === undefined ? 'alternate' : String(c.sim_slot_preference),
    });
    setChipsFor(c);
  };

  const applyChips = async () => {
    const c = chipsFor;
    setChipsFor(null);
    await run(c, () => reassignCampaign(c, chips.deviceMode, chips.simMode, progress('Reatribuindo')), 'Aparelho e chip atualizados.');
  };

  const remove = (c) => {
    if (!confirm('Excluir a campanha e as mensagens ainda não enviadas? O histórico já enviado é mantido.')) return;
    run(c, () => deleteCampaign(c), 'Campanha excluída.');
  };

  if (loading) return <p className="text-slate-400">Carregando...</p>;

  const pendingOf = (s) => (s ? s.pending + s.paused + s.draft + s.cold + s.schedPaused : 0);
  const onlineCount = devices.filter(isDeviceOnline).length;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Campanhas</h1>
        <button className="btn-primary" onClick={() => navigate('/disparar')}>Nova campanha</button>
      </div>

      {msg && <p className={`text-sm ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}
      {!campaigns.length && <p className="text-slate-400">Nenhuma campanha criada.</p>}

      {campaigns.map((c) => {
        const s = stats[c.id] ?? emptyStats();
        const sent = Math.max(s.sent, c.sent_count ?? 0);
        const failed = Math.max(s.failed, c.failed_count ?? 0);
        const total = c.total_contacts || sent + failed + pendingOf(s);
        // Tudo processado: exibe como Concluída mesmo que o status no banco ainda não tenha mudado
        const rawKey = String(c.status).toUpperCase();
        const key = total > 0 && sent + failed >= total && ['RUNNING', 'PAUSED'].includes(rawKey) ? 'COMPLETED' : rawKey;
        const st = STATUS_STYLE[key] ?? { label: c.status, cls: 'bg-white/10 text-slate-300' };
        const pct = (n) => (total ? Math.min(100, (n / total) * 100) : 0);
        const open = pendingOf(s);
        const busy = busyId === c.id;

        const devNames = [...s.devices].map(deviceName).join(', ') || (c.target_device_id ? deviceName(c.target_device_id) : 'Todos online');
        const slotNames = [...s.slots].sort().map((n) => `SIM ${n + 1}`).join(' + ') || '—';

        return (
          <div key={c.id} className="card space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">{c.title}</div>
                <div className="text-xs text-slate-500">
                  Criada em {c.created_at ? new Date(c.created_at).toLocaleString('pt-BR') : '—'}
                </div>
              </div>
              <span className={`badge ${st.cls}`}>{st.label}</span>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-400">
              <span className="flex items-center gap-2"><Smartphone size={14} className="text-accent" />{devNames}</span>
              <span>{slotNames}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ['Total', total, 'text-white'],
                ['Fila agendada (fria)', s.cold, 'text-accent'],
                ['Disparando agora', s.firing, 'text-yellow-400'],
                ['Enviados com sucesso', sent, 'text-success'],
                ['Falhas', failed, 'text-danger'],
              ].map(([label, value, cls]) => (
                <div key={label} className="rounded-lg bg-bg p-3">
                  <div className={`text-xl font-bold ${cls}`}>{value}</div>
                  <div className="text-xs text-slate-500">{label}</div>
                </div>
              ))}
            </div>

            <div>
              <div className="flex h-2 overflow-hidden rounded-full bg-bg">
                <div className="bg-success transition-all" style={{ width: `${pct(sent)}%` }} />
                <div className="bg-danger transition-all" style={{ width: `${pct(failed)}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>{Math.round(pct(sent + failed))}% processado</span>
                {s.optedOut > 0 && <span>{s.optedOut} opt-out</span>}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {key === 'RUNNING' && (
                <button className="btn-ghost" disabled={busy} onClick={() => run(c, () => pauseCampaign(c), 'Campanha pausada.')}>
                  <Pause size={14} /> Pausar
                </button>
              )}
              {key === 'PAUSED' && (
                <button className="btn-primary" disabled={busy}
                  onClick={() => run(c, () => resumeCampaign(c, progress('Reagendando')), 'Campanha retomada.')}>
                  <Play size={14} /> Retomar
                </button>
              )}
              {key === 'DRAFT' && (
                <button className="btn-primary" disabled={busy}
                  onClick={() => run(c, () => startCampaign(c, progress('Agendando')), 'Campanha iniciada.')}>
                  <Play size={14} /> Iniciar
                </button>
              )}
              <button className="btn-ghost" disabled={busy || open === 0} onClick={() => openChips(c)}>
                <Smartphone size={14} /> Alterar chips / aparelho
              </button>
              {['RUNNING', 'PAUSED'].includes(key) && (
                <button className="btn-ghost" disabled={busy}
                  onClick={() => confirm('Cancelar a campanha? Mensagens não enviadas serão descartadas.')
                    && run(c, () => cancelCampaign(c), 'Campanha cancelada.')}>
                  <Ban size={14} /> Cancelar
                </button>
              )}
              <button className="btn-ghost" disabled={busy} onClick={() => navigate('/disparar', { state: { duplicateFrom: c } })}>
                <Copy size={14} /> Repetir
              </button>
              <button className="btn-ghost" onClick={() => setDetail(c)}>
                <ListChecks size={14} /> Destinatários
              </button>
              <button className="btn-danger" disabled={busy} onClick={() => remove(c)}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Excluir
              </button>
            </div>
          </div>
        );
      })}

      {chipsFor && (
        <Modal title="Alterar aparelho e chip" onClose={() => setChipsFor(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Vale só para as {pendingOf(stats[chipsFor.id])} mensagem(ns) ainda não enviadas de "{chipsFor.title}".
            </p>
            <div>
              <label className="label">Aparelho</label>
              <select className="input" value={chips.deviceMode} onChange={(e) => setChips({ ...chips, deviceMode: e.target.value })}>
                <option value="all">Distribuir entre os aparelhos online ({onlineCount})</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}{isDeviceOnline(d) ? '' : ' (offline)'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Chip</label>
              <select className="input" value={chips.simMode} onChange={(e) => setChips({ ...chips, simMode: e.target.value })}>
                <option value="alternate">Alternar entre SIM 1 e SIM 2</option>
                <option value="0">Apenas SIM 1 (slot 0)</option>
                <option value="1">Apenas SIM 2 (slot 1)</option>
              </select>
            </div>
            <button className="btn-primary w-full" onClick={applyChips}>Aplicar</button>
          </div>
        </Modal>
      )}

      {detail && (
        <RecipientsDrawer campaign={detail} deviceName={deviceName} refreshKey={refreshKey} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}
