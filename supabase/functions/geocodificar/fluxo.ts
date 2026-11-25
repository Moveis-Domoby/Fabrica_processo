// ============================================================================
// PLATAFORMA DE PRODUÇÃO DOMOBY · o FLUXO da busca de endereço — SESSAO-56
//
// A ordem dos buscadores e dos degraus, sem Deno e com a rede INJETADA — o
// Vitest prova a ordem (src/rotas/buscaGeoapify.test.ts) sem chamar ninguém:
//
//   1. a GEOAPIFY (chave própria da Domoby — escolha do dono, 23/11/2026) é o
//      ÚNICO buscador. ↪️ 25/11 (pedido do dono: "remover o lixo"): saíram do
//      código o Photon (a reserva — recusava o servidor desde 19/11), o
//      Nominatim (recusava desde 03/10) e a consulta do CEP pelo SERVIDOR
//      (o serviço de CEP responde "limite de uso" a todas as chamadas daqui).
//   2. o CEP chega pronto do NAVEGADOR (ajuste de 24/11) — sem ele, o degrau
//      do CEP fica de fora.
//
// Os degraus continuam (CEP → bairro como âncora → cidade), pela Geoapify.
// Buscador que RECUSA não é "não achei": nada se grava e a tela avisa
// (`tipo: 'erro'`).
//
// ⚠️ A chave da Geoapify vai na URL — por isso NENHUMA mensagem daqui leva a
// URL: só o nome do buscador e o código da resposta. O endereço do cliente
// também nunca vai para o registro (dado pessoal).
// ============================================================================
import {
  candidatosGeoapify,
  consultaGeoapifyBairro,
  consultaGeoapifyCidade,
  consultasGeoapify,
  escolher,
  escolherLugar,
  escolherPerto,
  partirEndereco,
  pontoDoCep,
  semRepetidos,
} from './busca.ts'
import type {
  Candidato,
  ConsultaGeoapify,
  EnderecoPartido,
  LugarAproximado,
  ModoGeoapify,
  PontoDoCep,
} from './busca.ts'

export const GEOAPIFY = 'https://api.geoapify.com/v1/geocode/search'

/** De onde veio o ponto: a rua (pelo buscador ou pelo CEP da própria rua) ou a cidade (aproximado, com aviso). */
export type Fonte = 'geoapify' | 'cep' | 'aprox_cidade'

export type Consulta =
  | { tipo: 'ok'; lat: number; lon: number; fonte: Fonte }
  | { tipo: 'vazio'; motivo: string }
  /**
   * SESSAO-57: o endereço DIGITADO sem rua achada — só o bairro ou a cidade.
   * NÃO é o ponto da casa: a tela abre o mapa ali e pede para arrastar o pino.
   */
  | { tipo: 'aproximado'; lugar: LugarAproximado }
  /** Nenhum buscador respondeu: nada se grava, a tela avisa e oferece tentar de novo. */
  | { tipo: 'erro'; motivo: string }

export type RespostaDaRede = { corpo: unknown } | { erro: string }

export interface Ambiente {
  /** Uma consulta HTTP com tempo limite; erro de rede/HTTP vira `{ erro }` SEM a URL. */
  buscar: (url: URL, cabecalhos: Record<string, string>) => Promise<RespostaDaRede>
  /** A espera entre duas consultas (a Geoapify aceita até 5 por segundo). */
  esperar: () => Promise<void>
  /** A chave da Geoapify (segredo da função); sem ela, a busca não responde (a tela avisa). */
  chaveGeoapify: string | null
  /** As recusas/falhas desta chamada (para o registro da função — sem endereço). */
  recusas: string[]
  /**
   * A Geoapify recusou NESTA chamada (chave, cota): os endereços seguintes da
   * mesma chamada nem tentam, sem gastar outra consulta.
   */
  geoapifyRecusou: boolean
}

type Lista = { lista: Candidato[] } | { erro: string }

/** Recusa que não adianta repetir já (chave errada, cota do dia, ritmo). */
const RECUSA_QUE_DURA = /HTTP (401|403|429)$/

async function pelaGeoapify(amb: Ambiente, consulta: ConsultaGeoapify, modo: ModoGeoapify): Promise<Lista> {
  if (!amb.chaveGeoapify) return { erro: 'Geoapify sem chave' }
  if (amb.geoapifyRecusou) return { erro: 'Geoapify em pausa' }
  const url = new URL(GEOAPIFY)
  for (const [k, v] of Object.entries(consulta)) url.searchParams.set(k, v)
  url.searchParams.set('lang', 'pt')
  url.searchParams.set('format', 'json')
  url.searchParams.set('apiKey', amb.chaveGeoapify)
  const r = await amb.buscar(url, { Accept: 'application/json' })
  if ('erro' in r) {
    if (RECUSA_QUE_DURA.test(r.erro)) amb.geoapifyRecusou = true
    return { erro: `Geoapify ${r.erro}` }
  }
  return { lista: candidatosGeoapify(r.corpo, modo) }
}

/**
 * Ajuste 24/11: a resposta do serviço de CEP que o NAVEGADOR consultou (o
 * serviço recusa este servidor por limite de uso) — vale só se for do MESMO CEP
 * do endereço; senão `undefined` (não veio, ou não serve): sem degrau do CEP.
 */
export function respostaDoNavegador(e: EnderecoPartido, cepDoNavegador: unknown): unknown {
  if (!e.cep || !cepDoNavegador || typeof cepDoNavegador !== 'object') return undefined
  const cep = (cepDoNavegador as Record<string, unknown>).cep
  if (typeof cep !== 'string' || cep.replace(/\D/g, '') !== e.cep) return undefined
  return cepDoNavegador
}

/** O ponto do CEP que o navegador mandou (sem resposta do navegador = sem degrau do CEP, nunca erro). */
function peloCep(e: EnderecoPartido, cepDoNavegador?: unknown): PontoDoCep | null {
  if (!e.cep) return null
  const doNavegador = respostaDoNavegador(e, cepDoNavegador)
  return doNavegador === undefined ? null : pontoDoCep(e, doNavegador)
}

/** Um LUGAR (o bairro ou a cidade) pela Geoapify; erro quando ela não respondeu. */
async function lugar(amb: Ambiente, pausa: () => Promise<void>, consulta: ConsultaGeoapify): Promise<Lista> {
  await pausa()
  const r = await pelaGeoapify(amb, consulta, 'lugar')
  if ('erro' in r) amb.recusas.push(r.erro)
  return r
}

/**
 * A rua não foi achada (ou ficou ambígua). O ponto do CEP e o centro do bairro
 * servem só de ÂNCORA: a rua com o nome do pedido perto deles é a certa (ponto
 * de rua); o ponto do CEP da PRÓPRIA rua do pedido também é ponto de rua. Sem
 * rua: o centro da CIDADE, aproximado (o cartão avisa para ajustar o pino) —
 * nunca o centro do bairro (correção do dono, 05/11). Só o buscador falhando
 * (nada respondeu) é "tentar depois"; nada gravado.
 */
async function degraus(
  amb: Ambiente,
  pausa: () => Promise<void>,
  e: EnderecoPartido,
  candidatos: Candidato[],
  cepDoNavegador?: unknown,
): Promise<Consulta> {
  const cep = peloCep(e, cepDoNavegador)
  if (cep && !cep.geral) {
    const rua = escolherPerto(e, candidatos, { lat: cep.lat, lon: cep.lon, degrau: 'cep' })
    if (rua) return { tipo: 'ok', lat: rua.lat, lon: rua.lon, fonte: rua.fonte }
    if (cep.ruaBate) return { tipo: 'ok', lat: cep.lat, lon: cep.lon, fonte: 'cep' }
  }

  // o bairro só ajuda se o buscador trouxe alguma rua com o nome do pedido
  const doBairro = consultaGeoapifyBairro(e)
  if (candidatos.length > 0 && doBairro) {
    const r = await lugar(amb, pausa, doBairro)
    if ('erro' in r) return { tipo: 'erro', motivo: r.erro }
    const bairro = escolherLugar(e, r.lista, 'bairro')
    if (bairro) {
      const rua = escolherPerto(e, candidatos, { ...bairro, degrau: 'bairro' })
      if (rua) return { tipo: 'ok', lat: rua.lat, lon: rua.lon, fonte: rua.fonte }
    }
  }

  // o CEP geral da cidade (…000) já é o centro dela
  if (cep?.geral) return { tipo: 'ok', lat: cep.lat, lon: cep.lon, fonte: 'aprox_cidade' }
  const daCidade = consultaGeoapifyCidade(e)
  if (daCidade) {
    const r = await lugar(amb, pausa, daCidade)
    if ('erro' in r) return { tipo: 'erro', motivo: r.erro }
    const cidade = escolherLugar(e, r.lista, 'cidade')
    if (cidade) return { tipo: 'ok', lat: cidade.lat, lon: cidade.lon, fonte: 'aprox_cidade' }
  }
  return { tipo: 'vazio', motivo: 'sem_cidade' }
}

/**
 * O ponto de UM endereço: os candidatos da Geoapify, a escolha de sempre
 * (busca.ts) e, sem rua, os degraus. A Geoapify não respondeu = "tentar
 * depois" (`erro`); resposta vazia = "não achei".
 */
export async function procurarEndereco(endereco: string, amb: Ambiente, cepDoNavegador?: unknown): Promise<Consulta> {
  const e = partirEndereco(endereco)
  const candidatos: Candidato[] = []
  const modo: ModoGeoapify = e.livre || !e.rua ? 'livre' : 'rua'
  let respondeu = false
  let primeira = true
  const pausa = async () => {
    if (!primeira) await amb.esperar()
    primeira = false
  }

  for (const consulta of consultasGeoapify(e)) {
    await pausa()
    const r = await pelaGeoapify(amb, consulta, modo)
    if ('erro' in r) {
      amb.recusas.push(r.erro)
      break // recusando: não insiste na outra forma
    }
    respondeu = true
    candidatos.push(...r.lista)
    // a 1ª consulta já achou (o bairro ou o CEP certos): não gasta a outra
    if (escolher(e, semRepetidos(candidatos)).motivo === 'ok') break
  }

  if (!respondeu) return { tipo: 'erro', motivo: [...new Set(amb.recusas)].join(', ') || 'sem resposta' }
  const unicos = semRepetidos(candidatos)
  const escolha = escolher(e, unicos)
  if (!escolha.ponto) {
    // o endereço digitado à mão: a pessoa marca o pino na própria janela —
    // SESSAO-57: com o bairro ou a cidade só como o lugar onde o mapa abre
    if (e.livre && escolha.aproximado) return { tipo: 'aproximado', lugar: escolha.aproximado }
    if (e.livre) return { tipo: 'vazio', motivo: escolha.motivo }
    const degrau = await degraus(amb, pausa, e, unicos, cepDoNavegador)
    return degrau.tipo === 'vazio' ? { tipo: 'vazio', motivo: `${escolha.motivo}+${degrau.motivo}` } : degrau
  }
  const ponto = escolha.ponto
  const fonte = candidatos.find((c) => c.lat === ponto.lat && c.lon === ponto.lon)?.fonte ?? 'geoapify'
  return { tipo: 'ok', lat: ponto.lat, lon: ponto.lon, fonte }
}

// ---------------------------------------------------------------------------
// O estado da busca (frente 3 — "ninguém fica 4 dias sem saber")
// ---------------------------------------------------------------------------

/**
 * Desde quando a busca está sem responder (ISO); `null` = está respondendo.
 * SESSAO-56 (ajustes — resposta do dono, 23/11): `avisado` = esta queda já
 * virou aviso no sino (uma vez por queda); volta a `false` quando a busca volta.
 */
export interface EstadoDaBusca {
  fora_desde: string | null
  avisado?: boolean
}

/** Depois de quanto tempo fora a busca vira aviso no sino (admin e logística). */
export const AVISAR_FORA_APOS_MS = 60 * 60 * 1000

/**
 * O estado depois de uma chamada: a que terminou SEM resposta de nenhum
 * buscador marca o começo da queda (se ainda não havia); a que respondeu
 * (achou ou disse "não achei") encerra a queda e zera o "já avisado". `mudou` =
 * precisa gravar — só nas viradas (nenhuma escrita a mais enquanto tudo vai bem).
 */
export function proximoEstado(
  atual: EstadoDaBusca | null,
  chamada: { falhou: boolean; respondeu: boolean },
  agora: string,
): { estado: EstadoDaBusca; mudou: boolean } {
  const antes = atual?.fora_desde ?? null
  const avisado = antes !== null && atual?.avisado === true
  if (chamada.falhou) {
    return antes === null
      ? { estado: { fora_desde: agora, avisado: false }, mudou: true }
      : { estado: { fora_desde: antes, avisado }, mudou: false }
  }
  if (chamada.respondeu) {
    return { estado: { fora_desde: null, avisado: false }, mudou: antes !== null || atual?.avisado === true }
  }
  return { estado: { fora_desde: antes, avisado }, mudou: false }
}

/**
 * SESSAO-56 (ajustes): a chamada que encontra a busca fora há 1 hora ou mais,
 * e a queda ainda não avisada, pede ao banco o aviso no sino — sem relógio: o
 * aviso nasce da própria chamada. O banco confere de novo (com a linha travada)
 * e marca o "já avisado": duas chamadas ao mesmo tempo não avisam duas vezes.
 */
export function deveAvisarFora(estado: EstadoDaBusca, agora: string): boolean {
  if (estado.fora_desde === null || estado.avisado === true) return false
  const fora = Date.parse(agora) - Date.parse(estado.fora_desde)
  return Number.isFinite(fora) && fora >= AVISAR_FORA_APOS_MS
}
