import { Hammer } from 'lucide-react'

/**
 * Placeholder das telas que já têm endereço mas ainda não têm conteúdo
 * (SESSAO-13): o filho nasce na rota certa e a tela de verdade chega na
 * sessão correspondente (Meu painel na 14, Logística/Caminhões na 15…).
 */
export function EmConstrucao({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl sm:text-3xl">{titulo}</h1>
      <div className="flex flex-col items-center gap-3 rounded-dm-lg border border-dashed border-borda-forte bg-superficie px-6 py-16 text-center">
        <Hammer aria-hidden className="size-10 text-texto-fraco" />
        <p className="text-lg font-medium text-texto">Em construção</p>
        <p className="max-w-md text-sm text-texto-suave">
          {descricao ?? 'Esta tela já tem endereço, mas o conteúdo ainda está sendo produzido.'}
        </p>
      </div>
    </div>
  )
}
