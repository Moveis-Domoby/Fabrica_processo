-- ============================================================================
-- SESSAO-48 · O acerto do que já estava parado: as peças que estavam nas colunas
-- CANCELADO e NÃO ENCONTRADO da LIMPEZA E EMBALAGEM saem da produção
--
-- O caso (levantamento do Cowork em 11/11 ~01:30, só leitura): 49 peças vivas no
-- CANCELADO e 4 no NÃO ENCONTRADO — 53 das 127 peças "em produção" (42%), em 30
-- móveis. Elas foram para lá ANTES de a coluna virar o gesto de cancelar a
-- fabricação, então seguiam contando como produção (o "2 reservados p/ produção"
-- da Estante Basic 7 nichos no vídeo do dono, 10/11):
--   · 30 do pedido 13622 (Em aberto no Tiny) no CANCELADO — as vagas voltam ao
--     PCP com o aviso "Peça cancelada na produção"; o PCP decide pela janela;
--   · 17 de reposição no CANCELADO e 2 no NÃO ENCONTRADO — só saem da produção;
--   · 12728 e 13702 (CANCELADO) e 11960 e 13709 (NÃO ENCONTRADO), cancelados no
--     Tiny — saem da produção, sem vaga de volta.
--
-- O acerto passa cada peça pelo MESMO miolo do gesto (plt_privado.fn_cancelar_
-- fabricacao): um fato por peça, origem 'api', com a data de HOJE (cada peça
-- ganha os dias de conferência da coluna antes de a limpeza da madrugada a
-- arquivar). O sino do PCP sai UMA vez por pedido (e não uma por peça). No fim,
-- os números do estoque são recontados do zero.
--
-- DOIS MODOS:
--   · ENSAIO (o padrão): conta antes, roda o acerto, conta depois e DESFAZ tudo
--     — termina com um erro proposital que traz o resultado na mensagem (nada é
--     gravado — A-11);
--   · APLICAR (só com o OK do dono na conversa): rodar antes, na MESMA sessão,
--       select set_config('plt.acerto_s48', 'aplicar', false);
--     e depois este arquivo. Ao terminar, rodar
--       select set_config('plt.acerto_s48', '', false);
-- Idempotente: rodar de novo não acha peça nenhuma (as já canceladas ficam como
-- estão) e não grava nada.
-- ============================================================================
do $$
declare
  v_aplicar    boolean := coalesce(current_setting('plt.acerto_s48', true), '') = 'aplicar';
  v_inicio     bigint;
  v_n          integer := 0;
  v_avisos     integer := 0;
  v_recontados integer;
  v_antes      jsonb;
  v_depois     jsonb;
  v_pedidos    jsonb;
  r            record;
  p            record;
begin
  -- 0 · a atualização do banco desta sessão tem de estar no ar
  if to_regprocedure('plt_privado.fn_cancelar_fabricacao(bigint, bigint, uuid, text, bigint)') is null
     or not exists (select 1 from public.plt_etapas e where e.cancela_fabricacao) then
    raise exception 'Parei: a atualização do banco desta sessão ainda não foi aplicada (ou nenhuma coluna cancela a fabricação).';
  end if;

  -- 1 · antes
  select jsonb_build_object(
           'paradas_nas_colunas', (
             select count(*) from public.plt_cards c
               join public.plt_etapas e on e.id = c.etapa_atual_id and e.cancela_fabricacao
              where c.tipo = 'unidade' and c.arquivado_em is null and c.cancelada_em is null),
           'por_coluna', coalesce((
             select jsonb_object_agg(x.etapa, x.n) from (
               select e.nome as etapa, count(*) as n from public.plt_cards c
                 join public.plt_etapas e on e.id = c.etapa_atual_id and e.cancela_fabricacao
                where c.tipo = 'unidade' and c.arquivado_em is null and c.cancelada_em is null
                group by e.nome) x), '{}'::jsonb),
           'em_producao', (
             select count(*) from public.plt_cards c
               join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'producao'
              where c.tipo = 'unidade' and c.arquivado_em is null and c.concluido_em is null
                and c.cancelada_em is null and c.destino_pendente_em is null),
           'estoque_producao_de_pedido', (select coalesce(sum(n.producao_de_pedido), 0) from public.plt_estoque_numeros n),
           'estoque_producao_sem_dono', (select coalesce(sum(n.producao_sem_dono), 0) from public.plt_estoque_numeros n),
           'estante_basic_7_nichos_422', (
             select jsonb_build_object('de_pedido', coalesce(n.producao_de_pedido, 0), 'sem_dono', coalesce(n.producao_sem_dono, 0))
               from public.produtos pr
               left join public.plt_estoque_numeros n on n.produto_tiny_id = pr.tiny_id
              where pr.codigo = '422' order by pr.tiny_id limit 1),
           'pedidos_com_aviso', (select count(*) from public.plt_cards pc where pc.tipo = 'pedido' and pc.pcp_aviso_em is not null))
    into v_antes;

  -- os pedidos das peças paradas (para a conferência e o sino)
  select coalesce(jsonb_agg(jsonb_build_object('numero', x.numero, 'situacao', x.situacao, 'pecas', x.n) order by x.numero), '[]'::jsonb)
    into v_pedidos
    from (select pd.numero, pd.situacao, count(*) as n
            from public.plt_cards c
            join public.plt_etapas e on e.id = c.etapa_atual_id and e.cancela_fabricacao
            join public.pedidos pd on pd.id = c.pedido_id
           where c.tipo = 'unidade' and c.arquivado_em is null and c.cancelada_em is null
           group by pd.numero, pd.situacao) x;

  -- 2 · o acerto: cada peça pelo miolo do gesto (origem 'api', data de hoje),
  --     sem o sino peça a peça
  select coalesce(max(id), 0) into v_inicio from public.plt_eventos;
  perform set_config('plt.cancelamento_sem_aviso', 'on', true);
  for r in
    select c.id, c.etapa_atual_id
      from public.plt_cards c
      join public.plt_etapas e on e.id = c.etapa_atual_id and e.cancela_fabricacao
     where c.tipo = 'unidade' and c.arquivado_em is null and c.cancelada_em is null
     order by c.id
  loop
    if plt_privado.fn_cancelar_fabricacao(r.id, r.etapa_atual_id, null, 'api', null) is not null then
      v_n := v_n + 1;
    end if;
  end loop;
  perform set_config('plt.cancelamento_sem_aviso', '', true);

  -- o sino do PCP: UM aviso por pedido vivo que teve vaga de volta
  for p in
    select (e.dados ->> 'card_pedido_id')::bigint as card_pedido, (e.dados ->> 'numero')::int as numero,
           count(*)::int as n, max(e.id) as ultimo
      from public.plt_eventos e
     where e.id > v_inicio and e.tipo = 'fabricacao_cancelada'
       and coalesce((e.dados ->> 'vaga_volta')::boolean, false)
     group by 1, 2
  loop
    v_avisos := v_avisos + plt_privado.fn_avisar_publico(
      'peca_cancelada_pcp', 'pcp', p.ultimo, p.card_pedido,
      format('Peças canceladas na produção · pedido %s', p.numero),
      format('A arrumação das colunas CANCELADO e NÃO ENCONTRADO tirou %s do pedido %s da produção. %s ao PCP: veja o que aconteceu e decida.',
             case when p.n = 1 then '1 peça' else p.n || ' peças' end, p.numero,
             case when p.n = 1 then 'A vaga voltou' else 'As vagas voltaram' end));
  end loop;
  perform plt_privado.fn_avisar('pcp');

  -- 3 · os números do estoque recontados do zero
  v_recontados := plt_privado.fn_estoque_numeros_recontar();

  -- 4 · depois
  select jsonb_build_object(
           'paradas_nas_colunas', (
             select count(*) from public.plt_cards c
               join public.plt_etapas e on e.id = c.etapa_atual_id and e.cancela_fabricacao
              where c.tipo = 'unidade' and c.arquivado_em is null and c.cancelada_em is null),
           'canceladas_hoje', (select count(*) from public.plt_eventos e where e.id > v_inicio and e.tipo = 'fabricacao_cancelada'),
           'perderam_o_pedido', (select count(*) from public.plt_eventos e where e.id > v_inicio and e.tipo = 'unidade_desvinculada'),
           'em_producao', (
             select count(*) from public.plt_cards c
               join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'producao'
              where c.tipo = 'unidade' and c.arquivado_em is null and c.concluido_em is null
                and c.cancelada_em is null and c.destino_pendente_em is null),
           'estoque_producao_de_pedido', (select coalesce(sum(n.producao_de_pedido), 0) from public.plt_estoque_numeros n),
           'estoque_producao_sem_dono', (select coalesce(sum(n.producao_sem_dono), 0) from public.plt_estoque_numeros n),
           'estante_basic_7_nichos_422', (
             select jsonb_build_object('de_pedido', coalesce(n.producao_de_pedido, 0), 'sem_dono', coalesce(n.producao_sem_dono, 0))
               from public.produtos pr
               left join public.plt_estoque_numeros n on n.produto_tiny_id = pr.tiny_id
              where pr.codigo = '422' order by pr.tiny_id limit 1),
           'pedidos_com_aviso', (select count(*) from public.plt_cards pc where pc.tipo = 'pedido' and pc.pcp_aviso_em is not null),
           'linhas_do_estoque_recontadas', v_recontados,
           'avisos_no_sino', v_avisos)
    into v_depois;

  if not v_aplicar then
    raise exception 'ENSAIO (nada gravado): %',
      jsonb_build_object('pecas', v_n, 'pedidos', v_pedidos, 'antes', v_antes, 'depois', v_depois)::text;
  end if;
  raise notice 'APLICADO: %', jsonb_build_object('pecas', v_n, 'pedidos', v_pedidos, 'antes', v_antes, 'depois', v_depois)::text;
end;
$$;
