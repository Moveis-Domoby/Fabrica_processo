---
titulo: Handoff — SESSAO-53 · "Entregue em parte" também na Programação, na Expedição e nas Entregas do dia
tipo: handoff
data: 2026-11-18
tags: [handoff, sessao-53, rotas, entrega-parcial, programacao, expedicao, entregas-do-dia]
---

# 📋 Handoff — SESSAO-53 · "Entregue em parte" nas telas da logística (18/11/2026, madrugada — mesa da fila)

> ↪️ **25/11/2026: NO AR** — banco e site ligados pela fila em 25/11 (~04:52 e ~04:55 o banco, ~05:00 o site), pela [[handoff_2026_11_25_subida_atualizada|subida de 25/11]]. A porta da aba Programar saiu da atualização desta sessão e foi numa atualização nova, que guarda o aviso do ponto aproximado. O selo ainda não foi visto na tela (nenhum pedido aberto entregue em parte em 25/11). O que este handoff diz abaixo ("não está no ar") é a história de 18/11.

Demanda: [[SESSAO-53 - Entregue em Parte na Programacao Expedicao e Entregas do Dia]] · Diário: [[SESSAO-53]] · Paga a dívida da D-328, item 1 (SESSAO-51)

> ⏳ **NÃO está no ar.** Tudo no ramo `sessao-53-entregue-em-parte-nas-telas` (worktree da fila). **Nada foi aplicado no banco, nada foi para a main, nada foi publicado.** A subida é do dono — a seção "Para ligar com o dono" diz o que fazer, em ordem.

## 1. Objetivo

O pedido entregue em parte já dizia "Entregue em parte (N de M)" na ficha, no card do PCP, na lista de Pedidos e na busca. Faltavam as telas em que a logística trabalha o **resto** do pedido: a **Programação**, a **Expedição** e as **Entregas do dia**.

## 2. O que foi feito

- **Programação → Programar** e **→ Já programadas:** o cartão do pedido mostra o selo "Entregue em parte (N de M)" ao lado do estado (pronto / em produção / no PCP) e, quando o resto segue na fábrica, a pílula **"K ainda em produção"**.
- **Expedição:** a linha do pedido mostra o mesmo selo e a mesma pílula.
- **Entregas do dia:** o cartão da parada mostra o selo (a parada que leva o resto, ou a parada cuja entrega foi em parte); na lista "Entregues hoje", o aviso "em parte" virou o selo com os números.
- **Um selo só**, igual ao do PCP (a cor, o ícone e o texto) + a pílula da ficha — um componente, usado nas três telas.
- **Nenhuma requisição nova:** a informação vem na resposta que cada tela já pedia.
- **Achado e corrigido:** nas Entregas do dia, no celular, uma frase longa da lista das entregues ("Entrega parcial: as peças que voltaram seguem pela decisão da logística.") não quebrava a linha e fazia a tela rolar de lado. Já era assim; agora quebra.
- **Não foi tocado:** o selo do endereço alterado em "Já programadas" (D-324).

### A forma escolhida (registrada no diário)

- **Uma regra só no banco:** a visão `plt_privado.vw_entregue_em_parte` (card do pedido → selo). "K ainda em produção" = peças vivas em setor de entrada/produção + produtos ainda sem liberar no PCP — **a mesma conta da ficha** — só enquanto a decisão que vale é "deixar em produção" e o resto não foi entregue.
- **Programar, Expedição e Entregas do dia** devolvem jsonb: só ganharam a chave `entregue_em_parte` (que só nasce quando há).
- **Já programadas** devolve tabela: ganhou **uma coluna** `entregue_em_parte jsonb` (nula = não há) — "a coluna nova com a bateria ajustada". A migration antiga que recriava essa porta (`20261109030000`) passou a derrubar a assinatura antes de recriar e a repor as permissões (reaplicável; em produção nada muda).
- **A ordem da subida não importa:** o site de hoje ignora o dado novo; o site novo com o banco de antes só não mostra o selo.

### Fotos (vitrine — as telas de verdade com dados de exemplo; pedidos e clientes inventados)

| Foto | O que mostra |
|---|---|
| ![[imagens/sessao53-programar-celular.jpg]] | Programação → Programar no celular: o pedido 13901 com "Entregue em parte (2 de 5)" e "3 ainda em produção"; o 13903 com "(1 de 3)" |
| ![[imagens/sessao53-programar-tablet.jpg]] | … no tablet |
| ![[imagens/sessao53-programar-computador.jpg]] | … no computador |
| ![[imagens/sessao53-programadas-celular.jpg]] | Programação → Já programadas no celular: as paradas da rota com o selo |
| ![[imagens/sessao53-programadas-tablet.jpg]] | … no tablet |
| ![[imagens/sessao53-programadas-computador.jpg]] | … no computador |
| ![[imagens/sessao53-expedicao-celular.jpg]] | Expedição no celular |
| ![[imagens/sessao53-expedicao-tablet.jpg]] | … no tablet |
| ![[imagens/sessao53-expedicao-computador.jpg]] | … no computador |
| ![[imagens/sessao53-entregas-do-dia-celular.jpg]] | Entregas do dia no celular: a parada do resto com o selo e a pílula; em "Entregues hoje", "Entregue em parte (1 de 3)" |
| ![[imagens/sessao53-entregas-do-dia-tablet.jpg]] | … no tablet |
| ![[imagens/sessao53-entregas-do-dia-computador.jpg]] | … no computador |

## 3. Como testar (roteiro do dono — no site, depois de subir)

1. Escolha um pedido com uma parte pronta e outra ainda na produção (ex.: na MONTAGEM), programado para hoje.
2. Em **Entregas do dia** (ou em Logística → Rotas → Entregas), toque em **"Entrega parcial"**, deixe **"Deixar em produção"** marcado, escolha um motivo e registre.
3. Abra **Logística → Programação → Programar**: o pedido voltou para a lista, agora com **"Entregue em parte (N de M)"** e **"K ainda em produção"** ao lado do estado.
4. Abra **Logística → Expedição**: a linha do pedido mostra o mesmo selo e a mesma pílula.
5. Volte à **Programação**, programe o pedido de novo (dia, caminhão, rota) e abra **Já programadas**: a parada mostra o selo.
6. Abra **Entregas do dia** nesse dia e caminhão: a parada mostra o selo e a pílula.
7. Confira os números com a **ficha do pedido** (Pedidos → o número): são os mesmos ("Entregue em parte (N de M)" e "K ainda em produção").
8. Quando uma peça da fábrica ficar pronta, recarregue: o "K" diminui.
9. Entregue o resto pelo "Entregue" normal: o selo some dessas telas (o pedido passa a ser "Entregue").
10. Numa outra entrega parcial, escolha **"Limpar da produção"**: em **Entregas do dia**, abra "Entregues hoje" — a linha diz "Entregue em parte (N de M)", sem a pílula.
11. No celular, passe pelas quatro telas: nenhuma rola de lado.

## 4. Verificação (critérios de aceite)

- ✅ **As três telas mostram "Entregue em parte (N de M)" num pedido de teste entregue em parte, iguais às outras** — bateria do banco, bloco "SESSAO-53" (**23 ✔**): Programar, Já programadas, Expedição e Entregas do dia (o entregador e a logística) devolvem 2 de 5 e 3 ainda em produção; é a mesma conta da ficha; o pedido inteiro segue sem a chave; a conta acompanha a fábrica (peça pronta → 2; decisão revogada → some o "ainda em produção"; resto entregue → some o selo); a parcial que fecha o pedido diz 1 de 3. Testes das telas: 9 novos (o selo, o cartão da Programação, a Expedição, as Entregas do dia) + as fotos.
- ✅ **Cada tela continua abrindo com 1 requisição** — nenhuma chamada nova no código; os testes conferem que a Expedição e as Entregas do dia leem uma vez só. **Plano ×100** na seção 5.
- ✅ **A bateria do banco continua reaplicando tudo sem quebrar** — ver "Testes" abaixo.
- ✅ **Celular (375) e tablet (768) sem rolagem lateral** — medido nas 4 cenas × 3 larguras (375, 768, 1440): conteúdo = janela em todas (depois da correção da frase longa nas Entregas do dia).

**Testes**
- Bateria do banco (`npm run test:banco`), rodada final com a versão definitiva: **1.896 ✔ + 1 ✘ conhecido** (o painel do Dashboard — já falhava antes; o outro ✘ conhecido, o teste do fluxo do n8n, só falha numa janela da madrugada e nesta rodada passou). As migrations aplicam duas vezes seguidas sem erro; o bloco da 53: 23 ✔.
- Lint 0 · checagem de tipos 0 · testes das telas **114 arquivos / 728 testes ✔** · montagem ok, **JS inicial 233,0 KB** (teto 250).
  - Com a máquina carregada pelas outras mesas, o `npm test` padrão estourou o tempo em 3 a 7 testes de arquivos que esta sessão não tocou (um conjunto diferente a cada rodada); sozinhos, e na rodada completa com menos trabalhos em paralelo (`vitest run --maxWorkers=3 --testTimeout=30000`), passam todos.

## 5. Desempenho (Lei — checklist)

- **1 requisição por tela:** nenhuma porta nova, nenhuma chamada nova; o dado novo entra na resposta que já existia.
- **A conta só para quem tem:** a regra é lida pela chave primária do card, só nas linhas da página, e só o pedido entregue em parte paga a conta (10 blocos, 0,8 ms por pedido na versão final).
- **Nada ao vivo novo**, nenhum relógio, nenhuma lista nova.
- **Ensaio ×100** ([[SESSAO-53 - ensaio x100 do entregue em parte nas telas (resultado, 2026-11-18).txt|resultado]]; 562.700 pedidos, 95 mil cards, 600 pedidos entregues em parte — hoje há 1), ANTES × DEPOIS alternados no mesmo banco:
  - **A máquina estava carregada** (outras mesas rodando baterias): os tempos absolutos saíram 5 a 7 vezes acima dos ensaios anteriores, **inclusive na versão de antes**. Vale a comparação e a contagem de blocos.
  - Já programadas, 1ª página, **com as 50 linhas com o selo** (o teto — a semeadura pôs os entregues em parte no começo da lista): 63.037 → 64.111 blocos (**+1,7%**); medianas 339 → 470 ms na máquina carregada. Com 0 a 2 pedidos assim na página (o caso real), a diferença some.
  - Entregas do dia (61 paradas, 10 com o selo): 130 → 154 ms.
  - Programar (200) e Expedição (20): sem diferença fora do ruído (+5% / −6% / 0%).
  - Depois do ensaio a regra foi simplificada para contar uma vez só (metade do custo por pedido) — os números acima são da versão mais cara.
- **Pacote:** o selo é um componente pequeno dentro dos pedaços que já existiam; o teto do JS inicial é conferido pela montagem (ver o reporte).
- **Dívidas:** nenhuma nova. As portas da aba Programar, da Expedição e do histórico de entregues já eram lentas no ×100 antes desta sessão (dívidas antigas da lei) e seguem como estavam.

## 6. Para ligar com o dono

**Antes (só leitura, no banco vivo):**
1. Conferir que o corpo vivo das 4 portas é o mesmo das migrations de onde foram recriadas (o método da casa, por md5): `plt_fn_programacao_candidatos` e `plt_fn_entregas_do_dia` (de `20261112060000`), `plt_fn_programadas` (de `20261109030000`), `plt_fn_expedicao` (de `20261109020000`). **Se outra mesa desta leva (ou a SESSAO-34) recriou alguma delas, a migration da 53 tem de ser remontada em cima da versão nova** — o programa `SESSAO-53 - montar a migration (script).mjs` faz isso sozinho (ele pega o último `create` das migrations).
2. Conferir que `plt_privado.vw_entregue_em_parte` ainda não existe e que `plt_fn_programadas` tem uma assinatura só (6 argumentos).
3. Contar os pedidos com entrega parcial hoje (`parcial_evento_id is not null` no card do pedido) — para saber em quem olhar depois.

**Aplicar (uma migration, uma transação):**
- `supabase/migrations/20261118110000_plt_entregue_em_parte_nas_telas.sql` — pelo aplicador da casa, **só ela** (`--so`).
- A `20261109030000_plt_entrega_dia_real.sql` foi **editada** (derruba a porta antes de recriar e repõe as permissões) só para a bateria reaplicar tudo: **não precisa ser reaplicada** em produção. Se o aplicador reaplicar tudo, a 53 vem depois dela e deixa a porta na forma nova.

**Depois (só leitura):**
1. A visão existe e não é legível por quem está logado nem por anônimo.
2. `plt_fn_programadas`: uma assinatura, devolve `entregue_em_parte`, executável só por quem está logado.
3. Num pedido entregue em parte (o do passo 3 de "Antes"), as quatro portas devolvem o selo com os mesmos números da ficha.
4. Advisors: nada novo esperado além do aviso de sempre das portas.

**Site:** os commits das telas vão para a main no momento combinado (a Vercel publica). Pode subir antes ou depois do banco.

**ClickUp:** a mesa da fila não mexeu. Tarefa: [Rotas - Entregue em parte também na Programação, na Expedição e nas Entregas do dia](https://app.clickup.com/t/17tya50wqt5) — mover para "fazendo"/comentar é com o dono. Sugestão de comentário: *"Pronto para subir: o pedido entregue em parte agora mostra 'Entregue em parte (N de M)' e quantos ainda estão em produção também na Programação, na Expedição e nas Entregas do dia. Para conferir: faça uma entrega parcial deixando o resto em produção e abra as três telas."*

## 7. Decisões provisórias (confirmar com o dono)

1. **Depois que o resto é entregue, o selo some** dessas telas (o pedido vira "Entregue"), como na lista de Pedidos. A entrega parcial que fechou o pedido continua dizendo "Entregue em parte (N de M)".
2. **"K ainda em produção" só com "deixar em produção"** e o pedido aberto — a regra da ficha.
3. **O Calendário da Programação ficou de fora** (as barras são compactas; tocar abre a rota em "Já programadas", onde o selo aparece).
4. **Em "Entregues hoje", o aviso "em parte" virou o selo com os números.**
5. **"ROTAS → Entregas" não mudou** (o pedido não a citava).

## 8. Para entrar nas notas depois da dieta

- **Decisões de Produto:** D-328 item 1 → dívida paga (fica de fora o Calendário); as 5 provisórias acima.
- **Memória de Aprendizado:** (a) regra por linha em porta de lista = visão embutida, não função SQL com `from` (replaneja a cada chamada) — medir em escala 1 antes do ×100; (b) texto com crase no shell vai por arquivo; (c) `shrink-0` em frase longa dentro de linha que quebra = rolagem lateral no celular — medir a tela inteira, não só o pedaço novo; (d) foto de celular pelo Chrome sem janela: emulação pelo protocolo de depuração, não `--window-size`; (e) expressão repetida num `case` sobre subconsulta faz o banco contar duas vezes — `nullif` + `jsonb_strip_nulls` conta uma.
- **Esquema do Banco:** + a visão `plt_privado.vw_entregue_em_parte`; `plt_fn_programadas` + `entregue_em_parte jsonb`; as outras três portas + a chave `entregue_em_parte` nos itens. Nenhuma tabela, coluna, índice ou gatilho novo.
- **Lei de Desempenho:** andamento da SESSAO-53 (seção 5).
- **Modelo de Sistema:** o componente `SeloEntregueEmParte`.
- **Ordem das Sessões / Mapa do Projeto:** linkar a demanda e este handoff.

## 9. Pendências

- Subir (seção 6) e conferir na tela (seção 3).
- Confirmar as provisórias (seção 7).
- Levar a seção 8 às notas grandes quando a dieta da documentação terminar.
