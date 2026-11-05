import { Bug, CircleCheckBig, CornerUpLeft, FlaskConical, Hammer, Inbox, Lightbulb, ListTodo, Sparkles, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { faixaDoNivel, ROTULO_TIPO, TITULO_COLUNA } from './regras'
import type { ColunaSugestao, TesteSugestao, TipoSugestao } from './regras'

/** Os selos da sugestão: ícone + texto, nunca só cor (M-12). */
function Selo({ icone, children, className }: { icone?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'relative inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium [&>svg]:size-3.5 [&>svg]:shrink-0',
        className,
      )}
    >
      {icone}
      {children}
    </span>
  )
}

const ICONE_COLUNA: Record<ColunaSugestao, ReactNode> = {
  solicitacoes: <Inbox aria-hidden />,
  backlog: <ListTodo aria-hidden />,
  fazendo: <Hammer aria-hidden />,
  finalizada: <CircleCheckBig aria-hidden />,
  recusada: <XCircle aria-hidden />,
}

const TOM_COLUNA: Record<ColunaSugestao, string> = {
  solicitacoes: 'bg-superficie-sutil text-texto',
  backlog: 'bg-superficie-sutil text-texto',
  fazendo: 'bg-info-fundo text-info-texto',
  finalizada: 'bg-perfeito-fundo text-perfeito-texto',
  recusada: 'bg-danificado-fundo text-danificado-texto',
}

export function SeloColuna({ coluna }: { coluna: ColunaSugestao }) {
  return (
    <Selo icone={ICONE_COLUNA[coluna]} className={TOM_COLUNA[coluna]}>
      {TITULO_COLUNA[coluna]}
    </Selo>
  )
}

const ICONE_TIPO: Record<TipoSugestao, ReactNode> = {
  bug: <Bug aria-hidden />,
  melhoria: <Sparkles aria-hidden />,
  novidade: <Lightbulb aria-hidden />,
}

/** Só o ícone do tipo (o cartão do quadro põe o nome ao lado). */
export function IconeTipo({ tipo }: { tipo: TipoSugestao }) {
  return ICONE_TIPO[tipo]
}

export function SeloTipo({ tipo }: { tipo: TipoSugestao }) {
  return (
    <Selo icone={ICONE_TIPO[tipo]} className="border border-borda bg-superficie text-texto">
      {ROTULO_TIPO[tipo]}
    </Selo>
  )
}

const TOM_NIVEL = {
  baixo: 'bg-superficie-sutil text-texto-suave',
  medio: 'bg-info-fundo text-info-texto',
  alto: 'bg-prazo-amarelo-fundo text-prazo-amarelo-texto',
  urgente: 'bg-danificado-fundo text-danificado-texto',
} as const

export function SeloNivel({ nivel, curto = false }: { nivel: number; curto?: boolean }) {
  const faixa = faixaDoNivel(nivel)
  return (
    <Selo className={cn('tabular-nums', TOM_NIVEL[faixa.tom])}>
      <span aria-hidden className="font-bold">
        {nivel}
      </span>
      <span className={cn(curto && 'sr-only')}>
        {curto ? `Nível ${nivel} — ${faixa.rotulo}` : `· ${faixa.rotulo}`}
      </span>
    </Selo>
  )
}

export function SeloTeste({ teste }: { teste: NonNullable<TesteSugestao> }) {
  if (teste === 'aguardando')
    return (
      <Selo icone={<FlaskConical aria-hidden />} className="bg-info-fundo text-info-texto">
        Esperando o teste
      </Selo>
    )
  if (teste === 'aprovada')
    return (
      <Selo icone={<CircleCheckBig aria-hidden />} className="bg-perfeito-fundo text-perfeito-texto">
        Aprovada por quem sugeriu
      </Selo>
    )
  return (
    <Selo icone={<CornerUpLeft aria-hidden />} className="bg-atencao-fundo text-atencao-texto">
      Devolvida
    </Selo>
  )
}
