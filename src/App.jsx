import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
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

/** Layout autenticado: Sidebar + Navbar + conteúdo. */
function ProtectedLayout() {
  const { session, loading } = useAuth();
  if (loading) return <div className="p-10 text-slate-400">Carregando...</div>;
  if (!session) return <Navigate to="/login" replace />;
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 p-6 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dispositivos" element={<Devices />} />
        <Route path="/contatos" element={<Contacts />} />
        <Route path="/disparar" element={<SendCampaign />} />
        <Route path="/campanhas" element={<CampaignsManager />} />
        <Route path="/fila" element={<QueueManager />} />
        <Route path="/planos" element={<PlansPricing />} />
        <Route path="/perfil" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
