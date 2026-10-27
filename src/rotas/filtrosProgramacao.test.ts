import { describe, expect, it } from 'vitest'
import {
  SEM_FILTROS,
  TODAS,
  filtrosDoServidor,
  lerBairro,
  marcadosVivos,
  opcoesBairro,
  opcoesCidade,
  opcoesEstado,
  temFiltro,
  valorDoBairro,
} from './filtrosProgramacao'

describe('filtros da Programação (SESSAO-41 — a lista para programar)', () => {
  it('a ordem não conta como filtro; "mais perto" pede ao servidor a ordem de sempre', () => {
    expect(temFiltro({ ...SEM_FILTROS, ordem: 'cliente_az' })).toBe(false)
    expect(temFiltro({ ...SEM_FILTROS, busca: '  ' })).toBe(false)
    expect(temFiltro({ ...SEM_FILTROS, cidade: 'Natal' })).toBe(true)
    expect(filtrosDoServidor({ ...SEM_FILTROS, ordem: 'perto' }, null).ordem).toBe('entrega')
    expect(filtrosDoServidor({ ...SEM_FILTROS, busca: 'ra', ordem: 'pecas' }, 'ra')).toEqual({
      busca: 'ra',
      estado: null,
      cidade: null,
      bairro: null,
      previsao: null,
      ordem: 'pecas',
    })
  })

  it('as opções dizem quantos há de cada, e a escolhida não some', () => {
    const estado = opcoesEstado({ pronto: 3, em_producao: 1, no_pcp: 0 } as never)
    expect(estado[0]).toEqual({ valor: TODAS, rotulo: 'Todas' })
    expect(estado.find((o) => o.valor === 'pronto')?.rotulo).toBe('Prontos (3)')
    const cidades = opcoesCidade([{ cidade: 'Natal', uf: 'RN', n: 12 }], 'Macaíba')
    expect(cidades.map((o) => o.valor)).toEqual([TODAS, 'Macaíba', 'Natal'])
    expect(cidades[2].rotulo).toBe('Natal (12)')
  })

  it('o bairro sem cidade escolhida leva a cidade junto (o mesmo nome existe em cidades diferentes)', () => {
    const bairros = [
      { bairro: 'Centro', cidade: 'Natal', n: 2 },
      { bairro: 'Centro', cidade: 'Parnamirim', n: 1 },
    ]
    const sem = opcoesBairro(bairros, null, null)
    expect(sem.map((o) => o.rotulo)).toEqual(['Todos', 'Centro · Natal (2)', 'Centro · Parnamirim (1)'])
    expect(lerBairro(sem[2].valor)).toEqual({ bairro: 'Centro', cidade: 'Parnamirim' })
    expect(lerBairro(TODAS)).toBeNull()
    const com = opcoesBairro([bairros[0]], 'Natal', 'Centro')
    expect(com[1]).toEqual({ valor: valorDoBairro('Centro', 'Natal'), rotulo: 'Centro (2)' })
  })

  it('o pedido marcado fica na rota mesmo que o filtro o esconda; só a lista inteira sem filtro tira', () => {
    const antigo = { card_id: 1, nome: 'antes' }
    const marcados = new Map([[1, antigo]])
    const novo = { card_id: 1, nome: 'agora' }
    expect(marcadosVivos(marcados, new Map([[1, novo]]), true)).toEqual([novo])
    expect(marcadosVivos(marcados, new Map(), false)).toEqual([antigo])
    expect(marcadosVivos(marcados, new Map(), true)).toEqual([])
  })
})
