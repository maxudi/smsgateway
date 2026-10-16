import { useEffect, useState } from 'react';
import { Crown, ArrowUp, ArrowDown, ShieldCheck, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function Navbar({ onMenuClick }) {
  const { profile, plan, user, isMaster } = useAuth();
  const { lang, setLang, t } = useLanguage();
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
    const tInterval = setInterval(loadMonth, 30000);
    return () => { alive = false; clearInterval(tInterval); };
  }, [user?.id]);

  const max = isMaster ? 0 : plan?.max_sms_monthly ?? 0;
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  // Cor da barra muda conforme o consumo se aproxima do limite
  const barColor = pct >= 90 ? 'bg-danger' : pct >= 70 ? 'bg-yellow-400' : 'bg-success';
  const numLocale = lang === 'pt' ? 'pt-BR' : 'en-US';

  return (
    <header className="h-16 shrink-0 flex items-center justify-between gap-4 px-6 bg-surface/60 border-b border-white/5">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onMenuClick} aria-label="Abrir menu"
          className="md:hidden rounded-lg p-2 text-slate-300 hover:bg-white/5">
          <Menu size={22} />
        </button>
        <div className="text-sm text-slate-400 truncate">{profile?.name || user?.email}</div>
      </div>

      <div className="flex items-center gap-4 sm:gap-5">
        {/* Seletor Global de Idioma */}
        <div className="flex items-center bg-surface border border-white/10 rounded-xl p-0.5 shadow-inner">
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

        <div className="hidden lg:block w-52">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>{t('nav.monthlySms')}</span>
            <span className="flex items-center gap-2.5">
              <span className="flex items-center gap-0.5 text-success text-[11px]" title={t('nav.sentTooltip')}>
                <ArrowUp size={11} />{used.toLocaleString(numLocale)}
              </span>
              <span className="flex items-center gap-0.5 text-accent text-[11px]" title={t('nav.receivedTooltip')}>
                <ArrowDown size={11} />{month.received.toLocaleString(numLocale)}
              </span>
            </span>
          </div>
          <div className="mb-1 text-right text-[10px] text-slate-500">
            {used.toLocaleString(numLocale)} / {isMaster ? t('common.unlimited') : max ? `${max.toLocaleString(numLocale)} ${t('common.ofPlan')}` : `∞ ${t('common.ofPlan')}`}
          </div>
          <div className="h-1.5 rounded-full bg-bg overflow-hidden">
            <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <Link to="/perfil" className={`badge hover:bg-accent/25 ${isMaster ? 'bg-yellow-400/15 text-yellow-400' : 'bg-accent/15 text-accent'}`}>
          {isMaster ? <ShieldCheck size={14} /> : <Crown size={14} />} {isMaster ? t('nav.masterAdmin') : plan?.name ?? t('nav.noPlan')}
        </Link>
      </div>
    </header>
  );
}
