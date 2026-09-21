-- ============================================================================
-- MANUTENÇÃO (não é migration) · SESSAO-22 · 21/09/2026
-- Migrar os cards VIVOS que hoje estão "na Chegada" (etapa nula) de setores de
-- PRODUÇÃO para a etapa FILA real de cada setor (D-48 / fim da coluna Chegada).
--
-- É evento novo, nunca UPDATE de posição (RNF-05/M-13): um `movimentacao_etapa`
-- por card, dentro do próprio setor, com destino na etapa `eh_fila` ativa.
-- Origem `api` (E-26): lote sem pessoa é o gesto sancionado da integração.
-- PCP e terminais NÃO entram (a estrutura deles não muda nesta sessão);
-- setor de produção sem fila cadastrada também não (o quadro avisa — D-14).
--
-- Rodar DEPOIS da migration 29 aplicada (o trigger resolvedor já existe, mas o
-- lote informa a etapa explicitamente — não depende dele).
-- Passo 1 conta; passo 2 executa; passo 3 confere que zerou.
-- ============================================================================

-- PASSO 1 · contar (rodar primeiro, registrar o número na memória de execução)
select s.nome as setor, count(*) as cards_na_chegada
  from public.plt_cards c
  join public.plt_setores s on s.id = c.setor_atual_id
 where c.etapa_atual_id is null
   and c.arquivado_em is null
   and s.papel_no_fluxo = 'producao'
   and exists (select 1 from public.plt_etapas e
                where e.setor_id = s.id and e.eh_fila and e.ativa)
 group by s.nome
 order by s.nome;

-- PASSO 2 · migrar (evento por card, origem api)
insert into public.plt_eventos
    (card_id, tipo, origem, setor_origem_id, setor_destino_id, etapa_destino_id, observacao)
select c.id,
       'movimentacao_etapa',
       'api',
       c.setor_atual_id,
       c.setor_atual_id,
       f.id,
       'Migração da coluna Chegada para a etapa fila do setor (fim da Chegada nos setores de produção — SESSAO-22).'
  from public.plt_cards c
  join public.plt_setores s on s.id = c.setor_atual_id
  cross join lateral (
    select e.id
      from public.plt_etapas e
     where e.setor_id = s.id and e.eh_fila and e.ativa
     order by e.ordem, e.id
     limit 1
  ) f
 where c.etapa_atual_id is null
   and c.arquivado_em is null
   and s.papel_no_fluxo = 'producao';

-- PASSO 3 · conferir (deve devolver ZERO linhas)
select c.id, s.nome
  from public.plt_cards c
  join public.plt_setores s on s.id = c.setor_atual_id
 where c.etapa_atual_id is null
   and c.arquivado_em is null
   and s.papel_no_fluxo = 'producao'
   and exists (select 1 from public.plt_etapas e
                where e.setor_id = s.id and e.eh_fila and e.ativa);
