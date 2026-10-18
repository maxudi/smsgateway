import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Inbox as InboxIcon, Star, Reply, Trash2, Search, Smartphone,
  Copy, Check, RefreshCw, MessageSquare, Layers, AlertTriangle,
  Lock, Unlock, ShieldAlert
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useDevices } from '../hooks/useDevices.js';
import QuickTestSmsModal from '../components/QuickTestSmsModal.jsx';

const STARRED_STORAGE_KEY = 'smsmax_starred_inbound_ids';

function getLocalStarredSet() {
  try {
    const raw = localStorage.getItem(STARRED_STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveLocalStarredSet(set) {
  try {
    localStorage.setItem(STARRED_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export default function Inbox() {
  const { user, plan, tenant, isMaster, refreshProfile } = useAuth();
  const { lang } = useLanguage();
  const isPt = lang === 'pt';

  const { devices } = useDevices(user?.id);
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'paused' | 'starred'
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  const [togglingPhone, setTogglingPhone] = useState(null);
  const [error, setError] = useState('');
  const [localStarred, setLocalStarred] = useState(() => getLocalStarredSet());

  const maxSimSlots = isMaster ? 2 : Number(plan?.max_sim_slots ?? tenant?.max_sim_slots ?? 1);
  const singleSimOnly = !isMaster && maxSimSlots <= 1;

  const deviceMap = useMemo(() => {
    const m = new Map();
    devices.forEach((d) => m.set(d.id, d.name || d.id));
    return m;
  }, [devices]);

  // Mapa de telefone (últimos 10/11 dígitos ou completo) -> Objeto completo do contato
  const contactByPhone = useMemo(() => {
    const m = new Map();
    contacts.forEach((c) => {
      if (!c.phone) return;
      const digits = String(c.phone).replace(/\D/g, '');
      if (!digits) return;
      m.set(digits, c);
      if (digits.length >= 11) m.set(digits.slice(-11), c);
      if (digits.length >= 10) m.set(digits.slice(-10), c);
    });
    return m;
  }, [contacts]);

  const resolveContact = useCallback(
    (senderPhone) => {
      const digits = String(senderPhone || '').replace(/\D/g, '');
      if (!digits) return null;
      return (
        contactByPhone.get(digits) ||
        (digits.length >= 11 ? contactByPhone.get(digits.slice(-11)) : null) ||
        (digits.length >= 10 ? contactByPhone.get(digits.slice(-10)) : null) ||
        null
      );
    },
    [contactByPhone]
  );

  const load = useCallback(async () => {
    if (!user?.id) return;
    setError('');
    try {
      const [{ data: userDevs }, { data: contactRows }] = await Promise.all([
        supabase.from('devices').select('id').eq('user_id', user.id),
        supabase
          .from('contacts')
          .select('id, name, phone, opted_out, opted_out_at')
          .eq('user_id', user.id)
          .limit(3000),
      ]);

      if (contactRows) setContacts(contactRows);

      const devIds = (userDevs ?? []).map((d) => d.id);
      if (!devIds.length) {
        setMessages([]);
        setLoading(false);
        return;
      }

      const { data, error: inbErr } = await supabase
        .from('sms_inbound')
        .select('*')
        .in('device_id', devIds)
        .order('received_at', { ascending: false })
        .limit(300);

      if (inbErr) throw inbErr;
      setMessages(data ?? []);
    } catch (err) {
      setError(err?.message || (isPt ? 'Erro ao carregar mensagens recebidas.' : 'Failed to load received messages.'));
    } finally {
      setLoading(false);
    }
  }, [user?.id, isPt]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('inbox-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sms_inbound' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, load)
      .subscribe();
    const timer = setInterval(load, 10000);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const isRowStarred = useCallback(
    (row) => Boolean(row.is_starred) || localStarred.has(row.id),
    [localStarred]
  );

  const toggleStar = async (row) => {
    const nextVal = !isRowStarred(row);

    // Atualiza estado local imediatamente (UI otimista + fallback localStorage)
    setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, is_starred: nextVal } : m)));
    setLocalStarred((prev) => {
      const next = new Set(prev);
      if (nextVal) next.add(row.id);
      else next.delete(row.id);
      saveLocalStarredSet(next);
      return next;
    });

    // Persiste no banco caso a coluna is_starred já exista
    await supabase.from('sms_inbound').update({ is_starred: nextVal }).eq('id', row.id);
  };

  /**
   * Alterna o bloqueio/pausa de campanhas para o remetente com 1 clique direto na Inbox.
   * - Se estiver pausado (opted_out = true) -> Desbloqueia (opted_out = false) e limpa needs_review.
   * - Se estiver liberado -> Bloqueia (opted_out = true) e cancela envios de campanha pendentes.
   */
  const toggleCampaignBlock = async (row, forceUnlock = null) => {
    if (!user?.id) return;
    const rawDigits = String(row.sender_phone || '').replace(/\D/g, '');
    if (!rawDigits) return;

    const existingContact = resolveContact(row.sender_phone);
    const currentlyBlocked = Boolean(existingContact?.opted_out);
    const nextBlocked = forceUnlock !== null ? !forceUnlock : !currentlyBlocked;

    setTogglingPhone(row.id);
    setError('');
    try {
      if (existingContact?.id) {
        const { error: upErr } = await supabase
          .from('contacts')
          .update({
            opted_out: nextBlocked,
            opted_out_at: nextBlocked ? new Date().toISOString() : null,
          })
          .eq('id', existingContact.id)
          .eq('user_id', user.id);

        if (upErr) throw upErr;

        setContacts((prev) =>
          prev.map((c) =>
            c.id === existingContact.id
              ? { ...c, opted_out: nextBlocked, opted_out_at: nextBlocked ? new Date().toISOString() : null }
              : c
          )
        );
      } else if (nextBlocked) {
        // Caso o número tenha vindo de disparo avulso/manual e ainda não esteja na agenda,
        // cria o registro marcado como opted_out para impedir futuras campanhas para ele
        const normalizedPhone = rawDigits.startsWith('55') && rawDigits.length >= 12 ? rawDigits.slice(2) : rawDigits;
        const { data: inserted, error: insErr } = await supabase
          .from('contacts')
          .insert({
            user_id: user.id,
            name: `Contato (${row.sender_phone})`,
            phone: normalizedPhone,
            opted_out: true,
            opted_out_at: new Date().toISOString(),
          })
          .select('id, name, phone, opted_out, opted_out_at')
          .single();

        if (insErr) throw insErr;
        if (inserted) setContacts((prev) => [inserted, ...prev]);
      }

      // Atualiza flag needs_review na mensagem recebida (se desbloqueou, já foi avaliada)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === row.id ? { ...m, needs_review: nextBlocked } : m
        )
      );
      await supabase
        .from('sms_inbound')
        .update({ needs_review: nextBlocked })
        .eq('id', row.id);
    } catch (err) {
      setError(err?.message || (isPt ? 'Não foi possível alterar o status do contato.' : 'Failed to update contact status.'));
    } finally {
      setTogglingPhone(null);
    }
  };

  const deleteOne = async (id) => {
    const confirmMsg = isPt
      ? 'Deseja excluir esta mensagem recebida?'
      : 'Delete this received message?';
    if (!window.confirm(confirmMsg)) return;

    setMessages((prev) => prev.filter((m) => m.id !== id));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    const { error: delErr } = await supabase.from('sms_inbound').delete().eq('id', id);
    if (delErr) {
      setError(delErr.message);
      load();
    }
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) return;
    const confirmMsg = isPt
      ? `Deseja excluir as ${selectedIds.length} mensagens selecionadas?`
      : `Delete ${selectedIds.length} selected messages?`;
    if (!window.confirm(confirmMsg)) return;

    const idsToDelete = [...selectedIds];
    setMessages((prev) => prev.filter((m) => !idsToDelete.includes(m.id)));
    setSelectedIds([]);
    const { error: delErr } = await supabase.from('sms_inbound').delete().in('id', idsToDelete);
    if (delErr) {
      setError(delErr.message);
      load();
    }
  };

  const copyMessage = async (row) => {
    try {
      await navigator.clipboard.writeText(row.message || '');
      setCopiedId(row.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  const isRowPausedOrReview = useCallback(
    (row) => {
      const c = resolveContact(row.sender_phone);
      return Boolean(c?.opted_out || row.needs_review);
    },
    [resolveContact]
  );

  const filteredMessages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((m) => {
      if (filterTab === 'starred' && !isRowStarred(m)) return false;
      if (filterTab === 'paused' && !isRowPausedOrReview(m)) return false;
      if (deviceFilter !== 'all' && m.device_id !== deviceFilter) return false;
      if (q) {
        const contact = resolveContact(m.sender_phone);
        const contactName = contact?.name || '';
        const hay = `${m.sender_phone || ''} ${contactName} ${m.message || ''} ${deviceMap.get(m.device_id) || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [messages, filterTab, deviceFilter, search, isRowStarred, isRowPausedOrReview, resolveContact, deviceMap]);

  const starredCount = useMemo(
    () => messages.filter((m) => isRowStarred(m)).length,
    [messages, isRowStarred]
  );

  const pausedCount = useMemo(
    () => messages.filter((m) => isRowPausedOrReview(m)).length,
    [messages, isRowPausedOrReview]
  );

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredMessages.length && filteredMessages.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMessages.map((m) => m.id));
    }
  };

  const toggleSelectRow = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <InboxIcon size={24} className="text-accent" />
            {isPt ? 'Mensagens Recebidas (Inbox)' : 'Received Messages (Inbox)'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isPt
              ? 'Quando um contato responde a uma campanha, ele é pausado preventivamente para novos disparos em massa até você avaliar ou responder aqui.'
              : 'When a contact replies to a campaign, they are preventively paused from bulk campaigns until you review or unlock them here.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={deleteSelected}
              className="btn-ghost text-xs border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20"
            >
              <Trash2 size={14} />
              {isPt ? `Excluir selecionadas (${selectedIds.length})` : `Delete selected (${selectedIds.length})`}
            </button>
          )}
          <button
            type="button"
            onClick={load}
            className="btn-ghost text-xs border border-white/10"
            title={isPt ? 'Atualizar lista' : 'Refresh list'}
          >
            <RefreshCw size={14} /> {isPt ? 'Atualizar' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Barra de Abas + Busca + Filtro de Aparelho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              filterTab === 'all'
                ? 'bg-accent/15 text-accent border border-accent/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquare size={14} />
            {isPt ? 'Todas' : 'All'}
            <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">
              {messages.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('paused')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              filterTab === 'paused'
                ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title={
              isPt
                ? 'Contatos que responderam e estão pausados para campanhas aguardando sua avaliação'
                : 'Contacts who replied and are paused from campaigns awaiting your review'
            }
          >
            <ShieldAlert size={14} className={filterTab === 'paused' ? 'text-orange-400' : ''} />
            {isPt ? 'Interações / Pausados' : 'Interactions / Paused'}
            <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">
              {pausedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('starred')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              filterTab === 'starred'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Star size={14} className={filterTab === 'starred' ? 'fill-amber-400 text-amber-400' : ''} />
            {isPt ? 'Importantes' : 'Important'}
            <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">
              {starredCount}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              className="input pl-8 py-1.5 text-xs"
              placeholder={isPt ? 'Buscar por número, contato ou texto...' : 'Search phone, contact or text...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="input w-auto py-1.5 text-xs"
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
          >
            <option value="all">{isPt ? 'Todos os aparelhos' : 'All devices'}</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name || d.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabela de Mensagens Recebidas */}
      <div className="card p-0 overflow-x-auto border border-white/10">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-400 border-b border-white/5 bg-bg/40">
            <tr>
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  className="accent-accent cursor-pointer"
                  checked={filteredMessages.length > 0 && selectedIds.length === filteredMessages.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="p-3 w-10 text-center" title={isPt ? 'Importante' : 'Important'}>
                <Star size={14} className="mx-auto text-slate-500" />
              </th>
              <th className="p-3">{isPt ? 'Remetente / Status' : 'Sender / Status'}</th>
              <th className="p-3">{isPt ? 'Mensagem Recebida' : 'Message'}</th>
              <th className="p-3">{isPt ? 'Aparelho / Chip' : 'Device / SIM'}</th>
              <th className="p-3">{isPt ? 'Recebido em' : 'Received At'}</th>
              <th className="p-3 text-right">{isPt ? 'Ações' : 'Actions'}</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  {isPt ? 'Carregando mensagens recebidas...' : 'Loading received messages...'}
                </td>
              </tr>
            ) : filteredMessages.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-10 text-center text-slate-500">
                  {filterTab === 'starred'
                    ? isPt
                      ? 'Nenhuma mensagem marcada como importante.'
                      : 'No messages marked as important.'
                    : filterTab === 'paused'
                      ? isPt
                        ? 'Nenhum contato pausado ou aguardando avaliação no momento.'
                        : 'No paused contacts awaiting review at the moment.'
                      : isPt
                        ? 'Nenhuma mensagem recebida até o momento.'
                        : 'No incoming messages received yet.'}
                </td>
              </tr>
            ) : (
              filteredMessages.map((row) => {
                const starred = isRowStarred(row);
                const contact = resolveContact(row.sender_phone);
                const contactName = contact?.name || null;
                const isBlocked = Boolean(contact?.opted_out);
                const needsReview = Boolean(row.needs_review || isBlocked);
                const devName = deviceMap.get(row.device_id) || row.device_id;
                const slotNum = Number(row.sim_slot ?? 0) + 1;

                return (
                  <tr
                    key={row.id}
                    className={`transition hover:bg-white/[0.03] ${
                      needsReview
                        ? 'bg-orange-500/[0.04]'
                        : starred
                          ? 'bg-amber-500/[0.04]'
                          : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-3 text-center align-top pt-4">
                      <input
                        type="checkbox"
                        className="accent-accent cursor-pointer"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleSelectRow(row.id)}
                      />
                    </td>

                    {/* Estrela de Importante */}
                    <td className="p-3 text-center align-top pt-3.5">
                      <button
                        type="button"
                        onClick={() => toggleStar(row)}
                        className={`rounded-lg p-1.5 transition ${
                          starred
                            ? 'text-amber-400 hover:bg-amber-500/15'
                            : 'text-slate-600 hover:bg-white/5 hover:text-slate-300'
                        }`}
                        title={
                          starred
                            ? isPt
                              ? 'Remover destaque importante'
                              : 'Unmark important'
                            : isPt
                              ? 'Marcar como importante'
                              : 'Mark as important'
                        }
                      >
                        <Star size={16} className={starred ? 'fill-amber-400' : ''} />
                      </button>
                    </td>

                    {/* Remetente + Status em Campanhas */}
                    <td className="p-3 align-top whitespace-nowrap">
                      {contactName && (
                        <div className="text-xs font-semibold text-white mb-0.5">
                          {contactName}
                        </div>
                      )}
                      <div className="font-mono text-xs text-accent">
                        {row.sender_phone}
                      </div>

                      {isBlocked ? (
                        <div
                          className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-orange-500/35 bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-300"
                          title={
                            isPt
                              ? 'Este número respondeu e foi pausado preventivamente para novas campanhas em massa (automações via API/n8n continuam funcionando normalmente).'
                              : 'This number replied and was preventively paused from bulk campaigns (API/n8n automations still work normally).'
                          }
                        >
                          <Lock size={10} />
                          {isPt ? 'Pausado em Campanhas' : 'Paused in Campaigns'}
                        </div>
                      ) : contact ? (
                        <div className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                          <Unlock size={10} />
                          {isPt ? 'Ativo p/ Campanhas' : 'Active for Campaigns'}
                        </div>
                      ) : null}
                    </td>

                    {/* Mensagem */}
                    <td className="p-3 align-top max-w-md">
                      <p className="text-slate-200 text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {row.message}
                      </p>
                      {isBlocked && (
                        <p className="mt-1 text-[11px] text-orange-300/80">
                          {isPt
                            ? '💬 Avalie a interação: se foi uma dúvida/conversa normal, clique em "Desbloquear" ou responda.'
                            : '💬 Review interaction: if it was a normal question, click "Unlock" or reply.'}
                        </p>
                      )}
                    </td>

                    {/* Aparelho & Chip */}
                    <td className="p-3 align-top whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        <Smartphone size={13} className="text-accent shrink-0" />
                        <span className="truncate max-w-[9rem]" title={devName}>
                          {devName}
                        </span>
                      </div>
                      <span className="mt-1 inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                        <Layers size={10} className="text-accent" /> SIM {slotNum}
                      </span>
                    </td>

                    {/* Data/Hora */}
                    <td className="p-3 align-top whitespace-nowrap text-xs text-slate-400">
                      {row.received_at
                        ? new Date(row.received_at).toLocaleString(isPt ? 'pt-BR' : 'en-US')
                        : '—'}
                    </td>

                    {/* Botões laterais de Ação */}
                    <td className="p-3 align-top whitespace-nowrap text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {/* Botão Responder */}
                        <button
                          type="button"
                          onClick={() =>
                            setReplyTarget({
                              ...row,
                              contactName,
                              contact,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/15 px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-bg transition"
                          title={isPt ? 'Responder a este SMS' : 'Reply to this SMS'}
                        >
                          <Reply size={13} />
                          <span>{isPt ? 'Responder' : 'Reply'}</span>
                        </button>

                        {/* Botão Desbloquear / Bloquear p/ Campanhas */}
                        <button
                          type="button"
                          disabled={togglingPhone === row.id}
                          onClick={() => toggleCampaignBlock(row)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                            isBlocked
                              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500 hover:text-bg'
                              : 'border-white/10 bg-white/5 text-slate-300 hover:border-orange-500/40 hover:bg-orange-500/15 hover:text-orange-300'
                          }`}
                          title={
                            isBlocked
                              ? isPt
                                ? 'Desbloquear este número para voltar a receber campanhas'
                                : 'Unlock this number to receive campaigns again'
                              : isPt
                                ? 'Bloquear/pausar este número para campanhas em massa'
                                : 'Block/pause this number from bulk campaigns'
                          }
                        >
                          {isBlocked ? <Unlock size={13} /> : <Lock size={13} />}
                          <span>
                            {isBlocked
                              ? isPt
                                ? 'Desbloquear'
                                : 'Unlock'
                              : isPt
                                ? 'Bloquear'
                                : 'Block'}
                          </span>
                        </button>

                        {/* Botão Copiar */}
                        <button
                          type="button"
                          onClick={() => copyMessage(row)}
                          className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition"
                          title={isPt ? 'Copiar texto da mensagem' : 'Copy message text'}
                        >
                          {copiedId === row.id ? (
                            <Check size={14} className="text-success" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>

                        {/* Botão Importante */}
                        <button
                          type="button"
                          onClick={() => toggleStar(row)}
                          className={`rounded-lg border p-1.5 transition ${
                            starred
                              ? 'border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                              : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-amber-300'
                          }`}
                          title={isPt ? 'Marcar/Desmarcar como importante' : 'Toggle important'}
                        >
                          <Star size={14} className={starred ? 'fill-amber-400' : ''} />
                        </button>

                        {/* Botão Excluir */}
                        <button
                          type="button"
                          onClick={() => deleteOne(row.id)}
                          className="rounded-lg border border-danger/25 bg-danger/10 p-1.5 text-danger hover:bg-danger/20 transition"
                          title={isPt ? 'Excluir mensagem' : 'Delete message'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Envio de Resposta (reutiliza QuickTestSmsModal no modo replyTo) */}
      <QuickTestSmsModal
        open={Boolean(replyTarget)}
        onClose={() => setReplyTarget(null)}
        userId={user?.id}
        devices={devices}
        singleSimOnly={singleSimOnly}
        replyTo={replyTarget}
        onUnlockContact={
          replyTarget
            ? () => toggleCampaignBlock(replyTarget, true)
            : undefined
        }
        onSent={() => {
          refreshProfile();
          load();
        }}
      />
    </div>
  );
}

