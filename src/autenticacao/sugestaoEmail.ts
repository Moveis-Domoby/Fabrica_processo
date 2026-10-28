/**
 * D-200 (28/10, o caso do "@gmai.com"): o 1º pedido de troca de senha foi feito
 * com o e-mail digitado errado e, pela D-191, a tela diz sempre a mesma coisa —
 * ninguém percebeu. Aqui a tela desconfia dos erros de digitação mais comuns no
 * DOMÍNIO dos e-mails de provedor (uma letra a mais, a menos, trocada ou
 * invertida) e sugere o certo. Roda só no aparelho, com uma lista fixa: não
 * consulta o banco, então não diz se o e-mail tem cadastro.
 */
const DOMINIOS = [
  'gmail.com',
  'hotmail.com',
  'hotmail.com.br',
  'outlook.com',
  'outlook.com.br',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.com.br',
  'icloud.com',
  'bol.com.br',
  'uol.com.br',
  'terra.com.br',
]

/** Distância de edição com troca de duas letras vizinhas (Damerau, versão simples). */
function distancia(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

/**
 * O e-mail com o domínio corrigido, ou nulo quando não há o que sugerir (o
 * domínio já é um dos conhecidos, ou não se parece com nenhum — e-mail de
 * empresa, por exemplo).
 */
export function sugerirEmail(email: string): string | null {
  const limpo = email.trim().toLowerCase()
  const arroba = limpo.lastIndexOf('@')
  if (arroba < 1 || arroba === limpo.length - 1) return null
  const usuario = limpo.slice(0, arroba)
  const dominio = limpo.slice(arroba + 1)
  if (DOMINIOS.includes(dominio)) return null
  let melhor: { dominio: string; distancia: number } | null = null
  for (const conhecido of DOMINIOS) {
    const dist = distancia(dominio, conhecido)
    // domínio curto aceita 1 erro; os maiores ("hotmail.com.br"), até 2
    const limite = conhecido.length >= 12 ? 2 : 1
    if (dist <= limite && (melhor === null || dist < melhor.distancia)) {
      melhor = { dominio: conhecido, distancia: dist }
    }
  }
  return melhor ? `${usuario}@${melhor.dominio}` : null
}
