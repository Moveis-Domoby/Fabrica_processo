---
titulo: "SESSAO-16 — Dashboards de Verdade"
tipo: demanda
status: pronta para code
data: 2026-08-28
atualizado: 2026-08-28
tags: [plataforma, demanda, bloco-3]
---

# 🎯 SESSAO-16 — Dashboards de Verdade

> O dono viu a página da SESSAO-10 e disse: "isso não é uma dashboard". Esta sessão
> reconstrói a cara dos dashboards — os DADOS já existem (migration 18); o que muda é
> a apresentação, guiada por imagem (D-42).

## O que é

Reconstruir `/dashboards/...` nos moldes de `docs/inspiracao/dashboards/` (4 mockups
PNG + `000-LEIA-ME.md` com as regras de construção).

## Decisões que regem esta demanda

**D-42** + D-32 (tempo em 1º lugar; só líder/admin — gate no banco mantido), D-02
(fila × execução), D-29 (tempo útil), D-27 (sem códigos internos na UI).

## Comportamento esperado

1. **ANTES DE CODAR: abrir e olhar as 4 imagens** de `docs/inspiracao/dashboards/` e
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

## Notas para o Claude Code

Biblioteca de gráfico: pode escolher (Recharts é o caminho natural na stack) — avisar
no checkpoint (dependência nova, regra crítica 3). Respeitar temas da S13 (as cores de
série vêm de token, testar no claro e no escuro). Tudo loga (D-40).

## Resultado (preencher ao entregar)

—
