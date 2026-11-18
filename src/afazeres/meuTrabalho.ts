import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSessao } from '@/autenticacao/sessao-contexto'
import type { Card, ExecucaoAberta } from '@/kanban/tipos'
import type { MetaPainel } from '@/metas/api'
import type { Tarefa } from './api'

/**
 * O TRABALHO DA PESSOA NUMA LEITURA (SESSAO-55 · Lei §2 — a dívida 20).
 *
 * Antes, o aviso do canal da pessoa fazia a tela reler 3 consultas (as tarefas,
 * a bolinha e os cards delegados) — 4 no Meu Painel (as tarefas do Sistema) e,
 * nos Meus afazeres, mais as subtarefas e, em cascata, os pedidos dos cards.
 * Agora é UMA porta (plt_fn_meu_trabalho) e UMA chave de cache: a bolinha, o
 * balão de sugestões, o Meu Painel e os Meus afazeres leem a mesma resposta e
 * cada um recorta o seu pedaço (`select`).
 *
 * A porta só traz o que a tela ABERTA mostra: fora do Meu Painel e dos Meus
 * afazeres, só as tarefas e as execuções (o que a bolinha mostra). A tela que
 * abre e encontra guardado um retrato menor do que o dela pede o dela — uma
 * leitura.
 */
export type TelaDoTrabalho = 'bolha' | 'painel' | 'afazeres'

export interface ContadorSubtarefas {
  mae_id: number
  total: number
  feitas: number
}

export interface MeuTrabalho {
  /** Para qual tela este retrato foi lido — diz o que ele tem. */
  tela: TelaDoTrabalho
  tarefas: Tarefa[]
  execucoes: ExecucaoAberta[]
  /** Os cards delegados à pessoa (Meu Painel e Meus afazeres). */
  cards: Card[]
  /** As tarefas do Sistema dos setores da pessoa (só o Meu Painel). */
  tarefasSistema: Tarefa[]
  /** O "2/5" de cada tarefa, pronto do banco (só os Meus afazeres). */
  subtarefas: ContadorSubtarefas[]
  /** O número do pedido de cada card (só os Meus afazeres). */
  pedidos: { pedido_id: number; numero: number }[]
}

/** O que a porta devolve (e, com `meu_painel`, o que a abertura do app devolve). */
interface RespostaDaPorta {
  tela: TelaDoTrabalho
  tarefas: Tarefa[]
  execucoes: ExecucaoAberta[]
  cards?: Card[]
  tarefas_sistema?: Tarefa[]
  subtarefas?: ContadorSubtarefas[]
  pedidos?: { pedido_id: number; numero: number }[]
  fila_prioridade?: unknown
  metas?: MetaPainel[]
}

/**
 * Mora sob `['afazeres']`: todo gesto que já invalidava os afazeres (criar,
 * iniciar, pausar, concluir, reatribuir…) relê esta chave — uma leitura.
 */
export const chaveMeuTrabalho = (usuarioId: string | undefined) =>
  ['afazeres', 'meu-trabalho', usuarioId] as const

export const chaveFilaPrioridade = (usuarioId: string | undefined) =>
  ['fila-prioridade', usuarioId] as const

export const CHAVE_METAS_PAGINA_1 = ['metas', 'painel', 1] as const

/** A tela pessoal aberta agora (uma por vez — são rotas). Fora delas, a bolinha. */
let telaAberta: TelaDoTrabalho = 'bolha'

export function montarMeuTrabalho(resposta: RespostaDaPorta): MeuTrabalho {
  return {
    tela: resposta.tela,
    tarefas: resposta.tarefas ?? [],
    execucoes: resposta.execucoes ?? [],
    cards: resposta.cards ?? [],
    tarefasSistema: resposta.tarefas_sistema ?? [],
    subtarefas: resposta.subtarefas ?? [],
    pedidos: resposta.pedidos ?? [],
  }
}

/** A fila de prioridade guardada no cadastro: só as chaves em texto. */
export function limparFila(bruta: unknown): string[] {
  return Array.isArray(bruta) ? bruta.filter((c): c is string => typeof c === 'string') : []
}

/** numeric chega como número ou texto no JSON; o mesmo acerto de buscarMetasPainel. */
export function acertarMetas(metas: MetaPainel[]): MetaPainel[] {
  return metas.map((m) => ({ ...m, alvo: Number(m.alvo), progresso: Number(m.progresso) }))
}

async function buscarMeuTrabalho(clienteQuery: QueryClient, usuarioId: string): Promise<MeuTrabalho> {
  const tela = telaAberta
  // O Meu Painel abrindo sem a fila ou as metas guardadas: vêm na mesma leitura.
  // O aviso do trabalho não as relê (a fila só muda no gesto da pessoa; as
  // metas têm o aviso delas).
  const abrir =
    tela === 'painel' &&
    (clienteQuery.getQueryData(chaveFilaPrioridade(usuarioId)) === undefined ||
      clienteQuery.getQueryData(CHAVE_METAS_PAGINA_1) === undefined)
  const { data, error } = await supabase.rpc('plt_fn_meu_trabalho', { p_tela: tela, p_abrir: abrir })
  if (error) throw new Error(`Não deu para carregar o seu trabalho: ${error.message}`)
  const resposta = data as RespostaDaPorta
  if (resposta.fila_prioridade !== undefined)
    clienteQuery.setQueryData(chaveFilaPrioridade(usuarioId), limparFila(resposta.fila_prioridade))
  if (resposta.metas !== undefined)
    clienteQuery.setQueryData(CHAVE_METAS_PAGINA_1, acertarMetas(resposta.metas))
  return montarMeuTrabalho(resposta)
}

/**
 * O trabalho da pessoa, recortado por `recorte`. `tela` diz qual tela pessoal
 * está aberta ('painel' ou 'afazeres'); a bolinha e o balão não dizem nada.
 */
export function useMeuTrabalho<T = MeuTrabalho>(
  recorte?: (trabalho: MeuTrabalho) => T,
  tela: TelaDoTrabalho = 'bolha',
) {
  const { perfil } = useSessao()
  const clienteQuery = useQueryClient()
  const eu = perfil?.id

  // Antes da leitura (este efeito vem antes do da consulta): a porta sabe qual
  // tela está aberta. Ao sair, volta a ser só a bolinha.
  useEffect(() => {
    if (tela === 'bolha') return
    telaAberta = tela
    return () => {
      telaAberta = 'bolha'
    }
  }, [tela])

  const consulta = useQuery({
    queryKey: chaveMeuTrabalho(eu),
    queryFn: () => buscarMeuTrabalho(clienteQuery, eu!),
    enabled: eu !== undefined,
    staleTime: Infinity,
    select: recorte,
  })

  // O guardado é de outra tela (a bolinha, ou a outra tela pessoal): pede o
  // desta — uma leitura. Olha o cache cru (o `select` pode ter recortado a tela).
  const guardado = clienteQuery.getQueryData<MeuTrabalho>(chaveMeuTrabalho(eu))
  const falta = tela !== 'bolha' && guardado !== undefined && guardado.tela !== tela
  const { refetch } = consulta
  useEffect(() => {
    if (falta) void refetch()
  }, [falta, refetch])

  return {
    data: consulta.data,
    /** O retrato desta tela já chegou (as leituras que dependem dele podem olhar o cache). */
    pronto: tela === 'bolha' ? guardado !== undefined : guardado?.tela === tela,
  }
}

/** Só para os testes: nenhuma tela pessoal aberta. */
export function reiniciarMeuTrabalhoParaTeste(): void {
  telaAberta = 'bolha'
}
