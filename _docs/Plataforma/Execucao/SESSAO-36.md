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
- *(segue)*
