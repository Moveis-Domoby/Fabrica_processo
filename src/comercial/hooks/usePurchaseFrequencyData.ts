import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function usePurchaseFrequencyData(start: Date | null, end: Date | null) {
  const [data, setData] = useState<{ pedidos_count: number; faturamento_total: number; clientes_count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const pStart = start ? start.toISOString() : null;
        const pEnd = end ? end.toISOString() : null;

        const { data: result, error } = await supabase.rpc('fn_dashboard_purchase_frequency', {
          p_start: pStart,
          p_end: pEnd
        });

        if (error) throw error;
        
        if (result) {
          setData(result.map((r: any) => ({
            pedidos_count: Number(r.pedidos_count),
            faturamento_total: Number(r.faturamento_total),
            clientes_count: Number(r.clientes_count)
          })));
        }
      } catch (err) {
        console.error('Error fetching purchase frequency data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [start, end]);

  return { data, loading };
}
