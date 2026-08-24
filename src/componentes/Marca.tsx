import { cn } from '@/lib/cn'

export interface MarcaProps {
  tamanho?: 'sm' | 'md' | 'lg'
  /** Em fundo grafite (padrão da logo) ou em fundo claro. */
  sobre?: 'grafite' | 'claro'
  className?: string
}

/**
 * Assinatura tipográfica da Móveis Domoby, reconstruída com os tokens da marca.
 * Quando o arquivo oficial da logo entrar em `public/`, este componente passa a
 * renderizar a imagem — a API não muda.
 */
export function Marca({ tamanho = 'md', sobre = 'grafite', className }: MarcaProps) {
  const escala = {
    sm: { topo: 'text-[0.5rem] tracking-[0.42em]', nome: 'text-xl' },
    md: { topo: 'text-[0.625rem] tracking-[0.45em]', nome: 'text-3xl' },
    lg: { topo: 'text-xs tracking-[0.5em]', nome: 'text-5xl' },
  }[tamanho]

  return (
    <span className={cn('inline-flex flex-col leading-none', className)}>
      <span className={cn('font-marca font-medium text-marca-500 uppercase', escala.topo)}>
        Móveis
      </span>
      <span
        className={cn(
          'font-marca font-bold lowercase',
          escala.nome,
          sobre === 'grafite' ? 'text-white' : 'text-grafite-900',
        )}
      >
        domoby
      </span>
    </span>
  )
}
