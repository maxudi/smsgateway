import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ShortLinkRedirect() {
  const { code } = useParams();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const cleanCode = String(code || '').trim();
      if (!cleanCode) {
        if (active) setNotFound(true);
        return;
      }

      try {
        // 1. Tenta resolver e contabilizar o clique via RPC segura
        const { data: rpcUrl, error: rpcErr } = await supabase.rpc('resolve_short_link', {
          p_code: cleanCode,
        });

        if (!rpcErr && rpcUrl) {
          window.location.replace(rpcUrl);
          return;
        }

        // 2. Fallback direto na tabela short_links caso a RPC ainda não exista
        const { data: row } = await supabase
          .from('short_links')
          .select('destination_url, clicks')
          .eq('code', cleanCode)
          .maybeSingle();

        if (row?.destination_url) {
          supabase
            .from('short_links')
            .update({ clicks: Number(row.clicks ?? 0) + 1, clicked_at: new Date().toISOString() })
            .eq('code', cleanCode)
            .then(() => {});
          window.location.replace(row.destination_url);
          return;
        }

        if (active) setNotFound(true);
      } catch {
        if (active) setNotFound(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [code]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6 text-slate-200">
      <div className="card max-w-sm w-full text-center space-y-4 border border-white/10">
        {!notFound ? (
          <>
            <Loader2 size={28} className="mx-auto animate-spin text-accent" />
            <h1 className="text-base font-semibold text-white">Redirecionando...</h1>
            <p className="text-xs text-slate-400">Aguarde um instante enquanto abrimos o link.</p>
          </>
        ) : (
          <>
            <ExternalLink size={28} className="mx-auto text-slate-500" />
            <h1 className="text-base font-semibold text-white">Link não encontrado ou expirado</h1>
            <p className="text-xs text-slate-400">
              Verifique se o endereço foi digitado corretamente.
            </p>
            <Link to="/" className="btn-ghost text-xs mx-auto inline-flex">
              Ir para a página inicial
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

