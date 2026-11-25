import { beforeEach, describe, expect, it, vi } from 'vitest'
import { procurarEndereco, respostaDoNavegador } from '../../supabase/functions/geocodificar/fluxo'
import type { Ambiente, RespostaDaRede } from '../../supabase/functions/geocodificar/fluxo'
import { partirEndereco } from '../../supabase/functions/geocodificar/busca'
import {
  cepNoTexto,
  esquecerRespostasDoCep,
  pontoDaResposta,
  respostaDoCep,
  SERVICO_CEP_NAVEGADOR,
} from './cepNoNavegador'

// Ajuste de 24/11 (validação dos endereços — o serviço de CEP respondia
// "limite de uso" a todas as chamadas do servidor): o navegador consulta o CEP
// e manda a resposta junto; a função confere que é o mesmo CEP e usa.

// a resposta real do serviço para o CEP do 13975 (24/11)
const CEP_13975 = {
  cep: '59145700',
  address_type: 'Rua',
  address_name: 'Francisco Altevi Wanderley',
  address: 'Rua Francisco Altevi Wanderley',
  state: 'RN',
  district: 'Passagem de Areia',
  lat: '-5.9148546',
  lng: '-35.2780318',
  city: 'Parnamirim',
}
const ENDERECO_13975 = 'Rua Francisco Altevi Wanderley 538, Passagem de Areia, Parnamirim, RN, 59145700, Brasil'

const resposta = (status: number, corpo: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => corpo }) as Response

beforeEach(() => esquecerRespostasDoCep())

describe('o CEP no meio do endereço', () => {
  it('lê o CEP com ponto e traço (o formato do cadastro do Tiny) e sem nada', () => {
    expect(cepNoTexto('Rua José de Souza Cruz 1570, Mãe Luiza, Natal, RN, 59.014-430, Brasil')).toBe('59014430')
    expect(cepNoTexto('Rua X 10, Natal, RN, 59014-430, Brasil')).toBe('59014430')
    expect(cepNoTexto('Rua X 10, cep 59014430')).toBe('59014430')
  })
  it('o CEP geral da cidade (…000) e o texto sem CEP não contam', () => {
    expect(cepNoTexto('Rua São Miguel 278, Extremoz, RN, 59575-000, Brasil')).toBeNull()
    expect(cepNoTexto('Rua sem CEP 12, Natal')).toBeNull()
  })
})

describe('a consulta do CEP pelo navegador', () => {
  it('pergunta UMA vez por CEP e devolve a resposta crua', async () => {
    const buscar = vi.fn<(url: string) => Promise<Response>>(async () => resposta(200, CEP_13975))
    expect(await respostaDoCep('59145-700', buscar)).toEqual(CEP_13975)
    expect(await respostaDoCep('59145700', buscar)).toEqual(CEP_13975)
    expect(buscar).toHaveBeenCalledTimes(1)
    expect(buscar.mock.calls[0][0]).toBe(SERVICO_CEP_NAVEGADOR + '59145700')
  })
  it('limite de uso, rede fora ou resposta de outro CEP = null — e a próxima vez pergunta de novo', async () => {
    const buscar = vi
      .fn()
      .mockResolvedValueOnce(resposta(429, null))
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValueOnce(resposta(200, { ...CEP_13975, cep: '59000111' }))
      .mockResolvedValueOnce(resposta(200, CEP_13975))
    expect(await respostaDoCep('59145700', buscar)).toBeNull()
    expect(await respostaDoCep('59145700', buscar)).toBeNull()
    expect(await respostaDoCep('59145700', buscar)).toBeNull()
    expect(await respostaDoCep('59145700', buscar)).toEqual(CEP_13975)
    expect(buscar).toHaveBeenCalledTimes(4)
  })
  it('CEP geral ou torto: nem pergunta', async () => {
    const buscar = vi.fn()
    expect(await respostaDoCep('59575-000', buscar)).toBeNull()
    expect(await respostaDoCep('5914', buscar)).toBeNull()
    expect(await respostaDoCep(null, buscar)).toBeNull()
    expect(buscar).not.toHaveBeenCalled()
  })
  it('o ponto da resposta: só do mesmo CEP e dentro do Brasil', () => {
    expect(pontoDaResposta('59145700', CEP_13975)).toEqual({ latitude: -5.9148546, longitude: -35.2780318 })
    expect(pontoDaResposta('59145701', CEP_13975)).toBeNull()
    expect(pontoDaResposta('59145700', { ...CEP_13975, lat: '0', lng: '0' })).toBeNull()
    expect(pontoDaResposta('59145700', { ...CEP_13975, lat: '40.7', lng: '-74.0' })).toBeNull()
    expect(pontoDaResposta('59145700', null)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// A função: usa a resposta do navegador e não pergunta ao serviço
// ---------------------------------------------------------------------------

type Rede = Partial<Record<'geoapify' | 'cep', (url: URL) => RespostaDaRede>>

function ambiente(rede: Rede) {
  const chamadas: URL[] = []
  const amb: Ambiente = {
    buscar: async (url) => {
      chamadas.push(url)
      const quem = url.host.includes('geoapify') ? 'geoapify' : url.host.includes('cep') ? 'cep' : null
      const responde = quem ? rede[quem] : undefined
      return responde ? responde(url) : { erro: 'HTTP 404' }
    },
    esperar: async () => undefined,
    chaveGeoapify: 'CHAVE-DE-TESTE',
    recusas: [],
    geoapifyRecusou: false,
  }
  return { amb, doCep: () => chamadas.filter((u) => u.host.includes('cep')) }
}

describe('a função de busca com o CEP do navegador', () => {
  // a Geoapify não acha a rua (só a cidade) — o caso dos 16 endereços de 24/11
  const soCidade = () => ({
    corpo: { results: [{ result_type: 'city', city: 'Parnamirim', state: 'Rio Grande do Norte', lat: -5.9153334, lon: -35.2679913 }] },
  })

  it('o 13975: com a resposta do navegador, a rua vem pelo CEP da própria rua — sem perguntar ao serviço', async () => {
    const { amb, doCep } = ambiente({ geoapify: soCidade, cep: () => ({ erro: 'HTTP 429' }) })
    expect(await procurarEndereco(ENDERECO_13975, amb, CEP_13975)).toEqual({
      tipo: 'ok',
      lat: -5.9148546,
      lon: -35.2780318,
      fonte: 'cep',
    })
    expect(doCep()).toHaveLength(0)
    expect(amb.recusas).not.toContain('CEP HTTP 429')
  })

  // ↪️ 25/11 ("remover o lixo"): a consulta do CEP pelo servidor saiu (sempre "limite de uso")
  it('sem a resposta do navegador: o servidor NÃO pergunta ao serviço de CEP — cai na cidade', async () => {
    const { amb, doCep } = ambiente({ geoapify: soCidade, cep: () => ({ erro: 'HTTP 429' }) })
    expect(await procurarEndereco(ENDERECO_13975, amb)).toMatchObject({ tipo: 'ok', fonte: 'aprox_cidade' })
    expect(doCep()).toHaveLength(0)
    expect(amb.recusas).toEqual([])
  })

  it('a resposta de OUTRO CEP não vale: sem degrau do CEP (e sem perguntar ao serviço)', async () => {
    const { amb, doCep } = ambiente({ geoapify: soCidade, cep: () => ({ corpo: CEP_13975 }) })
    expect(await procurarEndereco(ENDERECO_13975, amb, { ...CEP_13975, cep: '59000111' })).toMatchObject({
      tipo: 'ok',
      fonte: 'aprox_cidade',
    })
    expect(doCep()).toHaveLength(0)
  })

  it('só serve a resposta do mesmo CEP (e um objeto)', () => {
    const e = partirEndereco(ENDERECO_13975)
    expect(respostaDoNavegador(e, CEP_13975)).toBe(CEP_13975)
    expect(respostaDoNavegador(e, { ...CEP_13975, cep: '59145-700' })).toBeTruthy()
    expect(respostaDoNavegador(e, { ...CEP_13975, cep: '59145701' })).toBeUndefined()
    expect(respostaDoNavegador(e, 'texto')).toBeUndefined()
    expect(respostaDoNavegador(e, null)).toBeUndefined()
    expect(respostaDoNavegador(partirEndereco('Rua X 1, Natal, RN, Brasil'), CEP_13975)).toBeUndefined()
  })
})
