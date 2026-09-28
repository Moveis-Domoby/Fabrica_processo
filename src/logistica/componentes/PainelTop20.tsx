import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, PackagePlus, Plus, Search } from 'lucide-react'
import { Botao, Campo, Paginacao } from '@/componentes/ui'
import { useAgora } from '@/kanban/tempo'
import { listarEstoqueProdutos } from '@/logistica/api'
import type { LinhaEstoqueProduto, OperacaoEstoque } from '@/logistica/api'
import { formatarQuantidade, rotuloPosicao } from '@/logistica/estoque'
import { CartaoProdutoEstoque } from './CartaoProdutoEstoque'
import { FotoProduto } from './FotoProduto'
import { ModalEscolherProduto } from './ModalEscolherProduto'
import { ModalMovimentarEstoque } from './ModalMovimentarEstoque'
import { ModalProdutoEstoque } from './ModalProdutoEstoque'
import { TodasAsPecas } from './PecasDoEstoque'

const POR_PAGINA = 20
const ATUALIZA_A_CADA = 30_000

/**
 * Top 20+ (ajuste de 28/09 — D-71): a tela inicial do estoque. A primeira
 * página são os 20 produtos mais vendidos dos últimos 90 dias (o rank); depois
 * vem o que tem estoque. O resto do catálogo não polui a lista: fica em "Ver os
 * outros produtos" e na busca (que procura no catálogo inteiro). Tudo paginado
 * no servidor — a tela só pede o que mostra (regra 17).
 */
export function PainelTop20({ ativo, podeMexer }: { ativo: boolean; podeMexer: boolean }) {
  const agora = useAgora()
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [escolhendo, setEscolhendo] = useState(false)
  const [movimento, setMovimento] = useState<{
    produto: LinhaEstoqueProduto
    operacao: OperacaoEstoque
  } | null>(null)
  const [aberto, setAberto] = useState<LinhaEstoqueProduto | null>(null)

  const { data: linhas = [], isPending, isError, error } = useQuery({
    queryKey: ['estoque', 'top20', busca, pagina],
    queryFn: () =>
      listarEstoqueProdutos({
        grupo: 'acabados',
        busca,
        limite: POR_PAGINA,
        deslocamento: (pagina - 1) * POR_PAGINA,
      }),
    enabled: ativo,
    refetchInterval: ATUALIZA_A_CADA,
    placeholderData: keepPreviousData,
  })
  const total = linhas[0]?.contagem_total ?? 0
  // O detalhe aberto acompanha a lista (foto nova, número novo) quando o produto está nela.
  const produtoAberto = aberto ? (linhas.find((l) => l.tiny_id === aberto.tiny_id) ?? aberto) : null

  function movimentar(produto: LinhaEstoqueProduto, operacao: OperacaoEstoque) {
    setAberto(null)
    setMovimento({ produto, operacao })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-md">
          <Campo
            rotulo="Buscar no catálogo"
            prefixo={<Search />}
            placeholder="Nome do produto ou SKU"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setPagina(1)
            }}
          />
        </div>
        {podeMexer && (
          <Botao
            icone={<PackagePlus />}
            className="shrink-0 whitespace-nowrap"
            onClick={() => setEscolhendo(true)}
          >
            Cadastrar produto ao estoque
          </Botao>
        )}
      </div>

      {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {isError && (
        <p className="rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto">
          {error instanceof Error ? error.message : 'Não deu para carregar o estoque.'}
        </p>
      )}
      {!isPending && !isError && linhas.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          {busca.trim() ? 'Nenhum produto com esse nome ou SKU.' : 'Nenhum produto vendido nem em estoque ainda.'}
        </p>
      )}

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(14.5rem,1fr))] gap-3">
        {linhas.map((linha) => (
          <CartaoProdutoEstoque
            key={linha.tiny_id}
            linha={linha}
            podeMexer={podeMexer}
            aoMovimentar={(operacao) => movimentar(linha, operacao)}
            aoAbrir={() => setAberto(linha)}
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

      {!busca.trim() && (
        <OutrosProdutos
          ativo={ativo}
          podeMexer={podeMexer}
          aoCadastrar={(produto) => movimentar(produto, 'entrada')}
        />
      )}
      <TodasAsPecas ativo={ativo} agora={agora} />

      <ModalEscolherProduto
        aberto={escolhendo}
        aoFechar={() => setEscolhendo(false)}
        aoEscolher={(produto) => {
          setEscolhendo(false)
          movimentar(produto, 'entrada')
        }}
      />
      <ModalMovimentarEstoque
        key={movimento ? `${movimento.produto.tiny_id}-${movimento.operacao}` : 'fechado'}
        produto={movimento?.produto ?? null}
        operacaoInicial={movimento?.operacao ?? 'entrada'}
        aoFechar={() => setMovimento(null)}
      />
      <ModalProdutoEstoque
        produto={produtoAberto}
        podeMexer={podeMexer}
        aoFechar={() => setAberto(null)}
        aoMovimentar={(operacao) => produtoAberto && movimentar(produtoAberto, operacao)}
      />
    </div>
  )
}

/**
 * "Ver os outros produtos": o catálogo que não entrou no Top 20+ (não vende
 * tanto e não tem estoque). Só carrega ao abrir (regra 17); daqui a logística
 * cadastra a entrada direto.
 */
function OutrosProdutos({
  ativo,
  podeMexer,
  aoCadastrar,
}: {
  ativo: boolean
  podeMexer: boolean
  aoCadastrar: (produto: LinhaEstoqueProduto) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [pagina, setPagina] = useState(1)
  const { data: linhas = [], isPending } = useQuery({
    queryKey: ['estoque', 'outros', pagina],
    queryFn: () =>
      listarEstoqueProdutos({
        grupo: 'acabados',
        filtro: 'fora',
        limite: POR_PAGINA,
        deslocamento: (pagina - 1) * POR_PAGINA,
      }),
    enabled: ativo && aberto,
    placeholderData: keepPreviousData,
  })
  const total = linhas[0]?.contagem_total ?? 0

  return (
    <section aria-label="Outros produtos do catálogo" className="flex flex-col gap-2">
      <Botao
        variante="secundaria"
        className="self-start"
        icone={aberto ? <ChevronUp /> : <ChevronDown />}
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        {aberto ? 'Esconder os outros produtos' : 'Ver os outros produtos'}
      </Botao>
      {aberto && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-texto-suave">
            Os produtos do catálogo que não estão entre os mais vendidos e não têm estoque.
          </p>
          {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
          {!isPending && linhas.length === 0 && (
            <p className="text-sm text-texto-suave">Todo o catálogo já aparece na lista acima.</p>
          )}
          {linhas.length > 0 && (
            <ul className="flex flex-col divide-y divide-borda rounded-dm-lg border border-borda bg-superficie">
              {linhas.map((p) => (
                <li key={p.tiny_id} className="flex items-center gap-3 px-3 py-2">
                  <FotoProduto
                    produto={p}
                    podeTrocar={false}
                    iconeGrande={false}
                    className="size-12 shrink-0 rounded-dm"
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-texto">{p.descricao}</span>
                    <span className="text-xs text-texto-suave tabular-nums">
                      {p.codigo ? `SKU ${p.codigo}` : 'sem SKU'}
                      {p.posicao !== null
                        ? ` · ${rotuloPosicao(p.posicao)} em vendas (${formatarQuantidade(p.vendidos_90d)} em 90 dias)`
                        : ' · sem venda em 90 dias'}
                    </span>
                  </div>
                  {podeMexer && (
                    <Botao
                      variante="secundaria"
                      icone={<Plus />}
                      onClick={() => aoCadastrar(p)}
                      aria-label={`Cadastrar ${p.descricao} ao estoque`}
                    >
                      <span className="hidden sm:inline">Cadastrar</span>
                    </Botao>
                  )}
                </li>
              ))}
            </ul>
          )}
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
      )}
    </section>
  )
}
