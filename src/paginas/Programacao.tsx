import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, MapPinOff, Route, Truck, X } from 'lucide-react'
import { Botao, Campo, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useAcessoLogistica } from '@/logistica/acesso'
import { listarCaminhoes, urlFotoCaminhao } from '@/admin/caminhoes'
import {
  desprogramarEntrega,
  enderecoLegivel,
  geocodificar,
  listarProgramacao,
  ordenarRota,
  precisaGeocodificar,
  programarEntrega,
} from '@/rotas/api'
import type { PedidoProgramacao } from '@/rotas/api'
import { MapaProgramacao } from '@/rotas/MapaProgramacao'
import type { ParadaNoMapa } from '@/rotas/MapaProgramacao'
import { PainelRota } from '@/rotas/PainelRota'
import { formatarDistancia, sugerirProximos, temPonto } from '@/rotas/proximidade'
import {
  MAXIMO_PARADAS,
  decodificarLinha,
  formatarDuracao,
  moverParada,
  ordemDaRota,
  ordemSugerida,
  pontosDaRota,
  trechosEmLinhaReta,
} from '@/rotas/rotaRuas'
import { useRotaPelasRuas } from '@/rotas/useRotaPelasRuas'

const ATUALIZA_A_CADA = 30_000
const RAIO_SUGESTAO_KM = 5

/** O que o mapa mostra (D-110): a seleção que se está montando, ou a rota de um caminhão do dia. */
type Visao = 'montando' | number

const SEM_PONTOS: { latitude: number; longitude: number }[] = []
const chaveVisao = (v: Visao) => (v === 'montando' ? 'montando' : `caminhao-${v}`)
const idsDe = (lista: { card_id: number }[]) => lista.map((p) => p.card_id)
const mesmaOrdem = (a: number[], b: number[]) => a.length === b.length && a.every((id, i) => id === b[i])

interface CaminhaoDoDia {
  id: number
  nome: string
  paradas: PedidoProgramacao[]
}

function hojeIso(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function dataLegivel(iso: string | null): string {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') : '—'
}

/**
 * ROTAS → Programação (SESSAO-15 / D-39 / D-45): escolho o dia → vejo os
 * pedidos SEM programação → seleciono os que vão → o mapa lateral desenha os
 * pontos e SUGERE outros pedidos próximos (é só sugestão — quem decide é a
 * pessoa) → confirmo com data + caminhão. Reprogramar pode a qualquer
 * instante; depois de entregue, não. Pedido sem endereço geocodificável
 * aparece com aviso e entra na programação normalmente — só não plota.
 *
 * SESSAO-28 (D-108…D-110): a linha é a rota PELAS RUAS, da fábrica à fábrica,
 * com distância e tempo por trecho; a ordem sugerida (o mais perto a partir da
 * fábrica) pode ser ajustada à mão e salva; e o mapa mostra também a rota de
 * cada caminhão já programado no dia. Os caminhões do dia vêm na MESMA lista
 * da porta — nenhuma consulta nova (regra "cada tela requisita só o que
 * mostra"); a rota de cada sequência é uma leitura do cache, e só a sequência
 * nunca calculada vai ao serviço de rotas.
 */
export function Programacao() {
  const { perfil, semAcesso, tenhoAcesso } = useAcessoLogistica()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const [dia, setDia] = useState(hojeIso)
  const [selecionados, setSelecionados] = useState<Set<number>>(() => new Set())
  const [confirmando, setConfirmando] = useState(false)
  const [caminhaoId, setCaminhaoId] = useState('')
  const [reprogramando, setReprogramando] = useState<PedidoProgramacao | null>(null)
  const [visao, setVisao] = useState<Visao>('montando')
  // A ordem que a pessoa ajustou e ainda não salvou, por visão (D-109).
  const [rascunhos, setRascunhos] = useState<Record<string, number[]>>({})

  const { data: pedidos = [], isPending } = useQuery({
    queryKey: ['programacao', dia],
    queryFn: () => listarProgramacao({ data: dia }),
    enabled: tenhoAcesso,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: caminhoes = [] } = useQuery({
    queryKey: ['caminhoes', false],
    queryFn: () => listarCaminhoes(false),
    enabled: tenhoAcesso,
  })

  const semProgramacao = useMemo(() => pedidos.filter((p) => p.programacao_data === null), [pedidos])
  const programadosNoDia = useMemo(
    () => pedidos.filter((p) => p.programacao_data !== null),
    [pedidos],
  )
  const listaSelecionados = useMemo(
    () => semProgramacao.filter((p) => selecionados.has(p.card_id)),
    [semProgramacao, selecionados],
  )
  const sugestoes = useMemo(
    () => sugerirProximos(listaSelecionados, semProgramacao, RAIO_SUGESTAO_KM),
    [listaSelecionados, semProgramacao],
  )

  // Os caminhões que já têm parada no dia escolhido (D-110).
  const caminhoesDoDia = useMemo(() => {
    const porCaminhao = new Map<number, CaminhaoDoDia>()
    for (const p of programadosNoDia) {
      if (p.caminhao_id === null) continue
      const atual = porCaminhao.get(p.caminhao_id) ?? {
        id: p.caminhao_id,
        nome: p.caminhao_nome ?? 'Caminhão',
        paradas: [],
      }
      atual.paradas.push(p)
      porCaminhao.set(p.caminhao_id, atual)
    }
    return [...porCaminhao.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [programadosNoDia])

  // A seleção que se está montando: a ordem (sugestão a partir da fábrica, ou
  // o ajuste da pessoa) e o número de cada parada — lista e mapa falam igual.
  const rascunhoMontando = rascunhos[chaveVisao('montando')] ?? null
  const ordemMontando = useMemo(
    () => ordemDaRota(listaSelecionados, { rascunho: rascunhoMontando }),
    [listaSelecionados, rascunhoMontando],
  )
  const ordemNaRota = useMemo(
    () => new Map(ordemMontando.map((p, i) => [p.card_id, i + 1])),
    [ordemMontando],
  )

  // A visão do mapa: se o caminhão escolhido saiu do dia, volta para a montagem.
  const caminhaoDaVisao =
    visao === 'montando' ? undefined : caminhoesDoDia.find((c) => c.id === visao)
  const visaoEfetiva: Visao = caminhaoDaVisao ? caminhaoDaVisao.id : 'montando'
  const paradasDaVisao = caminhaoDaVisao ? caminhaoDaVisao.paradas : listaSelecionados
  const rascunhoDaVisao = rascunhos[chaveVisao(visaoEfetiva)] ?? null
  const ordenadas = useMemo(
    () => (caminhaoDaVisao ? ordemDaRota(paradasDaVisao, { rascunho: rascunhoDaVisao }) : ordemMontando),
    [caminhaoDaVisao, paradasDaVisao, rascunhoDaVisao, ordemMontando],
  )
  // Sem o rascunho: a ordem salva (ou a sugestão). E a sugestão pura.
  const ordemGravada = useMemo(() => idsDe(ordemDaRota(paradasDaVisao)), [paradasDaVisao])
  const ordemDaSugestao = useMemo(() => idsDe(ordemSugerida(paradasDaVisao)), [paradasDaVisao])
  const idsOrdenados = idsDe(ordenadas)
  const ajustada = !mesmaOrdem(idsOrdenados, ordemDaSugestao)
  const temOrdemSalva = paradasDaVisao.some((p) => typeof p.ordem === 'number')
  const pendenteSalvar = caminhaoDaVisao !== undefined && !mesmaOrdem(idsOrdenados, ordemGravada)

  // A rota pelas ruas (D-108): fábrica → paradas com ponto → fábrica.
  const pontosRota = useMemo(() => pontosDaRota(ordenadas), [ordenadas])
  // Acima do teto de paradas o serviço não é chamado (a tela fica na linha reta).
  const estadoRota = useRotaPelasRuas(pontosRota.length - 2 > MAXIMO_PARADAS ? SEM_PONTOS : pontosRota)
  const geometria = estadoRota.estado === 'pronta' ? estadoRota.rota.geometria : null
  const linhaPelasRuas = useMemo(() => (geometria ? decodificarLinha(geometria) : null), [geometria])
  const trechosRetos = useMemo(() => trechosEmLinhaReta(pontosRota), [pontosRota])
  const paradasNoMapa: ParadaNoMapa[] = ordenadas.flatMap((p, i) =>
    temPonto(p) ? [{ parada: p, numero: i + 1 }] : [],
  )
  const kmEmLinhaReta = trechosRetos.reduce((soma, km) => soma + km, 0)
  const resumoRota =
    ordenadas.length === 0
      ? null
      : estadoRota.estado === 'pronta'
        ? `${ordenadas.length} parada(s) · ${formatarDistancia(estadoRota.rota.distancia_m / 1000)} · ${formatarDuracao(estadoRota.rota.duracao_s)} dirigindo`
        : estadoRota.estado === 'calculando'
          ? `${ordenadas.length} parada(s) · calculando a rota…`
          : pontosRota.length > 0
            ? `${ordenadas.length} parada(s) · ${formatarDistancia(kmEmLinhaReta)} em linha reta`
            : `${ordenadas.length} parada(s) · nenhuma no mapa`

  function mover(cardId: number, delta: -1 | 1) {
    setRascunhos((atual) => ({
      ...atual,
      [chaveVisao(visaoEfetiva)]: moverParada(idsOrdenados, cardId, delta),
    }))
  }

  // D-109: ao programar, a ordem vai junto quando o caminhão já tem ordem
  // salva naquele dia ou quando a pessoa ajustou a montagem — os novos entram
  // no FIM da rota do caminhão. Só para o dia que está na tela (é o que ela
  // conhece); noutro dia, os novos seguem a sugestão de lá.
  function ordemAoProgramar(data: string, caminhao: number): number[] | null {
    if (data !== dia) return null
    const jaNoCaminhao = programadosNoDia.filter((p) => p.caminhao_id === caminhao)
    const temSalva = jaNoCaminhao.some((p) => typeof p.ordem === 'number')
    const montagemAjustada = !mesmaOrdem(idsDe(ordemMontando), idsDe(ordemSugerida(listaSelecionados)))
    if (!temSalva && !montagemAjustada) return null
    return [...idsDe(ordemDaRota(jaNoCaminhao)), ...idsDe(ordemMontando)]
  }

  function voltarSugestao() {
    setRascunhos((atual) => {
      const novo = { ...atual }
      // Caminhão com ordem salva: a sugestão vira rascunho e o "Salvar ordem"
      // a grava (volta ao automático). Sem ordem salva, basta largar o ajuste.
      if (caminhaoDaVisao && temOrdemSalva) novo[chaveVisao(visaoEfetiva)] = ordemDaSugestao
      else delete novo[chaveVisao(visaoEfetiva)]
      return novo
    })
  }

  const salvarOrdemMutacao = useMutation({
    mutationFn: (parametros: { caminhaoId: number; cardIds: number[] }) =>
      ordenarRota({ data: dia, caminhaoId: parametros.caminhaoId, cardIds: parametros.cardIds }),
    onSuccess: async (_dados, parametros) => {
      notificar({
        titulo:
          parametros.cardIds.length === 0
            ? 'A rota voltou à ordem sugerida'
            : 'Ordem das paradas salva',
        tom: 'perfeito',
      })
      // Larga o rascunho só depois de a lista voltar com a ordem nova — a
      // tela não pisca na ordem antiga.
      await clienteQuery.invalidateQueries({ queryKey: ['programacao'] })
      setRascunhos((atual) => {
        const novo = { ...atual }
        delete novo[chaveVisao(parametros.caminhaoId)]
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

  // Geocodificação preguiçosa: quem ainda não tem ponto vai à Edge Function
  // (até 10 por vez), uma vez só por chave nesta visita.
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
      .slice(0, 10)
    if (pendentes.length === 0) return
    for (const p of pendentes) pedidas.current.add(p.geo_chave!)
    geocodificarMutacao.mutate(
      pendentes.map((p) => ({ chave: p.geo_chave!, endereco: p.endereco_geocodificavel! })),
    )
  }, [pedidos, geocodificarMutacao])

  const programarMutacao = useMutation({
    mutationFn: async (parametros: {
      cardIds: number[]
      data: string
      caminhaoId: number
      /** D-109: a ordem da rota inteira do caminhão, quando ela vai junto. */
      ordem: number[] | null
    }) => {
      for (const cardId of parametros.cardIds) {
        await programarEntrega({ cardId, data: parametros.data, caminhaoId: parametros.caminhaoId })
      }
      if (parametros.ordem) {
        await ordenarRota({ data: parametros.data, caminhaoId: parametros.caminhaoId, cardIds: parametros.ordem })
      }
    },
    onSuccess: async (_dados, parametros) => {
      notificar({
        titulo:
          parametros.cardIds.length === 1
            ? 'Entrega programada'
            : `${parametros.cardIds.length} entregas programadas`,
        tom: 'perfeito',
      })
      setSelecionados(new Set())
      setConfirmando(false)
      setReprogramando(null)
      setRascunhos((atual) => {
        const novo = { ...atual }
        delete novo[chaveVisao('montando')]
        delete novo[chaveVisao(parametros.caminhaoId)]
        return novo
      })
      // Programou no dia que está na tela: o mapa passa a mostrar a rota do caminhão.
      if (parametros.data === dia && !reprogramando) setVisao(parametros.caminhaoId)
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['programacao'] }),
        clienteQuery.invalidateQueries({ queryKey: ['rotas'] }),
      ])
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para programar',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  const desprogramarMutacao = useMutation({
    mutationFn: (p: PedidoProgramacao) => desprogramarEntrega(p.card_id),
    onSuccess: async (_dados, p) => {
      notificar({ titulo: `Pedido ${p.numero} voltou para "sem programação"`, tom: 'perfeito' })
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['programacao'] }),
        clienteQuery.invalidateQueries({ queryKey: ['rotas'] }),
      ])
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para tirar da programação',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  function alternar(cardId: number) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(cardId)) novo.delete(cardId)
      else novo.add(cardId)
      return novo
    })
  }

  if (semAcesso) return <Navigate to="/" replace />
  if (!perfil) return null

  const opcoesCaminhao = caminhoes.map((c) => ({
    valor: String(c.id),
    rotulo: c.placa ? `${c.nome} · ${c.placa}` : c.nome,
  }))
  const semPonto = listaSelecionados.filter((p) => !temPonto(p)).length

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-3 text-2xl sm:text-3xl">
          <Route aria-hidden className="size-7 text-texto-suave" />
          Programação de caminhão
        </h1>
        <p className="mt-1 max-w-2xl text-texto-suave">
          Escolha o dia, marque os pedidos que vão, veja no mapa quem está perto (é só sugestão —
          a decisão é sua) e confirme com o caminhão.
        </p>
      </div>

      <div className="grid max-w-md grid-cols-1 gap-3">
        <Campo
          rotulo="Dia da entrega"
          type="date"
          prefixo={<CalendarDays />}
          value={dia}
          onChange={(e) => {
            setDia(e.target.value)
            setSelecionados(new Set())
            setVisao('montando')
            setRascunhos({})
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* A lista: sem programação, com seleção. */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg">
            Sem programação{' '}
            <span className="text-sm font-normal text-texto-suave tabular-nums">
              ({semProgramacao.length})
            </span>
          </h2>
          {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
          {!isPending && semProgramacao.length === 0 && (
            <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
              Nenhum pedido lançado esperando programação.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {semProgramacao.map((p) => {
              const marcado = selecionados.has(p.card_id)
              const sugestao = sugestoes.find((s) => s.item.card_id === p.card_id)
              return (
                <li key={p.card_id}>
                  <label
                    className={cn(
                      'flex min-h-toque-lg cursor-pointer items-start gap-3 rounded-dm-lg border bg-superficie p-3',
                      marcado
                        ? 'border-acao-ativa'
                        : sugestao
                          ? 'border-atencao-borda'
                          : 'border-borda',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 size-5 shrink-0 accent-marca-500"
                      checked={marcado}
                      onChange={() => alternar(p.card_id)}
                      aria-label={`Selecionar o pedido ${p.numero}`}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        {marcado && ordemNaRota.has(p.card_id) && (
                          <span
                            className="inline-flex size-6 items-center justify-center rounded-full bg-acao text-xs font-bold text-acao-texto tabular-nums"
                            aria-label={`${ordemNaRota.get(p.card_id)}ª parada`}
                          >
                            {ordemNaRota.get(p.card_id)}
                          </span>
                        )}
                        <span className="font-semibold text-texto tabular-nums">Pedido {p.numero}</span>
                        <span className="text-sm text-texto-suave tabular-nums">
                          {p.total_unidades} unidade(s) · previsão {dataLegivel(p.data_prevista)}
                        </span>
                        {sugestao && !marcado && (
                          <span className="rounded-full bg-atencao-fundo px-2 py-0.5 text-xs font-medium text-atencao-texto">
                            sugestão · {formatarDistancia(sugestao.distanciaKm)}
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-texto">{p.cliente_nome || 'Sem cliente'}</span>
                      <span className="text-sm text-texto-suave">{enderecoLegivel(p)}</span>
                      {p.geo_resolvido === false && (
                        <span className="inline-flex items-center gap-1 text-xs text-atencao-texto">
                          <MapPinOff aria-hidden className="size-3.5" />
                          Endereço não encontrado no mapa — entra na programação, só não plota
                        </span>
                      )}
                      {p.geo_resolvido === null && p.geo_chave && (
                        <span className="text-xs text-texto-fraco">procurando no mapa…</span>
                      )}
                      {!p.geo_chave && (
                        <span className="inline-flex items-center gap-1 text-xs text-atencao-texto">
                          <MapPinOff aria-hidden className="size-3.5" />
                          Sem endereço cadastrado
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>

          {listaSelecionados.length > 0 && (
            <div className="sticky bottom-2 flex flex-wrap items-center gap-3 rounded-dm-lg border border-acao-ativa bg-superficie p-3 shadow-lg">
              <span className="text-sm text-texto tabular-nums">
                {listaSelecionados.length} pedido(s) selecionado(s)
                {visaoEfetiva === 'montando' && estadoRota.estado === 'pronta' && (
                  <span className="text-texto-suave">
                    {' '}
                    · rota de {formatarDistancia(estadoRota.rota.distancia_m / 1000)} pelas ruas, ida e volta
                  </span>
                )}
                {semPonto > 0 && (
                  <span className="text-texto-suave"> · {semPonto} sem ponto no mapa</span>
                )}
              </span>
              <span className="ml-auto flex gap-2">
                <Botao variante="fantasma" tamanho="sm" onClick={() => setSelecionados(new Set())}>
                  Limpar
                </Botao>
                <Botao icone={<Truck />} onClick={() => setConfirmando(true)}>
                  Programar
                </Botao>
              </span>
            </div>
          )}
        </section>

        {/* O mapa lateral: a rota pelas ruas (da fábrica à fábrica) da seleção
            ou de um caminhão do dia + sugestões por proximidade na montagem. */}
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="text-lg">
            Mapa{' '}
            <span className="text-sm font-normal text-texto-suave">
              F = fábrica (saída e volta) · amarelo numerado = ordem das paradas
              {visaoEfetiva === 'montando' && <> · âmbar = pedidos próximos (até {RAIO_SUGESTAO_KM} km)</>}
            </span>
          </h2>
          {caminhoesDoDia.length > 0 && (
            <div role="group" aria-label="O que o mapa mostra" className="flex flex-wrap gap-2">
              <Botao
                variante={visaoEfetiva === 'montando' ? 'primaria' : 'secundaria'}
                aria-pressed={visaoEfetiva === 'montando'}
                onClick={() => setVisao('montando')}
              >
                Montando agora ({listaSelecionados.length})
              </Botao>
              {caminhoesDoDia.map((c) => (
                <Botao
                  key={c.id}
                  variante={visaoEfetiva === c.id ? 'primaria' : 'secundaria'}
                  aria-pressed={visaoEfetiva === c.id}
                  icone={<Truck />}
                  onClick={() => setVisao(c.id)}
                  // nome de caminhão comprido quebra linha dentro do botão (não
                  // estoura): a altura fixa do tamanho vira mínima. Pelo style —
                  // o juntador de classes não reconhece a altura da casa
                  // (h-toque-*) como conflito de h-auto.
                  style={{ height: 'auto' }}
                  className="min-h-toque-md max-w-full py-2 text-left"
                >
                  <span className="min-w-0 break-words">
                    {c.nome} · {c.paradas.length} parada(s)
                  </span>
                </Botao>
              ))}
            </div>
          )}
          <MapaProgramacao
            paradas={paradasNoMapa}
            linha={linhaPelasRuas}
            resumo={resumoRota}
            sugestoes={visaoEfetiva === 'montando' ? sugestoes : []}
            aoEscolherSugestao={(p) => alternar(p.card_id)}
          />
          {ordenadas.length > 0 ? (
            <PainelRota
              titulo={
                caminhaoDaVisao
                  ? `Rota do ${caminhaoDaVisao.nome} em ${dataLegivel(dia)}`
                  : 'Rota que você está montando'
              }
              paradas={ordenadas}
              estado={estadoRota}
              trechosEmLinhaReta={trechosRetos}
              aoMover={mover}
              ajustada={ajustada}
              aoVoltarSugestao={voltarSugestao}
              salvar={
                caminhaoDaVisao
                  ? {
                      pendente: pendenteSalvar,
                      carregando: salvarOrdemMutacao.isPending,
                      aoSalvar: () =>
                        salvarOrdemMutacao.mutate({
                          caminhaoId: caminhaoDaVisao.id,
                          // igual à sugestão = volta ao automático (nada fica preso)
                          cardIds: ajustada ? idsOrdenados : [],
                        }),
                    }
                  : undefined
              }
            />
          ) : (
            <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
              Marque pedidos na lista para montar a rota — ela sai da fábrica, passa pelas entregas e volta.
            </p>
          )}
          {paradasNoMapa.length > MAXIMO_PARADAS && (
            <p className="text-xs text-atencao-texto">
              Mais de {MAXIMO_PARADAS} paradas no mapa: a rota pelas ruas não é calculada — mostrando em linha reta.
            </p>
          )}
        </section>
      </div>

      {/* Programados no dia escolhido. */}
      <section className="flex flex-col gap-3 border-t border-borda pt-4">
        <h2 className="text-lg">
          Programados para {dataLegivel(dia)}{' '}
          <span className="text-sm font-normal text-texto-suave tabular-nums">
            ({programadosNoDia.length})
          </span>
        </h2>
        {!isPending && programadosNoDia.length === 0 && (
          <p className="text-sm text-texto-suave">Nada programado para este dia ainda.</p>
        )}
        <ul className="flex flex-col gap-2">
          {programadosNoDia.map((p) => {
            const caminhao = caminhoes.find((c) => c.id === p.caminhao_id)
            const foto = urlFotoCaminhao(caminhao?.foto_caminho ?? null)
            return (
              <li
                key={p.card_id}
                className="flex flex-wrap items-center gap-3 rounded-dm-lg border border-borda bg-superficie p-3"
              >
                {foto ? (
                  <img src={foto} alt="" className="size-12 shrink-0 rounded-dm object-cover" />
                ) : (
                  <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-dm bg-superficie-sutil text-texto-suave">
                    <Truck aria-hidden className="size-6" />
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold text-texto tabular-nums">
                    Pedido {p.numero} · {p.caminhao_nome ?? 'caminhão'}
                  </span>
                  <span className="text-sm text-texto-suave">
                    {p.cliente_nome || 'Sem cliente'} · {enderecoLegivel(p)}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Botao variante="secundaria" onClick={() => setReprogramando(p)}>
                    Reprogramar
                  </Botao>
                  <Botao
                    variante="fantasma"
                    icone={<X />}
                    onClick={() => desprogramarMutacao.mutate(p)}
                    carregando={
                      desprogramarMutacao.isPending &&
                      desprogramarMutacao.variables?.card_id === p.card_id
                    }
                  >
                    Tirar
                  </Botao>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Confirmar: data + caminhão (D-39). O mesmo modal serve para reprogramar. */}
      {(confirmando || reprogramando) && (
        <ModalConfirmar
          key={reprogramando?.card_id ?? 'novo'}
          titulo={
            reprogramando
              ? `Reprogramar o pedido ${reprogramando.numero}`
              : `Programar ${listaSelecionados.length} pedido(s)`
          }
          diaInicial={reprogramando?.programacao_data ?? dia}
          caminhaoInicial={reprogramando?.caminhao_id ? String(reprogramando.caminhao_id) : caminhaoId}
          opcoesCaminhao={opcoesCaminhao}
          carregando={programarMutacao.isPending}
          aoFechar={() => {
            setConfirmando(false)
            setReprogramando(null)
          }}
          aoConfirmar={(data, caminhao) => {
            setCaminhaoId(String(caminhao))
            programarMutacao.mutate({
              cardIds: reprogramando ? [reprogramando.card_id] : idsDe(ordemMontando),
              data,
              caminhaoId: caminhao,
              ordem: reprogramando ? null : ordemAoProgramar(data, caminhao),
            })
          }}
        />
      )}
    </div>
  )
}

function ModalConfirmar({
  titulo,
  diaInicial,
  caminhaoInicial,
  opcoesCaminhao,
  carregando,
  aoFechar,
  aoConfirmar,
}: {
  titulo: string
  diaInicial: string
  caminhaoInicial: string
  opcoesCaminhao: { valor: string; rotulo: string }[]
  carregando: boolean
  aoFechar: () => void
  aoConfirmar: (data: string, caminhaoId: number) => void
}) {
  const [data, setData] = useState(diaInicial)
  const [caminhao, setCaminhao] = useState(caminhaoInicial)
  const pronto = Boolean(data) && Number(caminhao) > 0

  return (
    <Modal
      aberto
      aoFechar={(aberto) => {
        if (!aberto) aoFechar()
      }}
      titulo={titulo}
      descricao="Confirme o dia e o caminhão. Dá para reprogramar a qualquer instante — só não depois de entregue."
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            variante="primaria"
            disabled={!pronto}
            carregando={carregando}
            onClick={() => aoConfirmar(data, Number(caminhao))}
          >
            Confirmar
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo rotulo="Dia" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        {opcoesCaminhao.length === 0 ? (
          <p className="rounded-dm bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto">
            Nenhum caminhão cadastrado — cadastre em Administração → Caminhões.
          </p>
        ) : (
          <Selecao
            rotulo="Caminhão"
            opcoes={opcoesCaminhao}
            valor={caminhao}
            aoMudar={setCaminhao}
            placeholder="Escolha o caminhão"
            tamanho="galpao"
          />
        )}
      </div>
    </Modal>
  )
}
