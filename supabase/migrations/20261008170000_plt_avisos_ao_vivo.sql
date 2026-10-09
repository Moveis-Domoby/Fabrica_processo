-- ============================================================================
-- SESSAO-30 · etapa 6 — as telas tocadas ficam AO VIVO por websocket (Lei §4)
--
-- No lugar dos relógios de 20–30 s do Estoque, PCP, Pedidos em aguardo, ROTAS
-- e Programação: o BANCO empurra um aviso curto ("mudou") num canal PRIVADO
-- de tópico estreito, só para quem pode ver aquela área, e a tela relê só o
-- pedaço dela. Um aviso por área por transação (uma liberação de 10 peças =
-- um aviso). Sem Realtime (o teste local), não faz nada.
--
--   plt-aviso:estoque   — os números do estoque mudaram (a projeção)
--   plt-aviso:aguardo   — peça chegou/saiu de Pedidos em aguardo
--   plt-aviso:pcp       — o quadro do PCP (pedido, reposição, liberação)
--   plt-aviso:rotas     — ROTAS, programação, equipe, entregas do dia
-- ============================================================================

set local lock_timeout = '5s';

-- Quem ouve cada área: a logística; a ROTAS também o entregador.
create or replace function plt_privado.fn_aviso_pode_ouvir(p_topico text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
           when p_topico in ('plt-aviso:estoque', 'plt-aviso:aguardo', 'plt-aviso:pcp')
             then plt_privado.fn_pode_ver_expedicao()
           when p_topico = 'plt-aviso:rotas'
             then plt_privado.fn_pode_ver_expedicao()
               or plt_privado.fn_eh_entregador(plt_privado.fn_usuario_atual())
           else false
         end;
$$;

comment on function plt_privado.fn_aviso_pode_ouvir(text) is
  'SESSAO-30 (Lei §4): quem ouve os avisos ao vivo de cada área — a logística; a ROTAS também o entregador (D-115). O aviso não leva dado nenhum, só "mudou".';

do $$
begin
  if to_regclass('realtime.messages') is not null
     and to_regprocedure('realtime.topic()') is not null then
    execute 'drop policy if exists plt_avisos_ouvir on realtime.messages';
    execute $sql$
      create policy plt_avisos_ouvir on realtime.messages
        for select to authenticated
        using (realtime.messages.extension = 'broadcast'
               and realtime.topic() like 'plt-aviso:%'
               and (select plt_privado.fn_aviso_pode_ouvir(realtime.topic())))
    $sql$;
  end if;
end;
$$;

-- Empurra UM aviso por área por transação.
create or replace function plt_privado.fn_avisar(p_area text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('plt.avisado_' || p_area, true), '') = 'on' then
    return;
  end if;
  perform set_config('plt.avisado_' || p_area, 'on', true);
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
    perform realtime.send(jsonb_build_object('area', p_area), 'mudou', 'plt-aviso:' || p_area, true);
  end if;
end;
$$;

-- Os fatos dizem quais áreas mudaram (depois das projeções — gatilho de
-- instrução roda depois dos de linha).
create or replace function plt_privado.fn_avisar_eventos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_areas text[];
  v_area  text;
begin
  select array_agg(distinct a) into v_areas
    from (
      select case s.codigo
               when 'aguardo' then 'aguardo'
               when 'rotas'   then 'rotas'
               when 'pcp'     then 'pcp'
             end as a
        from novos n
        left join public.plt_cards c on c.id = n.card_id
        join public.plt_setores s on s.id in (n.setor_origem_id, n.setor_destino_id, c.setor_atual_id)
      union all
      select 'pcp' from novos n join public.plt_cards c on c.id = n.card_id where c.tipo in ('pedido', 'reposicao')
      union all
      select 'aguardo' from novos n where n.tipo in ('pedido_lancado_rotas', 'peca_alocada', 'unidade_desvinculada')
      union all
      select 'rotas' from novos n
       where n.tipo in ('pedido_lancado_rotas', 'pedido_entregue', 'entrega_desfeita', 'entrega_nao_realizada',
                        'pedido_devolvido', 'comentario_adicionado', 'anexo_adicionado', 'pedido_cancelado')
    ) x
   where a is not null;
  if v_areas is not null then
    foreach v_area in array v_areas loop
      perform plt_privado.fn_avisar(v_area);
    end loop;
  end if;
  return null;
end;
$$;

drop trigger if exists plt_eventos_zzzz_avisar on public.plt_eventos;
create trigger plt_eventos_zzzz_avisar
  after insert on public.plt_eventos
  referencing new table as novos
  for each statement execute function plt_privado.fn_avisar_eventos();

create or replace function plt_privado.fn_avisar_estoque()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform plt_privado.fn_avisar('estoque');
  return null;
end;
$$;

drop trigger if exists plt_estoque_numeros_avisar on public.plt_estoque_numeros;
create trigger plt_estoque_numeros_avisar
  after insert or update or delete on public.plt_estoque_numeros
  for each statement execute function plt_privado.fn_avisar_estoque();

create or replace function plt_privado.fn_avisar_rotas()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform plt_privado.fn_avisar('rotas');
  return null;
end;
$$;

drop trigger if exists plt_programacoes_avisar on public.plt_programacoes;
create trigger plt_programacoes_avisar
  after insert or update or delete on public.plt_programacoes
  for each statement execute function plt_privado.fn_avisar_rotas();

drop trigger if exists plt_programacao_equipes_avisar on public.plt_programacao_equipes;
create trigger plt_programacao_equipes_avisar
  after insert or update or delete on public.plt_programacao_equipes
  for each statement execute function plt_privado.fn_avisar_rotas();

revoke all on function plt_privado.fn_avisar(text) from public, anon, authenticated;
revoke all on function plt_privado.fn_avisar_eventos() from public, anon, authenticated;
revoke all on function plt_privado.fn_avisar_estoque() from public, anon, authenticated;
revoke all on function plt_privado.fn_avisar_rotas() from public, anon, authenticated;
revoke all on function plt_privado.fn_aviso_pode_ouvir(text) from public, anon;
-- a regra do Realtime chama como quem está logado
grant execute on function plt_privado.fn_aviso_pode_ouvir(text) to authenticated;
