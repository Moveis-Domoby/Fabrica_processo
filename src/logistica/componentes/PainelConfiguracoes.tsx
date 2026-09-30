import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, CirclePause, RefreshCw, Search, Warehouse } from 'lucide-react'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { Botao, Campo, Dica, Paginacao, useNotificacao } from '@/componentes/ui'
import { FiltroPill } from '@/dashboards/componentes/Filtros'
import { useAgora } from '@/kanban/tempo'
import { cn } from '@/lib/cn'
import {
  configEstoque,
  definirCobertura,
  definirMinimo,
  desligarSincronismoTiny,
  ligarSincronismoTiny,
  listarConfiguracoesEstoque,
  minimoAutomatico,
  resumoEstoque,
  situacaoTiny,
} from '@/logistica/api'
import type { LinhaConfiguracaoEstoque, ResumoEstoque } from '@/logistica/api'
import { formatarQuantidade, idadeDaLeitura, rotuloPosicao, textoCorte } from '@/logistica/estoque'
import { FotoProduto } from './FotoProduto'

/** Coberturas de 1 a 8 semanas (resposta 2 do dono): três prontas + digitar. */
const COBERTURAS = [
  { valor: '1', rotulo: '1 semana' },
  { valor: '2', rotulo: '2 semanas' },
  { valor: '3', rotulo: '3 semanas' },
  { valor: 'outra', rotulo: 'Personalizada' },
] as const

/** Texto do campo numérico → número (vazio = nulo). */
function lerNumero(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.')
  if (limpo === '') return null
  const n = Number(limpo)
  return Number.isFinite(n) ? n : Number.NaN
}

/**
 * Configurações do estoque (↪️ 30/09 — D-84): a lista segue a MESMA ordem e a
 * mesma página do Top X; o mínimo é AUTOMÁTICO (acompanha a sugestão por dias
 * úteis de venda) e trava quando alguém edita à mão — até "voltar ao
 * automático". A capacidade do galpão e o "usar todas as sugestões" saíram; o
 * mínimo do Tiny é só referência. A regra mora no banco; a tela mostra e grava.
 */
export function PainelConfiguracoes({ ativo, podeMexer }: { ativo: boolean; podeMexer: boolean }) {
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const { data: config } = useQuery({
    queryKey: ['estoque', 'config'],
    queryFn: configEstoque,
    enabled: ativo,
  })
  const topX = config?.top_x ?? 20
  const cobertura = config?.cobertura_semanas ?? 2

  const { data: resumo } = useQuery({
    queryKey: ['estoque', 'resumo'],
    queryFn: resumoEstoque,
    enabled: ativo,
  })
  const { data: linhas = [], isPending, isError, error } = useQuery({
    queryKey: ['estoque', 'configuracoes', busca, pagina, topX],
    queryFn: () =>
      listarConfiguracoesEstoque({
        busca,
        limite: topX,
        deslocamento: (pagina - 1) * topX,
      }),
    enabled: ativo,
    placeholderData: keepPreviousData,
  })
  const total = linhas[0]?.contagem_total ?? 0

  const mudarCobertura = useMutation({
    mutationFn: (semanas: number) => definirCobertura(semanas),
    onSuccess: async (_, semanas) => {
      notificar({
        titulo: 'Cobertura salva',
        descricao: `Os mínimos automáticos foram recalculados para ${semanas} ${semanas === 1 ? 'semana' : 'semanas'}.`,
        tom: 'perfeito',
      })
      await clienteQuery.invalidateQueries({ queryKey: ['estoque'] })
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para mudar a cobertura',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })
  const [coberturaTexto, setCoberturaTexto] = useState<string | null>(null)
  const coberturaPill = cobertura <= 3 && coberturaTexto === null ? String(cobertura) : 'outra'
  const coberturaDigitada = coberturaTexto === null ? cobertura : Number(coberturaTexto)
  const coberturaValida = Number.isInteger(coberturaDigitada) && coberturaDigitada >= 1 && coberturaDigitada <= 8

  return (
    <div className="flex flex-col gap-5">
      <CartaoGalpao resumo={resumo ?? null} />
      <CartaoTiny ativo={ativo} />

      <section aria-label="Mínimo por produto" className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            {/* relative: o balão do "i" ancora nesta linha (ver Dica). */}
            <div className="relative flex items-center gap-1">
              <h2 className="text-lg font-semibold text-texto">Mínimo por produto</h2>
              <Dica rotulo="Como o mínimo automático funciona">
                <span className="flex flex-col gap-2">
                  <span>
                    Só os {topX} mais vendidos (o Top X) têm mínimo. A sugestão é a venda por dia
                    útil da loja (segunda a sábado) vezes a semana e a cobertura, arredondada para
                    cima.
                  </span>
                  <span>
                    O mínimo acompanha a sugestão sozinho. Editou à mão, trava naquele valor até
                    tocar em "voltar ao automático". O do Tiny fica só como referência.
                  </span>
                  <span>Pedido fora do comum (Painel admin) não entra na conta.</span>
                </span>
              </Dica>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <FiltroPill
                rotulo="Cobertura"
                opcoes={COBERTURAS}
                valor={coberturaPill}
                aoMudar={(v) => {
                  if (v === 'outra') {
                    setCoberturaTexto(String(cobertura))
                    return
                  }
                  setCoberturaTexto(null)
                  if (podeMexer && Number(v) !== cobertura) mudarCobertura.mutate(Number(v))
                }}
              />
              {coberturaPill === 'outra' && (
                <form
                  className="flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (podeMexer && coberturaValida && coberturaDigitada !== cobertura)
                      mudarCobertura.mutate(coberturaDigitada)
                  }}
                >
                  <div className="w-28">
                    <Campo
                      rotulo="Semanas (1–8)"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={8}
                      step={1}
                      value={coberturaTexto ?? String(cobertura)}
                      erro={coberturaValida ? undefined : 'De 1 a 8'}
                      onChange={(e) => setCoberturaTexto(e.target.value)}
                    />
                  </div>
                  {coberturaValida && coberturaDigitada !== cobertura && podeMexer && (
                    <Botao type="submit" variante="secundaria" carregando={mudarCobertura.isPending}>
                      Salvar
                    </Botao>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>

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

        {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
        {isError && (
          <p className="rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto">
            {error instanceof Error ? error.message : 'Não deu para carregar os mínimos.'}
          </p>
        )}
        {!isPending && !isError && linhas.length === 0 && (
          <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
            Nenhum produto com esse nome ou SKU.
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {linhas.map((linha) => (
            <LinhaConfiguracao
              key={`${linha.tiny_id}-${linha.minimo ?? 'x'}-${linha.minimo_travado}`}
              linha={linha}
              podeMexer={podeMexer}
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
      </section>
    </div>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col rounded-dm bg-superficie-sutil px-3 py-2">
      <span className="text-xs text-texto-suave">{rotulo}</span>
      <span className="text-lg font-semibold text-texto tabular-nums">{valor}</span>
    </div>
  )
}

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/**
 * Estoque × Tiny (D-76…D-80): a chave (só o admin liga e desliga) e a
 * situação — o que está na fila, o que parou com erro e os últimos ajustes
 * gravados no Tiny. Quem faz o trabalho é o fluxo do n8n; aqui só se vê.
 */
function CartaoTiny({ ativo }: { ativo: boolean }) {
  const { perfil } = useSessao()
  const souAdmin = perfil?.papel === 'admin'
  const agora = useAgora()
  const [confirmando, setConfirmando] = useState<'ligar' | 'desligar' | null>(null)
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const { data: situacao, isPending } = useQuery({
    queryKey: ['estoque', 'tiny'],
    queryFn: situacaoTiny,
    enabled: ativo,
    refetchInterval: 30_000,
  })
  const ligado = Boolean(situacao?.ligado_desde)

  const chave = useMutation({
    mutationFn: async (acao: 'ligar' | 'desligar') =>
      acao === 'ligar' ? ligarSincronismoTiny() : (await desligarSincronismoTiny(), 0),
    onSuccess: async (produtos, acao) => {
      setConfirmando(null)
      notificar({
        titulo: acao === 'ligar' ? 'Sincronismo com o Tiny ligado' : 'Sincronismo com o Tiny desligado',
        descricao:
          acao === 'ligar'
            ? `${produtos} produtos vão copiar o saldo do Tiny nos próximos minutos.`
            : 'O número daqui deixa de conversar com o Tiny.',
        tom: 'perfeito',
      })
      await clienteQuery.invalidateQueries({ queryKey: ['estoque'] })
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para mudar o sincronismo',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  return (
    <section
      aria-label="Sincronismo com o Tiny"
      className="flex flex-col gap-4 rounded-dm-lg border border-borda bg-superficie p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* relative: o balão do "i" ancora nesta linha (ver Dica). */}
        <div className="relative flex items-center gap-2">
          <RefreshCw aria-hidden className="size-6 shrink-0 text-texto-suave" />
          <h2 className="text-lg font-semibold text-texto">Tiny</h2>
          <Dica rotulo="Como o estoque conversa com o Tiny">
            <span className="flex flex-col gap-2">
              <span>Ligado, a plataforma e o Tiny mostram o mesmo número de cada produto pronto.</span>
              <span>
                O que entra no Tiny sobe aqui. Entrada, baixa e contagem feitas aqui vão para o Tiny. A
                venda reserva a peça na hora e não vai para o Tiny (ele já baixa sozinho).
              </span>
              <span>Ao ligar, cada produto copia uma vez o saldo do Tiny (as duas empresas somadas).</span>
            </span>
          </Dica>
        </div>
        <p
          className={cn(
            'inline-flex items-center gap-1.5 text-sm font-medium',
            ligado ? 'text-perfeito-texto' : 'text-texto-suave',
          )}
        >
          {ligado ? (
            <CircleCheck aria-hidden className="size-4 shrink-0" />
          ) : (
            <CirclePause aria-hidden className="size-4 shrink-0" />
          )}
          {isPending
            ? '…'
            : ligado
              ? `Ligado desde ${dataHora(situacao!.ligado_desde!)}`
              : 'Desligado — o número daqui não conversa com o Tiny'}
        </p>
      </div>

      {/* Enquanto carrega, "…" — zero seria um número falso. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Numero rotulo="Produtos na fila" valor={situacao ? formatarQuantidade(situacao.na_fila) : '…'} />
        <Numero
          rotulo="Última leitura do Tiny"
          valor={situacao ? (idadeDaLeitura(situacao.ultima_leitura_em, agora) ?? '—') : '…'}
        />
        <Numero
          rotulo="Parados com erro"
          valor={situacao ? formatarQuantidade(situacao.parados.length) : '…'}
        />
      </div>

      {situacao && situacao.parados.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-dm border border-atencao-borda bg-atencao-fundo p-3 text-sm text-atencao-texto">
          {situacao.parados.map((p) => (
            <li key={`${p.sku}-${p.desde}`} className="flex flex-col">
              <span className="font-medium">
                {p.sku ? `SKU ${p.sku} · ` : ''}
                {p.descricao}
              </span>
              <span className="text-xs">
                {p.erro ?? 'erro sem descrição'} · parou {idadeDaLeitura(p.desde, agora)}. Um movimento novo do
                produto tenta de novo.
              </span>
            </li>
          ))}
        </ul>
      )}

      {situacao && situacao.ultimos_ajustes.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-texto">Últimos ajustes gravados no Tiny</h3>
          <ul className="flex flex-col gap-1 text-sm text-texto-suave">
            {situacao.ultimos_ajustes.map((a) => (
              <li key={a.em} className="tabular-nums">
                {a.sku ? `SKU ${a.sku}: ` : ''}
                Tiny de {formatarQuantidade(Number(a.tiny_antes ?? 0))} para{' '}
                <span className="font-medium text-texto">{formatarQuantidade(Number(a.tiny_depois ?? 0))}</span>
                {a.deposito ? ` (depósito ${a.deposito})` : ''} · {idadeDaLeitura(a.em, agora)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {souAdmin &&
        (confirmando ? (
          <div className="flex max-w-xl flex-col gap-2 rounded-dm-lg border border-atencao-borda bg-atencao-fundo p-3">
            <p className="text-sm text-atencao-texto">
              {confirmando === 'ligar'
                ? 'Cada produto pronto passa a ter aqui o saldo do Tiny (as duas empresas somadas) — o que estiver diferente é acertado para o número do Tiny. Depois disso, os dois andam juntos.'
                : 'Desligado, o que acontecer aqui não vai para o Tiny, o que entrar no Tiny não sobe aqui, e a venda nova não reserva peça.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Botao onClick={() => chave.mutate(confirmando)} carregando={chave.isPending}>
                {confirmando === 'ligar' ? 'Sim, ligar e copiar o Tiny' : 'Sim, desligar'}
              </Botao>
              <Botao variante="secundaria" onClick={() => setConfirmando(null)}>
                Cancelar
              </Botao>
            </div>
          </div>
        ) : (
          <Botao
            variante={ligado ? 'secundaria' : 'primaria'}
            className="self-start"
            disabled={isPending}
            onClick={() => setConfirmando(ligado ? 'desligar' : 'ligar')}
          >
            {ligado ? 'Desligar o sincronismo' : 'Ligar o sincronismo com o Tiny'}
          </Botao>
        ))}
    </section>
  )
}

/**
 * O retrato do galpão (pedido do dono, 30/09): SEIS números, uma porta só.
 * O campo "quantas peças cabem" saiu — quem limita o estoque é o Top X (D-83).
 */
function CartaoGalpao({ resumo }: { resumo: ResumoEstoque | null }) {
  return (
    <section
      aria-label="Retrato do galpão"
      className="flex flex-col gap-4 rounded-dm-lg border border-borda bg-superficie p-4"
    >
      <div className="flex items-center gap-2">
        <Warehouse aria-hidden className="size-6 shrink-0 text-texto-suave" />
        <h2 className="text-lg font-semibold text-texto">Galpão</h2>
      </div>
      {/* Enquanto carrega, "…" — zero seria um número falso. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Numero
          rotulo="Móveis em estoque"
          valor={resumo ? formatarQuantidade(resumo.moveis_estoque) : '…'}
        />
        <Numero
          rotulo="Peças em estoque (un.)"
          valor={resumo ? formatarQuantidade(resumo.pecas_unidades) : '…'}
        />
        <Numero
          rotulo="Peças em estoque (m²)"
          valor={resumo ? formatarQuantidade(resumo.pecas_m2) : '…'}
        />
        <Numero
          rotulo="Móveis prontos reservados"
          valor={resumo ? formatarQuantidade(resumo.moveis_reservados) : '…'}
        />
        <Numero
          rotulo="Peças em produção"
          valor={resumo ? formatarQuantidade(resumo.pecas_producao) : '…'}
        />
        <Numero
          rotulo="Móveis em produção"
          valor={resumo ? formatarQuantidade(resumo.moveis_producao) : '…'}
        />
      </div>
    </section>
  )
}

/**
 * Um produto: o mínimo automático (editar TRAVA), a sugestão do dia e o
 * "voltar ao automático". Fora do Top X, sem mínimo (D-83).
 */
function LinhaConfiguracao({
  linha,
  podeMexer,
}: {
  linha: LinhaConfiguracaoEstoque
  podeMexer: boolean
}) {
  const [texto, setTexto] = useState<string | null>(null)
  const valorCampo = texto ?? (linha.minimo === null ? '' : String(linha.minimo))
  const numero = lerNumero(valorCampo)
  const valido = numero !== null && Number.isFinite(numero) && numero >= 0 && numero <= 100000
  const mudou = numero !== linha.minimo
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const salvar = useMutation({
    mutationFn: (acao: { tipo: 'travar'; minimo: number } | { tipo: 'automatico' }) =>
      acao.tipo === 'travar' ? definirMinimo(linha.tiny_id, acao.minimo) : minimoAutomatico(linha.tiny_id),
    onSuccess: async (_, acao) => {
      setTexto(null)
      notificar({
        titulo: acao.tipo === 'travar' ? 'Mínimo travado neste valor' : 'Mínimo de volta ao automático',
        descricao: linha.descricao,
        tom: 'perfeito',
      })
      await clienteQuery.invalidateQueries({ queryKey: ['estoque'] })
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para salvar o mínimo',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  const posicao = rotuloPosicao(linha.posicao)
  const corte = textoCorte(linha.cortes)

  return (
    <li className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-3 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-label={posicao ? `${posicao} mais vendido` : 'Sem venda em 90 dias'}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-superficie-sutil text-sm font-semibold text-texto tabular-nums"
        >
          {posicao ?? '—'}
        </span>
        <FotoProduto
          produto={linha}
          podeTrocar={false}
          iconeGrande={false}
          className="size-12 shrink-0 rounded-dm"
        />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-texto" title={linha.descricao}>
            {linha.descricao}
          </span>
          <span className="text-xs text-texto-suave tabular-nums">
            {linha.codigo ? `SKU ${linha.codigo}` : 'sem SKU'}
            {linha.vendidos_90d > 0
              ? ` · ${formatarQuantidade(linha.vendidos_90d)} em 90 dias · ${formatarQuantidade(linha.media_semana)} por semana`
              : ' · sem venda em 90 dias'}
            {` · ${formatarQuantidade(linha.em_estoque)} em estoque`}
            {linha.minimo_tiny !== null && ` · Tiny: ${formatarQuantidade(linha.minimo_tiny)}`}
          </span>
          {corte && <span className="text-[11px] text-texto-fraco">{corte}</span>}
        </div>
      </div>

      {linha.no_top ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(evento) => {
            evento.preventDefault()
            if (valido && mudou && podeMexer) salvar.mutate({ tipo: 'travar', minimo: numero })
          }}
        >
          <div className="w-28">
            <Campo
              rotulo={linha.minimo_travado ? 'Mínimo (travado)' : 'Mínimo (automático)'}
              type="number"
              inputMode="numeric"
              min={0}
              max={100000}
              step={1}
              value={valorCampo}
              disabled={!podeMexer}
              erro={texto === null || valido ? undefined : 'De 0 a 100000'}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
          {podeMexer && texto !== null && mudou && valido && (
            <Botao type="submit" variante="secundaria" carregando={salvar.isPending}>
              Travar neste valor
            </Botao>
          )}
          <div
            className={cn(
              // Largura fixa: as linhas ficam alinhadas com 1 ou 2 dígitos.
              'flex h-toque-md min-w-[7.5rem] items-center justify-between gap-2 rounded-dm px-3',
              linha.minimo_travado ? 'border border-acao-ativa' : 'bg-superficie-sutil',
            )}
          >
            <span className="text-xs text-texto-suave">Sugestão</span>
            <span className="text-base font-semibold text-texto tabular-nums">
              {linha.sugestao === null ? '—' : linha.sugestao}
            </span>
          </div>
          {podeMexer && linha.minimo_travado && (
            <Botao
              type="button"
              variante="fantasma"
              onClick={() => salvar.mutate({ tipo: 'automatico' })}
              disabled={salvar.isPending}
            >
              Voltar ao automático
            </Botao>
          )}
        </form>
      ) : (
        <p className="text-sm text-texto-suave">Fora do Top X — sem mínimo e sem reposição.</p>
      )}
    </li>
  )
}
