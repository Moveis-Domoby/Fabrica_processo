import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { cancelarRecarga, prepararRecarga, reiniciarRecargaParaTeste } from '@/lib/recarga'
import { ProvedorSessao } from './ProvedorSessao'
import { reiniciarAberturaParaTeste } from './abertura'
import { useSessao } from './sessao-contexto'

/**
 * SESSAO-48 (frente 5 — o laço da troca de setor do tablet, 10/11 11:23): a
 * troca entra com a conta do setor de destino e recarrega a página. Antes, a
 * página reagia à conta nova ANTES de recarregar — abria a plataforma com ela
 * (uma abertura registrada) e a recarga abria de novo. Agora, com a recarga em
 * curso, a sessão desta página não reage; e trocar de conta sem recarregar
 * (entrar de novo, a troca vinda de outra aba) não é registrado como abertura.
 */
const auth = vi.hoisted(() => ({
  ouvinte: null as null | ((evento: string, sessao: unknown) => void),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn((ouvinte: (evento: string, sessao: unknown) => void) => {
        auth.ouvinte = ouvinte
        return { data: { subscription: { unsubscribe: () => {} } } }
      }),
      signOut: vi.fn(),
    },
  },
}))
vi.mock('@/chat/canais', () => ({
  acertarRelogio: vi.fn(),
  pedirReprise: vi.fn(),
  topicoDaPessoa: (id: string) => `pessoa:${id}`,
}))
vi.mock('@/perfil/tema', () => ({ aplicarTema: vi.fn(), ehTema: () => false }))

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>
const getSession = supabase.auth.getSession as unknown as ReturnType<typeof vi.fn>

const sessaoDe = (id: string) => ({ access_token: `token-${id}`, user: { id } })
const perfilDe = (authId: string) => ({
  id: `perfil-${authId}`,
  nome: `Tablet ${authId}`,
  papel: 'operador',
  conta_tablet: true,
})

function Sonda() {
  const { perfil, carregando } = useSessao()
  return <p>{carregando ? 'carregando' : (perfil?.id ?? 'sem perfil')}</p>
}

const aberturas = () => rpc.mock.calls.filter(([nome]) => nome === 'plt_fn_abertura')

/** A conta da sessão "do navegador" — a porta devolve o perfil dela. */
let contaAtual = 'cnc'
const entrarCom = async (conta: string, evento = 'SIGNED_IN') => {
  contaAtual = conta
  await act(async () => auth.ouvinte?.(evento, sessaoDe(conta)))
}
const deixarCorrer = () => act(async () => void (await new Promise((r) => setTimeout(r, 20))))

beforeEach(() => {
  rpc.mockReset()
  reiniciarRecargaParaTeste(() => {})
  reiniciarAberturaParaTeste()
  window.history.replaceState({}, '', '/tablet')
  contaAtual = 'cnc'
  getSession.mockResolvedValue({ data: { session: sessaoDe('cnc') } })
  rpc.mockImplementation(async (nome: string) => {
    if (nome !== 'plt_fn_abertura') return { data: null, error: null }
    return {
      data: { agora_ms: Date.now(), perfil: perfilDe(contaAtual), vinculos: [] },
      error: null,
    }
  })
})

afterEach(() => {
  cancelarRecarga()
})

function montar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <ProvedorSessao>
        <Sonda />
      </ProvedorSessao>
    </QueryClientProvider>,
  )
}

describe('a troca de setor do tablet abre a plataforma uma vez só', () => {
  it('com a recarga em curso, a conta nova não abre a plataforma nesta página', async () => {
    montar()
    expect(await screen.findByText('perfil-cnc')).toBeInTheDocument()
    expect(aberturas()).toHaveLength(1)
    // a 1ª abertura da página leva o porquê (o contexto)
    expect(aberturas()[0][1]).toHaveProperty('p_contexto')

    // o PIN do setor de destino conferiu: a sessão nova chega, e a página vai recarregar
    prepararRecarga()
    await entrarCom('fitamento')
    await deixarCorrer()
    expect(aberturas()).toHaveLength(1)
    expect(screen.getByText('perfil-cnc')).toBeInTheDocument()
  })

  it('trocar de conta SEM recarregar (a troca vinda de outra aba) abre a conta nova, mas não como abertura da página', async () => {
    montar()
    expect(await screen.findByText('perfil-cnc')).toBeInTheDocument()
    await entrarCom('fitamento')
    expect(await screen.findByText('perfil-fitamento')).toBeInTheDocument()
    expect(aberturas()).toHaveLength(2)
    const [, argumentos] = aberturas()[1]
    expect(argumentos).toEqual({ p_rota: '/tablet', p_meu_painel: false })
  })

  it('a renovação do token (a mesma conta, o padrão dos 40 min) não abre a plataforma de novo', async () => {
    montar()
    expect(await screen.findByText('perfil-cnc')).toBeInTheDocument()
    await entrarCom('cnc', 'TOKEN_REFRESHED')
    await entrarCom('cnc', 'SIGNED_IN')
    await deixarCorrer()
    expect(aberturas()).toHaveLength(1)
  })
})
