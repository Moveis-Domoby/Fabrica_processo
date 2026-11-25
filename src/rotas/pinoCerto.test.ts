import { describe, expect, it } from 'vitest'
import {
  candidatosGeoapify,
  escolher,
  partirEndereco,
  ruaDoTextoLivre,
} from '../../supabase/functions/geocodificar/busca'
import { procurarEndereco } from '../../supabase/functions/geocodificar/fluxo'
import { pontoDaResposta } from './cepNoNavegador'
import type { Ambiente, RespostaDaRede } from '../../supabase/functions/geocodificar/fluxo'
import {
  cepDeRua,
  cepNoTexto,
  mesmoPontoDoMapa,
  ondeOPinoEsta,
  textoLongeDoCep,
  textoNaoMoveu,
} from './conferirPino'
import { pinosAConferir, textoPinosAConferir } from './pinoAConferir'

/**
 * SESSAO-57 — o pino certo. As respostas da Geoapify abaixo são AMOSTRAS no
 * formato da documentação (format=json → `{ results: [...] }`); os pontos do
 * caso 13961 são os do diagnóstico de 24/11 (o pino salvo e a referência
 * pública do CEP) — nenhuma consulta de verdade sai daqui.
 */
const resultado = (extra: Record<string, unknown>): Record<string, unknown> => ({
  country: 'Brasil',
  country_code: 'br',
  state: 'Rio Grande do Norte',
  county: 'Região Metropolitana de Natal',
  datasource: { sourcename: 'openstreetmap' },
  ...extra,
})

// O 13961: "Rua Veredas do Peruaçu 125, Nova Esperança, Parnamirim" — o mapa não conhece a rua.
const TEXTO_13961 = 'Rua Veredas do Peruaçu 125, Nova Esperança, Parnamirim'
const bairroNovaEsperanca = resultado({
  result_type: 'suburb',
  suburb: 'Nova Esperança',
  city: 'Parnamirim',
  lat: -5.909406,
  lon: -35.251107,
})
const cidadeParnamirim = resultado({ result_type: 'city', city: 'Parnamirim', lat: -5.9157, lon: -35.2628 })
const outraRua = resultado({
  result_type: 'street',
  street: 'Rua Pedro Américo',
  name: 'Rua Pedro Américo',
  suburb: 'Nova Esperança',
  city: 'Parnamirim',
  lat: -5.9101,
  lon: -35.2505,
})
const ruaCerta = resultado({
  result_type: 'building',
  street: 'Rua Veredas do Peruaçu',
  housenumber: '125',
  suburb: 'Nova Esperança',
  city: 'Parnamirim',
  lat: -5.9453,
  lon: -35.2769,
})

type Rede = Partial<Record<'geoapify', (url: URL) => RespostaDaRede>>
function ambiente(rede: Rede) {
  const chamadas: URL[] = []
  const amb: Ambiente = {
    buscar: async (url) => {
      chamadas.push(url)
      const responde = url.host.includes('geoapify') ? rede.geoapify : undefined
      return responde ? responde(url) : { erro: 'HTTP 404' }
    },
    esperar: async () => undefined,
    chaveGeoapify: 'CHAVE-DE-TESTE',
    recusas: [],
    geoapifyRecusou: false,
  }
  return { amb, chamadas }
}

describe('frente 1 · a busca digitada não aceita bairro ou cidade como se fosse a rua', () => {
  it('a rua escrita no começo do texto é reconhecida (sem o número); lugar e referência não têm rua', () => {
    expect(ruaDoTextoLivre(TEXTO_13961)).toBe('Rua Veredas do Peruaçu')
    expect(ruaDoTextoLivre('Av. Eng. Roberto Freire, Ponta Negra')).toBe('Av. Eng. Roberto Freire')
    expect(ruaDoTextoLivre('R Jaguarari nº 1200, Lagoa Nova')).toBe('R Jaguarari')
    expect(ruaDoTextoLivre('Travessa São José s/n, Natal')).toBe('Travessa São José')
    expect(ruaDoTextoLivre('lagoa nova perto do shopping')).toBeNull()
    expect(ruaDoTextoLivre('Midway Mall, Natal')).toBeNull()
    expect(ruaDoTextoLivre('Rua')).toBeNull()
  })

  it('o 13961: a Geoapify só devolve o bairro e a cidade → NÃO é "achou"; o bairro vira só onde abrir o mapa', async () => {
    const { amb } = ambiente({ geoapify: () => ({ corpo: { results: [bairroNovaEsperanca, cidadeParnamirim] } }) })
    expect(await procurarEndereco(TEXTO_13961, amb)).toEqual({
      tipo: 'aproximado',
      lugar: { lat: -5.909406, lon: -35.251107, nivel: 'bairro', nome: 'Nova Esperança' },
    })
  })

  it('só a cidade: o centro dela, com o nome', async () => {
    const { amb } = ambiente({ geoapify: () => ({ corpo: { results: [cidadeParnamirim] } }) })
    expect(await procurarEndereco(TEXTO_13961, amb)).toEqual({
      tipo: 'aproximado',
      lugar: { lat: -5.9157, lon: -35.2628, nivel: 'cidade', nome: 'Parnamirim' },
    })
  })

  it('a rua com OUTRO nome no mesmo bairro não serve (o nome precisa bater ≥ 0,75)', async () => {
    const { amb } = ambiente({ geoapify: () => ({ corpo: { results: [outraRua, bairroNovaEsperanca] } }) })
    expect((await procurarEndereco(TEXTO_13961, amb)).tipo).toBe('aproximado')
    const so = ambiente({ geoapify: () => ({ corpo: { results: [outraRua] } }) })
    expect(await procurarEndereco(TEXTO_13961, so.amb)).toEqual({ tipo: 'vazio', motivo: 'nome_nao_bate' })
  })

  it('a rua certa vem: é ela (mesmo depois do bairro na lista)', async () => {
    const { amb } = ambiente({ geoapify: () => ({ corpo: { results: [bairroNovaEsperanca, outraRua, ruaCerta] } }) })
    expect(await procurarEndereco(TEXTO_13961, amb)).toEqual({ tipo: 'ok', lat: -5.9453, lon: -35.2769, fonte: 'geoapify' })
  })

  it('sem rua no texto (um lugar, uma referência): a 1ª rua ou casa que vier', () => {
    const e = partirEndereco('perto da padaria de Nova Esperança')
    expect(escolher(e, candidatosGeoapify({ results: [bairroNovaEsperanca, outraRua] }, 'livre'))).toEqual({
      ponto: { lat: -5.9101, lon: -35.2505 },
      motivo: 'ok',
    })
  })

  it('o estado, o país e o "não sei" da Geoapify não entram nem como lugar', () => {
    const estado = resultado({ result_type: 'state', lat: -5.8, lon: -36.5 })
    const naoSei = resultado({ result_type: 'unknown', lat: -5.8, lon: -35.2 })
    expect(candidatosGeoapify({ results: [estado, naoSei] }, 'livre')).toEqual([])
  })

  it('a área do CEP conta como bairro (com o nome do bairro dela)', () => {
    const cep = resultado({ result_type: 'postcode', postcode: '59144-158', suburb: 'Nova Esperança', lat: -5.94, lon: -35.27 })
    expect(candidatosGeoapify({ results: [cep] }, 'livre')[0]).toMatchObject({ lugar: 'bairro', nome: 'Nova Esperança' })
  })

  it('o endereço do CADASTRO (com "Brasil") segue a regra de antes: a cidade é o degrau aproximado com aviso', async () => {
    const { amb } = ambiente({
      geoapify: (url) => ({ corpo: { results: url.searchParams.get('type') === 'city' ? [cidadeParnamirim] : [] } }),
    })
    const r = await procurarEndereco('Rua Veredas do Peruaçu 125, Nova Esperança, Parnamirim, RN, Brasil', amb)
    expect(r).toMatchObject({ tipo: 'ok', fonte: 'aprox_cidade' })
  })
})

// ↪️ 25/11 ("remover o lixo"): o ponto do CEP para conferir vem só do
// navegador — a consulta pelo servidor (sempre "limite de uso") saiu.
describe('frente 2 · o ponto do CEP para conferir o pino', () => {
  const CEP_13961 = { cep: '59144158', lat: '-5.9453', lng: '-35.2769', city: 'Parnamirim', state: 'RN', district: 'Nova Esperança', address: 'Rua Dois' }

  it('a resposta do serviço de CEP vira o ponto de referência (o 13961: o CEP 59144-158)', () => {
    expect(pontoDaResposta('59144-158', CEP_13961)).toEqual({ latitude: -5.9453, longitude: -35.2769 })
  })

  it('CEP geral da cidade, CEP torto ou sem CEP: nem pergunta', () => {
    expect(cepDeRua('59000-000')).toBeNull()
    expect(cepDeRua('123')).toBeNull()
    expect(cepDeRua(null)).toBeNull()
  })

  it('o serviço sem o ponto: null — não bloqueia nada', () => {
    expect(pontoDaResposta('59144158', { cep: '59144158' })).toBeNull()
  })
})

describe('frente 2 · as perguntas da tela', () => {
  it('o texto de onde o pino está', () => {
    expect(ondeOPinoEsta({ nivel: 'bairro', nome: 'Nova Esperança' })).toBe('no bairro Nova Esperança')
    expect(ondeOPinoEsta({ nivel: 'cidade', nome: 'Natal' })).toBe('no centro de Natal')
    expect(ondeOPinoEsta({ nivel: 'cidade', nome: null })).toBe('no centro da cidade')
    expect(textoNaoMoveu({ latitude: 0, longitude: 0, nivel: 'cidade', nome: 'Natal' })).toBe(
      'Você não moveu o pino — ele está no centro de Natal. Arraste até a casa ou confirme.',
    )
    expect(textoLongeDoCep(4.98)).toBe('O pino está a 5,0 km do CEP deste endereço. Confira antes de salvar.')
  })

  it('o CEP de rua (no campo ou no meio do texto digitado)', () => {
    expect(cepDeRua('59014-430')).toBe('59014430')
    expect(cepDeRua('59000-000')).toBeNull()
    expect(cepNoTexto('Rua X 10, Mãe Luiza, Natal, RN, 59014-430')).toBe('59014430')
    expect(cepNoTexto('Rua X 10, cep 59014430')).toBe('59014430')
    expect(cepNoTexto('Rua X 1200, Natal')).toBeNull()
    expect(cepNoTexto('Natal 59000-000')).toBeNull()
  })

  it('o pino que ninguém arrastou é o mesmo ponto (o 13840: o centro de Natal)', () => {
    const centro = { latitude: -5.805398, longitude: -35.2080905 }
    expect(mesmoPontoDoMapa(centro, { ...centro })).toBe(true)
    expect(mesmoPontoDoMapa(centro, { latitude: -5.8054, longitude: -35.2081 })).toBe(false)
    expect(mesmoPontoDoMapa(null, centro)).toBe(false)
  })
})

describe('frente 3 · os pedidos com o pino a conferir (a conta é na tela)', () => {
  const NATAL = { latitude: -5.805398, longitude: -35.2080905 }
  const base = { geo_resolvido: true as const, geo_manual: false, geo_aproximado: null }
  const pedidos = [
    // 13840: marcado à mão EXATAMENTE no centro de Natal
    { card_id: 1, programacao_data: '2026-11-24', ...base, ...NATAL, geo_manual: true },
    // 13976: ainda o ponto aproximado de Natal
    { card_id: 2, programacao_data: '2026-11-24', ...base, ...NATAL, geo_aproximado: 'cidade' },
    // 13961: marcado à mão noutro lugar (não é o centro de cidade nenhuma da lista)
    { card_id: 3, programacao_data: '2026-11-24', ...base, latitude: -5.909406, longitude: -35.251107, geo_manual: true },
    // um de ontem com ponto aproximado: não conta
    { card_id: 4, programacao_data: '2026-11-23', ...base, ...NATAL, geo_aproximado: 'cidade' },
    // pela busca, com rua: não conta
    { card_id: 5, programacao_data: '2026-11-25', ...base, latitude: -5.79, longitude: -35.2 },
    // sem ponto: não conta aqui (o cartão já avisa "sem ponto")
    { card_id: 6, programacao_data: '2026-11-25', ...base, latitude: null, longitude: null, geo_resolvido: false },
  ]

  it('conta o aproximado e o marcado à mão no centro — de hoje em diante', () => {
    const r = pinosAConferir(pedidos, '2026-11-24')
    expect([...r.aConferir].sort()).toEqual([1, 2])
    expect([...r.noCentro]).toEqual([1])
  })

  it('o ponto aproximado de um pedido de ontem ainda serve para reconhecer o centro da cidade', () => {
    const r = pinosAConferir([pedidos[0], pedidos[3]], '2026-11-24')
    expect([...r.aConferir]).toEqual([1])
  })

  it('sem nenhum aproximado na lista, o marcado à mão não tem com o que comparar (não conta)', () => {
    expect(pinosAConferir([pedidos[0]], '2026-11-24').aConferir.size).toBe(0)
  })

  it('o texto da faixa', () => {
    expect(textoPinosAConferir(1)).toBe('1 pedido com o pino a conferir')
    expect(textoPinosAConferir(3)).toBe('3 pedidos com o pino a conferir')
  })
})
