---
titulo: SESSAO-42 — O tempo certo: calendário da fábrica, regras de tempo válido em Configurações, corte na origem e um cálculo único para todas as telas
tipo: demanda
status: 📐 pronta para code (30/10/2026)
data: 2026-10-30
atualizado: 2026-10-30
tags: [plataforma, demandas, tempo, montagem, calendario, configuracoes, dashboards, kanban, tablet]
---

# SESSAO-42 — O tempo certo (30/10/2026)

> Planejada pelo Cowork em 29–30/10/2026 a partir do pedido do dono e de um raio-x **só de leitura** do banco de produção (19/10 a 29/10). O dono leu o relatório "Painel de Tempos de Produção — Plano" e respondeu as 17 perguntas (texto fiel abaixo). **Esta é a 1ª de duas sessões**; a [[SESSAO-43 - Tela Tempos de Producao Modo TV e Historico do Trello]] depende desta e só começa com ela entregue.
>
> **Banco e funções em produção: só com o OK do dono, à parte** (regra 2). Tudo o que não está escrito aqui e não é técnico → decisão provisória ⏳ registrada (D-NN), sem parar a sessão.

## O pedido do dono (texto fiel, 29/10)

> Claude, precisamos agora implementar um painel para revisao de tempo de montagem e os outros diversos tempos em cada setor, trabalharemos nas dashboards e nos dados que entram nela, pois atualmente os dados estão todos errados. [...] precisamos transformar isso em um aplicativo de fato dentro do sistema, uma tela nova dentro de dashboard, com as regras controladas dentro das configurações e tudo bem organizado [...] Pense e planeje pensando em optimização, funcionamento correto e esperado com tempos corretos e tratados, levando em consideração que precisaremos tratar casos como "card esquecido em etapa de um dia para o outro nao pode contar tempo valido de montagem, pois nao tem ninguem de fato montando", "Cards movimentados para a etapa de montagem e retornados para ", precisamos tratar casos desse tipo, inclusive avalie dentro da propria plataforma os erros ja cometidos agora que o sistema está em produção e analise os dados irreais que estão la

**A referência do dono:** a pasta `C:\Users\wccau\Domoby\painel-tempos-montagem\` (fora do repositório) — um painel HTML que lia o Trello. Leia o `LEIA-ME.md` e abra o `tempos-de-montagem-offline.html` no navegador. **As ideias de tela valem (a SESSAO-43 as reconstrói); o cálculo dele está errado e não deve ser copiado** (duração = fim − início, sem calendário; dias úteis seg–sáb; teto fixo de 6 h; tudo no navegador).

## As respostas do dono às 17 perguntas (30/10, no relatório)

Todas marcadas "de acordo" com a recomendação do Claude, menos as que têm texto do dono:

1. **Almoço** 12:00–13:00 em todos os setores; café não sai da conta. ✅
2. **Sábado** fora do expediente, liberado dia a dia no calendário. ✅
3. **Hora extra** só conta quando o líder autoriza. ✅
4. **Pausa sozinha no fim do expediente**, em todos os setores, com o motivo "Fim do expediente". ✅
5. **De manhã, card arrastado para a frente sem retomar:** os minutos da manhã **não** contam; quem termina de manhã retoma e depois arrasta. ✅
6. **Aviso de card esquecido sem resposta em 15 min** vira pausa no instante do aviso. ✅
7. **Mínimo de 3 min, teto de 4 h na Montagem, "3 vezes a mediana do modelo"** (com pelo menos 5 montagens de base); números revistos depois de 2 semanas de dado limpo. ✅
8. **Volta para a fila em até 5 min é clique errado; volta para setor anterior é retrabalho, fora da média.** ✅
9. **O operador pode pular MONTANDO?** — texto fiel do dono: *"Ele deve poder, mas isso envia uma notificação aos admins, essa notificação deve poder ser desligada"*.
10. **Gestos de administrador fora das médias.** ✅
11. **Dados oficiais a partir de 26/10/2026.** ✅
12. **Montar em lote** (2 ou mais unidades iguais juntas, tempo dividido): sim, só na Montagem e só com o mesmo modelo. ✅
13. **Juntar as cores do mesmo móvel** no tempo padrão. ✅
14. **Mediana no lugar da média; "na média" = até 10%.** ✅
15. **Importar o histórico do Trello**, marcado e com filtro para desligar. ✅ → **SESSAO-43**
16. **Ranking / TV** — texto fiel: *"Na TV o layout já está validado, então o que ela mostra fica, mudaremos apenas tema de cores e coisas do tipo, mas todos os dados dela ficam, porem de forma correta e organizada"* → **SESSAO-43**
17. **Modo TV** — texto fiel: *"Deve poder ser ligado em paralelo, provavelmente guilherme que irá rodar, mas adicione uma possibilidade de rodar em paralelo com alguma conta que tem a permissao modo tv (uma conta que for criada apenas com essa permissão ja deve abrir direto nesse modo), se for ativa essa permissao na conta de um ad por exemplo, ele clica no botao do modo tv e abre o modo tv em uma outra guia para que ele movimente para onde ele quiser (Outra tela espelhada por exemplo)"* → **SESSAO-43**

## O raio-x do banco (só leitura, 19/10 a 29/10 — 3.766 fatos, 1.014 cards; uso real desde 26/10)

| Problema | O que o banco mostrou |
|---|---|
| Card esquecido de um dia para o outro | Armário multiuso 2 portas (card 14541253): iniciou 26/10 17:13, saiu 27/10 07:50 → **876 min** de execução no card; a presença do Franklin marcou 14h37 de "trabalhando". Em 29/10 ~23h40 o card 14542036 (Fitamento) rodava sem pausa desde 16:27 |
| Presença sem corte | 9 trechos "trabalhando" atravessaram a madrugada = **156 h** que não existiram; **15 de 41** dias-pessoa em `plt_tempos_pessoa_dia` passam de 10 h (Alisson 18,9 h em 28/10 — card no Fitamento das 17:00 às 07:47; Guilherme 18,2 h em 22/10) |
| Almoço conta | `plt_horarios_funcionamento`: todos os setores seg–sex 07:30–18:00 numa faixa só, sem intervalo, sem sábado. Ex.: card 14541133, 11:10 → 13:57 = 168 min (real ~108) |
| Móvel sem tempo | Cobertura de 26/10 a 29/10 (cards que entraram no setor × com execução): SECC 13/24, CNC 10/13, Fitamento 27/38, Furação 24/36, **Montagem 59/98**, Limpeza 64/121. De 19 a 29/10, 33 cards saíram de A MONTAR (etapa 29) direto para a Limpeza pelas mãos de um admin, depois de ~71 h corridas na fila |
| Execução nunca é "finalizada" | 284 `execucao_iniciada` × 16 `execucao_finalizada`: quase tudo fecha por movimentação (D-59 — o arrasto é o gesto) |
| Idas e voltas na Montagem | 15× MONTANDO (28) → A MONTAR (29), de 0 a 62 min depois; 9 saídas da Montagem para trás (SECC, Fitamento, Furação); 8 cards entraram na Montagem mais de uma vez |
| Execuções-relâmpago | 9 de 0–1 min na Montagem (ex.: 4 cards às 12:02 de 21/10 por um admin, em teste) |
| Três relógios | Card/janela (front, `tempoUtil.ts`): execução em relógio corrido (hora extra conta toda — D-167). Dashboards (`fn_tempo_util`): cortam fora do horário, contam almoço, rodam a conta **por linha** a cada abertura. Tempos por pessoa (presença): não cortam nada. O mesmo armário: 876 min no card, 66 min em Pessoas, 14h37 em Tempos por pessoa |
| Onde está o tempo | Fila A MONTAR: mediana 50,8 h corridas / 19,5 h úteis; MONTANDO: mediana 0,6 h. O gargalo é a fila |
| Limite > 1 por pessoa | SECC, CNC, Fitamento e Furação têm limite 20 de execuções por pessoa: o tempo da pessoa com 3 cards rodando juntos hoje conta 3 vezes |

Equipe da Montagem hoje: Franklin e Franklinildo (só setor 6); Alisson, Francisco, os dois João e admins também atuam lá.

## A regra única do tempo (o que esta sessão implementa)

Vocabulário: **trecho** = período contínuo em que uma pessoa ficou com um card rodando (execução ou auxílio) num setor. **Passagem** = a estadia de um card num setor, da entrada até a saída do setor (mudar de etapa dentro do setor não abre passagem nova). Vale para **todos os setores de produção**; os números são de cada setor (em Configurações).

**O relógio**
1. **Calendário da fábrica:** conta só dentro das janelas do setor no dia (expediente menos intervalos), nos dias em que a fábrica trabalha. Exceções: feriado, sábado/dia trabalhado (com horário), dia parado — da fábrica toda ou de um setor.
2. **Corte na origem:** no fim da janela de cada setor, toda execução e todo auxílio rodando ali é **pausado sozinho** com o motivo **"Fim do expediente"** (motivo comum, não especial), valendo no instante do fim da janela, e a pessoa sai do setor (presença). É um **fato novo** (`origem 'automacao'`, `ocorrido_em` = fim da janela). De manhã, quem continua retoma; arrastado para a frente sem retomar, a manhã não conta (já é o que a pausa faz).
3. **Hora extra só autorizada:** janela registrada por líder do setor ou admin (setor ou pessoa, início e fim). Dentro dela conta e o corte da regra 2 acontece no fim da hora extra, não do expediente.
4. **Card esquecido (D-198) sem resposta:** a pergunta "ainda tem alguém?" sem resposta em **15 min** vale como "Não" — pausa no instante do aviso (a mesma maquinaria do "Não"), motivo **"Sem resposta ao aviso"**.
5. **Pausa não conta** (já é assim); pausa especial segue no grupo "não conta" (D-165).
6. **Trabalho simultâneo da mesma pessoa é dividido:** se a pessoa tem N cards rodando ao mesmo tempo (lote na Montagem, ou o limite 20 dos outros setores), cada minuto vale 1/N para cada card no tempo do móvel e conta **uma vez só** no tempo da pessoa. É a forma geral da resposta 12 (lote divide o tempo) ⏳ — registrar como decisão provisória.

**O que entra na média**
7. **Passagem rápida:** menos de 3 min úteis de execução = não é montagem; conta na quantidade, fora da média, vai para Conferir.
8. **Longa demais:** acima de `fator × mediana do modelo` (3×, com ≥ 5 passagens válidas de base) ou acima do teto do setor (Montagem 4 h úteis; outros setores sem teto até o dono definir) = **a conferir**, fora da média até decisão.
9. **Volta para a fila do mesmo setor:** trecho encerrado por arrasto para a fila (ou etapa anterior do mesmo setor) com até 5 min úteis = **descartado** (clique errado); acima disso, conta dentro da mesma passagem (o móvel teve uma montagem só, em duas vezes).
10. **Volta para setor anterior = retrabalho:** a passagem que sai para um setor de `ordem` menor fecha como **interrompida por retrabalho**; a próxima passagem do card naquele setor nasce **com retrabalho** — ambas fora da média do modelo, contadas no indicador de retrabalho do setor.
11. **Pulou a execução:** passagem que sai do setor para a frente sem nenhum trecho = **sem registro** (conta na quantidade, sem tempo, com quem arrastou). Se o setor tem o aviso ligado (Montagem: ligado), os admins recebem o aviso **"Móvel pulou a montagem"** — desligável por pessoa em Configurações → Avisos (D-202). O gesto **não** é bloqueado (resposta 9).
12. **Gesto de administrador:** trecho iniciado por admin que não é da equipe do setor → passagem **gesto de administrador**, fora das médias.
13. **Antes da data oficial (26/10/2026):** passagens com saída antes dela = **teste**, guardadas, fora de tudo.
14. **Decisão manual vence a regra:** Considerar / Descartar / Desfazer, com motivo, por líder do setor ou admin, como **fato novo** no card (aparece na Auditoria). A tela é da SESSAO-43; a porta, o fato e a projeção são desta.

**Como os números são lidos**
15. **Dia da passagem** = dia da saída do setor, no fuso da fábrica (America/Fortaleza, o mesmo de `fn_tempo_util`); semana começa na segunda.
16. **Tempo padrão do modelo** = mediana das passagens válidas dos últimos 90 dias (+ P25 e P75); "na média" = ±10%.
17. **Modelo de montagem:** as cores do mesmo móvel são o mesmo modelo. Agrupamento sugerido pelo sistema (código do produto → nome sem a cor; sem código → nome limpo: sem número de pedido, sem "(n/m)", sem parênteses) e confirmado/ajustado pelo admin em Configurações → Modelos.
18. **Dois números por passagem:** **tempo do móvel** (a união dos trechos — o relógio enquanto pelo menos uma pessoa trabalhou, já com a divisão da regra 6) e **esforço** (a soma de pessoa × tempo). Média do modelo = tempo do móvel; números da pessoa = o esforço dela.
19. **Tudo recalculável:** mudou calendário, horário, hora extra, regra ou modelo → o período afetado é recalculado sozinho, em lotes; os fatos nunca mudam (RNF-05).

**Casos que a bateria tem de provar (números esperados com almoço 12–13):** card 14541253 → 47 min (17:13–18:00; a manhã sem retomar não conta); card 14541133 (26/10 11:10 → 13:57) → 1h48; Alisson em 28/10 → ~5 h de trabalhando (hoje 18,9 h); card 14542036 (Fitamento, 29/10 16:27 sem pausa) → a conta para às 18:00 (1h33) — no passado a regra 2 é só conta, **nunca** se grava fato retroativo; os 4 cards de 21/10 12:02 → "teste"; um card que voltou de MONTANDO para A MONTAR 1 min depois → trecho descartado.

## As frentes

| Frente | O quê |
|---|---|
| **F1 — Na origem (quadro e tablet)** | (a) pausa automática no fim do expediente (regra 2) e o aviso sem resposta (regra 4), pelo **despertador único** do card esquecido (pg_cron marcado no minuto do próximo fim de janela de um setor com card rodando — remarcado no fato; sem card rodando, não existe); motivos "Fim do expediente" e "Sem resposta ao aviso" semeados na lista de pausa; o card pausado assim mostra **"pausado — fim do expediente"**. (b) **Montar em lote** na Montagem: no quadro e no tablet, selecionar 2+ cards do mesmo modelo em A MONTAR → "Montar juntos" (PIN de quem monta) → inicia todos de uma vez; o limite de 1 por pessoa aceita o lote (mesmo modelo, mesmo setor); cada card sai sozinho pelo arrasto ou "Concluir lote" leva todos. (c) O aviso "Móvel pulou a montagem" (regra 11). |
| **F2 — Calendário e regras (banco + Configurações → Controle de tempo)** | O Controle de tempo vira abas, **1 porta por aba**: **Expediente e intervalos** (por setor e dia; "copiar para todos"; grava como faixas em `plt_horarios_funcionamento`, que já aceita várias por dia); **Calendário** (feriados, dias trabalhados com horário, dias parados; fábrica ou setor; feriados **nacionais** de 2026 e 2027 pré-carregados; os de Natal/RN o admin cadastra); **Hora extra** (líder do setor vê só esta aba e só os seus setores; admin vê tudo); **Regras por setor** (tabela abaixo); **Equipe no painel** (titular ou apoio por setor e a **letra na TV**, única no setor); **Modelos** (grupos sugeridos para confirmar, juntar, separar); **Recálculo** (os pedidos de recálculo com progresso ao vivo). Toda mudança grava trilha (antes/depois) e pede o recálculo do período. |
| **F3 — O cálculo único (banco)** | Projeções mantidas no fato: **trechos**, **passagens** (com fila útil, execução útil, parado útil, esforço, pessoas, modelo, desfecho, situação e motivo), **tempo padrão por setor × modelo** (mediana, P25, P75, n — refeito só para o modelo da passagem que fechou) e **resumos por dia** (setor × modelo e setor × pessoa). Fila de recálculo em lotes (despertador por fato). Porta e fato da decisão manual (regra 14). Recalcula tudo desde 19/10 na aplicação. |
| **F4 — Os relógios de hoje no cálculo único** | Card no quadro, janela do card ("Tempo e histórico" e linha do tempo), **Tempos por pessoa** (presença: trabalhando = trechos válidos; ausente/à deriva só dentro das janelas; ninguém passa da jornada sem hora extra), **Pessoas**, **Meu desempenho**, **Visão do dia** e as **metas** passam a ler as projeções/resumos — nada de `fn_tempo_util` por linha a cada abertura. A régua do card (abertura) ganha intervalos, exceções e horas extras do dia, para o relógio vivo do aparelho seguir a mesma regra; o que já fechou vem pronto do banco. "Tempo por setor" continua no ar até a SESSAO-43 absorvê-la, já lendo os resumos. |

**Regras por setor — valores iniciais (Configurações → Controle de tempo → Regras por setor):**

| Regra | Montagem | Outros setores de produção |
|---|---|---|
| Passagem mínima | 3 min | 3 min |
| Teto útil | 4 h | sem teto (até o dono definir) |
| Longa demais | 3× a mediana, base ≥ 5 | igual |
| Pausar sozinho no fim do expediente | ligado | ligado |
| Aviso de card esquecido | 120 min (hoje em `plt_setores.aviso_esquecido_min` — passa a ter tela) | desligado |
| Aviso sem resposta vira pausa | 15 min | 15 min |
| Volta rápida para a fila = clique errado | 5 min | 5 min |
| Retrabalho fora da média | ligado | ligado |
| Gestos de administrador fora | ligado | ligado |
| Avisar quando pular a execução | ligado | desligado |
| Faixa "na média" | ±10% | ±10% |
| Janela do tempo padrão | 90 dias | 90 dias |

Globais: **dados oficiais a partir de 26/10/2026**; horário de todos os setores (PCP inclusive) = seg–sex **07:30–12:00 e 13:00–18:00** (troca a faixa única de hoje — mudança de dado de configuração, aplicada junto com a migration, com o OK do dono); equipe inicial no painel: Franklin e Franklinildo **titulares** na Montagem, os demais **apoio**; letras A, B, C… na ordem de cadastro (o admin troca).

## Notas para o Claude Code

- **Leia antes:** a nota do esquema (D-29 `fn_tempo_util`, presença e auxílios da SESSAO-36/37, pausa especial D-165, tempo útil/stand-by D-167/D-172, card esquecido D-197/D-198, avisos configuráveis D-202) e as migrations `20260828020000`, `20261018210000`, `20261018220000`, `20261019120000`, `20261022040000`, `20261022050010`, `20261027070000`, `20261028030000`; o front `src/kanban/tempoUtil.ts`, `linha-tempo.ts`, `useReguaTempo.ts`, `cardEsquecido.ts`, `paginas/ControleTempo.tsx`, `paginas/dashboards/*`, `dashboards/api.ts`.
- **Append-only (RNF-05):** o corte, o aviso sem resposta e a decisão manual são **fatos novos**; as projeções novas são escritas só por gatilho/rotina do cálculo. A validação de execução (`fn_validar_execucao`, M-14) tem de aceitar a pausa automática sem pessoa (`origem 'automacao'`) e o lote — provar como `authenticated` (E-103) e como a rotina.
- **Um dono por regra (M-04):** `fn_tempo_util` passa a ler o calendário novo (exceções e hora extra) e a régua do card espelha a mesma regra; tudo o que já fechou é lido das projeções. Nenhuma tela recalcula por linha.
- **Lei de desempenho (regra 18):** gesto de escrita ≤ 100 ms com o cálculo da passagem do card no mesmo fato (se não couber, vai para a fila do cálculo, processada por despertador — nunca relógio que acorda para ver); portas de leitura das telas tocadas ≤ 150 ms (painel) com volume ×100 (`EXPLAIN ANALYZE` na execução); índices em toda chave/filtro/ordenação; RLS com `(select …)`; recálculo em lotes sem travar; nada de `refetchInterval`, `setInterval` buscando dado ou `postgres_changes` — ao vivo pelo canal do setor que já existe (o fechamento de passagem avisa o tópico do setor).
- **Crescimento:** trechos e passagens só crescem — índice por data e por (setor, modelo, dia), plano de partição registrado na lei.
- **Sem horário de verão:** fuso America/Fortaleza fixo, como hoje (o painel HTML usava São Paulo — não copiar).
- **Bateria (`test:banco`):** bloco novo dentro de `{ }` (E-70), sem prettier (E-110), duas rodadas; os casos reais acima + cada regra 1–19 + lote + presença; prova no banco real **sem gravar** (bloco `DO` + `RAISE`, A-75) com os números antes × depois por setor.
- **Português de gente na tela; sem código na conversa com o dono (12c).**

## Fora do escopo (vai para a SESSAO-43)

A tela **Dashboards → Tempos de produção** (abas Dia, Período, Móveis, Montadores, Conferir), o **Modo TV** (permissão, conta própria, nova guia, várias em paralelo), a **carga do histórico do Trello** e a aposentadoria de "Tempo por setor". Aqui também não entra: mexer no Tiny, no n8n, no estoque, nas rotas.

## Critérios de aceite

- [ ] F1 — Às 18:00 (fim da janela), todo card rodando em qualquer setor fica pausado com "Fim do expediente", sem pessoa no gesto, e quem estava nele sai do setor; o card mostra "pausado — fim do expediente"; com hora extra autorizada, o corte acontece no fim dela. O aviso de card esquecido sem resposta em 15 min pausa no instante do aviso. "Montar juntos" inicia 2+ cards iguais na Montagem e o tempo é dividido. Pular MONTANDO avisa os admins (e o aviso some para quem o desliga em Configurações → Avisos).
- [ ] F2 — As 7 abas do Controle de tempo funcionam no PC e no celular, 1 requisição por aba; o líder vê só a Hora extra dos seus setores; toda mudança aparece na trilha e dispara o recálculo com progresso.
- [ ] F3 — Os casos reais dão os números esperados; cada passagem desde 19/10 tem situação e motivo; o tempo padrão de cada modelo existe; a decisão manual muda a situação e aparece na Auditoria; mudar o almoço recalcula o período sozinho.
- [ ] F4 — O mesmo móvel mostra o mesmo tempo no card, na janela, em Pessoas, em Tempos por pessoa e em Meu desempenho; nenhum dia-pessoa passa da jornada sem hora extra; nenhum relógio novo; JS inicial dentro do teto.
- [ ] Lei de desempenho: checklist do §12 no handoff, com os planos ×100 das portas novas/tocadas.
- [ ] Handoff com o roteiro de teste de cada frente, o antes × depois dos números por setor e as decisões provisórias para o dono confirmar.

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)

Propostas pelo Cowork, **a criar com o OK do dono** (regra 19):
- Tempo - Pausa automática no fim do expediente
- Tempo - Aviso de card esquecido sem resposta vira pausa
- Tempo - Calendário da fábrica com almoço, sábados, feriados e hora extra
- Tempo - Regras de tempo válido por setor em Configurações
- Tempo - Cálculo único dos tempos de produção e recálculo desde 19/10
- Kanban - Montar em lote na Montagem
- Avisos - Móvel que pulou a montagem
- Dashboards - Tempos por pessoa, Pessoas e Meu desempenho com o tempo certo
- Kanban - Tempo do card e da janela do card com o tempo certo

## Numeração reservada

D-203…D-224 · E-170…E-189 · A-128…A-142 · migrations com o prefixo da data da sessão, **depois** de `20261028030000` · ids de teste da bateria `...4201–4299` (conferir colisão no harness antes de usar).

## Resultado (preencher ao entregar)

*O que foi feito, o que mudou de rota, link do handoff da sessão.*
