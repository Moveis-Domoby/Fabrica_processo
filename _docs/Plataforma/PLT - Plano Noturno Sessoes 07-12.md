---
titulo: "PLT — Plano Noturno: Sessões 07 a 12 (execução autônoma)"
tipo: plano
data: 2026-08-28
atualizado: 2026-08-28
tags: [plataforma, plano, autonomo, bloco-noturno]
---

# 🌙 PLT — Plano Noturno · Sessões 07 → 12

> [!danger] O que é este documento
> O plano de execução **autônoma e encadeada** das sessões **07, 08, 09, 10, 11 e 12** (ordem da [[PLT - Decisoes de Produto#D-23|D-23]]), decidido em [[PLT - Decisoes de Produto#D-26|D-26]]. O dono responde as dúvidas UMA vez no início e vai dormir; a partir do OK dele, **nenhuma pergunta até o fim do bloco**. Toda sessão do bloco lê esta nota logo depois das regras.

## 1. Protocolo do bloco (D-26 — resumo operacional)

1. **Primeira conversa do bloco:** ler tudo da ordem obrigatória + as **6 demandas** (07→12, cada uma 2x) + esta nota → apresentar **TODAS as dúvidas de negócio de uma vez** (as seções "Perguntar ao dono" das 6 demandas + lacunas percebidas) → registrar as respostas como decisões (D-NN) → só então começar a SESSAO-07.
2. **Durante a execução, não perguntar nada.** Lacuna → opção mais conservadora coerente com as decisões + **log de "decisão provisória"** no handoff. Contradição insolúvel → pular o item, documentar, seguir.
3. **Bloqueio externo** (conta, credencial, pagamento): preparar tudo que dá, documentar o passo manual que falta no handoff, **seguir adiante**.
4. **Banco e GitHub liberados para o bloco** (D-26): migrations testadas (`test:banco` 2 rodadas) → aplicadas → `get_advisors`; cada sessão termina com **merge na `main`**. Ciclo F-08 completo, sem exceção.
5. **Cada sessão mantém o ciclo integral das regras:** branch própria, task list, memória de execução, handoff em `_docs/Handoffs/`, memória de aprendizado NA HORA, verificação F-07.

## 2. Encadeamento entre sessões (e dentro de uma sessão)

- **Ao terminar uma sessão** (handoff + merge feitos): gravar `_docs/Handoffs/continuidade_bloco_noturno.md` (modelo abaixo) e **abrir a próxima conversa sozinho** via CLI, desanexada, por exemplo:
  `Start-Process -FilePath "claude" -ArgumentList '-p', '"<prompt curto padrão da próxima sessão>"', '--permission-mode', 'acceptEdits'` — ou o equivalente que o ambiente da sessão oferecer (o que importa: a conversa nova nasce com o prompt curto padrão e este plano na cadeia de leitura).
- **Contexto perto do limite NO MEIO de uma sessão:** parar num ponto coeso (commit do que está íntegro), atualizar `docs/execucao/SESSAO-NN.md` e o arquivo de continuidade com **onde parou, o que falta, armadilhas descobertas**, e abrir conversa nova para CONTINUAR A MESMA SESSÃO (mesma branch).
- **Modelo do arquivo de continuidade:** sessão atual e status (terminada/no meio) · branch · último commit · próxima ação concreta · decisões provisórias tomadas até aqui · bloqueios documentados · próxima sessão da fila.
- **Prompt curto padrão das conversas seguintes do bloco** (adaptar o número):

  ```
  Leia e siga: C:\Users\wccau\Domoby\Domoby - fabrica\_docs\Plataforma\CLAUDE - Regras do Claude Code (repo).md
  Bloco noturno em andamento (D-26): leia _docs\Plataforma\PLT - Plano Noturno Sessoes 07-12.md
  e _docs\Handoffs\continuidade_bloco_noturno.md, e continue de onde parou (SESSAO-NN).
  As dúvidas do bloco já foram respondidas — NÃO pergunte nada; siga o protocolo do plano.
  ```
- O bloco termina após a 12, ou num bloqueio irrecuperável (aí o arquivo de continuidade explica o porquê).

## 3. O que entra em cada sessão (além das demandas já escritas)

| Sessão | Acréscimos deste plano |
|---|---|
| **07 — Tela do Setor Tablet** | **Prelúdio de padrões (D-27):** menu lateral no lugar da barra superior · remover a rota/aba "Design system" e migrar `docs/design-system.md` → [[PLT - Modelo de Sistema]] no cofre (atualizando os DOIS `CLAUDE.md`) · microinteração dos botões (elevação leve + sombra suave) · **varredura: nenhum código D-NN/RF-NN/Q-NN em texto de interface** (viram comentários de código). Depois, a demanda da 07 em si. ⚠️ A demanda menciona "pausados por disputa" — **disputa/pausa caiu** (D-09 revisada); ignorar. |
| **08 — Publicação no Ar** | Q-62 (hospedagem): comparar opções e **escolher a mais simples que não exija conta nova/pagamento imediato**; se toda opção exigir passo manual do dono, deixar TUDO pronto (config, docs, script de deploy) e documentar o passo que falta. Aproveitar: ligar o *leaked password protection* do Auth (advisor pendente). |
| **09 — Entrada via n8n** | Não tocar nos workflows n8n de produção (regra crítica 3): entregar o endpoint/mecanismo do lado da plataforma + documentação de como plugar; o plugue real no n8n é passo do dono (ou de sessão acompanhada). |
| **10 — Dashboards** | Conforme demanda; dados reais já existem (sessões 05/06). |
| **11 — API completa + ponte ROTAS** | Mesma regra da 09 para o lado n8n/ClickUp: código e docs prontos, integração viva não se toca sem o dono. |
| **12 — Tarefas e delegação** | Conforme demanda. |

## 4. Regras de interface que valem para TODAS as sessões do bloco (D-27)

- Tudo dentro do **modelo de sistema** — nada fora do padrão.
- Códigos internos fora da UI (regra promovida ao `CLAUDE.md`).
- Textos explicativos longos: **manter por ora** (o dono quer entender ao revisar de manhã), mas não criar novos além do necessário — são temporários.
- Botões novos já nascem com a microinteração padrão (herdada do componente `Botao`).

## 5. Revisão da manhã (checklist do dono)

1. Ler os handoffs das sessões concluídas (linkados no [[000 - MAPA DO PROJETO]]).
2. Revisar as **decisões provisórias** de cada handoff — confirmar ou pedir ajuste.
3. Executar os **passos manuais documentados** (ex.: hospedagem/conta da 08, plugue n8n da 09/11).
4. **Trocar a senha do admin** (ficou em chat — lembrete permanente até a troca).
5. A partir daqui a **regra crítica 2 volta na íntegra** (banco só com aprovação por conversa — D-26).

## Ver também

[[PLT - Decisoes de Produto]] (D-26, D-27) · [[000 - ORDEM DAS SESSOES]] · [[CLAUDE - Regras do Claude Code (repo)]]
