import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Query, QueryKey } from '@tanstack/react-query'
import { ouvirCanal, topicoDaPessoa } from '@/chat/canais'

/**
 * As áreas que o banco avisa (SESSAO-30 — migration 61; SESSAO-31 — o quadro
 * de cada setor; SESSAO-32 — migration 78: o painel, os danificados e as
 * listas do Comercial).
 */
export type AreaAoVivo =
  | 'estoque'
  | 'aguardo'
  | 'pcp'
  | 'rotas'
  | 'painel'
  | 'danificados'
  | `setor_${number}`
  | `lista_${string}`

export interface OpcoesAoVivo {
  ligado?: boolean
  /** Os eventos que fazem reler (padrão: 'mudou'). */
  eventos?: string[]
  /** Quanto esperar parado antes de reler (padrão 400 ms) — junta rajadas. */
  esperaMs?: number
}

const ESPERA_MS = 400

/**
 * Tela AO VIVO por websocket (Lei §4 — no lugar dos relógios de 20–30 s): o
 * banco empurra "mudou" no canal privado da área (só quem pode ver ouve) e a
 * tela relê só as consultas dela — as que estão na tela; as escondidas ficam
 * marcadas para quando aparecerem. Vários avisos seguidos viram uma releitura
 * só; ao voltar a conexão (rede caiu, aba dormiu), uma releitura de
 * recuperação.
 *
 * ↩️ Ajuste do dono (14/10 noite): o canal só é ouvido com a tela aberta —
 * ao VOLTAR a ela, a leitura guardada de antes (cache de até 30 s) pode não
 * ter o que mudou enquanto a pessoa estava noutra tela. Ao assinar, cada
 * consulta guardada antes de a tela abrir é relida uma vez.
 */
export function useAoVivo(
  areas: AreaAoVivo | AreaAoVivo[],
  chaves: QueryKey[],
  opcoes: boolean | OpcoesAoVivo = true,
) {
  const { ligado = true, eventos = ['mudou'], esperaMs = ESPERA_MS } =
    typeof opcoes === 'boolean' ? { ligado: opcoes } : opcoes
  const clienteQuery = useQueryClient()
  const chavesRef = useRef(chaves)
  useEffect(() => {
    chavesRef.current = chaves
  })
  const lista = (Array.isArray(areas) ? areas : [areas]).join(',')
  const listaEventos = eventos.join(',')

  useEffect(() => {
    if (!ligado) return
    const abertaEm = Date.now()
    let espera: ReturnType<typeof setTimeout> | null = null
    let jaConectou = false
    let caiu = false
    // A primeira assinatura: o que estava guardado de antes desta tela abrir
    // (e não está sendo lido agora) é relido uma vez.
    const conferirGuardadas = () => {
      for (const queryKey of chavesRef.current) {
        for (const consulta of clienteQuery.getQueryCache().findAll({ queryKey })) {
          const estado = consulta.state
          if (
            estado.data !== undefined &&
            estado.fetchStatus !== 'fetching' &&
            estado.dataUpdatedAt < abertaEm
          ) {
            void clienteQuery.invalidateQueries({ queryKey: consulta.queryKey, exact: true })
          }
        }
      }
    }
    const reler = () => {
      if (espera) clearTimeout(espera)
      espera = setTimeout(() => {
        espera = null
        for (const queryKey of chavesRef.current) void clienteQuery.invalidateQueries({ queryKey })
      }, esperaMs)
    }
    const queremos = new Set(listaEventos.split(','))
    const aoStatus = (status: string) => {
      if (status === 'SUBSCRIBED') {
        if (jaConectou && caiu) reler() // recuperação: o que mudou enquanto estava fora
        if (!jaConectou) conferirGuardadas()
        jaConectou = true
        caiu = false
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        caiu = true
      }
    }
    const paradas = lista
      .split(',')
      .map((area) =>
        ouvirCanal(`plt-aviso:${area}`, (evento) => queremos.has(evento) && reler(), aoStatus),
      )
    return () => {
      if (espera) clearTimeout(espera)
      for (const parar of paradas) parar()
    }
  }, [lista, listaEventos, esperaMs, ligado, clienteQuery])
}

/**
 * O trabalho DA PESSOA ao vivo (SESSAO-32 · migration 78): o banco avisa no
 * canal dela ('meu_trabalho') quando muda um card, uma execução ou uma tarefa
 * que é dela — a bolinha, o Meu Painel e Meus afazeres releem só as consultas
 * da pessoa. Sem relógio; ao voltar a conexão, uma releitura de recuperação.
 */
export function useMeuTrabalhoAoVivo(usuarioId: string | null | undefined) {
  const clienteQuery = useQueryClient()
  useEffect(() => {
    if (!usuarioId) return
    let espera: ReturnType<typeof setTimeout> | null = null
    let jaConectou = false
    let caiu = false
    // E-53: o gesto da própria pessoa já relê na tela — o sinal que volta dele
    // não relê de novo o que acabou de chegar (ou está chegando).
    const podeReler = (q: Query) =>
      q.state.fetchStatus !== 'fetching' && Date.now() - q.state.dataUpdatedAt > 1_500
    const reler = () => {
      if (espera) clearTimeout(espera)
      espera = setTimeout(() => {
        espera = null
        void clienteQuery.invalidateQueries({ queryKey: ['afazeres'], predicate: podeReler })
        void clienteQuery.invalidateQueries({ queryKey: ['meu-painel'], predicate: podeReler })
      }, ESPERA_MS)
    }
    const parar = ouvirCanal(
      topicoDaPessoa(usuarioId),
      (evento) => evento === 'meu_trabalho' && reler(),
      (status) => {
        if (status === 'SUBSCRIBED') {
          if (jaConectou && caiu) reler()
          jaConectou = true
          caiu = false
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          caiu = true
        }
      },
    )
    return () => {
      if (espera) clearTimeout(espera)
      parar()
    }
  }, [usuarioId, clienteQuery])
}
