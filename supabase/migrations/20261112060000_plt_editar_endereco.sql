-- ============================================================================
-- SESSAO-50 · BLOCO C — editar a parada avulsa e o endereço de entrega do
-- pedido. Pedido do dono (12/11): "possibilidade de editar o local de uma
-- parada avulsa ou pedido comum, pois atualmente é necessário excluir a parada
-- avulsa e criar outra"; respostas das 01:25 e 01:30: "editar endereço de
-- entrega mesmo e corrigindo no pino no mapa", "o endereço original que veio
-- do Tiny ainda continua no banco como log para recuperar caso necessário",
-- "a pergunta é se ele deseja salvar também no Tiny".
--
--   frente 6 · a parada avulsa PENDENTE se edita (título, endereço, pino,
--              observação) pela porta de sempre; o registro (D-40) guarda o
--              antes e o depois do que mudou; a feita/não feita não se edita
--              (provisória); salvar sem mudar nada não registra nada; a tela
--              sabe quem pode pela leitura das paradas (pode_editar — sem
--              requisição nova).
--   frente 7 · o endereço de entrega do pedido muda NA PLATAFORMA:
--              · o fato endereco_entrega_alterado no card do PEDIDO guarda o
--                original do Tiny inteiro (de onde veio, os campos, o
--                endereço de entrega cru e o do cadastro), o anterior, o novo,
--                o ponto, quem, quando e a escolha (só plataforma / também no
--                Tiny); "Voltar ao endereço original" = endereco_entrega_restaurado;
--              · a projeção plt_pedido_enderecos (uma linha por pedido, só dos
--                alterados — escrita SÓ pelo gatilho do fato, M-13) guarda o
--                endereço que vale;
--              · UMA regra: plt_privado.vw_endereco_entrega (mesmas colunas, na
--                mesma ordem — E-251) prefere o da plataforma; a regra do Tiny
--                (D-193) mudou-se, sem mudar uma letra, para
--                plt_privado.vw_endereco_tiny. Rotas, mapa, Entregas do dia,
--                ficha, Google Maps/Waze, calendário, candidatos e os filtros
--                de cidade/bairro passam a ler o novo sem mexer em porta;
--              · "salvar também no Tiny" fica DESLIGADO esta noite: o banco
--                recusa com o porquê (a API nova do Tiny não aceita endereço; a
--                antiga só serve ao pedido Em aberto/Aprovado e regrava o pedido
--                inteiro — falta o fluxo do n8n e o teste num pedido de teste com
--                o dono). O fato já guarda a escolha: ligar depois não muda nada
--                aqui;
--              · o Tiny mudando o endereço por fora (o de entrega no pedido, ou o
--                do cadastro quando é ele que vale) vence e avisa a logística
--                (provisória, D-132) — gatilhos blindados em pedidos e clientes
--                que nunca derrubam a gravação do Tiny; a nossa própria escrita
--                voltando do Tiny é confirmação, não mudança.
--
-- Funções que já existiam (plt_fn_paradas_avulsas, plt_fn_entregas_do_dia,
-- plt_fn_parada_avulsa_salvar, plt_fn_pcp_pedido_detalhe,
-- plt_fn_programacao_candidatos): recriadas por EXTRAÇÃO da última versão nas
-- migrations, com trocas de texto de contagem exata
-- (scratchpad/s50/c-ferramentas/gerar-c.mjs). Nenhuma assinatura muda.
-- Nada aqui altera tabela da integração: pedidos e clientes só ganham gatilhos.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A projeção: o endereço de entrega que vale, quando a plataforma o mudou
--     (banco enxuto — D-47: uma linha só para os pedidos alterados; no card do
--     pedido seriam 14 colunas quase sempre vazias na tabela mais quente; a
--     plt_pedido_datas é de outra regra, com outro ciclo de vida)
-- ----------------------------------------------------------------------------
create table if not exists public.plt_pedido_enderecos (
  pedido_id          bigint      primary key references public.pedidos(id) on delete cascade,
  endereco           text        not null,
  numero             text,
  complemento        text,
  bairro             text,
  cidade             text        not null,
  uf                 text        not null,
  cep                text,
  -- o resumo do endereço que o Tiny tinha quando a plataforma o trocou: o Tiny
  -- mudou o endereço depois (o resumo deixa de bater) → vale o do Tiny
  tiny_assinatura    text        not null,
  -- o endereço do Tiny daquele momento (o "original" que as telas mostram ao lado)
  tiny_original      jsonb       not null,
  escolha            text        not null,
  -- o Tiny confirmou (a nossa própria escrita voltou) — o selo vira "salvo também no Tiny"
  tiny_confirmado_em timestamptz,
  evento_id          bigint      not null,
  definido_por       uuid        references public.plt_usuarios(id),
  definido_em        timestamptz not null,
  constraint plt_pedido_enderecos_escolha_ck check (coalesce(escolha, '') in ('plataforma', 'tiny')),
  constraint plt_pedido_enderecos_texto_ck check (
    char_length(btrim(endereco)) between 1 and 200
    and char_length(btrim(cidade)) between 1 and 100
    and uf ~ '^[A-Z]{2}$')
);

comment on table public.plt_pedido_enderecos is
  'SESSAO-50 (bloco C): o endereço de entrega mudado NA PLATAFORMA (uma linha por pedido alterado). Vale enquanto o Tiny continuar com o endereço de tiny_assinatura; o Tiny mudou o endereço por fora → a linha sai (fato endereco_entrega_tiny_substituido) e vale o do Tiny. Projeção — escrita SÓ pelo gatilho dos fatos endereco_entrega_* do card do pedido (o original do Tiny inteiro mora no fato). Lida por plt_privado.vw_endereco_entrega.';

create index if not exists plt_pedido_enderecos_definido_por_idx on public.plt_pedido_enderecos (definido_por)
  where definido_por is not null;

alter table public.plt_pedido_enderecos enable row level security;
revoke all on public.plt_pedido_enderecos from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2 · As visões: a regra do Tiny (D-193 — sem mudar uma letra) e a que vale
-- ----------------------------------------------------------------------------
create or replace view plt_privado.vw_endereco_tiny as
select p.id as pedido_id,
       x.de_entrega,
       case when x.de_entrega then nullif(btrim(p.endereco_entrega ->> 'endereco'), '') else c.endereco end as endereco,
       case when x.de_entrega then nullif(btrim(p.endereco_entrega ->> 'numero'), '') else c.numero end as numero,
       case when x.de_entrega then nullif(btrim(p.endereco_entrega ->> 'complemento'), '') else c.complemento end as complemento,
       case when x.de_entrega then nullif(btrim(p.endereco_entrega ->> 'bairro'), '') else c.bairro end as bairro,
       case when x.de_entrega then nullif(btrim(p.endereco_entrega ->> 'cidade'), '') else c.cidade end as cidade,
       case when x.de_entrega then nullif(btrim(p.endereco_entrega ->> 'uf'), '') else c.uf end as uf,
       case when x.de_entrega then nullif(btrim(p.endereco_entrega ->> 'cep'), '') else c.cep end as cep
  from public.pedidos p
  left join public.clientes c on c.id = p.cliente_id
 cross join lateral (select nullif(btrim(p.endereco_entrega ->> 'endereco'), '') is not null as de_entrega) x;

comment on view plt_privado.vw_endereco_tiny is
  'SESSAO-50 (bloco C): ONDE ENTREGAR SEGUNDO O TINY — a regra da D-193 (o endereço de entrega do pedido no Tiny, inteiro, quando existe; senão, o do cadastro do cliente), que antes morava em vw_endereco_entrega. Lida pela vw_endereco_entrega e pela conferência do endereço alterado na plataforma.';

revoke all on plt_privado.vw_endereco_tiny from public, anon, authenticated;

create or replace view plt_privado.vw_endereco_entrega as
select t.pedido_id,
       t.de_entrega,
       case when pe.pedido_id is null then t.endereco    else pe.endereco    end as endereco,
       case when pe.pedido_id is null then t.numero      else pe.numero      end as numero,
       case when pe.pedido_id is null then t.complemento else pe.complemento end as complemento,
       case when pe.pedido_id is null then t.bairro      else pe.bairro      end as bairro,
       case when pe.pedido_id is null then t.cidade      else pe.cidade      end as cidade,
       case when pe.pedido_id is null then t.uf          else pe.uf          end as uf,
       case when pe.pedido_id is null then t.cep         else pe.cep         end as cep
  from plt_privado.vw_endereco_tiny t
  left join public.plt_pedido_enderecos pe on pe.pedido_id = t.pedido_id;

comment on view plt_privado.vw_endereco_entrega is
  'SESSAO-41 (D-193) → SESSAO-50 (bloco C): ONDE ENTREGAR — o endereço mudado na plataforma (plt_pedido_enderecos), quando existe; senão, o do Tiny (vw_endereco_tiny: o de entrega inteiro, ou o do cadastro). de_entrega = o Tiny tem endereço de entrega no pedido. Toda porta da logística lê daqui (as mesmas colunas, na mesma ordem — E-251).';

revoke all on plt_privado.vw_endereco_entrega from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3 · As peças pequenas do endereço (um dono cada)
-- ----------------------------------------------------------------------------
-- O endereço que a pessoa escreveu, limpo: sem espaço sobrando, a UF em
-- maiúsculas, o CEP no formato 00000-000 (os 8 números) — vazio vira nulo.
create or replace function plt_privado.fn_endereco_limpo(p jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'endereco',    nullif(regexp_replace(btrim(coalesce(p ->> 'endereco', '')), '\s+', ' ', 'g'), ''),
    'numero',      nullif(regexp_replace(btrim(coalesce(p ->> 'numero', '')), '\s+', ' ', 'g'), ''),
    'complemento', nullif(regexp_replace(btrim(coalesce(p ->> 'complemento', '')), '\s+', ' ', 'g'), ''),
    'bairro',      nullif(regexp_replace(btrim(coalesce(p ->> 'bairro', '')), '\s+', ' ', 'g'), ''),
    'cidade',      nullif(regexp_replace(btrim(coalesce(p ->> 'cidade', '')), '\s+', ' ', 'g'), ''),
    'uf',          nullif(upper(regexp_replace(coalesce(p ->> 'uf', ''), '\s', '', 'g')), ''),
    'cep',         (select case when x.d = '' then null
                                when length(x.d) = 8 then substr(x.d, 1, 5) || '-' || substr(x.d, 6)
                                else x.d end
                      from (select regexp_replace(coalesce(p ->> 'cep', ''), '\D', '', 'g') as d) x));
$$;

-- O resumo de um endereço para comparar ("o Tiny mudou?", "é o que a plataforma
-- pediu?"): cada parte pela régua de nome da casa (fn_nome_comparavel: sem
-- acento, sem caixa, sem espaço — não depende da língua do banco) e o CEP só
-- com os números.
create or replace function plt_privado.fn_endereco_assinatura(p jsonb)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select md5(concat_ws('|',
    plt_privado.fn_nome_comparavel(p ->> 'endereco'),
    plt_privado.fn_nome_comparavel(p ->> 'numero'),
    plt_privado.fn_nome_comparavel(p ->> 'complemento'),
    plt_privado.fn_nome_comparavel(p ->> 'bairro'),
    plt_privado.fn_nome_comparavel(p ->> 'cidade'),
    plt_privado.fn_nome_comparavel(p ->> 'uf'),
    regexp_replace(coalesce(p ->> 'cep', ''), '\D', '', 'g')));
$$;

-- O endereço numa linha, como as telas mostram ("Rua X, 55 · Centro · Natal-RN").
create or replace function plt_privado.fn_endereco_legivel(p jsonb)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(nullif(concat_ws(' · ',
           nullif(concat_ws(', ', nullif(btrim(p ->> 'endereco'), ''), nullif(btrim(p ->> 'numero'), '')), ''),
           nullif(btrim(p ->> 'bairro'), ''),
           nullif(concat_ws('-', nullif(btrim(p ->> 'cidade'), ''), nullif(btrim(p ->> 'uf'), '')), '')), ''),
         'sem endereço');
$$;

-- Por que "salvar também no Tiny" não está disponível. Esta noite, sempre há um
-- porquê: a API nova do Tiny (v3) não aceita endereço de entrega; a antiga (v2,
-- pedido.alterar) só serve ao pedido "Em aberto" ou "Aprovado" e SUBSTITUI o
-- pedido inteiro — exige o fluxo do n8n que lê o pedido completo e devolve tudo
-- idêntico menos o endereço, um motivo novo na fila de saída (que guarda UMA
-- vontade por pedido: um endereço pendente não pode apagar um "Entregue"
-- pendente) e o teste num pedido de teste com o dono. Ligado o caminho, a 2ª
-- linha vira null.
create or replace function plt_privado.fn_endereco_tiny_motivo(p_situacao text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
           when plt_privado.fn_situacao_normalizada(p_situacao) not in ('em_aberto', 'aprovado')
             then 'O Tiny só deixa alterar o endereço de pedido Em aberto ou Aprovado.'
           else 'Salvar no Tiny ainda não está ligado — por enquanto o endereço muda só na plataforma.'
         end;
$$;

revoke all on function plt_privado.fn_endereco_limpo(jsonb) from public, anon, authenticated;
revoke all on function plt_privado.fn_endereco_assinatura(jsonb) from public, anon, authenticated;
revoke all on function plt_privado.fn_endereco_legivel(jsonb) from public, anon, authenticated;
revoke all on function plt_privado.fn_endereco_tiny_motivo(text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4 · Os fatos do endereço: a guarda (só pela maquinaria) e a projeção (M-13)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_endereco_entrega()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.plt_cards%rowtype;
begin
  select * into v_card from public.plt_cards where id = new.card_id;
  if not found or v_card.tipo <> 'pedido' or v_card.pedido_id is null then
    raise exception 'O endereço de entrega mora no card do pedido.' using errcode = 'check_violation';
  end if;
  -- só as portas da janela "Editar endereço" e a conferência do Tiny ligam a marca:
  -- um fato solto mudaria a rota sem o original do Tiny guardado
  if coalesce(current_setting('plt.endereco_maquinaria', true), '') <> 'on' then
    raise exception 'O endereço de entrega muda pela janela "Editar endereço" (ou pelo Tiny).'
      using errcode = 'insufficient_privilege';
  end if;
  if new.tipo in ('endereco_entrega_alterado', 'endereco_entrega_restaurado') then
    if new.usuario_id is null then
      raise exception 'Mudar o endereço de entrega é gesto de pessoa — é preciso dizer quem fez.'
        using errcode = 'check_violation';
    end if;
    if coalesce(new.dados ->> 'escolha', '') not in ('plataforma', 'tiny') then
      raise exception 'Falta a escolha: só na plataforma ou também no Tiny.' using errcode = 'check_violation';
    end if;
  end if;
  if new.tipo = 'endereco_entrega_alterado'
     and (coalesce(jsonb_typeof(new.dados -> 'novo'), '') <> 'object'
          or coalesce(jsonb_typeof(new.dados -> 'original' -> 'campos'), '') <> 'object'
          or coalesce(new.dados ->> 'tiny_assinatura', '') = '') then
    raise exception 'O fato do endereço precisa do endereço novo, do original do Tiny e do resumo do Tiny.'
      using errcode = 'check_violation';
  end if;
  if new.tipo = 'endereco_entrega_tiny_confirmado' and coalesce(new.dados ->> 'tiny_assinatura', '') = '' then
    raise exception 'A confirmação do Tiny precisa do resumo do endereço do Tiny.' using errcode = 'check_violation';
  end if;
  if new.tipo in ('endereco_entrega_tiny_confirmado', 'endereco_entrega_tiny_substituido')
     and new.origem <> 'automacao' then
    raise exception 'Quem registra a mudança vinda do Tiny é o Sistema.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists plt_eventos_validar_endereco on public.plt_eventos;
create trigger plt_eventos_validar_endereco
  before insert on public.plt_eventos
  for each row when (new.tipo in ('endereco_entrega_alterado', 'endereco_entrega_restaurado',
                                  'endereco_entrega_tiny_confirmado', 'endereco_entrega_tiny_substituido'))
  execute function plt_privado.fn_validar_endereco_entrega();

-- A projeção: a linha do pedido só é escrita daqui.
create or replace function plt_privado.fn_projetar_endereco_entrega()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido bigint;
  d        jsonb := new.dados;
begin
  select c.pedido_id into v_pedido from public.plt_cards c where c.id = new.card_id;
  if v_pedido is null then
    return null;
  end if;
  if new.tipo = 'endereco_entrega_alterado' then
    insert into public.plt_pedido_enderecos as pe
        (pedido_id, endereco, numero, complemento, bairro, cidade, uf, cep,
         tiny_assinatura, tiny_original, escolha, tiny_confirmado_em, evento_id, definido_por, definido_em)
      values (v_pedido,
              d -> 'novo' ->> 'endereco', d -> 'novo' ->> 'numero', d -> 'novo' ->> 'complemento',
              d -> 'novo' ->> 'bairro', d -> 'novo' ->> 'cidade', d -> 'novo' ->> 'uf', d -> 'novo' ->> 'cep',
              d ->> 'tiny_assinatura',
              (d -> 'original' -> 'campos') || jsonb_build_object('fonte', d -> 'original' ->> 'fonte'),
              d ->> 'escolha', null, new.id, new.usuario_id, new.ocorrido_em)
      on conflict (pedido_id) do update
        set endereco = excluded.endereco, numero = excluded.numero, complemento = excluded.complemento,
            bairro = excluded.bairro, cidade = excluded.cidade, uf = excluded.uf, cep = excluded.cep,
            tiny_assinatura = excluded.tiny_assinatura, tiny_original = excluded.tiny_original,
            escolha = excluded.escolha, tiny_confirmado_em = null, evento_id = excluded.evento_id,
            definido_por = excluded.definido_por, definido_em = excluded.definido_em;
  elsif new.tipo = 'endereco_entrega_tiny_confirmado' then
    -- o Tiny agora tem o endereço da plataforma: o resumo do Tiny passa a ser o dele
    -- (o original de antes continua na linha e no fato)
    update public.plt_pedido_enderecos
       set tiny_assinatura = d ->> 'tiny_assinatura',
           tiny_confirmado_em = new.ocorrido_em,
           evento_id = new.id
     where pedido_id = v_pedido;
  else
    -- endereco_entrega_restaurado / endereco_entrega_tiny_substituido: vale o do Tiny
    delete from public.plt_pedido_enderecos where pedido_id = v_pedido;
  end if;
  return null;
end;
$$;

drop trigger if exists plt_eventos_projetar_endereco on public.plt_eventos;
create trigger plt_eventos_projetar_endereco
  after insert on public.plt_eventos
  for each row when (new.tipo in ('endereco_entrega_alterado', 'endereco_entrega_restaurado',
                                  'endereco_entrega_tiny_confirmado', 'endereco_entrega_tiny_substituido'))
  execute function plt_privado.fn_projetar_endereco_entrega();

-- O fato do endereço (a marca da maquinaria ligada só durante o insert).
create or replace function plt_privado.fn_endereco_fato(
  p_card_id bigint, p_tipo text, p_usuario uuid, p_origem text, p_observacao text, p_dados jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_m  text := coalesce(current_setting('plt.endereco_maquinaria', true), '');
  v_id bigint;
begin
  perform set_config('plt.endereco_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (p_card_id, p_tipo, p_usuario, p_origem, left(p_observacao, 600), p_dados)
    returning id into v_id;
  perform set_config('plt.endereco_maquinaria', v_m, true);
  return v_id;
end;
$$;

revoke all on function plt_privado.fn_validar_endereco_entrega() from public, anon, authenticated;
revoke all on function plt_privado.fn_projetar_endereco_entrega() from public, anon, authenticated;
revoke all on function plt_privado.fn_endereco_fato(bigint, text, uuid, text, text, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5 · O miolo: mudar o endereço (ou voltar ao original) — as duas portas chamam
-- ----------------------------------------------------------------------------
-- p_novo nulo = "Voltar ao endereço original". O endereço igual ao que vale =
-- nada muda (o toque repetido); igual ao do Tiny = é a volta ao original.
create or replace function plt_privado.fn_endereco_mudar(
  p_pedido_id bigint, p_novo jsonb, p_latitude double precision, p_longitude double precision,
  p_tiny boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu      uuid := plt_privado.fn_usuario_atual();
  v_p       public.pedidos%rowtype;
  v_c       public.clientes%rowtype;
  v_card    bigint;
  v_entregue boolean;
  v_pe      public.plt_pedido_enderecos%rowtype;
  v_tiny    jsonb;
  v_fonte   text;
  v_sig_t   text;
  v_antes   jsonb;
  v_novo    jsonb;
  v_digitos text;
  v_tipo    text;
  v_ponto   jsonb;
  v_geo     text;
  v_orig    jsonb;
  v_evento  bigint;
begin
  if v_eu is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Mudar o endereço de entrega é gesto da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_p from public.pedidos where id = p_pedido_id;
  if v_p.id is null then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  -- o card do pedido, travado: dois toques ao mesmo tempo viram um depois do outro
  select pc.id, pc.entrega_evento_id is not null into v_card, v_entregue
    from public.plt_cards pc
   where pc.pedido_id = v_p.id and pc.tipo = 'pedido'
   order by pc.arquivado_em nulls first, pc.id desc
   limit 1
     for update;
  if v_card is null then
    raise exception 'Este pedido ainda não tem card na plataforma — o endereço dele só muda pelo Tiny.'
      using errcode = 'check_violation';
  end if;
  -- provisória (SESSAO-50): pedido já entregue, só o administrador mexe no endereço
  if v_entregue and not plt_privado.fn_eh_admin() then
    raise exception 'O pedido já foi entregue — só um administrador muda o endereço.'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_pe from public.plt_pedido_enderecos where pedido_id = v_p.id;

  if coalesce(p_tiny, false) then
    raise exception '%', case when p_novo is null and v_pe.pedido_id is not null and v_pe.tiny_confirmado_em is null
                              then 'O Tiny já está com o endereço original — só a plataforma volta.'
                              else plt_privado.fn_endereco_tiny_motivo(v_p.situacao) end
      using errcode = 'feature_not_supported';
  end if;

  -- o endereço do Tiny agora (a regra da D-193) e o que vale hoje
  select jsonb_build_object('endereco', t.endereco, 'numero', t.numero, 'complemento', t.complemento,
                            'bairro', t.bairro, 'cidade', t.cidade, 'uf', t.uf, 'cep', t.cep),
         case when t.de_entrega then 'entrega' else 'cadastro' end
    into v_tiny, v_fonte
    from plt_privado.vw_endereco_tiny t where t.pedido_id = v_p.id;
  v_sig_t := plt_privado.fn_endereco_assinatura(v_tiny);
  v_antes := case when v_pe.pedido_id is null then v_tiny
                  else jsonb_build_object('endereco', v_pe.endereco, 'numero', v_pe.numero,
                                          'complemento', v_pe.complemento, 'bairro', v_pe.bairro,
                                          'cidade', v_pe.cidade, 'uf', v_pe.uf, 'cep', v_pe.cep) end;

  if p_novo is null then
    -- "Voltar ao endereço original"
    if v_pe.pedido_id is null then
      return jsonb_build_object('mudou', false, 'restaurado', false);
    end if;
    if v_pe.tiny_confirmado_em is not null then
      raise exception 'Este endereço já foi salvo também no Tiny — para voltar ao original, edite o endereço (o original está no histórico do pedido).'
        using errcode = 'check_violation';
    end if;
    v_tipo := 'endereco_entrega_restaurado';
    v_novo := v_tiny;
  else
    if jsonb_typeof(p_novo) <> 'object' then
      raise exception 'Escreva o endereço novo.' using errcode = 'check_violation';
    end if;
    v_novo := plt_privado.fn_endereco_limpo(p_novo);
    v_digitos := regexp_replace(coalesce(p_novo ->> 'cep', ''), '\D', '', 'g');
    if char_length(coalesce(v_novo ->> 'endereco', '')) < 3 then
      raise exception 'Escreva a rua (ou avenida, travessa…) do endereço.' using errcode = 'check_violation';
    end if;
    if char_length(coalesce(v_novo ->> 'cidade', '')) < 2 then
      raise exception 'Escreva a cidade do endereço.' using errcode = 'check_violation';
    end if;
    if coalesce(v_novo ->> 'uf', '') !~ '^[A-Z]{2}$' then
      raise exception 'A UF tem 2 letras (ex.: RN).' using errcode = 'check_violation';
    end if;
    if v_digitos <> '' and length(v_digitos) <> 8 then
      raise exception 'O CEP tem 8 números (ex.: 59000-000).' using errcode = 'check_violation';
    end if;
    if char_length(v_novo ->> 'endereco') > 200 or char_length(coalesce(v_novo ->> 'numero', '')) > 30
       or char_length(coalesce(v_novo ->> 'complemento', '')) > 120
       or char_length(coalesce(v_novo ->> 'bairro', '')) > 100 or char_length(v_novo ->> 'cidade') > 100 then
      raise exception 'Algum campo do endereço passou do tamanho — confira o que foi colado.'
        using errcode = 'check_violation';
    end if;
    if (p_latitude is null) <> (p_longitude is null) then
      raise exception 'O ponto do mapa precisa da latitude e da longitude.' using errcode = 'check_violation';
    end if;
    v_ponto := case when p_latitude is null then null
                    else jsonb_build_object('latitude', p_latitude, 'longitude', p_longitude) end;

    if plt_privado.fn_endereco_assinatura(v_novo) = plt_privado.fn_endereco_assinatura(v_antes) then
      -- o endereço não mudou (o toque repetido): só o ponto, se veio — pelo marcar de sempre
      if v_ponto is not null then
        v_geo := plt_privado.fn_endereco_geocodificavel(v_antes ->> 'endereco', v_antes ->> 'numero',
                   v_antes ->> 'bairro', v_antes ->> 'cidade', v_antes ->> 'uf', v_antes ->> 'cep');
        if v_geo is not null then
          perform public.plt_fn_geo_marcar(md5(lower(v_geo)), v_geo, p_latitude, p_longitude);
        end if;
      end if;
      return jsonb_build_object('mudou', false, 'restaurado', false, 'ponto', v_ponto is not null);
    end if;
    if plt_privado.fn_endereco_assinatura(v_novo) = v_sig_t then
      -- escreveu de novo o endereço do Tiny: é a volta ao original
      if v_pe.tiny_confirmado_em is not null then
        raise exception 'Este endereço já foi salvo também no Tiny — para voltar ao original, edite o endereço (o original está no histórico do pedido).'
          using errcode = 'check_violation';
      end if;
      v_tipo := 'endereco_entrega_restaurado';
      v_novo := v_tiny;
    else
      v_tipo := 'endereco_entrega_alterado';
    end if;
  end if;

  -- o original do Tiny, por inteiro, como chegou (de onde veio, os campos, o
  -- endereço de entrega cru do pedido e o do cadastro) — o log para recuperar
  select * into v_c from public.clientes where id = v_p.cliente_id;
  v_orig := jsonb_build_object(
    'fonte', v_fonte,
    'campos', v_tiny,
    'endereco_entrega', v_p.endereco_entrega,
    'cadastro', jsonb_build_object('endereco', v_c.endereco, 'numero', v_c.numero, 'complemento', v_c.complemento,
                                   'bairro', v_c.bairro, 'cidade', v_c.cidade, 'uf', v_c.uf, 'cep', v_c.cep));

  v_evento := plt_privado.fn_endereco_fato(
    v_card, v_tipo, v_eu, 'interface',
    case when v_tipo = 'endereco_entrega_alterado'
         then format('Endereço de entrega alterado na plataforma: de %s para %s (o Tiny não muda).',
                     plt_privado.fn_endereco_legivel(v_antes), plt_privado.fn_endereco_legivel(v_novo))
         else format('Endereço de entrega de volta ao original do Tiny: %s (o alterado na plataforma era %s).',
                     plt_privado.fn_endereco_legivel(v_tiny), plt_privado.fn_endereco_legivel(v_antes)) end,
    jsonb_build_object(
      'numero', v_p.numero,
      'escolha', case when coalesce(p_tiny, false) then 'tiny' else 'plataforma' end,
      'original', v_orig,
      'tiny_assinatura', v_sig_t,
      'anterior', v_antes || jsonb_build_object('fonte', case when v_pe.pedido_id is null then v_fonte else 'plataforma' end),
      'novo', v_novo,
      'ponto', v_ponto));

  -- o ponto do endereço que passa a valer (o pino da janela ou o da busca) — pelo
  -- marcar de sempre: manual, para a chave do endereço NOVO
  if v_ponto is not null then
    v_geo := plt_privado.fn_endereco_geocodificavel(v_novo ->> 'endereco', v_novo ->> 'numero',
               v_novo ->> 'bairro', v_novo ->> 'cidade', v_novo ->> 'uf', v_novo ->> 'cep');
    if v_geo is not null then
      perform public.plt_fn_geo_marcar(md5(lower(v_geo)), v_geo, p_latitude, p_longitude);
    end if;
  end if;

  -- D-40: o registro do gesto é o do próprio fato (fn_logar_evento grava quem, quando e
  -- o fato; a Auditoria mostra a observação dele — "de … para … (o Tiny não muda)").
  -- Um registro a mais aqui seria a mesma linha duas vezes.

  -- as telas das rotas abertas releem (Lei §4 — aviso, sem relógio)
  perform plt_privado.fn_avisar('rotas');
  return jsonb_build_object('mudou', true, 'restaurado', v_tipo = 'endereco_entrega_restaurado',
                            'evento_id', v_evento);
end;
$$;

revoke all on function plt_privado.fn_endereco_mudar(bigint, jsonb, double precision, double precision, boolean)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6 · As portas da janela "Editar endereço" (logística e admin — a mesma
--     permissão de marcar o ponto; pedido entregue, só admin)
-- ----------------------------------------------------------------------------
-- A leitura da janela (só ao abrir — Lei §3): o que vale, o do Tiny, quem mudou,
-- o ponto de agora, quem pode e por que o Tiny não.
create or replace function public.plt_fn_pedido_endereco(p_pedido_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_p      public.pedidos%rowtype;
  v_card   public.plt_cards%rowtype;
  v_pe     public.plt_pedido_enderecos%rowtype;
  v_tiny   jsonb;
  v_fonte  text;
  v_atual  jsonb;
  v_geo    text;
  v_g      public.plt_geocache%rowtype;
  v_motivo text;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'O endereço de entrega é da logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_p from public.pedidos where id = p_pedido_id;
  if v_p.id is null then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  select * into v_card from public.plt_cards pc
   where pc.pedido_id = v_p.id and pc.tipo = 'pedido'
   order by pc.arquivado_em nulls first, pc.id desc
   limit 1;
  select jsonb_build_object('endereco', t.endereco, 'numero', t.numero, 'complemento', t.complemento,
                            'bairro', t.bairro, 'cidade', t.cidade, 'uf', t.uf, 'cep', t.cep),
         case when t.de_entrega then 'entrega' else 'cadastro' end
    into v_tiny, v_fonte
    from plt_privado.vw_endereco_tiny t where t.pedido_id = v_p.id;
  select * into v_pe from public.plt_pedido_enderecos where pedido_id = v_p.id;
  v_atual := case when v_pe.pedido_id is null then v_tiny
                  else jsonb_build_object('endereco', v_pe.endereco, 'numero', v_pe.numero,
                                          'complemento', v_pe.complemento, 'bairro', v_pe.bairro,
                                          'cidade', v_pe.cidade, 'uf', v_pe.uf, 'cep', v_pe.cep) end;
  v_geo := plt_privado.fn_endereco_geocodificavel(v_atual ->> 'endereco', v_atual ->> 'numero',
             v_atual ->> 'bairro', v_atual ->> 'cidade', v_atual ->> 'uf', v_atual ->> 'cep');
  if v_geo is not null then
    select * into v_g from public.plt_geocache where chave = md5(lower(v_geo));
  end if;
  v_motivo := case
                when v_card.id is null
                  then 'Este pedido ainda não tem card na plataforma — o endereço dele só muda pelo Tiny.'
                when v_card.entrega_evento_id is not null and not plt_privado.fn_eh_admin()
                  then 'O pedido já foi entregue — só um administrador muda o endereço.'
              end;
  return jsonb_build_object(
    'pedido_id', v_p.id, 'numero', v_p.numero, 'situacao', v_p.situacao, 'card_id', v_card.id,
    'entregue', v_card.entrega_evento_id is not null,
    'pode_editar', v_motivo is null, 'motivo', v_motivo,
    'fonte', case when v_pe.pedido_id is not null then 'plataforma' else v_fonte end,
    'atual', v_atual,
    'tiny', v_tiny || jsonb_build_object('fonte', v_fonte),
    'plataforma', case when v_pe.pedido_id is null then null else jsonb_build_object(
                    'em', v_pe.definido_em,
                    'por', (select u.nome from public.plt_usuarios u where u.id = v_pe.definido_por),
                    'escolha', v_pe.escolha, 'tiny_confirmado_em', v_pe.tiny_confirmado_em,
                    'original', v_pe.tiny_original) end,
    'geo', jsonb_build_object(
             'chave', case when v_geo is null then null else md5(lower(v_geo)) end,
             'endereco_geocodificavel', v_geo,
             'latitude', v_g.latitude, 'longitude', v_g.longitude,
             'resolvido', v_g.resolvido, 'manual', coalesce(v_g.fonte = 'manual', false)),
    -- "Salvar na plataforma e no Tiny": desligado esta noite, sempre com o porquê
    'tiny_salvar', jsonb_build_object('pode', false, 'motivo', plt_privado.fn_endereco_tiny_motivo(v_p.situacao)),
    'tiny_restaurar', jsonb_build_object('pode', false, 'motivo',
                        case when v_pe.pedido_id is not null and v_pe.tiny_confirmado_em is null
                             then 'O Tiny já está com o endereço original — só a plataforma volta.'
                             else plt_privado.fn_endereco_tiny_motivo(v_p.situacao) end));
end;
$$;

comment on function public.plt_fn_pedido_endereco(bigint) is
  'SESSAO-50 (bloco C): a leitura da janela "Editar endereço" (só ao abrir): o endereço que vale, o do Tiny, quem mudou na plataforma, o ponto de agora, quem pode editar e por que o Tiny não. Logística/admin.';

-- Salvar o endereço novo (o ponto, se veio, entra como marcado à mão para a chave
-- do endereço novo). p_tiny = true é recusado com o porquê (desligado esta noite).
create or replace function public.plt_fn_pedido_endereco_salvar(
  p_pedido_id bigint,
  p_endereco  jsonb,
  p_latitude  double precision default null,
  p_longitude double precision default null,
  p_tiny      boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_endereco is null then
    raise exception 'Escreva o endereço novo.' using errcode = 'check_violation';
  end if;
  return plt_privado.fn_endereco_mudar(p_pedido_id, p_endereco, p_latitude, p_longitude, p_tiny);
end;
$$;

comment on function public.plt_fn_pedido_endereco_salvar(bigint, jsonb, double precision, double precision, boolean) is
  'SESSAO-50 (bloco C): a logística/admin muda o endereço de entrega do pedido NA PLATAFORMA (fato endereco_entrega_alterado com o original do Tiny inteiro; o pino, se veio, como ponto marcado à mão do endereço novo). O mesmo endereço = nada muda; o do Tiny = volta ao original. Pedido entregue: só admin. Salvar também no Tiny: recusado com o porquê (desligado).';

-- "Voltar ao endereço original" (o do Tiny). Sem endereço da plataforma = nada muda.
create or replace function public.plt_fn_pedido_endereco_restaurar(
  p_pedido_id bigint,
  p_tiny      boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return plt_privado.fn_endereco_mudar(p_pedido_id, null, null, null, p_tiny);
end;
$$;

comment on function public.plt_fn_pedido_endereco_restaurar(bigint, boolean) is
  'SESSAO-50 (bloco C): o pedido volta ao endereço de entrega do Tiny (fato endereco_entrega_restaurado; o alterado fica no histórico). Sem endereço da plataforma = nada muda.';

revoke all on function public.plt_fn_pedido_endereco(bigint) from public, anon;
revoke all on function public.plt_fn_pedido_endereco_salvar(bigint, jsonb, double precision, double precision, boolean) from public, anon;
revoke all on function public.plt_fn_pedido_endereco_restaurar(bigint, boolean) from public, anon;
grant execute on function public.plt_fn_pedido_endereco(bigint) to authenticated;
grant execute on function public.plt_fn_pedido_endereco_salvar(bigint, jsonb, double precision, double precision, boolean) to authenticated;
grant execute on function public.plt_fn_pedido_endereco_restaurar(bigint, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 7 · O Tiny mudou o endereço por fora (provisória, D-132): vale o do Tiny e a
--     logística é avisada. A nossa própria escrita voltando (o Tiny agora tem o
--     endereço que a plataforma pediu) é confirmação, não mudança.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_endereco_conferir_tiny(p_pedido_id bigint)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pe    public.plt_pedido_enderecos%rowtype;
  v_tiny  jsonb;
  v_fonte text;
  v_sig   text;
  v_plat  jsonb;
  v_card  bigint;
  v_num   integer;
  v_raw   jsonb;
  v_ev    bigint;
begin
  select * into v_pe from public.plt_pedido_enderecos where pedido_id = p_pedido_id for update;
  if v_pe.pedido_id is null then
    return null;
  end if;
  select jsonb_build_object('endereco', t.endereco, 'numero', t.numero, 'complemento', t.complemento,
                            'bairro', t.bairro, 'cidade', t.cidade, 'uf', t.uf, 'cep', t.cep),
         case when t.de_entrega then 'entrega' else 'cadastro' end
    into v_tiny, v_fonte
    from plt_privado.vw_endereco_tiny t where t.pedido_id = p_pedido_id;
  v_sig := plt_privado.fn_endereco_assinatura(v_tiny);
  if v_sig = v_pe.tiny_assinatura then
    return 'igual';
  end if;
  select pc.id into v_card from public.plt_cards pc
   where pc.pedido_id = p_pedido_id and pc.tipo = 'pedido'
   order by pc.arquivado_em nulls first, pc.id desc
   limit 1;
  if v_card is null then
    return null;
  end if;
  select p.numero, p.endereco_entrega into v_num, v_raw from public.pedidos p where p.id = p_pedido_id;
  v_plat := jsonb_build_object('endereco', v_pe.endereco, 'numero', v_pe.numero, 'complemento', v_pe.complemento,
                               'bairro', v_pe.bairro, 'cidade', v_pe.cidade, 'uf', v_pe.uf, 'cep', v_pe.cep);
  if v_sig = plt_privado.fn_endereco_assinatura(v_plat) then
    -- a nossa própria escrita voltando: o Tiny agora tem o endereço da plataforma
    v_ev := plt_privado.fn_endereco_fato(
      v_card, 'endereco_entrega_tiny_confirmado', null, 'automacao',
      format('O Tiny confirmou o endereço de entrega alterado na plataforma: %s.', plt_privado.fn_endereco_legivel(v_tiny)),
      jsonb_build_object('numero', v_num, 'tiny', v_tiny, 'tiny_fonte', v_fonte, 'tiny_assinatura', v_sig,
                         'endereco_entrega', v_raw));
    perform plt_privado.fn_avisar('rotas');
    return 'confirmado';
  end if;
  -- o Tiny mudou o endereço por fora: vale o do Tiny (o original e o alterado ficam no histórico)
  v_ev := plt_privado.fn_endereco_fato(
    v_card, 'endereco_entrega_tiny_substituido', null, 'automacao',
    format('O endereço de entrega mudou no Tiny (%s) — o endereço alterado na plataforma (%s) deixou de valer.',
           plt_privado.fn_endereco_legivel(v_tiny), plt_privado.fn_endereco_legivel(v_plat)),
    jsonb_build_object('numero', v_num, 'tiny', v_tiny, 'tiny_fonte', v_fonte, 'tiny_assinatura', v_sig,
                       'plataforma', v_plat, 'original', v_pe.tiny_original, 'endereco_entrega', v_raw));
  perform plt_privado.fn_avisar_publico(
    'endereco_tiny_mudou', 'logistica', v_ev, v_card,
    format('O endereço do pedido %s mudou no Tiny', v_num),
    format('O endereço do pedido %s mudou no Tiny; o endereço alterado na plataforma deixou de valer.', v_num));
  perform plt_privado.fn_avisar('rotas');
  return 'substituido';
end;
$$;

revoke all on function plt_privado.fn_endereco_conferir_tiny(bigint) from public, anon, authenticated;

-- O gatilho do pedido: o endereço de entrega (ou o cliente) mudou no Tiny.
-- Blindado: se a conferência der errado, a gravação do Tiny segue e o erro vira
-- aviso de automação (o molde de fn_desvincular_por_cancelamento).
create or replace function plt_privado.fn_endereco_tiny_mudou_pedido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.plt_pedido_enderecos pe where pe.pedido_id = new.id) then
    return null;
  end if;
  begin
    perform plt_privado.fn_endereco_conferir_tiny(new.id);
  exception when others then
    begin
      perform plt_privado.fn_alertar_erro(
        'automacao_erro', 'endereco_tiny:' || new.id,
        format('Não deu para conferir o endereço do pedido %s que mudou no Tiny', new.numero),
        format('O pedido %s chegou do Tiny com outro endereço, mas a plataforma não conseguiu compará-lo com o endereço alterado aqui — confira o endereço na ficha do pedido: %s',
               new.numero, sqlerrm),
        jsonb_build_object('pedido', new.numero, 'pedido_id', new.id, 'erro', sqlerrm),
        interval '1 hour', null);
    exception when others then
      raise warning 'plt_endereco_tiny: % — a gravação do Tiny segue intacta', sqlerrm;
    end;
  end;
  return null;
end;
$$;

-- O gatilho do cadastro: o endereço do cliente mudou — vale para os pedidos dele
-- que usam o cadastro (sem endereço de entrega no pedido) e têm endereço da
-- plataforma. Blindado do mesmo jeito.
create or replace function plt_privado.fn_endereco_tiny_mudou_cliente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  begin
    for r in
      select pe.pedido_id, p.numero
        from public.plt_pedido_enderecos pe
        join public.pedidos p on p.id = pe.pedido_id
       where p.cliente_id = new.id
       order by pe.pedido_id
    loop
      begin
        perform plt_privado.fn_endereco_conferir_tiny(r.pedido_id);
      exception when others then
        begin
          perform plt_privado.fn_alertar_erro(
            'automacao_erro', 'endereco_tiny:' || r.pedido_id,
            format('Não deu para conferir o endereço do pedido %s (o cadastro do cliente mudou no Tiny)', r.numero),
            format('O cadastro do cliente do pedido %s mudou no Tiny, mas a plataforma não conseguiu compará-lo com o endereço alterado aqui — confira o endereço na ficha do pedido: %s',
                   r.numero, sqlerrm),
            jsonb_build_object('pedido', r.numero, 'pedido_id', r.pedido_id, 'erro', sqlerrm),
            interval '1 hour', null);
        exception when others then
          raise warning 'plt_endereco_tiny: % — a gravação do Tiny segue intacta', sqlerrm;
        end;
      end;
    end loop;
  exception when others then
    raise warning 'plt_endereco_tiny (cadastro): % — a gravação do Tiny segue intacta', sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function plt_privado.fn_endereco_tiny_mudou_pedido() from public, anon, authenticated;
revoke all on function plt_privado.fn_endereco_tiny_mudou_cliente() from public, anon, authenticated;

drop trigger if exists plt_pedidos_endereco_tiny on public.pedidos;
create trigger plt_pedidos_endereco_tiny
  after update of endereco_entrega, cliente_id on public.pedidos
  for each row when (old.endereco_entrega is distinct from new.endereco_entrega
                     or old.cliente_id is distinct from new.cliente_id)
  execute function plt_privado.fn_endereco_tiny_mudou_pedido();

comment on trigger plt_pedidos_endereco_tiny on public.pedidos is
  'SESSAO-50 (bloco C): o endereço de entrega (ou o cliente) do pedido mudou no Tiny — se o pedido tem endereço alterado na plataforma, confere: o Tiny com o endereço da plataforma = confirmação; outro = vale o do Tiny e a logística é avisada. À prova de falha.';

drop trigger if exists plt_clientes_endereco_tiny on public.clientes;
create trigger plt_clientes_endereco_tiny
  after update of endereco, numero, complemento, bairro, cidade, uf, cep on public.clientes
  for each row when ((old.endereco, old.numero, old.complemento, old.bairro, old.cidade, old.uf, old.cep)
                     is distinct from (new.endereco, new.numero, new.complemento, new.bairro, new.cidade, new.uf, new.cep))
  execute function plt_privado.fn_endereco_tiny_mudou_cliente();

comment on trigger plt_clientes_endereco_tiny on public.clientes is
  'SESSAO-50 (bloco C): o endereço do cadastro do cliente mudou no Tiny — confere os pedidos dele com endereço alterado na plataforma (o que usa o cadastro como endereço de entrega). À prova de falha.';

-- ----------------------------------------------------------------------------
-- 8 · Frente 6 · a parada avulsa: quem pode editar (na leitura, sem requisição
--     nova) e a edição com o antes e o depois
-- ----------------------------------------------------------------------------
-- O "quem pode editar" vem nas DUAS leituras das paradas (as Entregas do dia e "Já
-- programadas"), calculado com o "sou da logística?" que cada porta já sabe UMA vez —
-- não dentro de fn_parada_json, que roda por parada (o 1º ensaio ×100 com a regra lá
-- dentro: a leitura do período foi de 36 para 56 ms, uma consulta de permissão por parada).
create or replace function public.plt_fn_paradas_avulsas(p_de date, p_ate date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'As paradas da rota são da logística.' using errcode = 'insufficient_privilege';
  end if;
  if p_ate - p_de > 62 then
    raise exception 'Até dois meses por vez.' using errcode = 'check_violation';
  end if;
  return coalesce((
    select jsonb_agg(plt_privado.fn_parada_json(pa)
                     -- SESSAO-50 (bloco C): só a logística lê esta porta — ela edita toda parada
                     -- PENDENTE (a regra da porta de salvar; a feita/não feita não se edita)
                     || jsonb_build_object('pode_editar', pa.situacao = 'pendente')
                     order by pa.data_entrega, pa.caminhao_id, pa.rota, pa.ordem nulls last, pa.id)
      from public.plt_paradas_avulsas pa
     where pa.data_entrega between p_de and p_ate and pa.removida_em is null), '[]'::jsonb);
end;
$$;

CREATE OR REPLACE FUNCTION public.plt_fn_entregas_do_dia(p_data date DEFAULT NULL::date, p_caminhao_id bigint DEFAULT NULL::bigint, p_rota integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_usuario   uuid;
  v_logistica boolean;
  v_data      date;
  v_caminhoes jsonb;
  v_caminhao  bigint;
  v_rota      integer;
  v_entregas  jsonb;
  v_paradas   jsonb;
  -- SESSAO-47: o que foi entregue NESTE dia de fato, programado para outro
  v_outro_dia jsonb;
  v_ini       timestamptz;
  v_fim       timestamptz;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Entre na plataforma para ver as entregas.' using errcode = 'insufficient_privilege';
  end if;
  v_logistica := plt_privado.fn_pode_ver_expedicao();
  if not v_logistica and not plt_privado.fn_eh_entregador(v_usuario) then
    raise exception 'As entregas do dia são do entregador e da logística.' using errcode = 'insufficient_privilege';
  end if;
  v_data := coalesce(p_data, (now() at time zone 'America/Fortaleza')::date);

  -- As rotas do dia: a logística vê todas as programadas; o entregador, as da
  -- equipe dele (SESSAO-31 · D-128: a equipe é de cada rota).
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'rota', x.rota, 'nome', x.nome, 'placa', x.placa,
                                               'foto', x.foto_caminho, 'equipe', x.equipe, 'entregas', x.n)
                            order by x.nome, x.id, x.rota), '[]'::jsonb)
    into v_caminhoes
    from (
      select cam.id, cam.nome, cam.placa, cam.foto_caminho, pr.rota::int as rota, count(pr.id)::int as n,
             coalesce((select jsonb_agg(u.nome order by u.nome)
                         from public.plt_programacao_equipes eq join public.plt_usuarios u on u.id = eq.usuario_id
                        where eq.data_entrega = v_data and eq.caminhao_id = cam.id and eq.rota = pr.rota), '[]'::jsonb) as equipe
        from public.plt_caminhoes cam
        join public.plt_programacoes pr on pr.caminhao_id = cam.id and pr.data_entrega = v_data
       where v_logistica
          or exists (select 1 from public.plt_programacao_equipes eq
                      where eq.data_entrega = v_data and eq.caminhao_id = cam.id and eq.rota = pr.rota
                        and eq.usuario_id = v_usuario)
       group by cam.id, pr.rota
    ) x;

  select (t.c ->> 'id')::bigint, (t.c ->> 'rota')::int into v_caminhao, v_rota
    from jsonb_array_elements(v_caminhoes) with ordinality as t(c, i)
   where (p_caminhao_id is null or (t.c ->> 'id')::bigint = p_caminhao_id)
     and (p_rota is null or (t.c ->> 'rota')::int = p_rota)
   order by t.i
   limit 1;

  select coalesce(jsonb_agg(e order by (e ->> 'posicao')::int), '[]'::jsonb) into v_entregas
    from (
      select jsonb_build_object(
               'posicao', row_number() over (order by pr.ordem nulls last, p.numero),
               -- SESSAO-39 (D-174): a ordem salva — a tela numera como "Já programadas"
               'ordem', pr.ordem,
               'card_id', pc.id, 'pedido_id', p.id, 'numero', p.numero,
               'cliente_nome', coalesce(c.nome, ''), 'telefone', c.fone,
               'endereco', ee.endereco, 'numero_endereco', ee.numero, 'complemento', ee.complemento,
               'bairro', ee.bairro, 'cidade', ee.cidade, 'uf', ee.uf,
               'latitude', g.latitude, 'longitude', g.longitude,
               -- SESSAO-45: o CEP vai ao Google Maps/Waze; o ponto marcado à mão manda na navegação
               'cep', ee.cep, 'geo_manual', coalesce(g.fonte = 'manual', false),
               'obs', p.obs, 'detalhe', pr.detalhe, 'data_prevista', plt_privado.fn_data_entrega(p.id, p.data_prevista),
               'itens', coalesce(i.itens, '[]'::jsonb), 'unidades', coalesce(i.unidades, 0),
               'volumes', coalesce(i.volumes, 0),
               -- SESSAO-38 (D-156): o programado pode ainda estar em produção.
               'estado', pp.estado, 'pronto', coalesce(pp.pronto, true),
               'prontas', coalesce(pp.unidades_prontas, 0), 'a_entregar', coalesce(pp.a_entregar, 0),
               -- SESSAO-47: o dia REAL da entrega (a projeção do card), quando ela
               -- foi REGISTRADA (o "desfazer do dia" conta por aqui) e quando o
               -- pedido chegou à plataforma (o limite do "entregue no dia...")
               'entregue_em', pc.entrega_em, 'entregue_por', ue.nome,
               'entregue_no_dia', plt_privado.fn_dia_da_entrega(pc.entrega_em),
               'entrega_registrada_em', ent.registrado_em,
               'chegou_em', pc.criado_em,
               -- SESSAO-41 (D-195): a entrega foi PARCIAL
               'entrega_parcial', coalesce((ent.dados ->> 'parcial')::boolean, false),
               'entregue_por_gente', ent.usuario_id is not null,
               'comprovantes', (select count(*) from public.plt_anexos a where a.card_id = pc.id and a.removido_em is null),
               'comentarios', coalesce((select jsonb_agg(jsonb_build_object('texto', cm.observacao, 'por', uc.nome, 'em', cm.ocorrido_em)
                                                         order by cm.id desc)
                                          from (select * from public.plt_eventos ev
                                                 where ev.card_id = pc.id and ev.tipo = 'comentario_adicionado'
                                                 order by ev.id desc limit 5) cm
                                          left join public.plt_usuarios uc on uc.id = cm.usuario_id), '[]'::jsonb)
             ) as e
        from public.plt_programacoes pr
        join public.plt_cards pc on pc.id = pr.card_id and pc.tipo = 'pedido'
        join public.pedidos p on p.id = pc.pedido_id
        left join public.clientes c on c.id = p.cliente_id
      left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = p.id
        left join public.plt_geocache g
               on g.chave = md5(lower(plt_privado.fn_endereco_geocodificavel(ee.endereco, ee.numero, ee.bairro, ee.cidade, ee.uf, ee.cep)))
        left join public.plt_eventos ent on ent.id = pc.entrega_evento_id
        left join public.plt_usuarios ue on ue.id = ent.usuario_id
        left join plt_privado.vw_pedido_prontidao pp on pp.card_id = pc.id
        left join lateral (
          -- D-63: o frete não aparece; os volumes vêm do cadastro do Tiny (vazio ou 0 = 1 por móvel).
          select jsonb_agg(jsonb_build_object('descricao', coalesce(nullif(btrim(v.descricao), ''), 'Item sem descrição'),
                                              'quantidade', v.unidades,
                                              'volumes', v.unidades * x.vol) order by v.seq) as itens,
                 sum(v.unidades)::int as unidades,
                 sum(v.unidades * x.vol)::int as volumes
            from plt_privado.vw_itens_producao v
            cross join lateral (
              select greatest(coalesce(nullif(regexp_replace(coalesce(pr2.raw ->> 'qtd_volumes', ''), '[^0-9]', '', 'g'), '')::int, 1), 1) as vol
                from (select plt_privado.fn_produto_do_item(v.codigo, v.descricao) as tiny_id) t
                left join public.produtos pr2 on pr2.tiny_id = t.tiny_id
            ) x
           where v.pedido_id = p.id and not v.eh_frete and v.unidades > 0
        ) i on true
       where pr.data_entrega = v_data and pr.caminhao_id = v_caminhao and pr.rota = v_rota
         -- SESSAO-38 (ajuste): a entrega do dia aparece mesmo quando o card saiu com ela
         and (pc.arquivado_em is null or pc.entrega_evento_id is not null)
    ) s;

  -- SESSAO-41 (D-196): as paradas avulsas da rota, na mesma ordem dos pedidos
  select coalesce(jsonb_agg(plt_privado.fn_parada_json(pa)
                            -- SESSAO-50 (bloco C): quem pode editar — a logística, ou quem pôs a
                            -- parada; só a pendente (a regra da porta de salvar) — o "Editar" da tela
                            || jsonb_build_object('pode_editar', pa.situacao = 'pendente'
                                                  and (v_logistica or pa.criada_por = v_usuario))
                            order by pa.ordem nulls last, pa.id), '[]'::jsonb)
    into v_paradas
    from public.plt_paradas_avulsas pa
   where pa.data_entrega = v_data and pa.caminhao_id = v_caminhao and pa.rota = v_rota and pa.removida_em is null;

  -- SESSAO-47: os pedidos cujo dia REAL de entrega é este, programados para
  -- OUTRO dia (a logística vê todos; o entregador, os das rotas da equipe
  -- dele). A parada continua também na rota em que estava programada — é lá
  -- que quem registrou desfaz. Pelo índice do dia da entrega; teto de 100.
  v_ini := v_data::timestamp at time zone 'America/Fortaleza';
  v_fim := (v_data + 1)::timestamp at time zone 'America/Fortaleza';
  select coalesce(jsonb_agg(x.e order by x.em, x.numero), '[]'::jsonb) into v_outro_dia
    from (
      select pc.entrega_em as em, p.numero,
             jsonb_build_object(
               'card_id', pc.id, 'pedido_id', p.id, 'numero', p.numero,
               'cliente_nome', coalesce(c.nome, ''),
               'entregue_em', pc.entrega_em, 'entrega_registrada_em', ent.registrado_em,
               'entregue_por', ue.nome, 'entregue_por_gente', ent.usuario_id is not null,
               'entrega_parcial', coalesce((ent.dados ->> 'parcial')::boolean, false),
               'programado_para', pr.data_entrega, 'caminhao_nome', cam.nome, 'rota', pr.rota::int) as e
        from public.plt_cards pc
        join public.plt_programacoes pr on pr.card_id = pc.id
        join public.pedidos p on p.id = pc.pedido_id
        left join public.clientes c on c.id = p.cliente_id
        left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
        left join public.plt_eventos ent on ent.id = pc.entrega_evento_id
        left join public.plt_usuarios ue on ue.id = ent.usuario_id
       where pc.tipo = 'pedido'
         and pc.entrega_em >= v_ini and pc.entrega_em < v_fim
         and pr.data_entrega <> v_data
         and (v_logistica
              or exists (select 1 from public.plt_programacao_equipes eq
                          where eq.data_entrega = pr.data_entrega and eq.caminhao_id = pr.caminhao_id
                            and eq.rota = pr.rota and eq.usuario_id = v_usuario))
       order by pc.entrega_em, p.numero
       limit 100
    ) x;

  return jsonb_build_object('data', v_data, 'caminhao_id', v_caminhao, 'rota', v_rota, 'caminhoes', v_caminhoes,
                            'entregas', v_entregas, 'paradas_avulsas', v_paradas, 'sou_logistica', v_logistica,
                            'entregues_de_outro_dia', v_outro_dia);
end;
$function$;

create or replace function public.plt_fn_parada_avulsa_salvar(
  p_id          bigint,
  p_data        date,
  p_caminhao_id bigint,
  p_rota        integer,
  p_titulo      text,
  p_endereco    text,
  p_latitude    double precision default null,
  p_longitude   double precision default null,
  p_observacao  text default null,
  p_ordem       jsonb default null,
  p_chave       uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu        uuid := plt_privado.fn_usuario_atual();
  v_logistica boolean := plt_privado.fn_pode_ver_expedicao();
  v_p         public.plt_paradas_avulsas%rowtype;
  v_id        bigint;
  v_rota      integer := coalesce(p_rota, 1);
  v_ordem     jsonb;
  -- SESSAO-50 (bloco C): a edição com o antes e o depois
  v_titulo    text;
  v_endereco  text;
  v_obs       text;
begin
  if v_eu is null then
    raise exception 'Entre na plataforma primeiro.' using errcode = 'insufficient_privilege';
  end if;

  if p_id is null then
    -- o mesmo toque repetido (a rede que volta) = a mesma parada
    if p_chave is not null then
      select * into v_p from public.plt_paradas_avulsas where chave_criacao = p_chave;
      if v_p.id is not null then
        return jsonb_build_object('id', v_p.id, 'repetido', true);
      end if;
    end if;
    if not v_logistica then
      if not plt_privado.fn_na_equipe_da_rota(p_data, p_caminhao_id, v_rota) then
        raise exception 'Parada avulsa é da logística ou de quem está na equipe dessa rota.' using errcode = 'insufficient_privilege';
      end if;
      if p_data <> (now() at time zone 'America/Fortaleza')::date then
        raise exception 'O entregador põe parada só na rota de hoje.' using errcode = 'check_violation';
      end if;
    end if;
    if not exists (select 1 from public.plt_caminhoes c where c.id = p_caminhao_id and c.arquivado_em is null) then
      raise exception 'Caminhão não encontrado.' using errcode = 'no_data_found';
    end if;
    insert into public.plt_paradas_avulsas
        (data_entrega, caminhao_id, rota, titulo, endereco, latitude, longitude, observacao, criada_por, chave_criacao, ordem)
      values (p_data, p_caminhao_id, v_rota, btrim(p_titulo), btrim(p_endereco), p_latitude, p_longitude,
              nullif(btrim(coalesce(p_observacao, '')), ''), v_eu, p_chave,
              (select coalesce(max(o), 0) + 1 from (
                 select pr.ordem as o from public.plt_programacoes pr
                  where pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id and pr.rota = v_rota
                 union all
                 select pa.ordem from public.plt_paradas_avulsas pa
                  where pa.data_entrega = p_data and pa.caminhao_id = p_caminhao_id and pa.rota = v_rota and pa.removida_em is null) x))
      returning id into v_id;
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
      values (v_eu, 'parada_avulsa_criada',
              jsonb_build_object('parada_id', v_id, 'data', p_data, 'caminhao_id', p_caminhao_id, 'rota', v_rota));
    if p_ordem is not null then
      select jsonb_agg(case when e ->> 't' = 'nova' then jsonb_build_object('t', 'a', 'id', v_id) else e end order by i)
        into v_ordem
        from jsonb_array_elements(p_ordem) with ordinality as t(e, i);
      perform plt_privado.fn_rota_aplicar_ordem(p_data, p_caminhao_id, v_rota, v_ordem);
    end if;
  else
    select * into v_p from public.plt_paradas_avulsas where id = p_id and removida_em is null for update;
    if v_p.id is null then
      raise exception 'Parada não encontrada.' using errcode = 'no_data_found';
    end if;
    if not v_logistica and not (v_p.criada_por = v_eu and v_p.situacao = 'pendente') then
      raise exception 'Só a logística (ou quem pôs a parada, antes de fazê-la) edita a parada.' using errcode = 'insufficient_privilege';
    end if;
    -- SESSAO-50 (bloco C · provisória): a parada já marcada (feita ou não feita) não se
    -- edita — nem pela logística; "Desfazer" a devolve a pendente
    if v_p.situacao <> 'pendente' then
      raise exception 'A parada já foi marcada como feita ou não feita — toque em "Desfazer" antes de editar.'
        using errcode = 'check_violation';
    end if;
    v_titulo   := btrim(p_titulo);
    v_endereco := btrim(p_endereco);
    v_obs      := nullif(btrim(coalesce(p_observacao, '')), '');
    -- salvar sem mudar nada (o toque repetido, a rede que volta) = nada muda, nada se registra
    if (v_p.titulo, v_p.endereco, v_p.latitude, v_p.longitude, v_p.observacao)
       is not distinct from (v_titulo, v_endereco, p_latitude, p_longitude, v_obs) then
      return jsonb_build_object('id', v_p.id, 'repetido', true);
    end if;
    update public.plt_paradas_avulsas
       set titulo = v_titulo, endereco = v_endereco,
           latitude = p_latitude, longitude = p_longitude,
           observacao = v_obs
     where id = p_id;
    v_id := p_id;
    -- D-40: o registro com o ANTES e o DEPOIS do que mudou (endereço, ponto,
    -- título, observação) — o que não mudou não entra
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
      values (v_eu, 'parada_avulsa_editada', jsonb_strip_nulls(jsonb_build_object(
        'parada_id', v_id,
        'parada', v_titulo,
        'campos', to_jsonb(array_remove(array[
                    case when v_p.titulo is distinct from v_titulo then 'título' end,
                    case when v_p.endereco is distinct from v_endereco then 'endereço' end,
                    case when (v_p.latitude, v_p.longitude) is distinct from (p_latitude, p_longitude)
                         then 'ponto no mapa' end,
                    case when v_p.observacao is distinct from v_obs then 'observação' end], null)),
        'titulo_antes',      case when v_p.titulo is distinct from v_titulo then v_p.titulo end,
        'titulo_depois',     case when v_p.titulo is distinct from v_titulo then v_titulo end,
        'endereco_antes',    case when v_p.endereco is distinct from v_endereco then v_p.endereco end,
        'endereco_depois',   case when v_p.endereco is distinct from v_endereco then v_endereco end,
        'ponto_antes',       case when (v_p.latitude, v_p.longitude) is distinct from (p_latitude, p_longitude)
                                  then coalesce(round(v_p.latitude::numeric, 6)::text || ', ' || round(v_p.longitude::numeric, 6)::text,
                                                'sem ponto') end,
        'ponto_depois',      case when (v_p.latitude, v_p.longitude) is distinct from (p_latitude, p_longitude)
                                  then coalesce(round(p_latitude::numeric, 6)::text || ', ' || round(p_longitude::numeric, 6)::text,
                                                'sem ponto') end,
        'observacao_antes',  case when v_p.observacao is distinct from v_obs then coalesce(v_p.observacao, 'sem observação') end,
        'observacao_depois', case when v_p.observacao is distinct from v_obs then coalesce(v_obs, 'sem observação') end)));
  end if;
  perform plt_privado.fn_avisar('rotas');
  return jsonb_build_object('id', v_id, 'repetido', false);
end;
$$;

-- ----------------------------------------------------------------------------
-- 9 · O selo "Endereço alterado na plataforma" com o original do Tiny ao lado:
--     a ficha do pedido e os pedidos da aba Programar (a chave só nasce quando
--     o pedido tem endereço da plataforma — E-237)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plt_fn_pcp_pedido_detalhe(p_pedido_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_p    public.pedidos%rowtype;
  v_c    public.clientes%rowtype;
  v_card public.plt_cards%rowtype;
  v_ent  public.plt_eventos%rowtype;
  v_prog public.plt_programacoes%rowtype;
  v_sit  text;
  v_tot  integer;
  v_lib  integer;
  v_pro  integer;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'O detalhe do pedido é da logística (PCP/terminais) ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_p from public.pedidos where id = p_pedido_id;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  select * into v_c from public.clientes where id = v_p.cliente_id;
  select * into v_card from public.plt_cards where pedido_id = v_p.id and tipo = 'pedido';
  if v_card.entrega_evento_id is not null then
    select * into v_ent from public.plt_eventos where id = v_card.entrega_evento_id;
  end if;
  if v_card.id is not null then
    select * into v_prog from public.plt_programacoes where card_id = v_card.id;
  end if;

  -- A situação na plataforma — a mesma regra de "Todos os pedidos".
  select coalesce(sum(v.unidades), 0)::int into v_tot
    from plt_privado.vw_itens_producao v where v.pedido_id = v_p.id;
  select count(*)::int, count(*) filter (where s.papel_no_fluxo = 'terminal' or u.concluido_em is not null)::int
    into v_lib, v_pro
    from public.plt_cards u
    left join public.plt_setores s on s.id = u.setor_atual_id
   where u.pedido_id = v_p.id and u.tipo = 'unidade' and u.arquivado_em is null;
  v_sit := case
             when v_card.id is null then 'sem_card'
             when v_card.devolucao_evento_id is not null then 'devolvido'  -- SESSAO-31 (D-129)
             when v_card.entrega_evento_id is not null then 'entregue'
             when v_card.arquivado_em is not null then 'arquivado'
             when v_card.lancado_rotas_em is not null then 'em_rota'
             when v_tot > 0 and v_pro >= v_tot then 'aguardo'
             when v_lib > 0 then 'producao'
             else 'pcp'
           end;

  return jsonb_build_object(
    -- SESSAO-31 (D-129): a devolução em decisão (o resto vem da porta da decisão).
    'devolucao', case when v_card.devolucao_evento_id is not null then (
      select jsonb_build_object('evento_id', d.id, 'quando', d.ocorrido_em,
               'quem', (select u.nome from public.plt_usuarios u where u.id = d.usuario_id),
               'motivo', d.dados ->> 'motivo', 'observacao', d.dados ->> 'observacao',
               'entregue', coalesce((d.dados ->> 'entregue')::boolean, false))
        from public.plt_eventos d where d.id = v_card.devolucao_evento_id) end,
    'pedido', jsonb_build_object(
      'id', v_p.id, 'numero', v_p.numero, 'situacao', v_p.situacao, 'origem', v_p.origem,
      'data_pedido', v_p.data_pedido, 'data_prevista', plt_privado.fn_data_entrega(v_p.id, v_p.data_prevista),
      -- SESSAO-41 (D-194): a data do Tiny e se a da plataforma está valendo
      'data_prevista_tiny', v_p.data_prevista,
      'data_alterada', plt_privado.fn_data_entrega(v_p.id, v_p.data_prevista) is distinct from v_p.data_prevista,
      'data_faturamento', nullif(v_p.raw ->> 'data_faturamento', ''),
      'data_envio', nullif(v_p.raw ->> 'data_envio', ''),
      'data_entrega_tiny', nullif(v_p.raw ->> 'data_entrega', ''),
      'total_produtos', v_p.total_produtos, 'valor_frete', v_p.valor_frete,
      'valor_desconto', nullif(v_p.raw ->> 'valor_desconto', ''),
      'outras_despesas', nullif(v_p.raw ->> 'outras_despesas', ''),
      'total_pedido', v_p.total_pedido,
      'forma_pagamento', v_p.forma_pagamento, 'meio_pagamento', v_p.meio_pagamento,
      'condicao_pagamento', nullif(v_p.raw ->> 'condicao_pagamento', ''),
      'qtd_parcelas', v_p.qtd_parcelas,
      'parcelas', coalesce((select jsonb_agg(jsonb_build_object(
                     'data', nullif(x -> 'parcela' ->> 'data', ''), 'dias', nullif(x -> 'parcela' ->> 'dias', ''),
                     'valor', nullif(x -> 'parcela' ->> 'valor', ''),
                     'forma', nullif(x -> 'parcela' ->> 'forma_pagamento', ''),
                     'meio', nullif(x -> 'parcela' ->> 'meio_pagamento', ''),
                     'obs', nullif(x -> 'parcela' ->> 'obs', '')) order by o)
                   from jsonb_array_elements(case when jsonb_typeof(v_p.parcelas) = 'array' then v_p.parcelas else '[]'::jsonb end)
                        with ordinality as t(x, o)), '[]'::jsonb),
      'obs', v_p.obs, 'obs_interna', v_p.obs_interna, 'marcadores', to_jsonb(coalesce(v_p.marcadores, '{}'::text[])),
      'vendedor', v_p.vendedor, 'ecommerce', v_p.ecommerce, 'numero_ecommerce', nullif(v_p.raw ->> 'numero_ecommerce', ''),
      'forma_envio', v_p.forma_envio, 'forma_frete', nullif(v_p.raw ->> 'forma_frete', ''),
      'transportador', nullif(v_p.raw ->> 'nome_transportador', ''),
      'codigo_rastreamento', v_p.codigo_rastreamento, 'url_rastreamento', v_p.url_rastreamento,
      'atualizado_em', v_p.atualizado_em),
    'cliente', jsonb_build_object(
      'nome', v_c.nome, 'fone', v_c.fone, 'email', v_c.email, 'documento', v_c.cpf_cnpj,
      'endereco', v_c.endereco, 'numero', v_c.numero, 'complemento', v_c.complemento,
      'bairro', v_c.bairro, 'cidade', v_c.cidade, 'uf', v_c.uf, 'cep', v_c.cep),
    -- SESSAO-41 (D-193): ONDE ENTREGAR (o endereço de entrega do Tiny, quando há)
    'endereco_entrega', (select to_jsonb(ee) - 'pedido_id' from plt_privado.vw_endereco_entrega ee
                          where ee.pedido_id = v_p.id),
    'plataforma', jsonb_build_object(
      'card_id', v_card.id, 'situacao', v_sit, 'total_unidades', v_tot,
      'lancado_rotas_em', v_card.lancado_rotas_em, 'arquivado_em', v_card.arquivado_em,
      'liberado_completo_em', v_card.liberado_completo_em,
      -- SESSAO-47: quando o pedido chegou à plataforma (o limite do dia da entrega)
      'chegou_em', v_card.criado_em),
    'programacao', case when v_prog.id is null then null else jsonb_build_object(
      'data', v_prog.data_entrega, 'rota', v_prog.rota, 'ordem', v_prog.ordem, 'detalhe', v_prog.detalhe,
      'caminhao', (select cam.nome || coalesce(' · ' || cam.placa, '') from public.plt_caminhoes cam where cam.id = v_prog.caminhao_id),
      'equipe', coalesce((select jsonb_agg(u.nome order by u.nome)
                            from public.plt_programacao_equipes eq join public.plt_usuarios u on u.id = eq.usuario_id
                           where eq.data_entrega = v_prog.data_entrega and eq.caminhao_id = v_prog.caminhao_id
                             and eq.rota = v_prog.rota), '[]'::jsonb)) end,
    'entrega', case when v_ent.id is null then null else jsonb_build_object(
      -- SESSAO-47: "em" = o dia REAL da entrega (a projeção do card — com a
      -- correção do administrador, se houve); "registrada_em" = quando ela foi
      -- registrada (o desfazer do dia conta por aqui)
      'em', v_card.entrega_em, 'por', (select u.nome from public.plt_usuarios u where u.id = v_ent.usuario_id),
      'registrada_em', v_ent.registrado_em,
      'correcao', (select jsonb_build_object(
                            'em', k.ocorrido_em,
                            'por', (select u.nome from public.plt_usuarios u where u.id = k.usuario_id),
                            'antes', k.dados ->> 'antes', 'depois', k.dados ->> 'depois',
                            'motivo', k.dados ->> 'motivo')
                     from public.plt_eventos k
                    where k.evento_referencia_id = v_ent.id and k.tipo = 'entrega_dia_corrigido'
                    order by k.id desc
                    limit 1),
      'por_gente', v_ent.usuario_id is not null, 'observacao', v_ent.observacao,
      'fonte', coalesce(v_ent.dados ->> 'fonte', case when v_ent.usuario_id is null then 'tiny' else 'plataforma' end),
      -- SESSAO-41 (D-195): a entrega parcial
      'parcial', coalesce((v_ent.dados ->> 'parcial')::boolean, false),
      'pecas_entregues', jsonb_array_length(coalesce(v_ent.dados -> 'entregues', '[]'::jsonb)),
      'pecas_voltaram', jsonb_array_length(coalesce(v_ent.dados -> 'voltaram', '[]'::jsonb))) end,
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
                'seq', i.seq, 'codigo', i.codigo, 'descricao', i.descricao, 'unidade', i.unidade,
                'quantidade', i.quantidade, 'valor_unitario', i.valor_unitario,
                'valor_total', round(coalesce(i.quantidade, 0) * coalesce(i.valor_unitario, 0), 2),
                'unidades_producao', coalesce(v.unidades, 0), 'eh_frete', coalesce(v.eh_frete, false)) order by i.seq)
              from public.pedido_itens i
              left join plt_privado.vw_itens_producao v on v.pedido_id = i.pedido_id and v.seq = i.seq
             where i.pedido_id = v_p.id), '[]'::jsonb),
    'unidades', coalesce((select jsonb_agg(jsonb_build_object(
                'card_id', u.id, 'descricao', u.item_descricao, 'indice', u.indice_unidade, 'total', u.total_unidades,
                'setor', s.nome, 'etapa', e.nome, 'desde', u.desde, 'concluido_em', u.concluido_em,
                'qualidade', u.qualidade_atual, 'arquivado_em', u.arquivado_em,
                'motivo_saida', (select a.dados ->> 'motivo' from public.plt_eventos a
                                  where a.card_id = u.id and a.tipo = 'card_arquivado' order by a.id desc limit 1))
                order by u.item_seq, u.indice_unidade)
              from public.plt_cards u
              left join public.plt_setores s on s.id = u.setor_atual_id
              left join public.plt_etapas e on e.id = u.etapa_atual_id
             where u.tipo = 'unidade' and u.pedido_id = v_p.id), '[]'::jsonb),
    'contas_receber', coalesce((select jsonb_agg(jsonb_build_object(
                'vencimento', cr.data_vencimento, 'valor', cr.valor, 'saldo', cr.saldo, 'situacao', cr.situacao,
                'liquidacao', cr.data_liquidacao, 'forma', cr.forma_recebimento, 'meio', cr.meio_recebimento,
                'historico', cr.historico) order by cr.data_vencimento)
              from public.contas_receber cr where cr.pedido_id = v_p.id), '[]'::jsonb),
    -- ↪️ D-122: "conferidas em" = a última busca das contas no Tiny (a conferência
    -- diária; antes dela, a carga do histórico) — pelo índice da fila (recurso,
    -- chave): a 1ª página da busca, uma linha; só sem ela (antes da 1ª rodada ou
    -- no meio de uma) as poucas linhas da busca — nunca a tabela de contas (Lei §6)
    'contas_receber_ate', coalesce(
       (select f.processado_em from public.tiny_fila f
         where f.recurso = 'cr_pesquisa' and f.chave = 'pente-fino-cr:p1' and f.status = 'ok'),
       (select max(f.processado_em) from public.tiny_fila f
         where f.recurso = 'cr_pesquisa' and f.status = 'ok')),
    'notas_fiscais', coalesce((select jsonb_agg(jsonb_build_object(
                'numero', nf.numero, 'serie', nf.serie, 'emissao', nf.data_emissao,
                'situacao', coalesce(nf.descricao_situacao, nf.situacao), 'valor', nf.valor_nota) order by nf.data_emissao)
              from public.notas_fiscais nf where nf.pedido_id = v_p.id), '[]'::jsonb),
    'anexos', case when v_card.id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object(
                'id', a.id, 'tipo', a.tipo, 'nome', a.nome_arquivo, 'mime', a.mime, 'tamanho', a.tamanho,
                'caminho', a.caminho, 'por', u.nome, 'em', a.enviado_em) order by a.enviado_em desc)
              from public.plt_anexos a left join public.plt_usuarios u on u.id = a.enviado_por
             where a.card_id = v_card.id and a.removido_em is null), '[]'::jsonb) end,
    'historico', case when v_card.id is null then '[]'::jsonb else coalesce((select jsonb_agg(h order by (h ->> 'id')::bigint desc) from (
                select jsonb_build_object(
                  'id', ev.id, 'tipo', ev.tipo, 'em', ev.ocorrido_em, 'por', u.nome, 'origem', ev.origem,
                  -- SESSAO-47: quando o fato foi gravado (a entrega marcada num dia passado)
                  'registrado_em', ev.registrado_em,
                  'observacao', ev.observacao, 'motivo', ev.dados ->> 'motivo',
                  'setor', (select s.nome from public.plt_setores s where s.id = ev.setor_destino_id)) as h
                  from public.plt_eventos ev
                  left join public.plt_usuarios u on u.id = ev.usuario_id
                 where ev.card_id = v_card.id
                 order by ev.id desc
                 limit 80) z), '[]'::jsonb) end
  )
  -- SESSAO-50 (bloco C): o endereço alterado na plataforma — o selo da ficha, com o
  -- original do Tiny ao lado (a chave só nasce quando há — E-237)
  || coalesce((select jsonb_build_object('endereco_plataforma', jsonb_build_object(
                        'em', pe.definido_em,
                        'por', (select u.nome from public.plt_usuarios u where u.id = pe.definido_por),
                        'escolha', pe.escolha, 'tiny_confirmado_em', pe.tiny_confirmado_em,
                        'original', pe.tiny_original))
                 from public.plt_pedido_enderecos pe where pe.pedido_id = v_p.id), '{}'::jsonb);
end;
$function$;

create or replace function public.plt_fn_programacao_candidatos(
  p_busca text default null,
  p_estado text default null,
  p_cidade text default null,
  p_bairro text default null,
  p_previsao text default null,
  p_ordem text default null,
  p_limite integer default 200
)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with base as (
    -- o MESMO conjunto de plt_fn_programacao(…, p_so_sem_programacao => true)
    select v.card_id,
           v.pedido_id,
           v.numero,
           coalesce(c.nome, '')         as cliente_nome,
           ee.endereco,
           ee.numero                     as numero_endereco,
           ee.complemento,
           ee.bairro,
           ee.cidade,
           ee.uf,
           plt_privado.fn_endereco_geocodificavel(
             ee.endereco, ee.numero, ee.bairro, ee.cidade, ee.uf, ee.cep) as endereco_geocodificavel,
           v.total_unidades,
           coalesce(i.itens, '[]'::jsonb) as itens,
           i.descricoes,
           v.data_prevista,
           p.data_pedido,
           v.lancado_rotas_em            as lancado_em,
           v.estado,
           v.unidades_prontas,
           v.unidades_liberadas,
           -- as chaves dos filtros e da ordem (sem acento, minúscula)
           plt_privado.fn_nome_comparavel(ee.cidade) as cidade_chave,
           plt_privado.fn_nome_comparavel(ee.bairro) as bairro_chave,
           lower(translate(coalesce(c.nome, ''),
                           'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
                           'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')) as cliente_ordem
      from plt_privado.vw_pedidos_para_rota v
      join public.pedidos p on p.id = v.pedido_id
      left join public.clientes c on c.id = v.cliente_id
      left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = v.pedido_id
      left join lateral (
        -- D-63: frete não conta nem aparece; os móveis com a quantidade.
        select jsonb_agg(jsonb_build_object('descricao', coalesce(nullif(btrim(it.descricao), ''), 'Item sem descrição'),
                                            'quantidade', it.unidades) order by it.seq)
                 filter (where not it.eh_frete and it.unidades > 0) as itens,
               string_agg(it.descricao, '|') filter (where not it.eh_frete and it.unidades > 0) as descricoes
          from plt_privado.vw_itens_producao it where it.pedido_id = v.pedido_id
      ) i on true
     where v.programacao_data is null
       and plt_privado.fn_pode_ver_expedicao()
  ),
  -- o dia de hoje na fábrica (Natal, sem horário de verão); a semana é a do
  -- calendário da Programação: domingo a sábado
  dia as (
    select d.hoje,
           d.hoje - extract(dow from d.hoje)::int as domingo
      from (select (now() at time zone 'America/Fortaleza')::date as hoje) d
  ),
  -- o texto da busca como nos quadros (SESSAO-40): só dígitos (ou "pedido N",
  -- "#N") = o número que começa com; senão o nome que contém, sem acento
  f as (select * from plt_privado.fn_filtro_do_quadro(p_busca)),
  filtro as (
    select nullif(plt_privado.fn_nome_comparavel(p_cidade), '') as cidade,
           nullif(plt_privado.fn_nome_comparavel(p_bairro), '') as bairro
  ),
  filtrados as (
    select b.*
      from base b, dia, f, filtro fl
     where (p_estado is null or b.estado = p_estado)
       and (fl.cidade is null or b.cidade_chave = fl.cidade)
       and (fl.bairro is null or b.bairro_chave = fl.bairro)
       and (case p_previsao
              when 'atrasados' then b.data_prevista < dia.hoje
              when 'hoje'      then b.data_prevista = dia.hoje
              when 'semana'    then b.data_prevista between dia.domingo and dia.domingo + 6
              when 'quinze'    then b.data_prevista between dia.hoje and dia.hoje + 14
              when 'sem'       then b.data_prevista is null
              else true
            end)
       and (not f.ativo
            or (f.numero is not null and b.numero::text like f.numero || '%')
            or (f.nome is not null
                and plt_privado.fn_nome_comparavel(
                      concat_ws('|', b.cliente_nome, b.endereco, b.bairro, b.cidade, b.descricoes))
                    like '%' || f.nome || '%'))
  ),
  pagina as (
    select x.*, row_number() over (order by
             -- cliente de A a Z / de Z a A (o pedido sem cliente vai para o fim)
             case when p_ordem in ('cliente_az', 'cliente_za') then x.cliente_ordem = '' end,
             case when p_ordem = 'cliente_az' then x.cliente_ordem end asc,
             case when p_ordem = 'cliente_za' then x.cliente_ordem end desc,
             -- mais peças primeiro
             case when p_ordem = 'pecas' then x.total_unidades end desc,
             -- pela data do pedido (sem data, no fim)
             case when p_ordem = 'mais_novo' then x.data_pedido end desc nulls last,
             case when p_ordem = 'mais_novo' then x.numero end desc,
             case when p_ordem = 'mais_antigo' then x.data_pedido end asc nulls last,
             case when p_ordem = 'numero' then x.numero end asc,
             -- o de sempre (e o desempate): o dia de entrega mais perto
             x.data_prevista asc nulls last,
             x.numero) as posicao
      from filtrados x
     order by posicao
     limit least(greatest(coalesce(p_limite, 200), 1), 200)
  )
  select jsonb_build_object(
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
               'card_id', pg.card_id,
               'pedido_id', pg.pedido_id,
               'numero', pg.numero,
               'cliente_nome', pg.cliente_nome,
               'endereco', pg.endereco,
               'numero_endereco', pg.numero_endereco,
               'complemento', pg.complemento,
               'bairro', pg.bairro,
               'cidade', pg.cidade,
               'uf', pg.uf,
               'endereco_geocodificavel', pg.endereco_geocodificavel,
               'geo_chave', case when pg.endereco_geocodificavel is null then null
                                 else md5(lower(pg.endereco_geocodificavel)) end,
               'latitude', g.latitude,
               'longitude', g.longitude,
               'geo_resolvido', g.resolvido,
               'geo_consultado_em', g.consultado_em,
               'total_unidades', pg.total_unidades,
               'itens', pg.itens,
               'data_prevista', pg.data_prevista,
               'data_pedido', pg.data_pedido,
               'lancado_em', pg.lancado_em,
               'programacao_data', null,
               'caminhao_id', null,
               'caminhao_nome', null,
               'ordem', null,
               'estado', pg.estado,
               'unidades_prontas', pg.unidades_prontas,
               'unidades_liberadas', pg.unidades_liberadas
             )
             -- SESSAO-50 (bloco C): o endereço alterado na plataforma — o selo do cartão,
             -- com o original do Tiny ao lado (a chave só nasce quando há — E-237)
             || case when pe.pedido_id is null then '{}'::jsonb
                     else jsonb_build_object('endereco_plataforma', jsonb_build_object(
                            'original', pe.tiny_original, 'tiny_confirmado_em', pe.tiny_confirmado_em)) end
             order by pg.posicao)
        from pagina pg
        left join public.plt_geocache g
               on pg.endereco_geocodificavel is not null
              and g.chave = md5(lower(pg.endereco_geocodificavel))
        -- SESSAO-50 (bloco C): só as linhas da página (até 200), pela chave
        left join public.plt_pedido_enderecos pe on pe.pedido_id = pg.pedido_id
    ), '[]'::jsonb),
    'total', (select count(*) from filtrados),
    'total_geral', (select count(*) from base),
    -- quantos há de cada (sobre TODOS os sem programação — as opções não somem)
    'contagens', (
      select jsonb_build_object(
               'pronto',      count(*) filter (where b.estado = 'pronto'),
               'em_producao', count(*) filter (where b.estado = 'em_producao'),
               'no_pcp',      count(*) filter (where b.estado = 'no_pcp'),
               'atrasados',   count(*) filter (where b.data_prevista < dia.hoje),
               'hoje',        count(*) filter (where b.data_prevista = dia.hoje),
               'semana',      count(*) filter (where b.data_prevista between dia.domingo and dia.domingo + 6),
               'quinze',      count(*) filter (where b.data_prevista between dia.hoje and dia.hoje + 14),
               'sem',         count(*) filter (where b.data_prevista is null))
        from base b, dia
    ),
    -- as cidades dos pedidos (a grafia mais comum de cada uma)
    'cidades', coalesce((
      select jsonb_agg(jsonb_build_object('cidade', c.cidade, 'uf', c.uf, 'n', c.n)
                       order by c.n desc, c.cidade)
        from (select mode() within group (order by b.cidade) as cidade,
                     mode() within group (order by b.uf) as uf,
                     count(*) as n
                from base b
               where b.cidade_chave <> ''
               group by b.cidade_chave) c
    ), '[]'::jsonb),
    -- os bairros (da cidade escolhida, ou de todas — cada um com a sua cidade)
    'bairros', coalesce((
      select jsonb_agg(jsonb_build_object('bairro', x.bairro, 'cidade', x.cidade, 'n', x.n)
                       order by x.bairro_ordem, x.cidade)
        from (select mode() within group (order by b.bairro) as bairro,
                     mode() within group (order by b.cidade) as cidade,
                     min(b.bairro_chave) as bairro_ordem,
                     count(*) as n
                from base b, filtro fl
               where b.bairro_chave <> ''
                 and (fl.cidade is null or b.cidade_chave = fl.cidade)
               group by b.cidade_chave, b.bairro_chave
               order by min(b.bairro_chave)
               limit 300) x
    ), '[]'::jsonb)
  );
$function$;
