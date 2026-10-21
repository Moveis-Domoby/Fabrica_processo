import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { Expedicao } from './Expedicao'
import type { PaginaExpedicao, PedidoExpedicao } from '@/logistica/api'

/**
 * SESSAO-38 (pedido do dono, imagens 6/7): "Pedidos em aguardo" virou a
 * Expedição — os pedidos não entregues com os FILTROS em quadradinhos (número
 * grande + nome; o ativo contornado). Os números vêm da MESMA requisição da
 * página e o clique troca o filtro no servidor (nova requisição com o filtro).
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/aoVivo', () => ({ useAoVivo: () => {} }))
vi.mock('@/logistica/acesso', () => ({
  useAcessoLogistica: () => ({
    perfil: { id: 'u1', papel: 'logistica' },
    souAdmin: false,
    tenhoAcesso: true,
    semAcesso: false,
    setores: [],
  }),
}))
vi.mock('@/kanban/api', () => ({ unidadesDoPedido: vi.fn(async () => []) }))

const pedido = (extra: Partial<PedidoExpedicao>): PedidoExpedicao => ({
  card_id: 1,
  pedido_id: 1,
  numero: 1,
  cliente_nome: 'Cliente Teste',
  data_prevista: '2026-11-10',
  situacao: 'Preparando envio',
  total_unidades: 2,
  a_entregar: 2,
  unidades_liberadas: 2,
  unidades_prontas: 2,
  pronto: true,
  estado: 'pronto',
  primeira_pronta_em: null,
  completo_em: null,
  lancado: false,
  em_devolucao: false,
  alterado_apos_liberacao: false,
  programacao: null,
  ...extra,
})

const contagens = { todos: 7, com_rota: 2, sem_rota: 5, prontos: 3, em_producao: 4 }
const { listarExpedicao } = vi.hoisted(() => ({ listarExpedicao: vi.fn() }))
listarExpedicao.mockImplementation(
  async ({ filtro }: { filtro: string }): Promise<PaginaExpedicao> => ({
    filtro: filtro as PaginaExpedicao['filtro'],
    contagens,
    total: 2,
    itens:
      filtro === 'com_rota'
        ? [
            pedido({
              card_id: 21,
              numero: 13999,
              estado: 'em_producao',
              pronto: false,
              unidades_prontas: 1,
              programacao: {
                data: '2026-11-12',
                caminhao_id: 3,
                caminhao_nome: 'Baú 1',
                caminhao_placa: 'ABC1D23',
                rota: 2,
              },
            }),
          ]
        : [
            pedido({ card_id: 11, numero: 13001 }),
            pedido({
              card_id: 12,
              numero: 13002,
              estado: 'no_pcp',
              pronto: false,
              unidades_liberadas: 0,
              unidades_prontas: 0,
            }),
          ],
  }),
)
vi.mock('@/logistica/api', () => ({
  listarExpedicao,
  listarProdutosReservados: vi.fn(async () => []),
}))

function renderizar() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={['/fabrica/logistica/expedicao']}>
        <ProvedorNotificacao>
          <Expedicao />
        </ProvedorNotificacao>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Expedição — os filtros em quadradinhos', () => {
  it('mostra os 5 números da mesma requisição, o ativo marcado, e cada pedido com o seu estado', async () => {
    renderizar()
    const grupo = await screen.findByRole('group', { name: 'Filtros da Expedição' })
    const todos = within(grupo).getByRole('button', { name: /Todos os pedidos não entregues/ })
    await waitFor(() => expect(todos).toHaveTextContent('7'))
    expect(todos).toHaveAttribute('aria-pressed', 'true')
    expect(within(grupo).getByRole('button', { name: /Com rota programada/ })).toHaveTextContent(
      '2',
    )
    expect(within(grupo).getByRole('button', { name: /Sem rota programada/ })).toHaveTextContent(
      '5',
    )
    expect(within(grupo).getByRole('button', { name: /Pedidos prontos/ })).toHaveTextContent('3')
    expect(within(grupo).getByRole('button', { name: /Ainda em produção/ })).toHaveTextContent('4')

    const pronto = (await screen.findByText('Pedido 13001')).closest('li')!
    expect(within(pronto).getByText('Pronto')).toBeInTheDocument()
    expect(within(pronto).getByRole('link', { name: /Abrir o pedido/ })).toHaveAttribute(
      'href',
      '/fabrica/pedidos/todos?pedido=13001',
    )
    const noPcp = screen.getByText('Pedido 13002').closest('li')!
    expect(within(noPcp).getByText('Ainda no PCP')).toBeInTheDocument()
    expect(within(noPcp).getByText(/2 ainda no PCP/)).toBeInTheDocument()
    expect(within(noPcp).getByRole('link', { name: 'programar' })).toBeInTheDocument()
  })

  it('o clique no quadradinho pede ao servidor a lista daquele filtro e o contorna', async () => {
    renderizar()
    const grupo = await screen.findByRole('group', { name: 'Filtros da Expedição' })
    await userEvent.click(within(grupo).getByRole('button', { name: /Com rota programada/ }))
    await waitFor(() =>
      expect(listarExpedicao).toHaveBeenCalledWith(expect.objectContaining({ filtro: 'com_rota' })),
    )
    expect(within(grupo).getByRole('button', { name: /Com rota programada/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const comRota = (await screen.findByText('Pedido 13999')).closest('li')!
    expect(within(comRota).getByText('Em produção · 1 de 2 prontas')).toBeInTheDocument()
    expect(within(comRota).getByText(/Baú 1 \(ABC1D23\) · Rota 2/)).toBeInTheDocument()
  })
})
