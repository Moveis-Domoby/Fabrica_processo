import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Ban,
  CircleCheck,
  Factory,
  PackageCheck,
  PackageX,
  RotateCcw,
  SearchX,
  Undo2,
} from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { lerAvisoPcp, removerDoPcp, resolverAvisoPcp } from '../api'
import type { AvisoPcpJanela, MotivoRemocaoPcp, PecaCanceladaDoPedido } from '../api'
import {
  MOTIVOS_REMOCAO,
  ROTULO_MOTIVO_REMOCAO,
  diaEHoraCurto,
  erroDoTextoRemocao,
  frasesPecasQueSeguem,
  nomeDoLugar,
  pecasPorExtenso,
  textoDoSelo,
} from '../avisoPcp'

/**
 * A janela "O que aconteceu?" (SESSAO-48 · frente 2 — resposta 3 do dono): a
 * peça de um pedido vivo foi para CANCELADO ou NÃO ENCONTRADO na produção, a
 * vaga voltou ao PCP com o aviso, e o PCP decide aqui. Lê tudo numa requisição
 * ao abrir e esquece ao fechar (D-89): as peças que saíram (de qual coluna,
 * quem e quando), o que o pedido ainda tem em produção ou pronto e as vagas.
 * Duas saídas: "Produzir de novo" (o aviso fecha; o pedido segue em
 * "Aguardando liberação") e "Remover do PCP" com o motivo — o desenho da casa
 * para escolher um motivo (botões grandes; os dois últimos pedem o texto). O
 * banco confere quem pode e é idempotente; o Tiny e as peças não mudam.
 */
export function ModalPecaCancelada({
  cardId,
  aoFechar,
}: {
  /** O card do PEDIDO (o do aviso); nulo = fechada. */
  cardId: number | null
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [passo, setPasso] = useState<'ver' | 'remover'>('ver')
  const [motivo, setMotivo] = useState<MotivoRemocaoPcp | null>(null)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')

  // Recomeça a cada pedido novo (ajuste durante o render, sem efeito).
  const [anterior, setAnterior] = useState<number | null>(null)
  if (cardId !== anterior) {
    setAnterior(cardId)
    setPasso('ver')
    setMotivo(null)
    setTexto('')
    setErro('')
  }

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

  const remover = useMutation({
    mutationFn: () => removerDoPcp({ cardId: cardId!, motivo: motivo!, texto }),
    onSuccess: async (r) => {
      const seguem = r.em_producao + r.prontas
      notificar(
        r.feito
          ? {
              titulo: `Pedido ${r.numero} removido do PCP`,
              descricao:
                'Ele está na aba "Cancelados e removidos" do PCP — de lá dá para devolver.' +
                (seguem > 0
                  ? ` ${pecasPorExtenso(seguem)} que já estava${seguem === 1 ? '' : 'm'} em produção ou pronta${seguem === 1 ? '' : 's'} seguem como estão.`
                  : ''),
              tom: 'perfeito',
            }
          : { titulo: 'Este pedido já tinha sido removido do PCP', tom: 'perfeito' },
      )
      aoFechar()
      await releer()
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para remover do PCP',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })

  function confirmarRemocao() {
    if (!motivo) {
      setErro('Escolha por que o pedido sai do PCP.')
      return
    }
    const problema = erroDoTextoRemocao(motivo, texto)
    if (problema) {
      setErro(problema)
      return
    }
    setErro('')
    remover.mutate()
  }

  const opcao = MOTIVOS_REMOCAO.find((m) => m.valor === motivo)

  return (
    <Modal
      aberto={cardId !== null}
      aoFechar={(v) => !v && aoFechar()}
      tamanho="galpao"
      titulo={passo === 'remover' ? 'Remover do PCP' : 'O que aconteceu?'}
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

      {data && passo === 'ver' && (
        <div className="flex flex-col gap-4">
          <EstadoDoAviso dados={data} />
          <PecasQueSairam dados={data} />
          <OQueOPedidoAindaTem dados={data} />

          {data.removido === null && (
            <div className="flex flex-col gap-3 border-t border-borda pt-4">
              <ul className="flex flex-col gap-1 text-xs text-texto-suave">
                {data.aviso && (
                  <li>
                    <strong className="text-texto">Produzir de novo:</strong> o aviso sai e o pedido
                    segue em "Aguardando liberação" — libere as unidades pela janela de sempre.
                  </li>
                )}
                <li>
                  <strong className="text-texto">Remover do PCP:</strong> o pedido sai do PCP com o
                  motivo. O Tiny e as peças que já estão em produção ou prontas não mudam.
                </li>
              </ul>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Botao
                  variante="secundaria"
                  icone={<PackageX />}
                  disabled={produzir.isPending}
                  onClick={() => {
                    setPasso('remover')
                    setErro('')
                  }}
                >
                  Remover do PCP
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

      {data && passo === 'remover' && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            confirmarRemocao()
          }}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-texto">
              Por que o pedido sai do PCP?
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MOTIVOS_REMOCAO.map((m) => (
                <button
                  key={m.valor}
                  type="button"
                  aria-pressed={motivo === m.valor}
                  onClick={() => {
                    setMotivo(m.valor)
                    setErro('')
                  }}
                  className={cn(
                    'min-h-12 rounded-dm border px-3 py-2 text-left text-sm transition-colors',
                    motivo === m.valor
                      ? 'border-acao-ativa bg-acao/15 font-medium text-texto'
                      : 'border-borda bg-superficie text-texto hover:bg-superficie-sutil',
                  )}
                >
                  {m.rotulo}
                </button>
              ))}
            </div>
          </fieldset>

          {motivo === 'pedido_cancelado' && (
            <p className="flex items-start gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo p-3 text-sm text-atencao-texto">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                A plataforma não muda o Tiny. <strong>Cancele também no Tiny.</strong>
              </span>
            </p>
          )}

          {opcao && (
            <Campo
              rotulo={opcao.rotuloTexto}
              maxLength={300}
              value={texto}
              // a conferência é nossa (a mensagem em português) — sem o balão do navegador
              aria-required={opcao.textoObrigatorio}
              placeholder={opcao.exemplo}
              onChange={(e) => {
                setTexto(e.target.value)
                setErro('')
              }}
              erro={erro || undefined}
            />
          )}
          {!opcao && erro && (
            <p className="text-sm text-danificado-forte" role="alert">
              {erro}
            </p>
          )}

          <AvisoDasPecasQueSeguem dados={data} />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Botao
              type="button"
              variante="secundaria"
              icone={<Undo2 />}
              disabled={remover.isPending}
              onClick={() => {
                setPasso('ver')
                setErro('')
              }}
            >
              Voltar
            </Botao>
            <Botao
              type="submit"
              icone={<PackageX />}
              disabled={motivo === null}
              carregando={remover.isPending}
            >
              Remover do PCP
            </Botao>
          </div>
        </form>
      )}
    </Modal>
  )
}

/** O estado do aviso no topo: aberto (o selo), já resolvido, ou o pedido já removido. */
function EstadoDoAviso({ dados }: { dados: AvisoPcpJanela }) {
  if (dados.removido) {
    return (
      <p className="flex items-start gap-2 rounded-dm border border-borda bg-superficie-sutil p-3 text-sm text-texto">
        <PackageX aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Removido do PCP{dados.removido.por ? ` por ${dados.removido.por}` : ''} em{' '}
          {diaEHoraCurto(dados.removido.em)} — {ROTULO_MOTIVO_REMOCAO[dados.removido.motivo]}
          {dados.removido.texto ? `: ${dados.removido.texto}` : ''}. Para devolvê-lo, use a aba
          "Cancelados e removidos".
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
          <strong>{textoDoSelo(dados.aviso)}</strong> — desde {diaEHoraCurto(dados.aviso.desde)}. A
          vaga voltou ao PCP.
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
        <span className="text-texto">
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

/** "Remover do PCP" não mexe nas peças que seguem: a janela diz quantas e onde. */
function AvisoDasPecasQueSeguem({ dados }: { dados: AvisoPcpJanela }) {
  const frases = frasesPecasQueSeguem(dados.pecas)
  if (frases.length === 0) return null
  return (
    <div className="flex items-start gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo p-3 text-sm text-atencao-texto">
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-1">
        {frases.map((f) => (
          <p key={f}>{f}</p>
        ))}
      </div>
    </div>
  )
}
