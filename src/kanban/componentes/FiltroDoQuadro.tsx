import { ListFilter, X } from 'lucide-react'
import { Campo } from '@/componentes/ui'
import { cn } from '@/lib/cn'

/** SESSAO-40: a lista filtrada ficou vazia — diz por quê (e não "não há nada"). */
export function NadaBateComOFiltro({ filtro }: { filtro: string }) {
  return (
    <p className="flex items-center gap-2 rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
      <ListFilter aria-hidden className="size-4 shrink-0" />
      Nenhum card bate com o filtro "{filtro}". Limpe o filtro para ver todos.
    </p>
  )
}

/**
 * SESSAO-40 (D-187): o campo de filtro do quadro — o número do pedido (ou o
 * nome do móvel) e cada coluna mostra só os cards que batem, com quantos
 * batem. O "x" limpa e o quadro volta inteiro.
 */
export function FiltroDoQuadro({
  texto,
  aoMudar,
  tamanho = 'padrao',
  className,
  rotulo = 'Filtrar o quadro',
  placeholder = 'Filtrar: nº do pedido ou nome do móvel',
}: {
  texto: string
  aoMudar: (texto: string) => void
  tamanho?: 'padrao' | 'galpao'
  className?: string
  /** ↪️ SESSAO-41 (D-199): a Programação usa o mesmo campo com o rótulo dela. */
  rotulo?: string
  placeholder?: string
}) {
  return (
    <div className={cn('relative w-full min-w-0 sm:w-80', className)}>
      <Campo
        rotulo={rotulo}
        rotuloOculto
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        prefixo={<ListFilter />}
        placeholder={placeholder}
        value={texto}
        onChange={(e) => aoMudar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && texto !== '') {
            e.stopPropagation()
            aoMudar('')
          }
        }}
        className={cn(
          'pr-11 [&::-webkit-search-cancel-button]:hidden',
          tamanho === 'galpao' && 'h-toque-lg text-lg',
        )}
      />
      {texto !== '' && (
        <button
          type="button"
          onClick={() => aoMudar('')}
          aria-label="Limpar o filtro"
          title="Limpar o filtro"
          className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center rounded-dm text-texto-suave hover:text-texto"
        >
          <X aria-hidden className="size-5" />
        </button>
      )}
    </div>
  )
}
