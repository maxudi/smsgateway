import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (err) setError(err.message);
        return;
      }

      const { data, error: err } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { name: form.name } },
      });
      if (err) {
        setError(err.message);
      } else if (data.session) {
        navigate('/', { replace: true }); // o dashboard fica na rota raiz
      } else if (data.user) {
        // Confirmação de e-mail exigida: sem sessão até o usuário clicar no link
        setNotice('Conta criada com sucesso! Verifique sua caixa de entrada para confirmar o e-mail antes de fazer login.');
        setMode('login');
        setForm((f) => ({ ...f, password: '' }));
      }
    } catch (err) {
      setError(err?.message ?? 'Não foi possível concluir a operação. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2 justify-center text-white text-xl font-bold">
          <MessageSquare className="text-accent" /> Max <span className="text-accent">Netminas</span>
        </div>
        {mode === 'signup' && (
          <div><label className="label">Nome</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        )}
        <div><label className="label">E-mail</label>
          <input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="label">Senha</label>
          <input type="password" minLength={6} className="input" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        {error && <p className="text-sm text-danger">{error}</p>}
        {notice && <p className="text-sm text-success">{notice}</p>}
        <button className="btn-primary w-full" disabled={busy}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
        <button type="button" className="text-xs text-slate-400 w-full hover:text-accent"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </button>
      </form>
    </div>
  );
}
