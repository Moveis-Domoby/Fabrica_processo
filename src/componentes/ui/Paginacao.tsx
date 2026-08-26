import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Botao } from './Botao'
import { cn } from '@/lib/cn'

export interface PaginacaoProps {
  paginaAtual: number
  totalPaginas: number
  totalItens: number
  porPagina: number
  aoMudarPagina: (pagina: number) => void
  className?: string
}

/**
 * Controle de paginação. Vem embutido na `Tabela` — só use solto se estiver
 * paginando algo que não é tabela (grade de cards, por exemplo).
 */
export function Paginacao({
  paginaAtual,
  totalPaginas,
  totalItens,
  porPagina,
  aoMudarPagina,
  className,
}: PaginacaoProps) {
  const primeiro = totalItens === 0 ? 0 : (paginaAtual - 1) * porPagina + 1
  const ultimo = Math.min(paginaAtual * porPagina, totalItens)

  return (
    <nav
      aria-label="Paginação"
      className={cn(
        'flex flex-col items-center justify-between gap-3 border-t border-borda px-4 py-3 sm:flex-row',
        className,
      )}
    >
      <p className="text-sm text-texto-suave" aria-live="polite">
        Mostrando <strong className="text-texto">{primeiro}</strong>–
        <strong className="text-texto">{ultimo}</strong> de{' '}
        <strong className="text-texto">{totalItens}</strong>
      </p>

      <div className="flex items-center gap-2">
        <Botao
          variante="secundaria"
          tamanho="md"
          onClick={() => aoMudarPagina(paginaAtual - 1)}
          disabled={paginaAtual <= 1}
          icone={<ChevronLeft />}
        >
          Anterior
        </Botao>
        <span className="px-2 text-sm whitespace-nowrap text-texto-suave">
          Página <strong className="text-texto">{paginaAtual}</strong> de{' '}
          <strong className="text-texto">{Math.max(totalPaginas, 1)}</strong>
        </span>
        <Botao
          variante="secundaria"
          tamanho="md"
          onClick={() => aoMudarPagina(paginaAtual + 1)}
          disabled={paginaAtual >= totalPaginas}
        >
          Próxima
          <ChevronRight aria-hidden className="size-[1.15em]" />
        </Botao>
      </div>
    </nav>
  )
}
