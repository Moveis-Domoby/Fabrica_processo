import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ModalLiberarPedido } from './ModalLiberarPedido'
import type { JanelaLiberacao } from '../api'
import type { Card, Setor } from '../tipos'

/**
 * SESSAO-51 (bloco B · D-333): a vaga cuja peça voltou da produção oferece
 * "Usar a mesma peça (estava em …)" MARCADA, com a coluna onde ela parou já
 * escolhida; liberar manda a mesma peça; desmarcar libera uma peça nova.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { janelaLiberacao, buscarEtapasAtivas, liberarNoPcp } = vi.hoisted(() => ({
  janelaLiberacao: vi.fn(),
  buscarEtapasAtivas: vi.fn(),
  liberarNoPcp: vi.fn(),
}))
vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  janelaLiberacao,
  buscarEtapasAtivas,
  liberarNoPcp,
}))
vi.mock('@/autenticacao/sessao-contexto', () => ({
  useSessao: () => ({ perfil: { id: 'u1', papel: 'operador' } }),
}))

const janela: JanelaLiberacao = {
  itens: [{ seq: 1, codigo: 'GR1', descricao: 'Guarda-roupa Casal', unidades: 2 } as never],
  ja_liberadas: [{ item_seq: 1, indice_unidade: 2 }],
  sugestoes: [],
  em_producao: [],
  mesma_peca: [
    {
      item_seq: 1,
      indice_unidade: 1,
      peca_card_id: 77,
      descricao: 'Guarda-roupa Casal',
      setor_id: 6,
      setor: 'MONTAGEM',
      etapa_id: 62,
      etapa: 'Montando',
      sugestao_vale: true,
      motivo: 'Prioridade mudou',
      observacao: null,
      escolha: 'voltar',
      voltou_em: '2026-11-16T20:00:00Z',
    },
  ],
}
const setores = [
  { id: 6, nome: 'MONTAGEM', codigo: 'montagem', papel_no_fluxo: 'producao', ativo: true, ordem: 60 },
] as unknown as Setor[]
const card = { id: 500, tipo: 'pedido', pedido_id: 9 } as unknown as Card

function renderizar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ProvedorNotificacao>
        <ModalLiberarPedido cardPedido={card} pedido={{ numero: 13871 } as never} setores={setores} aoFechar={() => {}} />
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  janelaLiberacao.mockReset()
  buscarEtapasAtivas.mockReset()
  liberarNoPcp.mockReset()
})

describe('"Liberar unidades" com a peça que voltou da produção', () => {
  it('oferece a mesma peça marcada e manda ela, na coluna onde parou', async () => {
    janelaLiberacao.mockResolvedValue(janela)
    buscarEtapasAtivas.mockResolvedValue([
      { id: 61, setor_id: 6, nome: 'A montar', eh_fila: true, ordem: 1 },
      { id: 62, setor_id: 6, nome: 'Montando', eh_fila: false, ordem: 2 },
    ])
    liberarNoPcp.mockResolvedValue({ alocadas: 0, liberadas: 0, reaproveitadas: 1, ja_liberadas: 0, cards: [77] })
    renderizar()
    const caixa = await screen.findByRole('checkbox', { name: /Usar a mesma peça \(estava em MONTAGEM · Montando\)/ })
    expect(caixa).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: /Liberar 1 unidade/ }))
    await waitFor(() => expect(liberarNoPcp).toHaveBeenCalled())
    expect(liberarNoPcp.mock.calls[0][1]).toEqual([
      { item_seq: 1, indice_unidade: 1, setor_id: 6, etapa_id: 62, peca_volta_id: 77 },
    ])
  })

  it('desmarcada, libera uma peça nova pelo caminho de sempre', async () => {
    janelaLiberacao.mockResolvedValue(janela)
    buscarEtapasAtivas.mockResolvedValue([
      { id: 61, setor_id: 6, nome: 'A montar', eh_fila: true, ordem: 1 },
      { id: 62, setor_id: 6, nome: 'Montando', eh_fila: false, ordem: 2 },
    ])
    liberarNoPcp.mockResolvedValue({ alocadas: 0, liberadas: 1, ja_liberadas: 0, cards: [501] })
    renderizar()
    await userEvent.click(await screen.findByRole('checkbox', { name: /Usar a mesma peça/ }))
    expect(screen.getByText(/nasce uma peça nova e a antiga continua guardada/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Liberar 1 unidade/ }))
    await waitFor(() => expect(liberarNoPcp).toHaveBeenCalled())
    const enviado = liberarNoPcp.mock.calls[0][1][0]
    expect(enviado).not.toHaveProperty('peca_volta_id')
    expect(enviado).toMatchObject({ item_seq: 1, indice_unidade: 1, setor_id: 6 })
  })
})
