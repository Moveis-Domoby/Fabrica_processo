import { describe, expect, it, vi } from 'vitest'
import { render as renderCru, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CartaoUnidade } from './CartaoUnidade'
import type { Card, PedidoDoCard } from '../tipos'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/perfil/api', () => ({ urlDaFoto: () => null }))

const AGORA = new Date(2026, 9, 21, 10, 0).getTime()

// as etiquetas do card leem o catálogo pelo cache da tela
function render(ui: ReactElement) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return renderCru(<QueryClientProvider client={cliente}>{ui}</QueryClientProvider>)
}

const peca: Card = {
  id: 501,
  tipo: 'unidade',
  pedido_id: 77,
  produto_tiny_id: null,
  card_pai_id: null,
  item_seq: 1,
  item_codigo: 'X1',
  item_descricao: 'Closet fechado 3 nichos',
  indice_unidade: 1,
  total_unidades: 1,
  setor_atual_id: 6,
  etapa_atual_id: 29,
  desde: new Date(AGORA - 3_600_000).toISOString(),
  executor_atual_id: null,
  responsavel_id: null,
  delegado_em: null,
  qualidade_atual: null,
  concluido_em: null,
  pausado_em: null,
  liberado_completo_em: null,
}

const pedido = {
  pedido_id: 77,
  numero: 13696,
  cliente_nome: 'Giovanna Soares de Oliveira',
  situacao: 'Preparando envio',
  data_prevista: '2026-10-22',
  entrou_pcp_em: null,
  liberado_completo_em: null,
} as PedidoDoCard

describe('o card de produção (SESSAO-38)', () => {
  it('não mostra o nome do cliente no quadro do setor — nem no computador', () => {
    render(<CartaoUnidade card={peca} pedido={pedido} agora={AGORA} />)
    expect(screen.queryByText(/Giovanna/)).toBeNull()
    expect(screen.getByText('Pedido 13696')).toBeTruthy()
  })

  it('mostra a data de entrega (a do servidor primeiro) com a cor do que falta', () => {
    render(
      <CartaoUnidade
        card={{ ...peca, data_entrega: '2026-10-30' }}
        pedido={pedido}
        agora={AGORA}
      />,
    )
    const chip = screen.getByRole('img', { name: /faltam 9 dias/ })
    expect(chip.textContent).toBe('30/10')
  })

  it('o urgente se destaca: escrito, com a bolinha vermelha e a borda forte', () => {
    const { container } = render(
      <CartaoUnidade
        card={{ ...peca, prioridade: 'urgente', prioridade_herdada: true }}
        pedido={pedido}
        agora={AGORA}
      />,
    )
    expect(screen.getByText('Urgente')).toBeTruthy()
    expect(container.querySelector('article')?.className).toMatch(/border-danificado-forte/)
  })

  it('o comum ganha só a bolinha verde (com nome para o leitor de tela)', () => {
    render(<CartaoUnidade card={peca} pedido={pedido} agora={AGORA} />)
    expect(screen.getByRole('img', { name: 'Prioridade: Comum' })).toBeTruthy()
  })

  it('no fim de linha não há prazo', () => {
    render(<CartaoUnidade card={peca} pedido={pedido} agora={AGORA} terminal />)
    expect(screen.queryByRole('img', { name: /Entrega/ })).toBeNull()
  })
})

describe('o tempo do móvel no card (SESSAO-42)', () => {
  const rodando = {
    ...peca,
    executor_atual_id: 'u1',
    etapa_atual_id: 30,
  }

  it('em execução mostra o tempo do móvel que veio do banco, não o relógio desde o início', () => {
    render(
      <CartaoUnidade
        card={rodando}
        pedido={pedido}
        agora={AGORA}
        executorNome="Franklin"
        execucaoDesde={new Date(AGORA - 5 * 3_600_000).toISOString()}
        tempoVivo={{
          setor_id: 6,
          fechado_s: 600,
          fila_s: 0,
          desde: new Date(AGORA - 30 * 60_000).toISOString(),
          corte: null,
          dividir: 1,
          usuario_id: 'u1',
          lote: 'lote-1',
        }}
      />,
    )
    // 10 min fechados + 30 min rodando (sem a régua, o relógio)
    expect(screen.getByText('40min')).toBeTruthy()
    expect(screen.queryByText(/5h/)).toBeNull()
    expect(screen.getByText('em lote')).toBeTruthy()
  })

  it('pausado sozinho no fim do expediente diz isso (ícone + texto)', () => {
    render(
      <CartaoUnidade
        card={{
          ...rodando,
          pausado_em: new Date(AGORA - 60_000).toISOString(),
          pausa_motivo: 'Fim do expediente',
        }}
        pedido={pedido}
        agora={AGORA}
        executorNome="Franklin"
      />,
    )
    expect(screen.getByText('Pausado · fim do expediente')).toBeTruthy()
  })

  it('pausado sem resposta ao aviso diz isso', () => {
    render(
      <CartaoUnidade
        card={{
          ...rodando,
          pausado_em: new Date(AGORA - 60_000).toISOString(),
          pausa_motivo: 'Sem resposta ao aviso',
        }}
        pedido={pedido}
        agora={AGORA}
        executorNome="Franklin"
      />,
    )
    expect(screen.getByText('Pausado · sem resposta ao aviso')).toBeTruthy()
  })
})
