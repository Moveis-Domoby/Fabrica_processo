import type { EventoLinhaTempo, PassagemDoCard, SituacaoPassagem, TrechoDoCard } from './tipos'
import {
  intersecao,
  periodosStandby,
  somar,
  subtrair,
  tempoDoMovelMs,
  tempoPcpMs,
  tempoUtilMs,
} from './tempoUtil'
import type { Intervalo, ReguaTempo, TempoDoPedidoNoPcp, TempoVivo } from './tempoUtil'
import { nomeDoLugar } from '@/logistica/lugar'

/**
 * SESSAO-38 · F5 (D-167 ⏳): o contexto do tempo ÚTIL — a régua do expediente
 * de cada setor e, quando a tela sabe, o pedido (o relógio do PCP é do
 * PEDIDO — D-48 — e desconta o stand-by). Sem contexto, a montagem é a de
 * sempre (relógio corrido).
 */
export interface ContextoTempo {
  regua?: ReguaTempo | null
  pedido?: TempoDoPedidoNoPcp | null
}

export type PapelDoSetor = 'entrada' | 'producao' | 'terminal'

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
 * - SESSAO-22 (D-48): o intervalo entre `execucao_pausada` e a retomada (ou o
 *   fim da execução) NÃO conta como tempo da pessoa — a duração desconta;
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
  /** Tempo QUE CONTA: do iniciar ao encerramento, menos as pausas (D-48). */
  duracaoMs: number
  /** SESSAO-22 (D-48): total pausado dentro desta execução (já descontado). */
  pausaMs: number
  /** SESSAO-22: pausada AGORA (execução aberta com pausa sem retomada). */
  pausada: boolean
  /** SESSAO-38 (F5): os trechos em que alguém trabalhou de fato (sem as pausas) — hora extra conta. */
  trabalho: Intervalo[]
  /** De quem a execução foi assumida, quando foi transferência (D-24). */
  transferidoDe: string | null
}

/** A dupla atestação de uma chegada (SESSAO-06/D-09), quando houve marcação. */
export interface QualidadeSegmento {
  estadoRemetente: NonNullable<EventoLinhaTempo['estado_qualidade']>
  remetenteNome: string | null
  setorRemetenteNome: string | null
  estadoRecebedor: NonNullable<EventoLinhaTempo['estado_qualidade']> | null
  recebedorNome: string | null
  divergente: boolean
  observacaoRecebedor: string | null
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
  /** SESSAO-38 (F5): o setor da permanência e o papel dele (o PCP e os fins de linha não têm fila). */
  setorId: number | null
  papel: PapelDoSetor | null
  /** SESSAO-38 (F5): a fila só no expediente do setor (= filaMs sem régua). */
  filaUtilMs: number
  /** SESSAO-38 (F5): o total só no expediente + o trabalho fora dele (= totalMs sem régua). */
  totalUtilMs: number
  /** SESSAO-38 (F5): no PCP, o tempo útil do PEDIDO (D-48), sem o stand-by; nulo fora do PCP. */
  pcpUtilMs: number | null
  /** SESSAO-38 (F5): quanto do relógio corrido foi stand-by (fora da conta). */
  standbyMs: number
  execucoes: ExecucaoSegmento[]
  /** null quando a chegada não teve marcação (saída do PCP, API — D-25). */
  qualidade: QualidadeSegmento | null
}

const TIPOS_POSICAO = new Set(['card_criado', 'movimentacao_setor', 'movimentacao_etapa'])

/**
 * Os períodos de stand-by escritos nos fatos do próprio card (o card do
 * pedido): cada "entrou" até a "saiu" que aponta para ele (ou até sempre).
 */
function standbyDosEventos(ordenados: EventoLinhaTempo[]): Intervalo[] {
  const saida: Intervalo[] = []
  for (const e of ordenados) {
    if (e.tipo !== 'pedido_standby_entrou') continue
    const fim = ordenados.find(
      (s) => s.tipo === 'pedido_standby_saiu' && s.evento_referencia_id === e.evento_id,
    )
    saida.push([
      new Date(e.ocorrido_em).getTime(),
      fim ? new Date(fim.ocorrido_em).getTime() : Infinity,
    ])
  }
  return saida
}

export function montarSegmentos(
  eventos: EventoLinhaTempo[],
  agora = Date.now(),
  contexto: ContextoTempo = {},
): PermanenciaSegmento[] {
  const ordenados = [...eventos].sort(
    (a, b) =>
      new Date(a.ocorrido_em).getTime() - new Date(b.ocorrido_em).getTime() ||
      a.evento_id - b.evento_id,
  )
  const regua = contexto.regua ?? null
  const pcpDoPedido = contexto.pedido ? tempoPcpMs(contexto.pedido, regua, agora) : null
  // o stand-by do card (os fatos dele) ou, na peça, o do pedido
  const standby = [...standbyDosEventos(ordenados), ...periodosStandby(contexto.pedido)]

  const posicoes = ordenados.filter((e) => TIPOS_POSICAO.has(e.tipo) && e.setor_destino_id !== null)

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
      // SESSAO-22 (D-48): as pausas desta execução — a pausa aponta o iniciar
      // (evento_referencia_id) e a retomada aponta a pausa. Pausa sem retomada
      // termina no fim da execução (ou agora, se ainda aberta).
      const fimExecucao = finalizouEm ?? agora
      let pausaMs = 0
      let pausada = false
      const pausas: Intervalo[] = []
      for (const pausa of ordenados) {
        if (pausa.tipo !== 'execucao_pausada') continue
        if (pausa.evento_referencia_id !== gesto.evento_id) continue
        const pausouEm = new Date(pausa.ocorrido_em).getTime()
        if (pausouEm >= fimExecucao) continue
        const retomada = ordenados.find(
          (r) => r.tipo === 'execucao_retomada' && r.evento_referencia_id === pausa.evento_id,
        )
        const voltouEm = retomada
          ? Math.min(new Date(retomada.ocorrido_em).getTime(), fimExecucao)
          : fimExecucao
        pausaMs += Math.max(voltouEm - pausouEm, 0)
        pausas.push([pausouEm, voltouEm])
        if (!retomada && finalizouEm === null) pausada = true
      }

      execucoes.push({
        inicioEventoId: gesto.evento_id,
        autorInicio: gesto.usuario_nome ?? '—',
        autorFim,
        iniciouEm,
        finalizouEm,
        encerramento,
        duracaoMs: (finalizouEm ?? agora) - iniciouEm - pausaMs,
        pausaMs,
        pausada,
        trabalho: subtrair([[iniciouEm, fimExecucao]], pausas),
        transferidoDe:
          typeof gesto.dados?.transferido_de === 'string' ? gesto.dados.transferido_de : null,
      })
    }

    // D-02: a fila vai da chegada até o PRIMEIRO iniciar. Sem iniciar, é toda fila.
    const primeiroInicio = execucoes[0]?.iniciouEm ?? null
    const filaMs = (primeiroInicio ?? fim) - entrouEm

    // SESSAO-38 (F5 · D-167): só o expediente do setor conta — a fila inteira
    // e o total; quem trabalhou fora do horário (hora extra) conta; o stand-by
    // não. No PCP vale o relógio do PEDIDO (D-48), quando a tela o conhece.
    const setorId = entrada.setor_destino_id
    const papel = (regua?.papeis?.[String(setorId)] as PapelDoSetor | undefined) ?? null
    const trabalho = execucoes.flatMap((e) => e.trabalho)
    const filaUtilMs = tempoUtilMs(entrouEm, primeiroInicio ?? fim, setorId, regua, {
      excluir: standby,
    })
    const totalUtilMs = tempoUtilMs(entrouEm, fim, setorId, regua, { trabalho, excluir: standby })
    const standbyMs = somar(intersecao(standby, [[entrouEm, fim]]))
    const pcpUtilMs = papel === 'entrada' ? (pcpDoPedido ?? totalUtilMs) : null

    // SESSAO-06 (D-09): a chegada entre setores pode carregar a marcação de
    // quem entregou (evento_referencia_id) e o parecer de quem recebeu.
    let qualidade: QualidadeSegmento | null = null
    if (entrada.tipo === 'movimentacao_setor' && entrada.evento_referencia_id !== null) {
      const marcacao = ordenados.find(
        (e) => e.evento_id === entrada.evento_referencia_id && e.tipo === 'qualidade_marcada',
      )
      if (marcacao?.estado_qualidade) {
        const parecer = ordenados.find(
          (e) => e.tipo === 'qualidade_parecer' && e.evento_referencia_id === marcacao.evento_id,
        )
        qualidade = {
          estadoRemetente: marcacao.estado_qualidade,
          remetenteNome: marcacao.usuario_nome,
          setorRemetenteNome: nomeDoLugar(marcacao.setor_origem_nome),
          estadoRecebedor: parecer?.estado_qualidade ?? null,
          recebedorNome: parecer?.usuario_nome ?? null,
          divergente:
            parecer?.estado_qualidade != null &&
            parecer.estado_qualidade !== marcacao.estado_qualidade,
          observacaoRecebedor: parecer?.observacao ?? null,
        }
      }
    }

    return {
      eventoEntradaId: entrada.evento_id,
      // SESSAO-38: o lugar interno "Pedidos em aguardo" se chama Expedição na tela
      setorNome: nomeDoLugar(entrada.setor_destino_nome) ?? '—',
      etapaNome: entrada.etapa_destino_nome,
      ehFila: entrada.etapa_destino_eh_fila,
      entrouEm,
      saiuEm,
      totalMs: fim - entrouEm,
      filaMs,
      setorId,
      papel,
      filaUtilMs,
      totalUtilMs,
      pcpUtilMs,
      standbyMs,
      execucoes,
      qualidade,
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
      (e) => (e.tipo === 'execucao_iniciada' || e.tipo === 'execucao_finalizada') && !e.estornado,
    )
    .sort(
      (a, b) =>
        new Date(a.ocorrido_em).getTime() - new Date(b.ocorrido_em).getTime() ||
        a.evento_id - b.evento_id,
    )
  return candidatos[candidatos.length - 1] ?? null
}

// ---------------------------------------------------------------------------
// SESSAO-42 (F4): os NÚMEROS de cada setor de produção vêm do banco — a
// passagem (fila útil, tempo do móvel, parado, total, situação) e os trechos
// (o tempo de cada execução, o clique errado, a pausa do fim do expediente).
// A linha do tempo continua montada pelos fatos (`montarSegmentos`); aqui as
// permanências de um setor de produção se juntam na passagem delas.
// ---------------------------------------------------------------------------

/** O tempo de uma execução da linha do tempo, pelos trechos do banco. */
export interface ExecucaoDoBanco {
  ms: number
  /** todos os trechos dela foram clique errado (volta rápida para a fila) — não conta */
  descartado: boolean
  /** algum trecho dela foi pausado sozinho no fim do expediente */
  fimDoExpediente: boolean
  /** algum trecho dela foi pausado por falta de resposta ao "ainda tem alguém?" */
  semResposta: boolean
}

/** A decisão manual sobre o tempo de uma passagem (o fato `tempo_decisao`). */
export interface DecisaoDoTempo {
  decisao: 'considerar' | 'descartar' | 'desfazer'
  motivo: string
  quem: string | null
  em: string
}

export interface BlocoPassagem {
  tipo: 'passagem'
  passagem: PassagemDoCard
  /** as permanências (etapas) desta passagem, na ordem */
  segmentos: PermanenciaSegmento[]
  aberta: boolean
  filaMs: number
  /** o TEMPO DO MÓVEL no setor (a união dos trechos, com a divisão) */
  movelMs: number
  paradoMs: number
  /** nulo enquanto o card está no setor */
  totalMs: number | null
  /** por id do fato que iniciou a execução (`ExecucaoSegmento.inicioEventoId`) */
  execucoes: Map<number, ExecucaoDoBanco>
  /** quem ajudou (o auxílio), com o tempo de cada pessoa */
  ajudas: { usuarioId: string; nome: string; ms: number }[]
  /** a situação em língua de gente, quando a passagem está fora da média */
  situacao: string | null
  decisao: DecisaoDoTempo | null
}

export type BlocoLinhaTempo = { tipo: 'segmento'; segmento: PermanenciaSegmento } | BlocoPassagem

const TEXTO_CONFERIR: Record<string, string> = {
  'Rápida demais': 'rápida demais',
  'Acima do teto do setor': 'acima do teto',
  'Longa para o modelo': 'longa para o modelo',
}

/**
 * A situação da passagem em língua de gente (nada de código na tela). Nulo =
 * aberta ou válida pela regra (entra na média sem nada a dizer).
 */
export function textoSituacaoPassagem(
  situacao: SituacaoPassagem,
  motivo: string | null,
): string | null {
  switch (situacao) {
    case 'aberta':
      return null
    case 'valida':
      return motivo === 'Considerada à mão' ? 'Na média: considerada à mão' : null
    case 'conferir':
      return `Fora da média: ${(motivo && TEXTO_CONFERIR[motivo]) ?? 'a conferir'}`
    case 'retrabalho':
      return 'Fora da média: retrabalho'
    case 'admin':
      return 'Fora da média: gesto de administrador'
    case 'sem_registro':
      return 'Fora da média: sem registro (pulou a execução)'
    case 'teste':
      return 'Fora da média: antes da data oficial'
    case 'descartada':
      return 'Fora da média: descartada à mão'
  }
}

const TEXTO_DECISAO: Record<DecisaoDoTempo['decisao'], string> = {
  considerar: 'considerar',
  descartar: 'descartar',
  desfazer: 'desfazer',
}

/** "Decidiu o tempo: descartar — motivo" (o fato `tempo_decisao`). */
export function textoDecisaoDoTempo(dados: Record<string, unknown> | null | undefined): string {
  const decisao = dados?.decisao
  const motivo = typeof dados?.motivo === 'string' ? dados.motivo : ''
  const qual =
    decisao === 'considerar' || decisao === 'descartar' || decisao === 'desfazer'
      ? TEXTO_DECISAO[decisao]
      : 'mudou'
  return `Decidiu o tempo: ${qual}${motivo ? ` — ${motivo}` : ''}`
}

/** A passagem de uma permanência: o mesmo setor, entre a entrada e a saída dela. */
function passagemDoSegmento(
  s: PermanenciaSegmento,
  passagens: PassagemDoCard[],
): PassagemDoCard | undefined {
  const exata = passagens.find((p) => Number(p.id) === s.eventoEntradaId)
  if (exata) return exata
  return passagens.find((p) => {
    if (s.setorId === null || Number(p.setor_id) !== s.setorId) return false
    const entrou = Date.parse(p.entrada_em)
    const saiu = p.saida_em ? Date.parse(p.saida_em) : Infinity
    return s.entrouEm >= entrou && s.entrouEm < saiu
  })
}

/** O que um trecho vale agora: o fechado como o banco gravou; o aberto, pela régua. */
function msDoTrecho(
  t: TrechoDoCard,
  setorId: number,
  regua: ReguaTempo | null,
  agora: number,
  vivo: TempoVivo | null,
): number {
  if (t.descartado) return 0
  if (t.fim !== null) return Math.max(0, Number(t.segundos) || 0) * 1000
  // o aberto: o mesmo cálculo do card (dividido como o banco disse, quando é o trecho dele)
  const dividir =
    vivo && vivo.desde !== null && Date.parse(vivo.desde) === Date.parse(t.inicio)
      ? vivo.dividir
      : 1
  return tempoDoMovelMs(
    {
      setor_id: setorId,
      fechado_s: 0,
      fila_s: 0,
      desde: t.inicio,
      corte: t.corte,
      dividir,
      usuario_id: t.usuario_id,
      lote: null,
    },
    regua,
    agora,
  )
}

/**
 * Junta as permanências (etapas) de cada setor de produção na PASSAGEM do
 * banco e põe nela os números do cálculo único. Sem passagens (banco de
 * antes), devolve as permanências como sempre. `vivo` é o tempo do card que a
 * tela já tem (o quadro ou a janela) — com ele, o tempo do móvel da passagem
 * aberta bate com o do card.
 */
export function montarBlocos(
  segmentos: PermanenciaSegmento[],
  dados: { eventos: EventoLinhaTempo[]; passagens: PassagemDoCard[]; trechos: TrechoDoCard[] },
  agora: number,
  regua: ReguaTempo | null,
  vivo: TempoVivo | null = null,
): BlocoLinhaTempo[] {
  const { eventos, passagens, trechos } = dados
  if (passagens.length === 0) return segmentos.map((s) => ({ tipo: 'segmento', segmento: s }))
  const nomePorEvento = new Map(eventos.map((e) => [e.evento_id, e.usuario_nome]))
  const blocos: BlocoLinhaTempo[] = []
  for (const s of segmentos) {
    const p = passagemDoSegmento(s, passagens)
    const ultimo = blocos[blocos.length - 1]
    if (!p) {
      blocos.push({ tipo: 'segmento', segmento: s })
      continue
    }
    if (ultimo?.tipo === 'passagem' && ultimo.passagem.id === p.id) {
      ultimo.segmentos.push(s)
      continue
    }
    const setorId = Number(p.setor_id)
    const aberta = p.saida_em === null
    const daPassagem = trechos.filter((t) => Number(t.passagem_id) === Number(p.id))
    const vivoAqui = aberta && vivo && Number(vivo.setor_id) === setorId ? vivo : null
    const execucaoAberta = daPassagem.find(
      (t) => t.papel === 'execucao' && t.fim === null && !t.descartado,
    )

    // o tempo do móvel: fechado = o do banco; aberto = o fechado + o vivo
    let movelMs = Math.max(0, Number(p.execucao_s) || 0) * 1000
    if (aberta && vivoAqui) movelMs = tempoDoMovelMs(vivoAqui, regua, agora)
    else if (aberta && execucaoAberta && !p.lote)
      movelMs =
        Math.max(0, Number(p.execucao_fechada_s) || 0) * 1000 +
        msDoTrecho(execucaoAberta, setorId, regua, agora, null)

    // a fila: a do banco; aberta e ninguém iniciou ainda, conta até agora pela régua
    const ninguemIniciou = !daPassagem.some((t) => t.papel === 'execucao')
    const filaMs =
      aberta && ninguemIniciou
        ? tempoUtilMs(Date.parse(p.entrada_em), agora, setorId, regua)
        : Math.max(0, Number(p.fila_s) || 0) * 1000

    // a ajuda (auxílio): o tempo de cada pessoa
    const ajudas = new Map<string, { usuarioId: string; nome: string; ms: number }>()
    for (const t of daPassagem) {
      if (t.papel !== 'auxilio') continue
      const atual = ajudas.get(t.usuario_id) ?? {
        usuarioId: t.usuario_id,
        nome: nomePorEvento.get(Number(t.id)) ?? 'alguém',
        ms: 0,
      }
      atual.ms += msDoTrecho(t, setorId, regua, agora, null)
      ajudas.set(t.usuario_id, atual)
    }

    // a decisão manual mais recente desta passagem (não estornada)
    const decisaoEvento = eventos
      .filter(
        (e) =>
          e.tipo === 'tempo_decisao' &&
          !e.estornado &&
          String(e.dados?.passagem_id ?? '') === String(p.id),
      )
      .sort(
        (a, b) =>
          Date.parse(b.ocorrido_em) - Date.parse(a.ocorrido_em) || b.evento_id - a.evento_id,
      )[0]
    const decisao: DecisaoDoTempo | null =
      decisaoEvento &&
      (decisaoEvento.dados?.decisao === 'considerar' ||
        decisaoEvento.dados?.decisao === 'descartar' ||
        decisaoEvento.dados?.decisao === 'desfazer')
        ? {
            decisao: decisaoEvento.dados.decisao,
            motivo:
              typeof decisaoEvento.dados.motivo === 'string' ? decisaoEvento.dados.motivo : '',
            quem: decisaoEvento.usuario_nome,
            em: decisaoEvento.ocorrido_em,
          }
        : null

    blocos.push({
      tipo: 'passagem',
      passagem: p,
      segmentos: [s],
      aberta,
      filaMs,
      movelMs,
      paradoMs: Math.max(0, Number(p.parado_s) || 0) * 1000,
      totalMs: aberta ? null : Math.max(0, Number(p.total_s) || 0) * 1000,
      execucoes: new Map(),
      ajudas: [...ajudas.values()],
      situacao: textoSituacaoPassagem(p.situacao, p.motivo),
      decisao,
    })
  }
  // cada execução da linha do tempo (em qualquer etapa da passagem): os
  // trechos dela — o iniciar e as retomadas, até o fim da execução
  for (const b of blocos) {
    if (b.tipo !== 'passagem') continue
    const setorId = Number(b.passagem.setor_id)
    const daPassagem = trechos.filter((t) => Number(t.passagem_id) === Number(b.passagem.id))
    const vivoAqui = b.aberta && vivo && Number(vivo.setor_id) === setorId ? vivo : null
    for (const s of b.segmentos) {
      for (const e of s.execucoes) {
        const dela = daPassagem.filter((t) => {
          if (t.papel !== 'execucao') return false
          const ini = Date.parse(t.inicio)
          return ini >= e.iniciouEm && (e.finalizouEm === null || ini < e.finalizouEm)
        })
        if (dela.length === 0) continue
        b.execucoes.set(e.inicioEventoId, {
          ms: dela.reduce((soma, t) => soma + msDoTrecho(t, setorId, regua, agora, vivoAqui), 0),
          descartado: dela.every((t) => t.descartado),
          fimDoExpediente: dela.some((t) => t.fim_tipo === 'fim_expediente'),
          semResposta: dela.some((t) => t.fim_tipo === 'sem_resposta'),
        })
      }
    }
  }
  return blocos
}
