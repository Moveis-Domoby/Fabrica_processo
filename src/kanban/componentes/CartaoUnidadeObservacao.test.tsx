import { describe, expect, it, vi } from 'vitest'
import { render as renderCru, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CartaoUnidade } from './CartaoUnidade'
import type { Card, PedidoDoCard } from '../tipos'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/perfil/api', () => ({ urlDaFoto: () => null }))

/**
 * SESSAO-50 (bloco A): a observação do item do Tiny na capa do card — a faixa
 * âmbar logo abaixo do nome, só quando existe.
 */
const AGORA = new Date(2026, 10, 12, 10, 0).getTime()

// as etiquetas do card leem o catálogo pelo cache da tela
function render(ui: ReactElement) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  cliente.setQueryData(['etiquetas'], [{ id: 7, nome: 'CLIENTE ESPERA', cor: 'violeta', arquivada_em: null }])
  return renderCru(<QueryClientProvider client={cliente}>{ui}</QueryClientProvider>)
}

const peca: Card = {
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
  desde: new Date(AGORA - 42 * 60_000).toISOString(),
  executor_atual_id: null,
  responsavel_id: null,
  delegado_em: null,
  qualidade_atual: null,
  concluido_em: null,
  pausado_em: null,
  liberado_completo_em: null,
}

const pedido = {
  pedido_id: 77,
  numero: 13871,
  cliente_nome: 'Cliente do vídeo',
  situacao: 'Preparando envio',
  data_prevista: '2026-11-20',
  entrou_pcp_em: null,
  liberado_completo_em: null,
} as PedidoDoCard

const LONGA =
  'Sob medida: 1,20 m de largura x 0,45 m de profundidade, cor freijó com branco neve, puxador cava, ' +
  'cliente não quer rodinhas e pediu a prateleira do meio removível'

describe('a observação do item na capa do card (SESSAO-50)', () => {
  it('sem observação o card fica igual ao de hoje — nenhum espaço reservado', () => {
    const { container: semCampo } = render(<CartaoUnidade card={peca} pedido={pedido} agora={AGORA} />)
    const { container: nulo } = render(
      <CartaoUnidade card={{ ...peca, observacao_item: null }} pedido={pedido} agora={AGORA} />,
    )
    expect(semCampo.querySelector('[data-observacao-item]')).toBeNull()
    expect(nulo.querySelector('[data-observacao-item]')).toBeNull()
    expect(nulo.innerHTML).toBe(semCampo.innerHTML)
    // o nome segue seguido do tempo de fila, como sempre
    const nome = screen.getAllByText('Estante Basic 10 nichos – Branca')[0]
    expect(nome.nextElementSibling?.textContent).toMatch(/na fila/)
  })

  it('com observação: a faixa logo abaixo do nome, ícone de nota + o texto, o texto inteiro ao passar o mouse e o leitor de tela ouve "Observação do item"', () => {
    const { container } = render(
      <CartaoUnidade
        card={{ ...peca, observacao_item: 'adicionar rodízios' }}
        pedido={pedido}
        agora={AGORA}
      />,
    )
    const faixa = container.querySelector('[data-observacao-item]') as HTMLElement
    expect(faixa).not.toBeNull()
    expect(faixa.textContent).toBe('Observação do item: adicionar rodízios')
    expect(faixa.getAttribute('title')).toBe('adicionar rodízios')
    expect(faixa.querySelector('.sr-only')?.textContent).toBe('Observação do item: ')
    expect(faixa.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    // a ordem da capa: nome → faixa → tempo
    const nome = screen.getByText('Estante Basic 10 nichos – Branca')
    expect(nome.nextElementSibling).toBe(faixa)
    expect(faixa.nextElementSibling?.textContent).toMatch(/na fila/)
    // instrução, não alerta: âmbar suave com o filete (tokens da casa), nada de vermelho
    expect(faixa.className).toMatch(/bg-atencao-fundo\/50/)
    expect(faixa.className).toMatch(/border-l-\[3px\]/)
    expect(faixa.className).not.toMatch(/danificado/)
    expect(faixa.className).toMatch(/text-xs/)
  })

  it('162 caracteres: no máximo 2 linhas com reticências, sem estourar a largura; o texto inteiro no title', () => {
    expect(LONGA).toHaveLength(162)
    const { container } = render(
      <CartaoUnidade card={{ ...peca, observacao_item: LONGA }} pedido={pedido} agora={AGORA} />,
    )
    const faixa = container.querySelector('[data-observacao-item]') as HTMLElement
    const texto = faixa.lastElementChild as HTMLElement
    expect(texto.textContent).toBe(LONGA)
    expect(texto.className).toMatch(/line-clamp-2/)
    expect(texto.className).toMatch(/min-w-0/)
    expect(texto.className).toMatch(/break-words/)
    expect(faixa.className).toMatch(/min-w-0/)
    expect(faixa.getAttribute('title')).toBe(LONGA)
  })

  it('no tablet a faixa acompanha a letra maior do card', () => {
    const { container } = render(
      <CartaoUnidade
        card={{ ...peca, observacao_item: 'adicionar rodízios' }}
        pedido={pedido}
        agora={AGORA}
        tamanho="galpao"
      />,
    )
    const faixa = container.querySelector('[data-observacao-item]') as HTMLElement
    expect(faixa.className).toMatch(/text-sm/)
    expect(faixa.textContent).toMatch(/adicionar rodízios/)
  })

  it('pausado + observação + etiquetas: tudo aparece, cada um no seu lugar (nada se sobrepõe)', () => {
    const { container } = render(
      <CartaoUnidade
        card={{
          ...peca,
          executor_atual_id: 'u-franklin',
          pausado_em: new Date(AGORA - 20 * 60_000).toISOString(),
          pausa_motivo: 'Falta de material',
          etiquetas: [7],
          observacao_item: LONGA,
        }}
        pedido={pedido}
        agora={AGORA}
        executorNome="Franklin"
      />,
    )
    const faixa = container.querySelector('[data-observacao-item]') as HTMLElement
    const etiquetas = screen.getByLabelText('Etiquetas')
    const pausa = screen.getByText(/Pausado · Falta de material/)
    expect(faixa).not.toBeNull()
    expect(screen.getByText('CLIENTE ESPERA')).toBeTruthy()
    // a faixa vem antes das etiquetas, que vêm antes da pausa — blocos irmãos, um embaixo do outro
    const artigo = container.querySelector('article') as HTMLElement
    const filhos = Array.from(artigo.children)
    const posicao = (el: Element) => filhos.findIndex((f) => f === el || f.contains(el))
    expect(posicao(faixa)).toBeGreaterThan(-1)
    expect(posicao(faixa)).toBeLessThan(posicao(etiquetas))
    expect(posicao(etiquetas)).toBeLessThan(posicao(pausa))
  })
})
