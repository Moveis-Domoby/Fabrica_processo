---
titulo: "Memória de execução — SESSAO-02 (Banco e Domínio no Supabase)"
sessao: 02
branch: sessao-02-banco-dominio
data: 2026-08-26
---

# 🧾 Memória de execução — SESSAO-02

> Regra 8 do `CLAUDE.md`: escrito **enquanto** a sessão acontece.
> Demanda: `_docs/Plataforma/Demandas/SESSAO-02 - Banco e Dominio no Supabase.md`

## Task list (espelho da demanda)

- [x] Ler `SUPA - Esquema do Banco` **antes** de qualquer linha de SQL (regra 10)
- [x] Modelar usuários / perfis / papéis e vínculo com setor
- [x] Setores contendo etapas internas, 2 níveis, ambos cadastráveis (D-12 / RF-07)
- [x] Cards de pedido e de unidade, vinculados ao pedido do Tiny já existente (D-01)
- [x] Eventos append-only com quem/quando/de-onde/para-onde (RNF-05)
- [x] Estados de qualidade da transição: marcação do remetente + parecer do recebedor (D-09)
- [x] Visualizações salvas de dashboard (RF-33)
- [x] Tarefas e delegação (RF-40 a RF-43)
- [x] Tempo de fila para o setor, execução para a pessoa (D-02)
- [x] RLS coerente com operador / líder / admin, com políticas nas migrations
- [x] `docs/modelo-de-dados.md` em linguagem que o dono entende
- [x] Migrations rodam do zero, duas vezes seguidas, sem erro
- [x] Nenhuma tabela/coluna existente da integração alterada
- [x] Evento não pode ser alterado nem apagado (testado)
- [x] Aplicado no banco — **com autorização explícita do dono** (D-19)
- [x] `supabase-fabrica-schema.sql` + `SUPA - Esquema do Banco` atualizados (ciclo do cofre)
- [x] Handoff

## Perguntas que precisaram do dono

| # | Pergunta | Resposta |
|---|---|---|
| Q-28 | ROTAS é setor terminal na plataforma, ou o fim de linha é só ESTOQUE? | *"coloque o setor de rotas nos primórdios de criação então"* → ESTOQUE e ROTAS nascem no seed como terminais. Virou **D-18** |
| — | O Supabase da org Tech é o mesmo que já tem a integração do Tiny? | Sim. Confirmado no banco: `clientes` 119, `pedidos` 118, `pedido_itens` 191. A **D-08 se mantém** e o modelo vale como está. Virou **D-19** |

## Decisões técnicas

| # | Decisão | Motivo |
|---|---|---|
| T-12 | **Sem foreign key de `plt_cards` para `pedido_itens`** | `fn_upsert_pedido` apaga e regrava os itens a cada atualização do Tiny (`supabase-fabrica-schema.sql:258`). Uma FK ali faria **toda atualização de pedido falhar em produção**. O item vira snapshot |
| T-13 | **Posição do card é projeção, escrita só por trigger** | evento é a verdade (M-02); a coluna existe para a tela ser rápida. Nenhum código escreve posição à mão |
| T-14 | **Append-only por TRIGGER, não por RLS** | a `service_role` (chave do n8n) ignora RLS. Trava que precisa valer para todos não mora no RLS |
| T-15 | **Qualidade é VISÃO, não tabela** | guardar "marcação + parecer" numa linha exigiria atualizar essa linha quando o parecer chegasse — estado mutável no meio da auditoria. Como os dois lados já são eventos, a transição é derivada |
| T-16 | **Tempo em visões, não em colunas** | mesma razão. E é o que garante que ninguém "arruma" um número depois |
| T-17 | **`papel_no_fluxo` com índice único para `entrada`** | a D-13 ("todo pedido entra pelo PCP") vira garantia do banco, não boa vontade de quem cadastra |
| T-18 | **Uma etapa de fila por setor, no máximo** | com duas, o "tempo de fila do setor" fica ambíguo e a conta de gargalo perde sentido |
| T-19 | **`auth_user_id` opcional em `plt_usuarios`** | D-06: o operador de tablet compartilhado se identifica por PIN e pode não ter login nenhum |
| T-20 | **Funções internas no schema `plt_privado`** | o Supabase publica `public` inteiro como API REST; função criada lá vira endpoint sem ninguém pedir |
| T-21 | **Views com `security_invoker = on`** | sem isso a view leria as tabelas com os olhos de quem a criou, furando as políticas |
| T-22 | **PGlite (Postgres no Node) para testar migrations** | o Docker Desktop não sobe a partir desta sessão. Dependência **só de desenvolvimento**; a versão em Docker está pronta em `supabase/testes/testar-migrations.sh` |
| T-23 | **`pg` + script próprio para aplicar migrations** | `npm run banco:aplicar` confere a impressão digital da integração antes e depois, e só aplica com `--confirmar` |

## Diário

### 2026-08-26 — Modelagem

- Li a demanda duas vezes e o esquema do banco inteiro antes de escrever SQL.
- **Contradição encontrada entre decisões:** a D-13 diz que o card termina em ESTOQUE ou ROTAS; a D-12, que lista os setores do dia 1 copiando o ClickUp, não tem nenhum dos dois; e a D-05 mantém a ROTAS no ClickUp. Parei e perguntei em vez de escolher — virou D-18.
- **Achado que evitou quebra em produção:** fui olhar o código de `fn_upsert_pedido` antes de desenhar o vínculo card ↔ item, e encontrei o `delete from pedido_itens`. O caminho óbvio (foreign key) teria derrubado toda atualização de pedido vinda do Tiny — e a falha só apareceria dias depois, num pedido editado. Registrado como A-09.
- Escrevi 9 migrations idempotentes, prefixo `plt_`, sem tocar em nada existente.

### 2026-08-26 — Teste

- Docker Desktop não sobe a partir desta sessão (precisa da sessão interativa do dono). Troquei para **PGlite**, um Postgres real dentro do Node.
- O teste carrega o **`.sql` real da integração**, aplica as migrations **duas vezes** e compara uma impressão digital (md5 da estrutura) das tabelas existentes antes e depois.
- Tudo verde na primeira rodada completa.

### 2026-08-26 — Aplicação no banco real

- O dono confirmou: o projeto da org **Tech** (`axnzldwgwsmepukdiljx`) é o mesmo que já recebe os pedidos do Tiny, e autorizou mexer nele (D-19).
- Retrato **antes**: 60 colunas, impressão digital `9a61b60d8f5b306ea40acc1704234ea0`, zero tabelas `plt_`.
- 9 migrations aplicadas. Retrato **depois**: impressão digital **idêntica**, contagens idênticas (119/118/191/448/1).
- **Teste de comportamento no banco real, sem sujar o banco:** bloco `do $$ ... $$` que cria o cenário, mede, e termina com `raise exception` proposital — a mensagem carrega o resultado e a exceção desfaz tudo. Resultado: `update: BLOQUEADO | delete: BLOQUEADO | posição: pcp | relógio: true | terminal marca conclusão: true`. **Zero linha gravada.** Registrado como A-11.

### 2026-08-26 — Endurecimento a partir dos advisors

- Rodei os advisors de segurança do Supabase depois do DDL. Três achados reais **nas minhas funções**:
  1. `search_path` mutável em duas funções de trigger;
  2. funções `security definer` chamáveis por `anon` via `/rest/v1/rpc/...`;
  3. as mesmas chamáveis por `authenticated`.
- Causa: eu criei tudo em `public`, e **o Supabase publica o schema `public` inteiro como API REST**. Registrado como E-11.
- Correção: schema **`plt_privado`** para as 7 funções internas, `set search_path` em todas, `grant execute` só para `authenticated` nas funções que as políticas consultam, e revogação total nas funções de trigger. Migrations do repo corrigidas na origem + migration 10 de limpeza, testado local e reaplicado.
- Advisors depois: **zero achado nas tabelas e funções da plataforma**. Restam 5 `INFO` sobre as tabelas da integração terem RLS ligado sem políticas — que é exatamente o desenho da casa (tudo travado, só `service_role` acessa) e não é para mexer.

## Estado final no banco

9 tabelas `plt_*` · 3 visões · 7 funções em `plt_privado` · 21 políticas de RLS · 9 setores · **0 etapas** (D-14) · 0 cards.
Integração do Tiny: **intacta**, conferida por impressão digital de estrutura e por contagem de linhas.

## Pendente

- **Nenhuma etapa interna cadastrada** — de propósito (D-14). O dono cadastra as dele quando a tela de admin existir (SESSAO-14) ou por SQL, se quiser antecipar.
- `SUPABASE_DB_URL` no `.env.local` ainda está com o marcador de senha entre colchetes; por isso o `npm run banco:aplicar` não foi usado nesta sessão (a aplicação foi pela conexão autenticada do Supabase). Basta trocar o marcador pela senha do Postgres para o script funcionar.
- Proteção da branch `main` no GitHub continua pendente do dono.
