import { Minus, Plus } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import type { LinhaEstoqueProduto, OperacaoEstoque } from '@/logistica/api'
import {
  formatarQuantidade,
  rotuloPosicao,
  sinalDoProduto,
  textoReposicao,
} from '@/logistica/estoque'
import { FotoProduto } from './FotoProduto'
import { SeloSinal } from './SeloSinal'

export interface CartaoProdutoEstoqueProps {
  linha: LinhaEstoqueProduto
  /** Logística/admin: foto, entrada e baixa. */
  podeMexer: boolean
  aoMovimentar: (operacao: OperacaoEstoque) => void
  aoAbrir: () => void
}

/**
 * O cartão do produto no Top 20+ (ajuste de 28/09 — "muito poluído, deixe mais
 * enxuto com valores menores e dando destaque para a imagem"): a FOTO em cima,
 * com a posição nas vendas; embaixo, nome, SKU, o número do estoque, o mínimo,
 * o sinal (ícone + texto) e os dois gestos da logística. O resto (peças,
 * referência do Tiny) mora no detalhe — tocar na foto abre.
 */
export function CartaoProdutoEstoque({
  linha,
  podeMexer,
  aoMovimentar,
  aoAbrir,
}: CartaoProdutoEstoqueProps) {
  const sinal = sinalDoProduto(linha)
  const reposicao = textoReposicao(linha.reposicao_estado)
  const posicao = rotuloPosicao(linha.posicao)
  const emEstoque = linha.em_estoque ?? 0

  return (
    <li className="flex flex-col overflow-hidden rounded-dm-lg border border-borda bg-superficie">
      <div className="relative">
        <FotoProduto produto={linha} podeTrocar={podeMexer} aoAbrir={aoAbrir} className="h-40" />
        {posicao && (
          <span
            className="pointer-events-none absolute top-2 left-2 rounded-full bg-grafite-900/85 px-2.5 py-0.5 text-xs font-semibold text-white tabular-nums"
            title={`${posicao} mais vendido nos últimos 90 dias`}
          >
            {posicao}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold text-texto" title={linha.descricao}>
            {linha.descricao || 'Sem descrição'}
          </p>
          <p className="truncate text-xs text-texto-suave tabular-nums">
            {linha.codigo ? `SKU ${linha.codigo}` : 'sem SKU'}
            {linha.vendidos_90d > 0 &&
              ` · ${formatarQuantidade(linha.vendidos_90d)} ${linha.vendidos_90d === 1 ? 'vendido' : 'vendidos'} em 90 dias`}
          </p>
        </div>

        <div className="flex items-end justify-between gap-2">
          <p className="flex items-baseline gap-1.5">
            <span className="text-xl font-semibold text-texto tabular-nums">
              {formatarQuantidade(emEstoque)}
            </span>
            <span className="text-xs text-texto-suave">em estoque</span>
          </p>
          <p className="text-right text-xs text-texto-suave tabular-nums">
            Mínimo {linha.minimo !== null && linha.minimo > 0 ? formatarQuantidade(linha.minimo) : '—'}
            {linha.reservados > 0 && (
              <>
                <br />
                {linha.reservados === 1 ? '1 reservada' : `${linha.reservados} reservadas`}
              </>
            )}
          </p>
        </div>

        {(sinal || reposicao) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {sinal && <SeloSinal sinal={sinal} />}
            {reposicao && <span className="text-xs text-texto-suave">{reposicao}</span>}
          </div>
        )}

        {podeMexer && (
          <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
            <Botao
              variante="secundaria"
              icone={<Plus />}
              onClick={() => aoMovimentar('entrada')}
              aria-label={`Entrada de ${linha.descricao}`}
            >
              Entrada
            </Botao>
            <Botao
              variante="secundaria"
              icone={<Minus />}
              onClick={() => aoMovimentar('baixa')}
              disabled={emEstoque === 0}
              aria-label={`Baixa de ${linha.descricao}`}
            >
              Baixa
            </Botao>
          </div>
        )}
      </div>
    </li>
  )
}
