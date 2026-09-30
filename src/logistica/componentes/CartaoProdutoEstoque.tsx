import { Factory, Minus, Plus } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import type { LinhaEstoqueProduto, OperacaoEstoque } from '@/logistica/api'
import { formatarQuantidade, rotuloPosicao, textoCorte } from '@/logistica/estoque'
import { FotoProduto } from './FotoProduto'

export interface CartaoProdutoEstoqueProps {
  linha: LinhaEstoqueProduto
  /** Logística/admin: foto, entrada e baixa. */
  podeMexer: boolean
  /** Com a reposição automática DESLIGADA: o "Lançar para produção" (D-87). */
  podeLancar: boolean
  aoMovimentar: (operacao: OperacaoEstoque) => void
  aoAbrir: () => void
  aoLancar: () => void
  /** A bolinha vermelha (resposta 6): pedido esperando a decisão do PCP. */
  aoAbrirPendencia: () => void
}

/**
 * O cartão do produto (↪️ 30/09 — D-86): foto em cima com a posição nas vendas
 * e a BOLINHA VERMELHA quando um pedido espera a decisão do PCP (tocar leva à
 * decisão); embaixo, nome, SKU, vendidos (com o aviso do corte), o número EM
 * ESTOQUE em destaque, reservados para produção e em venda, e o mínimo. Os
 * selos "Sem estoque"/"Faltam N" saíram — os números falam por si.
 */
export function CartaoProdutoEstoque({
  linha,
  podeMexer,
  podeLancar,
  aoMovimentar,
  aoAbrir,
  aoLancar,
  aoAbrirPendencia,
}: CartaoProdutoEstoqueProps) {
  const posicao = rotuloPosicao(linha.posicao)
  const corte = textoCorte(linha.cortes)
  const emEstoque = linha.em_estoque ?? 0

  return (
    <li className="flex flex-col overflow-hidden rounded-dm-lg border border-borda bg-superficie">
      <div className="relative">
        {/* Quadro quadrado: 121 das 144 fotos do catálogo são quadradas (30/09). */}
        <FotoProduto
          produto={linha}
          podeTrocar={podeMexer}
          aoAbrir={aoAbrir}
          className="aspect-square"
        />
        {posicao && (
          <span
            className="pointer-events-none absolute top-2 left-2 rounded-full bg-grafite-900/85 px-2.5 py-0.5 text-xs font-semibold text-white tabular-nums"
            title={`${posicao} mais vendido nos últimos 90 dias`}
          >
            {posicao}
          </span>
        )}
        {linha.pendente_card_id !== null && (
          // Alvo de toque cheio (F-07); o vermelho é a bolinha, não o botão.
          <button
            type="button"
            onClick={aoAbrirPendencia}
            aria-label={
              linha.pendente_pedido_numero !== null
                ? `Pedido ${linha.pendente_pedido_numero} espera a decisão do PCP — abrir`
                : 'Pedido esperando a decisão do PCP — abrir'
            }
            title="Pedido esperando a decisão do PCP — tocar abre a decisão"
            className="absolute top-0 right-0 flex size-11 items-center justify-center"
          >
            <span aria-hidden className="relative flex size-3.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-danificado-forte opacity-60" />
              <span className="relative inline-flex size-3.5 rounded-full border border-white/70 bg-danificado-forte" />
            </span>
          </button>
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
          {corte && <p className="truncate text-[11px] text-texto-fraco">{corte}</p>}
        </div>

        <div className="flex items-end justify-between gap-2">
          {/* O número em estoque com MAIS destaque (pedido do dono, 1.4). */}
          <p className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-texto tabular-nums">
              {formatarQuantidade(emEstoque)}
            </span>
            <span className="text-xs text-texto-suave">em estoque</span>
          </p>
          <p className="text-right text-xs text-texto-suave tabular-nums">
            Mínimo{' '}
            {linha.no_top && linha.minimo !== null && linha.minimo > 0
              ? formatarQuantidade(linha.minimo)
              : '—'}
          </p>
        </div>

        {(linha.reservados_producao > 0 || linha.reservados_venda > 0) && (
          <p className="text-xs text-texto-suave tabular-nums">
            {linha.reservados_producao > 0 && (
              <span>
                {formatarQuantidade(linha.reservados_producao)}{' '}
                {linha.reservados_producao === 1 ? 'reservado' : 'reservados'} p/ produção
              </span>
            )}
            {linha.reservados_producao > 0 && linha.reservados_venda > 0 && ' · '}
            {linha.reservados_venda > 0 && (
              <span>
                {formatarQuantidade(linha.reservados_venda)}{' '}
                {linha.reservados_venda === 1 ? 'reservado' : 'reservados'} em venda
              </span>
            )}
          </p>
        )}

        {podeMexer && (
          <div className="mt-auto flex flex-col gap-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
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
            {podeLancar && linha.em_necessidade && (
              <Botao
                variante="secundaria"
                icone={<Factory />}
                onClick={aoLancar}
                aria-label={`Lançar ${linha.descricao} para produção`}
              >
                Lançar para produção
              </Botao>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
