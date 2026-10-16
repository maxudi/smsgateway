import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { en } from '../locales/en.js';
import { pt } from '../locales/pt.js';

const translations = { en, pt };

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem('smsmax_lang');
      if (saved === 'en' || saved === 'pt') return saved;
    } catch {
      // Falha de acesso ao localStorage (ex.: modo anônimo estrito)
    }
    return 'en'; // Inglês como padrão
  });

  const setLang = useCallback((newLang) => {
    const valid = newLang === 'pt' ? 'pt' : 'en';
    setLangState(valid);
    try {
      localStorage.setItem('smsmax_lang', valid);
    } catch (e) {
      console.warn('Não foi possível salvar o idioma no localStorage:', e);
    }
  }, []);

  /**
   * Função de tradução t('secao.chave', { variavel: 'valor' })
   */
  const t = useCallback((path, vars) => {
    if (!path) return '';
    const keys = path.split('.');
    
    // Tenta no idioma selecionado
    let current = translations[lang];
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        current = null;
        break;
      }
    }

    // Fallback para inglês
    if (current === null || current === undefined) {
      let fallback = translations.en;
      for (const k of keys) {
        if (fallback && typeof fallback === 'object' && k in fallback) {
          fallback = fallback[k];
        } else {
          fallback = null;
          break;
        }
      }
      current = fallback;
    }

    if (current === null || current === undefined) {
      return path;
    }

    if (typeof current === 'string' && vars && typeof vars === 'object') {
      let interpolated = current;
      for (const [varKey, varVal] of Object.entries(vars)) {
        interpolated = interpolated.replaceAll(`{${varKey}}`, String(varVal));
      }
      return interpolated;
    }

    return current;
  }, [lang]);

  const value = {
    lang,
    setLang,
    t,
    dictionary: translations[lang] || en,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Retorna fallback seguro se chamado fora do provider
    return {
      lang: 'en',
      setLang: () => {},
      t: (k) => k,
      dictionary: en,
    };
  }
  return context;
};
