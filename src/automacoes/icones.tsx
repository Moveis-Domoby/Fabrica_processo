import type { ReactNode } from 'react'
import { Archive, ArchiveRestore, Bell, Filter, Hourglass, ListPlus, MoveRight, Tag, TagX, Webhook } from 'lucide-react'
import type { TipoPasso } from './catalogo'

/** O ícone de cada bloco FAÇA (SESSAO-27) — o mesmo no canvas, no painel e na escolha do bloco. */
export const ICONE_PASSO: Record<TipoPasso, ReactNode> = {
  mover: <MoveRight aria-hidden className="size-4" />,
  arquivar: <Archive aria-hidden className="size-4" />,
  desarquivar: <ArchiveRestore aria-hidden className="size-4" />,
  etiqueta_por: <Tag aria-hidden className="size-4" />,
  etiqueta_tirar: <TagX aria-hidden className="size-4" />,
  campo: <ListPlus aria-hidden className="size-4" />,
  avisar: <Bell aria-hidden className="size-4" />,
  chamar: <Webhook aria-hidden className="size-4" />,
  esperar: <Hourglass aria-hidden className="size-4" />,
  se: <Filter aria-hidden className="size-4" />,
}
