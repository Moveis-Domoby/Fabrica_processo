import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, CirclePause, Package, Scissors } from 'lucide-react'
import { Botao, Campo, Dica, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import {
  configEstoque,
  definirCorte,
  desligarReposicao,
  ligarReposicao,
  situacaoReposicao,
} from '@/logistica/api'

/**
 * Painel admin → Estoque (Ajuste Estoque 2 — D-87): o liga/desliga da
 * REPOSIÇÃO AUTOMÁTICA (o botão agenda/desagenda a rotina de verdade —
 * desligada, nada roda e nenhuma consulta acontece) e o CORTE de pedido fora
 * do comum (linha com mais unidades que isso sai da conta de vendas — do
 * ranking do Top X e da sugestão de mínimo). Só admin.
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
          A automação da reposição e o corte de pedido fora do comum. O Top X e a cobertura ficam
          na própria tela do Estoque, com a logística.
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
        aria-label="Corte de pedido fora do comum"
        className="flex flex-col gap-4 rounded-dm-lg border border-borda bg-superficie p-4"
      >
        <div className="relative flex items-center gap-2">
          <Scissors aria-hidden className="size-5 shrink-0 text-texto-suave" />
          <h2 className="text-lg font-semibold text-texto">Pedido fora do comum</h2>
          <Dica rotulo="O que o corte faz">
            <span className="flex flex-col gap-2">
              <span>
                Linha de pedido com MAIS unidades que o corte sai da conta de vendas — do ranking
                do Top X e da sugestão de mínimo — como se o pedido não existisse.
              </span>
              <span>
                É para o pedido raro e gigante (ex.: 23 closets de uma vez) não inflar o mínimo de
                um produto que normalmente vende pouco.
              </span>
            </span>
          </Dica>
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (corteValido && corteDigitado !== corteAtual) salvarCorte.mutate()
          }}
        >
          <div className="w-44">
            <Campo
              rotulo="Acima de quantas unidades"
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
          {textoCorte !== null && corteValido && corteDigitado !== corteAtual && (
            <Botao type="submit" variante="secundaria" carregando={salvarCorte.isPending}>
              Salvar
            </Botao>
          )}
        </form>
      </section>
    </div>
  )
}
