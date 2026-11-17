import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { AbaEntregasParciais } from './AbaEntregasParciais'
import type { EstadoParcial } from '@/kanban/entregaParcial'

/**
 * SESSAO-51 (frente 3): a aba "Entregas parciais" — só pedido com decisão que
 * ainda dá para revogar, com UM botão (o contrário da decisão que vale); a
 * janela do revogar lê ao abrir e manda a chave do toque.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { listarEntregasParciais, previaEntregaParcial, revogarEntregaParcial } = vi.hoisted(() => ({
  listarEntregasParciais: vi.fn(),
  previaEntregaParcial: vi.fn(),
  revogarEntregaParcial: vi.fn(),
}))
vi.mock('@/kanban/entregaParcial', async (original) => ({
  ...(await original<typeof import('@/kanban/entregaParcial')>()),
  listarEntregasParciais,
  previaEntregaParcial,
  revogarEntregaParcial,
}))

const estado = (extra: Partial<EstadoParcial> = {}): EstadoParcial => ({
  card_id: 70,
  pedido_id: 7,
  numero: 13900,
  cliente: 'Cliente Teste',
  parcial_em: '2026-11-16T15:00:00Z',
  parcial_por: 'Entregador',
  entregues: 2,
  total: 5,
  decisao: 'manter',
  decisao_em: '2026-11-16T15:00:00Z',
  decisao_por: 'Entregador',
  n_producao: 2,
  n_prontas: 0,
  n_retiradas: 0,
  vagas: 1,
  fechado: false,
  acao: 'remover',
  pode_revogar: true,
  porque_nao: null,
  ...extra,
})

function renderizar() {
  render(
    <MemoryRouter initialEntries={['/fabrica/producao/pcp?aba=parciais']}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ProvedorNotificacao>
          <AbaEntregasParciais />
        </ProvedorNotificacao>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  listarEntregasParciais.mockReset()
  previaEntregaParcial.mockReset()
  revogarEntregaParcial.mockReset()
})

describe('A aba "Entregas parciais"', () => {
  it('mostra a decisão que vale e só o botão contrário', async () => {
    listarEntregasParciais.mockResolvedValue({
      itens: [estado(), estado({ card_id: 71, numero: 13901, decisao: 'limpar', acao: 'voltar', n_producao: 0, n_retiradas: 2 })],
      proxima: null,
    })
    renderizar()
    const a = (await screen.findByText('Pedido 13900')).closest('li')!
    expect(within(a).getByText('Entregue em parte (2 de 5)')).toBeInTheDocument()
    expect(within(a).getByText('Seguem em produção: 2 peças · 1 produto no PCP')).toBeInTheDocument()
    expect(within(a).getByRole('button', { name: 'Revogar e remover da linha de produção' })).toBeInTheDocument()
    expect(within(a).queryByRole('button', { name: /voltar tudo/ })).not.toBeInTheDocument()
    const b = screen.getByText('Pedido 13901').closest('li')!
    expect(within(b).getByText('Retiradas da produção: 2 peças · 1 produto do PCP')).toBeInTheDocument()
    expect(within(b).getByRole('button', { name: 'Revogar e voltar tudo para a produção' })).toBeInTheDocument()
  })

  it('a janela do revogar lê ao abrir (onde cada peça está) e o toque leva a chave', async () => {
    listarEntregasParciais.mockResolvedValue({ itens: [estado()], proxima: null })
    previaEntregaParcial.mockResolvedValue(
      estado({
        na_producao: [
          { id: 3, descricao: 'Guarda-roupa 3/4', indice: 3, total: 5, setor: 'MONTAGEM', etapa: 'Montando', trabalhando: true },
          { id: 4, descricao: 'Guarda-roupa 3/4', indice: 4, total: 5, setor: 'FITAMENTO', etapa: 'Fila' },
        ],
        prontas: [],
      }),
    )
    revogarEntregaParcial.mockResolvedValue({ feito: true, decisao: 'limpar', retiradas: 2, vagas: 1, ficaram: 0 })
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Revogar e remover da linha de produção' }))
    const janela = await screen.findByRole('dialog')
    expect(await within(janela).findByText(/Tirar da produção as 2 peças \(MONTAGEM · Montando, FITAMENTO · Fila\)/)).toBeInTheDocument()
    expect(within(janela).getByText(/alguém trabalha nela/)).toBeInTheDocument()
    await userEvent.click(within(janela).getByRole('button', { name: 'Revogar e remover da linha de produção' }))
    await waitFor(() => expect(revogarEntregaParcial).toHaveBeenCalled())
    expect(revogarEntregaParcial.mock.calls[0][0]).toBe(70)
    expect(String(revogarEntregaParcial.mock.calls[0][1])).toMatch(/^revogar-70-/)
  })

  it('"voltar tudo": cada peça diz para onde volta e avisa a etapa que não existe mais', async () => {
    listarEntregasParciais.mockResolvedValue({ itens: [estado({ decisao: 'limpar', acao: 'voltar', n_producao: 0, n_retiradas: 1 })], proxima: null })
    previaEntregaParcial.mockResolvedValue(
      estado({
        decisao: 'limpar',
        acao: 'voltar',
        retiradas: [
          { id: 3, descricao: 'Guarda-roupa 3/4', indice: 3, total: 5, setor: 'MONTAGEM', etapa: 'Montando', destino_setor: 'MONTAGEM', destino_etapa: 'A montar', mudou_etapa: true, vira_vaga: false },
        ],
      }),
    )
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Revogar e voltar tudo para a produção' }))
    const janela = await screen.findByRole('dialog')
    expect(await within(janela).findByText(/volta para MONTAGEM · A montar/)).toBeInTheDocument()
    expect(within(janela).getByText(/A etapa Montando não existe mais/)).toBeInTheDocument()
  })
})
