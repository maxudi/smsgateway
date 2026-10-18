import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Flame, MessageCircle, Plus, Play, CheckCircle2, AlertTriangle,
  Trash2, Sparkles, ArrowLeftRight, Settings2, Eye, X, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  DEFAULT_WARMUP_DIALOGUES,
  getActiveConfiguredChips,
  buildChipPairs,
  buildWarmupScheduleRows,
} from '../lib/warmupDialogues.js';

const LOCAL_SETTINGS_KEY = 'smsmax_warmup_settings_v1';
const LOCAL_CUSTOM_DIALOGUES_KEY = 'smsmax_warmup_custom_dialogues_v1';

function loadLocalSettings(userId) {
  try {
    const raw = localStorage.getItem(`${LOCAL_SETTINGS_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : { is_enabled: false, dialogues_per_pair: 3, last_generated_date: null };
  } catch {
    return { is_enabled: false, dialogues_per_pair: 3, last_generated_date: null };
  }
}

function saveLocalSettings(userId, data) {
  try {
    localStorage.setItem(`${LOCAL_SETTINGS_KEY}_${userId}`, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function loadLocalCustomDialogues(userId) {
  try {
    const raw = localStorage.getItem(`${LOCAL_CUSTOM_DIALOGUES_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCustomDialogues(userId, list) {
  try {
    localStorage.setItem(`${LOCAL_CUSTOM_DIALOGUES_KEY}_${userId}`, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export default function ChipWarmupPanel({ userId, devices = [], singleSimOnly = false }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [dialoguesPerPair, setDialoguesPerPair] = useState(3);
  const [lastGeneratedDate, setLastGeneratedDate] = useState(null);
  const [customDialogues, setCustomDialogues] = useState([]);
  const [pendingWarmupCount, setPendingWarmupCount] = useState(0);

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState('');

  // Modal de gerenciamento / adição de diálogos
  const [modalOpen, setModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Cotidiano');
  const [newLinesText, setNewLinesText] = useState(
    'Oi tudo bem?\nTudo e vc?\nTambem estou bem. Voce vai na festa?\nVou sim e voce?\nVou tambem, a gente se encontra la.'
  );
  const [savingDialogue, setSavingDialogue] = useState(false);

  const configuredChips = useMemo(
    () => getActiveConfiguredChips(devices, singleSimOnly),
    [devices, singleSimOnly]
  );

  const chipPairs = useMemo(
    () => buildChipPairs(configuredChips),
    [configuredChips]
  );

  const allDialogues = useMemo(
    () => [...customDialogues, ...DEFAULT_WARMUP_DIALOGUES],
    [customDialogues]
  );

  const canEnable = configuredChips.length >= 2;

  const loadWarmupState = useCallback(async () => {
    if (!userId) return;

    // 1. Carrega estado local imediatamente
    const localCfg = loadLocalSettings(userId);
    setIsEnabled(Boolean(localCfg.is_enabled));
    setDialoguesPerPair(Number(localCfg.dialogues_per_pair) || 3);
    setLastGeneratedDate(localCfg.last_generated_date || null);
    setCustomDialogues(loadLocalCustomDialogues(userId));

    // 2. Tenta sincronizar com as tabelas do banco (se a migration já foi rodada)
    try {
      const [{ data: dbCfg }, { data: dbDialogues }, { count: waitingCount }] = await Promise.all([
        supabase.from('warmup_settings').select('*').eq('user_id', userId).maybeSingle(),
        supabase
          .from('warmup_dialogues')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('sms_schedule')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .is('campaign_id', null)
          .eq('status', 'WAITING'),
      ]);

      if (typeof waitingCount === 'number') {
        setPendingWarmupCount(waitingCount);
      }

      if (dbCfg) {
        setIsEnabled(Boolean(dbCfg.is_enabled));
        setDialoguesPerPair(Number(dbCfg.dialogues_per_pair) || 3);
        setLastGeneratedDate(dbCfg.last_generated_date || null);
        saveLocalSettings(userId, dbCfg);
      }

      if (Array.isArray(dbDialogues) && dbDialogues.length > 0) {
        const formatted = dbDialogues.map((d) => ({
          id: d.id,
          title: d.title,
          category: d.category || 'Personalizado',
          messages: Array.isArray(d.messages) ? d.messages : [],
          isCustom: true,
        }));
        setCustomDialogues(formatted);
        saveLocalCustomDialogues(userId, formatted);
      }
    } catch {
      // Silencioso caso a tabela ainda não exista no banco
    }
  }, [userId]);

  useEffect(() => {
    loadWarmupState();
  }, [loadWarmupState]);

  /**
   * Agenda conversas entre as duplas de chips (modo 'now' = 1 diálogo imediato por dupla;
   * modo 'daily' = N diálogos distribuídos pelo dia para cada dupla).
   */
  const scheduleDialogues = useCallback(
    async (mode = 'now', customCount = dialoguesPerPair) => {
      if (!userId || chipPairs.length === 0) return 0;

      const rows = buildWarmupScheduleRows({
        userId,
        pairs: chipPairs,
        dialogues: allDialogues,
        dialoguesPerPair: customCount,
        mode,
      });

      if (!rows.length) return 0;

      const { error: insErr } = await supabase.from('sms_schedule').insert(rows);
      if (insErr) throw insErr;

      setPendingWarmupCount((prev) => prev + rows.length);
      return rows.length;
    },
    [userId, chipPairs, allDialogues, dialoguesPerPair]
  );

  // Se o Maturador estiver ATIVO e ainda não gerou os diálogos de hoje, gera automaticamente ao abrir o painel
  useEffect(() => {
    if (!userId || !isEnabled || !canEnable) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    if (lastGeneratedDate === todayStr) return;

    let cancelled = false;
    (async () => {
      try {
        const insertedCount = await scheduleDialogues('daily', dialoguesPerPair);
        if (cancelled || !insertedCount) return;

        setLastGeneratedDate(todayStr);
        const nextCfg = {
          user_id: userId,
          is_enabled: true,
          dialogues_per_pair: dialoguesPerPair,
          last_generated_date: todayStr,
        };
        saveLocalSettings(userId, nextCfg);
        await supabase.from('warmup_settings').upsert(nextCfg, { onConflict: 'user_id' });
      } catch {
        // ignore background auto-schedule error
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, isEnabled, canEnable, lastGeneratedDate, dialoguesPerPair, scheduleDialogues]);

  const handleToggleEnabled = async () => {
    setError('');
    setFeedback(null);

    if (!canEnable) {
      setError(
        'Para ativar a conversa entre chips, preencha o número de telefone (com DDD) de pelo menos 2 chips ativos nos cartões de aparelhos abaixo.'
      );
      return;
    }

    const nextEnabled = !isEnabled;
    const todayStr = new Date().toISOString().slice(0, 10);
    setBusy(true);

    try {
      let scheduledMessages = 0;
      let nextGenDate = lastGeneratedDate;

      // Ao ativar pela primeira vez no dia, já agenda os 3+ diálogos do dia para cada dupla
      if (nextEnabled && lastGeneratedDate !== todayStr) {
        scheduledMessages = await scheduleDialogues('daily', dialoguesPerPair);
        nextGenDate = todayStr;
        setLastGeneratedDate(todayStr);
      }

      // Se desativar, cancela conversas de maturação pendentes (campaign_id IS NULL)
      if (!nextEnabled) {
        await supabase
          .from('sms_schedule')
          .update({ status: 'CANCELLED' })
          .eq('user_id', userId)
          .is('campaign_id', null)
          .eq('status', 'WAITING');
        setPendingWarmupCount(0);
      }

      setIsEnabled(nextEnabled);
      const payload = {
        user_id: userId,
        is_enabled: nextEnabled,
        dialogues_per_pair: dialoguesPerPair,
        last_generated_date: nextGenDate,
        updated_at: new Date().toISOString(),
      };
      saveLocalSettings(userId, payload);
      await supabase.from('warmup_settings').upsert(payload, { onConflict: 'user_id' });

      if (nextEnabled) {
        setFeedback(
          scheduledMessages > 0
            ? `Maturador ativado! Foram agendados ${dialoguesPerPair} diálogos de hoje para cada dupla (${scheduledMessages} mensagens de ida e volta programadas).`
            : `Maturador ativado! Cada dupla de chips trocará ${dialoguesPerPair} diálogos por dia automaticamente.`
        );
      } else {
        setFeedback('Maturador entre chips pausado e agendamentos pendentes cancelados.');
      }
    } catch (err) {
      setError(err?.message || 'Não foi possível alterar o status do maturador de chips.');
    } finally {
      setBusy(false);
    }
  };

  const handleChangeCount = async (nextVal) => {
    const val = Math.max(1, Math.min(20, Number(nextVal) || 3));
    setDialoguesPerPair(val);
    const payload = {
      user_id: userId,
      is_enabled: isEnabled,
      dialogues_per_pair: val,
      last_generated_date: lastGeneratedDate,
      updated_at: new Date().toISOString(),
    };
    saveLocalSettings(userId, payload);
    try {
      await supabase.from('warmup_settings').upsert(payload, { onConflict: 'user_id' });
    } catch {
      // ignore
    }
  };

  const handleRunOneNow = async () => {
    setError('');
    setFeedback(null);
    if (!canEnable) {
      setError('Preencha o número de telefone de pelo menos 2 chips nos aparelhos abaixo antes de iniciar um diálogo.');
      return;
    }

    setBusy(true);
    try {
      const totalMsgs = await scheduleDialogues('now', 1);
      setFeedback(
        `1 diálogo iniciado agora para ${chipPairs.length} dupla(s) (${totalMsgs} mensagens programadas com intervalo humano de 1,5 a 3,5 min entre envio e resposta)!`
      );
    } catch (err) {
      setError(err?.message || 'Falha ao iniciar diálogo imediato.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddDialogue = async (e) => {
    e.preventDefault();
    setError('');
    const cleanLines = newLinesText
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*\d+\s*[-.)]\s*/, '').trim())
      .filter(Boolean);

    if (cleanLines.length < 2) {
      setError('O diálogo precisa ter pelo menos 2 linhas (envio do Chip 1 e resposta do Chip 2).');
      return;
    }

    setSavingDialogue(true);
    try {
      const title = newTitle.trim() || `Diálogo Personalizado #${customDialogues.length + 1}`;
      const category = newCategory.trim() || 'Personalizado';
      let newItem = {
        id: `custom-${Date.now()}`,
        title,
        category,
        messages: cleanLines,
        isCustom: true,
      };

      const { data: inserted } = await supabase
        .from('warmup_dialogues')
        .insert({
          user_id: userId,
          title,
          category,
          messages: cleanLines,
        })
        .select('*')
        .maybeSingle();

      if (inserted?.id) {
        newItem = {
          id: inserted.id,
          title: inserted.title,
          category: inserted.category || category,
          messages: inserted.messages,
          isCustom: true,
        };
      }

      const nextList = [newItem, ...customDialogues];
      setCustomDialogues(nextList);
      saveLocalCustomDialogues(userId, nextList);
      setNewTitle('');
      setNewLinesText('');
    } catch (err) {
      setError(err?.message || 'Erro ao salvar novo diálogo.');
    } finally {
      setSavingDialogue(false);
    }
  };

  const handleDeleteCustomDialogue = async (id) => {
    const nextList = customDialogues.filter((d) => d.id !== id);
    setCustomDialogues(nextList);
    saveLocalCustomDialogues(userId, nextList);
    try {
      await supabase.from('warmup_dialogues').delete().eq('id', id).eq('user_id', userId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="card border border-accent/25 bg-gradient-to-br from-surface via-surface to-accent/5 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition ${
              isEnabled
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-accent/15 border-accent/30 text-accent'
            }`}
          >
            <Flame size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white">
                Maturador / Conversa entre Chips (Aquecimento Bidirecional)
              </h2>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                  isEnabled
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                    : 'bg-white/5 text-slate-400 border-white/10'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                {isEnabled ? 'Ativo' : 'Desativado'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Faz os seus próprios chips conversarem entre si com diálogos naturais de envio e resposta (ex: Chip 1 manda pergunta → Chip 2 responde 2 minutos depois). Isso gera tráfego bidirecional humano e eleva a reputação do chip nas operadoras.
            </p>
          </div>
        </div>

        {/* Controles principais */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-bg/70 px-3 py-1.5 text-xs text-slate-300">
            <Settings2 size={13} className="text-accent" />
            <span>Diálogos/dia por dupla:</span>
            <select
              className="bg-transparent font-bold text-accent focus:outline-none cursor-pointer"
              value={dialoguesPerPair}
              onChange={(e) => handleChangeCount(e.target.value)}
            >
              <option value={3} className="bg-surface text-white">3 diálogos/dia</option>
              <option value={5} className="bg-surface text-white">5 diálogos/dia</option>
              <option value={8} className="bg-surface text-white">8 diálogos/dia</option>
              <option value={10} className="bg-surface text-white">10 diálogos/dia</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="btn-ghost text-xs border border-white/10 hover:border-accent/40"
          >
            <MessageCircle size={14} className="text-accent" />
            <span>Diálogos ({allDialogues.length})</span>
          </button>

          <button
            type="button"
            disabled={busy || !canEnable}
            onClick={handleRunOneNow}
            className="btn-ghost text-xs border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40"
            title="Sorteia e inicia 1 diálogo agora mesmo entre cada dupla de chips"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            <span>Testar 1 Diálogo Agora</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={handleToggleEnabled}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-lg ${
              isEnabled
                ? 'bg-emerald-500 text-bg hover:bg-emerald-400 shadow-emerald-500/20'
                : 'bg-accent text-bg hover:bg-accent/90 shadow-accent/20'
            }`}
          >
            <Flame size={15} />
            <span>{isEnabled ? 'Maturador Ativado (Pausar)' : 'Ativar Conversa entre Chips'}</span>
          </button>
        </div>
      </div>

      {/* Status das Duplas de Chips */}
      <div className="rounded-xl border border-white/10 bg-bg/60 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <ArrowLeftRight size={14} className="text-accent" />
            <span>
              Chips com número configurado:{' '}
              <b className="text-white">{configuredChips.length}</b> · Duplas formadas:{' '}
              <b className="text-accent">{chipPairs.length}</b>
            </span>
          </div>
          {pendingWarmupCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              <Sparkles size={12} />
              {pendingWarmupCount} mensagens de diálogo programadas na agenda
            </span>
          )}
        </div>

        {!canEnable ? (
          <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <AlertTriangle size={14} className="shrink-0 text-amber-400" />
            <span>
              Você tem <b>{configuredChips.length}</b> chip(s) com número preenchido. Informe o <b>Número do SIM</b> em pelo menos <b>2 chips ativos</b> nos cartões abaixo (ex: SIM 1 e SIM 2 do mesmo aparelho, ou SIM 1 de dois aparelhos diferentes) para liberar a conversa automática!
            </span>
          </div>
        ) : (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {chipPairs.map(([a, b], idx) => (
              <div
                key={`${a.key}-${b.key}-${idx}`}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-xs text-slate-200"
              >
                <span className="font-semibold text-accent">Dupla #{idx + 1}:</span>
                <span>
                  {a.deviceName} (SIM {a.simSlot + 1}: <code className="text-slate-300">+{a.phone}</code>)
                </span>
                <ArrowLeftRight size={12} className="text-emerald-400" />
                <span>
                  {b.deviceName} (SIM {b.simSlot + 1}: <code className="text-slate-300">+{b.phone}</code>)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          <AlertTriangle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          <CheckCircle2 size={14} className="shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Modal de Biblioteca de Diálogos (35+ prontos + Criar novos) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="card relative w-full max-w-4xl max-h-[90vh] flex flex-col border border-accent/30 bg-surface p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <MessageCircle size={20} className="text-accent" />
                  Biblioteca de Diálogos entre Chips ({allDialogues.length} cadastrados)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  O sistema sorteia diálogos desta lista para cada dupla de chips. Linhas ímpares (1, 3, 5) saem do Chip 1 e linhas pares (2, 4, 6) são respondidas pelo Chip 2.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-12 mt-4 overflow-y-auto pr-1">
              {/* Formulário para adicionar novo diálogo */}
              <form onSubmit={handleAddDialogue} className="lg:col-span-5 space-y-3 rounded-xl border border-white/10 bg-bg/60 p-4 h-fit">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Plus size={16} className="text-accent" />
                  Adicionar Novo Diálogo
                </div>

                <div>
                  <label className="label text-xs">Título do diálogo</label>
                  <input
                    className="input text-xs"
                    placeholder="Ex: Encontro na festa"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label text-xs">Categoria</label>
                  <input
                    className="input text-xs"
                    placeholder="Ex: Social, Trabalho, Família..."
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label text-xs">
                    Falas do diálogo (1 fala por linha — alterna Chip 1 e Chip 2)
                  </label>
                  <textarea
                    rows={6}
                    className="input text-xs font-mono leading-relaxed"
                    placeholder={
                      '1- Oi tudo bem?\n2- Tudo e vc?\n1- Tambem estou bem. Voce vai na festa?\n2- Vou sim e voce?\n1- Vou tambem a gente se encontra la.'
                    }
                    value={newLinesText}
                    onChange={(e) => setNewLinesText(e.target.value)}
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Você pode colar com ou sem numeração no início (`1-`, `2-`), o sistema limpa automaticamente.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={savingDialogue}
                  className="btn-primary w-full text-xs py-2.5"
                >
                  <Plus size={14} />
                  {savingDialogue ? 'Salvando...' : 'Salvar Diálogo na Biblioteca'}
                </button>
              </form>

              {/* Lista dos 35+ diálogos */}
              <div className="lg:col-span-7 space-y-2.5 max-h-[62vh] overflow-y-auto pr-1">
                {allDialogues.map((d, idx) => (
                  <div
                    key={d.id || idx}
                    className="rounded-xl border border-white/10 bg-bg/50 p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-accent/15 border border-accent/30 px-2 py-0.5 text-[10px] font-bold text-accent">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-bold text-white">{d.title}</span>
                        <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                          {d.category || 'Cotidiano'}
                        </span>
                      </div>
                      {d.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomDialogue(d.id)}
                          className="text-danger hover:bg-danger/15 p-1 rounded transition"
                          title="Excluir diálogo personalizado"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    <div className="space-y-1 pl-1">
                      {(d.messages || []).map((line, lineIdx) => {
                        const isChip1 = lineIdx % 2 === 0;
                        return (
                          <div key={lineIdx} className="flex items-start gap-2 text-xs">
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold ${
                                isChip1
                                  ? 'bg-accent/15 text-accent'
                                  : 'bg-emerald-500/15 text-emerald-300'
                              }`}
                            >
                              {isChip1 ? 'Chip 1 → 2' : 'Chip 2 → 1'}
                            </span>
                            <span className="text-slate-200">{line}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

