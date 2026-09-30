import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, CirclePause, RefreshCw, Search, TriangleAlert, Warehouse } from 'lucide-react'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { Botao, Campo, Dica, Paginacao, useNotificacao } from '@/componentes/ui'
import { FiltroPill } from '@/dashboards/componentes/Filtros'
import { useAgora } from '@/kanban/tempo'
import { cn } from '@/lib/cn'
import {
  aplicarSugestoes,
  definirCapacidade,
  definirMinimo,
  desligarSincronismoTiny,
  ligarSincronismoTiny,
  listarConfiguracoesEstoque,
  resumoEstoque,
  situacaoTiny,
} from '@/logistica/api'
import type { LinhaConfiguracaoEstoque, ResumoEstoque } from '@/logistica/api'
import { formatarQuantidade, idadeDaLeitura, rotuloPosicao } from '@/logistica/estoque'
import { FotoProduto } from './FotoProduto'

const POR_PAGINA = 20

const COBERTURAS = [
  { valor: '1', rotulo: '1 semana' },
  { valor: '2', rotulo: '2 semanas' },
  { valor: '4', rotulo: '4 semanas' },
] as const

/** Texto do campo numérico → número (vazio = nulo). */
function lerNumero(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.')
  if (limpo === '') return null
  const n = Number(limpo)
  return Number.isFinite(n) ? n : Number.NaN
}

/**
 * Configurações do estoque (ajuste de 28/09 — D-72): a capacidade do galpão, o
 * mínimo de cada produto (editável aqui; vazio volta a valer o do Tiny) e a
 * sugestão de mínimo pela venda dos 90 dias, que CABE no galpão — se a soma
 * passar da capacidade, todas encolhem na mesma proporção e o mais vendido
 * continua com mais. A regra mora no banco; a tela só mostra e grava.
 */
export function PainelConfiguracoes({ ativo, podeMexer }: { ativo: boolean; podeMexer: boolean }) {
  const [cobertura, setCobertura] = useState<'1' | '2' | '4'>('2')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [confirmandoTodas, setConfirmandoTodas] = useState(false)
  const semanas = Number(cobertura)
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const { data: resumo } = useQuery({
    queryKey: ['estoque', 'resumo', semanas],
    queryFn: () => resumoEstoque(semanas),
    enabled: ativo,
  })
  const { data: linhas = [], isPending, isError, error } = useQuery({
    queryKey: ['estoque', 'configuracoes', semanas, busca, pagina],
    queryFn: () =>
      listarConfiguracoesEstoque({
        semanas,
        busca,
        limite: POR_PAGINA,
        deslocamento: (pagina - 1) * POR_PAGINA,
      }),
    enabled: ativo,
    placeholderData: keepPreviousData,
  })
  const total = linhas[0]?.contagem_total ?? 0

  const todas = useMutation({
    mutationFn: () => aplicarSugestoes(semanas),
    onSuccess: async (n) => {
      setConfirmandoTodas(false)
      notificar({
        titulo: 'Mínimos atualizados',
        descricao: n === 1 ? '1 produto mudou de mínimo.' : `${n} produtos mudaram de mínimo.`,
        tom: 'perfeito',
      })
      await clienteQuery.invalidateQueries({ queryKey: ['estoque'] })
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para usar as sugestões',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  return (
    <div className="flex flex-col gap-5">
      <CartaoGalpao resumo={resumo ?? null} podeMexer={podeMexer} />
      <CartaoTiny ativo={ativo} />

      <section aria-label="Mínimo por produto" className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            {/* relative: o balão do "i" ancora nesta linha (ver Dica). */}
            <div className="relative flex items-center gap-1">
              <h2 className="text-lg font-semibold text-texto">Mínimo por produto</h2>
              <Dica rotulo="Como a sugestão de mínimo é calculada">
                <span className="flex flex-col gap-2">
                  <span>Os mais vendidos dos últimos 90 dias vêm primeiro.</span>
                  <span>
                    A sugestão é a venda média da semana vezes a cobertura. Se a soma passar da
                    capacidade do galpão, todas encolhem na mesma proporção — o mais vendido
                    continua com mais.
                  </span>
                  <span>Mínimo vazio volta a valer o do Tiny.</span>
                </span>
              </Dica>
            </div>
            <FiltroPill
              rotulo="Cobertura"
              opcoes={COBERTURAS}
              valor={cobertura}
              aoMudar={(v) => {
                setCobertura(v)
                setConfirmandoTodas(false)
              }}
            />
          </div>
          {podeMexer &&
            (confirmandoTodas ? (
              <div className="flex max-w-md flex-col gap-2 self-start rounded-dm-lg border border-atencao-borda bg-atencao-fundo p-3 lg:self-end">
                <p className="text-sm text-atencao-texto">
                  Todos os mínimos passam a ser a sugestão — quem não vendeu em 90 dias fica sem
                  mínimo. Pode ajustar um a um depois.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Botao onClick={() => todas.mutate()} carregando={todas.isPending}>
                    Sim, usar todas
                  </Botao>
                  <Botao variante="secundaria" onClick={() => setConfirmandoTodas(false)}>
                    Cancelar
                  </Botao>
                </div>
              </div>
            ) : (
              <Botao
                variante="secundaria"
                className="self-start lg:self-end"
                onClick={() => setConfirmandoTodas(true)}
              >
                Usar todas as sugestões
              </Botao>
            ))}
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
              key={`${linha.tiny_id}-${linha.minimo ?? 'x'}-${linha.minimo_definido_aqui}`}
              linha={linha}
              podeMexer={podeMexer}
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
      </section>
    </div>
  )
}

function Numero({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: string }) {
  return (
    <div className="flex flex-col rounded-dm bg-superficie-sutil px-3 py-2">
      <span className="text-xs text-texto-suave">{rotulo}</span>
      <span className="text-lg font-semibold text-texto tabular-nums">{valor}</span>
      {alerta && (
        <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-atencao-texto">
          <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
          {alerta}
        </span>
      )}
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
          alerta={situacao && situacao.parados.length > 0 ? 'veja abaixo' : undefined}
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

/** A capacidade do galpão e o retrato de agora — os números saem de uma porta só. */
function CartaoGalpao({ resumo, podeMexer }: { resumo: ResumoEstoque | null; podeMexer: boolean }) {
  const capacidadeAtual = resumo?.capacidade ?? null
  const [texto, setTexto] = useState<string | null>(null)
  const valorCampo = texto ?? (capacidadeAtual === null ? '' : String(capacidadeAtual))
  const numero = lerNumero(valorCampo)
  const valido = numero === null || (Number.isInteger(numero) && numero >= 1 && numero <= 100000)
  const mudou = numero !== capacidadeAtual
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const salvar = useMutation({
    mutationFn: () => definirCapacidade(numero),
    onSuccess: async () => {
      setTexto(null)
      notificar({
        titulo: numero === null ? 'Capacidade do galpão removida' : 'Capacidade do galpão salva',
        tom: 'perfeito',
      })
      await clienteQuery.invalidateQueries({ queryKey: ['estoque'] })
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para salvar a capacidade',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  const passou =
    resumo && capacidadeAtual !== null && resumo.soma_minimos > capacidadeAtual
      ? 'passa da capacidade do galpão'
      : undefined

  return (
    <section
      aria-label="Capacidade do galpão"
      className="flex flex-col gap-4 rounded-dm-lg border border-borda bg-superficie p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex items-center gap-2 sm:self-center">
          <Warehouse aria-hidden className="size-6 shrink-0 text-texto-suave" />
          <h2 className="text-lg font-semibold text-texto">Galpão</h2>
        </div>
        <form
          className="flex flex-1 flex-wrap items-end gap-2 sm:justify-end"
          onSubmit={(evento) => {
            evento.preventDefault()
            if (valido && mudou && podeMexer) salvar.mutate()
          }}
        >
          <div className="w-44">
            <Campo
              rotulo="Quantas peças cabem"
              type="number"
              inputMode="numeric"
              min={1}
              max={100000}
              step={1}
              placeholder="Ex.: 300"
              value={valorCampo}
              disabled={!podeMexer}
              erro={valido ? undefined : 'De 1 a 100000'}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
          {podeMexer && (
            <Botao
              type="submit"
              variante="secundaria"
              disabled={!valido || !mudou}
              carregando={salvar.isPending}
              className={cn(!valido && 'mb-7')}
            >
              Salvar
            </Botao>
          )}
        </form>
      </div>
      {capacidadeAtual === null && (
        <p className="text-sm text-texto-suave">
          Sem a capacidade, a sugestão de mínimo não tem teto.
        </p>
      )}
      {/* Enquanto carrega, "…" — zero seria um número falso. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Numero
          rotulo="Peças no estoque agora"
          valor={resumo ? formatarQuantidade(resumo.pecas_no_estoque) : '…'}
        />
        <Numero
          rotulo="Reservadas (em aguardo)"
          valor={resumo ? formatarQuantidade(resumo.pecas_reservadas) : '…'}
        />
        <Numero
          rotulo="Soma dos mínimos"
          valor={resumo ? formatarQuantidade(resumo.soma_minimos) : '…'}
          alerta={passou}
        />
        <Numero
          rotulo="Soma das sugestões"
          valor={resumo ? formatarQuantidade(resumo.soma_sugestoes) : '…'}
        />
      </div>
    </section>
  )
}

/** Um produto: o mínimo (editável), de onde ele vem, e a sugestão com o "usar". */
function LinhaConfiguracao({
  linha,
  podeMexer,
}: {
  linha: LinhaConfiguracaoEstoque
  podeMexer: boolean
}) {
  const atual = linha.minimo_definido_aqui ? linha.minimo : null
  const [texto, setTexto] = useState(
    linha.minimo_definido_aqui && linha.minimo !== null ? String(linha.minimo) : '',
  )
  const numero = lerNumero(texto)
  const valido = numero === null || (numero >= 0 && numero <= 100000)
  const mudou = numero !== atual
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const salvar = useMutation({
    mutationFn: (minimo: number | null) => definirMinimo(linha.tiny_id, minimo),
    onSuccess: async () => {
      notificar({ titulo: 'Mínimo salvo', descricao: linha.descricao, tom: 'perfeito' })
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
  const sugestaoDiferente = linha.sugestao !== null && linha.sugestao !== (linha.minimo ?? 0)

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
          </span>
        </div>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(evento) => {
          evento.preventDefault()
          if (valido && mudou && podeMexer) salvar.mutate(numero)
        }}
      >
        <div className="w-28">
          <Campo
            rotulo="Mínimo"
            type="number"
            inputMode="numeric"
            min={0}
            max={100000}
            step={1}
            placeholder={linha.minimo_tiny !== null ? `${formatarQuantidade(linha.minimo_tiny)} (Tiny)` : '—'}
            value={texto}
            disabled={!podeMexer}
            erro={valido ? undefined : 'De 0 a 100000'}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        {podeMexer && mudou && valido && (
          <Botao type="submit" variante="secundaria" carregando={salvar.isPending}>
            Salvar
          </Botao>
        )}
        <div
          className={cn(
            // Largura fixa: as linhas ficam alinhadas com 1 ou 2 dígitos.
            'flex h-toque-md min-w-[7.5rem] items-center justify-between gap-2 rounded-dm px-3',
            sugestaoDiferente ? 'border border-acao-ativa' : 'bg-superficie-sutil',
          )}
        >
          <span className="text-xs text-texto-suave">Sugestão</span>
          <span className="text-base font-semibold text-texto tabular-nums">
            {linha.sugestao === null ? '—' : linha.sugestao}
          </span>
        </div>
        {podeMexer && sugestaoDiferente && (
          <Botao
            type="button"
            variante="fantasma"
            onClick={() => salvar.mutate(linha.sugestao)}
            disabled={salvar.isPending}
          >
            Usar
          </Botao>
        )}
      </form>
    </li>
  )
}
