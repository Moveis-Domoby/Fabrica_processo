import { cn } from '@/lib/cn'
import { urlDaFoto } from '@/perfil/api'

/** As iniciais do nome (até duas letras) — a mesma régua do chat. */
function iniciaisDoNome(nome: string | null): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return ''
  const primeira = partes[0][0] ?? ''
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? '') : ''
  return (primeira + ultima).toUpperCase()
}

export interface AvatarPessoaProps {
  nome: string | null
  foto?: string | null
  tamanho?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * SESSAO-36 (D-146): o rosto ÚNICO da casa — a foto do cadastro (bucket
 * plt-imagens) ou as iniciais. Decorativo: o nome sempre vem escrito ao lado
 * (ou no texto acessível de quem o usa). Todo ícone de pessoa da plataforma
 * passa a usar este componente.
 */
export function AvatarPessoa({ nome, foto, tamanho = 'md', className }: AvatarPessoaProps) {
  const caixa = cn(
    'inline-flex shrink-0 items-center justify-center rounded-full',
    tamanho === 'xs' && 'size-6 text-[10px]',
    tamanho === 'sm' && 'size-8 text-xs',
    tamanho === 'md' && 'size-10 text-sm',
    tamanho === 'lg' && 'size-14 text-base',
    className,
  )
  const url = urlDaFoto(foto ?? null)
  if (url) {
    return <img src={url} alt="" className={cn(caixa, 'border border-borda object-cover')} />
  }
  return (
    <span aria-hidden className={cn(caixa, 'bg-superficie-sutil font-semibold text-texto-suave')}>
      {iniciaisDoNome(nome) || '?'}
    </span>
  )
}
