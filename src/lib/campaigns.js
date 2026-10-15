import { supabase } from './supabase';
import { buildChannels } from './devices.js';

export const BATCH_SIZE = 500;
export const SCHEDULE_CHUNK = 300;
export const DEFAULT_DAYS = [1, 2, 3, 4, 5]; // Seg a Sex (Date.getDay)
const PAGE = 1000; // limite padrão de linhas por requisição no Supabase

const must = ({ data, error }) => {
  if (error) throw error;
  return data;
};

/** Busca todas as páginas de uma consulta (precisa de ordenação estável). */
export async function fetchAll(buildQuery) {
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const data = must(await buildQuery().range(from, from + PAGE - 1));
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

// ---------- Mensagem ----------

const firstName = (c) => (c.name || '').trim().split(/\s+/)[0] || '';
export const personalize = (tpl, c) => tpl.replace(/\{nome\}/gi, firstName(c));

// Espaços (1-2) + 3 letras = no máximo 5 caracteres reservados no fim do SMS
export const SUFFIX_MARGIN = 5;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Código de 3 letras em maiúsculas/minúsculas aleatórias; `used` garante unicidade dentro do lote. */
export function generateCode(used) {
  for (;;) {
    const code = Array.from({ length: 3 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
    if (!used?.has(code)) {
      used?.add(code);
      return code;
    }
  }
}

/** Personaliza {nome} e acrescenta espaçamento aleatório + código de 3 letras, tornando cada SMS diferente. */
export function humanizeMessage(text, contactName = '', used) {
  const body = personalize(text, { name: contactName }).trimEnd();
  const padding = ' '.repeat(1 + Math.floor(Math.random() * 2));
  return `${body}${padding}${generateCode(used)}`;
}

// ---------- Agendamento ----------

const randBetween = (min, max) => min + Math.random() * (max - min);

const atTime = (date, hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
};

/** Antes do início -> início do dia; a partir do fim -> início do dia seguinte. */
function clampToWindow(date, start, end) {
  const s = atTime(date, start);
  const e = atTime(date, end);
  if (date < s) return s;
  if (date >= e) {
    const next = new Date(s);
    next.setDate(next.getDate() + 1);
    return next;
  }
  return date;
}

/**
 * Linha do tempo única: o 1º item sai agora; cada seguinte = anterior + intervalo aleatório.
 * Horários fora da janela vão para o início do próximo período permitido.
 */
export function scheduleTimes(count, cfg) {
  const times = [];
  let prev = null;
  for (let i = 0; i < count; i++) {
    const raw = prev
      ? new Date(prev.getTime() + randBetween(Number(cfg.minInterval), Number(cfg.maxInterval)) * 1000)
      : new Date();
    prev = clampToWindow(raw, cfg.start, cfg.end);
    times.push(prev);
  }
  return times;
}

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function nextDayStart(date, start) {
  const d = atTime(date, start);
  d.setDate(d.getDate() + 1);
  return d;
}

/** Estimativa de SMS por chip em um dia: duração da janela / intervalo médio. */
export function estimatePerDay(cfg) {
  const [sh, sm] = cfg.start.split(':').map(Number);
  const [eh, em] = cfg.end.split(':').map(Number);
  const windowSec = ((eh * 60 + em) - (sh * 60 + sm)) * 60;
  const avg = (Number(cfg.minInterval) + Number(cfg.maxInterval)) / 2;
  return windowSec > 0 && avg > 0 ? Math.floor(windowSec / avg) + 1 : 0;
}

/**
 * Linha do tempo independente por chip: `keys[i]` identifica o chip do item i.
 * Cada chip espera o intervalo aleatório entre seus envios, respeita a janela, os dias da semana e a cota diária;
 * ao estourar o fim da janela ou a cota, salta para o início do próximo dia válido.
 */
export function scheduleByChannel(keys, cfg, from = new Date()) {
  const days = cfg.days?.length ? cfg.days : DEFAULT_DAYS;
  const limit = Number(cfg.dailyLimit) > 0 ? Number(cfg.dailyLimit) : Infinity;
  const state = new Map();
  return keys.map((key) => {
    const st = state.get(key) ?? { prev: null, day: null, count: 0 };
    let t = st.prev
      ? new Date(st.prev.getTime() + randBetween(Number(cfg.minInterval), Number(cfg.maxInterval)) * 1000)
      : new Date(from);
    for (let guard = 0; guard < 400; guard++) {
      if (!days.includes(t.getDay()) || t >= atTime(t, cfg.end)) { t = nextDayStart(t, cfg.start); continue; }
      const s = atTime(t, cfg.start);
      if (t < s) t = s;
      const dk = dayKey(t);
      if (st.day !== dk) { st.day = dk; st.count = 0; }
      if (st.count >= limit) { t = nextDayStart(t, cfg.start); continue; }
      break;
    }
    st.count++;
    st.prev = t;
    state.set(key, st);
    return t;
  });
}

/** Início base do agendamento: a data escolhida na campanha, se ainda futura; senão, agora. */
export function scheduleStartTime(cfg) {
  const at = cfg.startAt ? new Date(cfg.startAt) : null;
  return at && !Number.isNaN(at.getTime()) && at > new Date() ? at : new Date();
}

export const channelKey = (deviceId, slot) => `${deviceId}:${slot}`;

/** Só o primeiro item já devido fica PENDING; os demais aguardam como SCHEDULED. */
export const queueStatus = (index, time) =>
  index === 0 && time.getTime() - Date.now() < 2000 ? 'PENDING' : 'SCHEDULED';

// ---------- Ações de ciclo de vida ----------

const setCampaignStatus = async (id, status) =>
  must(await supabase.from('campaigns').update({ status }).eq('id', id));

async function inChunks(list, size, fn, onProgress) {
  for (let i = 0; i < list.length; i += size) {
    await Promise.all(list.slice(i, i + size).map(fn));
    onProgress?.(Math.min(i + size, list.length), list.length);
  }
}

/** Inicia (ou continua) a campanha: reagenda a fila fria (sms_schedule) a partir de agora, por chip. */
export async function startCampaign(campaign, onProgress) {
  if (!campaign.config) throw new Error('Campanha sem configuração salva. Abra, revise e salve novamente.');
  const cold = await fetchAll(() =>
    supabase.from('sms_schedule').select('id, sim_slot, target_device_id, scheduled_for')
      .eq('campaign_id', campaign.id).in('status', ['DRAFT', 'PAUSED'])
      .order('scheduled_for').order('id'));
  if (cold.length) {
    const times = scheduleByChannel(cold.map((it) => channelKey(it.target_device_id, it.sim_slot)), campaign.config,
      scheduleStartTime(campaign.config));
    await inChunks(cold.map((it, i) => ({ id: it.id, at: times[i].toISOString() })), 25, (u) =>
      supabase.from('sms_schedule').update({ status: 'WAITING', scheduled_for: u.at }).eq('id', u.id).then(must),
      onProgress);
    return setCampaignStatus(campaign.id, 'RUNNING');
  }
  return startLegacyQueue(campaign, onProgress);
}

// Campanhas antigas, criadas antes da sms_schedule, ainda têm itens na sms_queue
async function startLegacyQueue(campaign, onProgress) {
  const items = await fetchAll(() =>
    supabase.from('sms_queue').select('id, sim_slot, target_device_id, scheduled_for')
      .eq('campaign_id', campaign.id).in('status', ['DRAFT', 'PAUSED'])
      .order('scheduled_for').order('id'));
  if (!items.length) throw new Error('Não há itens na fila desta campanha.');

  const times = scheduleTimes(items.length, campaign.config);
  const updates = items.map((it, i) => ({
    id: it.id, status: queueStatus(i, times[i]), scheduled_for: times[i].toISOString(),
  }));
  await inChunks(updates, 25, (u) =>
    supabase.from('sms_queue')
      .update({ status: u.status, scheduled_for: u.scheduled_for }).eq('id', u.id)
      .then(must), onProgress);
  await setCampaignStatus(campaign.id, 'RUNNING');
}

/** Retoma: com config reagenda a partir de agora; sem config, apenas volta PAUSED para SCHEDULED. */
export async function resumeCampaign(campaign, onProgress) {
  if (campaign.config) return startCampaign(campaign, onProgress);
  must(await supabase.from('sms_schedule').update({ status: 'WAITING' })
    .eq('campaign_id', campaign.id).eq('status', 'PAUSED'));
  must(await supabase.from('sms_queue').update({ status: 'SCHEDULED' })
    .eq('campaign_id', campaign.id).eq('status', 'PAUSED'));
  return setCampaignStatus(campaign.id, 'RUNNING');
}

/** Pausa: itens pendentes ficam retidos e podem ser retomados. */
export async function pauseCampaign(campaign) {
  must(await supabase.from('sms_schedule').update({ status: 'PAUSED' })
    .eq('campaign_id', campaign.id).eq('status', 'WAITING'));
  must(await supabase.from('sms_queue').update({ status: 'PAUSED' })
    .eq('campaign_id', campaign.id).in('status', ['PENDING', 'SCHEDULED']));
  await setCampaignStatus(campaign.id, 'PAUSED');
}

/** Cancela: marca a fila fria como CANCELLED e remove o que estava pendente na sms_queue. */
export async function cancelCampaign(campaign) {
  must(await supabase.from('sms_schedule').update({ status: 'CANCELLED' })
    .eq('campaign_id', campaign.id).in('status', ['WAITING', 'PAUSED', 'DRAFT']));
  must(await supabase.from('sms_queue').delete()
    .eq('campaign_id', campaign.id).in('status', ['DRAFT', 'PENDING', 'SCHEDULED', 'PAUSED']));
  await setCampaignStatus(campaign.id, 'CANCELLED');
}

/** Suspende: cancela os itens ainda não enviados; a campanha pode ser reaberta e regerada. */
export async function suspendCampaign(campaign) {
  must(await supabase.from('sms_schedule').update({ status: 'CANCELLED' })
    .eq('campaign_id', campaign.id).in('status', ['DRAFT', 'WAITING', 'PAUSED']));
  must(await supabase.from('sms_queue').update({ status: 'CANCELLED' })
    .eq('campaign_id', campaign.id).in('status', ['DRAFT', 'PENDING', 'SCHEDULED', 'PAUSED']));
  await setCampaignStatus(campaign.id, 'SUSPENDED');
}

/**
 * Troca em lote aparelho e chip dos itens ainda não enviados (round-robin entre os canais),
 * mantendo horários e status. deviceMode: 'all' (online agora) ou id do aparelho; simMode: 'alternate' | '0' | '1'.
 */
export async function reassignCampaign(campaign, deviceMode, simMode, onProgress) {
  const { data: devices, error } = await supabase.from('devices').select('*').eq('user_id', campaign.user_id);
  if (error) throw error;
  const channels = buildChannels(devices, deviceMode, simMode);
  if (!channels.length) {
    throw new Error(deviceMode === 'all' ? 'Nenhum aparelho online no momento.' : 'Aparelho não encontrado.');
  }

  const items = await fetchAll(() =>
    supabase.from('sms_queue').select('id')
      .eq('campaign_id', campaign.id).in('status', ['DRAFT', 'PENDING', 'SCHEDULED', 'PAUSED'])
      .order('scheduled_for').order('id'));
  const cold = await fetchAll(() =>
    supabase.from('sms_schedule').select('id')
      .eq('campaign_id', campaign.id).in('status', ['WAITING', 'PAUSED', 'DRAFT'])
      .order('scheduled_for').order('id'));
  if (!items.length && !cold.length) throw new Error('Não há mensagens pendentes nesta campanha.');

  // Um UPDATE em bloco por canal: round-robin entre os canais, horários e status preservados
  const total = items.length + cold.length;
  let done = 0;
  const reassign = async (table, list) => {
    for (let c = 0; c < channels.length; c++) {
      const ids = list.filter((_, i) => i % channels.length === c).map((it) => it.id);
      for (let i = 0; i < ids.length; i += SCHEDULE_CHUNK) {
        const part = ids.slice(i, i + SCHEDULE_CHUNK);
        must(await supabase.from(table)
          .update({ target_device_id: channels[c].deviceId, sim_slot: channels[c].slot }).in('id', part));
        done += part.length;
        onProgress?.(done, total);
      }
    }
  };
  await reassign('sms_queue', items);
  await reassign('sms_schedule', cold);

  must(await supabase.from('campaigns').update({
    target_device_id: deviceMode === 'all' ? null : deviceMode,
    sim_slot_preference: simMode === 'alternate' ? null : Number(simMode),
    ...(campaign.config ? { config: { ...campaign.config, form: { ...campaign.config.form, deviceMode, simMode } } } : {}),
  }).eq('id', campaign.id));
}

/** Reatribui os itens não enviados entre os aparelhos online agora. */
export const redistributeCampaign = (campaign, onProgress) =>
  reassignCampaign(campaign, 'all', campaign.config?.form?.simMode ?? 'alternate', onProgress);

/** Exclui a campanha e os itens não enviados; o histórico já enviado permanece (FK com on delete set null). */
export async function deleteCampaign(campaign) {
  await clearUnsentItems(campaign.id);
  must(await supabase.from('campaigns').delete().eq('id', campaign.id));
}

/** Remove os itens ainda não enviados (usado ao regerar a fila de uma campanha editada). */
export async function clearUnsentItems(campaignId) {
  must(await supabase.from('sms_schedule').delete()
    .eq('campaign_id', campaignId).in('status', ['DRAFT', 'WAITING', 'PAUSED', 'CANCELLED']));
  must(await supabase.from('sms_queue').delete()
    .eq('campaign_id', campaignId).in('status', ['DRAFT', 'PENDING', 'SCHEDULED', 'PAUSED', 'CANCELLED']));
}
