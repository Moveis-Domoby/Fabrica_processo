-- ============================================================================
-- SESSAO-48 · BASE — cancelar a fabricação de verdade (frentes 1 e 4 inteiras)
-- e o que as frentes 2 (o aviso e a remoção no PCP) e 3 (o destino da peça de
-- pedido cancelado no Tiny) leem
-- ============================================================================
-- O vídeo do dono (10/11): a Estante Basic 7 nichos contava "2 reservados p/
-- produção" no Estoque, e as duas peças estavam na coluna CANCELADO da LIMPEZA
-- E EMBALAGEM havia 138 h. CANCELADO e NÃO ENCONTRADO eram etapas comuns — tudo
-- nelas contava como produção (53 das 127 peças em 11/11).
--
-- A regra nova (respostas do dono, 11/11 01:27 e 01:33 — sem botão novo):
--   · a etapa ganha o sinal CANCELA A FABRICAÇÃO (com o motivo: 'cancelada' ou
--     'nao_encontrada'), ligado no CANCELADO e no NÃO ENCONTRADO da LIMPEZA E
--     EMBALAGEM; o admin liga e desliga em Setores e etapas;
--   · a peça que CHEGA numa etapa dessas — por qualquer caminho: arrasto, tablet,
--     Mover, a liberação do PCP, a API — sai da produção na hora: o fato
--     fabricacao_cancelada nasce do FATO de chegada (gatilho) e projeta
--     cancelada_em no card; cancelar a peça não é cancelar o pedido;
--   · a peça de pedido vivo perde o pedido (unidade_desvinculada) e a vaga volta
--     ao PCP pela regra de sempre, com o aviso no card do pedido (pcp_aviso_em) e
--     o sino do PCP; a de reposição só perde a peça (a vaga segue liberada);
--   · ninguém inicia nem retoma peça cancelada (o banco recusa);
--   · arrastar de volta desfaz (fabricacao_retomada): com a vaga ainda aberta e o
--     pedido no PCP, a peça volta a ser do pedido; senão, volta sem dono;
--   · a coluna mostra só os últimos N dias (cancela_dias, padrão 7) e a rotina
--     da madrugada que já existe (a conferência com o Tiny) arquiva o resto, com
--     o motivo — nada é apagado; o admin recupera pela janela do card.
-- Para as frentes 2 e 3: os tipos de fato, a remoção do PCP dentro da regra
-- única do PCP (fn_fora_do_pcp) e a marca "esperando decisão" dentro da regra
-- única do que conta (fn_estoque_categoria).
--
-- Funções recriadas a partir da última versão das migrations (extração + trocas
-- conferidas uma a uma — E-24/A-97); o md5 do corpo vivo confere-se antes de
-- aplicar (A-96).
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Os tipos de fato novos (o validate mora AQUI agora — E-19; saiu da
--     20261109010000)
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
  'pedido_devolvido_pcp', 'destino_pendente', 'destino_decidido'
]::text[])) not valid;
alter table public.plt_eventos validate constraint plt_eventos_tipo_check;

-- ----------------------------------------------------------------------------
-- 2 · A etapa que cancela a fabricação (o sinal novo, no padrão de
--     conclui_producao) e quantos dias a peça fica à vista na coluna
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'plt_etapas'
                    and column_name = 'cancela_fabricacao') then
    alter table public.plt_etapas add column cancela_fabricacao boolean not null default false;
    alter table public.plt_etapas add column cancela_motivo text;
    alter table public.plt_etapas add column cancela_dias smallint not null default 7;
    -- O sinal nasce LIGADO no CANCELADO e no NÃO ENCONTRADO da LIMPEZA E
    -- EMBALAGEM (as etapas que o dono cadastrou em 29/08). Uma vez só: reaplicar
    -- a migration nunca religa o que o admin desligou depois.
    update public.plt_etapas e
       set cancela_fabricacao = true,
           cancela_motivo = case when upper(translate(btrim(e.nome), 'ÃÁÀÂÄãáàâä', 'AAAAAaaaaa')) = 'CANCELADO'
                                 then 'cancelada' else 'nao_encontrada' end
      from public.plt_setores s
     where s.id = e.setor_id and s.codigo = 'limpeza_embalagem'
       and not e.eh_fila and not e.eh_danificado and not e.conclui_producao and e.setor_destino_id is null
       and upper(translate(btrim(e.nome), 'ÃÁÀÂÄãáàâä', 'AAAAAaaaaa')) in ('CANCELADO', 'NAO ENCONTRADO');
  end if;
end;
$$;

alter table public.plt_etapas drop constraint if exists plt_etapas_cancela_ck;
alter table public.plt_etapas add constraint plt_etapas_cancela_ck check (
  (not cancela_fabricacao and cancela_motivo is null)
  -- (coalesce: com o motivo nulo, o "in" daria nulo e o check deixaria passar)
  or (cancela_fabricacao and coalesce(cancela_motivo, '') in ('cancelada', 'nao_encontrada')
      and not eh_fila and not eh_danificado and not conclui_producao and setor_destino_id is null)
) not valid;
alter table public.plt_etapas validate constraint plt_etapas_cancela_ck;

alter table public.plt_etapas drop constraint if exists plt_etapas_cancela_dias_ck;
alter table public.plt_etapas add constraint plt_etapas_cancela_dias_ck
  check (cancela_dias between 1 and 90) not valid;
alter table public.plt_etapas validate constraint plt_etapas_cancela_dias_ck;

comment on column public.plt_etapas.cancela_fabricacao is
  'SESSAO-48: soltar a PEÇA aqui cancela a fabricação dela (sai da produção na hora; a de pedido vivo perde o pedido e a vaga volta ao PCP com aviso). Ligado no CANCELADO e no NÃO ENCONTRADO da LIMPEZA E EMBALAGEM; o admin liga/desliga em Setores e etapas. Não convive com fila, DANIFICADO, "conclui a produção" nem "manda para".';
comment on column public.plt_etapas.cancela_motivo is
  'SESSAO-48: o motivo que a peça leva ao chegar — ''cancelada'' (Fabricação cancelada) ou ''nao_encontrada'' (Peça não encontrada). Nulo quando a etapa não cancela.';
comment on column public.plt_etapas.cancela_dias is
  'SESSAO-48 (D-provisória): quantos dias a peça cancelada fica à vista na coluna (padrão 7). Depois, a rotina da madrugada a arquiva com o motivo (nada é apagado; o admin recupera).';

-- ----------------------------------------------------------------------------
-- 3 · As projeções no card (escritas SÓ pelos gatilhos dos fatos — M-13)
-- ----------------------------------------------------------------------------
-- na peça: a fabricação cancelada (frentes 1 e 4)
alter table public.plt_cards add column if not exists cancelada_em timestamptz;
alter table public.plt_cards add column if not exists cancelada_motivo text;
alter table public.plt_cards add column if not exists cancelada_pedido_id bigint;
-- no card do pedido: o aviso da vaga que voltou e a remoção do PCP (frente 2)
alter table public.plt_cards add column if not exists pcp_aviso_em timestamptz;
alter table public.plt_cards add column if not exists removido_pcp_em timestamptz;
alter table public.plt_cards add column if not exists removido_pcp_motivo text;
alter table public.plt_cards add column if not exists removido_pcp_texto text;
alter table public.plt_cards add column if not exists removido_pcp_evento_id bigint;
-- na peça de pedido cancelado no Tiny: esperando a decisão da logística (frente 3)
alter table public.plt_cards add column if not exists destino_pendente_em timestamptz;

alter table public.plt_cards drop constraint if exists plt_cards_cancelada_ck;
alter table public.plt_cards add constraint plt_cards_cancelada_ck check (
  (cancelada_em is null and cancelada_motivo is null and cancelada_pedido_id is null)
  or (cancelada_em is not null and coalesce(cancelada_motivo, '') in ('cancelada', 'nao_encontrada'))
) not valid;
alter table public.plt_cards validate constraint plt_cards_cancelada_ck;

alter table public.plt_cards drop constraint if exists plt_cards_removido_pcp_ck;
alter table public.plt_cards add constraint plt_cards_removido_pcp_ck check (
  (removido_pcp_em is null and removido_pcp_motivo is null and removido_pcp_texto is null
   and removido_pcp_evento_id is null)
  or (removido_pcp_em is not null
      and coalesce(removido_pcp_motivo, '') in ('pedido_cancelado', 'fora_da_linha', 'outro'))
) not valid;
alter table public.plt_cards validate constraint plt_cards_removido_pcp_ck;

alter table public.plt_cards drop constraint if exists plt_cards_cancelada_pedido_fk;
alter table public.plt_cards add constraint plt_cards_cancelada_pedido_fk
  foreign key (cancelada_pedido_id) references public.pedidos(id) not valid;
alter table public.plt_cards validate constraint plt_cards_cancelada_pedido_fk;

-- A trava "uma peça por vaga" das peças SEM pedido (feita para a reposição — a mesma
-- vaga não nasce duas vezes) não vale para a peça cancelada: cancelar, liberar de novo
-- a mesma vaga e cancelar outra vez são duas peças sem pedido no mesmo lugar (E-256).
drop index if exists public.plt_cards_unidade_reposicao_uq;
create unique index plt_cards_unidade_reposicao_uq
  on public.plt_cards (card_pai_id, item_seq, indice_unidade)
  where tipo = 'unidade' and pedido_id is null and cancelada_pedido_id is null;

-- A coluna que cancela lê os últimos N dias e a rotina da madrugada acha o que
-- passou do prazo — pelo mesmo índice (Lei §7.2: parcial, no recorte usado).
create index if not exists plt_cards_cancelada_idx
  on public.plt_cards (etapa_atual_id, cancelada_em)
  where cancelada_em is not null and arquivado_em is null;
-- As peças canceladas de um pedido (o aviso no PCP e a janela "O que aconteceu?") e a chave estrangeira.
create index if not exists plt_cards_cancelada_pedido_idx
  on public.plt_cards (cancelada_pedido_id)
  where cancelada_pedido_id is not null;
-- A aba "Cancelados e removidos" do PCP (lista por cursor — frente 2).
create index if not exists plt_cards_removido_pcp_idx
  on public.plt_cards (removido_pcp_em desc, id desc)
  where removido_pcp_em is not null;
-- As peças esperando decisão de um pedido cancelado no Tiny (frente 3).
create index if not exists plt_cards_destino_pendente_idx
  on public.plt_cards (pedido_id)
  where destino_pendente_em is not null;

comment on column public.plt_cards.cancelada_em is
  'SESSAO-48: desde quando a fabricação desta peça está cancelada (chegou numa etapa que cancela — CANCELADO / NÃO ENCONTRADO). Projeção do fato fabricacao_cancelada; nulo de novo com fabricacao_retomada. Peça cancelada não conta em nada (fn_estoque_categoria) e ninguém a inicia.';
comment on column public.plt_cards.cancelada_motivo is
  'SESSAO-48: ''cancelada'' ou ''nao_encontrada'' — o motivo da etapa onde a peça chegou.';
comment on column public.plt_cards.cancelada_pedido_id is
  'SESSAO-48: o pedido que a peça perdeu ao ser cancelada (a vaga voltou ao PCP). Serve para a peça voltar ao pedido se for retomada com a vaga aberta, e para o aviso e a janela do PCP.';
comment on column public.plt_cards.pcp_aviso_em is
  'SESSAO-48: no card do PEDIDO — desde quando há peça dele cancelada na produção que o PCP ainda não viu (o selo e a janela "O que aconteceu?"). Fecha com pcp_aviso_resolvido ("Produzir de novo"), pedido_removido_pcp, a liberação completa do pedido ou a peça que volta ao pedido.';
comment on column public.plt_cards.removido_pcp_em is
  'SESSAO-48: no card do PEDIDO — o PCP tirou o pedido da linha de produção (fato pedido_removido_pcp). Fora de todas as portas do PCP pela regra única (fn_fora_do_pcp); volta com pedido_devolvido_pcp. Não muda o Tiny nem as peças já feitas.';
comment on column public.plt_cards.removido_pcp_motivo is
  'SESSAO-48: ''pedido_cancelado'' · ''fora_da_linha'' (tirar da linha de produção) · ''outro''.';
comment on column public.plt_cards.removido_pcp_texto is
  'SESSAO-48: o que houve (obrigatório em ''fora_da_linha'' e ''outro'').';
comment on column public.plt_cards.removido_pcp_evento_id is
  'SESSAO-48: o fato pedido_removido_pcp vigente (quem removeu e quando).';
comment on column public.plt_cards.destino_pendente_em is
  'SESSAO-48 (frente 3): na PEÇA de pedido cancelado no Tiny que estava em produção — desde quando espera a logística decidir o destino. Não conta como produção de pedido; fecha com destino_decidido.';

-- ----------------------------------------------------------------------------
-- 4 · A regra única do que conta (Estoque, Top 20, "reservados p/ produção"):
--     a peça cancelada e a que espera decisão ficam SEM categoria
-- ----------------------------------------------------------------------------
-- A assinatura ganha dois argumentos (a de 6 sai no fim desta seção — os quatro
-- leitores são recriados aqui com a nova).
create or replace function plt_privado.fn_estoque_categoria(
  p_pedido_id bigint, p_reservada_pedido_id bigint, p_concluido_em timestamptz,
  p_arquivado_em timestamptz, p_setor_codigo text, p_setor_papel text,
  p_cancelada_em timestamptz, p_destino_pendente_em timestamptz)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
           when p_arquivado_em is not null then null
           -- SESSAO-48: a fabricação cancelada (CANCELADO / NÃO ENCONTRADO) e a peça
           -- de pedido cancelado no Tiny esperando a decisão da logística não contam
           -- em nada — nem "reservados p/ produção", nem o Top 20.
           when p_cancelada_em is not null or p_destino_pendente_em is not null then null
           -- SESSAO-31 (D-129): a peça devolvida espera a decisão da logística.
           when p_setor_codigo = 'devolucao' then 'devolucao'
           when p_pedido_id is null and p_setor_codigo = 'estoque'
             then case when p_reservada_pedido_id is null then 'livre' else 'reservada_estoque' end
           -- pronta de pedido = num fim de linha (aguardo; ROTAS até a entrega — D-118;
           -- o ESTOQUE só tem peça de pedido no legado de antes da D-58)
           when p_pedido_id is not null and p_setor_papel = 'terminal' then 'pronta_pedido'
           when p_concluido_em is null and p_setor_papel is distinct from 'terminal'
             then case when p_pedido_id is null then 'producao_sem_dono' else 'producao_de_pedido' end
         end;
$$;

comment on function plt_privado.fn_estoque_categoria(bigint, bigint, timestamptz, timestamptz, text, text, timestamptz, timestamptz) is
  'A categoria da peça nos números do estoque (livre, reservada, pronta de pedido, produção sem dono / de pedido, devolução). SESSAO-48: a peça com a fabricação cancelada e a que espera a decisão do destino (pedido cancelado no Tiny) ficam sem categoria — saem de todas as contas.';
revoke all on function plt_privado.fn_estoque_categoria(bigint, bigint, timestamptz, timestamptz, text, text, timestamptz, timestamptz)
  from public, anon, authenticated;

-- Os quatro leitores (o gatilho de inserção, o de alteração, o de exclusão e o
-- recontar) — recriados da versão vigente com os dois argumentos novos.

-- (recriada da vigente em 20261014130000_plt_devolucao_decidida.sql)
create or replace function plt_privado.fn_estoque_numeros_cards()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.plt_estoque_numeros as n
      (produto_tiny_id, livres, reservadas_estoque, prontas_pedido, producao_sem_dono,
       producao_de_pedido, em_devolucao, atualizado_em)
  select x.produto,
         coalesce(sum(x.d) filter (where x.categoria = 'livre'), 0),
         coalesce(sum(x.d) filter (where x.categoria = 'reservada_estoque'), 0),
         coalesce(sum(x.d) filter (where x.categoria = 'pronta_pedido'), 0),
         coalesce(sum(x.d) filter (where x.categoria = 'producao_sem_dono'), 0),
         coalesce(sum(x.d) filter (where x.categoria = 'producao_de_pedido'), 0),
         coalesce(sum(x.d) filter (where x.categoria = 'devolucao'), 0),
         now()
    from (
      -- INSERT e UPDATE: as linhas novas entram (+1)
      select plt_privado.fn_estoque_produto_da_peca(c.pedido_id, c.produto_tiny_id, c.item_codigo, c.item_descricao) as produto,
             plt_privado.fn_estoque_categoria(c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em,
                                              s.codigo, s.papel_no_fluxo, c.cancelada_em, c.destino_pendente_em) as categoria,
             1 as d
        from novos c left join public.plt_setores s on s.id = c.setor_atual_id
       where tg_op in ('INSERT', 'UPDATE') and c.tipo = 'unidade'
      union all
      -- UPDATE e DELETE: as linhas velhas saem (-1)
      select plt_privado.fn_estoque_produto_da_peca(c.pedido_id, c.produto_tiny_id, c.item_codigo, c.item_descricao),
             plt_privado.fn_estoque_categoria(c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em,
                                              s.codigo, s.papel_no_fluxo, c.cancelada_em, c.destino_pendente_em),
             -1
        from velhos c left join public.plt_setores s on s.id = c.setor_atual_id
       where tg_op in ('UPDATE', 'DELETE') and c.tipo = 'unidade'
    ) x
   where x.produto is not null and x.categoria is not null
   group by x.produto
  having coalesce(sum(x.d) filter (where x.categoria = 'livre'), 0) <> 0
      or coalesce(sum(x.d) filter (where x.categoria = 'reservada_estoque'), 0) <> 0
      or coalesce(sum(x.d) filter (where x.categoria = 'pronta_pedido'), 0) <> 0
      or coalesce(sum(x.d) filter (where x.categoria = 'producao_sem_dono'), 0) <> 0
      or coalesce(sum(x.d) filter (where x.categoria = 'producao_de_pedido'), 0) <> 0
      or coalesce(sum(x.d) filter (where x.categoria = 'devolucao'), 0) <> 0
   order by x.produto
  on conflict (produto_tiny_id) do update
     set livres             = n.livres             + excluded.livres,
         reservadas_estoque = n.reservadas_estoque + excluded.reservadas_estoque,
         prontas_pedido     = n.prontas_pedido     + excluded.prontas_pedido,
         producao_sem_dono  = n.producao_sem_dono  + excluded.producao_sem_dono,
         producao_de_pedido = n.producao_de_pedido + excluded.producao_de_pedido,
         em_devolucao       = n.em_devolucao       + excluded.em_devolucao,
         atualizado_em      = now();
  return null;
end;
$$;

-- (recriada da vigente em 20261014130000_plt_devolucao_decidida.sql)
create or replace function plt_privado.fn_estoque_numeros_cards_ins()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.plt_estoque_numeros as n
      (produto_tiny_id, livres, reservadas_estoque, prontas_pedido, producao_sem_dono,
       producao_de_pedido, em_devolucao, atualizado_em)
  select x.produto,
         count(*) filter (where x.categoria = 'livre'),
         count(*) filter (where x.categoria = 'reservada_estoque'),
         count(*) filter (where x.categoria = 'pronta_pedido'),
         count(*) filter (where x.categoria = 'producao_sem_dono'),
         count(*) filter (where x.categoria = 'producao_de_pedido'),
         count(*) filter (where x.categoria = 'devolucao'),
         now()
    from (select plt_privado.fn_estoque_produto_da_peca(c.pedido_id, c.produto_tiny_id, c.item_codigo, c.item_descricao) as produto,
                 plt_privado.fn_estoque_categoria(c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em,
                                                  s.codigo, s.papel_no_fluxo, c.cancelada_em, c.destino_pendente_em) as categoria
            from novos c left join public.plt_setores s on s.id = c.setor_atual_id
           where c.tipo = 'unidade') x
   where x.produto is not null and x.categoria is not null
   group by x.produto
   order by x.produto
  on conflict (produto_tiny_id) do update
     set livres             = n.livres             + excluded.livres,
         reservadas_estoque = n.reservadas_estoque + excluded.reservadas_estoque,
         prontas_pedido     = n.prontas_pedido     + excluded.prontas_pedido,
         producao_sem_dono  = n.producao_sem_dono  + excluded.producao_sem_dono,
         producao_de_pedido = n.producao_de_pedido + excluded.producao_de_pedido,
         em_devolucao       = n.em_devolucao       + excluded.em_devolucao,
         atualizado_em      = now();
  return null;
end;
$$;

-- (recriada da vigente em 20261014130000_plt_devolucao_decidida.sql)
create or replace function plt_privado.fn_estoque_numeros_cards_del()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.plt_estoque_numeros as n
      (produto_tiny_id, livres, reservadas_estoque, prontas_pedido, producao_sem_dono,
       producao_de_pedido, em_devolucao, atualizado_em)
  select x.produto,
         -count(*) filter (where x.categoria = 'livre'),
         -count(*) filter (where x.categoria = 'reservada_estoque'),
         -count(*) filter (where x.categoria = 'pronta_pedido'),
         -count(*) filter (where x.categoria = 'producao_sem_dono'),
         -count(*) filter (where x.categoria = 'producao_de_pedido'),
         -count(*) filter (where x.categoria = 'devolucao'),
         now()
    from (select plt_privado.fn_estoque_produto_da_peca(c.pedido_id, c.produto_tiny_id, c.item_codigo, c.item_descricao) as produto,
                 plt_privado.fn_estoque_categoria(c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em,
                                                  s.codigo, s.papel_no_fluxo, c.cancelada_em, c.destino_pendente_em) as categoria
            from velhos c left join public.plt_setores s on s.id = c.setor_atual_id
           where c.tipo = 'unidade') x
   where x.produto is not null and x.categoria is not null
   group by x.produto
   order by x.produto
  on conflict (produto_tiny_id) do update
     set livres             = n.livres             + excluded.livres,
         reservadas_estoque = n.reservadas_estoque + excluded.reservadas_estoque,
         prontas_pedido     = n.prontas_pedido     + excluded.prontas_pedido,
         producao_sem_dono  = n.producao_sem_dono  + excluded.producao_sem_dono,
         producao_de_pedido = n.producao_de_pedido + excluded.producao_de_pedido,
         em_devolucao       = n.em_devolucao       + excluded.em_devolucao,
         atualizado_em      = now();
  return null;
end;
$$;

-- (recriada da vigente em 20261014130000_plt_devolucao_decidida.sql)
create or replace function plt_privado.fn_estoque_numeros_recontar()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  lock table public.plt_estoque_numeros in exclusive mode;
  insert into public.plt_estoque_numeros (produto_tiny_id)
  select pr.tiny_id from public.produtos pr
  on conflict (produto_tiny_id) do nothing;

  with contagem as (
    select x.produto,
           count(*) filter (where x.categoria = 'livre')::int              as livres,
           count(*) filter (where x.categoria = 'reservada_estoque')::int  as reservadas_estoque,
           count(*) filter (where x.categoria = 'pronta_pedido')::int      as prontas_pedido,
           count(*) filter (where x.categoria = 'producao_sem_dono')::int  as producao_sem_dono,
           count(*) filter (where x.categoria = 'producao_de_pedido')::int as producao_de_pedido,
           count(*) filter (where x.categoria = 'devolucao')::int          as em_devolucao
      from (select plt_privado.fn_estoque_produto_da_peca(c.pedido_id, c.produto_tiny_id, c.item_codigo, c.item_descricao) as produto,
                   plt_privado.fn_estoque_categoria(c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em,
                                                    s.codigo, s.papel_no_fluxo, c.cancelada_em, c.destino_pendente_em) as categoria
              from public.plt_cards c
              left join public.plt_setores s on s.id = c.setor_atual_id
             where c.tipo = 'unidade' and c.arquivado_em is null) x
     where x.produto is not null and x.categoria is not null
     group by x.produto
  ),
  alvo as (
    select n.produto_tiny_id,
           coalesce(c.livres, 0) as livres, coalesce(c.reservadas_estoque, 0) as reservadas_estoque,
           coalesce(c.prontas_pedido, 0) as prontas_pedido, coalesce(c.producao_sem_dono, 0) as producao_sem_dono,
           coalesce(c.producao_de_pedido, 0) as producao_de_pedido, coalesce(c.em_devolucao, 0) as em_devolucao
      from public.plt_estoque_numeros n
      left join contagem c on c.produto = n.produto_tiny_id
  )
  update public.plt_estoque_numeros n
     set livres = a.livres, reservadas_estoque = a.reservadas_estoque, prontas_pedido = a.prontas_pedido,
         producao_sem_dono = a.producao_sem_dono, producao_de_pedido = a.producao_de_pedido,
         em_devolucao = a.em_devolucao, atualizado_em = now()
    from alvo a
   where n.produto_tiny_id = a.produto_tiny_id
     and (n.livres, n.reservadas_estoque, n.prontas_pedido, n.producao_sem_dono, n.producao_de_pedido, n.em_devolucao)
         is distinct from (a.livres, a.reservadas_estoque, a.prontas_pedido, a.producao_sem_dono, a.producao_de_pedido, a.em_devolucao);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- (recriada da vigente em 20261014130000_plt_devolucao_decidida.sql)
create or replace function plt_privado.fn_estoque_contar(p_produto bigint)
returns table (livres integer, reservadas_estoque integer, prontas_pedido integer,
               producao_sem_dono integer, producao_de_pedido integer, em_devolucao integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with dono as (
    select pr.codigo
      from public.produtos pr
     where pr.tiny_id = p_produto
       and pr.codigo is not null
       and pr.tiny_id = (select min(p2.tiny_id) from public.produtos p2
                          where p2.codigo = pr.codigo and p2.situacao = 'A')
  ),
  pecas as (
    select c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em, c.setor_atual_id,
           c.cancelada_em, c.destino_pendente_em   -- SESSAO-48
      from public.plt_cards c
     where c.tipo = 'unidade' and c.arquivado_em is null and c.pedido_id is null
       and c.produto_tiny_id = p_produto
       and not plt_privado.fn_eh_personalizado(c.item_descricao)
    union all
    select c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em, c.setor_atual_id,
           c.cancelada_em, c.destino_pendente_em   -- SESSAO-48
      from public.plt_cards c, dono d
     where c.tipo = 'unidade' and c.arquivado_em is null and c.pedido_id is not null
       and c.item_codigo = d.codigo
       and not plt_privado.fn_eh_personalizado(c.item_descricao)
  ),
  cat as (
    select plt_privado.fn_estoque_categoria(p.pedido_id, p.reservada_pedido_id, p.concluido_em,
                                            p.arquivado_em, s.codigo, s.papel_no_fluxo,
                                            p.cancelada_em, p.destino_pendente_em) as categoria
      from pecas p left join public.plt_setores s on s.id = p.setor_atual_id
  )
  select count(*) filter (where categoria = 'livre')::int,
         count(*) filter (where categoria = 'reservada_estoque')::int,
         count(*) filter (where categoria = 'pronta_pedido')::int,
         count(*) filter (where categoria = 'producao_sem_dono')::int,
         count(*) filter (where categoria = 'producao_de_pedido')::int,
         count(*) filter (where categoria = 'devolucao')::int
    from cat;
$$;

-- a de 6 argumentos sai (ninguém mais a chama)
drop function if exists plt_privado.fn_estoque_categoria(bigint, bigint, timestamptz, timestamptz, text, text);

-- ----------------------------------------------------------------------------
-- 5 · A regra única do PCP ganha "e não foi removido do PCP" (frente 2 — D-75:
--     uma regra só para todas as portas do PCP)
-- ----------------------------------------------------------------------------
-- O resumo do aviso no card do pedido (o selo do PCP): quantas peças canceladas
-- desde que o aviso abriu e qual o motivo (se todas são "não encontrada", o selo
-- diz isso; senão, "cancelada na produção").
create or replace function plt_privado.fn_pcp_aviso_resumo(p_card_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'desde', pc.pcp_aviso_em,
           'pecas', count(u.id)::int,
           'motivo', case when count(u.id) > 0 and bool_and(u.cancelada_motivo = 'nao_encontrada')
                          then 'nao_encontrada' else 'cancelada' end)
    from public.plt_cards pc
    left join public.plt_cards u
           on u.cancelada_pedido_id = pc.pedido_id and u.tipo = 'unidade'
          and u.cancelada_em is not null and u.cancelada_em >= pc.pcp_aviso_em
   where pc.id = p_card_id and pc.pcp_aviso_em is not null
   group by pc.pcp_aviso_em;
$$;

comment on function plt_privado.fn_pcp_aviso_resumo(bigint) is
  'SESSAO-48 (frente 2): o selo "Peça cancelada na produção" / "Peça não encontrada" do pedido no PCP — desde quando, quantas peças e o motivo. Nulo sem aviso.';
revoke all on function plt_privado.fn_pcp_aviso_resumo(bigint) from public, anon, authenticated;

-- A regra (D-132 + a marca de devolvido da SESSAO-47 + a remoção da SESSAO-48):
-- o pedido que o PCP removeu fica fora, qualquer que seja a situação no Tiny.
create or replace function plt_privado.fn_fora_do_pcp(p_situacao text, p_volta_em timestamptz, p_removido_em timestamptz)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select p_removido_em is not null
      or case plt_privado.fn_situacao_normalizada(p_situacao)
           -- o Tiny levou adiante: fora, a não ser que a plataforma o tenha devolvido
           when 'faturado'          then p_volta_em is null
           when 'pronto_para_envio' then p_volta_em is null
           when 'enviado'           then p_volta_em is null
           -- encerrado no Tiny: fora sempre
           when 'entregue'          then true
           when 'nao_entregue'      then true
           when 'cancelado'         then true
           else false
         end;
$$;

comment on function plt_privado.fn_fora_do_pcp(text, timestamptz, timestamptz) is
  'A regra única do PCP: D-132 (o PCP segue o Tiny — fn_tiny_tirou_do_pcp) + a marca de devolvido ao PCP (SESSAO-47) + a remoção do PCP pelo PCP (SESSAO-48: pedido_removido_pcp). Lida por todas as portas do PCP (quadro, contagem, quadrinho do painel, aba Stand-by, pôr em stand-by) e pelo rótulo da lista de pedidos.';
revoke all on function plt_privado.fn_fora_do_pcp(text, timestamptz, timestamptz) from public, anon, authenticated;

-- As portas que a leem — recriadas da versão vigente com o 3º argumento.

-- (recriada da vigente em 20261109020000_plt_pedido_adiantado_tiny.sql)
CREATE OR REPLACE FUNCTION public.plt_fn_pcp_quadro(p_limite integer DEFAULT 10, p_deslocamento integer DEFAULT 0, p_grupo text DEFAULT NULL::text, p_ordem text DEFAULT NULL::text, p_filtro text DEFAULT NULL::text)
 RETURNS TABLE(id bigint, tipo text, pedido_id bigint, card_pai_id bigint, item_seq integer, item_codigo text, item_descricao text, indice_unidade integer, total_unidades integer, setor_atual_id bigint, etapa_atual_id bigint, desde timestamp with time zone, executor_atual_id uuid, responsavel_id uuid, delegado_em timestamp with time zone, qualidade_atual text, concluido_em timestamp with time zone, pausado_em timestamp with time zone, liberado_completo_em timestamp with time zone, pecas_estoque integer, contagem_total bigint, etiquetas bigint[], pedido_resumo jsonb, prioridade text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with m as (select plt_privado.fn_ordem_do_quadro(p_ordem) as modo),
  f as (select * from plt_privado.fn_filtro_do_quadro(p_filtro)),
  base as (
    select c.id, c.desde, c.prioridade, p.numero, plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista,
           lower(translate(btrim(coalesce(case when c.tipo = 'pedido' then cl.nome else c.item_descricao end, '')),
                           'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
                           'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')) as nome
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
      left join public.pedidos p on p.id = c.pedido_id
      left join public.clientes cl on cl.id = p.cliente_id
     -- o MESMO filtro de plt_fn_cards_pedido_pcp (D-75: painel = quadro)
     where (select plt_privado.fn_usuario_atual()) is not null
       and ((select plt_privado.fn_eh_admin())
            or c.setor_atual_id in (select plt_privado.fn_setores_do_usuario()))
       and c.tipo in ('pedido', 'reposicao')
       -- SESSAO-38 (D-169): o MESMO filtro de plt_fn_cards_pedido_pcp (o grupo 'standby')
       and (case when p_grupo = 'standby' then c.tipo = 'pedido' and c.standby_desde is not null
                 else (p_grupo is null or c.tipo = p_grupo) and c.standby_desde is null end)
       and c.arquivado_em is null
       and c.liberado_completo_em is null
       and (c.tipo = 'reposicao'
            or (p.id is not null
                -- SESSAO-47: D-132 + a marca de devolvido ao PCP (a regra única)
                and not plt_privado.fn_fora_do_pcp(p.situacao, c.volta_pcp_em, c.removido_pcp_em)
                and exists (select 1 from plt_privado.vw_itens_producao v
                             where v.pedido_id = p.id and v.unidades > 0)))
  ),
  chaves as (
    select b.id,
           case (select modo from m)
             when 'prioridade' then case b.prioridade when 'urgente' then 0 when 'atencao' then 1 else 2 end
             else case when b.prioridade = 'urgente' then 0 else 1 end
           end as k1,
           (case (select modo from m)
              when 'entrega' then to_char(coalesce(b.data_prevista, date '9999-12-31'), 'YYYYMMDD')
              when 'alfabetica' then (case when b.nome ~ '^[a-z]' then '0' when b.nome ~ '^[0-9]' then '1' else '2' end) || b.nome
              else '' end) collate "C" as k2,
           case (select modo from m) when 'entrega' then coalesce(b.numero, 2147483647) else 0 end as k3,
           coalesce(b.desde, 'infinity'::timestamptz) as k4,
           count(*) over () as total
      from base b
     -- SESSAO-40 (D-187): o filtro do PCP — o nº do pedido que começa com o
     -- texto, ou o nome que o contém (o cliente no card do pedido; o móvel na
     -- reposição — o mesmo nome da ordem alfabética). O total conta só os que batem.
     where (not (select ativo from f)
            or case when (select numero from f) is not null
                    then b.numero::text like (select numero from f) || '%'
                    else translate(b.nome, ' ' || chr(9) || chr(10) || chr(13), '')
                           like '%' || (select nome from f) || '%' end)
  ),
  pagina as (
    select k.id, k.total, row_number() over (order by k.k1, k.k2, k.k3, k.k4, k.id) as ord
      from chaves k
     order by k.k1, k.k2, k.k3, k.k4, k.id
     limit least(greatest(coalesce(p_limite, 10), 1), 100)
    offset greatest(coalesce(p_deslocamento, 0), 0)
  ),
  resumos as (
    select r.pedido_id, to_jsonb(r) - 'contagem_total' as resumo
      from public.plt_fn_pedidos_kanban(
             null, false,
             coalesce((select array_agg(distinct c.pedido_id)
                         from pagina pg join public.plt_cards c on c.id = pg.id
                        where c.pedido_id is not null), '{}'),
             100, 0) r
  )
  select c.id, c.tipo, c.pedido_id, c.card_pai_id, c.item_seq, c.item_codigo,
         c.item_descricao, c.indice_unidade, c.total_unidades, c.setor_atual_id,
         c.etapa_atual_id, c.desde, c.executor_atual_id, c.responsavel_id,
         c.delegado_em, c.qualidade_atual, c.concluido_em, c.pausado_em,
         c.liberado_completo_em,
         pe.n as pecas_estoque,
         pg.total as contagem_total,
         coalesce(c.etiquetas, '{}'),
         -- SESSAO-38 (D-167/D-169): o stand-by do pedido no resumo (o relógio do
         -- PCP desconta; a aba Stand-by mostra o motivo, desde quando e quem pôs)
         case when c.tipo = 'pedido' then coalesce(r.resumo, '{}'::jsonb) || jsonb_build_object(
                'standby_desde', c.standby_desde, 'standby_motivo', c.standby_motivo,
                'standby_periodos', c.standby_periodos,
                -- SESSAO-45: quantas das peças do estoque já estão RESERVADAS para este pedido
                'pecas_reservadas', pe.r,
                'standby_por', (select u.nome from public.plt_eventos e
                                  join public.plt_usuarios u on u.id = e.usuario_id
                                 where e.id = c.standby_evento_id))
                -- SESSAO-47: o pedido que a logística devolveu ao PCP e o Tiny ainda não mostrou a situação nova
                || case when c.volta_pcp_em is null then '{}'::jsonb
                        else jsonb_build_object('volta_pcp', plt_privado.fn_volta_pcp_resumo(c.id)) end
                -- SESSAO-48 (frente 2): a peça cancelada na produção — o selo e a janela "O que aconteceu?"
                || case when c.pcp_aviso_em is null then '{}'::jsonb
                        else jsonb_build_object('aviso_cancelada', plt_privado.fn_pcp_aviso_resumo(c.id)) end
              else r.resumo end,
         c.prioridade
    from pagina pg
    join public.plt_cards c on c.id = pg.id
    left join resumos r on r.pedido_id = c.pedido_id
    -- as peças do galpão que atendem o pedido (a mesma conta de
    -- plt_fn_cards_pedido_pcp), só para os cards da página
    -- SESSAO-45 (o PCP "mentindo" sobre o estoque — vídeo do dono, 04/11): a conta
    -- antiga somava TODA peça livre do mesmo SKU a TODO pedido que tinha o item, sem
    -- limite — 5 livres apareciam como "5 no estoque" em cada um dos pedidos, mesmo o
    -- que precisa de 1. Agora, por item: no máximo o que ainda FALTA liberar dele, e
    -- as reservadas para ESTE pedido vêm à parte (r) — a tela diz "reservada(s)" e
    -- "livre(s)", as mesmas palavras do cartão do Estoque.
    cross join lateral (
      select case when c.tipo <> 'pedido' then 0
                  else coalesce(sum(least(nec.falta, nec.reservadas + nec.livres)), 0)::int end as n,
             case when c.tipo <> 'pedido' then 0
                  else coalesce(sum(least(nec.falta, nec.reservadas)), 0)::int end as r
        from (
          select greatest(it.unidades - (select count(*) from public.plt_cards u
                                          where u.pedido_id = c.pedido_id and u.tipo = 'unidade'
                                            and u.item_codigo = it.codigo), 0)::int as falta,
                 (select count(*)::int
                    from public.plt_cards u
                    join public.plt_setores se on se.id = u.setor_atual_id and se.codigo = 'estoque'
                   where u.tipo = 'unidade' and u.pedido_id is null and u.arquivado_em is null
                     and u.reservada_pedido_id = c.pedido_id and u.item_codigo = it.codigo) as reservadas,
                 (select count(*)::int
                    from public.plt_cards u
                    join public.plt_setores se on se.id = u.setor_atual_id and se.codigo = 'estoque'
                   where u.tipo = 'unidade' and u.pedido_id is null and u.arquivado_em is null
                     and u.reservada_pedido_id is null and u.item_codigo = it.codigo
                     and not plt_privado.fn_eh_personalizado(u.item_descricao)) as livres
            from (select v.codigo, sum(v.unidades)::int as unidades
                    from plt_privado.vw_itens_producao v
                   where c.tipo = 'pedido' and v.pedido_id = c.pedido_id and v.unidades > 0
                     and v.codigo is not null and not plt_privado.fn_eh_personalizado(v.descricao)
                   group by v.codigo) it
        ) nec
    ) pe
   order by pg.ord;
$function$;

-- (recriada da vigente em 20261109020000_plt_pedido_adiantado_tiny.sql)
create or replace function public.plt_fn_cards_pedido_pcp(
  p_limite       integer default 10,
  p_deslocamento integer default 0,
  p_grupo        text    default null   -- null = tudo | 'pedido' | 'reposicao'
)
returns table (
  id                   bigint,
  tipo                 text,
  pedido_id            bigint,
  card_pai_id          bigint,
  item_seq             integer,
  item_codigo          text,
  item_descricao       text,
  indice_unidade       integer,
  total_unidades       integer,
  setor_atual_id       bigint,
  etapa_atual_id       bigint,
  desde                timestamptz,
  executor_atual_id    uuid,
  responsavel_id       uuid,
  delegado_em          timestamptz,
  qualidade_atual      text,
  concluido_em         timestamptz,
  pausado_em           timestamptz,
  liberado_completo_em timestamptz,
  pecas_estoque        integer,
  contagem_total       bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.tipo, c.pedido_id, c.card_pai_id, c.item_seq, c.item_codigo,
         c.item_descricao, c.indice_unidade, c.total_unidades, c.setor_atual_id,
         c.etapa_atual_id, c.desde, c.executor_atual_id, c.responsavel_id,
         c.delegado_em, c.qualidade_atual, c.concluido_em, c.pausado_em,
         c.liberado_completo_em,
         pe.n as pecas_estoque,
         count(*) over ()::bigint as contagem_total
    from public.plt_cards c
    join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
    left join public.pedidos p on p.id = c.pedido_id
    cross join lateral (
      select case when c.tipo <> 'pedido' then 0 else (
        select count(*)::int
          from public.plt_cards u
          join public.plt_setores se on se.id = u.setor_atual_id and se.codigo = 'estoque'
         where u.tipo = 'unidade' and u.pedido_id is null and u.arquivado_em is null
           and (u.reservada_pedido_id = c.pedido_id
                or (u.reservada_pedido_id is null
                    and u.item_codigo is not null
                    and not plt_privado.fn_eh_personalizado(u.item_descricao)
                    and exists (select 1 from public.pedido_itens pi
                                 where pi.pedido_id = c.pedido_id
                                   and pi.codigo = u.item_codigo
                                   and not plt_privado.fn_eh_personalizado(pi.descricao))))
      ) end as n
    ) pe
   where plt_privado.fn_usuario_atual() is not null
     and (
       plt_privado.fn_eh_admin()
       or c.setor_atual_id in (select plt_privado.fn_setores_do_usuario())
     )
     and c.tipo in ('pedido', 'reposicao')
     -- SESSAO-38 (D-169): o grupo 'standby' é a aba nova; os outros ficam sem ele
     and (case when p_grupo = 'standby' then c.tipo = 'pedido' and c.standby_desde is not null
               else (p_grupo is null or c.tipo = p_grupo) and c.standby_desde is null end)
     and c.arquivado_em is null
     and c.liberado_completo_em is null
     -- D-132 (14/10): o pedido que o Tiny já levou adiante (faturado, pronto
     -- para envio, enviado, entregue, não entregue, cancelado) sai do quadro e
     -- segue o Tiny; o CANCELADO mora em Pedidos → Cancelados. A reposição não
     -- tem pedido: fica até ser liberada por inteiro, arquivada ou vencer (D-85).
     and (c.tipo = 'reposicao'
          or (p.id is not null
              -- SESSAO-47: D-132 + a marca de devolvido ao PCP (a regra única)
              and not plt_privado.fn_fora_do_pcp(p.situacao, c.volta_pcp_em, c.removido_pcp_em)
              -- D-63: sem nada a produzir (só frete), o pedido não espera
              -- liberação — vai direto para Pedidos em aguardo.
              and exists (select 1 from plt_privado.vw_itens_producao v
                           where v.pedido_id = p.id and v.unidades > 0)))
   order by c.desde asc nulls last, c.id
   limit least(greatest(coalesce(p_limite, 10), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

-- (recriada da vigente em 20261109020000_plt_pedido_adiantado_tiny.sql)
create or replace function public.plt_fn_dash_pcp_dia(
  p_dia date default null
)
returns table (
  pedidos_a_liberar       integer,
  unidades_liberadas_dia  integer,
  espera_mais_antiga      interval
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with dia as (
    select (coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date)::timestamp
            at time zone 'America/Fortaleza') as ini
  ),
  pcp as (
    select s.id from public.plt_setores s where s.codigo = 'pcp'
  ),
  -- D-75: os cards que o quadro do PCP mostra — o MESMO filtro de
  -- plt_fn_cards_pedido_pcp, sem o gate por pessoa do quadro (o do painel
  -- fica no fim). D-132: a regra do Tiny é a mesma função dos dois.
  quadro as (
    select c.id, c.desde
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
      left join public.pedidos p on p.id = c.pedido_id
     where c.tipo in ('pedido', 'reposicao')
       and c.arquivado_em is null
       and c.liberado_completo_em is null
       -- SESSAO-38 (D-171): o pedido em stand-by não está aguardando liberação
       and c.standby_desde is null
       and (c.tipo = 'reposicao'
            or (p.id is not null
                -- SESSAO-47: D-132 + a marca de devolvido ao PCP (painel = quadro — D-75)
                and not plt_privado.fn_fora_do_pcp(p.situacao, c.volta_pcp_em, c.removido_pcp_em)
                and exists (select 1 from plt_privado.vw_itens_producao v
                             where v.pedido_id = p.id and v.unidades > 0)))
  )
  select
    (select count(*)::int from quadro)             as pedidos_a_liberar,
    -- como estava (o dono não pediu mudança): toda unidade criada no dia
    (select count(*)::int
       from public.plt_eventos e
       join public.plt_cards c on c.id = e.card_id
      where e.tipo = 'card_criado'
        and c.tipo = 'unidade'
        and e.ocorrido_em >= (select ini from dia)
        and e.ocorrido_em <  (select ini from dia) + interval '1 day')
                                                   as unidades_liberadas_dia,
    (select max(now() - q.desde) from quadro q)    as espera_mais_antiga
   where (select id from pcp) in (select plt_privado.fn_setores_dashboard());
$$;

-- (recriada da vigente em 20261109020000_plt_pedido_adiantado_tiny.sql)
create or replace view plt_privado.vw_standby_na_aba as
  select c.id as card_id, c.standby_evento_id
    from public.plt_cards c
    join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
    join public.pedidos p on p.id = c.pedido_id
   where c.tipo = 'pedido'
     and c.standby_desde is not null
     and c.arquivado_em is null
     and c.liberado_completo_em is null
     and not plt_privado.fn_fora_do_pcp(p.situacao, c.volta_pcp_em, c.removido_pcp_em)   -- SESSAO-47: a regra única
     and exists (select 1 from plt_privado.vw_itens_producao v
                  where v.pedido_id = p.id and v.unidades > 0);

-- (recriada da vigente em 20261109020000_plt_pedido_adiantado_tiny.sql)
create or replace function public.plt_fn_pcp_standby(
  p_card_id   bigint,
  p_motivo_id bigint default null,
  p_texto     text   default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_card   public.plt_cards%rowtype;
  v_pedido public.pedidos%rowtype;
  v_prog   date;
  v_motivo text;
begin
  if v_eu is null then
    raise exception 'Só usuário ativo da plataforma põe pedido em stand-by.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id for update;
  if not found then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if v_card.tipo <> 'pedido' then
    raise exception 'Só o card do pedido vai para stand-by.' using errcode = 'check_violation';
  end if;
  -- D-125 item 7: o card de pedido é do PCP/logística, do líder e do admin.
  if not plt_privado.fn_pode_editar_card(p_card_id) then
    raise exception 'Pôr em stand-by é gesto do PCP/logística, do líder ou do admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_card.standby_desde is not null then
    return jsonb_build_object('feito', false, 'motivo', 'ja_em_standby');
  end if;
  if v_card.arquivado_em is not null then
    raise exception 'Este pedido está arquivado.' using errcode = 'check_violation';
  end if;
  if v_card.liberado_completo_em is not null then
    raise exception 'Este pedido já foi liberado por inteiro — não está mais aguardando no PCP.'
      using errcode = 'check_violation';
  end if;
  if v_card.entrega_evento_id is not null then
    raise exception 'Este pedido já foi entregue.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.plt_setores s
                  where s.id = v_card.setor_atual_id and s.papel_no_fluxo = 'entrada') then
    raise exception 'O stand-by é do pedido que está no PCP.' using errcode = 'check_violation';
  end if;
  -- SESSAO-48 (frente 2): o pedido que o PCP tirou da linha de produção não espera no PCP
  if v_card.removido_pcp_em is not null then
    raise exception 'Este pedido foi removido do PCP — devolva-o ao PCP (aba Cancelados e removidos) antes de pôr em stand-by.'
      using errcode = 'check_violation';
  end if;
  select * into v_pedido from public.pedidos where id = v_card.pedido_id;
  -- SESSAO-47: a regra única (D-132 + a marca). E a peça liberada com "não lançar
  -- agora" segura o pedido mesmo com o Tiny adiante (Faturado, Pronto para envio,
  -- Enviado) — a porta de liberar peça liga a marca; antes o gesto inteiro caía.
  if v_pedido.id is null
     or (plt_privado.fn_fora_do_pcp(v_pedido.situacao, v_card.volta_pcp_em, v_card.removido_pcp_em)
         and not (coalesce(current_setting('plt.standby_tiny_adiante', true), '') = 'on'
                  and plt_privado.fn_tiny_adiantou(v_pedido.situacao))) then
    raise exception 'O Tiny já levou este pedido adiante — ele não espera no PCP.' using errcode = 'check_violation';
  end if;
  -- D-171: a rota não leva pedido em stand-by — o programado sai da
  -- programação antes (nada some calado de "Já programadas").
  select pr.data_entrega into v_prog from public.plt_programacoes pr where pr.card_id = v_card.id;
  if v_prog is not null then
    raise exception 'Este pedido está programado para a entrega de % — tire da programação antes de pôr em stand-by.',
      to_char(v_prog, 'DD/MM') using errcode = 'check_violation';
  end if;
  v_motivo := plt_privado.fn_motivo_da_lista('standby', p_motivo_id, p_texto);

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
    values (v_card.id, 'pedido_standby_entrou', v_eu, 'interface', v_card.setor_atual_id, v_motivo,
            jsonb_build_object('motivo_id', p_motivo_id, 'motivo', v_motivo, 'numero', v_pedido.numero));

  return jsonb_build_object('feito', true, 'numero', v_pedido.numero, 'motivo', v_motivo);
end;
$$;

-- (recriada da vigente em 20261109030000_plt_entrega_dia_real.sql)
CREATE OR REPLACE FUNCTION public.plt_fn_pedidos_lista(p_busca text DEFAULT NULL::text, p_antes_numero integer DEFAULT NULL::integer, p_limite integer DEFAULT 20, p_cancelados boolean DEFAULT false)
 RETURNS TABLE(pedido_id bigint, numero integer, cliente_nome text, data_pedido date, data_prevista date, situacao text, total_pedido numeric, vendedor text, marcadores text[], total_unidades integer, unidades_liberadas integer, unidades_prontas integer, card_id bigint, situacao_plataforma text, entregue_em timestamp with time zone, entregue_por text, entregue_fonte text, entregue_tiny text, cancelado_em timestamp with time zone, tem_mais boolean, contagem_total integer, programacao_data date, caminhao_nome text, rota integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
declare
  v_lim   integer := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_busca text    := nullif(btrim(coalesce(p_busca, '')), '');
  v_canc  boolean := coalesce(p_cancelados, false);
  -- só dígitos, sem zero na frente: o "número que começa com" vira faixas
  v_num   bigint  := case when nullif(btrim(coalesce(p_busca, '')), '') ~ '^[1-9][0-9]{0,8}$'
                          then btrim(p_busca)::bigint end;
  v_ids   bigint[];
  v_total integer;
  v_teto  bigint;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    return;  -- como antes: sem acesso, lista vazia
  end if;

  -- 1 · a página (limite + 1, para saber se tem mais), por um caminho por caso
  if v_busca is null and not v_canc then
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
       where (p_antes_numero is null or p.numero < p_antes_numero)
       order by p.numero desc limit v_lim + 1) x;
  elsif v_busca is null then
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
       where plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
         and (p_antes_numero is null or p.numero < p_antes_numero)
       order by p.numero desc limit v_lim + 1) x;
  else
    -- 1ª tentativa: só os 5.000 números mais recentes, do jeito de sempre (o
    -- filtro com OU, parando na página cheia) — termo COMUM acha a página aí e
    -- para cedo. Achou a página inteira (limite + 1) → é exatamente a de antes:
    -- qualquer outro pedido que case tem número menor que todos da janela.
    v_teto := coalesce(p_antes_numero, (select max(pm.numero) from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) pm) + 1);
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero
        from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
        left join public.clientes c on c.id = p.cliente_id
       where p.numero >= v_teto - 5000
         and p.numero < v_teto
         and (p.numero::text like v_busca || '%'
              or c.nome ilike '%' || v_busca || '%'
              or p.vendedor ilike '%' || v_busca || '%')
         and (not v_canc or plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
       order by p.numero desc limit v_lim + 1) x;
  end if;
  -- termo RARO (a janela não encheu a página): os caminhos que os índices usam
  if v_busca is not null and cardinality(v_ids) <= v_lim then
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero
        from (-- o número que começa com o texto: só dígitos (sem zero na frente) viram
              -- faixas [x·10^k, (x+1)·10^k) — o índice do número anda em cada uma
              select p1.id
                from generate_series(0, greatest(0, 10 - length(v_busca))) as k(e)
                join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p1
                  on p1.numero >= v_num * (10::bigint ^ k.e)::bigint
                 and p1.numero <  (v_num + 1) * (10::bigint ^ k.e)::bigint
               where v_num is not null
              union
              select p2.id from public.clientes c2 join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p2 on p2.cliente_id = c2.id
               where c2.nome ilike '%' || v_busca || '%'
              union
              select p3.id from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p3 where p3.vendedor ilike '%' || v_busca || '%') alvo
        join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p on p.id = alvo.id
       where (not v_canc or plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
         and (p_antes_numero is null or p.numero < p_antes_numero)
       order by p.numero desc limit v_lim + 1) x;
  end if;

  -- 2 · o total, só na 1ª página (até 10.001), pelo mesmo caminho
  if p_antes_numero is null then
    if v_busca is null and not v_canc then
      select count(*)::int into v_total from (select 1 from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p limit 10001) x;
    elsif v_busca is null then
      select count(*)::int into v_total from (
        select 1 from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
         where plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado' limit 10001) x;
    else
      select count(*)::int into v_total from (
        select 1
          from (select p1.id
                  from generate_series(0, greatest(0, 10 - length(v_busca))) as k(e)
                  join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p1
                    on p1.numero >= v_num * (10::bigint ^ k.e)::bigint
                   and p1.numero <  (v_num + 1) * (10::bigint ^ k.e)::bigint
                 where v_num is not null
                union
                select p2.id from public.clientes c2 join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p2 on p2.cliente_id = c2.id
                 where c2.nome ilike '%' || v_busca || '%'
                union
                select p3.id from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p3 where p3.vendedor ilike '%' || v_busca || '%') alvo
          join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p on p.id = alvo.id
         where (not v_canc or plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
         limit 10001) x;
    end if;
  end if;

  -- 3 · o que cada linha mostra — a projeção de sempre, sobre a página achada
  return query
  with pagina as (
    select p.id, p.numero, p.cliente_id, p.data_pedido, plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista, p.situacao,
           p.total_pedido, p.vendedor, p.marcadores, nullif(p.raw ->> 'data_entrega', '') as entregue_tiny,
           c.nome as cliente_nome
      from unnest(v_ids) with ordinality as u(id, ord)
      join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p on p.id = u.id
      left join public.clientes c on c.id = p.cliente_id
     order by u.ord
  ),
  numerada as (
    select pg.*, row_number() over (order by pg.numero desc) as n from pagina pg
  )
  select nu.id                                   as pedido_id,
         nu.numero,
         coalesce(nu.cliente_nome, '')           as cliente_nome,
         nu.data_pedido,
         nu.data_prevista,
         nu.situacao,
         nu.total_pedido,
         nullif(btrim(coalesce(nu.vendedor, '')), '') as vendedor,
         coalesce(nu.marcadores, '{}')           as marcadores,
         coalesce(i.total_unidades, 0)           as total_unidades,
         coalesce(u.liberadas, 0)                as unidades_liberadas,
         coalesce(u.prontas, 0)                  as unidades_prontas,
         pc.id                                   as card_id,
         case
           when plt_privado.fn_situacao_normalizada(nu.situacao) = 'cancelado' then 'cancelado'
           when pc.id is null then 'sem_card'
           when pc.devolucao_evento_id is not null then 'devolvido'
           when pc.entrega_evento_id is not null then 'entregue'
           when pc.arquivado_em is not null then 'arquivado'
           -- SESSAO-38 (↪️ D-156): o PROGRAMADO também está "Em rota" (lançado ou não)
           when pc.lancado_rotas_em is not null or pr.card_id is not null then 'em_rota'
           when coalesce(i.total_unidades, 0) > 0 and coalesce(u.prontas, 0) >= i.total_unidades then 'aguardo'
           when coalesce(u.liberadas, 0) > 0 then 'producao'
           -- D-132: o Tiny já levou adiante e nada foi liberado — segue o Tiny.
           -- ↪️ SESSAO-47: … a não ser que a logística o tenha devolvido ao PCP
           -- ↪️ SESSAO-48 (frente 2): o PCP tirou o pedido da linha de produção
           when pc.removido_pcp_em is not null then 'removido_pcp'
           when plt_privado.fn_fora_do_pcp(nu.situacao, pc.volta_pcp_em, pc.removido_pcp_em) then 'tiny'
           else 'pcp'
         end                                     as situacao_plataforma,
         -- SESSAO-47: o dia REAL da entrega (a projeção do card)
         pc.entrega_em                           as entregue_em,
         ue.nome                                 as entregue_por,
         case when ent.id is null then null
              else coalesce(ent.dados ->> 'fonte', case when ent.usuario_id is null then 'tiny' else 'plataforma' end)
         end                                     as entregue_fonte,
         nu.entregue_tiny,
         canc.ocorrido_em                        as cancelado_em,
         (select count(*) from pagina) > v_lim       as tem_mais,
         v_total                                 as contagem_total,
         pr.data_entrega                         as programacao_data,
         cam.nome                                as caminhao_nome,
         pr.rota::int                            as rota
    from numerada nu
    left join public.plt_cards pc on pc.pedido_id = nu.id and pc.tipo = 'pedido'
    left join public.plt_programacoes pr on pr.card_id = pc.id
    left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
    left join public.plt_eventos ent on ent.id = pc.entrega_evento_id
    left join public.plt_usuarios ue on ue.id = ent.usuario_id
    left join lateral (
      select min(e.ocorrido_em) as ocorrido_em
        from public.plt_eventos e
       where pc.id is not null and e.card_id = pc.id and e.tipo = 'pedido_cancelado'
    ) canc on true
    left join lateral (
      -- D-63: o frete não conta como unidade.
      select coalesce(sum(v.unidades), 0)::int as total_unidades
        from plt_privado.vw_itens_producao v
       where v.pedido_id = nu.id
    ) i on true
    left join lateral (
      select count(*)::int as liberadas,
             count(*) filter (where cu.concluido_em is not null)::int as prontas
        from public.plt_cards cu
       where cu.tipo = 'unidade'
         and (cu.pedido_id = nu.id or (pc.id is not null and cu.card_pai_id = pc.id))
    ) u on true
   where nu.n <= v_lim
   order by nu.numero desc;
end;
$function$;

-- a de 2 argumentos sai (as portas acima já leem a de 3)
drop function if exists plt_privado.fn_fora_do_pcp(text, timestamptz);

-- ----------------------------------------------------------------------------
-- 6 · Os fatos novos: quem grava (a maquinaria liga a marca) e o que projetam
-- ----------------------------------------------------------------------------
-- Nenhum deles nasce gravado direto na tabela: o cancelamento e a retomada nascem
-- do fato de CHEGADA (o gatilho da seção 7); o aviso resolvido, a remoção e a
-- devolução, das portas do PCP (frente 2); o destino, da janela da logística e da
-- reação ao Tiny (frente 3). Cada maquinaria liga a SUA marca e a devolve como
-- estava (o padrão da casa — plt.volta_pcp_maquinaria, plt.estoque_maquinaria).
create or replace function plt_privado.fn_validar_fatos_cancelamento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_marca text;
  v_tipo  text;
begin
  v_marca := case
               when new.tipo in ('fabricacao_cancelada', 'fabricacao_retomada') then 'plt.cancelamento_maquinaria'
               when new.tipo in ('pcp_aviso_resolvido', 'pedido_removido_pcp', 'pedido_devolvido_pcp') then 'plt.pcp_aviso_maquinaria'
               else 'plt.destino_maquinaria'
             end;
  if coalesce(current_setting(v_marca, true), '') <> 'on' then
    raise exception 'Este registro nasce sozinho, pelo gesto na plataforma (mover a peça, a janela do PCP ou a da logística) — não se grava direto.'
      using errcode = 'check_violation';
  end if;
  select c.tipo into v_tipo from public.plt_cards c where c.id = new.card_id;
  if new.tipo in ('fabricacao_cancelada', 'fabricacao_retomada', 'destino_pendente', 'destino_decidido')
     and v_tipo is distinct from 'unidade' then
    raise exception 'Só a peça tem a fabricação cancelada, retomada ou um destino a decidir.' using errcode = 'check_violation';
  end if;
  if new.tipo in ('pcp_aviso_resolvido', 'pedido_removido_pcp', 'pedido_devolvido_pcp')
     and v_tipo is distinct from 'pedido' then
    raise exception 'O aviso e a remoção do PCP são do card do pedido.' using errcode = 'check_violation';
  end if;
  if new.tipo = 'fabricacao_cancelada'
     and coalesce(new.dados ->> 'motivo', '') not in ('cancelada', 'nao_encontrada') then
    raise exception 'O cancelamento leva o motivo da coluna (cancelada ou não encontrada).' using errcode = 'check_violation';
  end if;
  if new.tipo = 'pedido_removido_pcp'
     and coalesce(new.dados ->> 'motivo', '') not in ('pedido_cancelado', 'fora_da_linha', 'outro') then
    raise exception 'Escolha por que o pedido sai do PCP.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function plt_privado.fn_validar_fatos_cancelamento() is
  'SESSAO-48: os fatos novos (cancelar/retomar a fabricação, o aviso e a remoção do PCP, o destino da peça de pedido cancelado) só nascem pela maquinaria, cada uma com a sua marca; e cada um no tipo de card certo.';
revoke all on function plt_privado.fn_validar_fatos_cancelamento() from public, anon, authenticated;

drop trigger if exists plt_eventos_validar_cancelamento on public.plt_eventos;
create trigger plt_eventos_validar_cancelamento
  before insert on public.plt_eventos
  for each row
  when (new.tipo in ('fabricacao_cancelada', 'fabricacao_retomada', 'pcp_aviso_resolvido',
                     'pedido_removido_pcp', 'pedido_devolvido_pcp', 'destino_pendente', 'destino_decidido'))
  execute function plt_privado.fn_validar_fatos_cancelamento();

-- A projeção (M-13: o estado guardado só muda pelo fato).
create or replace function plt_privado.fn_projetar_fatos_cancelamento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido bigint := nullif(new.dados ->> 'pedido_id', '')::bigint;
begin
  if new.tipo = 'fabricacao_cancelada' then
    -- a troca entre as duas colunas mantém a data do 1º cancelamento (os N dias
    -- contam de lá) e muda o motivo
    update public.plt_cards
       set cancelada_em        = coalesce(cancelada_em, new.ocorrido_em),
           cancelada_motivo    = new.dados ->> 'motivo',
           cancelada_pedido_id = coalesce(v_pedido, cancelada_pedido_id)
     where id = new.card_id;
    -- a vaga voltou ao PCP: o aviso abre no card do pedido (ou continua aberto)
    if v_pedido is not null and coalesce((new.dados ->> 'vaga_volta')::boolean, false) then
      update public.plt_cards
         set pcp_aviso_em = coalesce(pcp_aviso_em, new.ocorrido_em)
       where pedido_id = v_pedido and tipo = 'pedido';
    end if;

  elsif new.tipo = 'fabricacao_retomada' then
    update public.plt_cards
       set cancelada_em = null, cancelada_motivo = null, cancelada_pedido_id = null
     where id = new.card_id;
    -- a peça voltou ao pedido: o aviso fecha se não sobrou outra peça cancelada
    -- dele desde que o aviso abriu
    if v_pedido is not null and coalesce((new.dados ->> 'volta_ao_pedido')::boolean, false) then
      update public.plt_cards pc
         set pcp_aviso_em = null
       where pc.pedido_id = v_pedido and pc.tipo = 'pedido' and pc.pcp_aviso_em is not null
         and not exists (select 1 from public.plt_cards u
                          where u.cancelada_pedido_id = v_pedido and u.tipo = 'unidade'
                            and u.cancelada_em is not null and u.cancelada_em >= pc.pcp_aviso_em);
    end if;

  elsif new.tipo = 'pcp_aviso_resolvido' then
    update public.plt_cards set pcp_aviso_em = null where id = new.card_id;

  elsif new.tipo = 'pedido_removido_pcp' then
    update public.plt_cards
       set removido_pcp_em        = new.ocorrido_em,
           removido_pcp_motivo    = new.dados ->> 'motivo',
           removido_pcp_texto     = nullif(btrim(coalesce(new.dados ->> 'texto', '')), ''),
           removido_pcp_evento_id = new.id,
           pcp_aviso_em           = null
     where id = new.card_id;

  elsif new.tipo = 'pedido_devolvido_pcp' then
    update public.plt_cards
       set removido_pcp_em = null, removido_pcp_motivo = null, removido_pcp_texto = null,
           removido_pcp_evento_id = null
     where id = new.card_id;

  elsif new.tipo = 'destino_pendente' then
    update public.plt_cards
       set destino_pendente_em = coalesce(destino_pendente_em, new.ocorrido_em)
     where id = new.card_id;

  elsif new.tipo = 'destino_decidido' then
    update public.plt_cards set destino_pendente_em = null
     where id = new.card_id and destino_pendente_em is not null;
  end if;
  return null;
end;
$$;

comment on function plt_privado.fn_projetar_fatos_cancelamento() is
  'SESSAO-48: a projeção dos fatos novos — cancelada_em/motivo/pedido na peça; o aviso (pcp_aviso_em) e a remoção (removido_pcp_*) no card do pedido; destino_pendente_em na peça de pedido cancelado no Tiny.';
revoke all on function plt_privado.fn_projetar_fatos_cancelamento() from public, anon, authenticated;

drop trigger if exists plt_eventos_projetar_cancelamento on public.plt_eventos;
create trigger plt_eventos_projetar_cancelamento
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('fabricacao_cancelada', 'fabricacao_retomada', 'pcp_aviso_resolvido',
                     'pedido_removido_pcp', 'pedido_devolvido_pcp', 'destino_pendente', 'destino_decidido'))
  execute function plt_privado.fn_projetar_fatos_cancelamento();

-- ----------------------------------------------------------------------------
-- 6b · A peça que fica sem dono guarda um pai (achado do ensaio ×100 — E-254): a
--      coerência da peça exige pedido, produto ou pai; a peça antiga sem pai e de
--      produto fora do catálogo ficava sem nada. O fato pode trazer o pai (o card do
--      pedido) — a projeção só o usa quando a peça não tem um.
-- ----------------------------------------------------------------------------

-- (recriada da vigente em 20260927120000_plt_producao_concluida_cancelamentos.sql)
create or replace function plt_privado.fn_projetar_posicao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terminal boolean;
  v_tipo_card text;
  v_pedido_id bigint;
  v_pai_id    bigint;
begin
  if new.tipo in ('card_criado', 'movimentacao_setor', 'movimentacao_etapa') then
    select s.papel_no_fluxo = 'terminal'
      into v_terminal
      from public.plt_setores s
     where s.id = coalesce(new.setor_destino_id,
                           (select c.setor_atual_id from public.plt_cards c where c.id = new.card_id));

    update public.plt_cards
       set setor_atual_id = coalesce(new.setor_destino_id, setor_atual_id),
           etapa_atual_id = new.etapa_destino_id,
           desde          = new.ocorrido_em,
           executor_atual_id = null,
           -- SESSAO-22: mover encerra a execução — e a pausa junto com ela.
           pausado_em     = null,
           responsavel_id = case when new.tipo = 'movimentacao_setor'
                                 then null else responsavel_id end,
           -- SESSAO-23: o afazer era daquele time — o relógio da delegação zera junto.
           delegado_em    = case when new.tipo = 'movimentacao_setor'
                                 then null else delegado_em end,
           -- SESSAO-15: concluído = está num terminal AGORA (D-13); saiu de
           -- lá (danificado resolvido, ajuste manual), volta a "em produção".
           concluido_em   = case when coalesce(v_terminal, false)
                                 then coalesce(concluido_em, new.ocorrido_em)
                                 else null end
     where id = new.card_id;

    -- SESSAO-22 (D-48): unidade nova liberada → o card de pedido pode ter
    -- acabado de completar a liberação.
    if new.tipo = 'card_criado' then
      select c.tipo, c.pedido_id, c.card_pai_id into v_tipo_card, v_pedido_id, v_pai_id
        from public.plt_cards c where c.id = new.card_id;
      if v_tipo_card = 'unidade' and v_pedido_id is not null then
        perform plt_privado.fn_recalcular_liberacao(v_pedido_id);
      elsif v_tipo_card = 'unidade' and v_pai_id is not null then
        -- SESSAO-25: unidade da REPOSIÇÃO — o card de reposição pode ter
        -- acabado de completar a liberação.
        perform plt_privado.fn_recalcular_liberacao_reposicao(v_pai_id);
      end if;
    end if;

  elsif new.tipo = 'execucao_iniciada' then
    -- Iniciar num card já em execução por OUTRA pessoa = transferência (D-24):
    -- fecha para um, abre para o outro — e encerra pausa que houver.
    update public.plt_cards
       set executor_atual_id = new.usuario_id,
           pausado_em = null
     where id = new.card_id;

  elsif new.tipo = 'execucao_finalizada' then
    update public.plt_cards
       set executor_atual_id = null,
           pausado_em = null
     where id = new.card_id;

  elsif new.tipo = 'execucao_pausada' then
    -- SESSAO-22 (D-48): a urgência entra porque o pausado sai do limite.
    update public.plt_cards
       set pausado_em = new.ocorrido_em
     where id = new.card_id;

  elsif new.tipo = 'execucao_retomada' then
    update public.plt_cards
       set pausado_em = null
     where id = new.card_id;

  elsif new.tipo = 'estorno' then
    -- O estado guardado é projeção; o evento é a verdade (M-13). A pausa
    -- pertencia à execução desfeita — zera junto.
    update public.plt_cards
       set executor_atual_id = plt_privado.fn_executor_pelo_log(new.card_id),
           pausado_em = null
     where id = new.card_id;

  elsif new.tipo in ('qualidade_marcada', 'qualidade_parecer') then
    update public.plt_cards
       set qualidade_atual = new.estado_qualidade
     where id = new.card_id;

  elsif new.tipo = 'card_arquivado' then
    update public.plt_cards
       set arquivado_em = new.ocorrido_em,
           executor_atual_id = null,
           pausado_em = null
     where id = new.card_id;

  elsif new.tipo = 'delegacao' then
    -- SESSAO-23: o relógio da fila de prioridade nasce (ou zera) aqui.
    update public.plt_cards
       set responsavel_id = nullif(new.dados ->> 'responsavel_id', '')::uuid,
           delegado_em = case when nullif(new.dados ->> 'responsavel_id', '') is null
                              then null else new.ocorrido_em end
     where id = new.card_id;

  elsif new.tipo = 'pedido_lancado_rotas' then
    -- SESSAO-15 (D-45): o card de pedido passa a existir para as ROTAS.
    update public.plt_cards
       set lancado_rotas_em = new.ocorrido_em
     where id = new.card_id;

  elsif new.tipo = 'pedido_atualizado' then
    -- SESSAO-22 (D-48): o Tiny pode ter mudado os itens — o "completo" muda junto.
    select c.pedido_id into v_pedido_id
      from public.plt_cards c where c.id = new.card_id;
    if v_pedido_id is not null then
      perform plt_privado.fn_recalcular_liberacao(v_pedido_id);
    end if;

  elsif new.tipo = 'unidade_desvinculada' then
    -- SESSAO-24: a peça perdeu o pedido (cancelado no Tiny) — fica SEM DONO.
    -- O produto do catálogo vem no evento (nulo quando personalizada ou fora
    -- do catálogo: aí a peça é o próprio item — SKU + descrição).
    select c.pedido_id into v_pedido_id
      from public.plt_cards c where c.id = new.card_id;
    update public.plt_cards
       set pedido_id       = null,
           produto_tiny_id = coalesce(produto_tiny_id,
                                      nullif(new.dados ->> 'produto_tiny_id', '')::bigint),
           -- SESSAO-48: a peça do catálogo que perde o pedido fica sem pai (E-256); a de
           -- móvel fora do catálogo recebe o pai que o fato traz, se não tiver um (E-254)
           card_pai_id     = case when coalesce((new.dados ->> 'sem_pai')::boolean, false) then null
                                  else coalesce(card_pai_id, nullif(new.dados ->> 'card_pai_id', '')::bigint) end
     where id = new.card_id;
    if v_pedido_id is not null then
      perform plt_privado.fn_recalcular_liberacao(v_pedido_id);
    end if;

  elsif new.tipo = 'peca_alocada' then
    -- SESSAO-24: a peça livre virou unidade pronta de um pedido (card novo, no
    -- aguardo) — esta sai de todas as listas; a história dela fica.
    update public.plt_cards
       set arquivado_em = new.ocorrido_em,
           executor_atual_id = null,
           pausado_em = null
     where id = new.card_id;
  end if;

  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7 · O gesto: a peça que CHEGA numa etapa que cancela sai da produção; a que
--     SAI dela (para qualquer outra etapa ou setor) volta — por qualquer caminho
-- ----------------------------------------------------------------------------
-- O miolo do cancelamento (o gatilho de chegada chama; o acerto das peças que já
-- estavam paradas nas colunas também — a mesma regra, com origem 'api').
create or replace function plt_privado.fn_cancelar_fabricacao(
  p_card_id bigint, p_etapa_id bigint, p_usuario uuid, p_origem text, p_ref bigint)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card   public.plt_cards%rowtype;
  v_etapa  public.plt_etapas%rowtype;
  v_pedido public.pedidos%rowtype;
  v_pc     public.plt_cards%rowtype;
  v_pai    public.plt_cards%rowtype;
  v_setor  text;
  v_volta  boolean := false;
  v_ev     bigint;
  v_m1     text;
  v_m2     text;
  v_quem   text;
  v_nome   text;
  v_produto bigint;
begin
  select * into v_card from public.plt_cards where id = p_card_id for update;
  select * into v_etapa from public.plt_etapas where id = p_etapa_id;
  if v_card.id is null or v_card.tipo <> 'unidade' or not coalesce(v_etapa.cancela_fabricacao, false) then
    return null;
  end if;
  v_produto := coalesce(v_card.produto_tiny_id, plt_privado.fn_produto_do_item(v_card.item_codigo, v_card.item_descricao));
  -- já cancelada pelo mesmo motivo: um efeito só (soltar duas vezes, a API de novo)
  if v_card.cancelada_em is not null and v_card.cancelada_motivo is not distinct from v_etapa.cancela_motivo then
    return null;
  end if;
  select s.nome into v_setor from public.plt_setores s where s.id = v_etapa.setor_id;
  if v_card.pedido_id is not null then
    select * into v_pedido from public.pedidos where id = v_card.pedido_id;
    select * into v_pc from public.plt_cards where pedido_id = v_card.pedido_id and tipo = 'pedido';
    -- a vaga volta ao PCP só com o pedido vivo PARA O PCP (a regra única): o
    -- cancelado no Tiny, o adiantado, o entregue e o removido não recebem aviso
    v_volta := v_pc.id is not null and v_pc.arquivado_em is null and v_pc.entrega_evento_id is null
               and not plt_privado.fn_fora_do_pcp(v_pedido.situacao, v_pc.volta_pcp_em, v_pc.removido_pcp_em);
  end if;
  if v_card.card_pai_id is not null then
    select * into v_pai from public.plt_cards where id = v_card.card_pai_id;
  end if;

  v_m1 := coalesce(current_setting('plt.cancelamento_maquinaria', true), '');
  v_m2 := coalesce(current_setting('plt.destino_maquinaria', true), '');

  -- frente 3: a peça de pedido cancelado no Tiny esperando a decisão — a decisão é esta
  if v_card.destino_pendente_em is not null then
    perform set_config('plt.destino_maquinaria', 'on', true);
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id, observacao, dados)
      values (v_card.id, 'destino_decidido', p_usuario, p_origem, p_ref,
              'Fabricação cancelada — é o destino do móvel do pedido cancelado.',
              jsonb_build_object('destino', 'cancelar', 'pedido_id', v_card.pedido_id, 'numero', v_pedido.numero));
    perform set_config('plt.destino_maquinaria', v_m2, true);
  end if;

  perform set_config('plt.cancelamento_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id,
                                  setor_origem_id, etapa_origem_id, observacao, dados)
    values (v_card.id, 'fabricacao_cancelada', p_usuario, p_origem, p_ref,
            v_etapa.setor_id, v_etapa.id,
            case v_etapa.cancela_motivo
              when 'nao_encontrada' then 'Peça não encontrada — saiu da produção.'
              else 'Fabricação cancelada — a peça saiu da produção.' end,
            jsonb_build_object(
              'motivo',          v_etapa.cancela_motivo,
              'etapa_id',        v_etapa.id,
              'etapa',           v_etapa.nome,
              'setor_id',        v_etapa.setor_id,
              'setor',           v_setor,
              'pedido_id',       v_card.pedido_id,
              'numero',          v_pedido.numero,
              'card_pedido_id',  v_pc.id,
              'vaga_volta',      v_volta,
              'reposicao_id',    case when v_pai.tipo = 'reposicao' then v_pai.id end,
              'item_seq',        v_card.item_seq,
              'indice_unidade',  v_card.indice_unidade,
              'total_unidades',  v_card.total_unidades,
              'troca',           v_card.cancelada_em is not null))
    returning id into v_ev;
  perform set_config('plt.cancelamento_maquinaria', v_m1, true);

  -- a peça de pedido perde o pedido (a vaga se reabre pela regra de sempre — fn_vagas_pedido);
  -- a de reposição só perde a peça: o pai continua o mesmo e a vaga segue liberada
  if v_card.pedido_id is not null then
    insert into public.plt_eventos (card_id, tipo, origem, evento_referencia_id, observacao, dados)
      values (v_card.id, 'unidade_desvinculada', 'automacao', v_ev,
              'Fabricação cancelada — a peça saiu do pedido ' || coalesce(v_pedido.numero::text, '')
                || case when v_volta then ' e a vaga voltou ao PCP.' else '.' end,
              jsonb_build_object(
                'motivo',          'fabricacao_cancelada',
                'pedido_id',       v_card.pedido_id,
                'numero',          v_pedido.numero,
                'card_pedido_id',  v_pc.id,
                'produto_tiny_id', v_produto,
                -- E-256: a peça do catálogo que perde o pedido deixa de ter o card do pedido
                -- como pai (senão entra na trava "uma peça por vaga" das peças sem pedido e
                -- cancelar de novo a mesma vaga, depois de liberada outra vez, seria recusado);
                -- a de móvel fora do catálogo precisa de um pai (a coerência da peça — E-254):
                -- fica o card do pedido
                'sem_pai',         v_produto is not null,
                'card_pai_id',     case when v_produto is null and v_card.card_pai_id is null then v_pc.id end));
  end if;

  -- o sino do PCP (logística e admin): a vaga voltou
  if v_volta and coalesce(current_setting('plt.cancelamento_sem_aviso', true), '') <> 'on' then
    select u.nome into v_quem from public.plt_usuarios u where u.id = p_usuario;
    v_nome := coalesce(nullif(btrim(v_card.item_descricao), ''), 'A peça');
    perform plt_privado.fn_avisar_publico(
      'peca_cancelada_pcp', 'pcp', v_ev, v_pc.id,
      format('%s · pedido %s',
             case v_etapa.cancela_motivo when 'nao_encontrada' then 'Peça não encontrada' else 'Peça cancelada na produção' end,
             v_pedido.numero),
      format('%s (%s/%s) do pedido %s foi %s na %s%s. A vaga voltou ao PCP.',
             v_nome, v_card.indice_unidade, v_card.total_unidades, v_pedido.numero,
             case v_etapa.cancela_motivo when 'nao_encontrada' then 'marcada como não encontrada' else 'cancelada' end,
             coalesce(v_setor, 'produção'), coalesce(' por ' || v_quem, '')));
  end if;
  if v_volta then
    perform plt_privado.fn_avisar('pcp');
  end if;
  return v_ev;
end;
$$;

comment on function plt_privado.fn_cancelar_fabricacao(bigint, bigint, uuid, text, bigint) is
  'SESSAO-48: a peça chegou numa etapa que cancela a fabricação — o fato fabricacao_cancelada (com o motivo da etapa), a peça de pedido perde o pedido (unidade_desvinculada) e, com o pedido vivo no PCP, o aviso no pedido e o sino do PCP. Idempotente (mesmo motivo = nada). A peça esperando decisão (frente 3) fecha com destino_decidido = cancelar.';
revoke all on function plt_privado.fn_cancelar_fabricacao(bigint, bigint, uuid, text, bigint) from public, anon, authenticated;

-- O miolo da retomada (a peça saiu da coluna que cancela).
create or replace function plt_privado.fn_retomar_fabricacao(
  p_card_id bigint, p_usuario uuid, p_origem text, p_ref bigint)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card     public.plt_cards%rowtype;
  v_pedido   public.pedidos%rowtype;
  v_pc       public.plt_cards%rowtype;
  v_producao boolean;
  v_volta    boolean := false;
  v_chave    text;
  v_ev       bigint;
  v_m1       text;
begin
  select * into v_card from public.plt_cards where id = p_card_id for update;
  if v_card.id is null or v_card.tipo <> 'unidade' or v_card.cancelada_em is null then
    return null;
  end if;
  select s.papel_no_fluxo = 'producao' into v_producao from public.plt_setores s where s.id = v_card.setor_atual_id;
  -- volta ao pedido só quando: a peça voltou a uma etapa de PRODUÇÃO, o pedido
  -- segue no PCP e a vaga do mesmo móvel ainda está aberta (nem peça nem reserva
  -- do estoque nela). Senão, volta sem dono (provisória da demanda). A
  -- recuperação pelo admin (frente 4) volta sempre sem dono.
  if v_card.cancelada_pedido_id is not null and v_card.pedido_id is null and coalesce(v_producao, false)
     and coalesce(current_setting('plt.retomada_sem_dono', true), '') <> 'on' then
    select * into v_pedido from public.pedidos where id = v_card.cancelada_pedido_id;
    select * into v_pc from public.plt_cards where pedido_id = v_card.cancelada_pedido_id and tipo = 'pedido';
    v_chave := plt_privado.fn_chave_peca(plt_privado.fn_produto_do_item(v_card.item_codigo, v_card.item_descricao),
                                         v_card.item_codigo, v_card.item_descricao);
    v_volta := v_pc.id is not null and v_pc.arquivado_em is null and v_pc.entrega_evento_id is null
               and not plt_privado.fn_fora_do_pcp(v_pedido.situacao, v_pc.volta_pcp_em, v_pc.removido_pcp_em)
               and exists (select 1 from plt_privado.fn_vagas_pedido(v_card.cancelada_pedido_id) w
                            where w.card_id is null and w.reserva_card_id is null and w.chave = v_chave);
  elsif v_card.cancelada_pedido_id is not null then
    select * into v_pedido from public.pedidos where id = v_card.cancelada_pedido_id;
  end if;

  v_m1 := coalesce(current_setting('plt.cancelamento_maquinaria', true), '');
  perform set_config('plt.cancelamento_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id, observacao, dados)
    values (v_card.id, 'fabricacao_retomada', p_usuario, p_origem, p_ref,
            case when v_volta then 'Fabricação retomada — a peça voltou a ser do pedido ' || v_pedido.numero || '.'
                 when v_card.cancelada_pedido_id is not null then 'Fabricação retomada — a peça voltou à produção, sem dono.'
                 else 'Fabricação retomada — a peça voltou à produção.' end,
            jsonb_build_object(
              'motivo_antes',    v_card.cancelada_motivo,
              'cancelada_em',    v_card.cancelada_em,
              'pedido_id',       v_card.cancelada_pedido_id,
              'numero',          v_pedido.numero,
              'volta_ao_pedido', v_volta))
    returning id into v_ev;
  perform set_config('plt.cancelamento_maquinaria', v_m1, true);

  -- a peça volta a ser do pedido ONDE ESTÁ (a maquinaria da D-201: peca_vinculada)
  if v_volta then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id,
                                    evento_referencia_id, observacao, dados)
      values (v_card.id, 'peca_vinculada', p_usuario, p_origem, v_card.setor_atual_id, v_card.etapa_atual_id, v_ev,
              'A peça voltou a ser do pedido ' || v_pedido.numero || ' ('
                || coalesce(v_card.indice_unidade::text, '?') || '/' || coalesce(v_card.total_unidades::text, '?') || ').',
              jsonb_build_object(
                'pedido_id',      v_card.cancelada_pedido_id,
                'numero',         v_pedido.numero,
                -- o pai volta a ser o card do pedido (a peça do catálogo o tinha perdido — E-256)
                'card_pai_id',    v_pc.id,
                'item_seq',       v_card.item_seq,
                'indice_unidade', v_card.indice_unidade,
                'total_unidades', v_card.total_unidades,
                'item_codigo',    v_card.item_codigo,
                'item_descricao', v_card.item_descricao,
                'retomada',       true));
    perform plt_privado.fn_avisar('pcp');
  end if;
  return v_ev;
end;
$$;

comment on function plt_privado.fn_retomar_fabricacao(bigint, uuid, text, bigint) is
  'SESSAO-48: a peça saiu da coluna que cancela — o fato fabricacao_retomada (volta a contar) e, com a peça numa etapa de produção, o pedido no PCP e a vaga do mesmo móvel aberta, peca_vinculada de volta ao pedido (o aviso fecha). Senão, sem dono. Com plt.retomada_sem_dono ligada (recuperar), sempre sem dono.';
revoke all on function plt_privado.fn_retomar_fabricacao(bigint, uuid, text, bigint) from public, anon, authenticated;

-- O gatilho no fato de CHEGADA (criar o card já na coluna, mover de etapa, mover
-- de setor). Roda depois da projeção da posição ("zz" — a ordem dos gatilhos é a
-- do nome), então o card já está onde chegou.
create or replace function plt_privado.fn_cancelamento_na_chegada()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo      text;
  v_cancelada timestamptz;
  v_cancela   boolean;
begin
  select c.tipo, c.cancelada_em into v_tipo, v_cancelada from public.plt_cards c where c.id = new.card_id;
  if v_tipo is distinct from 'unidade' then
    return null;
  end if;
  select e.cancela_fabricacao into v_cancela from public.plt_etapas e where e.id = new.etapa_destino_id;
  if coalesce(v_cancela, false) then
    perform plt_privado.fn_cancelar_fabricacao(new.card_id, new.etapa_destino_id, new.usuario_id, new.origem, new.id);
  elsif v_cancelada is not null then
    perform plt_privado.fn_retomar_fabricacao(new.card_id, new.usuario_id, new.origem, new.id);
  end if;
  return null;
end;
$$;

comment on function plt_privado.fn_cancelamento_na_chegada() is
  'SESSAO-48: no fato de chegada (card_criado / movimentacao_etapa / movimentacao_setor) — chegou numa etapa que cancela → fn_cancelar_fabricacao; saiu dela (a peça estava cancelada) → fn_retomar_fabricacao. Vale por qualquer caminho: arrasto, tablet, Mover, liberação do PCP, API.';
revoke all on function plt_privado.fn_cancelamento_na_chegada() from public, anon, authenticated;

drop trigger if exists plt_eventos_zz_cancelamento_chegada on public.plt_eventos;
create trigger plt_eventos_zz_cancelamento_chegada
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('card_criado', 'movimentacao_etapa', 'movimentacao_setor'))
  execute function plt_privado.fn_cancelamento_na_chegada();

-- ----------------------------------------------------------------------------
-- 8 · Ninguém inicia nem retoma o trabalho numa peça cancelada (vale até para a
--     chave de serviço — M-14: a trava mora no gatilho)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_recusar_peca_cancelada()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.plt_cards c where c.id = new.card_id and c.cancelada_em is not null) then
    raise exception 'Esta peça teve a fabricação cancelada. Para trabalhar nela, arraste-a de volta para uma etapa de produção.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function plt_privado.fn_recusar_peca_cancelada() from public, anon, authenticated;

drop trigger if exists plt_eventos_recusar_peca_cancelada on public.plt_eventos;
create trigger plt_eventos_recusar_peca_cancelada
  before insert on public.plt_eventos
  for each row
  when (new.tipo in ('execucao_iniciada', 'execucao_retomada', 'auxilio_iniciado', 'auxilio_retomado'))
  execute function plt_privado.fn_recusar_peca_cancelada();

-- (recriada da vigente em 20261024010000_plt_lancar_filtro_busca.sql)
create or replace function plt_privado.fn_quadro_pagina(
  p_setor_id bigint, p_etapa_id bigint, p_corte_desde timestamptz, p_corte_id bigint, p_n integer,
  p_ordem text default null, p_so_ids bigint[] default null)
returns bigint[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with m as (select plt_privado.fn_ordem_do_quadro(p_ordem) as modo),
  col as (
    select v.id,
           case (select modo from m) when 'prioridade' then v.rank_prioridade else v.rank_urgente end as k1,
           (case (select modo from m) when 'entrega' then v.chave_entrega
                                      when 'alfabetica' then v.chave_nome else '' end) collate "C" as k2,
           case (select modo from m) when 'entrega' then coalesce(v.pedido_numero, 2147483647) else 0 end as k3,
           coalesce(v.desde, 'infinity'::timestamptz) as k4
      from plt_privado.vw_card_ordem v
     where v.setor_atual_id = p_setor_id
       and (case when p_etapa_id is null then v.etapa_atual_id is null else v.etapa_atual_id = p_etapa_id end)
       and v.arquivado_em is null and v.tipo in ('unidade', 'avulso')
       -- SESSAO-40 (D-187): com o filtro, só os cards que bateram (o conjunto
       -- vem resolvido UMA vez por quadro — fn_quadro_filtrados)
       and (p_so_ids is null or v.id = any (p_so_ids))
       -- SESSAO-48: na coluna que cancela a fabricação, só os últimos N dias (o resto a
       -- rotina da madrugada arquiva) — a coluna não incha nem antes de a limpeza rodar.
       -- Os que passaram do prazo saem por um conjunto calculado UMA vez (o índice
       -- plt_cards_cancelada_idx; vazio fora das colunas que cancelam) — nada linha a linha
       -- (a 1ª versão lia a data de cada card: +60 ms no ensaio ×100 — E-255).
       and v.id not in (select c2.id
                          from public.plt_cards c2
                          join public.plt_etapas e on e.id = c2.etapa_atual_id and e.cancela_fabricacao
                         where c2.etapa_atual_id = p_etapa_id
                           and c2.cancelada_em is not null and c2.arquivado_em is null
                           and c2.cancelada_em < now() - make_interval(days => e.cancela_dias::int))
  ),
  corte as (
    select case (select modo from m) when 'prioridade' then v.rank_prioridade else v.rank_urgente end as k1,
           (case (select modo from m) when 'entrega' then v.chave_entrega
                                      when 'alfabetica' then v.chave_nome else '' end) collate "C" as k2,
           case (select modo from m) when 'entrega' then coalesce(v.pedido_numero, 2147483647) else 0 end as k3,
           coalesce(v.desde, 'infinity'::timestamptz) as k4,
           v.id
      from plt_privado.vw_card_ordem v
     where coalesce(p_corte_id, 0) > 0 and v.id = p_corte_id
  )
  select coalesce(array_agg(x.id order by x.k1, x.k2, x.k3, x.k4, x.id), '{}')
    from (select c.*
            from col c
           where not exists (select 1 from corte)
              or (c.k1, c.k2, c.k3, c.k4, c.id) > (select k.k1, k.k2, k.k3, k.k4, k.id from corte k)
           order by c.k1, c.k2, c.k3, c.k4, c.id
           limit greatest(coalesce(p_n, 10), 1)) x;
$$;

-- ----------------------------------------------------------------------------
-- 9 · O quadro: a coluna que cancela mostra só os últimos N dias (um filtro na
--     LEITURA — a coluna não incha nem antes de a limpeza rodar), o card traz
--     quando saiu, e nenhuma coluna que cancela é a etapa de início
-- ----------------------------------------------------------------------------
-- (o total da coluna conta o que ela mostra; recriada à mão a partir da vigente
-- em 20261024010000_plt_lancar_filtro_busca.sql — a mesma assinatura)
create or replace function plt_privado.fn_quadro_total(p_setor_id bigint, p_etapa_id bigint, p_so_ids bigint[] default null)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_n     integer;
  v_corte timestamptz;
begin
  -- SESSAO-48: na coluna que cancela a fabricação, só os últimos N dias
  if p_etapa_id is not null then
    select now() - make_interval(days => e.cancela_dias::int) into v_corte
      from public.plt_etapas e
     where e.id = p_etapa_id and e.cancela_fabricacao;
  end if;
  v_corte := coalesce(v_corte, '-infinity'::timestamptz);
  -- SESSAO-40 (D-187): com o filtro, conta só os que bateram (pela chave)
  if p_so_ids is not null then
    select count(*)::int into v_n
      from public.plt_cards c
     where c.id = any (p_so_ids)
       and (case when p_etapa_id is null then c.etapa_atual_id is null else c.etapa_atual_id = p_etapa_id end)
       and (c.cancelada_em is null or c.cancelada_em >= v_corte);
    return v_n;
  end if;
  if p_etapa_id is null then
    select count(*)::int into v_n from public.plt_cards c
     where c.setor_atual_id = p_setor_id and c.etapa_atual_id is null
       and c.arquivado_em is null and c.tipo in ('unidade', 'avulso');
  else
    select count(*)::int into v_n from public.plt_cards c
     where c.setor_atual_id = p_setor_id and c.etapa_atual_id = p_etapa_id
       and c.arquivado_em is null and c.tipo in ('unidade', 'avulso')
       and (c.cancelada_em is null or c.cancelada_em >= v_corte);
  end if;
  return v_n;
end;
$$;

-- (recriada da vigente em 20261022010000_plt_card_prioridade_prazo_ordem.sql)
create or replace function plt_privado.fn_quadro_cards(p_ids bigint[])
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'tipo', c.tipo, 'pedido_id', c.pedido_id, 'card_pai_id', c.card_pai_id,
           'item_seq', c.item_seq, 'item_codigo', c.item_codigo, 'item_descricao', c.item_descricao,
           'indice_unidade', c.indice_unidade, 'total_unidades', c.total_unidades,
           'setor_atual_id', c.setor_atual_id, 'etapa_atual_id', c.etapa_atual_id, 'desde', c.desde,
           'executor_atual_id', c.executor_atual_id, 'responsavel_id', c.responsavel_id,
           'delegado_em', c.delegado_em, 'qualidade_atual', c.qualidade_atual, 'concluido_em', c.concluido_em,
           'pausado_em', c.pausado_em, 'liberado_completo_em', c.liberado_completo_em,
           'produto_tiny_id', c.produto_tiny_id, 'etiquetas', c.etiquetas,
           'parecer_pendente_id', c.parecer_pendente_id,
           -- SESSAO-31: a frente do card (D-125 / §2)
           'titulo', c.titulo, 'descricao', left(c.descricao, 600),
           'inicio_em', c.inicio_em, 'vence_em', c.vence_em, 'responsaveis', to_jsonb(c.responsaveis),
           'anexos_qtd', c.anexos_qtd, 'mensagens_qtd', c.mensagens_qtd,
           'vinculo_tipo', c.vinculo_tipo, 'vinculo_id', c.vinculo_id,
           'vinculo_rotulo', case when c.vinculo_tipo is null then null
                                  else plt_privado.fn_vinculo_rotulo(c.vinculo_tipo, c.vinculo_id) end,
           'ajuste_destino', c.ajuste_destino, 'criado_por_id', c.criado_por_id,
           'pausa_motivo', c.pausa_motivo,
           'auxiliares', to_jsonb(c.auxiliares),
           -- SESSAO-38 (D-150): a prioridade efetiva (a peça herda a do pedido)
           -- e a data de entrega (a do pedido no Tiny, ao vivo; no avulso, o vencimento)
           'prioridade', v.prioridade,
           'prioridade_herdada', v.prioridade_herdada,
           'data_entrega', v.data_entrega
         )
         -- SESSAO-48: a peça cancelada (quando saiu, o motivo, o pedido de antes) e a que
         -- espera a decisão do destino — as chaves só nascem quando há o que dizer (E-237)
         || case when c.cancelada_em is null then '{}'::jsonb
                 else jsonb_build_object('cancelada_em', c.cancelada_em, 'cancelada_motivo', c.cancelada_motivo,
                                         'cancelada_pedido_numero',
                                         (select pp.numero from public.pedidos pp where pp.id = c.cancelada_pedido_id)) end
         || case when c.destino_pendente_em is null then '{}'::jsonb
                 else jsonb_build_object('destino_pendente_em', c.destino_pendente_em) end
         order by o.ord), '[]'::jsonb)
    from unnest(p_ids) with ordinality as o(id, ord)
    join public.plt_cards c on c.id = o.id
    join plt_privado.vw_card_ordem v on v.id = c.id;
$$;

-- (recriada da vigente em 20261027070000_plt_carencia_5min_card_esquecido.sql)
CREATE OR REPLACE FUNCTION public.plt_fn_quadro_setor(p_setor_id bigint, p_por_coluna integer DEFAULT 10, p_ordem text DEFAULT NULL::text, p_filtro text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_n       integer := least(greatest(coalesce(p_por_coluna, 10), 1), 50);
  v_ordem   text := plt_privado.fn_ordem_do_quadro(p_ordem);
  v_colunas jsonb := '[]'::jsonb;
  v_ids     bigint[] := '{}';
  v_pagina  bigint[];
  v_total   integer;
  r         record;
  v_so      bigint[];
begin
  if not plt_privado.fn_pode_ver_quadro(p_setor_id) then
    raise exception 'Você não vê o quadro deste setor.' using errcode = 'insufficient_privilege';
  end if;
  -- SESSAO-40 (D-187): os cards do setor que batem com o filtro — UMA vez
  -- (nulo = sem filtro; vazio = nada bate)
  v_so := plt_privado.fn_quadro_filtrados(p_setor_id, p_filtro);

  for r in
    select null::bigint as etapa_id, -1 as ordem, 0::bigint as id
    union all
    select e.id, e.ordem, e.id from public.plt_etapas e where e.setor_id = p_setor_id and e.ativa
    order by 2, 3
  loop
    v_pagina := plt_privado.fn_quadro_pagina(p_setor_id, r.etapa_id, null, null, v_n, v_ordem, v_so);
    v_total := plt_privado.fn_quadro_total(p_setor_id, r.etapa_id, v_so);
    v_colunas := v_colunas || jsonb_build_array(jsonb_build_object(
                   'etapa_id', r.etapa_id, 'total', v_total, 'cards', plt_privado.fn_quadro_cards(v_pagina)));
    v_ids := v_ids || v_pagina;
  end loop;

  return jsonb_build_object(
    'setor_id', p_setor_id,
    'por_coluna', v_n,
    'ordem', v_ordem,
    -- SESSAO-40 (D-187): o filtro que valeu (nulo = o quadro inteiro)
    'filtro', (select case when x.ativo then coalesce(x.numero, x.nome) end
                 from plt_privado.fn_filtro_do_quadro(p_filtro) x),
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'setor_id', e.setor_id, 'nome', e.nome, 'ordem', e.ordem,
                                          'eh_fila', e.eh_fila, 'eh_danificado', e.eh_danificado, 'ativa', e.ativa,
                                          'setor_destino_id', e.setor_destino_id, 'conclui_producao', e.conclui_producao,
                                          'pede_motivo', e.pede_motivo)
                       -- SESSAO-48: a etapa que cancela a fabricação (só quando cancela — E-237)
                       || case when e.cancela_fabricacao
                               then jsonb_build_object('cancela_fabricacao', true, 'cancela_motivo', e.cancela_motivo,
                                                       'cancela_dias', e.cancela_dias)
                               else '{}'::jsonb end
                       order by e.ordem, e.id)
        from public.plt_etapas e where e.setor_id = p_setor_id and e.ativa), '[]'::jsonb),
    'colunas', v_colunas,
    'etiquetas', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'cor', t.cor,
                                                               'arquivada_em', t.arquivada_em) order by t.nome)
                             from public.plt_etiquetas t), '[]'::jsonb),
    'campos', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'tipo', f.tipo, 'opcoes', f.opcoes,
                                                            'em_pecas', f.em_pecas, 'em_pedidos', f.em_pedidos,
                                                            'em_avulsos', f.em_avulsos, 'arquivado_em', f.arquivado_em)
                                         order by f.nome)
                          from public.plt_campos f), '[]'::jsonb),
    'presencas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'usuario_id', u.id, 'nome', u.nome, 'foto', u.foto_caminho,
               'estado', ef.estado, 'desde', s.inicio, 'carencia', s.carencia)
             order by u.nome)
        from public.plt_presenca_segmentos s
        join public.plt_usuarios u on u.id = s.usuario_id
        cross join lateral (select plt_privado.fn_presenca_estado_efetivo(s.estado, s.carencia, s.inicio, now()) as estado) ef
       where s.fim is null and s.setor_id = p_setor_id and ef.estado is not null), '[]'::jsonb),
    -- SESSAO-41 · ajuste (D-198): os cards esquecidos do setor (a pergunta
    -- "ainda tem alguém?" no tablet) — pelo índice parcial, mesmo fora da 1ª página
    'esquecidos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'card_id', c.id,
               'nome', coalesce(nullif(btrim(c.titulo), ''), nullif(btrim(c.item_descricao), ''), 'Card ' || c.id),
               'pedido', p.numero, 'aviso_em', c.esquecido_aviso_em,
               'executor_id', c.executor_atual_id, 'executor', u.nome)
             order by c.esquecido_aviso_em, c.id)
        from public.plt_cards c
        left join public.pedidos p on p.id = c.pedido_id
        left join public.plt_usuarios u on u.id = c.executor_atual_id
       where c.setor_atual_id = p_setor_id and c.esquecido_aviso_em is not null), '[]'::jsonb)
  ) || plt_privado.fn_quadro_junto(v_ids);
end;
$function$;

-- (recriada da vigente em 20261014120000_plt_qualidade_configuravel_expedicao.sql)
create or replace function plt_privado.fn_etapa_inicio(p_setor_id bigint)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e2.id
    from public.plt_etapas fila
    join public.plt_etapas e2 on e2.setor_id = fila.setor_id
   where fila.setor_id = p_setor_id
     and fila.eh_fila and fila.ativa
     and e2.ativa and not e2.eh_danificado and not e2.eh_fila
     and e2.setor_destino_id is null
     and not e2.conclui_producao
     and not e2.cancela_fabricacao   -- SESSAO-48
     and (e2.ordem, e2.id) > (fila.ordem, fila.id)
   order by e2.ordem, e2.id
   limit 1;
$$;

-- ----------------------------------------------------------------------------
-- 10 · O aviso no PCP fecha quando o pedido é liberado por inteiro de novo (a vaga
--      foi produzida de novo, pelo aviso ou direto pela janela de liberar)
-- ----------------------------------------------------------------------------

-- (recriada da vigente em 20261104010000_plt_itens_novos_reabrir_entrega.sql)
create or replace function plt_privado.fn_recalcular_liberacao(p_pedido_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total     integer;
  v_liberadas integer;
  v_quando    timestamptz;
begin
  -- SESSAO-44 (frente 3): a vaga coberta é a que tem a peça do mesmo produto —
  -- frete não é vaga (D-63) e peça de item que saiu não cobre nada.
  select count(*)::int, count(w.card_id)::int into v_total, v_liberadas
    from plt_privado.fn_vagas_pedido(p_pedido_id) w;

  if v_total > 0 and v_liberadas >= v_total then
    -- O instante da liberação da ÚLTIMA unidade (D-48: fim do tempo em PCP).
    -- D-201: a peça que veio da produção sem dono conta de quando passou a ser
    -- deste pedido.
    select max(e.ocorrido_em) into v_quando
      from plt_privado.fn_vagas_pedido(p_pedido_id) w
      join public.plt_eventos e on e.card_id = w.card_id
     where e.tipo = 'card_criado'
        or (e.tipo = 'peca_vinculada' and e.dados ->> 'pedido_id' = p_pedido_id::text);
  else
    v_quando := null;
  end if;

  update public.plt_cards
     set liberado_completo_em = v_quando,
         -- SESSAO-48: liberado por inteiro, o aviso da peça cancelada fecha
         pcp_aviso_em = case when v_quando is not null then null else pcp_aviso_em end
   where pedido_id = p_pedido_id and tipo = 'pedido'
     and liberado_completo_em is distinct from v_quando;
end;
$$;

-- ----------------------------------------------------------------------------
-- 11 · A peça em produção sem dono (D-201) não é a cancelada: nem sugestão na
--      janela de liberar, nem ligação a um pedido
-- ----------------------------------------------------------------------------

-- (recriada da vigente em 20261104010000_plt_itens_novos_reabrir_entrega.sql)
CREATE OR REPLACE FUNCTION plt_privado.fn_sugestoes_em_producao(p_card_id bigint, p_cobertas jsonb)
 RETURNS TABLE(item_seq integer, indice_unidade integer, total_unidades integer, peca_card_id bigint, setor_nome text, etapa_nome text, peca_origem text, peca_origem_numero integer, pecas_iguais integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with alvo as (
    select pc.id, pc.pedido_id
      from public.plt_cards pc
     where pc.id = p_card_id
       and pc.tipo = 'pedido'
       and pc.arquivado_em is null
       and (pc.lancado_rotas_em is null or pc.liberado_completo_em is null)
       and not plt_privado.fn_pedido_cancelado(pc.pedido_id)
  ),
  itens as (
    -- D-63: frete não é vaga (vw_itens_producao: unidades = 0).
    select v.seq, v.unidades as n, v.codigo, x.produto,
           plt_privado.fn_chave_peca(x.produto, v.codigo, v.descricao) as chave
      from plt_privado.vw_itens_producao v
      join alvo a on a.pedido_id = v.pedido_id
     cross join lateral (select plt_privado.fn_produto_do_item(v.codigo, v.descricao) as produto) x
     where v.unidades >= 1
  ),
  -- SESSAO-44 (frente 3): as vagas cobertas pela peça do mesmo produto — uma vez só
  cobertas as materialized (
    select w.seq, w.indice
      from alvo a cross join lateral plt_privado.fn_vagas_pedido(a.pedido_id) w
     where w.card_id is not null
  ),
  -- as vagas ainda sem unidade e que o estoque não cobre (a sugestão do estoque vem antes)
  vagas as (
    select i.seq, k.k, i.n, i.chave,
           row_number() over (partition by i.chave order by i.seq, k.k) as ordem
      from itens i
      cross join lateral generate_series(1, i.n) as k(k)
     where not exists (
             select 1 from cobertas cb where cb.seq = i.seq and cb.indice = k.k)
       and not exists (
             select 1 from jsonb_array_elements(coalesce(p_cobertas, '[]'::jsonb)) c
              where (c ->> 'item_seq')::int = i.seq and (c ->> 'indice_unidade')::int = k.k)
  ),
  candidatas as (
    -- da REPOSIÇÃO: sem dono, pelo produto (o índice das peças sem dono por produto)
    select c.id, c.setor_atual_id, c.etapa_atual_id, c.desde, c.concluido_em, c.qualidade_atual,
           'reposicao'::text as origem, null::integer as origem_numero,
           plt_privado.fn_chave_peca(c.produto_tiny_id, c.item_codigo, c.item_descricao) as chave
      from public.plt_cards c
      join public.plt_cards rp on rp.id = c.card_pai_id and rp.tipo = 'reposicao'
     where c.tipo = 'unidade' and c.arquivado_em is null and c.pedido_id is null
       and c.cancelada_em is null   -- SESSAO-48: a peça com a fabricação cancelada não é sugestão
       and c.produto_tiny_id in (select i.produto from itens i where i.produto is not null)
    union all
    -- de pedido CANCELADO que segue em produção: pelo SKU (o índice das peças de pedido por SKU)
    select c.id, c.setor_atual_id, c.etapa_atual_id, c.desde, c.concluido_em, c.qualidade_atual,
           'cancelamento', x.numero,
           plt_privado.fn_chave_peca(coalesce(c.produto_tiny_id,
                                              plt_privado.fn_produto_do_item(c.item_codigo, c.item_descricao)),
                                     c.item_codigo, c.item_descricao)
      from public.plt_cards c
      -- o pedido de CADA peça do mesmo SKU (o caminho é o índice do SKU; nunca o de
      -- todos os cancelados — no ensaio ×100 o planejador ia pelos 11 mil cancelados);
      -- a régua do cancelado é a de sempre (fn_pedido_cancelado), com a comparação
      -- barata antes (chamar a função peça a peça custava ~20 ms no ×100)
      cross join lateral (
        select p.numero from public.pedidos p
         where p.id = c.pedido_id
           and lower(p.situacao) like 'cancel%'
           and plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
        offset 0) x
     where c.tipo = 'unidade' and c.arquivado_em is null and c.pedido_id is not null
       and c.cancelada_em is null   -- SESSAO-48
       and c.item_codigo in (select i.codigo from itens i where i.codigo is not null)
       and c.pedido_id <> (select a.pedido_id from alvo a)
  ),
  em_producao as (
    select c.id, c.chave, c.origem, c.origem_numero, s.nome as setor_nome, et.nome as etapa_nome,
           -- a mais adiantada primeiro: setor mais à frente, etapa mais à frente, há mais tempo ali
           row_number() over (partition by c.chave
                              order by s.ordem desc, et.ordem desc nulls last, c.desde nulls last, c.id) as ordem,
           count(*) over (partition by c.chave) as iguais
      from candidatas c
      join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'producao'
      left join public.plt_etapas et on et.id = c.etapa_atual_id
     where c.concluido_em is null
       and coalesce(c.qualidade_atual, 'perfeito') <> 'danificado'
       and not coalesce(et.eh_danificado, false)
       and c.chave in (select v.chave from vagas v)
  )
  select v.seq, v.k, v.n, e.id, e.setor_nome, e.etapa_nome, e.origem, e.origem_numero, e.iguais::int
    from vagas v
    join em_producao e on e.chave = v.chave and e.ordem = v.ordem
   order by v.seq, v.k;
$function$
;

-- (recriada da vigente em 20261028020000_plt_pcp_peca_em_producao.sql)
create or replace function plt_privado.fn_vincular_peca_producao(
  p_card     public.plt_cards,
  p_item_seq integer,
  p_indice   integer,
  p_peca_id  bigint,
  p_usuario  uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_codigo    text;
  v_descricao text;
  v_n         integer;
  v_peca      public.plt_cards%rowtype;
  v_pai       public.plt_cards%rowtype;
  v_papel     text;
  v_setor     text;
  v_danif     boolean;
  v_origem    text;
  v_numero    integer;
  v_num_antes integer;
  v_vaga_rep  integer;
begin
  if plt_privado.fn_pedido_cancelado(p_card.pedido_id) then
    raise exception 'O pedido foi cancelado no Tiny — não recebe peça.' using errcode = 'check_violation';
  end if;
  select v.codigo, v.descricao, v.unidades into v_codigo, v_descricao, v_n
    from plt_privado.vw_itens_producao v
   where v.pedido_id = p_card.pedido_id and v.seq = p_item_seq and v.unidades >= 1;
  if v_n is null or p_indice is null or p_indice < 1 or p_indice > v_n then
    raise exception 'Esta unidade não existe no pedido.' using errcode = 'check_violation';
  end if;

  select * into v_peca from public.plt_cards where id = p_peca_id for update;
  select s.papel_no_fluxo, s.nome into v_papel, v_setor
    from public.plt_setores s where s.id = v_peca.setor_atual_id;
  if v_peca.id is null or v_peca.tipo <> 'unidade' or v_peca.arquivado_em is not null
     or v_peca.concluido_em is not null or coalesce(v_papel, '') <> 'producao'
     or v_peca.cancelada_em is not null then   -- SESSAO-48: a cancelada não vai para pedido
    raise exception 'Esta peça não está mais em produção (pode ter andado ou sido usada por outro pedido).'
      using errcode = 'check_violation';
  end if;
  select coalesce(et.eh_danificado, false) into v_danif from public.plt_etapas et where et.id = v_peca.etapa_atual_id;
  if coalesce(v_peca.qualidade_atual, 'perfeito') = 'danificado' or coalesce(v_danif, false) then
    raise exception 'Peça danificada não vai para um pedido.' using errcode = 'check_violation';
  end if;

  select * into v_pai from public.plt_cards where id = v_peca.card_pai_id;
  if v_peca.pedido_id is null then
    if v_pai.tipo is distinct from 'reposicao' then
      raise exception 'Esta peça não é de reposição de estoque nem de pedido cancelado.' using errcode = 'check_violation';
    end if;
    v_origem := 'reposicao';
  else
    if v_peca.pedido_id = p_card.pedido_id or not plt_privado.fn_pedido_cancelado(v_peca.pedido_id) then
      raise exception 'Esta peça já é de outro pedido.' using errcode = 'check_violation';
    end if;
    v_origem := 'cancelamento';
    select p.numero into v_num_antes from public.pedidos p where p.id = v_peca.pedido_id;
  end if;

  if plt_privado.fn_chave_peca(coalesce(v_peca.produto_tiny_id,
                                        plt_privado.fn_produto_do_item(v_peca.item_codigo, v_peca.item_descricao)),
                               v_peca.item_codigo, v_peca.item_descricao)
     <> plt_privado.fn_chave_peca(plt_privado.fn_produto_do_item(v_codigo, v_descricao), v_codigo, v_descricao) then
    raise exception 'A peça em produção não é igual ao item do pedido (produto, cor e medidas).'
      using errcode = 'check_violation';
  end if;

  -- A vaga que a peça ocupava na REPOSIÇÃO (para a reposição não oferecer de
  -- novo — "só perde a peça"): a dela, ou a guardada no 1º fato, se já mudou de dono.
  if v_pai.tipo = 'reposicao' then
    select (e.dados ->> 'vaga_reposicao')::int into v_vaga_rep
      from public.plt_eventos e
     where e.card_id = v_peca.id and e.tipo = 'peca_vinculada' and e.dados ? 'vaga_reposicao'
     order by e.id
     limit 1;
    v_vaga_rep := coalesce(v_vaga_rep, v_peca.indice_unidade);
  end if;

  select p.numero into v_numero from public.pedidos p where p.id = p_card.pedido_id;

  insert into public.plt_eventos
      (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, observacao, dados)
    values
      (v_peca.id, 'peca_vinculada', p_usuario, 'interface', v_peca.setor_atual_id, v_peca.etapa_atual_id,
       'Passou a ser do pedido ' || coalesce(v_numero::text, '') || format(' (%s/%s)', p_indice, v_n)
         || ' em ' || coalesce(v_setor, 'produção') || ' — '
         || case when v_origem = 'reposicao' then 'era da reposição de estoque.'
                 else 'era do pedido ' || coalesce(v_num_antes::text, '') || ', cancelado.' end,
       jsonb_strip_nulls(jsonb_build_object(
         'pedido_id',          p_card.pedido_id,
         'numero',             v_numero,
         'card_pedido_id',     p_card.id,
         -- a reposição segue como pai (a vaga dela continua liberada); o cancelado dá lugar ao pedido novo
         'card_pai_id',        case when v_pai.tipo = 'reposicao' then v_pai.id else p_card.id end,
         'item_seq',           p_item_seq,
         'indice_unidade',     p_indice,
         'total_unidades',     v_n,
         'item_codigo',        v_codigo,
         'item_descricao',     v_descricao,
         'origem',             v_origem,
         'pedido_anterior_id', v_peca.pedido_id,
         'numero_anterior',    v_num_antes,
         'reposicao_card_id',  case when v_pai.tipo = 'reposicao' then v_pai.id end,
         'vaga_reposicao',     v_vaga_rep)));
end;
$$;

-- ----------------------------------------------------------------------------
-- 12 · A limpeza: passado o prazo da coluna (N dias), a peça é ARQUIVADA com o
--      motivo — nada é apagado. Roda dentro da rotina da madrugada que já existe
--      (a conferência com o Tiny): nenhum relógio novo (Lei §4).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_cancelados_arquivar()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r       record;
  v_n     integer := 0;
  v_marca text;
  v_texto text;
begin
  v_marca := coalesce(current_setting('plt.cancelados_maquinaria', true), '');
  perform set_config('plt.cancelados_maquinaria', 'on', true);
  for r in
    select c.id, c.cancelada_em, c.cancelada_motivo, e.nome as etapa, e.cancela_dias
      from public.plt_cards c
      join public.plt_etapas e on e.id = c.etapa_atual_id and e.cancela_fabricacao
     where c.cancelada_em is not null and c.arquivado_em is null and c.tipo = 'unidade'
       and c.cancelada_em < now() - make_interval(days => e.cancela_dias::int)
     order by c.id
     for update of c skip locked
  loop
    v_texto := format('%s há mais de %s dias — removida da coluna %s.',
                      case r.cancelada_motivo when 'nao_encontrada' then 'Peça não encontrada'
                                              else 'Fabricação cancelada' end,
                      r.cancela_dias, r.etapa);
    insert into public.plt_eventos (card_id, tipo, origem, observacao, dados)
      values (r.id, 'card_arquivado', 'automacao', v_texto,
              jsonb_build_object('motivo', v_texto, 'regra', 'cancelados_prazo',
                                 'cancelada_em', r.cancelada_em, 'etapa', r.etapa, 'dias', r.cancela_dias));
    v_n := v_n + 1;
  end loop;
  perform set_config('plt.cancelados_maquinaria', v_marca, true);
  return v_n;
end;
$$;

comment on function plt_privado.fn_cancelados_arquivar() is
  'SESSAO-48 (frente 4): arquiva (card_arquivado, origem automação, com o motivo) a peça cancelada que passou do prazo da coluna (cancela_dias, padrão 7). Chamada pela rotina da madrugada (fn_tiny_pente_fino_iniciar). Nada é apagado; o admin recupera.';
revoke all on function plt_privado.fn_cancelados_arquivar() from public, anon, authenticated;

-- (recriada da vigente em 20261008150000_plt_entregue_nos_dois_lados.sql)
create or replace function plt_privado.fn_validar_api()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_papel text;
  v_logistica boolean;
  v_danificado boolean;
  v_reposicao boolean;
  v_livre_no_estoque boolean;
begin
  if new.tipo = 'card_arquivado' then
    -- SESSAO-30 (raio-x 2): peça livre do ESTOQUE só sai pela BAIXA do estoque
    -- (ordem de entrada, trava por produto, motivo e o Tiny junto) — vale
    -- para toda origem, até para o motor; a maquinaria liga a marca. A peça
    -- no DANIFICADO segue saindo pelos Danificados.
    if coalesce(current_setting('plt.estoque_maquinaria', true), '') <> 'on'
       and exists (select 1 from public.plt_cards c
                     join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
                     left join public.plt_etapas e on e.id = c.etapa_atual_id
                    where c.id = new.card_id and c.tipo = 'unidade' and c.pedido_id is null
                      and not coalesce(e.eh_danificado, false)) then
      raise exception 'Peça do ESTOQUE sai pela baixa do estoque (Estoque → o produto → Baixa): com o motivo, a ordem de entrada e o Tiny junto.'
        using errcode = 'check_violation';
    end if;
    -- SESSAO-48 (frente 4): a limpeza das colunas que cancelam a fabricação (a rotina da
    -- madrugada) arquiva a peça que passou do prazo — a maquinaria liga a marca.
    if coalesce(current_setting('plt.cancelados_maquinaria', true), '') = 'on' then
      return new;
    end if;
    -- SESSAO-30 (etapa 4): a entrega registrada por pessoa (logística, entregador)
    -- fecha o pedido pela maquinaria (fn_fechar_pedido liga a marca).
    if coalesce(current_setting('plt.entrega_maquinaria', true), '') = 'on' then
      return new;
    end if;
    -- SESSAO-27 (D-99): o motor das automações arquiva (o super admin montou e ligou).
    if plt_privado.fn_evento_do_motor(new.origem, new.dados) then
      return new;
    end if;
    if new.origem <> 'api' then
      select u.papel into v_papel from public.plt_usuarios u
       where u.id = new.usuario_id and u.ativo;
      if coalesce(v_papel, '') <> 'admin' then
        -- SESSAO-15 (D-45): a logística arquiva peça que está em DANIFICADO.
        select exists (
          select 1 from public.plt_cards c
            join public.plt_etapas e on e.id = c.etapa_atual_id
           where c.id = new.card_id and e.eh_danificado
        ) into v_danificado;
        -- SESSAO-25: e o card de REPOSIÇÃO (o PCP decide não produzir).
        select exists (
          select 1 from public.plt_cards c
           where c.id = new.card_id and c.tipo = 'reposicao'
        ) into v_reposicao;
        -- D-70 (28/09): e dá BAIXA em peça livre do ESTOQUE (a contagem é dela).
        select exists (
          select 1 from public.plt_cards c
            join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
           where c.id = new.card_id and c.tipo = 'unidade' and c.pedido_id is null
        ) into v_livre_no_estoque;
        if not ((coalesce(v_danificado, false) or coalesce(v_reposicao, false)
                 or coalesce(v_livre_no_estoque, false))
                and plt_privado.fn_eh_logistica(new.usuario_id)) then
          raise exception 'Arquivar card é gesto de admin ou da integração — a logística arquiva só peças em DANIFICADO, cards de reposição e dá baixa em peça livre do ESTOQUE.'
            using errcode = 'insufficient_privilege';
        end if;
      end if;
    end if;

  elsif new.tipo = 'pedido_entregue' then
    if new.usuario_id is null then
      -- SESSAO-30 (D-113): o Tiny ficou "Entregue" — quem registra é o Sistema,
      -- pela maquinaria (fn_fechar_pedido). Fora dela, entrega é gesto de pessoa.
      if coalesce(current_setting('plt.entrega_maquinaria', true), '') = 'on' then
        return new;
      end if;
      raise exception 'Registrar entrega é gesto de pessoa — é preciso dizer quem entregou.'
        using errcode = 'check_violation';
    end if;
    select u.papel into v_papel from public.plt_usuarios u
     where u.id = new.usuario_id and u.ativo;
    select exists (
      select 1 from public.plt_usuario_setores us
        join public.plt_setores s on s.id = us.setor_id
       where us.usuario_id = new.usuario_id
         and s.papel_no_fluxo in ('entrada', 'terminal')
    ) into v_logistica;
    if coalesce(v_papel, '') <> 'admin' and not v_logistica then
      raise exception 'Registrar entrega é gesto da logística (PCP/terminais) ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;

  elsif new.tipo = 'pedido_lancado_rotas' then
    -- SESSAO-15 (D-45): lançar é gesto HUMANO da logística, no card de PEDIDO.
    if new.usuario_id is null then
      raise exception 'Lançar para ROTAS é gesto de pessoa — é preciso dizer quem lançou.'
        using errcode = 'check_violation';
    end if;
    if not plt_privado.fn_eh_logistica(new.usuario_id) then
      raise exception 'Lançar para ROTAS é gesto da logística (PCP/terminais) ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;
    if not exists (select 1 from public.plt_cards c where c.id = new.card_id and c.tipo = 'pedido') then
      raise exception 'Só o card de pedido pode ser lançado para ROTAS.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- (recriada da vigente em 20261022060000_plt_tiny_conferencia_sem_aviso.sql)
CREATE OR REPLACE FUNCTION plt_privado.fn_tiny_pente_fino_iniciar(p_motivo text DEFAULT 'madrugada'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_local   timestamp := now() at time zone 'America/Fortaleza';
  v_hoje    date      := (now() at time zone 'America/Fortaleza')::date;
  v_rodada  text      := to_char(now() at time zone 'America/Fortaleza', 'YYYY-MM-DD"T"HH24:MI:SS.US');
  v_busca   jsonb;
  v_abertos integer;
  v_contas  integer;                  -- ↪️ D-122: contas a receber ainda abertas
  v_conf    jsonb;                    -- ↪️ D-148 (migration 107): a conferência dos registros
begin
  -- ↪️ SESSAO-48 (frente 4): a limpeza das colunas CANCELADO e NÃO ENCONTRADO roda na
  -- mesma rotina da madrugada (nenhum relógio novo — Lei §4) e nunca derruba a conferência.
  begin
    perform plt_privado.fn_cancelados_arquivar();
  exception when others then
    raise warning 'limpeza das colunas de cancelados falhou: %', sqlerrm;
  end;
  select f.params into v_busca from public.tiny_fila f
   where f.recurso = 'pedidos_pesquisa' and f.chave = 'pente-fino:p1';
  if v_busca->>'rodada' is not null and v_busca->>'resumo_em' is null then
    perform plt_privado.fn_tiny_pente_fino_resumir(v_busca->>'rodada', 'interrompida');
  end if;

  insert into public.tiny_fila as f (recurso, chave, referencia, prioridade, params)
  values ('pedidos_pesquisa', 'pente-fino:p1', 'conferência diária', 1,
          jsonb_build_object(
            'dataInicial', to_char(v_hoje - 60, 'DD/MM/YYYY'),
            'dataFinal',   to_char(v_hoje, 'DD/MM/YYYY'),
            'pagina',      1,
            'janela',      'pente-fino',
            'rodada',      v_rodada,
            'motivo',      coalesce(nullif(trim(p_motivo), ''), 'madrugada'),
            'inicio',      now()))
  on conflict (conta, recurso, chave) do update
     set status = 'pendente', tentativas = 0, erro = null, reservado_em = null,
         processado_em = null, referencia = excluded.referencia,
         prioridade = excluded.prioridade, params = excluded.params;

  insert into public.tiny_fila as f (recurso, chave, referencia, prioridade, params)
  select 'pedido', p.tiny_id::text, p.numero::text, 2, jsonb_build_object('rodada', v_rodada)
    from public.pedidos p
   where p.tiny_id is not null
     and plt_privado.fn_situacao_normalizada(p.situacao) not in ('entregue', 'nao_entregue', 'cancelado')
  on conflict (conta, recurso, chave) do update
     set status = 'pendente', tentativas = 0, erro = null, reservado_em = null,
         referencia = excluded.referencia, params = excluded.params
   where f.status <> 'processando';
  get diagnostics v_abertos = row_count;

  -- ↪️ SESSAO-30 (D-122): as CONTAS A RECEBER voltam a vir do Tiny, na mesma
  -- rodada: a busca pelas contas EMITIDAS nos últimos 60 dias (acha as novas —
  -- a releitura pula as que já fecharam, ver fn_backfill_aplicar) + a releitura
  -- das que ainda NÃO fecharam, de qualquer idade (pega o "pago" do dia).
  -- O fluxo do n8n não muda: a busca vai com os filtros daqui, palavra por palavra.
  insert into public.tiny_fila as f (recurso, chave, referencia, prioridade, params)
  values ('cr_pesquisa', 'pente-fino-cr:p1', 'conferência diária · contas a receber', 7,
          jsonb_build_object(
            'data_ini_emissao', to_char(v_hoje - 60, 'DD/MM/YYYY'),
            'data_fim_emissao', to_char(v_hoje, 'DD/MM/YYYY'),
            'pagina',           1,
            'janela',           'pente-fino-cr',
            'rodada',           v_rodada))
  on conflict (conta, recurso, chave) do update
     set status = 'pendente', tentativas = 0, erro = null, reservado_em = null,
         processado_em = null, referencia = excluded.referencia,
         prioridade = excluded.prioridade, params = excluded.params;

  insert into public.tiny_fila as f (recurso, chave, referencia, prioridade, params)
  select 'conta_receber', cr.tiny_id::text,
         coalesce(cr.numero_documento, cr.numero_pedido::text), 8,
         jsonb_build_object('rodada', v_rodada)
    from public.contas_receber cr
   where cr.tiny_id is not null
     and coalesce(cr.situacao, '') not in ('pago', 'cancelada')
  on conflict (conta, recurso, chave) do update
     set status = 'pendente', tentativas = 0, erro = null, reservado_em = null,
         referencia = excluded.referencia, params = excluded.params
   where f.status <> 'processando';
  get diagnostics v_contas = row_count;

  -- ↪️ D-148 (migration 107): a mesma madrugada confere o que o Tiny não avisa
  -- (os registros da fábrica, as contas a pagar das duas contas, o catálogo da
  -- fábrica) — blindado: um erro ali não derruba a conferência de sempre
  begin
    v_conf := plt_privado.fn_tiny_conferencia_iniciar(p_motivo);
  exception when others then
    v_conf := jsonb_build_object('erro', left(sqlerrm, 200));
    raise warning 'Tiny (conferência dos registros): %', sqlerrm;
  end;

  return jsonb_build_object('rodada', v_rodada, 'hora_local', v_local, 'nao_terminados', v_abertos,
                            'contas_abertas', v_contas, 'conferencia', v_conf)
         || plt_privado.fn_tiny_fila_acordar();
end;
$function$;

-- ----------------------------------------------------------------------------
-- 13 · Recuperar (frente 4): o admin devolve a peça cancelada — arquivada ou
--      ainda na coluna — para a FILA do setor dela (a LIMPEZA E EMBALAGEM),
--      sem dono (provisória da demanda). Desarquivar + mover = os fatos de sempre;
--      a retomada nasce do fato de chegada, como no arrasto.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_peca_cancelada_recuperar(p_card_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu   uuid := plt_privado.fn_usuario_atual();
  v_card public.plt_cards%rowtype;
  v_fila bigint;
  v_nome text;
  v_m    text;
  v_ev   bigint;
begin
  if v_eu is null then
    raise exception 'Entre na plataforma para recuperar a peça.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_eh_admin() then
    raise exception 'Só o administrador recupera uma peça que saiu da coluna de cancelados.'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id for update;
  if v_card.id is null or v_card.tipo <> 'unidade' then
    raise exception 'Peça não encontrada.' using errcode = 'no_data_found';
  end if;
  -- já recuperada (ou nunca cancelada): um efeito só
  if v_card.cancelada_em is null then
    return jsonb_build_object('feito', false, 'motivo', 'nao_cancelada');
  end if;
  select e.id, e.nome into v_fila, v_nome
    from public.plt_etapas e
   where e.setor_id = v_card.setor_atual_id and e.eh_fila and e.ativa
   order by e.ordem, e.id
   limit 1;
  if v_fila is null then
    raise exception 'O setor desta peça não tem a coluna da fila — confira em Configurações → Setores e etapas.'
      using errcode = 'check_violation';
  end if;

  if v_card.arquivado_em is not null then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, observacao, dados)
      values (v_card.id, 'card_desarquivado', v_eu, 'interface', v_card.setor_atual_id, v_card.etapa_atual_id,
              'Peça recuperada pelo administrador — volta para a fila.',
              jsonb_build_object('motivo', 'recuperar_cancelada'));
  end if;
  v_m := coalesce(current_setting('plt.retomada_sem_dono', true), '');
  perform set_config('plt.retomada_sem_dono', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id,
                                  setor_destino_id, etapa_destino_id, observacao)
    values (v_card.id, 'movimentacao_etapa', v_eu, 'interface', v_card.setor_atual_id, v_card.etapa_atual_id,
            v_card.setor_atual_id, v_fila, 'Peça recuperada — volta para a fila do setor.')
    returning id into v_ev;
  perform set_config('plt.retomada_sem_dono', v_m, true);
  return jsonb_build_object('feito', true, 'evento_id', v_ev, 'setor_id', v_card.setor_atual_id,
                            'etapa_id', v_fila, 'etapa', v_nome);
end;
$$;

comment on function public.plt_fn_peca_cancelada_recuperar(bigint) is
  'SESSAO-48 (frente 4): só o admin. A peça cancelada (na coluna ou já arquivada pela limpeza) volta para a fila do setor, sem dono: card_desarquivado (se arquivada) + movimentação para a fila → fabricacao_retomada pelo gatilho de chegada. Recuperar de novo = nada.';
revoke all on function public.plt_fn_peca_cancelada_recuperar(bigint) from public, anon;
grant execute on function public.plt_fn_peca_cancelada_recuperar(bigint) to authenticated;

-- ----------------------------------------------------------------------------
-- 14 · A busca geral acha a peça cancelada (também a arquivada pela limpeza),
--      com o motivo e o pedido de antes
-- ----------------------------------------------------------------------------

-- (recriada da vigente em 20261024010000_plt_lancar_filtro_busca.sql)
create or replace function public.plt_fn_busca_cards(
  p_texto     text,
  p_depois_id bigint  default null,
  p_limite    integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu      uuid := plt_privado.fn_usuario_atual();
  v_tudo    boolean;
  v_setores bigint[] := '{}';
  v_filtro  record;
  v_numb    bigint;
  v_lim     integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_ids     bigint[] := '{}';
  v_parte   bigint[];
  v_mais    boolean;
  v_e       integer;
  v_ini     bigint;
  v_fim     bigint;
  -- o corte (o último mostrado)
  v_c_num   bigint;
  v_c_k3    integer;
  v_c_k4    integer;
  v_c_k5    integer;
  v_c_arq   boolean;
begin
  if v_eu is null then
    raise exception 'Entre na plataforma para buscar.' using errcode = 'insufficient_privilege';
  end if;
  v_tudo := plt_privado.fn_eh_admin() or plt_privado.fn_pode_ver_expedicao();
  if not v_tudo then
    v_setores := array(select plt_privado.fn_setores_do_usuario());
  end if;

  -- A mesma leitura do texto do filtro dos quadros (D-187).
  select * into v_filtro from plt_privado.fn_filtro_do_quadro(p_texto);
  -- E-106: a conversão calculada uma vez, só quando casa.
  v_numb := case when v_filtro.numero ~ '^[1-9][0-9]{0,8}$' then v_filtro.numero::bigint end;
  if v_numb is null and coalesce(length(v_filtro.nome), 0) < 3 then
    return jsonb_build_object('itens', '[]'::jsonb, 'tem_mais', false, 'numero', null);
  end if;

  if coalesce(p_depois_id, 0) > 0 then
    select coalesce(p.numero, 0),
           case c.tipo when 'pedido' then 0 when 'reposicao' then 1 when 'unidade' then 2 else 3 end,
           coalesce(c.item_seq, 0), coalesce(c.indice_unidade, 0), c.arquivado_em is not null
      into v_c_num, v_c_k3, v_c_k4, v_c_k5, v_c_arq
      from public.plt_cards c
      left join public.pedidos p on p.id = c.pedido_id
     where c.id = p_depois_id;
  end if;

  if v_numb is not null then
    -- o NÚMERO: as faixas da maior para a menor; cada uma de trás para a frente
    for v_e in reverse greatest(0, 10 - length(v_filtro.numero)) .. 0 loop
      v_ini := v_numb * (10::bigint ^ v_e)::bigint;
      v_fim := (v_numb + 1) * (10::bigint ^ v_e)::bigint;
      continue when v_c_num is not null and v_ini > v_c_num;  -- faixa toda antes do corte
      select coalesce(array_agg(x.id order by x.numero desc, x.k3, x.k4, x.k5, x.id), '{}')
        into v_parte
        from (select c.id, p.numero,
                     case c.tipo when 'pedido' then 0 when 'reposicao' then 1 when 'unidade' then 2 else 3 end as k3,
                     coalesce(c.item_seq, 0) as k4, coalesce(c.indice_unidade, 0) as k5
                from public.pedidos p
                join public.plt_cards c on c.pedido_id = p.id
               where p.numero >= v_ini and p.numero < v_fim
                 and (v_c_num is null
                      or (-p.numero::bigint,
                          case c.tipo when 'pedido' then 0 when 'reposicao' then 1 when 'unidade' then 2 else 3 end,
                          coalesce(c.item_seq, 0), coalesce(c.indice_unidade, 0), c.id)
                         > (-v_c_num, v_c_k3, v_c_k4, v_c_k5, p_depois_id))
                 and (c.tipo in ('pedido', 'avulso')
                      or (c.tipo = 'unidade' and (c.arquivado_em is null or c.pedido_id is not null or c.cancelada_em is not null))
                      or (c.tipo = 'reposicao' and c.arquivado_em is null and c.liberado_completo_em is null))
                 and (v_tudo
                      or c.setor_atual_id = any (v_setores)
                      or c.executor_atual_id = v_eu
                      or v_eu = any (c.participantes))
               order by p.numero desc, k3, k4, k5, c.id
               limit v_lim + 1 - cardinality(v_ids)) x;
      v_ids := v_ids || v_parte;
      exit when cardinality(v_ids) > v_lim;
    end loop;
  else
    -- o NOME: o vivo primeiro, o card mais novo primeiro (trigramas)
    select coalesce(array_agg(x.id order by x.arq, x.id desc), '{}')
      into v_ids
      from (select c.id, c.arquivado_em is not null as arq
              from public.plt_cards c
             where c.nome_busca like '%' || v_filtro.nome || '%'
               and (p_depois_id is null or v_c_arq is null
                    or (c.arquivado_em is not null, -c.id) > (v_c_arq, -p_depois_id))
               and (c.tipo in ('pedido', 'avulso')
                    or (c.tipo = 'unidade' and (c.arquivado_em is null or c.pedido_id is not null or c.cancelada_em is not null))
                    or (c.tipo = 'reposicao' and c.arquivado_em is null and c.liberado_completo_em is null))
               and (v_tudo
                    or c.setor_atual_id = any (v_setores)
                    or c.executor_atual_id = v_eu
                    or v_eu = any (c.participantes))
             order by c.arquivado_em is not null, c.id desc
             limit v_lim + 1) x;
  end if;

  v_mais := cardinality(v_ids) > v_lim;
  if v_mais then
    v_ids := v_ids[1:v_lim];
  end if;

  return jsonb_build_object(
    'tem_mais', v_mais,
    'numero', v_numb,
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'tipo', c.tipo,
               'pedido_id', c.pedido_id, 'pedido_numero', p.numero, 'pedido_situacao', p.situacao,
               'titulo', coalesce(c.titulo, c.item_descricao), 'sku', c.item_codigo,
               'indice', c.indice_unidade, 'total', c.total_unidades,
               'setor_id', s.id, 'setor_nome', s.nome, 'setor_codigo', s.codigo, 'setor_papel', s.papel_no_fluxo,
               'etapa_nome', e.nome,
               'desde', c.desde,
               'arquivado_em', c.arquivado_em, 'arquivado_motivo', a.motivo,
               'liberado_completo_em', c.liberado_completo_em,
               'standby', c.standby_desde is not null,
               'executor', u.nome,
               'rota_dia', r.data_entrega, 'rota_caminhao', r.caminhao, 'rota_numero', r.rota)
             -- SESSAO-48: a peça cancelada (a chave só nasce quando há o que dizer)
             || case when c.cancelada_em is null then '{}'::jsonb
                     else jsonb_build_object('cancelada_em', c.cancelada_em, 'cancelada_motivo', c.cancelada_motivo,
                                             'cancelada_pedido_numero',
                                             (select pp.numero from public.pedidos pp where pp.id = c.cancelada_pedido_id)) end
             order by o.ord)
        from unnest(v_ids) with ordinality as o(id, ord)
        join public.plt_cards c on c.id = o.id
        left join public.pedidos p on p.id = c.pedido_id
        left join public.plt_setores s on s.id = c.setor_atual_id
        left join public.plt_etapas e on e.id = c.etapa_atual_id
        left join public.plt_usuarios u on u.id = c.executor_atual_id
        left join lateral (
          select ev.dados ->> 'motivo' as motivo
            from public.plt_eventos ev
           where c.arquivado_em is not null and ev.card_id = c.id and ev.tipo = 'card_arquivado'
           order by ev.id desc limit 1
        ) a on true
        -- a rota do pedido (programada no card do pedido), enquanto não entregue
        left join lateral (
          select pr.data_entrega, cm.nome as caminhao, pr.rota
            from public.plt_cards pc
            join public.plt_programacoes pr on pr.card_id = pc.id
            left join public.plt_caminhoes cm on cm.id = pr.caminhao_id
           where c.pedido_id is not null and c.arquivado_em is null
             and pc.pedido_id = c.pedido_id and pc.tipo = 'pedido'
           limit 1
        ) r on true), '[]'::jsonb)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 15 · Os avisos novos no catálogo (Configurações → Avisos)
-- ----------------------------------------------------------------------------

-- (recriada da vigente em 20261109020000_plt_pedido_adiantado_tiny.sql)
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
    ('chegada_aguardo',          'expedicao', 'Expedição e estoque',              20, 'Peça pronta na Expedição',                'Cada peça de pedido que fica pronta.',                                          'admin',     false, false),
    ('chegada_estoque',          'expedicao', 'Expedição e estoque',              21, 'Peça entrou no estoque',                  'Cada peça sem dono que entra no estoque.',                                      'admin',     false, false),
    ('devolucao_decidir',        'expedicao', 'Expedição e estoque',              22, 'Pedido devolvido ou entregue em parte',   'Peças esperando a decisão da logística.',                                       'logistica', false, false),
    ('pedido_cancelado_decidir', 'expedicao', 'Expedição e estoque',              23, 'Pedido cancelado com móveis em produção', 'O Tiny cancelou o pedido: a logística decide para onde vai cada móvel que estava sendo feito.', 'logistica', false, false),
    ('pedido_cancelado',         'pedidos',   'Pedidos e Tiny',                   30, 'Pedido cancelado com produção',           'Cancelado no Tiny com peças já liberadas.',                                     'admin',     false, false),
    ('pedido_excluido_no_tiny',  'pedidos',   'Pedidos e Tiny',                   31, 'Pedido excluído no Tiny',                 'O pedido não existe mais no Tiny e saiu dos quadros.',                          'admin',     false, false),
    ('produto_excluido_no_tiny', 'pedidos',   'Pedidos e Tiny',                   32, 'Produto apagado no Tiny',                 'Apagado no Tiny, mas ainda com peças no quadro.',                               'admin',     false, false),
    ('pedido_itens_novos',      'pedidos',   'Pedidos e Tiny',                   33, 'Itens novos num pedido já liberado', 'O vendedor acrescentou itens no Tiny e o pedido voltou ao PCP só com o que falta.', 'pcp',       false, false),
    ('pedido_itens_sairam',     'pedidos',   'Pedidos e Tiny',                   34, 'Item saiu de um pedido com peça feita', 'O Tiny tirou ou diminuiu um item que já tem peça — nada foi arquivado.',        'pcp',       false, false),
    ('pedido_itens_rota',       'pedidos',   'Pedidos e Tiny',                   35, 'Pedido na rota ganhou itens',       'Segure a entrega: o pedido voltou ao PCP com os itens novos.',                  'logistica', false, false),
    ('tiny_saiu_de_entregue',   'pedidos',   'Pedidos e Tiny',                   36, 'Pedido voltou atrás no Tiny',       'Saiu de "Entregue" no Tiny: a entrega que veio do Tiny reabre; a feita aqui só avisa.', 'logistica', false, false),
    ('pedido_peca_liberada',    'pedidos',   'Pedidos e Tiny',                   37, 'Peça pronta liberada para outro pedido', 'A Expedição deu a peça pronta de um pedido para outro: ele voltou ao PCP para produzir de novo.', 'pcp', false, false),
    ('pedido_voltou_pcp',       'pedidos',   'Pedidos e Tiny',                   38, 'Pedido devolvido ao PCP pela logística', 'O Tiny tinha levado o pedido adiante com produto por liberar: a logística mudou a situação lá e ele voltou ao PCP.', 'pcp', false, false),
    ('pedido_adiantado_tiny',   'pedidos',   'Pedidos e Tiny',                   39, 'Pedido adiantado no Tiny ficou na Expedição', 'A peça pronta saiu do pedido, mas o Tiny já o levou adiante: ele ficou na Expedição esperando a decisão.', 'logistica', false, false),
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

-- fim da base da SESSAO-48
