-- ============================================================================
-- SESSAO-40 (D-186…D-188) — três pedidos do dono de 23/10/2026 (sessão noturna):
--
--   F1 · ESTOQUE: lançar QUALQUER móvel para produção a QUALQUER momento —
--        mesmo com o mínimo coberto, fora do Top X, com a reposição automática
--        ligada e com outra reposição dele esperando no PCP (D-186).
--   F2 · O FILTRO DOS QUADROS: o quadro de cada setor (e o tablet) e o do PCP
--        filtram pelo número do pedido (que começa com o texto) ou pelo nome
--        do móvel (que contém), no SERVIDOR — cada coluna com o total que bate,
--        "Ver mais" com o mesmo filtro (D-187; o filtro do Trello do vídeo).
--   F3 · A BUSCA GERAL: acha os cards em TODOS os setores pelo número do pedido
--        ou pelo nome e diz onde cada um está (setor/etapa, entregue, estoque,
--        rotas, PCP…) — só o que a pessoa pode ver; por cursor (D-188; a
--        pesquisa do Trello do vídeo, "a rastreabilidade dos cards").
--
-- Compatível com o site publicado: as portas antigas mudam de assinatura só
-- com parâmetros NOVOS que têm padrão (o site de antes chama pelos nomes e
-- acha a porta nova); o lançamento sem a chave do gesto mantém a regra antiga.
-- Funções recriadas por EXTRAÇÃO da versão viva (md5 do corpo conferido contra
-- o banco — A-96/A-97), com trocas de texto de contagem exigida.
-- Nada aqui altera tabela da integração.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A reposição aberta: UMA por produto só para a maquinaria (a automática e
--     o lançamento sem chave); a lançada pela tela nova (com a chave do gesto)
--     pode nascer ao lado de outra (D-186). A chave do gesto já existia
--     (plt_cards.chave_criacao, índice único — a do card avulso).
-- ----------------------------------------------------------------------------
drop index if exists public.plt_cards_reposicao_aberta_uq;
create unique index if not exists plt_cards_reposicao_aberta_uq
  on public.plt_cards (produto_tiny_id)
  where tipo = 'reposicao' and arquivado_em is null and liberado_completo_em is null
    and chave_criacao is null;

comment on index public.plt_cards_reposicao_aberta_uq is
  'SESSAO-25 · SESSAO-40 (D-186): uma reposição ABERTA por produto para a maquinaria (a automática e o lançamento sem chave) — a lançada à mão pela tela (com a chave do gesto) pode nascer ao lado de outra.';

-- ----------------------------------------------------------------------------
-- 1b · O nome do card já normalizado, GUARDADO (D-187/D-188): o filtro dos
--      quadros e a busca geral comparam o texto sem acento, sem maiúscula e sem
--      espaço (a régua de fn_nome_comparavel — uma regra só). Calcular a régua
--      a cada leitura custava ~180 ms para 7 mil cards no ensaio ×100 (função
--      com SET por linha — E-65); guardada no card (coluna gerada), a leitura
--      só compara, e o índice de trigramas anda nela. Toda escrita em plt_cards
--      lista as colunas (conferido — A-69), e a coluna gerada não se escreve.
-- ----------------------------------------------------------------------------
alter table public.plt_cards
  add column if not exists nome_busca text
  generated always as (plt_privado.fn_nome_comparavel(coalesce(titulo, item_descricao))) stored;

comment on column public.plt_cards.nome_busca is
  'SESSAO-40 (D-187/D-188): o nome do card (o título do avulso ou o móvel) sem acento, sem maiúscula e sem espaço — a régua de fn_nome_comparavel, guardada (coluna gerada). Lida pelo filtro dos quadros e pela busca geral.';

create index if not exists plt_cards_nome_busca_trgm
  on public.plt_cards using gin (nome_busca extensions.gin_trgm_ops);

comment on index public.plt_cards_nome_busca_trgm is
  'SESSAO-40 (D-188): a busca geral e o filtro dos quadros pelo nome do card — trigramas na coluna guardada.';

-- ----------------------------------------------------------------------------
-- 2 · O lançamento manual (recriado por EXTRAÇÃO da versão viva — md5 conferido;
--     assinatura nova = drop + create, A-12): + p_chave (a chave do gesto).
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_estoque_lancar_reposicao(bigint, integer);
CREATE OR REPLACE FUNCTION public.plt_fn_estoque_lancar_reposicao(p_produto_tiny_id bigint, p_quantidade integer, p_chave uuid DEFAULT NULL::uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_usuario uuid;
  v_pcp     bigint;
  v_produto record;
  v_card_id bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Lançar reposição para produção é gesto da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 500 then
    raise exception 'A quantidade precisa ser de 1 a 500.' using errcode = 'check_violation';
  end if;

  -- SESSAO-40 (D-186): o mesmo toque (clique duplo, rede que volta) devolve o
  -- card já criado — a chave do gesto (Lei §10), como no card avulso.
  if p_chave is not null then
    select c.id into v_card_id from public.plt_cards c where c.chave_criacao = p_chave;
    if found then
      return v_card_id;
    end if;
  end if;

  select pr.tiny_id, pr.codigo, pr.descricao into v_produto
    from public.produtos pr
   where pr.tiny_id = p_produto_tiny_id and pr.situacao = 'A'
     and pr.tipo_estoque_efetivo = 'movel';
  if not found then
    raise exception 'Móvel não encontrado no catálogo (insumo e peça seguem o número do Tiny).' using errcode = 'no_data_found';
  end if;

  -- SESSAO-40 (D-186): com a chave do gesto (a tela nova), a logística lança
  -- QUALQUER móvel a QUALQUER momento — mesmo no mínimo, fora do Top X, com a
  -- automática ligada e com outra reposição dele esperando no PCP (nasce outra,
  -- ao lado). Sem a chave (o site de antes), a regra de antes: uma aberta por produto.
  if p_chave is null and exists (select 1 from public.plt_cards rc
              where rc.tipo = 'reposicao' and rc.produto_tiny_id = p_produto_tiny_id
                and rc.arquivado_em is null and rc.liberado_completo_em is null) then
    raise exception 'Este produto já tem uma reposição aberta no PCP.' using errcode = 'unique_violation';
  end if;

  select s.id into v_pcp from public.plt_setores s
   where s.papel_no_fluxo = 'entrada' and s.ativo
   order by s.id limit 1;
  if v_pcp is null then
    raise exception 'O PCP não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  begin
    insert into public.plt_cards
        (tipo, produto_tiny_id, item_codigo, item_descricao, total_unidades, setor_atual_id, chave_criacao)
      values
        ('reposicao', v_produto.tiny_id, v_produto.codigo, v_produto.descricao, p_quantidade, v_pcp, p_chave)
      returning id into v_card_id;
  exception when unique_violation then
    -- dois toques ao mesmo tempo com a mesma chave: o segundo devolve o primeiro
    if p_chave is not null then
      select c.id into v_card_id from public.plt_cards c where c.chave_criacao = p_chave;
      if found then
        return v_card_id;
      end if;
    end if;
    raise exception 'Este produto já tem uma reposição aberta no PCP.' using errcode = 'unique_violation';
  end;

  insert into public.plt_eventos (card_id, tipo, origem, usuario_id, setor_destino_id, dados)
    values (v_card_id, 'card_criado', 'interface', v_usuario, v_pcp,
            jsonb_build_object('motivo', 'reposicao_manual',
                               'produto_tiny_id', v_produto.tiny_id,
                               'sku', v_produto.codigo,
                               'quantidade', p_quantidade,
                               -- SESSAO-40: o número de quando lançou (a trilha conta o porquê)
                               'em_estoque', (select n.livres from public.plt_estoque_numeros n
                                               where n.produto_tiny_id = v_produto.tiny_id)));

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'estoque_reposicao_lancada',
            jsonb_build_object('produto_tiny_id', v_produto.tiny_id, 'sku', v_produto.codigo,
                               'quantidade', p_quantidade, 'card_id', v_card_id));
  return v_card_id;
end;
$function$;

comment on function public.plt_fn_estoque_lancar_reposicao(bigint, integer, uuid) is
  'D-87 · SESSAO-40 (D-186): a logística/admin lança a reposição de um móvel ao PCP à mão, com autor e trilha. Com p_chave (a tela nova): qualquer móvel, a qualquer momento — mesmo no mínimo, fora do Top X, com a automática ligada ou com outra reposição dele aberta; o mesmo toque devolve o card já criado. Sem p_chave: uma reposição aberta por produto (a regra de antes).';

-- ----------------------------------------------------------------------------
-- 3 · O filtro do quadro do setor (D-187) — a regra num lugar só para ler o
--     texto; a página e o total recriados por EXTRAÇÃO (md5 conferido) com
--     p_filtro; as portas com p_filtro (drop + create, A-12 — o site de antes
--     chama pelos nomes e segue achando a porta nova pelos padrões).
-- ----------------------------------------------------------------------------
-- O texto do filtro: só dígitos (ou "pedido 13722", "#13722") = o número do
-- pedido que COMEÇA com eles; o resto = o nome do móvel/avulso que CONTÉM o
-- texto, sem acento, sem maiúscula e sem espaço (a mesma régua de
-- fn_nome_comparavel). Menos de 2 caracteres = sem filtro.
create or replace function plt_privado.fn_filtro_do_quadro(p_filtro text)
returns table (ativo boolean, numero text, nome text)
language sql
immutable
set search_path = public, pg_temp
as $$
  with t as (select btrim(coalesce(p_filtro, '')) as txt),
  n as (
    select case when t.txt ~* '^(pedido|ped[.]?|#)?[[:space:]]*[0-9]{2,}$'
                then nullif(ltrim(regexp_replace(t.txt, '[^0-9]', '', 'g'), '0'), '') end as numero,
           plt_privado.fn_nome_comparavel(t.txt) as nome
      from t
  )
  select (n.numero is not null or length(n.nome) >= 2) as ativo,
         n.numero,
         case when n.numero is null and length(n.nome) >= 2 then n.nome end as nome
    from n;
$$;

comment on function plt_privado.fn_filtro_do_quadro(text) is
  'SESSAO-40 (D-187): lê o texto do filtro dos quadros — só dígitos (ou "pedido N", "#N") = número do pedido que começa com eles; senão o nome que contém (sem acento, maiúscula e espaço); menos de 2 caracteres = sem filtro.';


-- Os cards vivos do setor (peça e avulso) que batem com o filtro — resolvidos
-- UMA vez por quadro (no ensaio ×100, a regra rodando coluna por coluna levava
-- o quadro de 200 para 300–900 ms). Nulo = sem filtro; vazio = nada bate. O
-- número pelo pedido (que começa com); o nome pela coluna guardada (que contém).
create or replace function plt_privado.fn_quadro_filtrados(p_setor_id bigint, p_filtro text)
returns bigint[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with f as (select * from plt_privado.fn_filtro_do_quadro(p_filtro))
  select case when (select ativo from f) then coalesce((
    select array_agg(c.id)
      from public.plt_cards c
      left join public.pedidos p on p.id = c.pedido_id
     where c.setor_atual_id = p_setor_id
       and c.arquivado_em is null and c.tipo in ('unidade', 'avulso')
       and case when (select numero from f) is not null
                then p.numero::text like (select numero from f) || '%'
                else c.nome_busca like '%' || (select nome from f) || '%' end), '{}'::bigint[]) end;
$$;

comment on function plt_privado.fn_quadro_filtrados(bigint, text) is
  'SESSAO-40 (D-187): os cards vivos do setor que batem com o filtro dos quadros (nulo = sem filtro; vazio = nada bate) — o número do pedido que começa com o texto, ou o nome guardado que o contém.';

drop function if exists plt_privado.fn_quadro_pagina(bigint, bigint, timestamptz, bigint, integer, text);
create or replace function plt_privado.fn_quadro_pagina(
  p_setor_id bigint, p_etapa_id bigint, p_corte_desde timestamptz, p_corte_id bigint, p_n integer,
  p_ordem text default null, p_so_ids bigint[] default null)
returns bigint[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with m as (select plt_privado.fn_ordem_do_quadro(p_ordem) as modo),
  col as (
    select v.id,
           case (select modo from m) when 'prioridade' then v.rank_prioridade else v.rank_urgente end as k1,
           (case (select modo from m) when 'entrega' then v.chave_entrega
                                      when 'alfabetica' then v.chave_nome else '' end) collate "C" as k2,
           case (select modo from m) when 'entrega' then coalesce(v.pedido_numero, 2147483647) else 0 end as k3,
           coalesce(v.desde, 'infinity'::timestamptz) as k4
      from plt_privado.vw_card_ordem v
     where v.setor_atual_id = p_setor_id
       and (case when p_etapa_id is null then v.etapa_atual_id is null else v.etapa_atual_id = p_etapa_id end)
       and v.arquivado_em is null and v.tipo in ('unidade', 'avulso')
       -- SESSAO-40 (D-187): com o filtro, só os cards que bateram (o conjunto
       -- vem resolvido UMA vez por quadro — fn_quadro_filtrados)
       and (p_so_ids is null or v.id = any (p_so_ids))
  ),
  corte as (
    select case (select modo from m) when 'prioridade' then v.rank_prioridade else v.rank_urgente end as k1,
           (case (select modo from m) when 'entrega' then v.chave_entrega
                                      when 'alfabetica' then v.chave_nome else '' end) collate "C" as k2,
           case (select modo from m) when 'entrega' then coalesce(v.pedido_numero, 2147483647) else 0 end as k3,
           coalesce(v.desde, 'infinity'::timestamptz) as k4,
           v.id
      from plt_privado.vw_card_ordem v
     where coalesce(p_corte_id, 0) > 0 and v.id = p_corte_id
  )
  select coalesce(array_agg(x.id order by x.k1, x.k2, x.k3, x.k4, x.id), '{}')
    from (select c.*
            from col c
           where not exists (select 1 from corte)
              or (c.k1, c.k2, c.k3, c.k4, c.id) > (select k.k1, k.k2, k.k3, k.k4, k.id from corte k)
           order by c.k1, c.k2, c.k3, c.k4, c.id
           limit greatest(coalesce(p_n, 10), 1)) x;
$$;

comment on function plt_privado.fn_quadro_pagina(bigint, bigint, timestamptz, bigint, integer, text, bigint[]) is
  'SESSAO-38 (D-154) · SESSAO-40 (D-187): uma página de uma coluna na ordem pedida (o urgente sempre primeiro), por cursor (depois do card p_corte_id), só com os cards que batem com o filtro (p_filtro nulo = todos).';

drop function if exists plt_privado.fn_quadro_total(bigint, bigint);
create or replace function plt_privado.fn_quadro_total(p_setor_id bigint, p_etapa_id bigint, p_so_ids bigint[] default null)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  -- SESSAO-40 (D-187): com o filtro, conta só os que bateram (pela chave)
  if p_so_ids is not null then
    select count(*)::int into v_n
      from public.plt_cards c
     where c.id = any (p_so_ids)
       and (case when p_etapa_id is null then c.etapa_atual_id is null else c.etapa_atual_id = p_etapa_id end);
    return v_n;
  end if;
  if p_etapa_id is null then
    select count(*)::int into v_n from public.plt_cards c
     where c.setor_atual_id = p_setor_id and c.etapa_atual_id is null
       and c.arquivado_em is null and c.tipo in ('unidade', 'avulso');
  else
    select count(*)::int into v_n from public.plt_cards c
     where c.setor_atual_id = p_setor_id and c.etapa_atual_id = p_etapa_id
       and c.arquivado_em is null and c.tipo in ('unidade', 'avulso');
  end if;
  return v_n;
end;
$$;

comment on function plt_privado.fn_quadro_total(bigint, bigint, bigint[]) is
  'SESSAO-31 · SESSAO-40 (D-187): quantos cards vivos (peça/avulso) há numa coluna do quadro — com filtro, só os que batem (a mesma regra da página).';

drop function if exists public.plt_fn_quadro_setor(bigint, integer, text);
create or replace function public.plt_fn_quadro_setor(
  p_setor_id bigint, p_por_coluna integer default 10, p_ordem text default null, p_filtro text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_n       integer := least(greatest(coalesce(p_por_coluna, 10), 1), 50);
  v_ordem   text := plt_privado.fn_ordem_do_quadro(p_ordem);
  v_colunas jsonb := '[]'::jsonb;
  v_ids     bigint[] := '{}';
  v_pagina  bigint[];
  v_total   integer;
  r         record;
  v_so      bigint[];
begin
  if not plt_privado.fn_pode_ver_quadro(p_setor_id) then
    raise exception 'Você não vê o quadro deste setor.' using errcode = 'insufficient_privilege';
  end if;
  -- SESSAO-40 (D-187): os cards do setor que batem com o filtro — UMA vez
  -- (nulo = sem filtro; vazio = nada bate)
  v_so := plt_privado.fn_quadro_filtrados(p_setor_id, p_filtro);

  for r in
    select null::bigint as etapa_id, -1 as ordem, 0::bigint as id
    union all
    select e.id, e.ordem, e.id from public.plt_etapas e where e.setor_id = p_setor_id and e.ativa
    order by 2, 3
  loop
    v_pagina := plt_privado.fn_quadro_pagina(p_setor_id, r.etapa_id, null, null, v_n, v_ordem, v_so);
    v_total := plt_privado.fn_quadro_total(p_setor_id, r.etapa_id, v_so);
    v_colunas := v_colunas || jsonb_build_array(jsonb_build_object(
                   'etapa_id', r.etapa_id, 'total', v_total, 'cards', plt_privado.fn_quadro_cards(v_pagina)));
    v_ids := v_ids || v_pagina;
  end loop;

  return jsonb_build_object(
    'setor_id', p_setor_id,
    'por_coluna', v_n,
    'ordem', v_ordem,
    -- SESSAO-40 (D-187): o filtro que valeu (nulo = o quadro inteiro)
    'filtro', (select case when x.ativo then coalesce(x.numero, x.nome) end
                 from plt_privado.fn_filtro_do_quadro(p_filtro) x),
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'setor_id', e.setor_id, 'nome', e.nome, 'ordem', e.ordem,
                                          'eh_fila', e.eh_fila, 'eh_danificado', e.eh_danificado, 'ativa', e.ativa,
                                          'setor_destino_id', e.setor_destino_id, 'conclui_producao', e.conclui_producao,
                                          'pede_motivo', e.pede_motivo)
                       order by e.ordem, e.id)
        from public.plt_etapas e where e.setor_id = p_setor_id and e.ativa), '[]'::jsonb),
    'colunas', v_colunas,
    'etiquetas', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'cor', t.cor,
                                                               'arquivada_em', t.arquivada_em) order by t.nome)
                             from public.plt_etiquetas t), '[]'::jsonb),
    'campos', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'tipo', f.tipo, 'opcoes', f.opcoes,
                                                            'em_pecas', f.em_pecas, 'em_pedidos', f.em_pedidos,
                                                            'em_avulsos', f.em_avulsos, 'arquivado_em', f.arquivado_em)
                                         order by f.nome)
                          from public.plt_campos f), '[]'::jsonb),
    'presencas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'usuario_id', u.id, 'nome', u.nome, 'foto', u.foto_caminho,
               'estado', s.estado, 'desde', s.inicio)
             order by u.nome)
        from public.plt_presenca_segmentos s
        join public.plt_usuarios u on u.id = s.usuario_id
       where s.fim is null and s.setor_id = p_setor_id), '[]'::jsonb)
  ) || plt_privado.fn_quadro_junto(v_ids);
end;
$$;

comment on function public.plt_fn_quadro_setor(bigint, integer, text, text) is
  'SESSAO-31 (Lei §2/§6) · SESSAO-38 (D-154) · SESSAO-40 (D-187): o quadro do setor numa requisição, cada coluna na ordem pedida e — com p_filtro — só com os cards do pedido (nº que começa com) ou do nome (que contém), o total de cada coluna contando só os que batem. "Ver mais" = plt_fn_quadro_coluna com a mesma ordem e o mesmo filtro.';

drop function if exists public.plt_fn_quadro_coluna(bigint, bigint, timestamptz, bigint, integer, text);
create or replace function public.plt_fn_quadro_coluna(
  p_setor_id     bigint,
  p_etapa_id     bigint,
  p_depois_desde timestamptz,
  p_depois_id    bigint,
  p_limite       integer default 10,
  p_ordem        text default null,
  p_filtro       text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_n      integer := least(greatest(coalesce(p_limite, 10), 1), 50);
  v_pagina bigint[];
begin
  if not plt_privado.fn_pode_ver_quadro(p_setor_id) then
    raise exception 'Você não vê o quadro deste setor.' using errcode = 'insufficient_privilege';
  end if;
  v_pagina := plt_privado.fn_quadro_pagina(p_setor_id, p_etapa_id, p_depois_desde, p_depois_id, v_n, p_ordem,
                                           plt_privado.fn_quadro_filtrados(p_setor_id, p_filtro));
  return jsonb_build_object('etapa_id', p_etapa_id, 'cards', plt_privado.fn_quadro_cards(v_pagina))
         || plt_privado.fn_quadro_junto(v_pagina);
end;
$$;

comment on function public.plt_fn_quadro_coluna(bigint, bigint, timestamptz, bigint, integer, text, text) is
  'SESSAO-31 (Lei §6) · SESSAO-38 (D-154) · SESSAO-40 (D-187): o "Ver mais" de uma coluna, por cursor (depois do card p_depois_id), na mesma ordem e com o mesmo filtro do quadro.';

-- ----------------------------------------------------------------------------
-- 4 · O filtro do PCP (D-187) — recriado por EXTRAÇÃO (md5 conferido) com
--     p_filtro (drop + create, A-12).
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_pcp_quadro(integer, integer, text, text);
create or replace function public.plt_fn_pcp_quadro(
  p_limite       integer default 10,
  p_deslocamento integer default 0,
  p_grupo        text    default null,   -- null = tudo | 'pedido' | 'reposicao'
  p_ordem        text    default null,   -- prioridade (padrão) | entrega | alfabetica
  p_filtro       text    default null    -- SESSAO-40 (D-187): nº do pedido que começa com · nome que contém
)
returns table (
  id                   bigint,
  tipo                 text,
  pedido_id            bigint,
  card_pai_id          bigint,
  item_seq             integer,
  item_codigo          text,
  item_descricao       text,
  indice_unidade       integer,
  total_unidades       integer,
  setor_atual_id       bigint,
  etapa_atual_id       bigint,
  desde                timestamptz,
  executor_atual_id    uuid,
  responsavel_id       uuid,
  delegado_em          timestamptz,
  qualidade_atual      text,
  concluido_em         timestamptz,
  pausado_em           timestamptz,
  liberado_completo_em timestamptz,
  pecas_estoque        integer,
  contagem_total       bigint,
  etiquetas            bigint[],
  pedido_resumo        jsonb,
  prioridade           text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with m as (select plt_privado.fn_ordem_do_quadro(p_ordem) as modo),
  f as (select * from plt_privado.fn_filtro_do_quadro(p_filtro)),
  base as (
    select c.id, c.desde, c.prioridade, p.numero, p.data_prevista,
           lower(translate(btrim(coalesce(case when c.tipo = 'pedido' then cl.nome else c.item_descricao end, '')),
                           'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
                           'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')) as nome
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
      left join public.pedidos p on p.id = c.pedido_id
      left join public.clientes cl on cl.id = p.cliente_id
     -- o MESMO filtro de plt_fn_cards_pedido_pcp (D-75: painel = quadro)
     where (select plt_privado.fn_usuario_atual()) is not null
       and ((select plt_privado.fn_eh_admin())
            or c.setor_atual_id in (select plt_privado.fn_setores_do_usuario()))
       and c.tipo in ('pedido', 'reposicao')
       -- SESSAO-38 (D-169): o MESMO filtro de plt_fn_cards_pedido_pcp (o grupo 'standby')
       and (case when p_grupo = 'standby' then c.tipo = 'pedido' and c.standby_desde is not null
                 else (p_grupo is null or c.tipo = p_grupo) and c.standby_desde is null end)
       and c.arquivado_em is null
       and c.liberado_completo_em is null
       and (c.tipo = 'reposicao'
            or (p.id is not null
                and not plt_privado.fn_tiny_tirou_do_pcp(p.situacao)
                and exists (select 1 from plt_privado.vw_itens_producao v
                             where v.pedido_id = p.id and v.unidades > 0)))
  ),
  chaves as (
    select b.id,
           case (select modo from m)
             when 'prioridade' then case b.prioridade when 'urgente' then 0 when 'atencao' then 1 else 2 end
             else case when b.prioridade = 'urgente' then 0 else 1 end
           end as k1,
           (case (select modo from m)
              when 'entrega' then to_char(coalesce(b.data_prevista, date '9999-12-31'), 'YYYYMMDD')
              when 'alfabetica' then (case when b.nome ~ '^[a-z]' then '0' when b.nome ~ '^[0-9]' then '1' else '2' end) || b.nome
              else '' end) collate "C" as k2,
           case (select modo from m) when 'entrega' then coalesce(b.numero, 2147483647) else 0 end as k3,
           coalesce(b.desde, 'infinity'::timestamptz) as k4,
           count(*) over () as total
      from base b
     -- SESSAO-40 (D-187): o filtro do PCP — o nº do pedido que começa com o
     -- texto, ou o nome que o contém (o cliente no card do pedido; o móvel na
     -- reposição — o mesmo nome da ordem alfabética). O total conta só os que batem.
     where (not (select ativo from f)
            or case when (select numero from f) is not null
                    then b.numero::text like (select numero from f) || '%'
                    else translate(b.nome, ' ' || chr(9) || chr(10) || chr(13), '')
                           like '%' || (select nome from f) || '%' end)
  ),
  pagina as (
    select k.id, k.total, row_number() over (order by k.k1, k.k2, k.k3, k.k4, k.id) as ord
      from chaves k
     order by k.k1, k.k2, k.k3, k.k4, k.id
     limit least(greatest(coalesce(p_limite, 10), 1), 100)
    offset greatest(coalesce(p_deslocamento, 0), 0)
  ),
  resumos as (
    select r.pedido_id, to_jsonb(r) - 'contagem_total' as resumo
      from public.plt_fn_pedidos_kanban(
             null, false,
             coalesce((select array_agg(distinct c.pedido_id)
                         from pagina pg join public.plt_cards c on c.id = pg.id
                        where c.pedido_id is not null), '{}'),
             100, 0) r
  )
  select c.id, c.tipo, c.pedido_id, c.card_pai_id, c.item_seq, c.item_codigo,
         c.item_descricao, c.indice_unidade, c.total_unidades, c.setor_atual_id,
         c.etapa_atual_id, c.desde, c.executor_atual_id, c.responsavel_id,
         c.delegado_em, c.qualidade_atual, c.concluido_em, c.pausado_em,
         c.liberado_completo_em,
         pe.n as pecas_estoque,
         pg.total as contagem_total,
         coalesce(c.etiquetas, '{}'),
         -- SESSAO-38 (D-167/D-169): o stand-by do pedido no resumo (o relógio do
         -- PCP desconta; a aba Stand-by mostra o motivo, desde quando e quem pôs)
         case when c.tipo = 'pedido' then coalesce(r.resumo, '{}'::jsonb) || jsonb_build_object(
                'standby_desde', c.standby_desde, 'standby_motivo', c.standby_motivo,
                'standby_periodos', c.standby_periodos,
                'standby_por', (select u.nome from public.plt_eventos e
                                  join public.plt_usuarios u on u.id = e.usuario_id
                                 where e.id = c.standby_evento_id))
              else r.resumo end,
         c.prioridade
    from pagina pg
    join public.plt_cards c on c.id = pg.id
    left join resumos r on r.pedido_id = c.pedido_id
    -- as peças do galpão que atendem o pedido (a mesma conta de
    -- plt_fn_cards_pedido_pcp), só para os cards da página
    cross join lateral (
      select case when c.tipo <> 'pedido' then 0 else (
        select count(*)::int
          from public.plt_cards u
          join public.plt_setores se on se.id = u.setor_atual_id and se.codigo = 'estoque'
         where u.tipo = 'unidade' and u.pedido_id is null and u.arquivado_em is null
           and (u.reservada_pedido_id = c.pedido_id
                or (u.reservada_pedido_id is null
                    and u.item_codigo is not null
                    and not plt_privado.fn_eh_personalizado(u.item_descricao)
                    and exists (select 1 from public.pedido_itens pi
                                 where pi.pedido_id = c.pedido_id
                                   and pi.codigo = u.item_codigo
                                   and not plt_privado.fn_eh_personalizado(pi.descricao))))
      ) end as n
    ) pe
   order by pg.ord;
$$;

comment on function public.plt_fn_pcp_quadro(integer, integer, text, text, text) is
  'SESSAO-31/32 · SESSAO-38 (D-154/D-169) · SESSAO-40 (D-187): o quadro do PCP numa leitura (a página + etiquetas + resumo do pedido), na ordem pedida e — com p_filtro — só os cards do pedido (nº que começa com) ou do nome (cliente/móvel que contém); o total conta só os que batem.';


-- ----------------------------------------------------------------------------
-- 5 · A BUSCA GERAL (D-188) — os cards de todos os setores pelo número do
--     pedido (que começa com o texto) ou pelo nome (que contém), dizendo onde
--     cada um está. Só o que a pessoa pode ver (a mesma régua da janela do card:
--     admin, logística/PCP, o setor dela, o que ela executa ou participa).
--
--     O que entra: o card do pedido (o pedido no PCP — vivo ou já entregue), as
--     peças vivas e as peças de pedido já arquivadas (entregue — a
--     rastreabilidade), a reposição ainda no PCP e o avulso (vivo ou concluído).
--     Fica de fora a peça sem pedido que já saiu do estoque (contagem, baixa,
--     venda) — não é rastro de pedido nenhum e só encheria a lista.
--
--     Os dois caminhos (ensaio ×100 — Lei §1/§7):
--       · NÚMERO: o pedido mais novo primeiro; no pedido, o card do pedido, a
--         reposição, as peças pela ordem dos itens. As faixas do número
--         ([x·10^k, (x+1)·10^k) — o índice de pedidos.numero) são andadas da
--         maior para a menor, cada uma de trás para a frente, juntando os cards
--         pelo índice de plt_cards.pedido_id — e PARA quando a página enche
--         (sem montar todos os pedidos que começam com o texto).
--       · NOME (3 letras ou mais — o trigrama precisa de 3): o vivo primeiro,
--         o card mais novo primeiro, pelo índice de trigramas da coluna
--         guardada (nome_busca).
--     Por cursor (o cliente manda o id do último; o banco recalcula as chaves
--     dele — A-85), até 50 por vez.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_busca_cards(
  p_texto     text,
  p_depois_id bigint  default null,
  p_limite    integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu      uuid := plt_privado.fn_usuario_atual();
  v_tudo    boolean;
  v_setores bigint[] := '{}';
  v_filtro  record;
  v_numb    bigint;
  v_lim     integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_ids     bigint[] := '{}';
  v_parte   bigint[];
  v_mais    boolean;
  v_e       integer;
  v_ini     bigint;
  v_fim     bigint;
  -- o corte (o último mostrado)
  v_c_num   bigint;
  v_c_k3    integer;
  v_c_k4    integer;
  v_c_k5    integer;
  v_c_arq   boolean;
begin
  if v_eu is null then
    raise exception 'Entre na plataforma para buscar.' using errcode = 'insufficient_privilege';
  end if;
  v_tudo := plt_privado.fn_eh_admin() or plt_privado.fn_pode_ver_expedicao();
  if not v_tudo then
    v_setores := array(select plt_privado.fn_setores_do_usuario());
  end if;

  -- A mesma leitura do texto do filtro dos quadros (D-187).
  select * into v_filtro from plt_privado.fn_filtro_do_quadro(p_texto);
  -- E-106: a conversão calculada uma vez, só quando casa.
  v_numb := case when v_filtro.numero ~ '^[1-9][0-9]{0,8}$' then v_filtro.numero::bigint end;
  if v_numb is null and coalesce(length(v_filtro.nome), 0) < 3 then
    return jsonb_build_object('itens', '[]'::jsonb, 'tem_mais', false, 'numero', null);
  end if;

  if coalesce(p_depois_id, 0) > 0 then
    select coalesce(p.numero, 0),
           case c.tipo when 'pedido' then 0 when 'reposicao' then 1 when 'unidade' then 2 else 3 end,
           coalesce(c.item_seq, 0), coalesce(c.indice_unidade, 0), c.arquivado_em is not null
      into v_c_num, v_c_k3, v_c_k4, v_c_k5, v_c_arq
      from public.plt_cards c
      left join public.pedidos p on p.id = c.pedido_id
     where c.id = p_depois_id;
  end if;

  if v_numb is not null then
    -- o NÚMERO: as faixas da maior para a menor; cada uma de trás para a frente
    for v_e in reverse greatest(0, 10 - length(v_filtro.numero)) .. 0 loop
      v_ini := v_numb * (10::bigint ^ v_e)::bigint;
      v_fim := (v_numb + 1) * (10::bigint ^ v_e)::bigint;
      continue when v_c_num is not null and v_ini > v_c_num;  -- faixa toda antes do corte
      select coalesce(array_agg(x.id order by x.numero desc, x.k3, x.k4, x.k5, x.id), '{}')
        into v_parte
        from (select c.id, p.numero,
                     case c.tipo when 'pedido' then 0 when 'reposicao' then 1 when 'unidade' then 2 else 3 end as k3,
                     coalesce(c.item_seq, 0) as k4, coalesce(c.indice_unidade, 0) as k5
                from public.pedidos p
                join public.plt_cards c on c.pedido_id = p.id
               where p.numero >= v_ini and p.numero < v_fim
                 and (v_c_num is null
                      or (-p.numero::bigint,
                          case c.tipo when 'pedido' then 0 when 'reposicao' then 1 when 'unidade' then 2 else 3 end,
                          coalesce(c.item_seq, 0), coalesce(c.indice_unidade, 0), c.id)
                         > (-v_c_num, v_c_k3, v_c_k4, v_c_k5, p_depois_id))
                 and (c.tipo in ('pedido', 'avulso')
                      or (c.tipo = 'unidade' and (c.arquivado_em is null or c.pedido_id is not null))
                      or (c.tipo = 'reposicao' and c.arquivado_em is null and c.liberado_completo_em is null))
                 and (v_tudo
                      or c.setor_atual_id = any (v_setores)
                      or c.executor_atual_id = v_eu
                      or v_eu = any (c.participantes))
               order by p.numero desc, k3, k4, k5, c.id
               limit v_lim + 1 - cardinality(v_ids)) x;
      v_ids := v_ids || v_parte;
      exit when cardinality(v_ids) > v_lim;
    end loop;
  else
    -- o NOME: o vivo primeiro, o card mais novo primeiro (trigramas)
    select coalesce(array_agg(x.id order by x.arq, x.id desc), '{}')
      into v_ids
      from (select c.id, c.arquivado_em is not null as arq
              from public.plt_cards c
             where c.nome_busca like '%' || v_filtro.nome || '%'
               and (p_depois_id is null or v_c_arq is null
                    or (c.arquivado_em is not null, -c.id) > (v_c_arq, -p_depois_id))
               and (c.tipo in ('pedido', 'avulso')
                    or (c.tipo = 'unidade' and (c.arquivado_em is null or c.pedido_id is not null))
                    or (c.tipo = 'reposicao' and c.arquivado_em is null and c.liberado_completo_em is null))
               and (v_tudo
                    or c.setor_atual_id = any (v_setores)
                    or c.executor_atual_id = v_eu
                    or v_eu = any (c.participantes))
             order by c.arquivado_em is not null, c.id desc
             limit v_lim + 1) x;
  end if;

  v_mais := cardinality(v_ids) > v_lim;
  if v_mais then
    v_ids := v_ids[1:v_lim];
  end if;

  return jsonb_build_object(
    'tem_mais', v_mais,
    'numero', v_numb,
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'tipo', c.tipo,
               'pedido_id', c.pedido_id, 'pedido_numero', p.numero, 'pedido_situacao', p.situacao,
               'titulo', coalesce(c.titulo, c.item_descricao), 'sku', c.item_codigo,
               'indice', c.indice_unidade, 'total', c.total_unidades,
               'setor_id', s.id, 'setor_nome', s.nome, 'setor_codigo', s.codigo, 'setor_papel', s.papel_no_fluxo,
               'etapa_nome', e.nome,
               'desde', c.desde,
               'arquivado_em', c.arquivado_em, 'arquivado_motivo', a.motivo,
               'liberado_completo_em', c.liberado_completo_em,
               'standby', c.standby_desde is not null,
               'executor', u.nome,
               'rota_dia', r.data_entrega, 'rota_caminhao', r.caminhao, 'rota_numero', r.rota)
             order by o.ord)
        from unnest(v_ids) with ordinality as o(id, ord)
        join public.plt_cards c on c.id = o.id
        left join public.pedidos p on p.id = c.pedido_id
        left join public.plt_setores s on s.id = c.setor_atual_id
        left join public.plt_etapas e on e.id = c.etapa_atual_id
        left join public.plt_usuarios u on u.id = c.executor_atual_id
        left join lateral (
          select ev.dados ->> 'motivo' as motivo
            from public.plt_eventos ev
           where c.arquivado_em is not null and ev.card_id = c.id and ev.tipo = 'card_arquivado'
           order by ev.id desc limit 1
        ) a on true
        -- a rota do pedido (programada no card do pedido), enquanto não entregue
        left join lateral (
          select pr.data_entrega, cm.nome as caminhao, pr.rota
            from public.plt_cards pc
            join public.plt_programacoes pr on pr.card_id = pc.id
            left join public.plt_caminhoes cm on cm.id = pr.caminhao_id
           where c.pedido_id is not null and c.arquivado_em is null
             and pc.pedido_id = c.pedido_id and pc.tipo = 'pedido'
           limit 1
        ) r on true), '[]'::jsonb)
  );
end;
$$;

comment on function public.plt_fn_busca_cards(text, bigint, integer) is
  'SESSAO-40 (D-188): a busca geral — os cards de todos os setores pelo número do pedido (que começa com — o pedido mais novo primeiro, as faixas do índice andadas até encher a página) ou pelo nome com 3 letras ou mais (que contém — o vivo e o mais novo primeiro, trigramas), com onde cada um está (setor, etapa, arquivado e por quê, rota programada). Só o que a pessoa vê (admin, logística/PCP, o setor dela, o que executa ou participa). Por cursor (p_depois_id = o último mostrado), até 50 por vez.';

-- ----------------------------------------------------------------------------
-- 6 · Permissões — as portas para quem está logado; a maquinaria fora da API
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_filtro_do_quadro(text)                                       from public, anon, authenticated;
revoke all on function plt_privado.fn_quadro_pagina(bigint, bigint, timestamptz, bigint, integer, text, bigint[]) from public, anon, authenticated;
revoke all on function plt_privado.fn_quadro_filtrados(bigint, text)                              from public, anon, authenticated;
revoke all on function plt_privado.fn_quadro_total(bigint, bigint, bigint[])                        from public, anon, authenticated;
revoke all on function public.plt_fn_estoque_lancar_reposicao(bigint, integer, uuid)               from public, anon;
revoke all on function public.plt_fn_quadro_setor(bigint, integer, text, text)                     from public, anon;
revoke all on function public.plt_fn_quadro_coluna(bigint, bigint, timestamptz, bigint, integer, text, text) from public, anon;
revoke all on function public.plt_fn_pcp_quadro(integer, integer, text, text, text)                from public, anon;
revoke all on function public.plt_fn_busca_cards(text, bigint, integer)                            from public, anon;
grant execute on function public.plt_fn_estoque_lancar_reposicao(bigint, integer, uuid)            to authenticated;
grant execute on function public.plt_fn_quadro_setor(bigint, integer, text, text)                  to authenticated;
grant execute on function public.plt_fn_quadro_coluna(bigint, bigint, timestamptz, bigint, integer, text, text) to authenticated;
grant execute on function public.plt_fn_pcp_quadro(integer, integer, text, text, text)             to authenticated;
grant execute on function public.plt_fn_busca_cards(text, bigint, integer)                         to authenticated;
