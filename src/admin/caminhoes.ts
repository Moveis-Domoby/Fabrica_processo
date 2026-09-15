import { supabase } from '@/lib/supabase'

/**
 * Cadastro de caminhões (SESSAO-15 / D-39). RLS: todo mundo logado lê (a
 * programação precisa escolher o caminhão); só admin escreve. Em uso não se
 * exclui — o banco recusa e a tela oferece arquivar. Foto no bucket
 * `plt-imagens`, pasta `caminhoes/{id}/…`.
 */

export interface Caminhao {
  id: number
  nome: string
  placa: string | null
  capacidade: string | null
  foto_caminho: string | null
  arquivado_em: string | null
  criado_em: string
}

const COLUNAS = 'id, nome, placa, capacidade, foto_caminho, arquivado_em, criado_em'
const BUCKET = 'plt-imagens'

export async function listarCaminhoes(incluirArquivados = false): Promise<Caminhao[]> {
  let consulta = supabase.from('plt_caminhoes').select(COLUNAS).order('nome')
  if (!incluirArquivados) consulta = consulta.is('arquivado_em', null)
  const { data, error } = await consulta
  if (error) throw new Error(`Não deu para carregar os caminhões: ${error.message}`)
  return (data ?? []) as Caminhao[]
}

function traduzirErro(mensagem: string): string {
  if (/plt_caminhoes_placa_uq/i.test(mensagem)) return 'Já existe um caminhão com esta placa.'
  return mensagem
}

export async function criarCaminhao(parametros: {
  nome: string
  placa?: string
  capacidade?: string
  criadoPor: string
}): Promise<number> {
  const { data, error } = await supabase
    .from('plt_caminhoes')
    .insert({
      nome: parametros.nome.trim(),
      placa: parametros.placa?.trim().toUpperCase() || null,
      capacidade: parametros.capacidade?.trim() || null,
      criado_por_id: parametros.criadoPor,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Não deu para cadastrar: ${traduzirErro(error?.message ?? '')}`)
  return (data as { id: number }).id
}

export async function atualizarCaminhao(
  id: number,
  mudancas: { nome?: string; placa?: string | null; capacidade?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('plt_caminhoes')
    .update({
      ...(mudancas.nome !== undefined ? { nome: mudancas.nome.trim() } : {}),
      ...(mudancas.placa !== undefined ? { placa: mudancas.placa?.trim().toUpperCase() || null } : {}),
      ...(mudancas.capacidade !== undefined ? { capacidade: mudancas.capacidade?.trim() || null } : {}),
    })
    .eq('id', id)
  if (error) throw new Error(`Não deu para salvar: ${traduzirErro(error.message)}`)
}

export async function arquivarCaminhao(id: number, arquivar = true): Promise<void> {
  const { error } = await supabase
    .from('plt_caminhoes')
    .update({ arquivado_em: arquivar ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw new Error(`Não deu para ${arquivar ? 'arquivar' : 'reativar'}: ${error.message}`)
}

/** Erro que o banco devolve quando o caminhão já foi usado numa programação. */
export class CaminhaoEmUsoError extends Error {}

export async function excluirCaminhao(caminhao: Caminhao): Promise<void> {
  const { error } = await supabase.from('plt_caminhoes').delete().eq('id', caminhao.id)
  if (error) {
    if (/arquive em vez de excluir/i.test(error.message)) throw new CaminhaoEmUsoError(error.message)
    throw new Error(`Não deu para excluir: ${error.message}`)
  }
  if (caminhao.foto_caminho) void supabase.storage.from(BUCKET).remove([caminhao.foto_caminho])
}

export async function enviarFotoCaminhao(
  id: number,
  arquivo: File,
  caminhoAntigo: string | null,
): Promise<string> {
  const extensao = (arquivo.name.split('.').pop() ?? 'jpg').toLowerCase()
  const caminho = `caminhoes/${id}/foto-${Date.now()}.${extensao}`
  const { error: erroEnvio } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, arquivo, { contentType: arquivo.type || 'image/jpeg' })
  if (erroEnvio) throw new Error('Não consegui enviar a foto. Tente uma imagem menor.')
  const { error: erroGravar } = await supabase
    .from('plt_caminhoes')
    .update({ foto_caminho: caminho })
    .eq('id', id)
  if (erroGravar) throw new Error('A foto subiu, mas não consegui gravá-la no cadastro.')
  if (caminhoAntigo) void supabase.storage.from(BUCKET).remove([caminhoAntigo])
  return caminho
}

export async function removerFotoCaminhao(id: number, caminho: string): Promise<void> {
  const { error } = await supabase.from('plt_caminhoes').update({ foto_caminho: null }).eq('id', id)
  if (error) throw new Error(`Não deu para remover a foto: ${error.message}`)
  void supabase.storage.from(BUCKET).remove([caminho])
}

export function urlFotoCaminhao(caminho: string | null): string | null {
  if (!caminho) return null
  return supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl
}
