import type { ReactNode } from 'react'

/**
 * Tooltip padrão dos gráficos Recharts da casa (regra 7 do LEIA-ME: hover em
 * tudo). Cores só por token semântico — o tooltip acompanha o tema.
 * `linhas` já vem formatada por quem conhece o dado (duração, contagem, %).
 */
export function TooltipGrafico({
  titulo,
  linhas,
}: {
  titulo?: ReactNode
  linhas: { cor?: string; rotulo: string; valor: ReactNode }[]
}) {
  return (
    <div className="rounded-dm border border-borda bg-superficie px-3 py-2 shadow-lg">
      {titulo !== undefined && (
        <p className="mb-1 text-xs font-medium text-texto-suave">{titulo}</p>
      )}
      {linhas.map((l) => (
        <p key={l.rotulo} className="flex items-center gap-2 text-sm text-texto">
          {l.cor && (
            <span
              aria-hidden
              className="inline-block size-2.5 rounded-full"
              style={{ background: l.cor }}
            />
          )}
          <span className="text-texto-suave">{l.rotulo}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums">{l.valor}</span>
        </p>
      ))}
    </div>
  )
}
