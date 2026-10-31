import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ContextoSessao } from '@/autenticacao/sessao-contexto'
import type { EstadoSessao } from '@/autenticacao/sessao-contexto'
import type { Perfil } from '@/autenticacao/tipos'
import { supabase } from '@/lib/supabase'
import { ControleTempo } from './ControleTempo'

/**
 * Configurações → Controle de tempo (SESSAO-42 · F2): abas, uma porta por aba
 * lida só quando a aba abre; o líder de setor vê só a Hora extra.
 */
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }))
vi.mock('@/lib/aoVivo', () => ({ useAoVivo: vi.fn() }))
vi.mock('@/kanban/api', () => ({
  buscarSetores: vi.fn(async () => [
    { id: 1, nome: 'PCP', papel_no_fluxo: 'entrada' },
    { id: 3, nome: 'MONTAGEM', papel_no_fluxo: 'producao' },
  ]),
  buscarNomesUsuarios: vi.fn(async () => new Map()),
}))

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>

const SEG_A_SEX = [1, 2, 3, 4, 5].flatMap((d) => [
  [d, '07:30', '12:00'],
  [d, '13:00', '18:00'],
])

const RESPOSTAS: Record<string, unknown> = {
  plt_fn_tempo_expediente: {
    setores: [
      {
        id: 3,
        nome: 'MONTAGEM',
        papel: 'producao',
        faixas: [...SEG_A_SEX, [6, '07:30', '11:00']],
      },
    ],
  },
  plt_fn_tempo_expediente_salvar: { setores: 1 },
  plt_fn_tempo_horas_extras: {
    itens: [
      {
        id: 9,
        setor_id: 3,
        setor: 'MONTAGEM',
        usuario_id: null,
        pessoa: null,
        inicio: '2026-10-25T21:00:00Z',
        fim: '2026-10-25T23:00:00Z',
        motivo: 'Pedido grande',
        por: 'Dono',
        criado_em: '2026-10-25T12:00:00Z',
        cancelada_em: null,
      },
    ],
    tem_mais: false,
    setores: [{ id: 3, nome: 'MONTAGEM' }],
    pessoas: [],
    admin: false,
  },
  plt_fn_tempo_hora_extra_salvar: 10,
  plt_fn_tempo_calendario: {
    excecoes: [
      {
        id: 1,
        setor_id: null,
        setor: null,
        dia: '2026-12-25',
        tipo: 'feriado',
        descricao: 'Natal',
        faixas: [],
        por: null,
      },
    ],
    setores: [{ id: 3, nome: 'MONTAGEM' }],
  },
  plt_fn_tempo_regras: {
    config: { data_oficial: '2026-10-19', recalcular_desde: null },
    setores: [
      {
        setor_id: 3,
        nome: 'MONTAGEM',
        aviso_esquecido_min: 60,
        minimo_min: 3,
        teto_min: null,
        fator_longo: 3,
        base_minima: 5,
        pausar_fim_expediente: true,
        sem_resposta_min: 15,
        volta_rapida_min: 5,
        retrabalho_fora: true,
        admin_fora: true,
        avisar_pulo: true,
        permite_lote: false,
        faixa_media_pct: 10,
        janela_padrao_dias: 90,
      },
    ],
  },
  plt_fn_tempo_regras_salvar: {},
  plt_fn_tempo_recalculos: {
    itens: [
      {
        id: 4,
        de: '2026-10-19T03:00:00Z',
        ate: '2026-10-31T12:00:00Z',
        setor: null,
        alcance: 'tudo',
        motivo: 'Expediente alterado',
        por: 'Dono',
        criado_em: '2026-10-31T12:00:00Z',
        iniciado_em: '2026-10-31T12:00:05Z',
        concluido_em: null,
        total: 200,
        feitos: 50,
        erro: null,
      },
    ],
  },
}

function sessaoDe(papel: string, lider = false): EstadoSessao {
  return {
    carregando: false,
    sessao: null,
    perfil: { id: 'eu', nome: 'Pessoa', papel } as unknown as Perfil,
    vinculos: lider
      ? [{ setor_id: 3, lider_do_setor: true } as unknown as EstadoSessao['vinculos'][number]]
      : [],
    ehLider: true,
    recarregarPerfil: async () => {},
    sair: async () => {},
  }
}

function renderizar(sessao: EstadoSessao, rota = '/configuracoes/tempo') {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[rota]}>
        <ContextoSessao.Provider value={sessao}>
          <ProvedorNotificacao>
            <ControleTempo />
          </ProvedorNotificacao>
        </ContextoSessao.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const chamadas = () => rpc.mock.calls.map((c) => c[0] as string)

describe('Configurações → Controle de tempo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockImplementation(async (nome: string) => ({ data: RESPOSTAS[nome] ?? null, error: null }))
  })

  it('o administrador vê as sete abas e só a aba aberta pede dado', async () => {
    renderizar(sessaoDe('admin'))
    const abas = await screen.findAllByRole('tab')
    expect(abas.map((a) => a.textContent)).toEqual([
      'Expediente e intervalos',
      'Calendário',
      'Hora extra',
      'Regras por setor',
      'Equipe no painel',
      'Modelos',
      'Recálculo',
    ])
    expect(
      await screen.findByRole('region', { name: 'Expediente de MONTAGEM' }),
    ).toBeInTheDocument()
    expect(chamadas()).toEqual(['plt_fn_tempo_expediente'])
  })

  it('o líder de setor vê só a Hora extra — sem as outras abas', async () => {
    renderizar(sessaoDe('lider', true))
    expect(await screen.findByText('Pedido grande')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.queryByText('Expediente e intervalos')).toBeNull()
    expect(chamadas()).toEqual(['plt_fn_tempo_horas_extras'])
  })

  it('o líder que pede outra aba pela URL continua na Hora extra', async () => {
    renderizar(sessaoDe('lider', true), '/configuracoes/tempo?aba=regras')
    expect(await screen.findByText('Pedido grande')).toBeInTheDocument()
    expect(chamadas()).not.toContain('plt_fn_tempo_regras')
  })

  it('salvar o expediente manda todas as faixas do setor', async () => {
    renderizar(sessaoDe('admin'))
    fireEvent.click(await screen.findByRole('button', { name: 'Tirar a faixa 1 de sábado' }))
    fireEvent.click(screen.getByRole('button', { name: /Salvar o expediente/ }))
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('plt_fn_tempo_expediente_salvar', {
        p_setor_id: 3,
        p_faixas: SEG_A_SEX,
        p_copiar_para_todos: false,
      }),
    )
  })

  it('as regras mandam só o que mudou', async () => {
    renderizar(sessaoDe('admin'), '/configuracoes/tempo?aba=regras')
    const campo = await screen.findByLabelText('Passagem mínima (min)')
    fireEvent.change(campo, { target: { value: '5' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Montar em lote' }))
    fireEvent.click(screen.getByRole('button', { name: /Salvar as 2 mudanças/ }))
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('plt_fn_tempo_regras_salvar', {
        p_setor_id: 3,
        p_regras: { minimo_min: 5, permite_lote: true },
      }),
    )
  })

  it('um valor fora do limite avisa e não deixa salvar', async () => {
    renderizar(sessaoDe('admin'), '/configuracoes/tempo?aba=regras')
    const campo = await screen.findByLabelText('Faixa "na média" (±%)')
    fireEvent.change(campo, { target: { value: '80' } })
    expect(screen.getByRole('alert')).toHaveTextContent('vai de 1 a 50')
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })

  it('registrar a hora extra do setor inteiro chama a porta certa', async () => {
    renderizar(sessaoDe('lider', true))
    await screen.findByText('Pedido grande')
    fireEvent.click(screen.getByRole('button', { name: 'Registrar hora extra' }))
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Mutirão' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith(
        'plt_fn_tempo_hora_extra_salvar',
        expect.objectContaining({ p_setor_id: 3, p_usuario_id: null, p_motivo: 'Mutirão' }),
      ),
    )
    const [, args] = rpc.mock.calls.find((c) => c[0] === 'plt_fn_tempo_hora_extra_salvar')!
    const horas = (Date.parse(args.p_fim) - Date.parse(args.p_inicio)) / 3_600_000
    expect(horas).toBe(2)
  })

  it('o calendário mostra o feriado com selo e "Fábrica toda"', async () => {
    renderizar(sessaoDe('admin'), '/configuracoes/tempo?aba=calendario')
    expect(await screen.findByText('Natal')).toBeInTheDocument()
    expect(screen.getByText('Feriado')).toBeInTheDocument()
    expect(screen.getByText('Fábrica toda')).toBeInTheDocument()
    const [, args] = rpc.mock.calls.find((c) => c[0] === 'plt_fn_tempo_calendario')!
    expect(args.p_de).toMatch(/^\d{4}-01-01$/)
    expect(args.p_ate).toMatch(/^\d{4}-12-31$/)
  })

  it('o recálculo mostra a situação e o andamento', async () => {
    renderizar(sessaoDe('admin'), '/configuracoes/tempo?aba=recalculo')
    expect(await screen.findByText('Recalculando')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByText('50 de 200 (25%)')).toBeInTheDocument()
  })
})
