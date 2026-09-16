import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { GroupedCustomer } from '../types';

// [DT-F6, corrigido] Este hook usava useEffect cru: sem cache, sem dedupe e
// sem cancelamento — uma resposta antiga que chegasse depois sobrescrevia a
// mais nova (race condition clássica ao digitar na busca). Migrado para
// react-query (preferência registrada em _Docs/030 - Stack e Convencoes):
// a queryKey serializada garante que cada resposta só preenche a sua própria
// entrada de cache, e o AbortSignal cancela no servidor a requisição obsoleta.
// A assinatura pública ({ data, totalCount, loading }) não mudou.
export function useCustomersPaginated(page: number, pageSize: number, filters: any) {
  const rpcFilters = {
    searchQuery: filters.searchQuery || '',
    dateFilter: filters.dateFilter || 'all',
    customDateStart: filters.customDateStart || '',
    customDateEnd: filters.customDateEnd || '',
    specificMonth: filters.specificMonth || '',
    specificDay: filters.specificDay || '',
    specificYear: filters.specificYear || '',
    selectedItems: filters.selectedItems || [],
    purchaseCount: filters.purchaseCount || [],
    inactiveBeforeDate: filters.inactiveBeforeDate || '',
    recompraMinDays: filters.recompraMinDays || '',
    recompraMaxDays: filters.recompraMaxDays || '',
    spendAmount: filters.spendAmount || '',
    spendType: filters.spendType || 'total',
    spendMode: filters.spendMode || 'above'
  };

  const { data: result, isFetching } = useQuery({
    queryKey: ['customersPaginated', page, pageSize, JSON.stringify(rpcFilters)],
    queryFn: async ({ signal }) => {
      const { data: rpcData, error } = await supabase
        .rpc('fn_filter_customers', {
          p_filters: rpcFilters,
          p_limit: pageSize,
          p_offset: (page - 1) * pageSize
        })
        .abortSignal(signal);

      if (error) throw error;

      let totalRecords = 0;
      if (rpcData && rpcData.length > 0) {
        totalRecords = Number(rpcData[0].total_count);
      }

      // Converter para GroupedCustomer
      const customers: GroupedCustomer[] = (rpcData || []).map((row: any) => ({
        nome: row.nome_cliente,
        telefone: row.telefone_cliente,
        instagram: '',
        pedidos_vida: Number(row.pedidos_vida),
        quantidade_pedidos: Number(row.quantidade_pedidos),
        faturamento_total: Number(row.faturamento_total),
        total_itens: Number(row.total_itens),
        primeira_compra: new Date(row.data_primeira_compra),
        data_primeira_compra: new Date(row.data_primeira_compra),
        ultima_compra: new Date(row.ultima_compra),
        is_recorrente: Boolean(row.is_recorrente),
        compras: [],
        itens_consolidados: [],
      }));

      return { customers, totalRecords };
    },
    // Mantém os dados anteriores na tela enquanto a página/filtro novo carrega
    // (mesmo comportamento visual do useEffect antigo, que não limpava o estado)
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 60_000,
  });

  return {
    data: result?.customers ?? [],
    totalCount: result?.totalRecords ?? 0,
    loading: isFetching,
  };
}
