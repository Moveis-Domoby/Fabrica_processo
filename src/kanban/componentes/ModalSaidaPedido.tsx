import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Ban, Boxes, EyeOff, Factory, Info, PackageCheck, Undo2 } from 'lucide-react'
import { Botao, Modal, useNotificacao } from '@/componentes/ui'
import { pecasPorExtenso } from '../avisoPcp'
import {
  cancelarPedido,
  frasePecasLiberadas,
  fraseQueFicam,
  lerSaidaPrevia,
  novaChave,
  ocultarPedido,
} from '../pcpSaida'
import type { SaidaPrevia } from '../pcpSaida'

/** Qual dos dois gestos e de qual pedido (o número aparece já no título, antes da leitura). */
export interface AlvoSaidaPedido {
  cardId: number
  numero?: number | null
  modo: 'cancelar' | 'ocultar'
}

/**
 * SESSAO-50 (bloco B · frente 4 — respostas do dono de 12/11): os dois modais
 * pequenos do pedido que não vai ser produzido, com o desenho da casa (o Modal
 * do sistema — nada de confirm() do navegador; no celular sobe do rodapé, com
 * os botões de toque um embaixo do outro).
 *
 * - **Cancelar pedido**: avisa que cancela TAMBÉM no Tiny e que não dá para
 *   desfazer pela plataforma; o pedido sai do PCP na hora e o que acontece com
 *   as peças vem escrito (a em produção espera a logística; a pronta vai ao
 *   estoque sem dono). Sem a ida ao Tiny ligada, o botão fica apagado com o porquê.
 * - **Ocultar do PCP**: o pedido some do PCP e fica em "Pedidos ocultos" por N
 *   dias; o Tiny não muda. Com peças já liberadas, pergunta se oculta também
 *   essas peças, dizendo quantas e onde (e quais ficam de qualquer jeito).
 *
 * Lê tudo numa requisição ao abrir e esquece ao fechar (Lei §3 / D-89). O banco
 * confere quem pode e é idempotente (a chave do gesto).
 */
export function ModalSaidaPedido({
  alvo,
  aoFechar,
}: {
  alvo: AlvoSaidaPedido | null
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [chave, setChave] = useState(() => novaChave('saida'))
  // uma chave nova a cada abertura (ajuste durante o render, sem efeito)
  const [anterior, setAnterior] = useState<AlvoSaidaPedido | null>(null)
  if (alvo !== anterior) {
    setAnterior(alvo)
    setChave(novaChave(alvo?.modo ?? 'saida'))
  }

  const { data, isPending, error } = useQuery({
    // debaixo de ['cards']: o aviso ao vivo do PCP relê o modal aberto
    queryKey: ['cards', 'pcp-saida-previa', alvo?.cardId],
    queryFn: () => lerSaidaPrevia(alvo!.cardId),
    enabled: alvo !== null,
    gcTime: 0,
    staleTime: 0,
  })

  async function releer() {
    await Promise.all(
      [['cards'], ['pedidos-lista'], ['pedido-ficha'], ['estoque']].map((queryKey) =>
        clienteQuery.invalidateQueries({ queryKey }),
      ),
    )
  }

  const cancelar = useMutation({
    mutationFn: () => cancelarPedido(alvo!.cardId, chave),
    onSuccess: async (r) => {
      if (r.feito) {
        notificar({
          titulo: `Pedido ${r.numero} cancelado`,
          descricao:
            'Ele saiu do PCP e o cancelamento foi pedido ao Tiny. Está na aba "Cancelados" do PCP.',
          tom: 'perfeito',
        })
      } else {
        notificar({ titulo: `O pedido ${r.numero ?? ''} já estava cancelado`, tom: 'perfeito' })
      }
      aoFechar()
      await releer()
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para cancelar o pedido',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })

  const ocultar = useMutation({
    mutationFn: (comPecas: boolean) => ocultarPedido({ cardId: alvo!.cardId, comPecas, chave }),
    onSuccess: async (r) => {
      if (r.feito) {
        const ocultadas = r.ocultadas ?? 0
        notificar({
          titulo: `Pedido ${r.numero} ocultado do PCP`,
          descricao:
            `Ele fica em "Pedidos ocultos" por ${r.dias ?? 30} dias — de lá dá para recuperar.` +
            (ocultadas > 0
              ? ` ${pecasPorExtenso(ocultadas)} saí${ocultadas === 1 ? 'u' : 'ram'} junto do quadro.`
              : ''),
          tom: 'perfeito',
        })
      } else {
        notificar({ titulo: `O pedido ${r.numero ?? ''} já estava oculto`, tom: 'perfeito' })
      }
      aoFechar()
      await releer()
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para ocultar o pedido',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })

  const numero = data?.numero ?? alvo?.numero ?? null
  const ocupado = cancelar.isPending || ocultar.isPending
  const titulo =
    alvo?.modo === 'ocultar'
      ? `Ocultar o pedido ${numero ?? ''} do PCP?`
      : `Cancelar o pedido ${numero ?? ''}?`

  return (
    <Modal
      aberto={alvo !== null}
      aoFechar={(v) => !v && !ocupado && aoFechar()}
      tamanho="md"
      titulo={titulo}
      descricao={data?.cliente ? data.cliente : undefined}
    >
      {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {error && (
        <p className="text-sm text-danificado-forte" role="alert">
          {error instanceof Error ? error.message : 'Não deu para abrir o pedido.'}
        </p>
      )}
      {data && alvo?.modo === 'cancelar' && (
        <CorpoCancelar
          dados={data}
          ocupado={ocupado}
          carregando={cancelar.isPending}
          aoVoltar={aoFechar}
          aoConfirmar={() => cancelar.mutate()}
        />
      )}
      {data && alvo?.modo === 'ocultar' && (
        <CorpoOcultar
          dados={data}
          ocupado={ocupado}
          carregando={ocultar.isPending ? (ocultar.variables ? 'pecas' : 'pedido') : null}
          aoVoltar={aoFechar}
          aoConfirmar={(comPecas) => ocultar.mutate(comPecas)}
        />
      )}
    </Modal>
  )
}

/** O rodapé dos dois: no celular a ação principal em cima (a mais alcançável). */
function Rodape({ children }: { children: ReactNode }) {
  return <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">{children}</div>
}

function CorpoCancelar({
  dados,
  ocupado,
  carregando,
  aoVoltar,
  aoConfirmar,
}: {
  dados: SaidaPrevia
  ocupado: boolean
  carregando: boolean
  aoVoltar: () => void
  aoConfirmar: () => void
}) {
  const jaCancelado = dados.cancelado_no_tiny || dados.cancelado_plataforma_em !== null
  const consequencias = [
    { icone: <Ban aria-hidden />, texto: 'Ele sai do PCP na hora e vai para a aba "Cancelados".' },
    dados.pecas.em_producao > 0 && {
      icone: <Factory aria-hidden />,
      texto: `${pecasPorExtenso(dados.pecas.em_producao)} em produção ${dados.pecas.em_producao === 1 ? 'espera' : 'esperam'} a logística decidir para onde ${dados.pecas.em_producao === 1 ? 'vai' : 'vão'}.`,
    },
    dados.pecas.prontas > 0 && {
      icone: <PackageCheck aria-hidden />,
      texto: `${pecasPorExtenso(dados.pecas.prontas)} pronta${dados.pecas.prontas === 1 ? ' vai' : 's vão'} para o estoque, sem dono.`,
    },
    dados.reservas > 0 && {
      icone: <Boxes aria-hidden />,
      texto: `${pecasPorExtenso(dados.reservas)} do estoque reservada${dados.reservas === 1 ? ' volta' : 's voltam'} a ficar livre${dados.reservas === 1 ? '' : 's'}.`,
    },
  ].filter(Boolean) as { icone: ReactNode; texto: string }[]

  if (jaCancelado) {
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2 rounded-dm border border-borda bg-superficie-sutil p-3 text-sm text-texto">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>Este pedido já está cancelado — ele está na aba "Cancelados" do PCP.</span>
        </p>
        <Rodape>
          <Botao variante="secundaria" onClick={aoVoltar}>
            Fechar
          </Botao>
        </Rodape>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto">
        <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Isso cancela o pedido <strong>também no Tiny</strong>, e não dá para desfazer pela
          plataforma.
        </span>
      </p>
      <ul className="flex flex-col gap-1.5 text-sm text-texto">
        {consequencias.map((c) => (
          <li key={c.texto} className="flex items-start gap-2 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-texto-suave">
            {c.icone}
            <span>{c.texto}</span>
          </li>
        ))}
      </ul>
      {!dados.tiny_ligado && (
        <p
          className="flex items-start gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo p-3 text-sm text-atencao-texto"
          role="status"
        >
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            A ida ao Tiny está desligada, então o cancelamento não chegaria lá. Cancele no Tiny, ou
            peça a um administrador para ligar "Entregue vai ao Tiny" em Configurações → Caminhões.
          </span>
        </p>
      )}
      <Rodape>
        <Botao variante="secundaria" icone={<Undo2 />} disabled={ocupado} onClick={aoVoltar}>
          Voltar
        </Botao>
        <Botao
          variante="perigo"
          icone={<Ban />}
          disabled={!dados.tiny_ligado || (ocupado && !carregando)}
          carregando={carregando}
          onClick={aoConfirmar}
        >
          Cancelar no Tiny e aqui
        </Botao>
      </Rodape>
    </div>
  )
}

function CorpoOcultar({
  dados,
  ocupado,
  carregando,
  aoVoltar,
  aoConfirmar,
}: {
  dados: SaidaPrevia
  ocupado: boolean
  carregando: 'pecas' | 'pedido' | null
  aoVoltar: () => void
  aoConfirmar: (comPecas: boolean) => void
}) {
  const pergunta = frasePecasLiberadas(dados.ocultar)
  const ficam = fraseQueFicam(dados.ocultar)
  if (dados.oculto_em !== null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2 rounded-dm border border-borda bg-superficie-sutil p-3 text-sm text-texto">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>Este pedido já está oculto — ele está na aba "Pedidos ocultos" do PCP.</span>
        </p>
        <Rodape>
          <Botao variante="secundaria" onClick={aoVoltar}>
            Fechar
          </Botao>
        </Rodape>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-texto">
        Ele some da lista do PCP e fica em <strong>Pedidos ocultos</strong> por{' '}
        {dados.ocultos_dias} dias. O Tiny não muda.
      </p>
      {pergunta && (
        <div className="flex flex-col gap-1.5 rounded-dm border border-atencao-borda bg-atencao-fundo p-3 text-sm text-atencao-texto">
          <p className="flex items-start gap-2 font-medium">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{pergunta}</span>
          </p>
          <p className="pl-6 text-xs">
            Ocultadas, elas saem do quadro e das contas da produção (nada é apagado). Se o pedido for
            recuperado, as vagas delas voltam ao PCP para liberar de novo.
          </p>
        </div>
      )}
      {ficam && (
        <p className="flex items-start gap-2 text-xs text-texto-suave">
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>{ficam}</span>
        </p>
      )}
      <Rodape>
        <Botao variante="secundaria" icone={<Undo2 />} disabled={ocupado} onClick={aoVoltar}>
          Voltar
        </Botao>
        {pergunta ? (
          <>
            <Botao
              variante="secundaria"
              icone={<EyeOff />}
              disabled={ocupado && carregando !== 'pedido'}
              carregando={carregando === 'pedido'}
              onClick={() => aoConfirmar(false)}
            >
              Ocultar só o pedido
            </Botao>
            <Botao
              icone={<EyeOff />}
              disabled={ocupado && carregando !== 'pecas'}
              carregando={carregando === 'pecas'}
              onClick={() => aoConfirmar(true)}
            >
              Ocultar o pedido e as peças
            </Botao>
          </>
        ) : (
          <Botao
            icone={<EyeOff />}
            disabled={ocupado && carregando === null}
            carregando={carregando !== null}
            onClick={() => aoConfirmar(false)}
          >
            Ocultar do PCP
          </Botao>
        )}
      </Rodape>
    </div>
  )
}
