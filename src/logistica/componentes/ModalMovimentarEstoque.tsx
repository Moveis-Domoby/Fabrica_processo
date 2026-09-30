import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { FiltroPill } from '@/dashboards/componentes/Filtros'
import { movimentarEstoque } from '@/logistica/api'
import type { OperacaoEstoque } from '@/logistica/api'
import { formatarQuantidade, previaMovimento } from '@/logistica/estoque'

export interface ProdutoMovimento {
  tiny_id: number
  codigo: string | null
  descricao: string
  em_estoque: number | null
  /** D-78: reservadas por venda, ainda no galpão (a contagem é física). */
  reservadas_estoque?: number
}

export interface ModalMovimentarEstoqueProps {
  produto: ProdutoMovimento | null
  operacaoInicial: OperacaoEstoque
  aoFechar: () => void
}

const OPERACOES: { valor: OperacaoEstoque; rotulo: string }[] = [
  { valor: 'entrada', rotulo: 'Entrada' },
  { valor: 'baixa', rotulo: 'Baixa' },
  { valor: 'contagem', rotulo: 'Contagem' },
]

const EXPLICACAO: Record<OperacaoEstoque, string> = {
  entrada: 'Peças prontas, em perfeito estado, que entraram no estoque.',
  baixa: 'Peças que saíram do estoque (venda, entrega, avaria). Saem as mais antigas primeiro.',
  contagem:
    'Quantas tem agora no galpão (contando as reservadas para pedido que ainda estão lá) — o sistema acerta a diferença sozinho.',
}

/**
 * Entrada, baixa ou contagem de um produto (ajuste de 28/09 — "a logística
 * irá dar baixa manual na quantidade de itens em estoque por enquanto"). O
 * banco faz o gesto por evento e confere de novo quem pode; aqui a prévia só
 * evita o erro óbvio antes de confirmar.
 */
export function ModalMovimentarEstoque({
  produto,
  operacaoInicial,
  aoFechar,
}: ModalMovimentarEstoqueProps) {
  // key no uso: cada produto/operação abre o modal limpo.
  const [operacao, setOperacao] = useState<OperacaoEstoque>(operacaoInicial)
  const [quantidade, setQuantidade] = useState(operacaoInicial === 'contagem' ? '' : '1')
  const [observacao, setObservacao] = useState('')
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const atual = Math.max(produto?.em_estoque ?? 0, 0)
  const reservadas = Math.max(produto?.reservadas_estoque ?? 0, 0)
  const numero = quantidade.trim() === '' ? Number.NaN : Number(quantidade)
  const previa = previaMovimento(operacao, numero, atual, reservadas)

  const mutacao = useMutation({
    mutationFn: () =>
      movimentarEstoque({
        produtoTinyId: produto!.tiny_id,
        operacao,
        quantidade: Math.trunc(numero),
        observacao,
      }),
    onSuccess: async (depois) => {
      notificar({
        titulo: 'Estoque atualizado',
        descricao: `${produto?.descricao ?? 'Produto'}: ${formatarQuantidade(depois)} em estoque.`,
        tom: 'perfeito',
      })
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['estoque'] }),
        clienteQuery.invalidateQueries({ queryKey: ['reposicoes'] }),
      ])
      aoFechar()
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para atualizar o estoque',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  const rotuloConfirmar =
    operacao === 'entrada'
      ? 'Registrar entrada'
      : operacao === 'baixa'
        ? 'Registrar baixa'
        : 'Registrar contagem'

  return (
    <Modal
      aberto={produto !== null}
      aoFechar={(aberto) => !aberto && aoFechar()}
      titulo="Movimentar estoque"
      descricao={produto ? `${produto.descricao}${produto.codigo ? ` · SKU ${produto.codigo}` : ''}` : undefined}
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            onClick={() => mutacao.mutate()}
            disabled={!previa.valida}
            carregando={mutacao.isPending}
          >
            {rotuloConfirmar}
          </Botao>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(evento) => {
          evento.preventDefault()
          if (previa.valida && !mutacao.isPending) mutacao.mutate()
        }}
      >
        <p className="text-sm text-texto-suave">
          Hoje no estoque:{' '}
          <span className="font-semibold text-texto tabular-nums">{formatarQuantidade(atual)}</span>
          {reservadas > 0 && (
            <>
              {' '}
              <span className="tabular-nums">
                + {reservadas === 1 ? '1 reservada' : `${reservadas} reservadas`} para pedido no galpão
              </span>
            </>
          )}
        </p>
        <FiltroPill
          rotulo="O que aconteceu"
          opcoes={OPERACOES}
          valor={operacao}
          aoMudar={(v) => {
            setOperacao(v)
            // Na contagem o campo nasce vazio: quem contou digita o que viu.
            if (v === 'contagem') setQuantidade('')
            else if (quantidade.trim() === '' || operacao === 'contagem') setQuantidade('1')
          }}
        />
        <p className="text-sm text-texto-suave">{EXPLICACAO[operacao]}</p>
        <Campo
          rotulo={operacao === 'contagem' ? 'Quantas peças tem agora' : 'Quantas peças'}
          type="number"
          inputMode="numeric"
          min={operacao === 'contagem' ? 0 : 1}
          max={500}
          step={1}
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          className="text-lg tabular-nums"
          autoFocus
        />
        <p
          className={previa.valida ? 'text-sm text-texto' : 'text-sm text-danificado-texto'}
          aria-live="polite"
        >
          {previa.texto}
        </p>
        <Campo
          rotulo="Observação (opcional)"
          placeholder="Ex.: vendida no balcão, contagem de segunda"
          value={observacao}
          maxLength={200}
          onChange={(e) => setObservacao(e.target.value)}
        />
        {/* Enter no campo confirma — o botão real fica no rodapé. */}
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>
          {rotuloConfirmar}
        </button>
      </form>
    </Modal>
  )
}
