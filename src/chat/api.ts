import { supabase } from '@/lib/supabase'
import type {
  ConversaResumo,
  CursorConversas,
  MembroChat,
  MensagemChat,
  PaginaConversas,
  PapelNoChat,
  Pessoa,
} from './tipos'

/**
 * A camada de dados do chat (SESSAO-26). Lei do dono para esta tela: a
 * comunicação é por websocket; LEITURA só por página — até 5 conversas e até
 * 10 mensagens (o teto também é do banco), carregando mais ao rolar. O resto é
 * POST. Erro de regra vem do banco já em português e é mostrado como veio.
 */
export const POR_PAGINA_CONVERSAS = 5
export const POR_PAGINA_MENSAGENS = 10
export const POR_PAGINA_PESSOAS = 10

function falha(erro: { message: string }): Error {
  return new Error(erro.message)
}

/** Uma página da lista (5). A 1ª traz o total de não lidas — o badge do balão. */
export async function buscarConversas(cursor: CursorConversas | null): Promise<PaginaConversas> {
  const { data, error } = await supabase.rpc('plt_fn_chat_conversas', {
    p_antes_em: cursor?.em ?? null,
    p_antes_id: cursor?.id ?? null,
    p_limite: POR_PAGINA_CONVERSAS,
  })
  if (error) throw falha(error)
  const itens = (data ?? []) as ConversaResumo[]
  const ultima = itens[itens.length - 1]
  return {
    itens,
    totalNaoLidas: cursor ? null : (itens[0]?.total_nao_lidas ?? 0),
    proximo:
      itens.length === POR_PAGINA_CONVERSAS && ultima
        ? { em: ultima.atividade_em, id: ultima.conversa_id }
        : null,
  }
}

/** O resumo de UMA conversa (abrir por link, ou particular recém-aberta). */
export async function buscarConversa(conversaId: number): Promise<ConversaResumo | null> {
  const { data, error } = await supabase.rpc('plt_fn_chat_conversas', {
    p_conversa_id: conversaId,
  })
  if (error) throw falha(error)
  return ((data ?? []) as ConversaResumo[])[0] ?? null
}

/** Uma página de mensagens (10), da mais nova para a mais antiga. */
export async function buscarMensagens(
  conversaId: number,
  antesId: number | null,
): Promise<MensagemChat[]> {
  const { data, error } = await supabase.rpc('plt_fn_chat_mensagens', {
    p_conversa_id: conversaId,
    p_antes_id: antesId,
    p_limite: POR_PAGINA_MENSAGENS,
  })
  if (error) throw falha(error)
  return (data ?? []) as MensagemChat[]
}

/** POST: devolve a mensagem gravada — quem envia não relê nada. */
export async function enviarMensagem(conversaId: number, texto: string): Promise<MensagemChat> {
  const { data, error } = await supabase.rpc('plt_fn_chat_enviar', {
    p_conversa_id: conversaId,
    p_texto: texto,
  })
  if (error) throw falha(error)
  const gravada = ((data ?? []) as MensagemChat[])[0]
  if (!gravada) throw new Error('A mensagem não voltou do servidor. Tente de novo.')
  return gravada
}

/** POST: o ponteiro de leitura só anda para frente. */
export async function marcarLida(conversaId: number, ateId: number): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_chat_marcar_lida', {
    p_conversa_id: conversaId,
    p_ate_id: ateId,
  })
  if (error) throw falha(error)
  return Number(data ?? 0)
}

/** POST: a mesma particular para o par, quem quer que abra primeiro. */
export async function abrirParticular(outroId: string): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_chat_abrir_particular', { p_outro: outroId })
  if (error) throw falha(error)
  return Number(data)
}

/** POST: só líder ou admin (o banco confere). */
export async function criarCanal(nome: string, membros: string[]): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_chat_criar_canal', {
    p_nome: nome,
    p_membros: membros,
  })
  if (error) throw falha(error)
  return Number(data)
}

export async function renomearCanal(conversaId: number, nome: string): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_chat_renomear_canal', {
    p_conversa_id: conversaId,
    p_nome: nome,
  })
  if (error) throw falha(error)
}

/** Membros, 10 por página. `papel` filtra (nos avisos: 'escritor'). */
export async function buscarMembros(parametros: {
  conversaId: number
  pagina: number
  papel?: PapelNoChat
}): Promise<{ membros: MembroChat[]; total: number }> {
  const { data, error } = await supabase.rpc('plt_fn_chat_membros', {
    p_conversa_id: parametros.conversaId,
    p_papel: parametros.papel ?? null,
    p_limite: POR_PAGINA_PESSOAS,
    p_deslocamento: parametros.pagina * POR_PAGINA_PESSOAS,
  })
  if (error) throw falha(error)
  const linhas = (data ?? []) as {
    usuario_id: string
    nome: string
    foto_caminho: string | null
    papel: PapelNoChat
    ativo: boolean
    total: number
  }[]
  return {
    membros: linhas.map((l) => ({
      id: l.usuario_id,
      nome: l.nome,
      foto_caminho: l.foto_caminho,
      papel: l.papel,
      ativo: l.ativo,
    })),
    total: linhas[0]?.total ?? 0,
  }
}

export async function adicionarMembros(conversaId: number, usuarios: string[]): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_chat_adicionar_membros', {
    p_conversa_id: conversaId,
    p_usuarios: usuarios,
  })
  if (error) throw falha(error)
  return Number(data ?? 0)
}

export async function removerMembro(conversaId: number, usuarioId: string): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_chat_remover_membro', {
    p_conversa_id: conversaId,
    p_usuario: usuarioId,
  })
  if (error) throw falha(error)
}

/** Avisos gerais: só o admin decide quem escreve (resposta 3 do dono). */
export async function definirEscritor(usuarioId: string, pode: boolean): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_chat_definir_escritor', {
    p_usuario: usuarioId,
    p_pode: pode,
  })
  if (error) throw falha(error)
}

/**
 * Pessoas ativas para conversar ou pôr num canal: 10 por página, busca no
 * servidor (regra 17). Só colunas de trabalho — CPF e afins nem são legíveis.
 */
export async function buscarPessoas(parametros: {
  busca: string
  pagina: number
  exceto: string
}): Promise<{ pessoas: Pessoa[]; total: number }> {
  const de = parametros.pagina * POR_PAGINA_PESSOAS
  let consulta = supabase
    .from('plt_usuarios')
    .select('id, nome, foto_caminho', { count: 'exact' })
    .eq('ativo', true)
    .neq('id', parametros.exceto)
    .order('nome')
    .range(de, de + POR_PAGINA_PESSOAS - 1)
  const busca = parametros.busca.trim()
  if (busca) consulta = consulta.ilike('nome', `%${busca.replace(/[%_]/g, '')}%`)
  const { data, error, count } = await consulta
  if (error) throw falha(error)
  return { pessoas: (data ?? []) as Pessoa[], total: count ?? 0 }
}
