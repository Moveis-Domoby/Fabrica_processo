-- =============================================================================
-- SESSAO-33 · D-145 — a consulta de hora em hora pergunta os PRODUTOS
-- ALTERADOS só à FÁBRICA (pedido do dono, 18/10/2026: "Pode tirar a loja da
-- consulta de produtos alterados de hora em hora. Os produtos vêm da fábrica.")
--
-- Por quê: o aplicativo da API nova da LOJA (o do Comercial) não tem o módulo
-- Produtos — a pergunta levava 403 toda hora (desde a 93 ela termina calada,
-- mas era uma chamada inútil por hora). Os produtos da plataforma vêm da
-- fábrica (catálogo desde 23/09); o catálogo da loja segue pela API v2 na
-- carga. Os contatos alterados continuam nas duas contas.
--
-- Recriada a partir do banco (pg_get_functiondef — E-24); só a condição muda.
-- Sem DROP, sem mexer em tabela: segura para aplicar a qualquer hora.
-- =============================================================================

create or replace function plt_privado.fn_tiny_mudancas()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_hora time := (now() at time zone 'America/Fortaleza')::time;
  v_n    integer := 0;
  c      text;
begin
  -- D-143: só das 8h às 20h (o relógio já é esse; isto protege contra relógio mal posto)
  if v_hora < time '07:55' or v_hora > time '20:30' then
    return jsonb_build_object('fora_do_horario', true);
  end if;
  foreach c in array array['loja', 'fabrica'] loop
    -- clientes (loja) e fornecedores (fábrica) alterados — API v2
    v_n := v_n + plt_privado.fn_tiny_mudanca_enfileirar(c, 'contatos_pesquisa', 'dataMinimaAtualizacao',
                   'DD/MM/YYYY HH24:MI:SS', jsonb_build_object('pesquisa', '', 'pagina', 1));
    -- produtos alterados — só a API nova sabe; SÓ NA FÁBRICA (D-145: os produtos
    -- vêm da fábrica; o aplicativo da loja não tem o módulo Produtos)
    if c = 'fabrica' and plt_privado.fn_tiny_api_nova_ligada(c) then
      v_n := v_n + plt_privado.fn_tiny_mudanca_enfileirar(c, 'v3_produtos_alterados', 'dataAlteracao',
                     'YYYY-MM-DD HH24:MI:SS', '{}'::jsonb);
    end if;
  end loop;
  if v_n > 0 then
    perform plt_privado.fn_tiny_fila_acordar();
  end if;
  return jsonb_build_object('enfileirados', v_n);
end;
$function$;

comment on function plt_privado.fn_tiny_mudancas() is
  'SESSAO-33 (D-143 — exceção registrada à Lei §13; D-145): de hora em hora, só das 8h às 20h, pergunta ao Tiny o que mudou desde a última vez — contatos (as duas contas, API v2) e produtos (API nova, SÓ a fábrica — o aplicativo da loja não tem o módulo Produtos). Uma chamada por tipo quando nada mudou. Relógio plt-tiny-mudancas (17 11-23 * * * UTC = 8:17…20:17 na fábrica), ligado pelo dono na Auditoria.';

revoke all on function plt_privado.fn_tiny_mudancas() from public, anon, authenticated;
