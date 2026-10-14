import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AtSign, ChevronUp, History, Pencil, SendHorizontal, Trash2 } from 'lucide-react'
import { Botao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { ouvirCanal } from '@/chat/canais'
import { AvatarChat } from '@/chat/componentes/AvatarChat'
import { rotuloDaAcao } from '@/auditoria/rotulos'
import { buscarPessoasAtivas, chaveDoGesto } from '../avulso'
import type { PessoaMini } from '../avulso'
import type { JanelaDoCard } from './api'
import {
  apagarMensagemDoCard,
  chaveDaConversa,
  editarMensagemDoCard,
  juntarNaConversa,
  listarConversa,
  mandarMensagemNoCard,
  topicoDoCard,
  trocarNaConversa,
  versoesDaMensagemDoCard,
} from './conversa'
import type { CacheConversa, ItemDaConversa } from './conversa'

const SEM_RELEITURA = {
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
} as const

function hora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** O fato do card em uma linha de gente ("Fulano moveu de CORTE para MONTAGEM"). */
function fraseDoFato(item: ItemDaConversa): string {
  const r = (item.resumo ?? {}) as Record<string, string | undefined>
  if (item.tipo === 'movimentacao_setor' && r.setor_destino)
    return `moveu ${r.setor_origem ? `de ${r.setor_origem} ` : ''}para ${r.setor_destino}${r.etapa_destino ? ` (${r.etapa_destino})` : ''}`
  if (item.tipo === 'movimentacao_etapa' && r.etapa_destino) return `moveu para ${r.etapa_destino}`
  if ((item.tipo === 'etiqueta_adicionada' || item.tipo === 'etiqueta_removida') && r.etiqueta)
    return `${item.tipo === 'etiqueta_adicionada' ? 'pôs' : 'tirou'} a etiqueta "${r.etiqueta}"`
  if (
    (item.tipo === 'responsavel_adicionado' || item.tipo === 'responsavel_removido') &&
    r.responsavel
  )
    return `${item.tipo === 'responsavel_adicionado' ? 'pôs' : 'tirou'} ${r.responsavel} como responsável`
  if (item.tipo === 'anexo_adicionado' && item.texto) return `anexou ${item.texto}`
  return rotuloDaAcao(item.tipo).toLowerCase()
}

/** O texto com as @menções em destaque (o nome de quem foi mencionado). */
function TextoComMencoes({ texto, mencoes }: { texto: string; mencoes: { nome: string }[] }) {
  if (mencoes.length === 0) return <>{texto}</>
  const nomes = mencoes.map((m) => m.nome).sort((a, b) => b.length - a.length)
  const partes: (string | { m: string })[] = []
  let resto = texto
  while (resto.length > 0) {
    let achou = -1
    let qual = ''
    for (const n of nomes) {
      const i = resto.indexOf(`@${n}`)
      if (i >= 0 && (achou < 0 || i < achou)) {
        achou = i
        qual = n
      }
    }
    if (achou < 0) {
      partes.push(resto)
      break
    }
    if (achou > 0) partes.push(resto.slice(0, achou))
    partes.push({ m: qual })
    resto = resto.slice(achou + qual.length + 1)
  }
  return (
    <>
      {partes.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : (
          <strong key={i} className="font-semibold text-texto">
            @{p.m}
          </strong>
        ),
      )}
    </>
  )
}

/**
 * A conversa do card (SESSAO-31 · §3), a coluna da direita da janela: a
 * conversa e — no filtro "Tudo" — os fatos do card na mesma linha. 10 por
 * página com "Ver anteriores"; o canal privado do card é assinado ANTES da
 * leitura e empurra o novo e o mudado direto no cache (nada se relê); sai ao
 * fechar a janela. @menção com a lista de pessoas (busca no servidor, 300 ms,
 * 2 letras). Cada um edita e apaga só a própria mensagem (D-131).
 */
export function ConversaDoCard({
  janela,
  modo = 'padrao',
}: {
  janela: JanelaDoCard
  modo?: 'padrao' | 'tablet'
}) {
  const cardId = janela.card.id
  const { perfil } = useSessao()
  const eu = perfil?.id ?? ''
  const souAdmin = perfil?.papel === 'admin'
  const clienteQuery = useQueryClient()
  const notificar = useNotificacao()
  const [tudo, setTudo] = useState(false)
  const [ouvindo, setOuvindo] = useState(false)

  // ---- o canal do card: assina antes de ler (nada escapa entre ler e ouvir)
  useEffect(() => {
    let caiu = false
    const desistir = setTimeout(() => setOuvindo(true), 4000)
    const aplicar = (fn: (atual: CacheConversa | undefined) => CacheConversa | undefined) => {
      for (const t of [false, true])
        clienteQuery.setQueryData<CacheConversa>(chaveDaConversa(cardId, t), fn)
    }
    const parar = ouvirCanal(
      topicoDoCard(cardId),
      (evento, dados) => {
        const item = {
          tipo: 'mensagem',
          editada_vezes: 0,
          resumo: null,
          tem_mais: false,
          ...dados,
        } as ItemDaConversa
        if (evento === 'mensagem') aplicar((atual) => juntarNaConversa(atual, item))
        if (evento === 'mensagem_mudou')
          aplicar((atual) =>
            trocarNaConversa(atual, {
              id: item.id,
              editada_em: item.editada_em,
              apagada_em: item.apagada_em,
              // o admin guarda o texto da apagada (ele vê — D-131)
              ...(item.texto !== null || !souAdmin ? { texto: item.texto } : {}),
            }),
          )
      },
      (status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(desistir)
          setOuvindo(true)
          if (caiu) {
            caiu = false
            void clienteQuery.resetQueries({ queryKey: ['card-mensagens', cardId] })
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          caiu = true
        }
      },
    )
    return () => {
      clearTimeout(desistir)
      parar()
    }
  }, [cardId, clienteQuery, souAdmin])

  const consulta = useInfiniteQuery({
    queryKey: chaveDaConversa(cardId, tudo),
    queryFn: ({ pageParam }) => listarConversa(cardId, pageParam, tudo),
    initialPageParam: null as number | null,
    getNextPageParam: (ultima) =>
      ultima.length > 0 && ultima[ultima.length - 1].tem_mais
        ? ultima[ultima.length - 1].id
        : undefined,
    enabled: ouvindo,
    gcTime: 0,
    ...SEM_RELEITURA,
  })
  // A mais antiga em cima, a mais nova embaixo (como uma conversa).
  const itens = [...(consulta.data?.pages.flat() ?? [])].reverse()

  // ---- o compositor --------------------------------------------------------
  const [texto, setTexto] = useState('')
  const [mencoes, setMencoes] = useState<PessoaMini[]>([])
  const [chave, setChave] = useState(chaveDoGesto)
  const campoRef = useRef<HTMLTextAreaElement>(null)
  const fimRef = useRef<HTMLDivElement>(null)
  const termoMencao = (() => {
    const m = /(^|\s)@([\p{L}\d][\p{L}\d .'-]{1,40})$/u.exec(texto)
    return m ? m[2] : null
  })()
  const [termoEstavel, setTermoEstavel] = useState<string | null>(null)
  useEffect(() => {
    const t = setTimeout(
      () =>
        setTermoEstavel(termoMencao && termoMencao.trim().length >= 2 ? termoMencao.trim() : null),
      300,
    )
    return () => clearTimeout(t)
  }, [termoMencao])
  const sugestoes = useQuery({
    queryKey: ['pessoas-ativas', termoEstavel],
    queryFn: () => buscarPessoasAtivas(termoEstavel!),
    enabled: termoEstavel !== null && termoMencao !== null,
    staleTime: 60_000,
  })
  function escolherMencao(p: PessoaMini) {
    if (termoMencao === null) return
    setTexto((t) => t.slice(0, t.length - termoMencao.length - 1) + `@${p.nome} `)
    setMencoes((atual) => (atual.some((x) => x.id === p.id) ? atual : [...atual, p]))
    setTermoEstavel(null)
    campoRef.current?.focus()
  }

  const enviar = useMutation({
    mutationFn: () =>
      mandarMensagemNoCard({
        cardId,
        texto: texto.trim(),
        // só os que ficaram no texto
        mencoes: mencoes.filter((p) => texto.includes(`@${p.nome}`)).map((p) => p.id),
        chave,
      }),
    onSuccess: (id) => {
      // a própria mensagem entra na hora (o canal também a traz — sem repetir)
      const nova: ItemDaConversa = {
        id,
        tipo: 'mensagem',
        autor_id: eu,
        autor_nome: perfil?.nome ?? 'Você',
        autor_foto: perfil?.foto_caminho ?? null,
        texto: texto.trim(),
        mencoes: mencoes
          .filter((p) => texto.includes(`@${p.nome}`))
          .map((p) => ({ id: p.id, nome: p.nome })),
        criada_em: new Date().toISOString(),
        editada_em: null,
        apagada_em: null,
        editada_vezes: 0,
        resumo: null,
        tem_mais: false,
      }
      for (const t of [false, true])
        clienteQuery.setQueryData<CacheConversa>(chaveDaConversa(cardId, t), (a) =>
          juntarNaConversa(a, nova),
        )
      setTexto('')
      setMencoes([])
      setChave(chaveDoGesto())
      void clienteQuery.invalidateQueries({ queryKey: ['card-janela', cardId] })
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para mandar',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })
  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    if (texto.trim() && !enviar.isPending) enviar.mutate()
  }
  function aoTeclar(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (termoMencao !== null && sugestoes.data && sugestoes.data.length > 0) {
        escolherMencao(sugestoes.data[0])
        return
      }
      if (texto.trim() && !enviar.isPending) enviar.mutate()
    }
  }

  // rola para o fim quando chega mensagem nova
  const ultimaId = itens.at(-1)?.id
  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: 'nearest' })
  }, [ultimaId])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-borda px-4 py-2">
        <h3 className="text-sm font-semibold text-texto">Atividade</h3>
        <div className="ml-auto flex gap-1" role="radiogroup" aria-label="Mostrar">
          {(
            [
              [false, 'Só conversa'],
              [true, 'Tudo'],
            ] as const
          ).map(([v, r]) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={tudo === v}
              onClick={() => setTudo(v)}
              className={cn(
                'min-h-toque-md rounded-full border px-3 text-xs font-medium',
                tudo === v
                  ? 'border-acao-ativa bg-acao text-acao-texto'
                  : 'border-borda-forte bg-superficie text-texto-suave',
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3"
        aria-live="polite"
      >
        {consulta.hasNextPage && (
          <Botao
            variante="fantasma"
            tamanho="sm"
            icone={<ChevronUp />}
            className="self-center"
            carregando={consulta.isFetchingNextPage}
            onClick={() => consulta.fetchNextPage()}
          >
            Ver anteriores
          </Botao>
        )}
        {consulta.isPending && (
          <p className="my-auto text-center text-sm text-texto-fraco">Abrindo a conversa…</p>
        )}
        {!consulta.isPending && itens.length === 0 && (
          <p className="my-auto text-center text-sm text-texto-fraco">
            {tudo
              ? 'Nada aconteceu neste card ainda.'
              : 'Nenhuma mensagem ainda — comece a conversa.'}
          </p>
        )}
        {itens.map((item) =>
          item.tipo === 'mensagem' ? (
            <Mensagem
              key={item.id}
              item={item}
              cardId={cardId}
              minha={item.autor_id === eu}
              souAdmin={souAdmin}
            />
          ) : (
            <p
              key={item.id}
              className="flex flex-wrap items-baseline gap-x-1 text-xs text-texto-suave"
            >
              <span className="font-medium text-texto">{item.autor_nome}</span>
              {fraseDoFato(item)}
              <span className="tabular-nums text-texto-fraco">· {hora(item.criada_em)}</span>
            </p>
          ),
        )}
        <div ref={fimRef} />
      </div>

      {modo === 'tablet' ? (
        <p className="border-t border-borda px-4 py-3 text-xs text-texto-suave">
          No tablet a conversa é só para ler — escreva pelo computador ou pelo celular.
        </p>
      ) : (
        <form
          onSubmit={aoEnviar}
          className="relative flex items-end gap-2 border-t border-borda p-2"
        >
          {termoMencao !== null && sugestoes.data && sugestoes.data.length > 0 && (
            <ul
              className="absolute right-2 bottom-full left-2 mb-1 max-h-56 overflow-y-auto rounded-dm border border-borda bg-superficie shadow-xl"
              aria-label="Mencionar"
            >
              {sugestoes.data.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => escolherMencao(p)}
                    className="flex min-h-toque-md w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-superficie-sutil"
                  >
                    <AvatarChat nome={p.nome} foto={p.foto} tamanho="sm" />
                    {p.nome}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label htmlFor={`card-texto-${cardId}`} className="sr-only">
            Mensagem no card
          </label>
          <textarea
            id={`card-texto-${cardId}`}
            ref={campoRef}
            rows={1}
            maxLength={1000}
            value={texto}
            placeholder="Escreva — @ para mencionar alguém"
            onChange={(e) => setTexto(e.target.value)}
            onInput={(e) => {
              const campo = e.currentTarget
              campo.style.height = 'auto'
              campo.style.height = `${Math.min(campo.scrollHeight, 128)}px`
            }}
            onKeyDown={aoTeclar}
            className="min-h-toque-md flex-1 resize-none rounded-dm border border-borda-forte bg-superficie px-3 py-2.5 text-base text-texto placeholder:text-texto-fraco"
          />
          <Botao
            type="button"
            variante="fantasma"
            aria-label="Mencionar alguém"
            icone={<AtSign />}
            className="h-toque-md w-toque-md shrink-0 px-0"
            onClick={() => {
              setTexto((t) => (t && !t.endsWith(' ') ? `${t} @` : `${t}@`))
              campoRef.current?.focus()
            }}
          />
          <Botao
            type="submit"
            aria-label="Mandar a mensagem"
            icone={<SendHorizontal />}
            carregando={enviar.isPending}
            disabled={!texto.trim()}
            className="h-toque-md w-toque-md shrink-0 px-0"
          />
        </form>
      )}
    </div>
  )
}

function Mensagem({
  item,
  cardId,
  minha,
  souAdmin,
}: {
  item: ItemDaConversa
  cardId: number
  minha: boolean
  souAdmin: boolean
}) {
  const clienteQuery = useQueryClient()
  const notificar = useNotificacao()
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(item.texto ?? '')
  const [confirmando, setConfirmando] = useState(false)
  const [verVersoes, setVerVersoes] = useState(false)
  const apagada = item.apagada_em !== null
  const versoes = useQuery({
    queryKey: ['card-mensagem-versoes', item.id],
    queryFn: () => versoesDaMensagemDoCard(item.id),
    enabled: verVersoes,
  })
  const trocar = (m: Partial<ItemDaConversa>) => {
    for (const t of [false, true])
      clienteQuery.setQueryData<CacheConversa>(chaveDaConversa(cardId, t), (a) =>
        trocarNaConversa(a, { id: item.id, ...m }),
      )
  }
  const editar = useMutation({
    mutationFn: () => editarMensagemDoCard(item.id, texto.trim()),
    onSuccess: () => {
      trocar({
        texto: texto.trim(),
        editada_em: new Date().toISOString(),
        editada_vezes: item.editada_vezes + 1,
      })
      setEditando(false)
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para editar',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })
  const apagar = useMutation({
    mutationFn: () => apagarMensagemDoCard(item.id),
    onSuccess: () => {
      trocar({ apagada_em: new Date().toISOString(), ...(souAdmin ? {} : { texto: null }) })
      setConfirmando(false)
      void clienteQuery.invalidateQueries({ queryKey: ['card-janela', cardId] })
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para apagar',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })

  return (
    <div className="flex items-start gap-2">
      <AvatarChat nome={item.autor_nome} foto={item.autor_foto} tamanho="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className="font-semibold text-texto">{item.autor_nome}</span>
          <span className="text-texto-fraco tabular-nums">{hora(item.criada_em)}</span>
          {item.editada_em && !apagada && <span className="text-texto-fraco">· editada</span>}
        </p>
        {editando ? (
          <form
            className="mt-1 flex flex-col gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (texto.trim()) editar.mutate()
            }}
          >
            <textarea
              className="min-h-16 rounded-dm border border-borda-forte bg-superficie p-2 text-sm text-texto"
              maxLength={1000}
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              aria-label="Editar a mensagem"
            />
            <span className="flex gap-2">
              <Botao type="submit" tamanho="sm" carregando={editar.isPending}>
                Salvar
              </Botao>
              <Botao
                type="button"
                variante="fantasma"
                tamanho="sm"
                onClick={() => setEditando(false)}
              >
                Cancelar
              </Botao>
            </span>
          </form>
        ) : apagada ? (
          <p className="mt-0.5 text-sm text-texto-fraco italic">
            Mensagem apagada
            {souAdmin && item.texto && (
              <span className="mt-0.5 block text-texto-suave not-italic line-through">
                “{item.texto}”
              </span>
            )}
          </p>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-texto">
            <TextoComMencoes texto={item.texto ?? ''} mencoes={item.mencoes} />
          </p>
        )}
        {!editando && (
          <span className="mt-0.5 flex flex-wrap gap-1">
            {minha && !apagada && (
              <>
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  icone={<Pencil />}
                  className="h-8 px-2 text-xs"
                  onClick={() => {
                    setTexto(item.texto ?? '')
                    setEditando(true)
                  }}
                >
                  Editar
                </Botao>
                {confirmando ? (
                  <>
                    <Botao
                      variante="perigo"
                      tamanho="sm"
                      className="h-8 px-2 text-xs"
                      carregando={apagar.isPending}
                      onClick={() => apagar.mutate()}
                    >
                      Apagar mesmo
                    </Botao>
                    <Botao
                      variante="fantasma"
                      tamanho="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => setConfirmando(false)}
                    >
                      Não
                    </Botao>
                  </>
                ) : (
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    icone={<Trash2 />}
                    className="h-8 px-2 text-xs"
                    onClick={() => setConfirmando(true)}
                  >
                    Apagar
                  </Botao>
                )}
              </>
            )}
            {souAdmin && item.editada_vezes > 0 && (
              <Botao
                variante="fantasma"
                tamanho="sm"
                icone={<History />}
                className="h-8 px-2 text-xs"
                onClick={() => setVerVersoes((v) => !v)}
              >
                {verVersoes ? 'Esconder versões' : 'Versões anteriores'}
              </Botao>
            )}
          </span>
        )}
        {verVersoes && versoes.data && (
          <ul className="mt-1 flex flex-col gap-1 rounded-dm bg-superficie-sutil p-2 text-xs text-texto-suave">
            {versoes.data.map((v, i) => (
              <li key={i}>
                “{v.texto}”{' '}
                <span className="text-texto-fraco">— trocada em {hora(v.trocada_em)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
