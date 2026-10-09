-- ============================================================================
-- SESSAO-30 · ajuste D-122 (09/10): o resumo da conferência contava como
-- "pagas" também as contas NOVAS que já chegaram pagas do Tiny (na 1ª rodada,
-- 09/10 00:39: 320 "pagas" = 47 que estavam em aberto e foram pagas + 273 novas
-- já pagas). A Auditoria leria "320 foram pagas". Agora o bloco "contas" traz
-- `viraram_pagas` (só a conta que já estava aqui e virou paga); o `pagas`
-- antigo sai. O resumo de 09/10 00:39 fica como foi gravado (o log não se edita)
-- e a tela só mostra o número das pagas quando a rodada tem o campo novo.
--
-- Só `plt_privado.fn_tiny_pente_fino_resumir`, recriada a partir da versão VIVA
-- (a da migration 64). Nenhuma tabela, nenhuma linha.
-- ============================================================================

set local lock_timeout = '5s';

CREATE OR REPLACE FUNCTION plt_privado.fn_tiny_pente_fino_resumir(p_rodada text, p_estado text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_busca  jsonb;
  v_resumo jsonb;
begin
  select f.params into v_busca from public.tiny_fila f
   where f.recurso = 'pedidos_pesquisa' and f.chave = 'pente-fino:p1';

  with linhas as (
    select f.recurso, f.status, f.referencia, f.params
      from public.tiny_fila f
     where f.params->>'rodada' = p_rodada
  ),
  pedidos_rodada as (
    select l.*, coalesce(l.params->'mudou', '[]'::jsonb) as mudou
      from linhas l where l.recurso = 'pedido'
  ),
  contas_rodada as (                  -- ↪️ D-122
    select l.* from linhas l where l.recurso = 'conta_receber'
  )
  select jsonb_build_object(
           'rodada',          p_rodada,
           'estado',          p_estado,
           'motivo',          coalesce(v_busca->>'motivo', 'madrugada'),
           'inicio',          v_busca->>'inicio',
           'fim',             now(),
           'janela_dias',     60,
           'paginas_busca',   (select count(*) from linhas where recurso = 'pedidos_pesquisa'),
           'relidos',         (select count(*) from pedidos_rodada where status = 'ok'),
           'mudaram',         (select count(*) from pedidos_rodada where status = 'ok' and jsonb_array_length(mudou) > 0),
           'novos',           (select count(*) from pedidos_rodada where mudou ? 'novo'),
           'nao_encontrados', (select count(*) from pedidos_rodada where status = 'vazio'),
           'falhas',          (select count(*) from linhas where status = 'erro'),
           'pendentes',       (select count(*) from linhas where status in ('pendente', 'processando')),
           'contas',          jsonb_build_object(
              'paginas_busca',   (select count(*) from linhas where recurso = 'cr_pesquisa'),
              'relidas',         (select count(*) from contas_rodada where status = 'ok'),
              'novas',           (select count(*) from contas_rodada where status = 'ok'
                                     and coalesce((params->>'nova')::boolean, false)),
              -- ↪️ migration 65: só a conta que JÁ estava aqui e virou paga (a nova que
              -- chega paga não "foi paga" desde a última conferência). Nome novo de
              -- propósito: o resumo de 09/10 00:39 (com o "pagas" antigo) fica como está.
              'viraram_pagas',   (select count(*) from contas_rodada where status = 'ok'
                                     and not coalesce((params->>'nova')::boolean, false)
                                     and params->>'situacao' = 'pago'
                                     and coalesce(params->>'situacao_antes', '') <> 'pago'),
              'abertas',         (select count(*) from contas_rodada where status = 'ok'
                                     and coalesce(params->>'situacao', '') not in ('pago', 'cancelada')),
              'nao_encontradas', (select count(*) from contas_rodada where status = 'vazio')),
           'pedidos',         coalesce((
              select jsonb_agg(jsonb_build_object('numero', x.numero, 'campos', x.mudou) order by x.numero desc)
                from (select coalesce(pr.params->>'numero', pr.referencia) as numero, pr.mudou
                        from pedidos_rodada pr
                       where pr.status = 'ok' and jsonb_array_length(pr.mudou) > 0
                       order by 1 desc
                       limit 300) x), '[]'::jsonb))
    into v_resumo;

  insert into public.eventos (tipo, payload) values ('pente_fino', v_resumo);

  update public.tiny_fila f
     set params = f.params || jsonb_build_object('resumo_em', now())
   where f.recurso = 'pedidos_pesquisa' and f.chave = 'pente-fino:p1'
     and f.params->>'rodada' = p_rodada;
  return v_resumo;
end;
$function$;
