import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router'
import { recarregar } from './recarga'
import {
  PARADO_PARA_RECARREGAR_MS,
  esperaParaRecarregar,
  reiniciarVersaoParaTeste,
  useRecargaSegura,
  useVersaoNova,
} from './versaoNova'

/**
 * SESSAO-48 (frente 5): a versão é o código montado (o index.html diz a da
 * página; o versao.json, a do ar). No escritório, a versão nova recarrega na
 * próxima troca de tela; no tablet e na TV, só no momento seguro — sem janela
 * aberta e 1 minuto sem toque. A conferida é em gesto ou fato, no máximo a
 * cada 2 minutos, nunca por relógio.
 */
vi.mock('./recarga', async (importOriginal) => {
  const real = await importOriginal<typeof import('./recarga')>()
  return { ...real, recarregar: vi.fn() }
})
const recarregarMock = recarregar as unknown as ReturnType<typeof vi.fn>

const buscar = vi.fn()

function porVersao(versao: string | null) {
  document.head.querySelector('meta[name="domoby-versao"]')?.remove()
  if (versao === null) return
  const meta = document.createElement('meta')
  meta.name = 'domoby-versao'
  meta.content = versao
  document.head.appendChild(meta)
}

function noAr(versao: string) {
  buscar.mockImplementation(async () => ({ ok: true, json: async () => ({ versao }) }))
}

const tocar = () => window.dispatchEvent(new Event('pointerdown'))
const esperar = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))

function Tablet() {
  const nova = useRecargaSegura()
  return <p>{nova ? 'versão nova' : 'mesma versão'}</p>
}

function Escritorio() {
  const nova = useVersaoNova()
  const navegar = useNavigate()
  return (
    <>
      <p>{nova ? 'versão nova' : 'mesma versão'}</p>
      <button type="button" onClick={() => navegar('/outra')}>
        trocar de tela
      </button>
    </>
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.stubGlobal('fetch', buscar)
  buscar.mockReset()
  recarregarMock.mockClear()
  reiniciarVersaoParaTeste()
  porVersao('aaaaaaaaaaaa')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.querySelectorAll('[data-janela-teste]').forEach((j) => j.remove())
  porVersao(null)
})

describe('o momento seguro do tablet e da TV', () => {
  it('espera completar 1 minuto parado; com janela aberta, olha de novo depois', () => {
    const agora = 1_000_000
    expect(esperaParaRecarregar(agora, agora - 10_000, false)).toBe(
      PARADO_PARA_RECARREGAR_MS - 10_000,
    )
    expect(esperaParaRecarregar(agora, agora - 60_000, false)).toBe(0)
    expect(esperaParaRecarregar(agora, agora - 5 * 60_000, true)).toBe(PARADO_PARA_RECARREGAR_MS)
  })

  it('o toque confere a versão; achando nova, só o aviso — e recarrega depois de 1 min sem toque e sem janela', async () => {
    noAr('bbbbbbbbbbbb')
    render(<Tablet />)
    expect(buscar).not.toHaveBeenCalled() // abrir não confere (a abertura é 1 requisição)
    await act(async () => tocar())
    await esperar(0)
    expect(buscar).toHaveBeenCalledTimes(1)
    expect(screen.getByText('versão nova')).toBeInTheDocument()

    // alguém continua mexendo: nada de recarregar no meio do gesto
    await esperar(40_000)
    await act(async () => tocar())
    await esperar(50_000)
    expect(recarregarMock).not.toHaveBeenCalled()

    // a janela do PIN aberta e ninguém tocando: segue esperando
    const janela = document.createElement('div')
    janela.setAttribute('role', 'dialog')
    janela.dataset.janelaTeste = ''
    document.body.appendChild(janela)
    await esperar(3 * 60_000)
    expect(recarregarMock).not.toHaveBeenCalled()

    // a janela fechou: no máximo 1 minuto depois, a recarga — com o porquê
    janela.remove()
    await esperar(PARADO_PARA_RECARREGAR_MS)
    expect(recarregarMock).toHaveBeenCalledTimes(1)
    expect(recarregarMock).toHaveBeenCalledWith('versao_nova')
  })

  it('a mesma versão no ar não acende nada; e confere no máximo a cada 2 minutos', async () => {
    noAr('aaaaaaaaaaaa')
    render(<Tablet />)
    await act(async () => tocar())
    await esperar(0)
    await act(async () => tocar())
    await esperar(60_000)
    await act(async () => tocar())
    await esperar(0)
    expect(buscar).toHaveBeenCalledTimes(1)
    await esperar(61_000)
    await act(async () => tocar())
    await esperar(0)
    expect(buscar).toHaveBeenCalledTimes(2)
    expect(screen.getByText('mesma versão')).toBeInTheDocument()
    await esperar(10 * 60_000)
    expect(recarregarMock).not.toHaveBeenCalled()
  })

  it('fora da montagem (sem a versão no index.html) não confere nada', async () => {
    porVersao(null)
    noAr('bbbbbbbbbbbb')
    render(<Tablet />)
    await act(async () => tocar())
    await esperar(0)
    expect(buscar).not.toHaveBeenCalled()
  })
})

describe('o escritório: a próxima troca de tela é o momento seguro', () => {
  it('sabendo da versão nova, trocar de tela recarrega com o porquê', async () => {
    noAr('bbbbbbbbbbbb')
    render(
      <MemoryRouter initialEntries={['/inicio']}>
        <Escritorio />
      </MemoryRouter>,
    )
    await esperar(0)
    expect(screen.getByText('versão nova')).toBeInTheDocument()
    expect(recarregarMock).not.toHaveBeenCalled()
    await act(async () => screen.getByRole('button', { name: 'trocar de tela' }).click())
    expect(recarregarMock).toHaveBeenCalledWith('versao_nova')
  })

  it('sem versão nova, trocar de tela só confere (e não recarrega)', async () => {
    noAr('aaaaaaaaaaaa')
    render(
      <MemoryRouter initialEntries={['/inicio']}>
        <Escritorio />
      </MemoryRouter>,
    )
    await esperar(0)
    await act(async () => screen.getByRole('button', { name: 'trocar de tela' }).click())
    await esperar(0)
    expect(recarregarMock).not.toHaveBeenCalled()
    expect(screen.getByText('mesma versão')).toBeInTheDocument()
  })
})
