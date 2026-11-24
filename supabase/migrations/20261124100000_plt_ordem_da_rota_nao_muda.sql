-- ============================================================================
-- SESSAO-56 · bloco B — A ORDEM DA ROTA NÃO SE MEXE SOZINHA
-- (pedido do dono, 23/11/2026 21:12: "quando uma rota estiver sendo montada e
-- um dos pontos acabar sendo removido, a rota não deve renovar a ordem dos
-- pinos, apenas manter a que já foi definida, tirando apenas o pino removido")
--
-- O que acontecia: a rota sem ordem salva (ninguém arrastou) era mostrada pela
-- SUGESTÃO do mais perto, recalculada a cada mudança da lista — tirar um
-- pedido, reprogramar ou um ponto que chegava depois trocava os números de
-- todo mundo, na logística e no celular do entregador.
--
-- O que muda no banco (as telas mudam junto — ver o handoff da sessão):
--   1 · plt_privado.fn_rota_ordem_que_fica (NOVA, fora da API): grava a ordem
--       que a tela mostrava, menos o item que saiu. Confere que tudo o que a
--       tela mandou AINDA está na rota (senão "a rota mudou noutra tela");
--       o que a rota tem e a tela não mostrou (a página que ainda não veio)
--       fica depois, na ordem dele. Sem lista (o site de antes) → nada muda.
--   2 · plt_fn_desprogramar_entrega  (+ p_ordem_fica)   — tirar um pedido;
--   3 · plt_fn_parada_avulsa_remover (+ p_ordem_fica)   — tirar uma parada;
--   4 · plt_fn_programar_entrega     (+ p_ordem_origem) — reprogramar para
--       outro dia/caminhão/rota: a rota de ORIGEM fica com a ordem que a tela
--       mostrava. Na rota de DESTINO nada muda: o pedido entra sem ordem (a
--       tela o mostra no fim) — como a demanda manda ("está certo para a rota
--       nova"); quem programa pela aba Programar manda a ordem da tela junto
--       (plt_fn_programar_rota), e a rota nasce com a ordem salva.
--
-- Um gesto = uma chamada (Lei de desempenho): a ordem que fica vai JUNTO no
-- gesto de tirar. As três portas ganham um parâmetro OPCIONAL no fim — a
-- assinatura antiga sai (drop) e a nova responde igual a quem não manda a
-- ordem (o site de antes continua funcionando até o site novo subir).
--
-- Recriadas POR INTEIRO a partir da última versão nas migrations:
--   plt_fn_desprogramar_entrega  ← 20261008150000_plt_entregue_nos_dois_lados
--   plt_fn_parada_avulsa_remover ← 20261027050000_plt_paradas_avulsas
--   plt_fn_programar_entrega     ← 20261022020000_plt_rotas_qualquer_pedido
-- (plt_fn_ordenar_rota, plt_fn_rota_ordenar, fn_rota_aplicar_ordem e
-- plt_fn_programar_rota NÃO mudam: a tela é que passa a mandar sempre a ordem.)
--
-- Nenhuma tabela, coluna ou índice novo: a ordem continua em
-- plt_programacoes.ordem e plt_paradas_avulsas.ordem; as leituras usam os
-- índices que já existem — plt_programacoes_rota_idx (data_entrega,
-- caminhao_id, rota) e plt_paradas_avulsas_rota_idx.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A ordem que fica na rota depois que um item sai
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_rota_ordem_que_fica(
  p_data date, p_caminhao_id bigint, p_rota integer, p_itens jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fora     text;
  v_completa jsonb;
begin
  -- o site de antes não manda a ordem: nada muda (como era)
  if p_itens is null or p_data is null or p_caminhao_id is null or p_rota is null then
    return;
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) > 400 then
    raise exception 'A ordem da rota veio num formato que o banco não entende.' using errcode = 'check_violation';
  end if;

  -- o que a rota tem AGORA (o item que saiu já não está): pedido ainda não
  -- entregue e não arquivado + parada não removida — a mesma régua do "Salvar ordem"
  with rota as (
    select 'p' || pr.card_id as k, 'p' as t, pr.card_id as id, pr.ordem as o
      from public.plt_programacoes pr
      join public.plt_cards pc on pc.id = pr.card_id
     where pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id and pr.rota = p_rota
       and pc.entrega_evento_id is null and pc.arquivado_em is null
    union all
    select 'a' || pa.id, 'a', pa.id, pa.ordem
      from public.plt_paradas_avulsas pa
     where pa.data_entrega = p_data and pa.caminhao_id = p_caminhao_id and pa.rota = p_rota
       and pa.removida_em is null
  ),
  tela as (
    select (e ->> 't') || (e ->> 'id') as k, e, i
      from jsonb_array_elements(p_itens) with ordinality as x(e, i)
  )
  select (select t.k from tela t where not exists (select 1 from rota r where r.k = t.k) limit 1),
         coalesce((select jsonb_agg(t.e order by t.i) from tela t), '[]'::jsonb)
         || coalesce((select jsonb_agg(jsonb_build_object('t', r.t, 'id', r.id) order by r.o nulls last, r.k)
                        from rota r where not exists (select 1 from tela t where t.k = r.k)), '[]'::jsonb)
    into v_fora, v_completa;

  if v_fora is not null then
    raise exception 'A rota mudou noutra tela — atualize e tente de novo.' using errcode = 'check_violation';
  end if;
  -- grava (só a linha que muda é tocada; o entregador não mexe na ordem dos
  -- pedidos — a mesma conferência do "Salvar ordem"; avisa a área rotas)
  perform plt_privado.fn_rota_aplicar_ordem(p_data, p_caminhao_id, p_rota, v_completa);
end;
$$;

comment on function plt_privado.fn_rota_ordem_que_fica(date, bigint, integer, jsonb) is
  'SESSAO-56 (bloco B): depois que um item sai da rota (tirar, reprogramar, remover parada), grava a ordem que a tela mostrava para os que ficam — a rota sem ordem salva deixa de se rearrumar pela sugestão. O que a tela mandou e não está mais na rota → "a rota mudou noutra tela"; o que a rota tem e a tela não mandou fica depois, na ordem dele. p_itens nulo = nada muda.';

revoke all on function plt_privado.fn_rota_ordem_que_fica(date, bigint, integer, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2 · Tirar um pedido da rota: só ele sai; os outros ficam na ordem da tela
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_desprogramar_entrega(bigint);
create or replace function public.plt_fn_desprogramar_entrega(
  p_card_id    bigint,
  p_ordem_fica jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_antes   public.plt_programacoes%rowtype;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma mexe na programação.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Mexer na programação é gesto da logística (PCP/terminais) ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if plt_privado.fn_entregue(p_card_id) then
    raise exception 'Este pedido já foi entregue — a programação não muda mais.' using errcode = 'check_violation';
  end if;
  delete from public.plt_programacoes where card_id = p_card_id returning * into v_antes;
  -- SESSAO-56 (bloco B): a rota de onde ele saiu fica com a ordem que a tela mostrava
  if v_antes.card_id is not null then
    perform plt_privado.fn_rota_ordem_que_fica(v_antes.data_entrega, v_antes.caminhao_id, v_antes.rota::int, p_ordem_fica);
  end if;
end;
$$;

comment on function public.plt_fn_desprogramar_entrega(bigint, jsonb) is
  'D-45: tira o pedido da programação (volta para "sem programação"); recusa depois de entregue. SESSAO-56 (bloco B): p_ordem_fica = a ordem que a tela mostrava para os que FICAM na rota ([{"t":"p","id":card} | {"t":"a","id":parada}]) — gravada no mesmo gesto, para a rota não se rearrumar; nula = nada muda na ordem.';

revoke all on function public.plt_fn_desprogramar_entrega(bigint, jsonb) from public, anon;
grant execute on function public.plt_fn_desprogramar_entrega(bigint, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 3 · Tirar uma parada avulsa: só ela sai; os outros ficam na ordem da tela
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_parada_avulsa_remover(bigint);
create or replace function public.plt_fn_parada_avulsa_remover(
  p_id         bigint,
  p_ordem_fica jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
  v_p  public.plt_paradas_avulsas%rowtype;
begin
  select * into v_p from public.plt_paradas_avulsas where id = p_id and removida_em is null for update;
  if v_p.id is null then
    return; -- o toque repetido
  end if;
  if v_eu is null or not (plt_privado.fn_pode_ver_expedicao() or (v_p.criada_por = v_eu and v_p.situacao = 'pendente')) then
    raise exception 'Só a logística (ou quem pôs a parada, antes de fazê-la) a tira da rota.' using errcode = 'insufficient_privilege';
  end if;
  update public.plt_paradas_avulsas set removida_por = v_eu, removida_em = now() where id = p_id;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_eu, 'parada_avulsa_removida', jsonb_build_object('parada_id', p_id));
  -- SESSAO-56 (bloco B): os que ficam mantêm a ordem que a tela mostrava
  perform plt_privado.fn_rota_ordem_que_fica(v_p.data_entrega, v_p.caminhao_id, v_p.rota::int, p_ordem_fica);
  perform plt_privado.fn_avisar('rotas');
end;
$$;

comment on function public.plt_fn_parada_avulsa_remover(bigint, jsonb) is
  'SESSAO-41 (D-196): tira a parada avulsa da rota (nada se apaga — fica removida, com quem e quando); a logística, ou quem a pôs enquanto pendente. SESSAO-56 (bloco B): p_ordem_fica = a ordem que a tela mostrava para os que ficam, gravada no mesmo gesto; nula = nada muda na ordem.';

revoke all on function public.plt_fn_parada_avulsa_remover(bigint, jsonb) from public, anon;
grant execute on function public.plt_fn_parada_avulsa_remover(bigint, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 4 · Programar / reprogramar: a rota de ORIGEM não se mexe (a de destino
--     segue como era: o pedido entra sem ordem, no fim)
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_programar_entrega(bigint, date, bigint, integer);
create or replace function public.plt_fn_programar_entrega(
  p_card_id      bigint,
  p_data         date,
  p_caminhao_id  bigint,
  p_rota         integer default null,
  p_ordem_origem jsonb   default null
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
  v_muda    boolean;
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

  -- SESSAO-56 (bloco B): o pedido está SAINDO de uma rota (outro dia, caminhão ou rota)?
  v_muda := v_atual.card_id is not null
            and (v_atual.data_entrega is distinct from p_data
                 or v_atual.caminhao_id is distinct from p_caminhao_id
                 or v_atual.rota        is distinct from v_rota);

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
  -- SESSAO-56 (bloco B): o pedido SAIU de uma rota → os que ficaram nela
  -- mantêm a ordem que a tela mostrava (sem a lista — o site de antes — nada muda)
  if v_muda then
    perform plt_privado.fn_rota_ordem_que_fica(v_atual.data_entrega, v_atual.caminhao_id, v_atual.rota::int, p_ordem_origem);
  end if;
  return v_id;
end;
$$;

comment on function public.plt_fn_programar_entrega(bigint, date, bigint, integer, jsonb) is
  'D-45: programa ou reprograma a entrega (dia + caminhão + rota — D-128); recusa depois de entregue; candidato = pedido vivo (D-156). SESSAO-56 (bloco B): p_ordem_origem = a ordem que a tela mostrava para os que FICAM na rota de onde ele saiu (gravada no mesmo gesto; nula = nada muda lá).';

revoke all on function public.plt_fn_programar_entrega(bigint, date, bigint, integer, jsonb) from public, anon;
grant execute on function public.plt_fn_programar_entrega(bigint, date, bigint, integer, jsonb) to authenticated;
