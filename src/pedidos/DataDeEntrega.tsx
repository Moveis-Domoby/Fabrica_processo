import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CalendarClock, CalendarX } from 'lucide-react'
import { Botao, Campo, useNotificacao } from '@/componentes/ui'
import { supabase } from '@/lib/supabase'
import { useAcessoLogistica } from '@/logistica/acesso'
import type { DetalhePedido } from '@/kanban/api'
import { data } from './formato'

/** SESSAO-41 (D-194): muda (ou remove) a data de entrega SÓ na plataforma. */
async function mudarDataDeEntrega(pedidoId: number, dia: string | null): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_pedido_data_entrega', {
    p_pedido_id: pedidoId,
    p_data: dia,
    p_remover: dia === null,
  })
  if (error) throw new Error(error.message)
}

/**
 * SESSAO-41 (D-194, pedido do dono): "a possibilidade de alterar a data de
 * entrega de um pedido, ou até mesmo de remover essa data, mas isso não deve
 * afetar o Tiny, apenas a plataforma; porém se mudar no Tiny, muda na
 * plataforma também". A data mudada vale no card, na Expedição, na
 * Programação e no calendário; o Tiny mudando a data depois, vale a do Tiny.
 */
export function DataDeEntrega({
  pedido: p,
  aoMudar,
}: {
  pedido: DetalhePedido['pedido']
  aoMudar: () => void
}) {
  const notificar = useNotificacao()
  const { tenhoAcesso } = useAcessoLogistica()
  const [editando, setEditando] = useState(false)
  const [dia, setDia] = useState(p.data_prevista ?? '')

  const mudar = useMutation({
    mutationFn: (novo: string | null) => mudarDataDeEntrega(p.id, novo),
    onSuccess: (_, novo) => {
      notificar({
        titulo: novo
          ? `Data de entrega: ${data(novo)} (o Tiny não muda)`
          : 'Data de entrega removida (o Tiny não muda)',
        tom: 'perfeito',
      })
      setEditando(false)
      aoMudar()
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para mudar a data',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  return (
    <div className="mt-1 flex flex-col gap-1.5 rounded-dm border border-borda p-2">
      <p className="text-xs font-medium text-texto-suave">Data de entrega</p>
      <p className="text-sm text-texto">
        {p.data_prevista ? data(p.data_prevista) : 'Sem data'}
        {p.data_alterada && (
          <span className="text-texto-suave">
            {' '}
            · mudada na plataforma (no Tiny:{' '}
            {p.data_prevista_tiny ? data(p.data_prevista_tiny) : 'sem data'})
          </span>
        )}
      </p>
      {tenhoAcesso &&
        (editando ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (dia) mudar.mutate(dia)
            }}
          >
            <Campo
              rotulo="Nova data"
              type="date"
              value={dia}
              onChange={(e) => setDia(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Botao
                type="submit"
                tamanho="sm"
                disabled={!dia}
                carregando={mudar.isPending && mudar.variables !== null}
              >
                Salvar a data
              </Botao>
              <Botao
                type="button"
                tamanho="sm"
                variante="secundaria"
                icone={<CalendarX />}
                carregando={mudar.isPending && mudar.variables === null}
                onClick={() => mudar.mutate(null)}
              >
                Remover a data
              </Botao>
              <Botao
                type="button"
                tamanho="sm"
                variante="fantasma"
                onClick={() => setEditando(false)}
              >
                Cancelar
              </Botao>
            </div>
            <p className="text-xs text-texto-suave">
              Vale só na plataforma — o Tiny não muda. Se o Tiny mudar a data depois, vale a do
              Tiny.
            </p>
          </form>
        ) : (
          <Botao
            tamanho="sm"
            variante="secundaria"
            icone={<CalendarClock />}
            className="self-start"
            onClick={() => {
              setDia(p.data_prevista ?? '')
              setEditando(true)
            }}
          >
            Mudar a data de entrega
          </Botao>
        ))}
    </div>
  )
}
