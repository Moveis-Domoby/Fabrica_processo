import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const EMPTY_SCORECARDS = {
  total_revenue: 0,
  total_orders: 0,
  total_clients: 0,
  recurrents: 0,
  recurrence_rate: 0,
  avg_ticket: 0,
};

// [DT-F1 + DT-F3, corrigido] Antes esta hook recebia só (start, end)
// já resolvidos em Date pelo componente chamador — os outros filtros
// (busca, itens, qtd de pedidos, inatividade, recompra, gasto) nunca
// chegavam à RPC, e o cálculo de start/end em JS (fuso local) diferia
// do cálculo em SQL que a tabela usa (fuso do banco), deslocando as
// janelas em algumas horas perto de virada de dia/mês/ano.
// Passamos o MESMO objeto de filtros (mesmo shape de fn_filter_customers)
// direto para a RPC, que resolve a janela de data em SQL puro.
//
// [DT-F6, corrigido] Migrado de useEffect cru para react-query: a queryKey
// serializada elimina a race condition (resposta velha sobrescrevendo a nova)
// e o AbortSignal cancela no servidor a requisição obsoleta. A assinatura
// pública ({ data, loading }) não mudou.
export function useScorecardsData(filters: any) {
  const rpcFilters = {
    searchQuery: filters?.searchQuery || '',
    dateFilter: filters?.dateFilter || 'all',
    customDateStart: filters?.customDateStart || '',
    customDateEnd: filters?.customDateEnd || '',
    specificMonth: filters?.specificMonth || '',
    specificDay: filters?.specificDay || '',
    specificYear: filters?.specificYear || '',
    selectedItems: filters?.selectedItems || [],
    purchaseCount: filters?.purchaseCount || [],
    inactiveBeforeDate: filters?.inactiveBeforeDate || '',
    recompraMinDays: filters?.recompraMinDays || '',
    recompraMaxDays: filters?.recompraMaxDays || '',
    spendAmount: filters?.spendAmount || '',
    spendType: filters?.spendType || 'total',
    spendMode: filters?.spendMode || 'above',
  };

  const { data, isFetching } = useQuery({
    queryKey: ['scorecards', JSON.stringify(rpcFilters)],
    queryFn: async ({ signal }) => {
      const { data: result, error } = await supabase
        .rpc('fn_dashboard_scorecards', { p_filters: rpcFilters })
        .abortSignal(signal);

      if (error) throw error;

      if (result && result.length > 0) {
        const row = result[0];
        return {
          total_revenue: Number(row.total_revenue) || 0,
          total_orders: Number(row.total_orders) || 0,
          total_clients: Number(row.total_clients) || 0,
          recurrents: Number(row.recurrents) || 0,
          recurrence_rate: Number(row.recurrence_rate) || 0,
          avg_ticket: Number(row.avg_ticket) || 0,
        };
      }
      return EMPTY_SCORECARDS;
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 60_000,
  });

  return { data: data ?? EMPTY_SCORECARDS, loading: isFetching };
}
