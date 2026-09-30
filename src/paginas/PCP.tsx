import { useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  Clock,
  Inbox,
  OctagonAlert,
  PackageOpen,
  PackagePlus,
  PackageX,
  Plus,
  Search,
} from 'lucide-react'
import { Abas, Botao, Campo, Dica, useNotificacao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import {
  buscarCardsPedidoPcp,
  buscarEtapasDoSetor,
  buscarSetores,
  pedidosResumo,
  reposicoesResumo,
  soltarCard,
} from '@/kanban/api'
import type { ReposicaoResumo } from '@/kanban/api'
import type { PedidoResumo } from '@/kanban/tipos'
import { arquivarCard } from '@/logistica/api'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import { pedidoCancelado } from '@/kanban/situacao'
import { usePedidosDosCards } from '@/kanban/componentes/usePedidosDosCards'
import { useColunasPaginadas } from '@/kanban/componentes/useColunasPaginadas'
import { QuadroKanban } from '@/kanban/componentes/QuadroKanban'
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
 *
 * SESSAO-25: o ESTOQUE manda para cá o card de REPOSIÇÃO quando um produto
 * fica abaixo do mínimo do Tiny. O PCP decide o rumo (resposta 7 do dono):
 * libera as unidades para a produção ou não produz (arquiva).
 *
 * SESSAO-24: pedido CANCELADO no Tiny sai do quadro e vai para a aba
 * Cancelados (histórico para sempre, carregado só ao abrir — b3 do dono); a
 * liberação sugere peça igual sem dono do estoque; e as unidades de passagem
 * pelo PCP se arrastam (a etapa com nome de setor manda o card para ele).
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

  // SESSAO-22: pedidos ABERTOS filtrados e paginados no SERVIDOR — pedido 100%
  // liberado sai do quadro lá (projeção liberado_completo_em, D-22/D-48), e a
  // tela só requisita as páginas que mostra (10 + "Ver mais").
  // SESSAO-23 (ajuste do dono): pedido encerrado no Tiny também fica de fora —
  // o filtro vive na porta plt_fn_cards_pedido_pcp.
  const [paginasPedidos, setPaginasPedidos] = useState(1)
  const consultasPedidos = useQueries({
    queries: Array.from({ length: paginasPedidos }, (_, pagina) => ({
      queryKey: ['cards', 'pcp-pedidos', setorPcp?.id, pagina],
      queryFn: () => buscarCardsPedidoPcp({ pagina, grupo: 'pedido' }),
      enabled: setorPcp !== undefined,
      refetchInterval: ATUALIZA_A_CADA,
      placeholderData: keepPreviousData,
    })),
  })
  const cardsPedidoAbertos = useMemo(
    () => consultasPedidos.flatMap((c) => c.data?.cards ?? []),
    [consultasPedidos],
  )
  const totalPedidosAbertos =
    consultasPedidos[consultasPedidos.length - 1]?.data?.total ??
    consultasPedidos[0]?.data?.total ??
    0
  const carregandoPedidos = consultasPedidos.some((c) => c.isPending)
  const carregandoMaisPedidos = consultasPedidos[consultasPedidos.length - 1]?.isFetching ?? false

  // Rodada de 30/09: as SOLICITAÇÕES DE ESTOQUE (reposição) ganharam aba
  // própria — lançada à mão ou pela automática, ela aparece aqui na hora, sem
  // se perder atrás dos pedidos na paginação.
  const [paginasSolicitacoes, setPaginasSolicitacoes] = useState(1)
  const consultasSolicitacoes = useQueries({
    queries: Array.from({ length: paginasSolicitacoes }, (_, pagina) => ({
      queryKey: ['cards', 'pcp-solicitacoes', setorPcp?.id, pagina],
      queryFn: () => buscarCardsPedidoPcp({ pagina, grupo: 'reposicao' }),
      enabled: setorPcp !== undefined,
      refetchInterval: ATUALIZA_A_CADA,
      placeholderData: keepPreviousData,
    })),
  })
  const cardsSolicitacoes = useMemo(
    () => consultasSolicitacoes.flatMap((c) => c.data?.cards ?? []),
    [consultasSolicitacoes],
  )
  const totalSolicitacoes =
    consultasSolicitacoes[consultasSolicitacoes.length - 1]?.data?.total ??
    consultasSolicitacoes[0]?.data?.total ??
    0
  const carregandoSolicitacoes = consultasSolicitacoes.some((c) => c.isPending)
  const carregandoMaisSolicitacoes =
    consultasSolicitacoes[consultasSolicitacoes.length - 1]?.isFetching ?? false

  const { data: etapasPcp = [] } = useQuery({
    queryKey: ['etapas', setorPcp?.id ?? 0],
    queryFn: () => buscarEtapasDoSetor(setorPcp!.id),
    enabled: setorPcp !== undefined,
  })

  // Unidades de passagem pelo PCP: colunas paginadas (a estrutura do PCP não
  // muda nesta sessão — a "Chegada" continua aqui).
  const { colunas: colunasUnidades, cards: unidadesNoPcp } = useColunasPaginadas({
    setorId: setorPcp?.id,
    etapas: etapasPcp,
    tipo: 'unidade',
    atualizaACada: ATUALIZA_A_CADA,
  })
  const totalUnidadesNoPcp = [...colunasUnidades.values()].reduce((s, c) => s + c.total, 0)

  // SESSAO-25: o card de reposição não tem pedido — o resumo vem da porta dele.
  const idsReposicao = cardsSolicitacoes
    .map((c) => c.id)
    .sort((a, b) => a - b)
  const { data: reposicoesPorId = new Map<number, ReposicaoResumo>() } = useQuery({
    queryKey: ['reposicoes-resumo', idsReposicao],
    queryFn: async () => new Map((await reposicoesResumo(idsReposicao)).map((r) => [r.card_id, r])),
    enabled: idsReposicao.length > 0,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const [arquivandoId, setArquivandoId] = useState<number | null>(null)
  const naoProduzir = useMutation({
    mutationFn: (cardId: number) =>
      arquivarCard(cardId, 'O PCP decidiu não produzir esta reposição.'),
    onSuccess: async () => {
      notificar({ titulo: 'Reposição arquivada — não será produzida', tom: 'perfeito' })
      setArquivandoId(null)
      await clienteQuery.invalidateQueries({ queryKey: ['cards'] })
      await clienteQuery.invalidateQueries({ queryKey: ['estoque'] })
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para arquivar a reposição',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  const [modalNovo, setModalNovo] = useState(false)
  const [cardParaLiberar, setCardParaLiberar] = useState<Card | null>(null)

  // Rodada de 30/09: três abas — solicitações de estoque, aguardando liberação
  // e todos os pedidos. A aba vive na URL (?aba=) — Voltar e link funcionam;
  // ?aba=cancelados (bookmark antigo) leva à tela nova, na Logística.
  const [parametros, setParametros] = useSearchParams()
  const abaParam = parametros.get('aba')
  const aba: 'solicitacoes' | 'quadro' | 'todos' =
    abaParam === 'solicitacoes' ? 'solicitacoes' : abaParam === 'todos' ? 'todos' : 'quadro'

  // Ajuste Estoque 2 (resposta 6 do dono): a bolinha vermelha do Estoque chega
  // com ?liberar=<card do pedido> — a decisão abre sozinha. Uma consulta
  // própria procura o card página a página NO SERVIDOR e devolve o objeto
  // pronto (nada de estado intermediário); o modal abre por derivação.
  const idLiberar = (() => {
    const v = Number(parametros.get('liberar') ?? '')
    return Number.isInteger(v) && v > 0 ? v : null
  })()
  const { data: cardDoLink = null, isFetched: buscouLiberar } = useQuery({
    queryKey: ['cards', 'pcp-liberar', idLiberar],
    enabled: idLiberar !== null && setorPcp !== undefined,
    queryFn: async () => {
      let vistos = 0
      for (let pagina = 0; pagina < 50; pagina++) {
        const r = await buscarCardsPedidoPcp({ pagina })
        const card = r.cards.find((c) => c.id === idLiberar)
        if (card) return card
        vistos += r.cards.length
        if (r.cards.length === 0 || vistos >= r.total) return null
      }
      return null
    },
  })
  function limparLiberar() {
    const novos = new URLSearchParams(parametros)
    novos.delete('liberar')
    setParametros(novos, { replace: true })
  }
  useEffect(() => {
    if (idLiberar !== null && buscouLiberar && cardDoLink === null) {
      notificar({
        titulo: 'Este pedido não está mais aguardando liberação',
        descricao: 'O PCP já decidiu, ou o pedido saiu do quadro.',
        tom: 'atencao',
      })
      limparLiberar()
    }
    // limparLiberar/notificar são estáveis no uso — o gatilho é o resultado da busca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idLiberar, buscouLiberar, cardDoLink])

  const todosOsCards = useMemo(
    () => [...cardsPedidoAbertos, ...unidadesNoPcp, ...(cardDoLink ? [cardDoLink] : [])],
    [cardsPedidoAbertos, unidadesNoPcp, cardDoLink],
  )
  const { data: pedidosPorId = new Map() } = usePedidosDosCards(todosOsCards)

  // SESSAO-24: unidade de passagem pelo PCP se arrasta (o banco decide o gesto).
  const mutacaoSoltar = useMutation({
    mutationFn: soltarCard,
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
  // A tela Cancelados mudou para a Logística (rodada de 30/09) — bookmark antigo segue.
  if (abaParam === 'cancelados') return <Navigate to="/fabrica/logistica/cancelados" replace />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {/* relative: o balão do "i" ancora nesta linha (ver Dica). */}
        <div className="relative flex items-center gap-1">
          <h1 className="text-2xl sm:text-3xl">PCP</h1>
          <Dica rotulo="Como o PCP funciona">
            <span className="flex flex-col gap-2">
              {/* D-13: entrada única pelo PCP — código fora da tela (D-27). */}
              <span>
                Todo pedido entra por aqui — e o estoque manda para cá a solicitação do que
                ficou abaixo do mínimo.
              </span>
              <span>
                Libere as unidades para os setores — dá para liberar parcial e terminar depois.
              </span>
            </span>
          </Dica>
        </div>
        <Botao icone={<Plus />} onClick={() => setModalNovo(true)}>
          Novo card de pedido
        </Botao>
      </div>

      <Abas
        rotulo="Visões do PCP"
        idBase="pcp"
        abas={[
          { valor: 'solicitacoes', rotulo: 'Solicitação de estoque', icone: <PackagePlus aria-hidden /> },
          { valor: 'quadro', rotulo: 'Pedidos aguardando liberação', icone: <PackageOpen aria-hidden /> },
          { valor: 'todos', rotulo: 'Todos os pedidos', icone: <Inbox aria-hidden /> },
        ]}
        valor={aba}
        aoMudar={(valor) => {
          const novos = new URLSearchParams(parametros)
          if (valor === 'quadro') novos.delete('aba')
          else novos.set('aba', valor)
          setParametros(novos, { replace: true })
        }}
      />

      {aba === 'solicitacoes' && (
        <div role="tabpanel" id="pcp-painel" aria-labelledby="pcp-aba-solicitacoes">
          <section aria-label="Solicitações de estoque" className="flex flex-col gap-3">
            <h2 className="text-lg">
              Solicitação de estoque{' '}
              <span className="text-texto-suave tabular-nums">({totalSolicitacoes})</span>
            </h2>
            {carregandoSolicitacoes && <p className="text-sm text-texto-fraco">Carregando…</p>}
            {!carregandoSolicitacoes && cardsSolicitacoes.length === 0 && (
              <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
                Nenhuma solicitação de estoque agora — elas nascem quando um produto do Top X
                fica abaixo do mínimo (pela automática ou pelo lançamento da logística).
              </p>
            )}
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cardsSolicitacoes.map((card) => (
                <CartaoReposicaoPcp
                  key={card.id}
                  card={card}
                  resumo={reposicoesPorId.get(card.id)}
                  agora={agora}
                  confirmandoArquivar={arquivandoId === card.id}
                  arquivando={naoProduzir.isPending && naoProduzir.variables === card.id}
                  aoLiberar={() => setCardParaLiberar(card)}
                  aoPedirArquivar={() => setArquivandoId(card.id)}
                  aoCancelarArquivar={() => setArquivandoId(null)}
                  aoArquivar={() => naoProduzir.mutate(card.id)}
                />
              ))}
            </ul>
            {cardsSolicitacoes.length < totalSolicitacoes && (
              <Botao
                variante="secundaria"
                icone={<ChevronDown />}
                className="self-start"
                carregando={carregandoMaisSolicitacoes}
                onClick={() => setPaginasSolicitacoes((p) => p + 1)}
              >
                Ver mais ({totalSolicitacoes - cardsSolicitacoes.length})
              </Botao>
            )}
          </section>
        </div>
      )}

      {aba === 'todos' && (
        <div role="tabpanel" id="pcp-painel" aria-labelledby="pcp-aba-todos">
          <PainelTodosPedidos />
        </div>
      )}

      {aba === 'quadro' && (
      <div role="tabpanel" id="pcp-painel" aria-labelledby="pcp-aba-quadro" className="flex flex-col gap-6">
      <section aria-label="Pedidos aguardando liberação" className="flex flex-col gap-3">
        <h2 className="text-lg">
          Aguardando liberação{' '}
          <span className="text-texto-suave tabular-nums">({totalPedidosAbertos})</span>
        </h2>

        {carregandoPedidos && <p className="text-sm text-texto-fraco">Carregando…</p>}
        {!carregandoPedidos && cardsPedidoAbertos.length === 0 && (
          <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
            Nenhum pedido aguardando. Pedido novo do Tiny entra aqui sozinho — o botão serve
            para trazer algum antigo que ficou de fora.
          </p>
        )}

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cardsPedidoAbertos.map((card) => {
            const resumo = card.pedido_id === null ? undefined : pedidosPorId.get(card.pedido_id)
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

                {/* SESSAO-09 (D-31): o que o Tiny fez com o pedido fica visível. */}
                {(pedidoCancelado(resumo?.situacao) || resumo?.alterado_apos_liberacao) && (
                  <p className="flex flex-wrap gap-1.5">
                    {pedidoCancelado(resumo?.situacao) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-danificado-fundo px-2.5 py-0.5 text-xs font-medium text-danificado-texto">
                        <Ban aria-hidden className="size-3.5" />
                        Cancelado no Tiny
                      </span>
                    )}
                    {resumo?.alterado_apos_liberacao && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-atencao-fundo px-2.5 py-0.5 text-xs font-medium text-atencao-texto">
                        <AlertTriangle aria-hidden className="size-3.5" />
                        Alterado no Tiny após a liberação — confira
                      </span>
                    )}
                  </p>
                )}
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

        {cardsPedidoAbertos.length < totalPedidosAbertos && (
          <Botao
            variante="secundaria"
            icone={<ChevronDown />}
            className="self-start"
            carregando={carregandoMaisPedidos}
            onClick={() => setPaginasPedidos((p) => p + 1)}
          >
            Ver mais ({totalPedidosAbertos - cardsPedidoAbertos.length})
          </Botao>
        )}
      </section>

      <section aria-label="Unidades no PCP" className="flex flex-col gap-3">
        <h2 className="text-lg">
          Unidades no PCP{' '}
          <span className="text-texto-suave tabular-nums">({totalUnidadesNoPcp})</span>
        </h2>
        {setorPcp && totalUnidadesNoPcp > 0 && (
          <QuadroKanban
            setor={setorPcp}
            etapas={etapasPcp}
            colunas={colunasUnidades}
            pedidosPorId={pedidosPorId}
            agora={agora}
            setores={setores}
            aoSoltarNaEtapa={(card, etapaId) => mutacaoSoltar.mutate({ card, etapaId })}
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
        {totalUnidadesNoPcp === 0 && (
          <p className="text-sm text-texto-fraco">
            Nenhuma unidade parada no PCP — o normal: elas nascem aqui e já seguem para os
            setores na liberação.
          </p>
        )}
      </section>
      </div>
      )}

      {setorPcp && (
        <ModalNovoPedido
          aberto={modalNovo}
          setorPcp={setorPcp}
          aoFechar={() => setModalNovo(false)}
        />
      )}
      {setorPcp && (
        <ModalLiberarPedido
          // Ajuste Estoque 2: a bolinha do Estoque (?liberar=) abre por derivação.
          cardPedido={cardParaLiberar ?? cardDoLink}
          pedido={(() => {
            const card = cardParaLiberar ?? cardDoLink
            return card && card.pedido_id !== null ? pedidosPorId.get(card.pedido_id) : undefined
          })()}
          reposicao={
            (cardParaLiberar ?? cardDoLink) ? reposicoesPorId.get((cardParaLiberar ?? cardDoLink)!.id) : undefined
          }
          setorPcp={setorPcp}
          setores={setores}
          aoFechar={() => {
            setCardParaLiberar(null)
            if (idLiberar !== null) limparLiberar()
          }}
        />
      )}
    </div>
  )
}

/**
 * SESSAO-25: o card de REPOSIÇÃO de estoque no PCP — o produto, quanto repor
 * (até o mínimo do Tiny), quanto já foi liberado e, quando houver, a
 * necessidade extrema (vendido sem estoque: esses pedidos têm card próprio).
 * Estado sempre com ícone + texto (M-12); "Não produzir" em dois toques.
 */
function CartaoReposicaoPcp({
  card,
  resumo,
  agora,
  confirmandoArquivar,
  arquivando,
  aoLiberar,
  aoPedirArquivar,
  aoCancelarArquivar,
  aoArquivar,
}: {
  card: Card
  resumo?: ReposicaoResumo
  agora: number
  confirmandoArquivar: boolean
  arquivando: boolean
  aoLiberar: () => void
  aoPedirArquivar: () => void
  aoCancelarArquivar: () => void
  aoArquivar: () => void
}) {
  const total = card.total_unidades ?? 0
  const liberadas = resumo?.liberadas ?? 0
  const extrema = resumo ? Math.max(resumo.extrema_agora, resumo.extrema_na_criacao) : 0
  return (
    <li className="flex flex-col gap-2 rounded-dm-lg border border-acao-ativa bg-superficie p-4">
      <header className="flex items-baseline justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-texto">
          <PackagePlus aria-hidden className="size-4 shrink-0" />
          Reposição de estoque
        </span>
        <span
          className="inline-flex items-center gap-1.5 text-sm text-texto-suave tabular-nums"
          title={
            card.desde ? 'No PCP desde ' + new Date(card.desde).toLocaleString('pt-BR') : undefined
          }
        >
          <Clock aria-hidden className="size-4" />
          {formatarDuracao(card.desde, agora)}
        </span>
      </header>

      <p className="line-clamp-2 text-sm text-texto">
        {card.item_descricao ?? 'Sem descrição'}
        {card.item_codigo && (
          <span className="text-texto-suave tabular-nums"> · SKU {card.item_codigo}</span>
        )}
      </p>
      {resumo && (
        <p className="text-xs text-texto-fraco tabular-nums">
          Em estoque {resumo.em_estoque_agora ?? '—'} · mínimo {resumo.minimo ?? '—'}
        </p>
      )}
      {extrema > 0 && (
        <p className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-danificado-fundo px-2.5 py-0.5 text-xs font-medium text-danificado-texto">
            <OctagonAlert aria-hidden className="size-3.5" />
            Necessidade extrema: {extrema} vendido{extrema === 1 ? '' : 's'} sem estoque
          </span>
        </p>
      )}
      <p className="text-sm text-texto tabular-nums">
        Repor {total} unidade{total === 1 ? '' : 's'} · {liberadas} liberada
        {liberadas === 1 ? '' : 's'}
      </p>

      {confirmandoArquivar ? (
        <div className="flex flex-col gap-2 rounded-dm bg-superficie-sutil p-2">
          <p className="text-sm text-texto">Não produzir esta reposição? O card sai do PCP.</p>
          <div className="flex gap-2">
            <Botao variante="perigo" carregando={arquivando} onClick={aoArquivar}>
              Sim, não produzir
            </Botao>
            <Botao variante="fantasma" onClick={aoCancelarArquivar}>
              Voltar
            </Botao>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Botao
            variante={liberadas > 0 ? 'secundaria' : 'primaria'}
            icone={<PackageOpen />}
            larguraTotal
            disabled={total === 0 || !resumo}
            onClick={aoLiberar}
          >
            {liberadas > 0 ? 'Continuar liberação' : 'Liberar unidades'}
          </Botao>
          <Botao variante="fantasma" icone={<PackageX />} onClick={aoPedirArquivar}>
            Não produzir
          </Botao>
        </div>
      )}
    </li>
  )
}

const TODOS_POR_PAGINA = 20

function formatarDataPedido(iso: string | null): string {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') : '—'
}

/**
 * Rodada de 30/09 — a aba TODOS OS PEDIDOS: a lista completa dos pedidos da
 * integração (aguardando, liberados e encerrados), com busca e páginas no
 * servidor (regra 17), pela porta de resumo que já existia. Só leitura — os
 * gestos moram nas outras abas.
 */
function PainelTodosPedidos() {
  const [busca, setBusca] = useState('')
  const [paginas, setPaginas] = useState(1)
  const consultas = useQueries({
    queries: Array.from({ length: paginas }, (_, pagina) => ({
      queryKey: ['pcp-todos', busca, pagina],
      queryFn: () =>
        pedidosResumo({
          busca: busca.trim() || undefined,
          limite: TODOS_POR_PAGINA,
          deslocamento: pagina * TODOS_POR_PAGINA,
        }),
      placeholderData: keepPreviousData,
    })),
  })
  const linhas = consultas.flatMap((c) => c.data ?? [])
  const total = Number(
    consultas[consultas.length - 1]?.data?.[0]?.contagem_total ??
      consultas[0]?.data?.[0]?.contagem_total ??
      0,
  )
  const carregando = consultas.some((c) => c.isPending)
  const carregandoMais = consultas[consultas.length - 1]?.isFetching ?? false

  return (
    <section aria-label="Todos os pedidos" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg">
          Todos os pedidos <span className="text-texto-suave tabular-nums">({total})</span>
        </h2>
        <div className="w-full max-w-md">
          <Campo
            rotulo="Buscar pedido"
            prefixo={<Search />}
            placeholder="Número do pedido ou nome do cliente"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setPaginas(1)
            }}
          />
        </div>
      </div>

      {carregando && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {!carregando && linhas.length === 0 && (
        <p className="flex items-center gap-2 rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          <Inbox aria-hidden className="size-5 shrink-0" />
          Nenhum pedido{busca.trim() ? ' para esta busca' : ''}.
        </p>
      )}

      <ul className="flex flex-col divide-y divide-borda rounded-dm-lg border border-borda bg-superficie">
        {linhas.map((p) => (
          <LinhaPedidoResumo key={p.pedido_id} pedido={p} />
        ))}
      </ul>

      {linhas.length < total && (
        <Botao
          variante="secundaria"
          icone={<ChevronDown />}
          className="self-start"
          carregando={carregandoMais}
          onClick={() => setPaginas((p) => p + 1)}
        >
          Ver mais ({total - linhas.length})
        </Botao>
      )}
    </section>
  )
}

function LinhaPedidoResumo({ pedido }: { pedido: PedidoResumo }) {
  const cancelado = pedidoCancelado(pedido.situacao)
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
      <span className="font-semibold text-texto tabular-nums">Pedido {pedido.numero}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-texto-suave">
        {pedido.cliente_nome || 'Sem cliente'} · {formatarDataPedido(pedido.data_pedido)}
      </span>
      {cancelado && (
        <span className="inline-flex items-center gap-1 rounded-full bg-danificado-fundo px-2.5 py-0.5 text-xs font-medium text-danificado-texto">
          <Ban aria-hidden className="size-3.5" />
          Cancelado
        </span>
      )}
      {!cancelado && pedido.situacao && (
        <span className="text-xs text-texto-suave">{pedido.situacao}</span>
      )}
      <span className="text-sm text-texto tabular-nums">
        {pedido.total_unidades > 0
          ? `${pedido.unidades_liberadas}/${pedido.total_unidades} liberadas`
          : 'sem produção'}
      </span>
    </li>
  )
}
