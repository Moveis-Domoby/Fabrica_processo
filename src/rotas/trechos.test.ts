import { describe, expect, it } from 'vitest'
import { resumoDoTrajeto, somarTrechos, trechosDoTrajeto } from './trechos'
import type { Trecho } from './trechos'
import { prontoParaEntregar, textoDoEstado } from './estadoPedido'

/**
 * SESSAO-38 (pedido do dono, imagem 3): no lugar de escolher UM trecho, o mapa
 * mostra a rota inteira, SÓ A IDA (fábrica → … → última parada) ou SÓ A VOLTA
 * (última parada → fábrica), cada uma com a sua distância e o seu tempo.
 */
const pelasRuas: Trecho[] = [
  { km: 5, segundos: 600 }, // fábrica → 1ª
  { km: 3.5, segundos: 300 }, // 1ª → 2ª
  { km: 8.4, segundos: 720 }, // 2ª → fábrica (a volta)
]

describe('ida e volta da rota', () => {
  it('a ida são todos os trechos menos o último; a volta é o último; a inteira, todos', () => {
    expect(trechosDoTrajeto(3, 'ida')).toEqual([0, 1])
    expect(trechosDoTrajeto(3, 'volta')).toEqual([2])
    expect(trechosDoTrajeto(3, 'inteira')).toEqual([0, 1, 2])
    // rota sem parada no mapa (um trecho só ou nenhum): nada a separar
    expect(trechosDoTrajeto(1, 'volta')).toEqual([0])
    expect(trechosDoTrajeto(0, 'ida')).toEqual([])
  })

  it('soma a distância e o tempo da parte escolhida; em linha reta, só a distância', () => {
    expect(somarTrechos(pelasRuas, [0, 1])).toEqual({ km: 8.5, segundos: 900 })
    expect(somarTrechos(pelasRuas, [2])).toEqual({ km: 8.4, segundos: 720 })
    const reta: Trecho[] = [
      { km: 2, segundos: null },
      { km: 1, segundos: null },
    ]
    expect(somarTrechos(reta, [0, 1])).toEqual({ km: 3, segundos: null })
    expect(somarTrechos(pelasRuas, [])).toBeNull()
  })

  it('o resumo do mapa diz de onde a onde e quanto (a rota inteira não tem resumo próprio)', () => {
    const ida = resumoDoTrajeto('ida', pelasRuas, [1, 2])
    const volta = resumoDoTrajeto('volta', pelasRuas, [1, 2])
    expect(ida).toMatch(/^Só a ida \(fábrica → 2ª parada\): /)
    expect(ida).toContain('8,5 km')
    expect(volta).toMatch(/^Só a volta \(2ª parada → fábrica\): /)
    expect(volta).toContain('8,4 km')
    expect(resumoDoTrajeto('inteira', pelasRuas, [1, 2])).toBeNull()
    expect(resumoDoTrajeto('ida', pelasRuas, [])).toBeNull()
  })
})

describe('o estado do pedido na rota (agora entram os ainda em produção)', () => {
  it('pronto, no PCP e em produção com quantas prontas — plural nas duas formas', () => {
    expect(textoDoEstado('pronto')).toBe('Pronto')
    expect(textoDoEstado('no_pcp')).toBe('Ainda no PCP')
    expect(textoDoEstado('em_producao', 1, 3)).toBe('Em produção · 1 de 3 prontas')
    expect(textoDoEstado('em_producao', 1, 1)).toBe('Em produção · 1 de 1 pronta')
    expect(textoDoEstado('em_producao', 0, 3)).toBe('Em produção')
    expect(textoDoEstado(null)).toBeNull()
  })

  it('"Entregue" só libera com o pedido pronto (sem estado, o banco decide)', () => {
    expect(prontoParaEntregar('pronto')).toBe(true)
    expect(prontoParaEntregar('em_producao')).toBe(false)
    expect(prontoParaEntregar('no_pcp')).toBe(false)
    expect(prontoParaEntregar(undefined)).toBe(true)
  })
})
