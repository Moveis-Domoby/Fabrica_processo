import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ModalPecaCancelada } from './ModalPecaCancelada'
import type { AvisoPcpJanela } from '@/kanban/api'

/**
 * SESSAO-48 (frente 2): a janela "O que aconteceu?" do PCP — lê numa
 * requisição ao abrir e mostra as peças que saíram da produção (de qual
 * coluna, quem e quando), o que o pedido ainda tem e as vagas; as saídas são
 * "Produzir de novo" e "Remover do PCP" com os três motivos (dois com texto
 * obrigatório; "O pedido foi cancelado" lembra de cancelar no Tiny).
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { lerAvisoPcp, resolverAvisoPcp, removerDoPcp } = vi.hoisted(() => ({
  lerAvisoPcp: vi.fn(),
  resolverAvisoPcp: vi.fn(),
  removerDoPcp: vi.fn(),
}))
vi.mock('@/kanban/api', () => ({ lerAvisoPcp, resolverAvisoPcp, removerDoPcp }))

const janela = (extra: Partial<AvisoPcpJanela> = {}): AvisoPcpJanela => ({
  card_id: 900,
  pedido_id: 77,
  numero: 13622,
  cliente: 'Cliente Teste',
  situacao: 'Em aberto',
  cancelado_no_tiny: false,
  aviso: { desde: '2026-10-19T22:24:00Z', pecas: 2, motivo: 'cancelada' },
  removido: null,
  liberado_completo: false,
  vagas: 31,
  vagas_abertas: 2,
  canceladas: [
    {
      card_id: 501,
      descricao: 'Estante Basic 7 nichos – Branca',
      sku: '422',
      indice: 1,
      total: 2,
      motivo: 'cancelada',
      setor: 'LIMPEZA E EMBALAGEM',
      etapa: 'CANCELADO',
      quem: 'Guilherme',
      quando: '2026-10-19T22:24:00Z',
      cancelada_em: '2026-10-19T22:24:00Z',
      arquivada: false,
      nova: true,
    },
    {
      card_id: 502,
      descricao: 'Estante Basic 7 nichos – Branca',
      sku: '422',
      indice: 2,
      total: 2,
      motivo: 'nao_encontrada',
      setor: 'LIMPEZA E EMBALAGEM',
      etapa: 'NÃO ENCONTRADO',
      quem: null,
      quando: '2026-10-19T22:25:00Z',
      cancelada_em: '2026-10-19T22:25:00Z',
      arquivada: true,
      nova: true,
    },
  ],
  canceladas_total: 2,
  pecas: {
    em_producao: 1,
    prontas: 0,
    onde: [{ setor: 'LIMPEZA E EMBALAGEM', etapa: 'A LIMPAR', pronta: false, pecas: 1 }],
  },
  ...extra,
})

function renderizar(cardId: number | null = 900) {
  const aoFechar = vi.fn()
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProvedorNotificacao>
        <ModalPecaCancelada cardId={cardId} aoFechar={aoFechar} />
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
  return { aoFechar }
}

afterEach(() => {
  lerAvisoPcp.mockReset()
  resolverAvisoPcp.mockReset()
  removerDoPcp.mockReset()
})

describe('A janela "O que aconteceu?"', () => {
  it('lê numa requisição e mostra as peças, o que o pedido ainda tem e as vagas', async () => {
    lerAvisoPcp.mockResolvedValue(janela())
    renderizar()
    expect(await screen.findByText('2 peças canceladas na produção')).toBeInTheDocument()
    expect(screen.getByText('Pedido 13622 · Cliente Teste')).toBeInTheDocument()
    expect(screen.getByText('Peças que saíram da produção (2)')).toBeInTheDocument()
    expect(screen.getAllByText('Estante Basic 7 nichos – Branca (1/2)')).toHaveLength(1)
    expect(
      screen.getByText(/Cancelada na coluna CANCELADO · LIMPEZA E EMBALAGEM · por Guilherme/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Não encontrada na coluna NÃO ENCONTRADO .*já saiu da coluna \(arquivada\)/),
    ).toBeInTheDocument()
    expect(screen.getByText(/1 em A LIMPAR \(LIMPEZA E EMBALAGEM\)/)).toBeInTheDocument()
    expect(screen.getByText('2 de 31')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Produzir de novo' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Remover do PCP' })).toBeEnabled()
    expect(lerAvisoPcp).toHaveBeenCalledTimes(1)
    expect(lerAvisoPcp).toHaveBeenCalledWith(900)
  })

  it('fechada, não pede nada ao banco', () => {
    renderizar(null)
    expect(lerAvisoPcp).not.toHaveBeenCalled()
  })

  it('"Produzir de novo" fecha o aviso e a janela', async () => {
    lerAvisoPcp.mockResolvedValue(janela())
    resolverAvisoPcp.mockResolvedValue({ feito: true, numero: 13622, vagas_abertas: 2 })
    const { aoFechar } = renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Produzir de novo' }))
    await waitFor(() => expect(resolverAvisoPcp).toHaveBeenCalledWith(900))
    expect(await screen.findByText('Pedido 13622: vai produzir de novo')).toBeInTheDocument()
    await waitFor(() => expect(aoFechar).toHaveBeenCalled())
  })

  it('"Remover do PCP": os três motivos; o cancelado lembra do Tiny; "O que houve?" é obrigatório; avisa as peças que seguem', async () => {
    lerAvisoPcp.mockResolvedValue(janela())
    removerDoPcp.mockResolvedValue({
      feito: true,
      numero: 13622,
      motivo: 'fora_da_linha',
      em_producao: 1,
      prontas: 0,
      onde: [],
    })
    const { aoFechar } = renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Remover do PCP' }))

    const confirmar = screen.getByRole('button', { name: 'Remover do PCP' })
    expect(confirmar).toBeDisabled()
    for (const rotulo of [
      'O pedido foi cancelado',
      'Tirar o pedido da linha de produção',
      'Outro motivo',
    ]) {
      expect(screen.getByRole('button', { name: rotulo })).toHaveAttribute('aria-pressed', 'false')
    }
    expect(
      screen.getByText(
        'Este pedido ainda tem 1 peça em A LIMPAR. Para cancelar a fabricação dela, mova para CANCELADO.',
      ),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'O pedido foi cancelado' }))
    expect(screen.getByText('Cancele também no Tiny.')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Tirar o pedido da linha de produção' }),
    )
    expect(screen.queryByText('Cancele também no Tiny.')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remover do PCP' }))
    expect(await screen.findByText('Conte o que houve com o pedido.')).toBeInTheDocument()
    expect(removerDoPcp).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText('O que houve?'), 'o cliente vai buscar na loja')
    await userEvent.click(screen.getByRole('button', { name: 'Remover do PCP' }))
    await waitFor(() =>
      expect(removerDoPcp).toHaveBeenCalledWith({
        cardId: 900,
        motivo: 'fora_da_linha',
        texto: 'o cliente vai buscar na loja',
      }),
    )
    expect(await screen.findByText('Pedido 13622 removido do PCP')).toBeInTheDocument()
    await waitFor(() => expect(aoFechar).toHaveBeenCalled())
  })

  it('"Outro motivo" também pede o texto; "Voltar" volta para o que aconteceu', async () => {
    lerAvisoPcp.mockResolvedValue(janela())
    removerDoPcp.mockResolvedValue({
      feito: true,
      numero: 13622,
      motivo: 'outro',
      em_producao: 1,
      prontas: 0,
      onde: [],
    })
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Remover do PCP' }))
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByRole('button', { name: 'Produzir de novo' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Remover do PCP' }))
    await userEvent.click(screen.getByRole('button', { name: 'Outro motivo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remover do PCP' }))
    expect(await screen.findByText('Escreva o motivo.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Qual o motivo?'), 'pedido duplicado')
    await userEvent.click(screen.getByRole('button', { name: 'Remover do PCP' }))
    await waitFor(() =>
      expect(removerDoPcp).toHaveBeenCalledWith({
        cardId: 900,
        motivo: 'outro',
        texto: 'pedido duplicado',
      }),
    )
  })

  it('aviso já resolvido: diz isso e só oferece "Remover do PCP"', async () => {
    lerAvisoPcp.mockResolvedValue(janela({ aviso: null }))
    renderizar()
    expect(await screen.findByText('O aviso deste pedido já foi resolvido.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Produzir de novo' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover do PCP' })).toBeInTheDocument()
  })

  it('pedido já removido: diz quem removeu e por quê, sem as saídas', async () => {
    lerAvisoPcp.mockResolvedValue(
      janela({
        aviso: null,
        removido: {
          em: '2026-11-11T12:00:00Z',
          motivo: 'fora_da_linha',
          texto: 'o cliente vai buscar na loja',
          por: 'Guilherme',
        },
      }),
    )
    renderizar()
    expect(
      await screen.findByText(
        /Removido do PCP por Guilherme em .* — Tirado da linha de produção: o cliente vai buscar na loja/,
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Produzir de novo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover do PCP' })).not.toBeInTheDocument()
  })
})
