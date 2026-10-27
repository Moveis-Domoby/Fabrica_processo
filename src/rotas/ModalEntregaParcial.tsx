import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PackageCheck, TriangleAlert } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { listarMotivos, listarPecasDaEntrega, registrarEntregaParcial } from './api'
import type { PedidoDaEntrega } from './ModaisEntrega'

/** Depois do gesto, o que a tela relê (o mesmo conjunto dos outros gestos da entrega). */
const CHAVES = [
  ['rotas'],
  ['programacao'],
  ['programadas'],
  ['entregas-do-dia'],
  ['estoque'],
  ['pedidos-lista'],
  ['pedido-ficha'],
  ['devolucoes'],
]

/**
 * SESSAO-41 (D-195, pedido do dono): "um pedido é composto por quatro móveis…
 * foi entregue apenas 3 deles e um retornou à fábrica". O entregador (ou a
 * logística) marca O QUE FOI ENTREGUE, escolhe um motivo da lista
 * (Configurações → Utilitários) e/ou escreve uma observação. As peças que não
 * foram marcadas voltam e esperam a decisão da logística, como numa
 * devolução. O Tiny não muda.
 */
export function ModalEntregaParcial({
  pedido,
  aoFechar,
}: {
  pedido: PedidoDaEntrega | null
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [entregues, setEntregues] = useState<number[] | null>(null)
  const [motivoId, setMotivoId] = useState<number | null>(null)
  const [observacao, setObservacao] = useState('')
  const [confirmarProducao, setConfirmarProducao] = useState<string | null>(null)

  const pecas = useQuery({
    queryKey: ['entrega-pecas', pedido?.card_id],
    queryFn: () => listarPecasDaEntrega(pedido!.card_id),
    enabled: pedido !== null,
    staleTime: 0,
  })
  const { data: motivos = [] } = useQuery({
    queryKey: ['motivos', 'entrega_parcial'],
    queryFn: () => listarMotivos('entrega_parcial'),
    enabled: pedido !== null,
    staleTime: 5 * 60_000,
  })
  // começa com todas marcadas: o comum é desmarcar só o que voltou
  const lista = pecas.data ?? []
  const marcadas = entregues ?? lista.map((p) => p.id)
  const voltaram = lista.filter((p) => !marcadas.includes(p.id))
  const temPorque = motivoId !== null || observacao.trim() !== ''
  const pode = marcadas.length > 0 && voltaram.length > 0 && temPorque

  const confirmar = useMutation({
    mutationFn: (confirmarIncompleto: boolean) =>
      registrarEntregaParcial({
        cardId: pedido!.card_id,
        entregues: marcadas,
        motivoId,
        observacao,
        confirmarIncompleto,
      }),
    onSuccess: async () => {
      notificar({
        titulo: `Pedido ${pedido?.numero}: entregue em parte (${marcadas.length} de ${lista.length})`,
        descricao: `${voltaram.length} peça(s) voltaram e esperam a decisão da logística.`,
        tom: 'perfeito',
      })
      fechar()
      await Promise.all(CHAVES.map((queryKey) => clienteQuery.invalidateQueries({ queryKey })))
    },
    onError: (erro) => {
      const mensagem = erro instanceof Error ? erro.message : ''
      // a plataforma pode estar atrasada (peça não arrastada): pede a confirmação
      if (/ainda aparece em produção/.test(mensagem)) setConfirmarProducao(mensagem)
      else
        notificar({
          titulo: 'Não deu para registrar a entrega parcial',
          descricao: mensagem,
          tom: 'danificado',
        })
    },
  })

  function fechar() {
    setEntregues(null)
    setMotivoId(null)
    setObservacao('')
    setConfirmarProducao(null)
    aoFechar()
  }

  return (
    <Modal
      aberto={pedido !== null}
      aoFechar={(v) => !v && fechar()}
      titulo={`Entrega parcial — pedido ${pedido?.numero ?? ''}`}
      descricao={pedido?.cliente_nome ?? undefined}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (pode) confirmar.mutate(confirmarProducao !== null)
        }}
      >
        <p className="text-sm text-texto-suave">
          Marque o que FOI ENTREGUE. O que ficar desmarcado volta para a fábrica e espera a decisão
          da logística (reenviar, estoque, outro pedido, danificados…). O Tiny não muda.
        </p>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium text-texto">O que foi entregue</legend>
          {pecas.isPending && <p className="text-sm text-texto-fraco">Carregando as peças…</p>}
          {pecas.isError && <p className="text-sm text-danificado-forte">{pecas.error.message}</p>}
          {lista.map((p) => (
            <label
              key={p.id}
              className="flex min-h-toque-md cursor-pointer items-center gap-3 rounded-dm px-1 text-sm text-texto hover:bg-superficie-sutil"
            >
              <input
                type="checkbox"
                className="size-6 shrink-0 accent-[var(--dm-acao)]"
                checked={marcadas.includes(p.id)}
                onChange={() =>
                  setEntregues(
                    marcadas.includes(p.id)
                      ? marcadas.filter((x) => x !== p.id)
                      : [...marcadas, p.id],
                  )
                }
              />
              <span className="flex min-w-0 flex-col">
                <span>
                  {p.descricao ?? 'Peça'}
                  {p.total && p.total > 1 ? ` (${p.indice}/${p.total})` : ''}
                </span>
                {!p.pronta && (
                  <span className="text-xs text-atencao-texto">
                    ainda aparece em produção{p.onde ? ` (${p.onde})` : ''}
                  </span>
                )}
              </span>
            </label>
          ))}
          {lista.length > 0 && (
            <p
              className={cn(
                'mt-1 text-sm',
                voltaram.length === 0 ? 'text-atencao-texto' : 'text-texto-suave',
              )}
            >
              {voltaram.length === 0
                ? 'Tudo marcado — se foi tudo entregue, use "Entregue".'
                : marcadas.length === 0
                  ? 'Nada marcado — se nada foi entregue, use "Não entregue".'
                  : `${marcadas.length} entregue(s) · ${voltaram.length} volta(m) para a fábrica`}
            </p>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-texto">Motivo</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {motivos.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={motivoId === m.id}
                onClick={() => setMotivoId(motivoId === m.id ? null : m.id)}
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
          rotulo="Observação"
          ajuda="Escolha um motivo ou escreva aqui — pelo menos um dos dois."
          placeholder="Ex.: a lateral do armário chegou rachada"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />

        {confirmarProducao && (
          <p className="flex items-start gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo p-3 text-sm text-atencao-texto">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {confirmarProducao} Confirme só se as peças estavam mesmo no caminhão.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Botao
            type="submit"
            icone={<PackageCheck />}
            disabled={!pode}
            carregando={confirmar.isPending}
          >
            {confirmarProducao ? 'Confirmar a entrega parcial' : 'Registrar entrega parcial'}
          </Botao>
          <Botao type="button" variante="secundaria" onClick={fechar}>
            Cancelar
          </Botao>
        </div>
      </form>
    </Modal>
  )
}
