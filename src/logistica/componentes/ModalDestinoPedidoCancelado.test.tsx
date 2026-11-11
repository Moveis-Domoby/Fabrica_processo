import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ModalDestinoPedidoCancelado } from './ModalDestinoPedidoCancelado'
import type { DetalheDestino, PecaEsperandoDestino, PedidoCandidato } from '@/logistica/destino'

/**
 * SESSAO-48 (frente 3): a janela "Para onde vai este móvel?" — o pedido
 * cancelado no Tiny com móveis em produção. Uma leitura ao abrir; peça por peça
 * ou todas de uma vez; "Passar para outro pedido" só com pedido que precise do
 * mesmo móvel (desligada com o porquê); as vagas que as peças iguais dividem.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { detalheDestino, decidirDestino } = vi.hoisted(() => ({
  detalheDestino: vi.fn(),
  decidirDestino: vi.fn(),
}))
vi.mock('@/logistica/destino', async (original) => ({
  ...(await original<typeof import('@/logistica/destino')>()),
  detalheDestino,
  decidirDestino,
}))

const peca = (extra: Partial<PecaEsperandoDestino>): PecaEsperandoDestino => ({
  id: 501,
  descricao: 'Cômoda 4 gavetas',
  sku: '073',
  indice: 1,
  total: 2,
  setor: 'MONTAGEM',
  etapa: 'FAZENDO',
  desde: '2026-11-11T12:00:00Z',
  executor: null,
  danificada: false,
  chave: 'p:73',
  ...extra,
})

const candidato = (pedido_id: number, numero: number, vagas = 1): PedidoCandidato => ({
  pedido_id,
  card_pedido_id: pedido_id + 1000,
  numero,
  cliente_nome: `Cliente ${numero}`,
  data_prevista: '2026-11-20',
  vagas,
  standby: false,
})

const detalhe = (extra: Partial<DetalheDestino> = {}): DetalheDestino => ({
  card_id: 31,
  pedido_id: 9,
  numero: 13702,
  cliente_nome: 'Maria da Silva',
  situacao_tiny: 'Cancelado',
  cancelado: true,
  cancelado_em: '2026-11-11T11:00:00Z',
  pecas: [
    peca({ id: 501, indice: 1 }),
    peca({ id: 502, indice: 2, setor: 'LIMPEZA E EMBALAGEM', etapa: 'A LIMPAR', executor: 'João' }),
    peca({ id: 503, descricao: 'Armário', sku: '055', indice: 1, total: 1, chave: 'p:55' }),
  ],
  candidatos: { 'p:73': [candidato(10, 13710, 1), candidato(11, 13711, 1)] },
  decididas: [],
  ...extra,
})

function renderizar(cardId: number | null = 31) {
  const aoFechar = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ProvedorNotificacao>
        <ModalDestinoPedidoCancelado cardId={cardId} aoFechar={aoFechar} />
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
  return { aoFechar }
}

const destinoDe = (nome: string) => screen.getByRole('radiogroup', { name: `Destino de ${nome}` })

afterEach(() => {
  detalheDestino.mockReset()
  decidirDestino.mockReset()
})

describe('Para onde vai este móvel? — a leitura', () => {
  it('lê uma vez ao abrir e mostra o pedido, onde está cada móvel e as três opções', async () => {
    detalheDestino.mockResolvedValue(detalhe())
    renderizar()
    expect(await screen.findByText('Pedido 13702 · Maria da Silva')).toBeInTheDocument()
    expect(detalheDestino).toHaveBeenCalledTimes(1)
    expect(detalheDestino).toHaveBeenCalledWith(31)
    expect(screen.getByText(/3 móveis dele estavam em produção — decida para onde vão/)).toBeInTheDocument()
    expect(screen.getByText('Cancelado no Tiny')).toBeInTheDocument()
    const lista = screen.getByRole('list', { name: 'Móveis esperando decisão' })
    expect(within(lista).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText(/Em LIMPEZA E EMBALAGEM · A LIMPAR/)).toBeInTheDocument()
    expect(screen.getByText('João está trabalhando nele agora.')).toBeInTheDocument()
    const grupo = destinoDe('Cômoda 4 gavetas (1/2)')
    for (const rotulo of ['Seguir para o estoque', 'Passar para outro pedido', 'Cancelar a fabricação']) {
      expect(within(grupo).getByRole('radio', { name: rotulo })).toBeEnabled()
    }
  })

  it('"Passar para outro pedido" fica desligada, com o porquê, sem pedido que precise do móvel — e na peça danificada', async () => {
    detalheDestino.mockResolvedValue(
      detalhe({
        pecas: [
          peca({ id: 503, descricao: 'Armário', sku: '055', indice: 1, total: 1, chave: 'p:55' }),
          peca({ id: 504, descricao: 'Mesa', indice: 1, total: 1, danificada: true }),
        ],
      }),
    )
    renderizar()
    const armario = await screen.findByRole('radiogroup', { name: 'Destino de Armário (1/1)' })
    expect(within(armario).getByRole('radio', { name: 'Passar para outro pedido' })).toBeDisabled()
    expect(screen.getByText('Nenhum pedido no PCP precisa deste móvel agora.')).toBeInTheDocument()
    expect(within(destinoDe('Mesa (1/1)')).getByRole('radio', { name: 'Passar para outro pedido' })).toBeDisabled()
    expect(screen.getByText('Peça danificada não vai para outro pedido.')).toBeInTheDocument()
    // e o "todas de uma vez" também não oferece (nem todos têm pedido)
    expect(screen.getByRole('button', { name: 'Passar para outro pedido' })).toBeDisabled()
  })

  it('nada esperando: diz isso e mostra o que já foi decidido, sem o botão de aplicar', async () => {
    detalheDestino.mockResolvedValue(
      detalhe({
        pecas: [],
        decididas: [
          {
            peca_id: 501,
            descricao: 'Cômoda 4 gavetas',
            destino: 'outro_pedido',
            via: 'pcp',
            automatico: false,
            numero_destino: 13710,
            quando: '2026-11-11T13:00:00Z',
            quem: 'Kaio',
          },
        ],
      }),
    )
    renderizar()
    expect(await screen.findByText('Nada esperando decisão neste pedido.')).toBeInTheDocument()
    expect(screen.getByText(/Cômoda 4 gavetas — Passou para o pedido 13710 \(pelo PCP\) · Kaio/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aplicar a decisão' })).not.toBeInTheDocument()
  })

  it('a recusa da leitura aparece na janela', async () => {
    detalheDestino.mockRejectedValue(new Error('Decidir para onde vão os móveis de pedido cancelado é da logística ou de admin.'))
    renderizar()
    expect(await screen.findByRole('alert')).toHaveTextContent('é da logística ou de admin')
  })
})

describe('Para onde vai este móvel? — a decisão', () => {
  it('peça por peça: estoque numa, outro pedido (escolhido) noutra — vai num pedido só e avisa o que aconteceu', async () => {
    detalheDestino.mockResolvedValue(detalhe())
    decidirDestino.mockResolvedValue({
      numero: 13702,
      decididas: 2,
      feitas: [
        { peca_id: 501, destino: 'estoque' },
        { peca_id: 502, destino: 'outro_pedido', numero_destino: 13711 },
      ],
      puladas: [],
    })
    renderizar()
    const aplicar = await screen.findByRole('button', { name: 'Aplicar a decisão' })
    expect(aplicar).toBeDisabled()
    await userEvent.click(within(destinoDe('Cômoda 4 gavetas (1/2)')).getByRole('radio', { name: 'Seguir para o estoque' }))
    expect(screen.getByText(/Pronto, entra no ESTOQUE sem dono/)).toBeInTheDocument()
    await userEvent.click(within(destinoDe('Cômoda 4 gavetas (2/2)')).getByRole('radio', { name: 'Passar para outro pedido' }))
    // sem o pedido escolhido, ainda não aplica
    expect(aplicar).toBeDisabled()
    const pedidos = screen.getByRole('radiogroup', { name: 'Para qual pedido vai Cômoda 4 gavetas (2/2)' })
    await userEvent.click(within(pedidos).getByRole('radio', { name: /Pedido 13711/ }))
    expect(screen.getByText('2 de 3 móveis com destino escolhido.')).toBeInTheDocument()
    await userEvent.click(aplicar)
    await waitFor(() => expect(decidirDestino).toHaveBeenCalledTimes(1))
    expect(decidirDestino).toHaveBeenCalledWith(31, [
      { pecaId: 501, destino: 'estoque' },
      { pecaId: 502, destino: 'outro_pedido', pedidoId: 11 },
    ])
    expect(await screen.findByText('Destino decidido: 2 móveis')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Cômoda 4 gavetas (1/2) segue para o estoque; Cômoda 4 gavetas (2/2) passou para o pedido 13711.',
      ),
    ).toBeInTheDocument()
    // relê a janela depois de decidir
    await waitFor(() => expect(detalheDestino).toHaveBeenCalledTimes(2))
  })

  it('a vaga escolhida para uma cômoda não aparece livre para a outra', async () => {
    detalheDestino.mockResolvedValue(detalhe())
    renderizar()
    await userEvent.click(
      within(await screen.findByRole('radiogroup', { name: 'Destino de Cômoda 4 gavetas (1/2)' })).getByRole('radio', {
        name: 'Passar para outro pedido',
      }),
    )
    await userEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Para qual pedido vai Cômoda 4 gavetas (1/2)' })).getByRole('radio', {
        name: /Pedido 13710/,
      }),
    )
    await userEvent.click(within(destinoDe('Cômoda 4 gavetas (2/2)')).getByRole('radio', { name: 'Passar para outro pedido' }))
    const daSegunda = screen.getByRole('radiogroup', { name: 'Para qual pedido vai Cômoda 4 gavetas (2/2)' })
    const pedido13710 = within(daSegunda).getByRole('radio', { name: /Pedido 13710/ })
    expect(pedido13710).toBeDisabled()
    expect(pedido13710).toHaveTextContent('a vaga já foi escolhida para outro móvel')
    expect(within(daSegunda).getByRole('radio', { name: /Pedido 13711/ })).toBeEnabled()
  })

  it('todas de uma vez: "Cancelar a fabricação" marca todas e manda todas juntas', async () => {
    detalheDestino.mockResolvedValue(detalhe())
    decidirDestino.mockResolvedValue({
      numero: 13702,
      decididas: 2,
      feitas: [
        { peca_id: 501, destino: 'cancelar', coluna: 'MONTAGEM · CANCELADO' },
        { peca_id: 502, destino: 'cancelar', coluna: 'LIMPEZA E EMBALAGEM · CANCELADO' },
      ],
      puladas: [{ peca_id: 503, destino: 'estoque' }],
    })
    renderizar()
    const todas = await screen.findByRole('group', { name: 'Todas de uma vez' })
    await userEvent.click(within(todas).getByRole('button', { name: 'Cancelar a fabricação' }))
    expect(within(todas).getByRole('button', { name: 'Cancelar a fabricação' })).toHaveAttribute('aria-pressed', 'true')
    for (const nome of ['Cômoda 4 gavetas (1/2)', 'Cômoda 4 gavetas (2/2)', 'Armário (1/1)']) {
      expect(within(destinoDe(nome)).getByRole('radio', { name: 'Cancelar a fabricação' })).toHaveAttribute(
        'aria-checked',
        'true',
      )
    }
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar a decisão' }))
    await waitFor(() =>
      expect(decidirDestino).toHaveBeenCalledWith(31, [
        { pecaId: 501, destino: 'cancelar' },
        { pecaId: 502, destino: 'cancelar' },
        { pecaId: 503, destino: 'cancelar' },
      ]),
    )
    expect(await screen.findByText(/1 móvel já tinha destino — nada mudou nele\./)).toBeInTheDocument()
  })

  it('todas de uma vez para outro pedido: as cômodas dividem as vagas, o mais antigo primeiro', async () => {
    detalheDestino.mockResolvedValue(detalhe({ pecas: detalhe().pecas.slice(0, 2) }))
    decidirDestino.mockResolvedValue({ numero: 13702, decididas: 2, feitas: [], puladas: [] })
    renderizar()
    const todas = await screen.findByRole('group', { name: 'Todas de uma vez' })
    await userEvent.click(within(todas).getByRole('button', { name: 'Passar para outro pedido' }))
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar a decisão' }))
    await waitFor(() =>
      expect(decidirDestino).toHaveBeenCalledWith(31, [
        { pecaId: 501, destino: 'outro_pedido', pedidoId: 10 },
        { pecaId: 502, destino: 'outro_pedido', pedidoId: 11 },
      ]),
    )
  })

  it('alguém decidiu antes (o toque repetido): "Nada mudou", e diz por quê', async () => {
    detalheDestino.mockResolvedValue(detalhe())
    decidirDestino.mockResolvedValue({
      numero: 13702,
      decididas: 0,
      feitas: [],
      puladas: [{ peca_id: 503, destino: 'outro_pedido' }],
    })
    renderizar()
    await userEvent.click(
      within(await screen.findByRole('radiogroup', { name: 'Destino de Armário (1/1)' })).getByRole('radio', {
        name: 'Seguir para o estoque',
      }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar a decisão' }))
    expect(await screen.findByText('Nada mudou')).toBeInTheDocument()
    expect(screen.getByText('1 móvel já tinha destino — nada mudou nele.')).toBeInTheDocument()
  })

  it('a recusa do banco vira aviso em português e a janela não perde as escolhas', async () => {
    detalheDestino.mockResolvedValue(detalhe())
    decidirDestino.mockRejectedValue(
      new Error('Não deu para aplicar a decisão: O pedido 13710 não está mais no PCP — escolha outro destino para o móvel.'),
    )
    renderizar()
    await userEvent.click(
      within(await screen.findByRole('radiogroup', { name: 'Destino de Armário (1/1)' })).getByRole('radio', {
        name: 'Seguir para o estoque',
      }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar a decisão' }))
    expect(await screen.findByText(/não está mais no PCP — escolha outro destino/)).toBeInTheDocument()
    expect(within(destinoDe('Armário (1/1)')).getByRole('radio', { name: 'Seguir para o estoque' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})
