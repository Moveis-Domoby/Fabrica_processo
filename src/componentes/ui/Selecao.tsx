import { useId } from 'react'
import * as RadixSelect from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface OpcaoSelecao {
  valor: string
  rotulo: string
  desabilitada?: boolean
}

export interface SelecaoProps {
  rotulo: string
  opcoes: OpcaoSelecao[]
  valor?: string
  aoMudar?: (valor: string) => void
  placeholder?: string
  ajuda?: string
  erro?: string
  desabilitado?: boolean
  /** Use `galpao` quando o alvo for o dedo do operador em tablet. */
  tamanho?: 'md' | 'galpao'
  className?: string
}

/**
 * Seleção acessível (Radix). Preferida ao `<select>` nativo porque o nativo
 * não aceita alvo de toque grande nem estilização consistente entre Android e iOS.
 */
export function Selecao({
  rotulo,
  opcoes,
  valor,
  aoMudar,
  placeholder = 'Selecione…',
  ajuda,
  erro,
  desabilitado,
  tamanho = 'md',
  className,
}: SelecaoProps) {
  const id = useId()
  const idAjuda = `${id}-ajuda`
  const idErro = `${id}-erro`

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-texto">
        {rotulo}
      </label>

      <RadixSelect.Root value={valor} onValueChange={aoMudar} disabled={desabilitado}>
        <RadixSelect.Trigger
          id={id}
          aria-invalid={erro ? true : undefined}
          aria-describedby={cn(ajuda && idAjuda, erro && idErro) || undefined}
          className={cn(
            'inline-flex w-full items-center justify-between gap-2 rounded-dm border bg-superficie px-3 text-left text-texto',
            'transition-colors data-[placeholder]:text-texto-fraco',
            'disabled:cursor-not-allowed disabled:bg-superficie-sutil disabled:opacity-60',
            erro ? 'border-danificado-forte' : 'border-borda-forte',
            tamanho === 'galpao' ? 'h-toque-galpao text-xl' : 'h-toque-md text-base',
          )}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <ChevronDown aria-hidden className="size-5 text-texto-suave" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={6}
            className={cn(
              'z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden',
              'rounded-dm border border-borda bg-superficie shadow-lg',
            )}
          >
            <RadixSelect.Viewport className="p-1">
              {opcoes.map((opcao) => (
                <RadixSelect.Item
                  key={opcao.valor}
                  value={opcao.valor}
                  disabled={opcao.desabilitada}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-3 rounded-[0.4rem] px-3 outline-none',
                    'data-[highlighted]:bg-superficie-sutil data-[disabled]:opacity-50',
                    tamanho === 'galpao' ? 'h-toque-lg text-lg' : 'h-toque-md text-base',
                  )}
                >
                  <RadixSelect.ItemText>{opcao.rotulo}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator>
                    <Check aria-hidden className="size-4 text-acao-ativa" />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>

      {ajuda && !erro && (
        <p id={idAjuda} className="text-sm text-texto-suave">
          {ajuda}
        </p>
      )}
      {erro && (
        <p id={idErro} className="text-sm text-danificado-forte">
          {erro}
        </p>
      )}
    </div>
  )
}
