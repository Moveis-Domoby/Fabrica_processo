-- =============================================================================
-- MANUTENÇÃO · SESSAO-21 · 22/09/2026 — correções da conferência Tiny × plataforma
--
-- Pedido do dono na janela do cutover: conferir, pedido por pedido, o que a
-- plataforma guarda contra o Tiny (setembro/2026, 206 pedidos) e CORRIGIR o que
-- divergir — "o Tiny sempre estará mais certo que a plataforma" (autorizado na
-- conversa). Resultado da conferência: número, id do Tiny, data, valor,
-- situação e CPF/CNPJ batem nos 206. Divergências REAIS (10 pedidos, 3 causas):
--
--   A. Marcador "Devolvido" ausente em 8 pedidos cancelados — foi posto no Tiny
--      DEPOIS do último webhook, e o Tiny não notifica mudança só de marcador.
--   B. Pedido 13276: o Tiny não tem mais data prevista, o banco manteve a
--      antiga — `fn_upsert_pedido` faz coalesce (vazio nunca apaga), então nem
--      o webhook de 10/09 (cujo `raw` já veio sem previsão) limpou a coluna.
--   C. Contato 752634629 renomeado no Tiny (o nome antigo levava bairro/origem
--      depois de "/"); renomear contato não dispara webhook de pedido. Afeta o
--      cadastro (clientes 335) e o nome guardado nos pedidos 8136 e 13429.
--
-- NENHUM dado pessoal neste arquivo: o nome novo é DERIVADO do antigo (o que
-- vem antes da primeira "/") e conferido contra a impressão digital (sha256)
-- do nome que o Tiny mostra — se não bater, a transação aborta.
--
-- Efeito colateral conhecido: o gatilho plt_pedidos_reagir_atualizacao reage à
-- mudança de data_prevista (B) — se o card do 13276 tiver unidades liberadas,
-- nasce um evento `pedido_atualizado` (verdadeiro: a previsão mudou no Tiny).
-- Marcadores e nome não disparam nada (fora do v_mudou de fn_reagir_pedido).
--
-- Passos: 1) contar  2) executar (uma transação, com guardas)  3) conferir.
-- =============================================================================

-- 1) CONTAR — o esperado antes: A=8, B=1, C=1 cliente + 2 pedidos
select 'A · cancelados sem Devolvido' as item, count(*) from public.pedidos
 where numero in (13432,13390,13377,13376,13327,13304,13302,13275)
   and situacao = 'Cancelado' and not ('Devolvido' = any(marcadores))
union all
select 'B · 13276 com previsão velha', count(*) from public.pedidos
 where numero = 13276 and data_prevista = date '2026-09-11' and coalesce(raw->>'data_prevista','') = ''
union all
select 'C · cliente 335 com "/" no nome', count(*) from public.clientes
 where id = 335 and tiny_id_contato = 752634629 and nome like '%/%'
union all
select 'C · pedidos do contato com "/" no nome', count(*) from public.pedidos
 where numero in (8136,13429) and cliente_id = 335 and raw->'cliente'->>'nome' like '%/%';

-- 2) EXECUTAR
begin;

-- A · marcador "Devolvido" (objeto idêntico ao que o Tiny já mandou no 13271)
update public.pedidos
   set marcadores    = array_append(marcadores, 'Devolvido'),
       raw           = jsonb_set(raw, '{marcadores}',
                         coalesce(raw->'marcadores', '[]'::jsonb)
                         || '[{"marcador":{"id":"173691","cor":"#808080","descricao":"Devolvido"}}]'::jsonb),
       atualizado_em = now()
 where numero in (13432,13390,13377,13376,13327,13304,13302,13275)
   and situacao = 'Cancelado' and not ('Devolvido' = any(marcadores));

-- B · previsão removida no Tiny (o raw já está vazio desde 10/09)
update public.pedidos
   set data_prevista = null, atualizado_em = now()
 where numero = 13276 and data_prevista = date '2026-09-11' and coalesce(raw->>'data_prevista','') = '';

-- C · contato renomeado no Tiny
update public.clientes
   set nome          = trim(split_part(nome, '/', 1)),
       raw           = case when raw ? 'nome'
                            then jsonb_set(raw, '{nome}', to_jsonb(trim(split_part(raw->>'nome', '/', 1))))
                            else raw end,
       atualizado_em = now()
 where id = 335 and tiny_id_contato = 752634629 and nome like '%/%';

update public.pedidos
   set raw           = jsonb_set(raw, '{cliente,nome}', to_jsonb(trim(split_part(raw->'cliente'->>'nome', '/', 1)))),
       atualizado_em = now()
 where numero in (8136,13429) and cliente_id = 335 and raw->'cliente'->>'nome' like '%/%';

-- guarda: o nome derivado TEM que ser o que o Tiny mostra (sha256 da lista do Tiny, 22/09)
do $$
declare v_hash text;
begin
  select left(encode(sha256(convert_to(upper(normalize(regexp_replace(trim(nome), '\s+', ' ', 'g'), NFC)
                collate "und-x-icu"), 'UTF8')), 'hex'), 12)
    into v_hash from public.clientes where id = 335;
  if v_hash is distinct from '60b0bf78f3c2' then
    raise exception 'nome derivado não bate com o Tiny (hash %) — nada foi gravado', v_hash;
  end if;
end $$;

commit;

-- 3) CONFERIR — o esperado depois: tudo zero
select 'A · restantes' as item, count(*) from public.pedidos
 where numero in (13432,13390,13377,13376,13327,13304,13302,13275) and not ('Devolvido' = any(marcadores))
union all
select 'B · restantes', count(*) from public.pedidos where numero = 13276 and data_prevista is not null
union all
select 'C · restantes', (select count(*) from public.clientes where id = 335 and nome like '%/%')
                      + (select count(*) from public.pedidos where numero in (8136,13429) and raw->'cliente'->>'nome' like '%/%');
