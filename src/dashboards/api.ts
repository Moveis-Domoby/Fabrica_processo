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
// Portas novas da SESSAO-16 (migration 28) — o retrato de agora e os números
// do dia da Visão do dia, danificados e a tendência semanal. Todas gateadas
// no banco por fn_setores_dashboard (D-32): quem não mede, recebe vazio.
// ---------------------------------------------------------------------------

export interface SetorAgora {
  /** null = a linha do TOTAL (pessoas contadas sem repetir entre setores). */
  setor_id: number | null
  setor_nome: string | null
  setor_codigo: string | null
  na_fila: number
  em_execucao: number
  pessoas_executando: number
  espera_mais_antiga: string | null
}

export async function dashAgora(): Promise<SetorAgora[]> {
  const { data, error } = await supabase.rpc('plt_fn_dash_agora')
  return garantir(data as SetorAgora[] | null, error, 'Não deu para carregar o retrato de agora')
}

export interface PcpDia {
  pedidos_a_liberar: number
  unidades_liberadas_dia: number
  espera_mais_antiga: string | null
}

export async function dashPcpDia(): Promise<PcpDia | null> {
  const { data, error } = await supabase.rpc('plt_fn_dash_pcp_dia')
  if (error) throw new Error(`Não deu para carregar o PCP do dia: ${error.message}`)
  return ((data ?? []) as PcpDia[])[0] ?? null
}

export interface NumerosDia {
  concluidas_dia: number
  media_concluidas_4sem: number | null
  danificados_dia: number
  aguardando_lancamento: number
}

export async function dashDia(): Promise<NumerosDia | null> {
  const { data, error } = await supabase.rpc('plt_fn_dash_dia')
  if (error) throw new Error(`Não deu para carregar os números do dia: ${error.message}`)
  const linha = ((data ?? []) as NumerosDia[])[0] ?? null
  return linha
    ? { ...linha, media_concluidas_4sem: linha.media_concluidas_4sem === null ? null : Number(linha.media_concluidas_4sem) }
    : null
}

export interface ProducaoHora {
  hora: number
  concluidas: number
  media_4sem: number
}

export async function dashProducaoHora(): Promise<ProducaoHora[]> {
  const { data, error } = await supabase.rpc('plt_fn_dash_producao_hora')
  const linhas = garantir(
    data as ProducaoHora[] | null,
    error,
    'Não deu para carregar a produção por hora',
  )
  return linhas.map((l) => ({ ...l, media_4sem: Number(l.media_4sem) }))
}

export interface DestinoFimDeLinha {
  destino: string
  quantidade: number
}

export async function dashFimDeLinha(): Promise<DestinoFimDeLinha[]> {
  const { data, error } = await supabase.rpc('plt_fn_dash_fim_de_linha')
  return garantir(data as DestinoFimDeLinha[] | null, error, 'Não deu para carregar o fim de linha')
}

export interface DanificadoDia {
  setor_origem_nome: string
  setor_destino_nome: string
  quantidade: number
}

export async function dashDanificadosDia(): Promise<DanificadoDia[]> {
  const { data, error } = await supabase.rpc('plt_fn_dash_danificados_dia')
  return garantir(data as DanificadoDia[] | null, error, 'Não deu para carregar os danificados do dia')
}

export interface DanificadoAberto {
  setor_id: number
  setor_nome: string
  item_descricao: string
  quantidade: number
  mais_antigo: string | null
}

export async function dashDanificadosAbertos(): Promise<DanificadoAberto[]> {
  const { data, error } = await supabase.rpc('plt_fn_dash_danificados_abertos')
  return garantir(
    data as DanificadoAberto[] | null,
    error,
    'Não deu para carregar os danificados em aberto',
  )
}

export interface SemanaTendencia {
  semana_inicio: string
  unidades: number
  media_total: string | null
}

export async function dashTendenciaSemanas(semanas = 6): Promise<SemanaTendencia[]> {
  const { data, error } = await supabase.rpc('plt_fn_dash_tendencia_semanas', {
    p_semanas: semanas,
  })
  return garantir(data as SemanaTendencia[] | null, error, 'Não deu para carregar a tendência')
}

// ---------------------------------------------------------------------------
// Visualizações salvas (RF-32/RF-33 — plt_visualizacoes, RLS por dono)
//
// SESSAO-16: a configuração passou a guardar TELA + filtros (as 4 telas-filhas
// da D-42 substituíram o painel único de widgets). As visualizações antigas
// (formato da S10, com `widgets`) continuam funcionando: são traduzidas POR
// LEITURA para a tela equivalente — nenhum dado é migrado no banco.
// ---------------------------------------------------------------------------

export const TELAS_DASH = [
  { chave: 'visao-do-dia', rotulo: 'Visão do dia' },
  { chave: 'tempo-por-setor', rotulo: 'Tempo por setor' },
  { chave: 'pessoas', rotulo: 'Pessoas' },
  { chave: 'qualidade', rotulo: 'Qualidade' },
] as const

export type TelaDash = (typeof TELAS_DASH)[number]['chave']

export interface ConfiguracaoPainel {
  tela: TelaDash
  periodoDias: number
  setorId: number | null
  /** Qual duração mostrar em destaque: útil (desconta pausas — D-29) ou bruta. */
  tempo: 'util' | 'bruto'
}

export const PAINEL_PADRAO: ConfiguracaoPainel = {
  tela: 'tempo-por-setor',
  periodoDias: 7,
  setorId: null,
  tempo: 'util',
}

/** Formato salvo pela S10 — só existe para a tradução de leitura abaixo. */
interface ConfiguracaoAntiga {
  widgets?: string[]
  periodoDias?: number
  setorId?: number | null
}

/**
 * Traduz qualquer configuração salva (nova ou da S10) para o formato atual.
 * Regra da tradução: a visualização antiga era um painel de widgets — ela vira
 * a tela que melhor cobre o que estava ligado (qualidade só → Qualidade;
 * pessoas/execuções sem tempos de setor → Pessoas; resto → Tempo por setor).
 */
export function normalizarConfiguracao(bruta: unknown): ConfiguracaoPainel {
  const cfg = (bruta ?? {}) as Partial<ConfiguracaoPainel> & ConfiguracaoAntiga
  const periodoDias = typeof cfg.periodoDias === 'number' ? cfg.periodoDias : 7
  const setorId = typeof cfg.setorId === 'number' ? cfg.setorId : null
  const tempo = cfg.tempo === 'bruto' ? 'bruto' : 'util'
  if (cfg.tela && TELAS_DASH.some((t) => t.chave === cfg.tela)) {
    return { tela: cfg.tela, periodoDias, setorId, tempo }
  }
  const widgets = Array.isArray(cfg.widgets) ? cfg.widgets : []
  const soQualidade = widgets.length > 0 && widgets.every((w) => w === 'qualidade')
  const soPessoas =
    widgets.length > 0 && widgets.every((w) => w === 'pessoas' || w === 'execucoes')
  return {
    tela: soQualidade ? 'qualidade' : soPessoas ? 'pessoas' : 'tempo-por-setor',
    periodoDias,
    setorId,
    tempo,
  }
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
