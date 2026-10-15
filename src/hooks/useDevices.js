import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Lista de aparelhos do usuário, mantida em tempo real via Supabase Realtime.
 * Exige a tabela na publicação: alter publication supabase_realtime add table public.devices;
 */
export function useDevices(userId) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const fetchDevices = useCallback(async () => {
    const { data } = await supabase.from('devices').select('*').eq('user_id', userId)
      .order('last_ping', { ascending: false, nullsFirst: false });
    setDevices(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchDevices();

    // Mescla cada evento no estado local sem refazer a consulta
    const channel = supabase
      .channel(`devices-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setDevices((list) => list.filter((d) => d.id !== payload.old.id));
          return;
        }
        const row = payload.new;
        if (row.user_id !== userId) return;
        setDevices((list) => (list.some((d) => d.id === row.id)
          ? list.map((d) => (d.id === row.id ? { ...d, ...row } : d))
          : [row, ...list]));
      })
      .subscribe();

    // Reavalia online/offline mesmo sem eventos e reconcilia caso o Realtime perca algo
    const tick = setInterval(() => setTick((n) => n + 1), 10000);
    const poll = setInterval(fetchDevices, 30000);

    return () => {
      clearInterval(tick);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [userId, fetchDevices]);

  return { devices, loading, reload: fetchDevices };
}
