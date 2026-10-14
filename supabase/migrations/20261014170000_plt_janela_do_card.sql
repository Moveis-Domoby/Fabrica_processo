-- ============================================================================
-- SESSAO-31 · etapa E (§3 · D-125): a JANELA DO CARD — para todo card — e os
-- ANEXOS de verdade (imagem, PDF, áudio).
--
--  1. plt_fn_card_janela(card): numa requisição, ao abrir — o card como o
--     quadro mostra, onde está (setor · etapa), quem executa e desde quando,
--     o pedido (a tela esconde no tablet — D-28), quem criou, as pessoas, os
--     campos que valem nele (com os valores), o catálogo de etiquetas e o que
--     a pessoa pode fazer (editar, nome, concluir, anexar, ver removidos).
--     Histórico e anexos só no clique (portas próprias).
--  2. Anexos (estende a base da SESSAO-30 — D-125 resp. 8): até 25 MB; áudio
--     (arquivo ou gravado no app) até 5 minutos; quem vê o card vê e anexa
--     (o entregador segue pela equipe da rota); remover é fato
--     (anexo_removido) — some para todos, o arquivo fica guardado e só o admin
--     vê (também no armário).
--  3. A linha do tempo abre para quem vê o card (participantes inclusos) e
--     deixa a conversa para a conversa do card (etapa F).
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Anexos: áudio, 25 MB, duração
-- ----------------------------------------------------------------------------
alter table public.plt_anexos add column if not exists duracao_s integer;
alter table public.plt_anexos drop constraint if exists plt_anexos_tipo_ck;
alter table public.plt_anexos add constraint plt_anexos_tipo_ck check (tipo in ('comprovante', 'foto', 'documento', 'audio'));
alter table public.plt_anexos drop constraint if exists plt_anexos_tamanho_ck;
alter table public.plt_anexos add constraint plt_anexos_tamanho_ck check (tamanho between 1 and 26214400);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plt_anexos_duracao_ck') then
    alter table public.plt_anexos add constraint plt_anexos_duracao_ck check (duracao_s is null or duracao_s between 0 and 300);
  end if;
end;
$$;
comment on column public.plt_anexos.duracao_s is 'SESSAO-31 (D-125 resp. 8): a duração do áudio em segundos (até 5 minutos).';

-- Quem anexa e vê os anexos do card: quem vê o card (D-125 resp. 6) — e a
-- equipe da rota do pedido (o entregador — SESSAO-30).
create or replace function plt_privado.fn_pode_anexar(p_card_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select plt_privado.fn_pode_ver_card(p_card_id) or plt_privado.fn_pode_mexer_entrega(p_card_id);
$$;

-- O arquivo no armário: quem vê o card lê — o REMOVIDO, só o admin.
create or replace function plt_privado.fn_pode_ler_anexo(p_caminho text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
           when exists (select 1 from public.plt_anexos a where a.caminho = p_caminho and a.removido_em is not null)
             then plt_privado.fn_eh_admin()
           else plt_privado.fn_pode_anexar(nullif(split_part(p_caminho, '/', 1), '')::bigint)
         end;
$$;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    update storage.buckets
       set file_size_limit = 26214400,
           allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
                                      'application/pdf', 'application/msword',
                                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                      'application/vnd.oasis.opendocument.text',
                                      'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac',
                                      'audio/x-m4a', 'audio/m4a', 'audio/wav', 'audio/x-wav']
     where id = 'plt-anexos';

    drop policy if exists plt_anexos_enviar on storage.objects;
    create policy plt_anexos_enviar on storage.objects
      for insert to authenticated
      with check (bucket_id = 'plt-anexos'
                  and (storage.foldername(name))[1] ~ '^[0-9]+$'
                  and (select plt_privado.fn_pode_anexar(((storage.foldername(name))[1])::bigint)));
    drop policy if exists plt_anexos_ler on storage.objects;
    create policy plt_anexos_ler on storage.objects
      for select to authenticated
      using (bucket_id = 'plt-anexos'
             and (storage.foldername(name))[1] ~ '^[0-9]+$'
             and (select plt_privado.fn_pode_ler_anexo(name)));
  end if;
end;
$$;

-- Registrar o anexo (recriada POR INTEIRO a partir da migration 60): + quem vê
-- o card; 25 MB; áudio até 5 min; o tipo pelo arquivo; o PIN do tablet.
drop function if exists public.plt_fn_anexo_registrar(bigint, text, text, text, integer, text);
create or replace function public.plt_fn_anexo_registrar(
  p_card_id      bigint,
  p_caminho      text,
  p_nome_arquivo text,
  p_mime         text,
  p_tamanho      integer,
  p_tipo         text    default null,
  p_duracao_s    integer default null,
  p_operador_id  uuid    default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_id      bigint;
  v_existe  boolean;
  v_tipo    text;
  v_setor   bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_anexar(p_card_id) then
    raise exception 'Anexar neste card é de quem vê o card (o setor, os responsáveis, a logística) — ou do entregador do caminhão.'
      using errcode = 'insufficient_privilege';
  end if;
  -- Tablet (D-06): o gesto sai no nome de quem digitou o PIN.
  if p_operador_id is not null then
    select c.setor_atual_id into v_setor from public.plt_cards c where c.id = p_card_id;
    v_usuario := plt_privado.fn_autor_do_gesto(v_setor, p_operador_id);
  end if;
  if p_caminho is null or split_part(p_caminho, '/', 1) <> p_card_id::text then
    raise exception 'O arquivo não é deste card.' using errcode = 'check_violation';
  end if;
  if coalesce(p_tamanho, 0) not between 1 and 26214400 then
    raise exception 'O arquivo tem no máximo 25 MB.' using errcode = 'check_violation';
  end if;
  v_tipo := coalesce(nullif(p_tipo, ''),
                     case when p_mime like 'image/%' then 'foto'
                          when p_mime like 'audio/%' then 'audio'
                          else 'documento' end);
  if v_tipo not in ('comprovante', 'foto', 'documento', 'audio') then
    raise exception 'Tipo de anexo desconhecido.' using errcode = 'check_violation';
  end if;
  if v_tipo = 'audio' and coalesce(p_duracao_s, 0) > 300 then
    raise exception 'O áudio tem no máximo 5 minutos.' using errcode = 'check_violation';
  end if;
  if to_regclass('storage.objects') is not null then
    -- dinâmico: onde não há armário (o teste), a consulta nem é montada
    execute 'select exists (select 1 from storage.objects o where o.bucket_id = $1 and o.name = $2)'
      into v_existe using 'plt-anexos', p_caminho;
    if not v_existe then
      raise exception 'O arquivo não chegou ao armário — envie de novo.' using errcode = 'no_data_found';
    end if;
  end if;
  insert into public.plt_anexos (card_id, tipo, caminho, nome_arquivo, mime, tamanho, enviado_por, duracao_s)
    values (p_card_id, v_tipo, p_caminho, left(coalesce(nullif(btrim(p_nome_arquivo), ''), 'arquivo'), 200),
            left(coalesce(p_mime, 'application/octet-stream'), 100), p_tamanho, v_usuario,
            case when v_tipo = 'audio' then p_duracao_s end)
  on conflict (caminho) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.plt_anexos where caminho = p_caminho;   -- o toque repetido
    return v_id;
  end if;
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (p_card_id, 'anexo_adicionado', v_usuario, 'interface',
            left(coalesce(nullif(btrim(p_nome_arquivo), ''), 'arquivo'), 200),
            jsonb_build_object('anexo_id', v_id, 'tipo', v_tipo, 'mime', p_mime, 'tamanho', p_tamanho,
                               'duracao_s', p_duracao_s));
  return v_id;
end;
$$;

-- Os anexos do card (recriada a partir da migration 60 — forma nova, drop +
-- create): quem vê o card; o admin vê também os removidos (D-125 resp. 8).
drop function if exists public.plt_fn_anexos(bigint);
drop function if exists public.plt_fn_anexos(bigint, boolean);
create function public.plt_fn_anexos(p_card_id bigint, p_com_removidos boolean default false)
returns table (id bigint, tipo text, caminho text, nome_arquivo text, mime text, tamanho integer,
               duracao_s integer, enviado_por uuid, enviado_por_nome text, enviado_em timestamptz,
               removido_em timestamptz, removido_por_nome text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.id, a.tipo, a.caminho, a.nome_arquivo, a.mime, a.tamanho, a.duracao_s,
         a.enviado_por, u.nome, a.enviado_em, a.removido_em, ur.nome
    from public.plt_anexos a
    left join public.plt_usuarios u on u.id = a.enviado_por
    left join public.plt_usuarios ur on ur.id = a.removido_por
   where plt_privado.fn_pode_anexar(p_card_id)
     and a.card_id = p_card_id
     and (a.removido_em is null or (coalesce(p_com_removidos, false) and plt_privado.fn_eh_admin()))
   order by a.enviado_em desc
   limit 100;
$$;

-- Tirar o anexo (porta nova): quem enviou, quem edita o card, o admin. O
-- arquivo fica guardado — só o admin o vê depois (D-125 resp. 8).
create or replace function public.plt_fn_anexo_remover(p_anexo_id bigint, p_operador_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_anexo public.plt_anexos%rowtype;
  v_setor bigint;
begin
  select * into v_anexo from public.plt_anexos where id = p_anexo_id for update;
  if not found then
    raise exception 'Anexo não encontrado.' using errcode = 'no_data_found';
  end if;
  if v_anexo.removido_em is not null then
    return 'ja_estava';
  end if;
  if p_operador_id is not null then
    select c.setor_atual_id into v_setor from public.plt_cards c where c.id = v_anexo.card_id;
    v_eu := plt_privado.fn_autor_do_gesto(v_setor, p_operador_id);
  end if;
  if v_eu is null or not (v_anexo.enviado_por = v_eu or plt_privado.fn_pode_editar_card(v_anexo.card_id)
                          or plt_privado.fn_eh_admin()) then
    raise exception 'Tirar o anexo é de quem enviou, de quem edita o card ou do admin.' using errcode = 'insufficient_privilege';
  end if;
  update public.plt_anexos set removido_em = now(), removido_por = v_eu where id = p_anexo_id;
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_anexo.card_id, 'anexo_removido', v_eu, 'interface', v_anexo.nome_arquivo,
            jsonb_build_object('anexo_id', p_anexo_id, 'tipo', v_anexo.tipo));
  return 'tirado';
end;
$$;

-- ----------------------------------------------------------------------------
-- 2 · A janela do card numa requisição (Lei §2/§3)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_card_janela(p_card_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_editar  boolean;
  v_pessoas uuid[];
begin
  select * into v_card from public.plt_cards where id = p_card_id;
  if not found then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if not plt_privado.fn_pode_anexar(p_card_id) then
    raise exception 'Você não vê este card.' using errcode = 'insufficient_privilege';
  end if;
  v_editar := plt_privado.fn_pode_editar_card(p_card_id);
  v_pessoas := array_remove(v_card.responsaveis || v_card.criado_por_id || v_card.executor_atual_id, null);

  return jsonb_build_object(
    'card', plt_privado.fn_quadro_cards(array[p_card_id]) -> 0,
    'arquivado_em', v_card.arquivado_em,
    'criado_em', v_card.criado_em,
    'setor', (select jsonb_build_object('id', s.id, 'nome', s.nome, 'codigo', s.codigo, 'papel_no_fluxo', s.papel_no_fluxo)
                from public.plt_setores s where s.id = v_card.setor_atual_id),
    'etapa', (select jsonb_build_object('id', e.id, 'nome', e.nome, 'eh_fila', e.eh_fila)
                from public.plt_etapas e where e.id = v_card.etapa_atual_id),
    'execucao', (select jsonb_build_object('usuario_id', v.usuario_inicio_id, 'iniciou_em', v.iniciou_em)
                   from public.plt_vw_execucoes v where v.card_id = p_card_id and v.em_andamento
                  order by v.iniciou_em desc limit 1),
    'pessoas', coalesce((select jsonb_object_agg(u.id, jsonb_build_object('nome', u.nome, 'foto', u.foto_caminho))
                           from public.plt_usuarios u where u.id = any (v_pessoas)), '{}'::jsonb),
    'pedido', (select jsonb_build_object('pedido_id', p.id, 'numero', p.numero, 'cliente_nome', coalesce(cl.nome, ''),
                                         'situacao', p.situacao, 'data_prevista', p.data_prevista)
                 from public.pedidos p left join public.clientes cl on cl.id = p.cliente_id
                where p.id = v_card.pedido_id),
    'campos', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'tipo', f.tipo, 'opcoes', f.opcoes,
                                          'em_pecas', f.em_pecas, 'em_pedidos', f.em_pedidos, 'em_avulsos', f.em_avulsos,
                                          'arquivado_em', f.arquivado_em,
                                          'valor', (select vv.valor from public.plt_campos_valores vv
                                                     where vv.campo_id = f.id
                                                       and ((v_card.tipo = 'pedido' and vv.pedido_id = v_card.pedido_id)
                                                            or (v_card.tipo <> 'pedido' and vv.card_id = v_card.id))))
                       order by f.nome)
        from public.plt_campos f
       where f.arquivado_em is null
         and case v_card.tipo when 'avulso' then f.em_avulsos
                              when 'pedido' then f.em_pedidos
                              else f.em_pecas end), '[]'::jsonb),
    'etiquetas', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'cor', t.cor,
                                                               'arquivada_em', t.arquivada_em) order by t.nome)
                             from public.plt_etiquetas t), '[]'::jsonb),
    'permissoes', jsonb_build_object(
      'editar', v_editar and v_card.arquivado_em is null,
      'editar_nome', v_editar and v_card.tipo = 'avulso' and v_card.arquivado_em is null,
      'concluir', v_card.tipo = 'avulso' and v_card.arquivado_em is null
                  and (v_editar or v_card.setor_atual_id in (select plt_privado.fn_setores_do_usuario())
                       or plt_privado.fn_eh_admin()),
      'anexar', v_card.arquivado_em is null,
      'ver_removidos', plt_privado.fn_eh_admin())
  );
end;
$$;

comment on function public.plt_fn_card_janela(bigint) is
  'SESSAO-31 (§3 · Lei §2): a janela do card numa requisição — o card (como o quadro), setor · etapa, a execução aberta, as pessoas, o pedido, os campos que valem nele com os valores, o catálogo de etiquetas e as permissões de quem abre. Histórico e anexos só no clique.';

-- ----------------------------------------------------------------------------
-- 3 · A linha do tempo (recriada POR INTEIRO a partir da migration 14): abre
--     para quem vê o card (os participantes também); a conversa mora na
--     conversa do card (etapa F) — não entra aqui.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_linha_tempo_card(p_card_id bigint)
returns table (
  evento_id            bigint,
  tipo                 text,
  ocorrido_em          timestamptz,
  usuario_id           uuid,
  usuario_nome         text,
  setor_origem_id      bigint,
  setor_origem_nome    text,
  etapa_origem_nome    text,
  setor_destino_id     bigint,
  setor_destino_nome   text,
  etapa_destino_nome   text,
  etapa_destino_eh_fila boolean,
  estado_qualidade     text,
  observacao           text,
  origem               text,
  evento_referencia_id bigint,
  estornado            boolean,
  dados                jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.id                as evento_id,
         e.tipo,
         e.ocorrido_em,
         e.usuario_id,
         u.nome              as usuario_nome,
         e.setor_origem_id,
         so.nome             as setor_origem_nome,
         eo.nome             as etapa_origem_nome,
         e.setor_destino_id,
         sd.nome             as setor_destino_nome,
         ed.nome             as etapa_destino_nome,
         coalesce(ed.eh_fila, false) as etapa_destino_eh_fila,
         e.estado_qualidade,
         e.observacao,
         e.origem,
         e.evento_referencia_id,
         plt_privado.fn_evento_estornado(e.id) as estornado,
         e.dados
    from public.plt_eventos e
    left join public.plt_usuarios u  on u.id  = e.usuario_id
    left join public.plt_setores  so on so.id = e.setor_origem_id
    left join public.plt_etapas   eo on eo.id = e.etapa_origem_id
    left join public.plt_setores  sd on sd.id = e.setor_destino_id
    left join public.plt_etapas   ed on ed.id = e.etapa_destino_id
   where e.card_id = p_card_id
     and e.tipo not in ('comentario_adicionado', 'comentario_editado', 'comentario_apagado')
     and plt_privado.fn_pode_anexar(p_card_id)
   order by e.ocorrido_em, e.id;
$$;

comment on function public.plt_fn_linha_tempo_card(bigint) is
  'Linha do tempo completa de um card (SESSAO-05). SESSAO-31: quem vê o card (o setor, o executor, a logística, os participantes, a equipe da rota) vê a história inteira — sem as mensagens (a conversa do card tem porta própria).';

-- ----------------------------------------------------------------------------
-- 4 · Quem chama o quê
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_pode_anexar(bigint)     from public, anon;
revoke all on function plt_privado.fn_pode_ler_anexo(text)    from public, anon;
-- as regras do armário chamam como quem está logado
grant execute on function plt_privado.fn_pode_anexar(bigint)  to authenticated;
grant execute on function plt_privado.fn_pode_ler_anexo(text) to authenticated;
revoke all on function public.plt_fn_anexo_registrar(bigint, text, text, text, integer, text, integer, uuid) from public, anon;
revoke all on function public.plt_fn_anexos(bigint, boolean)               from public, anon;
revoke all on function public.plt_fn_anexo_remover(bigint, uuid)           from public, anon;
revoke all on function public.plt_fn_card_janela(bigint)                    from public, anon;
grant execute on function public.plt_fn_anexo_registrar(bigint, text, text, text, integer, text, integer, uuid) to authenticated;
grant execute on function public.plt_fn_anexos(bigint, boolean)            to authenticated;
grant execute on function public.plt_fn_anexo_remover(bigint, uuid)        to authenticated;
grant execute on function public.plt_fn_card_janela(bigint)                 to authenticated;
