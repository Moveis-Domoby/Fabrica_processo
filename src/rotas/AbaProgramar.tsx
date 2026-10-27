import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MapPinPlus, Route, Truck, X } from 'lucide-react'
import { Botao, useNotificacao } from '@/componentes/ui'
import { useDebouncedValue } from '@/comercial/hooks/useDebouncedValue'
import { filtroAplicavel } from '@/kanban/filtroQuadro'
import { cn } from '@/lib/cn'
import { listarCaminhoes } from '@/admin/caminhoes'
import {
  GEOCODIFICAR_POR_CHAMADA,
  chaveDoGesto,
  geocodificar,
  listarCandidatos,
  listarParadasAvulsas,
  listarProgramadas,
  ordenarRotaComParadas,
  precisaGeocodificar,
  programarRota,
  programarRotaComParadas,
} from './api'
import type { DadosParadaAvulsa, PedidoProgramacao } from './api'
import { CartaoParadaAvulsa, NumeroParadaAvulsa } from './CartaoParadaAvulsa'
import { CartaoPedido } from './CartaoPedido'
import { FiltrosProgramar } from './FiltrosProgramar'
import { SEM_FILTROS, filtrosDoServidor, marcadosVivos, temFiltro } from './filtrosProgramacao'
import type { EscolhaDosFiltros } from './filtrosProgramacao'
import { ListaArrastavel } from './ListaArrastavel'
import { MapaProgramacao } from './MapaProgramacao'
import type { ParadaNoMapa, RotaNoMapa } from './MapaProgramacao'
import { ModalParadaAvulsa } from './ModalParadaAvulsa'
import { ModalProgramar } from './ModalProgramar'
import { PainelRota } from './PainelRota'
import {
  ehAvulsa,
  itemDoRascunho,
  marcadoresDaRota,
  misturarNaOrdem,
  ordemComONovoNoFim,
  paradaSalva,
  refDaMontagem,
  refDoItem,
} from './paradasAvulsas'
import type { ItemAvulsa, RascunhoParada } from './paradasAvulsas'
import { formatarDistancia, sugerirProximos, temPonto } from './proximidade'
import type { Ponto } from './proximidade'
import {
  COR_MONTAGEM,
  MAXIMO_PARADAS,
  decodificarLinha,
  formatarDuracao,
  ordemDaRota,
  ordemSugerida,
  ordenarCandidatos,
  pontosDaRota,
  separarTrechos,
  somarPecas,
  trechosEmLinhaReta,
} from './rotaRuas'
import { resumoDoTrajeto, trechosDaRota } from './trechos'
import type { Trajeto } from './trechos'
import { useRotaPelasRuas } from './useRotaPelasRuas'
import { useAoVivo } from '@/lib/aoVivo'

const RAIO_SUGESTAO_KM = 5
const SEM_PONTOS: Ponto[] = []
const SEM_PEDIDOS: PedidoProgramacao[] = []

/** SESSAO-41 (D-196): a rota em montagem tem pedidos E paradas avulsas (ainda não salvas). */
type ItemMontagem = PedidoProgramacao | ItemAvulsa

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

const idsDe = (lista: { card_id: number }[]) => lista.map((p) => p.card_id)
const mesmaOrdem = (a: number[], b: number[]) =>
  a.length === b.length && a.every((id, i) => id === b[i])

function hojeIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * A aba "Programar" (SESSAO-15 → SESSAO-28 → ajustes de 03/10, D-111): os
 * pedidos SEM programação; marcar um o SOBE para o bloco "Na rota", numerado na
 * ordem das paradas, onde se ARRASTA para mudar a ordem (a rota recalcula); o
 * resto fica embaixo, pelo dia de entrega mais perto (ou "mais perto" / número
 * — a setinha do "Ordenar"). Cada pedido mostra os seus móveis. Programar =
 * dia + caminhão + rota (D-128: o caminhão faz várias rotas no dia), numa
 * chamada só (o banco programa e salva a ordem junto).
 *
 * ↪️ SESSAO-38 (D-156, pedido do dono): a lista traz TODO pedido vivo — pronto,
 * em produção ou ainda no PCP (cada cartão diz qual); não depende mais do
 * "Lançar para ROTAS". O mapa mostra a rota inteira, só a ida ou só a volta. O
 * bloco "Na rota" só existe com pedido marcado e fica colado à lista (sem
 * espaço reservado).
 *
 * ↪️ SESSAO-41 (D-196, pedido do dono): o bloco "Na rota" virou "Rota
 * programada" e aceita PARADA AVULSA (título, endereço com o pino no mapa,
 * observação) — entra na lista junto com os pedidos (arrasta igual), aparece
 * pinada no mapa (quadrado "A") e é programada junto, numa transação. Sem
 * parada nenhuma (nem nesta montagem, nem na rota escolhida), o caminho é o
 * de antes.
 *
 * ↪️ SESSAO-41 (D-199, pedido do dono): a lista "Sem programação" ganhou
 * filtros (busca, situação, previsão, cidade, bairro) e ordens novas (cliente
 * A–Z/Z–A, mais peças, mais novo/antigo) — quem filtra e ordena é o SERVIDOR,
 * numa requisição só com as opções. O pedido marcado para a rota NÃO sai dela
 * quando um filtro o esconde da lista.
 */
export function AbaProgramar({
  ativa,
  aoProgramar,
}: {
  ativa: boolean
  /** Programou: a tela vai para "Já programadas", no dia, caminhão e rota. */
  aoProgramar: (dia: string, caminhaoId: number, rota: number) => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  // Os marcados para a rota, com os dados de quando foram marcados (D-199: o filtro
  // pode tirá-los da lista — da rota, não).
  const [marcados, setMarcados] = useState<Map<number, PedidoProgramacao>>(() => new Map())
  // A ordem que a pessoa arrastou (D-111); null = a sugestão do mais perto.
  const [rascunho, setRascunho] = useState<number[] | null>(null)
  const [escolha, setEscolha] = useState<EscolhaDosFiltros>(SEM_FILTROS)
  const [confirmando, setConfirmando] = useState(false)
  const [caminhaoId, setCaminhaoId] = useState('')
  const [trajeto, setTrajeto] = useState<Trajeto>('inteira')
  // SESSAO-41 (D-196): as paradas avulsas da montagem (ids negativos, só da tela)
  const [avulsas, setAvulsas] = useState<ItemAvulsa[]>([])
  const proximoIdAvulsa = useRef(-1)
  // a janela da parada aberta (o número muda a cada abertura — a janela começa limpa)
  const [janelaParada, setJanelaParada] = useState<number | null>(null)

  // SESSAO-41 (D-199): a busca vai ao servidor depois de 300 ms parada, com 2+ letras
  const buscaAplicada = filtroAplicavel(useDebouncedValue(escolha.busca, 300))
  const filtros = useMemo(() => filtrosDoServidor(escolha, buscaAplicada), [escolha, buscaAplicada])
  const {
    data: dados,
    isPending,
    isFetching,
    isPlaceholderData,
  } = useQuery({
    queryKey: ['programacao', 'candidatos', filtros],
    queryFn: () => listarCandidatos(filtros),
    enabled: ativa,
    // trocar o filtro mantém a lista de antes até a nova chegar (sem piscar)
    placeholderData: keepPreviousData,
  })
  const pedidos = dados?.itens ?? SEM_PEDIDOS
  const totalCandidatos = dados?.total ?? 0
  const filtrando = temFiltro(escolha)
  // só a lista SEM filtro e inteira diz que um marcado sumiu de verdade
  const listaCompletaSemFiltro =
    !filtrando && !isPlaceholderData && dados !== undefined && dados.total <= dados.itens.length
  // SESSAO-30 (Lei §4): pedido lançado/programado/"não entregue" → AO VIVO, sem relógio.
  useAoVivo('rotas', [['programacao']], ativa)
  const { data: caminhoes = [] } = useQuery({
    queryKey: ['caminhoes', false],
    queryFn: () => listarCaminhoes(false),
    enabled: ativa,
  })

  // Geocodificação preguiçosa: quem ainda não tem ponto vai à Edge Function
  // (alguns por vez), uma vez só por chave nesta visita.
  const pedidas = useRef<Set<string>>(new Set())
  const geocodificarMutacao = useMutation({
    mutationFn: geocodificar,
    onSuccess: async () => {
      await clienteQuery.invalidateQueries({ queryKey: ['programacao'] })
    },
  })
  useEffect(() => {
    if (geocodificarMutacao.isPending) return
    const pendentes = pedidos
      .filter((p) => precisaGeocodificar(p) && !pedidas.current.has(p.geo_chave!))
      .slice(0, GEOCODIFICAR_POR_CHAMADA)
    if (pendentes.length === 0) return
    for (const p of pendentes) pedidas.current.add(p.geo_chave!)
    geocodificarMutacao.mutate(
      pendentes.map((p) => ({ chave: p.geo_chave!, endereco: p.endereco_geocodificavel! })),
    )
  }, [pedidos, geocodificarMutacao])

  // ---- a rota que se está montando ----------------------------------------
  const naLista = useMemo(() => new Map(pedidos.map((p) => [p.card_id, p])), [pedidos])
  const listaSelecionados = useMemo(
    () => marcadosVivos(marcados, naLista, listaCompletaSemFiltro),
    [marcados, naLista, listaCompletaSemFiltro],
  )
  const itensMontando = useMemo<ItemMontagem[]>(
    () => [...listaSelecionados, ...avulsas],
    [listaSelecionados, avulsas],
  )
  const ordemMontando = useMemo(
    () => ordemDaRota(itensMontando, { rascunho }),
    [itensMontando, rascunho],
  )
  const idsMontando = useMemo(() => idsDe(ordemMontando), [ordemMontando])
  const ordemDaSugestao = useMemo(() => idsDe(ordemSugerida(itensMontando)), [itensMontando])
  const ajustada = !mesmaOrdem(idsMontando, ordemDaSugestao)
  const porId = useMemo(
    () => new Map(listaSelecionados.map((p) => [p.card_id, p])),
    [listaSelecionados],
  )
  const avulsaPorId = useMemo(() => new Map(avulsas.map((a) => [a.card_id, a])), [avulsas])

  const naoSelecionados = useMemo(
    () => pedidos.filter((p) => !marcados.has(p.card_id)),
    [pedidos, marcados],
  )
  const referencia = useMemo(() => ordemMontando.filter(temPonto) as Ponto[], [ordemMontando])
  // a ordem é a do servidor; só "mais perto" se calcula aqui (depende da rota montada)
  const listaOrdenada = useMemo(
    () =>
      escolha.ordem === 'perto'
        ? ordenarCandidatos(naoSelecionados, 'perto', referencia)
        : naoSelecionados,
    [naoSelecionados, escolha.ordem, referencia],
  )
  const sugestoes = useMemo(
    () => sugerirProximos(listaSelecionados, pedidos, RAIO_SUGESTAO_KM),
    [listaSelecionados, pedidos],
  )
  const sugestaoDe = useMemo(
    () => new Map(sugestoes.map((s) => [s.item.card_id, s.distanciaKm])),
    [sugestoes],
  )

  const pontosRota = useMemo(() => pontosDaRota(ordemMontando), [ordemMontando])
  const estadoRota = useRotaPelasRuas(
    pontosRota.length - 2 > MAXIMO_PARADAS ? SEM_PONTOS : pontosRota,
  )
  const geometria =
    estadoRota.estado === 'pronta'
      ? estadoRota.rota.geometria
      : estadoRota.estado === 'calculando'
        ? (estadoRota.anterior?.geometria ?? null)
        : null
  const pronta = estadoRota.estado === 'pronta'
  const trechosNoMapa = useMemo(() => {
    if (!geometria) return null
    const linha = decodificarLinha(geometria)
    // a linha de ANTES (outra ordem) não se corta pelos pontos de agora
    return pronta ? separarTrechos(linha, pontosRota) : [linha]
  }, [geometria, pronta, pontosRota])
  const trechos = useMemo(
    () => trechosDaRota(estadoRota, trechosEmLinhaReta(pontosRota)),
    [estadoRota, pontosRota],
  )

  // SESSAO-41 (D-196): a parada avulsa com o marcador próprio, na mesma numeração
  const paradasNoMapa: ParadaNoMapa[] = useMemo(
    () => marcadoresDaRota(ordemMontando),
    [ordemMontando],
  )
  const rotasNoMapa: RotaNoMapa[] = useMemo(
    () => [
      {
        id: 'montagem',
        cor: COR_MONTAGEM,
        paradas: paradasNoMapa,
        trechos: trechosNoMapa,
        recalculando: estadoRota.estado === 'calculando' && trechosNoMapa !== null,
      },
    ],
    [paradasNoMapa, trechosNoMapa, estadoRota.estado],
  )
  const numerosNoMapa = useMemo(() => paradasNoMapa.map((p) => p.numero), [paradasNoMapa])
  const pecas = somarPecas(listaSelecionados)
  const kmTotal = trechos.reduce((s, t) => s + t.km, 0)
  const resumoTrajeto = resumoDoTrajeto(trajeto, trechos, numerosNoMapa)
  const resumoMapa =
    ordemMontando.length === 0
      ? null
      : resumoTrajeto !== null
        ? resumoTrajeto
        : estadoRota.estado === 'pronta'
          ? `${ordemMontando.length} parada(s) · ${pecas} peças · ${formatarDistancia(estadoRota.rota.distancia_m / 1000)} · ${formatarDuracao(estadoRota.rota.duracao_s)} dirigindo`
          : estadoRota.estado === 'calculando'
            ? `${ordemMontando.length} parada(s) · calculando a rota…`
            : pontosRota.length > 0
              ? `${ordemMontando.length} parada(s) · ${formatarDistancia(kmTotal)} em linha reta`
              : `${ordemMontando.length} parada(s) · nenhuma no mapa`

  // ---- gestos ------------------------------------------------------------
  const alternar = useCallback((p: PedidoProgramacao) => {
    setMarcados((atual) => {
      const novo = new Map(atual)
      if (novo.has(p.card_id)) novo.delete(p.card_id)
      else novo.set(p.card_id, p)
      return novo
    })
  }, [])
  const escolherSugestao = alternar
  const reordenar = useCallback((novos: number[]) => setRascunho(novos), [])
  const voltarSugestao = useCallback(() => setRascunho(null), [])
  function limpar() {
    setMarcados(new Map())
    setRascunho(null)
    setTrajeto('inteira')
    setAvulsas([])
  }

  // SESSAO-41 (D-196): a parada avulsa entra na montagem — arrastou antes, ela vai para o fim
  function porAvulsa(dados: DadosParadaAvulsa) {
    const id = proximoIdAvulsa.current
    proximoIdAvulsa.current -= 1
    const rascunhoParada: RascunhoParada = { ...dados, chave: chaveDoGesto() }
    setAvulsas((atual) => [...atual, itemDoRascunho(rascunhoParada, id)])
    setRascunho((atual) => (atual ? [...atual, id] : atual))
    setJanelaParada(null)
  }
  const tirarAvulsa = useCallback((id: number) => {
    setAvulsas((atual) => atual.filter((a) => a.card_id !== id))
    setRascunho((atual) => (atual ? atual.filter((x) => x !== id) : atual))
  }, [])

  const programarMutacao = useMutation({
    mutationFn: async (v: {
      data: string
      caminhaoId: number
      rota: number
      /** A montagem NA ORDEM da tela: pedidos e paradas avulsas novas. */
      montagem: ItemMontagem[]
      ajustada: boolean
    }): Promise<{ ordemSalva: boolean }> => {
      const cardIds = v.montagem.filter((p) => !ehAvulsa(p)).map((p) => p.card_id)
      const novas = v.montagem.flatMap((p) =>
        ehAvulsa(p) && !paradaSalva(p.avulsa) ? [p.avulsa] : [],
      )
      // D-109: a rota escolhida do caminhão naquele dia (D-128) — quem já está
      // nela fica na ordem dela e os novos entram no FIM; se nada estava salvo
      // e a montagem não foi mexida, o banco fica com a sugestão de tudo.
      // SESSAO-41 (D-196): a rota pode já ter parada avulsa (posta em "Já
      // programadas" ou pelo entregador) — elas dividem a ordem com os pedidos.
      const [programadas, paradasDoDia] = await Promise.all([
        listarProgramadas({ data: v.data, caminhaoId: v.caminhaoId, limite: 200 }),
        listarParadasAvulsas({ de: v.data, ate: v.data }).catch((erro: unknown) => {
          // sem parada nova, a leitura das paradas não pode travar o programar de sempre
          if (novas.length === 0) return []
          throw erro
        }),
      ])
      const existentes = programadas.filter((p) => p.rota === v.rota)
      const paradasExistentes = paradasDoDia.filter(
        (p) => p.caminhao_id === v.caminhaoId && p.rota === v.rota,
      )
      if (novas.length === 0 && paradasExistentes.length === 0) {
        const temSalva = existentes.some((p) => typeof p.ordem === 'number')
        const ordem =
          temSalva || v.ajustada ? [...idsDe(ordemDaRota(existentes)), ...cardIds] : null
        await programarRota({
          data: v.data,
          caminhaoId: v.caminhaoId,
          rota: v.rota,
          cardIds,
          ordem,
        })
        return { ordemSalva: true }
      }

      // Com parada: tudo numa transação (pedidos + paradas + a ordem da tela).
      const tela = v.montagem.map(refDaMontagem)
      const jaNaRota = misturarNaOrdem(existentes, paradasExistentes).map(refDoItem)
      const base = { data: v.data, caminhaoId: v.caminhaoId, rota: v.rota, cardIds, paradas: novas }
      if (jaNaRota.length === 0) {
        await programarRotaComParadas({ ...base, ordem: tela })
        return { ordemSalva: true }
      }
      // A rota já tinha itens: o banco põe a ordem da tela ANTES do que já estava
      // — programa sem ordem e, em seguida, salva o que já estava primeiro e o
      // novo no FIM (como sempre foi). Se só a ordem falhar, a programação fica.
      const ids = await programarRotaComParadas({ ...base, ordem: null })
      try {
        await ordenarRotaComParadas({
          data: v.data,
          caminhaoId: v.caminhaoId,
          rota: v.rota,
          itens: ordemComONovoNoFim(jaNaRota, tela, ids),
        })
        return { ordemSalva: true }
      } catch {
        return { ordemSalva: false }
      }
    },
    onSuccess: async (resultado, v) => {
      const nPedidos = v.montagem.filter((p) => !ehAvulsa(p)).length
      const nParadas = v.montagem.length - nPedidos
      notificar({
        titulo:
          (nPedidos === 1 ? 'Entrega programada' : `${nPedidos} entregas programadas`) +
          (nParadas > 0 ? ` · ${plural(nParadas, 'parada avulsa', 'paradas avulsas')}` : ''),
        descricao: resultado.ordemSalva
          ? undefined
          : 'A ordem não ficou salva (a rota mudou noutra tela) — confira e salve em "Já programadas".',
        tom: resultado.ordemSalva ? 'perfeito' : 'atencao',
      })
      limpar()
      setConfirmando(false)
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['programacao'] }),
        clienteQuery.invalidateQueries({ queryKey: ['programadas'] }),
        clienteQuery.invalidateQueries({ queryKey: ['rotas'] }),
        clienteQuery.invalidateQueries({ queryKey: ['paradas-avulsas'] }),
        clienteQuery.invalidateQueries({ queryKey: ['entregas-do-dia'] }),
      ])
      aoProgramar(v.data, v.caminhaoId, v.rota)
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para programar',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  const opcoesCaminhao = caminhoes.map((c) => ({
    valor: String(c.id),
    rotulo: c.placa ? `${c.nome} · ${c.placa}` : c.nome,
  }))
  const semPonto = ordemMontando.filter((p) => !temPonto(p)).length
  const nAvulsas = avulsas.length
  const botaoParada = (
    <Botao
      variante="secundaria"
      tamanho="sm"
      icone={<MapPinPlus />}
      onClick={() => setJanelaParada(Date.now())}
    >
      Adicionar parada avulsa
    </Botao>
  )

  return (
    // duas colunas só quando a ÁREA da tela tem espaço (container, não janela — E-30):
    // com os dois menus abertos numa tela de 1024, a lista ficava com 221 px. Numa
    // coluna só: "Na rota" → mapa → a lista; em duas: o mapa à direita, fixo.
    // ↩️ SESSAO-38 (pedido do dono, imagem 3): a coluna da esquerda é UMA pilha
    // ("Na rota" + "Sem programação") — antes eram duas linhas de grade e a linha
    // de cima esticava até a altura do mapa, deixando um vão entre "Na rota" e a
    // lista. Agora "Na rota" só existe com pedido marcado e cresce na medida em
    // que a lista encolhe; o "Ordenar por" fica no cabeçalho da lista.
    <div className="@container flex flex-col gap-5">
      <div className="flex flex-col gap-5 @3xl:grid @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @3xl:items-start">
        {/* Numa coluna só esta pilha "some" (contents) e cada parte vai para a sua vez (order). */}
        <div className="contents @3xl:col-start-1 @3xl:row-start-1 @3xl:flex @3xl:min-w-0 @3xl:flex-col @3xl:gap-5">
          {/* Rota programada (↩️ SESSAO-41, era "Na rota"): os marcados sobem,
              numerados, e se arrastam (D-111) — com as paradas avulsas no meio. */}
          {ordemMontando.length > 0 && (
            <section className="order-1 flex min-w-0 flex-col gap-2 rounded-dm-lg border border-acao-ativa bg-superficie-sutil p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg">
                  <Route aria-hidden className="size-5 text-texto-suave" />
                  Rota programada{' '}
                  <span className="text-sm font-normal text-texto-suave tabular-nums">
                    ({ordemMontando.length} · {pecas} {pecas === 1 ? 'peça' : 'peças'})
                  </span>
                </h2>
                {botaoParada}
              </div>
              <p className="text-xs text-texto-suave">
                {ajustada
                  ? 'Ordem ajustada à mão'
                  : 'Ordem sugerida: o mais perto, a partir da fábrica'}{' '}
                · arraste para mudar
              </p>
              <ListaArrastavel
                ids={idsMontando}
                rotulo="Pedidos e paradas na rota, na ordem"
                aoReordenar={reordenar}
              >
                {(id, indice) => {
                  const a = avulsaPorId.get(id)
                  if (a) {
                    return (
                      <div className="flex min-h-toque-lg items-start gap-3 rounded-dm-lg border border-acao-ativa bg-superficie p-3">
                        <NumeroParadaAvulsa numero={indice + 1} />
                        <CartaoParadaAvulsa parada={a.avulsa} />
                        <Botao
                          variante="fantasma"
                          tamanho="sm"
                          icone={<X />}
                          className="shrink-0"
                          aria-label={`Tirar a parada "${a.avulsa.titulo}" da rota`}
                          onClick={() => tirarAvulsa(id)}
                        >
                          Tirar
                        </Botao>
                      </div>
                    )
                  }
                  const p = porId.get(id)
                  if (!p) return null
                  return (
                    // div, não label: tocar no cartão não tira o pedido da rota (só a caixinha)
                    <div className="flex min-h-toque-lg items-start gap-3 rounded-dm-lg border border-acao-ativa bg-superficie p-3">
                      <input
                        type="checkbox"
                        className="mt-1 size-5 shrink-0 accent-marca-500"
                        checked
                        onChange={() => alternar(p)}
                        aria-label={`Tirar o pedido ${p.numero} da rota`}
                      />
                      <span
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-acao text-xs font-bold text-acao-texto tabular-nums"
                        aria-label={`${indice + 1}ª parada`}
                      >
                        {indice + 1}
                      </span>
                      <CartaoPedido pedido={p} />
                    </div>
                  )
                }}
              </ListaArrastavel>
            </section>
          )}

          <section className="order-3 flex min-w-0 flex-col gap-3">
            <h2 className="text-lg">
              Sem programação{' '}
              <span className="text-sm font-normal text-texto-suave tabular-nums">
                ({dados?.total_geral ?? 0})
              </span>
            </h2>
            <p className="text-xs text-texto-suave">
              Todos os pedidos em andamento ainda sem rota — prontos, em produção ou ainda no PCP.
              Programado, o pedido passa para "Já programadas".
            </p>
            <FiltrosProgramar escolha={escolha} aoMudar={setEscolha} dados={dados} />
            {filtrando && dados && (
              <p className="text-sm text-texto-suave tabular-nums" aria-live="polite">
                {totalCandidatos === 1
                  ? '1 pedido bate com os filtros'
                  : `${totalCandidatos} pedidos batem com os filtros`}
                {isFetching && ' · atualizando…'}
              </p>
            )}
            {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
            {!isPending && pedidos.length === 0 && (
              <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
                {filtrando
                  ? 'Nenhum pedido bate com os filtros. Limpe os filtros para ver todos.'
                  : 'Nenhum pedido em andamento sem programação.'}
              </p>
            )}
            {totalCandidatos > pedidos.length && (
              <p className="text-xs text-atencao-texto tabular-nums">
                Mostrando os {pedidos.length} primeiros de {totalCandidatos} — use a busca e os
                filtros para achar os outros.
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {listaOrdenada.map((p) => {
                const distancia = sugestaoDe.get(p.card_id)
                return (
                  <li key={p.card_id}>
                    <label
                      className={cn(
                        'flex min-h-toque-lg cursor-pointer items-start gap-3 rounded-dm-lg border bg-superficie p-3',
                        distancia !== undefined ? 'border-atencao-borda' : 'border-borda',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 size-5 shrink-0 accent-marca-500"
                        checked={false}
                        onChange={() => alternar(p)}
                        aria-label={`Selecionar o pedido ${p.numero}`}
                      />
                      <CartaoPedido
                        pedido={p}
                        selo={
                          distancia !== undefined ? (
                            <span className="rounded-full bg-atencao-fundo px-2 py-0.5 text-xs font-medium text-atencao-texto">
                              sugestão · {formatarDistancia(distancia)}
                            </span>
                          ) : undefined
                        }
                      />
                    </label>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        <section className="order-2 flex min-w-0 flex-col gap-3 @3xl:sticky @3xl:top-4 @3xl:col-start-2 @3xl:row-start-1 @3xl:self-start">
          <h2 className="text-lg">
            Mapa{' '}
            <span className="text-sm font-normal text-texto-suave">
              F = fábrica (saída e volta) · amarelo numerado = ordem das paradas · quadrado "A" =
              parada avulsa · âmbar = pedidos próximos (até {RAIO_SUGESTAO_KM} km)
            </span>
          </h2>
          <MapaProgramacao
            rotas={rotasNoMapa}
            trajeto={trajeto}
            aoMudarTrajeto={setTrajeto}
            resumo={resumoMapa}
            sugestoes={sugestoes}
            aoEscolherSugestao={escolherSugestao}
          />
          {ordemMontando.length > 0 ? (
            <PainelRota
              titulo="Rota que você está montando"
              cor={COR_MONTAGEM}
              paradas={ordemMontando}
              estado={estadoRota}
              trechos={trechos}
              trajeto={trajeto}
              ajustada={ajustada}
              aoVoltarSugestao={voltarSugestao}
            />
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-dm border border-borda bg-superficie p-4">
              <p className="text-sm text-texto-suave">
                Marque pedidos na lista para montar a rota — ela sai da fábrica, passa pelas
                entregas e volta. Dá para pôr também uma parada avulsa (buscar material, passar num
                endereço).
              </p>
              {botaoParada}
            </div>
          )}
          {paradasNoMapa.length > MAXIMO_PARADAS && (
            <p className="text-xs text-atencao-texto">
              Mais de {MAXIMO_PARADAS} paradas no mapa: a rota pelas ruas não é calculada —
              mostrando em linha reta.
            </p>
          )}
        </section>
      </div>

      {ordemMontando.length > 0 && (
        <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-3 rounded-dm-lg border border-acao-ativa bg-superficie p-3 shadow-lg">
          <span className="text-sm text-texto tabular-nums">
            {listaSelecionados.length} pedido(s) · {pecas} {pecas === 1 ? 'peça' : 'peças'}
            {nAvulsas > 0 && ` · ${plural(nAvulsas, 'parada avulsa', 'paradas avulsas')}`}
            {estadoRota.estado === 'pronta' && (
              <span className="text-texto-suave">
                {' '}
                · rota de {formatarDistancia(estadoRota.rota.distancia_m / 1000)} pelas ruas, ida e
                volta
              </span>
            )}
            {semPonto > 0 && (
              <span className="text-texto-suave"> · {semPonto} sem ponto no mapa</span>
            )}
            {listaSelecionados.length === 0 && (
              <span className="text-atencao-texto">
                {' '}
                · marque ao menos um pedido para programar
              </span>
            )}
          </span>
          <span className="ml-auto flex gap-2">
            <Botao variante="fantasma" onClick={limpar}>
              Limpar
            </Botao>
            <Botao
              icone={<Truck />}
              onClick={() => setConfirmando(true)}
              disabled={listaSelecionados.length === 0}
            >
              Programar
            </Botao>
          </span>
        </div>
      )}

      {confirmando && (
        <ModalProgramar
          titulo={`Programar ${listaSelecionados.length} pedido(s)`}
          resumo={`${listaSelecionados.length} pedido(s) · ${pecas} ${pecas === 1 ? 'peça' : 'peças'}${nAvulsas > 0 ? ` · ${plural(nAvulsas, 'parada avulsa', 'paradas avulsas')}` : ''} — numa rota nova do caminhão, ou no fim de uma rota que ele já tem no dia.`}
          diaInicial={hojeIso()}
          caminhaoInicial={caminhaoId}
          opcoesCaminhao={opcoesCaminhao}
          padraoRota="nova"
          carregando={programarMutacao.isPending}
          aoFechar={() => setConfirmando(false)}
          aoConfirmar={(data, caminhao, rota) => {
            setCaminhaoId(String(caminhao))
            programarMutacao.mutate({
              data,
              caminhaoId: caminhao,
              rota,
              montagem: ordemMontando,
              ajustada,
            })
          }}
        />
      )}

      <ModalParadaAvulsa
        key={janelaParada ?? 'parada-fechada'}
        aberto={janelaParada !== null}
        descricao="Buscar material, levar uma peça, passar num endereço — a parada entra na rota que você está montando e é programada junto."
        aoFechar={() => setJanelaParada(null)}
        aoSalvar={porAvulsa}
      />
    </div>
  )
}
