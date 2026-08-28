import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Botao, Campo, Modal, Paginacao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { criarCardPedido, pedidosResumo } from '../api'
import type { PedidoResumo, Setor } from '../tipos'

const POR_PAGINA = 8

export interface ModalNovoPedidoProps {
  aberto: boolean
  setorPcp: Setor
  aoFechar: () => void
}

function formatarData(iso: string | null): string {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') : '—'
}

/**
 * Cria o card de PEDIDO no PCP a partir de um pedido REAL do Tiny já gravado
 * no banco pela integração (D-22: não existe pedido avulso). Lista só o que
 * ainda não tem card; a entrada automática via n8n é a SESSAO-09.
 */
export function ModalNovoPedido({ aberto, setorPcp, aoFechar }: ModalNovoPedidoProps) {
  const { perfil } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [escolhido, setEscolhido] = useState<PedidoResumo | null>(null)
  const [erro, setErro] = useState('')

  const { data: pedidos = [], isPending } = useQuery({
    queryKey: ['pedidos-sem-card', busca, pagina],
    queryFn: () =>
      pedidosResumo({
        busca: busca || undefined,
        somenteSemCard: true,
        limite: POR_PAGINA,
        deslocamento: (pagina - 1) * POR_PAGINA,
      }),
    enabled: aberto,
  })
  const totalItens = pedidos[0]?.contagem_total ?? 0

  const mutacao = useMutation({
    mutationFn: criarCardPedido,
    onSuccess: async () => {
      notificar({ titulo: `Card do pedido ${escolhido?.numero} criado no PCP`, tom: 'perfeito' })
      setEscolhido(null)
      aoFechar()
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['cards'] }),
        clienteQuery.invalidateQueries({ queryKey: ['pedidos-sem-card'] }),
        clienteQuery.invalidateQueries({ queryKey: ['pedidos-resumo'] }),
      ])
    },
    onError: (excecao) =>
      setErro(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.'),
  })

  function aoCriar() {
    if (!perfil) return
    if (!escolhido) {
      setErro('Escolha um pedido da lista.')
      return
    }
    setErro('')
    mutacao.mutate({
      pedidoId: escolhido.pedido_id,
      setorPcpId: setorPcp.id,
      usuarioId: perfil.id,
    })
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={(estaAberto) => {
        if (!estaAberto) aoFechar()
      }}
      titulo="Novo card de pedido"
      // D-22/D-31: card só nasce de pedido real; o novo entra sozinho pelo banco.
      descricao="Pedido novo do Tiny entra sozinho. Esta lista serve para trazer pedidos antigos que ficaram de fora do kanban."
      tamanho="galpao"
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao carregando={mutacao.isPending} onClick={aoCriar} disabled={!escolhido}>
            Criar card no PCP
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo
          rotulo="Buscar pedido"
          prefixo={<Search />}
          placeholder="Número do pedido ou nome do cliente"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value)
            setPagina(1)
            setEscolhido(null)
          }}
        />

        <ul className="flex flex-col divide-y divide-borda rounded-dm border border-borda" role="listbox" aria-label="Pedidos sem card">
          {isPending && <li className="px-3 py-4 text-sm text-texto-fraco">Carregando…</li>}
          {!isPending && pedidos.length === 0 && (
            <li className="px-3 py-4 text-sm text-texto-fraco">
              Nenhum pedido sem card {busca ? 'para esta busca' : ''} — tudo que chegou do Tiny já
              está no kanban.
            </li>
          )}
          {pedidos.map((p) => {
            const selecionado = escolhido?.pedido_id === p.pedido_id
            return (
              <li key={p.pedido_id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selecionado}
                  onClick={() => setEscolhido(selecionado ? null : p)}
                  className={cn(
                    'flex min-h-toque-lg w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-left transition-colors',
                    selecionado ? 'bg-acao/15' : 'hover:bg-superficie-sutil',
                  )}
                >
                  <span className="flex flex-col">
                    <span className="font-semibold text-texto tabular-nums">
                      Pedido {p.numero}
                      {selecionado && <span className="ml-2 text-sm font-medium text-acao-ativa">✓ escolhido</span>}
                    </span>
                    <span className="line-clamp-1 text-sm text-texto-suave">{p.cliente_nome || 'Sem cliente'}</span>
                  </span>
                  <span className="flex flex-col text-right text-sm text-texto-suave tabular-nums">
                    <span>{formatarData(p.data_pedido)}</span>
                    <span>
                      {p.total_unidades} unidade{p.total_unidades === 1 ? '' : 's'}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {totalItens > POR_PAGINA && (
          <Paginacao
            paginaAtual={pagina}
            totalPaginas={Math.ceil(totalItens / POR_PAGINA)}
            totalItens={totalItens}
            porPagina={POR_PAGINA}
            aoMudarPagina={(p) => {
              setPagina(p)
              setEscolhido(null)
            }}
            className="border-t-0 px-0 py-0"
          />
        )}

        {erro && (
          <p className="text-sm text-danificado-forte" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
