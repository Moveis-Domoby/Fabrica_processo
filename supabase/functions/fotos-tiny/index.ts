// ============================================================================
// PLATAFORMA DE PRODUÇÃO DOMOBY · Edge Function `fotos-tiny` — D-82 (30/09)
//
// A foto do produto chega sozinha do Tiny. Quem chama é o RELÓGIO do banco
// (pg_cron `plt-fotos-tiny`, 5 em 5 min), e só quando há foto para copiar —
// sem foto nova, esta função nem acorda. A regra de "o que falta copiar" mora
// no banco (`plt_fn_fotos_tiny_pendentes`): tem foto no Tiny e (não tem foto
// aqui, ou a foto veio do Tiny e o Tiny trocou). Foto posta pela câmera nunca
// é trocada; foto apagada no Tiny fica a última (respostas do dono, 30/09).
//
//   POST (corpo qualquer) + cabeçalho X-Segredo (o segredo mora em
//   `plt_webhooks` e quem confere é o banco — `plt_fn_fotos_tiny_conferir`)
//   → { processados, resultado: [{ produto, gravou | erro, … }] }
//
// Por produto (até 3 por chamada — a redução gasta CPU, e o limite da função
// é de 2 s de CPU por chamada; a próxima volta do relógio pega o resto):
//   1. baixa o link do Tiny (só do armazém do Tiny: s3.amazonaws.com/tiny-anexos…);
//   2. reduz como a câmera do app faz (`src/lib/imagem.ts`): lado maior ≤ 1280
//      px, JPEG ~82, FUNDO BRANCO (recorte transparente não vira preto); se o
//      original já for JPEG pequeno e menor, fica o original. WebP (a
//      ImageScript não lê) sobe como veio — o formato é o dos BYTES, porque a
//      extensão do Tiny mente (A-38);
//   3. grava em `produtos/{pasta}/tiny-{md5 do Tiny}.{ext}` (o mesmo link dá
//      sempre o mesmo arquivo — repetir não duplica);
//   4. `plt_fn_foto_tiny_definir` confere de novo e grava; a cópia antiga do
//      Tiny sai da biblioteca; se não gravou (a câmera chegou antes), o arquivo
//      que subiu sai;
//   5. falhou → `plt_fn_foto_tiny_falhou` (histórico; o link espera 24 h).
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'
import { decode, Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts'

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!
const CHAVE_SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const BUCKET = 'plt-imagens'
const POR_CHAMADA = 3
const LADO_MAXIMO = 1280
const QUALIDADE_JPEG = 82
const TAMANHO_MAXIMO = 15 * 1024 * 1024
const TEMPO_DOWNLOAD_MS = 20_000
const ORIGEM_TINY = /^https:\/\/s3\.amazonaws\.com\/tiny-anexos[a-z0-9-]*\/[A-Za-z0-9/._-]+$/

const banco = createClient(URL_SUPABASE, CHAVE_SERVICO, { auth: { persistSession: false } })

type Formato = 'jpeg' | 'png' | 'webp' | 'gif'
const TIPO: Record<Formato, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}
const EXTENSAO: Record<Formato, string> = { jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif' }

interface Pendente {
  produto_tiny_id: number
  pasta: string
  url_tiny: string
}

interface Foto {
  dados: Uint8Array
  tipo: string
  extensao: string
  reduzida: boolean
}

/** O formato pelos primeiros bytes — nunca pela extensão do link. */
function formatoDe(b: Uint8Array): Formato | null {
  if (b.length < 12) return null
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif'
  return null
}

/** Reduz como a câmera do app (src/lib/imagem.ts): ≤ 1280 px, JPEG, fundo branco. */
async function preparar(bruto: Uint8Array): Promise<Foto> {
  const formato = formatoDe(bruto)
  if (!formato) throw new Error('o arquivo do Tiny não é uma imagem conhecida')
  const original: Foto = { dados: bruto, tipo: TIPO[formato], extensao: EXTENSAO[formato], reduzida: false }
  if (formato !== 'jpeg' && formato !== 'png') return original
  let imagem: Image
  try {
    const lida = await decode(bruto, true)
    if (!(lida instanceof Image)) return original
    imagem = lida
  } catch {
    return original
  }
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height))
  const largura = Math.max(1, Math.round(imagem.width * escala))
  const altura = Math.max(1, Math.round(imagem.height * escala))
  if (escala < 1) imagem.resize(largura, altura)
  const fundo = new Image(largura, altura).fill(0xffffffff)
  fundo.composite(imagem, 0, 0)
  const jpeg = await fundo.encodeJPEG(QUALIDADE_JPEG)
  // Igual ao app: o JPEG do Tiny que já é pequeno e menor fica como veio.
  if (formato === 'jpeg' && escala === 1 && bruto.length <= jpeg.length) return original
  return { dados: jpeg, tipo: 'image/jpeg', extensao: 'jpg', reduzida: true }
}

/** O nome do arquivo no Tiny é o md5 da imagem — vira o nome da cópia. */
async function identificador(url: string): Promise<string> {
  const achado = url.match(/\/([0-9a-f]{32})\.[A-Za-z0-9]+$/i)
  if (achado) return achado[1].toLowerCase()
  const resumo = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url))
  return Array.from(new Uint8Array(resumo)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

async function copiar(p: Pendente) {
  if (!ORIGEM_TINY.test(p.url_tiny)) throw new Error('o link não é do armazém do Tiny')
  const resposta = await fetch(p.url_tiny, { signal: AbortSignal.timeout(TEMPO_DOWNLOAD_MS) })
  if (!resposta.ok) throw new Error(`o Tiny respondeu ${resposta.status}`)
  const bruto = new Uint8Array(await resposta.arrayBuffer())
  if (bruto.length === 0) throw new Error('o Tiny mandou um arquivo vazio')
  if (bruto.length > TAMANHO_MAXIMO) throw new Error('a foto do Tiny passa de 15 MB')

  const foto = await preparar(bruto)
  const caminho = `${p.pasta}/tiny-${await identificador(p.url_tiny)}.${foto.extensao}`
  const envio = await banco.storage.from(BUCKET).upload(caminho, foto.dados, {
    contentType: foto.tipo,
    cacheControl: '3600',
    upsert: true,
  })
  if (envio.error) throw new Error(`não subiu para a biblioteca: ${envio.error.message}`)

  const { data, error } = await banco.rpc('plt_fn_foto_tiny_definir', {
    p_produto_tiny_id: p.produto_tiny_id,
    p_caminho: caminho,
    p_url_tiny: p.url_tiny,
  })
  if (error) throw new Error(`não gravou no produto: ${error.message}`)
  const r = data as { gravou: boolean; atual: string | null; anterior?: string | null }

  // Limpeza da biblioteca (melhor esforço — o produto já está certo).
  if (r.gravou && r.anterior && r.anterior !== caminho) {
    await banco.storage.from(BUCKET).remove([r.anterior])
  }
  if (!r.gravou && r.atual !== caminho) {
    await banco.storage.from(BUCKET).remove([caminho])
  }
  return {
    produto: p.produto_tiny_id,
    gravou: r.gravou,
    caminho,
    kb: Math.round(foto.dados.length / 1024),
    reduzida: foto.reduzida,
    tiraDaBiblioteca: r.gravou ? (r.anterior ?? null) : r.atual !== caminho ? caminho : null,
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Só POST.', { status: 405 })

  const segredo = req.headers.get('x-segredo') ?? ''
  const conferido = await banco.rpc('plt_fn_fotos_tiny_conferir', { p_segredo: segredo })
  if (conferido.error || conferido.data !== true) {
    return Response.json({ erro: 'não autorizado' }, { status: 401 })
  }

  const { data, error } = await banco.rpc('plt_fn_fotos_tiny_pendentes', { p_limite: POR_CHAMADA })
  if (error) return Response.json({ erro: `lista de pendentes: ${error.message}` }, { status: 500 })

  const resultado: unknown[] = []
  for (const p of (data ?? []) as Pendente[]) {
    try {
      resultado.push(await copiar(p))
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e)
      await banco.rpc('plt_fn_foto_tiny_falhou', {
        p_produto_tiny_id: p.produto_tiny_id,
        p_url_tiny: p.url_tiny,
        p_motivo: motivo,
      })
      resultado.push({ produto: p.produto_tiny_id, erro: motivo })
    }
  }
  return Response.json({ processados: resultado.length, resultado })
})
