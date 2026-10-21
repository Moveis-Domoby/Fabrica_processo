/**
 * SESSAO-38 (D-164/D-165): os motivos de pausa ESPECIAIS ("Faltou peça",
 * "Máquina quebrou", "Pausa solicitada por um líder"…) — o tempo parado por
 * eles não conta contra o funcionário. Na dashboard de tempos, só quem vê
 * todos (líder/admin) recebe a marca; para o próprio funcionário a porta manda
 * tudo zerado, e estas funções não acrescentam nada.
 */

/** Os motivos de um móvel, com os especiais marcados "(não conta)". */
export function motivosComMarca(motivos: string[], especiais: string[] = []): string[] {
  if (especiais.length === 0) return motivos
  const marcados = new Set(especiais)
  return motivos.map((m) => {
    // o motivo do fato pode ter o detalhe escrito depois de " — "
    const base = m.split(' — ')[0] ?? m
    return marcados.has(base) || marcados.has(m) ? `${m} (não conta)` : m
  })
}

/** O pedaço " · não conta 30min" que acompanha um tempo — vazio quando não há. */
export function trechoNaoConta(
  segundos: number | undefined,
  formatar: (s: number) => string,
): string {
  return segundos && segundos > 0 ? ` · não conta ${formatar(segundos)}` : ''
}
