import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { AbaCancelados } from './AbaCancelados'
import type { PedidoCancelado } from '@/kanban/pcpSaida'

/**
 * SESSAO-50 (bloco B): a aba "Cancelados" do PCP — o cancelado no Tiny, o
 * cancelado pela plataforma (com o que o Tiny respondeu e "Tentar de novo"
 * quando ele parou ou recusou) e o excluído no Tiny, cada um com o seu rótulo.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { listarCancelados, cancelarPedido } = vi.hoisted(() => ({
  listarCancelados: vi.fn(),
  cancelarPedido: vi.fn(),
}))
vi.mock('@/kanban/pcpSaida', async (original) => ({
  ...(await original<typeof import('@/kanban/pcpSaida')>()),
  listarCancelados,
  cancelarPedido,
}))

const linha = (extra: Partial<PedidoCancelado>): PedidoCancelado => ({
  card_id: 900,
  pedido_id: 77,
  numero: 13270,
  cliente_nome: 'Cliente Teste',
  data_pedido: '2026-09-01',
  situacao: 'Preparando envio',
  motivo: 'plataforma',
  saiu_em: '2026-11-12T05:00:00+00:00',
  cancelado_por: 'Guilherme',
  tiny_estado: 'parado',
  tiny_erro: 'Situação inválida',
  total_unidades: 7,
  em_producao: 2,
  prontas: 0,
  no_estoque: 0,
  esperando_decisao: 2,
  tem_mais: false,
  ...extra,
})

function renderizar() {
  render(
    <MemoryRouter initialEntries={['/fabrica/producao/pcp?aba=cancelados']}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ProvedorNotificacao>
          <AbaCancelados />
        </ProvedorNotificacao>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  listarCancelados.mockReset()
  cancelarPedido.mockReset()
})

describe('A aba "Cancelados" do PCP', () => {
  it('cada pedido com o seu rótulo: pela plataforma, no Tiny e excluído no Tiny', async () => {
    listarCancelados.mockResolvedValue({
      linhas: [
        linha({}),
        linha({
          card_id: 901,
          numero: 12728,
          motivo: 'tiny',
          situacao: 'Cancelado',
          cancelado_por: null,
          tiny_estado: null,
          tiny_erro: null,
          esperando_decisao: 0,
          em_producao: 0,
        }),
        linha({
          card_id: 902,
          numero: 13622,
          motivo: 'excluido',
          situacao: 'Em aberto',
          cancelado_por: null,
          tiny_estado: null,
          tiny_erro: null,
          saiu_em: '2026-10-16T06:22:23+00:00',
          esperando_decisao: 0,
          em_producao: 0,
        }),
      ],
      proxima: null,
    })
    renderizar()
    const plataforma = (await screen.findByText('Pedido 13270')).closest('li')!
    expect(within(plataforma).getByText('Cancelado pela plataforma')).toBeInTheDocument()
    expect(within(plataforma).getByText(/Cancelado por Guilherme em/)).toBeInTheDocument()
    expect(within(plataforma).getByText(/a plataforma parou de tentar/)).toBeInTheDocument()
    expect(within(plataforma).getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()

    const tiny = screen.getByText('Pedido 12728').closest('li')!
    expect(within(tiny).getByText('Cancelado no Tiny')).toBeInTheDocument()
    expect(within(tiny).queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()

    const excluido = screen.getByText('Pedido 13622').closest('li')!
    expect(within(excluido).getByText('Excluído no Tiny')).toBeInTheDocument()
    expect(within(excluido).getByText(/Não existe mais no Tiny desde/)).toBeInTheDocument()
    expect(listarCancelados).toHaveBeenCalledTimes(1)
  })

  it('"Tentar de novo" pede o cancelamento de novo ao Tiny', async () => {
    listarCancelados.mockResolvedValue({ linhas: [linha({})], proxima: null })
    cancelarPedido.mockResolvedValue({ feito: true, numero: 13270, motivo: 'tentar_de_novo' })
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(cancelarPedido).toHaveBeenCalledWith(900, expect.any(String)))
    expect(
      await screen.findByText('Pedido 13270: o cancelamento foi pedido de novo ao Tiny'),
    ).toBeInTheDocument()
  })

  it('o Tiny já confirmou: o selo verde e nenhum aviso', async () => {
    listarCancelados.mockResolvedValue({
      linhas: [linha({ tiny_estado: 'confirmado', tiny_erro: null, situacao: 'Cancelado' })],
      proxima: null,
    })
    renderizar()
    expect(await screen.findByText('Confirmado no Tiny')).toBeInTheDocument()
    expect(screen.queryByText(/ainda não confirmou/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
  })

  it('vazia: diz isso', async () => {
    listarCancelados.mockResolvedValue({ linhas: [], proxima: null })
    renderizar()
    expect(
      await screen.findByText('Nenhum pedido cancelado que tenha passado pelo PCP.'),
    ).toBeInTheDocument()
  })
})
