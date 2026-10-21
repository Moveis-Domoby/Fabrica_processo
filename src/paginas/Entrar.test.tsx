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
  entrar: vi.fn(async () => ({ usuario: 'wallace' })),
  entrarPin: vi.fn(async () => ({ usuario: 'pessoa' })),
  tabletEntrar: vi.fn(async () => ({ setor: { id: 2, nome: 'SECC', codigo: 'secc' } })),
}))
vi.mock('@/autenticacao/sessao-contexto', () => ({
  useSessao: () => ({ sessao: null, carregando: false }),
}))

// O Node novo põe um localStorage próprio (vazio, sem arquivo) por cima do
// jsdom — aqui, um armazenamento de mentira em memória (como em inatividade.test).
const memoria = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (chave: string) => memoria.get(chave) ?? null,
  setItem: (chave: string, valor: string) => void memoria.set(chave, valor),
  removeItem: (chave: string) => void memoria.delete(chave),
  clear: () => memoria.clear(),
})

function desenhar() {
  return render(
    <MemoryRouter initialEntries={['/entrar']}>
      <Entrar />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
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
    // SESSAO-37: o PIN do setor tem exatamente 2 dígitos — digita 2-4 e confirma
    for (const d of ['2', '4']) {
      fireEvent.click(screen.getByRole('button', { name: `Dígito ${d}` }))
    }
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }))
    await waitFor(() => expect(tabletEntrar).toHaveBeenCalledWith('24'))
  })

  it('o e-mail + PIN entra por quem nunca criou senha (D-146 resposta 11)', async () => {
    desenhar()
    fireEvent.click(screen.getByRole('button', { name: /entrar com usuário e pin/i }))
    fireEvent.change(screen.getByLabelText(/usuário ou e-mail/i), {
      target: { value: 'pessoa@teste.com' },
    })
    fireEvent.change(screen.getByLabelText(/pin/i), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }))
    await waitFor(() => expect(entrarPin).toHaveBeenCalledWith('pessoa@teste.com', '1234'))
  })

  it('o PIN do e-mail + PIN só aceita dígitos (2 a 4 — SESSAO-37)', () => {
    desenhar()
    fireEvent.click(screen.getByRole('button', { name: /entrar com usuário e pin/i }))
    const pin = screen.getByLabelText(/pin/i)
    fireEvent.change(pin, { target: { value: 'abc12345678' } })
    expect((pin as HTMLInputElement).value).toBe('1234')
  })

  // SESSAO-38 (D-163): o dono não precisa mais digitar o e-mail toda vez.
  it('o PIN também aceita o nome de usuário', async () => {
    desenhar()
    fireEvent.click(screen.getByRole('button', { name: /entrar com usuário e pin/i }))
    fireEvent.change(screen.getByLabelText(/usuário ou e-mail/i), { target: { value: 'pessoa' } })
    fireEvent.change(screen.getByLabelText(/pin/i), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }))
    await waitFor(() => expect(entrarPin).toHaveBeenCalledWith('pessoa', '12'))
  })

  it('o aparelho guarda o NOME DE USUÁRIO devolvido — mesmo quem entrou pelo e-mail', async () => {
    desenhar()
    fireEvent.change(screen.getByLabelText(/usuário ou e-mail/i), {
      target: { value: 'wallace@teste.com' },
    })
    fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: 'segredo123' } })
    fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }))
    await waitFor(() => expect(localStorage.getItem('domoby:ultimo-login')).toBe('wallace'))
  })

  it('a próxima entrada já abre com o usuário lembrado e o cursor na senha', () => {
    localStorage.setItem('domoby:ultimo-login', 'wallace')
    desenhar()
    expect(screen.getByLabelText(/usuário ou e-mail/i)).toHaveValue('wallace')
    expect(screen.getByLabelText(/^senha$/i)).toHaveFocus()
  })

  it('os campos levam nome e preenchimento automático para o navegador lembrar', () => {
    desenhar()
    const usuario = screen.getByLabelText(/usuário ou e-mail/i)
    expect(usuario).toHaveAttribute('name', 'username')
    expect(usuario).toHaveAttribute('autocomplete', 'username')
    const senha = screen.getByLabelText(/^senha$/i)
    expect(senha).toHaveAttribute('name', 'password')
    expect(senha).toHaveAttribute('autocomplete', 'current-password')
  })
})
