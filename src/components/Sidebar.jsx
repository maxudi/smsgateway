import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Smartphone, Users, Send, ListChecks, CreditCard, MessageSquare, LogOut, Megaphone, UserCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dispositivos', label: 'Dispositivos', icon: Smartphone },
  { to: '/contatos', label: 'Contatos', icon: Users },
  { to: '/disparar', label: 'Disparar SMS', icon: Send },
  { to: '/campanhas', label: 'Campanhas', icon: Megaphone },
  { to: '/fila', label: 'Fila/Histórico', icon: ListChecks },
  { to: '/planos', label: 'Planos', icon: CreditCard },
  { to: '/perfil', label: 'Perfil / Planos', icon: UserCircle },
];

export default function Sidebar() {
  const { signOut } = useAuth();
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-surface border-r border-white/5">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="h-9 w-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
          <MessageSquare size={20} />
        </div>
        <span className="text-lg font-bold text-white">Max <span className="text-accent">Netminas</span></span>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
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
        <LogOut size={18} /> Sair
      </button>
    </aside>
  );
}
