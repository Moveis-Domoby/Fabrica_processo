import { useState } from 'react'
import { useNotificacao } from '@/componentes/ui'
import { enviarComprovantes } from './enviarComprovantes'
import type { ComprovanteEscolhido } from './enviarComprovantes'

/** O pedido que recebe os comprovantes (o card do pedido e o número que a tela mostra). */
export interface PedidoDosComprovantes {
  card_id: number
  numero: number
}

/**
 * VÁRIOS COMPROVANTES DE UMA VEZ (SESSAO-47 — pedido do dono): a escolha e o
 * envio dos comprovantes de um pedido, para a janela `ModalComprovantes`. Quem
 * usa diz o que reler quando algum arquivo sobe (`aoEnviar`).
 *
 * Cada arquivo sobe e é registrado sozinho, um depois do outro. Se todos
 * sobem, a janela fecha e a tela avisa; se algum falha, a janela fica — com o
 * porquê na linha do arquivo — e "tentar de novo" manda só o que falhou.
 */
export function useComprovantes(aoEnviar?: () => void) {
  const notificar = useNotificacao()
  const [alvo, setAlvo] = useState<(PedidoDosComprovantes & { depoisDaEntrega: boolean }) | null>(
    null,
  )
  const [itens, setItens] = useState<ComprovanteEscolhido[]>([])
  const [enviando, setEnviando] = useState(false)

  async function rodar(pedido: PedidoDosComprovantes, lista: ComprovanteEscolhido[]) {
    setEnviando(true)
    const jaSubiram = lista.filter((i) => i.estado === 'enviado').length
    const resultado = await enviarComprovantes(pedido.card_id, lista, (chave, mudanca) =>
      setItens((atuais) => atuais.map((i) => (i.chave === chave ? { ...i, ...mudanca } : i))),
    )
    setEnviando(false)
    if (resultado.enviados > 0) aoEnviar?.()
    if (resultado.falharam === 0) {
      const total = jaSubiram + resultado.enviados
      notificar({
        titulo: `${total} ${total === 1 ? 'comprovante anexado' : 'comprovantes anexados'} ao pedido ${pedido.numero}`,
        tom: 'perfeito',
      })
      setAlvo(null)
      setItens([])
    }
  }

  return {
    alvo,
    itens,
    enviando,
    /**
     * Abre a janela do pedido. Com `arquivos` (os que o entregador escolheu no
     * painel do "Entregue"), o envio começa na hora — a entrega já foi
     * registrada antes (`depoisDaEntrega`).
     */
    abrir(
      pedido: PedidoDosComprovantes,
      opcoes: { arquivos?: ComprovanteEscolhido[]; depoisDaEntrega?: boolean } = {},
    ) {
      const lista = opcoes.arquivos ?? []
      setAlvo({
        card_id: pedido.card_id,
        numero: pedido.numero,
        depoisDaEntrega: opcoes.depoisDaEntrega ?? false,
      })
      setItens(lista)
      if (lista.length > 0) void rodar(pedido, lista)
    },
    escolher: setItens,
    /** Envia o que falta: o que ainda não foi tentado e o que falhou. */
    enviar() {
      if (alvo && !enviando) void rodar(alvo, itens)
    },
    fechar() {
      if (enviando) return
      setAlvo(null)
      setItens([])
    },
  }
}

export type EnvioDeComprovantes = ReturnType<typeof useComprovantes>
