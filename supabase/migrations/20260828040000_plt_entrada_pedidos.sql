-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 17 — ENTRADA AUTOMÁTICA DE PEDIDOS
-- Sessão: SESSAO-09 · Data: 2026-08-28 (bloco noturno D-26)
--
-- D-31 (palavras do dono): "não precisa conectar no n8n, ele já lança no
-- banco, então leia o banco e crie o card quando chegar lá, instantaneamente".
--
-- O n8n continua fazendo o que sempre fez (P15: Tiny → fn_upsert_pedido →
-- `pedidos`). O que nasce aqui é a REAÇÃO da plataforma:
--
--   · pedido NOVO em `pedidos` → card de pedido no PCP, sozinho (RF-03/D-13);
--   · pedido ATUALIZADO com unidades já liberadas → evento `pedido_atualizado`
--     (o conflito fica VISÍVEL — lição do bug do pedido 13026 no Plugga);
--   · pedido CANCELADO → evento `pedido_cancelado`; com produção em andamento,
--     os admins são avisados (Q-24 ✅/D-31). O card NÃO some.
--   · pedido HISTÓRICO (sem card) atualizado → nada. Só INSERT cria card.
--
-- ⚠️ REGRA DE OURO DESTE ARQUIVO: o trigger vive na tabela da INTEGRAÇÃO.
-- Erro aqui derrubaria fn_upsert_pedido em produção — por isso o corpo
-- inteiro roda sob `exception when others → raise warning`: a reação da
-- plataforma pode falhar em silêncio; a integração, NUNCA.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · Vocabulário: os dois tipos novos de evento (append-only como sempre)
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
      'qualidade_marcada',
      'qualidade_parecer',
      'divergencia_registrada',
      'notificacao_enviada',
      'delegacao',
      'estorno',
      'pedido_atualizado',   -- SESSAO-09: o Tiny mudou o pedido com produção em andamento
      'pedido_cancelado'     -- SESSAO-09: o pedido foi cancelado no Tiny
    )) not valid;
    -- NOT VALID: reaplicação idempotente num banco que já viveu migrations
    -- futuras (tipos novos) — a última migration do check valida tudo.
end;
$$;

-- ----------------------------------------------------------------------------
-- 2 · Um card de PEDIDO por pedido (D-01) — idempotência como regra de banco:
-- o mesmo pedido chegando 3x (reenvio do Tiny) nunca duplica card.
-- ----------------------------------------------------------------------------
create unique index if not exists plt_cards_pedido_unico
  on public.plt_cards (pedido_id) where tipo = 'pedido';

-- ----------------------------------------------------------------------------
-- 3 · A reação (schema privado — maquinaria, não endpoint; E-11)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_reagir_pedido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card_id       bigint;
  v_setor_pcp     bigint;
  v_liberadas     integer;
  v_cancelou      boolean;
  v_mudou         boolean;
  v_evento_id     bigint;
  v_destinatarios uuid[];
  v_destinatario  uuid;
  v_titulo        text;
  v_corpo         text;
begin
  begin
    if tg_op = 'INSERT' then
      -- Pedido NOVO → card no PCP (entrada única — D-13), instantaneamente.
      select s.id into v_setor_pcp
        from public.plt_setores s
       where s.papel_no_fluxo = 'entrada' and s.ativo
       order by s.id limit 1;
      if v_setor_pcp is null then
        return null; -- sem PCP cadastrado não há onde nascer (não deve acontecer)
      end if;

      insert into public.plt_cards (tipo, pedido_id, setor_atual_id)
           values ('pedido', new.id, v_setor_pcp)
      on conflict do nothing
      returning id into v_card_id;
      if v_card_id is null then
        return null; -- já existia (reenvio) — nada a fazer
      end if;

      insert into public.plt_eventos (card_id, tipo, origem, setor_destino_id, dados)
           values (v_card_id, 'card_criado', 'automacao', v_setor_pcp,
                   jsonb_build_object('fonte', 'tiny', 'numero', new.numero));
      return null;
    end if;

    -- UPDATE ------------------------------------------------------------------
    select c.id into v_card_id
      from public.plt_cards c
     where c.pedido_id = new.id and c.tipo = 'pedido';
    if v_card_id is null then
      return null; -- pedido histórico/não gerenciado: só INSERT cria card
    end if;

    v_cancelou := new.situacao = 'cancelado' and old.situacao is distinct from 'cancelado';
    -- "Mudou de verdade"? A integração regrava o pedido inteiro a cada webhook —
    -- comparar campos relevantes evita evento de ruído em reenvio idêntico.
    v_mudou := (old.situacao       is distinct from new.situacao)
            or (old.data_prevista  is distinct from new.data_prevista)
            or (old.total_produtos is distinct from new.total_produtos)
            or (old.total_pedido   is distinct from new.total_pedido)
            or (old.obs            is distinct from new.obs)
            or (old.obs_interna    is distinct from new.obs_interna)
            or (old.forma_envio    is distinct from new.forma_envio);
    if not v_mudou then
      return null;
    end if;

    select count(*)::int into v_liberadas
      from public.plt_cards c
     where c.pedido_id = new.id and c.tipo = 'unidade';

    if v_cancelou then
      insert into public.plt_eventos (card_id, tipo, origem, observacao, dados)
           values (v_card_id, 'pedido_cancelado', 'automacao',
                   'Pedido cancelado no Tiny.',
                   jsonb_build_object('fonte', 'tiny', 'numero', new.numero,
                                      'unidades_liberadas', v_liberadas))
        returning id into v_evento_id;

      -- Com produção em andamento, gente precisa decidir o que fazer com as
      -- peças — os admins são avisados (Q-24 ✅/D-31).
      if v_liberadas > 0 then
        select coalesce(array_agg(u.id), '{}') into v_destinatarios
          from public.plt_usuarios u
         where u.ativo and u.papel = 'admin';
        v_titulo := 'Pedido ' || new.numero || ' cancelado com produção em andamento';
        v_corpo  := 'O pedido ' || new.numero || ' foi cancelado no Tiny com '
                    || v_liberadas || ' unidade(s) já liberada(s) para produção. '
                    || 'Decida o que fazer com as peças.';
        if array_length(v_destinatarios, 1) is not null then
          foreach v_destinatario in array v_destinatarios loop
            insert into public.plt_notificacoes
                (destinatario_id, evento_id, card_id, tipo, titulo, corpo)
              values
                (v_destinatario, v_evento_id, v_card_id, 'pedido_cancelado', v_titulo, v_corpo);
          end loop;
          insert into public.plt_eventos
              (card_id, tipo, origem, evento_referencia_id, observacao, dados)
            values
              (v_card_id, 'notificacao_enviada', 'automacao', v_evento_id, v_titulo,
               jsonb_build_object('tipo', 'pedido_cancelado',
                                  'destinatarios', to_jsonb(v_destinatarios)));
        end if;
      end if;
      return null;
    end if;

    -- Atualização comum: só vira REGISTRO quando já há produção em andamento —
    -- sem unidade liberada, o card do PCP reflete sozinho (ele lê de pedidos).
    if v_liberadas > 0 then
      insert into public.plt_eventos (card_id, tipo, origem, dados)
           values (v_card_id, 'pedido_atualizado', 'automacao',
                   jsonb_build_object(
                     'fonte', 'tiny', 'numero', new.numero,
                     'unidades_liberadas', v_liberadas,
                     'situacao_antes',  old.situacao,      'situacao_depois',  new.situacao,
                     'previsao_antes',  old.data_prevista, 'previsao_depois',  new.data_prevista));
    end if;
    return null;

  exception when others then
    -- A reação NUNCA derruba a integração (regra de ouro deste arquivo).
    raise warning 'plt_reagir_pedido: % — a integração segue intacta', sqlerrm;
    return null;
  end;
end;
$$;

comment on function plt_privado.fn_reagir_pedido() is
  'SESSAO-09/D-31: pedido novo em `pedidos` vira card no PCP; atualização com produção vira evento visível; cancelamento avisa admins. À prova de falha: erro aqui NUNCA propaga para fn_upsert_pedido.';

revoke all on function plt_privado.fn_reagir_pedido() from public, anon, authenticated;

drop trigger if exists plt_pedidos_reagir on public.pedidos;
create trigger plt_pedidos_reagir
  after insert or update on public.pedidos
  for each row execute function plt_privado.fn_reagir_pedido();

comment on trigger plt_pedidos_reagir on public.pedidos is
  'Da PLATAFORMA (prefixo plt_): reage ao que a integração grava — não altera linha nenhuma de pedidos. Corpo à prova de falha.';

-- ----------------------------------------------------------------------------
-- 4 · As funções de leitura ganham o conflito (forma muda → drop + create,
--     como manda a lição A-12/E-17)
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_pedidos_kanban(text, boolean, bigint[], integer, integer);

create or replace function public.plt_fn_pedidos_kanban(
  p_busca            text     default null,
  p_somente_sem_card boolean  default false,
  p_ids              bigint[] default null,
  p_limite           integer  default 20,
  p_deslocamento     integer  default 0
)
returns table (
  pedido_id       bigint,
  numero          integer,
  cliente_nome    text,
  data_pedido     date,
  data_prevista   date,
  situacao        text,
  total_itens     integer,
  total_unidades  integer,
  tem_card        boolean,
  unidades_liberadas integer,
  alterado_apos_liberacao boolean,
  contagem_total  bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id                                as pedido_id,
         p.numero,
         coalesce(c.nome, '')                as cliente_nome,
         p.data_pedido,
         p.data_prevista,
         p.situacao,
         coalesce(i.total_itens, 0)          as total_itens,
         coalesce(i.total_unidades, 0)       as total_unidades,
         (pc.id is not null)                 as tem_card,
         coalesce(u.liberadas, 0)            as unidades_liberadas,
         -- SESSAO-09: o Tiny mudou o pedido DEPOIS de unidades irem à produção.
         exists (select 1 from public.plt_eventos e
                  where e.card_id = pc.id and e.tipo = 'pedido_atualizado')
                                             as alterado_apos_liberacao,
         count(*) over ()                    as contagem_total
    from public.pedidos p
    left join public.clientes c on c.id = p.cliente_id
    left join lateral (
      select count(*)::int as total_itens,
             coalesce(sum(case when round(pi.quantidade) >= 1
                               then round(pi.quantidade)::int else 0 end), 0)::int
               as total_unidades
        from public.pedido_itens pi
       where pi.pedido_id = p.id
    ) i on true
    left join lateral (
      select count(*)::int as liberadas
        from public.plt_cards cu
       where cu.pedido_id = p.id and cu.tipo = 'unidade'
    ) u on true
    left join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido'
   where plt_privado.fn_usuario_atual() is not null
     and (p_ids is null or p.id = any (p_ids))
     and (not coalesce(p_somente_sem_card, false) or pc.id is null)
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.nome ilike '%' || btrim(p_busca) || '%')
   order by p.data_pedido desc nulls last, p.numero desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_pedidos_kanban(text, boolean, bigint[], integer, integer) is
  'Porta de leitura do kanban: resumo de pedidos sem dado pessoal do cliente, agora com o conflito pós-liberação (SESSAO-09). Endpoint REST de propósito — gate por usuário ativo.';

drop function if exists public.plt_fn_expedicao_kanban(text, integer, integer);

create or replace function public.plt_fn_expedicao_kanban(
  p_busca         text    default null,
  p_limite        integer default 20,
  p_deslocamento  integer default 0
)
returns table (
  pedido_id            bigint,
  numero               integer,
  cliente_nome         text,
  data_prevista        date,
  situacao             text,
  total_unidades       integer,
  unidades_liberadas   integer,
  unidades_no_terminal integer,
  alterado_apos_liberacao boolean,
  contagem_total       bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id                          as pedido_id,
         p.numero,
         coalesce(c.nome, '')          as cliente_nome,
         p.data_prevista,
         p.situacao,
         coalesce(i.total_unidades, 0) as total_unidades,
         coalesce(u.liberadas, 0)      as unidades_liberadas,
         coalesce(u.no_terminal, 0)    as unidades_no_terminal,
         exists (select 1 from public.plt_eventos e
                  where e.card_id = pc.id and e.tipo = 'pedido_atualizado')
                                       as alterado_apos_liberacao,
         count(*) over ()              as contagem_total
    from public.pedidos p
    join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido'
    left join public.clientes c on c.id = p.cliente_id
    left join lateral (
      select coalesce(sum(case when round(pi.quantidade) >= 1
                               then round(pi.quantidade)::int else 0 end), 0)::int
               as total_unidades
        from public.pedido_itens pi
       where pi.pedido_id = p.id
    ) i on true
    left join lateral (
      select count(*)::int as liberadas,
             count(*) filter (where cu.concluido_em is not null)::int as no_terminal
        from public.plt_cards cu
       where cu.pedido_id = p.id and cu.tipo = 'unidade'
    ) u on true
   where plt_privado.fn_pode_ver_expedicao()
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.nome ilike '%' || btrim(p_busca) || '%')
   order by p.data_prevista asc nulls last, p.numero desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_expedicao_kanban(text, integer, integer) is
  'Reagrupamento do pedido (D-01/D-13), agora com situação do Tiny e o conflito pós-liberação (SESSAO-09). Acesso: admin, entrada (PCP) e terminais.';

-- ----------------------------------------------------------------------------
-- 5 · Quem executa o quê (E-11)
-- ----------------------------------------------------------------------------
revoke all on function public.plt_fn_pedidos_kanban(text, boolean, bigint[], integer, integer) from public, anon;
revoke all on function public.plt_fn_expedicao_kanban(text, integer, integer)                  from public, anon;
grant execute on function public.plt_fn_pedidos_kanban(text, boolean, bigint[], integer, integer) to authenticated;
grant execute on function public.plt_fn_expedicao_kanban(text, integer, integer)                  to authenticated;
