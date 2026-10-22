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

/** A cor de cada situação — as do calendário do ClickUp do dono, nos tons da casa (M-12: + ícone e texto). */
const ESTILO: Record<SituacaoCalendario, { classe: string; ponto: string; icone: ReactNode }> = {
  sem_rota: {
    classe: 'border-etiqueta-cinza-borda bg-etiqueta-cinza-fundo text-etiqueta-cinza-texto',
    ponto: 'bg-etiqueta-cinza-borda',
    icone: <CircleDashed aria-hidden className="size-3.5 shrink-0" />,
  },
  na_rota: {
    classe: 'border-info-borda bg-info-fundo text-info-texto',
    ponto: 'bg-info-forte',
    icone: <Truck aria-hidden className="size-3.5 shrink-0" />,
  },
  entregue: {
    classe: 'border-perfeito-borda bg-perfeito-fundo text-perfeito-texto',
    ponto: 'bg-perfeito-forte',
    icone: <CheckCircle2 aria-hidden className="size-3.5 shrink-0" />,
  },
  nao_entregue: {
    classe: 'border-danificado-borda bg-danificado-fundo text-danificado-texto',
    ponto: 'bg-danificado-forte',
    icone: <RotateCcw aria-hidden className="size-3.5 shrink-0" />,
  },
  standby: {
    classe: 'border-etiqueta-rosa-borda bg-etiqueta-rosa-fundo text-etiqueta-rosa-texto',
    ponto: 'bg-etiqueta-rosa-borda',
    icone: <CirclePause aria-hidden className="size-3.5 shrink-0" />,
  },
}
const ROTULO = Object.fromEntries(SITUACOES.map((s) => [s.valor, s.rotulo])) as Record<
  SituacaoCalendario,
  string
>

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

/**
 * O CALENDÁRIO da programação (SESSAO-39 · D-175 — pedido do dono, com o vídeo
 * do calendário da lista ROTAS do ClickUp): um MODO de ver as rotas dentro de
 * Rotas → Programação. Semana de domingo a sábado (como o ClickUp) ou o mês;
 * cada pedido no seu dia — o dia da rota (na rota, entregue, não entregue) ou,
 * sem rota, o da previsão de entrega —, na cor da situação, com a cor do
 * caminhão na borda. Uma requisição por tela (o período inteiro); as barras de
 * cada dia vêm limitadas e o "+N" busca o resto do dia no clique (Lei §3).
 * Ao vivo pelo aviso das rotas e do PCP (Lei §4). Tocar na barra: o pedido na
 * rota abre a rota em "Já programadas"; os outros abrem a janela do pedido.
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
    <div className="flex flex-col gap-4">
      {/* ---------- a barra do calendário (como o ClickUp: Hoje · ‹ › · o período) ---------- */}
      <div className="flex flex-wrap items-center gap-2">
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
        <h2 className="text-lg first-letter:uppercase" aria-live="polite">
          {tituloDoPeriodo(modo, referencia)}
        </h2>
        <div className="ml-auto flex gap-1" role="group" aria-label="Ver o calendário por">
          {(['semana', 'mes'] as const).map((m) => (
            <Botao
              key={m}
              tamanho="sm"
              variante={modo === m ? 'primaria' : 'secundaria'}
              aria-pressed={modo === m}
              onClick={() => mudar({ modo: m })}
            >
              {m === 'semana' ? 'Semana' : 'Mês'}
            </Botao>
          ))}
        </div>
      </div>

      {/* ---------- a legenda, com o total do período ---------- */}
      <ul className="flex flex-wrap gap-2" aria-label="Legenda das cores">
        {SITUACOES.map((s) => (
          <li
            key={s.valor}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
              ESTILO[s.valor].classe,
            )}
          >
            {ESTILO[s.valor].icone}
            {s.rotulo}
            <span className="tabular-nums">· {totais[s.valor]}</span>
          </li>
        ))}
      </ul>

      {dados && (dados.fora.atrasados_sem_rota > 0 || dados.fora.sem_previsao > 0) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-dm border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto">
          <TriangleAlert aria-hidden className="size-4 shrink-0" />
          {dados.fora.atrasados_sem_rota > 0 && (
            <span>
              {dados.fora.atrasados_sem_rota}{' '}
              {dados.fora.atrasados_sem_rota === 1
                ? 'pedido sem rota já passou da previsão'
                : 'pedidos sem rota já passaram da previsão'}
            </span>
          )}
          {dados.fora.sem_previsao > 0 && (
            <span>
              {dados.fora.sem_previsao}{' '}
              {dados.fora.sem_previsao === 1
                ? 'pedido sem previsão de entrega (fora do calendário)'
                : 'pedidos sem previsão de entrega (fora do calendário)'}
            </span>
          )}
          <Botao variante="secundaria" tamanho="sm" onClick={aoProgramar}>
            Ver em Programar
          </Botao>
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
          aoAbrirDia={(dia) => mudar({ modo: 'semana', ref: dia })}
          aoTocar={tocar}
        />
      )}
    </div>
  )
}

/** Uma barra: o pedido, na cor da situação, com a cor do caminhão na borda. */
function Barra({
  item,
  compacta = false,
  aoTocar,
}: {
  item: ItemCalendario
  compacta?: boolean
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
        'flex w-full min-w-0 items-center gap-1.5 rounded-dm border border-l-4 px-1.5 text-left text-xs leading-tight transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foco',
        compacta ? 'min-h-6 py-0.5' : 'min-h-11 py-1 @4xl:min-h-8',
        estilo.classe,
      )}
      style={item.caminhao_id ? { borderLeftColor: corDoCaminhao(item.caminhao_id) } : undefined}
    >
      {estilo.icone}
      <span className="min-w-0 truncate">
        <span className="font-semibold tabular-nums">{item.numero}</span>
        {item.bairro ? ` · ${item.bairro}` : ''}
        {!compacta && item.previsao ? ` · ${diaMes(item.previsao)}` : ''}
        {!compacta && item.detalhe ? ` · ${item.detalhe}` : ''}
      </span>
    </button>
  )
}

function Semana({
  dias,
  hoje,
  porData,
  extras,
  carregandoDia,
  aoVerMais,
  aoTocar,
}: {
  dias: string[]
  hoje: string
  porData: Map<string, DiaCalendario>
  extras: Record<string, ItemCalendario[]>
  carregandoDia?: string
  aoVerMais: (dia: string, jaTem: number) => void
  aoTocar: (dia: string, item: ItemCalendario) => void
}) {
  return (
    // Sete colunas só quando a ÁREA tem espaço (container, não janela — E-30);
    // estreito, os dias empilham (o celular rola para baixo).
    <div className="@container">
      <div className="grid grid-cols-1 gap-2 @4xl:grid-cols-7 @4xl:gap-0 @4xl:divide-x @4xl:divide-borda/60 @4xl:overflow-hidden @4xl:rounded-dm-lg @4xl:border @4xl:border-borda">
        {dias.map((dia, i) => {
          const doDia = porData.get(dia)
          const itens = [...(doDia?.itens ?? []), ...(extras[dia] ?? [])]
          const faltam = (doDia?.total ?? 0) - itens.length
          const ehHoje = dia === hoje
          return (
            <section
              key={dia}
              aria-label={`${DIAS_DA_SEMANA[i]}, ${diaCurto(dia)}${ehHoje ? ' (hoje)' : ''}`}
              className={cn(
                'flex min-w-0 flex-col gap-1.5 rounded-dm-lg border border-borda bg-superficie p-2 @4xl:min-h-72 @4xl:rounded-none @4xl:border-0',
                ehHoje && 'bg-acao/5',
              )}
            >
              <header className="flex items-baseline gap-2 @4xl:flex-col @4xl:gap-0">
                <span className="text-sm font-medium text-texto">{DIAS_DA_SEMANA[i]}</span>
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    ehHoje
                      ? 'rounded-full bg-acao px-1.5 font-semibold text-acao-texto'
                      : 'text-texto-suave',
                  )}
                >
                  {diaCurto(dia)}
                  {ehHoje ? ' · hoje' : ''}
                </span>
              </header>
              {itens.length === 0 && (
                <span className="text-xs text-texto-fraco @4xl:hidden">Nada neste dia</span>
              )}
              {itens.map((item) => (
                <Barra
                  key={`${item.situacao}-${item.card_id}`}
                  item={item}
                  aoTocar={() => aoTocar(dia, item)}
                />
              ))}
              {faltam > 0 && (
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  carregando={carregandoDia === dia}
                  onClick={() => aoVerMais(dia, itens.length)}
                >
                  +{faltam} {faltam === 1 ? 'pedido' : 'pedidos'}
                </Botao>
              )}
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
  aoAbrirDia,
  aoTocar,
}: {
  dias: string[]
  referencia: string
  hoje: string
  porData: Map<string, DiaCalendario>
  aoAbrirDia: (dia: string) => void
  aoTocar: (dia: string, item: ItemCalendario) => void
}) {
  return (
    <div className="@container">
      <div className="grid grid-cols-7 overflow-hidden rounded-dm-lg border border-borda">
        {DIAS_DA_SEMANA.map((d) => (
          <span
            key={d}
            className="border-b border-borda bg-superficie-sutil px-1 py-1 text-center text-xs font-medium text-texto-suave"
          >
            <span className="@3xl:hidden">{d.slice(0, 3)}</span>
            <span className="hidden @3xl:inline">{d.replace('-feira', '')}</span>
          </span>
        ))}
        {dias.map((dia) => {
          const doDia = porData.get(dia)
          const total = doDia?.total ?? 0
          const ehHoje = dia === hoje
          const doMes = mesmoMes(dia, referencia)
          return (
            <div
              key={dia}
              className={cn(
                'flex min-h-20 min-w-0 flex-col gap-1 border-b border-r border-borda/60 p-1 @3xl:min-h-28',
                !doMes && 'bg-superficie-sutil/50',
                ehHoje && 'bg-acao/5',
              )}
            >
              <button
                type="button"
                onClick={() => aoAbrirDia(dia)}
                aria-label={`Ver a semana de ${diaCurto(dia)}${total ? ` — ${total} ${total === 1 ? 'pedido' : 'pedidos'}` : ''}`}
                className={cn(
                  'self-start rounded-full px-1.5 text-xs tabular-nums hover:bg-superficie-sutil',
                  ehHoje
                    ? 'bg-acao font-semibold text-acao-texto'
                    : doMes
                      ? 'text-texto'
                      : 'text-texto-fraco',
                )}
              >
                {Number(dia.slice(8, 10))}
              </button>
              {/* Largo: as primeiras barras; estreito: os pontos coloridos e o número. */}
              <div className="hidden min-w-0 flex-col gap-0.5 @3xl:flex">
                {(doDia?.itens ?? []).map((item) => (
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
                  {SITUACOES.filter((s) => (doDia?.contagem?.[s.valor] ?? 0) > 0).map((s) => (
                    <span
                      key={s.valor}
                      className={cn('size-2 rounded-full', ESTILO[s.valor].ponto)}
                    />
                  ))}
                  <span className="text-[0.65rem] text-texto-suave tabular-nums">{total}</span>
                </span>
              )}
              {total > (doDia?.itens.length ?? 0) && (
                <button
                  type="button"
                  onClick={() => aoAbrirDia(dia)}
                  className="hidden self-start rounded-dm px-1 text-xs font-medium text-texto-suave hover:bg-superficie-sutil @3xl:inline"
                >
                  +{total - (doDia?.itens.length ?? 0)}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
