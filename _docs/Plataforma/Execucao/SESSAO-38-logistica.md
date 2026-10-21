---
titulo: SESSAO-38 · frente da Logística (F2) — memória de execução
data: 2026-10-21
branch: sessao-38-logistica
tags: [plataforma, execucao, rotas, expedicao, logistica]
---

# SESSAO-38 · F2 — Rotas para qualquer pedido, ida/volta no mapa, Programar sem vão, equipe só de entregador, Expedição com filtros e o fim de "Pedidos em aguardo"

Sessão autônoma (lote noturno, supervisor): nenhuma pergunta ao dono; cada escolha virou decisão provisória (D-156…D-159). Números reservados: D-156…D-160 · E-125…E-129 · A-89…A-92 · migration `202610220200xx`.

## Leitura feita antes do código
CLAUDE.md, a memória de aprendizado inteira (E-01…E-116, A-…, M-, F-), decisões D-38/39/45/58–63/93/108–121/127–129/132–136/140/146/147, a Lei de Desempenho inteira, a nota do esquema (ROTAS, aguardo, programações, entregador, 56–100), e o código vivo de cada porta tocada (corpo das funções no banco real comparado por md5 com o arquivo — as 12 bateram, E-24).

## Task list (espelho do pedido)
1. [x] Rotas para qualquer pedido vivo (pronto, em produção, no PCP); programado só em "Já programadas"; regra única com a Expedição; o "Lançar para ROTAS" substituído; estado no cartão; o fluxo inteiro coerente (programar, reprogramar, tirar, ordem, equipe, A entregar, Entregas do dia, Entregue, devolução, reservados até a entrega).
2. [x] Mini mapa: "Só a ida" / "Só a volta" no lugar do trecho (Programar e Já programadas — o mesmo componente).
3. [x] "Programar" sem o espaço vazio entre "Na rota" e "Sem programação".
4. [x] Equipe só de entregador (com o já marcado não-entregador visível só para desmarcar).
5. [x] Expedição com os 5 filtros em quadradinhos (números na mesma requisição, filtro/página no servidor) + o que o aguardo tinha de útil.
6. [x] Fim da tela "Pedidos em aguardo": sai do menu, o endereço antigo leva à Expedição, gate coerente com o nível Logística.

## Decisões técnicas
- **A regra única** em três views de `plt_privado` (A-89): `vw_pedido_prontidao` → `vw_pedidos_vivos` → `vw_pedidos_para_rota`. O stand-by (outra frente) entra no WHERE da última.
- **Sem "lançar":** a peça pronta fica no lugar interno "Pedidos em aguardo" até a entrega; programar não exige nada; "Entregue" exige o pedido pronto (aguardo ou ROTAS) — conservador; a entrega pelo Tiny segue fechando tudo (D-113). O card PROGRAMADO fica como registro da entrega (o entregador desfaz no dia; o histórico da Programação mostra) — `fn_fechar_pedido` recriada só com essa condição.
- **"A entregar"** (ROTAS → Entregas) = lançado + programado + candidato pronto. O "entregue" da porta antiga filtra antes (não varre o histórico).
- **Compatível com o site publicado:** as portas mantêm nome e parâmetros; as que mudaram de forma só ganharam colunas (drop + create; drops também nas migrations antigas — E-17). `plt_fn_lancar_rotas`, `plt_fn_pedidos_aguardo`, `plt_fn_aguardo_contagens` e `plt_fn_expedicao_kanban` ficaram para o site antigo.
- **Expedição:** porta nova `plt_fn_expedicao` (jsonb: contagens dos 5 filtros sobre o conjunto inteiro, sem a busca; total do filtro com a busca; página). Deslocamento limitado (o conjunto é o que está em andamento).
- **Equipe:** `plt_fn_entregadores` só módulo "entregas"; `plt_fn_equipe_definir` recusa novato não-entregador, aceita quem já estava (pode sair).
- **Gate do front:** `useAcessoLogistica` passou a aceitar o nível Logística (E-127); ROTAS → Entregas passou a usar o mesmo gate.

## Arquivos
- Banco: `supabase/migrations/20261022020000_plt_rotas_qualquer_pedido.sql` (nova), drops em `20260928120000_plt_itens_fora_da_producao.sql` e `20261008150000_plt_entregue_nos_dois_lados.sql`; bateria `supabase/testes/testar-migrations.mjs` (bloco F2 no fim, em `{ }`; 2 testes antigos com a mensagem nova, marcados ↩️).
- Site: `src/rotas/{api.ts, SeloEstado.tsx (novo), estadoPedido.ts (novo), trechos.ts, trechos.test.ts (novo), CartaoPedido.tsx, MapaProgramacao.tsx, PainelRota.tsx, AbaProgramar.tsx, AbaJaProgramadas.tsx, ModaisProgramacao.tsx, ModalEquipe.test.tsx (novo)}`, `src/paginas/{Expedicao.tsx, Expedicao.test.tsx (novo), Rotas.tsx, EntregasDoDia.tsx}`, `src/logistica/{api.ts, acesso.ts, componentes/PecasProntas.tsx (novo)}`, `src/App.tsx` (a rota antiga vira redirecionamento), `src/componentes/Layout.tsx` (só a linha do menu), `src/navegacao/{rotas.ts, rotas.test.ts, pedacos.ts}`. Apagados: `src/paginas/PedidosAguardo.tsx` e o teste.
- Cofre: Decisões (D-156…D-159), Memória (E-125…E-127, A-89, A-90), nota do esquema, Lei de Desempenho (andamento).

## Comandos e resultados
- `npm ci`, branch `sessao-38-logistica`.
- Bateria do banco: 1.086 → **1.112 verdes** (o bloco F2 com 26 verificações); 2 vermelhos iniciais eram testes antigos amarrados à mensagem do "não foi lançado" (atualizados).
- `tsc -b`, `lint`, `vitest` (40 arquivos, 212 testes), `build` (JS inicial 222,2 KB gz) — verdes.
- Aplicação: `npm run banco:aplicar -- --confirmar --so 20261022020000_plt_rotas_qualquer_pedido.sql` → integração idêntica.
- Prova no banco real (bloco `DO` terminado em `RAISE`, como `authenticated` — A-75): Expedição contagens `todos 41 · com rota 4 · sem rota 37 · prontos 6 · em produção 35`; 1ª chamada 116 ms, depois ~10 ms; Programação (sem programação) 37 linhas em 32 ms; ROTAS a entregar 6 linhas em 24 ms; entregadores 4; Entregas do dia de 21/10 como entregador e como admin: 3 paradas, todas "pronto". A Expedição antiga tinha 42 — a diferença é o 13622 (excluído no Tiny, D-140).
- Advisors de segurança: só o +1 WARN esperado da porta pública nova `plt_fn_expedicao`.

## Erros e acertos (na memória)
- E-125: o rascunho é compartilhado entre as frentes — li o log de outra.
- E-126: o meu script de troca gravou o marcador `>>>>` quando o texto novo era vazio — achado por grep, corrigido.
- E-127: o gate da tela barrava o nível Logística sem vínculo (achado; erro da SESSAO-37).
- A-89, A-90.

## Pendências / para o dono decidir
- Confirmar D-156…D-159 (todas provisórias).
- O site novo precisa ser publicado para as telas novas aparecerem (o banco já está pronto e o site antigo continua funcionando).
- Os textos de outras telas (quadros, Estoque, Danificados, decisão pós devolução) ainda citam "Pedidos em aguardo" como o LUGAR da peça pronta — continua certo (é o nome do lugar), mas o dono pode querer outro nome agora que a tela é a Expedição.
- O selo "Em rota" da área Pedidos (`situacao_plataforma`) ainda olha o lançamento — um pedido programado sem lançar aparece como "pronto/aguardo" lá (porta de outra área — não mexida).
