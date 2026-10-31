-- ============================================================================
-- Ajuste de 28/10/2026 (D-201) — o pedido novo usa a peça SEM DONO que ainda
-- está em produção (reposição de estoque ou pedido cancelado), pelo PCP
--
-- Pedido do dono: "quando um pedido de reposição de estoque é lançado e chega um
-- pedido de venda para o móvel que já está em produção como reposição, precisamos
-- que seja possível lincar o pedido que acabou de chegar com o que já está em
-- produção … transformar o card do pedido de reposição em um card de pedido de
-- venda através do PCP". Respostas (28/10): na janela "Liberar unidades", como a
-- sugestão do estoque (D-62); vale para a reposição E para a peça de pedido
-- cancelado que segue em produção; do lado do estoque a reposição "só perde a
-- peça" (se faltar, a automática ou a logística lançam de novo, como hoje).
--
--   1. O fato novo 'peca_vinculada' (na peça): a peça passa a ser do pedido ONDE
--      ESTÁ — setor, etapa, quem trabalha nela e o tempo seguem iguais; muda o
--      dono (pedido, item, k/n). Projeção própria (nada da maquinaria antiga muda).
--      A peça de REPOSIÇÃO guarda a reposição como pai (a vaga dela continua
--      "liberada" — só perde a peça; o número do estoque troca a peça de "a
--      caminho do estoque" para "de pedido" pela projeção de sempre); a de pedido
--      CANCELADO passa a ter o pedido novo como pai.
--   2. A janela de liberação traz, na MESMA requisição, `em_producao`: para cada
--      vaga que o estoque não cobre, a peça igual mais adiantada (setor mais à
--      frente, etapa mais à frente, há mais tempo ali), com onde está e de onde
--      veio. Nunca decide sozinha: a tela vem desmarcada.
--   3. A liberação aceita {item_seq, indice_unidade, peca_producao_id} — tudo na
--      mesma transação de antes (tudo ou nada; o toque repetido não duplica).
--   4. O fim do tempo em PCP do pedido conta o instante em que a peça passou a
--      ser dele (antes: a criação da unidade, que na peça de reposição é antiga).
--   5. A reposição que ainda está no PCP não oferece de novo a vaga da peça que
--      foi para um pedido (a janela e a liberação leem a vaga original no fato).
--
-- Nenhuma tabela nova; nada da integração. Recriadas a partir da migration
-- 20261008140000 (a janela e a liberação) e da 20260928120000 (a conta do
-- "liberado completo") — só o que está marcado com D-201 mudou.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · O tipo do fato (recriado com a lista de 20261027040000 + 'peca_vinculada';
--     quem valida é a última que recria — hoje a 20261031020000, E-19)
-- ----------------------------------------------------------------------------
alter table public.plt_eventos drop constraint if exists plt_eventos_tipo_check;
alter table public.plt_eventos add constraint plt_eventos_tipo_check check (tipo = any (array[
  'card_criado', 'movimentacao_setor', 'movimentacao_etapa', 'execucao_iniciada', 'execucao_finalizada',
  'execucao_pausada', 'execucao_retomada', 'qualidade_marcada', 'qualidade_parecer', 'divergencia_registrada',
  'notificacao_enviada', 'delegacao', 'estorno', 'pedido_atualizado', 'pedido_cancelado', 'card_arquivado',
  'pedido_entregue', 'pedido_lancado_rotas', 'unidade_desvinculada', 'peca_alocada', 'peca_reservada',
  'peca_reserva_desfeita', 'estoque_reserva_avaliada', 'etiqueta_adicionada', 'etiqueta_removida',
  'card_desarquivado', 'entrega_desfeita', 'entrega_nao_realizada', 'pedido_devolvido', 'comentario_adicionado',
  'anexo_adicionado', 'devolucao_decidida', 'ajuste_aberto', 'ajuste_concluido', 'avulso_concluido',
  'card_editado', 'responsavel_adicionado', 'responsavel_removido', 'anexo_removido', 'comentario_editado',
  'comentario_apagado', 'auxilio_iniciado', 'auxilio_pausado', 'auxilio_retomado', 'auxilio_encerrado',
  'prioridade_definida', 'responsavel_setor_definido', 'pedido_standby_entrou', 'pedido_standby_saiu',
  'data_entrega_alterada',
  'peca_vinculada'  -- D-201: a peça sem dono em produção passou a ser de um pedido
]::text[])) not valid;
-- SESSAO-42: o validate mudou para a 20261031020000 (E-19 — só a última que recria valida)

-- ----------------------------------------------------------------------------
-- 2 · A projeção do fato: o dono novo da peça (o resto do card não muda)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_projetar_peca_vinculada()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes  bigint;
  v_depois bigint := nullif(new.dados ->> 'pedido_id', '')::bigint;
begin
  select c.pedido_id into v_antes from public.plt_cards c where c.id = new.card_id and c.tipo = 'unidade';
  update public.plt_cards
     set pedido_id      = v_depois,
         card_pai_id    = coalesce(nullif(new.dados ->> 'card_pai_id', '')::bigint, card_pai_id),
         item_seq       = (new.dados ->> 'item_seq')::int,
         indice_unidade = (new.dados ->> 'indice_unidade')::int,
         total_unidades = (new.dados ->> 'total_unidades')::int,
         item_codigo    = new.dados ->> 'item_codigo',
         item_descricao = new.dados ->> 'item_descricao'
   where id = new.card_id and tipo = 'unidade';
  -- o "liberado completo" dos dois pedidos (o cancelado perde a peça; o novo ganha)
  if v_antes is not null and v_antes is distinct from v_depois then
    perform plt_privado.fn_recalcular_liberacao(v_antes);
  end if;
  if v_depois is not null then
    perform plt_privado.fn_recalcular_liberacao(v_depois);
  end if;
  return null;
end;
$$;

comment on function plt_privado.fn_projetar_peca_vinculada() is
  'D-201 (28/10): projeção do fato peca_vinculada — a peça sem dono em produção passa a ser do pedido (pedido, pai, item, k/n e o snapshot do item vêm do fato); setor, etapa, execução e tempo não mudam. Recalcula o "liberado completo" do pedido de antes (cancelado) e do novo.';

drop trigger if exists plt_eventos_projetar_peca_vinculada on public.plt_eventos;
create trigger plt_eventos_projetar_peca_vinculada
  after insert on public.plt_eventos
  for each row
  when (new.tipo = 'peca_vinculada')
  execute function plt_privado.fn_projetar_peca_vinculada();

-- ----------------------------------------------------------------------------
-- 3 · O fim do tempo em PCP (recriada POR INTEIRO a partir da 20260928120000):
--     a última unidade liberada OU ligada ao pedido (D-201)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_recalcular_liberacao(p_pedido_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total     integer;
  v_liberadas integer;
  v_quando    timestamptz;
begin
  -- Total de unidades de produção (D-63): a mesma regra de
  -- plt_fn_pedido_itens_kanban — frete não conta.
  v_total := plt_privado.fn_unidades_do_pedido(p_pedido_id);

  -- D-63: card de frete nascido antes da regra não conta como liberado —
  -- senão ele "completaria" o pedido com um móvel ainda no PCP.
  select count(*)::int into v_liberadas
    from public.plt_cards cu
   where cu.pedido_id = p_pedido_id and cu.tipo = 'unidade'
     and not exists (select 1 from plt_privado.vw_itens_producao v
                      where v.pedido_id = cu.pedido_id and v.seq = cu.item_seq and v.eh_frete);

  if v_total > 0 and v_liberadas >= v_total then
    -- O instante da liberação da ÚLTIMA unidade (D-48: fim do tempo em PCP).
    -- D-201: a peça que veio da produção sem dono conta de quando passou a ser
    -- deste pedido (a criação dela é de antes do pedido existir).
    select max(e.ocorrido_em) into v_quando
      from public.plt_eventos e
      join public.plt_cards cu
        on cu.id = e.card_id and cu.tipo = 'unidade' and cu.pedido_id = p_pedido_id
     where e.tipo = 'card_criado'
        or (e.tipo = 'peca_vinculada' and e.dados ->> 'pedido_id' = p_pedido_id::text);
  else
    v_quando := null;
  end if;

  update public.plt_cards
     set liberado_completo_em = v_quando
   where pedido_id = p_pedido_id and tipo = 'pedido'
     and liberado_completo_em is distinct from v_quando;
end;
$$;

comment on function plt_privado.fn_recalcular_liberacao(bigint) is
  'SESSAO-22 (D-48): recalcula liberado_completo_em do card de pedido — derivado dos eventos e dos itens (regra k/n; frete não conta — D-63). Chamada pela projeção; nunca por mão humana. ↪️ D-201: a peça ligada da produção conta de quando passou a ser do pedido.';

-- ----------------------------------------------------------------------------
-- 4 · As peças SEM DONO em produção que servem às vagas do pedido
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_sugestoes_em_producao(p_card_id bigint, p_cobertas jsonb)
returns table (
  item_seq           integer,
  indice_unidade     integer,
  total_unidades     integer,
  peca_card_id       bigint,
  setor_nome         text,
  etapa_nome         text,
  peca_origem        text,
  peca_origem_numero integer,
  pecas_iguais       integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with alvo as (
    select pc.id, pc.pedido_id
      from public.plt_cards pc
     where pc.id = p_card_id
       and pc.tipo = 'pedido'
       and pc.arquivado_em is null
       and pc.lancado_rotas_em is null
       and not plt_privado.fn_pedido_cancelado(pc.pedido_id)
  ),
  itens as (
    -- D-63: frete não é vaga (vw_itens_producao: unidades = 0).
    select v.seq, v.unidades as n, v.codigo, x.produto,
           plt_privado.fn_chave_peca(x.produto, v.codigo, v.descricao) as chave
      from plt_privado.vw_itens_producao v
      join alvo a on a.pedido_id = v.pedido_id
     cross join lateral (select plt_privado.fn_produto_do_item(v.codigo, v.descricao) as produto) x
     where v.unidades >= 1
  ),
  -- as vagas ainda sem unidade e que o estoque não cobre (a sugestão do estoque vem antes)
  vagas as (
    select i.seq, k.k, i.n, i.chave,
           row_number() over (partition by i.chave order by i.seq, k.k) as ordem
      from itens i
      cross join lateral generate_series(1, i.n) as k(k)
     where not exists (
             select 1 from public.plt_cards u, alvo a
              where u.pedido_id = a.pedido_id and u.tipo = 'unidade'
                and u.item_seq = i.seq and u.indice_unidade = k.k)
       and not exists (
             select 1 from jsonb_array_elements(coalesce(p_cobertas, '[]'::jsonb)) c
              where (c ->> 'item_seq')::int = i.seq and (c ->> 'indice_unidade')::int = k.k)
  ),
  candidatas as (
    -- da REPOSIÇÃO: sem dono, pelo produto (o índice das peças sem dono por produto)
    select c.id, c.setor_atual_id, c.etapa_atual_id, c.desde, c.concluido_em, c.qualidade_atual,
           'reposicao'::text as origem, null::integer as origem_numero,
           plt_privado.fn_chave_peca(c.produto_tiny_id, c.item_codigo, c.item_descricao) as chave
      from public.plt_cards c
      join public.plt_cards rp on rp.id = c.card_pai_id and rp.tipo = 'reposicao'
     where c.tipo = 'unidade' and c.arquivado_em is null and c.pedido_id is null
       and c.produto_tiny_id in (select i.produto from itens i where i.produto is not null)
    union all
    -- de pedido CANCELADO que segue em produção: pelo SKU (o índice das peças de pedido por SKU)
    select c.id, c.setor_atual_id, c.etapa_atual_id, c.desde, c.concluido_em, c.qualidade_atual,
           'cancelamento', x.numero,
           plt_privado.fn_chave_peca(coalesce(c.produto_tiny_id,
                                              plt_privado.fn_produto_do_item(c.item_codigo, c.item_descricao)),
                                     c.item_codigo, c.item_descricao)
      from public.plt_cards c
      -- o pedido de CADA peça do mesmo SKU (o caminho é o índice do SKU; nunca o de
      -- todos os cancelados — no ensaio ×100 o planejador ia pelos 11 mil cancelados);
      -- a régua do cancelado é a de sempre (fn_pedido_cancelado), com a comparação
      -- barata antes (chamar a função peça a peça custava ~20 ms no ×100)
      cross join lateral (
        select p.numero from public.pedidos p
         where p.id = c.pedido_id
           and lower(p.situacao) like 'cancel%'
           and plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
        offset 0) x
     where c.tipo = 'unidade' and c.arquivado_em is null and c.pedido_id is not null
       and c.item_codigo in (select i.codigo from itens i where i.codigo is not null)
       and c.pedido_id <> (select a.pedido_id from alvo a)
  ),
  em_producao as (
    select c.id, c.chave, c.origem, c.origem_numero, s.nome as setor_nome, et.nome as etapa_nome,
           -- a mais adiantada primeiro: setor mais à frente, etapa mais à frente, há mais tempo ali
           row_number() over (partition by c.chave
                              order by s.ordem desc, et.ordem desc nulls last, c.desde nulls last, c.id) as ordem,
           count(*) over (partition by c.chave) as iguais
      from candidatas c
      join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'producao'
      left join public.plt_etapas et on et.id = c.etapa_atual_id
     where c.concluido_em is null
       and coalesce(c.qualidade_atual, 'perfeito') <> 'danificado'
       and not coalesce(et.eh_danificado, false)
       and c.chave in (select v.chave from vagas v)
  )
  select v.seq, v.k, v.n, e.id, e.setor_nome, e.etapa_nome, e.origem, e.origem_numero, e.iguais::int
    from vagas v
    join em_producao e on e.chave = v.chave and e.ordem = v.ordem
   order by v.seq, v.k;
$$;

comment on function plt_privado.fn_sugestoes_em_producao(bigint, jsonb) is
  'D-201 (28/10): para as vagas do pedido que o estoque não cobre (p_cobertas = as sugestões do estoque), a peça igual SEM DONO em produção (reposição, ou pedido cancelado que segue em produção) — a mais adiantada primeiro; danificada não entra. Lida pela janela de liberação.';

-- A ligação em si: o fato peca_vinculada, com tudo o que a projeção precisa.
create or replace function plt_privado.fn_vincular_peca_producao(
  p_card     public.plt_cards,
  p_item_seq integer,
  p_indice   integer,
  p_peca_id  bigint,
  p_usuario  uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_codigo    text;
  v_descricao text;
  v_n         integer;
  v_peca      public.plt_cards%rowtype;
  v_pai       public.plt_cards%rowtype;
  v_papel     text;
  v_setor     text;
  v_danif     boolean;
  v_origem    text;
  v_numero    integer;
  v_num_antes integer;
  v_vaga_rep  integer;
begin
  if plt_privado.fn_pedido_cancelado(p_card.pedido_id) then
    raise exception 'O pedido foi cancelado no Tiny — não recebe peça.' using errcode = 'check_violation';
  end if;
  select v.codigo, v.descricao, v.unidades into v_codigo, v_descricao, v_n
    from plt_privado.vw_itens_producao v
   where v.pedido_id = p_card.pedido_id and v.seq = p_item_seq and v.unidades >= 1;
  if v_n is null or p_indice is null or p_indice < 1 or p_indice > v_n then
    raise exception 'Esta unidade não existe no pedido.' using errcode = 'check_violation';
  end if;

  select * into v_peca from public.plt_cards where id = p_peca_id for update;
  select s.papel_no_fluxo, s.nome into v_papel, v_setor
    from public.plt_setores s where s.id = v_peca.setor_atual_id;
  if v_peca.id is null or v_peca.tipo <> 'unidade' or v_peca.arquivado_em is not null
     or v_peca.concluido_em is not null or coalesce(v_papel, '') <> 'producao' then
    raise exception 'Esta peça não está mais em produção (pode ter andado ou sido usada por outro pedido).'
      using errcode = 'check_violation';
  end if;
  select coalesce(et.eh_danificado, false) into v_danif from public.plt_etapas et where et.id = v_peca.etapa_atual_id;
  if coalesce(v_peca.qualidade_atual, 'perfeito') = 'danificado' or coalesce(v_danif, false) then
    raise exception 'Peça danificada não vai para um pedido.' using errcode = 'check_violation';
  end if;

  select * into v_pai from public.plt_cards where id = v_peca.card_pai_id;
  if v_peca.pedido_id is null then
    if v_pai.tipo is distinct from 'reposicao' then
      raise exception 'Esta peça não é de reposição de estoque nem de pedido cancelado.' using errcode = 'check_violation';
    end if;
    v_origem := 'reposicao';
  else
    if v_peca.pedido_id = p_card.pedido_id or not plt_privado.fn_pedido_cancelado(v_peca.pedido_id) then
      raise exception 'Esta peça já é de outro pedido.' using errcode = 'check_violation';
    end if;
    v_origem := 'cancelamento';
    select p.numero into v_num_antes from public.pedidos p where p.id = v_peca.pedido_id;
  end if;

  if plt_privado.fn_chave_peca(coalesce(v_peca.produto_tiny_id,
                                        plt_privado.fn_produto_do_item(v_peca.item_codigo, v_peca.item_descricao)),
                               v_peca.item_codigo, v_peca.item_descricao)
     <> plt_privado.fn_chave_peca(plt_privado.fn_produto_do_item(v_codigo, v_descricao), v_codigo, v_descricao) then
    raise exception 'A peça em produção não é igual ao item do pedido (produto, cor e medidas).'
      using errcode = 'check_violation';
  end if;

  -- A vaga que a peça ocupava na REPOSIÇÃO (para a reposição não oferecer de
  -- novo — "só perde a peça"): a dela, ou a guardada no 1º fato, se já mudou de dono.
  if v_pai.tipo = 'reposicao' then
    select (e.dados ->> 'vaga_reposicao')::int into v_vaga_rep
      from public.plt_eventos e
     where e.card_id = v_peca.id and e.tipo = 'peca_vinculada' and e.dados ? 'vaga_reposicao'
     order by e.id
     limit 1;
    v_vaga_rep := coalesce(v_vaga_rep, v_peca.indice_unidade);
  end if;

  select p.numero into v_numero from public.pedidos p where p.id = p_card.pedido_id;

  insert into public.plt_eventos
      (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, observacao, dados)
    values
      (v_peca.id, 'peca_vinculada', p_usuario, 'interface', v_peca.setor_atual_id, v_peca.etapa_atual_id,
       'Passou a ser do pedido ' || coalesce(v_numero::text, '') || format(' (%s/%s)', p_indice, v_n)
         || ' em ' || coalesce(v_setor, 'produção') || ' — '
         || case when v_origem = 'reposicao' then 'era da reposição de estoque.'
                 else 'era do pedido ' || coalesce(v_num_antes::text, '') || ', cancelado.' end,
       jsonb_strip_nulls(jsonb_build_object(
         'pedido_id',          p_card.pedido_id,
         'numero',             v_numero,
         'card_pedido_id',     p_card.id,
         -- a reposição segue como pai (a vaga dela continua liberada); o cancelado dá lugar ao pedido novo
         'card_pai_id',        case when v_pai.tipo = 'reposicao' then v_pai.id else p_card.id end,
         'item_seq',           p_item_seq,
         'indice_unidade',     p_indice,
         'total_unidades',     v_n,
         'item_codigo',        v_codigo,
         'item_descricao',     v_descricao,
         'origem',             v_origem,
         'pedido_anterior_id', v_peca.pedido_id,
         'numero_anterior',    v_num_antes,
         'reposicao_card_id',  case when v_pai.tipo = 'reposicao' then v_pai.id end,
         'vaga_reposicao',     v_vaga_rep)));
end;
$$;

comment on function plt_privado.fn_vincular_peca_producao(public.plt_cards, integer, integer, bigint, uuid) is
  'D-201 (28/10): confere e registra o fato peca_vinculada — a peça sem dono em produção (reposição ou pedido cancelado), igual ao item, em perfeito estado ou em atenção, passa a ser da vaga do pedido. Chamada só pela liberação do PCP (plt_fn_pcp_liberar), que já trava o card do pedido.';

-- ----------------------------------------------------------------------------
-- 5 · A janela de liberação numa requisição (recriada POR INTEIRO a partir da
--     20261008140000): + em_producao; a vaga da reposição que foi para um pedido
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_pcp_liberacao(p_card_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.plt_cards%rowtype;
  v_itens jsonb;
  v_ja    jsonb;
  v_sug   jsonb := '[]'::jsonb;
  v_prod  jsonb := '[]'::jsonb;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Liberar é gesto do PCP/logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards c
   where c.id = p_card_id and c.tipo in ('pedido', 'reposicao');
  if not found then
    raise exception 'Este card não existe.' using errcode = 'no_data_found';
  end if;

  if v_card.tipo = 'reposicao' then
    v_itens := jsonb_build_array(jsonb_build_object(
      'seq', 1, 'codigo', v_card.item_codigo, 'descricao', v_card.item_descricao,
      'unidades', coalesce(v_card.total_unidades, 0)));
    -- D-201: a peça desta reposição que passou a ser de um pedido segue
    -- ocupando a vaga dela (a reposição só perde a peça).
    select coalesce(jsonb_agg(jsonb_build_object('item_seq', 1, 'indice_unidade', x.k) order by x.k), '[]'::jsonb)
      into v_ja
      from (
        select u.indice_unidade as k
          from public.plt_cards u
         where u.card_pai_id = v_card.id and u.tipo = 'unidade' and u.pedido_id is null
        union
        select (e.dados ->> 'vaga_reposicao')::int
          from public.plt_cards u
          join public.plt_eventos e on e.card_id = u.id and e.tipo = 'peca_vinculada'
         where u.card_pai_id = v_card.id and u.tipo = 'unidade' and u.pedido_id is not null
           and e.dados ->> 'reposicao_card_id' = v_card.id::text
      ) x
     where x.k is not null;
  else
    -- D-63: frete não vira unidade (vw_itens_producao).
    select coalesce(jsonb_agg(jsonb_build_object('seq', v.seq, 'codigo', v.codigo,
                                                 'descricao', v.descricao, 'unidades', v.unidades)
                              order by v.seq), '[]'::jsonb)
      into v_itens
      from plt_privado.vw_itens_producao v
     where v.pedido_id = v_card.pedido_id and v.unidades >= 1;
    select coalesce(jsonb_agg(jsonb_build_object('item_seq', u.item_seq, 'indice_unidade', u.indice_unidade)
                              order by u.item_seq, u.indice_unidade), '[]'::jsonb)
      into v_ja
      from public.plt_cards u
     where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade';
    select coalesce(jsonb_agg(to_jsonb(s) order by s.item_seq, s.indice_unidade), '[]'::jsonb)
      into v_sug
      from public.plt_fn_sugestoes_alocacao(v_card.id) s;
    -- D-201: a peça igual sem dono que ainda está em produção, para o que o estoque não cobre.
    select coalesce(jsonb_agg(to_jsonb(s) order by s.item_seq, s.indice_unidade), '[]'::jsonb)
      into v_prod
      from plt_privado.fn_sugestoes_em_producao(v_card.id, v_sug) s;
  end if;

  return jsonb_build_object('itens', v_itens, 'ja_liberadas', v_ja, 'sugestoes', v_sug, 'em_producao', v_prod);
end;
$$;

comment on function public.plt_fn_pcp_liberacao(bigint) is
  'SESSAO-30 (Lei de Desempenho — 1 requisição por janela): o que a janela de liberação do PCP mostra — os itens em unidades (sem frete — D-63), as unidades já liberadas e as sugestões do estoque (D-62/D-78). Pedido ou reposição. Gate da logística. ↪️ D-201 (28/10): + em_producao (a peça sem dono que ainda está em produção) e, na reposição, a vaga da peça que foi para um pedido continua ocupada.';

-- ----------------------------------------------------------------------------
-- 6 · A liberação numa transação (recriada POR INTEIRO a partir da
--     20261008140000): + {item_seq, indice_unidade, peca_producao_id}
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_pcp_liberar(p_card_id bigint, p_unidades jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario   uuid;
  v_card      public.plt_cards%rowtype;
  v_pcp       bigint;
  v_u         jsonb;
  v_seq       integer;
  v_k         integer;
  v_peca      bigint;
  v_setor     bigint;
  v_etapa     bigint;
  v_codigo    text;
  v_desc      text;
  v_n         integer;
  v_novo      bigint;
  v_alocadas  integer := 0;
  v_liberadas integer := 0;
  v_vinculadas integer := 0;
  v_puladas   integer := 0;
  v_cards     bigint[] := '{}';
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Liberar é gesto do PCP/logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_unidades) is distinct from 'array' or jsonb_array_length(p_unidades) = 0 then
    raise exception 'Selecione pelo menos uma unidade para liberar.' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_unidades) > 500 then
    raise exception 'No máximo 500 unidades por vez.' using errcode = 'check_violation';
  end if;

  -- A trava do card do pedido/reposição: duas pessoas liberando o mesmo
  -- pedido ao mesmo tempo esperam uma pela outra (a segunda pula o que a
  -- primeira já liberou).
  select * into v_card from public.plt_cards c
   where c.id = p_card_id and c.tipo in ('pedido', 'reposicao') and c.arquivado_em is null
   for update;
  if not found then
    raise exception 'Este card não está mais no PCP (pode ter sido arquivado).' using errcode = 'no_data_found';
  end if;
  if v_card.tipo = 'pedido' and v_card.lancado_rotas_em is not null then
    raise exception 'Este pedido já foi lançado para ROTAS.' using errcode = 'check_violation';
  end if;
  select s.id into v_pcp from public.plt_setores s where s.codigo = 'pcp';

  -- 1º as peças do estoque (a sugestão aceita): a unidade nasce pronta no aguardo.
  for v_u in select x from jsonb_array_elements(p_unidades) x where x ? 'peca_card_id' loop
    v_seq  := (v_u ->> 'item_seq')::int;
    v_k    := (v_u ->> 'indice_unidade')::int;
    v_peca := (v_u ->> 'peca_card_id')::bigint;
    if v_card.tipo <> 'pedido' then
      raise exception 'A reposição não usa peça do estoque.' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.plt_cards u
                where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade'
                  and u.item_seq = v_seq and u.indice_unidade = v_k) then
      v_puladas := v_puladas + 1;
      continue;
    end if;
    v_novo := public.plt_fn_alocar_peca(v_card.id, v_seq, v_k, v_peca);
    v_cards := v_cards || v_novo;
    v_alocadas := v_alocadas + 1;
  end loop;

  -- D-201: 2º as peças SEM DONO que ainda estão em produção — passam a ser
  -- deste pedido onde estão (setor, etapa, quem trabalha e o tempo seguem).
  for v_u in select x from jsonb_array_elements(p_unidades) x where x ? 'peca_producao_id' loop
    v_seq  := (v_u ->> 'item_seq')::int;
    v_k    := (v_u ->> 'indice_unidade')::int;
    v_peca := (v_u ->> 'peca_producao_id')::bigint;
    if v_card.tipo <> 'pedido' then
      raise exception 'A reposição não usa peça que já está em produção.' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.plt_cards u
                where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade'
                  and u.item_seq = v_seq and u.indice_unidade = v_k) then
      v_puladas := v_puladas + 1;
      continue;
    end if;
    perform plt_privado.fn_vincular_peca_producao(v_card, v_seq, v_k, v_peca, v_usuario);
    v_cards := v_cards || v_peca;
    v_vinculadas := v_vinculadas + 1;
  end loop;

  -- 3º as que vão para a produção (raio-x 3: só setor de produção).
  for v_u in select x from jsonb_array_elements(p_unidades) x
              where not (x ? 'peca_card_id') and not (x ? 'peca_producao_id') loop
    v_seq   := (v_u ->> 'item_seq')::int;
    v_k     := (v_u ->> 'indice_unidade')::int;
    v_setor := nullif(v_u ->> 'setor_id', '')::bigint;
    v_etapa := nullif(nullif(v_u ->> 'etapa_id', ''), '0')::bigint;
    if v_setor is null
       or not exists (select 1 from public.plt_setores s
                       where s.id = v_setor and s.ativo and s.papel_no_fluxo = 'producao') then
      raise exception 'O PCP libera a peça para um setor de produção. Peça pronta do estoque vai pela sugestão "usar?" — ela nasce pronta em Pedidos em aguardo.'
        using errcode = 'check_violation';
    end if;
    if v_etapa is not null
       and not exists (select 1 from public.plt_etapas e where e.id = v_etapa and e.setor_id = v_setor and e.ativa) then
      raise exception 'A etapa escolhida não é deste setor (ou foi desativada).' using errcode = 'check_violation';
    end if;

    if v_card.tipo = 'reposicao' then
      v_codigo := v_card.item_codigo;
      v_desc   := v_card.item_descricao;
      v_n      := v_card.total_unidades;
      if v_seq is distinct from 1 or v_k is null or v_k < 1 or v_k > coalesce(v_n, 0) then
        raise exception 'Esta unidade não existe na reposição.' using errcode = 'check_violation';
      end if;
      -- D-201: a vaga da peça que foi para um pedido continua ocupada.
      if exists (select 1 from public.plt_cards u
                  where u.card_pai_id = v_card.id and u.tipo = 'unidade'
                    and u.pedido_id is null and u.indice_unidade = v_k)
         or exists (select 1 from public.plt_cards u
                      join public.plt_eventos e on e.card_id = u.id and e.tipo = 'peca_vinculada'
                     where u.card_pai_id = v_card.id and u.tipo = 'unidade' and u.pedido_id is not null
                       and e.dados ->> 'reposicao_card_id' = v_card.id::text
                       and (e.dados ->> 'vaga_reposicao')::int = v_k) then
        v_puladas := v_puladas + 1;
        continue;
      end if;
    else
      v_n := null;
      select v.codigo, v.descricao, v.unidades into v_codigo, v_desc, v_n
        from plt_privado.vw_itens_producao v
       where v.pedido_id = v_card.pedido_id and v.seq = v_seq and v.unidades >= 1;
      if v_n is null or v_k is null or v_k < 1 or v_k > v_n then
        raise exception 'Esta unidade não existe no pedido.' using errcode = 'check_violation';
      end if;
      if exists (select 1 from public.plt_cards u
                  where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade'
                    and u.item_seq = v_seq and u.indice_unidade = v_k) then
        v_puladas := v_puladas + 1;
        continue;
      end if;
    end if;

    insert into public.plt_cards
        (tipo, pedido_id, produto_tiny_id, card_pai_id, item_seq, item_codigo, item_descricao,
         indice_unidade, total_unidades, setor_atual_id)
      values
        ('unidade', case when v_card.tipo = 'pedido' then v_card.pedido_id end,
         case when v_card.tipo = 'reposicao' then v_card.produto_tiny_id end,
         v_card.id, v_seq, v_codigo, v_desc, v_k, v_n, v_pcp)
      returning id into v_novo;
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id)
      values (v_novo, 'card_criado', v_usuario, 'interface', v_pcp);
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, setor_destino_id, etapa_destino_id)
      values (v_novo, 'movimentacao_setor', v_usuario, 'interface', v_pcp, v_setor, v_etapa);
    v_cards := v_cards || v_novo;
    v_liberadas := v_liberadas + 1;
  end loop;

  -- D-201: a peça ligada não passa pelo PCP — o quadro do PCP fica sabendo pelo pedido.
  if v_vinculadas > 0 then
    perform plt_privado.fn_avisar('pcp');
  end if;

  return jsonb_build_object('alocadas', v_alocadas, 'liberadas', v_liberadas, 'vinculadas', v_vinculadas,
                            'ja_liberadas', v_puladas, 'cards', to_jsonb(v_cards));
end;
$$;

comment on function public.plt_fn_pcp_liberar(bigint, jsonb) is
  'SESSAO-30 (raio-x 3 + Lei de Desempenho): a liberação inteira do PCP numa transação — usar a peça do estoque (plt_fn_alocar_peca: nasce pronta no aguardo) e mandar as outras para um SETOR DE PRODUÇÃO (card_criado no PCP + movimentacao_setor, autor = quem liberou). Tudo ou nada; a unidade já liberada é pulada (idempotente). Pedido ou reposição. Gate da logística. ↪️ D-201 (28/10): + usar a peça sem dono que já está em produção (peca_producao_id → fato peca_vinculada).';

revoke all on function plt_privado.fn_projetar_peca_vinculada() from public, anon, authenticated;
revoke all on function plt_privado.fn_recalcular_liberacao(bigint) from public, anon, authenticated;
revoke all on function plt_privado.fn_sugestoes_em_producao(bigint, jsonb) from public, anon, authenticated;
revoke all on function plt_privado.fn_vincular_peca_producao(public.plt_cards, integer, integer, bigint, uuid) from public, anon, authenticated;
revoke all on function public.plt_fn_pcp_liberacao(bigint) from public, anon;
grant execute on function public.plt_fn_pcp_liberacao(bigint) to authenticated;
revoke all on function public.plt_fn_pcp_liberar(bigint, jsonb) from public, anon;
grant execute on function public.plt_fn_pcp_liberar(bigint, jsonb) to authenticated;
