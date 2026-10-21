import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
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
  Boxes,
  CheckSquare,
  Clock,
  ListChecks,
  OctagonAlert,
  PackageOpen,
  PackagePlus,
  PackageX,
  PanelRightOpen,
  Plus,
  SquarePen,
} from 'lucide-react'
import { Abas, Botao, Dica, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { MaisAoRolar } from '@/componentes/MaisAoRolar'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { ehSuperAdmin } from '@/autenticacao/tipos'
import { useAoVivo } from '@/lib/aoVivo'
import { buscarCardsPedidoPcp, buscarSetores, reposicoesResumo } from '@/kanban/api'
import type { ReposicaoResumo } from '@/kanban/api'
import { BarraAjustePedidos, CaixaSelecao } from '@/pedidos/AjustePedidos'
// SESSAO-31 (Lei §9): a aba Lançamento manual é pedaço próprio — carrega no 1º clique.
const AbaLancamentoManual = lazy(() =>
  import('@/kanban/lancamento/AbaLancamentoManual').then((m) => ({
    default: m.AbaLancamentoManual,
  })),
)
import { arquivarCard } from '@/logistica/api'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import { pedidoCancelado } from '@/kanban/situacao'
import { ModalNovoPedido } from '@/kanban/componentes/ModalNovoPedido'
import { ModalLiberarPedido } from '@/kanban/componentes/ModalLiberarPedido'
import type { Card, PedidoResumo } from '@/kanban/tipos'
import { useCamposDosPedidos } from '@/utilitarios/consultas'
import type { CampoMostrado } from '@/utilitarios/consultas'
import { EtiquetasDoCard } from '@/utilitarios/PilulaEtiqueta'
import { useAbrirCard } from '@/kanban/janela/abrirCard'
import {
  BotaoOrdemFila,
  ChipPrazo,
  PontoPrioridade,
  SeletorPrioridade,
} from '@/kanban/componentes/MarcasDoCard'
import { definirPrioridade, prioridadeDe, useOrdemDaFila } from '@/kanban/prioridade'
import type { Prioridade } from '@/kanban/prioridade'

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
  const abrirCard = useAbrirCard()

  const souAdmin = perfil?.papel === 'admin'
  const souDoPcp = vinculos.some((v) => v.setor.codigo === 'pcp')
  // SESSAO-30 (D-117): o super admin marca pedidos ("aguardando liberação") e
  // muda a situação deles na plataforma ou arquiva — nada vai ao Tiny.
  // Marcados: pedido_id → número (para a confirmação). ↪️ 14/10 (D-134): "Todos
  // os pedidos" foi para a área Pedidos — com a mesma barra.
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

  // Rodada de 30/09: as abas do PCP — solicitações de estoque e aguardando
  // liberação. A aba vive na URL (?aba=) — Voltar e link funcionam.
  // SESSAO-31 (D-125): + o Lançamento manual (card avulso e ajuste de peça).
  // ↩️ 14/10 (D-134): "Todos os pedidos" saiu daqui para a área Pedidos —
  // ?aba=todos (e o antigo ?aba=cancelados) levam para lá.
  const [parametros, setParametros] = useSearchParams()
  const abaParam = parametros.get('aba')
  const aba: 'solicitacoes' | 'quadro' | 'lancamento' =
    abaParam === 'solicitacoes'
      ? 'solicitacoes'
      : abaParam === 'lancamento'
        ? 'lancamento'
        : 'quadro'

  const { data: setores = [] } = useQuery({ queryKey: ['setores'], queryFn: () => buscarSetores() })
  const setorPcp = setores.find((s) => s.codigo === 'pcp')

  // SESSAO-30 (Lei §3 e §4): cada aba só pede o que ela mostra (antes o quadro
  // e as solicitações rodavam em qualquer aba) e as mudanças chegam AO VIVO
  // pelo websocket do PCP — sem o relógio de 20 s.
  useAoVivo('pcp', [['cards'], ['reposicoes-resumo']], { espalharMs: 1_500 })

  // SESSAO-22: pedidos ABERTOS filtrados e paginados no SERVIDOR — pedido 100%
  // liberado sai do quadro lá (projeção liberado_completo_em, D-22/D-48), e a
  // tela só requisita as páginas que mostra (10 + "Ver mais").
  // SESSAO-23 (ajuste do dono): pedido encerrado no Tiny também fica de fora —
  // o filtro vive na porta plt_fn_cards_pedido_pcp.
  // SESSAO-38 (D-154): a ordem da fila — o servidor ordena (o urgente sempre
  // primeiro); trocar de ordem recomeça da 1ª página.
  const [ordemFila, mudarOrdemFila] = useOrdemDaFila('pcp')
  const [ordemDasPaginas, setOrdemDasPaginas] = useState(ordemFila)
  const [paginasPedidos, setPaginasPedidos] = useState(1)
  const [paginasSolicitacoes, setPaginasSolicitacoes] = useState(1)
  if (ordemDasPaginas !== ordemFila) {
    setOrdemDasPaginas(ordemFila)
    setPaginasPedidos(1)
    setPaginasSolicitacoes(1)
  }
  const consultasPedidos = useQueries({
    queries: Array.from({ length: paginasPedidos }, (_, pagina) => ({
      queryKey: ['cards', 'pcp-pedidos', setorPcp?.id, ordemFila, pagina],
      queryFn: () => buscarCardsPedidoPcp({ pagina, grupo: 'pedido', ordem: ordemFila }),
      enabled: setorPcp !== undefined && aba === 'quadro',
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
  const consultasSolicitacoes = useQueries({
    queries: Array.from({ length: paginasSolicitacoes }, (_, pagina) => ({
      queryKey: ['cards', 'pcp-solicitacoes', setorPcp?.id, ordemFila, pagina],
      queryFn: () => buscarCardsPedidoPcp({ pagina, grupo: 'reposicao', ordem: ordemFila }),
      enabled: setorPcp !== undefined && aba === 'solicitacoes',
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

  // SESSAO-38 (D-151): o PCP muda a prioridade direto no card (a do pedido
  // vale para todas as peças dele, em todos os setores).
  const priorizar = useMutation({
    mutationFn: ({ cardId, prioridade }: { cardId: number; prioridade: Prioridade }) =>
      definirPrioridade(cardId, prioridade),
    onSuccess: async () => {
      await clienteQuery.invalidateQueries({ queryKey: ['cards'] })
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para mudar a prioridade',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  const [modalNovo, setModalNovo] = useState(false)
  const [cardParaLiberar, setCardParaLiberar] = useState<Card | null>(null)

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
  // SESSAO-32 (Lei §3, dívida 15): o resumo do pedido e as etiquetas vêm na
  // própria página do quadro (plt_fn_pcp_quadro) — sem leitura em fila.
  const pedidosPorId = useMemo(() => {
    const mapa = new Map<number, PedidoResumo>()
    for (const c of todosOsCards) {
      if (c.pedido_id !== null && c.pedido_resumo) mapa.set(c.pedido_id, c.pedido_resumo)
    }
    return mapa
  }, [todosOsCards])
  // SESSAO-27 (D-101): etiquetas e campos do pedido — só dos cards mostrados.
  const etiquetasPorCard = useMemo(
    () => new Map(todosOsCards.map((c) => [c.id, c.etiquetas ?? []])),
    [todosOsCards],
  )
  const camposPorPedido = useCamposDosPedidos(
    todosOsCards.map((c) => c.pedido_id).filter((id): id is number => id !== null),
  )

  if (!carregando && !souAdmin && !souDoPcp) return <Navigate to="/" replace />
  if (!perfil) return null
  // ↩️ 14/10 (D-134): Todos os pedidos e Cancelados moram na área Pedidos — link antigo segue.
  if (abaParam === 'todos') return <Navigate to="/fabrica/pedidos/todos" replace />
  if (abaParam === 'cancelados') return <Navigate to="/fabrica/pedidos/cancelados" replace />

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
          { valor: 'lancamento', rotulo: 'Lançamento manual', icone: <SquarePen aria-hidden /> },
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg">
                Reabastecimento{' '}
                <span className="text-texto-suave tabular-nums">({totalSolicitacoes})</span>
              </h2>
              <BotaoOrdemFila ordem={ordemFila} aoMudar={mudarOrdemFila} />
            </div>
            {carregandoSolicitacoes && <p className="text-sm text-texto-fraco">Carregando…</p>}
            {!carregandoSolicitacoes && cardsSolicitacoes.length === 0 && (
              <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
                Nenhum reabastecimento agora — ele nasce quando um produto do Top X fica abaixo do
                mínimo (pela automática ou pelo lançamento da logística).
              </p>
            )}
            <ul className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cardsSolicitacoes.map((card) => (
                <CartaoReposicaoPcp
                  key={card.id}
                  card={card}
                  aoPriorizar={(p) => priorizar.mutate({ cardId: card.id, prioridade: p })}
                  priorizando={priorizar.isPending && priorizar.variables?.cardId === card.id}
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

      {aba === 'lancamento' && (
        <div role="tabpanel" id="pcp-painel" aria-labelledby="pcp-aba-lancamento">
          <Suspense fallback={<p className="text-sm text-texto-fraco">Carregando…</p>}>
            <AbaLancamentoManual ativa />
          </Suspense>
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
              <span className="flex flex-wrap items-center gap-2">
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
                <BotaoOrdemFila ordem={ordemFila} aoMudar={mudarOrdemFila} />
              </span>
            </div>

            {carregandoPedidos && <p className="text-sm text-texto-fraco">Carregando…</p>}
            {!carregandoPedidos && cardsPedidoAbertos.length === 0 && (
              <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
                Nenhum pedido aguardando. Pedido novo do Tiny entra aqui sozinho — o botão serve
                para trazer algum antigo que ficou de fora.
              </p>
            )}

            {/* SESSAO-38 (item 5 do dono): cards do mesmo tamanho na grade
                (auto-rows-fr), o aviso do estoque compacto e o lado direito com
                o prazo, a prioridade e as ações. */}
            <ul className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cardsPedidoAbertos.map((card) => (
                <CartaoPedidoPcp
                  key={card.id}
                  card={card}
                  resumo={card.pedido_id === null ? undefined : pedidosPorId.get(card.pedido_id)}
                  agora={agora}
                  etiquetas={etiquetasPorCard.get(card.id)}
                  campos={card.pedido_id === null ? undefined : camposPorPedido.get(card.pedido_id)}
                  selecionando={selecionando}
                  selecionado={card.pedido_id !== null && selecionados.has(card.pedido_id)}
                  aoSelecionar={(numero) =>
                    card.pedido_id !== null && alternarSelecao(card.pedido_id, numero)
                  }
                  aoLiberar={() => setCardParaLiberar(card)}
                  aoAbrir={() => abrirCard(card.id)}
                  aoPriorizar={(p) => priorizar.mutate({ cardId: card.id, prioridade: p })}
                  priorizando={priorizar.isPending && priorizar.variables?.cardId === card.id}
                />
              ))}
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
  aoPriorizar,
  priorizando,
}: {
  card: Card
  resumo?: ReposicaoResumo
  agora: number
  /** SESSAO-38 (D-150): a reposição tem a própria prioridade (vale para as peças dela). */
  aoPriorizar: (p: Prioridade) => void
  priorizando: boolean
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
    <li
      className={cn(
        'flex h-full flex-col gap-2 rounded-dm-lg bg-superficie p-4',
        prioridadeDe(card.prioridade) === 'urgente'
          ? 'border-2 border-danificado-forte'
          : 'border border-acao-ativa',
      )}
    >
      <header className="flex items-baseline justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-texto">
          <PontoPrioridade prioridade={prioridadeDe(card.prioridade)} comTexto />
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
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-texto tabular-nums">
          Repor {total} {total === 1 ? 'unidade' : 'unidades'} · {liberadas}{' '}
          {liberadas === 1 ? 'liberada' : 'liberadas'}
        </p>
        <SeletorPrioridade
          valor={prioridadeDe(card.prioridade)}
          aoMudar={aoPriorizar}
          desabilitado={priorizando}
          compacto
        />
      </div>

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

/**
 * SESSAO-38 (item 5 do dono): o card do PEDIDO no PCP, refeito — todos do
 * mesmo tamanho (a grade iguala as linhas; o rodapé vai para baixo), o aviso
 * de peça no estoque virou um chip pequeno (antes esticava só aquele card), e
 * o lado direito ganhou o prazo (a data de entrega do Tiny), a prioridade e as
 * ações. `acoesExtras` é o lugar reservado para mais um botão (o "stand-by",
 * que outra frente traz depois).
 */
function CartaoPedidoPcp({
  card,
  resumo,
  agora,
  etiquetas,
  campos,
  selecionando,
  selecionado,
  aoSelecionar,
  aoLiberar,
  aoAbrir,
  aoPriorizar,
  priorizando,
  acoesExtras,
}: {
  card: Card
  resumo?: PedidoResumo
  agora: number
  etiquetas?: number[]
  campos?: CampoMostrado[]
  selecionando: boolean
  selecionado: boolean
  aoSelecionar: (numero: number) => void
  aoLiberar: () => void
  aoAbrir: () => void
  aoPriorizar: (p: Prioridade) => void
  priorizando: boolean
  acoesExtras?: ReactNode
}) {
  const liberadas = resumo?.unidades_liberadas ?? 0
  const total = resumo?.total_unidades ?? 0
  const prioridade = prioridadeDe(card.prioridade)
  const noEstoque = card.pecas_estoque ?? 0
  const cancelado = pedidoCancelado(resumo?.situacao)
  return (
    <li
      className={cn(
        'flex h-full min-w-0 flex-col gap-3 rounded-dm-lg bg-superficie p-4',
        prioridade === 'urgente' ? 'border-2 border-danificado-forte' : 'border border-borda',
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5 font-semibold text-texto tabular-nums">
            {selecionando && card.pedido_id !== null && (
              <CaixaSelecao
                marcado={selecionado}
                rotulo={`Selecionar o pedido ${resumo?.numero ?? ''}`}
                aoAlternar={() => aoSelecionar(resumo?.numero ?? 0)}
              />
            )}
            <PontoPrioridade prioridade={prioridade} comTexto />
            Pedido {resumo?.numero ?? '…'}
          </span>
          <p className="line-clamp-1 text-sm text-texto-suave" title={resumo?.cliente_nome}>
            {resumo?.cliente_nome || '…'}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <ChipPrazo data={resumo?.data_prevista} agora={agora} />
          <span
            className="inline-flex items-center gap-1 text-xs text-texto-suave tabular-nums"
            title={
              card.desde
                ? `No PCP desde ${new Date(card.desde).toLocaleString('pt-BR')}`
                : undefined
            }
          >
            <Clock aria-hidden className="size-3.5" />
            {formatarDuracao(card.desde, agora)}
          </span>
        </div>
      </header>

      {/* Os avisos, todos do mesmo tamanho pequeno — nenhum estica o card sozinho. */}
      {(noEstoque > 0 ||
        cancelado ||
        resumo?.alterado_apos_liberacao ||
        (etiquetas?.length ?? 0) > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Rodada de 30/09 (D-62): há peça no galpão que atende este pedido. */}
          {noEstoque > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-perfeito-fundo px-2 py-0.5 text-xs font-medium text-perfeito-texto tabular-nums"
              title={
                noEstoque === 1
                  ? '1 peça no estoque atende este pedido — dá para usar'
                  : `${noEstoque} peças no estoque atendem este pedido — dá para usar`
              }
            >
              <Boxes aria-hidden className="size-3.5" />
              {noEstoque} no estoque
            </span>
          )}
          {cancelado && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danificado-fundo px-2 py-0.5 text-xs font-medium text-danificado-texto">
              <Ban aria-hidden className="size-3.5" />
              Cancelado no Tiny
            </span>
          )}
          {resumo?.alterado_apos_liberacao && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-atencao-fundo px-2 py-0.5 text-xs font-medium text-atencao-texto"
              title="Alterado no Tiny depois da liberação — confira"
            >
              <AlertTriangle aria-hidden className="size-3.5" />
              Alterado no Tiny
            </span>
          )}
          <EtiquetasDoCard ids={etiquetas} />
        </div>
      )}

      {/* SESSAO-27 (D-101): os campos customizados do pedido. */}
      {campos && campos.length > 0 && (
        <dl className="flex flex-col gap-0.5 text-xs">
          {campos.slice(0, 2).map((c) => (
            <div key={c.campoId} className="flex min-w-0 gap-1">
              <dt className="shrink-0 text-texto-suave">{c.nome}:</dt>
              <dd className="truncate font-medium text-texto" title={c.texto}>
                {c.texto}
              </dd>
            </div>
          ))}
          {campos.length > 2 && (
            <div className="text-texto-fraco">+{campos.length - 2} no card</div>
          )}
        </dl>
      )}

      <footer className="mt-auto flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-texto tabular-nums">
            {total > 0 ? (
              <>
                {liberadas} de {total} {total === 1 ? 'unidade liberada' : 'unidades liberadas'}
              </>
            ) : (
              'Sem itens a produzir'
            )}
          </p>
          <div className="flex items-center gap-1">
            <SeletorPrioridade
              valor={prioridade}
              aoMudar={aoPriorizar}
              desabilitado={priorizando}
              compacto
            />
            <Botao
              variante="fantasma"
              tamanho="sm"
              icone={<PanelRightOpen />}
              className="min-h-toque-md px-2"
              aria-label={`Abrir o card do pedido ${resumo?.numero ?? ''}`}
              title="Abrir o card"
              onClick={aoAbrir}
            />
            {/* o lugar do próximo botão (stand-by — outra frente) */}
            {acoesExtras}
          </div>
        </div>
        <Botao
          variante={liberadas > 0 ? 'secundaria' : 'primaria'}
          icone={<PackageOpen />}
          larguraTotal
          disabled={total === 0}
          onClick={aoLiberar}
        >
          {liberadas > 0 ? 'Continuar liberação' : 'Liberar unidades'}
        </Botao>
      </footer>
    </li>
  )
}
