---
titulo: "SESSAO-55 — Telas que ainda abrem com mais de uma leitura (Meu Painel, painéis e configurações)"
tipo: demanda
status: 🔨 em execução (18/11/2026 — mesa da fila, sem o dono na conversa; nada no banco de produção, nada na main)
data: 2026-11-18
atualizado: 2026-11-18
origem: as dívidas 18 e 20 da [[PLT - Lei de Desempenho e Escala]] (§14). Pedido gravado pelo Escritório em `_escritorio/handoffs/sessao-55-telas-numa-leitura-prompt-claude-code.md`.
tags: [plataforma, demanda, desempenho, dashboards, configuracoes, meu-painel]
---

# 🎯 SESSAO-55 — Telas que ainda abrem com mais de uma leitura

> Demanda gravada pela própria mesa a partir do pedido do Escritório (primeiro passo do pedido). **Não está linkada na Ordem das Sessões** (o pedido manda não linkar — a nota é de outra mesa nesta leva).

## O que é

A Lei de Desempenho manda que cada tela abra com **1 requisição**, pela porta de abertura dela. Estas telas ainda abrem com 2 ou 3 leituras — esta sessão dá a cada uma a sua porta.

## Requisitos cobertos

RNF de desempenho (Lei §1, §2, §3, §7.4) — dívidas **18** e **20** do §14.

## Decisões que regem esta demanda

D-32 (quem vê dashboard), D-51/D-95 (tarefa pessoal privada), D-66/D-68 (dado pessoal fora da API; `plt_usuarios` por coluna), D-100 (super admin nas Automações), D-146/D-147, D-232 ("Tempo por setor" virou Tempos de produção), D-284 (`plt_fn_tempos_abertura` é o modelo de porta de abertura).

## Comportamento esperado (nesta ordem; se o tempo apertar, parar onde estiver e registrar o resto)

1. **Meu Painel/Afazeres:** o aviso do trabalho da pessoa relê 3 consultas (tarefas, bolinha, cards delegados). Juntar numa porta (dívida 20).
2. **Dashboards:** Pessoas, Qualidade e Meu desempenho, cada uma numa porta de abertura. "Tempo por setor" hoje redireciona para Tempos de produção; conferir, e se for só redirecionamento, registrar a dívida como paga.
3. **Configurações:** Equipe, API e integrações, Controle de tempo, Caminhões e Automações, cada uma numa porta de abertura.

Para quem usa, **nada muda na tela**: os mesmos números, os mesmos botões — só abre com menos idas ao banco.

## Fora do escopo (com o porquê no handoff)

- a configuração do Estoque — mexe com a reposição automática, que a mesa das rotinas pode tocar;
- Programação e Pedidos em aguardo — outra mesa;
- o Comercial;
- rotas, pedidos, busca, Auditoria, Estoque e PCP — de outras mesas ou ficam para depois.

## Critérios de aceite

- [ ] Cada tela tocada abre com 1 requisição de dados (provado com o teste de tela ou com a contagem das chamadas).
- [ ] Nenhum dado escondido chega antes do clique; nenhum relógio; nada de `postgres_changes`.
- [ ] Plano ×100 das portas novas no handoff; porta de tela ≤ 50 ms e painel ≤ 150 ms (o que não couber vira dívida no diário).
- [ ] Os números de cada tela iguais aos de antes.

## Notas para o Claude Code (regras desta leva)

- O dono está dormindo: sem perguntas de negócio; o que faltar vira decisão provisória registrada. `bloqueado` só se depender de decisão de produto que não existe.
- **Notas grandes que esta mesa NÃO edita:** Decisões de Produto, Memória de Aprendizado, Esquema do Banco, Lei de Desempenho, Mapa do Projeto, Ordem das Sessões e Próximos Passos. Decisões provisórias, lições, mudanças de esquema e dívidas pagas ficam no diário `_docs/Plataforma/Execucao/SESSAO-55.md` e na seção **"Para entrar nas notas depois da dieta"** do handoff.
- **Banco:** só em arquivo de migration, a partir de `20261118130000_`; função recriada sempre a partir da última versão; faixas novas na bateria de testes; o que precisar do banco vivo vai para "Para ligar com o dono".
- Nada de push, merge, trocar para a main, aplicar migration, publicar, n8n ou credencial.

## Leitura da sessão

`CLAUDE.md` → [[PLT - Lei de Desempenho e Escala]] (§1–§12 e as dívidas 18 e 20 do §14) → [[PLT - Decisoes de Produto]] e [[PLT - Memoria de Aprendizado]] (as partes das telas tocadas e das portas) → [[SUPA - Esquema do Banco]] antes de qualquer SQL → o handoff da SESSAO-51 (a última entregue) → esta demanda, duas vezes.

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)

- [Desempenho - Telas que ainda abrem com mais de uma leitura](https://app.clickup.com/t/17tya50wqt7) — o dono move e conclui (a mesa da fila não mexe no ClickUp).

## Resultado (preencher ao entregar)

*Ver o handoff da sessão em `_docs/Handoffs/`.*
