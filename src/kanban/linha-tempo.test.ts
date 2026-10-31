import { describe, expect, it } from 'vitest'
import {
  eventoEstornavel,
  montarBlocos,
  montarSegmentos,
  textoDecisaoDoTempo,
  textoSituacaoPassagem,
} from './linha-tempo'
import type { EventoLinhaTempo, PassagemDoCard, TrechoDoCard } from './tipos'

/**
 * A montagem da linha do tempo é lógica pura — testada aqui contra os mesmos
 * cenários que o teste de banco prova nas views (SESSAO-05 / D-02 / D-24).
 */

const T0 = Date.parse('2026-08-27T08:00:00Z')
const minuto = 60_000

function evento(parcial: Partial<EventoLinhaTempo> & { evento_id: number }): EventoLinhaTempo {
  return {
    tipo: 'card_criado',
    ocorrido_em: new Date(T0).toISOString(),
    usuario_id: null,
    usuario_nome: null,
    setor_origem_id: null,
    setor_origem_nome: null,
    etapa_origem_nome: null,
    setor_destino_id: null,
    setor_destino_nome: null,
    etapa_destino_nome: null,
    etapa_destino_eh_fila: false,
    estado_qualidade: null,
    observacao: null,
    origem: 'interface',
    evento_referencia_id: null,
    estornado: false,
    dados: {},
    ...parcial,
  }
}

function em(minutos: number): string {
  return new Date(T0 + minutos * minuto).toISOString()
}

describe('montarSegmentos', () => {
  it('card em 2 etapas: fila, execução, total e autores de cada uma (critério da demanda)', () => {
    const eventos: EventoLinhaTempo[] = [
      evento({
        evento_id: 1,
        tipo: 'card_criado',
        ocorrido_em: em(0),
        setor_destino_id: 1,
        setor_destino_nome: 'PCP',
      }),
      evento({
        evento_id: 2,
        tipo: 'movimentacao_setor',
        ocorrido_em: em(10),
        setor_destino_id: 2,
        setor_destino_nome: 'SECC',
        etapa_destino_nome: 'EM CORTE',
      }),
      evento({ evento_id: 3, tipo: 'execucao_iniciada', ocorrido_em: em(25), usuario_nome: 'Ana' }),
      evento({
        evento_id: 4,
        tipo: 'execucao_finalizada',
        ocorrido_em: em(55),
        usuario_nome: 'Ana',
      }),
      evento({
        evento_id: 5,
        tipo: 'movimentacao_setor',
        ocorrido_em: em(60),
        setor_destino_id: 3,
        setor_destino_nome: 'FITAMENTO',
      }),
    ]
    const segmentos = montarSegmentos(eventos, T0 + 90 * minuto)

    expect(segmentos).toHaveLength(3)

    // PCP: nunca iniciou → tempo todo é fila (critério da demanda).
    expect(segmentos[0].setorNome).toBe('PCP')
    expect(segmentos[0].totalMs).toBe(10 * minuto)
    expect(segmentos[0].filaMs).toBe(10 * minuto)
    expect(segmentos[0].execucoes).toHaveLength(0)

    // SECC: 15min de fila, 30min de execução da Ana, 50min de total.
    expect(segmentos[1].etapaNome).toBe('EM CORTE')
    expect(segmentos[1].filaMs).toBe(15 * minuto)
    expect(segmentos[1].totalMs).toBe(50 * minuto)
    expect(segmentos[1].execucoes).toEqual([
      expect.objectContaining({
        autorInicio: 'Ana',
        autorFim: 'Ana',
        encerramento: 'finalizada',
        duracaoMs: 30 * minuto,
      }),
    ])

    // FITAMENTO: permanência aberta, contando até agora.
    expect(segmentos[2].saiuEm).toBeNull()
    expect(segmentos[2].totalMs).toBe(30 * minuto)
  })

  it('transferência (D-24): fecha para um, abre para o outro, tempo do produto segue', () => {
    const eventos: EventoLinhaTempo[] = [
      evento({
        evento_id: 1,
        tipo: 'card_criado',
        ocorrido_em: em(0),
        setor_destino_id: 2,
        setor_destino_nome: 'SECC',
      }),
      evento({
        evento_id: 2,
        tipo: 'execucao_iniciada',
        ocorrido_em: em(5),
        usuario_nome: 'Ana',
        usuario_id: 'ana',
      }),
      evento({
        evento_id: 3,
        tipo: 'execucao_iniciada',
        ocorrido_em: em(20),
        usuario_nome: 'Beto',
        dados: { transferido_de: 'ana' },
      }),
    ]
    const [segmento] = montarSegmentos(eventos, T0 + 30 * minuto)

    expect(segmento.execucoes).toHaveLength(2)
    expect(segmento.execucoes[0]).toMatchObject({
      autorInicio: 'Ana',
      encerramento: 'transferencia',
      duracaoMs: 15 * minuto,
    })
    expect(segmento.execucoes[1]).toMatchObject({
      autorInicio: 'Beto',
      encerramento: null,
      duracaoMs: 10 * minuto,
      transferidoDe: 'ana',
    })
    // A fila fecha no PRIMEIRO iniciar e não reabre com a transferência.
    expect(segmento.filaMs).toBe(5 * minuto)
  })

  it('pausa do líder desconta da execução (SESSAO-22/D-48): 90min − 70min pausados = 20min', () => {
    // Espelho da prova do test:banco: inicia em 0, pausa em 10, retoma em 80,
    // finaliza em 90 → 20min contados, 70min pausados.
    const eventos: EventoLinhaTempo[] = [
      evento({
        evento_id: 1,
        tipo: 'card_criado',
        ocorrido_em: em(-5),
        setor_destino_id: 2,
        setor_destino_nome: 'SECC',
      }),
      evento({ evento_id: 2, tipo: 'execucao_iniciada', ocorrido_em: em(0), usuario_nome: 'Ana' }),
      evento({
        evento_id: 3,
        tipo: 'execucao_pausada',
        ocorrido_em: em(10),
        usuario_nome: 'Líder',
        evento_referencia_id: 2,
      }),
      evento({
        evento_id: 4,
        tipo: 'execucao_retomada',
        ocorrido_em: em(80),
        usuario_nome: 'Ana',
        evento_referencia_id: 3,
      }),
      evento({
        evento_id: 5,
        tipo: 'execucao_finalizada',
        ocorrido_em: em(90),
        usuario_nome: 'Ana',
      }),
    ]
    const [segmento] = montarSegmentos(eventos, T0 + 120 * minuto)

    expect(segmento.execucoes[0]).toMatchObject({
      encerramento: 'finalizada',
      duracaoMs: 20 * minuto,
      pausaMs: 70 * minuto,
      pausada: false,
    })
  })

  it('pausa sem retomada em execução aberta: pausada agora, e o relógio dela não anda', () => {
    const eventos: EventoLinhaTempo[] = [
      evento({
        evento_id: 1,
        tipo: 'card_criado',
        ocorrido_em: em(0),
        setor_destino_id: 2,
        setor_destino_nome: 'SECC',
      }),
      evento({ evento_id: 2, tipo: 'execucao_iniciada', ocorrido_em: em(10), usuario_nome: 'Ana' }),
      evento({
        evento_id: 3,
        tipo: 'execucao_pausada',
        ocorrido_em: em(30),
        usuario_nome: 'Líder',
        evento_referencia_id: 2,
      }),
    ]
    const [segmento] = montarSegmentos(eventos, T0 + 60 * minuto)

    // 50min de relógio desde o iniciar, mas só os 20min antes da pausa contam.
    expect(segmento.execucoes[0]).toMatchObject({
      encerramento: null,
      duracaoMs: 20 * minuto,
      pausaMs: 30 * minuto,
      pausada: true,
    })
  })

  it('mover com execução aberta encerra a execução naquele instante (D-24)', () => {
    const eventos: EventoLinhaTempo[] = [
      evento({
        evento_id: 1,
        tipo: 'card_criado',
        ocorrido_em: em(0),
        setor_destino_id: 2,
        setor_destino_nome: 'SECC',
      }),
      evento({ evento_id: 2, tipo: 'execucao_iniciada', ocorrido_em: em(10), usuario_nome: 'Ana' }),
      evento({
        evento_id: 3,
        tipo: 'movimentacao_setor',
        ocorrido_em: em(40),
        setor_destino_id: 3,
        setor_destino_nome: 'CNC',
      }),
    ]
    const segmentos = montarSegmentos(eventos, T0 + 60 * minuto)

    expect(segmentos[0].execucoes[0]).toMatchObject({
      encerramento: 'movimentacao',
      duracaoMs: 30 * minuto,
    })
    expect(segmentos[0].totalMs).toBe(40 * minuto)
  })

  it('a chegada com marcação carrega a dupla atestação — e a divergência (SESSAO-06/D-09)', () => {
    const eventos: EventoLinhaTempo[] = [
      evento({
        evento_id: 1,
        tipo: 'card_criado',
        ocorrido_em: em(0),
        setor_destino_id: 1,
        setor_destino_nome: 'PCP',
      }),
      evento({
        evento_id: 2,
        tipo: 'qualidade_marcada',
        ocorrido_em: em(10),
        usuario_nome: 'Ana',
        setor_origem_id: 1,
        setor_origem_nome: 'SECC',
        setor_destino_id: 2,
        estado_qualidade: 'atencao',
      }),
      evento({
        evento_id: 3,
        tipo: 'movimentacao_setor',
        ocorrido_em: em(10),
        setor_destino_id: 2,
        setor_destino_nome: 'FITAMENTO',
        evento_referencia_id: 2,
      }),
      evento({
        evento_id: 4,
        tipo: 'qualidade_parecer',
        ocorrido_em: em(20),
        usuario_nome: 'Beto',
        estado_qualidade: 'danificado',
        evento_referencia_id: 2,
        observacao: 'quina lascada',
      }),
    ]
    const segmentos = montarSegmentos(eventos, T0 + 30 * minuto)

    // A criação no PCP não tem marcação (D-25) — qualidade nula.
    expect(segmentos[0].qualidade).toBeNull()
    // A chegada na FITAMENTO conta a história inteira, com divergência.
    expect(segmentos[1].qualidade).toMatchObject({
      estadoRemetente: 'atencao',
      remetenteNome: 'Ana',
      setorRemetenteNome: 'SECC',
      estadoRecebedor: 'danificado',
      recebedorNome: 'Beto',
      divergente: true,
      observacaoRecebedor: 'quina lascada',
    })
  })

  it('chegada marcada e ainda sem parecer aparece como pendente (SESSAO-06)', () => {
    const eventos: EventoLinhaTempo[] = [
      evento({
        evento_id: 2,
        tipo: 'qualidade_marcada',
        ocorrido_em: em(10),
        usuario_nome: 'Ana',
        setor_origem_nome: 'SECC',
        estado_qualidade: 'perfeito',
      }),
      evento({
        evento_id: 3,
        tipo: 'movimentacao_setor',
        ocorrido_em: em(10),
        setor_destino_id: 2,
        setor_destino_nome: 'FITAMENTO',
        evento_referencia_id: 2,
      }),
    ]
    const [segmento] = montarSegmentos(eventos, T0 + 30 * minuto)
    expect(segmento.qualidade).toMatchObject({
      estadoRemetente: 'perfeito',
      estadoRecebedor: null,
      divergente: false,
    })
  })

  it('evento estornado não conta tempo, mas a lista original continua intacta', () => {
    const eventos: EventoLinhaTempo[] = [
      evento({
        evento_id: 1,
        tipo: 'card_criado',
        ocorrido_em: em(0),
        setor_destino_id: 2,
        setor_destino_nome: 'SECC',
      }),
      evento({ evento_id: 2, tipo: 'execucao_iniciada', ocorrido_em: em(10), usuario_nome: 'Ana' }),
      evento({
        evento_id: 3,
        tipo: 'execucao_finalizada',
        ocorrido_em: em(20),
        usuario_nome: 'Ana',
        estornado: true,
      }),
      evento({
        evento_id: 4,
        tipo: 'estorno',
        ocorrido_em: em(25),
        usuario_nome: 'Líder',
        evento_referencia_id: 3,
      }),
    ]
    const [segmento] = montarSegmentos(eventos, T0 + 30 * minuto)

    // A finalização estornada não fecha a execução: ela segue aberta.
    expect(segmento.execucoes).toHaveLength(1)
    expect(segmento.execucoes[0].encerramento).toBeNull()
    expect(segmento.execucoes[0].duracaoMs).toBe(20 * minuto)
  })
})

describe('eventoEstornavel', () => {
  it('aponta o último gesto de execução válido — e só ele', () => {
    const eventos: EventoLinhaTempo[] = [
      evento({ evento_id: 2, tipo: 'execucao_iniciada', ocorrido_em: em(10) }),
      evento({ evento_id: 3, tipo: 'execucao_finalizada', ocorrido_em: em(20) }),
    ]
    expect(eventoEstornavel(eventos)?.evento_id).toBe(3)
  })

  it('depois do estorno da finalização, o estornável passa a ser o iniciar', () => {
    const eventos: EventoLinhaTempo[] = [
      evento({ evento_id: 2, tipo: 'execucao_iniciada', ocorrido_em: em(10) }),
      evento({ evento_id: 3, tipo: 'execucao_finalizada', ocorrido_em: em(20), estornado: true }),
      evento({ evento_id: 4, tipo: 'estorno', ocorrido_em: em(25), evento_referencia_id: 3 }),
    ]
    expect(eventoEstornavel(eventos)?.evento_id).toBe(2)
  })

  it('sem gesto de execução válido, não há o que estornar', () => {
    const eventos: EventoLinhaTempo[] = [
      evento({ evento_id: 1, tipo: 'card_criado', ocorrido_em: em(0), setor_destino_id: 1 }),
    ]
    expect(eventoEstornavel(eventos)).toBeNull()
  })
})

describe('montarSegmentos com o tempo útil (SESSAO-38 · F5)', () => {
  // seg 19/10/2026 07:30 em Natal = 10:30 UTC; os setores 07:30–18:00, seg–sex
  const SEG = Date.parse('2026-10-19T10:30:00Z')
  const H = 3_600_000
  const quando = (horas: number) => new Date(SEG + horas * H).toISOString()
  const janelas = [1, 2, 3, 4, 5].flatMap((d) =>
    [1, 3, 235].map((s) => [s, d, '07:30:00', '18:00:00'] as [number, number, string, string]),
  )
  const regua = {
    fuso_min: -180,
    pcp_setor_id: 1,
    papeis: { '1': 'entrada', '3': 'producao', '235': 'terminal' } as Record<
      string,
      'entrada' | 'producao' | 'terminal'
    >,
    janelas,
    pausas: [] as [number, string, string | null][],
  }

  it('o PCP não tem fila: o bloco é o tempo útil do pedido; a fila do setor para de noite; hora extra conta', () => {
    const eventos: EventoLinhaTempo[] = [
      evento({
        evento_id: 1,
        tipo: 'card_criado',
        ocorrido_em: quando(0),
        setor_destino_id: 1,
        setor_destino_nome: 'PCP',
      }),
      // liberada no fim da tarde para o CNC (fila a noite toda)
      evento({
        evento_id: 2,
        tipo: 'movimentacao_setor',
        ocorrido_em: quando(10),
        setor_destino_id: 3,
        setor_destino_nome: 'CNC',
      }),
      // terça 08:30: iniciou; 19:30 (hora extra) finalizou
      evento({
        evento_id: 3,
        tipo: 'execucao_iniciada',
        ocorrido_em: quando(25),
        usuario_nome: 'Ana',
      }),
      evento({
        evento_id: 4,
        tipo: 'execucao_finalizada',
        ocorrido_em: quando(36),
        usuario_nome: 'Ana',
      }),
      evento({
        evento_id: 5,
        tipo: 'movimentacao_setor',
        ocorrido_em: quando(36),
        setor_destino_id: 235,
        setor_destino_nome: 'PEDIDOS EM AGUARDO',
      }),
    ]
    const pedido = {
      entrou_pcp_em: quando(-2), // seg 05:30 — antes do expediente
      liberado_completo_em: quando(10),
      standby_periodos: [{ ini: quando(1), fim: quando(3) }],
    }
    const [pcp, cnc, fim] = montarSegmentos(eventos, SEG + 40 * H, { regua, pedido })

    expect(pcp.papel).toBe('entrada')
    // do pedido: 07:30–17:30 = 10 h de expediente, menos 2 h de stand-by
    expect(pcp.pcpUtilMs).toBe(8 * H)
    // CNC: fila seg 17:30 → ter 08:30 = 30 min (seg) + 1 h (ter)
    expect(cnc.filaMs).toBe(15 * H)
    expect(cnc.filaUtilMs).toBe(1.5 * H)
    // total: a fila útil + a execução inteira (das 08:30 às 19:30 — a hora extra conta)
    expect(cnc.totalUtilMs).toBe(1.5 * H + 11 * H)
    // o fim de linha também não tem fila — e se chama Expedição na tela
    expect(fim.papel).toBe('terminal')
    expect(fim.setorNome).toBe('Expedição')
  })

  it('o stand-by no próprio card do pedido (os fatos dele) sai da conta', () => {
    const eventos: EventoLinhaTempo[] = [
      evento({
        evento_id: 1,
        tipo: 'card_criado',
        ocorrido_em: quando(0),
        setor_destino_id: 1,
        setor_destino_nome: 'PCP',
      }),
      evento({ evento_id: 2, tipo: 'pedido_standby_entrou', ocorrido_em: quando(2) }),
      evento({
        evento_id: 3,
        tipo: 'pedido_standby_saiu',
        ocorrido_em: quando(5),
        evento_referencia_id: 2,
      }),
    ]
    const [pcp] = montarSegmentos(eventos, SEG + 8 * H, { regua })
    expect(pcp.standbyMs).toBe(3 * H)
    expect(pcp.pcpUtilMs).toBe(5 * H)
  })
})

/**
 * SESSAO-42 (F4): os números de cada setor de produção vêm do banco — as
 * etapas do mesmo setor se juntam na PASSAGEM (casada pelo fato da entrada).
 */
describe('montarBlocos — a passagem do banco (SESSAO-42)', () => {
  const eventosDaMontagem: EventoLinhaTempo[] = [
    evento({
      evento_id: 1,
      tipo: 'card_criado',
      ocorrido_em: em(0),
      setor_destino_id: 1,
      setor_destino_nome: 'PCP',
    }),
    evento({
      evento_id: 2,
      tipo: 'movimentacao_setor',
      ocorrido_em: em(10),
      setor_destino_id: 5,
      setor_destino_nome: 'MONTAGEM',
      etapa_destino_nome: 'A MONTAR',
      etapa_destino_eh_fila: true,
    }),
    evento({
      evento_id: 3,
      tipo: 'movimentacao_etapa',
      ocorrido_em: em(30),
      setor_destino_id: 5,
      setor_destino_nome: 'MONTAGEM',
      etapa_destino_nome: 'MONTANDO',
    }),
    evento({
      evento_id: 4,
      tipo: 'execucao_iniciada',
      ocorrido_em: em(30),
      usuario_nome: 'Franklin',
    }),
    evento({
      evento_id: 5,
      tipo: 'execucao_finalizada',
      ocorrido_em: em(90),
      usuario_nome: 'Franklin',
    }),
    evento({
      evento_id: 6,
      tipo: 'movimentacao_setor',
      ocorrido_em: em(100),
      setor_destino_id: 7,
      setor_destino_nome: 'LIMPEZA',
    }),
    evento({
      evento_id: 7,
      tipo: 'tempo_decisao',
      ocorrido_em: em(120),
      usuario_nome: 'Dono',
      dados: { passagem_id: 2, decisao: 'considerar', motivo: 'Móvel pequeno' },
    }),
  ]
  const passagem = (parcial: Partial<PassagemDoCard>): PassagemDoCard => ({
    id: 2,
    setor_id: 5,
    entrada_em: em(10),
    saida_em: em(100),
    fila_s: 1200,
    execucao_s: 2400,
    execucao_fechada_s: 2400,
    parado_s: 600,
    total_s: 4200,
    esforco_s: 2400,
    situacao: 'conferir',
    motivo: 'Rápida demais',
    desfecho: 'saiu',
    lote: false,
    modelo: 'Closet',
    ...parcial,
  })
  const trecho = (parcial: Partial<TrechoDoCard>): TrechoDoCard => ({
    id: 4,
    passagem_id: 2,
    usuario_id: 'u-franklin',
    papel: 'execucao',
    inicio: em(30),
    fim: em(90),
    fim_tipo: 'fim_expediente',
    corte: null,
    segundos: 2400,
    util_s: 2400,
    descartado: false,
    ...parcial,
  })

  it('junta as etapas do setor na passagem e usa os números do banco', () => {
    const agora = T0 + 130 * minuto
    const segmentos = montarSegmentos(eventosDaMontagem, agora)
    const blocos = montarBlocos(
      segmentos,
      { eventos: eventosDaMontagem, passagens: [passagem({})], trechos: [trecho({})] },
      agora,
      null,
    )
    expect(blocos.map((b) => b.tipo)).toEqual(['segmento', 'passagem', 'segmento'])
    const bloco = blocos[1]
    if (bloco.tipo !== 'passagem') throw new Error('esperava a passagem')
    expect(bloco.segmentos.map((s) => s.etapaNome)).toEqual(['A MONTAR', 'MONTANDO'])
    expect(bloco.filaMs).toBe(20 * minuto)
    expect(bloco.movelMs).toBe(40 * minuto) // o do banco, não os 60 min do relógio
    expect(bloco.paradoMs).toBe(10 * minuto)
    expect(bloco.totalMs).toBe(70 * minuto)
    expect(bloco.situacao).toBe('Fora da média: rápida demais')
    expect(bloco.execucoes.get(4)).toEqual({
      ms: 40 * minuto,
      descartado: false,
      fimDoExpediente: true,
      semResposta: false,
    })
    expect(bloco.decisao).toMatchObject({
      decisao: 'considerar',
      motivo: 'Móvel pequeno',
      quem: 'Dono',
    })
  })

  it('o clique errado (trecho descartado) não conta', () => {
    const agora = T0 + 130 * minuto
    const segmentos = montarSegmentos(eventosDaMontagem, agora)
    const [, bloco] = montarBlocos(
      segmentos,
      {
        eventos: eventosDaMontagem,
        passagens: [passagem({})],
        trechos: [trecho({ descartado: true, segundos: 0, fim_tipo: 'volta' })],
      },
      agora,
      null,
    )
    if (bloco.tipo !== 'passagem') throw new Error('esperava a passagem')
    expect(bloco.execucoes.get(4)).toMatchObject({ ms: 0, descartado: true })
  })

  it('a passagem aberta soma o vivo do card (o mesmo tempo do quadro)', () => {
    const eventos = eventosDaMontagem.slice(0, 4)
    const agora = T0 + 60 * minuto
    const segmentos = montarSegmentos(eventos, agora)
    const [, bloco] = montarBlocos(
      segmentos,
      {
        eventos,
        passagens: [
          passagem({
            saida_em: null,
            situacao: 'aberta',
            motivo: null,
            execucao_s: 0,
            execucao_fechada_s: 600,
            total_s: 0,
          }),
        ],
        trechos: [trecho({ fim: null, fim_tipo: null, segundos: 0 })],
      },
      agora,
      null,
      {
        setor_id: 5,
        fechado_s: 600,
        fila_s: 1200,
        desde: em(30),
        corte: null,
        dividir: 1,
        usuario_id: 'u-franklin',
        lote: null,
      },
    )
    if (bloco.tipo !== 'passagem') throw new Error('esperava a passagem')
    expect(bloco.aberta).toBe(true)
    expect(bloco.totalMs).toBeNull()
    expect(bloco.situacao).toBeNull()
    expect(bloco.movelMs).toBe(40 * minuto) // 10 min fechados + 30 min rodando
  })

  it('banco de antes (sem passagens): as etapas como sempre', () => {
    const segmentos = montarSegmentos(eventosDaMontagem, T0 + 130 * minuto)
    const blocos = montarBlocos(
      segmentos,
      { eventos: eventosDaMontagem, passagens: [], trechos: [] },
      T0,
      null,
    )
    expect(blocos.every((b) => b.tipo === 'segmento')).toBe(true)
    expect(blocos).toHaveLength(segmentos.length)
  })

  it('a situação e a decisão em língua de gente', () => {
    expect(textoSituacaoPassagem('valida', null)).toBeNull()
    expect(textoSituacaoPassagem('aberta', null)).toBeNull()
    expect(textoSituacaoPassagem('conferir', 'Acima do teto do setor')).toBe(
      'Fora da média: acima do teto',
    )
    expect(textoSituacaoPassagem('conferir', 'Longa para o modelo')).toBe(
      'Fora da média: longa para o modelo',
    )
    expect(textoSituacaoPassagem('sem_registro', 'Saiu sem ninguém iniciar')).toBe(
      'Fora da média: sem registro (pulou a execução)',
    )
    expect(textoSituacaoPassagem('teste', 'Antes da data oficial')).toBe(
      'Fora da média: antes da data oficial',
    )
    expect(textoSituacaoPassagem('descartada', 'Descartada à mão')).toBe(
      'Fora da média: descartada à mão',
    )
    expect(textoDecisaoDoTempo({ decisao: 'descartar', motivo: 'Esqueceu aberto' })).toBe(
      'Decidiu o tempo: descartar — Esqueceu aberto',
    )
  })
})
