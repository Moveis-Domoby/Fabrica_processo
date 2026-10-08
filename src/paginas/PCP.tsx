import { useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  AlertTriangle,
  Archive,
  Ban,
  Boxes,
  CheckSquare,
  Clock,
  Eye,
  Inbox,
  ListChecks,
  OctagonAlert,
  PackageOpen,
  PackagePlus,
  PackageX,
  Plus,
  Search,
  Square,
} from 'lucide-react'
import { Abas, Botao, Campo, Dica, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { ehSuperAdmin } from '@/autenticacao/tipos'
import { cn } from '@/lib/cn'
import { useDebouncedValue } from '@/comercial/hooks/useDebouncedValue'
import {
  ajustarPedidosPcp,
  buscarCardsPedidoPcp,
  buscarSetores,
  itensDoPedido,
  reposicoesResumo,
  todosPedidosPcp,
  unidadesDoPedido,
} from '@/kanban/api'
import type { AcaoAjustePedido, ReposicaoResumo, ResultadoAjustePedido } from '@/kanban/api'
import type { PedidoTodosPcp } from '@/kanban/tipos'
import {
  AJUSTES_PEDIDO,
  ROTULO_SITUACAO_PLATAFORMA,
  pedidosPorExtenso,
  textoDoTotal,
} from '@/kanban/situacaoPlataforma'
import { arquivarCard } from '@/logistica/api'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import { corDaSituacao, pedidoCancelado, pedidoEntregue } from '@/kanban/situacao'
import { usePedidosDosCards } from '@/kanban/componentes/usePedidosDosCards'
import { ModalNovoPedido } from '@/kanban/componentes/ModalNovoPedido'
import { ModalLiberarPedido } from '@/kanban/componentes/ModalLiberarPedido'
import type { Card } from '@/kanban/tipos'
import { useCamposDosPedidos, useEtiquetasDosCards } from '@/utilitarios/consultas'
import { EtiquetasDoCard } from '@/utilitarios/PilulaEtiqueta'
import { CamposDoCard } from '@/utilitarios/CamposDoCard'

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
  // SESSAO-30 (D-117): o super admin marca pedidos (nas abas "aguardando
  // liberação" e "todos") e muda a situação deles na plataforma ou arquiva —
  // nada vai ao Tiny. Marcados: pedido_id → número (para a confirmação).
  const souSuperAdmin = ehSuperAdmin(perfil)
  const [selecionando, setSelecionando] = useState(false)
  const [selecionados, setSelecionados] = useState<Map<number, number>>(() => new Map())
  function alternarSelecao(pedidoId: number, numero: number) {
    setSelecionados((atual) => {
      const novo = new Map(atual)
      if (novo.has(pedidoId)) novo.delete(pedidoId)
      else novo.set(pedidoId, numero)
      return novo
    })
  }
  function marcarVarios(pedidos: { pedidoId: number; numero: number }[]) {
    setSelecionados((atual) => {
      const novo = new Map(atual)
      for (const p of pedidos) novo.set(p.pedidoId, p.numero)
      return novo
    })
  }

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

  // SESSAO-25: o card de reposição não tem pedido — o resumo vem da porta dele.
  const idsReposicao = cardsSolicitacoes.map((c) => c.id).sort((a, b) => a - b)
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
    () => [...cardsPedidoAbertos, ...(cardDoLink ? [cardDoLink] : [])],
    [cardsPedidoAbertos, cardDoLink],
  )
  const { data: pedidosPorId = new Map() } = usePedidosDosCards(todosOsCards)
  // SESSAO-27 (D-101): etiquetas e campos do pedido — só dos cards mostrados.
  const etiquetasPorCard = useEtiquetasDosCards(todosOsCards.map((c) => c.id))
  const camposPorPedido = useCamposDosPedidos(
    todosOsCards.map((c) => c.pedido_id).filter((id): id is number => id !== null),
  )

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
                Todo pedido entra por aqui — e o estoque manda para cá a solicitação do que ficou
                abaixo do mínimo.
              </span>
              <span>
                Libere as unidades para os setores — dá para liberar parcial e terminar depois.
              </span>
            </span>
          </Dica>
        </div>
        <div className="flex flex-wrap gap-2">
          {souSuperAdmin && (
            <Botao
              variante={selecionando ? 'primaria' : 'secundaria'}
              icone={<ListChecks />}
              aria-pressed={selecionando}
              onClick={() => {
                setSelecionando((s) => !s)
                setSelecionados(new Map())
              }}
            >
              {selecionando ? 'Sair da seleção' : 'Selecionar pedidos'}
            </Botao>
          )}
          <Botao icone={<Plus />} onClick={() => setModalNovo(true)}>
            Novo card de pedido
          </Botao>
        </div>
      </div>

      <Abas
        rotulo="Visões do PCP"
        idBase="pcp"
        abas={[
          { valor: 'solicitacoes', rotulo: 'Reabastecimento', icone: <PackagePlus aria-hidden /> },
          {
            valor: 'quadro',
            rotulo: 'Pedidos aguardando liberação',
            icone: <PackageOpen aria-hidden />,
          },
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
          <section aria-label="Reabastecimento" className="flex flex-col gap-3">
            <h2 className="text-lg">
              Reabastecimento{' '}
              <span className="text-texto-suave tabular-nums">({totalSolicitacoes})</span>
            </h2>
            {carregandoSolicitacoes && <p className="text-sm text-texto-fraco">Carregando…</p>}
            {!carregandoSolicitacoes && cardsSolicitacoes.length === 0 && (
              <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
                Nenhum reabastecimento agora — ele nasce quando um produto do Top X fica abaixo do
                mínimo (pela automática ou pelo lançamento da logística).
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
            <MaisAoRolar
              temMais={cardsSolicitacoes.length < totalSolicitacoes}
              carregando={carregandoMaisSolicitacoes}
              aoChegar={() => setPaginasSolicitacoes((p) => p + 1)}
            />
          </section>
        </div>
      )}

      {aba === 'todos' && (
        <div role="tabpanel" id="pcp-painel" aria-labelledby="pcp-aba-todos">
          <PainelTodosPedidos
            selecionando={selecionando}
            selecionados={selecionados}
            aoAlternar={alternarSelecao}
            aoMarcarVarios={marcarVarios}
          />
        </div>
      )}

      {aba === 'quadro' && (
        <div
          role="tabpanel"
          id="pcp-painel"
          aria-labelledby="pcp-aba-quadro"
          className="flex flex-col gap-6"
        >
          <section aria-label="Pedidos aguardando liberação" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg">
                Aguardando liberação{' '}
                <span className="text-texto-suave tabular-nums">({totalPedidosAbertos})</span>
              </h2>
              {selecionando && cardsPedidoAbertos.length > 0 && (
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  icone={<CheckSquare />}
                  onClick={() =>
                    marcarVarios(
                      cardsPedidoAbertos
                        .filter((c) => c.pedido_id !== null)
                        .map((c) => ({
                          pedidoId: c.pedido_id as number,
                          numero: pedidosPorId.get(c.pedido_id as number)?.numero ?? 0,
                        })),
                    )
                  }
                >
                  Marcar os {cardsPedidoAbertos.length} da tela
                </Botao>
              )}
            </div>

            {carregandoPedidos && <p className="text-sm text-texto-fraco">Carregando…</p>}
            {!carregandoPedidos && cardsPedidoAbertos.length === 0 && (
              <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
                Nenhum pedido aguardando. Pedido novo do Tiny entra aqui sozinho — o botão serve
                para trazer algum antigo que ficou de fora.
              </p>
            )}

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cardsPedidoAbertos.map((card) => {
                const resumo =
                  card.pedido_id === null ? undefined : pedidosPorId.get(card.pedido_id)
                const liberadas = resumo?.unidades_liberadas ?? 0
                const total = resumo?.total_unidades ?? 0
                return (
                  <li
                    key={card.id}
                    className="flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-4"
                  >
                    <header className="flex items-baseline justify-between gap-2">
                      <span className="flex items-center gap-1 font-semibold text-texto tabular-nums">
                        {selecionando && card.pedido_id !== null && (
                          <CaixaSelecao
                            marcado={selecionados.has(card.pedido_id)}
                            rotulo={`Selecionar o pedido ${resumo?.numero ?? ''}`}
                            aoAlternar={() =>
                              alternarSelecao(card.pedido_id as number, resumo?.numero ?? 0)
                            }
                          />
                        )}
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

                    {/* SESSAO-27 (D-101): etiquetas e campos customizados do pedido. */}
                    <EtiquetasDoCard ids={etiquetasPorCard.get(card.id)} />
                    {card.pedido_id !== null &&
                      (camposPorPedido.get(card.pedido_id)?.length ?? 0) > 0 && (
                        <dl className="flex flex-col gap-0.5 text-xs">
                          {camposPorPedido.get(card.pedido_id)!.map((c) => (
                            <div key={c.campoId} className="flex min-w-0 gap-1">
                              <dt className="shrink-0 text-texto-suave">{c.nome}:</dt>
                              <dd className="truncate font-medium text-texto" title={c.texto}>
                                {c.texto}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}

                    {/* Rodada de 30/09 (migration 48 — D-62): há peça no galpão
                    que atende este pedido — o sinal visual que o dono pediu. */}
                    {(card.pecas_estoque ?? 0) > 0 && (
                      <p className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-perfeito-fundo px-2.5 py-0.5 text-xs font-medium text-perfeito-texto">
                          <Boxes aria-hidden className="size-3.5" />
                          {card.pecas_estoque === 1
                            ? '1 peça no estoque — dá para usar'
                            : `${card.pecas_estoque} peças no estoque — dá para usar`}
                        </span>
                      </p>
                    )}

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

            <MaisAoRolar
              temMais={cardsPedidoAbertos.length < totalPedidosAbertos}
              carregando={carregandoMaisPedidos}
              aoChegar={() => setPaginasPedidos((p) => p + 1)}
            />
          </section>
        </div>
      )}

      {souSuperAdmin && selecionando && (
        <BarraAjustePedidos
          selecionados={selecionados}
          aoLimpar={() => setSelecionados(new Map())}
          aoTerminar={() => setSelecionados(new Map())}
        />
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
            (cardParaLiberar ?? cardDoLink)
              ? reposicoesPorId.get((cardParaLiberar ?? cardDoLink)!.id)
              : undefined
          }
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
 * integração (aguardando, liberados e encerrados), com busca no servidor.
 * SESSAO-30 (regra 18): por CURSOR — cada página pede só os 20 seguintes ao
 * último número já mostrado (a porta antiga calculava os 5.400 pedidos antes
 * de cortar: 3,2 s na 1ª página); a busca espera a pessoa parar de digitar;
 * cada linha diz também onde o pedido está NA PLATAFORMA. O super admin
 * marca pedidos aqui (D-117).
 */
function PainelTodosPedidos({
  selecionando,
  selecionados,
  aoAlternar,
  aoMarcarVarios,
}: {
  selecionando: boolean
  selecionados: Map<number, number>
  aoAlternar: (pedidoId: number, numero: number) => void
  aoMarcarVarios: (pedidos: { pedidoId: number; numero: number }[]) => void
}) {
  const [busca, setBusca] = useState('')
  const buscaAdiada = useDebouncedValue(busca.trim(), 300)
  // Lei de desempenho (§3): busca só com 2 letras ou mais — 1 letra lista tudo.
  const buscaValida = buscaAdiada.length >= 2 ? buscaAdiada : ''
  const [detalhe, setDetalhe] = useState<PedidoTodosPcp | null>(null)
  const consulta = useInfiniteQuery({
    queryKey: ['pcp-todos', buscaValida],
    queryFn: ({ pageParam }) =>
      todosPedidosPcp({
        busca: buscaValida || undefined,
        antesNumero: pageParam,
        limite: TODOS_POR_PAGINA,
      }),
    initialPageParam: null as number | null,
    getNextPageParam: (ultima) =>
      ultima.length > 0 && ultima[0].tem_mais ? ultima[ultima.length - 1].numero : undefined,
    placeholderData: keepPreviousData,
  })
  const linhas = useMemo(() => consulta.data?.pages.flat() ?? [], [consulta.data])
  const total = consulta.data?.pages[0]?.[0]?.contagem_total ?? null
  const selecionaveis = linhas.filter((p) => p.card_id !== null)

  return (
    <section aria-label="Todos os pedidos" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg">
          Todos os pedidos{' '}
          {total !== null && (
            <span className="text-texto-suave tabular-nums">({textoDoTotal(total)})</span>
          )}
        </h2>
        <div className="w-full max-w-md">
          <Campo
            rotulo="Buscar pedido"
            prefixo={<Search />}
            placeholder="Número do pedido ou nome do cliente"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {selecionando && selecionaveis.length > 0 && (
        <div>
          <Botao
            variante="fantasma"
            tamanho="sm"
            icone={<CheckSquare />}
            onClick={() =>
              aoMarcarVarios(
                selecionaveis.map((p) => ({ pedidoId: p.pedido_id, numero: p.numero })),
              )
            }
          >
            Marcar os {selecionaveis.length} da tela
          </Botao>
        </div>
      )}

      {consulta.isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {!consulta.isPending && linhas.length === 0 && (
        <p className="flex items-center gap-2 rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          <Inbox aria-hidden className="size-5 shrink-0" />
          Nenhum pedido{buscaValida ? ' para esta busca' : ''}.
        </p>
      )}

      <ul className="flex flex-col divide-y divide-borda rounded-dm-lg border border-borda bg-superficie">
        {linhas.map((p) => (
          <LinhaPedidoResumo
            key={p.pedido_id}
            pedido={p}
            aoAbrir={() => setDetalhe(p)}
            selecao={
              selecionando && p.card_id !== null
                ? {
                    marcado: selecionados.has(p.pedido_id),
                    aoAlternar: () => aoAlternar(p.pedido_id, p.numero),
                  }
                : undefined
            }
          />
        ))}
      </ul>

      <MaisAoRolar
        temMais={consulta.hasNextPage}
        carregando={consulta.isFetchingNextPage}
        aoChegar={() => {
          if (!consulta.isFetchingNextPage) void consulta.fetchNextPage()
        }}
      />

      <ModalPedidoProducao pedido={detalhe} aoFechar={() => setDetalhe(null)} />
    </section>
  )
}

/** A bolinha de cor da situação do Tiny + o texto (nunca cor sozinha — M-12). */
function SituacaoTiny({ situacao }: { situacao: string | null }) {
  if (!situacao) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-texto-suave">
      <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${corDaSituacao(situacao)}`} />
      {situacao}
    </span>
  )
}

/** SESSAO-30 (D-117): onde o pedido está NA PLATAFORMA — texto, nunca só cor (M-12). */
function SituacaoNaPlataforma({ situacao }: { situacao: PedidoTodosPcp['situacao_plataforma'] }) {
  return (
    <span className="rounded-full border border-borda px-2 py-0.5 text-xs text-texto">
      <span className="sr-only">Na plataforma: </span>
      {ROTULO_SITUACAO_PLATAFORMA[situacao]}
    </span>
  )
}

function LinhaPedidoResumo({
  pedido,
  aoAbrir,
  selecao,
}: {
  pedido: PedidoTodosPcp
  aoAbrir: () => void
  selecao?: { marcado: boolean; aoAlternar: () => void }
}) {
  // Visual do dono (30/09): pedido ENTREGUE mostra tudo liberado — conclusão
  // visual; o número real continua nas outras telas.
  const liberadas = pedidoEntregue(pedido.situacao)
    ? pedido.total_unidades
    : pedido.unidades_liberadas
  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2',
        selecao?.marcado && 'bg-superficie-sutil',
      )}
    >
      {selecao && (
        <CaixaSelecao
          marcado={selecao.marcado}
          rotulo={`Selecionar o pedido ${pedido.numero}`}
          aoAlternar={selecao.aoAlternar}
        />
      )}
      <span className="font-semibold text-texto tabular-nums">Pedido {pedido.numero}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-texto-suave">
        {pedido.cliente_nome || 'Sem cliente'} · {formatarDataPedido(pedido.data_pedido)}
      </span>
      <SituacaoTiny situacao={pedido.situacao} />
      <SituacaoNaPlataforma situacao={pedido.situacao_plataforma} />
      <span className="text-sm text-texto tabular-nums">
        {pedido.total_unidades > 0
          ? `${liberadas}/${pedido.total_unidades} liberadas`
          : 'sem produção'}
      </span>
      <button
        type="button"
        onClick={aoAbrir}
        aria-label={`Detalhes de produção do pedido ${pedido.numero}`}
        title="Detalhes de produção"
        className="-my-1 flex size-11 items-center justify-center rounded-dm text-texto-suave transition-colors hover:bg-superficie-sutil hover:text-texto"
      >
        <Eye aria-hidden className="size-4" />
      </button>
    </li>
  )
}

/** A caixinha de marcar do super admin — alvo de 44 px (D-06), estado em ícone + texto acessível. */
function CaixaSelecao({
  marcado,
  rotulo,
  aoAlternar,
}: {
  marcado: boolean
  rotulo: string
  aoAlternar: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcado}
      aria-label={rotulo}
      onClick={aoAlternar}
      className={cn(
        '-my-2 -ml-2 flex size-11 shrink-0 items-center justify-center rounded-dm transition-colors hover:bg-superficie-sutil',
        marcado ? 'text-texto' : 'text-texto-suave',
      )}
    >
      {marcado ? (
        <CheckSquare aria-hidden className="size-5" />
      ) : (
        <Square aria-hidden className="size-5" />
      )}
    </button>
  )
}

/**
 * SESSAO-30 (D-117): a barra do super admin com os pedidos marcados — mudar a
 * situação na plataforma (Concluído · Em rota · Entregue) ou arquivar. Confirma
 * antes; o resultado volta pedido a pedido (o que não deu, com o porquê). O
 * Tiny não muda (resposta do dono, 08/10).
 */
function BarraAjustePedidos({
  selecionados,
  aoLimpar,
  aoTerminar,
}: {
  selecionados: Map<number, number>
  aoLimpar: () => void
  aoTerminar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [ajuste, setAjuste] = useState<AcaoAjustePedido | ''>('')
  const [confirmando, setConfirmando] = useState<AcaoAjustePedido | null>(null)
  const [observacao, setObservacao] = useState('')
  const [resultados, setResultados] = useState<ResultadoAjustePedido[] | null>(null)
  const quantos = selecionados.size

  const mutacao = useMutation({
    mutationFn: (acao: AcaoAjustePedido) =>
      ajustarPedidosPcp({ pedidoIds: [...selecionados.keys()], acao, observacao }),
    onSuccess: async (lista) => {
      const feitos = lista.filter((r) => r.feito).length
      setConfirmando(null)
      setObservacao('')
      setAjuste('')
      if (feitos < lista.length) setResultados(lista)
      const ficaram = lista.length - feitos
      notificar({
        titulo:
          feitos === 0
            ? 'Nenhum pedido ajustado'
            : feitos === 1
              ? '1 pedido ajustado'
              : `${feitos} pedidos ajustados`,
        descricao:
          ficaram === 0
            ? undefined
            : ficaram === 1
              ? '1 pedido ficou como estava — veja o porquê.'
              : `${ficaram} pedidos ficaram como estavam — veja o porquê.`,
        tom: feitos < lista.length ? 'atencao' : 'perfeito',
      })
      aoTerminar()
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['cards'] }),
        clienteQuery.invalidateQueries({ queryKey: ['pcp-todos'] }),
        clienteQuery.invalidateQueries({ queryKey: ['pedidos-resumo'] }),
      ])
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para ajustar os pedidos',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  const numeros = [...selecionados.values()].sort((a, b) => a - b)
  const explicacao =
    confirmando === 'arquivar'
      ? 'Os pedidos e as peças deles somem das telas da plataforma (a história fica, e dá para trazer de volta).'
      : (AJUSTES_PEDIDO.find((a) => a.valor === confirmando)?.explica ?? '')
  const tituloConfirmar =
    confirmando === 'arquivar'
      ? `Arquivar ${pedidosPorExtenso(quantos)}?`
      : `Marcar ${pedidosPorExtenso(quantos)} como "${AJUSTES_PEDIDO.find((a) => a.valor === confirmando)?.rotulo ?? ''}"?`

  return (
    <>
      {/* Celular: uma linha de controles, acima do balão do chat (bottom-20);
          no computador, tudo numa linha só (E-54 — nada passa da borda). */}
      <div
        role="region"
        aria-label="Pedidos marcados"
        className="sticky bottom-20 z-30 flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-3 shadow-lg sm:bottom-3 sm:flex-row sm:items-end sm:gap-3"
      >
        <div className="flex items-center justify-between gap-2 sm:mb-3 sm:min-w-32">
          <p className="text-sm font-medium text-texto">
            {quantos === 0
              ? 'Marque os pedidos'
              : `${pedidosPorExtenso(quantos)} marcado${quantos === 1 ? '' : 's'}`}
          </p>
          <Botao
            variante="fantasma"
            disabled={quantos === 0}
            onClick={aoLimpar}
            className="sm:hidden"
          >
            Desmarcar
          </Botao>
        </div>
        <div className="flex min-w-0 flex-1 items-end gap-2">
          <Selecao
            rotulo="Mudar a situação para"
            opcoes={AJUSTES_PEDIDO.map((a) => ({ valor: a.valor, rotulo: a.rotulo }))}
            valor={ajuste || undefined}
            aoMudar={(v) => setAjuste(v as AcaoAjustePedido)}
            placeholder="Escolha…"
            className="min-w-0 flex-1 sm:max-w-56"
          />
          <Botao
            disabled={quantos === 0 || ajuste === ''}
            onClick={() => ajuste && setConfirmando(ajuste)}
          >
            Aplicar
          </Botao>
          <Botao
            variante="perigo"
            icone={<Archive />}
            aria-label="Arquivar"
            title="Arquivar"
            disabled={quantos === 0}
            onClick={() => setConfirmando('arquivar')}
            className="px-3 sm:px-4"
          >
            <span className="hidden sm:inline">Arquivar</span>
          </Botao>
          <Botao
            variante="fantasma"
            disabled={quantos === 0}
            onClick={aoLimpar}
            className="hidden sm:inline-flex"
          >
            Desmarcar
          </Botao>
        </div>
      </div>

      <Modal
        aberto={confirmando !== null}
        aoFechar={(v) => !v && !mutacao.isPending && setConfirmando(null)}
        titulo={tituloConfirmar}
        descricao="Ajuste da plataforma — o Tiny não muda."
        rodape={
          <>
            <Botao
              variante="fantasma"
              disabled={mutacao.isPending}
              onClick={() => setConfirmando(null)}
            >
              Voltar
            </Botao>
            <Botao
              variante={confirmando === 'arquivar' ? 'perigo' : 'primaria'}
              carregando={mutacao.isPending}
              onClick={() => confirmando && mutacao.mutate(confirmando)}
            >
              {confirmando === 'arquivar' ? 'Sim, arquivar' : 'Sim, aplicar'}
            </Botao>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-texto">{explicacao}</p>
          <p className="text-sm text-texto-suave tabular-nums">
            {numeros.slice(0, 30).join(' · ')}
            {numeros.length > 30 ? ` · e mais ${numeros.length - 30}` : ''}
          </p>
          <Campo
            rotulo="Por quê (opcional)"
            placeholder="Fica na auditoria"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        aberto={resultados !== null}
        aoFechar={(v) => !v && setResultados(null)}
        titulo="O que ficou como estava"
        descricao={(() => {
          const feitos = (resultados ?? []).filter((r) => r.feito).length
          return feitos === 0
            ? 'Nenhum pedido foi ajustado.'
            : feitos === 1
              ? 'O outro pedido foi ajustado.'
              : `Os outros ${feitos} pedidos foram ajustados.`
        })()}
      >
        <ul className="flex flex-col gap-2 text-sm">
          {(resultados ?? [])
            .filter((r) => !r.feito)
            .map((r) => (
              <li key={r.pedido_id} className="flex flex-col">
                <span className="font-medium text-texto tabular-nums">
                  Pedido {r.numero ?? '—'}
                </span>
                <span className="text-texto-suave">{r.resultado}</span>
              </li>
            ))}
        </ul>
      </Modal>
    </>
  )
}

/**
 * O detalhe de PRODUÇÃO do pedido (rodada do dono, 30/09): busca só ao abrir e
 * ESQUECE ao fechar (gcTime 0 — nada fica no cache), pelas portas que já
 * existiam. Itens em unidades, onde está cada unidade, situação do Tiny.
 */
function ModalPedidoProducao({
  pedido,
  aoFechar,
}: {
  pedido: PedidoTodosPcp | null
  aoFechar: () => void
}) {
  const agora = useAgora()
  const souAdminModal = useSessao().perfil?.papel === 'admin'
  const { data: itens = [], isPending: carregandoItens } = useQuery({
    queryKey: ['pcp-detalhe-itens', pedido?.pedido_id],
    queryFn: () => itensDoPedido(pedido!.pedido_id),
    enabled: pedido !== null,
    gcTime: 0,
    staleTime: 0,
  })
  const { data: unidades = [], isPending: carregandoUnidades } = useQuery({
    queryKey: ['pcp-detalhe-unidades', pedido?.pedido_id],
    queryFn: () => unidadesDoPedido(pedido!.pedido_id),
    enabled: pedido !== null,
    gcTime: 0,
    staleTime: 0,
  })
  const entregue = pedidoEntregue(pedido?.situacao)
  const liberadas = pedido ? (entregue ? pedido.total_unidades : pedido.unidades_liberadas) : 0

  return (
    <Modal
      aberto={pedido !== null}
      aoFechar={(v) => !v && aoFechar()}
      titulo={pedido ? `Pedido ${pedido.numero}` : 'Pedido'}
      descricao={
        pedido
          ? `${pedido.cliente_nome || 'Sem cliente'} · ${formatarDataPedido(pedido.data_pedido)}`
          : undefined
      }
    >
      {pedido && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <SituacaoTiny situacao={pedido.situacao} />
            {pedido.data_prevista && (
              <span className="text-xs text-texto-suave tabular-nums">
                prevista: {formatarDataPedido(pedido.data_prevista)}
              </span>
            )}
            <span className="text-sm font-medium text-texto tabular-nums">
              {pedido.total_unidades > 0
                ? `${liberadas} de ${pedido.total_unidades} unidade${pedido.total_unidades === 1 ? '' : 's'} liberada${liberadas === 1 ? '' : 's'}`
                : 'Sem itens com quantidade a produzir'}
            </span>
            {pedido.alterado_apos_liberacao && (
              <span className="inline-flex items-center gap-1 rounded-full bg-atencao-fundo px-2.5 py-0.5 text-xs font-medium text-atencao-texto">
                <AlertTriangle aria-hidden className="size-3.5" />
                Alterado no Tiny após a liberação
              </span>
            )}
          </div>

          {/* SESSAO-27 (D-101): os campos customizados do pedido — o admin preenche aqui. */}
          <CamposDoCard pedidoId={pedido.pedido_id} podeEditar={souAdminModal} />

          <section aria-label="Itens do pedido" className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold text-texto">Itens (em unidades de produção)</h3>
            {carregandoItens && <p className="text-sm text-texto-fraco">Carregando…</p>}
            {!carregandoItens && itens.length === 0 && (
              <p className="text-sm text-texto-suave">
                Nenhum item com quantidade a produzir (só frete/serviço).
              </p>
            )}
            <ul className="flex flex-col gap-1 text-sm text-texto">
              {itens.map((item) => (
                <li key={item.seq} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate" title={item.descricao ?? undefined}>
                    {item.descricao || 'Sem descrição'}
                    {item.codigo && (
                      <span className="text-texto-suave tabular-nums"> · SKU {item.codigo}</span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums text-texto-suave">
                    {item.unidades} un.
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Onde está cada unidade" className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold text-texto">Onde está cada unidade</h3>
            {carregandoUnidades && <p className="text-sm text-texto-fraco">Carregando…</p>}
            {!carregandoUnidades && unidades.length === 0 && (
              <p className="text-sm text-texto-suave">
                Nenhuma unidade liberada ainda — tudo aguardando o PCP.
              </p>
            )}
            <ul className="flex flex-col gap-1 text-sm">
              {unidades.map((u) => (
                <li key={u.card_id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span
                    className="min-w-0 flex-1 truncate text-texto"
                    title={u.item_descricao ?? undefined}
                  >
                    {u.item_descricao || 'Unidade'}
                    {u.indice_unidade !== null && u.total_unidades !== null && (
                      <span className="text-texto-suave tabular-nums">
                        {' '}
                        ({u.indice_unidade}/{u.total_unidades})
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-texto-suave">
                    {u.concluido_em
                      ? `concluída em ${u.setor_nome ?? '—'}`
                      : `${u.setor_nome ?? '—'}${u.etapa_nome ? ` · ${u.etapa_nome}` : ''}`}
                    {!u.concluido_em && u.desde && ` · há ${formatarDuracao(u.desde, agora)}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Modal>
  )
}

/**
 * Paginação por ROLAGEM (rodada do dono, 30/09): quando esta âncora entra na
 * tela e ainda há mais, pede a página seguinte — sem botão. O setState roda no
 * callback do observador (gesto do navegador), não no corpo do efeito.
 */
function MaisAoRolar({
  temMais,
  carregando,
  aoChegar,
}: {
  temMais: boolean
  carregando: boolean
  aoChegar: () => void
}) {
  const [ancora, setAncora] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!ancora || !temMais || carregando) return
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) aoChegar()
      },
      { rootMargin: '200px' },
    )
    observador.observe(ancora)
    return () => observador.disconnect()
  }, [ancora, temMais, carregando, aoChegar])

  if (!temMais) return null
  return (
    <div ref={setAncora} aria-hidden className="flex h-10 items-center justify-center">
      {carregando && <p className="text-sm text-texto-fraco">Carregando mais…</p>}
    </div>
  )
}
