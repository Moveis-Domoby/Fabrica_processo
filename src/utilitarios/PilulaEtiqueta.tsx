import { Tag } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useEtiquetas } from './consultas'
import { CLASSE_ETIQUETA } from './tipos'
import type { Etiqueta } from './tipos'

/** A etiqueta como pílula: ícone + NOME + cor (nunca só cor — M-12). */
export function PilulaEtiqueta({
  etiqueta,
  tamanho = 'sm',
}: {
  etiqueta: Pick<Etiqueta, 'nome' | 'cor'>
  tamanho?: 'sm' | 'galpao'
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border font-medium',
        CLASSE_ETIQUETA[etiqueta.cor],
        tamanho === 'galpao' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs',
      )}
    >
      <Tag aria-hidden className={tamanho === 'galpao' ? 'size-4 shrink-0' : 'size-3.5 shrink-0'} />
      <span className="truncate">{etiqueta.nome}</span>
    </span>
  )
}

/** As etiquetas de um card (ids da projeção `plt_cards.etiquetas`) em pílulas. */
export function EtiquetasDoCard({ ids, tamanho = 'sm' }: { ids: number[] | null | undefined; tamanho?: 'sm' | 'galpao' }) {
  const { data: catalogo = [] } = useEtiquetas()
  if (!ids || ids.length === 0 || catalogo.length === 0) return null
  const porId = new Map(catalogo.map((e) => [e.id, e]))
  const doCard = ids.map((id) => porId.get(Number(id))).filter((e): e is Etiqueta => Boolean(e))
  if (doCard.length === 0) return null
  return (
    <span className="flex flex-wrap gap-1" aria-label="Etiquetas">
      {doCard.map((e) => (
        <PilulaEtiqueta key={e.id} etiqueta={e} tamanho={tamanho} />
      ))}
    </span>
  )
}
