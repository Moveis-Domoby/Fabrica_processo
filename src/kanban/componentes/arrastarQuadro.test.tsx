import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SensorDoMouse, useArrastarParaOLado } from './arrastarQuadro'

/**
 * A "mãozinha" do quadro (pedido do dono, 15/10): o botão do meio em qualquer
 * ponto — ou o esquerdo no fundo vazio — corre o quadro para os lados; o card
 * e os botões seguem com o gesto deles; o toque fica com a rolagem do dedo.
 */
function Quadro() {
  const { arrastando, propsDoQuadro } = useArrastarParaOLado()
  return (
    <div data-testid="quadro" data-arrastando={arrastando} {...propsDoQuadro}>
      <div aria-roledescription="card arrastável" data-testid="card">
        Armário
      </div>
      <button type="button">Ver mais</button>
    </div>
  )
}

function montar() {
  render(<Quadro />)
  const quadro = screen.getByTestId('quadro')
  let rolagem = 300
  Object.defineProperty(quadro, 'scrollWidth', { configurable: true, value: 2000 })
  Object.defineProperty(quadro, 'clientWidth', { configurable: true, value: 800 })
  Object.defineProperty(quadro, 'scrollLeft', {
    configurable: true,
    get: () => rolagem,
    set: (v: number) => {
      rolagem = v
    },
  })
  return quadro
}

function arrastar(alvo: Element, quadro: Element, botao: number, tipo = 'mouse') {
  fireEvent.pointerDown(alvo, { pointerType: tipo, button: botao, clientX: 500, pointerId: 7 })
  fireEvent.pointerMove(quadro, { pointerType: tipo, clientX: 380, pointerId: 7 })
}

describe('arrastar o quadro para o lado', () => {
  it('o botão do meio corre o quadro, mesmo em cima de um card', () => {
    const quadro = montar()
    arrastar(screen.getByTestId('card'), quadro, 1)
    expect(quadro.scrollLeft).toBe(420)
    expect(quadro).toHaveAttribute('data-arrastando', 'true')
    fireEvent.pointerUp(quadro, { pointerType: 'mouse', pointerId: 7 })
    expect(quadro).toHaveAttribute('data-arrastando', 'false')
  })

  it('o botão esquerdo no fundo vazio corre o quadro', () => {
    const quadro = montar()
    arrastar(quadro, quadro, 0)
    expect(quadro.scrollLeft).toBe(420)
  })

  it('o botão esquerdo no card ou num botão não corre o quadro', () => {
    const quadro = montar()
    arrastar(screen.getByTestId('card'), quadro, 0)
    expect(quadro.scrollLeft).toBe(300)
    arrastar(screen.getByRole('button', { name: 'Ver mais' }), quadro, 0)
    expect(quadro.scrollLeft).toBe(300)
  })

  it('no toque, quem corre é o próprio dedo (a mãozinha não entra)', () => {
    const quadro = montar()
    arrastar(quadro, quadro, 0, 'touch')
    expect(quadro.scrollLeft).toBe(300)
    expect(quadro).toHaveAttribute('data-arrastando', 'false')
  })
})

describe('o arrasto do card pelo mouse', () => {
  const [ativador] = SensorDoMouse.activators
  const apertar = (botao: number) =>
    ativador.handler({ nativeEvent: { button: botao } } as never, {})

  it('só o botão esquerdo pega o card (o do meio é da mãozinha)', () => {
    expect(apertar(0)).toBe(true)
    expect(apertar(1)).toBe(false)
    expect(apertar(2)).toBe(false)
  })
})
