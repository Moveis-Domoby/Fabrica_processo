import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ClassificacaoProdutos } from './ClassificacaoProdutos'
import {
  buscarEstruturaDoProduto,
  listarClassificacao,
  listarUnidadesForaDoPadrao,
} from '@/logistica/classificacao'

/**
 * Configurações → Móveis, insumos e peças (SESSAO-32 · D-138; SESSAO-33 ·
 * D-142): a estrutura de cada produto e as unidades fora do padrão só são
 * pedidas ao servidor no clique (Lei §3).
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/logistica/classificacao', async (original) => {
  const real = await original<typeof import('@/logistica/classificacao')>()
  return {
    ...real,
    listarClassificacao: vi.fn(async () => ({
      total: 1,
      linhas: [
        {
          tiny_id: 501,
          codigo: 'GR-01',
          descricao: 'Guarda-roupa Casal',
          classe: 'F',
          unidade: 'un',
          ncm: '94036000',
          situacao: 'A',
          tipo: 'movel',
          tipo_automatico: 'movel',
          definido_a_mao: false,
          imagem_caminho: null,
          contagem_total: 1,
        },
      ],
    })),
    definirTipoProduto: vi.fn(),
    buscarEstruturaDoProduto: vi.fn(async () => ({
      produto: { tiny_id: 501, codigo: 'GR-01', descricao: 'Guarda-roupa Casal', tipo: 'movel' },
      componentes: [
        {
          tiny_id: 901,
          codigo: 'CH-18',
          descricao: 'Chapa MDF 18mm',
          tipo: 'insumo',
          unidade: 'm²',
          quantidade: 2.5,
          no_catalogo: true,
        },
        {
          tiny_id: 902,
          codigo: 'PX-9',
          descricao: 'Puxador cromado',
          tipo: null,
          unidade: null,
          quantidade: 4,
          no_catalogo: false,
        },
      ],
      usado_em: [],
      usado_em_total: 0,
      lido_em: '2026-10-17T10:00:00Z',
    })),
    listarUnidadesForaDoPadrao: vi.fn(async () => ({
      total: 2,
      linhas: [
        {
          tiny_id: 903,
          codigo: 'PF-3',
          descricao: 'Parafuso 3x20',
          tipo: 'insumo',
          unidade_tiny: '',
          unidade_padrao: null,
          motivo: 'sem_unidade',
          contagem_total: 2,
        },
        {
          tiny_id: 904,
          codigo: 'FT-22',
          descricao: 'Fita de borda 22mm',
          tipo: 'insumo',
          unidade_tiny: 'Und',
          unidade_padrao: 'UN',
          motivo: 'grafia',
          contagem_total: 2,
        },
      ],
    })),
  }
})

function renderizar() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProvedorNotificacao>
        <ClassificacaoProdutos />
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
}

describe('Configurações → Móveis, insumos e peças', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ao abrir, só a página do catálogo — a estrutura e as unidades esperam o clique', async () => {
    renderizar()
    expect(await screen.findByText('Guarda-roupa Casal')).toBeInTheDocument()
    expect(listarClassificacao).toHaveBeenCalledTimes(1)
    expect(buscarEstruturaDoProduto).not.toHaveBeenCalled()
    expect(listarUnidadesForaDoPadrao).not.toHaveBeenCalled()
  })

  it('"Estrutura" mostra do que o produto é feito, com a quantidade e a unidade', async () => {
    renderizar()
    const linha = (await screen.findByText('Guarda-roupa Casal')).closest('li') as HTMLElement
    fireEvent.click(within(linha).getByRole('button', { name: 'Estrutura' }))
    await waitFor(() => expect(buscarEstruturaDoProduto).toHaveBeenCalledWith(501))
    expect(await within(linha).findByText('Do que é feito')).toBeInTheDocument()
    expect(within(linha).getByText('Chapa MDF 18mm')).toBeInTheDocument()
    expect(within(linha).getByText('2,5 m²')).toBeInTheDocument()
    // o componente que o Tiny mandou e ainda não está no catálogo daqui
    expect(within(linha).getByText(/fora do catálogo daqui/)).toBeInTheDocument()
    expect(within(linha).getByRole('button', { name: 'Estrutura' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('"Ver a lista" das unidades: o motivo em língua de gente, para padronizar no Tiny', async () => {
    renderizar()
    await screen.findByText('Guarda-roupa Casal')
    fireEvent.click(screen.getByRole('button', { name: 'Ver a lista' }))
    await waitFor(() => expect(listarUnidadesForaDoPadrao).toHaveBeenCalledWith(1))
    expect(await screen.findByText('Parafuso 3x20')).toBeInTheDocument()
    expect(screen.getByText(/sem unidade no Tiny/)).toBeInTheDocument()
    expect(screen.getByText(/escrito "Und" — o mais usado é "UN"/)).toBeInTheDocument()
    expect(screen.getByText(/produtos para padronizar/)).toBeInTheDocument()
    expect(screen.queryByText(/sem_unidade|grafia/)).toBeNull()
  })
})
