import { ClipboardCheck, Minus, Plus } from 'lucide-react'
import { Botao, Modal } from '@/componentes/ui'
import { useAgora } from '@/kanban/tempo'
import type { LinhaEstoqueProduto, OperacaoEstoque } from '@/logistica/api'
import {
  formatarQuantidade,
  idadeDaLeitura,
  rotuloPosicao,
  sinalDoProduto,
  textoReposicao,
} from '@/logistica/estoque'
import { FotoProduto } from './FotoProduto'
import { PecasDoProduto } from './PecasDoEstoque'
import { SeloSinal } from './SeloSinal'

export interface ModalProdutoEstoqueProps {
  produto: LinhaEstoqueProduto | null
  podeMexer: boolean
  aoFechar: () => void
  aoMovimentar: (operacao: OperacaoEstoque) => void
}

/**
 * O produto aberto (tocar na foto do cartão): a foto grande — e a troca dela —,
 * os números, as peças uma a uma e o que o Tiny diz (as duas empresas somadas,
 * quando a plataforma já leu). O cartão fica enxuto; o detalhe mora aqui.
 */
export function ModalProdutoEstoque({
  produto,
  podeMexer,
  aoFechar,
  aoMovimentar,
}: ModalProdutoEstoqueProps) {
  const agora = useAgora()
  const sinal = produto ? sinalDoProduto(produto) : null
  const reposicao = produto ? textoReposicao(produto.reposicao_estado) : undefined
  const idade = produto ? idadeDaLeitura(produto.lido_em, agora) : null

  return (
    <Modal
      aberto={produto !== null}
      aoFechar={(v) => !v && aoFechar()}
      titulo={produto?.descricao || 'Produto'}
      descricao={
        produto
          ? [
              produto.codigo ? `SKU ${produto.codigo}` : 'sem SKU',
              produto.posicao !== null ? `${rotuloPosicao(produto.posicao)} mais vendido em 90 dias` : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : undefined
      }
      tamanho="galpao"
    >
      {produto && (
        <div className="flex flex-col gap-4">
          <FotoProduto
            produto={produto}
            podeTrocar={podeMexer}
            className="h-64 rounded-dm-lg sm:h-80"
          />

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <p className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold text-texto tabular-nums">
                {formatarQuantidade(produto.em_estoque ?? 0)}
              </span>
              <span className="text-sm text-texto-suave">em estoque</span>
            </p>
            <p className="text-sm text-texto-suave tabular-nums">
              Mínimo{' '}
              <span className="font-medium text-texto">
                {produto.minimo !== null && produto.minimo > 0 ? formatarQuantidade(produto.minimo) : '—'}
              </span>
              {produto.minimo_definido_aqui ? ' (definido aqui)' : produto.minimo ? ' (do Tiny)' : ''}
            </p>
            {produto.reservados > 0 && (
              <p className="text-sm text-texto-suave tabular-nums">
                {produto.reservados === 1 ? '1 reservada' : `${produto.reservados} reservadas`} para pedidos
              </p>
            )}
          </div>

          {(sinal || reposicao) && (
            <div className="flex flex-wrap items-center gap-2">
              {sinal && <SeloSinal sinal={sinal} />}
              {reposicao && <span className="text-sm text-texto-suave">{reposicao}</span>}
            </div>
          )}

          {podeMexer && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Botao variante="secundaria" icone={<Plus />} onClick={() => aoMovimentar('entrada')}>
                Entrada
              </Botao>
              <Botao
                variante="secundaria"
                icone={<Minus />}
                onClick={() => aoMovimentar('baixa')}
                disabled={(produto.em_estoque ?? 0) === 0}
              >
                Baixa
              </Botao>
              <Botao
                variante="secundaria"
                icone={<ClipboardCheck />}
                onClick={() => aoMovimentar('contagem')}
              >
                Contagem
              </Botao>
            </div>
          )}

          <section aria-label="Peças deste produto" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-texto">Peça por peça</h3>
            <PecasDoProduto produtoTinyId={produto.tiny_id} agora={agora} />
          </section>

          {produto.saldo_tiny !== null && (
            <p className="text-xs text-texto-fraco tabular-nums">
              {/* D-76: a leitura da plataforma traz as duas empresas somadas (o
                  "multiempresa" que a equipe olha); o aviso cru do Tiny, só o
                  depósito Geral da fábrica. */}
              {produto.origem_leitura === 'webhook'
                ? 'No Tiny, só o depósito da fábrica: '
                : 'No Tiny, as duas empresas somadas: '}
              {formatarQuantidade(produto.saldo_tiny)}
              {idade && ` · lido ${idade}`}.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
