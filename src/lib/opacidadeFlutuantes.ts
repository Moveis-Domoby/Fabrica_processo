/**
 * A transparência dos botões flutuantes (balão do chat, lâmpada das sugestões,
 * bolinha do "em execução") — ajuste do dono de 06/11: "coloque mais um ícone
 * [no mini menu] para diminuir ou aumentar a opacidade dos botões flutuantes".
 * É conforto de cada aparelho (fica no navegador, como o tema antes do perfil
 * chegar); a classe `.botao-flutuante` do global.css lê a variável.
 */
const CHAVE = 'dm-opacidade-flutuantes'
export const OPACIDADE_MINIMA = 0.3

/** A opacidade guardada neste aparelho (1 = inteira). */
export function opacidadeGuardada(): number {
  try {
    const valor = Number(localStorage.getItem(CHAVE))
    return valor >= OPACIDADE_MINIMA && valor <= 1 ? valor : 1
  } catch {
    return 1
  }
}

/** Aplica na tela (a variável no `html`) — sem guardar. */
export function aplicarOpacidade(valor: number): void {
  document.documentElement.style.setProperty('--dm-opacidade-flutuantes', String(valor))
}

/** Aplica e guarda neste aparelho. */
export function mudarOpacidade(valor: number): void {
  aplicarOpacidade(valor)
  try {
    localStorage.setItem(CHAVE, String(valor))
  } catch {
    // sem localStorage: vale só até recarregar
  }
}
