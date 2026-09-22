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

/** Login com nome de usuário OU e-mail (D-21). Abre a sessão no navegador. */
export async function entrar(identificador: string, senha: string): Promise<void> {
  const tokens = await chamar<{ access_token: string; refresh_token: string }>('entrar', {
    identificador,
    senha,
  })
  const { error } = await supabase.auth.setSession(tokens)
  if (error) throw new Error('Não consegui abrir a sessão. Tente de novo.')
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

export function pinDefinir(usuarioId: string, pin: string): Promise<{ ok: boolean }> {
  return chamar<{ ok: boolean }>('pin-definir', { usuario_id: usuarioId, pin })
}

export interface OperadorIdentificado {
  usuario_id: string
  nome: string
  matricula: string
  papel: Papel
}

export function pinVerificar(identificador: string, pin: string): Promise<OperadorIdentificado> {
  return chamar<OperadorIdentificado>('pin-verificar', { identificador, pin })
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
