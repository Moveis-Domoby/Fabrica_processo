/**
 * TEMPO PARADO (SESSAO-32 · D-137, resposta do dono: "pode ser"): quem fica
 * parado mais de 12 h num tablet do galpão (um turno) ou 8 h no escritório
 * entra de novo. No plano gratuito da Supabase o ajuste nativo não existe — a
 * plataforma faz por conta própria, SEM relógio (Lei §4): o último gesto fica
 * guardado no aparelho e a conta é feita no próximo gesto, ao voltar à aba e ao
 * abrir a plataforma.
 *
 * "Tablet" é o aparelho cujo último gesto foi no modo tablet (/tablet).
 */
const CHAVE = 'domoby:ultima-atividade'
export const LIMITE_TABLET_MS = 12 * 3_600_000
export const LIMITE_ESCRITORIO_MS = 8 * 3_600_000
/** Gesto frequente não vira gravação frequente: no máximo uma por minuto. */
const INTERVALO_GRAVACAO_MS = 60_000

interface Registro {
  em: number
  tablet: boolean
}

function ler(): Registro | null {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return null
    const r = JSON.parse(bruto) as Partial<Registro>
    return typeof r.em === 'number' ? { em: r.em, tablet: r.tablet === true } : null
  } catch {
    return null
  }
}

/** Passou do tempo parado? Sem registro (aparelho novo, armazenamento bloqueado): não. */
export function passouDoTempo(agora = Date.now()): { passou: boolean; limiteH: number } {
  const r = ler()
  const limite = r?.tablet ? LIMITE_TABLET_MS : LIMITE_ESCRITORIO_MS
  return { passou: r !== null && agora - r.em > limite, limiteH: limite / 3_600_000 }
}

/** Guarda o gesto de agora (no máximo uma gravação por minuto, salvo troca de modo). */
export function marcarAtividade(tablet: boolean, agora = Date.now()) {
  const r = ler()
  if (r && r.tablet === tablet && agora - r.em < INTERVALO_GRAVACAO_MS && agora >= r.em) return
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ em: agora, tablet }))
  } catch {
    // sem armazenamento (aba privada): a conta simplesmente não acontece
  }
}

/** Saiu: a próxima entrada começa do zero. */
export function esquecerAtividade() {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    // idem
  }
}

export const ehModoTablet = () => window.location.pathname.startsWith('/tablet')
