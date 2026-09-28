import { useState } from 'react'
import type { UIEvent } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, UserMinus, UserPlus } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import {
  adicionarMembros,
  buscarMembros,
  definirEscritor,
  POR_PAGINA_PESSOAS,
  removerMembro,
  renomearCanal,
} from '../api'
import { atualizarConversa } from '../cache'
import type { CacheConversas } from '../cache'
import { chaveConversa, chaveConversas } from '../consultas'
import type { ConversaResumo, Pessoa } from '../tipos'
import { AvatarChat } from './AvatarChat'
import { SeletorPessoas } from './SeletorPessoas'

/**
 * Quem está na conversa (SESSAO-26), 10 por página.
 *  - Canal: quem administra renomeia, põe e tira pessoas (o banco confere).
 *  - Avisos gerais: o admin decide QUEM MAIS escreve (resposta 3 do dono) —
 *    admin escreve sempre.
 */
export function ModalMembros({
  eu,
  resumo,
  souAdmin,
  aberto,
  aoFechar,
}: {
  eu: string
  resumo: ConversaResumo
  souAdmin: boolean
  aberto: boolean
  aoFechar: () => void
}) {
  const clienteQuery = useQueryClient()
  const notificar = useNotificacao()
  const ehAvisos = resumo.tipo === 'avisos'
  const podeGerir = ehAvisos ? souAdmin : resumo.administra
  const [adicionando, setAdicionando] = useState(false)
  const [escolhidos, setEscolhidos] = useState<Pessoa[]>([])
  const [nome, setNome] = useState<string | null>(null)

  const chaveMembros = ['chat', eu, 'membros', resumo.conversa_id, ehAvisos ? 'escritor' : 'todos']
  const membros = useInfiniteQuery({
    queryKey: chaveMembros,
    queryFn: ({ pageParam }) =>
      buscarMembros({
        conversaId: resumo.conversa_id,
        pagina: pageParam,
        papel: ehAvisos ? 'escritor' : undefined,
      }),
    initialPageParam: 0,
    getNextPageParam: (ultima, todas) =>
      todas.length * POR_PAGINA_PESSOAS < ultima.total ? todas.length : undefined,
    enabled: aberto,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
  const lista = membros.data?.pages.flatMap((p) => p.membros) ?? []
  const total = membros.data?.pages[0]?.total ?? 0

  function mexerNoResumo(mudanca: Partial<ConversaResumo>) {
    clienteQuery.setQueryData<CacheConversas>(chaveConversas(eu), (c) =>
      c ? atualizarConversa(c, resumo.conversa_id, mudanca) : c,
    )
    clienteQuery.setQueryData<ConversaResumo | null>(chaveConversa(eu, resumo.conversa_id), (r) =>
      r ? { ...r, ...mudanca } : r,
    )
  }
  const aoErro = (titulo: string) => (e: Error) =>
    notificar({ titulo, descricao: e.message, tom: 'danificado' })
  const relerMembros = () => clienteQuery.resetQueries({ queryKey: chaveMembros })

  const renomear = useMutation({
    mutationFn: (novo: string) => renomearCanal(resumo.conversa_id, novo),
    onSuccess: (_, novo) => {
      mexerNoResumo({ titulo: novo })
      setNome(null)
      notificar({ titulo: 'Canal renomeado', tom: 'perfeito' })
    },
    onError: aoErro('Não deu para renomear'),
  })

  const adicionar = useMutation({
    mutationFn: async (pessoas: Pessoa[]) => {
      if (ehAvisos) {
        for (const p of pessoas) await definirEscritor(p.id, true)
        return pessoas.length
      }
      return adicionarMembros(resumo.conversa_id, pessoas.map((p) => p.id))
    },
    onSuccess: async (quantos) => {
      if (!ehAvisos) mexerNoResumo({ membros: resumo.membros + quantos })
      setEscolhidos([])
      setAdicionando(false)
      await relerMembros()
      notificar({
        titulo: ehAvisos ? 'Liberado para escrever nos avisos' : 'Pessoas adicionadas',
        tom: 'perfeito',
      })
    },
    onError: aoErro('Não deu para adicionar'),
  })

  const tirar = useMutation({
    mutationFn: (usuarioId: string) =>
      ehAvisos ? definirEscritor(usuarioId, false) : removerMembro(resumo.conversa_id, usuarioId),
    onSuccess: async () => {
      if (!ehAvisos) mexerNoResumo({ membros: Math.max(1, resumo.membros - 1) })
      await relerMembros()
    },
    onError: aoErro('Não deu para tirar'),
  })

  function aoRolar(evento: UIEvent<HTMLUListElement>) {
    const alvo = evento.currentTarget
    if (alvo.scrollHeight - alvo.scrollTop - alvo.clientHeight < 60 && membros.hasNextPage && !membros.isFetchingNextPage) {
      void membros.fetchNextPage()
    }
  }

  const titulo = ehAvisos ? 'Quem escreve nos avisos' : 'Pessoas do canal'
  const descricao = ehAvisos
    ? 'Todos leem os Avisos gerais. Os admins escrevem sempre; aqui ficam as outras pessoas liberadas.'
    : `${resumo.membros} pessoa${resumo.membros === 1 ? '' : 's'} no canal.`

  return (
    <Modal aberto={aberto} aoFechar={(v) => !v && aoFechar()} titulo={titulo} descricao={descricao}>
      <div className="flex flex-col gap-4">
        {!ehAvisos && resumo.administra && (
          <div className="flex flex-col gap-2">
            {nome === null ? (
              <Botao
                variante="secundaria"
                tamanho="sm"
                icone={<Pencil />}
                className="self-start"
                onClick={() => setNome(resumo.titulo ?? '')}
              >
                Mudar o nome do canal
              </Botao>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Campo
                    rotulo="Nome do canal"
                    maxLength={60}
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </div>
                <Botao
                  icone={<Check />}
                  carregando={renomear.isPending}
                  disabled={!nome.trim()}
                  onClick={() => renomear.mutate(nome.trim())}
                >
                  Salvar
                </Botao>
                <Botao variante="fantasma" onClick={() => setNome(null)}>
                  Cancelar
                </Botao>
              </div>
            )}
          </div>
        )}

        <ul
          onScroll={aoRolar}
          aria-label={titulo}
          className="flex max-h-[min(20rem,40dvh)] flex-col overflow-y-auto rounded-dm border border-borda"
        >
          {membros.isPending && <li className="px-3 py-4 text-sm text-texto-fraco">Carregando…</li>}
          {!membros.isPending && lista.length === 0 && (
            <li className="px-3 py-4 text-sm text-texto-fraco">
              {ehAvisos ? 'Por enquanto, só os admins escrevem.' : 'Ninguém no canal.'}
            </li>
          )}
          {lista.map((m) => (
            <li
              key={m.id}
              className="flex min-h-toque-md items-center gap-3 border-b border-borda px-3 py-2 last:border-b-0"
            >
              <AvatarChat nome={m.nome} foto={m.foto_caminho} tamanho="sm" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-texto">
                  {m.nome}
                  {m.id === eu && ' (você)'}
                </span>
                {m.papel === 'administrador' && (
                  <span className="text-xs text-texto-suave">administra o canal</span>
                )}
                {!m.ativo && <span className="text-xs text-texto-fraco">arquivado</span>}
              </span>
              {podeGerir && m.id !== eu && (
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  icone={<UserMinus />}
                  aria-label={ehAvisos ? `Tirar a liberação de ${m.nome}` : `Tirar ${m.nome} do canal`}
                  className="toque-seguro px-2"
                  carregando={tirar.isPending && tirar.variables === m.id}
                  onClick={() => tirar.mutate(m.id)}
                />
              )}
            </li>
          ))}
          {membros.hasNextPage && (
            <li className="p-2">
              <Botao
                variante="fantasma"
                tamanho="sm"
                larguraTotal
                carregando={membros.isFetchingNextPage}
                onClick={() => void membros.fetchNextPage()}
              >
                Ver mais ({total - lista.length})
              </Botao>
            </li>
          )}
        </ul>

        {podeGerir &&
          (adicionando ? (
            <div className="flex flex-col gap-3 rounded-dm-lg border border-borda p-3">
              <SeletorPessoas
                eu={eu}
                multiplo
                selecionados={escolhidos.map((p) => p.id)}
                ocultar={lista.map((m) => m.id)}
                aoAlternar={(pessoa) =>
                  setEscolhidos((atual) =>
                    atual.some((p) => p.id === pessoa.id)
                      ? atual.filter((p) => p.id !== pessoa.id)
                      : [...atual, pessoa],
                  )
                }
              />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Botao variante="secundaria" onClick={() => setAdicionando(false)}>
                  Cancelar
                </Botao>
                <Botao
                  icone={<UserPlus />}
                  carregando={adicionar.isPending}
                  disabled={escolhidos.length === 0}
                  onClick={() => adicionar.mutate(escolhidos)}
                >
                  {ehAvisos ? 'Liberar para escrever' : 'Adicionar ao canal'}
                  {escolhidos.length > 0 ? ` (${escolhidos.length})` : ''}
                </Botao>
              </div>
            </div>
          ) : (
            <Botao
              variante="secundaria"
              icone={<UserPlus />}
              className="self-start"
              onClick={() => setAdicionando(true)}
            >
              {ehAvisos ? 'Liberar mais alguém' : 'Adicionar pessoas'}
            </Botao>
          ))}
      </div>
    </Modal>
  )
}
