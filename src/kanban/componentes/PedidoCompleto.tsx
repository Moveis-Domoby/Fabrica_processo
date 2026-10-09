import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ExternalLink, MessageCircle, Paperclip, Undo2 } from 'lucide-react'
import { Botao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { detalhePedidoPcp } from '@/kanban/api'
import type { DetalhePedido } from '@/kanban/api'
import { ROTULO_SITUACAO_PLATAFORMA } from '@/kanban/situacaoPlataforma'
import type { SituacaoPlataforma } from '@/kanban/tipos'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import { entregueHoje, linkDoAnexo, linkWhatsApp } from '@/rotas/api'
import { ModalMotivoEntrega } from '@/rotas/ModaisEntrega'

const moeda = (v: number | string | null | undefined) => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v
  return n === null || n === undefined || Number.isNaN(n)
    ? '—'
    : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
const data = (v: string | null | undefined) => {
  if (!v) return '—'
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v // já vem do Tiny em dd/mm/aaaa
  const d = new Date(v.length === 10 ? `${v}T12:00:00` : v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('pt-BR')
}
const dataHora = (v: string | null | undefined) =>
  v
    ? new Date(v).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

/** O que cada fato do pedido quer dizer, em língua do galpão. */
const FATOS: Record<string, string> = {
  card_criado: 'Pedido chegou ao PCP',
  pedido_atualizado: 'Pedido mudou no Tiny',
  pedido_cancelado: 'Pedido cancelado no Tiny',
  pedido_lancado_rotas: 'Lançado para ROTAS',
  pedido_entregue: 'Entregue',
  entrega_desfeita: 'Entrega desfeita',
  entrega_nao_realizada: 'Não entregue',
  pedido_devolvido: 'Pedido devolvido',
  comentario_adicionado: 'Comentário',
  anexo_adicionado: 'Comprovante anexado',
  card_arquivado: 'Arquivado',
  card_desarquivado: 'Trazido de volta',
  etiqueta_adicionada: 'Etiqueta colocada',
  etiqueta_removida: 'Etiqueta tirada',
  notificacao_enviada: 'Aviso enviado',
  movimentacao_setor: 'Mudou de setor',
}

const SAIDA: Record<string, string> = {
  entregue: 'saiu com a entrega',
  venda: 'saiu com a venda',
  pedido_arquivado: 'pedido arquivado',
  baixa_manual: 'baixa manual',
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-1.5">
      <h3 className="text-sm font-semibold text-texto">{titulo}</h3>
      {children}
    </section>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  if (valor === null || valor === undefined || valor === '' || valor === '—') return null
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-texto-suave">{rotulo}</span>
      <span className="text-right text-texto">{valor}</span>
    </div>
  )
}

/**
 * A janela COMPLETA do pedido no PCP (SESSAO-30 · D-120 — "moram apenas em
 * PCP com TODAS as informações daquele pedido caso eu clique nele,
 * observações, situação de pagamento e tudo mais"). Uma requisição, só no
 * clique, e esquecida ao fechar (gcTime 0).
 */
export function PedidoCompleto({ pedidoId }: { pedidoId: number }) {
  const agora = useAgora()
  const notificar = useNotificacao()
  const [desfazendo, setDesfazendo] = useState(false)
  const {
    data: d,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['pcp-pedido-completo', pedidoId],
    queryFn: () => detalhePedidoPcp(pedidoId),
    gcTime: 0,
    staleTime: 0,
  })
  const abrir = useMutation({
    mutationFn: async (caminho: string) =>
      window.open(await linkDoAnexo(caminho), '_blank', 'noopener'),
    onError: (e) =>
      notificar({
        titulo: 'Não deu para abrir',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })

  if (isPending) return <p className="text-sm text-texto-fraco">Carregando o pedido…</p>
  if (isError || !d)
    return (
      <p className="rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto">
        {error instanceof Error ? error.message : 'Não deu para abrir o pedido.'}
      </p>
    )

  const { pedido: p, cliente: c } = d
  const whatsapp = linkWhatsApp(c.fone)
  const endereco = [
    [c.endereco, c.numero].filter(Boolean).join(', '),
    c.bairro,
    [c.cidade, c.uf].filter(Boolean).join('-'),
  ]
    .filter(Boolean)
    .join(' · ')
  const podeDesfazer =
    d.entrega?.por_gente && entregueHoje(d.entrega.em) && d.plataforma.card_id !== null
  const produtos = d.itens.filter((i) => !i.eh_frete)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-borda px-2.5 py-0.5 text-xs text-texto">
          Na plataforma:{' '}
          {ROTULO_SITUACAO_PLATAFORMA[d.plataforma.situacao as SituacaoPlataforma] ??
            d.plataforma.situacao}
        </span>
        <span className="rounded-full bg-superficie-sutil px-2.5 py-0.5 text-xs text-texto">
          No Tiny: {p.situacao ?? '—'}
        </span>
        {p.marcadores.map((m) => (
          <span
            key={m}
            className="rounded-full bg-superficie-sutil px-2.5 py-0.5 text-xs text-texto-suave"
          >
            {m}
          </span>
        ))}
      </div>

      {d.entrega && (
        <div className="flex flex-col gap-2 rounded-dm border border-perfeito-borda bg-perfeito-fundo p-3 text-sm text-perfeito-texto">
          <p>
            <span className="font-medium">Entregue</span> em {dataHora(d.entrega.em)}
            {d.entrega.por
              ? ` por ${d.entrega.por}`
              : d.entrega.fonte === 'tiny'
                ? ' (marcado no Tiny)'
                : ''}
          </p>
          {d.entrega.observacao && <p>{d.entrega.observacao}</p>}
          {podeDesfazer && (
            <Botao
              variante="secundaria"
              tamanho="sm"
              icone={<Undo2 />}
              className="self-start"
              onClick={() => setDesfazendo(true)}
            >
              Desfazer a entrega
            </Botao>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Secao titulo="Cliente e entrega">
          <p className="text-sm font-medium text-texto">{c.nome || 'Sem cliente'}</p>
          {endereco && <p className="text-sm text-texto">{endereco}</p>}
          {c.complemento && (
            <p className="text-sm text-texto-suave">Complemento: {c.complemento}</p>
          )}
          <Linha rotulo="CEP" valor={c.cep} />
          <Linha
            rotulo="Telefone"
            valor={
              c.fone ? (
                whatsapp ? (
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline"
                  >
                    <MessageCircle aria-hidden className="size-3.5" />
                    {c.fone}
                  </a>
                ) : (
                  c.fone
                )
              ) : null
            }
          />
          <Linha rotulo="E-mail" valor={c.email} />
          <Linha rotulo="CPF/CNPJ" valor={c.documento} />
          {d.programacao && (
            <div className="mt-1 flex flex-col gap-1 rounded-dm bg-superficie-sutil p-2 text-sm">
              <p className="text-texto">
                Programado para {data(d.programacao.data)}
                {d.programacao.caminhao && ` · ${d.programacao.caminhao}`}
                {d.programacao.ordem && ` · parada ${d.programacao.ordem}`}
              </p>
              {d.programacao.equipe.length > 0 && (
                <p className="text-texto-suave">Equipe: {d.programacao.equipe.join(', ')}</p>
              )}
              {d.programacao.detalhe && (
                <p className="text-atencao-texto">{d.programacao.detalhe}</p>
              )}
            </div>
          )}
        </Secao>

        <Secao titulo="Pagamento">
          <Linha rotulo="Forma" valor={p.forma_pagamento} />
          <Linha rotulo="Meio" valor={p.meio_pagamento} />
          {/* O Tiny manda "0" quando não há condição — não diz nada a quem lê. */}
          <Linha
            rotulo="Condição"
            valor={p.condicao_pagamento === '0' ? null : p.condicao_pagamento}
          />
          {p.parcelas.length > 0 && (
            <ul className="mt-1 flex flex-col divide-y divide-borda rounded-dm border border-borda text-sm">
              {p.parcelas.map((x, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 px-2 py-1">
                  <span className="text-texto tabular-nums">
                    {p.parcelas.length > 1 ? `${i + 1}ª · ` : ''}
                    {x.data ?? '—'}
                  </span>
                  <span className="text-texto-suave">
                    {[x.forma, x.meio].filter(Boolean).join(' · ')}
                  </span>
                  <span className="font-medium text-texto tabular-nums">{moeda(x.valor)}</span>
                  {x.obs && <span className="w-full text-xs text-texto-suave">{x.obs}</span>}
                </li>
              ))}
            </ul>
          )}
          {d.contas_receber.length > 0 ? (
            <div className="mt-1 flex flex-col gap-1">
              <p className="text-xs text-texto-suave">
                Contas a receber do Tiny
                {d.contas_receber_ate ? ` (copiadas até ${data(d.contas_receber_ate)})` : ''}:
              </p>
              {d.contas_receber.map((cr, i) => (
                <p key={i} className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="tabular-nums">vence {data(cr.vencimento)}</span>
                  <span
                    className={cn(
                      'font-medium',
                      cr.situacao === 'pago'
                        ? 'text-perfeito-texto'
                        : cr.situacao === 'aberto'
                          ? 'text-atencao-texto'
                          : 'text-texto',
                    )}
                  >
                    {cr.situacao ?? '—'}
                    {cr.liquidacao && ` em ${data(cr.liquidacao)}`}
                  </span>
                  <span className="tabular-nums">{moeda(cr.valor)}</span>
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-texto-suave">
              Sem conta a receber copiada do Tiny para este pedido — o "pago / em aberto" do Tiny só
              chega até {data(d.contas_receber_ate)}.
            </p>
          )}
          {d.anexos.length > 0 && (
            <div className="mt-1 flex flex-col gap-1">
              <p className="text-xs text-texto-suave">Comprovantes:</p>
              {d.anexos.map((a) => (
                <Botao
                  key={a.id}
                  variante="fantasma"
                  tamanho="sm"
                  icone={<Paperclip />}
                  className="self-start"
                  carregando={abrir.isPending && abrir.variables === a.caminho}
                  onClick={() => abrir.mutate(a.caminho)}
                >
                  {a.nome} · {a.por ?? '—'} · {dataHora(a.em)}
                  <ExternalLink aria-hidden className="size-3.5" />
                </Botao>
              ))}
            </div>
          )}
        </Secao>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Secao titulo="Valores">
          <Linha rotulo="Produtos" valor={moeda(p.total_produtos)} />
          <Linha rotulo="Frete" valor={moeda(p.valor_frete)} />
          {p.valor_desconto && Number(p.valor_desconto) !== 0 && (
            <Linha rotulo="Desconto" valor={moeda(p.valor_desconto)} />
          )}
          {p.outras_despesas && Number(p.outras_despesas) !== 0 && (
            <Linha rotulo="Outras despesas" valor={moeda(p.outras_despesas)} />
          )}
          <div className="flex justify-between gap-3 border-t border-borda pt-1 text-sm font-semibold text-texto">
            <span>Total</span>
            <span className="tabular-nums">{moeda(p.total_pedido)}</span>
          </div>
        </Secao>
        <Secao titulo="Datas e venda">
          <Linha rotulo="Pedido" valor={data(p.data_pedido)} />
          <Linha rotulo="Previsão" valor={data(p.data_prevista)} />
          <Linha rotulo="Faturado" valor={p.data_faturamento} />
          <Linha rotulo="Enviado" valor={p.data_envio} />
          <Linha rotulo="Entregue (Tiny)" valor={p.data_entrega_tiny} />
          <Linha rotulo="Vendedor" valor={p.vendedor} />
          <Linha
            rotulo="Canal"
            valor={[p.ecommerce, p.numero_ecommerce].filter(Boolean).join(' · ')}
          />
          <Linha
            rotulo="Envio"
            valor={[...new Set([p.forma_envio, p.forma_frete, p.transportador])]
              // Uma letra solta é o código interno do Tiny (ex.: "X"), não o nome do envio.
              .filter((v): v is string => !!v && v.trim().length > 1)
              .join(' · ')}
          />
          <Linha
            rotulo="Rastreio"
            valor={
              p.codigo_rastreamento ? (
                p.url_rastreamento ? (
                  <a
                    href={p.url_rastreamento}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {p.codigo_rastreamento}
                  </a>
                ) : (
                  p.codigo_rastreamento
                )
              ) : null
            }
          />
          {d.notas_fiscais.map((nf, i) => (
            <Linha
              key={i}
              rotulo="Nota fiscal"
              valor={`${nf.numero ?? '—'} · ${data(nf.emissao)} · ${nf.situacao ?? ''} · ${moeda(nf.valor)}`}
            />
          ))}
        </Secao>
      </div>

      {(p.obs || p.obs_interna) && (
        <Secao titulo="Observações">
          {p.obs && (
            <p className="whitespace-pre-line rounded-dm bg-superficie-sutil p-2 text-sm text-texto">
              {p.obs}
            </p>
          )}
          {p.obs_interna && (
            <p className="whitespace-pre-line rounded-dm bg-superficie-sutil p-2 text-sm text-texto">
              <span className="font-medium">Interna: </span>
              {p.obs_interna}
            </p>
          )}
        </Secao>
      )}

      <Secao titulo="Itens">
        <ul className="flex flex-col divide-y divide-borda text-sm">
          {d.itens.map((i) => (
            <li key={i.seq} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1">
              <span
                className={cn('min-w-0 flex-1', i.eh_frete ? 'text-texto-suave' : 'text-texto')}
              >
                {Number(i.quantidade ?? 0)}× {i.descricao || 'Sem descrição'}
                {i.codigo && (
                  <span className="text-texto-suave tabular-nums"> · SKU {i.codigo}</span>
                )}
                {i.eh_frete && <span className="text-texto-suave"> · não vira peça</span>}
              </span>
              <span className="shrink-0 text-texto-suave tabular-nums">
                {moeda(i.valor_unitario)} ·{' '}
                <span className="text-texto">{moeda(i.valor_total)}</span>
              </span>
            </li>
          ))}
        </ul>
        {produtos.length > 0 && (
          <p className="text-xs text-texto-suave">
            {d.plataforma.total_unidades} unidade{d.plataforma.total_unidades === 1 ? '' : 's'} de
            produção
          </p>
        )}
      </Secao>

      <Secao titulo="Peças">
        {d.unidades.length === 0 ? (
          <p className="text-sm text-texto-suave">
            {d.entrega
              ? 'Nenhuma peça deste pedido passou pela produção da plataforma.'
              : 'Nenhuma peça liberada.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {d.unidades.map((u) => (
              <li key={u.card_id} className="flex flex-wrap items-baseline gap-x-2">
                <span
                  className="min-w-0 flex-1 truncate text-texto"
                  title={u.descricao ?? undefined}
                >
                  {u.descricao || 'Unidade'}
                  {u.indice !== null && u.total !== null && (
                    <span className="text-texto-suave tabular-nums">
                      {' '}
                      ({u.indice}/{u.total})
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-texto-suave">
                  {u.arquivado_em
                    ? `${SAIDA[u.motivo_saida ?? ''] ?? 'fora das contas'} · ${data(u.arquivado_em)}`
                    : u.concluido_em
                      ? `pronta · ${u.setor ?? '—'}`
                      : `${u.setor ?? '—'}${u.etapa ? ` · ${u.etapa}` : ''}${u.desde ? ` · há ${formatarDuracao(u.desde, agora)}` : ''}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Histórico">
        <ol className="flex flex-col gap-1 text-sm">
          {d.historico.map((h) => (
            <li key={h.id} className="flex flex-wrap gap-x-2">
              <span className="shrink-0 text-texto-suave tabular-nums">{dataHora(h.em)}</span>
              <span className="font-medium text-texto">{FATOS[h.tipo] ?? h.tipo}</span>
              <span className="text-texto-suave">
                {h.por ?? (h.origem === 'interface' ? '' : 'Sistema')}
                {h.setor && h.tipo === 'movimentacao_setor' ? ` → ${h.setor}` : ''}
              </span>
              {h.observacao && <span className="w-full pl-2 text-texto">{h.observacao}</span>}
            </li>
          ))}
        </ol>
      </Secao>

      <ModalMotivoEntrega
        key={desfazendo ? 'desfazer-aberto' : 'desfazer-fechado'}
        tipo="desfazer_entrega"
        pedido={
          desfazendo && d.plataforma.card_id !== null
            ? { card_id: d.plataforma.card_id, numero: p.numero, cliente_nome: c.nome }
            : null
        }
        aoFechar={() => {
          setDesfazendo(false)
          void refetch()
        }}
      />
    </div>
  )
}

export type { DetalhePedido }
