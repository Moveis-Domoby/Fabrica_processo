import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CartaoProdutoEstoque } from './CartaoProdutoEstoque'
import type { LinhaEstoqueProduto } from '@/logistica/api'

vi.mock('./FotoProduto', () => ({ FotoProduto: () => <div data-testid="foto" /> }))

/** A linha do vídeo do dono (04/11): a mesa 162 com as 2 peças do estoque reservadas pela venda do 13811. */
const linha = (extra: Partial<LinhaEstoqueProduto> = {}): LinhaEstoqueProduto => ({
  tiny_id: 888678409,
  codigo: '162',
  descricao: 'Mesa de cabeceira Retrô com gaveta - Branca - 38 x 64 x 38',
  classe: 'P',
  unidade: 'UN',
  tipo_estoque: 'movel',
  imagem_caminho: null,
  posicao: 13,
  vendidos_90d: 25,
  cortes: 0,
  no_top: true,
  minimo: 2,
  minimo_tiny: null,
  minimo_travado: false,
  sugestao: 2,
  em_estoque: 0,
  reservados_venda: 4,
  reservadas_estoque: 2,
  reservados_producao: 2,
  em_devolucao: 0,
  em_necessidade: true,
  repor_sugerido: 2,
  pendente_card_id: 14542194,
  pendente_pedido_numero: 13811,
  saldo_tiny: 2,
  lido_em: null,
  origem_leitura: null,
  reposicao_estado: null,
  contagem_total: 1,
  ...extra,
})

const cartao = (l: LinhaEstoqueProduto) =>
  render(
    <ul>
      <CartaoProdutoEstoque
        linha={l}
        podeMexer={false}
        podeLancar={false}
        pedeProducao={false}
        aoMovimentar={() => {}}
        aoAbrir={() => {}}
        aoLancar={() => {}}
        aoAbrirPendencia={() => {}}
      />
    </ul>,
  )

describe('CartaoProdutoEstoque — SESSAO-45: as mesmas palavras do PCP (o vídeo do "PCP mentindo")', () => {
  it('com peças reservadas pela venda: o número grande é o LIVRE e as reservadas que seguem no galpão aparecem logo abaixo, com o pedido', () => {
    cartao(linha())
    expect(screen.getByText('livres no estoque')).toBeInTheDocument()
    expect(screen.queryByText('em estoque')).not.toBeInTheDocument()
    expect(screen.getByText(/\+ 2 no estoque\s+reservadas para venda \(pedido 13811…\)/)).toBeInTheDocument()
  })

  it('sem reserva no galpão, o cartão continua como sempre ("em estoque")', () => {
    cartao(linha({ reservadas_estoque: 0, em_estoque: 3, pendente_card_id: null, pendente_pedido_numero: null }))
    expect(screen.getByText('em estoque')).toBeInTheDocument()
    expect(screen.queryByText(/reservadas? para venda/)).not.toBeInTheDocument()
  })
})
