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
