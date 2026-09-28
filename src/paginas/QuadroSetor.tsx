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
  soltarCard,
} from '@/kanban/api'
import { acaoAoSoltar, setorConcluiProducao } from '@/kanban/arrasto'
import { useAgora } from '@/kanban/tempo'
import { usePedidosDosCards } from '@/kanban/componentes/usePedidosDosCards'
import { useColunasPaginadas } from '@/kanban/componentes/useColunasPaginadas'
import { QuadroKanban } from '@/kanban/componentes/QuadroKanban'
import { ModalMoverCard } from '@/kanban/componentes/ModalMoverCard'
import { ModalLinhaTempo } from '@/kanban/componentes/ModalLinhaTempo'
import { ModalParecer } from '@/kanban/componentes/ModalParecer'
import type {
  Card,
  Etapa,
  ExecucaoAberta,
  ParecerPendente,
  QualidadePendente,
} from '@/kanban/tipos'

const ATUALIZA_A_CADA = 20_000

/**
 * O quadro de um setor (RF-01): etapas internas como colunas, cards de
 * unidade. Quem vê: gente do setor e admin — o RLS garante por baixo, a tela
 * só evita a página vazia. Cada coluna pagina no servidor (SESSAO-22).
 *
 * SESSAO-24 (dono, 27/09 — "tudo arrastando, é mais rápido"): o quadro é SÓ
 * ARRASTO. Soltar na etapa de início inicia o tempo de quem arrastou (o
 * parecer de recebimento vem antes, quando a peça chegou marcada — D-09);
 * soltar numa etapa que leva a outro setor pergunta o estado da peça e a manda
 * adiante; o resto é só mover. O único botão é o "Concluir produção", e só
 * na LIMPEZA E EMBALAGEM.
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

  // SESSAO-24: o que o soltar precisa perguntar antes de ir ao banco.
  const [encaminhando, setEncaminhando] = useState<{ card: Card; etapa: Etapa } | null>(null)
  const [cardConcluir, setCardConcluir] = useState<Card | null>(null)
  const [cardParecer, setCardParecer] = useState<Card | null>(null)
  const [inicioDepoisDoParecer, setInicioDepoisDoParecer] = useState<{
    card: Card
    etapaId: number
  } | null>(null)
  const [cardLinhaTempo, setCardLinhaTempo] = useState<Card | null>(null)

  async function invalidarQuadro() {
    await Promise.all([
      clienteQuery.invalidateQueries({ queryKey: ['cards'] }),
      clienteQuery.invalidateQueries({ queryKey: ['execucoes'] }),
      clienteQuery.invalidateQueries({ queryKey: ['linha-tempo'] }),
      clienteQuery.invalidateQueries({ queryKey: ['qualidade-pendente'] }),
    ])
  }

  const mutacaoSoltar = useMutation({
    mutationFn: soltarCard,
    onSuccess: invalidarQuadro,
    onError: (excecao) => {
      notificar({
        titulo: 'Não deu para mover o card',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      })
      // O card volta para onde estava — o banco recusou a transação inteira.
      void invalidarQuadro()
    },
  })

  if (!carregando && !souAdmin && !vinculoAqui) return <Navigate to="/" replace />
  if (!perfil) return null
  if (!carregandoSetores && setores.length > 0 && !setor) return <Navigate to="/" replace />
  // O PCP tem quadro próprio, com a liberação de pedidos.
  if (setor?.codigo === 'pcp') return <Navigate to="/producao/pcp" replace />
  if (!setor) return null

  const terminal = setor.papel_no_fluxo === 'terminal'
  const podeGerirEtapas = souAdmin || vinculoAqui?.lider_do_setor === true
  const setorAtual = setor

  function aoSoltarNaEtapa(card: Card, etapaId: number | null) {
    const acao = acaoAoSoltar({ setor: setorAtual, etapas, card, etapaDestinoId: etapaId })
    if (acao.tipo === 'encaminhar') {
      // D-09: mandar a peça adiante pede o estado dela.
      setEncaminhando({ card, etapa: acao.etapa })
      return
    }
    if (acao.tipo === 'iniciar' && etapaId !== null && pareceresPorCard.has(card.id)) {
      // D-09 item 2: a peça chegou marcada — o recebimento vem antes do trabalho.
      setInicioDepoisDoParecer({ card, etapaId })
      setCardParecer(card)
      return
    }
    mutacaoSoltar.mutate({ card, etapaId })
  }

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
              ? 'Unidade que chega aqui está concluída.'
              : `${totalNoSetor} card${totalNoSetor === 1 ? '' : 's'} no setor. Arraste o card: na etapa de trabalho o seu tempo começa; nas etapas que levam a outro setor, ele segue para lá.`}
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
        setores={setores}
        aoSoltarNaEtapa={aoSoltarNaEtapa}
        aoAbrirConcluir={setorConcluiProducao(setor) ? setCardConcluir : undefined}
        execucao={{
          execucoesPorCard,
          nomesUsuarios,
          meuUsuarioId: perfil.id,
          gestoPendente: mutacaoSoltar.isPending,
          pareceresPorCard,
          aoLinhaTempo: setCardLinhaTempo,
        }}
      />

      <ModalMoverCard
        modo="encaminhar"
        card={encaminhando?.card ?? null}
        pedido={
          encaminhando?.card.pedido_id != null
            ? pedidosPorId.get(encaminhando.card.pedido_id)
            : undefined
        }
        etapaDestino={encaminhando?.etapa}
        setorDestinoNome={
          encaminhando?.etapa.setor_destino_id != null
            ? setores.find((s) => s.id === encaminhando.etapa.setor_destino_id)?.nome
            : undefined
        }
        executorNome={
          encaminhando?.card.executor_atual_id
            ? nomesUsuarios.get(encaminhando.card.executor_atual_id)
            : undefined
        }
        aoFechar={() => setEncaminhando(null)}
      />

      <ModalMoverCard
        modo="concluir"
        card={cardConcluir}
        pedido={cardConcluir?.pedido_id != null ? pedidosPorId.get(cardConcluir.pedido_id) : undefined}
        executorNome={
          cardConcluir?.executor_atual_id
            ? nomesUsuarios.get(cardConcluir.executor_atual_id)
            : undefined
        }
        aoFechar={() => setCardConcluir(null)}
      />

      <ModalLinhaTempo
        card={cardLinhaTempo}
        pedido={
          cardLinhaTempo?.pedido_id != null ? pedidosPorId.get(cardLinhaTempo.pedido_id) : undefined
        }
        aoFechar={() => setCardLinhaTempo(null)}
      />

      <ModalParecer
        card={cardParecer}
        pedido={cardParecer?.pedido_id != null ? pedidosPorId.get(cardParecer.pedido_id) : undefined}
        pendente={cardParecer ? (pareceresPorCard.get(cardParecer.id) ?? null) : null}
        aoFechar={() => {
          setCardParecer(null)
          setInicioDepoisDoParecer(null)
        }}
        aoRegistrado={(_card, estado) => {
          // 🟢/🟡 seguem o fluxo: o arrasto que motivou o parecer acontece na
          // sequência. 🔴 não — o card acabou de ir para DANIFICADO (D-09).
          const pendente = inicioDepoisDoParecer
          setInicioDepoisDoParecer(null)
          if (estado !== 'danificado' && pendente) mutacaoSoltar.mutate(pendente)
        }}
      />
    </div>
  )
}
