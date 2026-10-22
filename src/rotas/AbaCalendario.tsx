import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  CirclePause,
  Plus,
  RotateCcw,
  TriangleAlert,
  Truck,
} from 'lucide-react'
import { Botao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useAoVivo } from '@/lib/aoVivo'
import { useAbrirCard } from '@/kanban/janela/abrirCard'
import { calendarioRotas, nomeDaRota } from './api'
import type { DiaCalendario, ItemCalendario } from './api'
import {
  DIAS_DA_SEMANA,
  SITUACOES,
  diaCurto,
  diaMes,
  diasDaSemana,
  gradeDoMes,
  mesmoMes,
  periodoDoModo,
  somarDias,
  somarMeses,
  tituloDoPeriodo,
} from './calendario'
import type { ModoCalendario, SituacaoCalendario } from './calendario'
import { corDoCaminhao } from './rotaRuas'

/** Barras por dia que a semana pede (o resto em "+N", no clique); o mês mostra 3. */
const POR_DIA_SEMANA = 30
const POR_DIA_MES = 3

/**
 * A cor de cada situação — as do calendário do ClickUp do dono, nos tons da
 * casa: a barra no tom claro com a faixa forte à esquerda (como o ClickUp);
 * ícone + texto sempre juntos (M-12). A cor do CAMINHÃO fica no título do
 * grupo da rota — a barra fala só da situação.
 */
const ESTILO: Record<
  SituacaoCalendario,
  { barra: string; chip: string; ponto: string; icone: ReactNode }
> = {
  sem_rota: {
    barra: 'bg-etiqueta-cinza-fundo text-etiqueta-cinza-texto border-l-etiqueta-cinza-borda',
    chip: 'border-etiqueta-cinza-borda bg-etiqueta-cinza-fundo text-etiqueta-cinza-texto',
    ponto: 'bg-etiqueta-cinza-borda',
    icone: <CircleDashed aria-hidden className="size-3.5 shrink-0" />,
  },
  na_rota: {
    barra: 'bg-info-fundo text-info-texto border-l-info-forte',
    chip: 'border-info-borda bg-info-fundo text-info-texto',
    ponto: 'bg-info-forte',
    icone: <Truck aria-hidden className="size-3.5 shrink-0" />,
  },
  entregue: {
    barra: 'bg-perfeito-fundo text-perfeito-texto border-l-perfeito-forte',
    chip: 'border-perfeito-borda bg-perfeito-fundo text-perfeito-texto',
    ponto: 'bg-perfeito-forte',
    icone: <CheckCircle2 aria-hidden className="size-3.5 shrink-0" />,
  },
  nao_entregue: {
    barra: 'bg-danificado-fundo text-danificado-texto border-l-danificado-forte',
    chip: 'border-danificado-borda bg-danificado-fundo text-danificado-texto',
    ponto: 'bg-danificado-forte',
    icone: <RotateCcw aria-hidden className="size-3.5 shrink-0" />,
  },
  standby: {
    barra: 'bg-etiqueta-rosa-fundo text-etiqueta-rosa-texto border-l-etiqueta-rosa-borda',
    chip: 'border-etiqueta-rosa-borda bg-etiqueta-rosa-fundo text-etiqueta-rosa-texto',
    ponto: 'bg-etiqueta-rosa-borda',
    icone: <CirclePause aria-hidden className="size-3.5 shrink-0" />,
  },
}
const ROTULO = Object.fromEntries(SITUACOES.map((s) => [s.valor, s.rotulo])) as Record<
  SituacaoCalendario,
  string
>
const DIA_CURTO = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const MES_CURTO = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

function hojeLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** O texto completo da barra (o que a pessoa lê ao passar o mouse e o leitor de tela). */
function descricaoDoItem(i: ItemCalendario): string {
  const rota =
    i.situacao === 'na_rota' || i.situacao === 'entregue' || i.situacao === 'nao_entregue'
      ? [i.caminhao_nome, i.rota ? nomeDaRota(i.rota) : null].filter(Boolean).join(' · ')
      : ''
  return [
    `Pedido ${i.numero}`,
    i.bairro,
    ROTULO[i.situacao].toLowerCase() + (rota ? `: ${rota}` : ''),
    i.previsao ? `previsão ${diaMes(i.previsao)}` : 'sem previsão',
    i.detalhe,
    i.motivo,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Os grupos de um dia: cada rota (caminhão + nº) e, depois, não entregue, sem rota, stand-by. */
interface Grupo {
  chave: string
  titulo: string
  /** "Rota 1" — fica sempre à vista (o nome do caminhão é que encurta). */
  rota: string | null
  cor: string | null
  situacao: SituacaoCalendario | null
  itens: ItemCalendario[]
}
function agrupar(itens: ItemCalendario[]): Grupo[] {
  const grupos: Grupo[] = []
  for (const i of itens) {
    const naRota = (i.situacao === 'na_rota' || i.situacao === 'entregue') && i.caminhao_id
    const chave = naRota ? `rota:${i.caminhao_id}:${i.rota ?? 1}` : `sit:${i.situacao}`
    let g = grupos.find((x) => x.chave === chave)
    if (!g) {
      g = naRota
        ? {
            chave,
            titulo: i.caminhao_nome ?? 'Caminhão',
            rota: nomeDaRota(i.rota ?? 1),
            cor: corDoCaminhao(i.caminhao_id!),
            situacao: null,
            itens: [],
          }
        : {
            chave,
            titulo: ROTULO[i.situacao],
            rota: null,
            cor: null,
            situacao: i.situacao,
            itens: [],
          }
      grupos.push(g)
    }
    g.itens.push(i)
  }
  return grupos
}

/**
 * O CALENDÁRIO da programação (SESSAO-39 · D-175 — pedido do dono, com o vídeo
 * do calendário da lista ROTAS do ClickUp): um MODO de ver as rotas dentro de
 * Rotas → Programação. Semana de domingo a sábado (como o ClickUp) ou o mês;
 * cada pedido no seu dia — o dia da rota (na rota, entregue, não entregue) ou,
 * sem rota, o da previsão de entrega —, na cor da situação, agrupado por rota
 * (caminhão + nº, na cor do caminhão). A legenda filtra (mostra/esconde uma
 * situação — no aparelho, sem requisição). Uma requisição por tela (o período
 * inteiro); as barras de cada dia vêm limitadas e o "+N" busca o resto do dia
 * no clique (Lei §3). Ao vivo pelo aviso das rotas e do PCP (Lei §4). Tocar na
 * barra: o pedido na rota abre a rota em "Já programadas"; os outros abrem a
 * janela do pedido.
 * ↪️ 22/10 (pedido do dono, "melhore esse layout do calendário"): barra em
 * duas linhas (o bairro inteiro), grupos por rota, cabeçalho do dia com o
 * número grande, fim de semana mais estreito e a legenda que filtra.
 */
export function AbaCalendario({
  ativa,
  aoFocar,
  aoProgramar,
}: {
  ativa: boolean
  aoFocar: (dia: string, caminhaoId: number, rota: number) => void
  aoProgramar: () => void
}) {
  const [parametros, setParametros] = useSearchParams()
  const modo: ModoCalendario = parametros.get('ver') === 'mes' ? 'mes' : 'semana'
  const referencia = /^\d{4}-\d{2}-\d{2}$/.test(parametros.get('ref') ?? '')
    ? (parametros.get('ref') as string)
    : hojeLocal()
  const mudar = (novo: { modo?: ModoCalendario; ref?: string }) =>
    setParametros(
      (atual) => {
        const p = new URLSearchParams(atual)
        if (novo.modo) {
          if (novo.modo === 'mes') p.set('ver', 'mes')
          else p.delete('ver')
        }
        if (novo.ref) p.set('ref', novo.ref)
        return p
      },
      { replace: true },
    )

  const { de, ate } = periodoDoModo(modo, referencia)
  const porDia = modo === 'semana' ? POR_DIA_SEMANA : POR_DIA_MES
  const consulta = useQuery({
    queryKey: ['rotas-calendario', de, ate, porDia],
    queryFn: () => calendarioRotas({ de, ate, porDia }),
    enabled: ativa,
    placeholderData: keepPreviousData,
  })
  // A programação, a entrega ou um pedido novo mudou → AO VIVO, sem relógio.
  useAoVivo(['rotas', 'pcp'], [['rotas-calendario']], ativa)

  const dados = consulta.data
  const hoje = dados?.hoje ?? hojeLocal()
  const porData = useMemo(
    () => new Map((dados?.dias ?? []).map((d) => [d.dia, d] as const)),
    [dados],
  )
  const totais = useMemo(() => {
    const t: Record<SituacaoCalendario, number> = {
      sem_rota: 0,
      na_rota: 0,
      entregue: 0,
      nao_entregue: 0,
      standby: 0,
    }
    for (const d of dados?.dias ?? [])
      for (const s of SITUACOES) t[s.valor] += d.contagem?.[s.valor] ?? 0
    return t
  }, [dados])

  // A legenda filtra: a situação escondida some das barras e das contagens.
  const [ocultas, setOcultas] = useState<SituacaoCalendario[]>([])
  const alternar = (s: SituacaoCalendario) =>
    setOcultas((atual) => (atual.includes(s) ? atual.filter((x) => x !== s) : [...atual, s]))
  const visivel = (s: SituacaoCalendario) => !ocultas.includes(s)

  // "+N" na semana: o resto do dia, no clique (guardado por período).
  const [mais, setMais] = useState<{ periodo: string; dias: Record<string, ItemCalendario[]> }>({
    periodo: '',
    dias: {},
  })
  const periodo = `${de}|${ate}`
  const extras = mais.periodo === periodo ? mais.dias : {}
  const verMais = useMutation({
    mutationFn: (v: { dia: string; jaTem: number }) =>
      calendarioRotas({ de: v.dia, ate: v.dia, porDia: POR_DIA_SEMANA, deslocamento: v.jaTem }),
    onSuccess: (r, v) =>
      setMais((atual) => {
        const base = atual.periodo === periodo ? atual.dias : {}
        const novos = r.dias[0]?.itens ?? []
        return { periodo, dias: { ...base, [v.dia]: [...(base[v.dia] ?? []), ...novos] } }
      }),
  })

  const abrirCard = useAbrirCard()
  const tocar = (dia: string, i: ItemCalendario) => {
    if (i.situacao === 'na_rota' && i.caminhao_id) aoFocar(dia, i.caminhao_id, i.rota ?? 1)
    else abrirCard(i.card_id)
  }

  const passo = (sentido: -1 | 1) =>
    mudar({
      ref: modo === 'semana' ? somarDias(referencia, 7 * sentido) : somarMeses(referencia, sentido),
    })

  return (
    <div className="flex flex-col gap-3">
      {/* ---------- a barra do calendário (como o ClickUp: Hoje · ‹ › · o período) ---------- */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-1">
          <Botao variante="secundaria" tamanho="sm" onClick={() => mudar({ ref: hoje })}>
            Hoje
          </Botao>
          <Botao
            variante="fantasma"
            tamanho="sm"
            icone={<ChevronLeft />}
            aria-label={modo === 'semana' ? 'Semana anterior' : 'Mês anterior'}
            onClick={() => passo(-1)}
          />
          <Botao
            variante="fantasma"
            tamanho="sm"
            icone={<ChevronRight />}
            aria-label={modo === 'semana' ? 'Próxima semana' : 'Próximo mês'}
            onClick={() => passo(1)}
          />
        </div>
        <h2 className="text-xl font-semibold first-letter:uppercase" aria-live="polite">
          {tituloDoPeriodo(modo, referencia)}
        </h2>
        {/* Semana | Mês num controle só (segmentado) */}
        <div
          className="ml-auto inline-flex rounded-dm border border-borda-forte bg-superficie p-0.5"
          role="group"
          aria-label="Ver o calendário por"
        >
          {(['semana', 'mes'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={modo === m}
              onClick={() => mudar({ modo: m })}
              className={cn(
                'min-h-toque-sm rounded-[calc(var(--radius-dm)-2px)] px-4 text-sm font-medium transition-colors',
                modo === m ? 'bg-acao text-acao-texto' : 'text-texto-suave hover:text-texto',
              )}
            >
              {m === 'semana' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- a legenda, que também filtra ---------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mostrar no calendário">
          {SITUACOES.map((s) => {
            const ligado = visivel(s.valor)
            return (
              <button
                key={s.valor}
                type="button"
                aria-pressed={ligado}
                onClick={() => alternar(s.valor)}
                title={
                  ligado
                    ? `Esconder: ${s.rotulo.toLowerCase()}`
                    : `Mostrar: ${s.rotulo.toLowerCase()}`
                }
                className={cn(
                  'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-opacity',
                  ESTILO[s.valor].chip,
                  !ligado && 'line-through opacity-45',
                )}
              >
                {ESTILO[s.valor].icone}
                {s.rotulo}
                <span className="font-semibold tabular-nums">{totais[s.valor]}</span>
              </button>
            )
          })}
        </div>
        <span className="text-xs text-texto-fraco">Toque numa cor para esconder ou mostrar.</span>
      </div>

      {dados && (dados.fora.atrasados_sem_rota > 0 || dados.fora.sem_previsao > 0) && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-dm border border-atencao-borda bg-atencao-fundo px-3 py-1.5 text-sm text-atencao-texto">
          <TriangleAlert aria-hidden className="size-4 shrink-0" />
          <span>
            {[
              dados.fora.atrasados_sem_rota > 0 &&
                `${dados.fora.atrasados_sem_rota} sem rota com a previsão já vencida`,
              dados.fora.sem_previsao > 0 && `${dados.fora.sem_previsao} sem previsão de entrega`,
            ]
              .filter(Boolean)
              .join(' · ')}{' '}
            — fora do calendário.
          </span>
          <button
            type="button"
            onClick={aoProgramar}
            className="font-semibold underline underline-offset-2"
          >
            Ver em Programar
          </button>
        </p>
      )}

      {consulta.isError && (
        <p className="rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto">
          {consulta.error instanceof Error
            ? consulta.error.message
            : 'Não deu para carregar o calendário.'}
        </p>
      )}
      {consulta.isPending && <p className="text-sm text-texto-fraco">Carregando o calendário…</p>}

      {dados && modo === 'semana' && (
        <Semana
          dias={diasDaSemana(referencia)}
          hoje={hoje}
          porData={porData}
          extras={extras}
          visivel={visivel}
          carregandoDia={verMais.isPending ? verMais.variables?.dia : undefined}
          aoVerMais={(dia, jaTem) => verMais.mutate({ dia, jaTem })}
          aoTocar={tocar}
        />
      )}
      {dados && modo === 'mes' && (
        <Mes
          dias={gradeDoMes(referencia)}
          referencia={referencia}
          hoje={hoje}
          porData={porData}
          visivel={visivel}
          aoAbrirDia={(dia) => mudar({ modo: 'semana', ref: dia })}
          aoTocar={tocar}
        />
      )}
    </div>
  )
}

/** Quantos pedidos o dia tem nas situações à vista. */
function totalVisivel(d: DiaCalendario | undefined, visivel: (s: SituacaoCalendario) => boolean) {
  if (!d) return 0
  return SITUACOES.reduce((s, x) => s + (visivel(x.valor) ? (d.contagem?.[x.valor] ?? 0) : 0), 0)
}

/** Uma barra da semana: o número em cima, o bairro inteiro embaixo, o recado se houver. */
function Barra({
  item,
  dia,
  aoTocar,
}: {
  item: ItemCalendario
  /** O dia da coluna (a previsão só aparece quando é outro dia). */
  dia: string
  aoTocar: () => void
}) {
  const estilo = ESTILO[item.situacao]
  const descricao = descricaoDoItem(item)
  return (
    <button
      type="button"
      onClick={aoTocar}
      title={descricao}
      aria-label={descricao}
      className={cn(
        'flex min-h-11 w-full min-w-0 flex-col gap-0.5 rounded-dm border border-l-[3px] border-transparent px-2 py-1.5 text-left transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foco',
        estilo.barra,
      )}
    >
      <span className="flex w-full items-center gap-1.5 text-xs">
        {estilo.icone}
        <span className="font-semibold tabular-nums">{item.numero}</span>
        {/* a previsão só quando é outro dia (no dia dela, a coluna já diz) */}
        {item.previsao && item.previsao !== dia && (
          <span className="ml-auto shrink-0 text-[0.7rem] opacity-80 tabular-nums">
            prev. {diaMes(item.previsao)}
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-xs leading-snug break-words">
        {item.bairro ?? 'Sem bairro'}
      </span>
      {item.detalhe && (
        <span className="line-clamp-1 text-[0.7rem] font-medium uppercase opacity-90">
          {item.detalhe}
        </span>
      )}
    </button>
  )
}

/** O título do grupo: a rota (bolinha na cor do caminhão) ou a situação, com a contagem. */
function TituloGrupo({ grupo }: { grupo: Grupo }) {
  return (
    <p className="flex items-center gap-1.5 pt-1 text-[0.7rem] font-semibold text-texto-suave">
      {grupo.cor ? (
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: grupo.cor }}
        />
      ) : (
        grupo.situacao && <span className="shrink-0">{ESTILO[grupo.situacao].icone}</span>
      )}
      <span className="min-w-0 truncate">{grupo.titulo}</span>
      {grupo.rota && <span className="shrink-0 text-texto">{grupo.rota}</span>}
      <span className="ml-auto shrink-0 tabular-nums">{grupo.itens.length}</span>
    </p>
  )
}

function Semana({
  dias,
  hoje,
  porData,
  extras,
  visivel,
  carregandoDia,
  aoVerMais,
  aoTocar,
}: {
  dias: string[]
  hoje: string
  porData: Map<string, DiaCalendario>
  extras: Record<string, ItemCalendario[]>
  visivel: (s: SituacaoCalendario) => boolean
  carregandoDia?: string
  aoVerMais: (dia: string, jaTem: number) => void
  aoTocar: (dia: string, item: ItemCalendario) => void
}) {
  return (
    // Sete colunas só quando a ÁREA tem espaço (container, não janela — E-30) —
    // o fim de semana mais estreito; estreito, os dias empilham (o celular rola).
    <div className="@container">
      <div className="grid grid-cols-1 gap-2 @4xl:grid-cols-[minmax(0,0.7fr)_repeat(5,minmax(0,1fr))_minmax(0,0.8fr)] @4xl:gap-0 @4xl:divide-x @4xl:divide-borda/60 @4xl:overflow-hidden @4xl:rounded-dm-lg @4xl:border @4xl:border-borda @4xl:bg-superficie">
        {dias.map((dia, i) => {
          const doDia = porData.get(dia)
          const carregados = [...(doDia?.itens ?? []), ...(extras[dia] ?? [])]
          const itens = carregados.filter((x) => visivel(x.situacao))
          const total = totalVisivel(doDia, visivel)
          const faltam = Math.max(0, total - itens.length)
          const ehHoje = dia === hoje
          const mes = MES_CURTO[Number(dia.slice(5, 7)) - 1]
          return (
            <section
              key={dia}
              aria-label={`${DIAS_DA_SEMANA[i]}, ${diaCurto(dia)}${ehHoje ? ' (hoje)' : ''} — ${total} ${total === 1 ? 'pedido' : 'pedidos'}`}
              className={cn(
                'flex min-w-0 flex-col rounded-dm-lg border border-borda bg-superficie @4xl:min-h-80 @4xl:rounded-none @4xl:border-0',
                ehHoje && 'bg-acao/5 @4xl:bg-acao/5',
              )}
            >
              <header
                className={cn(
                  'flex items-center gap-2 border-b border-borda/60 px-2.5 py-2',
                  ehHoje && 'border-b-2 border-b-acao',
                )}
              >
                <span className="flex flex-col leading-none">
                  <span
                    className={cn(
                      'text-[0.7rem] font-semibold tracking-wide',
                      ehHoje ? 'text-texto' : 'text-texto-suave',
                    )}
                  >
                    {DIA_CURTO[i]}
                  </span>
                  <span className="mt-0.5 flex items-baseline gap-1">
                    <span
                      className={cn(
                        'text-2xl font-semibold tabular-nums',
                        ehHoje &&
                          'inline-flex size-8 items-center justify-center rounded-full bg-acao text-lg text-acao-texto',
                      )}
                    >
                      {Number(dia.slice(8, 10))}
                    </span>
                    <span className="text-xs text-texto-suave">{mes}</span>
                  </span>
                </span>
                {total > 0 && (
                  <span className="ml-auto rounded-full bg-superficie-sutil px-2 py-0.5 text-xs font-medium text-texto-suave tabular-nums">
                    {total}
                  </span>
                )}
              </header>
              <div className="flex flex-col gap-1.5 p-1.5">
                {itens.length === 0 && (
                  <span className="px-1 py-1 text-xs text-texto-fraco @4xl:hidden">
                    Nada neste dia
                  </span>
                )}
                {agrupar(itens).map((g) => (
                  <div key={g.chave} className="flex flex-col gap-1">
                    <TituloGrupo grupo={g} />
                    {g.itens.map((item) => (
                      <Barra
                        key={`${item.situacao}-${item.card_id}`}
                        item={item}
                        dia={dia}
                        aoTocar={() => aoTocar(dia, item)}
                      />
                    ))}
                  </div>
                ))}
                {faltam > 0 && (
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    icone={<Plus />}
                    carregando={carregandoDia === dia}
                    onClick={() => aoVerMais(dia, carregados.length)}
                  >
                    {faltam} {faltam === 1 ? 'pedido' : 'pedidos'}
                  </Botao>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function Mes({
  dias,
  referencia,
  hoje,
  porData,
  visivel,
  aoAbrirDia,
  aoTocar,
}: {
  dias: string[]
  referencia: string
  hoje: string
  porData: Map<string, DiaCalendario>
  visivel: (s: SituacaoCalendario) => boolean
  aoAbrirDia: (dia: string) => void
  aoTocar: (dia: string, item: ItemCalendario) => void
}) {
  return (
    <div className="@container">
      <div className="grid grid-cols-7 overflow-hidden rounded-dm-lg border border-borda bg-superficie">
        {DIA_CURTO.map((d) => (
          <span
            key={d}
            className="border-b border-borda bg-superficie-sutil px-1 py-1.5 text-center text-[0.7rem] font-semibold tracking-wide text-texto-suave"
          >
            {d}
          </span>
        ))}
        {dias.map((dia) => {
          const doDia = porData.get(dia)
          const total = totalVisivel(doDia, visivel)
          const itens = (doDia?.itens ?? []).filter((x) => visivel(x.situacao))
          const ehHoje = dia === hoje
          const doMes = mesmoMes(dia, referencia)
          return (
            <div
              key={dia}
              className={cn(
                'flex min-h-20 min-w-0 flex-col gap-1 border-r border-b border-borda/60 p-1 @3xl:min-h-32 @3xl:p-1.5',
                !doMes && 'bg-superficie-sutil/60',
                ehHoje && 'bg-acao/5',
              )}
            >
              <button
                type="button"
                onClick={() => aoAbrirDia(dia)}
                aria-label={`Ver a semana de ${diaCurto(dia)}${total ? ` — ${total} ${total === 1 ? 'pedido' : 'pedidos'}` : ''}`}
                className={cn(
                  'inline-flex size-7 items-center justify-center self-start rounded-full text-xs font-semibold tabular-nums hover:bg-superficie-sutil',
                  ehHoje
                    ? 'bg-acao text-acao-texto hover:bg-acao'
                    : doMes
                      ? 'text-texto'
                      : 'text-texto-fraco',
                )}
              >
                {Number(dia.slice(8, 10))}
              </button>
              {/* Largo: as primeiras barras; estreito: os pontos coloridos e o número. */}
              <div className="hidden min-w-0 flex-col gap-0.5 @3xl:flex">
                {itens.map((item) => (
                  <button
                    key={`${item.situacao}-${item.card_id}`}
                    type="button"
                    onClick={() => aoTocar(dia, item)}
                    title={descricaoDoItem(item)}
                    aria-label={descricaoDoItem(item)}
                    className={cn(
                      'flex min-h-6 w-full min-w-0 items-center gap-1 rounded border border-l-[3px] border-transparent px-1 text-left text-[0.7rem] leading-tight hover:shadow-sm',
                      ESTILO[item.situacao].barra,
                    )}
                  >
                    {ESTILO[item.situacao].icone}
                    <span className="min-w-0 truncate">
                      <span className="font-semibold tabular-nums">{item.numero}</span>
                      {item.bairro ? ` · ${item.bairro}` : ''}
                    </span>
                  </button>
                ))}
              </div>
              {total > 0 && (
                <span className="flex flex-wrap items-center gap-0.5 @3xl:hidden" aria-hidden>
                  {SITUACOES.filter(
                    (s) => visivel(s.valor) && (doDia?.contagem?.[s.valor] ?? 0) > 0,
                  ).map((s) => (
                    <span
                      key={s.valor}
                      className={cn('size-2 rounded-full', ESTILO[s.valor].ponto)}
                    />
                  ))}
                  <span className="text-[0.65rem] text-texto-suave tabular-nums">{total}</span>
                </span>
              )}
              {total > itens.length && (
                <button
                  type="button"
                  onClick={() => aoAbrirDia(dia)}
                  className="hidden self-start rounded-dm px-1 text-[0.7rem] font-semibold text-texto-suave hover:bg-superficie-sutil hover:text-texto @3xl:inline"
                >
                  +{total - itens.length} {total - itens.length === 1 ? 'pedido' : 'pedidos'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
