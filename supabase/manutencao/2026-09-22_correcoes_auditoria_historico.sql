-- =============================================================================
-- MANUTENÇÃO · SESSAO-21 · 22/09/2026 — correções da AUDITORIA DO HISTÓRICO
-- (Tiny × plataforma, os 5.360 pedidos — continuação de
--  2026-09-22_correcoes_conferencia_tiny.sql, que cobriu setembro)
--
-- Método: impressão digital por pedido (data, previsão, valor, situação,
-- marcadores, UF, cidade, sha256 do nome e do CPF/CNPJ) dos dois lados,
-- agregada por faixa de 100 números (A-14): 50 de 55 faixas idênticas; nas 5
-- restantes, só 5 pedidos divergiram. Mais 4 pedidos com campo preso pelo
-- coalesce (achados no banco: coluna preenchida × `raw` do Tiny sem o valor).
--
-- Mesmas 3 causas de setembro (ver o arquivo irmão):
--   A. marcador "Devolvido" posto no Tiny depois do último webhook
--      → 12679, 12830
--   B. campo LIMPO no Tiny que o coalesce do fn_upsert_pedido não deixa limpar
--      → obs_interna: 13180, 13410 (o raw traz ""); vendedor: 13183, 13421
--        (o raw NEM TRAZ a chave `nome_vendedor` — conferido na tela do Tiny:
--        os dois pedidos estão sem vendedor). Lição: vazio no Tiny pode vir
--        como chave AUSENTE, não só como "".
--   C. contato renomeado no Tiny (nome antigo com bairro/origem depois de "/")
--      → pedido 8205 + cadastro 2192; pedido 9545 (o cadastro 2433 já estava
--        limpo)
--
-- NÃO corrigido (não é erro): pedido 11710 — o Tiny guarda o apóstrofo como
-- entidade HTML ("&#39;") e o banco tem o mesmo texto; só a lista do Tiny
-- decodifica na tela. Forma de envio: a lista mostra o TIPO de envio e o banco
-- guarda o nome da transportadora — dados diferentes, não comparáveis.
--
-- Efeitos colaterais conferidos no código (F-08): só a mudança de obs_interna
-- entra no v_mudou de fn_reagir_pedido — e os cards 110 (13180) e 445 (13410)
-- não têm unidades liberadas → nenhum evento nasce. Marcador, vendedor e nome
-- não disparam nada. Nenhum dado pessoal neste arquivo (nome derivado e
-- conferido contra o hash do Tiny).
-- =============================================================================

-- 1) CONTAR — esperado: A=2 · B_obs=2 · B_vend=2 · C_pedidos=2 · C_cadastro=1
select 'A' as item, count(*) from public.pedidos
 where numero in (12679,12830) and situacao = 'Cancelado' and not ('Devolvido' = any(marcadores))
union all select 'B_obs', count(*) from public.pedidos
 where numero in (13180,13410) and obs_interna is not null and coalesce(trim(raw->>'obs_interna'),'') = ''
union all select 'B_vend', count(*) from public.pedidos
 where numero in (13183,13421) and vendedor is not null and not (raw ? 'nome_vendedor')
union all select 'C_pedidos', count(*) from public.pedidos
 where numero in (8205,9545) and raw->'cliente'->>'nome' like '%/%'
union all select 'C_cadastro', count(*) from public.clientes
 where id = 2192 and tiny_id_contato = 752634865 and nome like '%/%';

-- 2) EXECUTAR (bloco atômico: aborta se contagem ou nome fugirem do esperado)
do $$
declare a int; bo int; bv int; cp int; cc int; h8205 text; h9545 text; hcad text;
begin
  update public.pedidos
     set marcadores = array_append(marcadores, 'Devolvido'),
         raw = jsonb_set(raw, '{marcadores}', coalesce(raw->'marcadores','[]'::jsonb)
               || '[{"marcador":{"id":"173691","cor":"#808080","descricao":"Devolvido"}}]'::jsonb),
         atualizado_em = now()
   where numero in (12679,12830) and situacao = 'Cancelado' and not ('Devolvido' = any(marcadores));
  get diagnostics a = row_count;

  update public.pedidos set obs_interna = null, atualizado_em = now()
   where numero in (13180,13410) and obs_interna is not null and coalesce(trim(raw->>'obs_interna'),'') = '';
  get diagnostics bo = row_count;

  update public.pedidos set vendedor = null, atualizado_em = now()
   where numero in (13183,13421) and vendedor is not null and not (raw ? 'nome_vendedor');
  get diagnostics bv = row_count;

  update public.pedidos
     set raw = jsonb_set(raw, '{cliente,nome}', to_jsonb(trim(split_part(raw->'cliente'->>'nome', '/', 1)))),
         atualizado_em = now()
   where numero in (8205,9545) and raw->'cliente'->>'nome' like '%/%';
  get diagnostics cp = row_count;

  update public.clientes
     set nome = trim(split_part(nome, '/', 1)),
         raw = case when raw ? 'nome' then jsonb_set(raw, '{nome}', to_jsonb(trim(split_part(raw->>'nome', '/', 1)))) else raw end,
         atualizado_em = now()
   where id = 2192 and tiny_id_contato = 752634865 and nome like '%/%';
  get diagnostics cc = row_count;

  select left(encode(sha256(convert_to(upper(normalize(regexp_replace(trim(raw->'cliente'->>'nome'),'\s+',' ','g'),NFC) collate "und-x-icu"),'UTF8')),'hex'),12)
    into h8205 from public.pedidos where numero = 8205;
  select left(encode(sha256(convert_to(upper(normalize(regexp_replace(trim(raw->'cliente'->>'nome'),'\s+',' ','g'),NFC) collate "und-x-icu"),'UTF8')),'hex'),12)
    into h9545 from public.pedidos where numero = 9545;
  select left(encode(sha256(convert_to(upper(normalize(regexp_replace(trim(nome),'\s+',' ','g'),NFC) collate "und-x-icu"),'UTF8')),'hex'),12)
    into hcad from public.clientes where id = 2192;

  if (a, bo, bv, cp, cc) is distinct from (2, 2, 2, 2, 1)
     or h8205 is distinct from '3b996a59131e' or h9545 is distinct from '09b040f231c2' or hcad is distinct from '3b996a59131e' then
    raise exception 'ABORTADO — contagens %/%/%/%/% ou nomes fora do esperado; nada gravado', a, bo, bv, cp, cc;
  end if;
end $$;

-- 3) CONFERIR — esperado: tudo zero
select 'restantes' as item,
  (select count(*) from public.pedidos where numero in (12679,12830) and not ('Devolvido' = any(marcadores)))
+ (select count(*) from public.pedidos where numero in (13180,13410) and obs_interna is not null)
+ (select count(*) from public.pedidos where numero in (13183,13421) and vendedor is not null)
+ (select count(*) from public.pedidos where numero in (8205,9545) and raw->'cliente'->>'nome' like '%/%')
+ (select count(*) from public.clientes where id = 2192 and nome like '%/%') as total;
