import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import Navbar from './components/Navbar.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Devices from './pages/Devices.jsx';
import Contacts from './pages/Contacts.jsx';
import SendCampaign from './pages/SendCampaign.jsx';
import CampaignsManager from './pages/CampaignsManager.jsx';
import QueueManager from './pages/QueueManager.jsx';
import PlansPricing from './pages/PlansPricing.jsx';
import Profile from './pages/Profile.jsx';
import ApiTokens from './pages/ApiTokens.jsx';
import Docs from './pages/Docs.jsx';
import Terms from './pages/Terms.jsx';

/** Layout autenticado: Sidebar + Navbar + conteúdo. */
function ProtectedLayout() {
  const { session, loading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Fecha a gaveta ao navegar para outra página
  useEffect(() => { setIsMobileMenuOpen(false); }, [pathname]);

  if (loading) return <div className="p-10 text-slate-400">Carregando...</div>;
  if (!session) return <Navigate to="/login" replace />;
  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className="flex-1 p-6 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  );
}

export default function App() {
  const { session } = useAuth();
  return (
    <Routes>
      {/* 1. Rotas Públicas (acessíveis pelo app Android e WebViews) */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Login initialMode="signup" />} />
      <Route path="/cadastro" element={<Login initialMode="signup" />} />
      <Route path="/termos" element={<Terms />} />
      <Route path="/terms" element={<Terms />} />
      
      {/* Rota pública de Documentação se visitante deslogado */}
      {!session && <Route path="/docs" element={<Docs standalone />} />}

      {/* 2. Rotas Autenticadas do Painel / Dashboard */}
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dispositivos" element={<Devices />} />
        <Route path="/contatos" element={<Contacts />} />
        <Route path="/disparar" element={<SendCampaign />} />
        <Route path="/campanhas" element={<CampaignsManager />} />
        <Route path="/fila" element={<QueueManager />} />
        <Route path="/planos" element={<PlansPricing />} />
        <Route path="/api-tokens" element={<ApiTokens />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/perfil" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
