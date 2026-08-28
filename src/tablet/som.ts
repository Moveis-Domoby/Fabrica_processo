/**
 * Som de chegada de card (SESSAO-07/D-28): "um som mínimo e um pouco opaco,
 * para não irritar quem estiver ouvindo" — palavras do dono. Dois toques
 * curtos de senoide em volume baixo, gerados na hora (nenhum arquivo de
 * áudio, nenhuma dependência da rede do galpão).
 *
 * Navegador só deixa tocar áudio depois de um gesto do usuário — por isso o
 * `prepararSom()` é chamado no primeiro toque da tela (o tablet recebe toques
 * o dia inteiro; na prática o som funciona a partir da primeira interação).
 */
let contexto: AudioContext | null = null

export function prepararSom(): void {
  try {
    contexto ??= new AudioContext()
    if (contexto.state === 'suspended') void contexto.resume()
  } catch {
    // Sem suporte a áudio: a tela continua funcionando — o som é um extra.
    contexto = null
  }
}

function tocarNota(frequencia: number, inicioEm: number, duracao: number): void {
  if (!contexto) return
  const oscilador = contexto.createOscillator()
  const ganho = contexto.createGain()
  oscilador.type = 'sine'
  oscilador.frequency.value = frequencia
  const t = contexto.currentTime + inicioEm
  // Volume baixo (opaco) com ataque e queda suaves — nada de "bip" estridente.
  ganho.gain.setValueAtTime(0, t)
  ganho.gain.linearRampToValueAtTime(0.05, t + 0.02)
  ganho.gain.exponentialRampToValueAtTime(0.0001, t + duracao)
  oscilador.connect(ganho)
  ganho.connect(contexto.destination)
  oscilador.start(t)
  oscilador.stop(t + duracao + 0.05)
}

export function tocarSomChegada(): void {
  try {
    prepararSom()
    if (!contexto || contexto.state !== 'running') return
    tocarNota(523.25, 0, 0.18) // dó
    tocarNota(659.25, 0.15, 0.22) // mi
  } catch {
    // Som falhou? Silêncio — nunca atrapalha o gesto.
  }
}
