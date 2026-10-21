import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ReguaTempo } from './tempoUtil'

export async function buscarReguaTempo(): Promise<ReguaTempo | null> {
  const { data, error } = await supabase.rpc('plt_fn_regua_tempo')
  if (error) throw new Error(`Não deu para carregar o horário dos setores: ${error.message}`)
  return (data as ReguaTempo | null) ?? null
}

/**
 * A régua em cache (uma chave só — E-22). Vem semeada pela abertura; sem ela
 * (banco antigo, erro), os relógios mostram o tempo corrido como antes.
 */
export function useReguaTempo(): ReguaTempo | null {
  const { data } = useQuery({
    queryKey: ['regua-tempo'],
    queryFn: buscarReguaTempo,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })
  return data ?? null
}
