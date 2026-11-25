import { useCallback, useRef, useState } from 'react'
import { pontoDoCepParaConferir } from './api'
import { cepDeRua } from './cepNoNavegador'
import { distanciaKm, formatarDistancia } from './proximidade'
import type { Ponto } from './proximidade'

// ============================================================================
// SESSAO-57 (pedido do dono, 24/11 — "o pino do 13961 está estranho"): o pino
// certo. Dois casos reais da rota de 24/11:
//   - 13961: "Achar no mapa" não achou a rua e a busca devolveu o bairro/a
//     cidade como se fosse a casa — o pino foi salvo a 5 km do CEP;
//   - 13840: o pino foi salvo à mão EXATAMENTE no centro de Natal (o ponto
//     aproximado que a tela abriu) — ninguém arrastou.
// Aqui: o texto "onde o pino está", a conferência antes de salvar (pino não
// arrastado + pino longe do CEP) e a pergunta que a janela mostra no rodapé.
// ============================================================================

/** Provisória (pedido da SESSAO-57): mais longe que isto do ponto do CEP, a tela pergunta. */
export const LIMITE_LONGE_DO_CEP_KM = 1.5

/** O ponto aproximado que a janela abriu (o bairro ou o centro da cidade) — não é a casa. */
export interface PontoSuspeito extends Ponto {
  nivel: 'bairro' | 'cidade'
  nome: string | null
}

/** O mesmo ponto (o pino que ninguém arrastou volta idêntico — sobra só a poeira do arredondamento). */
export function mesmoPontoDoMapa(a: Ponto | null, b: Ponto | null): boolean {
  if (!a || !b) return false
  return Math.abs(a.latitude - b.latitude) < 1e-6 && Math.abs(a.longitude - b.longitude) < 1e-6
}

/** "no bairro Nova Esperança" / "no centro de Parnamirim" (o fim da frase do aviso). */
export function ondeOPinoEsta(p: Pick<PontoSuspeito, 'nivel' | 'nome'>): string {
  const nome = p.nome?.trim()
  if (p.nivel === 'bairro') return nome ? `no bairro ${nome}` : 'no bairro'
  return nome ? `no centro de ${nome}` : 'no centro da cidade'
}

// o CEP de rua e o CEP no meio do texto moram com a consulta do CEP pelo navegador (ajuste 24/11)
export { cepDeRua, cepNoTexto } from './cepNoNavegador'

export type PerguntaDoPino =
  | { tipo: 'nao_moveu'; texto: string }
  | { tipo: 'longe_do_cep'; texto: string; km: number }

/** A frase de cada pergunta (o texto pedido pelo dono). */
export function textoNaoMoveu(p: PontoSuspeito): string {
  return `Você não moveu o pino — ele está ${ondeOPinoEsta(p)}. Arraste até a casa ou confirme.`
}
export function textoLongeDoCep(km: number): string {
  return `O pino está a ${formatarDistancia(km)} do CEP deste endereço. Confira antes de salvar.`
}

/**
 * A conferência ANTES de salvar o pino (frente 2). `pedirParaSalvar(ponto,
 * salvar)` passa pelas perguntas, nesta ordem:
 *   1. o pino é o ponto aproximado que a janela abriu (ninguém arrastou) →
 *      "Você não moveu o pino…";
 *   2. o endereço tem CEP de rua e o pino fica a mais de 1,5 km do ponto do CEP
 *      → "O pino está a X km do CEP…" (uma chamada leve à função da busca,
 *      só no clique; sem resposta = segue, nada se bloqueia).
 * "Salvar assim mesmo" passa a pergunta da vez; "Voltar" desiste do salvar.
 */
export function useConferirPino(opcoes: { cep: string | null; suspeito: PontoSuspeito | null }) {
  const [pergunta, setPergunta] = useState<PerguntaDoPino | null>(null)
  const [conferindo, setConferindo] = useState(false)
  const pendente = useRef<{ ponto: Ponto; salvar: () => void; passou: Set<string> } | null>(null)
  // o ponto de cada CEP já perguntado nesta janela (salvar duas vezes não pergunta de novo ao servidor)
  const pontosDoCep = useRef(new Map<string, Ponto | null>())
  const { cep, suspeito } = opcoes

  const seguir = useCallback(async () => {
    const p = pendente.current
    if (!p) return
    if (!p.passou.has('nao_moveu') && suspeito && mesmoPontoDoMapa(p.ponto, suspeito)) {
      setPergunta({ tipo: 'nao_moveu', texto: textoNaoMoveu(suspeito) })
      return
    }
    const c = cepDeRua(cep)
    if (!p.passou.has('longe_do_cep') && c) {
      let referencia = pontosDoCep.current.get(c)
      if (referencia === undefined) {
        setConferindo(true)
        referencia = await pontoDoCepParaConferir(c)
        setConferindo(false)
        pontosDoCep.current.set(c, referencia)
        // a pessoa desistiu (ou pediu de novo) enquanto a conferência ia
        if (pendente.current !== p) return
      }
      if (referencia) {
        const km = distanciaKm(p.ponto, referencia)
        if (km > LIMITE_LONGE_DO_CEP_KM) {
          setPergunta({ tipo: 'longe_do_cep', texto: textoLongeDoCep(km), km })
          return
        }
      }
    }
    pendente.current = null
    setPergunta(null)
    p.salvar()
  }, [cep, suspeito])

  const pedirParaSalvar = useCallback(
    (ponto: Ponto, salvar: () => void) => {
      pendente.current = { ponto, salvar, passou: new Set() }
      void seguir()
    },
    [seguir],
  )
  const confirmar = useCallback(() => {
    const p = pendente.current
    if (!p || !pergunta) return
    p.passou.add(pergunta.tipo)
    setPergunta(null)
    void seguir()
  }, [pergunta, seguir])
  const voltar = useCallback(() => {
    pendente.current = null
    setPergunta(null)
  }, [])

  return { pergunta, conferindo, pedirParaSalvar, confirmar, voltar }
}

