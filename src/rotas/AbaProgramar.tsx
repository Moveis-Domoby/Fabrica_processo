import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Route, Truck } from 'lucide-react'
import { Botao, Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { listarCaminhoes } from '@/admin/caminhoes'
import {
  GEOCODIFICAR_POR_CHAMADA,
  geocodificar,
  listarProgramacao,
  listarProgramadas,
  precisaGeocodificar,
  programarRota,
} from './api'
import type { PedidoProgramacao } from './api'
import { CartaoPedido } from './CartaoPedido'
import { ListaArrastavel } from './ListaArrastavel'
import { MapaProgramacao } from './MapaProgramacao'
import type { ParadaNoMapa, RotaNoMapa } from './MapaProgramacao'
import { ModalProgramar } from './ModalProgramar'
import { PainelRota } from './PainelRota'
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
import type { CriterioOrdem } from './rotaRuas'
import { resumoDoTrajeto, trechosDaRota } from './trechos'
import type { Trajeto } from './trechos'
import { useRotaPelasRuas } from './useRotaPelasRuas'
import { useAoVivo } from '@/lib/aoVivo'

const RAIO_SUGESTAO_KM = 5
const SEM_PONTOS: Ponto[] = []

const idsDe = (lista: { card_id: number }[]) => lista.map((p) => p.card_id)
const mesmaOrdem = (a: number[], b: number[]) =>
  a.length === b.length && a.every((id, i) => id === b[i])

function hojeIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const OPCOES_ORDEM: { valor: CriterioOrdem; rotulo: string }[] = [
  { valor: 'entrega', rotulo: 'Dia de entrega mais perto' },
  { valor: 'perto', rotulo: 'Mais perto (da rota ou da fábrica)' },
  { valor: 'numero', rotulo: 'Número do pedido' },
]

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

  const [selecionados, setSelecionados] = useState<Set<number>>(() => new Set())
  // A ordem que a pessoa arrastou (D-111); null = a sugestão do mais perto.
  const [rascunho, setRascunho] = useState<number[] | null>(null)
  const [criterio, setCriterio] = useState<CriterioOrdem>('entrega')
  const [confirmando, setConfirmando] = useState(false)
  const [caminhaoId, setCaminhaoId] = useState('')
  const [trajeto, setTrajeto] = useState<Trajeto>('inteira')

  const { data: pedidos = [], isPending } = useQuery({
    queryKey: ['programacao', 'sem-programacao'],
    queryFn: () => listarProgramacao({ soSemProgramacao: true, limite: 200 }),
    enabled: ativa,
  })
  const totalCandidatos = Number(pedidos[0]?.contagem_total ?? 0)
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
  const listaSelecionados = useMemo(
    () => pedidos.filter((p) => selecionados.has(p.card_id)),
    [pedidos, selecionados],
  )
  const ordemMontando = useMemo(
    () => ordemDaRota(listaSelecionados, { rascunho }),
    [listaSelecionados, rascunho],
  )
  const idsMontando = useMemo(() => idsDe(ordemMontando), [ordemMontando])
  const ordemDaSugestao = useMemo(
    () => idsDe(ordemSugerida(listaSelecionados)),
    [listaSelecionados],
  )
  const ajustada = !mesmaOrdem(idsMontando, ordemDaSugestao)
  const porId = useMemo(() => new Map(pedidos.map((p) => [p.card_id, p])), [pedidos])

  const naoSelecionados = useMemo(
    () => pedidos.filter((p) => !selecionados.has(p.card_id)),
    [pedidos, selecionados],
  )
  const referencia = useMemo(() => ordemMontando.filter(temPonto) as Ponto[], [ordemMontando])
  const listaOrdenada = useMemo(
    () => ordenarCandidatos(naoSelecionados, criterio, referencia),
    [naoSelecionados, criterio, referencia],
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

  const paradasNoMapa: ParadaNoMapa[] = useMemo(
    () => ordemMontando.flatMap((p, i) => (temPonto(p) ? [{ parada: p, numero: i + 1 }] : [])),
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
  const alternar = useCallback((cardId: number) => {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(cardId)) novo.delete(cardId)
      else novo.add(cardId)
      return novo
    })
  }, [])
  const escolherSugestao = useCallback((p: PedidoProgramacao) => alternar(p.card_id), [alternar])
  const reordenar = useCallback((novos: number[]) => setRascunho(novos), [])
  const voltarSugestao = useCallback(() => setRascunho(null), [])
  function limpar() {
    setSelecionados(new Set())
    setRascunho(null)
    setTrajeto('inteira')
  }

  const programarMutacao = useMutation({
    mutationFn: async (v: {
      data: string
      caminhaoId: number
      rota: number
      cardIds: number[]
      ajustada: boolean
    }) => {
      // D-109: a rota escolhida do caminhão naquele dia (D-128) — quem já está
      // nela fica na ordem dela e os novos entram no FIM; se nada estava salvo
      // e a montagem não foi mexida, o banco fica com a sugestão de tudo.
      const existentes = (
        await listarProgramadas({ data: v.data, caminhaoId: v.caminhaoId, limite: 200 })
      ).filter((p) => p.rota === v.rota)
      const temSalva = existentes.some((p) => typeof p.ordem === 'number')
      const ordem =
        temSalva || v.ajustada ? [...idsDe(ordemDaRota(existentes)), ...v.cardIds] : null
      await programarRota({
        data: v.data,
        caminhaoId: v.caminhaoId,
        rota: v.rota,
        cardIds: v.cardIds,
        ordem,
      })
    },
    onSuccess: async (_d, v) => {
      notificar({
        titulo:
          v.cardIds.length === 1
            ? 'Entrega programada'
            : `${v.cardIds.length} entregas programadas`,
        tom: 'perfeito',
      })
      limpar()
      setConfirmando(false)
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['programacao'] }),
        clienteQuery.invalidateQueries({ queryKey: ['programadas'] }),
        clienteQuery.invalidateQueries({ queryKey: ['rotas'] }),
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
  const semPonto = listaSelecionados.filter((p) => !temPonto(p)).length

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
          {/* Na rota: os marcados sobem, numerados, e se arrastam (D-111). */}
          {ordemMontando.length > 0 && (
            <section className="order-1 flex min-w-0 flex-col gap-2 rounded-dm-lg border border-acao-ativa bg-superficie-sutil p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg">
                  <Route aria-hidden className="size-5 text-texto-suave" />
                  Na rota{' '}
                  <span className="text-sm font-normal text-texto-suave tabular-nums">
                    ({ordemMontando.length} · {pecas} {pecas === 1 ? 'peça' : 'peças'})
                  </span>
                </h2>
                <span className="text-xs text-texto-suave">
                  {ajustada
                    ? 'Ordem ajustada à mão'
                    : 'Ordem sugerida: o mais perto, a partir da fábrica'}{' '}
                  · arraste para mudar
                </span>
              </div>
              <ListaArrastavel
                ids={idsMontando}
                rotulo="Pedidos na rota, na ordem das paradas"
                aoReordenar={reordenar}
              >
                {(id, indice) => {
                  const p = porId.get(id)
                  if (!p) return null
                  return (
                    // div, não label: tocar no cartão não tira o pedido da rota (só a caixinha)
                    <div className="flex min-h-toque-lg items-start gap-3 rounded-dm-lg border border-acao-ativa bg-superficie p-3">
                      <input
                        type="checkbox"
                        className="mt-1 size-5 shrink-0 accent-marca-500"
                        checked
                        onChange={() => alternar(id)}
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
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg">
                Sem programação{' '}
                <span className="text-sm font-normal text-texto-suave tabular-nums">
                  ({naoSelecionados.length})
                </span>
              </h2>
              <div className="w-full max-w-xs sm:w-auto sm:min-w-64">
                <Selecao
                  rotulo="Ordenar por"
                  opcoes={OPCOES_ORDEM}
                  valor={criterio}
                  aoMudar={(v) => setCriterio(v as CriterioOrdem)}
                />
              </div>
            </div>
            <p className="text-xs text-texto-suave">
              Todos os pedidos em andamento ainda sem rota — prontos, em produção ou ainda no PCP.
              Programado, o pedido passa para "Já programadas".
            </p>
            {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
            {!isPending && pedidos.length === 0 && (
              <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
                Nenhum pedido em andamento sem programação.
              </p>
            )}
            {totalCandidatos > pedidos.length && (
              <p className="text-xs text-atencao-texto tabular-nums">
                Mostrando os {pedidos.length} de previsão mais próxima, de {totalCandidatos}.
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
                        onChange={() => alternar(p.card_id)}
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
              F = fábrica (saída e volta) · amarelo numerado = ordem das paradas · âmbar = pedidos
              próximos (até {RAIO_SUGESTAO_KM} km)
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
            <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
              Marque pedidos na lista para montar a rota — ela sai da fábrica, passa pelas entregas
              e volta.
            </p>
          )}
          {paradasNoMapa.length > MAXIMO_PARADAS && (
            <p className="text-xs text-atencao-texto">
              Mais de {MAXIMO_PARADAS} paradas no mapa: a rota pelas ruas não é calculada —
              mostrando em linha reta.
            </p>
          )}
        </section>
      </div>

      {listaSelecionados.length > 0 && (
        <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-3 rounded-dm-lg border border-acao-ativa bg-superficie p-3 shadow-lg">
          <span className="text-sm text-texto tabular-nums">
            {listaSelecionados.length} pedido(s) · {pecas} {pecas === 1 ? 'peça' : 'peças'}
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
          </span>
          <span className="ml-auto flex gap-2">
            <Botao variante="fantasma" onClick={limpar}>
              Limpar
            </Botao>
            <Botao icone={<Truck />} onClick={() => setConfirmando(true)}>
              Programar
            </Botao>
          </span>
        </div>
      )}

      {confirmando && (
        <ModalProgramar
          titulo={`Programar ${listaSelecionados.length} pedido(s)`}
          resumo={`${listaSelecionados.length} pedido(s) · ${pecas} ${pecas === 1 ? 'peça' : 'peças'} — numa rota nova do caminhão, ou no fim de uma rota que ele já tem no dia.`}
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
              cardIds: idsMontando,
              ajustada,
            })
          }}
        />
      )}
    </div>
  )
}
