import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebouncedValue } from '@/comercial/hooks/useDebouncedValue'
import { buscarRotaPelasRuas } from './api'
import type { RotaCalculada } from './api'
import type { Ponto } from './proximidade'
import { chaveRota } from './rotaRuas'

/** Espera a pessoa parar de subir/descer paradas antes de pedir a rota nova. */
const ESPERA_MS = 600

export type EstadoRota =
  | { estado: 'sem_rota' }
  | { estado: 'calculando' }
  | { estado: 'pronta'; rota: RotaCalculada; doCache: boolean }
  | { estado: 'sem_caminho' }
  | { estado: 'fora_do_ar' }

/**
 * A rota pelas ruas da sequência de pontos (fábrica → paradas → fábrica —
 * D-108). Cada sequência é UMA consulta, guardada pela sessão inteira (a mesma
 * ordem nunca é pedida duas vezes na visita; reabrir a tela lê o cache do
 * banco). Reordenar muda a chave → rota nova, depois de a pessoa parar de
 * mexer. Falha do serviço não quebra nada: o estado vira "fora_do_ar" e a tela
 * desenha a linha reta.
 */
export function useRotaPelasRuas(pontos: Ponto[]): EstadoRota {
  const chave = useMemo(() => (pontos.length >= 2 ? chaveRota(pontos) : null), [pontos])
  const chaveEstavel = useDebouncedValue(chave, ESPERA_MS)
  // Os pontos andam com a chave: a chave estável só existe para pontos que a
  // tela já mostrou, e a consulta pega os pontos daquela chave.
  const pontosDaChave = useMemo(
    () => (chaveEstavel === chave ? pontos : null),
    [chaveEstavel, chave, pontos],
  )

  const consulta = useQuery({
    queryKey: ['rota-ruas', chaveEstavel],
    queryFn: () => buscarRotaPelasRuas(chaveEstavel!, pontosDaChave!),
    enabled: chaveEstavel !== null && pontosDaChave !== null,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  })

  if (chave === null) return { estado: 'sem_rota' }
  if (chaveEstavel !== chave || consulta.isPending) return { estado: 'calculando' }
  if (consulta.isError) return { estado: 'fora_do_ar' }
  const dados = consulta.data!
  if (dados.tipo === 'sem_caminho') return { estado: 'sem_caminho' }
  return { estado: 'pronta', rota: dados.rota, doCache: dados.doCache }
}
