---
titulo: "SESSAO-16 — Dashboards de Verdade"
tipo: demanda
status: entregue
data: 2026-08-28
atualizado: 2026-09-21
tags: [plataforma, demanda, bloco-3]
---

# 🎯 SESSAO-16 — Dashboards de Verdade

> O dono viu a página da SESSAO-10 e disse: "isso não é uma dashboard". Esta sessão
> reconstrói a cara dos dashboards — os DADOS já existem (migration 18); o que muda é
> a apresentação, guiada por imagem (D-42).

## O que é

Reconstruir `/dashboards/...` nos moldes de `_docs/Plataforma/Inspiracao/dashboards/` (4 mockups
PNG + `000-LEIA-ME.md` com as regras de construção).

## Decisões que regem esta demanda

**D-42** + D-32 (tempo em 1º lugar; só líder/admin — gate no banco mantido), D-02
(fila × execução), D-29 (tempo útil), D-27 (sem códigos internos na UI).

## Comportamento esperado

1. **ANTES DE CODAR: abrir e olhar as 4 imagens** de `_docs/Plataforma/Inspiracao/dashboards/` e
   ler o `000-LEIA-ME.md`. Elas são a régua de qualidade — não são pixel-perfect
   obrigatórias, mas o resultado precisa jogar no mesmo campeonato.
2. Quatro telas-filhas (pai **Dashboards**): **Visão do dia** (andon: heróis, tiles por
   setor, gargalo gritando, produção por hora, fim de linha) · **Tempo por setor**
   (fila vs execução empilhado, herói "a fila é X%", gargalo, tendência) · **Pessoas**
   (ranking + metas — reusa componentes da S14) · **Qualidade** (100% empilhado 3
   estados, herói % 🟢, danificados em aberto).
3. Filtros pill numa linha acima (período, setor, bruto/útil); hover/tooltip em toda
   marca; números-herói antes de gráfico; cores validadas do LEIA-ME (execução âmbar
   `#b8851e`, fila azul `#2563eb`; verde/laranja/vermelho SÓ qualidade).
   ⚠️ **Conciliar com os tokens de série que a SESSAO-20 criou** (`--dm-serie-1..6` em
   `tokens.css`): `--dm-serie-2` JÁ é o azul `#2563eb` do LEIA-ME — usar o token, não o
   literal. O âmbar de execução é o caso a resolver: `--dm-serie-1` é `var(--dm-acao)`,
   que muda com o tema (no esmeralda vira verde) e no claro é `#f1c24b`, mais claro que
   o `#b8851e` do LEIA-ME. Decidir uma das duas e registrar no handoff: ou fila/execução
   ganham tokens próprios (`--dm-serie-fila` / `--dm-serie-execucao`, fixos nos dois
   valores do LEIA-ME e com variante escura), ou o dashboard adota `--dm-serie-1/2` e o
   LEIA-ME é atualizado. **Não cravar hex em componente** — foi exatamente o defeito que
   a revisão da S20 corrigiu.
4. **Visualizações salvas da S10 continuam funcionando** (adaptadas às telas novas).
5. Visão do dia legível a distância (candidata a TV do galpão — fonte grande, alto
   contraste, atualização sozinha).

## Fora do escopo

Indicador novo que exija migration de dados nova (usar as portas da migration 18;
faltou dado pontual → view nova simples ok, com aprovação no checkpoint), exportação/
PDF, dashboards públicos.

## Critérios de aceite

- [ ] As 4 telas existem em `/dashboards/...` e seguem visivelmente os mockups (screenshot lado a lado no handoff).
- [ ] Gate D-32 intacto: líder só vê o próprio setor; operador não acessa.
- [ ] Filtros funcionam combinados e persistem na visualização salva.
- [ ] Tooltip em barras/pontos/células; sem gráfico de dois eixos; sem pizza.
- [ ] Visão do dia atualiza sozinha (realtime/polling) e é legível de longe.

## Herança da SESSAO-20 (entregue em 16/09 — ler antes de começar)

A 20 passou na frente desta e mudou o terreno. Partir da `main` com ela dentro e herdar,
sem reabrir nenhuma dessas decisões:

- **Recharts 3.9.2 (versão exata) já está no `package.json`.** A escolha de biblioteca
  deixou de ser desta sessão: usar essa, não adicionar outra nem mudar a versão.
- **Tokens de série `--dm-serie-1..6`** já existem em `tokens.css`, com variante para a
  família escura. São eles que as séries consomem (ver item 3).
- **Catálogo de temas foi de 8 para 10** (entraram `esmeralda` e `esmeralda-escuro`, com
  check no banco). Testar os dashboards em pelo menos um claro, um escuro e um esmeralda.
- **As rotas da fábrica mudaram** para `/fabrica/producao|logistica|rotas/...`. O pai
  **Dashboards não mudou de lugar** (decisão do dono — Q-66): as 4 telas continuam em
  `/dashboards/...`. O grupo aparece para quem é líder **e** tem o módulo `fabrica`.
- **Ler o §3 do [[handoff_2026_09_16_sessao20_modulo_comercial]]** — a tabela de causas
  raiz da revisão de UI/UX. A primeira rodada da 20 foi recusada por tratar sintoma, e
  as correções valem inteiras aqui: dimensionar por **container query** (não por
  breakpoint de viewport — a sidebar de ~450px não entra na conta), **uma fórmula só**
  para a linha de KPIs calibrada pelo pior caso, nada de teto de largura estrangulando o
  conteúdo, e destaque/ativo por token em vez de `marca-500` fixo. Repetir esses erros
  aqui é retrabalho garantido.

## Notas para o Claude Code

Respeitar os temas (as cores de série vêm de token, testar no claro, no escuro e no
esmeralda). Tudo loga (D-40). Medir vazamento de número objetivamente, como a 20 fez
(`scrollWidth` × `clientWidth` em 700/900/1280/1920/2400px), e pôr o resultado no
handoff junto com os screenshots lado a lado dos mockups.

## Resultado (preencher ao entregar)

✅ **Entregue em 18/09/2026** — [[handoff_2026_09_18_sessao16_dashboards]], mesclada na `main` pelo PR #4 (D-20).

- As **4 telas-filhas** em `/dashboards/visao-do-dia|tempo-por-setor|pessoas|qualidade` (Q-66), nos moldes dos mockups; a tela única da S10 saiu e `/dashboards/geral` redireciona.
- **Migration 28** (8 portas de leitura gateadas por `fn_setores_dashboard`; nenhuma tabela nova — D-47) aplicada em 18/09 com aprovação do dono; impressão digital da integração intacta.
- Item 3 resolvido como a demanda pedia: nasceram os tokens **`--dm-serie-fila`/`--dm-serie-execucao`** (fixos nos valores do LEIA-ME em todos os temas, com variante clara nos escuros) — o LEIA-ME ganhou a nota. Motivo: `--dm-serie-1` segue a ação do tema e no esmeralda viraria verde, exclusivo da qualidade.
- Decisões do dono no checkpoint (17/09): **concluída = chegou ao terminal final**; a **lista detalhada de execuções** mora na tela Pessoas (opção b); tempo por item na Tempo por setor; retrato do estoque no Fim de linha.
- Critérios provados: vazamento **zero** em 700–2400px nas 4 telas; temas claro/esmeralda/esmeralda-escuro; visualização salva com tela+filtros aplicável de qualquer tela (formato S10 traduzido por leitura); gate D-32 no `test:banco` e ao vivo.
