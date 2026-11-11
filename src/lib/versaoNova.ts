import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router'
import { recarregar, versaoDaPagina } from './recarga'

/** No máximo uma conferida a cada 2 minutos — é um arquivo pequeno, mas não é relógio. */
const INTERVALO_MINIMO_MS = 2 * 60_000
/**
 * SESSAO-48 (frente 5 · provisória): o tablet e a TV só recarregam sozinhos
 * depois de 1 minuto sem toque nem tecla, e sem janela aberta.
 */
export const PARADO_PARA_RECARREGAR_MS = 60_000

// SESSAO-32 (Lei §3 — a abertura é 1 requisição): quem acabou de abrir a
// plataforma já está na versão do ar; a primeira conferida fica para o
// primeiro gesto depois de 2 minutos.
let ultimaConferida = Date.now()
let nova = false
let ultimoGesto = Date.now()
const ouvintes = new Set<() => void>()

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}
const lerNova = () => nova

async function versaoPublicada(): Promise<string | null> {
  try {
    const resposta = await fetch(`/versao.json?v=${Date.now()}`, { cache: 'no-store' })
    if (!resposta.ok) return null
    const corpo = (await resposta.json()) as { versao?: unknown }
    return typeof corpo.versao === 'string' ? corpo.versao : null
  } catch {
    return null
  }
}

/**
 * Há versão nova no ar? Confere só em GESTO ou FATO — trocar de tela, voltar à
 * aba, tocar no tablet, o aviso do canal da TV —, nunca por relógio (Lei §4),
 * e no máximo a cada 2 minutos.
 *
 * ↩️ SESSAO-48 (frente 5): a versão é o CÓDIGO montado (o resumo dos arquivos,
 * que a montagem escreve no index.html e no versao.json), não mais o commit —
 * publicar só documentação, ou o mesmo código de novo, não acende "versão nova".
 */
export function conferirVersao(): void {
  const minha = versaoDaPagina()
  if (!minha || nova) return
  if (Date.now() - ultimaConferida < INTERVALO_MINIMO_MS) return
  ultimaConferida = Date.now()
  void versaoPublicada().then((publicada) => {
    if (publicada && publicada !== minha && !nova) {
      nova = true
      for (const ouvinte of ouvintes) ouvinte()
    }
  })
}

/**
 * O ESCRITÓRIO (ajuste do dono, 14/10 noite — quem ficou com a tela aberta
 * desde antes de uma atualização seguia na versão velha): sabendo da versão
 * nova, a próxima troca de tela recarrega a plataforma (o momento seguro: a
 * tela anterior terminou); enquanto isso, o aviso oferece "Atualizar".
 */
export function useVersaoNova(): boolean {
  const { pathname } = useLocation()
  const caminhoRef = useRef(pathname)
  const temVersaoNova = useSyncExternalStore(assinar, lerNova, lerNova)

  useEffect(() => {
    // Trocou de tela: com versão nova conhecida, recarrega; senão, confere.
    if (caminhoRef.current !== pathname) {
      caminhoRef.current = pathname
      if (nova) {
        recarregar('versao_nova')
        return
      }
    }
    conferirVersao()
    const aoVoltarAAba = () => {
      if (document.visibilityState === 'visible') conferirVersao()
    }
    document.addEventListener('visibilitychange', aoVoltarAAba)
    return () => document.removeEventListener('visibilitychange', aoVoltarAAba)
  }, [pathname])

  return temVersaoNova
}

/** Há janela aberta (o PIN, o mover, o card…)? Recarregar agora cortaria um gesto. */
export function temJanelaAberta(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
}

/**
 * O momento seguro do tablet e da TV (SESSAO-48 · frente 5): sem janela aberta
 * (o PIN é digitado numa janela) e sem toque nem tecla há pelo menos 1 minuto.
 * Devolve quanto falta esperar (0 = pode recarregar agora); com a janela
 * aberta, olha de novo daqui a 1 minuto.
 */
export function esperaParaRecarregar(agora: number, ultimo: number, janelaAberta: boolean): number {
  const parado = agora - ultimo
  if (parado < PARADO_PARA_RECARREGAR_MS) return PARADO_PARA_RECARREGAR_MS - parado
  return janelaAberta ? PARADO_PARA_RECARREGAR_MS : 0
}

/**
 * O TABLET E A TV (SESSAO-48 · frente 5 — "nunca no meio de um gesto"): ninguém
 * troca de tela neles, então a versão nova não espera a troca de tela — espera
 * o momento seguro (sem janela aberta, 1 minuto sem toque); até lá, só o aviso
 * discreto. No tablet, o próprio toque é o gesto que confere a versão (no
 * máximo a cada 2 min). O relógio daqui só existe com a versão nova já
 * conhecida e não busca dado nenhum: só olha a tela e recarrega.
 */
export function useRecargaSegura(): boolean {
  const temVersaoNova = useSyncExternalStore(assinar, lerNova, lerNova)

  useEffect(() => {
    ultimoGesto = Date.now()
    const aoGesto = () => {
      ultimoGesto = Date.now()
      conferirVersao()
    }
    window.addEventListener('pointerdown', aoGesto, { capture: true, passive: true })
    window.addEventListener('keydown', aoGesto, { capture: true })
    return () => {
      window.removeEventListener('pointerdown', aoGesto, { capture: true })
      window.removeEventListener('keydown', aoGesto, { capture: true })
    }
  }, [])

  useEffect(() => {
    if (!temVersaoNova) return
    let espera: ReturnType<typeof setTimeout>
    const tentar = () => {
      const falta = esperaParaRecarregar(Date.now(), ultimoGesto, temJanelaAberta())
      if (falta === 0) recarregar('versao_nova')
      else espera = setTimeout(tentar, falta)
    }
    // a 1ª olhada quando completar 1 minuto parado (já parado há mais: agora)
    espera = setTimeout(tentar, Math.max(0, PARADO_PARA_RECARREGAR_MS - (Date.now() - ultimoGesto)))
    return () => clearTimeout(espera)
  }, [temVersaoNova])

  return temVersaoNova
}

/** Só para os testes: volta ao estado de uma página recém-aberta. */
export function reiniciarVersaoParaTeste(agora = Date.now()): void {
  ultimaConferida = agora - INTERVALO_MINIMO_MS
  nova = false
  ultimoGesto = agora
}
