// ENSAIO ×100 do BLOCO C da SESSAO-47 (Lei §1/§7.2/§12 — E-192: ANTES da tela).
// O molde é o ensaio43.mjs da SESSAO-43 (o mesmo volume, para os números conversarem com
// os da lei): o volume de hoje × 100 semeado direto nas projeções (A-131:
// session_replication_role = replica) e cada porta medida depois de aquecida.
//   Montagem ×100: 50 mil passagens em 90 dias (~550 por dia), 10% em DUPLA, a equipe de
//   cada uma e um trecho por pessoa; os outros setores: mais 250 mil passagens; o histórico
//   do Trello ×100: 88,5 mil linhas; 2.000 modelos; 300 pessoas; a equipe do painel da
//   Montagem = os 8 que montam (letras A–H); o resumo por pessoa × dia (a ocupação).
//
// Diferenças para o ensaio43 (de propósito, para exercitar o Bloco C): quem monta ESTÁ na
// equipe do painel (com letra), há duplas, e a ocupação tem dado.
//
// Uso (pelo dev47c.mjs):
//   node dev47c.mjs semear ensaio47c.mjs
//   node dev47c.mjs prova cheio antes  ensaio47c.mjs
//   node dev47c.mjs prova cheio depois ensaio47c.mjs
const T = (ms) => `${ms.toFixed(1)} ms`

export async function semear(bd) {
  const um = async (sql, p) => (await bd.query(sql, p)).rows[0]
  const t0 = Date.now()
  await bd.exec(`
    set session_replication_role = replica;
    insert into public.plt_setores (codigo, nome, papel_no_fluxo, ordem)
      select 'x' || g, 'X' || g || ' SETOR', 'producao', 900 + g from generate_series(1, 5) g;
    insert into public.plt_setores (codigo, nome, papel_no_fluxo, ordem) values ('mx', 'MX MONTAGEM', 'producao', 899);
    insert into public.plt_horarios_funcionamento (escopo, setor_id, dia_semana, hora_inicio, hora_fim)
      select 'setor', s.id, d, x.ini, x.fim from public.plt_setores s, generate_series(1, 5) d,
             (values (time '07:30', time '12:00'), (time '13:00', time '18:00')) as x(ini, fim)
       where s.codigo like 'x%' or s.codigo = 'mx';
    insert into public.plt_tempo_regras (setor_id, teto_min) select id, 240 from public.plt_setores where codigo = 'mx';
    insert into public.plt_usuarios (nome, email, cpf, usuario, papel, auth_user_id, modulos)
      select 'Pessoa ' || g, 'p' || g || '@x.com', lpad((47100000000 + g)::text, 11, '0'), 'p.' || g,
             case when g = 1 then 'admin' else 'operador' end,
             ('00000000-0000-0000-0000-' || lpad((990000 + g)::text, 12, '0'))::uuid,
             case when g = 2 then array['tv'] else array['fabrica'] end
        from generate_series(1, 300) g;
    insert into public.plt_tempo_modelos (nome, confirmado) select 'Modelo X ' || g, true from generate_series(1, 2000) g;
  `)
  const S = (await um(`select id::int as id from public.plt_setores where codigo = 'mx'`)).id
  const setores = (await bd.query(`select id::int as id from public.plt_setores where codigo like 'x%' or codigo = 'mx' order by id`)).rows.map((r) => r.id)
  await bd.exec(`
    create temporary table pes as select id, row_number() over (order by usuario) as n from public.plt_usuarios
      where usuario like 'p.%' and usuario not in ('p.1', 'p.2');
    -- a equipe do painel da Montagem: os 8 que montam (n 1..8), letras A–H; mais 2 de apoio que só ajudam
    insert into public.plt_tempo_equipe (setor_id, usuario_id, papel, letra)
      select ${S}, p.id, case when p.n <= 2 then 'titular' else 'apoio' end, chr(64 + p.n::int) from pes p where p.n <= 10;
    create temporary table mods as select id, row_number() over (order by id) as n from public.plt_tempo_modelos where nome like 'Modelo X %';
    insert into public.plt_cards (tipo, titulo) select 'avulso', 'Card X ' || g from generate_series(1, 300000) g;
    create temporary table cs as select id, row_number() over (order by id) as n from public.plt_cards where titulo like 'Card X %';
    insert into public.plt_eventos (card_id, tipo, origem, setor_destino_id, ocorrido_em)
      select cs.id, 'card_criado', 'automacao', ${S}, now() - interval '91 days' from cs;
    create temporary table evs as select e.id, e.card_id, row_number() over (order by e.id) as n from public.plt_eventos e
      join cs on cs.id = e.card_id where e.tipo = 'card_criado';
  `)
  console.log('cards e fatos de entrada', Date.now() - t0, 'ms')
  await bd.exec(`
    insert into public.pedidos (id, numero) overriding system value select 900000 + g, 10000 + g from generate_series(1, 2000) g on conflict do nothing;
    update public.plt_cards c set tipo = 'unidade', indice_unidade = 1, total_unidades = 1, pedido_id = 900000 + 1 + (cs.n % 2000) from cs where cs.id = c.id and cs.n <= 50000;
  `)
  const lista = `array[${setores.filter((s) => s !== S).join(',')}]::bigint[]`
  await bd.exec(`
    insert into public.plt_tempo_passagens (id, card_id, setor_id, entrada_em, saida_em, dia, modelo_id, fila_s, execucao_s,
       execucao_fechada_s, execucao_bruta_s, parado_s, total_s, esforco_s, pessoas, trechos_n, desfecho, situacao, motivo, primeiro_inicio)
    select e.id, e.card_id,
           case when e.n <= 50000 then ${S} else (${lista})[1 + (e.n % 5)] end,
           s.saida - interval '3 hours', s.saida,
           (s.saida at time zone 'America/Fortaleza')::date,
           m.id, 3600 + (e.n % 7) * 600, 1200 + (e.n % 40) * 90, 1200 + (e.n % 40) * 90, 1300 + (e.n % 40) * 90, 300, 9000,
           1200 + (e.n % 40) * 90,
           -- 10% em dupla (os dois montam); o resto, um só
           case when e.n % 10 = 0 then array[p.id, p2.id] else array[p.id] end,
           case when e.n % 10 = 0 then 2 else 1 end,
           case when e.n % 50 = 0 then 'retrabalho' else 'concluida' end,
           case when e.n % 25 = 0 then 'conferir' when e.n % 33 = 0 then 'sem_registro' else 'valida' end,
           case when e.n % 25 = 0 then 'Rápida demais' end,
           s.saida - interval '1 hour'
      from evs e
      cross join lateral (select now() - ((e.n % 90) || ' days')::interval - ((e.n % 9) || ' hours')::interval as saida) s
      join mods m on m.n = 1 + (e.n % 2000)
      join pes p on p.n = 1 + (e.n % 8)
      join pes p2 on p2.n = 1 + ((e.n + 3) % 8);
    insert into public.plt_tempo_passagem_equipe (passagem_id, setor_id, dia, montadores, ajudantes, esforco, cortado, clique_errado)
      select ps.id, ps.setor_id, ps.dia, ps.pessoas, case when ps.id % 17 = 0 then array[(select id from pes where n = 9)] else '{}' end,
             (select jsonb_object_agg(x::text, ps.esforco_s / cardinality(ps.pessoas)) from unnest(ps.pessoas) x), ps.id % 29 = 0, ps.id % 31 = 0
        from public.plt_tempo_passagens ps join evs on evs.id = ps.id;
    -- um trecho por pessoa de cada passagem da Montagem (o 2º da dupla com a chave negativa — as chaves estrangeiras estão desligadas no semear)
    insert into public.plt_tempo_trechos (inicio_evento_id, card_id, setor_id, passagem_id, usuario_id, papel, inicio, fim, fim_conta, util_s, segundos, dia)
      select case when o.i = 1 then ps.id else -ps.id end, ps.card_id, ps.setor_id, ps.id, o.u, 'execucao', ps.primeiro_inicio, ps.saida_em, ps.saida_em,
             ps.execucao_s, ps.execucao_s, (ps.primeiro_inicio at time zone 'America/Fortaleza')::date
        from public.plt_tempo_passagens ps join evs on evs.id = ps.id
        cross join lateral unnest(ps.pessoas) with ordinality as o(u, i)
       where ps.setor_id = ${S};
    insert into public.plt_tempo_padrao (setor_id, modelo_id, mediana_s, p25_s, p75_s, n)
      select ${S}, id, 2400, 1800, 3000, 30 from mods;
    insert into public.plt_tempo_padrao_historico (setor_id, modelo_id, mediana_s, p25_s, p75_s, n, n_trello)
      select ${S}, id, 2400, 1800, 3000, 60, 30 from mods;
    -- a ocupação: o resumo por dia × pessoa × setor dos 10 da equipe em 90 dias
    insert into public.plt_tempo_resumo_pessoa_dia (dia, usuario_id, setor_id, trabalhando_s, ausente_s, especial_s, esforco_s, trechos_n, passagens_n)
      select (now() at time zone 'America/Fortaleza')::date - d, p.id, ${S}, 20000 + p.n * 300, 1800, 0, 18000 + p.n * 250, 60, 60
        from generate_series(0, 89) d, pes p where p.n <= 10;
    -- o histórico do Trello ×100: 88,5 mil linhas de 13/07 a 13/10
    insert into public.plt_tempo_trello (cartao_id, cartao_nome, etiquetas, pedido_numero, setor_id, inicio, fim, dia, modelo_chave, modelo_id, pessoas, util_s, execucao_s, esforco, situacao)
      select 'tx' || g, 'Móvel X ' || g, array['FRANKLIN'], 10000 + g, ${S}, d.fim - interval '1 hour', d.fim, (d.fim at time zone 'America/Fortaleza')::date,
             'movel x ' || (g % 2000), m.id, array[p.id], 2400, 2400, jsonb_build_object(p.id::text, 2400), case when g % 20 = 0 then 'conferir' else 'valida' end
        from generate_series(1, 88500) g
        cross join lateral (select timestamptz '2026-10-13 17:00-03' - ((g % 92) || ' days')::interval as fim) d
        join mods m on m.n = 1 + (g % 2000)
        join pes p on p.n = 1 + (g % 8);
    set session_replication_role = origin;
    select plt_privado.fn_tempo_montagens_refazer('plataforma', (select array_agg(id) from public.plt_tempo_passagens where saida_em is not null));
    select plt_privado.fn_tempo_montagens_refazer('trello', (select array_agg(id) from public.plt_tempo_trello));
    analyze;
  `)
  const n = await um(`select (select count(*) from public.plt_tempo_passagens)::int as pass, (select count(*) from public.plt_tempo_passagens where setor_id = ${S})::int as mont,
                             (select count(*) from public.plt_tempo_trechos)::int as trechos, (select count(*) from public.plt_tempo_trello)::int as trello,
                             (select count(*) from public.plt_tempo_passagem_equipe)::int as equipe, (select count(*) from public.plt_tempo_montagens)::int as montagens,
                             (select count(*) from public.plt_tempo_montagem_pessoas)::int as pessoas,
                             (select count(*) from public.plt_tempo_montagens where setor_id = ${S} and cardinality(montadores) = 2)::int as duplas,
                             (select count(*) from public.plt_tempo_equipe where setor_id = ${S})::int as no_painel`)
  console.log('volume', JSON.stringify(n), 'semeado em', Date.now() - t0, 'ms')
  return S
}

const mediana = (xs) => {
  const o = [...xs].sort((a, b) => a - b)
  return o.length % 2 ? o[(o.length - 1) / 2] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2
}

export default async function (bd, fase, args = []) {
  const um = async (sql, p) => (await bd.query(sql, p)).rows[0]
  const S = (await um(`select id::int as id from public.plt_setores where codigo = 'mx'`)).id
  const adm = (await um(`select auth_user_id from public.plt_usuarios where usuario = 'p.1'`)).auth_user_id
  const tv = (await um(`select auth_user_id from public.plt_usuarios where usuario = 'p.2'`)).auth_user_id
  // o funcionário: quem tem a letra A na Montagem (monta de verdade)
  const op = await um(`select u.auth_user_id, u.id from public.plt_tempo_equipe e join public.plt_usuarios u on u.id = e.usuario_id where e.setor_id = ${S} and e.letra = 'A'`)
  const data = async (menos) => (await um(`select ((now() at time zone 'America/Fortaleza')::date - ${menos})::text as d`)).d
  const hoje = await data(0)
  const ontem = await data(1)
  const d30 = await data(29)
  const d7 = await data(6)
  const d90 = await data(89)
  const como = (auth) => bd.exec(`select set_config('request.jwt.claim.sub', '${auth}', false)`)
  const VEZES = Number(args[0]) || 9
  const res = {}
  const medir = async (chave, nome, sql, auth = adm) => {
    await como(auth)
    await bd.query(sql) // aquece
    const tempos = []
    for (let i = 0; i < VEZES; i++) {
      const a = performance.now()
      await bd.query(sql)
      tempos.push(performance.now() - a)
    }
    const m = mediana(tempos)
    res[chave] = Math.round(m * 10) / 10
    console.log(`${nome.padEnd(58)} ${T(m).padStart(9)}   (mín ${T(Math.min(...tempos))}, máx ${T(Math.max(...tempos))})`)
    return m
  }
  const rodada = async (sufixo, rotulo) => {
    console.log(`\n=== ${rotulo} ===`)
    await medir(`dia${sufixo}`, 'Dia (ontem, ~550 passagens)', `select public.plt_fn_tempos_dia(${S}, '${ontem}', '${d30}', '${hoje}')`)
    await medir(`dia_mais${sufixo}`, 'Dia — Ver mais (a página seguinte)', `select public.plt_fn_tempos_dia(${S}, '${ontem}', '${d30}', '${hoje}', null, null, true, now() - interval '3 days', 'plataforma', 1)`)
    await medir(`per7${sufixo}`, 'Período 7 dias', `select public.plt_fn_tempos_periodo(${S}, '${d7}', '${hoje}')`)
    await medir(`per30${sufixo}`, 'Período 30 dias (~16 mil + o Trello do começo)', `select public.plt_fn_tempos_periodo(${S}, '${d30}', '${hoje}')`)
    await medir(`per90${sufixo}`, 'Período 90 dias (~50 mil + o Trello) — dívida 31', `select public.plt_fn_tempos_periodo(${S}, '${d90}', '${hoje}')`)
    await medir(`mov30${sufixo}`, 'Móveis 30 dias (2.000 modelos)', `select public.plt_fn_tempos_moveis(${S}, '${d30}', '${hoje}')`)
    await medir(`mov90${sufixo}`, 'Móveis 90 dias — dívida 31', `select public.plt_fn_tempos_moveis(${S}, '${d90}', '${hoje}')`)
    await medir(`modelo${sufixo}`, 'Passagens de um modelo (90 dias)', `select public.plt_fn_tempos_modelo_passagens(${S}, (select id from public.plt_tempo_modelos where nome = 'Modelo X 7'), '${d90}', '${hoje}')`)
    await medir(`mon30${sufixo}`, 'Montadores 30 dias', `select public.plt_fn_tempos_montadores(${S}, '${d30}', '${hoje}')`)
    await medir(`mon90${sufixo}`, 'Montadores 90 dias — dívida 31', `select public.plt_fn_tempos_montadores(${S}, '${d90}', '${hoje}')`)
    await medir(`mon30op${sufixo}`, 'Montadores 30 dias como funcionário (só o dele)', `select public.plt_fn_tempos_montadores(${S}, '${d30}', '${hoje}')`, op.auth_user_id)
    await medir(`conf30${sufixo}`, 'Conferir 30 dias (grupos + 1ª página)', `select public.plt_fn_tempos_conferir(${S}, '${d30}', '${hoje}')`)
    await medir(`tv${sufixo}`, 'Modo TV (hoje, 30 dias, mês, 14 dias, semana)', `select public.plt_fn_modo_tv(${S})`, tv)
  }

  await rodada('', fase === 'antes' ? 'ANTES (a base, sem a migration do Bloco C)' : 'DEPOIS · configuração padrão (ninguém desligado)')

  if (fase === 'depois') {
    await como(adm)
    // as portas novas
    console.log('\n=== DEPOIS · as portas novas ===')
    // o setor "lembrado" = a Montagem ×100 (sem ele a abertura cairia na MONTAGEM vazia do cadastro)
    await medir('abertura_dia', 'Abertura (o setor lembrado, a aba Dia de hoje)', `select public.plt_fn_tempos_abertura(${S}, '${hoje}')`)
    await medir('dia_hoje', '   … a aba Dia de hoje chamada direto (comparação)', `select public.plt_fn_tempos_dia(${S}, '${hoje}', '${d30}', '${hoje}', null, null, true, null, null, null, 50)`)
    await medir('janela', 'A janela de configuração (o painel + as equipes)', `select public.plt_fn_tempos_painel()`)
    const b = await um(`select array_agg(e.usuario_id order by e.letra) as ids from public.plt_tempo_equipe e where e.setor_id = ${S} and e.letra in ('B', 'F')`)
    const liga = (ligado) => `select public.plt_fn_tempos_painel_salvar(null, '${JSON.stringify(b.ids.map((u) => ({ setor_id: S, usuario_id: u, ligado })))}'::jsonb)`
    // o salvar: alterna ligado/desligado (cada chamada grava de verdade)
    {
      await como(adm)
      const tempos = []
      for (let i = 0; i < 8; i++) {
        const a = performance.now()
        await bd.query(liga(i % 2 === 1))
        tempos.push(performance.now() - a)
      }
      res.salvar = Math.round(mediana(tempos) * 10) / 10
      console.log(`${'Salvar (2 montadores, com trilha e aviso aos setores)'.padEnd(58)} ${T(mediana(tempos)).padStart(9)}`)
    }
    // dois montadores desligados (B e F: sozinhos e em dupla) + a marca do padrão ligada
    await bd.query(liga(false))
    await bd.query(`select public.plt_fn_tempos_painel_salvar('{"linha_padrao": true, "medida": "media", "abrir_periodo": "7"}'::jsonb, null)`)
    const conf = await um(`select plt_privado.fn_tempos_painel() as p, plt_privado.fn_tempos_desligados(${S}, null) as d`)
    console.log('configuração agora:', JSON.stringify(conf.p), '· desligados:', conf.d.length)
    await rodada('_desl', 'DEPOIS · 2 montadores desligados (B e F), a marca do padrão ligada, média')
    await medir('abertura_per', 'Abertura (configurada: Período 7 dias, o setor lembrado)', `select public.plt_fn_tempos_abertura(${S}, '${hoje}')`)
  }

  // os planos das partes que leem as tabelas que crescem (A-147: a consulta de dentro da função)
  await como(adm)
  const planos = [
    ['o período de 30 dias pela tabela pronta', `select count(*), sum(m.execucao_s) from plt_privado.vw_tempo_montagens m where m.setor_id = ${S} and m.dia between '${d30}' and '${hoje}'`],
    ['a 1ª página do Dia', `select m.id from plt_privado.vw_tempo_montagens m where m.setor_id = ${S} and m.dia = '${ontem}' order by m.fim, m.origem, m.id limit 51`],
    ['as pessoas dos móveis do período (Móveis/Montadores)', `select count(*) from public.plt_tempo_montagem_pessoas q where q.setor_id = ${S} and q.dia between '${d30}' and '${hoje}' and q.papel = 'montador'`],
    ['os trechos do dia com o padrão do modelo (a marca da linha do dia)', `select t.usuario_id, t.inicio, ps.execucao_s, pa.mediana_s
        from public.plt_tempo_trechos t
        left join public.plt_tempo_passagens ps on ps.id = t.passagem_id
        left join plt_privado.fn_tempos_padroes(${S}, true) pa on pa.modelo_id = ps.modelo_id
       where t.setor_id = ${S} and t.dia = '${ontem}' order by 2 limit 2000`],
    ['a equipe do painel do setor (quem está ligado)', `select e.usuario_id, e.letra from public.plt_tempo_equipe e where e.setor_id = ${S}`],
  ]
  for (const [nome, sql] of planos) {
    const plano = (await bd.query(`explain (analyze, buffers, costs off) ${sql}`)).rows.map((r) => r['QUERY PLAN'])
    console.log(`\n--- plano: ${nome}`)
    console.log(plano.filter((l) => /Scan|Join|Limit|Execution|Sort|Aggregate|Append|Nested|Hash/.test(l)).slice(0, 16).join('\n'))
  }
  console.log('\nRESULTADO', fase, JSON.stringify(res))
}
