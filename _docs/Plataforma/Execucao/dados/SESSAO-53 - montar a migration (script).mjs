/**
 * SESSAO-53 · monta a migration 20261118110000 por EXTRAÇÃO das versões vigentes
 * (o último `create` de cada porta nas migrations — A-96/A-97/E-170) + remendos
 * conferidos (cada remendo tem de casar exatamente 1 vez, senão o script para).
 *
 * Uso (da raiz do repositório, sem `cd`):
 *   node "_docs/Plataforma/Execucao/dados/SESSAO-53 - montar a migration (script).mjs"
 */
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const MIG = path.join(RAIZ, 'supabase/migrations')
const SAIDA = '20261118110000_plt_entregue_em_parte_nas_telas.sql'

/** A versão vigente: o ÚLTIMO create (com ou sem "or replace") antes da migration desta sessão. */
async function vigente(nome) {
  const arquivos = (await readdir(MIG)).filter((f) => f.endsWith('.sql') && f < SAIDA).sort().reverse()
  const inicio = new RegExp(`^create (or replace )?function public\\.${nome} *\\(`, 'i')
  for (const arquivo of arquivos) {
    const linhas = (await readFile(path.join(MIG, arquivo), 'utf8')).split('\n')
    let achado = -1
    linhas.forEach((l, i) => {
      if (inicio.test(l)) achado = i
    })
    if (achado < 0) continue
    const fim = linhas.findIndex((l, i) => i > achado && /^(\$function\$|\$\$);\s*$/.test(l))
    if (fim < 0) throw new Error(`fim de ${nome} não achado em ${arquivo}`)
    return { arquivo, de: achado + 1, ate: fim + 1, texto: linhas.slice(achado, fim + 1).join('\n') }
  }
  throw new Error(`porta ${nome} não achada`)
}

function remendar(texto, de, para, onde) {
  const n = texto.split(de).length - 1
  if (n !== 1) throw new Error(`remendo "${onde}" casou ${n} vez(es) — esperado 1`)
  return texto.replace(de, () => para)
}

// A chave só nasce quando há (E-237): a junção pela chave primária com a visão da regra.
const chave = (recuo) =>
  `${recuo}-- SESSAO-53: o pedido entregue em parte — "Entregue em parte (N de M)" e quantos seguem na
${recuo}-- fábrica (a chave só nasce quando há — E-237)
${recuo}|| case when ep.card_id is null then '{}'::jsonb
${recuo}        else jsonb_build_object('entregue_em_parte', ep.selo) end`
const juncao = (card, recuo) =>
  `${recuo}-- SESSAO-53: a regra do selo, pela chave primária do card do pedido (só as linhas da página)
${recuo}left join plt_privado.vw_entregue_em_parte ep on ep.card_id = ${card}
`

// ---------------------------------------------------------------------------
// 1 · Programar (os pedidos sem programação) — jsonb, só ganha a chave
// ---------------------------------------------------------------------------
const cand = await vigente('plt_fn_programacao_candidatos')
let candSql = cand.texto
candSql = remendar(
  candSql,
  `                            'original', pe.tiny_original, 'tiny_confirmado_em', pe.tiny_confirmado_em)) end
             order by pg.posicao)`,
  `                            'original', pe.tiny_original, 'tiny_confirmado_em', pe.tiny_confirmado_em)) end
${chave('             ')}
             order by pg.posicao)`,
  'candidatos · chave',
)
candSql = remendar(
  candSql,
  `        left join public.plt_pedido_enderecos pe on pe.pedido_id = pg.pedido_id
`,
  `        left join public.plt_pedido_enderecos pe on pe.pedido_id = pg.pedido_id
${juncao('pg.card_id', '        ')}`,
  'candidatos · join',
)

// ---------------------------------------------------------------------------
// 2 · Já programadas — tabela: ganha a coluna entregue_em_parte (drop + create)
// ---------------------------------------------------------------------------
const prog = await vigente('plt_fn_programadas')
let progSql = prog.texto
progSql = remendar(progSql, 'CREATE OR REPLACE FUNCTION public.plt_fn_programadas(', 'CREATE FUNCTION public.plt_fn_programadas(', 'programadas · create')
progSql = remendar(
  progSql,
  'unidades_liberadas integer, contagem_total bigint)',
  'unidades_liberadas integer, contagem_total bigint, entregue_em_parte jsonb)',
  'programadas · retorno',
)
progSql = remendar(
  progSql,
  `           pp.unidades_prontas,
           pp.unidades_liberadas
      from public.plt_programacoes pr`,
  `           pp.unidades_prontas,
           pp.unidades_liberadas,
           -- SESSAO-53: a marca da entrega parcial (a conta só é feita para quem tem)
           pc.parcial_evento_id
      from public.plt_programacoes pr`,
  'programadas · base',
)
progSql = remendar(
  progSql,
  `         count(*) over () as contagem_total
    from base b`,
  `         count(*) over () as contagem_total,
         -- SESSAO-53: "Entregue em parte (N de M)" e quantos seguem na fábrica (nulo = não há).
         -- Subconsulta na lista de saída: o banco só a calcula para as linhas que SAEM (depois
         -- da ordem e do limite), e só para o pedido que tem entrega parcial.
         case when b.parcial_evento_id is not null
              then (select ep.selo from plt_privado.vw_entregue_em_parte ep where ep.card_id = b.card_id) end as entregue_em_parte
    from base b`,
  'programadas · coluna',
)

// ---------------------------------------------------------------------------
// 3 · Expedição — jsonb, só ganha a chave
// ---------------------------------------------------------------------------
const exp = await vigente('plt_fn_expedicao')
let expSql = exp.texto
expSql = remendar(
  expSql,
  `               left join public.plt_caminhoes cam on cam.id = pg.caminhao_id), '[]'::jsonb)`,
  `               left join public.plt_caminhoes cam on cam.id = pg.caminhao_id
${juncao('pg.card_id', '               ').replace(/\n$/, '')}), '[]'::jsonb)`,
  'expedição · junção',
)
expSql = remendar(
  expSql,
  `                                                                  'rota', pg.rota) end)
                    order by pg.data_prevista asc nulls last, pg.numero desc)`,
  `                                                                  'rota', pg.rota) end)
${chave('                    ')}
                    order by pg.data_prevista asc nulls last, pg.numero desc)`,
  'expedição · chave',
)

// ---------------------------------------------------------------------------
// 4 · Entregas do dia — jsonb, só ganha a chave
// ---------------------------------------------------------------------------
const dia = await vigente('plt_fn_entregas_do_dia')
let diaSql = dia.texto
diaSql = remendar(
  diaSql,
  `                                          left join public.plt_usuarios uc on uc.id = cm.usuario_id), '[]'::jsonb)
             ) as e`,
  `                                          left join public.plt_usuarios uc on uc.id = cm.usuario_id), '[]'::jsonb)
             )
${chave('             ')}
             as e`,
  'entregas do dia · chave',
)
diaSql = remendar(
  diaSql,
  `        left join plt_privado.vw_pedido_prontidao pp on pp.card_id = pc.id
        left join lateral (
          -- D-63: o frete não aparece; os volumes vêm do cadastro do Tiny`,
  `        left join plt_privado.vw_pedido_prontidao pp on pp.card_id = pc.id
${juncao('pc.id', '        ')}        left join lateral (
          -- D-63: o frete não aparece; os volumes vêm do cadastro do Tiny`,
  'entregas do dia · junção',
)

const origem = (v) => `${v.arquivo}:${v.de}-${v.ate}`

const sql = `-- ============================================================================
-- SESSAO-53 — "Entregue em parte" também na Programação, na Expedição e nas
-- Entregas do dia
-- ============================================================================
-- A dívida da D-328, item 1 (SESSAO-51): o pedido entregue em parte já dizia
-- "Entregue em parte (N de M)" na ficha, no card do PCP, na lista de Pedidos e
-- na busca; faltavam a Programação (Programar e Já programadas), a Expedição e
-- as Entregas do dia.
--
-- A forma (escolha da sessão, registrada no diário):
--   · uma regra só — a visão plt_privado.vw_entregue_em_parte (card do pedido → selo): quantas
--     saíram, de quantas, quando, e quantas seguem na fábrica (peças vivas em
--     setor de entrada/produção + produtos ainda sem liberar no PCP) enquanto a
--     decisão que vale é "deixar em produção" e o resto não foi entregue. É a
--     mesma conta da ficha do pedido (fn_parcial_estado). Depois que o resto é
--     entregue o selo some (a regra da lista de Pedidos: vira "Entregue").
--   · cada tela recebe a informação NA PORTA QUE JÁ TINHA (nenhuma requisição
--     nova): as três portas em jsonb só ganham a chave "entregue_em_parte" (que
--     só nasce quando há — E-237); a porta de "Já programadas" devolve tabela e
--     ganha UMA coluna jsonb "entregue_em_parte" (drop + create — E-178; a
--     20261109030000, que a recriava com "create or replace", passou a derrubar
--     a assinatura antes, para a bateria reaplicar tudo sem quebrar; em produção
--     nada muda). Coluna jsonb: o que mais vier a entrar no selo entra nela, sem
--     mudar a forma de novo.
--   · a regra é uma VISÃO (e não uma função chamada linha a linha): o banco a embute na
--     consulta de cada porta e planeja uma vez só; a conta só é feita para o pedido que
--     TEM entrega parcial, pela chave primária do card, só nas linhas da página.
--
-- Recriações por extração das versões vigentes (A-96/A-97/E-170):
--   plt_fn_programacao_candidatos  ← ${origem(cand)}
--   plt_fn_programadas             ← ${origem(prog)}
--   plt_fn_expedicao               ← ${origem(exp)}
--   plt_fn_entregas_do_dia         ← ${origem(dia)}
-- Nada aqui altera tabela, índice, gatilho ou tabela da integração. O selo do
-- endereço alterado em "Já programadas" (D-324) NÃO foi tocado.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 0 · A regra única do selo
-- ----------------------------------------------------------------------------
create or replace view plt_privado.vw_entregue_em_parte as
select c.id as card_id,
       jsonb_build_object('entregues', c.parcial_entregues, 'total', c.parcial_total, 'em', c.parcial_em)
       -- o que ainda está na fábrica: só enquanto o pedido segue vivo com "deixar em produção"
       || case when c.entrega_evento_id is null and c.parcial_decisao = 'manter'
               then (select case when x.n > 0 then jsonb_build_object('ainda_producao', x.n) else '{}'::jsonb end
                       from (select ((select count(*)
                                        from public.plt_cards u
                                        join public.plt_setores s on s.id = u.setor_atual_id
                                       where u.pedido_id = c.pedido_id and u.tipo = 'unidade'
                                         and u.arquivado_em is null and u.cancelada_em is null
                                         and u.destino_pendente_em is null
                                         and s.papel_no_fluxo in ('entrada', 'producao'))
                                     + (select count(*)
                                          from plt_privado.fn_vagas_pedido(c.pedido_id) w
                                         where w.card_id is null and w.reserva_card_id is null))::int as n) x)
               else '{}'::jsonb end as selo
  from public.plt_cards c
 where c.tipo = 'pedido'
   and c.parcial_evento_id is not null
   -- depois que o RESTO é entregue, o pedido é "Entregue" (a regra da lista de Pedidos)
   and (c.entrega_evento_id is null or c.entrega_evento_id = c.parcial_evento_id);
comment on view plt_privado.vw_entregue_em_parte is
  'SESSAO-53: o selo "Entregue em parte (N de M)" de um pedido para as telas da logística (Programação, Expedição, Entregas do dia) — por card do pedido: entregues, total, em e, enquanto a decisão é "deixar em produção" e o resto não foi entregue, ainda_producao (peças vivas em entrada/produção + produtos sem liberar no PCP — a conta da ficha). Sem linha = sem entrega parcial, ou o resto já foi entregue. Lida sempre pela chave (card_id).';
revoke all on plt_privado.vw_entregue_em_parte from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1 · Programação → Programar (recriada de ${origem(cand)} — o jsonb só ganha a chave)
-- ----------------------------------------------------------------------------
${candSql}

-- ----------------------------------------------------------------------------
-- 2 · Programação → Já programadas (recriada de ${origem(prog)} — + a coluna
--     entregue_em_parte; forma nova de retorno → drop + create, as mesmas permissões)
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_programadas(boolean, date, bigint, integer, integer, text);
${progSql}

comment on function public.plt_fn_programadas(boolean, date, bigint, integer, integer, text) is
  'As programações (D-111), paginadas: as não entregues (dia mais perto primeiro) ou, com p_entregues, o histórico; por dia, caminhão e rota (D-128), com a equipe, o estado do pedido (D-156), o CEP e o ponto (D-221), o dia real da entrega (SESSAO-47) e a busca que acha a rota inteira (D-199). SESSAO-53: + entregue_em_parte (jsonb; nulo = não há) — "Entregue em parte (N de M)" e quantos seguem na fábrica.';
revoke all on function public.plt_fn_programadas(boolean, date, bigint, integer, integer, text) from public, anon;
grant execute on function public.plt_fn_programadas(boolean, date, bigint, integer, integer, text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3 · Expedição (recriada de ${origem(exp)} — o jsonb só ganha a chave)
-- ----------------------------------------------------------------------------
${expSql}

-- ----------------------------------------------------------------------------
-- 4 · Entregas do dia (recriada de ${origem(dia)} — o jsonb só ganha a chave)
-- ----------------------------------------------------------------------------
${diaSql}
`

await writeFile(path.join(MIG, SAIDA), sql, 'utf8')
console.log(`ok · ${SAIDA}`)
for (const v of [cand, prog, exp, dia]) console.log(`  ${origem(v)}`)
