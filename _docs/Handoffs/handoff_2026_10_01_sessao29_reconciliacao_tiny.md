---
titulo: Handoff — SESSAO-29 · Conferência diária com o Tiny (pente-fino) + Auditoria no Painel admin
tipo: handoff
data: 2026-10-01
atualizado: 2026-10-01
tags: [handoff, sessao, sessao-29, tiny, n8n, reconciliacao, auditoria, d-50, d-95, d-96, d-97, d-98]
---

# 📋 Handoff — SESSAO-29 (01/10/2026 — construída na madrugada, conferida até a noite)

**Branch:** `sessao-29-reconciliacao-tiny` (pasta principal, sem worktree — pedido do dono) · **enviada ao GitHub; NÃO mesclada na `main`** (a tela da Auditoria espera a sua revisão)
**Banco:** migrations **49** (conferência) e **50** (auditoria) **aplicadas** em 01/10 (05:17 e 05:26 UTC), cada uma sozinha; integração idêntica antes/depois (`e2109f3a…`, 65 colunas, linhas idênticas) — com o seu OK ("pode atualizar o banco, contanto que não quebre o que está em produção")
**n8n:** o gatilho do fluxo de carga ("subir banco de dados --- tiny → supabase") trocado **por você** às ~01:50 (o relógio de 1 em 1 minuto saiu; o banco acorda o fluxo) · o fluxo de vendas passou a mandar o número do cadastro do cliente (**colado e publicado por você às 23:20 de 01/10**) · desde 01/10 à noite o Claude **lê o n8n pela API** (chave criada por você, guardada só no seu computador)
**Demanda:** [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] · **Execução:** `_docs/Plataforma/Execucao/SESSAO-29.md` · **Decisões:** D-95…D-98 (↪️ D-40, D-50) · **Requisitos:** RF-115…RF-117, RNF-08

## 1. O que você pediu

**A demanda (23/09, D-50):** o banco nunca mais diverge do Tiny em silêncio — conferência diária às 3h dos últimos 60 dias + não terminados; observações acompanham o Tiny quando apagadas, o resto não se apaga; cliente pelo cadastro do Tiny (contato renomeado não duplica); marcadores como estão; nenhum renovador de token novo; "a plataforma o mais otimizada possível".

**As suas respostas antes de codar (01/10, ~01:40):** 1) a mudança no fluxo de vendas — *"Você gera para mim e eu edito o fluxo"*; 2) **escopo novo** — a **página de Auditoria** no Painel admin (log de tudo: quem, quando, onde, porquê, o quê; os erros do n8n entram lá no futuro); 3) pedido vivo que só a conferência achou entra no PCP — *"Pode ser"*; 4) nome com código no lugar do apóstrofo — *"Corrija"*; 5) testes no Tiny com o seu pedido e o seu cadastro — *"só não edite valor nem nada do tipo sem corrigir depois"*; 6) "otimizada" = o que a sessão toca. E: *"faça tudo em silêncio absoluto e me apresente só o relatório final"*.

## 2. Como ficou (em língua de gente)

- **A conferência da madrugada:** às 3h o banco põe na fila a busca do Tiny pelos últimos 60 dias (pega até pedido que nunca chegou aqui) e os pedidos não terminados de qualquer idade, e **acorda o fluxo do n8n** — um lote de 30 por minuto, nunca dois ao mesmo tempo, no ritmo de sempre (1 consulta a cada 1,8 s, metade do limite do Tiny). Quando a fila esvazia, ele **fecha a rodada** (uma linha só no registro: quantos relidos, quais estavam diferentes e o quê) e **o relógio se desliga sozinho**. Fila vazia = nada rodando, nenhuma execução no n8n.
- **O que muda no banco quando o Tiny muda:** o que for editado no Tiny edita aqui; o que for apagado lá **não** se apaga aqui — **só as duas observações** (a do pedido e a interna) acompanham o Tiny também quando apagadas. Marcador acompanha o Tiny (como sempre). **Pedido igual ao Tiny não é regravado** (antes, cada aviso regravava tudo).
- **O cliente:** o pedido relido continua no **mesmo cliente** mesmo com o nome trocado no Tiny (o Tiny devolve o nome ATUAL do cadastro em todos os pedidos). Ordem para achar o cliente: o número do cadastro do Tiny (quando o aviso trouxer) → o CPF → o cliente que o pedido já tem → nome + telefone.
- **Nome com código:** o cliente gravado como "D&#39;Elia" virou "D'Elia" (e todo nome novo já chega limpo).
- **Pedido que o aviso nunca trouxe:** se a conferência achar um pedido vivo que não existia aqui, ele entra no quadro do PCP como se tivesse chegado pelo aviso.
- **Painel admin → Auditoria** (só admin): aba **Atividade** — tudo o que acontece, uma página por vez: quem, quando, onde (a tela, ou os setores de origem → destino), o quê (em português) e **por quê** (a observação do gesto); filtros por pessoa, tipo, período e busca (o nº do pedido acha a história dos cards dele); a **saída** da plataforma também passou a ser registrada; tarefa pessoal privada não aparece (nem para o admin). Aba **Conferências com o Tiny** — a rodada em andamento e as rodadas encerradas, com os pedidos que estavam diferentes. Os erros do n8n entram aí numa próxima etapa.

## 3. Decisões que tomei (você pode mudar)

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| O banco acorda o fluxo do n8n só com trabalho; o relógio da fila só existe durante a rodada | Manter o relógio de 1 em 1 minuto do n8n / um relógio fixo no banco | O que você vetou no estoque (30/09); fila vazia não gera nada |
| Reaproveitar a fila e o fluxo de carga que já existiam | Tabela nova / fluxo novo | Banco enxuto (D-47); "um fluxo só" |
| Observação só se apaga quando o Tiny manda o campo vazio; se o campo nem vier, fica | Apagar também quando o campo some do pacote | Nunca aconteceu nos 5.440 pedidos; apagar por ausência seria apagar por engano |
| Gravar só o que mudou (o pedido, os itens e o cadastro) | Regravar tudo a cada aviso (como era) | ~600 regravações inúteis por madrugada; e é o que dá o número "quantos mudaram" |
| Uma linha por rodada no registro da integração (com a lista dos pedidos diferentes) | Uma linha por pedido relido | Banco enxuto; o detalhe cabe no resumo |
| Sem o número do cadastro, "o cliente que o pedido já tem" só vale quando não há CPF dos dois lados | Sempre manter o cliente do pedido | CPF diferente prova que é outra pessoa (pedido trocado de cliente) |
| A Auditoria abre nos "Últimos 7 dias", 30 por página | Abrir em "tudo" | Página leve; o filtro "Desde o começo" está lá |
| O nome corrigido fica no cadastro do cliente; a cópia crua do pedido fica como o Tiny mandou | Corrigir também a cópia crua | A conferência compara a cópia crua com o Tiny — mexer nela faria todo pedido "mudar" toda noite |

## 4. Verificação

| O quê | Resultado |
|---|---|
| Banco de teste (2 rodadas, integração idêntica) | ✅ **667 verificações**, tudo verde — **43 novas** (30 da conferência, 13 da auditoria) |
| Teste de mutação | ✅ desfazendo a regra das observações e a do "cliente que o pedido já tem", 5 verificações ficam vermelhas — os testes pegam a regressão |
| Tipos · lint · testes de tela · build | ✅ · ✅ · ✅ 92/92 (8 novos) · ✅ |
| Aplicação no banco real | ✅ 49 e 50, cada uma sozinha; integração idêntica nas duas; alertas do Supabase sem nada novo |
| Ensaio do aviso de venda (desfeito) | ✅ a chamada do n8n cai na função nova; mesmo pacote → nada regravado, aviso registrado, 128 ms |
| Teste de fumaça (o seu pedido) | ✅ banco → n8n → Tiny → banco em < 1 s; nada diferente; o relógio se desligou sozinho no minuto seguinte |
| **No Tiny, com o seu pedido** (via "editar alguns dados" — sem estornar nada) | ✅ observação interna posta → apagada no Tiny → **apagada aqui**; previsão apagada no Tiny → **mantida aqui**; previsão devolvida. **Tiny e banco de volta ao original.** |
| Marcador e contato renomeado no Tiny | ⚪ não feito no Tiny (a permissão automática da sessão barrou editar o marcador do seu pedido — parei de mexer no Tiny); provados no banco de teste e pela rodada real (abaixo) |
| Auditoria com os dados reais (sua sessão aberta no navegador do app) | ✅ 1.133 registros em 7 dias; filtro "Movimentações" = 191 com o porquê ("Entrou pelo Tiny.", "Saiu com o pedido 13541 (Entregue no Tiny)"); celular 375 sem rolagem lateral e toques ≥ 44 px |
| **1ª rodada real (3h)** | ✅ 611 pedidos relidos em 21 min, **138 estavam diferentes**, nenhum novo, nenhuma falha (§5) |
| **2ª rodada, logo depois** (à mão, 03:39) | ✅ 611 relidos, **zero diferentes** — o critério de aceite |
| Durante as duas | ✅ nenhum cliente criado (nenhuma duplicata), nenhum aviso nos cards do quadro, o relógio da fila se desligou sozinho nas duas |
| **O dia 01/10 em produção** (a versão nova atendendo as vendas) | ✅ 12 pedidos novos → 12 cards no PCP; 32 avisos de atualização; os 21 pedidos com aviso estão no banco com a mesma situação do Tiny; **45 gravações de pedido, todas sem erro**; nenhuma porta da plataforma com erro no dia |

## 5. A primeira conferência de verdade

**Madrugada de 01/10, 03:00–03:21:** relidos **611** pedidos (os 60 dias + os não terminados), em 7 páginas de busca. **138 estavam diferentes do Tiny:**

- **134 só em dados que não aparecem em nenhuma tela** (a cópia completa do pedido que o banco guarda). Quase todos entregues. Fui atrás do porquê (só leitura no Tiny, 9 pedidos antigos): no que deu para ver, foi a **data de faturamento** — o Tiny mudou a data depois do último aviso de venda, e o aviso nunca trouxe. É exatamente o tipo de diferença calada que a conferência existe para pegar; espere alguns por noite.
- **2 de cliente:** um pedido recebeu o cadastro atualizado do cliente (mesma pessoa, achada pelo CPF); o outro (12939) **passou de um cadastro para outro da mesma pessoa** — ela tem dois cadastros no próprio Tiny (mesmo nome e telefone, um com CPF e outro sem) e o pedido hoje aponta o sem CPF. Nenhum cliente novo foi criado.
- **1 de observação** (13521) e **1 de itens** (13060) — corrigidos para ficar como o Tiny.

**Logo depois (03:39–04:01), a segunda rodada: 611 relidos, zero diferentes.** O banco ficou igual ao Tiny e ficou parado assim.

As duas aparecem em **Painel admin → Auditoria → Conferências com o Tiny**, com a lista dos pedidos que estavam diferentes. A próxima roda sozinha às 3h.

## 6. Ficou com você

1. ✅ ~~**Colar no fluxo de vendas do n8n** ("Principal - Tiny → planilha / banco / clickup / trello") a mudança que passa o número do cadastro do cliente — 3 trocas pequenas, passo a passo em [[N8N - Workflow Tiny para Planilha]] (seção de 01/10).~~ **Feito por você em 01/10 à noite: salvo às 23:09 e publicado às 23:20** — conferido pela conexão nova com o n8n (os 3 passos que rodam batem com o passo a passo). *(No fim do dia 01/10, os 8 clientes novos tinham chegado sem o número — eram de antes da mudança.)*
2. 🔶 **Ver a Auditoria** (Painel admin → Auditoria) e me dizer se pode ir ao site — aí eu mesclo e publico. *(01/10 à noite: você já viu a tela; o merge espera o seu "pode subir".)*
3. ⚪ **Senha da plataforma:** ela passou de novo pelo chat (madrugada de 01/10 — não a usei; você entrou sozinho). Pela sua decisão de 01/10, a troca fica para a publicação ([[000 - PROXIMOS PASSOS]]) — só registrando.
4. ⚪ (opcional) Testar você mesmo, no Tiny, o marcador e o nome: ponha um marcador num pedido recente (ou troque o nome de um cadastro sem CPF) → na manhã seguinte, a Auditoria → Conferências mostra o pedido com "marcadores"/"cliente". Desfaça depois.
5. ⚪ (opcional) No n8n, no fluxo de carga: Settings → "Save successful production executions" → "Do not save" (hoje ele guarda toda execução com os pedidos inteiros).

**Avisos:**
- No módulo **Comercial**, o nome do cliente vem da cópia crua do pedido — o caso "D'Elia" continua lá como o Tiny guarda (1 caso).
- Cliente **sem telefone** renomeado no Tiny: o Comercial identifica pelo nome (D-46); as compras relidas ficam com o nome novo e as antigas (fora dos 60 dias) com o antigo — a identidade pode se dividir em dois (caso raro: 50 vendas sem telefone na auditoria de 09/09).
- As navegações em seu nome entre ~02:30 e ~03:30 de 01/10 na Auditoria incluem os **meus testes** (usei a sua sessão aberta no navegador do app).
- O seu pedido de teste (12835) teve 3 avisos de venda registrados (as edições de teste) e voltou ao original nos dois lados.

## 7. Arquivos

```
supabase/migrations/20261001120000_plt_tiny_pente_fino.sql   (49 — aplicada)
supabase/migrations/20261001130000_plt_auditoria.sql         (50 — aplicada)
supabase/testes/testar-migrations.mjs                        (blocos 49 e 50)
_docs/Supabase-fabrica/supabase-fabrica-schema.sql           (§10: fila, notas, contas e as funções VIVAS da carga — E-27)
src/auditoria/{api,rotulos,rotulos.test}.ts · src/paginas/Auditoria(.test).tsx
src/App.tsx · src/componentes/Layout.tsx · src/autenticacao/ProvedorSessao.tsx
_docs/Fabrica n8n/domoby-backfill-tiny.json (espelho: gatilho pelo banco) · N8N - Backfill · N8N - Workflow Tiny para Planilha · N8N - Pendencias e Riscos (P17 ✅)
_docs: demanda · D-95…D-98 (+ ↪️ D-40/D-50) · RF-115…117, RNF-08 · esquema · memória (E-74, E-75, A-43…A-45) · execução · este handoff · mapa · próximos passos · ordem
```
Commit separado, sem nenhuma alteração: a sua revisão das pendências no Cowork (01/10, D-90…D-94), que estava salva só na pasta.

## 8. Como validar

1. **Painel admin → Auditoria → Conferências com o Tiny:** a rodada da madrugada com os números e os pedidos que estavam diferentes.
2. **Painel admin → Auditoria → Atividade:** filtre "Movimentações de cards" ou busque um nº de pedido.
3. No banco (só leitura):
```sql
-- as rodadas (uma linha por conferência)
select recebido_em, payload->>'estado' as estado, payload->>'relidos' as relidos, payload->>'mudaram' as mudaram
  from public.eventos where tipo = 'pente_fino' order by id desc limit 5;
-- a conferência agendada (03:00 de Natal = 06:00 UTC); o relógio da fila só aparece durante a rodada
select jobname, schedule from cron.job where jobname like 'plt-tiny%';
-- rodar uma conferência agora (à mão):
-- select plt_privado.fn_tiny_pente_fino_iniciar('manual');
```

## Ver também

[[handoff_2026_09_22_sessao21_cutover]] (a conferência de 22/09 que originou esta) · [[N8N - Pendencias e Riscos]] (P17) · [[PLT - Decisoes de Produto]] · [[SUPA - Esquema do Banco]]
