import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { Utilitarios } from './Utilitarios'
import { salvarCampo, salvarEtiqueta, salvarMotivoComMarca } from '@/utilitarios/api'

/**
 * Configurações → Utilitários (SESSAO-27 · D-101): etiquetas (nome + cor da
 * paleta das etiquetas) e campos customizados (tipo, opções, onde valem).
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/utilitarios/api', () => ({
  buscarEtiquetas: vi.fn(async () => [{ id: 1, nome: 'Revisar', cor: 'rosa', arquivada_em: null }]),
  buscarCampos: vi.fn(async () => [
    {
      id: 3,
      nome: 'Cor do MDF',
      tipo: 'lista',
      opcoes: ['Branco', 'Preto'],
      em_pecas: true,
      em_pedidos: false,
      arquivado_em: null,
    },
  ]),
  salvarEtiqueta: vi.fn(async () => 2),
  arquivarEtiqueta: vi.fn(async () => undefined),
  excluirEtiqueta: vi.fn(async () => undefined),
  salvarCampo: vi.fn(async () => 4),
  arquivarCampo: vi.fn(async () => undefined),
  excluirCampo: vi.fn(async () => undefined),
  // SESSAO-38 (D-164): a lista de pausa com a marca "especial"
  listarMotivosComMarca: vi.fn(async () => [
    { id: 60, tipo: 'pausa', texto: 'Falta de material', ordem: 10, ativo: true, especial: false },
    { id: 81, tipo: 'pausa', texto: 'Máquina quebrou', ordem: 80, ativo: true, especial: true },
  ]),
  salvarMotivoComMarca: vi.fn(async () => 99),
}))
vi.mock('@/rotas/api', () => ({
  listarMotivos: vi.fn(async () => []),
  salvarMotivo: vi.fn(async () => 1),
}))

function renderizar(rota = '/configuracoes/utilitarios') {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
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
    await waitFor(() =>
      expect(salvarEtiqueta).toHaveBeenCalledWith({ id: null, nome: 'Urgente', cor: 'violeta' }),
    )
  })

  it('o campo do tipo lista mostra as opções e onde vale; o novo campo de texto vale nas peças por padrão', async () => {
    renderizar('/configuracoes/utilitarios?aba=campos')
    expect(await screen.findByText('Cor do MDF')).toBeInTheDocument()
    expect(screen.getByText(/Lista de opções · Nas peças · Branco, Preto/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Novo campo' }))
    const modal = await screen.findByRole('dialog')
    fireEvent.change(within(modal).getByLabelText('Nome'), {
      target: { value: 'Observação da montagem' },
    })
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
        emAvulsos: false,
      }),
    )
  })

  it('SESSAO-38: motivos de pausa mostram a marca especial, e o novo é salvo com a caixinha', async () => {
    renderizar('/configuracoes/utilitarios?aba=pausa')
    expect(await screen.findByText('Máquina quebrou')).toBeInTheDocument()
    expect(screen.getAllByText('Especial · não conta o tempo')).toHaveLength(1)
    expect(screen.getByText(/enquanto a pessoa estiver parada por este motivo/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Novo motivo'), { target: { value: 'Faltou energia' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Especial/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }))
    await waitFor(() =>
      expect(salvarMotivoComMarca).toHaveBeenCalledWith({
        id: null,
        texto: 'Faltou energia',
        especial: true,
        tipo: 'pausa',
      }),
    )
  })

  it('SESSAO-38: editar um motivo especial leva a marca junto; desmarcar salva sem ela', async () => {
    renderizar('/configuracoes/utilitarios?aba=pausa')
    fireEvent.click(await screen.findByRole('button', { name: 'Editar "Máquina quebrou"' }))
    // a caixinha da edição vem antes da do cadastro novo
    const caixa = screen.getAllByRole('checkbox', { name: /Especial/ })[0]!
    expect(caixa).toBeChecked()
    fireEvent.click(caixa)
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(salvarMotivoComMarca).toHaveBeenCalledWith({
        id: 81,
        texto: 'Máquina quebrou',
        ativo: true,
        especial: false,
        tipo: 'pausa',
      }),
    )
  })
})
