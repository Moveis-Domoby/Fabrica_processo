import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PackageX, RotateCcw, Undo2 } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { desfazerEntrega, listarMotivos, marcarDevolvido, marcarNaoEntregue } from './api'
import type { TipoMotivo } from './api'

/** O pedido em que se está mexendo (o mínimo que os modais mostram). */
export interface PedidoDaEntrega {
  card_id: number
  numero: number
  cliente_nome?: string | null
}

/** Depois de qualquer gesto da entrega, o que a tela relê. */
const CHAVES_ENTREGA = [
  ['rotas'],
  ['programacao'],
  ['programadas'],
  ['entregas-do-dia'],
  ['estoque'],
  ['pcp-todos'],
]

const TEXTOS: Record<
  TipoMotivo,
  {
    titulo: string
    explica: string
    botao: string
    feito: string
    erro: string
    acao: typeof marcarNaoEntregue
  }
> = {
  nao_entregue: {
    titulo: 'Não entregue',
    explica:
      'O pedido sai do caminhão e volta para "Programar". Os móveis continuam na ROTAS e o Tiny não muda.',
    botao: 'Marcar não entregue',
    feito: 'não entregue — volta para Programar',
    erro: 'Não deu para marcar não entregue',
    acao: marcarNaoEntregue,
  },
  desfazer_entrega: {
    titulo: 'Desfazer a entrega',
    explica:
      'Só a entrega de hoje se desfaz. Os móveis voltam para a ROTAS e o Tiny volta para a situação de antes.',
    botao: 'Desfazer a entrega',
    feito: 'entrega desfeita',
    erro: 'Não deu para desfazer a entrega',
    acao: desfazerEntrega,
  },
}

/**
 * "Não entregue" e "Desfazer a entrega" (D-113/D-116): escolher o motivo numa
 * lista curta (Configurações → Utilitários) e, se quiser, escrever um detalhe.
 * Os botões de motivo são grandes — o entregador usa no celular (D-06).
 */
export function ModalMotivoEntrega({
  tipo,
  pedido,
  aoFechar,
}: {
  tipo: TipoMotivo
  pedido: PedidoDaEntrega | null
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const textos = TEXTOS[tipo]
  const [motivoId, setMotivoId] = useState<number | null>(null)
  const [observacao, setObservacao] = useState('')

  const { data: motivos = [], isPending } = useQuery({
    queryKey: ['motivos', tipo],
    queryFn: () => listarMotivos(tipo),
    enabled: pedido !== null,
    staleTime: 5 * 60_000,
  })

  const confirmar = useMutation({
    mutationFn: () => textos.acao({ cardId: pedido!.card_id, motivoId: motivoId!, observacao }),
    onSuccess: async () => {
      notificar({ titulo: `Pedido ${pedido?.numero}: ${textos.feito}`, tom: 'perfeito' })
      aoFechar()
      await Promise.all(
        CHAVES_ENTREGA.map((queryKey) => clienteQuery.invalidateQueries({ queryKey })),
      )
    },
    onError: (erro) =>
      notificar({
        titulo: textos.erro,
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  return (
    <Modal
      aberto={pedido !== null}
      aoFechar={(v) => !v && aoFechar()}
      titulo={`${textos.titulo} — pedido ${pedido?.numero ?? ''}`}
      descricao={pedido?.cliente_nome ?? undefined}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (motivoId !== null) confirmar.mutate()
        }}
      >
        <p className="text-sm text-texto-suave">{textos.explica}</p>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-texto">Motivo</legend>
          {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {motivos.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={motivoId === m.id}
                onClick={() => setMotivoId(m.id)}
                className={cn(
                  'min-h-12 rounded-dm border px-3 py-2 text-left text-sm transition-colors',
                  motivoId === m.id
                    ? 'border-acao-ativa bg-acao/15 font-medium text-texto'
                    : 'border-borda bg-superficie text-texto hover:bg-superficie-sutil',
                )}
              >
                {m.texto}
              </button>
            ))}
          </div>
        </fieldset>
        <Campo
          rotulo="Detalhe (opcional)"
          placeholder="Ex.: volta amanhã depois das 10h"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Botao
            type="submit"
            icone={tipo === 'nao_entregue' ? <RotateCcw /> : <Undo2 />}
            disabled={motivoId === null}
            carregando={confirmar.isPending}
          >
            {textos.botao}
          </Botao>
          <Botao type="button" variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
        </div>
      </form>
    </Modal>
  )
}

/**
 * "Pedido devolvido" (D-114, resposta 1a do dono): os móveis voltam ao
 * ESTOQUE sem dono, sem ninguém confirmar; o Tiny NÃO muda (devolução mexe
 * com dinheiro e nota — o comercial trata lá).
 */
export function ModalDevolvido({
  pedido,
  aoFechar,
}: {
  pedido: PedidoDaEntrega | null
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [observacao, setObservacao] = useState('')

  const confirmar = useMutation({
    mutationFn: () => marcarDevolvido({ cardId: pedido!.card_id, observacao }),
    onSuccess: async () => {
      notificar({
        titulo: `Pedido ${pedido?.numero} devolvido`,
        descricao: 'Os móveis voltaram ao ESTOQUE, sem dono.',
        tom: 'perfeito',
      })
      aoFechar()
      await Promise.all(
        CHAVES_ENTREGA.map((queryKey) => clienteQuery.invalidateQueries({ queryKey })),
      )
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para marcar devolvido',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  return (
    <Modal
      aberto={pedido !== null}
      aoFechar={(v) => !v && aoFechar()}
      titulo={`Pedido devolvido — ${pedido?.numero ?? ''}`}
      descricao={pedido?.cliente_nome ?? undefined}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          confirmar.mutate()
        }}
      >
        <p className="text-sm text-texto-suave">
          Os móveis voltam para o ESTOQUE, sem dono, e o pedido sai do caminhão. O Tiny não muda — a
          devolução é tratada pelo comercial.
        </p>
        <Campo
          rotulo="O que aconteceu (opcional)"
          placeholder="Ex.: cliente recusou na porta"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Botao type="submit" icone={<PackageX />} carregando={confirmar.isPending}>
            Confirmar devolução
          </Botao>
          <Botao type="button" variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
        </div>
      </form>
    </Modal>
  )
}
