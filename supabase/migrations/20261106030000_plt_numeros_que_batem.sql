-- ============================================================================
-- Ajuste de 06/11/2026 · OS NÚMEROS QUE NÃO BATIAM ENTRE AS TELAS
-- (achados na varredura de todas as telas do ajuste dos cabeçalhos; todos de
-- antes daquele ajuste; regras decididas pelo dono na conversa de 06/11)
--
--   1. ROTAS → Entregas → "A entregar" (D-267): o pedido CANCELADO no Tiny
--      depois de ir para as entregas (o 13686: lançado em 20/10, cancelado em
--      21/10) continuava na lista com os botões de entregar — e a entrega dele
--      é recusada. A porta passa a tirar do "a entregar" o pedido cancelado ou
--      excluído no Tiny, mesmo lançado ou programado (como a Programação e a
--      Expedição já fazem). O que já foi entregue fica no histórico.
--
--   2. Dashboards → Visão do dia (D-268): o painel conta o que o QUADRO mostra.
--      · "na fila" = a coluna da FILA do setor (a etapa marcada como fila) —
--        as colunas de estacionar (CANCELADO e NÃO ENCONTRADO da Limpeza: 48
--        cards) não entram; o card avulso entra (como no quadro);
--      · "em execução" = alguém trabalhando AGORA — o pausado não conta em
--        lugar nenhum do painel (resposta do dono);
--      · a espera mais antiga continua vindo daqui como tempo corrido desde a
--        chegada; a TELA a converte em horas de expediente com a mesma régua
--        do quadro (a régua já vem na abertura do app — D-172);
--      · "prontos esperando rota" (a coluna segue `aguardando_lancamento`) =
--        a MESMA regra dos candidatos da Programação (vw_pedidos_para_rota),
--        pronto e ainda sem programação — o programado já tem rota (os 4 que
--        sobravam: 13814, 13820, 13824, 13825). Desde a D-156 lançar não é passo.
--
--   3. Stand-by (D-269): o cancelamento no Tiny FECHA o stand-by sozinho, na
--      hora do cancelamento, com o registro do porquê (um fato novo — nada se
--      edita: RNF-05). O que já estava aberto em pedido cancelado (o 13649:
--      stand-by em 22/10, cancelado em 28/10) fecha aqui, com a hora do
--      cancelamento. E o painel de Motivos conta "em stand-by agora" (e o
--      "ainda segurado" de cada motivo) com a regra da aba Stand-by do PCP —
--      uma regra só: plt_privado.vw_standby_na_aba.
--
--   4. Rotas → Programação → Calendário (D-270): "Fora do calendário" conta só
--      o que NÃO aparece na grade — o sem rota com a previsão vencida FORA do
--      período mostrado (antes contava também os que estavam na grade).
--
-- Funções recriadas a partir da versão VIVA (md5 do corpo conferido em 06/11
-- contra o último create de cada uma nas migrations): plt_fn_rotas e
-- plt_fn_rotas_calendario (20261027040000), plt_fn_dash_agora (20260917120000),
-- plt_fn_dash_dia (20260928120000), plt_fn_dash_motivos (20261023030000),
-- plt_privado.fn_validar_standby (20261022050010). Mesmas assinaturas e mesmo
-- retorno (create or replace — as telas de antes continuam funcionando).
-- Novos: a visão plt_privado.vw_standby_na_aba (fechada à API), a função
-- plt_privado.fn_standby_fechar_no_cancelamento e o gatilho
-- plt_eventos_zz_standby_cancelado. Nenhuma tabela ou coluna nova.
-- Reaplicável: o fechamento retroativo só acha stand-by aberto em pedido
-- cancelado (depois da 1ª vez, nenhum).
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · "A entregar" sem o pedido cancelado ou excluído no Tiny (D-267)
-- ----------------------------------------------------------------------------
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
       -- ↪️ 06/11/2026 (D-267): o "a entregar" é de pedido que ainda existe no
       -- Tiny — o cancelado (ou excluído) lá sai daqui na hora, mesmo lançado ou
       -- programado (a entrega dele é recusada; a Programação e a Expedição já
       -- o tiram pela regra do vivo). O que já foi entregue fica no histórico.
       -- (o "começa com canc" na frente poupa a função por linha — E-166)
       and (pc.entrega_evento_id is not null
            or (not (lower(coalesce(p.situacao, '')) like 'canc%'
                     and plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
                and not exists (select 1 from public.plt_pedidos_excluidos_tiny x
                                 where x.pedido_id = p.id)))
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

-- ----------------------------------------------------------------------------
-- 2a · Visão do dia: a fila e a execução como o quadro mostra (D-268)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_agora()
returns table (
  setor_id            bigint,
  setor_nome          text,
  setor_codigo        text,
  na_fila             integer,
  em_execucao         integer,
  pessoas_executando  integer,
  espera_mais_antiga  interval
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with producao_ok as (
    select s.id, s.nome, s.codigo, s.ordem
      from public.plt_setores s
     where s.ativo
       and s.papel_no_fluxo = 'producao'
       and s.id in (select plt_privado.fn_setores_dashboard())
  ),
  -- ↪️ 06/11/2026 (D-268): o painel conta o que o QUADRO mostra — a peça e o
  -- card avulso; "na fila" = a coluna da fila do setor, sem ninguém nela (as
  -- colunas de estacionar, como CANCELADO e NÃO ENCONTRADO da Limpeza, não
  -- entram; o card ainda sem coluna — setor sem etapas — espera, é fila);
  -- "rodando" = alguém trabalhando AGORA (o pausado não conta em lugar nenhum
  -- do painel — resposta do dono). A espera continua em tempo corrido desde a
  -- chegada (lido_em − espera = a chegada do mais antigo): a tela a converte em
  -- horas de expediente com a régua do quadro.
  vivos as (
    select c.setor_atual_id, c.executor_atual_id, c.desde,
           (c.executor_atual_id is null and coalesce(et.eh_fila, true)) as na_fila,
           (c.executor_atual_id is not null and c.pausado_em is null)    as rodando
      from public.plt_cards c
      join producao_ok s on s.id = c.setor_atual_id
      left join public.plt_etapas et on et.id = c.etapa_atual_id
     where c.tipo in ('unidade', 'avulso')
       and c.arquivado_em is null
       and c.concluido_em is null
  )
  select s.id                                              as setor_id,
         s.nome                                            as setor_nome,
         s.codigo                                          as setor_codigo,
         count(*) filter (where v.na_fila)::int            as na_fila,
         count(*) filter (where v.rodando)::int            as em_execucao,
         count(distinct v.executor_atual_id) filter (where v.rodando)::int
                                                           as pessoas_executando,
         max(now() - v.desde) filter (where v.na_fila)     as espera_mais_antiga
    from producao_ok s
    left join vivos v on v.setor_atual_id = s.id
   group by s.id, s.nome, s.codigo, s.ordem
  union all
  select null, null, null,
         count(*) filter (where v.na_fila)::int,
         count(*) filter (where v.rodando)::int,
         count(distinct v.executor_atual_id) filter (where v.rodando)::int,
         max(now() - v.desde) filter (where v.na_fila)
    from vivos v
  having exists (select 1 from producao_ok)
   order by setor_id nulls last;
$$;

comment on function public.plt_fn_dash_agora() is
  'Visão do dia (SESSAO-16/D-42; ↪️ 06/11/2026 D-268 — painel = quadro): retrato de agora por setor de produção — na fila (a coluna da fila, peça e avulso, sem ninguém), em execução e pessoas (só quem trabalha AGORA; o pausado não conta), e a espera mais antiga da fila em tempo corrido (a tela converte em horas de expediente pela régua). A linha sem setor é o total. Gate por setor do dashboard (D-32).';

-- ----------------------------------------------------------------------------
-- 2b · Visão do dia: os prontos esperando rota = os candidatos da Programação (D-268)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_dia(
  p_dia date default null
)
returns table (
  concluidas_dia          integer,
  media_concluidas_4sem   numeric,
  danificados_dia         integer,
  aguardando_lancamento   integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with setores_ok as (
    select sd as id from plt_privado.fn_setores_dashboard() sd
  ),
  terminais_ok as (
    select s.id from public.plt_setores s
     where s.papel_no_fluxo = 'terminal'
       and s.id in (select id from setores_ok)
  ),
  dia as (
    select (coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date)::timestamp
            at time zone 'America/Fortaleza') as ini
  ),
  chegadas as (
    -- chegada de unidade a um terminal que este usuário mede, vinda de FORA
    -- dos terminais (S24: terminal → terminal é lançar ou devolver, não produzir)
    select distinct on (e.card_id, ((e.ocorrido_em at time zone 'America/Fortaleza')::date))
           e.card_id,
           (e.ocorrido_em at time zone 'America/Fortaleza')::date as dia_local
      from public.plt_eventos e
      join public.plt_cards c on c.id = e.card_id and c.tipo = 'unidade'
      left join public.plt_setores so on so.id = e.setor_origem_id
     where e.tipo = 'movimentacao_setor'
       and e.setor_destino_id in (select id from terminais_ok)
       and coalesce(so.papel_no_fluxo, '') <> 'terminal'
  )
  select
    (select count(*)::int from chegadas ch
      where ch.dia_local = (coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date)))
                                                   as concluidas_dia,
    (select round(count(*)::numeric / 4, 1) from chegadas ch
      where ch.dia_local in (
        coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date) - 7,
        coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date) - 14,
        coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date) - 21,
        coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date) - 28))
                                                   as media_concluidas_4sem,
    (select count(distinct e.card_id)::int
       from public.plt_eventos e
       join public.plt_etapas et on et.id = e.etapa_destino_id and et.eh_danificado
      where e.tipo in ('movimentacao_etapa', 'movimentacao_setor')
        and e.setor_destino_id in (select id from setores_ok)
        and e.ocorrido_em >= (select ini from dia)
        and e.ocorrido_em <  (select ini from dia) + interval '1 day')
                                                   as danificados_dia,
    -- ↪️ 06/11/2026 (D-268): "prontos esperando rota" (a coluna mantém o nome)
    -- = a MESMA regra dos candidatos da Programação — o pedido vivo, fora do
    -- stand-by e da decisão pós devolução, PRONTO (só frete = pronto, D-63) e
    -- ainda SEM programação. Desde a D-156 lançar não é passo: o programado já
    -- tem rota, e o cancelado/entregue no Tiny não é vivo.
    (select count(*)::int
       from plt_privado.vw_pedidos_para_rota v
      where v.pronto
        and v.programacao_data is null)
                                                   as aguardando_lancamento
   where exists (select 1 from terminais_ok);
$$;

comment on function public.plt_fn_dash_dia(date) is
  'Visão do dia (SESSAO-16; S24: concluída = chegou ao fim de linha vinda de fora dos terminais): concluídas no dia, média das mesmas 4 semanas, danificados do dia e (↪️ 06/11/2026 D-268) os pedidos PRONTOS ESPERANDO ROTA na coluna aguardando_lancamento — os candidatos da Programação prontos e sem programação. Vazio para quem não mede os terminais (D-32).';

-- ----------------------------------------------------------------------------
-- 3 · Stand-by: o cancelamento fecha; o painel conta a aba do PCP (D-269)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_standby()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.plt_cards%rowtype;
begin
  select * into v_card from public.plt_cards where id = new.card_id;
  if not found or v_card.tipo <> 'pedido' then
    raise exception 'Só o card do pedido entra em stand-by.' using errcode = 'check_violation';
  end if;
  if new.tipo = 'pedido_standby_entrou' then
    if v_card.standby_desde is not null then
      raise exception 'Este pedido já está em stand-by.' using errcode = 'check_violation';
    end if;
    if new.usuario_id is null then
      raise exception 'O stand-by é gesto de pessoa — é preciso dizer quem pôs.' using errcode = 'check_violation';
    end if;
    if nullif(btrim(coalesce(new.observacao, '')), '') is null then
      raise exception 'O stand-by pede o motivo.' using errcode = 'check_violation';
    end if;
  else
    if v_card.standby_desde is null then
      raise exception 'Este pedido não está em stand-by.' using errcode = 'check_violation';
    end if;
    if new.evento_referencia_id is distinct from v_card.standby_evento_id then
      raise exception 'A saída do stand-by precisa apontar o stand-by aberto.' using errcode = 'check_violation';
    end if;
    if coalesce(new.dados ->> 'destino', '') = 'cancelado' then
      -- ↪️ 06/11/2026 (D-269): só o cancelamento do pedido no Tiny fecha o
      -- stand-by sem destino — pela automação, com o pedido cancelado de fato.
      if new.origem <> 'automacao' or not plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
        raise exception 'Só o cancelamento do pedido no Tiny fecha o stand-by sem destino.'
          using errcode = 'check_violation';
      end if;
    elsif coalesce(new.dados ->> 'destino', '') not in ('aguardando', 'entregas') then
      raise exception 'Para onde o pedido vai ao sair do stand-by: aguardando liberação ou as entregas.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- O fecho pelo cancelamento: o fato `pedido_cancelado` (gravado pela reação ao
-- pedido quando o Tiny cancela) puxa a saída do stand-by aberto, na MESMA hora.
-- Só age com o stand-by aberto e o pedido cancelado de fato — as duas condições
-- que a validação acima confere —, então nunca derruba a gravação do Tiny.
create or replace function plt_privado.fn_standby_fechar_no_cancelamento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.plt_cards%rowtype;
begin
  select * into v_card from public.plt_cards where id = new.card_id for update;
  if not found or v_card.tipo <> 'pedido' or v_card.standby_desde is null
     or not plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
    return null;
  end if;
  insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao,
                                  evento_referencia_id, ocorrido_em, dados)
    values (v_card.id, 'pedido_standby_saiu', 'automacao', v_card.setor_atual_id,
            'Pedido cancelado no Tiny — o stand-by fechou sozinho.',
            v_card.standby_evento_id, greatest(new.ocorrido_em, v_card.standby_desde),
            jsonb_build_object('destino', 'cancelado',
                               'numero', (select p.numero from public.pedidos p where p.id = v_card.pedido_id),
                               'motivo_do_standby', v_card.standby_motivo,
                               'cancelamento_evento_id', new.id));
  return null;
end;
$$;

comment on function plt_privado.fn_standby_fechar_no_cancelamento() is
  'Ajuste 06/11/2026 (D-269): o cancelamento do pedido no Tiny fecha o stand-by aberto, na hora do cancelamento (fato pedido_standby_saiu com destino "cancelado", origem automação). Gatilho plt_eventos_zz_standby_cancelado.';

revoke all on function plt_privado.fn_standby_fechar_no_cancelamento() from public, anon, authenticated;

drop trigger if exists plt_eventos_zz_standby_cancelado on public.plt_eventos;
create trigger plt_eventos_zz_standby_cancelado
  after insert on public.plt_eventos
  for each row when (new.tipo = 'pedido_cancelado')
  execute function plt_privado.fn_standby_fechar_no_cancelamento();

-- O que já estava aberto em pedido cancelado (hoje, o 13649) fecha com a hora do
-- cancelamento — um fato novo, registrado agora (nada se edita: RNF-05).
insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao,
                                evento_referencia_id, ocorrido_em, dados)
select c.id, 'pedido_standby_saiu', 'automacao', c.setor_atual_id,
       'Pedido cancelado no Tiny — o stand-by fechou sozinho (registrado depois, na hora do cancelamento).',
       c.standby_evento_id,
       greatest(coalesce(canc.ocorrido_em, now()), c.standby_desde),
       jsonb_build_object('destino', 'cancelado', 'numero', p.numero,
                          'motivo_do_standby', c.standby_motivo,
                          'cancelamento_evento_id', canc.id, 'retroativo', true)
  from public.plt_cards c
  join public.pedidos p on p.id = c.pedido_id
  left join lateral (
    select e.id, e.ocorrido_em
      from public.plt_eventos e
     where e.card_id = c.id and e.tipo = 'pedido_cancelado'
     order by e.ocorrido_em desc, e.id desc
     limit 1
  ) canc on true
 where c.tipo = 'pedido'
   and c.standby_desde is not null
   and plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado';

-- A aba Stand-by do PCP como UMA regra (o painel de Motivos lê daqui; o quadro
-- do PCP tem o mesmo filtro no grupo 'standby' — o ensaio amarra os dois).
create or replace view plt_privado.vw_standby_na_aba as
  select c.id as card_id, c.standby_evento_id
    from public.plt_cards c
    join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
    join public.pedidos p on p.id = c.pedido_id
   where c.tipo = 'pedido'
     and c.standby_desde is not null
     and c.arquivado_em is null
     and c.liberado_completo_em is null
     and not plt_privado.fn_tiny_tirou_do_pcp(p.situacao)
     and exists (select 1 from plt_privado.vw_itens_producao v
                  where v.pedido_id = p.id and v.unidades > 0);

comment on view plt_privado.vw_standby_na_aba is
  'Ajuste 06/11/2026 (D-269): os pedidos que a aba Stand-by do PCP mostra (o mesmo filtro do grupo standby de plt_fn_pcp_quadro). O painel de Motivos conta "em stand-by agora" e o "ainda segurado" daqui.';

revoke all on plt_privado.vw_standby_na_aba from public, anon, authenticated;

create or replace function public.plt_fn_dash_motivos(
  p_de       timestamptz,
  p_ate      timestamptz,
  p_setor_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  a           record;
  v_producao  jsonb := null;
  v_pcp       jsonb := null;
  v_rotas     jsonb := null;
  v_qualidade jsonb := null;
begin
  if p_de is null or p_ate is null or p_ate <= p_de then
    raise exception 'Diga o período do painel.' using errcode = 'check_violation';
  end if;
  if p_ate - p_de > interval '400 days' then
    raise exception 'O painel mostra no máximo um ano por vez.' using errcode = 'check_violation';
  end if;
  select * into a from plt_privado.fn_motivos_alcance(p_setor_id);

  -- ---- PRODUÇÃO ------------------------------------------------------------
  if cardinality(a.producao) > 0 then
    with pausas as (
      -- cada linha = uma pessoa parada (o executor, quem ajudava, o PARADO);
      -- vezes = os gestos; tempo = o útil de cada pessoa (horas-pessoa paradas)
      -- (o tempo útil vem guardado; só a parada ainda aberta é calculada agora)
      select pp.evento_id, pp.usuario_id, pp.especial, pp.setor_id,
             case when pp.motivo_id is not null then 'id:' || pp.motivo_id else 'outro' end as chave,
             coalesce(m.texto, 'Outro (escrito na hora)') as motivo,
             coalesce(pp.segundos_uteis,
                      extract(epoch from plt_privado.fn_tempo_util(pp.inicio, now(), pp.setor_id, pp.usuario_id))::bigint) as seg
        from public.plt_pessoa_pausas pp
        left join public.plt_motivos m on m.id = pp.motivo_id
       where pp.inicio >= p_de and pp.inicio < p_ate
         and pp.setor_id = any (a.producao)
    ), saidas as (
      -- a saída do setor pelo tablet: o tempo útil até a pessoa entrar de novo
      -- (guardado na projeção; só a saída ainda aberta é calculada agora)
      select s.evento_id as id, s.usuario_id, s.setor_id,
             coalesce(nullif(btrim(split_part(s.motivo, ' — ', 1)), ''), 'Sem motivo') as motivo,
             coalesce(s.segundos_uteis,
                      extract(epoch from plt_privado.fn_tempo_util(s.inicio, now(), s.setor_id, s.usuario_id))::bigint) as seg
        from public.plt_presenca_saidas s
       where s.inicio >= p_de and s.inicio < p_ate
         and s.setor_id = any (a.producao)
    ), mover as (
      select e.id, e.setor_origem_id, e.setor_destino_id,
             case when (e.dados ->> 'motivo_id') is not null then 'id:' || (e.dados ->> 'motivo_id') else 'outro' end as chave,
             coalesce(m.texto, 'Outro (escrito na hora)') as motivo
        from public.plt_eventos e
        left join public.plt_motivos m on m.id = (e.dados ->> 'motivo_id')::bigint
       where (e.dados ->> 'como') = 'mover_para_fila'
         and e.ocorrido_em >= p_de and e.ocorrido_em < p_ate
         and (e.setor_origem_id = any (a.producao) or e.setor_destino_id = any (a.producao))
    )
    select jsonb_build_object(
      'pausas', coalesce((select jsonb_agg(to_jsonb(x) order by x.segundos desc, x.vezes desc, x.motivo)
                            from (select chave, max(motivo) as motivo, bool_or(especial) as especial,
                                         count(distinct evento_id)::int as vezes,
                                         coalesce(sum(seg), 0)::bigint as segundos
                                    from pausas group by chave) x), '[]'::jsonb),
      'pausas_por_setor', coalesce((select jsonb_agg(to_jsonb(x) order by x.segundos desc, x.vezes desc)
                            from (select p.setor_id, max(s.nome) as setor, count(distinct p.evento_id)::int as vezes,
                                         coalesce(sum(p.seg), 0)::bigint as segundos
                                    from pausas p join public.plt_setores s on s.id = p.setor_id
                                   group by p.setor_id) x), '[]'::jsonb),
      'pausas_por_pessoa', coalesce((select jsonb_agg(to_jsonb(x) order by x.segundos desc, x.vezes desc)
                            from (select p.usuario_id, max(u.nome) as nome, count(distinct p.evento_id)::int as vezes,
                                         coalesce(sum(p.seg), 0)::bigint as segundos
                                    from pausas p join public.plt_usuarios u on u.id = p.usuario_id
                                   group by p.usuario_id
                                   order by segundos desc, vezes desc limit 10) x), '[]'::jsonb),
      'saidas', coalesce((select jsonb_agg(to_jsonb(x) order by x.segundos desc, x.vezes desc, x.motivo)
                            from (select 'txt:' || lower(motivo) as chave, max(motivo) as motivo,
                                         count(*)::int as vezes, coalesce(sum(seg), 0)::bigint as segundos
                                    from saidas group by lower(motivo)) x), '[]'::jsonb),
      'mover', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.motivo)
                            from (select chave, max(motivo) as motivo, count(*)::int as vezes
                                    from mover group by chave) x), '[]'::jsonb),
      'mover_caminhos', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.de, x.para)
                            from (select so.nome as de, sd.nome as para, count(*)::int as vezes
                                    from mover mv
                                    join public.plt_setores so on so.id = mv.setor_origem_id
                                    join public.plt_setores sd on sd.id = mv.setor_destino_id
                                   group by so.nome, sd.nome
                                   order by vezes desc limit 10) x), '[]'::jsonb)
    ) into v_producao;

    -- ---- QUALIDADE (a marcação de saída — D-09/D-126) ----------------------
    with marcas as (
      select e.id, e.setor_origem_id as setor_id, e.estado_qualidade as estado
        from public.plt_eventos e
       where e.tipo = 'qualidade_marcada' and e.ocorrido_em >= p_de and e.ocorrido_em < p_ate
         and e.setor_origem_id = any (a.producao)
    ), divergencias as (
      select m.setor_id, count(*)::int as n
        from public.plt_eventos pa
        join marcas m on m.id = pa.evento_referencia_id
       where pa.tipo = 'qualidade_parecer' and pa.estado_qualidade is distinct from m.estado
       group by m.setor_id
    )
    select jsonb_build_object(
      'por_setor', coalesce(jsonb_agg(to_jsonb(x) order by x.danificado desc, x.atencao desc, x.setor), '[]'::jsonb))
      into v_qualidade
      from (select m.setor_id, max(s.nome) as setor,
                   count(*)::int as marcadas,
                   count(*) filter (where m.estado = 'atencao')::int as atencao,
                   count(*) filter (where m.estado = 'danificado')::int as danificado,
                   coalesce(max(d.n), 0)::int as divergencias
              from marcas m
              join public.plt_setores s on s.id = m.setor_id
              left join divergencias d on d.setor_id = m.setor_id
             group by m.setor_id
            having count(*) filter (where m.estado in ('atencao', 'danificado')) > 0
                or coalesce(max(d.n), 0) > 0) x;
  end if;

  -- ---- PCP: o stand-by (D-169) ----------------------------------------------
  if a.ver_pcp then
    -- ↪️ 06/11/2026 (D-269): a aba Stand-by do PCP, lida UMA vez — o "em stand-by
    -- agora" e o "ainda segurado" de cada motivo saem dela
    with na as materialized (
      select v.standby_evento_id from plt_privado.vw_standby_na_aba v
    ),
    sb as (
      select e.id,
             case when (e.dados ->> 'motivo_id') is not null then 'id:' || (e.dados ->> 'motivo_id') else 'outro' end as chave,
             coalesce(m.texto, 'Outro (escrito na hora)') as motivo,
             (sai.ocorrido_em is null and e.id in (select na.standby_evento_id from na)) as agora,
             -- o útil vem no fato da saída (1d); só o aberto e o antigo calculam agora
             coalesce(sai.seg,
                      extract(epoch from plt_privado.fn_tempo_util(e.ocorrido_em, coalesce(sai.ocorrido_em, now()),
                                                                   a.pcp_id, null))::bigint) as seg
        from public.plt_eventos e
        left join public.plt_motivos m on m.id = (e.dados ->> 'motivo_id')::bigint
        left join lateral (
          select s.ocorrido_em, (s.dados ->> 'segundos_uteis')::bigint as seg
            from public.plt_eventos s
           where s.evento_referencia_id = e.id and s.tipo = 'pedido_standby_saiu'
           order by s.id limit 1
        ) sai on true
       where e.tipo = 'pedido_standby_entrou' and e.ocorrido_em >= p_de and e.ocorrido_em < p_ate
    )
    select jsonb_build_object(
      'standby', coalesce((select jsonb_agg(to_jsonb(x) order by x.segundos desc, x.vezes desc, x.motivo)
                             from (select chave, max(motivo) as motivo, count(*)::int as vezes,
                                          count(*) filter (where agora)::int as agora,
                                          coalesce(sum(seg), 0)::bigint as segundos
                                     from sb group by chave) x), '[]'::jsonb),
      -- ↪️ 06/11/2026 (D-269): o mesmo número da aba Stand-by do PCP
      'em_standby_agora', (select count(*)::int from na)
    ) into v_pcp;
  end if;

  -- ---- ROTAS: não entrega, devolução e entrega desfeita (D-116/D-129) --------
  if a.ver_rotas then
    with f as (
      select e.id, e.tipo, e.usuario_id, e.origem,
             (e.dados ->> 'caminhao_id')::bigint as caminhao_id,
             case when (e.dados ->> 'motivo_id') is not null then 'id:' || (e.dados ->> 'motivo_id')
                  when e.origem = 'automacao' then 'tiny'
                  when e.dados ->> 'motivo' = 'reentrega' then 'reentrega'
                  else 'outro' end as chave,
             coalesce(m.texto,
                      case when e.origem = 'automacao' then 'Marcado no Tiny'
                           when e.dados ->> 'motivo' = 'reentrega' then 'Reentrega'
                           else 'Outro (escrito na hora)' end) as motivo
        from public.plt_eventos e
        left join public.plt_motivos m on m.id = (e.dados ->> 'motivo_id')::bigint
       where e.tipo in ('entrega_nao_realizada', 'pedido_devolvido', 'entrega_desfeita')
         and e.ocorrido_em >= p_de and e.ocorrido_em < p_ate
    )
    select jsonb_build_object(
      'nao_entregue', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.motivo)
                       from (select chave, max(motivo) as motivo, count(*)::int as vezes
                               from f where tipo = 'entrega_nao_realizada' group by chave) x), '[]'::jsonb),
      'devolucao', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.motivo)
                       from (select chave, max(motivo) as motivo, count(*)::int as vezes
                               from f where tipo = 'pedido_devolvido' group by chave) x), '[]'::jsonb),
      'desfeita', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.motivo)
                       from (select chave, max(motivo) as motivo, count(*)::int as vezes
                               from f where tipo = 'entrega_desfeita' group by chave) x), '[]'::jsonb),
      'por_caminhao', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.caminhao)
                       from (select f.caminhao_id, max(c.nome) as caminhao, count(*)::int as vezes
                               from f join public.plt_caminhoes c on c.id = f.caminhao_id
                              where f.tipo = 'entrega_nao_realizada' group by f.caminhao_id) x), '[]'::jsonb),
      'por_pessoa', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.nome)
                       from (select f.usuario_id, max(u.nome) as nome, count(*)::int as vezes
                               from f join public.plt_usuarios u on u.id = f.usuario_id
                              where f.tipo = 'entrega_nao_realizada' group by f.usuario_id
                              order by vezes desc limit 10) x), '[]'::jsonb),
      'entregues', (select count(*)::int from public.plt_eventos e
                     where e.tipo = 'pedido_entregue' and e.ocorrido_em >= p_de and e.ocorrido_em < p_ate)
    ) into v_rotas;
  end if;

  return jsonb_build_object(
    'de', p_de, 'ate', p_ate, 'setor_id', p_setor_id,
    'producao', v_producao, 'qualidade', v_qualidade, 'pcp', v_pcp, 'rotas', v_rotas);
end;
$$;

-- ----------------------------------------------------------------------------
-- 4 · Calendário: "Fora do calendário" só o que não aparece na grade (D-270)
-- ----------------------------------------------------------------------------
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
  -- ↪️ 06/11/2026 (D-270): a previsão vencida que cai DENTRO do período mostrado
  -- já está na grade (a parte 3 dos itens, com a mesma regra) — não é "fora".
  if v_desloc > 0 then
    v_resumo := jsonb_build_object('atrasados_sem_rota', 0, 'sem_previsao', 0);
  else
    select jsonb_build_object(
             'atrasados_sem_rota', count(*) filter (where v.data_prevista < v_hoje
                                                      and not (v.data_prevista between p_de and p_ate)),
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

comment on function public.plt_fn_rotas_calendario(date, date, integer, integer) is
  'SESSAO-39 (D-175): o calendário da programação (Rotas → Programação → Calendário) — de p_de a p_ate (até 6 semanas), cada pedido no seu dia: na_rota/entregue (dia programado), nao_entregue (o fato do dia), sem_rota/standby (dia da previsão). Por dia: total, contagem por situação e até p_por_dia barras (p_deslocamento = "Ver mais" de um dia). + fora (↪️ 06/11/2026 D-270): só o que não aparece na grade — sem rota com a previsão vencida FORA do período mostrado, e sem previsão. Uma requisição por tela; só a logística (fn_pode_ver_expedicao).';
