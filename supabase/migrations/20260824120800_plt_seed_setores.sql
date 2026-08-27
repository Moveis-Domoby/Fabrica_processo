-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 09 — SEED DOS SETORES
-- Sessão: SESSAO-02 · Data: 2026-08-26
--
-- D-12: os setores de produção do dia 1 são EXATAMENTE os que existem hoje no
-- espaço DPTO PRODUÇÃO do ClickUp — PCP · SECC · CNC · FITAMENTO · FURAÇÃO ·
-- MONTAGEM · LIMPEZA E EMBALAGEM. Nomes como a equipe fala, sem tradução.
--
-- D-13 + resposta do dono em 24/08 (Q-28 ✅): o fluxo tem UMA entrada (PCP) e
-- DOIS fins de linha — ESTOQUE (o card fica parado) e ROTAS (é entregue). O
-- dono pediu a ROTAS "nos primórdios da criação", então ela nasce junto, como
-- setor terminal, mesmo com a ROTAS operacional ainda vivendo no ClickUp na
-- fase 1 (D-05): o card chega no terminal da plataforma e a ponte do n8n cria
-- o card na ROTAS do ClickUp. Quando a logística migrar, nada aqui muda.
--
-- ⚠️ METALURGICA NÃO entra: o dono confirmou em 24/08 que ainda não é um setor
-- utilizado. Quando for, o admin cadastra (RF-07). Nenhuma lógica do sistema
-- pode assumir que ela existe.
--
-- ⚠️ NENHUMA ETAPA INTERNA É SEMEADA. D-14, palavras do dono: cada setor tem
-- suas peculiaridades e o dono cadastra as etapas dele quando vir a plataforma.
-- Chutar etapa aqui geraria trabalho de desfazer e dado errado (M-10).
--
-- Idempotente: `on conflict (codigo) do nothing` — rodar de novo não duplica
-- nem sobrescreve renomeações feitas pelo admin.
-- ============================================================================

insert into public.plt_setores (codigo, nome, papel_no_fluxo, ordem)
values
  -- entrada única do fluxo (D-13)
  ('pcp',               'PCP',                 'entrada',  10),

  -- produção (D-12)
  ('secc',              'SECC',                'producao', 20),
  ('cnc',               'CNC',                 'producao', 30),
  ('fitamento',         'FITAMENTO',           'producao', 40),
  ('furacao',           'FURAÇÃO',             'producao', 50),
  ('montagem',          'MONTAGEM',            'producao', 60),
  ('limpeza_embalagem', 'LIMPEZA E EMBALAGEM', 'producao', 70),

  -- fins de linha (D-13 · Q-28 ✅ respondida em 24/08)
  ('estoque',           'ESTOQUE',             'terminal', 80),
  ('rotas',             'ROTAS',               'terminal', 90)
on conflict (codigo) do nothing;
