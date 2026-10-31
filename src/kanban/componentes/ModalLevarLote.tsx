import { Layers, Square } from 'lucide-react'
import { Botao, Modal } from '@/componentes/ui'

/**
 * SESSAO-42 ("Concluir o lote"): o card solto numa etapa que leva adiante foi
 * montado junto com outros que ainda estão rodando no setor — leva só ele ou o
 * lote inteiro? Fechar (ESC, fora) não faz nada: o card fica onde estava.
 */
export function ModalLevarLote({
  pergunta,
  aoEscolher,
  aoFechar,
  tamanho = 'padrao',
}: {
  /** null = fechado. `quantos` conta o próprio card. */
  pergunta: { quantos: number; destino: string } | null
  aoEscolher: (loteTodo: boolean) => void
  aoFechar: () => void
  tamanho?: 'padrao' | 'galpao'
}) {
  const galpao = tamanho === 'galpao'
  return (
    <Modal
      aberto={pergunta !== null}
      aoFechar={(aberto) => {
        if (!aberto) aoFechar()
      }}
      titulo={pergunta ? `Levar o lote inteiro (${pergunta.quantos})?` : 'Levar o lote inteiro?'}
      descricao={
        pergunta
          ? `Este card foi montado junto com outros que ainda estão rodando. ${pergunta.destino}`
          : undefined
      }
      rodape={
        <>
          <Botao
            variante="secundaria"
            tamanho={galpao ? 'galpao' : 'lg'}
            icone={<Square />}
            onClick={() => aoEscolher(false)}
          >
            Só este
          </Botao>
          <Botao
            tamanho={galpao ? 'galpao' : 'lg'}
            icone={<Layers />}
            onClick={() => aoEscolher(true)}
          >
            O lote todo
          </Botao>
        </>
      }
    >
      <p className="text-sm text-texto-suave">
        &quot;O lote todo&quot; leva todos para o mesmo lugar, de uma vez, e fecha o tempo de cada
        um agora.
      </p>
    </Modal>
  )
}
