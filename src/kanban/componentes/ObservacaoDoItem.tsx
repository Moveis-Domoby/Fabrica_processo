import { StickyNote } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * SESSAO-50 (bloco A): a observação do ITEM no Tiny ("adicionar rodízios") — a
 * instrução que o vendedor escreve dentro do produto. Um desenho só, na capa do
 * card e na janela:
 *
 * - âmbar bem suave com o filete à esquerda — é instrução, não alerta (nada de
 *   vermelho; os tokens `atencao-*` com transparência, nenhuma cor nova);
 * - ícone de nota + o texto (cor + texto — M-12);
 * - na capa (`inteira` falso): no máximo 2 linhas com reticências, a largura do
 *   card não muda (quebra até palavra longa — sem rolagem lateral) e o texto
 *   inteiro ao passar o mouse; o leitor de tela ouve "Observação do item: …";
 * - na janela (`inteira`): o texto inteiro (o rótulo vem da seção).
 */
export function ObservacaoDoItem({
  texto,
  inteira = false,
  tamanho = 'padrao',
}: {
  texto: string
  inteira?: boolean
  /** 'galpao' = o card do tablet (letra um pouco maior, como os campos do card). */
  tamanho?: 'padrao' | 'galpao'
}) {
  const galpao = tamanho === 'galpao'
  return (
    <p
      className={cn(
        'flex min-w-0 items-start gap-1.5 rounded-sm border-l-[3px] border-atencao-borda bg-atencao-fundo/50 py-1 pr-2 pl-1.5 text-texto',
        galpao || inteira ? 'text-sm' : 'text-xs',
      )}
      title={inteira ? undefined : texto}
      data-observacao-item=""
    >
      <StickyNote
        aria-hidden
        className={cn(
          'shrink-0 text-atencao-forte',
          galpao || inteira ? 'mt-0.5 size-4' : 'mt-px size-3.5',
        )}
      />
      {!inteira && <span className="sr-only">Observação do item: </span>}
      <span className={cn('min-w-0 break-words', !inteira && 'line-clamp-2')}>
        {texto}
      </span>
    </p>
  )
}
