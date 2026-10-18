import { useEffect, useMemo, useState } from 'react';
import { Send, Smartphone, Layers, X, CheckCircle2, AlertTriangle, Loader2, Zap, Reply, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isDeviceOnline } from '../lib/devices.js';

const COUNTRIES = [
  { code: 'BR', flag: '🇧🇷', name: 'Brasil', ddi: '55', mask: '(##) #####-####', altMask: '(##) ####-####', maxDigits: 11, minDigits: 10, placeholder: '(34) 99999-9999' },
  { code: 'US', flag: '🇺🇸', name: 'USA / Canada', ddi: '1', mask: '(###) ###-####', maxDigits: 10, minDigits: 10, placeholder: '(415) 555-0199' },
  { code: 'PT', flag: '🇵🇹', name: 'Portugal', ddi: '351', mask: '### ### ###', maxDigits: 9, minDigits: 9, placeholder: '912 345 678' },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom', ddi: '44', mask: '#### ######', maxDigits: 10, minDigits: 10, placeholder: '7700 900077' },
  { code: 'ES', flag: '🇪🇸', name: 'España', ddi: '34', mask: '### ### ###', maxDigits: 9, minDigits: 9, placeholder: '612 345 678' },
  { code: 'AR', flag: '🇦🇷', name: 'Argentina', ddi: '54', mask: '# ## ####-####', maxDigits: 11, minDigits: 10, placeholder: '9 11 1234-5678' },
  { code: 'MX', flag: '🇲🇽', name: 'México', ddi: '52', mask: '## #### ####', maxDigits: 10, minDigits: 10, placeholder: '55 1234 5678' },
  { code: 'CO', flag: '🇨🇴', name: 'Colombia', ddi: '57', mask: '### ### ####', maxDigits: 10, minDigits: 10, placeholder: '300 123 4567' },
  { code: 'CL', flag: '🇨🇱', name: 'Chile', ddi: '56', mask: '# #### ####', maxDigits: 9, minDigits: 9, placeholder: '9 1234 5678' },
  { code: 'UY', flag: '🇺🇾', name: 'Uruguay', ddi: '598', mask: '## ### ###', maxDigits: 8, minDigits: 8, placeholder: '99 123 456' },
  { code: 'PY', flag: '🇵🇾', name: 'Paraguay', ddi: '595', mask: '### ######', maxDigits: 9, minDigits: 9, placeholder: '981 123456' },
  { code: 'PE', flag: '🇵🇪', name: 'Perú', ddi: '51', mask: '### ### ###', maxDigits: 9, minDigits: 9, placeholder: '912 345 678' },
  { code: 'DE', flag: '🇩🇪', name: 'Deutschland', ddi: '49', mask: '#### #######', maxDigits: 11, minDigits: 10, placeholder: '1512 3456789' },
  { code: 'FR', flag: '🇫🇷', name: 'France', ddi: '33', mask: '# ## ## ## ##', maxDigits: 9, minDigits: 9, placeholder: '6 12 34 56 78' },
  { code: 'IT', flag: '🇮🇹', name: 'Italia', ddi: '39', mask: '### ### ####', maxDigits: 10, minDigits: 9, placeholder: '312 345 6789' },
  { code: 'IN', flag: '🇮🇳', name: 'India', ddi: '91', mask: '##### #####', maxDigits: 10, minDigits: 10, placeholder: '98765 43210' },
];

function applyPhoneMask(rawDigits, country) {
  const digits = rawDigits.replace(/\D/g, '').slice(0, country.maxDigits);
  const pattern = country.code === 'BR' && digits.length <= 10 && country.altMask ? country.altMask : country.mask;
  let result = '';
  let digitIdx = 0;
  for (let i = 0; i < pattern.length && digitIdx < digits.length; i++) {
    if (pattern[i] === '#') {
      result += digits[digitIdx++];
    } else {
      result += pattern[i];
    }
  }
  return { formatted: result, digits };
}

/** Detecta país (DDI) e dígitos locais a partir de um telefone recebido (ex: "+5534999990000" ou "34999990000") */
function parseIncomingPhone(rawPhone) {
  const clean = String(rawPhone || '').replace(/\D/g, '');
  if (!clean) return { countryCode: 'BR', localDigits: '' };

  // Ordena DDIs do maior para o menor (ex: 598 antes de 55/1) para casar prefixos exatos
  const sortedByDdi = [...COUNTRIES].sort((a, b) => b.ddi.length - a.ddi.length);
  for (const c of sortedByDdi) {
    if (clean.startsWith(c.ddi)) {
      const rest = clean.slice(c.ddi.length);
      if (rest.length >= c.minDigits && rest.length <= c.maxDigits) {
        return { countryCode: c.code, localDigits: rest };
      }
    }
  }

  // Se vier sem DDI com 10 ou 11 dígitos, assume Brasil
  if (clean.length === 10 || clean.length === 11) {
    return { countryCode: 'BR', localDigits: clean };
  }

  return { countryCode: 'BR', localDigits: clean.slice(-11) };
}

const DEFAULT_TEST_MSG = '[Max Netminas] Teste de conexao do Gateway SMS realizado com sucesso!';

export default function QuickTestSmsModal({
  open,
  onClose,
  userId,
  devices = [],
  singleSimOnly = false,
  remainingQuota = Infinity,
  replyTo = null, // { id, sender_phone, message, device_id, sim_slot, received_at, contactName }
  onSent,
}) {
  const isReply = Boolean(replyTo);

  const [countryCode, setCountryCode] = useState('BR');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [simSlot, setSimSlot] = useState('0');
  const [message, setMessage] = useState(DEFAULT_TEST_MSG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);

  const country = useMemo(
    () => COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0],
    [countryCode]
  );

  // Ao abrir o modal, configura para Resposta (se replyTo existir) ou para Teste Rápido
  useEffect(() => {
    if (!open) return;
    setError('');
    setSuccessInfo(null);

    if (replyTo) {
      const parsed = parseIncomingPhone(replyTo.sender_phone);
      setCountryCode(parsed.countryCode);
      setPhoneDigits(parsed.localDigits);

      if (replyTo.device_id && devices.some((d) => d.id === replyTo.device_id)) {
        setDeviceId(replyTo.device_id);
      } else if (devices.length > 0) {
        const firstOnline = devices.find((d) => isDeviceOnline(d));
        setDeviceId((firstOnline || devices[0]).id);
      }

      if (singleSimOnly) {
        setSimSlot('0');
      } else {
        setSimSlot(String(replyTo.sim_slot ?? 0));
      }

      setMessage('');
    } else {
      if (devices.length > 0 && !devices.some((d) => d.id === deviceId)) {
        const firstOnline = devices.find((d) => isDeviceOnline(d));
        setDeviceId((firstOnline || devices[0]).id);
      }
      if (singleSimOnly) {
        setSimSlot('0');
      }
      if (!message) {
        setMessage(DEFAULT_TEST_MSG);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, replyTo, devices, singleSimOnly]);

  if (!open) return null;

  const masked = applyPhoneMask(phoneDigits, country);
  const fullNumber = `${country.ddi}${masked.digits}`;
  const selectedDevice = devices.find((d) => d.id === deviceId);
  const selectedOnline = selectedDevice ? isDeviceOnline(selectedDevice) : false;

  const handlePhoneChange = (e) => {
    setError('');
    setSuccessInfo(null);
    const raw = e.target.value.replace(/\D/g, '').slice(0, country.maxDigits);
    setPhoneDigits(raw);
  };

  const handleCountryChange = (e) => {
    const nextCode = e.target.value;
    const nextCountry = COUNTRIES.find((c) => c.code === nextCode) || COUNTRIES[0];
    setCountryCode(nextCode);
    setPhoneDigits((prev) => prev.slice(0, nextCountry.maxDigits));
    setError('');
    setSuccessInfo(null);
  };

  const handleSendTest = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessInfo(null);

    if (!devices.length || !deviceId) {
      setError('Cadastre e conecte pelo menos 1 aparelho Android antes de enviar.');
      return;
    }
    if (masked.digits.length < country.minDigits) {
      setError(`Digite um número de telefone válido para ${country.flag} +${country.ddi} (${country.name}).`);
      return;
    }
    if (!message.trim()) {
      setError(isReply ? 'Digite a mensagem de resposta.' : 'Digite o texto da mensagem de teste.');
      return;
    }
    if (remainingQuota <= 0) {
      setError('Sua cota mensal de disparos do plano foi atingida.');
      return;
    }

    setBusy(true);
    try {
      const effectiveSlot = singleSimOnly ? 0 : Number(simSlot);
      const { data, error: qErr } = await supabase
        .from('sms_queue')
        .insert({
          user_id: userId,
          target_device_id: deviceId,
          sim_slot: effectiveSlot,
          phone: fullNumber,
          message: message.trim(),
          scheduled_for: new Date().toISOString(),
          status: 'PENDING',
        })
        .select('id, sim_slot')
        .single();

      if (qErr) throw qErr;

      setSuccessInfo({
        id: data?.id,
        phone: `+${fullNumber}`,
        deviceName: selectedDevice?.name || deviceId,
        slot: (data?.sim_slot ?? effectiveSlot) + 1,
      });

      if (onSent) onSent();
    } catch (err) {
      setError(err?.message || 'Não foi possível enfileirar o SMS.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="card relative w-full max-w-lg border border-accent/30 bg-surface p-6 shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/30">
              {isReply ? <Reply size={20} /> : <Zap size={20} />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isReply ? 'Responder SMS Recebido' : 'Envio Rápido de SMS de Teste'}
              </h2>
              <p className="text-xs text-slate-400">
                {isReply
                  ? 'Envia sua resposta imediatamente pelo aparelho e chip selecionados.'
                  : 'Dispara imediatamente para a fila do aparelho sem depender de janela de horário.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSendTest} className="mt-5 space-y-4">
          {/* Bloco da mensagem original quando estiver respondendo */}
          {isReply && (
            <div className="rounded-xl border border-white/10 bg-bg/80 p-3.5 text-xs space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5 font-semibold text-accent">
                  <MessageSquare size={13} />
                  Mensagem recebida de {replyTo.contactName ? `${replyTo.contactName} (${replyTo.sender_phone})` : replyTo.sender_phone}
                </span>
                {replyTo.received_at && (
                  <span className="text-[11px] text-slate-500">
                    {new Date(replyTo.received_at).toLocaleString('pt-BR')}
                  </span>
                )}
              </div>
              <p className="text-slate-200 italic whitespace-pre-wrap break-words pt-1">
                “{replyTo.message}”
              </p>
            </div>
          )}

          {/* País + Número com Máscara */}
          <div>
            <label className="label">Número de destino (com DDI do país)</label>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-5 sm:col-span-5">
                <select
                  className="input font-medium text-xs sm:text-sm h-full"
                  value={countryCode}
                  onChange={handleCountryChange}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} +{c.ddi} ({c.name})
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-7 sm:col-span-7">
                <input
                  type="tel"
                  className="input font-mono text-sm tracking-wide"
                  placeholder={country.placeholder}
                  value={masked.formatted}
                  onChange={handlePhoneChange}
                  autoFocus={!isReply}
                />
              </div>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
              <span>
                Formato enviado ao chip:{' '}
                <strong className="font-mono text-accent">
                  +{country.ddi}{masked.digits || '...'}
                </strong>
              </span>
              <span>
                {masked.digits.length}/{country.maxDigits} dígitos
              </span>
            </div>
          </div>

          {/* Aparelho e Chip */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label flex items-center gap-1.5">
                <Smartphone size={13} className="text-accent" /> Aparelho Android
              </label>
              <select
                className="input text-xs sm:text-sm"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                disabled={!devices.length}
              >
                {!devices.length && <option value="">Nenhum aparelho cadastrado</option>}
                {devices.map((d) => {
                  const online = isDeviceOnline(d);
                  return (
                    <option key={d.id} value={d.id}>
                      {online ? '🟢 ' : '⚪ '}
                      {d.name || d.id} ({online ? 'Online' : 'Em repouso'})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="label flex items-center gap-1.5">
                <Layers size={13} className="text-accent" /> Chip (SIM Slot)
              </label>
              <select
                className="input text-xs sm:text-sm"
                value={singleSimOnly ? '0' : simSlot}
                disabled={singleSimOnly}
                onChange={(e) => setSimSlot(e.target.value)}
              >
                <option value="0">SIM 1 (Slot 0)</option>
                <option value="1" disabled={singleSimOnly}>
                  SIM 2 (Slot 1){singleSimOnly ? ' — Plano Dual-SIM' : ''}
                </option>
              </select>
            </div>
          </div>

          {selectedDevice && !selectedOnline && (
            <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
              <AlertTriangle size={14} className="shrink-0" />
              <span>
                O aparelho <b>{selectedDevice.name}</b> está em repouso no momento. O SMS sairá assim que o app Android conectar.
              </span>
            </div>
          )}

          {/* Mensagem de Teste / Resposta */}
          <div>
            <div className="flex items-center justify-between">
              <label className="label">{isReply ? 'Sua mensagem de resposta' : 'Mensagem de teste'}</label>
              {!isReply && (
                <button
                  type="button"
                  onClick={() => setMessage(DEFAULT_TEST_MSG)}
                  className="text-[11px] text-accent hover:underline"
                >
                  Restaurar texto padrão
                </button>
              )}
            </div>
            <textarea
              rows={3}
              className="input resize-none text-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                isReply
                  ? 'Digite aqui sua resposta para este número...'
                  : 'Digite uma mensagem rápida para testar seu gateway...'
              }
              autoFocus={isReply}
            />
            <div className="mt-1 flex justify-between text-[11px] text-slate-500">
              <span>Disparo direto sem sufixo de campanha</span>
              <span>{message.length} caracteres</span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-xs text-danger">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successInfo && (
            <div className="rounded-xl border border-success/30 bg-success/10 p-3.5 text-xs text-slate-200 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-success text-sm">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>
                  {isReply ? 'Resposta enviada para a fila imediata!' : 'SMS de teste enviado para a fila imediata!'}
                </span>
              </div>
              <p className="text-slate-300">
                Destino: <b className="font-mono text-white">{successInfo.phone}</b> · Aparelho:{' '}
                <b className="text-white">{successInfo.deviceName}</b> · Chip: <b className="text-white">SIM {successInfo.slot}</b>
              </p>
              <p className="text-[11px] text-slate-400">
                Verifique o celular de destino em alguns segundos (ou acompanhe na aba <b>Fila</b> / <b>Histórico</b>).
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
            <button type="button" onClick={onClose} className="btn-ghost text-xs">
              Fechar
            </button>
            <button
              type="submit"
              disabled={busy || !devices.length}
              className="btn-primary text-xs px-5 py-2.5 shadow-lg shadow-accent/20"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : isReply ? <Reply size={15} /> : <Send size={15} />}
              {busy ? 'Enviando...' : isReply ? 'Enviar Resposta Agora' : 'Disparar Teste Agora'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
