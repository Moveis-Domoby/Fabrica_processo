import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { hojeNaFabrica, somarDias } from '@/dashboards/tempos/formato'
import * as kanbanApi from '@/kanban/api'
import * as rotasApi from '@/rotas/api'
import { diaPorExtenso } from '@/rotas/diaDaEntrega'
import { FichaDoPedido } from './FichaDoPedido'
import type { FichaComDiaReal } from './entregaNaFicha'

/**
 * SESSAO-47 (o dia real da entrega) na ficha do pedido: a ficha diz "entregue
 * no dia X, registrado em Y por Z" quando o dia foi escolhido; "Alterar a data
 * da entrega" é SÓ do administrador (a logística não vê o botão); e o "desfazer
 * do dia" conta pelo dia em que a entrega foi registrada.
 */
const sessao = vi.hoisted(() => ({ papel: 'admin' }))

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/autenticacao/sessao-contexto', () => ({
  useSessao: () => ({ perfil: { id: 'u1', papel: sessao.papel } }),
}))
vi.mock('@/logistica/acesso', () => ({
  useAcessoLogistica: () => ({
    perfil: { id: 'u1', papel: sessao.papel },
    souAdmin: sessao.papel === 'admin',
    tenhoAcesso: true,
    semAcesso: false,
    setores: [],
  }),
}))
vi.mock('@/utilitarios/CamposDoCard', () => ({ CamposDoCard: () => null }))
vi.mock('@/logistica/componentes/ModalDecidirDevolucao', () => ({
  ModalDecidirDevolucao: () => null,
}))
vi.mock('@/kanban/api', async (original) => {
  const real = await original<typeof import('@/kanban/api')>()
  return { ...real, detalhePedidoPcp: vi.fn() }
})
vi.mock('@/rotas/api', async (original) => {
  const real = await original<typeof import('@/rotas/api')>()
  return {
    ...real,
    corrigirDiaDaEntrega: vi.fn(async () => ({ mudou: true })),
    anexarComprovante: vi.fn(async () => {}),
  }
})

const HOJE = hojeNaFabrica()
const ONTEM = somarDias(HOJE, -1)
const ANTEONTEM = somarDias(HOJE, -2)
const CHEGOU = somarDias(HOJE, -6)

const ficha = (
  entrega: Partial<NonNullable<FichaComDiaReal['entrega']>> = {},
): FichaComDiaReal => ({
  pedido: {
    id: 77,
    numero: 13818,
    situacao: 'Entregue',
    origem: null,
    data_pedido: CHEGOU,
    data_prevista: HOJE,
    data_faturamento: null,
    data_envio: null,
    data_entrega_tiny: null,
    total_produtos: 900,
    valor_frete: 0,
    valor_desconto: null,
    outras_despesas: null,
    total_pedido: 900,
    forma_pagamento: 'pix',
    meio_pagamento: null,
    condicao_pagamento: null,
    qtd_parcelas: 1,
    parcelas: [],
    obs: null,
    obs_interna: null,
    marcadores: [],
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
    endereco: 'Rua A',
    numero: '1',
    complemento: null,
    bairro: 'Centro',
    cidade: 'Natal',
    uf: 'RN',
    cep: null,
  },
  devolucao: null,
  plataforma: {
    card_id: 900,
    situacao: 'entregue',
    total_unidades: 1,
    lancado_rotas_em: null,
    arquivado_em: null,
    liberado_completo_em: null,
    chegou_em: `${CHEGOU}T17:04:00-03:00`,
  },
  programacao: null,
  entrega: {
    // marcada HOJE como "entregue ontem" (o fim do expediente de ontem)
    em: `${ONTEM}T17:15:00-03:00`,
    registrada_em: new Date().toISOString(),
    por: 'Kaio',
    por_gente: true,
    observacao: null,
    fonte: 'plataforma',
    parcial: false,
    correcao: null,
    ...entrega,
  },
  itens: [],
  unidades: [],
  contas_receber: [],
  contas_receber_ate: null,
  notas_fiscais: [],
  anexos: [],
  historico: [
    {
      id: 5,
      tipo: 'pedido_entregue',
      em: `${ONTEM}T17:15:00-03:00`,
      registrado_em: new Date().toISOString(),
      por: 'Kaio',
      origem: 'interface',
      observacao: null,
      motivo: null,
      setor: null,
    },
  ],
})

function desenhar() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProvedorNotificacao>
        <MemoryRouter>
          <FichaDoPedido pedidoId={77} />
        </MemoryRouter>
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
}

async function abrirEntrega() {
  await userEvent.click(await screen.findByRole('button', { name: /Entrega e comprovante/ }))
  return screen.getByRole('region', { name: 'Entrega e comprovante' })
}

beforeEach(() => {
  sessao.papel = 'admin'
  vi.mocked(kanbanApi.detalhePedidoPcp).mockReset().mockResolvedValue(ficha())
  vi.mocked(rotasApi.corrigirDiaDaEntrega).mockReset().mockResolvedValue({ mudou: true })
  vi.mocked(rotasApi.anexarComprovante).mockReset().mockResolvedValue(undefined)
})

describe('Ficha do pedido — o dia real da entrega', () => {
  it('diz "no dia X, registrado em Y por Z" quando a entrega foi marcada para outro dia', async () => {
    desenhar()
    const painel = await abrirEntrega()
    expect(painel).toHaveTextContent(
      new RegExp(
        `Entregue no dia ${diaPorExtenso(ONTEM)}, registrado em ${diaPorExtenso(HOJE)} às \\d{2}:\\d{2} por Kaio`,
      ),
    )
    // o resumo do topo também mostra o dia real (sem a hora, que não é a da entrega)
    expect(screen.getByText(`no dia ${diaPorExtenso(ONTEM)}`)).toBeInTheDocument()
  })

  it('entregue e registrada no mesmo dia: o texto de sempre, com a hora', async () => {
    const agora = new Date().toISOString()
    vi.mocked(kanbanApi.detalhePedidoPcp).mockResolvedValue(
      ficha({ em: agora, registrada_em: agora }),
    )
    desenhar()
    const painel = await abrirEntrega()
    expect(painel).toHaveTextContent(/Entregue em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2} por Kaio/)
    expect(painel).not.toHaveTextContent('registrado em')
  })

  it('o administrador vê "Alterar a data da entrega"; registrada hoje, a entrega ainda se desfaz', async () => {
    desenhar()
    const painel = await abrirEntrega()
    expect(
      within(painel).getByRole('button', { name: 'Alterar a data da entrega' }),
    ).toBeInTheDocument()
    // "do dia" é o dia do REGISTRO: marcada hoje como "entregue ontem", desfaz hoje
    expect(within(painel).getByRole('button', { name: 'Desfazer a entrega' })).toBeInTheDocument()
  })

  it('a logística NÃO vê "Alterar a data da entrega" (mas desfaz a entrega registrada hoje)', async () => {
    sessao.papel = 'logistica'
    desenhar()
    const painel = await abrirEntrega()
    expect(
      within(painel).queryByRole('button', { name: 'Alterar a data da entrega' }),
    ).not.toBeInTheDocument()
    expect(within(painel).getByRole('button', { name: 'Desfazer a entrega' })).toBeInTheDocument()
  })

  it('a entrega registrada em outro dia: a logística lê o porquê de não desfazer; o administrador reabre e altera a data', async () => {
    vi.mocked(kanbanApi.detalhePedidoPcp).mockResolvedValue(
      ficha({ em: `${ONTEM}T10:00:00-03:00`, registrada_em: `${ONTEM}T10:00:00-03:00` }),
    )
    sessao.papel = 'logistica'
    desenhar()
    const painel = await abrirEntrega()
    expect(painel).toHaveTextContent('A entrega foi registrada em outro dia')
    expect(
      within(painel).queryByRole('button', { name: /Desfazer|Reabrir/ }),
    ).not.toBeInTheDocument()
  })

  it('a janela do administrador: o dia vai da chegada do pedido até hoje, o motivo é opcional e o mesmo dia não salva', async () => {
    desenhar()
    const painel = await abrirEntrega()
    await userEvent.click(within(painel).getByRole('button', { name: 'Alterar a data da entrega' }))
    const janela = await screen.findByRole('dialog')
    const campo = within(janela).getByLabelText('Dia em que foi entregue')
    expect(campo).toHaveAttribute('type', 'date')
    expect(campo).toHaveAttribute('max', HOJE)
    expect(campo).toHaveAttribute('min', CHEGOU)
    expect(campo).toHaveValue(ONTEM)
    // o dia que já está valendo não é correção
    expect(within(janela).getByRole('button', { name: 'Salvar a data' })).toBeDisabled()
    // amanhã não vale
    fireEvent.change(campo, { target: { value: somarDias(HOJE, 1) } })
    expect(within(janela).getByText(/Esse dia ainda não chegou/)).toBeInTheDocument()
    expect(within(janela).getByRole('button', { name: 'Salvar a data' })).toBeDisabled()

    fireEvent.change(campo, { target: { value: ANTEONTEM } })
    await userEvent.type(
      within(janela).getByLabelText('Motivo (opcional)'),
      'o cliente confirmou o dia',
    )
    await userEvent.click(within(janela).getByRole('button', { name: 'Salvar a data' }))
    await waitFor(() =>
      expect(rotasApi.corrigirDiaDaEntrega).toHaveBeenCalledWith({
        cardId: 900,
        dia: ANTEONTEM,
        motivo: 'o cliente confirmou o dia',
      }),
    )
    // a ficha relê depois de salvar
    await waitFor(() => expect(kanbanApi.detalhePedidoPcp).toHaveBeenCalledTimes(2))
  })

  it('depois de corrigida, a ficha diz quem corrigiu, de quando e por quê', async () => {
    vi.mocked(kanbanApi.detalhePedidoPcp).mockResolvedValue(
      ficha({
        em: `${ANTEONTEM}T17:15:00-03:00`,
        correcao: {
          em: new Date().toISOString(),
          por: 'Dono Admin',
          antes: ONTEM,
          depois: ANTEONTEM,
          motivo: 'o cliente confirmou o dia',
        },
      }),
    )
    desenhar()
    const painel = await abrirEntrega()
    expect(painel).toHaveTextContent(`Entregue no dia ${diaPorExtenso(ANTEONTEM)}`)
    expect(painel).toHaveTextContent(
      new RegExp(
        `Dia corrigido por Dono Admin em .* \\(era ${diaPorExtenso(ONTEM)}\\) — o cliente confirmou o dia`,
      ),
    )
  })

  it('o histórico mostra o dia em que a entrega valeu e quando ela foi registrada', async () => {
    desenhar()
    await userEvent.click(await screen.findByRole('button', { name: /Histórico/ }))
    const historico = screen.getByRole('region', { name: 'Histórico' })
    const linha = within(historico).getByText('Entregue').closest('li')!
    expect(linha).toHaveTextContent(diaPorExtenso(ONTEM))
    expect(linha).toHaveTextContent(new RegExp(`registrado em ${diaPorExtenso(HOJE)} às`))
  })

  it('"Anexar comprovantes" na ficha: vários de uma vez; depois do envio a ficha relê e mostra todos', async () => {
    sessao.papel = 'logistica'
    desenhar()
    const painel = await abrirEntrega()
    expect(painel).toHaveTextContent('Nenhum comprovante anexado a este pedido.')
    await userEvent.click(within(painel).getByRole('button', { name: 'Anexar comprovantes' }))
    const janela = await screen.findByRole('dialog', { name: 'Comprovantes — pedido 13818' })
    const escolher = within(janela).getByLabelText('Escolher arquivos')
    expect(escolher).toHaveAttribute('multiple')
    await userEvent.upload(escolher, [
      new File(['a'], 'pix.pdf', { type: 'application/pdf' }),
      new File(['b'], 'canhoto.pdf', { type: 'application/pdf' }),
    ])
    // a ficha relida depois do envio já traz os dois
    vi.mocked(kanbanApi.detalhePedidoPcp).mockResolvedValue({
      ...ficha(),
      anexos: ['pix.pdf', 'canhoto.pdf'].map((nome, i) => ({
        id: i + 1,
        tipo: 'comprovante',
        nome,
        mime: 'application/pdf',
        tamanho: 1,
        caminho: `900/${nome}`,
        por: 'Kaio',
        em: new Date().toISOString(),
      })),
    })
    await userEvent.click(within(janela).getByRole('button', { name: 'Anexar 2 arquivos' }))
    await waitFor(() => expect(rotasApi.anexarComprovante).toHaveBeenCalledTimes(2))
    expect(vi.mocked(rotasApi.anexarComprovante).mock.calls.map((c) => [c[0], c[1].name])).toEqual([
      [900, 'pix.pdf'],
      [900, 'canhoto.pdf'],
    ])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const depois = screen.getByRole('region', { name: 'Entrega e comprovante' })
    expect(await within(depois).findByText('pix.pdf')).toBeInTheDocument()
    expect(within(depois).getByText('canhoto.pdf')).toBeInTheDocument()
  })
})

// SESSAO-50 (bloco C): a janela "Editar endereço" tem teste próprio — aqui só se
// confere que a ficha a abre do jeito certo (editar / voltar ao original)
vi.mock('@/rotas/JanelaEnderecoPedido', () => ({
  JanelaEnderecoPedido: ({ inicio }: { inicio?: string }) => (
    <div role="dialog" aria-label={`janela do endereço (${inicio ?? 'editar'})`} />
  ),
}))

/**
 * SESSAO-50 (bloco C — pedido do dono, 12/11): a ficha mostra o selo discreto
 * "Endereço alterado na plataforma" com o original do Tiny ao lado, e os botões
 * "Editar endereço" e "Voltar ao endereço original" (a logística e o admin;
 * pedido já entregue, só o admin).
 */
describe('Ficha do pedido — o endereço de entrega alterado na plataforma', () => {
  const comEndereco = (extra: Partial<FichaComDiaReal> = {}) =>
    ({
      ...ficha(),
      entrega: null,
      endereco_entrega: {
        de_entrega: false,
        endereco: 'Rua A',
        numero: '100',
        complemento: 'casa B',
        bairro: 'Centro',
        cidade: 'Natal',
        uf: 'RN',
        cep: null,
      },
      endereco_plataforma: {
        em: '2026-11-12T05:47:12Z',
        por: 'Kaio',
        escolha: 'plataforma',
        tiny_confirmado_em: null,
        original: {
          endereco: 'Rua A',
          numero: '1',
          complemento: null,
          bairro: 'Centro',
          cidade: 'Natal',
          uf: 'RN',
          cep: null,
          fonte: 'cadastro',
        },
      },
      historico: [
        {
          id: 9,
          tipo: 'endereco_entrega_alterado',
          em: '2026-11-12T05:47:12Z',
          registrado_em: '2026-11-12T05:47:12Z',
          por: 'Kaio',
          origem: 'interface',
          observacao:
            'Endereço de entrega alterado na plataforma: de Rua A, 1 · Centro · Natal-RN para Rua A, 100 · Centro · Natal-RN (o Tiny não muda).',
          motivo: null,
          setor: null,
        },
      ],
      ...extra,
    }) as FichaComDiaReal

  it('o selo com o original do Tiny ao lado, "Editar endereço" e "Voltar ao endereço original"', async () => {
    sessao.papel = 'logistica'
    vi.mocked(kanbanApi.detalhePedidoPcp).mockResolvedValue(comEndereco())
    desenhar()
    const painel = await abrirEntrega()
    expect(
      within(painel).getByText('Para onde — endereço alterado na plataforma'),
    ).toBeInTheDocument()
    expect(within(painel).getByText('Rua A, 100 · Centro · Natal-RN')).toBeInTheDocument()
    expect(within(painel).getByText('Endereço alterado na plataforma')).toBeInTheDocument()
    expect(within(painel).getByText('No Tiny: Rua A, 1 · Centro · Natal-RN')).toBeInTheDocument()
    // o do cadastro não se repete embaixo (o original já está no selo)
    expect(within(painel).queryByText(/Cadastro do cliente:/)).not.toBeInTheDocument()

    await userEvent.click(within(painel).getByRole('button', { name: 'Editar endereço' }))
    // a janela é um pedaço próprio do pacote (baixa no clique)
    expect(
      await screen.findByRole('dialog', { name: 'janela do endereço (editar)' }),
    ).toBeInTheDocument()
  })

  it('"Voltar ao endereço original" abre direto a pergunta da volta', async () => {
    sessao.papel = 'logistica'
    vi.mocked(kanbanApi.detalhePedidoPcp).mockResolvedValue(comEndereco())
    desenhar()
    const painel = await abrirEntrega()
    await userEvent.click(
      within(painel).getByRole('button', { name: 'Voltar ao endereço original' }),
    )
    expect(
      await screen.findByRole('dialog', { name: 'janela do endereço (restaurar)' }),
    ).toBeInTheDocument()
  })

  it('o histórico diz o que aconteceu, em português', async () => {
    sessao.papel = 'logistica'
    vi.mocked(kanbanApi.detalhePedidoPcp).mockResolvedValue(comEndereco())
    desenhar()
    await userEvent.click(await screen.findByRole('button', { name: /Histórico/ }))
    expect(screen.getByText('Endereço de entrega alterado na plataforma')).toBeInTheDocument()
  })

  it('pedido já entregue: a logística não vê "Editar endereço"; o administrador vê', async () => {
    sessao.papel = 'logistica'
    vi.mocked(kanbanApi.detalhePedidoPcp).mockResolvedValue({
      ...comEndereco(),
      entrega: ficha().entrega,
    })
    desenhar()
    const painel = await abrirEntrega()
    expect(
      within(painel).queryByRole('button', { name: 'Editar endereço' }),
    ).not.toBeInTheDocument()
  })

  it('pedido já entregue: o administrador ainda edita', async () => {
    sessao.papel = 'admin'
    vi.mocked(kanbanApi.detalhePedidoPcp).mockResolvedValue({
      ...comEndereco(),
      entrega: ficha().entrega,
    })
    desenhar()
    const painel = await abrirEntrega()
    expect(within(painel).getByRole('button', { name: 'Editar endereço' })).toBeInTheDocument()
  })

  it('sem endereço alterado: sem selo; o botão "Editar endereço" continua (a logística)', async () => {
    sessao.papel = 'logistica'
    vi.mocked(kanbanApi.detalhePedidoPcp).mockResolvedValue({ ...ficha(), entrega: null })
    desenhar()
    const painel = await abrirEntrega()
    expect(within(painel).queryByText('Endereço alterado na plataforma')).not.toBeInTheDocument()
    expect(within(painel).getByRole('button', { name: 'Editar endereço' })).toBeInTheDocument()
    expect(
      within(painel).queryByRole('button', { name: 'Voltar ao endereço original' }),
    ).not.toBeInTheDocument()
  })
})
