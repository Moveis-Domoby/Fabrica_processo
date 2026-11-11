import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { abrirPlataforma, reiniciarAberturaParaTeste } from './abertura'

/**
 * SESSAO-48 (frente 5 — "a plataforma recarrega sozinha"): a 1ª abertura de
 * cada PÁGINA leva à porta de abertura o porquê dela (o navegador e a própria
 * plataforma) — uma vez só. Trocar de conta sem recarregar (entrar de novo, a
 * troca vinda de outra aba) é navegação, não abertura. Com o banco ainda sem o
 * 3º argumento, a tela nova abre do jeito de sempre.
 */
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }))
vi.mock('@/lib/recarga', () => ({
  contextoDaCarga: () => ({ carga: 'reload', recarga: 'troca_setor', versao: '28ea753f9cca' }),
}))

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>
const PERFIL = { id: 'u-1', nome: 'Tablet · CNC' }
const respostaOk = () => ({ data: { agora_ms: 1, perfil: PERFIL, vinculos: [] }, error: null })
const CONTEXTO = { carga: 'reload', recarga: 'troca_setor', versao: '28ea753f9cca' }

beforeEach(() => {
  rpc.mockReset()
  reiniciarAberturaParaTeste()
  window.history.replaceState({}, '', '/tablet')
})

describe('o porquê da abertura vai uma vez por página', () => {
  it('a 1ª abertura leva o contexto; trocar de conta depois (sem recarregar) não leva', async () => {
    rpc.mockResolvedValue(respostaOk())
    await abrirPlataforma(true)
    expect(rpc).toHaveBeenLastCalledWith('plt_fn_abertura', {
      p_rota: '/tablet',
      p_meu_painel: false,
      p_contexto: CONTEXTO,
    })
    await abrirPlataforma(true)
    expect(rpc).toHaveBeenLastCalledWith('plt_fn_abertura', {
      p_rota: '/tablet',
      p_meu_painel: false,
    })
  })

  it('a releitura do perfil (sem rota) nunca leva contexto — e não gasta o da página', async () => {
    rpc.mockResolvedValue(respostaOk())
    await abrirPlataforma(false)
    expect(rpc).toHaveBeenLastCalledWith('plt_fn_abertura', { p_rota: null, p_meu_painel: false })
    window.history.replaceState({}, '', '/')
    await abrirPlataforma(true)
    expect(rpc).toHaveBeenLastCalledWith('plt_fn_abertura', {
      p_rota: '/inicio/meu-painel',
      p_meu_painel: true,
      p_contexto: CONTEXTO,
    })
  })

  it('o banco ainda sem o 3º argumento: tenta de novo sem ele e a página abre', async () => {
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST202', message: 'Could not find the function' },
      })
      .mockResolvedValueOnce(respostaOk())
    const abertura = await abrirPlataforma(true)
    expect(abertura.perfil?.id).toBe('u-1')
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc).toHaveBeenLastCalledWith('plt_fn_abertura', {
      p_rota: '/tablet',
      p_meu_painel: false,
    })
  })

  it('outro erro: a abertura falha (a casca cai na reserva) e o porquê fica para a próxima tentativa', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '57014', message: 'tempo esgotado' } })
    await expect(abrirPlataforma(true)).rejects.toThrow('Não deu para abrir a plataforma')
    rpc.mockResolvedValueOnce(respostaOk())
    await abrirPlataforma(true)
    expect(rpc).toHaveBeenLastCalledWith('plt_fn_abertura', {
      p_rota: '/tablet',
      p_meu_painel: false,
      p_contexto: CONTEXTO,
    })
  })

  it('sem cadastro ativo nada é gravado: o porquê fica para quando alguém entrar nesta página', async () => {
    rpc.mockResolvedValueOnce({ data: { agora_ms: 1, perfil: null, vinculos: [] }, error: null })
    await abrirPlataforma(true)
    rpc.mockResolvedValueOnce(respostaOk())
    await abrirPlataforma(true)
    expect(rpc).toHaveBeenLastCalledWith('plt_fn_abertura', {
      p_rota: '/tablet',
      p_meu_painel: false,
      p_contexto: CONTEXTO,
    })
  })
})
