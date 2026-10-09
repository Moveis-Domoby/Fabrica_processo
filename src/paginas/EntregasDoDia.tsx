import { Suspense, lazy, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MapPin,
  MessageCircle,
  MessageSquarePlus,
  PackageX,
  Paperclip,
  RotateCcw,
  Truck,
  Undo2,
} from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import {
  anexarComprovante,
  comentarNoCard,
  enderecoLegivel,
  entregasDoDia,
  entregueHoje,
  linkMapaEntrega,
  linkWhatsApp,
  registrarEntrega,
  TIPOS_COMPROVANTE,
} from '@/rotas/api'
import type { EntregaDoDia, TipoMotivo } from '@/rotas/api'
import { ModalDevolvido, ModalMotivoEntrega } from '@/rotas/ModaisEntrega'
import { useAoVivo } from '@/lib/aoVivo'

const MiniMapa = lazy(() => import('@/rotas/MiniMapaEntregas'))

function horaCurta(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : ''
}

function dataLonga(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  })
}

/**
 * Entregas do dia (SESSAO-30 · D-115): a tela do entregador — celular primeiro,
 * botões grandes (D-06). Uma requisição traz tudo (Lei §2): o caminhão do dia
 * dele, as paradas na ordem salva da rota, cada uma com cliente, nº do
 * pedido, VOLUMES, endereço, observação, o detalhe de quem programou e os
 * móveis. Por pedido: Comentário · Entregue (com comprovante e observação,
 * opcionais) · Não entregue · Pedido devolvido · Anexar comprovante ·
 * WhatsApp · Mapa. A logística e o admin também abrem (escolhendo o caminhão).
 */
export function EntregasDoDia() {
  const [caminhaoId, setCaminhaoId] = useState<number | null>(null)
  // A logística pode olhar outro dia (o entregador vê sempre o de hoje).
  const [dia, setDia] = useState<string | null>(null)
  const [verMapa, setVerMapa] = useState(true)
  const [comMotivo, setComMotivo] = useState<{ tipo: TipoMotivo; entrega: EntregaDoDia } | null>(
    null,
  )
  const [devolvendo, setDevolvendo] = useState<EntregaDoDia | null>(null)
  const [comentando, setComentando] = useState<EntregaDoDia | null>(null)
  const [anexando, setAnexando] = useState<EntregaDoDia | null>(null)

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['entregas-do-dia', dia, caminhaoId],
    queryFn: () => entregasDoDia({ data: dia, caminhaoId }),
  })
  // A rota mudou (outro entregador marcou, a logística programou) → AO VIVO (Lei §4).
  useAoVivo('rotas', [['entregas-do-dia']])

  const entregas = data?.entregas ?? []
  const feitas = entregas.filter((e) => e.entregue_em).length
  const caminhao = data?.caminhoes.find((c) => c.id === data.caminhao_id)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl sm:text-3xl">
          <Truck aria-hidden className="size-7 shrink-0 text-texto-suave" />
          Entregas do dia
        </h1>
        {data && (
          <p className="text-sm text-texto-suave first-letter:uppercase">
            {dataLonga(data.data)}
            {entregas.length > 0 &&
              ` · ${feitas} de ${entregas.length} entregue${entregas.length === 1 ? '' : 's'}`}
          </p>
        )}
      </div>

      {data?.sou_logistica && (
        <div className="w-48">
          <Campo
            rotulo="Ver outro dia"
            type="date"
            value={dia ?? data.data}
            onChange={(e) => {
              setDia(e.target.value || null)
              setCaminhaoId(null)
            }}
          />
        </div>
      )}

      {isPending && <p className="text-sm text-texto-fraco">Carregando as entregas…</p>}
      {isError && (
        <p className="rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto">
          {error instanceof Error ? error.message : 'Não deu para carregar as entregas.'}
        </p>
      )}

      {data && data.caminhoes.length === 0 && (
        <p className="rounded-dm-lg border border-borda bg-superficie p-4 text-texto-suave">
          {data.sou_logistica
            ? `Nenhum caminhão programado ${dia ? 'neste dia' : 'para hoje'}.`
            : 'Nenhum caminhão liberado para você hoje. Quem programa a rota escolhe quem leva cada caminhão.'}
        </p>
      )}

      {data && data.caminhoes.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Caminhão">
          {data.caminhoes.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={c.id === data.caminhao_id}
              onClick={() => setCaminhaoId(c.id)}
              className={cn(
                'min-h-12 rounded-dm border px-4 text-sm font-medium',
                c.id === data.caminhao_id
                  ? 'border-acao-ativa bg-acao/15 text-texto'
                  : 'border-borda bg-superficie text-texto-suave',
              )}
            >
              {c.nome} · {c.entregas}
            </button>
          ))}
        </div>
      )}

      {caminhao && (
        <p className="text-sm text-texto">
          <span className="font-medium">{caminhao.nome}</span>
          {caminhao.placa && <span className="text-texto-suave"> · {caminhao.placa}</span>}
          {caminhao.equipe.length > 0 && (
            <span className="text-texto-suave"> · {caminhao.equipe.join(', ')}</span>
          )}
        </p>
      )}

      {entregas.length > 0 && (
        <section aria-label="Mapa da rota" className="flex flex-col gap-2">
          <Botao
            variante="fantasma"
            tamanho="sm"
            className="self-start"
            icone={verMapa ? <ChevronUp /> : <ChevronDown />}
            onClick={() => setVerMapa((v) => !v)}
          >
            {verMapa ? 'Esconder o mapa' : 'Ver o mapa'}
          </Botao>
          {verMapa && (
            <div className="h-56 overflow-hidden rounded-dm-lg border border-borda sm:h-72">
              <Suspense
                fallback={<p className="p-3 text-sm text-texto-fraco">Carregando o mapa…</p>}
              >
                <MiniMapa entregas={entregas} />
              </Suspense>
            </div>
          )}
        </section>
      )}

      <ol className="flex flex-col gap-3">
        {entregas.map((entrega) => (
          <CartaoEntrega
            key={entrega.card_id}
            entrega={entrega}
            aoNaoEntregue={() => setComMotivo({ tipo: 'nao_entregue', entrega })}
            aoDesfazer={() => setComMotivo({ tipo: 'desfazer_entrega', entrega })}
            aoDevolvido={() => setDevolvendo(entrega)}
            aoComentar={() => setComentando(entrega)}
            aoAnexar={() => setAnexando(entrega)}
          />
        ))}
      </ol>

      <ModalMotivoEntrega
        key={comMotivo ? `${comMotivo.tipo}-${comMotivo.entrega.card_id}` : 'motivo-fechado'}
        tipo={comMotivo?.tipo ?? 'nao_entregue'}
        pedido={comMotivo?.entrega ?? null}
        aoFechar={() => setComMotivo(null)}
      />
      <ModalDevolvido
        key={devolvendo ? `devolvido-${devolvendo.card_id}` : 'devolvido-fechado'}
        pedido={devolvendo}
        aoFechar={() => setDevolvendo(null)}
      />
      <ModalComentario
        key={comentando ? `comentario-${comentando.card_id}` : 'comentario-fechado'}
        entrega={comentando}
        aoFechar={() => setComentando(null)}
      />
      <ModalAnexar
        key={anexando ? `anexo-${anexando.card_id}` : 'anexo-fechado'}
        entrega={anexando}
        aoFechar={() => setAnexando(null)}
      />
    </div>
  )
}

/** O card de uma parada: os dados que o entregador precisa + os botões (D-115). */
function CartaoEntrega({
  entrega,
  aoNaoEntregue,
  aoDesfazer,
  aoDevolvido,
  aoComentar,
  aoAnexar,
}: {
  entrega: EntregaDoDia
  aoNaoEntregue: () => void
  aoDesfazer: () => void
  aoDevolvido: () => void
  aoComentar: () => void
  aoAnexar: () => void
}) {
  const [entregando, setEntregando] = useState(false)
  const [verItens, setVerItens] = useState(false)
  const whatsapp = linkWhatsApp(entrega.telefone)
  const mapa = linkMapaEntrega(entrega)
  const entregue = entrega.entregue_em !== null

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-dm-lg border bg-superficie p-4',
        entregue ? 'border-perfeito-borda' : 'border-borda',
      )}
    >
      {/* "Entregue" abre o painel EM CIMA, dentro do card (pedido do dono). */}
      {entregando && !entregue && (
        <PainelEntregue entrega={entrega} aoFechar={() => setEntregando(false)} />
      )}

      <div className="flex items-start gap-3">
        <span
          aria-label={`Parada ${entrega.posicao}`}
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full text-base font-bold tabular-nums',
            entregue ? 'bg-superficie-sutil text-texto-suave' : 'bg-acao text-acao-texto',
          )}
        >
          {entrega.posicao}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-lg font-semibold text-texto">
            {entrega.cliente_nome || 'Sem cliente'}
          </p>
          <p className="text-sm text-texto-suave tabular-nums">
            Pedido {entrega.numero} ·{' '}
            <span className="font-medium text-texto">
              {entrega.volumes} volume{entrega.volumes === 1 ? '' : 's'}
            </span>
            {entrega.volumes !== entrega.unidades &&
              ` (${entrega.unidades} móve${entrega.unidades === 1 ? 'l' : 'is'})`}
          </p>
        </div>
        {entregue && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-perfeito-fundo px-2.5 py-1 text-sm font-medium text-perfeito-texto">
            <CheckCircle2 aria-hidden className="size-4" />
            {horaCurta(entrega.entregue_em)}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <p className="text-texto">{enderecoLegivel(entrega)}</p>
        {entrega.complemento && (
          <p className="text-texto-suave">Complemento: {entrega.complemento}</p>
        )}
        {entrega.detalhe && (
          <p className="rounded-dm border border-atencao-borda bg-atencao-fundo px-2 py-1 text-atencao-texto">
            {entrega.detalhe}
          </p>
        )}
        {entrega.obs && <p className="text-texto-suave">OBS: {entrega.obs}</p>}
      </div>

      <div>
        <button
          type="button"
          className="flex min-h-10 items-center gap-1 text-sm font-medium text-texto-suave"
          aria-expanded={verItens}
          onClick={() => setVerItens((v) => !v)}
        >
          {verItens ? (
            <ChevronUp aria-hidden className="size-4" />
          ) : (
            <ChevronDown aria-hidden className="size-4" />
          )}
          Produtos ({entrega.itens.length})
        </button>
        {verItens && (
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {entrega.itens.map((item, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-texto">
                  {item.quantidade}× {item.descricao}
                </span>
                {item.volumes !== item.quantidade && (
                  <span className="shrink-0 text-texto-suave tabular-nums">
                    {item.volumes} vol.
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {entrega.comentarios.length > 0 && (
        <div className="flex flex-col gap-1 rounded-dm bg-superficie-sutil p-2 text-sm">
          {entrega.comentarios.slice(0, 2).map((c, i) => (
            <p key={i} className="text-texto">
              <span className="font-medium">{c.por ?? 'Alguém'}:</span> {c.texto}
            </p>
          ))}
        </div>
      )}

      {entregue && (
        <p className="text-sm text-texto-suave">
          Entregue por {entrega.entregue_por ?? 'Sistema (Tiny)'} às{' '}
          {horaCurta(entrega.entregue_em)}
          {entrega.comprovantes > 0 &&
            ` · ${entrega.comprovantes} comprovante${entrega.comprovantes === 1 ? '' : 's'}`}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noreferrer" className="contents">
            <Botao variante="secundaria" icone={<MessageCircle />} className="w-full">
              WhatsApp
            </Botao>
          </a>
        )}
        {mapa && (
          <a href={mapa} target="_blank" rel="noreferrer" className="contents">
            <Botao variante="secundaria" icone={<MapPin />} className="w-full">
              Mapa
            </Botao>
          </a>
        )}
        <Botao
          variante="secundaria"
          icone={<MessageSquarePlus />}
          className="w-full"
          onClick={aoComentar}
        >
          Comentário
        </Botao>
        <Botao variante="secundaria" icone={<Paperclip />} className="w-full" onClick={aoAnexar}>
          Comprovante
        </Botao>
      </div>

      {!entregue ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Botao
            tamanho="lg"
            icone={<CheckCircle2 />}
            onClick={() => setEntregando(true)}
            disabled={entregando}
          >
            Entregue
          </Botao>
          <Botao tamanho="lg" variante="secundaria" icone={<RotateCcw />} onClick={aoNaoEntregue}>
            Não entregue
          </Botao>
          <Botao tamanho="lg" variante="secundaria" icone={<PackageX />} onClick={aoDevolvido}>
            Pedido devolvido
          </Botao>
        </div>
      ) : (
        entrega.entregue_por_gente &&
        entregueHoje(entrega.entregue_em) && (
          <Botao variante="fantasma" icone={<Undo2 />} className="self-start" onClick={aoDesfazer}>
            Desfazer a entrega
          </Botao>
        )
      )}
    </li>
  )
}

/**
 * O painel do "Entregue" (D-115): comprovante de pagamento (foto, PDF, Word —
 * opcional) e observação (opcional). A entrega é registrada primeiro (é o
 * fato que importa); o comprovante sobe em seguida, direto ao armário.
 */
function PainelEntregue({ entrega, aoFechar }: { entrega: EntregaDoDia; aoFechar: () => void }) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const arquivoRef = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [observacao, setObservacao] = useState('')

  const confirmar = useMutation({
    mutationFn: async () => {
      await registrarEntrega({ cardId: entrega.card_id, observacao })
      if (arquivo) {
        try {
          await anexarComprovante(entrega.card_id, arquivo)
        } catch (erro) {
          return erro instanceof Error ? erro.message : 'o comprovante não subiu'
        }
      }
      return null
    },
    onSuccess: async (erroComprovante) => {
      notificar({
        titulo: `Pedido ${entrega.numero} entregue`,
        descricao: erroComprovante
          ? `A entrega ficou registrada, mas o comprovante não subiu (${erroComprovante}). Use "Comprovante" no card.`
          : undefined,
        tom: erroComprovante ? 'atencao' : 'perfeito',
      })
      aoFechar()
      await clienteQuery.invalidateQueries({ queryKey: ['entregas-do-dia'] })
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para registrar a entrega',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  return (
    <form
      className="flex flex-col gap-3 rounded-dm border border-acao-ativa bg-acao/10 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        confirmar.mutate()
      }}
    >
      <p className="text-sm font-medium text-texto">
        Confirmar a entrega do pedido {entrega.numero}
      </p>
      <div className="flex flex-col gap-1">
        <input
          ref={arquivoRef}
          type="file"
          accept={TIPOS_COMPROVANTE}
          className="sr-only"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
        />
        <Botao
          type="button"
          variante="secundaria"
          icone={<Paperclip />}
          onClick={() => arquivoRef.current?.click()}
        >
          {arquivo ? 'Trocar o comprovante' : 'Anexar comprovante (opcional)'}
        </Botao>
        {arquivo && <p className="truncate text-xs text-texto-suave">{arquivo.name}</p>}
      </div>
      <Campo
        rotulo="Observação (opcional)"
        placeholder="Ex.: recebido pela vizinha"
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <Botao type="submit" tamanho="lg" icone={<CheckCircle2 />} carregando={confirmar.isPending}>
          Confirmar
        </Botao>
        <Botao
          type="button"
          tamanho="lg"
          variante="fantasma"
          onClick={aoFechar}
          disabled={confirmar.isPending}
        >
          Voltar
        </Botao>
      </div>
    </form>
  )
}

function ModalComentario({
  entrega,
  aoFechar,
}: {
  entrega: EntregaDoDia | null
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [texto, setTexto] = useState('')
  const salvar = useMutation({
    mutationFn: () => comentarNoCard(entrega!.card_id, texto),
    onSuccess: async () => {
      notificar({ titulo: 'Comentário salvo', tom: 'perfeito' })
      aoFechar()
      await clienteQuery.invalidateQueries({ queryKey: ['entregas-do-dia'] })
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para comentar',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })
  return (
    <Modal
      aberto={entrega !== null}
      aoFechar={(v) => !v && aoFechar()}
      titulo={`Comentário — pedido ${entrega?.numero ?? ''}`}
      descricao={entrega?.cliente_nome}
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (texto.trim()) salvar.mutate()
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-texto">
          O que aconteceu
          <textarea
            className="min-h-28 rounded-dm border border-borda bg-superficie p-2 text-base text-texto"
            maxLength={1000}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoFocus
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Botao type="submit" disabled={!texto.trim()} carregando={salvar.isPending}>
            Salvar comentário
          </Botao>
          <Botao type="button" variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
        </div>
      </form>
    </Modal>
  )
}

/** "Comprovante" fora da entrega (D-115): anexar a qualquer hora. */
function ModalAnexar({
  entrega,
  aoFechar,
}: {
  entrega: EntregaDoDia | null
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [arquivo, setArquivo] = useState<File | null>(null)
  const enviar = useMutation({
    mutationFn: () => anexarComprovante(entrega!.card_id, arquivo!),
    onSuccess: async () => {
      notificar({ titulo: 'Comprovante anexado', tom: 'perfeito' })
      aoFechar()
      await clienteQuery.invalidateQueries({ queryKey: ['entregas-do-dia'] })
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para anexar',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })
  return (
    <Modal
      aberto={entrega !== null}
      aoFechar={(v) => !v && aoFechar()}
      titulo={`Comprovante — pedido ${entrega?.numero ?? ''}`}
      descricao="Foto, PDF ou Word, até 10 MB. A foto é reduzida no próprio aparelho."
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (arquivo) enviar.mutate()
        }}
      >
        <input
          type="file"
          accept={TIPOS_COMPROVANTE}
          className="text-sm text-texto file:mr-3 file:min-h-12 file:rounded-dm file:border-0 file:bg-superficie-sutil file:px-4 file:text-texto"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap gap-2">
          <Botao
            type="submit"
            icone={<Paperclip />}
            disabled={!arquivo}
            carregando={enviar.isPending}
          >
            Anexar
          </Botao>
          <Botao type="button" variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
        </div>
      </form>
    </Modal>
  )
}
