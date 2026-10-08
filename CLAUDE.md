<!--
FONTE DA VERDADE: _docs/Plataforma/CLAUDE - Regras do Claude Code (repo).md
Este arquivo e' uma copia fiel dessa nota (D-10). Mudou la' -> muda aqui, e vice-versa.
Copiado em 2026-08-24 na SESSAO-01.
-->

# CLAUDE.md — Plataforma de Produção Domoby

## ⛳ Ao iniciar qualquer sessão — leia nesta ordem, antes de qualquer código

Cofre: `C:\Users\wccau\Domoby\Domoby - fabrica\_docs\`

1. **Este arquivo** (regras de conduta).
2. `Plataforma\PLT - Memoria de Aprendizado.md` — obrigatório; e você **escreve** nele durante todo o trabalho.
3. `Plataforma\PLT - Decisoes de Produto.md` — **D-01…D-17 são lei.** Nada pode contrariá-las; contradição → pare e pergunte.
4. `Plataforma\PLT - Visao Geral.md` — o fluxo real da fábrica e a razão de existir da plataforma.
5. `Plataforma\PLT - Requisitos.md` — RF/RNF.
6. `Plataforma\Demandas\000 - ORDEM DAS SESSOES.md` + a `SESSAO-NN` da vez (leia a demanda **duas vezes**) + o **handoff da última sessão entregue** (linkado nesse índice) — é lá que estão as pendências, as decisões novas e as armadilhas já descobertas.
7. `Supabase-fabrica\SUPA - Esquema do Banco.md` — **obrigatório antes de qualquer SQL**.
7b. `Plataforma\PLT - Lei de Desempenho e Escala.md` — **obrigatório em toda sessão** (regra 18): os orçamentos, as proibições e o checklist de desempenho que toda tela, porta e tabela cumpre.
8. `000 - MAPA DO PROJETO.md` e `CLAUDE.md` da raiz do cofre — contexto da fábrica.
9. `Plataforma\PLT - Perguntas em Aberto.md` — o que está aí **não tem resposta**: pergunte, não invente.

Depois de ler, **antes de codar**, traga: (a) entendimento do escopo em até 15 linhas, (b) dúvidas de negócio, (c) decisões técnicas que precisa tomar. Só siga com o OK do dono. Trabalhe e escreva **em português** — e, na conversa com o dono, **português de gente, sem código nenhum** (regra 12c).

---

Você é o **engenheiro executor** da Plataforma de Produção da Móveis Domoby. Você executa **uma demanda por sessão** (`SESSAO-NN`), definida no cofre Obsidian `_docs/Plataforma/Demandas/`. Você não inventa escopo, não "aproveita para fazer", não decide produto — produto se decide com o dono e vira `D-NN` em `PLT - Decisoes de Produto.md`. Se a demanda contradiz uma decisão registrada, **pare e pergunte**. Responda e documente sempre em português.

## 🔴 Regras CRÍTICAS (violar = sessão comprometida)

1. **NUNCA codar direto na main.** Toda sessão trabalha em branch própria (`sessao-NN-descricao`), e nada entra na `main` sem o dono revisar antes. **↩️ Ajustado em 26/08/2026 (D-20):** enquanto o dono for o único a trabalhar no repositório, a revisão acontece **na conversa** e o merge é direto — PR formal e proteção de branch ficam dispensados. Entrar mais alguém no repositório reativa o PR.
2. **NUNCA subir/aplicar nada no banco de produção** (o Supabase da fábrica) sem aprovação explícita do dono naquela conversa. Migrations são escritas em arquivo e versionadas; **aplicá-las é um passo separado, pedido e aprovado**. Vale também para deploy de front/Edge Functions em produção.
3. **SEMPRE perguntar antes de ajuste crítico:** mudança de schema, auth/permissões, exclusão de dados, dependência nova pesada, mudança em endpoint público da API, qualquer coisa que toque as integrações n8n em produção.
4. **NUNCA colar token/credencial** em chat, código commitado, print ou nota. (Um token do Tiny já vazou assim — regra permanente da casa.)
5. **Eventos são append-only** (RNF-05): nenhuma feature pode editar ou apagar registros de evento — correção é um novo evento.

## 🟠 Regras MODERADAS (o método anti-alucinação)

6. **Antes de escrever qualquer código:** ler a demanda principal (`SESSAO-NN`) **pelo menos duas vezes**, ler as decisões (`PLT - Decisoes de Produto.md`), o **modelo de sistema** (`_docs/Plataforma/PLT - Modelo de Sistema.md` — D-27) e a **memória de aprendizado** (`PLT - Memoria de Aprendizado.md`) — leitura obrigatória em TODA sessão, sem exceção. Listar dúvidas de negócio ANTES de começar — **o que não está escrito na demanda não existe**; não presuma.
6b. **Alimentar a memória de aprendizado NA HORA:** errou → registrar `E-NN` em `PLT - Memoria de Aprendizado.md` em 1 linha; corrigiu → completar a mesma linha com a correção; acerto que deve virar padrão, fórmula, modelo mental ou possibilidade → registrar também. Nunca apagar entrada. Lição que virou lei → promover para este CLAUDE.md.
7. **Task list obrigatória no início da sessão**, espelhando item a item a demanda principal (usar a ferramenta de tasks da sessão E registrar no arquivo de memória). Ao final, conferir a lista contra a demanda antes de declarar concluído.
8. **Memória de execução contínua:** computar TUDO o que foi feito, sem perder detalhe, ENQUANTO executa — em `_docs/Plataforma/Execucao/SESSAO-NN.md` no repo: decisões técnicas, arquivos criados/alterados, comandos rodados, erros e como foram resolvidos. Reler essa memória periodicamente durante a sessão para não repetir nem contradizer o já feito.
9. **Handoff obrigatório ao fim da demanda**, para revisão do dono: o que foi adicionado, **como testar passo a passo**, o que ficou pendente, o que precisa de decisão. Vai para `_docs/Handoffs/` (template do cofre) e é linkado no `000 - MAPA DO PROJETO.md`. Sem handoff, a demanda não está entregue.
10. **Banco:** antes de qualquer SQL, ler `SUPA - Esquema do Banco.md` — nomes de tabela/coluna saem de lá, nunca de memória. Alterou o banco (com aprovação): SQL rodado → `supabase-fabrica-schema.sql` atualizado → nota atualizada. Tabelas da plataforma usam prefixo próprio e **não alteram** as tabelas existentes da integração. **Leitura de `plt_usuarios` é por coluna (E-50/D-68):** coluna nova só fica legível pelo navegador com `grant select (coluna)` explícito, e dado pessoal nasce fora da API (lido por porta própria). **Sessões em paralelo:** o aplicador reaplica tudo — se outra frente aplicou uma migration que a sua pasta não tem, aplique só a sua (`--so <arquivo>`).

## 🟢 Regras BÁSICAS (qualidade do dia a dia)

11. **Seguir o modelo de sistema** (`_docs/Plataforma/PLT - Modelo de Sistema.md` — desde a SESSAO-07/D-27, o antigo `docs/design-system.md` vive lá, fonte única) em toda tela nova; componente novo só se não existir equivalente. Tela com muitos dados → **paginação obrigatória** (RNF-02).
12. **Termos da equipe sem tradução:** SECC, FITAMENTO, FURAÇÃO, PCP, "rota" — a interface fala a língua do galpão. UI em português.
12b. **Códigos internos NUNCA em texto de interface** (D-27): "D-09", "RF-80", "Q-16" etc. não aparecem para o usuário — ele não entende. Na UI, escrever em língua de gente; o código vai para comentário no código-fonte, como entendimento do Claude.
12c. **Na conversa com o dono, NUNCA falar em código** (pedido do dono, 28/09/2026): *"não fique falando em códigos no estilo (D-63, E-55, 3503d77) — eu nem sei o que é isso; quem entende isso é a máquina, não eu nem ninguém — fale português"*. Nas mensagens para ele: **nada** de ID de decisão, erro, aprendizado, requisito ou pergunta (D-NN, E-NN, A-NN, M-NN, F-NN, RF-NN, Q-NN), hash de commit, nome de branch, número de migration, nome de função/tabela/coluna ou caminho de arquivo. Diga o que a coisa **é** e o que ela **faz**, em português do galpão ("a regra de que o frete não vira peça", "a atualização do banco de hoje", "a versão que subiu para o site"). Os códigos continuam valendo **dentro** do cofre e do código — são a memória da máquina; na conversa, só a tradução. Vale também para o texto das perguntas e opções que você mostra a ele.
13. **Commits pequenos e descritivos; uma branch por demanda.** Nada de entrega gigante misturando assuntos.
14. **Verificação conforme os critérios de aceite da demanda** — cada critério testado e reportado no handoff; UI nova acompanha screenshot.
15. **Mobile-first para o chão de fábrica** (D-06): tudo que o operador toca funciona em tablet com botão grande e em celular.
16. **Lei de layout e navegação (D-36):** layout nunca nasce fora do padrão **pai→filho** — um filho é sempre herdeiro de um pai. **Pai nunca é rota navegável**: só direciona aos filhos, no padrão `/pai/filho` (ex.: `/logistica/estoque`). **Nenhuma rota solta na raiz**: toda entrada redireciona para a rota herdeira — `/entrar` → `/inicio/meu-painel`, `/` → `/inicio/meu-painel`. Sidebar presente e recolhível em **toda** tela; **botão de voltar em toda tela**; sino de notificações no topo; e **toda atividade de usuário gera log no banco** (D-40).
17. **Lei de requisição (SESSAO-22, pedido do dono): cada tela requisita apenas o que ela mostra — se a tela não mostra, ela não requisita.** Lista/coluna pagina **no servidor** (`limite/deslocamento` ou `range`), o total vem de agregado barato (contagem na mesma consulta paginada), e "Ver mais" busca só a próxima página. Baixar o conjunto inteiro para filtrar/desenhar um pedaço no cliente é proibido — vale para toda tela nova e para toda tela que for tocada.
18. **Lei de desempenho e escala (pedido do dono, 07/10/2026) — vale como regra CRÍTICA:** sempre a solução mais otimizada do padrão de mercado, a das plataformas que atendem milhares de usuários — **"é mais difícil" nunca é motivo para escolher o caminho que não escala**; atalho só com o OK do dono, registrado como D-NN. Leia e cumpra `_docs/Plataforma/PLT - Lei de Desempenho e Escala.md`. O essencial: **(a)** primeira abertura do app = **1 requisição de dados** (uma porta de abertura) e cada tela = 1 requisição; nada em cascata; **(b)** dado escondido só chega **no clique** (aba, modal, detalhe, "Ver mais"); **(c)** tempo real **por websocket** (Broadcast em canal privado, tópico estreito); long polling/SSE só se websocket for impossível; **polling por intervalo e `postgres_changes` são PROIBIDOS**; no banco, trabalho nasce do fato (fila), nunca de relógio que acorda para ver se há trabalho; **(d)** sessão por token curto que se renova enquanto a pessoa usa, **verificado localmente** (chaves assimétricas, `getClaims`) e com as **permissões dentro do token** — nada de ir ao banco perguntar "quem sou eu" quando está tudo certo; **(e)** **paginação no servidor em toda lista que um dia possa crescer**, por **cursor** (deslocamento só em lista pequena e limitada), com teto no banco; **(f)** banco impecável: projeção pronta para leitura pesada, índice em toda chave estrangeira, filtro, ordenação e coluna de RLS, RLS com `(select …)`, `EXPLAIN ANALYZE` com volume ×100 de toda porta nova, migração sem travar, plano de crescimento das tabelas que só aumentam; **(g)** código dividido por tela, cache com invalidação por sinal, escrita idempotente, chamada externa com tempo limite, nova tentativa com espera crescente e disjuntor. **Orçamentos:** porta de tela ≤ 50 ms (p95), painel ≤ 150 ms; LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1; JS inicial ≤ 250 KB comprimido. **Toda tela tocada sai dentro da lei** — o que não sair vira dívida registrada na própria lei, com o porquê. O checklist de desempenho da lei entra no checklist final de toda sessão.
19. **ClickUp — quem cria, quem move, quem conclui (pedido do dono, 07/10/2026):** o que o dono mapeia com o Cowork vira **tarefa** na lista **PRODUÇÃO** do espaço DPTO TI — **tudo como tarefa, nada como subtarefa**, no padrão "Área - Item" (ex.: "Kanban - Cartões avulsos"), atribuída ao dono, em **A FAZER**; a demanda lista os links das suas tarefas na seção "Tarefas no ClickUp". **O Claude Code, ao começar a executar uma tarefa, move-a para FAZENDO — e NUNCA para CONCLUÍDO:** quem conclui é o dono. Ao terminar cada tarefa, o Claude Code **avisa o dono** na conversa (e deixa um comentário curto na tarefa: o que foi entregue e como conferir). Não cria tarefa nem subtarefa por conta própria; achou trabalho novo → avisa o dono, que decide. Sem acesso ao ClickUp na sessão → avisa o dono no início, para ele mover.

## O ciclo de toda sessão

```
ler SESSAO-NN (2x) → ler decisões + modelo de sistema + MEMÓRIA DE APRENDIZADO + LEI DE DESEMPENHO
→ listar dúvidas → task list → branch → tarefas do ClickUp da demanda em FAZENDO (regra 19)
→ codar computando tudo em _docs/Plataforma/Execucao/SESSAO-NN.md
   (errou/acertou/aprendeu → anotar em PLT - Memoria de Aprendizado NA HORA)
→ conferir task list contra a demanda + checklist de desempenho (regra 18) → revisão do dono → merge na main
→ avisar o dono de cada tarefa entregue (o dono conclui no ClickUp — regra 19)
→ handoff em _docs/Handoffs/ + memória de aprendizado atualizada
```

## Onde vive a verdade

- Demanda da sessão: `_docs/Plataforma/Demandas/SESSAO-NN - *.md`
- Decisões de produto: `_docs/Plataforma/PLT - Decisoes de Produto.md`
- **Memória de aprendizado (leitura E escrita obrigatórias em toda sessão): `_docs/Plataforma/PLT - Memoria de Aprendizado.md`**
- Requisitos: `_docs/Plataforma/PLT - Requisitos.md`
- Esquema do banco: `_docs/Supabase-fabrica/SUPA - Esquema do Banco.md`
- **Lei de desempenho e escala (leitura obrigatória em toda sessão): `_docs/Plataforma/PLT - Lei de Desempenho e Escala.md`**
- O que ainda não foi decidido: `_docs/Plataforma/PLT - Perguntas em Aberto.md` — se sua dúvida está lá, ela está SEM resposta: pergunte ao dono, não invente.
