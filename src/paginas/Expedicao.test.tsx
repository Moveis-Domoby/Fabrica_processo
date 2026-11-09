import { afterEach, describe, expect, it, vi } from 'vitest'
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
const { listarExpedicao, voltarPedidoAoPcp } = vi.hoisted(() => ({
  listarExpedicao: vi.fn(),
  voltarPedidoAoPcp: vi.fn(),
}))
const listaPadrao = async ({ filtro }: { filtro: string }): Promise<PaginaExpedicao> => ({
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
})
listarExpedicao.mockImplementation(listaPadrao)
vi.mock('@/logistica/api', () => ({
  listarExpedicao,
  voltarPedidoAoPcp,
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

  it('com o banco de antes (sem o número novo), o quadradinho "Saiu do PCP pelo Tiny" não aparece', async () => {
    renderizar()
    const grupo = await screen.findByRole('group', { name: 'Filtros da Expedição' })
    await waitFor(() =>
      expect(within(grupo).getByRole('button', { name: /Todos os pedidos/ })).toHaveTextContent(
        '7',
      ),
    )
    expect(within(grupo).getAllByRole('button')).toHaveLength(5)
    expect(within(grupo).queryByRole('button', { name: /Saiu do PCP pelo Tiny/ })).toBeNull()
  })
})

/**
 * SESSAO-47 (bloco A): o pedido que o Tiny levou adiante (Faturado, Pronto para
 * envio, Enviado) e que ainda tem produto por liberar aparece na Expedição
 * mesmo sem peça nenhuma, com a situação real e os dois botões que mudam a
 * situação no Tiny e devolvem o pedido ao PCP — depois de uma confirmação.
 */
describe('Expedição — o pedido que saiu do PCP pelo Tiny', () => {
  const adiantado = (extra: Partial<PedidoExpedicao> = {}) =>
    pedido({
      card_id: 31,
      pedido_id: 31,
      numero: 13818,
      situacao: 'Pronto para envio',
      estado: 'no_pcp',
      pronto: false,
      unidades_liberadas: 0,
      unidades_prontas: 0,
      tiny_adiantado: true,
      saiu_do_pcp: { situacao: 'Pronto para envio', faltam: 2 },
      volta_pcp: null,
      ...extra,
    })
  const pagina = (itens: PedidoExpedicao[], tinyLigado = true) =>
    listarExpedicao.mockImplementation(
      async ({ filtro }: { filtro: string }): Promise<PaginaExpedicao> => ({
        filtro: filtro as PaginaExpedicao['filtro'],
        tiny_ligado: tinyLigado,
        contagens: { ...contagens, saiu_do_pcp: 1 },
        total: itens.length,
        itens,
      }),
    )
  afterEach(() => {
    listarExpedicao.mockImplementation(listaPadrao)
    voltarPedidoAoPcp.mockReset()
  })

  it('mostra o aviso com a situação real e o que falta, o filtro só deles e nada de "ainda no PCP"', async () => {
    pagina([adiantado()])
    renderizar()
    const grupo = await screen.findByRole('group', { name: 'Filtros da Expedição' })
    const filtro = await within(grupo).findByRole('button', { name: /Saiu do PCP pelo Tiny/ })
    expect(filtro).toHaveTextContent('1')
    expect(within(grupo).getAllByRole('button')).toHaveLength(6)

    const card = (await screen.findByText('Pedido 13818')).closest('li')!
    expect(
      within(card).getByText(
        'Este pedido está como Pronto para envio no Tiny, por isso saiu do PCP. Ainda falta liberar 2 produtos.',
      ),
    ).toBeInTheDocument()
    expect(within(card).getByText('Saiu do PCP pelo Tiny')).toBeInTheDocument()
    expect(within(card).queryByText('Ainda no PCP')).toBeNull()
    expect(within(card).queryByText(/ainda no PCP/)).toBeNull()
    expect(within(card).getByRole('button', { name: 'Voltar para Em aberto (Tiny)' })).toBeEnabled()
    expect(
      within(card).getByRole('button', { name: 'Voltar para Preparando envio (Tiny)' }),
    ).toBeEnabled()

    await userEvent.click(filtro)
    await waitFor(() =>
      expect(listarExpedicao).toHaveBeenCalledWith(
        expect.objectContaining({ filtro: 'saiu_do_pcp' }),
      ),
    )
  })

  it('o botão pede uma confirmação de uma frase e, confirmado, devolve o pedido ao PCP numa chamada só', async () => {
    pagina([adiantado()])
    voltarPedidoAoPcp.mockResolvedValue({
      feito: true,
      numero: 13818,
      faltam: 2,
      situacao_pedida: 'preparando_envio',
      standby: false,
    })
    renderizar()
    const card = (await screen.findByText('Pedido 13818')).closest('li')!
    await userEvent.click(
      within(card).getByRole('button', { name: 'Voltar para Preparando envio (Tiny)' }),
    )
    const janela = await screen.findByRole('dialog', { name: 'Voltar o pedido 13818 ao PCP?' })
    expect(
      within(janela).getByText(
        'O pedido 13818 vai voltar ao PCP com 2 produtos para liberar, e no Tiny passa para Preparando envio.',
      ),
    ).toBeInTheDocument()
    expect(voltarPedidoAoPcp).not.toHaveBeenCalled()

    await userEvent.click(within(janela).getByRole('button', { name: 'Voltar ao PCP' }))
    await waitFor(() => expect(voltarPedidoAoPcp).toHaveBeenCalledTimes(1))
    expect(voltarPedidoAoPcp).toHaveBeenCalledWith({
      cardId: 31,
      situacao: 'preparando_envio',
      chave: expect.any(String),
    })
    expect(await screen.findByText('Pedido 13818 voltou ao PCP')).toBeInTheDocument()
    expect(
      screen.getByText('Com 2 produtos para liberar. No Tiny ele passa para Preparando envio.'),
    ).toBeInTheDocument()
  })

  it('"Ainda não quero": cancelar a confirmação não chama o banco', async () => {
    pagina([adiantado({ saiu_do_pcp: { situacao: 'Enviado', faltam: 1 }, situacao: 'Enviado' })])
    renderizar()
    const card = (await screen.findByText('Pedido 13818')).closest('li')!
    expect(
      within(card).getByText(
        'Este pedido está como Enviado no Tiny, por isso saiu do PCP. Ainda falta liberar 1 produto.',
      ),
    ).toBeInTheDocument()
    await userEvent.click(
      within(card).getByRole('button', { name: 'Voltar para Em aberto (Tiny)' }),
    )
    const janela = await screen.findByRole('dialog', { name: 'Voltar o pedido 13818 ao PCP?' })
    expect(
      within(janela).getByText(
        'O pedido 13818 vai voltar ao PCP com 1 produto para liberar, e no Tiny passa para Em aberto.',
      ),
    ).toBeInTheDocument()
    await userEvent.click(within(janela).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(voltarPedidoAoPcp).not.toHaveBeenCalled()
  })

  it('com a ida ao Tiny desligada os botões ficam apagados, com a explicação', async () => {
    pagina([adiantado()], false)
    renderizar()
    const card = (await screen.findByText('Pedido 13818')).closest('li')!
    expect(
      within(card).getByRole('button', { name: 'Voltar para Em aberto (Tiny)' }),
    ).toBeDisabled()
    expect(
      within(card).getByRole('button', { name: 'Voltar para Preparando envio (Tiny)' }),
    ).toBeDisabled()
    expect(within(card).getByText(/sem a ida ao Tiny ligada/)).toBeInTheDocument()
  })

  it('o pedido já devolvido diz que o Tiny ainda não confirmou — e não oferece os botões de novo', async () => {
    pagina([
      adiantado({
        tiny_adiantado: false,
        saiu_do_pcp: null,
        volta_pcp: {
          desde: '2026-11-09T19:00:00Z',
          situacao_pedida: 'preparando_envio',
          situacao_tiny: 'Pronto para envio',
          estado: 'falhando',
        },
      }),
    ])
    renderizar()
    const card = (await screen.findByText('Pedido 13818')).closest('li')!
    expect(within(card).getByText('O Tiny ainda não confirmou a mudança')).toBeInTheDocument()
    expect(within(card).getByText('Ainda no PCP')).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: /Voltar para/ })).toBeNull()
  })
})
