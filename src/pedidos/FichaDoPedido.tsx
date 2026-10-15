import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ChevronDown,
  ClipboardList,
  Cog,
  Database,
  ExternalLink,
  FileText,
  History,
  ImageIcon,
  MessageCircle,
  PackageX,
  ReceiptText,
  Truck,
  TriangleAlert,
  Undo2,
} from 'lucide-react'
import { Botao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { detalhePedidoPcp } from '@/kanban/api'
import type { DetalhePedido } from '@/kanban/api'
import { entregueHoje, linkDoAnexo, linkWhatsApp } from '@/rotas/api'
import { ModalDevolvido, ModalMotivoEntrega } from '@/rotas/ModaisEntrega'
import { ModalDecidirDevolucao } from '@/logistica/componentes/ModalDecidirDevolucao'
import { CamposDoCard } from '@/utilitarios/CamposDoCard'
import { DadosDoTinyPainel } from './DadosDoTiny'
import { ProducaoDoPedidoPainel } from './ProducaoDoPedido'
import { data, diaEHora, moeda } from './formato'

/** A situação da conta a receber como o Tiny manda → como a gente fala. */
const SITUACAO_CONTA: Record<string, string> = {
  pago: 'Pago',
  aberto: 'Em aberto',
  parcial: 'Pago em parte',
  cancelada: 'Cancelada',
}

/** D-122: a conferência traz as contas toda madrugada — 2 dias é margem para uma falha. */
const contasEmDia = (ate: string | null) =>
  ate !== null && Date.now() - new Date(ate).getTime() < 2 * 24 * 60 * 60 * 1000

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
  anexo_removido: 'Anexo tirado',
  card_arquivado: 'Arquivado',
  card_desarquivado: 'Trazido de volta',
  etiqueta_adicionada: 'Etiqueta colocada',
  etiqueta_removida: 'Etiqueta tirada',
  notificacao_enviada: 'Aviso enviado',
  movimentacao_setor: 'Mudou de setor',
}

type Parte = 'itens' | 'producao' | 'entrega' | 'tiny' | 'historico'

const PARTES: { valor: Parte; rotulo: string; icone: ReactNode }[] = [
  { valor: 'itens', rotulo: 'Itens e pagamento', icone: <ReceiptText aria-hidden /> },
  { valor: 'producao', rotulo: 'Produção', icone: <Cog aria-hidden /> },
  { valor: 'entrega', rotulo: 'Entrega e comprovante', icone: <Truck aria-hidden /> },
  { valor: 'tiny', rotulo: 'Dados do Tiny', icone: <Database aria-hidden /> },
  { valor: 'historico', rotulo: 'Histórico', icone: <History aria-hidden /> },
]

function Linha({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  if (valor === null || valor === undefined || valor === '' || valor === '—') return null
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-texto-suave">{rotulo}</span>
      <span className="text-right text-texto">{valor}</span>
    </div>
  )
}

/** Um bloco do resumo: título pequeno e o que importa. */
function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-dm-lg bg-superficie-sutil/60 p-3">
      <p className="text-xs font-medium text-texto-suave">{titulo}</p>
      {children}
    </div>
  )
}

/** Uma parte revelada: entra suave (sem pulo) e tem o seu título. */
function Painel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section
      aria-label={titulo}
      className="flex flex-col gap-3 rounded-dm-lg border border-borda/70 p-4 transition-[opacity,transform] duration-200 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:transition-none"
    >
      <h3 className="text-sm font-semibold text-texto">{titulo}</h3>
      {children}
    </section>
  )
}

/**
 * A FICHA DO PEDIDO (área Pedidos — ajustes do dono, 14/10 noite, D-134;
 * nasceu da janela completa do PCP — D-120). Abrir a linha = 1 requisição: o
 * resumo (cliente, venda, valor, entrega) aparece na hora; o resto fica atrás
 * de botões e entra aos poucos, um de cada vez, no clique — "Produção" e
 * "Dados do Tiny" só buscam quando abertos. Fechar a linha esquece tudo.
 */
export function FichaDoPedido({ pedidoId }: { pedidoId: number }) {
  const [abertas, setAbertas] = useState<Set<Parte>>(() => new Set())
  const consulta = useQuery({
    queryKey: ['pedido-ficha', pedidoId],
    queryFn: () => detalhePedidoPcp(pedidoId),
    gcTime: 0,
    staleTime: 0,
  })

  function alternar(parte: Parte) {
    setAbertas((atual) => {
      const nova = new Set(atual)
      if (nova.has(parte)) nova.delete(parte)
      else nova.add(parte)
      return nova
    })
  }

  if (consulta.isPending) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-dm-lg bg-superficie-sutil/60" />
        ))}
      </div>
    )
  }
  if (consulta.isError || !consulta.data) {
    return (
      <p className="rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto">
        {consulta.error instanceof Error ? consulta.error.message : 'Não deu para abrir o pedido.'}
      </p>
    )
  }
  const d = consulta.data
  return (
    <div className="flex flex-col gap-4">
      <Resumo d={d} />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Ver mais do pedido">
        {PARTES.map((p) => {
          const aberta = abertas.has(p.valor)
          return (
            <button
              key={p.valor}
              type="button"
              aria-expanded={aberta}
              onClick={() => alternar(p.valor)}
              className={cn(
                'inline-flex min-h-toque-md items-center gap-2 rounded-full border px-3.5 text-sm transition-colors [&>svg]:size-4',
                aberta
                  ? 'border-acao-ativa bg-acao/10 font-medium text-texto'
                  : 'border-borda text-texto-suave hover:bg-superficie-sutil hover:text-texto',
              )}
            >
              {p.icone}
              {p.rotulo}
              <ChevronDown
                aria-hidden
                className={cn('size-4 transition-transform', aberta && 'rotate-180')}
              />
            </button>
          )
        })}
      </div>

      {abertas.has('itens') && <PainelItens d={d} />}
      {abertas.has('producao') && (
        <Painel titulo="Produção">
          <ProducaoDoPedidoPainel pedidoId={pedidoId} />
        </Painel>
      )}
      {abertas.has('entrega') && <PainelEntrega d={d} aoMudar={() => void consulta.refetch()} />}
      {abertas.has('tiny') && (
        <Painel titulo="Dados do Tiny">
          <DadosDoTinyPainel pedidoId={pedidoId} />
        </Painel>
      )}
      {abertas.has('historico') && <PainelHistorico d={d} />}
    </div>
  )
}

/** O que se lê de relance: quem, quanto, quem vendeu e onde está a entrega. */
function Resumo({ d }: { d: DetalhePedido }) {
  const { pedido: p, cliente: c } = d
  const whatsapp = linkWhatsApp(c.fone)
  const cidade = [c.cidade, c.uf].filter(Boolean).join(' - ')
  return (
    <div className="flex flex-col gap-3">
      {d.devolucao && (
        <p className="flex items-center gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto">
          <TriangleAlert aria-hidden className="size-4 shrink-0" />
          Em decisão pós devolução desde {diaEHora(d.devolucao.quando)}
          {d.devolucao.motivo ? ` · ${d.devolucao.motivo}` : ''} — veja em "Entrega e comprovante".
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Bloco titulo="Cliente">
          <p
            className="line-clamp-2 font-medium break-words text-texto"
            title={c.nome ?? undefined}
          >
            {c.nome || 'Sem cliente'}
          </p>
          {cidade && <p className="text-sm text-texto-suave">{cidade}</p>}
          {c.fone &&
            (whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-1 text-sm text-texto underline-offset-2 hover:underline"
              >
                <MessageCircle aria-hidden className="size-3.5" />
                {c.fone}
              </a>
            ) : (
              <p className="text-sm text-texto">{c.fone}</p>
            ))}
        </Bloco>
        <Bloco titulo="Venda">
          <p className="font-medium text-texto">
            {p.vendedor ? `Vendido por ${p.vendedor}` : 'Sem vendedor no Tiny'}
          </p>
          <p className="text-sm text-texto-suave">Pedido de {data(p.data_pedido)}</p>
          {p.forma_pagamento && (
            <p className="truncate text-sm text-texto-suave" title={p.forma_pagamento}>
              {p.forma_pagamento}
            </p>
          )}
        </Bloco>
        <Bloco titulo="Valor">
          <p className="text-lg font-semibold text-texto tabular-nums">{moeda(p.total_pedido)}</p>
          <p className="text-sm text-texto-suave tabular-nums">
            Produtos {moeda(p.total_produtos)}
            {p.valor_frete && Number(p.valor_frete) > 0 ? ` · frete ${moeda(p.valor_frete)}` : ''}
          </p>
        </Bloco>
        <Bloco titulo="Entrega">
          {d.entrega ? (
            <>
              <p className="font-medium text-perfeito-texto">Entregue</p>
              <p className="text-sm text-texto">{diaEHora(d.entrega.em)}</p>
              <p className="text-sm text-texto-suave">
                {d.entrega.por
                  ? `por ${d.entrega.por}`
                  : d.entrega.fonte === 'tiny'
                    ? 'marcado no Tiny'
                    : ''}
              </p>
            </>
          ) : d.programacao ? (
            <>
              <p className="font-medium text-texto">Programado para {data(d.programacao.data)}</p>
              <p className="text-sm text-texto-suave">
                {[
                  d.programacao.caminhao,
                  d.programacao.rota != null ? `Rota ${d.programacao.rota}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-texto">Ainda não programado</p>
              <p className="text-sm text-texto-suave">Previsão {data(p.data_prevista)}</p>
            </>
          )}
        </Bloco>
      </div>
    </div>
  )
}

function PainelItens({ d }: { d: DetalhePedido }) {
  const { pedido: p } = d
  const souAdmin = useSessao().perfil?.papel === 'admin'
  return (
    <Painel titulo="Itens e pagamento">
      <ul className="flex flex-col divide-y divide-borda/70 text-sm">
        {d.itens.map((i) => (
          <li key={i.seq} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
            <span className={cn('min-w-0 flex-1', i.eh_frete ? 'text-texto-suave' : 'text-texto')}>
              {Number(i.quantidade ?? 0)}× {i.descricao || 'Sem descrição'}
              {i.codigo && <span className="text-texto-suave tabular-nums"> · SKU {i.codigo}</span>}
              {i.eh_frete && <span className="text-texto-suave"> · não vira peça</span>}
            </span>
            <span className="shrink-0 text-texto-suave tabular-nums">
              {moeda(i.valor_unitario)} · <span className="text-texto">{moeda(i.valor_total)}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-texto-suave">Pagamento</p>
          <Linha rotulo="Forma" valor={p.forma_pagamento} />
          <Linha rotulo="Meio" valor={p.meio_pagamento} />
          {/* O Tiny manda "0" quando não há condição — não diz nada a quem lê. */}
          <Linha
            rotulo="Condição"
            valor={p.condicao_pagamento === '0' ? null : p.condicao_pagamento}
          />
          {p.parcelas.length > 0 && (
            <ul className="mt-1 flex flex-col divide-y divide-borda/70 rounded-dm border border-borda/70 text-sm">
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
                </li>
              ))}
            </ul>
          )}
          {d.contas_receber.length > 0 ? (
            <div className="mt-1 flex flex-col gap-1">
              <p className="text-xs text-texto-suave">
                Contas a receber do Tiny
                {d.contas_receber_ate ? ` (conferidas em ${data(d.contas_receber_ate)})` : ''}:
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
                    {(cr.situacao && SITUACAO_CONTA[cr.situacao]) ?? cr.situacao ?? '—'}
                    {cr.liquidacao && ` em ${data(cr.liquidacao)}`}
                  </span>
                  <span className="tabular-nums">{moeda(cr.valor)}</span>
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-texto-suave">
              {contasEmDia(d.contas_receber_ate)
                ? `O Tiny não tem conta a receber para este pedido (conferido em ${data(d.contas_receber_ate)}).`
                : `Sem conta a receber copiada do Tiny para este pedido — o "pago / em aberto" do Tiny só chega até ${data(d.contas_receber_ate)}.`}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-texto-suave">Valores, datas e venda</p>
          <Linha rotulo="Produtos" valor={moeda(p.total_produtos)} />
          <Linha rotulo="Frete" valor={moeda(p.valor_frete)} />
          {p.valor_desconto && Number(p.valor_desconto) !== 0 && (
            <Linha rotulo="Desconto" valor={moeda(p.valor_desconto)} />
          )}
          {p.outras_despesas && Number(p.outras_despesas) !== 0 && (
            <Linha rotulo="Outras despesas" valor={moeda(p.outras_despesas)} />
          )}
          <div className="flex justify-between gap-3 border-t border-borda/70 pt-1 text-sm font-semibold text-texto">
            <span>Total</span>
            <span className="tabular-nums">{moeda(p.total_pedido)}</span>
          </div>
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
          {p.marcadores.length > 0 && (
            <Linha rotulo="Marcadores" valor={p.marcadores.join(' · ')} />
          )}
          {d.notas_fiscais.map((nf, i) => (
            <Linha
              key={i}
              rotulo="Nota fiscal"
              valor={`${nf.numero ?? '—'} · ${data(nf.emissao)} · ${nf.situacao ?? ''} · ${moeda(nf.valor)}`}
            />
          ))}
        </div>
      </div>

      {(p.obs || p.obs_interna) && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-texto-suave">Observações</p>
          {p.obs && (
            <p className="whitespace-pre-line rounded-dm bg-superficie-sutil/60 p-2 text-sm text-texto">
              {p.obs}
            </p>
          )}
          {p.obs_interna && (
            <p className="whitespace-pre-line rounded-dm bg-superficie-sutil/60 p-2 text-sm text-texto">
              <span className="font-medium">Interna: </span>
              {p.obs_interna}
            </p>
          )}
        </div>
      )}

      {/* SESSAO-27 (D-101): os campos customizados do pedido — o admin preenche aqui. */}
      <CamposDoCard pedidoId={p.id} podeEditar={souAdmin} />
    </Painel>
  )
}

/** A entrega: programação, quando e por quem, o comprovante e os gestos da logística. */
function PainelEntrega({ d, aoMudar }: { d: DetalhePedido; aoMudar: () => void }) {
  const notificar = useNotificacao()
  const [desfazendo, setDesfazendo] = useState(false)
  const [devolvendo, setDevolvendo] = useState(false)
  const [decidindo, setDecidindo] = useState(false)
  // O link do arquivo é de vida curta: pede no clique e mostra a imagem ali mesmo.
  const [vendo, setVendo] = useState<{ id: number; url: string } | null>(null)
  const abrir = useMutation({
    mutationFn: async (a: DetalhePedido['anexos'][number]) => ({
      a,
      url: await linkDoAnexo(a.caminho),
    }),
    onSuccess: ({ a, url }) => {
      if (a.mime.startsWith('image/')) setVendo({ id: a.id, url })
      else window.open(url, '_blank', 'noopener')
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para abrir o arquivo',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })
  const { pedido: p, cliente: c } = d
  const endereco = [
    [c.endereco, c.numero].filter(Boolean).join(', '),
    c.bairro,
    [c.cidade, c.uf].filter(Boolean).join('-'),
  ]
    .filter(Boolean)
    .join(' · ')
  const podeDesfazer =
    d.entrega?.por_gente && entregueHoje(d.entrega.em) && d.plataforma.card_id !== null

  return (
    <Painel titulo="Entrega e comprovante">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-texto-suave">Para onde</p>
          {endereco ? (
            <p className="text-sm text-texto">{endereco}</p>
          ) : (
            <p className="text-sm text-texto-suave">Sem endereço no cadastro do Tiny.</p>
          )}
          {c.complemento && (
            <p className="text-sm text-texto-suave">Complemento: {c.complemento}</p>
          )}
          <Linha rotulo="CEP" valor={c.cep} />
          <Linha rotulo="E-mail" valor={c.email} />
          <Linha rotulo="CPF/CNPJ" valor={c.documento} />
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
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-texto-suave">Programação e entrega</p>
          {d.programacao ? (
            <div className="flex flex-col gap-0.5 rounded-dm bg-superficie-sutil/60 p-2 text-sm">
              <p className="text-texto">
                Programado para {data(d.programacao.data)}
                {d.programacao.caminhao && ` · ${d.programacao.caminhao}`}
                {d.programacao.rota != null && ` · Rota ${d.programacao.rota}`}
                {d.programacao.ordem && ` · parada ${d.programacao.ordem}`}
              </p>
              {d.programacao.equipe.length > 0 && (
                <p className="text-texto-suave">Equipe: {d.programacao.equipe.join(', ')}</p>
              )}
              {d.programacao.detalhe && (
                <p className="text-atencao-texto">{d.programacao.detalhe}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-texto-suave">Ainda não programado.</p>
          )}
          {d.entrega && (
            <div className="flex flex-col gap-1 rounded-dm border border-perfeito-borda bg-perfeito-fundo p-2 text-sm text-perfeito-texto">
              <p>
                <span className="font-medium">Entregue</span> em {diaEHora(d.entrega.em)}
                {d.entrega.por
                  ? ` por ${d.entrega.por}`
                  : d.entrega.fonte === 'tiny'
                    ? ' (marcado no Tiny)'
                    : ''}
              </p>
              {d.entrega.observacao && <p>{d.entrega.observacao}</p>}
            </div>
          )}
          {d.devolucao && (
            <div className="flex flex-col gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo p-2 text-sm text-atencao-texto">
              <p>
                <span className="font-medium">Em decisão pós devolução</span> desde{' '}
                {diaEHora(d.devolucao.quando)}
                {d.devolucao.quem ? ` — ${d.devolucao.quem}` : ''}
                {d.devolucao.motivo ? ` · ${d.devolucao.motivo}` : ''}
              </p>
              {d.devolucao.observacao && <p>{d.devolucao.observacao}</p>}
              <Botao
                tamanho="sm"
                icone={<ClipboardList />}
                className="self-start"
                onClick={() => setDecidindo(true)}
              >
                Decidir situação
              </Botao>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {podeDesfazer && (
              <Botao
                variante="secundaria"
                tamanho="sm"
                icone={<Undo2 />}
                onClick={() => setDesfazendo(true)}
              >
                Desfazer a entrega
              </Botao>
            )}
            {/* SESSAO-31 (D-129): "devolução de peça já entregue pode ocorrer também". */}
            {d.entrega && !d.devolucao && d.plataforma.card_id !== null && (
              <Botao
                variante="secundaria"
                tamanho="sm"
                icone={<PackageX />}
                onClick={() => setDevolvendo(true)}
              >
                Pedido devolvido
              </Botao>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-texto-suave">Comprovantes e anexos</p>
        {d.anexos.length === 0 ? (
          <p className="text-sm text-texto-suave">Nenhum comprovante anexado a este pedido.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {d.anexos.map((a) => (
              <li key={a.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {a.mime.startsWith('image/') ? (
                    <ImageIcon aria-hidden className="size-4 text-texto-suave" />
                  ) : (
                    <FileText aria-hidden className="size-4 text-texto-suave" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-texto" title={a.nome}>
                    {a.nome}
                  </span>
                  <span className="text-xs text-texto-suave">
                    {a.por ?? '—'} · {diaEHora(a.em)}
                  </span>
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    icone={a.mime.startsWith('image/') ? <ImageIcon /> : <ExternalLink />}
                    carregando={abrir.isPending && abrir.variables?.id === a.id}
                    onClick={() => (vendo?.id === a.id ? setVendo(null) : abrir.mutate(a))}
                  >
                    {vendo?.id === a.id ? 'Esconder' : 'Ver'}
                  </Botao>
                </div>
                {vendo?.id === a.id && (
                  <img
                    src={vendo.url}
                    alt={`Comprovante: ${a.nome}`}
                    className="max-h-96 w-fit max-w-full rounded-dm border border-borda/70 object-contain transition-opacity duration-200 starting:opacity-0"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

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
          aoMudar()
        }}
      />
      <ModalDevolvido
        key={devolvendo ? 'devolvido-aberto' : 'devolvido-fechado'}
        pedido={
          devolvendo && d.plataforma.card_id !== null
            ? { card_id: d.plataforma.card_id, numero: p.numero, cliente_nome: c.nome }
            : null
        }
        // As peças que saíram com a entrega — quais voltaram (todas marcadas).
        pecas={d.unidades
          .filter((u) => u.motivo_saida === 'entregue')
          .map((u) => ({
            id: u.card_id,
            rotulo: `${u.descricao ?? 'Peça'}${u.indice !== null ? ` (${u.indice}/${u.total})` : ''}`,
          }))}
        aoFechar={() => {
          setDevolvendo(false)
          aoMudar()
        }}
      />
      <ModalDecidirDevolucao
        key={decidindo ? 'decidir-aberto' : 'decidir-fechado'}
        cardId={decidindo ? d.plataforma.card_id : null}
        aoFechar={() => {
          setDecidindo(false)
          aoMudar()
        }}
      />
    </Painel>
  )
}

function PainelHistorico({ d }: { d: DetalhePedido }) {
  return (
    <Painel titulo="Histórico">
      {d.historico.length === 0 ? (
        <p className="text-sm text-texto-suave">Nada registrado na plataforma para este pedido.</p>
      ) : (
        <ol className="flex flex-col gap-1.5 text-sm">
          {d.historico.map((h) => (
            <li key={h.id} className="flex flex-wrap gap-x-2">
              <span className="shrink-0 text-texto-suave tabular-nums">{diaEHora(h.em)}</span>
              <span className="font-medium text-texto">{FATOS[h.tipo] ?? h.tipo}</span>
              <span className="text-texto-suave">
                {h.por ?? (h.origem === 'interface' ? '' : 'Sistema')}
                {h.setor && h.tipo === 'movimentacao_setor' ? ` → ${h.setor}` : ''}
              </span>
              {h.observacao && <span className="w-full pl-2 text-texto">{h.observacao}</span>}
            </li>
          ))}
        </ol>
      )}
    </Painel>
  )
}
