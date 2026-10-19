-- ============================================================================
-- SESSAO-37 · A LIMPA DE PRODUÇÃO (pedido do dono, 19/10 — rodada UMA vez,
-- com o OK dele na conversa, antes de a plataforma entrar em produção).
--
-- O que apaga: a linha do controle de produção (cards, eventos do kanban,
-- execuções, auxílios), as ROTAS (programações) e os TEMPOS (presenças e o
-- agregado diário), além de avisos, anexos, mensagens/afazeres presos a card
-- e a fila de webhooks. Zera também TODOS os PINs (pessoas e setores).
--
-- O que NÃO toca: chat (conversas livres), cadastros (pessoas, setores,
-- etapas, motivos, etiquetas, campos, metas, caminhões), pedidos do Tiny,
-- estoque, comercial, trilha de atividade (append-only) e medições.
--
-- Por fim, REPOVOA o PCP: um card de pedido para cada pedido do Tiny que não
-- está entregue nem cancelado (origem 'api' — manutenção, como manda a casa).
--
-- ⚠️ Exceção registrada à regra dos eventos imutáveis (RNF-05): isto NÃO é
-- feature — é um reset único de dados de teste, ordenado pelo dono. Os
-- gatilhos de imutabilidade são desligados SÓ dentro desta transação.
-- ============================================================================
begin;

-- os gatilhos de proteção/projeção saem do caminho só durante a limpa
alter table public.plt_eventos          disable trigger user;
alter table public.plt_presenca_eventos disable trigger user;
alter table public.plt_cards            disable trigger user;
alter table public.plt_auxilios         disable trigger user;

-- 1 · os dependentes dos cards/eventos
delete from public.plt_webhook_entregas;
delete from public.plt_notificacoes;
delete from public.plt_card_mensagens;
delete from public.plt_anexos;
delete from public.plt_campos_valores;
delete from public.plt_auxilios;
delete from public.plt_programacao_equipes;
delete from public.plt_programacoes;
delete from public.plt_chat_mensagens where card_id is not null;
delete from public.plt_tarefas where card_id is not null;
update public.plt_tarefas set evento_referencia_id = null where evento_referencia_id is not null;

-- 2 · presenças e tempos
delete from public.plt_presenca_atual;
delete from public.plt_presenca_segmentos;
delete from public.plt_presenca_eventos;
delete from public.plt_tempos_pessoa_dia;
delete from public.plt_presencas;
delete from public.plt_automacao_execucoes;

-- 3 · o kanban inteiro (quebrando antes as referências card → evento)
update public.plt_cards
   set ajuste_evento_id = null, devolucao_evento_id = null, parecer_pendente_id = null
 where ajuste_evento_id is not null or devolucao_evento_id is not null
    or parecer_pendente_id is not null;
delete from public.plt_eventos;
delete from public.plt_cards;

-- 4 · todos os PINs zerados (pessoas e setores — serão definidos hoje)
update public.plt_usuarios set pin_hash = null, pin_busca = null
 where pin_hash is not null or pin_busca is not null;
delete from public.plt_setor_pins;
delete from public.plt_pin_tentativas;

-- 5 · os gatilhos voltam ANTES do repovoamento (as projeções devem rodar)
alter table public.plt_eventos          enable trigger user;
alter table public.plt_presenca_eventos enable trigger user;
alter table public.plt_cards            enable trigger user;
alter table public.plt_auxilios         enable trigger user;

-- 6 · repovoa o PCP: um card de pedido para cada pedido vivo do Tiny
with abertos as (
  select p.id, p.numero
    from public.pedidos p
   where plt_privado.fn_situacao_normalizada(p.situacao) not in ('entregue', 'cancelado')
),
novos as (
  insert into public.plt_cards (tipo, pedido_id, setor_atual_id)
    select 'pedido', a.id,
           (select s.id from public.plt_setores s
             where s.papel_no_fluxo = 'entrada' and s.ativo order by s.id limit 1)
      from abertos a
  returning id, pedido_id
)
insert into public.plt_eventos (card_id, tipo, origem, setor_destino_id, dados)
  select n.id, 'card_criado', 'api',
         (select s.id from public.plt_setores s
           where s.papel_no_fluxo = 'entrada' and s.ativo order by s.id limit 1),
         jsonb_build_object('fonte', 'limpeza', 'numero', a.numero)
    from novos n
    join abertos a on a.id = n.pedido_id;

commit;

-- conferência
select (select count(*) from public.plt_cards)   as cards_no_pcp,
       (select count(*) from public.plt_eventos) as eventos,
       (select count(*) from public.plt_usuarios where pin_hash is not null) as pins_de_pessoa,
       (select count(*) from public.plt_setor_pins) as pins_de_setor;
