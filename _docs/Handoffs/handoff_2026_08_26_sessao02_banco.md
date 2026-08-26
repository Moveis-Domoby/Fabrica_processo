---
titulo: Handoff — SESSAO-02 Banco e Domínio no Supabase
tipo: handoff
data: 2026-08-26
atualizado: 2026-08-26
tags: [handoff, sessao, plataforma, supabase, banco]
---

# 📋 Handoff — SESSAO-02 · Banco e Domínio no Supabase

**Branch:** `sessao-02-banco-dominio` · **Repositório:** `contatodomoby/Fabrica_processo`
**Banco:** projeto `axnzldwgwsmepukdiljx` (org **Tech**) — **o mesmo que já recebe os pedidos do Tiny**
**Demanda:** [[SESSAO-02 - Banco e Dominio no Supabase]] · **Memória de execução:** `docs/execucao/SESSAO-02.md`

## 1. Objetivo da sessão

Modelar todo o domínio da plataforma como migrations SQL versionadas. A demanda dizia "sem aplicar em produção" — mas no meio da sessão o dono conectou o Supabase da org Tech e autorizou: *"esse será o banco de produção, mas por enquanto podemos mexer nele à vontade"*. Isso virou a **D-19**, e as migrations foram aplicadas.

O dono também respondeu a Q-28, que estava travando o desenho dos fins de linha: *"coloque o setor de rotas nos primórdios de criação então"* → **D-18**.

## 2. O que foi feito

### Banco

**9 tabelas**, todas com prefixo `plt_`, **sem alterar nada da integração**:

| Tabela | O que guarda |
|---|---|
| `plt_usuarios` | pessoas; login **opcional** (operador de tablet usa PIN — D-06); `pin_hash` guarda hash |
| `plt_usuario_setores` | quem trabalha em qual setor, e quem é líder dele |
| `plt_setores` | setores; entrada / produção / terminal (D-13) |
| `plt_etapas` | etapas internas de cada setor — **vazia de propósito** (D-14) |
| `plt_cards` | cards de pedido e de unidade (D-01) |
| `plt_eventos` | **append-only** — a tabela-mãe (RNF-05) |
| `plt_notificacoes` | avisos a líder/admin (D-09 / Q-18) |
| `plt_tarefas` | afazeres e delegação (RF-40 a RF-43) |
| `plt_visualizacoes` | painéis salvos (RF-33) |

**3 visões**, todas derivadas de evento — nada de número guardado:

- `plt_vw_permanencias` — tempo do card em cada etapa; separa o que é **fila (do setor)** do que é trabalho
- `plt_vw_execucoes` — do "iniciar" ao "finalizar": **o tempo que tem dono**
- `plt_vw_qualidade_transicoes` — a dupla atestação da D-09, com divergência já calculada

**Schema `plt_privado`** com as 7 funções internas, fora da API REST. **21 políticas de RLS**: operador vê os setores dele, líder vê o setor completo, admin vê tudo.

**Seed:** 9 setores — PCP (entrada) · SECC · CNC · FITAMENTO · FURAÇÃO · MONTAGEM · LIMPEZA E EMBALAGEM · ESTOQUE e ROTAS (terminais). **Zero etapas internas**, e METALURGICA de fora — as duas coisas de propósito.

### Front

Nada. Fora do escopo desta demanda.

## 3. Decisões tomadas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| **Card sem foreign key para `pedido_itens`** | FK "correta" para a linha do item | `fn_upsert_pedido` **apaga e regrava** os itens a cada atualização do Tiny. A FK derrubaria toda atualização de pedido **em produção** |
| Posição do card escrita **só por trigger** | deixar o app escrever a posição | evento é a verdade; a coluna existe só para a tela ser rápida |
| Append-only por **trigger** | só políticas de RLS | a chave do n8n (`service_role`) **ignora RLS** por natureza do Postgres |
| Qualidade como **visão** | tabela com "parecer" preenchido depois | tabela exigiria editar a linha quando o parecer chegasse — estado mutável no meio da auditoria |
| Tempo como **visão** | colunas de duração | número guardado é número que alguém "arruma" depois |
| Funções em **`plt_privado`** | funções em `public` | o Supabase publica `public` inteiro como API: função lá vira endpoint sem ninguém pedir |
| Etapas **sem nenhum seed** | semear "fila → execução → finalizado" | D-14: o dono cadastra as etapas dele; chutar gera trabalho de desfazer |

## 4. Bugs

### Resolvidos
Nenhum de produção.

### Descobertos e corrigidos na hora
Os advisors de segurança do Supabase apontaram **três achados nas minhas próprias funções** (search_path mutável, e funções chamáveis via `/rest/v1/rpc` por `anon` e por `authenticated`). Corrigido movendo tudo para `plt_privado` e fixando `search_path`. **Advisors agora: zero achado na plataforma.** Registrado como E-11 na memória de aprendizado.

## 5. Arquivos alterados

```
supabase/migrations/20260824120000_plt_pessoas.sql
supabase/migrations/20260824120100_plt_estrutura.sql
supabase/migrations/20260824120200_plt_cards.sql
supabase/migrations/20260824120300_plt_eventos.sql
supabase/migrations/20260824120400_plt_qualidade_notificacoes.sql
supabase/migrations/20260824120500_plt_tarefas_visualizacoes.sql
supabase/migrations/20260824120600_plt_visoes_tempo.sql
supabase/migrations/20260824120700_plt_rls.sql
supabase/migrations/20260824120800_plt_seed_setores.sql
supabase/migrations/20260824120900_plt_limpeza_funcoes_expostas.sql
supabase/testes/testar-migrations.mjs      (npm run test:banco)
supabase/testes/testar-migrations.sh       (mesmo teste, em Docker)
supabase/aplicar-migrations.mjs            (npm run banco:aplicar)
docs/modelo-de-dados.md
docs/execucao/SESSAO-02.md
.env.example
package.json
```

## 6. Impacto nos números visíveis

**Nenhum.** As tabelas da integração foram conferidas antes e depois da aplicação: estrutura com **impressão digital idêntica** (`9a61b60d8f5b306ea40acc1704234ea0`) e contagens intactas — clientes 119 · pedidos 118 · pedido_itens 191 · eventos 448 · gp_pcp_processados 1.

As tabelas novas estão **vazias** (0 cards, 0 eventos), tirando os 9 setores do seed.

## 7. Notas do cofre atualizadas

- [[SUPA - Esquema do Banco]] — seção nova com o inventário da plataforma e os dois avisos que valem ouro; `gp_pcp_processados` marcada como aplicada; o "o que NÃO existe" foi revisado sem apagar o original
- `supabase-fabrica-schema.sql` — seção §8 com o inventário e o ponteiro para as migrations do repo
- [[SUPA - Visao Geral]] — identificação do projeto e região corrigidas (a nota dizia `sa-east-1`; é `ca-central-1`)
- [[PLT - Decisoes de Produto]] — **D-18** (ESTOQUE e ROTAS nascem juntos) e **D-19** (banco de produção é onde se trabalha por ora; revisa a parte de "banco de dev" da D-15)
- [[PLT - Perguntas em Aberto]] — **Q-28 ✅**
- [[PLT - Memoria de Aprendizado]] — E-11, A-09, A-10, A-11, M-13, M-14, F-08
- [[000 - ORDEM DAS SESSOES]] — SESSAO-02 entregue

## 8. Ficou pendente

- **Nenhuma etapa interna cadastrada.** É de propósito (D-14): o sistema entrega o cadastro vazio e você cadastra as etapas de cada setor. Sem tela de admin ainda (SESSAO-12), então ou esperamos, ou eu te ajudo a cadastrar por SQL quando quiser.
- **`SUPABASE_DB_URL` no `.env.local`** ainda está com o marcador de senha entre colchetes (`[...]`). Troque pelo valor real (Supabase → Settings → Database → Database password) e o `npm run banco:aplicar` passa a funcionar. Nesta sessão a aplicação foi pela conexão autenticada do Supabase, que não precisa dessa senha.
- **Proteção da branch `main`** no GitHub (Settings → Branches) continua pendente.

### Aguardando decisão de negócio

- **Q-21** (unidade que gera trabalho paralelo), **Q-22** (terceirizados), **Q-23** (produção para estoque), **Q-24** (cancelamento de pedido), **Q-25** (migração dos cards vivos). **Nada foi inventado para nenhuma delas** — quando forem decididas, entram como acréscimo ao modelo.
- **Q-30** (modo escuro) — tokens prontos desde a SESSAO-01, falta a decisão.

### Próximo passo sugerido

[[SESSAO-03 - Autenticacao Perfis e Permissoes]]: login, convites e os papéis operador/líder/admin — o lugar já existe no banco, falta o mecanismo.

## 9. Como validar

### Sem tocar em banco nenhum

```bash
npm run test:banco
```

Sobe um Postgres real dentro do Node, carrega **o `.sql` da integração de produção**, aplica as 10 migrations **duas vezes** e verifica 15 pontos. Esperado: tudo verde.

### Olhando o banco de verdade

No Supabase → **Table Editor**, confira que existem as 9 tabelas `plt_*` e que `plt_setores` tem estas 9 linhas, nesta ordem:

**PCP** (entrada) · SECC · CNC · FITAMENTO · FURAÇÃO · MONTAGEM · LIMPEZA E EMBALAGEM (produção) · **ESTOQUE** e **ROTAS** (terminais)

E que `plt_etapas` está **vazia** — é o esperado (D-14).

No **SQL Editor**, para provar que evento não se apaga:

```sql
select count(*) from public.pedidos;
```

Deve continuar **118**. E o teste do append-only, que se desfaz sozinho:

```sql
do $$
declare v_card bigint; v_u text := 'PASSOU (RUIM)';
begin
  insert into public.plt_cards (tipo, pedido_id)
    values ('pedido', (select id from public.pedidos order by id limit 1)) returning id into v_card;
  insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
    values (v_card, 'card_criado', (select id from public.plt_setores where codigo='pcp'), 'api');
  begin update public.plt_eventos set observacao='x' where card_id=v_card;
  exception when others then v_u := 'BLOQUEADO'; end;
  raise exception 'update em evento: % (esta excecao e proposital e desfaz o teste)', v_u;
end $$;
```

Esperado: um erro dizendo **`update em evento: BLOQUEADO`**. O erro é o resultado — e ele desfaz tudo, não fica nada gravado.

### Verificação já executada nesta sessão

| Verificação | Resultado |
|---|---|
| Migrations duas vezes seguidas | ✅ sem erro |
| Estrutura da integração antes × depois | ✅ impressão digital idêntica |
| Contagens da integração antes × depois | ✅ 119 / 118 / 191 / 448 / 1 |
| `UPDATE` e `DELETE` em evento, **no banco real** | ✅ recusados |
| Posição do card projetada pelo evento | ✅ sem escrita manual |
| Setor terminal marca o card como concluído | ✅ |
| Itens de pedido apagados e regravados com card vivo | ✅ integração do Tiny não quebra |
| Advisors de segurança do Supabase | ✅ zero achado na plataforma |
| Seed | ✅ 9 setores, **0 etapas**, sem METALURGICA |

## Ver também

[[SESSAO-02 - Banco e Dominio no Supabase]] · [[SUPA - Esquema do Banco]] · [[PLT - Decisoes de Produto]] · [[handoff_2026_08_24_sessao01_fundacao]]
