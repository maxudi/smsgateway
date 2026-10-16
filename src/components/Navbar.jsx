import { useEffect, useState } from 'react';
import { Crown, ArrowUp, ArrowDown, ShieldCheck, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar({ onMenuClick }) {
  const { profile, plan, user, isMaster } = useAuth();
  const [month, setMonth] = useState({ sent: 0, received: 0 });
  const used = month.sent;

  // Enviados e recebidos do mês vêm da RPC, já somados por usuário (todos os aparelhos e chips)
  useEffect(() => {
    if (!user?.id) return undefined;
    let alive = true;
    const loadMonth = async () => {
      const { data, error } = await supabase.rpc('get_dashboard_analytics');
      if (!alive || error || !data?.current_month) return;
      setMonth({ sent: data.current_month.sent ?? 0, received: data.current_month.received ?? 0 });
    };
    loadMonth();
    const t = setInterval(loadMonth, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [user?.id]);

  const max = isMaster ? 0 : plan?.max_sms_monthly ?? 0;
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  // Cor da barra muda conforme o consumo se aproxima do limite
  const barColor = pct >= 90 ? 'bg-danger' : pct >= 70 ? 'bg-yellow-400' : 'bg-success';

  return (
    <header className="h-16 shrink-0 flex items-center justify-between gap-4 px-6 bg-surface/60 border-b border-white/5">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onMenuClick} aria-label="Abrir menu"
          className="md:hidden rounded-lg p-2 text-slate-300 hover:bg-white/5">
          <Menu size={22} />
        </button>
        <div className="text-sm text-slate-400 truncate">{profile?.name || user?.email}</div>
      </div>

      <div className="flex items-center gap-5">
        <div className="hidden sm:block w-56">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>SMS no mês</span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-0.5 text-success" title="Enviados no mês">
                <ArrowUp size={12} />{used.toLocaleString('pt-BR')}
              </span>
              <span className="flex items-center gap-0.5 text-accent" title="Recebidos no mês">
                <ArrowDown size={12} />{month.received.toLocaleString('pt-BR')}
              </span>
            </span>
          </div>
          <div className="mb-1 text-right text-[10px] text-slate-500">
            {used.toLocaleString('pt-BR')} / {isMaster ? 'Ilimitado' : max ? `${max.toLocaleString('pt-BR')} do plano` : '∞ do plano'}
          </div>
          <div className="h-1.5 rounded-full bg-bg overflow-hidden">
            <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <Link to="/perfil" className={`badge hover:bg-accent/25 ${isMaster ? 'bg-yellow-400/15 text-yellow-400' : 'bg-accent/15 text-accent'}`}>
          {isMaster ? <ShieldCheck size={14} /> : <Crown size={14} />} {isMaster ? 'Admin Master' : plan?.name ?? 'Sem plano'}
        </Link>
      </div>
    </header>
  );
}
