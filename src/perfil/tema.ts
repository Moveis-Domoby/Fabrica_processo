// Os 10 temas Domoby: 8 amarelo × grafite (SESSAO-13) + os 2 verde-esmeralda
// que vieram do Painel de Recompra na união das plataformas (SESSAO-20, D-46).
// A definição visual vive em src/estilos/tokens.css ([data-tema='...']);
// aqui fica o catálogo que a interface usa para listar e aplicar.

export const TEMAS = [
  'claro',
  'gelo',
  'areia',
  'dourado',
  'esmeralda',
  'ardosia',
  'grafite',
  'escuro',
  'meia-noite',
  'esmeralda-escuro',
] as const

export type Tema = (typeof TEMAS)[number]

export const ROTULO_TEMA: Record<Tema, string> = {
  claro: 'Claro',
  gelo: 'Gelo',
  areia: 'Areia',
  dourado: 'Dourado',
  esmeralda: 'Esmeralda',
  ardosia: 'Ardósia',
  grafite: 'Grafite',
  escuro: 'Escuro',
  'meia-noite': 'Meia-noite',
  'esmeralda-escuro': 'Esmeralda escuro',
}

/** Amostras para o seletor do Meu Perfil: fundo, superfície e texto de cada tema. */
export const AMOSTRA_TEMA: Record<Tema, { fundo: string; superficie: string; texto: string }> = {
  claro: { fundo: '#f7f7f8', superficie: '#ffffff', texto: '#2e2c30' },
  gelo: { fundo: '#f3f5f7', superficie: '#ffffff', texto: '#24252b' },
  areia: { fundo: '#f6f2e7', superficie: '#fffdf6', texto: '#322e26' },
  dourado: { fundo: '#fef9ea', superficie: '#ffffff', texto: '#2e2c30' },
  esmeralda: { fundo: '#e4e7ec', superficie: '#f3f4f7', texto: '#1a1c23' },
  ardosia: { fundo: '#454347', superficie: '#5a585c', texto: '#f7f7f8' },
  grafite: { fundo: '#2e2c30', superficie: '#454347', texto: '#f7f7f8' },
  escuro: { fundo: '#1c1b1e', superficie: '#2e2c30', texto: '#f7f7f8' },
  'meia-noite': { fundo: '#101014', superficie: '#1a1a1f', texto: '#f7f7f8' },
  'esmeralda-escuro': { fundo: '#0e0e10', superficie: '#18181b', texto: '#fafafa' },
}

const CHAVE_GUARDADA = 'dm-tema'

export function ehTema(valor: unknown): valor is Tema {
  return typeof valor === 'string' && (TEMAS as readonly string[]).includes(valor)
}

/** Aplica o tema na página inteira e lembra no navegador (anti-flash no boot). */
export function aplicarTema(tema: Tema): void {
  document.documentElement.dataset.tema = tema
  try {
    localStorage.setItem(CHAVE_GUARDADA, tema)
  } catch {
    // sem localStorage (modo privado): o tema ainda aplica, só não fica lembrado
  }
}

/** O último tema aplicado neste navegador — usado antes de o perfil carregar. */
export function temaGuardado(): Tema {
  try {
    const valor = localStorage.getItem(CHAVE_GUARDADA)
    return ehTema(valor) ? valor : 'claro'
  } catch {
    return 'claro'
  }
}
