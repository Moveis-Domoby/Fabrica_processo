-- ============================================================================
-- SESSAO-56 (ajustes) · item 1 — QUEM ENTRA NUMA ROTA QUE JÁ EXISTE VAI PARA O
-- LUGAR MAIS PERTO (resposta do dono, 23/11/2026 22:55: "ele deve entrar no
-- local mais próximo na sequência lógica; caso queiram alterar, é só mudar ele
-- também").
--
-- Antes (migration 20261124100000 e as de antes dela): o pedido reprogramado
-- para outra rota (outro dia, caminhão ou rota) entrava SEM lugar guardado e a
-- tela o mostrava no fim; a parada avulsa nova entrava no fim.
--
-- Agora, no MESMO gesto (uma chamada só — Lei de desempenho):
--   · o item ganha lugar guardado onde a volta (fábrica → paradas → fábrica,
--     em linha reta) aumenta MENOS — a mesma regra que a tela usa ao incluir na
--     montagem (`inserirNaRota` em src/rotas/rotaRuas.ts); empate = a ida mais
--     curta (o mais perto da fábrica primeiro);
--   · os que já estavam NÃO mudam de ordem entre si: só abrem espaço, e as
--     posições são regravadas 1, 2, 3…;
--   · sem ponto no mapa → entra no FIM, com lugar guardado (não pula quando o
--     ponto chegar);
--   · rota vazia → é a 1ª parada (ordem 1);
--   · rota sem ordem salva (rota antiga) → primeiro a ordem que a tela mostrava
--     (a salva + a sugestão do mais perto a partir da última com ponto + os sem
--     ponto no fim — a mesma conta de `ordemDaRota`), depois a inserção.
--
-- Vale para: reprogramar (plt_fn_programar_entrega com outro dia/caminhão/rota),
-- programar um pedido sozinho (plt_fn_programar_entrega de um pedido que não
-- estava em rota nenhuma) e a parada avulsa nova SEM a ordem da tela
-- (plt_fn_parada_avulsa_salvar com p_ordem nulo — provisória: mesma regra).
--
-- NÃO vale para a MONTAGEM (plt_fn_programar_rota / plt_fn_programar_rota_paradas):
-- continua como a 56 deixou — o que já estava fica na ordem dele e o bloco novo
-- entra no fim, na ordem da montagem (a logística arrumou aquele bloco;
-- provisória). As duas ligam a marca `plt.rota_montagem` enquanto chamam as
-- portas de um item só, e a inserção não roda (o padrão de marca da casa).
--
-- Recriadas POR INTEIRO a partir da última versão nas migrations:
--   plt_fn_programar_entrega       ← 20261124100000_plt_ordem_da_rota_nao_muda
--   plt_fn_programar_rota          ← 20261014140000_plt_varias_rotas_por_dia
--   plt_fn_programar_rota_paradas  ← 20261027060000_plt_paradas_ordem_sem_arquivados
--   plt_fn_parada_avulsa_salvar    ← 20261112060000_plt_editar_endereco
-- (mesmas assinaturas — nada de drop; o site de antes segue funcionando).
-- Novas, fora da API: plt_privado.fn_distancia_km (a mesma conta de
-- `distanciaKm` em src/rotas/proximidade.ts) e plt_privado.fn_rota_inserir.
--
-- Nenhuma tabela, coluna ou índice novo. A leitura da rota usa os índices de
-- sempre (plt_programacoes_rota_idx, plt_paradas_avulsas_rota_idx) e o ponto
-- do pedido sai do cache do mapa pela chave única (plt_geocache.chave), a
-- mesma junção de plt_fn_programadas.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A distância em linha reta (haversine, raio 6371 km) — a mesma conta da tela
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_distancia_km(
  p_lat1 double precision, p_lon1 double precision, p_lat2 double precision, p_lon2 double precision
)
returns double precision
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select 2 * 6371 * asin(least(1, sqrt(
           power(sin(radians(p_lat2 - p_lat1) / 2), 2)
           + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lon2 - p_lon1) / 2), 2))));
$$;
comment on function plt_privado.fn_distancia_km(double precision, double precision, double precision, double precision) is
  'SESSAO-56 (ajustes): distância em linha reta em km (haversine, raio 6371) — a mesma conta de distanciaKm em src/rotas/proximidade.ts.';
revoke all on function plt_privado.fn_distancia_km(double precision, double precision, double precision, double precision) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2 · O item que acabou de entrar na rota vai para o lugar mais perto
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_rota_inserir(
  p_data date, p_caminhao_id bigint, p_rota integer, p_t text, p_id bigint
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- a fábrica: FABRICA em src/rotas/rotaRuas.ts (D-108) — mudou lá, muda aqui
  c_lat   constant double precision := -5.848;
  c_lon   constant double precision := -35.25428;
  v_t     text[]             := '{}';
  v_id    bigint[]           := '{}';
  v_ord   integer[]          := '{}';
  v_la    double precision[] := '{}';
  v_lo    double precision[] := '{}';
  v_atv   boolean[]          := '{}';
  v_tela  bigint[]           := '{}';
  v_novo  integer;
  v_n     integer;
  v_seq   integer[]          := '{}';
  v_resto integer[]          := '{}';
  v_sem   integer[]          := '{}';
  v_final integer[];
  r       record;
  i       integer;
  j       integer;
  k       integer;
  v_esc   integer;
  v_de    integer;
  v_melhor integer;
  v_at_la double precision;
  v_at_lo double precision;
  v_an_la double precision;
  v_an_lo double precision;
  v_de_la double precision;
  v_de_lo double precision;
  v_menor double precision;
  v_d     double precision;
  v_ate   double precision;
  v_volta double precision;
  v_ida   double precision;
  v_mvolta double precision;
  v_mida  double precision;
begin
  -- A rota como a tela a recebe, na ordem de chegada da tela: os pedidos (vivos)
  -- pelo número e depois as paradas (não removidas) pelo id. O ponto do pedido é
  -- o do cache do mapa pela mesma chave de plt_fn_programadas; a parada tem o seu.
  -- A parada já feita/não feita segue na ordem, mas sai do caminho (ativaNaRota).
  for r in
    select x.t, x.id, x.ordem, x.la, x.lo, x.atv, x.tela
      from (
        select 'p'::text as t, pr.card_id as id, pr.ordem::int as ordem,
               g.latitude as la, g.longitude as lo, true as atv,
               pr.card_id as tela, 0 as grupo, p.numero::bigint as chegada
          from public.plt_programacoes pr
          join public.plt_cards pc on pc.id = pr.card_id
          join public.pedidos p on p.id = pc.pedido_id
          left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = p.id
          left join public.plt_geocache g
                 on g.chave = md5(lower(plt_privado.fn_endereco_geocodificavel(
                                    ee.endereco, ee.numero, ee.bairro, ee.cidade, ee.uf, ee.cep)))
         where pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id and pr.rota = p_rota
           and pc.entrega_evento_id is null and pc.arquivado_em is null
        union all
        select 'a', pa.id, pa.ordem::int, pa.latitude, pa.longitude, pa.situacao = 'pendente',
               -pa.id, 1, pa.id
          from public.plt_paradas_avulsas pa
         where pa.data_entrega = p_data and pa.caminhao_id = p_caminhao_id and pa.rota = p_rota
           and pa.removida_em is null
      ) x
     order by x.grupo, x.chegada
     limit 401
  loop
    v_t    := v_t    || r.t;
    v_id   := v_id   || r.id;
    v_ord  := v_ord  || r.ordem;
    v_la   := v_la   || r.la;
    v_lo   := v_lo   || r.lo;
    v_atv  := v_atv  || r.atv;
    v_tela := v_tela || r.tela;
    if r.t = p_t and r.id = p_id then
      v_novo := cardinality(v_t);
    end if;
  end loop;
  if v_novo is null then
    return; -- o item não está (mais) na rota: nada a fazer
  end if;
  v_n := cardinality(v_t);

  -- 1 · A ordem que a tela mostrava SEM o novo (a mesma conta de ordemDaRota):
  --     a salva (ordem, e o id da tela no empate) …
  select coalesce(array_agg(x order by v_ord[x], v_tela[x]), '{}') into v_seq
    from generate_series(1, v_n) as x
   where x <> v_novo and v_ord[x] is not null;
  --     … e, na rota antiga sem ordem salva, a sugestão do mais perto a partir
  --     da última com ponto (ou da fábrica); os sem ponto no fim, na ordem de chegada
  v_at_la := c_lat;
  v_at_lo := c_lon;
  foreach i in array v_seq loop
    if v_la[i] is not null and v_lo[i] is not null then
      v_at_la := v_la[i];
      v_at_lo := v_lo[i];
    end if;
  end loop;
  for i in 1 .. v_n loop
    if i <> v_novo and v_ord[i] is null then
      if v_la[i] is not null and v_lo[i] is not null then
        v_resto := v_resto || i;
      else
        v_sem := v_sem || i;
      end if;
    end if;
  end loop;
  while cardinality(v_resto) > 0 loop
    v_menor := 'Infinity';
    v_esc := 1;
    for j in 1 .. cardinality(v_resto) loop
      v_d := plt_privado.fn_distancia_km(v_at_la, v_at_lo, v_la[v_resto[j]], v_lo[v_resto[j]]);
      if v_d < v_menor then
        v_menor := v_d;
        v_esc := j;
      end if;
    end loop;
    i := v_resto[v_esc];
    v_seq := v_seq || i;
    v_at_la := v_la[i];
    v_at_lo := v_lo[i];
    v_resto := v_resto[1 : v_esc - 1] || v_resto[v_esc + 1 :];
  end loop;
  v_seq := v_seq || v_sem;

  -- 2 · O novo entra onde a volta aumenta menos (inserirNaRota); sem ponto, no fim
  if v_la[v_novo] is null or v_lo[v_novo] is null then
    v_final := v_seq || v_novo;
  else
    v_melhor := cardinality(v_seq);
    v_mvolta := 'Infinity';
    v_mida   := 'Infinity';
    for i in 0 .. cardinality(v_seq) loop
      -- antes: o último com ponto (no caminho) até a posição i; senão a fábrica
      v_an_la := c_lat;
      v_an_lo := c_lon;
      for j in reverse i .. 1 loop
        k := v_seq[j];
        if v_atv[k] and v_la[k] is not null and v_lo[k] is not null then
          v_an_la := v_la[k];
          v_an_lo := v_lo[k];
          exit;
        end if;
      end loop;
      -- depois: o primeiro com ponto (no caminho) dali em diante; senão a volta à fábrica
      v_de := null;
      for j in i + 1 .. cardinality(v_seq) loop
        k := v_seq[j];
        if v_atv[k] and v_la[k] is not null and v_lo[k] is not null then
          v_de := k;
          exit;
        end if;
      end loop;
      if v_de is null then
        v_de_la := c_lat;
        v_de_lo := c_lon;
      else
        v_de_la := v_la[v_de];
        v_de_lo := v_lo[v_de];
      end if;
      v_ate   := plt_privado.fn_distancia_km(v_an_la, v_an_lo, v_la[v_novo], v_lo[v_novo]);
      v_volta := v_ate + plt_privado.fn_distancia_km(v_la[v_novo], v_lo[v_novo], v_de_la, v_de_lo)
                       - plt_privado.fn_distancia_km(v_an_la, v_an_lo, v_de_la, v_de_lo);
      -- sem ninguém depois, a ida só cresce do último até o novo (a volta não conta)
      v_ida := case when v_de is null then v_ate else v_volta end;
      if (abs(v_volta - v_mvolta) >= 1e-9 and v_volta < v_mvolta)
         or (abs(v_volta - v_mvolta) < 1e-9 and v_ida < v_mida - 1e-9) then
        v_melhor := i;
        v_mvolta := v_volta;
        v_mida   := v_ida;
      end if;
    end loop;
    v_final := v_seq[1 : v_melhor] || v_novo || v_seq[v_melhor + 1 :];
  end if;

  -- 3 · Grava 1, 2, 3… (só a linha que muda é tocada; mudar só a ordem não
  --     gera linha na trilha — fn_logar_programacao; a entrada do item já gerou)
  for j in 1 .. cardinality(v_final) loop
    k := v_final[j];
    if v_t[k] = 'p' then
      update public.plt_programacoes set ordem = j where card_id = v_id[k] and ordem is distinct from j;
    else
      update public.plt_paradas_avulsas set ordem = j where id = v_id[k] and ordem is distinct from j;
    end if;
  end loop;
  perform plt_privado.fn_avisar('rotas');
end;
$$;

comment on function plt_privado.fn_rota_inserir(date, bigint, integer, text, bigint) is
  'SESSAO-56 (ajustes, resposta do dono de 23/11): o item (p = pedido/card, a = parada) que acabou de entrar na rota ganha lugar guardado onde a volta fábrica → paradas → fábrica (linha reta) aumenta menos — a regra de inserirNaRota; os outros não mudam de ordem entre si; sem ponto = no fim; rota vazia = 1; rota sem ordem salva = primeiro a ordem que a tela mostrava (ordemDaRota), depois a inserção.';

revoke all on function plt_privado.fn_rota_inserir(date, bigint, integer, text, bigint) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3 · Programar / reprogramar um pedido: quem ENTRA vai para o lugar mais perto
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_programar_entrega(
  p_card_id      bigint,
  p_data         date,
  p_caminhao_id  bigint,
  p_rota         integer default null,
  p_ordem_origem jsonb   default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_card    public.plt_cards%rowtype;
  v_atual   public.plt_programacoes%rowtype;
  v_rota    integer;
  v_nova    boolean;
  v_id      bigint;
  v_muda    boolean;
  v_entrou  boolean;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma programa entregas.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Programar entrega é gesto da logística (PCP/terminais) ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_data is null then
    raise exception 'Escolha o dia da entrega.' using errcode = 'check_violation';
  end if;

  select * into v_card from public.plt_cards
   where id = p_card_id and tipo = 'pedido' and arquivado_em is null;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  -- D-45: reprograma a qualquer instante, nunca depois de entregue.
  if plt_privado.fn_entregue(p_card_id) then
    raise exception 'Este pedido já foi entregue — a programação não muda mais.' using errcode = 'check_violation';
  end if;
  -- SESSAO-38 (D-156): o "lançado para ROTAS" deixou de ser exigência — todo
  -- pedido VIVO se programa (pronto, em produção ou ainda no PCP). A regra dos
  -- candidatos é uma só: plt_privado.vw_pedidos_para_rota.
  if not exists (select 1 from plt_privado.vw_pedidos_para_rota v where v.card_id = p_card_id) then
    if plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
      raise exception 'Este pedido foi cancelado no Tiny — não vai para a rota.' using errcode = 'check_violation';
    elsif v_card.devolucao_evento_id is not null then
      raise exception 'Este pedido está em decisão pós devolução — decida a situação das peças antes de programar.'
        using errcode = 'check_violation';
    end if;
    raise exception 'Este pedido não está mais em andamento (encerrado no Tiny ou sem peça na fábrica) — não vai para a rota.'
      using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.plt_caminhoes cm
                  where cm.id = p_caminhao_id and cm.arquivado_em is null) then
    raise exception 'Caminhão não encontrado ou arquivado — escolha outro.' using errcode = 'no_data_found';
  end if;

  -- SESSAO-31 (D-128): sem rota dita, o pedido fica na rota em que já está
  -- (mesmo dia e caminhão) ou entra na última rota do caminhão no dia.
  select * into v_atual from public.plt_programacoes where card_id = p_card_id;
  v_rota := coalesce(p_rota,
                     case when v_atual.card_id is not null and v_atual.data_entrega = p_data
                               and v_atual.caminhao_id = p_caminhao_id then v_atual.rota::int end,
                     plt_privado.fn_rota_padrao(p_data, p_caminhao_id));
  if v_rota < 1 or v_rota > 20 then
    raise exception 'A rota vai de 1 a 20 no mesmo dia e caminhão.' using errcode = 'check_violation';
  end if;
  v_nova := not exists (select 1 from public.plt_programacoes pr
                         where pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id
                           and pr.rota = v_rota and pr.card_id <> p_card_id);

  -- SESSAO-56 (bloco B): o pedido está SAINDO de uma rota (outro dia, caminhão ou rota)?
  v_muda := v_atual.card_id is not null
            and (v_atual.data_entrega is distinct from p_data
                 or v_atual.caminhao_id is distinct from p_caminhao_id
                 or v_atual.rota        is distinct from v_rota);

  -- SESSAO-56 (ajustes): o pedido está ENTRANDO numa rota (não estava em
  -- nenhuma, ou veio de outra) → ganha o lugar mais perto lá (fn_rota_inserir)
  v_entrou := v_atual.card_id is null or v_muda;

  insert into public.plt_programacoes as pr
         (card_id, data_entrega, caminhao_id, rota, criado_por_id, atualizado_por_id)
       values (p_card_id, p_data, p_caminhao_id, v_rota, v_usuario, v_usuario)
  on conflict (card_id) do update
     set data_entrega = excluded.data_entrega,
         caminhao_id  = excluded.caminhao_id,
         rota         = excluded.rota,
         atualizado_por_id = excluded.atualizado_por_id,
         -- SESSAO-28 (D-109): noutro dia/caminhão (ou noutra rota — D-128) a
         -- ordem antiga não vale. ↪️ SESSAO-56 (ajustes): logo abaixo o pedido
         -- ganha o lugar mais perto na rota nova (fn_rota_inserir).
         ordem = case when pr.data_entrega is distinct from excluded.data_entrega
                        or pr.caminhao_id  is distinct from excluded.caminhao_id
                        or pr.rota         is distinct from excluded.rota
                      then null else pr.ordem end
  returning id into v_id;

  if v_nova then
    perform plt_privado.fn_equipe_herdar(p_data, p_caminhao_id, v_rota, v_usuario);
  end if;
  -- SESSAO-56 (bloco B): o pedido SAIU de uma rota → os que ficaram nela
  -- mantêm a ordem que a tela mostrava (sem a lista — o site de antes — nada muda)
  if v_muda then
    perform plt_privado.fn_rota_ordem_que_fica(v_atual.data_entrega, v_atual.caminhao_id, v_atual.rota::int, p_ordem_origem);
  end if;
  -- SESSAO-56 (ajustes — resposta do dono, 23/11): quem entra numa rota vai para
  -- o lugar mais perto na sequência (rota vazia = 1ª parada; sem ponto = fim).
  -- Na MONTAGEM (marca plt.rota_montagem) não: o bloco novo vai no fim, na ordem dela.
  if v_entrou and coalesce(current_setting('plt.rota_montagem', true), '') <> 'on' then
    perform plt_privado.fn_rota_inserir(p_data, p_caminhao_id, v_rota, 'p', p_card_id);
  end if;
  return v_id;
end;
$$;
comment on function public.plt_fn_programar_entrega(bigint, date, bigint, integer, jsonb) is
  'D-45: programa ou reprograma a entrega (dia + caminhão + rota — D-128); recusa depois de entregue; candidato = pedido vivo (D-156). SESSAO-56 (bloco B): p_ordem_origem = a ordem que a tela mostrava para os que FICAM na rota de onde ele saiu (gravada no mesmo gesto; nula = nada muda lá).';

revoke all on function public.plt_fn_programar_entrega(bigint, date, bigint, integer, jsonb) from public, anon;
grant execute on function public.plt_fn_programar_entrega(bigint, date, bigint, integer, jsonb) to authenticated;

comment on function public.plt_fn_programar_entrega(bigint, date, bigint, integer, jsonb) is
  'D-45: programa ou reprograma a entrega (dia + caminhão + rota — D-128); recusa depois de entregue; candidato = pedido vivo (D-156). SESSAO-56 (bloco B): p_ordem_origem = a ordem que a tela mostrava para os que FICAM na rota de onde ele saiu (gravada no mesmo gesto; nula = nada muda lá). SESSAO-56 (ajustes): o pedido que ENTRA numa rota ganha o lugar mais perto (fn_rota_inserir) — menos na montagem.';
revoke all on function public.plt_fn_programar_entrega(bigint, date, bigint, integer, jsonb) from public, anon;
grant execute on function public.plt_fn_programar_entrega(bigint, date, bigint, integer, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 4 · A montagem (vários pedidos): continua como a 56 deixou — marca plt.rota_montagem
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_programar_rota(
  p_data        date,
  p_caminhao_id bigint,
  p_card_ids    bigint[],
  p_ordem       bigint[] default null,
  p_rota        integer  default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card  bigint;
  v_rota  integer;
  v_marca text;
begin
  if coalesce(cardinality(p_card_ids), 0) = 0 then
    raise exception 'Escolha ao menos um pedido para programar.' using errcode = 'check_violation';
  end if;
  if cardinality(p_card_ids) > 200 then
    raise exception 'Pedidos demais numa programação só.' using errcode = 'check_violation';
  end if;
  -- SESSAO-31 (D-128): todos vão para a MESMA rota — a dita, ou a última do
  -- caminhão no dia (decidida uma vez, antes do primeiro entrar).
  v_rota := coalesce(p_rota, plt_privado.fn_rota_padrao(p_data, p_caminhao_id));
  -- SESSAO-56 (ajustes): a MONTAGEM não usa o "lugar mais perto" de quem entra
  -- sozinho — o bloco vai no fim, na ordem da montagem (provisória)
  v_marca := current_setting('plt.rota_montagem', true);
  perform set_config('plt.rota_montagem', 'on', true);
  foreach v_card in array p_card_ids loop
    perform public.plt_fn_programar_entrega(v_card, p_data, p_caminhao_id, v_rota);
  end loop;
  perform set_config('plt.rota_montagem', coalesce(v_marca, ''), true);
  if p_ordem is not null then
    perform public.plt_fn_ordenar_rota(p_data, p_caminhao_id, p_ordem, v_rota);
  end if;
  return cardinality(p_card_ids);
end;
$$;
comment on function public.plt_fn_programar_rota(date, bigint, bigint[], bigint[], integer) is
  'SESSAO-28 ajustes (D-111): programa vários pedidos no mesmo dia e caminhão numa transação só e, com p_ordem, salva a ordem da rota. SESSAO-31 (D-128): + a rota (sem rota = a última do caminhão no dia). SESSAO-56 (ajustes): a montagem não usa o lugar mais perto (marca plt.rota_montagem) — o bloco vai no fim, na ordem dela.';
revoke all on function public.plt_fn_programar_rota(date, bigint, bigint[], bigint[], integer) from public, anon;
grant execute on function public.plt_fn_programar_rota(date, bigint, bigint[], bigint[], integer) to authenticated;

-- ----------------------------------------------------------------------------
-- 5 · A montagem com paradas avulsas: a mesma marca
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_programar_rota_paradas(
  p_data        date,
  p_caminhao_id bigint,
  p_rota        integer,
  p_card_ids    bigint[],
  p_paradas     jsonb,
  p_ordem       jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_mapa   jsonb := '{}'::jsonb;
  v_par    jsonb;
  v_id     bigint;
  v_ordem  jsonb;
  v_resto  jsonb;
  v_marca  text;
begin
  if v_eu is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Programar a rota é da logística.' using errcode = 'insufficient_privilege';
  end if;
  -- SESSAO-56 (ajustes): a MONTAGEM não usa o "lugar mais perto" — as paradas
  -- novas entram sem ele e a ordem da tela (ou o fim) decide (provisória)
  v_marca := current_setting('plt.rota_montagem', true);
  perform set_config('plt.rota_montagem', 'on', true);
  if coalesce(array_length(p_card_ids, 1), 0) > 0 then
    perform public.plt_fn_programar_rota(p_data, p_caminhao_id, p_card_ids, null::bigint[], p_rota);
  end if;
  for v_par in select * from jsonb_array_elements(coalesce(p_paradas, '[]'::jsonb))
  loop
    v_id := (public.plt_fn_parada_avulsa_salvar(
      null, p_data, p_caminhao_id, p_rota, v_par ->> 'titulo', v_par ->> 'endereco',
      (v_par ->> 'latitude')::double precision, (v_par ->> 'longitude')::double precision,
      v_par ->> 'observacao', null, null) ->> 'id')::bigint;
    v_mapa := v_mapa || jsonb_build_object(v_par ->> 'k', v_id);
  end loop;
  perform set_config('plt.rota_montagem', coalesce(v_marca, ''), true);
  if p_ordem is not null and jsonb_array_length(p_ordem) > 0 then
    -- a ordem da tela (o novo + o que a rota já tinha, que vai depois, na ordem dele)
    select jsonb_agg(case when e ->> 't' = 'n' then jsonb_build_object('t', 'a', 'id', (v_mapa ->> (e ->> 'k'))::bigint)
                          else e end order by i)
      into v_ordem
      from jsonb_array_elements(p_ordem) with ordinality as t(e, i);
    select coalesce(jsonb_agg(x.e order by x.o nulls last, x.k), '[]'::jsonb) into v_resto from (
      select jsonb_build_object('t', 'p', 'id', pr.card_id) as e, pr.ordem as o, 'p' || pr.card_id as k
        from public.plt_programacoes pr join public.plt_cards pc on pc.id = pr.card_id
       where pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id and pr.rota = p_rota
         and pc.entrega_evento_id is null and pc.arquivado_em is null and not (pr.card_id = any (coalesce(p_card_ids, '{}'::bigint[])))
      union all
      select jsonb_build_object('t', 'a', 'id', pa.id), pa.ordem, 'a' || pa.id
        from public.plt_paradas_avulsas pa
       where pa.data_entrega = p_data and pa.caminhao_id = p_caminhao_id and pa.rota = p_rota
         and pa.removida_em is null and not exists (select 1 from jsonb_each_text(v_mapa) m where m.value::bigint = pa.id)
    ) x;
    perform plt_privado.fn_rota_aplicar_ordem(p_data, p_caminhao_id, p_rota, v_ordem || v_resto);
  end if;
  return jsonb_build_object('paradas', v_mapa);
end;
$$;

revoke all on function public.plt_fn_programar_rota_paradas(date, bigint, integer, bigint[], jsonb, jsonb) from public, anon;
grant execute on function public.plt_fn_programar_rota_paradas(date, bigint, integer, bigint[], jsonb, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 6 · A parada avulsa nova sem a ordem da tela: o lugar mais perto (provisória)
-- ----------------------------------------------------------------------------
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
    elsif coalesce(current_setting('plt.rota_montagem', true), '') <> 'on' then
      -- SESSAO-56 (ajustes — provisória: a mesma regra do pedido): sem a ordem
      -- da tela, a parada nova vai para o lugar mais perto da rota (rota vazia =
      -- 1ª; sem ponto = fim). Na montagem (marca plt.rota_montagem), fica no fim.
      perform plt_privado.fn_rota_inserir(p_data, p_caminhao_id, v_rota, 'a', v_id);
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

revoke all on function public.plt_fn_parada_avulsa_salvar(bigint, date, bigint, integer, text, text, double precision, double precision, text, jsonb, uuid) from public, anon;
grant execute on function public.plt_fn_parada_avulsa_salvar(bigint, date, bigint, integer, text, text, double precision, double precision, text, jsonb, uuid) to authenticated;
