---
titulo: "Diário — SESSAO-53 · \"Entregue em parte\" também na Programação, na Expedição e nas Entregas do dia"
tipo: execucao
data: 2026-11-18
tags: [execucao, sessao-53, rotas, entrega-parcial, programacao, expedicao, entregas-do-dia]
---

# Diário — SESSAO-53 (18/11/2026, madrugada — mesa da fila, sem o dono na conversa)

Demanda: [[SESSAO-53 - Entregue em Parte na Programacao Expedicao e Entregas do Dia]] · ramo `sessao-53-entregue-em-parte-nas-telas` (worktree própria da fila, nascida da main `78e8829`; a pasta principal do dono não foi tocada).

## Partida

- `git status` limpo; o ramo em dia com a `origin/main` (`78e8829`).
- Leitura: o CLAUDE.md da raiz e o do cofre; o pedido (duas vezes); D-324…D-328; o handoff e o diário da SESSAO-51; as lições sobre mudar o retorno de porta (E-17, E-170, E-178, A-197) e a chave que só nasce quando há (E-237); a Lei de Desempenho no que toca porta de tela; o banco pelas próprias migrations (a versão vigente de cada porta — A-96/A-97).
- **Modo fila:** nada de push, merge, aplicar migration, publicar, n8n ou ClickUp. As notas grandes (Decisões, Memória de Aprendizado, Esquema do Banco, Lei de Desempenho, Mapa, Ordem das Sessões, Próximos Passos) **não foram editadas** — o que é para elas está na seção "Para entrar nas notas depois da dieta", aqui e no handoff. A demanda **não** foi linkada na Ordem das Sessões (regra da leva).
- **Banco vivo não lido** (a mesa não tem acesso). O que precisa ser conferido lá está em "Para ligar com o dono" do handoff.

## Numeração

- Migration: `20261118110000_plt_entregue_em_parte_nas_telas.sql` (a faixa reservada a esta mesa).
- Bateria: bloco "SESSAO-53" — **pedidos 99531–99539 · produto 9953001 · usuários `…0053a1`–`a3` · caminhão TST5353 · setores `m53`/`f53`**.
- Decisões, lições e dívidas **sem número** (as notas grandes estão com a SESSAO-49): aqui levam rótulo local — `P53-n` (provisória), `L53-n` (lição). Quem levar para as notas dá o D-NN/E-NN/A-NN seguinte.

## Task list (espelha a demanda)

1. ✅ Gravar o pedido como demanda no padrão do template, com "Leitura da sessão" e "Tarefas no ClickUp"; não linkar na Ordem.
2. ✅ Levar "Entregue em parte (N de M)" à **Programação** (Programar e Já programadas), na porta de cada aba, sem requisição nova.
3. ✅ Levar à **Expedição**, na porta dela.
4. ✅ Levar às **Entregas do dia**, na porta dela.
5. ✅ O texto e o selo iguais aos das outras telas, com "K ainda em produção" quando houver.
6. ✅ Não mexer no selo do endereço alterado em "Já programadas" (D-324).
7. ✅ Registrar a forma escolhida (abaixo).
8. ✅ Bateria do banco reaplicando tudo, com bloco e faixa novos.
9. ✅ 375 e 768 sem rolagem lateral (medido nas 4 cenas).
10. ✅ Lint, montagem e testes; plano ×100 das portas tocadas.
11. ✅ Diário, handoff ("como testar", "Para ligar com o dono", provisórias, "Para entrar nas notas depois da dieta"), reporte da fila.

## Como o código estava (lido nas migrations vigentes)

- A entrega parcial vive nas colunas `parcial_*` do card do pedido (projeção da SESSAO-51). Com "deixar em produção" o pedido **segue vivo**: sai da rota do dia, volta para "Programar" e para a Expedição, e pode ser programado de novo — é exatamente nessas telas que faltava o aviso.
- As portas: **Programar** = `plt_fn_programacao_candidatos` (jsonb); **Já programadas** = `plt_fn_programadas` (**tabela**); **Expedição** = `plt_fn_expedicao` (jsonb); **Entregas do dia** = `plt_fn_entregas_do_dia` (jsonb). A antiga `plt_fn_programacao` (tabela) **não é mais chamada por tela nenhuma** (só existe a função no cliente, sem uso) — ficou como está.
- A dívida da D-328 falava em "portas que devolvem tabela fixa": na prática, das quatro, **só "Já programadas" devolve tabela**; as outras três são jsonb e só ganham uma chave.

## A forma escolhida (o pedido manda registrar)

- **Uma regra só:** a visão `plt_privado.vw_entregue_em_parte` (card do pedido → `selo` jsonb com `entregues`, `total`, `em` e, quando há, `ainda_producao`). `ainda_producao` = peças vivas em setor de entrada/produção + produtos ainda sem liberar no PCP — **a mesma conta da ficha do pedido** — e só existe enquanto a decisão que vale é "deixar em produção" e o resto não foi entregue. Depois que o resto é entregue a visão não devolve linha (o pedido é "Entregue", a regra da lista de Pedidos).
- **Nas três portas jsonb:** `left join` com a visão pela chave primária, só nas linhas da página, e a chave `entregue_em_parte` **só nasce quando há** (E-237).
- **Em "Já programadas" (tabela):** a opção "coluna nova com a bateria ajustada" — UMA coluna `entregue_em_parte jsonb` (nula = não há), `drop` + `create` com as mesmas permissões; a migration antiga que a recriava com `create or replace` (`20261109030000`) ganhou o `drop function if exists` antes e o `revoke/grant` depois (o padrão do E-178: reaplicável, em produção nada muda). Coluna **jsonb** de propósito: o que mais vier a entrar nesse selo entra nela sem mudar a forma de novo.
  - Descartado: "porta nova no lugar da antiga" — deixaria duas portas de "Já programadas" para manter (a bateria e as sessões antigas recriam a velha), e a tela passaria a depender de qual das duas a próxima sessão lembrou de mexer.
- **A ordem da subida não importa:** o site de hoje ignora a coluna/chave nova; o site novo com o banco de antes simplesmente não mostra o selo (campo ausente).

## Diário

- **1ª versão da regra: função por linha** (`plt_privado.fn_entregue_em_parte`). O ensaio em escala 1 mostrou ~4 ms por pedido só de planejamento (função SQL com `from` não é embutida: o banco replaneja a cada chamada). → **L53-1** · trocada pela **visão** (o banco embute na consulta da porta e planeja uma vez). A função nunca saiu da mesa (não há `drop` dela na migration: ela não existe em lugar nenhum).
- **Migration montada por extração** (`_docs/Plataforma/Execucao/dados/SESSAO-53 - montar a migration (script).mjs`): acha o ÚLTIMO `create` de cada porta nas migrations (com e sem `or replace` — E-170) e aplica remendos que têm de casar exatamente 1 vez. Origens: candidatos ← `20261112060000:1392-1594`; programadas ← `20261109030000:1465-1589`; expedição ← `20261109020000:853-970`; entregas do dia ← `20261112060000:884-1057`.
- **"Já programadas":** a coluna é uma subconsulta na lista de saída, guardada por `case when b.parcial_evento_id is not null` — a conta só roda para o pedido que tem entrega parcial.
- **Bateria:** 1ª rodada (sem o bloco novo) **1.872 ✔ + os 2 ✘ conhecidos** (o painel do Dashboard e o teste do fluxo do n8n — os mesmos da SESSAO-51) → as migrations aplicam duas vezes com a porta de forma nova. Com o bloco: **+23 ✔** (1.895).
  - **L53-2** · `--prefix` + heredoc com crases e aspas no shell do app quebra ("unexpected EOF"): texto com crase vai por arquivo (o E-247/E-249 de novo) — o bloco da bateria e os scripts foram gravados em arquivo e inseridos por um programa pequeno.
- **Telas:** `SeloEntregueEmParte` (o selo do card do PCP + a pílula "K ainda em produção" da ficha, ícone + texto); entra no `CartaoPedido` (Programar e Já programadas), na linha da Expedição e nas Entregas do dia (no cartão da parada e na lista "Entregues hoje", no lugar do "em parte" — que continua para o banco de antes). Tipos: `EntregueEmParte` em `rotas/api.ts`.
- **Achado nas fotos (corrigido):** nas Entregas do dia, em 375, a frase "Entrega parcial: as peças que voltaram seguem pela decisão da logística." **vazava a tela** (rolagem lateral: conteúdo 440 em janela 375) — ela tinha `shrink-0` e não quebrava a linha. Já era assim antes desta sessão; como a tela foi tocada, sai dentro do critério: a frase agora quebra a linha. → **L53-3**.
- **Vitrine** (as telas de verdade com dados de exemplo, fora do git, apagada no fim; servidor na porta 5193, derrubado): 4 cenas × 3 larguras = **12 fotos** em `_docs/Handoffs/imagens/sessao53-*`, tiradas pelo Chrome sem janela com a largura emulada (375 / 768 / 1440) e a medida `scrollWidth × clientWidth` de cada uma: **nenhuma com rolagem lateral**.
  - **L53-4** · o Chrome sem janela não abre com menos de ~500 px de largura pela linha de comando (`--window-size=375` dá 494): a foto de celular sai certa pela emulação do protocolo de depuração (`Emulation.setDeviceMetricsOverride`), sem dependência nova (o `WebSocket` do Node).
- **Ensaio ×100** — ver "Desempenho" abaixo e o [[SESSAO-53 - ensaio x100 do entregue em parte nas telas (resultado, 2026-11-18).txt|resultado]].

## Desempenho (ensaio ×100)

- Script e resultado em `_docs/Plataforma/Execucao/dados/SESSAO-53 - ensaio x100 do entregue em parte nas telas (…).{mjs,txt}` — a semeadura do ensaio da SESSAO-50 · bloco C (562.700 pedidos, 95 mil cards, 15 mil programações) + 600 pedidos entregues em parte com "deixar em produção" (hoje há 1 em produção); as 4 portas de ANTES copiadas para o esquema `antes53` e medidas alternadas com as novas.
- **A máquina estava carregada** (outras mesas rodando baterias): tempos absolutos 5 a 7 vezes acima dos ensaios anteriores, também na versão de antes. Valem a comparação e os blocos.
- Já programadas, 1ª página com as **50 linhas com o selo** (o teto): 63.037 → 64.111 blocos (+1,7%); medianas 339 → 470 ms. O dia e o caminhão (20 linhas, todas com o selo): 36 → 67 ms. Entregas do dia (61 paradas, 10 com o selo): 130 → 154 ms. Programar (200; 8 com o selo): +5% (ruído). Expedição: −6% / 0% (ruído). Histórico de entregues (0 com o selo): +13% com a máquina oscilando (a porta não faz nada novo quando não há selo: o `case` corta antes).
- Depois do ensaio: a regra contava duas vezes (o `case when x.n > 0 … x.n` fez o banco repetir as duas contagens — InitPlan 1–4 no plano) → **L53-5** · `nullif` + `jsonb_strip_nulls`: a conta aparece uma vez. Plano final da regra para 1 pedido (escala 1): **10 blocos, 0,8 ms**. Os números do ×100 acima são da versão mais cara.

## Verificações finais

- **Bateria do banco** (a versão definitiva, do zero): **1.896 ✔ + 1 ✘ conhecido** (o painel do Dashboard, de antes; o ✘ do fluxo do n8n depende da hora e passou). Migrations duas vezes seguidas sem erro. Bloco da 53: **23 ✔**.
- **Lint** 0 · **tipos** 0 · **montagem** ok, JS inicial **233,0 KB** (teto 250).
- **Testes das telas:** 114 arquivos / **728 ✔** com `vitest run --maxWorkers=3 --testTimeout=30000`. O `npm test` padrão, com a máquina carregada, estourou o tempo em 3 a 7 testes de arquivos não tocados (conjunto diferente a cada rodada; sozinhos passam) → **L53-6** · com várias mesas na mesma máquina, a rodada completa das telas se faz com menos trabalhos em paralelo antes de chamar de falha.
- 9 testes novos: o selo (3), o cartão da Programação (2), as Entregas do dia (3), a Expedição (1).
- Servidor da vitrine derrubado; a pasta da vitrine apagada; nada fora do git além de arquivos temporários do sistema.

## Decisões provisórias (o dono estava dormindo — confirmar)

- **P53-1 · Depois que o resto do pedido é entregue, o selo some** nessas três telas (o pedido passa a ser só "Entregue"), como já é na lista de Pedidos. A parada cuja entrega foi parcial e **fechou** o pedido ("limpar da produção", ou sem nada na fábrica) continua dizendo "Entregue em parte (N de M)".
- **P53-2 · "K ainda em produção" só aparece com a decisão "deixar em produção"** e o pedido ainda aberto — a mesma regra da ficha. Com "limpar", fica só o selo.
- **P53-3 · O Calendário da Programação ficou de fora:** as barras do calendário são compactas e coloridas pela situação; tocar no pedido abre a rota em "Já programadas", onde o selo aparece. Pôr o selo na barra é escolha de desenho do dono.
- **P53-4 · Nas Entregas do dia, a lista "Entregues hoje" troca o aviso "em parte" pelo selo com os números** ("Entregue em parte (1 de 3)"); o aviso antigo continua só quando o banco ainda não manda a conta.
- **P53-5 · Em "ROTAS → Entregas" (a tela da logística com "Entregue / Não entregue") nada mudou** — o pedido falava em Programação, Expedição e Entregas do dia.

## Para entrar nas notas depois da dieta

- **Decisões de Produto:** D-328 item 1 → ✅ dívida paga (as três telas mostram; fica de fora o Calendário — P53-3); registrar P53-1…P53-5 como provisórias.
- **Memória de Aprendizado:** L53-1 (regra por linha em porta de lista = visão embutida, não função SQL com `from`; medir em escala 1 antes do ×100), L53-2 (crase no shell → arquivo), L53-3 (`shrink-0` em frase longa dentro de linha que quebra = rolagem lateral no celular; medir `scrollWidth` na tela inteira, não só no pedaço novo), L53-4 (foto de celular pelo Chrome sem janela: emulação, não `--window-size`), L53-5 (expressão repetida num `case` sobre subconsulta = conta duas vezes; `nullif` + `jsonb_strip_nulls`), L53-6 (máquina compartilhada: testes das telas com menos trabalhos em paralelo).
- **Esquema do Banco:** + a visão `plt_privado.vw_entregue_em_parte` (card_id, selo); `plt_fn_programadas` devolve + `entregue_em_parte jsonb`; `plt_fn_programacao_candidatos`, `plt_fn_expedicao` e `plt_fn_entregas_do_dia` ganham a chave `entregue_em_parte` nos itens (só quando há). Nenhuma tabela, coluna, índice ou gatilho novo.
- **Lei de Desempenho (andamento):** as 4 portas tocadas seguem com 1 requisição por tela; o custo novo existe só para o pedido entregue em parte (ensaio ×100 abaixo). Dívida antiga observada, **não criada aqui**: a aba Programar no ×100 (segue como estava).
- **Modelo de Sistema:** o componente `SeloEntregueEmParte` (rotas) — o selo do PCP + a pílula da ficha, para as telas da logística.
- **Ordem das Sessões / Mapa:** linkar a demanda e o handoff da SESSAO-53.
