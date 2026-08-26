import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as Toast from '@radix-ui/react-toast'
import { AlertTriangle, CircleCheck, Info, X, XOctagon } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  ContextoNotificacao,
  type EntradaNotificacao,
  type Notificacao,
} from './notificacao-contexto'

const ICONES = {
  perfeito: CircleCheck,
  atencao: AlertTriangle,
  danificado: XOctagon,
  informativo: Info,
} as const

const CORES = {
  perfeito: 'border-perfeito-borda bg-perfeito-fundo text-perfeito-texto',
  atencao: 'border-atencao-borda bg-atencao-fundo text-atencao-texto',
  danificado: 'border-danificado-borda bg-danificado-fundo text-danificado-texto',
  informativo: 'border-borda bg-superficie text-texto',
} as const

let proximoId = 0

/**
 * Provedor de notificações. Fica uma vez, na raiz do app.
 * No celular as notificações aparecem no TOPO (o rodapé é a zona do polegar
 * e some atrás do teclado); no tablet/desktop, no canto inferior direito.
 */
export function ProvedorNotificacao({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Notificacao[]>([])

  const notificar = useCallback((entrada: EntradaNotificacao) => {
    proximoId += 1
    setLista((atual) => [...atual, { id: proximoId, ...entrada }])
  }, [])

  const remover = useCallback((id: number) => {
    setLista((atual) => atual.filter((n) => n.id !== id))
  }, [])

  const valor = useMemo(() => notificar, [notificar])

  return (
    <ContextoNotificacao.Provider value={valor}>
      <Toast.Provider swipeDirection="right" duration={5000}>
        {children}

        {lista.map((n) => {
          const tom = n.tom ?? 'informativo'
          const Icone = ICONES[tom]
          return (
            <Toast.Root
              key={n.id}
              duration={n.duracaoMs}
              onOpenChange={(aberto) => !aberto && remover(n.id)}
              className={cn(
                'flex items-start gap-3 rounded-dm border p-4 shadow-lg',
                'data-[state=closed]:animate-out data-[state=closed]:fade-out',
                CORES[tom],
              )}
            >
              <Icone aria-hidden className="mt-0.5 size-5 shrink-0" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <Toast.Title className="font-medium">{n.titulo}</Toast.Title>
                {n.descricao && (
                  <Toast.Description className="text-sm opacity-90">
                    {n.descricao}
                  </Toast.Description>
                )}
              </div>
              <Toast.Close
                aria-label="Fechar notificação"
                className="ml-auto shrink-0 rounded p-1 opacity-70 hover:opacity-100"
              >
                <X aria-hidden className="size-4" />
              </Toast.Close>
            </Toast.Root>
          )
        })}

        <Toast.Viewport
          className={cn(
            'fixed z-[60] flex max-h-screen w-full flex-col gap-2 p-4 outline-none',
            'top-0 sm:top-auto sm:right-0 sm:bottom-0 sm:max-w-sm',
          )}
        />
      </Toast.Provider>
    </ContextoNotificacao.Provider>
  )
}
