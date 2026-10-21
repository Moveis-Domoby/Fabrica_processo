import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ouvirCanal, topicoDaPessoa } from '@/chat/canais'
import {
  apagarAviso,
  apagarLidas,
  buscarAvisos,
  destinoDoAviso,
  marcarAvisoLido,
  marcarTodosLidos,
} from './api'
import type { Aviso } from './api'

/** O sino guarda os 20 mais recentes (a página de Avisos tem o resto). */
const NO_SINO = 20

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * O sino do topo (SESSAO-06 / Q-18): onde o líder/admin vê os avisos que o
 * banco gera sozinho — 🟡/🔴 na entrega, divergência no recebimento, chegada
 * em ESTOQUE. Quem não recebe aviso nenhum vê a caixa vazia; o RLS garante que
 * cada um só enxerga os seus.
 */
export function SinoNotificacoes({
  usuarioId,
  painelLado = 'direita',
}: {
  usuarioId: string
  /** De que borda da PÁGINA o painel abre — nunca ancorado no próprio sino (o
   *  sino agora vive no topo da sidebar; ancorar nele estouraria a tela). */
  painelLado?: 'esquerda' | 'direita'
}) {
  const clienteQuery = useQueryClient()
  const navegar = useNavigate()
  const { pathname } = useLocation()
  // SESSAO-38 (D-162): o painel fica aberto só na tela em que foi aberto —
  // trocar de tela fecha sozinho (derivado, sem efeito que mexe em estado).
  const [abertoEm, setAbertoEm] = useState<string | null>(null)
  const aberto = abertoEm === pathname
  const setAberto = (abrir: boolean) => setAbertoEm(abrir ? pathname : null)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const painelRef = useRef<HTMLDivElement>(null)

  // SESSAO-38 (D-162, pedido do dono): QUALQUER toque/clique fora do painel
  // fecha na hora — na barra lateral, na página, no mapa, no balão do chat,
  // numa janela aberta. Escuta na fase de CAPTURA da janela: roda antes de
  // todo mundo, então nem o mapa (que segura os próprios eventos) nem quem
  // chama stopPropagation impedem o fechamento. Não chama preventDefault: o
  // clique que fecha segue normalmente para o elemento tocado (antes, um fundo
  // invisível "comia" o clique — e, preso dentro da barra lateral pelo
  // translate dela, só cobria a própria barra: o resto da tela não fechava).
  useEffect(() => {
    if (abertoEm === null) return
    const fechar = () => setAbertoEm(null)
    const aoTocar = (evento: PointerEvent) => {
      const alvo = evento.target
      if (!(alvo instanceof Node)) return fechar()
      if (painelRef.current?.contains(alvo)) return
      // O próprio sino alterna no clique dele — não fechar aqui (senão o
      // clique reabriria).
      if (botaoRef.current?.contains(alvo)) return
      fechar()
    }
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return
      fechar()
      botaoRef.current?.focus()
    }
    window.addEventListener('pointerdown', aoTocar, true)
    window.addEventListener('keydown', aoTeclar, true)
    return () => {
      window.removeEventListener('pointerdown', aoTocar, true)
      window.removeEventListener('keydown', aoTeclar, true)
    }
  }, [abertoEm])

  // SESSAO-31 (Lei §4): sem relógio — o aviso novo chega pelo canal da pessoa
  // (o mesmo do chat) e entra no cache; assina ANTES de ler; ao reconectar,
  // uma releitura de recuperação.
  const [ouvindo, setOuvindo] = useState(false)
  useEffect(() => {
    let caiu = false
    const desistir = setTimeout(() => setOuvindo(true), 4000)
    const parar = ouvirCanal(
      topicoDaPessoa(usuarioId),
      (evento, dados) => {
        if (evento !== 'aviso') return
        const novo = dados as unknown as Aviso
        clienteQuery.setQueryData<Aviso[]>(['avisos', usuarioId], (atual) =>
          atual && !atual.some((a) => a.id === novo.id)
            ? [novo, ...atual].slice(0, NO_SINO)
            : atual,
        )
        void clienteQuery.invalidateQueries({ queryKey: ['avisos', 'historico'] })
      },
      (status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(desistir)
          setOuvindo(true)
          if (caiu) {
            caiu = false
            void clienteQuery.invalidateQueries({ queryKey: ['avisos', usuarioId] })
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
  }, [usuarioId, clienteQuery])

  const { data: avisos = [] } = useQuery({
    queryKey: ['avisos', usuarioId],
    queryFn: () => buscarAvisos(usuarioId, NO_SINO),
    enabled: ouvindo,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
  const naoLidos = avisos.filter((a) => a.lida_em === null)

  const invalidar = () => clienteQuery.invalidateQueries({ queryKey: ['avisos'] })
  const lerUm = useMutation({ mutationFn: marcarAvisoLido, onSuccess: invalidar })
  const lerTodos = useMutation({
    mutationFn: () => marcarTodosLidos(usuarioId),
    onSuccess: invalidar,
  })
  // Só o aviso LIDO se apaga (regra do banco); o fato segue em plt_eventos.
  const apagarUm = useMutation({ mutationFn: apagarAviso, onSuccess: invalidar })
  const apagarTodasLidas = useMutation({
    mutationFn: () => apagarLidas(usuarioId),
    onSuccess: invalidar,
  })

  return (
    <div className="relative">
      <button
        ref={botaoRef}
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-label={
          naoLidos.length > 0
            ? `Notificações: ${naoLidos.length} não lida${naoLidos.length === 1 ? '' : 's'}`
            : 'Notificações'
        }
        aria-expanded={aberto}
        className="toque-seguro relative inline-flex h-toque-md w-toque-md items-center justify-center rounded-dm text-grafite-100 transition-colors hover:bg-grafite-600"
      >
        <Bell aria-hidden className="size-5" />
        {naoLidos.length > 0 && (
          <span className="absolute right-1 top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-danificado-forte px-1 text-xs font-semibold text-white tabular-nums">
            {naoLidos.length > 9 ? '9+' : naoLidos.length}
          </span>
        )}
      </button>

      {aberto &&
        createPortal(
          <div
            ref={painelRef}
            role="region"
            aria-label="Notificações"
            // Painel fixo, ancorado à borda da PÁGINA (nunca no sino) e com
            // altura limitada pela própria tela: não é cortado em viewport
            // nenhum, com a sidebar aberta ou recolhida.
            // SESSAO-38: vai para o fim do body (portal) — fora do aside, cujo
            // translate prendia o "fixed" à barra (E-48); camada 58: acima da
            // gaveta do celular (55) e do seletor de tema (56), abaixo dos
            // avisos passageiros (60).
            className={cn(
              'fixed top-16 z-[58] flex max-h-[calc(100dvh-5rem)] w-80 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-dm-lg border border-borda bg-superficie shadow-lg',
              painelLado === 'direita' ? 'right-3' : 'left-3',
            )}
          >
            <header className="flex items-center justify-between gap-2 border-b border-borda px-3 py-2">
              <span className="text-sm font-semibold text-texto">Notificações</span>
              {naoLidos.length > 0 && (
                <button
                  type="button"
                  onClick={() => lerTodos.mutate()}
                  disabled={lerTodos.isPending}
                  className="inline-flex min-h-toque-md items-center gap-1 rounded-dm px-2 text-xs font-medium text-texto-suave hover:bg-superficie-sutil"
                >
                  <CheckCheck aria-hidden className="size-4" />
                  Marcar todas como lidas
                </button>
              )}
            </header>

            <ul className="min-h-0 flex-1 overflow-y-auto">
              {avisos.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-texto-fraco">
                  Nenhum aviso por aqui.
                </li>
              )}
              {avisos.map((aviso) => (
                <li
                  key={aviso.id}
                  className="flex items-stretch border-b border-borda last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (aviso.lida_em === null) lerUm.mutate(aviso.id)
                      const destino = destinoDoAviso(aviso)
                      if (destino) {
                        setAberto(false)
                        navegar(destino)
                      }
                    }}
                    className={cn(
                      'flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-superficie-sutil',
                      aviso.lida_em === null && 'bg-superficie-sutil',
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          'text-sm text-texto',
                          aviso.lida_em === null && 'font-semibold',
                        )}
                      >
                        {aviso.titulo}
                      </span>
                      <span className="shrink-0 text-xs text-texto-fraco tabular-nums">
                        {quando(aviso.criada_em)}
                      </span>
                    </span>
                    <span className="text-xs text-texto-suave">{aviso.corpo}</span>
                    {destinoDoAviso(aviso) ? (
                      <span className="text-xs font-medium text-acao-ativa">Toque para abrir</span>
                    ) : (
                      aviso.lida_em === null && (
                        <span className="text-xs font-medium text-acao-ativa">
                          Toque para marcar como lida
                        </span>
                      )
                    )}
                  </button>
                  {aviso.lida_em !== null && (
                    <button
                      type="button"
                      aria-label={`Apagar o aviso "${aviso.titulo}"`}
                      disabled={apagarUm.isPending}
                      onClick={() => apagarUm.mutate(aviso.id)}
                      className="toque-seguro flex w-10 shrink-0 items-center justify-center text-texto-fraco transition-colors hover:bg-superficie-sutil hover:text-danificado-forte"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {/* SESSAO-23: o histórico completo mora numa tela própria, paginada
                no servidor — aqui só os mais recentes. */}
            <div className="flex border-t border-borda">
              {avisos.some((a) => a.lida_em !== null) && (
                <button
                  type="button"
                  disabled={apagarTodasLidas.isPending}
                  onClick={() => apagarTodasLidas.mutate()}
                  className="flex min-h-toque-md flex-1 items-center justify-center gap-1.5 border-r border-borda text-sm font-medium text-texto-suave hover:bg-superficie-sutil hover:text-danificado-forte"
                >
                  <Trash2 aria-hidden className="size-4" />
                  Apagar lidas
                </button>
              )}
              <Link
                to="/inicio/avisos"
                onClick={() => setAberto(false)}
                className="flex min-h-toque-md flex-1 items-center justify-center text-sm font-medium text-texto hover:bg-superficie-sutil"
              >
                Ver todos
              </Link>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
