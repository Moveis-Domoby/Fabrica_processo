---
titulo: Handoff — Ajuste · O quadrinho do PCP na Visão do dia conta o que o quadro do PCP mostra (D-75)
tipo: handoff
data: 2026-09-28
atualizado: 2026-09-28
tags: [handoff, ajuste, dashboards, visao-do-dia, pcp, d-75]
---

# 📋 Handoff — Ajuste · Painel do PCP como o quadro

**Em uma frase:** o quadrinho do PCP na Visão do dia passou a mostrar o mesmo que o quadro do PCP — de 233 "a liberar" para 33.

**Branch:** `ajuste-painel-pcp-como-o-quadro` (criada da `main` em 943ce63, trazida até 34dde06 por fast-forward) — **aguardando a sua revisão para entrar na `main`** (D-20).
**Origem:** achado fora do escopo do ajuste do Frete ([[handoff_2026_09_28_ajuste_frete_fora_da_producao]] §4 — a "tarefa sugerida").
**Memória:** [[AJUSTE - Painel do PCP como o quadro]] · **Decisão:** D-75 · **Aprendizado:** A-35, A-36, A-37
**Banco:** migration 41 **aplicada em 28/09 (~23:53) com o seu OK** ("Pode aplicar"), só o arquivo dela; integração do Tiny idêntica antes e depois.

## 1. Objetivo

O painel "Visão do dia" dizia **233 pedidos a liberar**; o quadro do PCP mostrava **33**. Conferido só com leitura no banco: **200 dos 233 já estavam "Entregue" no Tiny** — os 33 restantes eram exatamente os do quadro, um por um. Desde a SESSAO-23 o quadro esconde o pedido que o Tiny já encerrou; o painel nunca acompanhou.

Suas respostas (28/09):
- **"a liberar" igual ao quadro do PCP** → *"Sim, igual ao quadro"*;
- no mesmo quadrinho, **a "mais antiga" também** (olhava pedido entregue e pedido já liberado: 31 dias × 27 do quadro);
- **os cards de reposição contam** no "a liberar", como o quadro já mostra → *"Sim, conta junto"* (hoje não há nenhum);
- **"liberadas hoje" fica como está** — você não escolheu mudar (ele soma também o cadastro direto no estoque: 8 das 12 de hoje).

## 2. O que foi feito

### Banco (migration 41)
- **Uma porta só recriada:** a conta do quadrinho do PCP do painel, a partir da versão de hoje (a do Frete — o frete continua fora da conta).
- O **"a liberar"** e a **"mais antiga"** passaram a olhar exatamente os cards que o quadro do PCP mostra: pedido vivo no Tiny (não entregue, não "não entregue", não cancelado) com peça por liberar, e card de reposição. O "liberadas hoje" e a trava de quem pode ver o painel (líder do PCP e admin) ficaram iguais.
- Nenhuma tabela, coluna, gatilho ou porta nova. A aplicação desiste sozinha se não pegar o banco em 5 s.

### Front
- **Nada mudou** — a tela do painel já mostra o que o banco manda (mesmo nome de campo, mesma forma).

### Testes do banco
- O teste antigo do quadrinho (da SESSAO-16) comparava com a regra antiga escrita à mão → passou a comparar com a própria porta do quadro.
- **Bloco novo "D-75"** (7 verificações): pedido "Preparando envio" e reposição entram; "Entregue", "Não entregue", "Cancelado" e só-frete não; painel = quadro no número e na "mais antiga"; liberado por inteiro sai; "Não produzir" na reposição sai; "liberadas hoje" continua a regra de sempre.

## 3. Decisões tomadas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| O painel copia o filtro do quadro e o **teste amarra os dois** | Juntar numa regra única compartilhada agora | Mexeria também no quadro, sem ganho hoje; o teste já acusa se um mudar sem o outro |
| Nome do campo continua `pedidos_a_liberar` (agora com reposição) | Renomear para "cards a liberar" | Renomear obrigaria mudar a tela; o comentário no banco explica |
| "Liberadas hoje" intocado | Tirar o cadastro direto no estoque | Você não escolheu mudar (registrado na D-75; mudar é decisão nova) |
| Medir no banco real só com leitura (a conta como consulta pura) | Ensaio com a mudança montada numa transação desfeita | O ensaio com mudança de estrutura segura trava até desfazer (E-66) — aqui não precisava |

## 4. Bugs e aprendizados

### Resolvido
- **Painel × quadro do PCP** (233 × 33) — o "a liberar" e a "mais antiga" do painel batem com o quadro.

### Registrados na memória de aprendizado
- **A-35** — número de painel que resume uma tela sai do mesmo conjunto da porta dessa tela, com teste amarrando os dois (e lendo as duas portas na mesma consulta).
- **A-36** — total igual não prova conjunto igual: no teste ao contrário (sem a atualização), o painel antigo e o quadro deram 5 = 5 por erros opostos (um pedido entregue de um lado, uma reposição do outro).
- **A-37** — medir a porta nova no banco real sem mexer em estrutura: a conta como consulta pura, duas vezes (a 1ª fria engana).

### Achado fora do escopo (não mexido)
- Nenhum novo. O "Pedidos completos aguardando lançamento" do mesmo painel também não olha a situação no Tiny — mas a aba Pedidos em aguardo também não (é a mesma regra nas duas), então os dois não se separam por isso. Conferido só com leitura em 28/09: hoje os dois dão **0**.

## 5. Arquivos alterados

```
supabase/migrations/20260928210000_plt_painel_pcp_como_o_quadro.sql   (nova — 41, aplicada)
supabase/testes/testar-migrations.mjs                                 (teste do tile da S16 + bloco "D-75": pedidos 924301–924305, produto 924390)
_docs: Decisões (D-75), Esquema do Banco (migration 41 + ↪️ no painel da S16), Modelo de Sistema (quadro do PCP),
       Memória de Aprendizado (A-35, A-36, A-37), Execução (AJUSTE + índice), este handoff, mapa, próximos passos
```

## 6. Impacto nos números visíveis

> [!warning] O que muda na tela — Dashboards → Visão do dia, quadrinho "PCP"
> - **a liberar:** 233 → **33** (os 200 "Entregue" no Tiny saíram) — o mesmo número do quadro do PCP.
> - **mais antiga:** 31 dias → **27 dias** (a do card do quadro esperando há mais tempo).
> - **liberadas hoje:** sem mudança.
> - Quando a reposição automática for ligada, o "a liberar" passa a contar também os cards de reposição (como o quadro).
> - Nada mais mudou em nenhuma tela.

## 7. Notas do cofre atualizadas

- [[PLT - Decisoes de Produto]] — D-75
- [[SUPA - Esquema do Banco]] — migration 41 (+ ↪️ no painel da SESSAO-16; linha em branco que faltava entre os parágrafos do Frete e do estoque)
- [[PLT - Modelo de Sistema]] — ↪️ no "Quadro do PCP sem encerrados no Tiny"
- [[PLT - Memoria de Aprendizado]] — A-35, A-36, A-37
- [[AJUSTE - Painel do PCP como o quadro]] · [[000 - EXECUCAO (indice)]] · [[000 - MAPA DO PROJETO]] · [[000 - PROXIMOS PASSOS]]

## 8. Ficou pendente

### Aguardando decisão sua
1. **Revisão e entrada na versão principal** (D-20) — o banco já está com a mudança; falta juntar o código na `main` e publicar (a tela não muda, então a publicação não altera nada visível).

### Próximo passo sugerido
- Nenhum. Se um dia quiser que "liberadas hoje" conte só o que o PCP liberou (sem o cadastro direto no estoque), é uma troca pequena na mesma conta.

## 9. Como validar (passo a passo)

1. **Fábrica → Controle de Produção → PCP**, aba "Aguardando liberação": anote o total de cards.
2. **Dashboards → Visão do dia**, quadrinho **PCP**: o "a liberar" tem que ser **o mesmo número** (em 28/09: 33).
3. No mesmo quadrinho, a "mais antiga" tem que ser o tempo do card mais antigo daquela aba do PCP (em 28/09: 27 dias).
4. Quando um pedido do quadro for liberado por inteiro no PCP, os dois números descem juntos.

```sql
-- Painel × quadro, como um admin veria (nada é gravado: o bloco termina em erro de propósito
-- e a mensagem traz o resultado).
do $$
declare v_auth uuid; v_painel record; v_quadro int;
begin
  select u.auth_user_id into v_auth from public.plt_usuarios u
   where u.papel = 'admin' and u.ativo and u.auth_user_id is not null order by u.criado_em limit 1;
  perform set_config('request.jwt.claim.sub', v_auth::text, true);
  select * into v_painel from public.plt_fn_dash_pcp_dia();
  select coalesce(max(q.contagem_total), 0)::int into v_quadro from public.plt_fn_cards_pedido_pcp(1, 0) q;
  raise exception 'painel=% quadro=% mais_antiga=%', v_painel.pedidos_a_liberar, v_quadro, v_painel.espera_mais_antiga;
end $$;
```

## 10. Verificação executada

| O quê | Resultado |
|---|---|
| Leitura no banco antes (só leitura) | painel 233 = 200 "Entregue" + 33 "Preparando envio"; quadro 33; conjuntos idênticos com o filtro do quadro |
| Testes do banco (`npm run test:banco`, 2 rodadas) | ✅ **517** verdes (510 de antes + 7 do bloco D-75) |
| Teste ao contrário (sem a atualização) | ✅ 5 vermelhos no bloco D-75 — o teste pega a regra antiga |
| "Recriada da versão mais nova" | ✅ corpo da 39 × 41: só a conta do quadro e as duas colunas; o resto idêntico |
| Desempenho no servidor (só leitura) | ✅ ~5,5 ms → ~3,4 ms |
| Antes de aplicar | ✅ ensaio do aplicador (plano = só a 41); nenhuma transação longa aberta; as sessões do Frete e do estoque avisadas (nada rodando) |
| **Aplicação** | ✅ só a 41 (`--so`); integração do Tiny: estrutura e linhas **idênticas** (`e2109f3a…`, 65 colunas) |
| Depois de aplicar, no banco real, como admin | ✅ painel **33** = quadro **33**; mais antiga igual (27 dias); liberadas hoje igual |
| Checagem do Supabase (segurança e desempenho) | ✅ nada novo |
