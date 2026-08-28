// ============================================================================
// PLATAFORMA DE PRODUÇÃO DOMOBY · Edge Function `api` — SESSAO-11
//
// A API ABERTA (D-03/D-33): a porta de integrações da plataforma, autenticada
// por CHAVE própria (header `X-Chave-API`). O n8n — ou qualquer sistema — usa
// esta porta; ninguém de fora toca as tabelas direto.
//
//   GET    /api/setores                     · setores ativos
//   GET    /api/etapas?setor_id=N           · etapas de um setor
//   GET    /api/cards?setor_id=&tipo=&…     · cards (paginado; sem arquivados)
//   GET    /api/cards/:id                   · um card
//   GET    /api/cards/:id/eventos           · a história do card
//   POST   /api/cards                       · criar card (pedido ou unidade)
//   POST   /api/cards/:id/mover             · mover (SEM qualidade — RF-86)
//   DELETE /api/cards/:id                   · arquivar (exclusão lógica)
//
// Regras que NÃO vivem aqui: append-only, iniciar-antes-de-finalizar, limite
// por pessoa, DANIFICADO automático — tudo é TRIGGER no banco (M-14) e vale
// para esta porta igualzinho. Execução (iniciar/finalizar) NÃO é exposta:
// tempo de execução é gesto de pessoa (D-02), não de integração.
//
// A chave: valor `pltk_…` mostrado UMA vez no admin; aqui só o sha256 dela é
// comparado com plt_chaves_api. Escopo `leitura` só faz GET; `escrita` faz
// tudo. Chave inválida → 401 + log (critério da demanda).
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!
const CHAVE_SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chave-api',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

const servidor = createClient(URL_SUPABASE, CHAVE_SERVICO, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type Json = Record<string, unknown>

function resposta(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const erro = (status: number, mensagem: string) => resposta(status, { erro: mensagem })

async function sha256Hex(texto: string): Promise<string> {
  const dados = new TextEncoder().encode(texto)
  const hash = await crypto.subtle.digest('SHA-256', dados)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

interface Chave {
  id: number
  nome: string
  escopo: 'leitura' | 'escrita'
}

/** Confere a chave do header. Inválida/revogada → null (o chamador loga). */
async function autenticar(req: Request): Promise<Chave | null> {
  const valor = req.headers.get('x-chave-api') ?? ''
  if (!valor.startsWith('pltk_')) return null
  const hash = await sha256Hex(valor)
  const { data } = await servidor
    .from('plt_chaves_api')
    .select('id, nome, escopo')
    .eq('hash', hash)
    .is('revogada_em', null)
    .maybeSingle()
  if (!data) return null
  // fire-and-forget: o último uso é informação de gestão, não trava a chamada
  void servidor
    .from('plt_chaves_api')
    .update({ ultimo_uso_em: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})
  return data as Chave
}

/** Todo evento desta porta carrega quem foi ("via integração X"). */
function dadosDaIntegracao(chave: Chave, extra: Json = {}): Json {
  return { integracao: chave.nome, ...extra }
}

async function pedidoPorNumero(numero: number): Promise<{ id: number } | null> {
  const { data } = await servidor.from('pedidos').select('id').eq('numero', numero).maybeSingle()
  return (data as { id: number } | null) ?? null
}

// ----------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url = new URL(req.url)
  // O gateway entrega /api/<resto>; aceita também /functions/v1/api/<resto>.
  const partes = url.pathname.split('/').filter(Boolean)
  const posApi = partes.indexOf('api')
  const rota = posApi >= 0 ? partes.slice(posApi + 1) : partes

  const chave = await autenticar(req)
  if (!chave) {
    console.error(`api: chave inválida ou ausente — ${req.method} ${url.pathname}`)
    return erro(401, 'Chave de API inválida, revogada ou ausente (header X-Chave-API).')
  }
  if (req.method !== 'GET' && chave.escopo !== 'escrita') {
    console.error(`api: chave "${chave.nome}" (leitura) tentou ${req.method} ${url.pathname}`)
    return erro(403, 'Esta chave é só de leitura.')
  }

  let corpo: Json = {}
  if (req.method === 'POST') {
    try {
      corpo = (await req.json()) as Json
    } catch {
      return erro(400, 'Corpo inválido — mande JSON.')
    }
  }

  try {
    // ---------------- GET /setores ----------------
    if (req.method === 'GET' && rota[0] === 'setores') {
      const { data, error } = await servidor
        .from('plt_setores')
        .select('id, codigo, nome, papel_no_fluxo, ordem')
        .eq('ativo', true)
        .order('ordem')
      if (error) throw error
      return resposta(200, data)
    }

    // ---------------- GET /etapas?setor_id=N ----------------
    if (req.method === 'GET' && rota[0] === 'etapas') {
      const setorId = Number(url.searchParams.get('setor_id'))
      if (!Number.isFinite(setorId) || setorId <= 0) return erro(400, 'Informe setor_id.')
      const { data, error } = await servidor
        .from('plt_etapas')
        .select('id, setor_id, nome, ordem, eh_fila, eh_danificado')
        .eq('setor_id', setorId)
        .eq('ativa', true)
        .order('ordem')
      if (error) throw error
      return resposta(200, data)
    }

    // ---------------- /cards… ----------------
    if (rota[0] === 'cards') {
      const cardId = rota[1] ? Number(rota[1]) : null
      if (rota[1] && !Number.isFinite(cardId)) return erro(400, 'Id de card inválido.')

      // GET /cards (lista, paginada, sem arquivados)
      if (req.method === 'GET' && cardId === null) {
        const limite = Math.min(Math.max(Number(url.searchParams.get('limite')) || 20, 1), 100)
        const deslocamento = Math.max(Number(url.searchParams.get('deslocamento')) || 0, 0)
        let consulta = servidor
          .from('plt_cards')
          .select(
            'id, tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades, setor_atual_id, etapa_atual_id, desde, qualidade_atual, concluido_em',
          )
          .is('arquivado_em', null)
          .order('id', { ascending: false })
          .range(deslocamento, deslocamento + limite - 1)
        const setorId = Number(url.searchParams.get('setor_id'))
        if (Number.isFinite(setorId) && setorId > 0) consulta = consulta.eq('setor_atual_id', setorId)
        const tipo = url.searchParams.get('tipo')
        if (tipo === 'pedido' || tipo === 'unidade') consulta = consulta.eq('tipo', tipo)
        const { data, error } = await consulta
        if (error) throw error
        return resposta(200, data)
      }

      // GET /cards/:id e /cards/:id/eventos
      if (req.method === 'GET' && cardId !== null) {
        if (rota[2] === 'eventos') {
          const { data, error } = await servidor
            .from('plt_eventos')
            .select(
              'id, tipo, ocorrido_em, origem, usuario_id, setor_origem_id, setor_destino_id, etapa_origem_id, etapa_destino_id, estado_qualidade, observacao, dados',
            )
            .eq('card_id', cardId)
            .order('ocorrido_em')
          if (error) throw error
          return resposta(200, data)
        }
        const { data, error } = await servidor
          .from('plt_cards')
          .select('*')
          .eq('id', cardId)
          .maybeSingle()
        if (error) throw error
        if (!data) return erro(404, 'Card não encontrado.')
        return resposta(200, data)
      }

      // POST /cards — criar card de pedido ou de unidade
      if (req.method === 'POST' && cardId === null) {
        const numero = Number(corpo.pedido_numero)
        if (!Number.isFinite(numero)) return erro(400, 'Informe pedido_numero.')
        const pedido = await pedidoPorNumero(numero)
        if (!pedido) return erro(404, `Pedido ${numero} não existe no banco.`)

        const { data: pcp } = await servidor
          .from('plt_setores')
          .select('id')
          .eq('papel_no_fluxo', 'entrada')
          .eq('ativo', true)
          .limit(1)
          .maybeSingle()
        if (!pcp) return erro(500, 'Setor de entrada (PCP) não encontrado.')

        const tipo = corpo.tipo === 'unidade' ? 'unidade' : 'pedido'
        const linha: Json = { tipo, pedido_id: pedido.id, setor_atual_id: (pcp as Json).id }
        if (tipo === 'unidade') {
          linha.item_seq = corpo.item_seq ?? null
          linha.item_codigo = corpo.item_codigo ?? null
          linha.item_descricao = corpo.item_descricao ?? null
          linha.indice_unidade = corpo.indice_unidade ?? null
          linha.total_unidades = corpo.total_unidades ?? null
        }

        const { data: card, error } = await servidor
          .from('plt_cards')
          .insert(linha)
          .select('id')
          .single()
        if (error) {
          if (/plt_cards_pedido_unico/.test(error.message))
            return erro(409, `O pedido ${numero} já tem card de pedido.`)
          throw error
        }
        const { error: erroEvento } = await servidor.from('plt_eventos').insert({
          card_id: (card as Json).id,
          tipo: 'card_criado',
          origem: 'api',
          setor_destino_id: (pcp as Json).id,
          dados: dadosDaIntegracao(chave, { pedido_numero: numero }),
        })
        if (erroEvento) throw erroEvento
        return resposta(201, { card_id: (card as Json).id })
      }

      // POST /cards/:id/mover — origem 'api': SEM estado de qualidade (RF-86)
      if (req.method === 'POST' && cardId !== null && rota[2] === 'mover') {
        const { data: card } = await servidor
          .from('plt_cards')
          .select('id, setor_atual_id, etapa_atual_id, arquivado_em')
          .eq('id', cardId)
          .maybeSingle()
        if (!card) return erro(404, 'Card não encontrado.')
        if ((card as Json).arquivado_em) return erro(409, 'Card arquivado não se move.')

        let setorDestino = Number(corpo.setor_id)
        if (!Number.isFinite(setorDestino) && typeof corpo.setor_codigo === 'string') {
          const { data: s } = await servidor
            .from('plt_setores')
            .select('id')
            .eq('codigo', corpo.setor_codigo)
            .maybeSingle()
          setorDestino = s ? Number((s as Json).id) : NaN
        }
        if (!Number.isFinite(setorDestino)) return erro(400, 'Informe setor_id ou setor_codigo.')
        const etapaDestino = Number(corpo.etapa_id) || null

        const mesmoSetor = Number((card as Json).setor_atual_id) === setorDestino
        const { data: evento, error } = await servidor
          .from('plt_eventos')
          .insert({
            card_id: cardId,
            tipo: mesmoSetor ? 'movimentacao_etapa' : 'movimentacao_setor',
            origem: 'api',
            usuario_id: null, // a API não tem pessoa; qualidade não se exige (RF-86)
            setor_origem_id: (card as Json).setor_atual_id,
            etapa_origem_id: (card as Json).etapa_atual_id,
            setor_destino_id: setorDestino,
            etapa_destino_id: etapaDestino,
            dados: dadosDaIntegracao(chave),
          })
          .select('id')
          .single()
        if (error) return erro(422, `O banco recusou o movimento: ${error.message}`)
        return resposta(200, { evento_id: (evento as Json).id })
      }

      // DELETE /cards/:id — arquivamento lógico (nada se apaga)
      if (req.method === 'DELETE' && cardId !== null) {
        const { data: card } = await servidor
          .from('plt_cards')
          .select('id, arquivado_em')
          .eq('id', cardId)
          .maybeSingle()
        if (!card) return erro(404, 'Card não encontrado.')
        if ((card as Json).arquivado_em) return resposta(200, { ja_arquivado: true })
        const { error } = await servidor.from('plt_eventos').insert({
          card_id: cardId,
          tipo: 'card_arquivado',
          origem: 'api',
          dados: dadosDaIntegracao(chave),
        })
        if (error) return erro(422, `O banco recusou o arquivamento: ${error.message}`)
        return resposta(200, { arquivado: true })
      }
    }

    return erro(404, 'Rota desconhecida. Veja docs/api.md no repositório.')
  } catch (excecao) {
    console.error('api: erro inesperado', excecao)
    return erro(500, 'Erro inesperado. Tente de novo.')
  }
})
