import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNotificacao } from '@/componentes/ui'
import { salvarParadaAvulsa } from './api'
import type { DadosParadaAvulsa, ParadaAvulsa } from './api'
import { CHAVES_PARADA_AVULSA } from './paradasAvulsas'

/**
 * SESSAO-50 (bloco C — pedido do dono: "editar o local de uma parada avulsa …
 * ao invés de excluir e criar outra"): o gesto de editar a parada salva, o
 * mesmo em "Já programadas" e nas Entregas do dia. Salva pela porta de sempre
 * (com o id); o banco confere quem pode (a logística, ou quem pôs — só a
 * pendente), guarda o antes e o depois e avisa as rotas abertas. Salvar sem
 * mudar nada não registra nada (o banco diz "repetido").
 */
export function useEditarParada(aoTerminar: () => void) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  return useMutation({
    mutationFn: (v: { parada: ParadaAvulsa; dados: DadosParadaAvulsa }) =>
      salvarParadaAvulsa({
        ...v.dados,
        id: v.parada.id,
        data: v.parada.data,
        caminhaoId: v.parada.caminhao_id,
        rota: v.parada.rota,
      }),
    onSuccess: async (r, v) => {
      notificar({
        titulo: r.repetido ? 'Nada mudou na parada' : `Parada "${v.dados.titulo}" atualizada`,
        tom: 'perfeito',
      })
      aoTerminar()
      await Promise.all(
        CHAVES_PARADA_AVULSA.map((queryKey) => clienteQuery.invalidateQueries({ queryKey })),
      )
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para editar a parada',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })
}
