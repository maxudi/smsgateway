import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Square, Pencil, Trash2, Loader2, Shuffle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { startCampaign, pauseCampaign, suspendCampaign, deleteCampaign, redistributeCampaign } from '../lib/campaigns.js';

const STATUS = {
  DRAFT: { label: 'Rascunho', cls: 'bg-white/10 text-slate-300' },
  RUNNING: { label: 'Em andamento', cls: 'bg-success/15 text-success' },
  PAUSED: { label: 'Pausada', cls: 'bg-yellow-400/15 text-yellow-400' },
  SUSPENDED: { label: 'Suspensa', cls: 'bg-danger/15 text-danger' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-danger/15 text-danger' },
  COMPLETED: { label: 'Concluída', cls: 'bg-success/15 text-success' },
};

// Ações disponíveis por status
const ACTIONS = {
  DRAFT: ['start', 'edit', 'remove'],
  RUNNING: ['pause', 'redistribute', 'suspend'],
  PAUSED: ['start', 'redistribute', 'edit', 'suspend'],
  SUSPENDED: ['edit', 'remove'],
  COMPLETED: ['remove'],
};

const BUTTONS = {
  start: { label: 'Iniciar / continuar', icon: Play, cls: 'btn-primary' },
  pause: { label: 'Pausar', icon: Pause, cls: 'btn-ghost' },
  suspend: { label: 'Suspender', icon: Square, cls: 'btn-danger', confirm: 'Suspender cancela os envios pendentes desta campanha. Continuar?' },
  edit: { label: 'Editar', icon: Pencil, cls: 'btn-ghost' },
  redistribute: { label: 'Redistribuir', icon: Shuffle, cls: 'btn-ghost', confirm: 'Reatribuir os SMS pendentes entre os aparelhos online agora?' },
  remove: { label: 'Excluir', icon: Trash2, cls: 'btn-danger', confirm: 'Excluir a campanha e seus itens na fila?' },
};

export default function CampaignList({ userId, onEdit, notice }) {
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({}); // id -> { waiting, firing, sent, failed }
  const countsRef = useRef({});
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState(notice ?? null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('campaigns').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    if (error) setMsg({ ok: false, text: error.message });
    setRows(data ?? []);

    // Contagens exatas por campanha, nas mesmas fontes do CampaignsManager
    const head = (table, id, status) => {
      let q = supabase.from(table).select('id', { count: 'exact', head: true }).eq('campaign_id', id);
      if (Array.isArray(status)) q = q.in('status', status);
      else if (status) q = q.eq('status', status);
      return q.then((r) => r.count ?? 0);
    };
    const entries = await Promise.all((data ?? []).map(async (c) => {
      const [waiting, firing] = await Promise.all([
        head('sms_schedule', c.id, 'WAITING'), head('sms_queue', c.id, 'PENDING'),
      ]);
      // Concluída e sem itens em trânsito: reaproveita a contagem anterior em vez de reconsultar
      const prev = countsRef.current[c.id];
      const [queueSent, failed, linkRes] = await Promise.all([
        prev && String(c.status).toUpperCase() === 'COMPLETED' && !waiting && !firing
          ? Promise.resolve(prev.sent)
          : head('sms_queue', c.id, ['SENT', 'DELIVERED']),
        prev && String(c.status).toUpperCase() === 'COMPLETED' && !waiting && !firing
          ? Promise.resolve(prev.failed)
          : head('sms_queue', c.id, 'FAILED'),
        supabase.from('short_links').select('clicks').eq('campaign_id', c.id).gt('clicks', 0),
      ]);
      const clickedContacts = (linkRes?.data ?? []).length;
      const totalClicks = (linkRes?.data ?? []).reduce((sum, r) => sum + Number(r.clicks ?? 0), 0);
      return [c.id, { waiting, firing, sent: queueSent, failed, clickedContacts, totalClicks }];
    }));
    countsRef.current = Object.fromEntries(entries);
    setCounts(countsRef.current);
  }, [userId]);

  useEffect(() => {
    load();
    // Realtime dispara a recarga (debounce de 1s); o polling de 10s fica só como contingência
    let timer;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(load, 1000); };
    const channel = supabase.channel(`campaign-list-${userId}`);
    ['sms_queue', 'sms_schedule', 'campaigns'].forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule);
    });
    channel.subscribe();
    const t = setInterval(load, 10000);
    return () => { clearTimeout(timer); clearInterval(t); supabase.removeChannel(channel); };
  }, [load, userId]);

  const run = async (c, action) => {
    if (action === 'edit') return onEdit(c);
    const btn = BUTTONS[action];
    if (btn.confirm && !confirm(btn.confirm)) return;

    setBusyId(c.id);
    setMsg(null);
    try {
      if (action === 'start') {
        await startCampaign(c, (done, total) => setMsg({ ok: true, text: `Agendando itens... ${done}/${total}` }));
      } else if (action === 'pause') await pauseCampaign(c);
      else if (action === 'redistribute') {
        await redistributeCampaign(c, (done, total) => setMsg({ ok: true, text: `Redistribuindo... ${done}/${total}` }));
      } else if (action === 'suspend') await suspendCampaign(c);
      else await deleteCampaign(c);
      setMsg({ ok: true, text: 'Ação concluída.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
    setBusyId(null);
    load();
  };

  return (
    <div className="space-y-4">
      {msg && <p className={`text-sm ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}
      {!rows.length && <p className="text-slate-400">Nenhuma campanha criada.</p>}

      {rows.map((c) => {
        const cnt = counts[c.id] ?? { waiting: 0, firing: 0, sent: 0, failed: 0 };
        const sent = Math.max(cnt.sent, c.sent_count ?? 0);
        const failed = Math.max(cnt.failed, c.failed_count ?? 0);
        const total = c.total_contacts || sent + failed + cnt.waiting + cnt.firing;
        const done = sent + failed;
        const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
        // Tudo processado: exibe como Concluída mesmo que o status no banco ainda não tenha mudado
        const rawKey = String(c.status).toUpperCase();
        const key = total > 0 && done >= total && ['RUNNING', 'PAUSED'].includes(rawKey) ? 'COMPLETED' : rawKey;
        const st = STATUS[key] ?? { label: c.status, cls: 'bg-white/10 text-slate-300' };
        return (
          <div key={c.id} className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-white">{c.title}</div>
                <div className="text-xs text-slate-500">
                  {c.created_at && new Date(c.created_at).toLocaleString('pt-BR')} · {c.total_contacts} contato(s)
                </div>
              </div>
              <span className={`badge ${st.cls}`}>{st.label}</span>
            </div>

            <div>
              <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs text-slate-400">
                <span>
                  {sent} / {total} enviados · {cnt.waiting} agendados · {cnt.firing} disparando · {failed} falhas
                  {(cnt.totalClicks > 0 || /\{link\}/i.test(c.message_template || '')) && (
                    <span className="ml-2 inline-flex items-center rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-medium text-emerald-300">
                      🔗 {cnt.clickedContacts ?? 0} clicaram ({cnt.totalClicks ?? 0} cliques)
                    </span>
                  )}
                </span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-bg">
                <div className="h-full bg-success" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(ACTIONS[key] ?? ['remove']).map((a) => {
                const { label, icon: Icon, cls } = BUTTONS[a];
                return (
                  <button key={a} className={cls} disabled={busyId === c.id} onClick={() => run(c, a)}>
                    {busyId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />} {label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
