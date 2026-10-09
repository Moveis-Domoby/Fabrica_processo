import { supabase } from '@/lib/supabase'

/**
 * Camada de dados da AUDITORIA (SESSAO-29 · D-95 ↪️ D-40): duas portas de
 * leitura, só do admin (o gate mora no banco), paginadas no servidor — a tela
 * pede uma página por vez e o total vem na mesma consulta (regra 17).
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
  contagem_total: number
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
  pagina: number,
  porPagina: number,
): Promise<{ linhas: LinhaAuditoria[]; total: number }> {
  const { data, error } = await supabase.rpc('plt_fn_auditoria', {
    p_limite: porPagina,
    p_deslocamento: (pagina - 1) * porPagina,
    p_usuario: filtros.usuarioId,
    p_acoes: filtros.acoes,
    p_desde: filtros.desde,
    p_ate: null,
    p_busca: filtros.busca,
    p_sistema: filtros.sistema,
  })
  if (error) throw new Error(`Não deu para carregar a auditoria: ${error.message}`)
  const linhas = (data ?? []) as LinhaAuditoria[]
  return { linhas, total: Number(linhas[0]?.contagem_total ?? 0) }
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
  em_andamento: ConferenciaEmAndamento | null
  /** A conferência das 3h está agendada? (nulo = ambiente sem relógio). */
  agendada: boolean | null
  total: number
  rodadas: RodadaConferencia[]
}

export async function buscarConferencias(pagina: number, porPagina: number): Promise<Conferencias> {
  const { data, error } = await supabase.rpc('plt_fn_auditoria_conferencias', {
    p_limite: porPagina,
    p_deslocamento: (pagina - 1) * porPagina,
  })
  if (error) throw new Error(`Não deu para carregar as conferências com o Tiny: ${error.message}`)
  if (!data)
    throw new Error(
      'Não deu para carregar as conferências com o Tiny: o servidor não devolveu dados.',
    )
  return data as Conferencias
}
