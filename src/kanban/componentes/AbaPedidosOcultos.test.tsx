import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { AbaPedidosOcultos } from './AbaPedidosOcultos'
import { diasParaSair } from '@/kanban/pcpSaida'
import type { PedidoOculto } from '@/kanban/pcpSaida'

/**
 * SESSAO-50 (bloco B — respostas do dono de 12/11): a aba "Pedidos ocultos" —
 * os ocultados dos últimos N dias, quem ocultou e quando, quantas peças saíram
 * junto; "Recuperar" diz com quantos produtos o pedido volta ao PCP (as vagas
 * abertas — nenhuma peça volta para coluna). O admin muda os N dias ali mesmo.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { listarOcultos, recuperarPedido, mudarDiasOcultos, papel } = vi.hoisted(() => ({
  listarOcultos: vi.fn(),
  recuperarPedido: vi.fn(),
  mudarDiasOcultos: vi.fn(),
  papel: { valor: 'admin' as string },
}))
vi.mock('@/kanban/pcpSaida', async (original) => ({
  ...(await original<typeof import('@/kanban/pcpSaida')>()),
  listarOcultos,
  recuperarPedido,
  mudarDiasOcultos,
}))
vi.mock('@/autenticacao/sessao-contexto', () => ({
  useSessao: () => ({ perfil: { id: 'u1', papel: papel.valor } }),
}))

const linha = (extra: Partial<PedidoOculto> = {}): PedidoOculto => ({
  card_id: 900,
  pedido_id: 77,
  numero: 13270,
  cliente_nome: 'Cliente Teste',
  data_pedido: '2026-09-01',
  situacao: 'Preparando envio',
  oculto_em: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  oculto_por: 'Guilherme',
  motivo: 'oculto',
  texto: null,
  pecas_ocultadas: 2,
  a_liberar: 7,
  fora_pelo_tiny: false,
  dias: 30,
  tem_mais: false,
  ...extra,
})

function renderizar() {
  render(
    <MemoryRouter initialEntries={['/fabrica/producao/pcp?aba=ocultos']}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ProvedorNotificacao>
          <AbaPedidosOcultos />
        </ProvedorNotificacao>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  listarOcultos.mockReset()
  recuperarPedido.mockReset()
  mudarDiasOcultos.mockReset()
  papel.valor = 'admin'
})

describe('A aba "Pedidos ocultos"', () => {
  it('mostra quem ocultou, quando, quanto falta para sair da lista e as peças que saíram junto', async () => {
    listarOcultos.mockResolvedValue({ dias: 30, linhas: [linha()], proxima: null })
    renderizar()
    const item = (await screen.findByText('Pedido 13270')).closest('li')!
    expect(within(item).getByText('Oculto do PCP')).toBeInTheDocument()
    expect(within(item).getByText(/Ocultado por Guilherme em .* · sai da lista em 28 dias/)).toBeInTheDocument()
    expect(within(item).getByText(/2 peças saíram junto do quadro · 7 produtos para liberar ao recuperar/)).toBeInTheDocument()
    expect(screen.getByText('Ficam aqui por 30 dias.')).toBeInTheDocument()
  })

  it('"Recuperar": a janela diz com quantos produtos ele volta e que as peças não voltam para coluna', async () => {
    listarOcultos.mockResolvedValue({ dias: 30, linhas: [linha()], proxima: null })
    recuperarPedido.mockResolvedValue({ feito: true, numero: 13270, a_liberar: 7, standby: false })
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Recuperar' }))
    expect(
      screen.getByText('O pedido 13270 volta ao PCP com 7 produtos para liberar.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/não voltam para a coluna onde estavam/)).toBeInTheDocument()
    const janela = screen.getByRole('dialog')
    await userEvent.click(within(janela).getByRole('button', { name: 'Recuperar' }))
    await waitFor(() => expect(recuperarPedido).toHaveBeenCalledWith(900))
    expect(await screen.findByText('Pedido 13270 voltou ao PCP')).toBeInTheDocument()
  })

  it('o admin muda os dias ali mesmo (1 a 365)', async () => {
    listarOcultos.mockResolvedValue({ dias: 30, linhas: [], proxima: null })
    mudarDiasOcultos.mockResolvedValue(45)
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Mudar' }))
    const campo = screen.getByLabelText('Ficam aqui por')
    await userEvent.clear(campo)
    await userEvent.type(campo, '400')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Escolha de 1 a 365 dias.')).toBeInTheDocument()
    expect(mudarDiasOcultos).not.toHaveBeenCalled()
    await userEvent.clear(campo)
    await userEvent.type(campo, '45')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(mudarDiasOcultos).toHaveBeenCalledWith(45))
  })

  it('quem não é admin vê o prazo, sem o "Mudar"', async () => {
    papel.valor = 'operador'
    listarOcultos.mockResolvedValue({ dias: 30, linhas: [], proxima: null })
    renderizar()
    expect(await screen.findByText('Ficam aqui por 30 dias.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mudar' })).not.toBeInTheDocument()
  })
})

describe('quantos dias faltam para sair da lista', () => {
  it('arredonda para cima e nunca fica negativo', () => {
    const agora = Date.parse('2026-11-12T12:00:00Z')
    expect(diasParaSair('2026-11-12T12:00:00Z', 30, agora)).toBe(30)
    expect(diasParaSair('2026-10-14T12:00:00Z', 30, agora)).toBe(1)
    expect(diasParaSair('2026-10-01T12:00:00Z', 30, agora)).toBe(0)
  })
})
