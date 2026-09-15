/**
 * TESTE DAS MIGRATIONS DA PLATAFORMA — SESSAO-02
 *
 * Roda um Postgres de verdade DENTRO do Node (PGlite), sem Docker e sem tocar
 * em Supabase nenhum. Carrega o esquema REAL da integração (o mesmo
 * `supabase-fabrica-schema.sql` que já roda em produção), aplica as migrations
 * da plataforma DUAS VEZES e prova:
 *
 *   1. rodam do zero sem erro, duas vezes seguidas (idempotência);
 *   2. nenhuma tabela/coluna existente da integração foi alterada;
 *   3. plt_eventos é append-only — UPDATE e DELETE são recusados;
 *   4. o seed cria os 9 setores (7 de produção + ESTOQUE e ROTAS) e ZERO etapas;
 *   5. a posição do card é projetada pelo evento, sem escrita manual;
 *   6. os itens de um pedido continuam podendo ser apagados e regravados com
 *      card vivo apontando para o pedido — ou seja, fn_upsert_pedido não quebra.
 *
 * Uso:  npm run test:banco
 * Equivalente em Docker (Postgres oficial): supabase/testes/testar-migrations.sh
 */
import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MIGRATIONS = path.join(RAIZ, 'supabase/migrations')
const ESQUEMA_INTEGRACAO = path.join(RAIZ, '_docs/Supabase-fabrica/supabase-fabrica-schema.sql')

const verde = (t) => `\x1b[32m${t}\x1b[0m`
const vermelho = (t) => `\x1b[31m${t}\x1b[0m`
const negrito = (t) => `\x1b[1m${t}\x1b[0m`

let falhas = 0
function conferir(condicao, descricao, detalhe = '') {
  if (condicao) {
    console.log(`  ${verde('✔')} ${descricao}`)
  } else {
    falhas += 1
    console.log(`  ${vermelho('✘')} ${descricao}${detalhe ? ` — ${detalhe}` : ''}`)
  }
}

function titulo(t) {
  console.log(`\n${negrito(`== ${t} ==`)}`)
}

const bd = new PGlite()

titulo('Simulando o ambiente Supabase (papéis e auth.uid)')
// O Supabase traz estes papéis e o schema auth de fábrica. Num Postgres cru não
// existem — este bloco recria só o mínimo para as migrations rodarem iguais.
await bd.exec(`
  do $$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end;
  $$;
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid
    language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
`)
console.log('  ambiente pronto')

titulo('Carregando o esquema REAL da integração (produção)')
await bd.exec(await readFile(ESQUEMA_INTEGRACAO, 'utf8'))
console.log('  clientes, pedidos, pedido_itens, eventos e fn_upsert_pedido no lugar')

const RETRATO = `
  select table_name || '.' || column_name || ':' || data_type || ':' || is_nullable as linha
    from information_schema.columns
   where table_schema = 'public'
     and table_name in ('clientes','pedidos','pedido_itens','eventos','gp_pcp_processados')
   order by table_name, ordinal_position;
`
const antes = (await bd.query(RETRATO)).rows.map((r) => r.linha)
console.log(`  ${antes.length} colunas registradas antes das migrations`)

const arquivos = (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort()

for (const rodada of [1, 2]) {
  titulo(`Aplicando as migrations — rodada ${rodada}`)
  for (const arquivo of arquivos) {
    try {
      await bd.exec(await readFile(path.join(MIGRATIONS, arquivo), 'utf8'))
      console.log(`  · ${arquivo}`)
    } catch (erro) {
      falhas += 1
      console.log(`  ${vermelho('✘')} ${arquivo}\n     ${erro.message}`)
    }
  }
}
conferir(falhas === 0, 'migrations aplicadas duas vezes seguidas sem erro')

titulo('A integração continua intacta?')
const depois = (await bd.query(RETRATO)).rows.map((r) => r.linha)
const mudou = antes
  .filter((l) => !depois.includes(l))
  .concat(depois.filter((l) => !antes.includes(l)))
conferir(
  mudou.length === 0,
  'nenhuma tabela/coluna existente da integração foi alterada',
  mudou.join(' | '),
)

titulo('Seed e estrutura')
const setores = (
  await bd.query(`select codigo, nome, papel_no_fluxo from public.plt_setores order by ordem`)
).rows
console.log('  ' + setores.map((s) => `${s.nome} (${s.papel_no_fluxo})`).join(' · '))
conferir(
  setores.length === 9,
  '9 setores semeados, sem duplicar na segunda rodada',
  `vieram ${setores.length}`,
)
conferir(
  setores
    .filter((s) => s.papel_no_fluxo === 'terminal')
    .map((s) => s.codigo)
    .join(',') === 'estoque,rotas',
  'ESTOQUE e ROTAS são os dois fins de linha (D-13 / Q-28)',
)
conferir(
  setores.filter((s) => s.papel_no_fluxo === 'entrada').length === 1,
  'existe exatamente uma entrada no fluxo (D-13)',
)
conferir(!setores.some((s) => s.codigo === 'metalurgica'), 'METALURGICA não foi semeada (D-12)')

const etapas = (await bd.query(`select count(*)::int as total from public.plt_etapas`)).rows[0]
conferir(etapas.total === 0, 'nenhuma etapa interna semeada (D-14)', `vieram ${etapas.total}`)

titulo('Identidade e acesso (SESSAO-03 / D-21)')
// Matrícula MDM-XXX-NNN gerada pelo banco: XXX = 3 primeiros dígitos do CPF,
// NNN = ordem de cadastro. E as normalizações: CPF com máscara vira só dígitos,
// usuário/e-mail viram minúsculos.
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel)
    values ('Primeira Pessoa', 'Primeira@Teste.com', '061.234.567-89', 'Primeira.Pessoa', 'admin');
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel)
    values ('Segunda Pessoa', 'segunda@teste.com', '98765432100', 'segunda.pessoa', 'operador');
`)
const pessoas = (
  await bd.query(
    `select matricula, cpf, usuario, email, senha_padrao, convite_token is not null as tem_convite
       from public.plt_usuarios order by matricula`,
  )
).rows
conferir(
  pessoas[0]?.matricula === 'MDM-061-001' && pessoas[1]?.matricula === 'MDM-987-002',
  'matrícula MDM-XXX-NNN gerada na ordem de cadastro',
  pessoas.map((p) => p.matricula).join(' · '),
)
conferir(
  pessoas[0]?.cpf === '06123456789' && pessoas[0]?.usuario === 'primeira.pessoa' && pessoas[0]?.email === 'primeira@teste.com',
  'CPF com máscara vira só dígitos; usuário e e-mail viram minúsculos',
)
conferir(
  pessoas.every((p) => p.senha_padrao === true && p.tem_convite === true),
  'todo cadastro nasce com senha padrão pendente de troca e com token de convite',
)

async function deveRecusar(sql, descricao, padraoErro) {
  try {
    await bd.exec(sql)
    conferir(false, descricao, 'a operação passou, e não devia')
  } catch (erro) {
    conferir(padraoErro.test(erro.message), descricao, erro.message)
  }
}
await deveRecusar(
  `insert into public.plt_usuarios (nome, email, usuario, papel)
     values ('Sem CPF', 'sem.cpf@teste.com', 'sem.cpf', 'operador')`,
  'cadastro sem CPF é recusado (matrícula exige CPF)',
  /CPF/i,
)
await deveRecusar(
  `insert into public.plt_usuarios (nome, email, cpf, usuario)
     values ('Repetido', 'outro@teste.com', '11122233344', 'PRIMEIRA.pessoa')`,
  'nome de usuário repetido é recusado (mesmo mudando maiúsculas)',
  /plt_usuarios_usuario_uq|duplicate/i,
)
await deveRecusar(
  `insert into public.plt_usuarios (nome, email, cpf, usuario)
     values ('CPF Repetido', 'cpfrep@teste.com', '061.234.567-89', 'cpf.repetido')`,
  'CPF repetido é recusado',
  /plt_usuarios_cpf_uq|duplicate/i,
)

titulo('Cenário mínimo: pedido novo vira card no PCP SOZINHO (SESSAO-09/D-31)')
await bd.exec(`
  insert into public.clientes (nome) values ('Cliente de teste');
  insert into public.pedidos (numero, cliente_id, situacao)
    values (999999, (select id from public.clientes order by id desc limit 1), 'aprovado');
`)
const autoCard = (
  await bd.query(`
    select c.id,
           (select s.codigo from public.plt_setores s where s.id = c.setor_atual_id) as setor,
           (select e.origem from public.plt_eventos e
             where e.card_id = c.id and e.tipo = 'card_criado' limit 1) as origem_evento
      from public.plt_cards c
     where c.tipo = 'pedido'
       and c.pedido_id = (select id from public.pedidos where numero = 999999)`)
).rows[0]
conferir(
  autoCard !== undefined && autoCard.origem_evento === 'automacao',
  'o INSERT em pedidos criou o card no PCP sem toque humano (trigger da migration 17)',
  JSON.stringify(autoCard ?? null),
)

titulo('plt_eventos é append-only? (RNF-05)')
async function deveFalhar(sql, descricao) {
  try {
    await bd.exec(sql)
    conferir(false, descricao, 'a operação passou, e não devia')
  } catch (erro) {
    conferir(/append-only/i.test(erro.message), descricao, erro.message)
  }
}
await deveFalhar(
  `update public.plt_eventos set observacao = 'adulterado'`,
  'UPDATE em evento é recusado',
)
await deveFalhar(`delete from public.plt_eventos`, 'DELETE em evento é recusado')

titulo('A posição do card é projetada pelo evento?')
const posicao = (
  await bd.query(`
    select coalesce(s.codigo, 'sem setor') as setor, c.desde is not null as tem_desde
      from public.plt_cards c
      left join public.plt_setores s on s.id = c.setor_atual_id
     order by c.id desc limit 1`)
).rows[0]
conferir(
  posicao.setor === 'pcp',
  'o evento posicionou o card no PCP sem escrita manual',
  posicao.setor,
)
conferir(posicao.tem_desde, 'o relógio da permanência começou a contar sozinho (D-14 / M-11)')

titulo('A integração do Tiny continua funcionando com card vivo?')
// O teste que mais importa: fn_upsert_pedido APAGA e regrava os itens a cada
// atualização. Se houvesse foreign key do card para pedido_itens, isto
// quebraria — e quebraria em produção.
try {
  await bd.exec(`
    insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
      values ((select id from public.pedidos where numero = 999999), 1, '061', 'Item de teste', 2);
    delete from public.pedido_itens where pedido_id = (select id from public.pedidos where numero = 999999);
  `)
  conferir(
    true,
    'itens do pedido podem ser apagados e regravados com card vivo apontando para o pedido',
  )
} catch (erro) {
  conferir(false, 'itens do pedido podem ser apagados e regravados', erro.message)
}

titulo('As visões de tempo e qualidade respondem?')
for (const visao of ['plt_vw_permanencias', 'plt_vw_execucoes', 'plt_vw_qualidade_transicoes']) {
  try {
    await bd.query(`select * from public.${visao} limit 1`)
    conferir(true, `${visao} consulta sem erro`)
  } catch (erro) {
    conferir(false, `${visao} consulta sem erro`, erro.message)
  }
}

titulo('Leitura de pedidos para o kanban (SESSAO-04 / migration 13)')
// As quatro funções são a porta de leitura do kanban. Regra de ouro: sem
// usuário ativo da plataforma no contexto, elas devolvem VAZIO — o gate vive
// dentro da função, não na boa vontade de quem chama.
// (Lembrete E-14: o PGlite roda como superusuário e NÃO prova permissão de
// papel — grants/revokes só se provam no banco real, com get_advisors depois.)
await bd.exec(`
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade) values
    ((select id from public.pedidos where numero = 999999), 1, '061', 'Guarda-roupa Master', 2),
    ((select id from public.pedidos where numero = 999999), 2, '099', 'Brinde quantidade zero', 0.4),
    ((select id from public.pedidos where numero = 999999), 3, '073', 'Cômoda Slim', 1);
`)

const semUsuario = (
  await bd.query(`select count(*)::int as total from public.plt_fn_pedidos_kanban()`)
).rows[0]
conferir(
  semUsuario.total === 0,
  'sem usuário da plataforma no contexto, plt_fn_pedidos_kanban devolve vazio (gate)',
  `vieram ${semUsuario.total}`,
)

// Entra em cena a Segunda Pessoa (operador, ainda sem setor nenhum).
await bd.exec(`
  update public.plt_usuarios set auth_user_id = '00000000-0000-0000-0000-000000000002'
   where usuario = 'segunda.pessoa';
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
`)

const resumo = (
  await bd.query(
    `select numero, cliente_nome, total_itens, total_unidades, tem_card
       from public.plt_fn_pedidos_kanban(p_ids => array[(select id from public.pedidos where numero = 999999)])`,
  )
).rows[0]
conferir(
  resumo?.numero === 999999 && resumo?.tem_card === true,
  'plt_fn_pedidos_kanban devolve o pedido com tem_card calculado',
  JSON.stringify(resumo ?? null),
)
conferir(
  resumo?.total_itens === 3 && resumo?.total_unidades === 3,
  'unidades seguem a regra real do n8n: 2 + 1, e quantidade 0.4 não vira card',
  `itens=${resumo?.total_itens} unidades=${resumo?.total_unidades}`,
)

const colunasResumo = Object.keys(resumo ?? {})
conferir(
  !colunasResumo.some((c) => /endereco|cpf|fone|email|valor|total_pedido|raw/.test(c)),
  'nenhum dado pessoal/financeiro do cliente sai pela função',
  colunasResumo.join(','),
)

const itens = (
  await bd.query(
    `select seq, unidades from public.plt_fn_pedido_itens_kanban((select id from public.pedidos where numero = 999999))`,
  )
).rows
conferir(
  itens.length === 2 && itens[0]?.unidades === 2 && itens[1]?.unidades === 1,
  'plt_fn_pedido_itens_kanban lista só o que vira card (k/n por item)',
  JSON.stringify(itens),
)

titulo('Liberação em unidades + reagrupamento (D-01 / D-13)')
// Simula a SESSAO-04 inteira no banco: 2 unidades liberadas do pedido, uma
// movida até o terminal ESTOQUE. A expedição precisa contar 1 de 3.
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, c.id, 1, '061', 'Guarda-roupa Master', k, 2
      from public.pedidos p
      join public.plt_cards c on c.pedido_id = p.id and c.tipo = 'pedido'
      cross join generate_series(1, 2) as k
     where p.numero = 999999;
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    select cu.id, 'card_criado', (select id from public.plt_setores where codigo = 'pcp'), 'interface'
      from public.plt_cards cu where cu.tipo = 'unidade';
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, origem)
    select cu.id, 'movimentacao_setor',
           (select id from public.plt_setores where codigo = 'pcp'),
           (select id from public.plt_setores where codigo = 'estoque'),
           'interface'
      from public.plt_cards cu where cu.tipo = 'unidade' and cu.indice_unidade = 1;
`)

const duplicada = await (async () => {
  try {
    await bd.exec(`
      insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
        select 'unidade', p.id, 1, '061', 'Guarda-roupa Master', 1, 2
          from public.pedidos p where p.numero = 999999;
    `)
    return false
  } catch {
    return true
  }
})()
conferir(duplicada, 'a mesma unidade (pedido, item, k) não nasce duas vezes')

const semAcessoExpedicao = (
  await bd.query(`select count(*)::int as total from public.plt_fn_expedicao_kanban()`)
).rows[0]
conferir(
  semAcessoExpedicao.total === 0,
  'operador sem setor de entrada/terminal NÃO vê a expedição (gate)',
  `vieram ${semAcessoExpedicao.total}`,
)

await bd.exec(`
  insert into public.plt_usuario_setores (usuario_id, setor_id)
    values ((select id from public.plt_usuarios where usuario = 'segunda.pessoa'),
            (select id from public.plt_setores where codigo = 'pcp'));
`)
const expedicao = (
  await bd.query(
    `select total_unidades, unidades_liberadas, unidades_no_terminal from public.plt_fn_expedicao_kanban()`,
  )
).rows[0]
conferir(
  expedicao?.total_unidades === 3 &&
    expedicao?.unidades_liberadas === 2 &&
    expedicao?.unidades_no_terminal === 1,
  'reagrupamento: 3 unidades no pedido, 2 liberadas, 1 no fim de linha → incompleto',
  JSON.stringify(expedicao ?? null),
)

const resumoDepois = (
  await bd.query(
    `select unidades_liberadas from public.plt_fn_pedidos_kanban(p_ids => array[(select id from public.pedidos where numero = 999999)])`,
  )
).rows[0]
conferir(
  resumoDepois?.unidades_liberadas === 2,
  'o resumo conta as unidades já liberadas (o quadro PCP sabe o que falta)',
  JSON.stringify(resumoDepois ?? null),
)

const unidades = (
  await bd.query(
    `select indice_unidade, setor_nome, setor_terminal, concluido_em is not null as concluida
       from public.plt_fn_pedido_unidades((select id from public.pedidos where numero = 999999))`,
  )
).rows
conferir(
  unidades.length === 2 &&
    unidades[0]?.setor_nome === 'ESTOQUE' &&
    unidades[0]?.setor_terminal === true &&
    unidades[0]?.concluida === true &&
    unidades[1]?.setor_nome === 'PCP' &&
    unidades[1]?.concluida === false,
  'o detalhe mostra onde está cada unidade; chegar ao terminal conclui a unidade',
  JSON.stringify(unidades),
)

// Limpa o contexto para não influenciar nada que venha depois.
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)

// ============================================================================
// SESSAO-05 — Timers, execução e estorno (migration 14 / D-24)
// Lembrete E-14: o PGlite roda como superusuário — RLS/grants não se provam
// aqui. O que se prova: as REGRAS de trigger (valem para todo mundo) e as views.
// ============================================================================
titulo('Execução (SESSAO-05/D-24): iniciar obrigatório, transferência, limite')

// Pessoas do cenário: dois operadores da SECC, um líder da FITAMENTO.
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel) values
    ('Operador Um',  'exec1@teste.com', '11111111101', 'exec.um',   'operador'),
    ('Operador Dois','exec2@teste.com', '11111111102', 'exec.dois', 'operador'),
    ('Lider Fita',   'lider@teste.com', '11111111103', 'lider.fita','lider');
  insert into public.plt_usuario_setores (usuario_id, setor_id) values
    ((select id from public.plt_usuarios where usuario = 'exec.um'),
     (select id from public.plt_setores where codigo = 'secc')),
    ((select id from public.plt_usuarios where usuario = 'exec.dois'),
     (select id from public.plt_setores where codigo = 'secc'));
  insert into public.plt_usuario_setores (usuario_id, setor_id, lider_do_setor) values
    ((select id from public.plt_usuarios where usuario = 'lider.fita'),
     (select id from public.plt_setores where codigo = 'fitamento'), true);
`)

// O card do cenário: a Cômoda Slim (item 3, 1/1) nasce no PCP e vai para a SECC.
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, 3, '073', 'Cômoda Slim', 1, 1
      from public.pedidos p where p.numero = 999999;
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    values ((select max(id) from public.plt_cards),
            'card_criado', (select id from public.plt_setores where codigo = 'pcp'), 'interface');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem)
    values ((select max(id) from public.plt_cards), 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'pcp'),
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface');
`)
const cardComoda = (await bd.query(`select max(id)::int as id from public.plt_cards`)).rows[0].id

async function deveRecusarExec(sql, descricao, padrao) {
  try {
    await bd.exec(sql)
    conferir(false, descricao, 'a operação passou, e não devia')
  } catch (erro) {
    conferir(padrao.test(erro.message), descricao, erro.message)
  }
}

await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
     values (${cardComoda}, 'execucao_finalizada',
             (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface')`,
  'finalizar sem iniciar é recusado (iniciar é obrigatório — D-24)',
  /Iniciar é obrigatório/i,
)
await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, origem)
     values (${cardComoda}, 'execucao_iniciada', 'api')`,
  'iniciar sem pessoa é recusado (execução é gesto de pessoa — D-02)',
  /gestos de pessoa/i,
)

await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
    values (${cardComoda}, 'execucao_iniciada',
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface');
`)
const executor1 = (
  await bd.query(`
    select u.usuario, e.setor_origem_id is not null as tem_setor
      from public.plt_cards c
      join public.plt_usuarios u on u.id = c.executor_atual_id
      join public.plt_eventos e on e.card_id = c.id and e.tipo = 'execucao_iniciada'
     where c.id = ${cardComoda}`)
).rows[0]
conferir(
  executor1?.usuario === 'exec.um',
  'iniciar projeta o executor no card',
  JSON.stringify(executor1 ?? null),
)
conferir(
  executor1?.tem_setor === true,
  'o trigger preencheu o setor da época no evento de iniciar (linha do tempo sabe ONDE)',
)

await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
     values (${cardComoda}, 'execucao_iniciada',
             (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface')`,
  'a mesma pessoa não inicia o mesmo card duas vezes',
  /já está executando/i,
)

// Transferência (D-24): exec.dois assume → fecha para um, abre para o outro.
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
    values (${cardComoda}, 'execucao_iniciada',
            (select id from public.plt_usuarios where usuario = 'exec.dois'), 'interface');
`)
const transfer = (
  await bd.query(`
    select ui.usuario as iniciou, v.encerramento, v.em_andamento
      from public.plt_vw_execucoes v
      join public.plt_usuarios ui on ui.id = v.usuario_inicio_id
     where v.card_id = ${cardComoda}
     order by v.iniciou_em, v.evento_inicio_id`)
).rows
conferir(
  transfer.length === 2 &&
    transfer[0]?.iniciou === 'exec.um' &&
    transfer[0]?.encerramento === 'transferencia' &&
    transfer[1]?.iniciou === 'exec.dois' &&
    transfer[1]?.em_andamento === true,
  'transferência fecha a execução de um e abre a do outro (D-24)',
  JSON.stringify(transfer),
)

await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
    values (${cardComoda}, 'execucao_finalizada',
            (select id from public.plt_usuarios where usuario = 'exec.dois'), 'interface');
`)
const finalizada = (
  await bd.query(`
    select v.encerramento, uf.usuario as finalizou, c.executor_atual_id is null as executor_zerado
      from public.plt_vw_execucoes v
      join public.plt_usuarios uf on uf.id = v.usuario_fim_id
      join public.plt_cards c on c.id = v.card_id
     where v.card_id = ${cardComoda} and v.encerramento = 'finalizada'`)
).rows[0]
conferir(
  finalizada?.finalizou === 'exec.dois' && finalizada?.executor_zerado === true,
  'finalizar fecha a execução com autor e zera o executor do card',
  JSON.stringify(finalizada ?? null),
)

// Limite por pessoa/setor (D-24): SECC com limite 1 → segundo card é recusado.
await bd.exec(`
  update public.plt_setores set limite_execucoes_por_pessoa = 1 where codigo = 'secc';
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
    values (${cardComoda}, 'execucao_iniciada',
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem)
    select cu.id, 'movimentacao_setor',
           (select id from public.plt_setores where codigo = 'pcp'),
           (select id from public.plt_setores where codigo = 'secc'),
           (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface'
      from public.plt_cards cu
     where cu.tipo = 'unidade' and cu.indice_unidade = 2;
`)
const cardSegundo = (
  await bd.query(
    `select id from public.plt_cards where tipo = 'unidade' and indice_unidade = 2`,
  )
).rows[0].id
await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
     values (${cardSegundo}, 'execucao_iniciada',
             (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface')`,
  'limite do setor (1 por pessoa) recusa o segundo card em execução',
  /Limite do setor/i,
)
await bd.exec(`update public.plt_setores set limite_execucoes_por_pessoa = null where codigo = 'secc'`)
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
    values (${cardSegundo}, 'execucao_iniciada',
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface');
`)
conferir(true, 'sem limite (padrão), a mesma pessoa executa mais de um card')

// Mover com execução aberta encerra sozinho (D-24).
// Desde a SESSAO-06 (D-09): sair de setor de PRODUÇÃO pela interface exige a
// marcação de qualidade vinculada — o mover abaixo já nasce no formato novo.
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem, estado_qualidade)
    values (${cardComoda}, 'qualidade_marcada',
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_setores where codigo = 'fitamento'),
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface', 'perfeito');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem, evento_referencia_id)
    values (${cardComoda}, 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_setores where codigo = 'fitamento'),
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface',
            (select max(id) from public.plt_eventos where card_id = ${cardComoda} and tipo = 'qualidade_marcada'));
`)
const aposMover = (
  await bd.query(`
    select (select executor_atual_id from public.plt_cards where id = ${cardComoda}) is null as executor_zerado,
           (select count(*)::int from public.plt_vw_execucoes
             where card_id = ${cardComoda} and encerramento = 'movimentacao') as fechadas_por_mover`)
).rows[0]
conferir(
  aposMover?.executor_zerado === true && aposMover?.fechadas_por_mover === 1,
  'mover com execução aberta encerra a execução naquele instante (D-24)',
  JSON.stringify(aposMover ?? null),
)

// Critério da demanda: mover sem iniciar → tempo todo é fila (zero execuções).
const soFila = (
  await bd.query(`
    select (select count(*)::int from public.plt_vw_permanencias where card_id = ${cardSegundo}) as permanencias,
           (select count(*)::int from public.plt_vw_execucoes
             where card_id = ${cardSegundo} and encerramento is distinct from null
               and iniciou_em < (select min(entrou_em) from public.plt_vw_permanencias where card_id = ${cardSegundo})) as execucoes_antes`)
).rows[0]
conferir(
  (soFila?.permanencias ?? 0) >= 2,
  'card com 2+ etapas tem uma permanência por etapa (linha do tempo completa)',
  JSON.stringify(soFila ?? null),
)

titulo('Estorno (SESSAO-05): evento novo, original visível, só líder/admin')

// A chegada na FITAMENTO teve marcação — o iniciar exige o parecer antes
// (SESSAO-06/D-09). O líder do setor confirma o recebimento e o fluxo segue.
await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
     values (${cardComoda}, 'execucao_iniciada',
             (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface')`,
  'iniciar antes do parecer de recebimento é recusado (D-09 — SESSAO-06)',
  /confirme o recebimento/i,
)
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id, estado_qualidade)
    values (${cardComoda}, 'qualidade_parecer',
            (select id from public.plt_usuarios where usuario = 'lider.fita'), 'interface',
            (select max(id) from public.plt_eventos where card_id = ${cardComoda} and tipo = 'qualidade_marcada'),
            'perfeito');
`)

// FITAMENTO: exec.um não é do setor, mas quem valida papel é o trigger — o
// cenário: iniciar e finalizar lá, e desfazer os gestos um a um.
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
    values (${cardComoda}, 'execucao_iniciada',
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface');
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
    values (${cardComoda}, 'execucao_finalizada',
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface');
`)
const eventoFinalizada = (
  await bd.query(`
    select max(id)::int as id from public.plt_eventos
     where card_id = ${cardComoda} and tipo = 'execucao_finalizada'`)
).rows[0].id
const eventoIniciada = (
  await bd.query(`
    select max(id)::int as id from public.plt_eventos
     where card_id = ${cardComoda} and tipo = 'execucao_iniciada'`)
).rows[0].id

await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, evento_referencia_id, origem)
     values (${cardComoda}, 'estorno',
             (select id from public.plt_usuarios where usuario = 'exec.um'), ${eventoFinalizada}, 'interface')`,
  'operador comum não estorna (gesto de líder/admin)',
  /gesto de líder/i,
)
await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, evento_referencia_id, origem)
     values (${cardComoda}, 'estorno',
             (select id from public.plt_usuarios where usuario = 'primeira.pessoa'), ${eventoIniciada}, 'interface')`,
  'estornar um gesto que não é o último é recusado (desfaz-se do mais novo para trás)',
  /último gesto/i,
)
await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, evento_referencia_id, origem)
     values (${cardComoda}, 'estorno',
             (select id from public.plt_usuarios where usuario = 'primeira.pessoa'),
             (select min(id) from public.plt_eventos where card_id = ${cardComoda} and tipo = 'movimentacao_setor'), 'interface')`,
  'movimentação não se estorna (corrige-se movendo de novo)',
  /Movimentação errada/i,
)

// Admin estorna a finalização ("finalizou sem querer") → execução reabre.
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, evento_referencia_id, origem)
    values (${cardComoda}, 'estorno',
            (select id from public.plt_usuarios where usuario = 'primeira.pessoa'), ${eventoFinalizada}, 'interface');
`)
const aposEstorno1 = (
  await bd.query(`
    select (select count(*)::int from public.plt_eventos where id = ${eventoFinalizada}) as original_existe,
           (select u.usuario from public.plt_cards c join public.plt_usuarios u on u.id = c.executor_atual_id
             where c.id = ${cardComoda}) as executor,
           (select em_andamento from public.plt_vw_execucoes
             where card_id = ${cardComoda} and evento_inicio_id = ${eventoIniciada}) as reaberta`)
).rows[0]
conferir(
  aposEstorno1?.original_existe === 1 &&
    aposEstorno1?.executor === 'exec.um' &&
    aposEstorno1?.reaberta === true,
  'estorno da finalização: original permanece, execução reabre, executor volta (M-13)',
  JSON.stringify(aposEstorno1 ?? null),
)

await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, evento_referencia_id, origem)
     values (${cardComoda}, 'estorno',
             (select id from public.plt_usuarios where usuario = 'primeira.pessoa'), ${eventoFinalizada}, 'interface')`,
  'estornar duas vezes o mesmo evento é recusado',
  /já foi estornado/i,
)

// Líder do setor ATUAL (FITAMENTO) estorna o iniciar → executor zera.
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, evento_referencia_id, origem)
    values (${cardComoda}, 'estorno',
            (select id from public.plt_usuarios where usuario = 'lider.fita'), ${eventoIniciada}, 'interface');
`)
const aposEstorno2 = (
  await bd.query(`
    select (select executor_atual_id from public.plt_cards where id = ${cardComoda}) is null as executor_zerado,
           (select count(*)::int from public.plt_vw_execucoes
             where card_id = ${cardComoda} and evento_inicio_id = ${eventoIniciada}) as sumiu_da_view,
           (select count(*)::int from public.plt_eventos
             where card_id = ${cardComoda} and tipo = 'estorno') as estornos`)
).rows[0]
conferir(
  aposEstorno2?.executor_zerado === true &&
    aposEstorno2?.sumiu_da_view === 0 &&
    aposEstorno2?.estornos === 2,
  'estorno do iniciar (pelo líder do setor): view ignora a execução, eventos todos preservados',
  JSON.stringify(aposEstorno2 ?? null),
)

titulo('Linha do tempo e RPC de estorno (gates)')
const semUsuarioLinha = (
  await bd.query(`select count(*)::int as total from public.plt_fn_linha_tempo_card(${cardComoda})`)
).rows[0]
conferir(
  semUsuarioLinha.total === 0,
  'sem usuário no contexto, a linha do tempo devolve vazio (gate)',
  `vieram ${semUsuarioLinha.total}`,
)

// exec.um (da SECC) NÃO vê o card que está na FITAMENTO — a linha do tempo
// respeita a mesma regra de visibilidade do card.
await bd.exec(`
  update public.plt_usuarios set auth_user_id = '00000000-0000-0000-0000-000000000011'
   where usuario = 'exec.um';
  update public.plt_usuarios set auth_user_id = '00000000-0000-0000-0000-000000000012'
   where usuario = 'lider.fita';
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
`)
const linhaForaDoSetor = (
  await bd.query(`select count(*)::int as total from public.plt_fn_linha_tempo_card(${cardComoda})`)
).rows[0]
conferir(
  linhaForaDoSetor.total === 0,
  'quem não vê o card não vê a linha do tempo dele',
  `vieram ${linhaForaDoSetor.total}`,
)

await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false)`)
const linha = (
  await bd.query(`
    select tipo, usuario_nome, setor_destino_nome, estornado
      from public.plt_fn_linha_tempo_card(${cardComoda}) order by ocorrido_em, evento_id`)
).rows
conferir(
  linha.length >= 8 &&
    linha.some((l) => l.tipo === 'execucao_iniciada' && l.estornado === true) &&
    linha.some((l) => l.tipo === 'estorno') &&
    linha.every((l) => l.tipo !== 'movimentacao_setor' || l.setor_destino_nome),
  'linha do tempo completa: nomes de pessoas/setores e estornados marcados',
  JSON.stringify(linha.map((l) => `${l.tipo}${l.estornado ? '(estornado)' : ''}`)),
)

// A RPC de estorno com o gate de verdade: o líder da FITAMENTO desfaz um
// gesto novo pelo caminho que a interface usa.
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
    values (${cardComoda}, 'execucao_iniciada',
            (select id from public.plt_usuarios where usuario = 'lider.fita'), 'interface');
`)
const eventoNovo = (
  await bd.query(`select max(id)::int as id from public.plt_eventos where card_id = ${cardComoda} and tipo = 'execucao_iniciada'`)
).rows[0].id
const estornoRpc = (
  await bd.query(`select public.plt_fn_estornar_evento(${eventoNovo}, 'iniciado sem querer')::int as id`)
).rows[0]
conferir(
  Number.isInteger(estornoRpc?.id),
  'plt_fn_estornar_evento registra o estorno pelo caminho da interface',
  JSON.stringify(estornoRpc ?? null),
)

await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false)`)
try {
  await bd.query(`select public.plt_fn_estornar_evento(${eventoFinalizada}, 'tentativa indevida')`)
  conferir(false, 'operador comum não estorna pela RPC', 'a chamada passou, e não devia')
} catch (erro) {
  conferir(
    /gesto de líder|já foi estornado/i.test(erro.message),
    'operador comum não estorna pela RPC',
    erro.message,
  )
}

await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)

// ============================================================================
// SESSAO-06 — Qualidade nas transições (migration 15 / D-09 / D-25)
// A dupla atestação virando regra de banco: marcação obrigatória ao sair de
// produção, parecer antes do iniciar, 🔴 vai para DANIFICADO, notificações
// automáticas. Lembrete E-14: RLS/grants não se provam no PGlite.
// ============================================================================
titulo('Qualidade (SESSAO-06): marcação obrigatória ao sair de produção')

// O card do cenário: item 2 (1/1) nasce no PCP e vai para a SECC — a saída do
// PCP NÃO exige marcação (D-25: a peça ainda nem foi produzida).
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, 2, '099', 'Peça Teste Qualidade', 1, 1
      from public.pedidos p where p.numero = 999999;
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    values ((select max(id) from public.plt_cards),
            'card_criado', (select id from public.plt_setores where codigo = 'pcp'), 'interface');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem)
    values ((select max(id) from public.plt_cards), 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'pcp'),
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface');
`)
conferir(true, 'saída do PCP (entrada) não exige marcação de qualidade (D-25)')
const cardQ = (await bd.query(`select max(id)::int as id from public.plt_cards`)).rows[0].id

await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem)
     values (${cardQ}, 'movimentacao_setor',
             (select id from public.plt_setores where codigo = 'secc'),
             (select id from public.plt_setores where codigo = 'furacao'),
             (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface')`,
  'mover entre setores sem marcar o estado é impossível (D-09 — critério 1)',
  /marcar o estado da peça/i,
)
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem, estado_qualidade)
    values (${cardQ}, 'qualidade_marcada',
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_setores where codigo = 'cnc'),
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface', 'perfeito');
`)
await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem, evento_referencia_id)
     values (${cardQ}, 'movimentacao_setor',
             (select id from public.plt_setores where codigo = 'secc'),
             (select id from public.plt_setores where codigo = 'furacao'),
             (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface',
             (select max(id) from public.plt_eventos where card_id = ${cardQ} and tipo = 'qualidade_marcada'))`,
  'marcação de OUTRA transição não serve — origem e destino precisam bater',
  /desta transição/i,
)

titulo('Qualidade (SESSAO-06): a RPC de mover, o parecer e o DANIFICADO')

// exec.um move SECC → FURAÇÃO pela RPC, marcando 🟡 — tudo numa transação.
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false)`)
const movidoRpc = (
  await bd.query(`
    select public.plt_fn_mover_card(
      ${cardQ},
      (select id from public.plt_setores where codigo = 'furacao'),
      null, 'atencao', 'lasca na quina'
    )::int as id`)
).rows[0]
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)
const aposRpc = (
  await bd.query(`
    select (select codigo from public.plt_setores where id = c.setor_atual_id) as setor,
           c.qualidade_atual,
           (select count(*)::int from public.plt_eventos m
             where m.card_id = ${cardQ} and m.tipo = 'movimentacao_setor'
               and m.evento_referencia_id is not null) as moves_com_marcacao
      from public.plt_cards c where c.id = ${cardQ}`)
).rows[0]
conferir(
  Number.isInteger(movidoRpc?.id) &&
    aposRpc?.setor === 'furacao' &&
    aposRpc?.qualidade_atual === 'atencao' &&
    aposRpc?.moves_com_marcacao === 1,
  'plt_fn_mover_card grava marcação 🟡 + movimentação vinculadas numa transação',
  JSON.stringify(aposRpc ?? null),
)
const notifAtencao = (
  await bd.query(`
    select count(*)::int as total from public.plt_notificacoes n
      join public.plt_usuarios u on u.id = n.destinatario_id
     where n.card_id = ${cardQ} and n.tipo = 'qualidade_atencao' and u.papel = 'admin'`)
).rows[0]
conferir(
  notifAtencao.total >= 1,
  'marcação 🟡 notificou o admin automaticamente, com o relato (Q-18 — critério 4)',
  `vieram ${notifAtencao.total}`,
)

await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
     values (${cardQ}, 'execucao_iniciada',
             (select id from public.plt_usuarios where usuario = 'exec.dois'), 'interface')`,
  'iniciar sem responder o recebimento é impossível (D-09 — critério 2)',
  /confirme o recebimento/i,
)

// O recebedor discorda: entrega dizia 🟡, ele enxerga 🔴 → divergência
// registrada (sem travar), card vai para a etapa DANIFICADO automaticamente.
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id, estado_qualidade)
    values (${cardQ}, 'qualidade_parecer',
            (select id from public.plt_usuarios where usuario = 'exec.dois'), 'interface',
            (select m.evento_referencia_id from public.plt_eventos m
              where m.card_id = ${cardQ} and m.tipo = 'movimentacao_setor'
              order by m.ocorrido_em desc, m.id desc limit 1),
            'danificado');
`)
const aposParecer = (
  await bd.query(`
    select (select e.eh_danificado from public.plt_etapas e where e.id = c.etapa_atual_id) as na_danificado,
           (select count(*)::int from public.plt_eventos a
             where a.card_id = ${cardQ} and a.tipo = 'movimentacao_etapa' and a.origem = 'automacao') as move_automatico,
           (select v.divergente from public.plt_vw_qualidade_transicoes v
             where v.card_id = ${cardQ} and v.evento_parecer_id is not null) as divergente,
           (select count(*)::int from public.plt_notificacoes n
             where n.card_id = ${cardQ} and n.tipo = 'qualidade_divergencia') as avisos_divergencia,
           (select count(*)::int from public.plt_eventos ne
             where ne.card_id = ${cardQ} and ne.tipo = 'notificacao_enviada') as eventos_de_aviso
      from public.plt_cards c where c.id = ${cardQ}`)
).rows[0]
conferir(
  aposParecer?.na_danificado === true && aposParecer?.move_automatico === 1,
  '🔴 registrado pelo recebedor levou o card à etapa DANIFICADO, criada sozinha (D-25 — critério 5)',
  JSON.stringify(aposParecer ?? null),
)
conferir(
  aposParecer?.divergente === true,
  'a view registra os DOIS pareceres com divergência calculada, sem travar o card (critério 3)',
)
conferir(
  (aposParecer?.avisos_divergencia ?? 0) >= 1 && (aposParecer?.eventos_de_aviso ?? 0) >= 2,
  'divergência notificou líder/admin e cada aviso virou evento append-only',
  JSON.stringify(aposParecer ?? null),
)

await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id, estado_qualidade)
     values (${cardQ}, 'qualidade_parecer',
             (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface',
             (select m.evento_referencia_id from public.plt_eventos m
               where m.card_id = ${cardQ} and m.tipo = 'movimentacao_setor'
               order by m.ocorrido_em desc, m.id desc limit 1),
             'perfeito')`,
  'o parecer se registra uma vez só por chegada',
  /uma vez só/i,
)

titulo('Qualidade (SESSAO-06): líder notificado, parecer antigo, API livre')

// FURAÇÃO → FITAMENTO com 🟡: o líder da FITAMENTO (setor que recebe) é
// notificado junto com os admins (D-25).
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem, estado_qualidade)
    values (${cardQ}, 'qualidade_marcada',
            (select id from public.plt_setores where codigo = 'furacao'),
            (select id from public.plt_setores where codigo = 'fitamento'),
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface', 'atencao');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem, evento_referencia_id)
    values (${cardQ}, 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'furacao'),
            (select id from public.plt_setores where codigo = 'fitamento'),
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface',
            (select max(id) from public.plt_eventos where card_id = ${cardQ} and tipo = 'qualidade_marcada'));
`)
const notifLider = (
  await bd.query(`
    select count(*)::int as total from public.plt_notificacoes n
     where n.card_id = ${cardQ} and n.tipo = 'qualidade_atencao'
       and n.destinatario_id = (select id from public.plt_usuarios where usuario = 'lider.fita')`)
).rows[0]
conferir(
  notifLider.total === 1,
  'o líder do setor que recebe foi notificado no 🟡 (D-25 — líderes dos dois setores + admins)',
  `vieram ${notifLider.total}`,
)

// Mover de novo SEM ninguém ter respondido o parecer: permitido — a divergência
// não trava e o parecer só bloqueia o INICIAR (D-09 revisada).
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem, estado_qualidade)
    values (${cardQ}, 'qualidade_marcada',
            (select id from public.plt_setores where codigo = 'fitamento'),
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface', 'perfeito');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem, evento_referencia_id)
    values (${cardQ}, 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'fitamento'),
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface',
            (select max(id) from public.plt_eventos where card_id = ${cardQ} and tipo = 'qualidade_marcada'));
`)
conferir(true, 'mover sem parecer respondido não trava — só o iniciar exige (D-09 revisada)')

await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id, estado_qualidade)
     values (${cardQ}, 'qualidade_parecer',
             (select id from public.plt_usuarios where usuario = 'lider.fita'), 'interface',
             (select m.id from public.plt_eventos m
               where m.card_id = ${cardQ} and m.tipo = 'qualidade_marcada' and m.estado_qualidade = 'atencao'
                 and m.setor_destino_id = (select id from public.plt_setores where codigo = 'fitamento')
               order by m.id desc limit 1),
             'perfeito')`,
  'parecer de chegada antiga é recusado — responde-se só à chegada atual',
  /chegada atual/i,
)

// API move sem estado nenhum (RF-86) — e a chegada em ESTOQUE avisa os admins (D-25).
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, origem)
    values (${cardQ}, 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_setores where codigo = 'estoque'), 'api');
`)
const chegadaEstoque = (
  await bd.query(`
    select (select count(*)::int from public.plt_notificacoes n
             join public.plt_usuarios u on u.id = n.destinatario_id
             where n.card_id = ${cardQ} and n.tipo = 'chegada_estoque' and u.papel = 'admin') as avisos,
           (select codigo from public.plt_setores s
             join public.plt_cards c on c.setor_atual_id = s.id where c.id = ${cardQ}) as setor`)
).rows[0]
conferir(
  chegadaEstoque?.setor === 'estoque' && chegadaEstoque?.avisos >= 1,
  'API move sem exigir estado (critério 5) e a chegada em ESTOQUE notificou os admins (D-25)',
  JSON.stringify(chegadaEstoque ?? null),
)

// ============================================================================
// SESSAO-07 — Gesto por PIN, mensagens sem código e controle de tempo
// (migration 16 / D-27, D-28, D-29)
// ============================================================================
titulo('Tablet (SESSAO-07): autor por PIN nas RPCs e mensagens sem código interno')

// Card novo na SECC para o cenário do tablet.
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, 4, '081', 'Mesa Lateral', 1, 1
      from public.pedidos p where p.numero = 999999;
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    values ((select max(id) from public.plt_cards),
            'card_criado', (select id from public.plt_setores where codigo = 'pcp'), 'interface');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem)
    values ((select max(id) from public.plt_cards), 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'pcp'),
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface');
`)
const cardTablet = (await bd.query(`select max(id)::int as id from public.plt_cards`)).rows[0].id

// A sessão é do "dispositivo" (exec.um, da SECC); o AUTOR é exec.dois,
// identificado por PIN — e exec.dois nem tem login (o cenário real do tablet).
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false)`)

// Mensagem de recusa sem código interno (D-27): mover de produção sem estado.
{
  let mensagem = ''
  try {
    await bd.query(`
      select public.plt_fn_mover_card(
        ${cardTablet}, (select id from public.plt_setores where codigo = 'cnc'))`)
  } catch (erro) {
    mensagem = erro.message
  }
  conferir(
    /marcar o estado da peça/i.test(mensagem) && !/[DQM]-\d|RF-\d|RNF-\d/.test(mensagem),
    'a recusa fala língua de gente — sem D-NN/RF-NN/Q-NN na mensagem (varredura D-27)',
    mensagem,
  )
}

const movidoPorPin = (
  await bd.query(`
    select public.plt_fn_mover_card(
      ${cardTablet},
      (select id from public.plt_setores where codigo = 'cnc'),
      null, 'perfeito', null,
      (select id from public.plt_usuarios where usuario = 'exec.dois')
    )::int as id`)
).rows[0]
const autores = (
  await bd.query(`
    select (select u.usuario from public.plt_usuarios u where u.id = m.usuario_id) as autor_marcacao,
           (select u.usuario from public.plt_usuarios u where u.id = e.usuario_id) as autor_movimentacao
      from public.plt_eventos e
      left join public.plt_eventos m on m.id = e.evento_referencia_id
     where e.id = ${movidoPorPin?.id ?? 0}`)
).rows[0]
conferir(
  autores?.autor_marcacao === 'exec.dois' && autores?.autor_movimentacao === 'exec.dois',
  'RPC com p_operador_id: a marcação e a movimentação saem em nome do OPERADOR do PIN (D-28)',
  JSON.stringify(autores ?? null),
)

// Operador que não trabalha nos setores envolvidos é recusado.
await deveRecusarExec(
  `select public.plt_fn_mover_card(
     ${cardTablet},
     (select id from public.plt_setores where codigo = 'secc'),
     null, 'perfeito', null,
     (select id from public.plt_usuarios where usuario = 'segunda.pessoa'))`,
  'operador de fora dos setores envolvidos não passa pelo gate do PIN',
  /operador identificado não trabalha/i,
)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)

// ============================================================================
// SESSAO-09 — Entrada automática de pedidos (migration 17 / D-31)
// ============================================================================
titulo('Entrada automática (SESSAO-09/D-31): pedido novo, reenvio, conflito e cancelamento')

// As funções kanban têm gate por usuário ativo — o bloco roda como exec.um.
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false)`)

// Pedido novo, isolado (999998) — o INSERT dispara a reação da plataforma.
await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao, data_prevista, total_pedido)
    values (999998, (select id from public.clientes order by id desc limit 1), 'aprovado',
            '2026-09-10', 1000.00);
`)
const cardAuto = (
  await bd.query(`
    select c.id::int as id,
           (select s.codigo from public.plt_setores s where s.id = c.setor_atual_id) as setor
      from public.plt_cards c
     where c.tipo = 'pedido'
       and c.pedido_id = (select id from public.pedidos where numero = 999998)`)
).rows
conferir(
  cardAuto.length === 1 && cardAuto[0].setor === 'pcp',
  'pedido novo em `pedidos` vira card no PCP instantaneamente (critério 1)',
  JSON.stringify(cardAuto),
)
const cardNovePedido = cardAuto[0]?.id

// Reenvio: a integração regrava o pedido inteiro sem mudança real, 3 vezes.
await bd.exec(`
  update public.pedidos set situacao = 'aprovado' where numero = 999998;
  update public.pedidos set situacao = 'aprovado' where numero = 999998;
  update public.pedidos set situacao = 'aprovado' where numero = 999998;
`)
const aposReenvio = (
  await bd.query(`
    select (select count(*)::int from public.plt_cards c
             where c.tipo = 'pedido'
               and c.pedido_id = (select id from public.pedidos where numero = 999998)) as cards,
           (select count(*)::int from public.plt_eventos e
             where e.card_id = ${cardNovePedido ?? 0}
               and e.tipo in ('pedido_atualizado', 'pedido_cancelado')) as eventos_de_mudanca`)
).rows[0]
conferir(
  aposReenvio?.cards === 1 && aposReenvio?.eventos_de_mudanca === 0,
  'o mesmo evento reenviado 3x resulta em 1 card só, sem ruído de eventos (critério 2)',
  JSON.stringify(aposReenvio ?? null),
)

// Mudança real SEM unidade liberada: o card reflete sozinho, nada é registrado.
await bd.exec(`update public.pedidos set data_prevista = '2026-09-15' where numero = 999998;`)
const semLiberacao = (
  await bd.query(`
    select count(*)::int as total from public.plt_eventos
     where card_id = ${cardNovePedido ?? 0} and tipo = 'pedido_atualizado'`)
).rows[0]
conferir(
  semLiberacao?.total === 0,
  'edição antes de liberar unidades não gera evento — o card lê direto do pedido',
  `eventos: ${semLiberacao?.total}`,
)

// Libera uma unidade e edita de novo: agora o conflito fica VISÍVEL.
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, 1, '090', 'Painel Ripado', 1, 1
      from public.pedidos p where p.numero = 999998;
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    values ((select max(id) from public.plt_cards),
            'card_criado', (select id from public.plt_setores where codigo = 'secc'), 'interface');
  update public.pedidos set data_prevista = '2026-09-20', obs = 'cliente mudou a cor'
   where numero = 999998;
`)
const conflito = (
  await bd.query(`
    select (select count(*)::int from public.plt_eventos
             where card_id = ${cardNovePedido ?? 0} and tipo = 'pedido_atualizado') as eventos,
           (select alterado_apos_liberacao from public.plt_fn_pedidos_kanban(
              p_ids => array[(select id from public.pedidos where numero = 999998)])) as na_funcao`)
).rows[0]
conferir(
  (conflito?.eventos ?? 0) >= 1 && conflito?.na_funcao === true,
  'edição com unidade liberada registra o conflito e a função kanban o expõe (critério 3)',
  JSON.stringify(conflito ?? null),
)

// Cancelamento com produção em andamento: evento + aviso aos admins (Q-24/D-31).
await bd.exec(`update public.pedidos set situacao = 'cancelado' where numero = 999998;`)
const cancelamento = (
  await bd.query(`
    select (select count(*)::int from public.plt_eventos
             where card_id = ${cardNovePedido ?? 0} and tipo = 'pedido_cancelado') as evento,
           (select count(*)::int from public.plt_notificacoes n
             join public.plt_usuarios u on u.id = n.destinatario_id
            where n.card_id = ${cardNovePedido ?? 0} and n.tipo = 'pedido_cancelado'
              and u.papel = 'admin') as avisos,
           (select count(*)::int from public.plt_cards c
             where c.pedido_id = (select id from public.pedidos where numero = 999998)
               and c.tipo = 'pedido') as card_continua,
           (select situacao from public.plt_fn_pedidos_kanban(
              p_ids => array[(select id from public.pedidos where numero = 999998)])) as situacao_na_funcao`)
).rows[0]
conferir(
  cancelamento?.evento === 1 &&
    (cancelamento?.avisos ?? 0) >= 1 &&
    cancelamento?.card_continua === 1 &&
    cancelamento?.situacao_na_funcao === 'cancelado',
  'cancelamento no Tiny: card marcado (não some), evento na história e admins avisados',
  JSON.stringify(cancelamento ?? null),
)

// Pedido HISTÓRICO (existia antes da migration, sem card): atualização não
// cria nada. Simulado inserindo com triggers desligados (superusuário do
// PGlite), como um pedido que já estava lá.
await bd.exec(`
  set session_replication_role = replica;
  insert into public.pedidos (numero, cliente_id, situacao)
    values (999997, (select id from public.clientes order by id desc limit 1), 'entregue');
  set session_replication_role = origin;
  update public.pedidos set obs = 'toque em pedido histórico' where numero = 999997;
`)
const historico = (
  await bd.query(`
    select count(*)::int as total from public.plt_cards
     where tipo = 'pedido'
       and pedido_id = (select id from public.pedidos where numero = 999997)`)
).rows[0]
conferir(
  historico.total === 0,
  'pedido histórico atualizado NÃO ganha card — só a chegada nova cria (D-31)',
  `cards: ${historico.total}`,
)

// A regra de ouro: o trigger jamais derruba a integração. Simula falha interna
// forçando um estado impossível? Não dá para quebrar de fora — o que se prova
// aqui é que o caminho da integração (upsert-like: update + delete/insert de
// itens) continua passando com o trigger ligado.
await bd.exec(`
  update public.pedidos set total_pedido = 1200.00 where numero = 999998;
  delete from public.pedido_itens where pedido_id = (select id from public.pedidos where numero = 999998);
`)
conferir(true, 'caminho da integração (update + regravação de itens) segue passando com o trigger ligado')
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)

titulo('Controle de tempo do admin (SESSAO-07/D-29): horários, pausas e tempo útil')

// 2026-08-24 foi segunda-feira (dow = 1) em America/Fortaleza.
const tempoUtil = async (expr) =>
  (await bd.query(`select extract(epoch from ${expr})::int as s`)).rows[0].s

const cheio = await tempoUtil(`plt_privado.fn_tempo_util(
  '2026-08-24 10:00:00-03', '2026-08-24 14:00:00-03',
  (select id from public.plt_setores where codigo = 'secc'), null)`)
conferir(cheio === 4 * 3600, 'sem horário e sem pausa, o tempo conta inteiro', `veio ${cheio}s`)

await bd.exec(`
  insert into public.plt_horarios_funcionamento (escopo, setor_id, dia_semana, hora_inicio, hora_fim)
    values ('setor', (select id from public.plt_setores where codigo = 'secc'), 1, '08:00', '12:00');
`)
const soManha = await tempoUtil(`plt_privado.fn_tempo_util(
  '2026-08-24 10:00:00-03', '2026-08-24 14:00:00-03',
  (select id from public.plt_setores where codigo = 'secc'), null)`)
conferir(
  soManha === 2 * 3600,
  'horário do setor (seg 08–12): das 10h às 14h contam só 2h',
  `veio ${soManha}s`,
)

await bd.exec(`
  insert into public.plt_pausas_tempo (escopo, setor_id, inicio, fim, retroativa, motivo, criado_por)
    values ('setor', (select id from public.plt_setores where codigo = 'secc'),
            '2026-08-24 10:30:00-03', '2026-08-24 11:00:00-03', true,
            'setor não funcionou (correção retroativa)',
            (select id from public.plt_usuarios where usuario = 'exec.um'));
`)
const comPausa = await tempoUtil(`plt_privado.fn_tempo_util(
  '2026-08-24 10:00:00-03', '2026-08-24 14:00:00-03',
  (select id from public.plt_setores where codigo = 'secc'), null)`)
conferir(
  comPausa === Math.round(1.5 * 3600),
  'pausa retroativa do setor (10:30–11:00) desconta sem tocar nos eventos',
  `veio ${comPausa}s`,
)

await bd.exec(`
  insert into public.plt_horarios_funcionamento (escopo, usuario_id, dia_semana, hora_inicio, hora_fim)
    values ('usuario', (select id from public.plt_usuarios where usuario = 'exec.dois'), 1, '09:00', '11:00');
`)
const intersecao = await tempoUtil(`plt_privado.fn_tempo_util(
  '2026-08-24 10:00:00-03', '2026-08-24 14:00:00-03',
  (select id from public.plt_setores where codigo = 'secc'),
  (select id from public.plt_usuarios where usuario = 'exec.dois'))`)
conferir(
  intersecao === Math.round(0.5 * 3600),
  'horário do setor ∩ horário da pessoa ∩ pausa: sobra exatamente a meia hora certa',
  `veio ${intersecao}s`,
)

const eventosIntactos = (
  await bd.query(`
    select count(*)::int as total from public.plt_eventos
     where card_id = ${cardTablet}`)
).rows[0]
conferir(
  eventosIntactos.total >= 3,
  'nada do controle de tempo tocou nos eventos registrados (dado fixo — D-29)',
  `eventos do card: ${eventosIntactos.total}`,
)

// ============================================================================
// SESSAO-11 — API, webhooks e ROTAS (migration 19 / D-33)
// ============================================================================
titulo('API e webhooks (SESSAO-11): chaves, arquivamento lógico e fila de saída')

// Chave de API: a tabela guarda só hash + prefixo; RLS de admin (provado pelo desenho — PGlite roda como superusuário).
await bd.exec(`
  insert into public.plt_chaves_api (nome, hash, prefixo, escopo)
    values ('n8n de teste', 'hash-de-teste-nao-e-o-valor', 'pltk_abc', 'escrita');
`)
conferir(true, 'chave de API cadastrada com hash e prefixo (o valor em claro nunca fica)')

// Webhook assinando card_criado: o próximo evento entra na fila com payload completo.
await bd.exec(`
  insert into public.plt_webhooks (nome, url, eventos, ativo)
    values ('eco de teste', 'https://exemplo.invalido/webhook', '{card_criado}', true);
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, 5, '077', 'Aparador Retro', 1, 1
      from public.pedidos p where p.numero = 999999;
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    values ((select max(id) from public.plt_cards),
            'card_criado', (select id from public.plt_setores where codigo = 'secc'), 'interface');
`)
const cardArquivavel = (await bd.query(`select max(id)::int as id from public.plt_cards`)).rows[0].id
const filaWebhook = (
  await bd.query(`
    select count(*)::int as total,
           bool_and(payload ? 'tipo' and payload ? 'card') as payload_completo
      from public.plt_webhook_entregas`)
).rows[0]
conferir(
  filaWebhook.total >= 1 && filaWebhook.payload_completo === true,
  'evento assinado entrou na fila de webhooks com payload completo (RF-52)',
  JSON.stringify(filaWebhook),
)
const despacho = (
  await bd.query(`select plt_privado.fn_despachar_webhooks()::int as enviados`)
).rows[0]
conferir(
  despacho.enviados === 0,
  'despacho sem pg_net não quebra — devolve 0 e espera a produção (guarda de ambiente)',
  `enviados: ${despacho.enviados}`,
)

// Arquivamento lógico: operador não pode; admin pode; card some das leituras.
await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
     values (${cardArquivavel}, 'card_arquivado',
             (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface')`,
  'operador não arquiva card — gesto de admin ou da integração',
  /gesto de admin ou da integração/i,
)
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, origem)
    values (${cardArquivavel}, 'card_arquivado', 'api');
`)
const arquivado = (
  await bd.query(`
    select (select arquivado_em is not null from public.plt_cards where id = ${cardArquivavel}) as marcado,
           (select count(*)::int from public.plt_cards
             where id = ${cardArquivavel}) as linha_continua`)
).rows[0]
conferir(
  arquivado?.marcado === true && arquivado?.linha_continua === 1,
  'card_arquivado projeta arquivado_em sem apagar nada (o "excluir" da API)',
  JSON.stringify(arquivado ?? null),
)

titulo('ROTAS na plataforma (SESSAO-11/D-33): entrega por pedido completo')

// Pedido novo isolado com 2 unidades a produzir.
await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao)
    values (999995, (select id from public.clientes order by id desc limit 1), 'aprovado');
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
    values ((select id from public.pedidos where numero = 999995), 1, '055', 'Rack Duo', 2);
`)
const cardRotas = (
  await bd.query(`
    select id::int as id from public.plt_cards
     where tipo = 'pedido' and pedido_id = (select id from public.pedidos where numero = 999995)`)
).rows[0].id

// Duas unidades liberadas; uma chega na ROTAS.
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, 1, '055', 'Rack Duo', n, 2
      from public.pedidos p, generate_series(1, 2) n where p.numero = 999995;
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    select c.id, 'card_criado', (select id from public.plt_setores where codigo = 'secc'), 'interface'
      from public.plt_cards c
     where c.pedido_id = (select id from public.pedidos where numero = 999995) and c.tipo = 'unidade';
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, origem)
    select min(c.id), 'movimentacao_setor',
           (select id from public.plt_setores where codigo = 'secc'),
           (select id from public.plt_setores where codigo = 'rotas'), 'api'
      from public.plt_cards c
     where c.pedido_id = (select id from public.pedidos where numero = 999995) and c.tipo = 'unidade';
`)

// O admin de teste ganha auth aqui (o bloco da SESSAO-10, mais abaixo, repete
// o update — idempotente).
await bd.exec(`
  update public.plt_usuarios set auth_user_id = '00000000-0000-0000-0000-000000000001'
   where usuario = 'primeira.pessoa';
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
`)
// SESSAO-15 (D-45) revisou a regra da S11: só o LANÇADO pelos Pedidos em
// aguardo aparece nas ROTAS — estar no setor ROTAS não basta mais.
const rotasParcial = (
  await bd.query(`select situacao_entrega from public.plt_fn_rotas() where numero = 999995`)
).rows[0]
conferir(
  rotasParcial === undefined,
  'pedido com unidade na ROTAS mas NÃO lançado não aparece nas ROTAS (D-45)',
  JSON.stringify(rotasParcial ?? null),
)
const aguardoParcial = (
  await bd.query(`
    select unidades_prontas, total_unidades, completo
      from public.plt_fn_pedidos_aguardo() where numero = 999995`)
).rows[0]
conferir(
  aguardoParcial?.unidades_prontas === 1 && aguardoParcial?.total_unidades === 2 && aguardoParcial?.completo === false,
  'pedido incompleto aparece nos Pedidos em aguardo com (1/2) e sem a marca de completo (D-38)',
  JSON.stringify(aguardoParcial ?? null),
)

await deveRecusarExec(
  `select public.plt_fn_registrar_entrega(${cardRotas})`,
  'entrega recusada sem lançamento — "lance pelos Pedidos em aguardo"',
  /ainda não foi lançado/i,
)
await deveRecusarExec(
  `select public.plt_fn_lancar_rotas(${cardRotas})`,
  'lançar pedido incompleto é recusado — "não vamos entregar 10 se ele pediu 30"',
  /pedido completo/i,
)

// A segunda unidade chega; o pedido completa, é lançado e a entrega passa a
// ser possível — registrada uma vez só.
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, origem)
    select max(c.id), 'movimentacao_setor',
           (select id from public.plt_setores where codigo = 'secc'),
           (select id from public.plt_setores where codigo = 'rotas'), 'api'
      from public.plt_cards c
     where c.pedido_id = (select id from public.pedidos where numero = 999995) and c.tipo = 'unidade';
`)
const aguardoCompleto = (
  await bd.query(`select completo from public.plt_fn_pedidos_aguardo() where numero = 999995`)
).rows[0]
conferir(aguardoCompleto?.completo === true, 'com todas as unidades prontas o pedido ganha a marca de completo')
await bd.exec(`select public.plt_fn_lancar_rotas(${cardRotas})`)
const pronta = (
  await bd.query(`
    select situacao_entrega, unidades_em_rotas, lancado_em is not null as lancado
      from public.plt_fn_rotas() where numero = 999995`)
).rows[0]
conferir(
  pronta?.situacao_entrega === 'pronta' && pronta?.unidades_em_rotas === 2 && pronta?.lancado === true,
  'pedido lançado aparece nas ROTAS como "pronta" com as 2 unidades no setor',
  JSON.stringify(pronta ?? null),
)
const aguardoDepois = (
  await bd.query(`select count(*)::int as total from public.plt_fn_pedidos_aguardo() where numero = 999995`)
).rows[0]
conferir(aguardoDepois.total === 0, 'depois de lançado, o pedido sai dos Pedidos em aguardo')
await deveRecusarExec(
  `select public.plt_fn_lancar_rotas(${cardRotas})`,
  'lançar duas vezes é recusado',
  /já foi lançado/i,
)

await bd.exec(`select public.plt_fn_registrar_entrega(${cardRotas}, 'entregue no teste')`)
const entregue = (
  await bd.query(`
    select (select situacao_entrega from public.plt_fn_rotas() where numero = 999995) as situacao,
           (select count(*)::int from public.plt_eventos
             where card_id = ${cardRotas} and tipo = 'pedido_entregue') as eventos`)
).rows[0]
conferir(
  entregue?.situacao === 'entregue' && entregue?.eventos === 1,
  'registrar entrega grava o evento append-only e o pedido vira "entregue"',
  JSON.stringify(entregue ?? null),
)
await deveRecusarExec(
  `select public.plt_fn_registrar_entrega(${cardRotas})`,
  'entregar duas vezes é recusado',
  /já foi registrado/i,
)

// Gate: operador de produção não vê rotas nem registra entrega.
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false)`)
const rotasOperador = (
  await bd.query(`select count(*)::int as total from public.plt_fn_rotas()`)
).rows[0]
conferir(rotasOperador.total === 0, 'operador de produção não enxerga as rotas (gate da logística)')
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)

// ============================================================================
// SESSAO-12 — Tarefas e delegação (migration 20 / D-34)
// ============================================================================
titulo('Delegação (SESSAO-12/D-34): sorteio entre logados, balanceado e auditável')

// SECC entra em modo aleatório; exec.um e exec.dois estão "logados" (heartbeat).
await bd.exec(`
  update public.plt_setores set modo_delegacao = 'aleatoria'
   where codigo = 'secc';
  insert into public.plt_presencas (usuario_id, visto_em) values
    ((select id from public.plt_usuarios where usuario = 'exec.um'),  now() - interval '2 minutes'),
    ((select id from public.plt_usuarios where usuario = 'exec.dois'), now() - interval '1 minute')
  on conflict (usuario_id) do update set visto_em = excluded.visto_em;
`)

// 5 cards chegam no SECC — o sorteio distribui na chegada.
await bd.exec(`
  do $$
  declare
    i int;
    v_card bigint;
  begin
    for i in 1..5 loop
      insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
        select 'unidade', p.id, 50 + i, 'SORT', 'Peça do sorteio ' || i, 1, 1
          from public.pedidos p where p.numero = 999999
        returning id into v_card;
      insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
        values (v_card, 'card_criado', (select id from public.plt_setores where codigo = 'secc'), 'api');
    end loop;
  end;
  $$;
`)
const sorteio = (
  await bd.query(`
    select u.usuario, count(*)::int as cards
      from public.plt_cards c
      join public.plt_usuarios u on u.id = c.responsavel_id
     where c.item_codigo = 'SORT'
     group by u.usuario order by u.usuario`)
).rows
const totalSorteado = sorteio.reduce((soma, l) => soma + l.cards, 0)
const diferenca =
  sorteio.length === 2 ? Math.abs(sorteio[0].cards - sorteio[1].cards) : 99
conferir(
  totalSorteado === 5 && sorteio.length === 2 && diferenca <= 1,
  '5 cards chegando são distribuídos balanceadamente entre os 2 logados (critério 1)',
  JSON.stringify(sorteio),
)
const naoLogado = (
  await bd.query(`
    select count(*)::int as total from public.plt_cards c
      join public.plt_usuarios u on u.id = c.responsavel_id
     where c.item_codigo = 'SORT' and u.usuario not in ('exec.um', 'exec.dois')`)
).rows[0]
conferir(naoLogado.total === 0, 'quem não está logado nunca é sorteado (D-34)')

// Reatribuição direta pelo admin: o histórico guarda as DUAS delegações.
const cardSorteado = (
  await bd.query(`select min(id)::int as id from public.plt_cards where item_codigo = 'SORT'`)
).rows[0].id
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, dados)
    values (${cardSorteado}, 'delegacao',
            (select id from public.plt_usuarios where usuario = 'primeira.pessoa'), 'interface',
            jsonb_build_object('responsavel_id',
              (select id from public.plt_usuarios where usuario = 'lider.fita'), 'modo', 'direta'));
`)
const reatribuicao = (
  await bd.query(`
    select (select count(*)::int from public.plt_eventos
             where card_id = ${cardSorteado} and tipo = 'delegacao') as delegacoes,
           (select u.usuario from public.plt_cards c
             join public.plt_usuarios u on u.id = c.responsavel_id
            where c.id = ${cardSorteado}) as responsavel_atual`)
).rows[0]
conferir(
  reatribuicao?.delegacoes === 2 && reatribuicao?.responsavel_atual === 'lider.fita',
  'reatribuição registra as duas delegações e projeta a última (critério 2)',
  JSON.stringify(reatribuicao ?? null),
)

await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, origem, dados)
     values (${cardSorteado}, 'delegacao',
             (select id from public.plt_usuarios where usuario = 'exec.dois'), 'interface',
             jsonb_build_object('responsavel_id',
               (select id from public.plt_usuarios where usuario = 'exec.um')))`,
  'operador comum não delega — gesto do líder do setor ou de admin',
  /gesto do líder do setor ou de admin/i,
)

// Modo por setor é independente: CNC continua desativado → chegada sem dono.
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, origem)
    values (${cardSorteado}, 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_setores where codigo = 'cnc'), 'api');
`)
const noCnc = (
  await bd.query(`select responsavel_id from public.plt_cards where id = ${cardSorteado}`)
).rows[0]
conferir(
  noCnc?.responsavel_id === null,
  'setor em modo desativado: chegada fica sem dono (e mudar de setor zera a delegação anterior) — critério 4',
)

// O sorteado é avisado no sino.
const avisoDelegacao = (
  await bd.query(`
    select count(*)::int as total from public.plt_notificacoes
     where tipo = 'delegacao'`)
).rows[0]
conferir(avisoDelegacao.total >= 2, 'delegação (sorteio e direta) avisa o novo responsável no sino')

// Tarefa avulsa: timer OPCIONAL (D-34) — concluir sem iniciar é normal.
await bd.exec(`
  insert into public.plt_tarefas (titulo, setor_id, responsavel_id, criada_por_id, delegacao)
    values ('Engraxar caixas de cola',
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_usuarios where usuario = 'exec.um'),
            (select id from public.plt_usuarios where usuario = 'primeira.pessoa'), 'direta');
  update public.plt_tarefas set situacao = 'concluida', concluida_em = now()
   where titulo = 'Engraxar caixas de cola';
`)
const tarefa = (
  await bd.query(`
    select situacao, iniciada_em from public.plt_tarefas
     where titulo = 'Engraxar caixas de cola'`)
).rows[0]
conferir(
  tarefa?.situacao === 'concluida' && tarefa?.iniciada_em === null,
  'tarefa avulsa concluída SEM iniciar tempo — o timer é opcional (D-34)',
)

// ============================================================================
// SESSAO-10 — Dashboards (migration 18 / D-32)
// ============================================================================
titulo('Dashboards (SESSAO-10/D-32): números batem, gate por papel')

await bd.exec(`
  update public.plt_usuarios set auth_user_id = '00000000-0000-0000-0000-000000000001'
   where usuario = 'primeira.pessoa';
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
`)
const PERIODO = `'2020-01-01'::timestamptz, '2030-01-01'::timestamptz`

// O critério de aceite: o número da dash bate com a soma manual dos eventos.
const somaManual = (
  await bd.query(`
    select coalesce(extract(epoch from sum(v.duracao)), 0)::int as s
      from public.plt_vw_execucoes v
     where v.setor_id = (select id from public.plt_setores where codigo = 'secc')`)
).rows[0].s
const somaDash = (
  await bd.query(`
    select coalesce(extract(epoch from execucao_bruta), 0)::int as s
      from public.plt_fn_dash_tempos_setor(${PERIODO})
     where setor_nome = 'SECC'`)
).rows[0]?.s
conferir(
  somaDash !== undefined && Math.abs(somaDash - somaManual) <= 1,
  'execução por setor na dash BATE com a soma manual dos eventos (critério 1)',
  `dash=${somaDash}s manual=${somaManual}s`,
)

const detalhe = (
  await bd.query(`
    select count(*)::int as total,
           count(*) filter (where executor_nome is not null)::int as com_nome,
           count(*) filter (where duracao_util is not null)::int as com_util
      from public.plt_fn_dash_execucoes(${PERIODO})`)
).rows[0]
conferir(
  detalhe.total >= 3 && detalhe.com_nome === detalhe.total && detalhe.com_util === detalhe.total,
  'a lista detalhada de execuções sai com nomes e duração útil (D-29/D-32)',
  JSON.stringify(detalhe),
)

const qualidadeDash = (
  await bd.query(`
    select entregues_atencao, divergencias_contra
      from public.plt_fn_dash_qualidade(${PERIODO})
     where setor_nome = 'SECC'`)
).rows[0]
conferir(
  (qualidadeDash?.entregues_atencao ?? 0) >= 1 && (qualidadeDash?.divergencias_contra ?? 0) >= 1,
  'qualidade por setor: SECC mostra o 🟡 entregue e a divergência contra (RF-85)',
  JSON.stringify(qualidadeDash ?? null),
)

const estoqueDash = (
  await bd.query(`select cards_parados from public.plt_fn_dash_estoque()`)
).rows[0]
conferir(
  (estoqueDash?.cards_parados ?? 0) >= 1,
  'tempo parado no estoque aparece para o admin (RF-14)',
  JSON.stringify(estoqueDash ?? null),
)

// Gate D-32: o líder da FITAMENTO vê só a FITAMENTO; operador não vê nada.
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false)`)
const setoresDoLider = (
  await bd.query(`select setor_nome from public.plt_fn_dash_tempos_setor(${PERIODO})`)
).rows.map((r) => r.setor_nome)
conferir(
  setoresDoLider.length === 1 && setoresDoLider[0] === 'FITAMENTO',
  'líder enxerga SÓ o próprio setor na dash (critério 4)',
  setoresDoLider.join(' · ') || 'vazio',
)

await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false)`)
const dashOperador = (
  await bd.query(`select count(*)::int as total from public.plt_fn_dash_execucoes(${PERIODO})`)
).rows[0]
conferir(
  dashOperador.total === 0,
  'operador não enxerga dashboard nenhum (D-32)',
  `linhas: ${dashOperador.total}`,
)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)

titulo('Registro de atividade (SESSAO-13/D-40): tudo vira log, e log não se apaga')

// 1 · O que já aconteceu no cenário inteiro deixou trilha sozinho (triggers).
const logsDeEvento = (
  await bd.query(`
    select
      (select count(*)::int from public.plt_logs_atividade where acao = 'card_criado') as cards,
      (select count(*)::int from public.plt_logs_atividade where acao like 'tarefa%') as tarefas,
      (select count(*)::int from public.plt_logs_atividade where acao = 'movimentacao_setor') as movimentacoes`)
).rows[0]
conferir(
  logsDeEvento.cards >= 1 && logsDeEvento.tarefas >= 1 && logsDeEvento.movimentacoes >= 1,
  'as mutações do cenário viraram log sozinhas (eventos e tarefas → trilha)',
  JSON.stringify(logsDeEvento),
)

// 2 · Append-only de verdade: nem UPDATE nem DELETE, nem para o superusuário.
async function deveRecusarLog(sql, descricao) {
  try {
    await bd.exec(sql)
    conferir(false, descricao, 'a operação passou, e não devia')
  } catch (erro) {
    conferir(/trilha de auditoria/i.test(erro.message), descricao, erro.message)
  }
}
await deveRecusarLog(
  `update public.plt_logs_atividade set acao = 'adulterado'`,
  'UPDATE em log de atividade é recusado',
)
await deveRecusarLog(
  `delete from public.plt_logs_atividade`,
  'DELETE em log de atividade é recusado',
)

// 3 · A porta do navegador: navegação registrada em nome de quem navegou.
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false)`)
await bd.exec(`select public.plt_fn_registrar_log('navegacao', '/inicio/meu-painel')`)
const logNavegacao = (
  await bd.query(`
    select l.rota, u.usuario
      from public.plt_logs_atividade l
      join public.plt_usuarios u on u.id = l.usuario_id
     where l.acao = 'navegacao'
     order by l.id desc limit 1`)
).rows[0]
conferir(
  logNavegacao?.rota === '/inicio/meu-painel' && logNavegacao?.usuario != null,
  'navegação do navegador entra na trilha com o autor (plt_fn_registrar_log)',
  JSON.stringify(logNavegacao ?? null),
)

// 4 · Sem sessão, a porta recusa — ninguém registra em nome de ninguém.
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)
await deveRecusar(
  `select public.plt_fn_registrar_log('navegacao', '/qualquer')`,
  'registrar atividade sem sessão é recusado',
  /sem cadastro ativo/i,
)

titulo('Meu Perfil (SESSAO-13/D-41/D-43): tema com 8 opções e trilha da troca')
await deveRecusar(
  `update public.plt_usuarios set tema = 'roxo-fora-da-paleta'
    where auth_user_id = '00000000-0000-0000-0000-000000000012'`,
  'tema fora dos 8 esquemas Domoby é recusado',
  /plt_usuarios_tema_ck/i,
)
await bd.exec(`
  update public.plt_usuarios set tema = 'meia-noite'
   where auth_user_id = '00000000-0000-0000-0000-000000000012'
`)
const logTema = (
  await bd.query(`
    select contexto->'campos' as campos from public.plt_logs_atividade
     where acao = 'tema_alterado' order by id desc limit 1`)
).rows[0]
conferir(
  logTema !== undefined,
  'trocar o tema grava o log tema_alterado (só o campo, nunca o valor sensível)',
  JSON.stringify(logTema ?? null),
)

// ============================================================================
// SESSAO-14 — Meu Painel e Metas (migrations 23 e 24 / D-37)
// Lembrete E-14: RLS/grants não se provam no PGlite — aqui se provam os
// triggers (valem para todos), o cálculo de progresso e os gates das funções.
// ============================================================================
titulo('Metas (SESSAO-14/D-37): cadastro, história e regras de trigger')

// Gente e card frescos para o cenário ter contagem determinística.
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel) values
    ('Meta Um',   'meta1@teste.com', '22222222201', 'meta.um',   'operador'),
    ('Meta Dois', 'meta2@teste.com', '22222222202', 'meta.dois', 'operador');
  insert into public.plt_usuario_setores (usuario_id, setor_id) values
    ((select id from public.plt_usuarios where usuario = 'meta.um'),
     (select id from public.plt_setores where codigo = 'cnc')),
    ((select id from public.plt_usuarios where usuario = 'meta.dois'),
     (select id from public.plt_setores where codigo = 'cnc'));
`)

await deveRecusar(
  `insert into public.plt_metas (indicador, periodo, alvo, usuario_id, setor_id)
     values ('unidades', 'diaria', 5,
             (select id from public.plt_usuarios where usuario = 'meta.um'),
             (select id from public.plt_setores where codigo = 'cnc'))`,
  'meta com DOIS donos (pessoa E setor) é recusada',
  /plt_metas_dono_ck/i,
)
await deveRecusar(
  `insert into public.plt_metas (indicador, periodo, alvo)
     values ('unidades', 'diaria', 5)`,
  'meta sem dono nenhum é recusada',
  /plt_metas_dono_ck/i,
)
await deveRecusar(
  `insert into public.plt_metas (indicador, periodo, alvo, usuario_id)
     values ('unidades', 'diaria', 0,
             (select id from public.plt_usuarios where usuario = 'meta.um'))`,
  'meta com alvo zero é recusada',
  /alvo/i,
)

await bd.exec(`
  insert into public.plt_metas (titulo, indicador, periodo, alvo, usuario_id, criada_por_id)
    values ('Unidades do dia', 'unidades', 'diaria', 5,
            (select id from public.plt_usuarios where usuario = 'meta.um'),
            (select id from public.plt_usuarios where usuario = 'primeira.pessoa'));
  insert into public.plt_metas (titulo, indicador, periodo, alvo, setor_id, criada_por_id)
    values ('CNC da semana', 'unidades', 'semanal', 40,
            (select id from public.plt_setores where codigo = 'cnc'),
            (select id from public.plt_usuarios where usuario = 'primeira.pessoa'));
  insert into public.plt_metas (titulo, indicador, periodo, alvo, usuario_id, criada_por_id)
    values ('Tarefas do mês', 'tarefas', 'mensal', 10,
            (select id from public.plt_usuarios where usuario = 'meta.um'),
            (select id from public.plt_usuarios where usuario = 'primeira.pessoa'));
  insert into public.plt_metas (titulo, indicador, periodo, alvo, usuario_id, criada_por_id)
    values ('Horas úteis', 'tempo_util', 'semanal', 40,
            (select id from public.plt_usuarios where usuario = 'meta.um'),
            (select id from public.plt_usuarios where usuario = 'primeira.pessoa'));
`)
const historiaCriacao = (
  await bd.query(`
    select
      (select count(*)::int from public.plt_metas_eventos where tipo = 'meta_criada') as eventos,
      (select count(*)::int from public.plt_logs_atividade where acao = 'meta_criada') as logs`)
).rows[0]
conferir(
  historiaCriacao.eventos === 4 && historiaCriacao.logs === 4,
  'toda meta criada vira história (plt_metas_eventos) E trilha de atividade (D-40)',
  JSON.stringify(historiaCriacao),
)

titulo('Metas: progresso calculado dos eventos, nunca digitado (critério 2)')

// O cenário: card no CNC; meta.um inicia, meta.dois assume (fecha a de um —
// transferência CONTA, resposta do dono 01/09), meta.dois finaliza.
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, 3, '073', 'Cômoda Slim', 2, 2
      from public.pedidos p where p.numero = 999999;
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    values ((select max(id) from public.plt_cards),
            'card_criado', (select id from public.plt_setores where codigo = 'pcp'), 'interface');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, origem)
    values ((select max(id) from public.plt_cards), 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'pcp'),
            (select id from public.plt_setores where codigo = 'cnc'), 'interface');
`)
const cardMeta = (await bd.query(`select max(id)::int as id from public.plt_cards`)).rows[0].id
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
    values (${cardMeta}, 'execucao_iniciada',
            (select id from public.plt_usuarios where usuario = 'meta.um'), 'interface');
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
    values (${cardMeta}, 'execucao_iniciada',
            (select id from public.plt_usuarios where usuario = 'meta.dois'), 'interface');
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
    values (${cardMeta}, 'execucao_finalizada',
            (select id from public.plt_usuarios where usuario = 'meta.dois'), 'interface');
`)
// Tarefa concluída do meta.um alimenta a meta de tarefas.
await bd.exec(`
  insert into public.plt_tarefas (titulo, setor_id, responsavel_id, criada_por_id, delegacao)
    values ('Afiar fresas', (select id from public.plt_setores where codigo = 'cnc'),
            (select id from public.plt_usuarios where usuario = 'meta.um'),
            (select id from public.plt_usuarios where usuario = 'primeira.pessoa'), 'direta');
  update public.plt_tarefas set situacao = 'concluida', concluida_em = now()
   where titulo = 'Afiar fresas';
`)

// O painel com os olhos do meta.um (a porta tem gate interno).
await bd.exec(`
  update public.plt_usuarios set auth_user_id = '00000000-0000-0000-0000-000000000021'
   where usuario = 'meta.um';
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', false);
`)
const painel = (
  await bd.query(`
    select titulo, indicador, periodo, progresso::float as progresso,
           janela_inicio is not null as tem_janela
      from public.plt_fn_metas_painel() order by titulo`)
).rows
const porTitulo = Object.fromEntries(painel.map((m) => [m.titulo, m]))
conferir(
  painel.length === 4 && painel.every((m) => m.tem_janela),
  'meta.um vê as 4 metas (3 pessoais + a do setor dele — membro vê, dono 01/09), todas com janela',
  JSON.stringify(painel.map((m) => m.titulo)),
)
conferir(
  porTitulo['Unidades do dia']?.progresso === 1,
  'transferência CONTA como unidade concluída de quem entregou o card (dono 01/09)',
  `progresso=${porTitulo['Unidades do dia']?.progresso}`,
)
conferir(
  porTitulo['CNC da semana']?.progresso === 2,
  'meta do SETOR soma as execuções encerradas de todo mundo no setor (1+1)',
  `progresso=${porTitulo['CNC da semana']?.progresso}`,
)
conferir(
  porTitulo['Tarefas do mês']?.progresso === 1,
  'concluir tarefa move a meta de tarefas sozinha',
  `progresso=${porTitulo['Tarefas do mês']?.progresso}`,
)
conferir(
  typeof porTitulo['Horas úteis']?.progresso === 'number',
  'meta de tempo útil responde em horas (D-29 — execuções de instantes ≈ 0h)',
  `progresso=${porTitulo['Horas úteis']?.progresso}`,
)

// Quem não tem relação com as metas não vê nada; sem sessão, idem.
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false)`)
const painelDeFora = (
  await bd.query(`select count(*)::int as total from public.plt_fn_metas_painel()`)
).rows[0]
conferir(
  painelDeFora.total === 0,
  'operador de outro setor não vê metas alheias (gate da porta)',
  `vieram ${painelDeFora.total}`,
)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)
const painelSemSessao = (
  await bd.query(`select count(*)::int as total from public.plt_fn_metas_painel()`)
).rows[0]
conferir(
  painelSemSessao.total === 0,
  'sem usuário no contexto, o cockpit devolve vazio (gate)',
  `vieram ${painelSemSessao.total}`,
)

titulo('Metas: encerrar é definitivo, dono não muda, história não se apaga')
await bd.exec(`
  update public.plt_metas set encerrada_em = now()
   where titulo = 'Tarefas do mês';
`)
const encerrada = (
  await bd.query(`
    select count(*)::int as eventos
      from public.plt_metas_eventos where tipo = 'meta_encerrada'`)
).rows[0]
conferir(encerrada.eventos === 1, 'encerrar meta grava meta_encerrada na história', JSON.stringify(encerrada))
await deveRecusar(
  `update public.plt_metas set alvo = 99 where titulo = 'Tarefas do mês'`,
  'meta encerrada não se edita — cria-se outra',
  /já foi encerrada/i,
)
await deveRecusar(
  `update public.plt_metas set usuario_id = (select id from public.plt_usuarios where usuario = 'meta.dois')
    where titulo = 'Unidades do dia'`,
  'o dono da meta não muda depois de criada',
  /dono da meta/i,
)
await bd.exec(`update public.plt_metas set alvo = 6 where titulo = 'Unidades do dia'`)
const alterada = (
  await bd.query(`
    select dados->>'alvo_antes' as antes, dados->>'alvo_depois' as depois
      from public.plt_metas_eventos where tipo = 'meta_alterada' order by id desc limit 1`)
).rows[0]
conferir(
  alterada?.antes === '5.00' && alterada?.depois === '6.00',
  'alterar o alvo grava antes/depois na história',
  JSON.stringify(alterada ?? null),
)
await deveRecusar(
  `update public.plt_metas_eventos set dados = '{}'::jsonb`,
  'UPDATE na história de metas é recusado',
  /histórico de metas/i,
)
await deveRecusar(
  `delete from public.plt_metas_eventos`,
  'DELETE na história de metas é recusado',
  /histórico de metas/i,
)

titulo('Espelho da blindagem do backfill (migration 24 / nota do esquema)')
const gatilhosPedidos = (
  await bd.query(`
    select tgname from pg_trigger
     where tgrelid = 'public.pedidos'::regclass and tgname like 'plt_pedidos%'
     order by tgname`)
).rows.map((r) => r.tgname)
conferir(
  gatilhosPedidos.join(',') === 'plt_pedidos_reagir_atualizacao,plt_pedidos_reagir_insercao',
  'os DOIS gatilhos com guarda existem e o antigo gatilho único morreu',
  gatilhosPedidos.join(' · '),
)
await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao, origem)
    values (999899, (select id from public.clientes order by id limit 1), 'aprovado', 'backfill');
  insert into public.pedidos (numero, cliente_id, situacao)
    values (999898, (select id from public.clientes order by id limit 1), 'entregue');
`)
const blindagem = (
  await bd.query(`
    select count(*)::int as total from public.plt_cards c
     where c.tipo = 'pedido'
       and c.pedido_id in (select id from public.pedidos where numero in (999899, 999898))`)
).rows[0]
conferir(
  blindagem.total === 0,
  'pedido de backfill e pedido já encerrado NÃO viram card no PCP (blindagem espelhada)',
  `cards criados: ${blindagem.total}`,
)

// ============================================================================
// SESSAO-15 — Logística, ROTAS e caminhões (migration 25 / D-38 / D-39 / D-45)
// ============================================================================
titulo('Logística (SESSAO-15): estoque com ID de produção, pedidos em aguardo e lançamento')

// Gente da logística: log.um trabalha no ESTOQUE (auth …31).
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel, auth_user_id)
    values ('Logística Um', 'log1@teste.com', '33333333301', 'log.um', 'operador',
            '00000000-0000-0000-0000-000000000031');
  insert into public.plt_usuario_setores (usuario_id, setor_id) values
    ((select id from public.plt_usuarios where usuario = 'log.um'),
     (select id from public.plt_setores where codigo = 'estoque'));
`)
// Pedido novo (chega pelo caminho real — situação como o Tiny grava) com 2
// unidades: a primeira chega no ESTOQUE, a segunda fica no CNC.
await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao)
    values (999994, (select id from public.clientes order by id desc limit 1), 'Em aberto');
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
    values ((select id from public.pedidos where numero = 999994), 1, '088', 'Mesa Lisboa 120cm', 2);
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, 1, '088', 'Mesa Lisboa 120cm', n, 2
      from public.pedidos p, generate_series(1, 2) n where p.numero = 999994;
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    select c.id, 'card_criado', (select id from public.plt_setores where codigo = 'cnc'), 'api'
      from public.plt_cards c
     where c.pedido_id = (select id from public.pedidos where numero = 999994) and c.tipo = 'unidade';
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, origem)
    select min(c.id), 'movimentacao_setor',
           (select id from public.plt_setores where codigo = 'cnc'),
           (select id from public.plt_setores where codigo = 'estoque'), 'api'
      from public.plt_cards c
     where c.pedido_id = (select id from public.pedidos where numero = 999994) and c.tipo = 'unidade';
`)
const cardPedido994 = (
  await bd.query(`
    select id::int as id from public.plt_cards
     where tipo = 'pedido' and pedido_id = (select id from public.pedidos where numero = 999994)`)
).rows[0].id
conferir(cardPedido994 > 0, 'pedido "Em aberto" (descrição do Tiny) vira card no PCP pela guarda normalizada')
const unidades994 = (
  await bd.query(`
    select id::int as id from public.plt_cards
     where tipo = 'unidade' and pedido_id = (select id from public.pedidos where numero = 999994)
     order by id`)
).rows.map((r) => r.id)

await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', false)`)
const estoque = (
  await bd.query(`select card_id::int as card_id, id_producao, origem from public.plt_fn_estoque() where numero = 999994`)
).rows
conferir(
  estoque.length === 1 && estoque[0].card_id === unidades994[0] && estoque[0].id_producao === null,
  'a unidade que chegou no ESTOQUE aparece na lista do Estoque, ainda sem ID de produção',
  JSON.stringify(estoque),
)
await bd.exec(`select public.plt_fn_definir_id_producao(${unidades994[0]}, ' MESA-001 ')`)
const comId = (
  await bd.query(`
    select (select id_producao from public.plt_cards where id = ${unidades994[0]}) as id_producao,
           (select count(*)::int from public.plt_fn_estoque('mesa-0')) as achados,
           (select count(*)::int from public.plt_logs_atividade where acao = 'id_producao_definido') as logs`)
).rows[0]
conferir(
  comId.id_producao === 'MESA-001' && comId.achados === 1 && comId.logs === 1,
  'ID de produção digitado (aparado), buscável sem diferenciar caixa e registrado na trilha (D-38/D-40)',
  JSON.stringify(comId),
)
await deveRecusarExec(
  `select public.plt_fn_definir_id_producao(${unidades994[1]}, 'mesa-001')`,
  'dois cards vivos com o mesmo ID de produção é recusado',
  /já existe outra unidade/i,
)

const aguardo994 = (
  await bd.query(`
    select unidades_prontas, total_unidades, completo from public.plt_fn_pedidos_aguardo() where numero = 999994`)
).rows[0]
conferir(
  aguardo994?.unidades_prontas === 1 && aguardo994?.completo === false,
  'Pedidos em aguardo: 1 de 2 prontas (pronta = está em terminal — D-45)',
  JSON.stringify(aguardo994 ?? null),
)
// A segunda unidade chega no ESTOQUE; o pedido completa e é lançado — as
// unidades SAEM do Estoque para o setor ROTAS (D-45).
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, origem)
    values (${unidades994[1]}, 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'cnc'),
            (select id from public.plt_setores where codigo = 'estoque'), 'api');
  select public.plt_fn_lancar_rotas(${cardPedido994});
`)
const lancado = (
  await bd.query(`
    select (select count(*)::int from public.plt_eventos
             where card_id = ${cardPedido994} and tipo = 'pedido_lancado_rotas') as eventos,
           (select lancado_rotas_em is not null from public.plt_cards where id = ${cardPedido994}) as projetado,
           (select count(*)::int from public.plt_cards c
              join public.plt_setores s on s.id = c.setor_atual_id
             where c.pedido_id = (select id from public.pedidos where numero = 999994)
               and c.tipo = 'unidade' and s.codigo = 'rotas') as na_rotas,
           (select count(*)::int from public.plt_fn_estoque() where numero = 999994) as no_estoque,
           (select count(*)::int from public.plt_logs_atividade where acao = 'pedido_lancado_rotas') as logs`)
).rows[0]
conferir(
  lancado.eventos === 1 && lancado.projetado === true && lancado.na_rotas === 2
    && lancado.no_estoque === 0 && lancado.logs >= 1,
  'lançar grava o evento, projeta o lançamento, move as 2 unidades do ESTOQUE para a ROTAS e entra na trilha',
  JSON.stringify(lancado),
)
// Operador de produção não lança nem vê o Estoque.
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false)`)
await deveRecusarExec(
  `select public.plt_fn_lancar_rotas(${cardPedido994})`,
  'operador de produção não lança para ROTAS (gate da logística)',
  /gesto da logística/i,
)
const estoqueOperador = (await bd.query(`select count(*)::int as total from public.plt_fn_estoque()`)).rows[0]
conferir(estoqueOperador.total === 0, 'operador de produção não enxerga a lista do Estoque (gate da logística)')

titulo('Danificados (SESSAO-15/D-38): relato, resolver com estado e arquivar pela logística')

// SECC ganha a etapa DANIFICADO (se o fluxo de qualidade ainda não a criou) e
// duas peças caem nela; a primeira com a marcação de quem entregou.
await bd.exec(`
  insert into public.plt_etapas (setor_id, nome, ordem, eh_danificado)
  select s.id, 'DANIFICADO', 99, true from public.plt_setores s
   where s.codigo = 'secc'
     and not exists (select 1 from public.plt_etapas e where e.setor_id = s.id and e.eh_danificado);
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, 60 + n, 'DAN', 'Peça danificada ' || n, 1, 1
      from public.pedidos p, generate_series(1, 2) n where p.numero = 999999;
`)
const danificados = (
  await bd.query(`select id::int as id from public.plt_cards where item_codigo = 'DAN' order by id`)
).rows.map((r) => r.id)
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    select c.id, 'card_criado', (select id from public.plt_setores where codigo = 'secc'), 'api'
      from public.plt_cards c where c.item_codigo = 'DAN';
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, etapa_destino_id, origem)
    select c.id, 'movimentacao_etapa',
           (select id from public.plt_setores where codigo = 'secc'),
           (select id from public.plt_setores where codigo = 'secc'),
           (select e.id from public.plt_etapas e join public.plt_setores s on s.id = e.setor_id
             where s.codigo = 'secc' and e.eh_danificado), 'api'
      from public.plt_cards c where c.item_codigo = 'DAN';
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, setor_destino_id, estado_qualidade, observacao)
    values (${danificados[0]}, 'qualidade_marcada',
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface',
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_setores where codigo = 'cnc'),
            'danificado', 'quebrou a quina no corte');
`)
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', false)`)
const listaDanificados = (
  await bd.query(`
    select card_id::int as card_id, setor_nome, marcacao_estado, marcacao_por, marcacao_obs
      from public.plt_fn_danificados() where card_id in (${danificados.join(',')}) order by card_id`)
).rows
conferir(
  listaDanificados.length === 2 && listaDanificados[0].setor_nome === 'SECC'
    && listaDanificados[0].marcacao_estado === 'danificado'
    && listaDanificados[0].marcacao_obs === 'quebrou a quina no corte'
    && listaDanificados[0].marcacao_por !== null,
  'a lista traz as peças em DANIFICADO com o setor, o estado, quem marcou e o relato (D-09)',
  JSON.stringify(listaDanificados),
)
await deveRecusarExec(
  `select public.plt_fn_resolver_danificado(${danificados[0]}, (select id from public.plt_setores where codigo = 'cnc'))`,
  'resolver para outro setor sem marcar o estado é recusado (D-45)',
  /marcar o estado/i,
)
await bd.exec(`
  select public.plt_fn_resolver_danificado(${danificados[0]},
           (select id from public.plt_setores where codigo = 'cnc'), null, 'atencao', 'consertada, segue com atenção');
`)
const resolvido = (
  await bd.query(`
    select (select s.codigo from public.plt_cards c join public.plt_setores s on s.id = c.setor_atual_id
             where c.id = ${danificados[0]}) as setor,
           (select qualidade_atual from public.plt_cards where id = ${danificados[0]}) as estado,
           (select count(*)::int from public.plt_fn_danificados() where card_id = ${danificados[0]}) as ainda_na_lista`)
).rows[0]
conferir(
  resolvido.setor === 'cnc' && resolvido.estado === 'atencao' && resolvido.ainda_na_lista === 0,
  'resolvido → CNC com estado 🟡: a peça volta à produção e sai da lista',
  JSON.stringify(resolvido),
)
await bd.exec(`select public.plt_fn_arquivar_card(${danificados[1]}, 'sem conserto')`)
const arquivadoDan = (
  await bd.query(`
    select (select count(*)::int from public.plt_fn_danificados() where card_id = ${danificados[1]}) as na_lista,
           (select count(*)::int from public.plt_fn_danificados(true) where card_id = ${danificados[1]}) as nos_arquivados,
           (select arquivado_em is not null from public.plt_cards where id = ${danificados[1]}) as projetado`)
).rows[0]
conferir(
  arquivadoDan.na_lista === 0 && arquivadoDan.nos_arquivados === 1 && arquivadoDan.projetado === true,
  'a logística arquiva peça DANIFICADA: some da lista, aparece nos arquivados, fica na história',
  JSON.stringify(arquivadoDan),
)
await deveRecusarExec(
  `select public.plt_fn_arquivar_card(${cardMeta})`,
  'a logística NÃO arquiva card que não está em DANIFICADO',
  /só peças em DANIFICADO/i,
)
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false)`)
await deveRecusarExec(
  `select public.plt_fn_arquivar_card(${danificados[0]})`,
  'operador de produção não arquiva nem peça danificada (gate)',
  /gesto de admin ou da integração/i,
)

titulo('Programação de caminhão (SESSAO-15/D-39/D-45): caminhões, reprogramar até entregar, mapa')

await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false)`)
await bd.exec(`
  insert into public.plt_caminhoes (nome, placa, capacidade) values ('Baú 1', 'abc1d23', '12 m³');
  insert into public.plt_caminhoes (nome, placa, capacidade) values ('Baú 2', 'DEF4E56', '8 m³');
`)
const caminhoes = (
  await bd.query(`select id::int as id from public.plt_caminhoes order by id`)
).rows.map((r) => r.id)
await deveRecusarExec(
  `insert into public.plt_caminhoes (nome, placa) values ('Repetido', 'ABC1D23')`,
  'placa repetida (sem diferenciar caixa) é recusada',
  /plt_caminhoes_placa_uq/i,
)
// O endereço do cliente do pedido 999994 vira ponto no cache (o que a Edge
// Function faria) — a porta do mapa devolve latitude/longitude.
await bd.exec(`
  update public.clientes
     set endereco = 'Rua das Flores', numero = '10', bairro = 'Centro', cidade = 'Natal', uf = 'RN', cep = '59000-000'
   where id = (select cliente_id from public.pedidos where numero = 999994);
`)
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', false)`)
const semPonto = (
  await bd.query(`
    select endereco_geocodificavel, geo_chave, latitude, geo_resolvido, programacao_data
      from public.plt_fn_programacao() where numero = 999994`)
).rows[0]
conferir(
  semPonto?.endereco_geocodificavel === 'Rua das Flores 10, Centro, Natal, RN, 59000-000, Brasil'
    && typeof semPonto?.geo_chave === 'string' && semPonto?.latitude === null
    && semPonto?.geo_resolvido === null && semPonto?.programacao_data === null,
  'a porta do mapa monta o endereço geocodificável, a chave do cache e mostra "sem ponto" enquanto não consultado',
  JSON.stringify(semPonto ?? null),
)
await bd.exec(`
  insert into public.plt_geocache (chave, endereco, latitude, longitude, resolvido)
    values ('${semPonto.geo_chave}', '${semPonto.endereco_geocodificavel}', -5.79, -35.21, true);
`)
const comPonto = (
  await bd.query(`select latitude, longitude, geo_resolvido from public.plt_fn_programacao() where numero = 999994`)
).rows[0]
conferir(
  comPonto?.latitude === -5.79 && comPonto?.longitude === -35.21 && comPonto?.geo_resolvido === true,
  'com o cache preenchido, o pedido vem com o ponto do mapa (Q-65)',
  JSON.stringify(comPonto ?? null),
)

await bd.exec(`select public.plt_fn_programar_entrega(${cardPedido994}, '2026-09-10', ${caminhoes[0]})`)
const programado = (
  await bd.query(`
    select (select programacao_data::text from public.plt_fn_rotas() where numero = 999994) as data,
           (select caminhao_nome from public.plt_fn_rotas() where numero = 999994) as caminhao,
           (select count(*)::int from public.plt_fn_programacao('2026-09-10') where numero = 999994) as no_dia,
           (select count(*)::int from public.plt_fn_programacao('2026-09-11') where numero = 999994) as noutro_dia`)
).rows[0]
conferir(
  programado.data === '2026-09-10' && programado.caminhao === 'Baú 1'
    && programado.no_dia === 1 && programado.noutro_dia === 0,
  'programar grava dia + caminhão: o card das ROTAS mostra os dois e a porta do mapa filtra pelo dia',
  JSON.stringify(programado),
)
await bd.exec(`select public.plt_fn_programar_entrega(${cardPedido994}, '2026-09-11', ${caminhoes[1]})`)
const reprogramado = (
  await bd.query(`
    select (select count(*)::int from public.plt_programacoes where card_id = ${cardPedido994}) as linhas,
           (select caminhao_nome from public.plt_fn_rotas() where numero = 999994) as caminhao,
           (select count(*)::int from public.plt_logs_atividade where acao = 'entrega_programada') as criadas,
           (select count(*)::int from public.plt_logs_atividade where acao = 'entrega_reprogramada') as mudadas`)
).rows[0]
conferir(
  reprogramado.linhas === 1 && reprogramado.caminhao === 'Baú 2'
    && reprogramado.criadas === 1 && reprogramado.mudadas === 1,
  'reprogramar troca dia/caminhão na MESMA linha e cada mudança vai para a trilha (D-40/D-45)',
  JSON.stringify(reprogramado),
)
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false)`)
await deveRecusarExec(
  `delete from public.plt_caminhoes where id = ${caminhoes[1]}`,
  'excluir caminhão em uso é bloqueado — "arquive em vez de excluir"',
  /arquive em vez de excluir/i,
)
await bd.exec(`
  update public.plt_caminhoes set arquivado_em = now() where id = ${caminhoes[0]};
  delete from public.plt_caminhoes where id = ${caminhoes[0]};
`)
const caminhaoLimpo = (
  await bd.query(`
    select (select count(*)::int from public.plt_caminhoes where id = ${caminhoes[0]}) as existe,
           (select count(*)::int from public.plt_logs_atividade
             where acao in ('caminhao_criado', 'caminhao_arquivado', 'caminhao_excluido')) as logs`)
).rows[0]
conferir(
  caminhaoLimpo.existe === 0 && caminhaoLimpo.logs === 4,
  'caminhão nunca usado pode ser excluído; criar/arquivar/excluir entram na trilha',
  JSON.stringify(caminhaoLimpo),
)
await bd.exec(`update public.plt_caminhoes set arquivado_em = now() where id = ${caminhoes[1]}`)
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', false)`)
await deveRecusarExec(
  `select public.plt_fn_programar_entrega(${cardPedido994}, '2026-09-12', ${caminhoes[1]})`,
  'programar com caminhão arquivado é recusado',
  /arquivado/i,
)
await bd.exec(`update public.plt_caminhoes set arquivado_em = null where id = ${caminhoes[1]}`)
await bd.exec(`select public.plt_fn_registrar_entrega(${cardPedido994}, 'entregue no teste da S15')`)
await deveRecusarExec(
  `select public.plt_fn_programar_entrega(${cardPedido994}, '2026-09-12', ${caminhoes[1]})`,
  'depois de entregue, a programação não muda mais (D-45)',
  /já foi entregue/i,
)
await deveRecusarExec(
  `select public.plt_fn_desprogramar_entrega(${cardPedido994})`,
  'depois de entregue, também não se tira da programação',
  /já foi entregue/i,
)
const foraDoMapa = (
  await bd.query(`select count(*)::int as total from public.plt_fn_programacao() where numero = 999994`)
).rows[0]
conferir(foraDoMapa.total === 0, 'pedido entregue sai da tela de programação')
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)

titulo('Situação do Tiny é DESCRIÇÃO (SESSAO-15): cancelamento e guarda normalizados')

await bd.exec(`update public.pedidos set situacao = 'Cancelado' where numero = 999994`)
const cancelouDescricao = (
  await bd.query(`
    select count(*)::int as total from public.plt_eventos
     where card_id = ${cardPedido994} and tipo = 'pedido_cancelado'`)
).rows[0]
conferir(
  cancelouDescricao.total === 1,
  '"Cancelado" (como o Tiny grava) dispara o evento de cancelamento — a S09 comparava com o código e nunca via',
  `eventos: ${cancelouDescricao.total}`,
)
await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao)
    values (999893, (select id from public.clientes order by id limit 1), 'Não entregue');
  insert into public.pedidos (numero, cliente_id, situacao)
    values (999892, (select id from public.clientes order by id limit 1), 'Preparando envio');
`)
const guarda = (
  await bd.query(`
    select (select count(*)::int from public.plt_cards c where c.tipo = 'pedido'
             and c.pedido_id = (select id from public.pedidos where numero = 999893)) as nao_entregue,
           (select count(*)::int from public.plt_cards c where c.tipo = 'pedido'
             and c.pedido_id = (select id from public.pedidos where numero = 999892)) as preparando`)
).rows[0]
conferir(
  guarda.nao_entregue === 0 && guarda.preparando === 1,
  'guarda do gatilho normaliza acento/espaço: "Não entregue" não vira card, "Preparando envio" vira (espelho de produção)',
  JSON.stringify(guarda),
)

titulo('Projeção de concluído (SESSAO-15): terminal AGORA, não "já passou por um"')
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, 70, 'VOLTA', 'Peça que volta', 1, 1 from public.pedidos p where p.numero = 999999;
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    values ((select max(id) from public.plt_cards), 'card_criado',
            (select id from public.plt_setores where codigo = 'estoque'), 'api');
`)
const cardVolta = (await bd.query(`select max(id)::int as id from public.plt_cards`)).rows[0].id
const concluidoAntes = (
  await bd.query(`select concluido_em is not null as concluido from public.plt_cards where id = ${cardVolta}`)
).rows[0]
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, origem)
    values (${cardVolta}, 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'estoque'),
            (select id from public.plt_setores where codigo = 'cnc'), 'api');
`)
const concluidoDepois = (
  await bd.query(`select concluido_em is not null as concluido from public.plt_cards where id = ${cardVolta}`)
).rows[0]
conferir(
  concluidoAntes.concluido === true && concluidoDepois.concluido === false,
  'unidade que sai do terminal de volta à produção deixa de estar concluída (D-13)',
  JSON.stringify({ antes: concluidoAntes, depois: concluidoDepois }),
)

titulo('Metas (SESSAO-15/D-45): etapa opcional e edição só de quem criou')
await bd.exec(`
  insert into public.plt_etapas (setor_id, nome, ordem)
    values ((select id from public.plt_setores where codigo = 'cnc'), 'Usinagem de teste', 50);
`)
const etapaUsinagem = (
  await bd.query(`select id::int as id from public.plt_etapas where nome = 'Usinagem de teste'`)
).rows[0].id
await deveRecusar(
  `insert into public.plt_metas (indicador, periodo, alvo, setor_id, etapa_id, criada_por_id)
     values ('unidades', 'semanal', 5, (select id from public.plt_setores where codigo = 'secc'), ${etapaUsinagem},
             (select id from public.plt_usuarios where usuario = 'primeira.pessoa'))`,
  'meta de setor com etapa de OUTRO setor é recusada',
  /não pertence ao setor/i,
)
await deveRecusar(
  `insert into public.plt_metas (indicador, periodo, alvo, setor_id, etapa_id, criada_por_id)
     values ('tarefas', 'semanal', 5, (select id from public.plt_setores where codigo = 'cnc'), ${etapaUsinagem},
             (select id from public.plt_usuarios where usuario = 'primeira.pessoa'))`,
  'etapa só faz sentido em meta de UNIDADES (check)',
  /plt_metas_etapa_ck/i,
)
await bd.exec(`
  insert into public.plt_metas (titulo, indicador, periodo, alvo, setor_id, etapa_id, criada_por_id)
    values ('Usinagem da semana', 'unidades', 'semanal', 10,
            (select id from public.plt_setores where codigo = 'cnc'), ${etapaUsinagem},
            (select id from public.plt_usuarios where usuario = 'primeira.pessoa'));
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, 71, 'USIN', 'Peça usinada', 1, 1 from public.pedidos p where p.numero = 999999;
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, etapa_destino_id, origem)
    values ((select max(id) from public.plt_cards), 'card_criado',
            (select id from public.plt_setores where codigo = 'cnc'), ${etapaUsinagem}, 'api');
`)
const cardUsinagem = (await bd.query(`select max(id)::int as id from public.plt_cards`)).rows[0].id
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
    values (${cardUsinagem}, 'execucao_iniciada', (select id from public.plt_usuarios where usuario = 'meta.um'), 'interface');
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
    values (${cardUsinagem}, 'execucao_finalizada', (select id from public.plt_usuarios where usuario = 'meta.um'), 'interface');
`)
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', false)`)
const metasEtapa = (
  await bd.query(`
    select titulo, etapa_nome, progresso::float as progresso, criada_por_id is not null as tem_criador
      from public.plt_fn_metas_painel() where titulo in ('Usinagem da semana', 'CNC da semana') order by titulo`)
).rows
const porTituloS15 = Object.fromEntries(metasEtapa.map((m) => [m.titulo, m]))
conferir(
  porTituloS15['Usinagem da semana']?.progresso === 1
    && porTituloS15['Usinagem da semana']?.etapa_nome === 'Usinagem de teste'
    && porTituloS15['CNC da semana']?.progresso === 3
    && metasEtapa.every((m) => m.tem_criador),
  'meta com etapa conta só as execuções encerradas NAQUELA etapa (1); a do setor inteiro conta todas (3); a porta diz quem criou',
  JSON.stringify(metasEtapa),
)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)
const politicaEdicao = (
  await bd.query(`
    select qual from pg_policies where tablename = 'plt_metas' and policyname = 'plt_metas_edicao'`)
).rows[0]
conferir(
  typeof politicaEdicao?.qual === 'string' && /criada_por_id/.test(politicaEdicao.qual) && !/fn_eh_lider_de/.test(politicaEdicao.qual),
  'policy de edição de metas passou a ser "quem criou ou admin" (D-45) — RLS não se prova no PGlite (E-14), conferida pela definição',
  politicaEdicao?.qual,
)

titulo('Resumo')
const contar = async (sql) => (await bd.query(sql)).rows[0].total
console.log(
  `  tabelas plt_*: ${await contar(
    `select count(*)::int as total from information_schema.tables where table_schema='public' and table_name like 'plt\\_%' and table_type='BASE TABLE'`,
  )}`,
)
console.log(
  `  visões plt_vw_*: ${await contar(
    `select count(*)::int as total from information_schema.views where table_schema='public' and table_name like 'plt\\_vw\\_%'`,
  )}`,
)
console.log(
  `  políticas de RLS: ${await contar(
    `select count(*)::int as total from pg_policies where schemaname='public' and tablename like 'plt\\_%'`,
  )}`,
)

await bd.close()

if (falhas > 0) {
  console.log(vermelho(`\n${falhas} verificação(ões) falharam.`))
  process.exit(1)
}
console.log(verde('\nTUDO VERDE — migrations idempotentes, integração intacta, eventos imutáveis.'))
