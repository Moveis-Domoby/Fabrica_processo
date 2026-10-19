---
titulo: SESSAO-36 — Execução (memória técnica)
tipo: execucao
data: 2026-10-18
tags: [sessao-36, execucao, tablet, pin, auxiliares, tempos, foto]
---

# 🛠️ SESSAO-36 — Memória de execução

> Sessão em **MODO AUTÔNOMO** (ordem do dono, 18/10/2026): nenhuma pergunta ao dono; as respostas provisórias do §3 da demanda valem como decisão provisória (registradas em [[PLT - Decisoes de Produto]] como **D-146, provisória**). Nada entra na `main`; nada é aplicado no banco de produção; Edge Function não é publicada — tudo fica pronto na branch `sessao-36-tablet-login-setor`, com o passo a passo no handoff.

## Contexto do início

- Main atualizada com o remoto (a demanda chegou pelo GitHub — commit `cfb47a2`); durante a leitura a sessão paralela da Integração Tiny avançou a main duas vezes (atualização 94 / D-145 e a memória E-113) — branch desta sessão avançada por fast-forward para `69634ea`. **Numeração reservada com a outra frente: migration 95+, D-146+, E-114+, A-80+.**
- Branch: `sessao-36-tablet-login-setor`, criada da main. Trabalho na pasta principal (preferência do dono — nada de worktree nova).
- As 8 tarefas do ClickUp da demanda movidas para **FAZENDO** (regra 19) em 18/10.

## (a) Entendimento do escopo (≤ 15 linhas)

1. O modo tablet sai de dentro do app logado e passa a viver **na tela de login**: digita-se o **PIN do setor** e o tablet entra naquele setor (e só nele); trocar de setor = PIN do setor de destino. Um tablet atende o setor inteiro.
2. **Toda ação de card no tablet identifica a pessoa só pelo PIN** (sem clicar no nome): o PIN passa a ser único por pessoa e não pode colidir com PIN de setor. A primeira ação num setor onde a pessoa ainda não "deu entrada" já faz a entrada na hora.
3. **Setores sem fronteira**: o cadastro do funcionário ganha o liga/desliga "pode auxiliar"; todo card **em execução** ganha o botão **Auxiliar** — outra pessoa entra no card pelo PIN, com tempo próprio, podendo mover/pausar/concluir. O tempo do card e do executor original não muda de significado.
4. **Ícone do usuário (com foto) no canto superior direito do tablet** mostra as pessoas ativas no setor; cada uma tem Pausar (fica **ausente**, mantém a entrada), Sair (encerra a entrada; sem entrar em outro = **à deriva**, com **motivo de saída** de lista própria) e Entrar (volta da ausência/deriva) — cada gesto pede o PIN da própria pessoa.
5. **Tempos por pessoa derivados de eventos** (entrada, pausa, retomada, saída): produção por card/setor, ausente, à deriva — numa **rota filha nova de Dashboards** com um scorecard por pessoa e detalhe ao clicar (líder/admin veem todos; o funcionário só o próprio).
6. **Foto de usuário** em todos os avatares da plataforma (admin cadastra; a pessoa troca a própria no Meu Perfil), comprimida com miniatura leve.
7. **No PC**: quem tem PIN e nunca criou senha entra com **email + PIN**, com troca de senha obrigatória na primeira entrada; depois da senha criada, email+PIN deixa de valer. Pessoa desativada recusada já no login (D-141) em todos os caminhos.
8. Tudo em **tempo real por websocket** (Broadcast privado), tablet em 1 requisição, zero relógio; eventos append-only; log de toda configuração (D-40).

## (b) Dúvidas de negócio → respostas provisórias adotadas (D-146)

As 13 respostas do §3 da demanda foram adotadas tal como escritas (ver a demanda e a D-146). Dúvidas que o §3 não cobre, resolvidas pela decisão mais conservadora coerente com o registrado (listadas na D-146 como "extras do Claude"):

- **E1 · Sessão do tablet**: a entrada pelo PIN do setor abre a sessão da **conta de tablet do setor** (criada sozinha pela função de autenticação na primeira entrada; papel operador, vínculo só àquele setor, marca de conta de tablet) — mantém intactos os gates por vínculo, o RLS e o futuro gancho do token; o tempo de 12 h de inatividade do modo tablet (D-137) segue valendo para a SESSÃO do aparelho (a entrada/saída de cada pessoa é outra coisa: presença).
- **E2 · "Pausar todos os cards" pede UM motivo** (aplicado a todos os cards da pessoa) — pedir um por card no tablet seria fila de modais.
- **E3 · O que é "card em produção" para o estado da pessoa**: execução ou auxílio aberto e não pausado.
- **E4 · Deriva não é punição**: sair do setor com a sessão do ESCRITÓRIO (sair da conta no PC) não gera "saída de setor" — a deriva é do chão de fábrica (entrada por PIN); quem nunca deu entrada num setor não está "à deriva", está simplesmente fora (sem segmento contando).
- **E5 · O quadro do PC** continua funcionando como hoje (arrasto com a sessão logada, sem PIN); o PIN como identificador é do **modo tablet** (onde hoje já se pedia PIN + nome). No PC o autor é a própria sessão.
- **E6 · Auxiliar no PC**: o botão Auxiliar existe na janela do card também no computador; lá ele age em nome da própria sessão logada (sem PIN), guardando a mesma regra (pode auxiliar + limite por pessoa).

## (c) Decisões técnicas (o desenho; detalhes por etapa abaixo)

1. **PIN do setor**: `plt_setores.pin_hash` (PBKDF2, como o PIN de pessoa) + `pin_busca` (HMAC determinística com segredo que NASCE NO BANCO — padrão A-41 — lido só pela Edge Function); cadastro por porta própria (só admin, com trilha D-40, nunca devolve o PIN); conferência na Edge Function `autenticacao` (ação nova `tablet-entrar`) com **trava de tentativa e erro no banco** (contador + bloqueio curto).
2. **Identificação por PIN**: coluna `plt_usuarios.pin_busca` (mesma HMAC; backfill impossível sem o PIN cru → preenchida no próximo acerto de PIN; quem não tem `pin_busca` é achado comparando o PBKDF2 um a um — ~30 usuários). Unicidade: índice único parcial em `pin_busca` + conferência na definição (contra pessoas E setores). Duplicados HISTÓRICOS não se corrigem sozinhos (resposta 2): a ação pede confirmar o nome só nesses casos; lista vai na pendência.
3. **Presença por eventos**: tipos novos `presenca_entrada` / `presenca_saida` em `plt_eventos` (append-only), com projeção `plt_presenca_segmentos` (um segmento por estado: trabalhando · ausente · à deriva, com `fim` nulo no vigente) + o vigente por pessoa — mantidos por gatilho a partir dos eventos de presença E dos de execução/auxílio/pausa (M-13). Dashboard lê os segmentos (índice pessoa+início), nunca varre `plt_eventos`.
4. **Auxiliares**: eventos novos `auxilio_iniciado` / `auxilio_pausado` / `auxilio_retomado` / `auxilio_encerrado` — espelho da execução, POR PESSOA, sem tocar na semântica da execução existente (o tempo do card não quebra); o limite de 1 por pessoa (D-48) conta execução + auxílio; concluir/mover fecha o tempo de todos (resposta 8). View nova `plt_vw_auxilios` (irmã de `plt_vw_execucoes`); a frente do card projeta os rostos de quem está no card.
5. **Foto**: continua em `plt-imagens/perfis/{id}/` (D-43); componente único `<Avatar>` (foto → iniciais) usado em toda a plataforma; redução no aparelho (`reduzirImagem`) + miniatura leve.
6. **Email + PIN no PC**: ação nova da Edge `entrar-pin` — só para quem tem PIN e `senha_padrao = true` (nunca criou senha); cai na troca obrigatória de senha que já existe; inativo recusado com a mesma mensagem do login normal; trava de tentativas igual à do PIN.
7. **Tempo real**: presença e tempos viajam pelos canais privados existentes (`plt-aviso:setor_{id}` para o quadro/tablet; tópico novo estreito para a dashboard de tempos, gateado por líder/admin) — zero relógio.

## Diário (cronológico)

- **18/10 ~19h UTC** — main atualizada (26769c3 → 69634ea com os avisos da sessão paralela); branch criada; cofre lido na ordem (CLAUDE.md, memória, decisões, visão, requisitos, ORDEM + demanda 2×, handoffs 31/32/33, esquema do banco, lei de desempenho, modelo de sistema, perguntas em aberto); ClickUp: 8 tarefas → FAZENDO (uma chamada em lote).
- **18/10 ~20h–22h UTC — banco (migrations 95–97):**
  - **95 `plt_tablet_pin_setor`**: `plt_setor_pins` (hash + busca, tabela fechada), `plt_pin_tentativas` (trava de tentativa e erro), `plt_usuarios.pin_busca` (SEM grant — E-50) / `conta_tablet` / `pode_auxiliar` (com grant), CPF opcional só para conta de tablet (matrícula 000 — `fn_gerar_matricula` recriada, com o caso "cpf nulo em pessoa comum" ainda recusado), segredo da busca do PIN nascendo no banco (`plt_webhooks`, marcador `pin_chave` — padrão A-41).
  - **96 `plt_presenca_auxiliares`**: 4 fatos de auxílio no check de `plt_eventos` (recriado `not valid`; o `validate` MUDOU DE CASA da migration da devolução para cá — E-19 aplicado duas vezes: tipos de evento E tipos de motivo; a 67 editada); motivos tipo `saida` (5 sementes) + `plt_fn_motivo_salvar` recriada + `fn_motivo_da_lista` genérica; projeção `plt_auxilios` + `plt_cards.auxiliares`; guarda `fn_validar_auxilio` (quem pode: setor, `pode_auxiliar` ou admin; card EM execução; limite D-48 conta auxílio); `fn_auxilios_acompanhar` (mover/finalizar/arquivar/concluir encerram; pausa/retomada do card pausam/retomam juntos — a retomada só devolve quem foi pausado JUNTO com o card, marca `junto_com_o_card`); `fn_validar_execucao` recriada (limite conta auxílios; auxiliar não inicia o card que auxilia; auxiliar pode pausar o card); `fn_autor_do_gesto` recriada (+`pode_auxiliar` — setores sem fronteira); presença: `plt_presenca_eventos` (append-only próprio — `plt_eventos.card_id` é NOT NULL, por isso tabela própria), `plt_presenca_atual` (setor nulo = à deriva; sem linha = nunca entrou), `plt_presenca_segmentos` (único aberto por pessoa; troca no mesmo instante apaga o segmento de duração zero), `plt_tempos_pessoa_dia` (agregado por dia de Fortaleza, incrementado no fechamento; ausente/deriva com TETO de 12 h por segmento — decisão provisória); entrada automática ao iniciar/retomar/auxiliar (gatilho `zz2`; mover sozinho NÃO dá entrada — decisão provisória); recalc por gatilhos em `plt_cards` (executor/pausa/arquivo/conclusão/setor) e `plt_auxilios`; portas `plt_fn_card_auxiliar`, `plt_fn_auxilio_encerrar`, `plt_fn_pessoa_entrar/pausar/sair` (pausar tudo com UM motivo; sair = pausa tudo + saída com motivo da lista; o auxílio alheio sai sem afetar o card); `fn_aviso_pode_ouvir` + tópico `plt-aviso:tempos`; quadro numa requisição recriado (cards + `auxiliares`, junto + `auxilios`, setor + `presencas` — o ícone do tablet); `plt_fn_card_janela` (+ auxílios, permissões `auxiliar`/`sair_auxilio`, pausar por auxiliar); `plt_fn_abertura` (+ `conta_tablet`/`pode_auxiliar` no perfil).
  - **97 `plt_tempos_por_pessoa`**: `plt_fn_tempos_pessoas` (scorecards do agregado + segmento aberto; líder/admin veem todos, funcionário só o próprio — resposta 12; períodos por DIA de Fortaleza, teto de 3 meses; lista limitada = deslocamento justificado) e `plt_fn_tempos_pessoa_detalhe` (dias, por setor, execuções/auxílios no clique — leitura pequena sob demanda).
  - **Bateria:** blocos 95–97 novos (+22 verificações → **1.074 TUDO VERDE**). Tropeços no caminho, já corrigidos: (1) o `validate` dos checks nas migrations antigas quebrava a 2ª rodada (E-19 — editadas 67); (2) os testes antigos amarram a MENSAGEM da recusa de pausa (regex `quem executa`) — a mensagem nova foi escrita mantendo o trecho; (3) o harness imita o grant padrão do Supabase em TODAS as tabelas (bloco 78) — prova de tabela fechada ali é "RLS sem política", não `has_table_privilege`; (4) `deveRecusarExec` dentro de `begin` aborta a transação (25P02) — o bloco roda sem transação, com prefixo próprio, como os antigos; (5) chaves de qualidade (D-126) ligadas por blocos anteriores pegavam o mover do cenário — desligadas no setup; (6) o corte do agregado na meia-noite come ~1 s de fração (floor por dia) — tolerância no teste.
- **18/10 ~22h UTC — Edge Function `autenticacao` v12 (SÓ NO REPO; publicar é passo do dono):** ações novas `tablet-entrar` (PIN do setor → sessão da conta de tablet do setor, criada sozinha na 1ª entrada com senha aleatória trocada a cada entrada; trava por IP), `pin-identificar` (a pessoa SÓ pelo PIN: busca HMAC indexada + varredura dos PINs de antes da regra com preenchimento no acerto; duplicado histórico devolve os nomes para confirmar e registra na trilha), `setor-pin-definir` (só admin; unicidade contra pessoas e setores; trilha sem o valor), `entrar-pin` (e-mail + PIN só para quem nunca criou senha; inativo recusado com a mensagem clara; cai na troca obrigatória); `pin-definir`/`criar-usuario` passam a exigir PIN único e gravar a busca; `pin-verificar` ganhou trava de tentativas e preenche a busca no acerto. O segredo da HMAC é lido do banco (nunca em env/repo).
- **18/10 ~23h UTC — front, parte 1 (tipos limpos, commitada):**
  - `Entrar.tsx`: 3 modos — usuário+senha (como era), **e-mail + PIN** (quem nunca criou senha; cai na troca obrigatória) e **Modo tablet do setor** (teclado de PIN → `tablet-entrar` → `/tablet`).
  - `guardas.tsx`: a conta de tablet vive SÓ no `/tablet` (toda URL volta para lá — fecha a armadilha do botão "casa").
  - `TelaSetor.tsx`: ícone do canto superior direito com os AVATARES das pessoas presentes (de `plt_fn_quadro_setor.presencas`, ao vivo pelo canal do setor) → `PainelPessoasSetor` (Pausar · Sair · Entrar, cada um com o PIN da própria pessoa + motivo da lista certa); "Trocar setor" na conta de tablet pede o PIN do setor de destino (`tabletEntrar` + reload); o "casa" some na conta de tablet; gesto novo "auxiliar" com PIN.
  - `ModalPinOperador`: reescrito — SÓ o teclado de PIN (`pin-identificar`); a lista de nomes só aparece no PIN duplicado histórico; `esperadoId` recusa PIN de outra pessoa nos gestos do ícone. `TecladoPin` extraído e reaproveitado.
  - `CartaoUnidade` + `QuadroKanban`: botão **Auxiliar** no card em execução (tablet pede PIN; no PC age pela sessão — `QuadroSetor` com a mutação), linha "Com ajuda de …" e o tipo do card com `auxiliares`.
  - `useQuadro`/`quadro.ts`: `presencas`, `auxilios` e `auxiliosPorCard` no quadro numa requisição.
  - `AvatarPessoa` (componente único da casa, foto → iniciais) em `componentes/ui` — usado no painel de pessoas e no PIN duplicado; **falta espalhar** pelos lugares antigos (executor do card, Equipe, ModalPin…, dashboards, Layout, MeuPerfil).
  - Tipo de motivo `saida` no front (Excludes ajustados em ModaisEntrega/EntregasDoDia/Rotas).

## Front, parte 2 (retomada depois do limite de uso — 18/10, noite)

- **Janela do card**: botões **Auxiliar** / **Sair do auxílio** (PC pela sessão; tablet com PIN — `pinPara` ganhou os dois gestos), a linha "fulano ajudando há X" por auxílio aberto e o tipo da janela com `auxilios` + permissões novas.
- **Dashboard** `/dashboards/tempos-por-pessoa` (`TemposPessoas.tsx`): um scorecard por pessoa (foto, estado com texto — M-12 —, produção/ausente/fora de setor no período, produção por setor) e o **detalhe no clique** (1 requisição: dia a dia, por setor, cards com execuções e auxílios); período em pílulas (hoje/7/30/90); **ao vivo** pela área nova `tempos` (`AreaAoVivo`); rota visível a todos (o banco devolve só o próprio ao operador — resposta 12); menu + pedaço próprio (2,4 KB gz).
- **Configurações**: Setores e etapas → bloco **"PIN de entrada do tablet"** por setor de produção (só admin; o valor nunca volta); Equipe → **avatar na lista**, botão **"Pode auxiliar?"** (porta própria com trilha) e **foto pelo admin** (reduzida no aparelho, 512 px); Utilitários → aba **"Motivos de saída"**.
- **Foto nos ícones**: `AvatarPessoa` no executor do card (quadro/tablet), na Equipe, no painel de pessoas do setor e no PIN duplicado; o bloco do usuário do menu e o Meu Perfil já mostravam a foto; o chat segue com o avatar próprio (mesma lógica).

## Fatia extra — a foto nas portas antigas (18/10, depois do fechamento)

- **Migration 97 (anexo)**: `plt_fn_dash_tempos_pessoa` recriada com **drop+create** (coluna nova `foto_caminho` depois da matrícula; grants refeitos) e `plt_fn_pedido_producao` recriada por `create or replace` (jsonb — chave `foto` em cada execução via `coalesce(ui.foto_caminho, uf.foto_caminho)` e no resumo por pessoa via `max(x.foto)`; forma igual, o site publicado não quebra).
- **E-17 pela terceira vez**: a 2ª rodada da bateria quebrou nas DUAS migrations antigas que recriam a porta (20260828060000 e 20260921120000 — "cannot change return type") **e derrubou mais cinco em cascata** (migration que para no meio deixa de rodar os drops/validates que as seguintes esperam — até um "already exists" apareceu longe da raiz). Remédio da casa nas duas raízes (`drop function if exists` antes do create) → **TUDO VERDE, 1.075 verificações**. Linha do E-17 completada na memória.
- **Front**: `src/pedidos/api.ts` (`ExecucaoDaPeca.foto?` e `pessoas[].foto?`), `ProducaoDoPedido.tsx` (AvatarPessoa nas pílulas de pessoas e nas linhas de execução), `dashboards/Pessoas.tsx` (AvatarPessoa no ranking). **Armadilha de TS**: o tipo novo da dashboard se chamava `TempoPessoa` e COLIDIU em silêncio (merge de interfaces) com o `TempoPessoa` antigo do mesmo arquivo → renomeado para `PessoaTempos`; o antigo ganhou `foto_caminho`.
- **Verificação da fatia**: tipos limpos · lint limpo · testes de tela dos arquivos tocados verdes · bateria 1.075 verdes · build ok (pacote inicial inalterado — o avatar já estava no bundle).

## Fechamento (checklists)

- **Tipos** limpos · **lint** limpo · **testes de tela 205 verdes em 38 arquivos** (novos: a entrada com os 3 modos e a dashboard de tempos) · **bateria do banco 1.075 verdes** (reaplica tudo 2×; blocos 95–97 + ensaio ×100) · **build** ok.
- **Mojibake**: `grep -E 'Ã§|Ã£|…'` no src = nada (E-34).
- **Checklist da Lei de Desempenho (§12):**
  - Requisições: tablet segue abrindo em 1 requisição (o quadro numa chamada — as presenças e os auxílios vêm NELA); a dashboard nova = 1 requisição (detalhe só no clique); a tela de entrada não toca o banco antes do gesto. Zero releitura por relógio (tudo pelo websocket: setor e o tópico novo `tempos`).
  - Busca no código: nenhum `refetchInterval`/`setInterval` buscando dado/`postgres_changes` novo.
  - **Ensaio ×100** (PGlite, na bateria): agregado com ~98 mil linhas (90 pessoas × 365 dias × 3 estados) → **scorecards de 30 dias: 22 ms · detalhe de 1 pessoa: 6 ms** — lendo só o agregado diário e o segmento aberto (os tetos reais são 150/50 ms, e o banco real é mais rápido que o PGlite).
  - Índices: agregado por (usuario, dia, estado, setor) + (dia); segmentos por (usuario, inicio) e único parcial do aberto; auxílios por card/usuário parciais.
  - Listas: scorecards limitados às pessoas da casa (deslocamento justificado, teto 100); detalhe limitado a 100 cards por tipo.
  - Pacote: JS inicial **219,6 → 222,0 KB** comprimidos (teto 250; os modos novos da tela de entrada + o avatar); pedaços: TelaSetor 6,1 KB gz · JanelaDoCard 8,0 · TemposPessoas 2,4.
  - Escrita idempotente: auxílio repetido recusado pelo único parcial; entrada repetida no mesmo setor é silenciosa; pausar-tudo idempotente por card.
  - Advisors: nada foi aplicado em produção — conferir DEPOIS da aplicação (passo do dono no handoff).
- **O que NÃO foi feito (e por quê):** aplicar as atualizações 95–97 no banco (regra 2), publicar a função de autenticação v12 (ela depende da 95 aplicada — ordem no handoff), mesclar na main (regra 1), testar logado no site (nada publicado). ~~Foto nas portas antigas~~ → entregue na fatia extra (seção acima).
- **Numeração usada:** migrations 95–97, D-146, A-80; próxima livre: 98 / D-147 / E-114 / A-81.

## Teste ao vivo — 18/10 à noite (dono presente)

- **OK do dono na conversa** → migrations 95→96→97 aplicadas pelo aplicador `--so` (integração intacta nas três) e `autenticacao` publicada (deploy nº 13). Fumaça por curl: `tablet-entrar` com PIN inexistente → 401 limpo (a função leu a chave de busca do banco e usou a trava).
- **Site local (branch), login do dono:** dashboard Tempos por pessoa com as 6 pessoas e detalhe no clique; PIN do SECC gravado pela tela (conferido em `plt_setor_pins`, trilha com o autor); `pode_auxiliar` ligado no `teste21` (toast "agora pode auxiliar em qualquer setor"); aba Motivos de saída com as 5 sementes; PIN do `teste21` definido pela Equipe (busca preenchida).
- **Modo tablet de ponta a ponta:** saiu da conta → "Modo tablet do setor" → PIN do SECC → quadro do SECC (conta `tablet-s2` nasceu sozinha); painel de pessoas → **Entrar** com o PIN do `teste21` → "entrou no setor", estado **Ausente** (sem execução — correto); **Sair** → pediu o PIN DELE → lista de motivos de saída → "Fim do turno" → "saiu do setor". Banco: `plt_tempos_pessoa_dia` = 51 s `ausente` no setor 2 — **fatos → segmentos → agregado rodando em produção**. "Trocar setor" abre o teclado pedindo o PIN do destino.
- **Não coberto no teste (fica com o dono, roteiro do handoff):** gestos de card (iniciar/auxiliar em card real — SECC estava com 0 cards e não criei carga em produção), upload de foto, e-mail + PIN, tempo real em duas telas, celular/tablet físicos.
- **PINs provisórios** (SECC e teste21) — o dono troca pelos definitivos nas mesmas telas. Sessão do navegador devolvida à tela de entrar.
