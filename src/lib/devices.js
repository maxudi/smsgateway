// O aparelho envia ping a cada 30s; 90s tolera uma ou duas falhas de rede antes de marcar offline
export const HEARTBEAT_TIMEOUT_MS = 90 * 1000;

export const isDeviceOnline = (device) => {
  if (!device.last_ping) return false;
  const age = Date.now() - new Date(device.last_ping).getTime();
  return age < HEARTBEAT_TIMEOUT_MS && device.status === 'online';
};

export const isActive = isDeviceOnline;

/**
 * Canais (aparelho x chip): percorre todos os aparelhos no mesmo chip antes de trocar de chip.
 * includeOffline: considera todos os aparelhos cadastrados (agendamento não depende de estar online agora).
 * maxSimSlots: planos com limite de 1 chip operam exclusivamente no slot 0 (SIM 1).
 */
export function buildChannels(devices, deviceMode, simMode, includeOffline = false, maxSimSlots = 2) {
  const targets = deviceMode === 'all'
    ? (includeOffline ? devices : devices.filter(isActive))
    : devices.filter((d) => d.id === deviceMode);
  const rawSlots = simMode === 'alternate' ? [0, 1] : [Number(simMode)];
  const slots = Number(maxSimSlots) <= 1 ? [0] : rawSlots;
  return slots.flatMap((slot) => targets.map((d) => ({ deviceId: d.id, slot })));
}
