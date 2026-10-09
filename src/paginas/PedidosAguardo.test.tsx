import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { PedidosAguardo } from './PedidosAguardo'

/**
 * D-63 (ajuste do Frete): o pedido sem nada a produzir (só frete) chega a
 * Pedidos em aguardo já completo. A tela diz "Nada a produzir", a barra vem
 * cheia e não oferece "Ver unidades" (não há unidade nenhuma) — o Lançar para
 * ROTAS continua. O pedido comum segue igual ("3 de 5 prontas").
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
// O "ao vivo" abre canal no Realtime — fora do escopo deste teste.
vi.mock('@/lib/aoVivo', () => ({ useAoVivo: () => {} }))
vi.mock('@/logistica/acesso', () => ({
  useAcessoLogistica: () => ({
    perfil: { id: 'u1', papel: 'admin' },
    souAdmin: true,
    tenhoAcesso: true,
    semAcesso: false,
    setores: [],
  }),
}))
vi.mock('@/kanban/api', () => ({ unidadesDoPedido: vi.fn(async () => []) }))

const base = {
  cliente_nome: 'Cliente Teste',
  data_prevista: '2026-10-01',
  situacao: 'Preparando envio',
  alterado_apos_liberacao: false,
  primeira_pronta_em: null,
  contagem_total: 2,
}
vi.mock('@/logistica/api', () => ({
  contagensAguardo: vi.fn(async () => ({ pedidos: 2, pedidos_completos: 1, produtos: 3 })),
  listarProdutosReservados: vi.fn(async () => []),
  lancarParaRotas: vi.fn(),
  listarPedidosAguardo: vi.fn(async () => [
    {
      ...base,
      card_id: 11,
      pedido_id: 101,
      numero: 900001,
      total_unidades: 0,
      unidades_liberadas: 0,
      unidades_prontas: 0,
      completo: true,
      completo_em: '2026-09-28T10:00:00Z',
    },
    {
      ...base,
      card_id: 12,
      pedido_id: 102,
      numero: 13215,
      total_unidades: 5,
      unidades_liberadas: 5,
      unidades_prontas: 3,
      completo: false,
      completo_em: null,
      primeira_pronta_em: '2026-09-27T10:00:00Z',
    },
  ]),
}))

function renderizar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/fabrica/logistica/pedidos-em-aguardo']}>
        <ProvedorNotificacao>
          <PedidosAguardo />
        </ProvedorNotificacao>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Pedidos em aguardo — pedido sem nada a produzir (D-63)', () => {
  it('mostra "Nada a produzir", completo, barra cheia e sem "Ver unidades"; o pedido comum segue igual', async () => {
    renderizar()

    const soFrete = (await screen.findByText('Pedido 900001')).closest('li')!
    expect(within(soFrete).getByText('Nada a produzir')).toBeInTheDocument()
    expect(within(soFrete).getByText('Pedido completo')).toBeInTheDocument()
    expect(within(soFrete).queryByRole('button', { name: /Ver unidades/ })).toBeNull()
    expect(within(soFrete).getByRole('button', { name: /Lançar para ROTAS/ })).toBeInTheDocument()
    const barra = within(soFrete).getByRole('progressbar')
    expect((barra.firstElementChild as HTMLElement).style.width).toBe('100%')

    const comum = screen.getByText('Pedido 13215').closest('li')!
    expect(within(comum).getByText('3 de 5 prontas')).toBeInTheDocument()
    expect(within(comum).queryByText('Nada a produzir')).toBeNull()
    expect(within(comum).getByRole('button', { name: /Ver unidades/ })).toBeInTheDocument()
  })
})
