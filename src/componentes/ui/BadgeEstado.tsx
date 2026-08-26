import type { ReactNode } from 'react'
import { AlertTriangle, CircleCheck, Info, Minus, XOctagon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ROTULO_ESTADO, type Estado } from './estados'

const ICONES: Record<Estado, ReactNode> = {
  perfeito: <CircleCheck aria-hidden />,
  atencao: <AlertTriangle aria-hidden />,
  danificado: <XOctagon aria-hidden />,
  informativo: <Info aria-hidden />,
  neutro: <Minus aria-hidden />,
}

const CORES: Record<Estado, string> = {
  perfeito: 'bg-perfeito-fundo border-perfeito-borda text-perfeito-texto',
  atencao: 'bg-atencao-fundo border-atencao-borda text-atencao-texto',
  danificado: 'bg-danificado-fundo border-danificado-borda text-danificado-texto',
  informativo: 'bg-info-fundo border-info-borda text-info-texto',
  neutro: 'bg-superficie-sutil border-borda text-texto-suave',
}

export interface BadgeEstadoProps {
  estado: Estado
  /** Sobrescreve o rótulo padrão — use com parcimônia. */
  rotulo?: string
  tamanho?: 'sm' | 'md' | 'galpao'
  className?: string
}

/**
 * Selo de estado. NUNCA comunica estado só pela cor: ícone + texto sempre
 * juntos (daltonismo é comum e a iluminação do galpão é ruim).
 */
export function BadgeEstado({ estado, rotulo, tamanho = 'md', className }: BadgeEstadoProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        CORES[estado],
        tamanho === 'sm' && 'px-2 py-0.5 text-xs [&>svg]:size-3.5',
        tamanho === 'md' && 'px-2.5 py-1 text-sm [&>svg]:size-4',
        tamanho === 'galpao' && 'px-4 py-2 text-lg [&>svg]:size-6',
        className,
      )}
    >
      {ICONES[estado]}
      {rotulo ?? ROTULO_ESTADO[estado]}
    </span>
  )
}
