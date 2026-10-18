import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { Entrar } from './Entrar'
import { entrar, entrarPin, tabletEntrar } from '@/autenticacao/api'

/**
 * SESSAO-36 (D-146): a tela de entrada ganhou o MODO TABLET (PIN do setor) e o
 * e-mail + PIN (quem nunca criou senha). O caminho de usuário + senha continua
 * o mesmo.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/autenticacao/api', () => ({
  entrar: vi.fn(async () => undefined),
  entrarPin: vi.fn(async () => undefined),
  tabletEntrar: vi.fn(async () => ({ setor: { id: 2, nome: 'SECC', codigo: 'secc' } })),
}))
vi.mock('@/autenticacao/sessao-contexto', () => ({
  useSessao: () => ({ sessao: null, carregando: false }),
}))

function desenhar() {
  return render(
    <MemoryRouter initialEntries={['/entrar']}>
      <Entrar />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Entrar (SESSAO-36)', () => {
  it('continua entrando com usuário (ou e-mail) + senha', async () => {
    desenhar()
    fireEvent.change(screen.getByLabelText(/usuário ou e-mail/i), {
      target: { value: 'wallace' },
    })
    fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: 'segredo123' } })
    fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }))
    await waitFor(() => expect(entrar).toHaveBeenCalledWith('wallace', 'segredo123'))
  })

  it('o modo tablet pede o PIN DO SETOR num teclado na tela e abre o setor', async () => {
    desenhar()
    fireEvent.click(screen.getByRole('button', { name: /modo tablet do setor/i }))
    expect(screen.getByText(/digite o pin do setor/i)).toBeInTheDocument()
    // digita 2-4-6-8 no teclado da tela e confirma
    for (const d of ['2', '4', '6', '8']) {
      fireEvent.click(screen.getByRole('button', { name: `Dígito ${d}` }))
    }
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }))
    await waitFor(() => expect(tabletEntrar).toHaveBeenCalledWith('2468'))
  })

  it('o e-mail + PIN entra por quem nunca criou senha (D-146 resposta 11)', async () => {
    desenhar()
    fireEvent.click(screen.getByRole('button', { name: /entrar com e-mail e pin/i }))
    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: 'pessoa@teste.com' },
    })
    fireEvent.change(screen.getByLabelText(/pin/i), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }))
    await waitFor(() => expect(entrarPin).toHaveBeenCalledWith('pessoa@teste.com', '1234'))
  })

  it('o PIN do e-mail + PIN só aceita dígitos (4 a 6)', () => {
    desenhar()
    fireEvent.click(screen.getByRole('button', { name: /entrar com e-mail e pin/i }))
    const pin = screen.getByLabelText(/pin/i)
    fireEvent.change(pin, { target: { value: 'abc12345678' } })
    expect((pin as HTMLInputElement).value).toBe('123456')
  })
})
