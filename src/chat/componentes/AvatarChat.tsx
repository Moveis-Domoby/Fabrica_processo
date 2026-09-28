import { Hash, Megaphone } from 'lucide-react'
import { cn } from '@/lib/cn'
import { urlDaFoto } from '@/perfil/api'
import { iniciais } from '../formato'
import type { TipoConversa } from '../tipos'

/**
 * O rosto de uma conversa ou pessoa: foto (ou iniciais) para gente, ícone
 * para canal (#) e para os Avisos gerais (megafone). Decorativo — o nome
 * sempre vem escrito ao lado.
 */
export function AvatarChat({
  tipo = 'particular',
  nome,
  foto,
  tamanho = 'md',
}: {
  tipo?: TipoConversa
  nome: string | null
  foto?: string | null
  tamanho?: 'sm' | 'md'
}) {
  const caixa = cn(
    'inline-flex shrink-0 items-center justify-center rounded-full',
    tamanho === 'sm' ? 'size-8 text-xs' : 'size-10 text-sm',
  )
  if (tipo === 'canal') {
    return (
      <span aria-hidden className={cn(caixa, 'border border-borda bg-superficie-sutil text-texto-suave')}>
        <Hash className="size-5" />
      </span>
    )
  }
  if (tipo === 'avisos') {
    return (
      <span aria-hidden className={cn(caixa, 'border-2 border-acao-ativa bg-superficie-sutil text-texto')}>
        <Megaphone className="size-5" />
      </span>
    )
  }
  const url = urlDaFoto(foto ?? null)
  if (url) {
    return <img src={url} alt="" className={cn(caixa, 'border border-borda object-cover')} />
  }
  return (
    <span aria-hidden className={cn(caixa, 'bg-superficie-sutil font-semibold text-texto-suave')}>
      {iniciais(nome) || '?'}
    </span>
  )
}
