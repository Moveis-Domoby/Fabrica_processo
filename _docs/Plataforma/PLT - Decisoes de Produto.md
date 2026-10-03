---
titulo: Plataforma — Decisões de Produto
tipo: decisoes
data: 2026-08-19
atualizado: 2026-10-01
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

**↩️ revisada em 2026-10-01 (D-99):** a automação do canvas pode mover o card sozinha — montada e ligada pelo super admin, nascendo desligada.

**Decidido:** movimentação **manual** (PCP e setores decidem), até encontrarmos padrões bem definidos que justifiquem automatizar. Desde o dia 1, porém, a **API aberta permite movimentação, criação, edição e exclusão em cada etapa via automação** — ou seja, a automação de destino poderá nascer no n8n sem mudar o núcleo da plataforma.

**Descartadas (por ora):** sugestão automática com confirmação; roteiro automático por produto. Nota: isso **revisa** parcialmente [[FAB - Processo Alvo - Um Clique Um Evento]] — ver [[PLT - Visao Geral]].

## D-04 · Produtividade e bonificação ↩️ revisada em 19/08/2026

**↪️ 01/10/2026 (D-94):** bonificação descartada pelo dono — o tema está encerrado.

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

**↩️ revisada em 2026-09-27 (D-58):** nasceu o 10º setor, o fim de linha interno PEDIDOS EM AGUARDO (a aba que já existia virou o lugar da peça pronta de pedido).

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

**↩️ revisada em 2026-09-27 (D-59):** os quadros viraram só arrasto — iniciar = soltar o card na etapa de início; o "assumir" (transferência) saiu dos quadros por ora.

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

**↩️ revisada em 2026-09-27 (D-58):** Pedidos em aguardo deixou de ser só uma sala (filtro do ESTOQUE) e virou o lugar da peça pronta de pedido, com as abas "Pedidos" e "Produtos reservados".

- **Estoque:** produtos parados, cada um com **ID de produção digitável de formato livre** (o formato definitivo é decisão futura — Q-63).
- **Pedidos em aguardo:** onde unidades prontas esperam o pedido ficar **completo**; completo → **lançar para ROTAS**. Absorve como tela o reagrupamento da expedição.
- **Danificados:** tela própria com tudo que está em DANIFICADO; ações **arquivar** ou **resolvido → escolher destino** (Estoque, ROTAS ou qualquer setor). Tudo evento append-only.

## D-39 · ROTAS: programação de caminhão com mapa e sugestão; caminhões cadastráveis (28/08/2026)

- ROTAS lista **apenas pedidos prontos** lançados pelos Pedidos em aguardo.
- **Programar caminhão:** escolhe o dia → pedidos sem programação → a seleção abre **mapa lateral** (Leaflet + OpenStreetMap, grátis e sem chave; geocodificação aberta com cache no banco) mostrando a rota selecionada e **sugerindo** pedidos que fazem sentido nela (proximidade). **É só sugestão — a decisão é humana** (princípio de sempre). Confirma com **data + caminhão**.
- **Caminhões:** cadastro em Administração — visualizar, editar, excluir, com foto.

## D-40 · Auditoria total: toda atividade de usuário gera log persistido (28/08/2026)

Toda ação de usuário registra **log no banco** (quem, quando, o quê, onde), **append-only**, sem exceção. O registro nasce na SESSAO-13; a consulta admin completa pode vir depois.

**↪️ 01/10/2026 (D-95):** a consulta chegou — **Painel admin → Auditoria**, com o porquê de cada gesto e a saída da plataforma também na trilha. **↪️ 01/10 (D-100):** a Auditoria foi para o **Painel super admin** (só o dono).

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

**↩️ revisada em 2026-09-27 (D-58):** "unidade pronta" = chegou a um dos três fins de linha; o lançamento move as unidades de Pedidos em aguardo para as ROTAS (não mais do ESTOQUE).

**Decidido (respostas do dono no início da SESSAO-15, em 01/09; a D-44 pertence à frente do backfill — cofre de Pedidos entregues):**

- **"Unidade pronta" = chegou em setor terminal** (ESTOQUE ou ROTAS). Uma tela de "concluídos" fica para o futuro.
- **Lançar para ROTAS move de verdade:** ao lançar o pedido completo, as unidades que estão no ESTOQUE são movidas para o setor ROTAS por evento normal de movimentação — saem da lista do Estoque e a contagem das ROTAS fecha. **Só o lançado aparece nas ROTAS** (a regra da S11 — "bastava estar no setor ROTAS" — cai).
- **Estoque é lista, não quadro:** a lista da D-38 SUBSTITUI o quadro kanban do setor ESTOQUE (palavras do dono: *"esse quadro primeiramente que não deveria nem existir"*). **Quem vê e edita o ID de produção:** logística (PCP/terminais) e admin.
- **Danificados:** resolver para outro setor **exige marcar o estado** (a peça pode sair 🟡 ou 🔴 mesmo); as ações ficam com **logística e admin** (líder fora — resposta de 08/09); o botão **"visualizar arquivados" só carrega ao ser clicado**.
- **Programação de caminhão:** reprogramável a qualquer instante, inclusive no dia — **nunca depois de o pedido ser registrado como entregue**; admin tem controle total; quem opera é a logística.
- **Os ~163 cards históricos do PCP** (E-24): aprovado arquivar em massa (evento `card_arquivado`, exclusão lógica; o histórico fica). ✅ **Feito em 08/09** na SESSAO-15 — 233 cards arquivados (conferido no banco em 01/10).
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

## D-48 · Execução um por vez com pausa por líder; tempo de PCP e de aguardo são do pedido (21/09/2026) — ↩️ revisa a D-24 e a Q-17

**↩️ revisada em 2026-09-27 (D-59):** a pausa do líder saiu dos quadros junto com os botões — arrastar para PARADO ou para a fila fecha o tempo. O limite de 1 por pessoa e o "iniciar na fila avança" continuam (agora pelo arrasto).

**Decidido (respostas do dono no início da SESSAO-22):**

- **Limite de execuções por pessoa: o padrão vira 1** em todos os setores (↩️ revisa a D-24, que nascia "sem limite"). Segue **configurável por setor** — e a edição passa a ser permitida a **líderes (do próprio setor) e admins**, nas configurações do setor.
- **Líder pode pausar a execução de alguém** (urgência do dia a dia). ↩️ Isto revisa a Q-17 ("não existe pausa"): a pausa volta, mas como **gesto de gestão do líder/admin**, não como disputa de qualidade. `execucao_pausada`/`execucao_retomada` são eventos append-only; execução pausada **não conta tempo** para a pessoa **nem ocupa o limite** — é o que deixa a urgência entrar.
- **Retomar:** a própria pessoa retoma sozinha, **mas só depois de finalizar a urgência** — retomar com outra execução aberta é recusado pela mesma trava do limite (palavras do dono: *"se a urgência tá aberta pra ele então tá errado, ele tem que concluir a urgência antes de pegar outro"*).
- **Tempo em PCP é do PEDIDO:** o pedido entra no PCP e **só para de contar quando for liberado por completo** (todas as unidades). Cada produto tem o próprio tempo de produção (da liberação em diante). Isto substitui as duas alternativas cogitadas na demanda (até a liberação daquela unidade / da primeira unidade).
- **Tempo de aguardo é do PEDIDO:** com tudo produzido, o pedido conta **tempo de aguardo total** em Pedidos em aguardo — insumo futuro do **cálculo de tempo de entrega**. Todos esses tempos ficam salvos no banco (derivados dos eventos — M-02; nada se grava à mão).

**Descartadas:** tempo de PCP por unidade (até a liberação dela ou da primeira); retomada só pelo líder; limite padrão diferente por setor.

**↪️ Complemento (21/09/2026, revisão ao vivo da SESSAO-22 — palavras do dono):** *"quando eu iniciar qualquer card que estiver na fila, ele deve ser automaticamente movido para a próxima etapa; uma etapa pode sim ter mais de 1 execução ao mesmo tempo, um usuário que não pode."*

- **Iniciar na FILA avança sozinho** para a próxima etapa do setor (ordem seguinte, ativa, não-DANIFICADO), com a execução aberta já na etapa nova — M-01: o humano decide (iniciar), o sistema executa a consequência (sair da fila). Setor cuja fila é a única etapa: executa na própria fila (D-14 — etapa não se inventa). Migration 30.
- **O limite de execuções é da PESSOA, nunca da etapa** — confirma o desenho: várias execuções na mesma etapa são normais; a mesma pessoa é que respeita o teto do setor.

## D-49 · Saída de usuário: excluir de fato só sem história; arquivar realoca as pendências ao líder (22/09/2026)

**Decidido (pedido do dono no fechamento da SESSAO-22):** *"adiciona a possibilidade de excluir e de arquivar um usuário: se excluir, tudo o que estava no nome dele é de fato excluído; arquivar, tudo ainda fica no nome dele, porém as pendências dele são transferidas ao líder direto dele, para que o líder possa realocar"* — com modais próprios da casa, nada de caixa do navegador.

- **ARQUIVAR** (qualquer usuário): perde o acesso (`ativo=false` + `arquivado_em`), **tudo fica registrado no nome dele**; no ato, a **execução aberta é encerrada** (o tempo até ali é dele — evento, nunca edição), e **cards delegados + tarefas abertas passam ao líder direto** do setor de cada pendência (setor sem líder, ou o arquivado É o líder → vão para o admin que arquivou). Reversível (**reativar**); as pendências realocadas não voltam.
- **EXCLUIR** (só cadastro **sem história** — nunca gerou evento/log/meta): some **de verdade** — linha, vínculos, notificações, tarefas dele, visualizações, presenças, horários, foto e a **conta de login**. Quem já tem história **não pode ser excluído** (eventos e trilha são append-only — regra crítica 5/D-40, a história não se apaga): o sistema recusa explicando e **oferece o arquivar na hora** (mesmo padrão do caminhão em uso). Card delegado ao excluído volta a ficar sem dono **por evento**.
- **Quem pode: só admin.** Ninguém arquiva/exclui a si mesmo; o último admin ativo não se arquiva.

**Descartadas:** apagar história de produção junto com o usuário (revogaria a regra crítica 5 e furaria a medição — se um dia for desejado, é decisão nova aqui); abrir o gesto a líderes.

## D-50 · Integração Tiny → banco: edição no Tiny edita aqui, apagar no Tiny NÃO apaga aqui (só observações); conferência diária de 60 dias às 3h (23/09/2026)

**Decidido (respostas do dono às perguntas da [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]], conversa da SESSAO-21):**

- **Regra de gravação** — palavras do dono: *"observação tudo bem, mas o resto deve manter mesmo que apague lá; a única coisa realmente que pode acontecer pra alterar aqui é editar pelo Tiny — edição lá deve editar aqui também, mas não apagar"*. Tradução: valor **novo** vindo do Tiny **sobrescreve** o do banco; campo **esvaziado** no Tiny **não apaga** o do banco — **exceto `obs` e `obs_interna`**, que acompanham o Tiny inclusive quando apagadas. (O `coalesce` do `fn_upsert_pedido` já faz "edição sim, apagar não" para todos os campos; a SESSAO-29 muda **só** as observações.)
- **Conferência diária (pente-fino):** relê os pedidos dos **últimos 60 dias**, às **3h da manhã**.
- **Retroativo (23/09):** a correção de 22/09 que apagou a previsão do 13276 foi **desfeita** (`supabase/manutencao/2026-09-23_restaurar_previsao_13276.sql`); as observações internas limpas (13180, 13410) seguem limpas; o vendedor apagado em 13183 e 13421 não tem o valor antigo guardado na plataforma — com o dono.

**Descartada:** "o último pacote do Tiny vence" também para campo apagado (a proposta B original da SESSAO-29).

- **Marcadores:** ficam como estão hoje — a lista do banco acompanha a do Tiny a cada atualização (marcador removido lá sai daqui também). Resposta do dono, 23/09: *"pode deixar do jeito que está atualmente"*.
- **Nada de depender de combinado com a equipe de vendas:** a plataforma tem que se virar sozinha com o que vier do Tiny (resposta do dono à pergunta 4 da SESSAO-29) — a proposta D ("nome do contato só com o nome") foi **descartada**; o que resolve contato renomeado é o pente-fino + a identidade do cliente pelo id do contato no Tiny (itens A e C da SESSAO-29).

**↪️ 01/10/2026 — entregue na SESSAO-29 (migration 49):** a conferência roda às 3h (06:00 UTC) pelo fluxo de carga do n8n, que agora é **acordado pelo banco só quando há pedido para reler** (o relógio de 1 em 1 minuto do n8n saiu — fazia ~1.400 execuções vazias por dia). Relê a busca do Tiny pelos últimos 60 dias (pega até pedido que nunca chegou) + os não terminados de qualquer idade. As observações acompanham o Tiny quando o Tiny manda o campo (vazio = apaga); se o campo nem vier, nada muda. **Gravar só o que mudou:** pedido igual ao Tiny não é regravado (nem os itens); cada rodada deixa UMA linha no log com quantos foram relidos, quais estavam diferentes e o quê — visível em Painel admin → Auditoria (D-95). Cliente: D-98. Pedido achado só pela conferência: D-96.

## D-51 · Meu Painel 2.0: três filas, subtarefas, tarefa privada e o painel pessoal (23/09/2026) — ↩️ revisa a D-37 e complementa a D-32

**Decidido (respostas do dono no início da SESSAO-23):**

- **O Meu Painel se reorganiza em três separadores:** *Delegados a mim* (tarefas de outros ou do Sistema + cards de produção delegados — resposta do dono: *"deixe que os delegados a mim entrem também, se eu não gostar eu mudo"*), *Meus afazeres* (tarefas que eu criei para mim) e a **Fila de prioridade** — a união dos dois em ordem de cadastro, **reordenável pelo próprio usuário** (a posição é preferência de exibição dele, persiste no cadastro e não muda prazo, dono nem dado de tarefa — M-04).
- **"Qualidade a atestar" e "Avisos recentes" saem do painel** (↩️ revisa a D-37): a pendência de parecer vira **tarefa do "Sistema"** no setor recebedor (dar o parecer a conclui sozinha; sem usuário fantasma) e os avisos vivem no sino, que ganhou **"Ver todos"** com o histórico paginado no servidor.
- **Tarefa do Sistema NÃO entra na Fila de prioridade** (*"se é tarefa do sistema é coisa rápida"*) — mas **gera notificação** no sino dos membros do setor recebedor.
- **Subtarefas: até DOIS níveis** (tarefa → subtarefa → subtarefa da subtarefa), na MESMA tabela; mais níveis só se a produção pedir.
- **Tarefa pessoal nasce PRIVADA** — nem líder, nem admin a enxergam (nem o conteúdo, nem o tempo, **nem pela API** — garantido por RLS). O dono pode **torná-la pública na criação ou na edição**; pública, ela ganha as dependências de uma tarefa comum. Reatribuída a outra pessoa, deixa de ser pessoal e vira pública sozinha. A fila de prioridade de alguém, portanto, é visível à gestão **só no que for tarefa delegada** — as pessoais não aparecem.
- **Tempo:** o de *meus afazeres* é só do próprio; o de *delegados* é visível ao próprio + líderes do setor + admins. Timer segue o existente (`iniciada_em`), derivado, nunca digitado.
- **Painel pessoal em Dashboards** (*"Meu desempenho"* — complementa a D-32: operador segue sem ver dashboard de GESTÃO, mas todo usuário vê **o próprio** painel): tempo em afazeres por dia e **por tarefa** (resposta 4) + KPIs de desempenho **apenas do próprio** — *"para que ele possa entender também onde melhorar"*.

**Descartadas:** fila de prioridade 100% secreta (o dono quis a gestão enxergando o que é delegado); um nível só de subtarefa; tarefa do sistema dentro da fila.

## D-52 · Cadastro de ADMIN não exige setor (23/09/2026)

**Decidido (regra do dono, 23/09, durante os ajustes da SESSAO-23):** ao criar um usuário com papel **admin**, o vínculo de setor é **opcional** — admin já tem permissão total e acesso a todos os setores. **Líder e operador continuam obrigados** a ter pelo menos um setor.

- Vale nas duas portas: a tela de Gestão da equipe (aviso "Admin tem acesso a todos os setores — vincular é opcional") e a Edge Function `autenticacao` (`criar-usuario`), que pula o insert em `plt_usuario_setores` quando não há setores.
- Terreno já suportava: existe admin ativo sem vínculo nenhum desde a fundação (o próprio dono) e nenhuma tela/RPC depende de vínculo para admin (`fn_setores_do_usuario` vazio é normal; os gates de admin passam por `fn_eh_admin`).

**Descartada:** esconder a lista de setores para admin (o dono deixou as duas opções; ficou a lista opcional com o aviso — admin pode, se quiser, ser vinculado a setores para aparecer nas equipes).

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

**↩️ revisada em 2026-09-27 (D-58):** os fins de linha agora são três — Pedidos em aguardo (peça de pedido), ESTOQUE (só peça sem dono) e ROTAS (pedido lançado). A entrada única pelo PCP não muda.

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

## D-53 · Estoque na frente: a 25 troca de ordem com a 24 e absorve o estoque-base (24/09/2026)

**Pedido do dono:** *"preciso urgentemente dessa sessão do estoque completamente entregue"*.

**Decidido:**
1. **Ordem de execução do Bloco 5 passa a ser 22 → 23 → 25 → 24 → 26 → 27 → 28.** A [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] roda **antes** da [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]].
2. **O estoque-base migra da 24 para a 25**, para o estoque sair inteiro numa sessão só: **item com pedido × sem dono**, **lançamento manual de estoque** e a **tela de Estoque** (saldo, mínimo, sinalização). A 24 fica com as **consequências**: "Concluir produção" → Pedidos em aguardo, os 3 fluxos de cancelamento e a sugestão de alocação no PCP.
3. **Os números dos arquivos NÃO mudam** (`SESSAO-24`/`SESSAO-25` continuam como estão) — renomear quebraria dezenas de links do cofre. Isto abre **exceção pontual à regra "número = ordem"** da D-23: onde número e ordem divergirem, **vale a coluna Ordem de [[000 - ORDEM DAS SESSOES]]**.
4. **Saldo negativo:** na plataforma é exibido como **0** (*"não existe ter −2 mesas em estoque"*); o valor cru continua no evento. A correção da causa no Tiny fica com o dono ([[N8N - Pendencias e Riscos#P16]]) — **não corrigir por automação**.

**Contexto que tornou isso possível:** entre 21 e 23/09, fora de sessão de código, a **integração com o Tiny da fábrica ficou pronta e em produção** (catálogo `produtos` com 487 itens, `fn_upsert_produto`, workflow n8n ativo e webhook de lançamentos de estoque ligado, com o payload capturado). Ou seja, a parte "externa" da 25 já está feita — sobrou o trabalho dentro da plataforma. Ver [[N8N - Tiny Fabrica Produtos para Banco]].

## D-54 · O fluxo do estoque: só peça pronta, perfeita e sem pedido; abaixo do mínimo, o estoque pede REPOSIÇÃO ao PCP (26/09/2026) — ↩️ revisa a D-22 e fecha a Q-23

**↪️ 30/09/2026 (D-85/D-87):** a reposição ganhou a **segunda saída** (parada 2 dias úteis no PCP, sai sozinha — o Sistema assina) e o **liga/desliga no Painel admin** (agendar/desagendar a rotina); desligada, a logística lança à mão. O mínimo que dispara passou a ser o automático do Top X (D-83/D-84), e a conta desconta o que já vem para o estoque (D-86).

**↩️ revisada em 2026-09-28 (D-70):** agora EXISTE entrada manual no ESTOQUE — a logística/admin cadastra, dá baixa e confere a contagem dos acabados ("por enquanto", palavras do dono). O resto desta decisão (ESTOQUE só com peça 🟢 e sem dono; reposição no PCP) segue valendo.

**Decidido (resposta 7 do dono no início da SESSAO-25 — ele NÃO confirmou o item sem dono nascendo direto no ESTOQUE):** *"Dentro dele não ficará mais nenhum produto danificado, nem com estado de atenção, nem produtos prontos com pedido definido; produtos prontos com pedidos definidos serão estoque reservado e não devem contabilizar positivamente no estoque de fato … quando o produto ficar abaixo do estoque mínimo, lançamos para a produção (PCP) um card de 'necessidade de reposição em estoque', esse card que o estoque vai gerar, no fim também é o PCP que vai decidir o rumo dele; assim que o produto for produzido, vai para estoque aguardar a venda."*

- **Estoque de fato = peça pronta, 🟢 e SEM pedido.** Pronta COM pedido = **reservada** (duas etiquetas: SKU + pedido) — aparece à parte, nunca soma.
- **O ESTOQUE só recebe peça 🟢** — regra do banco para chegada humana (trigger `plt_eventos_validar_chegada_estoque`); as telas de mover/concluir/resolver danificado só oferecem 🟢 quando o destino é o ESTOQUE.
- **Card de REPOSIÇÃO** (tipo novo `reposicao` em `plt_cards`): a maquinaria gera no **PCP** quando o disponível de um produto do catálogo fica abaixo do mínimo do Tiny — um ciclo vivo por produto; depois de um ciclo, só reabre com leitura NOVA do Tiny daquele produto (a peça pronta precisa entrar no Tiny antes). Quantidade = mínimo − disponível (o negativo NÃO entra: aqueles pedidos já têm card próprio no PCP). O **PCP decide**: libera as unidades (nascem sem pedido) ou **"Não produzir"** (arquiva). Pronta → fica **livre** no ESTOQUE.
- **D-13 continua valendo** (tudo entra pelo PCP). **↩️ D-22 revisada:** existe card no PCP que não nasce de pedido do Tiny — o de reposição, gerado pelo estoque (nunca digitado à mão).
- **Não existe lançamento manual direto no ESTOQUE** (item 5 da demanda original, não confirmado): a entrada de estoque é o Tiny (a equipe cadastra o pronto lá) e a produção de reposição.
- **Q-23 ✅ fechada:** produção para estoque = card de reposição que o estoque gera no PCP.
- A geração automática (pg_cron, a cada 5 min) **é ligada à parte**, com o OK do dono (`supabase/manutencao/2026-09-26_ligar_reposicao_automatica.sql`) — a primeira rodada com a carga de 26/09 criaria 44 cards (121 unidades).

**Descartada:** item sem dono lançado à mão direto no ESTOQUE (não confirmado pelo dono).

## D-55 · O número do estoque: o do Tiny menos o que a loja já vendeu e ainda não saiu; negativo = "necessidade extrema" (26/09/2026)

**↩️ revisada em 2026-09-28 (D-70):** nos ACABADOS o número passou a ser a contagem da logística (peças livres no ESTOQUE) — o Tiny não avisava a saída da venda nem o pronto dos móveis, e o negativo dele virava falsa "necessidade extrema". Esta regra (Tiny − reservas) segue só para matéria-prima e insumos.

**Decidido (respostas 1, 2 e 3 do dono, SESSAO-25):** *"o pessoal cadastra o produto dentro do Tiny como pronto, o Tiny aumenta a quantidade; quando um pedido de venda é gerado no Tiny da loja, ele já debita automaticamente do Tiny da fábrica … para eles o negativo é necessidade de produção, mas na nossa plataforma não faremos assim, não teremos estoque negativo, quando ficar negativo é porque é necessidade extrema de produção."*

- **Saldo do Tiny = leitura derivada** do último aviso de cada produto (webhook de lançamentos de estoque ou a carga inicial) — **sem tabela e sem coluna nova** (resposta 1: "faça o mais profissional, otimizado e rápido"; o dono autorizou 2 colunas em `produtos` se um dia precisar).
- **Disponível = saldo físico lido − reservas abertas** (itens não personalizados de pedidos da loja em aberto/aprovado/preparando envio, casados por SKU). O Tiny **não avisa** quando sai pedido (46 pedidos, 0 avisos — a reserva não é lançamento); a plataforma faz a conta com os pedidos que já chegam ao banco.
- **Na tela, nunca negativo** (D-53): mostra 0 e a **"necessidade extrema — N vendidos sem estoque"** (ícone + texto).
- **Tiny e plataforma nunca se somam** (resposta 2): "Em estoque" (Tiny) · "Reservados" (prontos com pedido) · "Livres na plataforma" (prontos sem pedido, da reposição).
- **Venda da loja debita** = a reserva derivada acima (a venda nova entra na conta na hora).
- **Personalizado** não reserva nem desconta o produto do catálogo (a loja reusa o SKU com outras medidas). **Exceção (dono, 26/09):** personalizado produzido cujo pedido foi cancelado **vai para o estoque** e, a partir daí, uma venda igual dá baixa nele — fluxo do cancelamento, [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]].

⚠️ **Achado da carga de 26/09 (para o dono):** o **físico** dos fabricados no Tiny está **negativo em 93 de 168** (venda que baixou sem o "pronto" correspondente) e a **reserva do Tiny não bate com os pedidos abertos** (ex.: 327 com 44 reservados no Tiny × 0 pedidos abertos no banco; serviços da própria fábrica — Corte, Furo, FITAMENTO — com milhares reservados). Por isso a plataforma usa os pedidos abertos, não o `saldoReservado` do Tiny.

## D-56 · O ID da peça é o SKU; reservada ganha a segunda etiqueta, a do pedido (26/09/2026) — fecha a Q-63

**Decidido (resposta 4 do dono):** *"O id que eles usam atualmente é apenas o SKU do Tiny etiquetando, e eles contam em um papel todos os dias quantos tem de cada produto em estoque. Vamos deixar que ainda seja o SKU contando a quantidade, mas a nossa ideia é eliminar o papel. Quando sai um pedido com o respectivo produto tendo sido vendido, o produto passa a ter 2 ids, o SKU e o id do pedido, duas etiquetas diferentes, e ele vira produto reservado."*

- A tela de Estoque mostra a **quantidade por SKU** (o papel deixa de ser a fonte); a peça reservada aparece com **SKU + nº do pedido**.
- O campo livre "ID de produção" (D-38) **sai da tela** (a coluna e a RPC ficam no banco — nada se apaga).
- **Q-63 ✅ fechada.**

## D-57 · Estoque em duas telas + sugestão de mínimo pelo top 20 (26/09/2026)

**↪️ 28/09/2026 (D-71/D-72):** "Produtos acabados" virou **Top 20+** (a lista de prioridade das vendas foi para lá) e "Sugestão de mínimo" virou **Configurações** (mínimo editável aqui, capacidade do galpão, sugestão que cabe no galpão). O dono ajusta o mínimo na plataforma — o do Tiny vale só enquanto não houver um definido aqui.

**Decidido (resposta 8 e pedido do dono na abertura da SESSAO-25):**

- **Produtos acabados** (F fabricado, S simples/revenda, variações) e **Matéria-prima e insumos** (M, K — peças, MDF, parafusos): *"pra produção, o que futuramente irá existir é estoque de peça e necessidade de produção de peça com plano de corte — esse será o nosso próximo passo, então já adiantaremos a peça."* As duas vivem em abas do mesmo filho `/fabrica/logistica/estoque` (não são rotas novas — D-36).
- **Sugestão de mínimo:** *"é para os 20 produtos mais vendidos dos últimos 90 dias, porém com rank — obviamente o produto mais vendido deve ter mais em estoque do que o top 20."* Sugestão = média semanal de vendas (sem personalizado, sem cancelado) × semanas de cobertura escolhidas na tela (1, 2 ou 4) — cresce com a venda. O dono ajusta o mínimo **no Tiny**.
- **Alerta de erro do n8n (P1): não agora** (*"belíssima ideia, porém não faremos ainda"*).

## D-58 · O lugar da peça pronta: com pedido → Pedidos em aguardo; o ESTOQUE fica só com peça sem dono (27/09/2026) — ↩️ revisa a D-13, a D-18, a D-38 e a D-45

**Decidido (resposta b4 do dono no início da SESSAO-24):** *"JÁ EXISTE A ABA DE PEDIDOS EM AGUARDO, OS LOCAIS FINAIS NÃO SÃO MAIS ESTOQUE E MUITO MENOS ROTA, ISSO JÁ MUDOU, ESTOQUE SÓ FICA COMO LOCAL FINAL DE PEÇA SEM DONO."*

- **Peça pronta COM pedido termina em Pedidos em aguardo** — a aba que já existia passa a ser o **lugar** da peça (por baixo, um fim de linha interno "PEDIDOS EM AGUARDO"; nenhuma tela nova, nenhuma rota nova). De lá o pedido completo é **lançado para as ROTAS** (D-45, que segue valendo para o lançamento).
- **O ESTOQUE só recebe peça SEM dono** (reposição, ou peça de pedido cancelado — que perde o pedido na chegada). Peça de pedido vivo mandada ao ESTOQUE é recusada pelo banco com a explicação.
- **Os dois lugares só recebem peça 🟢** (a regra da D-54 vale para os dois). Pedidos em aguardo só aceita peça de pedido vivo.
- **Painel:** "concluídas do dia" passa a contar só a chegada vinda da **produção** (a mudança entre fins de linha — lançar para ROTAS, cancelamento — não é produção nova; antes o lançamento contava a peça duas vezes). O "fim de linha" do painel ganha Pedidos em aguardo.
- **O que estava no ESTOQUE com pedido em 27/09** (herança): as 🟢 de pedido vivo foram para Pedidos em aguardo; as de pedido **já entregue no Tiny** foram **arquivadas** (dono: *"se já foi entregue, não deve nem aparecer mais aí"*); a 🔴 do 13215 ficou esperando decisão.
- ↩️ **D-13 / D-18:** os fins de linha agora são três — Pedidos em aguardo (peça de pedido), ESTOQUE (peça sem dono) e ROTAS (pedido lançado); a entrada única pelo PCP não muda. ↩️ **D-38:** a "sala" de Pedidos em aguardo virou lugar. ↩️ **D-45:** "unidade pronta" = chegou a um fim de linha (qualquer um dos três); o lançamento move do aguardo para as ROTAS.

**Descartadas:** manter a peça de pedido no ESTOQUE e só filtrar a aba (era o modelo antigo, que o dono disse que "já mudou"); criar tela ou rota nova para o aguardo.

## D-59 · Quadros de produção só por arrasto; o único botão é "Concluir produção", na LIMPEZA E EMBALAGEM (27/09/2026) — ↩️ revisa a D-24, a D-48 e a D-03

**Decidido (resposta a1 do dono, depois de um alinhamento com a equipe da fábrica):** *"um móvel só vira móvel na parte de montagem; até a montagem ele é um plano de corte dividido em várias peças de outros móveis até. Então, por enquanto, vamos remover todos os botões, eles preferem que tudo seja arrastando, é mais rápido. Se o cara mover de 'a montar' para 'montando', esse card já deve ser instantaneamente iniciado, não o contrário; se ele mover para 'montado', o card já deve ir para o próximo setor, que é limpeza e embalagem. O único lugar que terá o botão de concluir é no setor de limpeza e embalagem: todos os móveis que vão para estoque passam por ele e eles que movem para estoque, seja móvel para estoque de fato, ou móvel já reservado por algum pedido."* E: *"já existe a etapa de fila, início e conclusão em todos os setores."*

- **Soltar o card na etapa de INÍCIO** (a próxima depois da fila — a mesma regra da D-48↪️) **inicia o tempo de quem arrastou**, na mesma hora. O limite de 1 por pessoa (D-48) e o parecer de quem recebe (D-09) continuam valendo.
- **Soltar numa etapa que ENCAMINHA** (com nome de setor, ou CONCLUÍDO — D-60) **leva o card ao setor dela**, pedindo a marcação 🟢🟡🔴 de quem entrega (D-09 é lei).
- **Soltar em qualquer outra etapa** (PARADO, a própria fila…) só move — e fecha o tempo de quem executava (regra que já existia).
- **"Concluir produção"** é o único botão dos quadros e só existe na **LIMPEZA E EMBALAGEM**: peça de pedido vivo → **Pedidos em aguardo**; peça sem pedido (reposição) ou de pedido cancelado → **ESTOQUE, sem dono** (D-58). Só 🟢.
- **Modo tablet** também vira quadro de arrastar, com botão grande; ao soltar ou concluir, pede o **PIN** de quem fez (D-06/SESSAO-07).
- **Saem dos quadros** os botões Iniciar, Pausar, Retomar, Finalizar, Assumir e Mover. ↩️ **D-24:** "iniciar é obrigatório" continua — o gesto agora é soltar na coluna de início; o "assumir" (transferência) sai por ora. ↩️ **D-48:** a pausa do líder sai junto com os botões — arrastar para PARADO ou para a fila fecha o tempo (as regras e os eventos de pausa continuam no banco). ↩️ **D-03:** o destino continua manual — quem decide é quem arrasta; a etapa que encaminha só poupa o segundo gesto.
- Decidido pelo Claude e avisado ao dono (pode corrigir): tablet por arrasto com PIN; etapa chamada ESTOQUE não encaminha (quem leva ao fim de linha é o Concluir).

**Descartadas:** manter os botões ao lado do arrasto (a equipe prefere só arrastar); concluir em todos os setores (só a LIMPEZA E EMBALAGEM leva ao fim de linha); cadastrar marca nova "etapa que inicia" (a estrutura fila → início já existia — E-44).

## D-60 · Rotas das etapas: etapa com nome de setor leva ao setor; CONCLUÍDO leva ao próximo — SECC e CNC mandam para a FURAÇÃO (27/09/2026)

**Decidido (respostas do dono na SESSAO-24):** *"etapa com nome de setor move o card para o setor"*; *"a etapa CONCLUÍDO de SECC e CNC manda para FURAÇÃO, o concluído dos outros setores manda sempre para o próximo (SECC e CNC são 2 máquinas diferentes que fazem praticamente a mesma coisa: cortam uma chapa de MDF de acordo com o plano de corte feito no SketchUp; a diferença é que a CNC também fura a peça, a SECC não)"*; "CENTRO DE FURAÇÃO" = setor FURAÇÃO.

- **Etapa com nome de setor de produção** (herança do ClickUp — em todos os quadros e também no PCP) leva ao setor do nome. **"CENTRO DE FURAÇÃO" → FURAÇÃO.**
- **CONCLUÍDO:** SECC → FURAÇÃO · CNC → FURAÇÃO · FITAMENTO → FURAÇÃO · FURAÇÃO → MONTAGEM · MONTAGEM → LIMPEZA E EMBALAGEM ("o próximo" pela ordem cadastrada dos setores — confirmado pelo dono na prévia: *"Sim, está certo"*).
- A LIMPEZA E EMBALAGEM não tem rota: as etapas ESTOQUE, EXPEDIÇÃO, CANCELADO, NÃO ENCONTRADO e ENTREGUE ficam etapas comuns — o fim de linha é o **Concluir produção** (D-59).
- **É dado do dono, não código:** editável em **Setores e etapas** ("Soltar o card em {etapa} manda para…"); etapa nova com nome de setor já nasce com a rota. A carga inicial (20 etapas) só preencheu etapa sem rota — reaplicar nunca desfaz edição do admin.

## D-61 · Cancelamento em três estágios; a aba Cancelados guarda para sempre; peça inacabada não vai para o estoque (27/09/2026)

**Decidido (respostas b2 e b3 do dono na SESSAO-24, sobre o desenho da demanda):**

- **Cancelado ainda no PCP** (nada produzido): o pedido sai do quadro do PCP e vai para a **aba Cancelados** do PCP — que **guarda para sempre** (b3), paginada, carregada só ao abrir.
- **Cancelado com peça em produção:** a peça **segue em produção** com a etiqueta **"Pedido cancelado — pronta, vai para o estoque"**; ao ser concluída na LIMPEZA E EMBALAGEM, vai ao **ESTOQUE sem dono**. Nada de estocar peça inacabada (b2): *"a peça continua em produção e logo mais irá para o estoque de peças de fato, não de produtos prontos"* (o estoque de peça é o próximo passo — D-57).
- **Cancelado com peça pronta** (em Pedidos em aguardo): a peça vai **sozinha** ao ESTOQUE, **sem dono** (o produto do catálogo é achado pelo SKU). Personalizado cancelado também vai ao estoque (a exceção da D-55).
- A etiqueta é lida da situação do pedido no Tiny (a mesma fonte do cancelamento) — nada guardado à parte.

## D-62 · A sugestão do estoque na liberação: o que é "peça igual" e quem aceita (27/09/2026)

**Decidido (respostas b1 e b5 do dono na SESSAO-24):**

- **"Peça igual" (b1):** produto do catálogo casa pelo **SKU**; **personalizado** casa por **SKU + descrição idêntica** (sem ligar para maiúsculas, acentos e espaços); item **sem SKU** casa pela descrição idêntica.
- Ao liberar um pedido no PCP, cada linha mostra **"Há N igual(is) no estoque, sem dono — usar?"** — **desmarcado por padrão** (a sugestão nunca decide sozinha). **↪️ 30/09 (D-78):** a peça que a VENDA já reservou para a unidade vem **marcada** ("Peça do estoque reservada para este pedido — usar?").
- **Quem aceita (b5):** PCP/logística (*"são a mesma coisa no fim das contas"*) e admin.
- **Aceitar** faz a unidade do pedido nascer **direto em Pedidos em aguardo** (a peça livre sai do ESTOQUE; as duas histórias ficam guardadas). Se o pedido for cancelado depois, a peça volta ao ESTOQUE sem dono (D-61).

## D-63 · Frete não vira peça de produção; o resto nasce no PCP e o PCP escolhe o lugar; pedido sem nada a produzir vai direto para Pedidos em aguardo (28/09/2026) — ↪️ ajusta a D-01 e a D-45

**Contexto:** achado da F-07 da SESSAO-24 — o 13215 tinha um card "Frete" (1/1) na LIMPEZA E EMBALAGEM: todo item do pedido com quantidade ≥ 1 virava unidade (a regra do n8n/ClickUp de sempre, copiada na SESSAO-04). Levantamento só de leitura (8.107 itens, 03/2025 → 28/09): fora de móvel, só 4 famílias — frete/entrega, serviço de instalação ("Fechadura (com instalação)", "Passa fio (com instalação)"), revenda pronta (cadeiras, lâmpadas-kit, espelho Adnet, carro de mão, longarinas) e acessório solto (rodízios, puxador); em 90 dias, 44 de 897 pedidos (4,9%) com algum. A classe do catálogo do Tiny e o SKU **não** separam (A-31).

**Decidido (respostas do dono em 28/09):**

- **Só frete/entrega não vira card** de produção (resposta: *"Frete / entrega"*) — nem conta para o pedido ficar completo. Reconhecido **pela descrição** (resposta: *"Pela descrição"*): a 1ª palavra — "Frete", "Frete cliente", "Entrega".
- **Todo o resto** — cadeira, lâmpada, fechadura, passa-fio, rodízio, espelho… — *"SEMPRE NASCE NO PCP DO JEITO QUE ESTÁ E O PCP DEFINE O LOCAL CORRETO"*: continua virando unidade, e o PCP escolhe o destino na liberação (a cadeira de estoque pode ir direto para Pedidos em aguardo — já funcionava).
- **Cadeira e acessório são produto de estoque:** *"também são vendidos pela loja e devem estar no estoque cadastradas com a quantidade de acordo com o Tiny, se não está assim atualmente, está errado"* — conferido em 28/09: as cadeiras estão em Estoque → Produtos acabados com o número do Tiny; o que ficou para o dono decidir está na Q-71.
- **Pedido sem nada a produzir** (só frete — nunca aconteceu: 0 em 5.410 pedidos): *"Direto p/ Pedidos em aguardo"* — nasce no PCP (entrada única, D-13), não espera liberação e aparece já completo para a logística lançar para ROTAS. Decidido **na leitura**: se o Tiny acrescentar um móvel, o pedido volta sozinho ao quadro do PCP.
- ↪️ **D-01:** "cada móvel vira um card por unidade" — frete/entrega não é móvel e não vira card. ↪️ **D-45:** "unidade pronta" e pedido completo contam só unidades de produção.

**Como ficou (técnico):** migration 39 — a regra única na view `plt_privado.vw_itens_producao` (eh_frete + unidades; view e não função porque função com `set search_path` não é embutida pelo planner — E-65), somada pelas 17 portas que contam unidades; gatilho em `plt_cards` recusa card de unidade de frete para todo escritor (M-14); `lock_timeout` de 5 s na aplicação (E-66); manutenção arquiva o card de frete que nasceu antes da regra (o do 13215 — card de teste, M-16).

**Descartadas:** reconhecer pela classe do produto no Tiny (a classe "simples" mistura móvel feito aqui — Penteadeira camarim, 82 vendas — com revenda, e frete não tem SKU); lista editável no admin (tabela nova sem necessidade — D-47); o PCP marcar item a item (+1 gesto por pedido); tirar também revenda, serviço e acessório da produção (o dono quer o PCP decidindo o lugar).

> Numeração: a SESSAO-24 (que rodou em paralelo com a 26) usou D-58…D-62; a D-63 é do ajuste do Frete (28/09); a D-64 ficou sem uso.

## D-65 · Chat interno: canais, particulares e Avisos gerais — quem cria, quem escreve, quem lê (27/09/2026)

**Decidido (respostas do dono no início da SESSAO-26):**

- **Três tipos de conversa:** canal de grupo, particular (1:1 com qualquer colega) e **Avisos gerais** (uma conversa da empresa inteira — todo cadastro participa, inclusive quem chega depois, sem herdar "não lidas" antigas).
- **Canal: só líder e admin criam** (resposta 2). **Quem cria administra** — muda o nome, põe e tira pessoas; o admin da plataforma que estiver no canal também administra. Ninguém tira a si mesmo.
- **Avisos gerais: o admin escreve sempre e decide QUEM MAIS escreve** (resposta 3 — lista configurável na própria conversa, "Quem escreve"); os demais só leem.
- **Cada um lê só as conversas de que participa — nem o admin lê particular ou canal alheio**, nem pela API (RLS por participação + canal de websocket privado).
- **Guardar para sempre** (resposta 4). Mensagem é **só inserção**: não se edita nem se apaga (histórico simples e honesto); quem sai de um canal não é apagado — a saída fica marcada.
- **Conta de tablet do setor participa normalmente** (resposta 5) — na prática ela vive no `/tablet`, onde o chat não aparece.
- **Trilha (D-40):** canal criado/renomeado, pessoa posta/tirada, quem escreve nos avisos, aviso publicado e data de nascimento alterada. **Mensagem comum e abertura de particular NÃO vão para a trilha** — a própria mensagem já é o registro, e a trilha mostraria aos admins quem conversa com quem. Conteúdo, nunca.
- Mensagem nova **não** vai para o sino (o sino é dos avisos do sistema); quem avisa é o badge do balão.

**Descartadas:** todos criarem canal; líderes escreverem nos avisos por padrão; admin lendo tudo (auditoria de conversa); apagar/editar mensagem.

## D-66 · Aniversários: o Sistema publica os parabéns nos Avisos gerais (27/09/2026)

**Decidido (resposta 1 do dono — "só no grupo mesmo, tá boa a mensagem"):**

- Campo novo **data de nascimento** em `plt_usuarios` (D-21) — a própria pessoa cadastra no Meu Perfil; o admin, na Gestão da equipe. **Só a pessoa e o admin veem a data** (fora da API — D-68).
- No dia, às **08:00 de Natal**, o Sistema publica nos **Avisos gerais**, uma vez por pessoa: *"🎉 Hoje é aniversário de {nome}! Parabéns — toda a Domoby deseja um ótimo dia."* Só pessoas ativas.
- Nascido em **29/02** é lembrado em **28/02** nos anos não bissextos.

**Descartada:** mandar também em particular para a pessoa.

## D-67 · Chat por websocket; leitura só por página — 10 mensagens, 5 conversas (27/09/2026) — ↩️ ajusta as notas técnicas da SESSAO-26

**Decidido (adendo do dono no início da SESSAO-26):** *"a comunicação deve ser por websockets, não deve ter consulta de leitura ao banco, apenas de post; a única leitura deve ser da paginação para consultar mensagens antigas, até 10 mensagens por paginação, até 5 conversas por paginação também, até rolar o scroll e requisitar mais."*

- **Websocket = Broadcast do banco em canal PRIVADO.** A autorização é conferida UMA vez, na entrada do canal (política em `realtime.messages`); o banco empurra cada mensagem. **↩️ Ajusta a nota da demanda** ("a publicação realtime ganha a tabela de mensagens"): no `postgres_changes` o Realtime relê o banco para cada assinante a cada mudança — o peso que o dono proibiu —, então a publicação **não** mudou.
- **Dois canais só:** o da pessoa (sinais do badge e da lista — 1 por login) e o da conversa ABERTA (a mensagem inteira — sai ao fechar).
- **Leitura:** a lista vem de 5 em 5 e as mensagens de 10 em 10 (o teto é do banco), a próxima página só ao rolar ou tocar em "Ver mais/Ver anteriores". A 1ª página da lista é a única leitura na abertura do app (é ela que acende o badge). **Nada de polling, nada de reler ao voltar à aba**; só a queda do websocket relê a 1ª página (pode ter perdido sinal).
- **O resto é POST:** enviar (devolve a mensagem — quem envia não relê), marcar como lida, abrir particular, criar/renomear canal, pôr/tirar pessoa, liberar quem escreve, data de nascimento.

## D-68 · Dados sensíveis do cadastro fora da API (27/09/2026)

**Decidido (resposta 6 do dono — "a"):** o navegador passa a ler de `plt_usuarios` **só as colunas de trabalho**. **CPF, hash do PIN, token de convite e data de nascimento ficam fora da API.** Achado da SESSAO-26 (E-50): o grant de TABELA que o Supabase dá por padrão anulava os `revoke` por coluna da S03 — qualquer pessoa logada lia CPF, PIN e convite de todos.

- **Regra permanente:** coluna nova em `plt_usuarios` só fica legível pelo navegador com `grant select (coluna)` explícito; dado pessoal novo nasce fora da API e é lido por porta própria (como a data de nascimento).

## D-70 · O estoque dos acabados é a CONTAGEM da logística (entrada, baixa e contagem manual) — o Tiny sai da conta (28/09/2026) — ↩️ revisa a D-54 e a D-55

**↪️ 30/09/2026 (D-76…D-79):** a contagem continua sendo o número, mas agora **conversa com o Tiny** (sincronismo ligado pelo admin): o Tiny acima sobe a plataforma, os gestos daqui deixam o Tiny igual, e a venda reserva a peça.

**Contexto (diagnóstico de 28/09, só leitura no banco real):** o número dos acabados era "saldo do Tiny − pedidos da loja em aberto" (D-55). Mas o aviso de estoque do Tiny não chega na saída da venda nem no "pronto" dos móveis — 9 avisos na vida toda, nenhum de móvel, o último em 25/09; 45 pedidos saíram da reserva sem aviso (A-25). Só 19 dos 168 fabricados tinham saldo positivo e 57 viravam "necessidade extrema" sem pedido nenhum (o negativo do Tiny — P16). O dono, vendo a tela: *"porque nenhum produto está em estoque?"*.

**Decidido (pedido do dono na conversa, 28/09):** *"deve ter um botão de 'cadastrar produto ao estoque' … a logística irá dar baixa manual na quantidade de itens em estoque por enquanto"*.

- **O número de cada produto acabado (F/S/variação) = as peças livres no ESTOQUE** — a contagem da plataforma. A logística (e o admin) **cadastra** (entrada), **dá baixa** (sai a mais antiga primeiro) ou **confere a contagem** (o sistema acerta a diferença). Por baixo, cada peça é um card `unidade` sem pedido, com o produto do catálogo, direto no ESTOQUE — a mesma peça que a reposição e o pedido cancelado já deixam lá. Tudo por evento append-only (RNF-05); a baixa é o `card_arquivado` com o motivo, e a logística passa a poder arquivar peça livre do ESTOQUE.
- **Consequência boa, sem nada novo:** a sugestão do PCP na liberação ("há N no estoque — usar?", D-62) enxerga as peças cadastradas.
- **O Tiny sai da conta dos acabados** — fica nos insumos (M/K) e como referência no detalhe do produto. Os pedidos da loja em aberto **não descontam mais** o número (o pedido vira peça pela produção ou pela alocação do PCP). Acaba a "necessidade extrema" (↩️ D-55: o negativo era do Tiny).
- **A reposição automática** (ainda desligada) passa a olhar a contagem da plataforma e o mínimo efetivo; depois de um ciclo, reabre com **movimento novo do estoque** do produto (antes: leitura nova do Tiny). ⚠️ Antes de ligar, a logística precisa ter contado o estoque — senão todo produto com mínimo pede reposição.
- ↩️ **D-54:** "não existe lançamento manual direto no ESTOQUE" deixa de valer — agora existe, pela logística/admin, só peça pronta e em perfeito estado (o ESTOQUE continua só com peça 🟢 e sem dono). "Por enquanto" (palavra do dono): quando o fluxo do galpão estiver todo na plataforma, a entrada vem da produção.

## D-71 · Top 20+: a tela do estoque abre pelos 20 mais vendidos; só aparece o que está em estoque; o resto na busca (28/09/2026) — ↪️ D-57

**↩️ revisada em 2026-09-30 (D-83):** o 20 virou o **Top X configurável** (1–50), que é o tamanho da página; a lista virou UMA (o catálogo inteiro pelo ranking, o "Ver os outros" morreu) e o corte de pedido fora do comum entrou no ranking (D-84).

**Decidido (pedido do dono, 28/09):** *"no estoque deve aparecer apenas os itens que realmente estão em estoque, os outros devem ficar nas próximas páginas, ou em um botão de 'ver produtos'"*; *"a paginação pegue os 20 produtos mais vendidos dos últimos 90 dias"*; *"gostei dessa lista de prioridade do mais vendido ao menos vendido, passe essa lista para a aba de 'produtos acabados' que agora irá se chamar 'Top 20+'"*.

- A aba **Produtos acabados vira "Top 20+"**: a primeira página são os **20 mais vendidos dos últimos 90 dias**, em ordem de venda (o rank aparece na foto); depois vem **tudo o que tem estoque**. O resto do catálogo não aparece: fica em **"Ver os outros produtos"** (carrega só ao abrir) e na **busca**, que procura no catálogo inteiro.
- A venda de 90 dias é **uma regra só** no banco (sem cancelado, sem personalizado, SKU do catálogo ativo) — a mesma do rank e da sugestão de mínimo.
- A aba **Matéria-prima e insumos** mostra primeiro o que tem estoque (o resto nas páginas seguintes).

## D-72 · Mínimo e capacidade do galpão na plataforma; a sugestão de mínimo CABE no galpão (28/09/2026) — ↩️ revisa a decisão 4 da SESSAO-25 e a D-57

**↩️ revisada em 2026-09-30 (D-83/D-84):** a capacidade do galpão **saiu de uso** (a coluna fica guardada) e a sugestão passou a ser por **dias úteis de venda**, sem teto; o mínimo virou **automático** (editar trava) e **só o Top X tem mínimo** — o do Tiny deixou de valer como reserva nos acabados. O "Usar todas as sugestões" morreu. O cartão Galpão virou o painel de seis números (pedido do dono em 30/09).

**Decidido (pedido do dono, 28/09):** *"o mínimo deve ser editável em uma caixinha de configurações … aparecer também a quantidade máxima do galpão; a quantidade mínima sugerida deve se adequar ao tamanho máximo do galpão (cuidado aqui)"*; *"a aba de sugestão de mínimo pode na verdade virar a aba de configurações"*.

- A aba **Sugestão de mínimo vira "Configurações"**: a **capacidade do galpão** (quantas peças cabem) e o **mínimo de cada produto**, editável ali. **Mínimo vazio volta a valer o do Tiny** (↩️ "o mínimo mora no Tiny" da SESSAO-25) — nada se perde, e o que for definido aqui manda.
- **A sugestão** = venda média da semana (90 dias) × cobertura (1, 2 ou 4 semanas). **Se a soma de todas passar da capacidade, todas encolhem na mesma proporção** (arredondamento pelo maior resto): a soma nunca passa da capacidade e **o mais vendido nunca fica com menos que o de baixo**. Quem não vendeu nos 90 dias não tem sugestão.
- **"Usar todas as sugestões"** (dois toques): os mínimos viram as sugestões e quem não vendeu fica **sem mínimo** — só assim a soma dos mínimos cabe de verdade no galpão. Um a um também ("Usar" em cada linha). A tela avisa quando a soma dos mínimos passa da capacidade.
- Decidido pelo Claude (o dono pediu para não perguntar): capacidade em **peças** (não em volume); a sugestão cabe na capacidade inteira (as peças reservadas em Pedidos em aguardo aparecem no resumo, mas não descontam a capacidade); mínimo e capacidade são gesto da **logística e do admin**, com trilha (D-40).

## D-73 · Foto de cada produto no estoque — só a logística e o admin cadastram (28/09/2026) — ↪️ D-28

**Decidido (pedido do dono, 28/09):** *"deve ter a possibilidade de cadastrar e ver a imagem de cada item … dando destaque para a imagem (apenas logística e admins podem cadastrar imagens)"*.

- Cada produto ganha a **foto (capa)**, que aparece em destaque no cartão do Top 20+; tocar na foto abre o produto (foto grande, números, peça por peça).
- A foto mora na **mesma biblioteca por SKU** que o tablet já usa para as imagens de produto (D-28 — `produtos/{sku}/…`): uma foto do produto, um lugar só. **Quem define a capa do estoque: logística e admin** (o banco confere); a política de envio da logística vale só para a pasta de produtos. A foto é reduzida no próprio celular antes de subir (rede do galpão).

## D-81 · As fotos dos produtos vêm do Tiny e aparecem inteiras, sem corte (30/09/2026) — ↪️ D-73

**Pedido do dono (30/09):** *"coloque as imagens dos produtos de acordo com o que está no Tiny… eu preciso dessas imagens na plataforma por questões de design"*; e, vendo o resultado: *"a visualização da foto está ruim, ela provavelmente é em pé, porém o view dela na plataforma está deitado, ajuste isso"*.

**Decidido (respostas do dono em 30/09):**

- **Todas as fotos do Tiny entram** (*"Todos os 144"*): móveis, insumos, kits e revenda. Feito em 30/09: 144 produtos, 146 fotos, copiadas para a biblioteca da plataforma (a foto não depende do Tiny no ar), registradas no histórico com o nome do dono. Só preencheu quem estava sem foto; 47 móveis ativos seguem sem foto porque o Tiny não tem.
- **Daqui para frente, cópia automática** (*"Quero automático depois"*): quando o produto entrar ou mudar a foto no Tiny, a plataforma copia sozinha — **próximo passo, a desenhar e aprovar** (não feito ainda). Até lá, produto novo ganha foto pela câmera do Estoque ou por uma nova cópia pedida ao Claude.
- **A foto aparece inteira, nunca cortada:** o quadro do cartão virou **quadrado** (121 das 144 fotos são quadradas; 16 em pé, 7 deitadas) e a foto se encaixa nele; a sobra fica **branca** (o fundo das fotos do catálogo), em qualquer tema. No detalhe do produto, a foto grande num quadrado centralizado. As miniaturas das listas também deixaram de cortar.
- **Foto recortada (fundo transparente) sobe com fundo branco** também pela câmera do Estoque (*"Sim, corrige junto"*) — antes saía com fundo preto.

**Como ficou (técnico):** nenhuma mudança no banco. O Tiny manda o link público da foto em `produtos.raw->'anexos'` (o `produto.obter` que o n8n já grava); a carga subiu pelo cliente do app com o dono logado (`enviarFotoProduto` → `plt_fn_estoque_definir_imagem`), redução igual à do app (lado ≤ 1280 px, JPEG 0,82) com **fundo branco** nas 18 fotos recortadas (transparentes). `FotoProduto` passou a `object-contain` sobre branco; o cartão, `aspect-square`; `reduzirImagem` pinta o fundo de branco antes de desenhar.

**Descartadas:** mostrar o link do Tiny direto (a tela dependeria do Tiny no ar); quadro em pé (cortaria as deitadas e deixaria o cartão alto demais para 20+ cartões); manter o corte e só aumentar o quadro (continuaria cortando as em pé).

## D-82 · A foto do Tiny chega sozinha à plataforma — a da câmera fica, a apagada no Tiny também (30/09/2026) — ↪️ D-81

**Pedido do dono (30/09):** *"faça essa parada aí das fotos mudarem quando mudarem no Tiny"*.

**Decidido (respostas do dono em 30/09):**

- **Produto novo com foto no Tiny, ou foto principal trocada no Tiny → a plataforma copia sozinha** (reduzida e com fundo branco, como a câmera; a cópia antiga sai da biblioteca). Tempo: produto novo ~20 min (entra pelo ciclo de 15 min do catálogo); foto trocada num produto que já existe, **na manhã seguinte** — o Tiny não avisa mudança de produto, e a releitura completa do catálogo é de madrugada.
- **A foto posta pela câmera fica** (*"A da câmera fica"*): o Tiny só atualiza as fotos que vieram dele.
- **Foto apagada no Tiny: a plataforma mantém a última** (*"Mantém a última"*).
- **Só a foto principal** (a 1ª do Tiny) vira capa; as outras não são copiadas sozinhas.
- **Nada rodando à toa:** o relógio do banco confere de 5 em 5 minutos, sem custo, e só chama a função do servidor quando há foto para copiar (a lição da migration 43 — o dono não quer execução sem trabalho).
- **Construir, testar e ligar sem nova pergunta** (*"Constrói, testa e liga"*).

**Como ficou (técnico):** migration 44 — `produtos.imagem_tiny` (o link do Tiny da foto copiada; nulo = foto da câmera ou sem foto; as 144 da carga de 30/09 marcadas pelo histórico daquela carga); a câmera (`plt_fn_estoque_definir_imagem`) zera `imagem_tiny`; portas só da chave de serviço (`plt_fn_fotos_tiny_pendentes`, `plt_fn_foto_tiny_definir`, `plt_fn_foto_tiny_falhou`, `plt_fn_fotos_tiny_conferir`); relógio `plt-fotos-tiny` (pg_cron */5) → `plt_privado.fn_fotos_tiny_relogio` → Edge Function **`fotos-tiny`** (verify_jwt desligado; quem chama prova com o segredo guardado em `plt_webhooks`, conferido pelo banco). A função baixa só do armazém do Tiny, reduz com a ImageScript (≤ 1280 px, JPEG 82, fundo branco; WebP sobe como veio), grava em `produtos/{pasta}/tiny-{md5}.{ext}`, até 3 por chamada (limite de CPU). Link que falha espera 24 h (histórico `estoque_foto_tiny_falhou`). **O n8n não foi tocado** — a função lê o que o fluxo do catálogo já grava em `produtos.raw`.

**Descartadas:** ramo no fluxo único do n8n (sem redução de imagem lá e mexeria no fluxo da outra frente); função chamada de 5 em 5 min direto pelo relógio (execução à toa — o dono vetou isso na 43); gatilho na tabela `produtos` (mexeria no caminho de escrita da integração: um erro ali derrubaria o catálogo — A-09); guardar a origem da foto só no nome do arquivo (as 144 de hoje não seriam reconhecidas sem renomear os arquivos).

## D-83 · O Top X manda no estoque: é o tamanho da página e só ele tem mínimo; a capacidade do galpão sai de uso (30/09/2026) — ↩️ revisa a D-71 e a D-72

**Pedido do dono (30/09, demanda "Ajuste Estoque 2"):** o Top X vira configurável (*mínimo 1, máximo 50*), *"X é o tamanho da página"*, e *"retire o botão de quantas peças cabem por enquanto"* (na sessão, com print).

- **Top X (1–50)** é valor único da equipe (logística e admin mudam, com trilha — D-40) e mora na ficha do setor ESTOQUE, como a capacidade e a chave do Tiny. Página 1 = 1º ao Xº do ranking; página 2 = X+1 ao 2X; **a lista é UMA** — o "Ver os outros produtos" morreu (o resto do catálogo está nas páginas seguintes e na busca, que varre tudo).
- **Só os X primeiros têm mínimo** e pedem reposição. Fora do Top X: sem mínimo, sem sugestão, nunca pede. Quem sai do Top X fica com o mínimo **adormecido** (nada se apaga; voltando, vale de novo).
- **A capacidade do galpão sai de uso**: o campo e o encolhimento proporcional da sugestão morreram; a coluna fica guardada, sem uso (o dono não pediu exclusão). Quem limita o estoque é o Top X.
- **O mínimo do Tiny deixa de valer como reserva** nos acabados — vira só referência na linha. Nos insumos nada muda.

**Como ficou (técnico):** migration 45 — configurações na linha do setor `estoque` em `plt_setores` (`top_x`, `cobertura_semanas`, `corte_pedido_grande`), mínimo efetivo dos acabados = `minimo_plataforma` e só dentro do Top X (`fn_minimo_efetivo`), lista única em `plt_fn_estoque_produtos` paginada pelo X.

## D-84 · Sugestão por dias úteis de VENDA (loja seg–sáb) e mínimo AUTOMÁTICO que trava ao editar; corte de pedido fora do comum (30/09/2026) — ↩️ revisa a D-72

**Decidido (demanda + respostas do dono em 30/09):** a loja vende de segunda a sábado; a fábrica funciona de segunda a sexta (resposta 1). Cobertura personalizada de 1 a 8 semanas (resposta 2).

- **Fórmula:** vendidos nos 90 dias ÷ dias úteis de venda decorridos (seg–sáb, ~78) × 6 (os dias úteis de uma semana de venda) × semanas de cobertura (1 · 2 · 3 · personalizada 1–8; padrão 2), **arredondada para cima no fim**. Exemplo conferido com o dono: 96 vendidos → 15 para 2 semanas. Sem tabela de feriados (decisão do dono).
- **Mínimo automático:** acompanha a sugestão sozinho — recalcula ao trocar cobertura/Top X/corte e 1×/dia de madrugada (a janela dos 90 dias anda todo dia). **Editar à mão TRAVA** naquele valor até "voltar ao automático". O "Usar todas as sugestões" morreu. Os mínimos definidos antes desta decisão entraram no automático (editar de novo trava).
- **Corte de pedido fora do comum:** linha de pedido com MAIS unidades que o corte (padrão 10; Painel admin, só admin, com trilha) sai da conta de vendas — **do ranking E da sugestão** — como se o pedido não existisse. O pedido de 23 closets sai. O cartão avisa discreto: "1 pedido grande fora da conta".

**Como ficou (técnico):** migration 45 — `fn_vendas_90d` aplica o corte na fonte (regra única), `fn_sugestoes_minimo` por dias úteis, `produtos.minimo_travado`, `fn_recalcular_minimos` (cron diário `plt-estoque-minimos` + nas trocas de configuração).

## D-85 · Reposição parada 2 dias úteis da FÁBRICA (seg–sex) no PCP sai sozinha — o Sistema assina; parcial vence só a parte parada (30/09/2026) — ↪️ a segunda saída, ao lado do "estoque coberto" da D-76

**Decidido (demanda + resposta 7 do dono):** se em 2 dias úteis o que está no PCP não sair para a produção, a parte parada sai do PCP e deixa de contar como reservada — vale igual para a reposição lançada à mão.

- **O prazo:** vence à meia-noite (de Fortaleza) depois do 2º dia útil da fábrica (seg–sex) seguinte à criação — criada na segunda vence quinta 00:00; criada na sexta ou no sábado, o fim de semana não conta. Sem feriados.
- **Parcial:** o que já entrou na produção segue produzindo e contando; só a parte parada vence. A saída é por **evento** (origem da integração, sem pessoa — o Sistema assina), nada se apaga.
- **Depois de vencida, a necessidade volta sozinha** — sem exigir movimento novo do estoque (diferente do "Não produzir" do PCP, que continua exigindo).
- **Dupla garantia:** as contas da tela já ignoram a parte vencida na hora; uma rotina leve de hora em hora (`plt-estoque-vencimentos`) faz a saída oficial. A rotina é **independente** do liga/desliga da reposição automática (a manual também vence).

## D-86 · Reservados: o cartão mostra TUDO que está em produção; a NECESSIDADE conta só o que vem para o estoque; reservados em venda é um número só; a bolinha vermelha leva à decisão do PCP (30/09/2026)

**Decidido (respostas 3, 5 e 6 do dono em 30/09):**

- **Reservados para produção (o número do cartão)** = a reposição parada no PCP (dentro do prazo) + TODAS as unidades em produção — as sem dono a caminho do estoque (inclusive peça de pedido cancelado — resposta 3) **e os móveis de pedidos** (o exemplo do dono: PCP recusou a peça do estoque e mandou produzir → "1 reservado para produção"). Aparece para todo produto, mesmo fora do Top X.
- **A conta da NECESSIDADE** (`em estoque + reservados < mínimo`) usa só o que **vem para o estoque** — móvel de pedido sai com o pedido, não abastece o galpão.
- **Reservados em venda é UM número** (resposta 6): as peças prontas separadas para pedidos — reservadas no galpão + em Pedidos em aguardo.
- **A bolinha vermelha** no canto do cartão: pedido esperando a decisão do PCP (peça reservada pela venda, pedido ainda não liberado). Tocar **leva direto à decisão** na tela do PCP.
- **O filtro do topo tem 4 posições:** Todos · Necessidade de produção · Reservados para produção · **Com estoque** (novo, resposta 5). A ordem é sempre pela venda; a busca varre o catálogo inteiro.

**Como ficou (técnico):** migration 45 — regra única em `fn_reservados_producao` (para_estoque × exibição), filtros e a bolinha (`pendente_card_id`) em `plt_fn_estoque_produtos`; no PCP, `?liberar=<card>` abre a decisão com uma busca própria página a página no servidor (modal por derivação, sem estado intermediário).

## D-87 · Liga/desliga da reposição automática no Painel admin = agendar/desagendar a rotina de verdade; desligada, a logística tem o "Lançar para produção" (30/09/2026) — ↪️ o fluxo da reposição da D-54

**Decidido (demanda + resposta 4 do dono):**

- O botão (Painel admin → **Estoque**, só admin) **agenda e desagenda o job no relógio do banco**: desligada, a rotina NÃO existe — nenhuma consulta, nenhuma execução à toa (a lição da migration 43). A situação que a tela mostra é o próprio relógio (o job existe?).
- **Com a automática desligada**, o cartão em necessidade ganha o **"Lançar para produção"**: a logística cria a reposição no PCP à mão (gesto com autor e trilha), quantidade proposta = mínimo − estoque − o que já vem para o estoque, editável. **Com ela ligada, o botão some** (resposta 4: *"não faz nem sentido aparecer"*).
- A automática agora **desconta o que já vem para o estoque** na conta e no tamanho do card (antes não descontava a produção em andamento).
- **Entregue DESLIGADA** — só liga depois da contagem inicial da logística (senão todo o Top X pede reposição de uma vez). ↪️ **01/10 (D-90):** ligar ou não é escolha da operação, não pendência do dono.

## D-88 · O PCP em três abas: Reabastecimento · Pedidos aguardando liberação · Todos os pedidos; Cancelados vira tela da Logística (30/09/2026) — ↪️ D-86/D-62, ↩️ revisa a aba Cancelados da D-61

**Pedido do dono (30/09, no teste ao vivo):** *"Dentro de PCP, coloque uma nova aí para solicitação de estoque, pedidos aguardando liberação, todos os pedidos. Cancelados deve sair de PCP e virar rota filha de logística"* — gatilho: ele lançou reabastecimentos à mão e **não os viu** (o quadro ordena do mais antigo e pagina de 10 em 10: caíram na última página). Depois, pelo print: *"ao invés de solicitação de estoque, mude para reabastecimento"*.

- **Reabastecimento** (1ª aba): só os cards de reposição, na hora — sem se perder atrás dos pedidos.
- **Pedidos aguardando liberação**: o quadro de sempre, agora só com pedidos; cada card ganha o **selo verde "N peças no estoque — dá para usar"** quando o galpão atende o pedido (reservadas p/ ele + livres de mesmo SKU — a régua da D-62; migration 48).
- **Todos os pedidos**: a lista completa da integração (5.400+), com busca, pela porta de resumo que já existia; **pedido ENTREGUE mostra tudo liberado** (conclusão visual — o número real segue nas outras telas) e cada linha tem a **bolinha de cor da situação do Tiny** + o texto (M-12). O **olhinho** abre o detalhe de PRODUÇÃO (itens em unidades, onde está cada unidade, situação, prevista) — **busca só ao abrir e esquece ao fechar** (nada no cache).
- **Cancelados** saiu do PCP e virou **Fábrica → Logística → Cancelados** (mesma porta e tela; link antigo redireciona).
- A seção **"Unidades no PCP" morreu** (*"não sei nem pra que serve isso, remova"*) e a **paginação virou rolagem** nas três listas.
- **O "i" no lugar do texto vira o PADRÃO**: todo texto informativo de tela encostada daqui em diante vira o balão (↪️ D-74 vale para a casa toda).

**Como ficou (técnico):** migration 47 (`p_grupo` na porta do quadro — nulo = tudo, o painel D-75 continua batendo; drop das assinaturas antigas, A-12) + migration 48 (`pecas_estoque` na mesma porta, conta por página — regra 17). O quadro parado com pedido já entregue no Tiny é o aviso que o Tiny NÃO mandou (P17) — conferido no banco: não há status mais novo guardado; a correção de raiz é a [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] (recomendada como próxima), e qualquer salvamento do pedido no Tiny reenvia o aviso e o tira do quadro na hora.

## D-89 · A lapidação ao vivo do Estoque (30/09/2026) — ↪️ D-83/D-84/D-87; ↩️ ajusta o lugar do Top X e do quadro Tiny

**Rodadas do dono no teste logado (30/09), cada uma conferida na tela na hora:**

- **Filtro do topo na MESMA linha da busca** (em tela estreita ele desce em linha corrida, sem empilhar).
- **Top X mudou para o Painel admin → Estoque**, com a bolinha "i" ao lado (1ª rodada o pôs nas Configurações; a 2ª o levou ao admin). A **cobertura e os mínimos ficam** com a logística, nas Configurações do Estoque.
- **O quadro do Tiny (sincronismo + reservas presas + liga/desliga) também foi para o Painel admin → Estoque** — ⚠️ consequência dita ao dono: a logística deixa de ver a situação do sincronismo (devolver a visão sem botões é ajuste pequeno, se um dia quiser).
- **Galpão e Tiny viraram cartões RECOLHÍVEIS** (Galpão fechado por padrão; o do Tiny mantém o "Ligado desde" visível fechado).
- **O botão "Lançar para produção" virou o ícone vermelho pequeno PULANDO** ao lado do mínimo, só no cartão em necessidade com a automática desligada — tocar abre o lançamento (quantidade proposta do servidor). O botão por extenso morreu.
- **A câmera de trocar foto saiu do cartão** — só no detalhe do produto.
- **O "sugerido do Tiny" aparece ao lado do mínimo** de cada produto nas Configurações, só informativo.
- O balão do "i" **ancora na linha inteira**, nunca no ícone (ancorado no ícone, o texto sai espremido numa coluna).

## D-74 · Estoque enxuto: "i" no lugar do texto, abas em quadrados no canto superior direito, cartão com a foto em destaque (28/09/2026) — ↪️ D-27

**Decidido (pedido do dono, 28/09):** *"esse texto abaixo do nome estoque, troque por um ícone i de informativo e deixe apenas o balãozinho … a troca entre abas do estoque, deixe no extremo canto superior direito em quadrados que integram ao passar do mouse"*; *"ficou muito ruim essa visualização de produto, está muito poluído, deixe mais enxuto com valores menores"*.

- O texto explicativo sob o título virou o **ícone "i" com balão** (abre ao passar o mouse, focar ou tocar). Embaixo do título fica só onde a pessoa está ("Top 20+ · os mais vendidos primeiro").
- As abas viraram **quadrados só com ícone, no canto superior direito**, que sobem ao passar o mouse e mostram o nome num balãozinho (variante do componente de abas — não é componente novo).
- **Cartão do produto enxuto:** foto em cima (com o rank), nome, SKU e vendas, o número do estoque, o mínimo, o sinal (ícone + texto — "Sem estoque", "Faltam N para o mínimo", "No mínimo") e os dois gestos (Entrada/Baixa). Peças, referência do Tiny e contagem ficam no detalhe.

## D-75 · O quadrinho do PCP na Visão do dia conta o que o quadro do PCP mostra — reposição inclusa; "liberadas hoje" fica como está (28/09/2026) — ↪️ ajusta o painel da SESSAO-16 (D-42)

**Contexto (achado do ajuste do Frete, conferido só com leitura no banco real):** a Visão do dia dizia **233 "a liberar"** e o quadro do PCP mostrava **33**. Desde a SESSAO-23 o quadro esconde o pedido que o Tiny já encerrou (entregue, não entregue, cancelado); o painel da SESSAO-16 nunca acompanhou — só tirava o cancelado. Dos 233, **200 estavam "Entregue" no Tiny**; os 33 restantes eram exatamente os do quadro. No mesmo quadrinho, a "mais antiga" olhava também pedido entregue e pedido já liberado por inteiro (31 dias × 27 do quadro) e o "liberadas hoje" somava a entrada manual no ESTOQUE (8 das 12 do dia).

**Decidido (respostas do dono em 28/09):**

- **"A liberar" = o que o quadro do PCP mostra** (*"Sim, igual ao quadro"*): pedido vivo no Tiny com peça por liberar (o frete não é peça — D-63).
- **A "mais antiga" também** passa a ser a do quadro (escolhida no mesmo quadrinho).
- **Os cards de reposição contam** no "a liberar", como o quadro já mostra (*"Sim, conta junto"*) — hoje não há nenhum (a reposição automática segue desligada).
- **"Liberadas hoje" fica como está** — o dono não escolheu mudar: segue contando toda peça criada no dia, inclusive o cadastro direto no ESTOQUE (D-70). Mudar é decisão nova aqui.

**Como ficou (técnico):** migration 41 — `plt_fn_dash_pcp_dia` recriada a partir da versão da 39 (E-24), com o mesmo filtro de `plt_fn_cards_pedido_pcp` (sem o gate por pessoa; o painel mantém o dele). A coluna segue `pedidos_a_liberar` (mesma forma — a tela não mudou). O harness amarra painel = quadro: quem mudar a regra de um sem a do outro fica vermelho.

**Descartadas:** manter a conta própria do painel (foi ela que se separou do quadro em silêncio); juntar as duas numa regra única compartilhada agora (mexeria no quadro, sem ganho hoje — o teste já amarra os dois).

## D-76 · O Tiny sobe a plataforma: vale o saldo SOMADO das duas empresas; Tiny acima → a plataforma sobe até ele; abaixo → nada (30/09/2026) — ↪️ D-70

**Contexto (29/09, vídeo do Guilherme — líder da logística):** ele fez o balanço no Tiny e a plataforma não mudou. Diagnóstico só de leitura: desde a D-70 o número dos acabados é a contagem da plataforma; e o aviso de estoque do Tiny da fábrica só enxerga o depósito **Geral da FÁBRICA**, enquanto o "multiempresa" que a equipe olha é a soma de quatro depósitos de duas empresas (**FábricaDomoby/Geral** + **lojadomoby/Fábrica · Loja · Desmontado**). As peças prontas estão no depósito "Fábrica" da empresa da loja (174: Geral 0 + 3 lá = os 3 da tela). O "reservado" do Tiny não serve (345: 47 no Tiny × 2 em pedidos abertos) — vale o **saldo**.

**Decidido (dono, 29–30/09):** *"a ideia futura é deixar que a plataforma seja o centro … mas eles irão usar o tiny por bastante tempo ainda"*; *"quando for cadastrado um produto no estoque do tiny, vai disparar pra gente aqui e a lógica deve conferir a quantidade a partir do sku"*; *"eles só olham o saldo multiempresa"*.

- Cada aviso de estoque (da conta da fábrica **ou da loja** — a loja é achada pelo SKU, os ids não casam entre contas, A-22) põe o produto numa fila; o n8n lê o **saldo somado** (`produto.obter.estoque` da fábrica) e devolve à plataforma.
- **Tiny acima** do que está no galpão pela plataforma (livres + reservadas para venda) → a plataforma **sobe até o Tiny** (peças novas, motivo "entrou pelo Tiny", origem da integração). **Abaixo → nada** (a saída se dá pela plataforma — D-77). Negativo no Tiny = 0 no galpão (D-53).
- **"Sobe até", não "soma a diferença"** (decidido pelo Claude, avisado ao dono): o aviso traz só o saldo final; somar diferenças transforma correção de balanço em peça (o −7 → 0 do 327 viraria 7 peças).
- Com o mínimo coberto, a **reposição que ainda está no PCP sem nada liberado é arquivada sozinha** (o exemplo do dono: *"removeria os dois cards de necessidade de produção que provavelmente ainda vão estar em pcp"*). Liberada em parte fica com o PCP.
- Toda madrugada (04:00) todos os acabados são relidos — rede de segurança para aviso perdido.

**Descartadas:** somar a diferença entre avisos (lixo com balanço); usar o "disponível" do Tiny (o reservado dele não bate com os pedidos); ler só o depósito da fábrica (não é o número que a equipe vê).

**↪️ 30/09/2026 (manhã) — a lista das reservas presas (pedido do dono, depois do conflito do 567):** a equipe trabalha pelo **"disponível multiempresa"** do Tiny, que é saldo − reservado — e o reservado do Tiny guarda reserva de pedido que já saiu (567: saldo 2, reservado 23, nenhum pedido aberto → −21 no Tiny × 2 aqui). O dono perguntou se dava para puxar o multiempresa; resposta: **o número daqui continua o saldo** (puxar o disponível traria o erro das reservas junto). Escolha do dono: *"Lista das reservas presas"* — em Configurações → Tiny, por móvel, **o que o Tiny reserva × as unidades de pedidos ainda abertos**, do maior para o menor, para a equipe **limpar no Tiny** (aba de reservas do produto: tirar as de pedidos entregues ou cancelados). Serviços do Tiny (Corte, Furo, Fitamento — milhares de "reservas") e itens sem SKU ficam fora. **Quem arruma o quê:** reserva presa → **no Tiny** (a plataforma não mexe em reserva de lá); peça que entra, sai ou é contada → **na plataforma** (vai sozinha ao Tiny — D-77). 1ª leitura real: **111 móveis, 814 unidades presas** (345: 45 · 323: 30 · 419: 28 · 193: 24 · 567: 23). Migration 46; RF-108 ↪️.

## D-77 · A plataforma manda no Tiny: entrada, baixa e contagem daqui deixam o Tiny com o número da plataforma; a produção que chega ao estoque também (30/09/2026)

**Decidido (dono, 29/09):** *"deixe que os botões de dar baixa, entrada e contagem continuem na plataforma, porém eles funcionam como gatilho para atualizar o tiny … demos entrada em estoque de 4 penteadeiras, no tiny estava −2 … ela avisa para o tiny ficar com 4"*; resposta de 30/09 — produção que chega ao estoque: **"a plataforma avisa sozinha"** (a equipe para de lançar no Tiny); saída feita direto no Tiny (avaria, correção): **ignorar — a baixa se dá só pela plataforma**.

- **O Tiny fica com o número da plataforma** (as peças livres — o da tela), por produto, depois de: entrada, baixa, contagem (até a conferida), arquivar peça livre, peça que chega ao / sai do ESTOQUE (produção, cancelamento), peça livre usada num pedido, e o PCP mandar produzir a unidade que tinha peça reservada (D-78).
- **Não vão ao Tiny:** o que veio do Tiny, a venda (reserva e consumo — o Tiny já baixa sozinho), a reserva desfeita por cancelamento ou pedido alterado (o Tiny devolve sozinho) e a peça reservada usada no próprio pedido.
- **Onde grava** (decidido pelo Claude, avisado ao dono): balanço no depósito **"Fábrica" da empresa da loja** (onde as peças prontas estão e onde a venda baixa), pela conta da loja; sem ele, no **Geral** da fábrica. A **soma** das duas empresas fica igual à plataforma. Balanço porque é repetível sem dobrar; se ficaria negativo, saída da diferença.
- Uma fila por produto junta vários movimentos seguidos num pedido só ao Tiny (limite de 60 consultas/min da conta). 5 falhas seguidas → o produto para e aparece em Configurações do Estoque; um movimento novo destrava.

**Descartadas:** empurrar cada movimento como entrada/saída relativa (não se conserta sozinho e dobraria em repetição); aceitar as quedas do Tiny (o aviso não diz se foi venda ou avaria — descontaria a venda duas vezes).

## D-78 · A venda reserva a peça na hora; o pedido segue no PCP, que decide; nada da venda vai ao Tiny (30/09/2026) — ↪️ D-62 e D-70

**Decidido (dono, 29–30/09):** *"sempre que um pedido de venda for gerado com o produto daquele sku, a plataforma deve ver e diminuir menos 1 do estoque, isso não deve disparar nada para o tiny"*; e, na pergunta sobre reservar ou só baixar: *"a peça é reservada no estoque para atualizar em tempo real, mas deve aparecer no pcp ainda para ele liberar, se ele não liberar, a peça volta para o estoque e manda o tiny somar mais 1 lá também, o pcp decide a produção completa"*.

- Pedido **novo** da loja (chegou depois de ligar o sincronismo), em aberto/aprovado/preparando envio: cada unidade de produto acabado do catálogo **reserva uma peça livre igual** (a mais antiga) — o número do estoque cai na hora e a peça aparece como "reservada para o pedido N". Uma vez só, na chegada da venda (a peça que entra depois não é reservada para pedido antigo). Frete não reserva (D-63); personalizado não (D-55).
- No **PCP**, a unidade vem com a peça reservada **já marcada** para usar (↪️ D-62, que vinha desmarcada). Usar → a unidade nasce pronta em Pedidos em aguardo (nada ao Tiny). **Desmarcar e liberar para a produção** → a reserva se desfaz, a peça volta livre e o Tiny recebe de volta (D-77).
- **Cancelado** → a reserva se desfaz (sem Tiny). **Item mudou/saiu** → desfaz. **Faturado / pronto para envio / enviado / entregue / não entregue** → a peça saiu com o pedido (baixa "venda", sem Tiny).
- Contagem é **física**: conta as reservadas que ainda estão no galpão; contar menos que elas é recusado.
- Só a plataforma reserva (vale até para a chave de serviço). Depois de cada venda, uma leitura do Tiny só para conferir.

## D-79 · Ponto de partida: ligar copia uma vez o saldo do Tiny; tudo nasce desligado e só o admin liga (30/09/2026)

**Decidido (dono, 30/09):** *"Copiar o Tiny uma vez"* (o balanço do Guilherme vira a contagem inicial; as 2 peças do 327 lançadas pelo dono passam a valer o número do Tiny).

- A chave mora no ESTOQUE (Configurações → Tiny): **Ligar** (só admin) copia, produto a produto, o saldo somado do Tiny para a plataforma — **nos dois sentidos** (o que estiver diferente fica igual ao Tiny). Depois disso vale a D-76/D-77/D-78. **Desligar** para tudo (as reservas que já existem seguem acompanhando o pedido).
- A venda que chegou **antes** de ligar não reserva (ela já está no saldo copiado do Tiny).

## D-80 · Um fluxo só no n8n para o Tiny da fábrica (catálogo + estoque); a carga avulsa do saldo morre (30/09/2026)

**Decidido (dono, 30/09):** *"eu não quero vários fluxos para a mesma coisa, quero 1 único que faz o trabalho completinho sem erro"*.

- O workflow do Tiny da FÁBRICA vira **"Domoby · Tiny FÁBRICA → produtos e estoque (fluxo único)"**: o catálogo segue igual (a cada 15 min + varredura 03:15); o aviso de estoque (mesmo endereço — da fábrica e da loja) chama a plataforma; a cada minuto a fila lê o Tiny e grava o ajuste; às 04:00 a varredura do estoque. O workflow "carga do saldo (rodar 1×)" **sai** (a varredura faz o papel dele).
- O aviso de estoque deixa de disparar a releitura do cadastro (o produto novo entra pelo ciclo de 15 min).
- O n8n guarda só as execuções com erro (a fila roda a cada minuto); o que foi feito fica na plataforma (trilha + Configurações → Tiny).

**↪️ 30/09/2026 (mesma madrugada) — sob demanda, sem relógio no n8n:** o dono, vendo o gatilho de 1 em 1 minuto: *"você não tá nem doido de deixar alguma coisa rodando no meu n8n a cada 1 minuto para requisitar várias coisas, calma paizão, melhora isso daí"*. Decidido: **o n8n não tem relógio para o estoque.** Quem chama o fluxo é o relógio INTERNO do banco (o mesmo da reserva da venda), e só quando o sincronismo está ligado, há produto esperando na fila e nenhum lote está em andamento — fila vazia não gera execução no n8n nem consulta ao Tiny. A varredura das 04:00 também passou para o banco. No n8n sobram só os relógios do catálogo que já existiam (15 min e 03:15). Técnico: migration 43.

## D-90 · Reposição automática é escolha da operação, não pendência do dono (01/10/2026) — ↪️ D-87

**Decidido (revisão das pendências com o dono no Cowork, 01/10):** ligar ou não a reposição automática **não é decisão pendente** — é um modo de trabalho. A logística escolhe entre deixar a automática lançar para a produção sozinha ou lançar ela mesma pelo botão **"Lançar para produção"** do cartão. O mecanismo da D-87 fica como está (o liga/desliga vive no Painel admin → Estoque; o admin liga quando a logística pedir). A frase "só liga depois da contagem inicial" da D-87 vira cuidado operacional, não pendência.

## D-91 · Três tipos de usuário — da fábrica, do comercial e dos dois — com permissões bem definidas; o dashboard do Comercial fica no Comercial (01/10/2026) — ↪️ D-46

**Decidido (respostas do dono às Q-66 e Q-68, 01/10):**

- Depois do admin, quem ganha o módulo `comercial` é o **usuário do comercial**. A plataforma separa **usuário da fábrica**, **usuário do comercial** e **usuário dos dois**, e as permissões de cada um precisam ser **bem definidas** (o desenho fino nasce numa demanda própria).
- O **dashboard do Comercial fica dentro do Comercial** (`/comercial/dashboard`), por enquanto. Renomear os filhos do pai Dashboards por domínio **não é pendência**.

## D-92 · Automações: só admin cria, por ora; o módulo é o laboratório (01/10/2026) — ↪️ SESSAO-27

**↪️ 01/10 (D-99/D-100):** na própria SESSAO-27 o dono afinou: só o **super admin** (ele) monta e liga — o canvas mora no Painel super admin.

**Decidido (respostas do dono às Q-40 e Q-41, 01/10):** **só o admin cria automações** por enquanto (revisar depois). O dono **não tem automações definidas** — o módulo da [[SESSAO-27 - Automacoes em Canvas]] existe justamente para **testá-las** e descobrir as que valem. A SESSAO-27 não espera uma lista de automações para começar.

## D-93 · O endereço do cliente que o Tiny manda é o endereço de entrega das ROTAS (01/10/2026) — ↪️ D-39

**Decidido (resposta do dono à Q-65, 01/10):** as ROTAS entregam no **endereço do cliente que vem do Tiny** — é ele que a geocodificação e a [[SESSAO-28 - Rota Calculada no Mapa]] usam. Não existe outra fonte de endereço de entrega.

## D-94 · Bonificação descartada (01/10/2026) — ↩️ encerra o tema da D-04

**Decidido (01/10):** o dono mandou **esquecer a bonificação**. As perguntas Q-10, Q-11, Q-12 e Q-14 saem da lista; a medição segue servindo à alavancagem operacional (D-04 revisada), sem ponto nem ranking de prêmio.

## D-95 · Auditoria no Painel admin: o rastro de tudo — quem, quando, onde, o quê e porquê (01/10/2026) — ↪️ D-40

**Pedido do dono (respostas da [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]]):** *"Crie uma página de auditoria dentro do painel admin; lá dentro iremos colocar para mapear os erros do n8n também futuramente; dentro dessa auditoria deve aparecer log de tudo — execução, visualização, clique de entrada, movimentações e coisas do tipo; deve salvar o rastro de quem, quando, onde, porquê, o quê e por aí vai."*

- **Painel admin → Auditoria** (`/admin/auditoria`, só admin) com duas abas: **Atividade** (a trilha que a D-40 grava desde a SESSAO-13 — entradas e saídas, telas abertas, movimentações, execuções, qualidade, pedidos vindos do Tiny, estoque, ROTAS, tarefas, cadastros, chat sem as mensagens, avisos) e **Conferências com o Tiny** (a conferência diária da SESSAO-29: a rodada em andamento e o histórico, com os pedidos que estavam diferentes e o quê).
- Cada linha diz **o quê** (frase de gente, nunca o código), **quem** (o nome; "Sistema" quando é automático), **quando**, **onde** (a tela, ou os setores/etapas de origem → destino) e **por quê** (a observação do gesto ou o motivo, quando há). Detalhes sem ids. Busca pelo nº do pedido acha o que aconteceu com os cards dele.
- Filtros no servidor (pessoa, tipo, período, busca) e uma página por vez (regra 17). A saída da plataforma passou a entrar na trilha.
- **Tarefa pessoal privada (D-51) não aparece nem para o admin** — a trilha existe no banco, mas a auditoria a esconde de quem não a criou.
- **Os erros do n8n** entram na aba das conferências numa próxima etapa (o dono avisou que vêm "futuramente").
- Decidido pelo Claude (o dono pode mudar): o período abre em "Últimos 7 dias"; 30 linhas por página; nenhuma tabela nova (D-47) — só duas portas de leitura.

**Como ficou (técnico):** migration 50 — `plt_fn_auditoria` (trilha paginada com filtros, já traduzida: nome, pedido do card, setores/etapas, motivo; tarefa privada fora) e `plt_fn_auditoria_conferencias`; tela `src/paginas/Auditoria.tsx`; `ProvedorSessao.sair` registra `saiu`.

## D-96 · O pedido vivo que só a conferência achou entra no PCP (01/10/2026) — ↪️ a blindagem da carga histórica

**Decidido (resposta 3 do dono — "Pode ser"):** o pedido que o aviso do Tiny nunca trouxe e a conferência diária achou entra no quadro do PCP **como se tivesse chegado pelo aviso**, se ainda não foi entregue nem cancelado. Encerrado (entregue, não entregue, cancelado) entra só no banco. Nos 5.360 pedidos conferidos em 22/09 isso nunca tinha acontecido — é rede de segurança. **Técnico:** origem nova `pente_fino` em `pedidos`, aceita pela guarda do gatilho de inserção (migration 49); a carga histórica (`backfill`) segue fora.

## D-97 · O nome do cliente é gravado sem o código no lugar do apóstrofo (01/10/2026)

**Decidido (resposta 4 do dono — "Corrija"):** o Tiny guarda alguns nomes com o código da página no lugar de caracteres ("D&#39;Elia" em vez de "D'Elia" — 1 caso em 5.440). A plataforma grava o **nome do cliente já corrigido** (e o existente foi corrigido uma vez). A cópia crua do pedido segue igual à do Tiny (é ela que a conferência compara). ⚠️ O módulo Comercial mostra o nome da cópia crua do pedido — lá o caso único continua como o Tiny guarda.

## D-98 · O cliente é achado pelo cadastro do Tiny; o fluxo de vendas passa esse número (01/10/2026) — item C da SESSAO-29

**Achado (só leitura, 01/10):** o pedido que o Tiny devolve (`pedido.obter`) **não traz o número do cadastro do cliente** — só nome, CPF, telefone e endereço; o número só vem no **aviso de venda**, e o fluxo de vendas do n8n o descartava. E o nome que vem no pedido é o **atual** do cadastro (4.932 de 4.932 pedidos da carga histórica batem com o cadastro).

**Decidido:** o cliente do pedido é achado nesta ordem — **1)** o número do cadastro do Tiny (quando o aviso traz); **2)** o CPF/CNPJ; **3)** o cliente que o pedido **já tem**, quando nada prova que é outra pessoa (sem CPF dos dois lados e sem número de cadastro que contradiga) — é o contato renomeado no Tiny; **4)** nome + telefone; **5)** cliente novo. O CPF nunca é copiado para um cliente se já pertence a outro. Resposta 1 do dono sobre a mudança no fluxo de vendas: *"Você gera para mim e eu edito o fluxo"* — o passo a passo está no handoff; **o banco já aceita o número** (sem ele, os passos 2–5 seguem valendo).

**Consequência:** reprocessar um pedido de cliente sem CPF renomeado no Tiny não cria mais cliente duplicado; um pedido **novo** desse cliente só deixa de duplicar quando o fluxo de vendas passar o número do cadastro.

## D-99 · A automação pode mover o card sozinha — e serve "para tudo"; quem monta e liga é só o super admin (01/10/2026) — ↩️ revisa a D-03, ↪️ D-92

**Decidido (resposta 1 do dono no início da [[SESSAO-27 - Automacoes em Canvas]]):** *"A automação em canvas deve ser para tudo, comercial, api, pedidos, e só eu vou construir essas coisas, então eu vou saber quando ligar"*.

- ↩️ **D-03:** mover o card automaticamente por gatilho **passa a existir** — com o freio de que a automação é montada por humano (o super admin — D-100) e **nasce desligada** (garantido no banco, para todo escritor — M-14).
- **"Para tudo":** o canvas não se limita à produção — tem gatilhos de card, de pedido do Tiny e de chamada de fora (n8n/API), e ações de card, de pedido, de aviso e de saída para fora (catálogo na D-103). O comercial entra pelos gatilhos de pedido + "chamar endereço de fora" (ex.: pedido entregue → n8n → DataCrazy); um bloco próprio de campanha só quando o dono pedir.
- **Sem as travas extras que o Claude propôs** (só setores de produção, só peças): a automação vale para qualquer setor e card, mas **obedece às mesmas regras de uma pessoa** (D-103).

## D-100 · O "Painel admin" vira Configurações; nasce o Painel super admin (só o dono): Automações e Auditoria; a engrenagem do rodapé vira o seletor de tema (01/10/2026) — ↪️ D-36, D-46, D-95

**Decidido (pedido do dono, mesma conversa):** *"Esse canvas será para apenas super admin … o atual painel admin será as configurações; na parte de baixo, o símbolo de configurações será agora um símbolo de tema para escolher o tema com um campinho pequeno de select; as configurações atuais e o meu perfil são a mesma coisa, não faz muito sentido; o painel admin vira configurações e a partir de hoje é criado um painel de super admin que só o meu usuário tem permissão de acessar, por enquanto, dentro dele deve ficar a auditoria e o canvas"*.

- **Configurações** (`/configuracoes/*`) = o antigo Painel admin, com tudo o que tinha (menos a Auditoria) + **Utilitários** (D-101). As rotas antigas `/admin/*` redirecionam (bookmark não quebra) — lei D-36 (rota = hierarquia).
- **Super admin** (`/super-admin/*`): **Automações** e **Auditoria**. Só o dono por enquanto: marca `super_admin` no cadastro, posta por SQL (nenhuma tela dá ou tira); o banco confere (`fn_eh_super_admin`) em todas as portas das automações e da Auditoria — e a trilha inteira (`plt_logs_atividade`) passou a ser lida só pelo super admin (cada um segue lendo a própria). ↪️ D-95: a Auditoria era "só admin".
- **Rodapé do menu:** a engrenagem (que abria o Meu Perfil, igual ao bloco do usuário) virou o **ícone de tema** com o seletor pequeno — aplica na hora e guarda no perfil. O Meu Perfil segue abrindo pelo bloco do usuário.

## D-101 · Utilitários: etiquetas (várias por card, só a automação põe e tira) e campos customizados (peças e pedidos; automação e admin preenchem) (01/10/2026)

**Decidido (respostas 2 e 3 do dono e as escolhas de 01/10):** *"Crie uma aba na página de admin chamada Utilitários, lá dentro coloque para cadastrar etiquetas e campos customizados"*; etiquetas *"quantas eu quiser colocar, para tirar deve ter o nó de remover etiquetas"*; campos **nas peças, no card do pedido e nos pedidos**, preenchidos **pela automação e pelo admin**.

- **Configurações → Utilitários** (só admin), em abas: **Etiquetas** (nome + uma de 6 cores da paleta das etiquetas — sem verde/âmbar/vermelho da qualidade nem o amarelo da ação) e **Campos customizados** (texto, número, data, lista de opções, sim/não; valem nas peças, nos pedidos ou nos dois). Usado não se exclui — arquiva (a história fica).
- **Etiquetas no card:** várias; quem põe e tira são os blocos "pôr etiqueta" / "tirar etiqueta" (o admin também pode pelo banco). Vínculo por **evento com projeção** (M-13): `etiqueta_adicionada`/`etiqueta_removida` → `plt_cards.etiquetas`. Aparecem no quadro, no tablet e no card do pedido do PCP — ícone + nome + cor (M-12).
- **"No card do pedido" e "no pedido" são o MESMO valor** (decidido pelo Claude, dito ao dono): um pedido tem um card só no PCP; o valor é guardado pelo pedido — alcança até pedido antigo sem card. Na peça, o valor é da peça. Aparece no card (até 3), no histórico do card (todos, com edição à mão do admin), no card do pedido no PCP e no detalhe do pedido em "Todos os pedidos". A história do valor (quem, antes → depois) vai para a trilha.

## D-102 · "Trazer de volta" um card arquivado — bloco da automação e botão do admin (01/10/2026)

**Decidido (resposta 4 do dono):** *"Sim, a automação deve ter um nó de trazer de volta também"*.

- Evento novo `card_desarquivado` (o arquivar deixa de ser só ida): o card volta para onde estava (o arquivamento nunca mudou a posição). A peça livre que volta ao ESTOQUE volta a contar no Tiny (D-77).
- **Bloco "Trazer de volta"** no canvas (com o gatilho "O card foi arquivado") e **botão "Trazer de volta"** no histórico das execuções, onde uma automação arquivou (o admin desfaz à mão).

## D-103 · As regras do motor: na hora, no banco, nunca derruba o gesto; cadeia até 5; obedece às regras de uma pessoa; o catálogo de blocos (01/10/2026)

**Decidido pelo Claude, apresentado ao dono e aceito ("pode fazer"):**

- **Roda no banco, na hora:** um gatilho ADIADO sobre os eventos dispara no fechamento do gesto (depois de tudo o que o gesto gravou — A-47); outro sobre a situação do pedido. Sem fila, sem relógio rodando à toa, nada no n8n. **Falha de automação nunca desfaz o gesto da pessoa nem a gravação do Tiny** — vira registro.
- **Cadeia limitada:** automação que dispara outra (que dispara outra…) para em **5**; a 6ª fica "barrada no limite" no histórico. Disjuntor extra: 50 execuções no mesmo gesto.
- **Obedece às regras de uma pessoa:** ESTOQUE só peça 🟢 e sem dono; Pedidos em aguardo só peça de pedido vivo; **o card do pedido não sai do PCP** (vira peças pela liberação); **para as ROTAS só pelo "Lançar para ROTAS"**; etapa que "manda para" outro setor leva o card até lá (como no arrasto). Se a regra recusar, o histórico diz por quê. Mover tira o tempo de quem estava trabalhando (regra de sempre do mover).
- **Só vale para o que acontecer depois de ligar.** O "parado há" conta desde a chegada ou desde que a automação foi ligada — o que for mais novo (ligar não dispara em massa); dispara uma vez por permanência.
- **Toda execução registrada:** o que disparou (card/pedido), a condição avaliada ("o card entrou e continua na etapa" / "já tinha saído"), cada passo com o resultado e o porquê — na tela das automações (paginado) e na Auditoria. Os gestos da automação aparecem como "Automático", com o nome dela como o porquê.
- **Catálogo — QUANDO:** o card entrou numa etapa (ou em qualquer etapa do setor) · alguém começou a trabalhar no card · a peça foi marcada (perfeito/atenção/danificado) · o card ficou parado N horas/dias · o card foi arquivado · etiqueta posta · etiqueta tirada · pedido novo do Tiny · o pedido mudou de situação (de → para) · chamada de fora (n8n/API, pela chave da API). **FAÇA:** só se… (etiqueta, campo, setor, situação do pedido, tipo do card) · mover · pôr etiqueta · tirar etiqueta (ou todas) · preencher/limpar campo · avisar no sino (pessoa, líderes do setor, todos do setor, admins — com {pedido} {produto} {setor} {etapa} {situacao} {automacao}) · chamar endereço de fora (POST assinado com a chave da automação) · esperar (1 min a 30 dias) · arquivar · trazer de volta. Até 20 passos.
- **Exemplos de fábrica, desligados:** "parado há 3 dias avisa o líder" e "peça danificada avisa os admins" (os da antiga SESSAO-17 que cabem; o "pedido completo avisa a expedição" não — esse gatilho não existe ainda).
- **O canvas é feito em casa** (sem biblioteca nova): blocos arrastáveis, ligações em curva, ligar arrastando a bolinha; tudo também por botão ("+" põe o próximo bloco já ligado). No tablet a tela serve para ligar/desligar e ver o histórico.

**Descartadas:** fila com relógio de 1 em 1 minuto para executar (o dono vetou relógio à toa — D-80); travar a automação aos setores de produção e às peças (o dono: "para tudo"); deixar a automação passar por cima das regras do estoque (corromperia o número do galpão).

## D-107 · Excluir automação: some de vez; o que ela fez FICA na Auditoria, marcado "automação excluída" (02/10/2026) — ↪️ D-99

**Pedido do dono (02/10, noite):** *"deixe um botão para excluir automação"*; perguntado sobre o histórico de execuções: *"fica na auditoria com uma tagzinha de automação excluída"*.

- Botão **Excluir** (lixeira) na barra do editor, com o "tem certeza?" na própria barra (*"Excluir de vez? Ela some; o que ela fez fica na Auditoria."*). Só o super admin (garantido no banco).
- A automação **sai de vez** (some da lista, inclusive das arquivadas). Se estava ligada, para no mesmo gesto; quem estava **esperando** para continuar **para** ali.
- **O histórico fica:** as execuções continuam guardadas (com o nome da automação), e na **Auditoria** toda linha dela — criou, ligou, rodou, os gestos que ela fez nos cards e a própria exclusão — ganha a etiqueta vermelha **"Automação excluída"**. A trilha não é reescrita (é imutável): a marca é calculada na leitura.
- Exemplo de fábrica que o dono excluir **não volta** numa reaplicação do banco.

**Descartadas:** só excluir automação que nunca rodou (como as etiquetas — o dono quis excluir as de teste, que rodaram); apagar o histórico junto (o dono quer o rastro na Auditoria).

## D-106 · O "Se… senão": a condição com DUAS saídas, cada uma com os próprios passos (02/10/2026) — ↪️ D-103

**Pedido do dono no teste ao vivo:** *"coloque separador lógico condicionais tipo, if (com um else embutido como segunda saída), coisas assim também"* — e, na mesma mensagem, *"ajuste a hierarquia disso aqui, está tudo fora de esquadro"* (a janela de escolher o próximo bloco).

- **Bloco novo "Se… senão"** (no grupo Lógica, ao lado do "Só se…" e do "Esperar"): testa as MESMAS condições do "Só se…" (etiqueta, campo, setor, situação do pedido, tipo de card). Bateu → segue pelo caminho **Sim**; não bateu → pelo caminho **Senão**. No canvas, o bloco tem **duas bolinhas de saída**, com o nome de cada uma (Sim em verde, Senão em vermelho) e **um "+" para cada**.
- **Depois do "Se… senão" não há "continuação comum"**: os passos seguintes moram DENTRO dos caminhos (o banco recusa passo depois dele na mesma sequência). Caminho vazio = a automação termina ali. Caminhos dentro de caminhos valem até **5 níveis**; o limite de **40 passos conta os dos caminhos**.
- **Pôr um "Se… senão" no meio** de uma sequência: quem vinha depois passa a seguir pelo **Sim**. **Tirar** um "Se… senão": o caminho Sim continua no lugar dele; o Senão fica **solto** (não roda — a tela avisa).
- Como o banco guarda: o passo `se_senao` leva `entao` e `senao` (listas de passos) dentro dele. O executor, ao avaliar, troca o resto do plano pelo caminho escolhido e **guarda o plano** — o "esperar" dentro de um caminho retoma no lugar certo. No histórico: "se … → caminho Sim/Senão — condição bateu/não bateu". Etiqueta ou campo usado só dentro de um caminho também conta como "já usado" (não se exclui; arquiva).
- **A escolha do bloco** passa a vir **por grupos** (Lógica · No card · Etiquetas e campos · Avisos e integrações), cartões do mesmo tamanho, ícone num quadrado, nome e uma frase curta.

**Descartadas:** caminhos que se reencontram depois do "Se… senão" (junção — vira grafo com várias entradas por bloco; complica sem pedido); "senão" como bloco separado ligado depois do "Só se…" (o dono pediu o else **embutido** como segunda saída).

## D-105 · O editor de uma automação é uma ÁREA DE TRABALHO: menu recolhido, canvas na tela toda, barra fina com Salvar e Publicar, execuções numa aba (02/10/2026) — ↪️ D-36

**Pedido do dono no teste ao vivo:** *"Está pequeno demais; sempre que eu clicar para entrar no canvas, deve abrir uma área de workflow com foco no trabalho que está sendo realizado e apenas na parte superior um botão de salvar, publicar e coisas assim; fecha inclusive o menu esquerdo"*; e, na rodada seguinte: *"deixa apenas que feche o menu automaticamente quando entrar, mas a pessoa pode abrir novamente, ele vai ficar apenas recolhido na lateral; as últimas execuções ficam ocultas tipo n8n, quando eu tenho que clicar lá em cima em execuções; o bloco lateral de selecionar o que aquela condição faz pode ser esse lateral mesmo, mas permita fechar ele"*.

- Abrir uma automação **recolhe o menu** (as duas barras — fica o trilho de ícones); a pessoa reabre quando quiser; ao sair do editor, o menu volta ao jeito lembrado. ↪️ D-36: a sidebar continua presente (recolhida); o "voltar" mora na barra do editor (não há o voltar padrão da casca nem o rodapé nessa tela).
- O **canvas ocupa a tela toda**; em cima, só: voltar, o nome (editável no lugar), o selo Ligada/Desligada, as abas **Editor | Execuções**, **Salvar** e **Publicar** (salva o que mudou e LIGA — como no n8n) / **Desligar**, e arquivar.
- As **execuções ficam escondidas** até clicar na aba "Execuções" (a lista troca o canvas; só busca ao abrir).
- O painel do bloco é uma **gaveta à direita**, que fecha no X (ou no ESC).
- As bolhas flutuantes (balão do chat, bolinha de execução) não aparecem na área de trabalho — cobririam o canvas e a gaveta.

## D-104 · Teste ao vivo com os cards de teste (01/10/2026) — ↪️ M-16

**Decidido (resposta 6 do dono):** *"Sim, ainda são só de teste, pode fazer o que quiser com eles"* — os quadros de produção seguem sendo de teste; o aceite das automações roda com eles (o pedido é real, o card é teste).

## Ver também

[[PLT - Visao Geral]] · [[PLT - Requisitos]] · [[PLT - Perguntas em Aberto]] · [[000 - ORDEM DAS SESSOES]] · [[PROMPT - Bloco 1 (Sessoes 01 a 05)]]
