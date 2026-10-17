import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, Smartphone, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import LegalTermsModal from '../components/LegalTermsModal.jsx';

export default function Login({ initialMode }) {
  const { session } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState(() => {
    if (initialMode) return initialMode;
    if (location.pathname === '/register' || location.pathname === '/cadastro') return 'signup';
    return 'login';
  });

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    } else if (location.pathname === '/register' || location.pathname === '/cadastro') {
      setMode('signup');
    } else if (location.pathname === '/login') {
      setMode('login');
    }
  }, [location.pathname, initialMode]);

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsModalTab, setTermsModalTab] = useState('terms');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setNotice('');
    if (newMode === 'signup') {
      navigate('/register');
    } else {
      navigate('/login');
    }
  };

  const openTermsModal = (tab = 'terms') => {
    setTermsModalTab(tab);
    setShowTermsModal(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); 
    setError(''); 
    setNotice('');

    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ 
          email: form.email, 
          password: form.password 
        });
        if (err) setError(err.message);
        return;
      }

      // Validação de segurança no cadastro
      if (!acceptedTerms) {
        setError(t('auth.termsRequiredError'));
        return;
      }

      const termsAcceptedAt = new Date().toISOString();

      const { data, error: err } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { 
          data: { 
            name: form.name,
            accepted_terms: true,
            accepted_terms_at: termsAcceptedAt,
          } 
        },
      });

      if (err) {
        setError(err.message);
      } else {
        // Tenta gravar também no perfil do usuário
        if (data?.user?.id) {
          try {
            await supabase.from('user_profiles').update({
              accepted_terms: true,
              accepted_terms_at: termsAcceptedAt,
            }).eq('id', data.user.id);
          } catch (_profileErr) {
            // Ignorado caso a tabela ou linha ainda não exista
          }
        }

        if (data.session) {
          navigate('/', { replace: true });
        } else if (data.user) {
          setNotice(t('auth.signupSuccessNotice'));
          switchMode('login');
          setForm((f) => ({ ...f, password: '' }));
        }
      }
    } catch (err) {
      console.error('Falha no processo de autenticação:', err);
      setError(err?.message ?? t('auth.authGenericError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Alternador de Idioma Flutuante */}
      <div className="absolute top-4 right-4 z-10 flex items-center bg-surface border border-white/10 rounded-xl p-0.5 shadow-lg">
        <button
          type="button"
          onClick={() => setLang('en')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
            lang === 'en'
              ? 'bg-accent/20 text-accent border border-accent/30 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
          title="Switch to English"
        >
          <span>🇺🇸</span>
          <span className="font-mono text-[11px]">EN</span>
        </button>
        <button
          type="button"
          onClick={() => setLang('pt')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
            lang === 'pt'
              ? 'bg-accent/20 text-accent border border-accent/30 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
          title="Mudar para Português (Brasil)"
        >
          <span>🇧🇷</span>
          <span className="font-mono text-[11px]">PT-BR</span>
        </button>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <form onSubmit={submit} className="card w-full space-y-4 shadow-2xl border border-white/5">
          <div className="flex flex-col items-center justify-center gap-1.5 pb-1">
            <img
              src="/logo-icon.png"
              alt="Max Netminas"
              className="h-16 w-auto object-contain drop-shadow-[0_4px_16px_rgba(34,211,238,0.2)]"
            />
            <div className="text-white text-2xl font-extrabold tracking-tight leading-none">
              Max <span className="text-accent font-semibold">Netminas</span>
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="label">{t('auth.nameLabel')}</label>
              <input 
                className="input" 
                required 
                value={form.name} 
                onChange={(e) => setForm({ ...form, name: e.target.value })} 
                placeholder={t('auth.namePlaceholder')}
              />
            </div>
          )}

          <div>
            <label className="label">{t('auth.emailLabel')}</label>
            <input 
              type="email" 
              className="input" 
              required 
              value={form.email} 
              onChange={(e) => setForm({ ...form, email: e.target.value })} 
              placeholder={t('auth.emailPlaceholder')}
            />
          </div>

          <div>
            <label className="label">{t('auth.passwordLabel')}</label>
            <input 
              type="password" 
              minLength={6} 
              className="input" 
              required 
              value={form.password} 
              onChange={(e) => setForm({ ...form, password: e.target.value })} 
              placeholder={t('auth.passwordPlaceholder')}
            />
          </div>

          {/* Checkbox de Conformidade LGPD e Termos de Serviço */}
          {mode === 'signup' && (
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  id="terms-checkbox"
                  required
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-surface text-accent focus:ring-accent focus:ring-offset-bg cursor-pointer shrink-0"
                />
                <span className="text-xs text-slate-300 leading-snug">
                  {t('auth.termsConsentText')}{' '}
                  <button
                    type="button"
                    onClick={() => openTermsModal('terms')}
                    className="text-accent underline hover:text-accent/80 font-medium inline transition"
                  >
                    {t('auth.termsLinkText')}
                  </button>{' '}
                  {t('auth.andText')}{' '}
                  <button
                    type="button"
                    onClick={() => openTermsModal('privacy')}
                    className="text-accent underline hover:text-accent/80 font-medium inline transition"
                  >
                    {t('auth.privacyLinkText')}
                  </button>.
                </span>
              </label>
            </div>
          )}

          {error && <p className="text-sm text-danger bg-danger/10 p-3 rounded-lg border border-danger/20">{error}</p>}
          {notice && <p className="text-sm text-success bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">{notice}</p>}

          <button 
            type="submit" 
            className="btn-primary w-full shadow-lg shadow-accent/10 transition" 
            disabled={busy || (mode === 'signup' && !acceptedTerms)}
          >
            {busy ? t('auth.processing') : mode === 'login' ? t('auth.loginButton') : t('auth.signupButton')}
          </button>

          <button 
            type="button" 
            className="text-xs text-slate-400 w-full hover:text-accent transition pt-1"
            onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}
          </button>
        </form>

        {/* Bloco de Download Direto do APK Android Oficial */}
        <div className="card p-4 bg-surface/80 border border-white/10 hover:border-emerald-500/30 transition shadow-xl space-y-3">
          <div className="flex items-center gap-3 text-left">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/25 shadow-md">
              <Smartphone size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white tracking-wide flex items-center gap-1.5 flex-wrap">
                <span>{t('auth.apkDownloadTitle')}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                  APK
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                {t('auth.apkDownloadDesc')}
              </p>
            </div>
          </div>
          <a
            href="https://api.smsmax.netminas.com/storage/v1/object/public/app/app-release.apk"
            target="_blank"
            rel="noopener noreferrer"
            download="smsmax-gateway.apk"
            className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold bg-white/5 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/40 transition shadow-sm group"
          >
            <Download size={14} className="group-hover:-translate-y-0.5 transition-transform text-emerald-400" />
            <span>{t('auth.apkDownloadBtn')}</span>
          </a>
        </div>
      </div>

      {/* Modal de Termos de Uso e LGPD */}
      <LegalTermsModal
        isOpen={showTermsModal}
        initialTab={termsModalTab}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => setAcceptedTerms(true)}
      />
    </div>
  );
}
