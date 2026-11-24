import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import * as api from './api'
import { ModalParadaAvulsa } from './ModalParadaAvulsa'
import { ModalPontoNoMapa } from './ModalPontoNoMapa'
import type { PedidoParaMarcar } from './ModalPontoNoMapa'

/**
 * SESSAO-57 — o pino certo, na tela: a busca digitada que só acha o bairro ou
 * a cidade avisa e só libera o Salvar depois de arrastar (ou de "Salvar assim
 * mesmo"); o pino não arrastado e o pino longe do CEP pedem confirmação.
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
      <button type="button" onClick={() => aoMover(-5.9453, -35.2769)}>
        mover o pino
      </button>
    </div>
  ),
}))
vi.mock('./api', async (original) => {
  const real = await original<typeof import('./api')>()
  return {
    ...real,
    acharPontoDoEndereco: vi.fn(),
    pontoDoCepParaConferir: vi.fn(async () => null),
    marcarPontoNoMapa: vi.fn(async () => {}),
  }
})

const LUGAR_13961 = {
  latitude: -5.909406,
  longitude: -35.251107,
  aproximado: { nivel: 'bairro' as const, nome: 'Nova Esperança' },
}

function envolver(no: React.ReactNode) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ProvedorNotificacao>{no}</ProvedorNotificacao>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.mocked(api.acharPontoDoEndereco).mockReset()
  vi.mocked(api.pontoDoCepParaConferir).mockReset().mockResolvedValue(null)
  vi.mocked(api.marcarPontoNoMapa).mockClear()
})

describe('parada avulsa · a busca digitada que só acha o bairro', { timeout: 20_000 }, () => {
  async function procurar() {
    vi.mocked(api.acharPontoDoEndereco).mockResolvedValue(LUGAR_13961)
    const aoSalvar = vi.fn()
    render(envolver(<ModalParadaAvulsa aberto aoFechar={() => {}} aoSalvar={aoSalvar} />))
    await userEvent.type(screen.getByLabelText('Título'), 'TESTE AGENTE')
    await userEvent.type(
      screen.getByLabelText('Endereço'),
      'Rua Veredas do Peruaçu 125, Nova Esperança, Parnamirim',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Achar no mapa' }))
    return { aoSalvar }
  }

  it('avisa em âmbar, o pino abre no bairro e o Salvar fica travado', async () => {
    await procurar()
    expect(
      await screen.findByText(
        /Não achei a rua no mapa — o pino está no bairro Nova Esperança\. Arraste até a casa antes de salvar\./,
      ),
    ).toBeInTheDocument()
    expect(await screen.findByText('pino em -5.909406, -35.251107')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar a parada' })).toBeDisabled()
  })

  it('arrastar o pino libera o Salvar', async () => {
    const { aoSalvar } = await procurar()
    await userEvent.click(await screen.findByRole('button', { name: 'mover o pino' }))
    const salvar = screen.getByRole('button', { name: 'Salvar a parada' })
    expect(salvar).toBeEnabled()
    await userEvent.click(salvar)
    expect(aoSalvar).toHaveBeenCalledWith(expect.objectContaining({ latitude: -5.9453, longitude: -35.2769 }))
  })

  it('"Salvar assim mesmo" libera sem arrastar (e não pergunta de novo)', async () => {
    const { aoSalvar } = await procurar()
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar assim mesmo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar a parada' }))
    expect(aoSalvar).toHaveBeenCalledWith(expect.objectContaining({ latitude: -5.909406 }))
  })

  it('o pino longe do CEP escrito no endereço pergunta antes ("Voltar" não salva)', async () => {
    vi.mocked(api.acharPontoDoEndereco).mockResolvedValue({ latitude: -5.909406, longitude: -35.251107 })
    vi.mocked(api.pontoDoCepParaConferir).mockResolvedValue({ latitude: -5.9453, longitude: -35.2769 })
    const aoSalvar = vi.fn()
    render(envolver(<ModalParadaAvulsa aberto aoFechar={() => {}} aoSalvar={aoSalvar} />))
    await userEvent.type(screen.getByLabelText('Título'), 'TESTE AGENTE')
    await userEvent.type(screen.getByLabelText('Endereço'), 'Rua X 125, Parnamirim, 59144-158')
    await userEvent.click(screen.getByRole('button', { name: 'Achar no mapa' }))
    await screen.findByText('pino em -5.909406, -35.251107')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar a parada' }))
    expect(
      await screen.findByText(/O pino está a 4,9 km do CEP deste endereço\. Confira antes de salvar\./),
    ).toBeInTheDocument()
    expect(api.pontoDoCepParaConferir).toHaveBeenCalledWith('59144158')
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(aoSalvar).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar a parada' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar assim mesmo' }))
    expect(aoSalvar).toHaveBeenCalledTimes(1)
  })

  it('o serviço de CEP sem resposta não bloqueia nada', async () => {
    vi.mocked(api.acharPontoDoEndereco).mockResolvedValue({ latitude: -5.909406, longitude: -35.251107 })
    const aoSalvar = vi.fn()
    render(envolver(<ModalParadaAvulsa aberto aoFechar={() => {}} aoSalvar={aoSalvar} />))
    await userEvent.type(screen.getByLabelText('Título'), 'TESTE AGENTE')
    await userEvent.type(screen.getByLabelText('Endereço'), 'Rua X 125, Parnamirim, 59144-158')
    await userEvent.click(screen.getByRole('button', { name: 'Achar no mapa' }))
    await screen.findByText('pino em -5.909406, -35.251107')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar a parada' }))
    expect(aoSalvar).toHaveBeenCalledTimes(1)
  })
})

describe('"Ajustar o pino" · o pino não arrastado (o 13840)', { timeout: 20_000 }, () => {
  const CENTRO_NATAL = { latitude: -5.805398, longitude: -35.2080905 }
  const pedido = (extra: Partial<PedidoParaMarcar> = {}): PedidoParaMarcar => ({
    numero: 13840,
    endereco: 'Rua José de Souza Cruz',
    numero_endereco: '1570',
    bairro: 'Mãe Luiza',
    cidade: 'Natal',
    uf: 'RN',
    geo_chave: 'chave',
    endereco_geocodificavel: 'Rua José de Souza Cruz 1570, Mãe Luiza, Natal, RN, 59014-430, Brasil',
    ...CENTRO_NATAL,
    geo_resolvido: true,
    geo_manual: false,
    geo_aproximado: 'cidade',
    cep: '59014-430',
    ...extra,
  })

  it('salvar sem mover pergunta: "Você não moveu o pino — ele está no centro de Natal…"', async () => {
    render(envolver(<ModalPontoNoMapa pedido={pedido()} aoFechar={() => {}} />))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar o ponto' }))
    expect(
      await screen.findByText(
        'Você não moveu o pino — ele está no centro de Natal. Arraste até a casa ou confirme.',
      ),
    ).toBeInTheDocument()
    expect(api.marcarPontoNoMapa).not.toHaveBeenCalled()
    // "Voltar": nada salvo, os botões de sempre voltam
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByRole('button', { name: 'Salvar o ponto' })).toBeInTheDocument()
    // "Salvar assim mesmo": salva o ponto como está (o CEP sem resposta não bloqueia)
    await userEvent.click(screen.getByRole('button', { name: 'Salvar o ponto' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar assim mesmo' }))
    expect(api.marcarPontoNoMapa).toHaveBeenCalledWith(expect.objectContaining(CENTRO_NATAL))
  })

  it('arrastado: salva sem a pergunta do pino (só confere o CEP)', async () => {
    vi.mocked(api.pontoDoCepParaConferir).mockResolvedValue({ latitude: -5.946, longitude: -35.277 })
    render(envolver(<ModalPontoNoMapa pedido={pedido()} aoFechar={() => {}} />))
    await userEvent.click(await screen.findByRole('button', { name: 'mover o pino' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar o ponto' }))
    expect(api.marcarPontoNoMapa).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: -5.9453, longitude: -35.2769 }),
    )
    expect(screen.queryByText(/Você não moveu o pino/)).not.toBeInTheDocument()
  })

  it('o marcado à mão no centro da cidade (a lista avisou) também pergunta', async () => {
    render(
      envolver(
        <ModalPontoNoMapa
          pedido={pedido({ geo_manual: true, geo_aproximado: null, pino_no_centro: true })}
          aoFechar={() => {}}
        />,
      ),
    )
    expect(screen.getByText(/O pino foi salvo no centro da cidade, não na casa/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar o ponto' }))
    expect(await screen.findByText(/Você não moveu o pino — ele está no centro de Natal/)).toBeInTheDocument()
  })

  it('o ponto de rua (não aproximado) salva direto quando está perto do CEP', async () => {
    vi.mocked(api.pontoDoCepParaConferir).mockResolvedValue({ latitude: -5.79, longitude: -35.2 })
    render(
      envolver(
        <ModalPontoNoMapa
          pedido={pedido({ latitude: -5.791, longitude: -35.201, geo_aproximado: null })}
          aoFechar={() => {}}
        />,
      ),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Salvar o ponto' }))
    expect(api.marcarPontoNoMapa).toHaveBeenCalledTimes(1)
  })

  it('"Achar no mapa" que só acha a cidade trava o Salvar até arrastar', async () => {
    vi.mocked(api.acharPontoDoEndereco).mockResolvedValue({
      latitude: -5.8,
      longitude: -35.21,
      aproximado: { nivel: 'cidade', nome: 'Natal' },
    })
    render(envolver(<ModalPontoNoMapa pedido={pedido({ geo_aproximado: null, latitude: -5.79, longitude: -35.2 })} aoFechar={() => {}} />))
    await userEvent.click(screen.getByRole('button', { name: 'Achar no mapa' }))
    expect(await screen.findByText(/o pino está no centro de Natal\. Arraste até a casa antes de salvar/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar o ponto' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'mover o pino' }))
    expect(screen.getByRole('button', { name: 'Salvar o ponto' })).toBeEnabled()
  })
})
