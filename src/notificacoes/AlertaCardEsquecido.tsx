import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlarmClock, Pause, UserCheck } from 'lucide-react'
import { Botao, Modal, useNotificacao } from '@/componentes/ui'
import { responderCardEsquecido, textoDaResposta } from '@/kanban/cardEsquecido'
import { buscarAvisos } from './api'
import type { Aviso } from './api'

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/**
 * SESSAO-41 · ajuste do dono (D-198): o CARD ESQUECIDO é uma notificação de
 * URGÊNCIA — "uma notificação para a pessoa e para o admin perguntando se ainda
 * tem alguém nesse card". Abre sozinho quando o aviso chega (pelo canal ao vivo
 * do sino — nada de relógio) e pelo toque no aviso do sino (`?esquecidos=1`).
 * Lê o MESMO cache do sino: nenhum pedido a mais (Lei §3). Responde quem está
 * logado (quem está no card, o líder ou o admin — a trava é do banco).
 */
export function AlertaCardEsquecido({ usuarioId }: { usuarioId: string }) {
  const clienteQuery = useQueryClient()
  const notificar = useNotificacao()
  const [parametros, setParametros] = useSearchParams()
  const peloSino = parametros.get('esquecidos') === '1'
  const [dispensados, setDispensados] = useState<Set<number>>(() => new Set())

  const { data: avisos = [] } = useQuery({
    queryKey: ['avisos', usuarioId],
    queryFn: () => buscarAvisos(usuarioId, 20),
    enabled: false,
    staleTime: Infinity,
  })
  // um por card (o mais novo): o "Sim" de antes já foi lido
  const abertos = avisos.filter(
    (a, i, todos): a is Aviso & { card_id: number } =>
      a.tipo === 'card_esquecido' &&
      a.lida_em === null &&
      a.card_id !== null &&
      todos.findIndex((b) => b.tipo === 'card_esquecido' && b.card_id === a.card_id) === i,
  )
  const aberto = abertos.length > 0 && (peloSino || abertos.some((a) => !dispensados.has(a.id)))

  function marcarLido(cardId: number) {
    const agora = new Date().toISOString()
    clienteQuery.setQueryData<Aviso[]>(['avisos', usuarioId], (atual) =>
      atual?.map((a) =>
        a.tipo === 'card_esquecido' && a.card_id === cardId && a.lida_em === null
          ? { ...a, lida_em: agora }
          : a,
      ),
    )
  }

  function fechar() {
    setDispensados(new Set([...dispensados, ...abertos.map((a) => a.id)]))
    if (peloSino) {
      const sem = new URLSearchParams(parametros)
      sem.delete('esquecidos')
      setParametros(sem, { replace: true })
    }
  }

  const responder = useMutation({
    mutationFn: ({ cardId, aindaTem }: { cardId: number; aindaTem: boolean }) =>
      responderCardEsquecido({ cardId, aindaTem }),
    onSuccess: (resposta, { cardId }) => {
      notificar({
        titulo: textoDaResposta(resposta),
        tom: resposta.situacao === 'respondido' ? 'informativo' : 'perfeito',
      })
      // o banco já marcou os avisos do card como lidos (de todo mundo)
      marcarLido(cardId)
      void clienteQuery.invalidateQueries({ queryKey: ['quadro'] })
    },
    onError: (erro) => notificar({ titulo: erro.message, tom: 'danificado' }),
  })

  return (
    <Modal
      aberto={aberto}
      aoFechar={(abrir) => !abrir && fechar()}
      titulo="Urgente: ainda tem alguém neste card?"
      descricao="O card está rodando há 2 h sem parar. Se ninguém está nele, pause: o card para na hora do aviso e o tempo depois disso não conta como trabalho."
      rodape={
        <Botao variante="fantasma" onClick={fechar}>
          Responder depois
        </Botao>
      }
    >
      <ul className="flex flex-col gap-3">
        {abertos.map((a) => (
          <li
            key={a.id}
            className="flex flex-col gap-3 rounded-dm-lg border border-atencao-borda bg-atencao-fundo p-3"
          >
            <div className="flex items-start gap-3">
              <AlarmClock aria-hidden className="mt-0.5 size-5 shrink-0 text-atencao-texto" />
              <div className="min-w-0">
                <p className="text-sm text-texto">{a.corpo}</p>
                <p className="mt-1 text-xs text-texto-suave">Aviso das {hora(a.criada_em)}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Botao
                icone={<UserCheck />}
                larguraTotal
                disabled={responder.isPending}
                onClick={() => responder.mutate({ cardId: a.card_id, aindaTem: true })}
              >
                Sim, ainda tem gente
              </Botao>
              <Botao
                variante="secundaria"
                icone={<Pause />}
                larguraTotal
                disabled={responder.isPending}
                onClick={() => responder.mutate({ cardId: a.card_id, aindaTem: false })}
              >
                Não, pausar o card
              </Botao>
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
