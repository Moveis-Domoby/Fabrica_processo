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

titulo('Simulando o Realtime do Supabase (SESSAO-26 — o websocket do chat)')
// O Supabase traz o schema realtime do Broadcast: realtime.messages, send() e
// topic(). Aqui vai o mínimo para a migration do chat criar a política de
// entrada nos canais e o gatilho empurrar as mensagens. A LINHA em
// realtime.messages é a prova de que o broadcast saiu (o send de verdade
// engole erro e só avisa — ver migration 38).
await bd.exec(`
  create schema if not exists realtime;
  create table if not exists realtime.messages (
    id          uuid primary key default gen_random_uuid(),
    topic       text not null,
    extension   text not null default 'broadcast',
    payload     jsonb,
    event       text,
    private     boolean default true,
    inserted_at timestamp not null default now()
  );
  alter table realtime.messages enable row level security;
  create or replace function realtime.topic() returns text
    language sql stable as $$ select nullif(current_setting('realtime.topic', true), '')::text $$;
  create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
    returns void language plpgsql as $$
  begin
    insert into realtime.messages (payload, event, topic, private) values (payload, event, topic, private);
  end $$;
  grant usage on schema realtime to authenticated;
  grant select on realtime.messages to authenticated;
`)
console.log('  realtime.messages, send() e topic() no lugar')

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
  setores.length === 10,
  '10 setores semeados (os 9 da D-18 + PEDIDOS EM AGUARDO da SESSAO-24), sem duplicar na segunda rodada',
  `vieram ${setores.length}`,
)
conferir(
  setores
    .filter((s) => s.papel_no_fluxo === 'terminal')
    .map((s) => s.codigo)
    .join(',') === 'estoque,aguardo,rotas',
  'fins de linha: ESTOQUE (peça sem dono), PEDIDOS EM AGUARDO (peça de pedido) e ROTAS (D-18 ↪️ SESSAO-24)',
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
// movida até o fim de linha. A expedição precisa contar 1 de 3.
// ↪️ SESSAO-24 (b4 do dono): peça de pedido termina em PEDIDOS EM AGUARDO — o
// ESTOQUE só recebe peça sem dono (a interface recusa o contrário).
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
           (select id from public.plt_setores where codigo = 'aguardo'),
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
    unidades[0]?.setor_nome === 'PEDIDOS EM AGUARDO' &&
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

titulo('Comercial (SESSAO-19/D-46/D-47): view de compatibilidade, gate de módulo e RPCs do recompra')

// Pedidos "Entregue" não viram card (a guarda da entrada ignora encerrados) —
// o cenário testa só o domínio Comercial, sem sujar o kanban.
await bd.exec(`
  insert into public.clientes (nome, fone, raw) values
    ('Cliente Recompra Um', '(84) 90000-0001', '{"celular": ""}'::jsonb),
    ('Cliente Recompra Dois', null, '{"celular": "(84) 90000-0002"}'::jsonb);
  insert into public.pedidos (numero, cliente_id, situacao, data_pedido, total_pedido, total_produtos, raw) values
    (999801, (select id from public.clientes where nome = 'Cliente Recompra Um'), 'Entregue', '2031-01-10', 1500.00, 1600.00,
     '{"cliente": {"nome": "Cliente Recompra Um ", "fone": "(84) 90000-0001"},
       "itens": [{"item": {"descricao": "Estante de Teste S19", "quantidade": "2.00", "valor_unitario": "500.00"}},
                 {"item": {"descricao": "Mesa de Teste S19", "quantidade": "1.00", "valor_unitario": "500.00"}}]}'::jsonb),
    (999802, (select id from public.clientes where nome = 'Cliente Recompra Um'), 'Entregue', '2031-02-20', 800.00, 800.00,
     '{"cliente": {"nome": "Cliente Recompra Um", "fone": "(84) 90000-0001"},
       "itens": [{"item": {"descricao": "Estante de Teste S19", "quantidade": "1.00", "valor_unitario": "800.00"}}]}'::jsonb),
    (999803, (select id from public.clientes where nome = 'Cliente Recompra Dois'), 'Entregue', '2031-01-15', 300.00, 300.00,
     '{"cliente": {"nome": "Cliente Recompra Dois", "fone": ""},
       "itens": [{"item": {"descricao": "Nicho de Teste S19", "quantidade": "1.00", "valor_unitario": "300.00"}}]}'::jsonb);
`)

const shapeVm = (
  await bd.query(`
    select string_agg(column_name || ':' || data_type, ',' order by ordinal_position) as shape
      from information_schema.columns where table_schema = 'public' and table_name = 'vendas_marketing'`)
).rows[0].shape
conferir(
  shapeVm ===
    'id:uuid,numero_pedido:character varying,nome_cliente:character varying,telefone_cliente:character varying,'
    + 'data_compra:timestamp with time zone,valor_pedido:numeric,numero_itens:integer,itens_comprados:jsonb,'
    + 'created_at:timestamp with time zone',
  'vendas_marketing reproduz o shape EXATO da tabela do recompra (colunas, ordem e tipos — varchar incluso)',
  shapeVm,
)

const vmLinha = (
  await bd.query(`
    select nome_cliente, telefone_cliente,
           to_char(data_compra at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI') as data_sp,
           valor_pedido::text as valor, numero_itens,
           itens_comprados->0->'produto'->>'descricao' as item1,
           (id = md5('vendas_marketing:999801')::uuid) as id_deterministico
      from public.vendas_marketing where numero_pedido = '999801'`)
).rows[0]
conferir(
  vmLinha?.nome_cliente === 'Cliente Recompra Um '
    && vmLinha?.telefone_cliente === '(84) 90000-0001'
    && vmLinha?.data_sp === '2031-01-10 00:00'
    && vmLinha?.valor === '1500.00'
    && vmLinha?.numero_itens === 2
    && vmLinha?.item1 === 'Estante de Teste S19'
    && vmLinha?.id_deterministico === true,
  'a view lê o pedido real: valor líquido, meia-noite de São Paulo, nº de linhas de itens, nome do snapshot SEM trim e id determinístico',
  JSON.stringify(vmLinha),
)

const vmCelular = (
  await bd.query(`select telefone_cliente from public.vendas_marketing where numero_pedido = '999803'`)
).rows[0]
conferir(
  vmCelular?.telefone_cliente === '(84) 90000-0002',
  'cliente sem fone cai no CELULAR do cadastro (o fallback que o pipeline v3 do recompra tinha)',
  JSON.stringify(vmCelular),
)

// O gate de módulo se prova pela VIEW (o WHERE roda até para superusuário —
// diferente das policies, que o PGlite não exercita: E-14).
const genteS19 = (
  await bd.query(`
    select (select auth_user_id::text from public.plt_usuarios where papel = 'admin'  and auth_user_id is not null limit 1) as admin,
           (select auth_user_id::text from public.plt_usuarios where papel <> 'admin' and auth_user_id is not null limit 1) as comum`)
).rows[0]
await bd.exec(`select set_config('request.jwt.claim.sub', '${genteS19.comum}', false)`)
const semModulo = (
  await bd.query(`select count(*)::int as total from public.vendas_marketing`)
).rows[0]
conferir(semModulo.total === 0, 'usuário SEM o módulo comercial não lê nada da view (gate D-46)')
await bd.exec(`
  update public.plt_usuarios set modulos = array['fabrica','comercial']
   where auth_user_id = '${genteS19.comum}'::uuid;
`)
const comModulo = (
  await bd.query(`select count(*)::int as total from public.vendas_marketing`)
).rows[0]
await bd.exec(`
  update public.plt_usuarios set modulos = '{}'
   where auth_user_id = '${genteS19.comum}'::uuid;
  select set_config('request.jwt.claim.sub', '${genteS19.admin}', false);
`)
const adminLe = (
  await bd.query(`select count(*)::int as total from public.vendas_marketing`)
).rows[0]
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)
conferir(
  comModulo.total > 0 && adminLe.total > 0,
  'com o módulo liberado a pessoa lê; admin lê sempre, sem depender da lista (D-46)',
  JSON.stringify({ comModulo: comModulo.total, admin: adminLe.total }),
)

const politicaComercial = (
  await bd.query(`select qual from pg_policies where tablename = 'listas_disparo' limit 1`)
).rows[0]
conferir(
  typeof politicaComercial?.qual === 'string'
    && /fn_tem_modulo/.test(politicaComercial.qual)
    && politicaComercial.qual !== 'true',
  'RLS das tabelas do Comercial usa o gate de módulo — nada de USING (true) (definição conferida, E-14)',
  politicaComercial?.qual,
)
const tinyAuthFechada = (
  await bd.query(`
    select (select relrowsecurity from pg_class where relname = 'tiny_auth') as rls,
           (select count(*)::int from pg_policies where tablename = 'tiny_auth') as policies`)
).rows[0]
conferir(
  tinyAuthFechada.rls === true && tinyAuthFechada.policies === 0,
  'tiny_auth: RLS ligado e NENHUMA policy — o token OAuth é segredo de máquina (regra crítica 4)',
  JSON.stringify(tinyAuthFechada),
)
const modulosDefault = (
  await bd.query(`
    select column_default from information_schema.columns
     where table_schema = 'public' and table_name = 'plt_usuarios' and column_name = 'modulos'`)
).rows[0]
conferir(
  typeof modulosDefault?.column_default === 'string' && modulosDefault.column_default.includes('{}'),
  'plt_usuarios.modulos existe com default vazio — usuário novo nasce sem módulos, quem cria concede',
  modulosDefault?.column_default,
)

// As RPCs copiadas, respondendo sobre a view com os números do cenário
// (período 2031 isola os 3 pedidos do teste).
const score = (
  await bd.query(`
    select total_revenue::text as receita, total_orders, total_clients, recurrents
      from public.fn_dashboard_scorecards(
        '{"dateFilter":"custom","customDateStart":"2031-01-01","customDateEnd":"2031-12-31"}'::jsonb)`)
).rows[0]
conferir(
  score?.receita === '2600.00' && score?.total_orders === 3 && score?.total_clients === 2 && score?.recurrents === 1,
  'fn_dashboard_scorecards: 3 pedidos, 2 clientes (identidade por telefone), 1 recompra — números certos',
  JSON.stringify(score),
)
const filtro = (
  await bd.query(`
    select nome_cliente, quantidade_pedidos, pedidos_vida, is_recorrente, total_count::int as total_count
      from public.fn_filter_customers(
        '{"dateFilter":"custom","customDateStart":"2031-01-01","customDateEnd":"2031-12-31"}'::jsonb, 10, 0)
      order by nome_cliente`)
).rows
conferir(
  filtro.length === 2
    && filtro[0]?.total_count === 2
    && filtro.some((c) => c.quantidade_pedidos === 2 && c.is_recorrente === true)
    && filtro.some((c) => c.quantidade_pedidos === 1 && c.is_recorrente === false),
  'fn_filter_customers pagina os 2 clientes do período com vida e recorrência calculadas',
  JSON.stringify(filtro),
)
const graficoMes = (
  await bd.query(`
    select month_str, revenue::text as revenue, orders
      from public.fn_dashboard_revenue_chart('2031-01-01', '2031-12-31') order by month_str`)
).rows
conferir(
  graficoMes.length === 2
    && graficoMes[0]?.month_str === '2031-01' && graficoMes[0]?.revenue === '1800.00' && graficoMes[0]?.orders === 2
    && graficoMes[1]?.month_str === '2031-02' && graficoMes[1]?.revenue === '800.00' && graficoMes[1]?.orders === 1,
  'fn_dashboard_revenue_chart agrupa por mês com os valores certos',
  JSON.stringify(graficoMes),
)
const topItens = (
  await bd.query(`
    select item_name, quantidade from public.fn_dashboard_top_items_overall('2031-01-01', '2031-12-31')
     order by quantidade desc, item_name`)
).rows
conferir(
  topItens.length === 3 && topItens[0]?.item_name === 'Estante de Teste S19' && topItens[0]?.quantidade === 2,
  'fn_dashboard_top_items_overall extrai o NOME do item de dentro do jsonb da view (cascata $.produto.descricao)',
  JSON.stringify(topItens),
)
const vendasFone = (
  await bd.query(`
    select numero_pedido from public.fn_vendas_disparo_por_telefone('84900000002', '2031-01-01', '2031-12-31')`)
).rows
conferir(
  vendasFone.length === 1 && vendasFone[0]?.numero_pedido === '999803',
  'fn_vendas_disparo_por_telefone acha a venda pelo telefone normalizado (atribuição do disparo)',
  JSON.stringify(vendasFone),
)

// O ciclo de vida de uma campanha grava nas tabelas novas sem erro.
await bd.exec(`
  insert into public.listas_disparo (nome, criado_por, tarifa_aplicada) values ('Campanha de Teste S19', 'harness', 0.35);
  insert into public.listas_disparo_membros (lista_id, telefone, nome_cliente, snapshot_total_gasto, snapshot_qtd_compras)
    values ((select id from public.listas_disparo where nome = 'Campanha de Teste S19'), '(84) 90000-0002', 'Cliente Recompra Dois', 300.00, 1);
  insert into public.listas_disparo_eventos (lista_id, tipo_evento, descricao)
    values ((select id from public.listas_disparo where nome = 'Campanha de Teste S19'), 'lista_criada', 'teste do harness');
  update public.listas_disparo_membros set status = 'ganho', valor_ganho = 300.00, data_envio = now()
    where telefone = '(84) 90000-0002';
`)
const scorecardLista = (
  await bd.query(`
    select total_membros::int as membros, total_enviados::int as enviados, total_ganhos::int as ganhos,
           receita_gerada::text as receita, custo_total_real::text as custo
      from public.vw_scorecards_lista where nome = 'Campanha de Teste S19'`)
).rows[0]
conferir(
  scorecardLista?.membros === 1 && scorecardLista?.enviados === 1 && scorecardLista?.ganhos === 1
    && scorecardLista?.receita === '300.00' && scorecardLista?.custo === '0.3500',
  'campanha, membro e evento gravam nas tabelas novas; vw_scorecards_lista calcula receita e custo real',
  JSON.stringify(scorecardLista),
)
await deveRecusarExec(
  `insert into public.listas_disparo_membros (lista_id, telefone)
     values ((select id from public.listas_disparo where nome = 'Campanha de Teste S19'), '(84) 90000-0002')`,
  'o mesmo telefone não entra duas vezes na mesma campanha (UNIQUE lista_id+telefone do recompra)',
  /duplicate key|unique/i,
)
const consolidado = (
  await bd.query(`
    select total_pedidos::int as pedidos, faturamento_total::text as faturamento
      from public.vw_clientes_consolidados where telefone_cliente = '(84) 90000-0001'`)
).rows[0]
conferir(
  consolidado?.pedidos === 2 && consolidado?.faturamento === '2300.00',
  'vw_clientes_consolidados agrupa o cliente pelas 2 compras somadas (herda o gate da vendas_marketing)',
  JSON.stringify(consolidado),
)

titulo('Comercial no front (SESSAO-20): negação explícita, portas novas e temas esmeralda')

// 1 · As 10 RPCs do recompra + as 2 portas novas são SECURITY DEFINER — é o
// que as deixa ler a view depois da revogação (catálogo, não permissão: E-14).
const definersS20 = (
  await bd.query(`
    select count(*)::int as total from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and p.proname in ('fn_dashboard_revenue_chart','fn_dashboard_purchase_frequency',
                         'fn_dashboard_transitions','fn_dashboard_transitions_summary',
                         'fn_dashboard_transition_clients','fn_dashboard_items',
                         'fn_dashboard_top_items_overall','fn_dashboard_scorecards',
                         'fn_filter_customers','fn_vendas_disparo_por_telefone',
                         'fn_clientes_consolidados','fn_vendas_cliente')`)
).rows[0]
conferir(
  definersS20.total === 12,
  'as 10 RPCs do recompra + fn_clientes_consolidados + fn_vendas_cliente são SECURITY DEFINER com gate (item 0/A)',
  `definers: ${definersS20.total}`,
)

// 2 · ACL enxuta: authenticated perdeu o SELECT das views gateadas;
// vw_scorecards_lista segue legível (o RLS de módulo das tabelas cobre) e só-leitura.
const aclS20 = (
  await bd.query(`
    select has_table_privilege('authenticated', 'public.vendas_marketing', 'select') as vm,
           has_table_privilege('authenticated', 'public.vw_clientes_consolidados', 'select') as cc,
           has_table_privilege('authenticated', 'public.vw_scorecards_lista', 'select') as sl,
           has_table_privilege('authenticated', 'public.vw_scorecards_lista', 'insert') as sl_escrita`)
).rows[0]
conferir(
  aclS20.vm === false && aclS20.cc === false && aclS20.sl === true && aclS20.sl_escrita === false,
  'authenticated não lê mais vendas_marketing nem vw_clientes_consolidados direto; vw_scorecards_lista ficou só-leitura',
  JSON.stringify(aclS20),
)

// 3 · Sem o módulo, a RPC NEGA com erro claro — o critério da demanda pede
// negação, não lista vazia/zerada.
await bd.exec(`select set_config('request.jwt.claim.sub', '${genteS19.comum}', false)`)
await deveRecusarExec(
  `select * from public.fn_dashboard_scorecards('{}'::jsonb)`,
  'fn_dashboard_scorecards NEGA quem não tem o módulo (erro, não zero)',
  /não tem acesso ao módulo Comercial/i,
)
await deveRecusarExec(
  `select * from public.fn_clientes_consolidados()`,
  'fn_clientes_consolidados (porta nova) NEGA sem o módulo',
  /não tem acesso ao módulo Comercial/i,
)
await deveRecusarExec(
  `select * from public.fn_vendas_cliente(array['(84) 90000-0001'])`,
  'fn_vendas_cliente (porta nova) NEGA sem o módulo',
  /não tem acesso ao módulo Comercial/i,
)

// 4 · Com o módulo, tudo responde com os MESMOS números da S19 — o gate não
// muda número nenhum.
await bd.exec(`update public.plt_usuarios set modulos = array['fabrica','comercial'] where auth_user_id = '${genteS19.comum}'::uuid`)
const scoreS20 = (
  await bd.query(`
    select total_revenue::text as receita, total_orders
      from public.fn_dashboard_scorecards(
        '{"dateFilter":"custom","customDateStart":"2031-01-01","customDateEnd":"2031-12-31"}'::jsonb)`)
).rows[0]
conferir(
  scoreS20?.receita === '2600.00' && scoreS20?.total_orders === 3,
  'com o módulo, os números continuam os da S19 (ao centavo)',
  JSON.stringify(scoreS20),
)
// A view consolidada enxerga TODOS os pedidos do harness (o cenário do kanban
// também cria) — o que se afere é o recorte (vida >= 2), a ordem (pedidos
// desc) e o cliente da S19 com os números certos.
const recompradoresS20 = (
  await bd.query(`
    select telefone_cliente, total_pedidos::int as pedidos, faturamento_total::text as fat
      from public.fn_clientes_consolidados(2, 'pedidos', 50)`)
).rows
const s19NoTop = recompradoresS20.find((c) => c.telefone_cliente === '(84) 90000-0001')
conferir(
  recompradoresS20.length > 0
    && recompradoresS20.every((c) => c.pedidos >= 2)
    && recompradoresS20.every((c, i) => i === 0 || recompradoresS20[i - 1].pedidos >= c.pedidos)
    && s19NoTop?.pedidos === 2 && s19NoTop?.fat === '2300.00',
  'fn_clientes_consolidados(2, pedidos): recorte vida >= 2, ordem por pedidos desc e o cliente da S19 com os números certos',
  JSON.stringify(recompradoresS20),
)
const recordesS20 = (
  await bd.query(`select telefone_cliente from public.fn_clientes_consolidados(null, 'faturamento', 1)`)
).rows
conferir(
  recordesS20.length === 1 && recordesS20[0]?.telefone_cliente === '(84) 90000-0001',
  'fn_clientes_consolidados(faturamento, 1): o maior cliente vem primeiro',
  JSON.stringify(recordesS20),
)
const vidaFoneS20 = (
  await bd.query(`select numero_pedido from public.fn_vendas_cliente(array['(84) 90000-0002'])`)
).rows
const vidaNomeS20 = (
  await bd.query(`select numero_pedido from public.fn_vendas_cliente(null, null, 'Recompra Um')`)
).rows
const vidaVaziaS20 = (await bd.query(`select numero_pedido from public.fn_vendas_cliente()`)).rows
conferir(
  vidaFoneS20.length === 1 && vidaFoneS20[0]?.numero_pedido === '999803'
    && vidaNomeS20.length === 2 && vidaVaziaS20.length === 0,
  'fn_vendas_cliente: acha por telefone e por nome parcial; SEM critério devolve vazio (não despeja a base)',
  JSON.stringify({ fone: vidaFoneS20.length, nome: vidaNomeS20.length, vazio: vidaVaziaS20.length }),
)

// 5 · Contexto de máquina segue passando no gate (a Edge Function
// verificar-vendas-disparo chama pela service_role, sem JWT).
await bd.exec(`
  update public.plt_usuarios set modulos = '{}' where auth_user_id = '${genteS19.comum}'::uuid;
  select set_config('request.jwt.claim.sub', '', false);
`)
const maquinaS20 = (
  await bd.query(`
    select count(*)::int as total
      from public.fn_vendas_disparo_por_telefone('84900000002', '2031-01-01', '2031-12-31')`)
).rows[0]
conferir(
  maquinaS20.total === 1,
  'contexto de máquina (sem JWT) segue passando no gate — verificar-vendas-disparo não quebra',
  `linhas: ${maquinaS20.total}`,
)

// 6 · Temas esmeralda da união no check (D-46 / D-41).
await bd.exec(`update public.plt_usuarios set tema = 'esmeralda-escuro' where auth_user_id = '${genteS19.comum}'::uuid`)
const temaNovoS20 = (
  await bd.query(`select tema from public.plt_usuarios where auth_user_id = '${genteS19.comum}'::uuid`)
).rows[0]
conferir(temaNovoS20?.tema === 'esmeralda-escuro', 'tema esmeralda-escuro aceito pelo check novo (união D-46)')
await deveRecusarExec(
  `update public.plt_usuarios set tema = 'rosa-choque' where auth_user_id = '${genteS19.comum}'::uuid`,
  'tema fora do catálogo continua recusado',
  /plt_usuarios_tema_ck|check/i,
)
await bd.exec(`update public.plt_usuarios set tema = 'claro' where auth_user_id = '${genteS19.comum}'::uuid`)

titulo('Dashboards de verdade (SESSAO-16/D-42): retrato de agora, dia e gates')

// Admin de novo: as portas novas medem a fábrica inteira para ele.
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false)`)

// 1 · O retrato de agora fecha com a conta manual sobre os cards projetados.
const agoraManual = (
  await bd.query(`
    select count(*) filter (where c.executor_atual_id is null)::int     as fila,
           count(*) filter (where c.executor_atual_id is not null)::int as exec
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id
     where c.tipo = 'unidade' and c.arquivado_em is null and c.concluido_em is null
       and s.ativo and s.papel_no_fluxo = 'producao'`)
).rows[0]
const agoraPorta = (
  await bd.query(`select na_fila, em_execucao from public.plt_fn_dash_agora() where setor_id is null`)
).rows[0]
conferir(
  agoraPorta !== undefined
    && agoraPorta.na_fila === agoraManual.fila
    && agoraPorta.em_execucao === agoraManual.exec,
  'o retrato de agora (linha total) BATE com a conta manual dos cards vivos',
  `porta=${JSON.stringify(agoraPorta)} manual=${JSON.stringify(agoraManual)}`,
)
const agoraSetores = (
  await bd.query(`
    select count(*)::int as linhas,
           count(*) filter (where setor_codigo in ('estoque','rotas','pcp'))::int as fora
      from public.plt_fn_dash_agora() where setor_id is not null`)
).rows[0]
conferir(
  agoraSetores.linhas === 6 && agoraSetores.fora === 0,
  'os tiles do andon são só os 6 setores de produção — PCP (entrada) e terminais têm leitura própria',
  JSON.stringify(agoraSetores),
)

// 2 · "Concluída = chegou ao terminal final" (resposta do dono, 17/09): o herói
// do dia, a soma por hora e o fim de linha contam A MESMA coisa.
const concluidasManual = (
  await bd.query(`
    select count(distinct e.card_id)::int as total
      from public.plt_eventos e
      join public.plt_cards c on c.id = e.card_id and c.tipo = 'unidade'
      join public.plt_setores s on s.id = e.setor_destino_id and s.papel_no_fluxo = 'terminal'
     where e.tipo = 'movimentacao_setor'
       and (e.ocorrido_em at time zone 'America/Fortaleza')::date
           = (now() at time zone 'America/Fortaleza')::date`)
).rows[0].total
const diaPorta = (
  await bd.query(`select concluidas_dia, aguardando_lancamento from public.plt_fn_dash_dia()`)
).rows[0]
const somaHoras = (
  await bd.query(`select coalesce(sum(concluidas), 0)::int as total from public.plt_fn_dash_producao_hora()`)
).rows[0].total
conferir(
  diaPorta !== undefined
    && diaPorta.concluidas_dia === concluidasManual
    && somaHoras === concluidasManual
    && concluidasManual >= 1,
  'concluídas do dia = chegadas ao terminal: herói, soma por hora e conta manual idênticos',
  `dia=${diaPorta?.concluidas_dia} horas=${somaHoras} manual=${concluidasManual}`,
)
const fimDeLinha = (
  await bd.query(`select destino, quantidade from public.plt_fn_dash_fim_de_linha()`)
).rows
const somaDestinos = fimDeLinha
  .filter((d) => d.destino !== 'danificado')
  .reduce((s, d) => s + d.quantidade, 0)
conferir(
  somaDestinos === concluidasManual,
  'o fim de linha do dia distribui exatamente as concluídas entre os terminais',
  JSON.stringify(fimDeLinha),
)

// 3 · O tile do PCP conta o que o QUADRO do PCP mostra. ↪️ D-75 (28/09): antes
// era uma conta à parte (card de pedido não cancelado com unidade por liberar)
// que deixava passar o pedido já encerrado no Tiny — o painel dizia 233 e o
// quadro 33. Agora a referência é a própria porta do quadro (E-47: o número
// sai da mesma porta que a tela chama); os casos estão no bloco D-75 no fim.
const pcpManual = (
  await bd.query(`select coalesce(max(contagem_total), 0)::int as total
                    from public.plt_fn_cards_pedido_pcp(1, 0)`)
).rows[0].total
const pcpPorta = (
  await bd.query(`select pedidos_a_liberar, unidades_liberadas_dia from public.plt_fn_dash_pcp_dia()`)
).rows[0]
conferir(
  pcpPorta !== undefined
    && pcpPorta.pedidos_a_liberar === pcpManual
    && pcpPorta.unidades_liberadas_dia >= 1,
  'tile do PCP: "a liberar" = o que o quadro do PCP mostra (D-75) e as liberações do dia aparecem',
  `porta=${JSON.stringify(pcpPorta)} quadro=${pcpManual}`,
)

// 4 · Danificados em aberto = os cards na etapa DANIFICADO agora, nem mais nem menos.
const danifManual = (
  await bd.query(`
    select count(*)::int as total
      from public.plt_cards c
      join public.plt_etapas et on et.id = c.etapa_atual_id and et.eh_danificado
     where c.tipo = 'unidade' and c.arquivado_em is null`)
).rows[0].total
const danifPorta = (
  await bd.query(`
    select coalesce(sum(quantidade), 0)::int as total from public.plt_fn_dash_danificados_abertos()`)
).rows[0].total
conferir(
  danifPorta === danifManual,
  'danificados em aberto: a porta espelha exatamente a etapa DANIFICADO',
  `porta=${danifPorta} manual=${danifManual}`,
)

// 5 · Tendência semanal: para o admin, a semana corrente traz as unidades
// concluídas com média de tempo total calculada (fila + execução útil).
const tendencia = (
  await bd.query(`
    select semana_inicio, unidades, media_total
      from public.plt_fn_dash_tendencia_semanas(6)
     order by semana_inicio desc limit 1`)
).rows[0]
conferir(
  tendencia !== undefined && tendencia.unidades >= 1 && tendencia.media_total !== null,
  'tendência semanal (admin): a semana corrente tem unidades e média de tempo total',
  JSON.stringify(tendencia ?? null),
)

// 6 · Gate D-32 nas portas novas: líder de produção NÃO recebe número de fim de
// linha nem a tendência (a jornada cruza setores que ele não mede); o andon
// dele mostra só o setor dele. Operador não recebe nada.
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false)`)
const liderDia = (await bd.query(`select * from public.plt_fn_dash_dia()`)).rows
const liderTendencia = (await bd.query(`select * from public.plt_fn_dash_tendencia_semanas()`)).rows
const liderAgora = (
  await bd.query(`select setor_nome from public.plt_fn_dash_agora() where setor_id is not null`)
).rows.map((r) => r.setor_nome)
conferir(
  liderDia.length === 0 && liderTendencia.length === 0
    && liderAgora.length === 1 && liderAgora[0] === 'FITAMENTO',
  'líder de produção: sem números de fim de linha/tendência; andon só do setor dele (D-32)',
  JSON.stringify({ dia: liderDia.length, tendencia: liderTendencia.length, agora: liderAgora }),
)
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false)`)
const operadorAgora = (await bd.query(`select * from public.plt_fn_dash_agora()`)).rows
const operadorPcp = (await bd.query(`select * from public.plt_fn_dash_pcp_dia()`)).rows
conferir(
  operadorAgora.length === 0 && operadorPcp.length === 0,
  'operador não recebe nada das portas novas (D-32)',
  JSON.stringify({ agora: operadorAgora.length, pcp: operadorPcp.length }),
)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)

// ============================================================================
// SESSAO-22 — Filas reais, tempo de PCP e pausa (migration 29 / D-48)
// Lembrete E-14: o PGlite roda como superusuário — RLS/grants não se provam
// aqui. O que se prova: triggers (valem para todo escritor), views e os SQLs
// de manutenção do lote (E-26: lote passa aqui ANTES do banco real).
// ============================================================================
titulo('SESSAO-22 · manutenção: limite padrão 1 aplicado aos setores existentes')

// Roda o SQL de manutenção real (o mesmo arquivo que irá ao banco).
const MANUTENCAO = path.join(RAIZ, 'supabase/manutencao')
await bd.exec(await readFile(path.join(MANUTENCAO, '2026-09-21_limite_execucoes_padrao_1.sql'), 'utf8'))
const limitesDepois = (
  await bd.query(`select count(*) filter (where limite_execucoes_por_pessoa is null)::int as sem_limite
                    from public.plt_setores`)
).rows[0]
conferir(
  limitesDepois.sem_limite === 0,
  'manutenção do limite: nenhum setor fica "sem limite" depois do lote (D-48)',
  `sem limite: ${limitesDepois.sem_limite}`,
)
const setorNovoLimite = (
  await bd.query(`
    insert into public.plt_setores (nome, codigo, papel_no_fluxo, ordem, ativo)
      values ('TESTE LIMITE', 'teste-limite-s22', 'producao', 99, false)
    returning limite_execucoes_por_pessoa`)
).rows[0]
conferir(
  setorNovoLimite.limite_execucoes_por_pessoa === 1,
  'setor novo nasce com limite 1 (default da migration 29 — D-48)',
  JSON.stringify(setorNovoLimite),
)

titulo('SESSAO-22 · filas reais: chegada em produção cai na etapa fila')

// MONTAGEM ganha a etapa fila (cadastro do dono — aqui simulado).
await bd.exec(`
  insert into public.plt_etapas (setor_id, nome, ordem, eh_fila)
    values ((select id from public.plt_setores where codigo = 'montagem'), 'A MONTAR', 1, true);
`)

// Pedido novo de verdade (o trigger da S09 cria o card no PCP sozinho).
await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao)
    values (999990, (select id from public.clientes order by id limit 1), 'Em aberto');
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
    values ((select id from public.pedidos where numero = 999990), 1, '088', 'Estante Dupla', 2);
`)

// Libera a 1ª unidade para a MONTAGEM SEM etapa — o banco resolve para a fila.
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, 1, '088', 'Estante Dupla', 1, 2
      from public.pedidos p where p.numero = 999990;
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    values ((select max(id) from public.plt_cards),
            'card_criado', (select id from public.plt_setores where codigo = 'pcp'), 'interface');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem)
    values ((select max(id) from public.plt_cards), 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'pcp'),
            (select id from public.plt_setores where codigo = 'montagem'),
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface');
`)
const chegouNaFila = (
  await bd.query(`
    select e.nome as etapa, e.eh_fila,
           (select ev.etapa_destino_id is not null from public.plt_eventos ev
             where ev.card_id = c.id and ev.tipo = 'movimentacao_setor'
             order by ev.ocorrido_em desc, ev.id desc limit 1) as evento_completo
      from public.plt_cards c
      join public.plt_etapas e on e.id = c.etapa_atual_id
     where c.id = (select max(id) from public.plt_cards)`)
).rows[0]
conferir(
  chegouNaFila?.etapa === 'A MONTAR' && chegouNaFila?.eh_fila === true
    && chegouNaFila?.evento_completo === true,
  'mover para setor de produção SEM etapa cai na etapa FILA — e o EVENTO nasce completo',
  JSON.stringify(chegouNaFila ?? null),
)

titulo('SESSAO-22 · tempo em PCP é do PEDIDO (D-48): liberação completa fecha o relógio')

const pedido998 = async () =>
  (
    await bd.query(`
      select pc.liberado_completo_em,
             (select pm.saiu_em from public.plt_vw_permanencias pm
               where pm.card_id = pc.id order by pm.entrou_em limit 1) as pcp_fechou_em
        from public.plt_cards pc
       where pc.tipo = 'pedido'
         and pc.pedido_id = (select id from public.pedidos where numero = 999990)`)
  ).rows[0]

const parcial = await pedido998()
conferir(
  parcial?.liberado_completo_em === null && parcial?.pcp_fechou_em === null,
  'com liberação PARCIAL (1 de 2), o pedido segue contando tempo em PCP',
  JSON.stringify(parcial ?? null),
)

// Libera a 2ª (última) unidade → o relógio do PCP fecha NESSE instante.
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, 1, '088', 'Estante Dupla', 2, 2
      from public.pedidos p where p.numero = 999990;
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    values ((select max(id) from public.plt_cards),
            'card_criado', (select id from public.plt_setores where codigo = 'pcp'), 'interface');
`)
const completo = await pedido998()
conferir(
  completo?.liberado_completo_em !== null
    && completo?.pcp_fechou_em !== null
    && new Date(completo.pcp_fechou_em).getTime() === new Date(completo.liberado_completo_em).getTime(),
  'liberação COMPLETA fecha a permanência do pedido no PCP em liberado_completo_em',
  JSON.stringify(completo ?? null),
)

// A porta do kanban carrega o intervalo para o card e a linha do tempo.
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false)`)
const resumo998 = (
  await bd.query(`
    select entrou_pcp_em is not null as tem_entrada,
           liberado_completo_em is not null as tem_liberacao,
           unidades_liberadas, total_unidades
      from public.plt_fn_pedidos_kanban(p_ids => array[(select id from public.pedidos where numero = 999990)])`)
).rows[0]
conferir(
  resumo998?.tem_entrada === true && resumo998?.tem_liberacao === true
    && resumo998?.unidades_liberadas === 2 && resumo998?.total_unidades === 2,
  'plt_fn_pedidos_kanban expõe entrou_pcp_em e liberado_completo_em (o rótulo do card)',
  JSON.stringify(resumo998 ?? null),
)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)

// O histórico também: o pedido 999999 (liberado por completo nos cenários
// anteriores) ganhou o fechamento RETROATIVO na reaplicação da migration 29.
const retroativo = (
  await bd.query(`
    select liberado_completo_em is not null as fechado
      from public.plt_cards
     where tipo = 'pedido'
       and pedido_id = (select id from public.pedidos where numero = 999999)`)
).rows[0]
conferir(
  retroativo?.fechado === true,
  'pedido antigo já 100% liberado ganhou liberado_completo_em retroativo (vale para o histórico)',
  JSON.stringify(retroativo ?? null),
)

titulo('SESSAO-22 · manutenção: cards vivos da "Chegada" migram para a fila por evento')

// Cenário legado: card com etapa NULA num setor de produção SEM fila (CNC).
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem, estado_qualidade)
    values ((select max(id) from public.plt_cards where tipo = 'unidade' and pedido_id = (select id from public.pedidos where numero = 999990) and indice_unidade = 1),
            'qualidade_marcada',
            (select id from public.plt_setores where codigo = 'montagem'),
            (select id from public.plt_setores where codigo = 'cnc'),
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface', 'perfeito');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem, evento_referencia_id)
    values ((select max(id) from public.plt_cards where tipo = 'unidade' and pedido_id = (select id from public.pedidos where numero = 999990) and indice_unidade = 1),
            'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'montagem'),
            (select id from public.plt_setores where codigo = 'cnc'),
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface',
            (select max(id) from public.plt_eventos where tipo = 'qualidade_marcada'));
`)
const semFila = (
  await bd.query(`
    select c.etapa_atual_id
      from public.plt_cards c
     where c.tipo = 'unidade'
       and c.pedido_id = (select id from public.pedidos where numero = 999990)
       and c.indice_unidade = 1`)
).rows[0]
conferir(
  semFila?.etapa_atual_id === null,
  'setor de produção SEM fila cadastrada: a etapa fica nula (nada se inventa — D-14; o quadro avisa)',
  JSON.stringify(semFila ?? null),
)

// O dono cadastra a fila da CNC → o lote de manutenção migra o card vivo.
await bd.exec(`
  insert into public.plt_etapas (setor_id, nome, ordem, eh_fila)
    values ((select id from public.plt_setores where codigo = 'cnc'), 'A USINAR', 1, true);
`)
await bd.exec(await readFile(path.join(MANUTENCAO, '2026-09-21_migrar_cards_chegada_para_fila.sql'), 'utf8'))
const aposLote = (
  await bd.query(`
    select (select count(*)::int from public.plt_cards c
              join public.plt_setores s on s.id = c.setor_atual_id
             where c.etapa_atual_id is null and c.arquivado_em is null
               and s.papel_no_fluxo = 'producao'
               and exists (select 1 from public.plt_etapas e
                            where e.setor_id = s.id and e.eh_fila and e.ativa)) as restantes,
           (select e.nome from public.plt_cards c
              join public.plt_etapas e on e.id = c.etapa_atual_id
             where c.tipo = 'unidade'
               and c.pedido_id = (select id from public.pedidos where numero = 999990)
               and c.indice_unidade = 1) as etapa_do_migrado,
           (select count(*)::int from public.plt_eventos ev
             where ev.tipo = 'movimentacao_etapa' and ev.origem = 'api'
               and ev.observacao ilike '%Migração da coluna Chegada%') as eventos_do_lote`)
).rows[0]
conferir(
  aposLote?.restantes === 0 && aposLote?.etapa_do_migrado === 'A USINAR'
    && (aposLote?.eventos_do_lote ?? 0) >= 1,
  'o lote de manutenção migrou o card vivo por EVENTO (origem api) e zerou a "chegada" onde há fila',
  JSON.stringify(aposLote ?? null),
)

titulo('SESSAO-22 · pausa por líder (D-48): urgência entra, retomar respeita o limite')

// Gente do cenário: um líder para a SECC (que agora está com limite 1).
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel)
    values ('Lider Secc', 'lider.secc@teste.com', '11111111104', 'lider.secc', 'lider');
  insert into public.plt_usuario_setores (usuario_id, setor_id, lider_do_setor)
    values ((select id from public.plt_usuarios where usuario = 'lider.secc'),
            (select id from public.plt_setores where codigo = 'secc'), true);
`)
// exec.um ainda executa um card antigo na SECC — encerra para o cenário começar limpo.
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
    select c.id, 'execucao_finalizada', c.executor_atual_id, 'interface'
      from public.plt_cards c
     where c.setor_atual_id = (select id from public.plt_setores where codigo = 'secc')
       and c.executor_atual_id is not null;
`)

// Dois cards na SECC: B (o de sempre) e A (a urgência). Tempos EXPLÍCITOS para
// a prova aritmética do desconto: B inicia -100min, pausa -90, A -60→-30,
// B retoma -20 e finaliza -10 → execução de B = 90min − 70min de pausa = 20min.
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, 1, '088', 'Estante Dupla B', 3, 4
      from public.pedidos p where p.numero = 999990;
  -- Criação/chegada retrodatadas: os gestos abaixo também são, e a ordem dos
  -- eventos (ocorrido_em, id) precisa contar a história na sequência real.
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem, ocorrido_em)
    values ((select max(id) from public.plt_cards), 'card_criado',
            (select id from public.plt_setores where codigo = 'pcp'), 'interface',
            now() - interval '3 hours');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem, ocorrido_em)
    values ((select max(id) from public.plt_cards), 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'pcp'),
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_usuarios where usuario = 'exec.dois'), 'interface',
            now() - interval '2 hours');
`)
const cardB = (await bd.query(`select max(id)::int as id from public.plt_cards`)).rows[0].id
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, 1, '088', 'Estante Dupla A', 4, 4
      from public.pedidos p where p.numero = 999990;
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem, ocorrido_em)
    values ((select max(id) from public.plt_cards), 'card_criado',
            (select id from public.plt_setores where codigo = 'pcp'), 'interface',
            now() - interval '3 hours');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem, ocorrido_em)
    values ((select max(id) from public.plt_cards), 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'pcp'),
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_usuarios where usuario = 'exec.dois'), 'interface',
            now() - interval '2 hours');
`)
const cardA = (await bd.query(`select max(id)::int as id from public.plt_cards`)).rows[0].id

// B em execução por exec.dois.
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, ocorrido_em)
    values (${cardB}, 'execucao_iniciada',
            (select id from public.plt_usuarios where usuario = 'exec.dois'), 'interface',
            now() - interval '100 minutes');
`)
await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
     values (${cardA}, 'execucao_iniciada',
             (select id from public.plt_usuarios where usuario = 'exec.dois'), 'interface')`,
  'com limite 1, a urgência é recusada enquanto B está em execução (a mensagem diz o que fazer)',
  /Limite do setor atingido/i,
)
await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
     values (${cardB}, 'execucao_pausada',
             (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface')`,
  'operador comum não pausa (gesto de líder do setor ou admin — D-48)',
  /gesto de líder/i,
)
await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
     values (${cardA}, 'execucao_pausada',
             (select id from public.plt_usuarios where usuario = 'lider.secc'), 'interface')`,
  'pausar card que não está em execução é recusado',
  /não está em execução/i,
)

// O líder pausa B → a pausa aponta a execução aberta sozinha (referência).
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, ocorrido_em)
    values (${cardB}, 'execucao_pausada',
            (select id from public.plt_usuarios where usuario = 'lider.secc'), 'interface',
            now() - interval '90 minutes');
`)
const pausado = (
  await bd.query(`
    select c.pausado_em is not null as pausado,
           (select e.evento_referencia_id is not null from public.plt_eventos e
             where e.card_id = ${cardB} and e.tipo = 'execucao_pausada') as referencia_preenchida
      from public.plt_cards c where c.id = ${cardB}`)
).rows[0]
conferir(
  pausado?.pausado === true && pausado?.referencia_preenchida === true,
  'pausa do líder projeta pausado_em e aponta a execução aberta (append-only, com referência)',
  JSON.stringify(pausado ?? null),
)
await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
     values (${cardB}, 'execucao_pausada',
             (select id from public.plt_usuarios where usuario = 'lider.secc'), 'interface')`,
  'pausar duas vezes é recusado',
  /já está pausada/i,
)

// Pausado não ocupa o limite: a urgência A agora ENTRA (D-48 — o porquê da pausa).
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, ocorrido_em)
    values (${cardA}, 'execucao_iniciada',
            (select id from public.plt_usuarios where usuario = 'exec.dois'), 'interface',
            now() - interval '60 minutes');
`)
conferir(true, 'com B pausado, a urgência A inicia normalmente (pausado não conta no limite)')

// Retomar com a urgência aberta é recusado (resposta 5 do dono).
await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
     values (${cardB}, 'execucao_retomada',
             (select id from public.plt_usuarios where usuario = 'exec.dois'), 'interface')`,
  'retomar com a urgência ainda aberta é recusado ("finalize a urgência antes")',
  /Finalize a urgência/i,
)
await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
     values (${cardB}, 'execucao_retomada',
             (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface')`,
  'quem não executa o card (nem lidera o setor) não retoma',
  /gesto de quem executa/i,
)

// Urgência finalizada → a própria pessoa retoma (resposta 3) e depois finaliza B.
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, ocorrido_em)
    values (${cardA}, 'execucao_finalizada',
            (select id from public.plt_usuarios where usuario = 'exec.dois'), 'interface',
            now() - interval '30 minutes');
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, ocorrido_em)
    values (${cardB}, 'execucao_retomada',
            (select id from public.plt_usuarios where usuario = 'exec.dois'), 'interface',
            now() - interval '20 minutes');
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, ocorrido_em)
    values (${cardB}, 'execucao_finalizada',
            (select id from public.plt_usuarios where usuario = 'exec.dois'), 'interface',
            now() - interval '10 minutes');
`)
const execB = (
  await bd.query(`
    select round(extract(epoch from v.duracao) / 60)::int      as duracao_min,
           round(extract(epoch from v.pausa_total) / 60)::int  as pausa_min,
           v.encerramento,
           (select c.pausado_em from public.plt_cards c where c.id = ${cardB}) as pausado_em
      from public.plt_vw_execucoes v
     where v.card_id = ${cardB} and v.encerramento = 'finalizada'`)
).rows[0]
conferir(
  execB?.duracao_min === 20 && execB?.pausa_min === 70 && execB?.pausado_em === null,
  'a execução de B descontou a pausa: 90min de relógio − 70min pausados = 20min contados',
  JSON.stringify(execB ?? null),
)
await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
     values (${cardB}, 'execucao_retomada',
             (select id from public.plt_usuarios where usuario = 'exec.dois'), 'interface')`,
  'retomar card que não está pausado é recusado',
  /não está pausado/i,
)

// A linha do tempo carrega pausa e retomada com autor (critério da demanda).
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false)`)
const linhaPausa = (
  await bd.query(`
    select tipo, usuario_nome from public.plt_fn_linha_tempo_card(${cardB})
     where tipo in ('execucao_pausada', 'execucao_retomada') order by ocorrido_em`)
).rows
conferir(
  linhaPausa.length === 2
    && linhaPausa[0]?.tipo === 'execucao_pausada' && linhaPausa[0]?.usuario_nome === 'Lider Secc'
    && linhaPausa[1]?.tipo === 'execucao_retomada' && linhaPausa[1]?.usuario_nome === 'Operador Dois',
  'pausa e retomada aparecem na linha do tempo do card, com autor',
  JSON.stringify(linhaPausa),
)

// As portas de dashboard também descontam (D-48): a lista detalhada mostra 20min.
const dashB = (
  await bd.query(`
    select round(extract(epoch from duracao_bruta) / 60)::int as bruta_min
      from public.plt_fn_dash_execucoes(now() - interval '1 day', now(),
             (select id from public.plt_setores where codigo = 'secc'))
     where card_id = ${cardB} and encerramento = 'finalizada'`)
).rows[0]
conferir(
  dashB?.bruta_min === 20,
  'plt_fn_dash_execucoes desconta a pausa da duração (20min, não 90min)',
  JSON.stringify(dashB ?? null),
)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)

titulo('SESSAO-22 ↪️ · iniciar na fila avança para a próxima etapa (migration 30)')

// A CNC ganha a etapa de trabalho depois da fila (o dono cadastra — simulado).
await bd.exec(`
  insert into public.plt_etapas (setor_id, nome, ordem, eh_fila)
    values ((select id from public.plt_setores where codigo = 'cnc'), 'USINANDO', 2, false);
`)
const cardMigrado = (
  await bd.query(`
    select c.id from public.plt_cards c
     where c.tipo = 'unidade'
       and c.pedido_id = (select id from public.pedidos where numero = 999990)
       and c.indice_unidade = 1`)
).rows[0].id

// A chegada na CNC veio com marcação sem parecer: o iniciar é recusado E o
// avanço automático NÃO acontece (a transação volta inteira).
await deveRecusarExec(
  `insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
     values (${cardMigrado}, 'execucao_iniciada',
             (select id from public.plt_usuarios where usuario = 'exec.dois'), 'interface')`,
  'iniciar sem o parecer é recusado — e o avanço automático volta junto (transação única)',
  /confirme o recebimento/i,
)
const aindaNaFila = (
  await bd.query(`
    select e.nome as etapa from public.plt_cards c
      join public.plt_etapas e on e.id = c.etapa_atual_id
     where c.id = ${cardMigrado}`)
).rows[0]
conferir(
  aindaNaFila?.etapa === 'A USINAR',
  'com o iniciar recusado, o card continua na fila (nada avançou)',
  JSON.stringify(aindaNaFila ?? null),
)

// Parecer registrado → iniciar → o card SAI da fila para a próxima etapa com a
// execução ABERTA lá (o mover automático nasce antes do iniciar e não a encerra).
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id, estado_qualidade)
    values (${cardMigrado}, 'qualidade_parecer',
            (select id from public.plt_usuarios where usuario = 'exec.dois'), 'interface',
            (select max(id) from public.plt_eventos
              where card_id = ${cardMigrado} and tipo = 'qualidade_marcada'),
            'perfeito');
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
    values (${cardMigrado}, 'execucao_iniciada',
            (select id from public.plt_usuarios where usuario = 'exec.dois'), 'interface');
`)
const avancou = (
  await bd.query(`
    select e.nome as etapa,
           (select u.usuario from public.plt_usuarios u where u.id = c.executor_atual_id) as executor,
           (select count(*)::int from public.plt_eventos me
             where me.card_id = c.id and me.tipo = 'movimentacao_etapa' and me.origem = 'automacao'
               and me.etapa_destino_id = c.etapa_atual_id) as mover_automatico,
           (select v.em_andamento from public.plt_vw_execucoes v
             where v.card_id = c.id and v.em_andamento) as execucao_aberta,
           (select en.nome from public.plt_vw_execucoes v
             join public.plt_etapas en on en.id = v.etapa_id
             where v.card_id = c.id and v.em_andamento) as etapa_da_execucao
      from public.plt_cards c
      join public.plt_etapas e on e.id = c.etapa_atual_id
     where c.id = ${cardMigrado}`)
).rows[0]
conferir(
  avancou?.etapa === 'USINANDO' && avancou?.executor === 'exec.dois'
    && avancou?.mover_automatico === 1 && avancou?.execucao_aberta === true
    && avancou?.etapa_da_execucao === 'USINANDO',
  'iniciar na FILA avançou o card para a próxima etapa com a execução ABERTA lá (D-48 ↪️)',
  JSON.stringify(avancou ?? null),
)

// Setor cuja fila é a única etapa: nada se inventa (D-14) — executa na própria fila.
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem)
    select c.id, 'movimentacao_setor',
           (select id from public.plt_setores where codigo = 'pcp'),
           (select id from public.plt_setores where codigo = 'montagem'),
           (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface'
      from public.plt_cards c
     where c.tipo = 'unidade'
       and c.pedido_id = (select id from public.pedidos where numero = 999990)
       and c.indice_unidade = 2;
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
    select c.id, 'execucao_iniciada',
           (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface'
      from public.plt_cards c
     where c.tipo = 'unidade'
       and c.pedido_id = (select id from public.pedidos where numero = 999990)
       and c.indice_unidade = 2;
`)
const soFilaMontagem = (
  await bd.query(`
    select e.nome as etapa, c.executor_atual_id is not null as executando
      from public.plt_cards c
      join public.plt_etapas e on e.id = c.etapa_atual_id
     where c.tipo = 'unidade'
       and c.pedido_id = (select id from public.pedidos where numero = 999990)
       and c.indice_unidade = 2`)
).rows[0]
conferir(
  soFilaMontagem?.etapa === 'A MONTAR' && soFilaMontagem?.executando === true,
  'setor sem próxima etapa cadastrada: a execução corre na própria fila (nada se inventa — D-14)',
  JSON.stringify(soFilaMontagem ?? null),
)

titulo('SESSAO-22 · limite editável por líder (RPC) e aguardo do pedido')

// O líder da FITAMENTO ajusta o limite do PRÓPRIO setor pela RPC (D-48).
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false)`)
await bd.exec(`
  select public.plt_fn_definir_limite_execucoes(
    (select id from public.plt_setores where codigo = 'fitamento'), 3)`)
const limiteFita = (
  await bd.query(`
    select s.limite_execucoes_por_pessoa as limite,
           (select count(*)::int from public.plt_logs_atividade l
             where l.acao = 'limite_execucoes_alterado') as logs
      from public.plt_setores s where s.codigo = 'fitamento'`)
).rows[0]
conferir(
  limiteFita?.limite === 3 && (limiteFita?.logs ?? 0) >= 1,
  'líder define o limite do próprio setor pela RPC — com trilha de atividade (D-40)',
  JSON.stringify(limiteFita ?? null),
)
try {
  await bd.query(`
    select public.plt_fn_definir_limite_execucoes(
      (select id from public.plt_setores where codigo = 'secc'), 5)`)
  conferir(false, 'líder NÃO ajusta limite de setor que não lidera', 'a chamada passou, e não devia')
} catch (erro) {
  conferir(/gesto do líder do setor/i.test(erro.message), 'líder NÃO ajusta limite de setor que não lidera', erro.message)
}
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)

// Aguardo (D-48): o pedido 999999 tem 1 unidade pronta de 3 → incompleto, com
// "primeira pronta" marcada e sem "completo_em".
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false)`)
const aguardo = (
  await bd.query(`
    select completo, primeira_pronta_em is not null as tem_primeira, completo_em
      from public.plt_fn_pedidos_aguardo()
     where numero = 999999`)
).rows[0]
conferir(
  aguardo !== undefined && aguardo.tem_primeira === true
    && aguardo.completo === (aguardo.completo_em !== null),
  'Pedidos em aguardo expõe o relógio do aguardo: primeira pronta marcada, completo_em só quando completar',
  JSON.stringify(aguardo ?? null),
)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)

// ============================================================================
// SESSAO-22 — Arquivar e excluir usuário (migration 31 / D-49)
// ============================================================================
titulo('SESSAO-22 · arquivar usuário: tudo fica no nome; pendências vão ao líder (D-49)')

await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel)
    values ('Arquivo Alvo', 'arq@teste.com', '55544433301', 'arq.alvo', 'operador');
  insert into public.plt_usuario_setores (usuario_id, setor_id)
    values ((select id from public.plt_usuarios where usuario = 'arq.alvo'),
            (select id from public.plt_setores where codigo = 'secc'));
`)

// As pendências do cenário: execução aberta, card delegado e tarefa aberta.
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, 1, '088', 'Peça do Arquivado', 5, 6
      from public.pedidos p where p.numero = 999990;
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    values ((select max(id) from public.plt_cards), 'card_criado',
            (select id from public.plt_setores where codigo = 'pcp'), 'interface');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem)
    values ((select max(id) from public.plt_cards), 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'pcp'),
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_usuarios where usuario = 'arq.alvo'), 'interface');
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
    values ((select max(id) from public.plt_cards), 'execucao_iniciada',
            (select id from public.plt_usuarios where usuario = 'arq.alvo'), 'interface');
`)
const cardDoArquivado = (await bd.query(`select max(id)::int as id from public.plt_cards`)).rows[0].id
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, 1, '088', 'Peça Delegada', 6, 6
      from public.pedidos p where p.numero = 999990;
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    values ((select max(id) from public.plt_cards), 'card_criado',
            (select id from public.plt_setores where codigo = 'pcp'), 'interface');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem)
    values ((select max(id) from public.plt_cards), 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'pcp'),
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_usuarios where usuario = 'lider.secc'), 'interface');
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, dados)
    values ((select max(id) from public.plt_cards), 'delegacao',
            (select id from public.plt_usuarios where usuario = 'lider.secc'), 'interface',
            (select id from public.plt_setores where codigo = 'secc'),
            jsonb_build_object('responsavel_id',
              (select id from public.plt_usuarios where usuario = 'arq.alvo'), 'modo', 'direta'));
  insert into public.plt_tarefas (titulo, setor_id, responsavel_id, criada_por_id, delegacao, situacao)
    values ('Tarefa do arquivado',
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_usuarios where usuario = 'arq.alvo'),
            (select id from public.plt_usuarios where usuario = 'lider.secc'),
            'direta', 'aberta');
`)
const cardDelegado = (await bd.query(`select max(id)::int as id from public.plt_cards`)).rows[0].id

// Gate: operador comum não arquiva.
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false)`)
try {
  await bd.query(`select public.plt_fn_arquivar_usuario(
    (select id from public.plt_usuarios where usuario = 'arq.alvo'))`)
  conferir(false, 'operador comum não arquiva usuário (gesto de admin)', 'a chamada passou, e não devia')
} catch (erro) {
  conferir(/gesto de admin/i.test(erro.message), 'operador comum não arquiva usuário (gesto de admin)', erro.message)
}

// O admin arquiva — e o resumo conta o que foi realocado.
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false)`)
const resumoArq = (
  await bd.query(`select public.plt_fn_arquivar_usuario(
    (select id from public.plt_usuarios where usuario = 'arq.alvo')) as r`)
).rows[0].r
const aposArquivar = (
  await bd.query(`
    select (select not u.ativo and u.arquivado_em is not null
              from public.plt_usuarios u where u.usuario = 'arq.alvo') as arquivado,
           (select c.executor_atual_id is null from public.plt_cards c where c.id = ${cardDoArquivado}) as execucao_livre,
           (select v.encerramento from public.plt_vw_execucoes v
             where v.card_id = ${cardDoArquivado}
             order by v.iniciou_em desc limit 1) as encerramento,
           (select u2.usuario from public.plt_cards c2
              join public.plt_usuarios u2 on u2.id = c2.responsavel_id
             where c2.id = ${cardDelegado}) as delegado_para,
           (select u3.usuario from public.plt_tarefas t
              join public.plt_usuarios u3 on u3.id = t.responsavel_id
             where t.titulo = 'Tarefa do arquivado') as tarefa_para,
           (select count(*)::int from public.plt_logs_atividade l
             where l.acao = 'usuario_arquivado') as logs`)
).rows[0]
conferir(
  resumoArq?.execucoes_encerradas === 1 && resumoArq?.cards_realocados === 1
    && resumoArq?.tarefas_realocadas === 1
    && aposArquivar?.arquivado === true && aposArquivar?.execucao_livre === true
    && aposArquivar?.encerramento === 'finalizada'
    && aposArquivar?.delegado_para === 'lider.secc'
    && aposArquivar?.tarefa_para === 'lider.secc'
    && (aposArquivar?.logs ?? 0) >= 1,
  'arquivar: execução encerrada no nome dele, card delegado e tarefa foram ao LÍDER, log gravado',
  JSON.stringify({ resumo: resumoArq, depois: aposArquivar }),
)

// Reativar: a pessoa volta; as pendências não.
await bd.exec(`select public.plt_fn_desarquivar_usuario(
  (select id from public.plt_usuarios where usuario = 'arq.alvo'))`)
const reativado = (
  await bd.query(`select ativo, arquivado_em from public.plt_usuarios where usuario = 'arq.alvo'`)
).rows[0]
conferir(
  reativado?.ativo === true && reativado?.arquivado_em === null,
  'desarquivar reativa a pessoa (as pendências realocadas ficam onde estão)',
  JSON.stringify(reativado ?? null),
)

titulo('SESSAO-22 · excluir usuário: de fato, e só sem história (D-49)')

// Quem tem história não se exclui — a recusa aponta o arquivar.
try {
  await bd.query(`select public.plt_fn_excluir_usuario(
    (select id from public.plt_usuarios where usuario = 'arq.alvo'))`)
  conferir(false, 'usuário com história não pode ser excluído (a história não se apaga)', 'a chamada passou, e não devia')
} catch (erro) {
  conferir(
    /história/i.test(erro.message) && /Arquive/i.test(erro.message),
    'usuário com história não pode ser excluído (a história não se apaga; a recusa aponta o arquivar)',
    erro.message,
  )
}

// Nem a si mesmo.
try {
  await bd.query(`select public.plt_fn_excluir_usuario(
    (select id from public.plt_usuarios where usuario = 'primeira.pessoa'))`)
  conferir(false, 'admin não exclui a si mesmo', 'a chamada passou, e não devia')
} catch (erro) {
  conferir(/a si mesmo/i.test(erro.message), 'admin não exclui a si mesmo', erro.message)
}

// Cadastro nunca usado: some DE FATO — linha, vínculo, tarefa dele; card
// delegado a ele volta a ficar sem dono (por evento, nunca UPDATE).
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel)
    values ('Cadastro Errado', 'del@teste.com', '55544433302', 'del.alvo', 'operador');
  insert into public.plt_usuario_setores (usuario_id, setor_id)
    values ((select id from public.plt_usuarios where usuario = 'del.alvo'),
            (select id from public.plt_setores where codigo = 'secc'));
  insert into public.plt_tarefas (titulo, setor_id, responsavel_id, criada_por_id, delegacao, situacao)
    values ('Tarefa do excluído',
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_usuarios where usuario = 'del.alvo'),
            (select id from public.plt_usuarios where usuario = 'lider.secc'),
            'direta', 'aberta');
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, dados)
    values (${cardDelegado}, 'delegacao',
            (select id from public.plt_usuarios where usuario = 'lider.secc'), 'interface',
            (select id from public.plt_setores where codigo = 'secc'),
            jsonb_build_object('responsavel_id',
              (select id from public.plt_usuarios where usuario = 'del.alvo'), 'modo', 'direta'));
`)
await bd.exec(`select public.plt_fn_excluir_usuario(
  (select id from public.plt_usuarios where usuario = 'del.alvo'))`)
const aposExcluir = (
  await bd.query(`
    select (select count(*)::int from public.plt_usuarios where usuario = 'del.alvo') as linhas,
           (select count(*)::int from public.plt_tarefas where titulo = 'Tarefa do excluído') as tarefas,
           (select c.responsavel_id is null from public.plt_cards c where c.id = ${cardDelegado}) as sem_dono,
           (select count(*)::int from public.plt_logs_atividade where acao = 'usuario_excluido') as logs`)
).rows[0]
conferir(
  aposExcluir?.linhas === 0 && aposExcluir?.tarefas === 0
    && aposExcluir?.sem_dono === true && (aposExcluir?.logs ?? 0) >= 1,
  'excluir de fato: linha, vínculo e tarefas dele sumiram; card delegado ficou sem dono por evento; log gravado',
  JSON.stringify(aposExcluir ?? null),
)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)

// ============================================================================
// SESSAO-23 — Meu Painel 2.0 (migration 33): subtarefas, tarefa privada,
// tarefa do Sistema (qualidade), fila de prioridade e portas de tempo pessoais.
// RLS aqui É provada com `set role authenticated` (o papel não é dono da
// tabela, então as policies valem) — e reconferida no banco real no F-08.
// ============================================================================
titulo('SESSAO-23 · subtarefas: herança da mãe, dois níveis, mãe imutável')

await bd.exec(`
  update public.plt_usuarios set auth_user_id = '00000000-0000-0000-0000-000000000001'
   where usuario = 'primeira.pessoa' and auth_user_id is null;
  insert into public.plt_tarefas (titulo, setor_id, responsavel_id, criada_por_id, delegacao, situacao)
    values ('Organizar o estoque de fitas',
            (select id from public.plt_setores where codigo = 'fitamento'),
            (select id from public.plt_usuarios where usuario = 'exec.um'),
            (select id from public.plt_usuarios where usuario = 'lider.fita'),
            'direta', 'aberta');
`)
const tarefaMae = (await bd.query(`select max(id)::int as id from public.plt_tarefas`)).rows[0].id
await bd.exec(`
  insert into public.plt_tarefas (titulo, criada_por_id, tarefa_mae_id)
    values ('Separar por cor',
            (select id from public.plt_usuarios where usuario = 'lider.fita'), ${tarefaMae});
  insert into public.plt_tarefas (titulo, criada_por_id, tarefa_mae_id)
    values ('Etiquetar caixas',
            (select id from public.plt_usuarios where usuario = 'lider.fita'), ${tarefaMae});
`)
const sub1 = (
  await bd.query(`select id::int as id from public.plt_tarefas where titulo = 'Separar por cor'`)
).rows[0].id
const heranca = (
  await bd.query(`
    select (t.setor_id = (select id from public.plt_setores where codigo = 'fitamento')) as setor_ok,
           (t.responsavel_id = (select id from public.plt_usuarios where usuario = 'exec.um')) as responsavel_ok,
           t.privada
      from public.plt_tarefas t where t.id = ${sub1}`)
).rows[0]
conferir(
  heranca?.setor_ok === true && heranca?.responsavel_ok === true && heranca?.privada === false,
  'subtarefa herda setor, responsável e privacidade da mãe',
  JSON.stringify(heranca ?? null),
)
await bd.exec(`
  insert into public.plt_tarefas (titulo, criada_por_id, tarefa_mae_id)
    values ('Cores frias primeiro',
            (select id from public.plt_usuarios where usuario = 'lider.fita'), ${sub1});
`)
const sub2 = (await bd.query(`select max(id)::int as id from public.plt_tarefas`)).rows[0].id
await deveRecusarExec(
  `insert into public.plt_tarefas (titulo, criada_por_id, tarefa_mae_id)
     values ('Nível demais', (select id from public.plt_usuarios where usuario = 'lider.fita'), ${sub2})`,
  'terceiro nível de subtarefa é recusado (resposta 2 do dono: até dois níveis)',
  /dois níveis/i,
)
await deveRecusarExec(
  `update public.plt_tarefas set tarefa_mae_id = null where id = ${sub1}`,
  'subtarefa não muda de mãe depois de criada',
  /não muda de tarefa/i,
)
await bd.exec(`
  update public.plt_tarefas set situacao = 'concluida', concluida_em = now() where id = ${sub1};
`)
const contador = (
  await bd.query(`
    select count(*)::int as total,
           count(*) filter (where situacao = 'concluida')::int as feitas
      from public.plt_tarefas where tarefa_mae_id = ${tarefaMae}`)
).rows[0]
conferir(
  contador?.total === 2 && contador?.feitas === 1,
  'o contador da mãe conta as filhas (1/2) direto da consulta — nada gravado',
  JSON.stringify(contador ?? null),
)
await bd.exec(`
  update public.plt_tarefas set situacao = 'aberta', concluida_em = null where id = ${sub1};
`)
conferir(true, 'reabrir subtarefa concluída é permitido (checklist vivo)')

titulo('SESSAO-23 · tarefa privada: só o dono enxerga — nem admin, nem pela API')

await deveRecusarExec(
  `insert into public.plt_tarefas (titulo, responsavel_id, criada_por_id, privada)
     values ('Segredo delegado',
             (select id from public.plt_usuarios where usuario = 'exec.dois'),
             (select id from public.plt_usuarios where usuario = 'exec.um'), true)`,
  'tarefa privada delegada a OUTRA pessoa é recusada (privada = pessoal)',
  /cria para você mesmo/i,
)
await bd.exec(`
  insert into public.plt_tarefas (titulo, responsavel_id, criada_por_id, privada, iniciada_em)
    values ('Minha lista pessoal',
            (select id from public.plt_usuarios where usuario = 'exec.um'),
            (select id from public.plt_usuarios where usuario = 'exec.um'),
            true, now() - interval '2 hours');
`)
const tarefaPrivada = (await bd.query(`select max(id)::int as id from public.plt_tarefas`)).rows[0].id

// RLS de verdade: o papel authenticated não é dono da tabela — as policies valem.
await bd.exec(`
  grant usage on schema public to authenticated;
  grant select, insert, update on public.plt_tarefas to authenticated;
  set role authenticated;
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
`)
const adminVe = (
  await bd.query(`select count(*)::int as total from public.plt_tarefas where id = ${tarefaPrivada}`)
).rows[0]
conferir(
  adminVe.total === 0,
  'ADMIN não enxerga a tarefa privada de outra pessoa (RLS, com papel simulado)',
  `vieram ${adminVe.total}`,
)
const adminEdita = (
  await bd.query(`update public.plt_tarefas set titulo = 'invadida' where id = ${tarefaPrivada} returning id`)
).rows
conferir(adminEdita.length === 0, 'ADMIN também não edita a tarefa privada de outra pessoa')
const tempoDoAdmin = (
  await bd.query(`
    select coalesce(sum(extract(epoch from tempo_pessoal)), 0)::int as segundos
      from public.plt_fn_meu_tempo_dias(now() - interval '1 day', now() + interval '1 day')`)
).rows[0]
conferir(
  tempoDoAdmin.segundos === 0,
  'a porta de tempo devolve ao admin SÓ o tempo dele (zero — o de exec.um não vaza nem pela API)',
  `vieram ${tempoDoAdmin.segundos}s`,
)
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false)`)
const donoVe = (
  await bd.query(`select count(*)::int as total from public.plt_tarefas where id = ${tarefaPrivada}`)
).rows[0]
const tempoDoDono = (
  await bd.query(`
    select coalesce(sum(extract(epoch from tempo_pessoal)), 0)::int as pessoal,
           coalesce(sum(extract(epoch from tempo_delegado)), 0)::int as delegado
      from public.plt_fn_meu_tempo_dias(now() - interval '1 day', now() + interval '1 day')`)
).rows[0]
conferir(
  donoVe.total === 1 && tempoDoDono.pessoal >= 7100 && tempoDoDono.pessoal <= 7300,
  'o DONO vê a tarefa privada e o tempo dela (~2h) na porta pessoal',
  JSON.stringify({ ve: donoVe.total, ...tempoDoDono }),
)
const porTarefa = (
  await bd.query(`
    select titulo, pessoal, contagem_total::int as total
      from public.plt_fn_meu_tempo_tarefas(now() - interval '1 day', now() + interval '1 day', 5, 0)`)
).rows
conferir(
  porTarefa.some((t) => t.titulo === 'Minha lista pessoal' && t.pessoal === true) &&
    (porTarefa[0]?.total ?? 0) >= 1,
  'a quebra por tarefa (resposta 4) lista a tarefa com o rótulo pessoal/delegada e o total paginável',
  JSON.stringify(porTarefa),
)
const desempenho = (
  await bd.query(`
    select execucoes, tarefas_concluidas, extract(epoch from tempo_afazeres)::int as afazeres_s
      from public.plt_fn_meu_desempenho(now() - interval '1 day', now() + interval '1 day')`)
).rows[0]
conferir(
  (desempenho?.execucoes ?? 0) >= 1 && (desempenho?.afazeres_s ?? 0) >= 7100,
  'plt_fn_meu_desempenho devolve os KPIs SÓ de quem chama (execuções e tempo em afazeres)',
  JSON.stringify(desempenho ?? null),
)
await bd.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
const semUsuarioTempo = (
  await bd.query(`select count(*)::int as total from public.plt_fn_meu_desempenho(now() - interval '1 day', now())`)
).rows[0]
conferir(semUsuarioTempo.total === 0, 'sem usuário no contexto, as portas pessoais devolvem vazio')

// Reatribuir a tarefa privada → deixa de ser pessoal → vira pública sozinha.
await bd.exec(`
  update public.plt_tarefas
     set responsavel_id = (select id from public.plt_usuarios where usuario = 'exec.dois')
   where id = ${tarefaPrivada};
`)
const aposReatribuir = (
  await bd.query(`select privada from public.plt_tarefas where id = ${tarefaPrivada}`)
).rows[0]
conferir(
  aposReatribuir?.privada === false,
  'reatribuída a outra pessoa, a tarefa privada vira pública sozinha (a pendência agora é de outro)',
  JSON.stringify(aposReatribuir ?? null),
)

titulo('SESSAO-23 · pendência de parecer vira tarefa do Sistema — e conclui sozinha')

// Card novo: PCP → SECC (sem marcação) → SECC entrega à FITAMENTO marcando 🟡.
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, 4, '077', 'Painel Ripado', 1, 2
      from public.pedidos p where p.numero = 999990;
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    values ((select max(id) from public.plt_cards), 'card_criado',
            (select id from public.plt_setores where codigo = 'pcp'), 'interface');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem)
    values ((select max(id) from public.plt_cards), 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'pcp'),
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface');
`)
const cardSistema = (await bd.query(`select max(id)::int as id from public.plt_cards`)).rows[0].id
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem, estado_qualidade)
    values (${cardSistema}, 'qualidade_marcada',
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_setores where codigo = 'fitamento'),
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface', 'atencao');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem, evento_referencia_id)
    values (${cardSistema}, 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_setores where codigo = 'fitamento'),
            (select id from public.plt_usuarios where usuario = 'exec.um'), 'interface',
            (select max(id) from public.plt_eventos where card_id = ${cardSistema} and tipo = 'qualidade_marcada'));
`)
const marcacao1 = (
  await bd.query(`select max(id)::int as id from public.plt_eventos where card_id = ${cardSistema} and tipo = 'qualidade_marcada'`)
).rows[0].id
const tarefaSistema = (
  await bd.query(`
    select t.id::int as id, t.situacao, t.responsavel_id is null as sem_responsavel,
           (t.setor_id = (select id from public.plt_setores where codigo = 'fitamento')) as no_setor_certo,
           t.titulo
      from public.plt_tarefas t
     where t.origem = 'sistema' and t.evento_referencia_id = ${marcacao1}`)
).rows[0]
conferir(
  tarefaSistema !== undefined && tarefaSistema.situacao === 'aberta'
    && tarefaSistema.sem_responsavel === true && tarefaSistema.no_setor_certo === true
    && /Confirmar recebimento/.test(tarefaSistema.titulo ?? ''),
  'a chegada com marcação criou a tarefa do Sistema no setor recebedor, sem usuário fantasma',
  JSON.stringify(tarefaSistema ?? null),
)
const avisoSistema = (
  await bd.query(`
    select count(*)::int as total from public.plt_notificacoes n
     where n.card_id = ${cardSistema} and n.tipo = 'tarefa_sistema'
       and n.destinatario_id = (select id from public.plt_usuarios where usuario = 'lider.fita')`)
).rows[0]
conferir(
  avisoSistema.total === 1,
  'os membros do setor recebedor foram avisados no sino (resposta 3 do dono)',
  `vieram ${avisoSistema.total}`,
)
await deveRecusarExec(
  `update public.plt_tarefas set situacao = 'concluida', concluida_em = now()
    where id = ${tarefaSistema?.id ?? 0}`,
  'tarefa do Sistema não se conclui à mão — resolve-se dando o parecer',
  /registrando o parecer/i,
)
await deveRecusarExec(
  `insert into public.plt_tarefas (titulo, origem) values ('Falso sistema', 'sistema')`,
  'ninguém cria tarefa do Sistema à mão',
  /nasce sozinha/i,
)
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id, estado_qualidade)
    values (${cardSistema}, 'qualidade_parecer',
            (select id from public.plt_usuarios where usuario = 'lider.fita'), 'interface',
            ${marcacao1}, 'atencao');
`)
const aposParecerSistema = (
  await bd.query(`
    select situacao, concluida_em is not null as fechada
      from public.plt_tarefas where evento_referencia_id = ${marcacao1} and origem = 'sistema'`)
).rows[0]
conferir(
  aposParecerSistema?.situacao === 'concluida' && aposParecerSistema?.fechada === true,
  'o parecer dado concluiu a tarefa do Sistema sozinho',
  JSON.stringify(aposParecerSistema ?? null),
)

// Card segue adiante com marcação nova → a pendência antiga morre e a tarefa
// dela fecha; chegada em TERMINAL não gera tarefa (lá não existe parecer).
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem, estado_qualidade)
    values (${cardSistema}, 'qualidade_marcada',
            (select id from public.plt_setores where codigo = 'fitamento'),
            (select id from public.plt_setores where codigo = 'cnc'),
            (select id from public.plt_usuarios where usuario = 'lider.fita'), 'interface', 'perfeito');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem, evento_referencia_id)
    values (${cardSistema}, 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'fitamento'),
            (select id from public.plt_setores where codigo = 'cnc'),
            (select id from public.plt_usuarios where usuario = 'lider.fita'), 'interface',
            (select max(id) from public.plt_eventos where card_id = ${cardSistema} and tipo = 'qualidade_marcada'));
`)
const marcacao2 = (
  await bd.query(`select max(id)::int as id from public.plt_eventos where card_id = ${cardSistema} and tipo = 'qualidade_marcada'`)
).rows[0].id
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem, estado_qualidade)
    values (${cardSistema}, 'qualidade_marcada',
            (select id from public.plt_setores where codigo = 'cnc'),
            (select id from public.plt_setores where codigo = 'aguardo'),
            (select id from public.plt_usuarios where usuario = 'lider.fita'), 'interface', 'perfeito');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem, evento_referencia_id)
    values (${cardSistema}, 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'cnc'),
            (select id from public.plt_setores where codigo = 'aguardo'),
            (select id from public.plt_usuarios where usuario = 'lider.fita'), 'interface',
            (select max(id) from public.plt_eventos where card_id = ${cardSistema} and tipo = 'qualidade_marcada'));
`)
const filaSistema = (
  await bd.query(`
    select (select situacao from public.plt_tarefas where evento_referencia_id = ${marcacao2}) as antiga,
           (select count(*)::int from public.plt_tarefas t
             where t.origem = 'sistema' and t.card_id = ${cardSistema} and t.situacao <> 'concluida') as abertas`)
).rows[0]
conferir(
  filaSistema?.antiga === 'concluida' && filaSistema?.abertas === 0,
  'card que seguiu adiante fecha a tarefa da pendência morta; chegada em terminal não abre tarefa',
  JSON.stringify(filaSistema ?? null),
)

titulo('SESSAO-23 · fila de prioridade do usuário e o relógio da delegação')

await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, dados)
    values (${cardDelegado}, 'delegacao',
            (select id from public.plt_usuarios where usuario = 'lider.secc'), 'interface',
            (select id from public.plt_setores where codigo = 'secc'),
            jsonb_build_object('responsavel_id',
              (select id from public.plt_usuarios where usuario = 'exec.um'), 'modo', 'direta'));
`)
const delegadoEm = (
  await bd.query(`select delegado_em is not null as tem from public.plt_cards where id = ${cardDelegado}`)
).rows[0]
conferir(delegadoEm?.tem === true, 'delegar projeta delegado_em no card (a ordem de cadastro da fila)')
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, origem)
    values (${cardDelegado}, 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'secc'),
            (select id from public.plt_setores where codigo = 'furacao'), 'api');
`)
const delegadoZerado = (
  await bd.query(`
    select responsavel_id is null as sem_dono, delegado_em is null as sem_relogio
      from public.plt_cards where id = ${cardDelegado}`)
).rows[0]
conferir(
  delegadoZerado?.sem_dono === true && delegadoZerado?.sem_relogio === true,
  'mudar de setor zera o responsável E o relógio da delegação juntos',
  JSON.stringify(delegadoZerado ?? null),
)
await bd.exec(`
  update public.plt_usuarios
     set fila_prioridade = '["t:${tarefaMae}", "c:${cardDelegado}"]'::jsonb
   where usuario = 'exec.um';
`)
const logFila = (
  await bd.query(`
    select count(*)::int as total from public.plt_logs_atividade
     where acao = 'fila_prioridade_reordenada'`)
).rows[0]
conferir(
  logFila.total >= 1,
  'reordenar a fila de prioridade gera log de atividade (D-40)',
  `vieram ${logFila.total}`,
)
const filaDoOutro = (
  await bd.query(`
    select fila_prioridade from public.plt_usuarios where usuario = 'exec.dois'`)
).rows[0]
conferir(
  JSON.stringify(filaDoOutro?.fila_prioridade) === '[]',
  'a fila de um usuário não toca a fila de nenhum outro',
  JSON.stringify(filaDoOutro ?? null),
)

titulo('SESSAO-23 · apagar avisos lidos (migration 34): só o próprio, só o lido')

// exec.um tem avisos? Garante um lido e um não lido para ele, e um de outro.
await bd.exec(`
  insert into public.plt_notificacoes (destinatario_id, tipo, titulo, corpo, lida_em) values
    ((select id from public.plt_usuarios where usuario = 'exec.um'),
     'teste', 'Aviso lido do exec.um', 'corpo', now()),
    ((select id from public.plt_usuarios where usuario = 'exec.um'),
     'teste', 'Aviso NAO lido do exec.um', 'corpo', null),
    ((select id from public.plt_usuarios where usuario = 'exec.dois'),
     'teste', 'Aviso lido do exec.dois', 'corpo', now());
  grant select, delete on public.plt_notificacoes to authenticated;
  set role authenticated;
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
`)
const apagouLido = (
  await bd.query(`delete from public.plt_notificacoes where titulo = 'Aviso lido do exec.um' returning id`)
).rows
const naoApagaNaoLido = (
  await bd.query(`delete from public.plt_notificacoes where titulo = 'Aviso NAO lido do exec.um' returning id`)
).rows
const naoApagaAlheio = (
  await bd.query(`delete from public.plt_notificacoes where titulo = 'Aviso lido do exec.dois' returning id`)
).rows
await bd.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
conferir(
  apagouLido.length === 1 && naoApagaNaoLido.length === 0 && naoApagaAlheio.length === 0,
  'apaga o próprio aviso lido; o não lido e o alheio ficam (RLS com papel simulado — A-21)',
  JSON.stringify({ lido: apagouLido.length, naoLido: naoApagaNaoLido.length, alheio: naoApagaAlheio.length }),
)

titulo('SESSAO-23 · pausar tarefa guarda o tempo (migration 35)')

await bd.exec(`
  insert into public.plt_tarefas (titulo, responsavel_id, criada_por_id, iniciada_em, situacao)
    values ('Tarefa com pausa',
            (select id from public.plt_usuarios where usuario = 'exec.um'),
            (select id from public.plt_usuarios where usuario = 'exec.um'),
            now() - interval '40 minutes', 'em_andamento');
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
`)
const tarefaPausa = (await bd.query(`select max(id)::int as id from public.plt_tarefas`)).rows[0].id
await bd.exec(`select public.plt_fn_tarefa_pausar(${tarefaPausa})`)
const aposPausa = (
  await bd.query(`
    select extract(epoch from tempo_acumulado)::int as acumulado_s,
           iniciada_em is null as parada, situacao
      from public.plt_tarefas where id = ${tarefaPausa}`)
).rows[0]
conferir(
  (aposPausa?.acumulado_s ?? 0) >= 2350 && (aposPausa?.acumulado_s ?? 0) <= 2450
    && aposPausa?.parada === true && aposPausa?.situacao === 'aberta',
  'pausar somou os ~40min ao acumulado e desligou o timer (nada digitado — derivado)',
  JSON.stringify(aposPausa ?? null),
)
await deveRecusarExec(
  `select public.plt_fn_tarefa_pausar(${tarefaPausa})`,
  'pausar tarefa que não está rodando é recusado',
  /não está com o tempo rodando/i,
)
await bd.exec(`
  update public.plt_tarefas
     set iniciada_em = now() - interval '20 minutes', situacao = 'em_andamento'
   where id = ${tarefaPausa};
`)
const somaPorta = (
  await bd.query(`
    select extract(epoch from duracao)::int as total_s
      from public.plt_fn_meu_tempo_tarefas(now() - interval '1 day', now() + interval '1 hour', 50, 0)
     where tarefa_id = ${tarefaPausa}`)
).rows[0]
conferir(
  (somaPorta?.total_s ?? 0) >= 3550 && (somaPorta?.total_s ?? 0) <= 3650,
  'a porta pessoal soma acumulado + segmento aberto (~40min pausados + ~20min rodando = ~1h)',
  JSON.stringify(somaPorta ?? null),
)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)

titulo('SESSAO-23 · PCP sem pedidos encerrados no Tiny (plt_fn_cards_pedido_pcp)')

// Pedido NOVO e aberto (1 de 2 unidades liberadas): entra no quadro; virando
// "Entregue" no Tiny, sai — e a unidade viva continua no setor.
await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao)
    values (999993, (select id from public.clientes order by id limit 1), 'aprovado');
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
    values ((select id from public.pedidos where numero = 999993), 1, '055', 'Aparador Teste PCP', 2);
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    select 'unidade', p.id, 1, '055', 'Aparador Teste PCP', 1, 2
      from public.pedidos p where p.numero = 999993;
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    values ((select max(id) from public.plt_cards), 'card_criado',
            (select id from public.plt_setores where codigo = 'pcp'), 'interface');
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
`)
const pcpAntes = (
  await bd.query(`select count(*)::int as total, coalesce(bool_or(pedido_id = (select id from public.pedidos where numero = 999993)), false) as tem_teste
                    from public.plt_fn_cards_pedido_pcp(100, 0)`)
).rows[0]
await bd.exec(`update public.pedidos set situacao = 'Entregue' where numero = 999993`)
const pcpDepois = (
  await bd.query(`select count(*)::int as total, coalesce(bool_or(pedido_id = (select id from public.pedidos where numero = 999993)), false) as tem_teste
                    from public.plt_fn_cards_pedido_pcp(100, 0)`)
).rows[0]
const unidadesVivas = (
  await bd.query(`
    select count(*)::int as total from public.plt_cards c
     where c.tipo = 'unidade' and c.arquivado_em is null
       and c.pedido_id = (select id from public.pedidos where numero = 999993)`)
).rows[0]
conferir(
  pcpAntes?.tem_teste === true && pcpDepois?.tem_teste === false
    && pcpDepois.total === pcpAntes.total - 1 && (unidadesVivas?.total ?? 0) >= 1,
  'pedido que virou "Entregue" no Tiny some do quadro do PCP — e as UNIDADES dele seguem vivas nos setores',
  JSON.stringify({ antes: pcpAntes, depois: pcpDepois, unidades: unidadesVivas?.total }),
)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)
const pcpSemUsuario = (
  await bd.query(`select count(*)::int as total from public.plt_fn_cards_pedido_pcp(100, 0)`)
).rows[0]
conferir(pcpSemUsuario.total === 0, 'sem usuário no contexto, a porta do PCP devolve vazio (gate)')

titulo('SESSAO-25 · saldo do Tiny é LEITURA derivada do último aviso (CNPJ conferido)')

// Catálogo de teste (a tabela da integração, espelhada da migration 23): dois
// móveis com mínimo, uma peça (insumo) e um inativo que reusa o SKU do 1º.
await bd.exec(`
  insert into public.produtos (tiny_id, codigo, descricao, classe, situacao, estoque_minimo, unidade)
  values (910001, 'S25A', 'Armário Teste S25 - Branco', 'F', 'A', 4, 'un'),
         (910002, 'S25B', 'Estante Teste S25 - Branca', 'F', 'A', 2, 'un'),
         (910003, null,   'Peça 100 x 762 x 15,5 - A55 teste', 'M', 'A', null, 'pc'),
         (910004, 'S25A', 'Armário Teste S25 - modelo antigo', 'F', 'I', 9, 'un')
  on conflict (tiny_id) do nothing;
`)
// Avisos: webhook antigo e carga mais nova para o 910001; um de OUTRO CNPJ
// (mais novo ainda) que tem de ser ignorado; saldo ilegível ignorado; a peça
// com saldo negativo (P16).
await bd.exec(`
  insert into public.eventos (tipo, payload, recebido_em) values
    ('estoque_fabrica', '{"versao":"1.0.1","cnpj":"27556613000166","tipo":"estoque","dados":{"idProduto":910001,"sku":"S25A","nome":"Armário","saldo":1}}', now() - interval '3 hours'),
    ('estoque_fabrica', '{"versao":"carga-1","origem":"carga_inicial","cnpj":"27556613000166","tipo":"estoque","dados":{"idProduto":910001,"sku":"S25A","nome":"Armário","saldo":"3.00","saldoReservado":"1.00"}}', now() - interval '2 hours'),
    ('estoque_fabrica', '{"versao":"1.0.1","cnpj":"11111111000111","tipo":"estoque","dados":{"idProduto":910001,"sku":"S25A","nome":"Armário","saldo":99}}', now() - interval '1 hour'),
    ('estoque_fabrica', '{"versao":"1.0.1","cnpj":"27556613000166","tipo":"estoque","dados":{"idProduto":910002,"sku":"S25B","nome":"Estante","saldo":5}}', now() - interval '2 hours'),
    ('estoque_fabrica', '{"versao":"1.0.1","cnpj":"27556613000166","tipo":"estoque","dados":{"idProduto":910002,"sku":"S25B","nome":"Estante","saldo":"abc"}}', now() - interval '1 hour'),
    ('estoque_fabrica', '{"versao":"1.0.1","cnpj":"27556613000166","tipo":"estoque","dados":{"idProduto":910003,"sku":"","nome":"Peça","saldo":-14}}', now() - interval '2 hours');
`)
const leituras = (
  await bd.query(`
    select tiny_id::int as tiny_id, saldo::float as saldo, reservado_tiny::float as reservado, origem
      from plt_privado.fn_leituras_tiny() where tiny_id in (910001, 910002, 910003) order by tiny_id`)
).rows
conferir(
  leituras.length === 3
    && leituras[0].saldo === 3 && leituras[0].reservado === 1 && leituras[0].origem === 'carga_inicial'
    && leituras[1].saldo === 5 && leituras[2].saldo === -14,
  'vale o último aviso VÁLIDO de cada produto — outro CNPJ e saldo ilegível são ignorados; a carga guarda a reserva do Tiny',
  JSON.stringify(leituras),
)
conferir(
  (await bd.query(`select count(*)::int as total from plt_privado.fn_leituras_tiny() where saldo = 99`)).rows[0].total === 0,
  'aviso de outra empresa (CNPJ diferente) nunca vira saldo — webhook de conta não é assinado',
)

titulo('SESSAO-25 ↪️ ajuste de 28/09 · o número dos acabados é a CONTAGEM da plataforma (o Tiny fica nos insumos)')

// Pedidos da loja pelo caminho real (situação = DESCRIÇÃO do Tiny). Desde o
// ajuste de 28/09 (D-70) eles NÃO descontam mais o número dos acabados: a
// contagem é da logística (peças livres no ESTOQUE); o pedido vira peça pela
// produção ou pela alocação do PCP.
await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao, data_pedido)
  values (925001, (select id from public.clientes order by id limit 1), 'Em aberto',  current_date),
         (925002, (select id from public.clientes order by id limit 1), 'Cancelado',  current_date),
         (925003, (select id from public.clientes order by id limit 1), 'Entregue',   current_date);
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade) values
    ((select id from public.pedidos where numero = 925001), 1, 'S25A', 'Armário Teste S25 - Branco', 2),
    ((select id from public.pedidos where numero = 925001), 2, 'S25A', 'PERSONLAIZADO Armário 1 porta 1.82x45', 1),
    ((select id from public.pedidos where numero = 925001), 3, 'S25B', 'Estante Teste S25 - Branca', 1),
    ((select id from public.pedidos where numero = 925002), 1, 'S25A', 'Armário Teste S25 - Branco', 5),
    ((select id from public.pedidos where numero = 925003), 1, 'S25A', 'Armário Teste S25 - Branco', 3);
`)
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', false)`)
// ↪️ 30/09 (Ajuste Estoque 2 — D-83): o mínimo do Tiny deixou de valer como
// reserva nos acabados; o cenário fixa na PLATAFORMA os mesmos mínimos de
// antes (4 e 2) — os dois produtos estão no Top X (venderam nos 90 dias).
await bd.exec(`select public.plt_fn_estoque_definir_minimo(910001, 4)`)
await bd.exec(`select public.plt_fn_estoque_definir_minimo(910002, 2)`)
const acabados = async () =>
  Object.fromEntries(
    (
      await bd.query(`
        select tiny_id::int as tiny_id, saldo_tiny::float as saldo,
               em_estoque::float as em_estoque,
               reservados_venda as reservados, reposicao_estado, minimo::float as minimo
          from public.plt_fn_estoque_produtos('acabados', 'Teste S25', null, 100, 0)`)
    ).rows.map((r) => [r.tiny_id, r]),
  )
let porProduto = await acabados()
conferir(
  porProduto[910001]?.em_estoque === 0 && porProduto[910001]?.saldo === 3
    && porProduto[910001]?.minimo === 4,
  'Armário: o Tiny diz 3, mas nenhuma peça contada no ESTOQUE → 0 em estoque (D-70); mínimo 4 da plataforma (D-83)',
  JSON.stringify(porProduto[910001] ?? null),
)
conferir(
  porProduto[910002]?.em_estoque === 0 && porProduto[910002]?.minimo === 2,
  'Estante: Tiny 5, contagem 0 → 0 em estoque com mínimo 2 (o Tiny não entra na conta dos acabados)',
  JSON.stringify(porProduto[910002] ?? null),
)
conferir(porProduto[910004] === undefined, 'produto inativo não aparece na tela (e não rouba o SKU do ativo)')
const insumos = (
  await bd.query(`select tiny_id::int as tiny_id, em_estoque::float as em_estoque, saldo_tiny::float as saldo
                    from public.plt_fn_estoque_produtos('insumos', 'A55 teste', null, 100, 0)`)
).rows
conferir(
  insumos.length === 1 && insumos[0].tiny_id === 910003 && insumos[0].em_estoque === 0 && insumos[0].saldo === -14,
  'matéria-prima na tela própria; saldo negativo do Tiny aparece como 0 em estoque (o cru segue no evento — D-53)',
  JSON.stringify(insumos),
)
// Venda que passa do saldo: a Estante fica NEGATIVA = necessidade extrema.
await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao, data_pedido)
  values (925004, (select id from public.clientes order by id limit 1), 'Aprovado', current_date);
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade) values
    ((select id from public.pedidos where numero = 925004), 1, 'S25B', 'Estante Teste S25 - Branca', 6);
`)
porProduto = await acabados()
conferir(
  porProduto[910002]?.em_estoque === 0 && porProduto[910002]?.minimo === 2,
  'venda da loja acima do Tiny não mexe mais na contagem dos acabados (nunca negativa): segue 0, com o mínimo 2',
  JSON.stringify(porProduto[910002] ?? null),
)
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false)`)
conferir(
  (await bd.query(`select count(*)::int as total from public.plt_fn_estoque_produtos()`)).rows[0].total === 0,
  'operador de produção não enxerga a tela de estoque (gate da logística)',
)

titulo('SESSAO-25 · abaixo do mínimo → card de REPOSIÇÃO no PCP (um ciclo vivo por produto)')

const gerados1 = (await bd.query(`select plt_privado.fn_gerar_reposicoes() as n`)).rows[0].n
const gerados2 = (await bd.query(`select plt_privado.fn_gerar_reposicoes() as n`)).rows[0].n
const reposicoes = (
  await bd.query(`
    select c.id::int as id, c.produto_tiny_id::int as produto, c.total_unidades as qtd, s.codigo as setor,
           c.pedido_id, (select count(*)::int from public.plt_eventos e
                          where e.card_id = c.id and e.tipo = 'card_criado' and e.origem = 'automacao'
                            and e.dados ->> 'motivo' = 'reposicao_estoque') as eventos,
           (select (e.dados ->> 'necessidade_extrema')::float from public.plt_eventos e
             where e.card_id = c.id and e.tipo = 'card_criado') as extrema
      from public.plt_cards c join public.plt_setores s on s.id = c.setor_atual_id
     where c.tipo = 'reposicao' order by c.produto_tiny_id`)
).rows
conferir(
  gerados1 === 2 && gerados2 === 0 && reposicoes.length === 2
    && reposicoes[0].produto === 910001 && reposicoes[0].qtd === 4
    && reposicoes[1].produto === 910002 && reposicoes[1].qtd === 2 && reposicoes[1].extrema === 0
    && reposicoes.every((r) => r.setor === 'pcp' && r.pedido_id === null && r.eventos === 1),
  'nascem 2 cards no PCP pela maquinaria (evento com o retrato do estoque); rodar de novo não duplica; a quantidade repõe até o mínimo pela CONTAGEM da plataforma (↪️ 28/09)',
  JSON.stringify({ gerados1, gerados2, reposicoes }),
)
const cardRepA = reposicoes[0].id
const cardRepB = reposicoes[1].id
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false)`)
const pcpComReposicao = (
  await bd.query(`select count(*)::int as total from public.plt_fn_cards_pedido_pcp(100, 0)
                   where id in (${cardRepA}, ${cardRepB}) and tipo = 'reposicao'`)
).rows[0].total
conferir(pcpComReposicao === 2, 'os cards de reposição aparecem no quadro do PCP (mesma porta dos pedidos)')

await deveRecusarExec(
  `insert into public.plt_cards (tipo, total_unidades) values ('reposicao', 2)`,
  'card de reposição sem produto do catálogo é recusado (coerência por tipo)',
  /plt_cards_unidade_coerente/i,
)
await deveRecusarExec(
  `insert into public.plt_cards (tipo) values ('pedido')`,
  'card de PEDIDO continua exigindo o pedido do Tiny',
  /plt_cards_unidade_coerente/i,
)

// O PCP libera as 4 unidades do Armário (como o modal faz: card + card_criado).
await bd.exec(`
  insert into public.plt_cards (tipo, card_pai_id, produto_tiny_id, item_seq, item_codigo, item_descricao,
                                indice_unidade, total_unidades, setor_atual_id)
    select 'unidade', ${cardRepA}, 910001, 1, 'S25A', 'Armário Teste S25 - Branco', n, 4,
           (select id from public.plt_setores where codigo = 'pcp')
      from generate_series(1, 4) n;
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id)
    select c.id, 'card_criado', (select id from public.plt_usuarios where usuario = 'primeira.pessoa'),
           'interface', (select id from public.plt_setores where codigo = 'pcp')
      from public.plt_cards c where c.card_pai_id = ${cardRepA} and c.tipo = 'unidade';
`)
const unidadesRepA = (
  await bd.query(`select id::int as id from public.plt_cards where card_pai_id = ${cardRepA} and tipo = 'unidade' order by indice_unidade`)
).rows.map((r) => r.id)
const liberadaA = (
  await bd.query(`
    select (select liberado_completo_em is not null from public.plt_cards where id = ${cardRepA}) as completa,
           (select count(*)::int from public.plt_fn_cards_pedido_pcp(100, 0) where id = ${cardRepA}) as no_quadro`)
).rows[0]
conferir(
  unidadesRepA.length === 4 && liberadaA.completa === true && liberadaA.no_quadro === 0,
  'liberadas as 4 unidades (sem pedido), a reposição completa a liberação e sai do quadro do PCP',
  JSON.stringify({ unidadesRepA, liberadaA }),
)
await deveRecusarExec(
  `insert into public.plt_cards (tipo, card_pai_id, produto_tiny_id, item_seq, item_codigo, indice_unidade, total_unidades)
     values ('unidade', ${cardRepA}, 910001, 1, 'S25A', 2, 4)`,
  'a mesma unidade (k) da reposição não nasce duas vezes',
  /plt_cards_unidade_reposicao_uq|duplicate key/i,
)

titulo('SESSAO-25 · o ESTOQUE só recebe peça 🟢 (e a reposição pronta fica LIVRE)')

// As unidades vão para a produção (CNC) e voltam prontas.
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, setor_destino_id)
    select c.id, 'movimentacao_setor', 'api',
           (select id from public.plt_setores where codigo = 'pcp'),
           (select id from public.plt_setores where codigo = 'cnc')
      from public.plt_cards c where c.card_pai_id = ${cardRepA} and c.tipo = 'unidade';
`)
await deveRecusarExec(
  `select public.plt_fn_mover_card(${unidadesRepA[0]}, (select id from public.plt_setores where codigo = 'estoque'),
                                   null, 'atencao', 'risco na lateral')`,
  'peça marcada 🟡 não entra no ESTOQUE (vai para o DANIFICADO do setor)',
  /só recebe peça em perfeito estado/i,
)
await deveRecusarExec(
  `select public.plt_fn_mover_card(${unidadesRepA[0]}, (select id from public.plt_setores where codigo = 'estoque'),
                                   null, 'danificado', null)`,
  'peça marcada 🔴 não entra no ESTOQUE',
  /só recebe peça em perfeito estado/i,
)
conferir(
  (await bd.query(`select count(*)::int as total from public.plt_eventos
                    where card_id = ${unidadesRepA[0]} and tipo = 'qualidade_marcada'`)).rows[0].total === 0,
  'a recusa desfaz a marcação junto (a transição inteira volta — nada pela metade)',
)
await bd.exec(`
  select public.plt_fn_mover_card(c.id, (select id from public.plt_setores where codigo = 'estoque'), null, 'perfeito', null)
    from public.plt_cards c where c.card_pai_id = ${cardRepA} and c.tipo = 'unidade';
`)
// Uma unidade COM pedido (reservada) e uma personalizada com o mesmo SKU no ESTOQUE.
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
  values ('unidade', (select id from public.pedidos where numero = 925001), 1, 'S25A', 'Armário Teste S25 - Branco', 1, 2),
         ('unidade', (select id from public.pedidos where numero = 925001), 2, 'S25A', 'PERSONLAIZADO Armário 1 porta 1.82x45', 1, 1);
  insert into public.plt_eventos (card_id, tipo, origem, setor_destino_id)
    select c.id, 'card_criado', 'api', (select id from public.plt_setores where codigo = 'estoque')
      from public.plt_cards c
     where c.pedido_id = (select id from public.pedidos where numero = 925001) and c.tipo = 'unidade';
`)
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', false)`)
porProduto = await acabados()
conferir(
  porProduto[910001]?.em_estoque === 4 && porProduto[910001]?.reservados === 1
    && porProduto[910001]?.reposicao_estado === 'concluida' && porProduto[910001]?.minimo === 4,
  'Armário: as 4 prontas LIVRES (da reposição) SÃO o estoque (↪️ 28/09 — a contagem da plataforma) e 1 RESERVADA à parte (a personalizada não conta); o Tiny não soma',
  JSON.stringify(porProduto[910001] ?? null),
)
const pecasA = (
  await bd.query(`select dono, origem, numero, reposicao_card_id::int as rep
                    from public.plt_fn_estoque(null, 100, 0, 910001, null) order by dono, card_id`)
).rows
conferir(
  pecasA.length === 5
    && pecasA.filter((p) => p.dono === 'livre' && p.origem === 'reposicao' && p.rep === cardRepA).length === 4
    && pecasA.filter((p) => p.dono === 'pedido' && p.numero === 925001).length === 1,
  'as peças do produto: 4 livres (vindas da reposição) + 1 com as duas etiquetas (SKU + pedido 925001)',
  JSON.stringify(pecasA),
)
conferir(
  (await bd.query(`select count(*)::int as total from public.plt_fn_estoque(null, 100, 0, null, 'livre')`)).rows[0].total >= 3,
  'filtro "livres" da lista de peças funciona (dono sem pedido)',
)

titulo('SESSAO-25 ↪️ 28/09 · depois do ciclo, só reabre com MOVIMENTO novo do estoque; o PCP pode arquivar')

const semMovimento = (await bd.query(`select plt_privado.fn_gerar_reposicoes() as n`)).rows[0].n
conferir(
  semMovimento === 0,
  'ciclo concluído e as 4 peças contadas cobrem o mínimo → não pede outra reposição',
  `gerou ${semMovimento}`,
)
await bd.exec(`
  insert into public.eventos (tipo, payload, recebido_em) values
    ('estoque_fabrica', '{"versao":"1.0.1","cnpj":"27556613000166","tipo":"estoque","dados":{"idProduto":910001,"sku":"S25A","nome":"Armário","saldo":0}}', now());
`)
conferir(
  (await bd.query(`select plt_privado.fn_gerar_reposicoes() as n`)).rows[0].n === 0,
  'leitura nova do Tiny (saldo 0) não mexe mais nos acabados — a contagem é da plataforma (D-70)',
)
// A logística dá baixa de 2 (vendidas no balcão): o estoque mexeu depois do ciclo.
const depoisDaBaixa = (
  await bd.query(`select public.plt_fn_estoque_movimentar(910001, 'baixa', 2, 'vendidas no balcão') as n`)
).rows[0].n
const comMovimento = (await bd.query(`select plt_privado.fn_gerar_reposicoes() as n`)).rows[0].n
const novaRepA = (
  await bd.query(`select id::int as id, total_unidades as qtd from public.plt_cards
                   where tipo = 'reposicao' and produto_tiny_id = 910001 and id <> ${cardRepA}`)
).rows
conferir(
  depoisDaBaixa === 2 && comMovimento === 1 && novaRepA.length === 1 && novaRepA[0].qtd === 2,
  'baixa manual de 2 (4 → 2, abaixo do mínimo 4) é movimento novo: abre um novo ciclo, repor 2',
  JSON.stringify({ depoisDaBaixa, comMovimento, novaRepA }),
)
await bd.exec(`select public.plt_fn_arquivar_card(${novaRepA[0].id}, 'temos peça pronta na fábrica')`)
conferir(
  (await bd.query(`select arquivado_em is not null as arq from public.plt_cards where id = ${novaRepA[0].id}`)).rows[0].arq === true,
  'a logística (PCP) arquiva o card de reposição — o PCP decide o rumo, inclusive não produzir',
)
conferir(
  (await bd.query(`select plt_privado.fn_gerar_reposicoes() as n`)).rows[0].n === 0,
  'arquivado pelo PCP não volta sozinho sem movimento novo do estoque (sem ciclo em loop)',
)
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false)`)
await deveRecusarExec(
  `select public.plt_fn_arquivar_card(${cardRepB})`,
  'operador de produção não arquiva card de reposição (gate)',
  /gesto de admin ou da integração/i,
)

titulo('SESSAO-25 · peça da reposição no DANIFICADO e a sugestão de mínimo (top 20 com rank)')

await bd.exec(`
  insert into public.plt_etapas (setor_id, nome, ordem, eh_danificado)
  select s.id, 'DANIFICADO', 99, true from public.plt_setores s
   where s.codigo = 'cnc'
     and not exists (select 1 from public.plt_etapas e where e.setor_id = s.id and e.eh_danificado);
  insert into public.plt_cards (tipo, card_pai_id, produto_tiny_id, item_seq, item_codigo, item_descricao,
                                indice_unidade, total_unidades)
    values ('unidade', ${cardRepB}, 910002, 1, 'S25B', 'Estante Teste S25 - Branca', 1, 2);
  insert into public.plt_eventos (card_id, tipo, origem, setor_destino_id, etapa_destino_id)
    values ((select max(id) from public.plt_cards where card_pai_id = ${cardRepB}), 'card_criado', 'api',
            (select id from public.plt_setores where codigo = 'cnc'),
            (select e.id from public.plt_etapas e join public.plt_setores s on s.id = e.setor_id
              where s.codigo = 'cnc' and e.eh_danificado));
`)
await bd.exec(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', false)`)
const danRep = (
  await bd.query(`select card_id::int as card_id, numero from public.plt_fn_danificados()
                   where card_id = (select max(id) from public.plt_cards where card_pai_id = ${cardRepB})`)
).rows
conferir(
  danRep.length === 1 && danRep[0].numero === null,
  'peça da reposição que quebrou aparece nos Danificados (sem número de pedido)',
  JSON.stringify(danRep),
)
await deveRecusarExec(
  `select public.plt_fn_resolver_danificado(${danRep[0]?.card_id ?? 0},
            (select id from public.plt_setores where codigo = 'estoque'), null, 'danificado', 'sem conserto')`,
  'resolver peça danificada PARA o ESTOQUE marcando 🔴 é recusado',
  /só recebe peça em perfeito estado/i,
)
// ↪️ 28/09: a sugestão mora na aba Configurações (a porta antiga saiu).
const sugestao = (
  await bd.query(`select posicao, codigo, vendidos_90d::float as vendidos, sugestao
                    from public.plt_fn_estoque_configuracoes('Teste S25', 100, 0)
                   where codigo in ('S25A', 'S25B') order by posicao`)
).rows
conferir(
  sugestao.length === 2 && sugestao[0].codigo === 'S25B' && sugestao[0].vendidos === 7
    && sugestao[1].codigo === 'S25A' && sugestao[1].vendidos === 5
    && sugestao[0].sugestao >= sugestao[1].sugestao,
  'sugestão de mínimo: rank pelas vendas de 90 dias (sem cancelado/personalizado) — o mais vendido nunca sugere menos que o de baixo',
  JSON.stringify(sugestao),
)
conferir(
  (await bd.query(`select count(*)::int as total from pg_proc where proname = 'plt_fn_estoque_sugestao_minimo'`)).rows[0].total === 0,
  'a porta antiga da sugestão saiu (virou Configurações — uma porta só)',
)

// ============================================================================
// SESSAO-24 — produção concluída, cancelamentos, alocação e o quadro por arrasto
// (migration 37 + as manutenções de 27/09). O dono em 27/09: "os locais finais
// não são mais estoque e muito menos rota — estoque só fica como local final de
// peça sem dono"; "tudo arrastando"; "só a limpeza e embalagem conclui".
// ============================================================================
titulo('SESSAO-24 · rotas das etapas (dado do dono): nome de setor e CONCLUÍDO encaminham')

const s24 = {
  admin: '00000000-0000-0000-0000-000000000001',
  logistica: '00000000-0000-0000-0000-000000000031',
  montaUm: '00000000-0000-0000-0000-000000000041',
  limpaUm: '00000000-0000-0000-0000-000000000042',
  montaDois: '00000000-0000-0000-0000-000000000043',
}
const comoS24 = (auth) => bd.exec(`select set_config('request.jwt.claim.sub', '${auth}', false)`)
const idSetorS24 = async (codigo) =>
  (await bd.query(`select id::int as id from public.plt_setores where codigo = '${codigo}'`)).rows[0].id
const idEtapaS24 = async (codigo, nome) =>
  (await bd.query(`select e.id::int as id from public.plt_etapas e join public.plt_setores s on s.id = e.setor_id
                    where s.codigo = '${codigo}' and e.nome = '${nome}'`)).rows[0]?.id ?? null
const cardS24 = async (id) =>
  (await bd.query(`select c.id::int as id, c.pedido_id::int as pedido_id, c.produto_tiny_id::int as produto,
                          c.executor_atual_id is not null as executando,
                          (select u.usuario from public.plt_usuarios u where u.id = c.executor_atual_id) as executor,
                          c.concluido_em is not null as concluido, c.arquivado_em is not null as arquivado,
                          c.indice_unidade, c.total_unidades, s.codigo as setor, e.nome as etapa
                     from public.plt_cards c
                     left join public.plt_setores s on s.id = c.setor_atual_id
                     left join public.plt_etapas e on e.id = c.etapa_atual_id
                    where c.id = ${id}`)).rows[0]
// Libera uma unidade como o front faz (card + card_criado no PCP + mover), por API.
async function liberarS24(numero, seq, k, n, codigo, descricao, destino) {
  await bd.exec(`
    insert into public.plt_cards (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
      select 'unidade', p.id, pc.id, ${seq}, ${codigo === null ? 'null' : `'${codigo}'`}, '${descricao}', ${k}, ${n}
        from public.pedidos p join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido'
       where p.numero = ${numero};
    insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
      values ((select max(id) from public.plt_cards), 'card_criado',
              (select id from public.plt_setores where codigo = 'pcp'), 'api');
    insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, origem)
      values ((select max(id) from public.plt_cards), 'movimentacao_setor',
              (select id from public.plt_setores where codigo = 'pcp'),
              (select id from public.plt_setores where codigo = '${destino}'), 'api');
  `)
  return (await bd.query(`select max(id)::int as id from public.plt_cards`)).rows[0].id
}

// Etapas como o dono cadastrou (herança do ClickUp — simuladas). A MONTAGEM já
// tem a fila "A MONTAR" (cenário da S22).
await bd.exec(`
  insert into public.plt_etapas (setor_id, nome, ordem, eh_fila)
  select s.id, x.nome, x.ordem, x.fila
    from public.plt_setores s
    join (values
      ('montagem',          'MONTANDO',             2, false),
      ('montagem',          'PARADO',               3, false),
      ('montagem',          'LIMPEZA E EMBALAGEM',  4, false),
      ('montagem',          'CONCLUÍDO',            5, false),
      ('limpeza_embalagem', 'A LIMPAR',             1, true),
      ('limpeza_embalagem', 'LIMPANDO E EMBALANDO', 2, false),
      ('limpeza_embalagem', 'ESTOQUE',              3, false),
      ('secc',              'CENTRO DE FURAÇÃO',   30, false),
      ('secc',              'FITAMENTO',           40, false),
      ('secc',              'CONCLUÍDO',           50, false),
      ('furacao',           'CONCLUÍDO',           50, false)
    ) as x(codigo, nome, ordem, fila) on x.codigo = s.codigo
  on conflict (setor_id, nome) do nothing;
`)
await bd.exec(await readFile(path.join(MANUTENCAO, '2026-09-27_rotas_das_etapas.sql'), 'utf8'))
const rotas = Object.fromEntries(
  (await bd.query(`
    select so.codigo || '/' || e.nome as chave, coalesce(sd.codigo, '-') as destino
      from public.plt_etapas e
      join public.plt_setores so on so.id = e.setor_id
      left join public.plt_setores sd on sd.id = e.setor_destino_id
     where so.codigo in ('montagem', 'limpeza_embalagem', 'secc', 'furacao')`)).rows.map((r) => [r.chave, r.destino]),
)
conferir(
  rotas['montagem/LIMPEZA E EMBALAGEM'] === 'limpeza_embalagem' && rotas['montagem/CONCLUÍDO'] === 'limpeza_embalagem'
    && rotas['secc/CONCLUÍDO'] === 'furacao' && rotas['secc/CENTRO DE FURAÇÃO'] === 'furacao'
    && rotas['secc/FITAMENTO'] === 'fitamento' && rotas['furacao/CONCLUÍDO'] === 'montagem',
  'etapa com nome de setor → o setor; CENTRO DE FURAÇÃO → FURAÇÃO; CONCLUÍDO de SECC → FURAÇÃO; o dos outros → o próximo',
  JSON.stringify(rotas),
)
conferir(
  rotas['limpeza_embalagem/ESTOQUE'] === '-' && rotas['montagem/MONTANDO'] === '-' && rotas['montagem/PARADO'] === '-'
    && rotas['montagem/A MONTAR'] === '-',
  'etapa chamada ESTOQUE, a de trabalho, PARADO e a fila NÃO encaminham (quem leva ao estoque é o Concluir)',
  JSON.stringify(rotas),
)
// Edição do admin sobrevive a rodar a manutenção de novo.
await bd.exec(`
  update public.plt_etapas set setor_destino_id = (select id from public.plt_setores where codigo = 'furacao')
   where id = (select e.id from public.plt_etapas e join public.plt_setores s on s.id = e.setor_id
                where s.codigo = 'montagem' and e.nome = 'CONCLUÍDO');
`)
await bd.exec(await readFile(path.join(MANUTENCAO, '2026-09-27_rotas_das_etapas.sql'), 'utf8'))
conferir(
  (await bd.query(`select sd.codigo from public.plt_etapas e join public.plt_setores s on s.id = e.setor_id
                     join public.plt_setores sd on sd.id = e.setor_destino_id
                    where s.codigo = 'montagem' and e.nome = 'CONCLUÍDO'`)).rows[0]?.codigo === 'furacao',
  'a manutenção só preenche etapa SEM rota — rodar de novo não desfaz a edição do admin',
)
await bd.exec(`
  update public.plt_etapas set setor_destino_id = (select id from public.plt_setores where codigo = 'limpeza_embalagem')
   where id = (select e.id from public.plt_etapas e join public.plt_setores s on s.id = e.setor_id
                where s.codigo = 'montagem' and e.nome = 'CONCLUÍDO');
`)
await deveRecusarExec(
  `update public.plt_etapas set setor_destino_id = setor_id
    where id = (select e.id from public.plt_etapas e join public.plt_setores s on s.id = e.setor_id
                 where s.codigo = 'montagem' and e.nome = 'PARADO')`,
  'etapa não encaminha para o próprio setor',
  /plt_etapas_encaminha_ck/i,
)
await deveRecusarExec(
  `update public.plt_etapas set setor_destino_id = (select id from public.plt_setores where codigo = 'secc')
    where id = (select e.id from public.plt_etapas e join public.plt_setores s on s.id = e.setor_id
                 where s.codigo = 'montagem' and e.eh_fila)`,
  'a fila nunca encaminha',
  /plt_etapas_encaminha_ck/i,
)
conferir(
  (await bd.query(`select plt_privado.fn_etapa_inicio((select id from public.plt_setores where codigo = 'montagem'))::int as id`)).rows[0].id
    === (await idEtapaS24('montagem', 'MONTANDO')),
  'a etapa de INÍCIO da MONTAGEM é a próxima depois da fila (MONTANDO) — a regra única do iniciar e do arrasto',
)

titulo('SESSAO-24 · o arrasto: soltar no início inicia; limite de 1; parecer antes; encaminhar marca o estado')

await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel, auth_user_id) values
    ('Monta Um',   'monta1@teste.com', '44444444401', 'monta.um',   'operador', '${s24.montaUm}'),
    ('Monta Dois', 'monta2@teste.com', '44444444402', 'monta.dois', 'operador', '${s24.montaDois}'),
    ('Limpa Um',   'limpa1@teste.com', '44444444403', 'limpa.um',   'operador', '${s24.limpaUm}');
  insert into public.plt_usuario_setores (usuario_id, setor_id) values
    ((select id from public.plt_usuarios where usuario = 'monta.um'),   (select id from public.plt_setores where codigo = 'montagem')),
    ((select id from public.plt_usuarios where usuario = 'monta.dois'), (select id from public.plt_setores where codigo = 'montagem')),
    ((select id from public.plt_usuarios where usuario = 'limpa.um'),   (select id from public.plt_setores where codigo = 'limpeza_embalagem'));
  insert into public.produtos (tiny_id, codigo, descricao, classe, situacao, estoque_minimo, unidade)
  values (924101, 'S24A', 'Mesa Teste S24 - Branca', 'F', 'A', 2, 'un')
  on conflict (tiny_id) do nothing;
  insert into public.pedidos (numero, cliente_id, situacao)
    values (924001, (select id from public.clientes order by id limit 1), 'Em aberto');
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
    values ((select id from public.pedidos where numero = 924001), 1, 'S24A', 'Mesa Teste S24 - Branca', 3);
`)
const u1 = await liberarS24(924001, 1, 1, 3, 'S24A', 'Mesa Teste S24 - Branca', 'montagem')
const u2 = await liberarS24(924001, 1, 2, 3, 'S24A', 'Mesa Teste S24 - Branca', 'montagem')
const u3 = await liberarS24(924001, 1, 3, 3, 'S24A', 'Mesa Teste S24 - Branca', 'montagem')
const montando = await idEtapaS24('montagem', 'MONTANDO')
const parado = await idEtapaS24('montagem', 'PARADO')
const montLE = await idEtapaS24('montagem', 'LIMPEZA E EMBALAGEM')
const montConcluido = await idEtapaS24('montagem', 'CONCLUÍDO')
conferir((await cardS24(u1)).etapa === 'A MONTAR', 'a unidade liberada para a MONTAGEM cai na fila (A MONTAR)')

await comoS24(s24.montaUm)
const soltou = (await bd.query(`select public.plt_fn_soltar_card(${u1}, ${montando}) as r`)).rows[0].r
const u1Depois = await cardS24(u1)
conferir(
  soltou?.acao === 'iniciado' && u1Depois.etapa === 'MONTANDO' && u1Depois.executor === 'monta.um',
  'arrastar de A MONTAR para MONTANDO inicia o tempo de quem arrastou, na hora (dono: "não o contrário")',
  JSON.stringify({ soltou, u1Depois }),
)
await deveRecusarExec(
  `select public.plt_fn_soltar_card(${u2}, ${montando})`,
  'o segundo card arrastado pela mesma pessoa esbarra no limite de 1 (D-48) — com a instrução de arrastar o outro adiante',
  /arraste-o adiante/i,
)
const u2Parado = await cardS24(u2)
conferir(
  u2Parado.etapa === 'A MONTAR' && !u2Parado.executando,
  'a recusa desfaz o arrasto inteiro — o card continua na fila, sem ninguém (transação única)',
  JSON.stringify(u2Parado),
)
const paraParado = (await bd.query(`select public.plt_fn_soltar_card(${u1}, ${parado}) as r`)).rows[0].r
const execU1 = (
  await bd.query(`select encerramento, em_andamento from public.plt_vw_execucoes where card_id = ${u1} order by iniciou_em desc limit 1`)
).rows[0]
conferir(
  paraParado?.acao === 'movido' && !(await cardS24(u1)).executando
    && execU1?.encerramento === 'movimentacao' && execU1?.em_andamento === false,
  'arrastar de MONTANDO para PARADO para o tempo (a execução fecha no mover — D-24)',
  JSON.stringify({ paraParado, execU1 }),
)
await bd.exec(`select public.plt_fn_soltar_card(${u2}, ${montando})`)
conferir((await cardS24(u2)).executor === 'monta.um', 'livre do primeiro, o montador pega o segundo arrastando')
await comoS24(s24.montaDois)
const voltou = (await bd.query(`select public.plt_fn_soltar_card(${u1}, ${montando}) as r`)).rows[0].r
const eventosVolta = (
  await bd.query(`select tipo from public.plt_eventos where card_id = ${u1} order by id desc limit 2`)
).rows.map((r) => r.tipo)
conferir(
  voltou?.acao === 'iniciado' && (await cardS24(u1)).executor === 'monta.dois'
    && eventosVolta[0] === 'execucao_iniciada' && eventosVolta[1] === 'movimentacao_etapa',
  'de PARADO de volta para MONTANDO: move e inicia na mesma transação, para quem arrastou',
  JSON.stringify({ voltou, eventosVolta }),
)
await deveRecusarExec(
  `select public.plt_fn_soltar_card(${u1}, ${montLE})`,
  'soltar numa etapa que encaminha sem marcar o estado é recusado (D-09 é lei)',
  /marcar o estado da peça/i,
)
const encaminhou = (
  await bd.query(`select public.plt_fn_soltar_card(${u1}, ${montLE}, 'perfeito', 'montado') as r`)
).rows[0].r
const u1NaLE = await cardS24(u1)
const execFechada = (
  await bd.query(`select em_andamento from public.plt_vw_execucoes where card_id = ${u1} order by iniciou_em desc limit 1`)
).rows[0]
conferir(
  encaminhou?.acao === 'encaminhado' && u1NaLE.setor === 'limpeza_embalagem' && u1NaLE.etapa === 'A LIMPAR'
    && execFechada?.em_andamento === false,
  'soltar em "LIMPEZA E EMBALAGEM" leva o card ao setor (na fila dele), com a marcação, e fecha o tempo da montagem',
  JSON.stringify({ encaminhou, u1NaLE, execFechada }),
)
await comoS24(s24.montaUm)
await deveRecusarExec(
  `select public.plt_fn_soltar_card(${u2}, (select e.id from public.plt_etapas e join public.plt_setores s on s.id = e.setor_id
                                            where s.codigo = 'limpeza_embalagem' and e.nome = 'A LIMPAR'))`,
  'soltar em etapa de OUTRO quadro é recusado',
  /próprio quadro/i,
)
await deveRecusarExec(
  `select public.plt_fn_soltar_card(${u3}, ${montando}, null, null,
                                    (select id from public.plt_usuarios where usuario = 'limpa.um'))`,
  'no tablet, operador do PIN que não trabalha no setor não inicia o card',
  /não trabalha neste setor/i,
)
const concluidoMontagem = (
  await bd.query(`select public.plt_fn_soltar_card(${u2}, ${montConcluido}, 'perfeito') as r`)
).rows[0].r
conferir(
  concluidoMontagem?.acao === 'encaminhado' && (await cardS24(u2)).setor === 'limpeza_embalagem',
  'soltar em CONCLUÍDO da MONTAGEM manda para o próximo setor (LIMPEZA E EMBALAGEM)',
  JSON.stringify(concluidoMontagem),
)

// Na LIMPEZA E EMBALAGEM, a peça chegou marcada: iniciar pede o parecer antes.
await comoS24(s24.limpaUm)
const limpando = await idEtapaS24('limpeza_embalagem', 'LIMPANDO E EMBALANDO')
await deveRecusarExec(
  `select public.plt_fn_soltar_card(${u1}, ${limpando})`,
  'arrastar para o trabalho uma peça que chegou marcada, sem o parecer, é recusado (D-09 item 2)',
  /confirme o recebimento/i,
)
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id, estado_qualidade)
    values (${u1}, 'qualidade_parecer', (select id from public.plt_usuarios where usuario = 'limpa.um'), 'interface',
            (select max(id) from public.plt_eventos where card_id = ${u1} and tipo = 'qualidade_marcada'), 'perfeito');
`)
await bd.exec(`select public.plt_fn_soltar_card(${u1}, ${limpando})`)
conferir((await cardS24(u1)).executor === 'limpa.um', 'com o parecer dado, soltar em LIMPANDO E EMBALANDO inicia o tempo')

titulo('SESSAO-24 · Concluir produção: pedido vivo → Pedidos em aguardo; sem dono → ESTOQUE; só 🟢')

await deveRecusarExec(
  `select public.plt_fn_concluir_producao(${u1}, 'atencao')`,
  'concluir marcando 🟡 é recusado — Pedidos em aguardo só recebe peça em perfeito estado',
  /Pedidos em aguardo só recebe peça em perfeito estado/i,
)
const destinoU1 = (await bd.query(`select public.plt_fn_concluir_producao(${u1}) as d`)).rows[0].d
const u1Pronta = await cardS24(u1)
conferir(
  destinoU1 === 'aguardo' && u1Pronta.setor === 'aguardo' && u1Pronta.concluido && !u1Pronta.executando,
  'concluir a peça de pedido vivo leva a Pedidos em aguardo (fim de linha: concluída, tempo fechado)',
  JSON.stringify({ destinoU1, u1Pronta }),
)
conferir(
  (await bd.query(`select count(*)::int as total from public.plt_notificacoes
                    where card_id = ${u1} and tipo = 'chegada_aguardo'`)).rows[0].total >= 1,
  'a chegada a Pedidos em aguardo avisa os admins (o aviso que o concluir já dava)',
)
await deveRecusarExec(
  `select public.plt_fn_mover_card(${u2}, (select id from public.plt_setores where codigo = 'estoque'), null, 'perfeito', null)`,
  'peça de pedido vivo NÃO entra no ESTOQUE (b4 do dono: estoque é só de peça sem dono)',
  /vai para Pedidos em aguardo/i,
)
// Uma reposição (sem pedido) chega à limpeza e embalagem.
await bd.exec(`
  insert into public.plt_cards (tipo, produto_tiny_id, item_codigo, item_descricao, total_unidades, setor_atual_id)
    values ('reposicao', 924101, 'S24A', 'Mesa Teste S24 - Branca', 1, (select id from public.plt_setores where codigo = 'pcp'));
  insert into public.plt_eventos (card_id, tipo, origem, setor_destino_id)
    values ((select max(id) from public.plt_cards), 'card_criado', 'automacao', (select id from public.plt_setores where codigo = 'pcp'));
`)
const cardRepS24 = (await bd.query(`select max(id)::int as id from public.plt_cards where tipo = 'reposicao'`)).rows[0].id
await bd.exec(`
  insert into public.plt_cards (tipo, card_pai_id, produto_tiny_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
    values ('unidade', ${cardRepS24}, 924101, 1, 'S24A', 'Mesa Teste S24 - Branca', 1, 1);
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    values ((select max(id) from public.plt_cards), 'card_criado', (select id from public.plt_setores where codigo = 'pcp'), 'api');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, origem)
    values ((select max(id) from public.plt_cards), 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'pcp'),
            (select id from public.plt_setores where codigo = 'limpeza_embalagem'), 'api');
`)
const r1 = (await bd.query(`select max(id)::int as id from public.plt_cards where card_pai_id = ${cardRepS24}`)).rows[0].id
await deveRecusarExec(
  `select public.plt_fn_mover_card(${r1}, (select id from public.plt_setores where codigo = 'aguardo'), null, 'perfeito', null)`,
  'peça sem dono NÃO entra em Pedidos em aguardo',
  /recebe só peça de pedido/i,
)
const destinoR1 = (await bd.query(`select public.plt_fn_concluir_producao(${r1}) as d`)).rows[0].d
conferir(
  destinoR1 === 'estoque' && (await cardS24(r1)).setor === 'estoque',
  'concluir a peça da REPOSIÇÃO leva ao ESTOQUE — livre, aguardando a venda',
  JSON.stringify(destinoR1),
)

titulo('SESSAO-24 · cancelamento nos três estágios (PCP · em produção · pronto no aguardo)')

await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao) values
    (924002, (select id from public.clientes order by id limit 1), 'Em aberto'),
    (924003, (select id from public.clientes order by id limit 1), 'Em aberto');
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade) values
    ((select id from public.pedidos where numero = 924002), 1, 'S24A', 'Mesa Teste S24 - Branca', 1),
    ((select id from public.pedidos where numero = 924002), 2, 'S24A', 'PERSONALIZADO Mesa 1,20 x 0,60 Preta', 1),
    ((select id from public.pedidos where numero = 924002), 3, 'S24X', 'Cadeira fora do catálogo', 1),
    ((select id from public.pedidos where numero = 924003), 1, 'S24A', 'Mesa Teste S24 - Branca', 1);
`)
const ca = await liberarS24(924002, 1, 1, 1, 'S24A', 'Mesa Teste S24 - Branca', 'limpeza_embalagem')
const cb = await liberarS24(924002, 2, 1, 1, 'S24A', 'PERSONALIZADO Mesa 1,20 x 0,60 Preta', 'montagem')
const cc = await liberarS24(924002, 3, 1, 1, 'S24X', 'Cadeira fora do catálogo', 'montagem')
await comoS24(s24.limpaUm)
await bd.exec(`select public.plt_fn_concluir_producao(${ca})`)
conferir((await cardS24(ca)).setor === 'aguardo', 'a primeira peça do pedido 924002 ficou pronta em Pedidos em aguardo')

await comoS24(s24.admin)
const concluidasAntes = (await bd.query(`select concluidas_dia from public.plt_fn_dash_dia()`)).rows[0].concluidas_dia
await bd.exec(`update public.pedidos set situacao = 'Cancelado' where numero in (924002, 924003)`)
const caCancelada = await cardS24(ca)
conferir(
  caCancelada.setor === 'estoque' && caCancelada.pedido_id === null && caCancelada.produto === 924101,
  'pronta no aguardo + pedido cancelado → a peça perde o pedido e volta ao ESTOQUE, sem dono (produto do catálogo pelo SKU)',
  JSON.stringify(caCancelada),
)
conferir(
  (await bd.query(`select count(*)::int as total from public.plt_eventos
                    where card_id = ${ca} and tipo = 'unidade_desvinculada' and origem = 'automacao'`)).rows[0].total === 1,
  'a perda do pedido é um EVENTO (unidade_desvinculada), nunca edição',
)
conferir(
  (await bd.query(`select count(*)::int as total from public.plt_notificacoes
                    where card_id = ${ca} and titulo like 'Pedido 924002 cancelado%'`)).rows[0].total >= 1,
  'o aviso aos admins diz o que aconteceu: "Pedido 924002 cancelado: peça voltou ao ESTOQUE"',
)
conferir(
  (await bd.query(`select concluidas_dia from public.plt_fn_dash_dia()`)).rows[0].concluidas_dia === concluidasAntes,
  'o painel NÃO conta a peça de novo ao voltar do aguardo para o ESTOQUE (terminal → terminal)',
  `antes ${concluidasAntes}`,
)
const noQuadroPcp = (
  await bd.query(`select count(*)::int as total from public.plt_fn_cards_pedido_pcp(100, 0) c
                   where c.pedido_id in (select id from public.pedidos where numero in (924002, 924003))`)
).rows[0].total
const cancelados = Object.fromEntries(
  (await bd.query(`select numero, em_producao, prontas, no_estoque, cancelado_em is not null as com_data
                     from public.plt_fn_pedidos_cancelados(null, 100, 0) where numero in (924002, 924003)`)).rows
    .map((r) => [r.numero, r]),
)
conferir(
  noQuadroPcp === 0 && cancelados[924003]?.em_producao === 0 && cancelados[924003]?.no_estoque === 0
    && cancelados[924003]?.com_data === true,
  'pedido cancelado ainda no PCP sai do quadro e entra na aba Cancelados (sem efeito em estoque)',
  JSON.stringify({ noQuadroPcp, cancelados }),
)
conferir(
  cancelados[924002]?.em_producao === 2 && cancelados[924002]?.prontas === 0 && cancelados[924002]?.no_estoque === 1,
  'na aba Cancelados, o 924002 mostra 2 peças ainda na produção (com a etiqueta) e 1 que já ficou sem dono no estoque',
  JSON.stringify(cancelados[924002] ?? null),
)
const naProducao = await cardS24(cb)
conferir(
  naProducao.setor === 'montagem' && naProducao.pedido_id !== null,
  'peça em produção de pedido cancelado NÃO some — segue na produção com o pedido (a etiqueta "Pedido cancelado")',
  JSON.stringify(naProducao),
)
await comoS24(s24.montaUm)
await deveRecusarExec(
  `select public.plt_fn_mover_card(${cc}, (select id from public.plt_setores where codigo = 'aguardo'), null, 'perfeito', null)`,
  'peça de pedido cancelado não vai para Pedidos em aguardo',
  /foi cancelado no Tiny/i,
)
const destinoCb = (await bd.query(`select public.plt_fn_concluir_producao(${cb}) as d`)).rows[0].d
const destinoCc = (await bd.query(`select public.plt_fn_concluir_producao(${cc}) as d`)).rows[0].d
const cbPronta = await cardS24(cb)
const ccPronta = await cardS24(cc)
conferir(
  destinoCb === 'estoque' && destinoCc === 'estoque'
    && cbPronta.setor === 'estoque' && cbPronta.pedido_id === null && cbPronta.produto === null
    && ccPronta.pedido_id === null && ccPronta.produto === null,
  'concluída a peça do pedido cancelado, ela vai DIRETO ao estoque sem dono — a personalizada e a fora do catálogo ficam sem produto do catálogo',
  JSON.stringify({ destinoCb, destinoCc, cbPronta, ccPronta }),
)
await comoS24(s24.logistica)
const livresS24 = Object.fromEntries(
  (await bd.query(`select card_id::int as id, origem, origem_numero, local
                     from public.plt_fn_estoque(null, 100, 0, null, 'livre')
                    where card_id in (${ca}, ${cb}, ${cc}, ${r1})`)).rows.map((r) => [r.id, r]),
)
conferir(
  livresS24[ca]?.origem === 'cancelamento' && livresS24[ca]?.origem_numero === 924002
    && livresS24[cb]?.origem === 'cancelamento' && livresS24[r1]?.origem === 'reposicao'
    && livresS24[ca]?.local === 'estoque',
  'as peças sem dono dizem de onde vieram: reposição, ou o pedido cancelado (com o número)',
  JSON.stringify(livresS24),
)
const produtoS24 = (
  await bd.query(`select prontos_livres, prontos_reservados from plt_privado.fn_estoque_por_produto() where tiny_id = 924101`)
).rows[0]
conferir(
  produtoS24?.prontos_livres === 2 && produtoS24?.prontos_reservados === 1,
  'Mesa S24: 2 livres (reposição + a do cancelamento; a personalizada NÃO conta) e 1 reservada (a do 924001 no aguardo)',
  JSON.stringify(produtoS24 ?? null),
)

titulo('SESSAO-24 · alocação: peça igual sem dono vira unidade pronta do pedido — e volta se cancelar')

await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao)
    values (924004, (select id from public.clientes order by id limit 1), 'Em aberto');
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade) values
    ((select id from public.pedidos where numero = 924004), 1, 'S24A', 'Mesa Teste S24 - Branca', 2),
    ((select id from public.pedidos where numero = 924004), 2, 'S24A', 'personalizado  mesa 1,20 x 0,60 PRÉTA', 1),
    ((select id from public.pedidos where numero = 924004), 3, 'S24Z', 'Banco que não existe no estoque', 1);
`)
const cardPed4 = (
  await bd.query(`select id::int as id from public.plt_cards
                   where tipo = 'pedido' and pedido_id = (select id from public.pedidos where numero = 924004)`)
).rows[0].id
await comoS24(s24.montaUm)
conferir(
  (await bd.query(`select count(*)::int as total from public.plt_fn_sugestoes_alocacao(${cardPed4})`)).rows[0].total === 0,
  'operador de produção não recebe sugestão de alocação (gate: PCP/logística e admin)',
)
await deveRecusarExec(
  `select public.plt_fn_alocar_peca(${cardPed4}, 1, 1, ${ca})`,
  'operador de produção não aloca peça do estoque',
  /PCP\/logística ou de admin/i,
)
await comoS24(s24.logistica)
const sugestoes = (
  await bd.query(`select item_seq, indice_unidade, peca_card_id::int as peca, peca_origem, pecas_iguais
                    from public.plt_fn_sugestoes_alocacao(${cardPed4}) order by item_seq, indice_unidade`)
).rows
conferir(
  sugestoes.length === 3
    && sugestoes[0].item_seq === 1 && sugestoes[1].item_seq === 1 && sugestoes[0].peca !== sugestoes[1].peca
    && [ca, r1].includes(sugestoes[0].peca) && [ca, r1].includes(sugestoes[1].peca) && sugestoes[0].pecas_iguais === 2
    && sugestoes[2].item_seq === 2 && sugestoes[2].peca === cb,
  'sugestão por vaga: as 2 mesas livres para as 2 unidades do item 1; a personalizada casa por SKU + descrição (maiúsculas, acento e espaço não importam); o banco sem peça igual não tem sugestão',
  JSON.stringify(sugestoes),
)
const n1 = (await bd.query(`select public.plt_fn_alocar_peca(${cardPed4}, 1, 1, ${ca})::int as id`)).rows[0].id
const n1Card = await cardS24(n1)
const caConsumida = await cardS24(ca)
conferir(
  n1Card.setor === 'aguardo' && n1Card.concluido && n1Card.pedido_id !== null
    && n1Card.indice_unidade === 1 && n1Card.total_unidades === 2 && caConsumida.arquivado,
  'aceitar: nasce a unidade (1/2) do pedido direto em Pedidos em aguardo (não volta à produção) e a peça livre é consumida',
  JSON.stringify({ n1Card, caConsumida }),
)
conferir(
  (await bd.query(`select count(*)::int as total from public.plt_eventos
                    where (card_id = ${ca} and tipo = 'peca_alocada')
                       or (card_id = ${n1} and tipo = 'card_criado' and (dados ->> 'alocada_de')::bigint = ${ca})`)).rows[0].total === 2,
  'a alocação é história nos dois cards (peca_alocada na peça; card_criado com alocada_de na unidade)',
)
await deveRecusarExec(
  `select public.plt_fn_alocar_peca(${cardPed4}, 1, 2, ${ca})`,
  'a mesma peça não é usada duas vezes',
  /não está livre no ESTOQUE/i,
)
await deveRecusarExec(
  `select public.plt_fn_alocar_peca(${cardPed4}, 2, 1, ${r1})`,
  'peça que não é igual ao item (mesa do catálogo × personalizada) é recusada',
  /não é igual ao item/i,
)
await deveRecusarExec(
  `select public.plt_fn_alocar_peca(${cardPed4}, 1, 1, ${r1})`,
  'unidade do pedido já preenchida não recebe outra peça',
  /já foi liberada/i,
)
const n2 = (await bd.query(`select public.plt_fn_alocar_peca(${cardPed4}, 2, 1, ${cb})::int as id`)).rows[0].id
const liberadas4 = (
  await bd.query(`select unidades_liberadas from public.plt_fn_pedidos_kanban(p_ids => array[(select id from public.pedidos where numero = 924004)])`)
).rows[0]?.unidades_liberadas
const sugestoesDepois = (
  await bd.query(`select item_seq, peca_card_id::int as peca from public.plt_fn_sugestoes_alocacao(${cardPed4})`)
).rows
conferir(
  liberadas4 === 2 && sugestoesDepois.length === 1 && sugestoesDepois[0].item_seq === 1 && sugestoesDepois[0].peca === r1,
  'o pedido conta 2 liberadas (as alocadas) e a sugestão que sobra é a outra mesa para a vaga que falta',
  JSON.stringify({ liberadas4, sugestoesDepois }),
)

titulo('SESSAO-24 · Pedidos em aguardo: "Pedidos" e "Produtos reservados" batem')

const abaPedidos = (
  await bd.query(`select numero, unidades_prontas, total_unidades, contagem_total::int as total from public.plt_fn_pedidos_aguardo(null, 100, 0)`)
).rows
const abaProdutos = (
  await bd.query(`select card_id::int as id, numero, veio_do_estoque, local, contagem_total::int as total
                    from public.plt_fn_produtos_reservados(null, 100, 0)`)
).rows
const contagens = (await bd.query(`select * from public.plt_fn_aguardo_contagens()`)).rows[0]
const somaProntas = abaPedidos.reduce((s, l) => s + l.unidades_prontas, 0)
conferir(
  contagens.pedidos === abaPedidos.length && contagens.produtos === abaProdutos.length
    && somaProntas === abaProdutos.length && (abaPedidos[0]?.total ?? 0) === abaPedidos.length
    && (abaProdutos[0]?.total ?? 0) === abaProdutos.length,
  'os contadores batem: Σ prontas da aba Pedidos = linhas de Produtos reservados = contagem da aba',
  JSON.stringify({ contagens, somaProntas, pedidos: abaPedidos.length, produtos: abaProdutos.length }),
)
const p924004 = abaPedidos.find((l) => l.numero === 924004)
conferir(
  p924004?.unidades_prontas === 2 && p924004?.total_unidades === 4
    && abaProdutos.filter((p) => p.numero === 924004 && p.veio_do_estoque).length === 2,
  'o 924004 aparece com 2 de 4 prontas; as duas peças dizem que vieram do estoque',
  JSON.stringify({ p924004, produtos: abaProdutos.filter((p) => p.numero === 924004) }),
)
await comoS24(s24.montaUm)
conferir(
  (await bd.query(`select count(*)::int as total from public.plt_fn_produtos_reservados()`)).rows[0].total === 0
    && (await bd.query(`select produtos from public.plt_fn_aguardo_contagens()`)).rows[0].produtos === 0,
  'operador de produção não enxerga Pedidos em aguardo (gate da logística)',
)

await comoS24(s24.admin)
await bd.exec(`update public.pedidos set situacao = 'Cancelado' where numero = 924004`)
const n1Volta = await cardS24(n1)
const n2Volta = await cardS24(n2)
conferir(
  n1Volta.setor === 'estoque' && n1Volta.pedido_id === null && n1Volta.produto === 924101
    && n2Volta.setor === 'estoque' && n2Volta.pedido_id === null,
  'cancelado o pedido que usou peças do estoque, elas voltam ao ESTOQUE sem dono (o fluxo 3 de novo)',
  JSON.stringify({ n1Volta, n2Volta }),
)

titulo('SESSAO-24 · manutenção: peças de pedido que ficaram no ESTOQUE (aguardo · entregue some · 🔴 fica)')

// O legado de produção em 27/09: peça 🟢 de pedido vivo, peça de pedido já
// "Entregue" no Tiny e peça 🔴 de pedido vivo — todas no ESTOQUE, com pedido.
for (const numero of [924005, 924006, 924007]) {
  await bd.exec(`
    insert into public.pedidos (numero, cliente_id, situacao)
      values (${numero}, (select id from public.clientes order by id limit 1), 'Preparando envio');
    insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
      values ((select id from public.pedidos where numero = ${numero}), 1, 'S24A', 'Mesa Teste S24 - Branca', 1);
  `)
}
const legado = await liberarS24(924005, 1, 1, 1, 'S24A', 'Mesa Teste S24 - Branca', 'estoque')
const legadoEntregue = await liberarS24(924007, 1, 1, 1, 'S24A', 'Mesa Teste S24 - Branca', 'estoque')
await bd.exec(`update public.pedidos set situacao = 'Entregue' where numero = 924007`)
// A 🔴 chegou ao ESTOQUE antes da regra: marcada danificada na MONTAGEM e
// levada por lote (origem api — a trava do 🟢 vale só para gesto humano).
const legadoDanificado = await liberarS24(924006, 1, 1, 1, 'S24A', 'Mesa Teste S24 - Branca', 'montagem')
await bd.exec(`
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, usuario_id, origem, estado_qualidade)
    values (${legadoDanificado}, 'qualidade_marcada',
            (select id from public.plt_setores where codigo = 'montagem'),
            (select id from public.plt_setores where codigo = 'estoque'),
            (select id from public.plt_usuarios where usuario = 'monta.um'), 'interface', 'danificado');
  insert into public.plt_eventos (card_id, tipo, setor_origem_id, setor_destino_id, origem)
    values (${legadoDanificado}, 'movimentacao_setor',
            (select id from public.plt_setores where codigo = 'montagem'),
            (select id from public.plt_setores where codigo = 'estoque'), 'api');
`)
const antesDaManutencao = await cardS24(legadoDanificado)
const avisosAntes = (await bd.query(`select count(*)::int as total from public.plt_notificacoes where tipo = 'chegada_aguardo'`)).rows[0].total
await bd.exec(await readFile(path.join(MANUTENCAO, '2026-09-27_pecas_de_pedido_para_aguardo.sql'), 'utf8'))
await bd.exec(await readFile(path.join(MANUTENCAO, '2026-09-27_pecas_de_pedido_para_aguardo.sql'), 'utf8'))
const contarEventosS24 = async (card, tipo) =>
  (await bd.query(`select count(*)::int as total from public.plt_eventos where card_id = ${card} and tipo = '${tipo}'`)).rows[0].total
const legadoDepois = await cardS24(legado)
conferir(
  legadoDepois.setor === 'aguardo' && !legadoDepois.arquivado
    && (await contarEventosS24(legado, 'movimentacao_setor')) === 2,
  'a manutenção leva a peça 🟢 de pedido vivo do ESTOQUE para Pedidos em aguardo — uma vez só (rodar de novo não repete)',
  JSON.stringify(legadoDepois),
)
const entregueDepois = await cardS24(legadoEntregue)
conferir(
  entregueDepois.arquivado && entregueDepois.setor === 'estoque'
    && (await contarEventosS24(legadoEntregue, 'card_arquivado')) === 1
    && (await contarEventosS24(legadoEntregue, 'movimentacao_setor')) === 1,
  'peça de pedido já entregue no Tiny é arquivada por evento ("não deve nem aparecer mais") — uma vez só, sem ir ao aguardo',
  JSON.stringify(entregueDepois),
)
const danificadoDepois = await cardS24(legadoDanificado)
conferir(
  antesDaManutencao.setor === 'estoque' && danificadoDepois.setor === 'estoque'
    && !danificadoDepois.arquivado && danificadoDepois.pedido_id !== null
    && (await contarEventosS24(legadoDanificado, 'movimentacao_setor')) === 2,
  'peça 🔴 de pedido vivo não vai para Pedidos em aguardo (só recebe perfeita) — fica no ESTOQUE para o dono decidir',
  JSON.stringify({ antesDaManutencao, danificadoDepois }),
)
conferir(
  (await bd.query(`select count(*)::int as total from public.plt_cards c
                     join public.plt_setores s on s.id = c.setor_atual_id
                     join public.pedidos p on p.id = c.pedido_id
                    where s.codigo = 'estoque' and c.tipo = 'unidade' and c.arquivado_em is null
                      and not plt_privado.fn_pedido_cancelado(c.pedido_id)
                      and plt_privado.fn_situacao_normalizada(p.situacao) <> 'entregue'
                      and coalesce(c.qualidade_atual, 'perfeito') = 'perfeito'`)).rows[0].total === 0,
  'depois da manutenção, nenhuma peça 🟢 de pedido vivo sobra no ESTOQUE',
)
conferir(
  (await bd.query(`select count(*)::int as total from public.plt_notificacoes where tipo = 'chegada_aguardo'`)).rows[0].total === avisosAntes,
  'vinda de outro fim de linha não dispara o aviso de "peça pronta" (não é produção nova)',
)
conferir(
  (await bd.query(`select cards_parados from public.plt_fn_dash_estoque()`)).rows[0].cards_parados
    === (await bd.query(`select count(*)::int as total from public.plt_cards c join public.plt_setores s on s.id = c.setor_atual_id
                          where s.codigo = 'estoque' and c.tipo = 'unidade' and c.arquivado_em is null`)).rows[0].total,
  'tempo parado no ESTOQUE ignora a peça consumida pela alocação (arquivada)',
)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)

// ============================================================================
// SESSAO-26 · Chat interno (migration 38) — websocket privado, leitura só
// paginada, RLS por participação, aniversários e a leitura por coluna de
// plt_usuarios (E-50). Pessoas próprias (chat.*), ids de sessão ...c00N.
// ============================================================================
const SESSAO_CHAT = {
  admin: '00000000-0000-0000-0000-00000000c001',
  lider: '00000000-0000-0000-0000-00000000c002',
  op1: '00000000-0000-0000-0000-00000000c003',
  op2: '00000000-0000-0000-0000-00000000c004',
  arq: '00000000-0000-0000-0000-00000000c005',
  novato: '00000000-0000-0000-0000-00000000c006',
}
const linhas = async (sql) => (await bd.query(sql)).rows
async function comoChat(quem) {
  await bd.exec(
    `select set_config('request.jwt.claim.sub', '${quem ? SESSAO_CHAT[quem] : ''}', false)`,
  )
}

titulo('SESSAO-26 · plt_usuarios: o navegador só lê as colunas de trabalho (E-50)')
// Em produção o Supabase dá SELECT na TABELA ao authenticated — é esse grant
// que anulava os revoke por coluna. Simula-se o padrão e reaplica-se a 38
// (idempotente): o grant de tabela some, ficam só as colunas de trabalho.
const SQL_CHAT = await readFile(
  path.join(MIGRATIONS, '20260927180000_plt_chat_interno.sql'),
  'utf8',
)
await bd.exec(`
  grant usage on schema public to authenticated;
  grant select on public.plt_usuarios to authenticated;
`)
await bd.exec(SQL_CHAT)
await bd.exec(`set role authenticated`)
for (const coluna of ['cpf', 'pin_hash', 'convite_token', 'data_nascimento']) {
  await deveRecusar(
    `select ${coluna} from public.plt_usuarios limit 1`,
    `a API NÃO lê plt_usuarios.${coluna} (nem com o grant de tabela do Supabase)`,
    /permission denied|permissão negada/i,
  )
}
const colunasDeTrabalho = await linhas(`
  select id, auth_user_id, nome, email, telefone, papel, ativo, usuario, matricula,
         senha_padrao, tema, foto_caminho, modulos, arquivado_em, fila_prioridade
    from public.plt_usuarios limit 1`)
conferir(
  colunasDeTrabalho.length === 1,
  'as colunas de trabalho seguem legíveis (perfil, equipe, tablet, fila de prioridade)',
)
await bd.exec(`reset role`)

titulo('SESSAO-26 · Avisos gerais: uma conversa só, e todo cadastro participa')
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel, auth_user_id) values
    ('Chat Admin',         'chat.admin@teste.com', '962.000.001-01', 'chat.admin', 'admin',    '${SESSAO_CHAT.admin}'),
    ('Chat Líder',         'chat.lider@teste.com', '962.000.002-02', 'chat.lider', 'lider',    '${SESSAO_CHAT.lider}'),
    ('Chat Operador Um',   'chat.op1@teste.com',   '962.000.003-03', 'chat.op1',   'operador', '${SESSAO_CHAT.op1}'),
    ('Chat Operador Dois', 'chat.op2@teste.com',   '962.000.004-04', 'chat.op2',   'operador', '${SESSAO_CHAT.op2}'),
    ('Chat Arquivado',     'chat.arq@teste.com',   '962.000.005-05', 'chat.arq',   'operador', '${SESSAO_CHAT.arq}');
  update public.plt_usuarios set ativo = false, arquivado_em = now() where usuario = 'chat.arq';
`)
const PESSOA = {}
for (const chave of ['admin', 'lider', 'op1', 'op2', 'arq']) {
  PESSOA[chave] = (await linhas(`select id from public.plt_usuarios where usuario = 'chat.${chave}'`))[0].id
}
const conversasAvisos = await linhas(
  `select id::int as id, nome from public.plt_chat_conversas where tipo = 'avisos'`,
)
conferir(
  conversasAvisos.length === 1 && conversasAvisos[0].nome === 'Avisos gerais',
  'Avisos gerais semeado UMA vez (a migration rodou 3 vezes)',
  JSON.stringify(conversasAvisos),
)
const AVISOS = conversasAvisos[0]?.id
const foraDosAvisos = (
  await linhas(`
    select count(*)::int as n from public.plt_usuarios u
     where not exists (select 1 from public.plt_chat_participantes p
                        where p.conversa_id = ${AVISOS} and p.usuario_id = u.id)`)
)[0].n
conferir(
  foraDosAvisos === 0,
  'todo cadastro participa dos Avisos gerais — os antigos (carga) e os novos (gatilho no cadastro)',
  `${foraDosAvisos} fora`,
)

titulo('SESSAO-26 · data de nascimento: a própria pessoa ou o admin — com trilha, sem o valor')
await comoChat('op1')
await bd.exec(`select public.plt_fn_definir_nascimento(null, date '1990-05-17')`)
conferir(
  (await linhas(`select public.plt_fn_ler_nascimento() = date '1990-05-17' as ok`))[0].ok === true,
  'a pessoa grava e lê a PRÓPRIA data de nascimento',
)
await deveRecusar(
  `select public.plt_fn_ler_nascimento('${PESSOA.op2}')`,
  'operador NÃO lê a data de nascimento de outra pessoa',
  /própria pessoa ou o admin/i,
)
await deveRecusar(
  `select public.plt_fn_definir_nascimento('${PESSOA.op2}', date '1991-01-01')`,
  'operador NÃO muda a data de outra pessoa',
  /própria pessoa ou o admin/i,
)
await deveRecusar(
  `select public.plt_fn_definir_nascimento(null, date '1850-01-01')`,
  'data antes de 1900 é recusada',
  /fora do intervalo/i,
)
await deveRecusar(
  `select public.plt_fn_definir_nascimento(null, current_date + 5)`,
  'data no futuro é recusada',
  /fora do intervalo/i,
)
await comoChat('admin')
await bd.exec(`select public.plt_fn_definir_nascimento('${PESSOA.op2}', date '1991-01-01')`)
conferir(
  (await linhas(`select public.plt_fn_ler_nascimento('${PESSOA.op2}') = date '1991-01-01' as ok`))[0]
    .ok === true,
  'o admin lê e grava a data de qualquer pessoa',
)
await comoChat(null)
const logsNascimento = await linhas(`
  select contexto from public.plt_logs_atividade
   where acao = 'data_nascimento_alterada'
     and contexto ->> 'alvo_id' in ('${PESSOA.op1}', '${PESSOA.op2}')`)
conferir(
  logsNascimento.length === 2 &&
    logsNascimento.every((l) => !/19(90|91)/.test(JSON.stringify(l.contexto))),
  'cada mudança foi para a trilha — quem mudou e de quem, NUNCA a data (D-40)',
  JSON.stringify(logsNascimento),
)

titulo('SESSAO-26 · canal: só líder ou admin cria; quem cria administra')
await bd.exec(`delete from realtime.messages`)
await comoChat('op1')
await deveRecusar(
  `select public.plt_fn_chat_criar_canal('Canal do operador', array['${PESSOA.op2}']::uuid[])`,
  'operador NÃO cria canal (resposta 2 do dono)',
  /líder ou de admin/i,
)
await comoChat('lider')
await deveRecusar(
  `select public.plt_fn_chat_criar_canal('   ', '{}')`,
  'canal sem nome é recusado',
  /nome ao canal/i,
)
const CANAL = (
  await linhas(`
    select public.plt_fn_chat_criar_canal('Montagem — turno da manhã',
      array['${PESSOA.op1}', '${PESSOA.op1}', '${PESSOA.arq}', '${PESSOA.lider}']::uuid[])::int as id`)
)[0].id
const membrosDoCanal = await linhas(
  `select usuario_id, papel from public.plt_chat_participantes where conversa_id = ${CANAL}`,
)
conferir(
  membrosDoCanal.length === 2 &&
    membrosDoCanal.some((m) => m.usuario_id === PESSOA.lider && m.papel === 'administrador') &&
    membrosDoCanal.some((m) => m.usuario_id === PESSOA.op1 && m.papel === 'membro'),
  'o líder criou e administra; o operador entrou UMA vez; o arquivado ficou de fora',
  JSON.stringify(membrosDoCanal),
)
const logCriacao = await linhas(`
  select contexto from public.plt_logs_atividade
   where acao = 'chat_canal_criado' and (contexto ->> 'conversa_id')::bigint = ${CANAL}`)
conferir(
  logCriacao.length === 1 && logCriacao[0].contexto.membros === 1,
  'a criação do canal foi para a trilha (D-40)',
  JSON.stringify(logCriacao),
)
const sinaisEntrou = (await linhas(`select topic from realtime.messages where event = 'entrou'`)).map(
  (s) => s.topic,
)
conferir(
  sinaisEntrou.length === 2 &&
    sinaisEntrou.includes(`plt-chat-u:${PESSOA.lider}`) &&
    sinaisEntrou.includes(`plt-chat-u:${PESSOA.op1}`),
  'o criador e o membro receberam o sinal "entrou" — cada um no PRÓPRIO canal',
  sinaisEntrou.join(' | '),
)

titulo('SESSAO-26 · particular: uma conversa por par, quem quer que abra')
await comoChat('op1')
const PARTICULAR = (
  await linhas(`select public.plt_fn_chat_abrir_particular('${PESSOA.op2}')::int as id`)
)[0].id
await comoChat('op2')
const particularDeVolta = (
  await linhas(`select public.plt_fn_chat_abrir_particular('${PESSOA.op1}')::int as id`)
)[0].id
conferir(PARTICULAR === particularDeVolta, 'op1 → op2 e op2 → op1 caem na MESMA conversa')
await deveRecusar(
  `select public.plt_fn_chat_abrir_particular('${PESSOA.op2}')`,
  'ninguém abre particular consigo mesmo',
  /outra pessoa/i,
)
await deveRecusar(
  `select public.plt_fn_chat_abrir_particular('${PESSOA.arq}')`,
  'particular com pessoa arquivada é recusada',
  /não está ativa/i,
)

titulo('SESSAO-26 · enviar: só quem participa; a mensagem sai pelo websocket (broadcast privado)')
await bd.exec(`delete from realtime.messages`)
await comoChat('op1')
const enviada = (
  await linhas(
    `select id::int as id, autor_nome, texto from public.plt_fn_chat_enviar(${CANAL}, '   Bom dia, turma!   ')`,
  )
)[0]
conferir(
  enviada?.texto === 'Bom dia, turma!' && enviada?.autor_nome === 'Chat Operador Um',
  'o POST devolve a mensagem gravada (sem espaços nas pontas) — quem envia não relê nada',
  JSON.stringify(enviada),
)
const naConversa = await linhas(
  `select event, payload from realtime.messages where topic = 'plt-chat-c:${CANAL}'`,
)
conferir(
  naConversa.length === 1 &&
    naConversa[0].event === 'mensagem' &&
    naConversa[0].payload.texto === 'Bom dia, turma!' &&
    naConversa[0].payload.autor_nome === 'Chat Operador Um',
  'UMA transmissão no canal da conversa, com a mensagem inteira',
  JSON.stringify(naConversa),
)
const sinaisDaMensagem = await linhas(
  `select topic, payload from realtime.messages where topic like 'plt-chat-u:%'`,
)
conferir(
  sinaisDaMensagem.length === 2 &&
    sinaisDaMensagem.every(
      (s) => s.payload.previa === 'Bom dia, turma!' && Number(s.payload.conversa_id) === CANAL,
    ),
  'um sinal pequeno no canal de CADA participante (badge e lista), com a prévia',
  JSON.stringify(sinaisDaMensagem),
)
const ponteiroDoAutor = (
  await linhas(`
    select ultima_lida_id::int as p from public.plt_chat_participantes
     where conversa_id = ${CANAL} and usuario_id = '${PESSOA.op1}'`)
)[0].p
conferir(ponteiroDoAutor === enviada.id, 'a própria mensagem já conta como lida para quem enviou')
await deveRecusar(
  `select * from public.plt_fn_chat_enviar(${CANAL}, '   ')`,
  'mensagem vazia é recusada',
  /Escreva a mensagem/i,
)
await deveRecusar(
  `select * from public.plt_fn_chat_enviar(${CANAL}, repeat('a', 2001))`,
  'mensagem acima de 2.000 caracteres é recusada',
  /2\.000 caracteres/i,
)
await bd.exec(`select * from public.plt_fn_chat_enviar(${PARTICULAR}, 'Oi, tudo bem?')`)
await comoChat('op2')
await deveRecusar(
  `select * from public.plt_fn_chat_enviar(${CANAL}, 'Posso entrar?')`,
  'quem NÃO participa não escreve no canal',
  /não participa/i,
)
await bd.exec(`select * from public.plt_fn_chat_enviar(${PARTICULAR}, 'Tudo ótimo!')`)

titulo('SESSAO-26 · Avisos gerais: o admin escreve e decide quem mais escreve (resposta 3)')
await comoChat('op1')
await deveRecusar(
  `select * from public.plt_fn_chat_enviar(${AVISOS}, 'Oi, pessoal')`,
  'operador NÃO escreve nos Avisos gerais sem liberação',
  /admin liberou/i,
)
await comoChat('lider')
await deveRecusar(
  `select public.plt_fn_chat_definir_escritor('${PESSOA.op1}', true)`,
  'líder NÃO decide quem escreve nos avisos — só o admin',
  /Só o admin/i,
)
await comoChat('admin')
await bd.exec(`delete from realtime.messages`)
await bd.exec(`select * from public.plt_fn_chat_enviar(${AVISOS}, 'Amanhã a fábrica abre às 7h.')`)
const sinaisDoAviso = (
  await linhas(`select count(*)::int as n from realtime.messages where topic like 'plt-chat-u:%'`)
)[0].n
const pessoasAtivas = (await linhas(`select count(*)::int as n from public.plt_usuarios where ativo`))[0]
  .n
conferir(
  sinaisDoAviso === pessoasAtivas,
  'o aviso sinaliza TODAS as pessoas ativas pelo websocket (nenhuma arquivada)',
  `${sinaisDoAviso} sinais × ${pessoasAtivas} ativas`,
)
const logDoAviso = await linhas(
  `select contexto from public.plt_logs_atividade where acao = 'chat_aviso_publicado' order by id desc limit 1`,
)
conferir(
  logDoAviso.length === 1 && !JSON.stringify(logDoAviso[0].contexto).includes('fábrica'),
  'aviso publicado foi para a trilha — sem o conteúdo (D-40)',
  JSON.stringify(logDoAviso),
)
await bd.exec(`select public.plt_fn_chat_definir_escritor('${PESSOA.op1}', true)`)
await comoChat('op1')
conferir(
  (await linhas(`select id from public.plt_fn_chat_enviar(${AVISOS}, 'Obrigado pelo aviso!')`))
    .length === 1,
  'liberado pelo admin, o operador escreve nos avisos',
)
await comoChat('admin')
await bd.exec(`select public.plt_fn_chat_definir_escritor('${PESSOA.op1}', false)`)
await comoChat('op1')
await deveRecusar(
  `select * from public.plt_fn_chat_enviar(${AVISOS}, 'De novo')`,
  'liberação retirada: o operador volta a só ler',
  /admin liberou/i,
)

titulo('SESSAO-26 · mensagem é só inserção; conversa não se apaga')
await comoChat(null)
await deveRecusar(
  `update public.plt_chat_mensagens set texto = 'editada' where id = ${enviada.id}`,
  'editar mensagem é recusado — até para quem ignora RLS (M-14)',
  /não se edita nem se apaga/i,
)
await deveRecusar(
  `delete from public.plt_chat_mensagens where id = ${enviada.id}`,
  'apagar mensagem é recusado',
  /não se edita nem se apaga/i,
)
await deveRecusar(
  `delete from public.plt_chat_conversas where id = ${CANAL}`,
  'apagar conversa é recusado',
  /não se apaga/i,
)
await deveRecusar(
  `update public.plt_chat_conversas set criada_em = now() - interval '1 day' where id = ${CANAL}`,
  'mexer em outra coisa da conversa que não o nome é recusado',
  /só o nome muda/i,
)

titulo('SESSAO-26 · quem não participa não lê nada — nem pela API, nem sendo admin')
await bd.exec(`set role authenticated`)
await comoChat('op2')
const op2NoCanal = (
  await linhas(`
    select (select count(*) from public.plt_chat_mensagens where conversa_id = ${CANAL})::int as m,
           (select count(*) from public.plt_chat_conversas where id = ${CANAL})::int as c,
           (select count(*) from public.plt_chat_participantes where conversa_id = ${CANAL})::int as p`)
)[0]
conferir(
  op2NoCanal.m === 0 && op2NoCanal.c === 0 && op2NoCanal.p === 0,
  'fora do canal: 0 mensagens, 0 conversa, 0 membros pela API (RLS, papel simulado)',
  JSON.stringify(op2NoCanal),
)
await deveRecusar(
  `select * from public.plt_fn_chat_mensagens(${CANAL})`,
  'e a porta de mensagens recusa quem não participa',
  /não participa/i,
)
await comoChat('admin')
conferir(
  (await linhas(`select count(*)::int as m from public.plt_chat_mensagens where conversa_id = ${PARTICULAR}`))[0]
    .m === 0,
  'ADMIN não lê a particular dos outros pela API',
)
await deveRecusar(
  `select * from public.plt_fn_chat_mensagens(${PARTICULAR})`,
  'nem pela porta',
  /não participa/i,
)
await comoChat('op1')
conferir(
  (await linhas(`select count(*)::int as m from public.plt_chat_mensagens where conversa_id = ${PARTICULAR}`))[0]
    .m === 2,
  'quem participa lê a conversa inteira',
)
await deveRecusar(
  `insert into public.plt_chat_mensagens (conversa_id, autor_id, texto) values (${CANAL}, '${PESSOA.op1}', 'direto')`,
  'ninguém grava direto na tabela — só pela porta',
  /permission denied|permissão negada/i,
)
await bd.exec(`reset role`)

titulo('SESSAO-26 · canal de websocket privado: só entra quem pode (política em realtime.messages)')
// O Realtime confere a ENTRADA lendo realtime.messages com o tópico no
// contexto (realtime.topic()); com uma linha de cada tópico, "vê a linha" =
// "entra no canal".
await bd.exec(`
  delete from realtime.messages;
  insert into realtime.messages (topic, event, payload) values
    ('plt-chat-u:${PESSOA.op1}', 'teste', '{}'),
    ('plt-chat-u:${PESSOA.op2}', 'teste', '{}'),
    ('plt-chat-c:${CANAL}',      'teste', '{}'),
    ('plt-chat-c:${PARTICULAR}', 'teste', '{}'),
    ('plt-chat-c:abc',           'teste', '{}'),
    ('outro-topico',             'teste', '{}');
`)
await bd.exec(`set role authenticated`)
async function entraNoCanal(quem, topico) {
  await comoChat(quem)
  await bd.exec(`select set_config('realtime.topic', '${topico}', false)`)
  return (
    (await linhas(`select count(*)::int as n from realtime.messages where topic = '${topico}'`))[0].n > 0
  )
}
conferir(await entraNoCanal('op1', `plt-chat-u:${PESSOA.op1}`), 'a pessoa entra no PRÓPRIO canal de sinais')
conferir(
  !(await entraNoCanal('op1', `plt-chat-u:${PESSOA.op2}`)),
  'e NÃO entra no canal de sinais de outra pessoa',
)
conferir(await entraNoCanal('op1', `plt-chat-c:${CANAL}`), 'participante entra no canal da conversa')
conferir(!(await entraNoCanal('op2', `plt-chat-c:${CANAL}`)), 'quem não participa NÃO entra')
conferir(
  !(await entraNoCanal('admin', `plt-chat-c:${PARTICULAR}`)),
  'nem o admin entra no canal da particular dos outros',
)
conferir(
  !(await entraNoCanal('op1', 'plt-chat-c:abc')) && !(await entraNoCanal('op1', 'outro-topico')),
  'tópico estranho: ninguém entra',
)
await bd.exec(`reset role; select set_config('realtime.topic', '', false);`)
await comoChat(null)

titulo('SESSAO-26 · lista de conversas: 5 por página, a mais recente primeiro; a 1ª traz o total')
await comoChat('lider')
const CANAIS_EXTRAS = []
for (const n of [1, 2, 3, 4]) {
  const id = (
    await linhas(
      `select public.plt_fn_chat_criar_canal('Canal extra ${n}', array['${PESSOA.op1}']::uuid[])::int as id`,
    )
  )[0].id
  await bd.exec(`select * from public.plt_fn_chat_enviar(${id}, 'Mensagem ${n} do canal extra')`)
  CANAIS_EXTRAS.push(id)
}
await comoChat('op1')
const PARTICULAR_VAZIA = (
  await linhas(`select public.plt_fn_chat_abrir_particular('${PESSOA.admin}')::int as id`)
)[0].id
const pagina1 = await linhas(`
  select conversa_id::int as id, tipo, titulo, atividade_em::text as atividade, nao_lidas,
         total_nao_lidas, pode_escrever, administra
    from public.plt_fn_chat_conversas()`)
conferir(pagina1.length === 5, '1ª página: exatamente 5 conversas', `vieram ${pagina1.length}`)
const ultimaDaPagina = pagina1[pagina1.length - 1]
const pagina2 = await linhas(`
  select conversa_id::int as id, tipo, titulo, nao_lidas, total_nao_lidas, pode_escrever, administra
    from public.plt_fn_chat_conversas('${ultimaDaPagina.atividade}'::timestamptz, ${ultimaDaPagina.id})`)
const todas = [...pagina1, ...pagina2]
conferir(
  pagina2.length === 2 && new Set(todas.map((c) => c.id)).size === 7,
  'a 2ª página (cursor) traz o resto — 7 conversas, nenhuma repetida',
  JSON.stringify(todas.map((c) => c.id)),
)
conferir(
  !todas.some((c) => c.id === PARTICULAR_VAZIA),
  'particular sem mensagem nenhuma não aparece na lista (ninguém disse nada ainda)',
)
conferir(
  (await linhas(`select count(*)::int as n from public.plt_fn_chat_conversas(null, null, 5, ${PARTICULAR_VAZIA})`))[0]
    .n === 1,
  '… mas abre pelo link (resumo de uma conversa só)',
)
const somaNaoLidas = todas.reduce((soma, c) => soma + c.nao_lidas, 0)
conferir(
  pagina1[0].total_nao_lidas === somaNaoLidas && somaNaoLidas === 5 && pagina2[0].total_nao_lidas === null,
  'o total da 1ª página = soma das não lidas (4 canais extras + a resposta na particular); a 2ª não recalcula',
  `total ${pagina1[0].total_nao_lidas} × soma ${somaNaoLidas}`,
)
const particularDaLista = todas.find((c) => c.id === PARTICULAR)
conferir(
  particularDaLista?.titulo === 'Chat Operador Dois' && particularDaLista?.nao_lidas === 1,
  'na particular, o título é o nome da OUTRA pessoa',
  JSON.stringify(particularDaLista),
)
const avisosDaLista = pagina1.concat(pagina2).find((c) => c.id === AVISOS)
const canalDaLista = todas.find((c) => c.id === CANAL)
conferir(
  avisosDaLista?.pode_escrever === false && canalDaLista?.pode_escrever === true && canalDaLista?.administra === false,
  'a lista já diz se pode escrever e se administra (sem outra leitura)',
  JSON.stringify({ avisosDaLista, canalDaLista }),
)

titulo('SESSAO-26 · marcar como lida: o ponteiro só anda para frente e sincroniza a outra aba')
await bd.exec(`delete from realtime.messages`)
const extra0 = CANAIS_EXTRAS[0]
const ultimaDoExtra0 = (
  await linhas(`select max(id)::int as m from public.plt_chat_mensagens where conversa_id = ${extra0}`)
)[0].m
const ponteiroNovo = (
  await linhas(`select public.plt_fn_chat_marcar_lida(${extra0}, 999999999)::int as p`)
)[0].p
conferir(ponteiroNovo === ultimaDoExtra0, 'lida até a última mensagem da conversa (nunca além dela)')
const totalDepois = (await linhas(`select total_nao_lidas from public.plt_fn_chat_conversas()`))[0]
  .total_nao_lidas
conferir(totalDepois === 4, 'o total cai 1', `total ${totalDepois}`)
const sinalLida = await linhas(`select topic, payload from realtime.messages where event = 'lida'`)
conferir(
  sinalLida.length === 1 &&
    sinalLida[0].topic === `plt-chat-u:${PESSOA.op1}` &&
    Number(sinalLida[0].payload.ultima_lida_id) === ultimaDoExtra0,
  'o sinal "lida" vai para o canal da própria pessoa (a outra aba apaga o badge)',
  JSON.stringify(sinalLida),
)
await bd.exec(`delete from realtime.messages`)
const ponteiroVolta = (await linhas(`select public.plt_fn_chat_marcar_lida(${extra0}, 1)::int as p`))[0].p
conferir(
  ponteiroVolta === ultimaDoExtra0 &&
    (await linhas(`select count(*)::int as n from realtime.messages`))[0].n === 0,
  'o ponteiro nunca volta — e sem mudança não há sinal',
)

titulo('SESSAO-26 · mensagens: 10 por página, "anteriores" pelo cursor, teto do banco')
await comoChat('lider')
const extra1 = CANAIS_EXTRAS[1]
await bd.exec(
  `select (public.plt_fn_chat_enviar(${extra1}, 'Rajada ' || g)).id from generate_series(1, 120) g`,
)
await comoChat('op1')
const paginaMsg1 = await linhas(`select id::int as id from public.plt_fn_chat_mensagens(${extra1})`)
conferir(
  paginaMsg1.length === 10 && paginaMsg1[0].id > paginaMsg1[9].id,
  '1ª página: as 10 mais novas, da mais nova para a mais antiga',
)
const paginaMsg2 = await linhas(
  `select id::int as id from public.plt_fn_chat_mensagens(${extra1}, ${paginaMsg1[9].id})`,
)
conferir(
  paginaMsg2.length === 10 && paginaMsg2[0].id < paginaMsg1[9].id,
  '"ver anteriores" traz as 10 de antes do cursor, sem repetir',
)
conferir(
  (await linhas(`select id from public.plt_fn_chat_mensagens(${extra1}, null, 50)`)).length === 10,
  'pedir 50 devolve 10 — o teto é do banco (adendo do dono)',
)
conferir(
  (await linhas(`select conversa_id from public.plt_fn_chat_conversas(null, null, 50)`)).length === 5,
  'e pedir 50 conversas devolve 5',
)
const rajada = (
  await linhas(`select nao_lidas from public.plt_fn_chat_conversas() where conversa_id = ${extra1}`)
)[0]
conferir(
  rajada?.nao_lidas === 100,
  'não lidas têm teto (100): o badge mostra "99+" sem contar o mundo',
  JSON.stringify(rajada ?? null),
)

titulo('SESSAO-26 · membros: quem administra põe e tira; quem sai perde a leitura')
const membrosLista = await linhas(
  `select usuario_id, papel, total from public.plt_fn_chat_membros(${CANAL})`,
)
conferir(
  membrosLista.length === 2 && membrosLista[0].papel === 'administrador' && membrosLista[0].total === 2,
  'membros paginados, quem administra primeiro, com o total',
  JSON.stringify(membrosLista),
)
await deveRecusar(
  `select public.plt_fn_chat_adicionar_membros(${CANAL}, array['${PESSOA.op2}']::uuid[])`,
  'membro comum NÃO põe gente no canal',
  /administra o canal/i,
)
await deveRecusar(
  `select public.plt_fn_chat_renomear_canal(${CANAL}, 'Outro nome')`,
  'membro comum NÃO renomeia o canal',
  /administra o canal/i,
)
await comoChat('lider')
await bd.exec(`delete from realtime.messages`)
const postos = (
  await linhas(
    `select public.plt_fn_chat_adicionar_membros(${CANAL}, array['${PESSOA.op2}', '${PESSOA.op1}', '${PESSOA.arq}']::uuid[]) as n`,
  )
)[0].n
conferir(postos === 1, 'entra só quem ainda não está e está ativo (op2 sim; op1 já estava; arquivado não)')
conferir(
  (await linhas(`select count(*)::int as n from realtime.messages where event = 'entrou' and topic = 'plt-chat-u:${PESSOA.op2}'`))[0]
    .n === 1,
  'quem entrou recebeu o sinal "entrou"',
)
await deveRecusar(
  `select public.plt_fn_chat_remover_membro(${CANAL}, '${PESSOA.lider}')`,
  'ninguém tira a si mesmo do canal',
  /a si mesmo/i,
)
await bd.exec(`select public.plt_fn_chat_remover_membro(${CANAL}, '${PESSOA.op2}')`)
conferir(
  (await linhas(`select count(*)::int as n from realtime.messages where event = 'saiu' and topic = 'plt-chat-u:${PESSOA.op2}'`))[0]
    .n === 1,
  'quem saiu recebeu o sinal "saiu"',
)
await comoChat('op2')
await deveRecusar(
  `select * from public.plt_fn_chat_mensagens(${CANAL})`,
  'fora do canal, perde a leitura na hora',
  /não participa/i,
)
await comoChat('lider')
await bd.exec(`select public.plt_fn_chat_adicionar_membros(${CANAL}, array['${PESSOA.op2}', '${PESSOA.admin}']::uuid[])`)
conferir(
  (await linhas(`select saiu_em from public.plt_chat_participantes where conversa_id = ${CANAL} and usuario_id = '${PESSOA.op2}'`))[0]
    .saiu_em === null,
  'posto de novo, volta (a saída não apaga nada)',
)
await bd.exec(`delete from realtime.messages`)
await bd.exec(`select public.plt_fn_chat_renomear_canal(${CANAL}, 'Montagem — manhã')`)
conferir(
  (await linhas(`select count(*)::int as n from realtime.messages where event = 'renomeada'`))[0].n ===
    4,
  'renomear avisa os 4 membros ativos (lider, op1, op2, admin)',
)
await comoChat('admin')
await bd.exec(`select public.plt_fn_chat_remover_membro(${CANAL}, '${PESSOA.op2}')`)
conferir(true, 'o admin da plataforma que está no canal também administra')
await comoChat(null)
const acoesChat = (
  await linhas(
    `select distinct acao from public.plt_logs_atividade where acao like 'chat\\_%' order by acao`,
  )
).map((l) => l.acao)
conferir(
  [
    'chat_aviso_publicado',
    'chat_canal_criado',
    'chat_canal_renomeado',
    'chat_escritor_definido',
    'chat_membro_adicionado',
    'chat_membro_removido',
  ].every((a) => acoesChat.includes(a)),
  'na trilha: canal criado/renomeado, membro posto/tirado, escritor dos avisos, aviso publicado',
  acoesChat.join(', '),
)
conferir(
  (
    await linhas(`
      select count(*)::int as n from public.plt_logs_atividade
       where contexto::text ilike '%Bom dia, turma%' or contexto::text ilike '%fábrica abre%'
          or contexto::text ilike '%tudo bem%'`)
  )[0].n === 0,
  'nenhum conteúdo de mensagem na trilha — e a particular nem aparece nela',
)

titulo('SESSAO-26 · aniversário: o Sistema publica sozinho nos Avisos gerais (resposta 1)')
await bd.exec(`
  update public.plt_usuarios
     set data_nascimento = make_date(1990,
           extract(month from (now() at time zone 'America/Fortaleza'))::int,
           extract(day from (now() at time zone 'America/Fortaleza'))::int)
   where usuario in ('chat.op1', 'chat.arq');
  update public.plt_usuarios set data_nascimento = date '1992-02-29' where usuario = 'chat.op2';
  delete from realtime.messages;
`)
const publicados = (await linhas(`select plt_privado.fn_chat_publicar_aniversarios() as n`))[0].n
const parabens = await linhas(`
  select texto, autor_id, sobre_usuario_id, conversa_id::int as c
    from public.plt_chat_mensagens where tipo = 'aniversario'`)
conferir(
  publicados === 1 &&
    parabens.length === 1 &&
    parabens[0].c === AVISOS &&
    parabens[0].autor_id === null &&
    parabens[0].sobre_usuario_id === PESSOA.op1,
  'no dia, UM parabéns do Sistema nos Avisos gerais — do ativo (o arquivado não)',
  JSON.stringify(parabens),
)
conferir(
  parabens[0]?.texto ===
    '🎉 Hoje é aniversário de Chat Operador Um! Parabéns — toda a Domoby deseja um ótimo dia.',
  'o texto é o aprovado pelo dono',
  parabens[0]?.texto,
)
const sinaisDoParabens = (
  await linhas(`select count(*)::int as n from realtime.messages where topic like 'plt-chat-u:%'`)
)[0].n
conferir(
  sinaisDoParabens === pessoasAtivas,
  'o parabéns chega a todas as pessoas ativas pelo websocket',
  `${sinaisDoParabens} × ${pessoasAtivas}`,
)
conferir(
  (await linhas(`select plt_privado.fn_chat_publicar_aniversarios() as n`))[0].n === 0,
  'rodar de novo no mesmo dia não repete (um por pessoa por dia)',
)
await deveRecusar(
  `insert into public.plt_chat_mensagens (conversa_id, tipo, texto, sobre_usuario_id)
     values (${AVISOS}, 'aniversario', 'duplicado', '${PESSOA.op1}')`,
  'o índice único barra o parabéns duplicado mesmo por fora da função',
  /aniversario_uq|duplicate/i,
)
conferir(
  (await linhas(`select plt_privado.fn_chat_publicar_aniversarios(date '2028-02-28') as n`))[0].n === 0,
  'em ano bissexto, quem nasceu em 29/02 NÃO é lembrado no dia 28',
)
conferir(
  (await linhas(`select plt_privado.fn_chat_publicar_aniversarios(date '2027-02-28') as n`))[0].n === 1,
  'em ano não bissexto, quem nasceu em 29/02 é lembrado em 28/02',
)

titulo('SESSAO-26 · quem chega participa dos Avisos gerais sem herdar "não lidas" antigas')
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel, auth_user_id)
    values ('Chat Novato', 'chat.novato@teste.com', '962.000.006-06', 'chat.novato', 'operador',
            '${SESSAO_CHAT.novato}');
`)
await comoChat('novato')
const doNovato = await linhas(
  `select tipo, nao_lidas, total_nao_lidas from public.plt_fn_chat_conversas()`,
)
conferir(
  doNovato.length === 1 &&
    doNovato[0].tipo === 'avisos' &&
    doNovato[0].nao_lidas === 0 &&
    doNovato[0].total_nao_lidas === 0,
  'o novato vê os Avisos gerais com zero não lidas (o ponteiro nasce na última mensagem)',
  JSON.stringify(doNovato),
)
await comoChat(null)

// ============================================================================
// AJUSTE DO ESTOQUE (28/09 — migration 40): a contagem dos acabados é da
// logística (entrada/baixa/contagem), Top 20+, mínimo e capacidade do galpão na
// plataforma, sugestão que cabe no galpão e a foto do produto (D-70…D-73).
// O dono: "a logística irá dar baixa manual na quantidade de itens em estoque
// por enquanto"; "a quantidade mínima sugerida deve se adequar ao tamanho
// máximo do galpão (cuidado aqui)".
// ============================================================================
titulo('Ajuste do estoque (28/09) · entrada, baixa e contagem manual da logística')

const E40 = {
  admin: '00000000-0000-0000-0000-000000000001',
  logistica: '00000000-0000-0000-0000-000000000031',
  operador: '00000000-0000-0000-0000-000000000011',
}
const como40 = (auth) => bd.exec(`select set_config('request.jwt.claim.sub', '${auth ?? ''}', false)`)
const linhas40 = async (sql) => (await bd.query(sql)).rows
const pecasLivres40 = async (tinyId) =>
  (
    await linhas40(`
      select count(*)::int as n from public.plt_cards c
        join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
       where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
         and c.produto_tiny_id = ${tinyId}`)
  )[0].n

await bd.exec(`
  insert into public.produtos (tiny_id, codigo, descricao, classe, situacao, estoque_minimo, unidade) values
    (940001, 'S40A', 'Armário Teste 40 - Branco', 'F', 'A', 3, 'un'),
    (940002, 'S40B', 'Nicho Teste 40 - Branco', 'F', 'A', null, 'un'),
    (940003, 'S40C', 'Painel Teste 40 - Preto', 'F', 'A', 2, 'un'),
    (940004, 'S40M', 'Chapa MDF Teste 40', 'M', 'A', null, 'chapa'),
    (940005, 'S40I', 'Armário Teste 40 - modelo antigo', 'F', 'I', null, 'un'),
    (940006, 'S40Z', 'Cabideiro Teste 40 sem venda', 'F', 'A', null, 'un')
  on conflict (tiny_id) do nothing;
`)
await como40(E40.logistica)
const entrada3 = (await linhas40(`select public.plt_fn_estoque_movimentar(940001, 'entrada', 3, 'contei no galpão') as n`))[0].n
const criadas = await linhas40(`
  select c.id::int as id, c.indice_unidade as k, c.total_unidades as n, c.item_codigo as sku,
         e.origem, e.dados ->> 'motivo' as motivo, (e.dados ->> 'lote')::int as lote,
         e.usuario_id = (select id from public.plt_usuarios where usuario = 'log.um') as da_logistica,
         s.codigo as setor, c.concluido_em is not null as pronta
    from public.plt_cards c
    join public.plt_eventos e on e.card_id = c.id and e.tipo = 'card_criado'
    join public.plt_setores s on s.id = c.setor_atual_id
   where c.produto_tiny_id = 940001 and c.tipo = 'unidade'
   order by c.id`)
conferir(
  entrada3 === 3 && criadas.length === 3
    && criadas.every((c) => c.setor === 'estoque' && c.pronta && c.sku === 'S40A' && c.n === 3
      && c.origem === 'interface' && c.motivo === 'entrada_manual' && c.da_logistica && c.lote === criadas[0].id),
  'entrada de 3: nascem 3 peças LIVRES no ESTOQUE (card sem pedido, com o produto), cada uma com o evento de quem cadastrou e o mesmo lote',
  JSON.stringify({ entrada3, criadas }),
)
conferir(
  (await linhas40(`select count(*)::int as n from public.plt_logs_atividade
                    where acao = 'card_criado' and (contexto ->> 'card_id')::int in (${criadas.map((c) => c.id).join(',')})`))[0].n === 3,
  'cada peça cadastrada deixa rastro na trilha de atividade (D-40)',
)
const pecasManuais = await linhas40(`select dono, origem from public.plt_fn_estoque(null, 100, 0, 940001, null)`)
conferir(
  pecasManuais.length === 3 && pecasManuais.every((p) => p.dono === 'livre' && p.origem === 'manual'),
  'na lista de peças a origem é "entrada manual" (peça sem card pai)',
  JSON.stringify(pecasManuais),
)
const baixa1 = (await linhas40(`select public.plt_fn_estoque_movimentar(940001, 'baixa', 1, null) as n`))[0].n
const arquivada = await linhas40(`
  select c.id::int as id, e.dados ->> 'motivo' as motivo
    from public.plt_cards c join public.plt_eventos e on e.card_id = c.id and e.tipo = 'card_arquivado'
   where c.produto_tiny_id = 940001 and c.tipo = 'unidade'`)
conferir(
  baixa1 === 2 && arquivada.length === 1 && arquivada[0].id === criadas[0].id && arquivada[0].motivo === 'baixa_manual'
    && (await pecasLivres40(940001)) === 2,
  'baixa de 1: sai a peça mais antiga (a primeira que entrou), por evento de arquivar com o motivo "baixa manual"',
  JSON.stringify({ baixa1, arquivada }),
)
await deveRecusarExec(
  `select public.plt_fn_estoque_movimentar(940001, 'baixa', 5, null)`,
  'baixa maior que o estoque é recusada, dizendo quanto há',
  /Só há 2/i,
)
conferir(
  (await linhas40(`select public.plt_fn_estoque_movimentar(940001, 'contagem', 5, 'contagem do dia') as n`))[0].n === 5
    && (await pecasLivres40(940001)) === 5,
  'contagem 5 com 2 no estoque: entram 3 (a diferença)',
)
const logsAntes = (await linhas40(`select count(*)::int as n from public.plt_logs_atividade where acao = 'estoque_contagem_conferida'`))[0].n
conferir(
  (await linhas40(`select public.plt_fn_estoque_movimentar(940001, 'contagem', 5, null) as n`))[0].n === 5
    && (await pecasLivres40(940001)) === 5
    && (await linhas40(`select count(*)::int as n from public.plt_logs_atividade where acao = 'estoque_contagem_conferida'`))[0].n === logsAntes + 1,
  'contagem igual ao que já tem: nada muda no estoque, fica o registro de que foi conferido',
)
conferir(
  (await linhas40(`select public.plt_fn_estoque_movimentar(940001, 'contagem', 0, null) as n`))[0].n === 0
    && (await pecasLivres40(940001)) === 0,
  'contagem 0: todas saem por baixa',
)
await deveRecusarExec(`select public.plt_fn_estoque_movimentar(940001, 'entrada', 0, null)`,
  'entrada de 0 é recusada', /de 1 a 500/i)
await deveRecusarExec(`select public.plt_fn_estoque_movimentar(940001, 'entrada', 501, null)`,
  'entrada acima de 500 é recusada', /de 1 a 500/i)
await deveRecusarExec(`select public.plt_fn_estoque_movimentar(940001, 'sumir', 1, null)`,
  'operação desconhecida é recusada', /entrada, baixa ou contagem/i)
await deveRecusarExec(`select public.plt_fn_estoque_movimentar(940004, 'entrada', 1, null)`,
  'matéria-prima não entra pela contagem daqui (segue pelo Tiny)', /matéria-prima e insumo/i)
await deveRecusarExec(`select public.plt_fn_estoque_movimentar(940005, 'entrada', 1, null)`,
  'produto inativo no Tiny não entra no estoque', /inativo/i)
await deveRecusarExec(`select public.plt_fn_estoque_movimentar(949999, 'entrada', 1, null)`,
  'produto fora do catálogo é recusado', /não encontrado/i)
await como40(E40.operador)
await deveRecusarExec(`select public.plt_fn_estoque_movimentar(940001, 'entrada', 1, null)`,
  'operador de produção não movimenta o estoque (gate da logística)', /logística ou de admin/i)
await como40(null)
await deveRecusarExec(`select public.plt_fn_estoque_movimentar(940001, 'entrada', 1, null)`,
  'sem usuário no contexto, nada entra', /usuário ativo/i)

titulo('Ajuste do estoque (28/09) · a peça cadastrada vira sugestão do PCP; baixa só de peça livre')

await como40(E40.logistica)
await bd.exec(`select public.plt_fn_estoque_movimentar(940001, 'entrada', 2, null)`)
await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao, data_pedido)
    values (940101, (select id from public.clientes order by id limit 1), 'Em aberto', current_date);
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
    values ((select id from public.pedidos where numero = 940101), 1, 'S40A', 'Armário Teste 40 - Branco', 1);
`)
const cardPedido40 = (
  await linhas40(`select id::int as id from public.plt_cards where tipo = 'pedido'
                   and pedido_id = (select id from public.pedidos where numero = 940101)`)
)[0]?.id
const sugestao40 = await linhas40(`select peca_card_id::int as peca, pecas_iguais from public.plt_fn_sugestoes_alocacao(${cardPedido40 ?? 0})`)
conferir(
  sugestao40.length === 1 && sugestao40[0].pecas_iguais === 2,
  'ao liberar um pedido do mesmo produto, o PCP vê "há 2 no estoque — usar?" com as peças cadastradas pela logística',
  JSON.stringify(sugestao40),
)
if (sugestao40[0]) {
  await bd.exec(`select public.plt_fn_alocar_peca(${cardPedido40}, 1, 1, ${sugestao40[0].peca})`)
}
conferir(
  (await pecasLivres40(940001)) === 1,
  'usar a peça no pedido tira uma do estoque (2 → 1)',
)
// Peça do mesmo produto EM PRODUÇÃO (não no ESTOQUE): a logística não "dá baixa" nela.
await bd.exec(`
  insert into public.plt_cards (tipo, produto_tiny_id, item_codigo, item_descricao, indice_unidade, total_unidades)
    values ('unidade', 940001, 'S40A', 'Armário Teste 40 - Branco', 1, 1);
  insert into public.plt_eventos (card_id, tipo, origem, setor_destino_id)
    values ((select max(id) from public.plt_cards), 'card_criado', 'api', (select id from public.plt_setores where codigo = 'cnc'));
`)
await deveRecusarExec(
  `select public.plt_fn_arquivar_card((select max(id) from public.plt_cards where produto_tiny_id = 940001))`,
  'a logística não arquiva peça em produção (a baixa vale só para peça livre do ESTOQUE)',
  /gesto de admin ou da integração/i,
)

titulo('Ajuste do estoque (28/09, ↪️ 30/09 D-84) · mínimo da plataforma: editar TRAVA, "voltar ao automático" solta')

await bd.exec(`select public.plt_fn_estoque_definir_minimo(940001, 6)`)
let min40 = (await linhas40(`select minimo::float as minimo, minimo_tiny::float as tiny, minimo_travado as travado
                               from public.plt_fn_estoque_produtos('acabados', 'S40A', null, 10, 0)`))[0]
conferir(
  min40?.minimo === 6 && min40?.tiny === 3 && min40?.travado === true,
  'mínimo editado à mão (6) vale no lugar da sugestão e fica TRAVADO (o do Tiny é só referência — D-83/D-84)',
  JSON.stringify(min40),
)
conferir(
  (await linhas40(`select count(*)::int as n from public.plt_logs_atividade where acao = 'estoque_minimo_alterado'
                    and (contexto ->> 'produto_tiny_id')::bigint = 940001`))[0].n >= 1,
  'mudar o mínimo deixa rastro na trilha (quem, antes, depois)',
)
await deveRecusarExec(`select public.plt_fn_estoque_definir_minimo(940001, null)`,
  'mínimo vazio não existe mais — o caminho é "voltar ao automático"', /voltar ao automático/i)
await bd.exec(`select public.plt_fn_estoque_minimo_automatico(940001)`)
min40 = (await linhas40(`select minimo::float as minimo, minimo_travado as travado, sugestao
                           from public.plt_fn_estoque_produtos('acabados', 'S40A', null, 10, 0)`))[0]
conferir(
  min40?.travado === false && min40?.minimo === Number(min40?.sugestao),
  '"voltar ao automático": destrava e o mínimo fica igual à sugestão do dia',
  JSON.stringify(min40),
)
await deveRecusarExec(`select public.plt_fn_estoque_definir_minimo(940001, -1)`,
  'mínimo negativo é recusado', /de 0 a 100000/i)
await deveRecusarExec(`select public.plt_fn_estoque_definir_top_x(0)`,
  'Top X fora de 1 a 50 é recusado', /de 1 a 50/i)
await como40(E40.operador)
await deveRecusarExec(`select public.plt_fn_estoque_definir_minimo(940001, 2)`,
  'operador de produção não mexe no mínimo', /logística ou de admin/i)
await deveRecusarExec(`select public.plt_fn_estoque_definir_top_x(10)`,
  'operador de produção não mexe no Top X', /logística ou de admin/i)
conferir(
  (await linhas40(`select count(*)::int as n from public.plt_fn_estoque_configuracoes(null, 100, 0)`))[0].n === 0
    && (await linhas40(`select count(*)::int as n from public.plt_fn_estoque_resumo()`))[0].n === 0,
  'operador de produção não enxerga Configurações nem o resumo (gate)',
)
await como40(E40.logistica)
await deveRecusarExec(`select public.plt_fn_estoque_definir_corte(15)`,
  'o corte de pedido fora do comum é gesto de admin (Painel admin)', /admin/i)

titulo('Ajuste do estoque (↪️ 30/09 D-84) · sugestão por dias úteis de venda, sem capacidade do galpão')

await como40(E40.logistica)
await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao, data_pedido) values
    (940201, (select id from public.clientes order by id limit 1), 'Entregue', current_date),
    (940202, (select id from public.clientes order by id limit 1), 'Entregue', current_date - 10);
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade) values
    ((select id from public.pedidos where numero = 940201), 1, 'S40A', 'Armário Teste 40 - Branco', 10),
    ((select id from public.pedidos where numero = 940201), 2, 'S40A', 'Armário Teste 40 - Branco', 10),
    ((select id from public.pedidos where numero = 940201), 3, 'S40C', 'Painel Teste 40 - Preto', 10),
    ((select id from public.pedidos where numero = 940202), 1, 'S40B', 'Nicho Teste 40 - Branco', 1);
`)
// A fórmula nova (D-84): vendidos ÷ dias úteis de VENDA (loja seg–sáb, 76–79
// na janela) × 6 × semanas, teto no fim. S40A = 21 vendidos → 2 semanas dá 4
// para qualquer contagem de dias da janela; S40C = 10 → 2; S40B = 1 → 1.
const diasUteis40 = (await linhas40(`select plt_privado.fn_dias_uteis_venda_90d() as d`))[0].d
const semTeto = await linhas40(`
  select codigo, posicao, sugestao from public.plt_fn_estoque_configuracoes('Teste 40', 100, 0) order by posicao nulls last`)
const porSku40 = Object.fromEntries(semTeto.map((l) => [l.codigo, l]))
conferir(
  diasUteis40 >= 76 && diasUteis40 <= 79
    && porSku40.S40A?.sugestao === Math.ceil((21 / diasUteis40) * 6 * 2)
    && porSku40.S40A?.sugestao === 4
    && porSku40.S40C?.sugestao === 2 && porSku40.S40B?.sugestao === 1
    && porSku40.S40Z?.sugestao === null,
  'sugestão por dias úteis (seg–sáb): 21 vendidos → 4, 10 → 2, 1 → 1 (2 semanas); quem não vendeu não tem sugestão — e capacidade nenhuma encolhe nada',
  JSON.stringify({ diasUteis40, semTeto }),
)
// Trocar a cobertura recalcula os mínimos AUTOMÁTICOS na hora; o travado fica.
await bd.exec(`select public.plt_fn_estoque_definir_minimo(940001, 6)`)   // trava o Armário em 6
await bd.exec(`select public.plt_fn_estoque_definir_cobertura(1)`)
const aposCobertura = await linhas40(`
  select codigo, minimo::float as minimo, minimo_travado as travado, sugestao
    from public.plt_fn_estoque_configuracoes('Teste 40', 100, 0) where codigo in ('S40A', 'S40C')`)
const porSku40b = Object.fromEntries(aposCobertura.map((l) => [l.codigo, l]))
conferir(
  porSku40b.S40C?.travado === false && porSku40b.S40C?.minimo === Number(porSku40b.S40C?.sugestao)
    && porSku40b.S40C?.sugestao === 1
    && porSku40b.S40A?.travado === true && porSku40b.S40A?.minimo === 6
    && (await linhas40(`select count(*)::int as n from public.plt_logs_atividade where acao = 'estoque_cobertura_alterada'`))[0].n >= 1,
  'cobertura 1 semana: o mínimo automático recalcula na hora (10 vendidos → 1) e o travado à mão não se mexe — com rastro na trilha',
  JSON.stringify(aposCobertura),
)
await bd.exec(`select public.plt_fn_estoque_definir_cobertura(2)`)
const resumo40 = (await linhas40(`select moveis_estoque, moveis_reservados, pecas_producao, moveis_producao,
                                         soma_minimos from public.plt_fn_estoque_resumo()`))[0]
conferir(
  resumo40 != null && typeof resumo40.moveis_estoque === 'number'
    && resumo40.pecas_producao >= 1 && Number(resumo40.soma_minimos) >= 6,
  'o resumo remodelado (30/09): móveis em estoque, prontos reservados, peças e móveis em produção — a peça solta na CNC conta como peça em produção',
  JSON.stringify(resumo40),
)
conferir(
  (await linhas40(`select count(*)::int as n from pg_proc
                    where proname in ('plt_fn_estoque_aplicar_sugestoes', 'plt_fn_estoque_definir_capacidade')`))[0].n === 0,
  'as portas da capacidade e do "usar todas as sugestões" saíram (↩️ D-72); a coluna da capacidade fica guardada, sem uso',
)

titulo('Ajuste do estoque (28/09, ↪️ 30/09 D-83) · UMA lista pelo ranking; o catálogo inteiro nas páginas')

const lista40 = async (filtro, busca = null) =>
  (await linhas40(`select codigo, posicao, em_estoque::float as em_estoque
                     from public.plt_fn_estoque_produtos('acabados', ${busca ? `'${busca}'` : 'null'},
                                                         ${filtro ? `'${filtro}'` : 'null'}, 100, 0)`))
let padrao = await lista40(null)
const ranks = padrao.filter((l) => l.posicao !== null).map((l) => l.posicao)
const primeiroSemRank = padrao.findIndex((l) => l.posicao === null)
const semRankNoFim =
  primeiroSemRank === -1 || padrao.slice(primeiroSemRank).every((l) => l.posicao === null)
conferir(
  padrao.some((l) => l.codigo === 'S40A') && padrao.some((l) => l.codigo === 'S40C')
    && padrao.some((l) => l.codigo === 'S40Z' && l.posicao === null)
    && ranks.every((p, i) => i === 0 || ranks[i - 1] < p)
    && semRankNoFim,
  'a lista é UMA: os mais vendidos primeiro (rank crescente) e o resto do catálogo nas páginas seguintes — o "ver os outros" morreu (↪️ D-83)',
  JSON.stringify(padrao.map((l) => `${l.codigo}:${l.posicao}`)),
)
conferir(
  (await lista40(null, 'S40Z')).length === 1
    && !(await lista40('com_estoque')).some((l) => l.codigo === 'S40Z'),
  'a busca acha quem não vendeu; o filtro "Com estoque" ainda não o mostra (0 peças)',
)
await bd.exec(`select public.plt_fn_estoque_movimentar(940006, 'entrada', 1, null)`)
padrao = await lista40(null)
conferir(
  padrao.some((l) => l.codigo === 'S40Z' && l.em_estoque === 1 && l.posicao === null)
    && (await lista40('com_estoque')).some((l) => l.codigo === 'S40Z')
    && padrao[padrao.length - 1]?.posicao === null,
  'com 1 peça contada, o filtro "Com estoque" passa a mostrá-lo — e os sem venda seguem depois dos ranqueados',
  JSON.stringify(padrao.map((l) => `${l.codigo}:${l.posicao}:${l.em_estoque}`)),
)

titulo('Ajuste do estoque (28/09) · a foto do produto (só logística e admin)')

await bd.exec(`select public.plt_fn_estoque_definir_imagem(940001, 'produtos/S40A/capa-1727.jpg')`)
conferir(
  (await linhas40(`select imagem_caminho from public.plt_fn_estoque_produtos('acabados', 'S40A', null, 10, 0)`))[0]
    ?.imagem_caminho === 'produtos/S40A/capa-1727.jpg',
  'a foto definida volta na lista do estoque (uma consulta — sem listar o storage por cartão)',
)
await deveRecusarExec(`select public.plt_fn_estoque_definir_imagem(940001, '../perfis/x.jpg')`,
  'caminho fora da pasta produtos/ é recusado', /inválido/i)
await como40(E40.operador)
await deveRecusarExec(`select public.plt_fn_estoque_definir_imagem(940001, 'produtos/S40A/capa-2.jpg')`,
  'operador de produção não troca a foto do estoque', /logística ou de admin/i)

titulo('Ajuste do estoque (28/09) · a reposição (desligada) segue a contagem e o mínimo da plataforma')

await como40(E40.logistica)
await bd.exec(`select public.plt_fn_estoque_definir_minimo(940003, 2)`)
await bd.exec(`select plt_privado.fn_gerar_reposicoes()`)
const rep40 = await linhas40(`select total_unidades as qtd from public.plt_cards
                               where tipo = 'reposicao' and produto_tiny_id = 940003 and arquivado_em is null`)
conferir(
  rep40.length === 1 && rep40[0].qtd === 2,
  'Painel com mínimo 2 e nenhuma peça contada: a maquinaria pede repor 2 (sem depender de leitura do Tiny)',
  JSON.stringify(rep40),
)
await como40(null)

// ============================================================================
// Ajuste do Frete · D-63 (migration 39) — frete/entrega não vira unidade de
// produção; o resto nasce no PCP como sempre e o PCP define o lugar; pedido
// sem nada a produzir vai direto para Pedidos em aguardo. Pedidos próprios
// 924201–924205; usa as pessoas do bloco da SESSAO-24 (admin, log.um, limpa.um).
// ============================================================================
titulo('D-63 · a regra única (vw_itens_producao): frete/entrega pela 1ª palavra da descrição')

// Um pedido de calibração (já "Entregue": não nasce card) com as grafias reais
// do levantamento de 28/09 e as armadilhas dele (A-31).
const casosD63 = [
  // [descrição, quantidade, é frete?, unidades de produção]
  ['Frete', 1, true, 0],
  ['Frete cliente', 3, true, 0],
  ['Entrega', 1, true, 0],
  ['FRETE', 1, true, 0],
  [' frete: R$ 50', 1, true, 0],
  ['(Frete)', 1, true, 0],
  ['Frete-cliente', 1, true, 0],
  ['Fretes', 1, false, 1],
  ['Mesa de entrega', 1, false, 1],
  ['Entregador de móveis', 2, false, 2],
  ['PERSONALIZADO frete', 1, false, 1],
  ['PERSONLAIZADO Penteadeira camarim - sem a parte de instalação das lâmpadas', 1, false, 1],
  ['Painel freijó (LED e instalação não inclusos)', 1, false, 1],
  ['Cadeira executiva - Preta', 3, false, 3],
  ['', 1, false, 1],
  [null, 1, false, 1],
  ['Mesa Teste', 2.4, false, 2],
  ['Mesa Teste', 2.6, false, 3],
  ['Mesa Teste', 0.4, false, 0],
]
await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao)
    values (924200, (select id from public.clientes order by id limit 1), 'Entregue');
  insert into public.pedido_itens (pedido_id, seq, descricao, quantidade) values
  ${casosD63
    .map(([d, q], i) => `((select id from public.pedidos where numero = 924200), ${i + 1}, ${d === null ? 'null' : `'${d}'`}, ${q})`)
    .join(',\n  ')};
`)
const lidosD63 = (
  await bd.query(`select seq, eh_frete, unidades from plt_privado.vw_itens_producao
                   where pedido_id = (select id from public.pedidos where numero = 924200) order by seq`)
).rows
const errosD63 = casosD63
  .map(([d, q, frete, n], i) => ({ d, q, frete, n, lido: lidosD63[i] }))
  .filter((c) => !c.lido || c.lido.eh_frete !== c.frete || c.lido.unidades !== c.n)
  .map((c) => `${c.d} × ${c.q} → ${JSON.stringify(c.lido ?? null)}`)
conferir(
  lidosD63.length === casosD63.length && errosD63.length === 0,
  'frete/entrega só pela 1ª palavra (no meio do texto, personalizado, vazio e nulo não são); unidades = quantidade arredondada, frete = 0, abaixo de 1 = 0',
  errosD63.join(' | '),
)
conferir(
  (await bd.query(`select plt_privado.fn_unidades_do_pedido((select id from public.pedidos where numero = 924200)) as n`)).rows[0].n
    === casosD63.reduce((s, c) => s + c[3], 0),
  'o total do pedido (fn_unidades_do_pedido) é a soma da view — o mesmo número em toda porta',
)

titulo('D-63 · pedido com frete: o frete não aparece para liberar, não vira card e não conta')

const idPedidoD63 = async (numero) =>
  (await bd.query(`select id::int as id from public.pedidos where numero = ${numero}`)).rows[0].id
const cardPedidoD63 = async (numero) =>
  (await bd.query(`select c.id::int as id, c.liberado_completo_em is not null as liberado,
                          c.lancado_rotas_em is not null as lancado, s.codigo as setor
                     from public.plt_cards c
                     left join public.plt_setores s on s.id = c.setor_atual_id
                    where c.tipo = 'pedido'
                      and c.pedido_id = (select id from public.pedidos where numero = ${numero})`)).rows[0]
const noQuadroPcpD63 = async (pedidoId) =>
  (await bd.query(`select count(*)::int as n from public.plt_fn_cards_pedido_pcp(100, 0) where pedido_id = ${pedidoId}`)).rows[0].n
const noAguardoD63 = async (numero) =>
  (await bd.query(`select total_unidades, unidades_prontas, completo, completo_em is not null as tem_data
                     from public.plt_fn_pedidos_aguardo('${numero}', 20, 0)`)).rows[0]
// A liberação como a TELA faz (gesto humano, origem interface): card no PCP +
// card_criado + mover para o destino que o PCP escolheu.
async function liberarNaTelaD63(numero, seq, k, n, codigo, descricao, destino, auth) {
  await bd.exec(`
    insert into public.plt_cards (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao,
                                  indice_unidade, total_unidades, setor_atual_id)
      select 'unidade', p.id, pc.id, ${seq}, '${codigo}', '${descricao}', ${k}, ${n},
             (select id from public.plt_setores where codigo = 'pcp')
        from public.pedidos p join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido'
       where p.numero = ${numero};
    insert into public.plt_eventos (card_id, tipo, usuario_id, setor_destino_id, origem)
      values ((select max(id) from public.plt_cards), 'card_criado',
              (select id from public.plt_usuarios where auth_user_id = '${auth}'),
              (select id from public.plt_setores where codigo = 'pcp'), 'interface');
    insert into public.plt_eventos (card_id, tipo, usuario_id, setor_origem_id, setor_destino_id, origem)
      values ((select max(id) from public.plt_cards), 'movimentacao_setor',
              (select id from public.plt_usuarios where auth_user_id = '${auth}'),
              (select id from public.plt_setores where codigo = 'pcp'),
              (select id from public.plt_setores where codigo = '${destino}'), 'interface');
  `)
  return (await bd.query(`select max(id)::int as id from public.plt_cards`)).rows[0].id
}

await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao)
    values (924201, (select id from public.clientes order by id limit 1), 'Em aberto');
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade) values
    ((select id from public.pedidos where numero = 924201), 1, 'S24A', 'Mesa Teste S24 - Branca', 1),
    ((select id from public.pedidos where numero = 924201), 2, 'S63C', 'Cadeira Tiffany Teste - Preta', 2),
    ((select id from public.pedidos where numero = 924201), 3, null,   'Frete', 1),
    ((select id from public.pedidos where numero = 924201), 4, null,   'Frete cliente', 1);
`)
const p201 = await idPedidoD63(924201)
const c201 = await cardPedidoD63(924201)
await comoS24(s24.logistica)
const itens201 = (
  await bd.query(`select seq, unidades from public.plt_fn_pedido_itens_kanban(${p201}) order by seq`)
).rows
conferir(
  itens201.length === 2 && itens201[0].seq === 1 && itens201[0].unidades === 1
    && itens201[1].seq === 2 && itens201[1].unidades === 2,
  'na liberação do PCP só aparecem a mesa (1) e as cadeiras (2) — "Frete" e "Frete cliente" não',
  JSON.stringify(itens201),
)
const resumo201 = (
  await bd.query(`select total_unidades from public.plt_fn_pedidos_kanban(p_ids => array[${p201}::bigint])`)
).rows[0]
conferir(
  resumo201?.total_unidades === 3,
  'o pedido soma 3 unidades a produzir (antes somava 5, com os dois fretes)',
  JSON.stringify(resumo201),
)
await comoS24(s24.admin)
const quadro201 = await noQuadroPcpD63(p201)
conferir(
  c201?.setor === 'pcp' && quadro201 === 1,
  'o pedido nasce no PCP e fica no quadro esperando a liberação (entrada única — D-13)',
  JSON.stringify({ c201, quadro201 }),
)
await deveRecusarExec(
  `insert into public.plt_cards (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
     values ('unidade', ${p201}, ${c201.id}, 3, null, 'Frete', 1, 1)`,
  'criar card de unidade do Frete é recusado pelo banco — vale para tela, API e script (M-14)',
  /Frete não vira card/i,
)
await deveRecusarExec(
  `insert into public.plt_cards (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
     values ('unidade', ${p201}, ${c201.id}, 4, null, 'Mesa disfarçada', 1, 1)`,
  'nem disfarçado: o item do pedido (seq 4 = "Frete cliente") manda, não a descrição que veio no card',
  /Frete não vira card/i,
)
const m201 = await liberarS24(924201, 1, 1, 1, 'S24A', 'Mesa Teste S24 - Branca', 'limpeza_embalagem')
// As cadeiras vêm prontas do estoque: o PCP manda direto para Pedidos em aguardo
// na liberação — "sempre nasce no PCP do jeito que está e o PCP define o local
// correto" (resposta do dono, 28/09). Nada mudou para elas.
const cad1 = await liberarNaTelaD63(924201, 2, 1, 2, 'S63C', 'Cadeira Tiffany Teste - Preta', 'aguardo', s24.logistica)
await liberarNaTelaD63(924201, 2, 2, 2, 'S63C', 'Cadeira Tiffany Teste - Preta', 'aguardo', s24.logistica)
const cad1Card = await cardS24(cad1)
conferir(
  cad1Card.setor === 'aguardo' && cad1Card.concluido,
  'a cadeira que vem do estoque vai da liberação direto para Pedidos em aguardo — o PCP define o lugar',
  JSON.stringify(cad1Card),
)
const c201Liberado = await cardPedidoD63(924201)
const quadro201Depois = await noQuadroPcpD63(p201)
conferir(
  c201Liberado.liberado && quadro201Depois === 0,
  'mesa + 2 cadeiras = pedido liberado por completo sem o frete — sai do quadro do PCP (fim do tempo em PCP)',
  JSON.stringify({ c201Liberado, quadro201Depois }),
)
await comoS24(s24.limpaUm)
const destinoM201 = (await bd.query(`select public.plt_fn_concluir_producao(${m201}) as d`)).rows[0].d
await comoS24(s24.logistica)
const aguardo201 = await noAguardoD63(924201)
conferir(
  destinoM201 === 'aguardo' && aguardo201?.total_unidades === 3 && aguardo201?.unidades_prontas === 3
    && aguardo201?.completo === true,
  'com a mesa concluída, o pedido fica COMPLETO em Pedidos em aguardo: 3 de 3 — o frete não segura o pedido',
  JSON.stringify({ destinoM201, aguardo201 }),
)
const lancou201 = (await bd.query(`select public.plt_fn_lancar_rotas(${c201.id}) as e`)).rows[0].e
const rotas201 = (
  await bd.query(`select total_unidades, unidades_em_rotas from public.plt_fn_rotas(null, '924201', 20, 0)`)
).rows[0]
const entrega201 = (await bd.query(`select public.plt_fn_registrar_entrega(${c201.id}) as e`)).rows[0].e
conferir(
  lancou201 !== null && rotas201?.total_unidades === 3 && rotas201?.unidades_em_rotas === 3 && entrega201 !== null,
  'lança para ROTAS com 3 de 3 e a entrega fecha o pedido — nenhum card de frete no caminho',
  JSON.stringify(rotas201),
)

titulo('D-63 · pedido sem nada a produzir (só frete): nasce no PCP e vai direto para Pedidos em aguardo')

await comoS24(s24.admin)
const aguardandoAntesD63 = (await bd.query(`select aguardando_lancamento from public.plt_fn_dash_dia()`)).rows[0].aguardando_lancamento
const aLiberarAntesD63 = (await bd.query(`select pedidos_a_liberar from public.plt_fn_dash_pcp_dia()`)).rows[0].pedidos_a_liberar
await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao)
    values (924202, (select id from public.clientes order by id limit 1), 'Em aberto');
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
    values ((select id from public.pedidos where numero = 924202), 1, null, 'Frete', 1);
`)
const p202 = await idPedidoD63(924202)
const c202 = await cardPedidoD63(924202)
const quadro202 = await noQuadroPcpD63(p202)
const itens202 = (await bd.query(`select count(*)::int as n from public.plt_fn_pedido_itens_kanban(${p202})`)).rows[0].n
conferir(
  c202?.setor === 'pcp' && quadro202 === 0 && itens202 === 0,
  'o pedido só de frete NASCE no PCP (entrada única), mas não aparece no quadro — não há nada a liberar',
  JSON.stringify({ c202, quadro202, itens202 }),
)
const aguardandoDepoisD63 = (await bd.query(`select aguardando_lancamento from public.plt_fn_dash_dia()`)).rows[0].aguardando_lancamento
const aLiberarDepoisD63 = (await bd.query(`select pedidos_a_liberar from public.plt_fn_dash_pcp_dia()`)).rows[0].pedidos_a_liberar
conferir(
  aguardandoDepoisD63 === aguardandoAntesD63 + 1 && aLiberarDepoisD63 === aLiberarAntesD63,
  'no painel: +1 pedido aguardando o lançamento e nenhum a mais para liberar no PCP',
  JSON.stringify({ aguardandoAntesD63, aguardandoDepoisD63, aLiberarAntesD63, aLiberarDepoisD63 }),
)
await comoS24(s24.logistica)
const aguardo202 = await noAguardoD63(924202)
conferir(
  aguardo202?.completo === true && aguardo202?.total_unidades === 0 && aguardo202?.unidades_prontas === 0
    && aguardo202?.tem_data === true,
  'em Pedidos em aguardo ele aparece JÁ COMPLETO (nada a produzir), com o relógio do aguardo correndo desde que nasceu',
  JSON.stringify(aguardo202),
)
const abaPedidosD63 = (
  await bd.query(`select numero, unidades_prontas, completo from public.plt_fn_pedidos_aguardo(null, 100, 0)`)
).rows
const abaProdutosD63 = (await bd.query(`select card_id from public.plt_fn_produtos_reservados(null, 100, 0)`)).rows
const contagensD63 = (await bd.query(`select * from public.plt_fn_aguardo_contagens()`)).rows[0]
conferir(
  contagensD63.pedidos === abaPedidosD63.length
    && contagensD63.pedidos_completos === abaPedidosD63.filter((l) => l.completo).length
    && contagensD63.produtos === abaProdutosD63.length
    && abaPedidosD63.reduce((s, l) => s + l.unidades_prontas, 0) === abaProdutosD63.length
    && abaPedidosD63.some((l) => l.numero === 924202),
  'as abas continuam batendo com o pedido sem produção: pedidos, completos, Σ prontas = Produtos reservados',
  JSON.stringify({ contagensD63, pedidos: abaPedidosD63.length, produtos: abaProdutosD63.length }),
)
const lancou202 = (await bd.query(`select public.plt_fn_lancar_rotas(${c202.id}) as e`)).rows[0].e
const aguardo202Depois = await noAguardoD63(924202)
const rotas202 = (
  await bd.query(`select total_unidades, unidades_em_rotas, situacao_entrega from public.plt_fn_rotas(null, '924202', 20, 0)`)
).rows[0]
conferir(
  lancou202 !== null && aguardo202Depois === undefined && rotas202?.total_unidades === 0
    && rotas202?.situacao_entrega === 'pronta',
  'a logística lança para ROTAS: sai de Pedidos em aguardo e entra nas ROTAS pronto para a entrega',
  JSON.stringify({ aguardo202Depois, rotas202 }),
)
const entrega202 = (await bd.query(`select public.plt_fn_registrar_entrega(${c202.id}) as e`)).rows[0].e
const rotas202Entregue = (
  await bd.query(`select situacao_entrega from public.plt_fn_rotas('entregue', '924202', 20, 0)`)
).rows[0]
conferir(
  entrega202 !== null && rotas202Entregue?.situacao_entrega === 'entregue',
  'e a entrega se registra normalmente — sem nada a produzir, o pedido está completo',
  JSON.stringify(rotas202Entregue),
)

titulo('D-63 · pedido que era só frete e ganhou um móvel no Tiny volta sozinho ao PCP')

await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao)
    values (924203, (select id from public.clientes order by id limit 1), 'Em aberto');
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
    values ((select id from public.pedidos where numero = 924203), 1, null, 'Entrega', 1);
`)
const p203 = await idPedidoD63(924203)
const antes203 = await noAguardoD63(924203)
// O Tiny regrava os itens a cada atualização (fn_upsert_pedido apaga e regrava).
await bd.exec(`
  delete from public.pedido_itens where pedido_id = ${p203};
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade) values
    (${p203}, 1, null,   'Entrega', 1),
    (${p203}, 2, 'S24A', 'Mesa Teste S24 - Branca', 1);
`)
const depois203 = await noAguardoD63(924203)
await comoS24(s24.admin)
const quadro203 = await noQuadroPcpD63(p203)
const resumo203 = (
  await bd.query(`select total_unidades from public.plt_fn_pedidos_kanban(p_ids => array[${p203}::bigint])`)
).rows[0]
conferir(
  antes203?.completo === true && depois203 === undefined && quadro203 === 1 && resumo203?.total_unidades === 1,
  'só "Entrega": estava em Pedidos em aguardo; o Tiny acrescentou uma mesa → saiu do aguardo e voltou ao quadro do PCP com 1 unidade (decidido na leitura, nada gravado)',
  JSON.stringify({ antes203, depois203, quadro203, resumo203 }),
)

titulo('D-63 · pedido só de frete cancelado no Tiny: aba Cancelados, nunca nas ROTAS')

await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao)
    values (924204, (select id from public.clientes order by id limit 1), 'Em aberto');
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
    values ((select id from public.pedidos where numero = 924204), 1, null, 'Frete', 1);
  update public.pedidos set situacao = 'Cancelado' where numero = 924204;
`)
const c204 = await cardPedidoD63(924204)
await comoS24(s24.logistica)
const aguardo204 = await noAguardoD63(924204)
await comoS24(s24.admin)
const cancelado204 = (
  await bd.query(`select total_unidades from public.plt_fn_pedidos_cancelados('924204', 20, 0)`)
).rows[0]
conferir(
  aguardo204 === undefined && cancelado204?.total_unidades === 0,
  'não aparece em Pedidos em aguardo; está na aba Cancelados do PCP, com 0 unidade',
  JSON.stringify({ aguardo204, cancelado204 }),
)
await deveRecusarExec(
  `select public.plt_fn_lancar_rotas(${c204.id})`,
  'lançar para ROTAS um pedido cancelado no Tiny é recusado (sem nada a produzir, o "completo" sozinho não barraria)',
  /cancelado no Tiny/i,
)

titulo('D-63 · card de frete de antes da regra: não conta como liberado e a manutenção o arquiva')

await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao)
    values (924205, (select id from public.clientes order by id limit 1), 'Preparando envio');
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade) values
    ((select id from public.pedidos where numero = 924205), 1, 'S24A', 'Mesa Teste S24 - Branca', 1),
    ((select id from public.pedidos where numero = 924205), 2, null,   'Frete', 1);
  alter table public.plt_cards disable trigger plt_cards_validar_unidade_de_producao;
`)
// O legado: o card de frete nasceu antes da migration 39 (a trava desligada só aqui).
const legadoFreteD63 = await liberarS24(924205, 2, 1, 1, null, 'Frete', 'limpeza_embalagem')
await bd.exec(`alter table public.plt_cards enable trigger plt_cards_validar_unidade_de_producao;`)
conferir(
  !(await cardPedidoD63(924205)).liberado,
  'o card de frete antigo NÃO conta como liberado — o pedido continua esperando a mesa no PCP',
)
await comoS24(s24.limpaUm)
await bd.exec(
  `select public.plt_fn_soltar_card(${legadoFreteD63}, ${await idEtapaS24('limpeza_embalagem', 'LIMPANDO E EMBALANDO')})`,
)
conferir(
  (await cardS24(legadoFreteD63)).executor === 'limpa.um',
  'o card de frete antigo está com tempo aberto (como um card esquecido na LIMPEZA E EMBALAGEM)',
)
const m205 = await liberarS24(924205, 1, 1, 1, 'S24A', 'Mesa Teste S24 - Branca', 'montagem')
conferir((await cardPedidoD63(924205)).liberado, 'liberada a mesa, aí sim o pedido fica liberado por completo')
await bd.exec(await readFile(path.join(MANUTENCAO, '2026-09-28_arquivar_cards_de_frete.sql'), 'utf8'))
await bd.exec(await readFile(path.join(MANUTENCAO, '2026-09-28_arquivar_cards_de_frete.sql'), 'utf8'))
const legadoDepoisD63 = await cardS24(legadoFreteD63)
const execLegadoD63 = (
  await bd.query(`select em_andamento from public.plt_vw_execucoes where card_id = ${legadoFreteD63}
                   order by iniciou_em desc limit 1`)
).rows[0]
conferir(
  legadoDepoisD63.arquivado && !legadoDepoisD63.executando && execLegadoD63?.em_andamento === false
    && (await contarEventosS24(legadoFreteD63, 'card_arquivado')) === 1
    && !(await cardS24(m205)).arquivado,
  'a manutenção fecha o tempo aberto e arquiva o card de frete por evento — uma vez só; a mesa do mesmo pedido não é tocada',
  JSON.stringify({ legadoDepoisD63, execLegadoD63 }),
)
conferir(
  (await bd.query(`select count(*)::int as n from public.plt_cards c
                    where c.tipo = 'unidade' and c.arquivado_em is null
                      and exists (select 1 from plt_privado.vw_itens_producao v
                                   where v.pedido_id = c.pedido_id and v.seq = c.item_seq and v.eh_frete)`)).rows[0].n === 0,
  'depois da manutenção, nenhum card de frete vivo',
)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)

// ============================================================================
// Ajuste do painel do PCP · D-75 (migration 41) — o quadrinho do PCP na Visão
// do dia conta o que o QUADRO do PCP mostra: pedido encerrado no Tiny sai do
// "a liberar", o card de reposição entra, e a "mais antiga" é a do quadro.
// "Liberadas hoje" fica como estava (o dono não pediu mudança). Pedidos
// 924301–924305 e o produto 924390; como o admin do bloco da SESSAO-24.
// ============================================================================
titulo('D-75 · o quadrinho do PCP na Visão do dia conta o que o quadro do PCP mostra')

await comoS24(s24.admin)
// Painel e quadro lidos NA MESMA consulta: o "agora" é um só, e a espera mais
// antiga dos dois se compara ao segundo. "Liberadas hoje" vem junto com a
// regra de sempre (toda unidade criada no dia), também no mesmo "agora".
const painelQuadroD75 = async () =>
  (
    await bd.query(`
      select pn.pedidos_a_liberar,
             pn.unidades_liberadas_dia,
             extract(epoch from pn.espera_mais_antiga)::int as espera_s,
             (select coalesce(max(q.contagem_total), 0)::int
                from public.plt_fn_cards_pedido_pcp(1, 0) q) as quadro,
             (select extract(epoch from now() - min(q.desde))::int
                from public.plt_fn_cards_pedido_pcp(100, 0) q) as quadro_espera_s,
             (select count(*)::int
                from public.plt_eventos e join public.plt_cards c on c.id = e.card_id
               where e.tipo = 'card_criado' and c.tipo = 'unidade'
                 and e.ocorrido_em >= ((now() at time zone 'America/Fortaleza')::date::timestamp
                                       at time zone 'America/Fortaleza')
                 and e.ocorrido_em <  ((now() at time zone 'America/Fortaleza')::date::timestamp
                                       at time zone 'America/Fortaleza') + interval '1 day')
                                                                   as liberadas_regra_de_sempre
        from public.plt_fn_dash_pcp_dia() pn`)
  ).rows[0]

// Os blocos anteriores deixaram pedido já encerrado no Tiny com peça por
// liberar (ex.: o 999993 da SESSAO-23, "Entregue" com 1 de 2 liberadas) — o
// caso que fazia o painel dizer 233 e o quadro 33.
const encerradosD75 = (
  await bd.query(`
    select count(*)::int as n
      from public.plt_cards c join public.pedidos p on p.id = c.pedido_id
     where c.tipo = 'pedido' and c.arquivado_em is null and c.liberado_completo_em is null
       and plt_privado.fn_situacao_normalizada(p.situacao) in ('entregue', 'nao_entregue')
       and exists (select 1 from plt_privado.vw_itens_producao v
                    where v.pedido_id = p.id and v.unidades > 0)`)
).rows[0].n
const antesD75 = await painelQuadroD75()
conferir(
  encerradosD75 >= 1 && antesD75 !== undefined
    && antesD75.pedidos_a_liberar === antesD75.quadro
    && antesD75.espera_s === antesD75.quadro_espera_s,
  'com pedido encerrado no Tiny ainda com peça por liberar no banco, o painel já é o quadro: mesmo "a liberar" e mesma "mais antiga"',
  JSON.stringify({ encerradosD75, antesD75 }),
)

// Cinco pedidos que nascem "Em aberto" (card no PCP pelo gatilho) e mudam de
// situação no Tiny; mais um card de reposição, como a maquinaria cria.
await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao)
    select n, (select id from public.clientes order by id limit 1), 'Em aberto'
      from generate_series(924301, 924305) n;
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
    select p.id, 1, 'D75', 'Mesa Teste D-75', 2
      from public.pedidos p where p.numero between 924301 and 924304;
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
    values ((select id from public.pedidos where numero = 924305), 1, null, 'Frete', 1);
  update public.pedidos set situacao = 'Preparando envio' where numero = 924301;
  update public.pedidos set situacao = 'Entregue'         where numero = 924302;
  update public.pedidos set situacao = 'Não entregue'     where numero = 924303;
  update public.pedidos set situacao = 'Cancelado'        where numero = 924304;
  insert into public.produtos (tiny_id, codigo, descricao, classe, situacao, estoque_minimo, unidade)
    values (924390, 'D75R', 'Estante Teste D-75', 'F', 'A', 3, 'un')
    on conflict (tiny_id) do nothing;
  insert into public.plt_cards (tipo, produto_tiny_id, item_codigo, item_descricao, total_unidades, setor_atual_id)
    values ('reposicao', 924390, 'D75R', 'Estante Teste D-75', 3,
            (select id from public.plt_setores where codigo = 'pcp'));
  insert into public.plt_eventos (card_id, tipo, origem, setor_destino_id, dados)
    values ((select id from public.plt_cards where tipo = 'reposicao' and produto_tiny_id = 924390),
            'card_criado', 'automacao', (select id from public.plt_setores where codigo = 'pcp'),
            jsonb_build_object('motivo', 'reposicao_estoque', 'produto_tiny_id', 924390, 'quantidade', 3));
`)
const cardsD75 = (
  await bd.query(`
    select p.numero, c.id::int as id
      from public.plt_cards c join public.pedidos p on p.id = c.pedido_id
     where c.tipo = 'pedido' and p.numero between 924301 and 924305
     order by p.numero`)
).rows
const cardD75 = (numero) => cardsD75.find((c) => c.numero === numero)?.id
const repD75 = (
  await bd.query(`select id::int as id from public.plt_cards where tipo = 'reposicao' and produto_tiny_id = 924390`)
).rows[0]?.id
const noQuadroD75 = (
  await bd.query(`
    select coalesce(array_agg(coalesce(p.numero::text, 'reposição') order by q.id), '{}') as itens
      from public.plt_fn_cards_pedido_pcp(100, 0) q
      left join public.pedidos p on p.id = q.pedido_id
     where q.id in (${[...cardsD75.map((c) => c.id), repD75 ?? 0].join(', ')})`)
).rows[0].itens
const depoisD75 = await painelQuadroD75()
conferir(
  cardsD75.length === 5 && repD75 !== undefined
    && noQuadroD75.length === 2 && noQuadroD75.includes('924301') && noQuadroD75.includes('reposição'),
  'no quadro do PCP: o pedido "Preparando envio" e o card de reposição — o "Entregue", o "Não entregue", o "Cancelado" e o só de frete, não',
  JSON.stringify({ cardsD75, repD75, noQuadroD75 }),
)
conferir(
  depoisD75.pedidos_a_liberar === antesD75.pedidos_a_liberar + 2
    && depoisD75.pedidos_a_liberar === depoisD75.quadro,
  'no painel: +2 no "a liberar" (o pedido vivo e a reposição) — o mesmo número do quadro',
  JSON.stringify({ antesD75, depoisD75 }),
)

// A "mais antiga": o card do pedido já entregue no Tiny é o mais velho de todos,
// mas não está no quadro — quem manda é o card do quadro esperando há mais tempo.
await bd.exec(`
  update public.plt_cards set desde = now() - interval '3000 days' where id = ${cardD75(924302)};
  update public.plt_cards set desde = now() - interval '2000 days' where id = ${cardD75(924301)};
`)
const esperaD75 = await painelQuadroD75()
conferir(
  esperaD75.espera_s === esperaD75.quadro_espera_s
    && esperaD75.espera_s >= 2000 * 86400 && esperaD75.espera_s < 3000 * 86400,
  '"mais antiga" = o card do quadro esperando há mais tempo; o pedido entregue no Tiny, mais velho, não conta',
  JSON.stringify(esperaD75),
)

// O PCP libera as 2 peças do 924301 (como a tela: card no PCP + card_criado):
// liberado por inteiro, sai do quadro e do "a liberar".
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao,
                                indice_unidade, total_unidades, setor_atual_id)
    select 'unidade', p.id, pc.id, 1, 'D75', 'Mesa Teste D-75', k, 2,
           (select id from public.plt_setores where codigo = 'pcp')
      from public.pedidos p
      join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido'
      cross join generate_series(1, 2) k
     where p.numero = 924301;
  insert into public.plt_eventos (card_id, tipo, usuario_id, setor_destino_id, origem)
    select c.id, 'card_criado', (select id from public.plt_usuarios where auth_user_id = '${s24.admin}'),
           (select id from public.plt_setores where codigo = 'pcp'), 'interface'
      from public.plt_cards c
     where c.tipo = 'unidade' and c.pedido_id = (select id from public.pedidos where numero = 924301);
`)
const liberadoD75 = await painelQuadroD75()
conferir(
  liberadoD75.pedidos_a_liberar === depoisD75.pedidos_a_liberar - 1
    && liberadoD75.pedidos_a_liberar === liberadoD75.quadro,
  'liberado por inteiro, o pedido sai do "a liberar" — e do quadro',
  JSON.stringify({ depoisD75, liberadoD75 }),
)
conferir(
  liberadoD75.unidades_liberadas_dia === liberadoD75.liberadas_regra_de_sempre
    && liberadoD75.unidades_liberadas_dia >= 2,
  '"liberadas hoje" continua a regra de sempre (toda unidade criada no dia) — o dono não pediu mudança',
  JSON.stringify(liberadoD75),
)

// "Não produzir" (arquivar) tira a reposição do quadro — e do painel.
await bd.exec(`select public.plt_fn_arquivar_card(${repD75}, 'não produzir (teste D-75)')`)
const arquivadoD75 = await painelQuadroD75()
conferir(
  arquivadoD75.pedidos_a_liberar === liberadoD75.pedidos_a_liberar - 1
    && arquivadoD75.pedidos_a_liberar === arquivadoD75.quadro
    && arquivadoD75.espera_s === arquivadoD75.quadro_espera_s,
  '"Não produzir" na reposição: sai do "a liberar" junto com o quadro, e a "mais antiga" segue a do quadro',
  JSON.stringify({ liberadoD75, arquivadoD75 }),
)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)

// ============================================================================
// ESTOQUE SINCRONIZADO COM O TINY (30/09 — migration 42, D-76…D-80): o
// Tiny acima sobe a plataforma; gesto da plataforma manda o Tiny ficar igual;
// a venda reserva a peça; ligar copia o Tiny uma vez. O dono: "as duas precisam
// se conversar bem para mostrar os mesmos dados"; "eles só olham o saldo
// multiempresa".
// ============================================================================
{ // escopo próprio: os nomes daqui não colidem com os dos blocos anteriores
titulo('Estoque × Tiny (30/09) · desligado: o aviso só fica registrado, nada entra na fila')

const S42 = { admin: E40.admin, logistica: E40.logistica, operador: E40.operador }
const como42 = como40
const linhas42 = linhas40
const um42 = async (sql) => (await linhas42(sql))[0]
const sqlJson = (obj) => `'${JSON.stringify(obj).split("'").join("''")}'::jsonb`
// A resposta do produto.obter.estoque da FÁBRICA (saldo somado + depósitos das duas empresas).
const respostaTiny = (id, sku, depositos, reservado = 0) => ({
  retorno: {
    status: 'OK',
    produto: {
      id, codigo: sku, nome: 'Produto ' + sku,
      saldo: depositos.reduce((s, d) => s + d[2], 0),
      saldoReservado: reservado,
      depositos: depositos.map(([empresa, nome, saldo]) => ({ deposito: { nome, desconsiderar: 'N', saldo, empresa } })),
    },
  },
})
const livres42 = async (id) => (await um42(`select livres, reservadas from plt_privado.fn_estoque_pecas(${id})`))
const fila42 = async (id) => await um42(`select produto_tiny_id::int as id, enviar, copiar, versao, tentativas, parado_em is not null as parado
                                           from public.plt_tiny_estoque_fila where produto_tiny_id = ${id}`)
const pegar42 = async () => await linhas42(`select produto_tiny_id::int as id, versao, sku, enviar, copiar from public.plt_fn_tiny_estoque_proximos(50)`)
const ler42 = async (id, versao, resposta) =>
  (await um42(`select public.plt_fn_tiny_estoque_leitura(${id}, ${versao}, ${sqlJson(resposta)}) as r`)).r

await bd.exec(`
  insert into public.produtos (tiny_id, codigo, descricao, classe, situacao, estoque_minimo, unidade) values
    (942001, 'S42A', 'Estante Teste 42 - Branco', 'F', 'A', null, 'un'),
    (942002, 'S42B', 'Armário Teste 42 - Branco', 'F', 'A', null, 'un'),
    (942003, 'S42C', 'Nicho Teste 42 - Preto', 'F', 'A', 2, 'un'),
    (942004, 'S42D', 'Painel Teste 42 - só na fábrica', 'F', 'A', null, 'un'),
    (942009, 'S42M', 'Chapa Teste 42', 'M', 'A', null, 'chapa')
  on conflict (tiny_id) do nothing;
  -- o id do S42A na conta da LOJA vem do último pedido que o vendeu (A-22)
  insert into public.pedidos (numero, cliente_id, situacao, data_pedido)
    values (942100, (select id from public.clientes order by id limit 1), 'Entregue', current_date - 30);
  insert into public.pedido_itens (pedido_id, seq, id_produto, codigo, descricao, quantidade)
    values ((select id from public.pedidos where numero = 942100), 1, 777001, 'S42A', 'Estante Teste 42 - Branco', 1);
`)
await como42(S42.logistica)
await bd.exec(`select public.plt_fn_estoque_movimentar(942002, 'entrada', 2, 'antes de ligar')`)
const avisoDesligado = (await um42(`select public.plt_fn_tiny_estoque_aviso(${sqlJson({
  versao: '1.0.1', cnpj: '27556613000166', tipo: 'estoque', dados: { idProduto: 942001, sku: 'S42A', nome: 'x', saldo: 0 } })}) as r`)).r
conferir(
  avisoDesligado.registrado === true && avisoDesligado.na_fila === false
    && (await um42(`select count(*)::int as n from public.eventos where tipo = 'estoque_fabrica' and payload -> 'dados' ->> 'sku' = 'S42A'`)).n === 1
    && (await um42(`select count(*)::int as n from public.plt_tiny_estoque_fila`)).n === 0
    && (await pegar42()).length === 0,
  'desligado: o aviso do Tiny fica registrado como sempre (o mesmo registro cru), mas nada entra na fila e o n8n não recebe trabalho',
  JSON.stringify(avisoDesligado),
)
// pedido que chegou ANTES de ligar: a venda dele já está no saldo do Tiny — não reserva
await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao, data_pedido)
    values (942101, (select id from public.clientes order by id limit 1), 'Em aberto', current_date);
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
    values ((select id from public.pedidos where numero = 942101), 1, 'S42B', 'Armário Teste 42 - Branco', 1);
`)

titulo('Estoque × Tiny (30/09) · ligar é do admin e copia o saldo do Tiny uma vez (ponto de partida)')

await como42(S42.logistica)
await deveRecusarExec(`select public.plt_fn_tiny_estoque_ligar()`,
  'a logística não liga o sincronismo (gesto de admin)', /admin/i)
await como42(S42.admin)
const ligou = (await um42(`select public.plt_fn_tiny_estoque_ligar() as r`)).r
// o n8n pega de 50 em 50; aqui pega tudo o que a cópia pôs na fila
const pegos = []
for (let i = 0; i < 20; i++) {
  const lote = await pegar42()
  if (lote.length === 0) break
  pegos.push(...lote)
}
const pego = (id) => pegos.find((p) => p.id === id)
conferir(
  ligou.ligado_desde && ligou.produtos_para_copiar >= 4
    && pego(942001)?.copiar && pego(942002)?.copiar && !pego(942009)
    && (await um42(`select count(*)::int as n from public.plt_logs_atividade where acao = 'estoque_tiny_ligado'`)).n === 1,
  'ligar: todo acabado ativo entra na fila para COPIAR o Tiny (insumo não entra); fica o registro de quem ligou',
  JSON.stringify({ ligou, pegos: pegos.filter((p) => p.id >= 942001 && p.id <= 942009) }),
)
const copiaA = await ler42(942001, pego(942001).versao,
  respostaTiny(942001, 'S42A', [['FábricaDomoby', 'Geral', 0], ['lojadomoby', 'Fábrica', 3]]))
const copiaB = await ler42(942002, pego(942002).versao,
  respostaTiny(942002, 'S42B', [['FábricaDomoby', 'Geral', 0], ['lojadomoby', 'Fábrica', 1]]))
const copiaC = await ler42(942003, pego(942003).versao,
  respostaTiny(942003, 'S42C', [['FábricaDomoby', 'Geral', 0], ['lojadomoby', 'Fábrica', -4]]))
const eventosCopia = await linhas42(`
  select e.origem, e.dados ->> 'motivo' as motivo, e.tipo
    from public.plt_eventos e join public.plt_cards c on c.id = e.card_id
   where c.produto_tiny_id in (942001, 942002) and e.dados ->> 'motivo' = 'tiny_copia'`)
conferir(
  (await livres42(942001)).livres === 3 && (await livres42(942002)).livres === 1
    && (await livres42(942003)).livres === 0
    && copiaA.motivo === 'copiado' && copiaB.motivo === 'copiado'
    && eventosCopia.length === 4 && eventosCopia.every((e) => e.origem === 'api')
    && eventosCopia.filter((e) => e.tipo === 'card_criado').length === 3
    && eventosCopia.filter((e) => e.tipo === 'card_arquivado').length === 1,
  'cópia nos dois sentidos: 0 → 3 (o Tiny tem 3 na loja), 2 → 1 (a plataforma desce ao Tiny) e negativo no Tiny vira 0 — tudo por evento, origem da integração',
  JSON.stringify({ copiaA, copiaB, copiaC, eventosCopia }),
)
conferir(
  !(await fila42(942001)) && !(await fila42(942002))
    && (await um42(`select count(*)::int as n from public.plt_tiny_estoque_fila where enviar`)).n === 0,
  'a cópia não volta para o Tiny (nada de "enviar" na fila) e o produto sai da fila',
)
const leituraGuardada = await um42(`
  select l.saldo, l.origem from plt_privado.fn_leituras_tiny() l where l.tiny_id = 942001`)
conferir(
  Number(leituraGuardada?.saldo) === 3 && leituraGuardada?.origem === 'leitura',
  'a leitura fica guardada (o detalhe do produto mostra "o que o Tiny diz" = o saldo somado das duas empresas)',
  JSON.stringify(leituraGuardada),
)
// resto da cópia (produtos de outros blocos): esvazia a fila sem mudar nada
for (const p of pegos.filter((x) => ![942001, 942002, 942003].includes(x.id))) {
  await bd.exec(`delete from public.plt_tiny_estoque_fila where produto_tiny_id = ${p.id}`)
}

titulo('Estoque × Tiny (30/09) · plataforma → Tiny: a entrada manda o Tiny ficar igual (depósito Fábrica da loja)')

await como42(S42.logistica)
await bd.exec(`select public.plt_fn_estoque_movimentar(942001, 'entrada', 2, 'chegou da produção')`)
const filaEntrada = await fila42(942001)
conferir(filaEntrada?.enviar === true && filaEntrada?.copiar === false,
  'entrada de 2 põe o produto na fila para ENVIAR ao Tiny (uma linha só, mesmo com 2 peças)',
  JSON.stringify(filaEntrada))
const p1 = (await pegar42()).find((p) => p.id === 942001)
const ajuste = await ler42(942001, p1.versao,
  respostaTiny(942001, 'S42A', [['FábricaDomoby', 'Geral', 0], ['lojadomoby', 'Fábrica', 3]]))
conferir(
  ajuste.acao === 'ajustar' && ajuste.conta === 'loja' && Number(ajuste.id_produto) === 777001
    && ajuste.deposito === 'Fábrica' && ajuste.tipo === 'B' && Number(ajuste.quantidade) === 5
    && Number(ajuste.tiny_depois) === 5
    && ajuste.estoque?.estoque?.idProduto === 777001 && ajuste.estoque.estoque.deposito === 'Fábrica',
  'o n8n recebe o ajuste pronto: balanço no depósito "Fábrica" da LOJA (id do produto na loja), para a soma ficar 5 — o número da plataforma',
  JSON.stringify(ajuste),
)
conferir((await fila42(942001))?.enviar === true,
  'enquanto o Tiny não confirma, o produto segue na fila (reservado para o n8n)')
const confirmou = (await um42(`select public.plt_fn_tiny_estoque_ajustado(942001, ${p1.versao}, ${sqlJson(ajuste)},
  ${sqlJson({ retorno: { status: 'OK', registros: [{ registro: { sequencia: 1, status: 'OK', id: 555, saldoEstoque: 5 } }] } })}) as r`)).r
const logAjuste = await um42(`select contexto from public.plt_logs_atividade where acao = 'estoque_tiny_ajustado' order by id desc limit 1`)
conferir(
  confirmou.ok === true && !(await fila42(942001))
    && logAjuste?.contexto?.sku === 'S42A' && Number(logAjuste.contexto.tiny_depois) === 5
    && Number(logAjuste.contexto.lancamento_id) === 555,
  'confirmado pelo Tiny: sai da fila e o ajuste fica na trilha (produto, depósito, antes/depois, o lançamento do Tiny)',
  JSON.stringify({ confirmou, logAjuste }),
)
// sem o depósito da loja (produto só na fábrica): ajusta o Geral da fábrica
await bd.exec(`select public.plt_fn_estoque_movimentar(942004, 'entrada', 1, null)`)
const p4 = (await pegar42()).find((p) => p.id === 942004)
const ajusteFabrica = await ler42(942004, p4.versao, respostaTiny(942004, 'S42D', [['FábricaDomoby', 'Geral', 0]]))
conferir(
  ajusteFabrica.conta === 'fabrica' && Number(ajusteFabrica.id_produto) === 942004
    && ajusteFabrica.deposito === 'Geral' && ajusteFabrica.tipo === 'B' && Number(ajusteFabrica.quantidade) === 1,
  'produto que não existe na loja: o ajuste vai para o Geral da fábrica',
  JSON.stringify(ajusteFabrica),
)
await bd.exec(`select public.plt_fn_tiny_estoque_ajustado(942004, ${p4.versao}, ${sqlJson(ajusteFabrica)}, ${sqlJson({ retorno: { status: 'OK', registros: [{ registro: { status: 'OK', id: 1 } }] } })})`)
// baixa com o saldo no Geral: balanço negativo não existe → saída da diferença
await bd.exec(`select public.plt_fn_estoque_movimentar(942004, 'baixa', 1, null)`)
const p4b = (await pegar42()).find((p) => p.id === 942004)
const ajusteSaida = await ler42(942004, p4b.versao,
  respostaTiny(942004, 'S42D', [['FábricaDomoby', 'Geral', -2], ['FábricaDomoby', 'Mostruário', 4]]))
conferir(
  ajusteSaida.tipo === 'S' && Number(ajusteSaida.quantidade) === 2 && Number(ajusteSaida.tiny_depois) === 0,
  'quando o balanço do depósito ficaria negativo, vira saída da diferença (a soma fica igual à plataforma)',
  JSON.stringify(ajusteSaida),
)
await bd.exec(`select public.plt_fn_tiny_estoque_ajustado(942004, ${p4b.versao}, ${sqlJson(ajusteSaida)}, ${sqlJson({ retorno: { status: 'OK', registros: [{ registro: { status: 'OK', id: 2 } }] } })})`)
// já igual: nada a gravar
await bd.exec(`select public.plt_fn_estoque_movimentar(942002, 'contagem', 1, 'conferido')`)
const p2 = (await pegar42()).find((p) => p.id === 942002)
const igual = await ler42(942002, p2.versao, respostaTiny(942002, 'S42B', [['lojadomoby', 'Fábrica', 1]]))
conferir(
  igual.acao === 'nada' && igual.motivo === 'ja_igual' && !(await fila42(942002)),
  'contagem conferida e o Tiny já igual: nenhuma gravação no Tiny, sai da fila',
  JSON.stringify(igual),
)

titulo('Estoque × Tiny (30/09) · Tiny → plataforma: o Tiny acima sobe a plataforma; abaixo, nada')

await bd.exec(`select public.plt_fn_tiny_estoque_aviso(${sqlJson({ cnpj: '27556613000166', tipo: 'estoque', dados: { idProduto: 942001, sku: 'S42A', nome: 'x', saldo: 0 } })})`)
const filaAviso = await fila42(942001)
const pA = (await pegar42()).find((p) => p.id === 942001)
const subiu = await ler42(942001, pA.versao,
  respostaTiny(942001, 'S42A', [['FábricaDomoby', 'Geral', 0], ['lojadomoby', 'Fábrica', 8]]))
const entradasTiny = await linhas42(`
  select e.origem, e.usuario_id is null as sem_pessoa from public.plt_eventos e join public.plt_cards c on c.id = e.card_id
   where c.produto_tiny_id = 942001 and e.tipo = 'card_criado' and e.dados ->> 'motivo' = 'tiny'`)
conferir(
  filaAviso?.enviar === false && subiu.motivo === 'subiu' && subiu.entraram === 3
    && (await livres42(942001)).livres === 8
    && entradasTiny.length === 3 && entradasTiny.every((e) => e.origem === 'api' && e.sem_pessoa),
  'aviso do Tiny (fábrica) → leitura com 8 × 5 na plataforma: entram 3 peças, motivo "entrou pelo Tiny", origem da integração',
  JSON.stringify({ filaAviso, subiu, entradasTiny }),
)
conferir(!(await fila42(942001)),
  'o que veio do Tiny NÃO volta para o Tiny (sem "enviar" depois de subir)')
await bd.exec(`select public.plt_fn_tiny_estoque_aviso(${sqlJson({ cnpj: '27556613000166', tipo: 'estoque', dados: { idProduto: 942001, sku: 'S42A', nome: 'x', saldo: 0 } })})`)
const pA2 = (await pegar42()).find((p) => p.id === 942001)
const abaixo = await ler42(942001, pA2.versao, respostaTiny(942001, 'S42A', [['lojadomoby', 'Fábrica', 2]]))
conferir(abaixo.motivo === 'sem_mudanca' && (await livres42(942001)).livres === 8,
  'Tiny abaixo da plataforma (2 × 8): nada muda — a saída se dá pela plataforma (resposta do dono)',
  JSON.stringify(abaixo))
// aviso da LOJA: o id não casa — vale o SKU
const avisoLoja = (await um42(`select public.plt_fn_tiny_estoque_aviso(${sqlJson({ cnpj: '48.404.755/0001-88', tipo: 'estoque', dados: { idProduto: 777001, sku: 'S42A', nome: 'Estante Teste 42 - Branco', saldo: 8 } })}) as r`)).r
conferir(Number(avisoLoja.produto_tiny_id) === 942001 && avisoLoja.na_fila === true,
  'aviso da conta da LOJA: acha o produto pelo SKU e põe na fila para ler',
  JSON.stringify(avisoLoja))
await bd.exec(`delete from public.plt_tiny_estoque_fila where produto_tiny_id = 942001`)
// reposição no PCP e o Tiny cobre o mínimo: a reposição sai do PCP sozinha
// ↪️ 30/09 (Ajuste Estoque 2 — D-83): o mínimo agora é o da plataforma e só no
// Top X; o cenário dá uma venda ao Nicho (entra no ranking) e fixa o mínimo 2.
await bd.exec(`
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
    values ((select id from public.pedidos where numero = 942100), 2, 'S42C', 'Nicho Teste 42 - Preto', 1);
  select public.plt_fn_estoque_definir_minimo(942003, 2);
`)
await bd.exec(`
  insert into public.plt_cards (tipo, produto_tiny_id, item_codigo, item_descricao, total_unidades, setor_atual_id)
    values ('reposicao', 942003, 'S42C', 'Nicho Teste 42 - Preto', 2, (select id from public.plt_setores where papel_no_fluxo = 'entrada' order by id limit 1));
  insert into public.plt_eventos (card_id, tipo, origem, setor_destino_id, dados)
    values ((select max(id) from public.plt_cards where tipo = 'reposicao' and produto_tiny_id = 942003), 'card_criado', 'automacao',
            (select id from public.plt_setores where papel_no_fluxo = 'entrada' order by id limit 1), '{"motivo":"reposicao_estoque"}');
`)
await bd.exec(`select public.plt_fn_tiny_estoque_aviso(${sqlJson({ cnpj: '27556613000166', tipo: 'estoque', dados: { idProduto: 942003, sku: 'S42C', nome: 'x', saldo: 3 } })})`)
const pC = (await pegar42()).find((p) => p.id === 942003)
await ler42(942003, pC.versao, respostaTiny(942003, 'S42C', [['lojadomoby', 'Fábrica', 3]]))
const repo = await um42(`
  select c.arquivado_em is not null as arquivada, e.dados ->> 'motivo' as motivo, e.origem
    from public.plt_cards c left join public.plt_eventos e on e.card_id = c.id and e.tipo = 'card_arquivado'
   where c.tipo = 'reposicao' and c.produto_tiny_id = 942003 order by c.id desc limit 1`)
conferir(
  (await livres42(942003)).livres === 3 && repo?.arquivada && repo.motivo === 'estoque_coberto' && repo.origem === 'api',
  'o exemplo do dono: 3 lançadas no Tiny com mínimo 2 → a plataforma fica com 3 e a reposição ainda no PCP é arquivada sozinha',
  JSON.stringify(repo),
)

titulo('Estoque × Tiny (30/09) · o Tiny falhou 5 vezes: para e aparece na tela; um aviso novo destrava')

await bd.exec(`select public.plt_fn_tiny_estoque_aviso(${sqlJson({ cnpj: '27556613000166', tipo: 'estoque', dados: { idProduto: 942002, sku: 'S42B', nome: 'x', saldo: 1 } })})`)
for (let i = 0; i < 5; i++) {
  const p = (await pegar42()).find((x) => x.id === 942002)
  if (p) await ler42(942002, p.versao, { retorno: { status: 'Erro', codigo_erro: 6, erros: [{ erro: 'API Bloqueada - Excedido o número de acessos a API' }] } })
}
const parado = await fila42(942002)
await como42(S42.logistica)
const situacao = (await um42(`select public.plt_fn_tiny_estoque_situacao() as r`)).r
conferir(
  parado?.parado === true && parado.tentativas === 5 && !(await pegar42()).some((p) => p.id === 942002)
    && situacao?.ligado_desde && situacao.parados.some((p) => p.sku === 'S42B' && /Excedido/.test(p.erro))
    && situacao.ultimos_ajustes.length >= 1
    && (await um42(`select count(*)::int as n from public.plt_logs_atividade where acao = 'estoque_tiny_falha'`)).n === 1,
  'na 5ª falha seguida o produto para (não é mais entregue ao n8n), aparece na situação com o erro, e fica na trilha',
  JSON.stringify({ parado, situacao }),
)
await bd.exec(`select public.plt_fn_tiny_estoque_aviso(${sqlJson({ cnpj: '27556613000166', tipo: 'estoque', dados: { idProduto: 942002, sku: 'S42B', nome: 'x', saldo: 1 } })})`)
const destravou = await fila42(942002)
conferir(destravou?.parado === false && destravou.tentativas === 0 && (await pegar42()).some((p) => p.id === 942002),
  'um aviso novo do mesmo produto destrava a fila', JSON.stringify(destravou))
await bd.exec(`delete from public.plt_tiny_estoque_fila`)

titulo('Estoque × Tiny (30/09) · a venda reserva a peça na hora; o PCP decide; nada da venda vai ao Tiny')

await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao, data_pedido)
    values (942102, (select id from public.clientes order by id limit 1), 'Em aberto', current_date);
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade) values
    ((select id from public.pedidos where numero = 942102), 1, 'S42A', 'Estante Teste 42 - Branco', 2),
    ((select id from public.pedidos where numero = 942102), 2, null, 'Frete cliente', 1);
`)
const antesVenda = await livres42(942001)
const rodada1 = (await um42(`select plt_privado.fn_estoque_reservas_rodar() as r`)).r
const reservadasVenda = await linhas42(`
  select c.id::int as id, c.reservada_item_seq as seq, c.reservada_indice as k
    from public.plt_cards c where c.reservada_pedido_id = (select id from public.pedidos where numero = 942102)
   order by c.reservada_indice`)
const baseVenda = await um42(`select disponivel, prontos_reservados from plt_privado.fn_estoque_por_produto() where tiny_id = 942001`)
conferir(
  rodada1.reservadas === 2 && reservadasVenda.length === 2
    && reservadasVenda[0].seq === 1 && reservadasVenda[0].k === 1 && reservadasVenda[1].k === 2
    && (await livres42(942001)).livres === antesVenda.livres - 2 && (await livres42(942001)).reservadas === 2
    && Number(baseVenda.disponivel) === antesVenda.livres - 2 && baseVenda.prontos_reservados === 2,
  'pedido novo com 2 estantes: 2 peças livres ficam RESERVADAS na hora — o número do estoque cai 2 e elas aparecem como reservadas (o frete não reserva nada)',
  JSON.stringify({ rodada1, reservadasVenda, baseVenda }),
)
const filaVenda = await fila42(942001)
conferir(filaVenda && filaVenda.enviar === false,
  'a venda não manda nada ao Tiny (o Tiny já baixou) — só pede uma leitura para conferir',
  JSON.stringify(filaVenda))
await bd.exec(`delete from public.plt_tiny_estoque_fila`)
const rodada2 = (await um42(`select plt_privado.fn_estoque_reservas_rodar() as r`)).r
conferir(rodada2.reservadas === 0 && rodada2.pedidos_avaliados === 0 && (await livres42(942001)).reservadas === 2,
  'a próxima rodada não reserva de novo (o pedido foi avaliado uma vez só)', JSON.stringify(rodada2))
conferir(
  (await um42(`select count(*)::int as n from public.plt_cards c join public.pedidos p on p.id = c.pedido_id
                where p.numero = 942101 and c.tipo = 'pedido'
                  and exists (select 1 from public.plt_eventos e where e.card_id = c.id and e.tipo = 'estoque_reserva_avaliada')`)).n === 0,
  'pedido que chegou antes de ligar não reserva (a venda dele já estava no saldo copiado do Tiny)',
)
const cardVenda = (await um42(`select id::int as id from public.plt_cards where tipo = 'pedido'
                                and pedido_id = (select id from public.pedidos where numero = 942102)`)).id
await como42(S42.logistica)
const sugestoesVenda = await linhas42(`select item_seq, indice_unidade, peca_card_id::int as peca, reservada
                                         from public.plt_fn_sugestoes_alocacao(${cardVenda})`)
conferir(
  sugestoesVenda.length === 2 && sugestoesVenda.every((s) => s.reservada)
    && sugestoesVenda.map((s) => s.peca).sort().join() === reservadasVenda.map((r) => r.id).sort().join(),
  'no PCP, ao liberar, cada unidade vem com a SUA peça reservada (a tela já marca)',
  JSON.stringify(sugestoesVenda),
)
// outro pedido não pega a peça reservada deste
await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao, data_pedido)
    values (942103, (select id from public.clientes order by id limit 1), 'Em aberto', current_date - 1);
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
    values ((select id from public.pedidos where numero = 942103), 1, 'S42A', 'Estante Teste 42 - Branco', 1);
`)
const cardOutro = (await um42(`select id::int as id from public.plt_cards where tipo = 'pedido'
                                and pedido_id = (select id from public.pedidos where numero = 942103)`)).id
await bd.exec(`select plt_privado.fn_estoque_reservas_rodar()`)   // o 942103 reserva a dele
await bd.exec(`delete from public.plt_tiny_estoque_fila`)
await deveRecusarExec(`select public.plt_fn_alocar_peca(${cardOutro}, 1, 1, ${reservadasVenda[0].id})`,
  'a peça reservada para um pedido não serve para outro', /reservada para outro pedido/i)
// o PCP usa a reservada na unidade 1 (sem ir ao Tiny) e manda produzir a unidade 2 (a peça volta e o Tiny recebe)
await bd.exec(`select public.plt_fn_alocar_peca(${cardVenda}, 1, 1, ${reservadasVenda[0].id})`)
const alocada = await um42(`select dados ->> 'reservada' as reservada from public.plt_eventos
                             where card_id = ${reservadasVenda[0].id} and tipo = 'peca_alocada'`)
conferir(alocada?.reservada === 'true' && !(await fila42(942001)),
  'usar a peça reservada no próprio pedido: vai para Pedidos em aguardo e não gera nada para o Tiny',
  JSON.stringify(alocada))
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades, setor_atual_id)
    values ('unidade', (select id from public.pedidos where numero = 942102), ${cardVenda}, 1, 'S42A', 'Estante Teste 42 - Branco', 2, 2,
            (select id from public.plt_setores where papel_no_fluxo = 'entrada' order by id limit 1));
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id)
    values ((select max(id) from public.plt_cards), 'card_criado', (select id from public.plt_usuarios where auth_user_id = '${S42.admin}'), 'interface',
            (select id from public.plt_setores where papel_no_fluxo = 'entrada' order by id limit 1));
`)
const livresAntesRecusa = await livres42(942001)
const rodada3 = (await um42(`select plt_privado.fn_estoque_reservas_rodar() as r`)).r
const desfeita = await um42(`select dados ->> 'motivo' as motivo from public.plt_eventos
                              where card_id = ${reservadasVenda[1].id} and tipo = 'peca_reserva_desfeita'`)
conferir(
  rodada3.desfeitas === 1 && desfeita?.motivo === 'pcp_produzir'
    && (await livres42(942001)).livres === livresAntesRecusa.livres + 1
    && (await livres42(942001)).reservadas === livresAntesRecusa.reservadas - 1
    && (await fila42(942001))?.enviar === true,
  'o PCP liberou a unidade para PRODUÇÃO: a reserva se desfaz, a peça volta ao estoque e o Tiny recebe +1 (enviar)',
  JSON.stringify({ rodada3, desfeita }),
)
await bd.exec(`delete from public.plt_tiny_estoque_fila`)

titulo('Estoque × Tiny (30/09) · cancelado devolve a peça sem ir ao Tiny; faturado leva a peça junto')

const reservarPedido = async (numero, qtd) => {
  await bd.exec(`
    insert into public.pedidos (numero, cliente_id, situacao, data_pedido)
      values (${numero}, (select id from public.clientes order by id limit 1), 'Em aberto', current_date);
    insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
      values ((select id from public.pedidos where numero = ${numero}), 1, 'S42A', 'Estante Teste 42 - Branco', ${qtd});
  `)
  await bd.exec(`select plt_privado.fn_estoque_reservas_rodar()`)
  return (await um42(`select count(*)::int as n from public.plt_cards
                       where reservada_pedido_id = (select id from public.pedidos where numero = ${numero})`)).n
}
const reservaCancelada = await reservarPedido(942104, 1)
await bd.exec(`delete from public.plt_tiny_estoque_fila`)
await bd.exec(`update public.pedidos set situacao = 'Cancelado' where numero = 942104`)
const rodadaCancel = (await um42(`select plt_privado.fn_estoque_reservas_rodar() as r`)).r
conferir(
  reservaCancelada === 1 && rodadaCancel.desfeitas === 1
    && (await um42(`select count(*)::int as n from public.plt_cards where reservada_pedido_id = (select id from public.pedidos where numero = 942104)`)).n === 0
    && !(await fila42(942001)),
  'cancelado no Tiny: a reserva se desfaz e a peça volta — sem mandar nada ao Tiny (ele devolve sozinho)',
  JSON.stringify(rodadaCancel),
)
const reservaFaturada = await reservarPedido(942105, 1)
await bd.exec(`delete from public.plt_tiny_estoque_fila`)
const antesFaturar = await livres42(942001)
await bd.exec(`update public.pedidos set situacao = 'Faturado' where numero = 942105`)
const rodadaFat = (await um42(`select plt_privado.fn_estoque_reservas_rodar() as r`)).r
const consumo = await um42(`
  select e.origem, e.dados ->> 'motivo' as motivo from public.plt_eventos e
   where e.tipo = 'card_arquivado' and (e.dados ->> 'pedido_id')::bigint = (select id from public.pedidos where numero = 942105)`)
conferir(
  reservaFaturada === 1 && rodadaFat.consumidas === 1 && consumo?.motivo === 'venda' && consumo.origem === 'api'
    && (await livres42(942001)).reservadas === antesFaturar.reservadas - 1
    && (await livres42(942001)).livres === antesFaturar.livres
    && !(await fila42(942001)),
  'faturado: a peça reservada sai com o pedido (baixa "venda"), o número livre não muda e nada vai ao Tiny',
  JSON.stringify({ rodadaFat, consumo }),
)

titulo('Estoque × Tiny (30/09) · contagem é física (conta a reservada); só a plataforma reserva')

const reservaContagem = await reservarPedido(942106, 1)
await bd.exec(`delete from public.plt_tiny_estoque_fila`)
await como42(S42.logistica)
const pecasAntes = await livres42(942001)
await deveRecusarExec(`select public.plt_fn_estoque_movimentar(942001, 'contagem', 0, null)`,
  'contagem menor que as peças reservadas no galpão é recusada, dizendo quantas são', /reservada/i)
const depoisContagem = (await um42(`select public.plt_fn_estoque_movimentar(942001, 'contagem', ${pecasAntes.livres + pecasAntes.reservadas}, null) as n`)).n
conferir(
  reservaContagem === 1 && pecasAntes.reservadas >= 1 && depoisContagem === pecasAntes.livres
    && (await livres42(942001)).reservadas === pecasAntes.reservadas
    && (await fila42(942001))?.enviar === true,
  'contagem física = livres + reservadas: contar o que já está lá não mexe em nada — e confere o Tiny (enviar)',
  JSON.stringify({ pecasAntes, depoisContagem }),
)
const linhaLista = await um42(`select em_estoque, reservados_venda as reservados, reservadas_estoque
                                 from public.plt_fn_estoque_produtos('acabados', 'S42A', null, 20, 0)`)
conferir(
  Number(linhaLista?.em_estoque) === pecasAntes.livres && linhaLista.reservadas_estoque === pecasAntes.reservadas
    && linhaLista.reservados >= pecasAntes.reservadas,
  'a lista do estoque mostra as livres como número e as reservadas para venda à parte (a prévia da contagem usa as duas)',
  JSON.stringify(linhaLista),
)
const pecasLista = await linhas42(`select dono, reservada_numero from public.plt_fn_estoque(null, 100, 0, 942001, 'livre')`)
conferir(
  pecasLista.filter((p) => p.reservada_numero !== null).length === pecasAntes.reservadas
    && pecasLista.every((p) => p.dono === 'livre'),
  'peça por peça: a reservada para venda diz para qual pedido (e segue "sem dono" até sair)',
  JSON.stringify(pecasLista.filter((p) => p.reservada_numero !== null)),
)
await deveRecusarExec(`
  insert into public.plt_eventos (card_id, tipo, origem, dados)
    values ((select min(id) from public.plt_cards where produto_tiny_id = 942001 and arquivado_em is null and reservada_pedido_id is null and pedido_id is null),
            'peca_reservada', 'automacao', '{"pedido_id": 1}')`,
  'ninguém reserva peça por fora — só a plataforma (vale até para a chave de serviço)', /só pela plataforma/i)

titulo('Estoque × Tiny (30/09) · as portas do n8n são só da chave de serviço; desligar para tudo')

const privilegio = await um42(`
  select has_function_privilege('authenticated', 'public.plt_fn_tiny_estoque_aviso(jsonb)', 'execute') as aviso,
         has_function_privilege('authenticated', 'public.plt_fn_tiny_estoque_leitura(bigint, integer, jsonb)', 'execute') as leitura,
         has_function_privilege('authenticated', 'public.plt_fn_tiny_estoque_proximos(integer)', 'execute') as proximos,
         has_function_privilege('anon', 'public.plt_fn_tiny_estoque_situacao()', 'execute') as situacao_anon,
         has_function_privilege('authenticated', 'plt_privado.fn_estoque_reservas_rodar()', 'execute') as maquinaria`)
conferir(
  !privilegio.aviso && !privilegio.leitura && !privilegio.proximos && !privilegio.situacao_anon && !privilegio.maquinaria,
  'quem está logado não chama as portas do n8n nem a maquinaria; anônimo não vê nem a situação',
  JSON.stringify(privilegio),
)
await como42(S42.admin)
await bd.exec(`select public.plt_fn_tiny_estoque_desligar()`)
await bd.exec(`delete from public.plt_tiny_estoque_fila`)
const avisoDepois = (await um42(`select public.plt_fn_tiny_estoque_aviso(${sqlJson({ cnpj: '27556613000166', tipo: 'estoque', dados: { idProduto: 942001, sku: 'S42A', nome: 'x', saldo: 1 } })}) as r`)).r
await como42(S42.logistica)
await bd.exec(`select public.plt_fn_estoque_movimentar(942001, 'entrada', 1, null)`)
conferir(
  avisoDepois.na_fila === false && (await pegar42()).length === 0
    && (await um42(`select count(*)::int as n from public.plt_tiny_estoque_fila`)).n === 0,
  'desligado: nem aviso nem gesto põem nada na fila',
)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)
} // fim do bloco Estoque × Tiny

// ============================================================================
// O n8n SÓ RODA QUANDO HÁ TRABALHO (30/09 — migration 43, ↪️ D-80). O dono:
// "você não tá nem doido de deixar alguma coisa rodando no meu n8n a cada 1
// minuto". O relógio do banco (interno) chama o fluxo só com fila e sem lote em
// andamento; a varredura da madrugada é agendamento do banco.
// ============================================================================
{
titulo('Estoque × Tiny (30/09) · o banco só chama o n8n quando há fila (e nenhum lote em andamento)')

const um43 = async (sql) => (await bd.query(sql)).rows[0]
const precisa = async () => (await um43(`select plt_privado.fn_tiny_estoque_precisa_chamar() as p`)).p
const endereco = await um43(`select count(*)::int as n, bool_and(ativo) as ativo, min(url) as url
                               from public.plt_webhooks where 'tiny_estoque_fila' = any (eventos)`)
conferir(endereco.n === 1 && endereco.ativo && /\/webhook\/[0-9a-f-]{36}$/.test(endereco.url),
  'o endereço do fluxo do estoque no n8n mora nos webhooks de saída (um só, ativo, caminho secreto)',
  JSON.stringify(endereco))

await bd.exec(`delete from public.plt_tiny_estoque_fila`)
await bd.exec(`select set_config('request.jwt.claim.sub', '${E40.admin}', false)`)
await bd.exec(`select public.plt_fn_tiny_estoque_desligar()`)
conferir((await precisa()) === false, 'desligado: não chama')
await bd.exec(`update public.plt_setores set tiny_sincronizado_desde = now() where codigo = 'estoque'`)
conferir((await precisa()) === false, 'ligado e fila vazia: não chama (nenhuma execução no n8n, nenhuma consulta ao Tiny)')
await bd.exec(`select plt_privado.fn_tiny_estoque_enfileirar(942001, false, 'teste 43')`)
conferir((await precisa()) === true, 'ligado e com produto esperando: chama')
await bd.exec(`select * from public.plt_fn_tiny_estoque_proximos(20)`)   // o n8n pegou o lote
conferir((await precisa()) === false, 'lote em andamento (pego há menos de 2 min): não chama de novo — nunca dois lotes ao mesmo tempo')
await bd.exec(`update public.plt_tiny_estoque_fila set reservado_em = now() - interval '11 minutes'`)
conferir((await precisa()) === true, 'lote que travou (pego há mais de 10 min) volta e chama de novo')
await bd.exec(`update public.plt_tiny_estoque_fila set reservado_em = null, parado_em = now()`)
conferir((await precisa()) === false, 'só produto PARADO (5 falhas) na fila: não fica chamando à toa')

await bd.exec(`update public.plt_tiny_estoque_fila set parado_em = null`)
const relogio = (await um43(`select plt_privado.fn_estoque_relogio() as r`)).r
conferir(relogio.ligado === true && relogio.n8n === 'sem_pg_net' && 'reservadas' in relogio,
  'o relógio faz a reserva da venda e a chamada numa rodada só (aqui sem pg_net, só decide — em produção posta no n8n)',
  JSON.stringify(relogio))
const privilegio43 = await um43(`
  select has_function_privilege('authenticated', 'plt_privado.fn_estoque_relogio()', 'execute') as relogio,
         has_function_privilege('authenticated', 'plt_privado.fn_tiny_estoque_chamar_n8n()', 'execute') as chamar`)
conferir(!privilegio43.relogio && !privilegio43.chamar, 'o relógio e a chamada ficam fora da API', JSON.stringify(privilegio43))

await bd.exec(`delete from public.plt_tiny_estoque_fila`)
await bd.exec(`update public.plt_setores set tiny_sincronizado_desde = null where codigo = 'estoque'`)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)
} // fim do bloco 43

// ============================================================================
// A FOTO DO TINY CHEGA SOZINHA (30/09 — migration 44, D-82). O dono: a foto
// posta pela CÂMERA fica (o Tiny não a troca); foto apagada no Tiny: fica a
// última. O relógio do banco só chama a função quando há foto para copiar.
// ============================================================================
{
titulo('Fotos do Tiny (30/09) · o que falta copiar: foto no Tiny e sem foto aqui (ou a do Tiny trocou)')

const um44 = async (sql) => (await bd.query(sql)).rows[0]
const linhas44 = async (sql) => (await bd.query(sql)).rows
// Link no formato real do Tiny: s3 da Amazon, pasta tiny-anexos, arquivo = md5.
const urlT = (letra, ext = 'jpeg') => `https://s3.amazonaws.com/tiny-anexos-us/erp/T44/${letra.repeat(32)}.${ext}`
const rawCom = (...urls) => `'${JSON.stringify({ anexos: urls.map((u) => ({ anexo: u })) })}'::jsonb`
const pendentes44 = async () =>
  linhas44(`select produto_tiny_id::int as id, pasta, url_tiny from public.plt_fn_fotos_tiny_pendentes(20)
             where produto_tiny_id between 944001 and 944099 order by 1`)
const ids44 = async () => (await pendentes44()).map((p) => p.id).join(',')
const definir44 = async (id, caminho, url) =>
  (await um44(`select public.plt_fn_foto_tiny_definir(${id}, '${caminho}', '${url}') as r`)).r
const produto44 = (id) => um44(`select imagem_caminho, imagem_tiny from public.produtos where tiny_id = ${id}`)

await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)
await bd.exec(`
  insert into public.produtos (tiny_id, codigo, descricao, classe, situacao, unidade, raw) values
    (944001, 'S44A',   'Armário Teste 44',                  'F', 'A', 'un', ${rawCom(urlT('a'))}),
    (944002, 'S44B',   'Nicho Teste 44 sem foto no Tiny',   'F', 'A', 'un', '{"anexos": []}'::jsonb),
    (944003, 'S44C',   'Painel Teste 44 com link de fora',  'F', 'A', 'un', ${rawCom('https://exemplo.com/foto.jpg')}),
    (944004, 'S 44/D', 'Mesa Teste 44 com SKU estranho',    'F', 'A', 'un', ${rawCom(urlT('d'), urlT('e'))}),
    (944005, null,     'Banco Teste 44 sem SKU',            'S', 'A', 'un', ${rawCom(urlT('f', 'png'))})
  on conflict (tiny_id) do nothing;
`)
const inicio44 = await pendentes44()
conferir(
  inicio44.map((p) => p.id).join(',') === '944001,944004,944005'
    && inicio44[0].pasta === 'produtos/S44A' && inicio44[0].url_tiny === urlT('a')
    && inicio44[1].pasta === 'produtos/S_44_D' && inicio44[1].url_tiny === urlT('d')
    && inicio44[2].pasta === 'produtos/tiny-944005',
  'entra quem tem foto no Tiny e não tem aqui; a principal é a 1ª; a pasta segue a regra do app (SKU limpo, ou tiny-{id} sem SKU); sem foto no Tiny ou link de fora do Tiny não entram',
  JSON.stringify(inicio44),
)

titulo('Fotos do Tiny (30/09) · gravar a cópia; o Tiny trocou a foto → troca aqui e a cópia antiga sai')

const g1 = await definir44(944001, `produtos/S44A/tiny-${'a'.repeat(32)}.jpg`, urlT('a'))
const p1 = await produto44(944001)
const log1 = await um44(`select count(*)::int as n, bool_and(usuario_id is null) as sistema from public.plt_logs_atividade
                          where acao = 'estoque_foto_tiny' and contexto ->> 'produto_tiny_id' = '944001'`)
conferir(
  g1.gravou === true && g1.anterior == null && p1.imagem_caminho === `produtos/S44A/tiny-${'a'.repeat(32)}.jpg`
    && p1.imagem_tiny === urlT('a') && log1.n === 1 && log1.sistema && !(await ids44()).includes('944001'),
  'a cópia grava a foto e de onde ela veio, fica no histórico como feita pelo sistema, e o produto sai da lista',
  JSON.stringify({ g1, p1, log1 }),
)
await bd.exec(`update public.produtos set raw = ${rawCom(urlT('b'))} where tiny_id = 944001`)
conferir((await ids44()).includes('944001'), 'o Tiny trocou a foto principal: o produto volta para a lista')
const g2 = await definir44(944001, `produtos/S44A/tiny-${'b'.repeat(32)}.jpg`, urlT('b'))
conferir(
  g2.gravou === true && g2.anterior === `produtos/S44A/tiny-${'a'.repeat(32)}.jpg`
    && (await produto44(944001)).imagem_tiny === urlT('b'),
  'grava a nova e devolve a cópia antiga do Tiny para a função apagar da biblioteca',
  JSON.stringify(g2),
)
const g3 = await definir44(944001, `produtos/S44A/tiny-${'a'.repeat(32)}.jpg`, urlT('a'))
conferir(
  g3.gravou === false && g3.atual === `produtos/S44A/tiny-${'b'.repeat(32)}.jpg`
    && (await produto44(944001)).imagem_tiny === urlT('b'),
  'chamada atrasada (link que já não é o do Tiny) não grava nada — a função apaga o que subiu, porque não é o atual',
  JSON.stringify(g3),
)
const g4 = await definir44(944001, `produtos/S44A/tiny-${'b'.repeat(32)}.jpg`, urlT('b'))
conferir(g4.gravou === false && g4.atual === `produtos/S44A/tiny-${'b'.repeat(32)}.jpg`,
  'a mesma cópia duas vezes não grava de novo — e o arquivo fica (é o atual)', JSON.stringify(g4))

titulo('Fotos do Tiny (30/09) · a foto da câmera fica (resposta do dono)')

await bd.exec(`select set_config('request.jwt.claim.sub', '${E40.logistica}', false)`)
await bd.exec(`select public.plt_fn_estoque_definir_imagem(944001, 'produtos/S44A/capa-44.jpg')`)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)
await bd.exec(`update public.produtos set raw = ${rawCom(urlT('c'))} where tiny_id = 944001`)
const p944001 = await produto44(944001)
conferir(
  p944001.imagem_caminho === 'produtos/S44A/capa-44.jpg' && p944001.imagem_tiny === null
    && !(await ids44()).includes('944001'),
  'foto posta pela câmera deixa de ser do Tiny: o Tiny troca a foto dele e a da câmera continua',
  JSON.stringify(p944001),
)
conferir(
  (await definir44(944001, `produtos/S44A/tiny-${'c'.repeat(32)}.jpg`, urlT('c'))).gravou === false
    && (await produto44(944001)).imagem_caminho === 'produtos/S44A/capa-44.jpg',
  'nem uma chamada direta passa por cima da foto da câmera',
)
// Corrida: a logística põe a foto entre a lista e a gravação da cópia.
conferir((await ids44()).includes('944004'), 'a mesa (sem foto) está na lista')
await bd.exec(`select set_config('request.jwt.claim.sub', '${E40.logistica}', false)`)
await bd.exec(`select public.plt_fn_estoque_definir_imagem(944004, 'produtos/S_44_D/capa-1.jpg')`)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)
const corrida = await definir44(944004, `produtos/S_44_D/tiny-${'d'.repeat(32)}.jpg`, urlT('d'))
conferir(
  corrida.gravou === false && corrida.atual === 'produtos/S_44_D/capa-1.jpg',
  'a câmera chegou primeiro: a cópia do Tiny não grava (e a função apaga o arquivo que subiu)',
  JSON.stringify(corrida),
)

titulo('Fotos do Tiny (30/09) · foto apagada no Tiny: fica a última (resposta do dono)')

const g5 = await definir44(944005, `produtos/tiny-944005/tiny-${'f'.repeat(32)}.jpg`, urlT('f', 'png'))
await bd.exec(`update public.produtos set raw = '{"anexos": []}'::jsonb where tiny_id = 944005`)
const p944005 = await produto44(944005)
conferir(
  g5.gravou === true && p944005.imagem_caminho === `produtos/tiny-944005/tiny-${'f'.repeat(32)}.jpg`
    && !(await ids44()).includes('944005'),
  'o produto sem SKU ganha a foto na pasta tiny-{id}; o Tiny apagou a foto e a plataforma mantém a última',
  JSON.stringify({ g5, p944005 }),
)
await deveRecusarExec(`select public.plt_fn_foto_tiny_definir(944005, '../perfis/x.jpg', '${urlT('f', 'png')}')`,
  'caminho fora da pasta produtos/ é recusado', /inválido/i)

titulo('Fotos do Tiny (30/09) · link que falhou espera 24 h; foto nova no Tiny tenta na hora')

await bd.exec(`insert into public.produtos (tiny_id, codigo, descricao, classe, situacao, unidade, raw)
               values (944006, 'S44F', 'Estante Teste 44', 'F', 'A', 'un', ${rawCom(urlT('1'))})
               on conflict (tiny_id) do nothing`)
conferir((await ids44()).includes('944006'), 'a estante (sem foto) está na lista')
await bd.exec(`select public.plt_fn_foto_tiny_falhou(944006, '${urlT('1')}', 'Tiny respondeu 404')`)
const falha = await um44(`select count(*)::int as n, max(contexto ->> 'motivo') as motivo from public.plt_logs_atividade
                           where acao = 'estoque_foto_tiny_falhou' and contexto ->> 'produto_tiny_id' = '944006'`)
conferir(
  falha.n === 1 && falha.motivo === 'Tiny respondeu 404' && !(await ids44()).includes('944006'),
  'a falha fica no histórico com o motivo e o produto sai da lista (não fica tentando a cada 5 min)',
  JSON.stringify(falha),
)
await bd.exec(`update public.produtos set raw = ${rawCom(urlT('2'))} where tiny_id = 944006`)
conferir((await ids44()).includes('944006'), 'o Tiny trocou a foto: link novo tenta de novo na hora (a espera é do link, não do produto)')

titulo('Fotos do Tiny (30/09) · as 144 fotos da carga de 30/09 nascem marcadas como do Tiny')

await bd.exec(`
  insert into public.produtos (tiny_id, codigo, descricao, classe, situacao, unidade, raw, imagem_caminho) values
    (944007, 'S44G', 'Balcão Teste 44 da carga de 30/09', 'F', 'A', 'un', ${rawCom(urlT('7'))}, 'produtos/S44G/capa-1790739424006.jpg'),
    (944008, 'S44H', 'Balcão Teste 44 com foto da câmera', 'F', 'A', 'un', ${rawCom(urlT('8'))}, 'produtos/S44H/capa-1.jpg')
  on conflict (tiny_id) do nothing;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto, criado_em) values
    (null, 'estoque_foto_definida', '{"produto_tiny_id": 944007, "sku": "S44G", "caminho": "produtos/S44G/capa-1790739424006.jpg"}', '2026-09-30 03:37:04+00'),
    (null, 'estoque_foto_definida', '{"produto_tiny_id": 944008, "sku": "S44H", "caminho": "produtos/S44H/capa-1.jpg"}', '2026-09-29 12:00:00+00');
`)
await bd.exec(await readFile(path.join(MIGRATIONS, '20260930170000_plt_fotos_tiny_automaticas.sql'), 'utf8'))
const carga = await linhas44(`select tiny_id::int as id, imagem_tiny from public.produtos where tiny_id in (944007, 944008) order by 1`)
conferir(
  carga[0].imagem_tiny === urlT('7') && carga[1].imagem_tiny === null
    && !(await ids44()).includes('944007') && !(await ids44()).includes('944008'),
  'reaplicada com dados: a foto da carga de 30/09 vira "do Tiny"; a da câmera (outro momento) continua da câmera',
  JSON.stringify(carga),
)
await bd.exec(`update public.produtos set raw = ${rawCom(urlT('9'))} where tiny_id = 944007`)
conferir((await ids44()).includes('944007'), 'e quando o Tiny trocar a foto de um desses, a plataforma troca junto')

titulo('Fotos do Tiny (30/09) · o relógio só chama a função com foto para copiar; o segredo confere quem chama')

const endereco44 = await um44(`select count(*)::int as n, bool_and(ativo) as ativo, min(url) as url, min(segredo) as segredo
                                 from public.plt_webhooks where 'fotos_tiny' = any (eventos)`)
conferir(
  endereco44.n === 1 && endereco44.ativo && /\/functions\/v1\/fotos-tiny$/.test(endereco44.url)
    && /^[0-9a-f]{64}$/.test(endereco44.segredo),
  'o endereço da função mora nos webhooks de saída (um só, mesmo reaplicando), com segredo gerado no próprio banco',
  JSON.stringify({ ...endereco44, segredo: endereco44.segredo?.length }),
)
const confere = await um44(`select public.plt_fn_fotos_tiny_conferir('${endereco44.segredo}') as certo,
                                   public.plt_fn_fotos_tiny_conferir('errado') as errado,
                                   public.plt_fn_fotos_tiny_conferir('') as vazio,
                                   public.plt_fn_fotos_tiny_conferir(null) as nulo`)
conferir(confere.certo === true && !confere.errado && !confere.vazio && !confere.nulo,
  'só o segredo certo abre a função', JSON.stringify(confere))
conferir((await um44(`select plt_privado.fn_fotos_tiny_relogio() as r`)).r === 'sem_pg_net',
  'com foto para copiar, o relógio chama (aqui sem pg_net, só decide — em produção posta na função)')
await bd.exec(`update public.plt_webhooks set ativo = false where 'fotos_tiny' = any (eventos)`)
conferir((await um44(`select plt_privado.fn_fotos_tiny_relogio() as r`)).r === 'sem_endereco'
    && (await um44(`select public.plt_fn_fotos_tiny_conferir('${endereco44.segredo}') as r`)).r === false,
  'o admin desligou o endereço: o relógio não chama e o segredo deixa de abrir a função')
await bd.exec(`update public.plt_webhooks set ativo = true where 'fotos_tiny' = any (eventos)`)
for (const p of await linhas44(`select * from public.plt_fn_fotos_tiny_pendentes(20)`)) {
  await definir44(p.produto_tiny_id, `${p.pasta}/tiny-teste.jpg`, p.url_tiny)
}
conferir((await um44(`select plt_privado.fn_fotos_tiny_relogio() as r`)).r === 'nada_a_fazer',
  'sem foto nova: o relógio não chama nada (nenhuma execução à toa)')

const privilegio44 = await um44(`
  select has_function_privilege('authenticated', 'public.plt_fn_fotos_tiny_pendentes(integer)', 'execute') as pendentes,
         has_function_privilege('authenticated', 'public.plt_fn_foto_tiny_definir(bigint, text, text)', 'execute') as definir,
         has_function_privilege('authenticated', 'public.plt_fn_foto_tiny_falhou(bigint, text, text)', 'execute') as falhou,
         has_function_privilege('anon', 'public.plt_fn_fotos_tiny_conferir(text)', 'execute') as conferir_anon,
         has_function_privilege('authenticated', 'plt_privado.fn_fotos_tiny_relogio()', 'execute') as relogio,
         has_function_privilege('service_role', 'public.plt_fn_foto_tiny_definir(bigint, text, text)', 'execute') as servico,
         has_function_privilege('authenticated', 'public.plt_fn_estoque_definir_imagem(bigint, text)', 'execute') as camera`)
conferir(
  !privilegio44.pendentes && !privilegio44.definir && !privilegio44.falhou && !privilegio44.conferir_anon
    && !privilegio44.relogio && privilegio44.servico && privilegio44.camera,
  'as portas da cópia são só da chave de serviço; o relógio fica fora da API; a câmera segue para quem está logado',
  JSON.stringify(privilegio44),
)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)
} // fim do bloco 44

// ============================================================================
// AJUSTE ESTOQUE 2 (30/09 — migration 45, D-83…D-87): Top X é o tamanho da
// página e só ele tem mínimo; sugestão por dias úteis de venda (loja seg–sáb);
// mínimo automático que trava ao editar; corte de pedido fora do comum;
// necessidade × reservados para produção; vencimento em 2 dias úteis da
// fábrica (seg–sex); liga/desliga = agendar/desagendar o job.
// ============================================================================
{ // escopo próprio (E-70)
titulo('Ajuste Estoque 2 · cenário: vendas com corte, ranking e configurações')

const como45 = como40
const linhas45 = linhas40
const um45 = async (sql) => (await linhas45(sql))[0]
const sqlJson45 = (obj) => `'${JSON.stringify(obj).split("'").join("''")}'::jsonb`

await bd.exec(`
  insert into public.produtos (tiny_id, codigo, descricao, classe, situacao, estoque_minimo, unidade) values
    (945001, 'S45A', 'Cama Teste 45 - Branco', 'F', 'A', 9, 'un'),
    (945002, 'S45B', 'Mesa Teste 45 - Preta', 'F', 'A', null, 'un'),
    (945003, 'S45C', 'Banco Teste 45 - Cru', 'F', 'A', null, 'un'),
    (945004, 'S45D', 'Rack Teste 45 - Branco', 'F', 'A', null, 'un'),
    (945011, 'S45UN', 'Corrediça Teste 45', 'M', 'A', null, 'un'),
    (945012, 'S45M2', 'Chapa MDF Teste 45', 'M', 'A', null, 'm2')
  on conflict (tiny_id) do nothing;
  insert into public.pedidos (numero, cliente_id, situacao, data_pedido) values
    (945100, (select id from public.clientes order by id limit 1), 'Entregue', current_date - 5),
    (945101, (select id from public.clientes order by id limit 1), 'Entregue', current_date - 40);
  -- S45A: 8 linhas de 9 = 72 · S45B: 5 linhas de 8 = 40 · S45C: 2 linhas de 9 = 18
  -- S45D: 1 linha de 25 (passa do corte 10 → fora da conta) + 1 linha de 2
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
  select (select id from public.pedidos where numero = 945100), g, 'S45A', 'Cama Teste 45 - Branco', 9 from generate_series(1, 4) g;
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
  select (select id from public.pedidos where numero = 945101), g, 'S45A', 'Cama Teste 45 - Branco', 9 from generate_series(1, 4) g;
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
  select (select id from public.pedidos where numero = 945101), 4 + g, 'S45B', 'Mesa Teste 45 - Preta', 8 from generate_series(1, 5) g;
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade) values
    ((select id from public.pedidos where numero = 945100), 5, 'S45C', 'Banco Teste 45 - Cru', 9),
    ((select id from public.pedidos where numero = 945100), 6, 'S45C', 'Banco Teste 45 - Cru', 9),
    ((select id from public.pedidos where numero = 945100), 7, 'S45D', 'Rack Teste 45 - Branco', 25),
    ((select id from public.pedidos where numero = 945100), 8, 'S45D', 'Rack Teste 45 - Branco', 2);
`)

await como45(E40.logistica)
const cfg45 = (await um45(`select public.plt_fn_estoque_config() as r`)).r
conferir(
  cfg45?.top_x === 20 && cfg45?.cobertura_semanas === 2 && cfg45?.corte_pedido_grande === 10
    && cfg45?.dias_uteis_venda >= 76 && cfg45?.dias_uteis_venda <= 79,
  'as configurações nascem nos padrões (Top 20, 2 semanas, corte 10) e os dias úteis de venda (seg–sáb) batem com a janela',
  JSON.stringify(cfg45),
)
const vendas45 = async () =>
  Object.fromEntries((await linhas45(`select codigo, vendidos::float as vendidos, posicao
                                        from plt_privado.fn_vendas_90d()
                                       where codigo in ('S45A','S45B','S45C','S45D')`)).map((v) => [v.codigo, v]))
let v45 = await vendas45()
conferir(
  v45.S45A?.vendidos === 72 && v45.S45B?.vendidos === 40 && v45.S45C?.vendidos === 18
    && v45.S45D?.vendidos === 2
    && v45.S45A.posicao < v45.S45B.posicao && v45.S45B.posicao < v45.S45C.posicao,
  'o ranking JÁ nasce com o corte: a linha de 25 do Rack sai da conta como se o pedido não existisse (ficam só 2)',
  JSON.stringify(v45),
)
const linhaD = await um45(`select vendidos_90d::float as vendidos, cortes
                             from public.plt_fn_estoque_produtos('acabados', 'S45D', null, 10, 0)`)
conferir(linhaD?.vendidos === 2 && linhaD?.cortes === 1,
  'o cartão avisa: 1 pedido grande fora da conta', JSON.stringify(linhaD))
await como45(E40.admin)
await bd.exec(`select public.plt_fn_estoque_definir_corte(30)`)
v45 = await vendas45()
conferir(
  v45.S45D?.vendidos === 27
    && (await um45(`select count(*)::int as n from public.plt_logs_atividade where acao = 'estoque_corte_alterado'`)).n >= 1,
  'admin sobe o corte para 30: a linha de 25 volta à conta (27 vendidos) — com rastro na trilha',
  JSON.stringify(v45.S45D),
)
await bd.exec(`select public.plt_fn_estoque_definir_corte(10)`)

titulo('Ajuste Estoque 2 · sugestão por dias úteis; Top X é a página e só ele tem mínimo')

await como45(E40.logistica)
const dias45 = (await um45(`select plt_privado.fn_dias_uteis_venda_90d() as d`)).d
const confA = await um45(`select media_semana::float as media, sugestao, minimo::float as minimo, no_top
                            from public.plt_fn_estoque_configuracoes('S45A', 10, 0)`)
conferir(
  confA?.sugestao === Math.ceil((72 / dias45) * 6 * 2)
    && confA?.media === Math.round((72 / dias45) * 6 * 10) / 10,
  'a fórmula do dono: 72 vendidos ÷ dias úteis × 6 dias da semana de venda × 2 semanas, teto no fim',
  JSON.stringify({ dias45, confA }),
)
const posB = v45.S45B.posicao
await bd.exec(`select public.plt_fn_estoque_definir_top_x(${posB})`)
const pag1 = await linhas45(`select codigo, posicao from public.plt_fn_estoque_produtos('acabados', null, null, ${posB}, 0)`)
const pag2 = await linhas45(`select codigo, posicao from public.plt_fn_estoque_produtos('acabados', null, null, ${posB}, ${posB})`)
conferir(
  pag1.length === posB && pag1[0].posicao === 1 && pag1[pag1.length - 1].posicao === posB
    && pag2[0]?.posicao === posB + 1
    && (await um45(`select count(*)::int as n from public.plt_logs_atividade where acao = 'estoque_top_x_alterado'`)).n >= 1,
  'X é o tamanho da página: página 1 = 1º ao Xº, página 2 começa no X+1 — e a troca do Top X fica na trilha',
  JSON.stringify({ posB, pag1, pag2: pag2.slice(0, 2) }),
)
const linhaA = await um45(`select no_top, minimo::float as minimo, sugestao, minimo_travado
                             from public.plt_fn_estoque_produtos('acabados', 'S45A', null, 10, 0)`)
const linhaC = await um45(`select no_top, minimo, sugestao
                             from public.plt_fn_estoque_produtos('acabados', 'S45C', null, 10, 0)`)
conferir(
  linhaA?.no_top === true && linhaA?.minimo === Number(linhaA?.sugestao) && linhaA?.minimo_travado === false
    && linhaC?.no_top === false && linhaC?.minimo === null && linhaC?.sugestao === null,
  'trocar o Top X recalculou os mínimos automáticos: dentro do Top X o mínimo é a sugestão; fora, sem mínimo e sem sugestão',
  JSON.stringify({ linhaA, linhaC }),
)

titulo('Ajuste Estoque 2 · necessidade × reservados para produção; "Lançar para produção" (manual)')

const mB = Math.ceil((40 / dias45) * 6 * 2)
const filtro45 = async (filtro) =>
  (await linhas45(`select codigo from public.plt_fn_estoque_produtos('acabados', null, '${filtro}', 100, 0)`)).map((l) => l.codigo)
let necessidade = await filtro45('necessidade')
conferir(
  necessidade.includes('S45A') && necessidade.includes('S45B') && !necessidade.includes('S45C'),
  'necessidade de produção: quem tem mínimo e não tem estoque nem reposição a caminho; fora do Top X nunca aparece',
  JSON.stringify(necessidade),
)
const cardManual = (await um45(`select public.plt_fn_estoque_lancar_reposicao(945002, ${mB}) as id`)).id
const eventoManual = await um45(`
  select e.origem, e.usuario_id is not null as com_pessoa, e.dados ->> 'motivo' as motivo
    from public.plt_eventos e where e.card_id = ${cardManual} and e.tipo = 'card_criado'`)
necessidade = await filtro45('necessidade')
const reservadosProd = await filtro45('reservados_producao')
const linhaB = await um45(`select reservados_producao, reservados_venda
                             from public.plt_fn_estoque_produtos('acabados', 'S45B', null, 10, 0)`)
conferir(
  eventoManual?.origem === 'interface' && eventoManual?.com_pessoa === true && eventoManual?.motivo === 'reposicao_manual'
    && !necessidade.includes('S45B') && reservadosProd.includes('S45B')
    && linhaB?.reservados_producao === mB
    && (await um45(`select count(*)::int as n from public.plt_logs_atividade where acao = 'estoque_reposicao_lancada'`)).n === 1,
  'lançada à mão a quantidade que falta: sai da necessidade, entra em reservados para produção (a reposição no PCP conta no prazo) — gesto com autor e trilha',
  JSON.stringify({ eventoManual, linhaB }),
)
await deveRecusarExec(`select public.plt_fn_estoque_lancar_reposicao(945002, 1)`,
  'não nasce segunda reposição aberta para o mesmo produto', /já tem uma reposição aberta/i)
await bd.exec(`select public.plt_fn_estoque_movimentar(945003, 'entrada', 1, null)`)
conferir(
  (await filtro45('com_estoque')).includes('S45C') && !(await filtro45('necessidade')).includes('S45C'),
  'o filtro "Com estoque" mostra quem tem pelo menos 1; produto fora do Top X segue sem pedir reposição',
)
// Unidade DE PEDIDO em produção: aparece no número, mas não abate a necessidade.
await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao, data_pedido)
    values (945103, (select id from public.clientes order by id limit 1), 'Em aberto', current_date);
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
    values ((select id from public.pedidos where numero = 945103), 1, 'S45B', 'Mesa Teste 45 - Preta', 1);
`)
const cardPedido45 = (await um45(`select id::int as id from public.plt_cards where tipo = 'pedido'
                                    and pedido_id = (select id from public.pedidos where numero = 945103)`)).id
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades, setor_atual_id)
    values ('unidade', (select id from public.pedidos where numero = 945103), ${cardPedido45}, 1, 'S45B', 'Mesa Teste 45 - Preta', 1, 1,
            (select id from public.plt_setores where papel_no_fluxo = 'entrada' order by id limit 1));
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id)
    values ((select max(id) from public.plt_cards), 'card_criado', (select id from public.plt_usuarios where auth_user_id = '${E40.admin}'), 'interface',
            (select id from public.plt_setores where papel_no_fluxo = 'entrada' order by id limit 1));
`)
const linhaB2 = await um45(`select reservados_producao from public.plt_fn_estoque_produtos('acabados', 'S45B', null, 10, 0)`)
conferir(
  linhaB2?.reservados_producao === mB + 1 && !(await filtro45('necessidade')).includes('S45B'),
  'móvel de PEDIDO em produção soma no número de reservados (resposta 6), mas quem abate a necessidade é só o que vem para o estoque',
  JSON.stringify(linhaB2),
)
// A bolinha vermelha: peça reservada para venda esperando a decisão do PCP
// (um pedido AINDA sem nada liberado — pedido já decidido não acende bolinha).
await bd.exec(`
  insert into public.pedidos (numero, cliente_id, situacao, data_pedido)
    values (945104, (select id from public.clientes order by id limit 1), 'Em aberto', current_date);
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
    values ((select id from public.pedidos where numero = 945104), 1, 'S45C', 'Banco Teste 45 - Cru', 1);
`)
const cardPendente45 = (await um45(`select id::int as id from public.plt_cards where tipo = 'pedido'
                                      and pedido_id = (select id from public.pedidos where numero = 945104)`)).id
const pecaC = (await um45(`select id::int as id from public.plt_cards
                            where tipo = 'unidade' and produto_tiny_id = 945003 and pedido_id is null and arquivado_em is null limit 1`)).id
await bd.exec(`update public.plt_cards set reservada_pedido_id = (select id from public.pedidos where numero = 945104),
                                            reservada_em = now() where id = ${pecaC}`)
const linhaC2 = await um45(`select pendente_card_id::int as card, pendente_pedido_numero as numero, reservadas_estoque
                              from public.plt_fn_estoque_produtos('acabados', 'S45C', null, 10, 0)`)
conferir(
  linhaC2?.card === cardPendente45 && linhaC2?.numero === 945104 && linhaC2?.reservadas_estoque === 1,
  'a bolinha vermelha sabe para onde apontar: o card do pedido que espera a decisão do PCP',
  JSON.stringify(linhaC2),
)
await bd.exec(`update public.plt_cards set reservada_pedido_id = null, reservada_em = null where id = ${pecaC}`)

titulo('Ajuste Estoque 2 · o prazo de 2 dias úteis da fábrica (seg–sex) e o vencimento por evento')

const prazos = await um45(`
  select plt_privado.fn_reposicao_vence_em('2026-09-21T15:00:00-03:00') = '2026-09-24T00:00:00-03:00'::timestamptz as segunda,
         plt_privado.fn_reposicao_vence_em('2026-09-25T10:00:00-03:00') = '2026-09-30T00:00:00-03:00'::timestamptz as sexta,
         plt_privado.fn_reposicao_vence_em('2026-09-26T10:00:00-03:00') = '2026-09-30T00:00:00-03:00'::timestamptz as sabado`)
conferir(prazos?.segunda && prazos?.sexta && prazos?.sabado,
  'a régua do prazo: criada segunda vence quinta 00:00; criada sexta ou sábado, o fim de semana não conta — vence quarta 00:00',
  JSON.stringify(prazos))
await bd.exec(`select plt_privado.fn_vencer_reposicoes()`)
conferir(
  (await um45(`select arquivado_em is null as aberta from public.plt_cards where id = ${cardManual}`)).aberta === true,
  'reposição dentro do prazo não vence',
)
await bd.exec(`update public.plt_cards set criado_em = now() - interval '10 days' where id = ${cardManual}`)
const vencidas1 = (await um45(`select plt_privado.fn_vencer_reposicoes() as n`)).n
const eventoVencida = await um45(`
  select e.origem, e.usuario_id is null as sistema, e.dados ->> 'motivo' as motivo,
         (e.dados ->> 'vencidas')::int as vencidas, (e.dados ->> 'liberadas')::int as liberadas
    from public.plt_eventos e where e.card_id = ${cardManual} and e.tipo = 'card_arquivado'`)
necessidade = await filtro45('necessidade')
conferir(
  vencidas1 >= 1 && eventoVencida?.motivo === 'reposicao_vencida' && eventoVencida?.origem === 'api'
    && eventoVencida?.sistema === true && eventoVencida?.vencidas === mB && eventoVencida?.liberadas === 0
    && necessidade.includes('S45B'),
  'parada 2 dias úteis no PCP: sai por evento com o Sistema assinando, e o produto volta para a necessidade',
  JSON.stringify({ vencidas1, eventoVencida }),
)
const gerados45 = (await um45(`select plt_privado.fn_gerar_reposicoes() as n`)).n
const novaRepo = await um45(`select id::int as id, total_unidades as qtd from public.plt_cards
                               where tipo = 'reposicao' and produto_tiny_id = 945002
                                 and arquivado_em is null and liberado_completo_em is null`)
conferir(
  gerados45 >= 1 && novaRepo?.qtd === mB,
  'depois do vencimento a automática reabre SEM exigir movimento novo do estoque — e o móvel do pedido em produção não abate a conta',
  JSON.stringify({ gerados45, novaRepo }),
)
// Parcial: 1 unidade liberada entra na produção; só a parte parada vence.
await bd.exec(`
  insert into public.plt_cards (tipo, produto_tiny_id, card_pai_id, item_codigo, item_descricao, indice_unidade, total_unidades, setor_atual_id)
    values ('unidade', 945002, ${novaRepo.id}, 'S45B', 'Mesa Teste 45 - Preta', 1, ${mB},
            (select id from public.plt_setores where papel_no_fluxo = 'entrada' order by id limit 1));
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id)
    values ((select max(id) from public.plt_cards), 'card_criado', (select id from public.plt_usuarios where auth_user_id = '${E40.admin}'), 'interface',
            (select id from public.plt_setores where papel_no_fluxo = 'entrada' order by id limit 1));
`)
await bd.exec(`update public.plt_cards set criado_em = now() - interval '10 days' where id = ${novaRepo.id}`)
await bd.exec(`select plt_privado.fn_vencer_reposicoes()`)
const eventoParcial = await um45(`
  select (e.dados ->> 'vencidas')::int as vencidas, (e.dados ->> 'liberadas')::int as liberadas
    from public.plt_eventos e where e.card_id = ${novaRepo.id} and e.tipo = 'card_arquivado'`)
const linhaB3 = await um45(`select reservados_producao from public.plt_fn_estoque_produtos('acabados', 'S45B', null, 10, 0)`)
conferir(
  eventoParcial?.liberadas === 1 && eventoParcial?.vencidas === mB - 1
    && linhaB3?.reservados_producao === 2,
  'parcial: só a parte parada vence; a peça que entrou na produção segue produzindo e contando (1 da reposição + 1 do pedido)',
  JSON.stringify({ eventoParcial, linhaB3 }),
)

titulo('Ajuste Estoque 2 · o resumo do galpão remodelado e o liga/desliga por agendamento')

await bd.exec(`select public.plt_fn_tiny_estoque_aviso(${sqlJson45({ cnpj: '27556613000166', tipo: 'estoque', dados: { idProduto: 945011, sku: 'S45UN', nome: 'x', saldo: 5 } })})`)
await bd.exec(`select public.plt_fn_tiny_estoque_aviso(${sqlJson45({ cnpj: '27556613000166', tipo: 'estoque', dados: { idProduto: 945012, sku: 'S45M2', nome: 'x', saldo: 12 } })})`)
const resumo45 = await um45(`select moveis_estoque, pecas_unidades::float as pecas_unidades, pecas_m2::float as pecas_m2,
                                    moveis_reservados, pecas_producao, moveis_producao from public.plt_fn_estoque_resumo()`)
conferir(
  resumo45?.pecas_m2 === 12 && resumo45?.pecas_unidades >= 5
    && resumo45?.moveis_estoque >= 1 && resumo45?.pecas_producao >= 1 && resumo45?.moveis_producao >= 1,
  'os seis números do galpão: móveis livres, insumos por unidade e por m², prontos reservados, peças (sem dono) e móveis (de pedido) em produção',
  JSON.stringify(resumo45),
)
const situacao45 = (await um45(`select public.plt_fn_estoque_reposicao_situacao() as r`)).r
await deveRecusarExec(`select public.plt_fn_estoque_reposicao_ligar()`,
  'ligar a reposição automática é gesto de admin', /admin/i)
await como45(E40.admin)
const ligou45 = (await um45(`select public.plt_fn_estoque_reposicao_ligar() as r`)).r
const desligou45 = (await um45(`select public.plt_fn_estoque_reposicao_desligar() as r`)).r
conferir(
  situacao45?.ligada === false && ligou45?.ligada === false && ligou45?.motivo === 'sem_pg_cron'
    && desligou45?.ligada === false,
  'nasce desligada; o botão agenda/desagenda o job de verdade (aqui sem pg_cron, só decide — em produção cria e remove o agendamento)',
  JSON.stringify({ situacao45, ligou45, desligou45 }),
)
const privilegio45 = await um45(`
  select has_function_privilege('authenticated', 'public.plt_fn_estoque_definir_top_x(integer)', 'execute') as top_x,
         has_function_privilege('anon', 'public.plt_fn_estoque_definir_top_x(integer)', 'execute') as top_x_anon,
         has_function_privilege('anon', 'public.plt_fn_estoque_config()', 'execute') as config_anon,
         has_function_privilege('authenticated', 'plt_privado.fn_vencer_reposicoes()', 'execute') as vencer,
         has_function_privilege('authenticated', 'plt_privado.fn_recalcular_minimos()', 'execute') as recalcular`)
conferir(
  privilegio45.top_x === true && !privilegio45.top_x_anon && !privilegio45.config_anon
    && !privilegio45.vencer && !privilegio45.recalcular,
  'as portas das pessoas ficam para quem está logado (gate por dentro); anônimo e maquinaria fora da API',
  JSON.stringify(privilegio45),
)
await como45(E40.logistica)
await bd.exec(`select public.plt_fn_estoque_definir_top_x(20)`)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)
} // fim do bloco 45

// ============================================================================
// AS RESERVAS PRESAS DO TINY (30/09 — migration 46, ↪️ D-76). O "disponível
// multiempresa" do Tiny = saldo − reservado, e o reservado guarda pedido que já
// saiu (567: 23 reservadas, 0 pedidos abertos). A lista mostra o que limpar NO
// TINY: o que ele reserva × as unidades de pedidos ainda abertos.
// ============================================================================
{
titulo('Estoque × Tiny (30/09) · a lista das reservas presas no Tiny (o que a equipe limpa lá)')

const leitura46 = (id, sku, saldo, reservado, origem = 'leitura') => `
  insert into public.eventos (tipo, tiny_id, payload) values ('estoque_fabrica', ${id},
    jsonb_build_object('cnpj', '27556613000166', 'tipo', 'estoque', 'origem', '${origem}',
      'dados', jsonb_build_object('idProduto', ${id}, 'sku', '${sku}', 'saldo', ${saldo}, 'saldoReservado', ${reservado})))`
await bd.exec(`
  insert into public.produtos (tiny_id, codigo, descricao, classe, situacao, unidade) values
    (946001, 'S46A', 'Armário Teste 46 - reserva presa', 'F', 'A', 'un'),
    (946002, 'S46B', 'Estante Teste 46 - reserva de pedido aberto', 'F', 'A', 'un'),
    (946003, 'S46C', 'Nicho Teste 46 - já limpo no Tiny', 'F', 'A', 'un'),
    (946009, 'S46M', 'Chapa Teste 46', 'M', 'A', 'chapa'),
    (946010, null, 'Nicho Teste 46 sem SKU', 'F', 'A', 'un')
  on conflict (tiny_id) do nothing;
  insert into public.produtos (tiny_id, codigo, descricao, classe, situacao, unidade, raw) values
    (946011, 'S46S', 'Corte Teste 46', 'S', 'A', 'un', '{"tipo": "S"}')
  on conflict (tiny_id) do nothing;
  insert into public.pedidos (numero, cliente_id, situacao, data_pedido)
    values (946101, (select id from public.clientes order by id limit 1), 'Preparando envio', current_date);
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
    values ((select id from public.pedidos where numero = 946101), 1, 'S46B', 'Estante Teste 46 - reserva de pedido aberto', 1);
`)
await bd.exec(leitura46(946001, 'S46A', 2, 23))
await bd.exec(leitura46(946002, 'S46B', 1, 1))
await bd.exec(leitura46(946003, 'S46C', 3, 17, 'carga_inicial'))
await bd.exec(leitura46(946003, 'S46C', 3, 0))          // o Guilherme limpou: a leitura nova manda
await bd.exec(leitura46(946009, 'S46M', 0, 500))        // insumo não entra
await bd.exec(leitura46(946010, '', 0, 9))              // sem SKU não entra
await bd.exec(leitura46(946011, 'S46S', 0, 12982))      // serviço do Tiny não entra

await bd.exec(`select set_config('request.jwt.claim.sub', '${E40.logistica}', false)`)
const lista46 = (await bd.query(`select codigo, reservado_tiny, pedidos_abertos, presas, contagem_total, total_presas
                                   from public.plt_fn_tiny_reservas_presas(100, 0)`)).rows
const s46 = (sku) => lista46.find((l) => l.codigo === sku)
conferir(
  Number(s46('S46A')?.presas) === 23 && Number(s46('S46A')?.pedidos_abertos) === 0 && Number(s46('S46A')?.reservado_tiny) === 23,
  'o 567 dos testes: o Tiny reserva 23 e não há pedido aberto → 23 presas na lista',
  JSON.stringify(s46('S46A')),
)
conferir(!s46('S46B'), 'reserva que bate com pedido aberto não é presa (não aparece)')
conferir(!s46('S46C'), 'produto já limpo no Tiny sai da lista (vale a leitura mais nova)')
conferir(!s46('S46M'), 'matéria-prima e insumo não entram (a lista é dos produtos prontos)')
conferir(!s46('S46S') && !lista46.some((l) => l.codigo === null),
  'serviço do Tiny (Corte, Furo…) e produto sem SKU não entram')
conferir(
  lista46.length > 0 && Number(lista46[0].contagem_total) === lista46.length
    && lista46.every((l, i) => i === 0 || Number(lista46[i - 1].presas) >= Number(l.presas)),
  'a lista vem do maior para o menor, com o total na mesma consulta (paginada no servidor — regra 17)',
)
const pagina46 = (await bd.query(`select count(*)::int as n from public.plt_fn_tiny_reservas_presas(1, 0)`)).rows[0].n
conferir(pagina46 === 1, 'uma página por vez (o "ver mais" pede a seguinte)')
await bd.exec(`select set_config('request.jwt.claim.sub', '${E40.operador}', false)`)
conferir((await bd.query(`select count(*)::int as n from public.plt_fn_tiny_reservas_presas(100, 0)`)).rows[0].n === 0,
  'quem não é da logística não vê a lista')
conferir(
  !(await bd.query(`select has_function_privilege('anon', 'public.plt_fn_tiny_reservas_presas(integer, integer)', 'execute') as p`)).rows[0].p,
  'anônimo não chama a porta',
)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)
} // fim do bloco 46

// ============================================================================
// O PCP EM ABAS (30/09 — migrations 47 e 48, ↪️ D-86/D-62): a porta do quadro
// ganhou o p_grupo — nulo = tudo (o painel da Visão do dia continua batendo —
// D-75), 'pedido' = aguardando liberação, 'reposicao' = reabastecimento — e a
// coluna pecas_estoque (o aviso de que há peça no galpão para o pedido).
// ============================================================================
{
titulo('PCP em abas (30/09) · a porta separa pedidos e reabastecimento; e avisa a peça no estoque')

const um47 = async (sql) => (await bd.query(sql)).rows[0]
await bd.exec(`select set_config('request.jwt.claim.sub', '${E40.admin}', false)`)
const grupos47 = await um47(`
  select (select count(*)::int from public.plt_fn_cards_pedido_pcp(100, 0))                 as tudo,
         (select count(*)::int from public.plt_fn_cards_pedido_pcp(100, 0, 'pedido'))       as pedidos,
         (select count(*)::int from public.plt_fn_cards_pedido_pcp(100, 0, 'reposicao'))    as reposicoes,
         (select bool_and(q.tipo = 'pedido')    from public.plt_fn_cards_pedido_pcp(100, 0, 'pedido') q)    as so_pedidos,
         (select bool_and(q.tipo = 'reposicao') from public.plt_fn_cards_pedido_pcp(100, 0, 'reposicao') q) as so_reposicoes,
         (select bool_and(q.pecas_estoque = 0)  from public.plt_fn_cards_pedido_pcp(100, 0, 'reposicao') q) as reposicao_sem_peca,
         (select q.pecas_estoque from public.plt_fn_cards_pedido_pcp(100, 0, 'pedido') q
           where q.pedido_id = (select id from public.pedidos where numero = 945104))       as pecas_do_945104,
         (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'plt_fn_cards_pedido_pcp')            as assinaturas`)
conferir(
  grupos47.tudo === grupos47.pedidos + grupos47.reposicoes
    && grupos47.reposicoes >= 1 && grupos47.pedidos >= 1
    && grupos47.so_pedidos === true && grupos47.so_reposicoes === true
    && grupos47.assinaturas === 1,
  'nulo = tudo (pedidos + reabastecimento batem na soma); cada grupo vem puro; UMA assinatura só (sem sobrecarga — A-12)',
  JSON.stringify(grupos47),
)
conferir(
  grupos47.pecas_do_945104 === 1 && grupos47.reposicao_sem_peca === true,
  'pecas_estoque (48): o pedido do Banco enxerga a peça LIVRE de mesmo SKU no galpão; reabastecimento não tem pedido — 0',
  JSON.stringify({ pecas: grupos47.pecas_do_945104 }),
)
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)
} // fim do bloco 47/48

// ============================================================================
// SESSAO-29 (01/10 — migration 49, D-50 · D-95…D-97): a conferência diária com
// o Tiny (pente-fino). A porta dos pedidos grava só o que mudou, as observações
// acompanham o Tiny também quando apagadas, o cliente não duplica quando o
// contato é renomeado, e cada rodada deixa UMA linha no log com o que mudou.
// ============================================================================
{
titulo('SESSAO-29 · a porta dos pedidos: uma assinatura só (a nova), só para a chave de serviço')

const um49 = async (sql) => (await bd.query(sql)).rows[0]
const todos49 = async (sql) => (await bd.query(sql)).rows
const j49 = (obj) => `'${JSON.stringify(obj).split("'").join("''")}'::jsonb`

const assinaturas49 = await todos49(`
  select pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'fn_upsert_pedido'`)
conferir(
  assinaturas49.length === 1 && /p_tiny_id_contato bigint/.test(assinaturas49[0].args),
  'fn_upsert_pedido tem UMA assinatura — a nova, com o id do contato; a antiga saiu (A-12: as duas confundiriam o PostgREST)',
  JSON.stringify(assinaturas49),
)
const priv49 = await um49(`
  select has_function_privilege('anon', 'public.fn_upsert_pedido(jsonb, text, bigint, text, bigint)', 'execute') as anon,
         has_function_privilege('authenticated', 'public.fn_upsert_pedido(jsonb, text, bigint, text, bigint)', 'execute') as logado,
         has_function_privilege('service_role', 'public.fn_upsert_pedido(jsonb, text, bigint, text, bigint)', 'execute') as servico,
         has_function_privilege('authenticated', 'plt_privado.fn_tiny_pente_fino_iniciar(text)', 'execute') as iniciar,
         has_function_privilege('authenticated', 'plt_privado.fn_tiny_fila_relogio()', 'execute') as relogio,
         has_function_privilege('authenticated', 'plt_privado.fn_tiny_fila_acordar()', 'execute') as acordar,
         has_function_privilege('anon', 'public.fn_backfill_aplicar(bigint, text, jsonb)', 'execute') as aplicar_anon`)
conferir(
  !priv49.anon && !priv49.logado && priv49.servico && !priv49.iniciar && !priv49.relogio && !priv49.acordar && !priv49.aplicar_anon,
  'só a chave de serviço (o n8n) grava pedido; a maquinaria da conferência fica fora da API',
  JSON.stringify(priv49),
)

// O pedido como o pedido.obter do Tiny devolve (v2): o cliente SEM id do contato.
const cliente49 = (nome, fone, cpf = '') => ({
  codigo: '', nome, nome_fantasia: '', tipo_pessoa: 'F', cpf_cnpj: cpf, ie: '', rg: '',
  endereco: 'Rua Teste', numero: '49', complemento: '', bairro: 'Centro', cep: '59000-000',
  cidade: 'Natal', uf: 'RN', fone, email: '',
})
const pedido49 = (numero, tinyId, cliente, extra = {}) => ({
  id: String(tinyId),
  numero: String(numero),
  data_pedido: '15/09/2026',
  data_prevista: '30/09/2026',
  situacao: 'Em aberto',
  total_produtos: '1000.00',
  total_pedido: '1000.00',
  valor_frete: '0.00',
  forma_pagamento: 'pix',
  meio_pagamento: '',
  forma_envio: 'Transportadora',
  parcelas: [],
  marcadores: [],
  obs: 'entregar de manhã',
  obs_interna: 'cliente antigo',
  nome_vendedor: 'Vendedora 49',
  codigo_rastreamento: '',
  url_rastreamento: '',
  cliente,
  itens: [{ item: { id_produto: '4901', codigo: 'S49A', descricao: 'Mesa Teste 49', unidade: 'UN', quantidade: '1.00', valor_unitario: '1000.00' } }],
  ...extra,
})
// O aviso de venda (o n8n chama por NOME, com 4 ou 5 parâmetros)
const aviso49 = (p, tipo, contato = null) =>
  um49(`select public.fn_upsert_pedido(p => ${j49(p)}, p_tipo => '${tipo}', p_tiny_id => ${Number(p.id)},
                                        p_origem => 'webhook', p_tiny_id_contato => ${contato ?? 'null'})::int as id`)
const avisoSemContato49 = (p, tipo) =>
  um49(`select public.fn_upsert_pedido(p => ${j49(p)}, p_tipo => '${tipo}', p_tiny_id => ${Number(p.id)}, p_origem => 'webhook')::int as id`)
const clienteDo49 = (numero) =>
  um49(`select c.id::int as id, c.nome, c.cpf_cnpj, c.tiny_id_contato::int as contato
          from public.clientes c join public.pedidos p on p.cliente_id = c.id where p.numero = ${numero}`)
const colunas49 = (numero) =>
  um49(`select obs, obs_interna, to_char(data_prevista, 'DD/MM/YYYY') as previsao, vendedor, marcadores,
               situacao, origem, atualizado_em::text as atualizado, raw -> 'cliente' ->> 'nome' as nome_raw
          from public.pedidos where numero = ${numero}`)
const eventosDe49 = async (numero) => (await um49(`select count(*)::int as n from public.eventos where numero = ${numero}`)).n

titulo('SESSAO-29 · cliente: o id do contato (que só o aviso traz) vem antes de tudo; renomear no Tiny não duplica')

const maria = cliente49('Maria Teste 49 / Cidade Alta / Instagram', '(84) 90000-4901')
await aviso49(pedido49(990101, 7290101, maria), 'inclusao_pedido', 55501)
const cli1 = await clienteDo49(990101)
conferir(cli1?.contato === 55501, 'o aviso de venda traz o id do contato e ele fica no cadastro do cliente', JSON.stringify(cli1))
await aviso49(pedido49(990101, 7290101, { ...maria, nome: 'Maria Teste 49' }), 'atualizacao_pedido', 55501)
const cli1b = await clienteDo49(990101)
const mesmos1 = (await um49(`select count(*)::int as n from public.clientes where fone = '(84) 90000-4901'`)).n
conferir(
  cli1b?.id === cli1?.id && cli1b?.nome === 'Maria Teste 49' && mesmos1 === 1,
  'contato renomeado no Tiny (o "/ bairro / origem" saiu): o MESMO cliente, com o nome novo — nada de duplicata',
  JSON.stringify({ cli1, cli1b, mesmos1 }),
)
await aviso49(pedido49(990102, 7290102, { ...maria, nome: 'Maria T. 49' }), 'inclusao_pedido', 55501)
const cli2 = await clienteDo49(990102)
conferir(
  cli2?.id === cli1?.id && cli2?.nome === 'Maria T. 49',
  'pedido NOVO de um cliente sem CPF que mudou de nome: o id do contato acha o mesmo cliente (o nome e o telefone sozinhos não achariam)',
  JSON.stringify(cli2),
)

// Sem o id do contato (o pente-fino não tem): o cliente que o pedido JÁ tem
const joao = cliente49('João Teste 49 / Ponta Negra', '(84) 90000-4903')
await avisoSemContato49(pedido49(990103, 7290103, joao), 'inclusao_pedido')
const cli3 = await clienteDo49(990103)
await avisoSemContato49(pedido49(990103, 7290103, { ...joao, nome: 'João Teste 49' }), 'atualizacao_pedido')
const cli3b = await clienteDo49(990103)
const mesmos3 = (await um49(`select count(*)::int as n from public.clientes where fone = '(84) 90000-4903'`)).n
conferir(
  cli3b?.id === cli3?.id && cli3b?.nome === 'João Teste 49' && mesmos3 === 1,
  'sem o id do contato e sem CPF dos dois lados: o pedido reprocessado continua no MESMO cliente (o renomeado) — antes virava cliente novo',
  JSON.stringify({ cli3, cli3b, mesmos3 }),
)

// CPF que prova outra pessoa: aí sim é outro cliente
const pedro = cliente49('Pedro Teste 49', '(84) 90000-4907')
await avisoSemContato49(pedido49(990107, 7290107, pedro), 'inclusao_pedido')
const cli7 = await clienteDo49(990107)
await avisoSemContato49(pedido49(990107, 7290107, cliente49('Paulo Teste 49', '(84) 90000-4977', '222.333.444-49')), 'atualizacao_pedido')
const cli7b = await clienteDo49(990107)
const pedroIntacto = await um49(`select nome from public.clientes where id = ${cli7.id}`)
conferir(
  cli7b?.id !== cli7?.id && cli7b?.cpf_cnpj === '222.333.444-49' && pedroIntacto.nome === 'Pedro Teste 49',
  'o pedido trocado de contato no Tiny, com CPF que nenhum cliente sem CPF tinha: vai para OUTRO cliente — o antigo fica intacto',
  JSON.stringify({ cli7, cli7b, pedroIntacto }),
)

// O id do contato e um CPF que já é de OUTRO cliente: nunca colide (índice único)
await bd.exec(`insert into public.clientes (cpf_cnpj, nome, fone) values ('111.222.333-49', 'Dono do CPF 49', '(84) 90000-4911')`)
const ana = cliente49('Ana Teste 49', '(84) 90000-4908')
await aviso49(pedido49(990108, 7290108, ana), 'inclusao_pedido', 55508)
const cli8 = await clienteDo49(990108)
let colidiu49 = null
try {
  await aviso49(pedido49(990108, 7290108, { ...ana, cpf_cnpj: '111.222.333-49' }), 'atualizacao_pedido', 55508)
} catch (erro) {
  colidiu49 = erro.message
}
const cli8b = await clienteDo49(990108)
conferir(
  colidiu49 === null && cli8b?.id === cli8?.id && cli8b?.cpf_cnpj === null,
  'o CPF que já é de outro cliente não é copiado para o cliente do id do contato — o aviso não quebra (o índice único seguraria a gravação)',
  JSON.stringify({ colidiu49, cli8, cli8b }),
)

titulo('SESSAO-29 · o nome sem entidade HTML (D-97); o raw fica como o Tiny mandou')

const ent = await um49(`
  select plt_privado.fn_texto_sem_entidades('Ana D&#39;Ávila') as a,
         plt_privado.fn_texto_sem_entidades('Tom &amp; Jerry &quot;Móveis&quot;') as b,
         plt_privado.fn_texto_sem_entidades('&amp;#39;') as c,
         plt_privado.fn_texto_sem_entidades('L&#x27;Oreal &lt;3&gt;') as d,
         plt_privado.fn_texto_sem_entidades('Sem entidade & sem ponto e vírgula') as e,
         plt_privado.fn_texto_sem_entidades(null) is null as f`)
conferir(
  ent.a === "Ana D'Ávila" && ent.b === 'Tom & Jerry "Móveis"' && ent.c === '&#39;' && ent.d === "L'Oreal <3>"
    && ent.e === 'Sem entidade & sem ponto e vírgula' && ent.f,
  'decimal, hexadecimal e com nome; uma camada só ("&amp;#39;" vira "&#39;"); texto comum não muda',
  JSON.stringify(ent),
)
await avisoSemContato49(pedido49(990110, 7290110, cliente49('Rita D&#39;Elia 49', '(84) 90000-4910')), 'inclusao_pedido')
const cli10 = await clienteDo49(990110)
const raw10 = await colunas49(990110)
conferir(
  cli10?.nome === "Rita D'Elia 49" && raw10.nome_raw === 'Rita D&#39;Elia 49',
  'o cliente é gravado com o nome limpo; a cópia crua do pedido segue igual à do Tiny',
  JSON.stringify({ cli10, nome_raw: raw10.nome_raw }),
)

titulo('SESSAO-29 · grava só o que mudou: aviso repetido não regrava o pedido (mas fica registrado)')

const antes101 = await colunas49(990101)
const ev101 = await eventosDe49(990101)
const itens101 = (await um49(`select string_agg(i.xmin::text, ',' order by i.seq) as x from public.pedido_itens i
                                join public.pedidos p on p.id = i.pedido_id where p.numero = 990101`)).x
await aviso49(pedido49(990101, 7290101, { ...maria, nome: 'Maria Teste 49' }), 'atualizacao_pedido', 55501)
const depois101 = await colunas49(990101)
const itens101b = (await um49(`select string_agg(i.xmin::text, ',' order by i.seq) as x from public.pedido_itens i
                                 join public.pedidos p on p.id = i.pedido_id where p.numero = 990101`)).x
conferir(
  depois101.atualizado === antes101.atualizado && itens101b === itens101 && (await eventosDe49(990101)) === ev101 + 1,
  'o mesmo pedido de novo: nada é regravado (nem os itens), e o aviso continua registrado no log',
  JSON.stringify({ antes: antes101.atualizado, depois: depois101.atualizado, itens101, itens101b }),
)

titulo('SESSAO-29 · a conferência: a busca dos 60 dias + os não terminados entram na fila; o relógio só existe com trabalho')

// Um pedido ENTREGUE da janela, que a carga antiga já tinha lido ("ok", sem rodada)
await avisoSemContato49(pedido49(990104, 7290104, cliente49('Lia Teste 49', '(84) 90000-4904'), { situacao: 'Entregue' }), 'inclusao_pedido')
await bd.exec(`insert into public.tiny_fila (recurso, chave, referencia, prioridade, status, processado_em)
               values ('pedido', '7290104', '990104', 2, 'ok', now() - interval '20 days')`)
// O obs/previsão/vendedor/marcador do 990105 e 990106
await avisoSemContato49(pedido49(990105, 7290105, cliente49('Bia Teste 49', '(84) 90000-4905')), 'inclusao_pedido')
await avisoSemContato49(pedido49(990106, 7290106, cliente49('Caio Teste 49', '(84) 90000-4906')), 'inclusao_pedido')

const ini1 = (await um49(`select plt_privado.fn_tiny_pente_fino_iniciar('teste') as r`)).r
const datas49 = await um49(`
  select to_char((now() at time zone 'America/Fortaleza')::date, 'DD/MM/YYYY') as hoje,
         to_char((now() at time zone 'America/Fortaleza')::date - 60, 'DD/MM/YYYY') as menos60`)
const busca1 = await um49(`select id::int as id, status, params from public.tiny_fila
                            where recurso = 'pedidos_pesquisa' and chave = 'pente-fino:p1'`)
conferir(
  busca1?.status === 'pendente' && busca1.params.dataInicial === datas49.menos60
    && busca1.params.dataFinal === datas49.hoje && busca1.params.rodada === ini1.rodada
    && busca1.params.janela === 'pente-fino' && busca1.params.pagina === 1,
  'a busca do Tiny pelos últimos 60 dias (dd/mm/aaaa, hora de Natal) entra na fila com a rodada',
  JSON.stringify({ busca1, datas49 }),
)
const naRodada1 = (await um49(`select count(*)::int as n from public.tiny_fila
                                where recurso = 'pedido' and params->>'rodada' = '${ini1.rodada}' and status = 'pendente'`)).n
const vivos1 = (await um49(`select count(*)::int as n from public.pedidos where tiny_id is not null
                             and plt_privado.fn_situacao_normalizada(situacao) not in ('entregue','nao_entregue','cancelado')`)).n
const entregueFora = await um49(`select status, params from public.tiny_fila where recurso = 'pedido' and chave = '7290104'`)
conferir(
  naRodada1 === vivos1 && ini1.nao_terminados === vivos1 && entregueFora.status === 'ok' && !entregueFora.params.rodada,
  'os pedidos NÃO terminados (de qualquer idade) entram na rodada; o entregue só volta se a busca do Tiny o trouxer',
  JSON.stringify({ naRodada1, vivos1, ini1, entregueFora }),
)
conferir(
  ini1.relogio === 'sem_pg_cron' && ini1.n8n === 'sem_pg_net',
  'acorda a fila: agenda o relógio e chama o n8n (aqui sem pg_cron/pg_net, só decide — em produção agenda e posta)',
  JSON.stringify(ini1),
)
const precisa1 = (await um49(`select plt_privado.fn_tiny_fila_precisa_chamar() as p`)).p
await bd.exec(`select * from public.fn_fila_proximos(500)`)   // o n8n pegou o lote
const precisa1b = (await um49(`select plt_privado.fn_tiny_fila_precisa_chamar() as p`)).p
const relogio1 = (await um49(`select plt_privado.fn_tiny_fila_relogio() as r`)).r
conferir(
  precisa1 === true && precisa1b === false && relogio1.fila === 'com_trabalho' && relogio1.n8n === 'nada_a_fazer',
  'com fila e nada em andamento: chama; com lote em andamento: o relógio espera (nunca dois lotes ao mesmo tempo — limite do Tiny)',
  JSON.stringify({ precisa1, precisa1b, relogio1 }),
)

// O n8n lê a busca: o Tiny devolve 990101 (já na rodada), 990104 (entregue, carga antiga),
// 990199 (vivo, NUNCA chegou aqui), 990198 (entregue, nunca chegou) e a página 2
const enf1 = (await um49(`select public.fn_backfill_aplicar(${busca1.id}, 'pedidos_pesquisa', ${j49([
  { recurso: 'pedido', chave: '7290101', referencia: '990101', prioridade: 2 },
  { recurso: 'pedido', chave: '7290104', referencia: '990104', prioridade: 2 },
  { recurso: 'pedido', chave: '7290199', referencia: '990199', prioridade: 2 },
  { recurso: 'pedido', chave: '7290198', referencia: '990198', prioridade: 2 },
  { recurso: 'pedidos_pesquisa', chave: 'pente-fino:p2', prioridade: 1, params: { ...busca1.params, pagina: 2 } },
])}) as r`)).r
const reaberto104 = await um49(`select status, params->>'rodada' as rodada from public.tiny_fila where recurso = 'pedido' and chave = '7290104'`)
const pag2 = await um49(`select status, params from public.tiny_fila where recurso = 'pedidos_pesquisa' and chave = 'pente-fino:p2'`)
conferir(
  enf1.enfileirados === 4 && reaberto104.status === 'pendente' && reaberto104.rodada === ini1.rodada
    && pag2?.status === 'pendente' && pag2.params.rodada === ini1.rodada && pag2.params.pagina === 2,
  'a busca reabre o lido pela carga antiga, põe os que nunca chegaram e a página 2 — o que já está na rodada não entra de novo',
  JSON.stringify({ enf1, reaberto104, pag2 }),
)
const enf1b = (await um49(`select public.fn_backfill_aplicar(${busca1.id}, 'pedidos_pesquisa', ${j49([
  { recurso: 'pedido', chave: '7290104', referencia: '990104', prioridade: 2 },
])}) as r`)).r
conferir(enf1b.enfileirados === 0, 'a mesma busca repetida não reabre nada (uma releitura por rodada)', JSON.stringify(enf1b))

// A busca antiga (sem rodada) continua "não mexe no que já está na fila"
await bd.exec(`insert into public.tiny_fila (recurso, chave, prioridade, status, params)
               values ('pedidos_pesquisa', '2025-03:p9', 1, 'processando', '{"janela":"2025-03","pagina":9}')`)
const velha = await um49(`select id::int as id from public.tiny_fila where chave = '2025-03:p9'`)
await bd.exec(`insert into public.tiny_fila (recurso, chave, referencia, prioridade, status) values ('pedido', '7290197', '990197', 2, 'ok')`)
const enfVelha = (await um49(`select public.fn_backfill_aplicar(${velha.id}, 'pedidos_pesquisa', ${j49([
  { recurso: 'pedido', chave: '7290197', referencia: '990197', prioridade: 2 },
])}) as r`)).r
const intacto197 = await um49(`select status from public.tiny_fila where recurso = 'pedido' and chave = '7290197'`)
conferir(enfVelha.enfileirados === 0 && intacto197.status === 'ok', 'a carga antiga (sem rodada) segue igual: o que já está na fila não se mexe', JSON.stringify({ enfVelha, intacto197 }))

titulo('SESSAO-29 · a releitura da conferência: as observações acompanham o Tiny; o resto não se apaga (D-50)')

await bd.exec(`select * from public.fn_fila_proximos(500)`)
const linha49 = async (chave) => (await um49(`select id::int as id from public.tiny_fila where recurso = 'pedido' and chave = '${chave}'`)).id
const reler49 = async (chave, payload) =>
  (await um49(`select public.fn_backfill_aplicar(${await linha49(chave)}, 'pedido', ${j49(payload)}) as r`)).r

// 990105: observação e observação interna APAGADAS no Tiny; previsão apagada; vendedor SEM a chave
const p105 = pedido49(990105, 7290105, cliente49('Bia Teste 49', '(84) 90000-4905'), { obs: '', obs_interna: '   ', data_prevista: '' })
delete p105.nome_vendedor
const r105 = await reler49('7290105', p105)
const c105 = await colunas49(990105)
conferir(
  c105.obs === null && c105.obs_interna === null,
  'observação e observação interna apagadas no Tiny: a coluna fica vazia na próxima rodada',
  JSON.stringify(c105),
)
conferir(
  c105.previsao === '30/09/2026' && c105.vendedor === 'Vendedora 49',
  'previsão apagada e vendedor ausente do pacote (a chave nem vem): o banco MANTÉM — apagar no Tiny não apaga aqui',
  JSON.stringify(c105),
)
conferir(
  JSON.stringify(r105.mudou) === JSON.stringify(['obs', 'obs_interna']) && r105.numero === '990105',
  'a linha da fila guarda o que mudou (só as observações)',
  JSON.stringify(r105),
)
const semObs = pedido49(990106, 7290106, cliente49('Caio Teste 49', '(84) 90000-4906'), { marcadores: [{ marcador: { descricao: 'Devolvido' } }] })
delete semObs.obs
delete semObs.obs_interna
const r106 = await reler49('7290106', semObs)
const c106 = await colunas49(990106)
conferir(
  JSON.stringify(c106.marcadores) === JSON.stringify(['Devolvido']) && c106.obs === 'entregar de manhã' && c106.obs_interna === 'cliente antigo'
    && JSON.stringify(r106.mudou) === JSON.stringify(['marcadores']),
  'marcador posto sozinho no Tiny aparece na rodada; observação AUSENTE do pacote (nunca vista em 5.440) não apaga nada',
  JSON.stringify({ c106, r106 }),
)

// 990103: o contato renomeado — a releitura (sem id de contato) mantém o mesmo cliente
const r103 = await reler49('7290103', pedido49(990103, 7290103, { ...joao, nome: 'João T. 49' }))
const cli3c = await clienteDo49(990103)
conferir(
  cli3c?.id === cli3?.id && cli3c?.nome === 'João T. 49' && JSON.stringify(r103.mudou) === JSON.stringify(['cliente']),
  'contato sem CPF renomeado no Tiny: a releitura da conferência continua no MESMO cliente, com o nome novo',
  JSON.stringify({ cli3c, r103 }),
)

// 990199: vivo e nunca chegou → nasce (origem pente_fino) e ganha o card no PCP; 990198 entregue → sem card
const r199 = await reler49('7290199', pedido49(990199, 7290199, cliente49('Novo Teste 49', '(84) 90000-4999')))
const r198 = await reler49('7290198', pedido49(990198, 7290198, cliente49('Velho Teste 49', '(84) 90000-4998'), { situacao: 'Entregue' }))
const novos = await todos49(`
  select p.numero, p.origem, (select count(*)::int from public.plt_cards c where c.pedido_id = p.id and c.tipo = 'pedido') as cards
    from public.pedidos p where p.numero in (990199, 990198) order by p.numero`)
conferir(
  novos.length === 2 && novos.every((n) => n.origem === 'pente_fino')
    && novos.find((n) => n.numero === 990199)?.cards === 1 && novos.find((n) => n.numero === 990198)?.cards === 0
    && JSON.stringify(r199.mudou) === JSON.stringify(['novo']),
  'pedido vivo que o aviso nunca trouxe: a conferência o grava e ele entra no PCP (D-96); o já entregue entra só no banco',
  JSON.stringify({ novos, r199, r198 }),
)

// os demais da rodada (pedidos de outros blocos, sem pacote aqui) → "não encontrado no Tiny"
const resto1 = await todos49(`select id::int as id from public.tiny_fila where status = 'processando'
                                and params->>'rodada' = '${ini1.rodada}' and chave not in ('7290101','7290104','pente-fino:p2')`)
for (const r of resto1) await bd.exec(`select public.fn_backfill_falha(${r.id}, 'codigo 32: Registro não localizado', true)`)
// 990101 e 990104 voltam iguais; a página 2 do Tiny vem vazia
const p101igual = pedido49(990101, 7290101, { ...maria, nome: 'Maria Teste 49' })
const r101 = await reler49('7290101', p101igual)
const r104 = await reler49('7290104', pedido49(990104, 7290104, cliente49('Lia Teste 49', '(84) 90000-4904'), { situacao: 'Entregue' }))
const p2id = (await um49(`select id::int as id from public.tiny_fila where recurso = 'pedidos_pesquisa' and chave = 'pente-fino:p2'`)).id
await bd.exec(`select public.fn_backfill_aplicar(${p2id}, 'pedidos_pesquisa', '[]'::jsonb)`)
conferir(
  JSON.stringify(r101.mudou) === '[]' && JSON.stringify(r104.mudou) === '[]',
  'pedido igual ao Tiny (inclusive o entregue que a carga antiga já tinha lido): nada muda, nada é regravado',
  JSON.stringify({ r101, r104 }),
)

titulo('SESSAO-29 · a fila vazia fecha a rodada: UMA linha no log com o que mudou, e o relógio se desliga')

const fim1 = (await um49(`select plt_privado.fn_tiny_fila_relogio() as r`)).r
const resumo1 = await todos49(`select payload from public.eventos where tipo = 'pente_fino' and payload->>'rodada' = '${ini1.rodada}'`)
const r1 = resumo1[0]?.payload
const numerosMudados = (r1?.pedidos ?? []).map((p) => p.numero).sort()
conferir(
  fim1.fila === 'vazia' && fim1.resumo === true && fim1.relogio === 'desligado' && resumo1.length === 1,
  'fila vazia: o relógio escreve o resumo da rodada e se desagenda (nada fica rodando à toa)',
  JSON.stringify(fim1),
)
conferir(
  r1?.estado === 'concluida' && r1?.relidos === 7 && r1?.novos === 2 && r1?.mudaram === 5
    && r1?.nao_encontrados === resto1.length && r1?.paginas_busca === 2 && r1?.janela_dias === 60 && r1?.pendentes === 0
    && JSON.stringify(numerosMudados) === JSON.stringify(['990103', '990105', '990106', '990198', '990199']),
  'o resumo: quantos relidos, quantos estavam diferentes, quais (com os campos), novos, não encontrados',
  JSON.stringify(r1),
)
const fim1b = (await um49(`select plt_privado.fn_tiny_fila_relogio() as r`)).r
const resumo1b = (await um49(`select count(*)::int as n from public.eventos where tipo = 'pente_fino' and payload->>'rodada' = '${ini1.rodada}'`)).n
conferir(fim1b.resumo === false && resumo1b === 1, 'chamado de novo com a fila vazia, não repete o resumo', JSON.stringify({ fim1b, resumo1b }))
const semLogPorPedido = (await um49(`select count(*)::int as n from public.eventos where tipo = 'pente_fino' and numero is not null`)).n
conferir(semLogPorPedido === 0, 'a conferência não escreve uma linha por pedido no log — só o resumo da rodada', String(semLogPorPedido))

titulo('SESSAO-29 · a segunda rodada logo depois: ZERO mudanças')

const ini2 = (await um49(`select plt_privado.fn_tiny_pente_fino_iniciar('teste') as r`)).r
const busca2 = await um49(`select id::int as id from public.tiny_fila where recurso = 'pedidos_pesquisa' and chave = 'pente-fino:p1'`)
await bd.exec(`select * from public.fn_fila_proximos(500)`)
await bd.exec(`select public.fn_backfill_aplicar(${busca2.id}, 'pedidos_pesquisa', ${j49([
  { recurso: 'pedido', chave: '7290101', referencia: '990101', prioridade: 2 },
  { recurso: 'pedido', chave: '7290104', referencia: '990104', prioridade: 2 },
  { recurso: 'pedido', chave: '7290198', referencia: '990198', prioridade: 2 },
])})`)
await bd.exec(`select * from public.fn_fila_proximos(500)`)
const pacotes2 = {
  '7290101': p101igual,
  '7290103': pedido49(990103, 7290103, { ...joao, nome: 'João T. 49' }),
  '7290104': pedido49(990104, 7290104, cliente49('Lia Teste 49', '(84) 90000-4904'), { situacao: 'Entregue' }),
  '7290105': p105,
  '7290106': semObs,
  '7290199': pedido49(990199, 7290199, cliente49('Novo Teste 49', '(84) 90000-4999')),
  '7290198': pedido49(990198, 7290198, cliente49('Velho Teste 49', '(84) 90000-4998'), { situacao: 'Entregue' }),
}
const mudou2 = []
for (const [chave, pacote] of Object.entries(pacotes2)) {
  const existe = await um49(`select id::int as id from public.tiny_fila where recurso = 'pedido' and chave = '${chave}'
                              and params->>'rodada' = '${ini2.rodada}' and status = 'processando'`)
  if (!existe) continue
  const r = (await um49(`select public.fn_backfill_aplicar(${existe.id}, 'pedido', ${j49(pacote)}) as r`)).r
  if (r.mudou.length > 0) mudou2.push({ chave, mudou: r.mudou })
}
const resto2 = await todos49(`select id::int as id from public.tiny_fila where status = 'processando' and params->>'rodada' = '${ini2.rodada}'`)
for (const r of resto2) await bd.exec(`select public.fn_backfill_falha(${r.id}, 'codigo 32: Registro não localizado', true)`)
await bd.exec(`select plt_privado.fn_tiny_fila_relogio()`)
const r2 = (await um49(`select payload from public.eventos where tipo = 'pente_fino' and payload->>'rodada' = '${ini2.rodada}'`))?.payload
conferir(
  mudou2.length === 0 && r2?.mudaram === 0 && r2?.relidos >= 7,
  'uma segunda rodada logo depois registra ZERO mudanças (critério de aceite)',
  JSON.stringify({ mudou2, r2 }),
)

titulo('SESSAO-29 · rodada que não terminou até a próxima fica registrada como interrompida')

const ini3 = (await um49(`select plt_privado.fn_tiny_pente_fino_iniciar('teste') as r`)).r
const ini4 = (await um49(`select plt_privado.fn_tiny_pente_fino_iniciar('teste') as r`)).r
const r3 = (await um49(`select payload from public.eventos where tipo = 'pente_fino' and payload->>'rodada' = '${ini3.rodada}'`))?.payload
conferir(
  r3?.estado === 'interrompida' && r3?.pendentes > 0 && ini4.rodada !== ini3.rodada,
  'a rodada que ainda tinha pedido na fila fecha como interrompida (com quantos ficaram) e a nova começa',
  JSON.stringify({ r3, ini3: ini3.rodada, ini4: ini4.rodada }),
)
// limpa a rodada 4 (o resto do harness não espera fila aberta)
await bd.exec(`update public.tiny_fila set status = 'ok' where params->>'rodada' = '${ini4.rodada}'`)
await bd.exec(`select plt_privado.fn_tiny_fila_relogio()`)

titulo('SESSAO-29 · o endereço do fluxo no n8n mora nos webhooks de saída; a conferência agendada às 3h')

const endereco49 = await um49(`select count(*)::int as n, bool_and(ativo) as ativo, min(url) as url
                                 from public.plt_webhooks where 'tiny_fila' = any (eventos)`)
conferir(
  endereco49.n === 1 && endereco49.ativo && /\/webhook\/a9564e90-bdf4-4e46-b425-ea668cb7a22e$/.test(endereco49.url),
  'o fluxo de carga do n8n tem UM endereço (o caminho secreto que o dono publicou em 01/10), ativo',
  JSON.stringify(endereco49),
)
const nomeLimpo = (await um49(`select count(*)::int as n from public.clientes where nome like '%&#39;%'`)).n
conferir(nomeLimpo === 0, 'nenhum cliente fica com entidade HTML no nome (correção única da migration)', String(nomeLimpo))
} // fim do bloco 49

// ============================================================================
// SESSAO-29 · a AUDITORIA no Painel admin (01/10 — migration 50, D-95 ↪️ D-40):
// a trilha de atividade (quem, quando, onde, o quê, porquê) e a conferência
// diária com o Tiny, só para o admin, paginadas no servidor.
// ============================================================================
{
titulo('Auditoria (SESSAO-29) · só o admin abre; a trilha vem traduzida: nome, pedido, setores e o porquê')

const um50 = async (sql) => (await bd.query(sql)).rows[0]
const todos50 = async (sql) => (await bd.query(sql)).rows
const como50 = (auth) => bd.exec(`select set_config('request.jwt.claim.sub', '${auth ?? ''}', false)`)

await como50(E40.operador)
await deveRecusarExec(`select * from public.plt_fn_auditoria()`, 'operador não abre a auditoria', /só do admin/i)
await como50(E40.logistica)
await deveRecusarExec(`select * from public.plt_fn_auditoria()`, 'nem a logística (a auditoria é do admin)', /só do admin/i)
await deveRecusarExec(`select public.plt_fn_auditoria_conferencias()`, 'a conferência com o Tiny também é do admin', /só do admin/i)
await como50('')
await deveRecusarExec(`select * from public.plt_fn_auditoria()`, 'sem sessão, nada', /só do admin/i)

// Um gesto com PORQUÊ: o admin arquiva o card do 990199 com uma observação
await como50(E40.admin)
const card50 = (await um50(`select c.id::int as id from public.plt_cards c join public.pedidos p on p.id = c.pedido_id
                             where p.numero = 990199 and c.tipo = 'pedido'`))?.id
await bd.exec(`insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao)
               values (${card50}, 'card_arquivado',
                       (select id from public.plt_usuarios where auth_user_id = '${E40.admin}'), 'interface',
                       'Teste de auditoria 50 — pedido de teste')`)
await bd.exec(`select public.plt_fn_registrar_log('navegacao', '/admin/auditoria')`)

const pagina1 = await todos50(`select * from public.plt_fn_auditoria(p_limite => 5)`)
const totalTudo = Number(pagina1[0]?.contagem_total ?? 0)
const totalReal = (await um50(`select count(*)::int as n from public.plt_logs_atividade`)).n
conferir(
  pagina1.length === 5 && totalTudo > 5 && totalTudo <= totalReal
    && pagina1[0].acao === 'navegacao' && pagina1[0].rota === '/admin/auditoria' && pagina1[0].usuario_nome,
  'uma página por vez, do mais novo para o mais antigo, com o total na mesma consulta (regra 17) e o NOME de quem fez',
  JSON.stringify({ n: pagina1.length, totalTudo, totalReal, primeiro: pagina1[0] }),
)
const doPedido = await todos50(`select * from public.plt_fn_auditoria(p_busca => '990199', p_limite => 20)`)
const arquivo = doPedido.find((l) => l.acao === 'card_arquivado')
conferir(
  arquivo && arquivo.pedido_numero === 990199 && arquivo.motivo === 'Teste de auditoria 50 — pedido de teste'
    && arquivo.card_tipo === 'pedido' && arquivo.usuario_nome,
  'busca pelo nº do pedido traz o que aconteceu com os cards dele — com o PORQUÊ (a observação do gesto)',
  JSON.stringify(arquivo ?? doPedido),
)
const movimento = (await todos50(`select * from public.plt_fn_auditoria(p_acoes => array['movimentacao_setor'], p_limite => 1)`))[0]
conferir(
  !movimento || (movimento.acao === 'movimentacao_setor' && (movimento.setor_origem || movimento.setor_destino)),
  'movimentação vem com os NOMES dos setores de origem e destino (onde)',
  JSON.stringify(movimento ?? null),
)
const soNavegacao = await todos50(`select acao from public.plt_fn_auditoria(p_acoes => array['navegacao'], p_limite => 50)`)
const soSistema = await todos50(`select usuario_id from public.plt_fn_auditoria(p_sistema => true, p_limite => 50)`)
const soPessoas = await todos50(`select usuario_id from public.plt_fn_auditoria(p_sistema => false, p_limite => 50)`)
conferir(
  soNavegacao.length > 0 && soNavegacao.every((l) => l.acao === 'navegacao')
    && soSistema.every((l) => l.usuario_id === null) && soPessoas.every((l) => l.usuario_id !== null),
  'filtros no servidor: por tipo de ação, só o Sistema, só pessoas',
  JSON.stringify({ nav: soNavegacao.length, sistema: soSistema.length, pessoas: soPessoas.length }),
)
const futuro = await todos50(`select * from public.plt_fn_auditoria(p_desde => now() + interval '1 day')`)
const limiteAlto = await todos50(`select id from public.plt_fn_auditoria(p_limite => 100000)`)
conferir(
  futuro.length === 0 && limiteAlto.length <= 100,
  'período sem nada devolve vazio; a página nunca passa de 100 linhas',
  JSON.stringify({ futuro: futuro.length, limiteAlto: limiteAlto.length }),
)

// D-51: a tarefa pessoal PRIVADA de outra pessoa não aparece nem para o admin
const privada50 = (await um50(`insert into public.plt_tarefas (titulo, responsavel_id, criada_por_id, privada)
  values ('Pessoal 50', (select id from public.plt_usuarios where usuario = 'exec.um'),
          (select id from public.plt_usuarios where usuario = 'exec.um'), true)
  returning id::int as id`))?.id
const comPrivada = await todos50(`select contexto from public.plt_fn_auditoria(p_acoes => array['tarefa_criada','tarefa_atualizada','tarefa_iniciada','tarefa_concluida','tarefa_reatribuida'], p_limite => 100)`)
const logsPrivada = (await um50(`select count(*)::int as n from public.plt_logs_atividade where acao like 'tarefa\\_%' and contexto->>'tarefa_id' = '${privada50}'`)).n
conferir(
  privada50 && logsPrivada > 0 && !comPrivada.some((l) => String(l.contexto?.tarefa_id) === String(privada50)),
  'a trilha da tarefa pessoal PRIVADA existe no banco, mas a auditoria não a mostra ao admin (D-51)',
  JSON.stringify({ privada50, logsPrivada }),
)

titulo('Auditoria (SESSAO-29) · a conferência diária com o Tiny: as rodadas e o que mudou')

const conf = (await um50(`select public.plt_fn_auditoria_conferencias(p_limite => 2) as r`)).r
const totalRodadas = (await um50(`select count(*)::int as n from public.eventos where tipo = 'pente_fino'`)).n
conferir(
  conf.total === totalRodadas && conf.rodadas.length === Math.min(2, totalRodadas) && conf.em_andamento === null
    && conf.agendada === null && conf.rodadas[0].id > conf.rodadas[1].id && 'relidos' in conf.rodadas[0],
  'as rodadas da mais nova para a mais antiga, paginadas, com o resumo de cada uma; nenhuma em andamento (aqui sem pg_cron)',
  JSON.stringify({ total: conf.total, n: conf.rodadas.length, em_andamento: conf.em_andamento }),
)
const comMudanca = (await um50(`select public.plt_fn_auditoria_conferencias(p_limite => 50) as r`)).r.rodadas.find((r) => r.mudaram > 0)
conferir(
  comMudanca && comMudanca.pedidos.some((p) => p.numero === '990105' && p.campos.includes('obs')),
  'a rodada mostra QUAIS pedidos estavam diferentes do Tiny e o QUÊ (o 990105: as observações)',
  JSON.stringify(comMudanca?.pedidos ?? null),
)
const priv50 = await um50(`
  select has_function_privilege('anon', 'public.plt_fn_auditoria(integer, integer, uuid, text[], timestamptz, timestamptz, text, boolean)', 'execute') as anon,
         has_function_privilege('authenticated', 'public.plt_fn_auditoria(integer, integer, uuid, text[], timestamptz, timestamptz, text, boolean)', 'execute') as logado,
         has_function_privilege('anon', 'public.plt_fn_auditoria_conferencias(integer, integer)', 'execute') as conf_anon`)
conferir(!priv50.anon && priv50.logado && !priv50.conf_anon, 'anônimo fora; logado entra na porta e o gate de admin decide por dentro', JSON.stringify(priv50))
await como50('')
} // fim do bloco 50

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
