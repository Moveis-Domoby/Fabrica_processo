// ============================================================================
// PLATAFORMA DE PRODUÇÃO DOMOBY · Edge Function `tiny-v3` — SESSAO-33 (D-142)
//
// A PONTE SEGURA para a API nova (v3) do Tiny, nas duas contas. Quem chama é
// o fluxo da fila no n8n ("subir banco de dados — tiny → supabase"), com a
// chave de serviço que ele já usa para falar com o banco.
//
//   POST { conta: 'loja' | 'fabrica', caminho: '/produtos', consulta: {...} }
//   → 200 { status, corpo, limite: { limite, restante, reinicio } }
//     (o status do Tiny vai DENTRO — o n8n não trata erro do Tiny como erro
//      da chamada; quem entende a resposta é o banco: fn_tiny_fila_resposta)
//
// Por que uma ponte: o token da API nova mora no banco (tiny_auth, uma linha
// por conta) e o n8n NUNCA o vê — nem no histórico das execuções (regra 4).
//   1. Quem chama se prova lendo o token pela porta que só a chave de serviço
//      abre (plt_fn_tiny_token_ler), COM A CHAVE DE QUEM CHAMOU — sem ela, 401.
//   2. Só LER (GET) e só os caminhos da lista abaixo.
//   3. O Tiny com tempo limite (30 s).
//   4. NUNCA renova o token: um 401 do Tiny volta como status 401 (A-18 — toda
//      função que renova ao receber 401 é renovador; o da loja é o
//      tiny-auth-refresh-cron e o da fábrica, o tiny-fabrica-token).
// Conta sem a API nova ligada → { status: 0, erro: 'sem_token' }.
//
// Publicar com verify_jwt DESLIGADO (a chave nova da Supabase não é JWT; quem
// confere a chave é o próprio banco, no passo 1).
// ============================================================================

const URL_SUPABASE = Deno.env.get('SUPABASE_URL') ?? ''
const BASE_TINY = 'https://api.tiny.com.br/public-api/v3'
const TEMPO_MS = 30_000

// só o que a fila lê (o resto da API nova fica fechado aqui)
const CAMINHOS =
  /^\/(produtos|depositos|ordem-compra|categorias-receita-despesa|formas-pagamento|formas-recebimento|marcas|contatos|pedidos|notas|contas-pagar|contas-receber|estoque|listas-precos|vendedores|info)(\/[0-9]+(\/(fabricado|kit|custos|itens))?)?$/

type Pedido = { conta?: unknown; caminho?: unknown; consulta?: Record<string, unknown> }

function resposta(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return resposta(405, { erro: 'Só POST.' })

  const chave = req.headers.get('apikey') ?? ''
  const autorizacao = req.headers.get('Authorization') ?? (chave ? `Bearer ${chave}` : '')
  if (!chave && !autorizacao) return resposta(401, { erro: 'sem chave' })

  let pedido: Pedido
  try {
    pedido = (await req.json()) as Pedido
  } catch {
    return resposta(400, { erro: 'Corpo inválido — mande JSON.' })
  }
  const conta = pedido.conta === 'fabrica' || pedido.conta === 'loja' ? pedido.conta : null
  const caminho = String(pedido.caminho ?? '')
  if (!conta) return resposta(400, { erro: 'conta: loja ou fabrica' })
  if (!CAMINHOS.test(caminho)) return resposta(400, { erro: 'caminho fora da lista da ponte' })

  // 1 · o token, com a chave de quem chamou (só a de serviço abre esta porta)
  const leitura = await fetch(`${URL_SUPABASE}/rest/v1/rpc/plt_fn_tiny_token_ler`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: chave || autorizacao.replace(/^Bearer\s+/i, ''),
      Authorization: autorizacao,
    },
    body: JSON.stringify({ p_conta: conta }),
  })
  if ([401, 403, 404].includes(leitura.status))
    return resposta(401, { erro: 'chave sem permissão' })
  if (!leitura.ok) return resposta(502, { erro: `o banco respondeu ${leitura.status}` })
  const token = (await leitura.json()) as string | null
  if (!token) return resposta(200, { status: 0, erro: 'sem_token' })

  // 2 · o Tiny, só leitura, com tempo limite
  const consulta = new URLSearchParams()
  for (const [nome, valor] of Object.entries(pedido.consulta ?? {})) {
    if (valor === null || valor === undefined) continue
    consulta.set(nome, String(valor))
  }
  const texto = consulta.toString()
  const url = `${BASE_TINY}${caminho}${texto ? `?${texto}` : ''}`
  const parar = new AbortController()
  const relogio = setTimeout(() => parar.abort(), TEMPO_MS)
  try {
    const tiny = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: parar.signal,
    })
    const bruto = await tiny.text()
    let corpo: unknown = bruto
    try {
      corpo = bruto ? JSON.parse(bruto) : null
    } catch {
      // o Tiny devolveu texto — vai como veio
    }
    return resposta(200, {
      status: tiny.status,
      corpo,
      limite: {
        limite: tiny.headers.get('x-ratelimit-limit'),
        restante: tiny.headers.get('x-ratelimit-remaining'),
        reinicio: tiny.headers.get('x-ratelimit-reset'),
      },
    })
  } catch (erro) {
    const esgotou = erro instanceof Error && erro.name === 'AbortError'
    return resposta(200, { status: 504, erro: esgotou ? 'tempo esgotado (30 s)' : String(erro) })
  } finally {
    clearTimeout(relogio)
  }
})
