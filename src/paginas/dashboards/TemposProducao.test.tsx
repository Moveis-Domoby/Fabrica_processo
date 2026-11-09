import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ContextoSessao } from '@/autenticacao/sessao-contexto'
import type { EstadoSessao } from '@/autenticacao/sessao-contexto'
import type { Papel, Perfil } from '@/autenticacao/tipos'
import { hojeNaFabrica, somarDias } from '@/dashboards/tempos/formato'
import { PAINEL_PADRAO } from '@/dashboards/tempos/painel'
import { useAoVivo } from '@/lib/aoVivo'
import { supabase } from '@/lib/supabase'
import { TemposProducao } from './TemposProducao'
import { comPainel, EXEMPLO_CONFIGURACAO, EXEMPLO_DIA, EXEMPLO_PERIODO } from './tempos/exemplos'

/**
 * SESSAO-47 (Bloco C) — Dashboards → Tempos de produção: o botão "Configurar
 * painel" só para o admin, e a ABERTURA em uma requisição — a tela nasce no
 * setor e no período configurados; o que está no endereço sempre vence; e, com
 * o banco de antes (sem a porta de abertura), abre como sempre abriu.
 */
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    storage: {
      from: () => ({
        getPublicUrl: (caminho: string) => ({
          data: { publicUrl: `https://fotos.teste/${caminho}` },
        }),
      }),
    },
  },
}))
vi.mock('@/lib/aoVivo', () => ({ useAoVivo: vi.fn() }))
vi.mock('@/kanban/api', () => ({
  buscarSetores: vi.fn(async () => [
    { id: 1, nome: 'PCP', codigo: 'pcp', papel_no_fluxo: 'entrada', ativo: true },
    { id: 6, nome: 'MONTAGEM', codigo: 'montagem', papel_no_fluxo: 'producao', ativo: true },
    {
      id: 7,
      nome: 'LIMPEZA E EMBALAGEM',
      codigo: 'limpeza',
      papel_no_fluxo: 'producao',
      ativo: true,
    },
  ]),
}))
vi.mock('@/dashboards/tempos/GraficoMoveis', () => ({
  GraficoMoveis: ({ tipo }: { tipo: string }) => <div data-testid="grafico" data-tipo={tipo} />,
}))

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>
const aoVivo = useAoVivo as unknown as ReturnType<typeof vi.fn>
const portasChamadas = () => rpc.mock.calls.map((c) => c[0] as string)

const HOJE = hojeNaFabrica()
const SETE_DIAS = somarDias(HOJE, -6)
const TRINTA_DIAS = somarDias(HOJE, -29)

function perfil(papel: Papel): Perfil {
  return {
    id: 'u-1',
    nome: 'Pessoa de Teste',
    usuario: 'pessoa.teste',
    email: 'pessoa@teste.com',
    telefone: null,
    matricula: 'MDM-000-001',
    papel,
    senha_padrao: false,
    ativo: true,
    arquivado_em: null,
    tema: 'claro',
    foto_caminho: null,
    modulos: ['fabrica'],
  }
}

function Endereco() {
  const { pathname, search } = useLocation()
  return <output data-testid="endereco">{pathname + search}</output>
}

function abrirTela(endereco: string, papel: Papel = 'admin') {
  const sessao: EstadoSessao = {
    carregando: false,
    sessao: null,
    perfil: perfil(papel),
    vinculos: [],
    ehLider: papel === 'admin' || papel === 'lider',
    recarregarPerfil: async () => {},
    sair: async () => {},
  }
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[endereco]}>
      <QueryClientProvider client={cliente}>
        <ContextoSessao.Provider value={sessao}>
          <ProvedorNotificacao>
            <TemposProducao />
            <Endereco />
          </ProvedorNotificacao>
        </ContextoSessao.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

/** O banco de mentira: cada porta devolve o que está aqui (ou o erro). */
function banco(respostas: Record<string, unknown>) {
  rpc.mockImplementation(async (nome: string) =>
    nome in respostas
      ? { data: respostas[nome], error: null }
      : { data: null, error: { message: `Could not find the function public.${nome}` } },
  )
}

beforeEach(() => {
  rpc.mockReset()
  aoVivo.mockClear()
})

describe('Tempos de produção · o botão Configurar painel', () => {
  it('aparece para o admin, ao lado do Modo TV, em qualquer aba', async () => {
    banco({ plt_fn_tempos_periodo: EXEMPLO_PERIODO })
    abrirTela('/dashboards/tempos-de-producao?aba=periodo&setor=6')
    expect(await screen.findByRole('button', { name: 'Configurar painel' })).toBeInTheDocument()
  })

  it('não aparece para quem não é admin (o líder só vê o resultado)', async () => {
    banco({ plt_fn_tempos_periodo: EXEMPLO_PERIODO })
    abrirTela('/dashboards/tempos-de-producao?aba=periodo&setor=6', 'lider')
    expect(await screen.findByText('mediana · a média é 39 min')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Configurar painel' })).not.toBeInTheDocument()
  })

  it('a janela só é lida no clique — e mostra a equipe com nome', async () => {
    banco({ plt_fn_tempos_periodo: EXEMPLO_PERIODO, plt_fn_tempos_painel: EXEMPLO_CONFIGURACAO })
    abrirTela('/dashboards/tempos-de-producao?aba=periodo&setor=6')
    const botao = await screen.findByRole('button', { name: 'Configurar painel' })
    await screen.findByText('mediana · a média é 39 min')
    expect(portasChamadas()).toEqual(['plt_fn_tempos_periodo'])
    fireEvent.click(botao)
    expect(await screen.findByRole('dialog', { name: 'Configurar painel' })).toBeInTheDocument()
    expect(await screen.findByText('Bia Lima')).toBeInTheDocument()
    expect(portasChamadas()).toEqual(['plt_fn_tempos_periodo', 'plt_fn_tempos_painel'])
  })
})

describe('Tempos de produção · a abertura', () => {
  it('endereço limpo: UMA chamada resolve o setor, a aba e o período — e a aba não pede de novo', async () => {
    banco({
      plt_fn_tempos_abertura: {
        aba: 'periodo',
        setor_id: 7,
        periodo: '7',
        dia: HOJE,
        de: SETE_DIAS,
        ate: HOJE,
        painel: { ...PAINEL_PADRAO, abrir_setor_id: 7, abrir_periodo: '7' },
        resposta: {
          ...EXEMPLO_PERIODO,
          setor: { id: 7, nome: 'LIMPEZA E EMBALAGEM' },
          de: SETE_DIAS,
          ate: HOJE,
        },
      },
    })
    abrirTela('/dashboards/tempos-de-producao')
    // a aba Período já desenhada com a resposta que veio na abertura
    expect(await screen.findByText('mediana · a média é 39 min')).toBeInTheDocument()
    expect(portasChamadas()).toEqual(['plt_fn_tempos_abertura'])
    expect(rpc.mock.calls[0][1]).toEqual({ p_setor_lembrado: null, p_hoje: HOJE })
    // o endereço passa a dizer onde a tela abriu; os filtros mostram o setor e o período configurados
    expect(screen.getByTestId('endereco')).toHaveTextContent(
      '/dashboards/tempos-de-producao?aba=periodo&setor=7&p=7',
    )
    expect(screen.getByRole('combobox', { name: 'Setor' })).toHaveTextContent('LIMPEZA E EMBALAGEM')
    expect(screen.getByRole('radio', { name: '7 dias' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('tab', { name: 'Período' })).toHaveAttribute('aria-selected', 'true')
    // ao vivo pelo canal do setor que abriu (o mesmo que a TV ouve)
    await waitFor(() =>
      expect(aoVivo).toHaveBeenLastCalledWith(
        'setor_7',
        [['tempos-producao']],
        expect.objectContaining({ ligado: true }),
      ),
    )
    // nada mais foi pedido depois
    expect(portasChamadas()).toEqual(['plt_fn_tempos_abertura'])
  })

  it('sem nada configurado: a abertura devolve a aba Dia de hoje — também em uma chamada', async () => {
    banco({
      plt_fn_tempos_abertura: {
        aba: 'dia',
        setor_id: 6,
        periodo: '30',
        dia: HOJE,
        de: TRINTA_DIAS,
        ate: HOJE,
        painel: PAINEL_PADRAO,
        resposta: EXEMPLO_DIA,
      },
    })
    abrirTela('/dashboards/tempos-de-producao')
    expect(await screen.findByText('mediana · a média é 38 min')).toBeInTheDocument()
    expect(portasChamadas()).toEqual(['plt_fn_tempos_abertura'])
    expect(screen.getByTestId('endereco')).toHaveTextContent(
      '/dashboards/tempos-de-producao?aba=dia&setor=6',
    )
    expect(screen.getByRole('tab', { name: 'Dia' })).toHaveAttribute('aria-selected', 'true')
  })

  it('o endereço manda: com a aba no link, a tela chama direto a porta da aba (sem abertura)', async () => {
    banco({ plt_fn_tempos_periodo: EXEMPLO_PERIODO })
    abrirTela('/dashboards/tempos-de-producao?aba=periodo&setor=6&p=30')
    expect(await screen.findByText('mediana · a média é 39 min')).toBeInTheDocument()
    expect(portasChamadas()).toEqual(['plt_fn_tempos_periodo'])
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_setor_id: 6, p_de: TRINTA_DIAS, p_ate: HOJE })
    expect(screen.getByTestId('endereco')).toHaveTextContent(
      '/dashboards/tempos-de-producao?aba=periodo&setor=6&p=30',
    )
  })

  it('o banco de antes (sem a porta de abertura e sem a configuração): abre como sempre abriu', async () => {
    banco({ plt_fn_tempos_dia: comPainel(EXEMPLO_DIA, undefined) })
    abrirTela('/dashboards/tempos-de-producao')
    // a aba Dia, na Montagem, com o desenho de sempre (mediana)
    expect(await screen.findByText('mediana · a média é 38 min')).toBeInTheDocument()
    expect(portasChamadas()).toEqual(['plt_fn_tempos_abertura', 'plt_fn_tempos_dia'])
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_setor_id: 6, p_dia: HOJE })
    expect(screen.getByRole('combobox', { name: 'Setor' })).toHaveTextContent('MONTAGEM')
  })
})
