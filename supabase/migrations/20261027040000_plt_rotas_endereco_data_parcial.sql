-- ============================================================================
-- SESSAO-41 · F4 e F6 (D-193…D-195) — as rotas e o pedido (pedido do dono,
-- 26–27/10/2026, com o vídeo do pedido 13660):
--
--   F6a · O ENDEREÇO DE ENTREGA: "o que importa para a logística é o endereço
--         de entrega e não o endereço de cadastro… quando não tiver endereço
--         diferente do endereço do cadastro você usa esse endereço; caso tenha
--         endereço de entrega você usa esse endereço". O Tiny já manda o
--         endereço de entrega em pedidos.endereco_entrega (191 pedidos) — agora
--         toda tela da logística o usa, INTEIRO (rua, número, bairro, cidade…;
--         nunca misturado com o do cadastro). Um dono só: vw_endereco_entrega.
--   F6b · A DATA DE ENTREGA mudada (ou removida) na plataforma: "isso não deve
--         afetar o Tiny, apenas a plataforma; porém se mudar no Tiny, muda na
--         plataforma também". A mudança guarda a data do Tiny daquele momento;
--         se o Tiny mudar a data depois, a da plataforma deixa de valer sozinha
--         (derivado, sem gatilho na integração). Um dono só: fn_data_entrega.
--   F4  · A ENTREGA PARCIAL: o entregador (ou a logística) marca quais peças
--         foram entregues, com um motivo da lista (Utilitários) e/ou uma
--         observação; o pedido fica "entregue em parte" e as peças que voltaram
--         vão para "Em decisão pós devolução" — a mesma telinha "Decidir
--         situação" da devolução (reenviar, estoque, realocar, danificados,
--         loja, ajuste). O Tiny NÃO muda (resposta 3 do dono).
--
-- Funções recriadas por EXTRAÇÃO da versão viva (pg_get_functiondef em 27/10),
-- com trocas de texto conferidas uma a uma. Nada aqui altera tabela da
-- integração (pedidos e clientes só são LIDOS).
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Tipos novos: o motivo da entrega parcial (lista em Utilitários) e o fato
--     da data de entrega alterada (a linha do tempo do pedido)
-- ----------------------------------------------------------------------------
alter table public.plt_motivos drop constraint if exists plt_motivos_tipo_ck;
alter table public.plt_motivos add constraint plt_motivos_tipo_ck
  check (tipo in ('nao_entregue', 'desfazer_entrega', 'devolucao', 'pausa', 'saida', 'standby', 'mover',
                  'entrega_parcial')) not valid;
alter table public.plt_motivos validate constraint plt_motivos_tipo_ck;

insert into public.plt_motivos (tipo, texto, ordem) values
  ('entrega_parcial', 'Cliente recusou um dos móveis', 10),
  ('entrega_parcial', 'Móvel chegou avariado', 20),
  ('entrega_parcial', 'Não coube no local', 30),
  ('entrega_parcial', 'Cliente pediu para entregar depois', 40),
  ('entrega_parcial', 'Faltou volume no caminhão', 50)
on conflict (tipo, lower(btrim(texto))) do nothing;

alter table public.plt_eventos drop constraint if exists plt_eventos_tipo_check;
alter table public.plt_eventos add constraint plt_eventos_tipo_check check (tipo = any (array[
  'card_criado', 'movimentacao_setor', 'movimentacao_etapa', 'execucao_iniciada', 'execucao_finalizada',
  'execucao_pausada', 'execucao_retomada', 'qualidade_marcada', 'qualidade_parecer', 'divergencia_registrada',
  'notificacao_enviada', 'delegacao', 'estorno', 'pedido_atualizado', 'pedido_cancelado', 'card_arquivado',
  'pedido_entregue', 'pedido_lancado_rotas', 'unidade_desvinculada', 'peca_alocada', 'peca_reservada',
  'peca_reserva_desfeita', 'estoque_reserva_avaliada', 'etiqueta_adicionada', 'etiqueta_removida',
  'card_desarquivado', 'entrega_desfeita', 'entrega_nao_realizada', 'pedido_devolvido', 'comentario_adicionado',
  'anexo_adicionado', 'devolucao_decidida', 'ajuste_aberto', 'ajuste_concluido', 'avulso_concluido',
  'card_editado', 'responsavel_adicionado', 'responsavel_removido', 'anexo_removido', 'comentario_editado',
  'comentario_apagado', 'auxilio_iniciado', 'auxilio_pausado', 'auxilio_retomado', 'auxilio_encerrado',
  'prioridade_definida', 'responsavel_setor_definido', 'pedido_standby_entrou', 'pedido_standby_saiu',
  'data_entrega_alterada'
]::text[])) not valid;
alter table public.plt_eventos validate constraint plt_eventos_tipo_check;

-- ----------------------------------------------------------------------------
-- 2 · O endereço de entrega (F6a): um dono só para "onde entregar"
-- ----------------------------------------------------------------------------
create or replace view plt_privado.vw_endereco_entrega as
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

comment on view plt_privado.vw_endereco_entrega is
  'SESSAO-41 (D-193, o vídeo do pedido 13660): ONDE ENTREGAR — o endereço de entrega do pedido no Tiny (pedidos.endereco_entrega), inteiro, quando existe; senão, o endereço do cadastro do cliente. de_entrega = veio do endereço de entrega. Toda porta da logística lê daqui.';

revoke all on plt_privado.vw_endereco_entrega from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3 · A data de entrega da plataforma (F6b)
-- ----------------------------------------------------------------------------
create table if not exists public.plt_pedido_datas (
  pedido_id    bigint primary key references public.pedidos(id) on delete cascade,
  -- a data da plataforma; NULA = a data foi removida na plataforma
  data         date,
  -- a data do Tiny quando a da plataforma foi definida: o Tiny mudou depois,
  -- esta linha deixa de valer (vale a do Tiny de novo)
  tiny_data    date,
  definido_por uuid references public.plt_usuarios(id),
  definido_em  timestamptz not null default now()
);

comment on table public.plt_pedido_datas is
  'SESSAO-41 (D-194): a data de entrega mudada (ou removida — data nula) NA PLATAFORMA, sem mexer no Tiny. Vale enquanto o Tiny continuar com tiny_data; o Tiny mudou a data → vale a do Tiny (derivado em fn_data_entrega). A história fica no fato data_entrega_alterada do card do pedido. Escrita só pela porta plt_fn_pedido_data_entrega.';

create index if not exists plt_pedido_datas_definido_por_idx on public.plt_pedido_datas (definido_por)
  where definido_por is not null;

alter table public.plt_pedido_datas enable row level security;
revoke all on public.plt_pedido_datas from anon, authenticated, public;

create or replace function plt_privado.fn_data_entrega(p_pedido_id bigint, p_data_tiny date)
returns date
language sql
stable
parallel safe
as $$
  select case when d.pedido_id is null then p_data_tiny else d.data end
    from (select 1) um
    left join public.plt_pedido_datas d
           on d.pedido_id = p_pedido_id and d.tiny_data is not distinct from p_data_tiny;
$$;

comment on function plt_privado.fn_data_entrega(bigint, date) is
  'SESSAO-41 (D-194): a data de entrega que vale — a da plataforma (mudada ou removida) enquanto o Tiny continuar com a data daquele momento; senão, a do Tiny.';

revoke all on function plt_privado.fn_data_entrega(bigint, date) from public, anon, authenticated;

create or replace function public.plt_fn_pedido_data_entrega(
  p_pedido_id bigint,
  p_data      date,
  p_remover   boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_p      public.pedidos%rowtype;
  v_card   bigint;
  v_antes  date;
  v_nova   date;
  v_s      bigint;
begin
  if v_eu is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Mudar a data de entrega é gesto da logística, do PCP ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_p from public.pedidos where id = p_pedido_id;
  if v_p.id is null then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  if not coalesce(p_remover, false) and p_data is null then
    raise exception 'Escolha a nova data (ou remova a data).' using errcode = 'check_violation';
  end if;
  if not coalesce(p_remover, false) and (p_data < current_date - 365 or p_data > current_date + 730) then
    raise exception 'Essa data está longe demais — confira o dia, o mês e o ano.' using errcode = 'check_violation';
  end if;
  -- a linha que o Tiny já venceu (ele mudou a data depois) não vale mais: sai
  delete from public.plt_pedido_datas where pedido_id = v_p.id and tiny_data is distinct from v_p.data_prevista;
  v_antes := plt_privado.fn_data_entrega(v_p.id, v_p.data_prevista);
  v_nova := case when coalesce(p_remover, false) then null else p_data end;
  if v_nova is not distinct from v_antes then
    return jsonb_build_object('data', v_nova, 'mudou', false, 'data_tiny', v_p.data_prevista);
  end if;

  if v_nova is not distinct from v_p.data_prevista then
    -- voltou à data do Tiny: a da plataforma sai
    delete from public.plt_pedido_datas where pedido_id = v_p.id;
  else
    insert into public.plt_pedido_datas as d (pedido_id, data, tiny_data, definido_por, definido_em)
      values (v_p.id, v_nova, v_p.data_prevista, v_eu, now())
      on conflict (pedido_id) do update
        set data = excluded.data, tiny_data = excluded.tiny_data,
            definido_por = excluded.definido_por, definido_em = excluded.definido_em;
  end if;

  select pc.id into v_card from public.plt_cards pc
   where pc.pedido_id = v_p.id and pc.tipo = 'pedido'
   order by pc.arquivado_em nulls first, pc.id desc limit 1;
  if v_card is not null then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (v_card, 'data_entrega_alterada', v_eu, 'interface',
              case when v_nova is null then 'Data de entrega removida na plataforma (o Tiny não muda).'
                   else 'Data de entrega mudada na plataforma para ' || to_char(v_nova, 'DD/MM/YYYY') || ' (o Tiny não muda).' end,
              jsonb_build_object('antes', v_antes, 'depois', v_nova, 'data_tiny', v_p.data_prevista,
                                 'numero', v_p.numero));
  end if;

  -- as telas ao vivo: rotas, PCP, painel e o quadro de cada setor com peça do pedido
  perform plt_privado.fn_avisar('rotas');
  perform plt_privado.fn_avisar('pcp');
  perform plt_privado.fn_avisar('painel');
  for v_s in
    select distinct u.setor_atual_id from public.plt_cards u
     where u.pedido_id = v_p.id and u.tipo = 'unidade' and u.arquivado_em is null and u.setor_atual_id is not null
  loop
    perform plt_privado.fn_avisar_setor(v_s);
  end loop;

  return jsonb_build_object('data', v_nova, 'mudou', true, 'data_tiny', v_p.data_prevista);
end;
$$;

comment on function public.plt_fn_pedido_data_entrega(bigint, date, boolean) is
  'SESSAO-41 (D-194): a logística/PCP/admin muda (ou remove — p_remover) a data de entrega do pedido SÓ na plataforma; o Tiny não muda; se o Tiny mudar a data depois, vale a do Tiny. Voltar à data do Tiny apaga a da plataforma. Fica o fato data_entrega_alterada.';

revoke all on function public.plt_fn_pedido_data_entrega(bigint, date, boolean) from public, anon;
grant execute on function public.plt_fn_pedido_data_entrega(bigint, date, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 4 · As visões que muitas portas leem: a data que vale (o mesmo nome de
--     coluna — Expedição, Programação, calendário e a ordem da fila herdam)
-- ----------------------------------------------------------------------------
create or replace view plt_privado.vw_pedidos_vivos_regra as
 SELECT pc.id AS card_id,
    p.id AS pedido_id,
    p.numero,
    p.cliente_id,
    CASE WHEN pdx.pedido_id IS NULL THEN p.data_prevista ELSE pdx.data END AS data_prevista,
    p.situacao,
    pc.lancado_rotas_em,
    pc.devolucao_evento_id,
    pr.data_entrega AS programacao_data,
    pr.caminhao_id,
    pr.rota::integer AS rota,
    pr.ordem,
    pr.detalhe
   FROM plt_cards pc
     JOIN pedidos p ON p.id = pc.pedido_id
     LEFT JOIN plt_pedido_datas pdx ON pdx.pedido_id = p.id AND pdx.tiny_data IS NOT DISTINCT FROM p.data_prevista
     LEFT JOIN plt_programacoes pr ON pr.card_id = pc.id
  WHERE pc.tipo = 'pedido'::text AND pc.arquivado_em IS NULL AND pc.entrega_evento_id IS NULL AND (plt_privado.fn_situacao_normalizada(p.situacao) <> ALL (ARRAY['entregue'::text, 'nao_entregue'::text, 'cancelado'::text])) AND (NOT plt_privado.fn_tiny_tirou_do_pcp(p.situacao) OR (EXISTS ( SELECT 1
           FROM plt_cards cu
          WHERE cu.pedido_id = p.id AND cu.tipo = 'unidade'::text AND cu.arquivado_em IS NULL))) AND NOT (EXISTS ( SELECT 1
           FROM plt_pedidos_excluidos_tiny x
          WHERE x.pedido_id = p.id));

create or replace view plt_privado.vw_card_ordem as
 SELECT c.id,
    c.tipo,
    c.setor_atual_id,
    c.etapa_atual_id,
    c.arquivado_em,
    c.desde,
    x.prioridade,
    x.prioridade_herdada,
    x.data_entrega,
    p.numero AS pedido_numero,
        CASE x.prioridade
            WHEN 'urgente'::text THEN 0
            WHEN 'atencao'::text THEN 1
            ELSE 2
        END AS rank_prioridade,
        CASE
            WHEN x.prioridade = 'urgente'::text THEN 0
            ELSE 1
        END AS rank_urgente,
    to_char(COALESCE(x.data_entrega, '9999-12-31'::date)::timestamp with time zone, 'YYYYMMDD'::text) AS chave_entrega,
        CASE
            WHEN n.nome ~ '^[a-z]'::text THEN '0'::text
            WHEN n.nome ~ '^[0-9]'::text THEN '1'::text
            ELSE '2'::text
        END || n.nome AS chave_nome
   FROM plt_cards c
     LEFT JOIN pedidos p ON p.id = c.pedido_id
     LEFT JOIN plt_pedido_datas pdx ON pdx.pedido_id = p.id AND pdx.tiny_data IS NOT DISTINCT FROM p.data_prevista
     LEFT JOIN plt_cards pc ON c.tipo = 'unidade'::text AND pc.pedido_id = c.pedido_id AND pc.tipo = 'pedido'::text
     LEFT JOIN plt_cards rp ON c.tipo = 'unidade'::text AND c.pedido_id IS NULL AND rp.id = c.card_pai_id AND rp.tipo = 'reposicao'::text
     CROSS JOIN LATERAL ( SELECT
                CASE
                    WHEN c.tipo = 'unidade'::text THEN COALESCE(pc.prioridade, rp.prioridade)
                    ELSE c.prioridade
                END AS prioridade,
            c.tipo = 'unidade'::text AS prioridade_herdada,
                CASE
                    WHEN c.tipo = 'avulso'::text THEN c.vence_em
                    WHEN pdx.pedido_id IS NOT NULL THEN pdx.data
                    ELSE p.data_prevista
                END AS data_entrega) x
     CROSS JOIN LATERAL ( SELECT lower(translate(btrim(COALESCE(
                CASE
                    WHEN c.tipo = 'avulso'::text THEN c.titulo
                    ELSE c.item_descricao
                END, ''::text)), 'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ'::text, 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'::text)) AS nome) n;

-- ----------------------------------------------------------------------------
-- 5 · A ENTREGA PARCIAL (F4)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_entrega_parcial(
  p_card_id              bigint,
  p_entregues            bigint[],
  p_motivo_id            bigint default null,
  p_observacao           text default null,
  p_confirmar_incompleto boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario  uuid;
  v_card     public.plt_cards%rowtype;
  v_numero   integer;
  v_motivo   text;
  v_obs      text;
  v_vivas    bigint[];
  v_entregue bigint[];
  v_voltou   bigint[];
  v_prontas  integer;
  v_entrega  bigint;
  v_dev      bigint;
  v_evento   bigint;
  v_marca_e  text;
  v_marca_d  text;
  v_tempos   integer := 0;
  v_avisados integer;
  r          record;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma registra entrega.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_mexer_entrega(p_card_id) then
    raise exception 'Registrar entrega é gesto da logística (PCP/terminais), do entregador do caminhão ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  select p.numero into v_numero from public.pedidos p where p.id = v_card.pedido_id;

  -- Lei §10: o mesmo toque repetido (a rede que volta) = uma entrega só
  if v_card.entrega_evento_id is not null then
    if exists (select 1 from public.plt_eventos e
                where e.id = v_card.entrega_evento_id and e.usuario_id = v_usuario
                  and coalesce((e.dados ->> 'parcial')::boolean, false)
                  and e.ocorrido_em > now() - interval '10 minutes') then
      return jsonb_build_object('entrega_evento_id', v_card.entrega_evento_id, 'repetido', true);
    end if;
    raise exception 'Este pedido já foi registrado como entregue.' using errcode = 'check_violation';
  end if;
  if v_card.devolucao_evento_id is not null then
    raise exception 'Este pedido está em decisão pós devolução — decida a situação das peças antes de entregar.'
      using errcode = 'check_violation';
  end if;
  if plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
    raise exception 'Este pedido foi cancelado no Tiny — não se entrega.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.plt_cards s where s.reservada_pedido_id = v_card.pedido_id and s.arquivado_em is null) then
    raise exception 'Este pedido leva peça reservada do estoque — a entrega parcial dele é com a logística (use Entregue ou Pedido devolvido).'
      using errcode = 'check_violation';
  end if;

  -- o motivo (da lista) e/ou a observação — pelo menos um dos dois
  if p_motivo_id is not null then
    select m.texto into v_motivo from public.plt_motivos m
     where m.id = p_motivo_id and m.tipo = 'entrega_parcial' and m.ativo;
    if v_motivo is null then
      raise exception 'Esse motivo não vale para entrega parcial.' using errcode = 'check_violation';
    end if;
  end if;
  v_obs := nullif(btrim(coalesce(p_observacao, '')), '');
  if v_motivo is null and v_obs is null then
    raise exception 'Diga por que a entrega foi parcial: escolha um motivo ou escreva uma observação.'
      using errcode = 'check_violation';
  end if;

  -- as peças vivas do pedido (as que estão para entregar)
  select array_agg(u.id order by u.id) into v_vivas
    from public.plt_cards u
   where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null;
  select array_agg(x order by x) into v_entregue
    from unnest(coalesce(p_entregues, '{}'::bigint[])) x where x = any (coalesce(v_vivas, '{}'::bigint[]));
  if v_entregue is null then
    raise exception 'Marque o que foi entregue (para nada entregue, use "Não entregue").' using errcode = 'check_violation';
  end if;
  select array_agg(x order by x) into v_voltou
    from unnest(v_vivas) x where not (x = any (v_entregue));
  if v_voltou is null then
    raise exception 'Todas as peças foram marcadas como entregues — use "Entregue".' using errcode = 'check_violation';
  end if;

  -- a plataforma pode estar atrasada (a peça não foi arrastada): pede a
  -- confirmação, como no "Entregue" (↩️ D-156)
  select count(*)::int into v_prontas
    from public.plt_cards cu
    join public.plt_setores s on s.id = cu.setor_atual_id
   where cu.id = any (v_vivas) and s.papel_no_fluxo = 'terminal' and s.codigo <> 'devolucao';
  if v_prontas < array_length(v_vivas, 1) and not coalesce(p_confirmar_incompleto, false) then
    raise exception 'Este pedido ainda aparece em produção na fábrica (% de % peças prontas). Confirmar a entrega encerra tudo dele.', v_prontas, array_length(v_vivas, 1)
      using errcode = 'check_violation';
  end if;

  select s.id into v_dev from public.plt_setores s where s.codigo = 'devolucao';
  if v_dev is null then
    raise exception 'O lugar "Em decisão pós devolução" não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  v_marca_e := current_setting('plt.entrega_maquinaria', true);
  v_marca_d := current_setting('plt.devolucao_maquinaria', true);
  perform set_config('plt.entrega_maquinaria', 'on', true);
  perform set_config('plt.devolucao_maquinaria', 'on', true);

  -- (1) a entrega — do pedido, marcada PARCIAL (o Tiny não é chamado)
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_card.id, 'pedido_entregue', v_usuario, 'interface',
            concat_ws(' — ', 'Entrega parcial: ' || array_length(v_entregue, 1) || ' de ' || array_length(v_vivas, 1) || ' peça(s)',
                      v_motivo, v_obs),
            jsonb_build_object('fonte', 'plataforma', 'numero', v_numero, 'parcial', true,
                               'entregues', to_jsonb(v_entregue), 'voltaram', to_jsonb(v_voltou),
                               'unidades', array_length(v_vivas, 1), 'prontas', v_prontas,
                               'motivo_id', p_motivo_id, 'motivo', v_motivo, 'observacao', v_obs,
                               'lancado_rotas', v_card.lancado_rotas_em is not null))
    returning id into v_entrega;

  -- (2) as peças entregues saem de toda conta — o tempo aberto fecha antes
  for r in select c.id from public.plt_cards c where c.id = any (v_entregue) order by c.id for update
  loop
    if plt_privado.fn_fechar_tempo_aberto(r.id, 'O pedido foi entregue: o tempo aberto fecha antes de a peça sair.') then
      v_tempos := v_tempos + 1;
    end if;
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (r.id, 'card_arquivado', v_usuario, 'interface',
              'Pedido ' || coalesce(v_numero::text, '') || ' entregue em parte — a peça foi entregue.',
              jsonb_build_object('motivo', 'entregue', 'entrega_evento_id', v_entrega,
                                 'parcial', true, 'fonte', 'plataforma', 'numero', v_numero));
  end loop;

  -- (3) as que voltaram: "Em decisão pós devolução" — a logística decide (D-129)
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_card.id, 'pedido_devolvido', v_usuario, 'interface',
            'Voltou da entrega parcial' || coalesce(' — ' || v_motivo, '') || coalesce(' — ' || v_obs, ''),
            jsonb_build_object('fonte', 'plataforma', 'numero', v_numero, 'motivo_id', p_motivo_id,
                               'motivo', coalesce(v_motivo, 'Entrega parcial'), 'observacao', v_obs,
                               'entregue', true, 'entrega_evento_id', v_entrega, 'entrega_parcial', true,
                               'pecas', to_jsonb(v_voltou)))
    returning id into v_evento;
  for r in
    select c.id, c.setor_atual_id, c.etapa_atual_id from public.plt_cards c
     where c.id = any (v_voltou) order by c.id for update
  loop
    perform plt_privado.fn_fechar_tempo_aberto(r.id, 'A peça voltou da entrega: o tempo aberto fecha antes.');
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, setor_destino_id, observacao, dados)
      values (r.id, 'movimentacao_setor', v_usuario, 'interface', r.setor_atual_id, r.etapa_atual_id, v_dev,
              'Voltou da entrega parcial — a peça espera a decisão da logística.',
              jsonb_build_object('motivo', 'devolucao', 'devolucao_evento_id', v_evento, 'entrega_parcial', true));
  end loop;

  perform set_config('plt.entrega_maquinaria', coalesce(v_marca_e, ''), true);
  perform set_config('plt.devolucao_maquinaria', coalesce(v_marca_d, ''), true);

  v_avisados := plt_privado.fn_avisar_logistica(
    v_evento, v_card.id, 'devolucao_decidir',
    'Pedido ' || coalesce(v_numero::text, '') || ' entregue em parte — decidir a situação',
    (select u.nome from public.plt_usuarios u where u.id = v_usuario) || ' entregou o pedido '
      || coalesce(v_numero::text, '') || ' em parte (' || array_length(v_entregue, 1) || ' de '
      || array_length(v_vivas, 1) || ')' || coalesce(' — ' || v_motivo, '') || '. '
      || array_length(v_voltou, 1) || ' peça(s) voltaram e esperam a decisão em Estoque → Em decisão pós devolução.',
    v_usuario);

  return jsonb_build_object('entrega_evento_id', v_entrega, 'devolucao_evento_id', v_evento,
                            'entregues', array_length(v_entregue, 1), 'voltaram', array_length(v_voltou, 1),
                            'tempos_fechados', v_tempos, 'avisados', v_avisados);
end;
$$;

comment on function public.plt_fn_entrega_parcial(bigint, bigint[], bigint, text, boolean) is
  'SESSAO-41 (D-195): a ENTREGA PARCIAL — o entregador (ou a logística) diz quais peças foram entregues, com motivo (lista entrega_parcial) e/ou observação; o pedido fica entregue EM PARTE (pedido_entregue com dados.parcial) e as peças que voltaram vão para "Em decisão pós devolução" (pedido_devolvido com entrega_parcial) — a logística decide como numa devolução. O Tiny não muda. O mesmo toque repetido = uma entrega só.';

revoke all on function public.plt_fn_entrega_parcial(bigint, bigint[], bigint, text, boolean) from public, anon;
grant execute on function public.plt_fn_entrega_parcial(bigint, bigint[], bigint, text, boolean) to authenticated;

-- as peças do pedido para a tela da entrega parcial (só no clique — Lei §3)
create or replace function public.plt_fn_entrega_pecas(p_card_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido bigint;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_mexer_entrega(p_card_id) then
    raise exception 'Ver as peças da entrega é da logística, do entregador do caminhão ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select pc.pedido_id into v_pedido from public.plt_cards pc where pc.id = p_card_id and pc.tipo = 'pedido';
  if v_pedido is null then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', u.id, 'descricao', u.item_descricao, 'item_seq', u.item_seq,
             'indice', u.indice_unidade, 'total', u.total_unidades,
             'pronta', coalesce(s.papel_no_fluxo = 'terminal' and s.codigo <> 'devolucao', false),
             'onde', s.nome)
           order by u.item_seq, u.indice_unidade, u.id)
      from public.plt_cards u
      left join public.plt_setores s on s.id = u.setor_atual_id
     where u.pedido_id = v_pedido and u.tipo = 'unidade' and u.arquivado_em is null), '[]'::jsonb);
end;
$$;

comment on function public.plt_fn_entrega_pecas(bigint) is
  'SESSAO-41 (D-195): as peças vivas do pedido (o que está para entregar), com "pronta" (no fim de linha) — para marcar a entrega parcial. Só no clique.';

revoke all on function public.plt_fn_entrega_pecas(bigint) from public, anon;
grant execute on function public.plt_fn_entrega_pecas(bigint) to authenticated;

-- ----------------------------------------------------------------------------
-- 6 · As portas das rotas — recriadas da versão viva: o ENDEREÇO DE ENTREGA
--     (vw_endereco_entrega) e a DATA QUE VALE (fn_data_entrega); as entregas do
--     dia dizem se a entrega foi parcial; "Já programadas" devolve o endereço
--     para achar o ponto no mapa (forma nova → drop + create).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plt_fn_programacao(p_data date DEFAULT NULL::date, p_limite integer DEFAULT 100, p_deslocamento integer DEFAULT 0, p_so_sem_programacao boolean DEFAULT false)
 RETURNS TABLE(card_id bigint, pedido_id bigint, numero integer, cliente_nome text, endereco text, numero_endereco text, complemento text, bairro text, cidade text, uf text, endereco_geocodificavel text, geo_chave text, latitude double precision, longitude double precision, geo_resolvido boolean, geo_consultado_em timestamp with time zone, total_unidades integer, itens jsonb, data_prevista date, lancado_em timestamp with time zone, programacao_data date, caminhao_id bigint, caminhao_nome text, ordem integer, estado text, unidades_prontas integer, unidades_liberadas integer, contagem_total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with base as (
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
           v.data_prevista,
           v.lancado_rotas_em            as lancado_em,
           v.programacao_data,
           cam.id                        as caminhao_id,
           cam.nome                      as caminhao_nome,
           v.ordem,
           v.estado,
           v.unidades_prontas,
           v.unidades_liberadas
      from plt_privado.vw_pedidos_para_rota v
      left join public.clientes c on c.id = v.cliente_id
      left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = v.pedido_id
      left join lateral (
        -- D-63: frete não conta nem aparece; os móveis com a quantidade.
        select jsonb_agg(jsonb_build_object('descricao', coalesce(nullif(btrim(it.descricao), ''), 'Item sem descrição'),
                                            'quantidade', it.unidades) order by it.seq)
                 filter (where not it.eh_frete and it.unidades > 0) as itens
          from plt_privado.vw_itens_producao it where it.pedido_id = v.pedido_id
      ) i on true
      left join public.plt_caminhoes cam on cam.id = v.caminhao_id
     where v.programacao_data is null
        or (not coalesce(p_so_sem_programacao, false)
            and (p_data is null or v.programacao_data = p_data))
  )
  select b.card_id, b.pedido_id, b.numero, b.cliente_nome,
         b.endereco, b.numero_endereco, b.complemento, b.bairro, b.cidade, b.uf,
         b.endereco_geocodificavel,
         case when b.endereco_geocodificavel is null then null
              else md5(lower(b.endereco_geocodificavel)) end as geo_chave,
         g.latitude, g.longitude,
         g.resolvido       as geo_resolvido,
         g.consultado_em   as geo_consultado_em,
         b.total_unidades, b.itens, b.data_prevista, b.lancado_em,
         b.programacao_data, b.caminhao_id, b.caminhao_nome,
         b.ordem,
         b.estado, b.unidades_prontas, b.unidades_liberadas,
         count(*) over () as contagem_total
    from base b
    left join public.plt_geocache g
           on b.endereco_geocodificavel is not null
          and g.chave = md5(lower(b.endereco_geocodificavel))
   where plt_privado.fn_pode_ver_expedicao()
   order by (b.programacao_data is not null), b.data_prevista asc nulls last, b.numero
   limit least(greatest(coalesce(p_limite, 100), 1), 200)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$function$;

drop function if exists public.plt_fn_programadas(boolean, date, bigint, integer, integer);
CREATE OR REPLACE FUNCTION public.plt_fn_programadas(p_entregues boolean DEFAULT false, p_data date DEFAULT NULL::date, p_caminhao_id bigint DEFAULT NULL::bigint, p_limite integer DEFAULT 50, p_deslocamento integer DEFAULT 0)
 RETURNS TABLE(card_id bigint, pedido_id bigint, numero integer, cliente_nome text, endereco text, numero_endereco text, complemento text, bairro text, cidade text, uf text, geo_chave text, latitude double precision, longitude double precision, geo_resolvido boolean, endereco_geocodificavel text, geo_consultado_em timestamp with time zone, total_unidades integer, itens jsonb, data_prevista date, programacao_data date, caminhao_id bigint, caminhao_nome text, caminhao_placa text, rota integer, ordem integer, entregue_em timestamp with time zone, detalhe text, equipe text[], estado text, unidades_prontas integer, unidades_liberadas integer, contagem_total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with base as (
    select pc.id                         as card_id,
           p.id                          as pedido_id,
           p.numero,
           coalesce(c.nome, '')          as cliente_nome,
           ee.endereco,
           ee.numero                      as numero_endereco,
           ee.complemento,
           ee.bairro,
           ee.cidade,
           ee.uf,
           plt_privado.fn_endereco_geocodificavel(
             ee.endereco, ee.numero, ee.bairro, ee.cidade, ee.uf, ee.cep) as endereco_geocodificavel,
           coalesce(i.total_unidades, 0) as total_unidades,
           coalesce(i.itens, '[]'::jsonb) as itens,
           plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista,
           pr.data_entrega               as programacao_data,
           cam.id                        as caminhao_id,
           cam.nome                      as caminhao_nome,
           cam.placa                     as caminhao_placa,
           pr.rota::int                  as rota,
           pr.ordem,
           ent.ocorrido_em               as entregue_em,
           pr.detalhe,
           eq.nomes                      as equipe,
           pp.estado,
           pp.unidades_prontas,
           pp.unidades_liberadas
      from public.plt_programacoes pr
      join public.plt_cards pc on pc.id = pr.card_id
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = p.id
      left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
      left join plt_privado.vw_pedido_prontidao pp on pp.card_id = pc.id
      left join lateral (
        select e.ocorrido_em from public.plt_eventos e
         where e.id = pc.entrega_evento_id
         order by e.ocorrido_em desc limit 1
      ) ent on true
      left join lateral (
        select coalesce(sum(v.unidades), 0)::int as total_unidades,
               jsonb_agg(jsonb_build_object('descricao', coalesce(nullif(btrim(v.descricao), ''), 'Item sem descrição'),
                                            'quantidade', v.unidades) order by v.seq)
                 filter (where not v.eh_frete and v.unidades > 0) as itens
          from plt_privado.vw_itens_producao v where v.pedido_id = p.id
      ) i on true
      -- SESSAO-37 (pedido do dono, 19/10): a equipe da rota aparece no card
      left join lateral (
        select array_agg(u.nome order by u.nome) as nomes
          from public.plt_programacao_equipes pe
          join public.plt_usuarios u on u.id = pe.usuario_id
         where pe.data_entrega = pr.data_entrega
           and pe.caminhao_id = pr.caminhao_id
           and pe.rota = pr.rota
      ) eq on true
     where pc.tipo = 'pedido'
       -- SESSAO-38: o card que saiu com a entrega (pedido nunca lançado) ainda
       -- conta no histórico das entregues
       and (pc.arquivado_em is null
            or (coalesce(p_entregues, false) and pc.entrega_evento_id is not null))
       and (p_data is null or pr.data_entrega = p_data)
       and (p_caminhao_id is null or pr.caminhao_id = p_caminhao_id)
       and (case when coalesce(p_entregues, false) then ent.ocorrido_em is not null
                 else ent.ocorrido_em is null end)
  )
  select b.card_id, b.pedido_id, b.numero, b.cliente_nome,
         b.endereco, b.numero_endereco, b.complemento, b.bairro, b.cidade, b.uf,
         case when b.endereco_geocodificavel is null then null
              else md5(lower(b.endereco_geocodificavel)) end as geo_chave,
         g.latitude, g.longitude, g.resolvido as geo_resolvido,
         b.endereco_geocodificavel, g.consultado_em as geo_consultado_em,
         b.total_unidades, b.itens, b.data_prevista,
         b.programacao_data, b.caminhao_id, b.caminhao_nome, b.caminhao_placa,
         b.rota, b.ordem, b.entregue_em, b.detalhe,
         coalesce(b.equipe, '{}'::text[]) as equipe,
         b.estado, b.unidades_prontas, b.unidades_liberadas,
         count(*) over () as contagem_total
    from base b
    left join public.plt_geocache g
           on b.endereco_geocodificavel is not null
          and g.chave = md5(lower(b.endereco_geocodificavel))
   where plt_privado.fn_pode_ver_expedicao()
   order by case when coalesce(p_entregues, false) then null else b.programacao_data end asc,
            case when coalesce(p_entregues, false) then b.programacao_data end desc,
            b.caminhao_nome, b.caminhao_id, b.rota, b.ordem nulls last, b.numero
   limit least(greatest(coalesce(p_limite, 50), 1), 200)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$function$;

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
               'obs', p.obs, 'detalhe', pr.detalhe, 'data_prevista', plt_privado.fn_data_entrega(p.id, p.data_prevista),
               'itens', coalesce(i.itens, '[]'::jsonb), 'unidades', coalesce(i.unidades, 0),
               'volumes', coalesce(i.volumes, 0),
               -- SESSAO-38 (D-156): o programado pode ainda estar em produção.
               'estado', pp.estado, 'pronto', coalesce(pp.pronto, true),
               'prontas', coalesce(pp.unidades_prontas, 0), 'a_entregar', coalesce(pp.a_entregar, 0),
               'entregue_em', ent.ocorrido_em, 'entregue_por', ue.nome,
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

  return jsonb_build_object('data', v_data, 'caminhao_id', v_caminhao, 'rota', v_rota, 'caminhoes', v_caminhoes,
                            'entregas', v_entregas, 'sou_logistica', v_logistica);
end;
$function$;

CREATE OR REPLACE FUNCTION public.plt_fn_rotas(p_situacao text DEFAULT NULL::text, p_busca text DEFAULT NULL::text, p_limite integer DEFAULT 20, p_deslocamento integer DEFAULT 0)
 RETURNS TABLE(card_id bigint, pedido_id bigint, numero integer, cliente_nome text, telefone text, endereco text, numero_endereco text, complemento text, bairro text, cidade text, uf text, obs text, data_prevista date, total_unidades integer, unidades_em_rotas integer, situacao_entrega text, entregue_em timestamp with time zone, entregue_por text, lancado_em timestamp with time zone, programacao_data date, caminhao_id bigint, caminhao_nome text, caminhao_placa text, caminhao_foto text, estado text, unidades_prontas integer, unidades_liberadas integer, contagem_total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with rotas as (
    select s.id from public.plt_setores s where s.codigo = 'rotas'
  ),
  base as (
    select pc.id                        as card_id,
           p.id                         as pedido_id,
           p.numero,
           coalesce(c.nome, '')         as cliente_nome,
           c.fone                       as telefone,
           ee.endereco,
           ee.numero                     as numero_endereco,
           ee.complemento,
           ee.bairro,
           ee.cidade,
           ee.uf,
           p.obs,
           plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista,
           coalesce(pp.total_unidades, 0) as total_unidades,
           coalesce(u.em_rotas, 0)       as unidades_em_rotas,
           ent.ocorrido_em               as entregue_em,
           ent_nome.nome                 as entregue_por,
           pc.lancado_rotas_em           as lancado_em,
           pr.data_entrega               as programacao_data,
           cam.id                        as caminhao_id,
           cam.nome                      as caminhao_nome,
           cam.placa                     as caminhao_placa,
           cam.foto_caminho              as caminhao_foto,
           pp.estado,
           coalesce(pp.unidades_prontas, 0)   as unidades_prontas,
           coalesce(pp.unidades_liberadas, 0) as unidades_liberadas
      from public.plt_cards pc
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = p.id
      left join plt_privado.vw_pedido_prontidao pp on pp.card_id = pc.id
      left join plt_privado.vw_pedidos_para_rota cand on cand.card_id = pc.id
      left join lateral (
        select count(*)::int as em_rotas
          from public.plt_cards cu
         where cu.pedido_id = p.id and cu.tipo = 'unidade'
           and cu.arquivado_em is null
           and cu.setor_atual_id in (select id from rotas)
      ) u on true
      left join lateral (
        select e.ocorrido_em, e.usuario_id
          from public.plt_eventos e
         where e.id = pc.entrega_evento_id
         order by e.ocorrido_em desc limit 1
      ) ent on true
      left join public.plt_usuarios ent_nome on ent_nome.id = ent.usuario_id
      left join public.plt_programacoes pr on pr.card_id = pc.id
      left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
     where pc.tipo = 'pedido' and pc.arquivado_em is null
       -- só a situação pedida (o entregue não varre o "a entregar" e vice-versa)
       and (p_situacao is null
            or (p_situacao = 'entregue') = (pc.entrega_evento_id is not null))
       -- D-45 (o lançado) + SESSAO-38 (D-156): o programado e o candidato pronto
       and (pc.lancado_rotas_em is not null
            or pr.card_id is not null
            or (cand.card_id is not null and cand.pronto))
  )
  select b.card_id, b.pedido_id, b.numero, b.cliente_nome, b.telefone,
         b.endereco, b.numero_endereco, b.complemento, b.bairro, b.cidade, b.uf,
         b.obs, b.data_prevista, b.total_unidades, b.unidades_em_rotas,
         case when b.entregue_em is not null then 'entregue' else 'pronta' end as situacao_entrega,
         b.entregue_em, b.entregue_por, b.lancado_em,
         b.programacao_data, b.caminhao_id, b.caminhao_nome, b.caminhao_placa, b.caminhao_foto,
         case when b.entregue_em is not null then 'entregue' else b.estado end as estado,
         b.unidades_prontas, b.unidades_liberadas,
         count(*) over () as contagem_total
    from base b
   where plt_privado.fn_pode_ver_expedicao()
     and (p_situacao is null
          or (case when b.entregue_em is not null then 'entregue' else 'pronta' end) = p_situacao)
     and (p_busca is null or btrim(p_busca) = ''
          or b.numero::text like btrim(p_busca) || '%'
          or b.cliente_nome ilike '%' || btrim(p_busca) || '%')
   order by (b.entregue_em is not null),
            coalesce(b.programacao_data, b.data_prevista) asc nulls last,
            b.numero
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$function$;

CREATE OR REPLACE FUNCTION public.plt_fn_rotas_calendario(p_de date, p_ate date, p_por_dia integer DEFAULT 30, p_deslocamento integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_por_dia integer := least(greatest(coalesce(p_por_dia, 30), 1), 100);
  v_desloc  integer := greatest(coalesce(p_deslocamento, 0), 0);
  v_hoje    date := (now() at time zone 'America/Fortaleza')::date;
  v_dias    jsonb;
  v_resumo  jsonb;
begin
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'O calendário das rotas é da logística.' using errcode = 'insufficient_privilege';
  end if;
  if p_de is null or p_ate is null or p_ate < p_de then
    raise exception 'Diga o período do calendário (do dia … ao dia …).' using errcode = 'check_violation';
  end if;
  if p_ate - p_de > 41 then
    raise exception 'O calendário mostra no máximo 6 semanas por vez.' using errcode = 'check_violation';
  end if;

  with itens as (
    -- 1) programados: na rota ou entregue (a mesma regra de "Já programadas")
    select pr.data_entrega                                   as dia,
           case when pc.entrega_evento_id is not null then 'entregue' else 'na_rota' end as situacao,
           pc.id                                             as card_id,
           p.id                                              as pedido_id,
           p.numero,
           coalesce(nullif(btrim(ee.bairro), ''), nullif(btrim(ee.cidade), '')) as bairro,
           plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista,
           pr.detalhe,
           pr.caminhao_id,
           cam.nome                                          as caminhao_nome,
           pr.rota::int                                      as rota,
           pr.ordem,
           null::text                                        as motivo
      from public.plt_programacoes pr
      join public.plt_cards pc on pc.id = pr.card_id and pc.tipo = 'pedido'
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = p.id
      left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
     where pr.data_entrega between p_de and p_ate
       and (pc.arquivado_em is null or pc.entrega_evento_id is not null)
    union all
    -- 2) não entregue: o fato do dia da rota (índice próprio pelo dia — a
    --    marcação pode acontecer antes ou depois do dia programado)
    select (e.dados ->> 'data_entrega')::date,
           'nao_entregue',
           e.card_id,
           p.id,
           p.numero,
           coalesce(nullif(btrim(ee.bairro), ''), nullif(btrim(ee.cidade), '')),
           plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista,
           null,
           (e.dados ->> 'caminhao_id')::bigint,
           cam.nome,
           null,
           null,
           coalesce(e.dados ->> 'motivo', e.observacao)
      from public.plt_eventos e
      join public.plt_cards pc on pc.id = e.card_id
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = p.id
      left join public.plt_caminhoes cam on cam.id = (e.dados ->> 'caminhao_id')::bigint
     where e.tipo = 'entrega_nao_realizada'
       and e.dados ->> 'data_entrega' between p_de::text and p_ate::text
    union all
    -- 3) sem rota e stand-by: os vivos sem programação, no dia da previsão
    select v.data_prevista,
           case when pc.standby_desde is not null then 'standby' else 'sem_rota' end,
           v.card_id,
           v.pedido_id,
           v.numero,
           coalesce(nullif(btrim(ee.bairro), ''), nullif(btrim(ee.cidade), '')),
           v.data_prevista,
           null,
           null,
           null,
           null,
           null,
           pc.standby_motivo
      -- a REGRA do vivo, sem a prontidão (o calendário não mostra peça pronta — 1b)
      from plt_privado.vw_pedidos_vivos_regra v
      join public.plt_cards pc on pc.id = v.card_id
      left join public.clientes c on c.id = v.cliente_id
      left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = v.pedido_id
     where v.programacao_data is null
       and v.devolucao_evento_id is null
       and v.pedido_id in (select px.id from public.pedidos px where px.data_prevista between p_de and p_ate
                           union all select d.pedido_id from public.plt_pedido_datas d)
       and v.data_prevista between p_de and p_ate
  ), numerados as (
    select i.*,
           row_number() over (
             partition by i.dia
             order by case i.situacao when 'na_rota' then 1 when 'entregue' then 1
                                      when 'nao_entregue' then 2 when 'sem_rota' then 3 else 4 end,
                      i.caminhao_nome nulls last, i.caminhao_id, i.rota, i.ordem nulls last, i.numero
           ) as n
      from itens i
  ), por_dia as (
    select n.dia,
           count(*)::int as total,
           jsonb_build_object(
             'na_rota',      count(*) filter (where n.situacao = 'na_rota'),
             'entregue',     count(*) filter (where n.situacao = 'entregue'),
             'nao_entregue', count(*) filter (where n.situacao = 'nao_entregue'),
             'sem_rota',     count(*) filter (where n.situacao = 'sem_rota'),
             'standby',      count(*) filter (where n.situacao = 'standby')
           ) as contagem,
           coalesce(jsonb_agg(jsonb_build_object(
                      'situacao', n.situacao, 'card_id', n.card_id, 'pedido_id', n.pedido_id,
                      'numero', n.numero,
                      'bairro', n.bairro, 'previsao', n.data_prevista, 'detalhe', n.detalhe,
                      'caminhao_id', n.caminhao_id, 'caminhao_nome', n.caminhao_nome,
                      'rota', n.rota, 'ordem', n.ordem, 'motivo', n.motivo)
                    order by n.n)
                    filter (where n.n > v_desloc and n.n <= v_desloc + v_por_dia), '[]'::jsonb) as itens
      from numerados n
     group by n.dia
  )
  select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'total', d.total,
                                               'contagem', d.contagem, 'itens', d.itens)
                            order by d.dia), '[]'::jsonb)
    into v_dias
    from por_dia d;

  -- O que não cabe em dia nenhum da tela: sem rota com a previsão vencida e sem
  -- previsão. O "+N" de um dia (deslocamento > 0) não mostra o aviso — não conta.
  if v_desloc > 0 then
    v_resumo := jsonb_build_object('atrasados_sem_rota', 0, 'sem_previsao', 0);
  else
    select jsonb_build_object(
             'atrasados_sem_rota', count(*) filter (where v.data_prevista < v_hoje),
             'sem_previsao',       count(*) filter (where v.data_prevista is null))
      into v_resumo
      from plt_privado.vw_pedidos_vivos_regra v
      join public.plt_cards pc on pc.id = v.card_id
     where v.programacao_data is null
       and v.devolucao_evento_id is null
       and pc.standby_desde is null
       -- só os que contam (o filtro desce até os pedidos)
       and v.pedido_id in (select px.id from public.pedidos px where px.data_prevista < v_hoje or px.data_prevista is null
                           union all select d.pedido_id from public.plt_pedido_datas d)
       and (v.data_prevista < v_hoje or v.data_prevista is null);
  end if;

  return jsonb_build_object('de', p_de, 'ate', p_ate, 'hoje', v_hoje,
                            'por_dia', v_por_dia, 'dias', v_dias, 'fora', v_resumo);
end;
$function$;

CREATE OR REPLACE FUNCTION public.plt_fn_devolucao_detalhe(p_card_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_card public.plt_cards%rowtype;
  v_p    public.pedidos%rowtype;
  v_d    public.plt_eventos%rowtype;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'A decisão da devolução é da logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido';
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  select * into v_p from public.pedidos where id = v_card.pedido_id;
  if v_card.devolucao_evento_id is not null then
    select * into v_d from public.plt_eventos where id = v_card.devolucao_evento_id;
  else
    -- A última devolução (já decidida) — a tela diz que não há o que decidir.
    select * into v_d from public.plt_eventos
     where card_id = v_card.id and tipo = 'pedido_devolvido' order by id desc limit 1;
  end if;

  return jsonb_build_object(
    'card_id', v_card.id,
    'pedido_id', v_p.id,
    'numero', v_p.numero,
    'situacao_tiny', v_p.situacao,
    'cancelado', plt_privado.fn_pedido_cancelado(v_p.id),
    'cliente', (select jsonb_build_object('nome', c.nome, 'telefone', c.fone, 'cidade', (select ee.cidade from plt_privado.vw_endereco_entrega ee where ee.pedido_id = v_p.id),
                                       'bairro', (select ee.bairro from plt_privado.vw_endereco_entrega ee where ee.pedido_id = v_p.id))
                  from public.clientes c where c.id = v_p.cliente_id),
    'em_decisao', v_card.devolucao_evento_id is not null,
    'devolucao', case when v_d.id is null then null else jsonb_build_object(
        'evento_id', v_d.id, 'quando', v_d.ocorrido_em,
        'quem', (select u.nome from public.plt_usuarios u where u.id = v_d.usuario_id),
        'motivo', v_d.dados ->> 'motivo', 'observacao', v_d.dados ->> 'observacao',
        'entregue', coalesce((v_d.dados ->> 'entregue')::boolean, false)) end,
    -- O histórico da entrega: não entregue (com motivo), entregas e desfeitas,
    -- comentários do entregador e os comprovantes.
    'historico', coalesce((
        select jsonb_agg(h order by h->>'quando' desc)
          from (select jsonb_build_object('tipo', e.tipo, 'quando', e.ocorrido_em,
                         'quem', (select u.nome from public.plt_usuarios u where u.id = e.usuario_id),
                         'texto', coalesce(e.dados ->> 'motivo', e.observacao)) as h
                  from public.plt_eventos e
                 where e.card_id = v_card.id
                   and e.tipo in ('entrega_nao_realizada', 'pedido_entregue', 'entrega_desfeita',
                                  'comentario_adicionado', 'pedido_devolvido', 'pedido_lancado_rotas')
                 order by e.id desc limit 20) x), '[]'::jsonb),
    'comprovantes', (select count(*)::int from public.plt_anexos a
                      where a.card_id = v_card.id and a.removido_em is null),
    'pecas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', u.id, 'descricao', u.item_descricao, 'sku', u.item_codigo,
                 'indice', u.indice_unidade, 'total', u.total_unidades,
                 'qualidade', u.qualidade_atual,
                 'danificada', coalesce(e.eh_danificado, false),
                 'em_decisao', s.codigo = 'devolucao' and not coalesce(e.eh_danificado, false),
                 'onde', s.nome,
                 'produto_tiny_id', plt_privado.fn_estoque_produto_da_peca(u.pedido_id, u.produto_tiny_id, u.item_codigo, u.item_descricao))
               order by u.item_seq, u.indice_unidade)
          from public.plt_cards u
          join public.plt_setores s on s.id = u.setor_atual_id
          left join public.plt_etapas e on e.id = u.etapa_atual_id
         where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null
           and s.codigo = 'devolucao'), '[]'::jsonb),
    'decididas', coalesce((
        select jsonb_agg(jsonb_build_object('peca_id', e.card_id, 'decisao', e.dados ->> 'decisao',
                 'quando', e.ocorrido_em, 'quem', (select u.nome from public.plt_usuarios u where u.id = e.usuario_id))
               order by e.id)
          from public.plt_eventos e
         where e.tipo = 'devolucao_decidida' and (e.dados ->> 'devolucao_evento_id')::bigint = v_d.id), '[]'::jsonb)
  );
end;
$function$;

-- ----------------------------------------------------------------------------
-- 7 · A DATA QUE VALE nas outras portas — recriadas da versão viva (o quadro,
--     a janela do card, o PCP, a Expedição, Pedidos); a ficha do pedido diz a
--     data do Tiny, se a da plataforma vale, o endereço de entrega e a entrega parcial.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plt_privado.fn_quadro_junto(p_ids bigint[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_build_object(
    'execucoes', coalesce((
      select jsonb_agg(jsonb_build_object('evento_inicio_id', v.evento_inicio_id, 'card_id', v.card_id,
                                          'usuario_inicio_id', v.usuario_inicio_id, 'iniciou_em', v.iniciou_em))
        from public.plt_vw_execucoes v
       where v.card_id = any (p_ids) and v.em_andamento), '[]'::jsonb),
    'auxilios', coalesce((
      select jsonb_agg(jsonb_build_object('card_id', a.card_id, 'usuario_id', a.usuario_id,
                                          'iniciado_em', a.iniciado_em, 'pausado_em', a.pausado_em,
                                          'pausa_motivo', a.pausa_motivo, 'segundos', a.segundos,
                                          'ultimo_inicio', a.ultimo_inicio))
        from public.plt_auxilios a
       where a.card_id = any (p_ids) and a.encerrado_em is null), '[]'::jsonb),
    'pessoas', coalesce((
      select jsonb_object_agg(u.id, jsonb_build_object('nome', u.nome, 'foto', u.foto_caminho))
        from public.plt_usuarios u
       where u.id in (select c.executor_atual_id from public.plt_cards c where c.id = any (p_ids)
                      union select unnest(c.responsaveis) from public.plt_cards c where c.id = any (p_ids)
                      union select unnest(c.auxiliares) from public.plt_cards c where c.id = any (p_ids)
                      union select e.usuario_id from public.plt_cards c join public.plt_eventos e on e.id = c.parecer_pendente_id
                             where c.id = any (p_ids))), '{}'::jsonb),
    'pedidos', coalesce((
      select jsonb_object_agg(p.id, jsonb_build_object(
               'pedido_id', p.id, 'numero', p.numero,
               'situacao', p.situacao, 'data_prevista', plt_privado.fn_data_entrega(p.id, p.data_prevista), 'data_pedido', p.data_pedido,
               'entrou_pcp_em', (select min(e.ocorrido_em) from public.plt_eventos e where e.card_id = pc.id and e.tipo = 'card_criado'),
               'liberado_completo_em', pc.liberado_completo_em,
               -- SESSAO-38 (D-167): o relógio do PCP do pedido desconta o stand-by
               'standby_desde', pc.standby_desde, 'standby_periodos', pc.standby_periodos))
        from public.pedidos p
        left join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido'
       where p.id in (select c.pedido_id from public.plt_cards c where c.id = any (p_ids) and c.pedido_id is not null)), '{}'::jsonb),
    'valores', coalesce((
      select jsonb_agg(jsonb_build_object('campo_id', v.campo_id, 'card_id', v.card_id, 'valor', v.valor))
        from public.plt_campos_valores v
       where v.card_id = any (p_ids)), '[]'::jsonb)
  );
$function$;

CREATE OR REPLACE FUNCTION public.plt_fn_card_janela(p_card_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_card     public.plt_cards%rowtype;
  v_editar   boolean;
  v_pessoas  uuid[];
  v_eu       uuid := plt_privado.fn_usuario_atual();
  v_admin    boolean := plt_privado.fn_eh_admin();
  v_pcp      boolean := plt_privado.fn_pode_ver_expedicao();
  v_ids      bigint[];
  v_feitos   bigint[];
  v_planeja  boolean;
  v_setores  jsonb;
  v_pedido   public.pedidos%rowtype;
  v_prio     record;
begin
  select * into v_card from public.plt_cards where id = p_card_id;
  if not found then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if not plt_privado.fn_pode_anexar(p_card_id) then
    raise exception 'Você não vê este card.' using errcode = 'insufficient_privilege';
  end if;
  v_editar := plt_privado.fn_pode_editar_card(p_card_id);
  select * into v_pedido from public.pedidos where id = v_card.pedido_id;
  select v.prioridade, v.prioridade_herdada into v_prio from plt_privado.vw_card_ordem v where v.id = p_card_id;

  -- Os cards cuja história conta: o próprio; no card do pedido, as peças dele;
  -- na reposição, as peças que ela gerou.
  v_ids := case v_card.tipo
             when 'pedido' then coalesce((select array_agg(u.id) from public.plt_cards u
                                           where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade'), '{}')
             when 'reposicao' then coalesce((select array_agg(u.id) from public.plt_cards u
                                              where u.card_pai_id = v_card.id and u.tipo = 'unidade'), '{}')
             else array[v_card.id]
           end;
  v_feitos := case when v_card.tipo in ('unidade', 'avulso') then plt_privado.fn_setores_executados(p_card_id) else '{}' end;
  -- Definir o responsável dos próximos setores (D-152): admin, PCP/logística,
  -- o líder do setor do card (o líder do setor escolhido também — linha a linha).
  v_planeja := v_card.tipo in ('unidade', 'avulso') and v_card.arquivado_em is null and v_eu is not null;

  with fatos as (
    select coalesce(e.setor_origem_id, e.setor_destino_id) as setor_id, e.tipo, e.usuario_id, min(e.ocorrido_em) as primeiro
      from public.plt_eventos e
     where e.card_id = any (v_ids)
       and e.tipo in ('execucao_iniciada', 'auxilio_iniciado')
       and e.usuario_id is not null
       and not exists (select 1 from public.plt_eventos x where x.tipo = 'estorno' and x.evento_referencia_id = e.id)
     group by 1, 2, 3
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'setor_id', s.id, 'setor_nome', s.nome, 'ordem', s.ordem,
           'executaram', coalesce((select jsonb_agg(f.usuario_id order by f.primeiro)
                                     from fatos f where f.setor_id = s.id and f.tipo = 'execucao_iniciada'), '[]'::jsonb),
           'auxiliaram', coalesce((select jsonb_agg(f.usuario_id order by f.primeiro)
                                     from fatos f where f.setor_id = s.id and f.tipo = 'auxilio_iniciado'
                                      and not exists (select 1 from fatos g where g.setor_id = s.id and g.tipo = 'execucao_iniciada'
                                                       and g.usuario_id = f.usuario_id)), '[]'::jsonb),
           'planejados', coalesce(v_card.responsaveis_setor -> s.id::text, '[]'::jsonb),
           'executado', exists (select 1 from fatos f where f.setor_id = s.id),
           'atual', s.id = v_card.setor_atual_id,
           'pode_planejar', v_planeja and not (s.id = any (v_feitos))
                            and (v_admin or v_pcp
                                 or (v_card.setor_atual_id is not null and plt_privado.fn_eh_lider_de(v_card.setor_atual_id))
                                 or plt_privado.fn_eh_lider_de(s.id))
         ) order by s.ordem, s.id), '[]'::jsonb)
    into v_setores
    from public.plt_setores s
   where s.ativo and s.papel_no_fluxo = 'producao';

  v_pessoas := array_remove(v_card.responsaveis || v_card.criado_por_id || v_card.executor_atual_id, null)
               || v_card.auxiliares
               || coalesce((select array_agg(distinct x::uuid)
                              from jsonb_array_elements(v_setores) s
                              cross join lateral jsonb_array_elements_text((s -> 'executaram') || (s -> 'auxiliaram') || (s -> 'planejados')) as t(x)),
                           '{}');

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
    'auxilios', coalesce((
      select jsonb_agg(jsonb_build_object('usuario_id', a.usuario_id, 'iniciado_em', a.iniciado_em,
                                          'pausado_em', a.pausado_em, 'pausa_motivo', a.pausa_motivo,
                                          'segundos', a.segundos, 'ultimo_inicio', a.ultimo_inicio)
             order by a.iniciado_em)
        from public.plt_auxilios a
       where a.card_id = p_card_id and a.encerrado_em is null), '[]'::jsonb),
    'pessoas', coalesce((select jsonb_object_agg(u.id, jsonb_build_object('nome', u.nome, 'foto', u.foto_caminho))
                           from public.plt_usuarios u where u.id = any (v_pessoas)), '{}'::jsonb),
    'pedido', case when v_pedido.id is null then null else
                jsonb_build_object('pedido_id', v_pedido.id, 'numero', v_pedido.numero,
                                   'cliente_nome', coalesce((select cl.nome from public.clientes cl where cl.id = v_pedido.cliente_id), ''),
                                   'situacao', v_pedido.situacao, 'data_prevista', plt_privado.fn_data_entrega(v_pedido.id, v_pedido.data_prevista),
                                   'data_pedido', v_pedido.data_pedido)
                -- SESSAO-38 (D-167): a entrada no PCP, a liberação e o stand-by — o
                -- "Tempo útil em PCP" do histórico
                || plt_privado.fn_pcp_tempo_do_pedido(v_pedido.id) end,
    -- SESSAO-38 (D-150): o prazo — do pedido no Tiny (início = a data do
    -- pedido, vencimento = a data de entrega do vendedor) ou, sem pedido, o
    -- digitado no card.
    'prazo', case when v_pedido.id is not null
                  then jsonb_build_object('inicio', v_pedido.data_pedido, 'vencimento', plt_privado.fn_data_entrega(v_pedido.id, v_pedido.data_prevista), 'do_pedido', true)
                  else jsonb_build_object('inicio', v_card.inicio_em, 'vencimento', v_card.vence_em, 'do_pedido', false) end,
    'prioridade', jsonb_build_object('valor', coalesce(v_prio.prioridade, 'comum'),
                                     'do_pedido', coalesce(v_prio.prioridade_herdada, false) and v_card.pedido_id is not null,
                                     'da_reposicao', coalesce(v_prio.prioridade_herdada, false) and v_card.pedido_id is null),
    'responsaveis_por_setor', v_setores,
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
                       or v_admin),
      'anexar', v_card.arquivado_em is null,
      'ver_removidos', v_admin,
      'pausar', v_card.executor_atual_id is not null and v_card.pausado_em is null and v_card.arquivado_em is null
                and (v_card.executor_atual_id = v_eu or v_admin
                     or v_eu = any (v_card.auxiliares)
                     or (v_card.setor_atual_id is not null and plt_privado.fn_eh_lider_de(v_card.setor_atual_id))),
      'retomar', v_card.pausado_em is not null and v_card.arquivado_em is null
                 and (v_card.executor_atual_id = v_eu or v_admin
                      or (v_card.setor_atual_id is not null and plt_privado.fn_eh_lider_de(v_card.setor_atual_id))),
      'auxiliar', v_card.executor_atual_id is not null and v_card.arquivado_em is null
                  and v_card.concluido_em is null,
      'sair_auxilio', v_eu = any (v_card.auxiliares),
      -- SESSAO-38 (D-151): mudar a prioridade (na peça, muda a do pedido)
      'priorizar', v_card.arquivado_em is null and plt_privado.fn_pode_priorizar(p_card_id)
                   and (v_card.tipo <> 'unidade' or v_card.pedido_id is not null or v_card.card_pai_id is not null),
      -- as datas do card de pedido vêm do Tiny: não se editam aqui
      'editar_datas', v_editar and v_card.arquivado_em is null and v_pedido.id is null)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.plt_fn_devolucao_realocar_opcoes(p_peca_id bigint)
 RETURNS TABLE(card_pedido_id bigint, numero integer, cliente_nome text, data_prevista date, item_seq integer, indice_unidade integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with peca as (
    select plt_privado.fn_chave_peca(
             plt_privado.fn_estoque_produto_da_peca(u.pedido_id, u.produto_tiny_id, u.item_codigo, u.item_descricao),
             u.item_codigo, u.item_descricao) as chave,
           u.pedido_id
      from public.plt_cards u
     where u.id = p_peca_id and u.tipo = 'unidade'
  ),
  vagas as (
    select pc.id as card_pedido_id, p.numero, coalesce(c.nome, '') as cliente_nome, plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista,
           v.seq as item_seq, k.k as indice_unidade
      from public.plt_cards pc
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      join plt_privado.vw_itens_producao v on v.pedido_id = pc.pedido_id and v.unidades >= 1
      cross join lateral generate_series(1, v.unidades::int) as k(k)
      cross join peca pe
     where plt_privado.fn_pode_ver_expedicao()
       and pc.tipo = 'pedido' and pc.arquivado_em is null
       and pc.lancado_rotas_em is null and pc.entrega_evento_id is null
       and pc.liberado_completo_em is null
       and pc.pedido_id is distinct from pe.pedido_id
       and not plt_privado.fn_pedido_cancelado(pc.pedido_id)
       and plt_privado.fn_chave_peca(plt_privado.fn_produto_do_item(v.codigo, v.descricao), v.codigo, v.descricao) = pe.chave
       and not exists (select 1 from public.plt_cards u2
                        where u2.pedido_id = pc.pedido_id and u2.tipo = 'unidade'
                          and u2.item_seq = v.seq and u2.indice_unidade = k.k)
  )
  select distinct on (vg.card_pedido_id) vg.card_pedido_id, vg.numero, vg.cliente_nome, vg.data_prevista,
         vg.item_seq, vg.indice_unidade
    from vagas vg
   order by vg.card_pedido_id, vg.item_seq, vg.indice_unidade
   limit 20;
$function$;

CREATE OR REPLACE FUNCTION public.plt_fn_pedidos_aguardo(p_busca text DEFAULT NULL::text, p_limite integer DEFAULT 20, p_deslocamento integer DEFAULT 0)
 RETURNS TABLE(card_id bigint, pedido_id bigint, numero integer, cliente_nome text, data_prevista date, situacao text, total_unidades integer, unidades_liberadas integer, unidades_prontas integer, completo boolean, alterado_apos_liberacao boolean, primeira_pronta_em timestamp with time zone, completo_em timestamp with time zone, contagem_total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with prontas as materialized (
    select a.card_pedido_id,
           count(*)::int       as prontas,
           min(u.concluido_em) as primeira,
           max(u.concluido_em) as ultima,
           false               as sem_producao
      from plt_privado.fn_unidades_em_aguardo() a
      join public.plt_cards u on u.id = a.unidade_id
     group by a.card_pedido_id
    union all
    -- D-63: pedido sem nada a produzir (só frete) — completo desde que nasceu.
    select s.card_pedido_id, 0, null::timestamptz, s.desde, true
      from plt_privado.fn_pedidos_sem_producao() s
  ),
  linhas as (
    select pc.id                          as card_id,
           p.id                           as pedido_id,
           p.numero,
           coalesce(c.nome, '')           as cliente_nome,
           plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista,
           p.situacao,
           coalesce(i.total_unidades, 0)  as total_unidades,
           coalesce(l.liberadas, 0)       as unidades_liberadas,
           pr.prontas                     as unidades_prontas,
           ((coalesce(i.total_unidades, 0) > 0 or pr.sem_producao)
            and pr.prontas >= coalesce(i.total_unidades, 0) - coalesce(ja.entregues, 0)) as completo,
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
        select coalesce(sum(v.unidades), 0)::int as total_unidades
          from plt_privado.vw_itens_producao v where v.pedido_id = p.id
      ) i on true
      left join lateral (
        select count(*)::int as liberadas
          from public.plt_cards cu
         where cu.pedido_id = p.id and cu.tipo = 'unidade' and cu.arquivado_em is null
      ) l on true
      -- SESSAO-31 (D-130): na reentrega, o que já foi entregue não falta.
      left join lateral (
        select plt_privado.fn_unidades_ja_entregues(p.id) as entregues
      ) ja on true
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
$function$;

CREATE OR REPLACE FUNCTION public.plt_fn_pcp_todos_pedidos(p_busca text DEFAULT NULL::text, p_antes_numero integer DEFAULT NULL::integer, p_limite integer DEFAULT 20)
 RETURNS TABLE(pedido_id bigint, numero integer, cliente_nome text, data_pedido date, data_prevista date, situacao text, total_unidades integer, unidades_liberadas integer, alterado_apos_liberacao boolean, card_id bigint, situacao_plataforma text, tem_mais boolean, contagem_total integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with cfg as (
    select least(greatest(coalesce(p_limite, 20), 1), 100) as limite,
           nullif(btrim(coalesce(p_busca, '')), '')       as busca
  ),
  pagina as (
    select p.id, p.numero, p.cliente_id, p.data_pedido, plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista, p.situacao,
           c.nome as cliente_nome
      from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
      left join public.clientes c on c.id = p.cliente_id
      cross join cfg
     where plt_privado.fn_pode_ver_expedicao()
       and (p_antes_numero is null or p.numero < p_antes_numero)
       and (cfg.busca is null
            or p.numero::text like cfg.busca || '%'
            or c.nome ilike '%' || cfg.busca || '%')
     order by p.numero desc
     limit (select limite + 1 from cfg)
  ),
  numerada as (
    select pg.*, row_number() over (order by pg.numero desc) as n from pagina pg
  )
  select nu.id                                   as pedido_id,
         nu.numero,
         coalesce(nu.cliente_nome, '')           as cliente_nome,
         nu.data_pedido,
         nu.data_prevista,
         nu.situacao,
         coalesce(i.total_unidades, 0)           as total_unidades,
         coalesce(u.liberadas, 0)                as unidades_liberadas,
         exists (select 1 from public.plt_eventos e
                  where e.card_id = pc.id and e.tipo = 'pedido_atualizado')
                                                 as alterado_apos_liberacao,
         pc.id                                   as card_id,
         case
           when pc.id is null then 'sem_card'
           when pc.devolucao_evento_id is not null then 'devolvido'  -- SESSAO-31 (D-129)
           when pc.entrega_evento_id is not null then 'entregue'
           when pc.arquivado_em is not null then 'arquivado'
           when pc.lancado_rotas_em is not null then 'em_rota'
           when coalesce(i.total_unidades, 0) > 0 and coalesce(u.prontas, 0) >= i.total_unidades then 'aguardo'
           when coalesce(u.liberadas, 0) > 0 then 'producao'
           else 'pcp'
         end                                     as situacao_plataforma,
         (select count(*) from pagina) > (select limite from cfg) as tem_mais,
         case when p_antes_numero is null then (
           select count(*)::int from (
             select 1
               from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p2
               left join public.clientes c2 on c2.id = p2.cliente_id
               cross join cfg
              where cfg.busca is null
                 or p2.numero::text like cfg.busca || '%'
                 or c2.nome ilike '%' || cfg.busca || '%'
              limit 10001) x
         ) end                                   as contagem_total
    from numerada nu
    left join public.plt_cards pc on pc.pedido_id = nu.id and pc.tipo = 'pedido'
    left join lateral (
      -- D-63: o frete não conta como unidade (vw_itens_producao).
      select coalesce(sum(v.unidades), 0)::int as total_unidades
        from plt_privado.vw_itens_producao v
       where v.pedido_id = nu.id
    ) i on true
    left join lateral (
      select count(*) filter (where not exists (select 1 from plt_privado.vw_itens_producao v
                                                 where v.pedido_id = cu.pedido_id and v.seq = cu.item_seq and v.eh_frete))::int
               as liberadas,
             count(*) filter (where cu.arquivado_em is null and s.papel_no_fluxo = 'terminal')::int
               as prontas
        from public.plt_cards cu
        left join public.plt_setores s on s.id = cu.setor_atual_id
       where cu.pedido_id = nu.id and cu.tipo = 'unidade'
    ) u on true
   where nu.n <= (select limite from cfg)
   order by nu.numero desc;
$function$;

CREATE OR REPLACE FUNCTION public.plt_fn_pedidos_lista(p_busca text DEFAULT NULL::text, p_antes_numero integer DEFAULT NULL::integer, p_limite integer DEFAULT 20, p_cancelados boolean DEFAULT false)
 RETURNS TABLE(pedido_id bigint, numero integer, cliente_nome text, data_pedido date, data_prevista date, situacao text, total_pedido numeric, vendedor text, marcadores text[], total_unidades integer, unidades_liberadas integer, unidades_prontas integer, card_id bigint, situacao_plataforma text, entregue_em timestamp with time zone, entregue_por text, entregue_fonte text, entregue_tiny text, cancelado_em timestamp with time zone, tem_mais boolean, contagem_total integer, programacao_data date, caminhao_nome text, rota integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
declare
  v_lim   integer := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_busca text    := nullif(btrim(coalesce(p_busca, '')), '');
  v_canc  boolean := coalesce(p_cancelados, false);
  -- só dígitos, sem zero na frente: o "número que começa com" vira faixas
  v_num   bigint  := case when nullif(btrim(coalesce(p_busca, '')), '') ~ '^[1-9][0-9]{0,8}$'
                          then btrim(p_busca)::bigint end;
  v_ids   bigint[];
  v_total integer;
  v_teto  bigint;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    return;  -- como antes: sem acesso, lista vazia
  end if;

  -- 1 · a página (limite + 1, para saber se tem mais), por um caminho por caso
  if v_busca is null and not v_canc then
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
       where (p_antes_numero is null or p.numero < p_antes_numero)
       order by p.numero desc limit v_lim + 1) x;
  elsif v_busca is null then
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
       where plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
         and (p_antes_numero is null or p.numero < p_antes_numero)
       order by p.numero desc limit v_lim + 1) x;
  else
    -- 1ª tentativa: só os 5.000 números mais recentes, do jeito de sempre (o
    -- filtro com OU, parando na página cheia) — termo COMUM acha a página aí e
    -- para cedo. Achou a página inteira (limite + 1) → é exatamente a de antes:
    -- qualquer outro pedido que case tem número menor que todos da janela.
    v_teto := coalesce(p_antes_numero, (select max(pm.numero) from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) pm) + 1);
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero
        from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
        left join public.clientes c on c.id = p.cliente_id
       where p.numero >= v_teto - 5000
         and p.numero < v_teto
         and (p.numero::text like v_busca || '%'
              or c.nome ilike '%' || v_busca || '%'
              or p.vendedor ilike '%' || v_busca || '%')
         and (not v_canc or plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
       order by p.numero desc limit v_lim + 1) x;
  end if;
  -- termo RARO (a janela não encheu a página): os caminhos que os índices usam
  if v_busca is not null and cardinality(v_ids) <= v_lim then
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero
        from (-- o número que começa com o texto: só dígitos (sem zero na frente) viram
              -- faixas [x·10^k, (x+1)·10^k) — o índice do número anda em cada uma
              select p1.id
                from generate_series(0, greatest(0, 10 - length(v_busca))) as k(e)
                join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p1
                  on p1.numero >= v_num * (10::bigint ^ k.e)::bigint
                 and p1.numero <  (v_num + 1) * (10::bigint ^ k.e)::bigint
               where v_num is not null
              union
              select p2.id from public.clientes c2 join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p2 on p2.cliente_id = c2.id
               where c2.nome ilike '%' || v_busca || '%'
              union
              select p3.id from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p3 where p3.vendedor ilike '%' || v_busca || '%') alvo
        join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p on p.id = alvo.id
       where (not v_canc or plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
         and (p_antes_numero is null or p.numero < p_antes_numero)
       order by p.numero desc limit v_lim + 1) x;
  end if;

  -- 2 · o total, só na 1ª página (até 10.001), pelo mesmo caminho
  if p_antes_numero is null then
    if v_busca is null and not v_canc then
      select count(*)::int into v_total from (select 1 from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p limit 10001) x;
    elsif v_busca is null then
      select count(*)::int into v_total from (
        select 1 from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
         where plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado' limit 10001) x;
    else
      select count(*)::int into v_total from (
        select 1
          from (select p1.id
                  from generate_series(0, greatest(0, 10 - length(v_busca))) as k(e)
                  join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p1
                    on p1.numero >= v_num * (10::bigint ^ k.e)::bigint
                   and p1.numero <  (v_num + 1) * (10::bigint ^ k.e)::bigint
                 where v_num is not null
                union
                select p2.id from public.clientes c2 join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p2 on p2.cliente_id = c2.id
                 where c2.nome ilike '%' || v_busca || '%'
                union
                select p3.id from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p3 where p3.vendedor ilike '%' || v_busca || '%') alvo
          join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p on p.id = alvo.id
         where (not v_canc or plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
         limit 10001) x;
    end if;
  end if;

  -- 3 · o que cada linha mostra — a projeção de sempre, sobre a página achada
  return query
  with pagina as (
    select p.id, p.numero, p.cliente_id, p.data_pedido, plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista, p.situacao,
           p.total_pedido, p.vendedor, p.marcadores, nullif(p.raw ->> 'data_entrega', '') as entregue_tiny,
           c.nome as cliente_nome
      from unnest(v_ids) with ordinality as u(id, ord)
      join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p on p.id = u.id
      left join public.clientes c on c.id = p.cliente_id
     order by u.ord
  ),
  numerada as (
    select pg.*, row_number() over (order by pg.numero desc) as n from pagina pg
  )
  select nu.id                                   as pedido_id,
         nu.numero,
         coalesce(nu.cliente_nome, '')           as cliente_nome,
         nu.data_pedido,
         nu.data_prevista,
         nu.situacao,
         nu.total_pedido,
         nullif(btrim(coalesce(nu.vendedor, '')), '') as vendedor,
         coalesce(nu.marcadores, '{}')           as marcadores,
         coalesce(i.total_unidades, 0)           as total_unidades,
         coalesce(u.liberadas, 0)                as unidades_liberadas,
         coalesce(u.prontas, 0)                  as unidades_prontas,
         pc.id                                   as card_id,
         case
           when plt_privado.fn_situacao_normalizada(nu.situacao) = 'cancelado' then 'cancelado'
           when pc.id is null then 'sem_card'
           when pc.devolucao_evento_id is not null then 'devolvido'
           when pc.entrega_evento_id is not null then 'entregue'
           when pc.arquivado_em is not null then 'arquivado'
           -- SESSAO-38 (↪️ D-156): o PROGRAMADO também está "Em rota" (lançado ou não)
           when pc.lancado_rotas_em is not null or pr.card_id is not null then 'em_rota'
           when coalesce(i.total_unidades, 0) > 0 and coalesce(u.prontas, 0) >= i.total_unidades then 'aguardo'
           when coalesce(u.liberadas, 0) > 0 then 'producao'
           -- D-132: o Tiny já levou adiante e nada foi liberado — segue o Tiny.
           when plt_privado.fn_tiny_tirou_do_pcp(nu.situacao) then 'tiny'
           else 'pcp'
         end                                     as situacao_plataforma,
         ent.ocorrido_em                         as entregue_em,
         ue.nome                                 as entregue_por,
         case when ent.id is null then null
              else coalesce(ent.dados ->> 'fonte', case when ent.usuario_id is null then 'tiny' else 'plataforma' end)
         end                                     as entregue_fonte,
         nu.entregue_tiny,
         canc.ocorrido_em                        as cancelado_em,
         (select count(*) from pagina) > v_lim       as tem_mais,
         v_total                                 as contagem_total,
         pr.data_entrega                         as programacao_data,
         cam.nome                                as caminhao_nome,
         pr.rota::int                            as rota
    from numerada nu
    left join public.plt_cards pc on pc.pedido_id = nu.id and pc.tipo = 'pedido'
    left join public.plt_programacoes pr on pr.card_id = pc.id
    left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
    left join public.plt_eventos ent on ent.id = pc.entrega_evento_id
    left join public.plt_usuarios ue on ue.id = ent.usuario_id
    left join lateral (
      select min(e.ocorrido_em) as ocorrido_em
        from public.plt_eventos e
       where pc.id is not null and e.card_id = pc.id and e.tipo = 'pedido_cancelado'
    ) canc on true
    left join lateral (
      -- D-63: o frete não conta como unidade.
      select coalesce(sum(v.unidades), 0)::int as total_unidades
        from plt_privado.vw_itens_producao v
       where v.pedido_id = nu.id
    ) i on true
    left join lateral (
      select count(*)::int as liberadas,
             count(*) filter (where cu.concluido_em is not null)::int as prontas
        from public.plt_cards cu
       where cu.tipo = 'unidade'
         and (cu.pedido_id = nu.id or (pc.id is not null and cu.card_pai_id = pc.id))
    ) u on true
   where nu.n <= v_lim
   order by nu.numero desc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.plt_fn_pcp_quadro(p_limite integer DEFAULT 10, p_deslocamento integer DEFAULT 0, p_grupo text DEFAULT NULL::text, p_ordem text DEFAULT NULL::text, p_filtro text DEFAULT NULL::text)
 RETURNS TABLE(id bigint, tipo text, pedido_id bigint, card_pai_id bigint, item_seq integer, item_codigo text, item_descricao text, indice_unidade integer, total_unidades integer, setor_atual_id bigint, etapa_atual_id bigint, desde timestamp with time zone, executor_atual_id uuid, responsavel_id uuid, delegado_em timestamp with time zone, qualidade_atual text, concluido_em timestamp with time zone, pausado_em timestamp with time zone, liberado_completo_em timestamp with time zone, pecas_estoque integer, contagem_total bigint, etiquetas bigint[], pedido_resumo jsonb, prioridade text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with m as (select plt_privado.fn_ordem_do_quadro(p_ordem) as modo),
  f as (select * from plt_privado.fn_filtro_do_quadro(p_filtro)),
  base as (
    select c.id, c.desde, c.prioridade, p.numero, plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista,
           lower(translate(btrim(coalesce(case when c.tipo = 'pedido' then cl.nome else c.item_descricao end, '')),
                           'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
                           'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')) as nome
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
      left join public.pedidos p on p.id = c.pedido_id
      left join public.clientes cl on cl.id = p.cliente_id
     -- o MESMO filtro de plt_fn_cards_pedido_pcp (D-75: painel = quadro)
     where (select plt_privado.fn_usuario_atual()) is not null
       and ((select plt_privado.fn_eh_admin())
            or c.setor_atual_id in (select plt_privado.fn_setores_do_usuario()))
       and c.tipo in ('pedido', 'reposicao')
       -- SESSAO-38 (D-169): o MESMO filtro de plt_fn_cards_pedido_pcp (o grupo 'standby')
       and (case when p_grupo = 'standby' then c.tipo = 'pedido' and c.standby_desde is not null
                 else (p_grupo is null or c.tipo = p_grupo) and c.standby_desde is null end)
       and c.arquivado_em is null
       and c.liberado_completo_em is null
       and (c.tipo = 'reposicao'
            or (p.id is not null
                and not plt_privado.fn_tiny_tirou_do_pcp(p.situacao)
                and exists (select 1 from plt_privado.vw_itens_producao v
                             where v.pedido_id = p.id and v.unidades > 0)))
  ),
  chaves as (
    select b.id,
           case (select modo from m)
             when 'prioridade' then case b.prioridade when 'urgente' then 0 when 'atencao' then 1 else 2 end
             else case when b.prioridade = 'urgente' then 0 else 1 end
           end as k1,
           (case (select modo from m)
              when 'entrega' then to_char(coalesce(b.data_prevista, date '9999-12-31'), 'YYYYMMDD')
              when 'alfabetica' then (case when b.nome ~ '^[a-z]' then '0' when b.nome ~ '^[0-9]' then '1' else '2' end) || b.nome
              else '' end) collate "C" as k2,
           case (select modo from m) when 'entrega' then coalesce(b.numero, 2147483647) else 0 end as k3,
           coalesce(b.desde, 'infinity'::timestamptz) as k4,
           count(*) over () as total
      from base b
     -- SESSAO-40 (D-187): o filtro do PCP — o nº do pedido que começa com o
     -- texto, ou o nome que o contém (o cliente no card do pedido; o móvel na
     -- reposição — o mesmo nome da ordem alfabética). O total conta só os que batem.
     where (not (select ativo from f)
            or case when (select numero from f) is not null
                    then b.numero::text like (select numero from f) || '%'
                    else translate(b.nome, ' ' || chr(9) || chr(10) || chr(13), '')
                           like '%' || (select nome from f) || '%' end)
  ),
  pagina as (
    select k.id, k.total, row_number() over (order by k.k1, k.k2, k.k3, k.k4, k.id) as ord
      from chaves k
     order by k.k1, k.k2, k.k3, k.k4, k.id
     limit least(greatest(coalesce(p_limite, 10), 1), 100)
    offset greatest(coalesce(p_deslocamento, 0), 0)
  ),
  resumos as (
    select r.pedido_id, to_jsonb(r) - 'contagem_total' as resumo
      from public.plt_fn_pedidos_kanban(
             null, false,
             coalesce((select array_agg(distinct c.pedido_id)
                         from pagina pg join public.plt_cards c on c.id = pg.id
                        where c.pedido_id is not null), '{}'),
             100, 0) r
  )
  select c.id, c.tipo, c.pedido_id, c.card_pai_id, c.item_seq, c.item_codigo,
         c.item_descricao, c.indice_unidade, c.total_unidades, c.setor_atual_id,
         c.etapa_atual_id, c.desde, c.executor_atual_id, c.responsavel_id,
         c.delegado_em, c.qualidade_atual, c.concluido_em, c.pausado_em,
         c.liberado_completo_em,
         pe.n as pecas_estoque,
         pg.total as contagem_total,
         coalesce(c.etiquetas, '{}'),
         -- SESSAO-38 (D-167/D-169): o stand-by do pedido no resumo (o relógio do
         -- PCP desconta; a aba Stand-by mostra o motivo, desde quando e quem pôs)
         case when c.tipo = 'pedido' then coalesce(r.resumo, '{}'::jsonb) || jsonb_build_object(
                'standby_desde', c.standby_desde, 'standby_motivo', c.standby_motivo,
                'standby_periodos', c.standby_periodos,
                'standby_por', (select u.nome from public.plt_eventos e
                                  join public.plt_usuarios u on u.id = e.usuario_id
                                 where e.id = c.standby_evento_id))
              else r.resumo end,
         c.prioridade
    from pagina pg
    join public.plt_cards c on c.id = pg.id
    left join resumos r on r.pedido_id = c.pedido_id
    -- as peças do galpão que atendem o pedido (a mesma conta de
    -- plt_fn_cards_pedido_pcp), só para os cards da página
    cross join lateral (
      select case when c.tipo <> 'pedido' then 0 else (
        select count(*)::int
          from public.plt_cards u
          join public.plt_setores se on se.id = u.setor_atual_id and se.codigo = 'estoque'
         where u.tipo = 'unidade' and u.pedido_id is null and u.arquivado_em is null
           and (u.reservada_pedido_id = c.pedido_id
                or (u.reservada_pedido_id is null
                    and u.item_codigo is not null
                    and not plt_privado.fn_eh_personalizado(u.item_descricao)
                    and exists (select 1 from public.pedido_itens pi
                                 where pi.pedido_id = c.pedido_id
                                   and pi.codigo = u.item_codigo
                                   and not plt_privado.fn_eh_personalizado(pi.descricao))))
      ) end as n
    ) pe
   order by pg.ord;
$function$;

CREATE OR REPLACE FUNCTION public.plt_fn_expedicao_kanban(p_busca text DEFAULT NULL::text, p_limite integer DEFAULT 20, p_deslocamento integer DEFAULT 0)
 RETURNS TABLE(pedido_id bigint, numero integer, cliente_nome text, data_prevista date, situacao text, total_unidades integer, unidades_liberadas integer, unidades_no_terminal integer, alterado_apos_liberacao boolean, contagem_total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select p.id                          as pedido_id,
         p.numero,
         coalesce(c.nome, '')          as cliente_nome,
         plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista,
         p.situacao,
         coalesce(i.total_unidades, 0) as total_unidades,
         coalesce(u.liberadas, 0)      as unidades_liberadas,
         coalesce(u.no_terminal, 0)    as unidades_no_terminal,
         exists (select 1 from public.plt_eventos e
                  where e.card_id = pc.id and e.tipo = 'pedido_atualizado')
                                       as alterado_apos_liberacao,
         count(*) over ()              as contagem_total
    from public.pedidos p
    join public.plt_cards pc
      on pc.pedido_id = p.id and pc.tipo = 'pedido' and pc.arquivado_em is null
    left join public.clientes c on c.id = p.cliente_id
    left join lateral (
      -- D-63: frete não conta.
      select coalesce(sum(v.unidades), 0)::int as total_unidades
          from plt_privado.vw_itens_producao v where v.pedido_id = p.id
    ) i on true
    left join lateral (
      select count(*)::int as liberadas,
             count(*) filter (where cu.concluido_em is not null)::int as no_terminal
        from public.plt_cards cu
       where cu.pedido_id = p.id and cu.tipo = 'unidade'
         and cu.arquivado_em is null
    ) u on true
   where plt_privado.fn_pode_ver_expedicao()
     -- D-133 (14/10): só pedido VIVO — sem entrega registrada na plataforma,
     -- não encerrado no Tiny; o que o Tiny já levou adiante só fica se a
     -- fábrica ainda tem peça dele nas mãos.
     and pc.entrega_evento_id is null
     and plt_privado.fn_situacao_normalizada(p.situacao)
         not in ('entregue', 'nao_entregue', 'cancelado')
     and (not plt_privado.fn_tiny_tirou_do_pcp(p.situacao) or coalesce(u.liberadas, 0) > 0)
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.nome ilike '%' || btrim(p_busca) || '%')
   order by plt_privado.fn_data_entrega(p.id, p.data_prevista) asc nulls last, p.numero desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$function$;

CREATE OR REPLACE FUNCTION public.plt_fn_pedidos_kanban(p_busca text DEFAULT NULL::text, p_somente_sem_card boolean DEFAULT false, p_ids bigint[] DEFAULT NULL::bigint[], p_limite integer DEFAULT 20, p_deslocamento integer DEFAULT 0)
 RETURNS TABLE(pedido_id bigint, numero integer, cliente_nome text, data_pedido date, data_prevista date, situacao text, total_itens integer, total_unidades integer, tem_card boolean, unidades_liberadas integer, alterado_apos_liberacao boolean, entrou_pcp_em timestamp with time zone, liberado_completo_em timestamp with time zone, contagem_total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select p.id                                as pedido_id,
         p.numero,
         coalesce(c.nome, '')                as cliente_nome,
         p.data_pedido,
         plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista,
         p.situacao,
         coalesce(i.total_itens, 0)          as total_itens,
         coalesce(i.total_unidades, 0)       as total_unidades,
         (pc.id is not null)                 as tem_card,
         coalesce(u.liberadas, 0)            as unidades_liberadas,
         -- SESSAO-09: o Tiny mudou o pedido DEPOIS de unidades irem à produção.
         exists (select 1 from public.plt_eventos e
                  where e.card_id = pc.id and e.tipo = 'pedido_atualizado')
                                             as alterado_apos_liberacao,
         -- SESSAO-22 (D-48): o tempo em PCP é do pedido — entrada → liberação completa.
         ev.entrou_pcp_em,
         pc.liberado_completo_em,
         count(*) over ()                    as contagem_total
    from public.pedidos p
    left join public.clientes c on c.id = p.cliente_id
    left join lateral (
      -- D-63: o frete não conta como unidade (vw_itens_producao).
      select count(*)::int as total_itens,
             coalesce(sum(v.unidades), 0)::int as total_unidades
        from plt_privado.vw_itens_producao v
       where v.pedido_id = p.id
    ) i on true
    left join lateral (
      -- D-63: card de frete nascido antes da regra não conta como liberado.
      select count(*)::int as liberadas
        from public.plt_cards cu
       where cu.pedido_id = p.id and cu.tipo = 'unidade'
         and not exists (select 1 from plt_privado.vw_itens_producao v
                          where v.pedido_id = cu.pedido_id and v.seq = cu.item_seq and v.eh_frete)
    ) u on true
    left join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido'
    left join lateral (
      select min(e.ocorrido_em) as entrou_pcp_em
        from public.plt_eventos e
       where e.card_id = pc.id and e.tipo = 'card_criado'
    ) ev on true
   where plt_privado.fn_usuario_atual() is not null
     and (p_ids is null or p.id = any (p_ids))
     and (not coalesce(p_somente_sem_card, false) or pc.id is null)
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.nome ilike '%' || btrim(p_busca) || '%')
   order by p.data_pedido desc nulls last, p.numero desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$function$;

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
      'liberado_completo_em', v_card.liberado_completo_em),
    'programacao', case when v_prog.id is null then null else jsonb_build_object(
      'data', v_prog.data_entrega, 'rota', v_prog.rota, 'ordem', v_prog.ordem, 'detalhe', v_prog.detalhe,
      'caminhao', (select cam.nome || coalesce(' · ' || cam.placa, '') from public.plt_caminhoes cam where cam.id = v_prog.caminhao_id),
      'equipe', coalesce((select jsonb_agg(u.nome order by u.nome)
                            from public.plt_programacao_equipes eq join public.plt_usuarios u on u.id = eq.usuario_id
                           where eq.data_entrega = v_prog.data_entrega and eq.caminhao_id = v_prog.caminhao_id
                             and eq.rota = v_prog.rota), '[]'::jsonb)) end,
    'entrega', case when v_ent.id is null then null else jsonb_build_object(
      'em', v_ent.ocorrido_em, 'por', (select u.nome from public.plt_usuarios u where u.id = v_ent.usuario_id),
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
                  'observacao', ev.observacao, 'motivo', ev.dados ->> 'motivo',
                  'setor', (select s.nome from public.plt_setores s where s.id = ev.setor_destino_id)) as h
                  from public.plt_eventos ev
                  left join public.plt_usuarios u on u.id = ev.usuario_id
                 where ev.card_id = v_card.id
                 order by ev.id desc
                 limit 80) z), '[]'::jsonb) end
  );
end;
$function$;

-- ----------------------------------------------------------------------------
-- 8 · O desfazer recusa a entrega parcial; o motivo "entrega parcial" em
--     Utilitários — recriadas da versão viva.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plt_fn_entrega_desfazer(p_card_id bigint, p_motivo_id bigint, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_usuario  uuid;
  v_card     public.plt_cards%rowtype;
  v_entrega  public.plt_eventos%rowtype;
  v_motivo   text;
  v_antes    text;
  v_marca    text;
  v_voltaram integer := 0;
  v_tiny     text;
  r          record;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_mexer_entrega(p_card_id) then
    raise exception 'Desfazer a entrega é gesto do entregador do caminhão, da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select m.texto into v_motivo from public.plt_motivos m
   where m.id = p_motivo_id and m.tipo = 'desfazer_entrega' and m.ativo;
  if v_motivo is null then
    raise exception 'Escolha o motivo de desfazer a entrega.' using errcode = 'check_violation';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found or v_card.entrega_evento_id is null then
    raise exception 'Este pedido não está entregue.' using errcode = 'check_violation';
  end if;
  select * into v_entrega from public.plt_eventos where id = v_card.entrega_evento_id;
  -- SESSAO-41 (D-195): a parcial já mandou as peças que voltaram para a logística
  if coalesce((v_entrega.dados ->> 'parcial')::boolean, false) then
    raise exception 'A entrega parcial não se desfaz por aqui — as peças que voltaram já estão com a logística (Decidir situação).'
      using errcode = 'check_violation';
  end if;
  -- E-89: só a entrega feita por gente aqui se desfaz — a que veio do Tiny
  -- (assinada "Sistema") se mexe lá (o Tiny avisa a plataforma).
  if v_entrega.usuario_id is null then
    raise exception 'Esta entrega veio do Tiny — para desfazer, mude a situação no Tiny.' using errcode = 'check_violation';
  end if;
  if (v_entrega.ocorrido_em at time zone 'America/Fortaleza')::date
     <> (now() at time zone 'America/Fortaleza')::date then
    raise exception 'Só dá para desfazer a entrega no mesmo dia.' using errcode = 'check_violation';
  end if;
  v_antes := plt_privado.fn_tiny_situacao_api(v_entrega.dados ->> 'situacao_tiny');

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_card.id, 'entrega_desfeita', v_usuario, 'interface',
            v_motivo || coalesce(' — ' || nullif(btrim(p_observacao), ''), ''),
            jsonb_build_object('entrega_evento_id', v_entrega.id, 'motivo_id', p_motivo_id, 'motivo', v_motivo,
                               'situacao_tiny_volta', v_antes));

  -- As peças que saíram com ESTA entrega voltam (por evento — nada se apaga).
  v_marca := current_setting('plt.entrega_maquinaria', true);
  perform set_config('plt.entrega_maquinaria', 'on', true);
  for r in
    select c.id, c.setor_atual_id, c.etapa_atual_id
      from public.plt_cards c
     where c.arquivado_em is not null
       and exists (select 1 from public.plt_eventos a
                    where a.card_id = c.id and a.tipo = 'card_arquivado'
                      and (a.dados ->> 'entrega_evento_id')::bigint = v_entrega.id)
     order by c.id
       for update
  loop
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, observacao, dados)
      values (r.id, 'card_desarquivado', v_usuario, 'interface', r.setor_atual_id, r.etapa_atual_id,
              'A entrega foi desfeita — a peça voltou.',
              jsonb_build_object('motivo', 'entrega_desfeita', 'entrega_evento_id', v_entrega.id));
    v_voltaram := v_voltaram + 1;
  end loop;
  perform set_config('plt.entrega_maquinaria', coalesce(v_marca, ''), true);

  v_tiny := plt_privado.fn_tiny_pedido_enfileirar(v_card.pedido_id, v_antes, 'desfeita');
  return jsonb_build_object('desfeita', true, 'pecas_voltaram', v_voltaram, 'tiny', v_tiny, 'situacao_tiny', v_antes);
end;
$function$;

CREATE OR REPLACE FUNCTION public.plt_fn_motivo_salvar(p_id bigint, p_tipo text, p_texto text, p_ordem integer DEFAULT NULL::integer, p_ativo boolean DEFAULT true, p_especial boolean DEFAULT NULL::boolean)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_id       bigint;
  v_especial boolean;
begin
  if not plt_privado.fn_eh_admin() then
    raise exception 'Cadastrar motivo é gesto de admin.' using errcode = 'insufficient_privilege';
  end if;
  -- SESSAO-38 (D-169): + os motivos de stand-by; SESSAO-39 (D-173): + os do Mover
  if p_tipo not in ('nao_entregue', 'desfazer_entrega', 'devolucao', 'pausa', 'saida', 'standby', 'mover', 'entrega_parcial') then
    raise exception 'Tipo de motivo desconhecido.' using errcode = 'check_violation';
  end if;
  if char_length(btrim(coalesce(p_texto, ''))) not between 2 and 80 then
    raise exception 'O motivo precisa ter de 2 a 80 letras — uma frase curta.' using errcode = 'check_violation';
  end if;
  if coalesce(p_especial, false) and p_tipo <> 'pausa' then
    raise exception 'Só motivo de pausa pode ser especial.' using errcode = 'check_violation';
  end if;
  if p_id is null then
    insert into public.plt_motivos (tipo, texto, ordem, ativo, especial)
      values (p_tipo, btrim(p_texto), coalesce(p_ordem, 100), coalesce(p_ativo, true), coalesce(p_especial, false))
      returning id, especial into v_id, v_especial;
  else
    update public.plt_motivos
       set texto = btrim(p_texto), ordem = coalesce(p_ordem, ordem), ativo = coalesce(p_ativo, ativo),
           especial = coalesce(p_especial, especial),
           atualizado_em = now()
     where id = p_id and tipo = p_tipo
     returning id, especial into v_id, v_especial;
    if v_id is null then
      raise exception 'Motivo não encontrado.' using errcode = 'no_data_found';
    end if;
  end if;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (plt_privado.fn_usuario_atual(), 'motivo_salvo',
            jsonb_build_object('motivo_id', v_id, 'tipo', p_tipo, 'texto', btrim(p_texto),
                               'ativo', coalesce(p_ativo, true), 'especial', v_especial));
  return v_id;
exception when unique_violation then
  raise exception 'Já existe esse motivo.' using errcode = 'unique_violation';
end;
$function$;

-- ----------------------------------------------------------------------------
-- 9 · Permissões das portas recriadas com forma nova
-- ----------------------------------------------------------------------------
revoke all on function public.plt_fn_programadas(boolean, date, bigint, integer, integer) from public, anon;
grant execute on function public.plt_fn_programadas(boolean, date, bigint, integer, integer) to authenticated;
