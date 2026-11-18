import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { hojeNaFabrica } from '@/dashboards/tempos/formato'
import { EntregasDoDia } from '@/paginas/EntregasDoDia'
import * as api from './api'
import type { EntregaDoDia, EntregasDoDia as RespostaDoDia } from './api'
import { CartaoPedido } from './CartaoPedido'
import type { DadosCartaoPedido } from './CartaoPedido'
import { SeloEntregueEmParte } from './SeloEntregueEmParte'

/**
 * SESSAO-53: o pedido entregue em parte diz "Entregue em parte (N de M)" também
 * na Programação (o cartão do pedido, nas abas Programar e Já programadas) e nas
 * Entregas do dia — o mesmo texto do PCP e da ficha, com "K ainda em produção"
 * quando o resto segue na fábrica. (A Expedição está no teste dela.)
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
vi.mock('@/rotas/MiniMapaEntregas', () => ({ default: () => null }))
vi.mock('@/rotas/ModalParadaAvulsa', () => ({ ModalParadaAvulsa: () => null }))
vi.mock('@/rotas/ModalMomentoParada', () => ({ default: () => null }))
vi.mock('./api', async (original) => {
  const real = await original<typeof import('./api')>()
  return { ...real, entregasDoDia: vi.fn() }
})

describe('o selo "Entregue em parte"', () => {
  it('diz quantas saíram de quantas e, quando há, quantas seguem na fábrica', () => {
    render(
      <SeloEntregueEmParte
        parcial={{ entregues: 2, total: 5, em: '2026-11-18T10:00:00-03:00', ainda_producao: 3 }}
      />,
    )
    expect(screen.getByText('Entregue em parte (2 de 5)')).toBeInTheDocument()
    expect(screen.getByText('3 ainda em produção')).toBeInTheDocument()
  })

  it('sem nada na fábrica, só o selo; sem os números, só "Entregue em parte"', () => {
    const { rerender } = render(
      <SeloEntregueEmParte parcial={{ entregues: 1, total: 3, em: null }} />,
    )
    expect(screen.getByText('Entregue em parte (1 de 3)')).toBeInTheDocument()
    expect(screen.queryByText(/ainda em produção/)).toBeNull()
    rerender(<SeloEntregueEmParte parcial={{ entregues: null, total: null, em: null }} />)
    expect(screen.getByText('Entregue em parte')).toBeInTheDocument()
  })

  it('some quando a porta não manda nada (o banco de antes, ou o pedido inteiro)', () => {
    const { container } = render(<SeloEntregueEmParte parcial={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})

const pedido: DadosCartaoPedido = {
  numero: 13901,
  cliente_nome: 'Cliente Teste',
  endereco: 'Rua das Entregas',
  numero_endereco: '10',
  bairro: 'Centro',
  cidade: 'Natal',
  uf: 'RN',
  total_unidades: 5,
  itens: [{ descricao: 'Guarda-roupa Teste', quantidade: 5 }],
  data_prevista: '2026-11-30',
  geo_chave: 'abc',
  geo_resolvido: true,
  estado: 'em_producao',
  unidades_prontas: 1,
}

describe('Programação — o cartão do pedido (Programar e Já programadas)', () => {
  it('o pedido que já teve uma parte entregue leva o selo, ao lado do estado', () => {
    render(
      <CartaoPedido
        pedido={{
          ...pedido,
          entregue_em_parte: { entregues: 2, total: 5, em: null, ainda_producao: 3 },
        }}
      />,
    )
    expect(screen.getByText('Entregue em parte (2 de 5)')).toBeInTheDocument()
    expect(screen.getByText('3 ainda em produção')).toBeInTheDocument()
    expect(screen.getByText('Pedido 13901')).toBeInTheDocument()
  })

  it('o pedido inteiro (ou a coluna nula de "Já programadas") segue sem o selo', () => {
    render(<CartaoPedido pedido={{ ...pedido, entregue_em_parte: null }} />)
    expect(screen.queryByText(/Entregue em parte/)).toBeNull()
  })
})

const HOJE = hojeNaFabrica()
const parada = (extra: Partial<EntregaDoDia> = {}): EntregaDoDia => ({
  posicao: 1,
  ordem: 1,
  card_id: 21,
  pedido_id: 2,
  numero: 13836,
  cliente_nome: 'Cliente do Dia',
  telefone: null,
  endereco: 'Rua da Rota',
  numero_endereco: '20',
  complemento: null,
  bairro: 'Alecrim',
  cidade: 'Natal',
  uf: 'RN',
  latitude: null,
  longitude: null,
  obs: null,
  detalhe: null,
  data_prevista: null,
  itens: [{ descricao: 'Guarda-roupa Teste', quantidade: 5, volumes: 5 }],
  unidades: 5,
  volumes: 5,
  entregue_em: null,
  entregue_por: null,
  entregue_por_gente: false,
  entrega_parcial: false,
  entregue_no_dia: null,
  entrega_registrada_em: null,
  chegou_em: `${HOJE}T08:00:00-03:00`,
  comprovantes: 0,
  comentarios: [],
  estado: 'pronto',
  pronto: true,
  prontas: 1,
  a_entregar: 1,
  ...extra,
})
const doDia = (entregas: EntregaDoDia[]): RespostaDoDia => ({
  data: HOJE,
  caminhao_id: 3,
  rota: 1,
  caminhoes: [
    { id: 3, rota: 1, nome: 'Baú 1', placa: null, foto: null, equipe: ['Kaio'], entregas: 1 },
  ],
  entregas,
  paradas_avulsas: [],
  sou_logistica: false,
  entregues_de_outro_dia: [],
})
function desenhar() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProvedorNotificacao>
        <MemoryRouter initialEntries={['/rotas/entregas-do-dia']}>
          <EntregasDoDia />
        </MemoryRouter>
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
}

describe('Entregas do dia', () => {
  beforeEach(() => {
    vi.mocked(api.entregasDoDia).mockReset()
  })

  it('a parada que leva o resto do pedido diz "Entregue em parte (2 de 5)" e o que segue na fábrica — numa leitura só', async () => {
    vi.mocked(api.entregasDoDia).mockResolvedValue(
      doDia([
        parada({
          entregue_em_parte: { entregues: 2, total: 5, em: null, ainda_producao: 2 },
        }),
        parada({ card_id: 22, posicao: 2, numero: 13837, cliente_nome: 'Cliente Inteiro' }),
      ]),
    )
    desenhar()
    const linha = (await screen.findByText('Cliente do Dia')).closest('li')!
    expect(within(linha).getByText('Entregue em parte (2 de 5)')).toBeInTheDocument()
    expect(within(linha).getByText('2 ainda em produção')).toBeInTheDocument()
    const inteiro = screen.getByText('Cliente Inteiro').closest('li')!
    expect(within(inteiro).queryByText(/Entregue em parte/)).toBeNull()
    expect(api.entregasDoDia).toHaveBeenCalledTimes(1)
  })

  it('a parada já entregue em parte, na lista das entregues: o selo com os números no lugar do "em parte"', async () => {
    vi.mocked(api.entregasDoDia).mockResolvedValue(
      doDia([
        parada({
          entregue_em: `${HOJE}T10:00:00-03:00`,
          entregue_por: 'Kaio',
          entregue_por_gente: true,
          entrega_parcial: true,
          entregue_no_dia: HOJE,
          entrega_registrada_em: `${HOJE}T10:00:00-03:00`,
          entregue_em_parte: { entregues: 1, total: 3, em: `${HOJE}T10:00:00-03:00` },
        }),
      ]),
    )
    desenhar()
    // as entregues do dia ficam recolhidas — um toque abre
    await userEvent.click(await screen.findByRole('button', { name: /Entregues hoje/ }))
    expect((await screen.findAllByText('Entregue em parte (1 de 3)')).length).toBeGreaterThan(0)
    expect(screen.queryByText('em parte')).toBeNull()
  })

  it('com o banco de antes (sem a conta), a entregue em parte segue com o aviso "em parte"', async () => {
    vi.mocked(api.entregasDoDia).mockResolvedValue(
      doDia([
        parada({
          entregue_em: `${HOJE}T10:00:00-03:00`,
          entregue_por: 'Kaio',
          entregue_por_gente: true,
          entrega_parcial: true,
          entregue_no_dia: HOJE,
          entrega_registrada_em: `${HOJE}T10:00:00-03:00`,
        }),
      ]),
    )
    desenhar()
    // as entregues do dia ficam recolhidas — um toque abre
    await userEvent.click(await screen.findByRole('button', { name: /Entregues hoje/ }))
    expect(await screen.findByText('em parte')).toBeInTheDocument()
    expect(screen.queryByText(/Entregue em parte \(/)).toBeNull()
  })
})
