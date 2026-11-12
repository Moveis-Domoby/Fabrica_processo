import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Ban,
  CircleCheck,
  EyeOff,
  Factory,
  FileX,
  PackageCheck,
  RotateCcw,
  SearchX,
} from 'lucide-react'
import { Botao, Modal, useNotificacao } from '@/componentes/ui'
import { lerAvisoPcp, resolverAvisoPcp } from '../api'
import type { AvisoPcpJanela, PecaCanceladaDoPedido } from '../api'
import { diaEHoraCurto, nomeDoLugar, textoDoSelo } from '../avisoPcp'
import { LACO_PECAS_24H } from '../pcpSaida'

/**
 * A janela "O que aconteceu?" (SESSAO-48 · frente 2 — resposta 3 do dono): a
 * peça de um pedido vivo foi para CANCELADO ou NÃO ENCONTRADO na produção, a
 * vaga voltou ao PCP com o aviso, e o PCP decide aqui. Lê tudo numa requisição
 * ao abrir e esquece ao fechar (D-89): as peças que saíram (de qual coluna,
 * quem e quando), o que o pedido ainda tem em produção ou pronto e as vagas.
 *
 * ↩️ SESSAO-50 (bloco B · frente 4): as saídas passam a ser **"Produzir de
 * novo"** (o aviso fecha; o pedido segue em "Aguardando liberação"),
 * **"Cancelar pedido"** (cancela também no Tiny) e **"Ocultar do PCP"** (o Tiny
 * não muda) — o "Remover do PCP" com três motivos deixou de existir. Os dois
 * últimos abrem o modal próprio deles (a página troca esta janela por ele).
 * Frente 5: com 3 ou mais peças canceladas em 24 h, o aviso do laço.
 */
export function ModalPecaCancelada({
  cardId,
  aoFechar,
  aoCancelar,
  aoOcultar,
}: {
  /** O card do PEDIDO (o do aviso); nulo = fechada. */
  cardId: number | null
  aoFechar: () => void
  /** Abre "Cancelar pedido" para este pedido (a página fecha esta janela). */
  aoCancelar: (numero: number | null) => void
  /** Abre "Ocultar do PCP" para este pedido (a página fecha esta janela). */
  aoOcultar: (numero: number | null) => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const { data, isPending, error } = useQuery({
    // debaixo de ['cards']: o aviso do PCP ao vivo relê a janela aberta
    queryKey: ['cards', 'pcp-aviso', cardId],
    queryFn: () => lerAvisoPcp(cardId!),
    enabled: cardId !== null,
    // D-89: busca ao abrir e esquece ao fechar.
    gcTime: 0,
    staleTime: 0,
  })

  async function releer() {
    await Promise.all(
      [['cards'], ['pedidos-lista'], ['pedido-ficha']].map((queryKey) =>
        clienteQuery.invalidateQueries({ queryKey }),
      ),
    )
  }

  const produzir = useMutation({
    mutationFn: () => resolverAvisoPcp(cardId!),
    onSuccess: async (r) => {
      notificar(
        r.feito
          ? {
              titulo: `Pedido ${r.numero}: vai produzir de novo`,
              descricao:
                'O aviso saiu. O pedido segue em "Aguardando liberação" — libere as unidades pela janela "Liberar unidades".',
              tom: 'perfeito',
            }
          : { titulo: 'O aviso deste pedido já tinha sido resolvido', tom: 'perfeito' },
      )
      aoFechar()
      await releer()
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para resolver o aviso',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })

  const saiu =
    data !== undefined &&
    (data.removido !== null ||
      data.cancelado_no_tiny ||
      (data.cancelado_plataforma_em ?? null) !== null ||
      data.excluido_no_tiny === true)
  const laco = (data?.canceladas_24h ?? 0) >= LACO_PECAS_24H

  return (
    <Modal
      aberto={cardId !== null}
      aoFechar={(v) => !v && aoFechar()}
      tamanho="galpao"
      titulo="O que aconteceu?"
      descricao={
        data ? `Pedido ${data.numero}${data.cliente ? ` · ${data.cliente}` : ''}` : undefined
      }
    >
      {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {error && (
        <p className="text-sm text-danificado-forte" role="alert">
          {error instanceof Error ? error.message : 'Não deu para abrir o aviso.'}
        </p>
      )}

      {data && (
        <div className="flex flex-col gap-4">
          <EstadoDoAviso dados={data} />
          {laco && !saiu && (
            <p
              className="flex items-start gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo p-3 text-sm text-atencao-texto"
              role="status"
            >
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                <strong>As peças deste pedido estão sendo canceladas várias vezes.</strong> Se ele não
                vai ser produzido, cancele ou oculte o pedido.
              </span>
            </p>
          )}
          <PecasQueSairam dados={data} />
          <OQueOPedidoAindaTem dados={data} />

          {!saiu && (
            <div className="flex flex-col gap-3 border-t border-borda pt-4">
              <ul className="flex flex-col gap-1 text-xs text-texto-suave">
                {data.aviso && (
                  <li>
                    <strong className="text-texto">Produzir de novo:</strong> o aviso sai e o pedido
                    segue em "Aguardando liberação" — libere as unidades pela janela de sempre.
                  </li>
                )}
                <li>
                  <strong className="text-texto">Cancelar pedido:</strong> cancela também no Tiny e o
                  pedido sai do PCP; as peças em produção esperam a logística decidir o destino.
                </li>
                <li>
                  <strong className="text-texto">Ocultar do PCP:</strong> o pedido sai do PCP sem mudar
                  o Tiny e fica em "Pedidos ocultos" por {data.ocultos_dias ?? 30} dias — dá para
                  recuperar.
                </li>
              </ul>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <Botao
                  variante="secundaria"
                  icone={<EyeOff />}
                  disabled={produzir.isPending}
                  onClick={() => aoOcultar(data.numero)}
                >
                  Ocultar do PCP
                </Botao>
                <Botao
                  variante="secundaria"
                  icone={<Ban />}
                  disabled={produzir.isPending}
                  onClick={() => aoCancelar(data.numero)}
                >
                  Cancelar pedido
                </Botao>
                {data.aviso && (
                  <Botao
                    icone={<RotateCcw />}
                    carregando={produzir.isPending}
                    onClick={() => produzir.mutate()}
                  >
                    Produzir de novo
                  </Botao>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

/** O estado no topo: aberto (o selo), já resolvido, ou o pedido que já saiu do PCP (oculto, cancelado, excluído). */
function EstadoDoAviso({ dados }: { dados: AvisoPcpJanela }) {
  if (dados.excluido_no_tiny) {
    return (
      <p className="flex items-start gap-2 rounded-dm border border-borda bg-superficie-sutil p-3 text-sm text-texto">
        <FileX aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Este pedido não existe mais no Tiny (foi excluído) — ele saiu do PCP e está na aba
          "Cancelados".
        </span>
      </p>
    )
  }
  if (dados.cancelado_plataforma_em || dados.cancelado_no_tiny) {
    return (
      <p className="flex items-start gap-2 rounded-dm border border-borda bg-superficie-sutil p-3 text-sm text-texto">
        <Ban aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          {dados.cancelado_plataforma_em
            ? `Cancelado pela plataforma em ${diaEHoraCurto(dados.cancelado_plataforma_em)}`
            : 'Cancelado no Tiny'}{' '}
          — ele saiu do PCP e está na aba "Cancelados".
        </span>
      </p>
    )
  }
  if (dados.removido) {
    return (
      <p className="flex items-start gap-2 rounded-dm border border-borda bg-superficie-sutil p-3 text-sm text-texto">
        <EyeOff aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Ocultado do PCP{dados.removido.por ? ` por ${dados.removido.por}` : ''} em{' '}
          {diaEHoraCurto(dados.removido.em)}
          {dados.removido.texto ? ` — ${dados.removido.texto}` : ''}. Para trazê-lo de volta, use a
          aba "Pedidos ocultos".
        </span>
      </p>
    )
  }
  if (dados.aviso) {
    const Icone = dados.aviso.motivo === 'nao_encontrada' ? SearchX : Ban
    return (
      <p className="flex items-start gap-2 rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto">
        <Icone aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong>{textoDoSelo({ ...dados.aviso, laco: false })}</strong> — desde{' '}
          {diaEHoraCurto(dados.aviso.desde)}. A vaga voltou ao PCP.
        </span>
      </p>
    )
  }
  return (
    <p className="flex items-start gap-2 rounded-dm border border-perfeito-borda bg-perfeito-fundo p-3 text-sm text-perfeito-texto">
      <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>O aviso deste pedido já foi resolvido.</span>
    </p>
  )
}

/** As peças do pedido que saíram da produção (canceladas ou não encontradas). */
function PecasQueSairam({ dados }: { dados: AvisoPcpJanela }) {
  return (
    <section aria-labelledby="pcp-aviso-pecas" className="flex flex-col gap-2">
      <h3 id="pcp-aviso-pecas" className="text-sm font-medium text-texto">
        Peças que saíram da produção ({dados.canceladas_total})
      </h3>
      {dados.canceladas.length === 0 ? (
        <p className="text-sm text-texto-suave">
          Nenhuma peça deste pedido está cancelada agora — quem a cancelou já a arrastou de volta.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {dados.canceladas.map((p) => (
            <LinhaPecaCancelada key={p.card_id} peca={p} comAviso={dados.aviso !== null} />
          ))}
        </ul>
      )}
      {dados.canceladas_total > dados.canceladas.length && (
        <p className="text-xs text-texto-suave">
          Mostrando as {dados.canceladas.length} mais recentes de {dados.canceladas_total}.
        </p>
      )}
    </section>
  )
}

function LinhaPecaCancelada({
  peca: p,
  comAviso,
}: {
  peca: PecaCanceladaDoPedido
  comAviso: boolean
}) {
  const naoEncontrada = p.motivo === 'nao_encontrada'
  const Icone = naoEncontrada ? SearchX : Ban
  return (
    <li className="flex items-start gap-2 rounded-dm border border-borda bg-superficie px-3 py-2 text-sm">
      <Icone aria-hidden className="mt-0.5 size-4 shrink-0 text-danificado-forte" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="break-words text-texto">
          <span className="font-medium">
            {p.descricao ?? 'Peça'}
            {p.indice !== null && p.total !== null ? ` (${p.indice}/${p.total})` : ''}
          </span>
          {p.sku && <span className="text-texto-suave"> · SKU {p.sku}</span>}
        </span>
        <span className="text-xs text-texto-suave">
          {naoEncontrada ? 'Não encontrada' : 'Cancelada'}
          {p.etapa ? ` na coluna ${p.etapa}` : ''}
          {p.setor ? ` · ${p.setor}` : ''}
          {p.quem ? ` · por ${p.quem}` : ''} · {diaEHoraCurto(p.quando)}
          {p.arquivada ? ' · já saiu da coluna (arquivada)' : ''}
          {comAviso && !p.nova ? ' · antes deste aviso' : ''}
        </span>
      </span>
    </li>
  )
}

/** O que o pedido ainda tem em produção ou pronto, e as vagas para liberar. */
function OQueOPedidoAindaTem({ dados }: { dados: AvisoPcpJanela }) {
  const { pecas } = dados
  const naProducao = pecas.onde.filter((l) => !l.pronta)
  const prontas = pecas.onde.filter((l) => l.pronta)
  return (
    <section aria-labelledby="pcp-aviso-ainda" className="flex flex-col gap-2">
      <h3 id="pcp-aviso-ainda" className="text-sm font-medium text-texto">
        O que o pedido ainda tem
      </h3>
      <ul className="flex flex-col gap-1 rounded-dm bg-superficie-sutil/60 p-3 text-sm text-texto">
        <li className="flex items-start gap-2">
          <Factory aria-hidden className="mt-0.5 size-4 shrink-0 text-texto-suave" />
          <span>
            Em produção: <strong className="tabular-nums">{pecas.em_producao}</strong>
            {naProducao.length > 0 && (
              <span className="text-texto-suave">
                {' '}
                —{' '}
                {naProducao
                  .map(
                    (l) =>
                      `${l.pecas} em ${nomeDoLugar(l)}${l.etapa && l.setor ? ` (${l.setor})` : ''}`,
                  )
                  .join(' · ')}
              </span>
            )}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <PackageCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-texto-suave" />
          <span>
            Prontas: <strong className="tabular-nums">{pecas.prontas}</strong>
            {prontas.length > 0 && (
              <span className="text-texto-suave">
                {' '}
                — {prontas.map((l) => `${l.pecas} em ${nomeDoLugar(l)}`).join(' · ')}
              </span>
            )}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <RotateCcw aria-hidden className="mt-0.5 size-4 shrink-0 text-texto-suave" />
          <span>
            Vagas para liberar no PCP:{' '}
            <strong className="tabular-nums">
              {dados.vagas_abertas} de {dados.vagas}
            </strong>
          </span>
        </li>
      </ul>
    </section>
  )
}
