---
titulo: Handoff — SESSAO-25 · O estoque completo (Tiny, reservas, reposição no PCP, mínimos)
tipo: handoff
data: 2026-09-26
atualizado: 2026-09-26
tags: [handoff, sessao, plataforma, bloco-5, estoque, tiny, d-54, d-55, d-56, d-57]
---

# 📋 Handoff — SESSAO-25 · O estoque completo (D-54…D-57)

**Branch:** `sessao-25-estoque-completo` — **aguardando sua validação e o merge (D-20)**
**Banco:** migration **36 APLICADA em 26/09** com o seu OK na conversa, pelo aplicador de sempre (F-08): reaplicação das 36, **integração do Tiny com estrutura e linhas idênticas antes/depois**. Advisors: só as 4 portas novas do estoque (endpoints de propósito, padrão E-11).
**Carga do saldo:** rodada por você no n8n em 26/09 (21:16–21:26 UTC) — **442 avisos, 442 produtos**.
**Demanda:** [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] · **Memória:** `_docs/Plataforma/Execucao/SESSAO-25.md` · **Decisões novas:** D-54, D-55, D-56, D-57 (suas respostas de 26/09)

## 1. O que foi feito

- **O número do estoque (D-55).** Para cada produto do catálogo da fábrica: o saldo que o Tiny mandou por último (o aviso de lançamento de estoque, ou a carga inicial) **menos o que a loja já vendeu e ainda não saiu** (itens de pedidos da loja em aberto/aprovado/preparando envio, casados por SKU, sem personalizado, sem cancelado). **Nunca aparece negativo**: passou do zero, a tela mostra 0 e a pílula **"Necessidade extrema — N vendidos sem estoque"**. Nada foi guardado em tabela nova: o saldo é lido direto dos avisos.
- **Estoque em duas telas + sugestão (D-57).** `Fábrica → Logística → Estoque` virou três abas:
  - **Produtos acabados** (fabricados, simples/revenda e variações): por produto — Em estoque · Mínimo (Tiny) · Reservados · Livres na plataforma (nunca somados), o sinal com ícone + texto, a linha "Tiny: 3 − 2 vendidos pela loja ainda sem sair · lido há 2 h" e "Ver as peças" (reservada = SKU + pedido; livre = veio da reposição);
  - **Matéria-prima e insumos** (peças, MDF, parafusos, kits) — o adiantamento do estoque de peça;
  - **Sugestão de mínimo** — os 20 mais vendidos dos 90 dias, com rank, média por semana e a sugestão (média × 1, 2 ou 4 semanas — escolha na tela).
  Tudo paginado no servidor, com busca e filtros (abaixo do mínimo, necessidade extrema, com reservados, com livres, sem leitura do Tiny).
- **Reposição no PCP (D-54).** Novo tipo de card: quando um produto fica abaixo do mínimo do Tiny, o estoque gera no PCP o **card de reposição** ("Repor N unidades"). O PCP decide: **Liberar unidades** (mesmo modal dos pedidos; as unidades nascem sem pedido, rodam os setores e, prontas, ficam **livres** no estoque) ou **Não produzir** (arquiva, em dois toques). Um ciclo por produto; depois de concluído, só pede de novo quando o Tiny mandar leitura nova daquele produto. **A geração automática está DESLIGADA** até você mandar ligar (ver §4).
- **O ESTOQUE só recebe peça 🟢 (D-54).** Regra no banco; mover/concluir/resolver danificado para o ESTOQUE só oferecem "Perfeito estado".
- **ID = SKU (D-56, fecha a Q-63).** O campo livre "ID de produção" saiu da tela.
- **Card sem pedido** aparece como "Reposição de estoque" nos quadros, no tablet, nos modais, nos afazeres e nos Danificados.
- **Carga do saldo:** workflow **separado** `_docs/Fabrica n8n/domoby-tiny-fabrica-carga-saldo.json` (o de produção não foi tocado).

## 2. Verificação executada

| O quê | Resultado |
|---|---|
| `npm run test:banco` (2 rodadas) | ✅ tudo verde — **27 cenários novos**: leitura do Tiny (CNPJ e formato), reserva da loja (personalizado/cancelado/entregue fora), necessidade extrema, geração da reposição (sem duplicar, quantidade, ciclo, leitura nova, arquivar), liberação completa, ESTOQUE só 🟢 (a recusa desfaz a marcação junto), reservadas × livres, Danificados, sugestão top 20 |
| `npx tsc -b` · `npm run lint` · `npm test` · `npm run build` | ✅ · ✅ · ✅ 56/56 (+7 do sinal do estoque) · ✅ |
| Mojibake (E-34) | ✅ zero |
| **F-08 no banco real** | ✅ migration 36 aplicada; integração idêntica (estrutura e linhas) |
| **Ensaio A-11 no banco real** (rollback — zero linha) | ✅ leitura do 327 → "repor 3"; a maquinaria gerou 1 card e, rodando de novo, 0; o card apareceu no quadro do PCP; liberar contou 1; **🟡 para o ESTOQUE recusado** com a mensagem certa; 🟢 entrou e virou livre (0 → 1) |
| Gate | ✅ sem usuário, as portas devolvem 0 (operador de produção: provado no harness — em produção só há admins) |
| **Telas no navegador (sua sessão)** | ✅ Estoque: 234 acabados / 208 insumos, peças do produto ("Reservada · Pedido 13215 (1/1) · SKU 174"), sugestão top 20 (327 → 15 em 2 semanas … 484 → 4), leitura da carga na tela ("Tiny: −12 − 2 vendidos… (carga inicial)") |
| **E2E da reposição** (produto de teste do Tiny, arquivado ao fim) | ✅ card no PCP → Liberar 1 de 2 (CNC, fila "A USINAR") → "1 liberada" → **Não produzir** tirou o card → no CNC a peça aparece "Reposição de estoque (1/2)" → **Concluir só oferece 🟢** → entrou no ESTOQUE como livre ("Livre · veio da reposição") |
| F-07 (375px e 768px) | ✅ as 3 abas sem rolagem lateral e sem alvo abaixo de 44px (corrigido na hora: "Ver as peças" tinha 36px) |
| Advisors | ✅ segurança: só +4 WARN esperados (portas novas); desempenho: nada novo além do índice recém-criado |

## 3. Como validar (10 minutos)

1. **Estoque → Produtos acabados:** procure o **327**. Deve mostrar "Necessidade extrema — 7 vendidos sem estoque", Em estoque 0, Mínimo 4. Confira contra o seu papel do dia.
2. **Ver as peças** de um produto com reservado (ex.: SKU 174) → "Reservada · Pedido 13215".
3. **Matéria-prima e insumos:** a peça **A55** aparece com "No Tiny está −14 … aqui conta como 0" — é o seu print.
4. **Sugestão de mínimo:** troque a cobertura (1/2/4 semanas) e veja a sugestão mudar em ordem.
5. **Lançamento real no Tiny (o critério que só você faz):** dê uma entrada de 1 num produto qualquer no Tiny da fábrica e, em seguida, a saída. Em segundos o "Tiny: …" daquele produto muda na tela (recarregue a página).
6. **Depois de ligar a reposição (§4):** os cards aparecem no fim do PCP ("Reposição de estoque"); libere 1 unidade de um deles e siga até o ESTOQUE.

## 4. Pendente / decisões para você

- 🔶 **Ligar a reposição automática?** Com a carga de hoje, a primeira rodada criaria **44 cards de reposição no PCP, somando 121 unidades**. Em 37 deles o físico do Tiny está negativo. É só rodar `supabase/manutencao/2026-09-26_ligar_reposicao_automatica.sql` (prévia + 1ª rodada + agendamento a cada 5 min) — eu rodo quando você disser.
- 🔶 **O que o Tiny chama de estoque dos móveis não é uma contagem física.** Na carga, **93 de 168 fabricados estão com físico NEGATIVO**: venda que baixou sem o "pronto" correspondente, como a P16 das peças. E a **reserva do Tiny é maior que os pedidos abertos** (327: 44 reservados × 0 pedidos abertos; os serviços da fábrica — Corte, Furo, FITAMENTO — têm milhares). Por isso a plataforma calcula a reserva pelos pedidos da loja, não pelo número do Tiny. Vale conferir **no Tiny, na aba "reservas" do 327**, de onde vêm esses 44.
- ⚪ **Serviços como "Corte", "Furo" e "FITAMENTO"** estão cadastrados como produto simples no Tiny e aparecem na aba de acabados (com 0). Se quiser, eles saem da tela — é uma regra de uma linha, mas precisa do seu critério (nome? unidade?).
- ⚪ **Duas peças no ESTOQUE fora da regra nova:** 🔴 do pedido 13215 (penteadeira 521) e 🟡 do pedido 13203 (penteadeira 478). Estavam lá antes da regra; a logística decide (Danificados).
- ⚪ **Teste E2E ficou na história com o seu usuário:** card 571 (reposição de teste, arquivado pelo "Não produzir") e peça 572 (arquivada), ambos do produto "ZZ TESTE INTEGRACAO - APAGAR"; houve 2 avisos de "chegou ao ESTOQUE" no sino dos admins.
- ⚪ **Merge na `main`** (D-20) depois da sua validação.

## 5. Arquivos alterados

```
supabase/migrations/20260926120000_plt_estoque_completo.sql   (nova — migration 36)
supabase/testes/testar-migrations.mjs                         (27 cenários da S25)
supabase/manutencao/2026-09-26_ligar_reposicao_automatica.sql (prévia + ligar o cron — com OK do dono)
_docs/Fabrica n8n/domoby-tiny-fabrica-carga-saldo.json         (workflow separado da carga do saldo)
src/paginas/Estoque.tsx                                       (reescrita: 3 abas)
src/paginas/PCP.tsx                                           (card de reposição + Não produzir)
src/kanban/componentes/ModalLiberarPedido.tsx                 (modo reposição)
src/kanban/componentes/ModalMoverCard.tsx · src/paginas/Danificados.tsx (ESTOQUE só 🟢)
src/kanban/api.ts · src/kanban/tipos.ts · src/kanban/rotulos.ts (novo) · usePedidosDosCards
src/kanban/componentes/{CartaoUnidade,QuadroKanban,ModalLinhaTempo,ModalParecer}.tsx
src/tablet/CartaoTablet.tsx · src/paginas/{Afazeres,AfazeresDoTime}.tsx
src/logistica/api.ts · src/logistica/estoque.ts (novo) · src/logistica/estoque.test.ts (novo)
src/componentes/ui/Abas.tsx (novo) · src/componentes/ui/index.ts
_docs: D-53…D-57 · Q-23/Q-63 fechadas · RF-70…76 · Esquema do Banco · N8N (produtos, referência,
       pendências — P17 restaurada) · Modelo de Sistema · memória (E-42, E-43, A-22, A-23, A-24)
       · demandas 24/25 · ORDEM · MAPA · PRÓXIMOS PASSOS · Execucao/SESSAO-25.md · este handoff
```

## 6. Notas do cofre atualizadas

[[PLT - Decisoes de Produto]] (D-54…D-57) · [[PLT - Perguntas em Aberto]] (Q-23, Q-63) · [[PLT - Requisitos]] (RF-70…76) · [[SUPA - Esquema do Banco]] (migration 36) · [[N8N - Tiny Fabrica Produtos para Banco]] · [[N8N - Tiny Integracoes Referencia]] · [[PLT - Modelo de Sistema]] · [[PLT - Memoria de Aprendizado]] · [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]] · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]] · [[000 - PROXIMOS PASSOS]]

## Ver também

[[handoff_2026_09_23_sessao23_meu_painel_2]] · [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] · [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]
