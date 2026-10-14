import type { Card, Etapa, Setor, TipoQualidade } from './tipos'

/**
 * O quadro por ARRASTO (SESSAO-24 — dono, 27/09: "tudo arrastando, é mais
 * rápido"). Quem decide de verdade é o banco (plt_fn_soltar_card); aqui a
 * tela só sabe, antes de soltar, se precisa perguntar algo: o estado da peça
 * (quando o setor pede ao enviar — D-126) ou a confirmação de quem recebe
 * (etapa de início, quando a chegada ficou pendente).
 */

/**
 * A etapa de INÍCIO do setor — a próxima depois da fila (ordem seguinte,
 * ativa, não-DANIFICADO, que não encaminha nem conclui). Espelho de
 * `plt_privado.fn_etapa_inicio`: soltar o card aqui inicia o tempo de quem
 * arrastou ("de A MONTAR para MONTANDO, o card já deve ser iniciado").
 */
export function etapaDeInicio(etapas: readonly Etapa[]): Etapa | undefined {
  const fila = etapas.find((e) => e.eh_fila && e.ativa)
  if (!fila) return undefined
  return etapas
    .filter(
      (e) =>
        e.ativa &&
        !e.eh_fila &&
        !e.eh_danificado &&
        e.setor_destino_id === null &&
        !e.conclui_producao &&
        (e.ordem > fila.ordem || (e.ordem === fila.ordem && e.id > fila.id)),
    )
    .sort((a, b) => a.ordem - b.ordem || a.id - b.id)[0]
}

export type AcaoAoSoltar =
  | { tipo: 'encaminhar'; etapa: Etapa; setorDestinoId: number }
  | { tipo: 'concluir'; etapa: Etapa }
  | { tipo: 'iniciar' }
  | { tipo: 'mover' }

/** O que soltar o card nesta coluna vai fazer (a mesma regra do banco). */
export function acaoAoSoltar(parametros: {
  setor: Pick<Setor, 'papel_no_fluxo'>
  etapas: readonly Etapa[]
  card: Pick<Card, 'tipo'>
  etapaDestinoId: number | null
}): AcaoAoSoltar {
  const { setor, etapas, card, etapaDestinoId } = parametros
  if (etapaDestinoId === null) return { tipo: 'mover' }
  const etapa = etapas.find((e) => e.id === etapaDestinoId)
  if (!etapa) return { tipo: 'mover' }
  if (etapa.setor_destino_id !== null) {
    return { tipo: 'encaminhar', etapa, setorDestinoId: etapa.setor_destino_id }
  }
  // SESSAO-31 (D-127): a EXPEDIÇÃO da LIMPEZA E EMBALAGEM conclui a produção
  // da peça; o card que não é peça só se move nela.
  if (etapa.conclui_producao && card.tipo === 'unidade') {
    return { tipo: 'concluir', etapa }
  }
  if (
    setor.papel_no_fluxo === 'producao' &&
    card.tipo === 'unidade' &&
    etapaDeInicio(etapas)?.id === etapa.id
  ) {
    return { tipo: 'iniciar' }
  }
  return { tipo: 'mover' }
}

/**
 * SESSAO-31 (D-126): o tipo de card das chaves de estado — espelho de
 * `plt_privado.fn_tipo_qualidade`. Card do pedido e de reposição não andam
 * pela produção: não entram.
 */
export function tipoQualidade(card: Pick<Card, 'tipo' | 'pedido_id'>): TipoQualidade | null {
  if (card.tipo === 'unidade') return card.pedido_id !== null ? 'peca_pedido' : 'peca_estoque'
  if ((card.tipo as string) === 'avulso') return 'avulso'
  return null
}

/**
 * SESSAO-31 (D-126): o setor pede o estado da peça ao ENVIAR este card? Espelho
 * de `plt_privado.fn_pede_estado` — tudo nasce desligado; quem liga é o admin
 * em Setores e etapas. Sem pedido, o quadro manda direto (sem modal).
 */
export function pedeEstadoAoEnviar(
  setor: Pick<Setor, 'papel_no_fluxo' | 'qualidade_envio_tipos'>,
  card: Pick<Card, 'tipo' | 'pedido_id'>,
): boolean {
  if (setor.papel_no_fluxo !== 'producao') return false
  const tipo = tipoQualidade(card)
  return tipo !== null && (setor.qualidade_envio_tipos ?? []).includes(tipo)
}
