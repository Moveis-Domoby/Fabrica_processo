import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Estoque } from './Estoque'

/**
 * SESSAO-48 (frente 3): o aviso do sino "Pedido cancelado com móveis em
 * produção" leva a `/fabrica/logistica/estoque?destino=<card do pedido>` — a
 * página do Estoque abre a janela "Para onde vai este móvel?" (pedaço próprio,
 * só baixado quando o endereço pede) em qualquer aba; fechar tira só o
 * `?destino=` do endereço.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/logistica/acesso', () => ({
  useAcessoLogistica: () => ({
    perfil: { id: 'p1', papel: 'admin' },
    souAdmin: true,
    tenhoAcesso: true,
    semAcesso: false,
    setores: [],
  }),
}))
vi.mock('@/logistica/api', () => ({ configEstoque: vi.fn(async () => ({ top_x: 20 })) }))
vi.mock('@/logistica/componentes/PainelTop20', () => ({ PainelTop20: () => <p>o Top X</p> }))
vi.mock('@/logistica/componentes/PainelInsumos', () => ({ PainelInsumos: () => <p>os insumos</p> }))
vi.mock('@/logistica/componentes/PainelConfiguracoes', () => ({
  PainelConfiguracoes: () => <p>as configurações</p>,
}))
vi.mock('@/logistica/componentes/ModalDestinoPedidoCancelado', () => ({
  ModalDestinoPedidoCancelado: ({ cardId, aoFechar }: { cardId: number; aoFechar: () => void }) => (
    <div role="dialog" aria-label="Para onde vai este móvel?">
      <p>janela do card {cardId}</p>
      <button type="button" onClick={aoFechar}>
        Fechar a janela
      </button>
    </div>
  ),
}))

function Endereco() {
  return <output aria-label="endereço">{useLocation().search}</output>
}

function abrir(caminho: string) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[caminho]}>
        <Routes>
          <Route
            path="/fabrica/logistica/estoque"
            element={
              <>
                <Estoque />
                <Endereco />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Estoque — a janela do destino pelo endereço', () => {
  it('?destino= abre a janela com o card do pedido, mesmo noutra aba; fechar tira só o destino', async () => {
    abrir('/fabrica/logistica/estoque?aba=insumos&destino=31')
    expect(await screen.findByText('janela do card 31')).toBeInTheDocument()
    expect(screen.getByText('os insumos')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fechar a janela' }))
    expect(screen.queryByRole('dialog', { name: 'Para onde vai este móvel?' })).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'endereço' })).toHaveTextContent('?aba=insumos')
  })

  it('sem ?destino=, a janela nem é baixada', () => {
    abrir('/fabrica/logistica/estoque')
    expect(screen.getByText('o Top X')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Para onde vai este móvel?' })).not.toBeInTheDocument()
  })
})
