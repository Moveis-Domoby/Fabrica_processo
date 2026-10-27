import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, CircleX, ListOrdered, Undo2, X } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { concluirParadaAvulsa, removerParadaAvulsa } from './api'
import type { ParadaAvulsa } from './api'
import { BotoesParada } from './BotoesNavegacao'
import { NumeroParadaAvulsa, SeloSituacaoParada } from './CartaoParadaAvulsa'
import { CHAVES_PARADA_AVULSA, lugarDaAvulsa } from './paradasAvulsas'

function horaCurta(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : ''
}

function useInvalidarParadas() {
  const clienteQuery = useQueryClient()
  return () =>
    Promise.all(
      CHAVES_PARADA_AVULSA.map((queryKey) => clienteQuery.invalidateQueries({ queryKey })),
    )
}

/**
 * SESSAO-41 (D-196): a PARADA AVULSA no meio das entregas do dia (celular
 * primeiro, botões grandes — D-06): o título, o endereço, a observação e quem
 * pôs; Google Maps / Waze até ela; "Feita" e "Não feita" (motivo opcional) e,
 * já marcada, "Desfazer". Quem pôs (ainda pendente) muda o momento dela e a
 * tira da rota; a logística também tira.
 */
export function CartaoParadaDoDia({
  parada,
  posicao,
  souLogistica,
  aoMudarMomento,
}: {
  parada: ParadaAvulsa
  posicao: number
  souLogistica: boolean
  aoMudarMomento: () => void
}) {
  const notificar = useNotificacao()
  const invalidar = useInvalidarParadas()
  const [naoFeita, setNaoFeita] = useState(false)
  const pendente = parada.situacao === 'pendente'
  const minhaPendente = parada.sou_autor && pendente

  const concluir = useMutation({
    mutationFn: (v: { feita: boolean | null; motivo?: string }) =>
      concluirParadaAvulsa(parada.id, v.feita, v.motivo),
    onSuccess: async (_d, v) => {
      notificar({
        titulo:
          v.feita === null
            ? `"${parada.titulo}" voltou para fazer`
            : v.feita
              ? `"${parada.titulo}": feita`
              : `"${parada.titulo}": não feita`,
        tom: 'perfeito',
      })
      setNaoFeita(false)
      await invalidar()
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para marcar a parada',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })
  const remover = useMutation({
    mutationFn: () => removerParadaAvulsa(parada.id),
    onSuccess: async () => {
      notificar({ titulo: `A parada "${parada.titulo}" saiu da rota`, tom: 'perfeito' })
      await invalidar()
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para tirar a parada',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-dm-lg border-2 border-dashed bg-superficie p-4',
        parada.situacao === 'feita'
          ? 'border-perfeito-borda'
          : parada.situacao === 'nao_feita'
            ? 'border-atencao-borda'
            : 'border-borda-forte',
      )}
    >
      <div className="flex items-start gap-3">
        <NumeroParadaAvulsa numero={posicao} apagado={!pendente} grande />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-xs font-semibold tracking-wide text-texto-suave uppercase">
            Parada avulsa
          </p>
          <p className="text-lg font-semibold text-texto">{parada.titulo}</p>
          {parada.criada_por && (
            <p className="text-sm text-texto-suave">Posta por {parada.criada_por}</p>
          )}
        </div>
        {!pendente && (
          <span className="flex shrink-0 flex-col items-end gap-1">
            <SeloSituacaoParada situacao={parada.situacao} />
            {parada.concluida_em && (
              <span className="text-xs text-texto-suave tabular-nums">
                {horaCurta(parada.concluida_em)}
              </span>
            )}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <p className="text-texto">{parada.endereco}</p>
        {parada.observacao && <p className="text-texto-suave">OBS: {parada.observacao}</p>}
        {parada.situacao === 'nao_feita' && parada.nao_feita_motivo && (
          <p className="rounded-dm border border-atencao-borda bg-atencao-fundo px-2 py-1 text-atencao-texto">
            Motivo: {parada.nao_feita_motivo}
          </p>
        )}
      </div>

      {pendente && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <BotoesParada parada={lugarDaAvulsa(parada)} />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Botao
              tamanho="lg"
              icone={<CircleCheck />}
              carregando={concluir.isPending && concluir.variables?.feita === true}
              disabled={concluir.isPending}
              onClick={() => concluir.mutate({ feita: true })}
            >
              Feita
            </Botao>
            <Botao
              tamanho="lg"
              variante="secundaria"
              icone={<CircleX />}
              disabled={concluir.isPending}
              onClick={() => setNaoFeita(true)}
            >
              Não feita
            </Botao>
          </div>
        </>
      )}

      {(minhaPendente || souLogistica || !pendente) && (
        <div className="flex flex-wrap gap-2">
          {!pendente && (
            <Botao
              variante="fantasma"
              icone={<Undo2 />}
              carregando={concluir.isPending && concluir.variables?.feita === null}
              onClick={() => concluir.mutate({ feita: null })}
            >
              Desfazer
            </Botao>
          )}
          {minhaPendente && (
            <Botao variante="secundaria" icone={<ListOrdered />} onClick={aoMudarMomento}>
              Mudar o momento
            </Botao>
          )}
          {(minhaPendente || souLogistica) && (
            <Botao
              variante="fantasma"
              icone={<X />}
              carregando={remover.isPending}
              onClick={() => remover.mutate()}
            >
              Tirar da rota
            </Botao>
          )}
        </div>
      )}

      <ModalNaoFeita
        key={naoFeita ? 'nao-feita-aberta' : 'nao-feita-fechada'}
        aberto={naoFeita}
        titulo={parada.titulo}
        carregando={concluir.isPending}
        aoFechar={() => setNaoFeita(false)}
        aoConfirmar={(motivo) => concluir.mutate({ feita: false, motivo })}
      />
    </li>
  )
}

/** "Não feita": o motivo é opcional (uma linha). */
function ModalNaoFeita({
  aberto,
  titulo,
  carregando,
  aoFechar,
  aoConfirmar,
}: {
  aberto: boolean
  titulo: string
  carregando: boolean
  aoFechar: () => void
  aoConfirmar: (motivo: string) => void
}) {
  const [motivo, setMotivo] = useState('')
  return (
    <Modal
      aberto={aberto}
      aoFechar={(v) => !v && aoFechar()}
      titulo="Parada não feita"
      descricao={titulo}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          aoConfirmar(motivo)
        }}
      >
        <Campo
          rotulo="Motivo (opcional)"
          placeholder="Ex.: o fornecedor estava fechado"
          maxLength={200}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          autoFocus
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Botao type="submit" tamanho="lg" icone={<CircleX />} carregando={carregando}>
            Marcar não feita
          </Botao>
          <Botao type="button" tamanho="lg" variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
        </div>
      </form>
    </Modal>
  )
}
