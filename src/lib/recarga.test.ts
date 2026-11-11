import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  aoPedacoSumido,
  cancelarRecarga,
  contextoDaCarga,
  prepararRecarga,
  recargaEmCurso,
  recarregar,
  reiniciarRecargaParaTeste,
  versaoDaPagina,
} from './recarga'

/**
 * SESSAO-48 (frente 5 — "a plataforma recarrega sozinha"): toda recarga da
 * própria plataforma deixa o porquê na aba; a abertura seguinte o leva para a
 * trilha junto com o que o navegador diz (tipo de carga, aba descartada). E o
 * pedaço que sumiu recarrega UMA vez por versão — nunca em laço.
 */
const recarregou = vi.fn()

function porVersao(versao: string | null) {
  document.head.querySelector('meta[name="domoby-versao"]')?.remove()
  if (versao === null) return
  const meta = document.createElement('meta')
  meta.name = 'domoby-versao'
  meta.content = versao
  document.head.appendChild(meta)
}

/** O que o navegador diria em performance.getEntriesByType('navigation'). */
function cargaDoNavegador(tipo: string | null) {
  Object.defineProperty(performance, 'getEntriesByType', {
    configurable: true,
    writable: true,
    value: (t: string) => (t === 'navigation' && tipo ? [{ type: tipo }] : []),
  })
}

function eventoDePedaco() {
  return new Event('vite:preloadError', { cancelable: true })
}

beforeEach(() => {
  sessionStorage.clear()
  recarregou.mockClear()
  reiniciarRecargaParaTeste(recarregou)
  porVersao(null)
  cargaDoNavegador(null)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  delete (document as Document & { wasDiscarded?: boolean }).wasDiscarded
})

describe('a versão desta página', () => {
  it('vem do index.html da montagem; sem ela (desenvolvimento, testes), não há versão', () => {
    expect(versaoDaPagina()).toBeNull()
    porVersao('28ea753f9cca')
    expect(versaoDaPagina()).toBe('28ea753f9cca')
  })
})

describe('recarregar deixa o porquê para a próxima abertura', () => {
  it('guarda o motivo na aba e recarrega uma vez só, mesmo chamado de novo', () => {
    recarregar('troca_setor')
    recarregar('versao_nova')
    expect(recarregou).toHaveBeenCalledTimes(1)
    expect(JSON.parse(sessionStorage.getItem('domoby:motivo-recarga') ?? '{}').motivo).toBe(
      'troca_setor',
    )
    expect(recargaEmCurso()).toBe(true)
  })

  it('a troca de setor marca a página como "indo embora" — e desmarca se não deu certo', () => {
    expect(recargaEmCurso()).toBe(false)
    prepararRecarga()
    expect(recargaEmCurso()).toBe(true)
    cancelarRecarga()
    expect(recargaEmCurso()).toBe(false)
  })
})

describe('o contexto da carga (vai na 1ª abertura da página)', () => {
  it('junta o tipo de carga, a aba descartada, o porquê da plataforma e a versão — e consome o porquê', () => {
    sessionStorage.setItem(
      'domoby:motivo-recarga',
      JSON.stringify({ motivo: 'troca_setor', em: Date.now() - 2_000 }),
    )
    cargaDoNavegador('reload')
    ;(document as Document & { wasDiscarded?: boolean }).wasDiscarded = true
    porVersao('28ea753f9cca')
    expect(contextoDaCarga()).toEqual({
      carga: 'reload',
      descartada: true,
      recarga: 'troca_setor',
      versao: '28ea753f9cca',
    })
    expect(sessionStorage.getItem('domoby:motivo-recarga')).toBeNull()
    // lido uma vez por página: a 2ª leitura devolve o mesmo
    cargaDoNavegador('navigate')
    expect(contextoDaCarga().carga).toBe('reload')
  })

  it('a carga comum do navegador vem sem motivo da plataforma; a aba que não foi descartada não diz nada', () => {
    cargaDoNavegador('navigate')
    expect(contextoDaCarga()).toEqual({ carga: 'navigate' })
  })

  it('o porquê velho (a aba restaurada depois) ou desconhecido não vale', () => {
    sessionStorage.setItem(
      'domoby:motivo-recarga',
      JSON.stringify({ motivo: 'versao_nova', em: Date.now() - 5 * 60_000 }),
    )
    cargaDoNavegador('reload')
    expect(contextoDaCarga()).toEqual({ carga: 'reload' })
    expect(sessionStorage.getItem('domoby:motivo-recarga')).toBeNull()

    reiniciarRecargaParaTeste(recarregou)
    sessionStorage.setItem(
      'domoby:motivo-recarga',
      JSON.stringify({ motivo: 'apagar_tudo', em: Date.now() }),
    )
    expect(contextoDaCarga().recarga).toBeUndefined()

    reiniciarRecargaParaTeste(recarregou)
    sessionStorage.setItem('domoby:motivo-recarga', 'não é json')
    expect(contextoDaCarga().recarga).toBeUndefined()
  })
})

describe('o pedaço que sumiu (vite:preloadError)', () => {
  it('mostra "Atualizando a plataforma…" e recarrega uma vez, deixando o porquê', () => {
    porVersao('aaaaaaaaaaaa')
    const evento = eventoDePedaco()
    aoPedacoSumido(evento)
    expect(evento.defaultPrevented).toBe(true)
    expect(recarregou).toHaveBeenCalledTimes(1)
    expect(document.getElementById('domoby-aviso-recarga')?.textContent).toContain(
      'Atualizando a plataforma…',
    )
    expect(JSON.parse(sessionStorage.getItem('domoby:motivo-recarga') ?? '{}').motivo).toBe(
      'pedaco_sumido',
    )
    // outro pedaço falhando enquanto a página vai embora: nada de novo
    const outro = eventoDePedaco()
    aoPedacoSumido(outro)
    expect(outro.defaultPrevented).toBe(true)
    expect(recarregou).toHaveBeenCalledTimes(1)
  })

  it('nunca em laço: a mesma versão falhando de novo depois da recarga só mostra o aviso com o botão', () => {
    porVersao('aaaaaaaaaaaa')
    aoPedacoSumido(eventoDePedaco())
    expect(recarregou).toHaveBeenCalledTimes(1)
    // a página recarregou — e continuou na mesma versão (o pedaço não voltou)
    reiniciarRecargaParaTeste(recarregou)
    const evento = eventoDePedaco()
    aoPedacoSumido(evento)
    expect(recarregou).toHaveBeenCalledTimes(1)
    expect(evento.defaultPrevented).toBe(false)
    const aviso = document.getElementById('domoby-aviso-recarga')
    expect(aviso?.getAttribute('role')).toBe('alert')
    expect(aviso?.textContent).toContain('Não deu para abrir esta parte da plataforma.')
    // o botão é da pessoa: recarrega quando ela toca
    aviso?.querySelector('button')?.click()
    expect(recarregou).toHaveBeenCalledTimes(2)
  })

  it('uma publicação NOVA depois da recarga vale outra recarga (a guarda é por versão)', () => {
    porVersao('aaaaaaaaaaaa')
    aoPedacoSumido(eventoDePedaco())
    reiniciarRecargaParaTeste(recarregou)
    porVersao('bbbbbbbbbbbb')
    aoPedacoSumido(eventoDePedaco())
    expect(recarregou).toHaveBeenCalledTimes(2)
  })

  it('sem internet não recarrega (a página de erro do navegador seria pior): só o aviso', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    porVersao('aaaaaaaaaaaa')
    aoPedacoSumido(eventoDePedaco())
    expect(recarregou).not.toHaveBeenCalled()
    expect(document.getElementById('domoby-aviso-recarga')?.textContent).toContain('Sem internet.')
  })

  it('sem como lembrar na aba (armazenamento bloqueado), nunca recarrega sozinha', () => {
    porVersao('aaaaaaaaaaaa')
    const bloqueado = () => {
      throw new Error('bloqueado')
    }
    vi.stubGlobal('sessionStorage', {
      getItem: bloqueado,
      setItem: bloqueado,
      removeItem: bloqueado,
    })
    aoPedacoSumido(eventoDePedaco())
    expect(recarregou).not.toHaveBeenCalled()
    expect(document.getElementById('domoby-aviso-recarga')?.getAttribute('role')).toBe('alert')
  })
})
