/**
 * SESSAO-38 (D-163): o aparelho lembra com quem entrou da última vez — a tela
 * de entrada já abre com o nome de usuário preenchido e o cursor na senha.
 *
 * Fica só neste navegador (conveniência do aparelho, não estado da
 * plataforma); modo privado ou armazenamento bloqueado = só não lembra.
 * Nunca guarda senha nem PIN — só o nome de usuário (ou o e-mail digitado,
 * se o servidor não devolveu o usuário).
 */
const CHAVE = 'domoby:ultimo-login'

export function lerUltimoLogin(): string {
  try {
    return localStorage.getItem(CHAVE) ?? ''
  } catch {
    return ''
  }
}

export function lembrarLogin(identificador: string): void {
  const valor = identificador.trim()
  if (!valor) return
  try {
    localStorage.setItem(CHAVE, valor)
  } catch {
    // sem armazenamento: só não fica lembrado
  }
}
