import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { Factory, PackagePlus, Search } from 'lucide-react'
import { Botao, Campo, Modal, Paginacao, useNotificacao } from '@/componentes/ui'
import { FiltroPill } from '@/dashboards/componentes/Filtros'
import { useAgora } from '@/kanban/tempo'
import {
  configEstoque,
  lancarReposicao,
  listarEstoqueProdutos,
  situacaoReposicao,
} from '@/logistica/api'
import type { FiltroEstoque, LinhaEstoqueProduto, OperacaoEstoque } from '@/logistica/api'
import { CartaoProdutoEstoque } from './CartaoProdutoEstoque'
import { ModalEscolherProduto } from './ModalEscolherProduto'
import { ModalMovimentarEstoque } from './ModalMovimentarEstoque'
import { ModalProdutoEstoque } from './ModalProdutoEstoque'
import { TodasAsPecas } from './PecasDoEstoque'
import { PecasPersonalizadas } from './PecasPersonalizadas'

const ATUALIZA_A_CADA = 30_000

/** O filtro do topo (resposta 5 do dono: entra o "Com estoque"). */
const FILTROS = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'necessidade', rotulo: 'Necessidade de produção' },
  { valor: 'reservados_producao', rotulo: 'Reservados para produção' },
  { valor: 'com_estoque', rotulo: 'Com estoque' },
] as const
type FiltroTopo = (typeof FILTROS)[number]['valor']

/**
 * A lista dos acabados (↪️ 30/09 — D-83/D-86/D-87): UMA lista pelo ranking dos
 * 90 dias (com o corte), em que o TOP X é o tamanho da página — página 1 = 1º
 * ao Xº. O filtro do topo (Todos · Necessidade · Reservados p/ produção · Com
 * estoque) pagina no servidor; a busca varre o catálogo inteiro. Com a
 * reposição automática desligada, o cartão em necessidade ganha o "Lançar para
 * produção". Tudo no servidor — a tela só pede o que mostra (regra 17).
 */
export function PainelTop20({ ativo, podeMexer }: { ativo: boolean; podeMexer: boolean }) {
  const agora = useAgora()
  const navegar = useNavigate()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroTopo>('todos')
  const [pagina, setPagina] = useState(1)
  const [escolhendo, setEscolhendo] = useState(false)
  const [movimento, setMovimento] = useState<{
    produto: LinhaEstoqueProduto
    operacao: OperacaoEstoque
  } | null>(null)
  const [aberto, setAberto] = useState<LinhaEstoqueProduto | null>(null)
  const [lancando, setLancando] = useState<LinhaEstoqueProduto | null>(null)

  // O Top X é valor único da equipe e mora no banco (D-83).
  const { data: config } = useQuery({
    queryKey: ['estoque', 'config'],
    queryFn: configEstoque,
    enabled: ativo,
  })
  const topX = config?.top_x ?? 20

  // Desligada, o cartão em necessidade ganha o botão manual (resposta 4).
  const { data: reposicao } = useQuery({
    queryKey: ['estoque', 'reposicao-situacao'],
    queryFn: situacaoReposicao,
    enabled: ativo && podeMexer,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const podeLancar = podeMexer && reposicao !== undefined && !reposicao.ligada

  const buscando = busca.trim() !== ''
  const filtroServidor: FiltroEstoque | null = buscando || filtro === 'todos' ? null : filtro
  const {
    data: linhas = [],
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['estoque', 'topx', filtroServidor, busca, pagina, topX],
    queryFn: () =>
      listarEstoqueProdutos({
        grupo: 'acabados',
        busca,
        filtro: filtroServidor,
        limite: topX,
        deslocamento: (pagina - 1) * topX,
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
      {/* Busca e filtro na MESMA linha (pedido do dono, 30/09); o Top X mora
          nas Configurações. */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="w-full max-w-md min-w-64 flex-1">
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
        <div className="pb-1">
          <FiltroPill
            rotulo="Mostrar"
            opcoes={FILTROS}
            valor={buscando ? 'todos' : filtro}
            aoMudar={(v) => {
              setFiltro(v)
              setBusca('')
              setPagina(1)
            }}
          />
        </div>
        {podeMexer && (
          <Botao
            icone={<PackagePlus />}
            className="ml-auto shrink-0 whitespace-nowrap"
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
          {buscando
            ? 'Nenhum produto com esse nome ou SKU.'
            : filtro === 'necessidade'
              ? 'Nenhum produto em necessidade de produção.'
              : filtro === 'reservados_producao'
                ? 'Nada reservado para produção agora.'
                : filtro === 'com_estoque'
                  ? 'Nenhum produto com estoque.'
                  : 'Nenhum produto no catálogo ainda.'}
        </p>
      )}

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(14.5rem,1fr))] gap-3">
        {linhas.map((linha) => (
          <CartaoProdutoEstoque
            key={linha.tiny_id}
            linha={linha}
            podeMexer={podeMexer}
            podeLancar={podeLancar}
            aoMovimentar={(operacao) => movimentar(linha, operacao)}
            aoAbrir={() => setAberto(linha)}
            aoLancar={() => setLancando(linha)}
            aoAbrirPendencia={() =>
              linha.pendente_card_id !== null &&
              navegar(`/fabrica/producao/pcp?liberar=${linha.pendente_card_id}`)
            }
          />
        ))}
      </ul>

      {total > topX && (
        <Paginacao
          paginaAtual={pagina}
          totalPaginas={Math.ceil(total / topX)}
          totalItens={total}
          porPagina={topX}
          aoMudarPagina={setPagina}
          className="rounded-dm-lg border border-borda bg-superficie"
        />
      )}

      <TodasAsPecas ativo={ativo} agora={agora} />
      <PecasPersonalizadas ativo={ativo} agora={agora} podeMexer={podeMexer} />

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
      <ModalLancarReposicao
        key={lancando?.tiny_id ?? 'fechado'}
        produto={lancando}
        aoFechar={() => setLancando(null)}
      />
    </div>
  )
}

/**
 * "Lançar para produção" (D-87): com a automática desligada, a logística cria
 * a reposição no PCP à mão. A quantidade proposta = o que falta para o mínimo,
 * já descontando o que vem para o estoque — editável.
 */
function ModalLancarReposicao({
  produto,
  aoFechar,
}: {
  produto: LinhaEstoqueProduto | null
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const proposta = Math.min(Math.max(produto?.repor_sugerido ?? 1, 1), 500)
  const [texto, setTexto] = useState<string | null>(null)
  const quantidade = texto === null ? proposta : Number(texto)
  const valida = Number.isInteger(quantidade) && quantidade >= 1 && quantidade <= 500

  const lancar = useMutation({
    mutationFn: () => lancarReposicao(produto!.tiny_id, quantidade),
    onSuccess: async () => {
      notificar({
        titulo: 'Reposição lançada ao PCP',
        descricao: `${quantidade} ${quantidade === 1 ? 'unidade' : 'unidades'} de ${produto?.descricao ?? ''} — o PCP decide.`,
        tom: 'perfeito',
      })
      aoFechar()
      await clienteQuery.invalidateQueries({ queryKey: ['estoque'] })
      await clienteQuery.invalidateQueries({ queryKey: ['cards'] })
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para lançar a reposição',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  return (
    <Modal
      aberto={produto !== null}
      aoFechar={(v) => !v && aoFechar()}
      titulo="Lançar para produção"
      descricao={
        produto
          ? `${produto.descricao}${produto.codigo ? ` · SKU ${produto.codigo}` : ''}`
          : undefined
      }
    >
      {produto && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (valida) lancar.mutate()
          }}
        >
          <p className="text-sm text-texto-suave tabular-nums">
            Em estoque: <span className="font-medium text-texto">{produto.em_estoque ?? 0}</span>
            {' · '}mínimo: <span className="font-medium text-texto">{produto.minimo ?? '—'}</span>
            {produto.reservados_producao > 0 && (
              <>
                {' · '}já reservados p/ produção:{' '}
                <span className="font-medium text-texto">{produto.reservados_producao}</span>
              </>
            )}
          </p>
          <div className="w-36">
            <Campo
              rotulo="Quantidade"
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              step={1}
              value={texto ?? String(proposta)}
              erro={valida ? undefined : 'De 1 a 500'}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
          <p className="text-sm text-texto-suave">
            A reposição nasce no PCP, que decide o rumo. Parada 2 dias úteis lá, ela sai sozinha.
          </p>
          <div className="flex flex-wrap gap-2">
            <Botao
              type="submit"
              icone={<Factory />}
              disabled={!valida}
              carregando={lancar.isPending}
            >
              Lançar ao PCP
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
