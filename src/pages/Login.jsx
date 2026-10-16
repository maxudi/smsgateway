import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import LegalTermsModal from '../components/LegalTermsModal.jsx';

export default function Login({ initialMode }) {
  const { session } = useAuth();
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
        setError('Você deve concordar com os Termos de Uso e Política de Privacidade (LGPD) para criar sua conta.');
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
          // Confirmação de e-mail exigida
          setNotice('Conta criada com sucesso! Verifique sua caixa de entrada para confirmar o e-mail antes de fazer login.');
          switchMode('login');
          setForm((f) => ({ ...f, password: '' }));
        }
      }
    } catch (err) {
      console.error('Falha no processo de autenticação:', err);
      setError(err?.message ?? 'Não foi possível concluir a operação. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 shadow-2xl border border-white/5">
        <div className="flex items-center gap-2 justify-center text-white text-xl font-bold tracking-tight">
          <MessageSquare className="text-accent" /> Max <span className="text-accent">Netminas</span>
        </div>

        {mode === 'signup' && (
          <div>
            <label className="label">Nome / Razão Social</label>
            <input 
              className="input" 
              required 
              value={form.name} 
              onChange={(e) => setForm({ ...form, name: e.target.value })} 
              placeholder="Seu nome completo ou empresa"
            />
          </div>
        )}

        <div>
          <label className="label">E-mail</label>
          <input 
            type="email" 
            className="input" 
            required 
            value={form.email} 
            onChange={(e) => setForm({ ...form, email: e.target.value })} 
            placeholder="seu@email.com"
          />
        </div>

        <div>
          <label className="label">Senha</label>
          <input 
            type="password" 
            minLength={6} 
            className="input" 
            required 
            value={form.password} 
            onChange={(e) => setForm({ ...form, password: e.target.value })} 
            placeholder="Mínimo 6 caracteres"
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
                Li e concordo com os{' '}
                <button
                  type="button"
                  onClick={() => openTermsModal('terms')}
                  className="text-accent underline hover:text-accent/80 font-medium inline transition"
                >
                  Termos de Uso e Serviço
                </button>{' '}
                e com a{' '}
                <button
                  type="button"
                  onClick={() => openTermsModal('privacy')}
                  className="text-accent underline hover:text-accent/80 font-medium inline transition"
                >
                  Política de Privacidade (LGPD)
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
          {busy ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Criar Conta'}
        </button>

        <button 
          type="button" 
          className="text-xs text-slate-400 w-full hover:text-accent transition pt-1"
          onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </button>
      </form>

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
