import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { reiniciarRecargaParaTeste } from '@/lib/recarga'
import { BotaoAtualizarTela } from './BotaoAtualizarTela'

/**
 * Ajuste de 12/11 (D-306): o "Atualizar" do cabeçalho do tablet — no aplicativo
 * não existe o "puxar a tela para baixo" do navegador. Recarrega na hora, uma vez
 * só, mostra que está recarregando e não deixa porquê da plataforma (a trilha
 * registra "atualizou a página", que é o que a pessoa fez).
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const recarregou = vi.fn()

beforeEach(() => {
  sessionStorage.clear()
  recarregou.mockClear()
  reiniciarRecargaParaTeste(recarregou)
})

describe('o botão Atualizar do tablet', () => {
  it('recarrega a tela na hora e mostra que está atualizando', async () => {
    render(<BotaoAtualizarTela />)
    const botao = screen.getByRole('button', { name: 'Atualizar' })
    expect(botao).toHaveAttribute('title', 'Atualizar a tela')
    await userEvent.click(botao)
    expect(recarregou).toHaveBeenCalledTimes(1)
    const depois = screen.getByRole('button', { name: /Atualizando/ })
    expect(depois).toBeDisabled()
    expect(depois).toHaveAttribute('aria-busy', 'true')
  })

  it('não deixa porquê da plataforma na aba (é a pessoa que atualiza)', async () => {
    render(<BotaoAtualizarTela />)
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect(sessionStorage.getItem('domoby:motivo-recarga')).toBeNull()
  })
})
