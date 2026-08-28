import type { EventoLinhaTempo } from './tipos'

/**
 * Montagem da linha do tempo do card (SESSAO-05 / D-02).
 *
 * A verdade são os eventos (M-02); aqui eles viram a leitura humana que a
 * demanda pede: "cada etapa com fila, execução, total e autores".
 *
 * As regras espelham as do banco (plt_vw_execucoes):
 * - uma PERMANÊNCIA vai de um evento de posição ao próximo (ou até agora);
 * - a FILA é da chegada até o primeiro "iniciar" válido (D-02: fila é do setor,
 *   sem dono). Sem iniciar nenhum, o tempo é TODO fila;
 * - uma EXECUÇÃO vai do "iniciar" ao próximo marco válido: finalizar (fecha),
 *   outro iniciar (transferência — D-24) ou a saída da etapa (movimentação
 *   encerra sozinha — D-24);
 * - evento estornado não conta para tempo nenhum — mas continua na lista,
 *   riscado, porque histórico não se apaga (RNF-05).
 */

export type EncerramentoExecucao = 'finalizada' | 'transferencia' | 'movimentacao' | null

export interface ExecucaoSegmento {
  inicioEventoId: number
  autorInicio: string
  autorFim: string | null
  iniciouEm: number
  finalizouEm: number | null
  encerramento: EncerramentoExecucao
  duracaoMs: number
  /** De quem a execução foi assumida, quando foi transferência (D-24). */
  transferidoDe: string | null
}

export interface PermanenciaSegmento {
  eventoEntradaId: number
  setorNome: string
  etapaNome: string | null
  ehFila: boolean
  entrouEm: number
  saiuEm: number | null
  totalMs: number
  filaMs: number
  execucoes: ExecucaoSegmento[]
}

const TIPOS_POSICAO = new Set(['card_criado', 'movimentacao_setor', 'movimentacao_etapa'])

export function montarSegmentos(
  eventos: EventoLinhaTempo[],
  agora = Date.now(),
): PermanenciaSegmento[] {
  const ordenados = [...eventos].sort(
    (a, b) =>
      new Date(a.ocorrido_em).getTime() - new Date(b.ocorrido_em).getTime() ||
      a.evento_id - b.evento_id,
  )

  const posicoes = ordenados.filter(
    (e) => TIPOS_POSICAO.has(e.tipo) && e.setor_destino_id !== null,
  )

  return posicoes.map((entrada, indice) => {
    const proxima = posicoes[indice + 1]
    const entrouEm = new Date(entrada.ocorrido_em).getTime()
    const saiuEm = proxima ? new Date(proxima.ocorrido_em).getTime() : null
    const fim = saiuEm ?? agora

    // Gestos de execução VÁLIDOS desta permanência (estornado não conta tempo).
    const gestos = ordenados.filter((e) => {
      if (e.estornado) return false
      if (e.tipo !== 'execucao_iniciada' && e.tipo !== 'execucao_finalizada') return false
      const quando = new Date(e.ocorrido_em).getTime()
      const depoisDaEntrada =
        quando > entrouEm || (quando === entrouEm && e.evento_id > entrada.evento_id)
      const antesDaSaida =
        saiuEm === null ||
        quando < saiuEm ||
        (quando === saiuEm && proxima !== undefined && e.evento_id < proxima.evento_id)
      return depoisDaEntrada && antesDaSaida
    })

    const execucoes: ExecucaoSegmento[] = []
    for (let i = 0; i < gestos.length; i++) {
      const gesto = gestos[i]
      if (gesto.tipo !== 'execucao_iniciada') continue
      const proximoGesto = gestos[i + 1]
      const iniciouEm = new Date(gesto.ocorrido_em).getTime()
      let finalizouEm: number | null
      let encerramento: EncerramentoExecucao
      let autorFim: string | null = null
      if (proximoGesto === undefined) {
        if (saiuEm === null) {
          finalizouEm = null
          encerramento = null
        } else {
          finalizouEm = saiuEm
          encerramento = 'movimentacao'
        }
      } else if (proximoGesto.tipo === 'execucao_finalizada') {
        finalizouEm = new Date(proximoGesto.ocorrido_em).getTime()
        encerramento = 'finalizada'
        autorFim = proximoGesto.usuario_nome
      } else {
        finalizouEm = new Date(proximoGesto.ocorrido_em).getTime()
        encerramento = 'transferencia'
      }
      execucoes.push({
        inicioEventoId: gesto.evento_id,
        autorInicio: gesto.usuario_nome ?? '—',
        autorFim,
        iniciouEm,
        finalizouEm,
        encerramento,
        duracaoMs: (finalizouEm ?? agora) - iniciouEm,
        transferidoDe:
          typeof gesto.dados?.transferido_de === 'string' ? gesto.dados.transferido_de : null,
      })
    }

    // D-02: a fila vai da chegada até o PRIMEIRO iniciar. Sem iniciar, é toda fila.
    const primeiroInicio = execucoes[0]?.iniciouEm ?? null
    const filaMs = (primeiroInicio ?? fim) - entrouEm

    return {
      eventoEntradaId: entrada.evento_id,
      setorNome: entrada.setor_destino_nome ?? '—',
      etapaNome: entrada.etapa_destino_nome,
      ehFila: entrada.etapa_destino_eh_fila,
      entrouEm,
      saiuEm,
      totalMs: fim - entrouEm,
      filaMs,
      execucoes,
    }
  })
}

/**
 * O único gesto de execução estornável AGORA (regra do banco: desfaz-se do
 * mais novo para o mais velho) — é nele que a interface mostra o botão.
 */
export function eventoEstornavel(eventos: EventoLinhaTempo[]): EventoLinhaTempo | null {
  const candidatos = eventos
    .filter(
      (e) =>
        (e.tipo === 'execucao_iniciada' || e.tipo === 'execucao_finalizada') && !e.estornado,
    )
    .sort(
      (a, b) =>
        new Date(a.ocorrido_em).getTime() - new Date(b.ocorrido_em).getTime() ||
        a.evento_id - b.evento_id,
    )
  return candidatos[candidatos.length - 1] ?? null
}
