import type { Card, Etapa, Setor } from './tipos'

/**
 * O quadro por ARRASTO (SESSAO-24 — dono, 27/09: "tudo arrastando, é mais
 * rápido"). Quem decide de verdade é o banco (plt_fn_soltar_card); aqui a
 * tela só sabe, antes de soltar, se precisa perguntar algo: o estado da peça
 * (etapa que encaminha — D-09) ou o parecer de quem recebe (etapa de início).
 */

/**
 * A etapa de INÍCIO do setor — a próxima depois da fila (ordem seguinte,
 * ativa, não-DANIFICADO, que não encaminha). Espelho de
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
        (e.ordem > fila.ordem || (e.ordem === fila.ordem && e.id > fila.id)),
    )
    .sort((a, b) => a.ordem - b.ordem || a.id - b.id)[0]
}

export type AcaoAoSoltar =
  | { tipo: 'encaminhar'; etapa: Etapa; setorDestinoId: number }
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
 * Só a LIMPEZA E EMBALAGEM conclui a produção (dono, 27/09: "todos os móveis
 * que vão para estoque passam por ele e eles que movem para estoque") — o
 * único botão que sobrou nos quadros.
 */
export function setorConcluiProducao(setor: Pick<Setor, 'codigo'> | undefined | null): boolean {
  return setor?.codigo === 'limpeza_embalagem'
}
