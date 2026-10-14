import { useInfiniteQuery } from '@tanstack/react-query'
import { ChevronDown, ClipboardList, PackageCheck } from 'lucide-react'
import { Botao, Modal } from '@/componentes/ui'
import { listarDevolucoes } from '../devolucao'

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * SESSAO-31 (D-129): as devoluções em decisão — de um produto (a linha "em
 * decisão pós devolução" do cartão do Estoque) ou todas. Lista por cursor, 20
 * por vez, só ao abrir; cada uma abre a telinha "Decidir situação".
 */
export function ModalDevolucoes({
  aberto,
  produto,
  aoFechar,
  aoDecidir,
}: {
  aberto: boolean
  /** Só as que têm peça deste produto; nulo = todas. */
  produto: { tinyId: number; descricao: string } | null
  aoFechar: () => void
  aoDecidir: (cardId: number) => void
}) {
  const consulta = useInfiniteQuery({
    queryKey: ['devolucoes', produto?.tinyId ?? null],
    queryFn: ({ pageParam }) =>
      listarDevolucoes({ produtoTinyId: produto?.tinyId ?? null, antesId: pageParam, limite: 20 }),
    initialPageParam: null as number | null,
    getNextPageParam: (ultima) =>
      ultima.length > 0 && ultima[ultima.length - 1].tem_mais ? ultima[ultima.length - 1].evento_id : undefined,
    enabled: aberto,
    gcTime: 0,
  })
  const linhas = consulta.data?.pages.flat() ?? []

  return (
    <Modal
      aberto={aberto}
      aoFechar={(v) => !v && aoFechar()}
      titulo="Em decisão pós devolução"
      descricao={produto ? produto.descricao : 'Todas as devoluções esperando a logística'}
    >
      {consulta.isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {!consulta.isPending && linhas.length === 0 && (
        <p className="text-sm text-texto-suave">Nenhuma devolução esperando decisão.</p>
      )}
      <ul className="flex flex-col divide-y divide-borda">
        {linhas.map((d) => (
          <li key={d.evento_id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-medium text-texto">Pedido {d.numero}</span>
              <span className="text-texto-suave"> · {d.cliente_nome || 'sem cliente'}</span>
              <span className="block text-xs text-texto-suave">
                {d.pecas} {d.pecas === 1 ? 'peça' : 'peças'} · {d.motivo ?? 'sem motivo'} · {quando(d.quando)}
                {d.quem ? ` · ${d.quem}` : ''}
              </span>
              {d.entregue && (
                <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-info-fundo px-2 py-0.5 text-xs font-medium text-info-texto">
                  <PackageCheck aria-hidden className="size-3.5" />
                  Já tinha sido entregue
                </span>
              )}
            </span>
            <Botao icone={<ClipboardList />} onClick={() => aoDecidir(d.card_id)}>
              Decidir situação
            </Botao>
          </li>
        ))}
      </ul>
      {consulta.hasNextPage && (
        <Botao
          variante="fantasma"
          icone={<ChevronDown />}
          className="mt-2 min-h-toque-md"
          carregando={consulta.isFetchingNextPage}
          onClick={() => consulta.fetchNextPage()}
        >
          Ver mais
        </Botao>
      )}
    </Modal>
  )
}
