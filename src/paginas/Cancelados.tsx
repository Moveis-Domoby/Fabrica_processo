import { useState } from 'react'
import { Navigate } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Ban, Inbox, Search } from 'lucide-react'
import { Campo, Dica, Paginacao } from '@/componentes/ui'
import { pedidosCancelados } from '@/kanban/api'
import type { PedidoCancelado } from '@/kanban/api'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import { useAcessoLogistica } from '@/logistica/acesso'

const CANCELADOS_POR_PAGINA = 20

function formatarDataPedido(iso: string | null): string {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') : '—'
}

/**
 * Logística → Cancelados (rodada do dono em 30/09: saiu do PCP e virou tela
 * própria da Logística). Todo pedido cancelado no Tiny, com o que aconteceu
 * com as peças dele — guarda para sempre (b3 do dono, SESSAO-24), paginado no
 * servidor (regra 17). Nada aqui é gesto: as consequências são do sistema
 * (M-01).
 */
export function Cancelados() {
  const { perfil, semAcesso } = useAcessoLogistica()
  const agora = useAgora()
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)

  const { data: linhas = [], isPending } = useQuery({
    queryKey: ['pcp-cancelados', busca, pagina],
    queryFn: () =>
      pedidosCancelados({
        busca,
        limite: CANCELADOS_POR_PAGINA,
        deslocamento: (pagina - 1) * CANCELADOS_POR_PAGINA,
      }),
    placeholderData: keepPreviousData,
  })
  const total = Number(linhas[0]?.contagem_total ?? 0)

  if (semAcesso) return <Navigate to="/" replace />
  if (!perfil) return null

  return (
    <div className="flex flex-col gap-4">
      {/* relative: o balão do "i" ancora nesta linha (ver Dica). */}
      <div className="relative flex items-center gap-1">
        <h1 className="flex items-center gap-2 text-2xl sm:text-3xl">
          <Ban aria-hidden className="size-7 shrink-0 text-texto-suave" />
          Cancelados
        </h1>
        <Dica rotulo="O que acontece com o pedido cancelado">
          <span className="flex flex-col gap-2">
            <span>Pedidos cancelados no Tiny, guardados para sempre.</span>
            <span>
              Peça que já estava pronta voltou para o estoque, sem dono; peça que estava na
              produção segue com a etiqueta &quot;Pedido cancelado&quot; e, concluída, vai para o
              estoque.
            </span>
          </span>
        </Dica>
      </div>

      <div className="max-w-md">
        <Campo
          rotulo="Buscar cancelado"
          prefixo={<Search />}
          placeholder="Número do pedido ou nome do cliente"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value)
            setPagina(1)
          }}
        />
      </div>

      {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {!isPending && linhas.length === 0 && (
        <p className="flex items-center gap-2 rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          <Inbox aria-hidden className="size-5 shrink-0" />
          Nenhum pedido cancelado{busca ? ' para esta busca' : ''}.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {linhas.map((linha) => (
          <LinhaCancelado key={linha.card_id} linha={linha} agora={agora} />
        ))}
      </ul>

      {total > CANCELADOS_POR_PAGINA && (
        <Paginacao
          paginaAtual={pagina}
          totalPaginas={Math.ceil(total / CANCELADOS_POR_PAGINA)}
          totalItens={total}
          porPagina={CANCELADOS_POR_PAGINA}
          aoMudarPagina={setPagina}
          className="rounded-dm-lg border border-borda bg-superficie"
        />
      )}
    </div>
  )
}

function LinhaCancelado({ linha, agora }: { linha: PedidoCancelado; agora: number }) {
  const liberadas = linha.em_producao + linha.prontas + linha.no_estoque
  return (
    <li className="flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold text-texto tabular-nums">Pedido {linha.numero}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-danificado-fundo px-2.5 py-0.5 text-xs font-medium text-danificado-texto">
          <Ban aria-hidden className="size-3.5" />
          Cancelado no Tiny
          {linha.cancelado_em && ` há ${formatarDuracao(linha.cancelado_em, agora)}`}
        </span>
      </div>
      <p className="line-clamp-1 text-sm text-texto-suave">
        {linha.cliente_nome || 'Sem cliente'} · pedido de {formatarDataPedido(linha.data_pedido)}
        {' · '}
        {linha.total_unidades} unidade{linha.total_unidades === 1 ? '' : 's'}
      </p>
      <p className="text-sm text-texto tabular-nums">
        {liberadas === 0 ? (
          'Nenhuma unidade tinha ido para a produção — sem efeito no estoque.'
        ) : (
          <>
            {linha.em_producao > 0 && (
              <>
                {linha.em_producao} na produção com a etiqueta &quot;Pedido cancelado&quot;
                {(linha.no_estoque > 0 || linha.prontas > 0) && ' · '}
              </>
            )}
            {linha.no_estoque > 0 && (
              <>
                {linha.no_estoque} no estoque, sem dono
                {linha.prontas > 0 && ' · '}
              </>
            )}
            {linha.prontas > 0 && <>{linha.prontas} já lançada(s) para as ROTAS</>}
          </>
        )}
      </p>
    </li>
  )
}
