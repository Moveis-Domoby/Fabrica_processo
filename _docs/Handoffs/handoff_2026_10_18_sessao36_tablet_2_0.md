---
titulo: Handoff — 2026-10-18 · SESSAO-36 · Tablet 2.0 (login por setor, auxiliares e tempos por pessoa)
tipo: handoff
data: 2026-10-18
tags: [handoff, sessao, sessao-36, tablet, pin, auxiliares, presenca, tempos, dashboards, foto, login]
---

# 📋 Handoff — 18/10/2026 · SESSAO-36 · Tablet 2.0

> [!success] Entregue NA BRANCH — sessão em MODO AUTÔNOMO, com o dono fora
> Ordem do dono (18/10): executar a demanda sem perguntas, adotando as respostas provisórias dela. **Nada entrou na `main`, nada foi aplicado no banco de produção e nenhuma função foi publicada** (regras 1, 2 e 3): tudo está pronto, testado e esperando na branch — o passo a passo do dono está logo abaixo. As respostas provisórias viraram a **D-146 (provisória)**, com as escolhas extras do Claude. Memória técnica completa: [[SESSAO-36]] (`Plataforma/Execucao/SESSAO-36.md`).

**Branch:** `sessao-36-tablet-login-setor` (no GitHub; nasceu da `main` 69634ea). **Demanda:** [[SESSAO-36 - Tablet 2.0 - Login por Setor Auxiliares e Tempos por Pessoa]]. **Banco:** migrations **95 a 97 EM ARQUIVO** (não aplicadas — detalhe em [[SUPA - Esquema do Banco]]). **Função de autenticação v12** no repositório (não publicada — depende da 95). **Bateria do banco:** 1.052 → **1.075 verificações, TUDO VERDE** (reaplica tudo 2×; inclui o ensaio ×100). **Testes de tela:** 199 → **205 verdes** (38 arquivos); tipos e lint limpos; build dentro do teto (JS inicial 222 KB de 250). **Decisões:** D-146 (provisória — confirmar).

## ▶️ Para o dono quando voltar (nesta ordem)

1. **Revisar e juntar na `main`** (D-20): a branch `sessao-36-tablet-login-setor` — revisão na conversa, merge direto. ⚠️ **Não publique o site ainda**: a tela de login nova chama a função de autenticação v12, que depende do banco novo (passos 2 e 3 vêm antes de o site subir — banco, função e site no MESMO gesto, como sempre).
2. **Aplicar as três atualizações do banco, uma a uma** (o aplicador confere a integração do Tiny antes/depois — tem que dar "idêntica" nas três):
   ```bash
   npm run banco:aplicar -- --confirmar --so 20261018200000_plt_tablet_pin_setor.sql
   ```
   ```bash
   npm run banco:aplicar -- --confirmar --so 20261018210000_plt_presenca_auxiliares.sql
   ```
   ```bash
   npm run banco:aplicar -- --confirmar --so 20261018220000_plt_tempos_por_pessoa.sql
   ```
3. **Publicar a função de autenticação** (ela lê as tabelas novas — só depois do passo 2):
   ```bash
   npx supabase functions deploy autenticacao
   ```
4. **Publicar o site** (o merge do passo 1 já faz a Vercel publicar — se publicou antes dos passos 2–3, basta conferir depois deles; a tela de login velha continua funcionando no meio tempo, só o botão novo do tablet dependeria do banco).
5. **Conferir os avisos do Supabase** (desempenho/segurança) depois da aplicação — não deve haver item de tipo novo.
6. **Dar o PIN de cada setor**: Configurações → Setores e etapas → abrir um setor de produção → "PIN de entrada do tablet" (4 a 6 dígitos). Sem esse PIN, o modo tablet da tela de login ainda não entra naquele setor.
7. **Ligar quem pode auxiliar**: Configurações → Equipe → botão "Pode auxiliar?" nas pessoas que circulam entre setores.
8. **Testar no tablet e no computador** (o passo a passo de teste logo abaixo).
9. **Confirmar as decisões provisórias** (a lista em "Decisões provisórias", no fim) — são as regras adotadas sem você; qualquer "não" a gente ajusta.
10. **Pendência que fica com você:** se já existirem duas pessoas com o MESMO PIN de antes desta mudança, o aparelho avisa na hora do uso (pede para confirmar o nome e registra o caso na trilha) — vale trocar o PIN de uma delas em Configurações → Equipe → PIN. Os PINs antigos não revelam duplicata parada (são guardados embaralhados): a lista nasce do uso.

## 1. O que foi feito

### O tablet entra pelo PIN do setor (tela de login)
- A tela de entrar ganhou o botão **"Modo tablet do setor"**: um teclado na tela pede o **PIN do setor** — digitou certo, o tablet abre naquele setor (e só nele). Trocar de setor = o PIN do setor de destino, sempre. Um tablet atende o setor inteiro.
- Por baixo, cada setor ganha uma **conta de tablet própria** (criada sozinha na primeira entrada, com senha aleatória trocada a cada entrada): os acessos, as regras de leitura e o futuro gancho do login continuam valendo. A conta do tablet **vive só na tela do setor** — qualquer endereço digitado volta para lá (o botão "casa" que abria a plataforma inteira saiu).
- O PIN do setor é guardado **só embaralhado** (nunca em texto puro), cadastrado pelo admin em Setores e etapas, com registro de quem trocou e quando. Tentativa e erro tem **trava** (5 erros → espera crescente), na entrada do tablet, nas ações por PIN e no e-mail + PIN.

### A pessoa se identifica SÓ pelo PIN
- Toda ação no tablet (soltar card, pausar, concluir, auxiliar…) abre direto o **teclado de PIN** — sem clicar no nome. O PIN acha a pessoa sozinho (busca embaralhada e indexada no banco; a conferência continua pelo cofre de sempre).
- **PIN único daqui em diante**: cadastrar um PIN que já é de outra pessoa (ou de um setor) é recusado. PIN repetido ANTIGO: só nesses casos a tela mostra os nomes para a pessoa confirmar o seu — e o caso fica registrado para a liderança trocar um dos PINs.
- A **primeira ação num setor onde a pessoa ainda não "deu entrada" já faz a entrada** (iniciar, retomar ou auxiliar — mover sozinho não).

### Setores sem fronteira: o botão AUXILIAR
- Todo card **em execução** ganhou o botão **Auxiliar** (no quadro, no tablet e na janela do card): outra pessoa entra no card pelo PIN e o **tempo dela conta à parte** — o tempo do card e o do executor original não mudam. O auxiliar pode mover, pausar e concluir o card como qualquer executor.
- O cadastro do funcionário ganhou o liga/desliga **"pode auxiliar"** (Equipe, só admin): ligado, a pessoa age em qualquer setor de produção; desligado, só no setor dela (gente do próprio setor auxilia sem precisar da chave).
- A pausa do card pausa os auxílios junto (mesmo motivo); mover/concluir/arquivar o card encerra o tempo de todos (resposta 8); **sair do auxílio** não mexe no card de quem ficou. O limite de cards por pessoa conta o auxílio também.

### O ícone das pessoas no canto superior direito do tablet
- O cabeçalho do tablet mostra **as fotos de quem está no setor** (ao vivo). Tocando, abre o painel com cada pessoa e os gestos **Pausar · Sair** (e o **Entrar** para quem chega) — cada gesto pede **o PIN da própria pessoa**.
- **Pausar** = pausa todos os cards da pessoa com UM motivo (da lista de pausa) e ela fica **AUSENTE** (a entrada no setor fica). **Sair** = pausa tudo + encerra a entrada, com **motivo da lista própria de SAÍDA** (nova aba em Configurações → Utilitários); sem entrar em outro setor, a pessoa fica **à deriva**. **Entrar** é a volta.

### Tempos por pessoa (dashboard nova)
- **Dashboards → Tempos por pessoa**: um cartão por pessoa com o estado de agora (trabalhando · ausente · fora de setor) e os tempos do período — **em produção, ausente e fora de setor** —, mais a produção por setor. Clicando no cartão, o **detalhe**: dia a dia, por setor e os cards (execuções e auxílios).
- Tudo **derivado de fatos** (entrada, pausa, retomada, saída — nada se apaga) e lido de um **agregado diário pronto** (a tela nunca varre a tabela de eventos): no ensaio com 100× o volume, os cartões saíram em 22 ms e o detalhe em 6 ms no banco de teste. Líder e admin veem todo mundo; o funcionário vê só o próprio. Ao vivo por websocket (zero relógio).
- Ausente/fora de setor têm **teto de 12 h por trecho** (ninguém fica "ausente" a noite inteira na conta) — decisão provisória.

### Foto de usuário
- O cadastro ganhou **foto pelo admin** (Equipe — reduzida no aparelho antes de subir) e a pessoa segue trocando a própria no Meu Perfil. Nasceu o **avatar único da casa** (foto → iniciais), usado no executor do card, na lista da Equipe, no painel de pessoas do setor, no PIN e na dashboard nova; menu e Meu Perfil já mostravam a foto; o chat já tinha o seu.

### Computador: e-mail + PIN
- Quem tem PIN e **nunca criou senha** entra com **e-mail + PIN** ("Entrar com e-mail e PIN" na tela de login) e cai direto na **troca obrigatória de senha**. Depois de criar a senha, esse caminho deixa de valer. Pessoa desativada é recusada já no login, com a mensagem clara (como decidido em 16/10) — também no caminho do PIN.

> [!check] ↪️ Teste ao vivo em 18/10 à noite (dono presente; OK dado na conversa)
> As **três migrations foram aplicadas** (aplicador `--so`, 95→96→97; integração do Tiny conferida intacta) e a **função `autenticacao` publicada** (deploy nº 13; fumaça: PIN inexistente → recusa limpa 401). No site **local** (branch), com o login do dono: PIN do SECC gravado (provisório — **o dono troca**), `pode_auxiliar` ligado no `teste21` (porta com toast), aba Motivos de saída com as 5 sementes, dashboard Tempos por pessoa com as 6 pessoas + detalhe no clique; modo tablet entrou no SECC pelo PIN do setor (conta de tablet criada sozinha), painel de pessoas: **Entrar** pelo PIN do `teste21` → "Ausente"; **Sair** pediu o PIN dele + motivo ("Fim do turno") → saiu; o agregado contou **51 s ausente no SECC** — fatos → trechos → agregado funcionando em produção. "Trocar setor" pede o PIN do destino. PIN do `teste21` também é provisório.
> **Ficam para o dono** (passos abaixo): gestos de card (iniciar/auxiliar com card real), foto (upload), e-mail + PIN, tempo real em duas telas — e o **merge na main** (o site publicado ainda não tem as telas novas).

## 2. Como testar — passo a passo (depois dos passos 1–7 do dono)

1. **PIN do setor:** Configurações → Setores e etapas → MONTAGEM → "PIN de entrada do tablet" → grave um PIN (ex.: 4 dígitos). Tente gravar o MESMO PIN noutro setor → recusa ("já está em uso").
2. **Modo tablet:** saia da conta → na tela de entrar, "Modo tablet do setor" → digite o PIN da MONTAGEM → o tablet abre direto no quadro da MONTAGEM. Digite um endereço qualquer na barra (ex.: /inicio/meu-painel) → volta ao tablet.
3. **Trocar de setor:** no cabeçalho do tablet, "Trocar setor" → pede o PIN do setor de DESTINO.
4. **Ação só pelo PIN:** arraste um card para a etapa de trabalho → o teclado de PIN abre direto (sem lista de nomes) → digite o SEU PIN → "fulano identificado" e o tempo começa. Com um PIN que não existe → "PIN não encontrado". Erre 5 vezes → a trava pede para esperar.
5. **Auxiliar:** com um card em execução por alguém, toque em **Auxiliar** no card → o PIN de OUTRA pessoa (do setor, ou de quem "pode auxiliar") → "Com ajuda de …" aparece no card. Pause o card → o auxílio pausa junto. Mova o card adiante → o auxílio encerra com o tempo próprio fechado. Quem não é do setor e não pode auxiliar → recusa com a explicação.
6. **Ícone das pessoas:** toque nas fotos no canto superior direito → o painel lista quem está no setor. **Pausar** alguém (o PIN dela + motivo) → ela fica "Ausente". **Sair** (motivo da lista de saída) → some do setor. **Entrar** → volta. Teste digitar o PIN de OUTRA pessoa no gesto → recusa ("cada um usa o próprio PIN").
7. **Dashboard:** Dashboards → **Tempos por pessoa** → um cartão por pessoa com os três tempos; clique num cartão → o dia a dia e os cards. Entre com uma conta de OPERADOR → a tela mostra só o próprio cartão.
8. **Motivos de saída:** Configurações → Utilitários → aba "Motivos de saída" → edite/adicione.
9. **Foto:** Configurações → Equipe → botão de foto numa pessoa → escolha uma imagem → o avatar aparece na lista, no card em que ela trabalha e na dashboard.
10. **E-mail + PIN:** com uma pessoa de teste que tem PIN e nunca trocou a senha padrão → "Entrar com e-mail e PIN" → entra e cai na troca obrigatória. Depois de criar a senha, o mesmo caminho → recusado (entra com a senha). Pessoa desativada com o PIN certo → "acesso desativado".
11. **Tempo real:** abra o quadro do setor no computador e o tablet ao lado → pausar/sair/auxiliar num aparece no outro na hora, sem recarregar.
12. **Celular (375) e tablet (768):** a tela de entrar com o teclado de PIN, o painel das pessoas e a dashboard — nada estoura a borda; os alvos têm 44 px+.

## 3. Critérios de aceite — um a um

| Critério | Situação |
|---|---|
| Modo tablet na tela de login; PIN do setor entra e mostra só ele; trocar de setor pede o PIN do destino; um tablet atende o setor | ✔ no código + bateria (conta de tablet, matrícula própria); **no site, com o dono (nada publicado)** |
| PIN do setor cadastrável pela administração, com log; nunca em texto puro no cliente | ✔ (tabela fechada; hash + busca embaralhada; trilha) |
| Ação de card só pelo PIN; PIN único; pessoa num setor por vez; agir num setor novo entra direto | ✔ bateria (unicidade, entrada automática) + tela nova do PIN |
| Botão Auxiliar em todo card em execução; auxiliar move/pausa/conclui; tempo individual | ✔ bateria (fluxo completo com tempos aritméticos: 10+10 min) |
| Ícone com foto no canto superior direito; Pausar/Sair pausam tudo; auxiliar sai sem afetar o card | ✔ bateria + telas; cada gesto pede o PIN da própria pessoa |
| Pausa pede motivo; sem card restante → ausente; sair sem entrar noutro → à deriva; motivos de saída em Configurações | ✔ bateria (estados + motivo obrigatório) + aba nova |
| Rota filha de Dashboards com scorecard e detalhe; tempos batem com os fatos | ✔ porta do agregado (incrementado no fechamento de cada trecho) + testes de tela |
| Foto no cadastro e nos ícones | ✔ admin cadastra; avatar único em TODOS os lugares — inclusive o painel Pessoas e a produção do pedido (as duas portas passaram a levar a foto) |
| PC: e-mail + PIN com troca obrigatória; inativo recusado no login | ✔ função v12 + testes da tela de entrar |
| Tempo real por websocket, zero polling; tablet em 1 requisição | ✔ presenças e auxílios vêm NA requisição do quadro; tópico novo para a dashboard; nenhum relógio |
| Toda configuração com log; eventos append-only | ✔ trilha (PIN do setor, pode auxiliar, entrada/saída); fatos imutáveis por gatilho |
| Tablet (768) e celular (375) sem rolagem lateral | ✔ no desenho (alvos 44 px+); **conferência visual no aparelho com o dono (nada publicado)** |

## 4. Decisões provisórias — dizer sim ou não (D-146)

As **13 respostas provisórias da demanda** foram adotadas tal como escritas. As escolhas EXTRAS do Claude (conservadoras):
1. A entrada do tablet abre a sessão de uma **conta própria do setor** (criada sozinha; vive só no tablet); o tempo de 12 h de inatividade do aparelho continua.
2. "Pausar/Sair" do ícone pede **um** motivo para todos os cards da pessoa.
3. "Card em produção" (para o estado da pessoa) = execução ou auxílio aberto e não pausado.
4. A deriva é do chão de fábrica (nasce da saída de setor); sair da conta no computador não gera deriva.
5. No computador o quadro segue pela sessão logada (sem PIN); o Auxiliar existe lá também, pela sessão.
6. O tempo por pessoa soma execuções + auxílios; o tempo do card não muda de significado.
7. A **entrada automática** no setor acontece ao iniciar/retomar/auxiliar; mover um card sozinho não dá entrada.
8. Ausente e à deriva têm **teto de 12 h por trecho** (o horário de funcionamento pode refinar depois).
9. A pausa do card pausa os auxílios junto; a retomada devolve só quem foi pausado com o card.

## 5. Checklist de desempenho da lei (§12)

- [x] Tablet continua abrindo em **1 requisição** (presenças e auxílios vêm nela); dashboard nova = 1 requisição (detalhe no clique); zero releitura por relógio.
- [x] Busca no código: nenhum relógio buscando dado, nenhuma escuta de tabela.
- [x] **Ensaio ×100** (banco de teste, na bateria): agregado com ~98 mil linhas → **scorecards 22 ms · detalhe 6 ms** (tetos reais: 150/50 ms; o banco real é mais rápido).
- [x] Índices nas chaves/filtros novos (agregado, segmentos, auxílios — parciais nos abertos).
- [x] Tabelas novas fechadas (RLS sem política — só as portas); `pin_busca` fora da API (E-50).
- [x] Listas limitadas com teto no banco (100 pessoas; 100 cards no detalhe; 3 meses por vez).
- [x] **Pacote:** JS inicial 219,6 → **222,0 KB** comprimidos (teto 250); TemposPessoas é pedaço próprio (2,4 KB gz).
- [x] Escrita idempotente (auxílio/entrada repetidos não dobram; travas de tentativa no PIN — antes não havia nenhuma).
- [ ] Advisors e INP no aparelho: **depois da aplicação/publicação, com o dono** (nada foi aplicado).

## 6. ClickUp (regra 19)

As 8 tarefas da demanda estão em **FAZENDO**, cada uma comentada com o que foi entregue e como conferir; **nenhuma concluída** (quem conclui é o dono). Links na seção "Tarefas no ClickUp" da demanda.

## 7. Para a máquina — onde está cada coisa

- **Migrations (em arquivo):** 95 `20261018200000_plt_tablet_pin_setor` · 96 `20261018210000_plt_presenca_auxiliares` · 97 `20261018220000_plt_tempos_por_pessoa` — detalhe em [[SUPA - Esquema do Banco]]. A migration da devolução (67) foi editada: os `validate` dos checks de evento e de motivo mudaram para a 96 (E-19).
- **Função:** `supabase/functions/autenticacao/index.ts` (v12 — publicar DEPOIS da 95).
- **Front:** `src/paginas/{Entrar,TelaSetor,QuadroSetor,Estrutura,Equipe,Utilitarios}.tsx` · `src/paginas/dashboards/TemposPessoas.tsx` · `src/tablet/{TecladoPin,ModalPinOperador,PainelPessoasSetor,api}.ts(x)` · `src/kanban/{quadro,useQuadro,tipos}.ts` · `src/kanban/componentes/{CartaoUnidade,QuadroKanban}.tsx` · `src/kanban/janela/{JanelaDoCard,api}.ts(x)` · `src/componentes/ui/Avatar.tsx` · `src/autenticacao/{api,tipos,guardas}.ts(x)` · `src/dashboards/api.ts` · `src/lib/aoVivo.ts`.
- **Bateria:** blocos 95–97 (+ ensaio ×100) em `supabase/testes/testar-migrations.mjs`. **Testes de tela novos:** `Entrar.test.tsx`, `dashboards/TemposPessoas.test.tsx`.
- **Aprendizados:** A-80 em [[PLT - Memoria de Aprendizado]] (as três regras do harness para blocos novos).
- **Pendências técnicas anotadas (não desta sessão):** o PIN duplicado histórico se revela no uso (hash com sal não denuncia duplicata parada). ~~Foto nas portas antigas~~ → resolvida ainda na sessão: a 97 recria a porta dos tempos por pessoa do dashboard (coluna `foto_caminho`) e a da produção do pedido (chave `foto` nas execuções e no resumo por pessoa); `Pessoas.tsx` e `ProducaoDoPedido.tsx` mostram o avatar.

## Ver também

[[SESSAO-36]] · [[SESSAO-36 - Tablet 2.0 - Login por Setor Auxiliares e Tempos por Pessoa]] · [[PLT - Decisoes de Produto]] (D-146) · [[PLT - Lei de Desempenho e Escala]] · [[handoff_2026_10_17_sessao33_tiny_completo]] · [[000 - MAPA DO PROJETO]] · [[000 - PROXIMOS PASSOS]]
