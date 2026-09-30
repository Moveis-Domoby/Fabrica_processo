-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 43 — O n8n SÓ RODA QUANDO HÁ
-- TRABALHO: o banco chama o fluxo do estoque, e a varredura da madrugada mora
-- no banco
-- Ajuste pedido pelo dono em 2026-09-30 (conversa) · ↪️ D-80
--
-- O dono, vendo o fluxo único com um gatilho de 1 em 1 minuto: "você não tá
-- nem doido de deixar alguma coisa rodando no meu n8n a cada 1 minuto para
-- requisitar várias coisas, calma — melhora isso daí".
--
--   1. O n8n perde o relógio de 1 minuto e o de 04:00. No lugar, um webhook
--      próprio ("processar a fila do estoque"): o n8n acorda só quando é
--      chamado, pega um lote (até 20), lê o Tiny, grava e termina.
--   2. Quem chama é o BANCO, pelo relógio que já existia (`plt-estoque-
--      reservas`, 1/min, interno — não chama nada de fora sozinho): só posta
--      no n8n se o sincronismo está ligado, há produto esperando na fila e
--      nenhum lote está em andamento (nada pego há menos de 2 min). Fila vazia
--      = nenhuma chamada, nenhuma execução no n8n, nenhuma consulta ao Tiny.
--   3. A varredura da madrugada (04:00 de Natal/São Paulo = 07:00 UTC) vira
--      um agendamento do banco: põe os acabados na fila; o relógio chama o n8n.
--   4. O endereço do n8n mora em `plt_webhooks` (a tabela de webhooks de saída
--      que já existe — D-47), marcado com `tiny_estoque_fila` em `eventos`
--      (nenhum tipo de evento tem esse nome: o enfileirador dos webhooks por
--      evento nunca o usa).
--
-- Nada muda em clientes/pedidos/pedido_itens/eventos/produtos.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 0 · Pré-requisitos
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.plt_tiny_estoque_fila') is null then
    raise exception 'A migration 43 precisa da migration 42 (fila do Tiny).';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1 · O endereço do fluxo do estoque no n8n (webhook de produção, caminho com
--     UUID = segredo). Só nasce se não existir — o admin pode trocar a URL ou
--     desligar (`ativo`) sem que a reaplicação desfaça.
-- ----------------------------------------------------------------------------
insert into public.plt_webhooks (nome, url, eventos, ativo)
select 'n8n · fila do estoque do Tiny',
       'https://n8n.srv1877515.hstgr.cloud/webhook/29bec08a-f220-4c18-bdb7-bce79da744fa',
       array['tiny_estoque_fila'],
       true
 where not exists (select 1 from public.plt_webhooks w where 'tiny_estoque_fila' = any (w.eventos));

-- ----------------------------------------------------------------------------
-- 2 · Precisa chamar o n8n? Ligado + produto esperando (não parado, não pego)
--     + nenhum lote em andamento (nada pego há menos de 2 min).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tiny_estoque_precisa_chamar()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select plt_privado.fn_tiny_estoque_desde() is not null
     and exists (select 1 from public.plt_tiny_estoque_fila f
                  where f.parado_em is null
                    and (f.reservado_em is null or f.reservado_em < now() - interval '10 minutes'))
     and not exists (select 1 from public.plt_tiny_estoque_fila f
                      where f.reservado_em >= now() - interval '2 minutes');
$$;

-- Chama o n8n (pg_net, assíncrono — o banco não espera). Devolve o que fez.
create or replace function plt_privado.fn_tiny_estoque_chamar_n8n()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url       text;
  v_pendentes integer;
begin
  if not plt_privado.fn_tiny_estoque_precisa_chamar() then
    return 'nada_a_fazer';
  end if;
  select w.url into v_url from public.plt_webhooks w
   where w.ativo and 'tiny_estoque_fila' = any (w.eventos)
   order by w.id limit 1;
  if v_url is null then
    return 'sem_endereco';
  end if;
  if to_regproc('net.http_post') is null then
    return 'sem_pg_net';   -- ambiente de teste
  end if;
  select count(*) into v_pendentes from public.plt_tiny_estoque_fila f where f.parado_em is null;
  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object('motivo', 'fila_do_estoque', 'pendentes', v_pendentes, 'em', now()),
    headers := jsonb_build_object('Content-Type', 'application/json'));
  return 'chamado';
end;
$$;

-- ----------------------------------------------------------------------------
-- 3 · O relógio do estoque (1/min, interno): a venda reserva a peça (D-78) e,
--     se houver fila, chama o n8n. Um lugar só para o agendamento.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_estoque_relogio()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservas jsonb;
  v_n8n      text;
begin
  v_reservas := plt_privado.fn_estoque_reservas_rodar();
  begin
    v_n8n := plt_privado.fn_tiny_estoque_chamar_n8n();
  exception when others then
    v_n8n := 'erro: ' || left(sqlerrm, 200);   -- a reserva da venda nunca cai por causa da chamada
  end;
  return v_reservas || jsonb_build_object('n8n', v_n8n);
end;
$$;

comment on function plt_privado.fn_estoque_relogio() is
  'O relógio do estoque (pg_cron plt-estoque-reservas, 1/min, interno): reserva as peças das vendas novas (D-78) e, se há produto esperando na fila do Tiny e nenhum lote em andamento, chama o fluxo do n8n uma vez (↪️ D-80 — o n8n só roda quando há trabalho).';

-- ----------------------------------------------------------------------------
-- 4 · Agendamentos (só onde existe pg_cron — produção)
--     · o relógio passa a ser fn_estoque_relogio (troca o comando do job da 42)
--     · a varredura da madrugada: 04:00 de São Paulo = 07:00 UTC
-- ----------------------------------------------------------------------------
do $$
declare
  v_job bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_job from cron.job where jobname = 'plt-estoque-reservas';
    if v_job is not null then
      perform cron.unschedule(v_job);
    end if;
    perform cron.schedule('plt-estoque-reservas', '* * * * *',
      'select plt_privado.fn_estoque_relogio()');
    if not exists (select 1 from cron.job where jobname = 'plt-tiny-estoque-varredura') then
      perform cron.schedule('plt-tiny-estoque-varredura', '0 7 * * *',
        'select public.plt_fn_tiny_estoque_varrer()');
    end if;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5 · Permissões: maquinaria fora da API (E-11)
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_tiny_estoque_precisa_chamar() from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_estoque_chamar_n8n()     from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_relogio()             from public, anon, authenticated;
