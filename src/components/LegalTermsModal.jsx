import { useState } from 'react';
import { X, FileText, ShieldCheck, Check, AlertTriangle, Ban } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function LegalTermsModal({ isOpen, onClose, onAccept, initialTab = 'terms' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const { t, lang } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div 
        className="card w-full max-w-2xl max-h-[85vh] flex flex-col p-0 border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-surface">
          <div>
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <ShieldCheck className="text-accent" size={20} />
              {t('terms.modalTitle')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('terms.modalSubtitle')}
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
            title={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-white/5 bg-black/20 px-5 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 ${
              activeTab === 'terms'
                ? 'bg-surface text-accent border-accent'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <FileText size={15} />
            <span>{t('terms.tabTerms')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 ${
              activeTab === 'privacy'
                ? 'bg-surface text-accent border-accent'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <ShieldCheck size={15} />
            <span>{t('terms.tabPrivacy')}</span>
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300 leading-relaxed max-h-[52vh]">
          {activeTab === 'terms' ? (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h4 className="font-semibold text-white text-base">{t('terms.t1Title')}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t('terms.t1Text')}
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-white text-base">{t('terms.t2Title')}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t('terms.t2Text')}
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold text-amber-200">
                  <AlertTriangle size={16} /> {t('terms.t3Title')}
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {t('terms.t3Text')}
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-white text-base">{t('terms.t4Title')}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t('terms.t4Text')}
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-white text-base">{t('terms.t5Title')}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t('terms.t5Text')}
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-danger/10 border border-danger/30 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold text-danger">
                  <Ban size={16} /> {t('terms.t6Title')}
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {t('terms.t6Text')}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h4 className="font-semibold text-white text-base">{t('terms.p1Title')}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t('terms.p1Text')}
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-white text-base">{t('terms.p2Title')}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t('terms.p2Text')}
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-white text-base">{t('terms.p3Title')}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t('terms.p3Text')}
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-white text-base">{t('terms.p4Title')}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t('terms.p4Text')}
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-white text-base">{t('terms.p5Title')}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t('terms.p5Text')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 bg-surface border-t border-white/5 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">
            {activeTab === 'terms' ? (lang === 'en' ? 'Document: Terms of Service v1.0' : 'Documento: Termos de Uso v1.0') : (lang === 'en' ? 'Document: Privacy Policy v1.0' : 'Documento: Política de Privacidade v1.0')}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost text-xs px-3.5 py-1.5"
            >
              {t('common.close')}
            </button>
            <button
              type="button"
              onClick={() => {
                onAccept();
                onClose();
              }}
              className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5 shadow-md shadow-accent/10"
            >
              <Check size={14} />
              <span>{t('terms.understandAndAccept')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
