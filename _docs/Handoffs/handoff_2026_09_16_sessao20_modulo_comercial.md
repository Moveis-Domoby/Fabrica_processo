---
titulo: Handoff — SESSAO-20 União 2 · Módulo Comercial no front
tipo: handoff
data: 2026-09-16
atualizado: 2026-09-16
tags: [handoff, sessao, plataforma, uniao, comercial, front]
---

# 📋 Handoff — SESSAO-20 · União 2: Módulo Comercial no front — a 2ª do bloco União (D-46)

**Branch:** `sessao-20-uniao-modulo-comercial` — **revisada na conversa e mesclada na `main` em 16/09, já publicada no remoto** (D-20)
**Banco:** migration **27** (`20260915180000_plt_comercial_gate_negacao_temas.sql`) aplicada em 15/09 com seu OK na conversa, pela API (mesmo caminho da S15/S19 — A-15). Impressão digital da integração antes = depois (`7bd6bac6…`). **Edge Function `autenticacao` v8** no ar.
**Demanda:** [[SESSAO-20 - Uniao 2 - Modulo Comercial no Front]] · **Memória:** `_docs/Plataforma/Execucao/SESSAO-20.md`
**Decisões que regem:** **D-46** (a união) · D-36 (lei de navegação) · D-27 (modelo de sistema) · D-41 (temas) · D-47 · regra crítica 2

## 1. O que foi feito

- **Item 0 — a exposição da `vendas_marketing`, com o diagnóstico corrigido.** A demanda dizia que a view não tinha gate; **tinha** (`WHERE fn_tem_modulo('comercial')`, desde a migration 26) — conferido no banco vivo antes de codar. O que faltava de verdade era **negar em vez de devolver vazio**. Na opção A que você aprovou: as 10 RPCs viraram SECURITY DEFINER com `fn_negar_sem_modulo` no topo (corpo das queries intacto — nenhum número mudou), `authenticated` perdeu o SELECT direto de `vendas_marketing` e `vw_clientes_consolidados`, e nasceram 2 portas gateadas (`fn_clientes_consolidados`, `fn_vendas_cliente`) para as leituras que o front fazia direto na view.
- **Módulo Comercial em `src/comercial/`** — 40 arquivos vivos do recompra copiados **verbatim** (os 7 mortos catalogados ficaram de fora). Um adaptador de 1 linha entrega o client da fábrica, então **nenhum import dos arquivos portados foi tocado**. Rotas `/comercial/recompra`, `/comercial/dashboard`, `/comercial/listas` e `/comercial/listas/:id`; o view-state do App.tsx de lá virou rota.
- **Trava de disparo (D-46, risco 3)** em três camadas: `DISPARO_LIBERADO = false`, botões desabilitados com explicação, e guarda dentro de `handleRegistrarEnvio` e `iniciarFila` — nenhum caminho dispara. A SESSAO-21 vira **uma linha**.
- **Navegação (D-36):** pai **Fábrica** (Controle de Produção, Logística e ROTAS como seções recolhíveis na barra 2), pai **Comercial**, "Administração" → **"Painel admin"** (só o rótulo). Redirects de **todas** as rotas antigas; `/tablet` intocada. Sem o módulo `fabrica` somem Fábrica, Dashboards e o botão Modo tablet (sua resposta); sem `comercial`, some o Comercial e a URL direta redireciona.
- **Temas:** `esmeralda` e `esmeralda-escuro` entraram no design system (catálogo 8 → **10**), com o check do banco ampliado na migration 27.
- **Criação de usuário concede `fabrica`** (sua resposta) — `autenticacao` v8 deployada.
- **Revisão de UI/UX (3 rodadas com você, 15–16/09)** — correções estruturais no §3.

## 2. Verificação executada (critérios da demanda)

| Critério | Resultado |
|---|---|
| Lado a lado com o painel antigo: mesmos números | ✅ Comparação direta nos dois bancos vivos (corte até 14/09): receita **R$ 4.386.602,88** e **5.304 pedidos** ao centavo; `revenue_chart` e `top_items` com **md5 idêntico**; clientes 4.090×4.092 e recorrentes 808×806 = exatamente a deriva de identidade documentada na S19 |
| Sem o módulo, nada do Comercial responde | ✅ No banco real com JWT simulado: RPC **nega** com "Você não tem acesso ao módulo Comercial…" e a view dá *permission denied*; com o módulo, tudo responde igual |
| Fluxo de lista completo até a véspera do disparo | ✅ Listas, membros, scorecards e auditoria funcionando (4 campanhas, 128 membros) |
| Trava de disparo ativa | ✅ `btn-disparar-lista` desabilitado com o texto explicativo (conferido no DOM); **nenhuma** chamada saiu |
| `listas_disparo_*` intactas ao fim da sessão | ✅ **128 membros, checksum de status idêntico ao da carga da S19** (`6e4460f5…`), 288 eventos, último evento de 12/09 (anterior à sessão) |
| Rotas antigas redirecionam; `/tablet` intocada | ✅ `/producao/:codigo`, `/logistica/*`, `/rotas/*`, `/pcp`, `/expedicao`, `/setores/:id` |
| Screenshot de cada tela nova | 🟠 **parcial** — ver §5 |

`tsc` ✅ · `lint` ✅ · `vitest` **47/47** ✅ · `build` ✅ · `test:banco` **TUDO VERDE em 2 rodadas** (+12 verificações da S20)

## 3. As correções de UI/UX da revisão (o que eu tinha errado)

Você recusou a primeira rodada — com razão: eu tratei sintoma (truncate, esconder ícone, altura forçada). A análise achou **causas raiz**:

| Sintoma que você viu | Causa raiz | Correção |
|---|---|---|
| Comercial verde no tema amarelo | o módulo tinha **paleta paralela** escopada, ignorando o tema | vocabulário shadcn virou **apelido dos tokens da casa** |
| Gráfico sumia | gráficos liam `hsl(var(--primary))`, variável que não existia na casa | viraram `var(--…)` e as cores passaram a resolver |
| "Dois amarelos diferentes" | uma série tinha **verde cravado**, outra usava **opacidade** sobre a ação (muda o tom) | séries usam tokens **sólidos** `--dm-serie-N` |
| Valor vazando / cortado | tamanho por **breakpoint de viewport**, que não enxerga a sidebar (~450px) | **container query** + grid `auto-fit/minmax` calibrado pelo dado mais largo |
| KPI destoante | fórmulas **diferentes por cartão** | **uma classe só** para a linha, calibrada pelo pior caso |
| Não recentraliza / faixa vazia | teto de largura estrangulando o conteúdo | teto removido — em 2400px o conteúdo foi de 1760 → **1937px (99%)** |
| Menu amarelo no esmeralda | destaque do item ativo era `marca-500` **fixo** | tokens `--dm-menu-ativo/-destaque` que seguem o tema |
| Hierarquia confusa no menu | seção e item em caixa alta no mesmo tamanho | 3 níveis por **tamanho, peso, cor e indentação** |
| Preview de tema todo amarelo | bolinha era `bg-marca-500` fixa | `AMOSTRA_TEMA` ganhou `acao` por tema |
| Configurações desalinhadas + buraco | `max-w-3xl` **sem** `mx-auto`; depois grid alinhando alturas desiguais | **fluxo em colunas CSS** (`columns` + `break-inside-avoid`) |

Medição objetiva de vazamento (script comparando `scrollWidth` × `clientWidth` de cada número): **zero** em 700, 900, 1280, 1920 e 2400px, sem rolagem horizontal.

## 4. Como validar (10 minutos)

1. `npm run dev`, entre com seu login. **Recarregue com Ctrl+F5** na primeira vez (o HMR desta sessão mexeu bastante em CSS).
2. **Comercial → Painel de Recompra:** compare KPIs e tabela com o painel antigo (mesmo período). Diferença esperada: só a deriva da S19 + o delta do dia.
3. **Comercial → Dashboard:** gráficos, scorecards e listas Top 30/Top 50.
4. **Comercial → Listas de Disparo → abrir uma lista:** confira que **Disparar** e **Enviar** estão desabilitados com a explicação. *Não force o clique.*
5. **Meu Perfil → Tema:** troque para **Esmeralda** e depois para um amarelo. Toda a plataforma (inclusive menu e gráficos) deve mudar junto.
6. **Rotas antigas:** abra `/pcp` e `/logistica/estoque` — devem redirecionar para `/fabrica/...`.
7. **Zoom (Ctrl −/+):** o conteúdo deve ocupar a tela e nenhum número deve vazar do cartão.

## 5. Pendente / decisões para você

- ✅ **Merge na `main` feito em 16/09** com sua aprovação na conversa, e enviado ao GitHub (`fe203b7`).
- ✅ **Screenshots:** dispensados por você — a validação foi feita ao vivo na sua tela.
- ✅ **Confirmado por você em 16/09:** o uso está bom e os gráficos se adaptaram ao zoom.
- ✅ **Texto do item 0 da demanda corrigido** em 16/09: o diagnóstico errado ficou registrado como tal, junto com o que de fato foi entregue.
- ✅ **Advisors pré-existentes de outra frente** (backfill/vigia): passados para a [[SESSAO-21 - Uniao 3 - Cutover e Desligamento]], explicados em bom português e com o risco de cada um — o mais sério é a `fn_pedido_por_numero_nf`, que responde a quem **não tem login**.
- ⚪ **Bundle em ~1,7 MB** (o Recharts entrou) — é o DT-ARQ9 já catalogado no cofre do recompra; não refatorei porque está fora do escopo.
- **Para a SESSAO-16:** herda **Recharts 3.9.2 (exato)** e os **tokens de série** `--dm-serie-1..6`, e parte da `main` com esta dentro.
- **Para a SESSAO-21:** a trava é **uma linha** (`DISPARO_LIBERADO` em `src/comercial/travas.ts`).

## 6. Notas do cofre atualizadas

[[SUPA - Esquema do Banco]] (migration 27) · [[PLT - Modelo de Sistema]] (tokens de série, número por container query, ajuste a zoom) · [[PLT - Memoria de Aprendizado]] · [[000 - ORDEM DAS SESSOES]] · [[SESSAO-20 - Uniao 2 - Modulo Comercial no Front]] (resultado) · memória de execução `_docs/Plataforma/Execucao/SESSAO-20.md`

## Ver também

[[handoff_2026_09_15_sessao19_banco_comercial]] · [[PLT - Plano Uniao das Plataformas]] · [[SESSAO-21 - Uniao 3 - Cutover e Desligamento]] (a próxima do bloco)
