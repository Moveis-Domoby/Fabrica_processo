/**
 * Onde fica o balão do chat (SESSAO-26): distância das bordas DIREITA e de
 * BAIXO da tela — assim ele continua "no canto" quando a janela muda de
 * tamanho. A posição escolhida fica guardada por pessoa neste aparelho (zero
 * requisição; cada aparelho tem a sua tela).
 */
export interface PosicaoBalao {
  direita: number
  baixo: number
}

export const TAMANHO_BALAO = 56
const MARGEM = 8

/**
 * O canto de partida: ao lado da bolinha de "em execução" (que mora a 16px
 * da direita), para as duas nunca se cobrirem; no celular, acima da faixa do
 * polegar onde ficam as barras de ação.
 */
export function posicaoPadrao(larguraTela: number): PosicaoBalao {
  return { direita: 88, baixo: larguraTela < 640 ? 80 : 24 }
}

/** Mantém o balão inteiro dentro da tela. */
export function limitarPosicao(
  posicao: PosicaoBalao,
  tela: { largura: number; altura: number },
): PosicaoBalao {
  const maxDireita = Math.max(MARGEM, tela.largura - TAMANHO_BALAO - MARGEM)
  const maxBaixo = Math.max(MARGEM, tela.altura - TAMANHO_BALAO - MARGEM)
  return {
    direita: Math.round(Math.min(Math.max(posicao.direita, MARGEM), maxDireita)),
    baixo: Math.round(Math.min(Math.max(posicao.baixo, MARGEM), maxBaixo)),
  }
}

export const chaveGuardada = (usuarioId: string) => `dm-chat-balao:${usuarioId}`

export function lerPosicao(usuarioId: string): PosicaoBalao | null {
  try {
    const bruto = localStorage.getItem(chaveGuardada(usuarioId))
    if (!bruto) return null
    const lido = JSON.parse(bruto) as Partial<PosicaoBalao>
    if (typeof lido.direita !== 'number' || typeof lido.baixo !== 'number') return null
    return { direita: lido.direita, baixo: lido.baixo }
  } catch {
    return null
  }
}

export function guardarPosicao(usuarioId: string, posicao: PosicaoBalao) {
  try {
    localStorage.setItem(chaveGuardada(usuarioId), JSON.stringify(posicao))
  } catch {
    // sem localStorage: só não fica lembrado
  }
}

/** Arrastar só começa depois de alguns pixels — antes disso é um toque. */
export const LIMIAR_ARRASTO = 6
