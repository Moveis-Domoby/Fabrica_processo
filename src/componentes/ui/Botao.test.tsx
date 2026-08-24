import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Botao } from './Botao'

describe('Botao', () => {
  it('dispara o clique', async () => {
    const usuario = userEvent.setup()
    const aoClicar = vi.fn()
    render(<Botao onClick={aoClicar}>Iniciar</Botao>)
    await usuario.click(screen.getByRole('button', { name: 'Iniciar' }))
    expect(aoClicar).toHaveBeenCalledOnce()
  })

  it('não clica enquanto carrega', async () => {
    const usuario = userEvent.setup()
    const aoClicar = vi.fn()
    render(
      <Botao carregando onClick={aoClicar}>
        Salvando
      </Botao>,
    )
    const botao = screen.getByRole('button', { name: 'Salvando' })
    expect(botao).toBeDisabled()
    expect(botao).toHaveAttribute('aria-busy', 'true')
    await usuario.click(botao)
    expect(aoClicar).not.toHaveBeenCalled()
  })
})
