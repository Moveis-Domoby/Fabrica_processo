import { supabase } from '@/lib/supabase'

/**
 * Camada de dados da AUDITORIA (SESSAO-29 · D-95 ↪️ D-40): duas portas de
 * leitura, só do admin (o gate mora no banco), paginadas no servidor — a tela
 * pede uma página por vez e o total vem na mesma consulta (regra 17).
 * SESSAO-32 (migration 81): a trilha cresce sem fim — vai por CURSOR (a próxima
 * página começa depois da última linha mostrada) e o total vem só na 1ª.
 */

/** Uma linha da trilha de atividade, já traduzida pelo banco (nome, pedido, setores, porquê). */
export interface LinhaAuditoria {
  id: number
  criado_em: string
  usuario_id: string | null
  usuario_nome: string | null
  acao: string
  rota: string | null
  contexto: Record<string, unknown>
  pedido_numero: number | null
  card_tipo: string | null
  setor_origem: string | null
  setor_destino: string | null
  etapa_origem: string | null
  etapa_destino: string | null
  motivo: string | null
  tem_mais: boolean
  /** Só na 1ª página (até 10.001 — a tela mostra "10.000+"). */
  contagem_total: number | null
}

/** O cursor da trilha: a última linha mostrada. */
export interface CursorAuditoria {
  em: string
  id: number
}

export interface FiltrosAuditoria {
  /** Uma pessoa (id do cadastro). */
  usuarioId: string | null
  /** true = só o Sistema · false = só pessoas · nulo = todo mundo. */
  sistema: boolean | null
  /** As ações de um tipo (grupo da tela); nulo = tudo. */
  acoes: string[] | null
  /** Desde quando (ISO); nulo = desde sempre. */
  desde: string | null
  /** Texto livre — só dígitos também acha o nº do pedido. */
  busca: string | null
}

export async function buscarAuditoria(
  filtros: FiltrosAuditoria,
  cursor: CursorAuditoria | null,
  porPagina: number,
): Promise<{ linhas: LinhaAuditoria[]; total: number | null; temMais: boolean }> {
  const { data, error } = await supabase.rpc('plt_fn_auditoria', {
    p_limite: porPagina,
    p_antes_em: cursor?.em ?? null,
    p_antes_id: cursor?.id ?? null,
    p_usuario: filtros.usuarioId,
    p_acoes: filtros.acoes,
    p_desde: filtros.desde,
    p_ate: null,
    p_busca: filtros.busca,
    p_sistema: filtros.sistema,
  })
  if (error) throw new Error(`Não deu para carregar a auditoria: ${error.message}`)
  const linhas = (data ?? []) as LinhaAuditoria[]
  return {
    linhas,
    total: cursor ? null : Number(linhas[0]?.contagem_total ?? 0),
    temMais: linhas[0]?.tem_mais ?? false,
  }
}

/** O resumo de uma rodada da conferência diária com o Tiny (o pente-fino). */
export interface RodadaConferencia {
  id: number
  registrado_em: string
  rodada: string
  estado: 'concluida' | 'interrompida'
  motivo: string
  inicio: string | null
  fim: string
  janela_dias: number
  paginas_busca: number
  relidos: number
  mudaram: number
  novos: number
  nao_encontrados: number
  falhas: number
  pendentes: number
  pedidos: { numero: string; campos: string[] }[]
  /** SESSAO-30 (D-122): as contas a receber na mesma rodada (rodadas antigas não têm). */
  contas?: {
    paginas_busca: number
    relidas: number
    novas: number
    /** Só as que já estavam aqui e viraram pagas (a 1ª rodada, de 09/10, não tem). */
    viraram_pagas?: number
    abertas: number
    nao_encontradas: number
  }
}

export interface ConferenciaEmAndamento {
  rodada: string
  inicio: string | null
  motivo: string
  na_fila: number
  lidos: number
  mudaram: number
}

export interface Conferencias {
  /** Só na 1ª página (as seguintes, pedidas ao rolar, vêm nulas). */
  em_andamento: ConferenciaEmAndamento | null
  /** A conferência das 3h está agendada? (nulo = ambiente sem relógio, ou página seguinte). */
  agendada: boolean | null
  /** Só na 1ª página. */
  total: number | null
  /** Há rodadas mais antigas depois desta página? */
  tem_mais: boolean
  rodadas: RodadaConferencia[]
}

/**
 * As rodadas da conferência por CURSOR (SESSAO-33 · migration 88 · D-141 —
 * "carrega mais ao rolar, sem números de página"): `antesId` = a última
 * rodada mostrada; nulo = 1ª página.
 */
export async function buscarConferencias(
  antesId: number | null,
  porPagina: number,
): Promise<Conferencias> {
  const { data, error } = await supabase.rpc('plt_fn_auditoria_conferencias', {
    p_limite: porPagina,
    p_antes_id: antesId,
  })
  if (error) throw new Error(`Não deu para carregar as conferências com o Tiny: ${error.message}`)
  if (!data)
    throw new Error(
      'Não deu para carregar as conferências com o Tiny: o servidor não devolveu dados.',
    )
  return data as Conferencias
}

// ---------------------------------------------------------------------------
// SESSAO-33 — a carga do Tiny (D-142/D-143): a contagem, a carga, a
// conferência "bateu com o Tiny" e a consulta de hora em hora. A aba inteira
// numa requisição (plt_fn_tiny_carga_painel); os gestos são do dono — o banco
// confere. Nada aqui traz token: a API nova aparece só como ligada ou não.
// ---------------------------------------------------------------------------
export type ContaTiny = 'loja' | 'fabrica'

export interface LinhaCensoTiny {
  conta: ContaTiny
  recurso: string
  rotulo: string | null
  /** O mês ("2026-09"), "antes" ou "tudo". */
  janela: string | null
  /** Quantos o Tiny tem (nulo enquanto a contagem não terminou). */
  tiny: number | null
  /** Quantos a plataforma tinha quando a contagem chegou (nulo enquanto não chegou). */
  aqui: number | null
  lido: boolean
}

export interface LinhaCargaTiny {
  conta: ContaTiny
  recurso: string
  rotulo: string | null
  pendentes: number
  em_andamento: number
  lidos: number
  nao_existem: number
  erros: number
}

export interface SomaCargaTiny {
  conta: ContaTiny
  recurso: string
  janela: string | null
  tiny: number | null
  aqui: number | null
  lido: boolean
}

export interface ErroTiny {
  conta: ContaTiny
  recurso: string
  rotulo: string | null
  referencia: string
  erro: string | null
  quando: string | null
}

export interface DadosCargaTiny {
  censo: { rodada: string | null; linhas: LinhaCensoTiny[] }
  carga: { rodada: string | null; por_recurso: LinhaCargaTiny[]; somas: SomaCargaTiny[] }
  /** O gesto "Pausar": a fila não pega a contagem nem a carga (a venda passa). */
  pausada: boolean
  /** A fila agora — cada número para em `teto` (a tela mostra "mais de"). */
  fila: {
    pendentes: number
    /** Esperando a nova tentativa depois de um erro ou do limite do minuto. */
    esperando: number
    pausados: number
    em_andamento: number
    erros: number
    teto: number
  }
  erros: ErroTiny[]
  mudancas: { ligada: boolean | null; ultima: string | null }
  api_nova: Record<ContaTiny, { ligada: boolean; renovada_em: string | null }>
}

export async function buscarCargaTiny(): Promise<DadosCargaTiny> {
  const { data, error } = await supabase.rpc('plt_fn_tiny_carga_painel')
  if (error) throw new Error(`Não deu para carregar a carga do Tiny: ${error.message}`)
  return data as DadosCargaTiny
}

export type AcaoCargaTiny = 'contar' | 'carregar' | 'pausar' | 'retomar'

export async function fazerCargaTiny(
  acao: AcaoCargaTiny,
): Promise<{ linhas: number; pausada: boolean }> {
  const { data, error } = await supabase.rpc('plt_fn_tiny_carga', { p_acao: acao })
  if (error) throw new Error(error.message)
  return data as { linhas: number; pausada: boolean }
}

export async function ligarMudancasTiny(ligar: boolean): Promise<{ resultado: string }> {
  const { data, error } = await supabase.rpc('plt_fn_tiny_mudancas_ligar', { p_ligar: ligar })
  if (error) throw new Error(error.message)
  return data as { resultado: string }
}
