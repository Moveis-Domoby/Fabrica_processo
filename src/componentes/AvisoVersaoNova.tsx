import { RefreshCw } from 'lucide-react'
import { Botao } from '@/componentes/ui'

/** O aviso discreto no canto: a plataforma tem versão nova — atualizar. */
export function AvisoVersaoNova({ nova }: { nova: boolean }) {
  if (!nova) return null
  return (
    <div
      role="status"
      className="fixed bottom-24 left-3 z-50 flex max-w-xs items-center gap-3 rounded-dm-lg border border-borda bg-superficie p-3 shadow-lg sm:bottom-4"
    >
      <p className="text-sm text-texto">Saiu uma versão nova da plataforma.</p>
      <Botao tamanho="sm" icone={<RefreshCw />} onClick={() => window.location.reload()}>
        Atualizar
      </Botao>
    </div>
  )
}
