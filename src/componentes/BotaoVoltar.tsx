import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router'
import { cn } from '@/lib/cn'
import { ROTA_INICIAL } from '@/navegacao/rotas'

/**
 * O voltar de toda tela (D-36). ↩️ Ajuste do dono (06/11 — cabeçalhos
 * compactos): deixou de ser uma linha própria em cima da tela e virou a
 * setinha à esquerda do título, dentro do `CabecalhoDaTela`. Volta à aba
 * anterior; sem histórico, vai para a casa. Desenho pequeno, alvo de 44 px
 * (`toque-seguro`).
 */
export function BotaoVoltar({ className }: { className?: string }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      aria-label="Voltar"
      title="Voltar"
      onClick={() => {
        const historico = (window.history.state as { idx?: number } | null)?.idx ?? 0
        if (historico > 0) navigate(-1)
        else navigate(ROTA_INICIAL)
      }}
      className={cn(
        'toque-seguro -ml-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-dm text-texto-suave transition-colors hover:bg-superficie-sutil hover:text-texto',
        className,
      )}
    >
      <ArrowLeft aria-hidden className="size-5" />
    </button>
  )
}
