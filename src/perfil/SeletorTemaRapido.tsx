import * as RadixSelect from '@radix-ui/react-select'
import { useMutation } from '@tanstack/react-query'
import { Check, Palette } from 'lucide-react'
import { useNotificacao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { salvarTema } from './api'
import { AMOSTRA_TEMA, ROTULO_TEMA, TEMAS, aplicarTema, ehTema } from './tema'
import type { Tema } from './tema'

/**
 * O seletor de TEMA do rodapé do menu (SESSAO-27 · D-100 — pedido do dono: "o
 * símbolo de configurações será agora um símbolo de tema para escolher o tema
 * com um campinho pequeno de select"). Mesmo comportamento do Meu Perfil:
 * aplica na hora e o banco guarda em seguida; se não gravar, volta ao tema
 * guardado. A lista abre num portal do Radix (nunca cortada pela gaveta).
 */
export function SeletorTemaRapido({ recolhida }: { recolhida: boolean }) {
  // Com a barra recolhida, a lista abre para o lado (não há espaço acima).
  const lado = recolhida ? 'right' : 'top'
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
    <RadixSelect.Root
      value={escolhido}
      onValueChange={(valor) => {
        if (!ehTema(valor) || valor === temaAtual) return
        aplicarTema(valor)
        trocar.mutate(valor)
      }}
    >
      <RadixSelect.Trigger
        aria-label={`Tema da plataforma: ${ROTULO_TEMA[escolhido]}`}
        title="Tema"
        className="toque-seguro inline-flex h-toque-md w-toque-md items-center justify-center rounded-dm text-grafite-100 transition-colors hover:bg-grafite-600"
      >
        <Palette aria-hidden className="size-5" />
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          side={lado}
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-[56] max-h-80 min-w-44 overflow-hidden rounded-dm border border-borda bg-superficie shadow-lg"
        >
          <RadixSelect.Viewport className="p-1">
            {TEMAS.map((tema) => (
              <RadixSelect.Item
                key={tema}
                value={tema}
                className="flex h-toque-md cursor-pointer items-center gap-2 rounded-[0.4rem] px-2 text-sm text-texto outline-none data-[highlighted]:bg-superficie-sutil"
              >
                <span
                  aria-hidden
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-borda"
                  style={{ background: AMOSTRA_TEMA[tema].fundo }}
                >
                  <span className="size-2 rounded-full" style={{ background: AMOSTRA_TEMA[tema].acao }} />
                </span>
                <RadixSelect.ItemText>{ROTULO_TEMA[tema]}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="ml-auto">
                  <Check aria-hidden className="size-4 text-acao-ativa" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}
