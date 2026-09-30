import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CirclePause,
  Package,
  RefreshCw,
  Scissors,
} from 'lucide-react'
import { Botao, Campo, Dica, useNotificacao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { useAgora } from '@/kanban/tempo'
import { cn } from '@/lib/cn'
import {
  configEstoque,
  definirCorte,
  definirTopX,
  desligarReposicao,
  desligarSincronismoTiny,
  ligarReposicao,
  ligarSincronismoTiny,
  situacaoReposicao,
  situacaoTiny,
} from '@/logistica/api'
import { formatarQuantidade, idadeDaLeitura } from '@/logistica/estoque'
import { ReservasPresasTiny } from '@/logistica/componentes/ReservasPresasTiny'

/**
 * Painel admin → Estoque (Ajuste Estoque 2 — D-83/D-87; rodada do dono 30/09):
 * o liga/desliga da REPOSIÇÃO AUTOMÁTICA (agenda/desagenda a rotina de
 * verdade), o TOP X (a régua e a página do estoque), o CORTE de pedido fora do
 * comum e o quadro do SINCRONISMO com o Tiny — tudo do admin, num lugar só.
 */
export function AdminEstoque() {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [confirmando, setConfirmando] = useState<'ligar' | 'desligar' | null>(null)

  const { data: situacao, isPending } = useQuery({
    queryKey: ['estoque', 'reposicao-situacao'],
    queryFn: situacaoReposicao,
    refetchInterval: 30_000,
  })
  const ligada = Boolean(situacao?.ligada)

  const { data: config } = useQuery({ queryKey: ['estoque', 'config'], queryFn: configEstoque })

  // Top X (rodada do dono, 30/09: mudou das Configurações do Estoque para cá).
  const topX = config?.top_x ?? 20
  const [topXTexto, setTopXTexto] = useState<string | null>(null)
  const topXDigitado = topXTexto === null ? topX : Number(topXTexto)
  const topXValido = Number.isInteger(topXDigitado) && topXDigitado >= 1 && topXDigitado <= 50
  const salvarTopX = useMutation({
    mutationFn: (x: number) => definirTopX(x),
    onSuccess: async (_, x) => {
      setTopXTexto(null)
      notificar({
        titulo: 'Top X salvo para toda a equipe',
        descricao: `Só os ${x} mais vendidos têm mínimo; a página da lista passa a ser de ${x}.`,
        tom: 'perfeito',
      })
      await clienteQuery.invalidateQueries({ queryKey: ['estoque'] })
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para salvar o Top X',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  const corteAtual = config?.corte_pedido_grande ?? 10
  const [textoCorte, setTextoCorte] = useState<string | null>(null)
  const corteDigitado = textoCorte === null ? corteAtual : Number(textoCorte)
  const corteValido = Number.isInteger(corteDigitado) && corteDigitado >= 1 && corteDigitado <= 100000

  const chave = useMutation({
    mutationFn: async (acao: 'ligar' | 'desligar') =>
      acao === 'ligar' ? ligarReposicao() : desligarReposicao(),
    onSuccess: async (_, acao) => {
      setConfirmando(null)
      notificar({
        titulo: acao === 'ligar' ? 'Reposição automática ligada' : 'Reposição automática desligada',
        descricao:
          acao === 'ligar'
            ? 'A cada 5 minutos, o que estiver abaixo do mínimo vira card de reposição no PCP.'
            : 'Nada roda sozinho. A logística lança para produção à mão, pela tela do Estoque.',
        tom: 'perfeito',
      })
      await clienteQuery.invalidateQueries({ queryKey: ['estoque'] })
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para mudar a reposição automática',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  const salvarCorte = useMutation({
    mutationFn: () => definirCorte(corteDigitado),
    onSuccess: async () => {
      setTextoCorte(null)
      notificar({
        titulo: 'Corte salvo',
        descricao: 'O ranking do Top X e as sugestões de mínimo foram recalculados.',
        tom: 'perfeito',
      })
      await clienteQuery.invalidateQueries({ queryKey: ['estoque'] })
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para salvar o corte',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl sm:text-3xl">
          <Package aria-hidden className="size-7 shrink-0 text-texto-suave" />
          Estoque
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-texto-suave">
          A automação da reposição, o Top X, o corte de pedido fora do comum e o sincronismo com o
          Tiny. A cobertura e os mínimos ficam na própria tela do Estoque, com a logística.
        </p>
      </div>

      <section
        aria-label="Reposição automática"
        className="flex flex-col gap-4 rounded-dm-lg border border-borda bg-superficie p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex items-center gap-2">
            <h2 className="text-lg font-semibold text-texto">Reposição automática</h2>
            <Dica rotulo="Como a reposição automática funciona">
              <span className="flex flex-col gap-2">
                <span>
                  Ligada, a cada 5 minutos o produto do Top X que ficar abaixo do mínimo (já
                  contando o que vem para o estoque) vira um card de reposição no PCP — e o PCP
                  decide.
                </span>
                <span>
                  Desligada, NADA roda sozinho: a rotina deixa de existir no relógio do banco, e a
                  logística lança para produção à mão pela tela do Estoque.
                </span>
                <span>Parada 2 dias úteis no PCP, a reposição sai sozinha — ligada ou não.</span>
              </span>
            </Dica>
          </div>
          <p
            className={cn(
              'inline-flex items-center gap-1.5 text-sm font-medium',
              ligada ? 'text-perfeito-texto' : 'text-texto-suave',
            )}
          >
            {ligada ? (
              <CircleCheck aria-hidden className="size-4 shrink-0" />
            ) : (
              <CirclePause aria-hidden className="size-4 shrink-0" />
            )}
            {isPending ? '…' : ligada ? 'Ligada' : 'Desligada — a logística lança à mão'}
          </p>
        </div>

        {confirmando ? (
          <div className="flex max-w-xl flex-col gap-2 rounded-dm-lg border border-atencao-borda bg-atencao-fundo p-3">
            <p className="text-sm text-atencao-texto">
              {confirmando === 'ligar'
                ? 'Com estoque ainda sem a contagem inicial, TODO produto do Top X com mínimo vai pedir reposição ao PCP de uma vez. Confira a contagem antes de ligar.'
                : 'Desligada, nenhuma reposição nasce sozinha — o botão "Lançar para produção" volta a aparecer na tela do Estoque.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Botao onClick={() => chave.mutate(confirmando)} carregando={chave.isPending}>
                {confirmando === 'ligar' ? 'Sim, ligar' : 'Sim, desligar'}
              </Botao>
              <Botao variante="secundaria" onClick={() => setConfirmando(null)}>
                Cancelar
              </Botao>
            </div>
          </div>
        ) : (
          <Botao
            variante={ligada ? 'secundaria' : 'primaria'}
            className="self-start"
            disabled={isPending}
            onClick={() => setConfirmando(ligada ? 'desligar' : 'ligar')}
          >
            {ligada ? 'Desligar a reposição automática' : 'Ligar a reposição automática'}
          </Botao>
        )}
      </section>

      <section
        aria-label="Top X e corte de pedido fora do comum"
        className="relative flex flex-col gap-4 rounded-dm-lg border border-borda bg-superficie p-4"
      >
        <div className="flex items-center gap-2">
          <Scissors aria-hidden className="size-5 shrink-0 text-texto-suave" />
          <h2 className="text-lg font-semibold text-texto">Top X e o pedido fora do comum</h2>
        </div>
        {/* relative na section: os balões dos "i" ancoram na largura toda. */}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <form
            className="flex items-end gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              if (topXValido && topXDigitado !== topX) salvarTopX.mutate(topXDigitado)
            }}
          >
            <div className="w-24">
              <Campo
                rotulo="Top X"
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                step={1}
                value={topXTexto ?? String(topX)}
                erro={topXValido ? undefined : 'De 1 a 50'}
                onChange={(e) => setTopXTexto(e.target.value)}
              />
            </div>
            <span className="mb-2 inline-flex">
              <Dica rotulo="O que é o Top X">
                <span className="flex flex-col gap-2">
                  <span>
                    Os X produtos mais vendidos dos últimos 90 dias. Só eles têm mínimo e pedem
                    reposição — e X é o tamanho de cada página da lista do Estoque.
                  </span>
                  <span>Vale para toda a equipe. De 1 a 50.</span>
                </span>
              </Dica>
            </span>
            {topXTexto !== null && topXValido && topXDigitado !== topX && (
              <Botao type="submit" variante="secundaria" carregando={salvarTopX.isPending}>
                Salvar
              </Botao>
            )}
          </form>

          <form
            className="flex items-end gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              if (corteValido && corteDigitado !== corteAtual) salvarCorte.mutate()
            }}
          >
            <div className="w-44">
              <Campo
                rotulo="Corte: acima de quantas unidades"
                type="number"
                inputMode="numeric"
                min={1}
                max={100000}
                step={1}
                value={textoCorte ?? String(corteAtual)}
                erro={corteValido ? undefined : 'De 1 a 100000'}
                onChange={(e) => setTextoCorte(e.target.value)}
              />
            </div>
            <span className="mb-2 inline-flex">
              <Dica rotulo="O que o corte faz">
                <span className="flex flex-col gap-2">
                  <span>
                    Linha de pedido com MAIS unidades que o corte sai da conta de vendas — do
                    ranking do Top X e da sugestão de mínimo — como se o pedido não existisse.
                  </span>
                  <span>
                    É para o pedido raro e gigante (ex.: 23 closets de uma vez) não inflar o mínimo
                    de um produto que normalmente vende pouco.
                  </span>
                </span>
              </Dica>
            </span>
            {textoCorte !== null && corteValido && corteDigitado !== corteAtual && (
              <Botao type="submit" variante="secundaria" carregando={salvarCorte.isPending}>
                Salvar
              </Botao>
            )}
          </form>
        </div>
      </section>

      <CartaoTiny />
    </div>
  )
}

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col rounded-dm bg-superficie-sutil px-3 py-2">
      <span className="text-xs text-texto-suave">{rotulo}</span>
      <span className="text-lg font-semibold text-texto tabular-nums">{valor}</span>
    </div>
  )
}

/**
 * Estoque × Tiny (D-76…D-80; rodada do dono 30/09: mudou das Configurações do
 * Estoque para o Painel admin): a chave (só o admin liga e desliga) e a
 * situação — fila, erros, últimos ajustes e as reservas presas. Recolhível.
 */
function CartaoTiny() {
  const { perfil } = useSessao()
  const souAdmin = perfil?.papel === 'admin'
  const agora = useAgora()
  const [aberto, setAberto] = useState(true)
  const [confirmando, setConfirmando] = useState<'ligar' | 'desligar' | null>(null)
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const { data: situacao, isPending } = useQuery({
    queryKey: ['estoque', 'tiny'],
    queryFn: situacaoTiny,
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
        <button
          type="button"
          aria-expanded={aberto}
          aria-label={aberto ? 'Recolher o quadro do Tiny' : 'Abrir o quadro do Tiny'}
          onClick={() => setAberto((v) => !v)}
          className="flex size-11 shrink-0 items-center justify-center self-start sm:self-center"
        >
          {aberto ? (
            <ChevronUp aria-hidden className="size-5 text-texto-suave" />
          ) : (
            <ChevronDown aria-hidden className="size-5 text-texto-suave" />
          )}
        </button>
      </div>

      {aberto && (
      // Enquanto carrega, "…" — zero seria um número falso.
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
      )}

      {aberto && situacao && situacao.parados.length > 0 && (
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

      {aberto && situacao && situacao.ultimos_ajustes.length > 0 && (
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

      {aberto && <ReservasPresasTiny ativo agora={agora} />}

      {aberto &&
        souAdmin &&
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
