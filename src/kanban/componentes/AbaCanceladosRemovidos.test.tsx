import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { AbaCanceladosRemovidos } from './AbaCanceladosRemovidos'
import type { PedidoCanceladoOuRemovido } from '@/kanban/api'

/**
 * SESSAO-48 (frente 2): a aba "Cancelados e removidos" do PCP — o pedido
 * removido mostra o motivo, quem removeu e quando, e ganha "Devolver ao PCP";
 * o cancelado no Tiny aparece sem esse botão (o Tiny manda). Lida numa
 * requisição, por cursor.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { listarCanceladosRemovidos, devolverAoPcp } = vi.hoisted(() => ({
  listarCanceladosRemovidos: vi.fn(),
  devolverAoPcp: vi.fn(),
}))
vi.mock('@/kanban/api', () => ({ listarCanceladosRemovidos, devolverAoPcp }))

const linha = (extra: Partial<PedidoCanceladoOuRemovido>): PedidoCanceladoOuRemovido => ({
  card_id: 900,
  pedido_id: 77,
  numero: 13622,
  cliente_nome: 'Cliente Teste',
  data_pedido: '2026-10-08',
  situacao: 'Em aberto',
  cancelado_no_tiny: false,
  cancelado_em: null,
  removido_em: '2026-11-11T12:00:00.123456+00:00',
  removido_motivo: 'fora_da_linha',
  removido_texto: 'o cliente vai buscar na loja',
  removido_por: 'Guilherme',
  saiu_em: '2026-11-11T12:00:00.123456+00:00',
  total_unidades: 31,
  em_producao: 1,
  prontas: 0,
  no_estoque: 0,
  esperando_decisao: 0,
  pode_devolver: true,
  tem_mais: false,
  contagem_total: 2,
  ...extra,
})

const removido = linha({})
const canceladoNoTiny = linha({
  card_id: 901,
  pedido_id: 78,
  numero: 12728,
  cliente_nome: 'Outro Cliente',
  situacao: 'Cancelado',
  cancelado_no_tiny: true,
  cancelado_em: '2026-10-19T22:24:00+00:00',
  removido_em: null,
  removido_motivo: null,
  removido_texto: null,
  removido_por: null,
  saiu_em: '2026-10-19T22:24:00+00:00',
  em_producao: 0,
  no_estoque: 1,
  pode_devolver: false,
})

function renderizar() {
  render(
    <MemoryRouter initialEntries={['/fabrica/producao/pcp?aba=cancelados']}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ProvedorNotificacao>
          <AbaCanceladosRemovidos />
        </ProvedorNotificacao>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  listarCanceladosRemovidos.mockReset()
  devolverAoPcp.mockReset()
})

describe('A aba "Cancelados e removidos"', () => {
  it('mostra o motivo, quem removeu e quando; "Devolver ao PCP" só no removido', async () => {
    listarCanceladosRemovidos.mockResolvedValue({
      linhas: [removido, canceladoNoTiny],
      proxima: null,
      total: 2,
    })
    renderizar()
    const linhaRemovido = (await screen.findByText('Pedido 13622')).closest('li')!
    const linhaCancelado = screen.getByText('Pedido 12728').closest('li')!

    expect(within(linhaRemovido).getByText('Removido do PCP')).toBeInTheDocument()
    expect(
      within(linhaRemovido).getByText('Tirado da linha de produção: o cliente vai buscar na loja'),
    ).toBeInTheDocument()
    expect(within(linhaRemovido).getByText(/^Removido por Guilherme em /)).toBeInTheDocument()
    expect(within(linhaRemovido).getByText('1 peça em produção')).toBeInTheDocument()
    expect(within(linhaRemovido).getByRole('button', { name: 'Devolver ao PCP' })).toBeEnabled()

    expect(within(linhaCancelado).getByText('Cancelado no Tiny')).toBeInTheDocument()
    expect(within(linhaCancelado).getByText(/^Cancelado no Tiny em /)).toBeInTheDocument()
    expect(within(linhaCancelado).getByText('1 no estoque, sem dono')).toBeInTheDocument()
    expect(
      within(linhaCancelado).queryByRole('button', { name: 'Devolver ao PCP' }),
    ).not.toBeInTheDocument()

    expect(screen.getByText('(2)')).toBeInTheDocument()
    expect(listarCanceladosRemovidos).toHaveBeenCalledTimes(1)
    expect(listarCanceladosRemovidos).toHaveBeenCalledWith({ busca: null, depois: null })
    expect(screen.getByRole('link', { name: 'Pedidos → Cancelados' })).toHaveAttribute(
      'href',
      '/fabrica/pedidos/cancelados',
    )
  })

  it('"Devolver ao PCP" manda o card do pedido e diz para onde ele voltou', async () => {
    listarCanceladosRemovidos.mockResolvedValue({ linhas: [removido], proxima: null, total: 1 })
    devolverAoPcp.mockResolvedValue({
      feito: true,
      numero: 13622,
      fora_pelo_tiny: false,
      situacao: 'Em aberto',
      standby: false,
    })
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Devolver ao PCP' }))
    await waitFor(() => expect(devolverAoPcp).toHaveBeenCalledWith(900))
    expect(await screen.findByText('Pedido 13622 devolvido ao PCP')).toBeInTheDocument()
    expect(screen.getByText('Ele está em "Pedidos aguardando liberação".')).toBeInTheDocument()
  })

  it('o Tiny o mantém fora: o aviso diz a verdade', async () => {
    listarCanceladosRemovidos.mockResolvedValue({ linhas: [removido], proxima: null, total: 1 })
    devolverAoPcp.mockResolvedValue({
      feito: true,
      numero: 13622,
      fora_pelo_tiny: true,
      situacao: 'Faturado',
      standby: false,
    })
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Devolver ao PCP' }))
    expect(await screen.findByText('Pedido 13622 saiu dos removidos')).toBeInTheDocument()
    expect(
      screen.getByText('Ele não volta ao quadro: no Tiny está como "Faturado".'),
    ).toBeInTheDocument()
  })

  it('lista vazia diz isso', async () => {
    listarCanceladosRemovidos.mockResolvedValue({ linhas: [], proxima: null, total: 0 })
    renderizar()
    expect(
      await screen.findByText('Nenhum pedido cancelado ou removido do PCP.'),
    ).toBeInTheDocument()
  })
})
