import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ModalPecaCancelada } from './ModalPecaCancelada'
import type { AvisoPcpJanela } from '@/kanban/api'

/**
 * SESSAO-48 (frente 2) ↪️ SESSAO-50 (bloco B): a janela "O que aconteceu?" do
 * PCP — lê numa requisição ao abrir e mostra as peças que saíram da produção,
 * o que o pedido ainda tem e as vagas; as saídas passam a ser "Produzir de
 * novo", "Cancelar pedido" e "Ocultar do PCP" (o "Remover do PCP" com três
 * motivos deixou de existir). Com 3 ou mais peças canceladas em 24 h, o aviso
 * do laço.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { lerAvisoPcp, resolverAvisoPcp } = vi.hoisted(() => ({
  lerAvisoPcp: vi.fn(),
  resolverAvisoPcp: vi.fn(),
}))
vi.mock('@/kanban/api', () => ({ lerAvisoPcp, resolverAvisoPcp }))

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
  canceladas_24h: 2,
  tiny_ligado: true,
  cancelado_plataforma_em: null,
  excluido_no_tiny: false,
  ocultos_dias: 30,
  ...extra,
})

function renderizar(cardId: number | null = 900) {
  const aoFechar = vi.fn()
  const aoCancelar = vi.fn()
  const aoOcultar = vi.fn()
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProvedorNotificacao>
        <ModalPecaCancelada
          cardId={cardId}
          aoFechar={aoFechar}
          aoCancelar={aoCancelar}
          aoOcultar={aoOcultar}
        />
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
  return { aoFechar, aoCancelar, aoOcultar }
}

afterEach(() => {
  lerAvisoPcp.mockReset()
  resolverAvisoPcp.mockReset()
})

describe('A janela "O que aconteceu?"', () => {
  it('lê numa requisição e mostra as peças, o que o pedido ainda tem, as vagas e as três saídas', async () => {
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
    expect(screen.getByRole('button', { name: 'Cancelar pedido' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Ocultar do PCP' })).toBeEnabled()
    // o "Remover do PCP" com três motivos deixou de existir
    expect(screen.queryByRole('button', { name: 'Remover do PCP' })).not.toBeInTheDocument()
    expect(screen.getByText(/fica em "Pedidos ocultos" por 30 dias/)).toBeInTheDocument()
    // sem o laço (2 em 24 h)
    expect(screen.queryByText(/estão sendo canceladas várias vezes/)).not.toBeInTheDocument()
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

  it('"Cancelar pedido" e "Ocultar do PCP" levam ao modal do gesto (a página troca a janela)', async () => {
    lerAvisoPcp.mockResolvedValue(janela())
    const { aoCancelar, aoOcultar } = renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar pedido' }))
    expect(aoCancelar).toHaveBeenCalledWith(13622)
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar do PCP' }))
    expect(aoOcultar).toHaveBeenCalledWith(13622)
  })

  it('o laço: 3 ou mais peças canceladas em 24 h mudam o aviso', async () => {
    lerAvisoPcp.mockResolvedValue(janela({ canceladas_24h: 31 }))
    renderizar()
    expect(
      await screen.findByText(/As peças deste pedido estão sendo canceladas várias vezes\./),
    ).toBeInTheDocument()
    expect(screen.getByText(/Se ele não vai ser produzido, cancele ou oculte o pedido\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar pedido' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ocultar do PCP' })).toBeInTheDocument()
  })

  it('aviso já resolvido: diz isso e oferece cancelar ou ocultar', async () => {
    lerAvisoPcp.mockResolvedValue(janela({ aviso: null }))
    renderizar()
    expect(await screen.findByText('O aviso deste pedido já foi resolvido.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Produzir de novo' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar pedido' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ocultar do PCP' })).toBeInTheDocument()
  })

  it('pedido já oculto: diz quem ocultou e onde recuperar, sem as saídas', async () => {
    lerAvisoPcp.mockResolvedValue(
      janela({
        aviso: null,
        removido: { em: '2026-11-11T12:00:00Z', motivo: 'oculto', texto: null, por: 'Guilherme' },
      }),
    )
    renderizar()
    expect(
      await screen.findByText(/Ocultado do PCP por Guilherme em .* use a aba "Pedidos ocultos"/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Produzir de novo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument()
  })

  it('pedido excluído no Tiny: diz isso e não oferece saída (ele já saiu do PCP)', async () => {
    lerAvisoPcp.mockResolvedValue(janela({ excluido_no_tiny: true }))
    renderizar()
    expect(
      await screen.findByText(/Este pedido não existe mais no Tiny \(foi excluído\)/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ocultar do PCP' })).not.toBeInTheDocument()
  })
})
