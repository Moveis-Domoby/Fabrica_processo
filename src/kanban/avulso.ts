import { supabase } from '@/lib/supabase'
import type { Card } from './tipos'

/**
 * SESSAO-31 (D-125/D-130): o CARD AVULSO — trabalho digitado à mão no PCP
 * (aba Lançamento manual) que anda pelos quadros como qualquer card e termina
 * no "Concluir". Toda regra (quem cria, quem edita, onde anda) é do banco —
 * a tela só mostra a mensagem que voltar.
 */

export type VinculoTipo = 'pedido' | 'produto' | 'peca'
export type VisaoAvulsos = 'a_lancar' | 'em_producao' | 'concluidos'

export const ROTULO_VISAO: Record<VisaoAvulsos, string> = {
  a_lancar: 'A lançar',
  em_producao: 'Em produção',
  concluidos: 'Concluídos',
}

export const ROTULO_VINCULO: Record<VinculoTipo, string> = {
  pedido: 'Pedido',
  produto: 'Produto',
  peca: 'Peça',
}

export interface NovoCardAvulso {
  titulo: string
  descricao?: string | null
  inicio?: string | null
  vence?: string | null
  responsaveis?: string[]
  etiquetas?: number[]
  vinculo?: { tipo: VinculoTipo; id: number } | null
  /** Lançar já para este setor de produção (senão fica em "A lançar"). */
  setorId?: number | null
  /** A chave do gesto: o mesmo toque (clique duplo, rede que volta) = um card só. */
  chave: string
}

export async function criarCardAvulso(
  novo: NovoCardAvulso,
): Promise<{ card_id: number; repetido: boolean }> {
  const { data, error } = await supabase.rpc('plt_fn_avulso_criar', {
    p_titulo: novo.titulo,
    p_descricao: novo.descricao ?? null,
    p_inicio: novo.inicio || null,
    p_vence: novo.vence || null,
    p_responsaveis: novo.responsaveis?.length ? novo.responsaveis : null,
    p_etiquetas: novo.etiquetas?.length ? novo.etiquetas : null,
    p_vinculo_tipo: novo.vinculo?.tipo ?? null,
    p_vinculo_id: novo.vinculo?.id ?? null,
    p_setor_id: novo.setorId ?? null,
    p_chave: novo.chave,
  })
  if (error) throw new Error(error.message)
  return data as { card_id: number; repetido: boolean }
}

export async function lancarCardAvulso(cardId: number, setorId: number): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_avulso_lancar', {
    p_card_id: cardId,
    p_setor_id: setorId,
  })
  if (error) throw new Error(error.message)
}

export async function concluirCardAvulso(parametros: {
  cardId: number
  observacao?: string | null
  operadorId?: string | null
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_avulso_concluir', {
    p_card_id: parametros.cardId,
    p_observacao: parametros.observacao?.trim() || null,
    p_operador_id: parametros.operadorId ?? null,
  })
  if (error) throw new Error(error.message)
}

export interface PessoaMini {
  id: string
  nome: string
  foto: string | null
}

/** Uma linha da aba Lançamento manual. */
export interface LinhaAvulso {
  card_id: number
  tipo: Card['tipo']
  titulo: string
  descricao: string | null
  setor_id: number | null
  setor_nome: string | null
  etapa_nome: string | null
  desde: string | null
  executor_nome: string | null
  pausado_em: string | null
  inicio_em: string | null
  vence_em: string | null
  responsaveis: PessoaMini[]
  etiquetas: number[]
  vinculo_tipo: VinculoTipo | null
  vinculo_id: number | null
  vinculo_rotulo: string | null
  ajuste_destino: Card['ajuste_destino']
  criado_em: string
  criado_por: string | null
  concluido_em: string | null
  anexos_qtd: number
  mensagens_qtd: number
  tem_mais: boolean
}

export async function listarAvulsos(parametros: {
  visao: VisaoAvulsos
  busca?: string
  antesId?: number | null
  limite?: number
}): Promise<LinhaAvulso[]> {
  const { data, error } = await supabase.rpc('plt_fn_avulsos', {
    p_visao: parametros.visao,
    p_busca: parametros.busca?.trim() || null,
    p_antes_id: parametros.antesId ?? null,
    p_limite: parametros.limite ?? 20,
  })
  if (error) throw new Error(`Não deu para carregar os cards: ${error.message}`)
  return ((data ?? []) as LinhaAvulso[]).map((l) => ({
    ...l,
    etiquetas: (l.etiquetas ?? []).map(Number),
  }))
}

export interface OpcaoVinculo {
  id: number
  rotulo: string
  detalhe: string
}

/** A busca do vínculo (e da peça do ajuste): no servidor, a partir de 2 letras. */
export async function buscarVinculo(parametros: {
  tipo: VinculoTipo
  busca: string
  paraAjuste?: boolean
}): Promise<OpcaoVinculo[]> {
  if (parametros.busca.trim().length < 2) return []
  const { data, error } = await supabase.rpc('plt_fn_vinculo_buscar', {
    p_tipo: parametros.tipo,
    p_busca: parametros.busca.trim(),
    p_para_ajuste: parametros.paraAjuste ?? false,
    p_limite: 10,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as OpcaoVinculo[]
}

/** Pessoas ativas pelo nome (responsáveis, menções): 10 por vez, no servidor. */
export async function buscarPessoasAtivas(busca: string): Promise<PessoaMini[]> {
  const termo = busca.trim().replace(/[%_]/g, '')
  let consulta = supabase
    .from('plt_usuarios')
    .select('id, nome, foto_caminho')
    .eq('ativo', true)
    .order('nome')
    .limit(10)
  if (termo) consulta = consulta.ilike('nome', `%${termo}%`)
  const { data, error } = await consulta
  if (error) throw new Error(error.message)
  return ((data ?? []) as { id: string; nome: string; foto_caminho: string | null }[]).map((p) => ({
    id: p.id,
    nome: p.nome,
    foto: p.foto_caminho,
  }))
}

/** Editar as propriedades (descrição, datas; no avulso também nome e vínculo). */
export async function editarCard(
  cardId: number,
  mudancas: Partial<{
    titulo: string
    descricao: string | null
    inicio_em: string | null
    vence_em: string | null
    vinculo: { tipo: VinculoTipo; id: number } | null
  }>,
): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_card_editar', {
    p_card_id: cardId,
    p_mudancas: mudancas,
  })
  if (error) throw new Error(error.message)
  return data as number
}

export async function definirResponsavel(
  cardId: number,
  usuarioId: string,
  por: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_card_responsavel', {
    p_card_id: cardId,
    p_usuario_id: usuarioId,
    p_por: por,
  })
  if (error) throw new Error(error.message)
}

export async function definirEtiquetaDoCard(
  cardId: number,
  etiquetaId: number,
  por: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_card_etiqueta', {
    p_card_id: cardId,
    p_etiqueta_id: etiquetaId,
    p_por: por,
  })
  if (error) throw new Error(error.message)
}

/** Uma chave nova por gesto (Lei §10). */
export function chaveDoGesto(): string {
  return crypto.randomUUID()
}

/** D-130: a peça volta à produção para AJUSTE, com o destino final escolhido pelo PCP. */
export async function abrirAjusteDePeca(parametros: {
  pecaId: number
  setorId: number
  destinoFinal: 'estoque' | 'pedido' | 'terceirizado' | 'loja' | 'danificados'
  descricao?: string | null
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_ajuste_abrir', {
    p_peca_id: parametros.pecaId,
    p_setor_id: parametros.setorId,
    p_destino_final: parametros.destinoFinal,
    p_descricao: parametros.descricao?.trim() || null,
  })
  if (error) throw new Error(error.message)
}
