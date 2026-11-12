-- ============================================================================
-- SESSAO-50 · BLOCO A — a observação do ITEM do Tiny na capa do card
-- ============================================================================
-- O dono (12/11, vídeo do pedido 13871): a observação que o vendedor escreve
-- DENTRO do produto no Tiny ("adicionar rodízios") não chegava à fábrica — o
-- montador só sabia olhando o papel. Ela vem em raw.itens[].item.info_adicional
-- e a plataforma não guardava.
--
-- Frente 1 · guardar: a tabela da base (plt_itens_observacao — pedido, posição
--   do item, texto limpo; só os itens com observação) é mantida por um gatilho
--   em `pedidos` que relê raw.itens quando os itens mudam (a mesma leitura da
--   gravação do Tiny — fn_upsert_pedido, que NÃO muda) e grava só o que mudou.
--   Blindado (D-43): erro vira aviso de automação (uma vez por hora por pedido)
--   e a gravação do Tiny segue. Mudou alguma observação → os quadros dos setores
--   onde o pedido tem peça viva, a janela aberta de cada peça e o PCP releem
--   (os canais que já existem; nenhum fato novo — a observação é dado do Tiny,
--   não um gesto no card; sem relógio). A reação da SESSAO-44 (itens novos)
--   compara produto e quantidade: só a observação nunca é "item novo" nem
--   reabre o PCP.
-- Frente 2 · onde aparece: a frente do card (fn_quadro_cards — o quadro do
--   setor, o "Ver mais", o tablet e a janela do card montam o card nela) ganha a
--   chave `observacao_item`, só quando há (E-237). Qual observação cada peça
--   mostra: a do item da VAGA que ela cobre pelo casamento da SESSAO-44
--   (fn_vagas_pedido — o mesmo produto; a posição só desempata), calculado UMA
--   vez por página e só nos pedidos que têm observação
--   (fn_observacao_das_unidades). O PCP (bloco B) lê a tabela por (pedido, seq).
-- O preenchimento dos antigos (376 itens em 325 pedidos em 12/11) é a
-- manutenção supabase/manutencao/2026-11-12_observacao_dos_itens.sql.
-- Nenhuma coluna em tabela da integração; nenhuma porta pública recriada.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · O texto limpo e a observação de cada posição do raw — donas únicas da
--     regra (o gatilho e o preenchimento dos antigos leem daqui)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_observacao_limpa(p_texto text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  -- sem espaço nas pontas; qualquer sequência de espaços, tabulações ou quebras
  -- de linha vira UM espaço; as entidades de HTML que o Tiny às vezes manda
  -- viram o caractere (a mesma limpeza do nome do cliente); vazio = sem observação
  select nullif(btrim(left(btrim(regexp_replace(plt_privado.fn_texto_sem_entidades(p_texto),
                                                '[[:space:]]+', ' ', 'g')), 2000)), '');
$$;
comment on function plt_privado.fn_observacao_limpa(text) is
  'SESSAO-50 (bloco A): o texto limpo da observação do item — sem espaço nas pontas, espaços e quebras de linha repetidos viram um, entidades de HTML decodificadas, no máximo 2.000 caracteres; vazio = nulo.';
revoke all on function plt_privado.fn_observacao_limpa(text) from public, anon, authenticated;

create or replace function plt_privado.fn_itens_observacao_do_raw(p_raw jsonb)
returns table (seq integer, texto text)
language sql
immutable
set search_path = public, pg_temp
as $$
  -- a MESMA leitura da gravação do Tiny (fn_upsert_pedido): `itens` é lista — ou
  -- objeto quando é um item só —, cada elemento é {item: {...}} ou o próprio
  -- item, e a posição na lista (a partir de 1) é a `seq` de pedido_itens
  select o.seq, o.texto
    from (select x.ordem::integer as seq,
                 plt_privado.fn_observacao_limpa(
                   coalesce(x.elemento -> 'item', x.elemento) ->> 'info_adicional') as texto
            from jsonb_array_elements(
                   case jsonb_typeof(coalesce(p_raw -> 'itens', '[]'::jsonb))
                     when 'array' then coalesce(p_raw -> 'itens', '[]'::jsonb)
                     else jsonb_build_array(p_raw -> 'itens')
                   end) with ordinality as x(elemento, ordem)
          offset 0) o   -- (offset 0: a limpeza roda uma vez por item)
   where o.texto is not null;
$$;
comment on function plt_privado.fn_itens_observacao_do_raw(jsonb) is
  'SESSAO-50 (bloco A): a observação de cada item do pedido como o Tiny mandou (raw.itens[].item.info_adicional), limpa, na posição do item (a seq de pedido_itens — a mesma numeração de fn_upsert_pedido). Só os itens com observação. Dona da regra: o gatilho do pedido e o preenchimento dos antigos leem daqui.';
revoke all on function plt_privado.fn_itens_observacao_do_raw(jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2 · O gatilho do pedido: relê raw.itens quando os itens mudam, grava só o que
--     mudou (insere, troca, apaga) e, se mudou, avisa quem mostra
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_observacao_avisar(p_pedido_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_setor bigint;
begin
  -- o quadro (e o tablet) de cada setor de produção com peça viva do pedido — o
  -- canal que eles já ouvem (fn_avisar_setor: um "mudou" por setor por transação)
  for v_setor in
    select distinct u.setor_atual_id
      from public.plt_cards u
     where u.pedido_id = p_pedido_id and u.tipo = 'unidade'
       and u.arquivado_em is null and u.setor_atual_id is not null
  loop
    perform plt_privado.fn_avisar_setor(v_setor);
  end loop;
  -- a janela aberta de cada peça viva: o canal do card (o mesmo da conversa —
  -- tópico estreito, payload mínimo); a janela relê ao ouvir 'card_mudou'
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
    perform realtime.send(jsonb_build_object('card_id', u.id), 'card_mudou', 'plt-card:' || u.id, true)
       from public.plt_cards u
      where u.pedido_id = p_pedido_id and u.tipo = 'unidade' and u.arquivado_em is null;
  end if;
  -- o PCP (a linha do item e a janela de liberar mostram a observação — bloco B)
  if exists (select 1 from public.plt_cards c
              where c.pedido_id = p_pedido_id and c.tipo = 'pedido' and c.arquivado_em is null) then
    perform plt_privado.fn_avisar('pcp');
  end if;
end;
$$;
comment on function plt_privado.fn_observacao_avisar(bigint) is
  'SESSAO-50 (bloco A): a observação de algum item do pedido mudou — avisa o quadro de cada setor de produção com peça viva dele (setor_N), a janela aberta de cada peça viva (card_mudou no canal do card) e o PCP. Sem fato: a observação é dado do Tiny.';
revoke all on function plt_privado.fn_observacao_avisar(bigint) from public, anon, authenticated;

create or replace function plt_privado.fn_observacao_itens_gravar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mudou integer := 0;
begin
  begin
    with novas as (
      select r.seq, r.texto from plt_privado.fn_itens_observacao_do_raw(new.raw) r
    ),
    saiu as (
      delete from public.plt_itens_observacao o
       where o.pedido_id = new.id
         and not exists (select 1 from novas n where n.seq = o.seq)
      returning 1
    ),
    gravou as (
      insert into public.plt_itens_observacao as o (pedido_id, seq, texto)
      select new.id, n.seq, n.texto from novas n
      on conflict (pedido_id, seq) do update
         set texto = excluded.texto, atualizado_em = now()
       where o.texto is distinct from excluded.texto
      returning 1
    )
    select (select count(*) from saiu) + (select count(*) from gravou) into v_mudou;

    if v_mudou > 0 then
      perform plt_privado.fn_observacao_avisar(new.id);
    end if;
  exception when others then
    -- protege a gravação do Tiny (D-43): o erro vira aviso de automação para os
    -- administradores (uma vez por hora por pedido); o card fica com a de antes
    begin
      perform plt_privado.fn_alertar_erro(
        'automacao_erro', 'observacao_itens:' || new.id,
        format('Não deu para guardar a observação dos itens do pedido %s', new.numero),
        format('O Tiny mandou o pedido %s, mas a plataforma não conseguiu guardar a observação dos itens — o card segue com a de antes: %s',
               new.numero, sqlerrm),
        jsonb_build_object('pedido', new.numero, 'pedido_id', new.id, 'erro', sqlerrm),
        interval '1 hour', null);
    exception when others then
      raise warning 'plt_observacao_itens: % — a integração segue intacta', sqlerrm;
    end;
  end;
  return null;
end;
$$;
comment on function plt_privado.fn_observacao_itens_gravar() is
  'SESSAO-50 (bloco A): gatilho de pedidos — relê raw.itens (fn_itens_observacao_do_raw) e deixa plt_itens_observacao igual a ele, gravando só o que mudou; mudou → fn_observacao_avisar. Nunca derruba a gravação do Tiny: erro vira aviso de automação (uma vez por hora por pedido).';
revoke all on function plt_privado.fn_observacao_itens_gravar() from public, anon, authenticated;

-- pedido novo com itens; pedido regravado com os itens diferentes (a observação
-- mora dentro de raw.itens — o mesmo recorte do gatilho dos itens da SESSAO-44)
drop trigger if exists plt_pedidos_observacao_itens_ins on public.pedidos;
create trigger plt_pedidos_observacao_itens_ins
  after insert on public.pedidos
  for each row
  when ((new.raw -> 'itens') is not null)
  execute function plt_privado.fn_observacao_itens_gravar();

drop trigger if exists plt_pedidos_observacao_itens_upd on public.pedidos;
create trigger plt_pedidos_observacao_itens_upd
  after update of raw on public.pedidos
  for each row
  when ((old.raw -> 'itens') is distinct from (new.raw -> 'itens'))
  execute function plt_privado.fn_observacao_itens_gravar();

-- ----------------------------------------------------------------------------
-- 3 · A regra única: a observação que cada peça mostra
-- ----------------------------------------------------------------------------
-- A peça mostra a observação do item da VAGA que ela cobre pelo casamento da
-- SESSAO-44 (fn_vagas_pedido, dona única do "esta vaga tem peça?"): o mesmo
-- produto; primeiro a mesma posição, depois a ordem. Duas estantes iguais, só
-- uma com rodízios: cada peça mostra a do seu item; o Tiny reordenou ou
-- inseriu item depois da liberação: a peça segue o produto, não a posição.
-- Peça de item que saiu do pedido (sobra), peça sem pedido e card que não é
-- peça: nada. UMA chamada por página de cards; o casamento só roda nos pedidos
-- que têm observação (a maioria não tem e não paga nada). Nunca derruba quem
-- chama: erro = a página sem observação (e um aviso no registro do banco).
create or replace function plt_privado.fn_observacao_das_unidades(p_ids bigint[])
returns table (card_id bigint, texto text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  return query
    with com_observacao as (
      -- os pedidos das peças da página que têm alguma observação
      select distinct c.pedido_id
        from public.plt_cards c
       where c.id = any (p_ids)
         and c.tipo = 'unidade'
         and c.pedido_id is not null
         and exists (select 1 from public.plt_itens_observacao x where x.pedido_id = c.pedido_id)
    )
    select w.card_id, o.texto
      from com_observacao p
      cross join lateral plt_privado.fn_vagas_pedido(p.pedido_id) w
      join public.plt_itens_observacao o on o.pedido_id = p.pedido_id and o.seq = w.seq
     where w.card_id = any (p_ids);
exception when others then
  raise warning 'plt_observacao_das_unidades: % — os cards seguem sem a observação', sqlerrm;
  return;
end;
$$;
comment on function plt_privado.fn_observacao_das_unidades(bigint[]) is
  'SESSAO-50 (bloco A): a REGRA de qual observação do Tiny cada peça mostra — a do item da vaga que ela cobre pelo casamento da SESSAO-44 (fn_vagas_pedido: o mesmo produto, a posição só desempata). Recebe a página de cards e devolve (card, texto) só das peças com observação; uma chamada por página, o casamento só nos pedidos que têm observação. Erro = nenhuma linha (nunca derruba o quadro).';
revoke all on function plt_privado.fn_observacao_das_unidades(bigint[]) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4 · A frente do card (recriada da vigente — 20261111010000_plt_sessao48_base,
--     por extração com trocas conferidas — A-97): + `observacao_item`, só
--     quando a peça tem (E-237). O quadro do setor, o "Ver mais", o tablet e a
--     janela do card leem daqui — nenhuma porta pública muda.
-- ----------------------------------------------------------------------------
-- (recriada da vigente em 20261111010000_plt_sessao48_base.sql)
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
         -- SESSAO-50 (bloco A): a observação do item do Tiny que a peça cobre — só quando há
         || case when ob.texto is null then '{}'::jsonb
                 else jsonb_build_object('observacao_item', ob.texto) end
         order by o.ord), '[]'::jsonb)
    from unnest(p_ids) with ordinality as o(id, ord)
    join public.plt_cards c on c.id = o.id
    join plt_privado.vw_card_ordem v on v.id = c.id
    -- SESSAO-50 (bloco A): a regra única da observação — UMA chamada por página
    left join plt_privado.fn_observacao_das_unidades(p_ids) ob on ob.card_id = c.id;
$$;
revoke all on function plt_privado.fn_quadro_cards(bigint[]) from public, anon, authenticated;
