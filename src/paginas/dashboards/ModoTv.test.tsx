import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ContextoSessao } from '@/autenticacao/sessao-contexto'
import type { EstadoSessao } from '@/autenticacao/sessao-contexto'
import type { Perfil } from '@/autenticacao/tipos'
import type { PainelTempos } from '@/dashboards/tempos/painel'
import { supabase } from '@/lib/supabase'
import { ModoTv } from './ModoTv'
import { comPainel, EXEMPLO_TV, EXEMPLO_TV_COM_OUTROS } from './tempos/exemplos'

/**
 * SESSAO-47 (Bloco C) — o Modo TV obedece à configuração do painel que vem na
 * própria resposta da porta: os blocos ligam e desligam (e a tela se arruma), o
 * gráfico troca de tipo, o tempo médio diz se é mediana ou média — e a TV aberta
 * muda NA HORA quando o administrador salva (o aviso do canal do setor), sem
 * recarregar. A TV continua só com letras.
 */
const canal = vi.hoisted(() => ({
  topico: '',
  ouvinte: (() => {}) as (evento: string) => void,
  aoStatus: (() => {}) as (status: string) => void,
}))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }))
vi.mock('@/chat/canais', () => ({
  ouvirCanal: (
    topico: string,
    ouvinte: (evento: string) => void,
    aoStatus: (status: string) => void,
  ) => {
    canal.topico = topico
    canal.ouvinte = ouvinte
    canal.aoStatus = aoStatus
    return () => {}
  },
}))
vi.mock('@/perfil/tema', () => ({ aplicarTema: vi.fn() }))
vi.mock('@/dashboards/tempos/GraficoMoveis', () => ({
  GraficoMoveis: ({ tipo, deLonge }: { tipo: string; deLonge?: boolean }) => (
    <div data-testid="grafico" data-tipo={tipo} data-de-longe={String(deLonge === true)} />
  ),
}))

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>

const PERFIL: Perfil = {
  id: 'u-tv',
  nome: 'Conta da TV',
  usuario: 'tv.galpao',
  email: 'tv@teste.com',
  telefone: null,
  matricula: 'MDM-000-009',
  papel: 'operador',
  senha_padrao: false,
  ativo: true,
  arquivado_em: null,
  tema: 'escuro',
  foto_caminho: null,
  modulos: ['tv'],
}

function ligarTv(resposta: unknown) {
  rpc.mockImplementation(async () => ({ data: resposta, error: null }))
  const sessao: EstadoSessao = {
    carregando: false,
    sessao: null,
    perfil: PERFIL,
    vinculos: [],
    ehLider: false,
    recarregarPerfil: async () => {},
    sair: async () => {},
  }
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={['/dashboards/modo-tv?setor=6']}>
      <QueryClientProvider client={cliente}>
        <ContextoSessao.Provider value={sessao}>
          <ModoTv />
        </ContextoSessao.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}
const tvCom = (painel: Partial<PainelTempos>) => comPainel(EXEMPLO_TV, painel)
/** A coluna dos montadores ("Montador A" aparece também na legenda do gráfico e no rodapé). */
const coluna = () => within(document.querySelector('[data-bloco="montadores"]') as HTMLElement)
const RELOGIO = /^\d{2}:\d{2}:\d{2}$/

beforeEach(() => rpc.mockReset())
afterEach(() => vi.restoreAllMocks())

describe('Modo TV · a configuração do painel', () => {
  it('sem a configuração na resposta (o banco de antes): a TV inteira, como sempre', async () => {
    const { container } = ligarTv(comPainel(EXEMPLO_TV, undefined))
    expect(await screen.findByText('montados hoje')).toBeInTheDocument()
    expect(screen.getByText('tempo médio hoje')).toBeInTheDocument()
    expect(screen.getByText('mediana dos 30 dias: 35 min')).toBeInTheDocument()
    expect(coluna().getByText('Montador A')).toBeInTheDocument()
    expect(coluna().getByText(/mediana hoje 38 min · ritmo 1,5\/dia/)).toBeInTheDocument()
    expect(screen.getByTestId('grafico')).toHaveAttribute('data-tipo', 'empilhadas')
    expect(screen.getByTestId('grafico')).toHaveAttribute('data-de-longe', 'true')
    expect(screen.getByText(/Melhor da semana:/)).toBeInTheDocument()
    expect(screen.getByText(/Dados até/)).toBeInTheDocument()
    expect(screen.getByText('ao vivo')).toBeInTheDocument()
    expect(screen.getByText(RELOGIO)).toBeInTheDocument()
    // a coluna e o gráfico lado a lado
    expect(container.querySelector('[data-bloco="montadores"]')).not.toBeNull()
    expect(container.querySelector('[data-bloco="grafico"]')).not.toBeNull()
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('a TV só mostra letras — nenhum nome chega nem aparece', async () => {
    ligarTv(EXEMPLO_TV)
    await screen.findByText('montados hoje')
    expect(coluna().getByText('Montador B')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Ana|Bia|Caio/)
    expect(JSON.stringify(EXEMPLO_TV)).not.toMatch(/nome":"(Ana|Bia|Caio)|foto/)
  })

  it('o tipo do gráfico da TV vem da configuração', async () => {
    ligarTv(tvCom({ grafico_tv: 'linhas' }))
    expect(await screen.findByTestId('grafico')).toHaveAttribute('data-tipo', 'linhas')
    expect(screen.getByText('Montadores A + B')).toBeInTheDocument()
  })

  it('nas barras só com o total, a legenda das letras sai', async () => {
    ligarTv(tvCom({ grafico_tv: 'barras' }))
    expect(await screen.findByTestId('grafico')).toHaveAttribute('data-tipo', 'barras')
    expect(screen.queryByText('Montadores A + B')).not.toBeInTheDocument()
  })

  it('com a média escolhida, a TV diz "média" e mostra a média', async () => {
    ligarTv(tvCom({ medida: 'media' }))
    // hoje: média 2529 s = 42 min (a mediana seria 45); 30 dias: 2350 s = 39 min
    expect(await screen.findByText('42 min')).toBeInTheDocument()
    expect(screen.getByText('média dos 30 dias: 39 min')).toBeInTheDocument()
    expect(screen.getByText(/média hoje 38 min · ritmo/)).toBeInTheDocument()
    expect(screen.queryByText(/mediana/)).not.toBeInTheDocument()
  })

  it('cada bloco desliga sozinho — e os outros continuam', async () => {
    const { container } = ligarTv(
      tvCom({ tv_relogio: false, tv_melhor_semana: false, tv_montadores: false }),
    )
    expect(await screen.findByText('montados hoje')).toBeInTheDocument()
    expect(screen.queryByText(RELOGIO)).not.toBeInTheDocument()
    expect(screen.queryByText(/Melhor da semana/)).not.toBeInTheDocument()
    expect(container.querySelector('[data-bloco="montadores"]')).toBeNull()
    // o gráfico fica (e ocupa a largura toda); o rodapé segue com o que sobrou
    expect(screen.getByTestId('grafico')).toBeInTheDocument()
    expect(screen.getByText(/Dados até/)).toBeInTheDocument()
    expect(screen.getByText('ao vivo')).toBeInTheDocument()
  })

  it('sem os números e sem o gráfico: a coluna dos montadores ocupa a tela', async () => {
    const { container } = ligarTv(tvCom({ tv_numeros: false, tv_grafico: false }))
    await waitFor(() => expect(container.querySelector('[data-bloco="montadores"]')).not.toBeNull())
    expect(coluna().getByText('Montador A')).toBeInTheDocument()
    expect(screen.queryByText('montados hoje')).not.toBeInTheDocument()
    expect(container.querySelector('[data-bloco="numeros"]')).toBeNull()
    expect(screen.queryByTestId('grafico')).not.toBeInTheDocument()
  })

  it('tudo desligado: a TV diz que está desligado na configuração e fica sem rodapé', async () => {
    const { container } = ligarTv(
      tvCom({
        tv_numeros: false,
        tv_montadores: false,
        tv_grafico: false,
        tv_melhor_semana: false,
        tv_relogio: false,
        tv_dados_ate: false,
        tv_ao_vivo: false,
      }),
    )
    expect(
      await screen.findByText(/estão desligados na configuração do painel/),
    ).toBeInTheDocument()
    expect(container.querySelector('footer')).toBeNull()
    // a ligação caiu: o aviso "ao vivo pausado" aparece mesmo com o selo desligado
    act(() => canal.aoStatus('CHANNEL_ERROR'))
    expect(await screen.findByText('ao vivo pausado')).toBeInTheDocument()
  })

  it('montador desligado: a letra dele sai da coluna e o melhor da semana vira "Outros"', async () => {
    ligarTv(EXEMPLO_TV_COM_OUTROS)
    await screen.findByText('montados hoje')
    expect(coluna().getByText('Montador A')).toBeInTheDocument()
    expect(screen.queryByText('Montador B')).not.toBeInTheDocument()
    expect(screen.getByText('Montador A + Outros')).toBeInTheDocument()
    const rodape = screen.getByText(/Melhor da semana:/)
    expect(rodape).toHaveTextContent('Melhor da semana: Outros montou Mesa Lille em 20 min')
  })

  it('a TV aberta muda NA HORA: o aviso do setor chega, ela relê a porta e se redesenha', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    ligarTv(EXEMPLO_TV)
    await screen.findByText('montados hoje')
    expect(coluna().getByText('Montador B')).toBeInTheDocument()
    expect(canal.topico).toBe('plt-aviso:setor_6')
    expect(screen.getByText(RELOGIO)).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledTimes(1)

    // o administrador salvou: sem o relógio, gráfico em linhas, média — e a Bia desligada
    rpc.mockImplementation(async () => ({
      data: comPainel(EXEMPLO_TV_COM_OUTROS, {
        tv_relogio: false,
        grafico_tv: 'linhas',
        medida: 'media',
      }),
      error: null,
    }))
    act(() => {
      canal.aoStatus('SUBSCRIBED')
      canal.ouvinte('mudou')
    })
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2), { timeout: 4000 })
    await waitFor(() => expect(screen.queryByText(RELOGIO)).not.toBeInTheDocument())
    expect(screen.getByTestId('grafico')).toHaveAttribute('data-tipo', 'linhas')
    expect(screen.getByText('média dos 30 dias: 39 min')).toBeInTheDocument()
    expect(screen.queryByText('Montador B')).not.toBeInTheDocument()
    // a mesma tela — nada foi recarregado (a leitura de antes segue na memória até a nova chegar)
    expect(rpc.mock.calls.every((c) => c[0] === 'plt_fn_modo_tv')).toBe(true)
  })
})
