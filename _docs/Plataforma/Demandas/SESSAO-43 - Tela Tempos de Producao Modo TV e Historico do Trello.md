---
titulo: SESSAO-43 — A tela Tempos de produção em Dashboards, o Modo TV com permissão própria e o histórico do Trello
tipo: demanda
status: 📐 pronta para code (30/10/2026) — começa só com a SESSAO-42 entregue
data: 2026-10-30
atualizado: 2026-10-30
tags: [plataforma, demandas, tempo, montagem, dashboards, modo-tv, trello, conferencia]
---

# SESSAO-43 — Tempos de produção, Modo TV e histórico do Trello (30/10/2026)

> 2ª de duas sessões do mesmo pedido do dono (29/10). **Depende da [[SESSAO-42 - Tempo Certo - Calendario Regras e Calculo Unico]]**: esta sessão **só lê** o cálculo único (trechos, passagens, tempo padrão por modelo, resumos por dia) e a decisão manual que a 42 entrega — não recalcula tempo em lugar nenhum. O pedido do dono, o raio-x do banco, as 17 respostas e a regra única do tempo estão na 42 — **leia a 42 inteira antes desta** (duas vezes, como sempre).
>
> **Banco, carga de dados e funções em produção: só com o OK do dono, à parte** (regra 2). O que não está escrito aqui e não é técnico → decisão provisória ⏳ registrada, sem parar a sessão.

## As respostas do dono que regem esta sessão (texto fiel, 30/10)

- **15 — Histórico do Trello:** importar, marcado e com filtro para desligar. ✅
- **16 — TV:** *"Na TV o layout já está validado, então o que ela mostra fica, mudaremos apenas tema de cores e coisas do tipo, mas todos os dados dela ficam, porem de forma correta e organizada"*.
- **17 — Modo TV:** *"Deve poder ser ligado em paralelo, provavelmente guilherme que irá rodar, mas adicione uma possibilidade de rodar em paralelo com alguma conta que tem a permissao modo tv (uma conta que for criada apenas com essa permissão ja deve abrir direto nesse modo), se for ativa essa permissao na conta de um ad por exemplo, ele clica no botao do modo tv e abre o modo tv em uma outra guia para que ele movimente para onde ele quiser (Outra tela espelhada por exemplo)"*.
- Sem ranking de primeiro a último nas abas internas: cada pessoa comparada com o padrão do modelo (recomendação aceita na 16; o "Melhores tempos" por móvel e o "Melhor da semana" da TV ficam — ⏳ registrar).

**A referência visual (layout validado pelo dono):** `C:\Users\wccau\Domoby\painel-tempos-montagem\tempos-de-montagem-offline.html` — abrir no navegador e reproduzir a organização e os números de cada aba (a TV **inteira**), no modelo de sistema da casa (tokens, tipografia, componentes, Recharts 3.9.2). O cálculo de lá **não** vale: os números vêm da 42.

## As frentes

| Frente | O quê |
|---|---|
| **F1 — A tela Tempos de produção** | **Dashboards → Tempos de produção** (`/dashboards/tempos-de-producao`, filho de Dashboards; a aba vive no endereço, `?aba=`, como D-88/D-134). No topo: **setor** (os de produção; abre na Montagem; o aparelho lembra o último), **período** (7, 30 e 90 dias, este mês, mês passado, personalizado até 12 meses), **pessoa**, **móvel** e **"incluir histórico do Trello"** (ligado). Toda aba mostra a **cobertura do registro** (% das passagens com tempo) e se atualiza sozinha pelo canal do setor quando uma passagem fecha. **Cada aba = 1 porta, pedida só no clique.** As abas: **Dia · Período · Móveis · Montadores** (o nome da aba segue o setor: "Montadores" na Montagem, "Pessoas" nos outros) **· Conferir** (com contador) e o botão **▶ Modo TV**. Conteúdo de cada uma abaixo. |
| **F2 — Conferir** | A tela da decisão manual da 42: casos agrupados pelo motivo (cortado no fim do expediente, curto demais, longo para o modelo, voltou para a fila, retrabalho, sem registro, gesto de administrador, lote), **Considerar / Descartar / Desfazer** com motivo (lista "Motivos de conferência" em Utilitários + "Outro" com texto — o padrão de sempre, motivo obrigatório), por líder do setor ou admin; **Procurar** por número do pedido ou nome do móvel (mostra a passagem como foi registrada, mesmo fora do período, com link para abrir o card). Lista por cursor com "Ver mais". |
| **F3 — O Modo TV** | O layout do painel HTML **inteiro** (abaixo), com o tema da plataforma, os dados certos da 42 e **sem nomes**: a porta da TV devolve só as **letras** da Equipe no painel (Configurações) — nunca nome, foto, etiqueta ou dado bruto, nem para admin. Rota `/dashboards/modo-tv?setor=` em tela cheia, sem barra lateral (exceção à lei de layout, registrar ⏳). **Permissão nova "Modo TV"** por pessoa em Gestão da equipe (como os módulos Fábrica e Comercial). Conta criada **só** com essa permissão → entra direto na TV e não abre outra tela (o mesmo desenho do "só entregador"). Quem tem a permissão junto de outras (ex.: um admin) vê o botão **▶ Modo TV**, que abre a TV **numa guia nova** do navegador, para arrastar para outra tela; a guia original segue normal. **Várias TVs em paralelo**, cada aparelho com a própria sessão, e a TV **nunca sai sozinha** (o mesmo desenho do tablet, D-189). |
| **F4 — O histórico do Trello** | Carga **única** (script em `supabase/manutencao/`, rodado com o OK do dono) das 891 montagens de `C:\Users\wccau\Domoby\painel-tempos-montagem\historico.csv` (13/07 a 13/10) numa tabela **própria**, marcada origem Trello — **não são fatos da plataforma**, nunca entram em `plt_eventos`. Passam pelas **mesmas regras** da 42 (calendário, mínimo, longo para o modelo, lote, situação), com a mesma conta. Modelo pelo agrupamento da 42 (nome limpo como o `cleanName` do painel: sem número de pedido, sem "(n/m)", sem parênteses; depois sem a cor); o que não casar aparece em **Configurações → Modelos → "Nomes do Trello sem modelo"** para o admin ligar. Montador pela etiqueta, casada com as pessoas cadastradas por palavra, sem acento (`FRANKLIN SILVA` casa com Franklin; `Franklinildo` não); titular vence apoio; dois titulares = dupla (esforço dividido); etiqueta de outro setor é ignorada. Os 6 cartões repetidos ficam uma vez; os 15 lotes com início e fim idênticos (30 cartões) têm o tempo dividido. |
| **F5 — Arrumação e prova** | "Tempo por setor" sai do menu e o endereço antigo leva para `?aba=periodo`; as visualizações salvas que apontavam para ela são traduzidas (como na SESSAO-16). A prova final com o dono: **um dia de montagem conferido card a card** (a aba Dia contra o que o galpão viu), print de cada aba e da TV no handoff. |

### F1 — o que cada aba mostra (a organização do painel HTML, com os números da 42)

- **Dia** — navegação de dia (‹ data ›). Números grandes: **Móveis montados** (sub: "N para conferir · M montadores"), **Tempo de montagem** (soma do tempo útil), **Tempo médio** (mediana; sub: a média), **Abaixo do padrão** ("X de Y") e **Cobertura**. A **linha do dia por pessoa** (uma faixa por pessoa ao longo do expediente: cada trecho com o móvel, os intervalos e o fim do expediente sombreados, os buracos à vista). A tabela: Início, Fim, Móvel (abre a janela do card), Montador (chip com foto), Duração útil, **Vs. padrão do móvel** ("18% mais rápido", "na média", "12% mais lento" — faixa de ±10%; com "(padrão 42 min)") e o selo da situação (para conferir, sem registro, lote, com ajuda, retrabalho).
- **Período** — Números grandes: **Móveis montados**, **Média por dia útil** (dias úteis do **calendário**, não seg–sáb), **Média por dia com montagem**, **Tempo total**, **Tempo médio por móvel** (mediana). Gráfico **móveis por dia** empilhado por montador (por semana quando passar de 70 dias), com dica ao passar o mouse. **Onde vai o tempo do setor:** fila × execução (barra empilhada, `--dm-serie-fila` e `--dm-serie-execucao`) e o **retrabalho**. Tabela **por montador** (móveis, dias, por dia, mediana, tempo total) e **móveis mais montados** (os 12 primeiros com % do total; "mais N modelos na aba Móveis").
- **Móveis** — tabela ordenável por modelo: **Qtd** (+ "N para conferir"), **Melhor**, **Mediana**, **Faixa** (P25–P75), e uma coluna por montador (tempo médio × n e a comparação com o padrão). O clique abre as passagens daquele modelo (data, quem, duração, comparação, situação, Considerar/Descartar), com "Ver mais"; as do Trello marcadas.
- **Montadores** — um cartão por pessoa: **móveis montados**, **por dia trabalhado**, **mediana por móvel**, **tempo total** (o esforço dela), **modelos abaixo e acima do padrão** (com ícone e rótulo — verde, laranja e vermelho são **exclusivos da qualidade**, D-09/regra das dashboards), **melhor** (móvel e tempo), **ajudas dadas** e **ocupação** (tempo com card ÷ tempo no setor dentro do expediente). Ao lado, **Melhores tempos** (os 8 móveis com o melhor tempo contra o padrão do modelo, com quem e quando). O funcionário vê só o próprio cartão (a regra de hoje); líder e admin veem todos.

### F3 — a TV (o que já estava validado, todo)

- Cabeçalho: "**Montagem · Fábrica Domoby**" (o nome do setor), a **data por extenso** e o **relógio** (redesenho local a cada 30 s — não busca dado).
- Faixa de aviso quando ainda não há registro hoje: "Sem registros de hoje ainda. Último dia com dados: dd/mm."
- **4 números grandes:** **montados hoje** ("na meta: média é X por dia" ou "faltam N para a média diária"); **média por dia útil** ("N móveis em M dias úteis (30 dias)"); **montados no mês** ("X por dia útil até hoje"); **tempo médio hoje** ("média dos 30 dias: Y" — mediana).
- **Coluna dos montadores** por letra ("Montador A"; dupla = "Montadores A + B"): quantidade de hoje (grande), "mediana hoje X · ritmo Y/dia" (30 dias).
- **Gráfico dos últimos 14 dias**, empilhado por montador (letras na legenda), com o total no topo de cada barra.
- **Rodapé:** "Melhor da semana: **Montador A** montou *móvel* em **X** (padrão Y)" (só modelos com ≥ 3 passagens válidas), "Dados até dd/mm" e "ao vivo".
- Ao vivo pelo canal do setor; na virada do dia, **uma** leitura (exceção registrada na lei, com o porquê). Tema: o da plataforma; padrão escuro na conta de TV ⏳.

## Notas para o Claude Code

- **Leia antes:** a 42 inteira e o handoff dela (é ele que diz os nomes reais das projeções e portas que nasceram); o modelo de sistema; a pasta de inspiração das dashboards (regras de construção — número grande antes de gráfico, cores por função, rótulo direto, hover em tudo); `src/paginas/dashboards/*`, `src/dashboards/api.ts`, `src/componentes/Layout.tsx` (menu e módulos — `temModulo`, o desenho do "só entregador"), `src/autenticacao/*` (sessão por aparelho do tablet, D-189), `src/App.tsx` (rotas e redirecionamentos).
- **Lei de desempenho (regra 18):** 1 porta por aba, no clique, ≤ 150 ms com volume ×100, lendo **só** os resumos/projeções da 42 (nada de varrer fatos, nada de conta por linha); listas por cursor; ao vivo pelo canal do setor; nenhum relógio buscando dado; a tela num pedaço próprio do pacote; JS inicial dentro do teto (antes/depois no handoff).
- **TV anônima de verdade:** a porta da TV é separada e devolve só letras; teste que prova (como `authenticated`, com a conta de TV e com admin) que nenhum nome sai dela.
- **Permissão Modo TV:** mora onde moram os módulos de hoje (dentro do token — SESSAO-32), editável em Gestão da equipe; a conta só-TV não abre nenhuma outra rota (guarda no front **e** recusa no banco).
- **Carga do Trello:** idempotente (rodar duas vezes não duplica), em transação, com relatório (quantas entraram, quantas válidas, quantas para conferir, nomes sem modelo) na execução da sessão. Números esperados com o calendário da 42 (almoço 12–13; sábado com montagem no Trello entra como **dia trabalhado** no calendário, só para esses dias — ⏳): cerca de **813 válidas, mediana ~44 min, média ~54 min** (a regra antiga do painel dava 59 min; a conta crua, 186 min).
- **Bateria (`test:banco`):** bloco novo dentro de `{ }` (E-70), sem prettier (E-110), duas rodadas: cada porta nova com permissão (operador vê só o próprio; TV sem nomes), a carga duas vezes, a decisão manual pela tela.
- **Português de gente na tela; sem código na conversa com o dono (12c).**

## Fora do escopo

Qualquer mudança na regra do tempo (é da 42 — achou um furo, registre e avise o dono, não conserte por fora); Tiny, n8n, estoque, rotas; ranking de pessoas de primeiro a último.

## Critérios de aceite

- [ ] F1 — As 5 abas no PC, no tablet e no celular, cada uma com 1 requisição no clique; o mesmo móvel tem o mesmo tempo aqui, no card e em Tempos por pessoa; trocar setor, período, pessoa e móvel funciona; desligar "histórico do Trello" tira o histórico de todas as abas.
- [ ] F2 — Cada motivo de conferência aparece no grupo certo; Considerar/Descartar/Desfazer mudam a média na hora e aparecem na Auditoria; Procurar acha pelo número do pedido.
- [ ] F3 — A TV mostra tudo o que o painel HTML mostrava, sem nenhum nome; conta só-TV entra direto nela e não sai dela; o admin com a permissão abre a TV numa guia nova; duas TVs abertas em aparelhos diferentes não se derrubam; a TV não sai sozinha; atualiza ao vivo.
- [ ] F4 — As 891 linhas entram uma vez, com situação; "Nomes do Trello sem modelo" lista o que não casou e ligar um nome recalcula o modelo; os números batem com os esperados (ou a diferença está explicada no handoff).
- [ ] F5 — "Tempo por setor" redireciona; visualizações salvas traduzidas; um dia de montagem conferido com o dono.
- [ ] Lei de desempenho: checklist do §12 no handoff, com os planos ×100.
- [ ] Handoff com o roteiro de teste de cada frente, prints de cada aba e da TV, e as decisões provisórias para o dono confirmar.

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)

Propostas pelo Cowork, **a criar com o OK do dono** (regra 19):
- Dashboards - Tela Tempos de produção com Dia, Período, Móveis e Montadores
- Dashboards - Conferência de tempos com Considerar e Descartar
- Dashboards - Modo TV com permissão própria e várias telas em paralelo
- Dashboards - Histórico de montagens do Trello
- Dashboards - Tempo por setor dentro de Tempos de produção

## Numeração reservada

D-225…D-240 · E-190…E-204 · A-143…A-155 · migrations com o prefixo da data da sessão, depois das da 42 · ids de teste da bateria `...4301–4349` (conferir colisão no harness antes de usar).

## Resultado (preencher ao entregar)

*O que foi feito, o que mudou de rota, link do handoff da sessão.*
