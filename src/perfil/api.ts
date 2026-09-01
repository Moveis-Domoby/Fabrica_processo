import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Tema } from './tema'

async function chamarAutenticacao<T>(acao: string, dados: Record<string, unknown>): Promise<T> {
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

export interface DadosPerfil {
  nome: string
  usuario: string
  email: string
  telefone: string
}

/**
 * Dados cadastrais do Meu Perfil (D-43): nome, nome de usuário (o de login,
 * que também é o exibido), e-mail e telefone. Passa pela Edge Function porque
 * usuário/e-mail mexem também na conta de auth — o navegador não faz isso só.
 */
export function atualizarPerfil(dados: DadosPerfil): Promise<{ ok: boolean }> {
  return chamarAutenticacao<{ ok: boolean }>('atualizar-perfil', { ...dados })
}

/** Troca de senha do Meu Perfil: exige a senha atual (diferente da troca
 *  obrigatória do primeiro login, que nasce da senha padrão). */
export function alterarSenha(senhaAtual: string, senhaNova: string): Promise<{ ok: boolean }> {
  return chamarAutenticacao<{ ok: boolean }>('alterar-senha', {
    senha_atual: senhaAtual,
    senha_nova: senhaNova,
  })
}

/** O tema persiste por usuário (D-41). A coluna é liberada para a própria linha. */
export async function salvarTema(usuarioId: string, tema: Tema): Promise<void> {
  const { error } = await supabase.from('plt_usuarios').update({ tema }).eq('id', usuarioId)
  if (error) throw new Error('Não consegui guardar o tema. Tente de novo.')
}

/**
 * Foto de perfil (D-43): a própria pessoa sobe a sua, na SUA pasta do bucket
 * (perfis/{id}/…). Nome com carimbo de hora para a troca aparecer na hora
 * (URL nova); a foto antiga é removida em seguida, sem drama se falhar.
 */
export async function enviarFotoPerfil(
  usuarioId: string,
  arquivo: File,
  caminhoAntigo: string | null,
): Promise<string> {
  const extensao = (arquivo.name.split('.').pop() ?? 'jpg').toLowerCase()
  const caminho = `perfis/${usuarioId}/foto-${Date.now()}.${extensao}`

  const { error: erroEnvio } = await supabase.storage
    .from('plt-imagens')
    .upload(caminho, arquivo, { contentType: arquivo.type || 'image/jpeg' })
  if (erroEnvio) throw new Error('Não consegui enviar a foto. Tente uma imagem menor.')

  const { error: erroGravar } = await supabase
    .from('plt_usuarios')
    .update({ foto_caminho: caminho })
    .eq('id', usuarioId)
  if (erroGravar) throw new Error('A foto subiu, mas não consegui gravá-la no cadastro.')

  if (caminhoAntigo) {
    void supabase.storage.from('plt-imagens').remove([caminhoAntigo])
  }
  return caminho
}

/** Tirar a foto do perfil (volta às iniciais). */
export async function removerFotoPerfil(usuarioId: string, caminho: string): Promise<void> {
  const { error } = await supabase
    .from('plt_usuarios')
    .update({ foto_caminho: null })
    .eq('id', usuarioId)
  if (error) throw new Error('Não consegui remover a foto. Tente de novo.')
  void supabase.storage.from('plt-imagens').remove([caminho])
}

export function urlDaFoto(caminho: string | null): string | null {
  if (!caminho) return null
  return supabase.storage.from('plt-imagens').getPublicUrl(caminho).data.publicUrl
}
