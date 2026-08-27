import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Botao, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarEtapasDoSetor, moverCard } from '../api'
import type { Card, PedidoResumo, Setor } from '../tipos'

export interface ModalMoverCardProps {
  card: Card | null
  pedido?: PedidoResumo
  setores: Setor[]
  aoFechar: () => void
}

/**
 * "Mover para…" — o gesto de movimentação do tablet (a demanda exige os dois:
 * drag-and-drop no desktop E botão no tablet). Destino livre (D-22): qualquer
 * setor ativo, inclusive mudar de etapa dentro do setor atual. A atestação de
 * qualidade da transição (D-09) pluga aqui na SESSAO-06.
 */
export function ModalMoverCard({ card, pedido, setores, aoFechar }: ModalMoverCardProps) {
  const { perfil } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  // Radix Select não aceita item com valor vazio — 'chegada' é o sentinela
  // para "sem etapa" (a coluna fixa de todo setor).
  const CHEGADA = 'chegada'
  const [setorDestinoId, setSetorDestinoId] = useState<string>('')
  const [etapaDestinoId, setEtapaDestinoId] = useState<string>(CHEGADA)
  const [erro, setErro] = useState('')

  // Reinicia a escolha a cada card novo (ajuste de estado durante o render,
  // como recomenda a doc do React — nada de effect para isso).
  const [cardAnterior, setCardAnterior] = useState<number | null>(null)
  if ((card?.id ?? null) !== cardAnterior) {
    setCardAnterior(card?.id ?? null)
    setSetorDestinoId('')
    setEtapaDestinoId(CHEGADA)
    setErro('')
  }

  const setorEscolhido = setores.find((s) => String(s.id) === setorDestinoId)

  const { data: etapasDestino = [] } = useQuery({
    queryKey: ['etapas', setorEscolhido?.id ?? 0],
    queryFn: () => buscarEtapasDoSetor(setorEscolhido!.id),
    enabled: setorEscolhido !== undefined,
  })

  const mutacao = useMutation({
    mutationFn: moverCard,
    onSuccess: async (_dados, variaveis) => {
      const destino = setores.find((s) => s.id === variaveis.destinoSetorId)
      notificar({
        titulo: `Card movido para ${destino?.nome ?? 'o destino'}`,
        tom: 'perfeito',
      })
      aoFechar()
      await clienteQuery.invalidateQueries({ queryKey: ['cards'] })
      await clienteQuery.invalidateQueries({ queryKey: ['expedicao'] })
    },
    onError: (excecao) =>
      setErro(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.'),
  })

  function aoConfirmar() {
    if (!card || !perfil) return
    if (!setorEscolhido) {
      setErro('Escolha o setor de destino.')
      return
    }
    const etapaEscolhida = etapaDestinoId === CHEGADA ? null : Number(etapaDestinoId)
    const mesmoLugar =
      setorEscolhido.id === card.setor_atual_id && etapaEscolhida === card.etapa_atual_id
    if (mesmoLugar) {
      setErro('O card já está aí — escolha outro destino.')
      return
    }
    setErro('')
    mutacao.mutate({
      card,
      destinoSetorId: setorEscolhido.id,
      destinoEtapaId: etapaEscolhida,
      usuarioId: perfil.id,
    })
  }

  const kn =
    card && card.indice_unidade !== null ? ` (${card.indice_unidade}/${card.total_unidades})` : ''

  return (
    <Modal
      aberto={card !== null}
      aoFechar={(aberto) => {
        if (!aberto) aoFechar()
      }}
      titulo="Mover para…"
      descricao={
        card
          ? `${card.item_descricao ?? 'Card'}${kn} · Pedido ${pedido?.numero ?? card.pedido_id}`
          : undefined
      }
      rodape={
        <>
          <Botao variante="secundaria" tamanho="lg" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao tamanho="lg" carregando={mutacao.isPending} onClick={aoConfirmar}>
            Mover
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Selecao
          rotulo="Setor de destino"
          tamanho="galpao"
          opcoes={setores.map((s) => ({
            valor: String(s.id),
            rotulo: s.id === card?.setor_atual_id ? `${s.nome} (setor atual)` : s.nome,
          }))}
          valor={setorDestinoId || undefined}
          aoMudar={(v) => {
            setSetorDestinoId(v)
            setEtapaDestinoId('')
          }}
        />

        {setorEscolhido && etapasDestino.length > 0 && (
          <Selecao
            rotulo="Etapa"
            tamanho="galpao"
            ajuda="Sem escolher, o card entra na Chegada do setor."
            opcoes={[
              { valor: CHEGADA, rotulo: 'Chegada (sem etapa)' },
              ...etapasDestino.map((e) => ({
                valor: String(e.id),
                rotulo: e.eh_fila ? `${e.nome} (fila)` : e.nome,
              })),
            ]}
            valor={etapaDestinoId}
            aoMudar={setEtapaDestinoId}
          />
        )}

        {erro && (
          <p className="text-sm text-danificado-forte" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
