import { useCallback, useMemo, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, MapPin, RotateCcw, Save, Truck, X } from 'lucide-react'
import { Botao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { listarCaminhoes, urlFotoCaminhao } from '@/admin/caminhoes'
import {
  dataLegivel,
  desprogramarEntrega,
  listarProgramadas,
  ordenarRota,
  programarEntrega,
} from './api'
import type { PedidoProgramado } from './api'
import { CartaoPedido } from './CartaoPedido'
import { ListaArrastavel } from './ListaArrastavel'
import { MapaProgramacao } from './MapaProgramacao'
import type { ParadaNoMapa, RotaNoMapa } from './MapaProgramacao'
import { ModalProgramar } from './ModalProgramar'
import { PainelRota } from './PainelRota'
import { formatarDistancia, temPonto } from './proximidade'
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
import { nomeDoTrecho, textoTrecho, trechosDaRota } from './trechos'
import { useRotaPelasRuas, useRotasPelasRuas } from './useRotaPelasRuas'

const POR_PAGINA = 50
const ATUALIZA_A_CADA = 30_000
const SEM_PONTOS: Ponto[] = []

const idsDe = (lista: { card_id: number }[]) => lista.map((p) => p.card_id)
const mesmaOrdem = (a: number[], b: number[]) =>
  a.length === b.length && a.every((id, i) => id === b[i])
const chaveGrupo = (dia: string, caminhaoId: number) => `${dia}|${caminhaoId}`

function diaPorExtenso(iso: string): string {
  const texto = new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

interface Grupo {
  chave: string
  dia: string
  caminhaoId: number
  caminhaoNome: string
  caminhaoPlaca: string | null
  cor: string
  paradas: PedidoProgramado[]
}

/** Os pontos da rota de um grupo, na ordem salva (ou sugerida). */
function pontosDoGrupo(g: Grupo): Ponto[] {
  return pontosDaRota(ordemDaRota(g.paradas))
}

/**
 * A aba "Já programadas" (ajustes da SESSAO-28, 03/10 — D-111): TODAS as
 * programações ainda não entregues, separadas por dia e por caminhão — cada
 * caminhão com a sua COR (faixa, linha no mapa, contorno das paradas) e as
 * entregas dele juntas, na ordem da rota. Escolher um caminhão acende a rota
 * dele no mapa; os outros caminhões do mesmo dia ficam transparentes. No
 * caminhão escolhido a ordem se ARRASTA e se salva. "Entregues" mostra o
 * histórico (só quando se pede). Paginada no servidor — "Ver mais" busca a
 * próxima página.
 */
export function AbaJaProgramadas({
  ativa,
  foco,
  aoFocar,
}: {
  ativa: boolean
  /** O caminhão/dia que veio do link (ex.: logo depois de programar). */
  foco: { dia: string; caminhaoId: number } | null
  aoFocar: (dia: string, caminhaoId: number) => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [entregues, setEntregues] = useState(false)
  const [rascunhos, setRascunhos] = useState<Record<string, number[]>>({})
  const [trecho, setTrecho] = useState<number | null>(null)
  const [reprogramando, setReprogramando] = useState<PedidoProgramado | null>(null)

  const consulta = useInfiniteQuery({
    queryKey: ['programadas', entregues],
    queryFn: ({ pageParam }) =>
      listarProgramadas({ entregues, limite: POR_PAGINA, deslocamento: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (ultima, todas) => {
      const carregadas = todas.reduce((s, p) => s + p.length, 0)
      const total = ultima[0]?.contagem_total ?? 0
      return carregadas < total ? carregadas : undefined
    },
    enabled: ativa,
    refetchInterval: entregues ? false : ATUALIZA_A_CADA,
  })
  const { data: caminhoes = [] } = useQuery({
    queryKey: ['caminhoes', false],
    queryFn: () => listarCaminhoes(false),
    enabled: ativa,
  })

  const linhas = useMemo(() => consulta.data?.pages.flat() ?? [], [consulta.data])
  const total = consulta.data?.pages[0]?.[0]?.contagem_total ?? 0

  // Dia → caminhão → paradas, na ordem que o banco devolve.
  const grupos = useMemo(() => {
    const porChave = new Map<string, Grupo>()
    for (const p of linhas) {
      const chave = chaveGrupo(p.programacao_data, p.caminhao_id)
      const g = porChave.get(chave) ?? {
        chave,
        dia: p.programacao_data,
        caminhaoId: p.caminhao_id,
        caminhaoNome: p.caminhao_nome ?? 'Caminhão',
        caminhaoPlaca: p.caminhao_placa,
        cor: corDoCaminhao(p.caminhao_id),
        paradas: [],
      }
      g.paradas.push(p)
      porChave.set(chave, g)
    }
    return [...porChave.values()]
  }, [linhas])
  const dias = useMemo(() => {
    const porDia = new Map<string, Grupo[]>()
    for (const g of grupos) porDia.set(g.dia, [...(porDia.get(g.dia) ?? []), g])
    return [...porDia.entries()]
  }, [grupos])

  // O caminhão escolhido: o do link, se está na lista; senão, o primeiro.
  const escolhido =
    (foco && grupos.find((g) => g.chave === chaveGrupo(foco.dia, foco.caminhaoId))) ||
    grupos[0] ||
    null
  const rascunho = escolhido ? (rascunhos[escolhido.chave] ?? null) : null
  const ordenadas = useMemo(
    () => (escolhido ? ordemDaRota(escolhido.paradas, { rascunho }) : []),
    [escolhido, rascunho],
  )
  const idsOrdenados = useMemo(() => idsDe(ordenadas), [ordenadas])
  const ordemGravada = useMemo(
    () => (escolhido ? idsDe(ordemDaRota(escolhido.paradas)) : []),
    [escolhido],
  )
  const ordemDaSugestao = useMemo(
    () => (escolhido ? idsDe(ordemSugerida(escolhido.paradas)) : []),
    [escolhido],
  )
  const ajustada = !mesmaOrdem(idsOrdenados, ordemDaSugestao)
  const temOrdemSalva = escolhido?.paradas.some((p) => typeof p.ordem === 'number') ?? false
  const pendenteSalvar = !entregues && !mesmaOrdem(idsOrdenados, ordemGravada)

  // A rota do escolhido (com espera — muda ao arrastar) e as dos outros caminhões do mesmo dia.
  const pontosRota = useMemo(() => pontosDaRota(ordenadas), [ordenadas])
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
  const trechoValido = pronta && trecho !== null && trecho < trechos.length ? trecho : null

  const geometriasOutros = estadosOutros.map((e) =>
    e.estado === 'pronta' ? e.rota.geometria : null,
  )
  const chaveOutros = geometriasOutros.join('|')
  const rotasNoMapa: RotaNoMapa[] = useMemo(() => {
    if (!escolhido) return []
    const paradasDe = (lista: PedidoProgramado[]): ParadaNoMapa[] =>
      lista.flatMap((p, i) => (temPonto(p) ? [{ parada: p, numero: i + 1 }] : []))
    const principal: RotaNoMapa = {
      id: escolhido.chave,
      cor: escolhido.cor,
      paradas: paradasDe(ordenadas),
      trechos: trechosNoMapa,
      recalculando: estadoRota.estado === 'calculando' && trechosNoMapa !== null,
    }
    const geos = chaveOutros.split('|')
    return [
      principal,
      ...outros.map((g, i) => ({
        id: g.chave,
        cor: g.cor,
        paradas: paradasDe(ordemDaRota(g.paradas)),
        trechos: geos[i] ? [decodificarLinha(geos[i])] : null,
        esmaecida: true,
      })),
    ]
  }, [escolhido, ordenadas, trechosNoMapa, estadoRota.estado, outros, chaveOutros])

  const numerosNoMapa = useMemo(
    () => ordenadas.flatMap((p, i) => (temPonto(p) ? [i + 1] : [])),
    [ordenadas],
  )
  const pecas = somarPecas(ordenadas)
  const resumoMapa = !escolhido
    ? null
    : trechoValido !== null
      ? `Trecho ${nomeDoTrecho(trechoValido, numerosNoMapa)}: ${textoTrecho(trechos[trechoValido])}`
      : estadoRota.estado === 'pronta'
        ? `${escolhido.caminhaoNome} · ${ordenadas.length} parada(s) · ${pecas} peças · ${formatarDistancia(estadoRota.rota.distancia_m / 1000)} · ${formatarDuracao(estadoRota.rota.duracao_s)}`
        : `${escolhido.caminhaoNome} · ${ordenadas.length} parada(s) · ${pecas} peças`

  // ---- gestos ------------------------------------------------------------
  const invalidar = () =>
    Promise.all([
      clienteQuery.invalidateQueries({ queryKey: ['programadas'] }),
      clienteQuery.invalidateQueries({ queryKey: ['programacao'] }),
      clienteQuery.invalidateQueries({ queryKey: ['rotas'] }),
    ])

  const focar = useCallback(
    (g: Grupo) => {
      setTrecho(null)
      aoFocar(g.dia, g.caminhaoId)
    },
    [aoFocar],
  )
  const reordenar = useCallback(
    (novos: number[]) => {
      if (!escolhido) return
      setRascunhos((atual) => ({ ...atual, [escolhido.chave]: novos }))
      setTrecho(null)
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
    mutationFn: (v: { grupo: Grupo; cardIds: number[] }) =>
      ordenarRota({ data: v.grupo.dia, caminhaoId: v.grupo.caminhaoId, cardIds: v.cardIds }),
    onSuccess: async (_d, v) => {
      notificar({
        titulo:
          v.cardIds.length === 0 ? 'A rota voltou à ordem sugerida' : 'Ordem das paradas salva',
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
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para salvar a ordem',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  const reprogramar = useMutation({
    mutationFn: (v: { cardId: number; data: string; caminhaoId: number }) => programarEntrega(v),
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

  const opcoesCaminhao = caminhoes.map((c) => ({
    valor: String(c.id),
    rotulo: c.placa ? `${c.nome} · ${c.placa}` : c.nome,
  }))
  const salvar =
    escolhido && !entregues
      ? {
          pendente: pendenteSalvar,
          carregando: salvarOrdem.isPending,
          // igual à sugestão = volta ao automático (nada fica preso)
          aoSalvar: () =>
            salvarOrdem.mutate({ grupo: escolhido, cardIds: ajustada ? idsOrdenados : [] }),
        }
      : undefined

  function linhaParada(p: PedidoProgramado, numero: number, cor: string) {
    return (
      <div className="flex flex-wrap items-start gap-3 rounded-dm-lg border border-borda bg-superficie p-3">
        <span
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2 bg-acao text-xs font-bold text-acao-texto tabular-nums"
          style={{ borderColor: cor }}
          aria-label={`${numero}ª parada`}
        >
          {numero}
        </span>
        <CartaoPedido pedido={p} />
        {entregues ? (
          <span className="text-xs text-texto-suave tabular-nums">
            entregue em {p.entregue_em ? new Date(p.entregue_em).toLocaleDateString('pt-BR') : '—'}
          </span>
        ) : (
          <span className="flex gap-2">
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
              o caminhão escolhido aceso, na cor dele · os outros do mesmo dia transparentes
            </span>
          </h2>
          <MapaProgramacao
            rotas={rotasNoMapa}
            trechoSelecionado={trechoValido}
            aoSelecionarTrecho={setTrecho}
            resumo={resumoMapa}
          />
          {escolhido && (
            <PainelRota
              titulo={`Rota do ${escolhido.caminhaoNome} · ${dataLegivel(escolhido.dia)}`}
              cor={escolhido.cor}
              paradas={ordenadas}
              estado={estadoRota}
              trechos={trechos}
              trechoSelecionado={trechoValido}
              aoSelecionarTrecho={setTrecho}
              ajustada={!entregues && ajustada}
              aoVoltarSugestao={voltarSugestao}
              salvar={salvar}
            />
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-4 @3xl:col-start-1 @3xl:row-start-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label="Quais programações" className="flex flex-wrap gap-2">
              <Botao
                variante={!entregues ? 'primaria' : 'secundaria'}
                aria-pressed={!entregues}
                onClick={() => setEntregues(false)}
              >
                A entregar
              </Botao>
              <Botao
                variante={entregues ? 'primaria' : 'secundaria'}
                aria-pressed={entregues}
                onClick={() => setEntregues(true)}
              >
                Ver entregues
              </Botao>
            </div>
            {total > 0 && (
              <span className="text-sm text-texto-suave tabular-nums">
                {linhas.length} de {total} {total === 1 ? 'entrega' : 'entregas'}
              </span>
            )}
          </div>

          {consulta.isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
          {!consulta.isPending && grupos.length === 0 && (
            <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
              {entregues
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
                const lista = ativo ? ordenadas : ordemDaRota(g.paradas)
                const pecasDoGrupo = somarPecas(g.paradas)
                return (
                  <section
                    key={g.chave}
                    className={cn(
                      'flex flex-col gap-3 rounded-dm-lg border bg-superficie-sutil p-3',
                      ativo ? 'border-acao-ativa ring-1 ring-acao-ativa' : 'border-borda',
                    )}
                    style={{ borderLeft: `8px solid ${g.cor}` }}
                    aria-label={`${g.caminhaoNome} em ${dataLegivel(g.dia)}`}
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
                        </span>
                        <span className="text-sm text-texto-suave tabular-nums">
                          {g.paradas.length} {g.paradas.length === 1 ? 'parada' : 'paradas'} ·{' '}
                          {pecasDoGrupo} {pecasDoGrupo === 1 ? 'peça' : 'peças'}
                          {ativo && estadoRota.estado === 'pronta' && (
                            <>
                              {' '}
                              · {formatarDistancia(estadoRota.rota.distancia_m / 1000)} ·{' '}
                              {formatarDuracao(estadoRota.rota.duracao_s)} dirigindo
                            </>
                          )}
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
                    </div>
                    {ativo && !entregues ? (
                      <ListaArrastavel
                        ids={idsOrdenados}
                        rotulo={`Paradas do ${g.caminhaoNome}, na ordem`}
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

        {reprogramando && (
          <ModalProgramar
            key={reprogramando.card_id}
            titulo={`Reprogramar o pedido ${reprogramando.numero}`}
            diaInicial={reprogramando.programacao_data}
            caminhaoInicial={String(reprogramando.caminhao_id)}
            opcoesCaminhao={opcoesCaminhao}
            carregando={reprogramar.isPending}
            aoFechar={() => setReprogramando(null)}
            aoConfirmar={(data, caminhaoId) =>
              reprogramar.mutate({ cardId: reprogramando.card_id, data, caminhaoId })
            }
          />
        )}
      </div>
    </div>
  )
}
