import { cn } from '@/lib/cn'

export interface MarcaProps {
  tamanho?: 'sm' | 'md' | 'lg' | 'xl'
  /** Em fundo grafite (padrão da logo), em fundo claro, ou em tom METÁLICO —
   *  a versão grande da tela de login (SESSAO-13, D-41). */
  sobre?: 'grafite' | 'claro' | 'metalico'
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
    xl: { topo: 'text-sm tracking-[0.55em] sm:text-base', nome: 'text-7xl sm:text-8xl' },
  }[tamanho]

  // O "metálico": gradiente dourado com brilho e sombra, recortado no texto.
  const metalico = {
    backgroundImage:
      'linear-gradient(160deg, #fdf0c7 0%, #f1c24b 28%, #b8851e 52%, #f8d264 70%, #94691c 100%)',
  }

  return (
    <span className={cn('inline-flex flex-col leading-none', className)}>
      <span
        className={cn('font-marca font-medium uppercase', escala.topo,
          sobre === 'metalico' ? 'text-marca-300' : 'text-marca-500')}
      >
        Móveis
      </span>
      <span
        className={cn(
          'font-marca font-bold lowercase',
          escala.nome,
          sobre === 'grafite' && 'text-white',
          sobre === 'claro' && 'text-grafite-900',
          sobre === 'metalico' &&
            'bg-clip-text text-transparent drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]',
        )}
        style={sobre === 'metalico' ? metalico : undefined}
      >
        domoby
      </span>
    </span>
  )
}
