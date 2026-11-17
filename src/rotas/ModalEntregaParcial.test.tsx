import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ModalEntregaParcial } from './ModalEntregaParcial'
import type { AberturaEntregaParcial } from './api'

/**
 * SESSAO-51 (frentes 1 e 2 — pedido do dono de 16/11): a janela separa o que
 * saiu para a entrega (prontas, marcadas) do que ainda está na fábrica (peças
 * em produção desmarcadas + os produtos ainda no PCP) e pergunta o que fazer
 * com o que ficou: "Deixar em produção" (o entregador só tem esta) ou
 * "Limpar da produção" (logística, PCP e admin).
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { abrirEntregaParcial, registrarEntregaParcial } = vi.hoisted(() => ({
  abrirEntregaParcial: vi.fn(),
  registrarEntregaParcial: vi.fn(),
}))
vi.mock('./api', async (original) => ({
  ...(await original<typeof import('./api')>()),
  abrirEntregaParcial,
  registrarEntregaParcial,
}))

const abertura = (extra: Partial<AberturaEntregaParcial> = {}): AberturaEntregaParcial => ({
  pecas: [
    { id: 1, descricao: 'Guarda-roupa 3/4', item_seq: 1, indice: 1, total: 5, pronta: true, onde: 'PEDIDOS EM AGUARDO', setor: 'PEDIDOS EM AGUARDO', etapa: null },
    { id: 2, descricao: 'Guarda-roupa 3/4', item_seq: 1, indice: 2, total: 5, pronta: true, onde: 'ROTAS', setor: 'ROTAS', etapa: null },
    { id: 3, descricao: 'Guarda-roupa 3/4', item_seq: 1, indice: 3, total: 5, pronta: false, onde: 'MONTAGEM', setor: 'MONTAGEM', etapa: 'Montando' },
    { id: 4, descricao: 'Guarda-roupa 3/4', item_seq: 1, indice: 4, total: 5, pronta: false, onde: 'FITAMENTO', setor: 'FITAMENTO', etapa: 'Fila' },
  ],
  vagas: 1,
  motivos: [{ id: 9, texto: 'Cliente sem espaço' }],
  pode_limpar: false,
  recusa: null,
  ...extra,
})

function renderizar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ProvedorNotificacao>
        <ModalEntregaParcial pedido={{ card_id: 50, numero: 13871, cliente_nome: 'Cliente Teste' }} aoFechar={() => {}} />
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  abrirEntregaParcial.mockReset()
  registrarEntregaParcial.mockReset()
})

describe('A janela da entrega parcial', () => {
  it('separa as prontas (marcadas) do que está na fábrica (desmarcado, com setor e etapa) e mostra os produtos no PCP', async () => {
    abrirEntregaParcial.mockResolvedValue(abertura())
    renderizar()
    expect(await screen.findByText('Saíram para a entrega')).toBeInTheDocument()
    expect(screen.getByText('Ainda na fábrica')).toBeInTheDocument()
    const caixas = screen.getAllByRole('checkbox')
    expect(caixas.map((c) => (c as HTMLInputElement).checked)).toEqual([true, true, false, false])
    expect(screen.getByText('MONTAGEM · Montando')).toBeInTheDocument()
    expect(screen.getByText('+ 1 produto ainda no PCP, sem liberar')).toBeInTheDocument()
  })

  it('o entregador só tem "Deixar em produção" — e é ela que vai ao banco', async () => {
    abrirEntregaParcial.mockResolvedValue(abertura())
    registrarEntregaParcial.mockResolvedValue({ fabrica: 'manter' })
    renderizar()
    expect(await screen.findByText('E o que ainda está na fábrica?')).toBeInTheDocument()
    expect(screen.getByText('Deixar em produção')).toBeInTheDocument()
    expect(screen.queryByText('Limpar da produção')).not.toBeInTheDocument()
    expect(screen.getByText(/As 2 peças seguem onde estão e o produto segue no PCP para liberar/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cliente sem espaço' }))
    await userEvent.click(screen.getByRole('button', { name: /Registrar entrega parcial/ }))
    await waitFor(() => expect(registrarEntregaParcial).toHaveBeenCalled())
    expect(registrarEntregaParcial.mock.calls[0][0]).toMatchObject({ cardId: 50, entregues: [1, 2], fabrica: 'manter' })
  })

  it('a logística escolhe "Limpar da produção"', async () => {
    abrirEntregaParcial.mockResolvedValue(abertura({ pode_limpar: true }))
    registrarEntregaParcial.mockResolvedValue({ fabrica: 'limpar' })
    renderizar()
    await userEvent.click(await screen.findByText('Limpar da produção'))
    expect(screen.getByText(/As 2 peças saem dos quadros e o produto sai do PCP/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Observação'), 'só duas couberam')
    await userEvent.click(screen.getByRole('button', { name: /Registrar entrega parcial/ }))
    await waitFor(() => expect(registrarEntregaParcial).toHaveBeenCalled())
    expect(registrarEntregaParcial.mock.calls[0][0]).toMatchObject({ fabrica: 'limpar' })
  })

  it('sem nada na fábrica, a janela é a de antes (sem a pergunta)', async () => {
    abrirEntregaParcial.mockResolvedValue(abertura({ pecas: abertura().pecas.slice(0, 2), vagas: 0 }))
    renderizar()
    expect(await screen.findByText('Saíram para a entrega')).toBeInTheDocument()
    expect(screen.queryByText('Ainda na fábrica')).not.toBeInTheDocument()
    expect(screen.queryByText('E o que ainda está na fábrica?')).not.toBeInTheDocument()
  })

  it('marcar uma peça que ainda está na fábrica pede a confirmação de sempre', async () => {
    abrirEntregaParcial.mockResolvedValue(abertura())
    registrarEntregaParcial.mockRejectedValueOnce(
      new Error('Uma peça marcada como entregue ainda aparece em produção na fábrica (2 de 4 peças prontas). Confirme só se ela foi mesmo entregue.'),
    )
    renderizar()
    const caixas = await screen.findAllByRole('checkbox')
    await userEvent.click(caixas[2])
    await userEvent.click(screen.getByRole('button', { name: 'Cliente sem espaço' }))
    await userEvent.click(screen.getByRole('button', { name: /Registrar entrega parcial/ }))
    expect(await screen.findByRole('button', { name: /Confirmar a entrega parcial/ })).toBeInTheDocument()
  })
})
