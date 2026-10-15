import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, Save, AlertTriangle, Loader2, Smartphone, Users, ShieldCheck, Clock, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isDeviceOnline, buildChannels } from '../lib/devices.js';
import { useDevices } from '../hooks/useDevices.js';
import { useAuth } from '../context/AuthContext.jsx';
import CampaignList from '../components/CampaignList.jsx';
import {
  BATCH_SIZE, SCHEDULE_CHUNK, DEFAULT_DAYS, SUFFIX_MARGIN, fetchAll, personalize, humanizeMessage,
  scheduleByChannel, scheduleStartTime, channelKey, estimatePerDay, clearUnsentItems,
} from '../lib/campaigns.js';

const WEEKDAYS = [['Dom', 0], ['Seg', 1], ['Ter', 2], ['Qua', 3], ['Qui', 4], ['Sex', 5], ['Sáb', 6]];

// Caracteres fora do GSM-7 básico forçam Unicode (UCS-2), com limites menores por parte
const GSM7 = /^[\w @£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà\r\n^{}\\[~\]|€]*$/;

// A margem reserva espaço no fim do SMS para o sufixo anti-filtro
function smsInfo(text, margin) {
  const unicode = !GSM7.test(text);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const len = text.length;
  const total = len + margin;
  const parts = len === 0 ? 0 : total <= single ? 1 : Math.ceil(total / multi);
  const limit = parts <= 1 ? single - margin : parts * multi - margin;
  return { len, parts, unicode, limit };
}

const DEFAULT_FORM = {
  title: '', message: '', humanize: true,
  deviceMode: 'all', // 'all' | id do aparelho
  simMode: 'alternate', // 'alternate' | '0' | '1'
  minInterval: 45, maxInterval: 90, start: '08:30', end: '18:30',
  dailyLimit: 30, days: DEFAULT_DAYS,
  scheduleStart: false, startAt: '', // startAt: datetime-local
};

/** Telefones colados à mão: só dígitos, com DDI 55 quando vier sem (10-11 dígitos). */
function parseManualNumbers(text) {
  const valid = new Map();
  let invalid = 0;
  for (const raw of text.split(/[,;\n\r]+/).map((s) => s.trim()).filter(Boolean)) {
    let d = raw.replace(/\D/g, '');
    if (d.length === 10 || d.length === 11) d = `55${d}`;
    if (d.length < 12 || d.length > 15) invalid++;
    else valid.set(d, { id: d, name: '', phone: d });
  }
  return { list: [...valid.values()], invalid };
}

export default function SendCampaign() {
  const { user, plan, profile, isMaster, refreshProfile } = useAuth();

  const [tab, setTab] = useState('new'); // new | campaigns
  const [editing, setEditing] = useState(null); // campanha em edição
  const [notice, setNotice] = useState(null);

  const { devices, reload: reloadDevices } = useDevices(user.id); // atualiza em tempo real
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [recipientMode, setRecipientMode] = useState('all'); // all | groups | contacts
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [selectedTipos, setSelectedTipos] = useState([]);
  const [manualText, setManualText] = useState('');
  const [contactPage, setContactPage] = useState(1);
  const [contactPageSize, setContactPageSize] = useState(50); // 'ALL' = mostrar todos
  const [search, setSearch] = useState('');

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [previewSeed, setPreviewSeed] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const duplicateHandled = useRef(false);

  useEffect(() => {
    (async () => {
      const [c, g] = await Promise.all([
        // Paginado: o Supabase limita 1000 linhas por requisição
        fetchAll(() => supabase.from('contacts')
          .select('*, contact_group_members!contact_group_members_contact_id_fkey(group_id)')
          .eq('user_id', user.id).order('id')),
        supabase.from('contact_groups').select('*').order('sort_order'),
      ]);
      setContacts(c);
      setGroups(g.data ?? []);
      setLoading(false);
    })();
  }, [user.id]);

  // "Repetir campanha": reaproveita mensagem e a mesma lista de números; novos códigos são gerados ao salvar
  useEffect(() => {
    const src = location.state?.duplicateFrom;
    if (!src || loading || duplicateHandled.current) return;
    duplicateHandled.current = true;
    (async () => {
      const cfg = src.config ?? {};
      let queued = await fetchAll(() => supabase.from('sms_schedule').select('id, phone')
        .eq('campaign_id', src.id).order('id'));
      if (!queued.length) {
        queued = await fetchAll(() => supabase.from('sms_queue').select('id, phone')
          .eq('campaign_id', src.id).order('id'));
      }
      const phones = new Set(queued.map((r) => r.phone));
      setForm({ ...DEFAULT_FORM, ...cfg.form, title: `${src.title} (cópia)`, message: src.message_template ?? '' });
      if (phones.size) {
        const byPhone = contacts.filter((c) => phones.has(c.phone));
        if (byPhone.length === phones.size) {
          setRecipientMode('contacts');
          setSelectedContacts(byPhone.map((c) => c.id));
        } else { // há números avulsos, sem cadastro
          setRecipientMode('manual');
          setManualText([...phones].join('\n'));
        }
      } else {
        setRecipientMode(cfg.recipientMode ?? 'all');
        setSelectedGroups(cfg.selectedGroups ?? []);
        setSelectedContacts(cfg.selectedContacts ?? []);
        setSelectedTipos(cfg.selectedTipos ?? []);
      }
      setEditing(null);
      setTab('new');
      navigate(location.pathname, { replace: true, state: null });
    })();
  }, [location, loading, contacts, navigate]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  // ----- Destinatários -----
  const allGroupId = groups.find((g) => g.slug === 'todas')?.id;
  const selectableGroups = groups.filter((g) => g.slug !== 'todas');

  const usedTipos = useMemo(() => [...new Set(contacts.map((c) => c.tipo).filter(Boolean))].sort(), [contacts]);
  const manual = useMemo(() => parseManualNumbers(manualText), [manualText]);

  const candidates = useMemo(() => {
    if (recipientMode === 'contacts') return contacts.filter((c) => selectedContacts.includes(c.id));
    if (recipientMode === 'tipos') return contacts.filter((c) => selectedTipos.includes(c.tipo));
    if (recipientMode === 'manual') {
      // Números avulsos que correspondem a um contato em opt-out continuam bloqueados
      const optedOut = new Set(contacts.filter((c) => c.opted_out).map((c) => c.phone));
      return manual.list.map((m) => ({ ...m, opted_out: optedOut.has(m.phone) }));
    }
    if (recipientMode === 'groups') {
      return contacts.filter((c) =>
        (c.contact_group_members ?? []).some((m) => m.group_id === allGroupId || selectedGroups.includes(m.group_id)));
    }
    return contacts;
  }, [contacts, recipientMode, selectedGroups, selectedContacts, selectedTipos, manual, allGroupId]);

  const recipients = useMemo(() => candidates.filter((c) => !c.opted_out), [candidates]);
  const excluded = candidates.length - recipients.length;

  const filteredContacts = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(q));
  }, [contacts, search]);

  const contactAll = contactPageSize === 'ALL';
  const contactPages = contactAll ? 1 : Math.ceil(filteredContacts.length / contactPageSize) || 1;
  const contactPageSafe = Math.min(contactPage, contactPages);
  const visibleContacts = contactAll
    ? filteredContacts
    : filteredContacts.slice((contactPageSafe - 1) * contactPageSize, contactPageSafe * contactPageSize);

  const toggleIn = (setter) => (id) => setter((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleGroup = toggleIn(setSelectedGroups);
  const toggleTipo = toggleIn(setSelectedTipos);
  const toggleContact = toggleIn(setSelectedContacts);
  const markFiltered = () => setSelectedContacts((s) => [
    ...new Set([...s, ...filteredContacts.filter((c) => !c.opted_out).map((c) => c.id)]),
  ]);

  // ----- Canais (aparelho x chip) -----
  // Agendar não depende de o aparelho estar online agora: consideram-se todos os cadastrados
  const targetDevices = form.deviceMode === 'all' ? devices : devices.filter((d) => d.id === form.deviceMode);
  const channels = buildChannels(devices, form.deviceMode, form.simMode, true);
  const sleepingDevices = targetDevices.filter((d) => !isDeviceOnline(d));

  // ----- Validação -----
  // Nome de exemplo para contador e prévia; o contador considera o texto já personalizado
  const sampleName = (recipients[0]?.name || '').trim().split(/\s+/)[0] || 'Marcos';
  const margin = form.humanize ? SUFFIX_MARGIN : 0;
  const info = useMemo(
    () => smsInfo(personalize(form.message, { name: sampleName }), margin),
    [form.message, sampleName, margin],
  );
  const preview = useMemo(
    () => (form.humanize ? humanizeMessage(form.message, sampleName) : personalize(form.message, { name: sampleName })),
    // previewSeed força novo código/espaçamento ao clicar em "gerar outro"
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.message, form.humanize, sampleName, previewSeed],
  );
  const minI = Number(form.minInterval);
  const maxI = Number(form.maxInterval);
  const planMin = isMaster ? 0 : plan?.min_interval_seconds ?? 0;
  const perDay = minI > 0 && maxI >= minI && form.start < form.end ? estimatePerDay(form) : 0;
  const effectivePerDay = Number(form.dailyLimit) > 0 ? Math.min(perDay, Number(form.dailyLimit)) : perDay;
  const remainingQuota = plan && !isMaster ? plan.max_sms_monthly - (profile?.sms_used_this_month ?? 0) : Infinity;

  const errors = [];
  const warnings = [];
  if (!form.message.trim()) errors.push('Escreva a mensagem.');
  if (recipients.length === 0) errors.push('Nenhum destinatário ativo selecionado.');
  if (!channels.length) errors.push(form.deviceMode === 'all' ? 'Nenhum aparelho cadastrado.' : 'Aparelho não encontrado.');
  if (!(minI > 0) || !(maxI > 0)) errors.push('Informe os intervalos mínimo e máximo.');
  else if (maxI < minI) errors.push('O intervalo máximo deve ser maior ou igual ao mínimo.');
  if (minI < planMin) errors.push(`Seu plano exige intervalo mínimo de ${planMin}s.`);
  if (form.start >= form.end) errors.push('O horário inicial deve ser anterior ao final.');
  if (!form.days.length) errors.push('Selecione ao menos um dia de envio.');
  if (form.scheduleStart) {
    if (!form.startAt) errors.push('Informe a data e hora de início do disparo.');
    else if (new Date(form.startAt) <= new Date()) errors.push('A data de início precisa estar no futuro.');
  }
  if (recipientMode === 'tipos' && !selectedTipos.length) errors.push('Selecione ao menos um tipo.');
  if (recipientMode === 'manual' && manual.invalid) warnings.push(`${manual.invalid} número(s) inválido(s) serão ignorados.`);
  if (recipients.length * Math.max(info.parts, 1) > remainingQuota) {
    errors.push(`Cota mensal insuficiente: restam ${remainingQuota} SMS no plano.`);
  }
  if (sleepingDevices.length) {
    warnings.push('O aparelho está em repouso. O envio iniciará assim que o aplicativo conectar ou no horário agendado.');
  }
  if (minI > 0 && minI < 10) warnings.push('Intervalos muito curtos aumentam o risco de bloqueio pela operadora.');
  if (info.parts > 1) warnings.push(`A mensagem usa ${info.parts} partes de SMS por contato.`);

  // ----- Edição de campanha salva -----
  const resetForm = () => {
    setForm(DEFAULT_FORM); setRecipientMode('all'); setSelectedGroups([]);
    setSelectedTipos([]); setManualText('');
    setSelectedContacts([]); setSearch(''); setEditing(null); setError(null);
  };

  const openCampaign = (c) => {
    const cfg = c.config ?? {};
    setForm({ ...DEFAULT_FORM, ...cfg.form, title: c.title, message: c.message_template ?? '' });
    setRecipientMode(cfg.recipientMode ?? 'all');
    setSelectedGroups(cfg.selectedGroups ?? []);
    setSelectedContacts(cfg.selectedContacts ?? []);
    setSelectedTipos(cfg.selectedTipos ?? []);
    setEditing(c);
    setError(null);
    setTab('new');
  };

  // ----- Gravação -----
  // startNow=false salva como rascunho (DRAFT); true grava 1 item PENDING e os demais SCHEDULED
  const save = async (startNow) => {
    setError(null);
    if (errors.length) return;
    setBusy(true);
    setProgress({ done: 0, total: recipients.length });
    let newCampaignId = null;

    try {
      // Relê os aparelhos; offline entra também, o app retoma ao reconectar (target_device_id é TEXT, o Android ID)
      const { data: freshDevices, error: dErr } = await supabase.from('devices').select('*').eq('user_id', user.id);
      if (dErr) throw dErr;
      reloadDevices();
      const liveChannels = buildChannels(freshDevices, form.deviceMode, form.simMode, true);
      if (!liveChannels.length) throw new Error('Nenhum aparelho cadastrado para o disparo.');
      const startAt = form.scheduleStart && form.startAt ? new Date(form.startAt).toISOString() : null;
      const cfg = {
        recipientMode, selectedGroups, selectedContacts, selectedTipos,
        form: { ...form, message: undefined, title: undefined },
        // Campos usados diretamente para (re)agendar
        minInterval: minI, maxInterval: maxI, start: form.start, end: form.end,
        dailyLimit: Number(form.dailyLimit), days: form.days, startAt,
      };

      const chOf = (i) => liveChannels[i % liveChannels.length]; // Round-Robin de aparelho e chip
      const startFrom = scheduleStartTime(cfg);
      const times = scheduleByChannel(recipients.map((_, i) => channelKey(chOf(i).deviceId, chOf(i).slot)), cfg, startFrom);

      const used = new Set(); // códigos já usados neste lote
      // Rascunho fica PAUSED até "Iniciar"; iniciar grava WAITING
      const rows = recipients.map((c, i) => ({
        user_id: user.id,
        target_device_id: chOf(i).deviceId,
        sim_slot: chOf(i).slot,
        phone: c.phone,
        message: form.humanize ? humanizeMessage(form.message, c.name, used) : personalize(form.message, c),
        scheduled_for: times[i].toISOString(),
        status: startNow ? 'WAITING' : 'PAUSED',
      }));
      const firstRun = times.reduce((a, b) => (b < a ? b : a)).toISOString();

      // Ao iniciar, a 1ª mensagem de cada chip (se já devida) segue direto para sms_queue; o resto fica em sms_schedule
      const queueRows = [];
      const scheduleRows = [];
      const seen = new Set();
      rows.forEach((r, i) => {
        const k = channelKey(r.target_device_id, r.sim_slot);
        const isFirst = !seen.has(k);
        seen.add(k);
        // Início futuro: nada vai direto para sms_queue
        if (startNow && isFirst && startFrom.getTime() - Date.now() < 2000 && times[i].getTime() - Date.now() < 2000) {
          const { user_id: _u, ...q } = r;
          queueRows.push({ ...q, status: 'PENDING' });
        } else scheduleRows.push(r);
      });

      // As colunas de hora do banco são inteiras; o horário exato fica em config
      const campaignData = {
        title: form.title.trim() || `Campanha ${new Date().toLocaleString('pt-BR')}`,
        message_template: form.message,
        sim_slot_preference: form.simMode === 'alternate' ? null : Number(form.simMode),
        target_device_id: form.deviceMode === 'all' ? null : form.deviceMode,
        status: startNow ? 'RUNNING' : 'DRAFT',
        interval_seconds: minI,
        scheduled_for: firstRun,
        start_hour_allowed: Number(form.start.split(':')[0]),
        end_hour_allowed: Number(form.end.split(':')[0]),
        total_contacts: rows.length,
        config: cfg,
      };

      let campaignId;
      if (editing) {
        campaignId = editing.id;
        const { error: uErr } = await supabase.from('campaigns').update(campaignData).eq('id', campaignId);
        if (uErr) throw uErr;
        await clearUnsentItems(campaignId);
      } else {
        const { data, error: cErr } = await supabase.from('campaigns')
          .insert({ ...campaignData, user_id: user.id, sent_count: 0, failed_count: 0 })
          .select('id').single();
        if (cErr) throw cErr;
        campaignId = newCampaignId = data.id;
      }

      let done = 0;
      for (let i = 0; i < scheduleRows.length; i += SCHEDULE_CHUNK) {
        const batch = scheduleRows.slice(i, i + SCHEDULE_CHUNK).map((r) => ({ ...r, campaign_id: campaignId }));
        const { error: qErr } = await supabase.from('sms_schedule').insert(batch);
        if (qErr) throw qErr;
        done += batch.length;
        setProgress({ done, total: rows.length });
      }
      for (let i = 0; i < queueRows.length; i += SCHEDULE_CHUNK) {
        const batch = queueRows.slice(i, i + SCHEDULE_CHUNK).map((r) => ({ ...r, campaign_id: campaignId }));
        const { error: qErr } = await supabase.from('sms_queue').insert(batch);
        if (qErr) throw qErr;
        done += batch.length;
        setProgress({ done, total: rows.length });
      }

      setNotice({
        ok: true,
        text: startNow
          ? 'Campanha iniciada! As mensagens foram agendadas e continuarão sendo enviadas automaticamente mesmo se você fechar esta página.'
          : `Rascunho salvo com ${rows.length} SMS. Use "Iniciar" na lista para disparar.`,
      });
      resetForm();
      setTab('campaigns');
      refreshProfile();
    } catch (err) {
      // Campanha nova que falhou no meio: desfaz para não deixar registros pela metade
      if (newCampaignId) {
        await supabase.from('sms_schedule').delete().eq('campaign_id', newCampaignId);
        await supabase.from('sms_queue').delete().eq('campaign_id', newCampaignId);
        await supabase.from('campaigns').delete().eq('id', newCampaignId);
      }
      setError(`Falha ao gerar a fila: ${err.message}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  if (loading) return <p className="text-slate-400">Carregando...</p>;

  const radio = (value, label) => (
    <label key={value} className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition ${
      recipientMode === value ? 'border-accent bg-accent/15 text-accent' : 'border-white/10 text-slate-400 hover:text-white'}`}>
      <input type="radio" className="hidden" checked={recipientMode === value} onChange={() => setRecipientMode(value)} />
      {label}
    </label>
  );

  const tabBtn = (key, label) => (
    <button type="button" onClick={() => setTab(key)}
      className={`px-4 py-2 text-sm border-b-2 -mb-px ${
        tab === key ? 'border-accent text-accent' : 'border-transparent text-slate-400 hover:text-white'}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-white">Disparar SMS</h1>

      <div className="flex gap-2 border-b border-white/5">
        {tabBtn('new', editing ? 'Editando campanha' : 'Nova campanha')}
        {tabBtn('campaigns', 'Minhas campanhas')}
      </div>

      {tab === 'campaigns' && (
        <CampaignList userId={user.id} onEdit={openCampaign} notice={notice} />
      )}

      {tab === 'new' && (
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          {editing && (
            <div className="card flex items-center justify-between text-sm">
              <span>Editando: <b className="text-white">{editing.title}</b>. Ao salvar, a fila não enviada será regerada.</span>
              <button type="button" className="btn-ghost" onClick={resetForm}><X size={14} /> Cancelar edição</button>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {/* Destinatários */}
              <section className="card space-y-4">
                <h3 className="flex items-center gap-2 font-semibold text-white"><Users size={16} className="text-accent" /> Destinatários</h3>
                <div className="flex flex-wrap gap-2">
                  {radio('all', 'Todos os ativos')}
                  {radio('groups', 'Por grupo/tag')}
                  {radio('tipos', 'Por tipo/origem')}
                  {radio('contacts', 'Escolher contatos')}
                  {radio('manual', 'Envio avulso')}
                </div>

                {recipientMode === 'tipos' && (
                  <div className="flex flex-wrap gap-2">
                    {usedTipos.map((t) => (
                      <button key={t} type="button" onClick={() => toggleTipo(t)}
                        className={`badge border px-3 py-1 ${selectedTipos.includes(t)
                          ? 'border-accent bg-accent/15 text-accent' : 'border-white/10 text-slate-400 hover:text-white'}`}>
                        {t}
                      </button>
                    ))}
                    {!usedTipos.length && <p className="text-sm text-slate-500">Nenhum contato com tipo definido.</p>}
                  </div>
                )}

                {recipientMode === 'manual' && (
                  <div className="space-y-2">
                    <textarea rows={4} className="input resize-none font-mono" value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder="34999999999, 34988888888 (separe por vírgula ou quebra de linha)" />
                    <p className="text-xs text-slate-500">
                      Números com 10 ou 11 dígitos recebem o DDI 55. {manual.list.length} válido(s)
                      {manual.invalid > 0 && `, ${manual.invalid} inválido(s)`}. Não precisam estar cadastrados em Contatos.
                    </p>
                  </div>
                )}

                {recipientMode === 'groups' && (
                  <div className="flex flex-wrap gap-2">
                    {selectableGroups.map((g) => (
                      <button key={g.id} type="button" onClick={() => toggleGroup(g.id)}
                        className={`badge border px-3 py-1 ${selectedGroups.includes(g.id)
                          ? 'border-accent bg-accent/15 text-accent' : 'border-white/10 text-slate-400 hover:text-white'}`}>
                        {g.name}
                      </button>
                    ))}
                    <p className="w-full text-xs text-slate-500">Contatos marcados com "Todas" entram em qualquer grupo.</p>
                  </div>
                )}

                {recipientMode === 'contacts' && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <input className="input flex-1 min-w-[12rem]" placeholder="Buscar por nome ou telefone..."
                        value={search} onChange={(e) => { setSearch(e.target.value); setContactPage(1); }} />
                      <button type="button" className="btn-ghost" onClick={markFiltered}>Marcar filtrados</button>
                      <button type="button" className="btn-ghost" onClick={() => setSelectedContacts([])}>Limpar</button>
                    </div>
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5">
                      {visibleContacts.map((c) => (
                        <label key={c.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${
                          c.opted_out ? 'opacity-50' : 'cursor-pointer hover:bg-white/5'}`}>
                          <input type="checkbox" className="accent-accent" disabled={c.opted_out}
                            checked={selectedContacts.includes(c.id)} onChange={() => toggleContact(c.id)} />
                          <span className="flex-1">{c.name || 'Sem nome'}
                            {c.opted_out && <span className="ml-2 text-xs text-danger">(opt-out)</span>}</span>
                          <span className="font-mono text-slate-400">{c.phone}</span>
                        </label>
                      ))}
                      {!filteredContacts.length && <p className="p-3 text-sm text-slate-500">Nenhum contato encontrado.</p>}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span>Mostrando {visibleContacts.length} de {filteredContacts.length} contatos</span>
                      <div className="flex items-center gap-2">
                        <select className="input w-auto py-1 text-xs" value={contactPageSize}
                          onChange={(e) => { setContactPageSize(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)); setContactPage(1); }}>
                          {[50, 100, 250, 'ALL'].map((n) => (
                            <option key={n} value={n}>{n === 'ALL' ? 'Mostrar todos' : `${n} por página`}</option>
                          ))}
                        </select>
                        {!contactAll && contactPages > 1 && (
                          <>
                            <button type="button" className="btn-ghost px-2" disabled={contactPageSafe === 1}
                              onClick={() => setContactPage(contactPageSafe - 1)}>&lt;</button>
                            <span>Página {contactPageSafe} de {contactPages}</span>
                            <button type="button" className="btn-ghost px-2" disabled={contactPageSafe === contactPages}
                              onClick={() => setContactPage(contactPageSafe + 1)}>&gt;</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="badge bg-success/15 text-success">{recipients.length} selecionado(s)</span>
                  <span className={`badge ${excluded ? 'bg-danger/15 text-danger' : 'bg-white/5 text-slate-400'}`}>
                    {excluded} excluído(s) por opt-out
                  </span>
                </div>
              </section>

              {/* Roteamento */}
              <section className="card space-y-4">
                <h3 className="flex items-center gap-2 font-semibold text-white"><Smartphone size={16} className="text-accent" /> Aparelhos e chips</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Aparelho emissor</label>
                    <select className="input" value={form.deviceMode} onChange={set('deviceMode')}>
                      <option value="all">Distribuir entre todos os aparelhos cadastrados ({devices.length})</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}{isDeviceOnline(d) ? '' : ' (offline)'}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Chip</label>
                    <select className="input" value={form.simMode} onChange={set('simMode')}>
                      <option value="alternate">Alternar entre SIM 1 e SIM 2</option>
                      <option value="0">Apenas SIM 1</option>
                      <option value="1">Apenas SIM 2</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-slate-500">{channels.length} canal(is) em Round-Robin (aparelho × chip).</p>
              </section>

              {/* Mensagem */}
              <section className="card space-y-3">
                <div>
                  <label className="label">Título da campanha</label>
                  <input className="input" value={form.title} onChange={set('title')} placeholder="Ex.: Promoção de outubro" />
                </div>
                <div>
                  <label className="label">Mensagem</label>
                  <textarea rows={6} className="input resize-none" value={form.message} onChange={set('message')}
                    placeholder="Digite a mensagem. Use {nome} se quiser personalizar." />
                  <div className="mt-1 flex flex-wrap items-center justify-between text-xs text-slate-400">
                    <span>
                      Opcional: <button type="button" className="text-accent"
                        onClick={() => setForm({ ...form, message: form.message + '{nome}' })}>{'{nome}'}</button> insere o primeiro nome do contato.
                    </span>
                    <span className={info.parts > 1 ? 'text-yellow-400' : ''}>
                      {info.parts > 1
                        ? `${info.len} / ${info.limit} caracteres - ${info.parts} partes`
                        : `${info.len} / ${info.limit} caracteres úteis (${Math.max(info.parts, 1)} parte)`}
                      {info.unicode && ' · Unicode'}
                    </span>
                  </div>
                  {form.humanize && (
                    <p className="mt-1 text-xs text-slate-500">
                      Margem de {SUFFIX_MARGIN} caracteres reservada automaticamente para o código de segurança anti-filtro.
                    </p>
                  )}
                  {info.unicode && (
                    <p className="mt-1 text-xs text-yellow-400">
                      A mensagem tem acentos ou caracteres especiais (ex.: á, ã, ç): o limite por parte cai para 70 caracteres.
                    </p>
                  )}
                  {form.message && (
                    <div className="mt-2 rounded-lg bg-bg p-3 text-xs">
                      <div className="mb-1 flex items-center justify-between text-slate-500">
                        <span>Prévia da mensagem (como chega no aparelho)</span>
                        {form.humanize && (
                          <button type="button" className="text-accent hover:underline" onClick={() => setPreviewSeed((n) => n + 1)}>
                            gerar outro código
                          </button>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap break-words font-mono text-slate-200">{preview}</p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Painel lateral */}
            <div className="space-y-6">
              <section className="card space-y-4">
                <h3 className="flex items-center gap-2 font-semibold text-white"><ShieldCheck size={16} className="text-accent" /> Anti-bloqueio</h3>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 accent-accent" checked={form.humanize} onChange={set('humanize')} />
                  <div>
                    <div>Código anti-filtro</div>
                    <div className="text-xs text-slate-500">Cada SMS recebe espaçamento aleatório e 3 letras (maiúsculas/minúsculas) no final.</div>
                  </div>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Intervalo mín. (s)</label>
                    <input type="number" min={planMin || 1} className="input" value={form.minInterval} onChange={set('minInterval')} />
                  </div>
                  <div>
                    <label className="label">Intervalo máx. (s)</label>
                    <input type="number" min={1} className="input" value={form.maxInterval} onChange={set('maxInterval')} />
                  </div>
                </div>
                <p className="text-xs text-slate-500">Cada envio espera um tempo aleatório entre o mínimo e o máximo{planMin ? ` (mínimo do plano: ${planMin}s)` : ''}.</p>

                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label flex items-center gap-1"><Clock size={12} /> Início</label>
                    <input type="time" className="input" value={form.start} onChange={set('start')} /></div>
                  <div><label className="label">Fim</label>
                    <input type="time" className="input" value={form.end} onChange={set('end')} /></div>
                </div>
                <p className="text-xs text-slate-500">Envios fora da janela ou dos dias marcados vão para o início do próximo dia válido.</p>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="accent-accent" checked={form.scheduleStart} onChange={set('scheduleStart')} />
                    Agendar início do disparo
                  </label>
                  {form.scheduleStart && (
                    <input type="datetime-local" className="input" value={form.startAt} onChange={set('startAt')} />
                  )}
                </div>

                <div>
                  <label className="label">Dias de envio</label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map(([label, d]) => (
                      <label key={d} className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs transition ${
                        form.days.includes(d) ? 'border-accent bg-accent/15 text-accent' : 'border-white/10 text-slate-400 hover:text-white'}`}>
                        <input type="checkbox" className="hidden" checked={form.days.includes(d)}
                          onChange={() => setForm({ ...form, days: form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d] })} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Limite diário por chip</label>
                  <input type="number" min={1} className="input" value={form.dailyLimit} onChange={set('dailyLimit')} />
                  {perDay > 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      Pelo intervalo e janela, cada chip envia ~{perDay} SMS/dia (1 a cada {Math.round((minI + maxI) / 2)}s).
                      Efetivo: <b className="text-slate-300">{effectivePerDay}</b>/chip/dia × {channels.length} chip(s) = <b className="text-slate-300">{effectivePerDay * channels.length}</b>/dia
                      {effectivePerDay * channels.length > 0 && recipients.length > 0
                        ? ` · ~${Math.ceil(recipients.length / (effectivePerDay * channels.length))} dia(s) de envio`
                        : ''}.
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">Cada chip tem sua própria contagem de intervalo: com N chips, N mensagens saem em paralelo (uma por chip).</p>
                </div>
              </section>

              <section className="card space-y-3">
                {errors.map((m) => (
                  <p key={m} className="flex gap-2 text-sm text-danger"><AlertTriangle size={16} className="shrink-0" />{m}</p>
                ))}
                {warnings.map((m) => (
                  <p key={m} className="flex gap-2 text-sm text-yellow-400"><AlertTriangle size={16} className="shrink-0" />{m}</p>
                ))}

                {busy && progress && (
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-slate-400">
                      <span>Gravando na fila...</span><span>{progress.done}/{progress.total}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-bg">
                      <div className="h-full bg-accent transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                    </div>
                  </div>
                )}

                <button type="button" className="btn-ghost w-full" disabled={busy || errors.length > 0} onClick={() => save(false)}>
                  <Save size={16} /> Gerar fila e salvar como rascunho
                </button>
                <button type="button" className="btn-primary w-full" disabled={busy || errors.length > 0} onClick={() => save(true)}>
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {busy ? 'Processando...' : `Gerar fila e iniciar (${recipients.length})`}
                </button>

                {error && <p className="flex gap-2 text-sm text-danger"><AlertTriangle size={16} className="shrink-0" />{error}</p>}
              </section>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
