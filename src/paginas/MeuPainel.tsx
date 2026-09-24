import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronUp,
  ListChecks,
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
import { buscarSetores } from '@/kanban/api'
import { rotaDoSetor } from '@/navegacao/rotas'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import {
  buscarFilaPrioridade,
  ehTarefaPessoal,
  meusCards,
  minhasTarefas,
  salvarFilaPrioridade,
  tarefasDoSistema,
} from '@/afazeres/api'
import {
  buscarMetasPainel,
  encerrarMeta,
  minhasExecucoesAbertas,
} from '@/metas/api'
import type { MetaPainel } from '@/metas/api'
import type { Tarefa } from '@/afazeres/api'
import { ModalTarefa } from '@/afazeres/ModalTarefa'
import { ModalMeta } from '@/metas/ModalMeta'
import { CartaoMeta } from '@/metas/CartaoMeta'

const ATUALIZA_A_CADA = 15_000
const METAS_POR_PAGINA = 20

interface ItemFila {
  /** "t:{id}" para tarefa · "c:{id}" para card delegado — a chave guardada. */
  chave: string
  texto: string
  origem: 'delegada' | 'minha' | 'card'
  /** Card de produção navega para o quadro; tarefa abre o preview. */
  para?: string
  tarefa?: Tarefa
  /** Ordem de cadastro (ms) — o desempate de quem não está na ordem salva. */
  cadastro: number
}

/**
 * Meu Painel 2.0 (SESSAO-23, revisão da D-37): as três filas pessoais —
 * "Delegados a mim", "Meus afazeres" e a "Fila de prioridade" reordenável.
 * "Qualidade a atestar" virou tarefa do Sistema (aparece em Delegados a mim);
 * "Avisos recentes" saiu — o sino tem o "Ver todos". A ordem da fila é
 * preferência de EXIBIÇÃO do usuário: reordenar não muda dado de tarefa.
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

  // ----- as três filas -----
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
  const { data: tarefasSistema = [] } = useQuery({
    queryKey: ['meu-painel', 'tarefas-sistema', meusSetorIds.join(',')],
    queryFn: () => tarefasDoSistema(meusSetorIds),
    enabled: meusSetorIds.length > 0,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: execucoes = [] } = useQuery({
    queryKey: ['meu-painel', 'execucoes', perfil?.id],
    queryFn: () => minhasExecucoesAbertas(perfil!.id),
    enabled: perfil !== null,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: ordemSalva = [] } = useQuery({
    queryKey: ['fila-prioridade', perfil?.id],
    queryFn: () => buscarFilaPrioridade(perfil!.id),
    enabled: perfil !== null,
  })

  const tarefasDelegadas = useMemo(
    () => tarefas.filter((t) => !ehTarefaPessoal(t)),
    [tarefas],
  )
  const tarefasProprias = useMemo(() => tarefas.filter((t) => ehTarefaPessoal(t)), [tarefas])
  const cardPorId = useMemo(
    () => new Map(cardsDelegados.map((c) => [c.id, c])),
    [cardsDelegados],
  )

  // A Fila de prioridade: delegadas + minhas + cards delegados, na ordem salva;
  // quem não está na ordem entra no fim, por ordem de cadastro. Tarefa do
  // Sistema fica FORA da fila (resposta 3 do dono) — ela vive em Delegados.
  const fila: ItemFila[] = useMemo(() => {
    const itens: ItemFila[] = [
      ...tarefasDelegadas.map((t) => ({
        chave: `t:${t.id}`,
        texto: t.titulo,
        origem: 'delegada' as const,
        tarefa: t,
        cadastro: new Date(t.criada_em).getTime(),
      })),
      ...tarefasProprias.map((t) => ({
        chave: `t:${t.id}`,
        texto: t.titulo,
        origem: 'minha' as const,
        tarefa: t,
        cadastro: new Date(t.criada_em).getTime(),
      })),
      ...cardsDelegados.map((c) => {
        const setor = c.setor_atual_id ? setorPorId.get(c.setor_atual_id) : undefined
        return {
          chave: `c:${c.id}`,
          texto:
            (c.item_descricao ?? `Unidade ${c.indice_unidade}/${c.total_unidades}`) +
            (setor ? ` · ${setor.nome}` : ''),
          origem: 'card' as const,
          para: setor ? rotaDoSetor(setor.codigo) : '/inicio/afazeres',
          cadastro: new Date(c.delegado_em ?? c.desde ?? 0).getTime(),
        }
      }),
    ]
    const posicao = new Map(ordemSalva.map((chave, i) => [chave, i]))
    return itens.sort((a, b) => {
      const pa = posicao.get(a.chave)
      const pb = posicao.get(b.chave)
      if (pa !== undefined && pb !== undefined) return pa - pb
      if (pa !== undefined) return -1
      if (pb !== undefined) return 1
      return a.cadastro - b.cadastro
    })
  }, [tarefasDelegadas, tarefasProprias, cardsDelegados, ordemSalva, setorPorId])

  const reordenar = useMutation({
    mutationFn: (chaves: string[]) => salvarFilaPrioridade(perfil!.id, chaves),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['fila-prioridade'] }),
    onError: (excecao: unknown) =>
      notificar({
        titulo: 'Não deu para guardar a ordem',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  function mover(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao
    if (destino < 0 || destino >= fila.length) return
    const chaves = fila.map((i) => i.chave)
    ;[chaves[indice], chaves[destino]] = [chaves[destino], chaves[indice]]
    reordenar.mutate(chaves)
  }

  // ----- cockpit de metas (como a S14 entregou) -----
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

  // O preview da demanda (pedido do dono, 23/09): clicar abre o modal com
  // iniciar/parar/editar/concluir ali mesmo — nada de pular para outra tela.
  const [tarefaAbertaId, setTarefaAbertaId] = useState<number | null>(null)
  const tarefaAberta =
    [...tarefas, ...tarefasSistema].find((t) => t.id === tarefaAbertaId) ?? null
  const linkQuadroDaAberta =
    tarefaAberta?.origem === 'sistema' && tarefaAberta.setor_id
      ? rotaDoSetor(setorPorId.get(tarefaAberta.setor_id)?.codigo ?? '')
      : null

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

  // Tempo real: mudança em card (mover/iniciar/finalizar) mexe em filas e
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

  const separadores = [
    {
      chave: 'delegados',
      icone: UserRound,
      titulo: 'Delegados a mim',
      total: tarefasDelegadas.length + tarefasSistema.length + cardsDelegados.length,
      descricao: 'o que outros — ou o Sistema — colocaram com você',
      itens: [
        ...tarefasSistema.map((t) => ({
          id: `ts-${t.id}`,
          texto: `Sistema · ${t.titulo}`,
          tarefa: t,
        })),
        ...tarefasDelegadas.map((t) => ({
          id: `td-${t.id}`,
          texto: t.titulo,
          tarefa: t,
        })),
        ...cardsDelegados.map((c) => ({
          id: `cd-${c.id}`,
          texto: c.item_descricao ?? `Unidade ${c.indice_unidade}/${c.total_unidades}`,
          para: c.setor_atual_id
            ? rotaDoSetor(setorPorId.get(c.setor_atual_id)?.codigo ?? '')
            : '/inicio/afazeres',
        })),
      ].slice(0, 3),
    },
    {
      chave: 'meus',
      icone: ListTodo,
      titulo: 'Meus afazeres',
      total: tarefasProprias.length,
      descricao: 'as tarefas que você criou para você',
      itens: tarefasProprias.slice(0, 3).map((t) => ({
        id: `m-${t.id}`,
        texto: t.titulo,
        tarefa: t,
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

      {/* ----- Os separadores: delegados · meus · em execução ----- */}
      <section aria-label="O que me espera" className="flex flex-col gap-3">
        <h2 className="text-lg">O que me espera</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {separadores.map((p) => (
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
                      {'tarefa' in item && item.tarefa ? (
                        <button
                          type="button"
                          onClick={() => setTarefaAbertaId(item.tarefa.id)}
                          className="block min-h-toque-md w-full content-center truncate rounded-dm px-1 text-left text-sm text-texto hover:bg-superficie-sutil"
                        >
                          {item.texto}
                        </button>
                      ) : (
                        <Link
                          to={'para' in item ? item.para : '/inicio/afazeres'}
                          className="block min-h-toque-md content-center truncate rounded-dm px-1 text-sm text-texto hover:bg-superficie-sutil"
                        >
                          {item.texto}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ----- Fila de prioridade ----- */}
      <section aria-label="Fila de prioridade" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ListChecks aria-hidden className="size-5 text-texto-suave" />
          <h2 className="text-lg">Fila de prioridade</h2>
          <span className="text-sm text-texto-fraco">
            a sua ordem, só sua — as setas mudam só a exibição
          </span>
        </div>
        {fila.length === 0 ? (
          <p className="rounded-dm-lg border border-borda bg-superficie p-4 text-sm text-texto-suave">
            Nada na fila — tarefas e cards delegados aparecem aqui na ordem em que chegam.
          </p>
        ) : (
          <ol className="flex flex-col overflow-hidden rounded-dm-lg border border-borda bg-superficie">
            {fila.map((item, indice) => (
              <li
                key={item.chave}
                className="flex items-center gap-2 border-b border-borda px-3 py-1.5 last:border-b-0"
              >
                <span className="w-6 shrink-0 text-center text-sm font-semibold text-texto-fraco tabular-nums">
                  {indice + 1}
                </span>
                {item.tarefa ? (
                  <button
                    type="button"
                    onClick={() => setTarefaAbertaId(item.tarefa!.id)}
                    className="min-w-0 flex-1 truncate rounded-dm py-2 text-left text-sm text-texto hover:bg-superficie-sutil"
                  >
                    {item.texto}
                  </button>
                ) : (
                  <Link
                    to={item.para ?? '/inicio/afazeres'}
                    className="min-w-0 flex-1 truncate rounded-dm py-2 text-sm text-texto hover:bg-superficie-sutil"
                  >
                    {item.texto}
                  </Link>
                )}
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                    item.origem === 'card'
                      ? 'bg-acao text-acao-texto'
                      : 'bg-superficie-sutil text-texto-suave',
                  )}
                >
                  {item.origem === 'card' ? 'produção' : item.origem === 'minha' ? 'meu' : 'delegado'}
                </span>
                <span className="flex shrink-0">
                  <button
                    type="button"
                    aria-label={`Subir "${item.texto}" na fila`}
                    disabled={indice === 0 || reordenar.isPending}
                    onClick={() => mover(indice, -1)}
                    className="toque-seguro inline-flex h-toque-md w-toque-md items-center justify-center rounded-dm text-texto-suave hover:bg-superficie-sutil disabled:opacity-30"
                  >
                    <ChevronUp aria-hidden className="size-5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Descer "${item.texto}" na fila`}
                    disabled={indice === fila.length - 1 || reordenar.isPending}
                    onClick={() => mover(indice, 1)}
                    className="toque-seguro inline-flex h-toque-md w-toque-md items-center justify-center rounded-dm text-texto-suave hover:bg-superficie-sutil disabled:opacity-30"
                  >
                    <ChevronDown aria-hidden className="size-5" />
                  </button>
                </span>
              </li>
            ))}
          </ol>
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

      {/* O preview da demanda: iniciar, parar, editar e concluir sem sair daqui. */}
      <ModalTarefa
        tarefa={tarefaAberta}
        aoFechar={() => setTarefaAbertaId(null)}
        linkQuadro={linkQuadroDaAberta}
      />

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
