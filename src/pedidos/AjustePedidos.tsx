import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, CheckSquare, Square } from 'lucide-react'
import { Botao, Campo, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { ajustarPedidosPcp } from '@/kanban/api'
import type { AcaoAjustePedido, ResultadoAjustePedido } from '@/kanban/api'
import { AJUSTES_PEDIDO, pedidosPorExtenso } from '@/kanban/situacaoPlataforma'

/*
 * SESSAO-30 (D-117): o super admin marca pedidos e muda a situação deles na
 * plataforma (Concluído · Em rota · Entregue) ou arquiva — nada vai ao Tiny.
 * Saiu do PCP em 14/10 (D-134): o PCP (aguardando liberação) e a área Pedidos
 * (Todos os pedidos) usam a mesma barra.
 */

/** A caixinha de marcar do super admin — alvo de 44 px (D-06), estado em ícone + texto acessível. */
export function CaixaSelecao({
  marcado,
  rotulo,
  aoAlternar,
}: {
  marcado: boolean
  rotulo: string
  aoAlternar: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcado}
      aria-label={rotulo}
      onClick={aoAlternar}
      className={cn(
        '-my-2 -ml-2 flex size-11 shrink-0 items-center justify-center rounded-dm transition-colors hover:bg-superficie-sutil',
        marcado ? 'text-texto' : 'text-texto-suave',
      )}
    >
      {marcado ? (
        <CheckSquare aria-hidden className="size-5" />
      ) : (
        <Square aria-hidden className="size-5" />
      )}
    </button>
  )
}

/**
 * SESSAO-30 (D-117): a barra do super admin com os pedidos marcados — mudar a
 * situação na plataforma (Concluído · Em rota · Entregue) ou arquivar. Confirma
 * antes; o resultado volta pedido a pedido (o que não deu, com o porquê). O
 * Tiny não muda (resposta do dono, 08/10).
 */
export function BarraAjustePedidos({
  selecionados,
  aoLimpar,
  aoTerminar,
}: {
  selecionados: Map<number, number>
  aoLimpar: () => void
  aoTerminar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [ajuste, setAjuste] = useState<AcaoAjustePedido | ''>('')
  const [confirmando, setConfirmando] = useState<AcaoAjustePedido | null>(null)
  const [observacao, setObservacao] = useState('')
  const [resultados, setResultados] = useState<ResultadoAjustePedido[] | null>(null)
  const quantos = selecionados.size

  const mutacao = useMutation({
    mutationFn: (acao: AcaoAjustePedido) =>
      ajustarPedidosPcp({ pedidoIds: [...selecionados.keys()], acao, observacao }),
    onSuccess: async (lista) => {
      const feitos = lista.filter((r) => r.feito).length
      setConfirmando(null)
      setObservacao('')
      setAjuste('')
      if (feitos < lista.length) setResultados(lista)
      const ficaram = lista.length - feitos
      notificar({
        titulo:
          feitos === 0
            ? 'Nenhum pedido ajustado'
            : feitos === 1
              ? '1 pedido ajustado'
              : `${feitos} pedidos ajustados`,
        descricao:
          ficaram === 0
            ? undefined
            : ficaram === 1
              ? '1 pedido ficou como estava — veja o porquê.'
              : `${ficaram} pedidos ficaram como estavam — veja o porquê.`,
        tom: feitos < lista.length ? 'atencao' : 'perfeito',
      })
      aoTerminar()
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['cards'] }),
        clienteQuery.invalidateQueries({ queryKey: ['pedidos-lista'] }),
        clienteQuery.invalidateQueries({ queryKey: ['pedidos-resumo'] }),
      ])
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para ajustar os pedidos',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  const numeros = [...selecionados.values()].sort((a, b) => a - b)
  const explicacao =
    confirmando === 'arquivar'
      ? 'Os pedidos e as peças deles somem das telas da plataforma (a história fica, e dá para trazer de volta).'
      : (AJUSTES_PEDIDO.find((a) => a.valor === confirmando)?.explica ?? '')
  const tituloConfirmar =
    confirmando === 'arquivar'
      ? `Arquivar ${pedidosPorExtenso(quantos)}?`
      : `Marcar ${pedidosPorExtenso(quantos)} como "${AJUSTES_PEDIDO.find((a) => a.valor === confirmando)?.rotulo ?? ''}"?`

  return (
    <>
      {/* Celular: uma linha de controles, acima do balão do chat (bottom-20);
          no computador, tudo numa linha só (E-54 — nada passa da borda). */}
      <div
        role="region"
        aria-label="Pedidos marcados"
        className="sticky bottom-20 z-30 flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-3 shadow-lg sm:bottom-3 sm:flex-row sm:items-end sm:gap-3"
      >
        <div className="flex items-center justify-between gap-2 sm:mb-3 sm:min-w-32">
          <p className="text-sm font-medium text-texto">
            {quantos === 0
              ? 'Marque os pedidos'
              : `${pedidosPorExtenso(quantos)} marcado${quantos === 1 ? '' : 's'}`}
          </p>
          <Botao
            variante="fantasma"
            disabled={quantos === 0}
            onClick={aoLimpar}
            className="sm:hidden"
          >
            Desmarcar
          </Botao>
        </div>
        <div className="flex min-w-0 flex-1 items-end gap-2">
          <Selecao
            rotulo="Mudar a situação para"
            opcoes={AJUSTES_PEDIDO.map((a) => ({ valor: a.valor, rotulo: a.rotulo }))}
            valor={ajuste || undefined}
            aoMudar={(v) => setAjuste(v as AcaoAjustePedido)}
            placeholder="Escolha…"
            className="min-w-0 flex-1 sm:max-w-56"
          />
          <Botao
            disabled={quantos === 0 || ajuste === ''}
            onClick={() => ajuste && setConfirmando(ajuste)}
          >
            Aplicar
          </Botao>
          <Botao
            variante="perigo"
            icone={<Archive />}
            aria-label="Arquivar"
            title="Arquivar"
            disabled={quantos === 0}
            onClick={() => setConfirmando('arquivar')}
            className="px-3 sm:px-4"
          >
            <span className="hidden sm:inline">Arquivar</span>
          </Botao>
          <Botao
            variante="fantasma"
            disabled={quantos === 0}
            onClick={aoLimpar}
            className="hidden sm:inline-flex"
          >
            Desmarcar
          </Botao>
        </div>
      </div>

      <Modal
        aberto={confirmando !== null}
        aoFechar={(v) => !v && !mutacao.isPending && setConfirmando(null)}
        titulo={tituloConfirmar}
        descricao="Ajuste da plataforma — o Tiny não muda."
        rodape={
          <>
            <Botao
              variante="fantasma"
              disabled={mutacao.isPending}
              onClick={() => setConfirmando(null)}
            >
              Voltar
            </Botao>
            <Botao
              variante={confirmando === 'arquivar' ? 'perigo' : 'primaria'}
              carregando={mutacao.isPending}
              onClick={() => confirmando && mutacao.mutate(confirmando)}
            >
              {confirmando === 'arquivar' ? 'Sim, arquivar' : 'Sim, aplicar'}
            </Botao>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-texto">{explicacao}</p>
          <p className="text-sm text-texto-suave tabular-nums">
            {numeros.slice(0, 30).join(' · ')}
            {numeros.length > 30 ? ` · e mais ${numeros.length - 30}` : ''}
          </p>
          <Campo
            rotulo="Por quê (opcional)"
            placeholder="Fica na auditoria"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        aberto={resultados !== null}
        aoFechar={(v) => !v && setResultados(null)}
        titulo="O que ficou como estava"
        descricao={(() => {
          const feitos = (resultados ?? []).filter((r) => r.feito).length
          return feitos === 0
            ? 'Nenhum pedido foi ajustado.'
            : feitos === 1
              ? 'O outro pedido foi ajustado.'
              : `Os outros ${feitos} pedidos foram ajustados.`
        })()}
      >
        <ul className="flex flex-col gap-2 text-sm">
          {(resultados ?? [])
            .filter((r) => !r.feito)
            .map((r) => (
              <li key={r.pedido_id} className="flex flex-col">
                <span className="font-medium text-texto tabular-nums">
                  Pedido {r.numero ?? '—'}
                </span>
                <span className="text-texto-suave">{r.resultado}</span>
              </li>
            ))}
        </ul>
      </Modal>
    </>
  )
}
