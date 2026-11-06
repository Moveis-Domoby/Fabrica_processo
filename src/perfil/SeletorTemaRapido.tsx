import { useMutation } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useNotificacao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { cn } from '@/lib/cn'
import { salvarTema } from './api'
import { AMOSTRA_TEMA, ROTULO_TEMA, TEMAS, aplicarTema, ehTema } from './tema'
import type { Tema } from './tema'

/**
 * Os temas no mini menu do rodapé da barra lateral. Origem: SESSAO-27 · D-100
 * (a engrenagem virou o seletor de tema, um "campinho pequeno de select");
 * ↩️ ajuste do dono de 06/11: busca, tema e sair moram num mini menu ao lado
 * do nome — aqui os temas aparecem em lista (amostra + nome), sem uma segunda
 * janela por cima do mini menu. Mesmo comportamento do Meu Perfil: aplica na
 * hora e o banco guarda em seguida; se não gravar, volta ao tema guardado.
 */
export function TemasDoMenu() {
  const { perfil, recarregarPerfil } = useSessao()
  const notificar = useNotificacao()
  const temaAtual: Tema = perfil && ehTema(perfil.tema) ? perfil.tema : 'claro'

  const trocar = useMutation({
    mutationFn: (tema: Tema) => salvarTema(perfil!.id, tema),
    onSuccess: () => void recarregarPerfil(),
    onError: () => {
      aplicarTema(temaAtual)
      notificar({ titulo: 'Não consegui guardar o tema. Tente de novo.', tom: 'danificado' })
    },
  })

  if (!perfil) return null
  const escolhido = trocar.isPending && trocar.variables ? trocar.variables : temaAtual

  return (
    <div role="radiogroup" aria-label="Tema da plataforma" className="grid grid-cols-2 gap-0.5">
      {TEMAS.map((tema) => {
        const marcado = tema === escolhido
        return (
          <button
            key={tema}
            type="button"
            role="radio"
            aria-checked={marcado}
            onClick={() => {
              if (tema === temaAtual) return
              aplicarTema(tema)
              trocar.mutate(tema)
            }}
            className={cn(
              'flex min-h-toque-md items-center gap-2 rounded-[0.4rem] px-2 text-left text-[0.8125rem] text-texto transition-colors hover:bg-superficie-sutil [@media(pointer:fine)]:min-h-8',
              marcado && 'bg-superficie-sutil font-semibold',
            )}
          >
            <span
              aria-hidden
              className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-borda"
              style={{ background: AMOSTRA_TEMA[tema].fundo }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: AMOSTRA_TEMA[tema].acao }}
              />
            </span>
            <span className="min-w-0 flex-1 truncate">{ROTULO_TEMA[tema]}</span>
            {marcado && <Check aria-hidden className="size-3.5 shrink-0 text-acao-ativa" />}
          </button>
        )
      })}
    </div>
  )
}
