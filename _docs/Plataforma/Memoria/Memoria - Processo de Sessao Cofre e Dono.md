---
titulo: "Memória de aprendizado — Processo de Sessao Cofre e Dono"
tipo: memoria-tema
tema: processo
atualizado: 2026-11-18
tags: [memoria, aprendizado, tema/processo]
---

# 🧠 Memoria - Processo de Sessao Cofre e Dono

> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (`### E-NNN`); o próximo número livre está no índice.

## 🔴 Erros e correções (E-NN)

### E-6

- [2026-08-19] **E-06** (Cowork) · Colei um `file_uuid` truncado no commit de arquivos → 1 arquivo rejeitado (HTTP 400) → **correção:** reenviado e commitado; **regra:** IDs sempre copiados por inteiro e todo commit conferido pelo `"rejected":[]` no resultado.

### E-8

- [2026-08-24] **E-08** (Cowork) · Escrevi o prompt do Bloco 1 com ~200 linhas repetindo decisões que já estavam no cofre → **correção:** reescrito em 3 linhas apontando só o caminho; regra permanente em [[Memoria - Modelos Formulas e Possibilidades#F-6|F-06]] e [[D-017 - Formato dos prompts do Claude Code minimo so o caminho|D-17]].

### E-31

- [2026-09-16] **E-31** (Claude Code) · Numa rodada de ajuste dei fórmulas de fonte DIFERENTES por cartão da mesma linha de KPIs — o de moeda encolheu e ficou destoante → **correção:** uma classe só para o conjunto, calibrada pelo **pior caso**. **Lição: em conjunto de indicadores, o conteúdo mais largo dita o tamanho de TODOS; tipografia é do conjunto, não do item.**

### E-42

- [2026-09-26] **E-42** (Claude Code) · Na conferência da SESSAO-25 escrevi o filtro de personalizado como `PERSON(A|LA)LIZADO` — **não pegava** o "PERSONLAIZADO" que a própria demanda citava, nem PERSONALIZADA/PERSONALZADO → **correção:** antes de codar, contei as grafias REAIS no histórico (`pedido_itens`: 6 variações) e a regra única virou `person[a-z]{0,6}z` em `plt_privado.fn_eh_personalizado`. **Lição: regra de texto sobre dado de integração se calibra no dado real (agrupar as grafias), nunca no enunciado — o erro de digitação que você conhece não é o único.**

### E-44

- [2026-09-27] **E-44** (Claude Code) · No checkpoint da SESSAO-24 perguntei ao dono **quais etapas iniciam o tempo** e propus cadastrar uma marca nova por etapa — o código já respondia: a migration 30 define **fila → próxima etapa (o início)** e todo setor de produção tem **CONCLUÍDO**. O dono: *"você já viu o código?"* → **correção:** o arrastar usa a estrutura que existe (fila · início = próxima etapa · CONCLUÍDO), nada novo cadastrado. **Lição: antes de levar pergunta ao dono, conferir se o código ou o banco já respondem — grep na migration da regra vizinha + consulta às etapas cadastradas. Pergunta cuja resposta está no repo gasta a paciência do dono e a confiança na sessão.**

### E-49

- [2026-09-28] **E-49** (Claude Code) · Nas conversas das sessões paralelas (SESSAO-24, SESSAO-26 e as de ajuste), as mensagens ao dono vieram cheias de código — números de decisão, de erro, de migration, hash de commit, nome de branch. O dono: *"não fique falando em códigos… quem entende isso é a máquina, não eu nem ninguém — fale português"* → **correção:** virou lei no CLAUDE.md (regra 12c, espelhada no cofre). **Lição: o código é a memória da máquina; para o dono, só a tradução — o que a coisa é e o que ela faz.** (Bônus do mesmo dia: duas sessões mexendo no mesmo arquivo da pasta principal ao mesmo tempo — uma desfez a própria linha com checkout e levou junto a linha da outra; cada sessão mexe só na PRÓPRIA worktree.)

### E-76

- [2026-10-01] **E-76** (Claude Code, SESSAO-29) · Ao retomar a sessão depois de um resumo de contexto, tratei o trabalho como contínuo ("a 2ª rodada fechou há pouco, são ~07:10 UTC") e ia datar o diagnóstico e o relatório assim — o `now()` do banco, devolvido de carona numa consulta, dizia **22:48 UTC**: a sessão tinha ficado parada ~15 h (o dia inteiro de vendas passou no meio). Nada foi escrito com a hora errada → **correção:** toda hora do relatório saiu do banco, e o "dia em produção" (avisos, pedidos novos, erros nos registros) entrou na conferência antes de declarar entregue. **Lição: depois de retomar (resumo, pausa, aviso de "faz tempo"), a primeira consulta pega `now()` do banco — a hora do relatório nunca sai da continuidade da conversa; e se passou um dia, conferir o que o dia fez com a mudança antes de fechar.**

### E-82

- [2026-10-02] **E-82** (Claude Code, SESSAO-28) · Levei ao dono a pergunta 4 da demanda ("servidor público do motor de rotas ou hospedar no servidor da casa?") com o dilema técnico inteiro — limite de pedidos por segundo, "uso não comercial", motor de rotas, memória da máquina do n8n. O dono: *"Que miséria é isso? Não entendi nada"* → **correção:** reexplicada em uma frase, já com a escolha feita ("o cálculo é feito por um site gratuito da internet; se um dia sair do ar, a tela volta à linha reta — vou usar ele, não precisa decidir nada agora"). **Lição: pergunta técnica que a demanda manda fazer mas cuja resposta não muda nada no dia a dia do dono vai como ESCOLHA FEITA + uma frase de consequência ("se X acontecer, a tela faz Y") — nunca como dilema de infraestrutura; a regra de falar português vale também para o CONTEÚDO da pergunta, não só para os códigos.**

### E-86

- [2026-10-07] **E-86** (Cowork — achado pelo Claude Code no início da SESSAO-30) · O `000 - PROXIMOS PASSOS` gravado pelo Cowork em 06–07/10 (fora do git) partiu de uma cópia de **01/10** e, sem querer, **desfazia** o registro de 02–03/10 — SESSÕES 27, 28 e 29 voltavam a "falta fazer" e o P17 voltava a aberto. Commitar como estava teria apagado a história recente do plano → **correção:** achada a base da cópia (a versão do git com o MENOR diff contra o arquivo — 15 linhas, só o acréscimo), mesclado em 3 vias (`git merge-file` gravado × base × HEAD): fica o que o Cowork acrescentou, volta o que tinha sumido. **Lição: nota do cofre gravada fora do git por outra frente se confere contra o git ANTES do commit — linha removida no diff de quem só devia acrescentar é sinal de cópia velha; nunca commitar por cima, mesclar com a base certa.**

### E-94

- [2026-10-14] **E-94** (Claude Code, SESSAO-31) · Os comentários do ClickUp abriam com "Entregue (14/10, sessão noturna)"/"madrugada", citavam o link técnico da janela e "a próxima entrega"; e as descrições criadas no Cowork terminavam com "Sessão: SESSAO-NN — … (cofre: …)" — o dono pediu tudo humanizado. → **Correção:** descrições (15 tarefas) e comentários (10) reescritos sem sessão, códigos, arquivos ou cofre; a regra foi para o CLAUDE.md (regra 19: texto no ClickUp é humanizado, no padrão das tarefas antigas).

### E-109

- [2026-10-16] **E-109** (Claude Code, SESSAO-33) · Com o dono no celular e fora de casa, o plano da Etapa B virou textão + quatro perguntas de toque, depois de outras perguntas na mesma noite — resposta dele: *"para de me perguntar, só faz, eu não tô em casa"*. **Correção:** daqui ao fim da sessão, nenhuma pergunta: escolha sensata registrada no cofre e o que exige OK de produção sai pronto em arquivo para casa. **Lição: sessão remota com o dono longe = UMA rodada de perguntas, curta, só do que ninguém mais decide; o pedido colado já é a autorização do resto.**

### E-131

- [2026-10-21] **E-131** (Claude Code, SESSAO-38 casca — o erro é da SESSAO-06/13) · O painel do sino "não fechava clicando fora": o fechamento era um fundo invisível `fixed inset-0` DENTRO do `aside` do menu, e o `translate` do aside (também no computador — `lg:translate-x-0` ainda é transform) faz dele o bloco de contenção do `fixed` (o [[Memoria - Front Telas e React 1#E-48|E-48]] já tinha avisado) — o fundo cobria só a barra lateral; onde cobria, comia o clique → **correção:** sem fundo; `pointerdown` na fase de CAPTURA da janela enquanto aberto (roda antes do Leaflet e de quem chama `stopPropagation`, sem `preventDefault` — o toque segue para o alvo), Esc, troca de tela, e o painel em portal no `body` (camada 58). **Regra:** "fechar ao tocar fora" nunca é um fundo invisível dentro de um ancestral com transform/overflow — é escuta de captura na janela + portal.

### E-171

- [2026-10-31] **E-171** (Claude Code, SESSAO-42) · Li "horário de todos os setores = 07:30–12:00 e 13:00–18:00" como "semear horário em quem não tem" — 3 testes da [[D-029 - Controle de tempo pelo admin horario de funcionamento pausas|D-29]] ("sem horário conta tudo") quebraram → **correção:** a migration só troca a faixa única por duas; setor sem horário segue contando o dia todo (em produção todos já têm). **Lição: dado de configuração muda o que EXISTE; criar dado novo onde não havia é outra decisão.**

### E-230

- [2026-11-05] **E-230** (Claude Code, SESSAO-46) · O ensaio de volume no banco real (5 mil sugestões falsas num bloco `DO` que termina em `raise` — tudo desfeito) **avançou a numeração** da tabela nova: a 1ª sugestão de verdade nasceu #5001 (a sequência de um `identity` não volta no rollback) → **correção (05/11, com o "pode apagar" do dono):** numa transação, a trava da história das sugestões desligada e religada, apagadas as 3 sugestões, os 11 fatos, as 2 pendências de teste (tarefas 29 e 30) e os 3 avisos; numeração das duas tabelas reiniciada (`restart with 1` — a próxima é a #1); armário já vazio. **Os 26 registros de atividade do teste ficaram:** o ambiente recusou de novo desligar a trava da trilha de atividade (auditoria), mesmo com o OK do dono — não contornei; quem quiser apagá-los roda o SQL no painel da Supabase. **Lição: ensaio de volume em tabela cujo número a pessoa VÊ (sugestão #N, pedido) gasta a numeração — ensaiar com a sequência guardada e devolvida (`setval` no fim do bloco, antes do `raise`) ou numa tabela de rascunho.**

### E-264

- [2026-11-11] **E-264** (Claude Code, SESSAO-48) · O app fechou no meio da bateria e da montagem (as duas em segundo plano morreram sem registro) e, ao reabrir, a pasta de rascunho da sessão MUDOU (pasta nova e vazia; a antiga ficou no disco). → **Correção:** os programas pequenos (subida, acerto, resolvedores) copiados para a pasta nova; os testes rodados de novo. **Lição:** o programa de subida não pode depender de o rascunho sobreviver — guardar o caminho do rascunho no diário e, ao reabrir, conferir as duas pastas.

### E-284

- [2026-11-12] **E-284** (Claude Code, SESSAO-50 · frente 4) · Usar `useAcessoLogistica` na janela do card quebrou 5 testes antigos da janela: os testes simulam a sessão sem `vinculos` e o gancho fazia `vinculos.some(…)`. → **Correção:** `(vinculos ?? []).some(…)` no gancho (a sessão de verdade sempre tem a lista; o teste não precisa saber do gancho novo).

### E-291

- [2026-11-17] **E-291** (Claude Code, SESSAO-51) · Anotei os horários da subida 3 h adiantados ("no ar ~07:20" quando foi ~04:20 de Natal): no Git Bash desta máquina `TZ=America/Fortaleza date` imprime **GMT** (não há a base de fusos), e eu tratei como hora de Natal — foi parar no cofre, no ClickUp e na conversa com o dono. → **Correção:** o `date` comum desta máquina já é a hora de Natal (−03:00 — confere com o `%ci` do `git log`); na dúvida, `node -e "console.log(new Date().toLocaleString('pt-BR',{timeZone:'America/Fortaleza'}))"`. Horários corrigidos nas notas e nos comentários do ClickUp.

### E-125

- [2026-10-21] **E-125** (Claude Code, SESSAO-38 · frente da Logística) · As frentes paralelas da mesma sessão dividem **a MESMA pasta de rascunho** (scratchpad): gravei a saída da bateria em `banco1.log` e o arquivo era de outra frente com o mesmo nome — li "2 falharam" e uma migration que não era minha (20261022010000) na lista e quase concluí que a minha não tinha rodado → **correção:** subpasta própria (`scratchpad/f2log/`) para todo arquivo da frente, e a bateria rodada de novo com o log nela. **Regra:** em sessão com várias frentes, nada de nome genérico no rascunho — subpasta por frente; e conferir na saída que a migration NOVA aparece na lista antes de confiar no resultado.

### E-142

- [2026-10-21] **E-142** (Claude Code, supervisor da SESSAO-38) · Duas frentes paralelas escreveram blocos da bateria com os MESMOS usuários de teste (`auth_user_id ...3801–3803`) — cada uma verde sozinha, juntas quebraram com "duplicate key plt_usuarios_auth_user_id_key" → **correção:** o bloco de uma delas foi para a faixa `...3811–3815`. **Lição: além de D/E/A e migration, a reserva de numeração entre frentes inclui a FAIXA de ids de teste da bateria.**

### E-143

- [2026-10-21] **E-143** (Claude Code, supervisor da SESSAO-38) · O [[Memoria - Migrations Aplicador e Ensaio 1#E-73|E-73]] por outro caminho: as frentes aplicaram as migrations às ~03h (compatíveis com o site antigo), mas a sessão ficou parada ~8 h por limite de uso antes da publicação — o site velho conviveu com o banco novo durante o turno (ex.: a Programação já listava pedidos em produção e o "Entregue" deles pedia uma confirmação que o site velho não sabia dar) → **correção:** publicado assim que a sessão voltou (11h40), registros do banco sem erro. **Lição: "compatível com o site antigo" não é "igual ao site antigo" — migration aplicada e tela publicada devem andar juntas; se houver pausa longa, publicar antes de pausar.**

### E-293

- [2026-11-18] **E-293** (Claude Code, SESSAO-49) · Ao encurtar a Ordem das Sessões, escrevi de cabeça o status da SESSAO-08 ("o site foi ao ar em 01/10") — o texto original dizia "fechada em 16/10 ([[D-141 - As respostas do dono sobre o que ficou da SESSAO-32 e|D-141]])". Pego na conferência da própria linha contra a tabela arquivada, antes do commit → **correção:** a linha reescrita com o que o texto original diz. **Lição:** resumo de linha de índice sai do texto que está sendo resumido (por roteiro, ou conferido contra ele), nunca da memória — é o [[Memoria - Tiny n8n e Integracoes 1#E-36|E-36]] fora do banco.

### E-294

- [2026-11-18] **E-294** (Claude Code, SESSAO-49) · A primeira versão da Ordem curta pôs ligação com apelido (nota, barra, rótulo) dentro de célula de tabela: a barra do apelido fecha a célula e a linha quebra no Obsidian → **correção:** dentro de tabela a barra do apelido leva barra invertida na frente; o verificador (`--ligar`) já escreve assim sozinho quando a linha é de tabela. **Lição:** ligação com apelido em tabela só pelo verificador, ou com a barra escapada.

## 🟢 Acertos que viraram padrão (A-NN)

### A-33

- [2026-09-28] **A-33** (Claude Code) · **Reserva de numeração entre sessões paralelas se confere em TODAS as cópias, não só na `main`.** Em 28/09 a sessão do Frete reservou [[D-063 - Frete nao vira peca de producao o resto nasce no PCP e o PCP|D-63]], [[Memoria - Tiny n8n e Integracoes 1#A-25|A-25]], [[Memoria - Front Telas e React 1#E-48|E-48]] e [[Memoria - Processo de Sessao Cofre e Dono#E-49|E-49]] olhando a `origin/main` (onde estavam livres), mas o A-25 já existia **não commitado** na pasta principal (achado do webhook do Tiny) e o E-48 já estava **commitado** na branch da gaveta do celular. Uma varredura só achou os dois antes de qualquer commit: `git worktree list --porcelain` e, em cada pasta, `grep` dos números na Memória, Decisões, Perguntas e Requisitos + a lista de migrations novas. A sessão renumerou ([[Memoria - Git Shell e Windows 1#E-55|E-55]], [[Memoria - Git Shell e Windows 1#E-56|E-56]], [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 2#A-31|A-31]]) antes de commitar. Número novo = acima do maior da `origin/main` **e** do que aparece nas worktrees; e avisar as outras sessões do que foi tomado.

### A-4

- [2026-08-17] **A-04** · **Dupla escrita antes do corte** (P15): novo destino recebe em paralelo até provar paridade, só então corta.

### A-5

- [2026-08-19] **A-05** (Cowork) · Entrevista de decisões com IDs (`D-NN`) ANTES de arquitetar → dúvida respondida vira decisão registrada; ninguém rediscute do zero.

### A-6

- [2026-08-19] **A-06** (Cowork) · Demanda com "Fora do escopo" explícito evita o "aproveitar para fazer" — manter em toda SESSAO-NN.

### A-76

- [2026-10-17] **A-76** (Claude Code, SESSAO-33 — em casa) · **Sessão na nuvem (o dono pelo celular) → trazer para casa.** O dono chama de "a sessão que está em remote control". Ela não aparece na lista de sessões do app; aparece no `ListAgents` (linha "cloud") só com o controle remoto ligado na sessão de casa (ligar só a pedido do dono) e se lê pelo Chrome do dono (o navegador do app não tem login no claude.ai; as "Saídas" só abrem com ela rodando; o filtro da extensão barra texto com endereço com parâmetros — não contornar). Para ela gravar no GitHub da organização, o **aplicativo do Claude precisa estar instalado na Moveis-Domoby com acesso ao Fabrica_processo** (o dono liberou em 17/10 e o envio passou na hora); a de casa espera a branch aparecer olhando o GitHub em segundo plano e a traz com `git switch --track`.

### A-93

- [2026-10-21] **A-93** (Claude Code, SESSAO-38 casca) · **"O dono ainda faz X do jeito chato" — antes de construir, achar POR QUE o jeito bom não pegou.** O pedido era "entrar por nome de usuário"; o login por usuário existia desde a SESSAO-03 e os 16 cadastros tinham usuário. A causa estava na experiência: a tela não lembrava de ninguém (sessão cai com 8 h paradas — 19 entradas do dono em 7 dias, contadas na trilha), campos sem `name` para o navegador, o caminho do PIN só com e-mail, e nada ensinava o próprio usuário. Conserto pequeno e na causa: o servidor devolve o usuário de quem acertou a senha e o aparelho lembra (`localStorage` com try/catch), o PIN aceita usuário, a busca ignora acento/espaço/maiúscula. Método: contar no banco (cadastros sem usuário, entradas por pessoa) e ler a tela como quem usa — nada de coluna nova.

### A-101

- [2026-10-21] **A-101** (Claude Code, supervisor da SESSAO-38) · **Supervisor com frentes em paralelo, sem atropelo:** cada frente numa cópia isolada (worktree temporária, nunca a pasta principal com outra sessão ativa), dona exclusiva de arquivos E de funções do banco, numeração e prefixo de migration reservados, migration aditiva aplicada com `--so` pela própria frente; a frente que mexe no que as outras mexem (tempo + stand-by) DESENHA primeiro e IMPLEMENTA depois sobre a integração; junção com união dos `.md` (`git merge-file --union`) e cada bloco da bateria no seu `{ }`; conferência visual por vitrine. 5 frentes, 13 pedidos, 6 migrations, 0 conflito de função.

### A-125

- [2026-10-28] **A-125** (Claude Code, ajuste 28/10) · **"A mesma resposta para quem tem e quem não tem cadastro" + erro de digitação = sugestão LOCAL:** a distância de edição (com troca de vizinhas) do domínio contra uma lista fixa de provedores (1 erro nos curtos, 2 nos longos) sugere o e-mail certo sem consultar o banco — a privacidade da [[D-191 - ESQUECI MINHA SENHA LIBERADO POR UM ADMINISTRADOR aviso|D-191]] fica de pé; o aviso ao administrador do e-mail sem cadastro fecha o outro lado.

### A-144

- [2026-11-05] **A-144** (Claude Code, SESSAO-43) · **O total em cima de TODA barra empilhada (Recharts):** rótulo na última série só aparece quando ela tem valor naquele dia. O que funciona: uma série a mais no topo da pilha, invisível, com valor quase zero (`topo: 1e-6`, sem cor, fora da legenda e da dica) carregando o `LabelList` com o total do dia — o rótulo sempre tem onde sentar, em qualquer barra.

### A-146

- [2026-11-05] **A-146** (Claude Code, SESSAO-43) · **Percentis baratos:** `percentile_cont(array[0.25, 0.5, 0.75]) within group (order by x)` faz os três numa ordenação só; "o melhor de cada pessoa contra o padrão do modelo" sai do menor tempo por (pessoa, modelo) — o padrão é um só por modelo — sem ordenar todas as linhas; "os 8 melhores móveis" = agrupar por modelo (min e quantos), cortar 8 e só então buscar a linha do menor tempo.

### A-190

- [2026-11-05] **A-190** (Claude Code, SESSAO-46) · **Canal ao vivo novo sem recriar a função compartilhada:** em vez de mexer em `fn_aviso_pode_ouvir` (que outra sessão em paralelo também podia recriar — a última a subir apaga a da outra), a área nova ganhou a SUA política em `realtime.messages` (`plt_sugestoes_ouvir`, tópico exato). Políticas permissivas somam; a migration fica 100% aditiva e não conflita com ninguém.

### A-202

- [2026-11-09] **A-202** (Claude Code, SESSAO-47) · **Leitura do banco vivo barrada pelo ambiente: não contornar — usar o que o dono abre.** O dono entrou no site publicado pelo navegador do app; só olhando telas (sem tocar em botão que muda algo) deu para conferir o que a entrega dependia: a chave "Entregue vai ao Tiny" ligada, a Expedição de hoje, o lugar certo da chave no menu. O que só o banco responde (o corpo das funções vivas contra as migrations) vira passo explícito do pedido de OK da aplicação.

### A-214

- [2026-11-11] **A-214** (Claude Code, SESSAO-48 · frente 5) · **O armazenamento do jsdom não se espia pelo protótipo** (`vi.spyOn(Storage.prototype, …)` não pega): `vi.stubGlobal('sessionStorage', …)`.

### A-228

- [2026-11-12] **A-228** (Claude Code, SESSAO-50 · bloco A) · **O sino de erro de automação só chega a quem ligou esse aviso** (Configurações → Avisos, filtro na gravação — ajuste de 28/10): falha nova que "avisa o admin" precisa de tipo no catálogo e de alguém com o aviso ligado; a bateria confere pela tabela dos avisos, não pelo sino de uma pessoa.

### A-230

- [2026-11-12] **A-230** (Claude Code, SESSAO-50) · **Três blocos em paralelo com o supervisor fazendo o maior (B) e dois ajudantes em cópias no rascunho (A e C):** a base comum commitada antes (os tipos de fato das três, a tabela da observação, as colunas), cada bloco com migration reservada (02, 05, 06) e escopo próprio na bateria; ao juntar, o único conflito foi a lista da cadeia do bloco 38 (as duas migrations entram em ordem). Conferir por programa, antes, que nenhuma função é recriada por dois blocos (o A recriava `fn_quadro_cards`; o B, não).

### A-234

- [2026-11-12] **A-234** (Claude Code, SESSAO-50 · bloco C) · **Gesto que grava fato não grava registro de atividade próprio:** todo fato já vira registro sozinho (`fn_logar_evento`); gravar outro com a mesma ação faz a Auditoria mostrar a linha duas vezes.

### A-244

- [2026-11-18] **A-244** (Claude Code, SESSAO-49) · **Reorganizar o cofre é trabalho de roteiro, com prova de que nada se perdeu.** As 291 decisões, as 439 lições, os 120 blocos do esquema e os 53 do modelo de sistema foram separados por roteiro lendo os títulos, e cada roteiro só termina se a prova passar: cada bloco de origem relido, inteiro, em exatamente UMA nota de destino; a contagem por tipo igual antes e depois; no banco, todo nome entre crases de antes existe depois (2.312 = 2.312). Transformar citação em ligação tem a prova dela: tirando as ligações, o texto é o mesmo de antes. Os roteiros ficam em `scripts/cofre/migracao/` como registro. Padrão: mover conteúdo = roteiro + prova; à mão, só o texto novo (mapas, resumos, regras).

### A-245

- [2026-11-18] **A-245** (Claude Code, SESSAO-49) · **No Obsidian, apelido (`aliases`) não é destino de ligação** — só aparece na busca e no completar. Ligação que precisa abrir leva o NOME DO ARQUIVO, com o id curto como rótulo. Por isso o nome da nota de decisão é descritivo (aparece no grafo em português) e a citação é ligação com rótulo; quem escreve a ligação é o verificador (`--ligar`), a primeira de cada id por seção, para a nota não inchar.

### A-246

- [2026-11-18] **A-246** (Claude Code, SESSAO-49) · **Classificar centenas de textos por palavra-chave: a manchete pesa mais, a palavra larga pesa menos, e o erro que sobra se resolve pelo índice.** A 1ª classificação das lições por tema (contagem simples de palavras) mandou tela para "banco" e shell para "Tiny"; melhorou com peso 3× para os primeiros 260 caracteres, peso por palavra (as estreitas — `rls`, `crlf`, `vercel` — valem 3; as largas — "tabela", "tela" — valem 1) e correção à mão onde importa (80 decisões, 19 blocos do banco). O que ficou no tema errado continua achável: o índice gerado diz em que nota cada id está, e mover a entrada de nota não quebra nada.
