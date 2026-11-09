import { LIMITE_ARQUIVO, anexarComprovante, chaveDoGesto } from './api'

/**
 * VÁRIOS COMPROVANTES DE UMA VEZ (SESSAO-47 — pedido do dono: "ter a
 * possibilidade de anexar mais de um arquivo de comprovante por vez ao pedido").
 * A lógica, pura e testada: a lista dos escolhidos (até 10 por vez, com os
 * mesmos tipos e o mesmo tamanho de sempre) e o envio — cada arquivo sobe e é
 * registrado SOZINHO, um depois do outro: o que falha não derruba os outros, a
 * tela sabe qual falhou e tenta de novo só ele, sem reenviar o que já subiu.
 */

/** Quantos comprovantes cabem numa escolha (decisão provisória da sessão). */
export const MAXIMO_COMPROVANTES = 10

export type EstadoDoComprovante = 'escolhido' | 'enviando' | 'enviado' | 'falhou'

export interface ComprovanteEscolhido {
  /**
   * A chave do arquivo: a linha dele na tela E o caminho dele no armário — a
   * nova tentativa usa o mesmo caminho e não deixa cópia solta.
   */
  chave: string
  arquivo: File
  estado: EstadoDoComprovante
  /** Por que não subiu, em língua de gente. */
  erro: string | null
}

/** A foto é reduzida no aparelho antes de subir: o tamanho dela não se julga na escolha. */
const ehFotoQueReduz = (arquivo: File) => /^image\/(jpeg|png|webp)$/.test(arquivo.type)

const mesmoArquivo = (a: File, b: File) =>
  a.name === b.name && a.size === b.size && a.lastModified === b.lastModified

/**
 * Junta os arquivos novos à lista: até 10 por vez; o vazio e o grande demais
 * (que não é foto) ficam de fora, cada um com o seu porquê; o mesmo arquivo
 * escolhido de novo não repete.
 */
export function acrescentarComprovantes(
  atuais: ComprovanteEscolhido[],
  novos: File[],
): { lista: ComprovanteEscolhido[]; avisos: string[] } {
  const lista = [...atuais]
  const avisos: string[] = []
  for (const arquivo of novos) {
    if (arquivo.size === 0) {
      avisos.push(`"${arquivo.name}" está vazio — ficou de fora.`)
      continue
    }
    if (!ehFotoQueReduz(arquivo) && arquivo.size > LIMITE_ARQUIVO) {
      avisos.push(`"${arquivo.name}" tem mais de 10 MB — mande um arquivo menor.`)
      continue
    }
    if (lista.some((x) => mesmoArquivo(x.arquivo, arquivo))) continue
    if (lista.length >= MAXIMO_COMPROVANTES) {
      avisos.push(`Até ${MAXIMO_COMPROVANTES} comprovantes por vez — os outros ficaram de fora.`)
      break
    }
    lista.push({ chave: chaveDoGesto(), arquivo, estado: 'escolhido', erro: null })
  }
  return { lista, avisos }
}

/** O que falta subir: o que ainda não foi tentado e o que falhou. */
export function porEnviar(itens: ComprovanteEscolhido[]): ComprovanteEscolhido[] {
  return itens.filter((i) => i.estado !== 'enviado')
}

/** "3 comprovantes" · "1 comprovante" — o plural por extenso. */
export function contarComprovantes(n: number): string {
  return `${n} ${n === 1 ? 'comprovante' : 'comprovantes'}`
}

/**
 * Sobe e registra cada arquivo SOZINHO, na ordem da lista. O que já subiu não
 * sobe de novo; o que falha fica marcado com o porquê e os seguintes continuam.
 * `aoMudar` conta à tela cada mudança de estado. A função de envio é trocável
 * (os testes passam a deles).
 */
export async function enviarComprovantes(
  cardId: number,
  itens: ComprovanteEscolhido[],
  aoMudar: (chave: string, mudanca: Pick<ComprovanteEscolhido, 'estado' | 'erro'>) => void,
  enviar: (cardId: number, arquivo: File, chave: string) => Promise<void> = anexarComprovante,
): Promise<{ enviados: number; falharam: number }> {
  let enviados = 0
  let falharam = 0
  for (const item of porEnviar(itens)) {
    aoMudar(item.chave, { estado: 'enviando', erro: null })
    try {
      await enviar(cardId, item.arquivo, item.chave)
      aoMudar(item.chave, { estado: 'enviado', erro: null })
      enviados += 1
    } catch (erro) {
      aoMudar(item.chave, {
        estado: 'falhou',
        erro: erro instanceof Error ? erro.message : 'não deu para enviar o arquivo',
      })
      falharam += 1
    }
  }
  return { enviados, falharam }
}
