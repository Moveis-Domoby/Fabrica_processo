import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BotaoOrdemFila, ChipPrazo, PontoPrioridade, SeletorPrioridade } from './MarcasDoCard'
import { ehOrdem, prioridadeDe, proximaOrdem } from '../prioridade'

const AGORA = new Date(2026, 9, 21, 10, 0).getTime()

describe('as marcas do card (SESSAO-38)', () => {
  it('o chip do prazo mostra só a data e troca de cor pelo que falta', () => {
    const { rerender } = render(<ChipPrazo data="2026-10-30" agora={AGORA} />)
    let chip = screen.getByRole('img', { name: /faltam 9 dias/ })
    expect(chip.textContent).toBe('30/10')
    expect(chip.dataset.cor).toBe('verde')

    rerender(<ChipPrazo data="2026-10-23" agora={AGORA} />)
    chip = screen.getByRole('img', { name: /faltam 2 dias/ })
    expect(chip.dataset.cor).toBe('amarelo')

    rerender(<ChipPrazo data="2026-10-22" agora={AGORA} />)
    chip = screen.getByRole('img', { name: /amanhã/ })
    expect(chip.dataset.cor).toBe('vermelho')
    expect(chip.className).toMatch(/animate-pulse/)

    rerender(<ChipPrazo data="2026-10-10" agora={AGORA} />)
    expect(screen.getByRole('img', { name: /atrasada/ }).dataset.cor).toBe('vermelho')
  })

  it('sem data, nada aparece', () => {
    const { container } = render(<ChipPrazo data={null} agora={AGORA} />)
    expect(container.textContent).toBe('')
  })

  it('a bolinha da prioridade tem nome; o urgente também por escrito', () => {
    render(
      <>
        <PontoPrioridade prioridade="atencao" />
        <PontoPrioridade prioridade="urgente" comTexto />
      </>,
    )
    expect(screen.getByRole('img', { name: 'Prioridade: Atenção' })).toBeTruthy()
    expect(screen.getByText('Urgente')).toBeTruthy()
  })

  it('o organizador da fila é UM botão só com ícone, que passa para a próxima ordem', () => {
    const aoMudar = vi.fn()
    render(<BotaoOrdemFila ordem="prioridade" aoMudar={aoMudar} />)
    const botao = screen.getByRole('button', { name: /prioridade/i })
    expect(botao.textContent).toBe('')
    fireEvent.click(botao)
    expect(aoMudar).toHaveBeenCalledWith('entrega')
    expect(proximaOrdem('entrega')).toBe('alfabetica')
    expect(proximaOrdem('alfabetica')).toBe('prioridade')
    expect(ehOrdem('qualquer')).toBe(false)
  })

  it('o seletor de prioridade marca a atual e avisa só quando muda', () => {
    const aoMudar = vi.fn()
    render(<SeletorPrioridade valor="comum" aoMudar={aoMudar} compacto />)
    expect(screen.getByRole('radio', { name: 'Comum' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('radio', { name: 'Comum' }))
    expect(aoMudar).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('radio', { name: 'Urgente' }))
    expect(aoMudar).toHaveBeenCalledWith('urgente')
    expect(prioridadeDe(null)).toBe('comum')
    expect(prioridadeDe('atencao')).toBe('atencao')
  })
})
