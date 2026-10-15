import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Máscara: "9" = dígito. Ajuste/adicione países conforme necessário.
export const COUNTRIES = [
  { iso: 'br', name: 'Brasil', dial: '55', mask: '(99) 9 9999-9999' },
  { iso: 'us', name: 'Estados Unidos', dial: '1', mask: '(999) 999-9999' },
  { iso: 'pt', name: 'Portugal', dial: '351', mask: '999 999 999' },
  { iso: 'ar', name: 'Argentina', dial: '54', mask: '99 9999-9999' },
  { iso: 'py', name: 'Paraguai', dial: '595', mask: '999 999 999' },
  { iso: 'uy', name: 'Uruguai', dial: '598', mask: '99 999 999' },
  { iso: 'cl', name: 'Chile', dial: '56', mask: '9 9999 9999' },
  { iso: 'co', name: 'Colômbia', dial: '57', mask: '999 999 9999' },
  { iso: 'mx', name: 'México', dial: '52', mask: '99 9999 9999' },
  { iso: 'pe', name: 'Peru', dial: '51', mask: '999 999 999' },
  { iso: 'bo', name: 'Bolívia', dial: '591', mask: '9999 9999' },
  { iso: 'es', name: 'Espanha', dial: '34', mask: '999 99 99 99' },
  { iso: 'fr', name: 'França', dial: '33', mask: '9 99 99 99 99' },
  { iso: 'de', name: 'Alemanha', dial: '49', mask: '9999 9999999' },
  { iso: 'it', name: 'Itália', dial: '39', mask: '999 999 9999' },
  { iso: 'gb', name: 'Reino Unido', dial: '44', mask: '9999 999999' },
  { iso: 'ao', name: 'Angola', dial: '244', mask: '999 999 999' },
  { iso: 'mz', name: 'Moçambique', dial: '258', mask: '99 999 9999' },
];

const maxDigits = (mask) => (mask.match(/9/g) || []).length;

/** Aplica a máscara aos dígitos; literais só aparecem quando há dígito seguinte. */
function applyMask(digits, mask) {
  let out = '';
  let i = 0;
  for (const ch of mask) {
    if (i >= digits.length) break;
    if (ch === '9') out += digits[i++];
    else out += ch;
  }
  return out;
}

const Flag = ({ iso }) => (
  <img src={`https://flagcdn.com/w20/${iso}.png`} alt={iso} width="20" height="15" className="rounded-[2px]" />
);

/**
 * Campo de telefone com seletor de país + máscara.
 * onChange(fullNumber, isValid) — fullNumber = DDI + número, apenas dígitos (ex.: 5534999999999).
 */
export default function PhoneInput({ onChange, defaultIso = 'br' }) {
  const [country, setCountry] = useState(COUNTRIES.find((c) => c.iso === defaultIso));
  const [digits, setDigits] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef();

  useEffect(() => {
    onChange?.(country.dial + digits, digits.length === maxDigits(country.mask));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, digits]);

  useEffect(() => {
    const close = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (c) => { setCountry(c); setDigits(''); setOpen(false); };

  return (
    <div className="flex gap-2" ref={boxRef}>
      <div className="relative">
        <button type="button" className="input flex items-center gap-2 !w-auto" onClick={() => setOpen(!open)}>
          <Flag iso={country.iso} /> <span>+{country.dial}</span> <ChevronDown size={14} />
        </button>
        {open && (
          <ul className="absolute z-50 mt-1 max-h-60 w-60 overflow-y-auto rounded-lg border border-white/10 bg-surface shadow-xl">
            {COUNTRIES.map((c) => (
              <li key={c.iso}>
                <button type="button" onClick={() => pick(c)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5">
                  <Flag iso={c.iso} /> <span className="flex-1">{c.name}</span>
                  <span className="text-slate-400">+{c.dial}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <input
        className="input font-mono"
        inputMode="numeric"
        placeholder={country.mask.replace(/9/g, '0')}
        value={applyMask(digits, country.mask)}
        onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, maxDigits(country.mask)))}
      />
    </div>
  );
}
