---
id: D-26
aliases: [D-26, D-026]
titulo: "Bloco noturno autônomo: sessões 07→12 sem perguntas durante a execução"
tipo: decisao
data: 2026-08-28
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [processo]
tags: [decisao, area/processo]
---
# D-26 · Bloco noturno autônomo: sessões 07→12 sem perguntas durante a execução (28/08/2026)

**Decidido (pedido do dono):** as sessões **07, 08, 09, 10, 11 e 12** (ordem da [[D-023 - Replanejamento da jornada a partir da 5 posicao|D-23]]) rodam **em sequência, de madrugada, sem o dono acompanhar**. O protocolo:

- **Todas as dúvidas de negócio das 6 demandas são levantadas UMA vez, no início do bloco** — o dono responde antes de dormir. Depois do OK, **nenhuma pergunta até o fim**.
- **Lacuna não coberta pelas respostas/decisões:** escolher a opção mais conservadora coerente com as decisões registradas e **logar como "decisão provisória"** no handoff da sessão, para revisão do dono de manhã. Contradição insolúvel com decisão registrada → pular o item, documentar, seguir.
- **Bloqueio externo** (criação de conta, credencial, pagamento — ex.: hospedagem na SESSAO-08): preparar tudo que dá (código, config, doc do passo manual), **documentar o bloqueio e seguir** para a próxima sessão cujas dependências permitam.
- **Banco e GitHub autorizados para o bloco inteiro** (palavras do dono em 27/08: acesso liberado para aplicar e subir sem perguntar): migrations testadas → aplicadas; cada sessão termina com merge na `main`. **↪️ Nuance da [[D-019 - Banco o projeto da org Tech e o de producao e por ora e onde|D-19]]/D-23:** a publicação (08) normalmente encerraria a permissão de mexer direto no banco; como a equipe ainda não estará usando de madrugada, a permissão vale **até a revisão do dono na manhã seguinte** — aí a regra crítica 2 volta na íntegra.
- **Encadeamento automático (pedido do dono):** uma demanda por conversa continua ([[D-010 - Metodo de trabalho sessoes Claude Code ordenadas CLAUDE md|D-10]]). Ao **fim de cada sessão** — ou com o **contexto perto do limite** no meio de uma — o Claude Code grava um **handoff de continuidade** e **abre sozinho a próxima conversa** do Claude Code via CLI, com o prompt curto padrão. O bloco termina na 12 ou num bloqueio irrecuperável.
- Handoffs individuais por sessão continuam obrigatórios (regra 9) — são o material de revisão da manhã.

**Descartadas:** rodar tudo numa conversa só (estoura contexto e viola D-10); parar e esperar resposta a cada dúvida (o dono estará dormindo).

**↪️ Complementos (28/08, aval do dono ao iniciar o bloco):** (1) **verificação de tela ([[Memoria - Modelos Formulas e Possibilidades#F-7|F-07]]/navegador) apenas a cada 2–3 sessões** para economizar tokens — nas demais, conferência por `tsc`/`lint`/testes/`test:banco` direto nos arquivos; (2) as dúvidas do bloco foram respondidas e viraram **[[D-028 - Card do operador dados do produto espaco de imagens som|D-28]] a [[D-034 - Delegacao 3 modos por setor sorteio entre logados tarefa|D-34]]**; (3) a SESSAO-08 saiu do bloco ([[D-030 - Publicacao adiada nenhum deploy no bloco noturno|D-30]]).
