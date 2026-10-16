-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 85 — MÓVEL, INSUMO E PEÇA: AS
-- CONTAS SEPARADAS NO ESTOQUE (SESSAO-32 · D-138, pedido do dono em 16/10)
--
-- "insumo não é móvel, móvel não é peça, peças são insumos e móveis são
-- produtos finais, então as contas devem ser separadas, mesmo que no setor de
-- estoque" — e: "Faça pelo código fiscal, porém crie também uma tela em
-- configurações (…) que dê para um admin alterar os itens entre móvel, insumo
-- e peça".
--
-- Antes: toda classe S ("simples") do Tiny contava como móvel — mas no Tiny da
-- fábrica a S mistura revenda (cadeiras, bases) e insumos (fita, bucha,
-- sapata, cola, luva, thinner…). A sincronização com o Tiny criava uma peça
-- por unidade desses insumos (o laço da migration 76; ~4.765 peças no ESTOQUE).
--
-- Agora cada produto tem um TIPO no estoque:
--   · automático (pelo cadastro do Tiny): fabricado (F) e com variação (V) =
--     móvel; simples (S) = móvel só com o código fiscal de móvel (NCM do
--     capítulo 94), senão insumo; matéria-prima (M) por peça (unidade "pc" —
--     as peças cortadas de MDF) = peça; o resto (M, K) = insumo;
--   · ou definido à mão por um admin (Configurações → Móveis, insumos e peças).
-- As contas de MÓVEIS (Top X, mínimo, reposição, capacidade, contagem da
-- logística, sincronização peça a peça com o Tiny) passam a considerar só o
-- tipo móvel; INSUMOS E PEÇAS vão para a aba Matéria-prima e insumos, contados
-- pelo número do Tiny (na unidade do produto — m², metro, unidade…). As peças
-- de insumo que já estão no ESTOQUE FICAM no quadro (resposta do dono) — só
-- deixam de contar como móvel.
--
-- Colunas novas em produtos (catálogo do Tiny; o n8n grava só as colunas dele
-- — fn_upsert_produto — e nunca estas, como minimo_plataforma/imagem_caminho):
--   tipo_estoque          — o tipo definido à mão (nulo = automático);
--   tipo_estoque_efetivo  — calculado e guardado (o à mão, senão o automático).
-- ⚠️ Mudar a regra automática = recriar fn_tipo_estoque_automatico E rodar
-- `update public.produtos set tipo_estoque = tipo_estoque` (recalcula a coluna).
-- Nada nas tabelas da integração de pedidos.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · O tipo automático, pelo cadastro do Tiny
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tipo_estoque_automatico(p_classe text, p_unidade text, p_raw jsonb)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
           when coalesce(p_classe, '') in ('F', 'V') then 'movel'
           when coalesce(p_classe, '') = 'S'
                and left(regexp_replace(coalesce(p_raw ->> 'ncm', ''), '[^0-9]', '', 'g'), 2) = '94'
             then 'movel'
           when coalesce(p_classe, '') = 'M' and lower(coalesce(p_unidade, '')) = 'pc' then 'peca'
           else 'insumo'
         end;
$$;

comment on function plt_privado.fn_tipo_estoque_automatico(text, text, jsonb) is
  'D-138: o tipo de estoque automático pelo cadastro do Tiny — F/V = móvel; S = móvel só com NCM do capítulo 94 (móveis), senão insumo; M com unidade pc (peças cortadas) = peça; o resto = insumo.';

-- ----------------------------------------------------------------------------
-- 2 · As colunas: o tipo à mão e o efetivo (guardado)
-- ----------------------------------------------------------------------------
alter table public.produtos add column if not exists tipo_estoque text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'produtos_tipo_estoque_ck') then
    alter table public.produtos add constraint produtos_tipo_estoque_ck
      check (tipo_estoque is null or tipo_estoque in ('movel', 'insumo', 'peca'));
  end if;
end;
$$;

alter table public.produtos add column if not exists tipo_estoque_efetivo text
  generated always as (coalesce(tipo_estoque, plt_privado.fn_tipo_estoque_automatico(classe, unidade, raw))) stored;

comment on column public.produtos.tipo_estoque is
  'D-138 (16/10/2026): o tipo de estoque definido À MÃO por um admin (Configurações → Móveis, insumos e peças): movel | insumo | peca. Nulo = automático (fn_tipo_estoque_automatico). Escrito só por plt_fn_produto_definir_tipo — o n8n nunca grava.';
comment on column public.produtos.tipo_estoque_efetivo is
  'D-138: o tipo que vale — o definido à mão, senão o automático pelo Tiny. Gerado e guardado. As contas de móvel (Top X, mínimo, reposição, contagem, sincronização peça a peça) usam tipo_estoque_efetivo = ''movel''; insumo e peça vão para a aba Matéria-prima e insumos.';

-- ----------------------------------------------------------------------------
-- 3 · As 14 funções do estoque com a regra nova (antes: classe F, S ou V)
-- ----------------------------------------------------------------------------
-- plt_privado.fn_eh_acabado_contado — recriada POR INTEIRO a partir da versão do banco de 16/10 (E-24); só a regra muda
CREATE OR REPLACE FUNCTION plt_privado.fn_eh_acabado_contado(p_produto_tiny_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.produtos pr
     where pr.tiny_id = p_produto_tiny_id
       and pr.situacao = 'A'
       and pr.tipo_estoque_efetivo = 'movel'
       and not plt_privado.fn_eh_personalizado(pr.descricao));
$function$;

-- plt_privado.fn_estoque_cortes_90d — recriada POR INTEIRO a partir da versão do banco de 16/10 (E-24); só a regra muda
CREATE OR REPLACE FUNCTION plt_privado.fn_estoque_cortes_90d()
 RETURNS TABLE(tiny_id bigint, cortes integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with corte as (
    select plt_privado.fn_estoque_corte() as maximo
  ),
  por_sku as (
    select distinct on (pr.codigo) pr.codigo, pr.tiny_id
      from public.produtos pr
     where pr.codigo is not null and pr.situacao = 'A'
       and pr.tipo_estoque_efetivo = 'movel'
     order by pr.codigo, pr.tiny_id
  )
  select ps.tiny_id, count(*)::int as cortes
    from public.pedidos p
    join public.pedido_itens pi on pi.pedido_id = p.id
    join por_sku ps on ps.codigo = pi.codigo
    cross join corte
   where p.data_pedido >= (now() at time zone 'America/Fortaleza')::date - 90
     and plt_privado.fn_situacao_normalizada(p.situacao) <> 'cancelado'
     and not plt_privado.fn_eh_personalizado(pi.descricao)
     and pi.quantidade > corte.maximo
   group by ps.tiny_id;
$function$;

-- plt_privado.fn_estoque_por_produto — recriada POR INTEIRO a partir da versão do banco de 16/10 (E-24); só a regra muda
CREATE OR REPLACE FUNCTION plt_privado.fn_estoque_por_produto()
 RETURNS TABLE(tiny_id bigint, codigo text, descricao text, classe text, unidade text, situacao text, minimo numeric, saldo_tiny numeric, reservado_tiny numeric, lido_em timestamp with time zone, origem_leitura text, evento_leitura_id bigint, reservas_loja numeric, disponivel numeric, prontos_reservados integer, prontos_livres integer, reposicao_card_id bigint, reposicao_estado text, reposicao_quantidade integer, reposicao_liberadas integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with cfg as (
    select plt_privado.fn_estoque_top_x() as top_x
  ),
  reservas as (
    select r.tiny_id, r.quantidade from plt_privado.fn_estoque_reservas_loja() r where r.tiny_id is not null
  ),
  reposicao as (
    select distinct on (rc.produto_tiny_id)
           rc.produto_tiny_id as tiny_id,
           rc.id              as card_id,
           rc.total_unidades  as quantidade,
           u.liberadas,
           case
             when u.em_producao > 0                then 'em_producao'
             when rc.arquivado_em is not null      then 'arquivada'
             when rc.liberado_completo_em is null  then 'no_pcp'
             else 'concluida'
           end                as estado
      from public.plt_cards rc
      left join lateral (
        select count(*)::int as liberadas,
               count(*) filter (where cu.arquivado_em is null and cu.concluido_em is null)::int as em_producao
          from public.plt_cards cu
         where cu.card_pai_id = rc.id and cu.tipo = 'unidade'
      ) u on true
     where rc.tipo = 'reposicao'
     order by rc.produto_tiny_id, rc.id desc
  )
  select pr.tiny_id,
         pr.codigo,
         pr.descricao,
         pr.classe,
         pr.unidade,
         pr.situacao,
         -- D-83: móvel = mínimo da plataforma, só no Top X; insumo/peça = plataforma, senão o do Tiny (D-138: o tipo é o de plt — móvel, insumo ou peça).
         case when pr.tipo_estoque_efetivo = 'movel'
              then case when n.posicao is not null and n.posicao <= cfg.top_x then pr.minimo_plataforma end
              else coalesce(pr.minimo_plataforma, pr.estoque_minimo) end      as minimo,
         n.saldo_tiny,
         n.reservado_tiny,
         n.lido_em,
         n.origem_leitura,
         n.evento_leitura_id,
         coalesce(r.quantidade, 0)                                           as reservas_loja,
         case when pr.tipo_estoque_efetivo = 'movel'
              then coalesce(n.livres, 0)::numeric
              when n.saldo_tiny is not null
              then n.saldo_tiny - coalesce(r.quantidade, 0) end               as disponivel,
         -- D-118: reservados em venda = prontas de pedido (aguardo + ROTAS até a
         -- entrega) + as peças do estoque reservadas pela venda.
         coalesce(n.prontas_pedido, 0) + coalesce(n.reservadas_estoque, 0)   as prontos_reservados,
         coalesce(n.livres, 0)                                               as prontos_livres,
         rp.card_id,
         rp.estado,
         rp.quantidade,
         rp.liberadas
    from public.produtos pr
    cross join cfg
    left join public.plt_estoque_numeros n on n.produto_tiny_id = pr.tiny_id
    left join reservas  r  on r.tiny_id  = pr.tiny_id
    left join reposicao rp on rp.tiny_id = pr.tiny_id;
$function$;

-- plt_privado.fn_gerar_reposicoes — recriada POR INTEIRO a partir da versão do banco de 16/10 (E-24); só a regra muda
CREATE OR REPLACE FUNCTION plt_privado.fn_gerar_reposicoes()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_pcp            bigint;
  v_card_id        bigint;
  v_qtd            integer;
  v_fim            timestamptz;
  v_mov            timestamptz;
  v_ultima_vencida boolean;
  v_gerados        integer := 0;
  r                record;
begin
  select s.id into v_pcp from public.plt_setores s
   where s.papel_no_fluxo = 'entrada' and s.ativo
   order by s.id limit 1;
  if v_pcp is null then
    return 0;
  end if;

  for r in
    select b.tiny_id, b.codigo, b.descricao, b.minimo, b.disponivel,
           b.saldo_tiny, b.reservas_loja,
           coalesce(rp.para_estoque, 0) as para_estoque
      from plt_privado.fn_estoque_por_produto() b
      join public.produtos pr on pr.tiny_id = b.tiny_id
      left join plt_privado.fn_reservados_producao() rp on rp.tiny_id = b.tiny_id
     where b.situacao = 'A'
       and pr.tipo_estoque_efetivo = 'movel'
       and coalesce(b.minimo, 0) > 0
       and b.disponivel + coalesce(rp.para_estoque, 0) < b.minimo
  loop
    -- Um card aberto por produto (a conta já desconta o que está em produção).
    if exists (
         select 1 from public.plt_cards rc
          where rc.tipo = 'reposicao' and rc.produto_tiny_id = r.tiny_id
            and rc.arquivado_em is null and rc.liberado_completo_em is null) then
      continue;
    end if;

    -- Depois de um ciclo DECIDIDO (Não produzir, coberto, liberado/concluído),
    -- só gera de novo com movimento novo do estoque. Se o ÚLTIMO ciclo VENCEU,
    -- a exigência não vale: a necessidade volta sozinha (D-85).
    select (e.dados ->> 'motivo' = 'reposicao_vencida') into v_ultima_vencida
      from public.plt_cards rc
      left join lateral (
        select ev.dados from public.plt_eventos ev
         where ev.card_id = rc.id and ev.tipo = 'card_arquivado'
         order by ev.id desc limit 1
      ) e on true
     where rc.tipo = 'reposicao' and rc.produto_tiny_id = r.tiny_id
     order by rc.id desc limit 1;
    if coalesce(v_ultima_vencida, false) then
      v_fim := null;
    else
      select max(greatest(coalesce(rc.arquivado_em, '-infinity'::timestamptz),
                          coalesce(rc.liberado_completo_em, '-infinity'::timestamptz),
                          coalesce((select max(cu.concluido_em) from public.plt_cards cu
                                     where cu.card_pai_id = rc.id and cu.tipo = 'unidade'),
                                   '-infinity'::timestamptz)))
        into v_fim
        from public.plt_cards rc
       where rc.tipo = 'reposicao' and rc.produto_tiny_id = r.tiny_id;
    end if;
    if v_fim is not null and v_fim > '-infinity'::timestamptz then
      select max(e.ocorrido_em) into v_mov
        from public.plt_eventos e
        join public.plt_cards c on c.id = e.card_id
       where c.tipo = 'unidade' and c.produto_tiny_id = r.tiny_id
         and e.tipo in ('card_criado', 'movimentacao_setor', 'card_arquivado',
                        'peca_alocada', 'unidade_desvinculada')
         and e.ocorrido_em > v_fim;
      if v_mov is null then
        continue;
      end if;
    end if;

    v_qtd := ceil(r.minimo - greatest(r.disponivel, 0) - r.para_estoque)::integer;
    if v_qtd < 1 then
      continue;
    end if;

    v_card_id := null;
    insert into public.plt_cards
        (tipo, produto_tiny_id, item_codigo, item_descricao, total_unidades, setor_atual_id)
      values
        ('reposicao', r.tiny_id, r.codigo, r.descricao, v_qtd, v_pcp)
      on conflict do nothing
      returning id into v_card_id;
    if v_card_id is null then
      continue;
    end if;

    insert into public.plt_eventos (card_id, tipo, origem, setor_destino_id, dados)
      values (v_card_id, 'card_criado', 'automacao', v_pcp,
              jsonb_build_object(
                'motivo',              'reposicao_estoque',
                'produto_tiny_id',     r.tiny_id,
                'sku',                 r.codigo,
                'minimo',              r.minimo,
                'em_estoque',          r.disponivel,
                'disponivel',          r.disponivel,
                'necessidade_extrema', 0,
                'reservados_producao', r.para_estoque,
                'quantidade',          v_qtd,
                'saldo_tiny',          r.saldo_tiny,
                'reservas_loja',       r.reservas_loja));
    v_gerados := v_gerados + 1;
  end loop;

  return v_gerados;
end;
$function$;

-- plt_privado.fn_minimo_efetivo — recriada POR INTEIRO a partir da versão do banco de 16/10 (E-24); só a regra muda
CREATE OR REPLACE FUNCTION plt_privado.fn_minimo_efetivo(p_tiny_id bigint)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case
           when pr.tipo_estoque_efetivo = 'movel' then
             case when n.posicao is not null and n.posicao <= plt_privado.fn_estoque_top_x()
                  then pr.minimo_plataforma end
           else coalesce(pr.minimo_plataforma, pr.estoque_minimo)
         end
    from public.produtos pr
    left join public.plt_estoque_numeros n on n.produto_tiny_id = pr.tiny_id
   where pr.tiny_id = p_tiny_id;
$function$;

-- plt_privado.fn_vendas_90d — recriada POR INTEIRO a partir da versão do banco de 16/10 (E-24); só a regra muda
CREATE OR REPLACE FUNCTION plt_privado.fn_vendas_90d()
 RETURNS TABLE(tiny_id bigint, codigo text, vendidos numeric, posicao integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with corte as (
    select plt_privado.fn_estoque_corte() as maximo
  ),
  por_sku as (
    select distinct on (pr.codigo) pr.codigo, pr.tiny_id
      from public.produtos pr
     where pr.codigo is not null and pr.situacao = 'A'
       and pr.tipo_estoque_efetivo = 'movel'
     order by pr.codigo, pr.tiny_id
  ),
  vendas as (
    select ps.tiny_id, ps.codigo, sum(pi.quantidade) as vendidos
      from public.pedidos p
      join public.pedido_itens pi on pi.pedido_id = p.id
      join por_sku ps on ps.codigo = pi.codigo
      cross join corte
     where p.data_pedido >= (now() at time zone 'America/Fortaleza')::date - 90
       and plt_privado.fn_situacao_normalizada(p.situacao) <> 'cancelado'
       and not plt_privado.fn_eh_personalizado(pi.descricao)
       and pi.quantidade <= corte.maximo
     group by ps.tiny_id, ps.codigo
  )
  select v.tiny_id, v.codigo, v.vendidos,
         row_number() over (order by v.vendidos desc, v.codigo, v.tiny_id)::int as posicao
    from vendas v
   where v.vendidos > 0;
$function$;

-- public.plt_fn_estoque_configuracoes — recriada POR INTEIRO a partir da versão do banco de 16/10 (E-24); só a regra muda
CREATE OR REPLACE FUNCTION public.plt_fn_estoque_configuracoes(p_busca text DEFAULT NULL::text, p_limite integer DEFAULT 20, p_deslocamento integer DEFAULT 0)
 RETURNS TABLE(tiny_id bigint, codigo text, descricao text, imagem_caminho text, posicao integer, vendidos_90d numeric, cortes integer, no_top boolean, media_semana numeric, minimo numeric, minimo_tiny numeric, minimo_travado boolean, sugestao integer, em_estoque integer, contagem_total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with cfg as (
    select plt_privado.fn_estoque_top_x() as top_x
  )
  select pr.tiny_id,
         pr.codigo,
         pr.descricao,
         pr.imagem_caminho,
         n.posicao,
         coalesce(n.vendidos_90d, 0),
         coalesce(n.cortes_90d, 0),
         (n.posicao is not null and n.posicao <= cfg.top_x),
         s.media_semana,
         case when n.posicao is not null and n.posicao <= cfg.top_x
              then pr.minimo_plataforma end,
         pr.estoque_minimo,
         pr.minimo_travado,
         s.sugestao,
         coalesce(n.livres, 0),
         count(*) over ()
    from public.produtos pr
    cross join cfg
    left join public.plt_estoque_numeros n          on n.produto_tiny_id = pr.tiny_id
    left join plt_privado.fn_sugestoes_minimo(null) s on s.tiny_id = pr.tiny_id
   where plt_privado.fn_pode_ver_expedicao()
     and pr.situacao = 'A'
     and pr.tipo_estoque_efetivo = 'movel'
     and (p_busca is null or btrim(p_busca) = ''
          or pr.descricao ilike '%' || btrim(p_busca) || '%'
          or pr.codigo ilike btrim(p_busca) || '%')
   order by n.posicao nulls last, pr.descricao, pr.tiny_id
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$function$;

-- public.plt_fn_estoque_lancar_reposicao — recriada POR INTEIRO a partir da versão do banco de 16/10 (E-24); só a regra muda
CREATE OR REPLACE FUNCTION public.plt_fn_estoque_lancar_reposicao(p_produto_tiny_id bigint, p_quantidade integer)
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

  select pr.tiny_id, pr.codigo, pr.descricao into v_produto
    from public.produtos pr
   where pr.tiny_id = p_produto_tiny_id and pr.situacao = 'A'
     and pr.tipo_estoque_efetivo = 'movel';
  if not found then
    raise exception 'Móvel não encontrado no catálogo (insumo e peça seguem o número do Tiny).' using errcode = 'no_data_found';
  end if;

  if exists (select 1 from public.plt_cards rc
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

  insert into public.plt_cards
      (tipo, produto_tiny_id, item_codigo, item_descricao, total_unidades, setor_atual_id)
    values
      ('reposicao', v_produto.tiny_id, v_produto.codigo, v_produto.descricao, p_quantidade, v_pcp)
    returning id into v_card_id;

  insert into public.plt_eventos (card_id, tipo, origem, usuario_id, setor_destino_id, dados)
    values (v_card_id, 'card_criado', 'interface', v_usuario, v_pcp,
            jsonb_build_object('motivo', 'reposicao_manual',
                               'produto_tiny_id', v_produto.tiny_id,
                               'sku', v_produto.codigo,
                               'quantidade', p_quantidade));

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'estoque_reposicao_lancada',
            jsonb_build_object('produto_tiny_id', v_produto.tiny_id, 'sku', v_produto.codigo,
                               'quantidade', p_quantidade, 'card_id', v_card_id));
  return v_card_id;
end;
$function$;

-- public.plt_fn_estoque_movimentar — recriada POR INTEIRO a partir da versão do banco de 16/10 (E-24); só a regra muda
CREATE OR REPLACE FUNCTION public.plt_fn_estoque_movimentar(p_produto_tiny_id bigint, p_operacao text, p_quantidade integer, p_observacao text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_usuario    uuid;
  v_produto    public.produtos%rowtype;
  v_estoque    bigint;
  v_atual      integer;
  v_reservadas integer;
  v_delta      integer;
  v_motivo     text;
  v_obs        text;
  v_dados      jsonb;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma movimenta o estoque.'
      using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Movimentar o estoque é gesto da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_operacao is null or p_operacao not in ('entrada', 'baixa', 'contagem') then
    raise exception 'Escolha entrada, baixa ou contagem.' using errcode = 'check_violation';
  end if;
  -- O CASE vai entre parênteses: no IF do plpgsql, o primeiro THEN solto
  -- fecha a condição (E-61).
  if p_quantidade is null or p_quantidade > 500
     or p_quantidade < (case when p_operacao = 'contagem' then 0 else 1 end) then
    raise exception 'A quantidade precisa ser um número inteiro de % a 500.',
      case when p_operacao = 'contagem' then 0 else 1 end
      using errcode = 'check_violation';
  end if;

  select * into v_produto from public.produtos where tiny_id = p_produto_tiny_id;
  if not found then
    raise exception 'Produto não encontrado no catálogo.' using errcode = 'no_data_found';
  end if;
  if coalesce(v_produto.situacao, '') <> 'A' then
    raise exception 'Este produto está inativo no Tiny — não entra no estoque.'
      using errcode = 'check_violation';
  end if;
  if coalesce(v_produto.tipo_estoque_efetivo, '') <> 'movel' then
    raise exception 'A contagem daqui é de móvel — matéria-prima, insumo e peça seguem pelo Tiny.'
      using errcode = 'check_violation';
  end if;
  if plt_privado.fn_eh_personalizado(v_produto.descricao) then
    raise exception 'Produto personalizado não entra no estoque por aqui.'
      using errcode = 'check_violation';
  end if;

  select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque' and s.ativo;
  if v_estoque is null then
    raise exception 'O ESTOQUE não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  -- Uma movimentação por vez em cada produto (duas baixas ao mesmo tempo não
  -- pegam a mesma peça; a reserva da venda espera a vez).
  perform pg_advisory_xact_lock(hashtextextended('plt_estoque_produto:' || p_produto_tiny_id, 0));

  select x.livres, x.reservadas into v_atual, v_reservadas
    from plt_privado.fn_estoque_pecas(p_produto_tiny_id) x;

  if p_operacao = 'contagem' and p_quantidade < v_reservadas then
    raise exception 'Há % peça(s) deste produto reservada(s) para pedidos no galpão — a contagem não pode ser menor. Se alguma já saiu, o pedido resolve.', v_reservadas
      using errcode = 'check_violation';
  end if;

  v_delta := case p_operacao
               when 'entrada' then p_quantidade
               when 'baixa'   then -p_quantidade
               else p_quantidade - v_reservadas - v_atual
             end;
  v_motivo := case p_operacao
                when 'entrada' then 'entrada_manual'
                when 'baixa'   then 'baixa_manual'
                else 'contagem'
              end;
  v_obs := nullif(btrim(coalesce(p_observacao, '')), '');

  if v_delta < 0 and -v_delta > v_atual then
    raise exception 'Só há % deste produto no estoque — não dá para dar baixa em %.', v_atual, -v_delta
      using errcode = 'check_violation';
  end if;

  v_dados := jsonb_strip_nulls(jsonb_build_object(
    'motivo',          v_motivo,
    'produto_tiny_id', p_produto_tiny_id,
    'sku',             v_produto.codigo,
    'quantidade',      abs(v_delta),
    'antes',           v_atual,
    'depois',          v_atual + v_delta,
    'reservadas',      nullif(v_reservadas, 0),
    'contado',         case when p_operacao = 'contagem' then p_quantidade end));

  if v_delta = 0 then
    -- Contagem conferida e igual: nada muda no estoque, fica o registro (D-40).
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
      values (v_usuario, 'estoque_contagem_conferida', v_dados);
    -- D-77: a contagem conferida também põe o Tiny igual à plataforma.
    perform plt_privado.fn_tiny_estoque_enfileirar(p_produto_tiny_id, true, 'contagem_conferida');
    return v_atual;
  end if;

  if v_delta > 0 then
    perform plt_privado.fn_estoque_criar_pecas(p_produto_tiny_id, v_delta, v_usuario,
                                               'interface', v_obs, v_dados);
  else
    perform plt_privado.fn_estoque_baixar_pecas(p_produto_tiny_id, -v_delta, v_usuario,
                                                'interface', v_obs, v_dados);
  end if;

  return v_atual + v_delta;
end;
$function$;

-- public.plt_fn_estoque_produtos — recriada POR INTEIRO a partir da versão do banco de 16/10 (E-24); a regra muda
-- e a devolução ganha tipo_estoque no fim (a aba de insumos mostra insumo × peça) — formato novo: drop + create
drop function if exists public.plt_fn_estoque_produtos(text, text, text, integer, integer);
CREATE OR REPLACE FUNCTION public.plt_fn_estoque_produtos(p_grupo text DEFAULT 'acabados'::text, p_busca text DEFAULT NULL::text, p_filtro text DEFAULT NULL::text, p_limite integer DEFAULT 20, p_deslocamento integer DEFAULT 0)
 RETURNS TABLE(tiny_id bigint, codigo text, descricao text, classe text, unidade text, imagem_caminho text, posicao integer, vendidos_90d numeric, cortes integer, no_top boolean, minimo numeric, minimo_tiny numeric, minimo_travado boolean, sugestao integer, em_estoque numeric, reservados_venda integer, reservadas_estoque integer, reservados_producao integer, em_necessidade boolean, repor_sugerido integer, pendente_card_id bigint, pendente_pedido_numero integer, saldo_tiny numeric, lido_em timestamp with time zone, origem_leitura text, reposicao_estado text, em_devolucao integer, tipo_estoque text, contagem_total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with cfg as (
    select plt_privado.fn_estoque_top_x() as top_x
  ),
  -- A bolinha vermelha (D-86): a reserva mais antiga cujo pedido ainda espera
  -- a decisão do PCP (card do pedido vivo e não liberado por inteiro).
  pendentes as (
    select distinct on (c.produto_tiny_id)
           c.produto_tiny_id as tiny_id,
           cp.id             as card_id,
           p.numero          as pedido_numero
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
      join public.plt_cards cp on cp.pedido_id = c.reservada_pedido_id
                              and cp.tipo = 'pedido' and cp.arquivado_em is null
                              and cp.liberado_completo_em is null
      join public.pedidos p on p.id = c.reservada_pedido_id
     where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
       and c.reservada_pedido_id is not null and c.produto_tiny_id is not null
     order by c.produto_tiny_id, c.reservada_em
  ),
  base as (
    select b.tiny_id, b.codigo, b.descricao, b.classe, b.unidade, b.minimo, b.disponivel,
           b.saldo_tiny, b.lido_em, b.origem_leitura, b.prontos_reservados, b.reposicao_estado,
           pr.imagem_caminho, pr.estoque_minimo as minimo_tiny, pr.minimo_travado,
           pr.tipo_estoque_efetivo as tipo_,
           n.posicao, n.vendidos_90d as vendidos,
           coalesce(n.cortes_90d, 0)                                                    as cortes_,
           sg.sugestao                                                                  as sugestao_,
           (n.posicao is not null and n.posicao <= cfg.top_x)                           as no_top_,
           coalesce(n.reservadas_estoque, 0)                                            as reservadas_estoque_,
           coalesce(n.em_devolucao, 0)                                                  as em_devolucao_,
           coalesce(rp.exibicao, 0)                                                     as reservados_producao_,
           coalesce(rp.para_estoque, 0)                                                 as para_estoque_,
           (coalesce(b.minimo, 0) > 0
              and coalesce(b.disponivel, 0) + coalesce(rp.para_estoque, 0) < b.minimo)  as em_necessidade_,
           case when coalesce(b.minimo, 0) > 0
                then greatest(ceil(b.minimo - greatest(coalesce(b.disponivel, 0), 0)
                                   - coalesce(rp.para_estoque, 0))::int, 0)
                else 0 end                                                              as repor_sugerido_,
           pd.card_id                                                                   as pendente_card_,
           pd.pedido_numero                                                             as pendente_numero_,
           case when b.disponivel is not null then greatest(b.disponivel, 0) end        as em_estoque_
      from plt_privado.fn_estoque_por_produto() b
      join public.produtos pr on pr.tiny_id = b.tiny_id
      cross join cfg
      left join public.plt_estoque_numeros n          on n.produto_tiny_id = b.tiny_id
      left join plt_privado.fn_sugestoes_minimo(null) sg on sg.tiny_id = b.tiny_id
      left join plt_privado.fn_reservados_producao() rp on rp.tiny_id = b.tiny_id
      left join pendentes   pd on pd.tiny_id = b.tiny_id
     where b.situacao = 'A'
       and case when coalesce(p_grupo, 'acabados') = 'insumos'
                then pr.tipo_estoque_efetivo <> 'movel'
                else pr.tipo_estoque_efetivo = 'movel'
           end
  ),
  visivel as (
    select b.*
      from base b
     where plt_privado.fn_pode_ver_expedicao()
       and (p_busca is null or btrim(p_busca) = ''
            or b.descricao ilike '%' || btrim(p_busca) || '%'
            or b.codigo ilike btrim(p_busca) || '%')
  )
  select f.tiny_id,
         f.codigo,
         f.descricao,
         f.classe,
         f.unidade,
         f.imagem_caminho,
         f.posicao,
         coalesce(f.vendidos, 0),
         f.cortes_,
         coalesce(f.no_top_, false),
         f.minimo,
         f.minimo_tiny,
         f.minimo_travado,
         f.sugestao_,
         f.em_estoque_,
         f.prontos_reservados,
         f.reservadas_estoque_,
         f.reservados_producao_,
         f.em_necessidade_,
         f.repor_sugerido_,
         f.pendente_card_,
         f.pendente_numero_,
         f.saldo_tiny,
         f.lido_em,
         f.origem_leitura,
         f.reposicao_estado,
         f.em_devolucao_,
         f.tipo_,
         count(*) over ()
    from visivel f
   where case
           when coalesce(p_grupo, 'acabados') = 'insumos'
             then coalesce(p_filtro, '') <> 'sem_leitura' or f.saldo_tiny is null
           when p_busca is not null and btrim(p_busca) <> '' then true
           when p_filtro = 'necessidade'         then f.em_necessidade_
           when p_filtro = 'reservados_producao' then f.reservados_producao_ > 0
           when p_filtro = 'com_estoque'         then coalesce(f.em_estoque_, 0) > 0
           when p_filtro = 'em_devolucao'        then f.em_devolucao_ > 0
           else true
         end
   order by (coalesce(p_grupo, 'acabados') = 'insumos' and coalesce(f.em_estoque_, 0) > 0) desc,
            f.posicao nulls last,
            f.descricao,
            f.tiny_id
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$function$;

-- public.plt_fn_estoque_resumo — recriada POR INTEIRO a partir da versão do banco de 16/10 (E-24); só a regra muda
CREATE OR REPLACE FUNCTION public.plt_fn_estoque_resumo()
 RETURNS TABLE(moveis_estoque integer, pecas_unidades numeric, pecas_m2 numeric, moveis_reservados integer, pecas_producao integer, moveis_producao integer, soma_minimos numeric, produtos_abaixo integer, moveis_em_devolucao integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with base as (
    select b.tiny_id, b.classe, b.unidade, b.minimo, b.disponivel, b.prontos_reservados,
           pr.tipo_estoque_efetivo as tipo
      from plt_privado.fn_estoque_por_produto() b
      join public.produtos pr on pr.tiny_id = b.tiny_id
     where b.situacao = 'A'
  ),
  acabados as (
    select b.*, coalesce(n.producao_sem_dono, 0) as producao_sem_dono,
           coalesce(n.em_devolucao, 0) as em_devolucao,
           coalesce(n.producao_de_pedido, 0) as producao_de_pedido,
           coalesce(rp.para_estoque, 0) as para_estoque
      from base b
      left join public.plt_estoque_numeros n on n.produto_tiny_id = b.tiny_id
      left join plt_privado.fn_reservados_producao() rp on rp.tiny_id = b.tiny_id
     where b.tipo = 'movel'
  ),
  insumos as (
    select b.unidade, greatest(coalesce(b.disponivel, 0), 0) as quantidade
      from base b where b.tipo <> 'movel'
  )
  select (select coalesce(sum(a.disponivel), 0)::int from acabados a),
         (select coalesce(sum(i.quantidade), 0) from insumos i
           where lower(coalesce(i.unidade, '')) not in ('m2', 'm²', 'm^2')),
         (select coalesce(sum(i.quantidade), 0) from insumos i
           where lower(coalesce(i.unidade, '')) in ('m2', 'm²', 'm^2')),
         (select coalesce(sum(a.prontos_reservados), 0)::int from acabados a),
         (select coalesce(sum(a.producao_sem_dono), 0)::int from acabados a),
         (select coalesce(sum(a.producao_de_pedido), 0)::int from acabados a),
         (select coalesce(sum(a.minimo), 0) from acabados a),
         (select count(*)::int from acabados a
           where coalesce(a.minimo, 0) > 0 and a.disponivel + a.para_estoque < a.minimo),
         (select coalesce(sum(a.em_devolucao), 0)::int from acabados a)
   where plt_privado.fn_pode_ver_expedicao();
$function$;

-- public.plt_fn_tiny_estoque_ligar — recriada POR INTEIRO a partir da versão do banco de 16/10 (E-24); só a regra muda
CREATE OR REPLACE FUNCTION public.plt_fn_tiny_estoque_ligar()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_usuario uuid;
  v_desde   timestamptz;
  v_n       integer := 0;
  r         record;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_eh_admin() then
    raise exception 'Ligar o sincronismo com o Tiny é gesto de admin.' using errcode = 'insufficient_privilege';
  end if;
  v_desde := plt_privado.fn_tiny_estoque_desde();
  if v_desde is not null then
    return jsonb_build_object('ligado_desde', v_desde, 'ja_estava', true);
  end if;
  update public.plt_setores set tiny_sincronizado_desde = now() where codigo = 'estoque'
    returning tiny_sincronizado_desde into v_desde;
  -- D-79: o ponto de partida — cada acabado lê o Tiny uma vez e fica com o saldo dele.
  for r in
    select pr.tiny_id from public.produtos pr
     where pr.situacao = 'A' and pr.tipo_estoque_efetivo = 'movel'
       and not plt_privado.fn_eh_personalizado(pr.descricao)
  loop
    if plt_privado.fn_tiny_estoque_enfileirar(r.tiny_id, false, 'ponto_de_partida', true) then
      v_n := v_n + 1;
    end if;
  end loop;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'estoque_tiny_ligado', jsonb_build_object('desde', v_desde, 'produtos', v_n));
  return jsonb_build_object('ligado_desde', v_desde, 'produtos_para_copiar', v_n);
end;
$function$;

-- public.plt_fn_tiny_estoque_varrer — recriada POR INTEIRO a partir da versão do banco de 16/10 (E-24); só a regra muda
CREATE OR REPLACE FUNCTION public.plt_fn_tiny_estoque_varrer()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_n integer := 0;
  r   record;
begin
  if plt_privado.fn_tiny_estoque_desde() is null then
    return 0;
  end if;
  for r in
    select pr.tiny_id from public.produtos pr
     where pr.situacao = 'A' and pr.tipo_estoque_efetivo = 'movel'
       and not plt_privado.fn_eh_personalizado(pr.descricao)
  loop
    if plt_privado.fn_tiny_estoque_enfileirar(r.tiny_id, false, 'varredura') then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$function$;

-- public.plt_fn_tiny_reservas_presas — recriada POR INTEIRO a partir da versão do banco de 16/10 (E-24); só a regra muda
CREATE OR REPLACE FUNCTION public.plt_fn_tiny_reservas_presas(p_limite integer DEFAULT 10, p_deslocamento integer DEFAULT 0)
 RETURNS TABLE(tiny_id bigint, codigo text, descricao text, saldo_tiny numeric, reservado_tiny numeric, pedidos_abertos numeric, presas numeric, lido_em timestamp with time zone, contagem_total bigint, total_presas numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with leituras as (
    -- a leitura mais nova que traz o reservado (leitura da fila ou carga)
    select distinct on (x.tiny_id) x.*
      from (
        select (e.payload -> 'dados' ->> 'idProduto')::bigint                         as tiny_id,
               plt_privado.fn_tiny_numero(e.payload -> 'dados' ->> 'saldo')           as saldo,
               plt_privado.fn_tiny_numero(e.payload -> 'dados' ->> 'saldoReservado')  as reservado,
               e.recebido_em,
               e.id
          from public.eventos e
         where e.tipo = 'estoque_fabrica'
           and e.payload ->> 'cnpj' = '27556613000166'
           and e.payload ->> 'origem' in ('leitura', 'carga_inicial')
           and (e.payload -> 'dados' ->> 'idProduto') ~ '^[0-9]+$'
      ) x
     where x.reservado is not null
     order by x.tiny_id, x.id desc
  ),
  abertos as (
    -- unidades de pedidos da loja que ainda não saíram (o que o Tiny DEVIA reservar)
    select pi.codigo, sum(pi.quantidade) as quantidade
      from public.pedidos p
      join public.pedido_itens pi on pi.pedido_id = p.id
     where plt_privado.fn_situacao_normalizada(p.situacao) not in ('entregue', 'nao_entregue', 'cancelado')
       and not plt_privado.fn_eh_personalizado(pi.descricao)
       and pi.codigo is not null
     group by pi.codigo
  ),
  presas as (
    select pr.tiny_id, pr.codigo, pr.descricao, l.saldo, l.reservado,
           coalesce(a.quantidade, 0)               as abertos,
           l.reservado - coalesce(a.quantidade, 0) as presas,
           l.recebido_em
      from leituras l
      join public.produtos pr on pr.tiny_id = l.tiny_id
      left join abertos a on a.codigo = pr.codigo
     where pr.situacao = 'A'
       and pr.tipo_estoque_efetivo = 'movel'
       and not plt_privado.fn_eh_personalizado(pr.descricao)
       -- serviço do Tiny (Corte, Furo, Fitamento…) não é móvel: a reserva
       -- dele não mexe no disponível que a equipe olha (achado na 1ª leitura
       -- real: 8 serviços com 22 mil "reservas")
       and coalesce(pr.raw ->> 'tipo', 'P') <> 'S'
       -- sem SKU não dá para comparar com os pedidos (o pedido chega por SKU)
       and pr.codigo is not null
       and l.reservado > coalesce(a.quantidade, 0)
  )
  select p.tiny_id, p.codigo, p.descricao, p.saldo, p.reservado, p.abertos, p.presas, p.recebido_em,
         count(*) over (), sum(p.presas) over ()
    from presas p
   where plt_privado.fn_pode_ver_expedicao()
   order by p.presas desc, p.codigo nulls last, p.tiny_id
   limit least(greatest(coalesce(p_limite, 10), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$function$;

-- ----------------------------------------------------------------------------
-- 4 · A tela de Configurações: a lista (paginada, com filtros) e a troca
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_produtos_classificacao(
  p_busca        text    default null,
  p_tipo         text    default null,   -- movel | insumo | peca | nulo = todos
  p_classe       text    default null,   -- F | S | M | K | V | nulo = todas
  p_origem       text    default null,   -- automatico | manual | nulo = todas
  p_situacao     text    default 'A',    -- A | I | nulo = todas
  p_limite       integer default 30,
  p_deslocamento integer default 0
)
returns table (
  tiny_id         bigint,
  codigo          text,
  descricao       text,
  classe          text,
  unidade         text,
  ncm             text,
  situacao        text,
  tipo            text,
  tipo_automatico text,
  definido_a_mao  boolean,
  imagem_caminho  text,
  contagem_total  bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pr.tiny_id,
         pr.codigo,
         pr.descricao,
         pr.classe,
         pr.unidade,
         nullif(btrim(coalesce(pr.raw ->> 'ncm', '')), '')                       as ncm,
         pr.situacao,
         pr.tipo_estoque_efetivo                                                  as tipo,
         plt_privado.fn_tipo_estoque_automatico(pr.classe, pr.unidade, pr.raw)    as tipo_automatico,
         pr.tipo_estoque is not null                                              as definido_a_mao,
         pr.imagem_caminho,
         count(*) over ()                                                         as contagem_total
    from public.produtos pr
   where plt_privado.fn_eh_admin()
     and (p_busca is null or btrim(p_busca) = ''
          or pr.descricao ilike '%' || btrim(p_busca) || '%'
          or pr.codigo ilike btrim(p_busca) || '%')
     and (p_tipo is null or pr.tipo_estoque_efetivo = p_tipo)
     and (p_classe is null or pr.classe = p_classe)
     and (p_origem is null
          or (p_origem = 'manual' and pr.tipo_estoque is not null)
          or (p_origem = 'automatico' and pr.tipo_estoque is null))
     and (p_situacao is null or pr.situacao = p_situacao)
   order by pr.descricao, pr.tiny_id
   limit least(greatest(coalesce(p_limite, 30), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_produtos_classificacao(text, text, text, text, text, integer, integer) is
  'D-138: Configurações → Móveis, insumos e peças — o catálogo do Tiny com o tipo de estoque (o que vale, o automático e se foi à mão), filtros (busca por nome/SKU, tipo, classe do Tiny, origem, situação), 1–100 por página com o total (catálogo limitado — deslocamento justificado). Só o admin.';

create or replace function public.plt_fn_produto_definir_tipo(p_tiny_id bigint, p_tipo text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_antes  text;
  v_depois text;
begin
  if v_eu is null or not plt_privado.fn_eh_admin() then
    raise exception 'Só o admin muda o tipo do produto.' using errcode = 'insufficient_privilege';
  end if;
  if p_tipo is not null and p_tipo not in ('movel', 'insumo', 'peca') then
    raise exception 'O tipo é móvel, insumo ou peça.' using errcode = 'check_violation';
  end if;
  select pr.tipo_estoque_efetivo into v_antes from public.produtos pr where pr.tiny_id = p_tiny_id;
  if not found then
    raise exception 'Produto não encontrado no catálogo.' using errcode = 'no_data_found';
  end if;
  update public.produtos set tipo_estoque = p_tipo where tiny_id = p_tiny_id
  returning tipo_estoque_efetivo into v_depois;
  insert into public.plt_logs_atividade (usuario_id, acao, rota, contexto)
  values (v_eu, 'produto_tipo_definido', null,
          jsonb_build_object('tiny_id', p_tiny_id, 'de', v_antes, 'para', v_depois, 'a_mao', p_tipo is not null));
  -- deixou de ser (ou virou) móvel: a posição no ranking das vendas muda na hora
  if v_antes is distinct from v_depois and (v_antes = 'movel' or v_depois = 'movel') then
    perform plt_privado.fn_estoque_vendas_atualizar();
  end if;
  return v_depois;
end;
$$;

comment on function public.plt_fn_produto_definir_tipo(bigint, text) is
  'D-138: o admin define o tipo de estoque de um produto (movel | insumo | peca) ou volta ao automático (nulo); fica na trilha (produto_tipo_definido); quando entra ou sai dos móveis, o ranking das vendas é refeito.';

revoke all on function public.plt_fn_estoque_produtos(text, text, text, integer, integer) from public, anon;
grant execute on function public.plt_fn_estoque_produtos(text, text, text, integer, integer) to authenticated;
revoke all on function public.plt_fn_produtos_classificacao(text, text, text, text, text, integer, integer) from public, anon;
grant execute on function public.plt_fn_produtos_classificacao(text, text, text, text, text, integer, integer) to authenticated;
revoke all on function public.plt_fn_produto_definir_tipo(bigint, text) from public, anon;
grant execute on function public.plt_fn_produto_definir_tipo(bigint, text) to authenticated;
revoke all on function plt_privado.fn_tipo_estoque_automatico(text, text, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5 · A fila do Tiny (a conciliação PEÇA A PEÇA) é só de móvel: o que virou
--     insumo ou peça sai dela — inclusive os 2 parados de madrugada por "saldo
--     alto demais para virar peças" (a fita e o suporte). O número deles segue
--     vindo do Tiny, como o de todo insumo; nenhuma peça nasce.
-- ----------------------------------------------------------------------------
delete from public.plt_tiny_estoque_fila f
 using public.produtos pr
 where pr.tiny_id = f.produto_tiny_id
   and pr.tipo_estoque_efetivo <> 'movel';

-- ----------------------------------------------------------------------------
-- 6 · O ranking das vendas refeito JÁ (sem esperar a madrugada): o Top X, as
--     posições e os cortes passam a contar só móvel — nenhum insumo ocupa
--     lugar de móvel no Top até amanhã.
-- ----------------------------------------------------------------------------
do $$
begin
  perform plt_privado.fn_estoque_vendas_atualizar();
end;
$$;
