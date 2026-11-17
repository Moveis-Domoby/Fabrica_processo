import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Factory, Info, RotateCcw, TriangleAlert, Undo2, XCircle } from 'lucide-react'
import { Botao, Modal, useNotificacao } from '@/componentes/ui'
import { produtosPorExtenso } from '../pcpSaida'
import {
  nomeComIndice,
  previaEntregaParcial,
  revogarEntregaParcial,
  textoBotaoRevogar,
  textoDecisao,
} from '../entregaParcial'

/** O que o pedido revogado precisa reler (PCP, Pedidos, a ficha, a lista). */
const CHAVES = [['cards'], ['pedidos-lista'], ['pedido-ficha'], ['entregas-parciais'], ['programacao']]

function onde(setor: string | null | undefined, etapa: string | null | undefined): string {
  return [setor, etapa].filter(Boolean).join(' · ') || 'a fábrica'
}

/**
 * SESSAO-51 (frente 3): a janela do revogar — o botão contrário à decisão que
 * vale. Lê ao abrir (uma requisição) o que sai ou o que volta, e onde; o toque
 * leva a chave do gesto (repetir não faz nada — Lei §10).
 */
export function ModalRevogarParcial({
  cardId,
  aoFechar,
}: {
  /** O card do pedido; nulo = fechada. */
  cardId: number | null
  aoFechar: () => void
}) {
  return (
    <Modal
      aberto={cardId !== null}
      aoFechar={(v) => !v && aoFechar()}
      tamanho="md"
      titulo="Revogar a decisão da entrega parcial"
    >
      {cardId !== null && <Conteudo key={cardId} cardId={cardId} aoFechar={aoFechar} />}
    </Modal>
  )
}

function Conteudo({ cardId, aoFechar }: { cardId: number; aoFechar: () => void }) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  // a chave do toque nasce com a janela: o mesmo toque repetido é um efeito só
  const [chave] = useState(() => `revogar-${cardId}-${crypto.randomUUID()}`)
  const previa = useQuery({
    queryKey: ['entrega-parcial-previa', cardId],
    queryFn: () => previaEntregaParcial(cardId),
    staleTime: 0,
    gcTime: 0,
  })
  const revogar = useMutation({
    mutationFn: () => revogarEntregaParcial(cardId, chave),
    onSuccess: async (r) => {
      const e = previa.data
      notificar({
        titulo: r.repetido
          ? 'Esta decisão já tinha sido revogada'
          : r.decisao === 'limpar'
            ? `Pedido ${e?.numero ?? ''}: tirado da produção`
            : `Pedido ${e?.numero ?? ''}: de volta para a produção`,
        descricao: r.repetido
          ? undefined
          : r.decisao === 'limpar'
            ? [
                (r.retiradas ?? 0) === 1 ? '1 peça saiu dos quadros.' : '',
                (r.retiradas ?? 0) > 1 ? `${r.retiradas} peças saíram dos quadros.` : '',
                (r.vagas ?? 0) === 1 ? '1 produto saiu do PCP.' : '',
                (r.vagas ?? 0) > 1 ? `${r.vagas} produtos saíram do PCP.` : '',
                (r.ficaram ?? 0) === 1 ? '1 peça já pronta ficou.' : '',
                (r.ficaram ?? 0) > 1 ? `${r.ficaram} peças já prontas ficaram.` : '',
              ]
                .filter(Boolean)
                .join(' ')
            : [
                (r.voltaram ?? 0) === 1 ? '1 peça voltou para a etapa onde estava.' : '',
                (r.voltaram ?? 0) > 1 ? `${r.voltaram} peças voltaram para a etapa onde estavam.` : '',
                (r.vagas ?? 0) + (r.viraram_vaga ?? 0) > 0
                  ? `${produtosPorExtenso((r.vagas ?? 0) + (r.viraram_vaga ?? 0))} de volta ao PCP para liberar.`
                  : '',
              ]
                .filter(Boolean)
                .join(' '),
        tom: 'perfeito',
      })
      aoFechar()
      await Promise.all(CHAVES.map((queryKey) => clienteQuery.invalidateQueries({ queryKey })))
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para revogar',
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
  const e = previa.data
  const naProducao = e.na_producao ?? []
  const prontas = e.prontas ?? []
  const retiradas = e.retiradas ?? []

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-texto">
        <span className="font-semibold">Pedido {e.numero}</span>
        {e.cliente ? ` · ${e.cliente}` : ''}
        <br />
        <span className="text-texto-suave">
          {textoDecisao(e)}
          {e.decisao_por ? ` — decidido por ${e.decisao_por}` : ''}
        </span>
      </p>

      {!e.pode_revogar && (
        <p className="flex items-start gap-2 rounded-dm border border-borda bg-superficie-sutil p-3 text-sm text-texto">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          Não dá para revogar: {e.porque_nao}
        </p>
      )}

      {e.pode_revogar && e.acao === 'remover' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-texto">
            Tirar da produção{' '}
            {naProducao.length > 0 ? (
              <>
                {naProducao.length === 1 ? 'a peça' : `as ${naProducao.length} peças`} (
                {naProducao.map((p) => onde(p.setor, p.etapa)).join(', ')})
              </>
            ) : null}
            {naProducao.length > 0 && e.vagas > 0 ? ' e ' : ''}
            {e.vagas > 0 ? (e.vagas === 1 ? 'o produto ainda no PCP' : `os ${e.vagas} produtos ainda no PCP`) : ''} do
            pedido {e.numero}?
          </p>
          {naProducao.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {naProducao.map((p) => (
                <li key={p.id} className="flex items-start gap-2 text-texto">
                  <Factory aria-hidden className="mt-0.5 size-4 shrink-0 text-texto-suave" />
                  <span className="min-w-0 break-words">
                    {nomeComIndice(p)} <span className="text-texto-suave">— {onde(p.setor, p.etapa)}</span>
                    {p.trabalhando && <span className="text-atencao-texto"> · alguém trabalha nela: o tempo fecha agora</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {prontas.length > 0 && (
            <p className="rounded-dm border border-borda bg-superficie-sutil p-3 text-sm text-texto-suave">
              {prontas.length === 1 ? '1 peça já está pronta e fica' : `${prontas.length} peças já estão prontas e ficam`}{' '}
              ({prontas.map((p) => (p.na_rota ? `${p.onde} — na rota` : p.onde)).join(', ')}): o pedido segue para
              ser entregue com {prontas.length === 1 ? 'ela' : 'elas'}.
            </p>
          )}
          <p className="text-xs text-texto-suave">Nada é apagado: dá para voltar atrás de novo aqui mesmo.</p>
        </div>
      )}

      {e.pode_revogar && e.acao === 'voltar' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-texto">
            Voltar tudo para a produção, cada peça na etapa onde estava? Ninguém volta a trabalhar nela sozinho —
            quem for trabalhar aperta "Iniciar".
          </p>
          {retiradas.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {retiradas.map((p) => (
                <li key={p.id} className="flex flex-col gap-0.5 text-texto">
                  <span className="flex items-start gap-2">
                    <ArrowRight aria-hidden className="mt-0.5 size-4 shrink-0 text-texto-suave" />
                    <span className="min-w-0 break-words">
                      {nomeComIndice(p)} →{' '}
                      {p.vira_vaga ? 'vira vaga no PCP' : `volta para ${onde(p.destino_setor, p.destino_etapa)}`}
                    </span>
                  </span>
                  {p.mudou_etapa && !p.vira_vaga && (
                    <span className="ml-6 flex items-start gap-1 text-xs text-atencao-texto">
                      <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />A etapa {p.etapa} não existe mais —
                      a peça volta para a primeira etapa ativa do setor.
                    </span>
                  )}
                  {p.vira_vaga && (
                    <span className="ml-6 flex items-start gap-1 text-xs text-atencao-texto">
                      <XCircle aria-hidden className="mt-px size-3.5 shrink-0" />O setor {p.setor} não existe mais — a
                      vaga dela volta ao PCP para liberar.
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {e.vagas > 0 && (
            <p className="text-sm text-texto-suave">
              {e.vagas === 1
                ? 'O produto que saiu do PCP volta para "Aguardando liberação".'
                : `Os ${e.vagas} produtos que saíram do PCP voltam para "Aguardando liberação".`}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Botao variante="secundaria" icone={<Undo2 />} disabled={revogar.isPending} onClick={aoFechar}>
          {e.pode_revogar ? 'Voltar' : 'Fechar'}
        </Botao>
        {e.pode_revogar && e.acao && (
          <Botao icone={<RotateCcw />} carregando={revogar.isPending} onClick={() => revogar.mutate()}>
            {textoBotaoRevogar(e.acao)}
          </Botao>
        )}
      </div>
    </div>
  )
}
