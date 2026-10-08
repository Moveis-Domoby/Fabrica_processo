import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Clock, PackageMinus, Sparkles } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { formatarDuracao } from '@/kanban/tempo'
import { baixarPecaPersonalizada, listarPecasPersonalizadas } from '@/logistica/api'
import type { PecaPersonalizada } from '@/logistica/api'

const POR_VEZ = 20

/**
 * SESSAO-30 (raio-x 6): as peças livres no ESTOQUE FORA DO CATÁLOGO — a
 * personalizada (sob medida) e a de SKU que não está no catálogo, vindas de
 * pedido cancelado — não entram em número de produto nenhum. Lista própria por
 * cursor (só carrega ao abrir — regra 17) e baixa com motivo (a única saída
 * delas, como a baixa dos produtos).
 */
export function PecasPersonalizadas({
  ativo,
  agora,
  podeMexer,
}: {
  ativo: boolean
  agora: number
  podeMexer: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [baixando, setBaixando] = useState<PecaPersonalizada | null>(null)
  const { data, isPending, isFetchingNextPage, fetchNextPage, isError, error } = useInfiniteQuery({
    queryKey: ['estoque', 'personalizadas'],
    queryFn: ({ pageParam }) => listarPecasPersonalizadas({ antesId: pageParam, limite: POR_VEZ }),
    initialPageParam: null as number | null,
    getNextPageParam: (ultima) =>
      ultima.length > 0 && ultima[ultima.length - 1].tem_mais
        ? ultima[ultima.length - 1].card_id
        : undefined,
    enabled: ativo && aberto,
  })
  const pecas = data?.pages.flat() ?? []
  const temMais = pecas.length > 0 && pecas[pecas.length - 1].tem_mais

  return (
    <section aria-label="Peças fora do catálogo no ESTOQUE" className="flex flex-col gap-2">
      <Botao
        variante="fantasma"
        className="self-start"
        icone={<Sparkles />}
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        {aberto ? 'Esconder as peças fora do catálogo' : 'Peças sob medida e fora do catálogo'}
      </Botao>
      {aberto && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-texto-suave">
            Móveis sob medida ou de código fora do catálogo que sobraram de pedido cancelado. Como
            não são de nenhum produto do catálogo, não entram em número nenhum — saem daqui pela
            baixa.
          </p>
          {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
          {isError && (
            <p className="rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto">
              {error instanceof Error
                ? error.message
                : 'Não deu para carregar as peças fora do catálogo.'}
            </p>
          )}
          {!isPending && !isError && pecas.length === 0 && (
            <p className="text-sm text-texto-suave">
              Nenhuma peça personalizada parada no ESTOQUE.
            </p>
          )}
          {pecas.length > 0 && (
            <div className="rounded-dm-lg border border-borda bg-superficie px-4">
              <ul className="divide-y divide-borda">
                {pecas.map((peca) => (
                  <li
                    key={peca.card_id}
                    className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium text-texto">
                        {peca.item_descricao ?? 'Peça sem descrição'}
                      </span>
                      <span className="text-xs text-texto-suave tabular-nums">
                        {peca.item_codigo ? `SKU ${peca.item_codigo}` : 'sem SKU'}
                        {peca.origem_numero !== null &&
                          ` · veio do pedido ${peca.origem_numero}, que foi cancelado`}
                      </span>
                    </div>
                    <span className="flex shrink-0 items-center gap-3 text-xs text-texto-suave tabular-nums">
                      <span className="flex items-center gap-1">
                        <Clock aria-hidden className="size-3.5" />
                        {formatarDuracao(peca.desde, agora)}
                      </span>
                      {podeMexer && (
                        <Botao
                          variante="secundaria"
                          tamanho="sm"
                          icone={<PackageMinus />}
                          onClick={() => setBaixando(peca)}
                        >
                          Dar baixa
                        </Botao>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {temMais && (
            <Botao
              variante="fantasma"
              className="self-start"
              icone={<ChevronDown />}
              carregando={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
            >
              Ver mais
            </Botao>
          )}
        </div>
      )}
      <ModalBaixaPersonalizada
        key={baixando?.card_id ?? 'fechado'}
        peca={baixando}
        aoFechar={() => setBaixando(null)}
      />
    </section>
  )
}

function ModalBaixaPersonalizada({
  peca,
  aoFechar,
}: {
  peca: PecaPersonalizada | null
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [motivo, setMotivo] = useState('')
  const valido = motivo.trim() !== ''

  const baixar = useMutation({
    mutationFn: () => baixarPecaPersonalizada(peca!.card_id, motivo.trim()),
    onSuccess: async () => {
      notificar({
        titulo: 'Baixa feita',
        descricao: peca?.item_descricao ?? undefined,
        tom: 'perfeito',
      })
      aoFechar()
      await clienteQuery.invalidateQueries({ queryKey: ['estoque'] })
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para dar baixa',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  return (
    <Modal
      aberto={peca !== null}
      aoFechar={(v) => !v && aoFechar()}
      titulo="Dar baixa na peça"
      descricao={peca?.item_descricao ?? undefined}
    >
      {peca && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (valido) baixar.mutate()
          }}
        >
          <Campo
            rotulo="Motivo"
            placeholder="Ex.: vendida no balcão, desmontada para peças"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            autoFocus
          />
          <p className="text-sm text-texto-suave">
            A peça sai do estoque e o motivo fica na trilha dela.
          </p>
          <div className="flex flex-wrap gap-2">
            <Botao
              type="submit"
              icone={<PackageMinus />}
              disabled={!valido}
              carregando={baixar.isPending}
            >
              Dar baixa
            </Botao>
            <Botao type="button" variante="secundaria" onClick={aoFechar}>
              Cancelar
            </Botao>
          </div>
        </form>
      )}
    </Modal>
  )
}
