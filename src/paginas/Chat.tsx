import { useSearchParams } from 'react-router'
import { MessageCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ListaConversas } from '@/chat/componentes/ListaConversas'
import { PainelConversa } from '@/chat/componentes/PainelConversa'

/**
 * Início → Chat (SESSAO-26): a tela cheia do chat — lista à esquerda,
 * conversa à direita; no celular, uma coisa por vez. A conversa aberta vive
 * na URL (?c=), então o Voltar e o link funcionam. O balão e esta tela usam
 * as MESMAS consultas (um dado, um fetcher).
 */
export function Chat() {
  const [parametros, setParametros] = useSearchParams()
  const selecionada = Number(parametros.get('c')) || null

  function escolher(conversaId: number | null) {
    setParametros(conversaId ? { c: String(conversaId) } : {})
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <MessageCircle aria-hidden className="size-6 text-texto-suave" />
        <h1 className="text-2xl sm:text-3xl">Chat</h1>
      </div>
      {/* grid-cols-1 = minmax(0,1fr): sem ele, no celular a coluna implícita
          cresce até o título numa linha só e a conversa é cortada à direita
          (achado da F-07 a 375px). */}
      <div className="grid h-[calc(100dvh-12rem)] min-h-[26rem] grid-cols-1 overflow-hidden rounded-dm-lg border border-borda bg-superficie lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div
          className={cn(
            'min-h-0 min-w-0 border-borda lg:border-r',
            selecionada !== null && 'hidden lg:block',
          )}
        >
          <ListaConversas selecionada={selecionada} aoEscolher={escolher} />
        </div>
        <div className={cn('min-h-0 min-w-0', selecionada === null && 'hidden lg:block')}>
          {selecionada === null ? (
            <p className="flex h-full items-center justify-center p-6 text-center text-sm text-texto-fraco">
              Escolha uma conversa para abrir.
            </p>
          ) : (
            <PainelConversa
              key={selecionada}
              conversaId={selecionada}
              aoVoltar={() => escolher(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
