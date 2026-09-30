-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 42 — ESTOQUE SINCRONIZADO COM O
-- TINY (as duas mostrando o mesmo número) E A VENDA RESERVANDO A PEÇA
-- Ajuste pedido pelo dono em 2026-09-29/30 (conversa) · Decisões: D-76…D-80
--
-- Por que (diagnóstico de 29–30/09, só leitura no banco real):
--   o líder da logística fez o balanço no Tiny (zerou o depósito Geral da
--   fábrica e contou as peças no depósito "Fábrica" da empresa da loja) e a
--   plataforma não mudou: desde a D-70 o número dos acabados é a contagem da
--   plataforma, e o aviso de estoque do Tiny da fábrica só enxerga o depósito
--   Geral da FÁBRICA — o "multiempresa" que a equipe olha é a soma dos quatro
--   depósitos das duas empresas (Geral · Fábrica · Loja · Desmontado).
--   O "reservado" do Tiny não serve (345: 47 no Tiny × 2 em pedidos abertos;
--   174: 0 no Tiny × 6) — o número que vale é o SALDO somado.
--
--   1. TINY → PLATAFORMA (D-76): cada aviso de estoque (da fábrica ou da loja)
--      põe o produto numa FILA; o n8n lê o saldo somado das duas empresas
--      (`produto.obter.estoque` da fábrica) e devolve aqui. Se o Tiny estiver
--      ACIMA do que está no ESTOQUE da plataforma (peças livres + as
--      reservadas para venda), a plataforma sobe até ele (peças novas, motivo
--      'tiny'); se estiver abaixo, nada (a saída se dá pela plataforma). Com o
--      mínimo coberto, a reposição que ainda está no PCP sem nada liberado é
--      arquivada sozinha.
--   2. PLATAFORMA → TINY (D-77): entrada, baixa, contagem, arquivar peça livre,
--      peça que chega ao ESTOQUE (produção/cancelamento), peça livre usada num
--      pedido e o PCP recusar a peça reservada → a fila pede ao n8n que o Tiny
--      fique com o número da plataforma (peças livres), ajustando o depósito
--      "Fábrica" da loja (onde as peças estão e as vendas baixam) para a SOMA
--      dar certo. A venda e o que veio do Tiny não voltam para o Tiny.
--   3. VENDA (D-78): pedido novo da loja (depois de ligar) com peça pronta
--      reserva a peça na hora (o número cai); o pedido segue no PCP com a peça
--      marcada; o PCP liberar para produção desfaz a reserva (e o Tiny recebe
--      a peça de volta); cancelado desfaz sem avisar o Tiny; faturado/enviado/
--      entregue consome a peça (saiu com o pedido).
--   4. PONTO DE PARTIDA (D-79): ligar copia uma vez o saldo somado do Tiny
--      para a plataforma (nos dois sentidos). Tudo nasce DESLIGADO.
--   5. UM FLUXO SÓ no n8n (D-80) — aviso, fila, leitura, ajuste e varredura
--      noturna no workflow do Tiny da fábrica; a carga avulsa do saldo morre.
--
-- Nada muda em clientes/pedidos/pedido_itens/produtos. Em `eventos` a porta
-- do aviso grava o mesmo registro cru que o n8n gravava (tipo estoque_fabrica)
-- e a leitura grava o saldo somado no mesmo formato da carga.
-- ============================================================================

-- Desiste rápido se alguma tela segurar trava (E-66): a migration toca gatilho
-- de plt_eventos e coluna de plt_cards.
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 0 · Pré-requisitos
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.produtos') is null then
    raise exception 'A migration 42 precisa da tabela public.produtos (migration 23 da integração).';
  end if;
  if to_regclass('plt_privado.vw_itens_producao') is null then
    raise exception 'A migration 42 precisa da migration 39 (vw_itens_producao).';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1 · Vocabulário: três fatos novos (E-19: este é o check mais novo — `not
--     valid` aqui, validação de tudo no fim do arquivo; o `validate` saiu da
--     migration 37)
-- ----------------------------------------------------------------------------
do $$
declare
  v_nome text;
begin
  select conname into v_nome
    from pg_constraint
   where conrelid = 'public.plt_eventos'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%card_criado%';
  if v_nome is not null then
    execute format('alter table public.plt_eventos drop constraint %I', v_nome);
  end if;
  alter table public.plt_eventos add constraint plt_eventos_tipo_check
    check (tipo in (
      'card_criado',
      'movimentacao_setor',
      'movimentacao_etapa',
      'execucao_iniciada',
      'execucao_finalizada',
      'execucao_pausada',
      'execucao_retomada',
      'qualidade_marcada',
      'qualidade_parecer',
      'divergencia_registrada',
      'notificacao_enviada',
      'delegacao',
      'estorno',
      'pedido_atualizado',
      'pedido_cancelado',
      'card_arquivado',
      'pedido_entregue',
      'pedido_lancado_rotas',
      'unidade_desvinculada',
      'peca_alocada',
      'peca_reservada',            -- D-78: a venda reservou a peça livre para um pedido
      'peca_reserva_desfeita',     -- D-78: a reserva acabou sem a peça sair (PCP produziu, cancelado, pedido mudou)
      'estoque_reserva_avaliada'   -- D-78: o pedido novo já passou pela reserva (uma vez só, no card do pedido)
    )) not valid;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2 · Colunas novas
--     · a RESERVA da peça (projeção do evento — M-13: escrita só pelo gatilho)
--     · a CHAVE do sincronismo, no ESTOQUE (como a capacidade do galpão — D-72):
--       nula = desligado; preenchida = ligado desde então (e só a venda que
--       chegar depois disso reserva peça — a de antes já está no saldo do Tiny)
-- ----------------------------------------------------------------------------
alter table public.plt_cards add column if not exists reservada_pedido_id bigint;
alter table public.plt_cards add column if not exists reservada_item_seq  integer;
alter table public.plt_cards add column if not exists reservada_indice    integer;
alter table public.plt_cards add column if not exists reservada_em        timestamptz;
alter table public.plt_setores add column if not exists tiny_sincronizado_desde timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plt_cards_reservada_pedido_fk') then
    alter table public.plt_cards
      add constraint plt_cards_reservada_pedido_fk
      foreign key (reservada_pedido_id) references public.pedidos(id);
  end if;
end;
$$;

create index if not exists plt_cards_reservada_idx
  on public.plt_cards (reservada_pedido_id) where reservada_pedido_id is not null;

comment on column public.plt_cards.reservada_pedido_id is
  'D-78: a peça livre do ESTOQUE está reservada para este pedido (a venda chegou e havia peça). Projeção dos eventos peca_reservada / peca_reserva_desfeita / peca_alocada / card_arquivado — não escreva à mão.';
comment on column public.plt_setores.tiny_sincronizado_desde is
  'D-76…D-79 (no ESTOQUE): desde quando o estoque está sincronizado com o Tiny. Nulo = desligado. Liga/desliga pelo admin (plt_fn_tiny_estoque_ligar/desligar).';

-- ----------------------------------------------------------------------------
-- 3 · A FILA do Tiny: uma linha por produto com trabalho pendente (vários
--     movimentos seguidos viram UM pedido ao Tiny — o limite da conta é 60
--     consultas por minuto). Tabela nova de propósito (exceção à D-47): a
--     `tiny_fila` da integração é da conta da LOJA e o consumidor dela (o
--     backfill) pegaria estes itens; aqui é outro token, outro ritmo, outro
--     dono. Só as portas escrevem; RLS ligado sem política (só a maquinaria).
-- ----------------------------------------------------------------------------
create table if not exists public.plt_tiny_estoque_fila (
  produto_tiny_id bigint primary key references public.produtos(tiny_id),
  enviar          boolean not null default false,   -- a plataforma manda: o Tiny fica com o número dela
  copiar          boolean not null default false,   -- ponto de partida: a plataforma fica com o número do Tiny
  motivo          text,
  versao          integer not null default 1,       -- sobe a cada pedido novo (quem terminou velho não apaga o novo)
  pedido_em       timestamptz not null default now(),
  reservado_em    timestamptz,                      -- o n8n pegou (volta à fila depois de 10 min sem resposta)
  tentativas      integer not null default 0,
  ultimo_erro     text,
  parado_em       timestamptz                       -- 5 falhas seguidas: para e aparece na tela
);

alter table public.plt_tiny_estoque_fila enable row level security;
revoke all on table public.plt_tiny_estoque_fila from anon, authenticated;

comment on table public.plt_tiny_estoque_fila is
  'D-76/D-77: fila de trabalho do estoque com o Tiny (um produto por linha). O n8n pega (plt_fn_tiny_estoque_proximos), lê o saldo somado das duas empresas e devolve (plt_fn_tiny_estoque_leitura); quando é para gravar no Tiny, confirma (plt_fn_tiny_estoque_ajustado).';

-- ----------------------------------------------------------------------------
-- 4 · Maquinaria (plt_privado, fora da API — E-11)
-- ----------------------------------------------------------------------------

-- Ligado? (a chave mora no ESTOQUE)
create or replace function plt_privado.fn_tiny_estoque_desde()
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.tiny_sincronizado_desde from public.plt_setores s where s.codigo = 'estoque' limit 1;
$$;

-- Número do Tiny: "1,5" / "1.5" / 1.5 → numeric (nulo se não for número).
create or replace function plt_privado.fn_tiny_numero(p_valor text)
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select case when replace(btrim(coalesce(p_valor, '')), ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$'
              then replace(btrim(p_valor), ',', '.')::numeric end;
$$;

-- Produto acabado do catálogo que o estoque da plataforma conta (D-70).
create or replace function plt_privado.fn_eh_acabado_contado(p_produto_tiny_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.produtos pr
     where pr.tiny_id = p_produto_tiny_id
       and pr.situacao = 'A'
       and coalesce(pr.classe, '') in ('F', 'S', 'V')
       and not plt_privado.fn_eh_personalizado(pr.descricao));
$$;

-- Põe (ou reforça) o produto na fila. Pedidos seguidos somam as intenções
-- (enviar/copiar só ligam) e sobem a versão. Desligado = não faz nada.
create or replace function plt_privado.fn_tiny_estoque_enfileirar(
  p_produto_tiny_id bigint,
  p_enviar          boolean,
  p_motivo          text,
  p_copiar          boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if plt_privado.fn_tiny_estoque_desde() is null
     or p_produto_tiny_id is null
     or not plt_privado.fn_eh_acabado_contado(p_produto_tiny_id) then
    return false;
  end if;

  insert into public.plt_tiny_estoque_fila as f (produto_tiny_id, enviar, copiar, motivo)
    values (p_produto_tiny_id, coalesce(p_enviar, false), coalesce(p_copiar, false), p_motivo)
  on conflict (produto_tiny_id) do update
    set enviar      = f.enviar or excluded.enviar,
        copiar      = f.copiar or excluded.copiar,
        motivo      = excluded.motivo,
        versao      = f.versao + 1,
        pedido_em   = now(),
        tentativas  = case when f.parado_em is not null then 0 else f.tentativas end,
        ultimo_erro = case when f.parado_em is not null then null else f.ultimo_erro end,
        parado_em   = null;
  return true;
end;
$$;

-- As peças do produto no ESTOQUE: livres (a contagem — D-70) e reservadas
-- para venda (D-78). As duas estão fisicamente no galpão.
create or replace function plt_privado.fn_estoque_pecas(p_produto_tiny_id bigint)
returns table (livres integer, reservadas integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*) filter (where c.reservada_pedido_id is null)::int,
         count(*) filter (where c.reservada_pedido_id is not null)::int
    from public.plt_cards c
    join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
   where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
     and c.produto_tiny_id = p_produto_tiny_id
     and not plt_privado.fn_eh_personalizado(c.item_descricao);
$$;

-- Cria N peças livres no ESTOQUE (card sem pedido, com o produto) — o mesmo
-- formato da entrada manual (D-70). Devolve o id da primeira (o "lote").
create or replace function plt_privado.fn_estoque_criar_pecas(
  p_produto_tiny_id bigint,
  p_quantidade      integer,
  p_usuario         uuid,
  p_origem          text,
  p_observacao      text,
  p_dados           jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_produto public.produtos%rowtype;
  v_estoque bigint;
  v_card    bigint;
  v_lote    bigint;
  i         integer;
begin
  if coalesce(p_quantidade, 0) < 1 then
    return null;
  end if;
  select * into v_produto from public.produtos where tiny_id = p_produto_tiny_id;
  select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque' and s.ativo;
  if v_estoque is null or v_produto.tiny_id is null then
    raise exception 'O ESTOQUE ou o produto não estão cadastrados.' using errcode = 'no_data_found';
  end if;
  for i in 1 .. p_quantidade loop
    insert into public.plt_cards
        (tipo, produto_tiny_id, item_codigo, item_descricao, indice_unidade, total_unidades, setor_atual_id)
      values
        ('unidade', p_produto_tiny_id, v_produto.codigo, v_produto.descricao, i, p_quantidade, v_estoque)
      returning id into v_card;
    v_lote := coalesce(v_lote, v_card);
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem, setor_destino_id, observacao, dados)
      values
        (v_card, 'card_criado', p_usuario, p_origem, v_estoque, p_observacao,
         coalesce(p_dados, '{}'::jsonb) || jsonb_build_object('lote', v_lote));
  end loop;
  return v_lote;
end;
$$;

-- Baixa N peças LIVRES (não reservadas), as mais antigas primeiro.
create or replace function plt_privado.fn_estoque_baixar_pecas(
  p_produto_tiny_id bigint,
  p_quantidade      integer,
  p_usuario         uuid,
  p_origem          text,
  p_observacao      text,
  p_dados           jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_estoque bigint;
  v_n       integer := 0;
  r         record;
begin
  if coalesce(p_quantidade, 0) < 1 then
    return 0;
  end if;
  select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque';
  for r in
    select c.id
      from public.plt_cards c
     where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
       and c.reservada_pedido_id is null
       and c.produto_tiny_id = p_produto_tiny_id and c.setor_atual_id = v_estoque
       and not plt_privado.fn_eh_personalizado(c.item_descricao)
     order by c.desde asc nulls first, c.id
     limit p_quantidade
       for update
  loop
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
      values
        (r.id, 'card_arquivado', p_usuario, p_origem, v_estoque, p_observacao, coalesce(p_dados, '{}'::jsonb));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- O id do produto na conta da LOJA (os ids não casam entre contas — A-22):
-- pelo último pedido que vendeu o SKU; senão, pelo último aviso da loja.
create or replace function plt_privado.fn_tiny_id_loja(p_sku text)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select pi.id_produto
       from public.pedido_itens pi
      where pi.codigo = p_sku and pi.id_produto is not null
      order by pi.pedido_id desc
      limit 1),
    (select (e.payload -> 'dados' ->> 'idProduto')::bigint
       from public.eventos e
      where e.tipo = 'estoque_fabrica'
        and coalesce(e.payload ->> 'cnpj', '') <> '27556613000166'
        and e.payload -> 'dados' ->> 'sku' = p_sku
        and (e.payload -> 'dados' ->> 'idProduto') ~ '^[0-9]+$'
      order by e.id desc
      limit 1));
$$;

-- Estoque coberto pelo Tiny: a reposição que ainda está no PCP, sem nenhuma
-- unidade liberada, é arquivada (o exemplo do dono: "removeria os dois cards
-- de necessidade de produção"). Liberada em parte fica com o PCP.
create or replace function plt_privado.fn_estoque_reposicao_coberta(p_produto_tiny_id bigint)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_minimo numeric;
  v_livres integer;
  v_n      integer := 0;
  r        record;
begin
  select coalesce(pr.minimo_plataforma, pr.estoque_minimo) into v_minimo
    from public.produtos pr where pr.tiny_id = p_produto_tiny_id;
  select x.livres into v_livres from plt_privado.fn_estoque_pecas(p_produto_tiny_id) x;
  if coalesce(v_minimo, 0) <= 0 or coalesce(v_livres, 0) < v_minimo then
    return 0;
  end if;
  for r in
    select rc.id, rc.setor_atual_id
      from public.plt_cards rc
     where rc.tipo = 'reposicao' and rc.produto_tiny_id = p_produto_tiny_id
       and rc.arquivado_em is null and rc.liberado_completo_em is null
       and not exists (select 1 from public.plt_cards u where u.card_pai_id = rc.id and u.tipo = 'unidade')
  loop
    insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
      values (r.id, 'card_arquivado', 'api', r.setor_atual_id,
              'O estoque chegou ao mínimo pelo Tiny — a reposição não precisa mais ser produzida.',
              jsonb_build_object('motivo', 'estoque_coberto', 'produto_tiny_id', p_produto_tiny_id,
                                 'livres', v_livres, 'minimo', v_minimo));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Tira o produto da fila quando o trabalho pego é o mais novo; senão devolve
-- (outro pedido chegou no meio — ele será feito). A cópia não se repete.
create or replace function plt_privado.fn_tiny_estoque_concluir(
  p_produto_tiny_id bigint,
  p_versao          integer,
  p_copiou          boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.plt_tiny_estoque_fila
   where produto_tiny_id = p_produto_tiny_id and versao = p_versao;
  if not found then
    update public.plt_tiny_estoque_fila
       set reservado_em = null,
           tentativas   = 0,
           ultimo_erro  = null,
           copiar       = case when p_copiou then false else copiar end
     where produto_tiny_id = p_produto_tiny_id;
  end if;
end;
$$;

-- Falhou: devolve à fila; na 5ª seguida, para e aparece na tela (com a trilha).
create or replace function plt_privado.fn_tiny_estoque_falhou(
  p_produto_tiny_id bigint,
  p_erro            text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tentativas integer;
begin
  update public.plt_tiny_estoque_fila
     set tentativas   = tentativas + 1,
         ultimo_erro  = left(coalesce(p_erro, 'erro sem descrição'), 500),
         reservado_em = null,
         parado_em    = case when tentativas + 1 >= 5 then now() end
   where produto_tiny_id = p_produto_tiny_id
  returning tentativas into v_tentativas;
  if v_tentativas >= 5 then
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
      values (null, 'estoque_tiny_falha',
              jsonb_build_object('produto_tiny_id', p_produto_tiny_id,
                                 'sku', (select codigo from public.produtos where tiny_id = p_produto_tiny_id),
                                 'erro', left(coalesce(p_erro, ''), 500)));
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5 · A RESERVA da peça: projeção (M-13) e a trava de quem escreve
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_projetar_reserva()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo = 'peca_reservada' then
    update public.plt_cards
       set reservada_pedido_id = (new.dados ->> 'pedido_id')::bigint,
           reservada_item_seq  = (new.dados ->> 'item_seq')::int,
           reservada_indice    = (new.dados ->> 'indice_unidade')::int,
           reservada_em        = new.ocorrido_em
     where id = new.card_id;
  else
    update public.plt_cards
       set reservada_pedido_id = null,
           reservada_item_seq  = null,
           reservada_indice    = null,
           reservada_em        = null
     where id = new.card_id and reservada_pedido_id is not null;
  end if;
  return null;
end;
$$;

drop trigger if exists plt_eventos_projetar_reserva on public.plt_eventos;
create trigger plt_eventos_projetar_reserva
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('peca_reservada', 'peca_reserva_desfeita', 'peca_alocada',
                     'card_arquivado', 'unidade_desvinculada'))
  execute function plt_privado.fn_projetar_reserva();

-- Só a maquinaria reserva e desfaz (flag da sessão, como a tarefa do Sistema);
-- e reserva só peça livre, sem dono e sem reserva, no ESTOQUE (vale até para
-- a chave de serviço — M-14).
create or replace function plt_privado.fn_validar_reserva()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.plt_cards%rowtype;
begin
  if coalesce(current_setting('plt.estoque_maquinaria', true), '') <> 'on' then
    raise exception 'A reserva de peça para venda é feita só pela plataforma.'
      using errcode = 'insufficient_privilege';
  end if;
  if new.tipo = 'estoque_reserva_avaliada' then
    return new;
  end if;
  select * into v_card from public.plt_cards where id = new.card_id;
  if new.tipo = 'peca_reservada' then
    if v_card.tipo <> 'unidade' or v_card.pedido_id is not null or v_card.arquivado_em is not null
       or v_card.reservada_pedido_id is not null
       or not exists (select 1 from public.plt_setores s
                       where s.id = v_card.setor_atual_id and s.codigo = 'estoque') then
      raise exception 'Só peça livre do ESTOQUE, sem reserva, pode ser reservada para um pedido.'
        using errcode = 'check_violation';
    end if;
  elsif v_card.reservada_pedido_id is null then
    raise exception 'Esta peça não está reservada.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists plt_eventos_validar_reserva on public.plt_eventos;
create trigger plt_eventos_validar_reserva
  before insert on public.plt_eventos
  for each row
  when (new.tipo in ('peca_reservada', 'peca_reserva_desfeita', 'estoque_reserva_avaliada'))
  execute function plt_privado.fn_validar_reserva();

-- ----------------------------------------------------------------------------
-- 6 · A VENDA (D-78) — rodada a cada minuto (pg_cron), só com o sincronismo
--     ligado. (a) pedido NOVO (card nascido depois de ligar), ainda em aberto/
--     aprovado/preparando envio: cada unidade de produto acabado do catálogo
--     reserva uma peça livre igual (a mais antiga); o pedido fica marcado como
--     avaliado — só se reserva na hora da venda. (b) as reservas vivas
--     acompanham o pedido: cancelado → desfaz (o Tiny devolve sozinho); o PCP
--     liberou a unidade para produção → desfaz e o Tiny recebe a peça de volta
--     (gatilho da seção 7); o item saiu/diminuiu → desfaz; faturado/pronto/
--     enviado/entregue/não entregue → a peça saiu com o pedido (baixa, motivo
--     'venda'). Nada disso manda a VENDA para o Tiny (o Tiny já baixou).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_estoque_reservas_rodar()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_desde       timestamptz;
  v_estoque     bigint;
  v_avaliados   integer := 0;
  v_reservadas  integer := 0;
  v_desfeitas   integer := 0;
  v_consumidas  integer := 0;
  v_itens       jsonb;
  v_peca        bigint;
  v_situacao    text;
  v_motivo      text;
  k             integer;
  r_pc          record;
  r_it          record;
  r             record;
begin
  v_desde := plt_privado.fn_tiny_estoque_desde();
  select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque';
  perform set_config('plt.estoque_maquinaria', 'on', true);

  -- (a) vendas novas — só com o sincronismo ligado (desligado, nenhuma venda
  --     nova reserva; as reservas que já existem seguem acompanhando o pedido)
  for r_pc in
    select pc.id as card_id, pc.pedido_id, p.numero
      from public.plt_cards pc
      join public.pedidos p on p.id = pc.pedido_id
     where v_desde is not null
       and pc.tipo = 'pedido'
       and pc.arquivado_em is null
       and pc.criado_em >= v_desde
       and plt_privado.fn_situacao_reserva_estoque(p.situacao)
       and not exists (select 1 from public.plt_eventos e
                        where e.card_id = pc.id and e.tipo = 'estoque_reserva_avaliada')
     order by pc.id
     limit 200
  loop
    v_itens := '[]'::jsonb;
    for r_it in
      select v.seq, v.codigo, v.descricao, v.unidades,
             plt_privado.fn_produto_do_item(v.codigo, v.descricao) as produto
        from plt_privado.vw_itens_producao v
       where v.pedido_id = r_pc.pedido_id and v.unidades >= 1
       order by v.seq
    loop
      continue when r_it.produto is null or not plt_privado.fn_eh_acabado_contado(r_it.produto);
      perform pg_advisory_xact_lock(hashtextextended('plt_estoque_produto:' || r_it.produto, 0));
      for k in 1 .. r_it.unidades loop
        -- unidade já liberada pelo PCP antes da rodada: não reserva
        continue when exists (select 1 from public.plt_cards u
                               where u.pedido_id = r_pc.pedido_id and u.tipo = 'unidade'
                                 and u.item_seq = r_it.seq and u.indice_unidade = k);
        v_peca := null;
        select c.id into v_peca
          from public.plt_cards c
         where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
           and c.reservada_pedido_id is null
           and c.produto_tiny_id = r_it.produto and c.setor_atual_id = v_estoque
           and coalesce(c.qualidade_atual, 'perfeito') = 'perfeito'
           and not plt_privado.fn_eh_personalizado(c.item_descricao)
         order by c.desde asc nulls first, c.id
         limit 1
           for update skip locked;
        exit when v_peca is null;
        insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
          values (v_peca, 'peca_reservada', 'automacao', v_estoque,
                  format('Reservada para o pedido %s (%s/%s).', r_pc.numero, k, r_it.unidades),
                  jsonb_build_object('pedido_id', r_pc.pedido_id, 'numero', r_pc.numero,
                                     'card_pedido_id', r_pc.card_id, 'item_seq', r_it.seq,
                                     'indice_unidade', k, 'total_unidades', r_it.unidades,
                                     'produto_tiny_id', r_it.produto));
        v_itens := v_itens || jsonb_build_array(jsonb_build_object(
                     'item_seq', r_it.seq, 'indice_unidade', k, 'peca_card_id', v_peca));
        v_reservadas := v_reservadas + 1;
      end loop;
      -- Lê o Tiny depois da venda (só leitura): confirma como o Tiny baixa a
      -- venda e pega o que tiver mudado lá.
      perform plt_privado.fn_tiny_estoque_enfileirar(r_it.produto, false, 'venda');
    end loop;
    insert into public.plt_eventos (card_id, tipo, origem, dados)
      values (r_pc.card_id, 'estoque_reserva_avaliada', 'automacao',
              jsonb_build_object('reservadas', v_itens));
    v_avaliados := v_avaliados + 1;
  end loop;

  -- (b) as reservas vivas acompanham o pedido
  for r in
    select c.id, c.setor_atual_id, c.produto_tiny_id,
           c.reservada_pedido_id as pedido_id, c.reservada_item_seq as seq,
           c.reservada_indice as k, p.numero, p.situacao
      from public.plt_cards c
      join public.pedidos p on p.id = c.reservada_pedido_id
     where c.reservada_pedido_id is not null and c.arquivado_em is null
     order by c.id
  loop
    v_situacao := plt_privado.fn_situacao_normalizada(r.situacao);
    v_motivo := null;
    if v_situacao = 'cancelado' then
      v_motivo := 'pedido_cancelado';
    elsif exists (select 1 from public.plt_cards u
                   where u.pedido_id = r.pedido_id and u.tipo = 'unidade'
                     and u.item_seq = r.seq and u.indice_unidade = r.k) then
      v_motivo := 'pcp_produzir';
    elsif not exists (select 1 from plt_privado.vw_itens_producao v
                       where v.pedido_id = r.pedido_id and v.seq = r.seq and v.unidades >= r.k
                         and plt_privado.fn_produto_do_item(v.codigo, v.descricao) = r.produto_tiny_id) then
      v_motivo := 'pedido_alterado';
    end if;

    if v_motivo is not null then
      insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
        values (r.id, 'peca_reserva_desfeita', 'automacao', r.setor_atual_id,
                case v_motivo
                  when 'pedido_cancelado' then format('O pedido %s foi cancelado — a peça volta a ficar livre.', r.numero)
                  when 'pcp_produzir'     then format('O PCP mandou produzir o pedido %s — a peça volta a ficar livre.', r.numero)
                  else format('O pedido %s mudou no Tiny — a peça volta a ficar livre.', r.numero)
                end,
                jsonb_build_object('motivo', v_motivo, 'pedido_id', r.pedido_id, 'numero', r.numero,
                                   'item_seq', r.seq, 'indice_unidade', r.k,
                                   'produto_tiny_id', r.produto_tiny_id));
      v_desfeitas := v_desfeitas + 1;
    elsif not plt_privado.fn_situacao_reserva_estoque(r.situacao) then
      -- faturado / pronto para envio / enviado / entregue / não entregue: saiu
      -- com o pedido. Arquivar sem pessoa é o caminho da integração (E-26).
      insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
        values (r.id, 'card_arquivado', 'api', r.setor_atual_id,
                format('Saiu com o pedido %s (%s no Tiny).', r.numero, r.situacao),
                jsonb_build_object('motivo', 'venda', 'pedido_id', r.pedido_id, 'numero', r.numero,
                                   'item_seq', r.seq, 'indice_unidade', r.k,
                                   'produto_tiny_id', r.produto_tiny_id));
      v_consumidas := v_consumidas + 1;
    end if;
  end loop;

  return jsonb_build_object('ligado', v_desde is not null, 'pedidos_avaliados', v_avaliados,
                            'reservadas', v_reservadas, 'desfeitas', v_desfeitas,
                            'consumidas', v_consumidas);
end;
$$;

comment on function plt_privado.fn_estoque_reservas_rodar() is
  'D-78: a cada minuto (com o sincronismo ligado) — a venda nova reserva peça livre igual; a reserva acompanha o pedido (cancelado/PCP produziu/pedido mudou → desfaz; faturado em diante → a peça sai com o pedido).';

-- ----------------------------------------------------------------------------
-- 7 · PLATAFORMA → TINY (D-77): o que muda o ESTOQUE por gesto ou fato da
--     plataforma põe o produto na fila para o Tiny ficar igual. NÃO vão: o
--     que veio do Tiny (motivo 'tiny'/'tiny_copia'), a venda (reserva e
--     consumo — o Tiny já baixou), a reserva desfeita por cancelamento ou
--     pedido alterado (o Tiny devolve sozinho) e a peça reservada usada no
--     próprio pedido. O "zzz" no nome é de propósito: roda depois dos outros
--     gatilhos (o do cancelamento tira o pedido da peça antes).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tiny_estoque_marcar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_estoque bigint;
  v_produto bigint;
  v_motivo  text;
  v_manda   boolean := false;
begin
  if plt_privado.fn_tiny_estoque_desde() is null then
    return null;
  end if;
  select * into v_card from public.plt_cards where id = new.card_id;
  if v_card.tipo is distinct from 'unidade' then
    return null;
  end if;
  select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque';
  v_motivo := coalesce(new.dados ->> 'motivo', '');

  if new.tipo = 'card_criado' then
    v_manda := new.setor_destino_id = v_estoque and v_card.pedido_id is null
               and v_motivo not in ('tiny', 'tiny_copia');
  elsif new.tipo = 'card_arquivado' then
    v_manda := v_card.setor_atual_id = v_estoque and v_card.pedido_id is null
               and v_motivo not in ('tiny', 'tiny_copia', 'venda');
  elsif new.tipo = 'movimentacao_setor' then
    v_manda := (new.setor_destino_id = v_estoque or new.setor_origem_id = v_estoque)
               and new.setor_destino_id is distinct from new.setor_origem_id;
  elsif new.tipo = 'peca_reserva_desfeita' then
    v_manda := v_motivo = 'pcp_produzir';
  elsif new.tipo = 'peca_alocada' then
    v_manda := coalesce((new.dados ->> 'reservada')::boolean, false) = false;
  end if;

  if v_manda then
    v_produto := coalesce(v_card.produto_tiny_id,
                          plt_privado.fn_produto_do_item(v_card.item_codigo, v_card.item_descricao));
    perform plt_privado.fn_tiny_estoque_enfileirar(
      v_produto, true,
      case new.tipo
        when 'card_criado'           then coalesce(nullif(v_motivo, ''), 'entrada')
        when 'card_arquivado'        then coalesce(nullif(v_motivo, ''), 'baixa')
        when 'movimentacao_setor'    then 'chegada_ou_saida'
        when 'peca_reserva_desfeita' then 'pcp_produzir'
        else 'peca_usada_no_pedido'
      end);
  end if;
  return null;
end;
$$;

drop trigger if exists plt_eventos_zzz_tiny_estoque on public.plt_eventos;
create trigger plt_eventos_zzz_tiny_estoque
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('card_criado', 'card_arquivado', 'movimentacao_setor',
                     'peca_reserva_desfeita', 'peca_alocada'))
  execute function plt_privado.fn_tiny_estoque_marcar();

-- ----------------------------------------------------------------------------
-- 8 · A base do estoque (recriada POR INTEIRO a partir da migration 40 —
--     mesma forma): LIVRES = peças do ESTOQUE sem reserva; a peça reservada
--     para venda conta em "reservadas" (junto com as de Pedidos em aguardo).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_estoque_por_produto()
returns table (
  tiny_id              bigint,
  codigo               text,
  descricao            text,
  classe               text,
  unidade              text,
  situacao             text,
  minimo               numeric,
  saldo_tiny           numeric,
  reservado_tiny       numeric,
  lido_em              timestamptz,
  origem_leitura       text,
  evento_leitura_id    bigint,
  reservas_loja        numeric,
  disponivel           numeric,
  prontos_reservados   integer,
  prontos_livres       integer,
  reposicao_card_id    bigint,
  reposicao_estado     text,
  reposicao_quantidade integer,
  reposicao_liberadas  integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with estoque as (
    select s.id from public.plt_setores s where s.codigo = 'estoque'
  ),
  leituras as (
    select * from plt_privado.fn_leituras_tiny()
  ),
  -- SKU → produto ATIVO do catálogo (o SKU não se repete entre os ativos)
  por_sku as (
    select distinct on (pr.codigo) pr.codigo, pr.tiny_id
      from public.produtos pr
     where pr.codigo is not null and pr.situacao = 'A'
     order by pr.codigo, pr.tiny_id
  ),
  reservas as (
    select ps.tiny_id, sum(pi.quantidade) as quantidade
      from public.pedidos p
      join public.pedido_itens pi on pi.pedido_id = p.id
      join por_sku ps on ps.codigo = pi.codigo
     where plt_privado.fn_situacao_reserva_estoque(p.situacao)
       and not plt_privado.fn_eh_personalizado(pi.descricao)
     group by ps.tiny_id
  ),
  reservados as (
    select x.tiny_id, sum(x.quantidade)::int as quantidade
      from (
        -- SESSAO-24: a peça pronta de pedido mora em Pedidos em aguardo.
        select ps.tiny_id, count(*)::int as quantidade
          from public.plt_cards c
          join public.plt_setores s on s.id = c.setor_atual_id
                                   and s.papel_no_fluxo = 'terminal' and s.codigo <> 'rotas'
          join por_sku ps on ps.codigo = c.item_codigo
         where c.tipo = 'unidade' and c.pedido_id is not null and c.arquivado_em is null
           and not plt_privado.fn_eh_personalizado(c.item_descricao)
         group by ps.tiny_id
        union all
        -- D-78: a peça do ESTOQUE reservada para uma venda.
        select c.produto_tiny_id, count(*)::int
          from public.plt_cards c
         where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
           and c.reservada_pedido_id is not null and c.produto_tiny_id is not null
           and c.setor_atual_id in (select id from estoque)
         group by c.produto_tiny_id
      ) x
     group by x.tiny_id
  ),
  livres as (
    select c.produto_tiny_id as tiny_id, count(*)::int as quantidade
      from public.plt_cards c
     where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
       and c.reservada_pedido_id is null
       and c.produto_tiny_id is not null
       and not plt_privado.fn_eh_personalizado(c.item_descricao)
       and c.setor_atual_id in (select id from estoque)
     group by c.produto_tiny_id
  ),
  reposicao as (
    select distinct on (rc.produto_tiny_id)
           rc.produto_tiny_id as tiny_id,
           rc.id              as card_id,
           rc.total_unidades  as quantidade,
           u.liberadas,
           case
             when rc.arquivado_em is not null      then 'arquivada'
             when rc.liberado_completo_em is null  then 'no_pcp'
             when u.em_producao > 0                then 'em_producao'
             else 'concluida'
           end                as estado
      from public.plt_cards rc
      left join lateral (
        select count(*)::int as liberadas,
               count(*) filter (where cu.arquivado_em is null and cu.concluido_em is null)::int as em_producao
          from public.plt_cards cu
         where cu.card_pai_id = rc.id and cu.tipo = 'unidade'
      ) u on true
     where rc.tipo = 'reposicao'
     order by rc.produto_tiny_id, rc.id desc
  )
  select pr.tiny_id,
         pr.codigo,
         pr.descricao,
         pr.classe,
         pr.unidade,
         pr.situacao,
         -- D-72: o mínimo da plataforma manda; sem ele, vale o do Tiny.
         coalesce(pr.minimo_plataforma, pr.estoque_minimo)      as minimo,
         l.saldo                                                as saldo_tiny,
         l.reservado_tiny,
         l.lido_em,
         l.origem                                               as origem_leitura,
         l.evento_id                                            as evento_leitura_id,
         coalesce(r.quantidade, 0)                              as reservas_loja,
         -- D-70: nos ACABADOS o número é a contagem da plataforma (peças
         -- livres no ESTOQUE, sem as reservadas para venda — D-78); nos
         -- insumos segue o Tiny − reservas (a tela nunca mostra negativo — D-53).
         case when coalesce(pr.classe, '') in ('F', 'S', 'V')
              then coalesce(lv.quantidade, 0)::numeric
              when l.saldo is not null
              then l.saldo - coalesce(r.quantidade, 0) end      as disponivel,
         coalesce(rv.quantidade, 0)                             as prontos_reservados,
         coalesce(lv.quantidade, 0)                             as prontos_livres,
         rp.card_id                                             as reposicao_card_id,
         rp.estado                                              as reposicao_estado,
         rp.quantidade                                          as reposicao_quantidade,
         rp.liberadas                                           as reposicao_liberadas
    from public.produtos pr
    left join leituras   l  on l.tiny_id  = pr.tiny_id
    left join reservas   r  on r.tiny_id  = pr.tiny_id
    left join reservados rv on rv.tiny_id = pr.tiny_id
    left join livres     lv on lv.tiny_id = pr.tiny_id
    left join reposicao  rp on rp.tiny_id = pr.tiny_id;
$$;

comment on function plt_privado.fn_estoque_por_produto() is
  'A base única do estoque por produto. Acabados: disponível = peças livres no ESTOQUE, sem as reservadas para venda (D-70/D-78); reservadas = Pedidos em aguardo + reservadas para venda. Insumos: saldo do Tiny − reservas da loja. Mínimo efetivo = o da plataforma, senão o do Tiny (D-72).';

-- ----------------------------------------------------------------------------
-- 9 · ENTRADA / BAIXA / CONTAGEM (recriada a partir da migration 40): a baixa
--     e a contagem só mexem em peça LIVRE; a CONTAGEM é física — inclui as
--     peças reservadas para venda que ainda estão no galpão.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_estoque_movimentar(
  p_produto_tiny_id bigint,
  p_operacao        text,             -- 'entrada' | 'baixa' | 'contagem'
  p_quantidade      integer,          -- entrada/baixa: 1–500; contagem: 0–500 (o total contado)
  p_observacao      text default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario    uuid;
  v_produto    public.produtos%rowtype;
  v_estoque    bigint;
  v_atual      integer;
  v_reservadas integer;
  v_delta      integer;
  v_motivo     text;
  v_obs        text;
  v_dados      jsonb;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma movimenta o estoque.'
      using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Movimentar o estoque é gesto da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_operacao is null or p_operacao not in ('entrada', 'baixa', 'contagem') then
    raise exception 'Escolha entrada, baixa ou contagem.' using errcode = 'check_violation';
  end if;
  -- O CASE vai entre parênteses: no IF do plpgsql, o primeiro THEN solto
  -- fecha a condição (E-61).
  if p_quantidade is null or p_quantidade > 500
     or p_quantidade < (case when p_operacao = 'contagem' then 0 else 1 end) then
    raise exception 'A quantidade precisa ser um número inteiro de % a 500.',
      case when p_operacao = 'contagem' then 0 else 1 end
      using errcode = 'check_violation';
  end if;

  select * into v_produto from public.produtos where tiny_id = p_produto_tiny_id;
  if not found then
    raise exception 'Produto não encontrado no catálogo.' using errcode = 'no_data_found';
  end if;
  if coalesce(v_produto.situacao, '') <> 'A' then
    raise exception 'Este produto está inativo no Tiny — não entra no estoque.'
      using errcode = 'check_violation';
  end if;
  if coalesce(v_produto.classe, '') not in ('F', 'S', 'V') then
    raise exception 'A contagem daqui é de produto acabado — matéria-prima e insumo seguem pelo Tiny.'
      using errcode = 'check_violation';
  end if;
  if plt_privado.fn_eh_personalizado(v_produto.descricao) then
    raise exception 'Produto personalizado não entra no estoque por aqui.'
      using errcode = 'check_violation';
  end if;

  select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque' and s.ativo;
  if v_estoque is null then
    raise exception 'O ESTOQUE não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  -- Uma movimentação por vez em cada produto (duas baixas ao mesmo tempo não
  -- pegam a mesma peça; a reserva da venda espera a vez).
  perform pg_advisory_xact_lock(hashtextextended('plt_estoque_produto:' || p_produto_tiny_id, 0));

  select x.livres, x.reservadas into v_atual, v_reservadas
    from plt_privado.fn_estoque_pecas(p_produto_tiny_id) x;

  if p_operacao = 'contagem' and p_quantidade < v_reservadas then
    raise exception 'Há % peça(s) deste produto reservada(s) para pedidos no galpão — a contagem não pode ser menor. Se alguma já saiu, o pedido resolve.', v_reservadas
      using errcode = 'check_violation';
  end if;

  v_delta := case p_operacao
               when 'entrada' then p_quantidade
               when 'baixa'   then -p_quantidade
               else p_quantidade - v_reservadas - v_atual
             end;
  v_motivo := case p_operacao
                when 'entrada' then 'entrada_manual'
                when 'baixa'   then 'baixa_manual'
                else 'contagem'
              end;
  v_obs := nullif(btrim(coalesce(p_observacao, '')), '');

  if v_delta < 0 and -v_delta > v_atual then
    raise exception 'Só há % deste produto no estoque — não dá para dar baixa em %.', v_atual, -v_delta
      using errcode = 'check_violation';
  end if;

  v_dados := jsonb_strip_nulls(jsonb_build_object(
    'motivo',          v_motivo,
    'produto_tiny_id', p_produto_tiny_id,
    'sku',             v_produto.codigo,
    'quantidade',      abs(v_delta),
    'antes',           v_atual,
    'depois',          v_atual + v_delta,
    'reservadas',      nullif(v_reservadas, 0),
    'contado',         case when p_operacao = 'contagem' then p_quantidade end));

  if v_delta = 0 then
    -- Contagem conferida e igual: nada muda no estoque, fica o registro (D-40).
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
      values (v_usuario, 'estoque_contagem_conferida', v_dados);
    -- D-77: a contagem conferida também põe o Tiny igual à plataforma.
    perform plt_privado.fn_tiny_estoque_enfileirar(p_produto_tiny_id, true, 'contagem_conferida');
    return v_atual;
  end if;

  if v_delta > 0 then
    perform plt_privado.fn_estoque_criar_pecas(p_produto_tiny_id, v_delta, v_usuario,
                                               'interface', v_obs, v_dados);
  else
    perform plt_privado.fn_estoque_baixar_pecas(p_produto_tiny_id, -v_delta, v_usuario,
                                                'interface', v_obs, v_dados);
  end if;

  return v_atual + v_delta;
end;
$$;

comment on function public.plt_fn_estoque_movimentar(bigint, text, integer, text) is
  'Entrada / baixa / contagem manual do estoque de um produto acabado (D-70). Entrada cria peças livres; baixa arquiva as livres mais antigas; contagem (física — inclui as reservadas para venda) acerta a diferença. Com o sincronismo ligado, o Tiny fica igual (D-77). Gate da logística; devolve as livres depois.';

-- ----------------------------------------------------------------------------
-- 10 · A sugestão do estoque na liberação (drop + create — forma nova, E-17;
--      as migrations 37 e 39 ganharam o drop antes do create): a vaga que tem
--      peça RESERVADA para este pedido vem com ela e `reservada = true` (a
--      tela já marca); as outras vagas recebem peça livre sem reserva, como
--      antes (D-62: desmarcada).
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_sugestoes_alocacao(bigint);
create function public.plt_fn_sugestoes_alocacao(p_card_id bigint)
returns table (
  item_seq           integer,
  indice_unidade     integer,
  total_unidades     integer,
  peca_card_id       bigint,
  peca_origem        text,
  peca_origem_numero integer,
  pecas_iguais       integer,
  reservada          boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with alvo as (
    select pc.id, pc.pedido_id
      from public.plt_cards pc
     where pc.id = p_card_id
       and pc.tipo = 'pedido'
       and pc.arquivado_em is null
       and pc.lancado_rotas_em is null
       and plt_privado.fn_pode_ver_expedicao()
       and not plt_privado.fn_pedido_cancelado(pc.pedido_id)
  ),
  itens as (
    -- D-63: frete não é vaga (vw_itens_producao: unidades = 0).
    select v.seq, v.unidades as n,
           plt_privado.fn_chave_peca(plt_privado.fn_produto_do_item(v.codigo, v.descricao),
                                     v.codigo, v.descricao) as chave
      from plt_privado.vw_itens_producao v
      join alvo a on a.pedido_id = v.pedido_id
     where v.unidades >= 1
  ),
  vagas as (
    select i.seq, k.k, i.n, i.chave
      from itens i
      cross join lateral generate_series(1, i.n) as k(k)
     where not exists (
       select 1 from public.plt_cards u, alvo a
        where u.pedido_id = a.pedido_id and u.tipo = 'unidade'
          and u.item_seq = i.seq and u.indice_unidade = k.k)
  ),
  -- D-78: a peça que a venda reservou para ESTA vaga.
  reservas as (
    select c.id, c.card_pai_id, c.reservada_item_seq as seq, c.reservada_indice as k
      from public.plt_cards c
      join alvo a on a.pedido_id = c.reservada_pedido_id
     where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
  ),
  vagas_livres as (
    select v.*, row_number() over (partition by v.chave order by v.seq, v.k) as ordem
      from vagas v
     where not exists (select 1 from reservas r where r.seq = v.seq and r.k = v.k)
  ),
  livres as (
    select c.id, c.desde, c.card_pai_id,
           plt_privado.fn_chave_peca(c.produto_tiny_id, c.item_codigo, c.item_descricao) as chave
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
     where exists (select 1 from alvo)
       and c.tipo = 'unidade'
       and c.pedido_id is null
       and c.arquivado_em is null
       and c.reservada_pedido_id is null
       and coalesce(c.qualidade_atual, 'perfeito') = 'perfeito'
  ),
  pecas as (
    select l.*,
           row_number() over (partition by l.chave order by l.desde, l.id) as ordem,
           count(*) over (partition by l.chave)                             as iguais
      from livres l
  ),
  escolhas as (
    select v.seq, v.k, v.n, r.id as peca, r.card_pai_id,
           (select count(*) from reservas) + coalesce((select max(p.iguais) from pecas p where p.chave = v.chave), 0) as iguais,
           true as reservada
      from vagas v
      join reservas r on r.seq = v.seq and r.k = v.k
    union all
    select v.seq, v.k, v.n, p.id, p.card_pai_id, p.iguais, false
      from vagas_livres v
      join pecas p on p.chave = v.chave and p.ordem = v.ordem
  )
  select e.seq,
         e.k,
         e.n,
         e.peca,
         case when pai.tipo = 'reposicao' then 'reposicao'
              when pai.tipo = 'pedido'    then 'cancelamento'
              else 'manual' end,
         case when pai.tipo = 'pedido' then ped.numero end,
         e.iguais::int,
         e.reservada
    from escolhas e
    left join public.plt_cards pai on pai.id = e.card_pai_id
    left join public.pedidos ped on ped.id = pai.pedido_id
   order by e.seq, e.k;
$$;

comment on function public.plt_fn_sugestoes_alocacao(bigint) is
  'Sugestão do estoque na liberação (D-62): por vaga (k/n) ainda não liberada, a peça reservada para este pedido pela venda (reservada = true — D-78) ou uma peça livre igual. Só sugestão — quem decide é o PCP.';

-- ----------------------------------------------------------------------------
-- 11 · Usar a peça no pedido (recriada POR INTEIRO a partir da migration 39):
--      aceita a peça reservada para ESTE pedido; recusa a reservada para
--      outro. O fato diz se ela era a reservada (sem ir ao Tiny) ou uma livre
--      (o Tiny fica igual — D-77).
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_alocar_peca(
  p_card_pedido_id bigint,
  p_item_seq       integer,
  p_indice_unidade integer,
  p_peca_card_id   bigint
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario  uuid;
  v_pc       public.plt_cards%rowtype;
  v_peca     public.plt_cards%rowtype;
  v_codigo   text;
  v_descricao text;
  v_n        integer;
  v_estoque  bigint;
  v_aguardo  bigint;
  v_numero   integer;
  v_origem   text;
  v_novo     bigint;
  v_reservada boolean;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma usa peça do estoque.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Usar peça do estoque num pedido é gesto do PCP/logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_pc from public.plt_cards
   where id = p_card_pedido_id and tipo = 'pedido' and arquivado_em is null
   for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_pedido_id using errcode = 'no_data_found';
  end if;
  if v_pc.lancado_rotas_em is not null then
    raise exception 'Este pedido já foi lançado para ROTAS.' using errcode = 'check_violation';
  end if;
  if plt_privado.fn_pedido_cancelado(v_pc.pedido_id) then
    raise exception 'O pedido foi cancelado no Tiny — não recebe peça do estoque.' using errcode = 'check_violation';
  end if;

  -- D-63: item de frete não tem unidade (vw_itens_producao: unidades = 0).
  select v.codigo, v.descricao, v.unidades
    into v_codigo, v_descricao, v_n
    from plt_privado.vw_itens_producao v
   where v.pedido_id = v_pc.pedido_id and v.seq = p_item_seq
     and v.unidades >= 1;
  if v_n is null or p_indice_unidade is null or p_indice_unidade < 1 or p_indice_unidade > v_n then
    raise exception 'Esta unidade não existe no pedido.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.plt_cards u
              where u.pedido_id = v_pc.pedido_id and u.tipo = 'unidade'
                and u.item_seq = p_item_seq and u.indice_unidade = p_indice_unidade) then
    raise exception 'Esta unidade do pedido já foi liberada.' using errcode = 'check_violation';
  end if;

  select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque';
  select s.id into v_aguardo from public.plt_setores s where s.codigo = 'aguardo' and s.ativo;
  if v_aguardo is null then
    raise exception 'Pedidos em aguardo não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  select * into v_peca from public.plt_cards where id = p_peca_card_id for update;
  if not found or v_peca.tipo <> 'unidade' or v_peca.pedido_id is not null
     or v_peca.arquivado_em is not null or v_peca.setor_atual_id is distinct from v_estoque then
    raise exception 'Esta peça não está livre no ESTOQUE (alguém pode ter usado antes).'
      using errcode = 'check_violation';
  end if;
  -- D-78: a peça reservada para OUTRO pedido não serve; a deste, sim.
  if v_peca.reservada_pedido_id is not null and v_peca.reservada_pedido_id <> v_pc.pedido_id then
    raise exception 'Esta peça está reservada para outro pedido.' using errcode = 'check_violation';
  end if;
  v_reservada := v_peca.reservada_pedido_id is not null;
  if coalesce(v_peca.qualidade_atual, 'perfeito') <> 'perfeito' then
    raise exception 'Só peça em perfeito estado vai para um pedido.' using errcode = 'check_violation';
  end if;
  if plt_privado.fn_chave_peca(v_peca.produto_tiny_id, v_peca.item_codigo, v_peca.item_descricao)
     <> plt_privado.fn_chave_peca(plt_privado.fn_produto_do_item(v_codigo, v_descricao), v_codigo, v_descricao) then
    raise exception 'A peça do estoque não é igual ao item do pedido (produto, cor e medidas).'
      using errcode = 'check_violation';
  end if;

  select p.numero into v_numero from public.pedidos p where p.id = v_pc.pedido_id;
  select case when pai.tipo = 'reposicao' then 'reposicao' else 'cancelamento' end
    into v_origem
    from public.plt_cards pai where pai.id = v_peca.card_pai_id;

  -- A unidade do pedido nasce PRONTA, direto no aguardo (não volta à produção).
  insert into public.plt_cards
      (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao,
       indice_unidade, total_unidades, produto_tiny_id, setor_atual_id)
    values
      ('unidade', v_pc.pedido_id, v_pc.id, p_item_seq, v_codigo, v_descricao,
       p_indice_unidade, v_n, v_peca.produto_tiny_id, v_aguardo)
    returning id into v_novo;

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id, observacao, dados)
    values (v_novo, 'card_criado', v_usuario, 'interface', v_aguardo,
            'Veio do estoque: peça pronta sem dono usada pelo pedido.',
            jsonb_build_object('alocada_de', v_peca.id,
                               'origem_peca', coalesce(v_origem, 'manual'),
                               'pedido_id', v_pc.pedido_id,
                               'numero', v_numero,
                               'reservada', v_reservada));

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
    values (v_peca.id, 'peca_alocada', v_usuario, 'interface', v_peca.setor_atual_id,
            'Usada pelo pedido ' || coalesce(v_numero::text, '')
              || format(' (%s/%s)', p_indice_unidade, v_n) || '.',
            jsonb_build_object('pedido_id', v_pc.pedido_id,
                               'numero', v_numero,
                               'card_pedido_id', v_pc.id,
                               'unidade_card_id', v_novo,
                               'item_seq', p_item_seq,
                               'indice_unidade', p_indice_unidade,
                               'reservada', v_reservada));
  return v_novo;
end;
$$;

-- ----------------------------------------------------------------------------
-- 12 · As PEÇAS no ESTOQUE (drop + create — ganhou a reserva; a migration 37
--      já dropa antes de criar, então a reaplicação fecha): cada peça livre
--      diz se está reservada e para qual pedido.
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_estoque(text, integer, integer, bigint, text);
create function public.plt_fn_estoque(
  p_busca           text    default null,
  p_limite          integer default 20,
  p_deslocamento    integer default 0,
  p_produto_tiny_id bigint  default null,
  p_dono            text    default null
)
returns table (
  card_id           bigint,
  dono              text,
  pedido_id         bigint,
  numero            integer,
  item_codigo       text,
  item_descricao    text,
  indice_unidade    integer,
  total_unidades    integer,
  produto_tiny_id   bigint,
  reposicao_card_id bigint,
  origem            text,
  origem_numero     integer,
  local             text,
  id_producao       text,
  qualidade_atual   text,
  desde             timestamptz,
  reservada_numero  integer,
  contagem_total    bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with alvo as (
    select pr.tiny_id, pr.codigo from public.produtos pr where pr.tiny_id = p_produto_tiny_id
  )
  select c.id                                                          as card_id,
         case when c.pedido_id is null then 'livre' else 'pedido' end  as dono,
         c.pedido_id,
         p.numero,
         c.item_codigo,
         c.item_descricao,
         c.indice_unidade,
         c.total_unidades,
         c.produto_tiny_id,
         case when pai.tipo = 'reposicao' then pai.id end              as reposicao_card_id,
         case when c.pedido_id is not null then 'pedido'
              when pai.tipo = 'reposicao'  then 'reposicao'
              when pai.tipo = 'pedido'     then 'cancelamento'
              else 'manual' end                                        as origem,
         case when c.pedido_id is null and pai.tipo = 'pedido'
              then po.numero end                                       as origem_numero,
         s.codigo                                                      as local,
         c.id_producao,
         c.qualidade_atual,
         c.desde,
         pr_res.numero                                                 as reservada_numero,
         count(*) over ()                                              as contagem_total
    from public.plt_cards c
    join public.plt_setores s on s.id = c.setor_atual_id
    left join public.pedidos p on p.id = c.pedido_id
    left join public.plt_cards pai on pai.id = c.card_pai_id
    left join public.pedidos po on po.id = pai.pedido_id
    left join public.pedidos pr_res on pr_res.id = c.reservada_pedido_id
   where plt_privado.fn_pode_ver_expedicao()
     and c.tipo = 'unidade'
     and c.arquivado_em is null
     and (s.codigo = 'estoque' or (s.codigo = 'aguardo' and c.pedido_id is not null))
     and (p_dono is null
          or (p_dono = 'livre'  and c.pedido_id is null)
          or (p_dono = 'pedido' and c.pedido_id is not null))
     and (p_produto_tiny_id is null
          or (c.produto_tiny_id = p_produto_tiny_id
              and not plt_privado.fn_eh_personalizado(c.item_descricao))
          or (c.pedido_id is not null
              and c.item_codigo = (select a.codigo from alvo a)
              and not plt_privado.fn_eh_personalizado(c.item_descricao)))
     and (p_busca is null or btrim(p_busca) = ''
          or c.id_producao ilike '%' || btrim(p_busca) || '%'
          or c.item_descricao ilike '%' || btrim(p_busca) || '%'
          or c.item_codigo ilike btrim(p_busca) || '%'
          or p.numero::text like btrim(p_busca) || '%'
          or po.numero::text like btrim(p_busca) || '%'
          or pr_res.numero::text like btrim(p_busca) || '%')
   order by c.desde asc nulls last, c.id
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_estoque(text, integer, integer, bigint, text) is
  'Peças no ESTOQUE (livres, sem dono — com a reserva para venda, quando houver — D-78) e em Pedidos em aguardo (com pedido). Paginada; gate da logística.';

-- ----------------------------------------------------------------------------
-- 13 · As PORTAS do n8n (D-76/D-77/D-80 — um fluxo só). Execute só para a
--      chave de serviço: nenhuma pessoa chama estas.
-- ----------------------------------------------------------------------------

-- O aviso de "lançamentos de estoque" do Tiny (da fábrica OU da loja): grava o
-- corpo cru em `eventos` (o mesmo registro que o n8n gravava) e, com o
-- sincronismo ligado, põe o produto acabado na fila para ler.
create or replace function public.plt_fn_tiny_estoque_aviso(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cnpj    text;
  v_dados   jsonb;
  v_produto bigint;
  v_fila    boolean := false;
begin
  insert into public.eventos (tipo, payload) values ('estoque_fabrica', coalesce(p, '{}'::jsonb));

  v_cnpj  := regexp_replace(coalesce(p ->> 'cnpj', ''), '[^0-9]', '', 'g');
  v_dados := coalesce(p -> 'dados', '{}'::jsonb);
  if v_cnpj = '27556613000166' then
    -- conta da FÁBRICA: o id do produto é o do catálogo
    if (v_dados ->> 'idProduto') ~ '^[0-9]+$' then
      select pr.tiny_id into v_produto
        from public.produtos pr where pr.tiny_id = (v_dados ->> 'idProduto')::bigint;
    end if;
  elsif v_cnpj <> '' then
    -- outra empresa do grupo (a loja): os ids não casam entre contas — pelo SKU (A-22)
    v_produto := plt_privado.fn_produto_do_item(nullif(btrim(v_dados ->> 'sku'), ''), v_dados ->> 'nome');
  end if;

  if v_produto is not null then
    v_fila := plt_privado.fn_tiny_estoque_enfileirar(v_produto, false, 'aviso');
  end if;
  return jsonb_build_object('registrado', true, 'produto_tiny_id', v_produto, 'na_fila', v_fila);
end;
$$;

-- O próximo lote da fila (reserva por 10 min; quem trava por mais tempo volta).
create or replace function public.plt_fn_tiny_estoque_proximos(p_limite integer default 20)
returns table (produto_tiny_id bigint, versao integer, sku text, enviar boolean, copiar boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if plt_privado.fn_tiny_estoque_desde() is null then
    return;
  end if;
  return query
    with alvo as (
      select f.produto_tiny_id
        from public.plt_tiny_estoque_fila f
       where f.parado_em is null
         and (f.reservado_em is null or f.reservado_em < now() - interval '10 minutes')
       order by f.copiar desc, f.enviar desc, f.pedido_em
       limit least(greatest(coalesce(p_limite, 20), 1), 50)
         for update skip locked
    )
    update public.plt_tiny_estoque_fila f
       set reservado_em = now()
      from alvo
     where f.produto_tiny_id = alvo.produto_tiny_id
    returning f.produto_tiny_id, f.versao,
              (select pr.codigo from public.produtos pr where pr.tiny_id = f.produto_tiny_id),
              f.enviar, f.copiar;
end;
$$;

-- A leitura do Tiny (a resposta crua do produto.obter.estoque da FÁBRICA, que
-- traz o saldo somado das duas empresas e cada depósito). Decide:
--   copiar → a plataforma fica com o saldo do Tiny (nos dois sentidos — D-79);
--   enviar → devolve o AJUSTE para o n8n gravar no Tiny (D-77);
--   ler    → Tiny acima do que está no ESTOQUE → a plataforma sobe (D-76).
create or replace function public.plt_fn_tiny_estoque_leitura(
  p_produto_tiny_id bigint,
  p_versao          integer,
  p_resposta        jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fila       public.plt_tiny_estoque_fila%rowtype;
  v_ret        jsonb;
  v_prod       jsonb;
  v_saldo      numeric;
  v_tiny       integer;
  v_livres     integer;
  v_reservadas integer;
  v_alvo       integer;
  v_dep        jsonb;
  v_dep_saldo  numeric;
  v_conta      text;
  v_deposito   text;
  v_id         bigint;
  v_qtd        numeric;
  v_tipo       text;
  v_sku        text;
  v_n          integer;
begin
  select * into v_fila from public.plt_tiny_estoque_fila
   where produto_tiny_id = p_produto_tiny_id for update;
  if not found then
    return jsonb_build_object('acao', 'nada', 'motivo', 'fora_da_fila');
  end if;

  v_ret := coalesce(p_resposta -> 'retorno', p_resposta);
  if coalesce(v_ret ->> 'status', '') <> 'OK' or v_ret -> 'produto' is null then
    perform plt_privado.fn_tiny_estoque_falhou(p_produto_tiny_id,
      'Leitura do Tiny: ' || left(coalesce((v_ret -> 'erros')::text, v_ret::text, 'sem resposta'), 400));
    return jsonb_build_object('acao', 'nada', 'motivo', 'erro_na_leitura');
  end if;

  v_prod  := v_ret -> 'produto';
  v_saldo := plt_privado.fn_tiny_numero(v_prod ->> 'saldo');
  if v_saldo is null then
    perform plt_privado.fn_tiny_estoque_falhou(p_produto_tiny_id, 'Leitura do Tiny sem saldo.');
    return jsonb_build_object('acao', 'nada', 'motivo', 'erro_na_leitura');
  end if;
  select pr.codigo into v_sku from public.produtos pr where pr.tiny_id = p_produto_tiny_id;

  -- A leitura fica guardada no mesmo formato da carga (o detalhe do produto
  -- mostra "o que o Tiny diz" a partir dela).
  insert into public.eventos (tipo, tiny_id, payload)
    values ('estoque_fabrica', p_produto_tiny_id,
            jsonb_build_object(
              'cnpj', '27556613000166', 'tipo', 'estoque', 'origem', 'leitura',
              'motivo', v_fila.motivo,
              'dados', jsonb_build_object(
                'idProduto', p_produto_tiny_id, 'sku', coalesce(v_prod ->> 'codigo', v_sku),
                'nome', v_prod ->> 'nome', 'saldo', v_saldo,
                'saldoReservado', plt_privado.fn_tiny_numero(v_prod ->> 'saldoReservado'),
                'depositos', coalesce(v_prod -> 'depositos', '[]'::jsonb))));

  perform pg_advisory_xact_lock(hashtextextended('plt_estoque_produto:' || p_produto_tiny_id, 0));
  select x.livres, x.reservadas into v_livres, v_reservadas
    from plt_privado.fn_estoque_pecas(p_produto_tiny_id) x;
  v_tiny := greatest(floor(v_saldo), 0)::int;   -- negativo no Tiny = nada no galpão (D-53)

  -- (1) PONTO DE PARTIDA: as livres ficam com o saldo do Tiny (menos as
  --     reservadas, que também estão no galpão).
  if v_fila.copiar then
    v_alvo := greatest(v_tiny - v_reservadas, 0);
    if v_alvo > v_livres then
      perform plt_privado.fn_estoque_criar_pecas(p_produto_tiny_id, v_alvo - v_livres, null, 'api',
        'Ponto de partida: o saldo do Tiny.',
        jsonb_build_object('motivo', 'tiny_copia', 'produto_tiny_id', p_produto_tiny_id, 'sku', v_sku,
                           'saldo_tiny', v_saldo, 'antes', v_livres, 'depois', v_alvo));
    elsif v_alvo < v_livres then
      perform plt_privado.fn_estoque_baixar_pecas(p_produto_tiny_id, v_livres - v_alvo, null, 'api',
        'Ponto de partida: o saldo do Tiny.',
        jsonb_build_object('motivo', 'tiny_copia', 'produto_tiny_id', p_produto_tiny_id, 'sku', v_sku,
                           'saldo_tiny', v_saldo, 'antes', v_livres, 'depois', v_alvo));
    end if;
    perform plt_privado.fn_tiny_estoque_concluir(p_produto_tiny_id, p_versao, true);
    return jsonb_build_object('acao', 'nada', 'motivo', 'copiado', 'livres', v_alvo, 'tiny', v_saldo);
  end if;

  -- (2) A PLATAFORMA MANDA: o Tiny fica com as livres (o número da tela).
  if v_fila.enviar then
    if v_saldo = v_livres then
      perform plt_privado.fn_tiny_estoque_concluir(p_produto_tiny_id, p_versao);
      return jsonb_build_object('acao', 'nada', 'motivo', 'ja_igual', 'livres', v_livres);
    end if;
    -- O depósito "Fábrica" da empresa da loja é onde as peças prontas estão e
    -- onde a venda baixa; sem ele (ou sem o id do produto na loja), o Geral
    -- da fábrica. A SOMA das duas empresas fica igual às livres.
    select d -> 'deposito' into v_dep
      from jsonb_array_elements(coalesce(v_prod -> 'depositos', '[]'::jsonb)) d
     where d -> 'deposito' ->> 'empresa' = 'lojadomoby' and d -> 'deposito' ->> 'nome' = 'Fábrica'
     limit 1;
    v_id := case when v_dep is not null then plt_privado.fn_tiny_id_loja(v_sku) end;
    if v_dep is not null and v_id is not null then
      v_conta := 'loja';
      v_deposito := 'Fábrica';
    else
      select d -> 'deposito' into v_dep
        from jsonb_array_elements(coalesce(v_prod -> 'depositos', '[]'::jsonb)) d
       where d -> 'deposito' ->> 'nome' = 'Geral'
         and coalesce(d -> 'deposito' ->> 'empresa', '') <> 'lojadomoby'
       limit 1;
      v_conta := 'fabrica';
      v_deposito := 'Geral';
      v_id := p_produto_tiny_id;
    end if;
    v_dep_saldo := coalesce(plt_privado.fn_tiny_numero(v_dep ->> 'saldo'), 0);
    v_qtd := v_dep_saldo + (v_livres - v_saldo);
    if v_qtd >= 0 then
      v_tipo := 'B';                        -- balanço: o depósito passa a ter v_qtd
    else
      v_tipo := 'S';                        -- balanço negativo não é aceito: saída da diferença
      v_qtd := v_saldo - v_livres;
    end if;
    return jsonb_build_object(
      'acao', 'ajustar', 'conta', v_conta, 'id_produto', v_id, 'deposito', v_deposito,
      'tipo', v_tipo, 'quantidade', v_qtd, 'sku', v_sku,
      'tiny_antes', v_saldo, 'tiny_depois', v_livres,
      'estoque', jsonb_build_object('estoque', jsonb_build_object(
         'idProduto', v_id, 'tipo', v_tipo, 'quantidade', v_qtd, 'deposito', v_deposito,
         'observacoes', left(format('Plataforma Domoby: estoque = %s', v_livres), 100))));
  end if;

  -- (3) LER: Tiny acima do que está no galpão pela plataforma → sobe (D-76).
  if v_tiny > v_livres + v_reservadas then
    v_n := v_tiny - v_livres - v_reservadas;
    perform plt_privado.fn_estoque_criar_pecas(p_produto_tiny_id, v_n, null, 'api',
      'Entrou pelo Tiny.',
      jsonb_build_object('motivo', 'tiny', 'produto_tiny_id', p_produto_tiny_id, 'sku', v_sku,
                         'saldo_tiny', v_saldo, 'antes', v_livres, 'depois', v_livres + v_n,
                         'quantidade', v_n));
    perform plt_privado.fn_estoque_reposicao_coberta(p_produto_tiny_id);
  end if;
  perform plt_privado.fn_tiny_estoque_concluir(p_produto_tiny_id, p_versao);
  return jsonb_build_object('acao', 'nada', 'motivo', case when v_n > 0 then 'subiu' else 'sem_mudanca' end,
                            'entraram', coalesce(v_n, 0), 'tiny', v_saldo);
end;
$$;

-- O n8n gravou (ou tentou gravar) no Tiny: guarda o resultado.
create or replace function public.plt_fn_tiny_estoque_ajustado(
  p_produto_tiny_id bigint,
  p_versao          integer,
  p_acao            jsonb,
  p_resposta        jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ret jsonb;
  v_reg jsonb;
  v_ok  boolean;
begin
  v_ret := coalesce(p_resposta -> 'retorno', p_resposta);
  v_reg := coalesce(v_ret -> 'registros' -> 0 -> 'registro', v_ret -> 'registros' -> 'registro');
  v_ok := coalesce(v_ret ->> 'status', '') = 'OK'
          and coalesce(v_reg ->> 'status', 'OK') = 'OK';
  if not v_ok then
    perform plt_privado.fn_tiny_estoque_falhou(p_produto_tiny_id,
      'Gravar no Tiny: ' || left(coalesce((v_reg -> 'erros')::text, (v_ret -> 'erros')::text, v_ret::text, 'sem resposta'), 400));
    return jsonb_build_object('ok', false);
  end if;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (null, 'estoque_tiny_ajustado',
            jsonb_strip_nulls(jsonb_build_object(
              'produto_tiny_id', p_produto_tiny_id,
              'sku',             p_acao ->> 'sku',
              'conta',           p_acao ->> 'conta',
              'deposito',        p_acao ->> 'deposito',
              'tipo',            p_acao ->> 'tipo',
              'quantidade',      p_acao -> 'quantidade',
              'tiny_antes',      p_acao -> 'tiny_antes',
              'tiny_depois',     p_acao -> 'tiny_depois',
              'saldo_deposito',  v_reg -> 'saldoEstoque',
              'lancamento_id',   v_reg -> 'id')));
  perform plt_privado.fn_tiny_estoque_concluir(p_produto_tiny_id, p_versao);
  return jsonb_build_object('ok', true);
end;
$$;

-- Varredura noturna (rede de segurança): todos os acabados ativos para ler.
create or replace function public.plt_fn_tiny_estoque_varrer()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer := 0;
  r   record;
begin
  if plt_privado.fn_tiny_estoque_desde() is null then
    return 0;
  end if;
  for r in
    select pr.tiny_id from public.produtos pr
     where pr.situacao = 'A' and coalesce(pr.classe, '') in ('F', 'S', 'V')
       and not plt_privado.fn_eh_personalizado(pr.descricao)
  loop
    if plt_privado.fn_tiny_estoque_enfileirar(r.tiny_id, false, 'varredura') then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;

-- ----------------------------------------------------------------------------
-- 14 · Portas das pessoas: ligar/desligar (admin) e a situação (logística)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tiny_estoque_ligar()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_desde   timestamptz;
  v_n       integer := 0;
  r         record;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_eh_admin() then
    raise exception 'Ligar o sincronismo com o Tiny é gesto de admin.' using errcode = 'insufficient_privilege';
  end if;
  v_desde := plt_privado.fn_tiny_estoque_desde();
  if v_desde is not null then
    return jsonb_build_object('ligado_desde', v_desde, 'ja_estava', true);
  end if;
  update public.plt_setores set tiny_sincronizado_desde = now() where codigo = 'estoque'
    returning tiny_sincronizado_desde into v_desde;
  -- D-79: o ponto de partida — cada acabado lê o Tiny uma vez e fica com o saldo dele.
  for r in
    select pr.tiny_id from public.produtos pr
     where pr.situacao = 'A' and coalesce(pr.classe, '') in ('F', 'S', 'V')
       and not plt_privado.fn_eh_personalizado(pr.descricao)
  loop
    if plt_privado.fn_tiny_estoque_enfileirar(r.tiny_id, false, 'ponto_de_partida', true) then
      v_n := v_n + 1;
    end if;
  end loop;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'estoque_tiny_ligado', jsonb_build_object('desde', v_desde, 'produtos', v_n));
  return jsonb_build_object('ligado_desde', v_desde, 'produtos_para_copiar', v_n);
end;
$$;

create or replace function public.plt_fn_tiny_estoque_desligar()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_eh_admin() then
    raise exception 'Desligar o sincronismo com o Tiny é gesto de admin.' using errcode = 'insufficient_privilege';
  end if;
  update public.plt_setores set tiny_sincronizado_desde = null where codigo = 'estoque';
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'estoque_tiny_desligado', '{}'::jsonb);
  return jsonb_build_object('ligado_desde', null);
end;
$$;

-- A situação para a tela (Configurações do Estoque): ligado desde, o que está
-- na fila, o que parou (com o erro) e os últimos ajustes gravados no Tiny.
create or replace function public.plt_fn_tiny_estoque_situacao()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when not plt_privado.fn_pode_ver_expedicao() then null else
    jsonb_build_object(
      'ligado_desde', plt_privado.fn_tiny_estoque_desde(),
      'na_fila', (select count(*) from public.plt_tiny_estoque_fila f where f.parado_em is null),
      'parados', coalesce((
        select jsonb_agg(jsonb_build_object('sku', pr.codigo, 'descricao', pr.descricao,
                                            'erro', f.ultimo_erro, 'desde', f.parado_em)
                         order by f.parado_em desc)
          from public.plt_tiny_estoque_fila f
          join public.produtos pr on pr.tiny_id = f.produto_tiny_id
         where f.parado_em is not null), '[]'::jsonb),
      'ultima_leitura_em', (select max(e.recebido_em) from public.eventos e
                             where e.tipo = 'estoque_fabrica' and e.payload ->> 'origem' = 'leitura'),
      'ultimos_ajustes', coalesce((
        select jsonb_agg(x.j order by x.criado_em desc)
          from (select l.criado_em,
                       l.contexto || jsonb_build_object('em', l.criado_em) as j
                  from public.plt_logs_atividade l
                 where l.acao = 'estoque_tiny_ajustado'
                 order by l.criado_em desc
                 limit 5) x), '[]'::jsonb))
  end;
$$;

-- ----------------------------------------------------------------------------
-- 15 · O relógio da venda: a cada minuto (só age com o sincronismo ligado)
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'plt-estoque-reservas') then
      perform cron.schedule('plt-estoque-reservas', '* * * * *',
        'select plt_privado.fn_estoque_reservas_rodar()');
    end if;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 16 · Permissões: maquinaria fora da API (E-11); as portas do n8n só para a
--      chave de serviço; as das pessoas para authenticated (gate por dentro)
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_tiny_estoque_desde()                                   from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_numero(text)                                      from public, anon, authenticated;
revoke all on function plt_privado.fn_eh_acabado_contado(bigint)                             from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_estoque_enfileirar(bigint, boolean, text, boolean) from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_pecas(bigint)                                  from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_criar_pecas(bigint, integer, uuid, text, text, jsonb)  from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_baixar_pecas(bigint, integer, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_id_loja(text)                                     from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_reposicao_coberta(bigint)                      from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_estoque_concluir(bigint, integer, boolean)        from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_estoque_falhou(bigint, text)                      from public, anon, authenticated;
revoke all on function plt_privado.fn_projetar_reserva()                                     from public, anon, authenticated;
revoke all on function plt_privado.fn_validar_reserva()                                      from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_reservas_rodar()                               from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_estoque_marcar()                                  from public, anon, authenticated;

revoke all on function public.plt_fn_tiny_estoque_aviso(jsonb)                               from public, anon, authenticated;
revoke all on function public.plt_fn_tiny_estoque_proximos(integer)                          from public, anon, authenticated;
revoke all on function public.plt_fn_tiny_estoque_leitura(bigint, integer, jsonb)            from public, anon, authenticated;
revoke all on function public.plt_fn_tiny_estoque_ajustado(bigint, integer, jsonb, jsonb)    from public, anon, authenticated;
revoke all on function public.plt_fn_tiny_estoque_varrer()                                   from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.plt_fn_tiny_estoque_aviso(jsonb)                            to service_role;
    grant execute on function public.plt_fn_tiny_estoque_proximos(integer)                       to service_role;
    grant execute on function public.plt_fn_tiny_estoque_leitura(bigint, integer, jsonb)         to service_role;
    grant execute on function public.plt_fn_tiny_estoque_ajustado(bigint, integer, jsonb, jsonb) to service_role;
    grant execute on function public.plt_fn_tiny_estoque_varrer()                                to service_role;
  end if;
end;
$$;

revoke all on function public.plt_fn_tiny_estoque_ligar()                                    from public, anon;
revoke all on function public.plt_fn_tiny_estoque_desligar()                                 from public, anon;
revoke all on function public.plt_fn_tiny_estoque_situacao()                                 from public, anon;
revoke all on function public.plt_fn_sugestoes_alocacao(bigint)                              from public, anon;
revoke all on function public.plt_fn_estoque(text, integer, integer, bigint, text)           from public, anon;
grant execute on function public.plt_fn_tiny_estoque_ligar()                                 to authenticated;
grant execute on function public.plt_fn_tiny_estoque_desligar()                              to authenticated;
grant execute on function public.plt_fn_tiny_estoque_situacao()                              to authenticated;
grant execute on function public.plt_fn_sugestoes_alocacao(bigint)                           to authenticated;
grant execute on function public.plt_fn_estoque(text, integer, integer, bigint, text)        to authenticated;

-- ----------------------------------------------------------------------------
-- 17 · E-19: a migration mais nova do check valida TUDO
-- ----------------------------------------------------------------------------
alter table public.plt_eventos validate constraint plt_eventos_tipo_check;
