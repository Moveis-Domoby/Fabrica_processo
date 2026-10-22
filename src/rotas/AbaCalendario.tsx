import { Suspense, lazy, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  Columns3,
  ExternalLink,
  Route,
  TriangleAlert,
} from 'lucide-react'
import { Botao, Modal } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useAoVivo } from '@/lib/aoVivo'
import { useAbrirCard } from '@/kanban/janela/abrirCard'
import { calendarioRotas, nomeDaRota } from './api'
import type { DiaCalendario, ItemCalendario } from './api'
import {
  DIAS_DA_SEMANA,
  SITUACOES,
  diaCurto,
  diasDaSemana,
  gradeDoMes,
  mesmoMes,
  periodoDoModo,
  somarDias,
  somarMeses,
  tituloDoPeriodo,
} from './calendario'
import type { ModoCalendario, SituacaoCalendario } from './calendario'
import { useLargurasDasColunas } from './larguraColunas'
import type { LargurasDasColunas } from './larguraColunas'
import { corDoCaminhao } from './rotaRuas'

// A ficha do pedido só baixa quando alguém toca num pedido (Lei §3/§7).
const FichaDoPedido = lazy(() =>
  import('@/pedidos/FichaDoPedido').then((m) => ({ default: m.FichaDoPedido })),
)

/** Barras por dia que a semana pede (o resto em "+N", no clique); o mês mostra 3. */
const POR_DIA_SEMANA = 30
const POR_DIA_MES = 3

/**
 * A cor de cada situação — as do calendário do ClickUp do dono, nos tons da
 * casa: a barra no tom claro com a faixa forte à esquerda. A cor vem sempre
 * com o nome na legenda e no detalhe (M-12).
 */
const ESTILO: Record<SituacaoCalendario, { barra: string; quadrado: string }> = {
  sem_rota: {
    barra: 'bg-etiqueta-cinza-fundo text-etiqueta-cinza-texto border-l-etiqueta-cinza-borda',
    quadrado: 'bg-etiqueta-cinza-borda',
  },
  na_rota: {
    barra: 'bg-info-fundo text-info-texto border-l-info-forte',
    quadrado: 'bg-info-forte',
  },
  entregue: {
    barra: 'bg-perfeito-fundo text-perfeito-texto border-l-perfeito-forte',
    quadrado: 'bg-perfeito-forte',
  },
  nao_entregue: {
    barra: 'bg-danificado-fundo text-danificado-texto border-l-danificado-forte',
    quadrado: 'bg-danificado-forte',
  },
  standby: {
    barra: 'bg-etiqueta-rosa-fundo text-etiqueta-rosa-texto border-l-etiqueta-rosa-borda',
    quadrado: 'bg-etiqueta-rosa-borda',
  },
}
const ROTULO = Object.fromEntries(SITUACOES.map((s) => [s.valor, s.rotulo])) as Record<
  SituacaoCalendario,
  string
>
const DIA_CURTO = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

function hojeLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const programado = (i: ItemCalendario) =>
  (i.situacao === 'na_rota' || i.situacao === 'entregue') && i.caminhao_id !== null

/** "Hyundai HR · Rota 1 · 3ª parada" — onde o pedido está na programação. */
function ondeNaRota(i: ItemCalendario): string {
  return [
    i.caminhao_nome,
    i.rota ? nomeDaRota(i.rota) : null,
    i.ordem && programado(i) ? `${i.ordem}ª parada` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** O texto completo da barra (o que a pessoa lê ao passar o mouse e o leitor de tela). */
function descricaoDoItem(i: ItemCalendario): string {
  return [`Pedido ${i.numero}`, i.bairro, ROTULO[i.situacao].toLowerCase(), ondeNaRota(i)]
    .filter(Boolean)
    .join(' · ')
}

/**
 * O CALENDÁRIO da programação (SESSAO-39 · D-175 — pedido do dono, com o vídeo
 * do calendário da lista ROTAS do ClickUp): um MODO de ver as rotas dentro de
 * Rotas → Programação. Semana de domingo a sábado (como o ClickUp) ou o mês;
 * cada pedido no seu dia — o dia da rota (na rota, entregue, não entregue) ou,
 * sem rota, o da previsão de entrega —, numa barra reta de uma linha
 * ("13704 · Pitimbu") na cor da situação. A legenda filtra (mostra/esconde uma
 * situação — no aparelho, sem requisição). Uma requisição por tela (o período
 * inteiro); as barras de cada dia vêm limitadas e o "+N" busca o resto do dia
 * no clique (Lei §3). Ao vivo pelo aviso das rotas e do PCP (Lei §4).
 * ↪️ 22/10, 2ª volta (pedido do dono: "muito redonda e confusa … deixe a
 * possibilidade de ver mais detalhes do pedido caso eu clique"): grade reta
 * como a do ClickUp, sem grupos, círculos nem pílulas; tocar no pedido abre o
 * DETALHE (o que o calendário já sabe na hora + a ficha do pedido, que pede
 * o resto numa requisição só, no clique), com "Ver a rota" e "Abrir a janela
 * do pedido".
 * ↪️ 22/10, 3º pedido do dono ("estender a coluna no estilo do Sheets e do
 * Excel … clicar duas vezes na divisória e ela se ajustar ao tamanho exato do
 * maior texto"): a divisória no cabeçalho de cada dia arrasta a largura da
 * coluna; dois cliques ajustam ao maior texto; "Colunas iguais" desfaz.
 * Semana e mês guardam as suas larguras no aparelho (`larguraColunas.ts`).
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

  // Tocar no pedido abre o detalhe dele (o "ver a rota" e a janela ficam lá dentro).
  const [aberto, setAberto] = useState<{ dia: string; item: ItemCalendario } | null>(null)
  const abrirCard = useAbrirCard()

  // A largura de cada coluna, como numa planilha (guardada no aparelho, por modo).
  const colunasSemana = useLargurasDasColunas('domoby.calendario.colunas.semana')
  const colunasMes = useLargurasDasColunas('domoby.calendario.colunas.mes')
  const colunas = modo === 'semana' ? colunasSemana : colunasMes

  const passo = (sentido: -1 | 1) =>
    mudar({
      ref: modo === 'semana' ? somarDias(referencia, 7 * sentido) : somarMeses(referencia, sentido),
    })

  return (
    // A área do calendário é o "container": a dica das colunas aparece na mesma
    // largura em que as colunas viram grade (semana @4xl, mês @3xl — E-30).
    <div className="@container flex flex-col gap-3">
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
        <h2 className="text-lg font-semibold first-letter:uppercase" aria-live="polite">
          {tituloDoPeriodo(modo, referencia)}
        </h2>
        {/* Semana | Mês num controle só, reto */}
        <div
          className="ml-auto inline-flex divide-x divide-borda-forte overflow-hidden rounded-sm border border-borda-forte"
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
                'min-h-toque-sm px-4 text-sm font-medium transition-colors',
                modo === m
                  ? 'bg-acao text-acao-texto'
                  : 'bg-superficie text-texto-suave hover:bg-superficie-sutil hover:text-texto',
              )}
            >
              {m === 'semana' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- a legenda (tocar numa cor esconde/mostra) e as colunas ---------- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1"
          role="group"
          aria-label="Mostrar no calendário (toque para esconder ou mostrar)"
        >
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
                  'inline-flex min-h-8 items-center gap-1.5 text-sm text-texto transition-opacity hover:underline',
                  !ligado && 'line-through opacity-40',
                )}
              >
                <span aria-hidden className={cn('size-3 shrink-0', ESTILO[s.valor].quadrado)} />
                {s.rotulo}
                <span className="text-texto-suave tabular-nums">{totais[s.valor]}</span>
              </button>
            )
          })}
        </div>
        {/* As colunas como numa planilha: a dica, ou o "desfazer" depois de mexer. */}
        <div
          className={cn(
            'ml-auto hidden items-center text-xs text-texto-fraco',
            modo === 'semana' ? '@4xl:flex' : '@3xl:flex',
          )}
        >
          {colunas.personalizadas ? (
            <button
              type="button"
              onClick={colunas.restaurar}
              className="inline-flex min-h-8 items-center gap-1.5 font-semibold text-texto-suave hover:text-texto hover:underline"
            >
              <Columns3 aria-hidden className="size-3.5" />
              Colunas iguais
            </button>
          ) : (
            <span>
              Arraste a divisória entre os dias para alargar · dois cliques ajustam ao maior texto
            </span>
          )}
        </div>
      </div>

      {dados && (dados.fora.atrasados_sem_rota > 0 || dados.fora.sem_previsao > 0) && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-l-[3px] border-atencao-forte bg-atencao-fundo px-3 py-1.5 text-sm text-atencao-texto">
          <TriangleAlert aria-hidden className="size-4 shrink-0" />
          <span>
            Fora do calendário:{' '}
            {[
              dados.fora.atrasados_sem_rota > 0 &&
                `${dados.fora.atrasados_sem_rota} sem rota com a previsão já vencida`,
              dados.fora.sem_previsao > 0 && `${dados.fora.sem_previsao} sem previsão de entrega`,
            ]
              .filter(Boolean)
              .join(' · ')}
            .
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
        <p className="border-l-[3px] border-danificado-forte bg-danificado-fundo p-3 text-sm text-danificado-texto">
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
          aoTocar={(dia, item) => setAberto({ dia, item })}
          colunas={colunasSemana}
        />
      )}
      {dados && modo === 'mes' && (
        <Mes
          dias={gradeDoMes(referencia)}
          referencia={referencia}
          hoje={hoje}
          porData={porData}
          visivel={visivel}
          colunas={colunasMes}
          aoAbrirDia={(dia) => mudar({ modo: 'semana', ref: dia })}
          aoTocar={(dia, item) => setAberto({ dia, item })}
        />
      )}

      <DetalheDoPedido
        aberto={aberto}
        aoFechar={() => setAberto(null)}
        aoVerRota={(dia, item) => {
          setAberto(null)
          aoFocar(dia, item.caminhao_id!, item.rota ?? 1)
        }}
        aoAbrirJanela={(item) => {
          setAberto(null)
          abrirCard(item.card_id)
        }}
      />
    </div>
  )
}

/**
 * A DIVISÓRIA da coluna, no cabeçalho do dia (como a das planilhas): arrastar
 * muda a largura, dois cliques ajustam ao maior texto, setas ←/→ (Shift = 3×)
 * e Enter pelo teclado. A linha acende ao passar o mouse e ao focar.
 */
function Divisoria({
  gestos,
  rotulo,
  ultima,
  className,
}: {
  gestos: ReturnType<LargurasDasColunas['divisoria']>
  rotulo: string
  ultima: boolean
  className: string
}) {
  return (
    <div
      {...gestos}
      aria-label={rotulo}
      title="Arraste para mudar a largura · dois cliques ajustam ao maior texto"
      className={cn(
        'absolute inset-y-0 z-10 w-3 cursor-col-resize touch-none outline-none select-none',
        'after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:bg-transparent after:transition-colors',
        'hover:after:bg-info-forte focus-visible:after:bg-info-forte active:after:bg-info-forte',
        ultima ? 'right-0' : '-right-1.5',
        className,
      )}
    />
  )
}

/** Quantos pedidos o dia tem nas situações à vista. */
function totalVisivel(d: DiaCalendario | undefined, visivel: (s: SituacaoCalendario) => boolean) {
  if (!d) return 0
  return SITUACOES.reduce((s, x) => s + (visivel(x.valor) ? (d.contagem?.[x.valor] ?? 0) : 0), 0)
}

/** A barra de um pedido: reta, uma linha — "13704 · Pitimbu" — na cor da situação. */
function Barra({
  item,
  compacta = false,
  aoTocar,
}: {
  item: ItemCalendario
  compacta?: boolean
  aoTocar: () => void
}) {
  const descricao = descricaoDoItem(item)
  return (
    <button
      type="button"
      onClick={aoTocar}
      title={descricao}
      aria-label={`${descricao} — ver detalhes`}
      className={cn(
        'flex w-full min-w-0 items-center gap-1 rounded-[3px] border-l-[3px] px-1.5 text-left transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foco',
        compacta ? 'min-h-6 text-[0.7rem]' : 'min-h-9 text-xs @4xl:min-h-7',
        ESTILO[item.situacao].barra,
      )}
    >
      <span className="shrink-0 font-semibold tabular-nums">{item.numero}</span>
      {item.bairro && <span className="min-w-0 truncate">· {item.bairro}</span>}
    </button>
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
  colunas,
}: {
  dias: string[]
  hoje: string
  porData: Map<string, DiaCalendario>
  extras: Record<string, ItemCalendario[]>
  visivel: (s: SituacaoCalendario) => boolean
  carregandoDia?: string
  aoVerMais: (dia: string, jaTem: number) => void
  aoTocar: (dia: string, item: ItemCalendario) => void
  colunas: LargurasDasColunas
}) {
  return (
    // Sete colunas só quando a ÁREA tem espaço (container, não janela — E-30),
    // iguais até alguém mexer na divisória (aí cada uma tem a sua largura e a
    // grade pode rolar para o lado); estreito, os dias viram uma lista.
    <div className="@container">
      <div className="@4xl:overflow-x-auto">
        <div
          style={{ '--colunas': colunas.modelo } as CSSProperties}
          className={cn(
            'grid grid-cols-1 border border-borda bg-superficie @4xl:grid-cols-(--colunas)',
            colunas.personalizadas && '@4xl:w-max',
          )}
        >
          {dias.map((dia, i) => {
            const doDia = porData.get(dia)
            const carregados = [...(doDia?.itens ?? []), ...(extras[dia] ?? [])]
            const itens = carregados.filter((x) => visivel(x.situacao))
            const total = totalVisivel(doDia, visivel)
            const faltam = Math.max(0, total - itens.length)
            const ehHoje = dia === hoje
            return (
              <section
                key={dia}
                ref={colunas.refColuna(i)}
                aria-label={`${DIAS_DA_SEMANA[i]}, ${diaCurto(dia)}${ehHoje ? ' (hoje)' : ''} — ${total} ${total === 1 ? 'pedido' : 'pedidos'}`}
                className={cn(
                  'flex min-w-0 flex-col border-borda not-last:border-b @4xl:min-h-96 @4xl:not-last:border-r @4xl:not-last:border-b-0',
                  ehHoje && 'bg-acao/5',
                )}
              >
                <div className="relative">
                  {/* Uma linha só, sempre; o hoje é a coluna na cor de ação (o leitor de tela ouve "hoje"). */}
                  <header
                    className={cn(
                      'flex items-baseline gap-1.5 overflow-hidden border-b border-borda px-2 py-1.5 whitespace-nowrap',
                      ehHoje ? 'bg-acao text-acao-texto' : 'bg-superficie-sutil text-texto-suave',
                    )}
                  >
                    <span className="text-xs font-semibold tracking-wide">{DIA_CURTO[i]}</span>
                    <span
                      className={cn('text-sm font-semibold tabular-nums', !ehHoje && 'text-texto')}
                    >
                      {diaCurto(dia)}
                    </span>
                    {ehHoje && <span className="text-xs @4xl:sr-only">· hoje</span>}
                    {total > 0 && <span className="ml-auto text-xs tabular-nums">{total}</span>}
                  </header>
                  <Divisoria
                    gestos={colunas.divisoria(i)}
                    rotulo={`Largura da coluna de ${DIAS_DA_SEMANA[i]}`}
                    ultima={i === dias.length - 1}
                    className="hidden @4xl:block"
                  />
                </div>
                <div className="flex flex-col gap-1 p-1">
                  {itens.length === 0 && (
                    <span className="px-1 py-1 text-xs text-texto-fraco @4xl:hidden">
                      Nada neste dia
                    </span>
                  )}
                  {itens.map((item) => (
                    <Barra
                      key={`${item.situacao}-${item.card_id}`}
                      item={item}
                      aoTocar={() => aoTocar(dia, item)}
                    />
                  ))}
                  {faltam > 0 && (
                    <button
                      type="button"
                      disabled={carregandoDia === dia}
                      onClick={() => aoVerMais(dia, carregados.length)}
                      className="min-h-8 px-1.5 text-left text-xs font-semibold text-texto-suave hover:text-texto hover:underline disabled:opacity-60"
                    >
                      {carregandoDia === dia
                        ? 'Carregando…'
                        : `+ ${faltam} ${faltam === 1 ? 'pedido' : 'pedidos'}`}
                    </button>
                  )}
                </div>
              </section>
            )
          })}
        </div>
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
  colunas,
  aoAbrirDia,
  aoTocar,
}: {
  dias: string[]
  referencia: string
  hoje: string
  porData: Map<string, DiaCalendario>
  visivel: (s: SituacaoCalendario) => boolean
  colunas: LargurasDasColunas
  aoAbrirDia: (dia: string) => void
  aoTocar: (dia: string, item: ItemCalendario) => void
}) {
  return (
    <div className="@container">
      <div className="@3xl:overflow-x-auto">
        <div
          style={{ '--colunas': colunas.modelo } as CSSProperties}
          className={cn(
            'grid grid-cols-7 border-t border-l border-borda bg-superficie @3xl:grid-cols-(--colunas)',
            colunas.personalizadas && '@3xl:w-max',
          )}
        >
          {DIA_CURTO.map((d, i) => (
            <span
              key={d}
              ref={colunas.refColuna(i)}
              className="relative border-r border-b border-borda bg-superficie-sutil px-1.5 py-1 text-[0.7rem] font-semibold tracking-wide whitespace-nowrap text-texto-suave"
            >
              {d}
              <Divisoria
                gestos={colunas.divisoria(i)}
                rotulo={`Largura da coluna de ${DIAS_DA_SEMANA[i]}`}
                ultima={i === DIA_CURTO.length - 1}
                className="hidden @3xl:block"
              />
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
                  'flex min-h-20 min-w-0 flex-col gap-0.5 border-r border-b border-borda p-1 @3xl:min-h-32',
                  !doMes && 'bg-superficie-sutil/60',
                  ehHoje && 'bg-acao/5 shadow-[inset_0_2px_0_0_var(--color-acao)]',
                )}
              >
                <button
                  type="button"
                  onClick={() => aoAbrirDia(dia)}
                  aria-label={`Ver a semana de ${diaCurto(dia)}${total ? ` — ${total} ${total === 1 ? 'pedido' : 'pedidos'}` : ''}`}
                  className={cn(
                    'self-start px-0.5 text-xs font-semibold tabular-nums hover:underline',
                    ehHoje ? 'text-acao' : doMes ? 'text-texto' : 'text-texto-fraco',
                  )}
                >
                  {Number(dia.slice(8, 10))}
                  {ehHoje && <span className="font-normal"> · hoje</span>}
                </button>
                {/* Largo: as primeiras barras; estreito: os quadradinhos e o número. */}
                <div className="hidden min-w-0 flex-col gap-0.5 @3xl:flex">
                  {itens.map((item) => (
                    <Barra
                      key={`${item.situacao}-${item.card_id}`}
                      item={item}
                      compacta
                      aoTocar={() => aoTocar(dia, item)}
                    />
                  ))}
                </div>
                {total > 0 && (
                  <span className="flex flex-wrap items-center gap-0.5 @3xl:hidden" aria-hidden>
                    {SITUACOES.filter(
                      (s) => visivel(s.valor) && (doDia?.contagem?.[s.valor] ?? 0) > 0,
                    ).map((s) => (
                      <span key={s.valor} className={cn('size-2', ESTILO[s.valor].quadrado)} />
                    ))}
                    <span className="text-[0.65rem] text-texto-suave tabular-nums">{total}</span>
                  </span>
                )}
                {total > itens.length && (
                  <button
                    type="button"
                    onClick={() => aoAbrirDia(dia)}
                    className="hidden self-start px-0.5 text-[0.7rem] font-semibold text-texto-suave hover:text-texto hover:underline @3xl:inline"
                  >
                    + {total - itens.length} {total - itens.length === 1 ? 'pedido' : 'pedidos'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Uma linha do quadro do detalhe: o rótulo pequeno e o valor. */
function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-texto-suave">{rotulo}</dt>
      <dd className="text-sm font-medium break-words text-texto">{children}</dd>
    </div>
  )
}

/**
 * O DETALHE do pedido tocado no calendário: em cima, na hora, o que o
 * calendário já sabe (situação, dia, previsão, rota, recado, motivo); embaixo,
 * a ficha do pedido (cliente, venda, valor, entrega — e itens, produção,
 * comprovante, Tiny e histórico atrás de botões), que pede tudo numa
 * requisição só, no clique (Lei §3). "Ver a rota" leva a "Já programadas".
 */
function DetalheDoPedido({
  aberto,
  aoFechar,
  aoVerRota,
  aoAbrirJanela,
}: {
  aberto: { dia: string; item: ItemCalendario } | null
  aoFechar: () => void
  aoVerRota: (dia: string, item: ItemCalendario) => void
  aoAbrirJanela: (item: ItemCalendario) => void
}) {
  const item = aberto?.item
  const dia = aberto?.dia ?? ''
  // Sem rota e stand-by moram no dia da previsão — uma data só; os outros, no dia da rota.
  const peloDiaDaPrevisao = item?.situacao === 'sem_rota' || item?.situacao === 'standby'
  return (
    <Modal
      aberto={aberto !== null}
      aoFechar={(a) => {
        if (!a) aoFechar()
      }}
      titulo={item ? `Pedido ${item.numero}` : 'Pedido'}
      descricao={
        item ? [item.bairro, ROTULO[item.situacao]].filter(Boolean).join(' · ') : undefined
      }
      tamanho="galpao"
      rodape={
        item && (
          <>
            <Botao
              variante="secundaria"
              icone={<ExternalLink />}
              onClick={() => aoAbrirJanela(item)}
            >
              Abrir a janela do pedido
            </Botao>
            {programado(item) && (
              <Botao icone={<Route />} onClick={() => aoVerRota(dia, item)}>
                Ver a rota
              </Botao>
            )}
          </>
        )
      }
    >
      {item && (
        <div className="flex flex-col gap-4">
          <dl
            className={cn(
              'grid grid-cols-2 gap-x-4 gap-y-3 border-l-[3px] p-3 sm:grid-cols-4',
              ESTILO[item.situacao].barra,
            )}
          >
            <Dado rotulo="Situação">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className={cn('size-3', ESTILO[item.situacao].quadrado)} />
                {ROTULO[item.situacao]}
              </span>
            </Dado>
            {peloDiaDaPrevisao ? (
              <Dado rotulo="Previsão de entrega">{diaCurto(dia)}</Dado>
            ) : (
              <>
                <Dado rotulo="Dia da rota">{diaCurto(dia)}</Dado>
                <Dado rotulo="Previsão do vendedor">
                  {item.previsao ? diaCurto(item.previsao) : 'Sem previsão'}
                </Dado>
              </>
            )}
            {item.caminhao_nome ? (
              <Dado rotulo="Caminhão e rota">
                <span className="inline-flex items-center gap-1.5">
                  {item.caminhao_id && (
                    <span
                      aria-hidden
                      className="size-3 shrink-0"
                      style={{ backgroundColor: corDoCaminhao(item.caminhao_id) }}
                    />
                  )}
                  {ondeNaRota(item)}
                </span>
              </Dado>
            ) : (
              <Dado rotulo="Rota">Ainda sem rota</Dado>
            )}
            {item.detalhe && (
              <div className="col-span-2 sm:col-span-4">
                <Dado rotulo="Recado da programação">{item.detalhe}</Dado>
              </div>
            )}
            {item.motivo && (
              <div className="col-span-2 sm:col-span-4">
                <Dado rotulo={item.situacao === 'standby' ? 'Por que está em stand-by' : 'Motivo'}>
                  {item.motivo}
                </Dado>
              </div>
            )}
          </dl>
          <Suspense fallback={<p className="text-sm text-texto-fraco">Carregando o pedido…</p>}>
            <FichaDoPedido pedidoId={item.pedido_id} />
          </Suspense>
        </div>
      )}
    </Modal>
  )
}
