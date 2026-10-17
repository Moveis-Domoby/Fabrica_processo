// ============================================================================
// PLATAFORMA DE PRODUÇÃO DOMOBY · Edge Function `tiny-fabrica-token` — SESSAO-33
//
// O RENOVADOR da API nova do Tiny na conta da FÁBRICA — o ÚNICO dela (D-142:
// "um renovador por credencial, sempre"; E-07, A-18). O da loja é outro (o
// tiny-auth-refresh-cron, linha 1 da tiny_auth) e nunca toca a linha da
// fábrica (linha 2), nem esta toca a dele.
//
//   POST { acao: 'iniciar', volta }  — do site, com o login do dono
//        → { url } — o endereço de autorização do Tiny (o navegador vai lá)
//   GET  ?code=…&state=…             — o Tiny devolve o navegador aqui
//        → troca o código pelos tokens, grava a linha 2, agenda o relógio
//          dela e manda o navegador de volta ao site (?tiny_fabrica=ligada)
//   POST { acao: 'renovar' }         — o relógio tiny-fabrica-token-cron (3 h)
//        → { renovou } — pega a vez no banco: no máximo 1 vez a cada 2 h
//
// Segredos (postos pelo dono no painel da Supabase — regra 4, nunca no chat):
//   TINY_FABRICA_CLIENT_ID e TINY_FABRICA_CLIENT_SECRET (do aplicativo criado
//   na conta da fábrica do Tiny). A "URL de redirecionamento" do aplicativo é
//   o endereço desta função: https://<projeto>.supabase.co/functions/v1/tiny-fabrica-token
// O "state" vai assinado (HMAC com o segredo do aplicativo) e vale 15 min: só
// uma autorização começada pelo dono, no site, é aceita na volta.
// Nunca escreve token em log nem em resposta.
//
// Publicar com verify_jwt DESLIGADO (a volta do Tiny e o relógio não trazem o
// login; o "iniciar" confere o login do dono pelo próprio banco).
// ============================================================================

const URL_SUPABASE = Deno.env.get('SUPABASE_URL') ?? ''
const CHAVE_SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CHAVE_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const CLIENTE_ID = Deno.env.get('TINY_FABRICA_CLIENT_ID') ?? ''
const CLIENTE_SEGREDO = Deno.env.get('TINY_FABRICA_CLIENT_SECRET') ?? ''

const ENDERECO_DESTA = `${URL_SUPABASE}/functions/v1/tiny-fabrica-token`
const AUTORIZAR = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth'
const TOKEN = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token'
const VALIDADE_STATE_MS = 15 * 60 * 1000
const TEMPO_MS = 20_000

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// ----------------------------------------------------------------------------
// o "state" assinado: base64url(dados) + '.' + base64url(HMAC-SHA256)
// ----------------------------------------------------------------------------
const paraB64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
const deB64Url = (texto: string) =>
  Uint8Array.from(atob(texto.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function chaveHmac(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(CLIENTE_SEGREDO),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

type DadosState = { t: number; n: string; v: string }

async function assinar(dados: DadosState): Promise<string> {
  const corpo = new TextEncoder().encode(JSON.stringify(dados))
  const assinatura = new Uint8Array(await crypto.subtle.sign('HMAC', await chaveHmac(), corpo))
  return `${paraB64Url(corpo)}.${paraB64Url(assinatura)}`
}

async function conferirState(state: string): Promise<DadosState | null> {
  const [corpo, assinatura] = state.split('.')
  if (!corpo || !assinatura) return null
  try {
    const bytes = deB64Url(corpo)
    const valido = await crypto.subtle.verify(
      'HMAC',
      await chaveHmac(),
      deB64Url(assinatura),
      bytes,
    )
    if (!valido) return null
    const dados = JSON.parse(new TextDecoder().decode(bytes)) as DadosState
    if (typeof dados.t !== 'number' || Date.now() - dados.t > VALIDADE_STATE_MS) return null
    return dados
  } catch {
    return null
  }
}

// ----------------------------------------------------------------------------
// o banco (só a chave de serviço grava e reserva)
// ----------------------------------------------------------------------------
async function rpc(nome: string, corpo: Record<string, unknown>): Promise<unknown> {
  const r = await fetch(`${URL_SUPABASE}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: CHAVE_SERVICO,
      Authorization: `Bearer ${CHAVE_SERVICO}`,
    },
    body: JSON.stringify(corpo),
  })
  if (!r.ok) throw new Error(`o banco respondeu ${r.status} em ${nome}`)
  const texto = await r.text()
  return texto ? JSON.parse(texto) : null
}

// o Tiny (o servidor de login dele) com tempo limite
async function pedirTokens(
  campos: Record<string, string>,
): Promise<{ ok: boolean; status: number; dados: Record<string, unknown> | null; texto: string }> {
  const parar = new AbortController()
  const relogio = setTimeout(() => parar.abort(), TEMPO_MS)
  try {
    const r = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(campos).toString(),
      signal: parar.signal,
    })
    const texto = await r.text()
    let dados: Record<string, unknown> | null = null
    try {
      dados = texto ? (JSON.parse(texto) as Record<string, unknown>) : null
    } catch {
      dados = null
    }
    return { ok: r.ok, status: r.status, dados, texto: texto.slice(0, 300) }
  } finally {
    clearTimeout(relogio)
  }
}

// a volta para o site (ou uma página simples, se o site não disse para onde)
function voltar(destino: string, resultado: 'ligada' | 'erro', motivo = ''): Response {
  if (/^https:\/\/[^\s]+$/.test(destino)) {
    const alvo = new URL(destino)
    alvo.searchParams.set('tiny_fabrica', resultado)
    if (motivo) alvo.searchParams.set('motivo', motivo)
    return new Response(null, { status: 302, headers: { Location: alvo.toString() } })
  }
  const texto =
    resultado === 'ligada'
      ? 'A API nova da fábrica está ligada. Pode fechar esta janela.'
      : `Não deu para ligar a API nova da fábrica (${motivo || 'erro'}). Volte à plataforma e tente de novo.`
  return new Response(
    `<!doctype html><meta charset="utf-8"><p style="font-family:sans-serif">${texto}</p>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    },
  )
}

// ----------------------------------------------------------------------------
// iniciar — o dono, logado no site, pede o endereço de autorização
// ----------------------------------------------------------------------------
async function iniciar(req: Request, corpo: Record<string, unknown>): Promise<Response> {
  if (!CLIENTE_ID || !CLIENTE_SEGREDO) {
    return json(500, {
      erro: 'Faltam os segredos do aplicativo do Tiny da fábrica no painel da Supabase.',
    })
  }
  // o login do dono, conferido pelo banco (só o super admin passa)
  const conferir = await fetch(
    `${URL_SUPABASE}/rest/v1/rpc/plt_fn_tiny_fabrica_autorizar_preparar`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: CHAVE_ANON,
        Authorization: req.headers.get('Authorization') ?? '',
      },
      body: '{}',
    },
  )
  if (!conferir.ok) return json(403, { erro: 'Só o dono liga a API nova do Tiny.' })

  const volta =
    typeof corpo.volta === 'string' && /^https:\/\/[^\s]+$/.test(corpo.volta) ? corpo.volta : ''
  const state = await assinar({ t: Date.now(), n: crypto.randomUUID(), v: volta })
  const url = `${AUTORIZAR}?${new URLSearchParams({
    client_id: CLIENTE_ID,
    redirect_uri: ENDERECO_DESTA,
    scope: 'openid',
    response_type: 'code',
    state,
  }).toString()}`
  return json(200, { url })
}

// ----------------------------------------------------------------------------
// a volta do Tiny — troca o código pelos tokens
// ----------------------------------------------------------------------------
async function aVolta(url: URL): Promise<Response> {
  const dados = await conferirState(url.searchParams.get('state') ?? '')
  const destino = dados?.v ?? ''
  if (!dados) return voltar(destino, 'erro', 'autorizacao_vencida')
  if (url.searchParams.get('error')) return voltar(destino, 'erro', 'recusada_no_tiny')
  const codigo = url.searchParams.get('code') ?? ''
  if (!codigo) return voltar(destino, 'erro', 'sem_codigo')

  // o navegador do dono está esperando: qualquer falha daqui em diante volta
  // para o site com o motivo (nunca uma página de erro crua)
  let troca: Awaited<ReturnType<typeof pedirTokens>>
  try {
    troca = await pedirTokens({
      grant_type: 'authorization_code',
      client_id: CLIENTE_ID,
      client_secret: CLIENTE_SEGREDO,
      redirect_uri: ENDERECO_DESTA,
      code: codigo,
    })
  } catch {
    return voltar(destino, 'erro', 'tiny_nao_respondeu')
  }
  const acesso = String(troca.dados?.access_token ?? '')
  const renovacao = String(troca.dados?.refresh_token ?? '')
  if (!troca.ok || !acesso || !renovacao) {
    await rpc('plt_fn_tiny_fabrica_falha', {
      p_erro: `autorização: ${troca.status} ${troca.texto}`,
    }).catch(() => {})
    return voltar(destino, 'erro', 'tiny_recusou')
  }
  try {
    await rpc('plt_fn_tiny_fabrica_token_gravar', {
      p_access: acesso,
      p_refresh: renovacao,
      p_origem: 'autorizacao',
      p_renovador_url: ENDERECO_DESTA,
    })
  } catch {
    return voltar(destino, 'erro', 'nao_gravou')
  }
  return voltar(destino, 'ligada')
}

// ----------------------------------------------------------------------------
// renovar — o relógio da fábrica (3 em 3 h); o banco dá a vez no máximo 1×/2 h
// ----------------------------------------------------------------------------
async function renovar(): Promise<Response> {
  if (!CLIENTE_ID || !CLIENTE_SEGREDO) return json(500, { erro: 'sem os segredos do aplicativo' })
  const atual = (await rpc('plt_fn_tiny_fabrica_renovacao_reservar', {})) as string | null
  if (!atual) return json(200, { renovou: false, motivo: 'ainda_valido_ou_nao_ligada' })

  const r = await pedirTokens({
    grant_type: 'refresh_token',
    client_id: CLIENTE_ID,
    client_secret: CLIENTE_SEGREDO,
    refresh_token: atual,
  })
  const acesso = String(r.dados?.access_token ?? '')
  if (!r.ok || !acesso) {
    await rpc('plt_fn_tiny_fabrica_falha', {
      p_erro: `${r.status} ${String(r.dados?.error ?? '')} ${r.texto}`,
    }).catch(() => {})
    return json(200, { renovou: false, status: r.status })
  }
  // o Tiny gira o token de renovação a cada uso: grava SEMPRE o que veio
  await rpc('plt_fn_tiny_fabrica_token_gravar', {
    p_access: acesso,
    p_refresh: String(r.dados?.refresh_token ?? atual),
    p_origem: 'renovacao',
    p_renovador_url: ENDERECO_DESTA,
  })
  return json(200, { renovou: true })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    if (req.method === 'GET') return await aVolta(new URL(req.url))
    if (req.method !== 'POST') return json(405, { erro: 'Só GET (volta do Tiny) e POST.' })
    let corpo: Record<string, unknown> = {}
    try {
      corpo = (await req.json()) as Record<string, unknown>
    } catch {
      corpo = {}
    }
    if (corpo.acao === 'iniciar') return await iniciar(req, corpo)
    if (corpo.acao === 'renovar') return await renovar()
    return json(400, { erro: 'Ação desconhecida.' })
  } catch (erro) {
    console.error(
      'tiny-fabrica-token: erro inesperado',
      erro instanceof Error ? erro.message : 'erro',
    )
    return json(500, { erro: 'Erro inesperado. Tente de novo.' })
  }
})
