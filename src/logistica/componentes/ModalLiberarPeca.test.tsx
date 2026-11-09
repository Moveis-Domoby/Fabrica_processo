import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ModalLiberarPeca } from './ModalLiberarPeca'
import type { PedidoExpedicao } from '@/logistica/api'

/**
 * SESSAO-47 (bloco A · frentes 3 e 4): ao liberar a peça pronta de um pedido
 * que o Tiny já levou adiante, a janela mostra a situação real e pede, no mesmo
 * gesto, o que fazer — voltar para "Em aberto", voltar para "Preparando envio"
 * ou deixar como está. O aviso do fim diz o que aconteceu de verdade.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { liberarPecaParaOutroPedido } = vi.hoisted(() => ({ liberarPecaParaOutroPedido: vi.fn() }))
vi.mock('@/logistica/api', () => ({
  liberarPecaParaOutroPedido,
  conferirDestinoLiberacao: vi.fn(async () => ({ ok: false, motivo: 'não usado no teste' })),
}))
vi.mock('@/kanban/api', () => ({
  unidadesDoPedido: vi.fn(async () => [
    {
      card_id: 501,
      item_descricao: 'Estante Basic 15 nichos',
      indice_unidade: 1,
      total_unidades: 2,
      setor_nome: 'PEDIDOS EM AGUARDO',
      etapa_nome: null,
      desde: '2026-11-04T20:16:00Z',
      setor_terminal: true,
    },
  ]),
}))

const pedido = (extra: Partial<PedidoExpedicao> = {}): PedidoExpedicao => ({
  card_id: 31,
  pedido_id: 31,
  numero: 13818,
  cliente_nome: 'Cliente Teste',
  data_prevista: '2026-11-13',
  situacao: 'Pronto para envio',
  total_unidades: 2,
  a_entregar: 2,
  unidades_liberadas: 2,
  unidades_prontas: 2,
  pronto: true,
  estado: 'pronto',
  primeira_pronta_em: null,
  completo_em: null,
  lancado: false,
  em_devolucao: false,
  alterado_apos_liberacao: false,
  programacao: null,
  tiny_adiantado: true,
  ...extra,
})

function renderizar(p: PedidoExpedicao, tinyLigado = true) {
  const aoFechar = vi.fn()
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProvedorNotificacao>
        <ModalLiberarPeca pedido={p} tinyLigado={tinyLigado} aoFechar={aoFechar} />
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
  return { aoFechar }
}

/** Escolhe a peça, diz que saiu por substituição e escreve o motivo. */
async function preencherSubstituicao() {
  await userEvent.click(await screen.findByRole('button', { name: /Estante Basic 15 nichos/ }))
  const foiParaPedido = screen.getByRole('group', {
    name: 'O produto foi liberado para um pedido?',
  })
  await userEvent.click(within(foiParaPedido).getByRole('button', { name: 'Não' }))
  await userEvent.type(screen.getByLabelText('Motivo da substituição'), 'foi para a vitrine')
}

afterEach(() => liberarPecaParaOutroPedido.mockReset())

describe('Liberar peça — o pedido de origem adiantado no Tiny', () => {
  it('mostra a situação real e as três opções; sem escolher, não confirma', async () => {
    renderizar(pedido())
    await preencherSubstituicao()
    const tiny = screen.getByRole('group', {
      name: 'No Tiny, este pedido está como Pronto para envio',
    })
    expect(within(tiny).getByRole('button', { name: 'Voltar para Em aberto (Tiny)' })).toBeEnabled()
    expect(
      within(tiny).getByRole('button', { name: 'Voltar para Preparando envio (Tiny)' }),
    ).toBeEnabled()
    expect(within(tiny).getByRole('button', { name: 'Deixar como está' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
  })

  it('"Voltar para Preparando envio (Tiny)": a escolha vai no MESMO gesto e o aviso diz que o pedido voltou', async () => {
    liberarPecaParaOutroPedido.mockResolvedValue({
      feito: true,
      numero_origem: 13818,
      numero_destino: null,
      standby: false,
      voltou_ao_pcp: true,
      tiny_situacao: 'Pronto para envio',
      tiny_pedido: 'preparando_envio',
    })
    const { aoFechar } = renderizar(pedido())
    await preencherSubstituicao()
    await userEvent.click(
      screen.getByRole('button', { name: 'Voltar para Preparando envio (Tiny)' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(liberarPecaParaOutroPedido).toHaveBeenCalledTimes(1))
    expect(liberarPecaParaOutroPedido).toHaveBeenCalledWith(
      expect.objectContaining({
        pecaId: 501,
        paraNumero: null,
        motivo: 'foi para a vitrine',
        relancar: true,
        tiny: 'preparando_envio',
      }),
    )
    expect(
      await screen.findByText(
        'O pedido 13818 voltou ao PCP para produzir de novo; no Tiny ele passa para Preparando envio.',
      ),
    ).toBeInTheDocument()
    await waitFor(() => expect(aoFechar).toHaveBeenCalled())
  })

  it('"Deixar como está": o aviso diz a verdade — o pedido NÃO voltou ao PCP e ficou na Expedição', async () => {
    liberarPecaParaOutroPedido.mockResolvedValue({
      feito: true,
      numero_origem: 13818,
      numero_destino: null,
      standby: false,
      voltou_ao_pcp: false,
      tiny_situacao: 'Pronto para envio',
      tiny_pedido: null,
    })
    renderizar(pedido())
    await preencherSubstituicao()
    await userEvent.click(screen.getByRole('button', { name: 'Deixar como está' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() =>
      expect(liberarPecaParaOutroPedido).toHaveBeenCalledWith(
        expect.objectContaining({ tiny: 'deixar' }),
      ),
    )
    expect(
      await screen.findByText(
        /O pedido 13818 NÃO voltou ao PCP: no Tiny ele está como Pronto para envio/,
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/voltou ao PCP para produzir de novo/)).toBeNull()
  })

  it('com a ida ao Tiny desligada só dá para deixar como está, com a explicação', async () => {
    renderizar(pedido(), false)
    await preencherSubstituicao()
    expect(screen.getByRole('button', { name: 'Voltar para Em aberto (Tiny)' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Voltar para Preparando envio (Tiny)' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Deixar como está' })).toBeEnabled()
    expect(screen.getByText(/sem a ida ao Tiny ligada/)).toBeInTheDocument()
  })

  it('o pedido que não está adiantado não ganha a pergunta, e a chamada vai como sempre', async () => {
    liberarPecaParaOutroPedido.mockResolvedValue({
      feito: true,
      numero_origem: 13818,
      numero_destino: null,
      standby: false,
      voltou_ao_pcp: true,
      tiny_situacao: 'Preparando envio',
      tiny_pedido: null,
    })
    renderizar(pedido({ situacao: 'Preparando envio', tiny_adiantado: false }))
    await preencherSubstituicao()
    expect(screen.queryByRole('button', { name: 'Deixar como está' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() =>
      expect(liberarPecaParaOutroPedido).toHaveBeenCalledWith(
        expect.objectContaining({ tiny: null }),
      ),
    )
    expect(
      await screen.findByText('O pedido 13818 voltou ao PCP para produzir de novo.'),
    ).toBeInTheDocument()
  })
})
