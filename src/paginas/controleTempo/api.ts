import { useQueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Configurações → Controle de tempo (SESSAO-42 · F2): uma porta do banco por
 * aba, pedida só quando a aba abre (regra 17 / Lei de desempenho §2). Todas as
 * portas são `security definer` e recusam quem não pode — o líder de setor só
 * passa na da hora extra (e só vê os setores dele). Toda gravação já deixa a
 * trilha e pede o recálculo no próprio banco.
 */

// ---------------------------------------------------------------------------
// Chaves do cache
// ---------------------------------------------------------------------------

export const CHAVE_TEMPO = {
  expediente: ['controle-tempo', 'expediente'] as const,
  calendario: (ano: number) => ['controle-tempo', 'calendario', ano] as const,
  calendarioTodos: ['controle-tempo', 'calendario'] as const,
  horasExtras: ['controle-tempo', 'horas-extras'] as const,
  regras: ['controle-tempo', 'regras'] as const,
  equipe: (setorId: number) => ['controle-tempo', 'equipe', setorId] as const,
  equipeTodas: ['controle-tempo', 'equipe'] as const,
  modelos: (busca: string, soSugeridos: boolean) =>
    ['controle-tempo', 'modelos', busca, soSugeridos] as const,
  modelosTodos: ['controle-tempo', 'modelos'] as const,
  recalculos: ['controle-tempo', 'recalculos'] as const,
}

/**
 * Depois de salvar: relê a aba, a lista de recálculos (o banco acabou de pedir
 * um) e a régua do tempo útil dos cards (cache desde a abertura — D-172).
 * Aba fechada só fica marcada: relê quando abrir.
 */
export function useDepoisDeSalvar() {
  const clienteQuery = useQueryClient()
  return (chave: QueryKey) =>
    Promise.all([
      clienteQuery.invalidateQueries({ queryKey: chave }),
      clienteQuery.invalidateQueries({ queryKey: CHAVE_TEMPO.recalculos }),
      clienteQuery.invalidateQueries({ queryKey: ['regua-tempo'] }),
    ])
}

export function mensagemDoErro(erro: unknown): string | undefined {
  return erro instanceof Error ? erro.message : undefined
}

/** Leitura: o contexto + a mensagem do banco (já em português). */
function falhaNaLeitura(contexto: string, mensagem: string): never {
  throw new Error(`${contexto}: ${mensagem}`)
}

// ---------------------------------------------------------------------------
// Expediente e intervalos
// ---------------------------------------------------------------------------

export type PapelSetor = 'entrada' | 'producao' | 'terminal'
/** [dia (0 = domingo … 6 = sábado), "HH:MM", "HH:MM"] */
export type FaixaSemana = [number, string, string]

export interface SetorExpediente {
  id: number
  nome: string
  papel: PapelSetor
  faixas: FaixaSemana[]
}

export async function buscarExpediente(): Promise<SetorExpediente[]> {
  const { data, error } = await supabase.rpc('plt_fn_tempo_expediente')
  if (error) falhaNaLeitura('Não deu para carregar o expediente', error.message)
  return ((data as { setores?: SetorExpediente[] } | null)?.setores ?? []) as SetorExpediente[]
}

export async function salvarExpediente(
  setorId: number,
  faixas: FaixaSemana[],
  copiarParaTodos: boolean,
): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_tempo_expediente_salvar', {
    p_setor_id: setorId,
    p_faixas: faixas,
    p_copiar_para_todos: copiarParaTodos,
  })
  if (error) throw new Error(error.message)
  return (data as { setores?: number } | null)?.setores ?? 0
}

// ---------------------------------------------------------------------------
// Calendário
// ---------------------------------------------------------------------------

export type TipoExcecao = 'feriado' | 'trabalhado' | 'parado'
/** ["HH:MM", "HH:MM"] */
export type FaixaDia = [string, string]

export interface ExcecaoCalendario {
  id: number
  setor_id: number | null
  setor: string | null
  /** AAAA-MM-DD */
  dia: string
  tipo: TipoExcecao
  descricao: string
  faixas: FaixaDia[]
  por: string | null
}

export interface SetorSimples {
  id: number
  nome: string
}

export interface TelaCalendario {
  excecoes: ExcecaoCalendario[]
  setores: SetorSimples[]
}

export async function buscarCalendario(de: string, ate: string): Promise<TelaCalendario> {
  const { data, error } = await supabase.rpc('plt_fn_tempo_calendario', { p_de: de, p_ate: ate })
  if (error) falhaNaLeitura('Não deu para carregar o calendário', error.message)
  const tela = (data ?? {}) as Partial<TelaCalendario>
  return { excecoes: tela.excecoes ?? [], setores: tela.setores ?? [] }
}

export async function salvarExcecao(excecao: {
  id: number | null
  setorId: number | null
  dia: string
  tipo: TipoExcecao
  descricao: string
  faixas: FaixaDia[]
}): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_tempo_excecao_salvar', {
    p_id: excecao.id,
    p_setor_id: excecao.setorId,
    p_dia: excecao.dia,
    p_tipo: excecao.tipo,
    p_descricao: excecao.descricao,
    p_faixas: excecao.tipo === 'trabalhado' ? excecao.faixas : [],
  })
  if (error) throw new Error(error.message)
  return data as number
}

export async function removerExcecao(id: number): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_tempo_excecao_remover', { p_id: id })
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Hora extra (a aba que o líder também vê)
// ---------------------------------------------------------------------------

export interface HoraExtra {
  id: number
  setor_id: number
  setor: string
  usuario_id: string | null
  pessoa: string | null
  inicio: string
  fim: string
  motivo: string
  por: string | null
  criado_em: string
  cancelada_em: string | null
}

export interface PessoaHoraExtra {
  id: string
  nome: string
  setores: number[]
}

export interface PaginaHorasExtras {
  itens: HoraExtra[]
  tem_mais: boolean
  setores: SetorSimples[]
  pessoas: PessoaHoraExtra[]
  admin: boolean
}

export const POR_PAGINA_HORA_EXTRA = 30

export async function buscarHorasExtras(
  depois: { inicio: string; id: number } | null,
): Promise<PaginaHorasExtras> {
  const { data, error } = await supabase.rpc('plt_fn_tempo_horas_extras', {
    p_limite: POR_PAGINA_HORA_EXTRA,
    p_antes_em: depois?.inicio ?? null,
    p_antes_id: depois?.id ?? null,
  })
  if (error) falhaNaLeitura('Não deu para carregar as horas extras', error.message)
  const p = (data ?? {}) as Partial<PaginaHorasExtras>
  return {
    itens: p.itens ?? [],
    tem_mais: p.tem_mais ?? false,
    setores: p.setores ?? [],
    pessoas: p.pessoas ?? [],
    admin: p.admin ?? false,
  }
}

export async function salvarHoraExtra(h: {
  setorId: number
  usuarioId: string | null
  inicio: string
  fim: string
  motivo: string
}): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_tempo_hora_extra_salvar', {
    p_setor_id: h.setorId,
    p_usuario_id: h.usuarioId,
    p_inicio: h.inicio,
    p_fim: h.fim,
    p_motivo: h.motivo,
  })
  if (error) throw new Error(error.message)
  return data as number
}

export async function cancelarHoraExtra(id: number): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_tempo_hora_extra_cancelar', { p_id: id })
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Regras por setor
// ---------------------------------------------------------------------------

export interface RegrasSetor {
  setor_id: number
  nome: string
  aviso_esquecido_min: number | null
  minimo_min: number
  teto_min: number | null
  fator_longo: number
  base_minima: number
  pausar_fim_expediente: boolean
  sem_resposta_min: number
  volta_rapida_min: number
  retrabalho_fora: boolean
  admin_fora: boolean
  avisar_pulo: boolean
  permite_lote: boolean
  faixa_media_pct: number
  janela_padrao_dias: number
}

export type ChaveRegra = Exclude<keyof RegrasSetor, 'setor_id' | 'nome'>

export interface TelaRegras {
  config: { data_oficial: string | null; recalcular_desde: string | null } | null
  setores: RegrasSetor[]
}

export async function buscarRegras(): Promise<TelaRegras> {
  const { data, error } = await supabase.rpc('plt_fn_tempo_regras')
  if (error) falhaNaLeitura('Não deu para carregar as regras', error.message)
  const tela = (data ?? {}) as Partial<TelaRegras>
  return {
    config: tela.config ?? null,
    setores: (tela.setores ?? []).map((s) => ({ ...s, fator_longo: Number(s.fator_longo) })),
  }
}

/** Manda só as regras que mudaram. */
export async function salvarRegras(
  setorId: number,
  regras: Partial<Record<ChaveRegra, number | boolean | null>>,
): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_tempo_regras_salvar', {
    p_setor_id: setorId,
    p_regras: regras,
  })
  if (error) throw new Error(error.message)
}

export async function salvarDataOficial(dia: string): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_tempo_config_salvar', { p_data_oficial: dia })
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Equipe no painel
// ---------------------------------------------------------------------------

export type PapelPainel = 'titular' | 'apoio'

export interface PessoaPainel {
  usuario_id: string
  nome: string
  foto: string | null
  papel: PapelPainel | null
  letra: string | null
  do_setor: boolean
}

export interface TelaEquipe {
  setores: SetorSimples[]
  pessoas: PessoaPainel[]
}

export async function buscarEquipe(setorId: number): Promise<TelaEquipe> {
  const { data, error } = await supabase.rpc('plt_fn_tempo_equipe', { p_setor_id: setorId })
  if (error) falhaNaLeitura('Não deu para carregar a equipe do painel', error.message)
  const tela = (data ?? {}) as Partial<TelaEquipe>
  return { setores: tela.setores ?? [], pessoas: tela.pessoas ?? [] }
}

export async function salvarEquipe(
  setorId: number,
  usuarioId: string,
  papel: PapelPainel | null,
  letra: string | null,
): Promise<{ papel: PapelPainel | null; letra: string | null }> {
  const { data, error } = await supabase.rpc('plt_fn_tempo_equipe_salvar', {
    p_setor_id: setorId,
    p_usuario_id: usuarioId,
    p_papel: papel,
    p_letra: letra,
  })
  if (error) throw new Error(error.message)
  return data as { papel: PapelPainel | null; letra: string | null }
}

// ---------------------------------------------------------------------------
// Modelos
// ---------------------------------------------------------------------------

export interface ModeloTempo {
  id: number
  nome: string
  confirmado: boolean
  chaves: { chave: string; exemplo: string | null }[]
  passagens: number
  padrao: { setor: string; mediana_s: number; n: number }[] | null
}

export interface PaginaModelos {
  itens: ModeloTempo[]
  tem_mais: boolean
  sugeridos: number
}

export const POR_PAGINA_MODELOS = 30

export async function buscarModelos(parametros: {
  busca: string
  soSugeridos: boolean
  depois: { nome: string; id: number } | null
}): Promise<PaginaModelos> {
  const { data, error } = await supabase.rpc('plt_fn_tempo_modelos', {
    p_busca: parametros.busca.trim() || null,
    p_so_sugeridos: parametros.soSugeridos,
    p_limite: POR_PAGINA_MODELOS,
    p_depois_nome: parametros.depois?.nome ?? null,
    p_depois_id: parametros.depois?.id ?? null,
  })
  if (error) falhaNaLeitura('Não deu para carregar os modelos', error.message)
  const p = (data ?? {}) as Partial<PaginaModelos>
  return { itens: p.itens ?? [], tem_mais: p.tem_mais ?? false, sugeridos: p.sugeridos ?? 0 }
}

export async function confirmarModelo(id: number, nome: string): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_tempo_modelo_confirmar', {
    p_id: id,
    p_nome: nome.trim() || null,
  })
  if (error) throw new Error(error.message)
}

export async function juntarModelos(destinoId: number, origens: number[]): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_tempo_modelo_juntar', {
    p_destino_id: destinoId,
    p_origens: origens,
  })
  if (error) throw new Error(error.message)
}

export async function separarModelo(chave: string, nome: string): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_tempo_modelo_separar', {
    p_chave: chave,
    p_nome: nome.trim(),
  })
  if (error) throw new Error(error.message)
  return data as number
}

// ---------------------------------------------------------------------------
// Recálculo
// ---------------------------------------------------------------------------

export interface PedidoRecalculo {
  id: number
  de: string | null
  ate: string
  setor: string | null
  alcance: 'tudo' | 'classificar'
  motivo: string
  por: string | null
  criado_em: string
  iniciado_em: string | null
  concluido_em: string | null
  total: number | null
  feitos: number | null
  erro: string | null
}

export const POR_PAGINA_RECALCULOS = 20

export async function buscarRecalculos(): Promise<PedidoRecalculo[]> {
  const { data, error } = await supabase.rpc('plt_fn_tempo_recalculos', {
    p_limite: POR_PAGINA_RECALCULOS,
  })
  if (error) falhaNaLeitura('Não deu para carregar os recálculos', error.message)
  return ((data as { itens?: PedidoRecalculo[] } | null)?.itens ?? []) as PedidoRecalculo[]
}

export async function pedirRecalculo(de: string, ate: string, setorId: number | null) {
  const { data, error } = await supabase.rpc('plt_fn_tempo_recalcular', {
    p_de: de,
    p_ate: ate,
    p_setor_id: setorId,
  })
  if (error) throw new Error(error.message)
  return data as number
}
