/**
 * SESSAO-38 (pedido do dono, item 1 — D-150): o PRAZO do card — a data de
 * entrega que o vendedor pôs no Tiny (lida ao vivo do pedido; no card avulso,
 * o vencimento digitado). Só a data, e a COR conta quanto falta:
 *   - verde: faltam mais de 3 dias;
 *   - amarelo: faltam 2 ou 3 dias;
 *   - vermelho forte: falta 1 dia, é hoje, ou já passou.
 * A cor nunca vai sozinha (M-12): o texto acessível diz quanto falta.
 */

export type CorDoPrazo = 'verde' | 'amarelo' | 'vermelho'

/** A data local (aaaa-mm-dd) de um instante — o calendário do galpão. */
export function dataLocal(agora: number): string {
  const d = new Date(agora)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Dias de calendário de hoje até a data (aaaa-mm-dd). Negativo = já passou. */
export function diasAte(dataIso: string, agora: number): number {
  const [a, m, d] = dataIso.slice(0, 10).split('-').map(Number)
  const [ha, hm, hd] = dataLocal(agora).split('-').map(Number)
  const alvo = Date.UTC(a, m - 1, d)
  const hoje = Date.UTC(ha, hm - 1, hd)
  return Math.round((alvo - hoje) / 86_400_000)
}

export function corDoPrazo(dias: number): CorDoPrazo {
  if (dias > 3) return 'verde'
  if (dias >= 2) return 'amarelo'
  return 'vermelho'
}

/** "25/10" — só o dia e o mês (o ano só quando não é o deste ano). */
export function diaDoPrazo(dataIso: string, agora: number): string {
  const ano = dataIso.slice(0, 4)
  const base = `${dataIso.slice(8, 10)}/${dataIso.slice(5, 7)}`
  return ano === dataLocal(agora).slice(0, 4) ? base : `${base}/${ano}`
}

/** O texto para quem não vê a cor (leitor de tela, dica do mouse). */
export function textoDoPrazo(dataIso: string, agora: number): string {
  const dias = diasAte(dataIso, agora)
  const dia = diaDoPrazo(dataIso, agora)
  if (dias < 0) {
    const atraso = -dias
    return `Entrega era em ${dia} — atrasada há ${atraso === 1 ? '1 dia' : `${atraso} dias`}`
  }
  if (dias === 0) return `Entrega hoje (${dia})`
  if (dias === 1) return `Entrega amanhã (${dia})`
  return `Entrega em ${dia} — faltam ${dias} dias`
}
