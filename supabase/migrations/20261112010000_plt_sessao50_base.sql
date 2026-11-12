-- ============================================================================
-- SESSAO-50 · BASE — o que os três blocos leem (commitado antes das frentes —
-- A-201): os tipos de fato novos, a observação do item, as projeções do PCP,
-- o motivo novo da fila de saída do Tiny e o catálogo dos avisos
-- ============================================================================
-- Pedidos do dono de 12/11 (vídeo do 13871 + respostas das 01:25 e 01:30):
--   bloco A · a observação que vem DENTRO do item no Tiny ("adicionar rodízios")
--             passa a ser guardada (pedido_itens.info_adicional) e aparece na capa
--             do card, na janela do card, no tablet e no PCP;
--   bloco B · o PCP ganha "Cancelar pedido" (cancela também no Tiny, pela fila de
--             saída — motivo novo 'cancelar') e "Ocultar do PCP" (a remoção da 48
--             com o motivo 'oculto'); o pedido excluído no Tiny sai do PCP de vez
--             e segue o caminho do cancelado;
--   bloco C · editar a parada avulsa e o endereço de entrega do pedido (o
--             original do Tiny guardado no fato).
-- Aqui só o que mais de um bloco lê ou o que precisa existir antes das portas:
-- cada bloco traz as suas regras e portas na migration dele.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Os tipos de fato novos (o validate mora AQUI agora — E-19; saiu da
--     20261111010000)
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
  'data_entrega_alterada', 'peca_vinculada', 'tempo_decisao', 'pedido_itens_alterados',
  'pedido_volta_pcp', 'pedido_volta_pcp_fim', 'entrega_dia_corrigido',
  -- SESSAO-48: cancelar a fabricação e retomar (frentes 1 e 4); o aviso resolvido,
  -- a remoção do PCP e a devolução (frente 2); o destino da peça de pedido
  -- cancelado no Tiny (frente 3)
  'fabricacao_cancelada', 'fabricacao_retomada', 'pcp_aviso_resolvido', 'pedido_removido_pcp',
  'pedido_devolvido_pcp', 'destino_pendente', 'destino_decidido',
  -- SESSAO-50: o pedido excluído no Tiny (e reencontrado), o cancelamento pela plataforma e a
  -- peça ocultada com o pedido (bloco B); o endereço de entrega alterado na plataforma (bloco C)
  'pedido_excluido_tiny', 'pedido_reencontrado_tiny', 'pedido_cancelado_plataforma', 'card_oculto',
  'endereco_entrega_alterado', 'endereco_entrega_restaurado', 'endereco_entrega_tiny_confirmado',
  'endereco_entrega_tiny_substituido'
]::text[])) not valid;
alter table public.plt_eventos validate constraint plt_eventos_tipo_check;

-- ----------------------------------------------------------------------------
-- 2 · O catálogo dos avisos: o pedido excluído no Tiny vai para a logística (que
--     inclui os administradores pela régua do público) e dá a notícia nova
--     ("saiu do PCP"); o aviso do endereço que mudou no Tiny (bloco C)
-- ----------------------------------------------------------------------------
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
    ('chegada_aguardo',          'expedicao', 'Expedição e estoque',              20, 'Peça pronta na Expedição',                'Cada peça de pedido que fica pronta.',                                          'admin',     false, false),
    ('chegada_estoque',          'expedicao', 'Expedição e estoque',              21, 'Peça entrou no estoque',                  'Cada peça sem dono que entra no estoque.',                                      'admin',     false, false),
    ('devolucao_decidir',        'expedicao', 'Expedição e estoque',              22, 'Pedido devolvido ou entregue em parte',   'Peças esperando a decisão da logística.',                                       'logistica', false, false),
    ('pedido_cancelado_decidir', 'expedicao', 'Expedição e estoque',              23, 'Pedido cancelado com móveis em produção', 'O Tiny cancelou o pedido: a logística decide para onde vai cada móvel que estava sendo feito.', 'logistica', false, false),
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
-- 3 · Bloco A · a observação do item do Tiny (raw → itens[].item.info_adicional)
--     A demanda sugeria uma coluna em pedido_itens; a regra 10 da casa não deixa
--     a plataforma mudar as tabelas da integração (o aplicador confere a
--     impressão digital delas e para se mudar) — a observação mora numa tabela
--     da plataforma, com a MESMA chave do item (pedido, posição): esparsa (só os
--     itens que têm observação), mantida por gatilho a partir do raw do pedido
--     (bloco A) e lida nas mesmas portas por junção pela chave (nunca do raw).
--     Texto limpo: sem espaço nas pontas, espaços repetidos viram um; vazio não
--     tem linha.
-- ----------------------------------------------------------------------------
create table if not exists public.plt_itens_observacao (
  pedido_id     bigint      not null references public.pedidos(id) on delete cascade,
  seq           integer     not null,
  texto         text        not null,
  atualizado_em timestamptz not null default now(),
  constraint plt_itens_observacao_pk primary key (pedido_id, seq),
  constraint plt_itens_observacao_texto_ck check (length(texto) between 1 and 2000)
);
comment on table public.plt_itens_observacao is
  'SESSAO-50 (bloco A): a observação do ITEM no Tiny (raw.itens[].item.info_adicional), limpa, por (pedido, posição do item — a mesma seq de pedido_itens). Só os itens com observação têm linha. Escrita só pelo gatilho do pedido (o raw que o Tiny manda) e pelo preenchimento dos antigos; lida pelas portas do quadro, do tablet, da janela do card e do PCP. Não é a observação do pedido (obs/obs_interna).';
alter table public.plt_itens_observacao enable row level security;
revoke all on public.plt_itens_observacao from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4 · Bloco B · projeções no card do PEDIDO (escritas SÓ pelos gatilhos dos
--     fatos — M-13)
-- ----------------------------------------------------------------------------
-- o cancelamento pedido pela plataforma ("Cancelar pedido" no PCP): o pedido sai
-- do PCP na hora, sem esperar o Tiny; a marca fica como trilha depois que o Tiny
-- confirma
alter table public.plt_cards add column if not exists cancelado_plataforma_em timestamptz;
alter table public.plt_cards add column if not exists cancelado_plataforma_evento_id bigint;
comment on column public.plt_cards.cancelado_plataforma_em is
  'SESSAO-50 (bloco B): no card do PEDIDO, quando o PCP tocou "Cancelar pedido" (fato pedido_cancelado_plataforma). O pedido sai do PCP na hora e segue o caminho do cancelado; o Tiny recebe o pedido de cancelamento pela fila de saída. Projeção — só o gatilho do fato escreve.';

alter table public.plt_cards drop constraint if exists plt_cards_cancelado_plataforma_ck;
alter table public.plt_cards add constraint plt_cards_cancelado_plataforma_ck check (
  (cancelado_plataforma_em is null) = (cancelado_plataforma_evento_id is null)
) not valid;
alter table public.plt_cards validate constraint plt_cards_cancelado_plataforma_ck;

-- "Ocultar do PCP" usa a máquina da remoção da 48 com o motivo 'oculto' (os três
-- motivos antigos seguem aceitos — nenhum pedido os usa, mas a reaplicação das
-- migrations da 48 nos testes grava com eles)
alter table public.plt_cards drop constraint if exists plt_cards_removido_pcp_ck;
alter table public.plt_cards add constraint plt_cards_removido_pcp_ck check (
  (removido_pcp_em is null and removido_pcp_motivo is null and removido_pcp_texto is null
   and removido_pcp_evento_id is null)
  or (removido_pcp_em is not null
      and coalesce(removido_pcp_motivo, '') in ('oculto', 'pedido_cancelado', 'fora_da_linha', 'outro'))
) not valid;
alter table public.plt_cards validate constraint plt_cards_removido_pcp_ck;

-- ----------------------------------------------------------------------------
-- 5 · Bloco B · a fila de saída do Tiny ganha o motivo 'cancelar' (o "Cancelar
--     pedido" do PCP pede a situação cancelado ao Tiny pelo mesmo caminho do
--     "Entregue" e da volta ao PCP — uma vontade por pedido, vale a última)
-- ----------------------------------------------------------------------------
alter table public.plt_tiny_pedido_fila drop constraint if exists plt_tiny_pedido_fila_motivo_ck;
alter table public.plt_tiny_pedido_fila add constraint plt_tiny_pedido_fila_motivo_ck
  check (coalesce(motivo, '') in ('entregue', 'desfeita', 'volta_pcp', 'cancelar')) not valid;
alter table public.plt_tiny_pedido_fila validate constraint plt_tiny_pedido_fila_motivo_ck;
