import { memo } from 'react'
import { CheckCircle2, ClipboardList, Hammer } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { EstadoPedido } from './api'
import { textoDoEstado } from './estadoPedido'

const ESTILO: Record<EstadoPedido, string> = {
  pronto: 'border-perfeito-borda bg-perfeito-fundo text-perfeito-texto',
  entregue: 'border-perfeito-borda bg-perfeito-fundo text-perfeito-texto',
  em_producao: 'border-atencao-borda bg-atencao-fundo text-atencao-texto',
  no_pcp: 'border-borda bg-superficie-sutil text-texto-suave',
}

/**
 * O selo pequeno do estado do pedido (SESSAO-38 · D-156): pronto · em produção
 * · ainda no PCP. Texto sempre junto do ícone (M-12: estado nunca só por cor).
 * Some quando a porta não manda o estado.
 */
export const SeloEstado = memo(function SeloEstado({
  estado,
  prontas,
  total,
  className,
}: {
  estado: EstadoPedido | null | undefined
  prontas?: number
  total?: number
  className?: string
}) {
  const texto = textoDoEstado(estado, prontas, total)
  if (!estado || !texto) return null
  const Icone =
    estado === 'pronto' || estado === 'entregue'
      ? CheckCircle2
      : estado === 'no_pcp'
        ? ClipboardList
        : Hammer
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums',
        ESTILO[estado],
        className,
      )}
    >
      <Icone aria-hidden className="size-3.5" />
      {texto}
    </span>
  )
})
