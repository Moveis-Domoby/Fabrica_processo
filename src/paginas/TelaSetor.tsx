import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, House, Layers } from 'lucide-react'
import { Botao, useNotificacao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { supabase } from '@/lib/supabase'
import type { OperadorIdentificado } from '@/autenticacao/api'
import {
  buscarEtapasDoSetor,
  buscarExecucoesAbertas,
  buscarNomesUsuarios,
  buscarPareceresPendentes,
  buscarSetores,
  soltarCard,
} from '@/kanban/api'
import { acaoAoSoltar, setorConcluiProducao } from '@/kanban/arrasto'
import type { AcaoAoSoltar } from '@/kanban/arrasto'
import { useAgora } from '@/kanban/tempo'
import { usePedidosDosCards } from '@/kanban/componentes/usePedidosDosCards'
import { useColunasPaginadas } from '@/kanban/componentes/useColunasPaginadas'
import { QuadroKanban } from '@/kanban/componentes/QuadroKanban'
import { ModalMoverCard } from '@/kanban/componentes/ModalMoverCard'
import { ModalLinhaTempo } from '@/kanban/componentes/ModalLinhaTempo'
import { ModalParecer } from '@/kanban/componentes/ModalParecer'
import type { Card, ExecucaoAberta, ParecerPendente, QualidadePendente } from '@/kanban/tipos'
import { ModalPinOperador } from '@/tablet/ModalPinOperador'
import { ModalImagensProduto } from '@/tablet/ModalImagensProduto'
import { prepararSom, tocarSomChegada } from '@/tablet/som'

const ATUALIZA_A_CADA = 20_000
const CHAVE_SETOR = 'plt-tela-setor-id'

/** O gesto que espera o PIN: um card solto numa coluna, ou o Concluir. */
type GestoComPin =
  | { tipo: 'soltar'; card: Card; etapaId: number | null; acao: AcaoAoSoltar; rotulo: string }
  | { tipo: 'concluir'; card: Card }

/**
 * A TELA DO SETOR (SESSAO-07 / D-06 / D-28): o que o chão de fábrica vê o dia
 * inteiro. O dispositivo fica logado numa conta própria e mostra o setor em
 * tela cheia; card novo chega em tempo real com um som discreto. O operador
 * NÃO navega — ele age, e cada gesto pede o PIN e sai no nome de quem digitou.
 *
 * SESSAO-24 (dono, 27/09 — "tudo arrastando, é mais rápido"): a tela virou o
 * QUADRO de colunas do setor, só por arrasto. Soltar o card pede o PIN; na
 * etapa de trabalho o tempo do operador começa (com o parecer antes, quando a
 * peça chegou marcada); na etapa que leva a outro setor, o estado da peça é
 * perguntado e o card segue. Na LIMPEZA E EMBALAGEM existe o "Concluir
 * produção". Dados do produto, nunca do cliente (D-28).
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
  // todos). O PCP fica de fora — ele tem tela própria, mais completa (D-22) —
  // e os fins de linha também (o operador não trabalha neles).
  const idsVinculados = new Set(vinculos.map((v) => v.setor_id))
  const opcoes = setores.filter(
    (s) =>
      s.papel_no_fluxo === 'producao' && (souAdmin || idsVinculados.has(s.id)),
  )

  const [setorId, setSetorId] = useState<number | null>(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_SETOR)
      return salvo ? Number(salvo) : null
    } catch {
      return null
    }
  })
  const setor = opcoes.find((s) => s.id === setorId) ?? null

  function escolherSetor(id: number | null) {
    setSetorId(id)
    try {
      if (id === null) localStorage.removeItem(CHAVE_SETOR)
      else localStorage.setItem(CHAVE_SETOR, String(id))
    } catch {
      // sem localStorage: só não fica lembrado
    }
  }

  // Um vínculo só e nada salvo → a tela já abre no setor da pessoa (D-06).
  if (setorId === null && opcoes.length === 1) {
    escolherSetor(opcoes[0].id)
  }

  // ------------------------------------------------------------------
  // Dados do quadro (mesmas chaves de cache do quadro do setor — E-22)
  // ------------------------------------------------------------------
  const { data: etapas = [] } = useQuery({
    queryKey: ['etapas', setorId],
    queryFn: () => buscarEtapasDoSetor(setorId!),
    enabled: setorId !== null,
  })
  // SESSAO-22: cada coluna só requisita a página que mostra (10 + "Ver mais").
  const { colunas, cards } = useColunasPaginadas({
    setorId: setor?.id,
    etapas,
    tipo: 'unidade',
    atualizaACada: ATUALIZA_A_CADA,
  })
  const totalNoSetor = [...colunas.values()].reduce((soma, c) => soma + c.total, 0)
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
  // este dispositivo enxerga). O polling de 20s segue como rede de segurança.
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

  // Som discreto quando um card NOVO aparece no setor (D-28) — nunca na
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
  // Gestos com PIN (D-06): soltar o card pede o PIN; o resto vem depois.
  // ------------------------------------------------------------------
  const [gestoComPin, setGestoComPin] = useState<GestoComPin | null>(null)
  const [encaminhando, setEncaminhando] = useState<{
    card: Card
    acao: Extract<AcaoAoSoltar, { tipo: 'encaminhar' }>
    operador: OperadorIdentificado
  } | null>(null)
  const [concluindo, setConcluindo] = useState<{ card: Card; operador: OperadorIdentificado } | null>(
    null,
  )
  const [contextoParecer, setContextoParecer] = useState<{
    card: Card
    etapaId: number
    operador: OperadorIdentificado
  } | null>(null)
  const [cardFotos, setCardFotos] = useState<Card | null>(null)
  const [cardHistorico, setCardHistorico] = useState<Card | null>(null)

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
    onSuccess: async (resultado) => {
      if (resultado.acao === 'iniciado') notificar({ titulo: 'Tempo começou', tom: 'perfeito' })
      await invalidarQuadro()
    },
    onError: (excecao) => {
      notificar({
        titulo: 'Não deu para mover o card',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      })
      void invalidarQuadro()
    },
  })

  function aoOperadorIdentificado(operador: OperadorIdentificado) {
    const gesto = gestoComPin
    if (!gesto) return
    setGestoComPin(null)
    notificar({ titulo: `${operador.nome} identificado`, tom: 'perfeito' })
    if (gesto.tipo === 'concluir') {
      setConcluindo({ card: gesto.card, operador })
      return
    }
    const { card, etapaId, acao } = gesto
    if (acao.tipo === 'encaminhar') {
      setEncaminhando({ card, acao, operador })
    } else if (acao.tipo === 'iniciar' && etapaId !== null && pareceresPorCard.has(card.id)) {
      // Peça chegou marcada: o parecer vem antes do trabalho (D-09), no nome do MESMO operador.
      setContextoParecer({ card, etapaId, operador })
    } else {
      mutacaoSoltar.mutate({ card, etapaId, operadorId: operador.usuario_id })
    }
  }

  // ------------------------------------------------------------------
  if (carregando) return null
  if (!perfil) return null

  // Escolha de setor (dispositivo novo, ou conta com vários vínculos).
  if (!setor) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-6 p-6">
        <div>
          <h1 className="text-3xl">Tela do setor</h1>
          <p className="mt-1 text-texto-suave">
            Escolha o setor que este dispositivo vai mostrar. O quadro fica em tela cheia e cada
            gesto pede o PIN de quem agir.
          </p>
        </div>
        {opcoes.length === 0 ? (
          <p className="rounded-dm-lg border border-borda bg-superficie p-5 text-texto-suave">
            Esta conta não está vinculada a nenhum setor de produção — fale com a liderança.
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

  const setorAtual = setor
  function aoSoltarNaEtapa(card: Card, etapaId: number | null) {
    const acao = acaoAoSoltar({ setor: setorAtual, etapas, card, etapaDestinoId: etapaId })
    const destinoNome =
      acao.tipo === 'encaminhar' ? setores.find((s) => s.id === acao.setorDestinoId)?.nome : null
    const rotulo =
      acao.tipo === 'encaminhar'
        ? `Mandar para ${destinoNome ?? 'o próximo setor'}`
        : acao.tipo === 'iniciar'
          ? 'Começar o trabalho'
          : 'Mover'
    setGestoComPin({ tipo: 'soltar', card, etapaId, acao, rotulo })
  }

  return (
    // O primeiro toque em qualquer lugar libera o áudio do navegador (D-28).
    <div className="flex min-h-dvh flex-col" onPointerDown={prepararSom}>
      <header className="flex flex-wrap items-center gap-3 bg-grafite-700 px-4 py-3">
        <h1 className="font-marca text-2xl font-semibold text-white sm:text-3xl">{setor.nome}</h1>
        <span className="rounded-full bg-grafite-600 px-3 py-1 text-sm font-medium text-grafite-100 tabular-nums">
          {totalNoSetor} no setor
        </span>
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
        <p className="mb-3 text-sm text-texto-suave">
          Segure o card e arraste: na etapa de trabalho o seu tempo começa; nas etapas que levam a
          outro setor, ele segue para lá. Cada gesto pede o seu PIN.
        </p>
        <QuadroKanban
          setor={setor}
          etapas={etapas}
          colunas={colunas}
          pedidosPorId={pedidosPorId}
          agora={agora}
          setores={setores}
          tamanho="galpao"
          aoSoltarNaEtapa={aoSoltarNaEtapa}
          aoAbrirConcluir={
            setorConcluiProducao(setor)
              ? (card) => setGestoComPin({ tipo: 'concluir', card })
              : undefined
          }
          execucao={{
            execucoesPorCard,
            nomesUsuarios,
            // Tablet compartilhado: ninguém é "você" — o PIN diz quem agiu.
            meuUsuarioId: '',
            gestoPendente: mutacaoSoltar.isPending,
            pareceresPorCard,
            aoLinhaTempo: setCardHistorico,
            aoFotos: setCardFotos,
          }}
        />
      </main>

      {/* Quem é você? — o PIN antes de qualquer gesto (D-06). */}
      <ModalPinOperador
        acao={
          gestoComPin
            ? gestoComPin.tipo === 'concluir'
              ? 'Concluir produção'
              : gestoComPin.rotulo
            : null
        }
        setorId={setor.id}
        aoFechar={() => setGestoComPin(null)}
        aoIdentificado={aoOperadorIdentificado}
      />

      <ModalMoverCard
        modo="encaminhar"
        card={encaminhando?.card ?? null}
        pedido={
          encaminhando?.card.pedido_id != null
            ? pedidosPorId.get(encaminhando.card.pedido_id)
            : undefined
        }
        etapaDestino={encaminhando?.acao.etapa}
        setorDestinoNome={
          encaminhando
            ? setores.find((s) => s.id === encaminhando.acao.setorDestinoId)?.nome
            : undefined
        }
        executorNome={
          encaminhando?.card.executor_atual_id
            ? nomesUsuarios.get(encaminhando.card.executor_atual_id)
            : undefined
        }
        operadorId={encaminhando?.operador.usuario_id}
        aoFechar={() => setEncaminhando(null)}
      />

      <ModalMoverCard
        modo="concluir"
        card={concluindo?.card ?? null}
        pedido={
          concluindo?.card.pedido_id != null ? pedidosPorId.get(concluindo.card.pedido_id) : undefined
        }
        executorNome={
          concluindo?.card.executor_atual_id
            ? nomesUsuarios.get(concluindo.card.executor_atual_id)
            : undefined
        }
        operadorId={concluindo?.operador.usuario_id}
        aoFechar={() => setConcluindo(null)}
      />

      <ModalParecer
        card={contextoParecer?.card ?? null}
        pedido={
          contextoParecer?.card.pedido_id != null
            ? pedidosPorId.get(contextoParecer.card.pedido_id)
            : undefined
        }
        pendente={
          contextoParecer ? (pareceresPorCard.get(contextoParecer.card.id) ?? null) : null
        }
        operadorId={contextoParecer?.operador.usuario_id}
        aoFechar={() => setContextoParecer(null)}
        aoRegistrado={(card, estado) => {
          // 🟢/🟡: o trabalho começa na sequência, no nome do MESMO operador.
          // 🔴 não — o card acabou de ir para DANIFICADO (D-09).
          const contexto = contextoParecer
          if (estado !== 'danificado' && contexto) {
            mutacaoSoltar.mutate({
              card,
              etapaId: contexto.etapaId,
              operadorId: contexto.operador.usuario_id,
            })
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
        pedido={
          cardHistorico?.pedido_id != null ? pedidosPorId.get(cardHistorico.pedido_id) : undefined
        }
        aoFechar={() => setCardHistorico(null)}
      />
    </div>
  )
}
