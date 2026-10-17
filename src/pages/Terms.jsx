import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, FileText, Scale, ArrowLeft,
  AlertTriangle, Ban, CheckCircle2, MessageSquare
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function Terms() {
  const [activeTab, setActiveTab] = useState('terms');
  const { lang, setLang, t } = useLanguage();

  return (
    <div className="min-h-screen bg-bg text-slate-200">
      {/* Barra Superior / Header */}
      <header className="border-b border-white/5 bg-surface/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 text-white font-bold text-lg hover:opacity-90 transition">
              <img src="/logo-icon.png" alt="Max Netminas" className="h-8 w-8 object-contain shrink-0" />
              <span>Max <span className="text-accent">Netminas</span></span>
            </Link>
            <span className="hidden sm:inline text-xs text-slate-500">•</span>
            <span className="hidden sm:inline text-xs text-slate-400 font-medium">
              {t('terms.modalTitle')}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
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

            <Link
              to="/docs"
              className="text-slate-400 hover:text-white transition hidden md:inline"
            >
              {t('terms.viewApiDocs')}
            </Link>
            <Link
              to="/login"
              className="btn-ghost text-xs px-3 py-1.5"
            >
              {t('auth.loginButton')}
            </Link>
            <Link
              to="/register"
              className="btn-primary text-xs px-3.5 py-1.5 shadow-md shadow-accent/10"
            >
              {t('auth.signupButton')}
            </Link>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Cabeçalho da Página */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold">
            <Scale size={14} />
            <span>{t('terms.pageBadge')}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
            {t('terms.pageTitle')}
          </h1>
          <p className="text-sm text-slate-400 max-w-3xl leading-relaxed">
            {t('terms.pageSubtitle')}
          </p>
          <p className="text-xs text-slate-500">
            {t('terms.lastUpdated')}
          </p>
        </div>

        {/* Abas de Navegação */}
        <div className="flex border-b border-white/10 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-t-xl transition border-b-2 whitespace-nowrap ${
              activeTab === 'terms'
                ? 'bg-surface text-accent border-accent'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <FileText size={16} />
            <span>{t('terms.tabTerms')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-t-xl transition border-b-2 whitespace-nowrap ${
              activeTab === 'privacy'
                ? 'bg-surface text-accent border-accent'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <ShieldCheck size={16} />
            <span>{t('terms.tabPrivacy')}</span>
          </button>
        </div>

        {/* Documentos */}
        <div className="card border border-white/10 shadow-xl bg-surface p-6 sm:p-8 space-y-8">
          {activeTab === 'terms' ? (
            <div className="space-y-8 text-sm text-slate-300 leading-relaxed">
              <section className="space-y-2.5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-accent">1.</span> {t('terms.t1Title')}
                </h2>
                <p>{t('terms.t1Text')}</p>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-accent">2.</span> {t('terms.t2Title')}
                </h2>
                <p>{t('terms.t2Text')}</p>
              </section>

              <section className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-amber-200 text-xs">
                <div className="flex items-center gap-2 font-bold text-amber-100 text-sm">
                  <AlertTriangle size={18} className="text-amber-400" />
                  {t('terms.t3Title')}
                </div>
                <p className="leading-relaxed text-slate-300">{t('terms.t3Text')}</p>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-accent">4.</span> {t('terms.t4Title')}
                </h2>
                <p>{t('terms.t4Text')}</p>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-accent">5.</span> {t('terms.t5Title')}
                </h2>
                <p>{t('terms.t5Text')}</p>
              </section>

              <section className="p-4 rounded-xl bg-danger/10 border border-danger/30 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-danger text-sm">
                  <Ban size={18} />
                  {t('terms.t6Title')}
                </div>
                <p className="leading-relaxed text-slate-300 font-semibold text-rose-300">
                  {t('terms.t6Text')}
                </p>
              </section>
            </div>
          ) : (
            <div className="space-y-8 text-sm text-slate-300 leading-relaxed">
              <section className="space-y-2.5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-accent">1.</span> {t('terms.p1Title')}
                </h2>
                <p>{t('terms.p1Text')}</p>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-accent">2.</span> {t('terms.p2Title')}
                </h2>
                <p>{t('terms.p2Text')}</p>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-accent">3.</span> {t('terms.p3Title')}
                </h2>
                <p>{t('terms.p3Text')}</p>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-accent">4.</span> {t('terms.p4Title')}
                </h2>
                <p>{t('terms.p4Text')}</p>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-accent">5.</span> {t('terms.p5Title')}
                </h2>
                <p>{t('terms.p5Text')}</p>
              </section>
            </div>
          )}
        </div>

        {/* Rodapé com Botões de Ação */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5 text-xs text-slate-400">
          <Link
            to="/register"
            className="flex items-center gap-1.5 text-accent hover:underline font-medium"
          >
            <ArrowLeft size={14} />
            <span>{t('terms.returnToRegister')}</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/docs" className="hover:text-white transition">
              {t('terms.viewApiDocs')}
            </Link>
            <span>•</span>
            <Link to="/login" className="hover:text-white transition">
              {t('terms.dashboardAccess')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
