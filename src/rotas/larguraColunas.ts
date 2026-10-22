import { useCallback, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { flushSync } from 'react-dom'

/**
 * AS LARGURAS DAS COLUNAS do calendário, como nas planilhas (Excel/Sheets —
 * pedido do dono, 22/10): arrastar a divisória no cabeçalho de um dia alarga
 * ou estreita aquela coluna; DOIS CLIQUES na divisória ajustam a coluna ao
 * maior texto dela. Começa com as colunas iguais (dividindo a área); ao mexer,
 * cada coluna passa a ter a sua largura (a grade pode rolar para o lado). A
 * escolha fica guardada no aparelho — é conveniência de quem olha, não dado
 * (nenhuma requisição).
 */

export const LARGURA_MINIMA = 80
export const LARGURA_MAXIMA = 640
const PASSO_TECLADO = 16

export function limitarLargura(px: number): number {
  return Math.round(Math.min(LARGURA_MAXIMA, Math.max(LARGURA_MINIMA, px)))
}

/** O que veio guardado no aparelho — só vale uma lista com um número por coluna. */
export function lerLarguras(texto: string | null, colunas: number): number[] | null {
  if (!texto) return null
  try {
    const v: unknown = JSON.parse(texto)
    if (
      !Array.isArray(v) ||
      v.length !== colunas ||
      !v.every((x) => typeof x === 'number' && Number.isFinite(x))
    )
      return null
    return v.map(limitarLargura)
  } catch {
    return null
  }
}

/**
 * O modelo da grade: as colunas iguais ou a largura de cada uma; a coluna que
 * está sendo ajustada pelos dois cliques fica em `max-content` por um instante
 * — o navegador diz a largura do maior texto, e ela vira a largura da coluna.
 */
export function modeloDaGrade(
  larguras: number[] | null,
  colunas: number,
  medindo: number | null = null,
): string {
  if (!larguras) return `repeat(${colunas}, minmax(0, 1fr))`
  return larguras.map((w, i) => (i === medindo ? 'max-content' : `${w}px`)).join(' ')
}

function guardar(chave: string, v: number[] | null) {
  try {
    if (v) localStorage.setItem(chave, JSON.stringify(v))
    else localStorage.removeItem(chave)
  } catch {
    /* aparelho sem onde guardar: vale só enquanto a tela está aberta */
  }
}

export interface LargurasDasColunas {
  /** As colunas têm larguras próprias (alguém mexeu). */
  personalizadas: boolean
  /** O `grid-template-columns` da grade. */
  modelo: string
  /** O elemento cuja largura é a da coluna (para medir). */
  refColuna: (i: number) => (el: HTMLElement | null) => void
  /** Os gestos da divisória da coluna i (arrastar, dois cliques, setas). */
  divisoria: (i: number) => {
    role: 'separator'
    'aria-orientation': 'vertical'
    'aria-valuemin': number
    'aria-valuemax': number
    'aria-valuenow': number | undefined
    tabIndex: number
    onPointerDown: (e: PointerEvent<HTMLElement>) => void
    onPointerMove: (e: PointerEvent<HTMLElement>) => void
    onPointerUp: (e: PointerEvent<HTMLElement>) => void
    onPointerCancel: (e: PointerEvent<HTMLElement>) => void
    onDoubleClick: () => void
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
  }
  /** De volta às colunas iguais. */
  restaurar: () => void
}

export function useLargurasDasColunas(chave: string, colunas = 7): LargurasDasColunas {
  const [larguras, setLarguras] = useState<number[] | null>(() => {
    try {
      return lerLarguras(localStorage.getItem(chave), colunas)
    } catch {
      return null
    }
  })
  const [medindo, setMedindo] = useState<number | null>(null)
  const refs = useRef<(HTMLElement | null)[]>([])
  const arrasto = useRef<{ i: number; x: number; base: number[]; ultima: number[] } | null>(null)

  const medirTodas = useCallback(
    () =>
      Array.from({ length: colunas }, (_, i) =>
        limitarLargura(refs.current[i]?.getBoundingClientRect().width ?? 0),
      ),
    [colunas],
  )

  // Dois cliques: a coluna em max-content por um instante (síncrono), mede, fixa.
  const autoAjustar = useCallback(
    (i: number) => {
      const base = larguras ?? medirTodas()
      flushSync(() => {
        setLarguras(base)
        setMedindo(i)
      })
      const medida = refs.current[i]?.getBoundingClientRect().width
      const v = [...base]
      if (medida) v[i] = limitarLargura(Math.ceil(medida))
      setMedindo(null)
      setLarguras(v)
      guardar(chave, v)
    },
    [chave, larguras, medirTodas],
  )

  const fimDoArrasto = (e: PointerEvent<HTMLElement>) => {
    const a = arrasto.current
    if (!a) return
    arrasto.current = null
    document.documentElement.style.removeProperty('cursor')
    if (e.currentTarget.hasPointerCapture?.(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId)
    // só guarda se arrastou de verdade (um clique solto não vira "personalizado")
    if (a.ultima !== a.base) guardar(chave, a.ultima)
  }

  return {
    personalizadas: larguras !== null,
    modelo: modeloDaGrade(larguras, colunas, medindo),
    refColuna: (i) => (el) => {
      refs.current[i] = el
    },
    divisoria: (i) => ({
      role: 'separator',
      'aria-orientation': 'vertical',
      'aria-valuemin': LARGURA_MINIMA,
      'aria-valuemax': LARGURA_MAXIMA,
      'aria-valuenow': larguras?.[i],
      tabIndex: 0,
      onPointerDown: (e) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.currentTarget.setPointerCapture?.(e.pointerId)
        // Nada muda só por apertar: o 1º clique de um "dois cliques" não pode
        // mexer na tela (senão o 2º cai fora da divisória).
        const base = larguras ?? medirTodas()
        arrasto.current = { i, x: e.clientX, base, ultima: base }
        document.documentElement.style.cursor = 'col-resize'
      },
      onPointerMove: (e) => {
        const a = arrasto.current
        if (!a || e.clientX === a.x) return
        const v = [...a.base]
        v[a.i] = limitarLargura(a.base[a.i] + e.clientX - a.x)
        a.ultima = v
        setLarguras(v)
      },
      onPointerUp: fimDoArrasto,
      onPointerCancel: fimDoArrasto,
      onDoubleClick: () => autoAjustar(i),
      onKeyDown: (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          autoAjustar(i)
          return
        }
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
        e.preventDefault()
        const passo = (e.shiftKey ? 3 : 1) * PASSO_TECLADO * (e.key === 'ArrowRight' ? 1 : -1)
        const base = larguras ?? medirTodas()
        const v = [...base]
        v[i] = limitarLargura(base[i] + passo)
        setLarguras(v)
        guardar(chave, v)
      },
    }),
    restaurar: () => {
      setLarguras(null)
      guardar(chave, null)
    },
  }
}
