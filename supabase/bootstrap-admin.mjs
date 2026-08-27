/**
 * BOOTSTRAP DO PRIMEIRO ADMIN — SESSAO-03 (D-21)
 *
 * O ovo e a galinha: usuário só nasce pela mão de admin/líder, mas o primeiro
 * admin não tem quem o cadastre. Este script roda UMA vez, no terminal do dono,
 * e cria o admin principal direto no banco (auth + plt_usuarios).
 *
 * O CPF é digitado na hora e não fica gravado em lugar nenhum além do banco.
 * Nenhuma credencial é impressa (regra crítica 4).
 *
 * Uso:  npm run admin:bootstrap
 */
import { createInterface } from 'node:readline/promises'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const verde = (t) => `\x1b[32m${t}\x1b[0m`
const vermelho = (t) => `\x1b[31m${t}\x1b[0m`
const negrito = (t) => `\x1b[1m${t}\x1b[0m`

function carregarAmbiente() {
  const arquivo = path.join(RAIZ, '.env.local')
  if (!existsSync(arquivo)) {
    console.error(vermelho('Falta o .env.local — copie o .env.example e preencha.'))
    process.exit(1)
  }
  const ambiente = {}
  for (const linha of readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const achado = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (achado) ambiente[achado[1]] = achado[2].trim().replace(/^["']|["']$/g, '')
  }
  for (const chave of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PLT_SENHA_PADRAO']) {
    if (!ambiente[chave]) {
      console.error(vermelho(`${chave} está vazia no .env.local.`))
      process.exit(1)
    }
  }
  return ambiente
}

const ambiente = carregarAmbiente()
const servidor = createClient(ambiente.SUPABASE_URL, ambiente.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const terminal = createInterface({ input: process.stdin, output: process.stdout })
async function perguntar(pergunta, padrao) {
  const resposta = (await terminal.question(`${pergunta}${padrao ? ` [${padrao}]` : ''}: `)).trim()
  return resposta || padrao || ''
}

console.log(negrito('\n== Bootstrap do primeiro admin da Plataforma Domoby ==\n'))

const { count } = await servidor
  .from('plt_usuarios')
  .select('id', { count: 'exact', head: true })
if (count && count > 0) {
  console.error(
    vermelho(`Já existem ${count} usuário(s) na plataforma.`) +
      '\nEste script é só para o PRIMEIRO admin — os demais nascem pela tela Equipe.',
  )
  process.exit(1)
}

const nome = await perguntar('Nome completo', 'Wallace')
const email = (await perguntar('E-mail', 'wallacecaun03@gmail.com')).toLowerCase()
const usuario = (await perguntar('Nome de usuário', 'wallace')).toLowerCase()
const cpf = (await perguntar('CPF (11 dígitos — vira a matrícula MDM)')).replace(/\D/g, '')
terminal.close()

if (!/^[0-9]{11}$/.test(cpf)) {
  console.error(vermelho('CPF precisa ter 11 dígitos.'))
  process.exit(1)
}

console.log('\nCriando a conta de acesso…')
let authId
const criada = await servidor.auth.admin.createUser({
  email,
  password: ambiente.PLT_SENHA_PADRAO,
  email_confirm: true,
})
if (criada.error) {
  if (/already|registered|exists/i.test(criada.error.message)) {
    // conta de auth já existia (tentativa anterior?) — reaproveita
    const lista = await servidor.auth.admin.listUsers({ page: 1, perPage: 200 })
    const existente = lista.data?.users.find((u) => u.email === email)
    if (!existente) {
      console.error(vermelho('E-mail já tem conta, mas não consegui localizá-la.'))
      process.exit(1)
    }
    authId = existente.id
    console.log('  conta de auth já existia — reaproveitada')
  } else {
    console.error(vermelho(`Não consegui criar a conta: ${criada.error.message}`))
    process.exit(1)
  }
} else {
  authId = criada.data.user.id
  console.log('  conta de auth criada')
}

console.log('Gravando o cadastro na plataforma…')
const { data: pessoa, error: erroPessoa } = await servidor
  .from('plt_usuarios')
  .insert({ auth_user_id: authId, nome, email, usuario, cpf, papel: 'admin' })
  .select('matricula, convite_token')
  .single()
if (erroPessoa) {
  console.error(vermelho(`Não consegui gravar o cadastro: ${erroPessoa.message}`))
  process.exit(1)
}

console.log(verde('\nAdmin criado!'))
console.log(`  Matrícula: ${negrito(pessoa.matricula)}`)
console.log(`  Login: ${usuario} (ou ${email}) + a senha padrão do .env.local`)
console.log('  No primeiro acesso a plataforma vai exigir a troca da senha.\n')
