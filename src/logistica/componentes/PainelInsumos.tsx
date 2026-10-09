import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CircleDashed, Search } from 'lucide-react'
import { Campo, Paginacao } from '@/componentes/ui'
import { FiltroPill } from '@/dashboards/componentes/Filtros'
import { useAgora } from '@/kanban/tempo'
import { listarEstoqueProdutos } from '@/logistica/api'
import type { FiltroEstoque, LinhaEstoqueProduto } from '@/logistica/api'
import { formatarQuantidade, idadeDaLeitura } from '@/logistica/estoque'
import { useAoVivo } from '@/lib/aoVivo'

const POR_PAGINA = 20

const FILTROS: { valor: FiltroEstoque | 'todos'; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'sem_leitura', rotulo: 'Sem leitura do Tiny' },
]

/**
 * Matéria-prima e insumos (SESSAO-25 / D-57): peças, MDF, parafusos e kits —
 * o número ainda é o do Tiny (a contagem manual da logística é dos acabados).
 * O que tem estoque vem primeiro; o resto nas páginas seguintes.
 */
export function PainelInsumos({ ativo }: { ativo: boolean }) {
  const agora = useAgora()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroEstoque | 'todos'>('todos')
  const [pagina, setPagina] = useState(1)

  const {
    data: linhas = [],
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['estoque', 'insumos', busca, filtro, pagina],
    queryFn: () =>
      listarEstoqueProdutos({
        grupo: 'insumos',
        busca,
        filtro: filtro === 'todos' ? null : filtro,
        limite: POR_PAGINA,
        deslocamento: (pagina - 1) * POR_PAGINA,
      }),
    enabled: ativo,
    placeholderData: keepPreviousData,
  })
  // SESSAO-30 (Lei §4): a leitura do Tiny chega AO VIVO (o aviso do estoque), sem relógio.
  useAoVivo('estoque', [['estoque', 'insumos']], ativo)
  const total = linhas[0]?.contagem_total ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="max-w-md">
          <Campo
            rotulo="Buscar"
            prefixo={<Search />}
            placeholder="Nome ou SKU"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setPagina(1)
            }}
          />
        </div>
        <FiltroPill
          rotulo="Mostrar"
          opcoes={FILTROS}
          valor={filtro}
          aoMudar={(v) => {
            setFiltro(v)
            setPagina(1)
          }}
        />
      </div>

      {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {isError && (
        <p className="rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto">
          {error instanceof Error ? error.message : 'Não deu para carregar os insumos.'}
        </p>
      )}
      {!isPending && !isError && linhas.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Nenhum insumo {busca || filtro !== 'todos' ? 'com esse filtro' : 'no catálogo'}.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {linhas.map((linha) => (
          <CartaoInsumo key={linha.tiny_id} linha={linha} agora={agora} />
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

function CartaoInsumo({ linha, agora }: { linha: LinhaEstoqueProduto; agora: number }) {
  const idade = idadeDaLeitura(linha.lido_em, agora)
  return (
    <li className="flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium text-texto">{linha.descricao || 'Sem descrição'}</p>
        <p className="text-xs text-texto-suave tabular-nums">
          {linha.codigo ? `SKU ${linha.codigo}` : 'sem SKU'}
          {linha.classe === 'K' ? ' · kit' : ' · matéria-prima'}
          {linha.minimo !== null &&
            linha.minimo > 0 &&
            ` · mínimo ${formatarQuantidade(linha.minimo)}`}
        </p>
        {linha.saldo_tiny === null ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-texto-fraco">
            <CircleDashed aria-hidden className="size-3.5" />
            Sem leitura do Tiny ainda
          </p>
        ) : (
          <p className="text-xs text-texto-fraco tabular-nums">
            {linha.saldo_tiny < 0 &&
              `No Tiny está ${formatarQuantidade(linha.saldo_tiny)} — saída sem entrada; aqui conta como 0. `}
            {idade && `Lido do Tiny ${idade}`}
            {linha.origem_leitura === 'carga_inicial' && ' (carga inicial)'}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-baseline gap-1.5 sm:flex-col sm:items-end">
        <span className="text-xs text-texto-suave">Em estoque</span>
        <span className="text-lg font-semibold text-texto tabular-nums">
          {formatarQuantidade(linha.em_estoque)}
          {linha.unidade && linha.em_estoque !== null && (
            <span className="ml-1 text-sm font-normal text-texto-suave">{linha.unidade}</span>
          )}
        </span>
      </div>
    </li>
  )
}
