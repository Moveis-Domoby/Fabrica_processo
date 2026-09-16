---
titulo: "SESSAO-20 — União 2: Módulo Comercial no front"
tipo: demanda
status: pronta para code
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

0. **Primeiro de tudo — fechar a exposição da `vendas_marketing`** (achado na avaliação da SESSAO-19, em 15/09). A view é SECURITY DEFINER (roda como `postgres` e ignora a RLS de `pedidos`/`clientes`, que estão com RLS ligada e **zero policies**) e está concedida a `authenticated` inteira. As 6 tabelas do Comercial têm gate de módulo; a view **não tem nenhum**. Resultado hoje: qualquer usuário logado — inclusive operador do galpão sem o módulo `comercial` — lê a base inteira de clientes (nome, telefone, valor, itens) por `GET /rest/v1/vendas_marketing`. A anon key **não** alcança (a ACL só tem `authenticated` e `service_role`), então não é vazamento público; é vazamento interno, e vira problema real quando os ~30 logins existirem.
   Correção no padrão que a casa já usa (`plt_fn_dash_*` é SECURITY DEFINER com gate dentro): `revoke select on public.vendas_marketing from authenticated` e converter as 10 RPCs do Comercial para SECURITY DEFINER com `plt_privado.fn_tem_modulo('comercial')` no topo, negando quem não tem o módulo. **Antes de revogar, conferir se o front lê a view direto** (`useFilterOptions.ts` e vizinhos no repo do recompra) — se ler, essa leitura também vira RPC com gate. Migration própria, testada no harness, aplicada só com OK do dono (regra crítica 2).

1. **Navegação**: grupo "Fábrica" (pai) com Controle de Produção, Logística e ROTAS por baixo — **o pai Dashboards não entra na reorganização** (os dashboards da produção ficam onde estão, com os nomes que a SESSAO-16 entregou; ver Q-66) (`/fabrica/producao/:setor`, `/fabrica/logistica/*`, `/fabrica/rotas/*`); redirects de TODAS as rotas atuais (nenhum bookmark de tablet quebra); "Administração" → **"Painel admin"** (só o rótulo; rotas `/admin/*` intactas); grupos "Fábrica" e "Comercial" visíveis conforme `plt_usuarios.modulos` (admin vê tudo).
2. **Módulo Comercial** em `src/comercial/`: porte 1:1 do `src` do recompra — painel principal (filtros + KPIs + tabela de clientes), Dashboard analítico (Recharts), Listas de Disparo completas (criar, adicionar, disparar, auditoria, scorecards). Rotas `/comercial/recompra`, `/comercial/dashboard`, `/comercial/listas`, `/comercial/listas/:id`. Nada de comportamento muda: mesmos fluxos, mesmos textos, mesmos IDs de teste dos botões (`btn-disparar-lista`, `btn-confirmar-disparo`, …).
3. **Trava de disparo até o cutover — obrigatória.** Desde 15/09 os 4 secrets (`TINY_CLIENT_ID`, `TINY_CLIENT_SECRET`, `DATACRAZY_WEBHOOK_TRIGGER_URL`, `DATACRAZY_WEBHOOK_SECRET`) **já estão configurados na fábrica**. Isso significa que `disparar-membro-individual` e `enviar-proximo-disparo` estão plenamente funcionais aqui: não há cron, mas **um clique no botão manda WhatsApp de verdade para cliente de verdade** — e o painel antigo continua sendo o dono da operação até o cutover (D-46, risco 3). Portanto o módulo nasce com uma trava explícita: uma constante única (ex.: `DISPARO_LIBERADO = false` em `src/comercial/`) que desabilita os botões de disparo (individual e fila) e o "Iniciar fila", com tooltip dizendo que o disparo ainda roda no painel antigo. Todo o resto da tela de listas funciona normal. A SESSAO-21 vira essa chave no cutover — é uma linha. **Não** remover nem contornar a trava para "testar".

4. **Paleta**: os temas claro/escuro verde-esmeralda do recompra entram no design system (`tokens.css`, camada semântica) como temas novos; o módulo consome tokens semânticos como qualquer tela da casa.
5. Client Supabase: o da fábrica (`@/lib/supabase`). Dependências novas: `recharts`, `date-fns`, `papaparse`, `@tanstack/react-virtual`, `react-hot-toast` (mantido no módulo). Tailwind v3→v4 adaptado na build, não na aparência.

## Fora do escopo

Crons, cutover, DataCrazy (SESSAO-21). Qualquer disparo real de WhatsApp (congelamento da D-46). Melhorias/refatorações no código portado ("aproveitar para fazer" não existe). O código morto conhecido do recompra (`useCustomerFilters`, `useDashboardData`, `useItemsData`, `useTopItemsOverallData`, `useTransitionData`, `lib/datacrazy/client.ts`, `ListasDisparoMain.tsx`) **não é portado** — não é perda, é lixo catalogado no cofre de lá.

## Critérios de aceite

- [ ] Lado a lado com o painel antigo: mesmos números nos KPIs, gráficos e scorecards (mesmo período, mesmos filtros), **descontadas a deriva de identidade já documentada no handoff da 19** (2 clientes a menos e 2 recorrentes a mais — R$ 9.442,55 que saem de "1 compra" e entram em "2 compras", pelos pedidos 8223/13082 e 8711/12837, de gente que trocou de telefone entre uma compra e outra) **e o delta de pedidos do dia**.
- [ ] Usuário logado **sem** o módulo `comercial` não lê nada do Comercial por API: `GET /rest/v1/vendas_marketing` e as 10 RPCs negam; com o módulo, tudo responde igual a hoje.
- [ ] Fluxo de lista completo funciona até a véspera do disparo (criar lista, adicionar membros, salvar mensagem) — **sem disparar**.
- [ ] Trava de disparo ativa: botões de disparo individual, de fila e "iniciar fila" desabilitados com explicação na tela; nenhuma chamada a `disparar-membro-individual` ou `enviar-proximo-disparo` sai do front durante toda a sessão. Conferir no fim da sessão que `listas_disparo_eventos` não ganhou nenhum evento de envio e que `listas_disparo_membros` continua com os mesmos 128 registros e status.
- [ ] Usuário sem módulo `comercial` não vê o grupo no menu e recebe redirect ao tentar a URL direta; operador comum continua vendo exatamente o que via antes.
- [ ] Todas as rotas antigas redirecionam; `/tablet` intocada; sidebar/voltar/sino presentes nas telas novas (D-36).
- [ ] Screenshot de cada tela nova no handoff.

## Notas para o Claude Code

Ler [[PLT - Plano Uniao das Plataformas]] (em especial a seção *Convivência com a SESSAO-16*) e o cofre do recompra (`_Docs/` de lá: `TELA - Filtros.md`, `PAINEL - Graficos do Dashboard.md`, `MM - Maquina de Estados do Disparo.md`, `DT - Indice de Problemas Conhecidos.md`) antes de portar.

**Depende só da SESSAO-19**, que está entregue e mesclada (PR #3). ↩️ **Ordem invertida em 15/09 por decisão do dono:** a 20 roda **antes** da 16 — some a dependência que existia aqui. Consequência prática: agora é a **20 que fixa o Recharts** (versão e tokens de cor de série no `tokens.css`), e a 16 herda. Registrar a versão escolhida no handoff, porque a 16 vai partir dela. As duas continuam disputando `App.tsx`, `Layout.tsx` e `tokens.css`: quem chegar depois parte da `main` com esta dentro.

## Resultado (preencher ao entregar)

✅ **Entregue em 16/09/2026** — [[handoff_2026_09_16_sessao20_modulo_comercial]] · branch `sessao-20-uniao-modulo-comercial` (aguardando merge).

- **Item 0 — correção do diagnóstico:** a `vendas_marketing` **já tinha gate** (`WHERE fn_tem_modulo('comercial')`, migration 26) — não havia vazamento interno aberto. Verificado no banco vivo antes de codar. O que faltava era **negar em vez de devolver vazio**: migration 27 (opção A, aprovada pelo dono) com as 10 RPCs em SECURITY DEFINER + gate que recusa, ACL enxuta e 2 portas novas (`fn_clientes_consolidados`, `fn_vendas_cliente`) para as leituras diretas de view.
- **Recharts fixado em `3.9.2` (exato)** e **tokens de cor de série `--dm-serie-1..6`** criados — a SESSAO-16 herda os dois.
- Números conferidos contra o painel antigo: receita e pedidos **ao centavo**; divergências só a deriva de identidade da S19 + delta do dia.
- **Zero disparo** na sessão: 128 membros com checksum de status idêntico ao da carga da S19.
- Revisão de UI/UX do dono em 3 rodadas gerou correções estruturais (tema único, container query nos números, hierarquia do menu, preview de tema, layout das configurações) — detalhe no handoff §3 e lições E-29..E-32.
