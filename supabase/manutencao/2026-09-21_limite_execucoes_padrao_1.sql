-- ============================================================================
-- MANUTENÇÃO (não é migration) · SESSAO-22 · 21/09/2026
-- D-48 (resposta 4 do dono): o limite de execuções por pessoa vira 1 em TODOS
-- os setores existentes. A migration 29 muda só o DEFAULT (setor novo nasce
-- com 1); os setores já cadastrados mudam aqui, uma vez — de propósito fora da
-- migration, para uma reaplicação futura nunca sobrescrever um ajuste que o
-- admin/líder tenha feito depois (lição do E-24, na direção inversa).
--
-- Passo 1 mostra o retrato; passo 2 aplica só onde está "sem limite" (null).
-- ============================================================================

-- PASSO 1 · retrato de agora
select nome, papel_no_fluxo, limite_execucoes_por_pessoa
  from public.plt_setores
 order by ordem, id;

-- PASSO 2 · aplicar o padrão 1 onde ainda não há limite
update public.plt_setores
   set limite_execucoes_por_pessoa = 1
 where limite_execucoes_por_pessoa is null;
