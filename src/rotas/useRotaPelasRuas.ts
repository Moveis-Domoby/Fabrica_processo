import { useMemo } from 'react'
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import { useDebouncedValue } from '@/comercial/hooks/useDebouncedValue'
import { buscarRotaPelasRuas } from './api'
import type { RotaCalculada } from './api'
import type { Ponto } from './proximidade'
import { chaveRota } from './rotaRuas'

/**
 * Espera a pessoa parar de mexer antes de pedir a rota nova. ↪️ 03/10 (ajustes
 * da SESSAO-28): 600 → 400 ms — junto com a linha anterior que fica na tela
 * enquanto a nova chega, a tela deixou de "travar" a cada arrasto.
 */
const ESPERA_MS = 400

export type EstadoRota =
  | { estado: 'sem_rota' }
  /** `anterior`: a rota de antes, que continua desenhada (esmaecida) até a nova chegar. */
  | { estado: 'calculando'; anterior: RotaCalculada | null }
  | { estado: 'pronta'; rota: RotaCalculada; doCache: boolean }
  | { estado: 'sem_caminho' }
  | { estado: 'fora_do_ar' }

const opcoesDaConsulta = (chave: string | null, pontos: Ponto[] | null) => ({
  queryKey: ['rota-ruas', chave] as const,
  queryFn: () => buscarRotaPelasRuas(chave!, pontos!),
  enabled: chave !== null && pontos !== null,
  staleTime: Infinity,
  gcTime: 30 * 60 * 1000,
  retry: false,
  refetchOnWindowFocus: false,
})

/**
 * A rota pelas ruas da sequência de pontos (fábrica → paradas → fábrica —
 * D-108). Cada sequência é UMA consulta, guardada pela sessão inteira (a mesma
 * ordem nunca é pedida duas vezes na visita; reabrir a tela lê o cache do
 * banco). Reordenar muda a chave → rota nova, depois de a pessoa parar de
 * mexer; enquanto ela não chega, a de antes fica na tela. Falha do serviço não
 * quebra nada: o estado vira "fora_do_ar" e a tela desenha a linha reta.
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
    ...opcoesDaConsulta(chaveEstavel, pontosDaChave),
    placeholderData: keepPreviousData,
  })
  const anterior = consulta.data?.tipo === 'pronta' ? consulta.data.rota : null

  if (chave === null) return { estado: 'sem_rota' }
  if (chaveEstavel !== chave || consulta.isPending || consulta.isPlaceholderData) {
    return { estado: 'calculando', anterior }
  }
  if (consulta.isError) return { estado: 'fora_do_ar' }
  const dados = consulta.data!
  if (dados.tipo === 'sem_caminho') return { estado: 'sem_caminho' }
  return { estado: 'pronta', rota: dados.rota, doCache: dados.doCache }
}

/**
 * Várias rotas de uma vez (aba "Já programadas": os caminhões do mesmo dia no
 * mesmo mapa — D-111). Sem espera: aqui a sequência só muda quando a pessoa
 * salva. Cada uma é a mesma consulta da rota única (o mesmo cache).
 */
export function useRotasPelasRuas(listas: Ponto[][]): EstadoRota[] {
  const chaves = useMemo(() => listas.map((p) => (p.length >= 2 ? chaveRota(p) : null)), [listas])
  return useQueries({
    queries: listas.map((pontos, i) => opcoesDaConsulta(chaves[i], pontos.length >= 2 ? pontos : null)),
    combine: (resultados) =>
      resultados.map((consulta, i): EstadoRota => {
        if (chaves[i] === null) return { estado: 'sem_rota' }
        if (consulta.isPending) return { estado: 'calculando', anterior: null }
        if (consulta.isError) return { estado: 'fora_do_ar' }
        const dados = consulta.data!
        if (dados.tipo === 'sem_caminho') return { estado: 'sem_caminho' }
        return { estado: 'pronta', rota: dados.rota, doCache: dados.doCache }
      }),
  })
}
