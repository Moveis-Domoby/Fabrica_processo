import { useState } from 'react'
import { Navigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Clock, Package, Pencil, Search, X } from 'lucide-react'
import { BadgeEstado, Botao, Campo, Paginacao, useNotificacao } from '@/componentes/ui'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import { useAcessoLogistica } from '@/logistica/acesso'
import { definirIdProducao, listarEstoque } from '@/logistica/api'
import type { LinhaEstoque } from '@/logistica/api'

const POR_PAGINA = 20
const ATUALIZA_A_CADA = 30_000

/**
 * Logística → Estoque (SESSAO-15 / D-38 / D-45): a LISTA do que está parado
 * no ESTOQUE — substitui o quadro kanban do setor. Cada unidade tem um ID de
 * produção digitável, de formato livre (o formato definitivo ainda é decisão
 * do dono), buscável e editável pela logística/admin.
 */
export function Estoque() {
  const { perfil, semAcesso, tenhoAcesso } = useAcessoLogistica()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const agora = useAgora()

  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [editando, setEditando] = useState<{ cardId: number; valor: string } | null>(null)

  const { data: linhas = [], isPending } = useQuery({
    queryKey: ['estoque', busca, pagina],
    queryFn: () =>
      listarEstoque({ busca, limite: POR_PAGINA, deslocamento: (pagina - 1) * POR_PAGINA }),
    enabled: tenhoAcesso,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const total = Number(linhas[0]?.contagem_total ?? 0)

  const gravarId = useMutation({
    mutationFn: ({ cardId, valor }: { cardId: number; valor: string }) =>
      definirIdProducao(cardId, valor),
    onSuccess: async () => {
      notificar({ titulo: 'ID de produção gravado', tom: 'perfeito' })
      setEditando(null)
      await clienteQuery.invalidateQueries({ queryKey: ['estoque'] })
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para gravar o ID',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  if (semAcesso) return <Navigate to="/" replace />
  if (!perfil) return null

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-3 text-2xl sm:text-3xl">
          <Package aria-hidden className="size-7 text-texto-suave" />
          Estoque
        </h1>
        <p className="mt-1 max-w-2xl text-texto-suave">
          O que está parado no ESTOQUE, com o ID de produção de cada unidade. Digite o ID como a
          equipe identifica a peça — o formato é livre.
        </p>
      </div>

      <div className="max-w-md">
        <Campo
          rotulo="Buscar"
          prefixo={<Search />}
          placeholder="ID de produção, produto ou número do pedido"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value)
            setPagina(1)
          }}
        />
      </div>

      {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {!isPending && linhas.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Nada parado no ESTOQUE{busca ? ' para esta busca' : ' agora'}.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {linhas.map((linha) => (
          <LinhaDoEstoque
            key={linha.card_id}
            linha={linha}
            agora={agora}
            editando={editando?.cardId === linha.card_id ? editando.valor : null}
            aoEditar={() => setEditando({ cardId: linha.card_id, valor: linha.id_producao ?? '' })}
            aoMudar={(valor) => setEditando({ cardId: linha.card_id, valor })}
            aoCancelar={() => setEditando(null)}
            aoGravar={() =>
              editando && gravarId.mutate({ cardId: linha.card_id, valor: editando.valor })
            }
            gravando={gravarId.isPending && gravarId.variables?.cardId === linha.card_id}
          />
        ))}
      </ul>

      {total > POR_PAGINA && (
        <Paginacao
          paginaAtual={pagina}
          totalPaginas={Math.ceil(total / POR_PAGINA)}
          totalItens={total}
          porPagina={POR_PAGINA}
          aoMudarPagina={setPagina}
          className="rounded-dm-lg border border-borda bg-superficie"
        />
      )}
    </div>
  )
}

function LinhaDoEstoque({
  linha,
  agora,
  editando,
  aoEditar,
  aoMudar,
  aoCancelar,
  aoGravar,
  gravando,
}: {
  linha: LinhaEstoque
  agora: number
  /** null = não está editando; string = o valor em edição. */
  editando: string | null
  aoEditar: () => void
  aoMudar: (valor: string) => void
  aoCancelar: () => void
  aoGravar: () => void
  gravando: boolean
}) {
  return (
    <li className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-texto">
            {linha.item_descricao ?? 'Sem descrição'}
          </span>
          {linha.indice_unidade !== null && (
            <span className="text-sm text-texto-suave tabular-nums">
              ({linha.indice_unidade}/{linha.total_unidades})
            </span>
          )}
          {linha.qualidade_atual && <BadgeEstado estado={linha.qualidade_atual} tamanho="sm" />}
        </div>
        <p className="text-sm text-texto-suave tabular-nums">
          Pedido {linha.numero}
          {linha.item_codigo ? ` · SKU ${linha.item_codigo}` : ''} · origem:{' '}
          {linha.origem === 'pedido' ? 'pedido' : 'produção para estoque'}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-texto-suave tabular-nums">
          <Clock aria-hidden className="size-4" />
          parado há {formatarDuracao(linha.desde, agora)}
        </p>
      </div>

      {/* O ID de produção: mostra, ou vira campo de edição inline. */}
      <div className="flex shrink-0 flex-col gap-1 sm:w-72">
        {editando === null ? (
          <div className="flex items-center gap-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs text-texto-fraco">ID de produção</span>
              <span className="truncate font-medium text-texto tabular-nums">
                {linha.id_producao ?? <span className="text-texto-fraco">sem ID</span>}
              </span>
            </span>
            <Botao
              variante="secundaria"
              tamanho="sm"
              icone={<Pencil />}
              onClick={aoEditar}
              aria-label={`Editar o ID de produção da unidade do pedido ${linha.numero}`}
            >
              {linha.id_producao ? 'Editar' : 'Definir'}
            </Botao>
          </div>
        ) : (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              aoGravar()
            }}
          >
            <Campo
              rotulo="ID de produção"
              value={editando}
              onChange={(e) => aoMudar(e.target.value)}
              placeholder="ex.: MESA-001"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') aoCancelar()
              }}
            />
            <div className="flex gap-2">
              <Botao type="submit" tamanho="sm" icone={<Check />} carregando={gravando}>
                Gravar
              </Botao>
              <Botao type="button" variante="fantasma" tamanho="sm" icone={<X />} onClick={aoCancelar}>
                Cancelar
              </Botao>
            </div>
          </form>
        )}
      </div>
    </li>
  )
}
