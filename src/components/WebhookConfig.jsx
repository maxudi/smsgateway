import { useEffect, useState } from 'react';
import { ChevronDown, Webhook, Eye, EyeOff, Copy, KeyRound, Loader2, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext.jsx';

const EVENTS = ['sms_received'];

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

const generateSecret = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `whsec_${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')}`;
};

const isHttpUrl = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

/** Seção colapsável de webhook (recebimento de SMS) de um aparelho, persistida em user_webhooks. */
export default function WebhookConfig({ device, userId }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hook, setHook] = useState(null); // registro salvo
  const [form, setForm] = useState({ url: '', secret_key: '', is_active: true });
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!open || loaded) return;
    (async () => {
      const { data, error } = await supabase.from('user_webhooks').select('*')
        .eq('device_id', device.id).maybeSingle();
      if (error) setMsg({ ok: false, text: error.message });
      if (data) {
        setHook(data);
        setForm({ url: data.url ?? '', secret_key: data.secret_key ?? '', is_active: !!data.is_active });
      }
      setLoaded(true);
    })();
  }, [open, loaded, device.id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const copy = async () => {
    await navigator.clipboard.writeText(form.secret_key);
    setMsg({ ok: true, text: t('devices.webhookCopied') });
  };

  // Sem depender de constraint única: atualiza o registro do aparelho ou cria um novo
  const persist = async (values) => {
    const payload = { device_id: device.id, user_id: userId, events: EVENTS, ...values };
    const { data, error } = hook
      ? await supabase.from('user_webhooks').update(payload).eq('id', hook.id).select().single()
      : await supabase.from('user_webhooks').insert(payload).select().single();
    if (error) throw error;
    setHook(data);
    return data;
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (!isHttpUrl(form.url.trim())) throw new Error(t('devices.webhookUrlInvalid'));
      await persist({ ...form, url: form.url.trim() });
      setMsg({ ok: true, text: t('devices.webhookSaved') });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
    setBusy(false);
  };

  // O toggle grava na hora quando o webhook já existe
  const toggle = async () => {
    const next = !form.is_active;
    setForm({ ...form, is_active: next });
    if (!hook) return;
    try {
      await persist({ ...form, is_active: next });
    } catch (err) {
      setForm({ ...form, is_active: !next });
      setMsg({ ok: false, text: err.message });
    }
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (!hook) throw new Error(t('devices.webhookSaveFirst'));
      const now = new Date().toISOString();
      const { error } = await supabase.from('webhook_delivery_queue').insert({
        webhook_id: hook.id,
        payload: {
          event: 'sms.test',
          device_id: device.id,
          sim_slot: 0,
          from: '+5500000000000',
          message: 'Teste de conectividade do webhook do gateway',
          received_at: now,
        },
        attempts: 0,
        max_attempts: 5,
        status: 'PENDING',
        next_retry_at: now,
      });
      if (error) throw error;
      setToast(t('devices.webhookTestQueued'));
      setTimeout(() => setToast(null), 6000);
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
    setBusy(false);
  };

  return (
    <div className="rounded-lg border border-white/5 bg-bg/50">
      <button type="button" onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm text-slate-300 hover:text-white">
        <span className="flex items-center gap-2">
          <Webhook size={14} className="text-accent" /> {t('devices.webhookSection')}
          {hook && <span className={`badge ${hook.is_active ? 'bg-success/15 text-success' : 'bg-white/10 text-slate-400'}`}>
            {hook.is_active ? t('devices.webhookActive') : t('devices.webhookInactive')}</span>}
        </span>
        <ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <form onSubmit={save} className="space-y-3 border-t border-white/5 p-3">
          {!loaded ? (
            <p className="text-xs text-slate-400"><Loader2 size={12} className="mr-1 inline animate-spin" />{t('common.loading')}</p>
          ) : (
            <>
              <div>
                <label className="label">{t('devices.webhookUrl')}</label>
                <input type="url" required className="input" value={form.url} onChange={set('url')}
                  placeholder="https://meu-n8n.com/webhook/sms" />
              </div>

              <div>
                <label className="label">{t('devices.webhookSecret')}</label>
                <div className="flex gap-2">
                  <input type={reveal ? 'text' : 'password'} required className="input font-mono" value={form.secret_key}
                    onChange={set('secret_key')} autoComplete="off" placeholder="whsec_..." />
                  <button type="button" className="btn-ghost px-2" title={reveal ? t('tokens.hideToken') : t('tokens.showToken')} onClick={() => setReveal(!reveal)}>
                    {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button type="button" className="btn-ghost px-2" title={t('common.copy')} disabled={!form.secret_key} onClick={copy}>
                    <Copy size={14} />
                  </button>
                  <button type="button" className="btn-ghost whitespace-nowrap px-2"
                    onClick={() => { setForm({ ...form, secret_key: generateSecret() }); setReveal(true); }}>
                    <KeyRound size={14} /> {t('devices.webhookGenerate')}
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-center justify-between text-sm">
                <span>{t('devices.webhookIsActive')}</span>
                <button type="button" role="switch" aria-checked={form.is_active} onClick={toggle}
                  className={`relative h-6 w-11 rounded-full transition ${form.is_active ? 'bg-success' : 'bg-white/15'}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${form.is_active ? 'left-5' : 'left-0.5'}`} />
                </button>
              </label>

              <div className="flex gap-2">
                <button className="btn-primary flex-1" disabled={busy}>
                  {busy ? <Loader2 size={14} className="animate-spin" /> : null} {t('devices.webhookSave')}
                </button>
                <button type="button" className="btn-ghost" disabled={busy || !hook} onClick={test}>
                  <Send size={14} /> {t('devices.webhookTest')}
                </button>
              </div>
            </>
          )}
          {msg && <p className={`text-xs ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}
        </form>
      )}
      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border border-success/30 bg-surface px-4 py-3 text-sm text-success shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
