---
titulo: Handoff — SESSAO-42 · o tempo certo (calendário, regras e cálculo único)
tipo: handoff
data: 2026-10-31
tags: [handoff, sessao-42, tempo, montagem, calendario, configuracoes, dashboards]
---

# 📋 Handoff — SESSAO-42 · O tempo certo (31/10/2026)

Demanda: [[SESSAO-42 - Tempo Certo - Calendario Regras e Calculo Unico]] · diário: [[SESSAO-42]] · decisões: D-203 (as 17 respostas do dono) e D-204…D-211 (provisórias, ⏳ para o dono confirmar). Ramo `sessao-42-tempo-certo`. ✅ **No ar em 31/10** com o OK do dono (*"Ler e subir tudo"*): as 4 atualizações do banco e o site (`main` `4051c08`).

## 1. Objetivo

Os tempos estavam todos errados: três relógios diferentes (o mesmo armário dava 876 min no card, 66 em Pessoas e 14h37 em Tempos por pessoa), o almoço contando, card esquecido de um dia para o outro contando a noite, presença sem corte (dias-pessoa de 18 h). A sessão cria **um cálculo único** com o calendário da fábrica e as regras de tempo válido em Configurações, corta o tempo na origem (a pausa sozinha no fim do expediente) e faz todas as telas de hoje lerem o mesmo número. A tela nova de tempos e o Modo TV são da SESSAO-43.

## 2. O que foi feito

**Banco (4 atualizações, `20261031010000…040000`):**
1. **O calendário e as regras** — expediente em faixas (07:30–12:00 e 13:00–18:00: o almoço é o intervalo), exceções por dia (feriado, dia trabalhado com horário, dia parado — da fábrica ou do setor; os feriados nacionais de 2026 e 2027 já cadastrados), hora extra autorizada (líder do setor ou admin), as regras por setor (os valores iniciais da demanda), a data oficial (26/10), a equipe no painel (titular/apoio e a letra da TV), os modelos (as cores do mesmo móvel juntas, sugeridos pelo sistema), a fila de recálculo — tudo com trilha (antes/depois) na Auditoria.
2. **O cálculo único** — trechos (cada período em que alguém ficou com o card rodando) e passagens (a estadia do card no setor) com fila, tempo do móvel, parado, esforço, pessoas, modelo e a **situação** (válida, a conferir, retrabalho, gesto de admin, sem registro, teste, descartada) e o motivo; o tempo padrão de cada modelo (mediana, P25, P75); os resumos por dia; refeito a cada gesto (uma vez por gesto) e por uma fila de recálculo em lotes; a decisão manual (considerar/descartar/desfazer) como fato no card. Recalcula tudo desde 19/10 ao subir.
3. **Na origem** — no fim do expediente (ou da hora extra) todo card rodando é **pausado sozinho** com "Fim do expediente" (sem pessoa, no instante do fim) e quem estava nele sai do setor; o aviso de card esquecido **sem resposta em 15 min** pausa no instante do aviso ("Sem resposta ao aviso"); **Montar juntos** (2+ do mesmo modelo, a cor pode mudar; o limite de 1 por pessoa aceita o lote; o tempo é dividido) e **Concluir o lote**; o aviso **"Móvel pulou a montagem"** para os admins (desligável em Configurações → Avisos).
4. **As telas de hoje no cálculo único** — Tempos por pessoa (trabalhando = o esforço; ausente e à deriva só dentro do expediente; ninguém passa da jornada), Pessoas, a lista de execuções, Meu desempenho, a meta de tempo útil, Tempo por setor (até a 43), o card no quadro, a janela e "Tempo e histórico". A Visão do dia não tinha relógio de execução — não mudou.

**Telas:**
- **Configurações → Controle de tempo em 7 abas** (Expediente e intervalos · Calendário · Hora extra · Regras por setor · Equipe no painel · Modelos · Recálculo), uma leitura por aba, só quando a aba abre; o líder de setor entra e vê **só a Hora extra** dos setores dele. O "desligar o tempo agora", a correção retroativa e o horário por pessoa continuam, recolhidos na aba Expediente. Fotos: `imagens/sessao42-expediente.jpg`, `sessao42-calendario.jpg`, `sessao42-modelos.jpg`, `sessao42-recalculo.jpg`, `sessao42-hora-extra-celular.jpg` (vitrine com dados de mentira — sem login).
- **Quadro e tablet:** o card em execução mostra o **tempo do móvel no setor** (não mais o relógio corrido); pausado sozinho mostra "Pausado · fim do expediente" (ou "· sem resposta ao aviso"); "Montar juntos" na fila da Montagem (no tablet pede o PIN de quem monta); ao soltar um card de lote adiante pergunta "Só este / O lote todo".
- **Janela do card:** "Em execução por X · 1h 47min no setor"; **Tempo e histórico** numa requisição, com os números do banco por setor (fila, tempo do móvel, parado, total), a situação em língua de gente ("Fora da média: rápida demais", "retrabalho"…), o clique errado riscado e a decisão manual.

## 3. Como testar (roteiro do dono — depois de subir)

1. **Configurações → Controle de tempo → Expediente e intervalos:** cada setor com 07:30–12:00 e 13:00–18:00 de segunda a sexta. Mude o intervalo de um setor (ex.: 11:30–13:00) → a aba **Recálculo** mostra o pedido andando sozinho até "Pronto". Volte ao 12:00.
2. **Calendário:** os feriados nacionais estão lá. Cadastre um **sábado** como "Dia trabalhado" (07:30–11:30) para a Montagem; cadastre os feriados de Natal/RN.
3. **Hora extra:** registre 18:00–20:00 de hoje para a Montagem. Entre como um **líder** (não admin): ele vê só a aba Hora extra.
4. **Regras por setor:** confira os valores (Montagem: mínimo 3 min, teto 4 h, 3× a mediana com 5 de base, aviso de esquecido 120 min, sem resposta 15 min, volta rápida 5 min, avisar pulo e lote ligados). A data oficial: 26/10/2026.
5. **Equipe no painel:** Franklin e Franklinildo titulares na Montagem, os demais apoio, com as letras.
6. **Modelos:** a lista sugerida (os nomes sem a cor). Confirme um, junte dois que são o mesmo móvel, separe um nome que caiu errado.
7. **No galpão:** às 18:00 os cards rodando ficam "Pausado · fim do expediente" e as pessoas saem do setor; de manhã, quem continua retoma. Com a hora extra do passo 3, a pausa acontece às 20:00.
8. **Montar juntos:** no tablet da Montagem, "Montar juntos" na A MONTAR, marque 2 cards do mesmo móvel (cores diferentes servem), confirme com o PIN → os dois rodando com a mesma pessoa. Solte um em MONTADO → "Só este / O lote todo".
9. **Pular a montagem:** arraste um card da A MONTAR direto para a Limpeza → os admins recebem "Móvel pulou a montagem". Em Configurações → Avisos dá para desligar.
10. **Os mesmos números em todas as telas:** abra um móvel que já saiu da Montagem — o tempo em "Tempo e histórico" é o mesmo de Dashboards → Pessoas e Tempos por pessoa (para quem montou).

## 4. Verificação

- **Bateria do banco:** 1.444+ verdes (ver o diário para o número final) — o bloco novo com 32 conferências: os casos reais (o armário esquecido **47 min**, o card do almoço **1h47**, o Fitamento rodando **para às 18:00 (1h33) sem gravar nada no passado**, os 4 cards do admin de 21/10 = **teste**, a volta de 1 min **descartada**), cada regra (rápida, teto, longa para o modelo, retrabalho nas três passagens, gesto de admin, pulou a execução + o aviso uma vez só), a decisão manual (líder sim, operador não, desfazer volta), a origem (fim do expediente, sem resposta, lote, divisão: 30 min por móvel e 1 h para a pessoa), as telas (o mesmo armário com 47 min no histórico, em Pessoas e em Tempos por pessoa), nenhum dia-pessoa acima da jornada, o recálculo em vários lotes sem erro, as permissões. Os testes antigos que esperavam o relógio antigo foram ajustados de propósito (ver o diário).
- **Testes de tela:** 360 verdes (21 novos do quadro/régua/histórico, 9 da tela de Controle de tempo); tipos e lint limpos; o site compila.
- **Vitrine** (telas reais, dados de mentira): as 7 abas no computador; no celular 375 px sem rolagem lateral e sem botão abaixo de 40 px.
- **Não verificado ainda:** o banco real (a leitura foi barrada pelo controle de segurança — pede o OK do dono) e o site no aparelho do galpão (depois de subir).

## 5. Desempenho (Lei — checklist §12)

- [x] **Requisições:** abertura sem requisição nova (a régua cresceu na MESMA porta); quadro e janela trazem o tempo na mesma resposta; Controle de tempo = 1 por aba, no clique; "Tempo e histórico" = 1 no clique; zero repetidas sozinhas.
- [x] **Busca no código:** nenhum `refetchInterval`, `setInterval` buscando dado ou `postgres_changes` novo; o Recálculo atualiza pelo canal "tempos".
- [x] **Portas ×100** (100 mil cards, 300 mil passagens, 600 mil trechos; 2ª chamada, PGlite): Tempos por pessoa 96 ms (90 dias: 83) · detalhe 91 · Pessoas 6 · Execuções 30 · Tempo por setor 6 · por item 27 · tendência 5 · Modelos 51 · histórico 9 · quadro (80 cards) 13 · Meu desempenho 6; planos sem varredura das tabelas grandes. Gesto com o cálculo junto: ~80–90 ms (teto 100).
- [x] **Índices** em toda chave estrangeira, filtro e ordenação das tabelas novas (lista no esquema). Advisors da Supabase: a conferir na subida.
- [x] **RLS:** as tabelas novas fechadas à API (só portas `security definer`).
- [x] **Listas** por cursor (hora extra, modelos); a de execuções conta até 1.001 ("mais de mil").
- [x] **Pacote:** JS inicial **228,0 → 232,4 KB** comprimidos (teto 250); a tela de Controle de tempo em pedaços por aba.
- [x] **Sem relógio que acorda para ver:** a pausa do fim do expediente usa o despertador único do card esquecido; o do recálculo só existe com fila.
- [x] **Plano de crescimento** registrado na lei (partição por mês dos trechos e passagens quando passarem de alguns milhões).

## 6. Antes × depois dos tempos por setor

- **O que já está provado** (com os dados do raio-x reproduzidos na bateria): o armário esquecido **876 min → 47 min**; o card do almoço **2h47 → 1h47**; o Fitamento esquecido rodando **sem fim → 1h33**; Alisson em 28/10 **18,9 h → ~5 h**; os testes do admin de 21/10 **na média → teste (fora)**; nenhum dia-pessoa acima da jornada (**15 de 41 → 0**).
- **Por setor com os dados reais** (cópia só de leitura, 31/10 — tabela completa em [[SESSAO-42 - antes e depois dos tempos]]): Montagem 90,2 h no card / 76,7 h nas dashboards / 96,0 h em Tempos por pessoa → **62,9 h** de tempo do móvel nas 83 passagens válidas (mediana **40 min**); Fitamento 59,7 / 19,2 / 64,8 → **11,1 h** (mediana 11 min); SECC 32,7 / 19,2 / 32,4 → **12,3 h** (18 min); CNC 21,6 / 8,1 / 22,5 → **7,0 h** (31 min); Furação 16,3 / 16,3 / 6,6 → **4,6 h** (7 min); Limpeza 88,7 / 54,5 / 85,1 → **45,2 h** (28 min). Dias-pessoa acima da jornada: **16 de 46 → 0 de 44**. Os casos com o dado real: 168 → **108 min**, 876 → **46 min**, Fitamento → **93 min**.

## 7. Pendências e próximos passos

- ✅ **Subiu em 31/10** (~01:20 de Natal, OK do dono): as 4 atualizações uma a uma (`--so`; integração do Tiny idêntica em todas), depois o site (`main` `4051c08`). Conferido no banco real (leitura, como o dono): 609 passagens recalculadas (233 válidas, 17 a conferir, 42 retrabalho, 91 sem registro, 4 de admin, 131 teste, 122 ainda no setor), 373 trechos, 137 modelos sugeridos, os casos da demanda batendo, nenhum dia acima da jornada, o despertador marcado para o próximo fim de expediente (1 card rodando — terça 07:30, depois de Finados), a fila de recálculo vazia, o check dos tipos de evento validado, as portas respondendo (~5–100 ms + a rede).
- **No primeiro dia útil (terça, 03/11):** conferir às 18:00 os cards pausados sozinhos; cadastrar os feriados de Natal/RN; confirmar os 137 modelos sugeridos.
- **Confirmar as provisórias** D-204…D-211 (o "fim do expediente" de quem começa depois do horário; a divisão do trabalho simultâneo; o retrabalho; o gesto de admin; a data oficial só nas médias; os dias da conta; o modelo pelo nome; as escolhas da tela).
- **ClickUp:** as 9 tarefas propostas pela demanda ainda não existem — criar com o OK do dono (regra 19).
- **Revisão em 2 semanas de dado limpo** (resposta 7): mínimo, teto e o fator.
- **SESSAO-43** pode começar depois da subida (a tela de tempos, o Modo TV, o histórico do Trello).

## 8. Numeração usada

D-203…D-211 · E-170…E-174 · A-128…A-132 · migrations `20261031010000`, `…020000`, `…030000`, `…040000` · ids de teste `...4201–4204` (CPFs `42000000001–4`, setores `f42/m42/l42`). **Seguinte: D-212 · E-175 · A-133.**
