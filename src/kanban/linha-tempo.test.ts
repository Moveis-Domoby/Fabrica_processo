import { describe, expect, it } from 'vitest'
import { eventoEstornavel, montarSegmentos } from './linha-tempo'
import type { EventoLinhaTempo } from './tipos'

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
      evento({ evento_id: 1, tipo: 'card_criado', ocorrido_em: em(0), setor_destino_id: 1, setor_destino_nome: 'PCP' }),
      evento({ evento_id: 2, tipo: 'movimentacao_setor', ocorrido_em: em(10), setor_destino_id: 2, setor_destino_nome: 'SECC', etapa_destino_nome: 'EM CORTE' }),
      evento({ evento_id: 3, tipo: 'execucao_iniciada', ocorrido_em: em(25), usuario_nome: 'Ana' }),
      evento({ evento_id: 4, tipo: 'execucao_finalizada', ocorrido_em: em(55), usuario_nome: 'Ana' }),
      evento({ evento_id: 5, tipo: 'movimentacao_setor', ocorrido_em: em(60), setor_destino_id: 3, setor_destino_nome: 'FITAMENTO' }),
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
      evento({ evento_id: 1, tipo: 'card_criado', ocorrido_em: em(0), setor_destino_id: 2, setor_destino_nome: 'SECC' }),
      evento({ evento_id: 2, tipo: 'execucao_iniciada', ocorrido_em: em(5), usuario_nome: 'Ana', usuario_id: 'ana' }),
      evento({ evento_id: 3, tipo: 'execucao_iniciada', ocorrido_em: em(20), usuario_nome: 'Beto', dados: { transferido_de: 'ana' } }),
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

  it('mover com execução aberta encerra a execução naquele instante (D-24)', () => {
    const eventos: EventoLinhaTempo[] = [
      evento({ evento_id: 1, tipo: 'card_criado', ocorrido_em: em(0), setor_destino_id: 2, setor_destino_nome: 'SECC' }),
      evento({ evento_id: 2, tipo: 'execucao_iniciada', ocorrido_em: em(10), usuario_nome: 'Ana' }),
      evento({ evento_id: 3, tipo: 'movimentacao_setor', ocorrido_em: em(40), setor_destino_id: 3, setor_destino_nome: 'CNC' }),
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
      evento({ evento_id: 1, tipo: 'card_criado', ocorrido_em: em(0), setor_destino_id: 1, setor_destino_nome: 'PCP' }),
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
      evento({ evento_id: 1, tipo: 'card_criado', ocorrido_em: em(0), setor_destino_id: 2, setor_destino_nome: 'SECC' }),
      evento({ evento_id: 2, tipo: 'execucao_iniciada', ocorrido_em: em(10), usuario_nome: 'Ana' }),
      evento({ evento_id: 3, tipo: 'execucao_finalizada', ocorrido_em: em(20), usuario_nome: 'Ana', estornado: true }),
      evento({ evento_id: 4, tipo: 'estorno', ocorrido_em: em(25), usuario_nome: 'Líder', evento_referencia_id: 3 }),
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
