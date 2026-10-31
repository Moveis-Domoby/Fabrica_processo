import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Flag, KeyRound, ListChecks } from 'lucide-react'
import { Botao, Campo, useNotificacao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { setorPinConferir } from '@/autenticacao/api'
import { buscarSetores, montarJuntos, soltarCardOuLote } from '@/kanban/api'
import { cardAuxiliar, setorAuxiliarTodos } from '@/tablet/api'
import { ModalPausarGeral } from '@/kanban/componentes/ModalPausarGeral'
import { acaoAoSoltar, pedeEstadoAoEnviar } from '@/kanban/arrasto'
import { useAgora } from '@/kanban/tempo'
import { useQuadro } from '@/kanban/useQuadro'
import { useFiltroDoQuadro } from '@/kanban/filtroQuadro'
import { useOrdemDaFila } from '@/kanban/prioridade'
import { useAbrirCard } from '@/kanban/janela/abrirCard'
import { QuadroKanban } from '@/kanban/componentes/QuadroKanban'
import { ModalMoverCard } from '@/kanban/componentes/ModalMoverCard'
import { ModalLinhaTempo } from '@/kanban/componentes/ModalLinhaTempo'
import { ModalParecer } from '@/kanban/componentes/ModalParecer'
import { ModalConcluirAvulso } from '@/kanban/componentes/ModalConcluirAvulso'
import { ModalMotivoPausa } from '@/kanban/componentes/ModalMotivoPausa'
import { ModalLevarLote } from '@/kanban/componentes/ModalLevarLote'
import { acaoLevaOLote, outrosDoLote } from '@/kanban/lote'
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
 * (D-125) anda igual e tem o botão "Concluir". Soltar o card em execução no
 * PARADO (a etapa que pede o motivo — §4) pergunta o motivo antes.
 */
/** SESSAO-37 (D-147): setores que a linha de produção destravou pelo PIN nesta visita. */
const setoresDestravados = new Set<number>()

export function QuadroSetor({ setorId }: { setorId: number }) {
  const { perfil, vinculos, carregando } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const agora = useAgora()
  const abrirCard = useAbrirCard()

  const souAdmin = perfil?.papel === 'admin'
  // SESSAO-37 (D-147): os níveis novos — logística vê tudo só olhando; a linha
  // de produção abre os setores dela livre e os outros pelo PIN do setor.
  const souLogistica = perfil?.papel === 'logistica'
  const souProducao = perfil?.papel === 'producao'
  const [, marcarDestravado] = useState(0)
  const destravadoAqui = setoresDestravados.has(setorId)
  const vinculoAqui = vinculos.find((v) => v.setor_id === setorId)

  const { data: setores = [], isPending: carregandoSetores } = useQuery({
    queryKey: ['setores'],
    queryFn: () => buscarSetores(),
  })
  const setor = setores.find((s) => s.id === setorId)

  // SESSAO-31: o quadro inteiro numa requisição e ao vivo pelo websocket do setor.
  // SESSAO-38 (D-154): a ordem da fila (o servidor ordena; lembrada no aparelho).
  const [ordemFila, mudarOrdemFila] = useOrdemDaFila('quadro')
  // SESSAO-40 (D-187 — pedido do dono com o vídeo do Trello): o filtro pelo nº
  // do pedido ou pelo nome do móvel; o servidor filtra cada coluna.
  const filtroQuadro = useFiltroDoQuadro()
  const quadro = useQuadro(
    Number.isFinite(setorId) ? setorId : undefined,
    ordemFila,
    filtroQuadro.aplicado,
  )
  const {
    etapas,
    colunas,
    pedidosPorId,
    execucoesPorCard,
    nomesUsuarios,
    pessoas,
    camposPorCard,
    auxiliosPorCard,
    temposPorCard,
  } = quadro
  // SESSAO-37 (D-147): cards com ajuda ATIVA agora — o dono pausado não os derruba.
  const cardsComAjudaAtiva = new Set(
    [...auxiliosPorCard.entries()]
      .filter(([, lista]) => lista.some((a) => a.pausado_em === null))
      .map(([id]) => id),
  )
  const totalNoSetor = [...colunas.values()].reduce((soma, c) => soma + c.total, 0)

  // SESSAO-24: o que o soltar precisa perguntar antes de ir ao banco.
  // SESSAO-42 ("Concluir o lote"): `lote` = levar o lote inteiro junto.
  const [encaminhando, setEncaminhando] = useState<{
    card: Card
    etapa: Etapa
    lote: boolean
  } | null>(null)
  const [concluindo, setConcluindo] = useState<{ card: Card; etapa: Etapa; lote: boolean } | null>(
    null,
  )
  const [perguntaLote, setPerguntaLote] = useState<{
    card: Card
    etapaId: number | null
    quantos: number
    destino: string
  } | null>(null)
  const [cardParecer, setCardParecer] = useState<Card | null>(null)
  const [inicioDepoisDoParecer, setInicioDepoisDoParecer] = useState<{
    card: Card
    etapaId: number
  } | null>(null)
  const [cardLinhaTempo, setCardLinhaTempo] = useState<Card | null>(null)
  const [concluindoAvulso, setConcluindoAvulso] = useState<Card | null>(null)
  const [parando, setParando] = useState<{ card: Card; etapa: Etapa } | null>(null)

  // Com o websocket conectado, o próprio aviso do setor relê o quadro (1 vez);
  // sem ele, a tela relê por conta própria.
  async function invalidarQuadro(forcar = false) {
    await Promise.all([
      forcar || !quadro.conectado ? quadro.reler() : Promise.resolve(),
      clienteQuery.invalidateQueries({ queryKey: ['linha-tempo'] }),
    ])
  }

  const mutacaoSoltar = useMutation({
    mutationFn: soltarCardOuLote,
    onSuccess: async (resultado) => {
      // SESSAO-42: "O lote todo" — quantos foram juntos.
      if (resultado.acao === 'lote') {
        notificar({
          titulo: `${resultado.cards ?? 0} cards do lote levados juntos`,
          tom: 'perfeito',
        })
      }
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

  // SESSAO-36 (D-146): entrar no card em execução como auxiliar, pela sessão.
  const mutacaoAuxiliar = useMutation({
    mutationFn: (cardId: number) => cardAuxiliar(cardId),
    onSuccess: async () => {
      notificar({ titulo: 'Você entrou no card — o seu tempo começou', tom: 'perfeito' })
      await invalidarQuadro()
    },
    onError: (excecao) => {
      notificar({
        titulo: 'Não deu para auxiliar',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      })
    },
  })

  // SESSAO-37 (D-147): o AJUDAR EM TUDO — entra em todos os cards em execução
  // do setor de uma vez; e o PAUSAR GERAL (modal com o motivo).
  const mutacaoAuxiliarTodos = useMutation({
    mutationFn: () => setorAuxiliarTodos(setorId),
    onSuccess: async (quantos) => {
      notificar({
        titulo: `Você entrou em ${quantos} card${quantos === 1 ? '' : 's'} — o seu tempo começou em cada um`,
        tom: 'perfeito',
      })
      await invalidarQuadro()
    },
    onError: (excecao) => {
      notificar({
        titulo: 'Não deu para ajudar em tudo',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      })
    },
  })
  const [pausarGeralAberto, setPausarGeralAberto] = useState(false)

  // SESSAO-42 ("Montar juntos"): no computador, quem monta é a própria sessão.
  const mutacaoMontar = useMutation({
    mutationFn: (cards: Card[]) => montarJuntos({ cardIds: cards.map((c) => c.id) }),
    onSuccess: async (resposta) => {
      notificar({
        titulo: `${resposta.cards.length} cards montando juntos — o tempo começou e se divide entre eles`,
        tom: 'perfeito',
      })
      await invalidarQuadro()
    },
    onError: (excecao) => {
      notificar({
        titulo: 'Não deu para montar juntos',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      })
    },
  })

  // SESSAO-37 (D-147): a conferência do PIN do setor para a linha de produção.
  const [pinSetor, setPinSetor] = useState('')
  const mutacaoDestravar = useMutation({
    mutationFn: () => setorPinConferir(pinSetor),
    onSuccess: (resultado) => {
      setPinSetor('')
      if (resultado.setor.id !== setorId) {
        notificar({
          titulo: `Esse PIN é do setor ${resultado.setor.nome}`,
          descricao: 'Digite o PIN de entrada DESTE setor para abrir a tela dele.',
          tom: 'atencao',
        })
        return
      }
      setoresDestravados.add(setorId)
      marcarDestravado((x) => x + 1)
    },
    onError: (excecao) => {
      notificar({
        titulo: 'PIN não confere',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      })
    },
  })

  if (
    !carregando &&
    !souAdmin &&
    !vinculoAqui &&
    !souLogistica &&
    // a linha de produção chega até aqui para a tela do PIN decidir
    !souProducao
  )
    return <Navigate to="/" replace />
  if (!perfil) return null
  if (!carregandoSetores && setores.length > 0 && !setor) return <Navigate to="/" replace />
  // O PCP tem quadro próprio, com a liberação de pedidos.
  if (setor?.codigo === 'pcp') return <Navigate to="/producao/pcp" replace />
  if (!setor) return null

  // SESSAO-37 (D-147): a linha de produção abre livre os setores DELA; outro
  // setor só depois do PIN de entrada daquele setor (conferido no servidor).
  if (souProducao && !vinculoAqui && !destravadoAqui) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-16 text-center">
        <KeyRound aria-hidden className="size-10 text-texto-fraco" />
        <h1 className="text-2xl">{setor.nome}</h1>
        <p className="text-sm text-texto-suave">
          Este setor não é o seu. Para dar uma olhada nele, digite o PIN de entrada DESTE setor (o
          mesmo que abre o tablet dele).
        </p>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (/^[0-9]{2}$/.test(pinSetor)) mutacaoDestravar.mutate()
          }}
        >
          <div className="w-36">
            <Campo
              rotulo="PIN do setor"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="2 dígitos"
              value={pinSetor}
              onChange={(e) => setPinSetor(e.target.value.replace(/\D/g, '').slice(0, 2))}
            />
          </div>
          <Botao
            type="submit"
            carregando={mutacaoDestravar.isPending}
            disabled={!/^[0-9]{2}$/.test(pinSetor)}
          >
            Abrir
          </Botao>
        </form>
      </div>
    )
  }

  const terminal = setor.papel_no_fluxo === 'terminal'
  const podeGerirEtapas = souAdmin || vinculoAqui?.lider_do_setor === true
  const setorAtual = setor

  function aoSoltarNaEtapa(card: Card, etapaId: number | null, loteTodo: boolean | null = null) {
    // SESSAO-37 (D-147): o nível logística acompanha só olhando (o banco
    // recusa de todo jeito — aqui a tela poupa o gesto).
    if (souLogistica) {
      notificar({
        titulo: 'A logística acompanha a produção só olhando',
        descricao: 'Mover e executar é gesto do pessoal da produção.',
        tom: 'atencao',
      })
      return
    }
    const acao = acaoAoSoltar({ setor: setorAtual, etapas, card, etapaDestinoId: etapaId })
    // SESSAO-42 ("Concluir o lote"): o card montado junto com outros que ainda
    // rodam, solto numa etapa que leva adiante — pergunta antes: só ele ou o lote?
    if (loteTodo === null && acaoLevaOLote(acao)) {
      const outros = outrosDoLote(card.id, temposPorCard)
      if (outros.length > 0) {
        setPerguntaLote({
          card,
          etapaId,
          quantos: outros.length + 1,
          destino:
            acao.tipo === 'encaminhar'
              ? `Vai para ${setores.find((s) => s.id === acao.setorDestinoId)?.nome ?? 'o próximo setor'}.`
              : 'A produção dele termina aqui.',
        })
        return
      }
    }
    const lote = loteTodo === true
    // SESSAO-31 (D-126): o estado da peça só é perguntado quando o setor pede ao enviar.
    if (acao.tipo === 'encaminhar' && pedeEstadoAoEnviar(setorAtual, card)) {
      setEncaminhando({ card, etapa: acao.etapa, lote })
      return
    }
    if (
      acao.tipo === 'concluir' &&
      card.tipo === 'unidade' &&
      pedeEstadoAoEnviar(setorAtual, card)
    ) {
      setConcluindo({ card, etapa: acao.etapa, lote })
      return
    }
    // SESSAO-31 (§4): parar o card em execução pede o motivo.
    if (acao.tipo === 'parar') {
      setParando({ card, etapa: acao.etapa })
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
    mutacaoSoltar.mutate({ card, etapaId, lote })
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
              : quadro.carregando
                ? 'Abrindo o quadro…'
                : quadro.filtroAplicado
                  ? // o texto como foi digitado (o servidor devolve a régua: sem acento/espaço)
                    totalNoSetor === 1
                    ? `1 card bate com o filtro "${filtroQuadro.aplicado ?? quadro.filtroAplicado}".`
                    : `${totalNoSetor} cards batem com o filtro "${filtroQuadro.aplicado ?? quadro.filtroAplicado}".`
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
        aoSoltarNaEtapa={(card, etapaId) => aoSoltarNaEtapa(card, etapaId)}
        aoAbrirConcluir={(card) => card.tipo === 'avulso' && setConcluindoAvulso(card)}
        // SESSAO-42 ("Montar juntos"): só no setor que monta em lote (o quadro decide pela régua).
        aoMontarJuntos={souLogistica ? undefined : (cards) => mutacaoMontar.mutate(cards)}
        montandoJuntos={mutacaoMontar.isPending}
        camposPorCard={camposPorCard}
        carregando={quadro.carregando}
        ordem={ordemFila}
        aoMudarOrdem={mudarOrdemFila}
        filtro={{ texto: filtroQuadro.texto, aoMudar: filtroQuadro.mudar }}
        filtrando={Boolean(quadro.filtroAplicado)}
        execucao={{
          execucoesPorCard,
          nomesUsuarios,
          pessoas,
          aoAbrirCard: (card) => abrirCard(card.id),
          meuUsuarioId: perfil.id,
          gestoPendente: mutacaoSoltar.isPending || mutacaoAuxiliarTodos.isPending,
          aoLinhaTempo: setCardLinhaTempo,
          cardsComAjudaAtiva,
          temposPorCard,
          // SESSAO-36 (D-146): no computador o Auxiliar age pela própria sessão.
          // SESSAO-37 (D-147): a logística só olha — sem gesto nenhum.
          ...(souLogistica
            ? {}
            : {
                aoAuxiliar: (card: Card) => mutacaoAuxiliar.mutate(card.id),
                aoAuxiliarTodos: () => mutacaoAuxiliarTodos.mutate(),
                aoPausarGeral: () => setPausarGeralAberto(true),
              }),
        }}
      />

      <ModalPausarGeral
        aberto={pausarGeralAberto}
        aoFechar={() => setPausarGeralAberto(false)}
        aoPausado={() => void invalidarQuadro()}
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

      <ModalMotivoPausa
        key={parando ? `parar-${parando.card.id}` : 'parar-fechado'}
        modo="parar"
        card={parando?.card ?? null}
        etapaId={parando?.etapa.id}
        etapaNome={parando?.etapa.nome}
        pedidoNumero={
          parando?.card.pedido_id != null ? pedidosPorId.get(parando.card.pedido_id)?.numero : null
        }
        aoFechar={() => setParando(null)}
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
        lote={encaminhando?.lote}
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
        lote={concluindo?.lote}
        aoFechar={() => setConcluindo(null)}
      />

      {/* SESSAO-42 ("Concluir o lote"): só este card ou o lote inteiro? */}
      <ModalLevarLote
        pergunta={perguntaLote}
        aoFechar={() => setPerguntaLote(null)}
        aoEscolher={(loteTodo) => {
          const pendente = perguntaLote
          setPerguntaLote(null)
          if (pendente) aoSoltarNaEtapa(pendente.card, pendente.etapaId, loteTodo)
        }}
      />

      <ModalLinhaTempo
        card={cardLinhaTempo}
        pedido={
          cardLinhaTempo?.pedido_id != null ? pedidosPorId.get(cardLinhaTempo.pedido_id) : undefined
        }
        tempoVivo={cardLinhaTempo ? temposPorCard.get(cardLinhaTempo.id) : undefined}
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
