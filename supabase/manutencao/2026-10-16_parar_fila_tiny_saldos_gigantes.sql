-- ============================================================================
-- Manutenção de 16/10/2026 (SESSAO-32 — achado do retrato de partida)
--
-- A fila do estoque com o Tiny (D-76) girava sem fim em dois produtos cujo saldo
-- no Tiny é enorme — dois INSUMOS cadastrados no Tiny como "simples" (classe S):
--   · 947416709 "FITA DE BORDA BRANCO TX 19MM" — 22.878,58 M
--   · 918479190 "Suporte triangular fixa fundo - Oppeano" — 3.660 UN
-- A leitura (plt_fn_tiny_estoque_leitura) tentava criar UMA PEÇA POR UNIDADE
-- (22.878 cards + eventos + registros), estourava o tempo limite (8 s), era
-- desfeita, e como a reserva da fila não conta tentativa, o item voltava a cada
-- 10 minutos — ~14,5 milhões de linhas gravadas e desfeitas em cards, eventos e
-- registros desde o fim de setembro (as estatísticas erradas da lei §14 #9).
--
-- O que faz: o MESMO que 5 falhas seguidas fazem (plt_privado.fn_tiny_estoque_falhou)
-- — o produto fica PARADO, com o motivo em língua de gente, e aparece em
-- Configurações → Tiny; uma linha 'estoque_tiny_falha' entra na trilha.
-- Nada de peça, evento ou pedido é tocado.
--
-- Desfazer (o produto volta à fila):
--   update public.plt_tiny_estoque_fila
--      set parado_em = null, tentativas = 0, ultimo_erro = null
--    where produto_tiny_id in (947416709, 918479190);
--
-- A correção definitiva (o teto de peças por leitura e a tentativa contada na
-- reserva) é a migration da frente do banco da SESSAO-32.
-- ============================================================================
set lock_timeout = '10s';

select plt_privado.fn_tiny_estoque_falhou(947416709,
  'Saldo no Tiny alto demais para virar peças (22.878,58 m): parece insumo — conferir o cadastro no Tiny.')
  from generate_series(1, 5);

select plt_privado.fn_tiny_estoque_falhou(918479190,
  'Saldo no Tiny alto demais para virar peças (3.660 un): parece insumo — conferir o cadastro no Tiny.')
  from generate_series(1, 5);

select produto_tiny_id, tentativas, parado_em is not null as parado, reservado_em, left(ultimo_erro, 60) as erro
  from public.plt_tiny_estoque_fila
 where produto_tiny_id in (947416709, 918479190);
