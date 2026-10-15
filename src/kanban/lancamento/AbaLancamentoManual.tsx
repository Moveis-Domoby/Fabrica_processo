import { useEffect, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarClock,
  ChevronDown,
  CircleCheckBig,
  Link2,
  MessageSquare,
  Paperclip,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  TriangleAlert,
  Wrench,
} from 'lucide-react'
import { Botao, Campo, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { FiltroPill } from '@/dashboards/componentes/Filtros'
import { useAoVivo } from '@/lib/aoVivo'
import { AvatarChat } from '@/chat/componentes/AvatarChat'
import { ROTULO_DESTINO_FINAL } from '@/logistica/devolucao'
import { EtiquetasDoCard } from '@/utilitarios/PilulaEtiqueta'
import { buscarSetores } from '../api'
import { ROTULO_VISAO, lancarCardAvulso, listarAvulsos } from '../avulso'
import type { LinhaAvulso, VisaoAvulsos } from '../avulso'
import { ModalConcluirAvulso } from '../componentes/ModalConcluirAvulso'
import type { Card } from '../tipos'
import { ModalNovoCardAvulso } from './ModalNovoCardAvulso'
import { useAbrirCard } from '../janela/abrirCard'

const POR_PAGINA = 20
const VISOES: { valor: VisaoAvulsos; rotulo: string }[] = (
  ['a_lancar', 'em_producao', 'concluidos'] as const
).map((v) => ({ valor: v, rotulo: ROTULO_VISAO[v] }))

function hojeIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/**
 * A aba "Lançamento manual" do PCP (SESSAO-31 · D-125/D-130): o card AVULSO —
 * trabalho que não nasce de pedido nem de reposição — e o AJUSTE de peça.
 * Mostra A lançar · Em produção · Concluídos, por cursor no servidor (20 por
 * vez + "Ver mais"), ao vivo pelo aviso do PCP (sem relógio — Lei §4).
 */
export function AbaLancamentoManual({ ativa }: { ativa: boolean }) {
  const [visao, setVisao] = useState<VisaoAvulsos>('a_lancar')
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setTermo(busca.trim().length >= 2 ? busca.trim() : ''), 300)
    return () => clearTimeout(t)
  }, [busca])
  const [criando, setCriando] = useState(false)
  const [lancando, setLancando] = useState<LinhaAvulso | null>(null)
  const [concluindo, setConcluindo] = useState<Card | null>(null)
  const abrirCard = useAbrirCard()

  const consulta = useInfiniteQuery({
    queryKey: ['avulsos', visao, termo],
    queryFn: ({ pageParam }) =>
      listarAvulsos({ visao, busca: termo, antesId: pageParam, limite: POR_PAGINA }),
    initialPageParam: null as number | null,
    getNextPageParam: (ultima) =>
      ultima.length > 0 && ultima[ultima.length - 1].tem_mais
        ? ultima[ultima.length - 1].card_id
        : undefined,
    enabled: ativa,
  })
  // O card avulso mexe no PCP → o aviso ao vivo do PCP relê esta lista (sem relógio).
  useAoVivo('pcp', [['avulsos']], ativa)
  const linhas = consulta.data?.pages.flat() ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Botao icone={<Plus />} onClick={() => setCriando(true)}>
          Novo card
        </Botao>
        <FiltroPill rotulo="Mostrar" opcoes={VISOES} valor={visao} aoMudar={setVisao} />
        <div className="w-full sm:ml-auto sm:w-72">
          <Campo
            rotulo="Buscar pelo nome"
            rotuloOculto
            placeholder="Buscar pelo nome do card"
            prefixo={<Search aria-hidden className="size-4" />}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {consulta.isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {consulta.isError && (
        <p className="rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto">
          {consulta.error instanceof Error
            ? consulta.error.message
            : 'Não deu para carregar os cards.'}
        </p>
      )}
      {!consulta.isPending && linhas.length === 0 && (
        <p className="rounded-dm-lg border border-borda bg-superficie p-5 text-sm text-texto-suave">
          {visao === 'a_lancar'
            ? 'Nenhum card esperando lançamento — use "Novo card" para criar um.'
            : visao === 'em_producao'
              ? 'Nenhum card avulso nem peça em ajuste na produção agora.'
              : 'Nenhum card concluído ainda.'}
        </p>
      )}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {linhas.map((l) => (
          <li key={l.card_id}>
            <CartaoDoAvulso
              linha={l}
              aoAbrir={() => abrirCard(l.card_id)}
              aoLancar={() => setLancando(l)}
              aoConcluir={() =>
                setConcluindo({
                  id: l.card_id,
                  tipo: 'avulso',
                  titulo: l.titulo,
                  item_descricao: null,
                } as Card)
              }
            />
          </li>
        ))}
      </ul>
      {consulta.hasNextPage && (
        <Botao
          variante="fantasma"
          icone={<ChevronDown />}
          className="self-center"
          carregando={consulta.isFetchingNextPage}
          onClick={() => consulta.fetchNextPage()}
        >
          Ver mais
        </Botao>
      )}

      <ModalNovoCardAvulso aberto={criando} aoFechar={() => setCriando(false)} />
      <ModalLancarAvulso
        key={lancando?.card_id ?? 'lancar-fechado'}
        linha={lancando}
        aoFechar={() => setLancando(null)}
      />
      <ModalConcluirAvulso
        key={concluindo?.id ?? 'concluir-fechado'}
        card={concluindo}
        aoFechar={() => setConcluindo(null)}
      />
    </div>
  )
}

/**
 * ↩️ Ajuste do dono (14/10 noite — "o lançamento manual deve seguir o padrão de
 * card, não ser uma linha completa"): o card comum da plataforma, como o do
 * pedido no PCP — título e tempo em cima, o que o card tem no meio e o gesto
 * (Lançar / Concluir) embaixo, na largura toda.
 */
function CartaoDoAvulso({
  linha: l,
  aoAbrir,
  aoLancar,
  aoConcluir,
}: {
  linha: LinhaAvulso
  aoAbrir: () => void
  aoLancar: () => void
  aoConcluir: () => void
}) {
  const hoje = hojeIso()
  const concluido = l.concluido_em !== null
  const atrasado = !concluido && l.vence_em !== null && l.vence_em < hoje
  const aLancar =
    l.tipo === 'avulso' && !concluido && l.etapa_nome === null && l.executor_nome === null
  return (
    <article className="flex h-full flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-4">
      <header className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={aoAbrir}
          className="min-h-toque-md min-w-0 text-left font-semibold text-texto underline-offset-2 hover:underline"
          aria-label={`Abrir o card ${l.titulo}`}
        >
          <span className="line-clamp-2 break-words">{l.titulo}</span>
        </button>
        {l.vence_em && !concluido && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 pt-0.5 text-xs tabular-nums',
              atrasado ? 'font-medium text-atencao-texto' : 'text-texto-suave',
            )}
          >
            {atrasado ? (
              <TriangleAlert aria-hidden className="size-3.5" />
            ) : (
              <CalendarClock aria-hidden className="size-3.5" />
            )}
            {atrasado ? `Venceu ${diaMes(l.vence_em)}` : `Vence ${diaMes(l.vence_em)}`}
          </span>
        )}
      </header>

      {l.ajuste_destino && (
        <p>
          <span className="inline-flex items-center gap-1 rounded-full bg-info-fundo px-2 py-0.5 text-xs font-medium text-info-texto">
            <Wrench aria-hidden className="size-3.5" />
            Ajuste · vai para {ROTULO_DESTINO_FINAL[l.ajuste_destino].toLowerCase()}
          </span>
        </p>
      )}
      <EtiquetasDoCard ids={l.etiquetas} />

      <p className="text-sm text-texto-suave">
        {concluido ? (
          <span className="inline-flex items-center gap-1 text-perfeito-texto">
            <CircleCheckBig aria-hidden className="size-4" />
            Concluído em {new Date(l.concluido_em!).toLocaleDateString('pt-BR')}
          </span>
        ) : l.etapa_nome ? (
          `${l.setor_nome} · ${l.etapa_nome}`
        ) : (
          'No PCP — a lançar'
        )}
      </p>
      {!concluido && l.executor_nome && (
        <p className="inline-flex items-center gap-1 text-sm text-texto">
          {l.pausado_em ? (
            <Pause aria-hidden className="size-4 text-atencao-texto" />
          ) : (
            <Play aria-hidden className="size-4 text-perfeito-forte" />
          )}
          {l.pausado_em ? 'Pausado' : 'Em execução'} · {l.executor_nome}
        </p>
      )}

      {(l.vinculo_rotulo && l.tipo === 'avulso') || l.anexos_qtd > 0 || l.mensagens_qtd > 0 ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-suave">
          {l.vinculo_rotulo && l.tipo === 'avulso' && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Link2 aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{l.vinculo_rotulo}</span>
            </span>
          )}
          {l.anexos_qtd > 0 && (
            <span
              className="inline-flex items-center gap-1"
              aria-label={`${l.anexos_qtd} anexo(s)`}
            >
              <Paperclip aria-hidden className="size-3.5" />
              {l.anexos_qtd}
            </span>
          )}
          {l.mensagens_qtd > 0 && (
            <span
              className="inline-flex items-center gap-1"
              aria-label={`${l.mensagens_qtd} mensagem(ns)`}
            >
              <MessageSquare aria-hidden className="size-3.5" />
              {l.mensagens_qtd}
            </span>
          )}
        </p>
      ) : null}

      {l.responsaveis.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-texto-suave">
          {l.responsaveis.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1">
              <AvatarChat nome={p.nome} foto={p.foto} tamanho="sm" />
              {p.nome}
            </span>
          ))}
        </p>
      )}

      <p className="mt-auto text-xs text-texto-fraco">
        Criado {l.criado_por ? `por ${l.criado_por} ` : ''}em{' '}
        {new Date(l.criado_em).toLocaleDateString('pt-BR')}
      </p>

      {aLancar && (
        <Botao icone={<Send />} larguraTotal onClick={aoLancar}>
          Lançar para a produção
        </Botao>
      )}
      {l.tipo === 'avulso' && !concluido && !aLancar && (
        <Botao variante="secundaria" icone={<CircleCheckBig />} larguraTotal onClick={aoConcluir}>
          Concluir
        </Botao>
      )}
      {aLancar && (
        <Botao variante="fantasma" tamanho="sm" icone={<CircleCheckBig />} onClick={aoConcluir}>
          Concluir sem lançar
        </Botao>
      )}
    </article>
  )
}

/** Lançar o card avulso para a produção: escolher o setor (cai na fila dele). */
function ModalLancarAvulso({
  linha,
  aoFechar,
}: {
  linha: LinhaAvulso | null
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [setorId, setSetorId] = useState('')
  const { data: setores = [] } = useQuery({
    queryKey: ['setores'],
    queryFn: () => buscarSetores(),
    enabled: linha !== null,
  })
  const lancar = useMutation({
    mutationFn: () => lancarCardAvulso(linha!.card_id, Number(setorId)),
    onSuccess: async () => {
      notificar({ titulo: 'Card lançado — está na fila do setor', tom: 'perfeito' })
      aoFechar()
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['avulsos'] }),
        clienteQuery.invalidateQueries({ queryKey: ['quadro'] }),
      ])
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para lançar',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })
  return (
    <Modal
      aberto={linha !== null}
      aoFechar={(v) => !v && aoFechar()}
      titulo="Lançar para a produção"
      descricao={linha?.titulo}
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            icone={<Send />}
            disabled={!setorId}
            carregando={lancar.isPending}
            onClick={() => lancar.mutate()}
          >
            Lançar
          </Botao>
        </>
      }
    >
      <Selecao
        rotulo="Setor"
        opcoes={setores
          .filter((s) => s.papel_no_fluxo === 'producao')
          .map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
        valor={setorId}
        aoMudar={setSetorId}
        placeholder="Escolha o setor"
        tamanho="galpao"
      />
    </Modal>
  )
}
