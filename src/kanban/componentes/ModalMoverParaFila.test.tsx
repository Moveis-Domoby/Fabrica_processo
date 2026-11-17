import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ModalMoverParaFila } from './ModalMoverParaFila'
import type { Card } from '../tipos'

/**
 * SESSAO-51 (ajuste do dono, 17/11 — D-330): o "Mover para o PCP" mora dentro do
 * botão Mover — "PCP" é a primeira opção da lista, só quando a janela recebe
 * `aoEscolherPcp` (o administrador); escolher chama a janela do PCP.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { buscarSetores, listarMotivos } = vi.hoisted(() => ({
  buscarSetores: vi.fn(),
  listarMotivos: vi.fn(),
}))
vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  buscarSetores,
}))
vi.mock('@/rotas/api', async (original) => ({
  ...(await original<typeof import('@/rotas/api')>()),
  listarMotivos,
}))

const card = {
  id: 995,
  tipo: 'unidade',
  item_descricao: 'Armário multiuso 2 portas com chave – Branco',
  indice_unidade: 1,
  total_unidades: 2,
  setor_atual_id: 6,
} as unknown as Card

function renderizar(aoEscolherPcp?: () => void) {
  buscarSetores.mockResolvedValue([
    { id: 1, nome: 'PCP', codigo: 'pcp', papel_no_fluxo: 'entrada', ativo: true, ordem: 10 },
    { id: 2, nome: 'SECC', codigo: 'secc', papel_no_fluxo: 'producao', ativo: true, ordem: 20 },
    {
      id: 6,
      nome: 'MONTAGEM',
      codigo: 'montagem',
      papel_no_fluxo: 'producao',
      ativo: true,
      ordem: 60,
    },
  ])
  listarMotivos.mockResolvedValue([{ id: 31, texto: 'Retrabalho' }])
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProvedorNotificacao>
        <ModalMoverParaFila
          card={card}
          naFila={false}
          pedidoNumero={13871}
          aoEscolherPcp={aoEscolherPcp}
          aoFechar={() => {}}
        />
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  buscarSetores.mockReset()
  listarMotivos.mockReset()
})

describe('o PCP dentro do botão Mover', () => {
  it('o administrador vê "PCP" como a primeira opção, e escolher abre a janela do PCP', async () => {
    const aoEscolherPcp = vi.fn()
    renderizar(aoEscolherPcp)
    const grupo = (await screen.findByText('Para a fila de')).closest('fieldset') as HTMLElement
    await within(grupo).findByRole('button', { name: /SECC/ })
    const opcoes = within(grupo).getAllByRole('button')
    expect(opcoes[0]).toHaveTextContent(/^PCP/)
    expect(opcoes[0]).toHaveTextContent('Volta como vaga do pedido ou vira reposição de estoque')
    await userEvent.click(opcoes[0])
    expect(aoEscolherPcp).toHaveBeenCalledTimes(1)
  })

  it('sem a permissão (sem aoEscolherPcp), a lista só tem os setores de produção', async () => {
    renderizar(undefined)
    const grupo = (await screen.findByText('Para a fila de')).closest('fieldset') as HTMLElement
    await within(grupo).findByRole('button', { name: /SECC/ })
    expect(within(grupo).queryByText(/^PCP$/)).not.toBeInTheDocument()
    expect(
      within(grupo)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['SECC', expect.stringMatching(/^MONTAGEM/)])
  })
})
