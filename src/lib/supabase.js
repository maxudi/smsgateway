import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://api.smsmax.netminas.com';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!anonKey) {
  console.warn('VITE_SUPABASE_ANON_KEY não configurada.');
}

// Cliente único compartilhado por toda a aplicação
export const supabase = createClient(url, anonKey ?? '');
