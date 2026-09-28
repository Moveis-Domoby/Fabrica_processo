import { useEffect, useState } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { buscarConversa, buscarConversas, buscarMensagens, POR_PAGINA_MENSAGENS } from './api'
import { acharConversa } from './cache'
import type { CacheConversas } from './cache'
import { ouvirCanal, topicoDaConversa } from './canais'
import type { ConversaResumo, CursorConversas, MensagemChat, PaginaConversas } from './tipos'

/**
 * As consultas do chat — um dado, um fetcher (E-22): cada chave tem UMA
 * função de busca, e o balão e a tela cheia consomem as mesmas.
 * Nada de refetch por foco, por intervalo ou por reconexão do navegador: quem
 * mantém tudo em dia é o websocket; reler é só a próxima página (lei do dono).
 */
// A chave leva a pessoa: outra conta na mesma aba nunca lê o cache da anterior.
export const chaveConversas = (eu: string) => ['chat', eu, 'conversas'] as const
export const chaveConversa = (eu: string, id: number) => ['chat', eu, 'conversa', id] as const
export const chaveMensagens = (eu: string, id: number) => ['chat', eu, 'mensagens', id] as const

const SEM_RELEITURA = {
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
} as const

/** A lista, 5 por página. A 1ª página é a única leitura na abertura do app. */
export function useConversas(eu: string, habilitado: boolean) {
  return useInfiniteQuery<
    PaginaConversas,
    Error,
    InfiniteData<PaginaConversas, CursorConversas | null>,
    ReturnType<typeof chaveConversas>,
    CursorConversas | null
  >({
    queryKey: chaveConversas(eu),
    queryFn: ({ pageParam }) => buscarConversas(pageParam),
    initialPageParam: null,
    getNextPageParam: (ultima) => ultima.proximo,
    enabled: habilitado,
    gcTime: Infinity,
    ...SEM_RELEITURA,
  })
}

/**
 * O resumo de uma conversa: sai da lista quando ela já está carregada (zero
 * leitura); senão, uma leitura de uma linha só (abrir por link).
 */
export function useResumoConversa(eu: string, conversaId: number | null, prontoParaLer: boolean) {
  const { data: lista } = useConversas(eu, prontoParaLer)
  const daLista = conversaId === null ? undefined : acharConversa(lista, conversaId)
  const avulsa = useQuery<ConversaResumo | null>({
    queryKey: chaveConversa(eu, conversaId ?? 0),
    queryFn: () => buscarConversa(conversaId!),
    enabled: prontoParaLer && conversaId !== null && daLista === undefined,
    gcTime: 60_000,
    ...SEM_RELEITURA,
  })
  return {
    resumo: daLista ?? avulsa.data ?? null,
    carregando: daLista === undefined && avulsa.isPending && avulsa.fetchStatus !== 'idle',
    erro: daLista === undefined ? avulsa.error : null,
  }
}

type CacheMensagens = InfiniteData<MensagemChat[], number | null>

/**
 * As mensagens de UMA conversa aberta: 10 por página, a mais nova primeiro
 * (cada página vem em ordem decrescente). O canal da conversa é assinado
 * ANTES da 1ª leitura — assim nada escapa entre ler e começar a ouvir — e sai
 * quando a conversa fecha; o cache morre junto (reabrir = 1 página).
 * Quem usa monta com `key={conversaId}`.
 */
export function useMensagens(eu: string, conversaId: number) {
  const clienteQuery = useQueryClient()
  const [ouvindo, setOuvindo] = useState(false)

  useEffect(() => {
    let caiu = false
    // Se o websocket não responder, a conversa abre mesmo assim (sem ao vivo).
    const desistir = setTimeout(() => setOuvindo(true), 4000)
    const parar = ouvirCanal(
      topicoDaConversa(conversaId),
      (evento, dados) => {
        if (evento !== 'mensagem') return
        const nova = dados as unknown as MensagemChat
        clienteQuery.setQueryData<CacheMensagens>(chaveMensagens(eu, conversaId), (atual) =>
          juntarMensagem(atual, nova),
        )
      },
      (status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(desistir)
          setOuvindo(true)
          if (caiu) {
            caiu = false
            void clienteQuery.resetQueries({ queryKey: chaveMensagens(eu, conversaId) })
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          caiu = true
        }
      },
    )
    return () => {
      clearTimeout(desistir)
      parar()
    }
  }, [eu, conversaId, clienteQuery])

  return useInfiniteQuery<
    MensagemChat[],
    Error,
    CacheMensagens,
    ReturnType<typeof chaveMensagens>,
    number | null
  >({
    queryKey: chaveMensagens(eu, conversaId),
    queryFn: ({ pageParam }) => buscarMensagens(conversaId, pageParam),
    initialPageParam: null,
    getNextPageParam: (ultima) =>
      ultima.length === POR_PAGINA_MENSAGENS ? ultima[ultima.length - 1].id : undefined,
    enabled: ouvindo,
    gcTime: 0,
    ...SEM_RELEITURA,
  })
}

/** Põe a mensagem nova no topo da 1ª página (sem repetir a que já está). */
export function juntarMensagem(
  atual: CacheMensagens | undefined,
  nova: MensagemChat,
): CacheMensagens | undefined {
  if (!atual || atual.pages.length === 0) return atual
  if (atual.pages.some((p) => p.some((m) => m.id === nova.id))) return atual
  const [primeira, ...resto] = atual.pages
  return { ...atual, pages: [[nova, ...primeira], ...resto] }
}

export type { CacheConversas }
