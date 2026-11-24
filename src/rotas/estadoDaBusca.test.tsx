import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import * as api from './api'
import { acharPontoDoEndereco } from './api'
import type { RespostaGeocodificacao } from './api'
import { CartaoPedido } from './CartaoPedido'
import type { DadosCartaoPedido } from './CartaoPedido'
import { FaixaBuscaFora } from './FaixaBuscaFora'
import { registrarResposta, zerarEstadoDaBusca } from './estadoDaBusca'
import { useGeocodificarFaltantes } from './useGeocodificarFaltantes'

const invocar = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invocar(...a) } },
}))

/**
 * SESSAO-56 (frentes 2 e 3): a busca de endereço que NÃO responde deixa de ser
 * silenciosa — o cartão avisa (com "Marcar no mapa" e "Tentar de novo"), a
 * tela para de insistir e a faixa do topo diz desde quando a busca está fora.
 */
const pedido = (n: number, extra: Partial<DadosCartaoPedido> = {}): DadosCartaoPedido => ({
  numero: 13000 + n,
  cliente_nome: 'Cliente de Teste',
  endereco: 'Rua das Acácias Amarelas',
  numero_endereco: String(n),
  bairro: 'Lagoa Nova',
  cidade: 'Natal',
  uf: 'RN',
  total_unidades: 1,
  itens: [{ descricao: 'Mesa Teste', quantidade: 1 }],
  data_prevista: '2026-11-25',
  geo_chave: `chave-${n}`,
  geo_resolvido: null,
  endereco_geocodificavel: `Rua das Acácias Amarelas ${n}, Lagoa Nova, Natal, RN, Brasil`,
  ...extra,
})

const semResposta = (chaves: string[], foraDesde = '2026-11-19T16:56:00.000Z'): RespostaGeocodificacao => ({
  resultados: chaves.map((chave) => ({ chave, latitude: null, longitude: null, resolvido: false, tentar_depois: true })),
  foraDesde,
})
const doServidor = (r: RespostaGeocodificacao) => ({
  data: { resultados: r.resultados, busca: { fora_desde: r.foraDesde ?? null } },
  error: null,
})

beforeEach(() => {
  invocar.mockReset()
  zerarEstadoDaBusca()
})

describe('o cartão do pedido sem ponto', () => {
  it('enquanto a busca responde: "procurando no mapa…"', () => {
    render(<CartaoPedido pedido={pedido(1)} aoMarcarNoMapa={vi.fn()} />)
    expect(screen.getByText('procurando no mapa…')).toBeInTheDocument()
  })

  it('a busca não respondeu: o aviso em âmbar com os dois botões — e "Marcar no mapa" abre a janela de sempre', async () => {
    const aoMarcar = vi.fn()
    registrarResposta(semResposta(['chave-1']))
    render(<CartaoPedido pedido={pedido(1)} aoMarcarNoMapa={aoMarcar} />)
    expect(screen.queryByText('procurando no mapa…')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(
      'A busca de endereço não respondeu. Marque o ponto no mapa ou tente de novo.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Marcar no mapa' }))
    expect(aoMarcar).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })

  it('"Tentar de novo" pede SÓ aquela chave; a busca voltou → o aviso some de todos os cartões', async () => {
    registrarResposta(semResposta(['chave-1']))
    invocar.mockResolvedValueOnce(
      doServidor({ resultados: [{ chave: 'chave-1', latitude: -5.82, longitude: -35.21, resolvido: true }], foraDesde: null }),
    )
    render(
      <>
        <FaixaBuscaFora />
        <CartaoPedido pedido={pedido(1)} aoMarcarNoMapa={vi.fn()} />
        <CartaoPedido pedido={pedido(2)} aoMarcarNoMapa={vi.fn()} />
      </>,
    )
    expect(screen.getAllByRole('button', { name: 'Tentar de novo' })).toHaveLength(2)
    expect(screen.getByText(/A busca de endereço está fora desde/)).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Tentar de novo' })[0])
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull())
    expect(invocar).toHaveBeenCalledTimes(1)
    expect(invocar).toHaveBeenCalledWith('geocodificar', {
      body: { itens: [{ chave: 'chave-1', endereco: pedido(1).endereco_geocodificavel }] },
    })
    // e a faixa "busca fora" some sozinha
    expect(screen.queryByText(/A busca de endereço está fora/)).toBeNull()
  })

  it('"Tentar de novo" e a busca segue fora: o aviso fica', async () => {
    registrarResposta(semResposta(['chave-1']))
    invocar.mockResolvedValueOnce(doServidor(semResposta(['chave-1'])))
    render(<CartaoPedido pedido={pedido(1)} aoMarcarNoMapa={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(invocar).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeEnabled()
  })

  it('o pedido que já tem ponto (ou o "não achei" de verdade) não ganha o aviso', () => {
    registrarResposta(semResposta(['chave-9']))
    render(<CartaoPedido pedido={pedido(1, { geo_resolvido: true })} aoMarcarNoMapa={vi.fn()} />)
    expect(screen.queryByText(/não respondeu/)).toBeNull()
  })
})

describe('a faixa do topo de Rotas', () => {
  it('não aparece com a busca respondendo; aparece com a hora da queda quando ela está fora', () => {
    const { rerender } = render(<FaixaBuscaFora />)
    expect(screen.queryByRole('status')).toBeNull()
    registrarResposta(semResposta(['x'], '2026-11-19T16:56:00.000Z'))
    rerender(<FaixaBuscaFora />)
    const faixa = screen.getByRole('status')
    expect(faixa).toHaveTextContent(/A busca de endereço está fora desde \d{2}\/\d{2} às \d{2}:\d{2}\. Os pontos novos precisam ser marcados à mão\./)
  })
})

describe('useGeocodificarFaltantes — a tela para de insistir quando a busca não responde', () => {
  const embrulho = () => {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    )
  }
  const sete = Array.from({ length: 7 }, (_, i) => pedido(i + 1))
  const RELER = ['programadas']

  it('"tentar depois" na resposta: uma chamada só (o 2º lote nem sai)', async () => {
    invocar.mockResolvedValue(doServidor(semResposta(sete.slice(0, 5).map((p) => p.geo_chave!))))
    const { rerender } = renderHook(({ itens }) => useGeocodificarFaltantes(itens, RELER, true), {
      initialProps: { itens: sete },
      wrapper: embrulho(),
    })
    await waitFor(() => expect(invocar).toHaveBeenCalledTimes(1))
    rerender({ itens: [...sete] })
    await new Promise((r) => setTimeout(r, 30))
    expect(invocar).toHaveBeenCalledTimes(1)
  })

  it('a chamada inteira falha (rede, sessão, servidor): o mesmo aviso nos cartões, sem insistir', async () => {
    invocar.mockResolvedValue({ data: null, error: new Error('rede') })
    renderHook(() => useGeocodificarFaltantes(sete, RELER, true), { wrapper: embrulho() })
    await waitFor(() => expect(invocar).toHaveBeenCalledTimes(1))
    render(<CartaoPedido pedido={pedido(6)} aoMarcarNoMapa={vi.fn()} />)
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
    expect(invocar).toHaveBeenCalledTimes(1)
  })

  it('reabrir a aba tenta de novo (sem relógio: só neste gesto)', async () => {
    invocar.mockResolvedValue(doServidor(semResposta(sete.slice(0, 5).map((p) => p.geo_chave!))))
    const embrulhar = embrulho()
    const primeira = renderHook(() => useGeocodificarFaltantes(sete, RELER, true), { wrapper: embrulhar })
    await waitFor(() => expect(invocar).toHaveBeenCalledTimes(1))
    primeira.unmount()
    renderHook(() => useGeocodificarFaltantes(sete, RELER, true), { wrapper: embrulhar })
    await waitFor(() => expect(invocar).toHaveBeenCalledTimes(2))
  })

  it('com a busca respondendo, os lotes seguem (5 por vez) até acabar', async () => {
    invocar.mockImplementation(async (_nome: string, { body }: { body: { itens: { chave: string }[] } }) =>
      doServidor({
        resultados: body.itens.map((i) => ({ chave: i.chave, latitude: -5.8, longitude: -35.2, resolvido: true })),
        foraDesde: null,
      }),
    )
    renderHook(() => useGeocodificarFaltantes(sete, RELER, true), { wrapper: embrulho() })
    await waitFor(() => expect(invocar).toHaveBeenCalledTimes(2))
    expect(invocar.mock.calls[0][1].body.itens).toHaveLength(5)
    expect(invocar.mock.calls[1][1].body.itens.map((i: { chave: string }) => i.chave)).toEqual(['chave-6', 'chave-7'])
  })
})

describe('a busca digitada (parada avulsa, janela do mapa, editar endereço)', () => {
  it('"não respondeu" não é mais o mesmo que "não achei"', async () => {
    invocar.mockResolvedValueOnce({
      data: { resultados: [{ chave: 'avulsa:x', latitude: null, longitude: null, resolvido: false, tentar_depois: true }] },
      error: null,
    })
    await expect(acharPontoDoEndereco('rua de teste, natal')).rejects.toBeInstanceOf(api.BuscaSemResposta)
    invocar.mockResolvedValueOnce({
      data: { resultados: [{ chave: 'avulsa:x', latitude: null, longitude: null, resolvido: false }] },
      error: null,
    })
    await expect(acharPontoDoEndereco('rua de teste, natal')).resolves.toBeNull()
  })
})
