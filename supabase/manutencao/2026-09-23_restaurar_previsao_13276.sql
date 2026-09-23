-- =============================================================================
-- MANUTENÇÃO · SESSAO-21 · 23/09/2026 — desfaz UMA correção de 22/09 à luz da D-50
--
-- Em 22/09 (2026-09-22_correcoes_conferencia_tiny.sql, causa B) a previsão do
-- pedido 13276 foi APAGADA porque o Tiny não tinha mais previsão ("o Tiny sempre
-- está mais certo"). Em 23/09 o dono fixou a regra (D-50): "observação tudo bem,
-- mas o resto deve manter mesmo que apague lá — edição lá deve editar aqui
-- também, mas não apagar". → a previsão volta ao último valor que o Tiny mandou
-- (11/09/2026). As observações internas limpas em 22/09 (13180, 13410) seguem
-- limpas (permitido pela D-50). O vendedor apagado em 13183 e 13421 NÃO tem o
-- valor antigo guardado em lugar nenhum da plataforma — fica com o dono.
--
-- Efeito colateral conferido: a mudança de data_prevista entra no v_mudou de
-- fn_reagir_pedido, mas o card do 13276 não tem unidade liberada → nenhum evento.
-- =============================================================================

-- 1) CONTAR — esperado 1
select count(*) from public.pedidos where numero = 13276 and data_prevista is null;

-- 2) EXECUTAR (atômico: aborta se não for exatamente 1 linha)
do $$
declare n int;
begin
  update public.pedidos set data_prevista = date '2026-09-11', atualizado_em = now()
   where numero = 13276 and data_prevista is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'ABORTADO — esperado 1 linha, veio %; nada gravado', n; end if;
end $$;

-- 3) CONFERIR — esperado 2026-09-11
select numero, data_prevista from public.pedidos where numero = 13276;
