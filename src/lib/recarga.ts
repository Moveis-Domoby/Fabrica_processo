/**
 * AS RECARGAS DA PRÓPRIA PLATAFORMA (SESSAO-48 · frente 5 — o dono, 11/11: "de
 * tempos em tempos a plataforma atualiza sozinha do nada e recarrega a tela").
 *
 * Todo lugar do código que recarrega a página passa por aqui e deixa, na aba
 * (sessionStorage), o PORQUÊ — a próxima abertura o leva para a trilha junto do
 * que o navegador diz da carga (navegou, atualizou, voltou) e de a aba ter sido
 * descartada para poupar memória. Assim a Auditoria responde, abertura por
 * abertura, quem recarregou: a pessoa, o navegador ou a plataforma.
 *
 * Aqui também moram a versão desta página (escrita pela montagem no index.html
 * — a versão é o código, não o commit) e a guarda do "pedaço que sumiu": uma
 * recarga por versão, nunca em laço.
 */

/** Os porquês da própria plataforma (a porta de abertura aceita só estes). */
export const MOTIVOS_RECARGA = [
  'versao_nova',
  'versao_nova_botao',
  'pedaco_sumido',
  'troca_setor',
] as const
export type MotivoRecarga = (typeof MOTIVOS_RECARGA)[number]

const TIPOS_CARGA = ['navigate', 'reload', 'back_forward', 'prerender'] as const
export type TipoCarga = (typeof TIPOS_CARGA)[number]

/** O que esta página sabe de como foi aberta (vai na 1ª abertura dela). */
export interface ContextoDaCarga {
  /** O que o navegador diz: navegou até o endereço, atualizou, voltou/avançou, abriu antecipada. */
  carga?: TipoCarga
  /** O navegador tinha descartado a aba (poupar memória) e a recarregou ao voltar. */
  descartada?: true
  /** Foi a própria plataforma que recarregou — e por quê. */
  recarga?: MotivoRecarga
  /** A versão (o código) desta página. */
  versao?: string
}

const CHAVE_MOTIVO = 'domoby:motivo-recarga'
const CHAVE_PEDACO = 'domoby:pedaco-sumido-de'
/** O porquê guardado vale só para a abertura logo em seguida (recarregar leva segundos). */
const VALIDADE_MOTIVO_MS = 60_000
const META_VERSAO = 'meta[name="domoby-versao"]'
const ID_AVISO = 'domoby-aviso-recarga'

let recarregando = false
let trocaEmCurso = false
let contexto: ContextoDaCarga | null = null
const recarregarDeVerdade = () => window.location.reload()
let recarregarPagina: () => void = recarregarDeVerdade

/**
 * A versão desta página: o resumo dos arquivos da montagem, que a montagem
 * escreve no index.html (vite.config.ts). Fora da montagem (desenvolvimento,
 * testes) não há versão — e a conferida de versão nova não roda.
 */
export function versaoDaPagina(): string | null {
  if (typeof document === 'undefined') return null
  const valor = document.querySelector(META_VERSAO)?.getAttribute('content')?.trim()
  return valor ? valor : null
}

/** Recarrega a página deixando o porquê para a próxima abertura. Uma vez só por página. */
export function recarregar(motivo: MotivoRecarga): void {
  if (recarregando) return
  recarregando = true
  try {
    sessionStorage.setItem(CHAVE_MOTIVO, JSON.stringify({ motivo, em: Date.now() }))
  } catch {
    // sem armazenamento (aba privada): recarrega mesmo assim — só a trilha não leva o porquê
  }
  recarregarPagina()
}

/**
 * A troca de setor do tablet vai recarregar a página (a conta nova é da
 * PRÓXIMA página): enquanto isso, a sessão desta página não reage à troca — sem
 * isso, ela abria a plataforma com a conta nova antes de recarregar (uma
 * abertura a mais em cada troca, no mesmo segundo).
 */
export function prepararRecarga(): void {
  trocaEmCurso = true
}

/** A troca não aconteceu (PIN errado, sem internet): a página segue como estava. */
export function cancelarRecarga(): void {
  trocaEmCurso = false
}

/** A página está para ser recarregada pela própria plataforma? */
export function recargaEmCurso(): boolean {
  return trocaEmCurso || recarregando
}

function consumirMotivo(): MotivoRecarga | undefined {
  try {
    const bruto = sessionStorage.getItem(CHAVE_MOTIVO)
    if (bruto === null) return undefined
    sessionStorage.removeItem(CHAVE_MOTIVO)
    const lido = JSON.parse(bruto) as { motivo?: unknown; em?: unknown }
    const idade = Date.now() - Number(lido.em)
    // um porquê velho (a aba restaurada dias depois) não vale para esta abertura
    if (!Number.isFinite(idade) || idade < -5_000 || idade > VALIDADE_MOTIVO_MS) return undefined
    return (MOTIVOS_RECARGA as readonly unknown[]).includes(lido.motivo)
      ? (lido.motivo as MotivoRecarga)
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Como ESTA página foi aberta — lido uma vez (o porquê guardado na aba é
 * consumido na leitura). O início do app chama cedo, para o porquê de uma
 * recarga nunca sobrar para uma abertura de outro dia.
 */
export function contextoDaCarga(): ContextoDaCarga {
  if (contexto) return contexto
  const lido: ContextoDaCarga = {}
  try {
    const navegacao = performance.getEntriesByType?.('navigation')?.[0] as
      PerformanceNavigationTiming | undefined
    const tipo = navegacao?.type
    if (tipo && (TIPOS_CARGA as readonly string[]).includes(tipo)) lido.carga = tipo as TipoCarga
  } catch {
    // navegador sem a medida: fica sem o tipo
  }
  if ((document as Document & { wasDiscarded?: boolean }).wasDiscarded === true) {
    lido.descartada = true
  }
  const motivo = consumirMotivo()
  if (motivo) lido.recarga = motivo
  const versao = versaoDaPagina()
  if (versao) lido.versao = versao
  contexto = lido
  return lido
}

// ---------------------------------------------------------------------------
// O pedaço que sumiu (vite:preloadError): depois de uma publicação, quem ficou
// com a página aberta pode pedir um pedaço da versão anterior que já não está
// no ar. Recarrega UMA vez por versão (a guarda fica na aba), mostrando
// "Atualizando a plataforma…"; se a mesma versão falhar de novo — ou se o
// aparelho está sem internet —, não recarrega: mostra o aviso com o botão.
// ---------------------------------------------------------------------------

type TipoAviso = 'atualizando' | 'falhou' | 'sem_internet'

const TEXTOS_AVISO: Record<TipoAviso, { titulo: string; texto?: string }> = {
  atualizando: { titulo: 'Atualizando a plataforma…' },
  falhou: {
    titulo: 'Não deu para abrir esta parte da plataforma.',
    texto: 'Confira a internet e toque em Atualizar.',
  },
  sem_internet: {
    titulo: 'Sem internet.',
    texto: 'Esta parte da plataforma abre quando a conexão voltar. Depois, toque em Atualizar.',
  },
}

function mostrarAviso(tipo: TipoAviso): void {
  if (typeof document === 'undefined' || !document.body) return
  document.getElementById(ID_AVISO)?.remove()
  const fundo = document.createElement('div')
  fundo.id = ID_AVISO
  fundo.setAttribute('role', tipo === 'atualizando' ? 'status' : 'alert')
  fundo.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-fundo/95 p-6'
  const caixa = document.createElement('div')
  caixa.className =
    'flex max-w-sm flex-col items-center gap-3 rounded-dm-lg border border-borda bg-superficie p-6 text-center shadow-lg'
  const titulo = document.createElement('p')
  titulo.className = 'text-xl font-semibold text-texto'
  titulo.textContent = TEXTOS_AVISO[tipo].titulo
  caixa.appendChild(titulo)
  const texto = TEXTOS_AVISO[tipo].texto
  if (texto) {
    const p = document.createElement('p')
    p.className = 'text-base text-texto-suave'
    p.textContent = texto
    caixa.appendChild(p)
  }
  if (tipo !== 'atualizando') {
    // alvo de toque do galpão (D-06): 64 px
    const botao = document.createElement('button')
    botao.type = 'button'
    botao.className =
      'inline-flex h-toque-galpao items-center justify-center rounded-dm border border-transparent bg-acao px-8 text-xl font-semibold text-acao-texto'
    botao.textContent = 'Atualizar'
    botao.addEventListener('click', () => recarregar('pedaco_sumido'))
    caixa.appendChild(botao)
  }
  fundo.appendChild(caixa)
  document.body.appendChild(fundo)
}

/** O ouvinte do `vite:preloadError` (src/main.tsx). */
export function aoPedacoSumido(evento: Event): void {
  if (recarregando) {
    // a página já está indo embora — o erro não precisa derrubar a tela antes
    evento.preventDefault()
    return
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    mostrarAviso('sem_internet')
    return
  }
  const de = versaoDaPagina() ?? 'sem-versao'
  let jaRecarregou: boolean
  try {
    jaRecarregou = sessionStorage.getItem(CHAVE_PEDACO) === de
    if (!jaRecarregou) sessionStorage.setItem(CHAVE_PEDACO, de)
  } catch {
    // sem armazenamento não há como lembrar que já recarregou: nunca sozinha
    jaRecarregou = true
  }
  if (jaRecarregou) {
    mostrarAviso('falhou')
    return
  }
  evento.preventDefault()
  mostrarAviso('atualizando')
  recarregar('pedaco_sumido')
}

/**
 * Só para os testes: volta ao estado de uma página recém-aberta (o jsdom não
 * recarrega — o teste passa quem faz as vezes da recarga).
 */
export function reiniciarRecargaParaTeste(recarregador: () => void = recarregarDeVerdade): void {
  recarregando = false
  trocaEmCurso = false
  contexto = null
  recarregarPagina = recarregador
  document.getElementById(ID_AVISO)?.remove()
}
