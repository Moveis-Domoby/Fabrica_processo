---
titulo: Diário de execução — SESSAO-47 · Bloco C (a configuração do painel de Tempos de produção)
tipo: execucao
data: 2026-11-09
tags: [execucao, sessao-47, tempos, modo-tv, painel, desempenho]
---

# Diário — SESSAO-47 · Bloco C (09/11/2026)

Demanda: [[SESSAO-47 - Pedido Adiantado no Tiny Data Real da Entrega Comprovantes e Painel de Tempos]] — **Bloco C (frente 7)**: o botão "Configurar painel" de Dashboards → Tempos de produção.
Diário da sessão (o supervisor): [[SESSAO-47]]. Este diário é só da frente do Bloco C; quem consolida Decisões, Memória, Esquema, Lei e handoff é o supervisor, a partir daqui.

Ramo `worktree-agent-aeb9402ea3d4a0d3b`, na worktree `.claude/worktrees/agent-aeb9402ea3d4a0d3b`. Nada de banco de produção, n8n, ClickUp nem envio (`push`); nenhum `.env*` lido; nenhum `cd`.

## Partida (~18:05 de Natal)

- **A worktree nasceu ATRÁS da base da sessão**: estava em `067d8ee` (a `main`), sem a migration da base (`20261109010000_plt_sessao47_base.sql`) e sem o diário do supervisor, que o brief manda ler. Trouxe a ponta do ramo do supervisor daquele momento com `git merge --ff-only 7347451` (avanço puro, sem commit de junção). **Este ramo nasce de `7347451`.**
- `npm ci --prefix` na worktree (sem junção para a pasta principal).
- Lido antes de qualquer código: `CLAUDE.md`, a demanda (2×, o Bloco C + as respostas 10–12 + os critérios de aceite + as notas), o diário do supervisor (as lições e o mapa do código), a Lei de Desempenho (§1–§14), o Modelo de Sistema, as decisões do painel e da TV (D-225…D-233) e das regras de tempo (D-203/D-211), o diário e o handoff da SESSAO-43, e as migrations vigentes das portas (`20261105040000…`, `20261106020000…`, `20261031010000…`, `20261109010000…`).
- Leitura de produção barrada na sessão: a base é o repositório. As funções recriadas nascem da versão VIGENTE nas migrations, extraídas por programa (`viva.mjs --ate 20261109040000`) — **o md5 de cada corpo de origem está no fim deste diário, para o supervisor conferir com `md5(prosrc)` do banco vivo antes de aplicar**.

## Task list (espelha o brief e o Bloco C da demanda)

- [x] Onde mora: uma linha (`plt_tempo_config.painel`) e uma coluna (`plt_tempo_equipe.no_painel`); o efetivo numa função só.
- [x] A configuração vem JUNTO de cada porta (Dia, Período, Móveis, Montadores, Conferir, TV) — nenhuma requisição a mais.
- [x] Tipo de gráfico (Período e TV): empilhadas (o de hoje) · barras · linhas.
- [x] Montadores: liga/desliga por pessoa; o desligado vai para "Outros" sem mudar total, média nem "Melhor da semana".
- [x] Linha do tempo padrão: a marca na linha do dia (aba Dia).
- [x] Abrir já filtrado (setor e período) — em UMA requisição; o endereço sempre vence.
- [x] Média ou mediana (o rótulo diz qual; a régua do padrão não muda).
- [x] O que a TV mostra: liga/desliga de cada bloco que a TV já tem; a tela se rearruma.
- [x] O botão "Configurar painel" só para o admin; a janela lida no clique, numa requisição.
- [x] Salvar: valida chave a chave, grava só o que mudou, trilha com antes/depois, nada gravado quando nada mudou.
- [x] Ao vivo sem canal novo: o salvar avisa os setores de produção; a TV e a tela releem a própria porta.
- [x] Ensaio ×100 ANTES das telas; bateria com bloco novo (41 verificações) e a cadeia do bloco 38; bateria inteira 2×.
- [x] Telas + testes de tela; tipos, lint, build com o tamanho dos pedaços.
- [x] Este diário; commits por caminho explícito no ramo da worktree. **Sem prints** (o supervisor tira) — a seção "Como abrir cada estado de tela" diz como montar a vitrine.

## O que foi feito, por arquivo

### Banco — `supabase/migrations/20261109040000_plt_tempos_painel_config.sql` (novo, 1.558 linhas, GERADO por programa)

A migration não foi escrita à mão: um gerador (`gerar47c.mjs`, no scratchpad) lê cada função vigente extraída pelo `viva.mjs` e aplica **trocas exatas que conferem quantas vezes casaram**; qualquer troca que não case o número esperado derruba a geração.

1. **Onde mora** — `plt_tempo_config.painel jsonb not null default '{}'` (com a trava "é um objeto", criada sem validar e validada em seguida) e `plt_tempo_equipe.no_painel boolean not null default true`. Nenhuma tabela nova; nada da integração tocado.
2. **Ajudantes (fora da API, em `plt_privado`)**: `fn_tempos_painel_padrao()` (o desenho de antes), `fn_tempos_painel()` (o efetivo = padrão + gravado; o setor de abertura que deixou de ser setor de produção ativo volta a "o que o aparelho lembra"), `fn_tempos_desligados(setor, menos)`, `fn_tempos_visiveis(ids, desligados)`, `fn_tempos_chave_visivel(chave, desligados)`, `fn_tempos_painel_rotulo`/`fn_tempos_painel_texto` (a mudança em língua de gente para a Auditoria) e `fn_tempos_pessoas` recriada (o mapa de nomes ganha a entrada "Outros").
3. **As portas das abas, recriadas com as MESMAS assinaturas (a resposta só ganha chaves)**:
   - `plt_fn_tempos_dia` — `painel`; `media_s` já existia; os montadores/ajudantes de cada móvel como aparecem; cada trecho da linha do dia ganha `ref` (de qual móvel é) e, só com a marca ligada, `padrao_s` e `movel_s`; a faixa "Outros" vem por último.
   - `plt_fn_tempos_periodo` — `painel`; `media_s` por montador (total ÷ válidas, na mesma passada); as séries e a tabela "Por montador" pela equipe como aparece; a equipe só de desligados nunca ocupa uma das 7 séries (vai para o "+ outros").
   - `plt_fn_tempos_moveis` — `painel`; `media_s` do modelo e de cada pessoa; aceita ordenar por `'media'`; as colunas = 6 pessoas + "Outros" por último.
   - `plt_fn_tempos_modelo_passagens` — os montadores de cada montagem como aparecem.
   - `plt_fn_tempos_montadores` — `painel`; `media_s` por cartão; o cartão "Outros" por último; os "melhores" com a equipe como aparece.
   - `plt_fn_tempos_conferir` — só ganha `painel` (os nomes ficam: é ferramenta de conferência).
   - `plt_fn_tempos_procurar` e `plt_fn_tempos_opcoes` — **não tocadas** (continuam dizendo quem montou).
4. **`plt_fn_modo_tv(bigint, date)`** — `painel`; `tempo_media_hoje_s`, `tempo_media_30_s`, `montadores[].media_hoje_s`; a regra por pessoa (a letra dela ou "Outros": sem letra no setor ou desligada); quem está desligado sai da coluna dos montadores; o "Melhor da semana" continua escolhido pela mesma conta (o número não muda) e, se for de um desligado, aparece como "Outros". **Continua sem nome nem foto.**
5. **Portas novas**: `plt_fn_tempos_abertura(p_setor_lembrado, p_hoje)` (resolve setor → aba → período e devolve a resposta da porta da aba, chamada por dentro), `plt_fn_tempos_painel()` (a janela: só admin) e `plt_fn_tempos_painel_salvar(p_painel, p_montadores)` (só admin; trilha `tempo_painel_alterado`; avisa `setor_N` de cada setor de produção ativo; devolve `{painel, mudou}`).
6. **Permissões**: `revoke` de `public`/`anon` e `grant` a `authenticated` nas 10 portas; os ajudantes sem acesso pela API.

As 7 portas recriadas levam `set plan_cache_mode = force_custom_plan` (o achado do ensaio — ver "Decisões técnicas").

### Bateria — `supabase/testes/testar-migrations.mjs` (+511 −1, **sem formatar**)

- A cadeia de reaplicação do bloco 38 ganhou `'20261109040000_plt_tempos_painel_config.sql'` logo depois de `'20261109010000_plt_sessao47_base.sql'` (com 2 linhas de comentário).
- **Bloco novo `{ … } // fim do bloco SESSAO-47 · Bloco C`**, no fim, antes da contagem final (`const contar = …`): **41 verificações** num cenário próprio (setores `m47c`/`l47c`; Ana, Bia, Caio, Davi, Adm, Lia e Tela "47C", `auth_user_id` terminando em `9249 01…07`; dois dias marcados como trabalhados; 11 casos do histórico + 2 cards da plataforma): a configuração padrão vindo junto de cada porta; a média conferida à mão ao lado da mediana; só o admin abre a janela e salva (líder, funcionário e a conta só-TV recusados); cada chave gravada e relida; na coluna só o que difere do padrão; a trilha com antes/depois e nada quando nada mudou; valores inválidos recusados em língua de gente; o aviso ao vivo nos setores; **a Bia desligada: números do setor IDÊNTICOS na TV, no Período, em Móveis, em Montadores, no Dia e nas montagens do modelo**; Conferir/Procurar/opções continuam com o nome; o funcionário desligado vê o próprio nome; a dupla com um e com os dois desligados; salvar a equipe (Configurações) não mexe no liga/desliga; a marca do padrão; a abertura (configurada, lembrada, padrão) devolvendo a MESMA resposta da porta da aba; a TV sem nenhum nome do cenário no texto da resposta; privilégios e o plano sob medida.

### Telas (todas formatadas com o prettier; nada fora das pastas que são desta frente)

- `src/dashboards/tempos/painel.ts` (novo) — o tipo da configuração, o padrão, `painelDe(resposta)` (**chave ausente ou inválida = padrão** — é o que faz a tela nova abrir com o banco de antes), os rótulos de média/mediana e `ID_OUTROS`.
- `src/dashboards/tempos/api.ts` — os tipos novos das respostas (tudo opcional), `abrirTempos`, `buscarConfiguracaoDoPainel`, `salvarPainel`.
- `src/dashboards/tempos/consultas.ts` (novo) — as chaves das consultas das abas num lugar só e `semearAbertura` (põe a resposta da abertura onde a aba procura).
- `src/dashboards/tempos/GraficoMoveis.tsx` (novo) — UM gráfico para a tela e para a TV, nos três tipos, sem animação e com o total em cima.
- `src/dashboards/tempos/linhaDoDia.ts` (novo) — a conta da marca do padrão na linha do dia.
- `src/dashboards/tempos/formato.ts` — `nomeCurtoDaPessoa` ("Outros" para a chave zerada).
- `src/paginas/dashboards/TemposProducao.tsx` — o botão "Configurar painel" (só admin, ao lado do Modo TV), a janela carregada só no clique e a abertura em uma requisição.
- `src/paginas/dashboards/tempos/ConfigurarPainel.tsx` (novo) — a janela.
- `src/paginas/dashboards/tempos/AbaDia.tsx`, `AbaPeriodo.tsx`, `AbaMoveis.tsx`, `AbaMontadores.tsx`, `comum.tsx` — cada aba desenha a configuração que veio na própria resposta.
- `src/paginas/dashboards/ModoTv.tsx` — os blocos ligam/desligam e a tela se rearruma; o tipo do gráfico; média/mediana; "A + Outros".
- `src/auditoria/rotulos.ts` — a ação nova da trilha com nome de gente: "Mudou a configuração do painel de tempos".
- `src/paginas/dashboards/tempos/exemplos.ts` (novo) — respostas de exemplo (para os testes e para a vitrine do supervisor).
- Testes novos (53): `painel.test.ts` (5), `linhaDoDia.test.ts` (5), `GraficoMoveis.test.tsx` (3), `tempos/abas.test.tsx` (15), `tempos/ConfigurarPainel.test.tsx` (8), `TemposProducao.test.tsx` (7), `ModoTv.test.tsx` (10).

## Decisões técnicas

1. **A configuração é um objeto de chaves planas** (`grafico_periodo`, `grafico_tv`, `linha_padrao`, `abrir_setor_id`, `abrir_periodo`, `medida`, `tv_numeros`, `tv_montadores`, `tv_grafico`, `tv_melhor_semana`, `tv_relogio`, `tv_dados_ate`, `tv_ao_vivo`). Na coluna fica só o que difere do padrão; a leitura é sempre pelo efetivo. Chave nova no futuro = uma linha no padrão e uma no validador.
2. **"Outros" é a chave zerada** (`00000000-0000-0000-0000-000000000000`) no lugar do id da pessoa desligada — a regra é resolvida no banco, igual em todas as portas; a tela só traduz a chave zerada para "Outros". Na TV, onde nunca há id nem nome, é a palavra "Outros" no lugar da letra.
3. **Custo zero quando ninguém está desligado**: cada porta calcula uma vez "há alguém desligado?" e as contas do "Outros" ficam atrás dessa constante — com o plano sob medida o banco as tira da consulta.
4. **O plano sob medida em toda chamada (`plan_cache_mode = force_custom_plan`) nas 7 portas recriadas** — achado do ensaio: o banco guarda o plano das consultas de cada função e, **da 6ª chamada em diante na mesma conexão**, pode trocar para um plano genérico que não conhece o período nem os filtros. Na base de hoje, com volume ×100, a aba Montadores ia de ~120 ms para ~3.150 ms e a Dia de 25 para 90 ms a partir da 6ª chamada (a API reaproveita as conexões — acontece de verdade). Com o plano sob medida, todas as chamadas ficam iguais.
5. **A média sai da mesma passada** (o total dividido pelas válidas) — nenhuma leitura a mais.
6. **TV**: a conta por equipe passou a ser feita uma vez por equipe (materializada e agrupada), não uma vez por linha: 163 → 68 ms no ×100, agora dentro do teto de painel.
7. **Aba Dia, linha do dia**: o card e a passagem de cada trecho vêm por busca na chave, um de cada vez (`lateral … offset 0`). Num dia cheio o banco trocava a busca por uma junção que lia a tabela inteira dos cards: a aba Dia de um dia com 1.110 trechos caiu de 59 para 32 ms — e é isso que a abertura traz. A resposta é idêntica (conferida linha a linha no ensaio).
8. **A abertura chama a porta da aba por dentro** (as mesmas recusas, a mesma resposta) e devolve `{aba, setor_id, periodo, dia, de, ate, hoje_banco, painel, resposta}`. Recebe o "hoje" do aparelho (`p_hoje`, aceito só se estiver a no máximo 1 dia do relógio do banco) para a resposta cair exatamente na chave que a aba usaria.
9. **Na tela**: a abertura só roda com o endereço sem aba, setor e período; a resposta é semeada no cache da aba com a MESMA chave (`consultas.ts`) e o endereço é acertado com `replace`. Se a porta de abertura não existir (banco de antes), a tela abre como sempre abriu.
10. **O salvar** tranca a linha única da configuração (uma gravação por vez), valida chave a chave, compara com o efetivo e só então grava; a trilha leva `o_que_mudou` (frases prontas), `antes`, `depois` e `montadores_ids`.
11. **Um gráfico só** para a tela e a TV (`GraficoMoveis`), e a janela de configuração em pedaço próprio, baixado só no clique do admin.

## Decisões provisórias (para o supervisor levar ao dono — em português de gente)

1. **Só o administrador vê o botão "Configurar painel" e só ele salva.** Líder e funcionário veem apenas o resultado.
2. **Os tipos de gráfico são três**: "empilhadas por montador" (o desenho de hoje — é o que vale enquanto ninguém mexer), "barras" (uma barra por dia, só com o total) e "linhas" (uma linha por montador). O "barras (atual)" do pedido foi entendido como o empilhado que já existe.
3. **Dupla com um desligado aparece como o nome (ou a letra) de quem está ligado + "Outros".** Os dois desligados = "Outros". Móvel sem montador continua "Sem montador".
4. **A "linha do tempo padrão" virou uma marca na linha do dia** (aba Dia): em cada móvel, um tracinho mostra onde ele terminaria se levasse o tempo padrão do modelo — depois do fim, se foi mais rápido; dentro da barra, se foi mais lento. Os dois gráficos da tela contam móveis por dia, não tempo, então não havia onde riscar tempo padrão neles. **O dono pode ter imaginado outra coisa** (uma linha num gráfico de tempo, que hoje não existe).
5. **"Outros" não vale na aba Conferir, na busca nem na lista do filtro de pessoa** — são ferramentas de quem lidera para conferir e precisam dizer quem montou. Vale na lista de montagens de um modelo (aba Móveis).
6. **Média ou mediana troca só o número que aparece.** O tempo padrão de cada modelo e a conta de "abaixo / na média / acima" continuam como hoje. ⚠️ Um detalhe para confirmar: na aba Móveis, o "x% mais rápido/mais lento" ao lado do tempo de cada montador compara **o número que está sendo mostrado** (a média dele, se a média estiver escolhida) com o padrão do modelo; nos cartões da aba Montadores, a contagem "abaixo / na média / acima" continua pela conta de sempre.
7. **Quem está desligado continua vendo o próprio nome nos tempos dele** (o funcionário só enxerga o que ele montou — não faria sentido ele se ver como "Outros").
8. **A TV tem 7 blocos que ligam e desligam**: os quatro números do topo (um bloco só), a coluna dos montadores, o gráfico dos 14 dias, o melhor da semana, o relógio, o "dados até" e o selo "ao vivo". O aviso de "ao vivo pausado" e o de "sem registros" aparecem sempre (são avisos, não enfeite). Com tudo desligado, a TV diz que está tudo desligado na configuração.
9. **Na TV, quem está desligado some da coluna dos montadores** (não ganha um cartão "Outros" lá) e entra em "Outros" no gráfico.
10. **Mudança de comportamento na TV, mesmo sem ninguém mexer na configuração**: a dupla em que um dos dois não tem letra aparecia inteira como "Outros"; agora aparece como "A + Outros" (a regra passou a ser por pessoa, como o pedido descreve).
11. **A tela só abre "já filtrada" quando o endereço vem limpo.** Link salvo, filtro escolhido na hora e o botão de voltar continuam mandando. Sem nada configurado, abre como hoje: aba Dia, no setor que o aparelho lembra (ou na Montagem). **Se o administrador escolher um setor de abertura, ele vale para todos os aparelhos** — passa na frente do setor que cada aparelho lembrava (a pessoa ainda troca de setor na hora, como sempre).
12. **"Abrir em hoje" e "não configurado" são a mesma coisa** (a aba Dia); "7 dias" e "30 dias" abrem na aba Período com esse período.
13. **Na aba Móveis, as colunas são 6 pessoas + "Outros"** (uma coluna a mais, por último, só quando há alguém desligado).
14. **A janela tem um botão "Voltar ao padrão"** (os gráficos, o tempo médio, a abertura e a TV voltam ao desenho de antes; os montadores não são religados por ele).
15. **A porta da TV continua mandando todos os dados mesmo com um bloco desligado** — quem esconde é a tela (a resposta não muda de forma; a TV antiga, ainda aberta, segue funcionando).
16. **A configuração é uma só para a fábrica inteira** (o tipo de gráfico, média/mediana, a marca, a abertura e os blocos da TV valem para todos os setores e todas as TVs); só o liga/desliga dos montadores é por setor, porque a equipe do painel é por setor.

## Erros e acertos que valem virar aprendizado (sem numerar)

- **Acerto/achado — medir a 6ª chamada, não a 2ª.** O ensaio ×100 que mede "a 2ª chamada" não vê o plano genérico que o banco adota depois de 5 chamadas da mesma função na mesma conexão. A sonda que chama 10 vezes seguidas mostrou o degrau (Montadores 30 dias: 127 → 3.184 ms na 6ª). Remédio: `set plan_cache_mode = force_custom_plan` na função. **Provavelmente vale para outras portas `plpgsql` da plataforma com período e filtros opcionais** — não sondei as que não são desta frente.
- **Acerto — medir antes × depois INTERCALADO na mesma sessão** (a versão de antes recriada com outro nome, `zz_antes_*`): tira o ruído da máquina e separa o efeito do plano sob medida do efeito da mudança. Duas medidas tomadas enquanto outra frente rodava a bateria saíram 3× mais altas nos dois lados — só o intercalado deixou ver que era a máquina.
- **Erro (corrigido) — o ensaio só media "ontem".** A abertura traz o dia de HOJE, e a semente tinha o dobro de trechos hoje: o banco trocava a busca por card por uma junção que lia a chave inteira dos cards (59 ms na base; 101 ms com a marca ligada na minha 1ª versão). Achado só porque a abertura foi medida à parte. Remédio: busca por linha (`lateral … offset 0`). **Lição: ensaiar o caso que a tela abre de verdade, não só o caso bonito.**
- **Erro (corrigido) — a minha 1ª versão cobrava o "Outros" mesmo com ninguém desligado** (uma função chamada por linha; +10 ms no Período de 30 dias). Remédio: a constante "há alguém desligado?" na frente de cada conta.
- **Erro (corrigido) — nome de variável que já existia na função recriada**: `v_linha` (Dia) e `v_desl` (Móveis, que é o deslocamento). O banco recusa a duplicata no `declare`, mas um nome igual com outro tipo num lugar sem `declare` passaria — conferir os nomes antes de acrescentar.
- **Acerto — CTE usada mais de uma vez pede `materialized`** quando o banco resolve refazê-la por linha (foi o que pesava na TV).
- **Erro (corrigido) — o `replace` do JavaScript come o `$$`** do texto novo (`$$` vira `$`): trocar texto de função por `split/join`.
- **Erro (corrigido) — script com barra invertida por heredoc** chegou estragado ao arquivo (não gravou nada). Script com escapes vai pela ferramenta de escrita, sempre.
- **Erro (corrigido) — comparar `jsonb` como texto** na bateria falha pela ordem das chaves: canonizar (ordenar as chaves) antes de comparar.
- **A worktree nasce sem `.env.local`** e 9 arquivos de teste antigos param em "Faltam VITE_SUPABASE_URL…": rodar o vitest com dois valores de enfeite no ambiente (`VITE_SUPABASE_URL="https://teste.invalid" VITE_SUPABASE_ANON_KEY="chave-de-teste-sem-valor"`), sem ler nem criar `.env`.
- **A worktree pode nascer atrás do ramo da sessão** — conferir `git log -1` contra o que o brief descreve antes de ler o cofre.
- **A ferramenta de shell recusa `sed`/`node -e` com variável e git composto** dentro da worktree isolada: caminho literal e `git -C "<pasta>"` simples.

## Resultados

### Ensaio ×100 (PGlite; 300 mil passagens, 50 mil na Montagem ×100 com 10% de duplas, 88,5 mil do histórico, 2.000 modelos, equipe A–J; `analyze`; mediana em ms)

Feito **antes das telas**. "Antes (como está)" = a base medida do jeito de sempre (9 chamadas seguidas na mesma conexão — cai no plano genérico); as outras colunas são antes × depois intercalados, com o plano sob medida nos dois lados (11 chamadas de cada).

| Porta | Antes (como está) | Antes, plano sob medida | Depois · padrão | Depois · 2 desligados + marca + média |
|---|---:|---:|---:|---:|
| Dia (ontem, 556 móveis) | 84,6 | 23,6 | 24,8 | 27,8 |
| Dia — "Ver mais" | 6,6 | 5,9 | 6,1 | 8,1 |
| Dia de hoje (1.110 trechos — o que a abertura traz) | — | 58,9 | **32,2** | 39,4 |
| Período 7 dias | 21,4 | 19,9 | 19,9 | 22,5 |
| Período 30 dias | 85,9 | 76,0 | 77,7 | 83,5 |
| Período 90 dias (dívida 31) | 575 | 515 | 526 | 593 |
| Móveis 30 dias | 72,2 | 52,0 | 55,0 | 59,6 |
| Móveis 90 dias (dívida 31) | 330 | 223 | 232 | 266 |
| Montagens de um modelo | 3,9 | 3,3 | 3,4 | 3,6 |
| Montadores 30 dias | **3.140** | 112,8 | 113,5 | 116,7 |
| Montadores 90 dias (dívida 31) | **19.376** | 647 | 661 | 645 |
| Montadores 30 dias (funcionário) | 464,5 | 34,0 | 33,7 | 31,0 |
| Conferir 30 dias | 37,2 | 19,5 | 19,7 | 18,4 |
| **Modo TV** | 179,9 | 163,9 | **68,4** | 69,9 |

Portas novas: a janela 0,7 ms · salvar (2 montadores, com trilha e aviso) 2,1 ms · **abertura = a aba + ~1,5 ms** (aba Dia de hoje: 33,6 contra 32,1 chamada direto; configurada em Período 7 dias: 21,5).

A sonda de 10 chamadas seguidas (ms), aba Montadores 30 dias: **antes** `355 · 152 · 122 · 127 · 127 · 3184 · 3154 · 3120 · 3188 · 3169`; **depois** `330 · 147 · 125 · 121 · 121 · 128 · 121 · 120 · 121 · 123`. Aba Dia: antes `79 · 27 · 25 · 24 · 25 · 93 · 89 · 89 · 93 · 91`; depois `71 · 30 · 27 · 29 · 31 · 29 · 32 · 27 · 25 · 31`.

As duas últimas colunas vêm de blocos de medida diferentes (a máquina oscila alguns ms entre um bloco e outro — o "antes" do 2º bloco, não mostrado, foi: Dia 20,1 · Ver mais 5,5 · hoje 58,4 · Período 19,3 / 73,4 / 536 · Móveis 52,9 / 228 · modelo 3,5 · Montadores 115,0 / 630 / 30,5 · Conferir 18,2 · TV 174,2). O que vale é a diferença contra o "antes" do próprio bloco:

Leitura: com a configuração padrão a mudança soma **0 a 3 ms** nas portas de até 30 dias; nos 90 dias (que já estavam acima do teto — dívida 31) soma ~9–14 ms (a média por pessoa/modelo). Com gente desligada + a marca, o Dia soma ~8 ms, o Período ~10 ms (30 dias) e ~57 ms (90 dias), Móveis ~7 ms (30) e ~38 ms (90) e Montadores ~2 ms (30) e ~15 ms (90) — a conta do "Outros" por equipe. Tudo de 30 dias dentro dos tetos (tela ≤ 50, painel ≤ 150); a TV entrou no teto (−95 ms); o dia cheio da aba Dia caiu 27 ms; a dívida 31 continua (não paga, um pouco maior — mais quando há gente desligada).

Planos de dentro (o ×100): período de 30 dias pela tabela pronta = `Bitmap Index Scan … plt_tempo_montagens_setor_dia_idx` (19 ms); 1ª página do Dia = `Index Scan … setor_dia_idx` + ordenação incremental (1 ms); os trechos do dia com a marca = `Index Scan … plt_tempo_trechos_setor_dia_idx` + busca por chave em `plt_cards` e `plt_tempo_passagens` (12 ms com 1.110 trechos); a equipe do painel = 10 linhas. Nenhuma varredura sequencial em tabela que cresce.

### Bateria do banco (inteira; ela mesma aplica as migrations duas vezes)

Linha de base do supervisor: 1.544 ✔ + 1 ✘ antigo ("Dashboard: as 7 portas novas = as antigas em 8 períodos" — não é desta frente).

| Rodada | Migration | ✔ | ✘ |
|---|---|---:|---|
| 1 e 2 | a versão anterior à busca por linha na aba Dia | 1.585 | 1 (o antigo) |
| **3 e 4** | **a versão final (a que vai no commit)** | **1.585** | **1 (o antigo)** |

1.585 − 1.544 = as 41 verificações do bloco novo. O bloco sozinho, no banco de ensaio: 41 ✔ · 0 ✘.

### Front

- **Tipos** (`tsc -b`): limpo. **Lint** (`eslint .`): limpo. **Prettier**: os 23 arquivos de `src/` tocados conferem.
- **Testes de tela** (`vitest run --dir src`): **73 arquivos · 478 testes verdes** (53 novos): o botão só para o admin; a janela lida no clique com letra, nome e foto; o salvar mandando só o que mudou; cada item mudando o desenho (tipo do gráfico, rótulo média/mediana, a marca do padrão, os blocos da TV); a TV só com letras; a TV aberta mudando na hora com o aviso do setor; **a abertura em UMA chamada**; o endereço vencendo; e a tela nova com resposta SEM a configuração e sem a porta de abertura (o banco de antes).
- **Build**: verde. **JS inicial 149,5 → 149,5 KB comprimidos** (teto 250). Pedaços (KB gzip, antes → depois): `TemposProducao` 5,91 → 6,61 · `ModoTv` 4,57 → 4,57 · `AbaDia` 3,11 → 3,65 · `AbaPeriodo` 3,11 → 2,72 · `AbaMoveis` 2,56 → 2,63 · `AbaMontadores` 1,89 → 2,05 · `AbaConferir` 3,35 = · `formato` 1,13 → 1,84 · novos: `GraficoMoveis` 0,94, `ConfigurarPainel` 2,83 (só no clique do admin), `LineChart` 0,25. Todos os pedaços somados: 811,4 → 817,4 KB.

## Checklist de desempenho (§12 da Lei)

- [x] **Requisições**: a abertura da tela = 1 (provado em teste de tela); cada aba = 1 (a configuração vem junto); a janela = 1, só no clique; nenhuma repetida sozinha. ⚠️ Não vi a aba Network de verdade (sem banco nem navegador nesta frente) — a prova é o teste de tela.
- [x] **Busca no código**: nenhum `refetchInterval`, `setInterval` buscando dado nem `postgres_changes` novo (conferido no diff e nos arquivos novos).
- [x] **Toda porta nova/tocada com `EXPLAIN ANALYZE` no ×100**, sem varredura sequencial em tabela que cresce, dentro do teto nos 30 dias — os planos estão acima; os 90 dias são a dívida 31 (já existia).
- [x] **Índices**: nenhuma chave estrangeira, filtro ou ordenação nova (uma coluna booleana numa tabela de dezenas de linhas e uma coluna na linha única). ⚠️ Os advisors só rodam depois de aplicar — fica para o supervisor.
- [x] **RLS**: nenhuma política nova; as duas tabelas continuam fora da API (conferido na bateria).
- [x] **Listas**: nenhuma lista nova; as que existem continuam por cursor com teto no banco.
- [x] **Pacote**: números acima.
- [x] **Escrita idempotente**: salvar igual ao que está = nada gravado, nada na trilha, nenhum aviso; sem chamada externa.
- [x] **Tablet/celular**: gráficos sem animação; a janela no `Modal` da casa (`tamanho="galpao"`), sem rolagem lateral em 375/768 por construção. ⚠️ Sem medida de INP nem print nesta frente (o supervisor tira).
- [x] **Telas tocadas adequadas**: a TV saiu do vermelho (163 → 68 ms). Fica a dívida 31 (≥ 90 dias), agora com o acréscimo quando há gente desligada — números acima, para o supervisor registrar.

## Como abrir cada estado de tela (para a vitrine e os prints)

Os dados de exemplo estão em `src/paginas/dashboards/tempos/exemplos.ts` (Ana = A, Bia = B, Caio = C). `comPainel(resposta, {…})` troca a configuração; `comPainel(resposta, undefined)` tira a chave (o banco de antes). Em todos, o `supabase.rpc` de mentira devolve a resposta escolhida — os testes ao lado de cada tela mostram a montagem exata (provedores e rotas).

| Estado | Componente | Dados |
|---|---|---|
| Botão "Configurar painel" (só admin) | `TemposProducao` em `/dashboards/tempos-de-producao?aba=periodo&setor=6`, perfil `admin` × `lider` | `plt_fn_tempos_periodo` → `EXEMPLO_PERIODO` |
| A janela (letra, nome, foto, liga/desliga; o Caio já desligado) | `<ConfigurarPainel setorAtual={6} aoFechar={…} />` | `plt_fn_tempos_painel` → `EXEMPLO_CONFIGURACAO` |
| A janela recusada / erro de leitura | idem | `rpc` devolvendo `error: { message: 'Só um administrador mexe nas regras de tempo.' }` |
| Período · empilhadas (padrão) / barras / linhas | `<AbaPeriodo filtros={…} aoContador={…} />` | `comPainel(EXEMPLO_PERIODO, { grafico_periodo: 'barras' \| 'linhas' })` |
| Período · média | idem | `comPainel(EXEMPLO_PERIODO, { medida: 'media' })` |
| Período · com "Outros" (a Bia desligada; a dupla "Ana + Outros") | idem | `EXEMPLO_PERIODO_COM_OUTROS` |
| Dia · padrão / média | `<AbaDia … />` | `EXEMPLO_DIA` · `comPainel(EXEMPLO_DIA, { medida: 'media' })` |
| Dia · a marca do tempo padrão | idem | `EXEMPLO_DIA_COM_MARCA` (3 marcas; legenda "onde terminaria no tempo padrão") |
| Dia · a faixa "Outros" | idem | `EXEMPLO_DIA_COM_OUTROS` |
| Móveis · média / coluna "Outros" | `<AbaMoveis … />` | `comPainel(EXEMPLO_MOVEIS, { medida: 'media' })` · `EXEMPLO_MOVEIS_COM_OUTROS` |
| Montadores · média / cartão "Outros" | `<AbaMontadores … />` | `comPainel(EXEMPLO_MONTADORES, { medida: 'media' })` · `EXEMPLO_MONTADORES_COM_OUTROS` |
| TV · inteira (padrão) | `<ModoTv />` em `/dashboards/modo-tv?setor=6`, perfil com o módulo `tv` | `plt_fn_modo_tv` → `EXEMPLO_TV` |
| TV · barras / linhas / média | idem | `comPainel(EXEMPLO_TV, { grafico_tv: 'barras' \| 'linhas' })` · `{ medida: 'media' }` |
| TV · um bloco desligado de cada vez | idem | `comPainel(EXEMPLO_TV, { tv_numeros: false })` … `tv_montadores`, `tv_grafico`, `tv_melhor_semana`, `tv_relogio`, `tv_dados_ate`, `tv_ao_vivo` |
| TV · sem os números e sem o gráfico (a coluna ocupa a tela) | idem | `comPainel(EXEMPLO_TV, { tv_numeros: false, tv_grafico: false })` |
| TV · tudo desligado | idem | os 7 `tv_*` em `false` |
| TV · montador desligado ("Outros" no gráfico e no melhor da semana) | idem | `EXEMPLO_TV_COM_OUTROS` |
| Tela nova × banco de antes | qualquer aba / a TV | `comPainel(EXEMPLO_…, undefined)` |
| A abertura (a tela nasce em outro setor/período) | `TemposProducao` em `/dashboards/tempos-de-producao` (endereço limpo) | `plt_fn_tempos_abertura` → `{ aba: 'periodo', setor_id: 7, periodo: '7', dia, de, ate, painel, resposta }` (o molde está em `TemposProducao.test.tsx`) |

Marcas úteis no desenho: `[data-bloco="numeros|montadores|grafico"]` (TV), `[data-grafico="empilhadas|barras|linhas"]`, `[data-marca-padrao]` (aba Dia).

## Como testar com o banco de verdade (depois de aplicado — para o handoff)

1. Entrar como administrador → Dashboards → Tempos de produção: o botão "Configurar painel" aparece ao lado de "Modo TV"; como líder ou funcionário, não aparece.
2. Abrir a janela: a equipe de cada setor com letra, nome e foto; tudo ligado; gráficos "empilhadas"; "mediana".
3. Trocar o gráfico do Período para "linhas" e salvar: a aba Período muda sem recarregar; **uma TV aberta noutra aba/aparelho muda na hora** ao trocar o gráfico da TV ou desligar um bloco.
4. Desligar um montador: ele some da coluna na TV e das colunas/cartões na tela e aparece "Outros"; **conferir que os totais do setor (montados no dia, no mês, tempo médio) são os mesmos de antes**; religar.
5. Ligar a marca do tempo padrão: na aba Dia, cada móvel com modelo conhecido ganha o tracinho.
6. Escolher "média": os rótulos passam a dizer "média" (tela e TV) e os números mudam; voltar para "mediana".
7. "Como a tela abre": escolher um setor e "7 dias", salvar, abrir Dashboards → Tempos de produção pelo menu (endereço limpo): abre na aba Período, 7 dias, naquele setor; um link com `?aba=…` continua abrindo onde aponta.
8. Auditoria: a linha "Mudou a configuração do painel de tempos" com o que mudou em frases.
9. "Voltar ao padrão" + salvar: tudo como antes.

## Pendente, sem prova ou para o supervisor conferir com cuidado

- **TVs que já estão ligadas com o programa antigo não se atualizam sozinhas** (o Modo TV não tem aviso de versão nova): depois de publicar o site, recarregar cada TV uma vez. Com o programa antigo + banco novo a TV segue funcionando (a resposta só ganhou chaves) — só não obedece à configuração.
- **O md5 dos corpos de origem não foi conferido com a produção** (leitura barrada). Lista abaixo.
- **O degrau do plano genérico provavelmente existe em outras portas `plpgsql`** da plataforma (as de dashboards com período e filtros opcionais). Não sondei o que não é desta frente — nem `plt_fn_tempos_procurar` e `plt_fn_tempos_opcoes`, que não recriei.
- **Conflitos esperados na junção dos ramos**: `supabase/testes/testar-migrations.mjs` (a linha da cadeia do bloco 38 e o bloco novo no fim, se outra frente também acrescentou os seus) e talvez `src/auditoria/rotulos.ts` (uma linha).
- **A abertura pelo caminho de reserva** (quando o app não tem a hora do banco): o ouvinte ao vivo da tela relê a aba uma vez logo depois da abertura — 2 requisições em vez de 1 nesse caso raro. O ouvinte é compartilhado (`src/lib/aoVivo.ts`, fora desta frente); no caminho normal ele pede a reprise dos avisos e não relê.
- **Como a mudança aparece na Auditoria**: a linha "Mudou a configuração do painel de tempos" traz "O que mudou" com as frases prontas (ex.: "Gráfico da aba Período: barras empilhadas por montador → linhas por montador", "Montador B (Fulano) · MONTAGEM: ligado → desligado") **e também "Antes" e "Depois" com as chaves cruas da configuração** (`{"grafico_periodo":"linhas"}`) — é assim que a tela da Auditoria mostra qualquer antes/depois hoje (as regras de tempo também). Nesta frente a Auditoria só podia ganhar o nome da ação; esconder ou traduzir o antes/depois cru é um ajuste na tela da Auditoria, se o dono quiser. A lista dos montadores mexidos vai numa chave que a Auditoria já esconde (é só para a máquina).
- **Custo com gente desligada nos períodos longos** (Período 90 dias +57 ms; Móveis 90 dias +38 ms) — em cima da dívida 31.
- **Sem prints e sem medida no aparelho** (INP/LCP) nesta frente; advisors só depois de aplicar.
- **O vitest na worktree** precisa dos dois valores de enfeite no ambiente (ver os comandos).
- Não tocado, de propósito: `plt_fn_tempo_equipe`/`plt_fn_tempo_equipe_salvar` (salvar a equipe em Configurações preserva o liga/desliga — provado na bateria), `src/componentes/ui/**`, `src/lib/aoVivo.ts`, `src/paginas/controleTempo/**` (só importados), as notas do cofre.

## Para conferir com a produção — o md5 do corpo de origem de cada função recriada

| Função | Origem (migration:linhas) | Trocas | md5 do corpo vigente |
|---|---|---:|---|
| `plt_privado.fn_tempos_pessoas` | `20261105040000…:558-568` | 1 | `19f75da2073e3174ee6c6586bad1426f` |
| `plt_fn_tempos_dia` | `20261105040000…:593-741` | 8 | `071ead0df7e4e9ce0e1e1195e67c2da2` |
| `plt_fn_tempos_periodo` | `20261105040000…:748-872` | 10 | `ea3f552c20db73783711cc4cfc629a0d` |
| `plt_fn_tempos_moveis` | `20261105040000…:881-1009` | 13 | `7e662645a80a8152bbfab563c48f13dd` |
| `plt_fn_tempos_modelo_passagens` | `20261105040000…:1013-1065` | 3 | `e59c31bd28a884df63897c300aa8c03e` |
| `plt_fn_tempos_montadores` | `20261105040000…:1073-1218` | 10 | `b017ed90546f877fd58a65349f0dc82e` |
| `plt_fn_tempos_conferir` | `20261105040000…:1226-1343` | 3 | `f072aa444e7bd0e21701be21a25cf3fc` |
| `plt_fn_modo_tv` | `20261106020000…:79-216` | 13 | `2fde689e41ba7513d534126c51e25c38` |

(O md5 é do texto entre os `$$` como está na migration de origem; se o banco vivo guardar o corpo com outro fim de linha, comparar depois de normalizar.)

## Commits (no ramo `worktree-agent-aeb9402ea3d4a0d3b`, por caminho explícito; sem `push`, sem merge)

1. `b16145c` — banco + bateria: a migration `20261109040000_plt_tempos_painel_config.sql` e `supabase/testes/testar-migrations.mjs`.
2. `9c9fc31` — telas e testes: os 10 arquivos alterados e os 13 novos de `src/`.
3. o commit deste diário (o último do ramo).

A base do ramo é `7347451` (a ponta do ramo do supervisor quando esta frente começou).

## Comandos rodados (os que importam)

- `git merge --ff-only 7347451` · `npm ci --prefix "<worktree>"`
- `node viva.mjs --raiz "<worktree>" --saida "<scratchpad>/vivas" --ate 20261109040000 …` → `node gerar47c.mjs` (gera a migration)
- Banco de ensaio: `node dev47c.mjs retrato` · `semear ensaio47c.mjs` · `prova <base|cheio> <antes|depois> <prova.mjs>` (ensaio, sonda do plano, perfil intercalado, o bloco da bateria em segundos)
- `npm --prefix "<worktree>" run test:banco > <log> 2>&1 < /dev/null` (4×; lido só com `grep -c '✔'`, `grep -n '✘'`, `tail`)
- `npx --prefix "<worktree>" tsc -b "<worktree>"` · `npm --prefix "<worktree>" run lint` · `npx --prefix "<worktree>" prettier --check <os 23 arquivos>`
- `VITE_SUPABASE_URL="https://teste.invalid" VITE_SUPABASE_ANON_KEY="chave-de-teste-sem-valor" npx --prefix "<worktree>" vitest run --root "<worktree>" --dir src`
- `npm --prefix "<worktree>" run build` (antes e depois)

Ferramentas e registros (fora do repositório, no scratchpad da sessão, pasta `s47c/`): `gerar47c.mjs` (o gerador — fonte da migration), `dev47c.mjs`, `ensaio47c.mjs`, `sonda-plano.mjs`, `perfil47c.mjs`, `hoje47c.mjs`, `hoje47c-b.mjs`, `plano47c.mjs`, `bloco47c-corpo.js`/`bloco47c-dev.mjs`/`colar47c.mjs`, `comparar-build.mjs`; registros `ensaio-antes-1.log`, `ensaio-depois-4.log`, `sonda-antes.log`, `sonda-depois-2.log`, `perfil-5.log`, `hoje-1.log`/`hoje-2.log`/`hoje-3.log`, `bateria-1…4.log`, `build-antes.log`/`build-depois.log`.
