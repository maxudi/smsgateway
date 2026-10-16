import { useState } from 'react';
import { Plus, Smartphone, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import Modal from '../components/Modal.jsx';
import WebhookConfig from '../components/WebhookConfig.jsx';
import { isDeviceOnline } from '../lib/devices.js';
import { useDevices } from '../hooks/useDevices.js';

export default function Devices() {
  const { user, plan, isMaster } = useAuth();
  const { t, lang } = useLanguage();
  const { devices: liveDevices, reload: load } = useDevices(user.id);
  // Ordem alfabética fixa para os cartões não trocarem de lugar a cada ping
  const devices = [...liveDevices].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  const [open, setOpen] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const link = async (e) => {
    e.preventDefault();
    setError('');
    if (!isMaster && plan && devices.length >= plan.max_devices) {
      return setError(t('devices.planLimitError', { max: plan.max_devices }));
    }
    // O app Android registra o aparelho com o Device ID; aqui "reivindicamos" o registro para o usuário
    const { data: existing } = await supabase.from('devices').select('id,user_id').eq('id', deviceId.trim()).maybeSingle();
    const payload = { name: name.trim() || 'Meu celular', user_id: user.id };
    const { error: err } = existing
      ? await supabase.from('devices').update(payload).eq('id', deviceId.trim())
      : await supabase.from('devices').insert({ id: deviceId.trim(), status: 'offline', ...payload });
    if (err) return setError(err.message);
    setOpen(false); setDeviceId(''); setName('');
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
                <div className="rounded-lg bg-bg p-2"><div className="text-xs text-slate-500">{t('devices.sim1')}</div>{d.sim1_operator || '—'}</div>
                <div className="rounded-lg bg-bg p-2"><div className="text-xs text-slate-500">{t('devices.sim2')}</div>{d.sim2_operator || '—'}</div>
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
