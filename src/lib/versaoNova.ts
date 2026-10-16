import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'

/** No máximo uma conferida a cada 2 minutos — é um arquivo pequeno, mas não é relógio. */
const INTERVALO_MINIMO_MS = 2 * 60_000
// SESSAO-32 (Lei §3 — a abertura é 1 requisição): quem acabou de abrir a
// plataforma já está na versão do ar; a primeira conferida fica para o
// primeiro gesto depois de 2 minutos.
let ultimaConferida = Date.now()

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
 * Há versão nova da plataforma no ar? (Ajuste do dono, 14/10 noite: quem
 * ficou com a tela aberta desde antes de uma atualização seguia na versão
 * velha — "não dá para cadastrar duas rotas no mesmo dia" foi isso.)
 *
 * Confere só em GESTO da pessoa — trocar de tela ou voltar à aba —, nunca por
 * relógio (Lei §4). Sabendo da versão nova, a próxima troca de tela recarrega
 * a plataforma (o momento seguro: a tela anterior terminou); enquanto isso, o
 * aviso oferece "Atualizar agora".
 */
export function useVersaoNova(): boolean {
  const { pathname } = useLocation()
  const [nova, setNova] = useState(false)
  const novaRef = useRef(false)
  const caminhoRef = useRef(pathname)

  useEffect(() => {
    if (import.meta.env.DEV) return
    const conferir = () => {
      if (novaRef.current || Date.now() - ultimaConferida < INTERVALO_MINIMO_MS) return
      ultimaConferida = Date.now()
      void versaoPublicada().then((versao) => {
        if (versao && versao !== __VERSAO_APP__) {
          novaRef.current = true
          setNova(true)
        }
      })
    }
    // Trocou de tela: com versão nova conhecida, recarrega; senão, confere.
    if (caminhoRef.current !== pathname) {
      caminhoRef.current = pathname
      if (novaRef.current) {
        window.location.reload()
        return
      }
    }
    conferir()
    const aoVoltarAAba = () => {
      if (document.visibilityState === 'visible') conferir()
    }
    document.addEventListener('visibilitychange', aoVoltarAAba)
    return () => document.removeEventListener('visibilitychange', aoVoltarAAba)
  }, [pathname])

  return nova
}
