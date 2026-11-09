import { describe, expect, it, vi } from 'vitest'
import {
  MAXIMO_COMPROVANTES,
  acrescentarComprovantes,
  contarComprovantes,
  enviarComprovantes,
  porEnviar,
} from './enviarComprovantes'
import type { ComprovanteEscolhido } from './enviarComprovantes'

/**
 * SESSAO-47 (pedido do dono): vários comprovantes de uma vez — até 10, com os
 * tipos e o tamanho de sempre; cada arquivo sobe e é registrado sozinho; uma
 * falha não derruba os outros; tentar de novo manda só o que falhou.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const MEGA = 1024 * 1024

function arquivo(nome: string, tipo = 'application/pdf', tamanho = 2000): File {
  const f = new File(['x'], nome, { type: tipo, lastModified: 1 })
  Object.defineProperty(f, 'size', { value: tamanho })
  return f
}

describe('acrescentarComprovantes — a escolha', () => {
  it('junta vários de uma vez, cada um com a sua chave; o mesmo arquivo de novo não repete', () => {
    const a = arquivo('recibo-1.pdf')
    const b = arquivo('foto.jpg', 'image/jpeg')
    const primeira = acrescentarComprovantes([], [a, b])
    expect(primeira.lista.map((i) => i.arquivo.name)).toEqual(['recibo-1.pdf', 'foto.jpg'])
    expect(primeira.lista.every((i) => i.estado === 'escolhido' && i.erro === null)).toBe(true)
    expect(new Set(primeira.lista.map((i) => i.chave)).size).toBe(2)
    expect(primeira.avisos).toEqual([])

    const segunda = acrescentarComprovantes(primeira.lista, [a, arquivo('recibo-2.pdf')])
    expect(segunda.lista.map((i) => i.arquivo.name)).toEqual([
      'recibo-1.pdf',
      'foto.jpg',
      'recibo-2.pdf',
    ])
    // quem já estava na lista segue com a mesma chave
    expect(segunda.lista[0].chave).toBe(primeira.lista[0].chave)
  })

  it('o vazio e o documento grande demais ficam de fora, com o porquê; a foto grande entra (é reduzida no aparelho)', () => {
    const r = acrescentarComprovantes(
      [],
      [
        arquivo('vazio.pdf', 'application/pdf', 0),
        arquivo('contrato.pdf', 'application/pdf', 11 * MEGA),
        arquivo('foto-grande.jpg', 'image/jpeg', 11 * MEGA),
      ],
    )
    expect(r.lista.map((i) => i.arquivo.name)).toEqual(['foto-grande.jpg'])
    expect(r.avisos).toEqual([
      '"vazio.pdf" está vazio — ficou de fora.',
      '"contrato.pdf" tem mais de 10 MB — mande um arquivo menor.',
    ])
  })

  it('até 10 por vez: o que passa disso fica de fora e a tela é avisada', () => {
    const muitos = Array.from({ length: 12 }, (_, i) => arquivo(`recibo-${i + 1}.pdf`))
    const r = acrescentarComprovantes([], muitos)
    expect(MAXIMO_COMPROVANTES).toBe(10)
    expect(r.lista).toHaveLength(10)
    expect(r.avisos).toEqual(['Até 10 comprovantes por vez — os outros ficaram de fora.'])
  })

  it('conta por extenso', () => {
    expect(contarComprovantes(1)).toBe('1 comprovante')
    expect(contarComprovantes(3)).toBe('3 comprovantes')
  })
})

describe('enviarComprovantes — cada arquivo sobe sozinho', () => {
  const escolher = (...nomes: string[]) =>
    acrescentarComprovantes(
      [],
      nomes.map((n) => arquivo(n)),
    ).lista

  it('uma falha no meio não derruba os outros: a lista diz qual falhou e por quê', async () => {
    const lista = escolher('recibo-1.pdf', 'recibo-2.pdf', 'recibo-3.pdf')
    const enviar = vi.fn<(card: number, f: File, chave: string) => Promise<void>>(
      async (_card, f) => {
        if (f.name === 'recibo-2.pdf')
          throw new Error('Não deu para enviar o arquivo: a internet caiu')
      },
    )
    const estados = new Map<string, ComprovanteEscolhido['estado'][]>()
    const erros = new Map<string, string | null>()
    const r = await enviarComprovantes(
      21,
      lista,
      (chave, mudanca) => {
        estados.set(chave, [...(estados.get(chave) ?? []), mudanca.estado])
        erros.set(chave, mudanca.erro)
      },
      enviar,
    )
    expect(r).toEqual({ enviados: 2, falharam: 1 })
    expect(enviar).toHaveBeenCalledTimes(3)
    // na ordem da lista, cada um com o card e a chave dele
    expect(enviar.mock.calls.map((c) => [c[0], c[1].name, c[2]])).toEqual(
      lista.map((i) => [21, i.arquivo.name, i.chave]),
    )
    expect(estados.get(lista[0].chave)).toEqual(['enviando', 'enviado'])
    expect(estados.get(lista[1].chave)).toEqual(['enviando', 'falhou'])
    expect(estados.get(lista[2].chave)).toEqual(['enviando', 'enviado'])
    expect(erros.get(lista[1].chave)).toBe('Não deu para enviar o arquivo: a internet caiu')
  })

  it('tentar de novo manda SÓ o que falhou, com a mesma chave (o que já subiu não sobe de novo)', async () => {
    const [a, b, c] = escolher('recibo-1.pdf', 'recibo-2.pdf', 'recibo-3.pdf')
    const depoisDaPrimeira: ComprovanteEscolhido[] = [
      { ...a, estado: 'enviado' },
      { ...b, estado: 'falhou', erro: 'a internet caiu' },
      { ...c, estado: 'enviado' },
    ]
    expect(porEnviar(depoisDaPrimeira).map((i) => i.arquivo.name)).toEqual(['recibo-2.pdf'])
    const enviar = vi.fn(async () => {})
    const r = await enviarComprovantes(21, depoisDaPrimeira, () => {}, enviar)
    expect(r).toEqual({ enviados: 1, falharam: 0 })
    expect(enviar).toHaveBeenCalledTimes(1)
    expect(enviar).toHaveBeenCalledWith(21, b.arquivo, b.chave)
  })
})
