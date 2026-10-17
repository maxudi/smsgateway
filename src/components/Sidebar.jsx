import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Key, Smartphone, Users, Send, ListChecks, CreditCard, MessageSquare, LogOut, Megaphone, UserCircle, BookOpen, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function Sidebar({ mobileOpen = false, onClose }) {
  const { signOut, isMaster } = useAuth();
  const { t } = useLanguage();

  const links = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/dispositivos', label: t('nav.devices'), icon: Smartphone },
    { to: '/contatos', label: t('nav.contacts'), icon: Users },
    { to: '/disparar', label: t('nav.sendSms'), icon: Send },
    { to: '/campanhas', label: t('nav.campaigns'), icon: Megaphone },
    { to: '/fila', label: t('nav.queue'), icon: ListChecks },
    { to: '/planos', label: t('nav.plans'), icon: CreditCard },
    { to: '/api-tokens', label: t('nav.apiTokens'), icon: Key },
    { to: '/docs', label: t('nav.docs'), icon: BookOpen },
    { to: '/perfil', label: t('nav.profile'), icon: UserCircle },
    ...(isMaster ? [{ to: '/admin', label: 'Admin · Clientes', icon: ShieldCheck }] : []),
  ];

  return (
    <>
    {mobileOpen && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose} aria-hidden="true" />}
    <aside className={`${mobileOpen ? 'fixed inset-y-0 left-0 z-40 flex shadow-2xl' : 'hidden'} md:static md:z-auto md:flex md:shadow-none w-60 shrink-0 flex-col bg-surface border-r border-white/5`}>
      <div className="flex items-center gap-2.5 px-5 py-5">
        <img src="/logo-icon.png" alt="Max Netminas" className="h-9 w-9 object-contain shrink-0" />
        <span className="text-lg font-bold text-white">Max <span className="text-accent">Netminas</span></span>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                isActive ? 'bg-accent/15 text-accent' : 'text-slate-300 hover:bg-white/5'
              }`
            }
          >
            <Icon size={18} /> {label}
          </NavLink>
        ))}
      </nav>

      <button onClick={signOut} className="m-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5">
        <LogOut size={18} /> {t('nav.signOut')}
      </button>
    </aside>
    </>
  );
}
