---
titulo: Handoff — SESSAO-54 · Comercial com as janelas e os avisos da plataforma no lugar dos alertas do navegador, a função antiga pronta para sair e a tabela de clientes ordenando no banco
tipo: handoff
data: 2026-11-18
atualizado: 2026-11-18
tags: [handoff, sessao-54, comercial, debito-tecnico, modal, banco]
---

# 📋 Handoff — SESSAO-54 · Comercial: janelas da plataforma e limpeza da função antiga (18/11/2026, madrugada)

Demanda: [[SESSAO-54 - Comercial - Janelas da Plataforma e Limpeza da Funcao Antiga]] · Diário: [[SESSAO-54]] · Débito: [[PLT - Comercial - Debito Tecnico]] (DT-D24, DT-BD4, DT-G16, DT-D39)

> 🔶 **Feito no ramo `sessao-54-comercial-janelas-e-limpeza`, esperando a revisão do dono.** Nada na main, nada publicado, **nada aplicado no banco** — as duas atualizações do banco estão só em arquivo. Sessão da fila, sem o dono na conversa: o que precisou de escolha virou **decisão provisória** (§3). O ClickUp não foi tocado.

## 1. Objetivo da sessão

O débito técnico do Comercial, conferido em 18/11:
1. trocar os 16 alertas e perguntas do navegador (em duas telas) pelas janelas e avisos da plataforma, sem mudar o que cada escolha faz;
2. provar que a função antiga `fn_dashboard_transitions` não é usada e deixar a remoção pronta em arquivo (aplicar é com o OK do dono — é exclusão);
3. se coubesse, levar a ordenação da tabela de clientes para o banco mantendo a porta compatível. **Coube.**

## 2. O que foi feito

### Front (só `src/comercial/`)
- **`components/ModalConfirmacao.tsx` (novo):** a janela de confirmação do Comercial, montada com o `<Modal>` e o `<Botao>` da casa — a pergunta no título, o aviso no corpo, "Voltar" e o verbo do gesto (botão de toque) no rodapé; vermelho quando destrói; no celular sobe do rodapé.
- **`components/ListasDisparo/ListasDisparoDetalhe.tsx`:** as 4 perguntas (parar o disparo, encerrar a lista, excluir a lista, remover membros) abrem a janela; os 10 alertas viraram o aviso da casa (`useNotificacao`). O código de cada gesto é o de antes. A linha de botões de "Membros da Lista" agora quebra no celular (o "Disparar" ficava cortado em 375 — DT-D39).
- **`components/CustomersTable.tsx`:** os 2 alertas viraram aviso; a ordem escolhida vai para o banco e a tabela volta à página 1 ao trocá-la.
- **`hooks/useCustomersPaginated.ts`:** manda a ordem dentro dos filtros (chave `sortOrder`).
- **Zero** `alert()`/`confirm()` em `src/comercial/`.

### Banco (só em arquivo — nada aplicado)
- **`20261118120000_plt_comercial_remove_funcao_antiga.sql`** — remove `fn_dashboard_transitions(timestamptz, timestamptz)`, sem `cascade`. **É exclusão.**
- **`20261118120100_plt_comercial_clientes_ordem_no_banco.sql`** — `fn_filter_customers` recriada a partir da última versão (`20261016110000`), lendo a ordem de dentro dos filtros; **mesma assinatura**; sem a chave, devolve linha a linha o que devolvia.
- **`supabase/testes/testar-migrations.mjs`** — 13 conferências novas (faixa de pedidos `9954001–9954320`), 2 antigas ajustadas porque a função removida deixou de existir, e o ensaio de volume opcional (`PLANO54=1`).

### Edge Functions
Nenhuma.

### A prova de que nada chama a função antiga
- **Telas:** nenhuma chamada em `src/` (o gráfico usa `fn_dashboard_transitions_summary`; o detalhe usa `fn_dashboard_transition_clients` — as duas ficam). O gancho antigo (`useTransitionData.ts`) nunca veio para este repositório: não havia nada morto para apagar.
- **Funções de borda, manutenção, pendentes e scripts do repositório:** nenhuma ocorrência.
- **Migrations:** só a própria definição (3 versões) e as permissões dela.
- **Banco de teste:** nenhuma função, view ou política cita o nome (conferência nova da bateria).
- ⚠️ **Fora do alcance do código:** as funções de borda do disparo e os fluxos do n8n não estão neste repositório — conferir no banco vivo (§6, passo 0).

### Fotos (vitrine — as telas de verdade com dados de exemplo; nomes e números inventados)

| Cena | Celular (375) | Tablet (768) | Computador (1440) |
|---|---|---|---|
| A lista de disparo | ![[sessao54-lista-01-tela-375.png]] | ![[sessao54-lista-01-tela-768.png]] | ![[sessao54-lista-01-tela-1440.png]] |
| Excluir a lista | ![[sessao54-lista-02-excluir-375.png]] | ![[sessao54-lista-02-excluir-768.png]] | ![[sessao54-lista-02-excluir-1440.png]] |
| Remover membros | ![[sessao54-lista-03-remover-membros-375.png]] | ![[sessao54-lista-03-remover-membros-768.png]] | — |
| Parar o disparo | ![[sessao54-lista-04-parar-disparo-375.png]] | ![[sessao54-lista-04-parar-disparo-768.png]] | — |
| Encerrar a lista | ![[sessao54-lista-05-encerrar-375.png]] | ![[sessao54-lista-05-encerrar-768.png]] | — |
| Aviso "mensagem salva" | ![[sessao54-lista-06-aviso-salvo-375.png]] | ![[sessao54-lista-06-aviso-salvo-768.png]] | — |
| Aviso de erro | ![[sessao54-lista-07-aviso-erro-375.png]] | ![[sessao54-lista-07-aviso-erro-768.png]] | — |
| Tabela de clientes | ![[sessao54-clientes-01-tabela-375.png]] | ![[sessao54-clientes-01-tabela-768.png]] | — |
| "Mais antiga primeiro" | ![[sessao54-clientes-02-mais-antiga-primeiro-375.png]] | ![[sessao54-clientes-02-mais-antiga-primeiro-768.png]] | ![[sessao54-clientes-02-mais-antiga-primeiro-1440.png]] |

*(As fotos de 375 têm uma faixa branca à direita: o navegador sem janela não abre mais estreito que 500 — a tela de dentro está nos 375 exatos.)*

## 3. Decisões provisórias (o dono confirma ou muda)

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| **P54-1** · Janela de confirmação: pergunta no título, aviso no corpo, "Voltar" + o verbo do gesto. Vermelho em excluir, encerrar e remover; amarelo em "Parar o disparo" | Tudo vermelho | Parar o envio não destrói nada; o modelo de sistema reserva o vermelho para destruir |
| **P54-2** · Avisos: sucesso verde, erro vermelho com a mensagem do banco embaixo, atenção amarelo; somem em 5 s | Manter o erro na tela até fechar | É o aviso padrão da casa; o alerta do navegador prendia a tela até o "OK" |
| **P54-3** · Texto novo em "remover membros": "Quem for removido sai desta lista e não recebe o disparo dela." | Deixar o corpo da janela vazio | O navegador só perguntava "Tem certeza?"; a janela pede dizer o que acontece |
| **P54-4** · Erros de "parar o disparo" e "encerrar" com título próprio | Manter "Erro: …" genérico | O aviso tem título e descrição; "Erro" sozinho não diz de quê |
| **P54-5** · Durante o gesto a janela fica aberta com o botão girando, e fecha ao terminar | Fechar na hora (como o navegador) | Regra da casa: botão que toca a rede mostra que está trabalhando |
| **P54-6** · Trocar a ordem da tabela volta à página 1; cliente sem data de compra fica no fim no "mais antiga primeiro" | Ficar na página em que estava | A ordem muda o resultado inteiro — a página 3 de uma ordem não tem relação com a página 3 da outra |
| **P54-7** · A ordem viaja dentro dos filtros (`sortOrder`), não como parâmetro novo da porta | Parâmetro `p_ordem` (exigiria apagar e recriar a função, e amarraria a ordem banco → site) | Mantém a porta compatível nos dois sentidos: site de hoje × banco novo e site novo × banco de hoje |

## 4. Bugs

### Resolvidos (no ramo — marcar ✅ no débito quando subir)
- **DT-D24** — alertas e perguntas nativos no Comercial.
- **DT-G16** — "mais antiga primeiro" invertia só a página.
- **DT-BD4** — a remoção está pronta em arquivo; **resolve quando o dono autorizar a aplicação**.

### Descobertos
- **DT-D39** — no celular, o "Disparar" ficava cortado na linha de botões da lista de membros. Corrigido no ramo.
- **Dívida de desempenho (já existia; medida agora):** com 100× o volume, `fn_filter_customers` passa do teto de 50 ms — conta e ordena o resultado inteiro a cada página, pagina por deslocamento e não tem teto de página. A mudança desta sessão não acrescenta custo (tabela no diário). Fica para uma sessão própria.

## 5. Como testar (passo a passo — depois de subir, ou no ramo com `npm run dev`)

**A lista de disparo** (Comercial → Listas → abrir uma lista de teste em rascunho):
1. Toque em **Excluir** → abre a janela "Excluir esta lista?" com o aviso de sempre. Toque em **Voltar** → a janela fecha e a lista continua lá. Feche também pelo X e tocando fora: nada acontece.
2. Toque em **Remover**, marque um membro, toque em **Remover da lista (1)** → janela "Remover 1 membro da lista?". **Voltar** → o membro continua marcado. De novo, **Remover da lista** → o membro sai e a seleção fecha.
3. Escreva algo na mensagem de referência e toque em **Salvar** → aviso verde "Mensagem salva com sucesso!" (canto de baixo no computador, topo no celular). Toque em **Copiar** → aviso verde "Mensagem copiada!".
4. Numa lista **em andamento**: **Parar contagem e encerrar lista** → janela "Encerrar a lista completamente?" (botão vermelho). **Voltar** não encerra.
5. Numa lista **disparando** (só se houver uma de teste): **Finalizar disparo** → janela "Parar o disparo agora?". **Voltar** não para.
6. Só no fim, numa lista de teste: **Excluir** → **Excluir a lista** → volta para a tela das listas e a lista sumiu.
7. Em nenhum passo aparece a caixa cinza do navegador.

**A tabela de clientes** (Comercial → Painel de Recompra):
8. Toque em **Listas** → os botões "Nova lista (0)" e "Adicionar…" nascem desligados (como antes); marcando clientes, funcionam como antes.
9. Toque no título **Compra no Período** (no celular, "Ordenar por data") → a tabela vai para a página 1 e mostra os clientes de compra **mais antiga de todo o resultado**; "Próxima" segue em ordem crescente. *(Só depois da atualização do banco; antes dela, a tela faz o que sempre fez — inverte a página.)*
10. Toque de novo → volta à mais recente primeiro.

**Celular e tablet:** repetir os passos 1, 2 e 9 com a janela em 375 e 768 — nada de rolagem para o lado; a janela sobe do rodapé no celular e centraliza no tablet.

## 6. Para ligar com o dono (ordem, com conferência antes e depois)

> Nada aqui foi feito. As duas atualizações do banco são independentes; a do site pode subir antes ou depois da ordenação (a tela tolera o banco de antes).

**Passo 0 — conferir, só lendo (banco vivo):**
- a) *A função de clientes no banco é a que a migration tomou por base?* Comparar o corpo vivo com o da `20261016110000`:
  `select md5(pg_get_functiondef('public.fn_filter_customers(jsonb, integer, integer)'::regprocedure));` — e conferir se nenhuma outra frente a recriou depois de 16/10.
- b) *Alguém depende da função antiga?*
  `select classid::regclass, objid, deptype from pg_depend where refobjid = 'public.fn_dashboard_transitions(timestamptz, timestamptz)'::regprocedure;` (esperado: nenhuma linha de dependência normal)
  `select proname from pg_proc where prosrc ~ 'fn_dashboard_transitions(?!_summary)\M';` (esperado: só ela mesma)
- c) *Alguém a chamou?* `select calls from pg_stat_user_functions where funcname = 'fn_dashboard_transitions';` (se a contagem de funções estiver ligada) e, nos registros da API, procurar `rpc/fn_dashboard_transitions` **sem** `_summary` nos últimos dias.
- d) *As funções de borda do disparo e o n8n* (não estão no repositório): procurar o nome `fn_dashboard_transitions` no código das funções `disparar-membro-individual`, `enviar-proximo-disparo`, `verificar-vendas-disparo`, `processar-timers-disparo`, `webhook-datacrazy-resposta` e nos fluxos do n8n.

**Passo 1 — a ordenação da tabela** (`20261118120100_plt_comercial_clientes_ordem_no_banco.sql`, só ela: `--so`):
- antes: guardar `select nome_cliente, telefone_cliente from fn_filter_customers('{}'::jsonb, 50, 0);`
- depois: a mesma consulta devolve **as mesmas 50 linhas na mesma ordem**; com `'{"sortOrder":"asc"}'` devolve os de compra mais antiga; `explain analyze` das duas para o tempo de verdade.

**Passo 2 — publicar o site** (o ramo na main, no momento combinado) e fazer o roteiro do §5.

**Passo 3 — a remoção da função antiga** (`20261118120000_plt_comercial_remove_funcao_antiga.sql`, só ela: `--so`) — **exclusão, só com o OK explícito**:
- antes: o passo 0 (b, c, d) limpo;
- depois: `select to_regprocedure('public.fn_dashboard_transitions(timestamptz, timestamptz)');` → nulo; abrir o Dashboard do Comercial e conferir o gráfico de transições e o detalhe ao tocar numa barra.
- voltar atrás, se preciso: recriar pelo trecho da função na `20261016110000` + as permissões da `20260915120000`.

**Depois de subir:** marcar ✅ em DT-D24, DT-G16, DT-BD4 e DT-D39 no débito técnico; tirar a linha da função legada do domínio de dados do Comercial; o dono conclui a tarefa do ClickUp.

## 7. Verificação (critérios de aceite)

- ✅ **Zero `alert()`/`confirm()` no Comercial** (busca vazia em `src/comercial/`); cada confirmação na janela da casa, com o mesmo efeito (7 testes: "Voltar" não faz nada; confirmar faz o gesto de antes; erro vira aviso; nenhuma chamada nativa).
- ✅ **A migration de remoção pronta em arquivo e a prova de que nada chama a função** (§2).
- ✅ **Lint, build e testes:** `tsc` 0 · lint 0 · vitest 115 arquivos / 729 testes ✔ (os 3 do Comercial: 12 ✔) · montagem ok.
- ✅ **Bateria do banco:** 1.886 ✔ + 1 ✘ que já existia (o painel do Dashboard, registrado desde a SESSAO-51); as 13 conferências novas verdes.
- ✅ **375 e 768 sem rolagem lateral:** 27 medições (9 cenas × 375/768/1440), nenhuma com rolagem lateral nem janela passando da tela.
- ⚠️ **Não conferido:** o app de verdade, logado (não há login nesta mesa) — as telas foram vistas na vitrine, sem a casca (menu e barra do topo). O banco vivo não foi lido.

## 8. Desempenho (Lei — checklist)

- **Requisições:** nenhuma a mais. Trocar a ordem da tabela = 1 requisição (a página nova), como trocar de página.
- **Busca no código:** nenhum relógio de busca, `refetchInterval` ou `postgres_changes` novo.
- **Porta tocada (`fn_filter_customers`):** ensaio com ~100× o volume, porta de antes × de agora — sem custo a mais; dívida antiga registrada (§4). O plano por dentro da função e o tempo no banco de verdade ficam para o passo 1 do §6.
- **Índices, RLS:** nada novo. **Listas:** a tabela segue por deslocamento (como era) — dívida antiga.
- **Pacote:** JS inicial **233,0 KB** comprimidos (teto 250); a lista de disparo 16,08 KB e o Painel de Recompra 16,61 KB. O "antes" não foi medido nesta mesa (o componente novo tem ~60 linhas e usa o que a casa já carrega).
- **Escrita idempotente / chamada externa:** nada novo.
- **Tela tocada fora da lei (já era, não mexido):** a lista de disparo abre com 4 leituras em cascata.

## 9. Para entrar nas notas depois da dieta

- **[[PLT - Decisoes de Produto]]:** P54-1…P54-7 (§3), numeradas como D-NN depois de confirmadas.
- **[[PLT - Memoria de Aprendizado]]:** L54-1…L54-7 (diário) — ajudantes de bloco na bateria; remover função quebra conferências antigas; opção nova como chave do JSON de filtros; moldura da vitrine servida pelo Vite; foto de aviso passageiro; título do modal por papel em teste; não rodar testes de tela junto com a bateria.
- **[[SUPA - Esquema do Banco]]:** depois de aplicar — `fn_dashboard_transitions` sai da lista de portas do Comercial; `fn_filter_customers` ganha a chave `sortOrder` nos filtros.
- **[[PLT - Lei de Desempenho e Escala]] §14:** dívida paga (a ordenação só na página, quando subir) e as duas que seguem (a porta de clientes com 100× o volume; as 4 leituras da lista de disparo).
- **[[PLT - Modelo de Sistema]]:** o padrão da janela de confirmação (pergunta no título, aviso no corpo, "Voltar" + verbo) — hoje é um componente só do Comercial; se o dono gostar, vale subir para `componentes/ui` numa sessão que possa mexer na casa.
- **[[000 - MAPA DO PROJETO]]** e **[[000 - ORDEM DAS SESSOES]]:** linkar este handoff e a demanda (não linkados de propósito nesta leva).
- **[[000 - PROXIMOS PASSOS]]:** o roteiro do §6; a sessão de desempenho da tabela de clientes (cursor + teto de página); trocar o último `react-hot-toast` do Painel de Recompra pelo aviso da casa.

## 10. Notas do cofre atualizadas

- [[SESSAO-54 - Comercial - Janelas da Plataforma e Limpeza da Funcao Antiga]] (nova) · [[SESSAO-54]] (novo)
- [[PLT - Comercial - Debito Tecnico]] — DT-D24, DT-BD4, DT-G16 anotados; DT-D39 novo
- [[SUPA - Comercial - Dominio de Dados]] — a linha da função legada

## 11. Ficou pendente

- Tudo do §6 (conferir, aplicar as duas atualizações do banco, publicar) — depende do dono.
- Confirmar as decisões provisórias (§3).
- O ClickUp: mover e concluir a tarefa é com o dono.
- Fora do escopo, anotado: "selecionar todos" só da página (DT-F7); o último aviso em `react-hot-toast`; a porta de clientes por cursor.
