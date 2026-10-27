import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'

/**
 * SESSAO-41 (D-190 — o vídeo do dono, Trello × plataforma): "no Trello a lista
 * fica estática, e a rolagem é só na lista… aqui a rolagem é na tela completa;
 * se eu precisar mover esse aqui para qualquer outra lista, eu não sei para
 * qual lista eu estou movendo". O quadro ocupa a tela do ponto onde começa até
 * o pé da janela (menos o que vem embaixo dele) — as colunas rolam POR DENTRO e
 * os cabeçalhos ficam sempre à vista, inclusive durante o arrasto.
 *
 * Medido no aparelho (o topo depende do que vem acima: resumo, filtro, aviso),
 * de novo ao mudar o tamanho da janela ou do que está em volta. Nada vai ao
 * banco.
 */
const MINIMO_PX = 320

export function useAlturaAteOFim(
  ref: RefObject<HTMLElement | null>,
  sobraPx: number,
  /** O elemento já está na tela (o quadro troca o esqueleto pelas colunas). */
  desenhado = true,
): number | null {
  const [altura, setAltura] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !desenhado) return
    const medir = () => {
      const topo = el.getBoundingClientRect().top + window.scrollY
      setAltura(Math.max(MINIMO_PX, Math.floor(window.innerHeight - topo - sobraPx)))
    }
    medir()
    window.addEventListener('resize', medir)
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir)
    if (el.parentElement) observador?.observe(el.parentElement)
    // ↪️ ajuste de 27/10: um aviso que aparece ACIMA do quadro, fora dele (a
    // pergunta do card esquecido no tablet), empurra o topo — a página muda de
    // tamanho e o quadro mede de novo (a mesma altura não redesenha nada)
    observador?.observe(document.body)
    return () => {
      window.removeEventListener('resize', medir)
      observador?.disconnect()
    }
  }, [ref, sobraPx, desenhado])

  return altura
}
