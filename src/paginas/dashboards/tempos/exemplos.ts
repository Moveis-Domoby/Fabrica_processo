import type {
  ConfiguracaoDoPainel,
  PainelDaResposta,
  RespostaDia,
  RespostaMontadores,
  RespostaMoveis,
  RespostaPeriodo,
  RespostaTv,
} from '@/dashboards/tempos/api'
import { somarDias } from '@/dashboards/tempos/formato'
import { ID_OUTROS, PAINEL_PADRAO } from '@/dashboards/tempos/painel'

/**
 * SESSAO-47 (Bloco C) — respostas de EXEMPLO das portas de Tempos de produção e
 * da TV (dado de mentira, no formato do banco). Servem aos testes de tela e a
 * quem quiser abrir cada estado numa vitrine: escolha a resposta, troque a
 * configuração com `comPainel(...)` e desenhe o componente.
 *
 * As pessoas: Ana (letra A), Bia (B) e Caio (C). Em `…_COM_OUTROS` a Bia está
 * desligada do painel — o banco manda a chave zerada ("Outros") no lugar dela.
 */
export const ANA = '11111111-1111-4111-8111-111111111111'
export const BIA = '22222222-2222-4222-8222-222222222222'
export const CAIO = '33333333-3333-4333-8333-333333333333'

const PESSOAS = {
  [ANA]: { nome: 'Ana Souza', foto: null },
  [BIA]: { nome: 'Bia Lima', foto: 'fotos/bia.jpg' },
  [CAIO]: { nome: 'Caio Reis', foto: null },
}
const PESSOAS_COM_OUTROS = {
  [ANA]: PESSOAS[ANA],
  [CAIO]: PESSOAS[CAIO],
  [ID_OUTROS]: { nome: 'Outros', foto: null },
}
const SETOR = { id: 6, nome: 'MONTAGEM' }
const COMUM = { setor: SETOR, pode_decidir: true, pessoa_travada: false, conferir_n: 1 }

/** A mesma resposta com outra configuração do painel (ou sem a chave — o banco de antes). */
export function comPainel<R extends object>(
  resposta: R,
  painel: PainelDaResposta | undefined,
): R & { painel?: PainelDaResposta } {
  const semChave = { ...resposta } as R & { painel?: PainelDaResposta }
  delete semChave.painel
  return painel === undefined ? semChave : { ...semChave, painel: { ...PAINEL_PADRAO, ...painel } }
}

// ---------------------------------------------------------------------------
// Aba DIA — 09/11/2026 (as horas em UTC: a fábrica é UTC−3)
// ---------------------------------------------------------------------------
export const EXEMPLO_DIA: RespostaDia = {
  ...COMUM,
  painel: PAINEL_PADRAO,
  pessoas: PESSOAS,
  dia: '2026-11-09',
  faixa_pct: 10,
  numeros: {
    montados: 3,
    validas: 3,
    conferir: 0,
    sem_registro: 0,
    montadores: 3,
    tempo_total_s: 6900,
    mediana_s: 2400,
    media_s: 2300,
    com_padrao: 3,
    abaixo: 1,
    cobertura_total: 3,
    cobertura_com_tempo: 3,
  },
  linha: {
    janelas: [
      ['2026-11-09T10:30:00Z', '2026-11-09T15:00:00Z'],
      ['2026-11-09T16:00:00Z', '2026-11-09T21:00:00Z'],
    ],
    trechos: [
      {
        pessoa: ANA,
        inicio: '2026-11-09T11:00:00Z',
        fim: '2026-11-09T11:30:00Z',
        card_id: 501,
        movel: 'Mesa Lille',
        papel: 'execucao',
        descartado: false,
        cortado: false,
        origem: 'plataforma',
        ref: 9001,
        padrao_s: null,
        movel_s: null,
      },
      {
        pessoa: BIA,
        inicio: '2026-11-09T11:00:00Z',
        fim: '2026-11-09T11:40:00Z',
        card_id: 502,
        movel: 'Rack Oslo',
        papel: 'execucao',
        descartado: false,
        cortado: false,
        origem: 'plataforma',
        ref: 9002,
        padrao_s: null,
        movel_s: null,
      },
      {
        pessoa: CAIO,
        inicio: '2026-11-09T12:00:00Z',
        fim: '2026-11-09T12:45:00Z',
        card_id: 503,
        movel: 'Mesa Lille',
        papel: 'execucao',
        descartado: false,
        cortado: false,
        origem: 'plataforma',
        ref: 9003,
        padrao_s: null,
        movel_s: null,
      },
    ],
  },
  tabela: {
    tem_mais: false,
    itens: [
      {
        origem: 'plataforma',
        id: 9001,
        card_id: 501,
        inicio: '2026-11-09T11:00:00Z',
        fim: '2026-11-09T11:30:00Z',
        movel: 'Mesa Lille - Branco',
        pedido: 13820,
        modelo_id: 1,
        modelo: 'Mesa Lille',
        montadores: [ANA],
        ajudantes: [],
        execucao_s: 1800,
        padrao_s: 2400,
        situacao: 'valida',
        motivo: null,
        lote: false,
        retrabalho: false,
        cortado: false,
        decidida: false,
        desfecho: 'concluida',
      },
      {
        origem: 'plataforma',
        id: 9002,
        card_id: 502,
        inicio: '2026-11-09T11:00:00Z',
        fim: '2026-11-09T11:40:00Z',
        movel: 'Rack Oslo - Preto',
        pedido: 13821,
        modelo_id: 2,
        modelo: 'Rack Oslo',
        montadores: [BIA],
        ajudantes: [],
        execucao_s: 2400,
        padrao_s: 2400,
        situacao: 'valida',
        motivo: null,
        lote: false,
        retrabalho: false,
        cortado: false,
        decidida: false,
        desfecho: 'concluida',
      },
      {
        origem: 'plataforma',
        id: 9003,
        card_id: 503,
        inicio: '2026-11-09T12:00:00Z',
        fim: '2026-11-09T12:45:00Z',
        movel: 'Mesa Lille - Preto',
        pedido: 13822,
        modelo_id: 1,
        modelo: 'Mesa Lille',
        montadores: [CAIO, BIA],
        ajudantes: [],
        execucao_s: 2700,
        padrao_s: 2400,
        situacao: 'valida',
        motivo: null,
        lote: false,
        retrabalho: false,
        cortado: false,
        decidida: false,
        desfecho: 'concluida',
      },
    ],
  },
}

/** A aba Dia com a marca do padrão ligada (o banco manda o padrão e o tempo do móvel em cada trecho). */
export const EXEMPLO_DIA_COM_MARCA: RespostaDia = {
  ...EXEMPLO_DIA,
  painel: { ...PAINEL_PADRAO, linha_padrao: true },
  linha: {
    ...EXEMPLO_DIA.linha,
    trechos: EXEMPLO_DIA.linha.trechos.map((t, i) => ({
      ...t,
      padrao_s: 2400,
      movel_s: [1800, 2400, 2700][i],
    })),
  },
}

/** A aba Dia com a Bia desligada do painel: ela vira "Outros" na tabela e na linha do dia. */
export const EXEMPLO_DIA_COM_OUTROS: RespostaDia = {
  ...EXEMPLO_DIA,
  pessoas: PESSOAS_COM_OUTROS,
  linha: {
    ...EXEMPLO_DIA.linha,
    trechos: [
      EXEMPLO_DIA.linha.trechos[0],
      EXEMPLO_DIA.linha.trechos[2],
      { ...EXEMPLO_DIA.linha.trechos[1], pessoa: ID_OUTROS },
    ],
  },
  tabela: {
    tem_mais: false,
    itens: [
      EXEMPLO_DIA.tabela.itens[0],
      { ...EXEMPLO_DIA.tabela.itens[1], montadores: [ID_OUTROS] },
      { ...EXEMPLO_DIA.tabela.itens[2], montadores: [CAIO, ID_OUTROS] },
    ],
  },
}

// ---------------------------------------------------------------------------
// Aba PERÍODO — 03/11 a 09/11/2026
// ---------------------------------------------------------------------------
export const EXEMPLO_PERIODO: RespostaPeriodo = {
  ...COMUM,
  painel: PAINEL_PADRAO,
  pessoas: PESSOAS,
  de: '2026-11-03',
  ate: '2026-11-09',
  numeros: {
    montados: 12,
    validas: 12,
    conferir: 0,
    dias_uteis: 5,
    media_dia_util: 2.4,
    dias_com_montagem: 2,
    media_dia_montagem: 6,
    tempo_total_s: 28200,
    mediana_s: 2100,
    media_s: 2350,
    cobertura_total: 12,
    cobertura_com_tempo: 12,
    n_plataforma: 12,
    n_trello: 0,
  },
  tempo_setor: {
    fila_s: 7200,
    execucao_s: 28200,
    parado_s: 1800,
    retrabalho_n: 0,
    retrabalho_s: 0,
  },
  grafico: {
    agrupado: 'dia',
    series: [
      { chave: ANA, n: 4 },
      { chave: BIA, n: 3 },
      { chave: CAIO, n: 3 },
      { chave: `${ANA},${BIA}`, n: 2 },
    ],
    barras: [
      { balde: '2026-11-08', total: 5, partes: { [ANA]: 1, [BIA]: 2, [CAIO]: 2 } },
      {
        balde: '2026-11-09',
        total: 7,
        partes: { [ANA]: 3, [BIA]: 1, [CAIO]: 1, [`${ANA},${BIA}`]: 2 },
      },
    ],
  },
  por_montador: [
    {
      chave: ANA,
      moveis: 4,
      dias: 2,
      por_dia: 2,
      mediana_s: 2700,
      media_s: 2500,
      tempo_total_s: 9900,
    },
    {
      chave: BIA,
      moveis: 3,
      dias: 2,
      por_dia: 1.5,
      mediana_s: 1800,
      media_s: 1900,
      tempo_total_s: 5700,
    },
    {
      chave: CAIO,
      moveis: 3,
      dias: 2,
      por_dia: 1.5,
      mediana_s: 1800,
      media_s: 2300,
      tempo_total_s: 6900,
    },
    {
      chave: `${ANA},${BIA}`,
      moveis: 2,
      dias: 1,
      por_dia: 2,
      mediana_s: 2850,
      media_s: 2850,
      tempo_total_s: 5700,
    },
  ],
  moveis_top: {
    itens: [
      { modelo_id: 1, nome: 'Mesa Lille', n: 7, pct: 58.3 },
      { modelo_id: 2, nome: 'Rack Oslo', n: 5, pct: 41.7 },
    ],
    mais_n: 0,
  },
}

/** O Período com a Bia desligada: a linha dela vira "Outros" e a dupla vira "Ana + Outros". */
export const EXEMPLO_PERIODO_COM_OUTROS: RespostaPeriodo = {
  ...EXEMPLO_PERIODO,
  pessoas: PESSOAS_COM_OUTROS,
  grafico: {
    agrupado: 'dia',
    series: [
      { chave: ANA, n: 4 },
      { chave: CAIO, n: 3 },
      { chave: `${ANA},${ID_OUTROS}`, n: 2 },
      { chave: '+', n: 3 },
    ],
    barras: [
      { balde: '2026-11-08', total: 5, partes: { [ANA]: 1, [CAIO]: 2, '+': 2 } },
      {
        balde: '2026-11-09',
        total: 7,
        partes: { [ANA]: 3, [CAIO]: 1, [`${ANA},${ID_OUTROS}`]: 2, '+': 1 },
      },
    ],
  },
  por_montador: [
    EXEMPLO_PERIODO.por_montador[0],
    EXEMPLO_PERIODO.por_montador[2],
    { ...EXEMPLO_PERIODO.por_montador[3], chave: `${ANA},${ID_OUTROS}` },
    { ...EXEMPLO_PERIODO.por_montador[1], chave: ID_OUTROS },
  ],
}

// ---------------------------------------------------------------------------
// Aba MÓVEIS
// ---------------------------------------------------------------------------
export const EXEMPLO_MOVEIS: RespostaMoveis = {
  ...COMUM,
  painel: PAINEL_PADRAO,
  pessoas: PESSOAS,
  de: '2026-11-03',
  ate: '2026-11-09',
  faixa_pct: 10,
  colunas: [ANA, BIA, CAIO],
  total: 2,
  tem_mais: false,
  itens: [
    {
      modelo_id: 1,
      nome: 'Mesa Lille',
      qtd: 7,
      conferir: 1,
      validas: 6,
      melhor_s: 1200,
      mediana_s: 2250,
      media_s: 2350,
      p25_s: 1800,
      p75_s: 2850,
      padrao_s: 2250,
      n_trello: 0,
      por_pessoa: {
        [ANA]: { n: 3, mediana_s: 2700, media_s: 2500 },
        [BIA]: { n: 1, mediana_s: 1200, media_s: 1200 },
        [CAIO]: { n: 1, mediana_s: 3600, media_s: 3600 },
      },
    },
    {
      modelo_id: 2,
      nome: 'Rack Oslo',
      qtd: 5,
      conferir: 0,
      validas: 5,
      melhor_s: 1500,
      mediana_s: 2100,
      media_s: 2400,
      p25_s: 1800,
      p75_s: 3000,
      padrao_s: 2100,
      n_trello: 0,
      por_pessoa: {
        [ANA]: { n: 1, mediana_s: 3600, media_s: 3600 },
        [BIA]: { n: 3, mediana_s: 3000, media_s: 3100 },
        [CAIO]: { n: 2, mediana_s: 2250, media_s: 2250 },
      },
    },
  ],
}

/** Móveis com a Bia desligada: a coluna dela sai e a coluna "Outros" (por último) fica com a conta. */
export const EXEMPLO_MOVEIS_COM_OUTROS: RespostaMoveis = {
  ...EXEMPLO_MOVEIS,
  pessoas: PESSOAS_COM_OUTROS,
  colunas: [ANA, CAIO, ID_OUTROS],
  itens: EXEMPLO_MOVEIS.itens.map((m) => ({
    ...m,
    por_pessoa: {
      [ANA]: m.por_pessoa[ANA],
      [CAIO]: m.por_pessoa[CAIO],
      [ID_OUTROS]: m.por_pessoa[BIA],
    },
  })),
}

// ---------------------------------------------------------------------------
// Aba MONTADORES
// ---------------------------------------------------------------------------
const cartao = (usuario_id: string, moveis: number, mediana_s: number, media_s: number) => ({
  usuario_id,
  moveis,
  dias: 2,
  por_dia: moveis / 2,
  mediana_s,
  media_s,
  tempo_total_s: moveis * media_s,
  abaixo: 1,
  acima: 0,
  na_media: 1,
  melhor: { modelo: 'Mesa Lille', execucao_s: 1200, padrao_s: 2250, dia: '2026-11-09' },
  ajudas: 0,
  ocupacao_pct: 80,
})

export const EXEMPLO_MONTADORES: RespostaMontadores = {
  ...COMUM,
  painel: PAINEL_PADRAO,
  pessoas: PESSOAS,
  de: '2026-11-03',
  ate: '2026-11-09',
  faixa_pct: 10,
  pessoas_cartoes: [
    cartao(ANA, 6, 2850, 2775),
    cartao(BIA, 5, 2700, 2550),
    cartao(CAIO, 4, 2400, 2500),
  ],
  melhores: [
    {
      modelo: 'Mesa Lille',
      execucao_s: 1200,
      padrao_s: 2250,
      montadores: [BIA],
      dia: '2026-11-09',
      origem: 'plataforma',
    },
  ],
  ajudantes_so: [],
}

/** Montadores com a Bia desligada: o cartão dela vira o cartão "Outros", por último. */
export const EXEMPLO_MONTADORES_COM_OUTROS: RespostaMontadores = {
  ...EXEMPLO_MONTADORES,
  pessoas: PESSOAS_COM_OUTROS,
  pessoas_cartoes: [
    EXEMPLO_MONTADORES.pessoas_cartoes[0],
    EXEMPLO_MONTADORES.pessoas_cartoes[2],
    { ...EXEMPLO_MONTADORES.pessoas_cartoes[1], usuario_id: ID_OUTROS },
  ],
  melhores: [{ ...EXEMPLO_MONTADORES.melhores[0], montadores: [ID_OUTROS] }],
}

// ---------------------------------------------------------------------------
// MODO TV — só letras (nunca nome nem foto)
// ---------------------------------------------------------------------------
/** Os 14 dias do gráfico da TV, do mais antigo para hoje (09/11/2026). */
const dia14 = (diasAtras: number) => somarDias('2026-11-09', -diasAtras)
/** Quem montou em cada dia do gráfico (hoje e ontem; os outros dias, ninguém). */
const PARTES_DA_TV: Record<number, Record<string, number>> = {
  0: { A: 2, B: 1, C: 1, 'A + B': 1, 'B + C': 1, 'Sem montador': 1 },
  1: { A: 1, B: 2, C: 2, Outros: 1 },
}

export const EXEMPLO_TV: RespostaTv = {
  setor: SETOR,
  setores: [SETOR, { id: 7, nome: 'LIMPEZA E EMBALAGEM' }],
  hoje: '2026-11-09',
  pode_trocar_dia: true,
  e_hoje: true,
  montados_hoje: 7,
  n30: 13,
  dias_uteis_30: 10,
  media_30: 1.3,
  montados_mes: 13,
  dias_uteis_mes: 6,
  media_mes: 2.2,
  tempo_medio_hoje_s: 2700,
  mediana_30_s: 2100,
  tempo_media_hoje_s: 2529,
  tempo_media_30_s: 2350,
  painel: PAINEL_PADRAO,
  dados_ate: '2026-11-09',
  montadores: [
    { letra: 'A', hoje: 2, mediana_hoje_s: 2250, media_hoje_s: 2300, ritmo: 1.5 },
    { letra: 'B', hoje: 1, mediana_hoje_s: 1200, media_hoje_s: 1200, ritmo: 1.5 },
    { letra: 'C', hoje: 1, mediana_hoje_s: 3600, media_hoje_s: 3600, ritmo: 1.5 },
  ],
  grafico: {
    dias: Array.from({ length: 14 }, (_, i) => 13 - i).map((n) => ({
      dia: dia14(n),
      total: n === 0 ? 7 : n === 1 ? 6 : 0,
      partes: PARTES_DA_TV[n] ?? {},
    })),
    series: ['A', 'B', 'C', 'A + B', 'B + C', 'Outros', 'Sem montador'],
  },
  melhor_semana: { letras: 'B', modelo: 'Mesa Lille', tempo_s: 1200, padrao_s: 2250 },
}

/** A TV com a Bia (letra B) desligada: ela sai da coluna e entra em "Outros" no gráfico. */
export const EXEMPLO_TV_COM_OUTROS: RespostaTv = {
  ...EXEMPLO_TV,
  montadores: EXEMPLO_TV.montadores.filter((m) => m.letra !== 'B'),
  grafico: {
    dias: EXEMPLO_TV.grafico.dias.map((d, i) =>
      i === 13
        ? {
            ...d,
            partes: { A: 2, Outros: 1, C: 1, 'A + Outros': 1, 'C + Outros': 1, 'Sem montador': 1 },
          }
        : i === 12
          ? { ...d, partes: { A: 1, C: 2, Outros: 3 } }
          : d,
    ),
    series: ['A', 'C', 'A + Outros', 'C + Outros', 'Outros', 'Sem montador'],
  },
  melhor_semana: { letras: 'Outros', modelo: 'Mesa Lille', tempo_s: 1200, padrao_s: 2250 },
}

// ---------------------------------------------------------------------------
// A JANELA "Configurar painel" (só o admin) — a única com letra, nome e foto
// ---------------------------------------------------------------------------
export const EXEMPLO_CONFIGURACAO: ConfiguracaoDoPainel = {
  painel: PAINEL_PADRAO,
  padrao: PAINEL_PADRAO,
  blocos_tv: [
    'tv_numeros',
    'tv_montadores',
    'tv_grafico',
    'tv_melhor_semana',
    'tv_relogio',
    'tv_dados_ate',
    'tv_ao_vivo',
  ],
  setores: [
    {
      id: 6,
      nome: 'MONTAGEM',
      equipe: [
        {
          usuario_id: ANA,
          nome: 'Ana Souza',
          foto: null,
          letra: 'A',
          papel: 'titular',
          no_painel: true,
        },
        {
          usuario_id: BIA,
          nome: 'Bia Lima',
          foto: 'fotos/bia.jpg',
          letra: 'B',
          papel: 'titular',
          no_painel: true,
        },
        {
          usuario_id: CAIO,
          nome: 'Caio Reis',
          foto: null,
          letra: 'C',
          papel: 'apoio',
          no_painel: false,
        },
      ],
    },
    { id: 7, nome: 'LIMPEZA E EMBALAGEM', equipe: [] },
  ],
}
