import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CircleCheckBig } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { concluirCardAvulso } from '../avulso'
import { nomeDoCard } from '../rotulos'
import type { Card } from '../tipos'

/**
 * O "Concluir" do card avulso (D-125 resp. 2): em qualquer setor; o tempo
 * aberto fecha e o card vai para "Concluídos" no Lançamento manual. No tablet,
 * o PIN vem antes (operadorId).
 */
export function ModalConcluirAvulso({
  card,
  operadorId,
  aoFechar,
}: {
  card: Card | null
  operadorId?: string
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [observacao, setObservacao] = useState('')
  const concluir = useMutation({
    mutationFn: () => concluirCardAvulso({ cardId: card!.id, observacao, operadorId }),
    onSuccess: async () => {
      notificar({
        titulo: 'Card concluído — está em Concluídos, no Lançamento manual do PCP',
        tom: 'perfeito',
      })
      aoFechar()
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['quadro'] }),
        clienteQuery.invalidateQueries({ queryKey: ['avulsos'] }),
      ])
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para concluir',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  return (
    <Modal
      aberto={card !== null}
      aoFechar={(v) => !v && aoFechar()}
      titulo="Concluir o card"
      descricao={card ? nomeDoCard(card) : undefined}
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            icone={<CircleCheckBig />}
            carregando={concluir.isPending}
            onClick={() => concluir.mutate()}
          >
            Concluir
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-texto">
          O card sai do quadro e vai para <strong>Concluídos</strong>. Se alguém estava trabalhando
          nele, o tempo fecha agora.
        </p>
        <Campo
          rotulo="Observação (opcional)"
          maxLength={300}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex.: lâmina trocada, testada"
        />
      </div>
    </Modal>
  )
}
