import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import type { JanelaDoCard as Dados } from './api'

/**
 * SESSAO-50 (frente 4): "Cancelar pedido" e "Ocultar do PCP" em todo pedido do PCP — no quadro,
 * na aba Stand-by e na janela do card do pedido. Na janela, só para quem é do PCP, da logística
 * ou admin, só com o pedido ainda no PCP; o gesto abre o mesmo modal do quadro.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/perfil/api', () => ({ urlDaFoto: () => null }))
vi.mock('@/chat/canais', () => ({ ouvirCanal: () => () => undefined }))

let papel = 'admin'
vi.mock('@/autenticacao/sessao-contexto', () => ({
  useSessao: () => ({ perfil: { id: 'u-1', papel, nivel: null }, vinculos: [], ehLider: papel === 'admin' }),
}))

const lerSaidaPrevia = vi.fn()
vi.mock('@/kanban/pcpSaida', async (original) => ({
  ...(await original<typeof import('@/kanban/pcpSaida')>()),
  lerSaidaPrevia: (...a: unknown[]) => lerSaidaPrevia(...a),
}))

let dados: Dados
vi.mock('./api', async (original) => {
  const real = await original<typeof import('./api')>()
  return { ...real, abrirJanela: vi.fn(async () => dados) }
})

const ONTEM = new Date(Date.now() - 86_400_000).toISOString()

function janelaDoPedido(extra: { liberado?: boolean; arquivado?: boolean } = {}): Dados {
  return {
    card: {
      id: 7001,
      tipo: 'pedido',
      pedido_id: 601,
      produto_tiny_id: null,
      card_pai_id: null,
      item_seq: null,
      item_codigo: null,
      item_descricao: null,
      indice_unidade: null,
      total_unidades: null,
      setor_atual_id: 1,
      etapa_atual_id: 1,
      desde: ONTEM,
      executor_atual_id: null,
      responsavel_id: null,
      delegado_em: null,
      qualidade_atual: null,
      concluido_em: null,
      pausado_em: null,
      liberado_completo_em: extra.liberado ? ONTEM : null,
    },
    arquivado_em: extra.arquivado ? ONTEM : null,
    criado_em: ONTEM,
    setor: { id: 1, nome: 'PCP', codigo: 'pcp', papel_no_fluxo: 'entrada' },
    etapa: { id: 1, nome: 'AGUARDANDO LIBERAÇÃO', eh_fila: true },
    execucao: null,
    auxilios: [],
    pessoas: {},
    pedido: {
      pedido_id: 601,
      numero: 13270,
      cliente_nome: 'Cliente 13270',
      situacao: 'Preparando envio',
      data_prevista: '2026-11-18',
    },
    campos: [],
    etiquetas: [],
    permissoes: {
      editar: false,
      editar_nome: false,
      concluir: false,
      anexar: false,
      ver_removidos: false,
      pausar: false,
      retomar: false,
      auxiliar: false,
      sair_auxilio: false,
    },
  } as unknown as Dados
}

async function abrir() {
  const { JanelaDoCard } = await import('./JanelaDoCard')
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <ProvedorNotificacao>
        <MemoryRouter>
          <JanelaDoCard cardId={7001} aoFechar={() => undefined} />
        </MemoryRouter>
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
  return screen.findByText('Pedido 13270')
}

describe('a janela do card do pedido: Cancelar e Ocultar (SESSAO-50)', () => {
  beforeEach(() => {
    papel = 'admin'
    lerSaidaPrevia.mockReset()
  })

  it('pedido no PCP: a pergunta e os dois botões; "Ocultar do PCP" abre o modal do quadro', async () => {
    dados = janelaDoPedido()
    lerSaidaPrevia.mockResolvedValue({
      card_id: 7001, pedido_id: 601, numero: 13270, cliente: 'Cliente 13270', situacao: 'Preparando envio',
      cancelado_no_tiny: false, tiny_ligado: true, cancelado_plataforma_em: null, tiny_estado: null, oculto_em: null,
      entregue: false, arquivado: false, ocultos_dias: 30,
      pecas: { em_producao: 0, prontas: 0, onde: [] },
      ocultar: { ocultaveis: 0, ficam: 0, programado: false, onde: [] },
      reservas: 0,
    })
    await abrir()
    expect(screen.getByText('Este pedido não vai ser produzido?')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Cancelar pedido/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Ocultar do PCP/ }))
    expect(await screen.findByText('Ocultar o pedido 13270 do PCP?')).toBeTruthy()
    expect(lerSaidaPrevia).toHaveBeenCalledWith(7001)
  })

  it('pedido já todo liberado ou guardado: sem os botões', async () => {
    dados = janelaDoPedido({ liberado: true })
    await abrir()
    expect(screen.queryByText('Este pedido não vai ser produzido?')).toBeNull()
  })

  it('quem não é do PCP, da logística nem admin não vê os botões', async () => {
    papel = 'operador'
    dados = janelaDoPedido()
    await abrir()
    expect(screen.queryByRole('button', { name: /Cancelar pedido/ })).toBeNull()
  })
})
