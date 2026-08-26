-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 09 — SEED DOS SETORES
-- Sessão: SESSAO-02 · Data: 2026-08-24
--
-- D-12: os setores do dia 1 são EXATAMENTE os que existem hoje no espaço
-- DPTO PRODUÇÃO do ClickUp — PCP · SECC · CNC · FITAMENTO · FURAÇÃO ·
-- MONTAGEM · LIMPEZA E EMBALAGEM. Nomes como a equipe fala, sem tradução.
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
  ('pcp',                 'PCP',                 'entrada',  10),
  ('secc',                'SECC',                'producao', 20),
  ('cnc',                 'CNC',                 'producao', 30),
  ('fitamento',           'FITAMENTO',           'producao', 40),
  ('furacao',             'FURAÇÃO',             'producao', 50),
  ('montagem',            'MONTAGEM',            'producao', 60),
  ('limpeza_embalagem',   'LIMPEZA E EMBALAGEM', 'producao', 70)
on conflict (codigo) do nothing;

-- ----------------------------------------------------------------------------
-- ⏸️ SETORES TERMINAIS — PENDENTE DE DECISÃO DO DONO (Q-28)
--
-- A D-13 diz que o card termina em ESTOQUE (fica parado) ou em ROTAS (é
-- entregue). Mas a lista de setores do dia 1 da D-12 — que é a lista do
-- ClickUp — não tem nem ESTOQUE nem ROTAS. As duas decisões não se encaixam,
-- e a própria D-13 marca isso como "⚠️ ponto a confirmar antes da SESSAO-04".
--
-- Somado a isso, a D-05 mantém a ROTAS no ClickUp na fase 1, com o n8n fazendo
-- a ponte. Então há duas leituras possíveis, e escolher uma seria inventar:
--
--   (a) ESTOQUE e ROTAS existem na plataforma como setores terminais — ROTAS
--       sendo um terminal de handoff (o card chega e a ponte n8n cria o card
--       na ROTAS do ClickUp);
--   (b) só ESTOQUE é terminal na plataforma, e a ROTAS segue inteiramente
--       fora, alcançada pelo n8n a partir da LIMPEZA E EMBALAGEM.
--
-- A estrutura já suporta as duas: basta cadastrar o setor com
-- papel_no_fluxo = 'terminal'. Quando o dono decidir, descomentar o bloco
-- correspondente (ou cadastrar pela tela de admin, quando ela existir).
--
-- insert into public.plt_setores (codigo, nome, papel_no_fluxo, ordem)
-- values
--   ('estoque', 'ESTOQUE', 'terminal', 80),
--   ('rotas',   'ROTAS',   'terminal', 90)
-- on conflict (codigo) do nothing;
-- ----------------------------------------------------------------------------
