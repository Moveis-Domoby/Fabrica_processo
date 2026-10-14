-- ============================================================================
-- SESSAO-31 · etapa D (D-125): o CARD AVULSO — trabalho digitado à mão pelo
-- PCP/logística, líderes e admin, que anda pelos quadros de produção como
-- qualquer card (arrasto, tempo, limite, histórico) e termina no "Concluir".
--
--  1. plt_cards ganha tipo 'avulso' e as propriedades de todo card (D-125 /
--     §2-§3 da demanda): titulo (avulso), descricao, datas (início →
--     vencimento), vínculo (pedido | produto | peça — UM, só referência),
--     quem criou, responsáveis (vários), participantes (quem vê o card fora
--     do setor: criador + responsáveis + mencionados), contadores de anexos e
--     mensagens, e a chave de criação (o mesmo toque = um card só — Lei §10).
--     Tudo o que muda depois da criação é PROJEÇÃO de fato (M-13):
--     card_editado, responsavel_adicionado/removido, comentario_*, anexo_*,
--     avulso_concluido — gatilho plt_eventos_projetar_card.
--  2. Guarda do avulso: só setores de PRODUÇÃO (nasce no PCP); nunca fim de
--     linha (estoque, aguardo, ROTAS…) — o vínculo é referência, o avulso
--     nunca vira peça (D-125). Os fatos novos só pelas portas.
--  3. Quem edita (D-125 resp. 7): avulso — quem criou, os responsáveis, o
--     líder do setor onde ele está, o admin; pedido/peça — PCP/logística,
--     líder, admin. Quem vê: + participantes (resp. 6).
--  4. Etiquetas pelas pessoas (↩️ D-101): quem edita o card põe e tira;
--     criar etiqueta só líder/admin; nome repetido recusado (sem ligar para
--     maiúsculas, acentos e espaços, contando as arquivadas).
--  5. Campos customizados valem em avulsos (em_avulsos); quem edita o card
--     preenche.
--  6. Portas: criar (já lançando, se quiser), lançar, concluir, a lista da aba
--     "Lançamento manual" (A lançar · Em produção · Concluídos, por cursor),
--     editar, responsável, etiqueta. Soltar o avulso na etapa de início inicia
--     o tempo; soltar na etapa que conclui = Concluir.
--  7. O avulso fica fora de "peças": tempos por item e meta de unidades.
--
-- Recriadas POR INTEIRO a partir da versão viva (E-24); assinatura nova =
-- drop + create (E-17); só esta valida os checks (E-19); lock curto (E-66).
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · As propriedades do card
-- ----------------------------------------------------------------------------
alter table public.plt_cards add column if not exists titulo        text;
alter table public.plt_cards add column if not exists descricao     text;
alter table public.plt_cards add column if not exists inicio_em     date;
alter table public.plt_cards add column if not exists vence_em      date;
alter table public.plt_cards add column if not exists vinculo_tipo  text;
alter table public.plt_cards add column if not exists vinculo_id    bigint;
alter table public.plt_cards add column if not exists criado_por_id uuid;
alter table public.plt_cards add column if not exists responsaveis  uuid[] not null default '{}';
alter table public.plt_cards add column if not exists participantes uuid[] not null default '{}';
alter table public.plt_cards add column if not exists anexos_qtd    integer not null default 0;
alter table public.plt_cards add column if not exists mensagens_qtd integer not null default 0;
alter table public.plt_cards add column if not exists chave_criacao uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plt_cards_titulo_ck') then
    alter table public.plt_cards add constraint plt_cards_titulo_ck
      check (titulo is null or char_length(btrim(titulo)) between 1 and 200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plt_cards_descricao_ck') then
    alter table public.plt_cards add constraint plt_cards_descricao_ck
      check (descricao is null or char_length(descricao) <= 5000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plt_cards_datas_ck') then
    alter table public.plt_cards add constraint plt_cards_datas_ck
      check (inicio_em is null or vence_em is null or inicio_em <= vence_em);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plt_cards_vinculo_ck') then
    alter table public.plt_cards add constraint plt_cards_vinculo_ck
      check ((vinculo_tipo is null and vinculo_id is null)
             or (vinculo_tipo in ('pedido', 'produto', 'peca') and vinculo_id is not null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plt_cards_criado_por_fk') then
    alter table public.plt_cards add constraint plt_cards_criado_por_fk
      foreign key (criado_por_id) references public.plt_usuarios (id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plt_cards_contadores_ck') then
    alter table public.plt_cards add constraint plt_cards_contadores_ck
      check (anexos_qtd >= 0 and mensagens_qtd >= 0);
  end if;
end;
$$;
alter table public.plt_cards validate constraint plt_cards_criado_por_fk;

comment on column public.plt_cards.titulo is 'SESSAO-31 (D-125): o nome do card avulso (os outros cards se chamam pelo pedido/produto). Muda por card_editado.';
comment on column public.plt_cards.descricao is 'SESSAO-31: a descrição de todo card (no avulso, a de quem criou). Projeção de card_editado.';
comment on column public.plt_cards.inicio_em is 'SESSAO-31: a data de início (propriedade do card). Projeção de card_editado.';
comment on column public.plt_cards.vence_em is 'SESSAO-31: o vencimento (atrasado = ícone + texto na frente). Projeção de card_editado.';
comment on column public.plt_cards.vinculo_tipo is 'SESSAO-31 (D-125): o vínculo do avulso — pedido | produto | peca; só referência (o avulso nunca vira peça). Um por card.';
comment on column public.plt_cards.criado_por_id is 'SESSAO-31: quem criou o card avulso (projeção do card_criado).';
comment on column public.plt_cards.responsaveis is 'SESSAO-31 (D-125): os responsáveis do card (vários) — projeção de responsavel_adicionado/removido. Diferente de responsavel_id (a delegação do afazer).';
comment on column public.plt_cards.participantes is 'SESSAO-31 (D-125 resp. 6): quem vê o card fora do setor — quem criou, os responsáveis e quem foi mencionado. Projeção.';
comment on column public.plt_cards.anexos_qtd is 'SESSAO-31: anexos vivos do card (a frente mostra sem ir buscar) — projeção de anexo_adicionado/removido.';
comment on column public.plt_cards.mensagens_qtd is 'SESSAO-31: mensagens vivas da conversa do card — projeção de comentario_adicionado/apagado.';
comment on column public.plt_cards.chave_criacao is 'SESSAO-31 (Lei §10): a chave do gesto de criar — o mesmo toque (clique duplo, rede que volta) devolve o card já criado.';

create unique index if not exists plt_cards_chave_criacao_uq on public.plt_cards (chave_criacao) where chave_criacao is not null;
create index if not exists plt_cards_criado_por_idx on public.plt_cards (criado_por_id) where criado_por_id is not null;
create index if not exists plt_cards_participantes_gin on public.plt_cards using gin (participantes) where participantes <> '{}';
-- A aba "Lançamento manual" (por cursor, o mais novo primeiro).
create index if not exists plt_cards_avulso_idx on public.plt_cards (id desc) where tipo = 'avulso';

-- O tipo novo e a coerência dele (só esta migration valida — E-19).
do $$
begin
  alter table public.plt_cards drop constraint if exists plt_cards_tipo_check;
  alter table public.plt_cards add constraint plt_cards_tipo_check
    check (tipo in ('pedido', 'unidade', 'reposicao', 'avulso')) not valid;
end;
$$;
alter table public.plt_cards drop constraint if exists plt_cards_unidade_coerente;
alter table public.plt_cards add constraint plt_cards_unidade_coerente check (
  (tipo = 'unidade' and indice_unidade is not null and total_unidades is not null
     and (pedido_id is not null or produto_tiny_id is not null or card_pai_id is not null))
  or (tipo = 'pedido' and indice_unidade is null and total_unidades is null
     and pedido_id is not null)
  or (tipo = 'reposicao' and indice_unidade is null and total_unidades >= 1
     and pedido_id is null and produto_tiny_id is not null)
  -- SESSAO-31 (D-125): o avulso tem nome e não é peça (sem k/n, sem pedido
  -- nem produto próprios — o vínculo é só referência).
  or (tipo = 'avulso' and indice_unidade is null and total_unidades is null
     and pedido_id is null and produto_tiny_id is null and titulo is not null)
) not valid;
alter table public.plt_cards validate constraint plt_cards_tipo_check;
alter table public.plt_cards validate constraint plt_cards_unidade_coerente;

-- ----------------------------------------------------------------------------
-- 2 · Quem pode o quê no card
-- ----------------------------------------------------------------------------
-- Líder: o papel de líder ou a marca de líder em algum setor (a mesma regra
-- do "ehLider" da tela).
create or replace function plt_privado.fn_eh_lider_de_algum()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.plt_usuarios u
                  where u.auth_user_id = auth.uid() and u.ativo and u.papel = 'lider')
      or exists (select 1 from public.plt_usuario_setores us
                   join public.plt_usuarios u on u.id = us.usuario_id
                  where u.auth_user_id = auth.uid() and u.ativo and us.lider_do_setor);
$$;

-- Criar card avulso: PCP/logística, líderes e admin (D-125 resp. 1).
create or replace function plt_privado.fn_pode_criar_avulso()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select plt_privado.fn_usuario_atual() is not null
     and (plt_privado.fn_eh_admin() or plt_privado.fn_pode_ver_expedicao() or plt_privado.fn_eh_lider_de_algum());
$$;

-- Editar descrição, datas, responsáveis, etiquetas e campos (D-125 resp. 7).
create or replace function plt_privado.fn_pode_editar_card(p_card_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select case
             when c.tipo = 'avulso' then
               plt_privado.fn_eh_admin()
               or c.criado_por_id = plt_privado.fn_usuario_atual()
               or plt_privado.fn_usuario_atual() = any (c.responsaveis)
               or (c.setor_atual_id is not null and plt_privado.fn_eh_lider_de(c.setor_atual_id))
             else
               plt_privado.fn_eh_admin()
               or plt_privado.fn_pode_ver_expedicao()
               or (c.setor_atual_id is not null and plt_privado.fn_eh_lider_de(c.setor_atual_id))
           end
      from public.plt_cards c where c.id = p_card_id), false)
     and plt_privado.fn_usuario_atual() is not null;
$$;

-- Ver o card (a janela, a conversa, os anexos): o setor, o executor, a
-- logística, o admin — e os participantes (D-125 resp. 6).
create or replace function plt_privado.fn_pode_ver_card(p_card_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select plt_privado.fn_usuario_atual() is not null and coalesce((
    select plt_privado.fn_eh_admin()
        or c.setor_atual_id in (select plt_privado.fn_setores_do_usuario())
        or c.executor_atual_id = plt_privado.fn_usuario_atual()
        or plt_privado.fn_usuario_atual() = any (c.participantes)
        or plt_privado.fn_pode_ver_expedicao()
      from public.plt_cards c where c.id = p_card_id), false);
$$;

comment on function plt_privado.fn_pode_editar_card(bigint) is
  'SESSAO-31 (D-125 resp. 7): avulso — quem criou, os responsáveis, o líder do setor onde ele está, o admin; pedido/peça/reposição — PCP/logística, líder do setor atual, admin.';
comment on function plt_privado.fn_pode_ver_card(bigint) is
  'SESSAO-31 (D-125 resp. 6): quem vê o card — admin, o setor, o executor, a logística/PCP e os participantes (quem criou, responsáveis, mencionados).';

-- A leitura dos cards (recriada da migration 07): + participantes; funções
-- de sessão em (select …) — avaliadas uma vez por consulta (Lei §7.3).
drop policy if exists plt_cards_leitura on public.plt_cards;
create policy plt_cards_leitura on public.plt_cards
  for select to authenticated
  using (
    (select plt_privado.fn_eh_admin())
    or setor_atual_id in (select plt_privado.fn_setores_do_usuario())
    or executor_atual_id = (select plt_privado.fn_usuario_atual())
    or participantes @> array[(select plt_privado.fn_usuario_atual())]
  );

-- ----------------------------------------------------------------------------
-- 3 · A projeção das propriedades (só o gatilho escreve — M-13)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_participantes_do_card(p_card_id bigint)
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(distinct p) filter (where p is not null), '{}')
    from (
      select c.criado_por_id as p from public.plt_cards c where c.id = p_card_id
      union all
      select unnest(c.responsaveis) from public.plt_cards c where c.id = p_card_id
      union all
      select nullif(m.v, '')::uuid
        from public.plt_eventos e
        cross join lateral jsonb_array_elements_text(coalesce(e.dados -> 'mencoes', '[]'::jsonb)) as m(v)
       where e.card_id = p_card_id and e.tipo = 'comentario_adicionado'
    ) x;
$$;

create or replace function plt_privado.fn_projetar_card()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_m   jsonb;
  v_uid uuid;
begin
  if new.tipo = 'card_criado' then
    -- O avulso guarda quem o criou (quem edita e quem vê — D-125).
    update public.plt_cards
       set criado_por_id = new.usuario_id,
           participantes = case when new.usuario_id is null then participantes
                                else (select array_agg(distinct x) from unnest(participantes || new.usuario_id) x) end
     where id = new.card_id and tipo = 'avulso' and criado_por_id is null;

  elsif new.tipo = 'card_editado' then
    v_m := coalesce(new.dados -> 'mudancas', '{}'::jsonb);
    update public.plt_cards
       set titulo       = case when v_m ? 'titulo'      then v_m -> 'titulo' ->> 'depois' else titulo end,
           descricao    = case when v_m ? 'descricao'   then v_m -> 'descricao' ->> 'depois' else descricao end,
           inicio_em    = case when v_m ? 'inicio_em'   then (v_m -> 'inicio_em' ->> 'depois')::date else inicio_em end,
           vence_em     = case when v_m ? 'vence_em'    then (v_m -> 'vence_em' ->> 'depois')::date else vence_em end,
           vinculo_tipo = case when v_m ? 'vinculo'     then v_m -> 'vinculo' -> 'depois' ->> 'tipo' else vinculo_tipo end,
           vinculo_id   = case when v_m ? 'vinculo'     then (v_m -> 'vinculo' -> 'depois' ->> 'id')::bigint else vinculo_id end
     where id = new.card_id;

  elsif new.tipo in ('responsavel_adicionado', 'responsavel_removido') then
    v_uid := nullif(new.dados ->> 'responsavel_id', '')::uuid;
    if new.tipo = 'responsavel_adicionado' then
      update public.plt_cards
         set responsaveis = (select array_agg(distinct x) from unnest(responsaveis || v_uid) x)
       where id = new.card_id;
    else
      update public.plt_cards set responsaveis = array_remove(responsaveis, v_uid) where id = new.card_id;
    end if;
    update public.plt_cards set participantes = plt_privado.fn_participantes_do_card(new.card_id)
     where id = new.card_id;

  elsif new.tipo = 'comentario_adicionado' then
    update public.plt_cards set mensagens_qtd = mensagens_qtd + 1 where id = new.card_id;
    if jsonb_array_length(coalesce(new.dados -> 'mencoes', '[]'::jsonb)) > 0 then
      update public.plt_cards set participantes = plt_privado.fn_participantes_do_card(new.card_id)
       where id = new.card_id;
    end if;

  elsif new.tipo = 'comentario_apagado' then
    update public.plt_cards set mensagens_qtd = greatest(mensagens_qtd - 1, 0) where id = new.card_id;

  elsif new.tipo = 'anexo_adicionado' then
    update public.plt_cards set anexos_qtd = anexos_qtd + 1 where id = new.card_id;

  elsif new.tipo = 'anexo_removido' then
    update public.plt_cards set anexos_qtd = greatest(anexos_qtd - 1, 0) where id = new.card_id;

  elsif new.tipo = 'avulso_concluido' then
    update public.plt_cards set concluido_em = new.ocorrido_em where id = new.card_id;
  end if;
  return null;
end;
$$;

comment on function plt_privado.fn_projetar_card() is
  'SESSAO-31 (M-13): as propriedades do card são projeção dos fatos — card_criado (quem criou o avulso), card_editado (título, descrição, datas, vínculo), responsáveis, participantes, contadores de mensagens e anexos, avulso_concluido.';

drop trigger if exists plt_eventos_projetar_card on public.plt_eventos;
create trigger plt_eventos_projetar_card
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('card_criado', 'card_editado', 'responsavel_adicionado', 'responsavel_removido',
                     'comentario_adicionado', 'comentario_apagado', 'anexo_adicionado', 'anexo_removido',
                     'avulso_concluido'))
  execute function plt_privado.fn_projetar_card();

-- Os contadores que já existem (comentário e comprovante da entrega — S30).
update public.plt_cards c
   set mensagens_qtd = x.n
  from (select e.card_id, count(*) filter (where e.tipo = 'comentario_adicionado')
                          - count(*) filter (where e.tipo = 'comentario_apagado') as n
          from public.plt_eventos e
         where e.tipo in ('comentario_adicionado', 'comentario_apagado')
         group by e.card_id) x
 where c.id = x.card_id and c.mensagens_qtd is distinct from greatest(x.n, 0)::int;
update public.plt_cards c
   set anexos_qtd = x.n
  from (select a.card_id, count(*)::int as n from public.plt_anexos a where a.removido_em is null group by a.card_id) x
 where c.id = x.card_id and c.anexos_qtd is distinct from x.n;

-- ----------------------------------------------------------------------------
-- 4 · A guarda do avulso (BEFORE — antes da chegada no estoque, pela ordem
--     alfabética) e dos fatos novos, que só nascem pelas portas
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_avulso()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo  text;
  v_papel text;
begin
  if new.tipo in ('card_editado', 'responsavel_adicionado', 'responsavel_removido') then
    if coalesce(current_setting('plt.card_maquinaria', true), '') <> 'on' then
      raise exception 'Mudar o card é pela janela do card (quem pode editar).' using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  select c.tipo into v_tipo from public.plt_cards c where c.id = new.card_id;
  if new.tipo = 'avulso_concluido' then
    if v_tipo is distinct from 'avulso' then
      raise exception 'Só o card avulso se conclui pelo Concluir.' using errcode = 'check_violation';
    end if;
    if coalesce(current_setting('plt.avulso_maquinaria', true), '') <> 'on' then
      raise exception 'Concluir o card avulso é pelo botão Concluir.' using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  -- card_criado / movimentacao_setor do avulso: só setores de produção (nasce no PCP).
  if v_tipo is distinct from 'avulso' or new.setor_destino_id is null then
    return new;
  end if;
  select s.papel_no_fluxo into v_papel from public.plt_setores s where s.id = new.setor_destino_id;
  if new.tipo = 'card_criado' and v_papel = 'entrada' then
    return new;
  end if;
  if coalesce(v_papel, '') <> 'producao' then
    raise exception 'O card avulso anda só pelos setores de produção — ele não entra em estoque, aguardo nem ROTAS. Para terminar, use Concluir.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists plt_eventos_validar_avulso on public.plt_eventos;
create trigger plt_eventos_validar_avulso
  before insert on public.plt_eventos
  for each row
  when (new.tipo in ('card_criado', 'movimentacao_setor', 'card_editado', 'responsavel_adicionado',
                     'responsavel_removido', 'avulso_concluido'))
  execute function plt_privado.fn_validar_avulso();

-- O aviso ao vivo do quadro de um setor (o tópico e quem ouve nascem na
-- migration seguinte, do quadro numa requisição). Um por setor por transação.
create or replace function plt_privado.fn_avisar_setor(p_setor_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_setor_id is null then
    return;
  end if;
  if exists (select 1 from public.plt_setores s where s.id = p_setor_id and s.papel_no_fluxo = 'producao') then
    perform plt_privado.fn_avisar('setor_' || p_setor_id);
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5 · Etiquetas pelas pessoas (↩️ D-101)
-- ----------------------------------------------------------------------------
-- O nome "do jeito que se compara": sem maiúsculas, sem acentos, sem espaços.
create or replace function plt_privado.fn_nome_comparavel(p_nome text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select regexp_replace(
           lower(translate(coalesce(p_nome, ''),
                           'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
                           'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
           '\s+', '', 'g');
$$;

-- A validação das marcas (recriada POR INTEIRO a partir da migration 59): +
-- a porta do card (plt.card_maquinaria) — quem edita o card põe e tira.
create or replace function plt_privado.fn_validar_marcas()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin    boolean;
  v_etiqueta public.plt_etiquetas%rowtype;
  v_card     public.plt_cards%rowtype;
begin
  if new.tipo not in ('etiqueta_adicionada', 'etiqueta_removida', 'card_desarquivado') then
    return new;
  end if;
  select exists (select 1 from public.plt_usuarios u
                  where u.id = new.usuario_id and u.ativo and u.papel = 'admin') into v_admin;
  -- SESSAO-30 (D-113): desfazer a entrega traz as peças de volta pela maquinaria.
  -- SESSAO-31 (D-125): a porta do card (quem pode editar) põe e tira etiqueta.
  if not plt_privado.fn_evento_do_motor(new.origem, new.dados) and not v_admin
     and not (new.tipo = 'card_desarquivado'
              and coalesce(current_setting('plt.entrega_maquinaria', true), '') = 'on')
     and not (new.tipo in ('etiqueta_adicionada', 'etiqueta_removida')
              and coalesce(current_setting('plt.card_maquinaria', true), '') = 'on') then
    if new.tipo = 'card_desarquivado' then
      raise exception 'Trazer de volta um card arquivado é gesto do admin ou das automações.'
        using errcode = 'insufficient_privilege';
    end if;
    raise exception 'Etiqueta no card é pela janela do card (quem pode editar), pelas automações ou pelo admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;
  if new.tipo = 'card_desarquivado' then
    if v_card.arquivado_em is null then
      raise exception 'Este card não está arquivado.' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  select * into v_etiqueta from public.plt_etiquetas where id = nullif(new.dados ->> 'etiqueta_id', '')::bigint;
  if not found then
    raise exception 'Etiqueta não encontrada.' using errcode = 'no_data_found';
  end if;
  if new.tipo = 'etiqueta_adicionada' then
    if v_etiqueta.arquivada_em is not null then
      raise exception 'A etiqueta "%" está arquivada.', v_etiqueta.nome using errcode = 'check_violation';
    end if;
    if v_etiqueta.id = any (v_card.etiquetas) then
      raise exception 'O card já tem a etiqueta "%".', v_etiqueta.nome using errcode = 'check_violation';
    end if;
  elsif not (v_etiqueta.id = any (v_card.etiquetas)) then
    raise exception 'O card não tem a etiqueta "%".', v_etiqueta.nome using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Cadastrar etiqueta (recriada POR INTEIRO a partir da migration 50): criar —
-- líder ou admin (D-125 resp. 5); alterar — admin; nome repetido recusado sem
-- ligar para maiúsculas, acentos e espaços, contando as arquivadas.
create or replace function public.plt_fn_etiqueta_salvar(p_id bigint, p_nome text, p_cor text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu   uuid := plt_privado.fn_usuario_atual();
  v_id   bigint;
  v_igual public.plt_etiquetas%rowtype;
begin
  if v_eu is null then
    raise exception 'Entre na plataforma para cadastrar etiquetas.' using errcode = 'insufficient_privilege';
  end if;
  if p_id is null and not (plt_privado.fn_eh_admin() or plt_privado.fn_eh_lider_de_algum()) then
    raise exception 'Etiqueta nova é criada pelo líder ou pelo admin.' using errcode = 'insufficient_privilege';
  end if;
  if p_id is not null and not plt_privado.fn_eh_admin() then
    raise exception 'Alterar uma etiqueta é do admin.' using errcode = 'insufficient_privilege';
  end if;
  if char_length(btrim(coalesce(p_nome, ''))) = 0 then
    raise exception 'Diga o nome da etiqueta.' using errcode = 'check_violation';
  end if;
  select * into v_igual from public.plt_etiquetas e
   where plt_privado.fn_nome_comparavel(e.nome) = plt_privado.fn_nome_comparavel(p_nome)
     and e.id is distinct from p_id
   limit 1;
  if found then
    raise exception 'Já existe a etiqueta "%"%.', v_igual.nome,
      case when v_igual.arquivada_em is not null then ' (arquivada — reative em Utilitários)' else '' end
      using errcode = 'unique_violation';
  end if;
  if p_id is null then
    insert into public.plt_etiquetas (nome, cor, criada_por) values (btrim(p_nome), p_cor, v_eu)
    returning id into v_id;
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_eu, 'etiqueta_criada', jsonb_build_object('etiqueta_id', v_id, 'etiqueta', btrim(p_nome), 'cor', p_cor));
  else
    update public.plt_etiquetas set nome = btrim(p_nome), cor = p_cor, atualizada_em = now()
     where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'Etiqueta não encontrada.' using errcode = 'no_data_found';
    end if;
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_eu, 'etiqueta_editada', jsonb_build_object('etiqueta_id', v_id, 'etiqueta', btrim(p_nome), 'cor', p_cor));
  end if;
  return v_id;
end;
$$;

-- Pôr / tirar etiqueta no card (porta nova — quem edita o card).
create or replace function public.plt_fn_card_etiqueta(p_card_id bigint, p_etiqueta_id bigint, p_por boolean default true)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_card  public.plt_cards%rowtype;
  v_marca text;
begin
  select * into v_card from public.plt_cards where id = p_card_id;
  if not found or v_card.arquivado_em is not null then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if not plt_privado.fn_pode_editar_card(p_card_id) then
    raise exception 'Pôr e tirar etiqueta é de quem pode editar este card.' using errcode = 'insufficient_privilege';
  end if;
  -- O mesmo toque duas vezes = um efeito só (Lei §10).
  if coalesce(p_por, true) = (p_etiqueta_id = any (v_card.etiquetas)) then
    return 'ja_estava';
  end if;
  v_marca := current_setting('plt.card_maquinaria', true);
  perform set_config('plt.card_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, dados)
    values (p_card_id, case when coalesce(p_por, true) then 'etiqueta_adicionada' else 'etiqueta_removida' end,
            v_eu, 'interface', v_card.setor_atual_id, jsonb_build_object('etiqueta_id', p_etiqueta_id));
  perform set_config('plt.card_maquinaria', coalesce(v_marca, ''), true);
  return case when coalesce(p_por, true) then 'posta' else 'tirada' end;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6 · Campos customizados valem em cards avulsos
-- ----------------------------------------------------------------------------
alter table public.plt_campos add column if not exists em_avulsos boolean not null default false;
alter table public.plt_campos drop constraint if exists plt_campos_onde_ck;
alter table public.plt_campos add constraint plt_campos_onde_ck check (em_pecas or em_pedidos or em_avulsos);
comment on column public.plt_campos.em_avulsos is 'SESSAO-31 (↩️ D-101): o campo vale também nos cards avulsos.';

drop function if exists public.plt_fn_campo_salvar(bigint, text, text, text[], boolean, boolean);
create or replace function public.plt_fn_campo_salvar(
  p_id bigint, p_nome text, p_tipo text, p_opcoes text[], p_em_pecas boolean, p_em_pedidos boolean,
  p_em_avulsos boolean default false)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_id    bigint;
  v_campo public.plt_campos%rowtype;
  v_opcoes text[];
begin
  if v_eu is null or not plt_privado.fn_eh_admin() then
    raise exception 'Campos customizados são cadastrados pelo admin.' using errcode = 'insufficient_privilege';
  end if;
  if not (coalesce(p_em_pecas, false) or coalesce(p_em_pedidos, false) or coalesce(p_em_avulsos, false)) then
    raise exception 'Diga onde o campo vale: nas peças, nos pedidos ou nos cards avulsos.' using errcode = 'check_violation';
  end if;
  -- sem repetidas e sem vazias, na ORDEM em que o admin escreveu
  select coalesce(array_agg(s.o order by s.primeira), '{}') into v_opcoes
    from (select btrim(t.o) as o, min(t.ord) as primeira
            from unnest(coalesce(p_opcoes, '{}')) with ordinality t(o, ord)
           where btrim(t.o) <> ''
           group by btrim(t.o)) s;
  if p_tipo <> 'lista' then
    v_opcoes := '{}';
  end if;
  if exists (select 1 from public.plt_campos
              where lower(btrim(nome)) = lower(btrim(p_nome)) and arquivado_em is null and id is distinct from p_id) then
    raise exception 'Já existe um campo "%".', btrim(p_nome) using errcode = 'unique_violation';
  end if;
  if p_id is null then
    insert into public.plt_campos (nome, tipo, opcoes, em_pecas, em_pedidos, em_avulsos, criado_por)
    values (btrim(p_nome), p_tipo, v_opcoes, coalesce(p_em_pecas, false), coalesce(p_em_pedidos, false),
            coalesce(p_em_avulsos, false), v_eu)
    returning id into v_id;
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_eu, 'campo_criado', jsonb_build_object('campo_id', v_id, 'campo', btrim(p_nome), 'tipo', p_tipo));
    return v_id;
  end if;

  select * into v_campo from public.plt_campos where id = p_id;
  if not found then
    raise exception 'Campo não encontrado.' using errcode = 'no_data_found';
  end if;
  if v_campo.tipo <> p_tipo and exists (select 1 from public.plt_campos_valores where campo_id = p_id) then
    raise exception 'O campo "%" já tem valores — o tipo não muda mais (crie outro campo).', v_campo.nome
      using errcode = 'check_violation';
  end if;
  if v_campo.tipo = 'lista' and p_tipo = 'lista' and exists (
       select 1 from public.plt_campos_valores
        where campo_id = p_id and not ((valor #>> '{}') = any (v_opcoes))) then
    raise exception 'Há cards/pedidos com uma opção que você tirou — mantenha a opção ou limpe esses valores antes.'
      using errcode = 'check_violation';
  end if;
  if not coalesce(p_em_pecas, false) and exists (
       select 1 from public.plt_campos_valores v join public.plt_cards c on c.id = v.card_id
        where v.campo_id = p_id and c.tipo <> 'avulso') then
    raise exception 'O campo "%" já tem valor em peças — não dá para tirar das peças.', v_campo.nome using errcode = 'check_violation';
  end if;
  if not coalesce(p_em_avulsos, false) and exists (
       select 1 from public.plt_campos_valores v join public.plt_cards c on c.id = v.card_id
        where v.campo_id = p_id and c.tipo = 'avulso') then
    raise exception 'O campo "%" já tem valor em cards avulsos — não dá para tirar dos avulsos.', v_campo.nome using errcode = 'check_violation';
  end if;
  if not coalesce(p_em_pedidos, false) and exists (select 1 from public.plt_campos_valores where campo_id = p_id and pedido_id is not null) then
    raise exception 'O campo "%" já tem valor em pedidos — não dá para tirar dos pedidos.', v_campo.nome using errcode = 'check_violation';
  end if;
  update public.plt_campos
     set nome = btrim(p_nome), tipo = p_tipo, opcoes = v_opcoes,
         em_pecas = coalesce(p_em_pecas, false), em_pedidos = coalesce(p_em_pedidos, false),
         em_avulsos = coalesce(p_em_avulsos, false), atualizado_em = now()
   where id = p_id;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_eu, 'campo_editado', jsonb_build_object('campo_id', p_id, 'campo', btrim(p_nome), 'tipo', p_tipo));
  return p_id;
end;
$$;

-- Preencher à mão (recriada POR INTEIRO a partir da migration 50): ↩️ D-101 —
-- quem edita o card preenche (D-125 resp. 7); no pedido, a logística/PCP.
create or replace function public.plt_fn_campo_definir(
  p_campo_id bigint, p_card_id bigint default null, p_pedido_id bigint default null, p_valor jsonb default null)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
begin
  if v_eu is null then
    raise exception 'Entre na plataforma para preencher campos.' using errcode = 'insufficient_privilege';
  end if;
  if not (plt_privado.fn_eh_admin()
          or (p_card_id is not null and plt_privado.fn_pode_editar_card(p_card_id))
          or (p_card_id is null and p_pedido_id is not null and plt_privado.fn_pode_ver_expedicao())) then
    raise exception 'Preencher este campo é de quem pode editar o card.' using errcode = 'insufficient_privilege';
  end if;
  return plt_privado.fn_campo_gravar(p_campo_id, p_card_id, p_pedido_id, p_valor, 'interface', v_eu);
end;
$$;

-- ----------------------------------------------------------------------------
-- 7 · O vínculo do avulso (referência — um por card)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_vinculo_valido(p_tipo text, p_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
           when p_tipo is null and p_id is null then true
           when p_tipo = 'pedido'  then exists (select 1 from public.pedidos p where p.id = p_id)
           when p_tipo = 'produto' then exists (select 1 from public.produtos pr where pr.tiny_id = p_id)
           when p_tipo = 'peca'    then exists (select 1 from public.plt_cards c where c.id = p_id and c.tipo = 'unidade')
           else false
         end;
$$;

-- O nome de gente do vínculo ("Pedido 13215", "SKU 327 · Rack", "Rack (1/2) · Pedido 13215").
create or replace function plt_privado.fn_vinculo_rotulo(p_tipo text, p_id bigint)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case p_tipo
           when 'pedido' then (select 'Pedido ' || p.numero from public.pedidos p where p.id = p_id)
           when 'produto' then (select coalesce('SKU ' || nullif(btrim(pr.codigo), '') || ' · ', '') || coalesce(pr.descricao, 'Produto')
                                  from public.produtos pr where pr.tiny_id = p_id)
           when 'peca' then (select coalesce(c.item_descricao, 'Peça')
                                    || coalesce(' (' || c.indice_unidade || '/' || c.total_unidades || ')', '')
                                    || coalesce(' · Pedido ' || p.numero, '')
                               from public.plt_cards c left join public.pedidos p on p.id = c.pedido_id
                              where c.id = p_id)
         end;
$$;

-- ----------------------------------------------------------------------------
-- 8 · As portas do avulso
-- ----------------------------------------------------------------------------
-- Lançar para a produção (o avulso cai na fila do setor — a mesma regra da liberação).
create or replace function plt_privado.fn_avulso_lancar(p_card_id bigint, p_setor_id bigint, p_usuario uuid)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card   public.plt_cards%rowtype;
  v_evento bigint;
begin
  select * into v_card from public.plt_cards where id = p_card_id for update;
  if not found or v_card.tipo <> 'avulso' or v_card.arquivado_em is not null then
    raise exception 'Card avulso % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if not exists (select 1 from public.plt_setores s where s.id = v_card.setor_atual_id and s.papel_no_fluxo = 'entrada') then
    raise exception 'Este card já foi lançado para a produção.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.plt_setores s where s.id = p_setor_id and s.ativo and s.papel_no_fluxo = 'producao') then
    raise exception 'Escolha um setor de produção para lançar o card.' using errcode = 'check_violation';
  end if;
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, setor_destino_id, observacao)
    values (p_card_id, 'movimentacao_setor', p_usuario, 'interface', v_card.setor_atual_id, v_card.etapa_atual_id,
            p_setor_id, 'Card avulso lançado para a produção.')
    returning id into v_evento;
  return v_evento;
end;
$$;

create or replace function public.plt_fn_avulso_criar(
  p_titulo        text,
  p_descricao     text    default null,
  p_inicio        date    default null,
  p_vence         date    default null,
  p_responsaveis  uuid[]  default null,
  p_etiquetas     bigint[] default null,
  p_vinculo_tipo  text    default null,
  p_vinculo_id    bigint  default null,
  p_setor_id      bigint  default null,
  p_chave         uuid    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu      uuid := plt_privado.fn_usuario_atual();
  v_pcp     bigint;
  v_card    bigint;
  v_marca   text;
  v_nome    text;
  v_r       uuid;
  v_e       bigint;
  v_titulo  text := btrim(coalesce(p_titulo, ''));
begin
  if not plt_privado.fn_pode_criar_avulso() then
    raise exception 'Card avulso é criado pelo PCP/logística, pelos líderes e pelo admin.' using errcode = 'insufficient_privilege';
  end if;
  -- Lei §10: o mesmo toque (clique duplo, rede que volta) = o card já criado.
  if p_chave is not null then
    select c.id into v_card from public.plt_cards c where c.chave_criacao = p_chave;
    if v_card is not null then
      return jsonb_build_object('card_id', v_card, 'repetido', true);
    end if;
  end if;
  if char_length(v_titulo) = 0 then
    raise exception 'Dê um nome ao card.' using errcode = 'check_violation';
  end if;
  if char_length(v_titulo) > 200 then
    raise exception 'O nome do card tem no máximo 200 letras.' using errcode = 'check_violation';
  end if;
  if char_length(coalesce(p_descricao, '')) > 5000 then
    raise exception 'A descrição tem no máximo 5.000 letras.' using errcode = 'check_violation';
  end if;
  if p_inicio is not null and p_vence is not null and p_inicio > p_vence then
    raise exception 'O início vem antes do vencimento.' using errcode = 'check_violation';
  end if;
  if (p_vinculo_tipo is null) <> (p_vinculo_id is null) or not plt_privado.fn_vinculo_valido(p_vinculo_tipo, p_vinculo_id) then
    raise exception 'O vínculo escolhido não existe — escolha de novo (ou deixe sem vínculo).' using errcode = 'check_violation';
  end if;
  if coalesce(array_length(p_responsaveis, 1), 0) > 10 then
    raise exception 'No máximo 10 responsáveis por card.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from unnest(coalesce(p_responsaveis, '{}'::uuid[])) x
              where not exists (select 1 from public.plt_usuarios u where u.id = x and u.ativo)) then
    raise exception 'Algum responsável escolhido não está ativo na plataforma.' using errcode = 'check_violation';
  end if;
  select s.id into v_pcp from public.plt_setores s where s.papel_no_fluxo = 'entrada' and s.ativo order by s.ordem, s.id limit 1;
  if v_pcp is null then
    raise exception 'O PCP não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  insert into public.plt_cards (tipo, titulo, descricao, inicio_em, vence_em, vinculo_tipo, vinculo_id, chave_criacao)
    values ('avulso', v_titulo, nullif(btrim(coalesce(p_descricao, '')), ''), p_inicio, p_vence,
            p_vinculo_tipo, p_vinculo_id, p_chave)
    returning id into v_card;
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id, observacao, dados)
    values (v_card, 'card_criado', v_eu, 'interface', v_pcp, 'Card avulso criado no Lançamento manual.',
            jsonb_build_object('avulso', true, 'titulo', v_titulo,
                               'vinculo', case when p_vinculo_tipo is null then null
                                               else jsonb_build_object('tipo', p_vinculo_tipo, 'id', p_vinculo_id) end));

  v_marca := current_setting('plt.card_maquinaria', true);
  perform set_config('plt.card_maquinaria', 'on', true);
  select u.nome into v_nome from public.plt_usuarios u where u.id = v_eu;
  foreach v_r in array coalesce((select array_agg(distinct x) from unnest(coalesce(p_responsaveis, '{}'::uuid[])) x), '{}'::uuid[]) loop
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, dados)
      values (v_card, 'responsavel_adicionado', v_eu, 'interface', v_pcp, jsonb_build_object('responsavel_id', v_r));
    if v_r <> v_eu then
      insert into public.plt_notificacoes (destinatario_id, card_id, tipo, titulo, corpo)
        values (v_r, v_card, 'card_responsavel', 'Você é responsável pelo card "' || left(v_titulo, 80) || '"',
                coalesce(v_nome, 'Alguém') || ' pôs você como responsável por este card.');
    end if;
  end loop;
  foreach v_e in array coalesce((select array_agg(distinct x) from unnest(coalesce(p_etiquetas, '{}'::bigint[])) x), '{}'::bigint[]) loop
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, dados)
      values (v_card, 'etiqueta_adicionada', v_eu, 'interface', v_pcp, jsonb_build_object('etiqueta_id', v_e));
  end loop;
  perform set_config('plt.card_maquinaria', coalesce(v_marca, ''), true);

  if p_setor_id is not null then
    perform plt_privado.fn_avulso_lancar(v_card, p_setor_id, v_eu);
  end if;
  return jsonb_build_object('card_id', v_card, 'repetido', false);
end;
$$;

comment on function public.plt_fn_avulso_criar(text, text, date, date, uuid[], bigint[], text, bigint, bigint, uuid) is
  'SESSAO-31 (D-125): cria o card avulso no PCP (Lançamento manual) — só o nome é obrigatório; responsáveis (avisados no sino), datas, etiquetas, vínculo opcional (pedido | produto | peça) e, com p_setor_id, já lança para a produção. p_chave = o mesmo toque devolve o mesmo card.';

create or replace function public.plt_fn_avulso_lancar(p_card_id bigint, p_setor_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not (plt_privado.fn_pode_editar_card(p_card_id) or plt_privado.fn_pode_ver_expedicao()) then
    raise exception 'Lançar o card avulso é de quem pode editá-lo ou do PCP.' using errcode = 'insufficient_privilege';
  end if;
  return plt_privado.fn_avulso_lancar(p_card_id, p_setor_id, plt_privado.fn_usuario_atual());
end;
$$;

-- Concluir: o avulso termina em qualquer setor (D-125 resp. 2) — fecha o tempo
-- aberto, registra o fato e sai dos quadros (vai para "Concluídos").
create or replace function plt_privado.fn_avulso_concluir(p_card_id bigint, p_usuario uuid, p_observacao text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_marca_a text;
  v_marca_e text;
begin
  select * into v_card from public.plt_cards where id = p_card_id for update;
  if not found or v_card.tipo <> 'avulso' then
    raise exception 'Só o card avulso se conclui pelo Concluir.' using errcode = 'check_violation';
  end if;
  if v_card.arquivado_em is not null then
    if v_card.concluido_em is not null then
      return jsonb_build_object('acao', 'concluido', 'destino', 'concluidos', 'repetido', true);
    end if;
    raise exception 'Este card foi arquivado.' using errcode = 'check_violation';
  end if;
  if v_card.executor_atual_id is not null then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao)
      values (p_card_id, 'execucao_finalizada', p_usuario, 'interface', 'Card avulso concluído.');
  end if;
  v_marca_a := current_setting('plt.avulso_maquinaria', true);
  v_marca_e := current_setting('plt.entrega_maquinaria', true);
  perform set_config('plt.avulso_maquinaria', 'on', true);
  perform set_config('plt.entrega_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, observacao)
    values (p_card_id, 'avulso_concluido', p_usuario, 'interface', v_card.setor_atual_id, v_card.etapa_atual_id,
            nullif(btrim(coalesce(p_observacao, '')), ''));
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (p_card_id, 'card_arquivado', p_usuario, 'interface', 'Card avulso concluído — foi para Concluídos.',
            jsonb_build_object('motivo', 'concluido'));
  perform set_config('plt.avulso_maquinaria', coalesce(v_marca_a, ''), true);
  perform set_config('plt.entrega_maquinaria', coalesce(v_marca_e, ''), true);
  return jsonb_build_object('acao', 'concluido', 'destino', 'concluidos');
end;
$$;

create or replace function public.plt_fn_avulso_concluir(
  p_card_id bigint, p_observacao text default null, p_operador_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_usuario uuid;
begin
  select * into v_card from public.plt_cards where id = p_card_id;
  if not found then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  -- Quem edita o card conclui de onde estiver; quem trabalha no setor também
  -- (no tablet, com o PIN — p_operador_id).
  if p_operador_id is null and plt_privado.fn_pode_editar_card(p_card_id) then
    v_usuario := plt_privado.fn_usuario_atual();
  else
    v_usuario := plt_privado.fn_autor_do_gesto(v_card.setor_atual_id, p_operador_id);
  end if;
  return plt_privado.fn_avulso_concluir(p_card_id, v_usuario, p_observacao);
end;
$$;

comment on function public.plt_fn_avulso_concluir(bigint, text, uuid) is
  'SESSAO-31 (D-125 resp. 2): o "Concluir" do card avulso, em qualquer setor — fecha o tempo aberto (execução finalizada por quem concluiu), registra avulso_concluido e tira o card dos quadros (vai para Concluídos). O mesmo toque duas vezes = um efeito só.';

-- Editar as propriedades (descrição, datas; no avulso também nome e vínculo).
create or replace function public.plt_fn_card_editar(p_card_id bigint, p_mudancas jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_card  public.plt_cards%rowtype;
  v_m     jsonb := coalesce(p_mudancas, '{}'::jsonb);
  v_dif   jsonb := '{}'::jsonb;
  v_txt   text;
  v_data  date;
  v_ini   date;
  v_ven   date;
  v_vt    text;
  v_vi    bigint;
  v_marca text;
begin
  select * into v_card from public.plt_cards where id = p_card_id;
  if not found or v_card.arquivado_em is not null then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if not plt_privado.fn_pode_editar_card(p_card_id) then
    raise exception 'Editar este card é de quem pode editá-lo.' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from jsonb_object_keys(v_m) k where k not in ('titulo', 'descricao', 'inicio_em', 'vence_em', 'vinculo')) then
    raise exception 'Só nome, descrição, datas e vínculo se editam por aqui.' using errcode = 'check_violation';
  end if;
  if (v_m ? 'titulo' or v_m ? 'vinculo') and v_card.tipo <> 'avulso' then
    raise exception 'Nome e vínculo só mudam no card avulso.' using errcode = 'check_violation';
  end if;

  if v_m ? 'titulo' then
    v_txt := btrim(coalesce(v_m ->> 'titulo', ''));
    if char_length(v_txt) = 0 or char_length(v_txt) > 200 then
      raise exception 'O nome do card tem de 1 a 200 letras.' using errcode = 'check_violation';
    end if;
    if v_txt is distinct from v_card.titulo then
      v_dif := v_dif || jsonb_build_object('titulo', jsonb_build_object('antes', v_card.titulo, 'depois', v_txt));
    end if;
  end if;
  if v_m ? 'descricao' then
    v_txt := nullif(btrim(coalesce(v_m ->> 'descricao', '')), '');
    if char_length(coalesce(v_txt, '')) > 5000 then
      raise exception 'A descrição tem no máximo 5.000 letras.' using errcode = 'check_violation';
    end if;
    if v_txt is distinct from v_card.descricao then
      v_dif := v_dif || jsonb_build_object('descricao', jsonb_build_object('antes', v_card.descricao, 'depois', v_txt));
    end if;
  end if;
  v_ini := case when v_m ? 'inicio_em' then nullif(v_m ->> 'inicio_em', '')::date else v_card.inicio_em end;
  v_ven := case when v_m ? 'vence_em' then nullif(v_m ->> 'vence_em', '')::date else v_card.vence_em end;
  if v_ini is not null and v_ven is not null and v_ini > v_ven then
    raise exception 'O início vem antes do vencimento.' using errcode = 'check_violation';
  end if;
  if v_ini is distinct from v_card.inicio_em then
    v_dif := v_dif || jsonb_build_object('inicio_em', jsonb_build_object('antes', v_card.inicio_em, 'depois', v_ini));
  end if;
  if v_ven is distinct from v_card.vence_em then
    v_dif := v_dif || jsonb_build_object('vence_em', jsonb_build_object('antes', v_card.vence_em, 'depois', v_ven));
  end if;
  if v_m ? 'vinculo' then
    v_vt := nullif(v_m -> 'vinculo' ->> 'tipo', '');
    v_vi := nullif(v_m -> 'vinculo' ->> 'id', '')::bigint;
    if jsonb_typeof(v_m -> 'vinculo') = 'null' then
      v_vt := null; v_vi := null;
    end if;
    if (v_vt is null) <> (v_vi is null) or not plt_privado.fn_vinculo_valido(v_vt, v_vi) then
      raise exception 'O vínculo escolhido não existe — escolha de novo.' using errcode = 'check_violation';
    end if;
    if v_vt is distinct from v_card.vinculo_tipo or v_vi is distinct from v_card.vinculo_id then
      v_dif := v_dif || jsonb_build_object('vinculo', jsonb_build_object(
                 'antes', case when v_card.vinculo_tipo is null then null
                               else jsonb_build_object('tipo', v_card.vinculo_tipo, 'id', v_card.vinculo_id) end,
                 'depois', case when v_vt is null then null else jsonb_build_object('tipo', v_vt, 'id', v_vi) end));
    end if;
  end if;

  if v_dif = '{}'::jsonb then
    return 0;                       -- nada mudou: nenhum fato (o mesmo toque de novo)
  end if;
  v_marca := current_setting('plt.card_maquinaria', true);
  perform set_config('plt.card_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, dados)
    values (p_card_id, 'card_editado', v_eu, 'interface', v_card.setor_atual_id, jsonb_build_object('mudancas', v_dif));
  perform set_config('plt.card_maquinaria', coalesce(v_marca, ''), true);
  return (select count(*)::int from jsonb_object_keys(v_dif));
end;
$$;

comment on function public.plt_fn_card_editar(bigint, jsonb) is
  'SESSAO-31 (D-125 resp. 7): edita descrição e datas de todo card (e nome e vínculo do avulso) — cada mudança é o fato card_editado com o antes e o depois; nada mudou = nenhum fato.';

-- Pôr / tirar responsável (avisa no sino quem entrou — §3 da demanda).
create or replace function public.plt_fn_card_responsavel(p_card_id bigint, p_usuario_id uuid, p_por boolean default true)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_card  public.plt_cards%rowtype;
  v_marca text;
  v_ev    bigint;
  v_nome  text;
  v_rot   text;
begin
  select * into v_card from public.plt_cards where id = p_card_id;
  if not found or v_card.arquivado_em is not null then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if not plt_privado.fn_pode_editar_card(p_card_id) then
    raise exception 'Mudar os responsáveis é de quem pode editar este card.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.plt_usuarios u where u.id = p_usuario_id and u.ativo) then
    raise exception 'Esta pessoa não está ativa na plataforma.' using errcode = 'check_violation';
  end if;
  if coalesce(p_por, true) = (p_usuario_id = any (v_card.responsaveis)) then
    return 'ja_estava';
  end if;
  if coalesce(p_por, true) and coalesce(array_length(v_card.responsaveis, 1), 0) >= 10 then
    raise exception 'No máximo 10 responsáveis por card.' using errcode = 'check_violation';
  end if;
  v_marca := current_setting('plt.card_maquinaria', true);
  perform set_config('plt.card_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, dados)
    values (p_card_id, case when coalesce(p_por, true) then 'responsavel_adicionado' else 'responsavel_removido' end,
            v_eu, 'interface', v_card.setor_atual_id, jsonb_build_object('responsavel_id', p_usuario_id))
    returning id into v_ev;
  perform set_config('plt.card_maquinaria', coalesce(v_marca, ''), true);
  if coalesce(p_por, true) and p_usuario_id <> v_eu then
    select u.nome into v_nome from public.plt_usuarios u where u.id = v_eu;
    v_rot := plt_privado.fn_card_rotulo(p_card_id);
    insert into public.plt_notificacoes (destinatario_id, evento_id, card_id, tipo, titulo, corpo)
      values (p_usuario_id, v_ev, p_card_id, 'card_responsavel', 'Você é responsável pelo card "' || left(v_rot, 80) || '"',
              coalesce(v_nome, 'Alguém') || ' pôs você como responsável por este card.');
  end if;
  return case when coalesce(p_por, true) then 'posto' else 'tirado' end;
end;
$$;

-- O nome de gente de qualquer card (o avulso pelo título; a peça pelo produto e pedido).
create or replace function plt_privado.fn_card_rotulo(p_card_id bigint)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
           when c.tipo = 'avulso' then c.titulo
           when c.tipo = 'pedido' then 'Pedido ' || coalesce(p.numero::text, '')
           when c.tipo = 'reposicao' then 'Reposição · ' || coalesce(c.item_descricao, 'produto')
           else coalesce(c.item_descricao, 'Peça')
                || coalesce(' (' || c.indice_unidade || '/' || c.total_unidades || ')', '')
                || coalesce(' · Pedido ' || p.numero, '')
         end
    from public.plt_cards c left join public.pedidos p on p.id = c.pedido_id
   where c.id = p_card_id;
$$;

-- A aba "Lançamento manual" (D-125): A lançar · Em produção · Concluídos, por
-- cursor (o mais novo primeiro). Em produção traz também as peças em AJUSTE (D-130).
create or replace function public.plt_fn_avulsos(
  p_visao    text    default 'a_lancar',
  p_busca    text    default null,
  p_antes_id bigint  default null,
  p_limite   integer default 20
)
returns table (
  card_id        bigint,
  tipo           text,
  titulo         text,
  descricao      text,
  setor_id       bigint,
  setor_nome     text,
  etapa_nome     text,
  desde          timestamptz,
  executor_nome  text,
  pausado_em     timestamptz,
  inicio_em      date,
  vence_em       date,
  responsaveis   jsonb,
  etiquetas      bigint[],
  vinculo_tipo   text,
  vinculo_id     bigint,
  vinculo_rotulo text,
  ajuste_destino text,
  criado_em      timestamptz,
  criado_por     text,
  concluido_em   timestamptz,
  anexos_qtd     integer,
  mensagens_qtd  integer,
  tem_mais       boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with lim as (select least(greatest(coalesce(p_limite, 20), 1), 50) as n),
  ok as (select plt_privado.fn_pode_criar_avulso() as v),
  base as (
    -- Dois ramos, cada um pelo seu índice (o avulso pelo id; a peça em ajuste
    -- pela marca do ajuste) — nada de varrer os cards.
    select u.* from (
      (select c.*
         from public.plt_cards c
         left join public.plt_setores s on s.id = c.setor_atual_id
        where (select v from ok)
          and c.tipo = 'avulso'
          and (p_antes_id is null or c.id < p_antes_id)
          and (p_busca is null or char_length(btrim(p_busca)) < 2 or c.titulo ilike '%' || btrim(p_busca) || '%')
          and case coalesce(p_visao, 'a_lancar')
                when 'a_lancar' then c.arquivado_em is null and s.papel_no_fluxo = 'entrada'
                when 'em_producao' then c.arquivado_em is null and s.papel_no_fluxo = 'producao'
                when 'concluidos' then c.concluido_em is not null and c.arquivado_em is not null
                else false
              end
        order by c.id desc
        limit (select n + 1 from lim))
      union all
      (select c.*
         from public.plt_cards c
        where (select v from ok)
          and coalesce(p_visao, 'a_lancar') = 'em_producao'
          and c.ajuste_evento_id is not null and c.ajuste_destino is not null
          and c.tipo = 'unidade' and c.arquivado_em is null
          and (p_antes_id is null or c.id < p_antes_id)
          and (p_busca is null or char_length(btrim(p_busca)) < 2 or c.item_descricao ilike '%' || btrim(p_busca) || '%')
        order by c.id desc
        limit (select n + 1 from lim))
    ) u
    order by u.id desc
    limit (select n + 1 from lim)
  ),
  pagina as (
    select b.*, row_number() over (order by b.id desc) as rn from base b
  )
  select p.id, p.tipo,
         coalesce(p.titulo, coalesce(p.item_descricao, 'Peça')
                            || coalesce(' (' || p.indice_unidade || '/' || p.total_unidades || ')', '')),
         p.descricao, p.setor_atual_id, s.nome, e.nome, p.desde,
         ue.nome, p.pausado_em, p.inicio_em, p.vence_em,
         coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome, 'foto', u.foto_caminho) order by u.nome)
                     from public.plt_usuarios u where u.id = any (p.responsaveis)), '[]'::jsonb),
         p.etiquetas,
         case when p.tipo = 'unidade' then 'peca' else p.vinculo_tipo end,
         case when p.tipo = 'unidade' then p.id else p.vinculo_id end,
         case when p.tipo = 'unidade' then plt_privado.fn_vinculo_rotulo('peca', p.id)
              else plt_privado.fn_vinculo_rotulo(p.vinculo_tipo, p.vinculo_id) end,
         p.ajuste_destino, p.criado_em, uc.nome, p.concluido_em, p.anexos_qtd, p.mensagens_qtd,
         (select count(*) from base) > (select n from lim)
    from pagina p
    left join public.plt_setores s on s.id = p.setor_atual_id
    left join public.plt_etapas e on e.id = p.etapa_atual_id
    left join public.plt_usuarios ue on ue.id = p.executor_atual_id
    left join public.plt_usuarios uc on uc.id = p.criado_por_id
   where p.rn <= (select n from lim)
   order by p.id desc;
$$;

comment on function public.plt_fn_avulsos(text, text, bigint, integer) is
  'SESSAO-31 (D-125/D-130): a aba Lançamento manual do PCP — a_lancar (no PCP), em_producao (nos setores, + as peças em ajuste), concluidos. Por cursor (id), 20 por página (teto 50); tem_mais diz se há página seguinte.';

-- A busca do vínculo (e da peça do ajuste — D-130): no servidor, 10 por vez,
-- a partir de 2 letras (regra 17). Peça para ajuste = em decisão pós
-- devolução, no ESTOQUE, em Pedidos em aguardo ou já entregue, e sem ajuste aberto.
create or replace function public.plt_fn_vinculo_buscar(
  p_tipo        text,
  p_busca       text,
  p_para_ajuste boolean default false,
  p_limite      integer default 10
)
returns table (id bigint, rotulo text, detalhe text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with b as (select btrim(coalesce(p_busca, '')) as t, least(greatest(coalesce(p_limite, 10), 1), 20) as n),
  ok as (select plt_privado.fn_pode_criar_avulso() and char_length((select t from b)) >= 2 as v)
  select x.id, x.rotulo, x.detalhe from (
    select p.id, 'Pedido ' || p.numero as rotulo, coalesce(cl.nome, '') as detalhe, p.numero::bigint as ordem
      from public.pedidos p left join public.clientes cl on cl.id = p.cliente_id
     where p_tipo = 'pedido' and (select v from ok)
       and (p.numero::text like (select t from b) || '%' or cl.nome ilike '%' || (select t from b) || '%')
     order by p.numero desc
     limit (select n from b)
  ) x where p_tipo = 'pedido'
  union all
  select y.id, y.rotulo, y.detalhe from (
    select pr.tiny_id as id, coalesce('SKU ' || nullif(btrim(pr.codigo), '') || ' · ', '') || coalesce(pr.descricao, 'Produto') as rotulo,
           coalesce(pr.unidade, '') as detalhe
      from public.produtos pr
     where p_tipo = 'produto' and (select v from ok) and pr.situacao = 'A'
       and (pr.codigo ilike (select t from b) || '%' or pr.descricao ilike '%' || (select t from b) || '%')
     order by pr.descricao
     limit (select n from b)
  ) y where p_tipo = 'produto'
  union all
  select z.id, z.rotulo, z.detalhe from (
    select c.id, plt_privado.fn_vinculo_rotulo('peca', c.id) as rotulo,
           case when c.arquivado_em is not null then 'Já entregue' else coalesce(s.nome, '') end as detalhe
      from public.plt_cards c
      left join public.plt_setores s on s.id = c.setor_atual_id
      left join public.pedidos p on p.id = c.pedido_id
     where p_tipo = 'peca' and (select v from ok) and c.tipo = 'unidade'
       and (p.numero::text like (select t from b) || '%' or c.item_codigo ilike (select t from b) || '%'
            or c.item_descricao ilike '%' || (select t from b) || '%')
       and case when coalesce(p_para_ajuste, false) then
                  c.ajuste_destino is null
                  and ((c.arquivado_em is null and s.codigo in ('devolucao', 'estoque', 'aguardo')
                        and c.reservada_pedido_id is null)
                       or (c.arquivado_em is not null
                           and (select a.dados ->> 'motivo' from public.plt_eventos a
                                 where a.card_id = c.id and a.tipo = 'card_arquivado' order by a.id desc limit 1) = 'entregue'))
                else c.arquivado_em is null end
     order by c.id desc
     limit (select n from b)
  ) z where p_tipo = 'peca';
$$;

comment on function public.plt_fn_vinculo_buscar(text, text, boolean, integer) is
  'SESSAO-31 (D-125/D-130): busca do vínculo do card avulso — pedido (número ou cliente), produto (SKU ou nome), peça do quadro — e, com p_para_ajuste, a peça que pode ir para ajuste. 10 por vez, a partir de 2 letras.';

-- ----------------------------------------------------------------------------
-- 9 · Soltar o card (recriada POR INTEIRO a partir da migration 66): o avulso
--     inicia o tempo na etapa de início como a peça, e a etapa que conclui
--     conclui o avulso (= o botão Concluir)
-- ----------------------------------------------------------------------------
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
  v_destino  text;
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

  -- 1b) Etapa que CONCLUI (D-127): a peça vai para Pedidos em aguardo ou para
  --     o ESTOQUE; o card avulso (D-125) conclui — vai para Concluídos.
  if v_etapa.conclui_producao and v_card.tipo = 'unidade' then
    v_destino := public.plt_fn_concluir_producao(p_card_id, p_estado_qualidade,
                                                 p_observacao, p_operador_id);
    return jsonb_build_object('acao', 'concluido', 'destino', v_destino);
  end if;
  if v_etapa.conclui_producao and v_card.tipo = 'avulso' then
    v_usuario := plt_privado.fn_autor_do_gesto(v_card.setor_atual_id, p_operador_id);
    return plt_privado.fn_avulso_concluir(p_card_id, v_usuario, p_observacao);
  end if;

  -- 2) Etapa de início de setor de produção: soltar aqui inicia o tempo (a
  --    peça e o card avulso — D-125).
  select s.papel_no_fluxo = 'producao' into v_producao
    from public.plt_setores s where s.id = v_card.setor_atual_id;
  if coalesce(v_producao, false) and v_card.tipo in ('unidade', 'avulso')
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
  'SESSAO-24/31 — o quadro por arrasto: soltar na etapa que encaminha leva o card ao setor dela (com a marcação quando o setor pede — D-126); soltar na etapa que conclui (D-127) conclui a produção da peça — ou conclui o card avulso (D-125); soltar na etapa de início inicia o tempo de quem arrastou (peça e avulso); o resto é mover. p_operador_id = operador do PIN no tablet. Endpoint de propósito — gate interno.';

-- ----------------------------------------------------------------------------
-- 10 · O avulso fora de "peças" (D-125): tempos por item (recriada POR
--      INTEIRO a partir da migration 29)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_tempos_item(
  p_de  timestamptz,
  p_ate timestamptz
)
returns table (
  item_codigo    text,
  item_descricao text,
  execucoes      integer,
  unidades       integer,
  tempo_util     interval,
  media_por_unidade interval
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.item_codigo,
         max(c.item_descricao)                 as item_descricao,
         count(*)::int                         as execucoes,
         count(distinct v.card_id)::int        as unidades,
         sum(plt_privado.fn_tempo_util(cl.ini, cl.fim, v.setor_id, v.usuario_inicio_id) - pz.util)
                                               as tempo_util,
         sum(plt_privado.fn_tempo_util(cl.ini, cl.fim, v.setor_id, v.usuario_inicio_id) - pz.util)
           / greatest(count(distinct v.card_id), 1) as media_por_unidade
    from public.plt_vw_execucoes v
    join public.plt_cards c on c.id = v.card_id
    cross join lateral (
      select greatest(v.iniciou_em, p_de) as ini,
             least(coalesce(v.finalizou_em, now()), p_ate) as fim
    ) cl
    cross join lateral (
      select coalesce(sum(plt_privado.fn_tempo_util(px.ini, px.fim, v.setor_id, v.usuario_inicio_id)), interval '0') as util
        from plt_privado.fn_pausas_execucao(v.evento_inicio_id, cl.ini, cl.fim) px
    ) pz
   where v.setor_id in (select plt_privado.fn_setores_dashboard())
     and cl.fim > cl.ini
     -- SESSAO-31 (D-125): o card avulso não é item de produto — fica nos tempos
     -- por setor e por pessoa, não aqui.
     and c.tipo <> 'avulso'
   group by c.item_codigo
   order by tempo_util desc nulls last;
$$;

-- ----------------------------------------------------------------------------
-- 11 · Gravar o campo (recriada POR INTEIRO a partir da migration 51): o
--      avulso vale com em_avulsos; o quadro do setor fica sabendo
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_campo_gravar(
  p_campo_id  bigint,
  p_card_id   bigint,
  p_pedido_id bigint,
  p_valor     jsonb,     -- null = limpar
  p_origem    text,
  p_usuario   uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campo  public.plt_campos%rowtype;
  v_card   public.plt_cards%rowtype;
  v_pedido bigint := p_pedido_id;
  v_alvo_card bigint;
  v_valor  jsonb;
  v_atual  jsonb;
begin
  select * into v_campo from public.plt_campos where id = p_campo_id;
  if not found then
    raise exception 'Campo customizado não encontrado.' using errcode = 'no_data_found';
  end if;
  if v_campo.arquivado_em is not null and p_valor is not null then
    raise exception 'O campo "%" está arquivado.', v_campo.nome using errcode = 'check_violation';
  end if;

  if p_card_id is not null then
    select * into v_card from public.plt_cards where id = p_card_id;
    if not found then
      raise exception 'Card não encontrado.' using errcode = 'no_data_found';
    end if;
    if v_card.tipo = 'pedido' then
      v_pedido := v_card.pedido_id;          -- card do pedido = o pedido
    else
      v_alvo_card := v_card.id;              -- peça (ou reposição)
    end if;
  end if;

  -- SESSAO-31 (↩️ D-101): o card avulso usa em_avulsos; as peças, em_pecas.
  if v_alvo_card is not null and v_card.tipo = 'avulso' and not v_campo.em_avulsos then
    raise exception 'O campo "%" não vale nos cards avulsos.', v_campo.nome using errcode = 'check_violation';
  end if;
  if v_alvo_card is not null and v_card.tipo <> 'avulso' and not v_campo.em_pecas then
    raise exception 'O campo "%" não vale nas peças — só nos pedidos.', v_campo.nome using errcode = 'check_violation';
  end if;
  if v_alvo_card is null and v_pedido is null then
    raise exception 'Diga em que card ou pedido gravar o campo.' using errcode = 'check_violation';
  end if;
  if v_alvo_card is null and not v_campo.em_pedidos then
    raise exception 'O campo "%" não vale nos pedidos — só nas peças.', v_campo.nome using errcode = 'check_violation';
  end if;

  if v_alvo_card is not null then
    select valor into v_atual from public.plt_campos_valores where campo_id = p_campo_id and card_id = v_alvo_card;
  else
    select valor into v_atual from public.plt_campos_valores where campo_id = p_campo_id and pedido_id = v_pedido;
  end if;

  if p_valor is null then
    if v_atual is null then
      return 'ja_estava';
    end if;
    -- quem limpa e de onde: a trilha (gatilho) lê esta marca só durante o delete
    perform set_config('plt.campo_limpo_por', coalesce(p_usuario::text, ''), true);
    perform set_config('plt.campo_limpo_origem', coalesce(p_origem, ''), true);
    if v_alvo_card is not null then
      delete from public.plt_campos_valores where campo_id = p_campo_id and card_id = v_alvo_card;
    else
      delete from public.plt_campos_valores where campo_id = p_campo_id and pedido_id = v_pedido;
    end if;
    perform set_config('plt.campo_limpo_por', '', true);
    perform set_config('plt.campo_limpo_origem', '', true);
    perform plt_privado.fn_avisar_setor(v_card.setor_atual_id);
    return 'limpo';
  end if;

  v_valor := plt_privado.fn_campo_valor_normalizado(v_campo, p_valor);
  if v_atual is not distinct from v_valor then
    return 'ja_estava';
  end if;
  if v_atual is null then
    insert into public.plt_campos_valores (campo_id, card_id, pedido_id, valor, origem, atualizado_por)
    values (p_campo_id, v_alvo_card, case when v_alvo_card is null then v_pedido end, v_valor, p_origem, p_usuario);
  elsif v_alvo_card is not null then
    update public.plt_campos_valores
       set valor = v_valor, origem = p_origem, atualizado_por = p_usuario, atualizado_em = now()
     where campo_id = p_campo_id and card_id = v_alvo_card;
  else
    update public.plt_campos_valores
       set valor = v_valor, origem = p_origem, atualizado_por = p_usuario, atualizado_em = now()
     where campo_id = p_campo_id and pedido_id = v_pedido;
  end if;
  perform plt_privado.fn_avisar_setor(v_card.setor_atual_id);
  return 'gravado';
end;
$$;

-- ----------------------------------------------------------------------------
-- 12 · Metas (recriada POR INTEIRO a partir da migration 29): a meta de
--      unidades não conta o card avulso (D-125)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_metas_painel(
  p_incluir_encerradas boolean default false,
  p_limite             integer default 20,
  p_deslocamento       integer default 0
)
returns table (
  meta_id         bigint,
  titulo          text,
  indicador       text,
  periodo         text,
  alvo            numeric,
  usuario_id      uuid,
  usuario_nome    text,
  setor_id        bigint,
  setor_nome      text,
  etapa_id        bigint,
  etapa_nome      text,
  criada_por_id   uuid,
  criada_por_nome text,
  encerrada_em    timestamptz,
  janela_inicio   timestamptz,
  janela_fim      timestamptz,
  progresso       numeric,
  contagem_total  bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with eu as (
    select plt_privado.fn_usuario_atual() as id
  ),
  visiveis as (
    select m.*
      from public.plt_metas m
     where plt_privado.fn_eh_admin()
        or m.usuario_id = (select id from eu)
        or m.setor_id in (select plt_privado.fn_setores_do_usuario())
        or m.criada_por_id = (select id from eu)
        or (m.usuario_id is not null and exists (
              select 1 from public.plt_usuario_setores us
               where us.usuario_id = m.usuario_id
                 and plt_privado.fn_eh_lider_de(us.setor_id)))
  )
  select m.id                                   as meta_id,
         m.titulo,
         m.indicador,
         m.periodo,
         m.alvo,
         m.usuario_id,
         du.nome                                as usuario_nome,
         m.setor_id,
         ds.nome                                as setor_nome,
         m.etapa_id,
         de.nome                                as etapa_nome,
         m.criada_por_id,
         cr.nome                                as criada_por_nome,
         m.encerrada_em,
         j.inicio                               as janela_inicio,
         j.fim                                  as janela_fim,
         pr.progresso,
         count(*) over ()                       as contagem_total
    from visiveis m
    left join public.plt_usuarios du on du.id = m.usuario_id
    left join public.plt_setores  ds on ds.id = m.setor_id
    left join public.plt_etapas   de on de.id = m.etapa_id
    left join public.plt_usuarios cr on cr.id = m.criada_por_id
    cross join lateral (
      select case m.periodo
               when 'diaria'  then date_trunc('day',   now() at time zone 'America/Fortaleza')
               when 'semanal' then date_trunc('week',  now() at time zone 'America/Fortaleza')
               else                date_trunc('month', now() at time zone 'America/Fortaleza')
             end as ini_local
    ) jl
    cross join lateral (
      select jl.ini_local at time zone 'America/Fortaleza' as inicio,
             (jl.ini_local + case m.periodo
                               when 'diaria'  then interval '1 day'
                               when 'semanal' then interval '7 days'
                               else                interval '1 month'
                             end) at time zone 'America/Fortaleza' as fim
    ) j
    cross join lateral (
      select case m.indicador
        -- unidades = execuções ENCERRADAS na janela; com etapa mirada (D-45),
        -- só as daquela etapa
        when 'unidades' then coalesce((
          select count(*)::numeric
            from public.plt_vw_execucoes v
           where v.finalizou_em >= j.inicio and v.finalizou_em < j.fim
             and (m.etapa_id is null or v.etapa_id = m.etapa_id)
             -- SESSAO-31 (D-125): o card avulso não é unidade produzida.
             and not exists (select 1 from public.plt_cards ca where ca.id = v.card_id and ca.tipo = 'avulso')
             and ((m.usuario_id is not null and v.usuario_inicio_id = m.usuario_id)
               or (m.setor_id   is not null and v.setor_id = m.setor_id))), 0)
        when 'tarefas' then coalesce((
          select count(*)::numeric
            from public.plt_tarefas t
           where t.situacao = 'concluida'
             and t.concluida_em >= j.inicio and t.concluida_em < j.fim
             and ((m.usuario_id is not null and t.responsavel_id = m.usuario_id)
               or (m.setor_id   is not null and t.setor_id = m.setor_id))), 0)
        else coalesce((
          -- tempo_util descontando as pausas recortadas à janela (D-48).
          select round((extract(epoch from sum(
                   plt_privado.fn_tempo_util(
                     greatest(v.iniciou_em, j.inicio),
                     least(coalesce(v.finalizou_em, now()), j.fim),
                     v.setor_id, v.usuario_inicio_id)
                   - (select coalesce(sum(plt_privado.fn_tempo_util(px.ini, px.fim, v.setor_id, v.usuario_inicio_id)), interval '0')
                        from plt_privado.fn_pausas_execucao(
                               v.evento_inicio_id,
                               greatest(v.iniciou_em, j.inicio),
                               least(coalesce(v.finalizou_em, now()), j.fim)) px)
                 )) / 3600)::numeric, 2)
            from public.plt_vw_execucoes v
           where coalesce(v.finalizou_em, now()) > j.inicio
             and v.iniciou_em < j.fim
             and ((m.usuario_id is not null and v.usuario_inicio_id = m.usuario_id)
               or (m.setor_id   is not null and v.setor_id = m.setor_id))), 0)
      end as progresso
    ) pr
   where (p_incluir_encerradas or m.encerrada_em is null)
   order by (m.encerrada_em is not null),
            case m.periodo when 'diaria' then 1 when 'semanal' then 2 else 3 end,
            m.criada_em desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

-- ----------------------------------------------------------------------------
-- 13 · Quem chama o quê
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_eh_lider_de_algum()                      from public, anon, authenticated;
revoke all on function plt_privado.fn_pode_criar_avulso()                      from public, anon, authenticated;
revoke all on function plt_privado.fn_pode_editar_card(bigint)                 from public, anon, authenticated;
revoke all on function plt_privado.fn_pode_ver_card(bigint)                    from public, anon, authenticated;
revoke all on function plt_privado.fn_participantes_do_card(bigint)            from public, anon, authenticated;
revoke all on function plt_privado.fn_projetar_card()                          from public, anon, authenticated;
revoke all on function plt_privado.fn_validar_avulso()                         from public, anon, authenticated;
revoke all on function plt_privado.fn_avisar_setor(bigint)                     from public, anon, authenticated;
revoke all on function plt_privado.fn_nome_comparavel(text)                    from public, anon, authenticated;
revoke all on function plt_privado.fn_vinculo_valido(text, bigint)             from public, anon, authenticated;
revoke all on function plt_privado.fn_vinculo_rotulo(text, bigint)             from public, anon, authenticated;
revoke all on function plt_privado.fn_avulso_lancar(bigint, bigint, uuid)      from public, anon, authenticated;
revoke all on function plt_privado.fn_avulso_concluir(bigint, uuid, text)      from public, anon, authenticated;
revoke all on function plt_privado.fn_card_rotulo(bigint)                      from public, anon, authenticated;

revoke all on function public.plt_fn_avulso_criar(text, text, date, date, uuid[], bigint[], text, bigint, bigint, uuid) from public, anon;
revoke all on function public.plt_fn_avulso_lancar(bigint, bigint)                          from public, anon;
revoke all on function public.plt_fn_avulso_concluir(bigint, text, uuid)                    from public, anon;
revoke all on function public.plt_fn_avulsos(text, text, bigint, integer)                   from public, anon;
revoke all on function public.plt_fn_vinculo_buscar(text, text, boolean, integer)           from public, anon;
revoke all on function public.plt_fn_card_editar(bigint, jsonb)                             from public, anon;
revoke all on function public.plt_fn_card_responsavel(bigint, uuid, boolean)                from public, anon;
revoke all on function public.plt_fn_card_etiqueta(bigint, bigint, boolean)                 from public, anon;
revoke all on function public.plt_fn_campo_salvar(bigint, text, text, text[], boolean, boolean, boolean) from public, anon;
grant execute on function public.plt_fn_avulso_criar(text, text, date, date, uuid[], bigint[], text, bigint, bigint, uuid) to authenticated;
grant execute on function public.plt_fn_avulso_lancar(bigint, bigint)                          to authenticated;
grant execute on function public.plt_fn_avulso_concluir(bigint, text, uuid)                    to authenticated;
grant execute on function public.plt_fn_avulsos(text, text, bigint, integer)                   to authenticated;
grant execute on function public.plt_fn_vinculo_buscar(text, text, boolean, integer)           to authenticated;
grant execute on function public.plt_fn_card_editar(bigint, jsonb)                             to authenticated;
grant execute on function public.plt_fn_card_responsavel(bigint, uuid, boolean)                to authenticated;
grant execute on function public.plt_fn_card_etiqueta(bigint, bigint, boolean)                 to authenticated;
grant execute on function public.plt_fn_campo_salvar(bigint, text, text, text[], boolean, boolean, boolean) to authenticated;
