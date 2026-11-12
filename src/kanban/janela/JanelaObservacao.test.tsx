import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import type { JanelaDoCard as Dados } from './api'

/**
 * SESSAO-50 (bloco A): a janela do card mostra a observação do item do Tiny
 * inteira, na seção "Observação do item (Tiny)" perto de Datas — e relê sozinha
 * quando o banco avisa no canal do card que ela mudou.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/perfil/api', () => ({ urlDaFoto: () => null }))
vi.mock('@/autenticacao/sessao-contexto', () => ({
  useSessao: () => ({ perfil: { id: 'u-1', papel: 'operador', nivel: null }, ehLider: false }),
}))

// o canal do card: guarda quem ouve para o teste "falar" como o banco
const ouvintes = new Map<string, (evento: string, dados: Record<string, unknown>) => void>()
vi.mock('@/chat/canais', () => ({
  ouvirCanal: (topico: string, ouvinte: (evento: string, dados: Record<string, unknown>) => void) => {
    ouvintes.set(topico, ouvinte)
    return () => ouvintes.delete(topico)
  },
}))

let dados: Dados
const abrirJanela = vi.fn(async () => dados)
vi.mock('./api', async (original) => {
  const real = await original<typeof import('./api')>()
  return { ...real, abrirJanela: () => abrirJanela() }
})

const LONGA =
  'Sob medida: 1,20 m de largura x 0,45 m de profundidade, cor freijó com branco neve, puxador cava, ' +
  'cliente não quer rodinhas e pediu a prateleira do meio removível'

function janela(observacao?: string): Dados {
  return {
    card: {
      id: 901,
      tipo: 'unidade',
      pedido_id: 77,
      produto_tiny_id: null,
      card_pai_id: 55,
      item_seq: 1,
      item_codigo: '420',
      item_descricao: 'Estante Basic 10 nichos – Branca',
      indice_unidade: 1,
      total_unidades: 1,
      setor_atual_id: 4,
      etapa_atual_id: 20,
      desde: new Date(2026, 10, 12, 9, 0).toISOString(),
      executor_atual_id: null,
      responsavel_id: null,
      delegado_em: null,
      qualidade_atual: null,
      concluido_em: null,
      pausado_em: null,
      liberado_completo_em: null,
      ...(observacao === undefined ? {} : { observacao_item: observacao }),
    },
    arquivado_em: null,
    criado_em: new Date(2026, 10, 12, 8, 0).toISOString(),
    setor: { id: 4, nome: 'MONTAGEM', codigo: 'montagem', papel_no_fluxo: 'producao' },
    etapa: { id: 20, nome: 'A MONTAR', eh_fila: true },
    execucao: null,
    auxilios: [],
    pessoas: {},
    pedido: {
      pedido_id: 77,
      numero: 13871,
      cliente_nome: 'Cliente do vídeo',
      situacao: 'Preparando envio',
      data_prevista: '2026-11-20',
    },
    prazo: { inicio: '2026-11-10', vencimento: '2026-11-20', do_pedido: true },
    campos: [],
    etiquetas: [],
    permissoes: {
      editar: false,
      editar_nome: false,
      concluir: false,
      anexar: false,
      ver_removidos: false,
      pausar: false,
      retomar: false,
      auxiliar: false,
      sair_auxilio: false,
    },
  }
}

async function abrir(modo: 'padrao' | 'tablet' = 'padrao') {
  const { JanelaDoCard } = await import('./JanelaDoCard')
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <ProvedorNotificacao>
        <MemoryRouter>
          <JanelaDoCard cardId={901} aoFechar={() => undefined} modo={modo} />
        </MemoryRouter>
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
  await screen.findByText('Datas')
}

describe('a observação do item na janela do card (SESSAO-50)', () => {
  beforeEach(() => {
    abrirJanela.mockClear()
    ouvintes.clear()
  })

  it('mostra a seção "Observação do item (Tiny)" com o texto inteiro, logo acima das Datas', async () => {
    dados = janela(LONGA)
    await abrir()
    const rotulo = screen.getByText('Observação do item (Tiny)')
    const secao = rotulo.closest('div.rounded-dm') as HTMLElement
    expect(secao).not.toBeNull()
    expect(secao.textContent).toContain(LONGA)
    // inteira: sem as 2 linhas da capa e sem o title (o texto já está todo ali)
    const faixa = secao.querySelector('[data-observacao-item]') as HTMLElement
    expect(faixa.lastElementChild?.className).not.toMatch(/line-clamp/)
    expect(faixa.getAttribute('title')).toBeNull()
    // perto de Datas: a seção vem logo antes da de Datas
    const datas = screen.getByText('Datas').closest('div.rounded-dm') as HTMLElement
    expect(secao.nextElementSibling).toBe(datas)
    // ocupa a largura das duas colunas (o texto longo não espreme)
    expect(secao.className).toMatch(/sm:col-span-2/)
  })

  it('sem observação, nenhuma seção nova (a janela fica como era)', async () => {
    dados = janela()
    await abrir()
    expect(screen.queryByText('Observação do item (Tiny)')).toBeNull()
    expect(document.querySelector('[data-observacao-item]')).toBeNull()
  })

  it('no tablet também aparece (só para ver)', async () => {
    dados = janela('adicionar rodízios')
    await abrir('tablet')
    expect(screen.getByText('Observação do item (Tiny)')).toBeTruthy()
    expect(screen.getByText('adicionar rodízios')).toBeTruthy()
  })

  it('ao vivo: o banco avisa "card_mudou" no canal do card e a janela relê (outro aviso não relê)', async () => {
    dados = janela('adicionar rodízios')
    await abrir()
    expect(abrirJanela).toHaveBeenCalledTimes(1)
    const ouvinte = ouvintes.get('plt-card:901')
    expect(ouvinte).toBeDefined()
    // outro aviso do mesmo canal (a conversa) não relê a janela
    await act(async () => ouvinte?.('mensagem', { id: 1 }))
    expect(abrirJanela).toHaveBeenCalledTimes(1)
    dados = janela('COM RODINHAS')
    await act(async () => ouvinte?.('card_mudou', { card_id: 901 }))
    await waitFor(() => expect(abrirJanela).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('COM RODINHAS')).toBeTruthy()
    expect(screen.queryByText('adicionar rodízios')).toBeNull()
  })
})
