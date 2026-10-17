import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, ChevronUp, ListTree, RotateCcw, Ruler } from 'lucide-react'
import { Botao, Campo, Paginacao, Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useDebouncedValue } from '@/comercial/hooks/useDebouncedValue'
import { EstruturaDoProduto } from '@/logistica/componentes/EstruturaDoProduto'
import { UnidadesForaDoPadrao } from '@/logistica/componentes/UnidadesForaDoPadrao'
import {
  POR_PAGINA_CLASSIFICACAO,
  ROTULO_CLASSE_TINY,
  ROTULO_TIPO,
  definirTipoProduto,
  listarClassificacao,
} from '@/logistica/classificacao'
import type {
  FiltrosClassificacao,
  ProdutoClassificado,
  TipoEstoque,
} from '@/logistica/classificacao'

const TIPOS: TipoEstoque[] = ['movel', 'insumo', 'peca']

/**
 * Configurações → Móveis, insumos e peças (SESSAO-32 · D-138, pedido do dono):
 * "insumo não é móvel, móvel não é peça" — cada produto do Tiny tem um tipo no
 * estoque. O automático vem do cadastro do Tiny; aqui o admin troca o que
 * nascer errado, sem precisar mexer em código. Uma requisição por página
 * (lista limitada ao catálogo — página numerada), filtros no servidor.
 * SESSAO-33 (D-142, respostas 3 e 6): a estrutura de cada produto e as
 * unidades fora do padrão — as duas só no clique (Lei §3).
 */
export function ClassificacaoProdutos() {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [textoBusca, setTextoBusca] = useState('')
  const busca = useDebouncedValue(textoBusca, 350)
  const [tipo, setTipo] = useState<TipoEstoque | 'todos'>('todos')
  const [classe, setClasse] = useState<string>('todas')
  const [origem, setOrigem] = useState<'todas' | 'automatico' | 'manual'>('todas')
  const [situacao, setSituacao] = useState<'A' | 'I' | 'todas'>('A')
  const [pagina, setPagina] = useState(1)
  const [estruturaDe, setEstruturaDe] = useState<number | null>(null)
  const [verUnidades, setVerUnidades] = useState(false)

  const filtros: FiltrosClassificacao = {
    busca,
    tipo: tipo === 'todos' ? null : tipo,
    classe: classe === 'todas' ? null : classe,
    origem: origem === 'todas' ? null : origem,
    situacao: situacao === 'todas' ? null : situacao,
  }
  const consulta = useQuery({
    queryKey: ['classificacao', filtros, pagina],
    queryFn: () => listarClassificacao(filtros, pagina),
    placeholderData: keepPreviousData,
  })
  const linhas = consulta.data?.linhas ?? []
  const total = consulta.data?.total ?? 0

  const trocar = useMutation({
    mutationFn: ({ produto, novo }: { produto: ProdutoClassificado; novo: TipoEstoque | null }) =>
      definirTipoProduto(produto.tiny_id, novo),
    onSuccess: async (vale, { produto, novo }) => {
      notificar({
        titulo:
          novo === null ? 'Voltou ao automático' : `Agora é ${ROTULO_TIPO[vale].toLowerCase()}`,
        descricao: produto.descricao,
        tom: 'perfeito',
      })
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['classificacao'] }),
        // as contas do estoque mudam junto (móveis × insumos e peças)
        clienteQuery.invalidateQueries({ queryKey: ['estoque'] }),
      ])
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para trocar o tipo',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  function mudarFiltro(aplicar: () => void) {
    aplicar()
    setPagina(1)
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-3 text-2xl sm:text-3xl">
          <Boxes aria-hidden className="size-7 text-texto-suave" />
          Móveis, insumos e peças
        </h1>
        <p className="mt-1 max-w-3xl text-texto-suave">
          O tipo de cada produto do Tiny no estoque. <strong>Móvel</strong> é produto final e entra
          nas contas de móveis (Top, mínimo, reposição); <strong>insumo</strong> e{' '}
          <strong>peça</strong> ficam na aba de matéria-prima e insumos, contados pelo número do
          Tiny. O automático vem do cadastro do Tiny — troque aqui o que nascer errado.
        </p>
      </div>

      <section
        aria-label="Unidades fora do padrão"
        className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-sm text-texto-suave">
            <strong className="text-texto">Unidades fora do padrão:</strong> os insumos e as peças
            ativos sem unidade ou com a unidade escrita diferente da mais usada (ex.: "Und" e "UN").
            A plataforma não converte nada — a correção é feita no cadastro do Tiny.
          </p>
          <Botao
            variante="secundaria"
            icone={verUnidades ? <ChevronUp aria-hidden /> : <Ruler aria-hidden />}
            aria-expanded={verUnidades}
            onClick={() => setVerUnidades((v) => !v)}
          >
            {verUnidades ? 'Esconder a lista' : 'Ver a lista'}
          </Botao>
        </div>
        {verUnidades && <UnidadesForaDoPadrao />}
      </section>

      <div className="grid grid-cols-1 gap-3 rounded-dm-lg border border-borda bg-superficie p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Campo
          rotulo="Buscar"
          placeholder="Nome ou SKU"
          value={textoBusca}
          onChange={(e) => mudarFiltro(() => setTextoBusca(e.target.value))}
        />
        <Selecao
          rotulo="Tipo"
          valor={tipo}
          aoMudar={(v) => mudarFiltro(() => setTipo(v as TipoEstoque | 'todos'))}
          opcoes={[
            { valor: 'todos', rotulo: 'Todos' },
            ...TIPOS.map((t) => ({ valor: t, rotulo: ROTULO_TIPO[t] })),
          ]}
        />
        <Selecao
          rotulo="No Tiny"
          valor={classe}
          aoMudar={(v) => mudarFiltro(() => setClasse(v))}
          opcoes={[
            { valor: 'todas', rotulo: 'Todas as classes' },
            ...Object.entries(ROTULO_CLASSE_TINY).map(([valor, rotulo]) => ({ valor, rotulo })),
          ]}
        />
        <Selecao
          rotulo="Origem do tipo"
          valor={origem}
          aoMudar={(v) => mudarFiltro(() => setOrigem(v as 'todas' | 'automatico' | 'manual'))}
          opcoes={[
            { valor: 'todas', rotulo: 'Automático e à mão' },
            { valor: 'automatico', rotulo: 'Só automático' },
            { valor: 'manual', rotulo: 'Só definido à mão' },
          ]}
        />
        <Selecao
          rotulo="Situação"
          valor={situacao}
          aoMudar={(v) => mudarFiltro(() => setSituacao(v as 'A' | 'I' | 'todas'))}
          opcoes={[
            { valor: 'A', rotulo: 'Ativos' },
            { valor: 'I', rotulo: 'Inativos' },
            { valor: 'todas', rotulo: 'Todos' },
          ]}
        />
      </div>

      {consulta.isError ? (
        <p className="rounded-dm-lg border border-danificado-forte bg-superficie p-4 text-sm text-danificado-forte">
          {consulta.error instanceof Error
            ? consulta.error.message
            : 'Não deu para carregar os produtos.'}
        </p>
      ) : consulta.isPending ? (
        <p className="text-sm text-texto-fraco">Carregando…</p>
      ) : total === 0 ? (
        <p className="rounded-dm-lg border border-borda bg-superficie p-5 text-sm text-texto-suave">
          Nenhum produto com esses filtros.
        </p>
      ) : (
        <>
          <p className="text-sm text-texto-suave" aria-live="polite">
            <strong className="text-texto tabular-nums">{total.toLocaleString('pt-BR')}</strong>{' '}
            {total === 1 ? 'produto' : 'produtos'}
            {consulta.isFetching ? ' · atualizando…' : ''}
          </p>
          <ul className="flex flex-col overflow-hidden rounded-dm-lg border border-borda bg-superficie">
            {linhas.map((p) => {
              const ocupado = trocar.isPending && trocar.variables?.produto.tiny_id === p.tiny_id
              const comEstrutura = estruturaDe === p.tiny_id
              return (
                <li
                  key={p.tiny_id}
                  className="flex flex-col gap-3 border-b border-borda px-4 py-3 last:border-b-0"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium break-words text-texto">{p.descricao}</p>
                      <p className="mt-0.5 text-xs text-texto-suave">
                        {[
                          p.codigo ? `SKU ${p.codigo}` : 'sem SKU',
                          p.classe ? (ROTULO_CLASSE_TINY[p.classe] ?? p.classe) : null,
                          p.unidade ? `unidade: ${p.unidade}` : null,
                          p.ncm ? `código fiscal ${p.ncm}` : 'sem código fiscal',
                          p.situacao === 'I' ? 'inativo no Tiny' : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        role="radiogroup"
                        aria-label={`Tipo de ${p.descricao}`}
                        className="inline-flex overflow-hidden rounded-dm border border-borda-forte"
                      >
                        {TIPOS.map((t) => (
                          <button
                            key={t}
                            type="button"
                            role="radio"
                            aria-checked={p.tipo === t}
                            disabled={ocupado}
                            onClick={() => {
                              if (p.tipo !== t) trocar.mutate({ produto: p, novo: t })
                            }}
                            className={cn(
                              'min-h-toque-md min-w-20 px-3 text-sm font-medium transition-colors',
                              p.tipo === t
                                ? 'bg-acao text-acao-texto'
                                : 'bg-superficie text-texto hover:bg-superficie-sutil',
                            )}
                          >
                            {ROTULO_TIPO[t]}
                          </button>
                        ))}
                      </div>
                      {p.definido_a_mao ? (
                        <>
                          <span className="text-xs font-medium text-texto-suave">
                            definido à mão
                          </span>
                          {/* o tipo automático no próprio texto — no tablet não há "passar o mouse" */}
                          <Botao
                            variante="fantasma"
                            icone={<RotateCcw />}
                            carregando={ocupado}
                            onClick={() => trocar.mutate({ produto: p, novo: null })}
                          >
                            Voltar ao automático ({ROTULO_TIPO[p.tipo_automatico].toLowerCase()})
                          </Botao>
                        </>
                      ) : (
                        <span className="text-xs text-texto-fraco">automático</span>
                      )}
                      <Botao
                        variante="fantasma"
                        icone={comEstrutura ? <ChevronUp aria-hidden /> : <ListTree aria-hidden />}
                        aria-expanded={comEstrutura}
                        onClick={() => setEstruturaDe(comEstrutura ? null : p.tiny_id)}
                      >
                        Estrutura
                      </Botao>
                    </div>
                  </div>
                  {comEstrutura && (
                    <div className="rounded-dm border border-borda bg-superficie-sutil p-3">
                      <EstruturaDoProduto tinyId={p.tiny_id} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {total > POR_PAGINA_CLASSIFICACAO && (
            <Paginacao
              paginaAtual={pagina}
              totalPaginas={Math.ceil(total / POR_PAGINA_CLASSIFICACAO)}
              totalItens={total}
              porPagina={POR_PAGINA_CLASSIFICACAO}
              aoMudarPagina={setPagina}
              className="rounded-dm-lg border border-borda bg-superficie"
            />
          )}
        </>
      )}
    </div>
  )
}
