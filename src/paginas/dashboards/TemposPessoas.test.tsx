import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TemposPessoas } from './TemposPessoas'
import { tempoPessoaDetalhe } from '@/dashboards/api'

/**
 * SESSAO-36 (D-146 resposta 12): a dashboard de tempos por pessoa — um
 * scorecard por pessoa (produção · ausente · fora de setor) e o detalhe só no
 * clique (Lei §3). Quem vê o quê é gate da porta; a tela só desenha.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/aoVivo', () => ({ useAoVivo: () => ({ conectado: true }) }))
vi.mock('@/autenticacao/sessao-contexto', () => ({
  useSessao: () => ({
    carregando: false,
    perfil: { id: 'u-lider', nome: 'Lia Líder', papel: 'lider' },
  }),
}))
vi.mock('@/dashboards/api', async (original) => {
  const real = await original<typeof import('@/dashboards/api')>()
  return {
    ...real,
    temposPessoas: vi.fn(async () => [
      {
        usuario_id: 'u-1',
        nome: 'Ana Operadora',
        foto_caminho: null,
        papel: 'operador',
        estado: 'trabalhando',
        estado_desde: '2026-10-18T12:00:00Z',
        estado_setor_id: 2,
        producao_s: 3600,
        ausente_s: 600,
        deriva_s: 0,
        por_setor: [{ setor_id: 2, nome: 'SECC', segundos: 3600 }],
        contagem_total: 2,
      },
      {
        usuario_id: 'u-2',
        nome: 'Beto Operador',
        foto_caminho: null,
        papel: 'operador',
        estado: 'deriva',
        estado_desde: '2026-10-18T13:00:00Z',
        estado_setor_id: null,
        producao_s: 0,
        ausente_s: 0,
        deriva_s: 1800,
        por_setor: [],
        contagem_total: 2,
      },
    ]),
    tempoPessoaDetalhe: vi.fn(async () => ({
      usuario: { id: 'u-1', nome: 'Ana Operadora', foto_caminho: null, papel: 'operador' },
      estado: { estado: 'trabalhando', desde: '2026-10-18T12:00:00Z', setor_id: 2 },
      dias: [{ dia: '2026-10-18', producao_s: 3600, ausente_s: 600, deriva_s: 0 }],
      aberto: [],
      por_setor: [{ setor_id: 2, nome: 'SECC', segundos: 3600 }],
      execucoes: [
        {
          card_id: 77,
          setor_id: 2,
          etapa_id: null,
          iniciou_em: '2026-10-18T12:00:00Z',
          finalizou_em: null,
          em_andamento: true,
          segundos: 3600,
          rotulo: 'Mesa Lille (1/2)',
        },
      ],
      auxilios: [],
    })),
  }
})

function desenhar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <TemposPessoas />
    </QueryClientProvider>,
  )
}

describe('Dashboards → Tempos por pessoa (SESSAO-36)', () => {
  it('desenha um scorecard por pessoa, com o estado e os três tempos', async () => {
    desenhar()
    expect(await screen.findByText('Ana Operadora')).toBeInTheDocument()
    expect(screen.getByText('Beto Operador')).toBeInTheDocument()
    // estado com texto, nunca só cor (M-12)
    expect(screen.getByText('Trabalhando')).toBeInTheDocument()
    expect(screen.getAllByText('Fora de setor').length).toBeGreaterThan(0)
    // a produção por setor aparece resumida no cartão
    expect(screen.getByText(/SECC: 1h/)).toBeInTheDocument()
  })

  it('o detalhe da pessoa só é pedido no clique (Lei §3)', async () => {
    desenhar()
    const cartao = await screen.findByText('Ana Operadora')
    expect(tempoPessoaDetalhe).not.toHaveBeenCalled()
    fireEvent.click(cartao)
    await waitFor(() => expect(tempoPessoaDetalhe).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/Mesa Lille/)).toBeInTheDocument()
    expect(screen.getByText(/Dia a dia/)).toBeInTheDocument()
  })
})
