-- ============================================================================
-- SESSAO-51 · BASE — o que os dois blocos leem (commitado antes das frentes —
-- A-201): os tipos de fato novos, os motivos da volta ao PCP, as projeções no
-- card, o catálogo dos avisos, o validador e a projeção dos fatos novos
-- ============================================================================
-- Pedido do dono de 16/11 (22:41):
--   bloco A · na ENTREGA PARCIAL, o que ainda está na fábrica continua em
--             produção ("Deixar em produção") ou sai dela ("Limpar da
--             produção"); a decisão se revoga quantas vezes for preciso, na aba
--             "Entregas parciais" do PCP e na ficha do pedido (↩️ D-195);
--   bloco B · "Mover para o PCP" (admin): a peça em produção volta ao PCP como
--             vaga do pedido (com motivo) ou vira reposição de estoque; ao
--             liberar de novo, "Usar a mesma peça" (D-130: a peça é uma só).
-- Nada aqui altera tabela da integração (regra 10).
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Os tipos de fato novos (o validate mora AQUI agora — E-19; saiu da
--     20261112010000)
--   peca_retirada_entrega_parcial     a peça em produção que a entrega parcial
--                                     (ou o revogar) tirou da produção — guarda
--                                     setor, etapa, pedido, item e k/n
--   peca_volta_entrega_parcial        a mesma peça voltando pelo revogar
--   entrega_parcial_decisao_revogada  no card do pedido: a decisão trocada
--   card_voltou_pcp                   bloco B: a peça devolvida ao PCP
--   peca_reaproveitada_pcp            bloco B: a mesma peça liberada de novo
-- ----------------------------------------------------------------------------
alter table public.plt_eventos drop constraint if exists plt_eventos_tipo_check;
alter table public.plt_eventos add constraint plt_eventos_tipo_check check (tipo = any (array[

  'card_criado', 'movimentacao_setor', 'movimentacao_etapa', 'execucao_iniciada', 'execucao_finalizada',
  'execucao_pausada', 'execucao_retomada', 'qualidade_marcada', 'qualidade_parecer', 'divergencia_registrada',
  'notificacao_enviada', 'delegacao', 'estorno', 'pedido_atualizado', 'pedido_cancelado', 'card_arquivado',
  'pedido_entregue', 'pedido_lancado_rotas', 'unidade_desvinculada', 'peca_alocada', 'peca_reservada',
  'peca_reserva_desfeita', 'estoque_reserva_avaliada', 'etiqueta_adicionada', 'etiqueta_removida',
  'card_desarquivado', 'entrega_desfeita', 'entrega_nao_realizada', 'pedido_devolvido', 'comentario_adicionado',
  'anexo_adicionado', 'devolucao_decidida', 'ajuste_aberto', 'ajuste_concluido', 'avulso_concluido',
  'card_editado', 'responsavel_adicionado', 'responsavel_removido', 'anexo_removido', 'comentario_editado',
  'comentario_apagado', 'auxilio_iniciado', 'auxilio_pausado', 'auxilio_retomado', 'auxilio_encerrado',
  'prioridade_definida', 'responsavel_setor_definido', 'pedido_standby_entrou', 'pedido_standby_saiu',
  'data_entrega_alterada', 'peca_vinculada', 'tempo_decisao', 'pedido_itens_alterados',
  'pedido_volta_pcp', 'pedido_volta_pcp_fim', 'entrega_dia_corrigido',
  -- SESSAO-48: cancelar a fabricação e retomar (frentes 1 e 4); o aviso resolvido,
  -- a remoção do PCP e a devolução (frente 2); o destino da peça de pedido
  -- cancelado no Tiny (frente 3)
  'fabricacao_cancelada', 'fabricacao_retomada', 'pcp_aviso_resolvido', 'pedido_removido_pcp',
  'pedido_devolvido_pcp', 'destino_pendente', 'destino_decidido',
  -- SESSAO-50: o pedido excluído no Tiny (e reencontrado), o cancelamento pela plataforma e a
  -- peça ocultada com o pedido (bloco B); o endereço de entrega alterado na plataforma (bloco C)
  'pedido_excluido_tiny', 'pedido_reencontrado_tiny', 'pedido_cancelado_plataforma', 'card_oculto',
  'endereco_entrega_alterado', 'endereco_entrega_restaurado', 'endereco_entrega_tiny_confirmado',
  'endereco_entrega_tiny_substituido',
  -- SESSAO-51: a entrega parcial que mantém ou limpa a produção, o revogar (bloco A);
  -- a peça devolvida ao PCP e reaproveitada na liberação (bloco B)
  'peca_retirada_entrega_parcial', 'peca_volta_entrega_parcial', 'entrega_parcial_decisao_revogada',
  'card_voltou_pcp', 'peca_reaproveitada_pcp'
]::text[])) not valid;
alter table public.plt_eventos validate constraint plt_eventos_tipo_check;

-- ----------------------------------------------------------------------------
-- 2 · Os motivos da volta ao PCP (Utilitários → "Volta ao PCP") — o check
--     recriado com o tipo novo e VALIDADO aqui (E-19/E-144: o validate saiu da
--     20261105040000). Sementes provisórias da demanda (D-325).
-- ----------------------------------------------------------------------------
alter table public.plt_motivos drop constraint if exists plt_motivos_tipo_ck;
alter table public.plt_motivos add constraint plt_motivos_tipo_ck
  check (tipo in ('nao_entregue', 'desfazer_entrega', 'devolucao', 'pausa', 'saida', 'standby', 'mover',
                  'entrega_parcial', 'conferencia', 'volta_pcp')) not valid;
alter table public.plt_motivos validate constraint plt_motivos_tipo_ck;

insert into public.plt_motivos (tipo, texto, ordem) values
  ('volta_pcp', 'Liberada por engano', 10),
  ('volta_pcp', 'Prioridade mudou', 20),
  ('volta_pcp', 'Falta material', 30),
  ('volta_pcp', 'Mudança no pedido', 40),
  ('volta_pcp', 'Outro', 90)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 3 · As projeções no card (escritas SÓ pelos gatilhos dos fatos — M-13)
-- ----------------------------------------------------------------------------
-- no card do PEDIDO: a entrega parcial e a decisão que vale agora
alter table public.plt_cards add column if not exists parcial_evento_id bigint;
alter table public.plt_cards add column if not exists parcial_em timestamptz;
alter table public.plt_cards add column if not exists parcial_entregues integer;
alter table public.plt_cards add column if not exists parcial_total integer;
alter table public.plt_cards add column if not exists parcial_decisao text;
alter table public.plt_cards add column if not exists parcial_decisao_em timestamptz;
alter table public.plt_cards add column if not exists parcial_decisao_evento_id bigint;
-- na PEÇA: tirada da produção pela entrega parcial (a volta pelo revogar limpa)
alter table public.plt_cards add column if not exists retirada_parcial_em timestamptz;
alter table public.plt_cards add column if not exists retirada_parcial_evento_id bigint;
-- na PEÇA: devolvida ao PCP pelo administrador (bloco B) — a liberação oferece
-- "Usar a mesma peça" na vaga do pedido (voltou_pcp_pedido_id, sem reposição) ou
-- na reposição (voltou_pcp_reposicao_id)
alter table public.plt_cards add column if not exists voltou_pcp_em timestamptz;
alter table public.plt_cards add column if not exists voltou_pcp_evento_id bigint;
alter table public.plt_cards add column if not exists voltou_pcp_pedido_id bigint;
alter table public.plt_cards add column if not exists voltou_pcp_reposicao_id bigint;
-- no card de REPOSIÇÃO: nasceu de uma peça que voltou da produção (bloco B) — não
-- sai sozinha em 2 dias úteis (D-85) nem entra na conta da reposição automática
-- enquanto não for liberada (D-86)
alter table public.plt_cards add column if not exists reposicao_origem_card_id bigint;

comment on column public.plt_cards.parcial_evento_id is
  'SESSAO-51 (bloco A): no card do PEDIDO, a última entrega PARCIAL (fato pedido_entregue com parcial). Com "Deixar em produção" o pedido segue vivo (entrega_evento_id fica nulo); com "Limpar da produção" fecha como hoje. Projeção — só o gatilho do fato escreve.';
comment on column public.plt_cards.parcial_entregues is
  'SESSAO-51: quantas peças do pedido já saíram em entregas parciais (soma) — o "Entregue em parte (N de M)".';
comment on column public.plt_cards.parcial_total is
  'SESSAO-51: quantos móveis o pedido tem (sem frete — D-63) na última entrega parcial — o M de "N de M".';
comment on column public.plt_cards.parcial_decisao is
  'SESSAO-51: a decisão que vale AGORA sobre o que estava na fábrica: ''manter'' (seguem em produção e no PCP) ou ''limpar'' (saíram da produção e do PCP). Troca pelo revogar (entrega_parcial_decisao_revogada), quantas vezes for preciso. Nula = entrega parcial sem nada na fábrica (ou de antes da SESSAO-51).';
comment on column public.plt_cards.retirada_parcial_em is
  'SESSAO-51: na PEÇA — tirada da produção pela entrega parcial (ou pelo revogar). Ela não perde o pedido (D-326); o fato guarda setor e etapa para a volta.';
comment on column public.plt_cards.voltou_pcp_em is
  'SESSAO-51 (bloco B): na PEÇA — o administrador a devolveu ao PCP ("Mover para o PCP"). Arquivada com registro; a liberação seguinte oferece "Usar a mesma peça". Limpa quando ela é reaproveitada.';
comment on column public.plt_cards.reposicao_origem_card_id is
  'SESSAO-51 (bloco B): no card de REPOSIÇÃO — a peça da produção que virou esta reposição ("Virar reposição de estoque"). Não sai sozinha em 2 dias úteis nem entra na conta da reposição automática enquanto não for liberada.';

alter table public.plt_cards drop constraint if exists plt_cards_parcial_ck;
alter table public.plt_cards add constraint plt_cards_parcial_ck check (
  (parcial_evento_id is null) = (parcial_em is null)
  and (parcial_decisao is null) = (parcial_decisao_em is null)
  and (parcial_decisao is null or parcial_decisao in ('manter', 'limpar'))
) not valid;
alter table public.plt_cards validate constraint plt_cards_parcial_ck;

alter table public.plt_cards drop constraint if exists plt_cards_retirada_parcial_ck;
alter table public.plt_cards add constraint plt_cards_retirada_parcial_ck check (
  (retirada_parcial_em is null) = (retirada_parcial_evento_id is null)
) not valid;
alter table public.plt_cards validate constraint plt_cards_retirada_parcial_ck;

alter table public.plt_cards drop constraint if exists plt_cards_voltou_pcp_ck;
alter table public.plt_cards add constraint plt_cards_voltou_pcp_ck check (
  (voltou_pcp_em is null) = (voltou_pcp_evento_id is null)
  and (voltou_pcp_em is not null or (voltou_pcp_pedido_id is null and voltou_pcp_reposicao_id is null))
) not valid;
alter table public.plt_cards validate constraint plt_cards_voltou_pcp_ck;

-- A lista "Entregas parciais" anda do mais recente para trás (cursor — Lei §6)
create index if not exists plt_cards_parcial_lista_idx
  on public.plt_cards (parcial_decisao_em desc, id desc)
  where parcial_decisao is not null;
-- as peças tiradas da produção de um pedido (a volta pelo revogar)
create index if not exists plt_cards_retirada_parcial_idx
  on public.plt_cards (pedido_id)
  where retirada_parcial_em is not null;
-- as peças devolvidas ao PCP de um pedido / de uma reposição (o selo e a liberação)
create index if not exists plt_cards_voltou_pcp_pedido_idx
  on public.plt_cards (voltou_pcp_pedido_id)
  where voltou_pcp_em is not null;
create index if not exists plt_cards_voltou_pcp_reposicao_idx
  on public.plt_cards (voltou_pcp_reposicao_id)
  where voltou_pcp_em is not null;
create index if not exists plt_cards_reposicao_origem_idx
  on public.plt_cards (reposicao_origem_card_id)
  where reposicao_origem_card_id is not null;

-- ----------------------------------------------------------------------------
-- 4 · "Limpar da produção" tira o pedido do PCP pela regra única que já existe
--     (removido_pcp_em → fn_fora_do_pcp), com o motivo próprio — a aba
--     "Pedidos ocultos" e o "Incluir pedido no PCP" não o mostram; o revogar o
--     devolve (D-327)
-- ----------------------------------------------------------------------------
alter table public.plt_cards drop constraint if exists plt_cards_removido_pcp_ck;
alter table public.plt_cards add constraint plt_cards_removido_pcp_ck check (
  (removido_pcp_em is null and removido_pcp_motivo is null and removido_pcp_texto is null
   and removido_pcp_evento_id is null)
  or (removido_pcp_em is not null
      and coalesce(removido_pcp_motivo, '') in ('oculto', 'pedido_cancelado', 'fora_da_linha', 'outro',
                                                'entrega_parcial'))
) not valid;
alter table public.plt_cards validate constraint plt_cards_removido_pcp_ck;

-- ----------------------------------------------------------------------------
-- 5 · A trava "uma peça por vaga" das peças SEM pedido não vale para a peça que
--     voltou ao PCP (a de móvel fora do catálogo guarda o card do pedido como
--     pai — E-254): devolver, liberar de novo a mesma vaga com peça nova e
--     devolver outra vez são duas peças sem pedido no mesmo lugar (o E-256 da 48)
-- ----------------------------------------------------------------------------
drop index if exists public.plt_cards_unidade_reposicao_uq;
create unique index plt_cards_unidade_reposicao_uq
  on public.plt_cards (card_pai_id, item_seq, indice_unidade)
  where tipo = 'unidade' and pedido_id is null and cancelada_pedido_id is null and voltou_pcp_em is null;

-- ----------------------------------------------------------------------------
-- 6 · O catálogo dos avisos: os três avisos novos vão para o público do PCP
--     (logística, PCP e admin — a régua de sempre)
-- ----------------------------------------------------------------------------
-- (recriada da vigente — 20261112010000_plt_sessao50_base.sql)
CREATE OR REPLACE FUNCTION plt_privado.fn_avisos_catalogo()
 RETURNS TABLE(tipo text, grupo text, grupo_nome text, ordem integer, nome text, descricao text, publico text, obrigatorio boolean, erro boolean)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select * from (values
    ('qualidade_atencao',        'producao',  'Produção e qualidade',             10, 'Peça em atenção',                         'Alguém marcou uma peça com algo a conferir.',                                   'lideranca', false, false),
    ('qualidade_danificado',     'producao',  'Produção e qualidade',             11, 'Peça danificada',                         'Alguém marcou uma peça como danificada.',                                       'lideranca', false, false),
    ('qualidade_divergencia',    'producao',  'Produção e qualidade',             12, 'Estado da peça diferente',                'Quem entregou e quem recebeu marcaram estados diferentes.',                     'lideranca', false, false),
    ('tarefa_sistema',           'producao',  'Produção e qualidade',             13, 'Recebimento para confirmar',              'Uma peça chegou ao setor e espera a confirmação do estado.',                    'todos',     false, false),
    ('card_esquecido',           'producao',  'Produção e qualidade',             14, 'Ainda tem alguém neste card?',            'Card da montagem rodando há 2 horas sem parar.',                                'todos',     true,  false),
    ('execucao_pulada',          'producao',  'Produção e qualidade',             15, 'Móvel pulou a montagem',                  'Um móvel saiu da Montagem (ou de outro setor com o aviso ligado) sem ninguém iniciar.', 'admin',     false, false),
    ('peca_cancelada_pcp',       'producao',  'Produção e qualidade',             16, 'Peça cancelada na produção',              'A peça foi para CANCELADO ou NÃO ENCONTRADO e a vaga do pedido voltou ao PCP.',  'pcp',       false, false),
    -- SESSAO-51 (bloco B): o administrador devolveu a peça ao PCP (vaga do pedido ou reposição)
    ('card_voltou_pcp',          'producao',  'Produção e qualidade',             17, 'Peça devolvida ao PCP',                   'Um administrador tirou a peça da produção e a devolveu ao PCP (a vaga do pedido reabriu ou ela virou reposição de estoque).', 'pcp', false, false),
    ('chegada_aguardo',          'expedicao', 'Expedição e estoque',              20, 'Peça pronta na Expedição',                'Cada peça de pedido que fica pronta.',                                          'admin',     false, false),
    ('chegada_estoque',          'expedicao', 'Expedição e estoque',              21, 'Peça entrou no estoque',                  'Cada peça sem dono que entra no estoque.',                                      'admin',     false, false),
    ('devolucao_decidir',        'expedicao', 'Expedição e estoque',              22, 'Pedido devolvido ou entregue em parte',   'Peças esperando a decisão da logística.',                                       'logistica', false, false),
    ('pedido_cancelado_decidir', 'expedicao', 'Expedição e estoque',              23, 'Pedido cancelado com móveis em produção', 'O Tiny cancelou o pedido: a logística decide para onde vai cada móvel que estava sendo feito.', 'logistica', false, false),
    -- SESSAO-51 (bloco A): a entrega parcial que tirou da produção o que estava na fábrica, e o revogar
    ('entrega_parcial_retirada', 'expedicao', 'Expedição e estoque',              24, 'Entrega parcial tirou peças da produção',  'Na entrega parcial, o que ainda estava na fábrica saiu da produção (dá para voltar atrás em PCP → Entregas parciais).', 'pcp', false, false),
    ('entrega_parcial_revogada', 'expedicao', 'Expedição e estoque',              25, 'Decisão da entrega parcial revogada',     'Alguém voltou atrás na decisão de uma entrega parcial: as peças voltaram para a produção ou saíram dela.', 'pcp', false, false),
    ('pedido_cancelado',         'pedidos',   'Pedidos e Tiny',                   30, 'Pedido cancelado com produção',           'Cancelado no Tiny com peças já liberadas.',                                     'admin',     false, false),
    ('pedido_excluido_no_tiny',  'pedidos',   'Pedidos e Tiny',                   31, 'Pedido excluído no Tiny',                 'O pedido não existe mais no Tiny e saiu do PCP: segue o caminho do cancelado.',  'logistica', false, false),
    ('produto_excluido_no_tiny', 'pedidos',   'Pedidos e Tiny',                   32, 'Produto apagado no Tiny',                 'Apagado no Tiny, mas ainda com peças no quadro.',                               'admin',     false, false),
    ('pedido_itens_novos',      'pedidos',   'Pedidos e Tiny',                   33, 'Itens novos num pedido já liberado', 'O vendedor acrescentou itens no Tiny e o pedido voltou ao PCP só com o que falta.', 'pcp',       false, false),
    ('pedido_itens_sairam',     'pedidos',   'Pedidos e Tiny',                   34, 'Item saiu de um pedido com peça feita', 'O Tiny tirou ou diminuiu um item que já tem peça — nada foi arquivado.',        'pcp',       false, false),
    ('pedido_itens_rota',       'pedidos',   'Pedidos e Tiny',                   35, 'Pedido na rota ganhou itens',       'Segure a entrega: o pedido voltou ao PCP com os itens novos.',                  'logistica', false, false),
    ('tiny_saiu_de_entregue',   'pedidos',   'Pedidos e Tiny',                   36, 'Pedido voltou atrás no Tiny',       'Saiu de "Entregue" no Tiny: a entrega que veio do Tiny reabre; a feita aqui só avisa.', 'logistica', false, false),
    ('pedido_peca_liberada',    'pedidos',   'Pedidos e Tiny',                   37, 'Peça pronta liberada para outro pedido', 'A Expedição deu a peça pronta de um pedido para outro: ele voltou ao PCP para produzir de novo.', 'pcp', false, false),
    ('pedido_voltou_pcp',       'pedidos',   'Pedidos e Tiny',                   38, 'Pedido devolvido ao PCP pela logística', 'O Tiny tinha levado o pedido adiante com produto por liberar: a logística mudou a situação lá e ele voltou ao PCP.', 'pcp', false, false),
    ('pedido_adiantado_tiny',   'pedidos',   'Pedidos e Tiny',                   39, 'Pedido adiantado no Tiny ficou na Expedição', 'A peça pronta saiu do pedido, mas o Tiny já o levou adiante: ele ficou na Expedição esperando a decisão.', 'logistica', false, false),
    ('endereco_tiny_mudou',     'pedidos',   'Pedidos e Tiny',                   29, 'Endereço mudou no Tiny',             'O endereço de entrega mudou no Tiny e o endereço alterado na plataforma deixou de valer.', 'logistica', false, false),
    ('delegacao',                'cards',     'Cards e afazeres',                 40, 'Um afazer chegou para você',              'Um card foi colocado sob sua responsabilidade.',                                'todos',     false, false),
    ('card_responsavel',         'cards',     'Cards e afazeres',                 41, 'Você virou responsável por um card',      null,                                                                            'todos',     false, false),
    ('card_mencao',              'cards',     'Cards e afazeres',                 42, 'Mencionaram você',                        'Alguém escreveu o seu nome na conversa de um card.',                            'todos',     false, false),
    ('automacao',                'cards',     'Cards e afazeres',                 43, 'Aviso de uma automação',                  'As automações da plataforma que mandam aviso.',                                 'todos',     false, false),
    ('senha_pedido',             'acesso',    'Acesso',                           50, 'Pedido de troca de senha',                'Alguém pediu para trocar a senha.',                                             'admin',     true,  false),
    ('senha_sem_cadastro',       'acesso',    'Acesso',                           51, 'Troca de senha para e-mail sem cadastro', 'Pode ser alguém da equipe que digitou o e-mail errado.',                        'admin',     false, false),
    ('automacao_erro',           'erros',     'Erros de automação e integrações', 60, 'Integração com o Tiny ou o n8n parou',    'O Tiny desistiu de um item, uma automação do n8n deu erro, a conexão com o Tiny da fábrica caiu ou a lista do Tiny veio incompleta.', 'admin', false, true),
    ('tiny_pedido_parado',       'erros',     'Erros de automação e integrações', 61, 'O Tiny não aceitou a situação de um pedido', 'Depois de 8 tentativas, a situação do pedido não mudou lá.',                 'admin',     false, true),
    ('automacao_falhou',         'erros',     'Erros de automação e integrações', 62, 'Uma automação da plataforma falhou',      'Uma automação montada no Super admin parou com erro.',                          'admin',     false, true),
    ('estoque_tiny_parado',      'erros',     'Erros de automação e integrações', 63, 'O estoque parou de ir para o Tiny',       'Depois de 5 tentativas, o saldo de um móvel não foi atualizado no Tiny.',       'admin',     false, true),
    ('webhook_falhou',           'erros',     'Erros de automação e integrações', 64, 'Aviso para uma integração não entregue',  'A plataforma não conseguiu avisar uma integração depois de 5 tentativas.',     'admin',     false, true)
  ) as c(tipo, grupo, grupo_nome, ordem, nome, descricao, publico, obrigatorio, erro);
$function$;

-- ----------------------------------------------------------------------------
-- 7 · Os fatos novos: quem grava (a maquinaria de cada bloco liga a sua marca —
--     o padrão da casa) e no tipo de card certo
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_fatos_sessao51()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_marca text;
  v_tipo  text;
begin
  v_marca := case when new.tipo in ('card_voltou_pcp', 'peca_reaproveitada_pcp')
                  then 'plt.volta_pcp_maquinaria' else 'plt.parcial_maquinaria' end;
  if coalesce(current_setting(v_marca, true), '') <> 'on' then
    raise exception 'Este registro nasce sozinho, pelo gesto na plataforma (a entrega parcial, o revogar, o "Mover para o PCP" ou a liberação) — não se grava direto.'
      using errcode = 'check_violation';
  end if;
  select c.tipo into v_tipo from public.plt_cards c where c.id = new.card_id;
  if new.tipo = 'entrega_parcial_decisao_revogada' then
    if v_tipo is distinct from 'pedido' then
      raise exception 'A decisão da entrega parcial é do card do pedido.' using errcode = 'check_violation';
    end if;
    if coalesce(new.dados ->> 'antes', '') not in ('manter', 'limpar')
       or coalesce(new.dados ->> 'depois', '') not in ('manter', 'limpar')
       or new.dados ->> 'antes' = new.dados ->> 'depois' then
      raise exception 'O revogar troca "deixar em produção" por "limpar da produção" (ou o contrário).'
        using errcode = 'check_violation';
    end if;
    if new.usuario_id is null then
      raise exception 'Revogar a decisão é gesto de pessoa — é preciso dizer quem revogou.' using errcode = 'check_violation';
    end if;
  elsif v_tipo is distinct from 'unidade' then
    raise exception 'Só a peça sai da produção, volta a ela, vai ao PCP ou é reaproveitada.' using errcode = 'check_violation';
  end if;
  if new.tipo = 'card_voltou_pcp' then
    if coalesce(new.dados ->> 'escolha', '') not in ('voltar', 'reposicao') then
      raise exception 'Escolha se a peça volta para o PCP ou vira reposição de estoque.' using errcode = 'check_violation';
    end if;
    if new.usuario_id is null then
      raise exception 'Mover para o PCP é gesto de pessoa — é preciso dizer quem moveu.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
comment on function plt_privado.fn_validar_fatos_sessao51() is
  'SESSAO-51: os fatos novos (a peça tirada da produção pela entrega parcial e a volta dela, o revogar da decisão, a peça devolvida ao PCP e a reaproveitada) só nascem pela maquinaria, cada bloco com a sua marca, e cada um no tipo de card certo.';
revoke all on function plt_privado.fn_validar_fatos_sessao51() from public, anon, authenticated;

drop trigger if exists plt_eventos_validar_sessao51 on public.plt_eventos;
create trigger plt_eventos_validar_sessao51
  before insert on public.plt_eventos
  for each row
  when (new.tipo in ('peca_retirada_entrega_parcial', 'peca_volta_entrega_parcial',
                     'entrega_parcial_decisao_revogada', 'card_voltou_pcp', 'peca_reaproveitada_pcp'))
  execute function plt_privado.fn_validar_fatos_sessao51();

-- A projeção dos fatos da 51 (e as colunas da entrega parcial do pedido_entregue).
-- O nome ordena DEPOIS de plt_eventos_projetar_entrega (o fecho do pedido) e
-- ANTES dos "zz" (as reações leem as marcas na mesma transação).
create or replace function plt_privado.fn_projetar_fatos_sessao51()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ent bigint;
begin
  if new.tipo = 'pedido_entregue' then
    -- a entrega PARCIAL: o "Entregue em parte (N de M)" e a decisão sobre a fábrica
    update public.plt_cards
       set parcial_evento_id   = new.id,
           parcial_em          = new.ocorrido_em,
           parcial_entregues   = coalesce(parcial_entregues, 0)
                                 + coalesce(jsonb_array_length(case when jsonb_typeof(new.dados -> 'entregues') = 'array'
                                                                    then new.dados -> 'entregues' end), 0),
           parcial_total       = coalesce(nullif(new.dados ->> 'total_pedido', '')::int, parcial_total),
           parcial_decisao     = case when new.dados ->> 'fabrica' in ('manter', 'limpar')
                                      then new.dados ->> 'fabrica' else parcial_decisao end,
           parcial_decisao_em  = case when new.dados ->> 'fabrica' in ('manter', 'limpar')
                                      then new.ocorrido_em else parcial_decisao_em end,
           parcial_decisao_evento_id = case when new.dados ->> 'fabrica' in ('manter', 'limpar')
                                            then new.id else parcial_decisao_evento_id end
     where id = new.card_id and tipo = 'pedido';
    -- "Limpar da produção": o que estava no PCP sai dele (a regra única — D-327)
    if new.dados ->> 'fabrica' = 'limpar' then
      update public.plt_cards
         set removido_pcp_em        = new.ocorrido_em,
             removido_pcp_motivo    = 'entrega_parcial',
             removido_pcp_texto     = null,
             removido_pcp_evento_id = new.id,
             pcp_aviso_em           = null
       where id = new.card_id and tipo = 'pedido' and removido_pcp_em is null;
    end if;

  elsif new.tipo = 'entrega_parcial_decisao_revogada' then
    v_ent := nullif(new.dados ->> 'entrega_evento_id', '')::bigint;
    update public.plt_cards
       set parcial_decisao           = new.dados ->> 'depois',
           parcial_decisao_em        = new.ocorrido_em,
           parcial_decisao_evento_id = new.id
     where id = new.card_id;
    if new.dados ->> 'depois' = 'limpar' then
      update public.plt_cards
         set removido_pcp_em        = new.ocorrido_em,
             removido_pcp_motivo    = 'entrega_parcial',
             removido_pcp_texto     = null,
             removido_pcp_evento_id = new.id,
             pcp_aviso_em           = null
       where id = new.card_id and removido_pcp_em is null;
      -- nada mais sobrou para entregar: o pedido fecha pela própria entrega parcial
      if coalesce((new.dados ->> 'fecha')::boolean, false) and v_ent is not null then
        update public.plt_cards c
           set entrega_evento_id = v_ent,
               entrega_em        = (select e.ocorrido_em from public.plt_eventos e where e.id = v_ent)
         where c.id = new.card_id and c.entrega_evento_id is null;
      end if;
    else
      update public.plt_cards
         set removido_pcp_em = null, removido_pcp_motivo = null, removido_pcp_texto = null,
             removido_pcp_evento_id = null
       where id = new.card_id and removido_pcp_motivo = 'entrega_parcial';
      -- o pedido que a entrega parcial tinha fechado volta a ficar vivo
      if v_ent is not null then
        update public.plt_cards
           set entrega_evento_id = null, entrega_em = null
         where id = new.card_id and entrega_evento_id = v_ent;
      end if;
    end if;

  elsif new.tipo = 'peca_retirada_entrega_parcial' then
    update public.plt_cards
       set retirada_parcial_em = new.ocorrido_em, retirada_parcial_evento_id = new.id
     where id = new.card_id;

  elsif new.tipo = 'peca_volta_entrega_parcial' then
    update public.plt_cards
       set retirada_parcial_em = null, retirada_parcial_evento_id = null
     where id = new.card_id;

  elsif new.tipo = 'card_voltou_pcp' then
    update public.plt_cards
       set voltou_pcp_em           = new.ocorrido_em,
           voltou_pcp_evento_id    = new.id,
           voltou_pcp_pedido_id    = nullif(new.dados ->> 'pedido_id', '')::bigint,
           voltou_pcp_reposicao_id = nullif(new.dados ->> 'reposicao_card_id', '')::bigint
     where id = new.card_id;

  elsif new.tipo = 'peca_reaproveitada_pcp' then
    update public.plt_cards
       set voltou_pcp_em = null, voltou_pcp_evento_id = null,
           voltou_pcp_pedido_id = null, voltou_pcp_reposicao_id = null
     where id = new.card_id;
  end if;
  return null;
end;
$$;
comment on function plt_privado.fn_projetar_fatos_sessao51() is
  'SESSAO-51: a projeção dos fatos — a entrega parcial e a decisão no card do pedido (o "Limpar" tira o pedido do PCP pela marca de remoção com o motivo entrega_parcial; o revogar troca a decisão, devolve ao PCP e reabre ou fecha o pedido), a peça tirada da produção e a que voltou, a peça devolvida ao PCP e a reaproveitada.';
revoke all on function plt_privado.fn_projetar_fatos_sessao51() from public, anon, authenticated;

drop trigger if exists plt_eventos_projetar_sessao51 on public.plt_eventos;
create trigger plt_eventos_projetar_sessao51
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('peca_retirada_entrega_parcial', 'peca_volta_entrega_parcial',
                     'entrega_parcial_decisao_revogada', 'card_voltou_pcp', 'peca_reaproveitada_pcp')
        or (new.tipo = 'pedido_entregue' and coalesce(new.dados ->> 'parcial', '') = 'true'))
  execute function plt_privado.fn_projetar_fatos_sessao51();
