/**
 * A transparência dos botões flutuantes (balão do chat, lâmpada das sugestões,
 * bolinha do "em execução") — ajuste do dono de 06/11: "coloque mais um ícone
 * [no mini menu] para diminuir ou aumentar a opacidade dos botões flutuantes";
 * ↩️ 2ª volta: "de 0 a 100%, todos os números inteiros". É conforto de cada
 * aparelho (fica no navegador, como o tema antes do perfil chegar); a classe
 * `.botao-flutuante` do global.css lê a variável. Ao passar o mouse, focar ou
 * abrir, o botão fica inteiro.
 * ↩️ 3ª volta ("em 0% eles somem de fato, além da opacidade, a funcionalidade
 * também"): em 0% exato o `html` ganha `data-flutuantes-ocultos` e os botões
 * saem da tela (nem o mouse nem o toque os trazem); de 1% para cima, como antes.
 */
const CHAVE = 'dm-opacidade-flutuantes'

/** A opacidade guardada neste aparelho (0 a 1; sem nada guardado = inteira). */
export function opacidadeGuardada(): number {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (bruto === null) return 1
    const valor = Number(bruto)
    return Number.isFinite(valor) && valor >= 0 && valor <= 1 ? valor : 1
  } catch {
    return 1
  }
}

/** Aplica na tela (a variável no `html`) — sem guardar. */
export function aplicarOpacidade(valor: number): void {
  const raiz = document.documentElement
  raiz.style.setProperty('--dm-opacidade-flutuantes', String(valor))
  raiz.toggleAttribute('data-flutuantes-ocultos', valor === 0)
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
