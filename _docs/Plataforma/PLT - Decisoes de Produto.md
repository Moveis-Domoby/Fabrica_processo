---
titulo: Plataforma — Decisões de Produto
tipo: decisoes
data: 2026-08-19
atualizado: 2026-09-15
tags: [plataforma, decisoes, produto]
---

# ⚖️ PLT — Decisões de Produto

> [!abstract] Como usar
> Toda decisão estrutural da plataforma ganha um ID (`D-NN`), a data, o que foi decidido e as alternativas descartadas. **Decisão revisada nunca é apagada** — ganha `↩️ revisada em AAAA-MM-DD`. Antes de propor qualquer arquitetura ou tela, ler este arquivo.

## D-01 · Unidade do card: híbrido (19/08/2026)

**Decidido:** o PCP enxerga o **pedido inteiro** para tomar a decisão; ao liberar, cada móvel vira **um card por unidade** (equivalente ao (k/n) atual) que percorre os setores individualmente; as unidades se "juntam" de novo na expedição — pedido completo = todas as unidades prontas.

**Descartadas:** card = pedido inteiro (tempo impreciso quando móveis do mesmo pedido seguem caminhos diferentes); card = unidade desde o início (PCP afogado em cards).

## D-02 · Timer: dois contadores por etapa, dash compara e soma (19/08/2026)

**Decidido (palavras do dono):** "tempo total por etapa, independente se está na fila ou não; conta o tempo parado **na fila entre cada etapa** e **outro tempo na etapa em si**; na dash mostra um comparativo somando esses dois tempos."

Modelo: cada passagem por etapa registra **tempo de fila** (da chegada até o início) e **tempo de execução** (do início ao fim). Dashboards mostram os dois lado a lado e o total somado. Gargalo = fila; produtividade = execução.

**↪️ Detalhamento (24/08/2026):** TODAS as etapas contam o tempo que cada card fica parado nelas, inclusive na fila. **O tempo de fila pertence ao SETOR/etapa, nunca a uma pessoa** — na fila o card ainda não está direcionado a ninguém. O tempo de execução pertence a quem iniciou/finalizou. Propósito declarado: fila longa num setor = **gargalo identificado** = possivelmente contratar mais alguém para o setor. O fluxo, por enquanto, serve para identificar o **tempo de produção por item, por setor e por pessoa**.

## D-03 · Destino do card: manual hoje, automação via API amanhã (19/08/2026)

**Decidido:** movimentação **manual** (PCP e setores decidem), até encontrarmos padrões bem definidos que justifiquem automatizar. Desde o dia 1, porém, a **API aberta permite movimentação, criação, edição e exclusão em cada etapa via automação** — ou seja, a automação de destino poderá nascer no n8n sem mudar o núcleo da plataforma.

**Descartadas (por ora):** sugestão automática com confirmação; roteiro automático por produto. Nota: isso **revisa** parcialmente [[FAB - Processo Alvo - Um Clique Um Evento]] — ver [[PLT - Visao Geral]].

## D-04 · Produtividade e bonificação ↩️ revisada em 19/08/2026

**Decisão original (manhã de 19/08):** medição alimentaria bonificação/meritocracia.

**↩️ Revisão (mesmo dia, palavras do dono):** *"não se preocupe com isso, nem com a bonificação — isso ainda será debatido e decidido; por enquanto veremos apenas como uma **alavancagem operacional**, melhorando cada setor por si só, com a contribuição dos colaboradores."*

**O que fica:** eventos **append-only** e trilha de auditoria completa (RNF-05) — barato de fazer agora, impossível de recuperar depois; se a bonificação voltar, o histórico já existe.
**O que sai do escopo por ora:** pesos/pontos por produto, regras anti-manipulação formais, fluxo de contestação, ranking. As perguntas Q-10–Q-14 ficam **⏸️ adiadas** em [[PLT - Perguntas em Aberto]].

## D-05 · Escopo: produção primeiro, logística depois (19/08/2026)

**Decidido:** a plataforma nasce cobrindo PCP → setores → estoque/expedição. ROTAS continua no ClickUp; o **n8n faz a ponte** durante a transição (a automação ROTAS "entregue" → Tiny, em produção desde 17/08, não pode quebrar).

## D-06 · Dispositivos: tablet/PC fixo por setor E celular pessoal (19/08/2026)

**Decidido:** os dois modos convivem. Tela compartilhada por setor mostrando a fila do setor, com identificação rápida do operador ao agir (PIN/seleção); e login individual no celular pessoal para quem tiver. **Implicação de UX:** tudo que o operador toca precisa funcionar em tela de tablet com botão grande E em celular — o design system nasce mobile-first para o chão de fábrica.

## D-07 · Estoque: módulo da mesma plataforma, fase 2 (19/08/2026)

**Decidido:** primeiro o kanban + tempo (a dor crítica); o estoque entra como **módulo nativo** em seguida, no mesmo banco — card que chega em ESTOQUE vira saldo automaticamente. Não será sistema separado.

## D-08 · Banco: o mesmo Supabase da fábrica (19/08/2026)

**Decidido:** a plataforma nasce sobre o Supabase que já recebe os pedidos do Tiny (P15 — dupla escrita ativa). Card criado automaticamente quando o pedido entra; zero sincronização entre bancos. O schema cresce com as tabelas novas (etapas, eventos de movimentação, usuários, perfis, visualizações salvas). **Regra do cofre continua valendo:** antes de qualquer SQL, ler [[SUPA - Esquema do Banco]].

## D-09 · Qualidade em 3 estados em TODA transição, com dupla atestação (19/08/2026)

**Decidido (pedido da equipe, trazido pelo dono):** o estado físico da peça impacta completamente o andamento entre setores — e **um setor pode dizer que algo está bom apenas para prejudicar o próximo**. Por isso a atestação é **dupla**: quem entrega marca, quem recebe confirma.

**O fluxo:**

1. **Ao mover** o card para outro setor, é **obrigatório** marcar um de 3 estados: 🟢 **perfeito estado** · 🟡 **estado de atenção** · 🔴 **danificado**.
2. **Ao receber**, antes de iniciar qualquer etapa da produção, o setor recebedor vê: *"O setor X marcou como Y — você concorda?"* e registra o próprio parecer.
3. **Se NÃO concorda:** define o novo estado → **notifica um líder** → a peça entra em **pausa momentânea** até o líder resolver.
4. **Se concorda:** 🟢 segue o fluxo padrão · 🔴 vai para DANIFICADO e **notifica líder/admin** · 🟡 pergunta se deseja **seguir o fluxo normal ou notificar o admin**.
5. **Toda decisão entre etapas reflete na dashboard** — qualidade por setor, divergências, quem entrega dano.

**↩️ Revisão (24/08/2026):**

- **Sem foto obrigatória** na saída nem na entrada (Q-15 ✅).
- **Sem fluxo de disputa/pausa por enquanto** (Q-17 ✅): a dupla marcação continua (quem entrega marca, quem recebe registra o próprio parecer), mas divergência **não pausa a peça nem abre resolução formal** — vira registro que alimenta a dashboard. O card segue o fluxo normal de recebimento.
**↪️ Complementos (24/08/2026, segunda rodada):**

- **Notificação (Q-18 ✅):** divergência entre setores, OU marcação 🟡, OU marcação 🔴 → **líder/admin é notificado automaticamente, com exatamente o que aconteceu** (quem marcou o quê, setores envolvidos, os dois pareceres). Isso substitui a escolha manual de 19/08 ("seguir ou notificar") — no 🟡 o card segue o fluxo E a notificação sai sozinha.
- **Critério do 🟡 (Q-16 ✅), nas palavras do dono:** *"levemente danificado, porém ainda dá pra seguir e tentar consertar"* — este texto vai escrito na interface de marcação.
- **API sem estado (Q-19 ✅):** movimentação por API externa **NÃO exige estado de qualidade** — a atestação é um gesto exclusivamente humano. (Proposta do Cowork de estado obrigatório no payload foi descartada pelo dono.)

## D-11 · API antecipada: entrada de pedidos via n8n logo após o kanban (24/08/2026)

**Decidido:** o dono quer a API **já no início** — mas no formato mais simples: **a plataforma recebendo dados do n8n** (n8n chama a API; a plataforma não busca nada no Tiny). Para isso a antiga SESSAO-11 foi dividida: a **[[SESSAO-09 - Entrada de Pedidos via n8n]]** (só o caminho de entrada Tiny → n8n → card no PCP) é executada logo após o kanban, e a SESSAO-11 (API completa: CRUD, webhooks de saída, ponte ROTAS) fica mais tarde. A partir daí, todos os testes das sessões seguintes rodam com **pedido real fluindo sozinho**. Ordem oficial em [[000 - ORDEM DAS SESSOES]] — **o número da sessão é ID, não ordem**.

## D-18 · Fins de linha: ESTOQUE e ROTAS nascem juntos (26/08/2026)

**Contexto — contradição encontrada ao codar a SESSAO-02:** a D-13 diz que o card termina em ESTOQUE ou ROTAS, mas a lista de setores do dia 1 da D-12 (copiada do ClickUp) não tem nenhum dos dois, e a D-05 mantém a ROTAS no ClickUp na fase 1. O Claude Code parou e perguntou em vez de escolher.

**Decidido (palavras do dono):** *"coloque o setor de rotas nos primórdios de criação então"*.

- O seed nasce com **9 setores**: PCP (entrada) · SECC · CNC · FITAMENTO · FURAÇÃO · MONTAGEM · LIMPEZA E EMBALAGEM (produção) · **ESTOQUE** e **ROTAS** (terminais).
- A ROTAS existe na plataforma como **setor terminal de handoff**: o card chega nela e a ponte do n8n cria o card na ROTAS do ClickUp enquanto a logística viver lá (D-05). Quando a logística migrar, **nada na estrutura muda**.
- Isso **responde a Q-28** e desbloqueia a SESSAO-04.

**Descartada:** deixar só ESTOQUE como terminal na plataforma, com a ROTAS inteiramente fora — o dono preferiu já ter o fim de linha completo desenhado desde o começo.

## D-19 · Banco: o projeto da org Tech é o de produção, e por ora é onde se trabalha (26/08/2026)

**Decidido:** o Supabase da organization **Tech** (ref `axnzldwgwsmepukdiljx`) — **o mesmo que já recebe os pedidos do Tiny** — é o banco da plataforma, confirmando a D-08. Nas palavras do dono: *"esse será o banco de produção, mas por enquanto podemos mexer nele à vontade"*.

**↩️ Isto revisa a parte de "banco de desenvolvimento" da D-15**, que previa um projeto Supabase novo e exclusivo de dev: por ora **não existe** projeto de dev, e as migrations da plataforma são aplicadas direto nesse banco, com autorização explícita do dono.

**O que continua valendo, sem exceção:**

- Nenhuma migration toca as tabelas da integração (`clientes`, `pedidos`, `pedido_itens`, `eventos`, `gp_pcp_processados`). Toda aplicação confere a estrutura e as contagens **antes e depois**.
- Migrations são testadas fora antes de entrar (`npm run test:banco`, contra o esquema real da integração).
- **Quando a plataforma tiver gente usando de verdade, esta permissão acaba** e volta a regra crítica 2 na íntegra: aplicar em produção só com aprovação explícita naquela conversa.

## D-20 · Sem PR e sem proteção de branch enquanto o dono for o único (26/08/2026)

**Decidido (palavras do dono):** *"o github apenas eu estou subindo coisa no projeto, só eu trabalho nele, então tudo bem"*.

- A sessão **continua trabalhando em branch própria** (`sessao-NN-descricao`) — isso não muda, é o que permite conferir o conjunto antes de entrar.
- **A revisão acontece na conversa**, no checkpoint de fim de sessão. Aprovou, o merge na `main` é direto.
- **Proteção de branch no GitHub fica dispensada.**
- **↩️ Isto ajusta a regra crítica 1** do [[CLAUDE - Regras do Claude Code (repo)]] e do `CLAUDE.md` da raiz do repo, que exigiam PR. Os dois arquivos foram atualizados na mesma data.

**Gatilho para voltar atrás:** entrar mais alguém trabalhando no repositório. Aí PR e proteção de `main` voltam, porque o motivo original delas (duas pessoas escrevendo no mesmo lugar) passa a existir.

## D-21 · Identidade e acesso: uma tabela, matrícula, senha padrão com troca obrigatória (26/08/2026)

**Decidido (respostas do dono no início da SESSAO-03):**

- **Login:** todo usuário informa **e-mail** no cadastro, mas entra com **nome de usuário OU e-mail** + senha.
- **Sem autocadastro:** usuário só nasce pela mão de admin/líder. A tela pública é só o login.
- **Senha padrão de criação** para todos, definida pelo dono (o valor vive como **segredo de ambiente**, nunca em nota ou código — regra crítica 4), com **troca obrigatória no primeiro login** — sem a troca, nenhuma tela é liberada.
- **Convite por link** enviado por **WhatsApp** — sem e-mail automático por ora.
- **Admin principal:** `wallacecauan03@gmail.com` (Wallace; grafia corrigida pelo dono em 27/08). O `contatodomoby@gmail.com` foi descartado de propósito: muita gente tem acesso a ele.
- **Uma tabela só de usuário** (palavras do dono: *"não crie tables para separar dados de usuários internos"*): os campos novos entram na própria `plt_usuarios`, que futuramente guardará também os dados principais de gestão.
- **Matrícula automática** como identificador interno, no padrão **`MDM-XXX-NNN`** — XXX = 3 primeiros dígitos do CPF, NNN = ordem de cadastro (001, 002…). Por consequência, **CPF é obrigatório** em todo usuário interno.
- **Escala:** ~30 usuários na largada (responde Q-61).

**Descartadas:** autocadastro com aprovação (porta a mais para vigiar, sem função com senha padrão + convite); tabela separada de "dados internos" (dificultaria a gestão futura, viola a intenção do dono); e-mail automático de convite (exigiria SMTP configurado; o link por WhatsApp resolve).

## D-22 · Kanban: liberação parcial, destino livre, PCP com visão completa (27/08/2026)

**Decidido (respostas do dono no início da SESSAO-04):**

- **Liberação parcial OU completa:** o PCP pode liberar todas as unidades do pedido de uma vez ou só parte agora e o resto depois. Cada unidade liberada vai para o setor que o PCP escolher (unidades do mesmo pedido podem seguir caminhos diferentes — D-01).
- **Card de pedido some do quadro PCP quando todas as unidades foram liberadas**; o pedido passa a ser acompanhado na visão de expedição/reagrupamento.
- **Destino livre:** qualquer pessoa pode mover o card que está no setor dela para **qualquer** setor — a confirmação de entrada com o índice de qualidade (D-09) é gesto do setor recebedor e entra na SESSAO-06, não agora.
- **Perfil do PCP:** trabalham no computador na maior parte do tempo, são também a logística e possivelmente serão admins no futuro (talvez sem todas as permissões — decisão para depois). A tela deles pode ser **mais completa**, inclusive no tablet.
- **Origem do card:** todo card de pedido nasce de um **pedido real da integração** (Tiny → n8n → banco). Não existe pedido avulso digitado à mão (produção para estoque continua sendo a Q-23, em aberto).
- **Cadastro de etapas:** admin em qualquer setor E **líder no próprio setor** — como o RLS da SESSAO-02 já previa.
- **Q-21 (sub-cards de trabalho paralelo): fica para depois**, fora do escopo do kanban núcleo.

## D-23 · Replanejamento da jornada a partir da 5ª posição (27/08/2026) — ↩️ revisa a D-11

**Contexto:** na entrega da SESSAO-04 o dono pediu o replanejamento (palavras dele): *"não faz sentido a 13 ter que vir antes das outras, ajuste isso... refaça o planejamento ordenado das sessões para o plano mais lógico possível a partir da 5, concatene ou crie mais se necessário"*.

**Decidido:**

- **↩️ A antecipação da SESSAO-09 (D-11) cai.** A entrada automática de pedidos deixa de vir logo após o kanban: enquanto a plataforma não está no ar, a criação manual de card no PCP atende. A SESSAO-09 continua existindo como está escrita — muda só a posição.
- **Nasce a SESSAO-08 — Publicação no Ar**, a lacuna real do plano: nenhuma sessão cobria hospedar a plataforma, e sem isso nada chega ao tablet do galpão. Entra logo depois da tela do setor (07), respondendo Q-62 (hospedagem) e enfrentando Q-60 (internet do galpão) na prática.
- **Nova ordem oficial a partir da 5ª posição** (a lógica: primeiro o núcleo de medição completo, depois ir ao ar, depois os pedidos fluírem sozinhos, depois medir sobre dados reais, depois integrar/automatizar/consolidar):

1. **SESSAO-05** (timers — a razão de existir; destrava 06, 07, 10 e 11)
2. **SESSAO-06** (qualidade nas transições — pluga na movimentação já entregue; assim a tela do tablet já nasce com a qualidade embutida)
3. **SESSAO-07** (tela do setor tablet — o gesto do chão de fábrica)
4. **SESSAO-08** (publicação no ar — a partir daqui a plataforma tem gente usando: **encerra a permissão da D-19** e a regra crítica 2 volta na íntegra)
5. **SESSAO-09** (entrada via n8n — no ar, criar card na mão para ~10 pedidos/dia vira fardo; pedido passa a fluir sozinho)
6. **SESSAO-10** (dashboards — sobre dados REAIS acumulados pelo uso)
7. **SESSAO-11** (API completa + ponte ROTAS)
8. **SESSAO-12** (tarefas e delegação)
9. **SESSAO-13** (automações internas)
10. **SESSAO-14** (painel admin completo)

- **Blocos:** Bloco 2 = 05 → 06 → 07 → 08 → 09 (termina com a plataforma no ar e pedido fluindo sozinho). Bloco 3 = 10 → 11 → 12 → 13 → 14.
- **Nada foi concatenado:** a divisão entrada × API completa da D-11 (hoje sessões 09 e 11) continua valendo (evita sessão gigante — regra 13); o que mudou é que as duas agora vivem cada uma no seu bloco.

**Descartadas:** pular direto para as sessões finais ignorando timers e entrada (quebraria as dependências — quase tudo precisa dos timers); concatenar a entrada dentro da API completa (sessão grande demais).

**↪️ Complemento (mesma data) — renumeração: número passa a ser ordem.** Nas palavras do dono: *"não existe 05→06→07→14→13... pelo menos muda o nome pra deixar na ordem numérica certa"*. As demandas a partir da 5ª posição foram **renumeradas para os números espelharem a ordem de execução** (isto revisa o modelo mental M-09). De-para, para ler notas antigas: Dashboards 08→**10** · Tarefas 09→**12** · API completa 10→**11** · Automações 11→**13** · Admin 12→**14** · Entrada n8n 13→**09** · Publicação 14→**08**. Arquivos renomeados e todas as referências do cofre e do repositório atualizadas na mesma data; a lista numerada acima já usa os números novos.

## D-24 · Execução: vários cards por pessoa com limite configurável, iniciar obrigatório, transferência conta para os dois (27/08/2026)

**Decidido (respostas do dono no início da SESSAO-05):**

- **Vários cards em execução pela mesma pessoa: pode** — o que importa é o tempo estar contando. Mas nasce uma **configuração por setor no painel de admin: limite de cards em execução por pessoa, por vez** — padrão **sem limite**; o admin ajusta quando quiser.
- **"Iniciar" é obrigatório** quando o card de fato chega no setor — mesmo que a pessoa finalize um instante depois de iniciar. Finalizar sem ter iniciado não existe.
- **Mover card com execução aberta encerra a execução automaticamente** naquele instante: o tempo conta até o mover, atribuído a quem estava executando. Mover nunca fica bloqueado.
- **Admin pode tudo, independentemente** — inclusive estornar em qualquer setor. (Líder estorna no próprio setor, como a demanda já dizia.)
- **Transferência entre pessoas:** o tempo **finaliza para um e inicia para o outro**, e continua contando para o produto — o gesto "assumir" fecha a execução de quem estava e abre a de quem assumiu, no mesmo instante.

**Descartadas:** bloquear o mover até finalizar (travaria o fluxo do galpão); limite fixo de um card por pessoa (o dono quer liberdade com teto configurável).

## D-25 · Qualidade nas transições: detalhes de execução (27/08/2026)

**Decidido (respostas do dono no início da SESSAO-06):**

- **Notificação de 🟡/🔴/divergência:** vai para os **líderes dos DOIS setores** (o que entregou e o que recebeu) **+ todos os admins**.
- **Etapa DANIFICADO:** o sistema **garante uma etapa especial "DANIFICADO" em cada setor**, criada automaticamente (exceção de sistema à D-14 — não é chute de etapa operacional, é infraestrutura do fluxo de qualidade).
- **Saída do PCP não é transição de qualidade:** liberar unidade do PCP não exige marcação (a peça ainda nem foi produzida) e a primeira chegada não pede parecer.
- **Chegada em terminal:** ROTAS aceita o registro unilateral de quem entrega. **ESTOQUE notifica os admins e a logística** — como a logística ainda não existe como entidade na plataforma (o PCP é a logística — D-22), notifica os admins e a parte da logística **fica no planejamento** para quando existir.
- **API não participa do fluxo de qualidade:** a única chegada de card por API é em **PCP ou ROTAS** — então chegada via API não exige marcação nem parecer (reafirma RF-86/Q-19).
- **Movimentação de etapa dentro do MESMO setor não exige qualidade** — a D-09 vale só para transição entre setores.

**Descartadas:** etapa DANIFICADO cadastrada manualmente pelo dono (letra c); card danificado ficar parado onde está sem etapa própria (letra b).

## D-26 · Bloco noturno autônomo: sessões 07→12 sem perguntas durante a execução (28/08/2026)

**Decidido (pedido do dono):** as sessões **07, 08, 09, 10, 11 e 12** (ordem da D-23) rodam **em sequência, de madrugada, sem o dono acompanhar**. O protocolo:

- **Todas as dúvidas de negócio das 6 demandas são levantadas UMA vez, no início do bloco** — o dono responde antes de dormir. Depois do OK, **nenhuma pergunta até o fim**.
- **Lacuna não coberta pelas respostas/decisões:** escolher a opção mais conservadora coerente com as decisões registradas e **logar como "decisão provisória"** no handoff da sessão, para revisão do dono de manhã. Contradição insolúvel com decisão registrada → pular o item, documentar, seguir.
- **Bloqueio externo** (criação de conta, credencial, pagamento — ex.: hospedagem na SESSAO-08): preparar tudo que dá (código, config, doc do passo manual), **documentar o bloqueio e seguir** para a próxima sessão cujas dependências permitam.
- **Banco e GitHub autorizados para o bloco inteiro** (palavras do dono em 27/08: acesso liberado para aplicar e subir sem perguntar): migrations testadas → aplicadas; cada sessão termina com merge na `main`. **↪️ Nuance da D-19/D-23:** a publicação (08) normalmente encerraria a permissão de mexer direto no banco; como a equipe ainda não estará usando de madrugada, a permissão vale **até a revisão do dono na manhã seguinte** — aí a regra crítica 2 volta na íntegra.
- **Encadeamento automático (pedido do dono):** uma demanda por conversa continua (D-10). Ao **fim de cada sessão** — ou com o **contexto perto do limite** no meio de uma — o Claude Code grava um **handoff de continuidade** e **abre sozinho a próxima conversa** do Claude Code via CLI, com o prompt curto padrão. O bloco termina na 12 ou num bloqueio irrecuperável.
- Handoffs individuais por sessão continuam obrigatórios (regra 9) — são o material de revisão da manhã.

**Descartadas:** rodar tudo numa conversa só (estoura contexto e viola D-10); parar e esperar resposta a cada dúvida (o dono estará dormindo).

**↪️ Complementos (28/08, aval do dono ao iniciar o bloco):** (1) **verificação de tela (F-07/navegador) apenas a cada 2–3 sessões** para economizar tokens — nas demais, conferência por `tsc`/`lint`/testes/`test:banco` direto nos arquivos; (2) as dúvidas do bloco foram respondidas e viraram **D-28 a D-34**; (3) a SESSAO-08 saiu do bloco (D-30).

## D-27 · Padrões de interface: menu lateral, modelo de sistema no cofre, microinterações, sem códigos internos (28/08/2026)

**Decidido (pedidos do dono em 28/08; entram no escopo da SESSAO-07):**

- **Navegação vira MENU LATERAL** (sidebar) — a barra superior de rotas sai. No celular, a sidebar recolhe (padrão hambúrguer/gaveta); no tablet de setor, o operador continua sem navegar (D-06).
- **A aba "Design system" sai do aplicativo.** O design system vira **[[PLT - Modelo de Sistema]]** no cofre (`_docs/Plataforma/`), fonte única — o `docs/design-system.md` do repo migra para lá e os dois `CLAUDE.md` passam a apontar o caminho novo. **Nada se constrói fora do modelo de sistema.**
- **Microinteração dos botões interativos:** além do estado atual (fosco), botão ganha **elevação leve ao interagir** — sobe sutilmente (1–2px) com **sombra suave no fundo**. "Coisa leve", nas palavras do dono; vale para o padrão inteiro via componente `Botao`.
- **Códigos internos (D-NN, RF-NN, Q-NN, M-NN) NUNCA em texto visível da interface** — usuário não entende "D-09". Os códigos viram comentário de código (entendimento do Claude); o texto da UI fala a língua do usuário. Inclui **varredura do que já existe**. → promovida a regra no [[CLAUDE - Regras do Claude Code (repo)]].
- **Textos explicativos longos na UI: temporários.** Ficam por ora (o dono quer entender as telas ao revisar), mas **não devem ser mantidos** — enxugar em sessão futura, quando o dono mandar.

**Descartadas:** criar sessão nova só para UI (os ajustes cabem como prelúdio da 07, que já é a sessão de interface); remover os textos explicativos já (o dono pediu para manter por enquanto).

## D-28 · Card do operador: dados do produto, espaço de imagens, som discreto (28/08/2026)

**Decidido (respostas do dono no início do bloco noturno — SESSAO-07):**

- O card da fila do setor mostra **todos os dados do produto** e **nenhum dado do cliente** (Q-31 ✅).
- O card ganha um **espaço funcional de imagens** (upload por admin/líder, operador vê) — preparado para a futura **biblioteca de peças** que o dono vai importar.
- **Som mínimo e discreto** ("um pouco opaco, para não irritar") na chegada de card novo na fila (Q-32 ✅).
- **Modo setor:** conta de dispositivo por tablet abre a fila do setor em tela cheia; toda ação pede o PIN do operador; celular pessoal logado cai no setor do próprio usuário.

## D-29 · Controle de tempo pelo admin: horário de funcionamento, pausas manuais e correção retroativa (28/08/2026)

**Decidido (pedido novo do dono no início do bloco — "4 extra"):**

- Admin configura **horário de funcionamento por setor E por usuário** nas configurações de admin → fora do horário, os timers não contam.
- **Botões de controle direto:** desligar o tempo de um setor ou de uma pessoa AGORA, até religar manualmente.
- **Botão de correção retroativa** ("esqueci de desligar, mas ontem tal setor não funcionou"): admin marca um período passado de setor/pessoa como não contado.
- **Nada disso altera o dado registrado** — o tempo executado até então é fixo; eventos continuam append-only e o desconto acontece só no cálculo derivado (M-13).

## D-30 · Publicação adiada: nenhum deploy no bloco noturno (28/08/2026) — ↩️ revisa a posição da SESSAO-08 na D-23

**Decidido (palavras do dono):** *"tudo que envolver deploy, hospedagem ou coisa do tipo pode jogar para sessões futuras, não iremos lançar ela agora e quando eu for fazer o deploy eu falo"*.

- A **SESSAO-08 sai do bloco noturno** e fica ⏸️ até o dono pedir o lançamento. O bloco vira **07 → 09 → 10 → 11 → 12**.
- Q-60 (wi-fi) e Q-62 (hospedagem) ficam ⏸️ junto com ela.
- Consequência: a permissão da D-19 (banco direto) segue valendo durante o bloco e até a revisão do dono (D-26).

## D-31 · Entrada de pedidos: a plataforma lê o próprio banco, sem tocar o n8n (28/08/2026)

**Decidido (palavras do dono):** *"não precisa conectar no n8n, ele já lança no banco, então leia o banco e crie o card quando chegar lá, instantaneamente"*.

- Card do PCP nasce/atualiza por **trigger no banco** a partir de `pedidos` (que o n8n já alimenta via P15). Nenhum workflow novo no n8n; endpoint HTTP fica apenas documentado como alternativa futura.
- **Cancelamento (Q-24 ✅):** card marcado "cancelado", visível, não some; com unidades já liberadas, notifica admins.
- **Modelo do card do PCP** = o modelo real do PCP atual (ClickUp), documentado no cofre — seguir esse modelo.

## D-32 · Dashboards: foco pesado em tempo; só líder e admin (28/08/2026)

**Decidido:** o foco principal é **tempo de produção bem detalhado** — "tempo entre cada execução, tempo para cada funcionário e tudo mais que envolver tempo; queremos uma lista muito bem detalhada" — além das métricas propostas (finalizados por setor, fila vs execução, tempo por item, qualidade, tempo em estoque). **Operador não vê dashboard nenhum** — apenas líder (próprio setor) e admin (tudo).

## D-33 · ROTAS dentro da plataforma; ClickUp não recebe mais nada (28/08/2026) — ↩️ revisa a D-05

**Decidido (palavras do dono):** *"rotas será criado aqui dentro também, então nada deve ser pensado mais em criar coisa no ClickUp; n8n também não vai jogar nada aqui por enquanto, já temos todos os dados que precisamos para as rotas da forma que o n8n joga pra gente"*.

- A **ponte ROTAS → ClickUp morre antes de nascer**: nenhuma integração nova cria nada no ClickUp.
- **Módulo básico de rotas nasce na SESSAO-11** (opção B confirmada pelo dono), seguindo a documentação de rotas existente nos `_docs`; onde não houver documentação, seguir o padrão do sistema.
- **Agrupamento por pedido completo:** a entrega sai por pedido inteiro ("mesmo que tenha 30 unidades, não vamos entregar 10 móveis se ele pediu 30").
- A plataforma **nunca lê do Tiny** (Q-52 ✅); a automação ROTAS "entregue" → Tiny **em produção não se toca**.

## D-34 · Delegação: 3 modos por setor, sorteio entre logados, tarefa avulsa sem timer obrigatório (28/08/2026)

**Decidido (respostas do dono — SESSAO-12):**

- **Modos por setor, configuráveis no admin:** delegação **desativada** (card fica sem dono na fila) · **direta** (líder/admin atribui) · **aleatória**.
- **Sorteio aleatório só entre quem está logado na plataforma no momento**, balanceado por carga aberta.
- **Só cards de produção contam tempo.** Tarefa avulsa não conta tempo por padrão — só se o próprio atarefado quiser acionar.
- **Delegação organiza, não trava:** card delegado aparece em "meus afazeres", mas qualquer pessoa do setor pode agir (coerente com D-22/D-24).

## D-35 · Plataforma funcional primeiro: externo em standby; Bloco 3 = Sessões 13→16 com checkpoint (28/08/2026)

**Decidido (pedido do dono, na revisão do bloco noturno):** entregar uma **plataforma funcional** vem antes de qualquer integração externa nova. Ficam em **standby**: publicação (D-30 segue — o dono avisa), usos novos de API/webhooks/n8n (o que já está no ar continua), automações internas (antiga SESSAO-13 → **17**) e a consolidação do admin (antiga 14 → **18**).

- **Bloco 3 = a reforma: Sessões 13→16**, uma conversa por sessão, **checkpoint do dono ao fim de cada** — a regra crítica 2 vale na íntegra (banco/deploy só com aprovação naquela conversa).
- Renumeração (número = ordem, complemento da D-23): **Automações 13→17 · Painel Admin 14→18**; as novas 13–16 são a reforma (D-36…D-42).

## D-36 · Lei de navegação: hierarquia pai→filho, pai nunca navega, rota sempre /pai/filho (28/08/2026)

**Decidido (palavras do dono):** *"layout nunca é colocado e pensado fora do padrão, um filho sempre será herdeiro do pai; o pai nunca é uma rota navegável, ela apenas direciona para os filhos no padrão /pai/filho; nenhuma rota acessa direto a raiz — /entrar → /inicio/meu-painel."*

- Sidebar em **dois níveis**: o grupo pai expande os filhos em cascata; clicar no pai NUNCA abre página própria.
- Estrutura: **Início** (Meu painel · Afazeres) · **Controle de Produção** (um filho por setor cadastrado, dinâmico — substitui a aba "PCP") · **Logística** (Expedição · Estoque · Pedidos em aguardo · Danificados) · **ROTAS** · **Dashboards** · **Administração** (dropdown: Gestão da equipe · Setores e etapas · Controle de tempo · API e integrações · Caminhões). **Equipe e Estrutura deixam de ser abas de 1º nível** — viram filhos de Administração.
- A sidebar **persiste em todas as telas** (inclusive quadros de setor), com botão de **recolher/expandir**; estado lembrado.
- **Toda tela tem botão de voltar** (à aba anterior).
- **"Modo tablet"** (a antiga aba "Tela do setor") vira botão fixo na sidebar, logo acima do bloco do usuário.
- **Sino de notificações no topo** (junto à logo); no rodapé, **Configurações** no lugar do sino; o popover de notificações **nunca é cortado pela tela**.
- Login desemboca sempre em `/inicio/meu-painel`.
- Lei promovida aos dois `CLAUDE.md` (regra 16).

## D-37 · Tela inicial = Meu Painel, com cockpit de metas configuráveis (28/08/2026)

- `Início → Meu painel` mostra: **pendências** do usuário (qualidade a atestar, delegações, tarefas), **notificações** e o **cockpit de metas** com índice de conclusão **em tempo real**.
- Meta tem **indicador configurável** — quem cria escolhe: unidades concluídas, tarefas concluídas ou tempo útil — alvo por período **diário/semanal/mensal**, e dona (pessoa ou setor).
- Criam metas: **admin** (todas), **líder** (do próprio setor) e **a própria pessoa** (metas pessoais).
- `Início → Afazeres` = a tela da SESSAO-12: o que eu cadastrei para mim + o que líderes/admins me delegaram.

## D-38 · Logística: Estoque com ID digitável, sala de Pedidos em aguardo, Danificados com destino (28/08/2026)

- **Estoque:** produtos parados, cada um com **ID de produção digitável de formato livre** (o formato definitivo é decisão futura — Q-63).
- **Pedidos em aguardo:** onde unidades prontas esperam o pedido ficar **completo**; completo → **lançar para ROTAS**. Absorve como tela o reagrupamento da expedição.
- **Danificados:** tela própria com tudo que está em DANIFICADO; ações **arquivar** ou **resolvido → escolher destino** (Estoque, ROTAS ou qualquer setor). Tudo evento append-only.

## D-39 · ROTAS: programação de caminhão com mapa e sugestão; caminhões cadastráveis (28/08/2026)

- ROTAS lista **apenas pedidos prontos** lançados pelos Pedidos em aguardo.
- **Programar caminhão:** escolhe o dia → pedidos sem programação → a seleção abre **mapa lateral** (Leaflet + OpenStreetMap, grátis e sem chave; geocodificação aberta com cache no banco) mostrando a rota selecionada e **sugerindo** pedidos que fazem sentido nela (proximidade). **É só sugestão — a decisão é humana** (princípio de sempre). Confirma com **data + caminhão**.
- **Caminhões:** cadastro em Administração — visualizar, editar, excluir, com foto.

## D-40 · Auditoria total: toda atividade de usuário gera log persistido (28/08/2026)

Toda ação de usuário registra **log no banco** (quem, quando, o quê, onde), **append-only**, sem exceção. O registro nasce na SESSAO-13; a consulta admin completa pode vir depois.

## D-41 · Identidade: Meu Perfil com 8 temas Domoby; login com logo metálica (28/08/2026)

- Clicar no bloco do usuário (rodapé da sidebar) abre **Meu Perfil**: alterar nome de usuário, senha, **foto**, dados cadastrais e **tema da plataforma**.
- **8 esquemas de cor, do claro ao escuro, todos no DNA Domoby** (amarelo × grafite) — ativa a infraestrutura `data-tema` preparada desde a SESSAO-01 (**responde o modo escuro da Q-30**). Escolha persiste por usuário.
- **Login novo:** logo Domoby **grande, em tom metálico, à esquerda**; formulário à direita.

## D-42 · Dashboards guiados por imagem: docs/inspiracao/dashboards/ é a régua (28/08/2026)

O dono rejeitou a página da SESSAO-10 (*"isso não é uma dashboard"*). O Cowork gerou **4 mockups-alvo no design system Domoby + regras de construção** em `docs/inspiracao/dashboards/` (no repo). A SESSAO-16 reconstrói os dashboards **nesses moldes** — o Claude Code **abre as imagens antes de codar**. Os dados e gates da S10 (migration 18, D-32) seguem sendo a fonte.

## D-43 · Meu Perfil: nome de login editável pelo próprio, e-mail também, foto própria, log de tudo (28/08/2026)

**Decidido (respostas do dono no início da SESSAO-13):**

- **"Nome de usuário" no Meu Perfil é o nome de LOGIN mesmo** — o próprio usuário pode trocá-lo (mantendo unicidade), e esse nome é também o exibido para todos os outros.
- **Dados cadastrais editáveis pelo próprio usuário:** nome, telefone e **e-mail** (que também serve de login). CPF e matrícula ficam travados — só admin.
- **Foto de perfil:** o operador comum pode subir a **própria** foto (pasta própria no bucket; admin pode trocar a de qualquer um).
- **Log de atividade (D-40): registrar tudo** — nenhum tipo de atividade excluído do registro.

## D-45 · Logística e ROTAS: unidade pronta, lançamento, ID de produção, danificados, programação e metas completas (01/09/2026, registrada em 08/09)

**Decidido (respostas do dono no início da SESSAO-15, em 01/09; a D-44 pertence à frente do backfill — cofre de Pedidos entregues):**

- **"Unidade pronta" = chegou em setor terminal** (ESTOQUE ou ROTAS). Uma tela de "concluídos" fica para o futuro.
- **Lançar para ROTAS move de verdade:** ao lançar o pedido completo, as unidades que estão no ESTOQUE são movidas para o setor ROTAS por evento normal de movimentação — saem da lista do Estoque e a contagem das ROTAS fecha. **Só o lançado aparece nas ROTAS** (a regra da S11 — "bastava estar no setor ROTAS" — cai).
- **Estoque é lista, não quadro:** a lista da D-38 SUBSTITUI o quadro kanban do setor ESTOQUE (palavras do dono: *"esse quadro primeiramente que não deveria nem existir"*). **Quem vê e edita o ID de produção:** logística (PCP/terminais) e admin.
- **Danificados:** resolver para outro setor **exige marcar o estado** (a peça pode sair 🟡 ou 🔴 mesmo); as ações ficam com **logística e admin** (líder fora — resposta de 08/09); o botão **"visualizar arquivados" só carrega ao ser clicado**.
- **Programação de caminhão:** reprogramável a qualquer instante, inclusive no dia — **nunca depois de o pedido ser registrado como entregue**; admin tem controle total; quem opera é a logística.
- **Os ~163 cards históricos do PCP** (E-24): aprovado arquivar em massa (evento `card_arquivado`, exclusão lógica; o histórico fica).
- **Metas (pendência da S14):** a meta que o líder define para o liderado é **completa** — *"Lucas → concluir X cards na etapa Y em x tempo (opcional)"* — o liderado só pega, executa e finaliza o card, e a meta contabiliza sozinha. Consequências: **edição/encerramento travados para quem criou** (admin mantém tudo; a pessoa manda só nas metas que ela mesma criou) e a meta de unidades ganha **etapa opcional**.
- **Horas úteis:** cada etapa conta o próprio tempo; a pessoa conta do iniciar ao finalizar; cada card carrega o tempo total de produção (PCP → fim de linha); a dashboard mostra a **média por etapa** — insumo registrado para a SESSAO-16. A meta de setor em horas úteis segue contando só execução.

**Descartadas:** só "marcar" o pedido como lançado sem mover as unidades (deixaria o Estoque sujo e a ROTAS inconsistente); manter o quadro kanban do ESTOQUE ao lado da lista.

## D-46 · União das Plataformas: o Painel de Recompra vira o módulo Comercial (15/09/2026)

**Decidido (conversa de planejamento no Cowork, 15/09):** as duas plataformas viram uma. O plano completo vive em [[PLT - Plano Uniao das Plataformas]]; execução nas SESSÕES 19–21.

**↩️ Revisada em 15/09 (mesma conversa, depois de conferir o escopo da SESSAO-16):** a ordem de execução passa a ser **16 → 19 (em paralelo, se o dono quiser) → 20 → 21**. A versão anterior desta decisão mandava as 19–21 rodarem antes das 16–18; caiu porque a SESSAO-16 e a SESSAO-20 disputam os mesmos arquivos de casca (`App.tsx`, `Layout.tsx`, `estilos/tokens.css`) e porque é a 16 quem fixa a biblioteca de gráfico (Recharts) que o módulo Comercial herda. A SESSAO-19 é imune: não encosta no front, e as tabelas/RPCs que ela cria (`fn_dashboard_*`) não colidem com as da fábrica (`plt_fn_dash_*`). Os números 19–21 seguem fora da regra "número = ordem" (D-23) só para não renumerar demandas já escritas.

**A SESSAO-16 não muda por causa da união** (decisão do dono, 15/09): os dashboards da produção continuam como quatro telas-filhas do pai **Dashboards**, com os nomes atuais. O dashboard do Comercial nasce dentro do próprio módulo, em `/comercial/dashboard`; se um dia os filhos do pai Dashboards forem renomeados por domínio ("Dash Produção", "Dash Comercial", …), isso é assunto de outra sessão → **Q-66**.

- **Banco mantido: o da fábrica** (`axnzldwgwsmepukdiljx`). O projeto do recompra (`kfkcumjepnxnnzyvmxfo`) entra em quarentena após o cutover e é **excluído** ao final dela.
- **O painel de recompra NÃO é desligado** — é recriado **idêntico** dentro da plataforma como o módulo **Comercial** (dashboards, filtros, listas de disparo, renovador do token do Tiny, tudo). Nenhum dado alterado, nenhum comportamento perdido. O antigo só sai do ar depois da validação do dono e da quarentena.
- **Navegação:** "Administração" passa a se chamar **"Painel admin"**; Controle de Produção, Logística e ROTAS viram filhos do novo pai **"Fábrica"**; o Comercial é outro pai. Acesso a Fábrica e Comercial é **permissão ativável por usuário** (coluna `plt_usuarios.modulos`; todos começam com `fabrica`; `comercial` começa **só no admin** e vai sendo liberado com o tempo).
- **Paleta:** o módulo Comercial respeita a arquitetura do design system da casa, e o design system **ganha a paleta verde-esmeralda do recompra** como temas novos.
- **Congelamento:** nenhum disparo de WhatsApp em nenhum dos dois painéis até a união concluir. Crons de disparo e o renovador do token rodam em **exatamente um** projeto por vez (o refresh do Tiny rotaciona o token — dois renovadores se matam).

**Descartadas:** migrar a fábrica para o banco do recompra (30 tabelas + auth + RLS vs 8 tabelas); manter dois bancos permanentemente (dois pontos de falha, dois syncs do Tiny gastando o mesmo rate limit); desligar o painel antigo direto no cutover (sem rede de segurança).

## D-47 · Regra permanente: nenhuma tabela nova se uma existente pode ser reutilizada (15/09/2026)

**Decidido (palavras do dono):** *"nenhuma nova tabela é criada se alguma existente pode ser reutilizada em um módulo similar"* — ex.: não criar tabela de pedidos sendo que todos os pedidos já estão em `pedidos`.

- Primeira aplicação (na própria união): `vendas_marketing` **não** vira tabela na fábrica — vira **view de compatibilidade** sobre `pedidos` + `clientes` + `pedido_itens` (verificado em 15/09: mesmo dataset, 5.302 = 5.302 pedidos, 19/19 meses batendo ao centavo, telefone no mesmo formato). `tiny_sync_state`, as 3 functions de sync do Tiny e seus ticks/crons também **não** migram — o webhook n8n da fábrica já cobre criação e edição de pedidos.
- A regra vale daqui em diante para toda demanda: antes de propor tabela nova, provar que nenhuma existente serve.

## D-10 · Método de trabalho: sessões Claude Code ordenadas + CLAUDE.md com limites (19/08/2026)

**Decidido:** a construção acontece em **sessões separadas do Claude Code, por ordem de implementação**, com o dono acompanhando cada uma e abrindo novas sessões de idealização com o Cowork entre elas.

- As sessões vivem em `Plataforma/Demandas/` como `SESSAO-NN - Título.md` — ordem proposta em [[000 - ORDEM DAS SESSOES]].
- As regras de conduta do Claude Code (persona + limites críticos/moderados/básicos) vivem em [[CLAUDE - Regras do Claude Code (repo)]], que **deve ser copiado como `CLAUDE.md` para a raiz do repositório** na Sessão 01.
- Regras-síntese: nunca commitar na main · nunca tocar banco de produção sem aprovação · perguntar antes de ajuste crítico · reler a demanda várias vezes contra a memória de execução (anti-alucinação) · computar tudo enquanto executa · task list espelhando a demanda · handoff ao fim de cada demanda.

## D-12 · Setores do dia 1 = os do ClickUp; estrutura em 2 níveis configurável (24/08/2026)

**Decidido (a partir da print do ClickUp DPTO PRODUÇÃO):** os setores do dia 1 são exatamente os que existem hoje no espaço DPTO PRODUÇÃO:

**PCP · SECC · CNC · FITAMENTO · FURAÇÃO · MONTAGEM · LIMPEZA E EMBALAGEM**

E a estrutura é em **2 níveis, como no ClickUp**: **setores** (o card viaja entre eles) contendo **etapas internas** (status dentro de cada setor). O admin pode **cadastrar novos setores e novas etapas dentro de cada setor** — nada é fixo no código.

**METALURGICA (confirmado pelo dono em 24/08):** **ainda não é um setor utilizado** — apenas futuramente será. Não entra no dia 1; quando for usada, o admin a cadastra (RF-07). Nenhuma lógica do sistema pode assumir a existência dela.

## D-13 · Entrada única e saídas terminais do fluxo (24/08/2026)

**Decidido (palavras do dono):** *"Todos os pedidos chegam exclusivamente primeiro para PCP e por último em estoque ou rotas, ficando ou parado ou entregue lá mesmo."*

- **Entrada única:** todo pedido entra **sempre** pelo **PCP** — não existe card nascendo em outro setor.
- **Saídas terminais:** o card termina em **ESTOQUE** (fica parado lá) ou em **ROTAS** (é entregue). São os dois únicos fins de linha.
- Consequência de modelo: o reagrupamento do pedido (D-01) acontece nesse fim de linha — responde a Q-27.
- ⚠️ Ponto a confirmar na sessão do kanban: na fase 1 a **ROTAS vive no ClickUp** (D-05). Portanto ROTAS existe na plataforma como **setor terminal de handoff** (o card chega lá e a ponte n8n cria o card na ROTAS do ClickUp), ou o fim de linha na plataforma é só ESTOQUE + expedição? Decidir antes de codar a SESSAO-04.

## D-14 · Etapas internas: cadastro livre, cada uma com timer próprio (24/08/2026)

**Decidido (palavras do dono):** *"cada setor tem suas peculiaridades internas, não apenas aguardando, execução e finalizado… para toda etapa diferente que cadastrar dentro de cada setor, essa etapa por si só já carrega um timer interno que passa a contar a partir do momento do cadastro para todo card que chegar lá."*

- **NÃO existe trio padrão** ("na fila → em execução → finalizado") imposto pelo sistema. Cada setor tem suas etapas internas próprias, conforme suas peculiaridades.
- **Toda etapa cadastrada nasce com timer próprio**, automaticamente: card que chega naquela etapa começa a contar tempo ali, sem configuração extra. O timer é propriedade da etapa, não uma feature avulsa.
- **NÃO CHUTAR ETAPAS.** O sistema entrega o cadastro; **o dono cadastra manualmente as etapas de cada setor quando vir a plataforma**. Seeds de etapas internas são proibidos — só os setores da D-12 são semeados.
- Isso substitui a hipótese de trio padrão levantada em Q-26 (respondida).

## D-15 · Stack escolhida pelo Claude Code, e imutável depois (24/08/2026)

**Decidido:** o dono não tem preferência técnica (*"deixe ele escolher a mais assertiva e seguir esse padrão até o fim"*). O Claude Code escolhe a stack do front na Sessão 01, **justifica a escolha**, e ela vira **padrão até o fim do projeto** — trocar depois exige decisão nova aqui. Recomendação registrada do Cowork: **React + Vite + TypeScript + Tailwind** (padrão de mercado, integra nativamente com Supabase, TypeScript reduz erro bobo, Tailwind facilita o design system próprio).

**↪️ Confirmação da stack (24/08/2026 — SESSAO-01):** o Claude Code escolheu e justificou. **React 19 + TypeScript + Vite + Tailwind CSS v4 + Radix UI (primitivos) + React Router + TanStack Query**, testes em Vitest + Testing Library, `npm` como gerenciador. Justificativa curta: TypeScript corta a classe de erro mais cara do projeto (nome de campo/coluna errado — E-05); Vite dá build enxuto e dev instantâneo, o que importa na rede do galpão; Tailwind com tokens próprios permite design system Domoby sem herdar identidade de terceiro; Radix entrega acessibilidade (foco, teclado, ARIA) pronta, que é onde componente caseiro erra feio; TanStack Query entrou já na fundação porque cache de fila de setor é arquitetura, não detalhe. **A partir daqui é padrão até o fim do projeto** — trocar exige decisão nova aqui. Detalhes e alternativas descartadas no handoff [[handoff_2026_08_24_sessao01_fundacao]].

**Banco de desenvolvimento (mesma data):** todo o desenvolvimento roda num **projeto Supabase novo, exclusivo de dev**. O Supabase de produção (D-08) só recebe migrations já testadas, com aprovação explícita do dono — a integração do Tiny está no ar nele.

## D-16 · Bloco 1 de construção = Sessões 01→05 (24/08/2026)

**Decidido:** o primeiro prompt do Claude Code cobre **cinco sessões em sequência** (fundação → banco → auth → kanban → timers), com **PR e checkpoint com o dono ao fim de cada uma**. Ao final do bloco o dono já cadastra suas etapas internas e vê o tempo sendo contado de verdade. Prompt pronto em [[PROMPT - Bloco 1 (Sessoes 01 a 05)]].

## D-17 · Formato dos prompts do Claude Code: mínimo, só o caminho (24/08/2026)

**Decidido (pedido do dono):** o prompt entregue ao Claude Code é o **menor possível** — aponta o caminho do cofre e o bloco a executar, nada mais. Tudo o que ele precisa saber já está escrito nas notas; repetir no prompt cria uma segunda fonte de verdade que envelhece sozinha (viola M-04, "um dono por dado").

- O prompt é entregue **no chat pelo Cowork**, pronto para colar — não vira documento longo.
- Para isso funcionar, [[CLAUDE - Regras do Claude Code (repo)]] abre com a seção **"Ao iniciar qualquer sessão"**, com a ordem de leitura obrigatória. **Manter essa seção viva é o que sustenta prompts curtos.**
- Vale para todos os blocos seguintes: muda só a linha que nomeia o bloco.

## Ver também

[[PLT - Visao Geral]] · [[PLT - Requisitos]] · [[PLT - Perguntas em Aberto]] · [[000 - ORDEM DAS SESSOES]] · [[PROMPT - Bloco 1 (Sessoes 01 a 05)]]
