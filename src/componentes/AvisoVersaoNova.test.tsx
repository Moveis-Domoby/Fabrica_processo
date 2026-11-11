import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { recarregar } from '@/lib/recarga'
import { AvisoVersaoNova } from './AvisoVersaoNova'

/**
 * SESSAO-48 (frente 5): o aviso discreto da versão nova. No tablet e na TV, ele
 * diz que a plataforma se atualiza sozinha (no momento seguro) e o botão tem o
 * tamanho de toque do galpão; tocar em "Atualizar" fica na trilha com o porquê.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/recarga', () => ({ recarregar: vi.fn() }))
const recarregarMock = recarregar as unknown as ReturnType<typeof vi.fn>

beforeEach(() => recarregarMock.mockClear())

describe('o aviso de versão nova', () => {
  it('sem versão nova não aparece', () => {
    const { container } = render(<AvisoVersaoNova nova={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('no escritório: o aviso e o botão Atualizar (que deixa o porquê para a trilha)', async () => {
    render(<AvisoVersaoNova nova />)
    expect(screen.getByRole('status')).toHaveTextContent('Saiu uma versão nova da plataforma.')
    expect(screen.queryByText(/se atualiza sozinha/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect(recarregarMock).toHaveBeenCalledWith('versao_nova_botao')
  })

  it('no tablet e na TV: diz que se atualiza sozinha; botão do tamanho do galpão', () => {
    render(<AvisoVersaoNova nova sozinha />)
    expect(
      screen.getByText('Ela se atualiza sozinha depois de 1 minuto sem uso.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Atualizar' }).className).toContain('h-toque-galpao')
  })
})
