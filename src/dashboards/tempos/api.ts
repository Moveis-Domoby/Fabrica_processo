import { supabase } from '@/lib/supabase'

/**
 * SESSAO-43 — Dashboards → Tempos de produção e o Modo TV. Cada aba é UMA porta
 * do banco, pedida só no clique (Lei §3); as listas andam por cursor (Lei §6).
 * Tudo lê o cálculo único da SESSAO-42 (passagens, trechos, padrão) e o
 * histórico do Trello — nenhuma conta de tempo é feita aqui.
 */

export type Origem = 'plataforma' | 'trello'
export type Situacao =
  | 'valida'
  | 'conferir'
  | 'retrabalho'
  | 'admin'
  | 'sem_registro'
  | 'descartada'
  | 'aberta'
  | 'teste'

/** Nome e foto das pessoas que aparecem numa resposta (as linhas trazem só o id). */
export type MapaPessoas = Record<string, { nome: string; foto: string | null }>

export interface FiltrosTempos {
  setorId: number
  de: string
  ate: string
  pessoaId: string | null
  modeloId: number | null
  trello: boolean
}

interface Comum {
  setor: { id: number; nome: string }
  pode_decidir: boolean
  pessoa_travada: boolean
  pessoas: MapaPessoas
  /** Quantos casos esperam a conferência no período (só para quem decide). */
  conferir_n: number | null
}

export interface LinhaDia {
  origem: Origem
  id: number
  card_id: number | null
  inicio: string | null
  fim: string
  movel: string | null
  pedido: number | null
  modelo_id: number | null
  modelo: string | null
  montadores: string[]
  ajudantes: string[]
  execucao_s: number
  padrao_s: number | null
  situacao: Situacao
  motivo: string | null
  lote: boolean
  retrabalho: boolean
  cortado: boolean
  decidida: boolean
  desfecho: string
}

export interface TrechoDia {
  pessoa: string
  inicio: string
  fim: string
  card_id: number | null
  movel: string | null
  papel: 'execucao' | 'auxilio'
  descartado: boolean
  cortado: boolean
  origem: Origem
}

export interface RespostaDia extends Comum {
  dia: string
  faixa_pct: number
  numeros: {
    montados: number
    validas: number
    conferir: number
    sem_registro: number
    montadores: number
    tempo_total_s: number
    mediana_s: number | null
    media_s: number | null
    com_padrao: number
    abaixo: number
    cobertura_total: number
    cobertura_com_tempo: number
  }
  linha: { janelas: [string, string][]; trechos: TrechoDia[] }
  tabela: { itens: LinhaDia[]; tem_mais: boolean }
}

export interface RespostaPeriodo extends Comum {
  de: string
  ate: string
  numeros: {
    montados: number
    validas: number
    conferir: number
    dias_uteis: number
    media_dia_util: number | null
    dias_com_montagem: number
    media_dia_montagem: number | null
    tempo_total_s: number
    mediana_s: number | null
    media_s: number | null
    cobertura_total: number
    cobertura_com_tempo: number
    n_plataforma: number
    n_trello: number
  }
  tempo_setor: {
    fila_s: number
    execucao_s: number
    parado_s: number
    retrabalho_n: number
    retrabalho_s: number
  }
  grafico: {
    agrupado: 'dia' | 'semana'
    series: { chave: string; n: number }[]
    barras: { balde: string; total: number; partes: Record<string, number> }[]
  }
  por_montador: {
    chave: string
    moveis: number
    dias: number
    por_dia: number
    mediana_s: number | null
    tempo_total_s: number
  }[]
  moveis_top: {
    itens: { modelo_id: number | null; nome: string; n: number; pct: number }[]
    mais_n: number
  }
}

export interface ModeloLinha {
  modelo_id: number | null
  nome: string
  qtd: number
  conferir: number
  validas: number
  melhor_s: number | null
  mediana_s: number | null
  p25_s: number | null
  p75_s: number | null
  padrao_s: number | null
  n_trello: number
  por_pessoa: Record<string, { n: number; mediana_s: number | null }>
}

export interface RespostaMoveis extends Comum {
  de: string
  ate: string
  faixa_pct: number
  colunas: string[]
  itens: ModeloLinha[]
  total: number
  tem_mais: boolean
}

export interface PassagemModelo {
  origem: Origem
  id: number
  card_id: number | null
  dia: string
  fim: string
  movel: string | null
  pedido: number | null
  montadores: string[]
  execucao_s: number
  padrao_s: number | null
  situacao: Situacao
  motivo: string | null
  lote: boolean
  cortado: boolean
  decidida: boolean
}

export interface CartaoPessoa {
  usuario_id: string
  moveis: number
  dias: number
  por_dia: number
  mediana_s: number | null
  tempo_total_s: number
  abaixo: number
  acima: number
  na_media: number
  melhor: { modelo: string | null; execucao_s: number; padrao_s: number | null; dia: string } | null
  ajudas: number
  ocupacao_pct: number | null
}

export interface RespostaMontadores extends Comum {
  de: string
  ate: string
  faixa_pct: number
  pessoas_cartoes: CartaoPessoa[]
  melhores: {
    modelo: string | null
    execucao_s: number
    padrao_s: number | null
    montadores: string[]
    dia: string
    origem: Origem
  }[]
  ajudantes_so: { usuario_id: string; ajudas: number }[]
}

export const GRUPOS_CONFERIR = [
  'rapida',
  'longa',
  'cortado',
  'clique_errado',
  'retrabalho',
  'sem_registro',
  'admin',
  'lote',
  'decididas',
] as const
export type GrupoConferir = (typeof GRUPOS_CONFERIR)[number]

export interface CasoConferir {
  origem: Origem
  id: number
  card_id: number | null
  dia: string
  inicio: string | null
  fim: string
  movel: string | null
  pedido: number | null
  modelo: string | null
  montadores: string[]
  ajudantes: string[]
  execucao_s: number
  padrao_s: number | null
  situacao: Situacao
  motivo: string | null
  lote: boolean
  cortado: boolean
  clique_errado: boolean
  retrabalho: boolean
  decidida: boolean
  decisao: {
    decisao: 'considerar' | 'descartar'
    motivo: string | null
    quem: string | null
    em: string
  } | null
}

export interface RespostaConferir {
  setor: { id: number; nome: string }
  grupos: Record<GrupoConferir | 'a_conferir', number>
  grupo: GrupoConferir
  faixa_pct: number
  itens: CasoConferir[]
  tem_mais: boolean
  pessoas: MapaPessoas
  conferir_n: number
}

export interface TrechoProcurado {
  pessoa: string
  papel: 'execucao' | 'auxilio'
  inicio: string
  fim: string | null
  fim_tipo: string | null
  corte: string | null
  descartado: boolean
  segundos: number
}

export interface Procurado {
  origem: Origem
  id: number
  card_id?: number | null
  movel: string | null
  pedido: number | null
  modelo: string | null
  entrada_em: string
  saida_em: string | null
  dia: string | null
  fila_s?: number
  execucao_s: number
  parado_s?: number
  bruto_s?: number
  situacao: Situacao
  motivo: string | null
  desfecho?: string
  lote: boolean
  cortado?: boolean
  etiquetas?: string[]
  url?: string | null
  montadores: string[]
  ajudantes?: string[]
  trechos?: TrechoProcurado[]
}

export interface Cursor {
  fim: string
  origem: Origem
  id: number
}

function erroDe(error: { message: string } | null, mensagem: string): void {
  if (error) throw new Error(error.message || mensagem)
}

const base = (f: FiltrosTempos) => ({
  p_setor_id: f.setorId,
  p_usuario_id: f.pessoaId,
  p_trello: f.trello,
})

export async function buscarDia(
  f: FiltrosTempos,
  dia: string,
  cursor: Cursor | null = null,
): Promise<RespostaDia> {
  const { data, error } = await supabase.rpc('plt_fn_tempos_dia', {
    ...base(f),
    p_dia: dia,
    p_de: f.de,
    p_ate: f.ate,
    p_modelo_id: f.modeloId,
    p_depois_fim: cursor?.fim ?? null,
    p_depois_origem: cursor?.origem ?? null,
    p_depois_id: cursor?.id ?? null,
    p_limite: 50,
  })
  erroDe(error, 'Não deu para carregar o dia.')
  return data as RespostaDia
}

export async function buscarPeriodo(f: FiltrosTempos): Promise<RespostaPeriodo> {
  const { data, error } = await supabase.rpc('plt_fn_tempos_periodo', {
    ...base(f),
    p_de: f.de,
    p_ate: f.ate,
    p_modelo_id: f.modeloId,
  })
  erroDe(error, 'Não deu para carregar o período.')
  return data as RespostaPeriodo
}

export type OrdemMoveis = 'qtd' | 'melhor' | 'mediana' | 'faixa' | 'nome'

export async function buscarMoveis(
  f: FiltrosTempos,
  ordem: OrdemMoveis,
  desc: boolean,
  deslocamento: number,
): Promise<RespostaMoveis> {
  const { data, error } = await supabase.rpc('plt_fn_tempos_moveis', {
    ...base(f),
    p_de: f.de,
    p_ate: f.ate,
    p_ordem: ordem,
    p_desc: desc,
    p_deslocamento: deslocamento,
    p_limite: 50,
  })
  erroDe(error, 'Não deu para carregar os móveis.')
  return data as RespostaMoveis
}

export async function buscarPassagensDoModelo(
  f: FiltrosTempos,
  modeloId: number | null,
  cursor: Cursor | null,
): Promise<{
  itens: PassagemModelo[]
  tem_mais: boolean
  pode_decidir: boolean
  pessoas: MapaPessoas
}> {
  const { data, error } = await supabase.rpc('plt_fn_tempos_modelo_passagens', {
    ...base(f),
    p_modelo_id: modeloId,
    p_de: f.de,
    p_ate: f.ate,
    p_sem_modelo: modeloId === null,
    p_depois_fim: cursor?.fim ?? null,
    p_depois_origem: cursor?.origem ?? null,
    p_depois_id: cursor?.id ?? null,
    p_limite: 30,
  })
  erroDe(error, 'Não deu para carregar as montagens deste móvel.')
  return data as {
    itens: PassagemModelo[]
    tem_mais: boolean
    pode_decidir: boolean
    pessoas: MapaPessoas
  }
}

export async function buscarMontadores(f: FiltrosTempos): Promise<RespostaMontadores> {
  const { data, error } = await supabase.rpc('plt_fn_tempos_montadores', {
    ...base(f),
    p_de: f.de,
    p_ate: f.ate,
    p_modelo_id: f.modeloId,
  })
  erroDe(error, 'Não deu para carregar as pessoas.')
  return data as RespostaMontadores
}

export async function buscarConferir(
  f: FiltrosTempos,
  grupo: GrupoConferir | null,
  cursor: Cursor | null,
): Promise<RespostaConferir> {
  const { data, error } = await supabase.rpc('plt_fn_tempos_conferir', {
    ...base(f),
    p_de: f.de,
    p_ate: f.ate,
    p_grupo: grupo,
    p_depois_fim: cursor?.fim ?? null,
    p_depois_origem: cursor?.origem ?? null,
    p_depois_id: cursor?.id ?? null,
    p_limite: 30,
  })
  erroDe(error, 'Não deu para carregar a conferência.')
  return data as RespostaConferir
}

export async function procurarPassagens(
  setorId: number,
  texto: string,
  trello: boolean,
): Promise<{ itens: Procurado[]; pessoas: MapaPessoas }> {
  const { data, error } = await supabase.rpc('plt_fn_tempos_procurar', {
    p_setor_id: setorId,
    p_texto: texto,
    p_trello: trello,
  })
  erroDe(error, 'Não deu para procurar.')
  return data as { itens: Procurado[]; pessoas: MapaPessoas }
}

export async function opcoesDosFiltros(
  setorId: number,
  busca: string | null,
): Promise<{
  pessoas: { id: string; nome: string; foto: string | null }[]
  modelos: { id: number; nome: string }[]
}> {
  const { data, error } = await supabase.rpc('plt_fn_tempos_opcoes', {
    p_setor_id: setorId,
    p_busca: busca,
  })
  erroDe(error, 'Não deu para carregar as opções.')
  return data as {
    pessoas: { id: string; nome: string; foto: string | null }[]
    modelos: { id: number; nome: string }[]
  }
}

export type Decisao = 'considerar' | 'descartar' | 'desfazer'

/** A decisão manual: a da plataforma é a porta da SESSAO-42; a do histórico, a desta sessão. */
export async function decidirTempo(
  origem: Origem,
  id: number,
  decisao: Decisao,
  motivo: string,
): Promise<void> {
  const { error } =
    origem === 'plataforma'
      ? await supabase.rpc('plt_fn_tempo_decidir', {
          p_passagem_id: id,
          p_decisao: decisao,
          p_motivo: motivo,
        })
      : await supabase.rpc('plt_fn_tempo_trello_decidir', {
          p_id: id,
          p_decisao: decisao,
          p_motivo: motivo,
        })
  erroDe(error, 'Não deu para gravar a decisão.')
}

// ---------------------------------------------------------------------------
// Modo TV
// ---------------------------------------------------------------------------
export interface RespostaTv {
  setor: { id: number; nome: string }
  setores: { id: number; nome: string }[]
  hoje: string
  montados_hoje: number
  n30: number
  dias_uteis_30: number
  media_30: number | null
  montados_mes: number
  dias_uteis_mes: number
  media_mes: number | null
  tempo_medio_hoje_s: number | null
  mediana_30_s: number | null
  dados_ate: string | null
  montadores: { letra: string; hoje: number; mediana_hoje_s: number | null; ritmo: number | null }[]
  grafico: {
    dias: { dia: string; total: number; partes: Record<string, number> }[]
    series: string[]
  }
  melhor_semana: { letras: string; modelo: string; tempo_s: number; padrao_s: number } | null
}

export async function buscarModoTv(setorId: number | null): Promise<RespostaTv> {
  const { data, error } = await supabase.rpc('plt_fn_modo_tv', { p_setor_id: setorId })
  erroDe(error, 'Não deu para carregar a TV.')
  return data as RespostaTv
}

/** Liga/desliga a permissão Modo TV (só admin). `soTv` = a conta só da TV. */
export async function definirModoTv(
  usuarioId: string,
  ligado: boolean,
  soTv = false,
): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_usuario_modo_tv', {
    p_usuario_id: usuarioId,
    p_ligado: ligado,
    p_so_tv: soTv,
  })
  erroDe(error, 'Não deu para mudar o Modo TV.')
}

// ---------------------------------------------------------------------------
// Configurações → Controle de tempo → Modelos: "Nomes do Trello sem modelo"
// ---------------------------------------------------------------------------
export interface NomeSemModelo {
  chave: string
  exemplo: string
  cartoes: number
  sugestao: string | null
  de: string
  ate: string
}

export async function buscarNomesSemModelo(
  depois: { n: number; chave: string } | null,
): Promise<{ itens: NomeSemModelo[]; tem_mais: boolean; nomes: number; cartoes: number }> {
  const { data, error } = await supabase.rpc('plt_fn_tempo_trello_sem_modelo', {
    p_limite: 30,
    p_depois_n: depois?.n ?? null,
    p_depois_chave: depois?.chave ?? null,
  })
  erroDe(error, 'Não deu para carregar os nomes do Trello.')
  return data as { itens: NomeSemModelo[]; tem_mais: boolean; nomes: number; cartoes: number }
}

export async function ligarNomeTrello(
  chave: string,
  modeloId: number | null,
  nomeNovo: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_tempo_trello_ligar', {
    p_chave: chave,
    p_modelo_id: modeloId,
    p_nome_novo: nomeNovo,
  })
  erroDe(error, 'Não deu para ligar o nome.')
}
