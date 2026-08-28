import { supabase } from '@/lib/supabase'

/**
 * Camada de dados dos dashboards (SESSAO-10 / D-32).
 *
 * Tudo passa pelas funções plt_fn_dash_* (migration 18): o gate por papel
 * (admin tudo, líder o próprio setor, operador nada) vive DENTRO delas — a
 * tela só reflete. Durações chegam como interval em texto e são traduzidas
 * por `msDeIntervalo`.
 */

function garantir<T>(dados: T | null, erro: { message: string } | null, contexto: string): T {
  if (erro) throw new Error(`${contexto}: ${erro.message}`)
  if (dados === null) throw new Error(`${contexto}: o servidor não devolveu dados.`)
  return dados
}

export interface PeriodoDash {
  de: string
  ate: string
}

export interface ExecucaoDetalhada {
  evento_inicio_id: number
  card_id: number
  pedido_numero: number | null
  item_codigo: string | null
  item_descricao: string | null
  indice_unidade: number | null
  total_unidades: number | null
  setor_id: number
  setor_nome: string | null
  etapa_nome: string | null
  executor_nome: string | null
  finalizador_nome: string | null
  iniciou_em: string
  finalizou_em: string | null
  em_andamento: boolean
  encerramento: string | null
  duracao_bruta: string
  duracao_util: string
  contagem_total: number
}

export async function dashExecucoes(parametros: {
  periodo: PeriodoDash
  setorId?: number | null
  usuarioId?: string | null
  limite?: number
  deslocamento?: number
}): Promise<ExecucaoDetalhada[]> {
  const { data, error } = await supabase.rpc('plt_fn_dash_execucoes', {
    p_de: parametros.periodo.de,
    p_ate: parametros.periodo.ate,
    p_setor_id: parametros.setorId ?? null,
    p_usuario_id: parametros.usuarioId ?? null,
    p_limite: parametros.limite ?? 20,
    p_deslocamento: parametros.deslocamento ?? 0,
  })
  return garantir(data as ExecucaoDetalhada[] | null, error, 'Não deu para carregar as execuções')
}

export interface TempoSetor {
  setor_id: number
  setor_nome: string
  fila_bruta: string
  fila_util: string
  execucao_bruta: string
  execucao_util: string
  total_util: string
  execucoes: number
  finalizadas: number
}

export async function dashTemposSetor(periodo: PeriodoDash): Promise<TempoSetor[]> {
  const { data, error } = await supabase.rpc('plt_fn_dash_tempos_setor', {
    p_de: periodo.de,
    p_ate: periodo.ate,
  })
  return garantir(data as TempoSetor[] | null, error, 'Não deu para carregar os tempos por setor')
}

export interface TempoPessoa {
  usuario_id: string
  usuario_nome: string
  matricula: string
  execucoes: number
  cards_atendidos: number
  tempo_bruto: string
  tempo_util: string
}

export async function dashTemposPessoa(
  periodo: PeriodoDash,
  setorId?: number | null,
): Promise<TempoPessoa[]> {
  const { data, error } = await supabase.rpc('plt_fn_dash_tempos_pessoa', {
    p_de: periodo.de,
    p_ate: periodo.ate,
    p_setor_id: setorId ?? null,
  })
  return garantir(data as TempoPessoa[] | null, error, 'Não deu para carregar os tempos por pessoa')
}

export interface TempoItem {
  item_codigo: string | null
  item_descricao: string | null
  execucoes: number
  unidades: number
  tempo_util: string
  media_por_unidade: string
}

export async function dashTemposItem(periodo: PeriodoDash): Promise<TempoItem[]> {
  const { data, error } = await supabase.rpc('plt_fn_dash_tempos_item', {
    p_de: periodo.de,
    p_ate: periodo.ate,
  })
  return garantir(data as TempoItem[] | null, error, 'Não deu para carregar os tempos por item')
}

export interface QualidadeSetor {
  setor_id: number
  setor_nome: string
  entregues_perfeito: number
  entregues_atencao: number
  entregues_danificado: number
  divergencias_contra: number
  pareceres_dados: number
  divergencias_apontadas: number
}

export async function dashQualidade(periodo: PeriodoDash): Promise<QualidadeSetor[]> {
  const { data, error } = await supabase.rpc('plt_fn_dash_qualidade', {
    p_de: periodo.de,
    p_ate: periodo.ate,
  })
  return garantir(data as QualidadeSetor[] | null, error, 'Não deu para carregar a qualidade')
}

export interface ResumoEstoque {
  cards_parados: number
  tempo_medio: string | null
  tempo_maximo: string | null
  mais_antigo_pedido: number | null
}

export async function dashEstoque(): Promise<ResumoEstoque | null> {
  const { data, error } = await supabase.rpc('plt_fn_dash_estoque')
  if (error) throw new Error(`Não deu para carregar o estoque: ${error.message}`)
  const linhas = (data ?? []) as ResumoEstoque[]
  return linhas[0] ?? null
}

// ---------------------------------------------------------------------------
// Visualizações salvas (RF-32/RF-33 — plt_visualizacoes, RLS por dono)
// ---------------------------------------------------------------------------

export const WIDGETS_DISPONIVEIS = [
  { chave: 'tempos_setor', rotulo: 'Fila vs execução por setor' },
  { chave: 'execucoes', rotulo: 'Execuções detalhadas' },
  { chave: 'pessoas', rotulo: 'Tempo por pessoa' },
  { chave: 'itens', rotulo: 'Tempo por item' },
  { chave: 'qualidade', rotulo: 'Qualidade por setor' },
  { chave: 'estoque', rotulo: 'Tempo parado no estoque' },
] as const

export type ChaveWidget = (typeof WIDGETS_DISPONIVEIS)[number]['chave']

export interface ConfiguracaoPainel {
  widgets: ChaveWidget[]
  periodoDias: number
  setorId: number | null
}

export const PAINEL_PADRAO: ConfiguracaoPainel = {
  widgets: ['tempos_setor', 'execucoes', 'pessoas', 'itens', 'qualidade', 'estoque'],
  periodoDias: 7,
  setorId: null,
}

export interface VisualizacaoSalva {
  id: number
  nome: string
  configuracao: ConfiguracaoPainel
  padrao: boolean
}

export async function listarVisualizacoes(usuarioId: string): Promise<VisualizacaoSalva[]> {
  const { data, error } = await supabase
    .from('plt_visualizacoes')
    .select('id, nome, configuracao, padrao')
    .eq('usuario_id', usuarioId)
    .order('nome')
  return garantir(
    data as VisualizacaoSalva[] | null,
    error,
    'Não deu para carregar as visualizações',
  )
}

export async function salvarVisualizacao(parametros: {
  usuarioId: string
  nome: string
  configuracao: ConfiguracaoPainel
}): Promise<void> {
  const { error } = await supabase.from('plt_visualizacoes').insert({
    usuario_id: parametros.usuarioId,
    nome: parametros.nome.trim(),
    configuracao: parametros.configuracao,
  })
  if (error) throw new Error(`Não deu para salvar a visualização: ${error.message}`)
}

export async function atualizarVisualizacao(
  id: number,
  configuracao: ConfiguracaoPainel,
): Promise<void> {
  const { error } = await supabase
    .from('plt_visualizacoes')
    .update({ configuracao })
    .eq('id', id)
  if (error) throw new Error(`Não deu para atualizar a visualização: ${error.message}`)
}

export async function excluirVisualizacao(id: number): Promise<void> {
  const { error } = await supabase.from('plt_visualizacoes').delete().eq('id', id)
  if (error) throw new Error(`Não deu para excluir a visualização: ${error.message}`)
}
