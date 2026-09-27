-- ============================================================================
-- SESSAO-24 · Manutenção — as ROTAS das etapas (regras do dono, 27/09/2026)
--
-- O quadro é por arrasto: soltar numa etapa que ENCAMINHA leva o card ao setor
-- dela (plt_etapas.setor_destino_id — migration 37). As regras, nas palavras do
-- dono:
--   · "etapa com nome de setor move o card para o setor" (herança do ClickUp);
--   · "CENTRO DE FURAÇÃO" → setor FURAÇÃO;
--   · CONCLUÍDO de SECC e CNC → FURAÇÃO ("são 2 máquinas que fazem praticamente
--     a mesma coisa… a CNC também fura a peça, a SECC não");
--   · o CONCLUÍDO dos outros setores → "sempre o próximo" (ordem dos setores).
-- Etapas chamadas ESTOQUE (PCP, LIMPEZA E EMBALAGEM) NÃO encaminham: quem leva
-- a peça ao estoque ou a Pedidos em aguardo é o botão Concluir produção.
--
-- É DADO do dono (editável em Setores e etapas) — por isso não mora na
-- migration: reaplicar migrations nunca pode apagar uma edição do admin.
-- Só preenche etapa SEM rota. Idempotente. Rodar só com o OK do dono.
-- ============================================================================

with setores_producao as (
  select s.id, s.codigo, s.ordem, plt_privado.fn_normalizar_texto(s.nome) as nome_norm
    from public.plt_setores s
   where s.papel_no_fluxo = 'producao' and s.ativo
),
por_nome as (
  -- etapa com nome de setor de PRODUÇÃO (e o CENTRO DE FURAÇÃO → FURAÇÃO)
  select e.id as etapa_id, sp.id as destino
    from public.plt_etapas e
    join public.plt_setores so on so.id = e.setor_id
                              and so.papel_no_fluxo in ('entrada', 'producao')
    join setores_producao sp
      on sp.nome_norm = case plt_privado.fn_normalizar_texto(e.nome)
                          when 'centro de furacao' then plt_privado.fn_normalizar_texto('FURAÇÃO')
                          else plt_privado.fn_normalizar_texto(e.nome)
                        end
   where e.ativa and not e.eh_fila and not e.eh_danificado
     and e.setor_destino_id is null
     and sp.id <> e.setor_id
),
por_conclusao as (
  -- CONCLUÍDO: SECC e CNC → FURAÇÃO; os outros → o próximo setor de produção
  select e.id as etapa_id,
         case when so.codigo in ('secc', 'cnc')
              then (select sp.id from setores_producao sp where sp.codigo = 'furacao')
              else (select sp.id from setores_producao sp
                     where (sp.ordem, sp.id) > (so.ordem, so.id)
                     order by sp.ordem, sp.id limit 1)
         end as destino
    from public.plt_etapas e
    join public.plt_setores so on so.id = e.setor_id and so.papel_no_fluxo = 'producao'
   where e.ativa and not e.eh_fila and not e.eh_danificado
     and e.setor_destino_id is null
     and plt_privado.fn_normalizar_texto(e.nome) = 'concluido'
)
update public.plt_etapas e
   set setor_destino_id = a.destino
  from (select etapa_id, destino from por_nome
        union all
        select etapa_id, destino from por_conclusao) a
 where e.id = a.etapa_id
   and a.destino is not null
   and e.setor_destino_id is null;

-- Conferência (o retrato vai para o handoff):
--   select so.nome as setor, e.nome as etapa, sd.nome as manda_para
--     from public.plt_etapas e
--     join public.plt_setores so on so.id = e.setor_id
--     left join public.plt_setores sd on sd.id = e.setor_destino_id
--    where e.setor_destino_id is not null
--    order by so.ordem, e.ordem;
