import { MapPinPen } from 'lucide-react'
import { cn } from '@/lib/cn'
import { enderecoEmLinha } from './enderecoDoPedido'
import type { SeloEndereco } from './enderecoDoPedido'

/**
 * SESSAO-50 (bloco C): o selo discreto "Endereço alterado na plataforma", com o
 * original do Tiny visível ao lado — ícone + texto, nunca só a cor (M-12).
 * Depois que o Tiny confirmou (o endereço da plataforma voltou de lá), o selo
 * diz "salvo também no Tiny" e o de antes vira "Antes: …".
 */
export function SeloEnderecoAlterado({
  selo,
  className,
}: {
  selo: SeloEndereco
  className?: string
}) {
  const confirmado = !!selo.tiny_confirmado_em
  return (
    <span className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs', className)}>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-info-borda bg-info-fundo px-2 py-0.5 font-medium text-info-texto">
        <MapPinPen aria-hidden className="size-3.5 shrink-0" />
        {confirmado
          ? 'Endereço alterado (salvo também no Tiny)'
          : 'Endereço alterado na plataforma'}
      </span>
      <span className="min-w-0 break-words text-texto-suave">
        {confirmado ? 'Antes: ' : 'No Tiny: '}
        {enderecoEmLinha(selo.original)}
      </span>
    </span>
  )
}
