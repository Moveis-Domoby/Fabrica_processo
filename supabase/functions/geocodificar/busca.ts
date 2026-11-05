// ============================================================================
// PLATAFORMA DE PRODUÇÃO DOMOBY · a regra da busca de endereço — SESSAO-45
//
// Lógica PURA (sem rede, sem Deno): partir o endereço, gerar as consultas e,
// sobretudo, ESCOLHER o candidato certo entre os que o buscador devolve. Mora
// num arquivo próprio para o Vitest testar (src/rotas/buscaEndereco.test.ts)
// e a Edge Function só cuidar da rede e do cache.
//
// Por que existe (o raio-x de 04/11/2026): o buscador gratuito devolve a rua
// pelo NOME, e Natal tem dezenas de ruas com o mesmo nome em bairros diferentes
// ("Rua São João" em Lagoa Seca, Planalto, Pajuçara, Felipe Camarão…). A versão
// antiga pegava o 1º resultado (limit=1) e só conferia a cidade — e a cidade
// era lida na posição errada quando o endereço vinha sem bairro. Resultado: 29
// de 151 pontos a mais de 1 km do lugar, alguns a 12 km, e endereços reais
// "não encontrados" (o de São José de Mipibu: o mapa chama aquela parte da
// cidade de "Taborda"). Agora:
//   - o endereço é partido de trás para a frente (Brasil, CEP, UF, cidade) —
//     o que falta não desloca o resto;
//   - abreviações viram a palavra inteira (Av → Avenida, Des → Desembargador);
//   - vários candidatos por consulta, e cada um é PONTUADO: o nome da rua
//     (precisa bater), o BAIRRO (bairro, localidade ou "cidade" do mapa), o CEP
//     (exato ou a mesma faixa) e a cidade;
//   - sem prova do lugar (nem bairro, nem CEP, nem cidade) não serve;
//   - rua com o mesmo nome em lugares distantes e nada que desempate = AMBÍGUO:
//     a busca diz "não achei" e a pessoa marca o ponto no mapa (nunca um ponto
//     errado com cara de certo).
//
// ↪️ Ajuste do dono (05/11 — "não pode acontecer o caso de endereço não
// encontrado"): a rua que não se acha não vira mais "não achei" (o Google Maps
// vai sempre pelo endereço escrito; o ponto é só o do nosso mapa).
// ↪️ Correção do dono (05/11, manhã — "não tem essa de bairro e centro da
// cidade, NO MÁXIMO a rua é aceitável, mas deve ter um aviso na tela"): o ponto
// é de RUA ou é o da CIDADE com aviso — nunca o centro do bairro:
//   1) a rua (os candidatos do buscador);
//   2) o ponto do CEP e o centro do bairro só como ÂNCORA: entre as ruas de
//      mesmo nome, a que fica perto dele é a certa (vira ponto de rua); o ponto
//      do CEP da PRÓPRIA rua do pedido também é ponto de rua (fonte 'cep');
//   3) senão, o centro da cidade (fonte 'aprox_cidade') — e o cartão avisa
//      "Endereço aproximado para a cidade da entrega, ajustar o pino do mapa".
// ============================================================================

export interface EnderecoPartido {
  /** O texto inteiro, como chegou. */
  texto: string
  /** Endereço digitado à mão (parada avulsa, busca na janela do mapa): sem estrutura. */
  livre: boolean
  rua: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  /** Só os 8 dígitos. */
  cep: string | null
}

export interface Candidato {
  lat: number
  lon: number
  /** 'house' (casa/lugar com número) ou 'street' (a rua). */
  tipo: 'house' | 'street' | 'outro'
  /** Nome da rua (ou do lugar, quando é um ponto com nome). */
  rua: string | null
  /** Nome do lugar (POI) quando há. */
  nome: string | null
  numero: string | null
  /** Bairro, localidade, distrito — tudo o que diz "onde" abaixo da cidade. */
  lugares: string[]
  /** Cidade, município, condado. */
  cidades: string[]
  estado: string | null
  cep: string | null
  fonte: 'nominatim' | 'photon'
}

export interface Escolha {
  ponto: { lat: number; lon: number } | null
  /** Por que não escolheu (para o registro da função, sem o endereço). */
  motivo: 'ok' | 'sem_candidato' | 'nome_nao_bate' | 'fora_do_lugar' | 'ambiguo'
}

// ---------------------------------------------------------------------------
// Texto comparável
// ---------------------------------------------------------------------------

const ABREVIACOES: Record<string, string> = {
  av: 'avenida', ave: 'avenida', avn: 'avenida',
  r: 'rua',
  tv: 'travessa', trav: 'travessa', tr: 'travessa',
  al: 'alameda',
  rod: 'rodovia',
  estr: 'estrada', est: 'estrada',
  pc: 'praca', pca: 'praca', pç: 'praca', pça: 'praca',
  cond: 'condominio',
  conj: 'conjunto', cj: 'conjunto', cjto: 'conjunto',
  res: 'residencial', resid: 'residencial',
  lot: 'loteamento',
  jd: 'jardim', jdm: 'jardim',
  pq: 'parque', pque: 'parque',
  dr: 'doutor', dra: 'doutora',
  des: 'desembargador', desemb: 'desembargador',
  pres: 'presidente', pr: 'presidente',
  gov: 'governador',
  sen: 'senador',
  dep: 'deputado',
  ver: 'vereador', vere: 'vereador',
  prof: 'professor', profa: 'professora', profª: 'professora',
  eng: 'engenheiro',
  cel: 'coronel',
  gen: 'general',
  ten: 'tenente',
  cap: 'capitao',
  mal: 'marechal',
  alm: 'almirante',
  sgt: 'sargento',
  mons: 'monsenhor',
  pe: 'padre',
  fr: 'frei',
  sta: 'santa',
  sto: 'santo',
  s: 'sao',
  sr: 'senhor',
  sra: 'senhora',
  n: 'nossa',
  ns: 'nossa',
  nsa: 'nossa',
  dom: 'dom',
}

/** Palavras que não distinguem uma rua de outra. */
const VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'd', 'a', 'o', 'na', 'no'])

/** O tipo do logradouro — conta para desempatar, não para o nome. */
const TIPOS = new Set([
  'rua', 'avenida', 'travessa', 'alameda', 'rodovia', 'estrada', 'praca', 'beco', 'largo',
  'via', 'viela', 'passagem', 'ladeira', 'acesso', 'vila', 'caminho',
])

/**
 * Títulos de gente no nome da rua — o cadastro e o mapa trocam com frequência
 * ("Vereador Augusto de Souza" × "Governador Augusto de Souza", "Tamandaré" ×
 * "Almirante Tamandaré"). Diferença só no título não faz ser outra rua.
 */
const TITULOS = new Set([
  'vereador', 'governador', 'doutor', 'doutora', 'presidente', 'senador', 'deputado', 'prefeito',
  'professor', 'professora', 'engenheiro', 'coronel', 'general', 'tenente', 'capitao', 'marechal',
  'almirante', 'sargento', 'major', 'cabo', 'monsenhor', 'padre', 'frei', 'dom', 'desembargador',
  'ministro', 'comendador', 'madre', 'irma', 'maestro', 'poeta', 'jornalista',
])

/** Palavras genéricas de bairro/loteamento — não provam o lugar sozinhas. */
const GENERICAS_LUGAR = new Set(['residencial', 'conjunto', 'loteamento', 'condominio', 'bairro', 'setor', 'comunidade', 'urbana'])

export function semAcento(t: string): string {
  return [...t.normalize('NFD')]
    .filter((c) => c.charCodeAt(0) < 0x300 || c.charCodeAt(0) > 0x36f)
    .join('')
    .toLowerCase()
    .trim()
}

/** As palavras do texto, sem acento, com as abreviações por extenso e sem as vazias. */
export function palavras(texto: string | null | undefined): string[] {
  if (!texto) return []
  return semAcento(texto)
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/[^a-z0-9ºª]+/g, ' ')
    .replace(/[ºª]/g, '')
    .split(' ')
    .filter(Boolean)
    .map((p) => ABREVIACOES[p] ?? p)
    .filter((p) => !VAZIAS.has(p))
}

/** Distância de edição limitada (só precisa saber se é 0, 1 ou "mais"). */
function quaseIgual(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length < 5 || b.length < 5) return false
  if (Math.abs(a.length - b.length) > 1) return false
  // uma troca, uma letra a mais ou a menos
  let i = 0
  let j = 0
  let erros = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    erros++
    if (erros > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return erros + (a.length - i) + (b.length - j) <= 1
}

function contem(lista: string[], palavra: string): boolean {
  return lista.some((p) => quaseIgual(p, palavra))
}

/** O nome da rua sem o tipo (Rua/Avenida…) e o tipo, separados. */
export function nomeDaRua(rua: string | null | undefined): { tipo: string | null; nome: string[] } {
  const ps = palavras(rua)
  // números ordinais na frente ("1ª Travessa") ficam no nome — distinguem a travessa
  const tipo = ps.find((p) => TIPOS.has(p)) ?? null
  const nome = ps.filter((p) => !TIPOS.has(p))
  return { tipo, nome }
}

/**
 * Quanto o nome do candidato bate com o pedido (0 a 1). Igual (com tolerância
 * de uma letra por palavra comprida) = 1; um contido no outro, com 2+ palavras
 * e o mesmo tipo = 0,8; o resto pela proporção de palavras em comum.
 */
export function semelhancaNome(pedido: string | null, candidato: string | null): number {
  const a = nomeDaRua(pedido)
  const b = nomeDaRua(candidato)
  if (a.nome.length === 0 || b.nome.length === 0) return 0
  const comuns = a.nome.filter((p) => contem(b.nome, p)).length
  const comunsB = b.nome.filter((p) => contem(a.nome, p)).length
  if (comuns === a.nome.length && comunsB === b.nome.length) return 1
  const mesmoTipo = !a.tipo || !b.tipo || a.tipo === b.tipo
  if (mesmoTipo && Math.min(a.nome.length, b.nome.length) >= 2) {
    if (comuns === a.nome.length || comunsB === b.nome.length) return 0.8
  }
  const proporcao = Math.min(comuns, comunsB) / Math.max(a.nome.length, b.nome.length)
  if (proporcao >= 0.75) return proporcao
  // sem os títulos, o mesmo nome (2+ palavras, ou uma comprida) = a mesma rua
  const na = a.nome.filter((p) => !TITULOS.has(p))
  const nb = b.nome.filter((p) => !TITULOS.has(p))
  const forte = (ps: string[]) => ps.length >= 2 || (ps.length === 1 && ps[0].length >= 7)
  if (forte(na) && forte(nb) && na.every((p) => contem(nb, p)) && nb.every((p) => contem(na, p))) return 0.8
  return proporcao
}

/** O lugar pedido (bairro) aparece no lugar do candidato (bairro, localidade, distrito…)? */
export function lugarBate(pedido: string | null, lugaresDoCandidato: string[]): boolean {
  const alvo = palavras(pedido).filter((p) => !GENERICAS_LUGAR.has(p))
  if (alvo.length === 0) return false
  return lugaresDoCandidato.some((l) => {
    const ps = palavras(l).filter((p) => !GENERICAS_LUGAR.has(p))
    if (ps.length === 0) return false
    const todasNoCandidato = alvo.every((p) => contem(ps, p))
    const todasNoPedido = ps.every((p) => contem(alvo, p))
    return todasNoCandidato || todasNoPedido
  })
}

const ESTADOS: Record<string, string> = {
  AC: 'acre', AL: 'alagoas', AP: 'amapa', AM: 'amazonas', BA: 'bahia', CE: 'ceara',
  DF: 'distrito federal', ES: 'espirito santo', GO: 'goias', MA: 'maranhao', MT: 'mato grosso',
  MS: 'mato grosso do sul', MG: 'minas gerais', PA: 'para', PB: 'paraiba', PR: 'parana',
  PE: 'pernambuco', PI: 'piaui', RJ: 'rio de janeiro', RN: 'rio grande do norte',
  RS: 'rio grande do sul', RO: 'rondonia', RR: 'roraima', SC: 'santa catarina', SP: 'sao paulo',
  SE: 'sergipe', TO: 'tocantins',
}

/** O nome do estado de uma UF ("RN" → "Rio Grande do Norte"), para o buscador. */
export function nomeDoEstado(uf: string | null): string | null {
  if (!uf) return null
  const n = ESTADOS[uf.toUpperCase()]
  return n ? n.replace(/\b\w/g, (l) => l.toUpperCase()) : null
}

/** A caixa (oeste, sul, leste, norte) do estado — limita o buscador. Só o RN (onde a fábrica entrega). */
export function caixaDoEstado(uf: string | null): string | null {
  if (uf && uf.toUpperCase() === 'RN') return '-38.6,-6.99,-34.9,-4.83'
  return null
}

function estadoBate(uf: string | null, estado: string | null): boolean | null {
  if (!uf || !estado) return null
  const esperado = ESTADOS[uf.toUpperCase()]
  if (!esperado) return null
  const e = semAcento(estado)
  return e === esperado || e === uf.toLowerCase()
}

const soDigitos = (t: string | null | undefined) => (t ?? '').replace(/\D/g, '')

// ---------------------------------------------------------------------------
// Partir o endereço
// ---------------------------------------------------------------------------

const RE_CEP = /^\d{2}\.?\d{3}[-.\s]?\d{3}$/
const RE_UF = /^[A-Za-z]{2}$/

/**
 * O endereço que o banco monta (fn_endereco_geocodificavel): "rua número,
 * bairro, cidade, UF, CEP, Brasil" — o que falta simplesmente não vem. Lido
 * de trás para a frente para o que falta não deslocar o resto. Sem o
 * "Brasil" no fim = digitado à mão (livre).
 */
export function partirEndereco(endereco: string): EnderecoPartido {
  const texto = endereco.trim()
  const partes = texto.split(',').map((p) => p.trim()).filter(Boolean)
  const vazio: EnderecoPartido = { texto, livre: true, rua: null, numero: null, bairro: null, cidade: null, uf: null, cep: null }
  if (partes.length < 2 || semAcento(partes[partes.length - 1]) !== 'brasil') return vazio
  partes.pop()
  let cep: string | null = null
  let uf: string | null = null
  if (partes.length > 1 && RE_CEP.test(partes[partes.length - 1])) cep = soDigitos(partes.pop())
  if (partes.length > 1 && RE_UF.test(partes[partes.length - 1])) uf = partes.pop()!.toUpperCase()
  const cidade = partes.length > 1 ? partes.pop()! : null
  const primeira = partes.shift() ?? null
  const bairro = partes.length > 0 ? partes.join(', ') : null
  let rua = primeira
  let numero: string | null = null
  const m = primeira?.match(/^(.*?)[\s,]+(\d+[\s-]?[A-Za-z]?|s\/?n)$/i)
  if (m && m[1].trim().length >= 3) {
    rua = m[1].trim()
    numero = m[2].trim()
  }
  return { texto, livre: false, rua, numero, bairro, cidade, uf, cep }
}

/** A rua com as abreviações do começo por extenso ("Av Machado" → "Avenida Machado"). */
function ruaPorExtenso(rua: string): string {
  return rua.replace(/^([A-Za-zÀ-ú]{1,5})\.?\s+/, (inteiro, abrev: string) => {
    const cheia = ABREVIACOES[semAcento(abrev)]
    return cheia && TIPOS.has(cheia) ? `${cheia.charAt(0).toUpperCase()}${cheia.slice(1)} ` : inteiro
  })
}

/** As consultas ao buscador de texto (Photon), da mais certeira à mais solta. */
export function consultasTexto(e: EnderecoPartido): string[] {
  if (e.livre || !e.rua) return [e.texto]
  const rua = ruaPorExtenso(e.rua)
  const lista = [
    [`${rua}${e.numero ? ` ${e.numero}` : ''}`, e.cidade].filter(Boolean).join(', '),
    e.bairro ? [rua, e.bairro, e.cidade].filter(Boolean).join(', ') : null,
    e.bairro && e.cidade ? [rua, e.bairro].join(', ') : null,
  ]
  return [...new Set(lista.filter((x): x is string => !!x))]
}

// ---------------------------------------------------------------------------
// Escolher o candidato
// ---------------------------------------------------------------------------

/** Distância em metros (plana — basta para "perto ou longe" dentro de uma cidade). */
export function metros(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r)
  const y = (b.lat - a.lat) * r
  return Math.sqrt(x * x + y * y) * 6_371_000
}

/** Segmentos da mesma rua ficam juntos; mais longe que isto é outra rua com o mesmo nome. */
const MESMA_RUA_M = 1500

interface Avaliado {
  c: Candidato
  nome: number
  pontos: number
  bairro: boolean
  cepExato: boolean
}

/**
 * Escolhe o ponto do endereço entre os candidatos — ou diz por que não dá.
 * Endereço livre (digitado): o 1º candidato do buscador (a pessoa confere o
 * pino na tela).
 */
export function escolher(e: EnderecoPartido, candidatos: Candidato[]): Escolha {
  if (candidatos.length === 0) return { ponto: null, motivo: 'sem_candidato' }
  if (e.livre) {
    const c = candidatos[0]
    return { ponto: { lat: c.lat, lon: c.lon }, motivo: 'ok' }
  }

  const avaliados: Avaliado[] = []
  let algumNome = false
  for (const c of candidatos) {
    const nome = Math.max(semelhancaNome(e.rua, c.rua), c.nome ? semelhancaNome(e.rua, c.nome) : 0)
    if (nome < 0.75) continue
    algumNome = true
    if (estadoBate(e.uf, c.estado) === false) continue
    const bairro = lugarBate(e.bairro, [...c.lugares, ...c.cidades])
    const cidade = e.cidade ? lugarBate(e.cidade, c.cidades) || lugarBate(e.cidade, c.lugares) : false
    const cepC = soDigitos(c.cep)
    const cepExato = !!e.cep && cepC.length === 8 && cepC === e.cep && !e.cep.endsWith('000')
    const cepFaixa = !!e.cep && cepC.length === 8 && cepC.slice(0, 5) === e.cep.slice(0, 5)
    // sem prova do LUGAR o candidato não serve (rua de mesmo nome noutra cidade)
    if (!bairro && !cidade && !cepExato && !cepFaixa) continue
    const tipoPedido = nomeDaRua(e.rua).tipo
    const tipoC = nomeDaRua(c.rua ?? c.nome).tipo
    const casa = c.tipo === 'house' && !!e.numero && !!c.numero
      && soDigitos(c.numero) === soDigitos(e.numero) && semelhancaNome(e.rua, c.rua) >= 0.75
    const pontos = nome * 2
      + (tipoPedido && tipoC && tipoPedido === tipoC ? 0.5 : 0)
      + (bairro ? 3 : 0)
      + (cepExato ? 3 : cepFaixa ? 1 : 0)
      + (cidade ? 1 : 0)
      + (casa ? 2 : 0)
    avaliados.push({ c, nome, pontos, bairro, cepExato })
  }
  if (avaliados.length === 0) return { ponto: null, motivo: algumNome ? 'fora_do_lugar' : 'nome_nao_bate' }

  avaliados.sort((a, b) => b.pontos - a.pontos)
  const melhor = avaliados[0]
  // Só a cidade prova o lugar: rua de mesmo nome espalhada pela cidade e nada
  // que desempate = ambíguo (melhor "não achei" do que um ponto errado).
  if (!melhor.bairro && !melhor.cepExato) {
    const longe = avaliados.some((x) => metros(x.c, melhor.c) > MESMA_RUA_M)
    if (longe && e.bairro) return { ponto: null, motivo: 'ambiguo' }
    if (longe && !e.bairro) {
      // sem bairro no pedido: só serve se o melhor ganhar com folga (CEP da faixa ou casa)
      const segundo = avaliados.find((x) => metros(x.c, melhor.c) > MESMA_RUA_M)
      if (!segundo || melhor.pontos - segundo.pontos < 1) return { ponto: null, motivo: 'ambiguo' }
    }
  }
  return { ponto: { lat: melhor.c.lat, lon: melhor.c.lon }, motivo: 'ok' }
}

// ---------------------------------------------------------------------------
// Os degraus (ajuste do dono, 05/11): o CEP, o bairro, a cidade
// ---------------------------------------------------------------------------

/** Um ponto de referência que prova o lugar e desempata ruas de mesmo nome. */
export interface Ancora {
  lat: number
  lon: number
  degrau: 'cep' | 'bairro'
}

/** Até onde, da âncora, uma rua com o nome do pedido ainda é a do pedido. */
const RAIO_ANCORA_M: Record<Ancora['degrau'], number> = { cep: 1500, bairro: 2000 }

/**
 * A rua perto da âncora: entre os candidatos com o nome da rua (no estado
 * certo), o que fica dentro do raio do ponto do CEP / do centro do bairro — a
 * casa com o mesmo número primeiro, depois o nome mais parecido, depois o mais
 * perto. Nada dentro do raio = null (fica o ponto da âncora).
 */
export function escolherPerto(
  e: EnderecoPartido,
  candidatos: Candidato[],
  ancora: Ancora,
): { lat: number; lon: number; fonte: Candidato['fonte'] } | null {
  if (e.livre || !e.rua) return null
  const raio = RAIO_ANCORA_M[ancora.degrau]
  let melhor: { c: Candidato; nota: number; dist: number } | null = null
  for (const c of candidatos) {
    const nome = Math.max(semelhancaNome(e.rua, c.rua), c.nome ? semelhancaNome(e.rua, c.nome) : 0)
    if (nome < 0.75) continue
    if (estadoBate(e.uf, c.estado) === false) continue
    const dist = metros(c, ancora)
    if (dist > raio) continue
    const casa = c.tipo === 'house' && !!e.numero && !!c.numero && soDigitos(c.numero) === soDigitos(e.numero)
    const nota = nome + (casa ? 1 : 0)
    if (!melhor || nota > melhor.nota || (nota === melhor.nota && dist < melhor.dist)) melhor = { c, nota, dist }
  }
  return melhor ? { lat: melhor.c.lat, lon: melhor.c.lon, fonte: melhor.c.fonte } : null
}

export interface PontoDoCep {
  lat: number
  lon: number
  /** CEP geral da cidade (termina em 000): o ponto é o centro da cidade. */
  geral: boolean
  /** O CEP é da PRÓPRIA rua do pedido: o ponto dele está na rua (vale como ponto de rua). */
  ruaBate: boolean
}

/**
 * O ponto do CEP (a resposta do serviço de CEP: lat/lng, cidade, UF, rua,
 * bairro). Só vale na cidade e na UF do pedido e dentro do Brasil; e o CEP
 * de uma rua só vale se a rua ou o bairro dele baterem com o pedido (o CEP
 * digitado errado não leva o ponto para outro canto da cidade).
 */
export function pontoDoCep(e: EnderecoPartido, corpo: unknown): PontoDoCep | null {
  const j = (corpo ?? {}) as Record<string, unknown>
  const texto = (k: string) => (typeof j[k] === 'string' && (j[k] as string).trim() ? (j[k] as string) : null)
  const lat = Number(j.lat)
  const lon = Number(j.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0 || lon === 0) return null
  if (lat > 6 || lat < -34 || lon > -28 || lon < -74) return null
  const cidade = texto('city')
  if (e.cidade && !(cidade && lugarBate(e.cidade, [cidade]) && lugarBate(cidade, [e.cidade]))) return null
  const uf = texto('state')
  if (e.uf && uf && uf.toUpperCase() !== e.uf.toUpperCase()) return null
  const geral = soDigitos(texto('cep') ?? e.cep).endsWith('000')
  const ruaBate = !geral && semelhancaNome(e.rua, texto('address') ?? texto('address_name')) >= 0.75
  if (!geral && !ruaBate) {
    const bairro = texto('district')
    const bairroBate = !e.bairro || (bairro !== null && lugarBate(e.bairro, [bairro]))
    if (!bairroBate) return null
  }
  return { lat, lon, geral, ruaBate }
}

/** A consulta do centro do bairro ("Rocas, Natal") — só ÂNCORA para achar a rua; null sem bairro ou sem cidade. */
export function consultaBairro(e: EnderecoPartido): string | null {
  if (e.livre || !e.bairro || !e.cidade) return null
  return `${e.bairro}, ${e.cidade}`
}

/** A consulta do centro da cidade ("Natal, Rio Grande do Norte"). */
export function consultaCidade(e: EnderecoPartido): string | null {
  if (e.livre || !e.cidade) return null
  return [e.cidade, nomeDoEstado(e.uf) ?? e.uf].filter(Boolean).join(', ')
}

/** As palavras que distinguem um lugar (sem as genéricas: residencial, conjunto…). */
function palavrasDoLugar(t: string | null | undefined): string[] {
  return palavras(t).filter((p) => !GENERICAS_LUGAR.has(p))
}

/** O mesmo nome de lugar, palavra por palavra (sem as genéricas) — nos dois sentidos. */
function mesmoLugar(a: string | null, b: string | null): boolean {
  const pa = palavrasDoLugar(a)
  const pb = palavrasDoLugar(b)
  return pa.length > 0 && pb.length > 0 && pa.every((p) => contem(pb, p)) && pb.every((p) => contem(pa, p))
}

/** O nome pedido inteiro dentro do nome do lugar ("Pium" em "Pium de Nísia"). */
function nomeDentro(pedido: string | null, lugarDoMapa: string | null): boolean {
  const pa = palavrasDoLugar(pedido)
  const pb = palavrasDoLugar(lugarDoMapa)
  return pa.length > 0 && pb.length > 0 && pa.every((p) => contem(pb, p))
}

/**
 * O centro do bairro ou da cidade entre os candidatos do buscador (as camadas
 * de lugar, não de rua): o NOME do lugar precisa ser o do pedido; o bairro,
 * dentro da cidade do pedido; o estado, nunca outro. O bairro com o nome
 * igual ganha; senão, o que tem o nome do pedido dentro do dele ("Pium" →
 * "Pium de Nísia") — e que o mapa não diga ficar noutro bairro (o condomínio
 * "Atol das Rocas" fica em Lagoa Nova, não nas Rocas). A cidade, só com o nome
 * igual.
 */
export function escolherLugar(
  e: EnderecoPartido,
  candidatos: Candidato[],
  degrau: 'bairro' | 'cidade',
): { lat: number; lon: number } | null {
  const validos = candidatos.filter((c) => {
    if (estadoBate(e.uf, c.estado) === false) return false
    if (degrau === 'cidade') return true
    return !e.cidade || lugarBate(e.cidade, [...c.cidades, ...c.lugares])
  })
  const alvo = degrau === 'bairro' ? e.bairro : e.cidade
  const igual = validos.find((c) => mesmoLugar(alvo, c.nome))
  const dentro =
    degrau === 'bairro'
      ? validos.find(
          (c) => nomeDentro(alvo, c.nome) && (c.lugares.length === 0 || c.lugares.some((l) => nomeDentro(alvo, l))),
        )
      : undefined
  const c = igual ?? dentro
  return c ? { lat: c.lat, lon: c.lon } : null
}

// ---------------------------------------------------------------------------
// Ler as respostas dos buscadores
// ---------------------------------------------------------------------------

type Props = Record<string, string | undefined>

/** Os candidatos de uma resposta do Photon (GeoJSON). */
export function candidatosPhoton(corpo: unknown): Candidato[] {
  const features = (corpo as { features?: { geometry?: { coordinates?: number[] }; properties?: Props }[] })?.features ?? []
  const lista: Candidato[] = []
  for (const f of features) {
    const [lon, lat] = f.geometry?.coordinates ?? []
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const p = f.properties ?? {}
    if (p.countrycode && p.countrycode !== 'BR') continue
    const tipo = p.type === 'house' ? 'house' : p.type === 'street' ? 'street' : 'outro'
    lista.push({
      lat,
      lon,
      tipo,
      rua: p.street ?? (tipo === 'street' ? (p.name ?? null) : null),
      nome: p.name ?? null,
      numero: p.housenumber ?? null,
      lugares: [p.district, p.locality, p.suburb, p.neighbourhood].filter((x): x is string => !!x),
      cidades: [p.city, p.county, p.municipality, p.town, p.village].filter((x): x is string => !!x),
      estado: p.state ?? null,
      cep: p.postcode ?? null,
      fonte: 'photon',
    })
  }
  return lista
}

/** Os candidatos de uma resposta do Nominatim (jsonv2 com addressdetails). */
export function candidatosNominatim(corpo: unknown): Candidato[] {
  const lista: Candidato[] = []
  for (const x of (Array.isArray(corpo) ? corpo : []) as { lat?: string; lon?: string; category?: string; addresstype?: string; name?: string; address?: Props }[]) {
    const lat = Number(x.lat)
    const lon = Number(x.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const a = x.address ?? {}
    const tipo = a.house_number ? 'house' : x.category === 'highway' ? 'street' : 'outro'
    lista.push({
      lat,
      lon,
      tipo,
      rua: a.road ?? (x.category === 'highway' ? (x.name ?? null) : null),
      nome: x.name ?? null,
      numero: a.house_number ?? null,
      lugares: [a.suburb, a.neighbourhood, a.residential, a.quarter, a.city_district, a.hamlet].filter((v): v is string => !!v),
      cidades: [a.city, a.town, a.village, a.municipality, a.county].filter((v): v is string => !!v),
      estado: a.state ?? null,
      cep: a.postcode ?? null,
      fonte: 'nominatim',
    })
  }
  return lista
}

/** Junta candidatos repetidos (a mesma rua por duas consultas). */
export function semRepetidos(lista: Candidato[]): Candidato[] {
  const vistos = new Set<string>()
  return lista.filter((c) => {
    const k = `${c.lat.toFixed(5)},${c.lon.toFixed(5)},${semAcento(c.rua ?? c.nome ?? '')}`
    if (vistos.has(k)) return false
    vistos.add(k)
    return true
  })
}
