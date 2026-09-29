---
titulo: Handoff — Ajuste · Frete fora da produção (D-63)
tipo: handoff
data: 2026-09-28
atualizado: 2026-09-28
tags: [handoff, ajuste, frete, unidades, pcp, aguardo, rotas, d-63]
---

# 📋 Handoff — Ajuste · Frete fora da produção

**Em uma frase:** o frete deixou de virar peça de produção; tudo o mais continua nascendo no PCP, e o PCP escolhe para onde vai.

**Branch:** `ajuste-itens-fora-da-producao` (criada da `main` em 3503d77, rebaseada sobre 2b589ec) — **mesclada na `main` em 28/09/2026 com o seu OK** ("Publique suas alterações" — D-20), depois de trazer a `main` com o ajuste do estoque (testes do banco 39 + 40: 510 verdes).
**Origem:** achado fora do escopo da F-07 da SESSAO-24 ([[handoff_2026_09_27_sessao24_producao_concluida]] §4) — o card "Frete" (1/1) do 13215 na LIMPEZA E EMBALAGEM.
**Memória:** [[AJUSTE - Frete fora da producao]] · **Decisão:** D-63 · **Aprendizado:** E-55, E-56, E-65, E-66, A-31 · **Pergunta nova:** Q-71
**Banco:** migration 39 **aplicada em 28/09 com o seu OK** ("Pode"), só o arquivo dela; integração do Tiny idêntica antes e depois. Manutenção: o card de frete do 13215 foi arquivado.

## 1. Objetivo

Todo item do pedido com quantidade virava peça a produzir — até o frete. O PCP podia mandar "Frete" para a produção, e o pedido só ficava completo quando essa "peça" chegava ao fim de linha. Você decidiu (28/09):

- **o que não vira peça:** *"Frete / entrega"* — só isso;
- **como reconhecer:** *"Pela descrição"*;
- **cadeira e acessório:** *"SEMPRE NASCE NO PCP DO JEITO QUE ESTÁ E O PCP DEFINE O LOCAL CORRETO"*;
- **pedido sem nada a produzir:** *"Direto p/ Pedidos em aguardo"*.

## 2. O que foi feito

### O levantamento (só leitura, antes de tudo)
- 8.107 itens de pedido desde 03/2025. Fora de móvel, só 4 tipos de item: frete/entrega, serviço de instalação (fechadura, passa-fio), revenda pronta (cadeiras, lâmpadas, espelho, carro de mão, longarinas) e acessório solto (rodízios, puxador). Em 90 dias, 44 de 897 pedidos tinham algum desses.
- O cadastro do Tiny não servia para separar: a classe "simples" mistura móvel feito aqui (a Penteadeira camarim, com 82 vendas) com cadeira de revenda, e o frete nem tem código.

### Banco (migration 39)
- **A regra num lugar só:** o item é frete quando a descrição **começa** com "Frete" ou "Entrega" ("Frete cliente" também). A palavra no meio do texto não conta — "Penteadeira … sem a parte de instalação das lâmpadas" continua sendo móvel.
- **As 17 contas de peças** (liberação e quadro do PCP, Pedidos em aguardo e as duas abas, lançar para ROTAS, entrega, ROTAS, programação, Expedição, cancelados, painéis do dia, sugestão do estoque) passaram a usar essa regra.
- **Trava:** o banco recusa criar peça de frete, venha da tela, da integração ou de outro lugar.
- **Pedido só de frete** (nunca aconteceu: 0 em 5.410): sai do quadro do PCP e aparece em Pedidos em aguardo já completo, para lançar para ROTAS. Se o Tiny acrescentar um móvel depois, ele volta sozinho ao PCP.
- **Manutenção:** o card de frete do 13215 foi arquivado (some das telas; a história fica).

### Front
- **Pedidos em aguardo:** pedido só de frete mostra "Pedido completo" + "Nada a produzir", barra cheia, sem o botão de ver unidades (não há nenhuma).
- **Expedição:** "Nada a produzir" no lugar de "0 de 0 no fim de linha".

## 3. Decisões tomadas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| Regra pela **descrição** (1ª palavra) | Pela classe do produto no Tiny | Você escolheu; e a classe mistura móvel com revenda, e o frete não tem código |
| Cadeira/acessório **continuam** nascendo no PCP | Tirar também revenda e serviço da produção | Sua resposta: o PCP define o lugar certo (a cadeira pode ir direto para Pedidos em aguardo — já funcionava) |
| Pedido sem nada a produzir decidido **na leitura** | Gravar "liberado" quando nasce | Gravado, um pedido que ganhasse um móvel no Tiny ficaria fora do PCP para sempre |
| A regra numa **view** (técnico) | Em funções pequenas | Função com `set search_path` não é embutida pelo planner: a 1ª versão deixou a aba do aguardo ~50× mais lenta no ensaio (E-65) |
| Trava pelo **item do pedido** | Pela descrição que vem no card | O item é a fonte da verdade; um card com descrição trocada não passa |
| Lançar para ROTAS **recusa pedido cancelado** | Deixar como estava | Sem nada a produzir, a regra de "completo" sozinha não barraria um cancelado |

## 4. Bugs e aprendizados

### Registrados na memória de aprendizado
- **E-65** — a regra em funções pequenas deixava telas até 50× mais lentas; pego no ensaio medindo no servidor, antes de chegar ao banco. Virou view.
- **E-66** — um ensaio "desfeito" travou por ~33 s a parte do banco dos cards às 10:00; 6 leituras de uma tela de outra sessão caíram. **Nenhuma gravação da integração foi afetada** (conferido nos registros). Correção: a aplicação desiste sozinha se não pegar a trava em 5 s.
- **E-55 / E-56** — dois tropeços de escape de barra no terminal (sem dano).
- **A-31** — como classificar item de pedido: cruzar catálogo × código × descrição e calibrar pela 1ª palavra.

### Achados fora do escopo (não mexidos)
- **Visão do dia — "pedidos a liberar" = 226**, mas **198 já estão entregues no Tiny**; só 28 esperam de verdade. O quadro do PCP esconde os entregues; o painel não. Deixei como **tarefa sugerida** (mexe no banco, precisa do seu OK).
- **O que falta no Tiny** (Q-71, com você): Espelho Adnet, Longarina e Carro de mão não estão cadastrados no Tiny da fábrica; as lâmpadas em kit aparecem na aba de insumos; "Fechadura (com instalação)" sem código não baixa o estoque.
- A checagem de desempenho do Supabase aponta dois índices iguais na tabela de cards (antigo, de outra sessão) — sem efeito para você.

## 5. Arquivos alterados

```
supabase/migrations/20260928120000_plt_itens_fora_da_producao.sql   (nova — 39, aplicada)
supabase/manutencao/2026-09-28_arquivar_cards_de_frete.sql          (nova — rodada)
supabase/testes/testar-migrations.mjs                                (bloco "D-63": 25 verificações, pedidos 924200–924205)
src/paginas/PedidosAguardo.tsx · src/paginas/Expedicao.tsx          ("Nada a produzir")
src/paginas/PedidosAguardo.test.tsx                                  (novo — teste de componente)
_docs: Decisões (D-63), Requisitos (RF-02), Perguntas (Q-71), Modelo de Sistema, Esquema do Banco,
       Memória de Aprendizado (E-55, E-56, E-65, E-66, A-31), Execução (AJUSTE + índice), este handoff, mapa
```

## 6. Impacto nos números visíveis

> [!warning] O que muda na tela (só o pedido 13215 tinha frete virando peça)
> - **Pedidos em aguardo:** 13215 de "3 de 6 prontas" para **"3 de 5"**.
> - **PCP:** o resumo do 13215 de "6 de 6 liberadas" para **"5 de 5"**; o "Frete" não aparece mais para liberar.
> - **Expedição:** 13215 de "3 de 6 no fim de linha" para **"3 de 5"** (5 liberadas).
> - **LIMPEZA E EMBALAGEM:** o card "Frete" do 13215 sumiu do quadro (arquivado).
> - Nada mais mudou (conferido nas mesmas contas que as telas usam, antes e depois).

## 7. Notas do cofre atualizadas

- [[PLT - Decisoes de Produto]] — D-63 (+ a nota de numeração da S26)
- [[PLT - Requisitos]] — ↪️ RF-02
- [[PLT - Perguntas em Aberto]] — Q-71
- [[PLT - Modelo de Sistema]] — "Nada a produzir"
- [[SUPA - Esquema do Banco]] — migration 39
- [[PLT - Memoria de Aprendizado]] — E-55, E-56, E-65, E-66, A-31
- [[AJUSTE - Frete fora da producao]] · [[000 - EXECUCAO (indice)]] · [[000 - MAPA DO PROJETO]]

## 8. Ficou pendente

### Aguardando decisão sua
1. ✅ Juntado na versão principal e publicado em 28/09 (seu OK).
2. **Q-71** — os três pontos do Tiny (acima).
3. **Tarefa sugerida** — alinhar o "a liberar" da Visão do dia com o quadro do PCP.

### Próximo passo sugerido
- A sessão do estoque (em paralelo) aplicou a atualização dela depois da minha; quem juntar por último na versão principal roda os testes do banco com as duas.

## 9. Como validar (passo a passo)

1. **Fábrica → Logística → Pedidos em aguardo:** o pedido 13215 mostra **"3 de 5 prontas"**.
2. **Fábrica → Controle de Produção → LIMPEZA E EMBALAGEM:** não existe mais card "Frete".
3. **Fábrica → Logística → Expedição:** 13215 com **"3 de 5 no fim de linha"**.
4. **Pedido novo com frete** (quando chegar um): ao liberar no PCP, o item "Frete" não aparece na lista; o pedido fica "liberado por completo" sem ele.

```sql
-- O que a regra acha de cada item de um pedido (troque o número)
select v.seq, v.descricao, v.eh_frete, v.unidades
  from plt_privado.vw_itens_producao v
 where v.pedido_id = (select id from public.pedidos where numero = 13215)
 order by v.seq;
```

## 10. Verificação executada

| O quê | Resultado |
|---|---|
| Testes do banco (`npm run test:banco`, 2 rodadas) | ✅ **471** verdes (446 de antes + 25 do bloco D-63) |
| Teste de mutação (regra do frete desligada) | ✅ o bloco D-63 fica vermelho — o teste pega a regressão |
| Telas: tsc · lint · testes · build | ✅ · ✅ · **81/81** · ✅ — o teste novo **falha na tela antiga e passa na nova** |
| Conferência "recriar da versão mais nova" | ✅ as 17 funções da 39 × as originais: só as trocas pretendidas |
| Ensaio no banco real (transação desfeita) | ✅ só o 13215 muda; trava recusa o card de frete; a manutenção pega só o card 507 — ⚠️ um dos ensaios travou a tabela de cards por ~33 s (E-66) |
| Desempenho no servidor (antes → depois) | ✅ aguardo ~4 → ~7,5 ms · contadores ~2 → 4–9 · painel ~5 → 7–19 · busca geral ~41 → ~57 · resto igual |
| Antes de aplicar | ✅ as 17 funções no banco idênticas ao repo; a atualização do estoque já aplicada e sem colisão; nenhuma transação longa aberta |
| **Aplicação** | ✅ só a 39 (`--so`); integração do Tiny: estrutura e linhas **idênticas** (`e2109f3a…`, 65 colunas) |
| Manutenção | ✅ 1 evento: card 507 arquivado; 0 card de frete vivo |
| Checagem do Supabase (segurança e desempenho) | ✅ nada novo |
| Depois de aplicar (mesmas contas das telas) | ✅ 13215: aguardo 3 de 5 · PCP 5 de 5 · Expedição 3 de 5 (5 liberadas) · liberação sem o Frete · 0 pedido só de frete |
| Com a atualização do estoque junto (antes de publicar) | ✅ testes do banco **510** verdes (as duas atualizações, 2 rodadas) · telas: tsc · lint · **83/83** · build ✅ |
| Publicação (28/09, com o seu OK) | ✅ juntado na versão principal sem conflito pendente; o site terminou de publicar (Vercel: success) |
