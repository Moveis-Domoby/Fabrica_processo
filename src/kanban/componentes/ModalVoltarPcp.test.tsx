import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ModalVoltarPcp } from './ModalVoltarPcp'
import { mostraVoltarPcp, textoSeloVolta } from '../voltaPcp'
import type { PreviaVoltaPcp } from '../voltaPcp'

/**
 * SESSAO-51 (bloco B · frentes 4 e 5): "Mover para o PCP" — a janela lê ao abrir
 * (a peça, onde está, quem trabalha nela, as duas escolhas com o porquê) e o
 * toque leva a chave; "Voltar" pede motivo ou observação.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { previaVoltarPcp, voltarParaPcp } = vi.hoisted(() => ({
  previaVoltarPcp: vi.fn(),
  voltarParaPcp: vi.fn(),
}))
vi.mock('../voltaPcp', async (original) => ({
  ...(await original<typeof import('../voltaPcp')>()),
  previaVoltarPcp,
  voltarParaPcp,
}))

const previa = (extra: Partial<PreviaVoltaPcp> = {}): PreviaVoltaPcp => ({
  card_id: 40,
  descricao: 'Guarda-roupa Casal',
  indice: 3,
  total: 4,
  pedido_id: 9,
  numero: 13871,
  setor: 'MONTAGEM',
  etapa: 'Montando',
  executor: 'Franklin',
  pausado: false,
  pode: true,
  porque_nao: null,
  voltar: { pode: true, porque_nao: null },
  reposicao: { pode: true, porque_nao: null },
  motivos: [
    { id: 1, texto: 'Liberada por engano' },
    { id: 2, texto: 'Prioridade mudou' },
  ],
  ...extra,
})

function renderizar() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProvedorNotificacao>
        <ModalVoltarPcp cardId={40} aoFechar={() => {}} />
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  previaVoltarPcp.mockReset()
  voltarParaPcp.mockReset()
})

describe('A janela "Mover para o PCP"', () => {
  it('diz a peça, o pedido, onde está e quem trabalha nela (o tempo dele fecha)', async () => {
    previaVoltarPcp.mockResolvedValue(previa())
    renderizar()
    const janela = await screen.findByRole('dialog')
    const linha = (await within(janela).findByText(/Guarda-roupa Casal 3\/4/)).closest('p')
    expect(linha).toHaveTextContent('Guarda-roupa Casal 3/4 (pedido 13871) · MONTAGEM · Montando.')
    expect(
      within(janela).getByText('Franklin está trabalhando nela — o tempo dele fecha agora.'),
    ).toBeInTheDocument()
  })

  it('"Voltar para o PCP" pede motivo ou observação e manda a chave do toque', async () => {
    previaVoltarPcp.mockResolvedValue(previa())
    voltarParaPcp.mockResolvedValue({ feito: true, escolha: 'voltar', numero: 13871 })
    renderizar()
    await userEvent.click(await screen.findByText('Voltar para o PCP'))
    const botao = screen.getByRole('button', { name: /Mover para o PCP/ })
    expect(botao).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Prioridade mudou' }))
    expect(botao).toBeEnabled()
    await userEvent.click(botao)
    await waitFor(() => expect(voltarParaPcp).toHaveBeenCalled())
    expect(voltarParaPcp.mock.calls[0][0]).toMatchObject({
      cardId: 40,
      escolha: 'voltar',
      motivoId: 2,
    })
    expect(String(voltarParaPcp.mock.calls[0][0].chave)).toMatch(/^volta-pcp-40-/)
  })

  it('pedido fora do PCP: só "Virar reposição de estoque", com o porquê da outra', async () => {
    previaVoltarPcp.mockResolvedValue(
      previa({
        voltar: {
          pode: false,
          porque_nao:
            'O pedido 13871 foi ocultado do PCP — a peça só pode virar reposição de estoque.',
        },
      }),
    )
    voltarParaPcp.mockResolvedValue({ feito: true, escolha: 'reposicao', numero: 13871 })
    renderizar()
    expect(await screen.findByText(/foi ocultado do PCP/)).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios[0]).toBeDisabled()
    expect(radios[1]).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: /Virar reposição de estoque/ }))
    await waitFor(() => expect(voltarParaPcp).toHaveBeenCalled())
    expect(voltarParaPcp.mock.calls[0][0]).toMatchObject({ escolha: 'reposicao', motivoId: null })
  })
})

describe('Quem vê o botão e o selo do PCP', () => {
  const base = {
    tipo: 'unidade',
    vivo: true,
    papelDoSetor: 'producao',
    tablet: false,
    souAdmin: true,
    cancelada: false,
    ajuste: false,
    destinoPendente: false,
  }
  it('só o admin, fora do tablet, em peça viva de setor de produção', () => {
    expect(mostraVoltarPcp(base)).toBe(true)
    expect(mostraVoltarPcp({ ...base, souAdmin: false })).toBe(false)
    expect(mostraVoltarPcp({ ...base, tablet: true })).toBe(false)
    expect(mostraVoltarPcp({ ...base, papelDoSetor: 'terminal' })).toBe(false)
    expect(mostraVoltarPcp({ ...base, tipo: 'avulso' })).toBe(false)
    expect(mostraVoltarPcp({ ...base, ajuste: true })).toBe(false)
    expect(mostraVoltarPcp({ ...base, cancelada: true })).toBe(false)
  })
  it('o selo diz quantas voltaram, o motivo e onde estavam', () => {
    expect(
      textoSeloVolta({
        voltar: 1,
        reposicao: 0,
        ultimo: {
          escolha: 'voltar',
          motivo: 'Prioridade mudou',
          setor: 'MONTAGEM',
          etapa: 'Montando',
        },
      }),
    ).toBe('1 voltou da produção: Prioridade mudou — estava em MONTAGEM · Montando')
    expect(
      textoSeloVolta({
        voltar: 0,
        reposicao: 1,
        ultimo: { escolha: 'reposicao', setor: 'MONTAGEM' },
      }),
    ).toBe('1 virou reposição de estoque — estava em MONTAGEM')
  })
})
