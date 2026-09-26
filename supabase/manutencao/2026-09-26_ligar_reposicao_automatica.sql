-- ============================================================================
-- SESSAO-25 · LIGAR a reposição automática de estoque (card no PCP quando o
-- disponível de um produto fica abaixo do mínimo do Tiny — resposta 7 do dono)
--
-- ⚠️ Rodar SÓ depois de:
--   1. a migration 36 aplicada (20260926120000_plt_estoque_completo.sql);
--   2. a CARGA INICIAL do saldo rodada no n8n
--      (_docs/Fabrica n8n/domoby-tiny-fabrica-carga-saldo.json) e conferida
--      pelo dono na tela de Estoque;
--   3. o OK do dono na conversa (regra crítica 2).
-- Sem a carga, só os produtos que se movimentaram têm leitura — e sem leitura
-- a maquinaria não decide nada (não gera card). Com a carga, a PRIMEIRA rodada
-- pode criar vários cards de uma vez: veja a prévia antes.
--
-- Desligar a qualquer momento:  select cron.unschedule('plt-estoque-reposicao');
-- ============================================================================

-- 1 · PRÉVIA (só leitura): quem ganharia card agora, e quantas unidades.
select b.codigo, b.descricao, b.minimo, b.saldo_tiny, b.reservas_loja, b.disponivel,
       ceil(b.minimo - greatest(b.disponivel, 0))::int as repor,
       greatest(-b.disponivel, 0)                     as necessidade_extrema,
       b.reposicao_estado
  from plt_privado.fn_estoque_por_produto() b
 where b.situacao = 'A'
   and b.classe in ('F', 'S', 'V')
   and coalesce(b.minimo, 0) > 0
   and b.saldo_tiny is not null
   and b.disponivel < b.minimo
 order by b.disponivel, b.codigo;

-- 2 · A primeira rodada, na hora (devolve quantos cards nasceram no PCP).
select plt_privado.fn_gerar_reposicoes() as cards_de_reposicao_criados;

-- 3 · O agendamento: a cada 5 minutos (idempotente — um ciclo vivo por produto).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'plt-estoque-reposicao') then
      perform cron.schedule('plt-estoque-reposicao', '*/5 * * * *',
                            'select plt_privado.fn_gerar_reposicoes()');
    end if;
  else
    raise exception 'pg_cron não está habilitado neste banco.';
  end if;
end;
$$;

select jobid, jobname, schedule, active from cron.job where jobname = 'plt-estoque-reposicao';
