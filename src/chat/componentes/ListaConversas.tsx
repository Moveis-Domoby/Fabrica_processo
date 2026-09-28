import { useState } from 'react'
import type { UIEvent } from 'react'
import { Hash, MessageSquarePlus } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { rotuloContagem } from '../cache'
import { useConversas } from '../consultas'
import { useChat } from '../contexto'
import { horaNaLista, previaDaConversa } from '../formato'
import { AvatarChat } from './AvatarChat'
import { ModalNovaConversa, ModalNovoCanal } from './ModaisNovos'

/**
 * A lista de conversas (SESSAO-26): 5 por página, a mais recente no topo —
 * a próxima página só vem ao rolar até o fim ou tocar em "Ver mais" (lei do
 * dono). Tudo o que muda depois chega pelo websocket, sem reler.
 */
export function ListaConversas({
  selecionada,
  aoEscolher,
  compacta = false,
}: {
  selecionada: number | null
  aoEscolher: (conversaId: number) => void
  compacta?: boolean
}) {
  const { perfil, ehLider } = useSessao()
  const chat = useChat()
  const eu = perfil?.id ?? ''
  const conversas = useConversas(eu, chat.pronto && eu !== '')
  const itens = conversas.data?.pages.flatMap((p) => p.itens) ?? []
  const [novaConversa, setNovaConversa] = useState(false)
  const [novoCanal, setNovoCanal] = useState(false)

  function aoRolar(evento: UIEvent<HTMLUListElement>) {
    const alvo = evento.currentTarget
    const perto = alvo.scrollHeight - alvo.scrollTop - alvo.clientHeight < 80
    if (perto && conversas.hasNextPage && !conversas.isFetchingNextPage) void conversas.fetchNextPage()
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn('flex flex-wrap items-center gap-2 border-b border-borda', compacta ? 'p-2' : 'p-3')}>
        <Botao
          variante="secundaria"
          tamanho="sm"
          icone={<MessageSquarePlus />}
          onClick={() => setNovaConversa(true)}
        >
          Nova conversa
        </Botao>
        {/* Canal: só líder e admin criam (resposta 2 do dono — o banco confere). */}
        {ehLider && (
          <Botao variante="secundaria" tamanho="sm" icone={<Hash />} onClick={() => setNovoCanal(true)}>
            Novo canal
          </Botao>
        )}
      </div>

      <ul onScroll={aoRolar} aria-label="Conversas" className="min-h-0 flex-1 overflow-y-auto">
        {(conversas.isPending || !chat.pronto) && (
          <li className="px-3 py-6 text-center text-sm text-texto-fraco">Carregando conversas…</li>
        )}
        {conversas.isError && (
          <li className="px-3 py-6 text-center text-sm text-danificado-texto">{conversas.error.message}</li>
        )}
        {itens.map((c) => {
          const ativa = c.conversa_id === selecionada
          const titulo = c.titulo ?? 'Conta excluída'
          const previa = previaDaConversa({
            tipo: c.tipo,
            texto: c.ultima_previa,
            autorId: c.ultima_autor_id,
            autorNome: c.ultima_autor_nome,
            eu,
          })
          return (
            <li key={c.conversa_id}>
              <button
                type="button"
                onClick={() => aoEscolher(c.conversa_id)}
                aria-current={ativa ? 'true' : undefined}
                className={cn(
                  'flex w-full min-h-toque-lg items-center gap-3 border-b border-borda px-3 py-2.5 text-left transition-colors hover:bg-superficie-sutil',
                  ativa && 'border-l-4 border-l-acao-ativa bg-superficie-sutil pl-2',
                )}
              >
                <AvatarChat tipo={c.tipo} nome={titulo} foto={c.foto_caminho} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-sm text-texto',
                        c.nao_lidas > 0 ? 'font-bold' : 'font-medium',
                      )}
                    >
                      {titulo}
                    </span>
                    <span className="shrink-0 text-xs text-texto-fraco tabular-nums">
                      {horaNaLista(c.atividade_em)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-texto-suave">
                      {previa || ' '}
                    </span>
                    {c.nao_lidas > 0 && (
                      <span
                        className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-danificado-forte px-1.5 text-xs font-semibold text-white tabular-nums"
                        aria-label={`${rotuloContagem(c.nao_lidas)} não lida${c.nao_lidas === 1 ? '' : 's'}`}
                      >
                        {rotuloContagem(c.nao_lidas)}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
        {conversas.hasNextPage && (
          <li className="p-2">
            <Botao
              variante="fantasma"
              tamanho="sm"
              larguraTotal
              carregando={conversas.isFetchingNextPage}
              onClick={() => void conversas.fetchNextPage()}
            >
              Ver mais conversas
            </Botao>
          </li>
        )}
      </ul>

      <ModalNovaConversa
        eu={eu}
        aberto={novaConversa}
        aoFechar={() => setNovaConversa(false)}
        aoAbrir={aoEscolher}
      />
      <ModalNovoCanal
        eu={eu}
        aberto={novoCanal}
        aoFechar={() => setNovoCanal(false)}
        aoCriar={aoEscolher}
      />
    </div>
  )
}
