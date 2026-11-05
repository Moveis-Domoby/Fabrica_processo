import { describe, expect, it } from 'vitest'
import {
  candidatosNominatim,
  candidatosPhoton,
  consultaBairro,
  consultaCidade,
  consultasTexto,
  escolher,
  escolherLugar,
  escolherPerto,
  lugarBate,
  partirEndereco,
  pontoDoCep,
  semelhancaNome,
} from '../../supabase/functions/geocodificar/busca'

/**
 * SESSAO-45: a regra da busca de endereço (a Edge Function `geocodificar`).
 * Os candidatos abaixo são respostas REAIS do Photon/Nominatim de 04/11/2026,
 * só com os campos que a regra lê — os casos que o raio-x achou errados.
 */
const rua = (
  lat: number,
  lon: number,
  name: string,
  extra: Record<string, string> = {},
): Record<string, unknown> => ({
  geometry: { coordinates: [lon, lat] },
  properties: { type: 'street', name, state: 'Rio Grande do Norte', countrycode: 'BR', ...extra },
})

describe('partirEndereco — o endereço do banco lido de trás para a frente', () => {
  it('com tudo: rua, número, bairro, cidade, UF e CEP', () => {
    expect(
      partirEndereco('Rua Desembargador Lins Bahia 173, Rocas, Natal, RN, 59.010-190, Brasil'),
    ).toMatchObject({
      livre: false,
      rua: 'Rua Desembargador Lins Bahia',
      numero: '173',
      bairro: 'Rocas',
      cidade: 'Natal',
      uf: 'RN',
      cep: '59010190',
    })
  })

  it('sem bairro: a cidade não vira o bairro (o defeito da busca antiga)', () => {
    expect(
      partirEndereco('RUA PROFESSORA ALICE RODRIGUES 1005 A, Extremoz, RN, 59575-000, Brasil'),
    ).toMatchObject({ rua: 'RUA PROFESSORA ALICE RODRIGUES', numero: '1005 A', bairro: null, cidade: 'Extremoz', uf: 'RN' })
  })

  it('estrada com número no nome', () => {
    expect(partirEndereco('Estrada RN 313 28, PIUM, Nísia Floresta, RN, 59.164-000, Brasil')).toMatchObject({
      rua: 'Estrada RN 313',
      numero: '28',
      bairro: 'PIUM',
      cidade: 'Nísia Floresta',
    })
  })

  it('o digitado à mão (sem o "Brasil" no fim) é livre', () => {
    expect(partirEndereco('Av Machado de Assis, 400').livre).toBe(true)
  })

  it('as consultas usam a rua por extenso e a cidade', () => {
    const e = partirEndereco('Av Machado de Assis 400, bosque das colinas, São José de Mipibu, RN, 59162-000, Brasil')
    expect(consultasTexto(e)[0]).toBe('Avenida Machado de Assis 400, São José de Mipibu')
    expect(consultasTexto(e)).toContain('Avenida Machado de Assis, bosque das colinas, São José de Mipibu')
  })
})

describe('semelhancaNome e lugarBate', () => {
  it('abreviação e acento não atrapalham', () => {
    expect(semelhancaNome('Av Machado de Assis', 'Avenida Machado de Assis')).toBe(1)
    expect(semelhancaNome('Rua Pe. João Maria', 'Rua Padre João Maria')).toBe(1)
    expect(semelhancaNome('Rua Praia de Muriu', 'Avenida Praia de Muriú')).toBe(1)
  })
  it('uma letra trocada na palavra comprida (erro do mapa) ainda bate', () => {
    expect(semelhancaNome('Rua Ceilândia', 'Rua Ceilanadia')).toBe(1)
  })
  it('o título trocado (Vereador × Governador, Almirante) é a mesma rua; o sobrenome curto sozinho, não', () => {
    expect(semelhancaNome('Rua Vereador Augusto de Souza', 'Rua Governador Augusto de Souza')).toBeGreaterThanOrEqual(0.75)
    expect(semelhancaNome('Rua Tamandaré', 'Rua Almirante Tamandaré')).toBeGreaterThanOrEqual(0.75)
    expect(semelhancaNome('Rua Doutor Silva', 'Rua Coronel Silva')).toBeLessThan(0.75)
  })
  it('CEP com ponto no lugar do traço não desloca a cidade', () => {
    expect(partirEndereco('Rua Tamandaré 171, Passagem de Areia, Parnamirim, RN, 59145.480, Brasil')).toMatchObject({
      bairro: 'Passagem de Areia',
      cidade: 'Parnamirim',
      cep: '59145480',
    })
  })
  it('outra rua não bate', () => {
    expect(semelhancaNome('Avenida Maria Lacerda Montenegro', 'Rua Maria Dolores da Costa')).toBeLessThan(0.75)
    expect(semelhancaNome('Rua Desembargador Lins Bahia', 'Rua Linhares')).toBeLessThan(0.75)
  })
  it('o bairro bate com a localidade do mapa ("Residencial Bosque das Colinas")', () => {
    expect(lugarBate('bosque das colinas', ['Residencial Bosque das Colinas', 'Taborda'])).toBe(true)
    expect(lugarBate('Planalto', ['Felipe Camarão'])).toBe(false)
  })
})

describe('escolher — o ponto certo entre as ruas de mesmo nome', () => {
  it('São José de Mipibu: o mapa chama o lugar de "Taborda", o bairro prova (antes: não encontrado)', () => {
    const e = partirEndereco('Av Machado de Assis 400, bosque das colinas, São José de Mipibu, RN, 59162-000, Brasil')
    const c = candidatosPhoton({
      features: [
        rua(-5.9749, -35.2809, 'Avenida Machado de Assis', { locality: 'Residencial Bosque das Colinas', city: 'Taborda', postcode: '59144-206' }),
      ],
    })
    expect(escolher(e, c)).toEqual({ ponto: { lat: -5.9749, lon: -35.2809 }, motivo: 'ok' })
  })

  it('Rua São João em Lagoa Seca: o bairro e o CEP escolhem a certa entre 7 (antes: a de Pajuçara, 12 km)', () => {
    const e = partirEndereco('Rua São João 1387, Lagoa Seca, Natal, RN, 59.022-390, Brasil')
    const c = candidatosPhoton({
      features: [
        rua(-5.7412, -35.2391, 'Rua São João', { district: 'Pajuçara', city: 'Natal', postcode: '59123-500' }),
        rua(-5.855, -35.2485, 'Rua São João', { district: 'Planalto', city: 'Natal', postcode: '59068-170' }),
        rua(-5.8321, -35.2486, 'Rua São João', { district: 'Felipe Camarão', city: 'Natal', postcode: '59064-000' }),
        rua(-5.8078, -35.2098, 'Rua São João', { district: 'Lagoa Seca', city: 'Natal', postcode: '59022-390' }),
        rua(-5.7565, -35.26, 'Rua São João do Meriti', { district: 'Potengi', city: 'Natal', postcode: '59110-220' }),
      ],
    })
    expect(escolher(e, c).ponto).toEqual({ lat: -5.8078, lon: -35.2098 })
  })

  it('Rua Ceilândia no Planalto: a do bairro certo, mesmo com o nome do mapa com erro (antes: Pajuçara, 11 km)', () => {
    const e = partirEndereco('Rua Ceilândia 1050, Planalto, Natal, RN, 59073-074, Brasil')
    const c = candidatosPhoton({
      features: [
        rua(-5.7514, -35.2351, 'Rua Ceilândia', { district: 'Pajuçara', city: 'Natal', postcode: '59122-200' }),
        rua(-5.8504, -35.2641, 'Rua Ceilanadia', { district: 'Planalto', city: 'Natal', postcode: '59073-130' }),
      ],
    })
    expect(escolher(e, c).ponto).toEqual({ lat: -5.8504, lon: -35.2641 })
  })

  it('só a cidade prova o lugar e há ruas de mesmo nome longe uma da outra = não achei (a pessoa marca)', () => {
    const e = partirEndereco('Rua São João 10, Bairro Que o Mapa Não Tem, Natal, RN, 59000-000, Brasil')
    const c = candidatosPhoton({
      features: [
        rua(-5.7412, -35.2391, 'Rua São João', { district: 'Pajuçara', city: 'Natal' }),
        rua(-5.8078, -35.2098, 'Rua São João', { district: 'Lagoa Seca', city: 'Natal' }),
      ],
    })
    expect(escolher(e, c)).toEqual({ ponto: null, motivo: 'ambiguo' })
  })

  it('a mesma rua em trechos perto um do outro (só a cidade bate) é aceita', () => {
    const e = partirEndereco('Rua Desembargador Lins Bahia 173, Rocas, Natal, RN, 59.010-190, Brasil')
    const c = candidatosNominatim([
      { lat: '-5.7790987', lon: '-35.1980256', category: 'highway', name: 'Rua Desembargador Lins Bahia',
        address: { road: 'Rua Desembargador Lins Bahia', suburb: 'Praia do Meio', city: 'Natal', state: 'Rio Grande do Norte', postcode: '59012-310' } },
      { lat: '-5.7800460', lon: '-35.1994011', category: 'highway', name: 'Rua Desembargador Lins Bahia',
        address: { road: 'Rua Desembargador Lins Bahia', suburb: 'Rocas', city: 'Natal', state: 'Rio Grande do Norte', postcode: '59012-310' } },
    ])
    // o trecho do bairro Rocas ganha
    expect(escolher(e, c).ponto).toEqual({ lat: -5.780046, lon: -35.1994011 })
  })

  it('rua de mesmo nome noutra cidade não serve', () => {
    const e = partirEndereco('Avenida Abel Cabral 505, Nova Parnamirim, Parnamirim, RN, 59151-250, Brasil')
    const c = candidatosPhoton({
      features: [rua(-5.79, -35.21, 'Avenida Abel Cabral', { district: 'Lagoa Nova', city: 'Natal', postcode: '59060-000' })],
    })
    expect(escolher(e, c)).toEqual({ ponto: null, motivo: 'fora_do_lugar' })
  })

  it('a casa com o número certo ganha da rua', () => {
    const e = partirEndereco('Rua Aroeira 375, Nova Parnamirim, Parnamirim, RN, 59.152-100, Brasil')
    const c = candidatosPhoton({
      features: [
        rua(-5.8896, -35.1931, 'Rua Aroeira', { district: 'Nova Parnamirim', city: 'Parnamirim' }),
        {
          geometry: { coordinates: [-35.1925, -5.8901] },
          properties: { type: 'house', street: 'Rua Aroeira', housenumber: '375', district: 'Nova Parnamirim', city: 'Parnamirim', state: 'Rio Grande do Norte' },
        },
      ],
    })
    expect(escolher(e, c).ponto).toEqual({ lat: -5.8901, lon: -35.1925 })
  })

  it('o digitado à mão leva o 1º do buscador (a pessoa confere no pino)', () => {
    const e = partirEndereco('Casa do bizotê')
    const c = candidatosPhoton({ features: [{ geometry: { coordinates: [-35.22, -5.81] }, properties: { type: 'house', name: 'Casa do Bizotê' } }] })
    expect(escolher(e, c).ponto).toEqual({ lat: -5.81, lon: -35.22 })
  })
})

/**
 * Ajuste do dono (05/11 — "não pode acontecer o caso de endereço não
 * encontrado"): quando a rua não se acha, a busca desce em degraus — o ponto do
 * CEP, o centro do bairro, o centro da cidade — e o ponto do CEP/bairro acha a
 * rua de mesmo nome que fica perto dele. Respostas reais do serviço de CEP e do
 * Photon (camadas de lugar) de 05/11/2026, só com os campos que a regra lê.
 */
const lugar = (lat: number, lon: number, type: string, name: string, extra: Record<string, string> = {}) => ({
  geometry: { coordinates: [lon, lat] },
  properties: { type, name, state: 'Rio Grande do Norte', countrycode: 'BR', ...extra },
})

describe('os degraus — nunca mais "endereço não encontrado"', () => {
  const ambiguo = partirEndereco('Rua São João 10, Bairro Que o Mapa Não Tem, Natal, RN, 59.022-390, Brasil')
  const duasSaoJoao = candidatosPhoton({
    features: [
      rua(-5.7412, -35.2391, 'Rua São João', { district: 'Pajuçara', city: 'Natal' }),
      rua(-5.8078, -35.2098, 'Rua São João', { district: 'Lagoa Seca', city: 'Natal' }),
    ],
  })

  it('a rua ambígua se resolve pelo ponto do CEP: a de mesmo nome perto dele é a certa (ponto de rua)', () => {
    expect(escolher(ambiguo, duasSaoJoao).motivo).toBe('ambiguo')
    const cep = pontoDoCep(ambiguo, {
      cep: '59022390', address: 'Rua São João', address_name: 'São João', district: 'Lagoa Seca',
      city: 'Natal', state: 'RN', lat: '-5.8085', lng: '-35.2105',
    })
    expect(cep).toEqual({ lat: -5.8085, lon: -35.2105, geral: false })
    expect(escolherPerto(ambiguo, duasSaoJoao, { ...cep!, degrau: 'cep' })).toEqual({ lat: -5.8078, lon: -35.2098, fonte: 'photon' })
  })

  it('nenhuma rua de mesmo nome perto da âncora: fica o ponto da âncora (aproximado)', () => {
    expect(escolherPerto(ambiguo, duasSaoJoao, { lat: -5.95, lon: -35.3, degrau: 'bairro' })).toBeNull()
  })

  it('o ponto do CEP só vale na cidade do pedido e com a rua ou o bairro batendo', () => {
    const e = partirEndereco('Rua Desembargador Lins Bahia 173, Rocas, Natal, RN, 59.010-190, Brasil')
    const resposta = { cep: '59010190', address: 'Rua Desembargador Lins Bahia', district: 'Rocas', city: 'Natal', state: 'RN', lat: '-5.7799', lng: '-35.1996' }
    expect(pontoDoCep(e, resposta)).toEqual({ lat: -5.7799, lon: -35.1996, geral: false })
    // CEP de outra cidade (digitado errado): não leva o ponto para lá
    expect(pontoDoCep(e, { ...resposta, city: 'Parnamirim' })).toBeNull()
    // CEP de outra rua e de outro bairro na mesma cidade: suspeito, não serve
    expect(pontoDoCep(e, { ...resposta, address: 'Avenida Prudente de Morais', district: 'Lagoa Nova' })).toBeNull()
    // o serviço sem ponto (CEP que não existe, limite de uso): nada
    expect(pontoDoCep(e, { code: 'not_found' })).toBeNull()
  })

  it('o CEP geral da cidade (…000) é o centro dela', () => {
    const e = partirEndereco('RUA PROFESSORA ALICE RODRIGUES 1005 A, Extremoz, RN, 59575-000, Brasil')
    expect(pontoDoCep(e, { cep: '59575000', address: '', city: 'Extremoz', state: 'RN', lat: '-5.7058', lng: '-35.3035' }))
      .toEqual({ lat: -5.7058, lon: -35.3035, geral: true })
  })

  it('o centro do bairro: o nome igual, dentro da cidade do pedido (o condomínio "Atol das Rocas" de Lagoa Nova não engana)', () => {
    const e = partirEndereco('Rua Desembargador Lins Bahia 173, Rocas, Natal, RN, 59.010-190, Brasil')
    expect(consultaBairro(e)).toBe('Rocas, Natal')
    const c = candidatosPhoton({
      features: [
        lugar(-5.8247, -35.2106, 'locality', 'Condomínio Residencial Atol das Rocas', { city: 'Natal', district: 'Lagoa Nova' }),
        lugar(-5.7737, -35.1998, 'district', 'Rocas', { city: 'Natal' }),
      ],
    })
    expect(escolherLugar(e, c, 'bairro')).toEqual({ lat: -5.7737, lon: -35.1998 })
    // só o condomínio (que o mapa diz ficar em Lagoa Nova): não é o bairro do pedido
    expect(escolherLugar(e, [c[0]], 'bairro')).toBeNull()
  })

  it('o bairro que o mapa chama por um nome maior ("Pium" → "Pium de Nísia") ainda serve', () => {
    const e = partirEndereco('Estrada RN 313 28, PIUM, Nísia Floresta, RN, 59.164-000, Brasil')
    const c = candidatosPhoton({
      features: [lugar(-5.9685, -35.1959, 'district', 'Pium de Nísia', { city: 'Nísia Floresta' })],
    })
    expect(escolherLugar(e, c, 'bairro')).toEqual({ lat: -5.9685, lon: -35.1959 })
    // bairro de mesmo nome noutra cidade não serve
    const outra = candidatosPhoton({ features: [lugar(-5.8, -35.2, 'district', 'Pium', { city: 'Natal' })] })
    expect(escolherLugar(e, outra, 'bairro')).toBeNull()
  })

  it('o centro da cidade: só com o nome igual (São José de Mipibu não é São José do Campestre)', () => {
    const e = partirEndereco('Av Machado de Assis 400, bosque das colinas, São José de Mipibu, RN, 59162-000, Brasil')
    expect(consultaCidade(e)).toBe('São José de Mipibu, Rio Grande Do Norte')
    expect(escolherLugar(e, candidatosPhoton({ features: [lugar(-6.0747, -35.237, 'city', 'São José de Mipibu')] }), 'cidade'))
      .toEqual({ lat: -6.0747, lon: -35.237 })
    expect(escolherLugar(e, candidatosPhoton({ features: [lugar(-6.2, -35.7, 'city', 'São José do Campestre')] }), 'cidade'))
      .toBeNull()
  })

  it('o digitado à mão não desce degraus (a pessoa marca o pino na janela)', () => {
    const e = partirEndereco('Casa do bizotê')
    expect(consultaBairro(e)).toBeNull()
    expect(consultaCidade(e)).toBeNull()
  })
})
