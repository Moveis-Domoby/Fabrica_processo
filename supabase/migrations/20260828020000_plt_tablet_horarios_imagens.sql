-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 16 — TABLET, HORÁRIOS E IMAGENS
-- Sessão: SESSAO-07 · Data: 2026-08-28 (bloco noturno D-26)
--
-- Quatro assuntos, todos da tela do setor e dos pedidos do dono (D-27/D-28/D-29):
--
--   1. VARREDURA D-27: mensagens de erro do banco chegam à tela — nenhuma pode
--      carregar código interno (D-NN/RF-NN/Q-NN). As funções são recriadas com
--      as MESMAS regras e mensagens em língua de gente; os códigos viram
--      comentário aqui no fonte.
--   2. GESTO POR PIN NO TABLET (D-06/D-28): a sessão é do DISPOSITIVO, o autor
--      é o OPERADOR identificado por PIN (conferido na Edge Function). As RPCs
--      de mover e parecer ganham `p_operador_id`; os INSERTs diretos de
--      iniciar/finalizar já aceitam o autor pelo desenho da SESSAO-02.
--   3. CONTROLE DE TEMPO DO ADMIN (D-29): horário de funcionamento por setor e
--      por usuário + pausas manuais (agora ou retroativas). NADA altera os
--      eventos registrados — o desconto acontece só no cálculo derivado
--      (fn_tempo_util), que as consultas de dashboard usam.
--   4. TEMPO REAL + IMAGENS (D-28): plt_cards entra na publicação realtime e
--      nasce o bucket `plt-imagens` (imagens por PRODUTO — a futura biblioteca
--      de peças), com leitura para autenticados e escrita de admin/líder.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1a · fn_gerar_matricula — mesma regra, mensagem sem código (era "— D-21")
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_gerar_matricula()
returns trigger
language plpgsql
security definer -- migration 12 (E-14): trigger roda com o privilégio de quem insere
set search_path = public, pg_temp
as $$
declare
  v_ordem bigint;
begin
  -- normaliza antes de validar: CPF só dígitos, usuário minúsculo, e-mail minúsculo
  new.cpf     := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');
  new.usuario := lower(trim(coalesce(new.usuario, '')));
  new.email   := lower(trim(coalesce(new.email, '')));

  if new.matricula is null then
    -- D-21: matrícula MDM-XXX-NNN depende do CPF.
    if new.cpf !~ '^[0-9]{11}$' then
      raise exception 'CPF é obrigatório (11 dígitos) para gerar a matrícula.';
    end if;
    v_ordem := nextval('plt_privado.matricula_seq');
    new.matricula := 'MDM-' || substr(new.cpf, 1, 3) || '-'
      || lpad(v_ordem::text, greatest(3, length(v_ordem::text)), '0');
  end if;

  return new;
end;
$$;

comment on function plt_privado.fn_gerar_matricula() is
  'Gera MDM-XXX-NNN no cadastro (D-21) e normaliza cpf/usuario/email. XXX = 3 primeiros dígitos do CPF; NNN = ordem de cadastro.';

-- ----------------------------------------------------------------------------
-- 1b · fn_validar_execucao — regras idênticas às da migration 14 (D-24),
--      mensagens sem código interno (D-27)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_execucao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card         public.plt_cards%rowtype;
  v_limite       integer;
  v_em_execucao  integer;
  v_alvo         public.plt_eventos%rowtype;
  v_ultimo_exec  bigint;
  v_papel        text;
  v_lider        boolean;
begin
  if new.tipo not in ('execucao_iniciada', 'execucao_finalizada', 'estorno') then
    return new;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;
  if not found then
    raise exception 'Card % não existe.', new.card_id using errcode = 'foreign_key_violation';
  end if;

  if new.usuario_id is null then
    -- D-02/D-24: execução é gesto de pessoa.
    raise exception 'Iniciar, finalizar e estornar são gestos de pessoa: é preciso dizer quem fez.'
      using errcode = 'check_violation';
  end if;

  -- Onde o gesto aconteceu: o setor/etapa ATUAL do card, se quem inseriu não disse.
  if new.tipo in ('execucao_iniciada', 'execucao_finalizada') then
    new.setor_origem_id := coalesce(new.setor_origem_id, v_card.setor_atual_id);
    new.etapa_origem_id := coalesce(new.etapa_origem_id, v_card.etapa_atual_id);
  end if;

  if new.tipo = 'execucao_iniciada' then
    if v_card.setor_atual_id is null then
      raise exception 'Este card ainda não está em nenhum setor — não há o que iniciar.'
        using errcode = 'check_violation';
    end if;
    if v_card.concluido_em is not null then
      -- D-13: fim de linha não executa.
      raise exception 'Card concluído (fim de linha) não entra em execução.'
        using errcode = 'check_violation';
    end if;
    if v_card.executor_atual_id = new.usuario_id then
      raise exception 'Esta pessoa já está executando este card.'
        using errcode = 'check_violation';
    end if;

    select s.limite_execucoes_por_pessoa into v_limite
      from public.plt_setores s where s.id = v_card.setor_atual_id;
    if v_limite is not null then
      select count(*) into v_em_execucao
        from public.plt_cards c
       where c.executor_atual_id = new.usuario_id
         and c.setor_atual_id = v_card.setor_atual_id
         and c.id <> new.card_id;
      if v_em_execucao >= v_limite then
        -- D-24: limite configurável por setor.
        raise exception 'Limite do setor atingido: esta pessoa já tem % card(s) em execução aqui (máximo %).',
          v_em_execucao, v_limite
          using errcode = 'check_violation';
      end if;
    end if;

  elsif new.tipo = 'execucao_finalizada' then
    if v_card.executor_atual_id is null then
      -- D-24: finalizar sem iniciar não existe.
      raise exception 'Iniciar é obrigatório antes de finalizar — este card não está em execução.'
        using errcode = 'check_violation';
    end if;

  elsif new.tipo = 'estorno' then
    if new.evento_referencia_id is null then
      raise exception 'Estorno precisa apontar o evento estornado (evento_referencia_id).'
        using errcode = 'check_violation';
    end if;

    select * into v_alvo from public.plt_eventos where id = new.evento_referencia_id;
    if not found or v_alvo.card_id <> new.card_id then
      raise exception 'O evento estornado precisa existir e ser do mesmo card.'
        using errcode = 'check_violation';
    end if;
    if v_alvo.tipo not in ('execucao_iniciada', 'execucao_finalizada') then
      raise exception 'Só gestos de execução (iniciar/finalizar) podem ser estornados. Movimentação errada se corrige movendo de novo.'
        using errcode = 'check_violation';
    end if;
    if plt_privado.fn_evento_estornado(v_alvo.id) then
      raise exception 'Este evento já foi estornado.'
        using errcode = 'check_violation';
    end if;

    -- Só o ÚLTIMO gesto de execução válido é estornável (corrigir é desfazer
    -- do mais novo para o mais velho — mantém a história sempre coerente).
    select e.id into v_ultimo_exec
      from public.plt_eventos e
     where e.card_id = new.card_id
       and e.tipo in ('execucao_iniciada', 'execucao_finalizada')
       and not plt_privado.fn_evento_estornado(e.id)
     order by e.ocorrido_em desc, e.id desc
     limit 1;
    if v_ultimo_exec is distinct from v_alvo.id then
      raise exception 'Só o último gesto de execução do card pode ser estornado — desfaça do mais recente para trás.'
        using errcode = 'check_violation';
    end if;

    -- Quem pode: admin (qualquer setor) ou líder do setor ATUAL do card (D-24).
    select u.papel into v_papel from public.plt_usuarios u
     where u.id = new.usuario_id and u.ativo;
    if v_papel is null then
      raise exception 'Estorno exige um usuário ativo da plataforma.'
        using errcode = 'check_violation';
    end if;
    select coalesce(bool_or(us.lider_do_setor), false) into v_lider
      from public.plt_usuario_setores us
     where us.usuario_id = new.usuario_id
       and us.setor_id = v_card.setor_atual_id;
    if v_papel <> 'admin' and not v_lider then
      -- SESSAO-05/D-24: gate de estorno.
      raise exception 'Estorno é gesto de líder do setor ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

comment on function plt_privado.fn_validar_execucao() is
  'Regras da D-24 valendo para todo escritor (a service_role ignora RLS — M-14): iniciar obrigatório, limite por setor, estorno só líder/admin e só do último gesto.';

-- ----------------------------------------------------------------------------
-- 1c · fn_validar_qualidade — regras idênticas às da migration 15 (D-09/D-25),
--      mensagens sem código interno (D-27)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_qualidade()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card     public.plt_cards%rowtype;
  v_marc     public.plt_eventos%rowtype;
  v_chegada  public.plt_eventos%rowtype;
  v_papel_origem text;
  v_setor_nome   text;
begin
  if new.tipo not in
     ('movimentacao_setor', 'qualidade_marcada', 'qualidade_parecer', 'execucao_iniciada') then
    return new;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;

  -- ---------- Marcação de quem entrega ----------
  if new.tipo = 'qualidade_marcada' then
    if new.usuario_id is null then
      -- D-09/Q-19: atestação é gesto exclusivamente humano.
      raise exception 'A atestação de qualidade é gesto de pessoa — é preciso dizer quem marcou.'
        using errcode = 'check_violation';
    end if;
    if new.setor_origem_id is null or new.setor_destino_id is null then
      raise exception 'A marcação de qualidade pertence a uma transição: setor de origem e de destino são obrigatórios.'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- ---------- Mover entre setores: a marcação é obrigatória (D-09) ----------
  if new.tipo = 'movimentacao_setor' then
    -- API/automação movem sem estado (RF-86/D-25); gesto sem pessoa idem.
    if new.origem <> 'interface' or new.usuario_id is null then
      return new;
    end if;

    select s.papel_no_fluxo into v_papel_origem
      from public.plt_setores s where s.id = new.setor_origem_id;

    -- Só a saída de setor de PRODUÇÃO exige marcação: no PCP a peça ainda nem
    -- foi produzida (D-25) e no terminal ela já foi entregue ao fim de linha.
    if coalesce(v_papel_origem, '') <> 'producao' then
      return new;
    end if;

    if new.evento_referencia_id is null then
      -- D-09: marcação obrigatória ao sair de produção.
      raise exception 'Mover para outro setor exige marcar o estado da peça: 🟢 perfeito estado · 🟡 estado de atenção · 🔴 danificado.'
        using errcode = 'check_violation';
    end if;

    select * into v_marc from public.plt_eventos where id = new.evento_referencia_id;
    if not found or v_marc.tipo <> 'qualidade_marcada' or v_marc.card_id <> new.card_id then
      raise exception 'A movimentação precisa apontar uma marcação de qualidade deste mesmo card.'
        using errcode = 'check_violation';
    end if;
    if v_marc.setor_origem_id is distinct from new.setor_origem_id
       or v_marc.setor_destino_id is distinct from new.setor_destino_id then
      raise exception 'A marcação de qualidade é desta transição: origem e destino precisam bater com a movimentação.'
        using errcode = 'check_violation';
    end if;
    if v_marc.usuario_id is distinct from new.usuario_id then
      -- D-09: quem entrega marca.
      raise exception 'Quem entrega marca: a marcação precisa ser de quem está movendo o card.'
        using errcode = 'check_violation';
    end if;
    if exists (
      select 1 from public.plt_eventos m
       where m.tipo = 'movimentacao_setor' and m.evento_referencia_id = v_marc.id
    ) then
      raise exception 'Esta marcação de qualidade já foi usada em outra movimentação — marque de novo.'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- ---------- Parecer de quem recebe ----------
  if new.tipo = 'qualidade_parecer' then
    if new.usuario_id is null then
      -- D-09/Q-19: parecer é gesto humano.
      raise exception 'O parecer de recebimento é gesto de pessoa — é preciso dizer quem confirmou.'
        using errcode = 'check_violation';
    end if;
    if new.evento_referencia_id is null then
      raise exception 'O parecer precisa apontar a marcação de quem entregou (evento_referencia_id).'
        using errcode = 'check_violation';
    end if;

    select * into v_marc from public.plt_eventos where id = new.evento_referencia_id;
    if not found or v_marc.tipo <> 'qualidade_marcada' or v_marc.card_id <> new.card_id then
      raise exception 'O parecer precisa responder a uma marcação de qualidade deste mesmo card.'
        using errcode = 'check_violation';
    end if;
    if exists (
      select 1 from public.plt_eventos p
       where p.tipo = 'qualidade_parecer' and p.evento_referencia_id = v_marc.id
    ) then
      raise exception 'Esta chegada já teve o recebimento confirmado — o parecer se registra uma vez só.'
        using errcode = 'check_violation';
    end if;

    -- O parecer responde à CHEGADA ATUAL: se o card já se moveu de novo, a
    -- marcação antiga fica como registro unilateral (não trava nada — D-09).
    select * into v_chegada
      from public.plt_eventos e
     where e.card_id = new.card_id and e.tipo = 'movimentacao_setor'
     order by e.ocorrido_em desc, e.id desc
     limit 1;
    if not found or v_chegada.evento_referencia_id is distinct from v_marc.id then
      raise exception 'Este card já seguiu adiante — o parecer responde só à chegada atual.'
        using errcode = 'check_violation';
    end if;

    -- O trigger preenche a transição a partir da marcação (a view calcula a
    -- divergência por este vínculo; nada de confiar no que o cliente mandou).
    new.setor_origem_id := v_marc.setor_origem_id;
    new.setor_destino_id := v_marc.setor_destino_id;
    return new;
  end if;

  -- ---------- Iniciar: o recebimento vem antes (D-09 item 2) ----------
  if new.tipo = 'execucao_iniciada' then
    select * into v_chegada
      from public.plt_eventos e
     where e.card_id = new.card_id and e.tipo = 'movimentacao_setor'
     order by e.ocorrido_em desc, e.id desc
     limit 1;

    if found and v_chegada.evento_referencia_id is not null
       and not exists (
         select 1 from public.plt_eventos p
          where p.tipo = 'qualidade_parecer'
            and p.evento_referencia_id = v_chegada.evento_referencia_id
       ) then
      select v.nome, v.estado into v_setor_nome, v_papel_origem
        from (
          select s.nome, m.estado_qualidade as estado
            from public.plt_eventos m
            left join public.plt_setores s on s.id = m.setor_origem_id
           where m.id = v_chegada.evento_referencia_id
        ) v;
      -- D-09 item 2: o parecer vem antes do Iniciar.
      raise exception 'Antes de iniciar, confirme o recebimento: o setor % marcou a peça como % — registre seu parecer.',
        coalesce(v_setor_nome, 'anterior'), plt_privado.fn_rotulo_estado(v_papel_origem)
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  return new;
end;
$$;

comment on function plt_privado.fn_validar_qualidade() is
  'Regras da D-09/D-25 valendo para todo escritor (M-14): marcação obrigatória ao sair de produção pela interface, parecer da chegada atual uma vez só, iniciar só depois do parecer.';

-- ----------------------------------------------------------------------------
-- 1d · fn_reagir_qualidade — idêntica à migration 15; muda só a observação do
--      movimento automático para DANIFICADO (aparecia "(D-09)" na linha do tempo)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_reagir_qualidade()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card        public.plt_cards%rowtype;
  v_marc        public.plt_eventos%rowtype;
  v_setor_origem  text;
  v_setor_destino text;
  v_autor         text;
  v_autor_marc    text;
  v_pedido_numero integer;
  v_peca          text;
  v_etapa_danificado bigint;
  v_tipo_aviso    text;
  v_titulo        text;
  v_corpo         text;
  v_destinatarios uuid[];
  v_destinatario  uuid;
  v_divergente    boolean;
begin
  if new.tipo not in ('qualidade_marcada', 'qualidade_parecer', 'movimentacao_setor') then
    return null;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;
  select p.numero into v_pedido_numero from public.pedidos p where p.id = v_card.pedido_id;
  v_peca := coalesce(v_card.item_descricao, 'Peça')
            || case when v_card.indice_unidade is not null
                    then format(' (%s/%s)', v_card.indice_unidade, v_card.total_unidades)
                    else '' end
            || coalesce(' · Pedido ' || v_pedido_numero, '');

  select s.nome into v_setor_origem  from public.plt_setores s where s.id = new.setor_origem_id;
  select s.nome into v_setor_destino from public.plt_setores s where s.id = new.setor_destino_id;
  select u.nome into v_autor from public.plt_usuarios u where u.id = new.usuario_id;

  -- ---------- Chegada em ESTOQUE avisa os admins (D-25) ----------
  if new.tipo = 'movimentacao_setor' then
    if exists (select 1 from public.plt_setores s
                where s.id = new.setor_destino_id and s.codigo = 'estoque') then
      v_tipo_aviso := 'chegada_estoque';
      v_titulo := 'Peça chegou ao ESTOQUE';
      v_corpo  := v_peca || ' chegou ao ESTOQUE'
                  || coalesce(' vinda de ' || v_setor_origem, '')
                  || coalesce(' por ' || v_autor, '')
                  || case when v_card.qualidade_atual is not null
                          then ', marcada como ' || plt_privado.fn_rotulo_estado(v_card.qualidade_atual)
                          else '' end
                  || '.';
      select coalesce(array_agg(distinct u.id), '{}') into v_destinatarios
        from public.plt_usuarios u
       where u.ativo and u.papel = 'admin'
         and u.id is distinct from new.usuario_id;
    else
      return null;
    end if;

  -- ---------- Marcação 🟡/🔴 de quem entrega (Q-18) ----------
  elsif new.tipo = 'qualidade_marcada' then
    if new.estado_qualidade not in ('atencao', 'danificado') then
      return null;
    end if;
    v_tipo_aviso := 'qualidade_' || new.estado_qualidade;
    v_titulo := 'Peça marcada como ' || plt_privado.fn_rotulo_estado(new.estado_qualidade);
    v_corpo  := coalesce(v_autor, 'Alguém') || coalesce(' (' || v_setor_origem || ')', '')
                || ' marcou a peça como ' || plt_privado.fn_rotulo_estado(new.estado_qualidade)
                || coalesce(' ao mover para ' || v_setor_destino, '')
                || '. ' || v_peca || '.';

  -- ---------- Parecer: divergência ou 🔴 confirmado (Q-18 / RF-83) ----------
  else
    select * into v_marc from public.plt_eventos where id = new.evento_referencia_id;
    v_divergente := v_marc.estado_qualidade is distinct from new.estado_qualidade;

    -- 🔴 registrado pelo recebedor (confirmado OU divergente para 🔴):
    -- o card vai para a etapa DANIFICADO do setor onde está (D-09 item 4).
    if new.estado_qualidade = 'danificado' and v_card.setor_atual_id is not null then
      v_etapa_danificado := plt_privado.fn_garantir_etapa_danificado(v_card.setor_atual_id);
      if v_card.etapa_atual_id is distinct from v_etapa_danificado then
        insert into public.plt_eventos
            (card_id, tipo, usuario_id, origem,
             setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id,
             observacao)
          values
            (new.card_id, 'movimentacao_etapa', new.usuario_id, 'automacao',
             v_card.setor_atual_id, v_card.etapa_atual_id,
             v_card.setor_atual_id, v_etapa_danificado,
             'Consequência automática do parecer 🔴 danificado.');
      end if;
    end if;

    if not v_divergente and new.estado_qualidade <> 'danificado' then
      -- Concordância em 🟢/🟡 não gera aviso novo: o 🟡 já avisou na marcação.
      return null;
    end if;

    select u.nome into v_autor_marc from public.plt_usuarios u where u.id = v_marc.usuario_id;
    if v_divergente then
      v_tipo_aviso := 'qualidade_divergencia';
      v_titulo := 'Divergência de qualidade entre ' || coalesce(v_setor_origem, 'setores')
                  || ' e ' || coalesce(v_setor_destino, '');
      v_corpo  := coalesce(v_autor_marc, 'Quem entregou') || coalesce(' (' || v_setor_origem || ')', '')
                  || ' marcou ' || plt_privado.fn_rotulo_estado(v_marc.estado_qualidade)
                  || '; ' || coalesce(v_autor, 'quem recebeu') || coalesce(' (' || v_setor_destino || ')', '')
                  || ' registrou ' || plt_privado.fn_rotulo_estado(new.estado_qualidade)
                  || '. ' || v_peca || '.'
                  || case when new.estado_qualidade = 'danificado'
                          then ' O card foi para a etapa DANIFICADO.' else '' end;
    else
      v_tipo_aviso := 'qualidade_danificado';
      v_titulo := 'Dano confirmado no recebimento';
      v_corpo  := coalesce(v_autor, 'Quem recebeu') || coalesce(' (' || v_setor_destino || ')', '')
                  || ' confirmou ' || plt_privado.fn_rotulo_estado('danificado')
                  || coalesce(' na entrega de ' || v_setor_origem, '')
                  || '. ' || v_peca || '. O card foi para a etapa DANIFICADO.';
    end if;
  end if;

  -- ---------- Destinatários: líderes dos DOIS setores + admins (D-25) ----------
  if v_destinatarios is null then
    select coalesce(array_agg(distinct pessoa), '{}') into v_destinatarios
      from (
        select u.id as pessoa
          from public.plt_usuarios u
         where u.ativo and u.papel = 'admin'
        union
        select us.usuario_id
          from public.plt_usuario_setores us
          join public.plt_usuarios u on u.id = us.usuario_id and u.ativo
         where us.lider_do_setor
           and us.setor_id in (new.setor_origem_id, new.setor_destino_id)
      ) todos
     where pessoa is distinct from new.usuario_id;
  end if;

  if array_length(v_destinatarios, 1) is null then
    return null;
  end if;

  foreach v_destinatario in array v_destinatarios loop
    insert into public.plt_notificacoes
        (destinatario_id, evento_id, card_id, tipo, titulo, corpo)
      values
        (v_destinatario, new.id, new.card_id, v_tipo_aviso, v_titulo, v_corpo);
  end loop;

  -- O FATO de o aviso ter saído também é história do card.
  insert into public.plt_eventos
      (card_id, tipo, origem, evento_referencia_id,
       setor_origem_id, setor_destino_id, observacao, dados)
    values
      (new.card_id, 'notificacao_enviada', 'automacao', new.id,
       new.setor_origem_id, new.setor_destino_id, v_titulo,
       jsonb_build_object('tipo', v_tipo_aviso, 'destinatarios', to_jsonb(v_destinatarios)));

  return null;
end;
$$;

comment on function plt_privado.fn_reagir_qualidade() is
  'Consequências automáticas da qualidade (M-01/D-25): parecer 🔴 leva o card à etapa DANIFICADO; 🟡/🔴/divergência notificam líderes dos dois setores + admins; chegada em ESTOQUE avisa os admins.';

-- ----------------------------------------------------------------------------
-- 2 · RPCs de mover e parecer ganham `p_operador_id` (gesto por PIN — D-06/D-28)
--
-- No tablet compartilhado, a sessão autenticada é a conta do DISPOSITIVO; quem
-- age é o OPERADOR identificado por PIN na Edge Function `pin-verificar`.
-- Adicionar parâmetro com default criaria uma SOBRECARGA, não uma substituição
-- — por isso o drop da assinatura antiga antes do create.
--
-- Confiança do p_operador_id: o mesmo nível do INSERT direto de eventos, que a
-- RLS da SESSAO-02 já permite com qualquer usuario_id para quem trabalha no
-- setor. O gate adicional exige que o operador informado seja gente ativa e
-- trabalhe no setor envolvido (ou seja admin).
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_mover_card(bigint, bigint, bigint, text, text);

create or replace function public.plt_fn_mover_card(
  p_card_id           bigint,
  p_setor_destino_id  bigint,
  p_etapa_destino_id  bigint default null,
  p_estado_qualidade  text default null,
  p_observacao        text default null,
  p_operador_id       uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao   uuid;
  v_usuario  uuid;
  v_card     public.plt_cards%rowtype;
  v_papel_origem text;
  v_marcacao_id  bigint;
  v_evento_id    bigint;
begin
  v_sessao := plt_privado.fn_usuario_atual();
  if v_sessao is null then
    raise exception 'Só usuário ativo da plataforma move cards.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards where id = p_card_id;
  if not found then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;

  if not (
    plt_privado.fn_eh_admin()
    or v_card.setor_atual_id in (select plt_privado.fn_setores_do_usuario())
    or p_setor_destino_id in (select plt_privado.fn_setores_do_usuario())
  ) then
    raise exception 'Você não trabalha nem no setor de origem nem no de destino deste card.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Gesto por PIN: o autor passa a ser o operador identificado — desde que
  -- seja gente ativa e trabalhe no setor envolvido (ou seja admin).
  if p_operador_id is not null and p_operador_id <> v_sessao then
    if not exists (select 1 from public.plt_usuarios u where u.id = p_operador_id and u.ativo) then
      raise exception 'Operador não encontrado ou inativo — confira a identificação.'
        using errcode = 'check_violation';
    end if;
    if not (
      exists (select 1 from public.plt_usuarios u
               where u.id = p_operador_id and u.papel = 'admin')
      or exists (select 1 from public.plt_usuario_setores us
                  where us.usuario_id = p_operador_id
                    and us.setor_id in (v_card.setor_atual_id, p_setor_destino_id))
    ) then
      raise exception 'O operador identificado não trabalha nem no setor de origem nem no de destino.'
        using errcode = 'insufficient_privilege';
    end if;
    v_usuario := p_operador_id;
  else
    v_usuario := v_sessao;
  end if;

  if v_card.setor_atual_id = p_setor_destino_id then
    -- Mesmo setor: mudança de etapa, sem qualidade (D-25).
    if v_card.etapa_atual_id is not distinct from p_etapa_destino_id then
      raise exception 'O card já está aí — escolha outro destino.' using errcode = 'check_violation';
    end if;
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem,
         setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id)
      values
        (p_card_id, 'movimentacao_etapa', v_usuario, 'interface',
         v_card.setor_atual_id, v_card.etapa_atual_id, p_setor_destino_id, p_etapa_destino_id)
      returning id into v_evento_id;
    return v_evento_id;
  end if;

  -- Entre setores: saindo de PRODUÇÃO, a marcação é obrigatória (D-09/D-25).
  select s.papel_no_fluxo into v_papel_origem
    from public.plt_setores s where s.id = v_card.setor_atual_id;

  if v_papel_origem = 'producao' then
    if p_estado_qualidade is null then
      -- D-09 — mensagem sem código interno (D-27).
      raise exception 'Mover para outro setor exige marcar o estado da peça: 🟢 perfeito estado · 🟡 estado de atenção · 🔴 danificado.'
        using errcode = 'check_violation';
    end if;
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem,
         setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id,
         estado_qualidade, observacao)
      values
        (p_card_id, 'qualidade_marcada', v_usuario, 'interface',
         v_card.setor_atual_id, v_card.etapa_atual_id, p_setor_destino_id, p_etapa_destino_id,
         p_estado_qualidade, nullif(btrim(p_observacao), ''))
      returning id into v_marcacao_id;
  end if;

  insert into public.plt_eventos
      (card_id, tipo, usuario_id, origem,
       setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id,
       evento_referencia_id)
    values
      (p_card_id, 'movimentacao_setor', v_usuario, 'interface',
       v_card.setor_atual_id, v_card.etapa_atual_id, p_setor_destino_id, p_etapa_destino_id,
       v_marcacao_id)
    returning id into v_evento_id;

  return v_evento_id;
end;
$$;

comment on function public.plt_fn_mover_card(bigint, bigint, bigint, text, text, uuid) is
  'Move um card pela interface: marcação de qualidade + movimentação numa transação só. p_operador_id = autor identificado por PIN no tablet (SESSAO-07). Endpoint REST de propósito — gate interno; as regras de verdade vivem nos triggers.';

drop function if exists public.plt_fn_registrar_parecer(bigint, text, text);

create or replace function public.plt_fn_registrar_parecer(
  p_marcacao_id      bigint,
  p_estado_qualidade text,
  p_observacao       text default null,
  p_operador_id      uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao  uuid;
  v_usuario uuid;
  v_marc    public.plt_eventos%rowtype;
  v_evento_id bigint;
begin
  v_sessao := plt_privado.fn_usuario_atual();
  if v_sessao is null then
    raise exception 'Só usuário ativo da plataforma registra parecer.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_marc from public.plt_eventos where id = p_marcacao_id;
  if not found or v_marc.tipo <> 'qualidade_marcada' then
    raise exception 'Marcação de qualidade % não existe.', p_marcacao_id using errcode = 'no_data_found';
  end if;

  if not (
    plt_privado.fn_eh_admin()
    or v_marc.setor_destino_id in (select plt_privado.fn_setores_do_usuario())
  ) then
    -- D-09: o parecer é do setor recebedor.
    raise exception 'O parecer é do setor que recebe a peça — você não trabalha nele.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Gesto por PIN (SESSAO-07): autor = operador identificado, do setor recebedor.
  if p_operador_id is not null and p_operador_id <> v_sessao then
    if not exists (select 1 from public.plt_usuarios u where u.id = p_operador_id and u.ativo) then
      raise exception 'Operador não encontrado ou inativo — confira a identificação.'
        using errcode = 'check_violation';
    end if;
    if not (
      exists (select 1 from public.plt_usuarios u
               where u.id = p_operador_id and u.papel = 'admin')
      or exists (select 1 from public.plt_usuario_setores us
                  where us.usuario_id = p_operador_id
                    and us.setor_id = v_marc.setor_destino_id)
    ) then
      raise exception 'O operador identificado não trabalha no setor que recebe a peça.'
        using errcode = 'insufficient_privilege';
    end if;
    v_usuario := p_operador_id;
  else
    v_usuario := v_sessao;
  end if;

  insert into public.plt_eventos
      (card_id, tipo, usuario_id, origem, evento_referencia_id,
       estado_qualidade, observacao)
    values
      (v_marc.card_id, 'qualidade_parecer', v_usuario, 'interface', p_marcacao_id,
       p_estado_qualidade, nullif(btrim(p_observacao), ''))
    returning id into v_evento_id;

  return v_evento_id;
end;
$$;

comment on function public.plt_fn_registrar_parecer(bigint, text, text, uuid) is
  'Registra o parecer de recebimento (D-09). p_operador_id = autor identificado por PIN no tablet (SESSAO-07). Endpoint REST de propósito — gate: gente do setor recebedor ou admin; validações de verdade no trigger.';

revoke all on function public.plt_fn_mover_card(bigint, bigint, bigint, text, text, uuid) from public, anon;
revoke all on function public.plt_fn_registrar_parecer(bigint, text, text, uuid)          from public, anon;
grant execute on function public.plt_fn_mover_card(bigint, bigint, bigint, text, text, uuid) to authenticated;
grant execute on function public.plt_fn_registrar_parecer(bigint, text, text, uuid)          to authenticated;

-- ----------------------------------------------------------------------------
-- 3 · Controle de tempo do admin (D-29)
--
-- Horário de funcionamento por setor E por usuário + pausas (agora/retroativas).
-- REGRA DE OURO: nada aqui toca plt_eventos. O que já foi registrado é fixo;
-- o desconto acontece só no CÁLCULO derivado (fn_tempo_util), que as consultas
-- de dashboard (SESSAO-10) usam. Configuração é estado editável de admin —
-- não é evento, e não fere o M-02 (não é medição, é régua de medição).
-- ----------------------------------------------------------------------------
create table if not exists public.plt_horarios_funcionamento (
  id           bigint generated always as identity primary key,
  escopo       text not null check (escopo in ('setor', 'usuario')),
  setor_id     bigint references public.plt_setores(id),
  usuario_id   uuid references public.plt_usuarios(id),
  -- 0 = domingo … 6 = sábado (convenção do extract(dow) do Postgres)
  dia_semana   smallint not null check (dia_semana between 0 and 6),
  hora_inicio  time not null,
  hora_fim     time not null,
  criado_em    timestamptz not null default now(),
  constraint plt_horarios_janela_valida check (hora_fim > hora_inicio),
  constraint plt_horarios_escopo_coerente check (
    (escopo = 'setor'   and setor_id is not null and usuario_id is null) or
    (escopo = 'usuario' and usuario_id is not null and setor_id is null)
  )
);

comment on table public.plt_horarios_funcionamento is
  'D-29: horário de funcionamento por setor e por usuário. Fora dessas janelas o tempo NÃO conta nos cálculos (fn_tempo_util). Sem linha nenhuma para um escopo = funciona o tempo todo.';

create index if not exists plt_horarios_setor_idx
  on public.plt_horarios_funcionamento (setor_id) where setor_id is not null;
create index if not exists plt_horarios_usuario_idx
  on public.plt_horarios_funcionamento (usuario_id) where usuario_id is not null;

create table if not exists public.plt_pausas_tempo (
  id           bigint generated always as identity primary key,
  escopo       text not null check (escopo in ('setor', 'usuario')),
  setor_id     bigint references public.plt_setores(id),
  usuario_id   uuid references public.plt_usuarios(id),
  inicio       timestamptz not null default now(),
  -- NULL = pausa aberta ("desligado até religar")
  fim          timestamptz,
  -- true quando o admin registrou DEPOIS ("esqueci de desligar ontem")
  retroativa   boolean not null default false,
  motivo       text,
  criado_por   uuid not null references public.plt_usuarios(id),
  criado_em    timestamptz not null default now(),
  constraint plt_pausas_janela_valida check (fim is null or fim > inicio),
  constraint plt_pausas_escopo_coerente check (
    (escopo = 'setor'   and setor_id is not null and usuario_id is null) or
    (escopo = 'usuario' and usuario_id is not null and setor_id is null)
  )
);

comment on table public.plt_pausas_tempo is
  'D-29: períodos em que o tempo de um setor/pessoa NÃO conta — pausa aberta (fim null, até religar) ou correção retroativa. Nunca altera eventos: só o cálculo desconta.';

create index if not exists plt_pausas_setor_idx
  on public.plt_pausas_tempo (setor_id, inicio) where setor_id is not null;
create index if not exists plt_pausas_usuario_idx
  on public.plt_pausas_tempo (usuario_id, inicio) where usuario_id is not null;

alter table public.plt_horarios_funcionamento enable row level security;
alter table public.plt_pausas_tempo           enable row level security;

-- Leitura: qualquer autenticado (o líder precisa entender por que o número
-- descontou). Escrita: só admin (D-29 — "nas configurações de admin").
drop policy if exists plt_horarios_leitura on public.plt_horarios_funcionamento;
create policy plt_horarios_leitura on public.plt_horarios_funcionamento
  for select to authenticated using (true);

drop policy if exists plt_horarios_admin on public.plt_horarios_funcionamento;
create policy plt_horarios_admin on public.plt_horarios_funcionamento
  for all to authenticated
  using (plt_privado.fn_eh_admin())
  with check (plt_privado.fn_eh_admin());

drop policy if exists plt_pausas_leitura on public.plt_pausas_tempo;
create policy plt_pausas_leitura on public.plt_pausas_tempo
  for select to authenticated using (true);

drop policy if exists plt_pausas_admin on public.plt_pausas_tempo;
create policy plt_pausas_admin on public.plt_pausas_tempo
  for all to authenticated
  using (plt_privado.fn_eh_admin())
  with check (plt_privado.fn_eh_admin());

-- ----------------------------------------------------------------------------
-- 3b · fn_tempo_util — o tempo que CONTA dentro de [inicio, fim]
--
-- Desconta: (a) o que cai fora do horário de funcionamento do setor e/ou do
-- usuário (interseção, quando os dois têm horário; quem não tem horário
-- cadastrado funciona o tempo todo) e (b) as pausas do setor/usuário.
-- Multirange faz a aritmética de janelas sem contar nada duas vezes.
-- Fuso da fábrica: America/Fortaleza (Natal-RN, sem horário de verão).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_util(
  p_inicio     timestamptz,
  p_fim        timestamptz,
  p_setor_id   bigint,
  p_usuario_id uuid
)
returns interval
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz constant text := 'America/Fortaleza';
  v_fim timestamptz := coalesce(p_fim, now());
  v_faixa tstzrange;
  v_dia date;
  v_dia_fim date;
  v_setor_mr   tstzmultirange := tstzmultirange();
  v_usuario_mr tstzmultirange := tstzmultirange();
  v_permitido  tstzmultirange;
  v_pausas     tstzmultirange;
  v_tem_setor   boolean := false;
  v_tem_usuario boolean := false;
  h record;
  seg tstzrange;
  v_total interval := interval '0';
begin
  if p_inicio is null or v_fim <= p_inicio then
    return interval '0';
  end if;
  v_faixa := tstzrange(p_inicio, v_fim);

  select exists (select 1 from public.plt_horarios_funcionamento hh
                  where hh.escopo = 'setor' and hh.setor_id = p_setor_id)
    into v_tem_setor;
  select exists (select 1 from public.plt_horarios_funcionamento hh
                  where hh.escopo = 'usuario' and hh.usuario_id = p_usuario_id)
    into v_tem_usuario;

  -- Janelas de funcionamento dia a dia, no fuso da fábrica.
  if v_tem_setor or v_tem_usuario then
    v_dia     := (p_inicio at time zone v_tz)::date;
    v_dia_fim := (v_fim    at time zone v_tz)::date;
    while v_dia <= v_dia_fim loop
      for h in
        select hh.escopo, hh.hora_inicio, hh.hora_fim
          from public.plt_horarios_funcionamento hh
         where hh.dia_semana = extract(dow from v_dia)::int
           and ((hh.escopo = 'setor'   and hh.setor_id   = p_setor_id)
             or (hh.escopo = 'usuario' and hh.usuario_id = p_usuario_id))
      loop
        if h.escopo = 'setor' then
          v_setor_mr := v_setor_mr + tstzmultirange(tstzrange(
            (v_dia + h.hora_inicio) at time zone v_tz,
            (v_dia + h.hora_fim)    at time zone v_tz));
        else
          v_usuario_mr := v_usuario_mr + tstzmultirange(tstzrange(
            (v_dia + h.hora_inicio) at time zone v_tz,
            (v_dia + h.hora_fim)    at time zone v_tz));
        end if;
      end loop;
      v_dia := v_dia + 1;
    end loop;
  end if;

  v_permitido := tstzmultirange(v_faixa);
  if v_tem_setor   then v_permitido := v_permitido * v_setor_mr;   end if;
  if v_tem_usuario then v_permitido := v_permitido * v_usuario_mr; end if;

  -- Pausas do setor e da pessoa (abertas contam até agora; retroativas idem).
  select coalesce(range_agg(tstzrange(pp.inicio, coalesce(pp.fim, now()))), tstzmultirange())
    into v_pausas
    from public.plt_pausas_tempo pp
   where (pp.escopo = 'setor'   and pp.setor_id   = p_setor_id)
      or (pp.escopo = 'usuario' and pp.usuario_id = p_usuario_id);

  v_permitido := v_permitido - v_pausas;

  for seg in select unnest(v_permitido) loop
    v_total := v_total + (upper(seg) - lower(seg));
  end loop;

  return v_total;
end;
$$;

comment on function plt_privado.fn_tempo_util(timestamptz, timestamptz, bigint, uuid) is
  'D-29: o tempo que CONTA num intervalo, descontando fora-de-horário (setor∩usuário) e pausas. Usada pelos cálculos de dashboard — nunca altera eventos.';

revoke all on function plt_privado.fn_tempo_util(timestamptz, timestamptz, bigint, uuid) from public, anon;
grant execute on function plt_privado.fn_tempo_util(timestamptz, timestamptz, bigint, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4a · Tempo real: plt_cards entra na publicação do Supabase Realtime
-- (a RLS continua valendo — cada um só recebe o que pode ver). Guardado num
-- do-block porque o Postgres descartável dos testes não tem a publicação.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'plt_cards'
    ) then
      alter publication supabase_realtime add table public.plt_cards;
    end if;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4b · Bucket `plt-imagens` (D-28): imagens por PRODUTO (caminho
-- produtos/{codigo}/…) — a futura biblioteca de peças pluga aqui. Público para
-- LEITURA (imagem de móvel não é dado sensível; simplifica o tablet); escrita
-- só admin/líder. Guardado: o Postgres dos testes não tem o schema storage.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    begin
      insert into storage.buckets (id, name, public)
      values ('plt-imagens', 'plt-imagens', true)
      on conflict (id) do nothing;

      -- Listagem/leitura via API para qualquer autenticado.
      execute $pol$drop policy if exists plt_imagens_leitura on storage.objects$pol$;
      execute $pol$
        create policy plt_imagens_leitura on storage.objects
          for select to authenticated
          using (bucket_id = 'plt-imagens')
      $pol$;

      -- Escrita (anexar): admin ou líder de algum setor (D-28).
      execute $pol$drop policy if exists plt_imagens_escrita on storage.objects$pol$;
      execute $pol$
        create policy plt_imagens_escrita on storage.objects
          for insert to authenticated
          with check (
            bucket_id = 'plt-imagens'
            and (
              plt_privado.fn_eh_admin()
              or exists (select 1 from public.plt_usuario_setores us
                          where us.usuario_id = plt_privado.fn_usuario_atual()
                            and us.lider_do_setor)
            )
          )
      $pol$;

      execute $pol$drop policy if exists plt_imagens_remocao on storage.objects$pol$;
      execute $pol$
        create policy plt_imagens_remocao on storage.objects
          for delete to authenticated
          using (
            bucket_id = 'plt-imagens'
            and (
              plt_privado.fn_eh_admin()
              or exists (select 1 from public.plt_usuario_setores us
                          where us.usuario_id = plt_privado.fn_usuario_atual()
                            and us.lider_do_setor)
            )
          )
      $pol$;
    exception when insufficient_privilege then
      -- Em alguns projetos o dono de storage.objects é outro papel e a policy
      -- não pode ser criada por aqui — o bucket/policies viram passo manual
      -- documentado no handoff, e o resto da migration segue válido.
      raise notice 'storage: sem privilégio para bucket/policies — criar pelo painel (documentado no handoff).';
    end;
  end if;
end;
$$;
