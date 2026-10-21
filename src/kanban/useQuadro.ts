import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ouvirCanal } from '@/chat/canais'
import type { CampoMostrado } from '@/utilitarios/consultas'
import { ehCorEtiqueta, textoDoValorCampo } from '@/utilitarios/tipos'
import type { Etiqueta } from '@/utilitarios/tipos'
import { CARDS_POR_COLUNA, quadroColuna, quadroSetor } from './quadro'
import type { AuxilioAberto, DadosDoQuadro, JuntoDoQuadro, PessoaDoQuadro } from './quadro'
import type { ColunaPaginada } from './componentes/QuadroKanban'
import type { Card, Etapa, ExecucaoAberta, PedidoDoCard } from './tipos'
import type { OrdemDaFila } from './prioridade'

/** A coluna sem etapa (a "Chegada") — a mesma chave do QuadroKanban. */
const CHEGADA = 'chegada'
const chaveDaColuna = (etapaId: number | null) => (etapaId === null ? CHEGADA : String(etapaId))
/** Vários fatos de uma vez (um arrasto = mover + iniciar) viram UMA releitura. */
const ESPERA_MS = 150
/**
 * SESSAO-32 (teste de carga): os tablets do mesmo setor relíam no mesmo
 * instante a cada aviso — cada um espera mais um sorteio de até 0,7 s (quem fez
 * o gesto já vê na hora: a própria tela relê ao fazer).
 */
const ESPALHAR_MS = 700
const SEM_DADOS: Etapa[] = []

/** Todas as leituras do quadro de um setor (qualquer ordem) — o que o aviso relê. */
export const chaveDoSetor = (setorId: number | undefined) => ['quadro', setorId ?? null] as const
/** SESSAO-38 (D-154): a leitura de uma ordem da fila (o servidor ordena). */
export const chaveDoQuadro = (setorId: number | undefined, ordem: OrdemDaFila = 'prioridade') =>
  ['quadro', setorId ?? null, ordem] as const

interface Extra {
  cards: Card[]
  junto: JuntoDoQuadro
  carregando: boolean
}

const juntar = (a: JuntoDoQuadro, b: JuntoDoQuadro): JuntoDoQuadro => ({
  execucoes: [...a.execucoes, ...b.execucoes],
  auxilios: [...(a.auxilios ?? []), ...(b.auxilios ?? [])],
  pessoas: { ...a.pessoas, ...b.pessoas },
  pedidos: { ...a.pedidos, ...b.pedidos },
  valores: [...a.valores, ...b.valores],
})

/**
 * O quadro de um setor (QuadroSetor e o tablet) — SESSAO-31, Lei §2/§4/§6:
 *
 * - **1 requisição** abre o quadro inteiro (`plt_fn_quadro_setor`); a tela
 *   ainda guarda os catálogos que vieram junto (etapas, etiquetas, campos) no
 *   cache que as outras partes usam — nada pede de novo.
 * - **Ao vivo por websocket**: o canal privado `plt-aviso:setor_{id}` diz
 *   "mudou" (o banco avisa um por setor por transação) → UMA releitura do
 *   quadro. Assina ANTES de ler; ao reconectar, uma releitura de recuperação.
 *   Nada de relógio, nada de `postgres_changes`.
 * - ↩️ **Voltar ao quadro** (ajuste do dono, 14/10 noite — "lanço do PCP e só
 *   vejo no setor recarregando"): o canal só é ouvido com o quadro aberto; o
 *   que o cache guardava da visita anterior pode ter mudado enquanto a pessoa
 *   estava noutra tela. Então, ao assinar, a leitura guardada ANTES de abrir
 *   a tela é relida uma vez (a tela mostra a guardada até a nova chegar).
 * - **"Ver mais"** = 1 requisição daquela coluna, por cursor. Quando o quadro
 *   relê, a coluna aberta relê o que já mostrava (1 requisição por coluna aberta).
 * - **Arrasto otimista**: o card muda de coluna na hora; o banco confirma (ou
 *   desfaz, relendo).
 */
export function useQuadro(setorId: number | undefined, ordem: OrdemDaFila = 'prioridade') {
  const clienteQuery = useQueryClient()
  const [extras, setExtras] = useState<Record<string, Extra>>({})
  // SESSAO-38: trocar de setor OU de ordem recomeça o "Ver mais" das colunas.
  const [setorAnterior, setSetorAnterior] = useState(`${setorId}|${ordem}`)
  if (setorAnterior !== `${setorId}|${ordem}`) {
    setSetorAnterior(`${setorId}|${ordem}`)
    setExtras({})
  }

  // ---- ao vivo -------------------------------------------------------------
  const [ouvindoSetor, setOuvindoSetor] = useState<number | null>(null)
  const [conectado, setConectado] = useState(false)
  useEffect(() => {
    if (setorId === undefined) return
    let espera: ReturnType<typeof setTimeout> | null = null
    let caiu = false
    const reler = () => {
      if (espera) clearTimeout(espera)
      espera = setTimeout(
        () => {
          espera = null
          void clienteQuery.invalidateQueries({ queryKey: chaveDoSetor(setorId) })
        },
        ESPERA_MS + Math.random() * ESPALHAR_MS,
      )
    }
    const abertoEm = Date.now()
    let primeira = true
    // A leitura guardada de antes desta tela abrir fica velha: relê UMA vez.
    const conferirGuardada = () => {
      if (!primeira) return
      primeira = false
      // (qualquer ordem guardada — SESSAO-38)
      void clienteQuery.invalidateQueries({
        queryKey: chaveDoSetor(setorId),
        refetchType: 'none', // a leitura sai quando a consulta liga (logo abaixo)
        predicate: (q) => q.state.data !== undefined && q.state.dataUpdatedAt < abertoEm,
      })
    }
    // Se o websocket não responder, o quadro abre mesmo assim (sem ao vivo).
    const desistir = setTimeout(() => {
      conferirGuardada()
      setOuvindoSetor(setorId)
    }, 4000)
    const parar = ouvirCanal(
      `plt-aviso:setor_${setorId}`,
      (evento) => {
        if (evento === 'mudou') reler()
      },
      (status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(desistir)
          conferirGuardada()
          setOuvindoSetor(setorId)
          setConectado(true)
          if (caiu) {
            caiu = false
            reler() // recuperação: o que mudou enquanto estava fora
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          caiu = true
          setConectado(false)
        }
      },
    )
    return () => {
      clearTimeout(desistir)
      if (espera) clearTimeout(espera)
      parar()
    }
  }, [setorId, clienteQuery])

  // ---- a leitura -----------------------------------------------------------
  const consulta = useQuery({
    queryKey: chaveDoQuadro(setorId, ordem),
    queryFn: () => quadroSetor(setorId!, CARDS_POR_COLUNA, ordem),
    enabled: setorId !== undefined && ouvindoSetor === setorId,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const dados: DadosDoQuadro | undefined = consulta.data

  // Os catálogos que vieram junto entram no cache de quem os usa (sem pedir de novo).
  useEffect(() => {
    if (!dados || setorId === undefined) return
    clienteQuery.setQueryData(['etapas', setorId], dados.etapas)
    clienteQuery.setQueryData<Etiqueta[]>(
      ['etiquetas'],
      dados.etiquetas.map((e) => ({ ...e, cor: ehCorEtiqueta(e.cor) ? e.cor : 'cinza' })),
    )
    clienteQuery.setQueryData(['campos'], dados.campos)
  }, [dados, setorId, clienteQuery])

  // O quadro releu → cada coluna aberta no "Ver mais" relê o que mostrava.
  const versaoRef = useRef(0)
  const extrasRef = useRef(extras)
  useEffect(() => {
    extrasRef.current = extras
  })
  const atualizadoEm = consulta.dataUpdatedAt
  useEffect(() => {
    if (!dados || setorId === undefined) return
    const abertas = Object.entries(extrasRef.current).filter(([, e]) => e.cards.length > 0)
    if (abertas.length === 0) return
    const versao = ++versaoRef.current
    for (const [colunaChave, extra] of abertas) {
      const coluna = dados.colunas.find((c) => chaveDaColuna(c.etapa_id) === colunaChave)
      if (!coluna) continue
      void quadroColuna({
        setorId,
        etapaId: coluna.etapa_id,
        depoisDe: coluna.cards[coluna.cards.length - 1],
        limite: Math.min(50, extra.cards.length),
        ordem,
      }).then(
        (pagina) => {
          if (versao !== versaoRef.current) return
          setExtras((atual) => ({
            ...atual,
            [colunaChave]: { cards: pagina.cards, junto: pagina, carregando: false },
          }))
        },
        () => undefined,
      )
    }
  }, [atualizadoEm, dados, setorId, ordem])

  const verMais = useCallback(
    async (colunaChave: string) => {
      if (!dados || setorId === undefined) return
      const coluna = dados.colunas.find((c) => chaveDaColuna(c.etapa_id) === colunaChave)
      if (!coluna) return
      const jaTem = extras[colunaChave]
      const ultimo = [...coluna.cards, ...(jaTem?.cards ?? [])].at(-1)
      setExtras((atual) => ({
        ...atual,
        [colunaChave]: {
          cards: atual[colunaChave]?.cards ?? [],
          junto: atual[colunaChave]?.junto ?? {
            execucoes: [],
            pessoas: {},
            pedidos: {},
            valores: [],
          },
          carregando: true,
        },
      }))
      try {
        const pagina = await quadroColuna({
          setorId,
          etapaId: coluna.etapa_id,
          depoisDe: ultimo,
          ordem,
        })
        setExtras((atual) => {
          const anterior = atual[colunaChave]
          return {
            ...atual,
            [colunaChave]: {
              cards: [...(anterior?.cards ?? []), ...pagina.cards],
              junto: anterior ? juntar(anterior.junto, pagina) : pagina,
              carregando: false,
            },
          }
        })
      } catch {
        setExtras((atual) => ({
          ...atual,
          [colunaChave]: { ...atual[colunaChave], carregando: false },
        }))
      }
    },
    [dados, setorId, extras, ordem],
  )

  // ---- o que a tela mostra -------------------------------------------------
  const montado = useMemo(() => {
    const colunas = new Map<string, ColunaPaginada>()
    const cards: Card[] = []
    let junto: JuntoDoQuadro = dados ?? {
      execucoes: [],
      auxilios: [],
      pessoas: {},
      pedidos: {},
      valores: [],
    }
    for (const coluna of dados?.colunas ?? []) {
      const colunaChave = chaveDaColuna(coluna.etapa_id)
      const extra = extras[colunaChave]
      const vistos = new Set(coluna.cards.map((c) => c.id))
      const mais = (extra?.cards ?? []).filter((c) => !vistos.has(c.id))
      const todos = [...coluna.cards, ...mais]
      if (extra) junto = juntar(junto, extra.junto)
      colunas.set(colunaChave, {
        cards: todos,
        total: Math.max(coluna.total, todos.length),
        carregandoMais: extra?.carregando ?? false,
        aoVerMais: todos.length < coluna.total ? () => void verMais(colunaChave) : undefined,
      })
      cards.push(...todos)
    }
    const execucoesPorCard = new Map<number, ExecucaoAberta>(
      junto.execucoes.map((e) => [e.card_id, e]),
    )
    // SESSAO-36: os auxílios abertos por card (tempo próprio de cada pessoa)
    const auxiliosPorCard = new Map<number, AuxilioAberto[]>()
    for (const a of junto.auxilios ?? []) {
      const lista = auxiliosPorCard.get(a.card_id) ?? []
      lista.push(a)
      auxiliosPorCard.set(a.card_id, lista)
    }
    const pessoas = new Map<string, PessoaDoQuadro>(Object.entries(junto.pessoas))
    const nomesUsuarios = new Map<string, string>([...pessoas].map(([id, p]) => [id, p.nome]))
    const pedidosPorId = new Map<number, PedidoDoCard>(
      Object.values(junto.pedidos).map((p) => [p.pedido_id, p]),
    )
    // Os campos de cada card, na ordem do nome (como no histórico).
    const camposPorId = new Map((dados?.campos ?? []).map((c) => [c.id, c]))
    const camposPorCard = new Map<number, CampoMostrado[]>()
    for (const v of junto.valores) {
      const campo = camposPorId.get(v.campo_id)
      if (!campo) continue
      const lista = camposPorCard.get(v.card_id) ?? []
      if (!lista.some((c) => c.campoId === campo.id)) {
        lista.push({
          campoId: campo.id,
          nome: campo.nome,
          texto: textoDoValorCampo(campo, v.valor),
        })
      }
      camposPorCard.set(v.card_id, lista)
    }
    for (const lista of camposPorCard.values())
      lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    return {
      colunas,
      cards,
      execucoesPorCard,
      auxiliosPorCard,
      pessoas,
      nomesUsuarios,
      pedidosPorId,
      camposPorCard,
    }
  }, [dados, extras, verMais])

  /** O card muda de coluna na hora (o banco confirma; se recusar, a releitura desfaz). */
  const moverOtimista = useCallback(
    (card: Card, etapaId: number | null) => {
      clienteQuery.setQueryData<DadosDoQuadro>(chaveDoQuadro(setorId, ordem), (atual) => {
        if (!atual) return atual
        const destino = atual.colunas.find((c) => c.etapa_id === etapaId)
        if (!destino) return atual
        const movido: Card = { ...card, etapa_atual_id: etapaId, desde: new Date().toISOString() }
        return {
          ...atual,
          colunas: atual.colunas.map((c) => {
            if (c.etapa_id === etapaId) {
              return {
                ...c,
                total: c.total + 1,
                cards: [...c.cards.filter((x) => x.id !== card.id), movido],
              }
            }
            if (c.cards.some((x) => x.id === card.id)) {
              return {
                ...c,
                total: Math.max(c.total - 1, 0),
                cards: c.cards.filter((x) => x.id !== card.id),
              }
            }
            return c
          }),
        }
      })
    },
    [clienteQuery, setorId, ordem],
  )

  /** Releitura feita pela própria tela (gesto sem o websocket conectado). */
  const reler = useCallback(
    () => clienteQuery.invalidateQueries({ queryKey: chaveDoSetor(setorId) }),
    [clienteQuery, setorId],
  )

  return {
    etapas: dados?.etapas ?? SEM_DADOS,
    // SESSAO-36: quem está presente no setor (o ícone do canto superior direito)
    presencas: dados?.presencas ?? [],
    carregando: consulta.isPending,
    erro: consulta.error,
    conectado,
    moverOtimista,
    reler,
    ...montado,
  }
}
