-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · SESSAO-39 — O PAINEL DE MOTIVOS (D-176)
--
-- O pedido do dono: "Em dashboards, crie uma dash para medir as questões da
-- fábrica e rotas, motivos de não entregas, motivos de pausa e todos os
-- motivos dessa forma, é uma medição para metrificar quais são os maiores
-- problemas em cada um desses pontos." Resposta (21/10): entram Produção
-- (pausas, paradas e saídas do setor), PCP (stand-by), Rotas (não entrega,
-- devolução, entrega desfeita) e Qualidade (atenção/danificado).
--
-- Nenhuma tabela nova: tudo já é FATO gravado (M-02) — as pausas por pessoa
-- (plt_pessoa_pausas, a projeção da SESSAO-38), a presença do tablet
-- (plt_presenca_eventos) e os fatos de plt_eventos. O painel SOMA:
--   1. plt_fn_dash_motivos — a tela inteira numa requisição (Lei §1): por área,
--      cada motivo com quantas vezes e quanto tempo custou (o tempo ÚTIL — só
--      o expediente do setor, a mesma régua dos outros painéis — D-29/D-167),
--      do maior problema para o menor; + por setor, por pessoa, por caminhão.
--   2. plt_fn_dash_motivos_detalhe — o clique num motivo: as ocorrências (quando,
--      quem, onde, o quê, o motivo escrito e o tempo), por cursor (Lei §6).
--   Quem vê (D-32): líder (os setores que lidera) e admin (tudo); PCP e Rotas
--   aparecem para quem vê esses setores no painel (o admin; o líder deles).
--   3. Índices para o recorte por período (Lei §7.2): as pausas por início, a
--      presença por tipo e dia, e o Mover (parcial — só os fatos do botão).
--
-- Nada aqui toca as tabelas da integração. Aditiva. Idempotente.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Índices do recorte por período
-- ----------------------------------------------------------------------------
create index if not exists plt_pessoa_pausas_inicio_idx
  on public.plt_pessoa_pausas (inicio);
create index if not exists plt_presenca_eventos_tipo_dia_idx
  on public.plt_presenca_eventos (tipo, ocorrido_em);
-- O botão Mover (D-173) grava movimentações comuns marcadas em dados.como; o
-- painel busca só essas (parcial — as movimentações do arrasto ficam de fora).
create index if not exists plt_eventos_mover_fila_idx
  on public.plt_eventos (ocorrido_em)
  where (dados ->> 'como') = 'mover_para_fila';

-- ----------------------------------------------------------------------------
-- 2 · Quem vê o quê (uma regra só para as duas portas)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_motivos_alcance(p_setor_id bigint)
returns table (producao bigint[], pcp_id bigint, ver_pcp boolean, ver_rotas boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_setores bigint[];
begin
  if plt_privado.fn_usuario_atual() is null then
    raise exception 'Entre na plataforma para ver o painel.' using errcode = 'insufficient_privilege';
  end if;
  select coalesce(array_agg(s), '{}') into v_setores from plt_privado.fn_setores_dashboard() s;
  if cardinality(v_setores) = 0 then
    raise exception 'O painel de motivos é dos líderes e do admin.' using errcode = 'insufficient_privilege';
  end if;
  select coalesce(array_agg(s.id), '{}') into producao
    from public.plt_setores s
   where s.id = any (v_setores) and s.papel_no_fluxo = 'producao'
     and (p_setor_id is null or s.id = p_setor_id);
  select s.id into pcp_id from public.plt_setores s where s.codigo = 'pcp';
  -- Com um setor de produção escolhido, o PCP e as rotas não são dele.
  ver_pcp := p_setor_id is null and pcp_id = any (v_setores);
  ver_rotas := p_setor_id is null
               and exists (select 1 from public.plt_setores s where s.codigo = 'rotas' and s.id = any (v_setores));
  return next;
end;
$$;

comment on function plt_privado.fn_motivos_alcance(bigint) is
  'SESSAO-39 (D-176): o alcance do painel de motivos — os setores de produção que a pessoa vê (D-32: admin todos, líder os que lidera; com o filtro, só o escolhido) e se vê o PCP e as rotas. Sem setor nenhum = recusa.';

-- ----------------------------------------------------------------------------
-- 3 · O painel numa requisição
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_motivos(
  p_de       timestamptz,
  p_ate      timestamptz,
  p_setor_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  a           record;
  v_producao  jsonb := null;
  v_pcp       jsonb := null;
  v_rotas     jsonb := null;
  v_qualidade jsonb := null;
begin
  if p_de is null or p_ate is null or p_ate <= p_de then
    raise exception 'Diga o período do painel.' using errcode = 'check_violation';
  end if;
  if p_ate - p_de > interval '400 days' then
    raise exception 'O painel mostra no máximo um ano por vez.' using errcode = 'check_violation';
  end if;
  select * into a from plt_privado.fn_motivos_alcance(p_setor_id);

  -- ---- PRODUÇÃO ------------------------------------------------------------
  if cardinality(a.producao) > 0 then
    with pausas as (
      -- cada linha = uma pessoa parada (o executor, quem ajudava, o PARADO);
      -- vezes = os gestos; tempo = o útil de cada pessoa (horas-pessoa paradas)
      select pp.evento_id, pp.usuario_id, pp.especial, e.setor_origem_id as setor_id,
             case when pp.motivo_id is not null then 'id:' || pp.motivo_id else 'outro' end as chave,
             coalesce(m.texto, 'Outro (escrito na hora)') as motivo,
             extract(epoch from plt_privado.fn_tempo_util(pp.inicio, coalesce(pp.fim, now()),
                                                          e.setor_origem_id, pp.usuario_id))::bigint as seg
        from public.plt_pessoa_pausas pp
        join public.plt_eventos e on e.id = pp.evento_id
        left join public.plt_motivos m on m.id = pp.motivo_id
       where pp.inicio >= p_de and pp.inicio < p_ate
         and e.setor_origem_id = any (a.producao)
    ), saidas as (
      -- a saída do setor pelo tablet: o tempo útil até a pessoa entrar de novo
      select pe.id, pe.usuario_id, pe.setor_id,
             coalesce(nullif(btrim(split_part(pe.motivo, ' — ', 1)), ''), 'Sem motivo') as motivo,
             extract(epoch from plt_privado.fn_tempo_util(
               pe.ocorrido_em,
               coalesce((select min(x.ocorrido_em) from public.plt_presenca_eventos x
                          where x.usuario_id = pe.usuario_id and x.id > pe.id), now()),
               pe.setor_id, pe.usuario_id))::bigint as seg
        from public.plt_presenca_eventos pe
       where pe.tipo = 'saida' and pe.ocorrido_em >= p_de and pe.ocorrido_em < p_ate
         and pe.setor_id = any (a.producao)
    ), mover as (
      select e.id, e.setor_origem_id, e.setor_destino_id,
             case when (e.dados ->> 'motivo_id') is not null then 'id:' || (e.dados ->> 'motivo_id') else 'outro' end as chave,
             coalesce(m.texto, 'Outro (escrito na hora)') as motivo
        from public.plt_eventos e
        left join public.plt_motivos m on m.id = (e.dados ->> 'motivo_id')::bigint
       where (e.dados ->> 'como') = 'mover_para_fila'
         and e.ocorrido_em >= p_de and e.ocorrido_em < p_ate
         and (e.setor_origem_id = any (a.producao) or e.setor_destino_id = any (a.producao))
    )
    select jsonb_build_object(
      'pausas', coalesce((select jsonb_agg(to_jsonb(x) order by x.segundos desc, x.vezes desc, x.motivo)
                            from (select chave, max(motivo) as motivo, bool_or(especial) as especial,
                                         count(distinct evento_id)::int as vezes,
                                         coalesce(sum(seg), 0)::bigint as segundos
                                    from pausas group by chave) x), '[]'::jsonb),
      'pausas_por_setor', coalesce((select jsonb_agg(to_jsonb(x) order by x.segundos desc, x.vezes desc)
                            from (select p.setor_id, max(s.nome) as setor, count(distinct p.evento_id)::int as vezes,
                                         coalesce(sum(p.seg), 0)::bigint as segundos
                                    from pausas p join public.plt_setores s on s.id = p.setor_id
                                   group by p.setor_id) x), '[]'::jsonb),
      'pausas_por_pessoa', coalesce((select jsonb_agg(to_jsonb(x) order by x.segundos desc, x.vezes desc)
                            from (select p.usuario_id, max(u.nome) as nome, count(distinct p.evento_id)::int as vezes,
                                         coalesce(sum(p.seg), 0)::bigint as segundos
                                    from pausas p join public.plt_usuarios u on u.id = p.usuario_id
                                   group by p.usuario_id
                                   order by segundos desc, vezes desc limit 10) x), '[]'::jsonb),
      'saidas', coalesce((select jsonb_agg(to_jsonb(x) order by x.segundos desc, x.vezes desc, x.motivo)
                            from (select 'txt:' || lower(motivo) as chave, max(motivo) as motivo,
                                         count(*)::int as vezes, coalesce(sum(seg), 0)::bigint as segundos
                                    from saidas group by lower(motivo)) x), '[]'::jsonb),
      'mover', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.motivo)
                            from (select chave, max(motivo) as motivo, count(*)::int as vezes
                                    from mover group by chave) x), '[]'::jsonb),
      'mover_caminhos', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.de, x.para)
                            from (select so.nome as de, sd.nome as para, count(*)::int as vezes
                                    from mover mv
                                    join public.plt_setores so on so.id = mv.setor_origem_id
                                    join public.plt_setores sd on sd.id = mv.setor_destino_id
                                   group by so.nome, sd.nome
                                   order by vezes desc limit 10) x), '[]'::jsonb)
    ) into v_producao;

    -- ---- QUALIDADE (a marcação de saída — D-09/D-126) ----------------------
    with marcas as (
      select e.id, e.setor_origem_id as setor_id, e.estado_qualidade as estado
        from public.plt_eventos e
       where e.tipo = 'qualidade_marcada' and e.ocorrido_em >= p_de and e.ocorrido_em < p_ate
         and e.setor_origem_id = any (a.producao)
    ), divergencias as (
      select m.setor_id, count(*)::int as n
        from public.plt_eventos pa
        join marcas m on m.id = pa.evento_referencia_id
       where pa.tipo = 'qualidade_parecer' and pa.estado_qualidade is distinct from m.estado
       group by m.setor_id
    )
    select jsonb_build_object(
      'por_setor', coalesce(jsonb_agg(to_jsonb(x) order by x.danificado desc, x.atencao desc, x.setor), '[]'::jsonb))
      into v_qualidade
      from (select m.setor_id, max(s.nome) as setor,
                   count(*)::int as marcadas,
                   count(*) filter (where m.estado = 'atencao')::int as atencao,
                   count(*) filter (where m.estado = 'danificado')::int as danificado,
                   coalesce(max(d.n), 0)::int as divergencias
              from marcas m
              join public.plt_setores s on s.id = m.setor_id
              left join divergencias d on d.setor_id = m.setor_id
             group by m.setor_id
            having count(*) filter (where m.estado in ('atencao', 'danificado')) > 0
                or coalesce(max(d.n), 0) > 0) x;
  end if;

  -- ---- PCP: o stand-by (D-169) ----------------------------------------------
  if a.ver_pcp then
    with sb as (
      select e.id,
             case when (e.dados ->> 'motivo_id') is not null then 'id:' || (e.dados ->> 'motivo_id') else 'outro' end as chave,
             coalesce(m.texto, 'Outro (escrito na hora)') as motivo,
             sai.ocorrido_em is null as agora,
             extract(epoch from plt_privado.fn_tempo_util(e.ocorrido_em, coalesce(sai.ocorrido_em, now()),
                                                          a.pcp_id, null))::bigint as seg
        from public.plt_eventos e
        left join public.plt_motivos m on m.id = (e.dados ->> 'motivo_id')::bigint
        left join lateral (
          select s.ocorrido_em from public.plt_eventos s
           where s.evento_referencia_id = e.id and s.tipo = 'pedido_standby_saiu'
           order by s.id limit 1
        ) sai on true
       where e.tipo = 'pedido_standby_entrou' and e.ocorrido_em >= p_de and e.ocorrido_em < p_ate
    )
    select jsonb_build_object(
      'standby', coalesce((select jsonb_agg(to_jsonb(x) order by x.segundos desc, x.vezes desc, x.motivo)
                             from (select chave, max(motivo) as motivo, count(*)::int as vezes,
                                          count(*) filter (where agora)::int as agora,
                                          coalesce(sum(seg), 0)::bigint as segundos
                                     from sb group by chave) x), '[]'::jsonb),
      'em_standby_agora', (select count(*)::int from public.plt_cards c
                            where c.tipo = 'pedido' and c.standby_desde is not null and c.arquivado_em is null)
    ) into v_pcp;
  end if;

  -- ---- ROTAS: não entrega, devolução e entrega desfeita (D-116/D-129) --------
  if a.ver_rotas then
    with f as (
      select e.id, e.tipo, e.usuario_id, e.origem,
             (e.dados ->> 'caminhao_id')::bigint as caminhao_id,
             case when (e.dados ->> 'motivo_id') is not null then 'id:' || (e.dados ->> 'motivo_id')
                  when e.origem = 'automacao' then 'tiny'
                  when e.dados ->> 'motivo' = 'reentrega' then 'reentrega'
                  else 'outro' end as chave,
             coalesce(m.texto,
                      case when e.origem = 'automacao' then 'Marcado no Tiny'
                           when e.dados ->> 'motivo' = 'reentrega' then 'Reentrega'
                           else 'Outro (escrito na hora)' end) as motivo
        from public.plt_eventos e
        left join public.plt_motivos m on m.id = (e.dados ->> 'motivo_id')::bigint
       where e.tipo in ('entrega_nao_realizada', 'pedido_devolvido', 'entrega_desfeita')
         and e.ocorrido_em >= p_de and e.ocorrido_em < p_ate
    )
    select jsonb_build_object(
      'nao_entregue', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.motivo)
                       from (select chave, max(motivo) as motivo, count(*)::int as vezes
                               from f where tipo = 'entrega_nao_realizada' group by chave) x), '[]'::jsonb),
      'devolucao', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.motivo)
                       from (select chave, max(motivo) as motivo, count(*)::int as vezes
                               from f where tipo = 'pedido_devolvido' group by chave) x), '[]'::jsonb),
      'desfeita', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.motivo)
                       from (select chave, max(motivo) as motivo, count(*)::int as vezes
                               from f where tipo = 'entrega_desfeita' group by chave) x), '[]'::jsonb),
      'por_caminhao', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.caminhao)
                       from (select f.caminhao_id, max(c.nome) as caminhao, count(*)::int as vezes
                               from f join public.plt_caminhoes c on c.id = f.caminhao_id
                              where f.tipo = 'entrega_nao_realizada' group by f.caminhao_id) x), '[]'::jsonb),
      'por_pessoa', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.nome)
                       from (select f.usuario_id, max(u.nome) as nome, count(*)::int as vezes
                               from f join public.plt_usuarios u on u.id = f.usuario_id
                              where f.tipo = 'entrega_nao_realizada' group by f.usuario_id
                              order by vezes desc limit 10) x), '[]'::jsonb),
      'entregues', (select count(*)::int from public.plt_eventos e
                     where e.tipo = 'pedido_entregue' and e.ocorrido_em >= p_de and e.ocorrido_em < p_ate)
    ) into v_rotas;
  end if;

  return jsonb_build_object(
    'de', p_de, 'ate', p_ate, 'setor_id', p_setor_id,
    'producao', v_producao, 'qualidade', v_qualidade, 'pcp', v_pcp, 'rotas', v_rotas);
end;
$$;

comment on function public.plt_fn_dash_motivos(timestamptz, timestamptz, bigint) is
  'SESSAO-39 (D-176): o painel de motivos numa requisição — Produção (pausas e paradas por motivo/setor/pessoa com o tempo útil parado; saídas do tablet; o Mover), Qualidade (atenção/danificado/divergência por setor), PCP (stand-by com o tempo segurado) e Rotas (não entrega, devolução, entrega desfeita; por caminhão e pessoa). Do maior problema para o menor. Quem vê: D-32 (fn_motivos_alcance).';

-- ----------------------------------------------------------------------------
-- 4 · O clique num motivo: as ocorrências, por cursor
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_motivos_detalhe(
  p_area      text,
  p_chave     text,
  p_de        timestamptz,
  p_ate       timestamptz,
  p_setor_id  bigint      default null,
  p_limite    integer     default 20,
  p_antes_em  timestamptz default null,
  p_antes_id  bigint      default null
)
returns table (
  id       bigint,
  quando   timestamptz,
  pessoa   text,
  onde     text,
  o_que    text,
  motivo   text,
  segundos bigint,
  card_id  bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  a        record;
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_em     timestamptz := coalesce(p_antes_em, 'infinity'::timestamptz);
  v_id     bigint := coalesce(p_antes_id, 9223372036854775807);
begin
  if p_de is null or p_ate is null or p_ate <= p_de or p_ate - p_de > interval '400 days' then
    raise exception 'Diga o período do painel (até um ano).' using errcode = 'check_violation';
  end if;
  select * into a from plt_privado.fn_motivos_alcance(p_setor_id);

  if p_area = 'pausa' then
    return query
      select pp.id, pp.inicio, u.nome, s.nome,
             plt_privado.fn_rotulo_card_motivos(c.id),
             coalesce(e.dados ->> 'motivo', e.dados ->> 'motivo_parada', m.texto),
             extract(epoch from plt_privado.fn_tempo_util(pp.inicio, coalesce(pp.fim, now()),
                                                          e.setor_origem_id, pp.usuario_id))::bigint,
             c.id
        from public.plt_pessoa_pausas pp
        join public.plt_eventos e on e.id = pp.evento_id
        join public.plt_cards c on c.id = pp.card_id
        left join public.plt_usuarios u on u.id = pp.usuario_id
        left join public.plt_setores s on s.id = e.setor_origem_id
        left join public.plt_motivos m on m.id = pp.motivo_id
       where pp.inicio >= p_de and pp.inicio < p_ate
         and e.setor_origem_id = any (a.producao)
         and (case when pp.motivo_id is not null then 'id:' || pp.motivo_id else 'outro' end) = p_chave
         and (pp.inicio, pp.id) < (v_em, v_id)
       order by pp.inicio desc, pp.id desc
       limit v_limite;

  elsif p_area = 'saida' then
    return query
      select pe.id, pe.ocorrido_em, u.nome, s.nome, null::text, pe.motivo,
             extract(epoch from plt_privado.fn_tempo_util(
               pe.ocorrido_em,
               coalesce((select min(x.ocorrido_em) from public.plt_presenca_eventos x
                          where x.usuario_id = pe.usuario_id and x.id > pe.id), now()),
               pe.setor_id, pe.usuario_id))::bigint,
             null::bigint
        from public.plt_presenca_eventos pe
        left join public.plt_usuarios u on u.id = pe.usuario_id
        left join public.plt_setores s on s.id = pe.setor_id
       where pe.tipo = 'saida' and pe.ocorrido_em >= p_de and pe.ocorrido_em < p_ate
         and pe.setor_id = any (a.producao)
         and 'txt:' || lower(coalesce(nullif(btrim(split_part(pe.motivo, ' — ', 1)), ''), 'Sem motivo')) = p_chave
         and (pe.ocorrido_em, pe.id) < (v_em, v_id)
       order by pe.ocorrido_em desc, pe.id desc
       limit v_limite;

  elsif p_area in ('mover', 'standby', 'nao_entregue', 'devolucao', 'desfeita', 'qualidade') then
    if (p_area = 'mover' and cardinality(a.producao) = 0)
       or (p_area = 'standby' and not a.ver_pcp)
       or (p_area in ('nao_entregue', 'devolucao', 'desfeita') and not a.ver_rotas)
       or (p_area = 'qualidade' and cardinality(a.producao) = 0) then
      return;
    end if;
    return query
      select e.id, e.ocorrido_em, u.nome,
             case when p_area in ('nao_entregue', 'devolucao', 'desfeita') then cam.nome
                  when p_area = 'mover' then concat_ws(' → ', so.nome, sd.nome)
                  else so.nome end,
             plt_privado.fn_rotulo_card_motivos(e.card_id),
             coalesce(e.observacao, e.dados ->> 'motivo'),
             case when p_area = 'standby' then
               extract(epoch from plt_privado.fn_tempo_util(
                 e.ocorrido_em,
                 coalesce((select s2.ocorrido_em from public.plt_eventos s2
                            where s2.evento_referencia_id = e.id and s2.tipo = 'pedido_standby_saiu'
                            order by s2.id limit 1), now()),
                 a.pcp_id, null))::bigint
             end,
             e.card_id
        from public.plt_eventos e
        left join public.plt_usuarios u on u.id = e.usuario_id
        left join public.plt_setores so on so.id = e.setor_origem_id
        left join public.plt_setores sd on sd.id = e.setor_destino_id
        left join public.plt_caminhoes cam on cam.id = (e.dados ->> 'caminhao_id')::bigint
       where e.ocorrido_em >= p_de and e.ocorrido_em < p_ate
         and (e.ocorrido_em, e.id) < (v_em, v_id)
         and case p_area
               when 'mover' then (e.dados ->> 'como') = 'mover_para_fila'
                                 and (e.setor_origem_id = any (a.producao) or e.setor_destino_id = any (a.producao))
               when 'standby' then e.tipo = 'pedido_standby_entrou'
               when 'nao_entregue' then e.tipo = 'entrega_nao_realizada'
               when 'devolucao' then e.tipo = 'pedido_devolvido'
               when 'desfeita' then e.tipo = 'entrega_desfeita'
               else e.tipo = 'qualidade_marcada' and e.setor_origem_id = any (a.producao)
                    and e.estado_qualidade in ('atencao', 'danificado')
             end
         and case when p_area = 'qualidade' then 'setor:' || e.setor_origem_id
                  when (e.dados ->> 'motivo_id') is not null then 'id:' || (e.dados ->> 'motivo_id')
                  when e.origem = 'automacao' then 'tiny'
                  when e.dados ->> 'motivo' = 'reentrega' then 'reentrega'
                  else 'outro' end = p_chave
       order by e.ocorrido_em desc, e.id desc
       limit v_limite;
  else
    raise exception 'Área desconhecida no painel de motivos.' using errcode = 'check_violation';
  end if;
end;
$$;

comment on function public.plt_fn_dash_motivos_detalhe(text, text, timestamptz, timestamptz, bigint, integer, timestamptz, bigint) is
  'SESSAO-39 (D-176): o clique num motivo do painel — as ocorrências (quando, quem, onde, o quê, o motivo escrito, o tempo útil quando há), da mais nova para a mais velha, por cursor (p_antes_em, p_antes_id); teto de 100. Mesmo alcance do painel (fn_motivos_alcance).';

-- O "o quê" de uma ocorrência: "Pedido 13704 · Armário (1/2)" · o título do avulso.
create or replace function plt_privado.fn_rotulo_card_motivos(p_card_id bigint)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when c.tipo = 'avulso' then c.titulo
              else concat_ws(' · ',
                             case when p.numero is not null then 'Pedido ' || p.numero end,
                             c.item_descricao || case when c.indice_unidade is not null
                                                      then ' (' || c.indice_unidade || '/' || c.total_unidades || ')'
                                                      else '' end)
         end
    from public.plt_cards c
    left join public.pedidos p on p.id = c.pedido_id
   where c.id = p_card_id;
$$;

revoke all on function public.plt_fn_dash_motivos(timestamptz, timestamptz, bigint) from public, anon;
grant execute on function public.plt_fn_dash_motivos(timestamptz, timestamptz, bigint) to authenticated;
revoke all on function public.plt_fn_dash_motivos_detalhe(text, text, timestamptz, timestamptz, bigint, integer, timestamptz, bigint) from public, anon;
grant execute on function public.plt_fn_dash_motivos_detalhe(text, text, timestamptz, timestamptz, bigint, integer, timestamptz, bigint) to authenticated;
revoke all on function plt_privado.fn_motivos_alcance(bigint) from public, anon, authenticated;
revoke all on function plt_privado.fn_rotulo_card_motivos(bigint) from public, anon, authenticated;
