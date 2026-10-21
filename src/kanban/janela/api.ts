import { supabase } from '@/lib/supabase'
import { reduzirSeForFoto } from '@/rotas/api'
import type { CampoCustomizado, Etiqueta, ValorCampo } from '@/utilitarios/tipos'
import type { Card } from '../tipos'

/**
 * SESSAO-31 (§3 · Lei §2/§3): a JANELA DO CARD — para todo card. Abrir = 1
 * requisição (`plt_fn_card_janela`); histórico e anexos só no clique.
 */

export interface JanelaDoCard {
  card: Card
  arquivado_em: string | null
  criado_em: string
  setor: {
    id: number
    nome: string
    codigo: string
    papel_no_fluxo: 'entrada' | 'producao' | 'terminal'
  } | null
  etapa: { id: number; nome: string; eh_fila: boolean } | null
  execucao: { usuario_id: string; iniciou_em: string } | null
  /** SESSAO-36 (D-146): os auxílios abertos — o tempo próprio de cada pessoa no card. */
  auxilios: {
    usuario_id: string
    iniciado_em: string
    pausado_em: string | null
    pausa_motivo: string | null
    segundos: number
    ultimo_inicio: string | null
  }[]
  pessoas: Record<string, { nome: string; foto: string | null }>
  pedido: {
    pedido_id: number
    numero: number
    cliente_nome: string
    situacao: string | null
    data_prevista: string | null
    /** SESSAO-38: a data do pedido no Tiny (o Início do card do pedido). */
    data_pedido?: string | null
  } | null
  /**
   * SESSAO-38 (D-150): o prazo — do pedido no Tiny (início = a data do pedido,
   * vencimento = a data de entrega do vendedor) ou, sem pedido, o do card.
   */
  prazo?: { inicio: string | null; vencimento: string | null; do_pedido: boolean }
  /** SESSAO-38 (D-150): a prioridade efetiva (na peça, a do pedido). */
  prioridade?: { valor: 'urgente' | 'atencao' | 'comum'; do_pedido: boolean; da_reposicao: boolean }
  /** SESSAO-38 (D-152): quem pegou o card em cada setor e quem foi definido para os próximos. */
  responsaveis_por_setor?: ResponsaveisDoSetor[]
  campos: (CampoCustomizado & { valor: ValorCampo | null })[]
  etiquetas: Etiqueta[]
  permissoes: {
    editar: boolean
    editar_nome: boolean
    concluir: boolean
    anexar: boolean
    ver_removidos: boolean
    /** SESSAO-31 (§4): o próprio executor, o líder do setor, o admin — e quem auxilia (SESSAO-36). */
    pausar: boolean
    retomar: boolean
    /** SESSAO-36 (D-146): o card está em execução — dá para entrar como auxiliar. */
    auxiliar: boolean
    /** SESSAO-36: quem olha a tela está no card como auxiliar (pode sair). */
    sair_auxilio: boolean
    /** SESSAO-38 (D-151): mudar a prioridade (na peça, muda a do pedido). */
    priorizar?: boolean
    /** SESSAO-38: as datas se editam só no card sem pedido (as do pedido vêm do Tiny). */
    editar_datas?: boolean
  }
}

/** SESSAO-38 (D-152): uma linha da seção Responsáveis (um setor de produção). */
export interface ResponsaveisDoSetor {
  setor_id: number
  setor_nome: string
  ordem: number
  /** quem pegou o card neste setor (início de execução) — da história, só leitura */
  executaram: string[]
  /** quem ajudou (auxílio) sem ter pegado */
  auxiliaram: string[]
  /** quem foi definido para quando o card chegar aqui */
  planejados: string[]
  executado: boolean
  atual: boolean
  pode_planejar: boolean
}

export async function definirResponsavelDoSetor(parametros: {
  cardId: number
  setorId: number
  usuarioId: string
  por: boolean
}): Promise<string> {
  const { data, error } = await supabase.rpc('plt_fn_card_responsavel_setor', {
    p_card_id: parametros.cardId,
    p_setor_id: parametros.setorId,
    p_usuario_id: parametros.usuarioId,
    p_por: parametros.por,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function abrirJanela(cardId: number): Promise<JanelaDoCard> {
  const { data, error } = await supabase.rpc('plt_fn_card_janela', { p_card_id: cardId })
  if (error) throw new Error(error.message)
  return data as JanelaDoCard
}

export interface AnexoDoCard {
  id: number
  tipo: 'comprovante' | 'foto' | 'documento' | 'audio'
  caminho: string
  nome_arquivo: string
  mime: string
  tamanho: number
  duracao_s: number | null
  enviado_por: string | null
  enviado_por_nome: string | null
  enviado_em: string
  removido_em: string | null
  removido_por_nome: string | null
}

export async function listarAnexosDoCard(
  cardId: number,
  comRemovidos = false,
): Promise<AnexoDoCard[]> {
  const { data, error } = await supabase.rpc('plt_fn_anexos', {
    p_card_id: cardId,
    p_com_removidos: comRemovidos,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as AnexoDoCard[]
}

const ARMARIO = 'plt-anexos'
/** D-125 resp. 8: até 25 MB por arquivo; áudio até 5 minutos. */
export const LIMITE_ANEXO = 25 * 1024 * 1024
export const LIMITE_AUDIO_S = 5 * 60
export const ACEITA_ANEXO =
  'image/*,application/pdf,.pdf,audio/*,.doc,.docx,.odt,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * O arquivo sobe DIRETO ao armário privado (não passa pelo banco); depois o
 * banco registra o anexo no card. Foto é reduzida no aparelho (Lei §9); o
 * tipo do áudio vai sem os parâmetros ("audio/webm;codecs=opus" → "audio/webm").
 */
export async function anexarAoCard(
  cardId: number,
  original: File,
  opcoes: { duracaoS?: number | null; operadorId?: string | null } = {},
): Promise<number> {
  const arquivo = await reduzirSeForFoto(original)
  if (arquivo.size > LIMITE_ANEXO) throw new Error('O arquivo tem mais de 25 MB — mande um menor.')
  const mime = (arquivo.type || 'application/octet-stream').split(';')[0]
  const nomeLimpo =
    arquivo.name
      .normalize('NFD')
      .replace(/[^\w.-]+/g, '-')
      .slice(-80) || 'arquivo'
  const caminho = `${cardId}/${crypto.randomUUID()}-${nomeLimpo}`
  const envio = await supabase.storage
    .from(ARMARIO)
    .upload(caminho, arquivo, { contentType: mime, upsert: false })
  if (envio.error) throw new Error(`Não deu para enviar o arquivo: ${envio.error.message}`)
  const { data, error } = await supabase.rpc('plt_fn_anexo_registrar', {
    p_card_id: cardId,
    p_caminho: caminho,
    p_nome_arquivo: original.name,
    p_mime: mime,
    p_tamanho: arquivo.size,
    p_tipo: null,
    p_duracao_s: opcoes.duracaoS ?? null,
    p_operador_id: opcoes.operadorId ?? null,
  })
  if (error) throw new Error(error.message)
  return data as number
}

export async function removerAnexo(anexoId: number, operadorId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_anexo_remover', {
    p_anexo_id: anexoId,
    p_operador_id: operadorId ?? null,
  })
  if (error) throw new Error(error.message)
}

/** Link de poucos minutos para abrir o anexo (o armário é privado). */
export async function linkDoAnexoDoCard(caminho: string): Promise<string> {
  const { data, error } = await supabase.storage.from(ARMARIO).createSignedUrl(caminho, 300)
  if (error || !data) throw new Error('Não deu para abrir o arquivo.')
  return data.signedUrl
}

/** Os links de vários anexos numa chamada só (a lista aberta — Lei §2). */
export async function linksDosAnexos(caminhos: string[]): Promise<Record<string, string>> {
  if (caminhos.length === 0) return {}
  const { data, error } = await supabase.storage.from(ARMARIO).createSignedUrls(caminhos, 300)
  if (error || !data) throw new Error('Não deu para abrir os arquivos.')
  const mapa: Record<string, string> = {}
  for (const item of data) if (item.path && item.signedUrl) mapa[item.path] = item.signedUrl
  return mapa
}

export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kB`
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}
