-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 21 — ALINHAMENTO DO MODO DE DELEGAÇÃO
-- Sessão: SESSAO-12 · Data: 2026-08-28
--
-- Descoberto na verificação (E-20): a coluna `modo_delegacao` JÁ EXISTIA no
-- banco real, criada por OUTRA sessão de trabalho com um desenho diferente
-- (check só com 'direta'/'aleatoria' e default 'direta') — o `add column if
-- not exists` da migration 20 pulou em silêncio e o front (que fala
-- 'desativada') seria recusado pelo check alheio.
--
-- Este ajuste impõe o desenho da D-34: TRÊS modos, com o padrão CONSERVADOR
-- 'desativada' (card chega sem dono, como sempre foi — delegação é opt-in).
-- Setores que estavam no default de nascimento 'direta' (ninguém escolheu)
-- voltam para 'desativada'; escolha consciente ('aleatoria') é preservada.
-- ============================================================================

alter table public.plt_setores
  drop constraint if exists plt_setores_modo_delegacao_check;

alter table public.plt_setores
  alter column modo_delegacao set default 'desativada';

-- 'direta' aqui era só o default de nascimento da outra sessão — ninguém
-- escolheu. O padrão da D-34 é sem delegação até o admin configurar.
update public.plt_setores
   set modo_delegacao = 'desativada'
 where modo_delegacao = 'direta';

alter table public.plt_setores
  add constraint plt_setores_modo_delegacao_check
  check (modo_delegacao in ('desativada', 'direta', 'aleatoria'));
