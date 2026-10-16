-- ============================================================================
-- SESSAO-33 · migration 88 — a aba "Conferências com o Tiny" da Auditoria por
-- ROLAGEM, por cursor (D-141, resposta 6 do dono: "paginação por rolagem —
-- carrega mais ao rolar, sem números de página"; regra 18 / Lei §6: lista que
-- cresce anda por cursor).
--
-- Conferido em 16/10: a trilha (aba Atividade) e o histórico das automações já
-- andavam por cursor e carregavam mais ao rolar desde a migration 81; esta era
-- a ÚNICA lista da Auditoria ainda por número de página (deslocamento + total a
-- cada página).
--
-- plt_fn_auditoria_conferencias ganha o cursor `p_antes_id` (a última rodada
-- mostrada) e devolve `tem_mais`. O `total`, o "em andamento" e o "agendada"
-- vêm só na 1ª página (as seguintes não pagam por eles). `p_deslocamento` FICA
-- por ora, só para a tela publicada antes desta migration seguir funcionando
-- nos minutos entre aplicar o banco e publicar o site (Lei §7.6 · E-73); sai
-- numa próxima migration.
--
-- Índice parcial nas rodadas: `eventos` é tabela da INTEGRAÇÃO (D-19) — entra
-- com o OK do dono, como os de D-138; na aplicação, criar ANTES com
-- `create index concurrently` (fora de transação) e então aplicar o arquivo
-- (o `if not exists` daqui vira nada). Pequeno: só as linhas `pente_fino`
-- (18 em 16/10, uma por noite).
-- ============================================================================

set local lock_timeout = '5s';

create index if not exists eventos_pente_fino_idx
  on public.eventos (id)
  where tipo = 'pente_fino';

-- a assinatura muda (A-12): a de 2 parâmetros sai; quem chama por nome
-- (p_limite, p_deslocamento) cai na nova, com o cursor nulo
drop function if exists public.plt_fn_auditoria_conferencias(integer, integer);

create or replace function public.plt_fn_auditoria_conferencias(
  p_limite       integer default 10,
  p_deslocamento integer default 0,
  p_antes_id     bigint  default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_limite   integer := least(greatest(coalesce(p_limite, 10), 1), 50);
  v_busca    jsonb;
  v_rodada   text;
  v_agora    jsonb;
  v_agendada boolean := null;
  v_total    bigint  := null;
  v_rodadas  jsonb;
  v_tem_mais boolean;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_eh_super_admin() then
    raise exception 'A auditoria é só do super admin.' using errcode = 'insufficient_privilege';
  end if;

  -- só a 1ª página traz a rodada em andamento, se a da madrugada está agendada
  -- e o total (as páginas seguintes, pedidas ao rolar, não pagam por eles)
  if p_antes_id is null then
    select f.params into v_busca from public.tiny_fila f
     where f.recurso = 'pedidos_pesquisa' and f.chave = 'pente-fino:p1';
    v_rodada := v_busca->>'rodada';
    if v_rodada is not null and v_busca->>'resumo_em' is null then
      select jsonb_build_object(
               'rodada',  v_rodada,
               'inicio',  v_busca->>'inicio',
               'motivo',  coalesce(v_busca->>'motivo', 'madrugada'),
               'na_fila', count(*) filter (where x.recurso = 'pedido'),
               'lidos',   count(*) filter (where x.recurso = 'pedido' and x.status in ('ok', 'vazio', 'erro')),
               'mudaram', count(*) filter (where x.recurso = 'pedido' and x.status = 'ok'
                                             and jsonb_array_length(coalesce(x.params->'mudou', '[]'::jsonb)) > 0))
        into v_agora
        from public.tiny_fila x
       where x.params->>'rodada' = v_rodada;
    end if;

    if exists (select 1 from pg_extension where extname = 'pg_cron') then
      v_agendada := exists (select 1 from cron.job where jobname = 'plt-tiny-pente-fino');
    end if;

    select count(*) into v_total from public.eventos e where e.tipo = 'pente_fino';
  end if;

  -- a página: as rodadas mais novas primeiro, depois da última mostrada; uma a
  -- mais só para saber se há outra página
  select coalesce(jsonb_agg(x.payload || jsonb_build_object('id', x.id, 'registrado_em', x.recebido_em)
                            order by x.id desc) filter (where x.ordem <= v_limite), '[]'::jsonb),
         count(*) > v_limite
    into v_rodadas, v_tem_mais
    from (select e.id, e.recebido_em, e.payload,
                 row_number() over (order by e.id desc) as ordem
            from (select e0.id, e0.recebido_em, e0.payload
                    from public.eventos e0
                   where e0.tipo = 'pente_fino'
                     and (p_antes_id is null or e0.id < p_antes_id)
                   order by e0.id desc
                   limit v_limite + 1
                  offset case when p_antes_id is null then greatest(coalesce(p_deslocamento, 0), 0) else 0 end) e) x;

  return jsonb_build_object(
    'em_andamento', v_agora,
    'agendada',     v_agendada,
    'total',        v_total,
    'tem_mais',     coalesce(v_tem_mais, false),
    'rodadas',      v_rodadas);
end;
$$;

comment on function public.plt_fn_auditoria_conferencias(integer, integer, bigint) is
  'SESSAO-29 (D-95): a conferência diária com o Tiny na Auditoria — a rodada em andamento e as rodadas encerradas (o resumo gravado no log da integração, tipo pente_fino). Só super admin. SESSAO-33 (D-141): por cursor (p_antes_id = a última rodada mostrada; tem_mais); total, em andamento e agendada só na 1ª página; p_deslocamento só para a tela antiga (sai depois).';

revoke all on function public.plt_fn_auditoria_conferencias(integer, integer, bigint) from public, anon;
grant execute on function public.plt_fn_auditoria_conferencias(integer, integer, bigint) to authenticated;
