import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BadgeEstado,
  Botao,
  DESCRICAO_ESTADO,
  ESTADOS_QUALIDADE,
  Modal,
  ROTULO_ESTADO,
  Selecao,
  useNotificacao,
} from '@/componentes/ui'
import type { Estado } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarEtapasDoSetor, moverCard } from '../api'
import type { Card, PedidoResumo, Setor } from '../tipos'

export interface ModalMoverCardProps {
  card: Card | null
  pedido?: PedidoResumo
  setores: Setor[]
  /** Nome de quem está executando o card agora (para o aviso da D-24). */
  executorNome?: string
  aoFechar: () => void
}

/**
 * "Mover para…" — o gesto de movimentação do tablet (a demanda exige os dois:
 * drag-and-drop no desktop E botão no tablet). Destino livre (D-22): qualquer
 * setor ativo, inclusive mudar de etapa dentro do setor atual.
 *
 * SESSAO-06 (D-09): saindo de setor de PRODUÇÃO para outro setor, a marcação
 * do estado da peça é obrigatória — sem marcar, não move. Saída do PCP não
 * exige (a peça ainda nem foi produzida — D-25); mudança de etapa dentro do
 * mesmo setor também não.
 */
export function ModalMoverCard({
  card,
  pedido,
  setores,
  executorNome,
  aoFechar,
}: ModalMoverCardProps) {
  const { perfil } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  // Radix Select não aceita item com valor vazio — 'chegada' é o sentinela
  // para "sem etapa" (a coluna fixa de todo setor).
  const CHEGADA = 'chegada'
  const [setorDestinoId, setSetorDestinoId] = useState<string>('')
  const [etapaDestinoId, setEtapaDestinoId] = useState<string>(CHEGADA)
  const [estadoQualidade, setEstadoQualidade] = useState<Estado | null>(null)
  const [erro, setErro] = useState('')

  // Reinicia a escolha a cada card novo (ajuste de estado durante o render,
  // como recomenda a doc do React — nada de effect para isso).
  const [cardAnterior, setCardAnterior] = useState<number | null>(null)
  if ((card?.id ?? null) !== cardAnterior) {
    setCardAnterior(card?.id ?? null)
    setSetorDestinoId('')
    setEtapaDestinoId(CHEGADA)
    setEstadoQualidade(null)
    setErro('')
  }

  const setorAtual = setores.find((s) => s.id === card?.setor_atual_id)
  const setorEscolhido = setores.find((s) => String(s.id) === setorDestinoId)

  // D-09/D-25: a marcação é da transição ENTRE setores, saindo de produção.
  const exigeQualidade =
    setorAtual?.papel_no_fluxo === 'producao' &&
    setorEscolhido !== undefined &&
    setorEscolhido.id !== card?.setor_atual_id

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
        descricao: variaveis.estadoQualidade
          ? `Peça entregue como ${ROTULO_ESTADO[variaveis.estadoQualidade].toLowerCase()} — o setor que recebe confirma (D-09).`
          : undefined,
        tom: 'perfeito',
      })
      aoFechar()
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['cards'] }),
        clienteQuery.invalidateQueries({ queryKey: ['expedicao'] }),
        clienteQuery.invalidateQueries({ queryKey: ['qualidade-pendente'] }),
        clienteQuery.invalidateQueries({ queryKey: ['linha-tempo'] }),
      ])
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
    if (exigeQualidade && estadoQualidade === null) {
      setErro('Marque o estado da peça para mover (D-09).')
      return
    }
    setErro('')
    mutacao.mutate({
      card,
      destinoSetorId: setorEscolhido.id,
      destinoEtapaId: etapaEscolhida,
      estadoQualidade: exigeQualidade ? estadoQualidade : null,
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
        {card?.executor_atual_id && (
          <p className="rounded-dm bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto">
            Este card está <strong>em execução{executorNome ? ` por ${executorNome}` : ''}</strong>.
            Mover encerra a execução agora — o tempo conta até este momento (D-24).
          </p>
        )}
        <Selecao
          rotulo="Setor de destino"
          tamanho="galpao"
          opcoes={setores.map((s) => ({
            valor: String(s.id),
            rotulo: s.id === card?.setor_atual_id ? `${s.nome} (setor atual)` : s.nome,
          }))}
          valor={setorDestinoId}
          aoMudar={(v) => {
            setSetorDestinoId(v)
            setEtapaDestinoId(CHEGADA)
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

        {exigeQualidade && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-texto">
              Em que estado a peça está saindo? <span aria-hidden>*</span>
            </legend>
            <p className="text-xs text-texto-suave">
              Obrigatório para mover (D-09). O setor que recebe vai confirmar.
            </p>
            {ESTADOS_QUALIDADE.map((estado) => (
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
