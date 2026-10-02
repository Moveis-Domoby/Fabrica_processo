import { describe, expect, it } from 'vitest'
import {
  ID_QUANDO,
  desenhoNovo,
  desligar,
  inserirDepois,
  ligar,
  mesmoConteudo,
  montarDesenho,
  paraGuardar,
  passosDaSequencia,
  podeLigar,
  remover,
  sequencia,
  soltos,
} from './desenho'
import type { EstadoDesenho, Passo } from './desenho'

/**
 * O desenho das automações (SESSAO-27 · D-103): uma sequência a partir do
 * QUANDO, cada bloco com uma entrada e uma saída; bloco fora dela não roda.
 */
function comTres(): EstadoDesenho {
  let e = desenhoNovo('card_entrou')
  e = inserirDepois(e, ID_QUANDO, { tipo: 'etiqueta_por', etiquetas: [1] }).estado
  e = inserirDepois(e, 'p1', { tipo: 'mover', setor_id: 5 }).estado
  e = inserirDepois(e, 'p2', { tipo: 'arquivar' }).estado
  return e
}

describe('desenho da automação', () => {
  it('"+" põe o bloco no fim e no MEIO da sequência (quem vinha depois passa a vir depois dele)', () => {
    const e = comTres()
    expect(sequencia(e)).toEqual(['p1', 'p2', 'p3'])
    const r = inserirDepois(e, 'p1', { tipo: 'esperar', quantidade: 1, unidade: 'horas' })
    expect(sequencia(r.estado)).toEqual(['p1', r.id, 'p2', 'p3'])
    // quem estava à frente andou para a direita (não fica um bloco por cima do outro)
    const x = (id: string) => r.estado.blocos.find((b) => b.id === id)!.posicao.x
    expect(x(r.id)).toBeGreaterThan(x('p1'))
    expect(x('p2')).toBeGreaterThan(x(r.id))
  })

  it('o banco recebe só os passos da sequência, na ordem', () => {
    const e = comTres()
    expect(passosDaSequencia(e).map((p) => p.tipo)).toEqual(['etiqueta_por', 'mover', 'arquivar'])
  })

  it('tirar a ligação deixa o resto SOLTO (não roda); religar volta à sequência', () => {
    let e = desligar(comTres(), 'p1')
    expect(sequencia(e)).toEqual(['p1'])
    expect(soltos(e)).toEqual(['p2', 'p3'])
    e = ligar(e, 'p1', 'p2')
    expect(sequencia(e)).toEqual(['p1', 'p2', 'p3'])
    expect(soltos(e)).toEqual([])
  })

  it('não liga ao QUANDO, a si mesmo nem fechando um ciclo', () => {
    const e = comTres()
    expect(podeLigar(e, 'p3', ID_QUANDO)).toBe(false)
    expect(podeLigar(e, 'p2', 'p2')).toBe(false)
    expect(podeLigar(e, 'p3', 'p1')).toBe(false) // p1 → p2 → p3 → p1 seria ciclo
    expect(ligar(e, 'p3', 'p1')).toBe(e)
  })

  it('ligar troca a saída antiga de um e a entrada antiga do outro (uma entrada e uma saída por bloco)', () => {
    const e = ligar(comTres(), ID_QUANDO, 'p2')
    // o QUANDO agora vai para p2; p1 fica sem entrada (solto) e p2 sem a entrada antiga
    expect(sequencia(e)).toEqual(['p2', 'p3'])
    expect(soltos(e)).toEqual(['p1'])
    expect(e.ligacoes.filter((l) => l.para === 'p2')).toHaveLength(1)
  })

  it('tirar um bloco do meio liga quem vinha antes em quem vinha depois', () => {
    const e = remover(comTres(), 'p2')
    expect(sequencia(e)).toEqual(['p1', 'p3'])
    expect(remover(e, ID_QUANDO)).toBe(e)
  })

  it('guardar e remontar devolve o mesmo desenho (posições e soltos), mesmo com o banco reordenando as chaves', () => {
    const e = desligar(comTres(), 'p2')
    const { passos, desenho } = paraGuardar(e)
    // o jsonb do banco devolve as chaves em outra ordem
    const doBanco = JSON.parse(JSON.stringify(desenho)) as typeof desenho
    doBanco.blocos = doBanco.blocos.map((b) => ({ ...b, passo: Object.fromEntries(Object.entries(b.passo).reverse()) as Passo }))
    const volta = montarDesenho({ gatilho: e.gatilho, gatilho_config: {}, passos, desenho: doBanco })
    expect(sequencia(volta)).toEqual(['p1', 'p2'])
    expect(soltos(volta)).toEqual(['p3'])
    expect(volta.blocos.find((b) => b.id === 'p3')!.posicao).toEqual(e.blocos.find((b) => b.id === 'p3')!.posicao)
  })

  it('sem desenho completo (exemplos de fábrica), a sequência é refeita dos passos, em linha', () => {
    const passos: Passo[] = [
      { tipo: 'avisar', destino: 'lideres', titulo: 'x', mensagem: 'y' },
      { tipo: 'esperar', quantidade: 2, unidade: 'dias' },
    ]
    const e = montarDesenho({
      gatilho: 'card_parado',
      gatilho_config: { horas: 72 },
      passos,
      desenho: { nos: [{ id: 'q', x: 80, y: 120 }, { id: 'p1', x: 400, y: 120 }] },
    })
    expect(sequencia(e)).toEqual(['p1', 'p2'])
    expect(e.posicaoQuando).toEqual({ x: 80, y: 120 })
    expect(e.blocos[0].posicao).toEqual({ x: 400, y: 120 })
    expect(passosDaSequencia(e)).toEqual(passos)
  })

  it('desenho guardado que não bate com os passos (mudou por fora) cede aos passos', () => {
    const e = comTres()
    const { desenho } = paraGuardar(e)
    const volta = montarDesenho({ gatilho: 'card_entrou', gatilho_config: {}, passos: [{ tipo: 'arquivar' }], desenho })
    expect(passosDaSequencia(volta)).toEqual([{ tipo: 'arquivar' }])
  })

  it('igualdade por conteúdo ignora a ordem das chaves', () => {
    expect(mesmoConteudo({ a: 1, b: [{ x: 1, y: 2 }] }, { b: [{ y: 2, x: 1 }], a: 1 })).toBe(true)
    expect(mesmoConteudo({ a: 1 }, { a: 2 })).toBe(false)
  })
})

/**
 * O "Se… senão" (D-105, pedido do dono): duas saídas, Sim e Senão, cada uma
 * com os próprios passos — o banco recebe os caminhos dentro do bloco.
 */
const SE: Passo = { tipo: 'se_senao', condicao: 'tem_etiqueta', etiqueta_id: 1 }

function comCaminhos(): EstadoDesenho {
  let e = desenhoNovo('card_entrou')
  e = inserirDepois(e, ID_QUANDO, { tipo: 'etiqueta_por', etiquetas: [1] }).estado // p1
  e = inserirDepois(e, 'p1', SE).estado // p2
  e = inserirDepois(e, 'p2', { tipo: 'mover', setor_id: 5 }, 'sim').estado // p3
  e = inserirDepois(e, 'p3', { tipo: 'arquivar' }).estado // p4
  e = inserirDepois(e, 'p2', { tipo: 'avisar', destino: 'admins' }, 'nao').estado // p5
  return e
}

describe('o "Se… senão" no desenho', () => {
  it('os passos levam os dois caminhos dentro; a leitura é o Sim inteiro e depois o Senão', () => {
    const e = comCaminhos()
    expect(passosDaSequencia(e)).toEqual([
      { tipo: 'etiqueta_por', etiquetas: [1] },
      { ...SE, entao: [{ tipo: 'mover', setor_id: 5 }, { tipo: 'arquivar' }], senao: [{ tipo: 'avisar', destino: 'admins' }] },
    ])
    expect(sequencia(e)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5'])
    expect(soltos(e)).toEqual([])
    // o Senão desce abaixo do Sim
    const p3 = e.blocos.find((b) => b.id === 'p3')!
    const p5 = e.blocos.find((b) => b.id === 'p5')!
    expect(p5.posicao.x).toBe(p3.posicao.x)
    expect(p5.posicao.y).toBeGreaterThan(p3.posicao.y)
  })

  it('o "Se… senão" liga só pelo Sim ou pelo Senão; os outros blocos, só pela saída única', () => {
    const e = comCaminhos()
    const novo = 'p6'
    const s: EstadoDesenho = { ...e, blocos: [...e.blocos, { id: novo, passo: { tipo: 'desarquivar' }, posicao: { x: 0, y: 0 } }] }
    expect(podeLigar(s, 'p2', novo)).toBe(false)
    expect(podeLigar(s, 'p3', novo, 'sim')).toBe(false)
    expect(podeLigar(s, 'p4', novo)).toBe(true)
    // ligar pelo Senão troca quem estava lá (o aviso fica solto)
    const trocado = ligar(s, 'p2', novo, 'nao')
    expect(passosDaSequencia(trocado)[1].senao).toEqual([{ tipo: 'desarquivar' }])
    expect(soltos(trocado)).toEqual(['p5'])
    // nunca um ciclo: o fim de um caminho não volta ao "Se… senão"
    expect(podeLigar(e, 'p4', 'p2')).toBe(false)
  })

  it('pôr um "Se… senão" no meio: quem vinha depois segue pelo Sim', () => {
    const r = inserirDepois(comTres(), 'p1', SE)
    const passos = passosDaSequencia(r.estado)
    expect(passos.map((p) => p.tipo)).toEqual(['etiqueta_por', 'se_senao'])
    expect(passos[1].entao).toEqual([{ tipo: 'mover', setor_id: 5 }, { tipo: 'arquivar' }])
    expect(passos[1].senao).toEqual([])
  })

  it('tirar o "Se… senão": o caminho Sim continua no lugar dele; o Senão fica solto', () => {
    const e = remover(comCaminhos(), 'p2')
    expect(passosDaSequencia(e).map((p) => p.tipo)).toEqual(['etiqueta_por', 'mover', 'arquivar'])
    expect(soltos(e)).toEqual(['p5'])
  })

  it('guardar e remontar devolve os mesmos caminhos; sem desenho, os caminhos são refeitos dos passos', () => {
    const e = comCaminhos()
    const { passos, desenho } = paraGuardar(e)
    const volta = montarDesenho({ gatilho: 'card_entrou', gatilho_config: {}, passos: JSON.parse(JSON.stringify(passos)), desenho })
    expect(volta.ligacoes).toEqual(e.ligacoes)
    const refeito = montarDesenho({ gatilho: 'card_entrou', gatilho_config: {}, passos, desenho: null })
    expect(passosDaSequencia(refeito)).toEqual(passos)
    expect(refeito.blocos.every((b) => !('entao' in b.passo) && !('senao' in b.passo))).toBe(true)
  })
})
