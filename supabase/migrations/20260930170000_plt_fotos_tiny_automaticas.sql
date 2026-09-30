-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 44 — A FOTO DO TINY CHEGA SOZINHA
-- Pedido do dono em 2026-09-30 (conversa) · D-82 (↪️ D-81, D-73)
--
-- O dono: "faça essa parada aí das fotos mudarem quando mudarem no Tiny".
-- Respostas dele (30/09): a foto posta pela CÂMERA fica (o Tiny não a
-- sobrescreve); foto apagada no Tiny: a plataforma MANTÉM a última.
--
--   1. `produtos.imagem_tiny` — o link do Tiny da foto que está copiada na
--      plataforma. Nulo = a foto foi posta pela câmera (ou não há foto). É ela
--      que diz "esta foto veio do Tiny e pode ser trocada por ele".
--   2. As 144 fotos copiadas à mão em 30/09 (D-81) nascem marcadas como do
--      Tiny — reconhecidas pelo registro de histórico daquela carga.
--   3. A câmera (`plt_fn_estoque_definir_imagem`) passa a zerar imagem_tiny:
--      foto posta à mão nunca é trocada pelo Tiny.
--   4. As portas da função `fotos-tiny` (Edge Function, chave de serviço):
--      o que falta copiar, gravar a cópia, registrar a falha e conferir quem
--      chama. A regra de "falta copiar" mora num lugar só (aqui).
--   5. O relógio (pg_cron, 5 em 5 min, INTERNO): só chama a função se houver
--      foto para copiar — sem foto nova, nenhuma chamada (a lição da migration
--      43: nada rodando à toa). O endereço e o segredo moram nos webhooks de
--      saída (`plt_webhooks`, D-47), como o do fluxo do estoque.
--
-- De onde vem a foto: o `produto.obter` do Tiny (v2) traz `anexos`, e o
-- `fn_upsert_produto` já guarda o retorno inteiro em `produtos.raw` — a foto
-- principal é a 1ª. Produto novo chega em ~15 min; foto trocada num produto
-- que já existe, na varredura da madrugada (o Tiny não avisa mudança de
-- produto — nota do n8n).
--
-- Nada muda em clientes/pedidos/pedido_itens/eventos. Em `produtos`, só a
-- coluna nova (o `fn_upsert_produto` grava só a lista explícita dele).
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 0 · Pré-requisitos
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'produtos'
                    and column_name = 'imagem_caminho') then
    raise exception 'A migration 44 precisa da migration 40 (foto do produto).';
  end if;
  if to_regclass('public.plt_webhooks') is null then
    raise exception 'A migration 44 precisa dos webhooks de saída (migration 19).';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1 · De onde veio a foto
-- ----------------------------------------------------------------------------
alter table public.produtos add column if not exists imagem_tiny text;

comment on column public.produtos.imagem_tiny is
  'D-82: o link do Tiny (1º anexo do produto) da foto copiada em imagem_caminho. Nulo = foto posta pela câmera, ou sem foto. Escrito só por plt_fn_foto_tiny_definir (a cópia automática) e zerado por plt_fn_estoque_definir_imagem (a câmera vence).';

-- ----------------------------------------------------------------------------
-- 2 · As 144 fotos da carga de 30/09 (D-81) — copiadas do Tiny com o dono
--     logado, pela porta da câmera. Reconhecidas pelo histórico daquela carga
--     (03:37–03:40 UTC); a foto que for trocada depois (caminho diferente do
--     registrado) já não casa, então reaplicar não desfaz a escolha de ninguém.
-- ----------------------------------------------------------------------------
update public.produtos p
   set imagem_tiny = nullif(btrim(p.raw -> 'anexos' -> 0 ->> 'anexo'), '')
 where p.imagem_tiny is null
   and p.imagem_caminho is not null
   and exists (select 1 from public.plt_logs_atividade l
                where l.acao = 'estoque_foto_definida'
                  and l.contexto ->> 'produto_tiny_id' = p.tiny_id::text
                  and l.contexto ->> 'caminho' = p.imagem_caminho
                  and l.criado_em >= '2026-09-30 03:35:00+00'
                  and l.criado_em <  '2026-09-30 03:45:00+00');

-- ----------------------------------------------------------------------------
-- 3 · Regras num lugar só
-- ----------------------------------------------------------------------------
-- A foto principal do produto no Tiny: o 1º anexo, e só se for do armazém do
-- Tiny (a função do servidor baixa esse link — nada de endereço qualquer).
create or replace function plt_privado.fn_foto_tiny_url(p_raw jsonb)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
           when x.url ~ '^https://s3\.amazonaws\.com/tiny-anexos[a-z0-9-]*/[A-Za-z0-9/._-]+$' then x.url
         end
    from (select nullif(btrim(p_raw -> 'anexos' -> 0 ->> 'anexo'), '') as url) x;
$$;

-- A pasta do produto na biblioteca de fotos — a MESMA regra do app
-- (`pastaDoProduto` em src/tablet/api.ts e o `tiny-{id}` de enviarFotoProduto
-- em src/logistica/api.ts): mudou lá, muda aqui.
create or replace function plt_privado.fn_pasta_produto(p_codigo text, p_tiny_id bigint)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
           when coalesce(p_codigo, '') <> ''
             then 'produtos/' || regexp_replace(p_codigo, '[^a-zA-Z0-9._-]', '_', 'g')
           else 'produtos/tiny-' || p_tiny_id
         end;
$$;

-- ----------------------------------------------------------------------------
-- 4 · A câmera vence (resposta do dono): foto posta à mão zera imagem_tiny.
--     Recriada a partir da versão da migration 40 (a 42 e a 43 não a tocam).
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_estoque_definir_imagem(
  p_produto_tiny_id bigint,
  p_caminho         text      -- nulo = tira a foto do produto (o arquivo fica na biblioteca)
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_codigo  text;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma troca a foto.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Cadastrar a foto do produto é gesto da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_caminho is not null
     and (length(p_caminho) > 300 or p_caminho !~ '^produtos/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$') then
    raise exception 'Caminho de foto inválido.' using errcode = 'check_violation';
  end if;

  -- D-82: foto posta pela câmera deixa de ser "do Tiny" — o Tiny não a troca.
  update public.produtos set imagem_caminho = p_caminho, imagem_tiny = null
   where tiny_id = p_produto_tiny_id
  returning codigo into v_codigo;
  if not found then
    raise exception 'Produto não encontrado no catálogo.' using errcode = 'no_data_found';
  end if;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'estoque_foto_definida',
            jsonb_build_object('produto_tiny_id', p_produto_tiny_id, 'sku', v_codigo,
                               'caminho', p_caminho));
end;
$$;

-- ----------------------------------------------------------------------------
-- 5 · As portas da função `fotos-tiny` (só a chave de serviço)
-- ----------------------------------------------------------------------------
-- O que falta copiar: tem foto no Tiny E (não tem foto na plataforma, OU a
-- foto veio do Tiny e o Tiny trocou). Foto da câmera (imagem_tiny nulo) nunca
-- entra; foto apagada no Tiny (sem anexo) nunca entra — fica a última. Link
-- que falhou nas últimas 24 h espera o dia seguinte (não fica tentando).
create or replace function public.plt_fn_fotos_tiny_pendentes(p_limite integer default 3)
returns table (produto_tiny_id bigint, pasta text, url_tiny text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.tiny_id, plt_privado.fn_pasta_produto(p.codigo, p.tiny_id), u.url
    from public.produtos p
    cross join lateral (select plt_privado.fn_foto_tiny_url(p.raw) as url) u
   where u.url is not null
     and (p.imagem_caminho is null
          or (p.imagem_tiny is not null and p.imagem_tiny <> u.url))
     and not exists (select 1 from public.plt_logs_atividade l
                      where l.acao = 'estoque_foto_tiny_falhou'
                        and l.criado_em > now() - interval '1 day'
                        and l.contexto ->> 'produto_tiny_id' = p.tiny_id::text
                        and l.contexto ->> 'url' = u.url)
   order by (p.classe = 'F') desc, (p.situacao = 'A') desc, p.tiny_id
   limit greatest(1, least(coalesce(p_limite, 3), 20));
$$;

-- Grava a cópia. Confere de novo, com o produto travado, que ainda vale (o
-- Tiny não trocou de novo e ninguém pôs foto pela câmera no meio do caminho).
-- Devolve {gravou, atual, anterior}: `anterior` = a cópia antiga do Tiny que a
-- função apaga da biblioteca; se não gravou, a função apaga o arquivo que
-- acabou de subir (a menos que seja o atual).
create or replace function public.plt_fn_foto_tiny_definir(
  p_produto_tiny_id bigint,
  p_caminho         text,
  p_url_tiny        text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_produto  public.produtos%rowtype;
  v_url      text;
  v_anterior text;
begin
  if p_caminho is null or length(p_caminho) > 300
     or p_caminho !~ '^produtos/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$' then
    raise exception 'Caminho de foto inválido.' using errcode = 'check_violation';
  end if;

  select * into v_produto from public.produtos where tiny_id = p_produto_tiny_id for update;
  if not found then
    raise exception 'Produto não encontrado no catálogo.' using errcode = 'no_data_found';
  end if;

  v_url := plt_privado.fn_foto_tiny_url(v_produto.raw);
  if v_url is null or v_url is distinct from p_url_tiny
     or not (v_produto.imagem_caminho is null
             or (v_produto.imagem_tiny is not null and v_produto.imagem_tiny <> v_url)) then
    return jsonb_build_object('gravou', false, 'atual', v_produto.imagem_caminho);
  end if;

  v_anterior := case
                  when v_produto.imagem_tiny is not null
                   and v_produto.imagem_caminho is distinct from p_caminho
                    then v_produto.imagem_caminho
                end;

  update public.produtos
     set imagem_caminho = p_caminho, imagem_tiny = v_url
   where tiny_id = p_produto_tiny_id;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (null, 'estoque_foto_tiny',
            jsonb_build_object('produto_tiny_id', p_produto_tiny_id, 'sku', v_produto.codigo,
                               'caminho', p_caminho, 'anterior', v_produto.imagem_caminho,
                               'url', v_url));

  return jsonb_build_object('gravou', true, 'atual', p_caminho, 'anterior', v_anterior);
end;
$$;

-- A cópia falhou (o Tiny não respondeu, arquivo estranho…): fica no histórico
-- e o link espera 24 h para tentar de novo.
create or replace function public.plt_fn_foto_tiny_falhou(
  p_produto_tiny_id bigint,
  p_url_tiny        text,
  p_motivo          text
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (null, 'estoque_foto_tiny_falhou',
          jsonb_build_object('produto_tiny_id', p_produto_tiny_id, 'url', p_url_tiny,
                             'motivo', left(coalesce(p_motivo, ''), 300)));
$$;

-- Quem chama a função é o relógio do banco, com o segredo dos webhooks de
-- saída no cabeçalho. A função pergunta aqui se o segredo confere — ele
-- nunca sai do banco a não ser na própria chamada.
create or replace function public.plt_fn_fotos_tiny_conferir(p_segredo text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(p_segredo, '') <> ''
     and exists (select 1 from public.plt_webhooks w
                  where w.ativo and 'fotos_tiny' = any (w.eventos)
                    and w.segredo = p_segredo);
$$;

-- ----------------------------------------------------------------------------
-- 6 · O endereço da função e o segredo (só nascem se não existirem — o admin
--     pode desligar em `ativo` sem que a reaplicação desfaça)
-- ----------------------------------------------------------------------------
insert into public.plt_webhooks (nome, url, eventos, segredo, ativo)
select 'Supabase · cópia das fotos do Tiny',
       'https://axnzldwgwsmepukdiljx.supabase.co/functions/v1/fotos-tiny',
       array['fotos_tiny'],
       replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
       true
 where not exists (select 1 from public.plt_webhooks w where 'fotos_tiny' = any (w.eventos));

-- ----------------------------------------------------------------------------
-- 7 · O relógio: só chama a função se houver foto para copiar
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_fotos_tiny_relogio()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url       text;
  v_segredo   text;
  v_pendentes integer;
begin
  select count(*) into v_pendentes from public.plt_fn_fotos_tiny_pendentes(20);
  if v_pendentes = 0 then
    return 'nada_a_fazer';
  end if;
  select w.url, w.segredo into v_url, v_segredo
    from public.plt_webhooks w
   where w.ativo and 'fotos_tiny' = any (w.eventos)
   order by w.id limit 1;
  if v_url is null or coalesce(v_segredo, '') = '' then
    return 'sem_endereco';
  end if;
  if to_regproc('net.http_post') is null then
    return 'sem_pg_net';   -- ambiente de teste
  end if;
  perform net.http_post(
    url                  := v_url,
    body                 := jsonb_build_object('motivo', 'fotos_tiny', 'pendentes', v_pendentes, 'em', now()),
    headers              := jsonb_build_object('Content-Type', 'application/json', 'X-Segredo', v_segredo),
    timeout_milliseconds := 120000);
  return 'chamado';
end;
$$;

comment on function plt_privado.fn_fotos_tiny_relogio() is
  'D-82: o relógio das fotos do Tiny (pg_cron plt-fotos-tiny, 5 em 5 min, interno). Sem foto para copiar, não chama nada; com foto, chama a Edge Function fotos-tiny uma vez (ela copia até 3 por chamada).';

-- (dois IFs aninhados de propósito: numa condição só, o plpgsql planeja o
--  `cron.job` mesmo sem pg_cron e quebra no ambiente de teste — E-72)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'plt-fotos-tiny') then
      perform cron.schedule('plt-fotos-tiny', '*/5 * * * *', 'select plt_privado.fn_fotos_tiny_relogio()');
    end if;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8 · Permissões: maquinaria fora da API (E-11); as portas, só da chave de
--     serviço (a Edge Function)
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_foto_tiny_url(jsonb)             from public, anon, authenticated;
revoke all on function plt_privado.fn_pasta_produto(text, bigint)      from public, anon, authenticated;
revoke all on function plt_privado.fn_fotos_tiny_relogio()             from public, anon, authenticated;

revoke all on function public.plt_fn_fotos_tiny_pendentes(integer)     from public, anon, authenticated;
revoke all on function public.plt_fn_foto_tiny_definir(bigint, text, text) from public, anon, authenticated;
revoke all on function public.plt_fn_foto_tiny_falhou(bigint, text, text)  from public, anon, authenticated;
revoke all on function public.plt_fn_fotos_tiny_conferir(text)         from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.plt_fn_fotos_tiny_pendentes(integer)         to service_role;
    grant execute on function public.plt_fn_foto_tiny_definir(bigint, text, text) to service_role;
    grant execute on function public.plt_fn_foto_tiny_falhou(bigint, text, text)  to service_role;
    grant execute on function public.plt_fn_fotos_tiny_conferir(text)             to service_role;
  end if;
end;
$$;
