import { RefreshCw } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { recarregar } from '@/lib/recarga'

/**
 * O aviso discreto no canto: a plataforma tem versão nova — atualizar.
 *
 * SESSAO-48 (frente 5): no tablet e na TV (`sozinha`) a plataforma se atualiza
 * sozinha no momento seguro (1 minuto sem uso, nenhuma janela aberta) — o
 * aviso diz isso, e o botão tem o tamanho de toque do galpão. Tocar em
 * "Atualizar" fica na trilha como "tocou em Atualizar".
 */
export function AvisoVersaoNova({ nova, sozinha = false }: { nova: boolean; sozinha?: boolean }) {
  if (!nova) return null
  return (
    <div
      role="status"
      className={cn(
        'fixed bottom-24 left-3 z-50 flex items-center gap-3 rounded-dm-lg border border-borda bg-superficie p-3 shadow-lg sm:bottom-4',
        sozinha ? 'max-w-sm' : 'max-w-xs',
      )}
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-sm text-texto">Saiu uma versão nova da plataforma.</p>
        {sozinha && (
          <p className="text-xs text-texto-suave">
            Ela se atualiza sozinha depois de 1 minuto sem uso.
          </p>
        )}
      </div>
      <Botao
        tamanho={sozinha ? 'galpao' : 'md'}
        icone={<RefreshCw />}
        onClick={() => recarregar('versao_nova_botao')}
      >
        Atualizar
      </Botao>
    </div>
  )
}
