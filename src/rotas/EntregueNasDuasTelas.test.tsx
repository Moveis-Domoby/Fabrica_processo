import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { hojeNaFabrica, somarDias } from '@/dashboards/tempos/formato'
import { Rotas } from '@/paginas/Rotas'
import { EntregasDoDia } from '@/paginas/EntregasDoDia'
import * as api from './api'
import type { Entrega, EntregaDoDia, EntregasDoDia as RespostaDoDia } from './api'
import { diaCurto, diaPorExtenso } from './diaDaEntrega'

/**
 * SESSAO-47 (pedido do dono): depois de tocar em "Entregue", nos DOIS lugares
 * em que se registra entrega — ROTAS → Entregas (a logística) e as Entregas do
 * dia (o entregador) —, aparecem "Confirmar entrega", "Ainda não" e "Marcar
 * como entregue no dia...". Com peças ainda em produção (a inconsistência da
 * imagem do dono), o aviso continua e os dois botões de confirmar valem como a
 * confirmação explícita. O dia escolhido vai junto com a entrega.
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
// o mapa (Leaflet) e as janelas da parada avulsa não fazem parte destes gestos
vi.mock('@/rotas/MiniMapaEntregas', () => ({ default: () => null }))
vi.mock('@/rotas/ModalParadaAvulsa', () => ({ ModalParadaAvulsa: () => null }))
vi.mock('@/rotas/ModalMomentoParada', () => ({ default: () => null }))
vi.mock('./api', async (original) => {
  const real = await original<typeof import('./api')>()
  return {
    ...real,
    listarEntregas: vi.fn(),
    entregasDoDia: vi.fn(),
    registrarEntrega: vi.fn(async () => {}),
    anexarComprovante: vi.fn(async () => {}),
  }
})

const HOJE = hojeNaFabrica()
const ONTEM = somarDias(HOJE, -1)
const AVISO =
  'Este pedido ainda aparece em produção na fábrica (0 de 1 peça pronta). Confirmar a entrega encerra tudo dele.'

const aEntregar = (extra: Partial<Entrega> = {}): Entrega => ({
  card_id: 11,
  pedido_id: 1,
  numero: 13818,
  cliente_nome: 'Cliente Teste',
  telefone: null,
  endereco: 'Rua das Entregas',
  numero_endereco: '10',
  complemento: null,
  bairro: 'Centro',
  cidade: 'Natal',
  uf: 'RN',
  obs: null,
  data_prevista: '2026-11-13',
  total_unidades: 1,
  unidades_em_rotas: 1,
  situacao_entrega: 'pronta',
  entregue_em: null,
  entregue_por: null,
  lancado_em: null,
  programacao_data: null,
  caminhao_id: null,
  caminhao_nome: null,
  caminhao_placa: null,
  caminhao_foto: null,
  contagem_total: 1,
  estado: 'pronto',
  unidades_prontas: 1,
  unidades_liberadas: 1,
  ...extra,
})

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
  itens: [{ descricao: 'Estante Basic 15 nichos', quantidade: 1, volumes: 1 }],
  unidades: 1,
  volumes: 1,
  entregue_em: null,
  entregue_por: null,
  entregue_por_gente: false,
  entrega_parcial: false,
  entregue_no_dia: null,
  entrega_registrada_em: null,
  chegou_em: `${somarDias(HOJE, -5)}T17:04:00-03:00`,
  comprovantes: 0,
  comentarios: [],
  estado: 'pronto',
  pronto: true,
  prontas: 1,
  a_entregar: 1,
  ...extra,
})

const doDia = (extra: Partial<RespostaDoDia> = {}): RespostaDoDia => ({
  data: HOJE,
  caminhao_id: 3,
  rota: 1,
  caminhoes: [
    { id: 3, rota: 1, nome: 'Baú 1', placa: null, foto: null, equipe: ['Kaio'], entregas: 1 },
  ],
  entregas: [parada()],
  paradas_avulsas: [],
  sou_logistica: false,
  entregues_de_outro_dia: [],
  ...extra,
})

function desenhar(tela: 'rotas' | 'do-dia') {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProvedorNotificacao>
        <MemoryRouter initialEntries={['/rotas/entregas']}>
          {tela === 'rotas' ? <Rotas /> : <EntregasDoDia />}
        </MemoryRouter>
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
}

const botao = (nome: string | RegExp) => screen.getByRole('button', { name: nome })

beforeEach(() => {
  vi.mocked(api.registrarEntrega).mockReset().mockResolvedValue(undefined)
  vi.mocked(api.anexarComprovante).mockReset().mockResolvedValue(undefined)
  vi.mocked(api.listarEntregas).mockReset().mockResolvedValue([aEntregar()])
  vi.mocked(api.entregasDoDia).mockReset().mockResolvedValue(doDia())
})

describe('ROTAS → Entregas: depois do "Entregue"', () => {
  it('aparecem os três botões; "Confirmar entrega" registra com a data de hoje', async () => {
    desenhar('rotas')
    await screen.findByText('Pedido 13818')
    await userEvent.click(botao('Entregue'))
    expect(botao('Confirmar entrega')).toBeInTheDocument()
    expect(botao('Ainda não')).toBeInTheDocument()
    expect(botao('Marcar como entregue no dia...')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await userEvent.click(botao('Confirmar entrega'))
    await waitFor(() =>
      expect(api.registrarEntrega).toHaveBeenCalledWith({
        cardId: 11,
        confirmarIncompleto: false,
        dia: null,
      }),
    )
  })

  it('"Ainda não" fecha sem registrar e o "Entregue" volta', async () => {
    desenhar('rotas')
    await screen.findByText('Pedido 13818')
    await userEvent.click(botao('Entregue'))
    await userEvent.click(botao('Ainda não'))
    expect(api.registrarEntrega).not.toHaveBeenCalled()
    expect(botao('Entregue')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar entrega' })).not.toBeInTheDocument()
  })

  it('"Marcar como entregue no dia..." manda o dia escolhido junto com a entrega', async () => {
    desenhar('rotas')
    await screen.findByText('Pedido 13818')
    await userEvent.click(botao('Entregue'))
    await userEvent.click(botao('Marcar como entregue no dia...'))
    const campo = screen.getByLabelText('Em que dia foi entregue?')
    expect(campo).toHaveAttribute('max', HOJE)
    fireEvent.change(campo, { target: { value: ONTEM } })
    await userEvent.click(botao(`Marcar como entregue em ${diaPorExtenso(ONTEM)}`))
    await waitFor(() =>
      expect(api.registrarEntrega).toHaveBeenCalledWith({
        cardId: 11,
        confirmarIncompleto: false,
        dia: ONTEM,
      }),
    )
  })

  it('com peças em produção: o aviso da imagem aparece e os dois botões de confirmar valem como a confirmação', async () => {
    vi.mocked(api.listarEntregas).mockResolvedValue([
      aEntregar({ estado: 'em_producao', unidades_prontas: 0 }),
    ])
    desenhar('rotas')
    await screen.findByText('Pedido 13818')
    await userEvent.click(botao('Entregue'))
    expect(screen.getByRole('alert')).toHaveTextContent(AVISO)
    // os textos antigos saíram
    expect(screen.queryByRole('button', { name: /mesmo assim/ })).not.toBeInTheDocument()

    await userEvent.click(botao('Marcar como entregue no dia...'))
    fireEvent.change(screen.getByLabelText('Em que dia foi entregue?'), {
      target: { value: ONTEM },
    })
    await userEvent.click(botao(`Marcar como entregue em ${diaPorExtenso(ONTEM)}`))
    await waitFor(() =>
      expect(api.registrarEntrega).toHaveBeenCalledWith({
        cardId: 11,
        confirmarIncompleto: true,
        dia: ONTEM,
      }),
    )
  })

  it('a tela estava velha e o banco pede a confirmação: o aviso aparece e o segundo toque confirma', async () => {
    vi.mocked(api.registrarEntrega).mockRejectedValueOnce(
      new Error(
        'Não deu para registrar a entrega: Este pedido ainda aparece em produção na fábrica (0 de 1 peças prontas). Confirmar a entrega encerra tudo dele.',
      ),
    )
    desenhar('rotas')
    await screen.findByText('Pedido 13818')
    await userEvent.click(botao('Entregue'))
    await userEvent.click(botao('Confirmar entrega'))
    expect(await screen.findByRole('alert')).toHaveTextContent(/ainda aparece em produção/)
    await userEvent.click(botao('Confirmar entrega'))
    await waitFor(() =>
      expect(api.registrarEntrega).toHaveBeenLastCalledWith({
        cardId: 11,
        confirmarIncompleto: true,
        dia: null,
      }),
    )
  })
})

describe('Entregas do dia (o entregador): depois do "Entregue"', () => {
  it('o painel traz o comprovante, a observação e os três botões; "Confirmar entrega" registra com hoje', async () => {
    desenhar('do-dia')
    await screen.findByText('Cliente do Dia')
    await userEvent.click(botao('Entregue'))
    expect(botao('Confirmar entrega')).toBeInTheDocument()
    expect(botao('Ainda não')).toBeInTheDocument()
    expect(botao('Marcar como entregue no dia...')).toBeInTheDocument()
    expect(screen.getByLabelText('Observação (opcional)')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Observação (opcional)'), 'recebido pela vizinha')
    await userEvent.click(botao('Confirmar entrega'))
    await waitFor(() =>
      expect(api.registrarEntrega).toHaveBeenCalledWith({
        cardId: 21,
        observacao: 'recebido pela vizinha',
        confirmarIncompleto: false,
        dia: null,
      }),
    )
  })

  it('"Marcar como entregue no dia...": o dia vai de quando o pedido chegou até hoje, e segue com a entrega', async () => {
    desenhar('do-dia')
    await screen.findByText('Cliente do Dia')
    await userEvent.click(botao('Entregue'))
    await userEvent.click(botao('Marcar como entregue no dia...'))
    const campo = screen.getByLabelText('Em que dia foi entregue?')
    expect(campo).toHaveAttribute('max', HOJE)
    expect(campo).toHaveAttribute('min', somarDias(HOJE, -5))
    fireEvent.change(campo, { target: { value: ONTEM } })
    await userEvent.click(botao(`Marcar como entregue em ${diaPorExtenso(ONTEM)}`))
    await waitFor(() =>
      expect(api.registrarEntrega).toHaveBeenCalledWith({
        cardId: 21,
        observacao: '',
        confirmarIncompleto: false,
        dia: ONTEM,
      }),
    )
  })

  it('com peças em produção, o aviso aparece no painel e "Confirmar entrega" vale como a confirmação; "Ainda não" fecha', async () => {
    vi.mocked(api.entregasDoDia).mockResolvedValue(
      doDia({ entregas: [parada({ estado: 'em_producao', pronto: false, prontas: 0 })] }),
    )
    desenhar('do-dia')
    await screen.findByText('Cliente do Dia')
    await userEvent.click(botao('Entregue'))
    expect(screen.getByRole('alert')).toHaveTextContent(AVISO)
    await userEvent.click(botao('Ainda não'))
    expect(api.registrarEntrega).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await userEvent.click(botao('Entregue'))
    await userEvent.click(botao('Confirmar entrega'))
    await waitFor(() =>
      expect(api.registrarEntrega).toHaveBeenCalledWith({
        cardId: 21,
        observacao: '',
        confirmarIncompleto: true,
        dia: null,
      }),
    )
  })

  it('vários comprovantes: a entrega é registrada ANTES; cada arquivo sobe sozinho; se um falha, a entrega fica e a janela diz qual falhou', async () => {
    vi.mocked(api.anexarComprovante).mockImplementation(async (_card, arquivo) => {
      if (arquivo.name === 'pix-2.pdf') throw new Error('Não deu para enviar o arquivo: sem sinal')
    })
    desenhar('do-dia')
    await screen.findByText('Cliente do Dia')
    await userEvent.click(botao('Entregue'))
    const escolher = screen.getByLabelText('Anexar comprovantes (opcional)')
    expect(escolher).toHaveAttribute('multiple')
    await userEvent.upload(escolher, [
      new File(['a'], 'pix-1.pdf', { type: 'application/pdf' }),
      new File(['b'], 'pix-2.pdf', { type: 'application/pdf' }),
      new File(['c'], 'pix-3.pdf', { type: 'application/pdf' }),
    ])
    expect(screen.getByRole('list', { name: 'Arquivos escolhidos' }).children).toHaveLength(3)

    await userEvent.click(botao('Confirmar entrega'))
    await waitFor(() => expect(api.anexarComprovante).toHaveBeenCalledTimes(3))
    // a entrega primeiro (uma vez só), os comprovantes depois — todos no card do pedido
    expect(api.registrarEntrega).toHaveBeenCalledTimes(1)
    expect(vi.mocked(api.registrarEntrega).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(api.anexarComprovante).mock.invocationCallOrder[0],
    )
    expect(vi.mocked(api.anexarComprovante).mock.calls.map((c) => [c[0], c[1].name])).toEqual([
      [21, 'pix-1.pdf'],
      [21, 'pix-2.pdf'],
      [21, 'pix-3.pdf'],
    ])
    // a janela dos comprovantes diz qual falhou e por quê; os outros ficaram
    const janela = await screen.findByRole('dialog', { name: 'Comprovantes — pedido 13836' })
    expect(janela).toHaveTextContent('A entrega do pedido 13836 já ficou registrada')
    await waitFor(() =>
      expect(screen.getByText('pix-2.pdf').closest('li')).toHaveTextContent(
        'falhou — Não deu para enviar o arquivo: sem sinal',
      ),
    )
    expect(screen.getByText('pix-1.pdf').closest('li')).toHaveTextContent('enviado')
    expect(screen.getByText('pix-3.pdf').closest('li')).toHaveTextContent('enviado')
    expect(botao('Tentar de novo o arquivo que falhou')).toBeEnabled()
  })

  it('o "Comprovante" do card abre a mesma janela, para escolher vários de uma vez', async () => {
    desenhar('do-dia')
    await screen.findByText('Cliente do Dia')
    await userEvent.click(botao('Comprovante'))
    const janela = await screen.findByRole('dialog', { name: 'Comprovantes — pedido 13836' })
    expect(janela).toHaveTextContent('até 10 arquivos por vez')
    await userEvent.upload(screen.getByLabelText('Escolher arquivos'), [
      new File(['a'], 'recibo-1.pdf', { type: 'application/pdf' }),
      new File(['b'], 'recibo-2.pdf', { type: 'application/pdf' }),
    ])
    await userEvent.click(botao('Anexar 2 arquivos'))
    await waitFor(() => expect(api.anexarComprovante).toHaveBeenCalledTimes(2))
    // tudo subiu: a janela fecha e as entregas do dia releem (a contagem certa)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(api.entregasDoDia).toHaveBeenCalledTimes(2))
    expect(api.registrarEntrega).not.toHaveBeenCalled()
  })

  it('os entregues: a parada marcada hoje como "entregue ontem" diz o dia e ainda se desfaz hoje; a registrada em outro dia, não; o entregue hoje da rota de outro dia aparece com o dia programado', async () => {
    const agora = new Date().toISOString()
    vi.mocked(api.entregasDoDia).mockResolvedValue(
      doDia({
        entregas: [
          parada({
            card_id: 31,
            numero: 13801,
            cliente_nome: 'Entregue Ontem',
            entregue_em: `${ONTEM}T17:15:00-03:00`,
            entregue_no_dia: ONTEM,
            entrega_registrada_em: agora,
            entregue_por: 'Kaio',
            entregue_por_gente: true,
          }),
          parada({
            card_id: 32,
            posicao: 2,
            ordem: 2,
            numero: 13802,
            cliente_nome: 'Registrada Ontem',
            entregue_em: `${ONTEM}T10:00:00-03:00`,
            entregue_no_dia: ONTEM,
            entrega_registrada_em: `${ONTEM}T10:00:00-03:00`,
            entregue_por: 'Kaio',
            entregue_por_gente: true,
          }),
        ],
        entregues_de_outro_dia: [
          {
            card_id: 41,
            pedido_id: 4,
            numero: 13777,
            cliente_nome: 'De Outra Rota',
            entregue_em: agora,
            entrega_registrada_em: agora,
            entregue_por: 'Kaio',
            entregue_por_gente: true,
            entrega_parcial: false,
            programado_para: somarDias(HOJE, 1),
            caminhao_nome: 'Baú 2',
            rota: 1,
          },
        ],
      }),
    )
    desenhar('do-dia')
    await userEvent.click(await screen.findByRole('button', { name: 'Entregues hoje (3)' }))
    const linhaOntem = screen.getByText(/Pedido 13801/).closest('li')!
    expect(linhaOntem).toHaveTextContent(`entregue em ${diaCurto(ONTEM)}`)
    expect(linhaOntem.querySelector('button')).toHaveTextContent('Desfazer')
    const linhaVelha = screen.getByText(/Pedido 13802/).closest('li')!
    expect(linhaVelha).toHaveTextContent('Foi registrada em outro dia')
    expect(linhaVelha.querySelector('button')).toBeNull()
    const linhaDeFora = screen.getByText(/Pedido 13777/).closest('li')!
    expect(linhaDeFora).toHaveTextContent(`programado para ${diaCurto(somarDias(HOJE, 1))} (Baú 2)`)
    expect(linhaDeFora.querySelector('button')).toBeNull()
  })
})
