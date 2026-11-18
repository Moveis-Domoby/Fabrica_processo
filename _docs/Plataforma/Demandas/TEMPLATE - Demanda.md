---
titulo: "SESSAO-NN — Título da demanda"
tipo: demanda
status: rascunho
data: AAAA-MM-DD
atualizado: AAAA-MM-DD
tags: [plataforma, demanda]
---

# 🎯 SESSAO-NN — Título da demanda

> Copie para `Plataforma/Demandas/SESSAO-NN - Titulo Curto.md` e acrescente a linha em [[000 - ORDEM DAS SESSOES]]. Status: `🔶 rascunho` → `📐 pronta para code` → `🔨 em execução` → `✅ entregue`.
> **Uma demanda só fica "pronta para code" quando o Claude Code conseguir executá-la sem perguntar nada de negócio.**
> **Teto: 25 KB.** O que a sessão descobrir e decidir não entra aqui — vai para a nota da decisão, a nota do tema e o handoff.

## O pedido do dono (texto fiel)

*As palavras dele, com a data. É o que desempata qualquer dúvida de interpretação.*

## O que é

*Uma frase. Qual dor resolve, para quem.*

## Leitura da sessão

*O que o Claude Code lê além da camada 1 (o `CLAUDE.md` e as [[000 - REGRAS DE OURO]], que ele lê sempre). Liste **os mapas das áreas que a demanda toca** e **só as notas que ela exige** — o Cowork preenche ao escrever. O verificador soma tudo: `node scripts/cofre/verificar.mjs --leitura "<este arquivo>"` (meta ≤ 150 KB).*

- Mapas: *ex.: [[MOC - PCP]] · [[MOC - Logistica e ROTAS]]*
- Decisões que regem (as que a demanda muda ou das quais depende): *ex.: a nota de cada uma — o mapa da área traz a ligação*
- Banco (se houver SQL): *a nota do domínio, ex.: [[Banco - PCP e Liberacao 3]]*
- Design (se houver tela): *a nota do assunto, ex.: [[Design - Estoque e PCP]]*
- Lições do tema, handoff anterior da área, outras notas: *só se a demanda precisar*

## Requisitos cobertos

*IDs de [[PLT - Requisitos]] que esta demanda implementa.*

## Comportamento esperado

*Passo a passo do que o usuário vê e faz. Telas, estados, cliques. Sem tecnicês — comportamento.*

## Fora do escopo

*O que explicitamente NÃO entra nesta demanda (evita o Claude Code "aproveitar para fazer").*

## Critérios de aceite

- [ ] *Verificável: "ao mover o card X para Y, o timer de fila de Y começa a contar"*
- [ ] *Checklist de desempenho das Regras de Ouro cumprido nas telas e portas tocadas.*
- [ ] *Verificador do cofre com zero erro (`verificar.mjs --gerar` e `verificar.mjs`).*

## Notas para o Claude Code

*Restrições técnicas e armadilhas conhecidas. Toda citação de decisão ou lição é ligação (o verificador escreve: `--ligar`).*

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)

*Os links das tarefas desta demanda — texto humanizado, tudo como tarefa. O Claude Code move para "fazendo" e nunca conclui.*

## Resultado (preencher ao entregar)

*O que foi feito, o que mudou de rota, a ligação do handoff da sessão.*
