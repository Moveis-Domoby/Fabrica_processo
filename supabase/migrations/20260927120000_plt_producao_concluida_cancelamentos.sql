-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 37 — PRODUÇÃO CONCLUÍDA,
-- CANCELAMENTOS, ALOCAÇÃO E O QUADRO POR ARRASTO
-- Sessão: SESSAO-24 · Data: 2026-09-27
-- Decisões: D-53 (ordem) + as respostas do dono em 27/09 (D-58…D-61)
--
--   1. PEDIDOS EM AGUARDO VIRA LUGAR. Palavras do dono: "os locais finais não
--      são mais estoque e muito menos rota; estoque só fica como local final
--      de peça sem dono". A tela é a aba que já existe; por dentro, a peça
--      pronta de pedido passa a MORAR num fim de linha próprio (setor terminal
--      interno 'aguardo'). O ESTOQUE fica só com peça sem dono.
--   2. CONCLUIR PRODUÇÃO decide o destino no banco: pedido vivo → aguardo;
--      sem pedido (reposição) ou pedido cancelado → ESTOQUE, sem dono. Na tela,
--      o botão existe só na LIMPEZA E EMBALAGEM ("todos os móveis que vão para
--      estoque passam por ele").
--   3. O QUADRO POR ARRASTO ("tudo arrastando, é mais rápido"): soltar na
--      etapa de INÍCIO (a próxima depois da fila — a regra da migration 30,
--      agora com um dono só: fn_etapa_inicio) inicia o tempo de quem arrastou;
--      soltar numa etapa que ENCAMINHA (plt_etapas.setor_destino_id — as
--      etapas com nome de setor e os CONCLUÍDO) leva o card ao setor, com a
--      marcação de qualidade (D-09 é lei); qualquer outra etapa é só mover.
--   4. CANCELAMENTO: a peça perde o pedido por EVENTO (unidade_desvinculada) —
--      no próprio cancelamento, se já estava pronta no aguardo (e volta ao
--      ESTOQUE), ou ao chegar pronta no ESTOQUE, se ainda estava na produção.
--   5. ALOCAÇÃO: peça livre IGUAL no ESTOQUE pode virar unidade pronta de um
--      pedido (card novo, direto no aguardo); a peça livre é consumida pelo
--      evento peca_alocada. Sugestão nunca decide sozinha.
--   6. PAINEL: "concluída" conta só a chegada ao fim de linha vinda de FORA
--      dos terminais — lançar para ROTAS ou devolver ao ESTOQUE não conta a
--      mesma peça de novo (achado da SESSAO-24: 2 peças já contadas 2×).
--
-- Nada aqui altera as tabelas da integração (clientes, pedidos, pedido_itens,
-- eventos, gp_pcp_processados, produtos).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · Vocabulário: dois fatos novos, append-only como sempre (E-19: este é o
--     check mais novo — `not valid` aqui, validação de tudo no fim do arquivo)
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
      'unidade_desvinculada',  -- SESSAO-24: a peça perdeu o pedido (cancelado no Tiny) — ficou sem dono
      'peca_alocada'           -- SESSAO-24: a peça livre do ESTOQUE virou unidade pronta de um pedido
    )) not valid;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2 · Pedidos em aguardo é o LUGAR da peça pronta de pedido (b4 do dono)
--
-- Setor terminal interno: a tela dele é a aba Pedidos em aguardo que já
-- existe (rota /fabrica/logistica/pedidos-em-aguardo). Só nasce se não
-- existir — reaplicar nunca sobrescreve o que o admin mudou.
-- ----------------------------------------------------------------------------
insert into public.plt_setores (codigo, nome, papel_no_fluxo, ordem)
values ('aguardo', 'PEDIDOS EM AGUARDO', 'terminal', 85)
on conflict (codigo) do nothing;

-- ----------------------------------------------------------------------------
-- 3 · A etapa que ENCAMINHA: chegar nela leva o card para outro setor
--
-- O jeito do ClickUp que o dono confirmou ("etapa com nome de setor move o
-- card para o setor"; CONCLUÍDO de SECC e CNC → FURAÇÃO, o dos outros → o
-- próximo). É DADO do dono, editável em Setores e etapas — a carga inicial é
-- SQL de manutenção (reaplicar migration não pode apagar edição do admin).
-- ----------------------------------------------------------------------------
alter table public.plt_etapas add column if not exists setor_destino_id bigint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plt_etapas_setor_destino_fk') then
    alter table public.plt_etapas
      add constraint plt_etapas_setor_destino_fk
      foreign key (setor_destino_id) references public.plt_setores (id);
  end if;
end;
$$;

alter table public.plt_etapas drop constraint if exists plt_etapas_encaminha_ck;
alter table public.plt_etapas add constraint plt_etapas_encaminha_ck check (
  setor_destino_id is null
  or (setor_destino_id <> setor_id and not eh_fila and not eh_danificado)
);

comment on column public.plt_etapas.setor_destino_id is
  'SESSAO-24: etapa que ENCAMINHA — soltar o card aqui o leva para este setor (com a marcação de qualidade, D-09). Nulo = etapa comum. Fila e DANIFICADO nunca encaminham.';

-- ----------------------------------------------------------------------------
-- 4 · plt_cards: a peça sem dono pode não ser do catálogo, e a unicidade das
--     peças sem pedido ganha o item
-- ----------------------------------------------------------------------------
-- Peça de pedido cancelado que era PERSONALIZADA (ou de SKU fora do catálogo)
-- fica sem pedido E sem produto do catálogo — é identificada pelo item
-- (SKU + descrição) e pelo card de origem. (A migration 36 recria a versão
-- dela como `not valid` — E-19: quem valida é a mais nova.)
alter table public.plt_cards drop constraint if exists plt_cards_unidade_coerente;
alter table public.plt_cards add constraint plt_cards_unidade_coerente check (
  (tipo = 'unidade' and indice_unidade is not null and total_unidades is not null
     and (pedido_id is not null or produto_tiny_id is not null or card_pai_id is not null))
  or (tipo = 'pedido' and indice_unidade is null and total_unidades is null
     and pedido_id is not null)
  or (tipo = 'reposicao' and indice_unidade is null and total_unidades >= 1
     and pedido_id is null and produto_tiny_id is not null)
);

-- A unicidade da 25 era (card de origem, k): duas unidades de um pedido
-- cancelado com o mesmo k (itens diferentes) colidiriam. Ganha o item.
do $$
begin
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and indexname = 'plt_cards_unidade_reposicao_uq'
       and indexdef ilike '%item_seq%'
  ) then
    drop index if exists public.plt_cards_unidade_reposicao_uq;
    create unique index plt_cards_unidade_reposicao_uq
      on public.plt_cards (card_pai_id, item_seq, indice_unidade)
      where tipo = 'unidade' and pedido_id is null;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5 · As regras, cada uma com UM dono (lição E-25/M-04)
-- ----------------------------------------------------------------------------

-- A etapa de INÍCIO de um setor: a próxima depois da fila (ordem seguinte,
-- ativa, não-DANIFICADO, que não encaminha). É onde o tempo de quem trabalha
-- começa — o "iniciar na fila avança" (migration 30) e o arrasto usam ESTA.
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
     and (e2.ordem, e2.id) > (fila.ordem, fila.id)
   order by e2.ordem, e2.id
   limit 1;
$$;

comment on function plt_privado.fn_etapa_inicio(bigint) is
  'SESSAO-24: a etapa de início do setor — a próxima depois da fila (ordem seguinte, ativa, não-DANIFICADO, que não encaminha). Dono único da regra: o iniciar na fila (migration 30) e o arrasto usam esta.';

-- Pedido cancelado no Tiny (a situação guarda a DESCRIÇÃO — E-25).
create or replace function plt_privado.fn_pedido_cancelado(p_pedido_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
       from public.pedidos p where p.id = p_pedido_id),
    false);
$$;

-- Texto comparável: sem diferença de maiúsculas, acentos e espaços (b1 do dono).
create or replace function plt_privado.fn_normalizar_texto(p_texto text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select btrim(regexp_replace(
           translate(lower(coalesce(p_texto, '')),
                     'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
           '\s+', ' ', 'g'));
$$;

-- O produto do catálogo de um item vendido: SKU de produto ATIVO e item que
-- NÃO é personalizado (a loja reusa o SKU com outras medidas — S25). O id da
-- loja nunca casa com o da fábrica (A-22): a ponte é o SKU.
create or replace function plt_privado.fn_produto_do_item(p_codigo text, p_descricao text)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pr.tiny_id
    from public.produtos pr
   where not plt_privado.fn_eh_personalizado(p_descricao)
     and p_codigo is not null
     and pr.codigo = p_codigo
     and pr.situacao = 'A'
   order by pr.tiny_id
   limit 1;
$$;

-- "Peça igual" (b1 do dono): peça do catálogo casa pelo PRODUTO; personalizada
-- ou fora do catálogo casa por SKU + descrição idênticos (normalizados); item
-- sem SKU, pela descrição. A mesma chave vale para o item e para a peça.
create or replace function plt_privado.fn_chave_peca(
  p_produto_tiny_id bigint,
  p_codigo          text,
  p_descricao       text
)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
           when p_produto_tiny_id is not null
                and not plt_privado.fn_eh_personalizado(p_descricao)
             then 'p:' || p_produto_tiny_id
           else 'd:' || upper(coalesce(btrim(p_codigo), ''))
                || '|' || plt_privado.fn_normalizar_texto(p_descricao)
         end;
$$;

comment on function plt_privado.fn_chave_peca(bigint, text, text) is
  'SESSAO-24 (b1 do dono): a chave de "peça igual" — produto do catálogo (não personalizado) ou SKU + descrição normalizada. Mesma chave para o item vendido e para a peça do estoque.';

-- Quem é o autor de um gesto no setor: a sessão, ou o operador do PIN (tablet)
-- — gente ativa que trabalha no setor, ou admin. O mesmo gate do mover (S07).
create or replace function plt_privado.fn_autor_do_gesto(p_setor_id bigint, p_operador_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao uuid;
begin
  v_sessao := plt_privado.fn_usuario_atual();
  if v_sessao is null then
    raise exception 'Só usuário ativo da plataforma move cards.' using errcode = 'insufficient_privilege';
  end if;
  if not (plt_privado.fn_eh_admin()
          or p_setor_id in (select plt_privado.fn_setores_do_usuario())) then
    raise exception 'Você não trabalha no setor deste card.' using errcode = 'insufficient_privilege';
  end if;
  if p_operador_id is null or p_operador_id = v_sessao then
    return v_sessao;
  end if;
  if not exists (select 1 from public.plt_usuarios u where u.id = p_operador_id and u.ativo) then
    raise exception 'Operador não encontrado ou inativo — confira a identificação.'
      using errcode = 'check_violation';
  end if;
  if not (
    exists (select 1 from public.plt_usuarios u where u.id = p_operador_id and u.papel = 'admin')
    or exists (select 1 from public.plt_usuario_setores us
                where us.usuario_id = p_operador_id and us.setor_id = p_setor_id)
  ) then
    raise exception 'O operador identificado não trabalha neste setor.'
      using errcode = 'insufficient_privilege';
  end if;
  return p_operador_id;
end;
$$;

-- A base ÚNICA de Pedidos em aguardo: unidade pronta (num fim de linha) de
-- pedido com card vivo e ainda não lançado para ROTAS. As abas "Pedidos" e
-- "Produtos reservados" e as contagens leem daqui — os contadores batem por
-- construção (critério de aceite).
create or replace function plt_privado.fn_unidades_em_aguardo()
returns table (
  unidade_id     bigint,
  card_pedido_id bigint,
  pedido_id      bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, pc.id, u.pedido_id
    from public.plt_cards u
    join public.plt_setores s on s.id = u.setor_atual_id and s.papel_no_fluxo = 'terminal'
    join public.plt_cards pc on pc.pedido_id = u.pedido_id and pc.tipo = 'pedido'
   where u.tipo = 'unidade'
     and u.pedido_id is not null
     and u.arquivado_em is null
     and pc.arquivado_em is null
     and pc.lancado_rotas_em is null;
$$;

-- ----------------------------------------------------------------------------
-- 6 · Iniciar na fila avança para a etapa de INÍCIO (migration 30 recriada
--     POR INTEIRO — E-24 — trocando só a consulta pela regra única e a
--     mensagem do limite, que falava em "finalize": agora é arrastar)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_execucao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card         public.plt_cards%rowtype;
  v_limite       integer;
  v_em_execucao  integer;
  v_alvo         public.plt_eventos%rowtype;
  v_ultimo_exec  bigint;
  v_papel        text;
  v_lider        boolean;
  v_referencia   bigint;
  v_eh_fila      boolean;
  v_producao     boolean;
  v_proxima      bigint;
begin
  if new.tipo not in ('execucao_iniciada', 'execucao_finalizada', 'estorno',
                      'execucao_pausada', 'execucao_retomada') then
    return new;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;
  if not found then
    raise exception 'Card % não existe.', new.card_id using errcode = 'foreign_key_violation';
  end if;

  if new.usuario_id is null then
    -- D-02/D-24/D-48: execução (e a gestão dela) é gesto de pessoa.
    raise exception 'Iniciar, finalizar, pausar, retomar e estornar são gestos de pessoa: é preciso dizer quem fez.'
      using errcode = 'check_violation';
  end if;

  -- Onde o gesto aconteceu: o setor/etapa ATUAL do card, se quem inseriu não disse.
  if new.tipo in ('execucao_iniciada', 'execucao_finalizada',
                  'execucao_pausada', 'execucao_retomada') then
    new.setor_origem_id := coalesce(new.setor_origem_id, v_card.setor_atual_id);
    new.etapa_origem_id := coalesce(new.etapa_origem_id, v_card.etapa_atual_id);
  end if;

  if new.tipo = 'execucao_iniciada' then
    if v_card.setor_atual_id is null then
      raise exception 'Este card ainda não está em nenhum setor — não há o que iniciar.'
        using errcode = 'check_violation';
    end if;
    if v_card.concluido_em is not null then
      -- D-13: fim de linha não executa.
      raise exception 'Card concluído (fim de linha) não entra em execução.'
        using errcode = 'check_violation';
    end if;
    if v_card.executor_atual_id = new.usuario_id then
      raise exception 'Esta pessoa já está executando este card.'
        using errcode = 'check_violation';
    end if;

    select s.limite_execucoes_por_pessoa into v_limite
      from public.plt_setores s where s.id = v_card.setor_atual_id;
    if v_limite is not null then
      select count(*) into v_em_execucao
        from public.plt_cards c
       where c.executor_atual_id = new.usuario_id
         and c.setor_atual_id = v_card.setor_atual_id
         and c.id <> new.card_id
         -- D-48: execução pausada não ocupa o limite — é o que deixa a urgência entrar.
         and c.pausado_em is null;
      if v_em_execucao >= v_limite then
        -- D-24/D-48: limite configurável por setor; o padrão agora é 1.
        -- SESSAO-24: o quadro é por arrasto — terminar é arrastar o card adiante.
        raise exception 'Limite do setor atingido: esta pessoa já tem % card(s) em andamento aqui (máximo %). Termine o que está em andamento — arraste-o adiante — antes de pegar outro.',
          v_em_execucao, v_limite
          using errcode = 'check_violation';
      end if;
    end if;

    -- D-48 ↪️ (revisão do dono, 21/09): iniciar um card que está na FILA de um
    -- setor de PRODUÇÃO avança para a etapa de início — o mover nasce ANTES do
    -- iniciar (id menor), então a execução abre já na etapa nova.
    if v_card.etapa_atual_id is not null then
      select e.eh_fila, s.papel_no_fluxo = 'producao'
        into v_eh_fila, v_producao
        from public.plt_etapas e
        join public.plt_setores s on s.id = e.setor_id
       where e.id = v_card.etapa_atual_id;
      if coalesce(v_eh_fila, false) and coalesce(v_producao, false) then
        -- SESSAO-24: a etapa de início tem UM dono (o arrasto usa a mesma).
        v_proxima := plt_privado.fn_etapa_inicio(v_card.setor_atual_id);
        if v_proxima is not null then
          insert into public.plt_eventos
              (card_id, tipo, origem, usuario_id, ocorrido_em,
               setor_origem_id, setor_destino_id, etapa_origem_id, etapa_destino_id)
            values
              (new.card_id, 'movimentacao_etapa', 'automacao', new.usuario_id,
               -- 1ms antes do iniciar: o id do iniciar já nasceu antes deste
               -- trigger — é o instante que garante a ordem certa da leitura.
               new.ocorrido_em - interval '1 millisecond',
               v_card.setor_atual_id, v_card.setor_atual_id,
               v_card.etapa_atual_id, v_proxima);
          -- A projeção já rodou para o mover — o iniciar registra a etapa NOVA.
          select * into v_card from public.plt_cards where id = new.card_id;
          new.setor_origem_id := v_card.setor_atual_id;
          new.etapa_origem_id := v_card.etapa_atual_id;
        end if;
      end if;
    end if;

  elsif new.tipo = 'execucao_finalizada' then
    if v_card.executor_atual_id is null then
      -- D-24: finalizar sem iniciar não existe.
      raise exception 'Iniciar é obrigatório antes de finalizar — este card não está em execução.'
        using errcode = 'check_violation';
    end if;

  elsif new.tipo = 'execucao_pausada' then
    -- D-48: só execução aberta se pausa, uma pausa por vez.
    if v_card.executor_atual_id is null then
      raise exception 'Este card não está em execução — não há o que pausar.'
        using errcode = 'check_violation';
    end if;
    if v_card.pausado_em is not null then
      raise exception 'Esta execução já está pausada.'
        using errcode = 'check_violation';
    end if;

    -- Quem pausa: líder do setor ATUAL do card ou admin (D-48).
    select u.papel into v_papel from public.plt_usuarios u
     where u.id = new.usuario_id and u.ativo;
    if v_papel is null then
      raise exception 'Pausar exige um usuário ativo da plataforma.'
        using errcode = 'check_violation';
    end if;
    select coalesce(bool_or(us.lider_do_setor), false) into v_lider
      from public.plt_usuario_setores us
     where us.usuario_id = new.usuario_id
       and us.setor_id = v_card.setor_atual_id;
    if v_papel <> 'admin' and not v_lider then
      raise exception 'Pausar uma execução é gesto de líder do setor ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;

    -- A pausa aponta a execução aberta (o iniciar válido mais recente).
    select e.id into v_referencia
      from public.plt_eventos e
     where e.card_id = new.card_id
       and e.tipo = 'execucao_iniciada'
       and not plt_privado.fn_evento_estornado(e.id)
     order by e.ocorrido_em desc, e.id desc
     limit 1;
    if new.evento_referencia_id is null then
      new.evento_referencia_id := v_referencia;
    elsif new.evento_referencia_id is distinct from v_referencia then
      raise exception 'A pausa precisa apontar a execução aberta deste card.'
        using errcode = 'check_violation';
    end if;

  elsif new.tipo = 'execucao_retomada' then
    if v_card.pausado_em is null then
      raise exception 'Este card não está pausado — não há o que retomar.'
        using errcode = 'check_violation';
    end if;

    -- Quem retoma: o próprio executor, o líder do setor ou admin (D-48).
    select u.papel into v_papel from public.plt_usuarios u
     where u.id = new.usuario_id and u.ativo;
    if v_papel is null then
      raise exception 'Retomar exige um usuário ativo da plataforma.'
        using errcode = 'check_violation';
    end if;
    select coalesce(bool_or(us.lider_do_setor), false) into v_lider
      from public.plt_usuario_setores us
     where us.usuario_id = new.usuario_id
       and us.setor_id = v_card.setor_atual_id;
    if new.usuario_id is distinct from v_card.executor_atual_id
       and v_papel <> 'admin' and not v_lider then
      raise exception 'Retomar é gesto de quem executa o card, do líder do setor ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;

    -- D-48 (palavras do dono): "tem que concluir a urgência antes de pegar
    -- outro" — retomar passa pela MESMA trava do limite, contada para o EXECUTOR.
    select s.limite_execucoes_por_pessoa into v_limite
      from public.plt_setores s where s.id = v_card.setor_atual_id;
    if v_limite is not null then
      select count(*) into v_em_execucao
        from public.plt_cards c
       where c.executor_atual_id = v_card.executor_atual_id
         and c.setor_atual_id = v_card.setor_atual_id
         and c.id <> new.card_id
         and c.pausado_em is null;
      if v_em_execucao >= v_limite then
        raise exception 'Finalize a urgência antes de retomar: esta pessoa já tem % card(s) em execução neste setor (máximo %).',
          v_em_execucao, v_limite
          using errcode = 'check_violation';
      end if;
    end if;

    -- A retomada aponta a pausa que encerra.
    select e.id into v_referencia
      from public.plt_eventos e
     where e.card_id = new.card_id
       and e.tipo = 'execucao_pausada'
     order by e.ocorrido_em desc, e.id desc
     limit 1;
    if new.evento_referencia_id is null then
      new.evento_referencia_id := v_referencia;
    elsif new.evento_referencia_id is distinct from v_referencia then
      raise exception 'A retomada precisa apontar a pausa aberta deste card.'
        using errcode = 'check_violation';
    end if;

  elsif new.tipo = 'estorno' then
    if new.evento_referencia_id is null then
      raise exception 'Estorno precisa apontar o evento estornado (evento_referencia_id).'
        using errcode = 'check_violation';
    end if;

    select * into v_alvo from public.plt_eventos where id = new.evento_referencia_id;
    if not found or v_alvo.card_id <> new.card_id then
      raise exception 'O evento estornado precisa existir e ser do mesmo card.'
        using errcode = 'check_violation';
    end if;
    if v_alvo.tipo not in ('execucao_iniciada', 'execucao_finalizada') then
      raise exception 'Só gestos de execução (iniciar/finalizar) podem ser estornados. Movimentação errada se corrige movendo de novo; pausa errada se corrige retomando.'
        using errcode = 'check_violation';
    end if;
    if plt_privado.fn_evento_estornado(v_alvo.id) then
      raise exception 'Este evento já foi estornado.'
        using errcode = 'check_violation';
    end if;

    -- Só o ÚLTIMO gesto de execução válido é estornável (corrigir é desfazer
    -- do mais novo para o mais velho — mantém a história sempre coerente).
    select e.id into v_ultimo_exec
      from public.plt_eventos e
     where e.card_id = new.card_id
       and e.tipo in ('execucao_iniciada', 'execucao_finalizada')
       and not plt_privado.fn_evento_estornado(e.id)
     order by e.ocorrido_em desc, e.id desc
     limit 1;
    if v_ultimo_exec is distinct from v_alvo.id then
      raise exception 'Só o último gesto de execução do card pode ser estornado — desfaça do mais recente para trás.'
        using errcode = 'check_violation';
    end if;

    -- Quem pode: admin (qualquer setor) ou líder do setor ATUAL do card (D-24).
    select u.papel into v_papel from public.plt_usuarios u
     where u.id = new.usuario_id and u.ativo;
    if v_papel is null then
      raise exception 'Estorno exige um usuário ativo da plataforma.'
        using errcode = 'check_violation';
    end if;
    select coalesce(bool_or(us.lider_do_setor), false) into v_lider
      from public.plt_usuario_setores us
     where us.usuario_id = new.usuario_id
       and us.setor_id = v_card.setor_atual_id;
    if v_papel <> 'admin' and not v_lider then
      -- SESSAO-05/D-24: gate de estorno.
      raise exception 'Estorno é gesto de líder do setor ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

comment on function plt_privado.fn_validar_execucao() is
  'Regras da D-24/D-48 valendo para todo escritor (M-14): iniciar obrigatório; iniciar na FILA de produção avança sozinho para a etapa de início (D-48 ↪️; regra única fn_etapa_inicio desde a S24); limite por setor ignorando pausados; pausa só por líder/admin; retomada pela mesma trava do limite; estorno só do último gesto.';

-- ----------------------------------------------------------------------------
-- 7 · Quem mora em cada fim de linha (b4 do dono) — BEFORE, chegada HUMANA
--
-- ESTOQUE: só peça sem dono (reposição, ou pedido cancelado — que perde o
-- pedido na chegada). PEDIDOS EM AGUARDO: só peça de pedido vivo. Os dois só
-- com 🟢 (a S25 já exigia no ESTOQUE; o Concluir só oferece 🟢). API e
-- automação passam (RF-86) — o fim de linha é regra do gesto humano (M-14).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_chegada_estoque()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_destino   text;
  v_estado    text;
  v_card      public.plt_cards%rowtype;
  v_cancelado boolean;
begin
  if new.tipo <> 'movimentacao_setor' or new.origem <> 'interface' then
    return new;
  end if;
  select s.codigo into v_destino from public.plt_setores s where s.id = new.setor_destino_id;
  if v_destino is null or v_destino not in ('estoque', 'aguardo') then
    return new;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;

  -- A marcação da própria transição manda; sem ela (saída de PCP/terminal),
  -- vale o último estado conhecido da peça.
  if new.evento_referencia_id is not null then
    select e.estado_qualidade into v_estado
      from public.plt_eventos e
     where e.id = new.evento_referencia_id and e.tipo = 'qualidade_marcada';
  end if;
  if v_estado is null then
    v_estado := v_card.qualidade_atual;
  end if;
  if v_estado in ('atencao', 'danificado') then
    if v_destino = 'estoque' then
      raise exception 'O ESTOQUE só recebe peça em perfeito estado. Peça em atenção ou danificada vai para o DANIFICADO do setor.'
        using errcode = 'check_violation';
    end if;
    raise exception 'Pedidos em aguardo só recebe peça em perfeito estado. Peça em atenção ou danificada vai para o DANIFICADO do setor.'
      using errcode = 'check_violation';
  end if;

  -- SESSAO-24 (b4 do dono): "estoque só fica como local final de peça sem dono".
  v_cancelado := v_card.pedido_id is not null and plt_privado.fn_pedido_cancelado(v_card.pedido_id);
  if v_destino = 'aguardo' then
    if v_card.pedido_id is null then
      raise exception 'Pedidos em aguardo recebe só peça de pedido — peça sem dono vai para o ESTOQUE.'
        using errcode = 'check_violation';
    end if;
    if v_cancelado then
      raise exception 'O pedido desta peça foi cancelado no Tiny — ela vai para o ESTOQUE, sem dono.'
        using errcode = 'check_violation';
    end if;
  elsif v_card.pedido_id is not null and not v_cancelado then
    raise exception 'Peça de pedido vai para Pedidos em aguardo — o ESTOQUE recebe só peça sem dono.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function plt_privado.fn_validar_chegada_estoque() is
  'SESSAO-25 + SESSAO-24: chegada HUMANA aos fins de linha — só peça 🟢; ESTOQUE só com peça sem dono (ou de pedido cancelado, que perde o pedido na chegada); Pedidos em aguardo só com peça de pedido vivo.';

-- ----------------------------------------------------------------------------
-- 8 · Projeção do card (recriada POR INTEIRO a partir da migration 36 — E-24).
--     Novo: a peça que perde o pedido e a peça livre que é consumida.
-- ----------------------------------------------------------------------------
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
                                      nullif(new.dados ->> 'produto_tiny_id', '')::bigint)
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

comment on function plt_privado.fn_projetar_posicao() is
  'Único lugar que escreve a posição do card. Reage a evento inserido; nunca o contrário. Projeta arquivamento (S11), responsável (S12), lançamento para ROTAS (S15), pausa e liberação completa (S22), delegado_em (S23), liberação da REPOSIÇÃO (S25), a peça que perde o pedido e a peça livre consumida pela alocação (S24).';

-- ----------------------------------------------------------------------------
-- 9 · Avisos de chegada ao fim de linha (recriada POR INTEIRO a partir da
--     migration 16 — E-24). Novo: a chegada a Pedidos em aguardo avisa os
--     admins (preserva o aviso que o "concluir" já dava) e o cancelamento diz
--     o que aconteceu com a peça.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_reagir_qualidade()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card        public.plt_cards%rowtype;
  v_marc        public.plt_eventos%rowtype;
  v_setor_origem  text;
  v_setor_destino text;
  v_destino_codigo text;
  v_autor         text;
  v_autor_marc    text;
  v_pedido_numero integer;
  v_peca          text;
  v_etapa_danificado bigint;
  v_tipo_aviso    text;
  v_titulo        text;
  v_corpo         text;
  v_destinatarios uuid[];
  v_destinatario  uuid;
  v_divergente    boolean;
begin
  if new.tipo not in ('qualidade_marcada', 'qualidade_parecer', 'movimentacao_setor') then
    return null;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;
  select p.numero into v_pedido_numero from public.pedidos p where p.id = v_card.pedido_id;
  v_peca := coalesce(v_card.item_descricao, 'Peça')
            || case when v_card.indice_unidade is not null
                    then format(' (%s/%s)', v_card.indice_unidade, v_card.total_unidades)
                    else '' end
            || coalesce(' · Pedido ' || v_pedido_numero, '');

  select s.nome into v_setor_origem  from public.plt_setores s where s.id = new.setor_origem_id;
  select s.nome, s.codigo into v_setor_destino, v_destino_codigo
    from public.plt_setores s where s.id = new.setor_destino_id;
  select u.nome into v_autor from public.plt_usuarios u where u.id = new.usuario_id;

  -- ---------- Chegada ao fim de linha avisa os admins (D-25; S24) ----------
  if new.tipo = 'movimentacao_setor' then
    if v_destino_codigo = 'estoque' then
      v_tipo_aviso := 'chegada_estoque';
      if new.dados ->> 'motivo' = 'pedido_cancelado' then
        -- SESSAO-24: a peça pronta do pedido cancelado voltou ao ESTOQUE.
        v_titulo := 'Pedido ' || coalesce(new.dados ->> 'numero', '') || ' cancelado: peça voltou ao ESTOQUE';
        v_corpo  := v_peca || ' estava pronta em Pedidos em aguardo e voltou ao ESTOQUE, sem dono — o pedido '
                    || coalesce(new.dados ->> 'numero', '') || ' foi cancelado no Tiny.';
      else
        v_titulo := 'Peça chegou ao ESTOQUE';
        v_corpo  := v_peca || ' chegou ao ESTOQUE'
                    || coalesce(' vinda de ' || v_setor_origem, '')
                    || coalesce(' por ' || v_autor, '')
                    || case when v_card.qualidade_atual is not null
                            then ', marcada como ' || plt_privado.fn_rotulo_estado(v_card.qualidade_atual)
                            else '' end
                    || '.'
                    || case when v_card.pedido_id is not null
                                 and plt_privado.fn_pedido_cancelado(v_card.pedido_id)
                            then ' O pedido foi cancelado no Tiny: a peça fica no estoque, sem dono.'
                            else '' end;
      end if;
    elsif v_destino_codigo = 'aguardo' then
      -- SESSAO-24: a peça pronta de pedido mora em Pedidos em aguardo. Só a
      -- peça que ACABOU de ficar pronta avisa — chegar de outro fim de linha
      -- (manutenção, ajuste) não é produção nova.
      if exists (select 1 from public.plt_setores so
                  where so.id = new.setor_origem_id and so.papel_no_fluxo = 'terminal') then
        return null;
      end if;
      v_tipo_aviso := 'chegada_aguardo';
      v_titulo := 'Peça pronta em Pedidos em aguardo';
      v_corpo  := v_peca || ' ficou pronta e entrou em Pedidos em aguardo'
                  || coalesce(' vinda de ' || v_setor_origem, '')
                  || coalesce(' por ' || v_autor, '')
                  || '.';
    else
      return null;
    end if;
    select coalesce(array_agg(distinct u.id), '{}') into v_destinatarios
      from public.plt_usuarios u
     where u.ativo and u.papel = 'admin'
       and u.id is distinct from new.usuario_id;

  -- ---------- Marcação 🟡/🔴 de quem entrega (Q-18) ----------
  elsif new.tipo = 'qualidade_marcada' then
    if new.estado_qualidade not in ('atencao', 'danificado') then
      return null;
    end if;
    v_tipo_aviso := 'qualidade_' || new.estado_qualidade;
    v_titulo := 'Peça marcada como ' || plt_privado.fn_rotulo_estado(new.estado_qualidade);
    v_corpo  := coalesce(v_autor, 'Alguém') || coalesce(' (' || v_setor_origem || ')', '')
                || ' marcou a peça como ' || plt_privado.fn_rotulo_estado(new.estado_qualidade)
                || coalesce(' ao mover para ' || v_setor_destino, '')
                || '. ' || v_peca || '.';

  -- ---------- Parecer: divergência ou 🔴 confirmado (Q-18 / RF-83) ----------
  else
    select * into v_marc from public.plt_eventos where id = new.evento_referencia_id;
    v_divergente := v_marc.estado_qualidade is distinct from new.estado_qualidade;

    -- 🔴 registrado pelo recebedor (confirmado OU divergente para 🔴):
    -- o card vai para a etapa DANIFICADO do setor onde está (D-09 item 4).
    if new.estado_qualidade = 'danificado' and v_card.setor_atual_id is not null then
      v_etapa_danificado := plt_privado.fn_garantir_etapa_danificado(v_card.setor_atual_id);
      if v_card.etapa_atual_id is distinct from v_etapa_danificado then
        insert into public.plt_eventos
            (card_id, tipo, usuario_id, origem,
             setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id,
             observacao)
          values
            (new.card_id, 'movimentacao_etapa', new.usuario_id, 'automacao',
             v_card.setor_atual_id, v_card.etapa_atual_id,
             v_card.setor_atual_id, v_etapa_danificado,
             'Consequência automática do parecer 🔴 danificado.');
      end if;
    end if;

    if not v_divergente and new.estado_qualidade <> 'danificado' then
      -- Concordância em 🟢/🟡 não gera aviso novo: o 🟡 já avisou na marcação.
      return null;
    end if;

    select u.nome into v_autor_marc from public.plt_usuarios u where u.id = v_marc.usuario_id;
    if v_divergente then
      v_tipo_aviso := 'qualidade_divergencia';
      v_titulo := 'Divergência de qualidade entre ' || coalesce(v_setor_origem, 'setores')
                  || ' e ' || coalesce(v_setor_destino, '');
      v_corpo  := coalesce(v_autor_marc, 'Quem entregou') || coalesce(' (' || v_setor_origem || ')', '')
                  || ' marcou ' || plt_privado.fn_rotulo_estado(v_marc.estado_qualidade)
                  || '; ' || coalesce(v_autor, 'quem recebeu') || coalesce(' (' || v_setor_destino || ')', '')
                  || ' registrou ' || plt_privado.fn_rotulo_estado(new.estado_qualidade)
                  || '. ' || v_peca || '.'
                  || case when new.estado_qualidade = 'danificado'
                          then ' O card foi para a etapa DANIFICADO.' else '' end;
    else
      v_tipo_aviso := 'qualidade_danificado';
      v_titulo := 'Dano confirmado no recebimento';
      v_corpo  := coalesce(v_autor, 'Quem recebeu') || coalesce(' (' || v_setor_destino || ')', '')
                  || ' confirmou ' || plt_privado.fn_rotulo_estado('danificado')
                  || coalesce(' na entrega de ' || v_setor_origem, '')
                  || '. ' || v_peca || '. O card foi para a etapa DANIFICADO.';
    end if;
  end if;

  -- ---------- Destinatários: líderes dos DOIS setores + admins (D-25) ----------
  if v_destinatarios is null then
    select coalesce(array_agg(distinct pessoa), '{}') into v_destinatarios
      from (
        select u.id as pessoa
          from public.plt_usuarios u
         where u.ativo and u.papel = 'admin'
        union
        select us.usuario_id
          from public.plt_usuario_setores us
          join public.plt_usuarios u on u.id = us.usuario_id and u.ativo
         where us.lider_do_setor
           and us.setor_id in (new.setor_origem_id, new.setor_destino_id)
      ) todos
     where pessoa is distinct from new.usuario_id;
  end if;

  if array_length(v_destinatarios, 1) is null then
    return null;
  end if;

  foreach v_destinatario in array v_destinatarios loop
    insert into public.plt_notificacoes
        (destinatario_id, evento_id, card_id, tipo, titulo, corpo)
      values
        (v_destinatario, new.id, new.card_id, v_tipo_aviso, v_titulo, v_corpo);
  end loop;

  -- O FATO de o aviso ter saído também é história do card.
  insert into public.plt_eventos
      (card_id, tipo, origem, evento_referencia_id,
       setor_origem_id, setor_destino_id, observacao, dados)
    values
      (new.card_id, 'notificacao_enviada', 'automacao', new.id,
       new.setor_origem_id, new.setor_destino_id, v_titulo,
       jsonb_build_object('tipo', v_tipo_aviso, 'destinatarios', to_jsonb(v_destinatarios)));

  return null;
end;
$$;

comment on function plt_privado.fn_reagir_qualidade() is
  'Consequências automáticas da qualidade (M-01/D-25): parecer 🔴 leva o card à etapa DANIFICADO; 🟡/🔴/divergência notificam líderes dos dois setores + admins; chegada ao ESTOQUE e a Pedidos em aguardo avisa os admins (S24 — com o que o cancelamento fez com a peça).';

-- ----------------------------------------------------------------------------
-- 10 · Cancelamento: a peça perde o pedido por EVENTO (M-01 — o sistema
--      executa a consequência; o Tiny decidiu)
--
--   · no próprio `pedido_cancelado` (card de pedido): peça pronta no aguardo
--     (ou, legado, no ESTOQUE) é desvinculada — e a do aguardo volta ao
--     ESTOQUE, sem dono;
--   · na chegada ao ESTOQUE de peça de pedido cancelado (ela seguia na
--     produção com a etiqueta "Pedido cancelado" e ficou pronta).
--   Peça em produção e peça já lançada para ROTAS não mudam aqui.
--   O `pedido_cancelado` nasce dentro da blindagem de fn_reagir_pedido
--   (exceção vira aviso): erro aqui nunca derruba fn_upsert_pedido.
--   Nome com "zz": os gatilhos AFTER rodam em ordem alfabética — este roda por
--   último, depois do aviso de chegada (que ainda enxerga o pedido).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_desvincular_por_cancelamento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido_id bigint;
  v_numero    integer;
  v_aguardo   bigint;
  v_estoque   bigint;
  v_codigo    text;
  v_descricao text;
  r           record;
begin
  if new.tipo = 'pedido_cancelado' then
    select c.pedido_id into v_pedido_id
      from public.plt_cards c where c.id = new.card_id and c.tipo = 'pedido';
    if v_pedido_id is null then
      return null;
    end if;
    select p.numero into v_numero from public.pedidos p where p.id = v_pedido_id;
    select s.id into v_aguardo from public.plt_setores s where s.codigo = 'aguardo';
    select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque';

    for r in
      select u.id, u.setor_atual_id, u.etapa_atual_id, u.item_codigo, u.item_descricao
        from public.plt_cards u
       where u.pedido_id = v_pedido_id
         and u.tipo = 'unidade'
         and u.arquivado_em is null
         and u.setor_atual_id in (v_aguardo, v_estoque)
       order by u.id
    loop
      insert into public.plt_eventos (card_id, tipo, origem, evento_referencia_id, observacao, dados)
        values (r.id, 'unidade_desvinculada', 'automacao', new.id,
                'Pedido ' || coalesce(v_numero::text, '') || ' cancelado no Tiny — a peça ficou sem dono.',
                jsonb_build_object(
                  'motivo',          'pedido_cancelado',
                  'pedido_id',       v_pedido_id,
                  'numero',          v_numero,
                  'card_pedido_id',  new.card_id,
                  'produto_tiny_id', plt_privado.fn_produto_do_item(r.item_codigo, r.item_descricao)));
      if r.setor_atual_id = v_aguardo and v_estoque is not null then
        -- Sem evento_referencia_id de propósito: nas movimentações ele é a
        -- marcação de qualidade da transição (D-09) — aqui não há marcação.
        insert into public.plt_eventos
            (card_id, tipo, origem, setor_origem_id, etapa_origem_id, setor_destino_id,
             observacao, dados)
          values
            (r.id, 'movimentacao_setor', 'automacao', v_aguardo, r.etapa_atual_id, v_estoque,
             'Pedido cancelado — a peça pronta voltou ao ESTOQUE, sem dono.',
             jsonb_build_object('motivo', 'pedido_cancelado', 'numero', v_numero,
                                'cancelamento_evento_id', new.id));
      end if;
    end loop;
    return null;
  end if;

  if new.tipo = 'movimentacao_setor' then
    if not exists (select 1 from public.plt_setores s
                    where s.id = new.setor_destino_id and s.codigo = 'estoque') then
      return null;
    end if;
    select c.pedido_id, c.item_codigo, c.item_descricao
      into v_pedido_id, v_codigo, v_descricao
      from public.plt_cards c where c.id = new.card_id and c.tipo = 'unidade';
    if v_pedido_id is null or not plt_privado.fn_pedido_cancelado(v_pedido_id) then
      return null;
    end if;
    select p.numero into v_numero from public.pedidos p where p.id = v_pedido_id;
    insert into public.plt_eventos (card_id, tipo, origem, evento_referencia_id, observacao, dados)
      values (new.card_id, 'unidade_desvinculada', 'automacao', new.id,
              'Pedido ' || coalesce(v_numero::text, '') || ' cancelado no Tiny — a peça ficou pronta e entrou no ESTOQUE sem dono.',
              jsonb_build_object(
                'motivo',          'pedido_cancelado',
                'pedido_id',       v_pedido_id,
                'numero',          v_numero,
                'card_pedido_id',  (select pc.id from public.plt_cards pc
                                     where pc.pedido_id = v_pedido_id and pc.tipo = 'pedido'),
                'produto_tiny_id', plt_privado.fn_produto_do_item(v_codigo, v_descricao)));
  end if;
  return null;
end;
$$;

comment on function plt_privado.fn_desvincular_por_cancelamento() is
  'SESSAO-24: consequência do cancelamento no Tiny (M-01) — peça pronta no aguardo perde o pedido e volta ao ESTOQUE; peça de pedido cancelado que chega pronta ao ESTOQUE perde o pedido. Tudo por evento (unidade_desvinculada), origem automação.';

drop trigger if exists plt_eventos_zz_desvincular_cancelados on public.plt_eventos;
create trigger plt_eventos_zz_desvincular_cancelados
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('pedido_cancelado', 'movimentacao_setor'))
  execute function plt_privado.fn_desvincular_por_cancelamento();

-- ----------------------------------------------------------------------------
-- 11 · Os gestos novos (endpoints de propósito — padrão plt_fn_*, E-11)
-- ----------------------------------------------------------------------------

-- 11.1 · SOLTAR o card numa etapa do quadro (o gesto único do arrasto)
--   · etapa que encaminha → o card vai ao setor dela (a marcação é obrigatória
--     saindo de produção — D-09; quem valida é o mover);
--   · etapa de início de setor de produção → inicia o tempo de quem arrastou
--     (mover + iniciar numa transação: se o limite ou o parecer recusarem,
--     nada acontece);
--   · qualquer outra etapa (ou "sem etapa") → só mover (a execução aberta, se
--     houver, se encerra no mover — D-24).
create or replace function public.plt_fn_soltar_card(
  p_card_id          bigint,
  p_etapa_destino_id bigint default null,
  p_estado_qualidade text   default null,
  p_observacao       text   default null,
  p_operador_id      uuid   default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card     public.plt_cards%rowtype;
  v_etapa    public.plt_etapas%rowtype;
  v_producao boolean;
  v_eh_fila  boolean;
  v_usuario  uuid;
  v_evento   bigint;
begin
  if plt_privado.fn_usuario_atual() is null then
    raise exception 'Só usuário ativo da plataforma move cards.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards where id = p_card_id;
  if not found or v_card.arquivado_em is not null then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;

  -- "Sem etapa" (a coluna Chegada do PCP e dos terminais): só mover.
  if p_etapa_destino_id is null then
    v_evento := public.plt_fn_mover_card(p_card_id, v_card.setor_atual_id, null,
                                         null, p_observacao, p_operador_id);
    return jsonb_build_object('acao', 'movido', 'evento_id', v_evento);
  end if;

  select * into v_etapa from public.plt_etapas where id = p_etapa_destino_id and ativa;
  if not found or v_etapa.setor_id is distinct from v_card.setor_atual_id then
    raise exception 'Solte o card numa etapa do próprio quadro.' using errcode = 'check_violation';
  end if;
  if v_etapa.id is not distinct from v_card.etapa_atual_id then
    raise exception 'O card já está aí.' using errcode = 'check_violation';
  end if;

  -- 1) Etapa que encaminha: o card vai para o setor dela.
  if v_etapa.setor_destino_id is not null then
    v_evento := public.plt_fn_mover_card(p_card_id, v_etapa.setor_destino_id, null,
                                         p_estado_qualidade, p_observacao, p_operador_id);
    return jsonb_build_object('acao', 'encaminhado',
                              'setor_destino_id', v_etapa.setor_destino_id,
                              'evento_id', v_evento);
  end if;

  -- 2) Etapa de início de setor de produção: soltar aqui inicia o tempo.
  select s.papel_no_fluxo = 'producao' into v_producao
    from public.plt_setores s where s.id = v_card.setor_atual_id;
  if coalesce(v_producao, false) and v_card.tipo = 'unidade'
     and v_etapa.id = plt_privado.fn_etapa_inicio(v_card.setor_atual_id) then
    v_usuario := plt_privado.fn_autor_do_gesto(v_card.setor_atual_id, p_operador_id);

    select e.eh_fila into v_eh_fila from public.plt_etapas e where e.id = v_card.etapa_atual_id;
    if not coalesce(v_eh_fila, false) then
      -- Vindo de outra etapa (PARADO, CONCLUÍDO…): move antes, inicia depois —
      -- mesma transação, mesmo instante; a ordem de leitura é o id.
      insert into public.plt_eventos
          (card_id, tipo, usuario_id, origem,
           setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id)
        values
          (p_card_id, 'movimentacao_etapa', v_usuario, 'interface',
           v_card.setor_atual_id, v_card.etapa_atual_id, v_card.setor_atual_id, v_etapa.id);
    end if;
    -- Na fila, o iniciar leva sozinho à etapa de início (migration 30).
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
      values (p_card_id, 'execucao_iniciada', v_usuario, 'interface')
      returning id into v_evento;
    return jsonb_build_object('acao', 'iniciado', 'evento_id', v_evento);
  end if;

  -- 3) Qualquer outra etapa: só mover.
  v_evento := public.plt_fn_mover_card(p_card_id, v_card.setor_atual_id, v_etapa.id,
                                       null, p_observacao, p_operador_id);
  return jsonb_build_object('acao', 'movido', 'evento_id', v_evento);
end;
$$;

comment on function public.plt_fn_soltar_card(bigint, bigint, text, text, uuid) is
  'SESSAO-24 — o quadro por arrasto (dono, 27/09): soltar na etapa que encaminha leva o card ao setor dela (com a marcação, D-09); soltar na etapa de início inicia o tempo de quem arrastou (mover + iniciar numa transação); o resto é mover. p_operador_id = operador do PIN no tablet. Endpoint de propósito — gate interno.';

-- 11.2 · CONCLUIR PRODUÇÃO: o banco decide o destino (b4 do dono)
create or replace function public.plt_fn_concluir_producao(
  p_card_id          bigint,
  p_estado_qualidade text default 'perfeito',
  p_observacao       text default null,
  p_operador_id      uuid default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card       public.plt_cards%rowtype;
  v_papel      text;
  v_destino    text;
  v_destino_id bigint;
begin
  if plt_privado.fn_usuario_atual() is null then
    raise exception 'Só usuário ativo da plataforma conclui peças.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards
   where id = p_card_id and tipo = 'unidade' and arquivado_em is null;
  if not found then
    raise exception 'Unidade % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  select s.papel_no_fluxo into v_papel from public.plt_setores s where s.id = v_card.setor_atual_id;
  if coalesce(v_papel, '') <> 'producao' then
    raise exception 'Só peça em produção se conclui — esta já não está num setor de produção.'
      using errcode = 'check_violation';
  end if;

  -- Pedido vivo → Pedidos em aguardo; sem pedido (reposição) ou pedido
  -- cancelado → ESTOQUE, sem dono (a desvinculação acontece na chegada).
  v_destino := case
                 when v_card.pedido_id is null
                      or plt_privado.fn_pedido_cancelado(v_card.pedido_id) then 'estoque'
                 else 'aguardo'
               end;
  select s.id into v_destino_id from public.plt_setores s where s.codigo = v_destino and s.ativo;
  if v_destino_id is null then
    raise exception 'O fim de linha "%" não está cadastrado — fale com o admin.', v_destino
      using errcode = 'no_data_found';
  end if;

  perform public.plt_fn_mover_card(p_card_id, v_destino_id, null,
                                   coalesce(p_estado_qualidade, 'perfeito'),
                                   p_observacao, p_operador_id);
  return v_destino;
end;
$$;

comment on function public.plt_fn_concluir_producao(bigint, text, text, uuid) is
  'SESSAO-24 (b4 do dono): conclui a peça — pedido vivo vai para Pedidos em aguardo; peça sem pedido ou de pedido cancelado vai para o ESTOQUE, sem dono. Reaproveita plt_fn_mover_card (marcação, autor do PIN, gates). Devolve o destino (aguardo | estoque).';

-- 11.3 · SUGESTÃO DE ALOCAÇÃO: para cada vaga (k/n) ainda não liberada do
--        pedido, a peça livre IGUAL mais antiga do ESTOQUE (uma por vaga).
-- E-17: a 42 mudou a forma de retorno (coluna `reservada`) — drop antes do create.
drop function if exists public.plt_fn_sugestoes_alocacao(bigint);
create or replace function public.plt_fn_sugestoes_alocacao(p_card_id bigint)
returns table (
  item_seq           integer,
  indice_unidade     integer,
  total_unidades     integer,
  peca_card_id       bigint,
  peca_origem        text,
  peca_origem_numero integer,
  pecas_iguais       integer
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
    select pi.seq, round(pi.quantidade)::int as n,
           plt_privado.fn_chave_peca(plt_privado.fn_produto_do_item(pi.codigo, pi.descricao),
                                     pi.codigo, pi.descricao) as chave
      from public.pedido_itens pi
      join alvo a on a.pedido_id = pi.pedido_id
     where round(pi.quantidade) >= 1
  ),
  vagas as (
    select i.seq, k.k, i.n, i.chave,
           row_number() over (partition by i.chave order by i.seq, k.k) as ordem
      from itens i
      cross join lateral generate_series(1, i.n) as k(k)
     where not exists (
       select 1 from public.plt_cards u, alvo a
        where u.pedido_id = a.pedido_id and u.tipo = 'unidade'
          and u.item_seq = i.seq and u.indice_unidade = k.k)
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
       and coalesce(c.qualidade_atual, 'perfeito') = 'perfeito'
  ),
  pecas as (
    select l.*,
           row_number() over (partition by l.chave order by l.desde, l.id) as ordem,
           count(*) over (partition by l.chave)                             as iguais
      from livres l
  )
  select v.seq,
         v.k,
         v.n,
         p.id,
         case when pai.tipo = 'reposicao' then 'reposicao' else 'cancelamento' end,
         case when pai.tipo = 'pedido' then ped.numero end,
         p.iguais::int
    from vagas v
    join pecas p on p.chave = v.chave and p.ordem = v.ordem
    left join public.plt_cards pai on pai.id = p.card_pai_id
    left join public.pedidos ped on ped.id = pai.pedido_id
   order by v.seq, v.k;
$$;

comment on function public.plt_fn_sugestoes_alocacao(bigint) is
  'SESSAO-24: para cada unidade (k/n) ainda não liberada do pedido, a peça livre IGUAL (fn_chave_peca) mais antiga do ESTOQUE — uma peça por vaga — com a origem dela (reposição ou pedido cancelado). Só sugestão: quem decide é o PCP. Gate da logística (PCP/logística e admin).';

-- 11.4 · ALOCAR: a peça livre vira a unidade (k/n) do pedido — nasce um card
--        novo direto em Pedidos em aguardo, e a peça livre é consumida.
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

  select pi.codigo, pi.descricao, round(pi.quantidade)::int
    into v_codigo, v_descricao, v_n
    from public.pedido_itens pi
   where pi.pedido_id = v_pc.pedido_id and pi.seq = p_item_seq and round(pi.quantidade) >= 1;
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
                               'origem_peca', coalesce(v_origem, 'reposicao'),
                               'pedido_id', v_pc.pedido_id,
                               'numero', v_numero));

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
    values (v_peca.id, 'peca_alocada', v_usuario, 'interface', v_peca.setor_atual_id,
            'Usada pelo pedido ' || coalesce(v_numero::text, '')
              || format(' (%s/%s)', p_indice_unidade, v_n) || '.',
            jsonb_build_object('pedido_id', v_pc.pedido_id,
                               'numero', v_numero,
                               'card_pedido_id', v_pc.id,
                               'unidade_card_id', v_novo,
                               'item_seq', p_item_seq,
                               'indice_unidade', p_indice_unidade));
  return v_novo;
end;
$$;

comment on function public.plt_fn_alocar_peca(bigint, integer, integer, bigint) is
  'SESSAO-24: o PCP aceita a sugestão — nasce a unidade (k/n) do pedido direto em Pedidos em aguardo (card_criado com alocada_de) e a peça livre é consumida (peca_alocada). Se o pedido cancelar depois, a unidade volta ao ESTOQUE sem dono. Gate da logística.';

-- ----------------------------------------------------------------------------
-- 12 · As portas de leitura (evoluídas — nada paralelo, E-22)
-- ----------------------------------------------------------------------------

-- 12.1 · Pedidos em aguardo → aba "Pedidos": mesma forma de retorno das
--        migrations 25/29; as prontas saem da base única do aguardo.
create or replace function public.plt_fn_pedidos_aguardo(
  p_busca        text    default null,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  card_id                 bigint,
  pedido_id               bigint,
  numero                  integer,
  cliente_nome            text,
  data_prevista           date,
  situacao                text,
  total_unidades          integer,
  unidades_liberadas      integer,
  unidades_prontas        integer,
  completo                boolean,
  alterado_apos_liberacao boolean,
  primeira_pronta_em      timestamptz,
  completo_em             timestamptz,
  contagem_total          bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with prontas as materialized (
    select a.card_pedido_id,
           count(*)::int       as prontas,
           min(u.concluido_em) as primeira,
           max(u.concluido_em) as ultima
      from plt_privado.fn_unidades_em_aguardo() a
      join public.plt_cards u on u.id = a.unidade_id
     group by a.card_pedido_id
  ),
  linhas as (
    select pc.id                          as card_id,
           p.id                           as pedido_id,
           p.numero,
           coalesce(c.nome, '')           as cliente_nome,
           p.data_prevista,
           p.situacao,
           coalesce(i.total_unidades, 0)  as total_unidades,
           coalesce(l.liberadas, 0)       as unidades_liberadas,
           pr.prontas                     as unidades_prontas,
           (coalesce(i.total_unidades, 0) > 0
            and pr.prontas >= coalesce(i.total_unidades, 0)) as completo,
           exists (select 1 from public.plt_eventos e
                    where e.card_id = pc.id and e.tipo = 'pedido_atualizado')
                                          as alterado_apos_liberacao,
           pr.primeira                    as primeira_pronta_em,
           pr.ultima                      as ultima_pronta
      from prontas pr
      join public.plt_cards pc on pc.id = pr.card_pedido_id
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join lateral (
        select coalesce(sum(case when round(pi.quantidade) >= 1
                                 then round(pi.quantidade)::int else 0 end), 0)::int
                 as total_unidades
          from public.pedido_itens pi
         where pi.pedido_id = p.id
      ) i on true
      left join lateral (
        select count(*)::int as liberadas
          from public.plt_cards cu
         where cu.pedido_id = p.id and cu.tipo = 'unidade' and cu.arquivado_em is null
      ) l on true
     where plt_privado.fn_pode_ver_expedicao()
       and (p_busca is null or btrim(p_busca) = ''
            or p.numero::text like btrim(p_busca) || '%'
            or c.nome ilike '%' || btrim(p_busca) || '%')
  )
  select l.card_id, l.pedido_id, l.numero, l.cliente_nome, l.data_prevista, l.situacao,
         l.total_unidades, l.unidades_liberadas, l.unidades_prontas, l.completo,
         l.alterado_apos_liberacao, l.primeira_pronta_em,
         case when l.completo then l.ultima_pronta end as completo_em,
         count(*) over ()                              as contagem_total
    from linhas l
   order by l.completo desc, l.data_prevista asc nulls last, l.numero
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_pedidos_aguardo(text, integer, integer) is
  'Pedidos em aguardo → aba "Pedidos" (S15/S22; S24: as prontas saem da base única fn_unidades_em_aguardo — a mesma da aba "Produtos reservados"). Pedidos com peça pronta ainda não lançados, com (k/n), completo e o tempo de aguardo. Gate da logística.';

-- 12.2 · Pedidos em aguardo → aba "Produtos reservados" (a visão plana, a2 do
--        dono): cada peça pronta, com o pedido, o produto e o tempo em aguardo.
create or replace function public.plt_fn_produtos_reservados(
  p_busca        text    default null,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  card_id         bigint,
  card_pedido_id  bigint,
  pedido_id       bigint,
  numero          integer,
  cliente_nome    text,
  situacao        text,
  item_codigo     text,
  item_descricao  text,
  indice_unidade  integer,
  total_unidades  integer,
  local           text,
  qualidade_atual text,
  pronta_em       timestamptz,
  veio_do_estoque boolean,
  pedido_completo boolean,
  contagem_total  bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as materialized (
    select a.unidade_id, a.card_pedido_id, a.pedido_id
      from plt_privado.fn_unidades_em_aguardo() a
  ),
  por_pedido as (
    select b.card_pedido_id, b.pedido_id, count(*)::int as prontas,
           (select coalesce(sum(case when round(pi.quantidade) >= 1
                                     then round(pi.quantidade)::int else 0 end), 0)::int
              from public.pedido_itens pi where pi.pedido_id = b.pedido_id) as total
      from base b
     group by b.card_pedido_id, b.pedido_id
  )
  select u.id,
         b.card_pedido_id,
         p.id,
         p.numero,
         coalesce(c.nome, ''),
         p.situacao,
         u.item_codigo,
         u.item_descricao,
         u.indice_unidade,
         u.total_unidades,
         s.codigo,
         u.qualidade_atual,
         u.concluido_em,
         exists (select 1 from public.plt_eventos e
                  where e.card_id = u.id and e.tipo = 'card_criado' and e.dados ? 'alocada_de'),
         (pp.total > 0 and pp.prontas >= pp.total),
         count(*) over ()
    from base b
    join public.plt_cards u on u.id = b.unidade_id
    join public.pedidos p on p.id = b.pedido_id
    join por_pedido pp on pp.card_pedido_id = b.card_pedido_id
    left join public.clientes c on c.id = p.cliente_id
    left join public.plt_setores s on s.id = u.setor_atual_id
   where plt_privado.fn_pode_ver_expedicao()
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.nome ilike '%' || btrim(p_busca) || '%'
          or u.item_descricao ilike '%' || btrim(p_busca) || '%'
          or u.item_codigo ilike btrim(p_busca) || '%')
   order by u.concluido_em asc nulls last, u.id
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_produtos_reservados(text, integer, integer) is
  'SESSAO-24 — Pedidos em aguardo → aba "Produtos reservados": cada peça pronta de pedido (SKU + nº do pedido), com o tempo em aguardo e se veio do estoque. Mesma base da aba "Pedidos" (os contadores batem). Paginada no servidor. Gate da logística.';

-- 12.3 · As contagens das abas (agregado barato — regra 17)
create or replace function public.plt_fn_aguardo_contagens()
returns table (
  pedidos           integer,
  pedidos_completos integer,
  produtos          integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as materialized (
    select a.card_pedido_id, a.pedido_id from plt_privado.fn_unidades_em_aguardo() a
  ),
  por_pedido as (
    select b.card_pedido_id, count(*)::int as prontas,
           (select coalesce(sum(case when round(pi.quantidade) >= 1
                                     then round(pi.quantidade)::int else 0 end), 0)::int
              from public.pedido_itens pi where pi.pedido_id = b.pedido_id) as total
      from base b
     group by b.card_pedido_id, b.pedido_id
  )
  select count(*)::int,
         (count(*) filter (where pp.total > 0 and pp.prontas >= pp.total))::int,
         coalesce(sum(pp.prontas), 0)::int
    from por_pedido pp
   where plt_privado.fn_pode_ver_expedicao();
$$;

comment on function public.plt_fn_aguardo_contagens() is
  'SESSAO-24: os números das abas de Pedidos em aguardo (pedidos, completos e produtos reservados), da mesma base das listas. Gate da logística.';

-- 12.4 · O quadro do PCP sem os CANCELADOS (eles têm aba própria — mesma forma
--        de retorno da migration 36; só o corpo muda)
create or replace function public.plt_fn_cards_pedido_pcp(
  p_limite       integer default 10,
  p_deslocamento integer default 0
)
returns table (
  id bigint,
  tipo text,
  pedido_id bigint,
  card_pai_id bigint,
  item_seq integer,
  item_codigo text,
  item_descricao text,
  indice_unidade integer,
  total_unidades integer,
  setor_atual_id bigint,
  etapa_atual_id bigint,
  desde timestamptz,
  executor_atual_id uuid,
  responsavel_id uuid,
  delegado_em timestamptz,
  qualidade_atual text,
  concluido_em timestamptz,
  pausado_em timestamptz,
  liberado_completo_em timestamptz,
  contagem_total bigint
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
         count(*) over ()::bigint as contagem_total
    from public.plt_cards c
    join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
    left join public.pedidos p on p.id = c.pedido_id
   where plt_privado.fn_usuario_atual() is not null
     and (
       plt_privado.fn_eh_admin()
       or c.setor_atual_id in (select plt_privado.fn_setores_do_usuario())
     )
     and c.tipo in ('pedido', 'reposicao')
     and c.arquivado_em is null
     and c.liberado_completo_em is null
     -- Pedido encerrado no Tiny sai do quadro (S23); CANCELADO vai para a aba
     -- Cancelados (S24). A reposição não tem pedido: fica até ser liberada
     -- por inteiro ou arquivada.
     and (c.tipo = 'reposicao'
          or (p.id is not null
              and plt_privado.fn_situacao_normalizada(p.situacao)
                  not in ('entregue', 'nao_entregue', 'cancelado')))
   order by c.desde asc nulls last, c.id
   limit least(greatest(coalesce(p_limite, 10), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_cards_pedido_pcp(integer, integer) is
  'O quadro do PCP (S23, S25; S24: sem os cancelados, que têm aba própria): pedidos abertos e não encerrados no Tiny e os cards de REPOSIÇÃO ainda não liberados por inteiro, paginados com o total na mesma consulta (regra 17). Gate: admin ou gente do setor de entrada.';

-- 12.5 · A aba CANCELADOS do PCP: o histórico, para sempre (b3 do dono),
--        paginado e carregado só ao abrir.
create or replace function public.plt_fn_pedidos_cancelados(
  p_busca        text    default null,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  card_id        bigint,
  pedido_id      bigint,
  numero         integer,
  cliente_nome   text,
  data_pedido    date,
  cancelado_em   timestamptz,
  total_unidades integer,
  em_producao    integer,
  prontas        integer,
  no_estoque     integer,
  contagem_total bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pc.id,
         p.id,
         p.numero,
         coalesce(c.nome, ''),
         p.data_pedido,
         ev.cancelado_em,
         coalesce(i.total, 0),
         coalesce(u.em_producao, 0),
         coalesce(u.prontas, 0),
         coalesce(d.no_estoque, 0),
         count(*) over ()
    from public.plt_cards pc
    join public.pedidos p on p.id = pc.pedido_id
    left join public.clientes c on c.id = p.cliente_id
    left join lateral (
      select min(e.ocorrido_em) as cancelado_em
        from public.plt_eventos e
       where e.card_id = pc.id and e.tipo = 'pedido_cancelado'
    ) ev on true
    left join lateral (
      select coalesce(sum(case when round(pi.quantidade) >= 1
                               then round(pi.quantidade)::int else 0 end), 0)::int as total
        from public.pedido_itens pi where pi.pedido_id = p.id
    ) i on true
    left join lateral (
      -- peças que ainda carregam o pedido: na produção (com a etiqueta) ou num fim de linha
      select count(*) filter (where s.papel_no_fluxo <> 'terminal')::int as em_producao,
             count(*) filter (where s.papel_no_fluxo = 'terminal')::int  as prontas
        from public.plt_cards cu
        left join public.plt_setores s on s.id = cu.setor_atual_id
       where cu.pedido_id = p.id and cu.tipo = 'unidade' and cu.arquivado_em is null
    ) u on true
    left join lateral (
      -- peças que perderam o pedido e ficaram sem dono no estoque
      select count(*)::int as no_estoque
        from public.plt_cards cu
       where cu.card_pai_id = pc.id and cu.tipo = 'unidade'
         and cu.pedido_id is null and cu.arquivado_em is null
    ) d on true
   where plt_privado.fn_usuario_atual() is not null
     and (plt_privado.fn_eh_admin()
          or pc.setor_atual_id in (select plt_privado.fn_setores_do_usuario()))
     and pc.tipo = 'pedido'
     and pc.arquivado_em is null
     and plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.nome ilike '%' || btrim(p_busca) || '%')
   order by ev.cancelado_em desc nulls last, p.numero desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_pedidos_cancelados(text, integer, integer) is
  'SESSAO-24 — a aba Cancelados do PCP: pedidos cancelados no Tiny, com quando cancelou e o que houve com as peças (em produção com a etiqueta, prontas, sem dono no estoque). Guarda para sempre (b3 do dono); paginada, carregada ao abrir. Gate do quadro do PCP.';

-- 12.6 · O retrato do estoque por produto (recriado a partir da migration 36):
--        "reservados" = peça pronta COM pedido num fim de linha fora da ROTAS
--        (Pedidos em aguardo — ou, legado, o ESTOQUE).
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
    -- SESSAO-24: a peça pronta de pedido mora em Pedidos em aguardo.
    select ps.tiny_id, count(*)::int as quantidade
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id
                               and s.papel_no_fluxo = 'terminal' and s.codigo <> 'rotas'
      join por_sku ps on ps.codigo = c.item_codigo
     where c.tipo = 'unidade' and c.pedido_id is not null and c.arquivado_em is null
       and not plt_privado.fn_eh_personalizado(c.item_descricao)
     group by ps.tiny_id
  ),
  livres as (
    select c.produto_tiny_id as tiny_id, count(*)::int as quantidade
      from public.plt_cards c
     where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
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
         pr.estoque_minimo                                      as minimo,
         l.saldo                                                as saldo_tiny,
         l.reservado_tiny,
         l.lido_em,
         l.origem                                               as origem_leitura,
         l.evento_id                                            as evento_leitura_id,
         coalesce(r.quantidade, 0)                              as reservas_loja,
         -- Pode ficar negativo: é a "necessidade extrema" (resposta 3 do dono).
         -- A TELA nunca mostra estoque negativo (D-53) — quem corta é a porta.
         case when l.saldo is not null
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
  'SESSAO-25 (+S24): retrato do estoque por produto do catálogo — saldo lido do Tiny (cru), reservas abertas da loja, disponível = saldo − reservas (negativo = necessidade extrema; as portas mostram 0 — D-53), prontos reservados (em Pedidos em aguardo) × livres (no ESTOQUE; personalizado fora) e a reposição mais recente. Base única das telas e da maquinaria.';

-- 12.7 · As PEÇAS: as do ESTOQUE (livres — da reposição ou de pedido
--        cancelado; e as antigas com pedido) e as reservadas em Pedidos em
--        aguardo. Forma de retorno nova (origem do cancelamento e o lugar) →
--        drop + create (a migration 36 dropa antes de criar — E-17).
drop function if exists public.plt_fn_estoque(text, integer, integer, bigint, text);

create function public.plt_fn_estoque(
  p_busca           text    default null,
  p_limite          integer default 20,
  p_deslocamento    integer default 0,
  p_produto_tiny_id bigint  default null,
  p_dono            text    default null   -- null | 'pedido' | 'livre'
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
              else 'cancelamento' end                                  as origem,
         case when c.pedido_id is null and pai.tipo = 'pedido'
              then po.numero end                                       as origem_numero,
         s.codigo                                                      as local,
         c.id_producao,
         c.qualidade_atual,
         c.desde,
         count(*) over ()                                              as contagem_total
    from public.plt_cards c
    join public.plt_setores s on s.id = c.setor_atual_id
    left join public.pedidos p on p.id = c.pedido_id
    left join public.plt_cards pai on pai.id = c.card_pai_id
    left join public.pedidos po on po.id = pai.pedido_id
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
          or po.numero::text like btrim(p_busca) || '%')
   order by c.desde asc nulls last, c.id
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_estoque(text, integer, integer, bigint, text) is
  'Peças (S15 → S25 → S24): as do ESTOQUE (livres — da reposição ou de pedido cancelado, com o nº dele; e as antigas com pedido) e as reservadas em Pedidos em aguardo (SKU + nº do pedido), filtráveis por produto e dono. Gate da logística. Endpoint de propósito.';

-- 12.8 · Painel: "concluída" = chegada ao fim de linha vinda de FORA dos
--        terminais (recriadas a partir das migrations 28 e 29 — só a CTE de
--        chegadas muda). Lançar para ROTAS e devolver ao ESTOQUE não contam a
--        peça de novo.
create or replace function public.plt_fn_dash_dia(
  p_dia date default null
)
returns table (
  concluidas_dia          integer,
  media_concluidas_4sem   numeric,
  danificados_dia         integer,
  aguardando_lancamento   integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with setores_ok as (
    select sd as id from plt_privado.fn_setores_dashboard() sd
  ),
  terminais_ok as (
    select s.id from public.plt_setores s
     where s.papel_no_fluxo = 'terminal'
       and s.id in (select id from setores_ok)
  ),
  dia as (
    select (coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date)::timestamp
            at time zone 'America/Fortaleza') as ini
  ),
  chegadas as (
    -- chegada de unidade a um terminal que este usuário mede, vinda de FORA
    -- dos terminais (S24: terminal → terminal é lançar ou devolver, não produzir)
    select distinct on (e.card_id, ((e.ocorrido_em at time zone 'America/Fortaleza')::date))
           e.card_id,
           (e.ocorrido_em at time zone 'America/Fortaleza')::date as dia_local
      from public.plt_eventos e
      join public.plt_cards c on c.id = e.card_id and c.tipo = 'unidade'
      left join public.plt_setores so on so.id = e.setor_origem_id
     where e.tipo = 'movimentacao_setor'
       and e.setor_destino_id in (select id from terminais_ok)
       and coalesce(so.papel_no_fluxo, '') <> 'terminal'
  )
  select
    (select count(*)::int from chegadas ch
      where ch.dia_local = (coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date)))
                                                   as concluidas_dia,
    (select round(count(*)::numeric / 4, 1) from chegadas ch
      where ch.dia_local in (
        coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date) - 7,
        coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date) - 14,
        coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date) - 21,
        coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date) - 28))
                                                   as media_concluidas_4sem,
    (select count(distinct e.card_id)::int
       from public.plt_eventos e
       join public.plt_etapas et on et.id = e.etapa_destino_id and et.eh_danificado
      where e.tipo in ('movimentacao_etapa', 'movimentacao_setor')
        and e.setor_destino_id in (select id from setores_ok)
        and e.ocorrido_em >= (select ini from dia)
        and e.ocorrido_em <  (select ini from dia) + interval '1 day')
                                                   as danificados_dia,
    (select count(*)::int
       from public.plt_cards pc
       join public.pedidos p on p.id = pc.pedido_id
       left join lateral (
         select coalesce(sum(case when round(pi.quantidade) >= 1
                                  then round(pi.quantidade)::int else 0 end), 0)::int as total
           from public.pedido_itens pi where pi.pedido_id = p.id
       ) i on true
       left join lateral (
         select count(*) filter (where s.papel_no_fluxo = 'terminal')::int as prontas
           from public.plt_cards cu
           left join public.plt_setores s on s.id = cu.setor_atual_id
          where cu.pedido_id = p.id and cu.tipo = 'unidade' and cu.arquivado_em is null
       ) u on true
      where pc.tipo = 'pedido'
        and pc.arquivado_em is null
        and pc.lancado_rotas_em is null
        and coalesce(i.total, 0) > 0
        and coalesce(u.prontas, 0) >= coalesce(i.total, 0))
                                                   as aguardando_lancamento
   where exists (select 1 from terminais_ok);
$$;

comment on function public.plt_fn_dash_dia(date) is
  'Visão do dia (SESSAO-16; S24: concluída = chegou ao fim de linha vinda de fora dos terminais — lançar/devolver não conta de novo): concluídas no dia, média das mesmas 4 semanas, danificados do dia e pedidos completos aguardando lançamento. Vazio para quem não mede os terminais (D-32).';

create or replace function public.plt_fn_dash_producao_hora(
  p_dia date default null
)
returns table (
  hora        integer,
  concluidas  integer,
  media_4sem  numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with setores_ok as (
    select sd as id from plt_privado.fn_setores_dashboard() sd
  ),
  terminais_ok as (
    select s.id from public.plt_setores s
     where s.papel_no_fluxo = 'terminal'
       and s.id in (select id from setores_ok)
  ),
  alvo as (
    select coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date) as dia
  ),
  chegadas as (
    select distinct on (e.card_id, ((e.ocorrido_em at time zone 'America/Fortaleza')::date))
           e.card_id,
           (e.ocorrido_em at time zone 'America/Fortaleza')::date          as dia_local,
           extract(hour from e.ocorrido_em at time zone 'America/Fortaleza')::int as hora_local
      from public.plt_eventos e
      join public.plt_cards c on c.id = e.card_id and c.tipo = 'unidade'
      left join public.plt_setores so on so.id = e.setor_origem_id
     where e.tipo = 'movimentacao_setor'
       and e.setor_destino_id in (select id from terminais_ok)
       and coalesce(so.papel_no_fluxo, '') <> 'terminal'
  )
  select h.hora,
         coalesce(hoje.qtd, 0)                as concluidas,
         round(coalesce(ref.qtd, 0) / 4.0, 2) as media_4sem
    from generate_series(0, 23) as h(hora)
    left join lateral (
      select count(*)::int as qtd from chegadas ch
       where ch.dia_local = (select dia from alvo) and ch.hora_local = h.hora
    ) hoje on true
    left join lateral (
      select count(*)::int as qtd from chegadas ch
       where ch.hora_local = h.hora
         and ch.dia_local in ((select dia from alvo) - 7, (select dia from alvo) - 14,
                              (select dia from alvo) - 21, (select dia from alvo) - 28)
    ) ref on true
   where exists (select 1 from terminais_ok)
   order by h.hora;
$$;

comment on function public.plt_fn_dash_producao_hora(date) is
  'Visão do dia (SESSAO-16; S24: só chegada vinda de fora dos terminais conta): unidades concluídas por hora do dia, com a média das mesmas 4 semanas anteriores por hora. Vazio para quem não mede os terminais (D-32).';

create or replace function public.plt_fn_dash_tendencia_semanas(
  p_semanas integer default 6
)
returns table (
  semana_inicio date,
  unidades      integer,
  media_total   interval
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with alcance as (
    select not exists (
      select 1 from public.plt_setores s
       where s.ativo
         and s.id not in (select plt_privado.fn_setores_dashboard())
    ) as completo
  ),
  semanas as (
    select date_trunc('week', (now() at time zone 'America/Fortaleza'))::date
           - (n * 7) as inicio
      from generate_series(0, greatest(least(coalesce(p_semanas, 6), 26), 1) - 1) as n
  ),
  concluidos as (
    -- a PRIMEIRA chegada ao fim de linha vinda de fora dos terminais (S24)
    select c.id as card_id,
           min((e.ocorrido_em at time zone 'America/Fortaleza'))::date as chegou_dia
      from public.plt_cards c
      join public.plt_eventos e on e.card_id = c.id and e.tipo = 'movimentacao_setor'
      join public.plt_setores s on s.id = e.setor_destino_id and s.papel_no_fluxo = 'terminal'
      left join public.plt_setores so on so.id = e.setor_origem_id
     where c.tipo = 'unidade'
       and coalesce(so.papel_no_fluxo, '') <> 'terminal'
     group by c.id
  ),
  jornadas as (
    select co.card_id,
           date_trunc('week', co.chegou_dia)::date as semana,
           (select coalesce(sum(plt_privado.fn_tempo_util(pm.entrou_em, pm.saiu_em, pm.setor_id, null)), interval '0')
              from public.plt_vw_permanencias pm
             where pm.card_id = co.card_id and pm.eh_fila and pm.saiu_em is not null)
           + (select coalesce(sum(
                 plt_privado.fn_tempo_util(v.iniciou_em, v.finalizou_em, v.setor_id, v.usuario_inicio_id)
                 - (select coalesce(sum(plt_privado.fn_tempo_util(px.ini, px.fim, v.setor_id, v.usuario_inicio_id)), interval '0')
                      from plt_privado.fn_pausas_execucao(v.evento_inicio_id, v.iniciou_em, v.finalizou_em) px)
               ), interval '0')
                from public.plt_vw_execucoes v
               where v.card_id = co.card_id and v.finalizou_em is not null)
           as total_util
      from concluidos co
     where date_trunc('week', co.chegou_dia)::date in (select inicio from semanas)
  )
  select w.inicio                          as semana_inicio,
         count(j.card_id)::int             as unidades,
         avg(j.total_util)                 as media_total
    from semanas w
    left join jornadas j on j.semana = w.inicio
   where (select completo from alcance)
   group by w.inicio
   order by w.inicio;
$$;

-- Tempo parado no ESTOQUE (RF-14, recriada a partir da migration 18): card
-- arquivado (a peça consumida pela alocação, a peça de teste) não está parado
-- em lugar nenhum.
create or replace function public.plt_fn_dash_estoque()
returns table (
  cards_parados  integer,
  tempo_medio    interval,
  tempo_maximo   interval,
  mais_antigo_pedido integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with estoque as (
    select s.id from public.plt_setores s where s.codigo = 'estoque'
  )
  select count(*)::int                              as cards_parados,
         avg(now() - c.desde)                       as tempo_medio,
         max(now() - c.desde)                       as tempo_maximo,
         (select p.numero from public.plt_cards c2
            join public.pedidos p on p.id = c2.pedido_id
           where c2.setor_atual_id in (select id from estoque)
             and c2.tipo = 'unidade'
             and c2.arquivado_em is null
             -- o gate vale também aqui: sem direito ao estoque, nada vaza
             and (select id from estoque) in (select plt_privado.fn_setores_dashboard())
           order by c2.desde asc limit 1)           as mais_antigo_pedido
    from public.plt_cards c
   where c.setor_atual_id in (select id from estoque)
     and c.tipo = 'unidade'
     and c.arquivado_em is null
     and (select id from estoque) in (select plt_privado.fn_setores_dashboard());
$$;

comment on function public.plt_fn_dash_estoque() is
  'Dashboard (RF-14): retrato do tempo parado no ESTOQUE agora (S24: sem os arquivados). Vazio para quem não mede o estoque (D-32).';

-- ----------------------------------------------------------------------------
-- 13 · Permissões: maquinaria fora da API (E-11); portas para authenticated
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_etapa_inicio(bigint)                 from public, anon, authenticated;
revoke all on function plt_privado.fn_pedido_cancelado(bigint)             from public, anon, authenticated;
revoke all on function plt_privado.fn_normalizar_texto(text)               from public, anon, authenticated;
revoke all on function plt_privado.fn_produto_do_item(text, text)          from public, anon, authenticated;
revoke all on function plt_privado.fn_chave_peca(bigint, text, text)       from public, anon, authenticated;
revoke all on function plt_privado.fn_autor_do_gesto(bigint, uuid)         from public, anon, authenticated;
revoke all on function plt_privado.fn_unidades_em_aguardo()                from public, anon, authenticated;
revoke all on function plt_privado.fn_desvincular_por_cancelamento()       from public, anon, authenticated;

revoke all on function public.plt_fn_soltar_card(bigint, bigint, text, text, uuid)      from public, anon;
revoke all on function public.plt_fn_concluir_producao(bigint, text, text, uuid)        from public, anon;
revoke all on function public.plt_fn_sugestoes_alocacao(bigint)                         from public, anon;
revoke all on function public.plt_fn_alocar_peca(bigint, integer, integer, bigint)      from public, anon;
revoke all on function public.plt_fn_pedidos_aguardo(text, integer, integer)            from public, anon;
revoke all on function public.plt_fn_produtos_reservados(text, integer, integer)        from public, anon;
revoke all on function public.plt_fn_aguardo_contagens()                                from public, anon;
revoke all on function public.plt_fn_cards_pedido_pcp(integer, integer)                 from public, anon;
revoke all on function public.plt_fn_pedidos_cancelados(text, integer, integer)         from public, anon;
revoke all on function public.plt_fn_estoque(text, integer, integer, bigint, text)      from public, anon;
revoke all on function public.plt_fn_dash_dia(date)                                     from public, anon;
revoke all on function public.plt_fn_dash_producao_hora(date)                           from public, anon;
revoke all on function public.plt_fn_dash_tendencia_semanas(integer)                    from public, anon;
revoke all on function public.plt_fn_dash_estoque()                                     from public, anon;

grant execute on function public.plt_fn_soltar_card(bigint, bigint, text, text, uuid)   to authenticated;
grant execute on function public.plt_fn_concluir_producao(bigint, text, text, uuid)     to authenticated;
grant execute on function public.plt_fn_sugestoes_alocacao(bigint)                      to authenticated;
grant execute on function public.plt_fn_alocar_peca(bigint, integer, integer, bigint)   to authenticated;
grant execute on function public.plt_fn_pedidos_aguardo(text, integer, integer)         to authenticated;
grant execute on function public.plt_fn_produtos_reservados(text, integer, integer)     to authenticated;
grant execute on function public.plt_fn_aguardo_contagens()                             to authenticated;
grant execute on function public.plt_fn_cards_pedido_pcp(integer, integer)              to authenticated;
grant execute on function public.plt_fn_pedidos_cancelados(text, integer, integer)      to authenticated;
grant execute on function public.plt_fn_estoque(text, integer, integer, bigint, text)   to authenticated;
grant execute on function public.plt_fn_dash_dia(date)                                  to authenticated;
grant execute on function public.plt_fn_dash_producao_hora(date)                        to authenticated;
grant execute on function public.plt_fn_dash_tendencia_semanas(integer)                 to authenticated;
grant execute on function public.plt_fn_dash_estoque()                                  to authenticated;

-- ----------------------------------------------------------------------------
-- 14 · E-19: o check de tipos mais novo valida a tabela inteira
-- ----------------------------------------------------------------------------
-- E-19: o `validate constraint` mudou de casa — quem valida é sempre a
-- migration MAIS NOVA do check (desde 30/09, a 42 — estoque sincronizado).
