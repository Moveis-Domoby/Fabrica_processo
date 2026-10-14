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
  ['pcp-pedido-completo'],
  ['devolucoes'],
]

const TEXTOS: Record<
  Exclude<TipoMotivo, 'pausa'>,
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
  // SESSAO-31 (D-129): gesto da logística — o entregador não tem esse botão.
  devolucao: {
    titulo: 'Pedido devolvido',
    explica:
      'As peças voltam para a fábrica e ficam em "Em decisão pós devolução" (Estoque) — continuam do pedido até a logística decidir: reenviar, estoque, outro pedido, loja, danificados ou ajuste. O Tiny não muda.',
    botao: 'Marcar devolvido',
    feito: 'devolvido — as peças esperam a decisão no Estoque',
    erro: 'Não deu para marcar devolvido',
    acao: marcarDevolvido,
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
  pecas,
  aoFechar,
}: {
  tipo: Exclude<TipoMotivo, 'pausa'>
  pedido: PedidoDaEntrega | null
  /**
   * SESSAO-31 (D-129): pedido já entregue — quais peças voltaram (todas
   * marcadas de início). Só no "Pedido devolvido".
   */
  pecas?: { id: number; rotulo: string }[]
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const textos = TEXTOS[tipo]
  const [motivoId, setMotivoId] = useState<number | null>(null)
  const [observacao, setObservacao] = useState('')
  const [escolhidas, setEscolhidas] = useState<number[]>(() => (pecas ?? []).map((p) => p.id))

  const { data: motivos = [], isPending } = useQuery({
    queryKey: ['motivos', tipo],
    queryFn: () => listarMotivos(tipo),
    enabled: pedido !== null,
    staleTime: 5 * 60_000,
  })

  const confirmar = useMutation({
    mutationFn: () =>
      tipo === 'devolucao'
        ? marcarDevolvido({ cardId: pedido!.card_id, motivoId: motivoId!, observacao, pecas: escolhidas })
        : textos.acao({ cardId: pedido!.card_id, motivoId: motivoId!, observacao }),
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
          if (motivoId !== null && (!pecas || escolhidas.length > 0)) confirmar.mutate()
        }}
      >
        <p className="text-sm text-texto-suave">{textos.explica}</p>
        {pecas && pecas.length > 0 && (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium text-texto">Quais peças voltaram</legend>
            {pecas.map((p) => (
              <label key={p.id} className="flex min-h-toque-md cursor-pointer items-center gap-2 text-sm text-texto">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--dm-acao)]"
                  checked={escolhidas.includes(p.id)}
                  onChange={() =>
                    setEscolhidas((atual) =>
                      atual.includes(p.id) ? atual.filter((x) => x !== p.id) : [...atual, p.id],
                    )
                  }
                />
                {p.rotulo}
              </label>
            ))}
          </fieldset>
        )}
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
            icone={tipo === 'nao_entregue' ? <RotateCcw /> : tipo === 'devolucao' ? <PackageX /> : <Undo2 />}
            disabled={motivoId === null || (pecas !== undefined && escolhidas.length === 0)}
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
 * "Pedido devolvido" — ↩️ SESSAO-31 (D-129): da LOGÍSTICA, com motivo da lista
 * (Configurações → Utilitários → Motivos). As peças ficam em decisão no Estoque.
 */
export function ModalDevolvido({
  pedido,
  pecas,
  aoFechar,
}: {
  pedido: PedidoDaEntrega | null
  pecas?: { id: number; rotulo: string }[]
  aoFechar: () => void
}) {
  return <ModalMotivoEntrega tipo="devolucao" pedido={pedido} pecas={pecas} aoFechar={aoFechar} />
}
