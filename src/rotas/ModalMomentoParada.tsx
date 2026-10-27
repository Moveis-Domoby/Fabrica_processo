import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { Botao, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { enderecoLegivel, ordenarRotaComParadas } from './api'
import { NumeroParadaAvulsa } from './CartaoParadaAvulsa'
import { ListaArrastavel } from './ListaArrastavel'
import {
  CHAVES_PARADA_AVULSA,
  arrastavelNoCelular,
  idDoItemDoDia,
  ordemDoDiaParaOBanco,
  pendenteNoDia,
} from './paradasAvulsas'
import type { ItemDoDia } from './paradasAvulsas'

function useInvalidarParadas() {
  const clienteQuery = useQueryClient()
  return () =>
    Promise.all(
      CHAVES_PARADA_AVULSA.map((queryKey) => clienteQuery.invalidateQueries({ queryKey })),
    )
}

/**
 * SESSAO-41 (D-196, pedido do dono): "eles podem arrastar assim que adicionar
 * a nova parada avulsa e deixar o momento exato em que eles irão parar nela, o
 * resto dos pedidos eles não devem conseguir mexer". A lista compacta do que
 * falta na rota: SÓ a parada que a pessoa pôs (e ainda não fez) tem alça; o
 * resto fica travado (cadeado). "Salvar a ordem" manda a ordem inteira — a
 * parada já marcada fica onde estava. A logística reordena tudo pela
 * Programação; aqui, no celular, só a própria parada. Pedaço próprio do
 * pacote (a lista que se arrasta) — só baixa quando a janela abre (Lei §9).
 */
export default function ModalMomentoParada({
  aberto,
  itens,
  destaque,
  data,
  caminhaoId,
  rota,
  aoFechar,
}: {
  aberto: boolean
  /** A rota inteira do dia, na ordem (as entregas e as paradas). */
  itens: ItemDoDia[]
  /** A parada que acabou de entrar (fica em destaque). */
  destaque: number | null
  data: string
  caminhaoId: number
  rota: number
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const invalidar = useInvalidarParadas()
  const [rascunho, setRascunho] = useState<number[] | null>(null)

  const visiveis = useMemo(() => itens.filter(pendenteNoDia), [itens])
  const porId = useMemo(() => new Map(visiveis.map((i) => [idDoItemDoDia(i), i])), [visiveis])
  // a rota pode mudar com a janela aberta (o banco avisa): o que saiu some, o que entrou vai para o fim
  const ids = useMemo(() => {
    const naRota = visiveis.map(idDoItemDoDia)
    if (!rascunho) return naRota
    return [
      ...rascunho.filter((id) => porId.has(id)),
      ...naRota.filter((id) => !rascunho.includes(id)),
    ]
  }, [visiveis, porId, rascunho])
  const mudou = rascunho !== null && ids.some((id, i) => id !== idDoItemDoDia(visiveis[i]))

  const salvar = useMutation({
    mutationFn: () =>
      ordenarRotaComParadas({
        data,
        caminhaoId,
        rota,
        itens: ordemDoDiaParaOBanco(
          itens,
          ids.map((id) => porId.get(id)!),
        ),
      }),
    onSuccess: async () => {
      notificar({ titulo: 'O momento da parada ficou salvo', tom: 'perfeito' })
      await invalidar()
      aoFechar()
    },
    onError: async (erro) => {
      notificar({
        titulo: 'Não deu para salvar a ordem',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      })
      setRascunho(null)
      await invalidar()
    },
  })

  return (
    <Modal
      aberto={aberto}
      aoFechar={(v) => !v && aoFechar()}
      titulo="Escolha o momento da parada"
      descricao="Arraste a sua parada para o lugar em que o caminhão vai parar nela. Os pedidos seguem a ordem da logística — ficam travados."
      tamanho="galpao"
      rodape={
        <>
          <Botao tamanho="lg" variante="secundaria" onClick={aoFechar} disabled={salvar.isPending}>
            Agora não
          </Botao>
          <Botao
            tamanho="lg"
            icone={<Save />}
            disabled={!mudou}
            carregando={salvar.isPending}
            onClick={() => salvar.mutate()}
          >
            Salvar a ordem
          </Botao>
        </>
      }
    >
      {ids.length === 0 ? (
        <p className="text-sm text-texto-suave">Nada para fazer nesta rota.</p>
      ) : (
        <ListaArrastavel
          ids={ids}
          rotulo="O que falta na rota, na ordem"
          aoReordenar={setRascunho}
          arrastavel={(id) => {
            const item = porId.get(id)
            return item ? arrastavelNoCelular(item) : false
          }}
        >
          {(id, indice) => {
            const item = porId.get(id)
            if (!item) return null
            const emDestaque = item.tipo === 'avulsa' && item.parada.id === destaque
            return (
              <div
                className={cn(
                  'flex min-h-toque-lg items-center gap-3 rounded-dm border bg-superficie px-3 py-2',
                  emDestaque ? 'border-acao-ativa ring-2 ring-acao-ativa' : 'border-borda',
                )}
              >
                {item.tipo === 'avulsa' ? (
                  <NumeroParadaAvulsa numero={indice + 1} />
                ) : (
                  <span
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-acao text-xs font-bold text-acao-texto tabular-nums"
                    aria-label={`${indice + 1}ª parada`}
                  >
                    {indice + 1}
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  {item.tipo === 'avulsa' ? (
                    <>
                      <span className="truncate font-medium text-texto">
                        {item.parada.titulo}
                        {item.parada.sou_autor && (
                          <span className="font-normal text-texto-suave"> · sua parada</span>
                        )}
                      </span>
                      <span className="truncate text-xs text-texto-suave">
                        Parada avulsa · {item.parada.endereco}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="truncate font-medium text-texto">
                        Pedido {item.entrega.numero} · {item.entrega.cliente_nome || 'Sem cliente'}
                      </span>
                      <span className="truncate text-xs text-texto-suave">
                        {enderecoLegivel(item.entrega)}
                      </span>
                    </>
                  )}
                </span>
              </div>
            )
          }}
        </ListaArrastavel>
      )}
    </Modal>
  )
}
