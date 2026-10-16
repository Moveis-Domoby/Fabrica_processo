import { useEffect, useState, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw, WifiOff } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import { aoVivoPausado, assinarPausa } from '@/chat/canais'

/** Queda curta (a rede piscou, a aba acordou) não assusta ninguém. */
const TOLERANCIA_MS = 5_000

/**
 * "Ao vivo pausado" (SESSAO-32 · Lei §10): quando a conexão ao vivo cai e não
 * volta, a tela avisa e oferece "Atualizar" — um toque = uma releitura do que
 * está na tela. Nunca liga relógio; ao voltar a conexão, o aviso some e cada
 * tela faz a releitura de recuperação dela.
 */
export function AvisoAoVivoPausado() {
  const clienteQuery = useQueryClient()
  const pausado = useSyncExternalStore(assinarPausa, aoVivoPausado, () => false)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    if (!pausado) return
    const espera = setTimeout(() => setVisivel(true), TOLERANCIA_MS)
    return () => {
      clearTimeout(espera)
      setVisivel(false)
    }
  }, [pausado])

  if (!pausado || !visivel) return null
  return (
    <div
      role="status"
      className="fixed bottom-24 left-3 z-50 flex max-w-xs items-center gap-3 rounded-dm-lg border border-atencao-forte bg-superficie p-3 shadow-lg sm:bottom-4"
    >
      <WifiOff aria-hidden className="size-5 shrink-0 text-atencao-forte" />
      <p className="text-sm text-texto">Ao vivo pausado — a conexão caiu.</p>
      <Botao
        tamanho="sm"
        variante="secundaria"
        icone={<RefreshCw />}
        onClick={() => void clienteQuery.invalidateQueries({ refetchType: 'active' })}
      >
        Atualizar
      </Botao>
    </div>
  )
}
