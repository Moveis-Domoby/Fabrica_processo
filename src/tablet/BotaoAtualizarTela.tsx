import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import { atualizarAPedido } from '@/lib/recarga'

/**
 * "Atualizar" no cabeçalho do tablet (ajuste de 12/11 — o dono: "Coloque um botão
 * para o tablet de recarregar a tela, isso deve sanar a parte de abaixar a tela
 * para recarregar"). No aplicativo (D-306) não existe o "puxar a tela para baixo"
 * do navegador; este botão recarrega a tela na hora, uma vez só (tocar de novo
 * enquanto recarrega não faz nada) e mostra que está recarregando — a tela do
 * tablet é lenta para ir embora e o operador tocaria de novo.
 */
export function BotaoAtualizarTela({ className }: { className?: string }) {
  const [atualizando, setAtualizando] = useState(false)
  return (
    <Botao
      variante="fantasma"
      icone={<RefreshCw />}
      carregando={atualizando}
      className={className}
      title="Atualizar a tela"
      onClick={() => {
        setAtualizando(true)
        atualizarAPedido()
      }}
    >
      {atualizando ? 'Atualizando…' : 'Atualizar'}
    </Botao>
  )
}
