import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ModalNovoPedido } from './ModalNovoPedido'
import type { ListaIncluir } from '@/kanban/pcpSaida'
import type { Setor } from '@/kanban/tipos'

/**
 * SESSAO-50 (bloco B): "Incluir pedido no PCP" — os ocultos de qualquer idade
 * ("Oculto em dd/mm", trazer de volta = a recuperação da aba) e os pedidos sem
 * card, paginados no servidor pelo número e pedidos ao rolar (Lei §6: a lista
 * antiga contava e calculava todos os pedidos antes de mostrar 8).
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { listarParaIncluir, recuperarPedido, criarCardPedido, observadores } = vi.hoisted(() => ({
  listarParaIncluir: vi.fn(),
  recuperarPedido: vi.fn(),
  criarCardPedido: vi.fn(),
  observadores: [] as Array<(entradas: Array<{ isIntersecting: boolean }>) => void>,
}))
vi.mock('@/kanban/pcpSaida', async (original) => ({
  ...(await original<typeof import('@/kanban/pcpSaida')>()),
  listarParaIncluir,
  recuperarPedido,
}))
vi.mock('@/kanban/api', async (original) => ({
  ...(await original<typeof import('@/kanban/api')>()),
  criarCardPedido,
}))
vi.mock('@/autenticacao/sessao-contexto', () => ({
  useSessao: () => ({ perfil: { id: 'u1', papel: 'admin' } }),
}))

beforeAll(() => {
  // o jsdom não tem o observador de rolagem: guardamos o aviso para "rolar" no teste
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (entradas: Array<{ isIntersecting: boolean }>) => void) {
        observadores.push(cb)
      }
      observe() {}
      disconnect() {}
    },
  )
})

const setorPcp = { id: 1, codigo: 'pcp', nome: 'PCP' } as unknown as Setor

const pagina1: ListaIncluir = {
  ocultos: [
    {
      card_id: 900,
      pedido_id: 77,
      numero: 13270,
      cliente_nome: 'Cliente Oculto',
      data_pedido: '2026-09-01',
      situacao: 'Preparando envio',
      oculto_em: '2026-09-20T12:00:00Z',
      oculto_por: 'Guilherme',
      motivo: 'oculto',
      texto: null,
      pecas_ocultadas: 0,
      a_liberar: 3,
      fora_pelo_tiny: false,
    },
  ],
  sem_card: [
    {
      pedido_id: 501,
      numero: 12001,
      cliente_nome: 'Cliente Antigo',
      data_pedido: '2026-08-10',
      situacao: 'Preparando envio',
      total_itens: 1,
      total_unidades: 2,
    },
  ],
  proximo: 12001,
}

const pagina2: ListaIncluir = {
  ocultos: [],
  sem_card: [
    {
      pedido_id: 502,
      numero: 11950,
      cliente_nome: 'Cliente Mais Antigo',
      data_pedido: '2026-08-01',
      situacao: 'Aprovado',
      total_itens: 1,
      total_unidades: 1,
    },
  ],
  proximo: null,
}

function renderizar(aoFechar = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ProvedorNotificacao>
        <ModalNovoPedido aberto setorPcp={setorPcp} aoFechar={aoFechar} />
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
  return aoFechar
}

afterEach(() => {
  listarParaIncluir.mockReset()
  recuperarPedido.mockReset()
  criarCardPedido.mockReset()
  observadores.length = 0
})

describe('"Incluir pedido no PCP"', () => {
  it('mostra os ocultos e os pedidos sem card, e pede a página seguinte pelo número ao rolar', async () => {
    listarParaIncluir.mockImplementation(({ antesNumero }: { antesNumero: number | null }) =>
      Promise.resolve(antesNumero === null ? pagina1 : pagina2),
    )
    renderizar()
    expect(await screen.findByText('Pedido 13270')).toBeInTheDocument()
    expect(screen.getByText(/Oculto em/)).toBeInTheDocument()
    expect(screen.getByText('3 produtos para liberar')).toBeInTheDocument()
    expect(screen.getByText('Pedido 12001')).toBeInTheDocument()
    expect(listarParaIncluir).toHaveBeenCalledWith({ busca: null, limite: 8, antesNumero: null })

    // "rolar" até o fim da lista: a âncora avisa e a 2ª página vem pelo cursor
    observadores.at(-1)!([{ isIntersecting: true }])
    expect(await screen.findByText('Pedido 11950')).toBeInTheDocument()
    expect(listarParaIncluir).toHaveBeenLastCalledWith({ busca: null, limite: 8, antesNumero: 12001 })
    // o pedido da 1ª página continua na tela (a lista cresce, não troca)
    expect(screen.getByText('Pedido 12001')).toBeInTheDocument()
  })

  it('trazer de volta um oculto faz a mesma recuperação da aba e diz quantos produtos voltam para liberar', async () => {
    listarParaIncluir.mockResolvedValue({ ...pagina1, proximo: null })
    recuperarPedido.mockResolvedValue({ feito: true, numero: 13270, a_liberar: 3, fora_pelo_tiny: false, situacao: null })
    const aoFechar = renderizar()
    const usuario = userEvent.setup()
    await usuario.click(await screen.findByRole('option', { name: /Pedido 13270/ }))
    await usuario.click(screen.getByRole('button', { name: 'Trazer de volta ao PCP' }))
    await waitFor(() => expect(recuperarPedido).toHaveBeenCalledWith(900))
    expect(await screen.findByText('Pedido 13270 voltou ao PCP')).toBeInTheDocument()
    expect(aoFechar).toHaveBeenCalled()
    expect(criarCardPedido).not.toHaveBeenCalled()
  })

  it('o pedido sem card ganha o card no PCP', async () => {
    listarParaIncluir.mockResolvedValue({ ...pagina1, proximo: null })
    criarCardPedido.mockResolvedValue(1234)
    renderizar()
    const usuario = userEvent.setup()
    const opcao = await screen.findByRole('option', { name: /Pedido 12001/ })
    await usuario.click(opcao)
    expect(within(opcao).getByText('✓ escolhido')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Criar card no PCP' }))
    await waitFor(() =>
      expect(criarCardPedido).toHaveBeenCalledWith({ pedidoId: 501, setorPcpId: 1, usuarioId: 'u1' }),
    )
    expect(await screen.findByText('Card do pedido 12001 criado no PCP')).toBeInTheDocument()
  })

  it('a busca vai ao servidor do começo (sem cursor)', async () => {
    listarParaIncluir.mockResolvedValue({ ocultos: [], sem_card: [], proximo: null })
    renderizar()
    const usuario = userEvent.setup()
    await usuario.type(await screen.findByLabelText('Buscar pedido'), '13')
    await waitFor(() =>
      expect(listarParaIncluir).toHaveBeenLastCalledWith({ busca: '13', limite: 8, antesNumero: null }),
    )
    expect(await screen.findByText(/Nenhum pedido para incluir/)).toBeInTheDocument()
  })
})
