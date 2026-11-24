-- ============================================================================
-- SESSAO-56 (ajustes) · item 2 — AVISO NO SINO QUANDO A BUSCA DE ENDEREÇO PASSA
-- 1 HORA FORA (resposta do dono, 23/11/2026 22:55: "sim" — a porta nova que o
-- reporte da 56 citou fica autorizada)
--
-- Quem recebe: admin e logística (o público 'logistica' do catálogo — quem já
-- recebe os avisos da logística). Quando: UMA vez por queda, quando a busca
-- está recusando há 1 hora ou mais.
--
-- Sem relógio novo (Lei de desempenho: trabalho nasce do fato): a função
-- `geocodificar` já guarda desde quando a busca está fora na linha reservada do
-- cache do mapa (plt_geocache, chave 'estado:busca-de-endereco', o dado em
-- `rota`: {fora_desde, avisado}). A chamada da busca que encontra o estado
-- "fora" há ≥ 1 h e ainda não avisado chama ESTA porta, que confere de novo no
-- banco (com a linha travada — duas chamadas ao mesmo tempo não avisam duas
-- vezes), grava o aviso e marca `avisado = true` na mesma linha. Quando a busca
-- volta, a função grava {fora_desde: null, avisado: false} — a próxima queda
-- avisa de novo.
--
--   1 · fn_avisos_catalogo + 'busca_endereco_fora' (grupo Expedição e estoque,
--       público logística) — recriada da vigente (20261116010000_plt_sessao51_base);
--   2 · public.plt_fn_busca_fora_avisar() — porta de SERVIÇO (execute só
--       service_role: quem chama é a função da busca, com a chave de serviço).
--
-- Nenhuma tabela, coluna ou índice novo; a leitura é pela chave única do cache.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · O catálogo dos avisos: + a busca de endereço fora (público logística)
-- ----------------------------------------------------------------------------
-- (recriada da vigente — 20261116010000_plt_sessao51_base.sql)
CREATE OR REPLACE FUNCTION plt_privado.fn_avisos_catalogo()
 RETURNS TABLE(tipo text, grupo text, grupo_nome text, ordem integer, nome text, descricao text, publico text, obrigatorio boolean, erro boolean)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select * from (values
    ('qualidade_atencao',        'producao',  'Produção e qualidade',             10, 'Peça em atenção',                         'Alguém marcou uma peça com algo a conferir.',                                   'lideranca', false, false),
    ('qualidade_danificado',     'producao',  'Produção e qualidade',             11, 'Peça danificada',                         'Alguém marcou uma peça como danificada.',                                       'lideranca', false, false),
    ('qualidade_divergencia',    'producao',  'Produção e qualidade',             12, 'Estado da peça diferente',                'Quem entregou e quem recebeu marcaram estados diferentes.',                     'lideranca', false, false),
    ('tarefa_sistema',           'producao',  'Produção e qualidade',             13, 'Recebimento para confirmar',              'Uma peça chegou ao setor e espera a confirmação do estado.',                    'todos',     false, false),
    ('card_esquecido',           'producao',  'Produção e qualidade',             14, 'Ainda tem alguém neste card?',            'Card da montagem rodando há 2 horas sem parar.',                                'todos',     true,  false),
    ('execucao_pulada',          'producao',  'Produção e qualidade',             15, 'Móvel pulou a montagem',                  'Um móvel saiu da Montagem (ou de outro setor com o aviso ligado) sem ninguém iniciar.', 'admin',     false, false),
    ('peca_cancelada_pcp',       'producao',  'Produção e qualidade',             16, 'Peça cancelada na produção',              'A peça foi para CANCELADO ou NÃO ENCONTRADO e a vaga do pedido voltou ao PCP.',  'pcp',       false, false),
    -- SESSAO-51 (bloco B): o administrador devolveu a peça ao PCP (vaga do pedido ou reposição)
    ('card_voltou_pcp',          'producao',  'Produção e qualidade',             17, 'Peça devolvida ao PCP',                   'Um administrador tirou a peça da produção e a devolveu ao PCP (a vaga do pedido reabriu ou ela virou reposição de estoque).', 'pcp', false, false),
    ('chegada_aguardo',          'expedicao', 'Expedição e estoque',              20, 'Peça pronta na Expedição',                'Cada peça de pedido que fica pronta.',                                          'admin',     false, false),
    ('chegada_estoque',          'expedicao', 'Expedição e estoque',              21, 'Peça entrou no estoque',                  'Cada peça sem dono que entra no estoque.',                                      'admin',     false, false),
    ('devolucao_decidir',        'expedicao', 'Expedição e estoque',              22, 'Pedido devolvido ou entregue em parte',   'Peças esperando a decisão da logística.',                                       'logistica', false, false),
    ('pedido_cancelado_decidir', 'expedicao', 'Expedição e estoque',              23, 'Pedido cancelado com móveis em produção', 'O Tiny cancelou o pedido: a logística decide para onde vai cada móvel que estava sendo feito.', 'logistica', false, false),
    -- SESSAO-51 (bloco A): a entrega parcial que tirou da produção o que estava na fábrica, e o revogar
    ('entrega_parcial_retirada', 'expedicao', 'Expedição e estoque',              24, 'Entrega parcial tirou peças da produção',  'Na entrega parcial, o que ainda estava na fábrica saiu da produção (dá para voltar atrás em PCP → Entregas parciais).', 'pcp', false, false),
    ('entrega_parcial_revogada', 'expedicao', 'Expedição e estoque',              25, 'Decisão da entrega parcial revogada',     'Alguém voltou atrás na decisão de uma entrega parcial: as peças voltaram para a produção ou saíram dela.', 'pcp', false, false),
    -- SESSAO-56 (ajustes): a busca de endereço recusando há 1 hora ou mais — uma vez por queda
    ('busca_endereco_fora',      'expedicao', 'Expedição e estoque',              26, 'Busca de endereço fora do ar',            'A busca de endereço está recusando há 1 hora ou mais: os pontos novos no mapa precisam ser marcados à mão.', 'logistica', false, false),
    ('pedido_cancelado',         'pedidos',   'Pedidos e Tiny',                   30, 'Pedido cancelado com produção',           'Cancelado no Tiny com peças já liberadas.',                                     'admin',     false, false),
    ('pedido_excluido_no_tiny',  'pedidos',   'Pedidos e Tiny',                   31, 'Pedido excluído no Tiny',                 'O pedido não existe mais no Tiny e saiu do PCP: segue o caminho do cancelado.',  'logistica', false, false),
    ('produto_excluido_no_tiny', 'pedidos',   'Pedidos e Tiny',                   32, 'Produto apagado no Tiny',                 'Apagado no Tiny, mas ainda com peças no quadro.',                               'admin',     false, false),
    ('pedido_itens_novos',      'pedidos',   'Pedidos e Tiny',                   33, 'Itens novos num pedido já liberado', 'O vendedor acrescentou itens no Tiny e o pedido voltou ao PCP só com o que falta.', 'pcp',       false, false),
    ('pedido_itens_sairam',     'pedidos',   'Pedidos e Tiny',                   34, 'Item saiu de um pedido com peça feita', 'O Tiny tirou ou diminuiu um item que já tem peça — nada foi arquivado.',        'pcp',       false, false),
    ('pedido_itens_rota',       'pedidos',   'Pedidos e Tiny',                   35, 'Pedido na rota ganhou itens',       'Segure a entrega: o pedido voltou ao PCP com os itens novos.',                  'logistica', false, false),
    ('tiny_saiu_de_entregue',   'pedidos',   'Pedidos e Tiny',                   36, 'Pedido voltou atrás no Tiny',       'Saiu de "Entregue" no Tiny: a entrega que veio do Tiny reabre; a feita aqui só avisa.', 'logistica', false, false),
    ('pedido_peca_liberada',    'pedidos',   'Pedidos e Tiny',                   37, 'Peça pronta liberada para outro pedido', 'A Expedição deu a peça pronta de um pedido para outro: ele voltou ao PCP para produzir de novo.', 'pcp', false, false),
    ('pedido_voltou_pcp',       'pedidos',   'Pedidos e Tiny',                   38, 'Pedido devolvido ao PCP pela logística', 'O Tiny tinha levado o pedido adiante com produto por liberar: a logística mudou a situação lá e ele voltou ao PCP.', 'pcp', false, false),
    ('pedido_adiantado_tiny',   'pedidos',   'Pedidos e Tiny',                   39, 'Pedido adiantado no Tiny ficou na Expedição', 'A peça pronta saiu do pedido, mas o Tiny já o levou adiante: ele ficou na Expedição esperando a decisão.', 'logistica', false, false),
    ('endereco_tiny_mudou',     'pedidos',   'Pedidos e Tiny',                   29, 'Endereço mudou no Tiny',             'O endereço de entrega mudou no Tiny e o endereço alterado na plataforma deixou de valer.', 'logistica', false, false),
    ('delegacao',                'cards',     'Cards e afazeres',                 40, 'Um afazer chegou para você',              'Um card foi colocado sob sua responsabilidade.',                                'todos',     false, false),
    ('card_responsavel',         'cards',     'Cards e afazeres',                 41, 'Você virou responsável por um card',      null,                                                                            'todos',     false, false),
    ('card_mencao',              'cards',     'Cards e afazeres',                 42, 'Mencionaram você',                        'Alguém escreveu o seu nome na conversa de um card.',                            'todos',     false, false),
    ('automacao',                'cards',     'Cards e afazeres',                 43, 'Aviso de uma automação',                  'As automações da plataforma que mandam aviso.',                                 'todos',     false, false),
    ('senha_pedido',             'acesso',    'Acesso',                           50, 'Pedido de troca de senha',                'Alguém pediu para trocar a senha.',                                             'admin',     true,  false),
    ('senha_sem_cadastro',       'acesso',    'Acesso',                           51, 'Troca de senha para e-mail sem cadastro', 'Pode ser alguém da equipe que digitou o e-mail errado.',                        'admin',     false, false),
    ('automacao_erro',           'erros',     'Erros de automação e integrações', 60, 'Integração com o Tiny ou o n8n parou',    'O Tiny desistiu de um item, uma automação do n8n deu erro, a conexão com o Tiny da fábrica caiu ou a lista do Tiny veio incompleta.', 'admin', false, true),
    ('tiny_pedido_parado',       'erros',     'Erros de automação e integrações', 61, 'O Tiny não aceitou a situação de um pedido', 'Depois de 8 tentativas, a situação do pedido não mudou lá.',                 'admin',     false, true),
    ('automacao_falhou',         'erros',     'Erros de automação e integrações', 62, 'Uma automação da plataforma falhou',      'Uma automação montada no Super admin parou com erro.',                          'admin',     false, true),
    ('estoque_tiny_parado',      'erros',     'Erros de automação e integrações', 63, 'O estoque parou de ir para o Tiny',       'Depois de 5 tentativas, o saldo de um móvel não foi atualizado no Tiny.',       'admin',     false, true),
    ('webhook_falhou',           'erros',     'Erros de automação e integrações', 64, 'Aviso para uma integração não entregue',  'A plataforma não conseguiu avisar uma integração depois de 5 tentativas.',     'admin',     false, true)
  ) as c(tipo, grupo, grupo_nome, ordem, nome, descricao, publico, obrigatorio, erro);
$function$;


-- ----------------------------------------------------------------------------
-- 2 · A porta que avisa (uma vez por queda) — chamada pela função da busca
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_busca_fora_avisar()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_estado jsonb;
  v_desde  timestamptz;
begin
  -- a linha reservada do estado da busca, travada: duas chamadas ao mesmo
  -- tempo não avisam duas vezes
  select g.rota into v_estado
    from public.plt_geocache g
   where g.chave = 'estado:busca-de-endereco'
     for update;
  if v_estado is null or jsonb_typeof(v_estado) <> 'object' then
    return false;
  end if;
  v_desde := nullif(v_estado ->> 'fora_desde', '')::timestamptz;
  if v_desde is null                                              -- a busca está respondendo
     or coalesce((v_estado ->> 'avisado')::boolean, false)        -- esta queda já foi avisada
     or now() - v_desde < interval '1 hour' then                  -- ainda não deu 1 hora
    return false;
  end if;

  -- o toque abre Rotas (destinoDoAviso, na tela); o filtro de cada pessoa vale
  -- na gravação (plt_notificacoes_filtrar)
  perform plt_privado.fn_avisar_publico(
    'busca_endereco_fora', 'logistica', null, null,
    'Busca de endereço fora do ar',
    format('A busca de endereço está fora desde %s. Os pontos novos no mapa precisam ser marcados à mão em Editar endereço.',
           to_char(v_desde at time zone 'America/Fortaleza', 'DD/MM "às" HH24:MI')));

  update public.plt_geocache
     set rota = v_estado || jsonb_build_object('avisado', true)
   where chave = 'estado:busca-de-endereco';
  return true;
end;
$$;

comment on function public.plt_fn_busca_fora_avisar() is
  'SESSAO-56 (ajustes, resposta do dono de 23/11): porta de SERVIÇO chamada pela função geocodificar — se a busca de endereço está fora há 1 hora ou mais (linha reservada estado:busca-de-endereco do cache do mapa) e esta queda ainda não foi avisada, grava o aviso busca_endereco_fora para admin e logística e marca avisado = true na mesma linha. Devolve se avisou. Sem relógio: nasce da própria chamada da busca.';

revoke all on function public.plt_fn_busca_fora_avisar() from public, anon, authenticated;
grant execute on function public.plt_fn_busca_fora_avisar() to service_role;
