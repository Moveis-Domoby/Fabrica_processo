import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useFilterOptions() {
  const [availableItems, setAvailableItems] = useState<string[]>([]);
  const [availablePurchaseCounts, setAvailablePurchaseCounts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOptions() {
      setLoading(true);
      try {
        // SESSAO-32 (Lei §3, nada em cascata): as duas leituras saem juntas — os
        // itens de todo o período e o maior nº de pedidos já vêm prontos do banco.
        // [SESSAO-20] a leitura direta de vw_clientes_consolidados virou a RPC
        // gateada fn_clientes_consolidados: só o maior total_pedidos interessa aqui.
        const [{ data: itemsData }, { data: topClients }] = await Promise.all([
          supabase.rpc('fn_dashboard_top_items_overall', { p_start: null, p_end: null }),
          supabase.rpc('fn_clientes_consolidados', { p_ordem: 'pedidos', p_limit: 1 }),
        ]);

        if (itemsData) {
          const items = itemsData.map((r: any) => r.item_name).filter(Boolean);
          setAvailableItems(items.sort((a: string, b: string) => a.localeCompare(b)));
        }
        
        let max = 15;
        if (topClients && topClients.length > 0) {
          max = Number(topClients[0].total_pedidos) || 15;
        }
        
        const counts = [];
        for (let i = 1; i <= max; i++) {
          counts.push(i.toString());
        }
        setAvailablePurchaseCounts(counts);

      } catch (err) {
        console.error('Error fetching filter options:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchOptions();
  }, []);

  return { availableItems, availablePurchaseCounts, loading };
}
