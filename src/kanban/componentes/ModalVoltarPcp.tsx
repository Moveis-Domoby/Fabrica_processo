import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, Info, PackageOpen, TriangleAlert, Undo2 } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { previaVoltarPcp, voltarParaPcp } from '../voltaPcp'
import type { EscolhaVolta, OpcaoVolta } from '../voltaPcp'

/** O que a volta ao PCP muda (os quadros, o PCP, a janela do card, a busca). */
const CHAVES = [['quadro'], ['cards'], ['card-janela'], ['busca-geral'], ['pedidos-lista'], ['pedido-ficha']]

/**
 * SESSAO-51 (bloco B · frentes 4 e 5): "Mover para o PCP". O administrador tira a
 * peça da produção (o tempo de quem trabalha nela fecha) e escolhe: "Voltar
 * para o PCP" (a vaga do pedido reabre — motivo da lista e/ou observação) ou
 * "Virar reposição de estoque" (a peça deixa o pedido, a vaga dele reabre e
 * nasce 1 reposição). A janela lê ao abrir; o toque leva a chave.
 */
export function ModalVoltarPcp({ cardId, aoFechar }: { cardId: number | null; aoFechar: () => void }) {
  return (
    <Modal aberto={cardId !== null} aoFechar={(v) => !v && aoFechar()} tamanho="md" titulo="Mover para o PCP">
      {cardId !== null && <Conteudo key={cardId} cardId={cardId} aoFechar={aoFechar} />}
    </Modal>
  )
}

function Conteudo({ cardId, aoFechar }: { cardId: number; aoFechar: () => void }) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [chave] = useState(() => `volta-pcp-${cardId}-${crypto.randomUUID()}`)
  const [escolhaFeita, setEscolha] = useState<EscolhaVolta | null>(null)
  const [motivoId, setMotivoId] = useState<number | null>(null)
  const [observacao, setObservacao] = useState('')

  const previa = useQuery({
    queryKey: ['voltar-pcp-previa', cardId],
    queryFn: () => previaVoltarPcp(cardId),
    staleTime: 0,
    gcTime: 0,
  })
  const p = previa.data
  // a escolha que vale de início: a única possível (peça sem pedido só volta; pedido
  // fora do PCP só vira reposição) — com as duas, ninguém escolhe pela pessoa
  const escolha: EscolhaVolta | null =
    escolhaFeita ?? (p?.voltar.pode && !p.reposicao.pode ? 'voltar' : p?.reposicao.pode && !p.voltar.pode ? 'reposicao' : null)
  const temPorque = motivoId !== null || observacao.trim() !== ''
  const pode = !!p?.pode && escolha !== null && (escolha === 'reposicao' || temPorque)

  const mover = useMutation({
    mutationFn: () => voltarParaPcp({ cardId, escolha: escolha!, motivoId, observacao, chave }),
    onSuccess: async (r) => {
      notificar({
        titulo: r.repetido
          ? 'Esta peça já tinha voltado ao PCP'
          : r.escolha === 'reposicao'
            ? 'A peça virou reposição de estoque'
            : 'A peça voltou ao PCP',
        descricao: r.repetido
          ? undefined
          : r.escolha === 'reposicao'
            ? `Ela está no Reabastecimento do PCP${r.numero ? `; a vaga do pedido ${r.numero} reabriu` : ''}.`
            : `A vaga ${r.numero ? `do pedido ${r.numero} ` : ''}reabriu no PCP para liberar.`,
        tom: 'perfeito',
      })
      aoFechar()
      await Promise.all(CHAVES.map((queryKey) => clienteQuery.invalidateQueries({ queryKey })))
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para mover para o PCP',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })

  if (previa.isPending) return <p className="text-sm text-texto-fraco">Carregando…</p>
  if (previa.isError)
    return (
      <p role="alert" className="text-sm text-danificado-forte">
        {previa.error instanceof Error ? previa.error.message : 'Não deu para carregar.'}
      </p>
    )
  if (!p) return null
  const nome = `${p.descricao ?? 'Peça'}${p.total && p.total > 1 ? ` ${p.indice}/${p.total}` : ''}`
  const onde = [p.setor, p.etapa].filter(Boolean).join(' · ')

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (pode) mover.mutate()
      }}
    >
      <p className="text-sm text-texto">
        <span className="font-semibold">{nome}</span>
        {p.numero ? ` (pedido ${p.numero})` : ''}
        {onde ? ` · ${onde}` : ''}.
      </p>
      {p.executor && (
        <p className="flex items-start gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo p-3 text-sm text-atencao-texto">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {p.executor} está trabalhando nela — o tempo dele fecha agora.
        </p>
      )}
      {!p.pode && (
        <p className="flex items-start gap-2 rounded-dm border border-borda bg-superficie-sutil p-3 text-sm text-texto">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {p.porque_nao}
        </p>
      )}

      {p.pode && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-texto">O que acontece com ela?</legend>
          <Escolha
            valor="voltar"
            escolhida={escolha === 'voltar'}
            aoEscolher={() => setEscolha('voltar')}
            opcao={p.voltar}
            icone={<PackageOpen aria-hidden className="size-5 shrink-0" />}
            titulo="Voltar para o PCP"
            texto={
              p.numero
                ? `A peça sai do quadro e a vaga dela reabre no pedido ${p.numero}, em "Aguardando liberação".`
                : 'A peça sai do quadro e a vaga dela reabre na reposição de estoque de origem.'
            }
          />
          <Escolha
            valor="reposicao"
            escolhida={escolha === 'reposicao'}
            aoEscolher={() => setEscolha('reposicao')}
            opcao={p.reposicao}
            icone={<Boxes aria-hidden className="size-5 shrink-0" />}
            titulo="Virar reposição de estoque"
            texto={`A peça deixa o pedido e vai para o Reabastecimento do PCP. O pedido ${p.numero ?? ''} continua precisando deste móvel: a vaga dele reabre no PCP.`}
          />
        </fieldset>
      )}

      {p.pode && escolha !== null && (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-texto">
              Motivo{escolha === 'reposicao' ? ' (opcional)' : ''}
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {p.motivos.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={motivoId === m.id}
                  onClick={() => setMotivoId(motivoId === m.id ? null : m.id)}
                  className={cn(
                    'min-h-12 rounded-dm border px-3 py-2 text-left text-sm transition-colors',
                    motivoId === m.id
                      ? 'border-acao-ativa bg-acao/15 font-medium text-texto'
                      : 'border-borda bg-superficie text-texto hover:bg-superficie-sutil',
                  )}
                >
                  {m.texto}
                </button>
              ))}
            </div>
          </fieldset>
          <Campo
            rotulo="Observação"
            ajuda={escolha === 'voltar' ? 'Escolha um motivo ou escreva aqui — pelo menos um dos dois.' : undefined}
            placeholder="Ex.: o cliente mudou a cor"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Botao type="button" variante="secundaria" icone={<Undo2 />} disabled={mover.isPending} onClick={aoFechar}>
          {p.pode ? 'Voltar' : 'Fechar'}
        </Botao>
        {p.pode && (
          <Botao type="submit" icone={<PackageOpen />} disabled={!pode} carregando={mover.isPending}>
            {escolha === 'reposicao' ? 'Virar reposição de estoque' : 'Mover para o PCP'}
          </Botao>
        )}
      </div>
    </form>
  )
}

function Escolha({
  valor,
  escolhida,
  aoEscolher,
  opcao,
  icone,
  titulo,
  texto,
}: {
  valor: string
  escolhida: boolean
  aoEscolher: () => void
  opcao: OpcaoVolta
  icone: React.ReactNode
  titulo: string
  texto: string
}) {
  return (
    <label
      className={cn(
        'flex min-h-12 items-start gap-3 rounded-dm border p-3 text-sm transition-colors',
        !opcao.pode
          ? 'cursor-not-allowed border-borda bg-superficie-sutil opacity-80'
          : escolhida
            ? 'cursor-pointer border-acao-ativa bg-acao/10'
            : 'cursor-pointer border-borda bg-superficie hover:bg-superficie-sutil',
      )}
    >
      <input
        type="radio"
        name="escolha-volta"
        value={valor}
        checked={escolhida}
        disabled={!opcao.pode}
        onChange={aoEscolher}
        className="mt-0.5 size-5 shrink-0 accent-[var(--dm-acao)]"
      />
      <span className="text-texto-suave">{icone}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-texto">{titulo}</span>
        <span className="text-texto-suave">{opcao.pode ? texto : opcao.porque_nao}</span>
      </span>
    </label>
  )
}
