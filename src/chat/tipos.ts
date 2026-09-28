/**
 * O chat interno (SESSAO-26) como o front o enxerga. Os nomes espelham as
 * portas plt_fn_chat_* da migration 38 — o banco é a fonte (M-04).
 */
export type TipoConversa = 'canal' | 'particular' | 'avisos'
export type PapelNoChat = 'membro' | 'administrador' | 'escritor'

/** Uma linha da lista de conversas (plt_fn_chat_conversas). */
export interface ConversaResumo {
  conversa_id: number
  tipo: TipoConversa
  /** Canal/avisos: o nome. Particular: o nome da OUTRA pessoa. */
  titulo: string | null
  /** Particular: a foto da outra pessoa. */
  foto_caminho: string | null
  outro_id: string | null
  outro_ativo: boolean | null
  papel: PapelNoChat
  pode_escrever: boolean
  administra: boolean
  membros: number
  atividade_em: string
  ultima_id: number | null
  ultima_previa: string | null
  ultima_autor_id: string | null
  ultima_autor_nome: string | null
  ultima_lida_id: number
  /** Teto de 100 no banco — a interface mostra "99+". */
  nao_lidas: number
  /** Só na 1ª página: o total de não lidas de TODAS as conversas (o badge). */
  total_nao_lidas: number | null
}

/** Cursor da lista: a atividade e o id da última conversa da página. */
export interface CursorConversas {
  em: string
  id: number
}

export interface PaginaConversas {
  itens: ConversaResumo[]
  /** Só a 1ª página carrega o total (é ela que acende o badge). */
  totalNaoLidas: number | null
  /** Cursor da próxima página; null = acabou. */
  proximo: CursorConversas | null
}

export interface MensagemChat {
  id: number
  conversa_id: number
  /** null = o Sistema (aniversário). */
  autor_id: string | null
  autor_nome: string
  autor_foto: string | null
  tipo: 'texto' | 'aniversario'
  texto: string
  criada_em: string
}

/** O sinal pequeno do canal da pessoa: chegou mensagem numa conversa dela. */
export interface SinalMensagem {
  conversa_id: number
  tipo_conversa: TipoConversa
  nome_conversa: string | null
  mensagem_id: number
  autor_id: string | null
  autor_nome: string
  autor_foto: string | null
  previa: string
  criada_em: string
}

export interface Pessoa {
  id: string
  nome: string
  foto_caminho: string | null
}

export interface MembroChat extends Pessoa {
  papel: PapelNoChat
  ativo: boolean
}
