import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Flag, ListChecks } from 'lucide-react'
import { Botao, useNotificacao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import {
  buscarEtapasDoSetor,
  buscarExecucoesAbertas,
  buscarNomesUsuarios,
  buscarPareceresPendentes,
  buscarSetores,
  finalizarExecucao,
  iniciarExecucao,
  moverCard,
  pausarExecucao,
  retomarExecucao,
} from '@/kanban/api'
import { useAgora } from '@/kanban/tempo'
import { usePedidosDosCards } from '@/kanban/componentes/usePedidosDosCards'
import { useColunasPaginadas } from '@/kanban/componentes/useColunasPaginadas'
import { QuadroKanban } from '@/kanban/componentes/QuadroKanban'
import { ModalMoverCard } from '@/kanban/componentes/ModalMoverCard'
import { ModalLinhaTempo } from '@/kanban/componentes/ModalLinhaTempo'
import { ModalParecer } from '@/kanban/componentes/ModalParecer'
import type { Card, ExecucaoAberta, ParecerPendente, QualidadePendente } from '@/kanban/tipos'

const ATUALIZA_A_CADA = 20_000

/**
 * O quadro de um setor (RF-01): etapas internas como colunas, cards de
 * unidade, drag-and-drop (desktop) e botão "Mover" (tablet). Quem vê: gente
 * do setor e admin — o RLS garante por baixo, a tela só evita a página vazia.
 * Desde a SESSAO-05 os cards carregam Iniciar/Finalizar/Assumir (D-02/D-24) e
 * a linha do tempo. Desde a SESSAO-22, cada coluna pagina no servidor (a tela
 * só requisita o que mostra) e o líder pode pausar uma execução (D-48).
 */
export function QuadroSetor({ setorId }: { setorId: number }) {
  const { perfil, vinculos, carregando } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const agora = useAgora()

  const souAdmin = perfil?.papel === 'admin'
  const vinculoAqui = vinculos.find((v) => v.setor_id === setorId)

  const { data: setores = [], isPending: carregandoSetores } = useQuery({
    queryKey: ['setores'],
    queryFn: () => buscarSetores(),
  })
  const setor = setores.find((s) => s.id === setorId)

  const { data: etapas = [] } = useQuery({
    queryKey: ['etapas', setorId],
    queryFn: () => buscarEtapasDoSetor(setorId),
    enabled: Number.isFinite(setorId),
  })

  // SESSAO-22: cada coluna carrega só a própria página (10 por vez + "Ver mais").
  const { colunas, cards } = useColunasPaginadas({
    setorId: Number.isFinite(setorId) ? setorId : undefined,
    etapas,
    tipo: 'unidade',
    atualizaACada: ATUALIZA_A_CADA,
  })
  const totalNoSetor = [...colunas.values()].reduce((soma, c) => soma + c.total, 0)
  const { data: pedidosPorId = new Map() } = usePedidosDosCards(cards)

  // SESSAO-05: quem executa o quê, desde quando — e os nomes das pessoas.
  const idsDosCards = cards.map((c) => c.id)
  const { data: execucoes = [] } = useQuery({
    queryKey: ['execucoes', 'setor', setorId, idsDosCards.join(',')],
    queryFn: () => buscarExecucoesAbertas(idsDosCards),
    enabled: idsDosCards.length > 0,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: nomesUsuarios = new Map<string, string>() } = useQuery({
    queryKey: ['usuarios', 'nomes'],
    queryFn: buscarNomesUsuarios,
    staleTime: 5 * 60_000,
  })
  const execucoesPorCard = new Map<number, ExecucaoAberta>(
    execucoes.map((e) => [e.card_id, e]),
  )

  // SESSAO-06 (D-09): entregas marcadas esperando a confirmação deste setor.
  const { data: pendencias = new Map<number, QualidadePendente>() } = useQuery({
    queryKey: ['qualidade-pendente', setorId, idsDosCards.join(',')],
    queryFn: () => buscarPareceresPendentes(cards),
    enabled: idsDosCards.length > 0,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const pareceresPorCard = new Map<number, ParecerPendente>(
    [...pendencias.values()].map((p) => [
      p.card_id,
      {
        marcacaoEventoId: p.evento_marcacao_id,
        estado: p.estado_remetente,
        setorOrigemNome:
          setores.find((s) => s.id === p.setor_origem_id)?.nome ?? 'Setor anterior',
        remetenteNome: p.usuario_remetente_id
          ? (nomesUsuarios.get(p.usuario_remetente_id) ?? null)
          : null,
      },
    ]),
  )

  const [cardParaMover, setCardParaMover] = useState<Card | null>(null)
  // SESSAO-15: o mesmo modal serve para "Mover para…" e para "Concluir" (destino fixo: ESTOQUE).
  const [modoMover, setModoMover] = useState<'mover' | 'concluir'>('mover')
  const [cardLinhaTempo, setCardLinhaTempo] = useState<Card | null>(null)
  const [cardParecer, setCardParecer] = useState<Card | null>(null)

  async function invalidarQuadro() {
    await Promise.all([
      clienteQuery.invalidateQueries({ queryKey: ['cards'] }),
      clienteQuery.invalidateQueries({ queryKey: ['execucoes'] }),
      clienteQuery.invalidateQueries({ queryKey: ['linha-tempo'] }),
      clienteQuery.invalidateQueries({ queryKey: ['qualidade-pendente'] }),
    ])
  }

  function aoErroGesto(titulo: string) {
    return (excecao: unknown) =>
      notificar({
        titulo,
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      })
  }

  const mutacaoEtapa = useMutation({
    mutationFn: moverCard,
    onSuccess: invalidarQuadro,
    onError: aoErroGesto('Não deu para mover o card'),
  })
  const mutacaoIniciar = useMutation({
    mutationFn: iniciarExecucao,
    onSuccess: invalidarQuadro,
    onError: aoErroGesto('Não deu para iniciar'),
  })
  const mutacaoFinalizar = useMutation({
    mutationFn: finalizarExecucao,
    onSuccess: invalidarQuadro,
    onError: aoErroGesto('Não deu para finalizar'),
  })
  // SESSAO-22 (D-48): pausar é gesto de líder/admin; retomar, de quem executa.
  const mutacaoPausar = useMutation({
    mutationFn: pausarExecucao,
    onSuccess: invalidarQuadro,
    onError: aoErroGesto('Não deu para pausar'),
  })
  const mutacaoRetomar = useMutation({
    mutationFn: retomarExecucao,
    onSuccess: invalidarQuadro,
    onError: aoErroGesto('Não deu para retomar'),
  })
  const gestoPendente =
    mutacaoIniciar.isPending ||
    mutacaoFinalizar.isPending ||
    mutacaoEtapa.isPending ||
    mutacaoPausar.isPending ||
    mutacaoRetomar.isPending

  if (!carregando && !souAdmin && !vinculoAqui) return <Navigate to="/" replace />
  if (!perfil) return null
  if (!carregandoSetores && setores.length > 0 && !setor) return <Navigate to="/" replace />
  // O PCP tem quadro próprio, com a liberação de pedidos.
  if (setor?.codigo === 'pcp') return <Navigate to="/producao/pcp" replace />
  if (!setor) return null

  const terminal = setor.papel_no_fluxo === 'terminal'
  const podeGerirEtapas = souAdmin || vinculoAqui?.lider_do_setor === true
  const podePausar = souAdmin || vinculoAqui?.lider_do_setor === true

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-2xl sm:text-3xl">
            {setor.nome}
            {terminal && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-perfeito-fundo px-3 py-1 text-sm font-medium text-perfeito-texto">
                <Flag aria-hidden className="size-4" />
                fim de linha
              </span>
            )}
          </h1>
          <p className="mt-1 text-texto-suave">
            {/* D-13 (terminais) e D-02 (fila × execução) — código fora da tela (D-27). */}
            {terminal
              ? 'Unidade que chega aqui está concluída — o pedido reagrupa na Expedição.'
              : `${totalNoSetor} card${totalNoSetor === 1 ? '' : 's'} no setor. Iniciar e Finalizar contam o tempo de quem executa; a fila conta sozinha.`}
          </p>
        </div>
        {podeGerirEtapas && (
          <Link to={`/estrutura?setor=${setor.id}`}>
            <Botao variante="secundaria" icone={<ListChecks />}>
              Etapas do setor
            </Botao>
          </Link>
        )}
      </div>

      <QuadroKanban
        setor={setor}
        etapas={etapas}
        colunas={colunas}
        pedidosPorId={pedidosPorId}
        agora={agora}
        aoMoverParaEtapa={(card, etapaId) =>
          mutacaoEtapa.mutate({
            card,
            destinoSetorId: setor.id,
            destinoEtapaId: etapaId,
          })
        }
        aoAbrirMover={(card) => {
          setModoMover('mover')
          setCardParaMover(card)
        }}
        aoAbrirConcluir={
          terminal
            ? undefined
            : (card) => {
                setModoMover('concluir')
                setCardParaMover(card)
              }
        }
        execucao={{
          execucoesPorCard,
          nomesUsuarios,
          meuUsuarioId: perfil.id,
          gestoPendente,
          pareceresPorCard,
          aoIniciar: terminal
            ? undefined
            : (card) => {
                // D-09: com entrega marcada e sem parecer, o Iniciar passa
                // primeiro pela confirmação de recebimento (o banco também trava).
                if (pareceresPorCard.has(card.id)) setCardParecer(card)
                else mutacaoIniciar.mutate({ card, usuarioId: perfil.id })
              },
          aoFinalizar: terminal
            ? undefined
            : (card) => mutacaoFinalizar.mutate({ card, usuarioId: perfil.id }),
          aoPausar:
            terminal || !podePausar
              ? undefined
              : (card) => mutacaoPausar.mutate({ card, usuarioId: perfil.id }),
          aoRetomar: terminal
            ? undefined
            : (card) => {
                // Retomar: quem executa (ao finalizar a urgência), líder ou admin —
                // o banco valida de verdade.
                if (card.executor_atual_id === perfil.id || podePausar)
                  mutacaoRetomar.mutate({ card, usuarioId: perfil.id })
              },
          aoLinhaTempo: setCardLinhaTempo,
        }}
      />

      <ModalMoverCard
        card={cardParaMover}
        pedido={cardParaMover ? pedidosPorId.get(cardParaMover.pedido_id) : undefined}
        setores={setores}
        executorNome={
          cardParaMover?.executor_atual_id
            ? nomesUsuarios.get(cardParaMover.executor_atual_id)
            : undefined
        }
        modo={modoMover}
        aoFechar={() => setCardParaMover(null)}
      />

      <ModalLinhaTempo
        card={cardLinhaTempo}
        pedido={cardLinhaTempo ? pedidosPorId.get(cardLinhaTempo.pedido_id) : undefined}
        aoFechar={() => setCardLinhaTempo(null)}
      />

      <ModalParecer
        card={cardParecer}
        pedido={cardParecer ? pedidosPorId.get(cardParecer.pedido_id) : undefined}
        pendente={cardParecer ? (pareceresPorCard.get(cardParecer.id) ?? null) : null}
        aoFechar={() => setCardParecer(null)}
        aoRegistrado={(card, estado) => {
          // 🟢/🟡 seguem o fluxo: o Iniciar que motivou o parecer acontece na
          // sequência. 🔴 não — o card acabou de ir para DANIFICADO (D-09).
          if (estado !== 'danificado') mutacaoIniciar.mutate({ card, usuarioId: perfil.id })
        }}
      />
    </div>
  )
}
