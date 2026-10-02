import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ListPlus, Pencil } from 'lucide-react'
import { Botao, useNotificacao } from '@/componentes/ui'
import type { Card } from '@/kanban/tipos'
import { definirCampo } from './api'
import { useCampos, useValoresCampos } from './consultas'
import { EntradaValorCampo } from './EntradaValorCampo'
import { textoDoValorCampo } from './tipos'
import type { CampoCustomizado, ValorCampo } from './tipos'

/**
 * Os campos customizados de um card ou de um pedido (SESSAO-27 · D-101).
 * Peça (e reposição): os campos que valem nas peças, guardados no card.
 * Card do pedido (PCP) ou o pedido: os que valem nos pedidos — guardados no
 * PEDIDO (o mesmo valor nos dois lugares). O admin preenche e limpa à mão.
 */
export function CamposDoCard({
  card,
  pedidoId,
  podeEditar,
}: {
  card?: Pick<Card, 'id' | 'tipo' | 'pedido_id'>
  pedidoId?: number | null
  podeEditar: boolean
}) {
  const noPedido = card ? card.tipo === 'pedido' : true
  const idPedido = card ? (card.tipo === 'pedido' ? card.pedido_id : null) : (pedidoId ?? null)
  const { data: catalogo = [] } = useCampos()
  const campos = catalogo.filter((c) => c.arquivado_em === null && (noPedido ? c.em_pedidos : c.em_pecas))
  const { data: valores = [] } = useValoresCampos(
    !noPedido && card ? [card.id] : [],
    noPedido && idPedido ? [idPedido] : [],
    campos.length > 0,
  )
  if (campos.length === 0 || (noPedido && !idPedido)) return null

  const valorDe = (campo: CampoCustomizado) =>
    valores.find((v) => v.campo_id === campo.id && (noPedido ? v.pedido_id === idPedido : v.card_id === card?.id))?.valor

  return (
    <section className="rounded-dm border border-borda bg-superficie-sutil p-3" aria-labelledby={`campos-${card?.id ?? idPedido}`}>
      <h3 id={`campos-${card?.id ?? idPedido}`} className="mb-2 flex items-center gap-2 text-sm font-semibold text-texto">
        <ListPlus aria-hidden className="size-4 text-texto-suave" />
        {noPedido ? 'Campos do pedido' : 'Campos da peça'}
      </h3>
      <dl className="flex flex-col gap-1.5">
        {campos.map((campo) => (
          <LinhaCampo
            key={campo.id}
            campo={campo}
            valor={valorDe(campo) ?? null}
            podeEditar={podeEditar}
            alvo={noPedido ? { pedidoId: idPedido } : { cardId: card!.id }}
          />
        ))}
      </dl>
    </section>
  )
}

function LinhaCampo({
  campo,
  valor,
  podeEditar,
  alvo,
}: {
  campo: CampoCustomizado
  valor: ValorCampo | null
  podeEditar: boolean
  alvo: { cardId?: number; pedidoId?: number | null }
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState<ValorCampo | null>(valor)
  const gravar = useMutation({
    mutationFn: (novo: ValorCampo | null) => definirCampo({ campoId: campo.id, ...alvo, valor: novo }),
    onSuccess: async () => {
      notificar({ titulo: 'Campo salvo', tom: 'perfeito' })
      setEditando(false)
      await clienteQuery.invalidateQueries({ queryKey: ['campos-valores'] })
    },
    onError: (excecao) =>
      notificar({ titulo: 'Não deu certo', descricao: excecao instanceof Error ? excecao.message : undefined, tom: 'danificado' }),
  })

  if (editando)
    return (
      <div className="flex flex-col gap-2 rounded-dm border border-borda bg-superficie p-2">
        <EntradaValorCampo campo={campo} valor={rascunho} aoMudar={setRascunho} rotulo={campo.nome} />
        <div className="flex flex-wrap gap-2">
          <Botao tamanho="sm" carregando={gravar.isPending} disabled={rascunho === null} onClick={() => gravar.mutate(rascunho)}>
            Salvar
          </Botao>
          {valor !== null && (
            <Botao tamanho="sm" variante="secundaria" carregando={gravar.isPending} onClick={() => gravar.mutate(null)}>
              Limpar
            </Botao>
          )}
          <Botao tamanho="sm" variante="fantasma" onClick={() => setEditando(false)}>
            Cancelar
          </Botao>
        </div>
      </div>
    )

  return (
    <div className="flex min-h-9 items-center gap-2 text-sm">
      <dt className="shrink-0 text-texto-suave">{campo.nome}:</dt>
      <dd className="min-w-0 flex-1 truncate font-medium text-texto">{textoDoValorCampo(campo, valor)}</dd>
      {podeEditar && (
        <Botao
          variante="fantasma"
          tamanho="sm"
          icone={<Pencil />}
          aria-label={`Editar ${campo.nome}`}
          onClick={() => {
            setRascunho(valor)
            setEditando(true)
          }}
        />
      )}
    </div>
  )
}
