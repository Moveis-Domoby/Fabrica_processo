/**
 * SESSAO-46 (D-260…D-266) — Tech → Sugestão de melhoria: as regras puras que
 * a bolinha, o formulário, o quadro e a ficha usam. O banco confere tudo de
 * novo (as portas plt_fn_sugest*); aqui é só para a tela responder na hora.
 */

export type TipoSugestao = 'bug' | 'melhoria' | 'novidade'
export type ColunaSugestao = 'solicitacoes' | 'backlog' | 'fazendo' | 'finalizada' | 'recusada'
export type TesteSugestao = 'aguardando' | 'aprovada' | 'devolvida' | null
export type TipoArquivo = 'imagem' | 'video' | 'audio' | 'arquivo'

/** As colunas do quadro, na ordem do dono (a fila é "Solicitações"). */
export const COLUNAS: { chave: ColunaSugestao; titulo: string; descricao: string }[] = [
  { chave: 'solicitacoes', titulo: 'Solicitações', descricao: 'Toda sugestão nova chega aqui.' },
  { chave: 'backlog', titulo: 'Backlog', descricao: 'Aceita, esperando a vez.' },
  { chave: 'fazendo', titulo: 'Fazendo', descricao: 'Sendo feita agora.' },
  { chave: 'finalizada', titulo: 'Finalizada', descricao: 'Pronta — quem sugeriu testa.' },
  { chave: 'recusada', titulo: 'Recusada', descricao: 'Não vai ser feita (com o motivo).' },
]

export const TITULO_COLUNA: Record<ColunaSugestao, string> = Object.fromEntries(
  COLUNAS.map((c) => [c.chave, c.titulo]),
) as Record<ColunaSugestao, string>

export const TIPOS: { chave: TipoSugestao; rotulo: string; descricao: string }[] = [
  { chave: 'bug', rotulo: 'Bug', descricao: 'Algo que não funciona como devia.' },
  { chave: 'melhoria', rotulo: 'Melhoria', descricao: 'Algo que já existe e pode ficar melhor.' },
  { chave: 'novidade', rotulo: 'Implementação nova', descricao: 'Algo que ainda não existe.' },
]

export const ROTULO_TIPO: Record<TipoSugestao, string> = {
  bug: 'Bug',
  melhoria: 'Melhoria',
  novidade: 'Implementação nova',
}

export const MINIMO_LETRAS = 30
export const MAXIMO_LETRAS = 4000
/** O armário aceita até 50 MB por arquivo, qualquer formato. */
export const LIMITE_ARQUIVO = 50 * 1024 * 1024
export const MAXIMO_ARQUIVOS = 10
export const NIVEIS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

/** Quantas letras ainda faltam para o mínimo (o banco conta igual, sem os espaços das pontas). */
export function letrasQueFaltam(texto: string): number {
  return Math.max(0, MINIMO_LETRAS - texto.trim().length)
}

/** O nível de necessidade em palavras (estado nunca só por cor — M-12). */
export function faixaDoNivel(nivel: number): { rotulo: string; tom: 'baixo' | 'medio' | 'alto' | 'urgente' } {
  if (nivel >= 9) return { rotulo: 'Urgente', tom: 'urgente' }
  if (nivel >= 7) return { rotulo: 'Alta', tom: 'alto' }
  if (nivel >= 4) return { rotulo: 'Média', tom: 'medio' }
  return { rotulo: 'Pode esperar', tom: 'baixo' }
}

export interface FormularioSugestao {
  tipo: TipoSugestao | null
  texto: string
  nivel: number | null
  arquivos: number
}

/** O que ainda falta para enviar — vazio = pode enviar. */
export function oQueFalta(f: FormularioSugestao): string[] {
  const falta: string[] = []
  if (f.arquivos === 0) falta.push('um arquivo (print, áudio, vídeo ou outro)')
  if (!f.tipo) falta.push('o tipo (bug, melhoria ou implementação nova)')
  const faltam = letrasQueFaltam(f.texto)
  if (faltam > 0) falta.push(`mais ${faltam} ${faltam === 1 ? 'letra' : 'letras'} no texto`)
  if (f.nivel === null) falta.push('o nível de necessidade')
  return falta
}

export const NOME_TIPO_ARQUIVO: Record<TipoArquivo, string> = {
  imagem: 'imagem',
  video: 'vídeo',
  audio: 'áudio',
  arquivo: 'arquivo',
}

export function tipoDoArquivo(mime: string): TipoArquivo {
  if (mime.startsWith('image/')) return 'imagem'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'arquivo'
}

/** O nome que vai no armário: só letras, números, ponto, hífen e sublinhado (a regra do banco). */
export function nomeLimpo(nome: string): string {
  const limpo = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-\./g, '.')
    .replace(/^-|-$/g, '')
    .slice(-80)
  return limpo || 'arquivo'
}

/** O print colado (Ctrl+V) chega sem nome — ganha um com a hora. */
export function nomeDoPrint(agora: Date, extensao = 'png'): string {
  const d = (n: number) => String(n).padStart(2, '0')
  return (
    `print-${agora.getFullYear()}-${d(agora.getMonth() + 1)}-${d(agora.getDate())}-` +
    `${d(agora.getHours())}${d(agora.getMinutes())}${d(agora.getSeconds())}.${extensao}`
  )
}

/**
 * A pendência do Meu painel é uma tarefa do Sistema "Testar a sugestão #N"
 * (D-264): o número no título leva à ficha. Qualquer outra tarefa → nulo.
 */
export function sugestaoDaTarefa(t: { origem: string; card_id: number | null; titulo: string }): number | null {
  if (t.origem !== 'sistema' || t.card_id !== null) return null
  const achado = /^Testar a sugestão #(\d+)$/.exec(t.titulo)
  return achado ? Number(achado[1]) : null
}

/** O aviso do sino ("Sugestão #N pronta para testar" / "… recusada") leva à ficha. */
export function sugestaoDoAviso(a: { tipo: string; titulo: string }): number | null {
  if (!a.tipo.startsWith('sugestao_')) return null
  const achado = /Sugestão #(\d+)/.exec(a.titulo)
  return achado ? Number(achado[1]) : null
}

export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kB`
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}
