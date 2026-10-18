import { supabase } from '@/lib/supabase'

/**
 * Camada de dados da tela do setor (SESSAO-07).
 *
 * - Membros do setor: alimenta a identificação por toque (D-06) — o operador
 *   escolhe o próprio nome e digita só o PIN, sem teclado do sistema.
 * - Imagens de produto (D-28): bucket `plt-imagens`, caminho
 *   `produtos/{codigo}/…` — imagens pertencem ao PRODUTO (SKU), não ao card;
 *   é onde a futura biblioteca de peças vai plugar.
 */

export interface MembroSetor {
  usuario_id: string
  nome: string
  usuario: string
  matricula: string
}

export async function membrosDoSetor(setorId: number): Promise<MembroSetor[]> {
  const { data, error } = await supabase
    .from('plt_usuario_setores')
    .select('usuario_id, plt_usuarios(nome, usuario, matricula, ativo)')
    .eq('setor_id', setorId)
  if (error) throw new Error(`Não deu para carregar a equipe do setor: ${error.message}`)
  type Linha = {
    usuario_id: string
    plt_usuarios: { nome: string; usuario: string; matricula: string; ativo: boolean } | null
  }
  // O client tipa o embed como array; com FK única ele vem objeto — cast via unknown.
  return ((data ?? []) as unknown as Linha[])
    .filter((l) => l.plt_usuarios?.ativo)
    .map((l) => ({
      usuario_id: l.usuario_id,
      nome: l.plt_usuarios!.nome,
      usuario: l.plt_usuarios!.usuario,
      matricula: l.plt_usuarios!.matricula,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

// ---------------------------------------------------------------------------
// SESSAO-36 (D-146): auxílio e presença — as portas do banco fazem as regras;
// a tela só mostra a mensagem que voltar.
// ---------------------------------------------------------------------------

/** Entrar num card em execução como AUXILIAR (tempo próprio da pessoa). */
export async function cardAuxiliar(cardId: number, operadorId?: string): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_card_auxiliar', {
    p_card_id: cardId,
    p_operador_id: operadorId ?? null,
  })
  if (error) throw new Error(error.message)
}

/** Sair do auxílio — o card segue intacto para quem ficou. */
export async function auxilioEncerrar(cardId: number, operadorId?: string): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_auxilio_encerrar', {
    p_card_id: cardId,
    p_operador_id: operadorId ?? null,
  })
  if (error) throw new Error(error.message)
}

/** O "Entrar" do ícone: dar entrada no setor (volta da ausência e da deriva). */
export async function pessoaEntrar(setorId: number, operadorId?: string): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_pessoa_entrar', {
    p_setor_id: setorId,
    p_operador_id: operadorId ?? null,
  })
  if (error) throw new Error(error.message)
}

/** O "Pausar" do ícone: pausa TODOS os cards da pessoa (um motivo) — fica ausente. */
export async function pessoaPausar(
  motivoId: number | null,
  texto: string | null,
  operadorId?: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_pessoa_pausar', {
    p_motivo_id: motivoId,
    p_texto: texto,
    p_operador_id: operadorId ?? null,
  })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

/** O "Sair" do ícone: pausa tudo + encerra a entrada (motivo da lista de saída). */
export async function pessoaSair(
  motivoId: number | null,
  texto: string | null,
  operadorId?: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_pessoa_sair', {
    p_motivo_id: motivoId,
    p_texto: texto,
    p_operador_id: operadorId ?? null,
  })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

// ---------------------------------------------------------------------------
// Imagens por produto (D-28)
// ---------------------------------------------------------------------------

const BUCKET = 'plt-imagens'

/**
 * Pasta do produto no bucket. O SKU vira caminho seguro. Uma regra só — a
 * foto do Estoque (ajuste de 28/09) mora na mesma pasta do produto.
 */
export function pastaDoProduto(codigo: string): string {
  return `produtos/${codigo.replace(/[^a-zA-Z0-9._-]/g, '_')}`
}

export interface ImagemProduto {
  nome: string
  caminho: string
  url: string
}

export async function listarImagensProduto(codigo: string): Promise<ImagemProduto[]> {
  const pasta = pastaDoProduto(codigo)
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(pasta, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } })
  if (error) throw new Error(`Não deu para carregar as imagens: ${error.message}`)
  return (data ?? [])
    .filter((objeto) => objeto.name && !objeto.name.startsWith('.'))
    .map((objeto) => {
      const caminho = `${pasta}/${objeto.name}`
      return {
        nome: objeto.name,
        caminho,
        url: supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl,
      }
    })
}

export async function enviarImagemProduto(codigo: string, arquivo: File): Promise<void> {
  const extensao = arquivo.name.includes('.') ? arquivo.name.split('.').pop() : 'jpg'
  const caminho = `${pastaDoProduto(codigo)}/${Date.now()}.${extensao}`
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw new Error(`Não deu para enviar a imagem: ${error.message}`)
}

export async function removerImagemProduto(caminho: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([caminho])
  if (error) throw new Error(`Não deu para remover a imagem: ${error.message}`)
}
