-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 05 — QUALIDADE E NOTIFICAÇÕES
-- Sessão: SESSAO-02 · Data: 2026-08-24
--
-- D-09 (revisada em 24/08): dupla atestação — quem ENTREGA marca, quem RECEBE
-- registra o próprio parecer. SEM foto obrigatória. SEM disputa e SEM pausa:
-- divergência não trava a peça, vira registro que alimenta a dashboard.
-- Divergência OU 🟡 OU 🔴 → líder/admin notificado automaticamente, com
-- exatamente o que aconteceu.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · A transição de qualidade é uma VISÃO, não uma tabela
--
-- Guardar "estado do remetente + parecer do recebedor" numa linha exigiria
-- atualizar essa linha quando o parecer chegasse — ou seja, estado mutável no
-- meio do caminho da auditoria. Como os dois lados já são eventos (e eventos
-- são append-only), a transição é derivada. Zero estado mutável.
-- ----------------------------------------------------------------------------
create or replace view public.plt_vw_qualidade_transicoes as
select
  marcacao.id                              as evento_marcacao_id,
  parecer.id                               as evento_parecer_id,
  marcacao.card_id,
  marcacao.setor_origem_id,
  marcacao.setor_destino_id,
  marcacao.usuario_id                      as usuario_remetente_id,
  marcacao.estado_qualidade                as estado_remetente,
  marcacao.ocorrido_em                     as marcado_em,
  parecer.usuario_id                       as usuario_recebedor_id,
  parecer.estado_qualidade                 as estado_recebedor,
  parecer.ocorrido_em                      as conferido_em,
  (parecer.id is not null
   and parecer.estado_qualidade is distinct from marcacao.estado_qualidade)
                                           as divergente,
  -- Quando líder/admin precisa saber (D-09, Q-18 ✅)
  (marcacao.estado_qualidade in ('atencao', 'danificado')
   or (parecer.id is not null
       and parecer.estado_qualidade is distinct from marcacao.estado_qualidade))
                                           as exige_notificacao
from public.plt_eventos marcacao
left join public.plt_eventos parecer
       on parecer.evento_referencia_id = marcacao.id
      and parecer.tipo = 'qualidade_parecer'
where marcacao.tipo = 'qualidade_marcada';

comment on view public.plt_vw_qualidade_transicoes is
  'Dupla atestação da D-09 derivada dos eventos: marcação de quem entrega + parecer de quem recebe, com divergência calculada.';

-- A view lê com os olhos de quem consulta, respeitando o RLS da migration 08.
alter view public.plt_vw_qualidade_transicoes set (security_invoker = on);

-- ----------------------------------------------------------------------------
-- 2 · plt_notificacoes — o aviso que chega ao líder/admin
--
-- Não é evento: "lida" muda com o tempo, e isso é estado de leitura, não
-- história da peça. O FATO que gerou o aviso continua imutável em plt_eventos.
-- Por onde o aviso sai (plataforma, WhatsApp via n8n, e-mail) é a Q-42, ainda
-- em aberto — por isso `canal` aceita texto livre e nasce com 'plataforma'.
-- ----------------------------------------------------------------------------
create table if not exists public.plt_notificacoes (
  id             bigint generated always as identity primary key,
  destinatario_id uuid not null references public.plt_usuarios(id) on delete cascade,
  evento_id      bigint references public.plt_eventos(id),
  card_id        bigint references public.plt_cards(id),
  tipo           text not null,            -- 'qualidade_atencao', 'qualidade_danificado', 'divergencia'…
  titulo         text not null,
  corpo          text not null,            -- "exatamente o que aconteceu" (D-09/Q-18)
  canal          text not null default 'plataforma',
  lida_em        timestamptz,
  criada_em      timestamptz not null default now()
);

comment on table public.plt_notificacoes is
  'Avisos a líder/admin. D-09/Q-18: divergência OU 🟡 OU 🔴 notificam automaticamente, com o relato do que aconteceu.';
comment on column public.plt_notificacoes.corpo is
  'Relato completo: quem marcou o quê, setores envolvidos e os dois pareceres.';

create index if not exists plt_notificacoes_caixa_idx
  on public.plt_notificacoes (destinatario_id, criada_em desc) where lida_em is null;
