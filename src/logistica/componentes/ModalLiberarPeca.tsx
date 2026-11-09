import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, CheckCircle2, Search } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { useDebouncedValue } from '@/comercial/hooks/useDebouncedValue'
import { cn } from '@/lib/cn'
import { unidadesDoPedido } from '@/kanban/api'
import { chaveDoGesto } from '@/rotas/api'
import { conferirDestinoLiberacao, liberarPecaParaOutroPedido } from '@/logistica/api'
import type { EscolhaDoTiny, PedidoExpedicao } from '@/logistica/api'
import { EXPLICACAO_TINY_DESLIGADO, NOME_DA_SITUACAO, ROTULO_VOLTAR } from '@/logistica/voltaPcp'

/** As telas que mudam quando a peça troca de pedido (releem depois do gesto). */
const RELER: string[][] = [
  ['expedicao'],
  ['pedido-unidades'],
  ['produtos-reservados'],
  ['pcp'],
  ['programadas'],
  ['programacao'],
]

function SimNao({
  rotulo,
  valor,
  aoMudar,
  sim = 'Sim',
  nao = 'Não',
}: {
  rotulo: string
  valor: boolean | null
  aoMudar: (v: boolean) => void
  sim?: string
  nao?: string
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-texto">{rotulo}</legend>
      <div className="grid grid-cols-2 gap-2">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={valor === v}
            onClick={() => aoMudar(v)}
            className={cn(
              'min-h-toque-lg rounded-dm-lg border px-3 text-sm font-semibold transition-colors',
              valor === v
                ? 'border-acao-ativa bg-acao text-acao-texto ring-2 ring-acao-ativa'
                : 'border-borda bg-superficie text-texto hover:bg-superficie-sutil',
            )}
          >
            {v ? sim : nao}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * SESSAO-45 (pedido do dono, 04/11): a Expedição LIBERA A PEÇA PRONTA de um
 * pedido para outro que chegou com mais urgência (ou registra que ela saiu por
 * substituição). As perguntas, na ordem do dono: qual produto foi liberado; se
 * foi para um pedido (sim → para qual; não → o motivo); e se o produto volta
 * para a produção deste pedido. Ao confirmar: este pedido volta ao PCP com o
 * produto que saiu (ou fica em stand-by, se não for produzir agora) e o pedido
 * de destino ganha a peça PRONTA na vaga que esperava esse móvel no PCP. O
 * banco confere tudo de novo no gesto (a mesma regra da conferência).
 *
 * ↪️ SESSAO-47: quando o Tiny já levou este pedido adiante (Faturado, Pronto
 * para envio, Enviado), ele NÃO volta ao PCP sozinho. A janela mostra a situação
 * real e, se o produto volta para a produção, pede a escolha no mesmo gesto:
 * voltar para "Em aberto", voltar para "Preparando envio" (a plataforma muda a
 * situação lá e devolve o pedido ao PCP) ou deixar como está (o pedido fica na
 * Expedição, com o aviso). O aviso do fim diz o que aconteceu de verdade.
 */
export function ModalLiberarPeca({
  pedido,
  tinyLigado = true,
  aoFechar,
}: {
  pedido: PedidoExpedicao | null
  /** SESSAO-47: a ida ao Tiny está ligada? (desligada, só dá para "deixar como está") */
  tinyLigado?: boolean
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [pecaId, setPecaId] = useState<number | null>(null)
  const [paraPedido, setParaPedido] = useState<boolean | null>(null)
  const [numeroTexto, setNumeroTexto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [relancar, setRelancar] = useState<boolean | null>(true)
  // SESSAO-47: o que fazer com a situação do pedido no Tiny (só quando ele está adiantado lá)
  const [escolhaTiny, setEscolhaTiny] = useState<EscolhaDoTiny | null>(null)
  const [chave] = useState(() => chaveDoGesto())
  const adiantado = pedido?.tiny_adiantado === true
  const perguntaTiny = adiantado && relancar === true

  const { data: unidades = [], isPending: carregando } = useQuery({
    queryKey: ['pedido-unidades', pedido?.pedido_id ?? 0],
    queryFn: () => unidadesDoPedido(pedido!.pedido_id),
    enabled: pedido !== null,
  })
  const prontas = unidades.filter((u) => u.setor_terminal)

  const numero = Number(useDebouncedValue(numeroTexto.replace(/\D/g, ''), 350)) || null
  const conferencia = useQuery({
    queryKey: ['liberar-peca-destino', pecaId, numero],
    queryFn: () => conferirDestinoLiberacao(pecaId!, numero),
    enabled: pecaId !== null && paraPedido === true && numero !== null,
    staleTime: 0,
  })
  const destino = conferencia.data

  const liberar = useMutation({
    mutationFn: () =>
      liberarPecaParaOutroPedido({
        pecaId: pecaId!,
        paraNumero: paraPedido ? numero : null,
        motivo: paraPedido ? null : motivo,
        relancar: relancar!,
        chave,
        // só vai quando a janela perguntou (o banco de antes não conhece a escolha)
        tiny: perguntaTiny ? escolhaTiny : null,
      }),
    onSuccess: async (r) => {
      // SESSAO-47 (frente 4): o aviso diz o que aconteceu de verdade com o pedido de origem
      const naoVoltou = !r.repetido && r.voltou_ao_pcp === false
      const descricao = r.repetido
        ? undefined
        : naoVoltou
          ? `O pedido ${r.numero_origem} NÃO voltou ao PCP: no Tiny ele está como ${r.tiny_situacao ?? 'adiantado'}. Ele ficou na Expedição${r.standby ? ', em stand-by,' : ''} com o aviso — de lá dá para devolvê-lo ao PCP mudando a situação no Tiny.`
          : r.tiny_pedido
            ? `O pedido ${r.numero_origem} voltou ao PCP para produzir de novo; no Tiny ele passa para ${NOME_DA_SITUACAO[r.tiny_pedido]}.`
            : `O pedido ${r.numero_origem} ${r.standby ? 'voltou ao PCP em stand-by (sem nova produção por enquanto)' : 'voltou ao PCP para produzir de novo'}.` +
              // o banco de antes só dizia "está adiante": o aviso antigo segue valendo com ele
              (r.voltou_ao_pcp === undefined && r.tiny_adiante
                ? ' Atenção: no Tiny ele já está adiante (faturado ou enviado) — confira lá, porque o quadro do PCP só mostra o que o Tiny ainda deixa produzir.'
                : '')
      notificar({
        titulo: r.repetido
          ? 'Isso já tinha sido feito'
          : r.numero_destino
            ? `A peça foi para o pedido ${r.numero_destino}`
            : 'A peça saiu do pedido',
        descricao,
        tom: naoVoltou ? 'atencao' : 'perfeito',
      })
      await Promise.all(RELER.map((queryKey) => clienteQuery.invalidateQueries({ queryKey })))
      aoFechar()
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para liberar a peça',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  if (!pedido) return null
  const destinoOk = paraPedido === true && destino?.ok === true && numero !== null
  const motivoOk = paraPedido === false && motivo.trim().length >= 3
  const pode =
    pecaId !== null &&
    relancar !== null &&
    (destinoOk || motivoOk) &&
    // SESSAO-47: com o pedido adiantado no Tiny e o produto voltando para a produção, a escolha é obrigatória
    (!perguntaTiny || escolhaTiny !== null) &&
    !liberar.isPending

  return (
    <Modal
      aberto
      aoFechar={(v) => !v && aoFechar()}
      titulo={`Liberar peça do pedido ${pedido.numero}`}
      descricao={
        adiantado
          ? `Quando a peça pronta deste pedido vai para outro (ou sai por outro motivo), o produto que saiu precisa ser produzido de novo. No Tiny este pedido está como ${pedido.situacao ?? 'adiantado'}, por isso ele não volta ao PCP sozinho — a janela pergunta o que fazer.`
          : 'Quando a peça pronta deste pedido vai para outro (ou sai por outro motivo), este pedido volta ao PCP com o produto que saiu.'
      }
      tamanho="galpao"
      rodape={
        <>
          <Botao tamanho="lg" variante="secundaria" onClick={aoFechar} disabled={liberar.isPending}>
            Cancelar
          </Botao>
          <Botao
            tamanho="lg"
            icone={<ArrowRightLeft />}
            onClick={() => liberar.mutate()}
            disabled={!pode}
            carregando={liberar.isPending}
          >
            Confirmar
          </Botao>
        </>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium text-texto">
            Qual produto foi liberado?
          </legend>
          {carregando && <p className="text-sm text-texto-fraco">Carregando…</p>}
          {!carregando && prontas.length === 0 && (
            <p className="rounded-dm border border-borda bg-superficie-sutil p-3 text-sm text-texto-suave">
              Este pedido não tem peça pronta agora.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {prontas.map((u) => (
              <li key={u.card_id}>
                <button
                  type="button"
                  aria-pressed={pecaId === u.card_id}
                  onClick={() => setPecaId(u.card_id)}
                  className={cn(
                    'flex min-h-toque-lg w-full items-center gap-3 rounded-dm-lg border px-3 py-2 text-left text-sm transition-colors',
                    pecaId === u.card_id
                      ? 'border-acao-ativa bg-superficie-sutil ring-2 ring-acao-ativa'
                      : 'border-borda bg-superficie hover:bg-superficie-sutil',
                  )}
                >
                  <CheckCircle2
                    aria-hidden
                    className={cn(
                      'size-5 shrink-0',
                      pecaId === u.card_id ? 'text-perfeito-forte' : 'text-texto-fraco',
                    )}
                  />
                  <span className="min-w-0 flex-1 text-texto">
                    {u.item_descricao ?? 'Sem descrição'}{' '}
                    <span className="font-medium tabular-nums text-texto-suave">
                      ({u.indice_unidade}/{u.total_unidades})
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </fieldset>

        {pecaId !== null && (
          <SimNao
            rotulo="O produto foi liberado para um pedido?"
            valor={paraPedido}
            aoMudar={setParaPedido}
          />
        )}

        {pecaId !== null && paraPedido === true && (
          <div className="flex flex-col gap-2">
            <Campo
              rotulo="Para qual pedido o produto foi liberado?"
              prefixo={<Search />}
              inputMode="numeric"
              placeholder="Número do pedido"
              value={numeroTexto}
              onChange={(e) => setNumeroTexto(e.target.value)}
              autoFocus
            />
            {numero !== null && conferencia.isFetching && (
              <p className="text-sm text-texto-fraco">Conferindo o pedido {numero}…</p>
            )}
            {numero !== null && !conferencia.isFetching && destino && !destino.ok && (
              <p className="rounded-dm border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto">
                {destino.motivo}
              </p>
            )}
            {numero !== null &&
              !conferencia.isFetching &&
              destino?.ok &&
              destino.numero_destino && (
                <p className="rounded-dm border border-perfeito-borda bg-perfeito-fundo px-3 py-2 text-sm text-perfeito-texto">
                  Pedido {destino.numero_destino}
                  {destino.cliente_destino ? ` — ${destino.cliente_destino}` : ''}: a peça entra
                  pronta, no lugar de {destino.vaga?.descricao ?? 'o mesmo móvel'}
                  {destino.vaga && destino.vaga.total > 1
                    ? ` (${destino.vaga.indice_unidade}/${destino.vaga.total})`
                    : ''}
                  , que ele ainda esperava no PCP.
                </p>
              )}
            {conferencia.isError && (
              <p className="text-sm text-atencao-texto">
                Não deu para conferir o pedido agora — tente de novo.
              </p>
            )}
          </div>
        )}

        {pecaId !== null && paraPedido === false && (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-texto">
            Motivo da substituição
            <textarea
              className="min-h-24 rounded-dm border border-borda-forte bg-superficie p-2 text-base font-normal text-texto placeholder:text-texto-fraco"
              maxLength={300}
              placeholder="Ex.: foi para a vitrine da loja / trocou uma peça avariada de outro cliente"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
        )}

        {pecaId !== null && paraPedido !== null && (
          <div className="flex flex-col gap-1.5">
            <SimNao
              rotulo={`Lançar produto novo para o PCP com a etiqueta do pedido ${pedido.numero}?`}
              valor={relancar}
              aoMudar={setRelancar}
              sim="Sim, produzir de novo"
              nao="Não por enquanto"
            />
            <p className="text-xs text-texto-suave">
              {adiantado
                ? relancar
                  ? `No Tiny, o pedido ${pedido.numero} está como ${pedido.situacao ?? 'adiantado'} — por isso ele não volta ao PCP sozinho. Escolha abaixo o que fazer.`
                  : `O pedido ${pedido.numero} fica em stand-by (parado, com o motivo). Como no Tiny ele está como ${pedido.situacao ?? 'adiantado'}, ele não aparece no PCP: fica na Expedição, com o aviso.`
                : relancar
                  ? `O pedido ${pedido.numero} volta ao PCP com este produto para liberar a produção de novo.`
                  : `O pedido ${pedido.numero} volta ao PCP em stand-by (parado, com o motivo) — ninguém produz até alguém tirar do stand-by.`}
            </p>
          </div>
        )}

        {/* SESSAO-47 (frente 3): a situação real do pedido no Tiny e as três opções, no mesmo gesto */}
        {pecaId !== null && paraPedido !== null && perguntaTiny && (
          <fieldset className="flex flex-col gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo p-3">
            <legend className="px-1 text-sm font-medium text-atencao-texto">
              No Tiny, este pedido está como {pedido.situacao ?? 'adiantado'}
            </legend>
            <div className="flex flex-col gap-2">
              {(['aberto', 'preparando_envio', 'deixar'] as const).map((opcao) => {
                const desligada = opcao !== 'deixar' && !tinyLigado
                return (
                  <button
                    key={opcao}
                    type="button"
                    aria-pressed={escolhaTiny === opcao}
                    disabled={desligada}
                    onClick={() => setEscolhaTiny(opcao)}
                    className={cn(
                      'min-h-toque-lg rounded-dm-lg border px-3 text-left text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                      escolhaTiny === opcao
                        ? 'border-acao-ativa bg-acao text-acao-texto ring-2 ring-acao-ativa'
                        : 'border-borda bg-superficie text-texto hover:bg-superficie-sutil',
                    )}
                  >
                    {opcao === 'deixar' ? 'Deixar como está' : ROTULO_VOLTAR[opcao]}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-atencao-texto">
              {escolhaTiny === 'deixar'
                ? `O pedido ${pedido.numero} fica na Expedição, com o aviso de que saiu do PCP — de lá dá para devolvê-lo depois.`
                : escolhaTiny
                  ? `A plataforma muda a situação no Tiny para ${NOME_DA_SITUACAO[escolhaTiny]} e o pedido ${pedido.numero} volta ao PCP agora, para produzir de novo.`
                  : 'Escolha: mudar a situação no Tiny e devolver o pedido ao PCP agora, ou deixar como está.'}
            </p>
            {!tinyLigado && (
              <p className="text-xs text-atencao-texto">{EXPLICACAO_TINY_DESLIGADO}</p>
            )}
          </fieldset>
        )}
      </form>
    </Modal>
  )
}
