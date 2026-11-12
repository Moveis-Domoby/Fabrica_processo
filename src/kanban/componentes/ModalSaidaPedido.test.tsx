import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ModalSaidaPedido } from './ModalSaidaPedido'
import type { AlvoSaidaPedido } from './ModalSaidaPedido'
import type { SaidaPrevia } from '@/kanban/pcpSaida'

/**
 * SESSAO-50 (bloco B · frente 4): os dois modais pequenos do pedido que não vai
 * ser produzido — "Cancelar pedido" (avisa que cancela também no Tiny; sem a
 * ida ao Tiny ligada, o botão fica apagado com o porquê) e "Ocultar do PCP"
 * (com peças já liberadas, pergunta se oculta também, dizendo quantas e onde).
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { lerSaidaPrevia, cancelarPedido, ocultarPedido } = vi.hoisted(() => ({
  lerSaidaPrevia: vi.fn(),
  cancelarPedido: vi.fn(),
  ocultarPedido: vi.fn(),
}))
vi.mock('@/kanban/pcpSaida', async (original) => ({
  ...(await original<typeof import('@/kanban/pcpSaida')>()),
  lerSaidaPrevia,
  cancelarPedido,
  ocultarPedido,
}))

const previa = (extra: Partial<SaidaPrevia> = {}): SaidaPrevia => ({
  card_id: 900,
  pedido_id: 77,
  numero: 13270,
  cliente: 'Cliente Teste',
  situacao: 'Preparando envio',
  cancelado_no_tiny: false,
  tiny_ligado: true,
  cancelado_plataforma_em: null,
  tiny_estado: null,
  oculto_em: null,
  entregue: false,
  arquivado: false,
  ocultos_dias: 30,
  pecas: {
    em_producao: 1,
    prontas: 1,
    onde: [
      { setor: 'LIMPEZA E EMBALAGEM', etapa: 'A LIMPAR', pronta: false, pecas: 1 },
      { setor: 'PEDIDOS EM AGUARDO', etapa: null, pronta: true, pecas: 1 },
    ],
  },
  ocultar: {
    ocultaveis: 2,
    ficam: 0,
    programado: false,
    onde: [
      { setor: 'LIMPEZA E EMBALAGEM', etapa: 'A LIMPAR', pronta: false, fica: false, pecas: 1 },
      { setor: 'PEDIDOS EM AGUARDO', etapa: null, pronta: true, fica: false, pecas: 1 },
    ],
  },
  reservas: 0,
  ...extra,
})

function renderizar(alvo: AlvoSaidaPedido | null) {
  const aoFechar = vi.fn()
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProvedorNotificacao>
        <ModalSaidaPedido alvo={alvo} aoFechar={aoFechar} />
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
  return { aoFechar }
}

afterEach(() => {
  lerSaidaPrevia.mockReset()
  cancelarPedido.mockReset()
  ocultarPedido.mockReset()
})

describe('"Cancelar pedido"', () => {
  it('avisa que cancela também no Tiny, diz o que acontece com as peças e confirma num toque', async () => {
    lerSaidaPrevia.mockResolvedValue(previa())
    cancelarPedido.mockResolvedValue({ feito: true, numero: 13270, tiny: 'chamado' })
    const { aoFechar } = renderizar({ cardId: 900, numero: 13270, modo: 'cancelar' })
    expect(screen.getByRole('heading', { name: 'Cancelar o pedido 13270?' })).toBeInTheDocument()
    expect(await screen.findByText(/também no Tiny/)).toBeInTheDocument()
    expect(screen.getByText(/não dá para desfazer pela plataforma/)).toBeInTheDocument()
    expect(screen.getByText(/1 peça em produção espera a logística decidir para onde vai/)).toBeInTheDocument()
    expect(screen.getByText(/1 peça pronta vai para o estoque, sem dono/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar no Tiny e aqui' }))
    await waitFor(() => expect(cancelarPedido).toHaveBeenCalledWith(900, expect.stringMatching(/^cancelar:/)))
    expect(await screen.findByText('Pedido 13270 cancelado')).toBeInTheDocument()
    await waitFor(() => expect(aoFechar).toHaveBeenCalled())
  })

  it('com a ida ao Tiny desligada, o botão fica apagado e diz o porquê', async () => {
    lerSaidaPrevia.mockResolvedValue(previa({ tiny_ligado: false }))
    renderizar({ cardId: 900, numero: 13270, modo: 'cancelar' })
    expect(await screen.findByText(/A ida ao Tiny está desligada/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar no Tiny e aqui' })).toBeDisabled()
  })

  it('pedido já cancelado: diz onde ele está e não oferece cancelar de novo', async () => {
    lerSaidaPrevia.mockResolvedValue(previa({ cancelado_plataforma_em: '2026-11-12T05:00:00Z' }))
    renderizar({ cardId: 900, numero: 13270, modo: 'cancelar' })
    expect(await screen.findByText(/Este pedido já está cancelado/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar no Tiny e aqui' })).not.toBeInTheDocument()
  })
})

describe('"Ocultar do PCP"', () => {
  it('com peças já liberadas, pergunta quantas e onde, e oculta o pedido e as peças', async () => {
    lerSaidaPrevia.mockResolvedValue(previa())
    ocultarPedido.mockResolvedValue({ feito: true, numero: 13270, ocultadas: 2, dias: 30 })
    const { aoFechar } = renderizar({ cardId: 900, numero: 13270, modo: 'ocultar' })
    expect(screen.getByRole('heading', { name: 'Ocultar o pedido 13270 do PCP?' })).toBeInTheDocument()
    expect(await screen.findByText(/fica em/)).toBeInTheDocument()
    expect(screen.getByText(/O Tiny não muda/)).toBeInTheDocument()
    expect(
      screen.getByText(
        'Este pedido tem 2 peças já liberadas (1 em A LIMPAR, 1 em PEDIDOS EM AGUARDO). Ocultar também essas peças?',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ocultar só o pedido' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar o pedido e as peças' }))
    await waitFor(() =>
      expect(ocultarPedido).toHaveBeenCalledWith({
        cardId: 900,
        comPecas: true,
        chave: expect.stringMatching(/^ocultar:/),
      }),
    )
    expect(await screen.findByText('Pedido 13270 ocultado do PCP')).toBeInTheDocument()
    await waitFor(() => expect(aoFechar).toHaveBeenCalled())
  })

  it('"Ocultar só o pedido" deixa as peças na produção', async () => {
    lerSaidaPrevia.mockResolvedValue(previa())
    ocultarPedido.mockResolvedValue({ feito: true, numero: 13270, ocultadas: 0, dias: 30 })
    renderizar({ cardId: 900, numero: 13270, modo: 'ocultar' })
    await userEvent.click(await screen.findByRole('button', { name: 'Ocultar só o pedido' }))
    await waitFor(() =>
      expect(ocultarPedido).toHaveBeenCalledWith(expect.objectContaining({ comPecas: false })),
    )
  })

  it('sem peça liberada, oculta direto (um botão só)', async () => {
    lerSaidaPrevia.mockResolvedValue(
      previa({
        pecas: { em_producao: 0, prontas: 0, onde: [] },
        ocultar: { ocultaveis: 0, ficam: 0, programado: false, onde: [] },
      }),
    )
    ocultarPedido.mockResolvedValue({ feito: true, numero: 13270, ocultadas: 0, dias: 30 })
    renderizar({ cardId: 900, numero: 13270, modo: 'ocultar' })
    await userEvent.click(await screen.findByRole('button', { name: 'Ocultar do PCP' }))
    expect(screen.queryByRole('button', { name: 'Ocultar só o pedido' })).not.toBeInTheDocument()
    await waitFor(() =>
      expect(ocultarPedido).toHaveBeenCalledWith(expect.objectContaining({ comPecas: false })),
    )
  })

  it('fechado, não pede nada ao banco', () => {
    renderizar(null)
    expect(lerSaidaPrevia).not.toHaveBeenCalled()
  })
})
