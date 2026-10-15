import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { TodosOsPedidos } from './PaginaPedidos'
import { rotuloDoCampo, valorDoTiny } from './formato'
import * as api from './api'
import * as kanbanApi from '@/kanban/api'

/**
 * A área Pedidos (ajustes do dono, 14/10 noite): a linha mostra o que se lê
 * de relance (quem vendeu, o valor, a situação); tocar abre a ficha (1
 * requisição); a Produção e os Dados do Tiny só buscam no clique dos botões.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
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
vi.mock('@/utilitarios/CamposDoCard', () => ({ CamposDoCard: () => null }))
vi.mock('@/autenticacao/sessao-contexto', () => ({
  useSessao: () => ({ perfil: { id: 'u1', papel: 'admin' } }),
}))
vi.mock('./api', async (original) => {
  const real = await original<typeof import('./api')>()
  return {
    ...real,
    listarPedidos: vi.fn(async () => [
      {
        pedido_id: 77,
        numero: 13623,
        cliente_nome: 'Cliente Teste',
        data_pedido: '2026-10-08',
        data_prevista: '2026-10-16',
        situacao: 'Faturado',
        total_pedido: 9411,
        vendedor: 'Gessica',
        marcadores: ['Online', 'Instagram'],
        total_unidades: 14,
        unidades_liberadas: 0,
        unidades_prontas: 0,
        card_id: 900,
        situacao_plataforma: 'tiny',
        entregue_em: null,
        entregue_por: null,
        entregue_fonte: null,
        entregue_tiny: null,
        cancelado_em: null,
        tem_mais: false,
        contagem_total: 1,
      },
    ]),
    producaoDoPedido: vi.fn(async () => ({ pecas: [], pessoas: [], segundos: 0 })),
    dadosDoTiny: vi.fn(async () => ({
      pedido: { nome_vendedor: 'Gessica' },
      atualizado_em: null,
      cliente: null,
      notas_fiscais: [],
      contas_receber: [],
    })),
  }
})
vi.mock('@/kanban/api', async (original) => {
  const real = await original<typeof import('@/kanban/api')>()
  return {
    ...real,
    detalhePedidoPcp: vi.fn(async () => ({
      pedido: {
        id: 77,
        numero: 13623,
        situacao: 'Faturado',
        origem: null,
        data_pedido: '2026-10-08',
        data_prevista: '2026-10-16',
        data_faturamento: '09/10/2026',
        data_envio: null,
        data_entrega_tiny: null,
        total_produtos: 9411,
        valor_frete: 0,
        valor_desconto: null,
        outras_despesas: null,
        total_pedido: 9411,
        forma_pagamento: 'CARTÃO - 10X',
        meio_pagamento: null,
        condicao_pagamento: null,
        qtd_parcelas: 1,
        parcelas: [],
        obs: null,
        obs_interna: null,
        marcadores: ['Online'],
        vendedor: 'Gessica',
        ecommerce: null,
        numero_ecommerce: null,
        forma_envio: null,
        forma_frete: null,
        transportador: null,
        codigo_rastreamento: null,
        url_rastreamento: null,
        atualizado_em: null,
      },
      cliente: {
        nome: 'Cliente Teste',
        fone: null,
        email: null,
        documento: null,
        endereco: null,
        numero: null,
        complemento: null,
        bairro: null,
        cidade: 'Natal',
        uf: 'RN',
        cep: null,
      },
      devolucao: null,
      plataforma: {
        card_id: 900,
        situacao: 'tiny',
        total_unidades: 14,
        lancado_rotas_em: null,
        arquivado_em: null,
        liberado_completo_em: null,
      },
      programacao: null,
      entrega: null,
      itens: [],
      unidades: [],
      contas_receber: [],
      contas_receber_ate: null,
      notas_fiscais: [],
      anexos: [],
      historico: [],
    })),
  }
})

function desenhar() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProvedorNotificacao>
        <MemoryRouter initialEntries={['/fabrica/pedidos/todos']}>
          <TodosOsPedidos />
        </MemoryRouter>
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
}

describe('Pedidos → Todos os pedidos', () => {
  it('a linha mostra quem vendeu, o valor e onde está; tocar abre a ficha; a produção só busca no clique', async () => {
    desenhar()
    expect(await screen.findByText('Pedido 13623')).toBeInTheDocument()
    expect(screen.getByText('Vendido por Gessica')).toBeInTheDocument()
    expect(screen.getByText(/9\.411,00/)).toBeInTheDocument()
    expect(screen.getByText('Segue no Tiny')).toBeInTheDocument()
    expect(kanbanApi.detalhePedidoPcp).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Abrir o pedido 13623' }))
    expect(await screen.findByText('Ainda não programado')).toBeInTheDocument()
    expect(kanbanApi.detalhePedidoPcp).toHaveBeenCalledTimes(1)
    expect(api.producaoDoPedido).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /Produção/ }))
    await waitFor(() => expect(api.producaoDoPedido).toHaveBeenCalledTimes(1))
    expect(api.dadosDoTiny).not.toHaveBeenCalled()
  })
})

describe('o nome dos campos do Tiny', () => {
  it('fica legível sem inventar tradução', () => {
    expect(rotuloDoCampo('nome_vendedor')).toBe('Nome vendedor')
    expect(rotuloDoCampo('cpf_cnpj')).toBe('CPF/CNPJ')
    expect(rotuloDoCampo('id_nota_fiscal')).toBe('Código de nota fiscal')
    expect(rotuloDoCampo('descricao_lista_preco')).toBe('Descrição lista preço')
    expect(rotuloDoCampo('condicao_pagamento')).toBe('Condição pagamento')
    expect(rotuloDoCampo('obs')).toBe('Observações')
  })

  it('o valor em código vira palavra; o escrito à mão fica como está', () => {
    expect(valorDoTiny('credito')).toBe('Crédito')
    expect(valorDoTiny('multiplas')).toBe('Múltiplas')
    expect(valorDoTiny('pix')).toBe('Pix')
    expect(valorDoTiny('Pix - terceiros')).toBe('Pix - terceiros')
    expect(valorDoTiny('CARTÃO - JAMAD - 10X')).toBe('CARTÃO - JAMAD - 10X')
    expect(valorDoTiny(null)).toBeNull()
  })
})
