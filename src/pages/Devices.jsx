import { useState } from 'react';
import { Plus, Smartphone, Trash2, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import Modal from '../components/Modal.jsx';
import WebhookConfig from '../components/WebhookConfig.jsx';
import { isDeviceOnline } from '../lib/devices.js';
import { useDevices } from '../hooks/useDevices.js';

export default function Devices() {
  const { user, plan, tenant, isMaster } = useAuth();
  const { t, lang } = useLanguage();
  const { devices: liveDevices, reload: load } = useDevices(user.id);
  // Ordem alfabética fixa para os cartões não trocarem de lugar a cada ping
  const devices = [...liveDevices].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  const [open, setOpen] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const maxSimSlots = isMaster ? 2 : Number(plan?.max_sim_slots ?? tenant?.max_sim_slots ?? 1);
  const singleSimOnly = !isMaster && maxSimSlots <= 1;

  const link = async (e) => {
    e.preventDefault();
    setError('');
    const cleanId = deviceId.trim();
    const cleanName = name.trim() || (lang === 'pt' ? 'Meu celular' : 'My phone');

    if (!isMaster && plan && devices.length >= plan.max_devices && !devices.some((d) => d.id === cleanId)) {
      return setError(t('devices.planLimitError', { max: plan.max_devices }));
    }

    const alreadyLinkedMsg =
      lang === 'pt'
        ? 'Este Device ID já está vinculado a outra conta. Remova-o da conta anterior antes de cadastrá-lo aqui.'
        : 'This Device ID is already linked to another account. Remove it from the previous account before linking it here.';

    // 1. Tenta vincular via RPC segura (verifica propriedade no banco mesmo com RLS ativo)
    const { error: rpcErr } = await supabase.rpc('claim_device', {
      p_device_id: cleanId,
      p_name: cleanName,
    });

    if (!rpcErr) {
      setOpen(false);
      setDeviceId('');
      setName('');
      load();
      return;
    }

    // Se a RPC bloqueou por já pertencer a outro usuário ou limite de plano, exibe a mensagem
    if (
      rpcErr.message &&
      !rpcErr.message.includes('claim_device') &&
      !rpcErr.message.includes('function')
    ) {
      if (rpcErr.message.includes('duplicate key') || rpcErr.message.includes('já está vinculado')) {
        return setError(alreadyLinkedMsg);
      }
      return setError(rpcErr.message);
    }

    // 2. Fallback caso a migration ainda não tenha sido rodada no Supabase
    const { data: existing } = await supabase
      .from('devices')
      .select('id,user_id')
      .eq('id', cleanId)
      .maybeSingle();

    if (existing && existing.user_id && existing.user_id !== user.id) {
      return setError(alreadyLinkedMsg);
    }

    const payload = { name: cleanName, user_id: user.id };
    const { error: err } = existing
      ? await supabase.from('devices').update(payload).eq('id', cleanId)
      : await supabase.from('devices').insert({ id: cleanId, status: 'offline', ...payload });

    if (err) {
      if (err.message?.includes('duplicate key') || err.code === '23505') {
        return setError(alreadyLinkedMsg);
      }
      return setError(err.message);
    }
    setOpen(false);
    setDeviceId('');
    setName('');
    load();
  };

  const remove = async (id) => {
    if (!confirm(t('devices.unlinkConfirm'))) return;
    await supabase.from('devices').delete().eq('id', id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t('devices.title')}</h1>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <Plus size={16} /> {t('devices.linkDevice')}
        </button>
      </div>

      {devices.length === 0 && <p className="text-slate-400">{t('devices.noDevices')}</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {devices.map((d) => {
          const on = isDeviceOnline(d);
          return (
            <div key={d.id} className="card space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="text-accent" />
                  <div>
                    <div className="font-semibold text-white">{d.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{d.id}</div>
                  </div>
                </div>
                <span className={`badge ${on ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
                  <span className={`h-2 w-2 rounded-full ${on ? 'bg-success animate-pulse' : 'bg-danger'}`} />
                  {on ? t('common.online') : t('common.offline')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-bg p-2">
                  <div className="text-xs text-slate-500">{t('devices.sim1')} (Slot 0)</div>
                  {d.sim1_operator || '—'}
                </div>
                {singleSimOnly ? (
                  <div className="rounded-lg bg-bg/50 border border-white/5 p-2 opacity-60" title="Seu plano atual monitora apenas 1 chip (SIM 1). Faça upgrade para liberar Dual-SIM.">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Lock size={11} /> {t('devices.sim2')} (Slot 1)
                    </div>
                    <div className="text-xs text-slate-500">Bloqueado no plano</div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-bg p-2">
                    <div className="text-xs text-slate-500">{t('devices.sim2')} (Slot 1)</div>
                    {d.sim2_operator || '—'}
                  </div>
                )}
              </div>
              <WebhookConfig device={d} userId={user.id} />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{t('devices.lastPing')} {d.last_ping ? new Date(d.last_ping).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US') : t('common.never')}</span>
                <button className="text-danger hover:underline inline-flex items-center gap-1" onClick={() => remove(d.id)}>
                  <Trash2 size={12} /> {t('common.remove')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <Modal title={t('devices.modalTitle')} onClose={() => setOpen(false)}>
          <form onSubmit={link} className="space-y-4">
            <div>
              <label className="label">{t('devices.deviceIdLabel')}</label>
              <input className="input font-mono" required value={deviceId} onChange={(e) => setDeviceId(e.target.value)} />
            </div>
            <div>
              <label className="label">{t('devices.aliasLabel')}</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('devices.aliasPlaceholder')} />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button className="btn-primary w-full">{t('devices.linkButton')}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
