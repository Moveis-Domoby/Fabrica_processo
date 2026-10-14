import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BadgeEstado,
  Botao,
  Campo,
  DESCRICAO_ESTADO,
  ESTADOS_QUALIDADE,
  Modal,
  ROTULO_ESTADO,
  useNotificacao,
} from '@/componentes/ui'
import type { Estado } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { buscarChegadaPendente, registrarParecer } from '../api'
import type { Card, ParecerPendente, PedidoResumo, Setor } from '../tipos'
import { rotuloOrigemCard } from '../rotulos'

export interface ModalParecerProps {
  /** O card com a chegada pendente (`parecer_pendente_id` — D-126). */
  card: Card | null
  pedido?: PedidoResumo
  /** Para dizer DE ONDE a peça veio (cache de referência — nada a mais no banco). */
  setores?: Setor[]
  /** id → nome, para dizer quem entregou. */
  nomesUsuarios?: Map<string, string>
  /** Tablet compartilhado (SESSAO-07): o parecer sai em nome do operador do PIN. */
  operadorId?: string
  aoFechar: () => void
  /** Chamado depois do parecer registrado, com o estado escolhido — o quadro
   *  decide se segue direto para o Iniciar (🟢/🟡) ou não (🔴 → DANIFICADO). */
  aoRegistrado?: (card: Card, estado: Estado) => void
}

/**
 * A segunda metade da dupla atestação (SESSAO-06 / D-09): antes do primeiro
 * Iniciar no setor, quem recebe responde "o setor X marcou como Y — você
 * concorda?". Divergência NÃO trava nada — vira registro e aviso automático à
 * liderança; 🔴 leva o card à etapa DANIFICADO sozinho (regras do banco).
 *
 * SESSAO-31 (D-126): só aparece quando o setor pede o estado na chegada; se
 * ninguém marcou na saída, a pergunta é "em que estado a peça chegou?". A
 * chegada é lida só quando o modal abre (dado escondido só no clique — Lei §3).
 */
export function ModalParecer({
  card,
  pedido,
  setores = [],
  nomesUsuarios,
  operadorId,
  aoFechar,
  aoRegistrado,
}: ModalParecerProps) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const [estado, setEstado] = useState<Estado | null>(null)
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')

  // Reinicia a cada card novo (ajuste durante o render, sem effect).
  const [cardAnterior, setCardAnterior] = useState<number | null>(null)
  if ((card?.id ?? null) !== cardAnterior) {
    setCardAnterior(card?.id ?? null)
    setEstado(null)
    setObservacao('')
    setErro('')
  }

  const chegadaId = card?.parecer_pendente_id ?? null
  const { data: chegada, error: erroChegada } = useQuery({
    queryKey: ['chegada-pendente', chegadaId],
    queryFn: () => buscarChegadaPendente(chegadaId!),
    enabled: chegadaId !== null,
    staleTime: Infinity,
  })
  const pendente: ParecerPendente | null =
    chegada && chegadaId !== null
      ? {
          marcacaoEventoId: chegadaId,
          estado: chegada.tipo === 'qualidade_marcada' ? chegada.estado_qualidade : null,
          setorOrigemNome:
            setores.find((s) => s.id === chegada.setor_origem_id)?.nome ?? 'o setor anterior',
          remetenteNome:
            chegada.tipo === 'qualidade_marcada' && chegada.usuario_id
              ? (nomesUsuarios?.get(chegada.usuario_id) ?? null)
              : null,
        }
      : null

  const divergente =
    pendente !== null && pendente.estado !== null && estado !== null && estado !== pendente.estado

  const mutacao = useMutation({
    mutationFn: registrarParecer,
    onSuccess: async (_dados, variaveis) => {
      const escolhido = variaveis.estado
      notificar({
        titulo:
          escolhido === 'danificado'
            ? 'Dano registrado — card foi para DANIFICADO'
            : 'Recebimento confirmado',
        descricao:
          escolhido === 'danificado'
            ? 'A liderança foi avisada automaticamente.'
            : divergente
              ? 'Divergência registrada e liderança avisada — o card segue normal.'
              : undefined,
        tom: escolhido === 'danificado' ? 'atencao' : 'perfeito',
      })
      const cardAtual = card
      aoFechar()
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['cards'] }),
        clienteQuery.invalidateQueries({ queryKey: ['etapas'] }),
        clienteQuery.invalidateQueries({ queryKey: ['linha-tempo'] }),
      ])
      if (cardAtual) aoRegistrado?.(cardAtual, escolhido)
    },
    onError: (excecao) =>
      setErro(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.'),
  })

  function aoConfirmar() {
    if (!card || !pendente) return
    if (estado === null) {
      setErro('Escolha o estado que você enxerga na peça.')
      return
    }
    setErro('')
    mutacao.mutate({
      marcacaoEventoId: pendente.marcacaoEventoId,
      estado,
      observacao: observacao || undefined,
      operadorId,
    })
  }

  const kn =
    card && card.indice_unidade !== null ? ` (${card.indice_unidade}/${card.total_unidades})` : ''

  return (
    <Modal
      aberto={card !== null && chegadaId !== null}
      aoFechar={(aberto) => {
        if (!aberto) aoFechar()
      }}
      titulo="Confirmar recebimento"
      descricao={
        card
          ? `${card.item_descricao ?? 'Card'}${kn} · ${rotuloOrigemCard(card, pedido)}`
          : undefined
      }
      rodape={
        <>
          <Botao variante="secundaria" tamanho="lg" onClick={aoFechar}>
            Agora não
          </Botao>
          <Botao tamanho="lg" carregando={mutacao.isPending} onClick={aoConfirmar}>
            Registrar parecer
          </Botao>
        </>
      }
    >
      {erroChegada && (
        <p className="text-sm text-danificado-forte" role="alert">
          {erroChegada instanceof Error ? erroChegada.message : 'Não deu para carregar a chegada.'}
        </p>
      )}
      {!pendente && !erroChegada && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {pendente && (
        <div className="flex flex-col gap-4">
          {pendente.estado !== null ? (
            <p className="flex flex-wrap items-center gap-2 rounded-dm bg-superficie-sutil px-3 py-2 text-sm text-texto">
              O setor <strong>{pendente.setorOrigemNome}</strong>
              {pendente.remetenteNome ? ` (${pendente.remetenteNome})` : ''} marcou como
              <BadgeEstado estado={pendente.estado} tamanho="sm" />— você concorda?
            </p>
          ) : (
            <p className="rounded-dm bg-superficie-sutil px-3 py-2 text-sm text-texto">
              A peça chegou de <strong>{pendente.setorOrigemNome}</strong>. Este setor confirma o
              estado na chegada — em que estado ela chegou?
            </p>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-texto">
              Como VOCÊ vê a peça que chegou?
            </legend>
            {ESTADOS_QUALIDADE.map((opcao) => (
              <button
                key={opcao}
                type="button"
                role="radio"
                aria-checked={estado === opcao}
                onClick={() => {
                  setEstado(opcao)
                  setErro('')
                }}
                className={cn(
                  'toque-seguro flex min-h-toque-lg items-center gap-3 rounded-dm border-2 px-3 py-2 text-left transition-colors',
                  estado === opcao
                    ? 'border-acao-ativa bg-superficie-sutil'
                    : 'border-borda bg-superficie hover:border-borda-forte',
                )}
              >
                <BadgeEstado estado={opcao} tamanho="md" />
                <span className="flex flex-col text-xs text-texto-suave">
                  {opcao === pendente.estado && (
                    <span className="font-medium text-texto">
                      Concordo com {pendente.setorOrigemNome}
                    </span>
                  )}
                  {DESCRICAO_ESTADO[opcao]}
                </span>
              </button>
            ))}
          </fieldset>

          {divergente && pendente.estado !== null && (
            <p className="rounded-dm bg-atencao-fundo px-3 py-2 text-xs text-atencao-texto">
              Você vê diferente do que {pendente.setorOrigemNome} marcou (
              {ROTULO_ESTADO[pendente.estado].toLowerCase()}). A divergência fica registrada e a
              liderança é avisada — o card segue o fluxo normal.
            </p>
          )}

          <Campo
            rotulo="Observação"
            ajuda="Opcional: o que você viu (fica na história do card)."
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />

          {erro && (
            <p className="text-sm text-danificado-forte" role="alert">
              {erro}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
