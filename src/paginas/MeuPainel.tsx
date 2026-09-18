import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  ClipboardCheck,
  ListTodo,
  Play,
  Plus,
  Target,
  UserRound,
} from 'lucide-react'
import { Botao, Paginacao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { supabase } from '@/lib/supabase'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { ROTULO_PAPEL } from '@/autenticacao/tipos'
import { buscarPareceresPendentes, buscarSetores } from '@/kanban/api'
import { rotaDoSetor } from '@/navegacao/rotas'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import { meusCards, minhasTarefas } from '@/afazeres/api'
import { buscarAvisos, marcarAvisoLido } from '@/notificacoes/api'
import {
  buscarMetasPainel,
  cardsDosSetores,
  encerrarMeta,
  minhasExecucoesAbertas,
} from '@/metas/api'
import type { MetaPainel } from '@/metas/api'
import { ModalMeta } from '@/metas/ModalMeta'
import { CartaoMeta } from '@/metas/CartaoMeta'

const ATUALIZA_A_CADA = 15_000
const METAS_POR_PAGINA = 20

/**
 * Meu Painel (SESSAO-14 / D-37) — a tela em que todo mundo cai ao entrar:
 * o que me espera (pendências), o que me avisaram (as mesmas do sino) e o
 * cockpit de metas com andamento em tempo real. O progresso vem calculado do
 * banco; aqui nada se digita.
 */
export function MeuPainel() {
  const { perfil, vinculos } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const agora = useAgora()
  const souAdmin = perfil?.papel === 'admin'

  const { data: setores = [] } = useQuery({ queryKey: ['setores'], queryFn: () => buscarSetores() })
  const setorPorId = useMemo(() => new Map(setores.map((s) => [s.id, s])), [setores])
  const meusSetorIds = useMemo(() => vinculos.map((v) => v.setor_id), [vinculos])

  // ----- pendências -----
  const { data: cardsDelegados = [] } = useQuery({
    queryKey: ['meu-painel', 'delegados', perfil?.id],
    queryFn: () => meusCards(perfil!.id),
    enabled: perfil !== null,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: tarefas = [] } = useQuery({
    queryKey: ['meu-painel', 'tarefas', perfil?.id],
    queryFn: () => minhasTarefas(perfil!.id),
    enabled: perfil !== null,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: execucoes = [] } = useQuery({
    queryKey: ['meu-painel', 'execucoes', perfil?.id],
    queryFn: () => minhasExecucoesAbertas(perfil!.id),
    enabled: perfil !== null,
    refetchInterval: ATUALIZA_A_CADA,
  })
  // Qualidade a atestar: chegadas com marcação ainda sem parecer nos MEUS setores.
  const { data: cardsDosMeusSetores = [] } = useQuery({
    queryKey: ['meu-painel', 'cards-setores', meusSetorIds.join(',')],
    queryFn: () => cardsDosSetores(meusSetorIds),
    enabled: meusSetorIds.length > 0,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: pareceresPendentes = new Map() } = useQuery({
    queryKey: [
      'meu-painel',
      'pareceres',
      cardsDosMeusSetores.map((c) => `${c.id}:${c.desde}`).join(','),
    ],
    queryFn: () => buscarPareceresPendentes(cardsDosMeusSetores),
    enabled: cardsDosMeusSetores.length > 0,
  })
  const cardsComParecer = cardsDosMeusSetores.filter((c) => pareceresPendentes.has(c.id))
  const cardPorId = useMemo(
    () => new Map([...cardsDosMeusSetores, ...cardsDelegados].map((c) => [c.id, c])),
    [cardsDosMeusSetores, cardsDelegados],
  )

  // ----- notificações (as mesmas do sino) -----
  const { data: avisos = [] } = useQuery({
    queryKey: ['avisos', perfil?.id],
    queryFn: () => buscarAvisos(perfil!.id, 5),
    enabled: perfil !== null,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const lerAviso = useMutation({
    mutationFn: marcarAvisoLido,
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['avisos'] }),
  })

  // ----- cockpit de metas -----
  const [paginaMetas, setPaginaMetas] = useState(1)
  const { data: metas = [] } = useQuery({
    queryKey: ['metas', 'painel', paginaMetas],
    queryFn: () =>
      buscarMetasPainel({
        limite: METAS_POR_PAGINA,
        deslocamento: (paginaMetas - 1) * METAS_POR_PAGINA,
      }),
    enabled: perfil !== null,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const totalMetas = metas[0]?.contagem_total ?? 0

  const [modalAberta, setModalAberta] = useState(false)
  const [metaEmEdicao, setMetaEmEdicao] = useState<MetaPainel | null>(null)

  const encerrarMutacao = useMutation({
    mutationFn: encerrarMeta,
    onSuccess: async () => {
      notificar({ titulo: 'Meta encerrada', descricao: 'A história dela fica guardada.', tom: 'perfeito' })
      await clienteQuery.invalidateQueries({ queryKey: ['metas'] })
    },
    onError: (excecao: unknown) =>
      notificar({
        titulo: 'Não deu para encerrar',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  // Tempo real: mudança em card (mover/iniciar/finalizar) mexe em pendências e
  // metas — invalida na hora; o polling de 15s segue como rede de segurança.
  useEffect(() => {
    const canal = supabase
      .channel('meu-painel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plt_cards' }, () => {
        void clienteQuery.invalidateQueries({ queryKey: ['meu-painel'] })
        void clienteQuery.invalidateQueries({ queryKey: ['metas'] })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(canal)
    }
  }, [clienteQuery])

  if (!perfil) return null // a guarda já cuidou; isto só acalma o TypeScript

  const nomeCurto = perfil.nome.split(' ')[0]
  const meusSetores = vinculos.map((v) => v.setor.nome).join(' · ')

  const pendencias = [
    {
      chave: 'qualidade',
      icone: ClipboardCheck,
      titulo: 'Qualidade a atestar',
      total: cardsComParecer.length,
      descricao: 'chegadas esperando o seu parecer',
      itens: cardsComParecer.slice(0, 3).map((c) => ({
        id: `q-${c.id}`,
        texto: c.item_descricao ?? `Unidade ${c.indice_unidade}/${c.total_unidades}`,
        para: c.setor_atual_id ? rotaDoSetor(setorPorId.get(c.setor_atual_id)?.codigo ?? '') : '#',
      })),
    },
    {
      chave: 'delegados',
      icone: UserRound,
      titulo: 'Delegados a mim',
      total: cardsDelegados.length,
      descricao: 'cards sob sua responsabilidade',
      itens: cardsDelegados.slice(0, 3).map((c) => ({
        id: `d-${c.id}`,
        texto: c.item_descricao ?? `Unidade ${c.indice_unidade}/${c.total_unidades}`,
        para: '/inicio/afazeres',
      })),
    },
    {
      chave: 'tarefas',
      icone: ListTodo,
      titulo: 'Tarefas em aberto',
      total: tarefas.length,
      descricao: 'avulsas, minhas ou delegadas',
      itens: tarefas.slice(0, 3).map((t) => ({
        id: `t-${t.id}`,
        texto: t.titulo,
        para: '/inicio/afazeres',
      })),
    },
    {
      chave: 'execucoes',
      icone: Play,
      titulo: 'Em execução agora',
      total: execucoes.length,
      descricao: 'o tempo está contando para você',
      itens: execucoes.slice(0, 3).map((e) => {
        const card = cardPorId.get(e.card_id)
        const setor = card?.setor_atual_id ? setorPorId.get(card.setor_atual_id) : undefined
        return {
          id: `e-${e.evento_inicio_id}`,
          texto: `${card?.item_descricao ?? `Card ${e.card_id}`} · ${formatarDuracao(e.iniciou_em, agora)}`,
          para: setor ? rotaDoSetor(setor.codigo) : '/inicio/afazeres',
        }
      }),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl">Olá, {nomeCurto}!</h1>
        <p className="text-texto-suave">
          {ROTULO_PAPEL[perfil.papel]} · matrícula{' '}
          <span className="tabular-nums">{perfil.matricula}</span>
          {meusSetores && <> · {meusSetores}</>}
        </p>
      </div>

      {/* ----- Pendências ----- */}
      <section aria-label="Pendências" className="flex flex-col gap-3">
        <h2 className="text-lg">O que me espera</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {pendencias.map((p) => (
            <div
              key={p.chave}
              className="flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-4"
            >
              <div className="flex items-center gap-2">
                <p.icone aria-hidden className="size-5 shrink-0 text-texto-suave" />
                <h3 className="font-marca text-sm font-semibold">{p.titulo}</h3>
                <span
                  className={cn(
                    'ml-auto rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums',
                    p.total > 0 ? 'bg-acao text-acao-texto' : 'bg-superficie-sutil text-texto-fraco',
                  )}
                >
                  {p.total}
                </span>
              </div>
              <p className="text-xs text-texto-fraco">{p.descricao}</p>
              {p.itens.length > 0 && (
                <ul className="flex flex-col gap-1 border-t border-borda pt-2">
                  {p.itens.map((item) => (
                    <li key={item.id}>
                      <Link
                        to={item.para}
                        className="block min-h-toque-md content-center truncate rounded-dm px-1 text-sm text-texto hover:bg-superficie-sutil"
                      >
                        {item.texto}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ----- Notificações recentes ----- */}
      <section aria-label="Notificações recentes" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg">Avisos recentes</h2>
          <span className="text-sm text-texto-fraco">os mesmos do sino</span>
        </div>
        {avisos.length === 0 ? (
          <p className="rounded-dm-lg border border-borda bg-superficie p-4 text-sm text-texto-suave">
            Nenhum aviso por aqui — quando algo pedir sua atenção, aparece primeiro nesta lista.
          </p>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-dm-lg border border-borda bg-superficie">
            {avisos.map((a) => (
              <li key={a.id} className="border-b border-borda last:border-b-0">
                <button
                  type="button"
                  onClick={() => {
                    if (!a.lida_em) lerAviso.mutate(a.id)
                  }}
                  className={cn(
                    'flex w-full min-h-toque-md flex-col gap-0.5 px-4 py-2.5 text-left',
                    !a.lida_em && 'bg-superficie-sutil',
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-texto">
                    <Bell aria-hidden className="size-4 shrink-0 text-texto-fraco" />
                    {a.titulo}
                    {!a.lida_em && (
                      <span className="ml-auto shrink-0 text-xs font-normal text-texto-fraco">
                        toque para marcar como lida
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-texto-suave">{a.corpo}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ----- Cockpit de metas ----- */}
      <section aria-label="Cockpit de metas" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Target aria-hidden className="size-5 text-texto-suave" />
          <h2 className="text-lg">Minhas metas</h2>
          <span className="text-sm text-texto-fraco">
            barra = feito · traço = onde o período já deveria estar
          </span>
          <Botao
            variante="primaria"
            tamanho="md"
            icone={<Plus />}
            className="ml-auto"
            onClick={() => {
              setMetaEmEdicao(null)
              setModalAberta(true)
            }}
          >
            Nova meta
          </Botao>
        </div>

        {metas.length === 0 ? (
          <p className="rounded-dm-lg border border-borda bg-superficie p-5 text-sm text-texto-suave">
            Nenhuma meta ainda. Crie a primeira — o andamento conta sozinho, do trabalho já
            registrado.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {metas.map((m) => (
              <CartaoMeta
                key={m.meta_id}
                meta={m}
                agora={agora}
                // D-45: quem criou edita/encerra (o liderado só executa); admin tudo.
                podeMexer={souAdmin || m.criada_por_id === perfil.id}
                aoEditar={() => {
                  setMetaEmEdicao(m)
                  setModalAberta(true)
                }}
                aoEncerrar={() => encerrarMutacao.mutate(m.meta_id)}
              />
            ))}
            {totalMetas > METAS_POR_PAGINA && (
              <Paginacao
                paginaAtual={paginaMetas}
                totalPaginas={Math.ceil(totalMetas / METAS_POR_PAGINA)}
                totalItens={totalMetas}
                porPagina={METAS_POR_PAGINA}
                aoMudarPagina={setPaginaMetas}
                className="rounded-dm-lg border border-borda bg-superficie"
              />
            )}
          </div>
        )}
      </section>

      {modalAberta && (
        <ModalMeta
          key={metaEmEdicao?.meta_id ?? 'nova'}
          aberta={modalAberta}
          aoFechar={() => setModalAberta(false)}
          meta={metaEmEdicao}
        />
      )}
    </div>
  )
}
