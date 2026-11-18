import { memo } from 'react'
import { PackageCheck } from 'lucide-react'
import { cn } from '@/lib/cn'
import { textoEntregueEmParte } from '@/kanban/entregaParcial'
import type { EntregueEmParte } from './api'

/**
 * O selo "Entregue em parte (N de M)" — o MESMO do card do PCP (a cor, o ícone
 * e o texto) — e, quando há, a pílula "K ainda em produção" da ficha do pedido.
 * Ícone + texto, nunca só a cor. Some quando a porta não manda nada.
 */
export const SeloEntregueEmParte = memo(function SeloEntregueEmParte({
  parcial,
  className,
}: {
  parcial: EntregueEmParte | null | undefined
  className?: string
}) {
  if (!parcial) return null
  const naFabrica = parcial.ainda_producao ?? 0
  return (
    <span className={cn('inline-flex max-w-full flex-wrap items-center gap-1', className)}>
      <span className="inline-flex items-center gap-1 rounded-full bg-info-fundo px-2 py-0.5 text-xs font-medium text-info-texto tabular-nums">
        <PackageCheck aria-hidden className="size-3.5 shrink-0" />
        {textoEntregueEmParte(parcial.entregues, parcial.total)}
      </span>
      {naFabrica > 0 && (
        <span className="rounded-full border border-borda bg-superficie px-2 py-0.5 text-xs font-normal text-texto-suave tabular-nums">
          {naFabrica} ainda em produção
        </span>
      )}
    </span>
  )
})
