import type {
  CandidatosProgramacao,
  EstadoFiltro,
  FiltrosCandidatos,
  OrdemCandidatos,
  PrevisaoFiltro,
} from './api'

/**
 * SESSAO-41 (D-199, pedido do dono): os filtros e as ordens da aba Programar.
 * Quem filtra e ordena é o servidor; aqui ficam as opções (com quantos há de
 * cada) e o que a tela manda. "Mais perto" é a única ordem da tela — depende
 * da rota que se está montando.
 */
export type OrdemDaLista = OrdemCandidatos | 'perto'

/** "Todas" nos filtros de escolha (a Selecao do Radix não aceita valor vazio). */
export const TODAS = 'todas'

export const OPCOES_ORDEM: { valor: OrdemDaLista; rotulo: string }[] = [
  { valor: 'entrega', rotulo: 'Dia de entrega mais perto' },
  { valor: 'perto', rotulo: 'Mais perto (da rota ou da fábrica)' },
  { valor: 'cliente_az', rotulo: 'Cliente de A a Z' },
  { valor: 'cliente_za', rotulo: 'Cliente de Z a A' },
  { valor: 'pecas', rotulo: 'Mais peças primeiro' },
  { valor: 'mais_novo', rotulo: 'Pedido mais novo primeiro' },
  { valor: 'mais_antigo', rotulo: 'Pedido mais antigo primeiro' },
  { valor: 'numero', rotulo: 'Número do pedido' },
]

const ROTULO_ESTADO: Record<EstadoFiltro, string> = {
  pronto: 'Prontos',
  em_producao: 'Em produção',
  no_pcp: 'Ainda no PCP',
}

const ROTULO_PREVISAO: Record<PrevisaoFiltro, string> = {
  atrasados: 'Atrasados',
  hoje: 'Para hoje',
  semana: 'Esta semana',
  quinze: 'Próximos 15 dias',
  sem: 'Sem previsão',
}

export interface EscolhaDosFiltros {
  /** O texto como está no campo (a busca vai ao servidor depois de parado). */
  busca: string
  estado: EstadoFiltro | null
  cidade: string | null
  bairro: string | null
  previsao: PrevisaoFiltro | null
  ordem: OrdemDaLista
}

export const SEM_FILTROS: EscolhaDosFiltros = {
  busca: '',
  estado: null,
  cidade: null,
  bairro: null,
  previsao: null,
  ordem: 'entrega',
}

/** Algum filtro ligado (a ordem não conta — ela não esconde pedido). */
export function temFiltro(f: EscolhaDosFiltros): boolean {
  return f.busca.trim() !== '' || f.estado !== null || f.cidade !== null || f.bairro !== null || f.previsao !== null
}

/** O que vai ao servidor: a busca já parada e aplicável; "mais perto" pede a ordem de sempre. */
export function filtrosDoServidor(f: EscolhaDosFiltros, buscaAplicada: string | null): FiltrosCandidatos {
  return {
    busca: buscaAplicada,
    estado: f.estado,
    cidade: f.cidade,
    bairro: f.bairro,
    previsao: f.previsao,
    ordem: f.ordem === 'perto' ? 'entrega' : f.ordem,
  }
}

const comQuantos = (rotulo: string, n: number | undefined) =>
  n === undefined ? rotulo : `${rotulo} (${n})`

export function opcoesEstado(contagens?: CandidatosProgramacao['contagens']) {
  return [
    { valor: TODAS, rotulo: 'Todas' },
    ...(Object.keys(ROTULO_ESTADO) as EstadoFiltro[]).map((e) => ({
      valor: e,
      rotulo: comQuantos(ROTULO_ESTADO[e], contagens?.[e]),
    })),
  ]
}

export function opcoesPrevisao(contagens?: CandidatosProgramacao['contagens']) {
  return [
    { valor: TODAS, rotulo: 'Todas' },
    ...(Object.keys(ROTULO_PREVISAO) as PrevisaoFiltro[]).map((p) => ({
      valor: p,
      rotulo: comQuantos(ROTULO_PREVISAO[p], contagens?.[p]),
    })),
  ]
}

/** As cidades dos pedidos; a escolhida fica na lista mesmo se a resposta ainda não chegou. */
export function opcoesCidade(cidades: CandidatosProgramacao['cidades'], escolhida: string | null) {
  const opcoes = cidades.map((c) => ({ valor: c.cidade, rotulo: comQuantos(c.cidade, c.n) }))
  if (escolhida && !opcoes.some((o) => o.valor === escolhida)) {
    opcoes.unshift({ valor: escolhida, rotulo: escolhida })
  }
  return [{ valor: TODAS, rotulo: 'Todas' }, ...opcoes]
}

/**
 * Os bairros: com a cidade escolhida, só o nome; sem ela, "Bairro · Cidade" —
 * escolher o bairro escolhe a cidade junto (o mesmo nome existe em cidades
 * diferentes). O valor é a dupla, separada por "|".
 */
export function opcoesBairro(
  bairros: CandidatosProgramacao['bairros'],
  cidade: string | null,
  escolhido: string | null,
) {
  const opcoes = bairros.map((b) => ({
    valor: valorDoBairro(b.bairro, b.cidade),
    rotulo: comQuantos(cidade ? b.bairro : `${b.bairro} · ${b.cidade}`, b.n),
  }))
  const atual = escolhido ? valorDoBairro(escolhido, cidade ?? '') : null
  if (atual && !opcoes.some((o) => o.valor === atual)) {
    opcoes.unshift({ valor: atual, rotulo: escolhido! })
  }
  return [{ valor: TODAS, rotulo: 'Todos' }, ...opcoes]
}

export const valorDoBairro = (bairro: string, cidade: string) => `${bairro}|${cidade}`

export function lerBairro(valor: string): { bairro: string; cidade: string } | null {
  if (valor === TODAS) return null
  const corte = valor.lastIndexOf('|')
  return corte < 0
    ? { bairro: valor, cidade: '' }
    : { bairro: valor.slice(0, corte), cidade: valor.slice(corte + 1) }
}

/**
 * A rota em montagem não perde pedido por causa de filtro: o marcado fica com
 * os dados da última vez que apareceu. Só a lista SEM filtro e completa diz
 * que um marcado sumiu de verdade (programado noutra tela, entregue, apagado).
 */
export function marcadosVivos<T extends { card_id: number }>(
  marcados: Map<number, T>,
  naLista: Map<number, T>,
  listaCompletaSemFiltro: boolean,
): T[] {
  const vivos: T[] = []
  for (const [id, antigo] of marcados) {
    const atual = naLista.get(id)
    if (atual) vivos.push(atual)
    else if (!listaCompletaSemFiltro) vivos.push(antigo)
  }
  return vivos
}
