---
titulo: Regras de Ouro — a leitura obrigatória, em uma nota
tipo: regras
criado: 2026-11-18
atualizado: 2026-11-18
tags: [regras, leitura-obrigatoria, cofre]
---

# 🥇 Regras de Ouro

> [!danger] Leitura obrigatória de TODA sessão — inteira, junto com o `CLAUDE.md` da raiz
> Esta nota e o `CLAUDE.md` são a **camada 1**: tudo o que vale sempre, em uma linha por regra. O detalhe mora na nota ligada — **abra só a que a sua demanda tocar**. Daqui a sessão segue para a seção "Leitura da sessão" da demanda (os mapas de `Mapas/`) e, depois, só para o que as ligações e a busca pedirem.
> **Teto: esta nota ≤ 30 KB; camada 1 ≤ 40 KB** (o verificador mede). Regra nova só entra aqui se vale para toda sessão — e, se o teto apertar, sai a menos citada.

## 1. Leis do produto (D-01…D-17 — nada pode contrariá-las)

- [[D-001 - Unidade do card hibrido|D-01]] · O PCP vê o **pedido inteiro**; ao liberar, cada móvel vira **um card por unidade**.
- [[D-002 - Timer dois contadores por etapa dash compara e soma|D-02]] · Tempo em **dois contadores por etapa**: parado na fila e na etapa em si; o painel compara e soma.
- [[D-003 - Destino do card manual hoje automacao via API amanha|D-03]] · O destino do card é **manual**; a automação move por regra (revista pela [[D-099 - A automacao pode mover o card sozinha e serve para tudo quem|D-99]]).
- [[D-004 - Produtividade e bonificacao|D-04]] · Produtividade e bonificação: tema **encerrado** pela [[D-094 - Bonificacao descartada|D-94]] (bonificação descartada).
- [[D-005 - Escopo producao primeiro logistica depois|D-05]] · Produção primeiro, logística depois (revista pela [[D-033 - ROTAS dentro da plataforma ClickUp nao recebe mais nada|D-33]]: ROTAS mora na plataforma).
- [[D-006 - Dispositivos tablet PC fixo por setor E celular pessoal|D-06]] · **Tablet/PC fixo por setor e celular pessoal**: tudo que o operador toca funciona nos dois.
- [[D-007 - Estoque modulo da mesma plataforma fase 2|D-07]] · Estoque é módulo da mesma plataforma.
- [[D-008 - Banco o mesmo Supabase da fabrica|D-08]] · O banco é **o mesmo Supabase da fábrica**.
- [[D-009 - Qualidade em 3 estados em TODA transicao com dupla atestacao|D-09]] · Qualidade em **3 estados** em toda transição, com dupla atestação (hoje configurável — [[D-126 - A marcacao do estado da peca perfeito atencao danificado vira|D-126]]).
- [[D-010 - Metodo de trabalho sessoes Claude Code ordenadas CLAUDE md|D-10]] · Método: **sessões ordenadas** do Claude Code, com o `CLAUDE.md` como limite.
- [[D-011 - API antecipada entrada de pedidos via n8n logo apos o kanban|D-11]] · Entrada de pedidos pela integração logo depois do kanban (revista pela [[D-023 - Replanejamento da jornada a partir da 5 posicao|D-23]] e pela [[D-031 - Entrada de pedidos a plataforma le o proprio banco sem tocar|D-31]]).
- [[D-012 - Setores do dia 1 os do ClickUp estrutura em 2 niveis|D-12]] · Setores do dia 1 = os do ClickUp; estrutura em 2 níveis **configurável**.
- [[D-013 - Entrada unica e saidas terminais do fluxo|D-13]] · **Entrada única** e saídas terminais do fluxo.
- [[D-014 - Etapas internas cadastro livre cada uma com timer proprio|D-14]] · Etapas internas: **cadastro livre**, cada uma com timer próprio; nada semeado.
- [[D-015 - Stack escolhida pelo Claude Code e imutavel depois|D-15]] · A stack foi escolhida uma vez e **não muda**.
- [[D-016 - Bloco 1 de construcao Sessoes 01 05|D-16]] · Bloco 1 de construção = sessões 01→05 (histórico).
- [[D-017 - Formato dos prompts do Claude Code minimo so o caminho|D-17]] · Prompt do Claude Code é **mínimo: só o caminho** — o que está no cofre não se repete.

## 2. As decisões que mais pegam (as vigentes mais citadas nas demandas)

**Vale em toda tela e toda porta**
- [[D-040 - Auditoria total toda atividade de usuario gera log persistido|D-40]] · **Toda atividade de usuário gera registro** no banco (auditoria total).
- [[D-027 - Padroes de interface menu lateral modelo de sistema no cofre|D-27]] · Padrões de interface: menu lateral, modelo de sistema no cofre, **nenhum código interno na tela**.
- [[D-036 - Lei de navegacao hierarquia pai filho pai nunca navega rota|D-36]] · Navegação **pai→filho**: pai nunca é rota; tudo é `/pai/filho`; nada solto na raiz.
- [[D-047 - Regra permanente nenhuma tabela nova se uma existente pode|D-47]] · **Nenhuma tabela nova** se uma existente pode ser reaproveitada.
- [[D-068 - Dados sensiveis do cadastro fora da API|D-68]] · **Dado pessoal fora da API**: lido só por porta própria; coluna nova de usuário pede permissão explícita.
- [[D-100 - O Painel admin vira Configuracoes nasce o Painel super admin|D-100]] · "Painel admin" é **Configurações**; o Super admin (só o dono) tem Automações e Auditoria.
- [[D-202 - OS AVISOS QUE CADA UM RECEBE ESCOLHIDOS EM CONFIGURACOES|D-202]] · Os avisos que cada um recebe se escolhem em Configurações → Avisos; erro de automação vira aviso.
- [[D-019 - Banco o projeto da org Tech e o de producao e por ora e onde|D-19]] · O banco de trabalho **é o de produção** — por isso nada se aplica sem o OK do dono.
- [[D-020 - Sem PR e sem protecao de branch enquanto o dono for o unico|D-20]] · Sem PR enquanto o dono for o único no repositório: a revisão é na conversa.
- [[D-303 - A versao e o codigo e documentacao nao publica a mudanca|D-303]] · ⏳ **Documentação não publica o site**; a versão é o código (subir código na main publica).

**Produção, PCP e estoque**
- [[D-063 - Frete nao vira peca de producao o resto nasce no PCP e o PCP|D-63]] · **Frete não vira peça**; o resto nasce no PCP, e o PCP escolhe o lugar.
- [[D-088 - O PCP em tres abas Reabastecimento Pedidos aguardando|D-88]] · O PCP em abas: Reabastecimento · Pedidos aguardando liberação · Todos os pedidos.
- [[D-132 - O PCP segue o Tiny pedido Faturado Pronto para envio|D-132]] · **O PCP segue o Tiny**: Faturado, Pronto para envio ou Enviado sai do PCP.
- [[D-096 - O pedido vivo que so a conferencia achou entra no PCP|D-96]] · Pedido vivo que só a conferência achou **entra no PCP**.
- [[D-201 - O PEDIDO NOVO USA PELO PCP A PECA SEM DONO QUE JA ESTA|D-201]] · O pedido novo usa, pelo PCP, a **peça sem dono que já está em produção**.
- [[D-062 - A sugestao do estoque na liberacao o que e peca igual e quem|D-62]] · Na liberação, o estoque **sugere** a peça igual; quem aceita é o PCP.
- [[D-126 - A marcacao do estado da peca perfeito atencao danificado vira|D-126]] · A marcação do estado da peça (perfeito/atenção/danificado) é **configuração** por setor.
- [[D-290 - Mover a peca para CANCELADO ou NAO ENCONTRADO cancela|D-290]] · Mover para CANCELADO ou NÃO ENCONTRADO **cancela a fabricação de verdade**.
- [[D-307 - Cancelar pedido e Ocultar do PCP no lugar do Remover do PCP|D-307]] · No PCP, "Cancelar pedido" e "Ocultar do PCP" (não existe mais "Remover").
- [[D-330 - Mover para o PCP a peca em producao volta ao PCP como vaga|D-330]] · "Mover para o PCP": a peça em produção volta como vaga do pedido ou vira reposição.
- [[D-203 - O TEMPO CERTO o calendario da fabrica a pausa sozinha no fim|D-203]] · **O tempo certo**: calendário da fábrica, pausa sozinha no fim do expediente, cálculo único.

**Logística, entrega e Tiny**
- [[D-113 - Entregue e um fato so dos dois lados e entregue no Tiny fecha|D-113]] · **"Entregue" é um fato só**, dos dois lados; entregue no Tiny fecha tudo do pedido aqui.
- [[D-108 - A rota da Programacao e calculada PELAS RUAS parte da fabrica|D-108]] · A rota é calculada **pelas ruas**, sai da fábrica e volta para ela.
- [[D-221 - A rota vai SEMPRE pelo endereco do cliente o ponto e so|D-221]] · A rota vai **sempre pelo endereço do cliente**.
- [[D-325 - Na entrega parcial o que ainda esta na fabrica CONTINUA|D-325]] · Na entrega parcial, o que ainda está na fábrica **continua em produção**.
- [[D-050 - Integracao Tiny banco edicao no Tiny edita aqui apagar|D-50]] · Edição no Tiny edita aqui; **apagar no Tiny não apaga aqui**; conferência diária de madrugada.
- [[D-311 - O pedido excluido no Tiny sai do PCP de vez e segue o caminho|D-311]] · Pedido excluído no Tiny **sai do PCP de vez** e segue o caminho do cancelado.
- [[D-031 - Entrada de pedidos a plataforma le o proprio banco sem tocar|D-31]] · A plataforma lê **o próprio banco**; não toca o n8n para receber pedido.
- [[D-143 - Tiny completo o plano aprovado inteiro o que o Tiny nao avisa|D-143]] · Tiny completo: por evento; o que o Tiny não avisa, de hora em hora (8h–20h) e na madrugada.

**Pessoas e acesso**
- [[D-043 - Meu Perfil nome de login editavel pelo proprio e-mail tambem|D-43]] · Meu Perfil: a pessoa edita o próprio nome de login, e-mail e foto — com registro de tudo.
- [[D-091 - Tres tipos de usuario da fabrica do comercial e dos dois|D-91]] · Três tipos de usuário: da fábrica, do comercial e dos dois.
- [[D-147 - A arrumacao para entrar em producao limpa geral PINs curtos|D-147]] · PINs curtos, níveis produção/logística, pausa por pessoa, "ajudar" em tudo (com a [[D-146 - Tablet 2 0 as 13 respostas provisorias da SESSAO-36|D-146]] ⏳).
- [[D-046 - Uniao das Plataformas o Painel de Recompra vira o modulo|D-46]] · O Painel de Recompra **é o módulo Comercial** desta plataforma.

> ⏳ **Provisórias:** cerca de um terço das decisões é provisória (escolha da sessão, esperando o dono). Elas **valem** até o dono dizer o contrário; estão marcadas no índice [[PLT - Decisoes de Produto]].

## 3. Nunca mais (as lições que mais custaram ou mais se repetiram)

**Banco**
- [[Memoria - Tiny n8n e Integracoes 1#E-36|E-36]] · **Nome de tabela/coluna nunca sai de memória** (repetiu 6 vezes): sai da nota do domínio em `Banco/` ou da migration.
- [[Memoria - Migrations Aplicador e Ensaio 2#E-19|E-19]] · Reaplicar tudo quebra check antigo: check de migration antiga é `not valid`; a mais nova valida.
- [[Memoria - Migrations Aplicador e Ensaio 1#E-24|E-24]] · **Ajuste aplicado direto no banco some** na próxima reaplicação: tudo que muda o banco vira migration no repositório.
- [[Memoria - Banco e SQL 1#E-20|E-20]] · `add column if not exists` **pula em silêncio** a coluna que outra frente criou diferente: conferir o desenho depois de aplicar.
- [[Memoria - Acesso Seguranca e Credenciais#E-50|E-50]] · `revoke` por coluna não vale contra o grant da tabela: **leitura de usuário é por coluna, com grant explícito**.
- [[Memoria - Banco e SQL 1#E-14|E-14]] · Gatilho que não é `security definer` roda com o privilégio de quem grava: o teste local não pega.
- [[Memoria - Desempenho e Tempo Real#E-65|E-65]] · Função com `set search_path` **não é embutida**: cadeia de funções pequenas em porta quente custa caro.
- [[Memoria - Migrations Aplicador e Ensaio 1#E-66|E-66]] · **"Desfeito" não é "invisível"**: ensaio em transação no banco real segura trava até o fim — medir fora do horário e curto.
- [[Memoria - Migrations Aplicador e Ensaio 1#E-41|E-41]] · Migration que passa no teste local pode quebrar **só em produção** (dado que só existe lá): ensaiar com dado real.
- [[Memoria - Migrations Aplicador e Ensaio 1#E-73|E-73]] · **Banco e site sobem juntos**: aplicar a migration com a tela nova ainda na branch quebrou o site no ar.
- [[Memoria - Migrations Aplicador e Ensaio 1#E-81|E-81]] · O bloco da bateria que reaplica uma migration reaplica **na ordem de produção** (a que recria por último vence).
- [[Memoria - Banco e SQL 1#E-161|E-161]] · Teste que troca de papel abre **ponto de volta** antes — senão o erro de verdade fica escondido.
- [[Memoria - Migrations Aplicador e Ensaio 2#A-10|A-10]] · Migration nova: rodar **duas vezes** contra o esquema real e comparar a impressão digital da integração.
- [[Memoria - Testes e Validacao ao Vivo#A-11|A-11]] · Testar em produção sem sujar: bloco que monta, mede e termina com **erro proposital** (só com o OK do dono).
- [[Memoria - Migrations Aplicador e Ensaio 2#A-73|A-73]] · **Ensaio ×100 antes de subir** pega o que a bateria não pega; [[Memoria - Migrations Aplicador e Ensaio 2#A-242|A-242]] · "piorou"? A/B no mesmo banco antes de concluir.
- [[Memoria - Modelos Formulas e Possibilidades#M-13|M-13]] · **Estado guardado é projeção; o evento é a verdade** — projeção só se escreve por gatilho.
- [[Memoria - Modelos Formulas e Possibilidades#M-14|M-14]] · Trava que vale para todos **não mora no RLS** (a chave de serviço ignora): vira gatilho.

**Shell, git e arquivos**
- [[Memoria - Git Shell e Windows 1#E-74|E-74]] · **Nenhum `cd`** (repetiu 5 vezes): o app adota a pasta — sempre caminho absoluto, desde o 1º comando.
- [[Memoria - Git Shell e Windows 1#E-9|E-9]] · Barra invertida some no Git Bash; [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 1#E-15|E-15]] · escape `\u…` é desfeito pela ferramenta: editar com a ferramenta de arquivo ou `node`, e **conferir o resultado**.
- [[Memoria - Git Shell e Windows 1#E-113|E-113]] · Em pasta dividida com outra sessão, **conferir o ramo antes de todo commit**.
- [[Memoria - Publicacao Vercel e Funcoes#E-268|E-268]] · Comando no `vercel.json` tem teto de 256 caracteres: comando longo mora em roteiro.

**Integrações e credenciais**
- [[Memoria - Acesso Seguranca e Credenciais#E-3|E-3]] · **Credencial nunca em chat, print, nota ou commit.**
- [[Memoria - Tiny n8n e Integracoes 1#E-7|E-7]] · **Uma credencial, um renovador**; [[Memoria - Tiny n8n e Integracoes 1#A-18|A-18]] · função que renova ao receber 401 também é renovador.
- [[Memoria - Acesso Seguranca e Credenciais#E-2|E-2]] · Máquina-a-máquina usa conta de serviço, nunca login de pessoa.
- [[Memoria - Banco e SQL 1#E-1|E-1]] · Gatilho de automação só em dado bruto/evento, **nunca em dado derivado**.
- [[Memoria - Tiny n8n e Integracoes 1#E-100|E-100]] · O banco guarda a **descrição** da situação do Tiny ("Cancelado"), não o código: conferir o valor no banco antes de virar condição.
- [[Memoria - Modelos Formulas e Possibilidades#M-4|M-4]] · **Um dono por dado** — duas fontes de verdade se derrubam.

**Tela e entrega**
- [[Memoria - Modelos Formulas e Possibilidades#F-7|F-7]] · Tela pronta = `tsc` → lint → testes → abrir em **celular (375) e tablet (768)** e medir antes de declarar.
- [[Memoria - Front Telas e React 1#E-48|E-48]] · Mexeu num contêiner (gaveta, barra, cabeçalho)? **Rever as larguras** pensadas para o desenho antigo.
- [[Memoria - Publicacao Vercel e Funcoes#A-220|A-220]] · **Subir código para a main é publicar o site**: só no momento combinado com o dono.
- [[Memoria - Modelos Formulas e Possibilidades#M-7|M-7]] · **O que não está escrito na demanda não existe**: dúvida de negócio se pergunta, não se preenche.
- [[Memoria - Modelos Formulas e Possibilidades#M-16|M-16]] · Card pode ser teste; **o pedido é real**.

## 4. Desempenho — o checklist (a lei inteira: [[PLT - Lei de Desempenho e Escala]])

**Orçamentos:** primeira abertura = **1 requisição** + o websocket pessoal · cada tela = 1 · aba/modal/detalhe/"Ver mais" = 1 por clique · **0 requisição repetida por relógio** · porta de tela **p95 ≤ 50 ms** (painel ≤ 150 ms, nenhuma > 300 ms), medida com volume **×100** · escrita ≤ 100 ms, tela otimista · tempo real ≤ 300 ms · **LCP ≤ 2,5 s · INP ≤ 200 ms · CLS ≤ 0,1** · **JS inicial ≤ 250 KB** comprimido, cada tela num pedaço · página ≤ 50 itens (teto no banco: 100).

**Proibido:** relógio buscando dado (`refetchInterval`, `setInterval`), `postgres_changes`, baixar a lista inteira para filtrar no cliente, cascata de requisições, rotina de banco que acorda para ver se há trabalho, ir ao banco perguntar "quem sou eu".

**Checklist de fim de sessão** (o resultado vai no handoff):
- [ ] Rede: nº de requisições da abertura e de cada tela tocada dentro do orçamento; nada repetindo.
- [ ] Busca no código: nenhum relógio buscando dado, nenhum `postgres_changes`.
- [ ] Toda porta nova/tocada: `EXPLAIN (ANALYZE, BUFFERS)` com volume ×100, sem varredura sequencial em tabela grande.
- [ ] Índice em toda chave estrangeira, filtro, ordenação e coluna de RLS; avisos de desempenho do banco sem item novo.
- [ ] RLS com `(select …)`, `TO authenticated`, uma permissiva por ação.
- [ ] Lista por cursor (ou deslocamento justificado), com teto no banco.
- [ ] Pacote: JS inicial e o pedaço da tela, antes/depois.
- [ ] Escrita idempotente; chamada externa com tempo limite, espera crescente e disjuntor.
- [ ] Tablet/celular sem travada na tela tocada.
- [ ] O que ficou fora da lei virou **dívida registrada** (última parte de [[PLT - Lei de Desempenho - Dividas e Andamento 3]]) — atalho só com o OK do dono, como decisão.

## 5. Design — o essencial (o resto: [[PLT - Modelo de Sistema]])

- **Para quem:** gente em pé, no galpão, mão suja, tablet compartilhado. Operador = densidade baixa, alvos de 64 px; líder = média; admin = alta.
- **Cores só por token** (`src/estilos/tokens.css`): paleta bruta → camada semântica (`--dm-fundo`, `--dm-texto`, `--dm-acao`…). Nenhum hexadecimal solto. Trocar de tema = trocar a camada semântica.
- **Amarelo é marca e ação, nunca estado.** "Atenção" é âmbar-laranja. Amarelo com texto branco é proibido (sempre `grafite-950` por cima).
- **Estado nunca só por cor:** ícone + texto junto.
- **Toque:** mínimo absoluto 44 px (`toque-md`); operador 64 px (`toque-galpao`); ícone pequeno usa `.toque-seguro`.
- **Fontes embarcadas:** Poppins (marca e títulos), Inter (corpo); número em coluna com `tabular-nums`.
- **Componentes que já existem** (componente novo só se não houver equivalente): `Botao`, `Campo`, `Selecao`, `Modal`, `BadgeEstado`, notificação (`useNotificacao`), `Tabela` (**paginação é padrão**), casca com menu lateral recolhível, cabeçalho compacto, janela do card.
- **Toda tela:** funciona em **celular 375 e tablet 768**; menu lateral recolhível, **botão de voltar**, sino no topo; rota `/pai/filho`; lista paginada **no servidor**; a tela só pede o que mostra.
- **Texto:** português; termos do galpão sem tradução (SECC, FITAMENTO, FURAÇÃO, PCP, ROTAS, "rota"); setores em caixa alta; erro diz **o que fazer**; **nenhum código interno na tela**.
- **Acessibilidade mínima:** contraste ≥ 4,5:1, foco sempre visível, rótulo em todo campo, `aria-label` em ação só-ícone.
- **Nomes no código:** domínio em português (`Botao`, `carregando`); convenções do React em inglês (`use*`, `onClick`).
- Detalhe por assunto em `Plataforma/Design/`: [[Design - Fundamentos Tokens e Componentes Base]] · [[Design - Kanban Execucao e Qualidade]] · [[Design - Navegacao Menu Cabecalho e Perfil]] · [[Design - Logistica ROTAS e Pedidos]] · [[Design - Estoque e PCP]] · [[Design - Meu Painel Chat Automacoes e Tech]].

## 6. Banco — o essencial (antes de QUALQUER SQL)

1. **Leia a nota do domínio** em `Supabase-fabrica/Banco/` (ache pela tabela em [[SUPA - Esquema do Banco]]). Nome sai de lá ou da migration — nunca de memória.
2. **Nada se aplica em produção sem o OK do dono naquela conversa.** Migration é arquivo versionado; aplicar é passo separado. Sessões em paralelo: aplicar só a sua (`--so <arquivo>`).
3. **Fatos são append-only:** nada edita nem apaga evento; correção é um fato novo. Projeção só por gatilho.
4. **Prefixo `plt_`** nas tabelas da plataforma; as tabelas da integração **não se alteram**. Tabela nova só se nenhuma existente servir.
5. **Função recriada parte da versão viva** (a última migration que a recriou), nunca de uma cópia antiga — e a bateria reaplica na ordem de produção.
6. **Usuário:** leitura por coluna com grant explícito; dado pessoal fora da API.
7. **Índice** em toda chave estrangeira, filtro, ordenação e coluna de RLS; **RLS com `(select …)`**.
8. **Trabalho nasce do fato** (fila/gatilho), nunca de relógio; rotina agendada nova só com decisão registrada.
9. **Migração sem travar:** nada que segure trava longa em tabela viva; check antigo `not valid`.
10. Alterou (com aprovação): migration → `supabase-fabrica-schema.sql` → **o bloco novo no fim da nota do domínio**.
11. Bateria local (`npm run test:banco`) verde antes de pedir a aplicação; porta nova com ensaio ×100.

## 7. Com o dono

- **Português de gente, sem código nenhum:** nada de identificador de decisão, erro, requisito ou pergunta, nem de versão, ramo, atualização do banco, função, tabela ou caminho de arquivo. Diga o que a coisa **é** e o que **faz**.
- Vale para as perguntas e opções mostradas a ele e para **todo texto no ClickUp** (sem "sessão", códigos, arquivo, "cofre", "handoff").
- No ClickUp: o Claude Code move a tarefa para "fazendo" e **nunca conclui** — quem conclui é o dono; não cria tarefa por conta própria.
- **Produto se decide com o dono.** O que a sessão escolhe sozinha nasce como decisão **provisória**, registrada e levada a ele no handoff.
- Antes de codar: entendimento do escopo (até 15 linhas), dúvidas de negócio, decisões técnicas — e o OK dele.
- Ele quer rapidez quando manda subir: deixe o roteiro da subida pronto antes; **subir só com a ordem dele**.

## Ver também

`CLAUDE.md` da raiz (as regras de conduta e a rota de leitura) · [[000 - MAPA DO PROJETO]] (as áreas e os mapas) · [[PLT - Decisoes de Produto]] · [[PLT - Memoria de Aprendizado]] · [[SUPA - Esquema do Banco]]
