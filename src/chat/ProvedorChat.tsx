import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSessao } from '@/autenticacao/sessao-contexto'
import {
  aplicarLida,
  aplicarMensagemNova,
  atualizarConversa,
  removerConversa,
  totalNaoLidas,
} from './cache'
import type { CacheConversas } from './cache'
import { ouvirCanal, topicoDaPessoa } from './canais'
import { chaveConversa, chaveConversas, useConversas } from './consultas'
import { ContextoChat } from './contexto'
import type { EstadoChat } from './contexto'
import type { ConversaResumo, SinalMensagem } from './tipos'

/**
 * O chat de quem está logado (SESSAO-26): UM canal de websocket por pessoa —
 * o dos sinais — mais a 1ª página da lista (é ela que acende o badge). Nada
 * de polling: o banco empurra, e o sinal atualiza a lista e o badge no
 * cache. Reconectou depois de cair (pode ter perdido sinal) → relê só a 1ª
 * página. Fica fora do /tablet (a casca do modo galpão nem monta isto).
 * Só existe com alguém logado (a casca monta dentro do ramo autenticado).
 */
export function ProvedorChat({ eu, children }: { eu: string; children: ReactNode }) {
  const { perfil } = useSessao()
  const souAdmin = perfil?.papel === 'admin'
  const clienteQuery = useQueryClient()
  const visivel = useRef<number | null>(null)
  // Assina primeiro, lê depois: nenhuma mensagem escapa entre os dois.
  const [pronto, setPronto] = useState(false)

  const { data: lista } = useConversas(eu, pronto)

  useEffect(() => {
    const chaveLista = chaveConversas(eu)
    let caiu = false
    const desistir = setTimeout(() => setPronto(true), 4000)
    const relerLista = () => void clienteQuery.resetQueries({ queryKey: chaveLista })
    const mexerNaLista = (mudar: (cache: CacheConversas) => CacheConversas) =>
      clienteQuery.setQueryData<CacheConversas>(chaveLista, (atual) => (atual ? mudar(atual) : atual))

    const parar = ouvirCanal(
      topicoDaPessoa(eu),
      (evento, dados) => {
        const conversaId = Number(dados.conversa_id)
        if (evento === 'mensagem') {
          const atual = clienteQuery.getQueryData<CacheConversas>(chaveLista)
          if (!atual) return
          const sinal: SinalMensagem = {
            ...(dados as unknown as SinalMensagem),
            conversa_id: conversaId,
            mensagem_id: Number(dados.mensagem_id),
          }
          const aVista = visivel.current === conversaId && document.visibilityState === 'visible'
          const { cache, achada } = aplicarMensagemNova(atual, sinal, { eu, visivel: aVista })
          if (achada) clienteQuery.setQueryData(chaveLista, cache)
          else relerLista() // conversa fora das páginas carregadas: a 1ª página a traz
        } else if (evento === 'lida') {
          mexerNaLista((c) => aplicarLida(c, conversaId, Number(dados.ultima_lida_id)))
        } else if (evento === 'entrou') {
          relerLista()
        } else if (evento === 'saiu') {
          mexerNaLista((c) => removerConversa(c, conversaId))
          clienteQuery.removeQueries({ queryKey: chaveConversa(eu, conversaId) })
        } else if (evento === 'renomeada') {
          const nome = String(dados.nome ?? '')
          mexerNaLista((c) => atualizarConversa(c, conversaId, { titulo: nome }))
          clienteQuery.setQueryData<ConversaResumo | null>(chaveConversa(eu, conversaId), (r) =>
            r ? { ...r, titulo: nome } : r,
          )
        } else if (evento === 'permissao' && !souAdmin) {
          // admin escreve sempre nos avisos — o sinal só vale para os demais
          const pode = dados.pode_escrever === true
          mexerNaLista((c) => atualizarConversa(c, conversaId, { pode_escrever: pode }))
        }
      },
      (status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(desistir)
          setPronto(true)
          if (caiu) {
            caiu = false
            relerLista()
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
  }, [eu, souAdmin, clienteQuery])

  // Saiu da conta: o cache do chat vai embora junto (nada fica para a próxima).
  useEffect(
    () => () => {
      clienteQuery.removeQueries({ queryKey: ['chat', eu] })
    },
    [eu, clienteQuery],
  )

  const definirConversaVisivel = useCallback((conversaId: number | null) => {
    visivel.current = conversaId
  }, [])

  const valor = useMemo<EstadoChat>(
    () => ({ pronto, totalNaoLidas: totalNaoLidas(lista), definirConversaVisivel }),
    [pronto, lista, definirConversaVisivel],
  )

  return <ContextoChat.Provider value={valor}>{children}</ContextoChat.Provider>
}
