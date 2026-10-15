import { useEffect, useState } from 'react'

/**
 * Paginação por ROLAGEM (rodada do dono, 30/09): quando esta âncora entra na
 * tela e ainda há mais, pede a página seguinte — sem botão. O setState roda no
 * callback do observador (gesto do navegador), não no corpo do efeito.
 * (Saiu do PCP em 14/10: a área Pedidos usa a mesma.)
 */
export function MaisAoRolar({
  temMais,
  carregando,
  aoChegar,
}: {
  temMais: boolean
  carregando: boolean
  aoChegar: () => void
}) {
  const [ancora, setAncora] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!ancora || !temMais || carregando) return
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) aoChegar()
      },
      { rootMargin: '200px' },
    )
    observador.observe(ancora)
    return () => observador.disconnect()
  }, [ancora, temMais, carregando, aoChegar])

  if (!temMais) return null
  return (
    <div ref={setAncora} aria-hidden className="flex h-10 items-center justify-center">
      {carregando && <p className="text-sm text-texto-fraco">Carregando mais…</p>}
    </div>
  )
}
