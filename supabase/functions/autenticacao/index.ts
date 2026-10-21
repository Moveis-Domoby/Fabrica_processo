// ============================================================================
// PLATAFORMA DE PRODUÇÃO DOMOBY · Edge Function `autenticacao` — SESSAO-03
//
// A ÚNICA porta do servidor para tudo que mexe com identidade (D-21):
//
//   entrar           → login com nome de usuário OU e-mail + senha
//   criar-usuario    → admin/líder cadastra alguém (senha padrão + convite)
//   editar-usuario   → (SESSAO-37) o admin edita o cadastro de alguém: dados,
//                      nível e setores (a caneta da Equipe)
//   convite-info     → resolve o token do link de convite (nome + usuário)
//   trocar-senha     → troca obrigatória da senha padrão no primeiro login
//   atualizar-perfil → (SESSAO-13) a própria pessoa troca nome, login, e-mail, fone
//   alterar-senha    → (SESSAO-13) troca de senha do Meu Perfil, com a senha atual
//   pin-definir      → admin/líder define o PIN de tablet de alguém (único — SESSAO-36)
//   pin-verificar    → o tablet identifica o operador pela matrícula/usuário + PIN
//   pin-identificar  → (SESSAO-36) identifica a pessoa SÓ pelo PIN (sem clicar no nome)
//   tablet-entrar    → (SESSAO-36) a tela de login no modo tablet: o PIN do SETOR
//                      abre a sessão da conta de tablet daquele setor
//   setor-pin-definir→ (SESSAO-36) o admin dá/troca o PIN de entrada de um setor
//   setor-pin-conferir→ (SESSAO-37) confere o PIN de um setor SEM abrir sessão —
//                      o nível "linha de produção" usa para espiar outro setor
//   entrar-pin       → (SESSAO-36) no PC: e-mail + PIN para quem nunca criou senha
//                      (cai na troca obrigatória; depois da senha, deixa de valer)
//                      ↪️ SESSAO-38: aceita também o nome de usuário
//
// SESSAO-38 (D-163): o "entrar" e o "entrar-pin" leem o identificador do mesmo
// jeito (lerIdentificador — sem acento, sem espaço, minúsculo), a senha errada
// passa pela mesma trava do PIN, a conta de tablet não entra por senha, e os
// dois devolvem o nome de usuário de quem entrou (o aparelho lembra).
//
// Tamanhos (SESSAO-37, pedido do dono): PIN de SETOR = exatamente 2 dígitos;
// PIN de PESSOA = 2 a 4 dígitos. A trava de tentativas segue valendo.
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
// SESSAO-36 · a BUSCA pelo PIN: um hash determinístico (HMAC-SHA256) com um
// segredo que NASCE NO BANCO (plt_webhooks, marcador pin_chave — o padrão da
// cópia de fotos do Tiny): acha a pessoa/setor pelo PIN digitado num índice,
// sem comparar PBKDF2 contra todo mundo. A CONFERÊNCIA continua pelo PBKDF2.
// ----------------------------------------------------------------------------
let chaveBuscaCache: string | null = null

async function chaveBusca(): Promise<string> {
  if (chaveBuscaCache) return chaveBuscaCache
  const { data } = await servidor
    .from('plt_webhooks')
    .select('segredo')
    .contains('eventos', ['pin_chave'])
    .maybeSingle()
  if (!data?.segredo) throw new Error('A chave de busca do PIN não está no banco (atualização 95).')
  chaveBuscaCache = data.segredo
  return chaveBuscaCache
}

async function buscaDoPin(pin: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(await chaveBusca()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const assinatura = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(pin))
  return Array.from(new Uint8Array(assinatura)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// O PIN digitado já está em uso por alguém (pessoa ou setor)?
async function pinJaUsado(busca: string, ignorarUsuario?: string, ignorarSetor?: number): Promise<boolean> {
  const { data: pessoa } = await servidor
    .from('plt_usuarios')
    .select('id')
    .eq('pin_busca', busca)
    .maybeSingle()
  if (pessoa && pessoa.id !== ignorarUsuario) return true
  const { data: setor } = await servidor
    .from('plt_setor_pins')
    .select('setor_id')
    .eq('pin_busca', busca)
    .maybeSingle()
  if (setor && Number(setor.setor_id) !== ignorarSetor) return true
  return false
}

// ----------------------------------------------------------------------------
// SESSAO-36 · trava de tentativa e erro (plt_pin_tentativas): 5 erros na
// janela de 15 min bloqueiam por 1 min (e o bloqueio dobra a cada erro a mais,
// até 15 min). A trava vale por ORIGEM: o aparelho (IP) na tela de entrada, a
// sessão do tablet nas ações por PIN, o e-mail no entrar com e-mail + PIN.
// ----------------------------------------------------------------------------
const TRAVA_JANELA_MS = 15 * 60 * 1000
const TRAVA_ERROS = 5

function origemDaChamada(req: Request): string {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
  return ip || 'desconhecida'
}

async function travaBloqueada(chave: string): Promise<number> {
  const { data } = await servidor
    .from('plt_pin_tentativas')
    .select('bloqueado_ate')
    .eq('chave', chave)
    .maybeSingle()
  if (!data?.bloqueado_ate) return 0
  const falta = new Date(data.bloqueado_ate).getTime() - Date.now()
  return falta > 0 ? Math.ceil(falta / 1000) : 0
}

async function travaErrou(chave: string): Promise<void> {
  const { data } = await servidor
    .from('plt_pin_tentativas')
    .select('erros, janela_inicio')
    .eq('chave', chave)
    .maybeSingle()
  const dentroDaJanela =
    data?.janela_inicio && Date.now() - new Date(data.janela_inicio).getTime() < TRAVA_JANELA_MS
  const erros = dentroDaJanela ? Number(data?.erros ?? 0) + 1 : 1
  const bloqueio =
    erros >= TRAVA_ERROS
      ? new Date(Date.now() + Math.min(60_000 * 2 ** (erros - TRAVA_ERROS), TRAVA_JANELA_MS)).toISOString()
      : null
  await servidor.from('plt_pin_tentativas').upsert({
    chave,
    erros,
    janela_inicio: dentroDaJanela ? data?.janela_inicio : new Date().toISOString(),
    bloqueado_ate: bloqueio,
  })
}

async function travaLimpar(chave: string): Promise<void> {
  await servidor.from('plt_pin_tentativas').delete().eq('chave', chave)
}

const TRAVADO = (s: number) =>
  `Muitas tentativas erradas. Espere ${Math.max(1, Math.ceil(s / 60))} minuto(s) e tente de novo.`

function senhaAleatoria(): string {
  return paraB64(crypto.getRandomValues(new Uint8Array(32)))
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
// Erro genérico para quem erra: não confirmamos se o usuário existe.
// Pessoa DESATIVADA que acerta a senha ouve que o acesso está desativado
// (D-141, 16/10/2026) — a mesma frase do gancho do token
// (supabase/pendentes/2026-10-16_gancho_do_token.sql): mudar um, mudar o outro.
// ----------------------------------------------------------------------------
const DESATIVADO =
  'Seu acesso à plataforma está desativado. Fale com a liderança para voltar a entrar.'

// ----------------------------------------------------------------------------
// SESSAO-38 (D-163): o que a pessoa digita no campo "Usuário ou e-mail" vira
// a chave de busca. Com "@" é e-mail (só sem espaços nas pontas e minúsculo);
// sem "@" é o nome de usuário — minúsculo, sem acento e sem espaço (o nome de
// usuário nunca tem nenhum dos dois: o banco só aceita a-z, 0-9, ponto, hífen e
// underline), então "João Lucas" acha "joaolucas". O acento sai pelo código do
// caractere (faixa dos acentos combinantes), nunca por escape (E-15/E-84).
// ----------------------------------------------------------------------------
type Identificador = { coluna: 'email' | 'usuario'; valor: string }

function lerIdentificador(bruto: unknown): Identificador {
  const texto = String(bruto ?? '').trim().toLowerCase()
  if (texto.includes('@')) return { coluna: 'email', valor: texto }
  let valor = ''
  for (const c of texto.normalize('NFD')) {
    const codigo = c.charCodeAt(0)
    if (codigo >= 0x300 && codigo <= 0x36f) continue
    if (c === ' ') continue
    valor += c
  }
  return { coluna: 'usuario', valor }
}

async function entrar(corpo: Json): Promise<Response> {
  const { coluna, valor } = lerIdentificador(corpo.identificador)
  const senha = String(corpo.senha ?? '')
  if (!valor || !senha) return erro(400, 'Informe usuário (ou e-mail) e senha.')

  const NEGADO = 'Usuário ou senha incorretos.'

  // SESSAO-38 (D-163): a trava de tentativa e erro (a mesma do PIN) passa a
  // valer também para a senha — pela CHAVE DIGITADA, exista ou não a pessoa:
  // o "muitas tentativas" aparece igual para quem existe e para quem não
  // existe (não entrega quem tem cadastro).
  const trava = `login:${coluna}:${valor}`
  const bloqueado = await travaBloqueada(trava)
  if (bloqueado > 0) return erro(429, TRAVADO(bloqueado))

  const { data: linha } = await servidor
    .from('plt_usuarios')
    .select('id, email, usuario, ativo, conta_tablet')
    .eq(coluna, valor)
    .maybeSingle()

  // Sem cadastro na plataforma não existe login — mesmo que alguém tenha
  // criado uma conta de auth por fora, ela não entra. A conta de tablet de
  // cada setor (SESSAO-36) só entra pelo PIN do setor — nunca por senha.
  if (!linha || linha.conta_tablet) {
    await travaErrou(trava)
    return erro(401, NEGADO)
  }

  const tentativa = await fetch(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: CHAVE_ANON },
    body: JSON.stringify({ email: linha.email, password: senha }),
  })
  if (!tentativa.ok) {
    // Com o gancho do token ligado, o Auth só o chama DEPOIS de conferir a
    // senha: a recusa dele (a frase DESATIVADO) prova que a senha estava certa.
    if (!linha.ativo && (await tentativa.text()).includes(DESATIVADO)) {
      return erro(403, DESATIVADO)
    }
    await travaErrou(trava)
    return erro(401, NEGADO)
  }
  await travaLimpar(trava)
  const sessao = await tentativa.json()

  // Sem o gancho ligado, o Auth ainda abre a sessão de quem está desativado:
  // a senha conferiu, mas a plataforma não entrega a sessão — encerra-a na
  // hora (melhor esforço) e diz o porquê. Quem errou a senha nunca chega aqui.
  if (!linha.ativo) {
    await fetch(`${URL_SUPABASE}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: { apikey: CHAVE_ANON, Authorization: `Bearer ${sessao.access_token}` },
    }).catch(() => {})
    return erro(403, DESATIVADO)
  }

  // Toda atividade gera registro (SESSAO-13): o login entra na trilha.
  // SESSAO-38: com o caminho usado (usuário ou e-mail) — mede se o nome de
  // usuário pegou, sem guardar o que foi digitado.
  await servidor
    .from('plt_logs_atividade')
    .insert({ usuario_id: linha.id, acao: 'entrou', contexto: { via: coluna } })
    .then(() => {})

  // SESSAO-38 (D-163): devolve o nome de usuário de quem ACABOU de provar a
  // senha — o aparelho guarda e a próxima entrada já vem com ele preenchido
  // (quem entrava pelo e-mail passa a ver o próprio usuário).
  return resposta(200, {
    access_token: sessao.access_token,
    refresh_token: sessao.refresh_token,
    usuario: linha.usuario,
  })
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
  // SESSAO-37 (D-147): os níveis novos — linha de produção e logística.
  if (!['operador', 'lider', 'admin', 'producao', 'logistica'].includes(papel))
    return erro(400, 'Papel inválido.')
  if (pin && !/^[0-9]{2,4}$/.test(pin)) return erro(400, 'PIN: 2 a 4 dígitos.')
  // D-52 (23/09): admin tem permissão total — o vínculo de setor é opcional
  // para ele. A logística também pode nascer sem setor (o nível já dá o acesso).
  if (!['admin', 'logistica'].includes(papel) && setores.length === 0)
    return erro(400, 'Vincule a pessoa a pelo menos um setor.')

  if (quem.papel === 'lider') {
    if (papel !== 'operador') return erro(403, 'Líder só cadastra operador. Papéis maiores, só o admin.')
    if (setores.some((s) => s.lider)) return erro(403, 'Só o admin define quem é líder de setor.')
    const meus = await setoresLiderados(quem.id)
    if (setores.some((s) => !meus.includes(Number(s.setor_id))))
      return erro(403, 'Líder só cadastra gente nos setores em que é líder.')
  }

  // SESSAO-36 (D-146 resposta 2): o PIN do cadastro também é único.
  const buscaDoNovoPin = pin ? await buscaDoPin(pin) : null
  if (buscaDoNovoPin && (await pinJaUsado(buscaDoNovoPin)))
    return erro(409, 'Este PIN já está em uso (por outra pessoa ou por um setor) — escolha outro.')

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

  // 2 · a pessoa na plataforma (a matrícula nasce no banco, pela trigger).
  //     Módulos (SESSAO-20/D-46): todo usuário novo nasce com `fabrica` —
  //     o `comercial` é concedido depois, à mão, por quem administra.
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
      pin_busca: buscaDoNovoPin,
      modulos: ['fabrica'],
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

  // 3 · vínculos com os setores (admin pode nascer sem nenhum — D-52)
  if (setores.length > 0) {
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
  }

  return resposta(201, {
    id: pessoa.id,
    matricula: pessoa.matricula,
    convite_token: pessoa.convite_token,
  })
}

// ----------------------------------------------------------------------------
// SESSAO-37 · editar-usuario — pedido do dono (19/10): a caneta da Equipe
// edita TUDO de uma pessoa já cadastrada — nome, login, e-mail, telefone,
// nível e setores (com quem é líder). Só admin. O e-mail também muda na conta
// de acesso. Os vínculos de setor são trocados pela lista nova. Na trilha vão
// os NOMES dos campos alterados, nunca os valores.
// ----------------------------------------------------------------------------
async function editarUsuario(req: Request, corpo: Json): Promise<Response> {
  const quem = await pessoaDoToken(req)
  if (!quem) return erro(401, 'Sessão inválida. Entre de novo.')
  if (quem.papel !== 'admin') return erro(403, 'Editar o cadastro de outra pessoa é gesto de admin.')

  const usuarioId = String(corpo.usuario_id ?? '')
  const nome = String(corpo.nome ?? '').trim()
  const usuario = String(corpo.usuario ?? '').trim().toLowerCase()
  const email = String(corpo.email ?? '').trim().toLowerCase()
  const telefone = String(corpo.telefone ?? '').trim() || null
  const papel = String(corpo.papel ?? '')
  const setores = Array.isArray(corpo.setores)
    ? (corpo.setores as { setor_id: number; lider?: boolean }[])
    : []

  if (!usuarioId) return erro(400, 'Diga quem você está editando.')
  if (!nome) return erro(400, 'Informe o nome.')
  if (!/^[a-z0-9._-]{3,32}$/.test(usuario))
    return erro(400, 'Nome de usuário: 3 a 32 caracteres, só letras minúsculas, números, ponto, hífen ou underline.')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return erro(400, 'Informe um e-mail válido.')
  if (!['operador', 'lider', 'admin', 'producao', 'logistica'].includes(papel))
    return erro(400, 'Nível de acesso inválido.')
  if (!['admin', 'logistica'].includes(papel) && setores.length === 0)
    return erro(400, 'Vincule a pessoa a pelo menos um setor.')

  const { data: alvo } = await servidor
    .from('plt_usuarios')
    .select('id, auth_user_id, nome, usuario, email, telefone, papel, ativo, conta_tablet')
    .eq('id', usuarioId)
    .maybeSingle()
  if (!alvo) return erro(404, 'Pessoa não encontrada.')
  if (alvo.conta_tablet) return erro(400, 'A conta do tablet de um setor não se edita por aqui.')

  // ninguém tira o próprio admin (evita ficar trancado do lado de fora)
  if (alvo.id === quem.id && papel !== 'admin')
    return erro(400, 'Você não pode tirar o seu próprio nível de admin — peça a outro admin.')
  // a plataforma nunca fica sem admin ativo
  if (alvo.papel === 'admin' && papel !== 'admin' && alvo.ativo) {
    const { count } = await servidor
      .from('plt_usuarios')
      .select('id', { count: 'exact', head: true })
      .eq('papel', 'admin')
      .eq('ativo', true)
      .neq('id', alvo.id)
    if (!count) return erro(400, 'Esta é a última pessoa admin ativa — a plataforma não pode ficar sem admin.')
  }

  // 1 · o e-mail também é o login da conta de acesso: muda lá primeiro
  const emailMudou = alvo.email !== email
  if (emailMudou && alvo.auth_user_id) {
    const alterada = await servidor.auth.admin.updateUserById(alvo.auth_user_id, {
      email,
      email_confirm: true,
    })
    if (alterada.error) {
      const ja = /already|registered|exists/i.test(alterada.error.message)
      return erro(ja ? 409 : 500, ja ? 'Este e-mail já tem conta.' : 'Não consegui trocar o e-mail. Tente de novo.')
    }
  }

  // 2 · o cadastro
  const { error: erroGravar } = await servidor
    .from('plt_usuarios')
    .update({ nome, usuario, email, telefone, papel })
    .eq('id', alvo.id)
  if (erroGravar) {
    if (emailMudou && alvo.auth_user_id) {
      await servidor.auth.admin.updateUserById(alvo.auth_user_id, { email: alvo.email, email_confirm: true })
    }
    const m = erroGravar.message
    if (/usuario_uq/.test(m)) return erro(409, 'Este nome de usuário já existe.')
    if (/email_uq/.test(m)) return erro(409, 'Este e-mail já está cadastrado.')
    return erro(500, 'Não consegui gravar as alterações. Tente de novo.')
  }

  // 3 · os setores: a lista nova manda (sai quem não está; entra/atualiza o resto)
  const novos = new Map(setores.map((s) => [Number(s.setor_id), Boolean(s.lider)]))
  const { data: atuais } = await servidor
    .from('plt_usuario_setores')
    .select('setor_id, lider_do_setor')
    .eq('usuario_id', alvo.id)
  const sair = (atuais ?? []).filter((v) => !novos.has(Number(v.setor_id))).map((v) => Number(v.setor_id))
  if (sair.length > 0) {
    const { error: erroSair } = await servidor
      .from('plt_usuario_setores')
      .delete()
      .eq('usuario_id', alvo.id)
      .in('setor_id', sair)
    if (erroSair) return erro(500, 'Não consegui tirar a pessoa dos setores antigos. Tente de novo.')
  }
  if (novos.size > 0) {
    const { error: erroVinculo } = await servidor.from('plt_usuario_setores').upsert(
      [...novos.entries()].map(([setor_id, lider]) => ({
        usuario_id: alvo.id,
        setor_id,
        lider_do_setor: lider,
      })),
      { onConflict: 'usuario_id,setor_id' },
    )
    if (erroVinculo) return erro(500, 'Não consegui gravar os setores. Tente de novo.')
  }

  // 4 · a trilha (os nomes dos campos, nunca os valores)
  const vinculosMudaram =
    sair.length > 0 ||
    [...novos.entries()].some(
      ([id, lider]) => !(atuais ?? []).some((v) => Number(v.setor_id) === id && v.lider_do_setor === lider),
    )
  const campos = [
    alvo.nome !== nome && 'nome',
    alvo.usuario !== usuario && 'usuario',
    emailMudou && 'email',
    (alvo.telefone ?? null) !== telefone && 'telefone',
    alvo.papel !== papel && 'nivel',
    vinculosMudaram && 'setores',
  ].filter(Boolean)
  await servidor
    .from('plt_logs_atividade')
    .insert({ usuario_id: quem.id, acao: 'usuario_editado', contexto: { usuario_id: alvo.id, campos } })
    .then(() => {})

  return resposta(200, { ok: true, campos })
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
  if (!/^[0-9]{2,4}$/.test(pin)) return erro(400, 'PIN: 2 a 4 dígitos.')

  if (quem.papel === 'lider') {
    const meus = await setoresLiderados(quem.id)
    const { data: doAlvo } = await servidor
      .from('plt_usuario_setores')
      .select('setor_id')
      .eq('usuario_id', usuarioId)
    const alcancavel = (doAlvo ?? []).some((v) => meus.includes(Number(v.setor_id)))
    if (!alcancavel) return erro(403, 'Líder só define PIN de gente dos setores em que é líder.')
  }

  // SESSAO-36 (D-146 resposta 2): PIN único daqui em diante — não pode já ser
  // de outra pessoa nem de um setor. A busca entra junto com o hash.
  const busca = await buscaDoPin(pin)
  if (await pinJaUsado(busca, usuarioId))
    return erro(409, 'Este PIN já está em uso (por outra pessoa ou por um setor) — escolha outro.')

  const { error: erroPin } = await servidor
    .from('plt_usuarios')
    .update({ pin_hash: await gerarHashPin(pin), pin_busca: busca })
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

  // SESSAO-36: trava de tentativa e erro por sessão (antes não havia nenhuma)
  const trava = `sessao:${quem.id}`
  const bloqueado = await travaBloqueada(trava)
  if (bloqueado > 0) return erro(429, TRAVADO(bloqueado))

  if (!alvo || !alvo.ativo || !alvo.pin_hash) {
    await travaErrou(trava)
    return erro(401, NEGADO)
  }
  if (!(await conferirPin(pin, alvo.pin_hash))) {
    await travaErrou(trava)
    return erro(401, NEGADO)
  }
  await travaLimpar(trava)

  // SESSAO-36: o acerto preenche a busca de quem definiu o PIN antes da regra
  await servidor
    .from('plt_usuarios')
    .update({ pin_busca: await buscaDoPin(pin) })
    .eq('id', alvo.id)
    .is('pin_busca', null)
    .then(() => {})

  return resposta(200, {
    usuario_id: alvo.id,
    nome: alvo.nome,
    matricula: alvo.matricula,
    papel: alvo.papel,
  })
}

// ----------------------------------------------------------------------------
// SESSAO-36 · setor-pin-definir — o admin dá (ou troca) o PIN de entrada do
// tablet de um setor de produção. Nunca em texto puro; a mudança fica na
// trilha (D-40), sem o valor.
// ----------------------------------------------------------------------------
async function setorPinDefinir(req: Request, corpo: Json): Promise<Response> {
  const quem = await pessoaDoToken(req)
  if (!quem) return erro(401, 'Sessão inválida. Entre de novo.')
  if (quem.papel !== 'admin') return erro(403, 'O PIN do setor é gesto de admin.')

  const setorId = Number(corpo.setor_id ?? 0)
  const pin = String(corpo.pin ?? '')
  if (!setorId) return erro(400, 'Diga de qual setor é o PIN.')
  if (!/^[0-9]{2}$/.test(pin)) return erro(400, 'PIN do setor: exatamente 2 dígitos.')

  const { data: setor } = await servidor
    .from('plt_setores')
    .select('id, nome, papel_no_fluxo, ativo')
    .eq('id', setorId)
    .maybeSingle()
  if (!setor || !setor.ativo || setor.papel_no_fluxo !== 'producao')
    return erro(400, 'O PIN de entrada é de setor de produção ativo.')

  const busca = await buscaDoPin(pin)
  if (await pinJaUsado(busca, undefined, setorId))
    return erro(409, 'Este PIN já está em uso (por uma pessoa ou por outro setor) — escolha outro.')

  const { error: erroGravar } = await servidor.from('plt_setor_pins').upsert({
    setor_id: setorId,
    pin_hash: await gerarHashPin(pin),
    pin_busca: busca,
    alterado_por: quem.id,
    alterado_em: new Date().toISOString(),
  })
  if (erroGravar) return erro(500, 'Não consegui gravar o PIN do setor. Tente de novo.')

  await servidor
    .from('plt_logs_atividade')
    .insert({ usuario_id: quem.id, acao: 'setor_pin_alterado', contexto: { setor_id: setorId, setor: setor.nome } })
    .then(() => {})
  return resposta(200, { ok: true })
}

// ----------------------------------------------------------------------------
// SESSAO-37 · setor-pin-conferir — confere o PIN de um setor SEM abrir sessão:
// o nível "linha de produção" digita o PIN do setor que quer espiar e, se
// confere, a tela daquele setor abre (só a navegação — os gestos continuam
// gateados no banco). Trava por sessão.
// ----------------------------------------------------------------------------
async function setorPinConferir(req: Request, corpo: Json): Promise<Response> {
  const quem = await pessoaDoToken(req)
  if (!quem) return erro(401, 'Sessão inválida. Entre de novo.')

  const pin = String(corpo.pin ?? '')
  if (!/^[0-9]{2}$/.test(pin)) return erro(400, 'PIN do setor: exatamente 2 dígitos.')

  const trava = `sessao:${quem.id}`
  const bloqueado = await travaBloqueada(trava)
  if (bloqueado > 0) return erro(429, TRAVADO(bloqueado))

  const NEGADO = 'PIN não confere — é o PIN de entrada do setor que você quer abrir.'
  const busca = await buscaDoPin(pin)
  const { data: linha } = await servidor
    .from('plt_setor_pins')
    .select('setor_id, pin_hash')
    .eq('pin_busca', busca)
    .maybeSingle()
  if (!linha || !(await conferirPin(pin, linha.pin_hash))) {
    await travaErrou(trava)
    return erro(401, NEGADO)
  }
  await travaLimpar(trava)

  const { data: setor } = await servidor
    .from('plt_setores')
    .select('id, nome, codigo, ativo')
    .eq('id', linha.setor_id)
    .maybeSingle()
  if (!setor || !setor.ativo) return erro(401, NEGADO)

  await servidor
    .from('plt_logs_atividade')
    .insert({ usuario_id: quem.id, acao: 'setor_aberto_por_pin', contexto: { setor_id: setor.id, setor: setor.nome } })
    .then(() => {})
  return resposta(200, { setor: { id: setor.id, nome: setor.nome, codigo: setor.codigo } })
}

// ----------------------------------------------------------------------------
// SESSAO-36 · tablet-entrar — a tela de login no modo tablet: o PIN DO SETOR
// abre a sessão da CONTA DE TABLET daquele setor (criada sozinha na primeira
// entrada). PIN de pessoa aqui não faz nada (D-146 resposta 3). Sem sessão —
// a trava é pelo aparelho (IP).
// ----------------------------------------------------------------------------
async function tabletEntrar(req: Request, corpo: Json): Promise<Response> {
  const pin = String(corpo.pin ?? '')
  if (!/^[0-9]{2}$/.test(pin)) return erro(400, 'PIN do setor: exatamente 2 dígitos.')

  const trava = `ip:${origemDaChamada(req)}`
  const bloqueado = await travaBloqueada(trava)
  if (bloqueado > 0) return erro(429, TRAVADO(bloqueado))

  const NEGADO = 'PIN não encontrado. A entrada do tablet usa o PIN do setor.'
  const busca = await buscaDoPin(pin)
  const { data: linha } = await servidor
    .from('plt_setor_pins')
    .select('setor_id, pin_hash')
    .eq('pin_busca', busca)
    .maybeSingle()
  if (!linha || !(await conferirPin(pin, linha.pin_hash))) {
    await travaErrou(trava)
    return erro(401, NEGADO)
  }
  await travaLimpar(trava)

  const { data: setor } = await servidor
    .from('plt_setores')
    .select('id, nome, codigo, papel_no_fluxo, ativo')
    .eq('id', linha.setor_id)
    .maybeSingle()
  if (!setor || !setor.ativo) return erro(401, NEGADO)

  // a conta de tablet do setor (uma por setor; nasce aqui na primeira entrada)
  const usuarioTablet = `tablet-s${setor.id}`
  const emailTablet = `tablet-s${setor.id}@tablet.domoby.local`
  let { data: conta } = await servidor
    .from('plt_usuarios')
    .select('id, auth_user_id, ativo')
    .eq('usuario', usuarioTablet)
    .eq('conta_tablet', true)
    .maybeSingle()

  if (!conta) {
    const criada = await servidor.auth.admin.createUser({
      email: emailTablet,
      password: senhaAleatoria(),
      email_confirm: true,
    })
    if (criada.error) return erro(500, 'Não consegui preparar a conta do tablet. Tente de novo.')
    const { data: pessoa, error: erroPessoa } = await servidor
      .from('plt_usuarios')
      .insert({
        auth_user_id: criada.data.user.id,
        nome: `Tablet · ${setor.nome}`,
        email: emailTablet,
        usuario: usuarioTablet,
        papel: 'operador',
        conta_tablet: true,
        senha_padrao: false,
        modulos: ['fabrica'],
      })
      .select('id, auth_user_id, ativo')
      .single()
    if (erroPessoa || !pessoa) {
      await servidor.auth.admin.deleteUser(criada.data.user.id)
      return erro(500, 'Não consegui preparar a conta do tablet. Tente de novo.')
    }
    const { error: erroVinculo } = await servidor
      .from('plt_usuario_setores')
      .insert({ usuario_id: pessoa.id, setor_id: setor.id, lider_do_setor: false })
    if (erroVinculo) {
      await servidor.from('plt_usuarios').delete().eq('id', pessoa.id)
      await servidor.auth.admin.deleteUser(criada.data.user.id)
      return erro(500, 'Não consegui preparar a conta do tablet. Tente de novo.')
    }
    conta = pessoa
  }
  if (!conta.ativo) return erro(403, 'A conta do tablet deste setor está desativada. Fale com a liderança.')

  // a sessão: uma senha nova a cada entrada (as sessões já abertas não caem)
  const senha = senhaAleatoria()
  const trocada = await servidor.auth.admin.updateUserById(conta.auth_user_id, { password: senha })
  if (trocada.error) return erro(500, 'Não consegui abrir a sessão do tablet. Tente de novo.')
  const tentativa = await fetch(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: CHAVE_ANON },
    body: JSON.stringify({ email: emailTablet, password: senha }),
  })
  if (!tentativa.ok) return erro(500, 'Não consegui abrir a sessão do tablet. Tente de novo.')
  const sessao = await tentativa.json()

  await servidor
    .from('plt_logs_atividade')
    .insert({ usuario_id: conta.id, acao: 'tablet_entrou', contexto: { setor_id: setor.id, setor: setor.nome } })
    .then(() => {})

  return resposta(200, {
    access_token: sessao.access_token,
    refresh_token: sessao.refresh_token,
    setor: { id: setor.id, nome: setor.nome, codigo: setor.codigo },
  })
}

// ----------------------------------------------------------------------------
// SESSAO-36 · pin-identificar — "quem é você?" SÓ pelo PIN (sem clicar no
// nome). Acha pela busca; quem definiu o PIN antes desta sessão (sem a busca
// gravada) é conferido um a um e a busca é preenchida no primeiro acerto.
// PIN repetido de antes da regra (D-146 resposta 2): devolve os nomes para a
// pessoa confirmar o seu, e a duplicata fica registrada na trilha.
// ----------------------------------------------------------------------------
async function pinIdentificar(req: Request, corpo: Json): Promise<Response> {
  const quem = await pessoaDoToken(req)
  if (!quem) return erro(401, 'Sessão inválida. Entre de novo.')

  const pin = String(corpo.pin ?? '')
  if (!/^[0-9]{2,4}$/.test(pin)) return erro(400, 'PIN: 2 a 4 dígitos.')

  const trava = `sessao:${quem.id}`
  const bloqueado = await travaBloqueada(trava)
  if (bloqueado > 0) return erro(429, TRAVADO(bloqueado))

  const NEGADO = 'PIN não encontrado.'
  const busca = await buscaDoPin(pin)
  const encontrados: { id: string; nome: string; matricula: string; papel: string; foto_caminho: string | null; pin_hash: string }[] = []

  const { data: direto } = await servidor
    .from('plt_usuarios')
    .select('id, nome, matricula, papel, foto_caminho, pin_hash')
    .eq('pin_busca', busca)
    .eq('ativo', true)
    .eq('conta_tablet', false)
    .maybeSingle()
  if (direto) encontrados.push(direto)

  // quem definiu o PIN antes da busca existir: confere um a um e preenche
  const { data: antigos } = await servidor
    .from('plt_usuarios')
    .select('id, nome, matricula, papel, foto_caminho, pin_hash')
    .is('pin_busca', null)
    .not('pin_hash', 'is', null)
    .eq('ativo', true)
    .eq('conta_tablet', false)
  for (const u of antigos ?? []) {
    if (await conferirPin(pin, u.pin_hash)) encontrados.push(u)
  }

  if (encontrados.length === 0) {
    await travaErrou(trava)
    return erro(401, NEGADO)
  }
  await travaLimpar(trava)

  if (encontrados.length === 1) {
    const u = encontrados[0]
    if (!(await conferirPin(pin, u.pin_hash))) return erro(401, NEGADO)
    // preenche a busca de quem ainda não tinha (o PIN veio de antes da regra)
    await servidor.from('plt_usuarios').update({ pin_busca: busca }).eq('id', u.id).is('pin_busca', null)
    return resposta(200, {
      usuario_id: u.id,
      nome: u.nome,
      matricula: u.matricula,
      papel: u.papel,
      foto_caminho: u.foto_caminho,
    })
  }

  // PIN duplicado histórico: só nesses casos a ação pede confirmar o nome
  await servidor
    .from('plt_logs_atividade')
    .insert({
      usuario_id: quem.id,
      acao: 'pin_duplicado',
      contexto: { matriculas: encontrados.map((u) => u.matricula) },
    })
    .then(() => {})
  return resposta(200, {
    duplicado: encontrados.map((u) => ({ usuario_id: u.id, nome: u.nome, matricula: u.matricula, foto_caminho: u.foto_caminho })),
  })
}

// ----------------------------------------------------------------------------
// SESSAO-36 · entrar-pin — no COMPUTADOR: quem tem PIN e nunca criou senha
// entra com e-mail + PIN e cai na troca obrigatória de senha. Depois de criar
// a senha, este caminho deixa de valer (D-146 resposta 11).
// ----------------------------------------------------------------------------
async function entrarPin(req: Request, corpo: Json): Promise<Response> {
  // SESSAO-38 (D-163): aceita o nome de usuário OU o e-mail (antes só o
  // e-mail). O site antigo manda `email`; o novo manda `identificador`.
  const { coluna, valor } = lerIdentificador(corpo.identificador ?? corpo.email)
  const pin = String(corpo.pin ?? '')
  if (!valor || !/^[0-9]{2,4}$/.test(pin))
    return erro(400, 'Informe o usuário (ou e-mail) e o PIN (2 a 4 dígitos).')

  // A chave do e-mail continua a mesma de antes (`email:`); a do usuário é nova.
  const trava = coluna === 'email' ? `email:${valor}` : `usuario:${valor}`
  const bloqueado = await travaBloqueada(trava)
  if (bloqueado > 0) return erro(429, TRAVADO(bloqueado))

  const NEGADO = 'Usuário (ou e-mail) ou PIN incorretos — ou esta conta já tem senha (entre com ela).'
  const { data: linha } = await servidor
    .from('plt_usuarios')
    .select('id, email, usuario, ativo, senha_padrao, pin_hash, conta_tablet')
    .eq(coluna, valor)
    .maybeSingle()

  if (!linha || linha.conta_tablet || !linha.pin_hash || !(await conferirPin(pin, linha.pin_hash))) {
    await travaErrou(trava)
    return erro(401, NEGADO)
  }
  await travaLimpar(trava)

  // D-141: pessoa desativada é recusada já no login, com a mensagem clara —
  // só para quem acertou o PIN (quem erra continua no genérico).
  if (!linha.ativo) return erro(403, DESATIVADO)
  // D-146 resposta 11: depois da senha criada, o e-mail + PIN deixa de valer.
  if (!linha.senha_padrao) return erro(401, NEGADO)

  const senhaPadrao = Deno.env.get('PLT_SENHA_PADRAO')
  if (!senhaPadrao)
    return erro(500, 'Segredo PLT_SENHA_PADRAO não configurado no painel do Supabase.')

  const tentativa = await fetch(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: CHAVE_ANON },
    body: JSON.stringify({ email: linha.email, password: senhaPadrao }),
  })
  if (!tentativa.ok) return erro(401, NEGADO)
  const sessao = await tentativa.json()

  await servidor
    .from('plt_logs_atividade')
    .insert({
      usuario_id: linha.id,
      acao: 'entrou',
      contexto: { via: coluna === 'email' ? 'email_pin' : 'usuario_pin' },
    })
    .then(() => {})

  // a guarda do front leva direto à troca obrigatória (senha_padrao = true)
  return resposta(200, {
    access_token: sessao.access_token,
    refresh_token: sessao.refresh_token,
    usuario: linha.usuario,
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
      case 'editar-usuario':
        return await editarUsuario(req, corpo)
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
      case 'pin-identificar':
        return await pinIdentificar(req, corpo)
      case 'tablet-entrar':
        return await tabletEntrar(req, corpo)
      case 'setor-pin-definir':
        return await setorPinDefinir(req, corpo)
      case 'setor-pin-conferir':
        return await setorPinConferir(req, corpo)
      case 'entrar-pin':
        return await entrarPin(req, corpo)
      default:
        return erro(400, 'Ação desconhecida.')
    }
  } catch (excecao) {
    console.error('autenticacao: erro inesperado', excecao)
    return erro(500, 'Erro inesperado. Tente de novo.')
  }
})
