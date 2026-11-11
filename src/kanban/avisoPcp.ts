import type { LugarDasPecas, MotivoRemocaoPcp, PecasQueSeguem } from './api'
import type { AvisoCancelada } from './tipos'

/**
 * SESSAO-48 (frente 2): os textos do aviso da peça cancelada no PCP — o selo do
 * pedido, os motivos de "Remover do PCP" e a frase das peças que seguem como
 * estão. Lógica pura (testada no Vitest); a tela só desenha.
 */

/** O selo do pedido no quadro do PCP: "Peça cancelada na produção" / "Peça não encontrada" (com o número quando mais de uma). */
export function textoDoSelo(aviso: Pick<AvisoCancelada, 'pecas' | 'motivo'>): string {
  const n = aviso.pecas
  if (aviso.motivo === 'nao_encontrada')
    return n > 1 ? `${n} peças não encontradas` : 'Peça não encontrada'
  return n > 1 ? `${n} peças canceladas na produção` : 'Peça cancelada na produção'
}

export interface OpcaoRemocao {
  valor: MotivoRemocaoPcp
  rotulo: string
  /** O campo de texto: obrigatório nos dois últimos; no primeiro, o detalhe opcional. */
  rotuloTexto: string
  textoObrigatorio: boolean
  exemplo: string
}

/** Os três motivos de "Remover do PCP" (resposta 3 do dono, 11/11). */
export const MOTIVOS_REMOCAO: OpcaoRemocao[] = [
  {
    valor: 'pedido_cancelado',
    rotulo: 'O pedido foi cancelado',
    rotuloTexto: 'Detalhe (opcional)',
    textoObrigatorio: false,
    exemplo: 'Ex.: o cliente desistiu da compra',
  },
  {
    valor: 'fora_da_linha',
    rotulo: 'Tirar o pedido da linha de produção',
    rotuloTexto: 'O que houve?',
    textoObrigatorio: true,
    exemplo: 'Ex.: o cliente vai buscar na loja',
  },
  {
    valor: 'outro',
    rotulo: 'Outro motivo',
    rotuloTexto: 'Qual o motivo?',
    textoObrigatorio: true,
    exemplo: 'Ex.: pedido duplicado no Tiny',
  },
]

/** O motivo da remoção numa linha da aba "Cancelados e removidos". */
export const ROTULO_MOTIVO_REMOCAO: Record<MotivoRemocaoPcp, string> = {
  pedido_cancelado: 'O pedido foi cancelado',
  fora_da_linha: 'Tirado da linha de produção',
  outro: 'Outro motivo',
}

/** O mínimo do texto obrigatório — o mesmo que o banco exige. */
export const MINIMO_TEXTO_REMOCAO = 3

/** Por que o texto não serve (nulo = serve). */
export function erroDoTextoRemocao(motivo: MotivoRemocaoPcp, texto: string): string | null {
  const opcao = MOTIVOS_REMOCAO.find((m) => m.valor === motivo)
  if (!opcao?.textoObrigatorio) return null
  if (texto.trim().length >= MINIMO_TEXTO_REMOCAO) return null
  return motivo === 'fora_da_linha' ? 'Conte o que houve com o pedido.' : 'Escreva o motivo.'
}

/** "1 peça" / "3 peças". */
export function pecasPorExtenso(n: number): string {
  return n === 1 ? '1 peça' : `${n} peças`
}

/** Onde a peça está, em língua de galpão: a coluna (etapa) ou, sem ela, o setor. */
export function nomeDoLugar(l: Pick<LugarDasPecas, 'etapa' | 'setor'>): string {
  return l.etapa ?? l.setor ?? 'outro lugar'
}

/** "A, B e C". */
function juntar(partes: string[]): string {
  if (partes.length <= 1) return partes.join('')
  return `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}`
}

/**
 * O aviso das peças que seguem como estão ao remover do PCP (a demanda: "Este
 * pedido ainda tem 1 peça em A LIMPAR. Para cancelar a fabricação dela, mova
 * para CANCELADO."). Uma frase para as que estão na produção e outra para as
 * prontas; nada quando o pedido não tem peça.
 */
export function frasesPecasQueSeguem(pecas: PecasQueSeguem): string[] {
  const frases: string[] = []
  const naProducao = pecas.onde.filter((l) => !l.pronta && l.pecas > 0)
  const prontas = pecas.onde.filter((l) => l.pronta && l.pecas > 0)
  if (pecas.em_producao > 0) {
    const dela = pecas.em_producao === 1 ? 'dela' : 'delas'
    const onde =
      naProducao.length === 1
        ? `${pecasPorExtenso(pecas.em_producao)} em ${nomeDoLugar(naProducao[0])}`
        : `${pecasPorExtenso(pecas.em_producao)} em produção: ${juntar(naProducao.map((l) => `${l.pecas} em ${nomeDoLugar(l)}`))}`
    frases.push(
      `Este pedido ainda tem ${onde}. Para cancelar a fabricação ${dela}, mova para CANCELADO.`,
    )
  }
  if (pecas.prontas > 0) {
    const onde = juntar(prontas.map((l) => nomeDoLugar(l)))
    const nelas = pecas.prontas === 1 ? 'nela' : 'nelas'
    frases.push(
      `${pecas.em_producao > 0 ? 'Ele também tem' : 'Este pedido tem'} ${pecasPorExtenso(pecas.prontas)} ${
        pecas.prontas === 1 ? 'pronta' : 'prontas'
      }${onde ? ` em ${onde}` : ''} — remover do PCP não mexe ${nelas}.`,
    )
  }
  return frases
}

/** "19/10 22:24" — o dia e a hora, no fuso do aparelho. */
export function diaEHoraCurto(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
