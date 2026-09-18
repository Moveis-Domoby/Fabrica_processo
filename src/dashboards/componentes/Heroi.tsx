import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Número-herói dos dashboards (regra 1 do LEIA-ME de _docs/Plataforma/Inspiracao/dashboards):
 * se a pergunta tem UMA resposta, a resposta é um número grande com contexto
 * embaixo — não um gráfico. O tamanho vem de container query (.num-bloco +
 * .num-heroi), nunca de breakpoint de viewport (lição E-30 da SESSAO-20).
 */
export function Heroi({
  rotulo,
  valor,
  detalhe,
  icone,
  tom = 'padrao',
  className,
}: {
  rotulo: string
  valor: ReactNode
  detalhe?: ReactNode
  icone?: ReactNode
  tom?: 'padrao' | 'danificado'
  className?: string
}) {
  return (
    <div
      className={cn(
        'num-bloco flex flex-col gap-1 rounded-dm-lg border border-borda bg-superficie p-4 sm:p-5',
        className,
      )}
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-texto-suave uppercase">
        {icone}
        {rotulo}
      </p>
      <p
        className={cn(
          'num-heroi mt-auto font-semibold tabular-nums',
          tom === 'danificado' ? 'text-danificado-forte' : 'text-texto',
        )}
      >
        {valor}
      </p>
      {detalhe !== undefined && <div className="text-sm text-texto-suave">{detalhe}</div>}
    </div>
  )
}
