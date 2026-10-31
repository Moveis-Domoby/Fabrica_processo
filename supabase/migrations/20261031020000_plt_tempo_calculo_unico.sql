-- ============================================================================
-- SESSAO-42 · F3 (31/10/2026) — O CÁLCULO ÚNICO dos tempos de produção.
--
-- Hoje há três relógios (o card corre o relógio; as dashboards cortam o fora
-- do horário mas contam o almoço, por linha, a cada abertura; a presença não
-- corta nada) — o mesmo armário deu 876 min no card, 66 em Pessoas e 14h37 em
-- Tempos por pessoa. Aqui nasce UMA conta, mantida no fato (M-13), que todas
-- as telas passam a ler:
--
--   TRECHO   = o período contínuo em que uma pessoa ficou com um card rodando
--              (execução ou auxílio) num setor; chave = o fato que o abriu.
--   PASSAGEM = a estadia do card num setor de produção, da entrada à saída
--              (mudar de etapa dentro do setor não abre outra); chave = o fato
--              da entrada (a decisão manual aponta para ela — estável).
--
--   As regras da demanda (1–19): só o que cai nas janelas do setor conta
--   (fn_tempo_janelas); o trecho vale até o fim do expediente do dia em que
--   começou (fn_tempo_corte — a manhã sem retomar não conta); pausa não conta;
--   o trabalho simultâneo da mesma pessoa é dividido (cada minuto vale 1/N
--   para cada card e conta uma vez no tempo dela); volta para a fila em até
--   5 min = clique errado (descartado); passagem rápida, longa, de retrabalho,
--   de gesto de admin, sem registro e antes da data oficial ficam fora da
--   média (situação + motivo); a decisão manual (fato novo) vence a regra.
--
--   Projeções: plt_tempo_trechos, plt_tempo_passagens, plt_tempo_padrao
--   (mediana, P25, P75, n por setor × modelo) e os resumos por dia
--   (plt_tempo_resumo_modelo_dia, plt_tempo_resumo_pessoa_dia). Escritas SÓ
--   pelas funções do cálculo: no fato (gatilho de restrição ADIADO — o card é
--   refeito uma vez por transação, por mais fatos que o gesto gere) e pela
--   fila de recálculo (em lotes, despertador por fato). Os fatos nunca mudam
--   (RNF-05).
--
-- No fim: recalcula tudo desde 19/10 (o começo do uso real).
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · O fato da DECISÃO MANUAL (regra 14) — o tipo novo do evento
--     (recriado com a lista de 20261028020000 + 'tempo_decisao'; só esta
--     migration valida — E-19: o validate saiu da 20261028020000)
-- ----------------------------------------------------------------------------
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
  'data_entrega_alterada', 'peca_vinculada',
  'tempo_decisao'  -- SESSAO-42 (regra 14): Considerar / Descartar / Desfazer de uma passagem, com motivo
]::text[])) not valid;
alter table public.plt_eventos validate constraint plt_eventos_tipo_check;

-- ----------------------------------------------------------------------------
-- 2 · As projeções
-- ----------------------------------------------------------------------------
create table if not exists public.plt_tempo_trechos (
  inicio_evento_id bigint primary key references public.plt_eventos(id),
  card_id          bigint not null references public.plt_cards(id),
  setor_id         bigint not null references public.plt_setores(id),
  etapa_id         bigint references public.plt_etapas(id),
  passagem_id      bigint not null,               -- = plt_tempo_passagens.id (o fato da entrada)
  usuario_id       uuid not null references public.plt_usuarios(id),
  papel            text not null check (papel in ('execucao', 'auxilio')),
  lote             text,                          -- "Montar juntos" (o mesmo valor nos cards do lote)
  execucao_id      bigint,                        -- o iniciar (execução) ou o auxilio_iniciado de que o trecho faz parte
  inicio           timestamptz not null,
  fim              timestamptz,                   -- nulo = rodando
  fim_evento_id    bigint,
  fim_tipo         text check (fim_tipo in ('pausa', 'fim_expediente', 'sem_resposta', 'esquecido', 'movimento',
                                            'volta', 'setor', 'transferencia', 'finalizado', 'arquivado')),
  corte            timestamptz,                   -- o fim do expediente do dia (regra 2); nulo = não corta
  fim_conta        timestamptz not null,          -- até onde conta: min(fim ou agora, corte)
  janelas          tstzmultirange not null default '{}'::tstzmultirange, -- o que conta, já recortado
  util_s           numeric not null default 0,    -- segundos que contam (antes da divisão)
  segundos         numeric not null default 0,    -- depois da divisão (regra 6) — o esforço da pessoa
  descartado       boolean not null default false,-- volta rápida para a fila (regra 9)
  dia              date not null,                 -- dia do início, no fuso da fábrica
  calculado_em     timestamptz not null default now()
);
create index if not exists plt_tempo_trechos_card_idx on public.plt_tempo_trechos (card_id);
create index if not exists plt_tempo_trechos_pessoa_idx on public.plt_tempo_trechos (usuario_id, inicio);
create index if not exists plt_tempo_trechos_passagem_idx on public.plt_tempo_trechos (passagem_id);
create index if not exists plt_tempo_trechos_setor_dia_idx on public.plt_tempo_trechos (setor_id, dia);
create index if not exists plt_tempo_trechos_dia_idx on public.plt_tempo_trechos (dia, usuario_id);
create index if not exists plt_tempo_trechos_abertos_idx on public.plt_tempo_trechos (usuario_id) where fim is null;
create index if not exists plt_tempo_trechos_etapa_idx on public.plt_tempo_trechos (etapa_id);
alter table public.plt_tempo_trechos add column if not exists execucao_id bigint;
create index if not exists plt_tempo_trechos_execucao_idx on public.plt_tempo_trechos (execucao_id);
create index if not exists plt_tempo_trechos_inicio_idx on public.plt_tempo_trechos (inicio);
-- a lista de execuções (a 1ª página do período, da mais nova)
create index if not exists plt_tempo_trechos_execucoes_idx on public.plt_tempo_trechos (inicio desc)
  where papel = 'execucao' and inicio_evento_id = execucao_id;
comment on table public.plt_tempo_trechos is
  'SESSAO-42 (F3): PROJEÇÃO — cada período contínuo em que uma pessoa ficou com um card rodando (execução ou auxílio) num setor de produção, já com a régua: até onde conta (o fim do expediente do dia — regra 2), as janelas que contam, os segundos (antes e depois da divisão do trabalho simultâneo — regra 6) e o descarte do clique errado (regra 9). Escrita só pelo cálculo (fn_tempo_card_refazer).';

create table if not exists public.plt_tempo_passagens (
  id                 bigint primary key references public.plt_eventos(id), -- o fato da entrada no setor
  card_id            bigint not null references public.plt_cards(id),
  setor_id           bigint not null references public.plt_setores(id),
  entrada_em         timestamptz not null,
  origem_setor_id    bigint references public.plt_setores(id),
  saida_em           timestamptz,                   -- nulo = o card ainda está no setor
  saida_evento_id    bigint,
  saida_por          uuid references public.plt_usuarios(id),
  destino_setor_id   bigint references public.plt_setores(id),
  dia                date,                          -- dia da SAÍDA, no fuso da fábrica (regra 15)
  modelo_id          bigint references public.plt_tempo_modelos(id),
  modelo_chave       text,
  primeiro_inicio    timestamptz,
  fila_s             numeric not null default 0,    -- útil da entrada ao 1º trecho
  execucao_s         numeric not null default 0,    -- TEMPO DO MÓVEL: a união dos trechos, com a divisão
  execucao_fechada_s numeric not null default 0,    -- o mesmo, só dos trechos fechados (o card soma o vivo)
  execucao_bruta_s   numeric not null default 0,    -- a união dos trechos, sem divisão
  parado_s           numeric not null default 0,    -- útil no setor sem ninguém no card (depois do 1º trecho)
  total_s            numeric not null default 0,    -- útil da entrada à saída
  esforco_s          numeric not null default 0,    -- soma de pessoa × tempo (regra 18)
  pessoas            uuid[] not null default '{}',
  trechos_n          integer not null default 0,
  lote               boolean not null default false,
  admin              boolean not null default false,
  retrabalho_entrada boolean not null default false,
  desfecho           text not null default 'aberta'
                     check (desfecho in ('aberta', 'concluida', 'retrabalho', 'saiu')),
  situacao           text not null default 'aberta'
                     check (situacao in ('aberta', 'valida', 'conferir', 'retrabalho', 'admin',
                                         'sem_registro', 'teste', 'descartada')),
  motivo             text,
  decisao_evento_id  bigint,
  calculado_em       timestamptz not null default now()
);
create index if not exists plt_tempo_passagens_card_idx on public.plt_tempo_passagens (card_id);
create index if not exists plt_tempo_passagens_modelo_idx on public.plt_tempo_passagens (setor_id, modelo_id, dia);
create index if not exists plt_tempo_passagens_dia_idx on public.plt_tempo_passagens (dia, setor_id);
create index if not exists plt_tempo_passagens_conferir_idx
  on public.plt_tempo_passagens (setor_id, dia desc, id desc) where situacao = 'conferir';
create index if not exists plt_tempo_passagens_abertas_idx on public.plt_tempo_passagens (card_id) where saida_em is null;
create index if not exists plt_tempo_passagens_modelo_fk_idx on public.plt_tempo_passagens (modelo_id);
create index if not exists plt_tempo_passagens_chave_idx on public.plt_tempo_passagens (modelo_chave);
create index if not exists plt_tempo_passagens_origem_idx on public.plt_tempo_passagens (origem_setor_id);
create index if not exists plt_tempo_passagens_destino_idx on public.plt_tempo_passagens (destino_setor_id);
create index if not exists plt_tempo_passagens_saida_por_idx on public.plt_tempo_passagens (saida_por);
comment on table public.plt_tempo_passagens is
  'SESSAO-42 (F3): PROJEÇÃO — a estadia de um card num setor de produção, com a fila útil, o TEMPO DO MÓVEL (a união dos trechos, com a divisão), o parado, o total, o esforço, as pessoas, o modelo, o desfecho e a SITUAÇÃO (válida, a conferir, retrabalho, gesto de admin, sem registro, teste, descartada) com o motivo. A decisão manual (fato tempo_decisao) vence a regra. Escrita só pelo cálculo.';

create table if not exists public.plt_tempo_padrao (
  setor_id      bigint not null references public.plt_setores(id),
  modelo_id     bigint not null references public.plt_tempo_modelos(id),
  mediana_s     numeric not null,
  p25_s         numeric not null,
  p75_s         numeric not null,
  n             integer not null,
  atualizado_em timestamptz not null default now(),
  primary key (setor_id, modelo_id)
);
create index if not exists plt_tempo_padrao_modelo_idx on public.plt_tempo_padrao (modelo_id);
comment on table public.plt_tempo_padrao is
  'SESSAO-42 (F3 · regra 16): o TEMPO PADRÃO de cada modelo em cada setor — mediana, P25 e P75 do tempo do móvel das passagens válidas da janela do setor (90 dias), e quantas. Refeito só para o modelo da passagem que mudou.';

create table if not exists public.plt_tempo_resumo_modelo_dia (
  dia            date not null,
  setor_id       bigint not null references public.plt_setores(id),
  modelo_id      bigint references public.plt_tempo_modelos(id),
  n_total        integer not null default 0,
  n_validas      integer not null default 0,
  n_conferir     integer not null default 0,
  n_retrabalho   integer not null default 0,
  n_admin        integer not null default 0,
  n_sem_registro integer not null default 0,
  n_teste        integer not null default 0,
  n_descartadas  integer not null default 0,
  execucao_validas_s numeric not null default 0,
  execucao_s     numeric not null default 0,
  fila_s         numeric not null default 0,
  parado_s       numeric not null default 0,
  esforco_s      numeric not null default 0
);
create unique index if not exists plt_tempo_resumo_modelo_dia_uk
  on public.plt_tempo_resumo_modelo_dia (dia, setor_id, coalesce(modelo_id, 0));
create index if not exists plt_tempo_resumo_modelo_dia_setor_idx
  on public.plt_tempo_resumo_modelo_dia (setor_id, modelo_id, dia);
create index if not exists plt_tempo_resumo_modelo_dia_modelo_idx on public.plt_tempo_resumo_modelo_dia (modelo_id);
comment on table public.plt_tempo_resumo_modelo_dia is
  'SESSAO-42 (F3): RESUMO por dia (da saída) × setor × modelo — quantas passagens em cada situação e as somas (tempo do móvel das válidas, fila, parado, esforço). Os painéis somam daqui, sem varrer passagens.';

create table if not exists public.plt_tempo_resumo_pessoa_dia (
  dia          date not null,
  usuario_id   uuid not null references public.plt_usuarios(id),
  setor_id     bigint references public.plt_setores(id),   -- nulo = à deriva
  trabalhando_s numeric not null default 0,  -- o esforço (trechos fechados, divididos) + a carência
  carencia_s   numeric not null default 0,   -- os 5 min sem card que contam como trabalho (D-197)
  ausente_s    numeric not null default 0,
  especial_s   numeric not null default 0,
  deriva_s     numeric not null default 0,
  trechos_n    integer not null default 0,
  passagens_n  integer not null default 0,
  esforco_s    numeric not null default 0,   -- só os trechos (sem a carência) — Pessoas
  bruto_s      numeric not null default 0    -- o relógio dos trechos até o corte — Pessoas
);
alter table public.plt_tempo_resumo_pessoa_dia add column if not exists esforco_s numeric not null default 0;
alter table public.plt_tempo_resumo_pessoa_dia add column if not exists bruto_s numeric not null default 0;
create unique index if not exists plt_tempo_resumo_pessoa_dia_uk
  on public.plt_tempo_resumo_pessoa_dia (dia, usuario_id, coalesce(setor_id, 0));
create index if not exists plt_tempo_resumo_pessoa_dia_pessoa_idx
  on public.plt_tempo_resumo_pessoa_dia (usuario_id, dia);
create index if not exists plt_tempo_resumo_pessoa_dia_setor_idx on public.plt_tempo_resumo_pessoa_dia (setor_id, dia);
comment on table public.plt_tempo_resumo_pessoa_dia is
  'SESSAO-42 (F3/F4): RESUMO por dia × pessoa × setor — trabalhando (o esforço dos trechos fechados, cada minuto uma vez só, + a carência de 5 min), ausente, parado especial e à deriva SÓ dentro das janelas do setor (ninguém passa da jornada sem hora extra). Os trechos e a presença ABERTOS somam na leitura.';

alter table public.plt_tempo_trechos            enable row level security;
alter table public.plt_tempo_passagens          enable row level security;
alter table public.plt_tempo_padrao             enable row level security;
alter table public.plt_tempo_resumo_modelo_dia  enable row level security;
alter table public.plt_tempo_resumo_pessoa_dia  enable row level security;
revoke all on public.plt_tempo_trechos, public.plt_tempo_passagens, public.plt_tempo_padrao,
              public.plt_tempo_resumo_modelo_dia, public.plt_tempo_resumo_pessoa_dia
  from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3 · O modelo do card (sugerido na primeira vez que o nome aparece)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_modelo_do_nome(p_nome text, out o_modelo_id bigint, out o_chave text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  o_chave := plt_privado.fn_tempo_modelo_chave(p_nome);
  if o_chave is null then
    return;
  end if;
  select k.modelo_id into o_modelo_id from public.plt_tempo_modelo_chaves k where k.chave = o_chave;
  if o_modelo_id is null then
    perform pg_advisory_xact_lock(hashtext('plt-tempo-modelo:' || o_chave));
    select k.modelo_id into o_modelo_id from public.plt_tempo_modelo_chaves k where k.chave = o_chave;
    if o_modelo_id is null then
      insert into public.plt_tempo_modelos (nome) values (left(plt_privado.fn_tempo_modelo_nome(p_nome), 160))
        returning id into o_modelo_id;
      insert into public.plt_tempo_modelo_chaves (chave, modelo_id, exemplo)
        values (o_chave, o_modelo_id, left(coalesce(p_nome, ''), 200));
    end if;
  end if;
end;
$$;
comment on function plt_privado.fn_tempo_modelo_do_nome(text) is
  'SESSAO-42 (regra 17): o modelo de um móvel pelo nome — a chave limpa (sem pedido, sem "(n/m)", sem parênteses, sem a cor); chave nova nasce como modelo SUGERIDO (o admin confirma, junta ou separa).';
revoke all on function plt_privado.fn_tempo_modelo_do_nome(text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4 · TRECHOS e o esqueleto das PASSAGENS de um card, a partir dos fatos
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_card_trechos(p_card_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  e            record;
  v_setor      bigint;
  v_etapa      bigint;
  v_papel      text;
  v_pass       bigint;           -- a passagem aberta (o fato da entrada)
  v_setor_ant  bigint;           -- de onde o card veio
  v_exec       bigint;           -- o trecho de execução aberto
  v_exec_quem  uuid;             -- quem executa (continua na pausa)
  v_exec_ini   bigint;           -- o iniciar da execução (as retomadas fazem parte dela)
  v_aux_ini    jsonb := '{}';    -- pessoa → o auxilio_iniciado
  v_lote       text;
  v_aux        jsonb := '{}';    -- pessoa → trecho de auxílio aberto
  v_tipo_fim   text;
  v_dest       bigint;
  v_fila_dest  boolean;
  v_ordem_or   integer;
  v_ordem_de   integer;
  v_k          text;
  v_nome       text;
  v_mod        record;
  v_arquivado  boolean := false;
begin
  delete from public.plt_tempo_trechos where card_id = p_card_id;
  delete from public.plt_tempo_passagens where card_id = p_card_id;

  for e in
    select ev.id, ev.tipo, ev.usuario_id, ev.ocorrido_em, ev.setor_destino_id, ev.etapa_origem_id,
           ev.etapa_destino_id, ev.dados
      from public.plt_eventos ev
     where ev.card_id = p_card_id
       and ev.tipo in ('card_criado', 'movimentacao_setor', 'movimentacao_etapa', 'execucao_iniciada',
                       'execucao_pausada', 'execucao_retomada', 'execucao_finalizada', 'avulso_concluido',
                       'card_arquivado', 'card_desarquivado', 'peca_alocada', 'auxilio_iniciado',
                       'auxilio_pausado', 'auxilio_retomado', 'auxilio_encerrado')
       and not exists (select 1 from public.plt_eventos x
                        where x.card_id = p_card_id and x.tipo = 'estorno' and x.evento_referencia_id = ev.id)
     order by ev.ocorrido_em, ev.id
  loop
    -- fecha o que estava aberto quando o fato o encerra
    v_tipo_fim := case
      when e.tipo in ('card_criado', 'movimentacao_setor') then 'setor'
      when e.tipo = 'movimentacao_etapa' then 'movimento'
      when e.tipo = 'execucao_iniciada' then 'transferencia'
      when e.tipo = 'execucao_pausada' then case
             when coalesce((e.dados ->> 'fim_expediente')::boolean, false) then 'fim_expediente'
             when coalesce((e.dados ->> 'sem_resposta')::boolean, false) then 'sem_resposta'
             when coalesce((e.dados ->> 'card_esquecido')::boolean, false) then 'esquecido'
             else 'pausa' end
      when e.tipo in ('execucao_finalizada', 'avulso_concluido') then 'finalizado'
      when e.tipo in ('card_arquivado', 'peca_alocada') then 'arquivado'
    end;

    if e.tipo = 'movimentacao_etapa' and e.setor_destino_id is not null and e.setor_destino_id <> v_setor then
      v_tipo_fim := 'setor';
    elsif e.tipo = 'movimentacao_etapa' then
      -- voltou para a fila (ou para uma etapa anterior) do mesmo setor: a regra 9
      select coalesce(d.eh_fila, false), d.ordem, o.ordem into v_fila_dest, v_ordem_de, v_ordem_or
        from public.plt_etapas d left join public.plt_etapas o on o.id = coalesce(e.etapa_origem_id, v_etapa)
       where d.id = e.etapa_destino_id;
      if v_fila_dest or v_ordem_de < v_ordem_or then
        v_tipo_fim := 'volta';
      end if;
    end if;

    if v_tipo_fim is not null and v_exec is not null then
      update public.plt_tempo_trechos set fim = e.ocorrido_em, fim_evento_id = e.id, fim_tipo = v_tipo_fim
       where inicio_evento_id = v_exec;
      v_exec := null;
    end if;
    if e.tipo in ('card_criado', 'movimentacao_setor', 'movimentacao_etapa', 'execucao_finalizada',
                  'avulso_concluido', 'card_arquivado', 'peca_alocada') then
      v_exec_quem := null;
      v_lote := null;
      -- os auxílios fecham junto (o fato auxilio_encerrado da automação vem logo depois)
      for v_k in select jsonb_object_keys(v_aux) loop
        update public.plt_tempo_trechos set fim = e.ocorrido_em, fim_evento_id = e.id,
               fim_tipo = case when v_tipo_fim = 'transferencia' then 'movimento' else v_tipo_fim end
         where inicio_evento_id = (v_aux ->> v_k)::bigint and fim is null;
      end loop;
      v_aux := '{}';
    end if;

    -- a posição
    if e.tipo in ('card_criado', 'movimentacao_setor')
       or (e.tipo = 'movimentacao_etapa' and e.setor_destino_id is not null and e.setor_destino_id <> v_setor) then
      v_dest := coalesce(e.setor_destino_id, v_setor);
      if v_pass is not null then
        update public.plt_tempo_passagens
           set saida_em = e.ocorrido_em, saida_evento_id = e.id, saida_por = e.usuario_id, destino_setor_id = v_dest
         where id = v_pass;
        v_pass := null;
      end if;
      v_setor_ant := v_setor;
      v_setor := v_dest;
      select s.papel_no_fluxo into v_papel from public.plt_setores s where s.id = v_setor;
      if v_papel = 'producao' and not v_arquivado then
        insert into public.plt_tempo_passagens (id, card_id, setor_id, entrada_em, origem_setor_id)
          values (e.id, p_card_id, v_setor, e.ocorrido_em, v_setor_ant);
        v_pass := e.id;
      end if;
    end if;
    if e.tipo in ('card_criado', 'movimentacao_setor', 'movimentacao_etapa') then
      v_etapa := coalesce(e.etapa_destino_id, v_etapa);
    end if;

    if e.tipo in ('card_arquivado', 'peca_alocada') then
      v_arquivado := true;
      if v_pass is not null then
        update public.plt_tempo_passagens
           set saida_em = e.ocorrido_em, saida_evento_id = e.id, saida_por = e.usuario_id
         where id = v_pass;
        v_pass := null;
      end if;
    elsif e.tipo = 'card_desarquivado' then
      v_arquivado := false;
      select s.papel_no_fluxo into v_papel from public.plt_setores s where s.id = v_setor;
      if v_papel = 'producao' and v_pass is null then
        insert into public.plt_tempo_passagens (id, card_id, setor_id, entrada_em, origem_setor_id)
          values (e.id, p_card_id, v_setor, e.ocorrido_em, v_setor);
        v_pass := e.id;
      end if;
    end if;

    -- abre o que o fato abre
    if v_pass is not null and e.usuario_id is not null then
      if e.tipo = 'execucao_iniciada' then
        v_exec_quem := e.usuario_id;
        v_exec_ini := e.id;
        v_lote := nullif(e.dados ->> 'lote', '');
      end if;
      if e.tipo = 'auxilio_iniciado' then
        v_aux_ini := v_aux_ini || jsonb_build_object(e.usuario_id::text, e.id);
      end if;
      if e.tipo = 'execucao_iniciada' or (e.tipo = 'execucao_retomada' and v_exec_quem is not null and v_exec is null) then
        insert into public.plt_tempo_trechos (inicio_evento_id, card_id, setor_id, etapa_id, passagem_id, usuario_id,
                                             papel, lote, execucao_id, inicio, fim_conta, dia)
          values (e.id, p_card_id, v_setor, v_etapa, v_pass, v_exec_quem, 'execucao', v_lote, coalesce(v_exec_ini, e.id), e.ocorrido_em,
                  e.ocorrido_em, (e.ocorrido_em at time zone 'America/Fortaleza')::date);
        v_exec := e.id;
      elsif e.tipo in ('auxilio_iniciado', 'auxilio_retomado') and not (v_aux ? e.usuario_id::text) then
        insert into public.plt_tempo_trechos (inicio_evento_id, card_id, setor_id, etapa_id, passagem_id, usuario_id,
                                             papel, execucao_id, inicio, fim_conta, dia)
          values (e.id, p_card_id, v_setor, v_etapa, v_pass, e.usuario_id, 'auxilio',
                  coalesce((v_aux_ini ->> e.usuario_id::text)::bigint, e.id), e.ocorrido_em,
                  e.ocorrido_em, (e.ocorrido_em at time zone 'America/Fortaleza')::date);
        v_aux := v_aux || jsonb_build_object(e.usuario_id::text, e.id);
      elsif e.tipo in ('auxilio_pausado', 'auxilio_encerrado') and v_aux ? e.usuario_id::text then
        update public.plt_tempo_trechos set fim = e.ocorrido_em, fim_evento_id = e.id,
               fim_tipo = case when e.tipo = 'auxilio_pausado' then
                                 case when coalesce((e.dados ->> 'fim_expediente')::boolean, false) then 'fim_expediente'
                                      when coalesce((e.dados ->> 'sem_resposta')::boolean, false) then 'sem_resposta'
                                      else 'pausa' end
                               else 'movimento' end
         where inicio_evento_id = (v_aux ->> e.usuario_id::text)::bigint;
        v_aux := v_aux - e.usuario_id::text;
      end if;
    end if;
  end loop;

  -- o modelo de todas as passagens do card (o nome do móvel)
  select coalesce(nullif(btrim(c.item_descricao), ''), nullif(btrim(c.titulo), '')) into v_nome
    from public.plt_cards c where c.id = p_card_id;
  select * into v_mod from plt_privado.fn_tempo_modelo_do_nome(v_nome);
  update public.plt_tempo_passagens set modelo_id = v_mod.o_modelo_id, modelo_chave = v_mod.o_chave
   where card_id = p_card_id;

  -- a régua de cada trecho: o corte, até onde conta, as janelas, os segundos, o clique errado
  update public.plt_tempo_trechos t
     set corte = x.corte,
         fim_conta = x.fim_conta,
         janelas = x.janelas,
         util_s = plt_privado.fn_tempo_segundos(x.janelas),
         segundos = plt_privado.fn_tempo_segundos(x.janelas),
         descartado = coalesce(t.fim_tipo = 'volta', false)
                      and plt_privado.fn_tempo_segundos(x.janelas) <= (plt_privado.fn_tempo_regra(t.setor_id)).volta_rapida_min * 60,
         calculado_em = now()
    from (select y.inicio_evento_id, y.corte, y.fim_conta,
                 plt_privado.fn_tempo_janelas(y.setor_id, y.inicio, y.fim_conta, y.usuario_id) as janelas
            from (select z.inicio_evento_id, z.setor_id, z.inicio, z.usuario_id, z.corte,
                         greatest(z.inicio, least(coalesce(z.fim, now()), coalesce(z.corte, 'infinity'::timestamptz))) as fim_conta
                    from (select w.inicio_evento_id, w.setor_id, w.inicio, w.fim, w.usuario_id,
                                 plt_privado.fn_tempo_corte(w.setor_id, w.inicio, w.usuario_id) as corte
                            from public.plt_tempo_trechos w where w.card_id = p_card_id) z) y) x
   where t.inicio_evento_id = x.inicio_evento_id;
  update public.plt_tempo_trechos set segundos = 0 where card_id = p_card_id and descartado;
end;
$$;
comment on function plt_privado.fn_tempo_card_trechos(bigint) is
  'SESSAO-42 (F3): refaz, a partir dos fatos do card (sem os estornados), os TRECHOS (execução: do iniciar/retomar à pausa/mover/finalizar/outro iniciar; auxílio: do iniciar/retomar à pausa/fim) e o esqueleto das PASSAGENS (entrada e saída de cada setor de produção) — com a régua de cada trecho (corte do fim do expediente, janelas, segundos, clique errado) e o modelo. Os números da passagem vêm depois (fn_tempo_passagens_medir).';
revoke all on function plt_privado.fn_tempo_card_trechos(bigint) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5 · A DIVISÃO do trabalho simultâneo da mesma pessoa (regra 6): cada pedaço
--     de tempo vale 1/N para cada um dos N trechos dela abertos ao mesmo
--     tempo. Devolve os cards cujos números mudaram.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_dividir(p_usuario_id uuid, p_de timestamptz, p_ate timestamptz)
returns setof bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_de  timestamptz;
  v_ate timestamptz;
begin
  -- o vizinho do vizinho: os trechos que tocam a janela, e a faixa inteira deles
  select min(t.inicio), max(t.fim_conta) into v_de, v_ate
    from public.plt_tempo_trechos t
   where t.usuario_id = p_usuario_id and not t.descartado
     and t.inicio < p_ate and t.fim_conta > p_de;
  if v_de is null then
    return;
  end if;
  return query
  with t as (
    select x.inicio_evento_id, x.card_id, x.inicio, x.fim_conta, x.janelas, x.segundos
      from public.plt_tempo_trechos x
     where x.usuario_id = p_usuario_id and not x.descartado
       and x.inicio < v_ate and x.fim_conta > v_de and x.fim_conta > x.inicio
  ),
  marcos as (
    select distinct m from (select inicio as m from t union all select fim_conta from t) q
  ),
  pedacos as (
    select m as a, lead(m) over (order by m) as z from marcos
  ),
  n as (
    select p.a, p.z, count(*) as n
      from pedacos p join t on t.inicio <= p.a and t.fim_conta >= p.z
     where p.z is not null
     group by p.a, p.z
  ),
  novo as (
    select t.inicio_evento_id, t.card_id, t.segundos as antes,
           coalesce(sum(plt_privado.fn_tempo_segundos(t.janelas * tstzmultirange(tstzrange(n.a, n.z))) / n.n), 0) as depois
      from t left join n on t.inicio <= n.a and t.fim_conta >= n.z
     group by t.inicio_evento_id, t.card_id, t.segundos
  ),
  mudou as (
    update public.plt_tempo_trechos x set segundos = round(novo.depois, 3)
      from novo
     where x.inicio_evento_id = novo.inicio_evento_id and round(novo.depois, 3) is distinct from x.segundos
    returning x.card_id
  )
  select distinct card_id from mudou;
end;
$$;
comment on function plt_privado.fn_tempo_dividir(uuid, timestamptz, timestamptz) is
  'SESSAO-42 (regra 6): divide o tempo da pessoa entre os trechos dela abertos ao mesmo tempo (lote na Montagem, ou o limite maior dos outros setores) — cada pedaço vale 1/N para cada card e o esforço dela conta uma vez só. Devolve os cards cujos segundos mudaram.';
revoke all on function plt_privado.fn_tempo_dividir(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6 · O TEMPO DO MÓVEL de uma passagem (regra 18): o relógio enquanto pelo
--     menos uma pessoa trabalhou nele — a união dos trechos —, cada pedaço
--     valendo o maior 1/N das pessoas que estavam nele (a divisão da regra 6)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_movel(p_passagem_id bigint, p_so_fechados boolean default false)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with tc as (
    select t.usuario_id, t.inicio, t.fim_conta, t.janelas
      from public.plt_tempo_trechos t
     where t.passagem_id = p_passagem_id and not t.descartado and t.fim_conta > t.inicio
       and (not p_so_fechados or t.fim is not null)
  ),
  u as (
    select coalesce(range_agg(j.r), '{}'::tstzmultirange) as mr from tc cross join lateral unnest(tc.janelas) as j(r)
  ),
  tp as (
    select x.usuario_id, x.inicio, x.fim_conta
      from public.plt_tempo_trechos x
     where not x.descartado and x.fim_conta > x.inicio
       and x.usuario_id in (select usuario_id from tc)
       and x.inicio < (select max(fim_conta) from tc) and x.fim_conta > (select min(inicio) from tc)
  ),
  marcos as (
    select distinct m from (select inicio as m from tp union all select fim_conta from tp) q
  ),
  ped as (
    select m as a, lead(m) over (order by m) as z from marcos
  ),
  w as (
    select p.a, p.z,
           max(1.0 / greatest(1, (select count(*) from tp
                                   where tp.usuario_id = tc.usuario_id and tp.inicio <= p.a and tp.fim_conta >= p.z))) as w
      from ped p
      join tc on tc.inicio <= p.a and tc.fim_conta >= p.z
     where p.z is not null
     group by p.a, p.z
  )
  select coalesce(round(sum(plt_privado.fn_tempo_segundos((select mr from u) * tstzmultirange(tstzrange(w.a, w.z))) * w.w), 3), 0)
    from w;
$$;
revoke all on function plt_privado.fn_tempo_movel(bigint, boolean) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7 · A SITUAÇÃO de uma passagem (regras 7, 8, 10–14)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_classificar(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p       public.plt_tempo_passagens%rowtype;
  r       public.plt_tempo_regras;
  v_ofic  date;
  v_dec   record;
  v_pad   public.plt_tempo_padrao%rowtype;
  v_sit   text;
  v_mot   text;
begin
  select * into p from public.plt_tempo_passagens where id = p_id;
  if p.id is null then
    return;
  end if;
  -- a decisão manual mais recente desta passagem ("desfazer" devolve à regra)
  select ev.id, ev.dados ->> 'decisao' as decisao into v_dec
    from public.plt_eventos ev
   where ev.card_id = p.card_id and ev.tipo = 'tempo_decisao'
     and (ev.dados ->> 'passagem_id') = p.id::text
     and not exists (select 1 from public.plt_eventos x where x.card_id = p.card_id and x.tipo = 'estorno'
                      and x.evento_referencia_id = ev.id)
   order by ev.ocorrido_em desc, ev.id desc
   limit 1;

  if p.saida_em is null then
    v_sit := 'aberta';
  else
    r := plt_privado.fn_tempo_regra(p.setor_id);
    select c.data_oficial into v_ofic from public.plt_tempo_config c where c.id = 1;
    if p.dia < coalesce(v_ofic, date '2026-10-26') then
      v_sit := 'teste'; v_mot := 'Antes da data oficial';                          -- regra 13
    elsif v_dec.decisao = 'considerar' then
      v_sit := 'valida'; v_mot := 'Considerada à mão';                             -- regra 14
    elsif v_dec.decisao = 'descartar' then
      v_sit := 'descartada'; v_mot := 'Descartada à mão';
    elsif p.admin and r.admin_fora then
      v_sit := 'admin'; v_mot := 'Gesto de administrador';                         -- regra 12
    elsif (p.retrabalho_entrada or p.desfecho = 'retrabalho') and r.retrabalho_fora then
      v_sit := 'retrabalho';                                                       -- regra 10
      v_mot := case when p.desfecho = 'retrabalho' then 'Voltou para um setor anterior' else 'Passagem de retrabalho' end;
    elsif p.trechos_n = 0 or p.execucao_bruta_s = 0 then
      v_sit := 'sem_registro'; v_mot := 'Saiu sem ninguém iniciar';                -- regra 11
    elsif p.execucao_s < r.minimo_min * 60 then
      v_sit := 'conferir'; v_mot := 'Rápida demais';                               -- regra 7
    elsif r.teto_min is not null and p.execucao_s > r.teto_min * 60 then
      v_sit := 'conferir'; v_mot := 'Acima do teto do setor';                      -- regra 8
    else
      select * into v_pad from public.plt_tempo_padrao d where d.setor_id = p.setor_id and d.modelo_id = p.modelo_id;
      if v_pad.n >= r.base_minima and p.execucao_s > r.fator_longo * v_pad.mediana_s then
        v_sit := 'conferir'; v_mot := 'Longa para o modelo';                       -- regra 8
      else
        v_sit := 'valida';
      end if;
    end if;
  end if;
  if v_sit is distinct from p.situacao or v_mot is distinct from p.motivo or v_dec.id is distinct from p.decisao_evento_id then
    update public.plt_tempo_passagens set situacao = v_sit, motivo = v_mot, decisao_evento_id = v_dec.id
     where id = p_id;
  end if;
end;
$$;
comment on function plt_privado.fn_tempo_classificar(bigint) is
  'SESSAO-42 (regras 7–14): a situação da passagem — aberta; teste (saiu antes da data oficial); a decisão manual (considerar/descartar) vence o resto; gesto de administrador; retrabalho (voltou para trás, ou a volta); sem registro (saiu sem ninguém iniciar); a conferir (rápida, acima do teto, longa para o modelo — fator × mediana com base mínima); senão válida.';
revoke all on function plt_privado.fn_tempo_classificar(bigint) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8 · Os NÚMEROS das passagens de um card (dos trechos já calculados)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_passagens_medir(p_card_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p          record;
  v_ret_prox jsonb := '{}';   -- setor → a próxima passagem nasce com retrabalho
  v_ordem    integer;
  v_ordem_or integer;
  v_ordem_de integer;
  v_papel_de text;
  v_desf     text;
  v_ret      boolean;
begin
  for p in
    select x.* from public.plt_tempo_passagens x where x.card_id = p_card_id order by x.entrada_em, x.id
  loop
    select s.ordem into v_ordem from public.plt_setores s where s.id = p.setor_id;
    select s.ordem into v_ordem_or from public.plt_setores s
     where s.id = p.origem_setor_id and s.papel_no_fluxo = 'producao';
    select s.ordem, s.papel_no_fluxo into v_ordem_de, v_papel_de from public.plt_setores s where s.id = p.destino_setor_id;
    v_desf := case
      when p.saida_em is null then 'aberta'
      when p.destino_setor_id is null then 'saiu'
      when v_papel_de = 'producao' and v_ordem_de < v_ordem then 'retrabalho'
      when v_papel_de = 'entrada' then 'saiu'
      else 'concluida' end;
    -- veio de um setor de produção posterior, ou é a volta ao setor de onde saiu para trás
    v_ret := coalesce(v_ordem_or > v_ordem, false) or v_ret_prox ? p.setor_id::text;
    if v_desf = 'retrabalho' then
      v_ret_prox := v_ret_prox || jsonb_build_object(p.setor_id::text, true);
    elsif p.saida_em is not null then
      v_ret_prox := v_ret_prox - p.setor_id::text;
    end if;

    update public.plt_tempo_passagens x
       set dia = (p.saida_em at time zone 'America/Fortaleza')::date,
           desfecho = v_desf,
           retrabalho_entrada = v_ret,
           primeiro_inicio = m.primeiro,
           fila_s = plt_privado.fn_tempo_segundos(plt_privado.fn_tempo_janelas(
                      p.setor_id, p.entrada_em, coalesce(m.primeiro, p.saida_em, now()))),
           total_s = m.total,
           execucao_bruta_s = m.bruta,
           execucao_s = plt_privado.fn_tempo_movel(p.id, false),
           execucao_fechada_s = case when m.abertos = 0 then plt_privado.fn_tempo_movel(p.id, false)
                                     else plt_privado.fn_tempo_movel(p.id, true) end,
           parado_s = greatest(0, m.total
                                  - plt_privado.fn_tempo_segundos(plt_privado.fn_tempo_janelas(
                                      p.setor_id, p.entrada_em, coalesce(m.primeiro, p.saida_em, now())))
                                  - m.bruta),
           esforco_s = m.esforco,
           pessoas = m.pessoas,
           trechos_n = m.n,
           lote = m.lote,
           admin = m.admin,
           calculado_em = now()
      from (
        select min(t.inicio) filter (where not t.descartado) as primeiro,
               plt_privado.fn_tempo_segundos(plt_privado.fn_tempo_janelas(p.setor_id, p.entrada_em, coalesce(p.saida_em, now()))) as total,
               (select plt_privado.fn_tempo_segundos(coalesce(range_agg(j.r), '{}'::tstzmultirange))
                  from public.plt_tempo_trechos t2 cross join lateral unnest(t2.janelas) as j(r)
                 where t2.passagem_id = p.id and not t2.descartado) as bruta
          from public.plt_tempo_trechos t
         where t.passagem_id = p.id
      ) mm
      cross join lateral (
        select mm.primeiro, mm.total, mm.bruta,
               coalesce(sum(t.segundos) filter (where not t.descartado), 0) as esforco,
               coalesce(array_agg(distinct t.usuario_id) filter (where not t.descartado), '{}') as pessoas,
               count(*) filter (where not t.descartado) as n,
               count(*) filter (where t.fim is null) as abertos,
               coalesce(bool_or(t.lote is not null), false) as lote,
               coalesce(bool_or(t.papel = 'execucao' and u.papel = 'admin'
                                and not exists (select 1 from public.plt_usuario_setores us
                                                 where us.usuario_id = t.usuario_id and us.setor_id = p.setor_id)
                                and not exists (select 1 from public.plt_tempo_equipe eq
                                                 where eq.usuario_id = t.usuario_id and eq.setor_id = p.setor_id)), false) as admin
          from public.plt_tempo_trechos t
          left join public.plt_usuarios u on u.id = t.usuario_id
         where t.passagem_id = p.id
      ) m
     where x.id = p.id;
    perform plt_privado.fn_tempo_classificar(p.id);
  end loop;
end;
$$;
comment on function plt_privado.fn_tempo_passagens_medir(bigint) is
  'SESSAO-42 (F3): os números de cada passagem do card a partir dos trechos — fila útil (até o 1º trecho), total útil, tempo do móvel (com a divisão; e só dos trechos fechados, para o card somar o vivo), a união sem divisão, parado, esforço, pessoas, lote, gesto de admin (admin fora da equipe do setor), desfecho, retrabalho na entrada — e a situação.';
revoke all on function plt_privado.fn_tempo_passagens_medir(bigint) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9 · O TEMPO PADRÃO de um modelo num setor (regra 16)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_padrao_refazer(p_setor_id bigint, p_modelo_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n   integer;
  v_p25 numeric;
  v_med numeric;
  v_p75 numeric;
begin
  if p_setor_id is null or p_modelo_id is null then
    return;
  end if;
  select count(*),
         percentile_cont(0.25) within group (order by x.execucao_s),
         percentile_cont(0.5)  within group (order by x.execucao_s),
         percentile_cont(0.75) within group (order by x.execucao_s)
    into v_n, v_p25, v_med, v_p75
    from public.plt_tempo_passagens x
   where x.setor_id = p_setor_id and x.modelo_id = p_modelo_id and x.situacao = 'valida'
     and x.dia >= (now() at time zone 'America/Fortaleza')::date
                  - (plt_privado.fn_tempo_regra(p_setor_id)).janela_padrao_dias;
  if v_n = 0 then
    delete from public.plt_tempo_padrao where setor_id = p_setor_id and modelo_id = p_modelo_id;
  else
    insert into public.plt_tempo_padrao (setor_id, modelo_id, mediana_s, p25_s, p75_s, n, atualizado_em)
      values (p_setor_id, p_modelo_id, round(v_med, 1), round(v_p25, 1), round(v_p75, 1), v_n, now())
      on conflict (setor_id, modelo_id) do update
        set mediana_s = excluded.mediana_s, p25_s = excluded.p25_s, p75_s = excluded.p75_s,
            n = excluded.n, atualizado_em = now();
  end if;
end;
$$;
revoke all on function plt_privado.fn_tempo_padrao_refazer(bigint, bigint) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 10 · Os RESUMOS por dia
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_resumo_modelo_refazer(p_dia date, p_setor_id bigint, p_modelo_id bigint)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.plt_tempo_resumo_modelo_dia r
   where r.dia = p_dia and r.setor_id = p_setor_id and r.modelo_id is not distinct from p_modelo_id;
  insert into public.plt_tempo_resumo_modelo_dia
    (dia, setor_id, modelo_id, n_total, n_validas, n_conferir, n_retrabalho, n_admin, n_sem_registro, n_teste,
     n_descartadas, execucao_validas_s, execucao_s, fila_s, parado_s, esforco_s)
  select p_dia, p_setor_id, p_modelo_id, count(*),
         count(*) filter (where x.situacao = 'valida'),
         count(*) filter (where x.situacao = 'conferir'),
         count(*) filter (where x.situacao = 'retrabalho'),
         count(*) filter (where x.situacao = 'admin'),
         count(*) filter (where x.situacao = 'sem_registro'),
         count(*) filter (where x.situacao = 'teste'),
         count(*) filter (where x.situacao = 'descartada'),
         coalesce(sum(x.execucao_s) filter (where x.situacao = 'valida'), 0),
         coalesce(sum(x.execucao_s), 0), coalesce(sum(x.fila_s), 0), coalesce(sum(x.parado_s), 0),
         coalesce(sum(x.esforco_s), 0)
    from public.plt_tempo_passagens x
   where x.dia = p_dia and x.setor_id = p_setor_id and x.modelo_id is not distinct from p_modelo_id
  having count(*) > 0;
$$;
revoke all on function plt_privado.fn_tempo_resumo_modelo_refazer(date, bigint, bigint) from public, anon, authenticated;

-- a pessoa num dia: trabalhando = o esforço dos trechos FECHADOS (dividido —
-- conta uma vez só) + a carência de 5 min; ausente, especial e à deriva da
-- presença FECHADA, só dentro das janelas; e ninguém passa da jornada
create or replace function plt_privado.fn_tempo_pessoa_dia_refazer(p_usuario_id uuid, p_dia date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ini     timestamptz := p_dia::timestamp at time zone 'America/Fortaleza';
  v_fim     timestamptz := (p_dia + 1)::timestamp at time zone 'America/Fortaleza';
  v_seg     record;
  v_parte   record;
  v_a       timestamptz;
  v_b       timestamptz;
  v_s       numeric;
  v_tipo    text;
  v_jornada numeric;
  v_total   numeric;
  v_exc     numeric;
  v_corta   numeric;
  v_linha   record;
  v_col     text;
begin
  if p_usuario_id is null or p_dia is null then
    return;
  end if;
  delete from public.plt_tempo_resumo_pessoa_dia where dia = p_dia and usuario_id = p_usuario_id;
  if exists (select 1 from public.plt_usuarios u where u.id = p_usuario_id and u.conta_tablet) then
    return;
  end if;

  -- o trabalho: os trechos fechados que começaram no dia (fora o clique errado e o descartado à mão)
  insert into public.plt_tempo_resumo_pessoa_dia (dia, usuario_id, setor_id, trabalhando_s, trechos_n, passagens_n,
                                                  esforco_s, bruto_s)
  select p_dia, p_usuario_id, t.setor_id, coalesce(sum(t.segundos), 0), count(*), count(distinct t.passagem_id),
         coalesce(sum(t.segundos), 0), coalesce(sum(extract(epoch from t.fim_conta - t.inicio)), 0)
    from public.plt_tempo_trechos t
    join public.plt_tempo_passagens ps on ps.id = t.passagem_id
   where t.usuario_id = p_usuario_id and t.dia = p_dia and t.fim is not null and not t.descartado
     and ps.situacao <> 'descartada'
   group by t.setor_id;

  -- a presença fechada (o trecho "trabalhando" já está nos trechos)
  for v_seg in
    select s.* from public.plt_presenca_segmentos s
     where s.usuario_id = p_usuario_id and s.fim is not null and s.inicio < v_fim and s.fim > v_ini
       and s.estado <> 'trabalhando'
  loop
    for v_parte in
      select * from plt_privado.fn_presenca_partes(v_seg.estado, v_seg.especial, v_seg.carencia, v_seg.inicio, v_seg.fim)
    loop
      v_a := greatest(v_parte.inicio, v_ini);
      v_b := least(v_parte.fim, v_fim);
      continue when v_b <= v_a;
      v_s := plt_privado.fn_tempo_segundos(case when v_seg.setor_id is null
                then plt_privado.fn_tempo_janelas_fabrica(v_a, v_b, p_usuario_id)
                else plt_privado.fn_tempo_janelas(v_seg.setor_id, v_a, v_b, p_usuario_id) end);
      continue when v_s <= 0;
      v_tipo := case v_parte.estado when 'trabalhando' then 'carencia' else v_parte.estado end;
      insert into public.plt_tempo_resumo_pessoa_dia (dia, usuario_id, setor_id) values (p_dia, p_usuario_id, v_seg.setor_id)
        on conflict (dia, usuario_id, coalesce(setor_id, 0)) do nothing;
      update public.plt_tempo_resumo_pessoa_dia r
         set carencia_s = r.carencia_s + case when v_tipo = 'carencia' then v_s else 0 end,
             trabalhando_s = r.trabalhando_s + case when v_tipo = 'carencia' then v_s else 0 end,
             ausente_s  = r.ausente_s  + case when v_tipo = 'ausente'  then v_s else 0 end,
             especial_s = r.especial_s + case when v_tipo = 'especial' then v_s else 0 end,
             deriva_s   = r.deriva_s   + case when v_tipo = 'deriva'   then v_s else 0 end
       where r.dia = p_dia and r.usuario_id = p_usuario_id and r.setor_id is not distinct from v_seg.setor_id;
    end loop;
  end loop;

  -- ninguém passa da jornada (as janelas da fábrica e dos setores do dia, com a hora extra dela)
  select coalesce(sum(r.trabalhando_s + r.ausente_s + r.especial_s + r.deriva_s), 0) into v_total
    from public.plt_tempo_resumo_pessoa_dia r where r.dia = p_dia and r.usuario_id = p_usuario_id;
  select plt_privado.fn_tempo_segundos(
           plt_privado.fn_tempo_janelas_fabrica(v_ini, v_fim, p_usuario_id)
           + coalesce((select range_agg(j.x)
                         from public.plt_tempo_resumo_pessoa_dia r
                         cross join lateral unnest(plt_privado.fn_tempo_janelas(r.setor_id, v_ini, v_fim, p_usuario_id)) as j(x)
                        where r.dia = p_dia and r.usuario_id = p_usuario_id and r.setor_id is not null),
                      '{}'::tstzmultirange))
    into v_jornada;
  v_exc := v_total - v_jornada;
  if v_exc > 0 then
    -- sobra: sai primeiro do que não é trabalho — à deriva, ausente, especial
    foreach v_col in array array['deriva_s', 'ausente_s', 'especial_s'] loop
      exit when v_exc <= 0;
      for v_linha in
        select r.setor_id, (to_jsonb(r) ->> v_col)::numeric as v from public.plt_tempo_resumo_pessoa_dia r
         where r.dia = p_dia and r.usuario_id = p_usuario_id and (to_jsonb(r) ->> v_col)::numeric > 0
      loop
        exit when v_exc <= 0;
        v_corta := least(v_linha.v, v_exc);
        execute format('update public.plt_tempo_resumo_pessoa_dia set %I = %I - $1
                         where dia = $2 and usuario_id = $3 and setor_id is not distinct from $4', v_col, v_col)
          using v_corta, p_dia, p_usuario_id, v_linha.setor_id;
        v_exc := v_exc - v_corta;
      end loop;
    end loop;
    -- ainda sobra (presença antiga sobreposta aos trechos): sai a carência —
    -- os trechos ficam (já são só dentro das janelas e divididos)
    for v_linha in
      select r.setor_id, r.carencia_s as v from public.plt_tempo_resumo_pessoa_dia r
       where r.dia = p_dia and r.usuario_id = p_usuario_id and r.carencia_s > 0
    loop
      exit when v_exc <= 0;
      v_corta := least(v_linha.v, v_exc);
      update public.plt_tempo_resumo_pessoa_dia
         set carencia_s = carencia_s - v_corta, trabalhando_s = trabalhando_s - v_corta
       where dia = p_dia and usuario_id = p_usuario_id and setor_id is not distinct from v_linha.setor_id;
      v_exc := v_exc - v_corta;
    end loop;
  end if;
  delete from public.plt_tempo_resumo_pessoa_dia r
   where r.dia = p_dia and r.usuario_id = p_usuario_id
     and r.trabalhando_s = 0 and r.ausente_s = 0 and r.especial_s = 0 and r.deriva_s = 0 and r.trechos_n = 0;
end;
$$;
comment on function plt_privado.fn_tempo_pessoa_dia_refazer(uuid, date) is
  'SESSAO-42 (F4): refaz o resumo de uma pessoa num dia — trabalhando = o esforço dos trechos FECHADOS (dividido, conta uma vez só) + a carência de 5 min (D-197); ausente, parado especial e à deriva da presença FECHADA, só dentro das janelas do setor (a deriva, nas da fábrica); o que passar da jornada (janelas + hora extra) sai do que não é trabalho (à deriva, ausente, especial e, por último, a carência). O aberto soma na leitura.';
revoke all on function plt_privado.fn_tempo_pessoa_dia_refazer(uuid, date) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 11 · REFAZER UM CARD — o que o fato dispara (e o recálculo, em lote)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_card_refazer(p_card_id bigint, p_resumos boolean default true)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mod     jsonb;
  v_pad     jsonb;
  v_pes     jsonb;
  v_quem    uuid[];
  v_de      timestamptz;
  v_ate     timestamptz;
  v_cards   bigint[] := array[p_card_id];
  v_u       uuid;
  v_c       bigint;
  v_k       jsonb;
  v_p       record;
  v_admin   uuid;
begin
  -- o que existia antes (para refazer padrões e resumos que deixaram de valer)
  select coalesce(jsonb_agg(distinct jsonb_build_array(x.setor_id, x.modelo_id)) filter (where x.modelo_id is not null), '[]'),
         coalesce(jsonb_agg(distinct jsonb_build_array(x.dia, x.setor_id, x.modelo_id)) filter (where x.dia is not null), '[]')
    into v_pad, v_mod
    from public.plt_tempo_passagens x where x.card_id = p_card_id;
  select coalesce(jsonb_agg(distinct jsonb_build_array(t.usuario_id, t.dia)), '[]'),
         array_agg(distinct t.usuario_id), min(t.inicio), max(t.fim_conta)
    into v_pes, v_quem, v_de, v_ate
    from public.plt_tempo_trechos t where t.card_id = p_card_id;

  perform plt_privado.fn_tempo_card_trechos(p_card_id);

  select coalesce(v_quem, '{}') || coalesce(array_agg(distinct t.usuario_id), '{}'),
         least(v_de, min(t.inicio)), greatest(v_ate, max(t.fim_conta))
    into v_quem, v_de, v_ate
    from public.plt_tempo_trechos t where t.card_id = p_card_id;

  -- a divisão (regra 6): os cards das mesmas pessoas que se sobrepõem mudam junto
  for v_u in select distinct q from unnest(coalesce(v_quem, '{}')) q where q is not null loop
    v_cards := v_cards || array(select plt_privado.fn_tempo_dividir(v_u, v_de, v_ate));
  end loop;
  for v_c in select distinct q from unnest(v_cards) q loop
    perform plt_privado.fn_tempo_passagens_medir(v_c);
  end loop;

  -- o tempo padrão dos modelos tocados, e a situação do card de novo (o "longo" lê o padrão)
  select v_pad || coalesce(jsonb_agg(distinct jsonb_build_array(x.setor_id, x.modelo_id)) filter (where x.modelo_id is not null), '[]')
    into v_pad from public.plt_tempo_passagens x where x.card_id = any (v_cards);
  for v_k in select distinct j from jsonb_array_elements(v_pad) j loop
    perform plt_privado.fn_tempo_padrao_refazer((v_k ->> 0)::bigint, (v_k ->> 1)::bigint);
  end loop;
  for v_c in select x.id from public.plt_tempo_passagens x where x.card_id = p_card_id and x.saida_em is not null loop
    perform plt_privado.fn_tempo_classificar(v_c);
  end loop;

  if p_resumos then
    select v_mod || coalesce(jsonb_agg(distinct jsonb_build_array(x.dia, x.setor_id, x.modelo_id)) filter (where x.dia is not null), '[]')
      into v_mod from public.plt_tempo_passagens x where x.card_id = any (v_cards);
    for v_k in select distinct j from jsonb_array_elements(v_mod) j loop
      perform plt_privado.fn_tempo_resumo_modelo_refazer((v_k ->> 0)::date, (v_k ->> 1)::bigint, nullif(v_k ->> 2, '')::bigint);
    end loop;
    select v_pes || coalesce(jsonb_agg(distinct jsonb_build_array(t.usuario_id, t.dia)), '[]')
      into v_pes from public.plt_tempo_trechos t where t.card_id = any (v_cards);
    for v_k in select distinct j from jsonb_array_elements(v_pes) j loop
      perform plt_privado.fn_tempo_pessoa_dia_refazer((v_k ->> 0)::uuid, (v_k ->> 1)::date);
    end loop;
  end if;

  -- regra 11: o móvel PULOU a execução (saiu para a frente sem ninguém iniciar) —
  -- avisa os administradores, uma vez, só no gesto (o recálculo nunca avisa)
  for v_p in
    select x.id, x.saida_evento_id, x.setor_id, s.nome as setor, c.id as card,
           coalesce(nullif(btrim(c.titulo), ''), nullif(btrim(c.item_descricao), ''), 'Card ' || c.id) as nome,
           pd.numero as pedido, u.nome as quem
      from public.plt_tempo_passagens x
      join public.plt_eventos ev on ev.id = x.saida_evento_id
      join public.plt_setores s on s.id = x.setor_id
      join public.plt_cards c on c.id = x.card_id
      left join public.pedidos pd on pd.id = c.pedido_id
      left join public.plt_usuarios u on u.id = x.saida_por
     where x.card_id = p_card_id and x.situacao = 'sem_registro' and x.desfecho = 'concluida'
       and ev.registrado_em = now()
       and (plt_privado.fn_tempo_regra(x.setor_id)).avisar_pulo
       and not exists (select 1 from public.plt_notificacoes n
                        where n.evento_id = x.saida_evento_id and n.tipo = 'execucao_pulada')
  loop
    for v_admin in
      select u.id from public.plt_usuarios u
       where u.papel = 'admin' and u.ativo and u.arquivado_em is null and not u.conta_tablet
    loop
      insert into public.plt_notificacoes (destinatario_id, evento_id, card_id, tipo, titulo, corpo)
        values (v_admin, v_p.saida_evento_id, v_p.card, 'execucao_pulada',
                'Móvel pulou a ' || initcap(lower(v_p.setor)),
                v_p.nome || coalesce(' · pedido ' || v_p.pedido, '') || ' saiu da ' || v_p.setor
                || ' sem ninguém iniciar' || coalesce(' (arrastado por ' || v_p.quem || ')', '')
                || ' — o tempo dele não entra na média.');
    end loop;
  end loop;
end;
$$;
comment on function plt_privado.fn_tempo_card_refazer(bigint, boolean) is
  'SESSAO-42 (F3): refaz o card inteiro no cálculo único — trechos e passagens dos fatos, a divisão com os cards das mesmas pessoas, os números e a situação, o tempo padrão dos modelos tocados e (p_resumos) os resumos por dia; avisa os admins quando o móvel pulou a execução (só no gesto: o fato da saída nasceu nesta transação).';
revoke all on function plt_privado.fn_tempo_card_refazer(bigint, boolean) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 12 · No FATO: um gatilho de restrição ADIADO (fim da transação) refaz o card
--     uma vez, por mais fatos que o gesto gere (o soltar gera de 2 a 5)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_fato()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_feitos jsonb := coalesce(nullif(current_setting('plt.tempo_cards', true), '')::jsonb, '{}'::jsonb);
  v_n      bigint;
begin
  -- já refeito nesta transação com TODOS os fatos que o card tem agora (a
  -- contagem — não o maior número: o movimento automático do iniciar nasce
  -- com número MAIOR que o próprio iniciar; E-174)
  select count(*) into v_n from public.plt_eventos e where e.card_id = new.card_id;
  if (v_feitos ->> new.card_id::text)::bigint = v_n then
    return null;
  end if;
  perform set_config('plt.tempo_cards', (v_feitos || jsonb_build_object(new.card_id::text, v_n))::text, true);
  perform plt_privado.fn_tempo_card_refazer(new.card_id);
  return null;
end;
$$;
revoke all on function plt_privado.fn_tempo_fato() from public, anon, authenticated;

drop trigger if exists plt_eventos_zzz_tempo on public.plt_eventos;
create constraint trigger plt_eventos_zzz_tempo
  after insert on public.plt_eventos
  deferrable initially deferred
  for each row
  when (new.tipo in ('card_criado', 'movimentacao_setor', 'movimentacao_etapa', 'execucao_iniciada',
                     'execucao_pausada', 'execucao_retomada', 'execucao_finalizada', 'avulso_concluido',
                     'card_arquivado', 'card_desarquivado', 'peca_alocada', 'auxilio_iniciado',
                     'auxilio_pausado', 'auxilio_retomado', 'auxilio_encerrado', 'estorno', 'tempo_decisao'))
  execute function plt_privado.fn_tempo_fato();

-- a presença que fecha refaz o dia da pessoa (ausente/deriva dentro das janelas)
create or replace function plt_privado.fn_tempo_presenca_fato()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_d date;
  v_feitos text := coalesce(current_setting('plt.tempo_presenca', true), '');
  v_chave  text;
begin
  if new.fim is null then
    return null;
  end if;
  for v_d in
    select g::date from generate_series((new.inicio at time zone 'America/Fortaleza')::date,
                                        least((new.fim at time zone 'America/Fortaleza')::date,
                                              (new.inicio at time zone 'America/Fortaleza')::date + 3),
                                        interval '1 day') g
  loop
    v_chave := '|' || new.usuario_id || ':' || v_d || ':' || new.id || ':' || new.fim || '|';
    continue when position(v_chave in v_feitos) > 0;
    v_feitos := v_feitos || v_chave;
    perform set_config('plt.tempo_presenca', v_feitos, true);
    perform plt_privado.fn_tempo_pessoa_dia_refazer(new.usuario_id, v_d);
  end loop;
  return null;
end;
$$;
revoke all on function plt_privado.fn_tempo_presenca_fato() from public, anon, authenticated;

-- imediato (o trecho fecha uma vez por pessoa no gesto; os trechos que mudarem
-- depois refazem o dia de novo, pelo card)
drop trigger if exists plt_presenca_segmentos_zz_tempo on public.plt_presenca_segmentos;
create trigger plt_presenca_segmentos_zz_tempo
  after insert or update on public.plt_presenca_segmentos
  for each row
  when (new.fim is not null)
  execute function plt_privado.fn_tempo_presenca_fato();

-- ----------------------------------------------------------------------------
-- 13 · FECHAR UM PERÍODO (o fim de um recálculo): padrões, situação de novo
--      (o "longo" depende do padrão), padrões de novo, e os resumos
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_periodo_fechar(p_de timestamptz, p_ate timestamptz, p_setor_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_d0 date := (p_de at time zone 'America/Fortaleza')::date;
  v_d1 date := (p_ate at time zone 'America/Fortaleza')::date;
  v_k  record;
  v_id bigint;
begin
  for v_k in
    select distinct x.setor_id, x.modelo_id from public.plt_tempo_passagens x
     where x.modelo_id is not null and (p_setor_id is null or x.setor_id = p_setor_id)
       and x.dia >= (now() at time zone 'America/Fortaleza')::date - 730
  loop
    perform plt_privado.fn_tempo_padrao_refazer(v_k.setor_id, v_k.modelo_id);
  end loop;
  for v_id in
    select x.id from public.plt_tempo_passagens x
     where x.dia between v_d0 and v_d1 and (p_setor_id is null or x.setor_id = p_setor_id)
  loop
    perform plt_privado.fn_tempo_classificar(v_id);
  end loop;
  for v_k in
    select distinct x.setor_id, x.modelo_id from public.plt_tempo_passagens x
     where x.modelo_id is not null and x.dia between v_d0 and v_d1 and (p_setor_id is null or x.setor_id = p_setor_id)
  loop
    perform plt_privado.fn_tempo_padrao_refazer(v_k.setor_id, v_k.modelo_id);
  end loop;
  -- os resumos do período, refeitos de uma vez
  delete from public.plt_tempo_resumo_modelo_dia r
   where r.dia between v_d0 and v_d1 and (p_setor_id is null or r.setor_id = p_setor_id);
  for v_k in
    select distinct x.dia, x.setor_id, x.modelo_id from public.plt_tempo_passagens x
     where x.dia between v_d0 and v_d1 and (p_setor_id is null or x.setor_id = p_setor_id)
  loop
    perform plt_privado.fn_tempo_resumo_modelo_refazer(v_k.dia, v_k.setor_id, v_k.modelo_id);
  end loop;
  for v_k in
    select distinct q.usuario_id, q.dia
      from (select t.usuario_id, t.dia from public.plt_tempo_trechos t
             where t.dia between v_d0 and v_d1 and (p_setor_id is null or t.setor_id = p_setor_id)
            union
            select s.usuario_id, g::date
              from public.plt_presenca_segmentos s
              cross join lateral generate_series((greatest(s.inicio, p_de) at time zone 'America/Fortaleza')::date,
                                                 (least(coalesce(s.fim, now()), p_ate) at time zone 'America/Fortaleza')::date,
                                                 interval '1 day') g
             where s.fim is not null and s.inicio < p_ate and s.fim > p_de
               and (p_setor_id is null or s.setor_id = p_setor_id)
            union
            select r.usuario_id, r.dia from public.plt_tempo_resumo_pessoa_dia r
             where r.dia between v_d0 and v_d1 and (p_setor_id is null or r.setor_id = p_setor_id)) q
  loop
    perform plt_privado.fn_tempo_pessoa_dia_refazer(v_k.usuario_id, v_k.dia);
  end loop;
end;
$$;
revoke all on function plt_privado.fn_tempo_periodo_fechar(timestamptz, timestamptz, bigint) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 14 · O PROCESSAMENTO da fila de recálculo (um lote por vez; o despertador
--      chama enquanto há pedido — fn_tempo_recalculo_armar)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_recalculo_processar(p_lote integer default 150)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r       public.plt_tempo_recalculos%rowtype;
  v_c     bigint;
  v_n     integer := 0;
  v_ult   bigint;
begin
  select * into r from public.plt_tempo_recalculos x
   where x.concluido_em is null order by x.id limit 1 for update skip locked;
  if r.id is null then
    perform plt_privado.fn_tempo_recalculo_armar();
    return jsonb_build_object('situacao', 'vazia');
  end if;
  begin
    if r.iniciado_em is null then
      update public.plt_tempo_recalculos set iniciado_em = now(),
             total = case when r.alcance = 'tudo' then (
               select count(*) from (
                 select ev.card_id from public.plt_eventos ev
                  where ev.ocorrido_em between r.de and r.ate
                    and (r.setor_id is null or ev.setor_origem_id = r.setor_id or ev.setor_destino_id = r.setor_id)
                 union
                 select x.card_id from public.plt_tempo_passagens x
                  where x.entrada_em <= r.ate and coalesce(x.saida_em, now()) >= r.de
                    and (r.setor_id is null or x.setor_id = r.setor_id)) q) else 0 end
       where id = r.id
      returning * into r;
    end if;
    if r.alcance = 'tudo' then
      for v_c in
        select q.card_id from (
          select ev.card_id from public.plt_eventos ev
           where ev.ocorrido_em between r.de and r.ate
             and (r.setor_id is null or ev.setor_origem_id = r.setor_id or ev.setor_destino_id = r.setor_id)
          union
          select x.card_id from public.plt_tempo_passagens x
           where x.entrada_em <= r.ate and coalesce(x.saida_em, now()) >= r.de
             and (r.setor_id is null or x.setor_id = r.setor_id)) q
         where q.card_id > r.cursor_card
         order by q.card_id
         limit greatest(coalesce(p_lote, 150), 1)
      loop
        perform plt_privado.fn_tempo_card_refazer(v_c, false);
        v_n := v_n + 1;
        v_ult := v_c;
      end loop;
      update public.plt_tempo_recalculos set feitos = feitos + v_n, cursor_card = coalesce(v_ult, cursor_card)
       where id = r.id;
    end if;
    if r.alcance <> 'tudo' or v_n < greatest(coalesce(p_lote, 150), 1) then
      perform plt_privado.fn_tempo_periodo_fechar(r.de, r.ate, r.setor_id);
      update public.plt_tempo_recalculos
         set concluido_em = now(), total = case when alcance = 'tudo' then feitos else total end
       where id = r.id;
    end if;
  exception when others then
    update public.plt_tempo_recalculos set concluido_em = now(), erro = left(sqlerrm, 500) where id = r.id;
    perform plt_privado.fn_alertar_erro('automacao_falhou', 'tempo-recalculo-' || r.id,
      'O recálculo dos tempos parou', 'O recálculo pedido em ' || to_char(r.criado_em at time zone 'America/Fortaleza', 'DD/MM HH24:MI')
      || ' parou no meio. Peça de novo em Configurações → Controle de tempo → Recálculo.',
      jsonb_build_object('recalculo_id', r.id, 'erro', left(sqlerrm, 300)));
  end;
  perform plt_privado.fn_avisar('tempos');
  perform plt_privado.fn_tempo_recalculo_armar();
  return jsonb_build_object('situacao', 'ok', 'recalculo_id', r.id, 'cards', v_n);
end;
$$;
comment on function plt_privado.fn_tempo_recalculo_processar(integer) is
  'SESSAO-42 (regra 19): processa um lote do pedido de recálculo mais antigo — "tudo" refaz os cards com fato (ou passagem) no período, por cursor; no fim (ou só "classificar"), fecha o período (padrões, situação, resumos). Falhou: marca o erro e avisa os administradores. Avisa a área "tempos" (o progresso ao vivo).';
revoke all on function plt_privado.fn_tempo_recalculo_processar(integer) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 15 · A DECISÃO MANUAL (regra 14): Considerar / Descartar / Desfazer, com
--      motivo, por líder do setor ou admin — um FATO novo no card (aparece na
--      Auditoria); a tela é da SESSAO-43
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tempo_decidir(p_passagem_id bigint, p_decisao text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p        public.plt_tempo_passagens%rowtype;
  v_quem   uuid := plt_privado.fn_usuario_atual();
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_max    bigint;
begin
  if p_decisao is null or p_decisao not in ('considerar', 'descartar', 'desfazer') then
    raise exception 'A decisão é considerar, descartar ou desfazer.' using errcode = 'invalid_parameter_value';
  end if;
  if length(v_motivo) < 3 then
    raise exception 'Escreva o motivo da decisão.' using errcode = 'invalid_parameter_value';
  end if;
  select * into p from public.plt_tempo_passagens where id = p_passagem_id;
  if p.id is null then
    raise exception 'Esta passagem não existe.' using errcode = 'no_data_found';
  end if;
  if not (plt_privado.fn_eh_admin() or plt_privado.fn_eh_lider_de(p.setor_id)) then
    raise exception 'Decidir o tempo é do líder do setor ou de um administrador.' using errcode = 'insufficient_privilege';
  end if;
  if p.saida_em is null then
    raise exception 'O card ainda está no setor — decida depois que ele sair.' using errcode = 'check_violation';
  end if;
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
    values (p.card_id, 'tempo_decisao', v_quem, 'interface', p.setor_id, left(v_motivo, 300),
            jsonb_build_object('passagem_id', p.id, 'setor_id', p.setor_id, 'decisao', p_decisao,
                               'motivo', left(v_motivo, 300), 'situacao_antes', p.situacao));
  -- refaz agora (a resposta já traz a situação nova) e marca o card como feito
  select count(*) into v_max from public.plt_eventos e where e.card_id = p.card_id;
  perform set_config('plt.tempo_cards',
    (coalesce(nullif(current_setting('plt.tempo_cards', true), '')::jsonb, '{}'::jsonb)
     || jsonb_build_object(p.card_id::text, v_max))::text, true);
  perform plt_privado.fn_tempo_card_refazer(p.card_id);
  select * into p from public.plt_tempo_passagens where id = p_passagem_id;
  return jsonb_build_object('situacao', p.situacao, 'motivo', p.motivo);
end;
$$;
comment on function public.plt_fn_tempo_decidir(bigint, text, text) is
  'SESSAO-42 (regra 14): a decisão manual sobre o tempo de uma passagem que já saiu do setor — considerar (entra na média), descartar (fora), desfazer (volta à regra) — com motivo, por líder do setor ou admin. Grava o FATO tempo_decisao no card (Auditoria) e devolve a situação nova.';

-- ----------------------------------------------------------------------------
-- 16 · Aba MODELOS — confirmar, juntar, separar (o que muda reclassifica)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tempo_modelos(
  p_busca text default null, p_so_sugeridos boolean default false,
  p_limite integer default 30, p_depois_nome text default null, p_depois_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_lim   integer := least(greatest(coalesce(p_limite, 30), 1), 100);
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_itens jsonb;
  v_n     integer;
begin
  perform plt_privado.fn_tempo_so_admin();
  select coalesce(jsonb_agg(x.j order by x.nome, x.id), '[]'::jsonb), count(*)
    into v_itens, v_n
    from (
      select m.nome, m.id, jsonb_build_object(
               'id', m.id, 'nome', m.nome, 'confirmado', m.confirmado,
               'chaves', coalesce((select jsonb_agg(jsonb_build_object('chave', k.chave, 'exemplo', k.exemplo) order by k.chave)
                                     from public.plt_tempo_modelo_chaves k where k.modelo_id = m.id), '[]'::jsonb),
               'passagens', (select count(*) from public.plt_tempo_passagens ps where ps.modelo_id = m.id),
               'padrao', (select jsonb_agg(jsonb_build_object('setor', s.nome, 'mediana_s', d.mediana_s, 'n', d.n) order by s.ordem)
                            from public.plt_tempo_padrao d join public.plt_setores s on s.id = d.setor_id
                           where d.modelo_id = m.id)) as j
        from public.plt_tempo_modelos m
       where m.arquivado_em is null
         and (not coalesce(p_so_sugeridos, false) or not m.confirmado)
         and (v_busca is null or m.nome ilike '%' || v_busca || '%'
              or exists (select 1 from public.plt_tempo_modelo_chaves k where k.modelo_id = m.id and k.exemplo ilike '%' || v_busca || '%'))
         and (p_depois_nome is null or (m.nome, m.id) > (p_depois_nome, coalesce(p_depois_id, 0)))
       order by m.nome, m.id
       limit v_lim + 1) x;
  return jsonb_build_object(
    'itens', case when v_n > v_lim then v_itens - v_lim else v_itens end,
    'tem_mais', v_n > v_lim,
    'sugeridos', (select count(*) from public.plt_tempo_modelos m where m.arquivado_em is null and not m.confirmado));
end;
$$;
comment on function public.plt_fn_tempo_modelos(text, boolean, integer, text, bigint) is
  'SESSAO-42 (F2 · aba Modelos): os modelos (com as chaves — os nomes de móvel que caem nele —, quantas passagens e o tempo padrão por setor), por nome, por cursor (nome, id), teto 100; só os sugeridos (a confirmar) se pedir. Só admin.';

create or replace function public.plt_fn_tempo_modelo_confirmar(p_id bigint, p_nome text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes jsonb;
begin
  perform plt_privado.fn_tempo_so_admin();
  select to_jsonb(m) into v_antes from public.plt_tempo_modelos m where m.id = p_id and m.arquivado_em is null for update;
  if v_antes is null then
    raise exception 'Este modelo não existe mais.' using errcode = 'no_data_found';
  end if;
  update public.plt_tempo_modelos
     set confirmado = true, nome = coalesce(nullif(left(btrim(p_nome), 160), ''), nome), atualizado_em = now()
   where id = p_id;
  perform plt_privado.fn_tempo_trilha('tempo_modelo_alterado', jsonb_build_object('acao', 'confirmar',
    'antes', v_antes, 'depois', (select to_jsonb(m) from public.plt_tempo_modelos m where m.id = p_id)));
end;
$$;

create or replace function public.plt_fn_tempo_modelo_juntar(p_destino_id bigint, p_origens bigint[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_origens bigint[];
  v_s       bigint;
begin
  perform plt_privado.fn_tempo_so_admin();
  select array_agg(m.id) into v_origens from public.plt_tempo_modelos m
   where m.id = any (coalesce(p_origens, '{}')) and m.id <> p_destino_id and m.arquivado_em is null;
  if not exists (select 1 from public.plt_tempo_modelos m where m.id = p_destino_id and m.arquivado_em is null)
     or coalesce(cardinality(v_origens), 0) = 0 then
    raise exception 'Escolha o modelo que fica e os que entram nele.' using errcode = 'invalid_parameter_value';
  end if;
  update public.plt_tempo_modelo_chaves set modelo_id = p_destino_id where modelo_id = any (v_origens);
  update public.plt_tempo_passagens set modelo_id = p_destino_id where modelo_id = any (v_origens);
  update public.plt_tempo_resumo_modelo_dia set modelo_id = null where modelo_id = any (v_origens); -- refeitos no recálculo
  delete from public.plt_tempo_padrao where modelo_id = any (v_origens);
  update public.plt_tempo_modelos set arquivado_em = now(), atualizado_em = now() where id = any (v_origens);
  update public.plt_tempo_modelos set confirmado = true, atualizado_em = now() where id = p_destino_id;
  for v_s in select distinct x.setor_id from public.plt_tempo_passagens x where x.modelo_id = p_destino_id loop
    perform plt_privado.fn_tempo_padrao_refazer(v_s, p_destino_id);
  end loop;
  perform plt_privado.fn_tempo_trilha('tempo_modelo_alterado',
    jsonb_build_object('acao', 'juntar', 'destino', p_destino_id, 'origens', v_origens));
  perform plt_privado.fn_tempo_pedir_recalculo(null, now(), null, 'classificar', 'Modelos juntados');
end;
$$;

create or replace function public.plt_fn_tempo_modelo_separar(p_chave text, p_nome text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes bigint;
  v_novo  bigint;
  v_s     bigint;
begin
  perform plt_privado.fn_tempo_so_admin();
  select k.modelo_id into v_antes from public.plt_tempo_modelo_chaves k where k.chave = p_chave for update;
  if v_antes is null then
    raise exception 'Este nome de móvel não está em nenhum modelo.' using errcode = 'no_data_found';
  end if;
  if length(btrim(coalesce(p_nome, ''))) < 2 then
    raise exception 'Dê um nome ao modelo novo.' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.plt_tempo_modelos (nome, confirmado) values (left(btrim(p_nome), 160), true) returning id into v_novo;
  update public.plt_tempo_modelo_chaves set modelo_id = v_novo where chave = p_chave;
  update public.plt_tempo_passagens set modelo_id = v_novo where modelo_chave = p_chave;
  for v_s in select distinct x.setor_id from public.plt_tempo_passagens x where x.modelo_id in (v_antes, v_novo) loop
    perform plt_privado.fn_tempo_padrao_refazer(v_s, v_antes);
    perform plt_privado.fn_tempo_padrao_refazer(v_s, v_novo);
  end loop;
  perform plt_privado.fn_tempo_trilha('tempo_modelo_alterado',
    jsonb_build_object('acao', 'separar', 'chave', p_chave, 'de', v_antes, 'para', v_novo));
  perform plt_privado.fn_tempo_pedir_recalculo(null, now(), null, 'classificar', 'Modelo separado');
  return v_novo;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'plt_fn_tempo_decidir(bigint, text, text)',
    'plt_fn_tempo_modelos(text, boolean, integer, text, bigint)',
    'plt_fn_tempo_modelo_confirmar(bigint, text)',
    'plt_fn_tempo_modelo_juntar(bigint, bigint[])',
    'plt_fn_tempo_modelo_separar(text, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 17 · O RECÁLCULO de tudo desde o começo do uso real (19/10) — na aplicação
-- ----------------------------------------------------------------------------
do $$
declare
  v_desde timestamptz;
  v_c     bigint;
begin
  select c.recalcular_desde::timestamp at time zone 'America/Fortaleza' into v_desde
    from public.plt_tempo_config c where c.id = 1;
  for v_c in
    select distinct ev.card_id from public.plt_eventos ev where ev.ocorrido_em >= v_desde order by 1
  loop
    perform plt_privado.fn_tempo_card_refazer(v_c, false);
  end loop;
  perform plt_privado.fn_tempo_periodo_fechar(v_desde, now(), null);
end;
$$;
