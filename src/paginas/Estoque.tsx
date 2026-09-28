import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  Boxes,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleDashed,
  CircleSlash,
  Clock,
  Layers,
  ListOrdered,
  OctagonAlert,
  Package,
  Search,
  Tag,
  TriangleAlert,
} from 'lucide-react'
import { Abas, BadgeEstado, Botao, Campo, Paginacao } from '@/componentes/ui'
import type { Aba } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { FiltroPill } from '@/dashboards/componentes/Filtros'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import { useAcessoLogistica } from '@/logistica/acesso'
import { listarEstoqueProdutos, listarPecasEstoque, sugestaoMinimo } from '@/logistica/api'
import type {
  FiltroEstoque,
  GrupoEstoque,
  LinhaEstoqueProduto,
  PecaEstoque,
} from '@/logistica/api'
import { formatarQuantidade, idadeDaLeitura, sinalDoProduto } from '@/logistica/estoque'
import type { TomSinal } from '@/logistica/estoque'

const POR_PAGINA = 20
const PECAS_POR_VEZ = 10
const ATUALIZA_A_CADA = 30_000

type AbaEstoque = GrupoEstoque | 'sugestao'

const ABAS: Aba<AbaEstoque>[] = [
  { valor: 'acabados', rotulo: 'Produtos acabados', icone: <Package aria-hidden /> },
  { valor: 'insumos', rotulo: 'Matéria-prima e insumos', icone: <Layers aria-hidden /> },
  { valor: 'sugestao', rotulo: 'Sugestão de mínimo', icone: <ListOrdered aria-hidden /> },
]

/**
 * Logística → Estoque (SESSAO-25): o estoque inteiro da fábrica.
 *
 * - O número é o do Tiny da fábrica (o último aviso de estoque de cada produto),
 *   menos o que a loja já vendeu e ainda não saiu (a reserva do pedido). Nunca
 *   aparece negativo (D-53): passou do zero é "necessidade extrema".
 * - Peça pronta COM pedido é RESERVADA (duas etiquetas: SKU + pedido) e mora em
 *   Pedidos em aguardo (SESSAO-24); SEM pedido é LIVRE no ESTOQUE (veio da
 *   reposição ou de pedido cancelado). Nada disso se soma ao Tiny.
 * - Abaixo do mínimo (o do cadastro do Tiny), o estoque gera o card de
 *   reposição no PCP — é sugestão; quem decide produzir é o PCP (M-01).
 * - Duas telas (resposta 8 do dono): produtos acabados e matéria-prima/insumos;
 *   mais a sugestão de mínimo (top 20 dos 90 dias, com rank).
 * Tudo paginado no servidor — a tela só requisita o que mostra (regra 17).
 */
export function Estoque() {
  const { perfil, semAcesso, tenhoAcesso } = useAcessoLogistica()
  const [parametros, setParametros] = useSearchParams()
  const abaDaUrl = parametros.get('aba')
  const aba: AbaEstoque =
    abaDaUrl === 'insumos' || abaDaUrl === 'sugestao' ? abaDaUrl : 'acabados'

  if (semAcesso) return <Navigate to="/" replace />
  if (!perfil) return null

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-3 text-2xl sm:text-3xl">
          <Package aria-hidden className="size-7 text-texto-suave" />
          Estoque
        </h1>
        <p className="mt-1 max-w-3xl text-texto-suave">
          O número vem do Tiny da fábrica, menos o que a loja já vendeu e ainda não saiu. Peça
          pronta com pedido é reservada e fica em Pedidos em aguardo; sem pedido, está livre aqui
          no estoque — e nada disso se soma ao Tiny. Abaixo do mínimo, o estoque pede a reposição
          ao PCP.
        </p>
      </div>

      <Abas
        rotulo="Visões do estoque"
        idBase="estoque"
        abas={ABAS}
        valor={aba}
        aoMudar={(valor) => {
          const novos = new URLSearchParams(parametros)
          if (valor === 'acabados') novos.delete('aba')
          else novos.set('aba', valor)
          setParametros(novos, { replace: true })
        }}
      />

      <div role="tabpanel" id="estoque-painel" aria-labelledby={`estoque-aba-${aba}`}>
        {aba === 'sugestao' ? (
          <PainelSugestao ativo={tenhoAcesso} />
        ) : (
          // key: trocar de aba zera busca, filtro e página.
          <PainelProdutos key={aba} grupo={aba} ativo={tenhoAcesso} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Produtos (acabados ou insumos)
// ---------------------------------------------------------------------------

const FILTROS_ACABADOS: { valor: FiltroEstoque | 'todos'; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'abaixo_minimo', rotulo: 'Abaixo do mínimo' },
  { valor: 'extrema', rotulo: 'Necessidade extrema' },
  { valor: 'reservados', rotulo: 'Com reservados' },
  { valor: 'livres', rotulo: 'Com livres' },
  { valor: 'sem_leitura', rotulo: 'Sem leitura do Tiny' },
]

const FILTROS_INSUMOS: { valor: FiltroEstoque | 'todos'; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'sem_leitura', rotulo: 'Sem leitura do Tiny' },
]

function PainelProdutos({ grupo, ativo }: { grupo: GrupoEstoque; ativo: boolean }) {
  const agora = useAgora()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroEstoque | 'todos'>('todos')
  const [pagina, setPagina] = useState(1)

  const { data: linhas = [], isPending, isError, error } = useQuery({
    queryKey: ['estoque', 'produtos', grupo, busca, filtro, pagina],
    queryFn: () =>
      listarEstoqueProdutos({
        grupo,
        busca,
        filtro: filtro === 'todos' ? null : filtro,
        limite: POR_PAGINA,
        deslocamento: (pagina - 1) * POR_PAGINA,
      }),
    enabled: ativo,
    refetchInterval: ATUALIZA_A_CADA,
    placeholderData: keepPreviousData,
  })
  const total = linhas[0]?.contagem_total ?? 0
  const insumos = grupo === 'insumos'

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-col gap-3">
        <div className="max-w-md">
          <Campo
            rotulo="Buscar"
            prefixo={<Search />}
            placeholder="Nome do produto ou SKU"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setPagina(1)
            }}
          />
        </div>
        <FiltroPill
          rotulo="Mostrar"
          opcoes={insumos ? FILTROS_INSUMOS : FILTROS_ACABADOS}
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
          {error instanceof Error ? error.message : 'Não deu para carregar o estoque.'}
        </p>
      )}
      {!isPending && !isError && linhas.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Nenhum produto {busca || filtro !== 'todos' ? 'com esse filtro' : 'no catálogo'}.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {linhas.map((linha) =>
          insumos ? (
            <CartaoInsumo key={linha.tiny_id} linha={linha} agora={agora} />
          ) : (
            <CartaoProduto key={linha.tiny_id} linha={linha} agora={agora} />
          ),
        )}
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

      {!insumos && <TodasAsPecas ativo={ativo} agora={agora} />}
    </div>
  )
}

/** Ícone + cores de cada sinal — estado nunca só por cor (M-12). */
const ESTILO_SINAL: Record<TomSinal, { classe: string; Icone: typeof CircleCheck }> = {
  extrema: { classe: 'bg-danificado-fundo text-danificado-texto', Icone: OctagonAlert },
  abaixo: { classe: 'bg-atencao-fundo text-atencao-texto', Icone: TriangleAlert },
  ok: { classe: 'bg-perfeito-fundo text-perfeito-texto', Icone: CircleCheck },
  sem_minimo: { classe: 'bg-superficie-sutil text-texto-suave', Icone: CircleSlash },
  sem_leitura: { classe: 'bg-superficie-sutil text-texto-suave', Icone: CircleDashed },
}

function SeloSinal({ linha }: { linha: LinhaEstoqueProduto }) {
  const sinal = sinalDoProduto(linha)
  const { classe, Icone } = ESTILO_SINAL[sinal.tom]
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
          classe,
        )}
      >
        <Icone aria-hidden className="size-3.5 shrink-0" />
        {sinal.texto}
      </span>
      {sinal.detalhe && <span className="text-xs text-texto-suave">· {sinal.detalhe}</span>}
    </p>
  )
}

function Numero({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="flex flex-col rounded-dm bg-superficie-sutil px-3 py-2">
      <span className="text-xs text-texto-suave">{rotulo}</span>
      <span
        className={cn(
          'tabular-nums',
          destaque ? 'text-xl font-semibold text-texto' : 'text-lg font-medium text-texto',
        )}
      >
        {valor}
      </span>
    </div>
  )
}

function LinhaDaLeitura({ linha, agora }: { linha: LinhaEstoqueProduto; agora: number }) {
  if (linha.saldo_tiny === null) {
    return (
      <p className="text-xs text-texto-fraco">
        O Tiny ainda não mandou o saldo deste produto — chega na próxima movimentação ou na carga
        inicial.
      </p>
    )
  }
  const idade = idadeDaLeitura(linha.lido_em, agora)
  return (
    <p className="text-xs text-texto-fraco tabular-nums">
      Tiny: {formatarQuantidade(linha.saldo_tiny)}
      {linha.reservas_loja > 0 &&
        ` − ${formatarQuantidade(linha.reservas_loja)} vendido${linha.reservas_loja === 1 ? '' : 's'} pela loja ainda sem sair`}
      {idade && ` · lido ${idade}`}
      {linha.origem_leitura === 'carga_inicial' && ' (carga inicial)'}
    </p>
  )
}

function CartaoProduto({ linha, agora }: { linha: LinhaEstoqueProduto; agora: number }) {
  const [verPecas, setVerPecas] = useState(false)
  const pecas = linha.prontos_reservados + linha.prontos_livres
  return (
    <li className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-4">
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-texto">{linha.descricao || 'Sem descrição'}</p>
        <p className="inline-flex items-center gap-1.5 text-sm text-texto-suave tabular-nums">
          <Tag aria-hidden className="size-4" />
          {linha.codigo ? `SKU ${linha.codigo}` : 'sem SKU'}
        </p>
        <SeloSinal linha={linha} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Numero rotulo="Em estoque" valor={formatarQuantidade(linha.em_estoque)} destaque />
        <Numero rotulo="Mínimo (Tiny)" valor={formatarQuantidade(linha.minimo)} />
        <Numero rotulo="Reservados" valor={String(linha.prontos_reservados)} />
        <Numero rotulo="Livres na plataforma" valor={String(linha.prontos_livres)} />
      </div>

      <LinhaDaLeitura linha={linha} agora={agora} />

      {pecas > 0 && (
        <div className="flex flex-col gap-2">
          <Botao
            variante="secundaria"
            className="self-start"
            icone={verPecas ? <ChevronUp /> : <ChevronDown />}
            aria-expanded={verPecas}
            onClick={() => setVerPecas((v) => !v)}
          >
            {verPecas ? 'Esconder as peças' : `Ver as peças (${pecas})`}
          </Botao>
          {verPecas && <PecasDoProduto produtoTinyId={linha.tiny_id} agora={agora} />}
        </div>
      )}
    </li>
  )
}

function CartaoInsumo({ linha, agora }: { linha: LinhaEstoqueProduto; agora: number }) {
  const idade = idadeDaLeitura(linha.lido_em, agora)
  return (
    <li className="flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-medium text-texto">{linha.descricao || 'Sem descrição'}</p>
        <p className="text-sm text-texto-suave tabular-nums">
          {linha.codigo ? `SKU ${linha.codigo}` : 'sem SKU'}
          {linha.classe === 'K' ? ' · kit' : ' · matéria-prima'}
          {linha.minimo !== null && linha.minimo > 0 && ` · mínimo ${formatarQuantidade(linha.minimo)}`}
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
            {idade && `Lido ${idade}`}
            {linha.origem_leitura === 'carga_inicial' && ' (carga inicial)'}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-baseline gap-1.5 sm:flex-col sm:items-end">
        <span className="text-xs text-texto-suave">Em estoque</span>
        <span className="text-xl font-semibold text-texto tabular-nums">
          {formatarQuantidade(linha.em_estoque)}
          {linha.unidade && linha.em_estoque !== null && (
            <span className="ml-1 text-sm font-normal text-texto-suave">{linha.unidade}</span>
          )}
        </span>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Peças (as unidades físicas no ESTOQUE)
// ---------------------------------------------------------------------------

function LinhaPeca({ peca, agora }: { peca: PecaEstoque; agora: number }) {
  const reservada = peca.dono === 'pedido'
  return (
    <li className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col">
        <span className="text-sm text-texto">
          {reservada ? (
            <>
              <span className="font-medium">Reservada · Pedido {peca.numero ?? '…'}</span>
              {peca.indice_unidade !== null && (
                <span className="tabular-nums">
                  {' '}
                  ({peca.indice_unidade}/{peca.total_unidades})
                </span>
              )}
              {/* SESSAO-24: a peça pronta de pedido mora em Pedidos em aguardo. */}
              {peca.local === 'aguardo' && (
                <span className="text-texto-suave"> · em Pedidos em aguardo</span>
              )}
            </>
          ) : peca.origem === 'cancelamento' ? (
            <span className="font-medium">
              Livre · veio do pedido {peca.origem_numero ?? '…'}, que foi cancelado
            </span>
          ) : (
            <span className="font-medium">Livre · veio da reposição</span>
          )}
        </span>
        <span className="text-xs text-texto-suave tabular-nums">
          {peca.item_codigo ? `SKU ${peca.item_codigo}` : 'sem SKU'}
          {peca.item_descricao && ` · ${peca.item_descricao}`}
        </span>
      </div>
      <span className="flex shrink-0 items-center gap-2 text-xs text-texto-suave tabular-nums">
        {peca.qualidade_atual && <BadgeEstado estado={peca.qualidade_atual} tamanho="sm" />}
        <Clock aria-hidden className="size-3.5" />
        {formatarDuracao(peca.desde, agora)}
      </span>
    </li>
  )
}

function PecasDoProduto({ produtoTinyId, agora }: { produtoTinyId: number; agora: number }) {
  const [quantas, setQuantas] = useState(PECAS_POR_VEZ)
  const { data: pecas = [], isPending, isFetching } = useQuery({
    queryKey: ['estoque', 'pecas', produtoTinyId, quantas],
    queryFn: () => listarPecasEstoque({ produtoTinyId, limite: quantas }),
    placeholderData: keepPreviousData,
  })
  const total = pecas[0]?.contagem_total ?? 0
  if (isPending) return <p className="text-sm text-texto-fraco">Carregando as peças…</p>
  return (
    <div className="rounded-dm border border-borda px-3">
      <ul className="divide-y divide-borda">
        {pecas.map((peca) => (
          <LinhaPeca key={peca.card_id} peca={peca} agora={agora} />
        ))}
      </ul>
      {pecas.length < total && (
        <Botao
          variante="fantasma"
          className="my-2"
          icone={<ChevronDown />}
          carregando={isFetching}
          onClick={() => setQuantas((q) => q + PECAS_POR_VEZ)}
        >
          Ver mais ({total - pecas.length})
        </Botao>
      )}
    </div>
  )
}

/**
 * Tudo o que está no ESTOQUE — só peça SEM DONO desde a SESSAO-24 (b4 do dono:
 * "estoque só fica como local final de peça sem dono"), inclusive o que não é
 * do catálogo (a personalizada de pedido cancelado). A peça reservada mora em
 * Pedidos em aguardo. Só carrega ao abrir (regra 17).
 */
function TodasAsPecas({ ativo, agora }: { ativo: boolean; agora: number }) {
  const [aberto, setAberto] = useState(false)
  const [pagina, setPagina] = useState(1)
  const { data: pecas = [], isPending } = useQuery({
    queryKey: ['estoque', 'todas-pecas', pagina],
    queryFn: () =>
      listarPecasEstoque({
        dono: 'livre',
        limite: POR_PAGINA,
        deslocamento: (pagina - 1) * POR_PAGINA,
      }),
    enabled: ativo && aberto,
    placeholderData: keepPreviousData,
  })
  const total = pecas[0]?.contagem_total ?? 0
  return (
    <section aria-label="Todas as peças no ESTOQUE" className="flex flex-col gap-2 pt-2">
      <Botao
        variante="secundaria"
        className="self-start"
        icone={<Boxes />}
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        {aberto ? 'Esconder todas as peças no ESTOQUE' : 'Ver todas as peças no ESTOQUE'}
      </Botao>
      {aberto && (
        <div className="flex flex-col gap-2">
          {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
          {!isPending && pecas.length === 0 && (
            <p className="text-sm text-texto-suave">Nenhuma peça parada no ESTOQUE agora.</p>
          )}
          {pecas.length > 0 && (
            <div className="rounded-dm-lg border border-borda bg-superficie px-4">
              <ul className="divide-y divide-borda">
                {pecas.map((peca) => (
                  <LinhaPeca key={peca.card_id} peca={peca} agora={agora} />
                ))}
              </ul>
            </div>
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

// ---------------------------------------------------------------------------
// Sugestão de mínimo (top 20 dos últimos 90 dias, com rank)
// ---------------------------------------------------------------------------

const COBERTURAS = [
  { valor: '1', rotulo: '1 semana' },
  { valor: '2', rotulo: '2 semanas' },
  { valor: '4', rotulo: '4 semanas' },
] as const

function PainelSugestao({ ativo }: { ativo: boolean }) {
  const [cobertura, setCobertura] = useState<'1' | '2' | '4'>('2')
  const { data: linhas = [], isPending, isError, error } = useQuery({
    queryKey: ['estoque', 'sugestao', cobertura],
    queryFn: () => sugestaoMinimo(Number(cobertura)),
    enabled: ativo,
    placeholderData: keepPreviousData,
  })

  return (
    <div className="flex flex-col gap-4 pt-4">
      <p className="max-w-3xl text-sm text-texto-suave">
        Os 20 produtos mais vendidos pela loja nos últimos 90 dias (sem personalizado e sem
        cancelado). A sugestão é a venda média da semana vezes a cobertura escolhida — quem vende
        mais pede mais estoque. O mínimo continua sendo ajustado no cadastro do Tiny.
      </p>
      <FiltroPill
        rotulo="Cobertura"
        opcoes={COBERTURAS}
        valor={cobertura}
        aoMudar={setCobertura}
      />

      {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {isError && (
        <p className="rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto">
          {error instanceof Error ? error.message : 'Não deu para carregar a sugestão.'}
        </p>
      )}
      {!isPending && !isError && linhas.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Nenhuma venda de produto do catálogo nos últimos 90 dias.
        </p>
      )}

      <ol className="flex flex-col gap-2">
        {linhas.map((l) => {
          const muda = l.minimo_atual === null || l.minimo_atual !== l.sugestao
          return (
            <li
              key={l.tiny_id}
              className="flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <span
                aria-label={`${l.posicao}º mais vendido`}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-superficie-sutil text-sm font-semibold text-texto tabular-nums"
              >
                {l.posicao}º
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium text-texto">{l.descricao}</span>
                <span className="text-xs text-texto-suave tabular-nums">
                  SKU {l.codigo} · {formatarQuantidade(l.vendidos_90d)} vendidos em 90 dias ·{' '}
                  {formatarQuantidade(l.media_semana)} por semana
                </span>
              </div>
              <div className="grid shrink-0 grid-cols-3 gap-2 text-center sm:w-80">
                <Numero rotulo="Em estoque" valor={formatarQuantidade(l.em_estoque)} />
                <Numero rotulo="Mínimo hoje" valor={formatarQuantidade(l.minimo_atual)} />
                <div
                  className={cn(
                    'flex flex-col rounded-dm px-3 py-2',
                    muda ? 'border border-acao-ativa bg-superficie' : 'bg-superficie-sutil',
                  )}
                >
                  <span className="text-xs text-texto-suave">Sugestão</span>
                  <span className="text-lg font-semibold text-texto tabular-nums">{l.sugestao}</span>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
