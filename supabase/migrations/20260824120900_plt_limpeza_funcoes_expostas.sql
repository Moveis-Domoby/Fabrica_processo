-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 10 — LIMPEZA
-- Sessão: SESSAO-02
--
-- A primeira versão criou as funções auxiliares em `public`. Como o Supabase
-- publica o schema `public` inteiro como API REST, cada uma virou um endpoint
-- `/rest/v1/rpc/...` sem necessidade — apontado pelos advisors do próprio
-- Supabase. Elas foram recriadas em `plt_privado` (migrations 01, 04 e 08) e
-- aqui as versões expostas são removidas.
--
-- Esta migration roda DEPOIS de todas as triggers e políticas já apontarem
-- para `plt_privado`, então não há dependência a derrubar. Numa instalação
-- nova, é inofensiva: não existe nada para apagar.
-- ============================================================================

drop function if exists public.plt_fn_marcar_atualizacao();
drop function if exists public.plt_fn_evento_imutavel();
drop function if exists public.plt_fn_projetar_posicao();
drop function if exists public.plt_fn_usuario_atual();
drop function if exists public.plt_fn_eh_admin();
drop function if exists public.plt_fn_setores_do_usuario();
drop function if exists public.plt_fn_eh_lider_de(bigint);
