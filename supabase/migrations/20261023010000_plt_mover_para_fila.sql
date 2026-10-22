-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · SESSAO-39 — O BOTÃO "MOVER" DO CARD
-- (D-173 · ↩️ revisa a D-59 para a liderança)
--
-- O pedido do dono: "Dentro de todos os cards de produção, coloque a
-- possibilidade de dentro dele ter um botão de mover, esse mover pode ser
-- movido para a FILA de qualquer setor a qualquer momento por um líder, admin
-- ou super admin." Respostas (21/10, na conversa): líder de QUALQUER setor
-- move qualquer card de produção; o motivo é OBRIGATÓRIO, de uma lista própria
-- em Configurações → Utilitários (+ "Outro"), e entra no painel de motivos.
--
-- O que muda:
--   1. plt_motivos ganha o tipo 'mover' (check recriado not valid; o validate
--      mora no fim DESTA — E-19, saiu da migration do stand-by) + 4 motivos
--      semeados uma vez.
--   2. plt_privado.fn_pode_mover_para_fila(usuario) — a regra única de quem
--      move: admin (o super admin é admin), o papel líder ou a marca de líder
--      em algum setor; o nível logística nunca (D-147: só olha).
--   3. plt_fn_card_mover_para_fila — a porta do gesto: a peça ou o card avulso
--      que está num setor de PRODUÇÃO vai para a etapa de FILA do setor de
--      produção escolhido (o mesmo setor também vale: volta para a fila).
--      Os fatos são os de sempre (movimentacao_setor / movimentacao_etapa —
--      o tempo de quem executava fecha e as ajudas acabam pelas regras que já
--      existem — D-24, D-146); o motivo vai na observação (a história mostra)
--      e em dados.motivo_id (o painel conta). A marcação do estado da peça
--      segue a regra do arrasto (D-126): obrigatória só quando o setor de
--      origem pede ao enviar.
--   4. plt_fn_motivo_salvar aceita o tipo 'mover' (recriada por extração da
--      versão viva — A-97).
--
-- Nada aqui toca as tabelas da integração nem o check de tipos de evento.
-- Aditiva e compatível com o site publicado. Idempotente.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · O tipo 'mover' nos motivos e a lista inicial (semeada uma vez)
-- ----------------------------------------------------------------------------
alter table public.plt_motivos drop constraint if exists plt_motivos_tipo_ck;
alter table public.plt_motivos add constraint plt_motivos_tipo_ck
  check (tipo in ('nao_entregue', 'desfazer_entrega', 'devolucao', 'pausa', 'saida', 'standby', 'mover'))
  not valid;

do $$
begin
  if not exists (select 1 from public.plt_motivos where tipo = 'mover') then
    insert into public.plt_motivos (tipo, texto, ordem)
    values ('mover', 'Retrabalho', 10),
           ('mover', 'Foi para o setor errado', 20),
           ('mover', 'Mudança no planejamento', 30),
           ('mover', 'Peça com defeito', 40);
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2 · Quem move pelo botão (uma regra só — a tela lê o mesmo "é líder")
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_pode_mover_para_fila(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
           select 1 from public.plt_usuarios u
            where u.id = p_usuario and u.ativo and u.papel in ('admin', 'lider')
         )
      or exists (
           select 1 from public.plt_usuario_setores us
             join public.plt_usuarios u on u.id = us.usuario_id
            where us.usuario_id = p_usuario and u.ativo and us.lider_do_setor
              and u.papel <> 'logistica'
         );
$$;

comment on function plt_privado.fn_pode_mover_para_fila(uuid) is
  'SESSAO-39 (D-173): quem usa o botão Mover — admin (o super admin é admin), o papel líder ou a marca de líder em QUALQUER setor (resposta do dono: líder de qualquer setor move qualquer card). O nível logística nunca move (D-147).';

-- ----------------------------------------------------------------------------
-- 3 · A porta do gesto
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_card_mover_para_fila(
  p_card_id          bigint,
  p_setor_id         bigint,
  p_motivo_id        bigint,
  p_texto            text default null,
  p_estado_qualidade text default null,
  p_operador_id      uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao   uuid;
  v_autor    uuid;
  v_card     public.plt_cards%rowtype;
  v_origem   public.plt_setores%rowtype;
  v_destino  public.plt_setores%rowtype;
  v_fila     bigint;
  v_motivo   text;
  v_dados    jsonb;
  v_marcacao bigint;
  v_evento   bigint;
begin
  v_sessao := plt_privado.fn_usuario_atual();
  if v_sessao is null then
    raise exception 'Só usuário ativo da plataforma move cards.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards where id = p_card_id;
  if not found or v_card.arquivado_em is not null then
    raise exception 'Este card não está mais na produção.' using errcode = 'no_data_found';
  end if;
  if v_card.tipo not in ('unidade', 'avulso') then
    raise exception 'Só a peça e o card avulso se movem por aqui — o pedido segue pelo PCP.'
      using errcode = 'check_violation';
  end if;

  select * into v_origem from public.plt_setores where id = v_card.setor_atual_id;
  if not found or v_origem.papel_no_fluxo <> 'producao' then
    raise exception 'Este card não está num setor de produção — o Mover vale só para os cards da produção.'
      using errcode = 'check_violation';
  end if;

  -- Quem age: a pessoa logada — ou, no tablet do setor, quem digitou o PIN.
  if p_operador_id is null or p_operador_id = v_sessao then
    v_autor := v_sessao;
  else
    if not (plt_privado.fn_eh_admin()
            or v_card.setor_atual_id in (select plt_privado.fn_setores_do_usuario())) then
      raise exception 'Este aparelho não é do setor deste card.' using errcode = 'insufficient_privilege';
    end if;
    if not exists (select 1 from public.plt_usuarios u where u.id = p_operador_id and u.ativo) then
      raise exception 'Operador não encontrado ou inativo — confira a identificação.'
        using errcode = 'check_violation';
    end if;
    v_autor := p_operador_id;
  end if;
  if not plt_privado.fn_pode_mover_para_fila(v_autor) then
    raise exception 'Mover o card para a fila de outro setor é gesto de líder ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_destino from public.plt_setores where id = p_setor_id;
  if not found or not v_destino.ativo or v_destino.papel_no_fluxo <> 'producao' then
    raise exception 'Escolha um setor de produção.' using errcode = 'check_violation';
  end if;
  select e.id into v_fila
    from public.plt_etapas e
   where e.setor_id = p_setor_id and e.eh_fila and e.ativa
   order by e.ordem, e.id
   limit 1;
  if v_fila is null then
    raise exception 'O setor % ainda não tem uma etapa de fila — cadastre em Setores e etapas.', v_destino.nome
      using errcode = 'check_violation';
  end if;
  if v_card.setor_atual_id = p_setor_id and v_card.etapa_atual_id is not distinct from v_fila then
    raise exception 'O card já está na fila de %.', v_destino.nome using errcode = 'check_violation';
  end if;

  -- O motivo é obrigatório (da lista "mover" ou "Outro", escrito).
  v_motivo := plt_privado.fn_motivo_da_lista('mover', p_motivo_id, p_texto);
  v_dados := jsonb_build_object('motivo', v_motivo, 'motivo_id', p_motivo_id, 'como', 'mover_para_fila');

  if v_card.setor_atual_id = p_setor_id then
    -- De volta para a fila do próprio setor (D-25: sem qualidade).
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem,
         setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id,
         observacao, dados)
      values
        (p_card_id, 'movimentacao_etapa', v_autor, 'interface',
         v_card.setor_atual_id, v_card.etapa_atual_id, p_setor_id, v_fila,
         v_motivo, v_dados)
      returning id into v_evento;
  else
    -- Para outro setor: a marcação do estado como no arrasto (D-126).
    if p_estado_qualidade is null
       and plt_privado.fn_pede_estado(v_card.setor_atual_id, 'envio', v_card.tipo, v_card.pedido_id) then
      raise exception 'Este setor pede para marcar o estado da peça ao mandar adiante: 🟢 perfeito estado · 🟡 estado de atenção · 🔴 danificado.'
        using errcode = 'check_violation';
    end if;
    if p_estado_qualidade is not null then
      insert into public.plt_eventos
          (card_id, tipo, usuario_id, origem,
           setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id,
           estado_qualidade)
        values
          (p_card_id, 'qualidade_marcada', v_autor, 'interface',
           v_card.setor_atual_id, v_card.etapa_atual_id, p_setor_id, v_fila,
           p_estado_qualidade)
        returning id into v_marcacao;
    end if;
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem,
         setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id,
         evento_referencia_id, observacao, dados)
      values
        (p_card_id, 'movimentacao_setor', v_autor, 'interface',
         v_card.setor_atual_id, v_card.etapa_atual_id, p_setor_id, v_fila,
         v_marcacao, v_motivo, v_dados)
      returning id into v_evento;
  end if;

  return jsonb_build_object('evento_id', v_evento, 'setor_id', p_setor_id,
                            'setor_nome', v_destino.nome, 'etapa_id', v_fila);
end;
$$;

comment on function public.plt_fn_card_mover_para_fila(bigint, bigint, bigint, text, text, uuid) is
  'SESSAO-39 (D-173): o botão Mover da janela do card — a peça ou o card avulso de um setor de produção vai para a FILA do setor de produção escolhido (o próprio setor também), com motivo obrigatório (lista "mover" ou "Outro"). Só líder (de qualquer setor) e admin; no tablet, o operador do PIN. Os fatos de sempre (o tempo aberto fecha e as ajudas acabam pelas regras existentes); a marcação do estado como no arrasto (D-126).';

revoke all on function public.plt_fn_card_mover_para_fila(bigint, bigint, bigint, text, text, uuid) from public, anon;
grant execute on function public.plt_fn_card_mover_para_fila(bigint, bigint, bigint, text, text, uuid) to authenticated;
revoke all on function plt_privado.fn_pode_mover_para_fila(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4 · Cadastrar motivo aceita o tipo 'mover' (recriada da versão viva — A-97)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_motivo_salvar(
  p_id       bigint,
  p_tipo     text,
  p_texto    text,
  p_ordem    integer default null,
  p_ativo    boolean default true,
  p_especial boolean default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id       bigint;
  v_especial boolean;
begin
  if not plt_privado.fn_eh_admin() then
    raise exception 'Cadastrar motivo é gesto de admin.' using errcode = 'insufficient_privilege';
  end if;
  -- SESSAO-38 (D-169): + os motivos de stand-by; SESSAO-39 (D-173): + os do Mover
  if p_tipo not in ('nao_entregue', 'desfazer_entrega', 'devolucao', 'pausa', 'saida', 'standby', 'mover') then
    raise exception 'Tipo de motivo desconhecido.' using errcode = 'check_violation';
  end if;
  if char_length(btrim(coalesce(p_texto, ''))) not between 2 and 80 then
    raise exception 'O motivo precisa ter de 2 a 80 letras — uma frase curta.' using errcode = 'check_violation';
  end if;
  if coalesce(p_especial, false) and p_tipo <> 'pausa' then
    raise exception 'Só motivo de pausa pode ser especial.' using errcode = 'check_violation';
  end if;
  if p_id is null then
    insert into public.plt_motivos (tipo, texto, ordem, ativo, especial)
      values (p_tipo, btrim(p_texto), coalesce(p_ordem, 100), coalesce(p_ativo, true), coalesce(p_especial, false))
      returning id, especial into v_id, v_especial;
  else
    update public.plt_motivos
       set texto = btrim(p_texto), ordem = coalesce(p_ordem, ordem), ativo = coalesce(p_ativo, ativo),
           especial = coalesce(p_especial, especial),
           atualizado_em = now()
     where id = p_id and tipo = p_tipo
     returning id, especial into v_id, v_especial;
    if v_id is null then
      raise exception 'Motivo não encontrado.' using errcode = 'no_data_found';
    end if;
  end if;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (plt_privado.fn_usuario_atual(), 'motivo_salvo',
            jsonb_build_object('motivo_id', v_id, 'tipo', p_tipo, 'texto', btrim(p_texto),
                               'ativo', coalesce(p_ativo, true), 'especial', v_especial));
  return v_id;
exception when unique_violation then
  raise exception 'Já existe esse motivo.' using errcode = 'unique_violation';
end;
$$;

-- ----------------------------------------------------------------------------
-- 5 · O check novo valida tudo (E-19: o validate mora SEMPRE na migration mais
--     nova do check — saiu da migration do stand-by)
-- ----------------------------------------------------------------------------
alter table public.plt_motivos validate constraint plt_motivos_tipo_ck;
