---
titulo: Handoff — SESSAO-43 · Tempos de produção, Modo TV e o histórico do Trello
tipo: handoff
data: 2026-11-05
tags: [handoff, sessao-43, tempo, dashboards, modo-tv, trello, conferencia]
---

# 📋 Handoff — SESSAO-43 · Tempos de produção, Modo TV e o histórico do Trello (05/11/2026)

Demanda: [[SESSAO-43 - Tela Tempos de Producao Modo TV e Historico do Trello]] · Diário: [[SESSAO-43]] (`_docs/Plataforma/Execucao/SESSAO-43.md`) · Decisões: D-225…D-233 · Ramo `sessao-43-tempos-producao-modo-tv` (já com a `main` da SESSAO-46 juntada)

> **TUDO NO AR (com o OK do dono, cada passo à parte):** banco e carga do histórico em 05/11, site em 06/11 de madrugada (§8).

## 1. Objetivo

A 2ª metade do pedido do dono de 29/10 (a 1ª foi a SESSAO-42, o tempo certo): uma tela **Dashboards → Tempos de produção** com o painel que o dono validou (Dia, Período, Móveis, Montadores, Conferir), o **Modo TV** com permissão própria e várias TVs em paralelo, e o **histórico do Trello** (13/07 a 13/10) entrando nas mesmas contas, marcado e com filtro para desligar.

## 2. O que foi feito

### Banco (duas atualizações, ✅ aplicadas em 05/11/2026 ~12:00 de Natal, com o OK do dono)
- **`20261105030000_plt_tempos_historico_trello.sql`:** a equipe de cada passagem (quem montou, quem ajudou, o esforço de cada um, cortado, clique errado — refeita no mesmo gesto que mede); o histórico do Trello numa **tabela própria** (nunca vira fato da plataforma), com a **mesma conta da 42**; o **padrão com o histórico** por modelo (o oficial não muda); "Nomes do Trello sem modelo" e o ligar; a função da carga (fora da API).
- **`20261105040000_plt_tempos_producao_modo_tv.sql`:** a lista "Motivos de conferência"; a permissão **Modo TV** (junto dos módulos Fábrica/Comercial/Entregas) e a porta que a liga (só admin); o canal do setor aberto para a TV; a **tabela pronta de leitura** (um móvel por linha + uma por pessoa, mantida no gesto); as portas de cada aba, da conferência, do Procurar e da TV (só letras).

### Telas
- **Dashboards → Tempos de produção** (`/dashboards/tempos-de-producao?aba=`): filtros de setor (o aparelho lembra), período (7/30/90 dias, este mês, mês passado, personalizado até 12 meses), pessoa, móvel e "incluir histórico do Trello"; a cobertura em toda aba; ao vivo pelo canal do setor; 1 consulta por aba, no clique; o botão **▶ Modo TV** (quem tem a permissão) abre a TV numa guia nova.
- **Dia** (‹ data ›): números grandes, a linha do dia por pessoa (trechos, almoço e fim do expediente sombreados), a tabela com "vs. padrão do móvel" e os selos.
- **Período:** números grandes, móveis por dia (por semana acima de 70 dias) empilhados por montador com o total em cima, onde vai o tempo do setor (fila × execução × parado, retrabalho), por montador e os 12 móveis mais montados.
- **Móveis:** a tabela ordenável (Qtd, Melhor, Mediana, Faixa, uma coluna por montador) e o clique que abre as passagens do modelo (com Considerar/Descartar e "Ver mais").
- **Montadores** ("Pessoas" fora da Montagem): o cartão de cada pessoa (sem ranking) e os 8 melhores tempos contra o padrão.
- **Conferir** (com contador): os grupos por motivo, Considerar/Descartar/Desfazer com motivo, o **Procurar** por pedido ou móvel; "Ver mais" por cursor.
- **Modo TV** (`/dashboards/modo-tv?setor=`): o painel do HTML inteiro, só letras, tela cheia, ao vivo, uma leitura na virada do dia, relógio local, tela sempre acesa; a conta **só-TV** entra direto nela, não sai, não cai por inatividade e abre no tema escuro.
- **Gestão da equipe:** "Modo TV" e "só Modo TV" na ficha da pessoa (só admin).
- **Configurações → Controle de tempo → Modelos → Nomes do Trello sem modelo**; **Utilitários → Motivos de conferência**.
- **"Tempo por setor"** saiu do menu: o endereço antigo leva para Tempos de produção → Período; as visualizações salvas foram traduzidas.

### Script da carga
- `supabase/manutencao/2026-11-05_historico_trello.mjs` + o arquivo (`dados/2026-11-05_historico_trello_montagem.csv`, cópia fiel do `historico.csv` do painel antigo). Sem `--confirmar` é **ensaio** (faz tudo e desfaz, mostrando o relatório); com `--confirmar` grava. Rodar duas vezes não duplica.

## 3. Decisões tomadas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| Permissão Modo TV em `modulos`, lida no banco a cada porta (D-230) | Dentro do token | Ajuste do dono: o gancho do token segue guardado; vai para o token junto dos outros módulos |
| O histórico do Trello numa tabela própria, com a mesma conta (D-229) | Criar fatos de mentira em `plt_eventos` | Fatos são só da plataforma (regra 5); a conta é a mesma, a origem fica marcada |
| Padrão "com histórico" separado do oficial (D-226 item 5) | Misturar o Trello no padrão oficial | As regras de hoje (longo para o modelo, avisos) continuam lendo só a plataforma |
| Tabela pronta de leitura mantida no gesto (E-192/A-145) | Ler a união das origens a cada abertura | O ensaio ×100 passava de 300 ms; com a tabela pronta, 30 dias em 22–125 ms |
| Sábado do Trello com montagem = dia trabalhado só naquele dia (D-229) | Liberar todos os sábados | Só onde houve trabalho; com as faixas de uma sexta |
| Sem ranking; ficam os 8 melhores e o "Melhor da semana" (D-225) | Pódio por pessoa | Resposta do dono na 16 |

Todas as provisórias estão em [[PLT - Decisoes de Produto]] (D-225…D-233).

## 4. Bugs

### Resolvidos no caminho
- O total só aparecia em cima de algumas barras empilhadas → série invisível no topo com o total (A-144).
- Os gráficos sumiam na foto sem janela e no painel escondido → animação desligada.
- A régua de horas da aba Dia ganhava rolagem; a Período rolava para o lado no celular → corrigidos (vistos na vitrine).
- As abas de período passavam do teto no ensaio ×100 → tabela pronta (E-192).

### Descobertos
- O vermelho antigo da bateria ("as 7 portas novas = as antigas", a receita do painel) segue o mesmo da `main` — não é desta sessão.
- Etiquetas do Trello sem pessoa na equipe do painel (ANDERSON e outras): entram **sem montador** até alguém ser cadastrado e a carga rodar de novo (o relatório lista quais).

## 5. Como testar (passo a passo)

**Antes:** (1) ~~aplicar as duas atualizações do banco~~ ✅ feito em 05/11; (2) ~~publicar o site~~ ✅ feito em 06/11; (3) ~~rodar a carga do histórico~~ ✅ feita em 05/11 (primeiro o ensaio, depois com `--confirmar`) — ver §8. Até lá, as fotos abaixo são da vitrine (dado de mentira).

**A. Tempos de produção — Dia**
1. Entrar como admin → menu **Dashboards → Tempos de produção**. Abre na Montagem, na aba **Dia**, com "incluir histórico do Trello" ligado.
2. Voltar dias com **‹** até um dia do Trello (ex.: 17/09): os móveis do dia, o tempo de cada um, "vs. padrão", os selos; a linha do dia por pessoa com o almoço sombreado.
3. Um dia de hoje (depois de montar um card na plataforma): o tempo da linha = o tempo que o card mostra na janela do card e em Tempos por pessoa.

![[imagens/sessao43-dia.png]]
![[imagens/sessao43-dia-celular.jpg]]

**B. Período** — trocar o período (7, 30, 90 dias, este mês, mês passado, personalizado): os números grandes mudam; acima de 70 dias o gráfico vira semanas; passar o mouse numa barra mostra quem montou quanto. Desligar o histórico do Trello: os números caem para só a plataforma.

![[imagens/sessao43-periodo.png]]

**C. Móveis** — clicar nos títulos para ordenar; clicar numa linha abre as passagens do modelo (as do Trello marcadas), com "Ver mais".

![[imagens/sessao43-moveis.png]]

**D. Montadores** — um cartão por pessoa (sem posição), modelos abaixo/na média/acima do padrão, ajudas, ocupação; à direita, os 8 melhores tempos. Entrar como **funcionário** da fábrica: só o cartão dele (o filtro de pessoa travado nele).

![[imagens/sessao43-montadores.png]]

**E. Conferir** — o contador na aba; os grupos (curto demais, longo, cortado, voltou para a fila, retrabalho, sem registro, gesto de administrador, lote, já decididas); **Considerar** um caso com motivo da lista → o número da média muda na hora e o caso aparece em "Já decididas" e na **Auditoria**; **Desfazer** volta. **Procurar** por um número de pedido → acha a passagem mesmo fora do período, com o link do card.

![[imagens/sessao43-conferir.png]]

**F. Modo TV**
1. **Gestão da equipe** → uma pessoa → ligar **Modo TV**. Ela passa a ver o botão **▶ Modo TV** em Tempos de produção → abre numa guia nova.
2. Criar (ou escolher) uma conta e marcar **só Modo TV**: ao entrar, cai direto na TV; tentar outro endereço volta para a TV; a TV não sai sozinha.
3. Conferir que a TV **não mostra nenhum nome** (só "Montador A", "A + B", "Outros"), o relógio anda, e um card montado aparece sozinho (ao vivo). Abrir em dois aparelhos ao mesmo tempo: um não derruba o outro.

![[imagens/sessao43-tv-escuro.png]]
![[imagens/sessao43-tv-claro.png]]

**G. Histórico do Trello** — depois da carga: **Configurações → Controle de tempo → Modelos → Nomes do Trello sem modelo** lista os nomes que não casaram; ligar um a um modelo → as montagens entram no modelo (e o nome passa a valer também para a plataforma).

**H. Tempo por setor** — o endereço antigo (`/dashboards/tempo-por-setor`) e as visualizações salvas antigas levam para Tempos de produção → Período.

**I. O dia conferido card a card (com o dono)** — escolher um dia de montagem com o banco no ar e conferir a aba Dia contra o que o galpão viu.

## 6. Impacto nos números visíveis

- A tela nova mostra o histórico do Trello junto (ligado por padrão); desligar volta para só a plataforma. O **tempo padrão oficial** e os avisos não mudam (continuam só com a plataforma).
- Os números do Trello pela conta da 42: na bateria **815 válidas, mediana 43,3 min, média 52,1 min**; **no banco real (carga de 05/11) 794 · 42,2 · 49,2** — a Montagem real fecha às 17:00 na sexta e já tem os modelos ligados (a demanda esperava ~813 · ~44 · ~54; a conta crua dá ~183 min). Diferença explicada: os lotes reais são 9 (18 cartões), não 15 — os outros 6 eram cartões repetidos.

## 7. Notas do cofre atualizadas

[[PLT - Decisoes de Produto]] (D-225…D-233) · [[PLT - Memoria de Aprendizado]] (E-190…E-193, A-143…A-149) · [[SUPA - Esquema do Banco]] (bloco SESSAO-43, ✅ aplicado em 05/11) · [[PLT - Lei de Desempenho e Escala]] (andamento da 43, exceção da TV, dívida 31; a dívida da 46 virou a 32) · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]] · a demanda (Resultado).

**Checklist de desempenho (§12):** requisições — 1 por aba no clique, a TV 1 + ao vivo + 1 na virada do dia (por construção; medir no site publicado); nenhum relógio buscando dado, nenhum `postgres_changes`; planos ×100 no diário e na lei (30 dias dentro do teto; 90 dias = dívida 31); índices em toda chave estrangeira, filtro e ordenação; listas por cursor (Móveis por deslocamento justificado, teto 100); pacote **228,4 KB** só esta sessão, **235,9 KB** junto da 46 (teto 250); escrita idempotente (carga e ligar); a tela tocada (Tempo por setor) saiu.

## 8. Ficou pendente / precisa de decisão

1. ✅ **As duas atualizações do banco — aplicadas em 05/11/2026 ~12:00 de Natal** com o OK do dono, uma a uma pelo aplicador `--so`; antes, conferido no banco vivo que `fn_aviso_pode_ouvir` e `plt_fn_motivo_salvar` eram as versões base; integração do Tiny idêntica; depois, a tabela pronta = a origem e as portas respondem ao admin (detalhe no [[SUPA - Esquema do Banco]]). O site no ar continua funcionando: nada que ele usa saiu.
2. ✅ **A carga do histórico — feita em 05/11/2026 ~12:37 de Natal (15:37 UTC)** com o OK do dono: o ensaio antes (desfeito), depois `--confirmar`. 891 linhas → 885 cartões (6 repetidos), 794 válidas, 91 para conferir (49 rápidas demais, 20 longas para o modelo, 22 acima do teto), mediana 42,2 min, média 49,2 min (a crua 182,8), 9 lotes (18 cartões), 69 cortados no fim do dia, 9 sábados viraram dia trabalhado da Montagem, 239 cartões sem modelo (115 nomes). Os números do banco real ficam um pouco abaixo dos da bateria (815 · 43,3 · 52,1) porque a Montagem real fecha às 17:00 na sexta e já tem os modelos da 42 ligados — mesma conta, configuração real; dentro da faixa da demanda. Montadores pela etiqueta na equipe do painel da Montagem: Franklinildo 458, Franklin 349, Anderson 61, Alisson 17, João Pedro 4; 10 sem montador. **Etiquetas sem pessoa no painel da Montagem:** GEOVANE (221 cartões) e KLEBER (7, com as variações) estão cadastrados mas fora da equipe do painel da Montagem; DANIEL (14) não casa com ninguém pelo primeiro nome (no painel há um "Francisco Daniel" — não se presume que seja ele); PARADO (2) é status. Conferido depois: `plt_tempo_trello` 885 (794 válidas, 91 conferir), a projeção com 885 do Trello e 889 pessoas (= a soma), o padrão com o histórico 255 modelos (590 cartões do Trello), o oficial intacto (231), 9 exceções de sábado na Montagem; a aba Período de 13/07 a 13/10 com o histórico dá os mesmos números e, sem o histórico, vazio.
3. ✅ **site publicado em 06/11/2026 ~01:33 de Natal (04:33 UTC)** com o OK do dono — a `main` avançou direto para o ramo (`fbbd188`, junto a nota da 46 que tinha entrado na `main`); o Vercel de produção concluiu e o pacote no ar tem Tempos de produção e Modo TV (o endereço antigo do "Tempo por setor" redireciona). A tela logada não foi aberta pelo Claude (pede a senha do dono); as portas foram conferidas no banco como o admin.
4. **O dia de montagem conferido card a card** com o dono (F5) — depois dos três passos acima.
5. Ligar os **nomes do Trello sem modelo** (115 nomes, 239 cartões) e pôr na equipe do painel da Montagem quem montava no Trello e está fora dela (GEOVANE com 221 cartões, KLEBER com 7; DANIEL com 14 — dizer quem é) — e rodar a carga de novo, com OK (não duplica; refaz os montadores). O ANDERSON já casou com o Anderson Carvalho.
6. Confirmar as provisórias **D-225…D-232**; decidir a **D-233** (períodos de 90 dias ou mais com 100× o movimento).
7. ClickUp: as 5 tarefas em "fazendo", com comentário de entrega — quem conclui é o dono.
