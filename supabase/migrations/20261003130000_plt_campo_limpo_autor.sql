-- ============================================================================
-- Migration 53 · Quem limpou o campo customizado aparece na Auditoria
-- (ajuste da SESSAO-27, pedido do dono, 02/10/2026)
-- ============================================================================
-- Achado na limpeza do teste: "Limpou um campo customizado" saía com autor
-- "Sistema" e com a origem do ÚLTIMO PREENCHIMENTO — na limpeza a linha do valor
-- some, e o gatilho da trilha só conhecia a linha velha. Agora fn_campo_gravar
-- marca quem limpa e de onde (só durante o delete) e o gatilho usa a marca;
-- sem marca (automação), continua "Sistema" com origem automação.
--
-- As duas funções são recriadas POR INTEIRO a partir da 51 (só as trocas acima).
-- Não toca em tabela da integração. Reaplicável.
-- ============================================================================

create or replace function plt_privado.fn_logar_campo_valor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_linha public.plt_campos_valores%rowtype;
  v_nome  text;
begin
  v_linha := case when tg_op = 'DELETE' then old else new end;
  select c.nome into v_nome from public.plt_campos c where c.id = v_linha.campo_id;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (
    -- na limpeza a linha some: quem limpou vem da marca que fn_campo_gravar põe
    -- só durante o delete (nula = automação/Sistema) — migration 53
    case when tg_op = 'DELETE' then nullif(current_setting('plt.campo_limpo_por', true), '')::uuid
         else new.atualizado_por end,
    case when tg_op = 'DELETE' then 'campo_limpo' else 'campo_preenchido' end,
    jsonb_strip_nulls(jsonb_build_object(
      'campo_id', v_linha.campo_id,
      'campo', v_nome,
      'card_id', v_linha.card_id,
      'pedido_id', v_linha.pedido_id,
      'antes', case when tg_op = 'INSERT' then null else old.valor end,
      'depois', case when tg_op = 'DELETE' then null else new.valor end,
      'origem', case when tg_op = 'DELETE'
                     then coalesce(nullif(current_setting('plt.campo_limpo_origem', true), ''), old.origem)
                     else v_linha.origem end,
      'motivo', nullif(current_setting('plt.automacao_motivo', true), '')
    ))
  );
  return null;
end;
$$;

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

  if v_alvo_card is not null and not v_campo.em_pecas then
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
  return 'gravado';
end;
$$;

revoke all on function plt_privado.fn_campo_gravar(bigint, bigint, bigint, jsonb, text, uuid) from public, anon, authenticated;
