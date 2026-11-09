import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { AbaCalendario } from './AbaCalendario'
import * as api from './api'
import type { CalendarioRotas, ItemCalendario } from './api'

/**
 * SESSAO-47 (o dia real da entrega) no calendário das rotas: o entregue mora no
 * dia em que a entrega aconteceu de fato. Quando esse dia não é o programado, a
 * barra leva a nota curta "prog. dd/mm" (sem encolher — a data é o que importa),
 * a frase inteira "programado para dd/mm" fica no texto completo da barra e no
 * detalhe do toque, e "Ver a rota" leva à rota do dia PROGRAMADO.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/aoVivo', () => ({ useAoVivo: () => {} }))
vi.mock('@/kanban/janela/abrirCard', () => ({ useAbrirCard: () => () => {} }))
vi.mock('@/pedidos/FichaDoPedido', () => ({ FichaDoPedido: () => null }))
vi.mock('./api', async (original) => {
  const real = await original<typeof import('./api')>()
  return { ...real, calendarioRotas: vi.fn() }
})

const item = (extra: Partial<ItemCalendario>): ItemCalendario => ({
  situacao: 'entregue',
  card_id: 1,
  pedido_id: 1,
  numero: 13841,
  bairro: 'Lagoa Nova',
  previsao: '2026-11-10',
  detalhe: null,
  caminhao_id: 3,
  caminhao_nome: 'Baú 1',
  rota: 1,
  ordem: 1,
  motivo: null,
  programado_para: null,
  ...extra,
})

const contagem = (entregue: number, naRota = 0) => ({
  sem_rota: 0,
  na_rota: naRota,
  entregue,
  nao_entregue: 0,
  standby: 0,
})

const semana: CalendarioRotas = {
  de: '2026-11-08',
  ate: '2026-11-14',
  hoje: '2026-11-10',
  por_dia: 30,
  dias: [
    {
      // entregue ONTEM (09/11), programado para hoje (10/11)
      dia: '2026-11-09',
      total: 1,
      contagem: contagem(1),
      itens: [item({ programado_para: '2026-11-10' })],
    },
    {
      dia: '2026-11-10',
      total: 2,
      contagem: contagem(1, 1),
      itens: [
        // entregue no próprio dia programado: sem nota
        item({ card_id: 2, pedido_id: 2, numero: 13850, programado_para: '2026-11-10' }),
        item({ card_id: 3, pedido_id: 3, numero: 13860, situacao: 'na_rota', ordem: 2 }),
      ],
    },
  ],
  fora: { atrasados_sem_rota: 0, sem_previsao: 0 },
}

function desenhar() {
  vi.mocked(api.calendarioRotas).mockResolvedValue(semana)
  const aoFocar = vi.fn()
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={['/rotas/programacao?aba=calendario&ref=2026-11-10']}>
        <AbaCalendario ativa aoFocar={aoFocar} aoProgramar={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { aoFocar }
}

describe('Calendário das rotas — o entregue no dia real da entrega', () => {
  it('a barra do entregue fora do dia programado leva a nota curta "prog. dd/mm"; a frase inteira fica no texto completo', async () => {
    desenhar()
    const barra = await screen.findByRole('button', { name: /Pedido 13841/ })
    expect(barra).toHaveTextContent('13841')
    expect(barra).toHaveTextContent('prog. 10/11')
    expect(barra).toHaveAccessibleName(/programado para 10\/11/)
    expect(barra).toHaveAttribute('title', expect.stringContaining('programado para 10/11'))
    // a coluna do dia real (segunda, 9 de novembro) é onde a barra está
    const coluna = screen.getByRole('region', { name: /segunda-feira, 9 nov/ })
    expect(within(coluna).getByRole('button', { name: /Pedido 13841/ })).toBe(barra)
  })

  it('o entregue no próprio dia programado e o que ainda está na rota não levam nota', async () => {
    desenhar()
    const noDia = await screen.findByRole('button', { name: /Pedido 13850/ })
    expect(noDia).not.toHaveTextContent('prog.')
    expect(noDia).not.toHaveAccessibleName(/programado para/)
    expect(screen.getByRole('button', { name: /Pedido 13860/ })).not.toHaveTextContent('prog.')
  })

  it('o detalhe diz "Entregue no dia" com a nota do programado, e "Ver a rota" abre a rota do dia PROGRAMADO', async () => {
    const { aoFocar } = desenhar()
    await userEvent.click(await screen.findByRole('button', { name: /Pedido 13841/ }))
    const janela = await screen.findByRole('dialog')
    expect(within(janela).getByText('Entregue no dia')).toBeInTheDocument()
    expect(within(janela).getByText('programado para 10/11')).toBeInTheDocument()
    await userEvent.click(within(janela).getByRole('button', { name: 'Ver a rota' }))
    expect(aoFocar).toHaveBeenCalledWith('2026-11-10', 3, 1)
  })
})
