import { chamarAutenticacao } from './api'

/**
 * SESSAO-41 (D-191) — "Esqueci minha senha": a troca é LIBERADA por um
 * administrador, sem e-mail. Este aparelho cria um segredo só dele ao pedir e
 * o guarda aqui; a liberação (2 h, uma troca) vale SÓ para o aparelho que tem
 * o segredo. As respostas do servidor nunca dizem se o e-mail tem cadastro.
 */
const CHAVE = 'domoby:pedido-senha'

interface PedidoGuardado {
  email: string
  segredo: string
  em: number
}

const normalizar = (email: string) => email.trim().toLowerCase()

function lerPedido(): PedidoGuardado | null {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return null
    const p = JSON.parse(bruto) as Partial<PedidoGuardado>
    return typeof p.email === 'string' && typeof p.segredo === 'string'
      ? { email: p.email, segredo: p.segredo, em: Number(p.em) || 0 }
      : null
  } catch {
    return null
  }
}

/** O e-mail do último pedido feito NESTE aparelho (para preencher o campo). */
export function emailDoPedidoGuardado(): string {
  return lerPedido()?.email ?? ''
}

/** O segredo deste aparelho para o e-mail (nulo = este aparelho não pediu). */
function segredoPara(email: string): string | null {
  const p = lerPedido()
  return p && p.email === normalizar(email) ? p.segredo : null
}

function novoSegredo(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function esquecerPedidoDeSenha() {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    // sem armazenamento: nada guardado
  }
}

/** Pede a troca: o segredo novo fica neste aparelho. Devolve a mensagem (sempre a mesma). */
export async function solicitarTrocaDeSenha(email: string): Promise<string> {
  const segredo = novoSegredo()
  const resposta = await chamarAutenticacao<{ ok: boolean; mensagem: string }>('senha-solicitar', {
    email: normalizar(email),
    segredo,
  })
  try {
    localStorage.setItem(
      CHAVE,
      JSON.stringify({ email: normalizar(email), segredo, em: Date.now() } satisfies PedidoGuardado),
    )
  } catch {
    // sem armazenamento (aba privada): a troca não vai poder ser feita aqui
  }
  return resposta.mensagem
}

/** A troca está liberada para este aparelho? (sem pedido aqui = não) */
export async function trocaLiberada(email: string): Promise<boolean> {
  const segredo = segredoPara(email)
  if (!segredo) return false
  const r = await chamarAutenticacao<{ situacao: string }>('senha-situacao', {
    email: normalizar(email),
    segredo,
  })
  return r.situacao === 'liberado'
}

/** Troca a senha com a liberação deste aparelho (uma vez). */
export async function trocarSenhaLiberada(email: string, senhaNova: string): Promise<void> {
  const segredo = segredoPara(email)
  if (!segredo) throw new Error('A troca não está liberada para este aparelho. Toque em "Solicitar troca".')
  await chamarAutenticacao<{ ok: boolean }>('senha-trocar', {
    email: normalizar(email),
    segredo,
    senha_nova: senhaNova,
  })
  esquecerPedidoDeSenha()
}
