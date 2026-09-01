// ============================================================================
// PLATAFORMA DE PRODUÇÃO DOMOBY · Edge Function `autenticacao` — SESSAO-03
//
// A ÚNICA porta do servidor para tudo que mexe com identidade (D-21):
//
//   entrar           → login com nome de usuário OU e-mail + senha
//   criar-usuario    → admin/líder cadastra alguém (senha padrão + convite)
//   convite-info     → resolve o token do link de convite (nome + usuário)
//   trocar-senha     → troca obrigatória da senha padrão no primeiro login
//   atualizar-perfil → (SESSAO-13) a própria pessoa troca nome, login, e-mail, fone
//   alterar-senha    → (SESSAO-13) troca de senha do Meu Perfil, com a senha atual
//   pin-definir      → admin/líder define o PIN de tablet de alguém
//   pin-verificar    → o tablet identifica o operador pela matrícula/usuário + PIN
//
// Por que Edge Function e não RPC em `public`: função em `public` vira
// endpoint sem ninguém pedir (E-11), e resolver "usuário → e-mail" no
// navegador vazaria e-mails. Aqui o navegador nunca vê nada além do resultado.
//
// A senha padrão NÃO está neste arquivo (regra crítica 4): vive no segredo de
// ambiente PLT_SENHA_PADRAO, definido no painel do Supabase pelo dono.
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!
const CHAVE_SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CHAVE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Cliente com a chave de serviço: ignora RLS. Só existe DENTRO desta função.
const servidor = createClient(URL_SUPABASE, CHAVE_SERVICO, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type Json = Record<string, unknown>

function resposta(status: number, corpo: Json): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function erro(status: number, mensagem: string): Response {
  return resposta(status, { erro: mensagem })
}

// ----------------------------------------------------------------------------
// PIN: PBKDF2-SHA256 com sal por pessoa. Formato: pbkdf2$iterações$sal$hash
// (WebCrypto puro — nada de dependência extra no runtime do Edge.)
// ----------------------------------------------------------------------------
const PIN_ITERACOES = 100_000

async function derivarPin(pin: string, sal: Uint8Array, iteracoes: number): Promise<Uint8Array> {
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: sal.buffer as ArrayBuffer, iterations: iteracoes, hash: 'SHA-256' },
    chave,
    256,
  )
  return new Uint8Array(bits)
}

const paraB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))
const deB64 = (t: string) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0))

async function gerarHashPin(pin: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivarPin(pin, sal, PIN_ITERACOES)
  return `pbkdf2$${PIN_ITERACOES}$${paraB64(sal)}$${paraB64(hash)}`
}

async function conferirPin(pin: string, guardado: string): Promise<boolean> {
  const partes = guardado.split('$')
  if (partes.length !== 4 || partes[0] !== 'pbkdf2') return false
  const esperado = deB64(partes[3])
  const obtido = await derivarPin(pin, deB64(partes[2]), Number(partes[1]))
  if (esperado.length !== obtido.length) return false
  let diferenca = 0
  for (let i = 0; i < esperado.length; i += 1) diferenca |= esperado[i] ^ obtido[i]
  return diferenca === 0
}

// ----------------------------------------------------------------------------
// Quem está chamando? Traduz o JWT do Authorization para a pessoa da
// plataforma. Devolve null para token inválido, conta sem vínculo ou inativa —
// é assim que "conta sem aprovação não acessa nada" vale também aqui.
// ----------------------------------------------------------------------------
type Pessoa = {
  id: string
  auth_user_id: string
  nome: string
  papel: 'operador' | 'lider' | 'admin'
  ativo: boolean
  senha_padrao: boolean
}

async function pessoaDoToken(req: Request): Promise<Pessoa | null> {
  const cabecalho = req.headers.get('Authorization') ?? ''
  const token = cabecalho.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await servidor.auth.getUser(token)
  if (error || !data.user) return null
  const { data: linha } = await servidor
    .from('plt_usuarios')
    .select('id, auth_user_id, nome, papel, ativo, senha_padrao')
    .eq('auth_user_id', data.user.id)
    .eq('ativo', true)
    .maybeSingle()
  return (linha as Pessoa | null) ?? null
}

async function setoresLiderados(pessoaId: string): Promise<number[]> {
  const { data } = await servidor
    .from('plt_usuario_setores')
    .select('setor_id')
    .eq('usuario_id', pessoaId)
    .eq('lider_do_setor', true)
  return (data ?? []).map((l) => Number(l.setor_id))
}

// ----------------------------------------------------------------------------
// entrar — nome de usuário OU e-mail + senha (D-21)
// Erro sempre genérico: não confirmamos se o usuário existe.
// ----------------------------------------------------------------------------
async function entrar(corpo: Json): Promise<Response> {
  const identificador = String(corpo.identificador ?? '').trim().toLowerCase()
  const senha = String(corpo.senha ?? '')
  if (!identificador || !senha) return erro(400, 'Informe usuário (ou e-mail) e senha.')

  const NEGADO = 'Usuário ou senha incorretos.'

  const coluna = identificador.includes('@') ? 'email' : 'usuario'
  const { data: linha } = await servidor
    .from('plt_usuarios')
    .select('id, email, ativo')
    .eq(coluna, identificador)
    .maybeSingle()

  // Sem cadastro na plataforma (ou desativado) não existe login — mesmo que
  // alguém tenha criado uma conta de auth por fora, ela não entra.
  if (!linha || !linha.ativo) return erro(401, NEGADO)

  const tentativa = await fetch(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: CHAVE_ANON },
    body: JSON.stringify({ email: linha.email, password: senha }),
  })
  if (!tentativa.ok) return erro(401, NEGADO)
  const sessao = await tentativa.json()

  // Toda atividade gera registro (SESSAO-13): o login entra na trilha.
  await servidor
    .from('plt_logs_atividade')
    .insert({ usuario_id: linha.id, acao: 'entrou' })
    .then(() => {})

  return resposta(200, { access_token: sessao.access_token, refresh_token: sessao.refresh_token })
}

// ----------------------------------------------------------------------------
// atualizar-perfil — o Meu Perfil (SESSAO-13): a própria pessoa troca nome,
// nome de usuário (o de login, que é também o exibido), e-mail e telefone.
// Usuário/e-mail passam por aqui porque mexem também na conta de auth.
// ----------------------------------------------------------------------------
async function atualizarPerfil(req: Request, corpo: Json): Promise<Response> {
  const quem = await pessoaDoToken(req)
  if (!quem) return erro(401, 'Sessão inválida. Entre de novo.')

  const nome = String(corpo.nome ?? '').trim()
  const usuario = String(corpo.usuario ?? '').trim().toLowerCase()
  const email = String(corpo.email ?? '').trim().toLowerCase()
  const telefone = String(corpo.telefone ?? '').trim() || null

  if (!nome) return erro(400, 'Informe o nome.')
  if (!/^[a-z0-9._-]{3,32}$/.test(usuario))
    return erro(400, 'Nome de usuário: 3 a 32 caracteres, só letras minúsculas, números, ponto, hífen ou underline.')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return erro(400, 'Informe um e-mail válido.')

  const { data: atual } = await servidor
    .from('plt_usuarios')
    .select('email')
    .eq('id', quem.id)
    .single()
  const emailMudou = atual !== null && atual.email !== email

  // O e-mail também é o login da conta de auth: muda lá primeiro. Confirmado
  // direto — o convite continua sendo por WhatsApp, sem e-mail automático.
  if (emailMudou) {
    const alterada = await servidor.auth.admin.updateUserById(quem.auth_user_id, {
      email,
      email_confirm: true,
    })
    if (alterada.error) {
      const ja = /already|registered|exists/i.test(alterada.error.message)
      return erro(ja ? 409 : 500, ja ? 'Este e-mail já tem conta.' : 'Não consegui trocar o e-mail. Tente de novo.')
    }
  }

  const { error: erroGravar } = await servidor
    .from('plt_usuarios')
    .update({ nome, usuario, email, telefone })
    .eq('id', quem.id)

  if (erroGravar) {
    // Desfaz a troca de e-mail no auth para não deixar as duas pontas tortas.
    if (emailMudou && atual) {
      await servidor.auth.admin.updateUserById(quem.auth_user_id, {
        email: atual.email,
        email_confirm: true,
      })
    }
    const m = erroGravar.message
    if (/usuario_uq/.test(m)) return erro(409, 'Este nome de usuário já existe.')
    if (/email_uq/.test(m)) return erro(409, 'Este e-mail já está cadastrado.')
    return erro(500, 'Não consegui gravar as alterações. Tente de novo.')
  }

  return resposta(200, { ok: true })
}

// ----------------------------------------------------------------------------
// alterar-senha — a troca do Meu Perfil: exige a senha ATUAL (diferente da
// troca obrigatória do 1º login). A conferência é um login de verdade.
// ----------------------------------------------------------------------------
async function alterarSenha(req: Request, corpo: Json): Promise<Response> {
  const quem = await pessoaDoToken(req)
  if (!quem) return erro(401, 'Sessão inválida. Entre de novo.')

  const senhaAtual = String(corpo.senha_atual ?? '')
  const senhaNova = String(corpo.senha_nova ?? '')
  if (!senhaAtual) return erro(400, 'Informe a senha atual.')
  if (senhaNova.length < 8) return erro(400, 'A senha nova precisa de pelo menos 8 caracteres.')
  const senhaPadrao = Deno.env.get('PLT_SENHA_PADRAO')
  if (senhaPadrao && senhaNova === senhaPadrao)
    return erro(400, 'A senha nova não pode ser a senha padrão.')

  const { data: linha } = await servidor
    .from('plt_usuarios')
    .select('email')
    .eq('id', quem.id)
    .single()
  if (!linha) return erro(401, 'Sessão inválida. Entre de novo.')

  const conferencia = await fetch(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: CHAVE_ANON },
    body: JSON.stringify({ email: linha.email, password: senhaAtual }),
  })
  if (!conferencia.ok) return erro(401, 'A senha atual não confere.')

  const alterada = await servidor.auth.admin.updateUserById(quem.auth_user_id, {
    password: senhaNova,
  })
  if (alterada.error) return erro(500, 'Não consegui trocar a senha. Tente de novo.')

  // A senha em si nunca vai para log — só o fato de ter sido trocada.
  await servidor
    .from('plt_logs_atividade')
    .insert({ usuario_id: quem.id, acao: 'senha_alterada' })
    .then(() => {})

  return resposta(200, { ok: true })
}

// ----------------------------------------------------------------------------
// criar-usuario — só admin/líder. Nasce com a senha padrão (segredo de
// ambiente), matrícula gerada pelo banco e token de convite para o WhatsApp.
// Líder só cadastra OPERADOR, e só nos setores em que é líder.
// ----------------------------------------------------------------------------
async function criarUsuario(req: Request, corpo: Json): Promise<Response> {
  const quem = await pessoaDoToken(req)
  if (!quem) return erro(401, 'Sessão inválida. Entre de novo.')
  if (quem.papel !== 'admin' && quem.papel !== 'lider')
    return erro(403, 'Só admin ou líder pode cadastrar usuários.')

  const senhaPadrao = Deno.env.get('PLT_SENHA_PADRAO')
  if (!senhaPadrao)
    return erro(500, 'Segredo PLT_SENHA_PADRAO não configurado no painel do Supabase.')

  const nome = String(corpo.nome ?? '').trim()
  const email = String(corpo.email ?? '').trim().toLowerCase()
  const usuario = String(corpo.usuario ?? '').trim().toLowerCase()
  const cpf = String(corpo.cpf ?? '').replace(/\D/g, '')
  const telefone = String(corpo.telefone ?? '').trim() || null
  const papel = String(corpo.papel ?? 'operador')
  const pin = String(corpo.pin ?? '')
  const setores = Array.isArray(corpo.setores)
    ? (corpo.setores as { setor_id: number; lider?: boolean }[])
    : []

  if (!nome) return erro(400, 'Informe o nome.')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return erro(400, 'Informe um e-mail válido.')
  if (!/^[a-z0-9._-]{3,32}$/.test(usuario))
    return erro(400, 'Nome de usuário: 3 a 32 caracteres, só letras minúsculas, números, ponto, hífen ou underline.')
  if (!/^[0-9]{11}$/.test(cpf)) return erro(400, 'Informe o CPF completo (11 dígitos) — a matrícula depende dele.')
  if (!['operador', 'lider', 'admin'].includes(papel)) return erro(400, 'Papel inválido.')
  if (pin && !/^[0-9]{4,6}$/.test(pin)) return erro(400, 'PIN: 4 a 6 dígitos.')
  if (setores.length === 0) return erro(400, 'Vincule a pessoa a pelo menos um setor.')

  if (quem.papel === 'lider') {
    if (papel !== 'operador') return erro(403, 'Líder só cadastra operador. Papéis maiores, só o admin.')
    if (setores.some((s) => s.lider)) return erro(403, 'Só o admin define quem é líder de setor.')
    const meus = await setoresLiderados(quem.id)
    if (setores.some((s) => !meus.includes(Number(s.setor_id))))
      return erro(403, 'Líder só cadastra gente nos setores em que é líder.')
  }

  // 1 · conta de auth com a senha padrão, e-mail já confirmado (convite é por
  //     WhatsApp — nenhum e-mail automático é enviado)
  const criada = await servidor.auth.admin.createUser({
    email,
    password: senhaPadrao,
    email_confirm: true,
  })
  if (criada.error) {
    const ja = /already|registered|exists/i.test(criada.error.message)
    return erro(ja ? 409 : 500, ja ? 'Este e-mail já tem conta.' : 'Não consegui criar a conta. Tente de novo.')
  }
  const authId = criada.data.user.id

  // 2 · a pessoa na plataforma (a matrícula nasce no banco, pela trigger)
  const { data: pessoa, error: erroPessoa } = await servidor
    .from('plt_usuarios')
    .insert({
      auth_user_id: authId,
      nome,
      email,
      usuario,
      cpf,
      telefone,
      papel,
      pin_hash: pin ? await gerarHashPin(pin) : null,
    })
    .select('id, matricula, convite_token')
    .single()

  if (erroPessoa || !pessoa) {
    await servidor.auth.admin.deleteUser(authId) // desfaz a conta órfã
    const m = erroPessoa?.message ?? ''
    if (/usuario_uq/.test(m)) return erro(409, 'Este nome de usuário já existe.')
    if (/cpf_uq/.test(m)) return erro(409, 'Este CPF já está cadastrado.')
    if (/email_uq/.test(m)) return erro(409, 'Este e-mail já está cadastrado.')
    return erro(500, 'Não consegui gravar o cadastro. Tente de novo.')
  }

  // 3 · vínculos com os setores
  const { error: erroVinculo } = await servidor.from('plt_usuario_setores').insert(
    setores.map((s) => ({
      usuario_id: pessoa.id,
      setor_id: Number(s.setor_id),
      lider_do_setor: quem.papel === 'admin' ? Boolean(s.lider) : false,
    })),
  )
  if (erroVinculo) {
    await servidor.from('plt_usuarios').delete().eq('id', pessoa.id)
    await servidor.auth.admin.deleteUser(authId)
    return erro(500, 'Não consegui vincular aos setores. Nada foi gravado — tente de novo.')
  }

  return resposta(201, {
    id: pessoa.id,
    matricula: pessoa.matricula,
    convite_token: pessoa.convite_token,
  })
}

// ----------------------------------------------------------------------------
// convite-info — o link do WhatsApp abre a tela de boas-vindas com o nome e o
// usuário preenchidos. Token usado ou inexistente não revela nada.
// ----------------------------------------------------------------------------
async function conviteInfo(corpo: Json): Promise<Response> {
  const token = String(corpo.token ?? '').trim()
  if (!/^[0-9a-f-]{36}$/.test(token)) return erro(404, 'Convite não encontrado.')
  const { data } = await servidor
    .from('plt_usuarios')
    .select('nome, usuario, convite_usado_em, ativo')
    .eq('convite_token', token)
    .maybeSingle()
  if (!data || !data.ativo) return erro(404, 'Convite não encontrado.')
  return resposta(200, {
    nome: data.nome,
    usuario: data.usuario,
    usado: data.convite_usado_em !== null,
  })
}

// ----------------------------------------------------------------------------
// trocar-senha — o passo obrigatório do primeiro acesso (D-21).
// Marca senha_padrao = false e fecha o convite.
// ----------------------------------------------------------------------------
async function trocarSenha(req: Request, corpo: Json): Promise<Response> {
  const quem = await pessoaDoToken(req)
  if (!quem) return erro(401, 'Sessão inválida. Entre de novo.')

  const nova = String(corpo.senha_nova ?? '')
  if (nova.length < 8) return erro(400, 'A senha nova precisa de pelo menos 8 caracteres.')
  const senhaPadrao = Deno.env.get('PLT_SENHA_PADRAO')
  if (senhaPadrao && nova === senhaPadrao)
    return erro(400, 'A senha nova não pode ser a senha padrão.')

  const alterada = await servidor.auth.admin.updateUserById(quem.auth_user_id, { password: nova })
  if (alterada.error) return erro(500, 'Não consegui trocar a senha. Tente de novo.')

  await servidor
    .from('plt_usuarios')
    .update({ senha_padrao: false, convite_usado_em: new Date().toISOString() })
    .eq('id', quem.id)

  return resposta(200, { ok: true })
}

// ----------------------------------------------------------------------------
// pin-definir — admin define para qualquer um; líder, para gente dos setores
// em que é líder. O PIN nunca é guardado em claro.
// ----------------------------------------------------------------------------
async function pinDefinir(req: Request, corpo: Json): Promise<Response> {
  const quem = await pessoaDoToken(req)
  if (!quem) return erro(401, 'Sessão inválida. Entre de novo.')
  if (quem.papel !== 'admin' && quem.papel !== 'lider')
    return erro(403, 'Só admin ou líder define PIN.')

  const usuarioId = String(corpo.usuario_id ?? '')
  const pin = String(corpo.pin ?? '')
  if (!usuarioId) return erro(400, 'Informe de quem é o PIN.')
  if (!/^[0-9]{4,6}$/.test(pin)) return erro(400, 'PIN: 4 a 6 dígitos.')

  if (quem.papel === 'lider') {
    const meus = await setoresLiderados(quem.id)
    const { data: doAlvo } = await servidor
      .from('plt_usuario_setores')
      .select('setor_id')
      .eq('usuario_id', usuarioId)
    const alcancavel = (doAlvo ?? []).some((v) => meus.includes(Number(v.setor_id)))
    if (!alcancavel) return erro(403, 'Líder só define PIN de gente dos setores em que é líder.')
  }

  const { error: erroPin } = await servidor
    .from('plt_usuarios')
    .update({ pin_hash: await gerarHashPin(pin) })
    .eq('id', usuarioId)
  if (erroPin) return erro(500, 'Não consegui gravar o PIN. Tente de novo.')
  return resposta(200, { ok: true })
}

// ----------------------------------------------------------------------------
// pin-verificar — o gesto do tablet compartilhado (D-06 / RF-25): a sessão do
// dispositivo pergunta "quem é você?" e a resposta certa identifica o
// OPERADOR para carimbar a ação. Erro genérico, sem revelar quem existe.
// ----------------------------------------------------------------------------
async function pinVerificar(req: Request, corpo: Json): Promise<Response> {
  const quem = await pessoaDoToken(req)
  if (!quem) return erro(401, 'Sessão inválida. Entre de novo.')

  const identificador = String(corpo.identificador ?? '').trim().toLowerCase()
  const pin = String(corpo.pin ?? '')
  if (!identificador || !pin) return erro(400, 'Informe matrícula (ou usuário) e PIN.')

  const NEGADO = 'Matrícula/usuário ou PIN incorretos.'
  const coluna = /^mdm-/.test(identificador) ? 'matricula' : 'usuario'
  const { data: alvo } = await servidor
    .from('plt_usuarios')
    .select('id, nome, matricula, papel, pin_hash, ativo')
    .eq(coluna, coluna === 'matricula' ? identificador.toUpperCase() : identificador)
    .maybeSingle()

  if (!alvo || !alvo.ativo || !alvo.pin_hash) return erro(401, NEGADO)
  if (!(await conferirPin(pin, alvo.pin_hash))) return erro(401, NEGADO)

  return resposta(200, {
    usuario_id: alvo.id,
    nome: alvo.nome,
    matricula: alvo.matricula,
    papel: alvo.papel,
  })
}

// ----------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return erro(405, 'Só POST.')

  let corpo: Json
  try {
    corpo = await req.json()
  } catch {
    return erro(400, 'Corpo inválido — mande JSON.')
  }

  try {
    switch (corpo.acao) {
      case 'entrar':
        return await entrar(corpo)
      case 'criar-usuario':
        return await criarUsuario(req, corpo)
      case 'convite-info':
        return await conviteInfo(corpo)
      case 'trocar-senha':
        return await trocarSenha(req, corpo)
      case 'atualizar-perfil':
        return await atualizarPerfil(req, corpo)
      case 'alterar-senha':
        return await alterarSenha(req, corpo)
      case 'pin-definir':
        return await pinDefinir(req, corpo)
      case 'pin-verificar':
        return await pinVerificar(req, corpo)
      default:
        return erro(400, 'Ação desconhecida.')
    }
  } catch (excecao) {
    console.error('autenticacao: erro inesperado', excecao)
    return erro(500, 'Erro inesperado. Tente de novo.')
  }
})
