import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import * as api from './api'
import * as endereco from './enderecoDoPedido'
import type { EnderecoDoPedido } from './enderecoDoPedido'
import { JanelaEnderecoPedido } from './JanelaEnderecoPedido'

/**
 * SESSAO-50 (bloco C — pedido do dono, 12/11): a janela "Editar endereço" do
 * pedido. Mudar só o pino salva direto (o Tiny não guarda ponto); mudar o
 * texto pergunta "salvar também no Tiny?" — o botão do Tiny desligado, com o
 * porquê que o banco devolve; "Voltar ao endereço original" faz a mesma
 * pergunta. A janela lê ao abrir.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('./MapaPinoParada', () => ({
  default: ({
    latitude,
    longitude,
    aoMover,
  }: {
    latitude: number
    longitude: number
    aoMover: (lat: number, lon: number) => void
  }) => (
    <div>
      <p>
        pino em {latitude}, {longitude}
      </p>
      <button type="button" onClick={() => aoMover(-5.9, -35.2)}>
        mover o pino
      </button>
    </div>
  ),
}))
vi.mock('./api', async (original) => {
  const real = await original<typeof import('./api')>()
  return {
    ...real,
    acharPontoDoEndereco: vi.fn(async () => ({ latitude: -5.95, longitude: -35.25 })),
    marcarPontoNoMapa: vi.fn(async () => {}),
  }
})
vi.mock('./enderecoDoPedido', async (original) => {
  const real = await original<typeof import('./enderecoDoPedido')>()
  return {
    ...real,
    lerEnderecoDoPedido: vi.fn(),
    salvarEnderecoDoPedido: vi.fn(async () => ({ mudou: true, restaurado: false })),
    restaurarEnderecoDoPedido: vi.fn(async () => ({ mudou: true, restaurado: true })),
  }
})

const ATUAL = {
  endereco: 'Rua Jacarandá',
  numero: '55',
  complemento: null,
  bairro: 'Centro',
  cidade: 'Parnamirim',
  uf: 'RN',
  cep: '59140-000',
}
const MOTIVO_SITUACAO = 'O Tiny só deixa alterar o endereço de pedido Em aberto ou Aprovado.'
const MOTIVO_VOLTAR = 'O Tiny já está com o endereço original — só a plataforma volta.'

const dados = (extra: Partial<EnderecoDoPedido> = {}): EnderecoDoPedido => ({
  pedido_id: 77,
  numero: 13871,
  situacao: 'Preparando envio',
  card_id: 9,
  entregue: false,
  pode_editar: true,
  motivo: null,
  fonte: 'cadastro',
  atual: ATUAL,
  tiny: { ...ATUAL, fonte: 'cadastro' },
  plataforma: null,
  geo: {
    chave: 'chave-de-agora',
    endereco_geocodificavel: 'Rua Jacarandá 55, Centro, Parnamirim, RN, 59140-000, Brasil',
    latitude: -5.91,
    longitude: -35.26,
    resolvido: true,
    manual: false,
  },
  tiny_salvar: { pode: false, motivo: MOTIVO_SITUACAO },
  tiny_restaurar: { pode: false, motivo: MOTIVO_SITUACAO },
  ...extra,
})

function desenhar(d: EnderecoDoPedido, inicio: 'editar' | 'restaurar' = 'editar') {
  vi.mocked(endereco.lerEnderecoDoPedido).mockResolvedValue(d)
  const aoFechar = vi.fn()
  const aoMudar = vi.fn()
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <ProvedorNotificacao>
        <JanelaEnderecoPedido
          pedidoId={77}
          numero={13871}
          inicio={inicio}
          aoFechar={aoFechar}
          aoMudar={aoMudar}
        />
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
  return { aoFechar, aoMudar }
}

beforeEach(() => {
  vi.mocked(endereco.salvarEnderecoDoPedido).mockClear()
  vi.mocked(endereco.restaurarEnderecoDoPedido).mockClear()
  vi.mocked(api.marcarPontoNoMapa).mockClear()
})

describe('JanelaEnderecoPedido — editar o endereço de entrega do pedido', () => {
  it('abre preenchida com o endereço que vale e o pino de agora; mudar só o pino salva direto, sem pergunta do Tiny', async () => {
    const { aoFechar, aoMudar } = desenhar(dados())
    expect(await screen.findByLabelText('Rua')).toHaveValue('Rua Jacarandá')
    expect(screen.getByLabelText('Número')).toHaveValue('55')
    expect(screen.getByLabelText('CEP')).toHaveValue('59140-000')
    expect(await screen.findByText('pino em -5.91, -35.26')).toBeInTheDocument()
    // nada mudou: nada a salvar
    expect(screen.getByRole('button', { name: 'Salvar o endereço' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'mover o pino' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar o ponto' }))
    expect(api.marcarPontoNoMapa).toHaveBeenCalledWith({
      chave: 'chave-de-agora',
      endereco: 'Rua Jacarandá 55, Centro, Parnamirim, RN, 59140-000, Brasil',
      latitude: -5.9,
      longitude: -35.2,
    })
    expect(screen.queryByText(/salvar também no Tiny/i)).not.toBeInTheDocument()
    expect(endereco.salvarEnderecoDoPedido).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(aoFechar).toHaveBeenCalled())
    expect(aoMudar).toHaveBeenCalled()
  })

  it('mudar o texto pergunta "salvar também no Tiny?": De/Para, o botão do Tiny desligado com o porquê; "Salvar só na plataforma" salva (sem o pino do endereço de antes)', async () => {
    desenhar(dados())
    const numero = await screen.findByLabelText('Número')
    await userEvent.clear(numero)
    await userEvent.type(numero, '555')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar o endereço' }))

    const janela = await screen.findByRole('dialog', {
      name: 'Trocar o endereço de entrega do pedido 13871?',
    })
    expect(within(janela).getByText('De:').nextSibling).toHaveTextContent(
      'Rua Jacarandá, 55 · Centro · Parnamirim-RN',
    )
    expect(within(janela).getByText('Para:').nextSibling).toHaveTextContent(
      'Rua Jacarandá, 555 · Centro · Parnamirim-RN',
    )
    expect(
      within(janela).getByText(
        /Deseja salvar também no Tiny\? O endereço original do Tiny fica guardado na plataforma, e você pode voltar a ele quando quiser\./,
      ),
    ).toBeInTheDocument()
    const tiny = within(janela).getByRole('button', { name: 'Salvar na plataforma e no Tiny' })
    expect(tiny).toBeDisabled()
    expect(tiny).toHaveAccessibleDescription(MOTIVO_SITUACAO)
    expect(
      within(janela).getByText(
        'O ponto no mapa: a rota procura pelo endereço novo (dá para acertar o pino depois).',
      ),
    ).toBeInTheDocument()

    await userEvent.click(within(janela).getByRole('button', { name: 'Salvar só na plataforma' }))
    expect(endereco.salvarEnderecoDoPedido).toHaveBeenCalledWith({
      pedidoId: 77,
      endereco: { ...ATUAL, numero: '555' },
      latitude: null,
      longitude: null,
      tiny: false,
    })
  })

  it('"Voltar" na pergunta devolve ao formulário com o que foi escrito', async () => {
    desenhar(dados())
    const numero = await screen.findByLabelText('Número')
    await userEvent.clear(numero)
    await userEvent.type(numero, '555')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar o endereço' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Voltar' }))
    expect(await screen.findByLabelText('Número')).toHaveValue('555')
    expect(endereco.salvarEnderecoDoPedido).not.toHaveBeenCalled()
  })

  it('o pino marcado DEPOIS de escrever o endereço novo vai junto (é o ponto do endereço novo)', async () => {
    desenhar(dados())
    const rua = await screen.findByLabelText('Rua')
    await userEvent.clear(rua)
    await userEvent.type(rua, 'Avenida Nova')
    // o pino de agora é do endereço de antes: a tela avisa
    expect(await screen.findByText(/O pino é do endereço de antes/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'mover o pino' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar o endereço' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar só na plataforma' }))
    expect(endereco.salvarEnderecoDoPedido).toHaveBeenCalledWith(
      expect.objectContaining({
        endereco: expect.objectContaining({ endereco: 'Avenida Nova' }),
        latitude: -5.9,
        longitude: -35.2,
      }),
    )
  })

  it('"Achar no mapa" procura o endereço escrito e o pino achado vai junto', async () => {
    desenhar(dados())
    const numero = await screen.findByLabelText('Número')
    await userEvent.clear(numero)
    await userEvent.type(numero, '600')
    await userEvent.click(screen.getByRole('button', { name: 'Achar no mapa' }))
    expect(api.acharPontoDoEndereco).toHaveBeenCalledWith(
      'Rua Jacarandá 600, Centro, Parnamirim, RN, 59140-000',
    )
    expect(await screen.findByText('pino em -5.95, -35.25')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar o endereço' }))
    expect(
      await screen.findByText('O ponto no mapa: o pino que você marcou para o endereço novo.'),
    ).toBeInTheDocument()
  })

  it('sem a rua: "Salvar o endereço" desligado e a linha diz o que falta', async () => {
    desenhar(dados())
    await userEvent.clear(await screen.findByLabelText('Rua'))
    expect(screen.getByRole('button', { name: 'Salvar o endereço' })).toBeDisabled()
    expect(screen.getByText(/Para salvar, falta: a rua/)).toBeInTheDocument()
  })

  it('endereço já mudado: o selo com o original do Tiny ao lado e "Voltar ao endereço original" (a mesma pergunta, o Tiny desligado com o porquê)', async () => {
    const mudado = { ...ATUAL, numero: '555', complemento: 'casa B' }
    desenhar(
      dados({
        fonte: 'plataforma',
        atual: mudado,
        plataforma: {
          em: '2026-11-12T05:47:12Z',
          por: 'Logística C',
          escolha: 'plataforma',
          tiny_confirmado_em: null,
          original: { ...ATUAL, fonte: 'cadastro' },
        },
        tiny_restaurar: { pode: false, motivo: MOTIVO_VOLTAR },
      }),
    )
    expect(await screen.findByText('Endereço alterado na plataforma')).toBeInTheDocument()
    expect(
      screen.getByText('No Tiny: Rua Jacarandá, 55 · Centro · Parnamirim-RN'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Mudado por Logística C em/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Voltar ao endereço original' }))
    const janela = await screen.findByRole('dialog', {
      name: 'Voltar ao endereço original do pedido 13871?',
    })
    expect(within(janela).getByText('De:').nextSibling).toHaveTextContent('Rua Jacarandá, 555')
    expect(within(janela).getByText('Para:').nextSibling).toHaveTextContent(
      'Rua Jacarandá, 55 · Centro · Parnamirim-RN',
    )
    const tiny = within(janela).getByRole('button', { name: 'Salvar na plataforma e no Tiny' })
    expect(tiny).toBeDisabled()
    expect(tiny).toHaveAccessibleDescription(MOTIVO_VOLTAR)
    await userEvent.click(within(janela).getByRole('button', { name: 'Salvar só na plataforma' }))
    expect(endereco.restaurarEnderecoDoPedido).toHaveBeenCalledWith({ pedidoId: 77, tiny: false })
  })

  it('aberta direto na volta ao original (a ficha): "Voltar" fecha a janela', async () => {
    const { aoFechar } = desenhar(
      dados({
        fonte: 'plataforma',
        atual: { ...ATUAL, numero: '555' },
        plataforma: {
          em: '2026-11-12T05:47:12Z',
          por: null,
          escolha: 'plataforma',
          tiny_confirmado_em: null,
          original: { ...ATUAL, fonte: 'cadastro' },
        },
        tiny_restaurar: { pode: false, motivo: MOTIVO_VOLTAR },
      }),
      'restaurar',
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Voltar' }))
    expect(aoFechar).toHaveBeenCalled()
    expect(endereco.restaurarEnderecoDoPedido).not.toHaveBeenCalled()
  })

  it('pedido entregue para quem não é administrador: o porquê, sem o formulário', async () => {
    desenhar(
      dados({
        entregue: true,
        pode_editar: false,
        motivo: 'O pedido já foi entregue — só um administrador muda o endereço.',
      }),
    )
    expect(
      await screen.findByText('O pedido já foi entregue — só um administrador muda o endereço.'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Rua')).not.toBeInTheDocument()
    // o X do topo e o "Fechar" do rodapé (nada de salvar)
    expect(screen.getAllByRole('button', { name: 'Fechar' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /Salvar/ })).not.toBeInTheDocument()
  })
})
