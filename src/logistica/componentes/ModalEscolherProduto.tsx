import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronRight, Search } from 'lucide-react'
import { Campo, Modal } from '@/componentes/ui'
import { listarEstoqueProdutos } from '@/logistica/api'
import type { LinhaEstoqueProduto } from '@/logistica/api'
import { formatarQuantidade, rotuloPosicao } from '@/logistica/estoque'
import { FotoProduto } from './FotoProduto'

const QUANTOS = 8

export interface ModalEscolherProdutoProps {
  aberto: boolean
  aoFechar: () => void
  aoEscolher: (produto: LinhaEstoqueProduto) => void
}

/**
 * "Cadastrar produto ao estoque" (ajuste de 28/09): procura no catálogo de
 * acabados — pelos mais vendidos primeiro — e, escolhido o produto, a
 * entrada segue no modal de movimentar. A busca é do servidor e traz só 8 por
 * vez (regra 17).
 */
export function ModalEscolherProduto({ aberto, aoFechar, aoEscolher }: ModalEscolherProdutoProps) {
  const [busca, setBusca] = useState('')
  const { data: produtos = [], isPending, isError, error } = useQuery({
    queryKey: ['estoque', 'escolher', busca],
    queryFn: () =>
      listarEstoqueProdutos({ grupo: 'acabados', busca, filtro: 'todos', limite: QUANTOS }),
    enabled: aberto,
    placeholderData: keepPreviousData,
  })
  const total = produtos[0]?.contagem_total ?? 0

  return (
    <Modal
      aberto={aberto}
      aoFechar={(v) => !v && aoFechar()}
      titulo="Cadastrar produto ao estoque"
      descricao="Escolha o produto — em seguida você diz quantas peças entram."
    >
      <div className="flex flex-col gap-3">
        <Campo
          rotulo="Buscar produto"
          prefixo={<Search />}
          placeholder="Nome do produto ou SKU"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          autoFocus
        />
        {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
        {isError && (
          <p className="text-sm text-danificado-texto">
            {error instanceof Error ? error.message : 'Não deu para buscar os produtos.'}
          </p>
        )}
        {!isPending && !isError && produtos.length === 0 && (
          <p className="text-sm text-texto-suave">Nenhum produto acabado com esse nome ou SKU.</p>
        )}
        <ul className="flex flex-col divide-y divide-borda rounded-dm border border-borda">
          {produtos.map((p) => (
            <li key={p.tiny_id}>
              <button
                type="button"
                onClick={() => aoEscolher(p)}
                className="flex min-h-toque-lg w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-superficie-sutil"
              >
                <FotoProduto
                  produto={p}
                  podeTrocar={false}
                  iconeGrande={false}
                  className="size-12 shrink-0 rounded-dm"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-texto">{p.descricao}</span>
                  <span className="text-xs text-texto-suave tabular-nums">
                    {p.codigo ? `SKU ${p.codigo}` : 'sem SKU'}
                    {p.posicao !== null && ` · ${rotuloPosicao(p.posicao)} em vendas`}
                    {` · ${formatarQuantidade(p.em_estoque ?? 0)} em estoque`}
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-texto-fraco" />
              </button>
            </li>
          ))}
        </ul>
        {total > produtos.length && (
          <p className="text-xs text-texto-suave">
            Mostrando {produtos.length} de {total} — digite mais do nome ou o SKU para achar.
          </p>
        )}
      </div>
    </Modal>
  )
}
