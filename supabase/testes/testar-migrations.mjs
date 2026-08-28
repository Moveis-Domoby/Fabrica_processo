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

titulo('Cenário mínimo: um pedido, um card, um evento')
await bd.exec(`
  insert into public.clientes (nome) values ('Cliente de teste');
  insert into public.pedidos (numero, cliente_id, situacao)
    values (999999, (select id from public.clientes order by id desc limit 1), 'aprovado');
  insert into public.plt_cards (tipo, pedido_id)
    values ('pedido', (select id from public.pedidos where numero = 999999));
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    values (
      (select id from public.plt_cards order by id desc limit 1),
      'card_criado',
      (select id from public.plt_setores where codigo = 'pcp'),
      'api'
    );
`)
console.log('  criado')

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
