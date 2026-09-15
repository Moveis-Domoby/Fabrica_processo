import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Helper to convert Date to ISO string or null
const toISO = (d: Date | null) => (d ? d.toISOString() : null);

export function useTopItemsOverallQuery(start: Date | null, end: Date | null) {
  const pStart = toISO(start);
  const pEnd = toISO(end);

  return useQuery({
    queryKey: ['topItemsOverall', pStart, pEnd],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_dashboard_top_items_overall', {
        p_start: pStart,
        p_end: pEnd
      });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        item_name: r.item_name,
        quantidade: Number(r.quantidade)
      }));
    },
    staleTime: 30_000,
    gcTime: 60_000,
  });
}

export function useItemsDataQuery(start: Date | null, end: Date | null) {
  const pStart = toISO(start);
  const pEnd = toISO(end);

  return useQuery({
    queryKey: ['itemsData', pStart, pEnd],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_dashboard_items', {
        p_start: pStart,
        p_end: pEnd
      });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        month_str: r.month_str,
        item_name: r.item_name,
        quantidade: Number(r.quantidade)
      }));
    },
    staleTime: 30_000,
    gcTime: 60_000,
  });
}

export function useTransitionsSummaryQuery(start: Date | null, end: Date | null) {
  const pStart = toISO(start);
  const pEnd = toISO(end);

  return useQuery({
    queryKey: ['transitionsSummary', pStart, pEnd],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_dashboard_transitions_summary', {
        p_start: pStart,
        p_end: pEnd
      });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        purchase_number: Number(r.purchase_number),
        avg_days: Number(r.avg_days),
        client_count: Number(r.client_count)
      }));
    },
    staleTime: 30_000,
    gcTime: 60_000,
  });
}

export function useTransitionsClientsQuery(purchaseNumber: number, start: Date | null, end: Date | null, enabled: boolean, limit: number, offset: number) {
  const pStart = toISO(start);
  const pEnd = toISO(end);

  return useQuery({
    queryKey: ['transitionsClients', purchaseNumber, pStart, pEnd, limit, offset],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_dashboard_transition_clients', {
        p_purchase_number: purchaseNumber,
        p_start: pStart,
        p_end: pEnd,
        p_limit: limit,
        p_offset: offset
      });
      if (error) throw error;
      return data || [];
    },
    enabled,
    staleTime: 30_000,
    gcTime: 60_000,
  });
}
