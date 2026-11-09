import type { ComponentType } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import type { FiltrosTempos } from '@/dashboards/tempos/api'
import { supabase } from '@/lib/supabase'
import type { PropsAba } from '../TemposProducao'
import { AbaDia } from './AbaDia'
import { AbaMontadores } from './AbaMontadores'
import { AbaMoveis } from './AbaMoveis'
import { AbaPeriodo } from './AbaPeriodo'
import {
  comPainel,
  EXEMPLO_DIA,
  EXEMPLO_DIA_COM_MARCA,
  EXEMPLO_DIA_COM_OUTROS,
  EXEMPLO_MONTADORES,
  EXEMPLO_MONTADORES_COM_OUTROS,
  EXEMPLO_MOVEIS,
  EXEMPLO_MOVEIS_COM_OUTROS,
  EXEMPLO_PERIODO,
  EXEMPLO_PERIODO_COM_OUTROS,
} from './exemplos'

/**
 * SESSAO-47 (Bloco C) — cada aba de Tempos de produção desenha a configuração
 * do painel que veio na própria resposta: o tipo do gráfico, o número do tempo
 * médio (com o rótulo dizendo qual), a marca do padrão e quem aparece como
 * "Outros". E abre igual a sempre quando a resposta vem SEM a configuração (o
 * banco de antes).
 */
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    // a foto de quem tem (o endereço público do armário das fotos)
    storage: {
      from: () => ({
        getPublicUrl: (caminho: string) => ({
          data: { publicUrl: `https://fotos.teste/${caminho}` },
        }),
      }),
    },
  },
}))
// o gráfico de verdade tem teste próprio; aqui interessa o TIPO que a aba pede
vi.mock('@/dashboards/tempos/GraficoMoveis', () => ({
  GraficoMoveis: ({ tipo, series }: { tipo: string; series: unknown[] }) => (
    <div data-testid="grafico" data-tipo={tipo} data-series={series.length} />
  ),
}))

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>
const FILTROS: FiltrosTempos = {
  setorId: 6,
  de: '2026-11-03',
  ate: '2026-11-09',
  pessoaId: null,
  modeloId: null,
  trello: true,
}

function desenhar(Aba: ComponentType<PropsAba>, resposta: unknown) {
  rpc.mockImplementation(async () => ({ data: resposta, error: null }))
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={cliente}>
        <ProvedorNotificacao>
          <Aba filtros={FILTROS} aoContador={() => {}} />
        </ProvedorNotificacao>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => rpc.mockReset())

describe('aba Período', () => {
  it('sem a configuração na resposta (o banco de antes): o desenho de sempre', async () => {
    desenhar(AbaPeriodo, comPainel(EXEMPLO_PERIODO, undefined))
    expect(await screen.findByText('mediana · a média é 39 min')).toBeInTheDocument()
    expect(screen.getByTestId('grafico')).toHaveAttribute('data-tipo', 'empilhadas')
    expect(screen.getByRole('columnheader', { name: 'Mediana' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Média' })).not.toBeInTheDocument()
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('o tipo do gráfico vem da configuração do painel', async () => {
    desenhar(AbaPeriodo, comPainel(EXEMPLO_PERIODO, { grafico_periodo: 'linhas' }))
    expect(await screen.findByTestId('grafico')).toHaveAttribute('data-tipo', 'linhas')
  })

  it('nas barras só com o total, a legenda fica sem a cor de cada montador', async () => {
    const { container } = desenhar(
      AbaPeriodo,
      comPainel(EXEMPLO_PERIODO, { grafico_periodo: 'barras' }),
    )
    expect(await screen.findByTestId('grafico')).toHaveAttribute('data-tipo', 'barras')
    expect(screen.getByText('Ana (4)')).toBeInTheDocument()
    expect(container.querySelector('[data-grafico="barras"]')).not.toBeNull()
  })

  it('com a média escolhida, o número grande e a coluna dizem "média"', async () => {
    desenhar(AbaPeriodo, comPainel(EXEMPLO_PERIODO, { medida: 'media' }))
    // 2350 s = 39 min (a média); a mediana (35 min) vai de subtítulo
    expect(await screen.findByText('média · a mediana é 35 min')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Média' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Mediana' })).not.toBeInTheDocument()
    // a linha da Ana: média 2500 s = 42 min (a mediana seria 45 min)
    const linha = screen.getAllByRole('row').find((r) => within(r).queryByText('Ana'))
    expect(within(linha as HTMLElement).getByText('42 min')).toBeInTheDocument()
  })

  it('quem está desligado do painel aparece como "Outros" — sozinho e na dupla', async () => {
    desenhar(AbaPeriodo, EXEMPLO_PERIODO_COM_OUTROS)
    expect(await screen.findByText('Ana + Outros (2)')).toBeInTheDocument()
    expect(screen.getAllByText('Outros').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Bia/)).not.toBeInTheDocument()
  })
})

describe('aba Dia', () => {
  it('sem a configuração na resposta: mediana, e nenhuma marca do padrão', async () => {
    const { container } = desenhar(AbaDia, comPainel(EXEMPLO_DIA, undefined))
    expect(await screen.findByText('mediana · a média é 38 min')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-marca-padrao]')).toHaveLength(0)
    expect(screen.queryByText('onde terminaria no tempo padrão')).not.toBeInTheDocument()
  })

  it('com a média escolhida, o rótulo do tempo médio muda', async () => {
    desenhar(AbaDia, comPainel(EXEMPLO_DIA, { medida: 'media' }))
    expect(await screen.findByText('média · a mediana é 40 min')).toBeInTheDocument()
  })

  it('a marca do tempo padrão liga: um traço por móvel, com a hora em que terminaria', async () => {
    const { container } = desenhar(AbaDia, EXEMPLO_DIA_COM_MARCA)
    expect(await screen.findByText('onde terminaria no tempo padrão')).toBeInTheDocument()
    const marcas = [...container.querySelectorAll('[data-marca-padrao]')]
    expect(marcas).toHaveLength(3)
    // a Mesa da Ana: 30 min (das 08:00 às 08:30) contra o padrão de 40 → terminaria às 08:40
    expect(
      marcas.some((m) =>
        m
          .getAttribute('title')
          ?.includes('Mesa Lille · no tempo padrão (40 min) terminaria às 08:40'),
      ),
    ).toBe(true)
  })

  it('quem está desligado do painel vai para a faixa "Outros" (a última) e para a tabela', async () => {
    desenhar(AbaDia, EXEMPLO_DIA_COM_OUTROS)
    expect(await screen.findByText('A linha do dia')).toBeInTheDocument()
    expect(screen.getAllByText('Outros').length).toBeGreaterThanOrEqual(3)
    expect(screen.queryByText(/Bia/)).not.toBeInTheDocument()
  })
})

describe('aba Móveis', () => {
  it('sem a configuração na resposta: a coluna Mediana, como sempre', async () => {
    desenhar(AbaMoveis, comPainel(EXEMPLO_MOVEIS, undefined))
    expect(await screen.findByRole('columnheader', { name: 'Mediana' })).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_ordem: 'qtd' })
  })

  it('com a média escolhida, a coluna vira Média — do móvel e de cada montador', async () => {
    desenhar(AbaMoveis, comPainel(EXEMPLO_MOVEIS, { medida: 'media' }))
    expect(await screen.findByRole('columnheader', { name: 'Média' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Mediana' })).not.toBeInTheDocument()
    const linha = screen.getAllByRole('row').find((r) => within(r).queryByText('Mesa Lille'))
    // a Mesa: média 2350 s = 39 min; a Ana nela: média 2500 s = 42 min
    expect(within(linha as HTMLElement).getByText('39 min')).toBeInTheDocument()
    expect(within(linha as HTMLElement).getByText('42 min')).toBeInTheDocument()
  })

  it('quem está desligado do painel entra na coluna "Outros", a última', async () => {
    desenhar(AbaMoveis, EXEMPLO_MOVEIS_COM_OUTROS)
    await screen.findByRole('columnheader', { name: 'Mediana' })
    const titulos = screen.getAllByRole('columnheader').map((c) => c.textContent)
    expect(titulos.slice(-3)).toEqual(['Ana', 'Caio', 'Outros'])
    expect(titulos).not.toContain('Bia')
  })
})

describe('aba Montadores', () => {
  it('sem a configuração na resposta: "mediana por móvel"', async () => {
    desenhar(AbaMontadores, comPainel(EXEMPLO_MONTADORES, undefined))
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getAllByText('mediana por móvel')).toHaveLength(3)
  })

  it('com a média escolhida, cada cartão diz "média por móvel" com o número dela', async () => {
    desenhar(AbaMontadores, comPainel(EXEMPLO_MONTADORES, { medida: 'media' }))
    expect(await screen.findAllByText('média por móvel')).toHaveLength(3)
    // a Ana: média 2775 s = 46 min (a mediana seria 48 min)
    const cartao = screen.getByText('Ana Souza').closest('article') as HTMLElement
    expect(within(cartao).getByText('46 min')).toBeInTheDocument()
  })

  it('quem está desligado do painel não tem cartão: os números vão para o cartão "Outros", o último', async () => {
    desenhar(AbaMontadores, EXEMPLO_MONTADORES_COM_OUTROS)
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
    expect(screen.queryByText('Bia Lima')).not.toBeInTheDocument()
    const cartoes = screen.getAllByRole('article')
    expect(cartoes).toHaveLength(3)
    expect(within(cartoes[2]).getByRole('heading', { name: 'Outros' })).toBeInTheDocument()
    expect(
      within(cartoes[2]).getByText('Quem não aparece com o próprio nome no painel.'),
    ).toBeInTheDocument()
  })
})
