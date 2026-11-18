import type { PostgrestError } from '@supabase/supabase-js'
import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { contextoDaCarga } from '@/lib/recarga'
import type { ContextoDaCarga } from '@/lib/recarga'
import { acertarRelogio, pedirReprise, topicoDaPessoa } from '@/chat/canais'
import { chaveConversas } from '@/chat/consultas'
import { montarPaginaConversas } from '@/chat/api'
import type { ConversaResumo } from '@/chat/tipos'
import type { Aviso } from '@/notificacoes/api'
import type { Tarefa } from '@/afazeres/api'
import type { MetaPainel } from '@/metas/api'
import {
  acertarMetas,
  CHAVE_METAS_PAGINA_1,
  chaveFilaPrioridade,
  chaveMeuTrabalho,
  limparFila,
  montarMeuTrabalho,
} from '@/afazeres/meuTrabalho'
import type { MeuTrabalho } from '@/afazeres/meuTrabalho'
import type { Card, ExecucaoAberta, Setor } from '@/kanban/tipos'
import type { ReguaTempo } from '@/kanban/tempoUtil'
import { ehCorEtiqueta } from '@/utilitarios/tipos'
import type { CampoCustomizado, Etiqueta } from '@/utilitarios/tipos'
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
  /** migration 80: os catálogos dos quadros, do PCP, dos pedidos e da janela do card. */
  etiquetas?: Etiqueta[]
  campos?: CampoCustomizado[]
  /** SESSAO-38 (D-172): a régua do tempo útil (o horário de cada setor) — o card conta só o expediente. */
  regua_tempo?: ReguaTempo | null
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

/**
 * SESSAO-48 (frente 5): o porquê vai UMA vez por página — na 1ª abertura que
 * a trilha registrou. Trocar de conta sem recarregar (entrar de novo depois de
 * sair, a troca vinda de outra aba) é navegação, não abertura da página.
 */
let aberturaDaPaginaRegistrada = false

function chamarAbertura(rota: string | null, contexto: ContextoDaCarga | null) {
  return supabase.rpc('plt_fn_abertura', {
    p_rota: rota,
    p_meu_painel: rota !== null && rota.startsWith('/inicio/meu-painel'),
    ...(contexto ? { p_contexto: contexto } : {}),
  })
}

/** O banco ainda sem o 3º argumento da porta (a tela nova chegou antes da migration). */
function portaSemContexto(erro: PostgrestError): boolean {
  return erro.code === 'PGRST202'
}

export async function abrirPlataforma(primeira: boolean): Promise<Abertura> {
  const rota = primeira ? rotaInicial() : null
  // SESSAO-48 (frente 5): a 1ª abertura desta página diz por que ela abriu —
  // navegou, atualizou, voltou, a aba descartada, ou a própria plataforma
  // recarregou (versão nova, pedaço sumido, troca de setor). Vai para a trilha.
  const contexto = rota !== null && !aberturaDaPaginaRegistrada ? contextoDaCarga() : null
  let { data, error } = await chamarAbertura(rota, contexto)
  if (error && contexto && portaSemContexto(error)) {
    // a tela nova tolera o banco de antes por alguns minutos (Lei §7.6): a
    // abertura de sempre, só sem o porquê
    ;({ data, error } = await chamarAbertura(rota, null))
  }
  if (error) throw new Error(`Não deu para abrir a plataforma: ${error.message}`)
  const abertura = data as Abertura
  if (rota && abertura.perfil) {
    navegacaoDaAbertura = rota
    if (contexto) aberturaDaPaginaRegistrada = true
  }
  return abertura
}

/** Só para os testes: uma página recém-aberta. */
export function reiniciarAberturaParaTeste(): void {
  aberturaDaPaginaRegistrada = false
  navegacaoDaAbertura = null
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
  // SESSAO-55: o trabalho da pessoa é UMA chave (tarefas, bolinha e — quando a
  // 1ª tela é o Meu Painel — os cards delegados e as tarefas do Sistema); o
  // retrato diz para qual tela foi lido.
  const painel = abertura.meu_painel
  if (abertura.tarefas && abertura.execucoes) {
    const guardado = clienteQuery.getQueryData<MeuTrabalho>(chaveMeuTrabalho(eu))
    clienteQuery.setQueryData(
      chaveMeuTrabalho(eu),
      !painel && guardado && guardado.tela !== 'bolha'
        ? // a releitura do perfil (sem rota) com uma tela pessoal aberta: só o
          // que veio muda — os cards e o resto do retrato da tela ficam
          { ...guardado, tarefas: abertura.tarefas, execucoes: abertura.execucoes }
        : montarMeuTrabalho({
            tela: painel ? 'painel' : 'bolha',
            tarefas: abertura.tarefas,
            execucoes: abertura.execucoes,
            cards: painel?.cards,
            tarefas_sistema: painel?.tarefas_sistema,
          }),
    )
  }
  // o mesmo acerto de cor de buscarEtiquetas (cor desconhecida vira cinza)
  if (abertura.etiquetas) {
    clienteQuery.setQueryData(
      ['etiquetas'],
      abertura.etiquetas.map((e) => ({ ...e, cor: ehCorEtiqueta(e.cor) ? e.cor : 'cinza' })),
    )
  }
  if (abertura.campos) clienteQuery.setQueryData(['campos'], abertura.campos)
  if (abertura.regua_tempo) clienteQuery.setQueryData(['regua-tempo'], abertura.regua_tempo)
  if (painel) {
    clienteQuery.setQueryData(chaveFilaPrioridade(eu), limparFila(painel.fila_prioridade))
    // numeric chega como número no JSON; o mesmo acerto de buscarMetasPainel
    clienteQuery.setQueryData(CHAVE_METAS_PAGINA_1, acertarMetas(painel.metas))
  }
  // Nada escapa entre a leitura e o canal pessoal (com folga de 5 s).
  if (primeira) pedirReprise(topicoDaPessoa(eu), abertura.agora_ms - 5_000)
}
