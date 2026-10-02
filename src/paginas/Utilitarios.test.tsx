import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { Utilitarios } from './Utilitarios'
import { salvarCampo, salvarEtiqueta } from '@/utilitarios/api'

/**
 * Configurações → Utilitários (SESSAO-27 · D-101): etiquetas (nome + cor da
 * paleta das etiquetas) e campos customizados (tipo, opções, onde valem).
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/utilitarios/api', () => ({
  buscarEtiquetas: vi.fn(async () => [{ id: 1, nome: 'Revisar', cor: 'rosa', arquivada_em: null }]),
  buscarCampos: vi.fn(async () => [
    { id: 3, nome: 'Cor do MDF', tipo: 'lista', opcoes: ['Branco', 'Preto'], em_pecas: true, em_pedidos: false, arquivado_em: null },
  ]),
  salvarEtiqueta: vi.fn(async () => 2),
  arquivarEtiqueta: vi.fn(async () => undefined),
  excluirEtiqueta: vi.fn(async () => undefined),
  salvarCampo: vi.fn(async () => 4),
  arquivarCampo: vi.fn(async () => undefined),
  excluirCampo: vi.fn(async () => undefined),
}))

function renderizar(rota = '/configuracoes/utilitarios') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[rota]}>
        <ProvedorNotificacao>
          <Utilitarios />
        </ProvedorNotificacao>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Configurações → Utilitários', () => {
  beforeEach(() => vi.clearAllMocks())

  it('a etiqueta aparece com ícone, nome e cor; a nova é salva com a cor escolhida', async () => {
    renderizar()
    expect(await screen.findByText('Revisar')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nova etiqueta' }))
    const modal = await screen.findByRole('dialog')
    fireEvent.change(within(modal).getByLabelText('Nome'), { target: { value: 'Urgente' } })
    fireEvent.click(within(modal).getByRole('radio', { name: /Violeta/ }))
    fireEvent.click(within(modal).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(salvarEtiqueta).toHaveBeenCalledWith({ id: null, nome: 'Urgente', cor: 'violeta' }))
  })

  it('o campo do tipo lista mostra as opções e onde vale; o novo campo de texto vale nas peças por padrão', async () => {
    renderizar('/configuracoes/utilitarios?aba=campos')
    expect(await screen.findByText('Cor do MDF')).toBeInTheDocument()
    expect(screen.getByText(/Lista de opções · Nas peças · Branco, Preto/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Novo campo' }))
    const modal = await screen.findByRole('dialog')
    fireEvent.change(within(modal).getByLabelText('Nome'), { target: { value: 'Observação da montagem' } })
    fireEvent.click(within(modal).getByRole('checkbox', { name: /Nos pedidos/ }))
    fireEvent.click(within(modal).getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(salvarCampo).toHaveBeenCalledWith({
        id: null,
        nome: 'Observação da montagem',
        tipo: 'texto',
        opcoes: [],
        emPecas: true,
        emPedidos: true,
      }),
    )
  })
})
