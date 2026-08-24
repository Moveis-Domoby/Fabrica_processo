import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Botao } from './Botao'

export interface ModalProps {
  aberto: boolean
  aoFechar: (aberto: boolean) => void
  titulo: string
  descricao?: string
  children?: ReactNode
  /** Ações do rodapé — a primária vai à direita no desktop, e em cima no celular. */
  rodape?: ReactNode
  /** `galpao` ocupa a tela inteira no tablet: menos mira, menos erro. */
  tamanho?: 'md' | 'galpao'
}

/**
 * Modal acessível (Radix Dialog): trava foco, fecha no ESC e no clique fora.
 * No celular ele sobe do rodapé (bottom sheet) — alcance do polegar.
 */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  rodape,
  tamanho = 'md',
}: ModalProps) {
  return (
    <Dialog.Root open={aberto} onOpenChange={aoFechar}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-grafite-950/60" />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex flex-col bg-superficie shadow-2xl',
            'inset-x-0 bottom-0 max-h-[90dvh] rounded-t-dm-lg',
            'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-dm-lg',
            tamanho === 'galpao' ? 'sm:w-[min(48rem,92vw)]' : 'sm:w-[min(32rem,92vw)]',
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-borda p-4 sm:p-5">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="font-marca text-lg font-semibold text-texto sm:text-xl">
                {titulo}
              </Dialog.Title>
              {descricao ? (
                <Dialog.Description className="text-sm text-texto-suave">
                  {descricao}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{titulo}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Botao variante="fantasma" tamanho="sm" aria-label="Fechar" className="shrink-0 px-2">
                <X aria-hidden className="size-5" />
              </Botao>
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto p-4 sm:p-5">{children}</div>

          {rodape && (
            <div className="flex flex-col-reverse gap-2 border-t border-borda p-4 sm:flex-row sm:justify-end sm:p-5">
              {rodape}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
