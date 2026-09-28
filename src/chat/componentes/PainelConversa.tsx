import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, UIEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Cake, SendHorizontal, Users } from 'lucide-react'
import { Botao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { enviarMensagem, marcarLida } from '../api'
import { acharConversa, aplicarLida, aplicarMensagemNova } from '../cache'
import type { CacheConversas } from '../cache'
import {
  chaveConversa,
  chaveConversas,
  chaveMensagens,
  juntarMensagem,
  useMensagens,
  useResumoConversa,
} from '../consultas'
import { useChat } from '../contexto'
import { chaveDoDia, horaDaMensagem, rotuloDoDia } from '../formato'
import type { ConversaResumo, MensagemChat } from '../tipos'
import { AvatarChat } from './AvatarChat'
import { ModalMembros } from './ModalMembros'

/**
 * Uma conversa aberta (SESSAO-26). Abrir = UMA assinatura de websocket (o
 * canal da conversa) + UMA página de 10 mensagens; "ver anteriores" traz a
 * página de antes; fechar desinscreve e joga o cache fora. Mensagem nova de
 * quem está do outro lado chega pelo websocket; a minha volta do próprio POST.
 * Quem usa monta com `key={conversaId}` (cada conversa nasce limpa).
 */
export function PainelConversa({
  conversaId,
  aoVoltar,
  compacto = false,
}: {
  conversaId: number
  aoVoltar?: () => void
  compacto?: boolean
}) {
  const { perfil } = useSessao()
  const eu = perfil?.id ?? ''
  const souAdmin = perfil?.papel === 'admin'
  const { pronto, definirConversaVisivel } = useChat()
  const clienteQuery = useQueryClient()
  const notificar = useNotificacao()

  const { resumo, carregando, erro } = useResumoConversa(eu, conversaId, pronto)
  const mensagens = useMensagens(eu, conversaId)
  const paginas = mensagens.data?.pages
  const ordenadas = useMemo(() => (paginas ?? []).flat().slice().reverse(), [paginas])
  const ultima = ordenadas[ordenadas.length - 1]
  const ultimaId = ultima?.id ?? null

  const [texto, setTexto] = useState('')
  const [membrosAberto, setMembrosAberto] = useState(false)
  const [abaVisivel, setAbaVisivel] = useState(() => document.visibilityState === 'visible')
  const rolagem = useRef<HTMLDivElement>(null)
  const posicionou = useRef(false)
  const pertoDoFim = useRef(true)
  const antesDeCarregar = useRef<{ altura: number; topo: number } | null>(null)

  // Esta conversa está à vista: mensagem nova nela não vira "não lida".
  useEffect(() => {
    definirConversaVisivel(conversaId)
    return () => definirConversaVisivel(null)
  }, [conversaId, definirConversaVisivel])

  useEffect(() => {
    const aoMudar = () => setAbaVisivel(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', aoMudar)
    return () => document.removeEventListener('visibilitychange', aoMudar)
  }, [])

  // Lida (POST) quando há algo novo e a aba está à vista. O badge cai na hora.
  const ultimaLida = resumo?.ultima_lida_id ?? 0
  useEffect(() => {
    if (ultimaId === null || !abaVisivel || ultimaId <= ultimaLida) return
    const espera = setTimeout(() => {
      clienteQuery.setQueryData<CacheConversas>(chaveConversas(eu), (c) =>
        c ? aplicarLida(c, conversaId, ultimaId) : c,
      )
      clienteQuery.setQueryData<ConversaResumo | null>(chaveConversa(eu, conversaId), (r) =>
        r ? { ...r, ultima_lida_id: Math.max(r.ultima_lida_id, ultimaId), nao_lidas: 0 } : r,
      )
      void marcarLida(conversaId, ultimaId).catch(() => {
        // falhou: o ponteiro fica onde estava e a próxima leitura corrige
      })
    }, 400)
    return () => clearTimeout(espera)
  }, [ultimaId, ultimaLida, abaVisivel, conversaId, eu, clienteQuery])

  // Rolagem: abre no fim; página antiga carregada não mexe no que se lê;
  // mensagem nova desce sozinha se a pessoa já estava no fim (ou é dela).
  useLayoutEffect(() => {
    const caixa = rolagem.current
    if (!caixa || ordenadas.length === 0) return
    if (!posicionou.current) {
      caixa.scrollTop = caixa.scrollHeight
      posicionou.current = true
      return
    }
    const antes = antesDeCarregar.current
    if (antes) {
      caixa.scrollTop = caixa.scrollHeight - antes.altura + antes.topo
      antesDeCarregar.current = null
    }
  }, [ordenadas.length])

  useLayoutEffect(() => {
    const caixa = rolagem.current
    if (!caixa || !posicionou.current || !ultima) return
    if (pertoDoFim.current || ultima.autor_id === eu) caixa.scrollTop = caixa.scrollHeight
  }, [ultima, eu])

  function carregarAnteriores() {
    const caixa = rolagem.current
    if (!caixa || !mensagens.hasNextPage || mensagens.isFetchingNextPage) return
    antesDeCarregar.current = { altura: caixa.scrollHeight, topo: caixa.scrollTop }
    void mensagens.fetchNextPage()
  }

  function aoRolar(evento: UIEvent<HTMLDivElement>) {
    const caixa = evento.currentTarget
    pertoDoFim.current = caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight < 120
    if (posicionou.current && caixa.scrollTop < 80) carregarAnteriores()
  }

  const enviar = useMutation({
    mutationFn: (conteudo: string) => enviarMensagem(conversaId, conteudo),
    onSuccess: (msg: MensagemChat) => {
      setTexto('')
      clienteQuery.setQueryData(chaveMensagens(eu, conversaId), (atual: Parameters<typeof juntarMensagem>[0]) =>
        juntarMensagem(atual, msg),
      )
      const lista = clienteQuery.getQueryData<CacheConversas>(chaveConversas(eu))
      if (lista && acharConversa(lista, conversaId)) {
        clienteQuery.setQueryData(
          chaveConversas(eu),
          aplicarMensagemNova(
            lista,
            {
              conversa_id: conversaId,
              tipo_conversa: resumo?.tipo ?? 'particular',
              nome_conversa: resumo?.titulo ?? null,
              mensagem_id: msg.id,
              autor_id: eu,
              autor_nome: msg.autor_nome,
              autor_foto: msg.autor_foto,
              previa: msg.texto.slice(0, 80),
              criada_em: msg.criada_em,
            },
            { eu, visivel: true },
          ).cache,
        )
      } else {
        // conversa nova (a particular aparece na lista com a 1ª mensagem)
        void clienteQuery.resetQueries({ queryKey: chaveConversas(eu) })
      }
    },
    onError: (e: Error) => notificar({ titulo: 'Mensagem não enviada', descricao: e.message, tom: 'danificado' }),
  })

  function aoEnviar(evento?: FormEvent) {
    evento?.preventDefault()
    const conteudo = texto.trim()
    if (!conteudo || enviar.isPending) return
    enviar.mutate(conteudo)
  }

  function aoTeclar(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === 'Enter' && !evento.shiftKey && !evento.nativeEvent.isComposing) {
      evento.preventDefault()
      aoEnviar()
    }
  }

  if (erro && !resumo) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-texto-suave">Esta conversa não está mais disponível para você.</p>
        {aoVoltar && (
          <Botao variante="secundaria" icone={<ArrowLeft />} onClick={aoVoltar}>
            Voltar às conversas
          </Botao>
        )}
      </div>
    )
  }

  const titulo = resumo?.titulo ?? (carregando ? 'Carregando…' : 'Conta excluída')
  const subtitulo = !resumo
    ? ''
    : resumo.tipo === 'canal'
      ? `${resumo.membros} pessoa${resumo.membros === 1 ? '' : 's'} no canal`
      : resumo.tipo === 'avisos'
        ? resumo.pode_escrever
          ? 'Todos leem · você pode escrever'
          : 'Todos leem · só quem o admin liberou escreve'
        : resumo.outro_ativo === false
          ? 'Esta pessoa não está mais ativa'
          : 'Conversa particular — só vocês dois leem'
  const mostraPessoas = resumo && (resumo.tipo === 'canal' || (resumo.tipo === 'avisos' && souAdmin))

  return (
    <section aria-label={`Conversa: ${titulo}`} className="flex h-full min-h-0 flex-col">
      <header className={cn('flex items-center gap-2 border-b border-borda', compacto ? 'px-2 py-1.5' : 'px-3 py-2')}>
        {aoVoltar && (
          <button
            type="button"
            onClick={aoVoltar}
            aria-label="Voltar às conversas"
            className="toque-seguro inline-flex h-toque-md w-toque-md shrink-0 items-center justify-center rounded-dm text-texto-suave hover:bg-superficie-sutil"
          >
            <ArrowLeft aria-hidden className="size-5" />
          </button>
        )}
        <AvatarChat tipo={resumo?.tipo ?? 'particular'} nome={titulo} foto={resumo?.foto_caminho} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-texto">{titulo}</p>
          {subtitulo && <p className="truncate text-xs text-texto-suave">{subtitulo}</p>}
        </div>
        {mostraPessoas && (
          <Botao
            variante="fantasma"
            tamanho="sm"
            icone={<Users />}
            onClick={() => setMembrosAberto(true)}
            aria-label={resumo.tipo === 'avisos' ? 'Quem escreve nos avisos' : 'Pessoas do canal'}
          >
            {!compacto && (resumo.tipo === 'avisos' ? 'Quem escreve' : 'Pessoas')}
          </Botao>
        )}
      </header>

      <div
        ref={rolagem}
        onScroll={aoRolar}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3"
        aria-live="polite"
        aria-relevant="additions"
      >
        {mensagens.hasNextPage && (
          <div className="flex justify-center pb-2">
            <Botao
              variante="fantasma"
              tamanho="sm"
              carregando={mensagens.isFetchingNextPage}
              onClick={carregarAnteriores}
            >
              Ver mensagens anteriores
            </Botao>
          </div>
        )}
        {mensagens.isPending && (
          <p className="my-auto text-center text-sm text-texto-fraco">Abrindo a conversa…</p>
        )}
        {mensagens.isError && (
          <p className="my-auto text-center text-sm text-danificado-texto">{mensagens.error.message}</p>
        )}
        {!mensagens.isPending && ordenadas.length === 0 && !mensagens.isError && (
          <p className="my-auto text-center text-sm text-texto-fraco">Nenhuma mensagem ainda.</p>
        )}
        {ordenadas.map((m, indice) => {
          const anterior = ordenadas[indice - 1]
          const novoDia = !anterior || chaveDoDia(anterior.criada_em) !== chaveDoDia(m.criada_em)
          const emSequencia =
            !novoDia && anterior?.autor_id === m.autor_id && anterior?.tipo === 'texto' && m.tipo === 'texto'
          return (
            <div key={m.id} className="flex flex-col">
              {novoDia && (
                <p className="my-2 self-center rounded-full bg-superficie-sutil px-3 py-0.5 text-xs text-texto-suave">
                  {rotuloDoDia(m.criada_em)}
                </p>
              )}
              <Bolha
                mensagem={m}
                minha={m.autor_id === eu}
                mostrarAutor={!emSequencia && resumo?.tipo !== 'particular'}
                mostrarAvatar={!emSequencia}
              />
            </div>
          )
        })}
      </div>

      {resumo && !resumo.pode_escrever ? (
        <p className="border-t border-borda px-3 py-3 text-center text-sm text-texto-suave">
          {resumo.tipo === 'avisos'
            ? 'Só quem o admin liberou escreve nos Avisos gerais.'
            : 'Esta pessoa não está mais ativa — a conversa fica só para leitura.'}
        </p>
      ) : (
        <form onSubmit={aoEnviar} className="flex items-end gap-2 border-t border-borda p-2">
          <label htmlFor={`chat-texto-${conversaId}`} className="sr-only">
            Mensagem
          </label>
          <textarea
            id={`chat-texto-${conversaId}`}
            rows={1}
            maxLength={2000}
            value={texto}
            placeholder="Escreva uma mensagem"
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
            type="submit"
            aria-label="Enviar mensagem"
            icone={<SendHorizontal />}
            carregando={enviar.isPending}
            disabled={!texto.trim()}
            className="h-toque-md w-toque-md shrink-0 px-0"
          />
        </form>
      )}

      {resumo && mostraPessoas && (
        <ModalMembros
          eu={eu}
          resumo={resumo}
          souAdmin={souAdmin}
          aberto={membrosAberto}
          aoFechar={() => setMembrosAberto(false)}
        />
      )}
    </section>
  )
}

function Bolha({
  mensagem,
  minha,
  mostrarAutor,
  mostrarAvatar,
}: {
  mensagem: MensagemChat
  minha: boolean
  mostrarAutor: boolean
  mostrarAvatar: boolean
}) {
  if (mensagem.tipo === 'aniversario') {
    return (
      <div className="my-1 flex max-w-[92%] items-start gap-2 self-center rounded-dm-lg border-2 border-acao-ativa bg-superficie px-3 py-2">
        <Cake aria-hidden className="mt-0.5 size-5 shrink-0 text-texto" />
        <div className="min-w-0">
          <p className="whitespace-pre-wrap break-words text-sm text-texto">{mensagem.texto}</p>
          <p className="mt-0.5 text-xs text-texto-fraco">Sistema · {horaDaMensagem(mensagem.criada_em)}</p>
        </div>
      </div>
    )
  }
  if (minha) {
    return (
      <div className={cn('flex justify-end', mostrarAvatar && 'mt-1.5')}>
        <div className="max-w-[80%] rounded-dm-lg rounded-br-sm bg-superficie-inversa px-3 py-2 text-texto-inverso">
          <p className="whitespace-pre-wrap break-words text-sm">{mensagem.texto}</p>
          <p className="mt-0.5 text-right text-xs opacity-75">{horaDaMensagem(mensagem.criada_em)}</p>
        </div>
      </div>
    )
  }
  return (
    <div className={cn('flex items-end gap-2', mostrarAvatar && 'mt-1.5')}>
      {mostrarAvatar ? (
        <AvatarChat nome={mensagem.autor_nome} foto={mensagem.autor_foto} tamanho="sm" />
      ) : (
        <span aria-hidden className="w-8 shrink-0" />
      )}
      <div className="max-w-[80%] rounded-dm-lg rounded-bl-sm border border-borda bg-superficie-sutil px-3 py-2">
        {mostrarAutor && (
          <p className="text-xs font-semibold text-texto-suave">{mensagem.autor_nome}</p>
        )}
        <p className="whitespace-pre-wrap break-words text-sm text-texto">{mensagem.texto}</p>
        <p className="mt-0.5 text-xs text-texto-fraco">{horaDaMensagem(mensagem.criada_em)}</p>
      </div>
    </div>
  )
}
