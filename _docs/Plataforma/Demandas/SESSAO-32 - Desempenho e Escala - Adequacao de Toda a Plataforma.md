---
titulo: "SESSAO-32 — Desempenho e escala: adequação de toda a plataforma"
tipo: demanda
status: 📐 pronta para code
data: 2026-10-07
atualizado: 2026-10-07
origem: pedido do dono em 07/10/2026 ("TODAS as rotas devem estar otimizadas ao EXTREMO"), pesquisado e auditado no Cowork (código e banco, só leitura)
plano: "[[004 - PLANO - Bloco 6 - Producao de Ponta a Ponta e Kanban Completo]]"
depende: "[[SESSAO-30 - Producao de Ponta a Ponta - Pedido Reabastecimento e Entrega]] e [[SESSAO-31 - Kanban Completo - Card Avulso Janela do Card Anexos e Conversa]] (ordem do dono: esta roda DEPOIS das duas)"
tags: [plataforma, demanda, bloco-6, desempenho, escala, banco, front, tempo-real, autenticacao]
---

# 🎯 SESSAO-32 — Desempenho e escala: adequação de toda a plataforma

> [!important] Leia antes de tudo
> `CLAUDE.md` (ordem de leitura inteira) · **[[PLT - Lei de Desempenho e Escala]] — é a especificação desta sessão; leia duas vezes** · os handoffs das SESSÕES 30 e 31 (o que elas já adequaram **não** se refaz) · [[handoff_2026_09_27_sessao26_chat]] (o padrão de websocket e de leitura por página da casa).
> **Primeiro passo:** conferir no git que a `main` contém as SESSÕES 30 e 31; refazer o **retrato** do §14 da lei no estado de hoje (o que as duas já pagaram sai da lista); branch `sessao-32-desempenho-escala`. Não criar worktree sem ordem do dono.

## O que é

Levar **a plataforma inteira** para dentro da [[PLT - Lei de Desempenho e Escala]]: primeira abertura em **uma requisição**, cada tela em uma, **nenhuma atualização automática por relógio**, tempo real por websocket só para quem precisa, permissões **dentro do token** verificado sem ir ao banco, pacote dividido por tela, listas por cursor, banco com índices, regras de acesso rápidas e estatísticas certas, e as telas lentas do comercial e a gravação do pedido do Tiny dentro do teto. As SESSÕES 30 e 31 adequam o que tocam; **esta adequa todo o resto**.

## 0. Retrato de partida (07/10/2026 — refazer no início da sessão)

O §14 da lei, resumido: **35 relógios** de 15 a 60 s em 15 telas · **`postgres_changes` na tabela de cards inteira** em 3 telas (a consulta que mais consome o banco: 233 mil execuções) · **~13 requisições** na primeira abertura, com cascata · **pacote único de 1,8 MB** · portas lentas (comercial até 4,3 s; gravação do pedido do Tiny até 3,7 s) · relógios do banco **a cada minuto** · permissão consultada na tabela de usuários a cada chamada · 33 chaves estrangeiras sem índice, 9 tabelas com duas políticas permissivas, 2 índices duplicados, 18 sem uso · estatísticas erradas (eventos: 4 × 4.706; logs: 106 × 7.185) · histórico do cron com 30 MB · ~20 portas por deslocamento · presença gravada a cada 5 min.

## 1. O que construir (uma frente por tarefa do ClickUp)

### 1.1 Primeira abertura em uma requisição
- **Porta de abertura** única: perfil, setores/vínculos, permissões, menu, contadores do sino e do chat, bolinha de execução e os dados do Meu Painel. Fim da cascata perfil → vínculos.
- Cada tela restante (Meu Painel, Afazeres, Afazeres do time, Visão do dia e os outros painéis, Expedição, Danificados, Painel admin do estoque, Automações, Auditoria, Equipe, Comercial) abre com **1 requisição**; o resto só no clique.

### 1.2 Permissões no token, sem consultar o banco
- Ligar as **chaves de assinatura assimétricas** do Auth (ação no painel da Supabase — com o dono) e trocar `getUser()`/leituras de "quem sou eu" por **`getClaims()`** (verificação local); Edge Functions verificando o token localmente.
- **Custom Access Token Hook** com id da plataforma, papel, super admin, setores, módulos e ativo; `fn_eh_admin`, `fn_setores_do_usuario`, `fn_usuario_atual` e as políticas passam a ler **do token**, embrulhadas em `(select …)`.
- Mudou papel/setor/ativo → força a renovação; tempo de inatividade da sessão configurado (pergunta 2).

### 1.3 Tempo real por websocket no resto da plataforma
- Sai todo `refetchInterval` que sobrou (Meu Painel, Afazeres, bolinha de execução, Visão do dia — 7 consultas —, Expedição, Danificados, Painel admin do estoque) e os `postgres_changes` que sobraram (Meu Painel, Visão do dia); **tirar `plt_cards` da publicação do Realtime** quando ninguém mais escutar.
- Tópicos estreitos e privados; payload mínimo; leitura de recuperação ao reconectar; "ao vivo pausado" + botão "atualizar" quando o websocket cair.
- **Presença** pela Presence do Realtime (ou carimbo no gesto) — fim da gravação a cada 5 min.

### 1.4 Pacote dividido por tela
- `React.lazy` em **todas** as rotas; gráficos (Recharts), mapa (Leaflet), canvas das automações, módulo Comercial e leitor de planilha só no pedaço que usa.
- **Teto de pacote no build** (JS inicial ≤ 250 KB comprimido — falha acima); pré-carregar o pedaço de código na intenção (passar o mouse) — nunca dado.
- Medição real dos tablets (Web Vitals/Speed Insights da Vercel — pergunta 4).

### 1.5 Telas lentas do comercial e a gravação do pedido do Tiny
- Comercial: clientes consolidados (1,1 s), filtro de clientes (até 4,3 s), painéis (0,5–1 s) → projeções/resumos prontos e índices; **≤ 50 ms** nas telas, **≤ 150 ms** nos painéis, com volume ×100.
- `fn_upsert_pedido` (0,85 s em média, até 3,7 s): enxugar o caminho quente sem regredir a blindagem dos gatilhos de `pedidos` (D-43) nem a integração (impressão digital idêntica).

### 1.6 Banco: índices, políticas de acesso e estatísticas
- Índice nas **33 chaves estrangeiras**; unir as **9 políticas permissivas duplicadas**; `(select …)` e `TO authenticated` em todas as políticas; os **2 índices duplicados** e os **18 sem uso** removidos **com o OK do dono** (regra 3).
- **Estatísticas:** rodar `ANALYZE` e **descobrir por que** o planejador acha 4 linhas nos eventos e 106 nos logs (e impedir que volte).
- **Limpeza do histórico do cron** (30 MB) com retenção; plano de crescimento das tabelas que só aumentam (índice por data; partição por mês quando passar de milhões; retenção do que é ruído).
- `statement_timeout` próprio nas portas de tela.

### 1.7 Rotinas do banco por evento, sem relógio
- As que acordam a cada minuto para ver se há trabalho — reservas do estoque, despacho de webhooks, disparo do comercial — e as fotos a cada 5 min passam a nascer **do fato** (gatilho → fila → chamada). Relógio só para o que é de calendário.
- Fila com nova tentativa, espera crescente com sorteio, lugar para o que falhou; chamada externa com tempo limite e disjuntor.

### 1.8 Listas por cursor
- As ~20 portas por deslocamento: as de lista que cresce sem fim passam a **cursor** com índice composto; deslocamento só onde "pular de página" é necessário e a lista é limitada; **teto de página no banco**.

### 1.9 Prova de carga
- Teste de carga com **30 tablets + 10 escritórios simultâneos, folga ×10**, nas telas mais usadas (quadros, PCP, Meu Painel, chat) — resultado no handoff. (Ferramenta: k6 ou equivalente — decisão técnica no (c).)

## 2. Decisões que regem esta demanda

Regra 17 · **regra 18 — [[PLT - Lei de Desempenho e Escala]]** · regra 19 (ClickUp) · D-43 (blindagem dos gatilhos de `pedidos`) · D-67 (websocket e leitura por página) · D-68 (dados sensíveis fora da API — o token não leva dado pessoal) · D-80 (relógio à toa vetado) · D-91 (tipos de usuário e módulos) · RNF-02 · RNF-05 · M-04 · M-13.

## 3. Perguntar ao dono no início da sessão (ritual de sempre; só codar com o OK)

**Já respondida (07/10):** esta sessão roda **depois** da 30 e da 31; elas já adequam o que tocam.

1. **Chaves assimétricas e o gancho do token** precisam ser ligados no painel da Supabase — você liga junto comigo, ou me dá o OK para eu guiar passo a passo?
2. **Quanto tempo uma pessoa parada continua logada?** (Proposta: 12 h nos tablets do galpão — um turno — e 8 h no escritório.)
3. **Remover os índices duplicados e os sem uso** (é mudança de estrutura do banco — regra 3)?
4. **Medição de velocidade nos tablets** (Speed Insights da Vercel) — pode ligar? Pode ter custo no plano da Vercel.
5. **Teste de carga:** pode rodar contra o banco de produção numa janela combinada, ou só contra uma cópia?

## 4. Fora do escopo

Tudo o que as SESSÕES 30 e 31 já adequaram · publicação definitiva nos tablets ([[SESSAO-08 - Publicacao no Ar]]) · modo sem internet (Q-60) · trocar de provedor (Supabase/Vercel) · reescrever regras de negócio (só o caminho muda, o resultado é o mesmo).

## 5. Critérios de aceite

- [ ] **Primeira abertura = 1 requisição de dados** + o websocket pessoal (aba Network, cache vazio).
- [ ] **Toda tela abre com 1 requisição**; dado escondido só no clique — tabela tela × nº de requisições no handoff.
- [ ] **Busca no código:** zero `refetchInterval`, zero `setInterval` buscando dado, zero `postgres_changes`; `plt_cards` fora da publicação do Realtime (ou justificado).
- [ ] **Token:** `getClaims()` verificando localmente (sem chamada ao Auth por tela — Network); políticas lendo do token; nenhuma consulta a `plt_usuarios` para saber papel/setor numa leitura comum.
- [ ] **Pacote:** JS inicial ≤ 250 KB comprimido; cada tela em pedaço próprio; teto no build.
- [ ] **Portas:** nenhuma porta de tela acima de 50 ms (p95) nem painel acima de 150 ms com volume ×100 — `pg_stat_statements` antes/depois no handoff.
- [ ] **Advisors de desempenho** zerados (ou cada item restante justificado e aprovado).
- [ ] Estatísticas certas nas tabelas de eventos e de logs, com a causa explicada e corrigida.
- [ ] Nenhum relógio que acorda para ver se há trabalho; o que sobrou de relógio é de calendário.
- [ ] Listas que crescem por cursor; teto de página no banco.
- [ ] Teste de carga com o resultado no handoff (tempos p95 e erros com 40 usuários e com ×10).
- [ ] Core Web Vitals no p75 dos tablets: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 (se a medição for ligada — pergunta 4).
- [ ] Integração do Tiny com estrutura e linhas idênticas antes/depois de cada atualização do banco.
- [ ] O §14 da lei atualizado: dívida paga marcada, dívida que sobrou com o porquê e o OK do dono.
- [ ] Tarefas do ClickUp em FAZENDO ao começar e **nunca** concluídas pelo Claude Code; o dono avisado de cada uma.

## 6. Notas para o Claude Code

- **Mudar o caminho, nunca o resultado:** cada porta refeita tem teste no harness provando que devolve **o mesmo** que a antiga (antes de apagar a antiga).
- Uma frente por vez, cada uma publicada e conferida com o dono antes da próxima (sugestão: 1.6 banco → 1.2 token → 1.1 abertura → 1.3 tempo real → 1.4 pacote → 1.5 portas lentas → 1.7 rotinas → 1.8 cursor → 1.9 carga).
- Migrações sem travar (§7.6 da lei): `create index concurrently`, `lock_timeout`, `not valid` + `validate`; aplicar banco e publicar tela num gesto só (E-73).
- Token: **nunca** pôr dado pessoal no token (D-68); o gancho roda na renovação — tempo curto de token e renovação automática.
- Ritual completo: (a)(b)(c) antes de codar, task list espelho, memória em `_docs/Plataforma/Execucao/SESSAO-32.md`, E-NN/A-NN na hora, handoff.
- **Checklist final obrigatório, item a item:** `npm run test:banco` (2 rodadas) · `npx tsc -b` · `npm run lint` · `npm test` · `npm run build` (com o teto de pacote) · celular 375 px e tablet 768 px · checkpoint antes de aplicar (F-08) · `get_advisors` (segurança e desempenho) · checklist de desempenho da lei (§12) · `pg_stat_statements` antes/depois · task list conferida · tarefas do ClickUp em FAZENDO e o dono avisado · handoff + mapa + próximos passos + ordem das sessões.

## Tarefas no ClickUp (regra 19)

Lista **PRODUÇÃO** (DPTO TI). Ao começar cada uma → **FAZENDO**. **Nunca** mover para concluído: ao terminar, avisar o dono e deixar um comentário curto na tarefa — **quem conclui é o dono**.

- [Desempenho - Primeira abertura em uma requisição](https://app.clickup.com/t/17tya50fm3v) — §1.1
- [Desempenho - Permissões no token, sem consultar o banco](https://app.clickup.com/t/17tya50fm3x) — §1.2
- [Desempenho - Tempo real por websocket no lugar das atualizações automáticas](https://app.clickup.com/t/17tya50fm3w) — §1.3
- [Desempenho - Pacote dividido por tela](https://app.clickup.com/t/17tya50fm3y) — §1.4
- [Desempenho - Telas lentas do comercial e gravação do pedido do Tiny](https://app.clickup.com/t/17tya50fm3z) — §1.5
- [Desempenho - Banco: índices, políticas de acesso e estatísticas](https://app.clickup.com/t/17tya50fm40) — §1.6
- [Desempenho - Rotinas do banco por evento, sem relógio](https://app.clickup.com/t/17tya50fm41) — §1.7
- [Desempenho - Listas por cursor](https://app.clickup.com/t/17tya50fm42) — §1.8 (a prova de carga do §1.9 vai junto do fechamento)

## Resultado (preencher ao entregar)

*O que foi feito, o que mudou de rota, link do handoff.*

## Ver também

[[PLT - Lei de Desempenho e Escala]] · [[004 - PLANO - Bloco 6 - Producao de Ponta a Ponta e Kanban Completo]] · [[SESSAO-30 - Producao de Ponta a Ponta - Pedido Reabastecimento e Entrega]] · [[SESSAO-31 - Kanban Completo - Card Avulso Janela do Card Anexos e Conversa]] · [[SESSAO-08 - Publicacao no Ar]]
