import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Papel } from './tipos'

/**
 * Toda conversa de identidade passa pela Edge Function `autenticacao` —
 * o navegador nunca resolve usuário→e-mail nem confere PIN por conta própria.
 */
async function chamar<T>(acao: string, dados: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('autenticacao', {
    body: { acao, ...dados },
  })
  if (error) {
    let mensagem = 'Não consegui falar com o servidor. Confira a internet e tente de novo.'
    if (error instanceof FunctionsHttpError) {
      try {
        const corpo = (await error.context.json()) as { erro?: string }
        if (corpo.erro) mensagem = corpo.erro
      } catch {
        // corpo não era JSON — fica a mensagem genérica
      }
    }
    throw new Error(mensagem)
  }
  return data as T
}

/** SESSAO-41: a mesma porta para quem ainda não entrou (a troca de senha liberada). */
export const chamarAutenticacao = chamar

/** O que o servidor devolve ao abrir a sessão (SESSAO-38: + o nome de usuário). */
interface SessaoAberta {
  access_token: string
  refresh_token: string
  usuario?: string
}

/**
 * Login com nome de usuário OU e-mail (D-21). Abre a sessão no navegador e
 * devolve o nome de usuário de quem entrou (SESSAO-38 — o aparelho lembra).
 */
export async function entrar(identificador: string, senha: string): Promise<{ usuario?: string }> {
  const resposta = await chamar<SessaoAberta>('entrar', { identificador, senha })
  const { error } = await supabase.auth.setSession({
    access_token: resposta.access_token,
    refresh_token: resposta.refresh_token,
  })
  if (error) throw new Error('Não consegui abrir a sessão. Tente de novo.')
  return { usuario: resposta.usuario }
}

export interface InfoConvite {
  nome: string
  usuario: string
  usado: boolean
}

export function conviteInfo(token: string): Promise<InfoConvite> {
  return chamar<InfoConvite>('convite-info', { token })
}

export function trocarSenha(senhaNova: string): Promise<{ ok: boolean }> {
  return chamar<{ ok: boolean }>('trocar-senha', { senha_nova: senhaNova })
}

export interface DadosNovoUsuario {
  nome: string
  email: string
  usuario: string
  cpf: string
  telefone?: string
  papel: Papel
  setores: { setor_id: number; lider?: boolean }[]
  pin?: string
}

export interface UsuarioCriado {
  id: string
  matricula: string
  convite_token: string
}

export function criarUsuario(dados: DadosNovoUsuario): Promise<UsuarioCriado> {
  return chamar<UsuarioCriado>('criar-usuario', { ...dados })
}

/** SESSAO-37 (pedido do dono, 19/10): a caneta da Equipe — o admin edita o cadastro de alguém. */
export interface DadosEdicaoUsuario {
  usuario_id: string
  nome: string
  usuario: string
  email: string
  telefone?: string
  papel: Papel
  setores: { setor_id: number; lider: boolean }[]
}

export function editarUsuario(dados: DadosEdicaoUsuario): Promise<{ ok: boolean; campos: string[] }> {
  return chamar<{ ok: boolean; campos: string[] }>('editar-usuario', { ...dados })
}

export function pinDefinir(usuarioId: string, pin: string): Promise<{ ok: boolean }> {
  return chamar<{ ok: boolean }>('pin-definir', { usuario_id: usuarioId, pin })
}

export interface OperadorIdentificado {
  usuario_id: string
  nome: string
  matricula: string
  papel: Papel
  foto_caminho?: string | null
}

export function pinVerificar(identificador: string, pin: string): Promise<OperadorIdentificado> {
  return chamar<OperadorIdentificado>('pin-verificar', { identificador, pin })
}

// ---------------------------------------------------------------------------
// SESSAO-36 (D-146) — o PIN identifica sozinho; o tablet entra pelo setor
// ---------------------------------------------------------------------------

/** PIN duplicado de antes da regra: a ação pede confirmar o nome (resposta 2). */
export interface PinDuplicado {
  duplicado: { usuario_id: string; nome: string; matricula: string; foto_caminho: string | null }[]
}

/** Identifica a pessoa SÓ pelo PIN (sem clicar no nome). */
export function pinIdentificar(pin: string): Promise<OperadorIdentificado | PinDuplicado> {
  return chamar<OperadorIdentificado | PinDuplicado>('pin-identificar', { pin })
}

/** A entrada do modo tablet: o PIN do SETOR abre a sessão da conta do tablet. */
export async function tabletEntrar(
  pin: string,
): Promise<{ setor: { id: number; nome: string; codigo: string } }> {
  const resposta = await chamar<{
    access_token: string
    refresh_token: string
    setor: { id: number; nome: string; codigo: string }
  }>('tablet-entrar', { pin })
  const { error } = await supabase.auth.setSession({
    access_token: resposta.access_token,
    refresh_token: resposta.refresh_token,
  })
  if (error) throw new Error('Não consegui abrir a sessão do tablet. Tente de novo.')
  return { setor: resposta.setor }
}

/** O admin dá (ou troca) o PIN de entrada do tablet de um setor. */
export function setorPinDefinir(setorId: number, pin: string): Promise<{ ok: boolean }> {
  return chamar<{ ok: boolean }>('setor-pin-definir', { setor_id: setorId, pin })
}

/**
 * SESSAO-37 (D-147): confere o PIN de um setor SEM abrir sessão — a pessoa da
 * linha de produção digita o PIN do setor que quer espiar e a tela abre.
 */
export function setorPinConferir(
  pin: string,
): Promise<{ setor: { id: number; nome: string; codigo: string } }> {
  return chamar<{ setor: { id: number; nome: string; codigo: string } }>('setor-pin-conferir', {
    pin,
  })
}

/**
 * No computador: usuário (ou e-mail) + PIN para quem nunca criou senha (cai na
 * troca obrigatória). SESSAO-38: aceita o nome de usuário — `email` vai junto
 * só para a versão anterior do servidor (que lia apenas ele) seguir valendo.
 */
export async function entrarPin(identificador: string, pin: string): Promise<{ usuario?: string }> {
  const resposta = await chamar<SessaoAberta>('entrar-pin', {
    identificador,
    email: identificador,
    pin,
  })
  const { error } = await supabase.auth.setSession({
    access_token: resposta.access_token,
    refresh_token: resposta.refresh_token,
  })
  if (error) throw new Error('Não consegui abrir a sessão. Tente de novo.')
  return { usuario: resposta.usuario }
}

// ---------------------------------------------------------------------------
// Arquivar e excluir usuário (SESSAO-22 / D-49) — RPCs com o gate no banco
// (só admin). As regras de verdade vivem lá; o front só mostra a mensagem.
// ---------------------------------------------------------------------------

export interface ResumoArquivamento {
  execucoes_encerradas: number
  cards_realocados: number
  tarefas_realocadas: number
}

/**
 * Arquiva: tudo fica no nome da pessoa; execução aberta encerra e as
 * pendências (cards delegados, tarefas abertas) passam ao líder direto.
 */
export async function arquivarUsuario(usuarioId: string): Promise<ResumoArquivamento> {
  const { data, error } = await supabase.rpc('plt_fn_arquivar_usuario', {
    p_usuario_id: usuarioId,
  })
  if (error) throw new Error(`Não deu para arquivar: ${error.message}`)
  return data as ResumoArquivamento
}

/** Reativa um usuário arquivado (as pendências realocadas não voltam). */
export async function desarquivarUsuario(usuarioId: string): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_desarquivar_usuario', {
    p_usuario_id: usuarioId,
  })
  if (error) throw new Error(`Não deu para reativar: ${error.message}`)
}

/**
 * Exclui DE FATO um usuário sem história (linha, vínculos, tarefas dele, foto
 * e conta de login). Com história, o banco recusa e aponta o arquivar.
 *
 * A foto sai daqui pelo Storage API (o banco não deixa apagar storage por SQL)
 * — melhor esforço: foto órfã não pode impedir a exclusão do cadastro.
 */
export async function excluirUsuario(usuarioId: string): Promise<void> {
  try {
    const pasta = `perfis/${usuarioId}`
    const { data: arquivos } = await supabase.storage.from('plt-imagens').list(pasta)
    if (arquivos && arquivos.length > 0) {
      await supabase.storage
        .from('plt-imagens')
        .remove(arquivos.map((a) => `${pasta}/${a.name}`))
    }
  } catch {
    // sem foto, ou sem permissão de storage — a exclusão do cadastro segue
  }
  const { error } = await supabase.rpc('plt_fn_excluir_usuario', {
    p_usuario_id: usuarioId,
  })
  if (error) throw new Error(error.message)
}
