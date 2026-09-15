---
titulo: "SESSAO-20 — União 2: Módulo Comercial no front"
tipo: demanda
status: rascunho
data: 2026-09-15
atualizado: 2026-09-15
tags: [plataforma, demanda, uniao, comercial, front]
---

# 🎯 SESSAO-20 — União 2: Módulo Comercial no front

## O que é

O Painel de Recompra recriado **idêntico** dentro da plataforma como o módulo **Comercial**, e a reorganização da navegação: "Fábrica" vira pai de Produção/Logística/ROTAS e "Administração" vira "Painel admin". Fase F4 de [[PLT - Plano Uniao das Plataformas]].

## Decisões que regem esta demanda

**D-46**, D-36 (lei de navegação pai→filho, redirects obrigatórios das rotas antigas), D-27 (modelo de sistema, sem códigos internos na UI), D-40 (log de toda atividade — vem de graça pela casca), D-41 (temas).

## Comportamento esperado

1. **Navegação**: grupo "Fábrica" (pai) com Controle de Produção, Logística e ROTAS por baixo — **o pai Dashboards não entra na reorganização** (os dashboards da produção ficam onde estão, com os nomes que a SESSAO-16 entregou; ver Q-66) (`/fabrica/producao/:setor`, `/fabrica/logistica/*`, `/fabrica/rotas/*`); redirects de TODAS as rotas atuais (nenhum bookmark de tablet quebra); "Administração" → **"Painel admin"** (só o rótulo; rotas `/admin/*` intactas); grupos "Fábrica" e "Comercial" visíveis conforme `plt_usuarios.modulos` (admin vê tudo).
2. **Módulo Comercial** em `src/comercial/`: porte 1:1 do `src` do recompra — painel principal (filtros + KPIs + tabela de clientes), Dashboard analítico (Recharts), Listas de Disparo completas (criar, adicionar, disparar, auditoria, scorecards). Rotas `/comercial/recompra`, `/comercial/dashboard`, `/comercial/listas`, `/comercial/listas/:id`. Nada de comportamento muda: mesmos fluxos, mesmos textos, mesmos IDs de teste dos botões (`btn-disparar-lista`, `btn-confirmar-disparo`, …).
3. **Paleta**: os temas claro/escuro verde-esmeralda do recompra entram no design system (`tokens.css`, camada semântica) como temas novos; o módulo consome tokens semânticos como qualquer tela da casa.
4. Client Supabase: o da fábrica (`@/lib/supabase`). Dependências novas: `recharts`, `date-fns`, `papaparse`, `@tanstack/react-virtual`, `react-hot-toast` (mantido no módulo). Tailwind v3→v4 adaptado na build, não na aparência.

## Fora do escopo

Crons, cutover, DataCrazy (SESSAO-21). Qualquer disparo real de WhatsApp (congelamento da D-46). Melhorias/refatorações no código portado ("aproveitar para fazer" não existe). O código morto conhecido do recompra (`useCustomerFilters`, `useDashboardData`, `useItemsData`, `useTopItemsOverallData`, `useTransitionData`, `lib/datacrazy/client.ts`, `ListasDisparoMain.tsx`) **não é portado** — não é perda, é lixo catalogado no cofre de lá.

## Critérios de aceite

- [ ] Lado a lado com o painel antigo: mesmos números nos KPIs, gráficos e scorecards (mesmo período, mesmos filtros).
- [ ] Fluxo de lista completo funciona até a véspera do disparo (criar lista, adicionar membros, salvar mensagem) — **sem disparar**.
- [ ] Usuário sem módulo `comercial` não vê o grupo no menu e recebe redirect ao tentar a URL direta; operador comum continua vendo exatamente o que via antes.
- [ ] Todas as rotas antigas redirecionam; `/tablet` intocada; sidebar/voltar/sino presentes nas telas novas (D-36).
- [ ] Screenshot de cada tela nova no handoff.

## Notas para o Claude Code

Ler [[PLT - Plano Uniao das Plataformas]] (em especial a seção *Convivência com a SESSAO-16*) e o cofre do recompra (`_Docs/` de lá: `TELA - Filtros.md`, `PAINEL - Graficos do Dashboard.md`, `MM - Maquina de Estados do Disparo.md`, `DT - Indice de Problemas Conhecidos.md`) antes de portar.

**Depende da SESSAO-19 E da SESSAO-16 entregues e mescladas** — a 16 escreve nos mesmos `App.tsx`, `Layout.tsx` e `tokens.css`. Partir da `main` já com a 16 dentro. A biblioteca de gráfico vem da 16 (Recharts): **não** adicionar uma segunda ao `package.json`; se a 16 tiver escolhido outra, parar e perguntar antes de portar os dashboards do Comercial.

## Resultado (preencher ao entregar)

*—*
