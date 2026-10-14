import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Flag, ListChecks } from 'lucide-react'
import { Botao, useNotificacao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarSetores, soltarCard } from '@/kanban/api'
import { acaoAoSoltar, pedeEstadoAoEnviar } from '@/kanban/arrasto'
import { useAgora } from '@/kanban/tempo'
import { useQuadro } from '@/kanban/useQuadro'
import { useAbrirCard } from '@/kanban/janela/abrirCard'
import { QuadroKanban } from '@/kanban/componentes/QuadroKanban'
import { ModalMoverCard } from '@/kanban/componentes/ModalMoverCard'
import { ModalLinhaTempo } from '@/kanban/componentes/ModalLinhaTempo'
import { ModalParecer } from '@/kanban/componentes/ModalParecer'
import { ModalConcluirAvulso } from '@/kanban/componentes/ModalConcluirAvulso'
import type { Card, Etapa } from '@/kanban/tipos'
import { textoPecaConcluida } from '@/kanban/situacaoPlataforma'

/**
 * O quadro de um setor (RF-01): etapas internas como colunas, cards de
 * unidade. Quem vê: gente do setor e admin — o RLS garante por baixo, a tela
 * só evita a página vazia. Cada coluna pagina no servidor (SESSAO-22).
 *
 * SESSAO-24 (dono, 27/09 — "tudo arrastando, é mais rápido"): o quadro é SÓ
 * ARRASTO. Soltar na etapa de início inicia o tempo de quem arrastou (a
 * confirmação de recebimento vem antes, quando o setor pede o estado na
 * chegada — D-126); soltar numa etapa que leva a outro setor manda a peça
 * adiante (perguntando o estado só quando o setor pede ao enviar); soltar na
 * EXPEDIÇÃO da LIMPEZA E EMBALAGEM conclui a produção (D-127); o resto é só
 * mover.
 *
 * SESSAO-31 (Lei §2/§4 — regra 18): o quadro abre com UMA requisição e fica ao
 * vivo pelo websocket do setor (useQuadro) — sem relógio. O card avulso
 * (D-125) anda igual e tem o botão "Concluir".
 */
export function QuadroSetor({ setorId }: { setorId: number }) {
  const { perfil, vinculos, carregando } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const agora = useAgora()
  const abrirCard = useAbrirCard()

  const souAdmin = perfil?.papel === 'admin'
  const vinculoAqui = vinculos.find((v) => v.setor_id === setorId)

  const { data: setores = [], isPending: carregandoSetores } = useQuery({
    queryKey: ['setores'],
    queryFn: () => buscarSetores(),
  })
  const setor = setores.find((s) => s.id === setorId)

  // SESSAO-31: o quadro inteiro numa requisição e ao vivo pelo websocket do setor.
  const quadro = useQuadro(Number.isFinite(setorId) ? setorId : undefined)
  const { etapas, colunas, pedidosPorId, execucoesPorCard, nomesUsuarios, pessoas, camposPorCard } =
    quadro
  const totalNoSetor = [...colunas.values()].reduce((soma, c) => soma + c.total, 0)

  // SESSAO-24: o que o soltar precisa perguntar antes de ir ao banco.
  const [encaminhando, setEncaminhando] = useState<{ card: Card; etapa: Etapa } | null>(null)
  const [concluindo, setConcluindo] = useState<{ card: Card; etapa: Etapa } | null>(null)
  const [cardParecer, setCardParecer] = useState<Card | null>(null)
  const [inicioDepoisDoParecer, setInicioDepoisDoParecer] = useState<{
    card: Card
    etapaId: number
  } | null>(null)
  const [cardLinhaTempo, setCardLinhaTempo] = useState<Card | null>(null)
  const [concluindoAvulso, setConcluindoAvulso] = useState<Card | null>(null)

  // Com o websocket conectado, o próprio aviso do setor relê o quadro (1 vez);
  // sem ele, a tela relê por conta própria.
  async function invalidarQuadro(forcar = false) {
    await Promise.all([
      forcar || !quadro.conectado ? quadro.reler() : Promise.resolve(),
      clienteQuery.invalidateQueries({ queryKey: ['linha-tempo'] }),
    ])
  }

  const mutacaoSoltar = useMutation({
    mutationFn: soltarCard,
    onSuccess: async (resultado) => {
      // SESSAO-31 (D-127): a EXPEDIÇÃO concluiu — diz para onde a peça foi.
      if (resultado.acao === 'concluido') {
        notificar({
          titulo: textoPecaConcluida(resultado.destino),
          tom: 'perfeito',
        })
        await Promise.all([
          clienteQuery.invalidateQueries({ queryKey: ['pedidos-aguardo'] }),
          clienteQuery.invalidateQueries({ queryKey: ['produtos-reservados'] }),
          clienteQuery.invalidateQueries({ queryKey: ['aguardo-contagens'] }),
          clienteQuery.invalidateQueries({ queryKey: ['estoque'] }),
        ])
      }
      await invalidarQuadro()
    },
    onError: (excecao) => {
      notificar({
        titulo: 'Não deu para mover o card',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      })
      // O card volta para onde estava — o banco recusou a transação inteira.
      void invalidarQuadro(true)
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
    // SESSAO-31 (D-126): o estado da peça só é perguntado quando o setor pede ao enviar.
    if (acao.tipo === 'encaminhar' && pedeEstadoAoEnviar(setorAtual, card)) {
      setEncaminhando({ card, etapa: acao.etapa })
      return
    }
    if (
      acao.tipo === 'concluir' &&
      card.tipo === 'unidade' &&
      pedeEstadoAoEnviar(setorAtual, card)
    ) {
      setConcluindo({ card, etapa: acao.etapa })
      return
    }
    if (acao.tipo === 'iniciar' && etapaId !== null && card.parecer_pendente_id != null) {
      // D-09 item 2 / D-126: o setor confirma a chegada antes do trabalho.
      setInicioDepoisDoParecer({ card, etapaId })
      setCardParecer(card)
      return
    }
    // O card muda de coluna na hora (mover e começar o tempo ficam no setor).
    if ((acao.tipo === 'mover' || acao.tipo === 'iniciar') && etapaId !== null) {
      quadro.moverOtimista(card, etapaId)
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
        aoAbrirConcluir={(card) => card.tipo === 'avulso' && setConcluindoAvulso(card)}
        camposPorCard={camposPorCard}
        execucao={{
          execucoesPorCard,
          nomesUsuarios,
          pessoas,
          aoAbrirCard: (card) => abrirCard(card.id),
          meuUsuarioId: perfil.id,
          gestoPendente: mutacaoSoltar.isPending,
          aoLinhaTempo: setCardLinhaTempo,
        }}
      />
      {quadro.erro && (
        <p className="rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto">
          {quadro.erro instanceof Error ? quadro.erro.message : 'Não deu para carregar o quadro.'}
        </p>
      )}

      <ModalConcluirAvulso
        key={concluindoAvulso?.id ?? 'concluir-fechado'}
        card={concluindoAvulso}
        aoFechar={() => setConcluindoAvulso(null)}
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
        card={concluindo?.card ?? null}
        pedido={
          concluindo?.card.pedido_id != null
            ? pedidosPorId.get(concluindo.card.pedido_id)
            : undefined
        }
        etapaDestino={concluindo?.etapa}
        executorNome={
          concluindo?.card.executor_atual_id
            ? nomesUsuarios.get(concluindo.card.executor_atual_id)
            : undefined
        }
        aoFechar={() => setConcluindo(null)}
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
        pedido={
          cardParecer?.pedido_id != null ? pedidosPorId.get(cardParecer.pedido_id) : undefined
        }
        setores={setores}
        nomesUsuarios={nomesUsuarios}
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
