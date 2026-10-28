-- ============================================================================
-- Ajuste de 28/10/2026 (D-202) — os AVISOS que cada pessoa recebe, escolhidos
-- numa tela (Configurações → Avisos), e os avisos de ERRO que faltavam
--
-- Pedido do dono: "crie uma tela em configurações para editar as notificações
-- com todos os avisos possíveis, para que o usuário possa editar os avisos que
-- ele deseja receber — quero remover alguns desnecessários para mim e colocar
-- outros que são necessários, como notificações de erros de automação". E
-- corrigir os dois achados do ajuste da senha (a barrinha do sino — tela; o
-- administrador que recebia o aviso da própria troca de senha — aqui).
--
-- Respostas do dono (28/10): cada um escolhe os próprios avisos e o
-- administrador escolhe os de qualquer pessoa; os dois urgentes (troca de senha
-- e card esquecido) ficam SEMPRE ligados; viram aviso também a automação da
-- plataforma que falhou, o estoque que parou de ir para o Tiny e o aviso para
-- uma integração que não foi entregue; os erros chegam ligados só para o super
-- admin — os outros administradores ligam se quiserem.
--
--   1. O CATÁLOGO dos avisos (fn_avisos_catalogo): tipo, assunto, nome, uma
--      frase, quem pode receber, se é obrigatório e se é erro.
--   2. A escolha de cada pessoa: plt_usuarios.avisos jsonb {tipo: true|false}
--      (nulo = o padrão de tudo). Fora da API (E-50): só pelas portas.
--   3. UM filtro na entrada de plt_notificacoes (gatilho antes de gravar): o
--      aviso desligado não nasce — vale para todo produtor de aviso, de hoje e
--      de amanhã, sem mexer em nenhum. Tipo fora do catálogo passa (nada some).
--   4. Os erros vão para os ADMINISTRADORES (o filtro deixa só quem quer): o
--      alerta de sempre (fn_tiny_alertar) vira caso de fn_alertar_erro (uma
--      linha na Auditoria SEMPRE; o aviso sem repetir no intervalo); o "Tiny não
--      aceitou a situação do pedido" também; e os três erros novos nascem do
--      FATO (gatilhos — nada de relógio): a execução de automação que falhou, a
--      linha do estoque do Tiny que parou, a entrega de webhook que falhou.
--   5. Troca de senha: quem pede não recebe o próprio aviso, não vê o próprio
--      pedido na lista e não decide o próprio pedido.
--   6. As portas da tela: plt_fn_avisos (uma requisição: o catálogo de quem
--      pode receber, o que está ligado, quantos chegaram em 30 dias e — para o
--      administrador — a lista das pessoas) e plt_fn_aviso_definir (o toque).
--
-- Nenhuma tabela nova; nada da integração.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A escolha de cada pessoa
-- ----------------------------------------------------------------------------
alter table public.plt_usuarios add column if not exists avisos jsonb;

comment on column public.plt_usuarios.avisos is
  'D-202 (28/10): os avisos que a pessoa escolheu — {tipo: true|false}; tipo ausente = o padrão do catálogo (plt_privado.fn_avisos_catalogo). Fora da API (sem grant de coluna): lido e gravado só por plt_fn_avisos / plt_fn_aviso_definir.';

-- ----------------------------------------------------------------------------
-- 2 · O catálogo (a ordem é a da tela)
--     publico: todos · lideranca (admin, líder, líder de setor) · logistica
--     (admin e quem é da logística/PCP) · admin
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_avisos_catalogo()
returns table (
  tipo        text,
  grupo       text,
  grupo_nome  text,
  ordem       integer,
  nome        text,
  descricao   text,
  publico     text,
  obrigatorio boolean,
  erro        boolean
)
language sql
immutable
set search_path = public, pg_temp
as $$
  select * from (values
    ('qualidade_atencao',        'producao',  'Produção e qualidade',             10, 'Peça em atenção',                         'Alguém marcou uma peça com algo a conferir.',                                   'lideranca', false, false),
    ('qualidade_danificado',     'producao',  'Produção e qualidade',             11, 'Peça danificada',                         'Alguém marcou uma peça como danificada.',                                       'lideranca', false, false),
    ('qualidade_divergencia',    'producao',  'Produção e qualidade',             12, 'Estado da peça diferente',                'Quem entregou e quem recebeu marcaram estados diferentes.',                     'lideranca', false, false),
    ('tarefa_sistema',           'producao',  'Produção e qualidade',             13, 'Recebimento para confirmar',              'Uma peça chegou ao setor e espera a confirmação do estado.',                    'todos',     false, false),
    ('card_esquecido',           'producao',  'Produção e qualidade',             14, 'Ainda tem alguém neste card?',            'Card da montagem rodando há 2 horas sem parar.',                                'todos',     true,  false),
    ('chegada_aguardo',          'expedicao', 'Expedição e estoque',              20, 'Peça pronta na Expedição',                'Cada peça de pedido que fica pronta.',                                          'admin',     false, false),
    ('chegada_estoque',          'expedicao', 'Expedição e estoque',              21, 'Peça entrou no estoque',                  'Cada peça sem dono que entra no estoque.',                                      'admin',     false, false),
    ('devolucao_decidir',        'expedicao', 'Expedição e estoque',              22, 'Pedido devolvido ou entregue em parte',   'Peças esperando a decisão da logística.',                                       'logistica', false, false),
    ('pedido_cancelado',         'pedidos',   'Pedidos e Tiny',                   30, 'Pedido cancelado com produção',           'Cancelado no Tiny com peças já liberadas.',                                     'admin',     false, false),
    ('pedido_excluido_no_tiny',  'pedidos',   'Pedidos e Tiny',                   31, 'Pedido excluído no Tiny',                 'O pedido não existe mais no Tiny e saiu dos quadros.',                          'admin',     false, false),
    ('produto_excluido_no_tiny', 'pedidos',   'Pedidos e Tiny',                   32, 'Produto apagado no Tiny',                 'Apagado no Tiny, mas ainda com peças no quadro.',                               'admin',     false, false),
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
$$;

comment on function plt_privado.fn_avisos_catalogo() is
  'D-202 (28/10): todos os avisos da plataforma — tipo, assunto, nome e frase da tela, quem pode receber (todos · lideranca · logistica · admin), obrigatório (não desliga) e erro (ligado por padrão só para o super admin). Aviso novo = uma linha aqui.';

-- quem pode receber um aviso daquele público
create or replace function plt_privado.fn_aviso_publico_de(p_publico text, p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case p_publico
           when 'todos' then true
           when 'admin' then u.papel = 'admin'
           when 'lideranca' then u.papel in ('admin', 'lider')
                                  or exists (select 1 from public.plt_usuario_setores us
                                              where us.usuario_id = u.id and us.lider_do_setor)
           when 'logistica' then u.papel in ('admin', 'logistica') or plt_privado.fn_eh_logistica(u.id)
           else false
         end
    from public.plt_usuarios u
   where u.id = p_usuario;
$$;

-- ligado para a pessoa? (obrigatório sempre; a escolha dela; senão o padrão)
create or replace function plt_privado.fn_aviso_ligado(p_tipo text, p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select case
             when c.tipo is null then true   -- fora do catálogo: chega (nada some sem querer)
             when c.obrigatorio then true
             else coalesce((u.avisos ->> p_tipo)::boolean,
                           case when c.erro then coalesce(u.super_admin, false) else true end)
           end
      from public.plt_usuarios u
      left join plt_privado.fn_avisos_catalogo() c on c.tipo = p_tipo
     where u.id = p_usuario), true);
$$;

-- ----------------------------------------------------------------------------
-- 3 · O filtro na entrada: o aviso desligado não nasce
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_aviso_filtrar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not plt_privado.fn_aviso_ligado(new.tipo, new.destinatario_id) then
    return null;
  end if;
  return new;
end;
$$;

comment on function plt_privado.fn_aviso_filtrar() is
  'D-202 (28/10): antes de gravar um aviso, confere a escolha de quem recebe (fn_aviso_ligado) — desligado, o aviso não nasce (nem vai ao sino). Vale para todo produtor de aviso.';

drop trigger if exists plt_notificacoes_filtrar on public.plt_notificacoes;
create trigger plt_notificacoes_filtrar
  before insert on public.plt_notificacoes
  for each row execute function plt_privado.fn_aviso_filtrar();

-- ----------------------------------------------------------------------------
-- 4 · Os erros: para os administradores (o filtro deixa quem quer)
-- ----------------------------------------------------------------------------
-- O alerta de erro: uma linha na Auditoria SEMPRE; o aviso no sino só se não
-- houve o mesmo (a mesma chave) dentro do intervalo. (Era o corpo de
-- fn_tiny_alertar — da 20261017010000 —, agora com o tipo do aviso e para os
-- administradores.)
create or replace function plt_privado.fn_alertar_erro(
  p_tipo text, p_chave text, p_titulo text, p_corpo text, p_contexto jsonb,
  p_intervalo interval default interval '1 hour', p_card_id bigint default null)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ja boolean;
begin
  select exists (select 1 from public.plt_logs_atividade l
                  where l.acao = 'automacao_erro'
                    and l.criado_em > now() - p_intervalo
                    and l.contexto->>'aviso_id' = p_chave)
    into v_ja;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (null, 'automacao_erro',
          coalesce(p_contexto, '{}'::jsonb)
          || jsonb_build_object('aviso_id', p_chave, 'titulo', p_titulo, 'corpo', left(p_corpo, 600),
                                'tipo_aviso', p_tipo));

  if not v_ja then
    insert into public.plt_notificacoes (destinatario_id, card_id, tipo, titulo, corpo)
    select u.id, p_card_id, p_tipo, left(p_titulo, 120), left(p_corpo, 600)
      from public.plt_usuarios u
     where u.ativo and u.arquivado_em is null and not u.conta_tablet
       and (u.papel = 'admin' or u.super_admin);
  end if;
  return not v_ja;
end;
$$;

comment on function plt_privado.fn_alertar_erro(text, text, text, text, jsonb, interval, bigint) is
  'D-202 (28/10): o alerta de erro — uma linha na Auditoria (acao automacao_erro) SEMPRE; o aviso (p_tipo) aos administradores só se a mesma chave não avisou dentro do intervalo. Quem recebe decide o filtro dos avisos (erro: ligado por padrão só para o super admin).';

-- o de sempre (fila do Tiny, n8n, a conexão da fábrica, a conferência) — mesma assinatura
create or replace function plt_privado.fn_tiny_alertar(
  p_chave text, p_titulo text, p_corpo text, p_contexto jsonb,
  p_intervalo interval default interval '1 hour')
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select plt_privado.fn_alertar_erro('automacao_erro', p_chave, p_titulo, p_corpo, p_contexto, p_intervalo);
$$;

-- 4a · a automação da plataforma que falhou (o fato: a execução virou 'falhou')
create or replace function plt_privado.fn_alertar_automacao_falhou()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_erro text;
begin
  if tg_op = 'UPDATE' and old.situacao = 'falhou' then
    return null; -- já tinha falhado: avisou quando falhou
  end if;
  select r ->> 'frase' into v_erro
    from jsonb_array_elements(coalesce(new.resultado, '[]'::jsonb)) with ordinality as x(r, i)
   where r ->> 'resultado' = 'falhou'
   order by i desc
   limit 1;
  v_erro := coalesce(v_erro, nullif(substring(coalesce(new.avaliacao, '') from 'erro: (.*)$'), ''), 'erro sem descrição');
  perform plt_privado.fn_alertar_erro(
    'automacao_falhou',
    'automacao:' || new.automacao_id,
    'A automação "' || left(new.automacao_nome, 60) || '" falhou',
    'A automação "' || new.automacao_nome || '" parou com erro: ' || left(v_erro, 300)
      || '. O resto da plataforma segue; a execução fica na tela das automações.',
    jsonb_build_object('origem', 'automacao_plataforma', 'automacao_id', new.automacao_id,
                       'execucao_id', new.id, 'erro', left(v_erro, 300)),
    interval '1 hour',
    new.card_id);
  return null;
end;
$$;

drop trigger if exists plt_automacao_execucoes_falhou on public.plt_automacao_execucoes;
create trigger plt_automacao_execucoes_falhou
  after insert or update of situacao on public.plt_automacao_execucoes
  for each row
  when (new.situacao = 'falhou')
  execute function plt_privado.fn_alertar_automacao_falhou();

-- 4b · o estoque que parou de ir para o Tiny (o fato: a linha da fila parou)
create or replace function plt_privado.fn_alertar_estoque_tiny_parado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nome text;
begin
  if tg_op = 'UPDATE' and old.parado_em is not null then
    return null; -- já estava parada: avisou quando parou
  end if;
  select coalesce(p.descricao, p.codigo, new.produto_tiny_id::text) into v_nome
    from public.produtos p where p.tiny_id = new.produto_tiny_id;
  perform plt_privado.fn_alertar_erro(
    'estoque_tiny_parado',
    'estoque_tiny:' || new.produto_tiny_id,
    'O estoque parou de ir para o Tiny',
    'Depois de 5 tentativas, o saldo de ' || coalesce(v_nome, 'um móvel') || ' não foi atualizado no Tiny: '
      || left(coalesce(new.ultimo_erro, 'erro sem descrição'), 300)
      || '. Em Configurações → Estoque dá para mandar de novo.',
    jsonb_build_object('origem', 'estoque_tiny', 'produto_tiny_id', new.produto_tiny_id,
                       'erro', left(coalesce(new.ultimo_erro, ''), 300)),
    interval '1 day');
  return null;
end;
$$;

drop trigger if exists plt_tiny_estoque_fila_parou on public.plt_tiny_estoque_fila;
create trigger plt_tiny_estoque_fila_parou
  after insert or update of parado_em on public.plt_tiny_estoque_fila
  for each row
  when (new.parado_em is not null)
  execute function plt_privado.fn_alertar_estoque_tiny_parado();

-- 4c · o aviso para uma integração que não foi entregue (o fato: a entrega falhou)
create or replace function plt_privado.fn_alertar_webhook_falhou()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nome text;
begin
  if tg_op = 'UPDATE' and old.situacao = 'falha' then
    return null;
  end if;
  select w.nome into v_nome from public.plt_webhooks w where w.id = new.webhook_id;
  perform plt_privado.fn_alertar_erro(
    'webhook_falhou',
    'webhook:' || new.webhook_id,
    'Um aviso para "' || left(coalesce(v_nome, 'uma integração'), 60) || '" não foi entregue',
    'Depois de ' || new.tentativas || ' tentativas, a plataforma não conseguiu avisar "'
      || coalesce(v_nome, 'uma integração') || '": ' || left(coalesce(new.ultimo_erro, 'erro sem descrição'), 300)
      || '. Confira em Configurações → API e integrações.',
    jsonb_build_object('origem', 'webhook', 'webhook_id', new.webhook_id, 'entrega_id', new.id,
                       'erro', left(coalesce(new.ultimo_erro, ''), 300)),
    interval '1 hour');
  return null;
end;
$$;

drop trigger if exists plt_webhook_entregas_falhou on public.plt_webhook_entregas;
create trigger plt_webhook_entregas_falhou
  after insert or update of situacao on public.plt_webhook_entregas
  for each row
  when (new.situacao = 'falha')
  execute function plt_privado.fn_alertar_webhook_falhou();

-- ----------------------------------------------------------------------------
-- 4d · "O Tiny não aceitou a situação do pedido" — para os administradores
--      (recriada POR INTEIRO a partir da 20261008150000 — só o laço mudou; o
--      corpo de origem conferido contra o banco vivo, 28/10)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tiny_pedido_resultado(
  p_pedido_id bigint,
  p_versao    integer,
  p_ok        boolean,
  p_erro      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_f     public.plt_tiny_pedido_fila%rowtype;
  v_admin uuid;
begin
  select * into v_f from public.plt_tiny_pedido_fila where pedido_id = p_pedido_id for update;
  if not found then
    return jsonb_build_object('acao', 'nada', 'motivo', 'fora_da_fila');
  end if;
  if coalesce(p_versao, 0) < v_f.versao then
    return jsonb_build_object('acao', 'nada', 'motivo', 'versao_antiga');
  end if;
  if coalesce(p_ok, false) then
    delete from public.plt_tiny_pedido_fila where pedido_id = p_pedido_id;
    update public.plt_setores set tiny_entrega_ok_em = now() where codigo = 'rotas';
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
      values (null, 'tiny_situacao_alterada',
              jsonb_build_object('pedido_id', v_f.pedido_id, 'numero', v_f.numero, 'situacao', v_f.situacao,
                                 'motivo', v_f.motivo, 'tentativas', v_f.tentativas + 1));
    if not exists (select 1 from public.plt_tiny_pedido_fila f where f.parado_em is null) then
      perform plt_privado.fn_tiny_pedido_agendar(false);
    end if;
    return jsonb_build_object('acao', 'ok', 'numero', v_f.numero);
  end if;

  if v_f.tentativas + 1 >= 8 then
    update public.plt_tiny_pedido_fila
       set tentativas = tentativas + 1, ultimo_erro = left(coalesce(p_erro, 'erro sem descrição'), 500),
           parado_em = now(), atualizado_em = now()
     where pedido_id = p_pedido_id;
    -- D-202: para os administradores — o filtro dos avisos deixa quem quer (erro: ligado por padrão só para o super admin)
    for v_admin in select u.id from public.plt_usuarios u where u.ativo and u.papel = 'admin' and not u.conta_tablet loop
      insert into public.plt_notificacoes (destinatario_id, card_id, tipo, titulo, corpo)
        values (v_admin, (select c.id from public.plt_cards c where c.pedido_id = v_f.pedido_id and c.tipo = 'pedido'),
                'tiny_pedido_parado',
                'O Tiny não aceitou a situação do pedido ' || v_f.numero,
                'Depois de 8 tentativas o pedido ' || v_f.numero || ' não ficou "' || v_f.situacao
                  || '" no Tiny. Último erro: ' || left(coalesce(p_erro, 'sem descrição'), 200));
    end loop;
    return jsonb_build_object('acao', 'parado', 'numero', v_f.numero);
  end if;
  update public.plt_tiny_pedido_fila
     set tentativas = tentativas + 1, ultimo_erro = left(coalesce(p_erro, 'erro sem descrição'), 500),
         proxima_em = now() + least(power(2, v_f.tentativas) * interval '1 minute', interval '60 minutes')
                                * (0.75 + random() * 0.5),
         atualizado_em = now()
   where pedido_id = p_pedido_id;
  perform plt_privado.fn_tiny_pedido_agendar(true);
  return jsonb_build_object('acao', 'nova_tentativa', 'numero', v_f.numero, 'tentativas', v_f.tentativas + 1);
end;
$$;

-- ----------------------------------------------------------------------------
-- 5 · Troca de senha: quem pede não recebe o próprio aviso, não vê o próprio
--     pedido e não decide o próprio pedido (recriadas a partir da 20261028010000
--     e da 20261027020000 — só o que está marcado com D-202 mudou)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_senha_solicitar(p_email text, p_segredo_hash text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pessoa public.plt_usuarios%rowtype;
  v_id     bigint;
  v_admin  record;
  v_email  text;
  v_corpo  text;
begin
  if coalesce(length(p_segredo_hash), 0) < 40 then
    raise exception 'Pedido sem o segredo do aparelho.' using errcode = 'check_violation';
  end if;
  select * into v_pessoa from public.plt_usuarios where id = plt_privado.fn_senha_pessoa(p_email);
  if v_pessoa.id is null then
    -- D-200: e-mail sem cadastro ativo — a tela de quem pediu diz a mesma coisa
    -- de sempre (D-191); os administradores ficam sabendo, para conferir com a
    -- pessoa se ela digitou certo. O mesmo e-mail ainda não lido não repete.
    v_email := left(lower(trim(coalesce(p_email, ''))), 254);
    if v_email = '' then
      return;
    end if;
    v_corpo := 'Alguém pediu a troca de senha com o e-mail ' || v_email
               || ', que não tem cadastro ativo na plataforma. Se for alguém da equipe, '
               || 'confira com a pessoa se o e-mail foi digitado certo.';
    for v_admin in
      select u.id from public.plt_usuarios u
       where u.papel = 'admin' and u.ativo and u.arquivado_em is null and not u.conta_tablet
    loop
      if not exists (select 1 from public.plt_notificacoes n
                      where n.destinatario_id = v_admin.id and n.lida_em is null
                        and n.tipo = 'senha_sem_cadastro' and n.corpo = v_corpo) then
        insert into public.plt_notificacoes (destinatario_id, tipo, titulo, corpo)
          values (v_admin.id, 'senha_sem_cadastro', 'Troca de senha: e-mail sem cadastro', v_corpo);
      end if;
    end loop;
    return;
  end if;

  -- pedir de novo SUBSTITUI o que estava aberto — inclusive o já liberado: um
  -- aparelho novo nunca herda a liberação de outro (precisa de outra decisão)
  update public.plt_senha_pedidos
     set situacao = 'substituido'
   where usuario_id = v_pessoa.id and situacao in ('pendente', 'liberado');

  insert into public.plt_senha_pedidos (usuario_id, segredo_hash)
    values (v_pessoa.id, p_segredo_hash)
    returning id into v_id;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_pessoa.id, 'senha_pedido', jsonb_build_object('pedido_id', v_id));

  -- o aviso urgente a cada administrador (o sino e o aviso na tela) — D-202:
  -- menos a própria pessoa, quando quem pede é administrador
  for v_admin in
    select u.id from public.plt_usuarios u
     where u.papel = 'admin' and u.ativo and u.arquivado_em is null and not u.conta_tablet
       and u.id <> v_pessoa.id
  loop
    insert into public.plt_notificacoes (destinatario_id, tipo, titulo, corpo)
      values (v_admin.id, 'senha_pedido', 'Pedido urgente: troca de senha',
              v_pessoa.nome || ' (' || coalesce(v_pessoa.usuario, v_pessoa.email) || ') pediu para trocar a senha. '
              || 'Libere só se tiver certeza de que foi a própria pessoa — confirme com ela.');
  end loop;
end;
$$;

comment on function public.plt_fn_senha_solicitar(text, text) is
  'SESSAO-41 (D-191) · SÓ a função de login (chave de serviço): registra o pedido de troca de senha (e-mail cadastrado, ativo, não tablet), substitui o aberto e avisa os administradores. ↪️ D-200 (28/10): e-mail sem cadastro ativo avisa os administradores no sino ("confira com a pessoa"), sem repetir o mesmo e-mail ainda não lido — a tela de quem pediu não muda. ↪️ D-202: o administrador que pede não recebe o próprio aviso.';

create or replace function public.plt_fn_senha_pedidos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
begin
  if not plt_privado.fn_eh_admin() then
    raise exception 'Só um administrador decide a troca de senha.' using errcode = 'insufficient_privilege';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'situacao', p.situacao, 'pedido_em', p.pedido_em,
             'liberado_ate', p.liberado_ate, 'decidido_em', p.decidido_em,
             'decidido_por', d.nome,
             'pessoa', jsonb_build_object('id', u.id, 'nome', u.nome, 'usuario', u.usuario,
                                          'foto', u.foto_caminho, 'papel', u.papel))
           order by (p.situacao = 'pendente') desc, p.pedido_em desc)
      from (select * from public.plt_senha_pedidos s
             where ((s.situacao = 'pendente' and s.pedido_em > now() - interval '24 hours')
                or (s.situacao in ('liberado', 'recusado', 'usado') and s.decidido_em > now() - interval '24 hours'))
               -- D-202: o próprio pedido não aparece para quem pediu (outro administrador decide)
               and s.usuario_id is distinct from v_eu
             order by s.pedido_em desc
             limit 20) p
      join public.plt_usuarios u on u.id = p.usuario_id
      left join public.plt_usuarios d on d.id = p.decidido_por), '[]'::jsonb);
end;
$$;

comment on function public.plt_fn_senha_pedidos() is
  'SESSAO-41 (D-191): para os administradores — os pedidos de troca de senha pendentes (até 24 h) e os decididos nas últimas 24 h (até 20), o pendente primeiro. ↪️ D-202: sem o pedido de quem está olhando.';

create or replace function public.plt_fn_senha_decidir(p_pedido_id bigint, p_liberar boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_pedido public.plt_senha_pedidos%rowtype;
  v_admins uuid[];
  v_admin  uuid;
  v_sem_pendentes boolean;
begin
  if v_eu is null or not plt_privado.fn_eh_admin() then
    raise exception 'Só um administrador decide a troca de senha.' using errcode = 'insufficient_privilege';
  end if;
  if p_liberar is null then
    raise exception 'Diga se libera ou não.' using errcode = 'check_violation';
  end if;
  select * into v_pedido from public.plt_senha_pedidos where id = p_pedido_id for update;
  if v_pedido.id is null then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  -- D-202: ninguém libera a própria troca — outro administrador decide
  if v_pedido.usuario_id = v_eu then
    raise exception 'O seu próprio pedido de troca de senha é decidido por outro administrador.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_pedido.situacao <> 'pendente' or v_pedido.pedido_em <= now() - interval '24 hours' then
    -- o toque repetido (ou outro admin que decidiu antes) não muda nada
    return jsonb_build_object('situacao', v_pedido.situacao, 'liberado_ate', v_pedido.liberado_ate, 'mudou', false);
  end if;

  update public.plt_senha_pedidos
     set situacao = case when p_liberar then 'liberado' else 'recusado' end,
         decidido_por = v_eu, decidido_em = now(),
         liberado_ate = case when p_liberar then now() + interval '2 hours' end
   where id = p_pedido_id
   returning * into v_pedido;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_eu, case when p_liberar then 'senha_pedido_liberado' else 'senha_pedido_recusado' end,
            jsonb_build_object('pedido_id', p_pedido_id, 'pessoa_id', v_pedido.usuario_id));

  select coalesce(array_agg(u.id), '{}') into v_admins
    from public.plt_usuarios u
   where u.papel = 'admin' and u.ativo and u.arquivado_em is null and not u.conta_tablet;

  -- sem pedido pendente, o aviso urgente sai de todos os administradores
  -- (D-200: pela caixa de cada um — o índice dos não lidos)
  v_sem_pendentes := not exists (select 1 from public.plt_senha_pedidos
                                  where situacao = 'pendente' and pedido_em > now() - interval '24 hours');
  if v_sem_pendentes then
    update public.plt_notificacoes set lida_em = now()
     where destinatario_id = any (v_admins) and lida_em is null and tipo = 'senha_pedido';
  end if;

  -- D-200: as outras telas abertas ficam sabendo na hora (o aviso some, a lista relê)
  foreach v_admin in array v_admins loop
    perform plt_privado.fn_chat_sinal(v_admin, 'senha_decidida',
      jsonb_build_object('pedido_id', p_pedido_id, 'situacao', v_pedido.situacao,
                         'sem_pendentes', v_sem_pendentes, 'lida_em', now()));
  end loop;

  return jsonb_build_object('situacao', v_pedido.situacao, 'liberado_ate', v_pedido.liberado_ate, 'mudou', true);
end;
$$;

comment on function public.plt_fn_senha_decidir(bigint, boolean) is
  'SESSAO-41 (D-191): o administrador libera (por 2 h, uma troca, só no aparelho que pediu) ou não libera o pedido pendente; repetir não muda nada; sem pendentes, o aviso urgente sai de todos os administradores. Fica na trilha. ↪️ D-200: o sinal senha_decidida no canal de cada administrador. ↪️ D-202: ninguém decide o próprio pedido.';

-- ----------------------------------------------------------------------------
-- 6 · As portas da tela
-- ----------------------------------------------------------------------------
-- Lei §7.2: o destinatário (chave estrangeira e filtro de toda leitura do sino)
-- só tinha o índice dos NÃO lidos — a conta dos 30 dias (e o sino, que lê os
-- lidos também) varreria a tabela quando ela crescer.
create index if not exists plt_notificacoes_destinatario_idx
  on public.plt_notificacoes (destinatario_id, criada_em desc);

-- A tela inteira numa requisição: de quem (eu, ou — para o administrador —
-- qualquer pessoa ativa), os avisos que ela pode receber com o que está ligado,
-- quantos chegaram nos últimos 30 dias, e a lista das pessoas para o administrador.
create or replace function public.plt_fn_avisos(p_usuario_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_admin  boolean := plt_privado.fn_eh_admin();
  v_alvo   public.plt_usuarios%rowtype;
begin
  if v_eu is null then
    raise exception 'Entre na plataforma para escolher os avisos.' using errcode = 'insufficient_privilege';
  end if;
  if p_usuario_id is not null and p_usuario_id <> v_eu and not v_admin then
    raise exception 'Só um administrador escolhe os avisos de outra pessoa.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_alvo from public.plt_usuarios
   where id = coalesce(p_usuario_id, v_eu) and ativo and arquivado_em is null and not conta_tablet;
  if v_alvo.id is null then
    raise exception 'Pessoa não encontrada (ou desativada).' using errcode = 'no_data_found';
  end if;

  return jsonb_build_object(
    'pessoa', jsonb_build_object('id', v_alvo.id, 'nome', v_alvo.nome, 'papel', v_alvo.papel,
                                 'super_admin', coalesce(v_alvo.super_admin, false)),
    'avisos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tipo', c.tipo, 'grupo', c.grupo, 'grupo_nome', c.grupo_nome, 'nome', c.nome,
               'descricao', c.descricao, 'obrigatorio', c.obrigatorio, 'erro', c.erro,
               'padrao', case when c.erro then coalesce(v_alvo.super_admin, false) else true end,
               'ligado', plt_privado.fn_aviso_ligado(c.tipo, v_alvo.id),
               'recebidos_30d', coalesce(q.n, 0))
             order by c.ordem)
        from plt_privado.fn_avisos_catalogo() c
        left join (select n.tipo, count(*)::int as n
                     from public.plt_notificacoes n
                    where n.destinatario_id = v_alvo.id and n.criada_em > now() - interval '30 days'
                    group by n.tipo) q on q.tipo = c.tipo
       where plt_privado.fn_aviso_publico_de(c.publico, v_alvo.id)), '[]'::jsonb),
    'pessoas', case when v_admin then coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome, 'papel', u.papel) order by u.nome)
        from public.plt_usuarios u
       where u.ativo and u.arquivado_em is null and not u.conta_tablet), '[]'::jsonb) end);
end;
$$;

comment on function public.plt_fn_avisos(uuid) is
  'D-202 (28/10): a tela Configurações → Avisos numa requisição — os avisos que a pessoa pode receber (do catálogo, pelo público), ligado/desligado, o padrão, obrigatório, quantos chegaram em 30 dias e, para o administrador, as pessoas ativas. p_usuario_id nulo = eu; outra pessoa só para o administrador.';

-- O toque: liga ou desliga um aviso de uma pessoa (a própria; o administrador, de qualquer uma).
create or replace function public.plt_fn_aviso_definir(p_tipo text, p_ligado boolean, p_usuario_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu      uuid := plt_privado.fn_usuario_atual();
  v_alvo    public.plt_usuarios%rowtype;
  v_cat     record;
  v_padrao  boolean;
  v_avisos  jsonb;
begin
  if v_eu is null then
    raise exception 'Entre na plataforma para escolher os avisos.' using errcode = 'insufficient_privilege';
  end if;
  if p_usuario_id is not null and p_usuario_id <> v_eu and not plt_privado.fn_eh_admin() then
    raise exception 'Só um administrador escolhe os avisos de outra pessoa.' using errcode = 'insufficient_privilege';
  end if;
  if p_ligado is null then
    raise exception 'Diga se liga ou desliga.' using errcode = 'check_violation';
  end if;
  select * into v_cat from plt_privado.fn_avisos_catalogo() c where c.tipo = p_tipo;
  if v_cat.tipo is null then
    raise exception 'Aviso desconhecido.' using errcode = 'check_violation';
  end if;
  if v_cat.obrigatorio and not p_ligado then
    raise exception 'Este aviso é urgente e fica sempre ligado.' using errcode = 'check_violation';
  end if;

  select * into v_alvo from public.plt_usuarios
   where id = coalesce(p_usuario_id, v_eu) and ativo and arquivado_em is null and not conta_tablet
   for update;
  if v_alvo.id is null then
    raise exception 'Pessoa não encontrada (ou desativada).' using errcode = 'no_data_found';
  end if;
  if not plt_privado.fn_aviso_publico_de(v_cat.publico, v_alvo.id) then
    raise exception 'Este aviso não chega para esta pessoa.' using errcode = 'check_violation';
  end if;

  -- igual ao padrão = some da escolha (a pessoa volta a seguir o padrão)
  v_padrao := case when v_cat.erro then coalesce(v_alvo.super_admin, false) else true end;
  v_avisos := coalesce(v_alvo.avisos, '{}'::jsonb) - p_tipo;
  if p_ligado is distinct from v_padrao then
    v_avisos := v_avisos || jsonb_build_object(p_tipo, p_ligado);
  end if;
  update public.plt_usuarios
     set avisos = nullif(v_avisos, '{}'::jsonb)
   where id = v_alvo.id and avisos is distinct from nullif(v_avisos, '{}'::jsonb);

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_eu, 'aviso_escolhido',
            jsonb_build_object('tipo', p_tipo, 'ligado', p_ligado, 'alvo_id', v_alvo.id));

  return jsonb_build_object('tipo', p_tipo, 'ligado', p_ligado);
end;
$$;

comment on function public.plt_fn_aviso_definir(text, boolean, uuid) is
  'D-202 (28/10): liga/desliga um aviso — o próprio; o administrador, de qualquer pessoa ativa. O urgente não desliga; o aviso que não chega para a pessoa é recusado; igual ao padrão sai da escolha. Fica na trilha (aviso_escolhido).';

-- ----------------------------------------------------------------------------
-- Permissões: a maquinaria fora da API; as duas portas para quem tem login
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_avisos_catalogo()                   from public, anon, authenticated;
revoke all on function plt_privado.fn_aviso_publico_de(text, uuid)        from public, anon, authenticated;
revoke all on function plt_privado.fn_aviso_ligado(text, uuid)            from public, anon, authenticated;
revoke all on function plt_privado.fn_aviso_filtrar()                     from public, anon, authenticated;
revoke all on function plt_privado.fn_alertar_erro(text, text, text, text, jsonb, interval, bigint) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_alertar(text, text, text, jsonb, interval) from public, anon, authenticated;
revoke all on function plt_privado.fn_alertar_automacao_falhou()          from public, anon, authenticated;
revoke all on function plt_privado.fn_alertar_estoque_tiny_parado()       from public, anon, authenticated;
revoke all on function plt_privado.fn_alertar_webhook_falhou()            from public, anon, authenticated;
revoke all on function public.plt_fn_senha_solicitar(text, text)          from public, anon, authenticated;
grant execute on function public.plt_fn_senha_solicitar(text, text)       to service_role;
revoke all on function public.plt_fn_senha_pedidos()                      from public, anon;
grant execute on function public.plt_fn_senha_pedidos()                   to authenticated;
revoke all on function public.plt_fn_senha_decidir(bigint, boolean)       from public, anon;
grant execute on function public.plt_fn_senha_decidir(bigint, boolean)    to authenticated;
revoke all on function public.plt_fn_avisos(uuid)                         from public, anon;
grant execute on function public.plt_fn_avisos(uuid)                      to authenticated;
revoke all on function public.plt_fn_aviso_definir(text, boolean, uuid)   from public, anon;
grant execute on function public.plt_fn_aviso_definir(text, boolean, uuid) to authenticated;
