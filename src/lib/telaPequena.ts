import { useSyncExternalStore } from 'react'

/** Celular e tablet em pé — onde o menu é gaveta (abaixo do `lg` do Tailwind). */
const CONSULTA = '(max-width: 1023.98px)'

function consulta(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(CONSULTA)
    : null
}

function assinar(aviso: () => void) {
  const m = consulta()
  m?.addEventListener('change', aviso)
  return () => m?.removeEventListener('change', aviso)
}

/** A tela é de celular/tablet em pé? Muda junto com a tela (girar, redimensionar). */
export function useTelaPequena(): boolean {
  return useSyncExternalStore(
    assinar,
    () => consulta()?.matches ?? false,
    () => false,
  )
}
