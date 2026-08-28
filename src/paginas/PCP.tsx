import { useMemo, useState } from 'react'
import { Navigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, PackageOpen, Plus } from 'lucide-react'
import { Botao, useNotificacao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import {
  buscarCardsDoSetor,
  buscarEtapasDoSetor,
  buscarSetores,
  moverCard,
} from '@/kanban/api'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import { usePedidosDosCards } from '@/kanban/componentes/usePedidosDosCards'
import { QuadroKanban } from '@/kanban/componentes/QuadroKanban'
import { ModalMoverCard } from '@/kanban/componentes/ModalMoverCard'
import { ModalNovoPedido } from '@/kanban/componentes/ModalNovoPedido'
import { ModalLiberarPedido } from '@/kanban/componentes/ModalLiberarPedido'
import type { Card } from '@/kanban/tipos'

const ATUALIZA_A_CADA = 20_000

/**
 * O quadro do PCP (D-01): um card por PEDIDO. O PCP enxerga o pedido inteiro,
 * decide, e "libera" — cada móvel vira um card de unidade que percorre os
 * setores sozinho. Pedido 100% liberado sai daqui e passa a ser acompanhado
 * na Expedição (D-22). O PCP também é a logística e trabalha no computador,
 * então esta tela é a mais completa do chão de fábrica.
 */
export function PCP() {
  const { perfil, vinculos, carregando } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const agora = useAgora()

  const souAdmin = perfil?.papel === 'admin'
  const souDoPcp = vinculos.some((v) => v.setor.codigo === 'pcp')

  const { data: setores = [] } = useQuery({ queryKey: ['setores'], queryFn: () => buscarSetores() })
  const setorPcp = setores.find((s) => s.codigo === 'pcp')

  const { data: cardsPedido = [], isPending: carregandoPedidos } = useQuery({
    queryKey: ['cards', 'pcp-pedidos', setorPcp?.id],
    queryFn: () => buscarCardsDoSetor(setorPcp!.id, 'pedido'),
    enabled: setorPcp !== undefined,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: unidadesNoPcp = [] } = useQuery({
    queryKey: ['cards', 'pcp-unidades', setorPcp?.id],
    queryFn: () => buscarCardsDoSetor(setorPcp!.id, 'unidade'),
    enabled: setorPcp !== undefined,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: etapasPcp = [] } = useQuery({
    queryKey: ['etapas', setorPcp?.id ?? 0],
    queryFn: () => buscarEtapasDoSetor(setorPcp!.id),
    enabled: setorPcp !== undefined,
  })

  const todosOsCards = useMemo(
    () => [...cardsPedido, ...unidadesNoPcp],
    [cardsPedido, unidadesNoPcp],
  )
  const { data: pedidosPorId = new Map() } = usePedidosDosCards(todosOsCards)

  // Pedido com todas as unidades liberadas sai do quadro (D-22).
  const cardsPedidoAbertos = cardsPedido.filter((card) => {
    const resumo = pedidosPorId.get(card.pedido_id)
    if (!resumo) return true
    return resumo.total_unidades === 0 || resumo.unidades_liberadas < resumo.total_unidades
  })

  const [modalNovo, setModalNovo] = useState(false)
  const [cardParaLiberar, setCardParaLiberar] = useState<Card | null>(null)
  const [cardParaMover, setCardParaMover] = useState<Card | null>(null)

  const mutacaoEtapa = useMutation({
    mutationFn: moverCard,
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['cards'] }),
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para mover o card',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  if (!carregando && !souAdmin && !souDoPcp) return <Navigate to="/" replace />
  if (!perfil) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl">PCP</h1>
          <p className="mt-1 max-w-2xl text-texto-suave">
            Todo pedido entra por aqui (D-13). Libere as unidades para os setores — dá para
            liberar parcial e terminar depois.
          </p>
        </div>
        <Botao icone={<Plus />} onClick={() => setModalNovo(true)}>
          Novo card de pedido
        </Botao>
      </div>

      <section aria-label="Pedidos aguardando liberação" className="flex flex-col gap-3">
        <h2 className="text-lg">
          Pedidos no PCP{' '}
          <span className="text-texto-suave tabular-nums">({cardsPedidoAbertos.length})</span>
        </h2>

        {carregandoPedidos && <p className="text-sm text-texto-fraco">Carregando…</p>}
        {!carregandoPedidos && cardsPedidoAbertos.length === 0 && (
          <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
            Nenhum pedido aguardando. Crie um card a partir de um pedido do Tiny — a entrada
            automática chega na SESSAO-09.
          </p>
        )}

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cardsPedidoAbertos.map((card) => {
            const resumo = pedidosPorId.get(card.pedido_id)
            const liberadas = resumo?.unidades_liberadas ?? 0
            const total = resumo?.total_unidades ?? 0
            return (
              <li
                key={card.id}
                className="flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-4"
              >
                <header className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-texto tabular-nums">
                    Pedido {resumo?.numero ?? '…'}
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 text-sm text-texto-suave tabular-nums"
                    title={
                      card.desde
                        ? `No PCP desde ${new Date(card.desde).toLocaleString('pt-BR')}`
                        : undefined
                    }
                  >
                    <Clock aria-hidden className="size-4" />
                    {formatarDuracao(card.desde, agora)}
                  </span>
                </header>

                <p className="line-clamp-1 text-sm text-texto-suave">
                  {resumo?.cliente_nome || '…'}
                </p>
                <p className="text-sm text-texto tabular-nums">
                  {total > 0 ? (
                    <>
                      {liberadas} de {total} unidade{total === 1 ? '' : 's'} liberada
                      {liberadas === 1 ? '' : 's'}
                    </>
                  ) : (
                    'Sem itens com quantidade a produzir'
                  )}
                </p>

                <Botao
                  variante={liberadas > 0 ? 'secundaria' : 'primaria'}
                  icone={<PackageOpen />}
                  larguraTotal
                  disabled={total === 0}
                  onClick={() => setCardParaLiberar(card)}
                >
                  {liberadas > 0 ? 'Continuar liberação' : 'Liberar unidades'}
                </Botao>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-label="Unidades no PCP" className="flex flex-col gap-3">
        <h2 className="text-lg">
          Unidades no PCP{' '}
          <span className="text-texto-suave tabular-nums">({unidadesNoPcp.length})</span>
        </h2>
        {setorPcp && unidadesNoPcp.length > 0 && (
          <QuadroKanban
            setor={setorPcp}
            etapas={etapasPcp}
            cards={unidadesNoPcp}
            pedidosPorId={pedidosPorId}
            agora={agora}
            aoMoverParaEtapa={(card, etapaId) =>
              mutacaoEtapa.mutate({
                card,
                destinoSetorId: setorPcp.id,
                destinoEtapaId: etapaId,
                usuarioId: perfil.id,
              })
            }
            aoAbrirMover={setCardParaMover}
            // No PCP não há gesto de execução: a unidade só está de passagem
            // entre nascer e ser liberada (D-22). O tempo dela aqui é fila.
            execucao={{
              execucoesPorCard: new Map(),
              nomesUsuarios: new Map(),
              meuUsuarioId: perfil.id,
              gestoPendente: false,
            }}
          />
        )}
        {unidadesNoPcp.length === 0 && (
          <p className="text-sm text-texto-fraco">
            Nenhuma unidade parada no PCP — o normal: elas nascem aqui e já seguem para os
            setores na liberação.
          </p>
        )}
      </section>

      {setorPcp && (
        <ModalNovoPedido
          aberto={modalNovo}
          setorPcp={setorPcp}
          aoFechar={() => setModalNovo(false)}
        />
      )}
      {setorPcp && (
        <ModalLiberarPedido
          cardPedido={cardParaLiberar}
          pedido={cardParaLiberar ? pedidosPorId.get(cardParaLiberar.pedido_id) : undefined}
          setorPcp={setorPcp}
          setores={setores}
          aoFechar={() => setCardParaLiberar(null)}
        />
      )}
      <ModalMoverCard
        card={cardParaMover}
        pedido={cardParaMover ? pedidosPorId.get(cardParaMover.pedido_id) : undefined}
        setores={setores}
        aoFechar={() => setCardParaMover(null)}
      />
    </div>
  )
}
