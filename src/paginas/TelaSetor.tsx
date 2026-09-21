import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, House, Layers } from 'lucide-react'
import { Botao, useNotificacao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { supabase } from '@/lib/supabase'
import type { OperadorIdentificado } from '@/autenticacao/api'
import {
  buscarCardsDoSetor,
  buscarEtapasDoSetor,
  buscarExecucoesAbertas,
  buscarNomesUsuarios,
  buscarPareceresPendentes,
  buscarSetores,
  finalizarExecucao,
  iniciarExecucao,
  retomarExecucao,
} from '@/kanban/api'
import { useAgora } from '@/kanban/tempo'
import { usePedidosDosCards } from '@/kanban/componentes/usePedidosDosCards'
import { ModalMoverCard } from '@/kanban/componentes/ModalMoverCard'
import { ModalLinhaTempo } from '@/kanban/componentes/ModalLinhaTempo'
import { ModalParecer } from '@/kanban/componentes/ModalParecer'
import type { Card, ExecucaoAberta, ParecerPendente, QualidadePendente } from '@/kanban/tipos'
import { CartaoTablet } from '@/tablet/CartaoTablet'
import { ModalPinOperador } from '@/tablet/ModalPinOperador'
import { ModalImagensProduto } from '@/tablet/ModalImagensProduto'
import { prepararSom, tocarSomChegada } from '@/tablet/som'

const ATUALIZA_A_CADA = 20_000
const CHAVE_SETOR = 'plt-tela-setor-id'

const ROTULO_ACAO = {
  receber: 'Receber',
  iniciar: 'Iniciar',
  finalizar: 'Finalizar',
  // SESSAO-22 (D-48): retomar a execução pausada pelo líder.
  retomar: 'Retomar',
  mover: 'Mover',
  concluir: 'Concluir',
} as const

interface AcaoComPin {
  tipo: keyof typeof ROTULO_ACAO
  card: Card
}

/**
 * A TELA DO SETOR (SESSAO-07 / D-06 / D-28): o que o chão de fábrica vê o dia
 * inteiro. O dispositivo fica logado numa conta própria e mostra a fila do
 * setor em tela cheia, ordenada por chegada, com destaque para quem espera há
 * mais tempo; card novo chega em tempo real com um som discreto. O operador
 * NÃO navega — ele age: cada gesto (receber, iniciar, finalizar, mover) pede
 * o PIN e sai registrado no nome de quem digitou.
 *
 * A mesma tela serve o celular pessoal logado: aparece o setor da pessoa.
 */
export function TelaSetor() {
  const { perfil, vinculos, ehLider, carregando } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const agora = useAgora()

  const souAdmin = perfil?.papel === 'admin'

  const { data: setores = [] } = useQuery({
    queryKey: ['setores'],
    queryFn: () => buscarSetores(),
  })

  // Setores que ESTE dispositivo pode exibir: os vínculos da conta (admin vê
  // todos). O PCP fica de fora — ele tem tela própria, mais completa (D-22).
  const idsVinculados = new Set(vinculos.map((v) => v.setor_id))
  const opcoes = setores.filter(
    (s) => s.codigo !== 'pcp' && (souAdmin || idsVinculados.has(s.id)),
  )

  const [setorId, setSetorId] = useState<number | null>(() => {
    const salvo = localStorage.getItem(CHAVE_SETOR)
    return salvo ? Number(salvo) : null
  })
  const setor = opcoes.find((s) => s.id === setorId) ?? null

  function escolherSetor(id: number | null) {
    setSetorId(id)
    if (id === null) localStorage.removeItem(CHAVE_SETOR)
    else localStorage.setItem(CHAVE_SETOR, String(id))
  }

  // Um vínculo só e nada salvo → a tela já abre no setor da pessoa (D-06).
  if (setorId === null && opcoes.length === 1) {
    escolherSetor(opcoes[0].id)
  }

  // ------------------------------------------------------------------
  // Dados da fila (mesmas chaves de cache do quadro do setor)
  // ------------------------------------------------------------------
  const { data: etapas = [] } = useQuery({
    queryKey: ['etapas', setorId],
    queryFn: () => buscarEtapasDoSetor(setorId!),
    enabled: setorId !== null,
  })
  const { data: cards = [] } = useQuery({
    queryKey: ['cards', 'setor', setorId],
    queryFn: () => buscarCardsDoSetor(setorId!, 'unidade'),
    enabled: setorId !== null,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: pedidosPorId = new Map() } = usePedidosDosCards(cards)

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
  const execucoesPorCard = new Map<number, ExecucaoAberta>(execucoes.map((e) => [e.card_id, e]))

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
        setorOrigemNome: setores.find((s) => s.id === p.setor_origem_id)?.nome ?? 'Setor anterior',
        remetenteNome: p.usuario_remetente_id
          ? (nomesUsuarios.get(p.usuario_remetente_id) ?? null)
          : null,
      },
    ]),
  )

  // ------------------------------------------------------------------
  // Tempo real: mudança em plt_cards → recarrega na hora (a RLS decide o que
  // este dispositivo enxerga). O polling de 20s segue como rede de segurança
  // (ex.: card que SAIU para um setor que esta conta não vê não gera aviso).
  // ------------------------------------------------------------------
  useEffect(() => {
    if (setorId === null) return
    const canal = supabase
      .channel(`tela-setor-${setorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plt_cards' }, () => {
        void clienteQuery.invalidateQueries({ queryKey: ['cards'] })
        void clienteQuery.invalidateQueries({ queryKey: ['execucoes'] })
        void clienteQuery.invalidateQueries({ queryKey: ['qualidade-pendente'] })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(canal)
    }
  }, [setorId, clienteQuery])

  // Som discreto quando um card NOVO aparece na fila (D-28) — nunca na
  // primeira carga nem ao trocar de setor.
  const vistos = useRef<{ setorId: number | null; ids: Set<number> } | null>(null)
  useEffect(() => {
    const atuais = new Set(cards.map((c) => c.id))
    const base = vistos.current
    if (base && base.setorId === setorId && [...atuais].some((id) => !base.ids.has(id))) {
      tocarSomChegada()
    }
    vistos.current = { setorId, ids: atuais }
  }, [cards, setorId])

  // ------------------------------------------------------------------
  // Gestos com PIN
  // ------------------------------------------------------------------
  const [acaoComPin, setAcaoComPin] = useState<AcaoComPin | null>(null)
  const [contextoMover, setContextoMover] = useState<{
    card: Card
    operador: OperadorIdentificado
    modo: 'mover' | 'concluir'
  } | null>(null)
  const [contextoParecer, setContextoParecer] = useState<{
    card: Card
    operador: OperadorIdentificado
  } | null>(null)
  const [cardFotos, setCardFotos] = useState<Card | null>(null)
  const [cardHistorico, setCardHistorico] = useState<Card | null>(null)

  async function invalidarFila() {
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

  const mutacaoIniciar = useMutation({
    mutationFn: iniciarExecucao,
    onSuccess: invalidarFila,
    onError: aoErroGesto('Não deu para iniciar'),
  })
  const mutacaoFinalizar = useMutation({
    mutationFn: finalizarExecucao,
    onSuccess: invalidarFila,
    onError: aoErroGesto('Não deu para finalizar'),
  })
  // SESSAO-22 (D-48): retomar com o PIN — o banco valida quem pode e a trava
  // do limite ("finalize a urgência antes").
  const mutacaoRetomar = useMutation({
    mutationFn: retomarExecucao,
    onSuccess: invalidarFila,
    onError: aoErroGesto('Não deu para retomar'),
  })
  const gestoPendente =
    mutacaoIniciar.isPending || mutacaoFinalizar.isPending || mutacaoRetomar.isPending

  function aoOperadorIdentificado(operador: OperadorIdentificado) {
    if (!acaoComPin) return
    const { tipo, card } = acaoComPin
    setAcaoComPin(null)
    notificar({ titulo: `${operador.nome} identificado`, tom: 'perfeito' })
    if (tipo === 'mover' || tipo === 'concluir') {
      setContextoMover({ card, operador, modo: tipo })
    } else if (tipo === 'finalizar') {
      mutacaoFinalizar.mutate({ card, usuarioId: operador.usuario_id })
    } else if (tipo === 'retomar') {
      mutacaoRetomar.mutate({ card, usuarioId: operador.usuario_id })
    } else if (pareceresPorCard.has(card.id)) {
      // Receber (ou iniciar com entrega marcada): o parecer vem antes (D-09).
      setContextoParecer({ card, operador })
    } else {
      mutacaoIniciar.mutate({ card, usuarioId: operador.usuario_id })
    }
  }

  // ------------------------------------------------------------------
  if (carregando) return null
  if (!perfil) return null

  const terminal = setor?.papel_no_fluxo === 'terminal'
  const etapasPorId = new Map(etapas.map((e) => [e.id, e]))
  // O destaque da demanda: o card há mais tempo esperando (sem ninguém executando).
  const maisAntigoEsperando = cards.find((c) => c.executor_atual_id === null) ?? null

  // Escolha de setor (dispositivo novo, ou conta com vários vínculos).
  if (!setor) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-6 p-6">
        <div>
          <h1 className="text-3xl">Tela do setor</h1>
          <p className="mt-1 text-texto-suave">
            Escolha o setor que este dispositivo vai mostrar. A fila fica em tela cheia e cada
            ação pede o PIN de quem agir.
          </p>
        </div>
        {opcoes.length === 0 ? (
          <p className="rounded-dm-lg border border-borda bg-superficie p-5 text-texto-suave">
            Esta conta não está vinculada a nenhum setor — fale com a liderança.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {opcoes.map((s) => (
              <Botao
                key={s.id}
                variante="secundaria"
                tamanho="galpao"
                larguraTotal
                icone={<Layers />}
                onClick={() => escolherSetor(s.id)}
              >
                {s.nome}
              </Botao>
            ))}
          </div>
        )}
        <Link to="/" className="text-sm text-texto-suave underline">
          Voltar ao início
        </Link>
      </div>
    )
  }

  return (
    // O primeiro toque em qualquer lugar libera o áudio do navegador (D-28).
    <div className="flex min-h-dvh flex-col" onPointerDown={prepararSom}>
      <header className="flex flex-wrap items-center gap-3 bg-grafite-700 px-4 py-3">
        <h1 className="font-marca text-2xl font-semibold text-white sm:text-3xl">{setor.nome}</h1>
        <span className="rounded-full bg-grafite-600 px-3 py-1 text-sm font-medium text-grafite-100 tabular-nums">
          {cards.length} na fila
        </span>
        {terminal && (
          <span className="rounded-full bg-grafite-600 px-3 py-1 text-sm font-medium text-grafite-100">
            fim de linha
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {opcoes.length > 1 && (
            <Botao
              variante="fantasma"
              tamanho="sm"
              icone={<ArrowLeftRight />}
              className="text-grafite-100 hover:bg-grafite-600"
              onClick={() => escolherSetor(null)}
            >
              Trocar setor
            </Botao>
          )}
          <Link to="/" aria-label="Sair da tela do setor">
            <Botao
              variante="fantasma"
              tamanho="sm"
              icone={<House />}
              className="text-grafite-100 hover:bg-grafite-600"
            />
          </Link>
        </span>
      </header>

      <main className="flex-1 p-4">
        {cards.length === 0 ? (
          <div className="flex h-full min-h-64 items-center justify-center">
            <p className="text-center text-xl text-texto-fraco">
              Fila vazia — quando chegar peça, ela aparece aqui sozinha.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => {
              const execucao = execucoesPorCard.get(card.id)
              return (
                <CartaoTablet
                  key={card.id}
                  card={card}
                  pedido={pedidosPorId.get(card.pedido_id)}
                  etapa={card.etapa_atual_id ? etapasPorId.get(card.etapa_atual_id) : undefined}
                  agora={agora}
                  esperandoHaMaisTempo={card.id === maisAntigoEsperando?.id && !terminal}
                  execucaoDesde={execucao?.iniciou_em}
                  executorNome={
                    card.executor_atual_id
                      ? (nomesUsuarios.get(card.executor_atual_id) ?? undefined)
                      : undefined
                  }
                  responsavelNome={
                    card.responsavel_id
                      ? (nomesUsuarios.get(card.responsavel_id) ?? undefined)
                      : undefined
                  }
                  parecerPendente={pareceresPorCard.get(card.id)}
                  gestoPendente={gestoPendente}
                  terminal={terminal}
                  aoReceber={(c) => setAcaoComPin({ tipo: 'receber', card: c })}
                  aoIniciar={(c) => setAcaoComPin({ tipo: 'iniciar', card: c })}
                  aoFinalizar={(c) => setAcaoComPin({ tipo: 'finalizar', card: c })}
                  aoRetomar={(c) => setAcaoComPin({ tipo: 'retomar', card: c })}
                  aoMover={(c) => setAcaoComPin({ tipo: 'mover', card: c })}
                  aoConcluir={(c) => setAcaoComPin({ tipo: 'concluir', card: c })}
                  aoFotos={setCardFotos}
                  aoHistorico={setCardHistorico}
                />
              )
            })}
          </div>
        )}
      </main>

      {/* Quem é você? — o PIN antes de qualquer gesto (D-06). */}
      <ModalPinOperador
        acao={acaoComPin ? ROTULO_ACAO[acaoComPin.tipo] : null}
        setorId={setor.id}
        aoFechar={() => setAcaoComPin(null)}
        aoIdentificado={aoOperadorIdentificado}
      />

      <ModalMoverCard
        card={contextoMover?.card ?? null}
        pedido={contextoMover ? pedidosPorId.get(contextoMover.card.pedido_id) : undefined}
        setores={setores}
        executorNome={
          contextoMover?.card.executor_atual_id
            ? nomesUsuarios.get(contextoMover.card.executor_atual_id)
            : undefined
        }
        operadorId={contextoMover?.operador.usuario_id}
        modo={contextoMover?.modo ?? 'mover'}
        aoFechar={() => setContextoMover(null)}
      />

      <ModalParecer
        card={contextoParecer?.card ?? null}
        pedido={contextoParecer ? pedidosPorId.get(contextoParecer.card.pedido_id) : undefined}
        pendente={
          contextoParecer ? (pareceresPorCard.get(contextoParecer.card.id) ?? null) : null
        }
        operadorId={contextoParecer?.operador.usuario_id}
        aoFechar={() => setContextoParecer(null)}
        aoRegistrado={(card, estado) => {
          // 🟢/🟡: o Iniciar acontece na sequência, no nome do MESMO operador.
          // 🔴 não inicia — o card acabou de ir para DANIFICADO (D-09).
          const operador = contextoParecer?.operador
          if (estado !== 'danificado' && operador) {
            mutacaoIniciar.mutate({ card, usuarioId: operador.usuario_id })
          }
        }}
      />

      <ModalImagensProduto
        codigo={cardFotos?.item_codigo ?? null}
        descricao={cardFotos?.item_descricao ?? undefined}
        podeEditar={souAdmin || ehLider}
        aoFechar={() => setCardFotos(null)}
      />

      <ModalLinhaTempo
        card={cardHistorico}
        pedido={cardHistorico ? pedidosPorId.get(cardHistorico.pedido_id) : undefined}
        aoFechar={() => setCardHistorico(null)}
      />
    </div>
  )
}
