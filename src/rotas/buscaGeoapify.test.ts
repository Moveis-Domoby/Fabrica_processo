import { describe, expect, it } from 'vitest'
import {
  candidatosGeoapify,
  consultaGeoapifyBairro,
  consultaGeoapifyCidade,
  consultasGeoapify,
  escolher,
  escolherLugar,
  partirEndereco,
} from '../../supabase/functions/geocodificar/busca'
import { deveAvisarFora, procurarEndereco, proximoEstado } from '../../supabase/functions/geocodificar/fluxo'
import type { Ambiente, RespostaDaRede } from '../../supabase/functions/geocodificar/fluxo'

/**
 * SESSAO-56: a Geoapify como buscador principal (a Edge Function
 * `geocodificar`). As respostas abaixo são AMOSTRAS montadas pelo formato da
 * documentação (format=json → `{ results: [...] }`), com endereços inventados —
 * nenhuma consulta de verdade é feita daqui e nenhum endereço é de cliente.
 */
const resultado = (extra: Record<string, unknown>): Record<string, unknown> => ({
  country: 'Brasil',
  country_code: 'br',
  state: 'Rio Grande do Norte',
  state_code: 'RN',
  county: 'Região Metropolitana de Natal',
  city: 'Natal',
  datasource: { sourcename: 'openstreetmap', attribution: '© OpenStreetMap contributors' },
  rank: { importance: 0.2, popularity: 5.1, confidence: 1, match_type: 'full_match' },
  place_id: 'amostra',
  ...extra,
})

const casa = resultado({
  result_type: 'building',
  street: 'Rua das Acácias Amarelas',
  housenumber: '120',
  suburb: 'Lagoa Nova',
  postcode: '59075-000',
  lat: -5.8201,
  lon: -35.2105,
  formatted: 'Rua das Acácias Amarelas, 120, Lagoa Nova, Natal - RN, 59075-000, Brasil',
})
const ruaEm = (suburb: string, lat: number, lon: number, postcode?: string) =>
  resultado({
    result_type: 'street',
    name: 'Rua do Sabiá Laranjeira',
    street: 'Rua do Sabiá Laranjeira',
    suburb,
    lat,
    lon,
    ...(postcode ? { postcode } : {}),
  })
const cidadeNatal = resultado({ result_type: 'city', lat: -5.7945, lon: -35.211, formatted: 'Natal, RN, Brasil' })
const bairroLagoaNova = resultado({ result_type: 'suburb', suburb: 'Lagoa Nova', lat: -5.8215, lon: -35.2099 })

describe('candidatosGeoapify — a resposta da Geoapify vira candidato', () => {
  it('a casa: rua, número, bairro, cidade, UF, CEP e o ponto', () => {
    expect(candidatosGeoapify({ results: [casa] })).toEqual([
      {
        lat: -5.8201,
        lon: -35.2105,
        tipo: 'house',
        rua: 'Rua das Acácias Amarelas',
        nome: null,
        numero: '120',
        lugares: ['Lagoa Nova'],
        cidades: ['Natal', 'Região Metropolitana de Natal'],
        estado: 'Rio Grande do Norte',
        cep: '59075-000',
        fonte: 'geoapify',
      },
    ])
  })

  it('a rua sem o campo "street" usa o nome; o bairro pode vir em "district" ou "quarter"', () => {
    const r = resultado({ result_type: 'street', name: 'Travessa do Xique-Xique', district: 'Felipe Camarão', quarter: 'Km 6', lat: -5.82, lon: -35.25 })
    expect(candidatosGeoapify({ results: [r] })[0]).toMatchObject({
      tipo: 'street',
      rua: 'Travessa do Xique-Xique',
      lugares: ['Felipe Camarão', 'Km 6'],
    })
  })

  it('na busca da RUA, o que não é rua nem casa é descartado (a cidade que volta quando a rua não existe)', () => {
    expect(candidatosGeoapify({ results: [cidadeNatal, bairroLagoaNova, casa] })).toHaveLength(1)
    expect(candidatosGeoapify({ results: [cidadeNatal, bairroLagoaNova] })).toEqual([])
  })

  it('na busca do LUGAR, fica o bairro e a cidade (com o nome do próprio campo) — a rua sai', () => {
    const lugares = candidatosGeoapify({ results: [cidadeNatal, bairroLagoaNova, casa] }, 'lugar')
    expect(lugares.map((l) => l.nome)).toEqual(['Natal', 'Lagoa Nova'])
  })

  it('o endereço digitado à mão aceita o que vier (a pessoa confere o pino)', () => {
    expect(candidatosGeoapify({ results: [cidadeNatal, casa] }, 'livre')).toHaveLength(2)
  })

  it('fora do Brasil, sem ponto ou resposta torta: nada', () => {
    expect(candidatosGeoapify({ results: [{ ...casa, country_code: 'pt' }] })).toEqual([])
    expect(candidatosGeoapify({ results: [{ ...casa, lat: undefined }] })).toEqual([])
    expect(candidatosGeoapify({ results: [{ ...casa, lat: null, lon: null }] })).toEqual([])
    expect(candidatosGeoapify({ results: 'x' })).toEqual([])
    expect(candidatosGeoapify(null)).toEqual([])
    expect(candidatosGeoapify({ features: [] })).toEqual([])
  })
})

describe('a escolha continua a de sempre com os candidatos da Geoapify', () => {
  const duasRuas = {
    results: [
      ruaEm('Pajuçara', -5.741, -35.228, '59133-000'),
      ruaEm('Planalto', -5.853, -35.262, '59073-000'),
    ],
  }

  it('rua de mesmo nome em dois bairros: fica a do bairro do pedido — não a 1ª da lista', () => {
    const e = partirEndereco('Rua do Sabiá Laranjeira 40, Planalto, Natal, RN, 59073-120, Brasil')
    expect(escolher(e, candidatosGeoapify(duasRuas))).toEqual({ ponto: { lat: -5.853, lon: -35.262 }, motivo: 'ok' })
  })

  it('rua de mesmo nome noutro bairro NÃO é aceita (ambíguo = não achei)', () => {
    const e = partirEndereco('Rua do Sabiá Laranjeira 40, Candelária, Natal, RN, Brasil')
    expect(escolher(e, candidatosGeoapify(duasRuas))).toEqual({ ponto: null, motivo: 'ambiguo' })
  })

  it('o bairro e a cidade dos degraus saem da busca do lugar', () => {
    const e = partirEndereco('Rua Inexistente 1, Lagoa Nova, Natal, RN, Brasil')
    const lugares = candidatosGeoapify({ results: [cidadeNatal, bairroLagoaNova] }, 'lugar')
    expect(escolherLugar(e, lugares, 'bairro')).toEqual({ lat: -5.8215, lon: -35.2099 })
    expect(escolherLugar(e, lugares, 'cidade')).toEqual({ lat: -5.7945, lon: -35.211 })
  })
})

describe('consultasGeoapify — o que se pergunta à Geoapify', () => {
  it('o endereço do cadastro: a busca estruturada e, depois, o texto com o bairro', () => {
    const e = partirEndereco('Av das Acácias Amarelas 120, Lagoa Nova, Natal, RN, 59.075-120, Brasil')
    const [estruturada, texto] = consultasGeoapify(e)
    expect(estruturada).toEqual({
      street: 'Avenida das Acácias Amarelas',
      housenumber: '120',
      postcode: '59075-120',
      city: 'Natal',
      // (a grafia é a do nomeDoEstado de sempre — o buscador não liga para maiúscula)
      state: 'Rio Grande Do Norte',
      country: 'Brasil',
      filter: 'rect:-38.6,-6.99,-34.9,-4.83|countrycode:br',
      bias: 'proximity:-35.2,-5.8',
      limit: '8',
    })
    // a documentação proíbe misturar o texto com os campos estruturados
    expect(estruturada.text).toBeUndefined()
    expect(texto).toMatchObject({ text: 'Avenida das Acácias Amarelas 120, Lagoa Nova, Natal, RN' })
    expect(texto.street).toBeUndefined()
  })

  it('o CEP geral da cidade e o "s/n" não vão na consulta', () => {
    const e = partirEndereco('Rua do Juazeiro s/n, Extremoz, RN, 59575-000, Brasil')
    const [estruturada] = consultasGeoapify(e)
    expect(estruturada.postcode).toBeUndefined()
    expect(estruturada.housenumber).toBeUndefined()
  })

  it('fora do RN: só o filtro do país', () => {
    const e = partirEndereco('Rua das Palmeiras 10, Centro, João Pessoa, PB, Brasil')
    expect(consultasGeoapify(e)[0].filter).toBe('countrycode:br')
  })

  it('o endereço digitado à mão vai em texto, só no RN', () => {
    const e = partirEndereco('loja de ferragens perto da rodoviária')
    expect(consultasGeoapify(e)).toEqual([
      { text: 'loja de ferragens perto da rodoviária', filter: 'rect:-38.6,-6.99,-34.9,-4.83|countrycode:br', bias: 'proximity:-35.2,-5.8', limit: '5' },
    ])
  })

  it('os degraus: o bairro em texto e a cidade pelo tipo "city"', () => {
    const e = partirEndereco('Rua X 1, Lagoa Nova, Natal, RN, Brasil')
    expect(consultaGeoapifyBairro(e)).toMatchObject({ text: 'Lagoa Nova, Natal, Rio Grande Do Norte' })
    expect(consultaGeoapifyCidade(e)).toMatchObject({ city: 'Natal', state: 'Rio Grande Do Norte', type: 'city' })
    expect(consultaGeoapifyBairro(partirEndereco('Rua X 1, Natal, RN, Brasil'))).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// O fluxo: Geoapify → (recusou) Photon → (os dois) "tentar depois"
// ---------------------------------------------------------------------------

type Rede = Partial<Record<'geoapify' | 'photon' | 'cep', (url: URL) => RespostaDaRede>>

function ambiente(rede: Rede, chave: string | null = 'CHAVE-DE-TESTE') {
  const chamadas: URL[] = []
  const amb: Ambiente = {
    buscar: async (url) => {
      chamadas.push(url)
      const quem = url.host.includes('geoapify') ? 'geoapify' : url.host.includes('photon') ? 'photon' : url.host.includes('cep') ? 'cep' : null
      const responde = quem ? rede[quem] : undefined
      return responde ? responde(url) : { erro: 'HTTP 404' }
    },
    esperar: async () => undefined,
    chaveGeoapify: chave,
    userAgent: 'teste',
    recusas: [],
    geoapifyRecusou: false,
  }
  const para = (trecho: string) => chamadas.filter((u) => u.host.includes(trecho))
  return { amb, chamadas, para }
}

const ENDERECO = 'Rua das Acácias Amarelas 120, Lagoa Nova, Natal, RN, 59075-120, Brasil'
const photonCasa = {
  features: [
    {
      geometry: { coordinates: [-35.2105, -5.8201] },
      properties: { type: 'house', street: 'Rua das Acácias Amarelas', housenumber: '120', district: 'Lagoa Nova', city: 'Natal', state: 'Rio Grande do Norte', countrycode: 'BR' },
    },
  ],
}

describe('procurarEndereco — a ordem dos buscadores', () => {
  it('a Geoapify acha: uma consulta só, com a chave, o filtro do país e sem o Photon', async () => {
    const { amb, chamadas, para } = ambiente({ geoapify: () => ({ corpo: { results: [casa] } }) })
    expect(await procurarEndereco(ENDERECO, amb)).toEqual({ tipo: 'ok', lat: -5.8201, lon: -35.2105, fonte: 'geoapify' })
    expect(chamadas).toHaveLength(1)
    const url = para('geoapify')[0]
    expect(url.origin + url.pathname).toBe('https://api.geoapify.com/v1/geocode/search')
    expect(url.searchParams.get('apiKey')).toBe('CHAVE-DE-TESTE')
    expect(url.searchParams.get('format')).toBe('json')
    expect(url.searchParams.get('lang')).toBe('pt')
    expect(url.searchParams.get('filter')).toContain('countrycode:br')
    expect(url.searchParams.get('street')).toBe('Rua das Acácias Amarelas')
    expect(amb.recusas).toEqual([])
  })

  it('o Nominatim não é mais chamado, em caminho nenhum', async () => {
    const { amb, chamadas } = ambiente({ geoapify: () => ({ erro: 'HTTP 500' }), photon: () => ({ erro: 'HTTP 403' }) })
    await procurarEndereco(ENDERECO, amb)
    expect(chamadas.some((u) => u.host.includes('nominatim'))).toBe(false)
  })

  it('a Geoapify recusa (chave errada): o Photon tenta — e os endereços seguintes nem gastam outra consulta nela', async () => {
    const { amb, para } = ambiente({ geoapify: () => ({ erro: 'HTTP 401' }), photon: () => ({ corpo: photonCasa }) })
    expect(await procurarEndereco(ENDERECO, amb)).toMatchObject({ tipo: 'ok', fonte: 'photon' })
    expect(para('geoapify')).toHaveLength(1)
    expect(amb.geoapifyRecusou).toBe(true)
    expect(amb.recusas).toContain('Geoapify HTTP 401')
    expect(await procurarEndereco(ENDERECO, amb)).toMatchObject({ tipo: 'ok', fonte: 'photon' })
    expect(para('geoapify')).toHaveLength(1)
  })

  it('sem a chave no servidor: vale a reserva', async () => {
    const { amb, para } = ambiente({ photon: () => ({ corpo: photonCasa }) }, null)
    expect(await procurarEndereco(ENDERECO, amb)).toMatchObject({ tipo: 'ok', fonte: 'photon' })
    expect(para('geoapify')).toHaveLength(0)
  })

  it('os dois recusam: "tentar depois" (nada de "não achei") — e a chave não aparece em mensagem nenhuma', async () => {
    const { amb } = ambiente({ geoapify: () => ({ erro: 'HTTP 429' }), photon: () => ({ erro: 'HTTP 403' }) })
    const r = await procurarEndereco(ENDERECO, amb)
    expect(r).toEqual({ tipo: 'erro', motivo: 'Geoapify HTTP 429, Photon HTTP 403' })
    expect(JSON.stringify([r, amb.recusas])).not.toContain('CHAVE-DE-TESTE')
    expect(JSON.stringify([r, amb.recusas])).not.toContain('Acácias')
  })

  it('a Geoapify responde "nada": é "não achei" de verdade — o Photon não é chamado (recusa ≠ vazio)', async () => {
    const { amb, para } = ambiente({ geoapify: () => ({ corpo: { results: [] } }) })
    expect(await procurarEndereco('Rua Que Não Existe 9, Natal, RN, Brasil', amb)).toMatchObject({ tipo: 'vazio' })
    expect(para('photon')).toHaveLength(0)
  })

  it('a rua não existe no mapa: o degrau da cidade (ponto aproximado), também pela Geoapify', async () => {
    const { amb, para } = ambiente({
      geoapify: (url) => ({ corpo: { results: url.searchParams.get('type') === 'city' ? [cidadeNatal] : [] } }),
    })
    expect(await procurarEndereco('Rua Que Não Existe 9, Natal, RN, Brasil', amb)).toEqual({
      tipo: 'ok',
      lat: -5.7945,
      lon: -35.211,
      fonte: 'aprox_cidade',
    })
    expect(para('photon')).toHaveLength(0)
  })

  it('o endereço digitado à mão: o 1º resultado, para a pessoa conferir o pino', async () => {
    const { amb, para } = ambiente({ geoapify: () => ({ corpo: { results: [bairroLagoaNova] } }) })
    expect(await procurarEndereco('lagoa nova perto do shopping', amb)).toEqual({ tipo: 'ok', lat: -5.8215, lon: -35.2099, fonte: 'geoapify' })
    expect(para('geoapify')[0].searchParams.get('text')).toBe('lagoa nova perto do shopping')
  })
})

describe('proximoEstado — desde quando a busca está fora', () => {
  const AGORA = '2026-11-23T12:00:00.000Z'
  it('a 1ª chamada sem resposta marca o começo da queda (e grava)', () => {
    expect(proximoEstado(null, { falhou: true, respondeu: false }, AGORA)).toEqual({
      estado: { fora_desde: AGORA, avisado: false },
      mudou: true,
    })
  })
  it('seguindo fora: o começo não muda e nada se grava', () => {
    const antes = { fora_desde: '2026-11-19T16:56:00.000Z', avisado: true }
    expect(proximoEstado(antes, { falhou: true, respondeu: false }, AGORA)).toEqual({ estado: antes, mudou: false })
  })
  it('voltou a responder: a queda acaba (grava uma vez)', () => {
    expect(proximoEstado({ fora_desde: '2026-11-19T16:56:00.000Z' }, { falhou: false, respondeu: true }, AGORA)).toEqual({
      estado: { fora_desde: null, avisado: false },
      mudou: true,
    })
  })
  it('tudo bem e continua bem (ou só veio do cache): nenhuma escrita', () => {
    expect(proximoEstado(null, { falhou: false, respondeu: true }, AGORA).mudou).toBe(false)
    expect(proximoEstado({ fora_desde: null }, { falhou: false, respondeu: false }, AGORA).mudou).toBe(false)
  })
})

describe('deveAvisarFora — o aviso no sino com 1 hora de busca fora (uma vez por queda)', () => {
  const CAIU = '2026-11-23T12:00:00.000Z'
  const mais = (min: number) => new Date(Date.parse(CAIU) + min * 60_000).toISOString()
  const falhou = { falhou: true, respondeu: false }
  const respondeu = { falhou: false, respondeu: true }

  it('recusando há 59 min: não avisa', () => {
    const { estado } = proximoEstado({ fora_desde: CAIU, avisado: false }, falhou, mais(59))
    expect(deveAvisarFora(estado, mais(59))).toBe(false)
  })
  it('com 61 min avisa uma vez; a 2ª chamada não avisa de novo', () => {
    const { estado } = proximoEstado({ fora_desde: CAIU, avisado: false }, falhou, mais(61))
    expect(deveAvisarFora(estado, mais(61))).toBe(true)
    // o banco marcou o "já avisado" na linha do estado; a chamada seguinte o lê
    const seguinte = proximoEstado({ ...estado, avisado: true }, falhou, mais(75))
    expect(seguinte.mudou).toBe(false)
    expect(deveAvisarFora(seguinte.estado, mais(75))).toBe(false)
  })
  it('a chamada que só leu do cache também encontra o estado "fora" e avisa', () => {
    const { estado } = proximoEstado({ fora_desde: CAIU }, { falhou: false, respondeu: false }, mais(90))
    expect(deveAvisarFora(estado, mais(90))).toBe(true)
  })
  it('voltou e caiu de novo: o "já avisado" zerou e a nova queda avisa outra vez', () => {
    const voltou = proximoEstado({ fora_desde: CAIU, avisado: true }, respondeu, mais(120))
    expect(voltou).toEqual({ estado: { fora_desde: null, avisado: false }, mudou: true })
    expect(deveAvisarFora(voltou.estado, mais(120))).toBe(false)
    const caiu = proximoEstado(voltou.estado, falhou, mais(180))
    expect(caiu).toEqual({ estado: { fora_desde: mais(180), avisado: false }, mudou: true })
    expect(deveAvisarFora(caiu.estado, mais(200))).toBe(false)
    expect(deveAvisarFora(caiu.estado, mais(241))).toBe(true)
  })
})

describe('o aviso de busca fora no sino', () => {
  it('o toque abre Rotas', async () => {
    const { destinoDoAviso } = await import('@/notificacoes/api')
    expect(destinoDoAviso({ tipo: 'busca_endereco_fora', card_id: null })).toBe('/fabrica/rotas/programacao')
  })
})
