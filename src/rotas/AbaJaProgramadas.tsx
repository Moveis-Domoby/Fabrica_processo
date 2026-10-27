import { useCallback, useMemo, useState } from 'react'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  CalendarDays,
  MapPin,
  MapPinPlus,
  NotebookPen,
  RotateCcw,
  Save,
  Truck,
  Users,
  X,
} from 'lucide-react'
import { Botao, Campo, Selecao, useNotificacao } from '@/componentes/ui'
import { useDebouncedValue } from '@/comercial/hooks/useDebouncedValue'
import { FiltroDoQuadro } from '@/kanban/componentes/FiltroDoQuadro'
import { filtroAplicavel } from '@/kanban/filtroQuadro'
import { cn } from '@/lib/cn'
import { listarCaminhoes, urlFotoCaminhao } from '@/admin/caminhoes'
import {
  chaveDoGesto,
  dataLegivel,
  desprogramarEntrega,
  listarParadasAvulsas,
  listarProgramadas,
  nomeDaRota,
  ordenarRota,
  ordenarRotaComParadas,
  programarEntrega,
  removerParadaAvulsa,
  salvarParadaAvulsa,
} from './api'
import type { DadosParadaAvulsa, ItemDaOrdem, ParadaAvulsa, PedidoProgramado } from './api'
import { BotaoRotaGoogleMaps } from './BotoesNavegacao'
import { CartaoParadaAvulsa, NumeroParadaAvulsa } from './CartaoParadaAvulsa'
import { CartaoPedido } from './CartaoPedido'
import { ListaArrastavel } from './ListaArrastavel'
import { useGeocodificarFaltantes } from './useGeocodificarFaltantes'
import { MapaProgramacao } from './MapaProgramacao'
import type { RotaNoMapa } from './MapaProgramacao'
import { ModalParadaAvulsa } from './ModalParadaAvulsa'
import { ModalProgramar } from './ModalProgramar'
import { ModalDetalheEntrega, ModalEquipe } from './ModaisProgramacao'
import { PainelRota } from './PainelRota'
import {
  CHAVES_PARADA_AVULSA,
  ativaNaRota,
  completarOrdem,
  ehAvulsa,
  itemDaParada,
  janelaDasParadas,
  marcadoresDaRota,
  misturarNaOrdem,
  numerosNoMapaDaLista,
  paraNavegar,
  paradaSalva,
  refDoItem,
} from './paradasAvulsas'
import type { ItemAvulsa } from './paradasAvulsas'
import { formatarDistancia } from './proximidade'
import type { Ponto } from './proximidade'
import {
  MAXIMO_PARADAS,
  corDoCaminhao,
  decodificarLinha,
  formatarDuracao,
  ordemDaRota,
  ordemSugerida,
  pontosDaRota,
  separarTrechos,
  somarPecas,
  trechosEmLinhaReta,
} from './rotaRuas'
import { resumoDoTrajeto, trechosDaRota } from './trechos'
import type { Trajeto } from './trechos'
import { useRotaPelasRuas, useRotasPelasRuas } from './useRotaPelasRuas'
import { useAoVivo } from '@/lib/aoVivo'

const POR_PAGINA = 50
const SEM_PONTOS: Ponto[] = []
const SEM_PARADAS: ParadaAvulsa[] = []

const idsDe = (lista: { card_id: number }[]) => lista.map((p) => p.card_id)
const mesmaOrdem = (a: number[], b: number[]) =>
  a.length === b.length && a.every((id, i) => id === b[i])
const chaveGrupo = (dia: string, caminhaoId: number, rota: number) => `${dia}|${caminhaoId}|${rota}`

function diaPorExtenso(iso: string): string {
  const texto = new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** SESSAO-41 (D-196): a rota tem pedidos E paradas avulsas, misturados pela ordem. */
type ItemRota = PedidoProgramado | ItemAvulsa

interface Grupo {
  chave: string
  dia: string
  caminhaoId: number
  /** SESSAO-31 (D-128): a rota do caminhão no dia. */
  rota: number
  /** O caminhão tem mais de uma rota neste dia (o nome da rota aparece). */
  variasRotas: boolean
  caminhaoNome: string
  caminhaoPlaca: string | null
  cor: string
  /** Os pedidos da rota que a página trouxe. */
  pedidos: PedidoProgramado[]
  /** SESSAO-41 (D-196): as paradas avulsas da rota. */
  avulsas: ItemAvulsa[]
}

const itensDo = (g: Grupo): ItemRota[] => [...g.pedidos, ...g.avulsas]

/** "Todos" no filtro de caminhão (a Selecao do Radix não aceita valor vazio). */
const TODOS_CAMINHOES = 'todos'

/** "Baú 1" ou, com várias rotas no dia, "Baú 1 · Rota 2". */
const nomeDoGrupo = (g: Grupo) =>
  g.variasRotas ? `${g.caminhaoNome} · ${nomeDaRota(g.rota)}` : g.caminhaoNome

/** Os pontos da rota de um grupo, na ordem salva (ou sugerida) — a parada já feita fica fora. */
function pontosDoGrupo(g: Grupo): Ponto[] {
  return pontosDaRota(ordemDaRota(itensDo(g)).filter(ativaNaRota))
}

/**
 * SESSAO-41 (D-196): a rota como está no BANCO agora, pedidos e paradas na
 * ordem — lida no clique (pôr parada, salvar a ordem), porque a página pode
 * não ter trazido a rota inteira e a ordem nova precisa de todos os itens.
 */
async function ordemDaRotaNoBanco(
  dia: string,
  caminhaoId: number,
  rota: number,
): Promise<ItemDaOrdem[]> {
  const [programadas, paradas] = await Promise.all([
    listarProgramadas({ data: dia, caminhaoId, limite: 200 }),
    listarParadasAvulsas({ de: dia, ate: dia }),
  ])
  return misturarNaOrdem(
    programadas.filter((p) => (p.rota ?? 1) === rota),
    paradas.filter((p) => p.caminhao_id === caminhaoId && p.rota === rota),
  ).map(refDoItem)
}

/**
 * A aba "Já programadas" (ajustes da SESSAO-28, 03/10 — D-111): TODAS as
 * programações ainda não entregues, separadas por dia e por caminhão — cada
 * caminhão com a sua COR (faixa, linha no mapa, contorno das paradas) e as
 * entregas dele juntas, na ordem da rota. Escolher um caminhão acende a rota
 * dele no mapa; os outros caminhões do mesmo dia ficam transparentes. No
 * caminhão escolhido a ordem se ARRASTA e se salva. Paginada no servidor —
 * "Ver mais" busca a próxima página. ↪️ SESSAO-30 (D-120): o histórico de
 * entregues saiu daqui — o entregue mora no PCP → Todos os pedidos.
 * ↪️ SESSAO-31 (D-128): o caminhão faz várias rotas no dia — o grupo é (dia,
 * caminhão, ROTA), cada rota com a sua ordem e a sua equipe.
 * ↪️ SESSAO-38 (D-156): o programado pode ainda estar em produção ou no PCP —
 * cada parada diz o estado; o mapa mostra a rota inteira, só a ida ou só a volta.
 * ↪️ SESSAO-41 (D-196, pedido do dono): a "rota programada" mistura os pedidos
 * e as PARADAS AVULSAS pela ordem (na lista, no painel e no mapa — o quadrado
 * "A"); na rota escolhida dá para pôr parada, tirar, arrastar tudo e salvar a
 * ordem inteira. A parada mostra a situação (Feita / Não feita com o motivo).
 * ↪️ SESSAO-41 (D-199, pedido do dono): filtros — a busca (acha a ROTA inteira
 * que tem o pedido ou a parada que bate: o mapa e a ordem não se quebram), o
 * caminhão e o dia. No servidor, na mesma requisição da página.
 */
export function AbaJaProgramadas({
  ativa,
  foco,
  aoFocar,
}: {
  ativa: boolean
  /** A rota (dia, caminhão, rota) que veio do link (ex.: logo depois de programar). */
  foco: { dia: string; caminhaoId: number; rota: number } | null
  aoFocar: (dia: string, caminhaoId: number, rota: number) => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  // SESSAO-30 (D-120): só o que falta entregar (o entregue mora no PCP).
  const entregues = false
  const [rascunhos, setRascunhos] = useState<Record<string, number[]>>({})
  const [trajeto, setTrajeto] = useState<Trajeto>('inteira')
  const [reprogramando, setReprogramando] = useState<PedidoProgramado | null>(null)
  // SESSAO-30 (D-115): a equipe da rota no dia (D-128) e o detalhe da entrega.
  const [equipeDe, setEquipeDe] = useState<{
    dia: string
    caminhaoId: number
    caminhaoNome: string
    rota: number
    variasRotas: boolean
  } | null>(null)
  const [detalheDe, setDetalheDe] = useState<PedidoProgramado | null>(null)
  // SESSAO-41 (D-196): a janela da parada avulsa (a rota e a chave do gesto)
  const [janelaParada, setJanelaParada] = useState<{ grupo: Grupo; chave: string } | null>(null)
  // SESSAO-41 (D-199): os filtros — a busca vai ao servidor parada há 300 ms, com 2+ letras
  const [busca, setBusca] = useState('')
  const [caminhaoFiltro, setCaminhaoFiltro] = useState(TODOS_CAMINHOES)
  const [diaFiltro, setDiaFiltro] = useState('')
  const buscaAplicada = filtroAplicavel(useDebouncedValue(busca, 300))
  const filtros = {
    busca: buscaAplicada,
    data: diaFiltro || null,
    caminhaoId: caminhaoFiltro === TODOS_CAMINHOES ? null : Number(caminhaoFiltro),
  }
  const filtrando = busca.trim() !== '' || caminhaoFiltro !== TODOS_CAMINHOES || diaFiltro !== ''
  function limparFiltros() {
    setBusca('')
    setCaminhaoFiltro(TODOS_CAMINHOES)
    setDiaFiltro('')
  }

  const consulta = useInfiniteQuery({
    queryKey: ['programadas', entregues, filtros],
    queryFn: ({ pageParam }) =>
      listarProgramadas({ entregues, limite: POR_PAGINA, deslocamento: pageParam, ...filtros }),
    initialPageParam: 0,
    // trocar o filtro mantém a lista de antes até a nova chegar (sem piscar)
    placeholderData: keepPreviousData,
    getNextPageParam: (ultima, todas) => {
      const carregadas = todas.reduce((s, p) => s + p.length, 0)
      const total = ultima[0]?.contagem_total ?? 0
      return carregadas < total ? carregadas : undefined
    },
    enabled: ativa,
  })
  // SESSAO-30 (Lei §4): programação/entrega mudou → AO VIVO, sem relógio (o histórico não muda).
  // SESSAO-41 (D-196): o banco avisa a mesma área em todo gesto das paradas avulsas.
  useAoVivo('rotas', [['programadas', false], ['paradas-avulsas']], ativa && !entregues)
  const { data: caminhoes = [] } = useQuery({
    queryKey: ['caminhoes', false],
    queryFn: () => listarCaminhoes(false),
    enabled: ativa,
  })

  const linhas = useMemo(() => consulta.data?.pages.flat() ?? [], [consulta.data])
  // SESSAO-41 (D-193): o ponto do endereço de entrega que ainda falta, aqui mesmo.
  useGeocodificarFaltantes(linhas, ['programadas'], ativa && !entregues)
  const total = consulta.data?.pages[0]?.[0]?.contagem_total ?? 0

  // Dia → caminhão → rota → paradas, na ordem que o banco devolve.
  const gruposDosPedidos = useMemo(() => {
    const porChave = new Map<string, Grupo>()
    const rotasPorCaminhao = new Map<string, Set<number>>()
    for (const p of linhas) {
      const rota = p.rota ?? 1
      const chave = chaveGrupo(p.programacao_data, p.caminhao_id, rota)
      const g = porChave.get(chave) ?? {
        chave,
        dia: p.programacao_data,
        caminhaoId: p.caminhao_id,
        rota,
        variasRotas: false,
        caminhaoNome: p.caminhao_nome ?? 'Caminhão',
        caminhaoPlaca: p.caminhao_placa,
        cor: corDoCaminhao(p.caminhao_id),
        pedidos: [],
        avulsas: [],
      }
      g.pedidos.push(p)
      porChave.set(chave, g)
      const doCaminhao = `${p.programacao_data}|${p.caminhao_id}`
      rotasPorCaminhao.set(doCaminhao, (rotasPorCaminhao.get(doCaminhao) ?? new Set()).add(rota))
    }
    return [...porChave.values()].map((g) => ({
      ...g,
      variasRotas: (rotasPorCaminhao.get(`${g.dia}|${g.caminhaoId}`)?.size ?? 1) > 1 || g.rota > 1,
    }))
  }, [linhas])

  // SESSAO-41 (D-196): as paradas avulsas dos dias que a página trouxe. ⚠️ DÍVIDA
  // da Lei de desempenho (§2 — uma requisição por tela): abrir a aba custa UMA
  // requisição a mais. A porta das programadas é uma tabela paginada por PEDIDO —
  // misturar as paradas nela mudaria a paginação e a contagem; esta leitura é
  // leve (só as vivas dos dias mostrados, até 62 dias) e só relê quando a
  // página cresce ("Ver mais") ou o banco avisa. A rota que só tem parada (os
  // pedidos já saíram) não aparece aqui — o entregador continua vendo.
  const diasCarregados = useMemo(
    () => [...new Set(linhas.map((p) => p.programacao_data))],
    [linhas],
  )
  const janela = useMemo(
    () => janelaDasParadas(diasCarregados, foco?.dia ?? null),
    [diasCarregados, foco?.dia],
  )
  const consultaParadas = useQuery({
    queryKey: ['paradas-avulsas', janela?.de ?? null, janela?.ate ?? null],
    queryFn: () => listarParadasAvulsas({ de: janela!.de, ate: janela!.ate }),
    enabled: ativa && !entregues && janela !== null,
  })
  const paradas = consultaParadas.data ?? SEM_PARADAS
  const grupos = useMemo(() => {
    if (paradas.length === 0) return gruposDosPedidos
    const porChave = new Map<string, ItemAvulsa[]>()
    for (const p of paradas) {
      const chave = chaveGrupo(p.data, p.caminhao_id, p.rota)
      porChave.set(chave, [...(porChave.get(chave) ?? []), itemDaParada(p)])
    }
    return gruposDosPedidos.map((g) => {
      const avulsas = porChave.get(g.chave)
      return avulsas ? { ...g, avulsas } : g
    })
  }, [gruposDosPedidos, paradas])

  const dias = useMemo(() => {
    const porDia = new Map<string, Grupo[]>()
    for (const g of grupos) porDia.set(g.dia, [...(porDia.get(g.dia) ?? []), g])
    return [...porDia.entries()]
  }, [grupos])

  // A rota escolhida: a do link, se está na lista (senão a 1ª rota do caminhão
  // do link); senão, a primeira.
  const escolhido =
    (foco &&
      (grupos.find((g) => g.chave === chaveGrupo(foco.dia, foco.caminhaoId, foco.rota)) ||
        grupos.find((g) => g.dia === foco.dia && g.caminhaoId === foco.caminhaoId))) ||
    grupos[0] ||
    null
  const rascunho = escolhido ? (rascunhos[escolhido.chave] ?? null) : null
  const ordenadas = useMemo(
    () => (escolhido ? ordemDaRota(itensDo(escolhido), { rascunho }) : []),
    [escolhido, rascunho],
  )
  const idsOrdenados = useMemo(() => idsDe(ordenadas), [ordenadas])
  const ordemGravada = useMemo(
    () => (escolhido ? idsDe(ordemDaRota(itensDo(escolhido))) : []),
    [escolhido],
  )
  const ordemDaSugestao = useMemo(
    () => (escolhido ? idsDe(ordemSugerida(itensDo(escolhido))) : []),
    [escolhido],
  )
  const ajustada = !mesmaOrdem(idsOrdenados, ordemDaSugestao)
  const temOrdemSalva = escolhido
    ? itensDo(escolhido).some((p) => typeof p.ordem === 'number')
    : false
  const pendenteSalvar = !entregues && !mesmaOrdem(idsOrdenados, ordemGravada)

  // A rota do escolhido (com espera — muda ao arrastar) e as dos outros caminhões do mesmo dia.
  // SESSAO-41 (D-196): a parada avulsa já marcada (feita / não feita) sai do caminho.
  const pontosRota = useMemo(() => pontosDaRota(ordenadas.filter(ativaNaRota)), [ordenadas])
  const estadoRota = useRotaPelasRuas(
    pontosRota.length - 2 > MAXIMO_PARADAS ? SEM_PONTOS : pontosRota,
  )
  const outros = useMemo(
    () =>
      escolhido ? grupos.filter((g) => g.dia === escolhido.dia && g.chave !== escolhido.chave) : [],
    [grupos, escolhido],
  )
  const pontosOutros = useMemo(() => outros.map(pontosDoGrupo), [outros])
  const estadosOutros = useRotasPelasRuas(pontosOutros)

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
    return pronta ? separarTrechos(linha, pontosRota) : [linha]
  }, [geometria, pronta, pontosRota])
  const trechos = useMemo(
    () => trechosDaRota(estadoRota, trechosEmLinhaReta(pontosRota)),
    [estadoRota, pontosRota],
  )

  const geometriasOutros = estadosOutros.map((e) =>
    e.estado === 'pronta' ? e.rota.geometria : null,
  )
  const chaveOutros = geometriasOutros.join('|')
  const rotasNoMapa: RotaNoMapa[] = useMemo(() => {
    if (!escolhido) return []
    const principal: RotaNoMapa = {
      id: escolhido.chave,
      cor: escolhido.cor,
      paradas: marcadoresDaRota(ordenadas),
      trechos: trechosNoMapa,
      recalculando: estadoRota.estado === 'calculando' && trechosNoMapa !== null,
    }
    const geos = chaveOutros.split('|')
    return [
      principal,
      ...outros.map((g, i) => ({
        id: g.chave,
        cor: g.cor,
        paradas: marcadoresDaRota(ordemDaRota(itensDo(g))),
        trechos: geos[i] ? [decodificarLinha(geos[i])] : null,
        esmaecida: true,
      })),
    ]
  }, [escolhido, ordenadas, trechosNoMapa, estadoRota.estado, outros, chaveOutros])

  const numerosNoMapa = useMemo(() => numerosNoMapaDaLista(ordenadas), [ordenadas])
  const pecas = somarPecas(ordenadas)
  const resumoTrajeto = resumoDoTrajeto(trajeto, trechos, numerosNoMapa)
  const resumoMapa = !escolhido
    ? null
    : resumoTrajeto !== null
      ? `${nomeDoGrupo(escolhido)} · ${resumoTrajeto}`
      : estadoRota.estado === 'pronta'
        ? `${nomeDoGrupo(escolhido)} · ${ordenadas.length} parada(s) · ${pecas} peças · ${formatarDistancia(estadoRota.rota.distancia_m / 1000)} · ${formatarDuracao(estadoRota.rota.duracao_s)}`
        : `${nomeDoGrupo(escolhido)} · ${ordenadas.length} parada(s) · ${pecas} peças`

  // SESSAO-41 (D-196): o Google Maps leva o que está para fazer (a parada já
  // marcada fica fora), com os números da lista.
  const paraOGoogle = useMemo(
    () =>
      ordenadas.flatMap((p, i) =>
        ativaNaRota(p) ? [{ lugar: paraNavegar(p), numero: i + 1 }] : [],
      ),
    [ordenadas],
  )
  const lugaresGoogle = useMemo(() => paraOGoogle.map((x) => x.lugar), [paraOGoogle])
  const posicoesGoogle = useMemo(() => paraOGoogle.map((x) => x.numero), [paraOGoogle])

  // ---- gestos ------------------------------------------------------------
  // SESSAO-41 (D-196): + as paradas avulsas e as entregas do dia (o entregador).
  const invalidar = () =>
    Promise.all(
      CHAVES_PARADA_AVULSA.map((queryKey) => clienteQuery.invalidateQueries({ queryKey })),
    )

  const focar = useCallback(
    (g: Grupo) => {
      setTrajeto('inteira')
      aoFocar(g.dia, g.caminhaoId, g.rota)
    },
    [aoFocar],
  )
  const reordenar = useCallback(
    (novos: number[]) => {
      if (!escolhido) return
      setRascunhos((atual) => ({ ...atual, [escolhido.chave]: novos }))
    },
    [escolhido],
  )
  function voltarSugestao() {
    if (!escolhido) return
    setRascunhos((atual) => {
      const novo = { ...atual }
      // Com ordem salva, a sugestão vira rascunho e "Salvar ordem" grava a volta
      // ao automático; sem ordem salva, basta largar o ajuste.
      if (temOrdemSalva) novo[escolhido.chave] = ordemDaSugestao
      else delete novo[escolhido.chave]
      return novo
    })
  }

  const salvarOrdem = useMutation({
    mutationFn: async (v: { grupo: Grupo; cardIds: number[]; itens: ItemDaOrdem[] | null }) => {
      if (!v.itens) {
        await ordenarRota({
          data: v.grupo.dia,
          caminhaoId: v.grupo.caminhaoId,
          rota: v.grupo.rota,
          cardIds: v.cardIds,
        })
        return
      }
      // SESSAO-41 (D-196): com parada avulsa, a ordem vai INTEIRA (pedidos +
      // paradas). O que a página não trouxe da rota vai no fim, na ordem dele.
      const banco = await ordemDaRotaNoBanco(v.grupo.dia, v.grupo.caminhaoId, v.grupo.rota)
      const completa = completarOrdem(v.itens, banco)
      if (!completa)
        throw new Error(
          'A rota mudou noutra tela — a lista foi atualizada; arrume a ordem de novo.',
        )
      await ordenarRotaComParadas({
        data: v.grupo.dia,
        caminhaoId: v.grupo.caminhaoId,
        rota: v.grupo.rota,
        itens: completa,
      })
    },
    onSuccess: async (_d, v) => {
      notificar({
        titulo:
          !v.itens && v.cardIds.length === 0
            ? 'A rota voltou à ordem sugerida'
            : 'Ordem das paradas salva',
        tom: 'perfeito',
      })
      // Larga o rascunho só depois de a lista voltar com a ordem nova — a tela não pisca.
      await invalidar()
      setRascunhos((atual) => {
        const novo = { ...atual }
        delete novo[v.grupo.chave]
        return novo
      })
    },
    onError: async (excecao) => {
      notificar({
        titulo: 'Não deu para salvar a ordem',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      })
      await invalidar()
    },
  })

  const reprogramar = useMutation({
    mutationFn: (v: { cardId: number; data: string; caminhaoId: number; rota: number }) =>
      programarEntrega(v),
    onSuccess: async () => {
      notificar({ titulo: 'Entrega reprogramada', tom: 'perfeito' })
      setReprogramando(null)
      await invalidar()
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para reprogramar',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })
  const tirar = useMutation({
    mutationFn: (p: PedidoProgramado) => desprogramarEntrega(p.card_id),
    onSuccess: async (_d, p) => {
      notificar({ titulo: `Pedido ${p.numero} voltou para "sem programação"`, tom: 'perfeito' })
      await invalidar()
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para tirar da programação',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  // SESSAO-41 (D-196): pôr a parada avulsa na rota escolhida — no FIM da rota
  // como está no banco agora (arraste e salve para outro lugar).
  const porParada = useMutation({
    mutationFn: async (v: { grupo: Grupo; dados: DadosParadaAvulsa; chave: string }) => {
      const base = {
        ...v.dados,
        data: v.grupo.dia,
        caminhaoId: v.grupo.caminhaoId,
        rota: v.grupo.rota,
        chave: v.chave,
      }
      const banco = await ordemDaRotaNoBanco(v.grupo.dia, v.grupo.caminhaoId, v.grupo.rota)
      try {
        return await salvarParadaAvulsa({ ...base, ordem: [...banco, { t: 'nova' }] })
      } catch (erro) {
        // a rota mudou entre a leitura e o toque: sem a ordem, o banco põe no fim do que está salvo
        if (erro instanceof Error && /rota mudou/i.test(erro.message))
          return salvarParadaAvulsa(base)
        throw erro
      }
    },
    onSuccess: async (r) => {
      notificar({
        titulo: r.repetido ? 'A parada já estava na rota' : 'Parada avulsa na rota',
        descricao: 'Ela entrou no fim — arraste para o lugar certo e salve a ordem.',
        tom: 'perfeito',
      })
      setJanelaParada(null)
      await invalidar()
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para pôr a parada',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })
  const tirarParada = useMutation({
    mutationFn: (p: ParadaAvulsa) => removerParadaAvulsa(p.id),
    onSuccess: async (_d, p) => {
      notificar({ titulo: `A parada "${p.titulo}" saiu da rota`, tom: 'perfeito' })
      await invalidar()
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para tirar a parada',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  const opcoesCaminhao = caminhoes.map((c) => ({
    valor: String(c.id),
    rotulo: c.placa ? `${c.nome} · ${c.placa}` : c.nome,
  }))
  const salvar =
    escolhido && !entregues
      ? {
          pendente: pendenteSalvar,
          carregando: salvarOrdem.isPending,
          aoSalvar: () =>
            escolhido.avulsas.length > 0
              ? // SESSAO-41 (D-196): com parada, a ordem da tela vai inteira (não há "automático")
                salvarOrdem.mutate({
                  grupo: escolhido,
                  cardIds: [],
                  itens: ordenadas.map(refDoItem),
                })
              : // igual à sugestão = volta ao automático (nada fica preso)
                salvarOrdem.mutate({
                  grupo: escolhido,
                  cardIds: ajustada ? idsOrdenados : [],
                  itens: null,
                }),
        }
      : undefined

  function linhaAvulsa(item: ItemAvulsa, numero: number, cor: string) {
    const p = item.avulsa
    if (!paradaSalva(p)) return null
    const concluida = p.situacao !== 'pendente'
    return (
      <div
        className={cn(
          'flex flex-wrap items-start gap-3 rounded-dm-lg border border-dashed bg-superficie p-3',
          concluida ? 'border-borda opacity-80' : 'border-borda-forte',
        )}
      >
        <NumeroParadaAvulsa numero={numero} cor={cor} apagado={concluida} />
        <CartaoParadaAvulsa parada={p} />
        <Botao
          variante="fantasma"
          icone={<X />}
          onClick={() => tirarParada.mutate(p)}
          carregando={tirarParada.isPending && tirarParada.variables?.id === p.id}
        >
          Tirar da rota
        </Botao>
      </div>
    )
  }

  function linhaParada(item: ItemRota, numero: number, cor: string) {
    if (ehAvulsa(item)) return linhaAvulsa(item, numero, cor)
    const p = item
    return (
      <div className="flex flex-wrap items-start gap-3 rounded-dm-lg border border-borda bg-superficie p-3">
        <span
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2 bg-acao text-xs font-bold text-acao-texto tabular-nums"
          style={{ borderColor: cor }}
          aria-label={`${numero}ª parada`}
        >
          {numero}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <CartaoPedido pedido={p} />
          {p.detalhe && (
            <span className="rounded-dm border border-atencao-borda bg-atencao-fundo px-2 py-1 text-sm text-atencao-texto">
              {p.detalhe}
            </span>
          )}
        </span>
        {entregues ? (
          <span className="text-xs text-texto-suave tabular-nums">
            entregue em {p.entregue_em ? new Date(p.entregue_em).toLocaleDateString('pt-BR') : '—'}
          </span>
        ) : (
          <span className="flex flex-wrap gap-2">
            <Botao variante="secundaria" icone={<NotebookPen />} onClick={() => setDetalheDe(p)}>
              Detalhe
            </Botao>
            <Botao variante="secundaria" onClick={() => setReprogramando(p)}>
              Reprogramar
            </Botao>
            <Botao
              variante="fantasma"
              icone={<X />}
              onClick={() => tirar.mutate(p)}
              carregando={tirar.isPending && tirar.variables?.card_id === p.card_id}
            >
              Tirar
            </Botao>
          </span>
        )}
      </div>
    )
  }

  return (
    // duas colunas só quando a ÁREA da tela tem espaço (container, não janela — E-30):
    // com os dois menus abertos numa tela de 1024, a lista ficava com 221 px
    <div className="@container">
      <div className="grid grid-cols-1 gap-5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Numa coluna só, o mapa vem primeiro (o caminhão escolhido à vista); em duas, à direita. */}
        <section className="flex min-w-0 flex-col gap-3 @3xl:sticky @3xl:top-4 @3xl:col-start-2 @3xl:row-start-1 @3xl:self-start">
          <h2 className="text-lg">
            Mapa{' '}
            <span className="text-sm font-normal text-texto-suave">
              a rota escolhida acesa, na cor do caminhão · as outras do mesmo dia transparentes ·
              quadrado "A" = parada avulsa
            </span>
          </h2>
          <MapaProgramacao
            rotas={rotasNoMapa}
            trajeto={trajeto}
            aoMudarTrajeto={setTrajeto}
            resumo={resumoMapa}
          />
          {escolhido && (
            <PainelRota
              titulo={`Rota do ${nomeDoGrupo(escolhido)} · ${dataLegivel(escolhido.dia)}`}
              cor={escolhido.cor}
              paradas={ordenadas}
              estado={estadoRota}
              trechos={trechos}
              trajeto={trajeto}
              ajustada={!entregues && ajustada}
              aoVoltarSugestao={voltarSugestao}
              salvar={salvar}
            />
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-4 @3xl:col-start-1 @3xl:row-start-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-texto-suave">
              A entregar — o entregue sai daqui e fica no PCP → Todos os pedidos.
            </p>
            {total > 0 && (
              <span className="text-sm text-texto-suave tabular-nums">
                {linhas.length} de {total} {total === 1 ? 'entrega' : 'entregas'}
              </span>
            )}
          </div>

          {/* SESSAO-41 (D-199): os filtros — a busca traz a rota inteira que tem o que bate */}
          <div className="@container/filtros flex flex-col gap-3">
            <FiltroDoQuadro
              texto={busca}
              aoMudar={setBusca}
              rotulo="Buscar rota"
              placeholder="Buscar: cliente, nº do pedido, bairro, móvel ou parada"
              className="sm:w-full"
            />
            <div className="grid grid-cols-2 gap-3">
              <Selecao
                rotulo="Caminhão"
                opcoes={[{ valor: TODOS_CAMINHOES, rotulo: 'Todos' }, ...opcoesCaminhao]}
                valor={caminhaoFiltro}
                aoMudar={setCaminhaoFiltro}
              />
              <Campo
                rotulo="Dia"
                type="date"
                value={diaFiltro}
                onChange={(e) => setDiaFiltro(e.target.value)}
              />
            </div>
            {filtrando && (
              <Botao
                variante="fantasma"
                tamanho="sm"
                icone={<X />}
                className="self-start"
                onClick={limparFiltros}
              >
                Limpar filtros
              </Botao>
            )}
          </div>

          {consulta.isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
          {consultaParadas.isError && (
            <p className="rounded-dm border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto">
              Não deu para carregar as paradas avulsas agora — as rotas aparecem sem elas.
            </p>
          )}
          {!consulta.isPending && grupos.length === 0 && (
            <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
              {filtrando
                ? 'Nenhuma rota bate com os filtros. Limpe os filtros para ver todas.'
                : entregues
                  ? 'Nenhuma entrega programada foi entregue ainda.'
                  : 'Nada programado ainda — monte a rota na aba "Programar".'}
            </p>
          )}

          {dias.map(([dia, gruposDoDia]) => (
            <div key={dia} className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 border-b border-borda pb-1 text-lg">
                <CalendarDays aria-hidden className="size-5 text-texto-suave" />
                {diaPorExtenso(dia)}
              </h2>
              {gruposDoDia.map((g) => {
                const ativo = escolhido?.chave === g.chave
                const caminhao = caminhoes.find((c) => c.id === g.caminhaoId)
                const foto = urlFotoCaminhao(caminhao?.foto_caminho ?? null)
                const lista = ativo ? ordenadas : ordemDaRota(itensDo(g))
                const pecasDoGrupo = somarPecas(g.pedidos)
                const nItens = g.pedidos.length + g.avulsas.length
                // SESSAO-37 (pedido do dono, 19/10): a equipe da rota no card.
                const equipeDoGrupo = g.pedidos[0]?.equipe ?? []
                return (
                  <section
                    key={g.chave}
                    className={cn(
                      'flex flex-col gap-3 rounded-dm-lg border bg-superficie-sutil p-3',
                      ativo ? 'border-acao-ativa ring-1 ring-acao-ativa' : 'border-borda',
                    )}
                    style={{ borderLeft: `8px solid ${g.cor}` }}
                    aria-label={`${nomeDoGrupo(g)} em ${dataLegivel(g.dia)}`}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      {foto ? (
                        <img
                          src={foto}
                          alt=""
                          className="size-11 shrink-0 rounded-dm object-cover"
                        />
                      ) : (
                        <span
                          className="inline-flex size-11 shrink-0 items-center justify-center rounded-dm text-white"
                          style={{ backgroundColor: g.cor }}
                        >
                          <Truck aria-hidden className="size-6" />
                        </span>
                      )}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-2 font-semibold text-texto">
                          <span
                            aria-hidden
                            className="inline-block size-3 shrink-0 rounded-full"
                            style={{ backgroundColor: g.cor }}
                          />
                          {g.caminhaoNome}
                          {g.caminhaoPlaca && (
                            <span className="text-sm font-normal text-texto-suave">
                              · {g.caminhaoPlaca}
                            </span>
                          )}
                          {g.variasRotas && (
                            <span className="rounded-full bg-superficie px-2 py-0.5 text-xs font-semibold text-texto ring-1 ring-borda">
                              {nomeDaRota(g.rota)}
                            </span>
                          )}
                        </span>
                        <span className="text-sm text-texto-suave tabular-nums">
                          {nItens} {nItens === 1 ? 'parada' : 'paradas'}
                          {g.avulsas.length > 0 &&
                            ` (${g.avulsas.length} ${g.avulsas.length === 1 ? 'avulsa' : 'avulsas'})`}{' '}
                          · {pecasDoGrupo} {pecasDoGrupo === 1 ? 'peça' : 'peças'}
                          {ativo && estadoRota.estado === 'pronta' && (
                            <>
                              {' '}
                              · {formatarDistancia(estadoRota.rota.distancia_m / 1000)} ·{' '}
                              {formatarDuracao(estadoRota.rota.duracao_s)} dirigindo
                            </>
                          )}
                        </span>
                        <span
                          className={cn(
                            'flex items-center gap-1 text-sm',
                            equipeDoGrupo.length > 0 ? 'text-texto' : 'text-texto-fraco',
                          )}
                        >
                          <Users aria-hidden className="size-3.5 shrink-0" />
                          {equipeDoGrupo.length > 0
                            ? `Equipe: ${equipeDoGrupo.join(', ')}`
                            : 'Sem equipe definida'}
                        </span>
                      </span>
                      {ativo ? (
                        <span className="flex flex-wrap gap-2">
                          {!entregues && ajustada && (
                            <Botao
                              variante="fantasma"
                              icone={<RotateCcw />}
                              onClick={voltarSugestao}
                            >
                              Voltar à sugestão
                            </Botao>
                          )}
                          {salvar?.pendente && (
                            <Botao
                              icone={<Save />}
                              carregando={salvar.carregando}
                              onClick={salvar.aoSalvar}
                            >
                              Salvar ordem
                            </Botao>
                          )}
                          {!salvar?.pendente && (
                            <span className="text-xs font-medium text-texto-suave">no mapa</span>
                          )}
                        </span>
                      ) : (
                        <Botao variante="secundaria" icone={<MapPin />} onClick={() => focar(g)}>
                          Ver no mapa
                        </Botao>
                      )}
                      {!entregues && (
                        <Botao
                          variante="secundaria"
                          icone={<Users />}
                          onClick={() =>
                            setEquipeDe({
                              dia: g.dia,
                              caminhaoId: g.caminhaoId,
                              caminhaoNome: g.caminhaoNome,
                              rota: g.rota,
                              variasRotas: g.variasRotas,
                            })
                          }
                        >
                          Equipe
                        </Botao>
                      )}
                    </div>
                    {/* SESSAO-39 (D-174): a rota como está na tela (com o rascunho), no
                        Google Maps — numa linha própria, para o cabeçalho não espremer.
                        SESSAO-41 (D-196): + pôr parada avulsa nesta rota. */}
                    {ativo && (
                      <div className="flex flex-wrap gap-2">
                        <BotaoRotaGoogleMaps
                          paradas={lugaresGoogle}
                          posicoes={posicoesGoogle}
                          tamanho="sm"
                        />
                        {!entregues && (
                          <Botao
                            variante="secundaria"
                            tamanho="sm"
                            icone={<MapPinPlus />}
                            onClick={() => setJanelaParada({ grupo: g, chave: chaveDoGesto() })}
                          >
                            Adicionar parada avulsa
                          </Botao>
                        )}
                      </div>
                    )}
                    {ativo && !entregues ? (
                      <ListaArrastavel
                        ids={idsOrdenados}
                        rotulo={`Paradas do ${nomeDoGrupo(g)}, na ordem`}
                        aoReordenar={reordenar}
                      >
                        {(id, indice) => {
                          const p = lista.find((x) => x.card_id === id)
                          return p ? linhaParada(p, indice + 1, g.cor) : null
                        }}
                      </ListaArrastavel>
                    ) : (
                      <ol className="flex flex-col gap-2">
                        {lista.map((p, i) => (
                          <li key={p.card_id}>{linhaParada(p, i + 1, g.cor)}</li>
                        ))}
                      </ol>
                    )}
                  </section>
                )
              })}
            </div>
          ))}

          {consulta.hasNextPage && (
            <Botao
              variante="secundaria"
              onClick={() => consulta.fetchNextPage()}
              carregando={consulta.isFetchingNextPage}
              className="self-center"
            >
              Ver mais
            </Botao>
          )}
        </section>

        <ModalEquipe
          key={
            equipeDe ? `${equipeDe.dia}-${equipeDe.caminhaoId}-${equipeDe.rota}` : 'equipe-fechada'
          }
          alvo={equipeDe}
          aoFechar={() => setEquipeDe(null)}
        />
        <ModalDetalheEntrega
          key={detalheDe ? `detalhe-${detalheDe.card_id}` : 'detalhe-fechado'}
          pedido={detalheDe}
          aoFechar={() => setDetalheDe(null)}
        />
        <ModalParadaAvulsa
          key={janelaParada ? `parada-${janelaParada.chave}` : 'parada-fechada'}
          aberto={janelaParada !== null}
          titulo={
            janelaParada
              ? `Parada avulsa — ${nomeDoGrupo(janelaParada.grupo)} · ${dataLegivel(janelaParada.grupo.dia)}`
              : undefined
          }
          descricao="Ela entra no fim desta rota — depois, arraste para o lugar certo e salve a ordem."
          carregando={porParada.isPending}
          aoFechar={() => setJanelaParada(null)}
          aoSalvar={(dados) => {
            if (janelaParada)
              porParada.mutate({ grupo: janelaParada.grupo, dados, chave: janelaParada.chave })
          }}
        />

        {reprogramando && (
          <ModalProgramar
            key={reprogramando.card_id}
            titulo={`Reprogramar o pedido ${reprogramando.numero}`}
            diaInicial={reprogramando.programacao_data}
            caminhaoInicial={String(reprogramando.caminhao_id)}
            opcoesCaminhao={opcoesCaminhao}
            padraoRota="ultima"
            rotaAtual={{
              dia: reprogramando.programacao_data,
              caminhaoId: reprogramando.caminhao_id,
              rota: reprogramando.rota ?? 1,
            }}
            carregando={reprogramar.isPending}
            aoFechar={() => setReprogramando(null)}
            aoConfirmar={(data, caminhaoId, rota) =>
              reprogramar.mutate({ cardId: reprogramando.card_id, data, caminhaoId, rota })
            }
          />
        )}
      </div>
    </div>
  )
}
