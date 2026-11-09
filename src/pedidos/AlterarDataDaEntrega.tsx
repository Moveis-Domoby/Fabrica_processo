import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarClock } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { corrigirDiaDaEntrega } from '@/rotas/api'
import { diaNaFabrica, diaPorExtenso, hojeNaFabrica, problemaDoDia } from '@/rotas/diaDaEntrega'

/**
 * O que as outras telas releem quando o dia de uma entrega muda (a ficha em que
 * o botão mora relê pelo `aoMudar` — uma leitura só).
 */
const CHAVES_DO_DIA = [
  ['rotas'],
  ['programadas'],
  ['entregas-do-dia'],
  ['rotas-calendario'],
  ['pedidos-lista'],
]

/**
 * "Alterar a data da entrega" (SESSAO-47 — resposta do dono: corrigir depois é
 * só do ADMIN, na ficha do pedido, com a mesma regra: nunca um dia que ainda
 * não chegou). Quem usa o componente decide quem o vê — a ficha só o mostra ao
 * administrador; o banco confere de novo. A entrega não se edita: a correção
 * fica registrada como um fato novo, com o dia de antes e o novo. O motivo é
 * opcional. O Tiny não muda.
 */
export function AlterarDataDaEntrega({
  cardId,
  numero,
  entregueEm,
  chegouEm,
  aoMudar,
}: {
  cardId: number
  numero: number
  /** O instante da entrega que está valendo (o dia de hoje do campo). */
  entregueEm: string | null
  /** Quando o pedido chegou à plataforma — o limite de baixo do dia. */
  chegouEm?: string | null
  aoMudar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [aberto, setAberto] = useState(false)
  const [dia, setDia] = useState('')
  const [motivo, setMotivo] = useState('')
  const hoje = hojeNaFabrica()
  const atual = diaNaFabrica(entregueEm)
  const minimo = diaNaFabrica(chegouEm)
  const problema = dia ? problemaDoDia(dia, chegouEm, hoje) : null
  const mesmoDia = dia !== '' && dia === atual

  const salvar = useMutation({
    mutationFn: () => corrigirDiaDaEntrega({ cardId, dia, motivo }),
    onSuccess: async (resposta) => {
      notificar({
        titulo: resposta.mudou
          ? `Pedido ${numero}: entregue em ${diaPorExtenso(dia)}`
          : 'A entrega já estava nesse dia',
        descricao: resposta.mudou ? 'A correção ficou registrada. O Tiny não muda.' : undefined,
        tom: 'perfeito',
      })
      setAberto(false)
      aoMudar()
      await Promise.all(
        CHAVES_DO_DIA.map((queryKey) => clienteQuery.invalidateQueries({ queryKey })),
      )
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para alterar a data da entrega',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  return (
    <>
      <Botao
        variante="secundaria"
        tamanho="sm"
        icone={<CalendarClock />}
        onClick={() => {
          setDia(atual ?? '')
          setMotivo('')
          setAberto(true)
        }}
      >
        Alterar a data da entrega
      </Botao>
      <Modal
        aberto={aberto}
        aoFechar={(continuaAberto) => {
          if (!continuaAberto && !salvar.isPending) setAberto(false)
        }}
        titulo={`Alterar a data da entrega — pedido ${numero}`}
        descricao="O dia em que a entrega aconteceu de fato. A entrega não é apagada: fica registrado quem corrigiu, o dia de antes e o novo. O Tiny não muda."
        rodape={
          <>
            <Botao
              variante="secundaria"
              onClick={() => setAberto(false)}
              disabled={salvar.isPending}
            >
              Cancelar
            </Botao>
            <Botao
              icone={<CalendarClock />}
              disabled={!dia || problema !== null || mesmoDia}
              carregando={salvar.isPending}
              onClick={() => salvar.mutate()}
            >
              Salvar a data
            </Botao>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Campo
            rotulo="Dia em que foi entregue"
            type="date"
            value={dia}
            min={minimo ?? undefined}
            max={hoje}
            onChange={(e) => setDia(e.target.value)}
            erro={problema ?? undefined}
            ajuda={
              mesmoDia
                ? 'A entrega já está nesse dia — escolha outro para corrigir.'
                : 'Vale até hoje — não dá para marcar um dia que ainda não chegou.'
            }
          />
          <Campo
            rotulo="Motivo (opcional)"
            placeholder="Ex.: o entregador marcou só no dia seguinte"
            maxLength={300}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
      </Modal>
    </>
  )
}
