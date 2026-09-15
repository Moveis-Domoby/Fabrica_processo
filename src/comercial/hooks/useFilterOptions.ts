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
        // Fetch unique items from top items overall RPC
        const { data: itemsData } = await supabase.rpc('fn_dashboard_top_items_overall', {
          p_start: null,
          p_end: null
        });
        
        if (itemsData) {
          const items = itemsData.map((r: any) => r.item_name).filter(Boolean);
          setAvailableItems(items.sort((a: string, b: string) => a.localeCompare(b)));
        }

        // Fetch max purchase count — [SESSAO-20] a leitura direta de
        // vw_clientes_consolidados virou a RPC gateada fn_clientes_consolidados
        // (item 0/A da união): só o maior total_pedidos interessa aqui.
        const { data: topClients } = await supabase.rpc('fn_clientes_consolidados', {
          p_ordem: 'pedidos',
          p_limit: 1,
        });
        
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
