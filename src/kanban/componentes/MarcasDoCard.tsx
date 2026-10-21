import { ArrowDownAZ, CalendarClock, Flag } from 'lucide-react'
import { cn } from '@/lib/cn'
import { corDoPrazo, diaDoPrazo, diasAte, textoDoPrazo } from '../prazo'
import { PRIORIDADES, ROTULO_ORDEM, ROTULO_PRIORIDADE, proximaOrdem } from '../prioridade'
import type { OrdemDaFila, Prioridade } from '../prioridade'

/**
 * SESSAO-38 (pedido do dono — D-150/D-154): as marcas do card de produção.
 * Classes do Tailwind por extenso (A-07); estado nunca só por cor (M-12) — o
 * texto vai no nome acessível e na dica do mouse.
 */

const FUNDO_PRAZO = {
  verde: 'border-perfeito-borda bg-perfeito-fundo text-perfeito-texto',
  amarelo: 'border-atencao-borda bg-atencao-fundo text-atencao-texto',
  // vermelho forte e chamativo: fundo cheio + pulso suave (só para quem não
  // pediu menos movimento no aparelho)
  vermelho: 'border-danificado-forte bg-danificado-forte text-white motion-safe:animate-pulse',
} as const

/** Só a data da entrega — a cor diz quanto falta (verde > 3 dias · amarelo 2–3 · vermelho ≤ 1). */
export function ChipPrazo({
  data,
  agora,
  tamanho = 'padrao',
}: {
  data: string | null | undefined
  agora: number
  tamanho?: 'padrao' | 'galpao'
}) {
  if (!data) return null
  const cor = corDoPrazo(diasAte(data, agora))
  const texto = textoDoPrazo(data, agora)
  return (
    <span
      role="img"
      aria-label={texto}
      title={texto}
      data-cor={cor}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border font-semibold tabular-nums',
        tamanho === 'galpao' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs',
        FUNDO_PRAZO[cor],
      )}
    >
      <CalendarClock aria-hidden className={tamanho === 'galpao' ? 'size-4' : 'size-3.5'} />
      {diaDoPrazo(data, agora)}
    </span>
  )
}

const COR_PONTO: Record<Prioridade, string> = {
  urgente: 'bg-danificado-forte ring-2 ring-danificado-borda',
  atencao: 'bg-atencao-forte',
  comum: 'bg-perfeito-forte',
}

function Bolinha({
  prioridade,
  tamanho,
}: {
  prioridade: Prioridade
  tamanho: 'padrao' | 'galpao'
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block shrink-0 rounded-full',
        tamanho === 'galpao' ? 'size-3.5' : 'size-2.5',
        COR_PONTO[prioridade],
      )}
    />
  )
}

/** A bolinha da prioridade (vermelha · amarela · verde), com o nome para o leitor de tela. */
export function PontoPrioridade({
  prioridade,
  tamanho = 'padrao',
  comTexto = false,
}: {
  prioridade: Prioridade
  tamanho?: 'padrao' | 'galpao'
  /** Urgente também por escrito (urgência tem de ser urgente — pedido do dono). */
  comTexto?: boolean
}) {
  const rotulo = `Prioridade: ${ROTULO_PRIORIDADE[prioridade]}`
  const ponto = <Bolinha prioridade={prioridade} tamanho={tamanho} />
  if (comTexto && prioridade === 'urgente') {
    return (
      <span
        title={rotulo}
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full bg-danificado-fundo font-bold tracking-wide text-danificado-texto uppercase',
          tamanho === 'galpao' ? 'px-2 py-0.5 text-sm' : 'px-1.5 py-0.5 text-[11px]',
        )}
      >
        {ponto}
        Urgente
      </span>
    )
  }
  return (
    <span role="img" aria-label={rotulo} title={rotulo} className="inline-flex items-center">
      {ponto}
    </span>
  )
}

const ICONE_ORDEM = {
  prioridade: Flag,
  entrega: CalendarClock,
  alfabetica: ArrowDownAZ,
} as const

/**
 * O organizador da fila: UM botão só com o ícone da ordem atual (sem texto —
 * pedido do dono); cada toque passa para a próxima. O nome vai para o leitor
 * de tela e para a dica do mouse.
 */
export function BotaoOrdemFila({
  ordem,
  aoMudar,
  className,
}: {
  ordem: OrdemDaFila
  aoMudar: (o: OrdemDaFila) => void
  className?: string
}) {
  const Icone = ICONE_ORDEM[ordem]
  const proxima = proximaOrdem(ordem)
  const rotulo = `${ROTULO_ORDEM[ordem]}. Toque para: ${ROTULO_ORDEM[proxima].toLowerCase()}`
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      data-ordem={ordem}
      onClick={() => aoMudar(proxima)}
      className={cn(
        'inline-flex size-toque-md shrink-0 items-center justify-center rounded-dm border border-borda-forte bg-superficie text-texto hover:bg-superficie-sutil',
        className,
      )}
    >
      <Icone aria-hidden className="size-5" />
    </button>
  )
}

/** Escolher a prioridade: três toques grandes (urgente · atenção · comum). */
export function SeletorPrioridade({
  valor,
  aoMudar,
  desabilitado = false,
  compacto = false,
}: {
  valor: Prioridade
  aoMudar: (p: Prioridade) => void
  desabilitado?: boolean
  /** No card do PCP: só as bolinhas (o nome no leitor de tela e na dica). */
  compacto?: boolean
}) {
  return (
    <div role="radiogroup" aria-label="Prioridade" className="flex flex-wrap gap-1.5">
      {PRIORIDADES.map((p) => {
        const marcado = valor === p
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={marcado}
            aria-label={compacto ? ROTULO_PRIORIDADE[p] : undefined}
            title={compacto ? ROTULO_PRIORIDADE[p] : undefined}
            disabled={desabilitado}
            onClick={(e) => {
              e.stopPropagation()
              if (!marcado) aoMudar(p)
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className={cn(
              'inline-flex min-h-toque-md items-center justify-center gap-1.5 rounded-full border text-sm font-medium disabled:opacity-60',
              compacto ? 'min-w-toque-md px-2' : 'px-3',
              marcado
                ? 'border-acao-ativa bg-superficie-sutil text-texto ring-2 ring-acao'
                : 'border-borda-forte bg-superficie text-texto-suave hover:bg-superficie-sutil',
            )}
          >
            <Bolinha prioridade={p} tamanho="padrao" />
            {!compacto && ROTULO_PRIORIDADE[p]}
          </button>
        )
      })}
    </div>
  )
}
