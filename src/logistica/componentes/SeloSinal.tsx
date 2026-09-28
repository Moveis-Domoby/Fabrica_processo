import { CircleCheck, CircleSlash, OctagonAlert, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { SinalProduto, TomSinal } from '@/logistica/estoque'

/** Ícone + cores de cada sinal — estado nunca só por cor (M-12). */
const ESTILO_SINAL: Record<TomSinal, { classe: string; Icone: typeof CircleCheck }> = {
  sem_estoque: { classe: 'bg-danificado-fundo text-danificado-texto', Icone: OctagonAlert },
  abaixo: { classe: 'bg-atencao-fundo text-atencao-texto', Icone: TriangleAlert },
  ok: { classe: 'bg-perfeito-fundo text-perfeito-texto', Icone: CircleCheck },
  neutro: { classe: 'bg-superficie-sutil text-texto-suave', Icone: CircleSlash },
}

export function SeloSinal({ sinal, className }: { sinal: SinalProduto; className?: string }) {
  const { classe, Icone } = ESTILO_SINAL[sinal.tom]
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        classe,
        className,
      )}
    >
      <Icone aria-hidden className="size-3.5 shrink-0" />
      {sinal.texto}
    </span>
  )
}
