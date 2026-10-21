import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { SinoNotificacoes } from './SinoNotificacoes'

/**
 * SESSAO-38 (pedido do dono): qualquer toque fora do painel de notificações
 * fecha na hora — inclusive sobre quem segura os próprios eventos (o mapa) —
 * sem "comer" o clique de quem foi tocado.
 */
vi.mock('@/chat/canais', () => ({
  ouvirCanal: () => () => undefined,
  topicoDaPessoa: (id: string) => `pessoa:${id}`,
}))
vi.mock('./api', () => ({
  buscarAvisos: vi.fn(async () => []),
  apagarAviso: vi.fn(),
  apagarLidas: vi.fn(),
  marcarAvisoLido: vi.fn(),
  marcarTodosLidos: vi.fn(),
  destinoDoAviso: () => null,
}))

function desenhar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const aoClicarFora = vi.fn()
  const utilidades = render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <SinoNotificacoes usuarioId="u1" />
        <button type="button" onClick={aoClicarFora}>
          Outro botão
        </button>
        {/* Imita o mapa: segura o próprio evento (não deixa subir). */}
        <div data-testid="mapa" onPointerDown={(e) => e.stopPropagation()} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...utilidades, aoClicarFora }
}

const painel = () => screen.queryByRole('region', { name: 'Notificações' })
const sino = () => screen.getByRole('button', { name: 'Notificações' })

describe('Sino de notificações (SESSAO-38)', () => {
  it('o sino abre e fecha o painel', () => {
    desenhar()
    fireEvent.click(sino())
    expect(painel()).toBeInTheDocument()
    fireEvent.pointerDown(sino())
    fireEvent.click(sino())
    expect(painel()).not.toBeInTheDocument()
  })

  it('tocar em qualquer lugar fora fecha — e o clique segue para o elemento tocado', () => {
    const { aoClicarFora } = desenhar()
    fireEvent.click(sino())
    const outro = screen.getByRole('button', { name: 'Outro botão' })
    fireEvent.pointerDown(outro)
    expect(painel()).not.toBeInTheDocument()
    fireEvent.click(outro)
    expect(aoClicarFora).toHaveBeenCalledTimes(1)
  })

  it('fecha mesmo sobre quem segura o próprio evento (o mapa)', () => {
    desenhar()
    fireEvent.click(sino())
    fireEvent.pointerDown(screen.getByTestId('mapa'))
    expect(painel()).not.toBeInTheDocument()
  })

  it('tocar dentro do painel não fecha', () => {
    desenhar()
    fireEvent.click(sino())
    fireEvent.pointerDown(screen.getByText('Ver todos'))
    expect(painel()).toBeInTheDocument()
  })

  it('a tecla Esc fecha', () => {
    desenhar()
    fireEvent.click(sino())
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(painel()).not.toBeInTheDocument()
  })
})
