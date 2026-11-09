import type { TrechoDia } from './api'
import { duracao, horaNaFabrica } from './formato'

export interface MarcaDoPadrao {
  /** O instante (em milissegundos) em que o móvel terminaria no tempo padrão. */
  quando: number
  titulo: string
}

const ms = (iso: string) => Date.parse(iso)

/**
 * SESSAO-47 (Bloco C) — a marca do tempo padrão na linha do dia: onde cada móvel
 * de UMA pessoa terminaria se levasse o tempo padrão do modelo. O banco manda, em
 * cada trecho, o padrão do modelo e o tempo do móvel (só com a marca ligada na
 * configuração do painel); a conta daqui é só de posição:
 *  · mais rápido que o padrão (ou igual): a marca fica DEPOIS do fim, na diferença;
 *  · mais lento: a marca cai DENTRO do trabalho, no ponto em que o tempo padrão se
 *    completou — proporcional ao relógio dos trechos (pausa, almoço e lote já estão
 *    no tempo do móvel que o banco mandou).
 * Só os trechos de quem montou contam (ajuda e clique errado ficam de fora).
 */
export function marcasDoPadrao(trechosDaPessoa: TrechoDia[]): MarcaDoPadrao[] {
  const porMovel = new Map<string, TrechoDia[]>()
  for (const t of trechosDaPessoa) {
    if (t.papel !== 'execucao' || t.descartado) continue
    if (t.ref == null || t.padrao_s == null || t.movel_s == null) continue
    if (t.padrao_s <= 0 || t.movel_s <= 0) continue
    const chave = `${t.origem}-${t.ref}`
    porMovel.set(chave, [...(porMovel.get(chave) ?? []), t])
  }
  const marcas: MarcaDoPadrao[] = []
  for (const doMovel of porMovel.values()) {
    const ordenados = [...doMovel].sort((a, b) => ms(a.inicio) - ms(b.inicio))
    const padrao = ordenados[0].padrao_s as number
    const movel = ordenados[0].movel_s as number
    const relogio = ordenados.reduce((s, t) => s + Math.max(ms(t.fim) - ms(t.inicio), 0), 0)
    if (relogio <= 0) continue
    let quando = ms(ordenados[ordenados.length - 1].fim) + (padrao - movel) * 1000
    if (padrao < movel) {
      let falta = relogio * (padrao / movel)
      quando = ms(ordenados[0].inicio)
      for (const t of ordenados) {
        const duracaoDoTrecho = Math.max(ms(t.fim) - ms(t.inicio), 0)
        if (falta <= duracaoDoTrecho) {
          quando = ms(t.inicio) + falta
          break
        }
        falta -= duracaoDoTrecho
        quando = ms(t.fim)
      }
    }
    marcas.push({
      quando,
      titulo: `${ordenados[0].movel ?? 'Móvel'} · no tempo padrão (${duracao(padrao)}) terminaria às ${horaNaFabrica(new Date(quando).toISOString())}`,
    })
  }
  return marcas
}
