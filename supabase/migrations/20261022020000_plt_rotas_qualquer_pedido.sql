-- ============================================================================
-- SESSAO-38 · F2 — Logística: a rota para QUALQUER pedido vivo, a Expedição
-- com filtros e o fim da tela "Pedidos em aguardo" (pedido do dono, 21/10/2026)
--
-- O que muda (D-156 · D-157 · D-158 — ⏳ provisórias, escolhas do Claude):
--   1. Uma regra só para "pedido vivo" (D-133 + D-140), lida pela Expedição e
--      pelas rotas: plt_privado.vw_pedidos_vivos. Os candidatos da rota são os
--      vivos que não estão em decisão pós devolução: plt_privado.vw_pedidos_para_rota
--      (é ali que o "stand-by" de outra frente entra — UMA condição).
--   2. A prontidão de cada pedido (total, liberadas, prontas, pronto, estado)
--      numa regra só: plt_privado.vw_pedido_prontidao.
--   3. Programar não depende mais do "Lançar para ROTAS": todo pedido vivo se
--      programa (pronto, em produção ou ainda no PCP). A peça pronta fica em
--      Pedidos em aguardo (o lugar interno) até a entrega; "Entregue" exige o
--      pedido pronto (peças no fim de linha: aguardo ou ROTAS) e fecha tudo.
--   4. O card do pedido programado fica como registro da entrega (como o
--      lançado) — o entregador ainda desfaz no mesmo dia.
--   5. A equipe da rota: só entregador (módulo "entregas" — D-115).
--   6. A Expedição numa porta só: a página + os números dos filtros.
--
-- Compatível com o site publicado: as portas mantêm o nome e os parâmetros;
-- as que mudam de forma só GANHAM colunas (drop + create — A-12/E-17, com o
-- drop também nas migrations antigas que faziam create or replace). O
-- "Lançar para ROTAS" continua funcionando para o site antigo.
-- ============================================================================

set local lock_timeout = '5s';

-- Lei §7.2: o filtro dos pedidos vivos (card do pedido não arquivado e sem
-- entrega) com índice próprio — o card de pedido entregue/arquivado só cresce.
create index if not exists plt_cards_pedido_vivo_idx
  on public.plt_cards (pedido_id)
  where tipo = 'pedido' and arquivado_em is null and entrega_evento_id is null;

-- ----------------------------------------------------------------------------
-- 1 · A prontidão do pedido — uma regra só
-- ----------------------------------------------------------------------------
create or replace view plt_privado.vw_pedido_prontidao as
select pc.id                                         as card_id,
       pc.pedido_id,
       coalesce(i.total, 0)                          as total_unidades,
       -- SESSAO-31 (D-130): na reentrega, o que já foi entregue não falta.
       greatest(coalesce(i.total, 0) - coalesce(j.entregues, 0), 0) as a_entregar,
       coalesce(u.liberadas, 0)                      as unidades_liberadas,
       coalesce(u.prontas, 0)                        as unidades_prontas,
       u.primeira_pronta_em,
       u.ultima_pronta_em,
       -- D-63: pedido sem nada a produzir (só frete) está pronto desde que nasceu.
       (coalesce(i.total, 0) = 0
        or coalesce(u.prontas, 0) >= greatest(coalesce(i.total, 0) - coalesce(j.entregues, 0), 1)) as pronto,
       case
         when coalesce(i.total, 0) = 0
           or coalesce(u.prontas, 0) >= greatest(coalesce(i.total, 0) - coalesce(j.entregues, 0), 1)
           then 'pronto'
         when coalesce(u.liberadas, 0) = 0 then 'no_pcp'
         else 'em_producao'
       end                                           as estado
  from public.plt_cards pc
  left join lateral (
    -- D-63: frete não conta.
    select sum(v.unidades)::int as total
      from plt_privado.vw_itens_producao v where v.pedido_id = pc.pedido_id
  ) i on true
  left join lateral (
    select count(*)::int as liberadas,
           -- pronta = no fim de linha (aguardo, ROTAS); em decisão pós devolução não (D-129)
           (count(*) filter (where s.papel_no_fluxo = 'terminal' and s.codigo <> 'devolucao'))::int as prontas,
           min(cu.concluido_em) filter (where s.papel_no_fluxo = 'terminal' and s.codigo <> 'devolucao') as primeira_pronta_em,
           max(cu.concluido_em) filter (where s.papel_no_fluxo = 'terminal' and s.codigo <> 'devolucao') as ultima_pronta_em
      from public.plt_cards cu
      left join public.plt_setores s on s.id = cu.setor_atual_id
     where cu.pedido_id = pc.pedido_id and cu.tipo = 'unidade' and cu.arquivado_em is null
  ) u on true
  left join lateral (
    select plt_privado.fn_unidades_ja_entregues(pc.pedido_id) as entregues
  ) j on true
 where pc.tipo = 'pedido' and pc.pedido_id is not null;

comment on view plt_privado.vw_pedido_prontidao is
  'SESSAO-38 (D-156): a prontidão de cada card de pedido — total (sem frete), a entregar (sem o já entregue), liberadas, prontas (no fim de linha, fora da devolução), pronto e estado (pronto | em_producao | no_pcp). Regra única: Expedição, Programação, ROTAS e Entregas do dia leem daqui.';

-- ----------------------------------------------------------------------------
-- 2 · O pedido VIVO (D-133 + D-140) — uma regra só para Expedição e rotas
-- ----------------------------------------------------------------------------
create or replace view plt_privado.vw_pedidos_vivos as
select pc.id                    as card_id,
       p.id                     as pedido_id,
       p.numero,
       p.cliente_id,
       p.data_prevista,
       p.situacao,
       pc.lancado_rotas_em,
       pc.devolucao_evento_id,
       pp.total_unidades,
       pp.a_entregar,
       pp.unidades_liberadas,
       pp.unidades_prontas,
       pp.primeira_pronta_em,
       pp.ultima_pronta_em,
       pp.pronto,
       pp.estado,
       pr.data_entrega          as programacao_data,
       pr.caminhao_id,
       pr.rota::int             as rota,
       pr.ordem,
       pr.detalhe
  from public.plt_cards pc
  join public.pedidos p on p.id = pc.pedido_id
  join plt_privado.vw_pedido_prontidao pp on pp.card_id = pc.id
  left join public.plt_programacoes pr on pr.card_id = pc.id
 where pc.tipo = 'pedido'
   and pc.arquivado_em is null
   -- sem entrega registrada na plataforma
   and pc.entrega_evento_id is null
   -- não encerrado no Tiny (entregue, não entregue, cancelado)
   and plt_privado.fn_situacao_normalizada(p.situacao) not in ('entregue', 'nao_entregue', 'cancelado')
   -- D-132/D-133: o que o Tiny já levou adiante só fica com peça dele na fábrica
   and (not plt_privado.fn_tiny_tirou_do_pcp(p.situacao) or pp.unidades_liberadas > 0)
   -- D-140: excluído no Tiny não existe em módulo nenhum
   and not exists (select 1 from public.plt_pedidos_excluidos_tiny x where x.pedido_id = p.id);

comment on view plt_privado.vw_pedidos_vivos is
  'SESSAO-38 (D-156): o pedido VIVO — card do pedido não arquivado, sem entrega, não encerrado no Tiny (entregue/não entregue/cancelado), o levado adiante pelo Tiny só com peça na fábrica (D-133), nunca o excluído no Tiny (D-140). Com a prontidão e a programação. A Expedição lê daqui.';

-- Os candidatos da ROTA: os vivos fora da decisão pós devolução (D-129).
-- ⚠️ Para quem vier depois: o "stand-by" (outra frente) entra AQUI, como mais
-- uma condição no WHERE — Programação, ROTAS e o gesto de programar obedecem.
create or replace view plt_privado.vw_pedidos_para_rota as
select v.*
  from plt_privado.vw_pedidos_vivos v
 where v.devolucao_evento_id is null;

comment on view plt_privado.vw_pedidos_para_rota is
  'SESSAO-38 (D-156): os pedidos que podem entrar numa rota — os vivos (vw_pedidos_vivos) fora da decisão pós devolução. Regra ÚNICA dos candidatos: plt_fn_programacao, plt_fn_rotas e plt_fn_programar_entrega leem daqui. Novas exclusões (stand-by) entram neste WHERE.';

revoke all on plt_privado.vw_pedido_prontidao, plt_privado.vw_pedidos_vivos, plt_privado.vw_pedidos_para_rota
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3 · Programação → "Programar": todo pedido vivo (D-156)
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_programacao(date, integer, integer, boolean);
create function public.plt_fn_programacao(
  p_data               date    default null,
  p_limite             integer default 100,
  p_deslocamento       integer default 0,
  p_so_sem_programacao boolean default false
)
returns table (
  card_id                 bigint,
  pedido_id               bigint,
  numero                  integer,
  cliente_nome            text,
  endereco                text,
  numero_endereco         text,
  complemento             text,
  bairro                  text,
  cidade                  text,
  uf                      text,
  endereco_geocodificavel text,
  geo_chave               text,
  latitude                double precision,
  longitude               double precision,
  geo_resolvido           boolean,
  geo_consultado_em       timestamptz,
  total_unidades          integer,
  itens                   jsonb,
  data_prevista           date,
  lancado_em              timestamptz,
  programacao_data        date,
  caminhao_id             bigint,
  caminhao_nome           text,
  ordem                   integer,
  -- SESSAO-38 (D-156): o pedido pode estar pronto, em produção ou no PCP.
  estado                  text,
  unidades_prontas        integer,
  unidades_liberadas      integer,
  contagem_total          bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select v.card_id,
           v.pedido_id,
           v.numero,
           coalesce(c.nome, '')         as cliente_nome,
           c.endereco,
           c.numero                     as numero_endereco,
           c.complemento,
           c.bairro,
           c.cidade,
           c.uf,
           plt_privado.fn_endereco_geocodificavel(
             c.endereco, c.numero, c.bairro, c.cidade, c.uf, c.cep) as endereco_geocodificavel,
           v.total_unidades,
           coalesce(i.itens, '[]'::jsonb) as itens,
           v.data_prevista,
           v.lancado_rotas_em            as lancado_em,
           v.programacao_data,
           cam.id                        as caminhao_id,
           cam.nome                      as caminhao_nome,
           v.ordem,
           v.estado,
           v.unidades_prontas,
           v.unidades_liberadas
      from plt_privado.vw_pedidos_para_rota v
      left join public.clientes c on c.id = v.cliente_id
      left join lateral (
        -- D-63: frete não conta nem aparece; os móveis com a quantidade.
        select jsonb_agg(jsonb_build_object('descricao', coalesce(nullif(btrim(it.descricao), ''), 'Item sem descrição'),
                                            'quantidade', it.unidades) order by it.seq)
                 filter (where not it.eh_frete and it.unidades > 0) as itens
          from plt_privado.vw_itens_producao it where it.pedido_id = v.pedido_id
      ) i on true
      left join public.plt_caminhoes cam on cam.id = v.caminhao_id
     where v.programacao_data is null
        or (not coalesce(p_so_sem_programacao, false)
            and (p_data is null or v.programacao_data = p_data))
  )
  select b.card_id, b.pedido_id, b.numero, b.cliente_nome,
         b.endereco, b.numero_endereco, b.complemento, b.bairro, b.cidade, b.uf,
         b.endereco_geocodificavel,
         case when b.endereco_geocodificavel is null then null
              else md5(lower(b.endereco_geocodificavel)) end as geo_chave,
         g.latitude, g.longitude,
         g.resolvido       as geo_resolvido,
         g.consultado_em   as geo_consultado_em,
         b.total_unidades, b.itens, b.data_prevista, b.lancado_em,
         b.programacao_data, b.caminhao_id, b.caminhao_nome,
         b.ordem,
         b.estado, b.unidades_prontas, b.unidades_liberadas,
         count(*) over () as contagem_total
    from base b
    left join public.plt_geocache g
           on b.endereco_geocodificavel is not null
          and g.chave = md5(lower(b.endereco_geocodificavel))
   where plt_privado.fn_pode_ver_expedicao()
   order by (b.programacao_data is not null), b.data_prevista asc nulls last, b.numero
   limit least(greatest(coalesce(p_limite, 100), 1), 200)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_programacao(date, integer, integer, boolean) is
  'SESSAO-15/28/38: os pedidos da Programação — sem programação (sempre) + os programados no dia (a não ser com p_so_sem_programacao). SESSAO-38 (D-156): TODO pedido vivo (vw_pedidos_para_rota), pronto ou não — com estado (pronto | em_producao | no_pcp), prontas e liberadas.';

revoke all on function public.plt_fn_programacao(date, integer, integer, boolean) from public, anon;
grant execute on function public.plt_fn_programacao(date, integer, integer, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 4 · Programar / reprogramar: sem o "lançado"; o candidato é o vivo (D-156)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_programar_entrega(
  p_card_id     bigint,
  p_data        date,
  p_caminhao_id bigint,
  p_rota        integer default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_card    public.plt_cards%rowtype;
  v_atual   public.plt_programacoes%rowtype;
  v_rota    integer;
  v_nova    boolean;
  v_id      bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma programa entregas.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Programar entrega é gesto da logística (PCP/terminais) ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_data is null then
    raise exception 'Escolha o dia da entrega.' using errcode = 'check_violation';
  end if;

  select * into v_card from public.plt_cards
   where id = p_card_id and tipo = 'pedido' and arquivado_em is null;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  -- D-45: reprograma a qualquer instante, nunca depois de entregue.
  if plt_privado.fn_entregue(p_card_id) then
    raise exception 'Este pedido já foi entregue — a programação não muda mais.' using errcode = 'check_violation';
  end if;
  -- SESSAO-38 (D-156): o "lançado para ROTAS" deixou de ser exigência — todo
  -- pedido VIVO se programa (pronto, em produção ou ainda no PCP). A regra dos
  -- candidatos é uma só: plt_privado.vw_pedidos_para_rota.
  if not exists (select 1 from plt_privado.vw_pedidos_para_rota v where v.card_id = p_card_id) then
    if plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
      raise exception 'Este pedido foi cancelado no Tiny — não vai para a rota.' using errcode = 'check_violation';
    elsif v_card.devolucao_evento_id is not null then
      raise exception 'Este pedido está em decisão pós devolução — decida a situação das peças antes de programar.'
        using errcode = 'check_violation';
    end if;
    raise exception 'Este pedido não está mais em andamento (encerrado no Tiny ou sem peça na fábrica) — não vai para a rota.'
      using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.plt_caminhoes cm
                  where cm.id = p_caminhao_id and cm.arquivado_em is null) then
    raise exception 'Caminhão não encontrado ou arquivado — escolha outro.' using errcode = 'no_data_found';
  end if;

  -- SESSAO-31 (D-128): sem rota dita, o pedido fica na rota em que já está
  -- (mesmo dia e caminhão) ou entra na última rota do caminhão no dia.
  select * into v_atual from public.plt_programacoes where card_id = p_card_id;
  v_rota := coalesce(p_rota,
                     case when v_atual.card_id is not null and v_atual.data_entrega = p_data
                               and v_atual.caminhao_id = p_caminhao_id then v_atual.rota::int end,
                     plt_privado.fn_rota_padrao(p_data, p_caminhao_id));
  if v_rota < 1 or v_rota > 20 then
    raise exception 'A rota vai de 1 a 20 no mesmo dia e caminhão.' using errcode = 'check_violation';
  end if;
  v_nova := not exists (select 1 from public.plt_programacoes pr
                         where pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id
                           and pr.rota = v_rota and pr.card_id <> p_card_id);

  insert into public.plt_programacoes as pr
         (card_id, data_entrega, caminhao_id, rota, criado_por_id, atualizado_por_id)
       values (p_card_id, p_data, p_caminhao_id, v_rota, v_usuario, v_usuario)
  on conflict (card_id) do update
     set data_entrega = excluded.data_entrega,
         caminhao_id  = excluded.caminhao_id,
         rota         = excluded.rota,
         atualizado_por_id = excluded.atualizado_por_id,
         -- SESSAO-28 (D-109): noutro dia/caminhão (ou noutra rota — D-128) a
         -- ordem antiga não vale — a parada vai para o fim da rota nova.
         ordem = case when pr.data_entrega is distinct from excluded.data_entrega
                        or pr.caminhao_id  is distinct from excluded.caminhao_id
                        or pr.rota         is distinct from excluded.rota
                      then null else pr.ordem end
  returning id into v_id;

  if v_nova then
    perform plt_privado.fn_equipe_herdar(p_data, p_caminhao_id, v_rota, v_usuario);
  end if;
  return v_id;
end;
$$;


-- ----------------------------------------------------------------------------
-- 5 · "Já programadas": com a prontidão; o histórico inclui o card que saiu
--     com a entrega
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_programadas(boolean, date, bigint, integer, integer);
create function public.plt_fn_programadas(
  p_entregues    boolean default false,
  p_data         date    default null,
  p_caminhao_id  bigint  default null,
  p_limite       integer default 50,
  p_deslocamento integer default 0
)
returns table (
  card_id                 bigint,
  pedido_id               bigint,
  numero                  integer,
  cliente_nome            text,
  endereco                text,
  numero_endereco         text,
  complemento             text,
  bairro                  text,
  cidade                  text,
  uf                      text,
  geo_chave               text,
  latitude                double precision,
  longitude               double precision,
  geo_resolvido           boolean,
  total_unidades          integer,
  itens                   jsonb,
  data_prevista           date,
  programacao_data        date,
  caminhao_id             bigint,
  caminhao_nome           text,
  caminhao_placa          text,
  rota                    integer,
  ordem                   integer,
  entregue_em             timestamptz,
  detalhe                 text,
  equipe                  text[],
  -- SESSAO-38 (D-156): pronto, em produção ou no PCP.
  estado                  text,
  unidades_prontas        integer,
  unidades_liberadas      integer,
  contagem_total          bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select pc.id                         as card_id,
           p.id                          as pedido_id,
           p.numero,
           coalesce(c.nome, '')          as cliente_nome,
           c.endereco,
           c.numero                      as numero_endereco,
           c.complemento,
           c.bairro,
           c.cidade,
           c.uf,
           plt_privado.fn_endereco_geocodificavel(
             c.endereco, c.numero, c.bairro, c.cidade, c.uf, c.cep) as endereco_geocodificavel,
           coalesce(i.total_unidades, 0) as total_unidades,
           coalesce(i.itens, '[]'::jsonb) as itens,
           p.data_prevista,
           pr.data_entrega               as programacao_data,
           cam.id                        as caminhao_id,
           cam.nome                      as caminhao_nome,
           cam.placa                     as caminhao_placa,
           pr.rota::int                  as rota,
           pr.ordem,
           ent.ocorrido_em               as entregue_em,
           pr.detalhe,
           eq.nomes                      as equipe,
           pp.estado,
           pp.unidades_prontas,
           pp.unidades_liberadas
      from public.plt_programacoes pr
      join public.plt_cards pc on pc.id = pr.card_id
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
      left join plt_privado.vw_pedido_prontidao pp on pp.card_id = pc.id
      left join lateral (
        select e.ocorrido_em from public.plt_eventos e
         where e.id = pc.entrega_evento_id
         order by e.ocorrido_em desc limit 1
      ) ent on true
      left join lateral (
        select coalesce(sum(v.unidades), 0)::int as total_unidades,
               jsonb_agg(jsonb_build_object('descricao', coalesce(nullif(btrim(v.descricao), ''), 'Item sem descrição'),
                                            'quantidade', v.unidades) order by v.seq)
                 filter (where not v.eh_frete and v.unidades > 0) as itens
          from plt_privado.vw_itens_producao v where v.pedido_id = p.id
      ) i on true
      -- SESSAO-37 (pedido do dono, 19/10): a equipe da rota aparece no card
      left join lateral (
        select array_agg(u.nome order by u.nome) as nomes
          from public.plt_programacao_equipes pe
          join public.plt_usuarios u on u.id = pe.usuario_id
         where pe.data_entrega = pr.data_entrega
           and pe.caminhao_id = pr.caminhao_id
           and pe.rota = pr.rota
      ) eq on true
     where pc.tipo = 'pedido'
       -- SESSAO-38: o card que saiu com a entrega (pedido nunca lançado) ainda
       -- conta no histórico das entregues
       and (pc.arquivado_em is null
            or (coalesce(p_entregues, false) and pc.entrega_evento_id is not null))
       and (p_data is null or pr.data_entrega = p_data)
       and (p_caminhao_id is null or pr.caminhao_id = p_caminhao_id)
       and (case when coalesce(p_entregues, false) then ent.ocorrido_em is not null
                 else ent.ocorrido_em is null end)
  )
  select b.card_id, b.pedido_id, b.numero, b.cliente_nome,
         b.endereco, b.numero_endereco, b.complemento, b.bairro, b.cidade, b.uf,
         case when b.endereco_geocodificavel is null then null
              else md5(lower(b.endereco_geocodificavel)) end as geo_chave,
         g.latitude, g.longitude, g.resolvido as geo_resolvido,
         b.total_unidades, b.itens, b.data_prevista,
         b.programacao_data, b.caminhao_id, b.caminhao_nome, b.caminhao_placa,
         b.rota, b.ordem, b.entregue_em, b.detalhe,
         coalesce(b.equipe, '{}'::text[]) as equipe,
         b.estado, b.unidades_prontas, b.unidades_liberadas,
         count(*) over () as contagem_total
    from base b
    left join public.plt_geocache g
           on b.endereco_geocodificavel is not null
          and g.chave = md5(lower(b.endereco_geocodificavel))
   where plt_privado.fn_pode_ver_expedicao()
   order by case when coalesce(p_entregues, false) then null else b.programacao_data end asc,
            case when coalesce(p_entregues, false) then b.programacao_data end desc,
            b.caminhao_nome, b.caminhao_id, b.rota, b.ordem nulls last, b.numero
   limit least(greatest(coalesce(p_limite, 50), 1), 200)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_programadas(boolean, date, bigint, integer, integer) is
  'SESSAO-28/31/37: as programações (dia → caminhão → rota → ordem), paginadas no servidor, com a equipe da rota. SESSAO-38 (D-156): + estado/prontas/liberadas (o programado pode ainda estar em produção).';

revoke all on function public.plt_fn_programadas(boolean, date, bigint, integer, integer) from public, anon;
grant execute on function public.plt_fn_programadas(boolean, date, bigint, integer, integer) to authenticated;

-- ----------------------------------------------------------------------------
-- 6 · ROTAS → Entregas → "A entregar": o pronto e o programado (D-156)
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_rotas(text, text, integer, integer);
create function public.plt_fn_rotas(
  p_situacao      text default null, -- 'pronta' (a entregar) | 'entregue'
  p_busca         text default null,
  p_limite        integer default 20,
  p_deslocamento  integer default 0
)
returns table (
  card_id           bigint,
  pedido_id         bigint,
  numero            integer,
  cliente_nome      text,
  telefone          text,
  endereco          text,
  numero_endereco   text,
  complemento       text,
  bairro            text,
  cidade            text,
  uf                text,
  obs               text,
  data_prevista     date,
  total_unidades    integer,
  unidades_em_rotas integer,
  situacao_entrega  text,
  entregue_em       timestamptz,
  entregue_por      text,
  lancado_em        timestamptz,
  programacao_data  date,
  caminhao_id       bigint,
  caminhao_nome     text,
  caminhao_placa    text,
  caminhao_foto     text,
  -- SESSAO-38 (D-156): pronto, em produção ou no PCP.
  estado            text,
  unidades_prontas  integer,
  unidades_liberadas integer,
  contagem_total    bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with rotas as (
    select s.id from public.plt_setores s where s.codigo = 'rotas'
  ),
  base as (
    select pc.id                        as card_id,
           p.id                         as pedido_id,
           p.numero,
           coalesce(c.nome, '')         as cliente_nome,
           c.fone                       as telefone,
           c.endereco,
           c.numero                     as numero_endereco,
           c.complemento,
           c.bairro,
           c.cidade,
           c.uf,
           p.obs,
           p.data_prevista,
           coalesce(pp.total_unidades, 0) as total_unidades,
           coalesce(u.em_rotas, 0)       as unidades_em_rotas,
           ent.ocorrido_em               as entregue_em,
           ent_nome.nome                 as entregue_por,
           pc.lancado_rotas_em           as lancado_em,
           pr.data_entrega               as programacao_data,
           cam.id                        as caminhao_id,
           cam.nome                      as caminhao_nome,
           cam.placa                     as caminhao_placa,
           cam.foto_caminho              as caminhao_foto,
           pp.estado,
           coalesce(pp.unidades_prontas, 0)   as unidades_prontas,
           coalesce(pp.unidades_liberadas, 0) as unidades_liberadas
      from public.plt_cards pc
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join plt_privado.vw_pedido_prontidao pp on pp.card_id = pc.id
      left join plt_privado.vw_pedidos_para_rota cand on cand.card_id = pc.id
      left join lateral (
        select count(*)::int as em_rotas
          from public.plt_cards cu
         where cu.pedido_id = p.id and cu.tipo = 'unidade'
           and cu.arquivado_em is null
           and cu.setor_atual_id in (select id from rotas)
      ) u on true
      left join lateral (
        select e.ocorrido_em, e.usuario_id
          from public.plt_eventos e
         where e.id = pc.entrega_evento_id
         order by e.ocorrido_em desc limit 1
      ) ent on true
      left join public.plt_usuarios ent_nome on ent_nome.id = ent.usuario_id
      left join public.plt_programacoes pr on pr.card_id = pc.id
      left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
     where pc.tipo = 'pedido' and pc.arquivado_em is null
       -- só a situação pedida (o entregue não varre o "a entregar" e vice-versa)
       and (p_situacao is null
            or (p_situacao = 'entregue') = (pc.entrega_evento_id is not null))
       -- D-45 (o lançado) + SESSAO-38 (D-156): o programado e o candidato pronto
       and (pc.lancado_rotas_em is not null
            or pr.card_id is not null
            or (cand.card_id is not null and cand.pronto))
  )
  select b.card_id, b.pedido_id, b.numero, b.cliente_nome, b.telefone,
         b.endereco, b.numero_endereco, b.complemento, b.bairro, b.cidade, b.uf,
         b.obs, b.data_prevista, b.total_unidades, b.unidades_em_rotas,
         case when b.entregue_em is not null then 'entregue' else 'pronta' end as situacao_entrega,
         b.entregue_em, b.entregue_por, b.lancado_em,
         b.programacao_data, b.caminhao_id, b.caminhao_nome, b.caminhao_placa, b.caminhao_foto,
         case when b.entregue_em is not null then 'entregue' else b.estado end as estado,
         b.unidades_prontas, b.unidades_liberadas,
         count(*) over () as contagem_total
    from base b
   where plt_privado.fn_pode_ver_expedicao()
     and (p_situacao is null
          or (case when b.entregue_em is not null then 'entregue' else 'pronta' end) = p_situacao)
     and (p_busca is null or btrim(p_busca) = ''
          or b.numero::text like btrim(p_busca) || '%'
          or b.cliente_nome ilike '%' || btrim(p_busca) || '%')
   order by (b.entregue_em is not null),
            coalesce(b.programacao_data, b.data_prevista) asc nulls last,
            b.numero
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_rotas(text, text, integer, integer) is
  'SESSAO-11/15/30/38: ROTAS → Entregas. SESSAO-38 (D-156): "a entregar" = o lançado + o programado (pronto ou não) + o candidato pronto ainda sem programação; com estado/prontas/liberadas.';

revoke all on function public.plt_fn_rotas(text, text, integer, integer) from public, anon;
grant execute on function public.plt_fn_rotas(text, text, integer, integer) to authenticated;

-- ----------------------------------------------------------------------------
-- 7 · "Entregue": sem o "lançado"; o pedido PRONTO (peças no fim de linha)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_registrar_entrega(
  p_card_id    bigint,
  p_observacao text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario  uuid;
  v_card     public.plt_cards%rowtype;
  v_total    integer;
  v_em_rotas integer;
  v_ret      jsonb;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma registra entrega.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_mexer_entrega(p_card_id) then
    raise exception 'Registrar entrega é gesto da logística (PCP/terminais), do entregador do caminhão ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  -- SESSAO-38 (D-156): sem o "lançado para ROTAS" — o pedido programado (ou
  -- pronto) se entrega com as peças onde estiverem no fim de linha. Em
  -- decisão pós devolução não se entrega (a logística decide antes — D-129).
  if v_card.devolucao_evento_id is not null and v_card.entrega_evento_id is null then
    raise exception 'Este pedido está em decisão pós devolução — decida a situação das peças antes de entregar.'
      using errcode = 'check_violation';
  end if;
  if v_card.entrega_evento_id is not null then
    -- SESSAO-30 (Lei §10): o mesmo toque repetido (a rede que volta, o dedo
    -- que toca duas vezes) = uma entrega só — devolve a que já existe.
    if exists (select 1 from public.plt_eventos e
                where e.id = v_card.entrega_evento_id and e.usuario_id = v_usuario
                  and e.ocorrido_em > now() - interval '10 minutes') then
      return v_card.entrega_evento_id;
    end if;
    raise exception 'Este pedido já foi registrado como entregue.' using errcode = 'check_violation';
  end if;
  if plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
    raise exception 'Este pedido foi cancelado no Tiny — não se entrega.' using errcode = 'check_violation';
  end if;

  -- D-63: frete não conta. D-33: entrega por pedido completo — do que falta
  -- entregar (SESSAO-31, D-130: a reentrega depois do ajuste leva só o que voltou).
  v_total := plt_privado.fn_unidades_a_entregar(v_card.pedido_id);
  -- SESSAO-38 (D-156): pronta = no fim de linha (Pedidos em aguardo ou ROTAS),
  -- fora da decisão pós devolução — a mesma regra da prontidão (vw_pedido_prontidao).
  select count(*)::int into v_em_rotas
    from public.plt_cards cu
    join public.plt_setores s on s.id = cu.setor_atual_id
   where cu.pedido_id = v_card.pedido_id and cu.tipo = 'unidade'
     and cu.arquivado_em is null and s.papel_no_fluxo = 'terminal' and s.codigo <> 'devolucao';
  if v_em_rotas < v_total then
    raise exception 'A entrega sai com o pedido pronto: % de % peça(s) prontas — o resto ainda está na produção ou no PCP.', v_em_rotas, v_total
      using errcode = 'check_violation';
  end if;

  v_ret := plt_privado.fn_fechar_pedido(p_card_id, v_usuario, 'interface', p_observacao, 'plataforma');
  perform plt_privado.fn_tiny_pedido_enfileirar(v_card.pedido_id, 'entregue', 'entregue');
  return (v_ret ->> 'entrega_evento_id')::bigint;
end;
$$;


-- O card do pedido programado fica como registro da entrega (como o lançado).
create or replace function plt_privado.fn_fechar_pedido(
  p_card_pedido_id bigint,
  p_usuario        uuid,
  p_origem         text,
  p_observacao     text,
  p_fonte          text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card      public.plt_cards%rowtype;
  v_numero    integer;
  v_situacao  text;
  v_entrega   bigint;
  v_nova      boolean := false;
  v_vivas     integer;
  v_unidades  integer := 0;
  v_tempos    integer := 0;
  v_reservas  integer := 0;
  v_card_saiu boolean := false;
  v_marca_e   text;
  v_marca_m   text;
  r           record;
begin
  select * into v_card from public.plt_cards
   where id = p_card_pedido_id and tipo = 'pedido'
   for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_pedido_id using errcode = 'no_data_found';
  end if;
  select p.numero, p.situacao into v_numero, v_situacao
    from public.pedidos p where p.id = v_card.pedido_id;

  select count(*)::int into v_vivas
    from public.plt_cards u
   where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null;

  -- Card já arquivado e nada vivo: história antiga — nada a fechar.
  if v_card.arquivado_em is not null and v_vivas = 0
     and not exists (select 1 from public.plt_cards s
                      where s.reservada_pedido_id = v_card.pedido_id and s.arquivado_em is null) then
    return jsonb_build_object('fechou', false, 'motivo', 'arquivado', 'numero', v_numero);
  end if;

  v_marca_e := current_setting('plt.entrega_maquinaria', true);
  v_marca_m := current_setting('plt.estoque_maquinaria', true);
  perform set_config('plt.entrega_maquinaria', 'on', true);
  -- SESSAO-30 (raio-x 2): a peça do estoque reservada sai com o pedido.
  perform set_config('plt.estoque_maquinaria', 'on', true);

  -- SESSAO-30 (etapa 4): a entrega VIGENTE (a desfeita não conta).
  v_entrega := v_card.entrega_evento_id;
  if v_entrega is null then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (v_card.id, 'pedido_entregue', p_usuario, p_origem,
              nullif(btrim(p_observacao), ''),
              jsonb_build_object('fonte', p_fonte, 'numero', v_numero,
                                 'situacao_tiny', v_situacao, 'unidades', v_vivas,
                                 'lancado_rotas', v_card.lancado_rotas_em is not null))
      returning id into v_entrega;
    v_nova := true;
  end if;

  -- Cada peça viva do pedido sai de toda conta (estoque, reservas, ROTAS ativa,
  -- Visão do dia) e fica no histórico — o tempo aberto fecha antes.
  for r in
    select c.id from public.plt_cards c
     where c.pedido_id = v_card.pedido_id and c.tipo = 'unidade' and c.arquivado_em is null
     order by c.id
       for update
  loop
    if plt_privado.fn_fechar_tempo_aberto(r.id, 'O pedido foi entregue: o tempo aberto fecha antes de a peça sair.') then
      v_tempos := v_tempos + 1;
    end if;
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (r.id, 'card_arquivado', p_usuario, p_origem,
              'Pedido ' || coalesce(v_numero::text, '') || ' entregue — a peça saiu com ele.',
              jsonb_build_object('motivo', 'entregue', 'entrega_evento_id', v_entrega,
                                 'fonte', p_fonte, 'numero', v_numero));
    v_unidades := v_unidades + 1;
  end loop;

  -- A peça do ESTOQUE reservada pela venda sai com o pedido (motivo "venda" —
  -- a mesma baixa da D-78; não volta ao Tiny, que já baixou na venda).
  for r in
    select c.id, c.setor_atual_id, c.reservada_item_seq, c.reservada_indice, c.produto_tiny_id
      from public.plt_cards c
     where c.reservada_pedido_id = v_card.pedido_id and c.arquivado_em is null
     order by c.id
       for update
  loop
    insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
      values (r.id, 'card_arquivado', 'api', r.setor_atual_id,
              format('Saiu com o pedido %s (entregue).', v_numero),
              jsonb_build_object('motivo', 'venda', 'pedido_id', v_card.pedido_id, 'numero', v_numero,
                                 'item_seq', r.reservada_item_seq, 'indice_unidade', r.reservada_indice,
                                 'produto_tiny_id', r.produto_tiny_id, 'entrega_evento_id', v_entrega));
    v_reservas := v_reservas + 1;
  end loop;

  -- O card do pedido que nunca foi às ROTAS sai do PCP (o lançado fica: é o
  -- registro da entrega em ROTAS → Entregas e em "Já programadas").
  -- SESSAO-38 (D-156): o PROGRAMADO também fica (a entrega dele aparece em
  -- "Entregas do dia" para desfazer no mesmo dia e no histórico da Programação).
  if v_card.lancado_rotas_em is null and v_card.arquivado_em is null
     and not exists (select 1 from public.plt_programacoes pr where pr.card_id = v_card.id) then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (v_card.id, 'card_arquivado', p_usuario, p_origem,
              'Pedido entregue — sai do PCP.',
              jsonb_build_object('motivo', 'entregue', 'entrega_evento_id', v_entrega,
                                 'fonte', p_fonte, 'numero', v_numero));
    v_card_saiu := true;
  end if;

  perform set_config('plt.entrega_maquinaria', coalesce(v_marca_e, ''), true);
  perform set_config('plt.estoque_maquinaria', coalesce(v_marca_m, ''), true);
  return jsonb_build_object('fechou', true, 'numero', v_numero, 'entrega_evento_id', v_entrega,
                            'entrega_nova', v_nova, 'unidades', v_unidades,
                            'tempos_fechados', v_tempos, 'reservas', v_reservas,
                            'card_saiu_do_pcp', v_card_saiu);
end;
$$;


-- "Não entregue": vale para o programado (lançado ou não).
create or replace function public.plt_fn_entrega_nao_realizada(
  p_card_id    bigint,
  p_motivo_id  bigint,
  p_observacao text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_card    public.plt_cards%rowtype;
  v_motivo  text;
  v_prog    public.plt_programacoes%rowtype;
  v_evento  bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_mexer_entrega(p_card_id) then
    raise exception 'Marcar "não entregue" é gesto do entregador do caminhão, da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select m.texto into v_motivo from public.plt_motivos m
   where m.id = p_motivo_id and m.tipo = 'nao_entregue' and m.ativo;
  if v_motivo is null then
    raise exception 'Escolha o motivo de não ter entregue.' using errcode = 'check_violation';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  -- SESSAO-38 (D-156): vale para o programado, lançado ou não.
  if not found or (v_card.lancado_rotas_em is null
                   and not exists (select 1 from public.plt_programacoes pr where pr.card_id = v_card.id)) then
    raise exception 'Este pedido não está programado nem na ROTAS.' using errcode = 'check_violation';
  end if;
  if v_card.entrega_evento_id is not null then
    raise exception 'Este pedido está como entregue — desfaça a entrega antes.' using errcode = 'check_violation';
  end if;
  select * into v_prog from public.plt_programacoes where card_id = v_card.id;

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_card.id, 'entrega_nao_realizada', v_usuario, 'interface',
            v_motivo || coalesce(' — ' || nullif(btrim(p_observacao), ''), ''),
            jsonb_build_object('motivo_id', p_motivo_id, 'motivo', v_motivo,
                               'data_entrega', v_prog.data_entrega, 'caminhao_id', v_prog.caminhao_id))
    returning id into v_evento;
  -- Volta para "Programar" (a remoção vai à trilha pelo gatilho da programação).
  delete from public.plt_programacoes where card_id = v_card.id;
  return v_evento;
end;
$$;


-- "Pedido devolvido" antes da entrega: o programado, com as peças no aguardo ou na ROTAS.
create or replace function public.plt_fn_pedido_devolver(
  p_card_id    bigint,
  p_motivo_id  bigint,
  p_observacao text default null,
  p_pecas      bigint[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario  uuid;
  v_card     public.plt_cards%rowtype;
  v_motivo   text;
  v_numero   integer;
  v_dev      bigint;
  v_evento   bigint;
  v_entregue boolean;
  v_pecas    bigint[];
  v_marca_d  text;
  v_marca_e  text;
  v_avisados integer;
  r          record;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Marcar "pedido devolvido" é gesto da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  select p.numero into v_numero from public.pedidos p where p.id = v_card.pedido_id;

  -- Lei §10: o mesmo toque repetido = um efeito só.
  if v_card.devolucao_evento_id is not null then
    if exists (select 1 from public.plt_eventos e
                where e.id = v_card.devolucao_evento_id and e.usuario_id = v_usuario
                  and e.ocorrido_em > now() - interval '10 minutes') then
      return jsonb_build_object('evento_id', v_card.devolucao_evento_id, 'repetido', true);
    end if;
    raise exception 'O pedido % já está em decisão pós devolução.', v_numero using errcode = 'check_violation';
  end if;

  select m.texto into v_motivo from public.plt_motivos m
   where m.id = p_motivo_id and m.tipo = 'devolucao' and m.ativo;
  if v_motivo is null then
    raise exception 'Escolha o motivo da devolução.' using errcode = 'check_violation';
  end if;

  v_entregue := v_card.entrega_evento_id is not null;
  select s.id into v_dev from public.plt_setores s where s.codigo = 'devolucao';
  if v_dev is null then
    raise exception 'O lugar "Em decisão pós devolução" não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  if v_entregue then
    -- As peças que saíram com a entrega vigente (e ainda não voltaram).
    select array_agg(u.id order by u.id) into v_pecas
      from public.plt_cards u
     where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is not null
       and (p_pecas is null or u.id = any (p_pecas))
       and exists (select 1 from public.plt_eventos a
                    where a.card_id = u.id and a.tipo = 'card_arquivado'
                      and (a.dados ->> 'entrega_evento_id')::bigint = v_card.entrega_evento_id
                      and a.id = (select max(a2.id) from public.plt_eventos a2
                                   where a2.card_id = u.id and a2.tipo = 'card_arquivado'));
  else
    -- SESSAO-38 (D-156): o programado (lançado ou não) também se devolve antes
    -- da entrega — as peças prontas saem do aguardo ou da ROTAS.
    if v_card.lancado_rotas_em is null
       and not exists (select 1 from public.plt_programacoes pr where pr.card_id = v_card.id) then
      raise exception 'O pedido % não está programado, na ROTAS nem entregue — não há o que devolver.', v_numero
        using errcode = 'check_violation';
    end if;
    select array_agg(u.id order by u.id) into v_pecas
      from public.plt_cards u
      join public.plt_setores s on s.id = u.setor_atual_id and s.codigo in ('rotas', 'aguardo')
     where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null
       and (p_pecas is null or u.id = any (p_pecas));
  end if;
  if v_pecas is null or array_length(v_pecas, 1) is null then
    raise exception 'Nenhuma peça do pedido % para devolver.', v_numero using errcode = 'check_violation';
  end if;

  v_marca_d := current_setting('plt.devolucao_maquinaria', true);
  v_marca_e := current_setting('plt.entrega_maquinaria', true);
  perform set_config('plt.devolucao_maquinaria', 'on', true);
  perform set_config('plt.entrega_maquinaria', 'on', true);

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_card.id, 'pedido_devolvido', v_usuario, 'interface',
            v_motivo || coalesce(' — ' || nullif(btrim(p_observacao), ''), ''),
            jsonb_build_object('fonte', 'plataforma', 'numero', v_numero, 'motivo_id', p_motivo_id,
                               'motivo', v_motivo, 'observacao', nullif(btrim(p_observacao), ''),
                               'entregue', v_entregue, 'entrega_evento_id', v_card.entrega_evento_id,
                               'pecas', to_jsonb(v_pecas)))
    returning id into v_evento;
  -- Pedido ainda na ROTAS: sai da programação (o caminhão não o leva mais).
  if not v_entregue then
    delete from public.plt_programacoes where card_id = v_card.id;
  end if;

  for r in
    select c.id, c.setor_atual_id, c.etapa_atual_id, c.arquivado_em
      from public.plt_cards c where c.id = any (v_pecas) order by c.id for update
  loop
    if r.arquivado_em is not null then
      insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, observacao, dados)
        values (r.id, 'card_desarquivado', v_usuario, 'interface', r.setor_atual_id, r.etapa_atual_id,
                'Pedido devolvido — a peça voltou do cliente.',
                jsonb_build_object('motivo', 'devolucao', 'devolucao_evento_id', v_evento));
    end if;
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, setor_destino_id,
         observacao, dados)
      values (r.id, 'movimentacao_setor', v_usuario, 'interface',
              (select c.setor_atual_id from public.plt_cards c where c.id = r.id),
              (select c.etapa_atual_id from public.plt_cards c where c.id = r.id),
              v_dev, 'Pedido devolvido — a peça espera a decisão da logística.',
              jsonb_build_object('motivo', 'devolucao', 'devolucao_evento_id', v_evento));
  end loop;

  perform set_config('plt.devolucao_maquinaria', coalesce(v_marca_d, ''), true);
  perform set_config('plt.entrega_maquinaria', coalesce(v_marca_e, ''), true);

  v_avisados := plt_privado.fn_avisar_logistica(
    v_evento, v_card.id, 'devolucao_decidir',
    'Pedido ' || coalesce(v_numero::text, '') || ' devolvido — decidir a situação',
    (select u.nome from public.plt_usuarios u where u.id = v_usuario) || ' marcou o pedido '
      || coalesce(v_numero::text, '') || ' como devolvido (' || v_motivo || '). '
      || array_length(v_pecas, 1) || ' peça(s) esperam a decisão em Estoque → Em decisão pós devolução.',
    v_usuario);

  return jsonb_build_object('evento_id', v_evento, 'pecas', array_length(v_pecas, 1),
                            'entregue', v_entregue, 'avisados', v_avisados);
end;
$$;


-- ----------------------------------------------------------------------------
-- 8 · Entregas do dia: cada parada diz se o pedido está pronto
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_entregas_do_dia(
  p_data        date    default null,
  p_caminhao_id bigint  default null,
  p_rota        integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario   uuid;
  v_logistica boolean;
  v_data      date;
  v_caminhoes jsonb;
  v_caminhao  bigint;
  v_rota      integer;
  v_entregas  jsonb;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Entre na plataforma para ver as entregas.' using errcode = 'insufficient_privilege';
  end if;
  v_logistica := plt_privado.fn_pode_ver_expedicao();
  if not v_logistica and not plt_privado.fn_eh_entregador(v_usuario) then
    raise exception 'As entregas do dia são do entregador e da logística.' using errcode = 'insufficient_privilege';
  end if;
  v_data := coalesce(p_data, (now() at time zone 'America/Fortaleza')::date);

  -- As rotas do dia: a logística vê todas as programadas; o entregador, as da
  -- equipe dele (SESSAO-31 · D-128: a equipe é de cada rota).
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'rota', x.rota, 'nome', x.nome, 'placa', x.placa,
                                               'foto', x.foto_caminho, 'equipe', x.equipe, 'entregas', x.n)
                            order by x.nome, x.id, x.rota), '[]'::jsonb)
    into v_caminhoes
    from (
      select cam.id, cam.nome, cam.placa, cam.foto_caminho, pr.rota::int as rota, count(pr.id)::int as n,
             coalesce((select jsonb_agg(u.nome order by u.nome)
                         from public.plt_programacao_equipes eq join public.plt_usuarios u on u.id = eq.usuario_id
                        where eq.data_entrega = v_data and eq.caminhao_id = cam.id and eq.rota = pr.rota), '[]'::jsonb) as equipe
        from public.plt_caminhoes cam
        join public.plt_programacoes pr on pr.caminhao_id = cam.id and pr.data_entrega = v_data
       where v_logistica
          or exists (select 1 from public.plt_programacao_equipes eq
                      where eq.data_entrega = v_data and eq.caminhao_id = cam.id and eq.rota = pr.rota
                        and eq.usuario_id = v_usuario)
       group by cam.id, pr.rota
    ) x;

  select (t.c ->> 'id')::bigint, (t.c ->> 'rota')::int into v_caminhao, v_rota
    from jsonb_array_elements(v_caminhoes) with ordinality as t(c, i)
   where (p_caminhao_id is null or (t.c ->> 'id')::bigint = p_caminhao_id)
     and (p_rota is null or (t.c ->> 'rota')::int = p_rota)
   order by t.i
   limit 1;

  select coalesce(jsonb_agg(e order by (e ->> 'posicao')::int), '[]'::jsonb) into v_entregas
    from (
      select jsonb_build_object(
               'posicao', row_number() over (order by pr.ordem nulls last, p.numero),
               'card_id', pc.id, 'pedido_id', p.id, 'numero', p.numero,
               'cliente_nome', coalesce(c.nome, ''), 'telefone', c.fone,
               'endereco', c.endereco, 'numero_endereco', c.numero, 'complemento', c.complemento,
               'bairro', c.bairro, 'cidade', c.cidade, 'uf', c.uf,
               'latitude', g.latitude, 'longitude', g.longitude,
               'obs', p.obs, 'detalhe', pr.detalhe, 'data_prevista', p.data_prevista,
               'itens', coalesce(i.itens, '[]'::jsonb), 'unidades', coalesce(i.unidades, 0),
               'volumes', coalesce(i.volumes, 0),
               -- SESSAO-38 (D-156): o programado pode ainda estar em produção.
               'estado', pp.estado, 'pronto', coalesce(pp.pronto, true),
               'prontas', coalesce(pp.unidades_prontas, 0), 'a_entregar', coalesce(pp.a_entregar, 0),
               'entregue_em', ent.ocorrido_em, 'entregue_por', ue.nome,
               'entregue_por_gente', ent.usuario_id is not null,
               'comprovantes', (select count(*) from public.plt_anexos a where a.card_id = pc.id and a.removido_em is null),
               'comentarios', coalesce((select jsonb_agg(jsonb_build_object('texto', cm.observacao, 'por', uc.nome, 'em', cm.ocorrido_em)
                                                         order by cm.id desc)
                                          from (select * from public.plt_eventos ev
                                                 where ev.card_id = pc.id and ev.tipo = 'comentario_adicionado'
                                                 order by ev.id desc limit 5) cm
                                          left join public.plt_usuarios uc on uc.id = cm.usuario_id), '[]'::jsonb)
             ) as e
        from public.plt_programacoes pr
        join public.plt_cards pc on pc.id = pr.card_id and pc.tipo = 'pedido'
        join public.pedidos p on p.id = pc.pedido_id
        left join public.clientes c on c.id = p.cliente_id
        left join public.plt_geocache g
               on g.chave = md5(lower(plt_privado.fn_endereco_geocodificavel(c.endereco, c.numero, c.bairro, c.cidade, c.uf, c.cep)))
        left join public.plt_eventos ent on ent.id = pc.entrega_evento_id
        left join public.plt_usuarios ue on ue.id = ent.usuario_id
        left join plt_privado.vw_pedido_prontidao pp on pp.card_id = pc.id
        left join lateral (
          -- D-63: o frete não aparece; os volumes vêm do cadastro do Tiny (vazio ou 0 = 1 por móvel).
          select jsonb_agg(jsonb_build_object('descricao', coalesce(nullif(btrim(v.descricao), ''), 'Item sem descrição'),
                                              'quantidade', v.unidades,
                                              'volumes', v.unidades * x.vol) order by v.seq) as itens,
                 sum(v.unidades)::int as unidades,
                 sum(v.unidades * x.vol)::int as volumes
            from plt_privado.vw_itens_producao v
            cross join lateral (
              select greatest(coalesce(nullif(regexp_replace(coalesce(pr2.raw ->> 'qtd_volumes', ''), '[^0-9]', '', 'g'), '')::int, 1), 1) as vol
                from (select plt_privado.fn_produto_do_item(v.codigo, v.descricao) as tiny_id) t
                left join public.produtos pr2 on pr2.tiny_id = t.tiny_id
            ) x
           where v.pedido_id = p.id and not v.eh_frete and v.unidades > 0
        ) i on true
       where pr.data_entrega = v_data and pr.caminhao_id = v_caminhao and pr.rota = v_rota
         and pc.arquivado_em is null
    ) s;

  return jsonb_build_object('data', v_data, 'caminhao_id', v_caminhao, 'rota', v_rota, 'caminhoes', v_caminhoes,
                            'entregas', v_entregas, 'sou_logistica', v_logistica);
end;
$$;


-- ----------------------------------------------------------------------------
-- 9 · A equipe da rota: só quem é entregador (D-158 — ↪️ D-115)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_entregadores()
returns table (id uuid, nome text, foto_caminho text, entregador boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- SESSAO-38 (D-158, pedido do dono): só quem é ENTREGADOR (o tipo "Entregador
  -- (só ROTAS)" do cadastro — módulo "entregas", D-115). Quem só tem vínculo com
  -- o setor ROTAS (admin, logística) saiu da lista; quem já está numa equipe e
  -- não é entregador aparece na tela só para ser desmarcado (vem da rota do dia).
  select u.id, u.nome, u.foto_caminho, true
    from public.plt_usuarios u
   where plt_privado.fn_pode_ver_expedicao()
     and u.ativo
     and 'entregas' = any (u.modulos)
   order by u.nome
   limit 200;
$$;

create or replace function public.plt_fn_equipe_definir(
  p_data        date,
  p_caminhao_id bigint,
  p_usuarios    uuid[],
  p_rota        integer default 1
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quem uuid;
  v_rota integer := coalesce(p_rota, 1);
  v_n    integer;
begin
  v_quem := plt_privado.fn_usuario_atual();
  if v_quem is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Escolher a equipe do caminhão é gesto da logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  if p_data is null or p_caminhao_id is null then
    raise exception 'Escolha o dia e o caminhão.' using errcode = 'check_violation';
  end if;
  if v_rota < 1 or v_rota > 20 then
    raise exception 'A rota vai de 1 a 20 no mesmo dia e caminhão.' using errcode = 'check_violation';
  end if;
  if coalesce(array_length(p_usuarios, 1), 0) > 10 then
    raise exception 'No máximo 10 pessoas por rota.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from unnest(coalesce(p_usuarios, '{}'::uuid[])) x
              where not exists (select 1 from public.plt_usuarios u where u.id = x and u.ativo)) then
    raise exception 'Alguém escolhido não está ativo na plataforma.' using errcode = 'check_violation';
  end if;
  -- SESSAO-38 (D-158): só ENTREGADOR entra na equipe; quem já estava nela e não
  -- é entregador pode ficar (e sair), mas ninguém novo de fora entra.
  if exists (select 1 from unnest(coalesce(p_usuarios, '{}'::uuid[])) x
              where not plt_privado.fn_eh_entregador(x)
                and not exists (select 1 from public.plt_programacao_equipes eq
                                 where eq.data_entrega = p_data and eq.caminhao_id = p_caminhao_id
                                   and eq.rota = v_rota and eq.usuario_id = x)) then
    raise exception 'Só entregador entra na equipe da rota — cadastre a pessoa como "Entregador" em Configurações → Gestão da equipe.'
      using errcode = 'check_violation';
  end if;
  delete from public.plt_programacao_equipes
   where data_entrega = p_data and caminhao_id = p_caminhao_id and rota = v_rota
     and not (usuario_id = any (coalesce(p_usuarios, '{}'::uuid[])));
  insert into public.plt_programacao_equipes (data_entrega, caminhao_id, rota, usuario_id, definido_por)
    select p_data, p_caminhao_id, v_rota, x, v_quem from unnest(coalesce(p_usuarios, '{}'::uuid[])) x
  on conflict do nothing;
  select count(*)::int into v_n from public.plt_programacao_equipes
   where data_entrega = p_data and caminhao_id = p_caminhao_id and rota = v_rota;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_quem, 'equipe_caminhao_definida',
            jsonb_build_object('data', p_data, 'caminhao_id', p_caminhao_id, 'rota', v_rota,
                               'usuarios', to_jsonb(coalesce(p_usuarios, '{}'::uuid[]))));
  return v_n;
end;
$$;


-- ----------------------------------------------------------------------------
-- 10 · A Expedição numa porta só: a página + os números dos filtros (D-157)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_expedicao(
  p_filtro       text    default 'todos',   -- todos | com_rota | sem_rota | prontos | em_producao
  p_busca        text    default null,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_filtro text    := coalesce(nullif(btrim(p_filtro), ''), 'todos');
  v_busca  text    := nullif(btrim(coalesce(p_busca, '')), '');
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_desloc integer := greatest(coalesce(p_deslocamento, 0), 0);
  v_saida  jsonb;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'A Expedição é da logística (PCP/terminais) e do admin.' using errcode = 'insufficient_privilege';
  end if;
  if v_filtro not in ('todos', 'com_rota', 'sem_rota', 'prontos', 'em_producao') then
    raise exception 'Filtro da Expedição desconhecido: %.', v_filtro using errcode = 'check_violation';
  end if;

  with base as materialized (
    select v.card_id, v.pedido_id, v.numero, v.data_prevista, v.situacao,
           v.total_unidades, v.a_entregar, v.unidades_liberadas, v.unidades_prontas,
           v.primeira_pronta_em, v.ultima_pronta_em, v.pronto, v.estado,
           v.lancado_rotas_em, v.devolucao_evento_id,
           v.programacao_data, v.caminhao_id, v.rota,
           coalesce(c.nome, '') as cliente_nome
      from plt_privado.vw_pedidos_vivos v
      left join public.clientes c on c.id = v.cliente_id
  ),
  filtrados as (
    select b.*
      from base b
     where (case v_filtro
              when 'todos'       then true
              when 'com_rota'    then b.programacao_data is not null
              when 'sem_rota'    then b.programacao_data is null
              when 'prontos'     then b.pronto
              else                    not b.pronto
            end)
       and (v_busca is null
            or b.numero::text like v_busca || '%'
            or b.cliente_nome ilike '%' || v_busca || '%')
  ),
  pagina as (
    select f.*
      from filtrados f
     order by f.data_prevista asc nulls last, f.numero desc
     limit v_limite offset v_desloc
  )
  select jsonb_build_object(
           'filtro', v_filtro,
           -- Os números dos filtros: o conjunto inteiro (sem a busca), no mesmo pedido.
           'contagens', (select jsonb_build_object(
                                  'todos',       count(*),
                                  'com_rota',    count(*) filter (where b.programacao_data is not null),
                                  'sem_rota',    count(*) filter (where b.programacao_data is null),
                                  'prontos',     count(*) filter (where b.pronto),
                                  'em_producao', count(*) filter (where not b.pronto))
                           from base b),
           'total', (select count(*) from filtrados),
           'itens', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'card_id', pg.card_id, 'pedido_id', pg.pedido_id, 'numero', pg.numero,
                      'cliente_nome', pg.cliente_nome, 'data_prevista', pg.data_prevista,
                      'situacao', pg.situacao,
                      'total_unidades', pg.total_unidades, 'a_entregar', pg.a_entregar,
                      'unidades_liberadas', pg.unidades_liberadas, 'unidades_prontas', pg.unidades_prontas,
                      'pronto', pg.pronto, 'estado', pg.estado,
                      'primeira_pronta_em', pg.primeira_pronta_em,
                      'completo_em', case when pg.pronto then pg.ultima_pronta_em end,
                      'lancado', pg.lancado_rotas_em is not null,
                      'em_devolucao', pg.devolucao_evento_id is not null,
                      'alterado_apos_liberacao', exists (select 1 from public.plt_eventos e
                                                          where e.card_id = pg.card_id and e.tipo = 'pedido_atualizado'),
                      'programacao', case when pg.programacao_data is null then null
                                          else jsonb_build_object('data', pg.programacao_data,
                                                                  'caminhao_id', pg.caminhao_id,
                                                                  'caminhao_nome', cam.nome,
                                                                  'caminhao_placa', cam.placa,
                                                                  'rota', pg.rota) end)
                    order by pg.data_prevista asc nulls last, pg.numero desc)
               from pagina pg
               left join public.plt_caminhoes cam on cam.id = pg.caminhao_id), '[]'::jsonb)
         )
    into v_saida;
  return v_saida;
end;
$$;

comment on function public.plt_fn_expedicao(text, text, integer, integer) is
  'SESSAO-38 (D-157): a Expedição numa requisição — os pedidos vivos (vw_pedidos_vivos), a previsão mais próxima primeiro (D-133), paginados no servidor (deslocamento limitado: o conjunto é o que está em andamento), filtrados (todos | com_rota | sem_rota | prontos | em_producao) e os números de cada filtro no mesmo pedido.';

revoke all on function public.plt_fn_expedicao(text, text, integer, integer) from public, anon;
grant execute on function public.plt_fn_expedicao(text, text, integer, integer) to authenticated;
