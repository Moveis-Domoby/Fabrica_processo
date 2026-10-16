import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { acertarRelogio, pedirReprise, topicoDaPessoa } from '@/chat/canais'
import { chaveConversas } from '@/chat/consultas'
import { montarPaginaConversas } from '@/chat/api'
import type { ConversaResumo } from '@/chat/tipos'
import type { Aviso } from '@/notificacoes/api'
import type { Tarefa } from '@/afazeres/api'
import type { MetaPainel } from '@/metas/api'
import type { Card, ExecucaoAberta, Setor } from '@/kanban/tipos'
import type { Perfil, VinculoSetor } from './tipos'

/**
 * A ABERTURA DO APP NUMA REQUISIÇÃO (SESSAO-32 · Lei §2): a porta
 * plt_fn_abertura devolve tudo o que a primeira tela mostra — perfil, vínculos,
 * setores (menu), os avisos do sino, a 1ª página do chat, a bolinha e, quando a
 * 1ª tela é o Meu Painel, os dados dele — e grava, no mesmo gesto, a presença
 * e o registro da navegação. Antes: ~15 requisições, três delas em fila.
 *
 * Cada pedaço entra no cache com a MESMA chave que a tela já usa (E-22: uma
 * chave, um formato) — a tela encontra o dado e não pede de novo. O canal
 * pessoal entra pedindo a reprise desde o instante da leitura: o que saiu
 * entre ler e começar a ouvir chega igual (o chat e o sino ignoram repetido).
 */
export interface Abertura {
  agora_ms: number
  perfil: Perfil | null
  vinculos: VinculoSetor[]
  setores?: Setor[]
  avisos?: Aviso[]
  conversas?: ConversaResumo[]
  tarefas?: Tarefa[]
  execucoes?: ExecucaoAberta[]
  meu_painel?: {
    cards: Card[]
    setores_chave: string
    tarefas_sistema: Tarefa[]
    fila_prioridade: unknown
    metas: MetaPainel[]
  }
}

/** A 1ª rota que a casca vai mostrar ('/' e '/entrar' levam ao Meu Painel). */
function rotaInicial(): string {
  const caminho = window.location.pathname
  return caminho === '/' || caminho === '/entrar' ? '/inicio/meu-painel' : caminho
}

/** A navegação da 1ª rota já foi registrada pela abertura (a casca não repete). */
let navegacaoDaAbertura: string | null = null
export function navegacaoJaRegistrada(rota: string): boolean {
  if (navegacaoDaAbertura !== null && navegacaoDaAbertura === rota) {
    navegacaoDaAbertura = null
    return true
  }
  return false
}

export async function abrirPlataforma(primeira: boolean): Promise<Abertura> {
  const rota = primeira ? rotaInicial() : null
  const { data, error } = await supabase.rpc('plt_fn_abertura', {
    p_rota: rota,
    p_meu_painel: rota !== null && rota.startsWith('/inicio/meu-painel'),
  })
  if (error) throw new Error(`Não deu para abrir a plataforma: ${error.message}`)
  const abertura = data as Abertura
  if (rota && abertura.perfil) navegacaoDaAbertura = rota
  return abertura
}

/** Cada pedaço da abertura no cache, com a chave e o formato que a tela usa. */
export function semearCache(clienteQuery: QueryClient, abertura: Abertura, primeira: boolean) {
  acertarRelogio(abertura.agora_ms)
  const eu = abertura.perfil?.id
  if (!eu) return
  if (abertura.setores) clienteQuery.setQueryData(['setores'], abertura.setores)
  if (abertura.avisos) clienteQuery.setQueryData(['avisos', eu], abertura.avisos)
  if (abertura.conversas) {
    clienteQuery.setQueryData(chaveConversas(eu), {
      pages: [montarPaginaConversas(abertura.conversas, true)],
      pageParams: [null],
    })
  }
  if (abertura.tarefas) clienteQuery.setQueryData(['afazeres', 'tarefas', eu], abertura.tarefas)
  if (abertura.execucoes) clienteQuery.setQueryData(['meu-painel', 'execucoes', eu], abertura.execucoes)
  const painel = abertura.meu_painel
  if (painel) {
    clienteQuery.setQueryData(['meu-painel', 'delegados', eu], painel.cards)
    if (painel.setores_chave) {
      clienteQuery.setQueryData(['meu-painel', 'tarefas-sistema', painel.setores_chave], painel.tarefas_sistema)
    }
    const fila = Array.isArray(painel.fila_prioridade)
      ? painel.fila_prioridade.filter((c): c is string => typeof c === 'string')
      : []
    clienteQuery.setQueryData(['fila-prioridade', eu], fila)
    // numeric chega como número no JSON; o mesmo acerto de buscarMetasPainel
    clienteQuery.setQueryData(
      ['metas', 'painel', 1],
      painel.metas.map((m) => ({ ...m, alvo: Number(m.alvo), progresso: Number(m.progresso) })),
    )
  }
  // Nada escapa entre a leitura e o canal pessoal (com folga de 5 s).
  if (primeira) pedirReprise(topicoDaPessoa(eu), abertura.agora_ms - 5_000)
}
