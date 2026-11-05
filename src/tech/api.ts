import { supabase } from '@/lib/supabase'
import { reduzirImagem } from '@/lib/imagem'
import { LIMITE_ARQUIVO, nomeLimpo } from './regras'
import type { ColunaSugestao, TesteSugestao, TipoArquivo, TipoSugestao } from './regras'

/**
 * SESSAO-46 — a camada de dados das sugestões. O quadro abre numa requisição
 * (`plt_fn_sugestoes_quadro`); "Ver mais", a ficha e os links dos arquivos só
 * no clique (Lei §3). Os arquivos sobem DIRETO ao armário privado
 * `plt-sugestoes` (pasta = a pessoa) e o banco confere que chegaram.
 */

const ARMARIO = 'plt-sugestoes'

export interface CartaoSugestao {
  id: number
  tipo: TipoSugestao
  nivel: number
  resumo: string
  autor_nome: string | null
  minha: boolean
  criada_em: string
  movida_em: string
  arquivos: number
  tipos_arquivo: TipoArquivo[]
  teste: TesteSugestao
  origem_id: number | null
  devolvida_para_id: number | null
  motivo_recusa: string | null
}

export type CursorSugestoes = { nivel: number; id: number } | { movida_em: string; id: number }

export interface ColunaDoQuadro {
  coluna: ColunaSugestao
  total: number | null
  itens: CartaoSugestao[]
  proximo: CursorSugestoes | null
}

export interface QuadroSugestoes {
  colunas: ColunaDoQuadro[]
  eu_movo: boolean
}

export interface ArquivoDaSugestao {
  caminho: string
  nome: string
  mime: string
  tamanho: number
  duracao_s: number | null
}

export interface FatoDaSugestao {
  tipo: 'criada' | 'movida' | 'aprovada' | 'devolvida'
  de: ColunaSugestao | null
  para: ColunaSugestao | null
  motivo: string | null
  relacionada_id: number | null
  autor_nome: string | null
  quando: string
}

export interface FichaSugestao {
  id: number
  tipo: TipoSugestao
  texto: string
  nivel: number
  coluna: ColunaSugestao
  criada_em: string
  movida_em: string
  motivo_recusa: string | null
  teste: TesteSugestao
  testada_em: string | null
  anexos: ArquivoDaSugestao[]
  autor: { id: string; nome: string; foto_caminho: string | null }
  minha: boolean
  eu_movo: boolean
  posso_testar: boolean
  origem: { id: number; resumo: string; coluna: ColunaSugestao; tipo: TipoSugestao; nivel: number } | null
  devolvida_para: { id: number; resumo: string; coluna: ColunaSugestao } | null
  historico: FatoDaSugestao[]
}

export const POR_COLUNA = 20

export async function buscarQuadro(): Promise<QuadroSugestoes> {
  const { data, error } = await supabase.rpc('plt_fn_sugestoes_quadro', {
    p_coluna: null,
    p_cursor: null,
    p_limite: POR_COLUNA,
  })
  if (error) throw new Error(error.message)
  return data as QuadroSugestoes
}

/** "Ver mais" de uma coluna: a próxima página depois do cursor. */
export async function buscarMaisDaColuna(
  coluna: ColunaSugestao,
  cursor: CursorSugestoes,
): Promise<ColunaDoQuadro> {
  const { data, error } = await supabase.rpc('plt_fn_sugestoes_quadro', {
    p_coluna: coluna,
    p_cursor: cursor,
    p_limite: POR_COLUNA,
  })
  if (error) throw new Error(error.message)
  return (data as QuadroSugestoes).colunas[0]
}

export async function buscarFicha(id: number): Promise<FichaSugestao> {
  const { data, error } = await supabase.rpc('plt_fn_sugestao_detalhe', { p_id: id })
  if (error) throw new Error(error.message)
  return data as FichaSugestao
}

export async function moverSugestao(id: number, para: ColunaSugestao, motivo?: string): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_sugestao_mover', {
    p_id: id,
    p_para: para,
    p_motivo: motivo ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function aprovarSugestao(id: number): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_sugestao_aprovar', { p_id: id })
  if (error) throw new Error(error.message)
}

/** Foto grande de câmera é reduzida no aparelho (Lei §9); print fica como está (precisa ser legível). */
async function prepararArquivo(original: File): Promise<File> {
  const ehFotoDeCamera = /^image\/(jpeg|heic|heif|webp)$/.test(original.type)
  if (!ehFotoDeCamera || original.size <= 1.5 * 1024 * 1024) return original
  const { dados, extensao } = await reduzirImagem(original, 1920)
  if (dados === original) return original
  const nome = original.name.replace(/\.[^.]+$/, '') + '.' + extensao
  return new File([dados], nome, { type: dados.type || 'image/jpeg' })
}

/** Sobe um arquivo ao armário (pasta = a pessoa) e devolve o que o banco registra. */
export async function enviarArquivo(
  eu: string,
  original: File,
  duracaoS: number | null = null,
): Promise<ArquivoDaSugestao> {
  const arquivo = await prepararArquivo(original)
  if (arquivo.size > LIMITE_ARQUIVO) {
    throw new Error(`"${original.name}" tem mais de 50 MB — mande um menor.`)
  }
  const mime = (arquivo.type || 'application/octet-stream').split(';')[0]
  const caminho = `${eu}/${crypto.randomUUID()}-${nomeLimpo(arquivo.name)}`
  const envio = await supabase.storage
    .from(ARMARIO)
    .upload(caminho, arquivo, { contentType: mime, upsert: false })
  if (envio.error) throw new Error(`Não deu para enviar "${original.name}": ${envio.error.message}`)
  return { caminho, nome: original.name, mime, tamanho: arquivo.size, duracao_s: duracaoS }
}

export async function criarSugestao(parametros: {
  tipo: TipoSugestao
  texto: string
  nivel: number
  anexos: ArquivoDaSugestao[]
  origemId?: number | null
  chave: string
}): Promise<{ id: number; repetido: boolean }> {
  const { data, error } = await supabase.rpc('plt_fn_sugestao_criar', {
    p_tipo: parametros.tipo,
    p_texto: parametros.texto.trim(),
    p_nivel: parametros.nivel,
    p_anexos: parametros.anexos,
    p_origem_id: parametros.origemId ?? null,
    p_chave: parametros.chave,
  })
  if (error) throw new Error(error.message)
  return data as { id: number; repetido: boolean }
}

/** Os links de vários arquivos numa chamada só (o armário é privado; vale 10 min). */
export async function linksDosArquivos(caminhos: string[]): Promise<Record<string, string>> {
  if (caminhos.length === 0) return {}
  const { data, error } = await supabase.storage.from(ARMARIO).createSignedUrls(caminhos, 600)
  if (error || !data) throw new Error('Não deu para abrir os arquivos.')
  const mapa: Record<string, string> = {}
  for (const item of data) if (item.path && item.signedUrl) mapa[item.path] = item.signedUrl
  return mapa
}
