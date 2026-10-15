import { useRef, useState } from 'react'
import type { MouseEvent as EventoMouse, PointerEvent as EventoPonteiro } from 'react'
import { MouseSensor } from '@dnd-kit/core'
import type { MouseSensorOptions } from '@dnd-kit/core'

/** O que não pode virar "arrastar o quadro": o card, botão, campo, link. */
const NAO_ARRASTA =
  '[aria-roledescription="card arrastável"], button, a, input, textarea, select, label, [role="button"], [role="radio"], [contenteditable="true"]'

/**
 * O arrasto do CARD pelo mouse só com o botão ESQUERDO. O sensor padrão da
 * biblioteca pega qualquer botão menos o direito — com o botão do meio sendo
 * a mãozinha, o card sairia andando junto com o quadro (e cairia noutra coluna).
 */
export class SensorDoMouse extends MouseSensor {
  static activators = [
    {
      eventName: 'onMouseDown' as const,
      handler: ({ nativeEvent: evento }: EventoMouse, { onActivation }: MouseSensorOptions) => {
        if (evento.button !== 0) return false
        onActivation?.({ event: evento })
        return true
      },
    },
  ]
}

/**
 * Arrastar o QUADRO para o lado com a "mãozinha" (pedido do dono, 15/10:
 * "um botão para arrastar para o lado no kanban, clicando com o mouse no meio,
 * no estilo de mãozinha"): no mouse, o botão do MEIO segurado em qualquer
 * ponto — ou o botão esquerdo no fundo vazio (fora dos cards) — corre o quadro
 * para os lados. O card continua se arrastando como sempre (o botão esquerdo
 * em cima dele). No toque, a rolagem do próprio dedo já faz isso.
 */
export function useArrastarParaOLado() {
  const ref = useRef<HTMLDivElement>(null)
  const inicio = useRef<{ x: number; rolagem: number; ponteiro: number } | null>(null)
  const [arrastando, setArrastando] = useState(false)

  function aoApertar(e: EventoPonteiro<HTMLDivElement>) {
    if (e.pointerType !== 'mouse') return
    const meio = e.button === 1
    const esquerdoNoFundo = e.button === 0 && !(e.target as Element).closest(NAO_ARRASTA)
    if (!meio && !esquerdoNoFundo) return
    const el = ref.current
    if (!el || el.scrollWidth <= el.clientWidth) return // nada para o lado
    e.preventDefault()
    inicio.current = { x: e.clientX, rolagem: el.scrollLeft, ponteiro: e.pointerId }
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // sem captura: o arrasto segue enquanto o mouse estiver sobre o quadro
    }
    setArrastando(true)
  }

  function aoMover(e: EventoPonteiro<HTMLDivElement>) {
    const i = inicio.current
    const el = ref.current
    if (!i || !el || e.pointerId !== i.ponteiro) return
    el.scrollLeft = i.rolagem - (e.clientX - i.x)
  }

  function aoSoltar(e: EventoPonteiro<HTMLDivElement>) {
    const i = inicio.current
    if (!i || e.pointerId !== i.ponteiro) return
    inicio.current = null
    try {
      ref.current?.releasePointerCapture(e.pointerId)
    } catch {
      // já solto
    }
    setArrastando(false)
  }

  // O botão do meio abre a "rolagem automática" do navegador — aqui ele arrasta.
  function aoApertarMouse(e: EventoMouse<HTMLDivElement>) {
    if (e.button === 1) e.preventDefault()
  }

  return {
    arrastando,
    propsDoQuadro: {
      ref,
      onPointerDown: aoApertar,
      onPointerMove: aoMover,
      onPointerUp: aoSoltar,
      onPointerCancel: aoSoltar,
      onMouseDown: aoApertarMouse,
    },
  }
}
