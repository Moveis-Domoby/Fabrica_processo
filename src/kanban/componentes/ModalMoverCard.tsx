import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BadgeEstado,
  Botao,
  DESCRICAO_ESTADO,
  ESTADOS_QUALIDADE,
  Modal,
  ROTULO_ESTADO,
  useNotificacao,
} from '@/componentes/ui'
import type { Estado } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { concluirProducao, soltarCard } from '../api'
import { pedidoCancelado } from '../situacao'
import type { Card, Etapa, PedidoResumo } from '../tipos'
import { rotuloOrigemCard } from '../rotulos'

export interface ModalMoverCardProps {
  card: Card | null
  pedido?: PedidoResumo
  /**
   * SESSAO-24 — o quadro é por arrasto; este modal só pergunta o ESTADO da peça
   * (D-09: quem entrega marca):
   * - 'encaminhar': o card foi solto numa etapa que leva a outro setor;
   * - 'concluir': "Concluir produção" (só LIMPEZA E EMBALAGEM) — o banco decide
   *   o destino: Pedidos em aguardo (pedido vivo) ou ESTOQUE (sem dono). Só 🟢.
   */
  modo: 'encaminhar' | 'concluir'
  /** encaminhar: a coluna onde o card foi solto (a etapa que encaminha). */
  etapaDestino?: Etapa
  /** encaminhar: o nome do setor para onde a etapa leva. */
  setorDestinoNome?: string
  /** Nome de quem está executando o card agora (o aviso da D-24). */
  executorNome?: string
  /** Tablet compartilhado (SESSAO-07): o gesto sai em nome do operador do PIN. */
  operadorId?: string
  aoFechar: () => void
}

/**
 * A marcação do estado ao mandar a peça adiante (SESSAO-06/D-09 — lei): 3
 * botões grandes com ícone + texto; o setor que recebe confirma depois. Na
 * conclusão, só "Perfeito estado": Pedidos em aguardo e ESTOQUE só recebem
 * peça 🟢 — com defeito, a peça vai para o DANIFICADO do setor.
 */
export function ModalMoverCard({
  card,
  pedido,
  modo,
  etapaDestino,
  setorDestinoNome,
  executorNome,
  operadorId,
  aoFechar,
}: ModalMoverCardProps) {
  const concluir = modo === 'concluir'
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const estadosPermitidos: readonly Estado[] = concluir ? ['perfeito'] : ESTADOS_QUALIDADE

  const [estadoQualidade, setEstadoQualidade] = useState<Estado | null>(null)
  const [erro, setErro] = useState('')

  // Reinicia a cada card novo (ajuste de estado durante o render, sem effect).
  // Na conclusão só existe uma opção — ela já vem marcada (dono: "é mais rápido").
  const [cardAnterior, setCardAnterior] = useState<string | null>(null)
  const chaveAtual = card ? `${card.id}:${modo}:${etapaDestino?.id ?? ''}` : null
  if (chaveAtual !== cardAnterior) {
    setCardAnterior(chaveAtual)
    setEstadoQualidade(concluir ? 'perfeito' : null)
    setErro('')
  }

  const semPedido = card?.pedido_id === null
  const cancelado = !semPedido && pedidoCancelado(pedido?.situacao)

  async function invalidar() {
    await Promise.all([
      clienteQuery.invalidateQueries({ queryKey: ['cards'] }),
      clienteQuery.invalidateQueries({ queryKey: ['execucoes'] }),
      clienteQuery.invalidateQueries({ queryKey: ['expedicao'] }),
      clienteQuery.invalidateQueries({ queryKey: ['pedidos-aguardo'] }),
      clienteQuery.invalidateQueries({ queryKey: ['produtos-reservados'] }),
      clienteQuery.invalidateQueries({ queryKey: ['aguardo-contagens'] }),
      clienteQuery.invalidateQueries({ queryKey: ['estoque'] }),
      clienteQuery.invalidateQueries({ queryKey: ['qualidade-pendente'] }),
      clienteQuery.invalidateQueries({ queryKey: ['linha-tempo'] }),
    ])
  }

  const mutacao = useMutation({
    mutationFn: async (estado: Estado) => {
      if (!card) throw new Error('Card não encontrado.')
      if (concluir) return concluirProducao({ card, estadoQualidade: estado, operadorId })
      if (!etapaDestino) throw new Error('Etapa de destino não encontrada.')
      await soltarCard({ card, etapaId: etapaDestino.id, estadoQualidade: estado, operadorId })
      return null
    },
    onSuccess: async (destino, estado) => {
      notificar({
        titulo: concluir
          ? destino === 'aguardo'
            ? `Peça concluída — está em Pedidos em aguardo (${rotuloOrigemCard(card!, pedido)})`
            : 'Peça concluída — está no ESTOQUE, sem dono, aguardando a venda'
          : `Card mandado para ${setorDestinoNome ?? 'o próximo setor'}`,
        descricao: concluir
          ? undefined
          : `Peça entregue como ${ROTULO_ESTADO[estado].toLowerCase()} — o setor que recebe confirma.`,
        tom: 'perfeito',
      })
      aoFechar()
      await invalidar()
    },
    onError: (excecao) =>
      setErro(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.'),
  })

  function aoConfirmar() {
    if (!card) return
    if (estadoQualidade === null) {
      // D-09: marcação obrigatória ao mandar a peça adiante — código fora da tela (D-27).
      setErro('Marque o estado da peça.')
      return
    }
    setErro('')
    mutacao.mutate(estadoQualidade)
  }

  const kn =
    card && card.indice_unidade !== null ? ` (${card.indice_unidade}/${card.total_unidades})` : ''

  return (
    <Modal
      aberto={card !== null}
      aoFechar={(aberto) => {
        if (!aberto) aoFechar()
      }}
      titulo={concluir ? 'Concluir produção' : `Mandar para ${setorDestinoNome ?? 'o próximo setor'}`}
      descricao={
        card
          ? `${card.item_descricao ?? 'Card'}${kn} · ${rotuloOrigemCard(card, pedido)}`
          : undefined
      }
      rodape={
        <>
          <Botao variante="secundaria" tamanho="lg" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao tamanho="lg" carregando={mutacao.isPending} onClick={aoConfirmar}>
            {concluir ? 'Concluir' : 'Mandar'}
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {concluir && (
          <p className="rounded-dm bg-superficie-sutil px-3 py-2 text-sm text-texto">
            {semPedido ? (
              <>
                A peça da reposição está pronta: vai para o <strong>ESTOQUE</strong> e fica{' '}
                <strong>livre</strong>, aguardando a venda.
              </>
            ) : cancelado ? (
              <>
                O pedido desta peça foi <strong>cancelado no Tiny</strong>: pronta, ela vai para o{' '}
                <strong>ESTOQUE, sem dono</strong> — e pode ser usada num próximo pedido igual.
              </>
            ) : (
              <>
                A peça está pronta: vai para <strong>Pedidos em aguardo</strong>, reservada para o
                pedido. Quando todas as unidades estiverem prontas, a logística lança o pedido para
                as ROTAS.
              </>
            )}{' '}
            Só sai peça em perfeito estado — com defeito, arraste para o DANIFICADO do setor.
          </p>
        )}
        {card?.executor_atual_id && (
          <p className="rounded-dm bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto">
            Este card está <strong>em execução{executorNome ? ` por ${executorNome}` : ''}</strong>.
            {/* D-24: mandar adiante nunca bloqueia; encerra a execução aberta. */}
            {' '}Mandar adiante encerra o tempo agora — ele conta até este momento.
          </p>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-texto">
            Em que estado a peça está saindo? <span aria-hidden>*</span>
          </legend>
          <p className="text-xs text-texto-suave">
            {concluir
              ? 'Pedidos em aguardo e ESTOQUE só recebem peça em perfeito estado.'
              : `Obrigatório para mandar. ${setorDestinoNome ?? 'O setor que recebe'} vai confirmar.`}
          </p>
          {estadosPermitidos.map((estado) => (
            <button
              key={estado}
              type="button"
              role="radio"
              aria-checked={estadoQualidade === estado}
              onClick={() => {
                setEstadoQualidade(estado)
                setErro('')
              }}
              className={cn(
                'toque-seguro flex min-h-toque-lg items-center gap-3 rounded-dm border-2 px-3 py-2 text-left transition-colors',
                estadoQualidade === estado
                  ? 'border-acao-ativa bg-superficie-sutil'
                  : 'border-borda bg-superficie hover:border-borda-forte',
              )}
            >
              <BadgeEstado estado={estado} tamanho="md" />
              <span className="text-xs text-texto-suave">{DESCRICAO_ESTADO[estado]}</span>
            </button>
          ))}
        </fieldset>

        {erro && (
          <p className="text-sm text-danificado-forte" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
