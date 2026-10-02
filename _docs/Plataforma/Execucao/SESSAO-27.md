---
titulo: Execução — SESSAO-27 · Automações em canvas (+ Configurações, Super admin e Utilitários)
tipo: execucao
data: 2026-10-01
atualizado: 2026-10-01
tags: [execucao, sessao-27, automacao, canvas, etiquetas, campos-customizados, super-admin]
---

# 🔧 Execução — SESSAO-27 · Automações em canvas

**Pasta:** a principal (`Domoby - fabrica`), sem worktree (pedido do dono). **Branch:** `sessao-27-automacoes-canvas`, criada em 01/10 de **06c269c** (o HEAD da `sessao-29-reconciliacao-tiny`, que o dono viu mas ainda não mesclou — *"já vi a auditoria, só não subi pra main ainda"*). A `main` (6750a58) NÃO tem a D-92 nem as migrations 49/50 (aplicadas em produção em 01/10) — nascer da main deixaria o retrato do harness atrás do banco vivo (E-27). Combinado com a sessão da S29 por mensagem: ela liberou a pasta e não toca mais nela (ajuste dela, se houver, por índice temporário na branch dela).
**Demanda:** [[SESSAO-27 - Automacoes em Canvas]] (lida 2×) + [[SESSAO-17 - Automacoes Internas]] (1×, contexto) · handoff lido: [[handoff_2026_10_01_sessao29_reconciliacao_tiny]].
**Sessões vizinhas (01/10):** "Reconciliação Tiny" (terminou; liberou a pasta) · "Ajustes urgentes no módulo de estoque" (encerrada; avisou que a entrada `plataforma-estoque` (5176) do launch.json serve uma worktree antiga atrás da main — não usar).
**Numeração reservada (avisada às duas):** D-99…D-106 · E-77…E-84 · A-47…A-52 · RF-118…RF-126 · Q-73…Q-75 · migration 51 (`20261002120000`).

## Leituras (01/10)

CLAUDE (repo + cofre), Memória de Aprendizado (inteira), Decisões (D-01…D-98), Visão Geral, Requisitos, Ordem das Sessões, Perguntas em Aberto, Modelo de Sistema (inteiro), Esquema do Banco (seções da plataforma), Mapa (início), plano do Bloco 5 (trecho do canvas), handoff da S29. Mapeamento do banco e das telas por dois ajudantes de leitura (resumo nos achados abaixo).

## Achados do terreno (só leitura)

1. **`plt_eventos`:** origem aceita só `interface`/`api`/`automacao` (check na coluna, nunca alterado); check de `tipo` vigente na migration 42 (`20260930120000`, 23 tipos, criado `not valid` e validado no fim). Append-only por gatilho (`fn_evento_imutavel`).
2. **Mover com origem `automacao` e sem pessoa já passa** por todos os gatilhos: `resolver_etapa_fila` preenche a fila; `validar_chegada_estoque` só olha `interface`; `validar_qualidade` retorna cedo para não-interface. O próprio banco já faz isso (desvincular cancelados).
3. **Arquivar com `automacao` sem pessoa é RECUSADO** (`fn_validar_api`, vigente na migration 40): sem pessoa só a origem `api` (E-26/D-85).
4. **A rota das etapas ("manda para") só vale na porta do arrasto** (`plt_fn_soltar_card`); um `movimentacao_etapa` direto numa etapa que encaminha deixa o card parado nela → o motor aplica a mesma regra.
5. **Não existe desarquivar card** (só usuário). Arquivar não muda a posição projetada (só `arquivado_em`, executor e pausa) → desarquivar = limpar `arquivado_em`.
6. **Não existe etiqueta/tag/campo customizado** na plataforma (só `pedidos.marcadores` do Tiny).
7. **Trilha:** todo evento vira linha em `plt_logs_atividade` (`plt_eventos_logar`, `usuario_id` nulo = "Sistema"); a Auditoria tira o "porquê" de `observacao` → `contexto.motivo` → `dados.motivo`.
8. **Quadro:** lê `plt_cards` direto (PostgREST, `COLUNAS_CARD`, `range` + `count`); o PCP usa a porta `plt_fn_cards_pedido_pcp`. Tablet = mesmo `QuadroKanban` com `tamanho="galpao"`.
9. **Navegação:** "Painel admin" = grupo `admin` em `Layout.tsx`; rotas `/admin/*` em `App.tsx`; a engrenagem do rodapé abre o Meu Perfil. Não existe interruptor (switch) na casa — o liga/desliga da reposição é texto + botão + confirmação.
10. **Front:** sem canvas/SVG interativo no projeto; o arrasto sem biblioteca do balão do chat (`setPointerCapture`) é o modelo para arrastar os blocos.
11. **Ensaio do motor (PGlite, scratchpad):** gatilho ADIADO (`constraint trigger … deferrable initially deferred`) dispara no COMMIT, depois de todos os comandos do gesto; o que ele grava dispara em cascata no mesmo commit; a profundidade gravada no evento corta o ciclo; erro dentro de `begin/exception` não desfaz o gesto da pessoa. Prova de que dá para rodar "na hora" sem fila e sem relógio.

## Respostas do dono (01/10, noite) — o OK da sessão

1. **Revisão da D-03:** *"A automação em canvas deve ser para tudo, comercial, api, pedidos, e só eu vou construir essas coisas, então eu vou saber quando ligar"* — mover pode; sem as travas que propus; quem cria é só ele.
2. **Etiquetas:** *"Crie uma aba na página de admin chamada Utilitários, lá dentro coloque para cadastrar etiquetas e campos customizados"*.
3. **Quantas etiquetas:** *"Quantas eu quiser colocar, para tirar deve ter o nó de remover etiquetas"*.
4. **Desarquivar:** *"Sim, a automação deve ter um nó de trazer de volta também"*.
5. **Base:** *"Pode fazer e commitar tudo depois, já vi a auditoria, só não subi pra main ainda"*.
6. **Teste ao vivo:** *"Sim, ainda são só de teste, pode fazer o que quiser com eles"* (M-16 segue valendo).
7. **Reorganização (pedido novo):** *"Esse canvas será para apenas super admin … o atual painel admin será as configurações; na parte de baixo, o símbolo de configurações será agora um símbolo de tema para escolher o tema com um campinho pequeno de select; as configurações atuais e o meu perfil são a mesma coisa … a partir de hoje é criado um painel de super admin que só o meu usuário tem permissão de acessar, por enquanto, dentro dele deve ficar a auditoria e o canvas"*.
8. **Catálogo (perguntas de múltipla escolha):** QUANDO — card arquivado, pedido novo do Tiny, pedido mudou de situação, chamada de fora (n8n/API) + *"alimente com outros nós que você imagine fazer sentido"*; FAÇA — preencher campo customizado, avisar no sino, chamar endereço de fora, esperar um tempo; CAMPOS — nas peças, no card do pedido e nos pedidos; QUEM PREENCHE — automação e admin.

## Task list (espelho da demanda + respostas do dono)

**Navegação e acesso**
- [ ] N1 · "Painel admin" vira **Configurações** (rotas `/configuracoes/*`, as antigas `/admin/*` redirecionam); Auditoria sai de lá
- [ ] N2 · **Painel super admin** (`/super-admin/*`) com Automações e Auditoria — só o dono (coluna nova no cadastro, gate no banco e na rota)
- [ ] N3 · Rodapé: a engrenagem vira o **seletor de tema** (ícone + seletor pequeno)
- [ ] N4 · Auditoria passa a exigir super admin no banco

**Utilitários (Configurações → Utilitários)**
- [ ] U1 · Etiquetas: cadastro (nome + cor de token), editar, arquivar/excluir sem uso
- [ ] U2 · Campos customizados: cadastro (texto, número, data, lista de opções, sim/não; vale em peças e/ou pedidos), editar, arquivar
- [ ] U3 · Etiquetas no card (várias), no quadro, no tablet e no card do pedido do PCP
- [ ] U4 · Campos no card (peça) e no pedido (PCP + Todos os pedidos), com edição à mão pelo admin

**Motor no banco**
- [ ] M1 · Cadastro das automações (só super admin; nasce desligada — garantido no banco)
- [ ] M2 · Execução na hora (gatilho adiado sobre os eventos), cada disparo registrado (gatilho, condição, ações, quando), limite de cadeia registrado
- [ ] M3 · QUANDO: entrou na etapa · iniciado · qualidade 🟡/🔴 · parado há N · arquivado · etiqueta posta/tirada · pedido novo · pedido mudou de situação · chamada de fora
- [ ] M4 · FAÇA: mover · arquivar · trazer de volta · pôr/tirar etiqueta · preencher campo · avisar no sino · chamar endereço de fora · esperar · só se
- [ ] M5 · Relógio do banco só existe quando há "parado há N" ligado ou execução esperando
- [ ] M6 · A automação obedece às regras de uma pessoa (estoque só 🟢 etc.); card do pedido não sai do PCP; ROTAS só pelo lançamento
- [ ] M7 · Trazer de volta à mão (botão no histórico das execuções)
- [ ] M8 · Chamada de fora pela API (Edge Function `api`) — publicar só com OK

**Tela das automações**
- [ ] T1 · Lista + liga/desliga (com confirmação) + nova/arquivar — usável no tablet
- [ ] T2 · Canvas próprio leve (blocos arrastáveis, ligações em SVG, "adicionar bloco" por botão, aproximar/afastar)
- [ ] T3 · Painel de configuração de cada bloco com seletores reais (setor, etapa, etiqueta, campo, pessoa, situação)
- [ ] T4 · Últimas execuções (paginadas no servidor) com gatilho, condição, cada ação e o resultado
- [ ] T5 · Exemplos desligados de fábrica (parado há 3 dias avisa o líder; peça danificada avisa os admins)

**Registro e fechamento**
- [ ] R1 · Rótulos novos na Auditoria e na linha do tempo ("Automático" no lugar de `[automacao]`)
- [ ] R2 · Harness (2 rodadas) com o bloco 51; tsc; lint; testes; build; F-07 (celular/tablet)
- [ ] R3 · Checkpoint antes de aplicar (md5 da integração antes/depois), aplicar com OK + publicar no mesmo gesto (E-73), `get_advisors`
- [ ] R4 · Cofre: D-99…, RF-118…, esquema + retrato, Modelo de Sistema, API Aberta, memória, handoff, mapa, ordem, demanda (Resultado) e a S17 anotada

## Banco — migration 51 (`20261002120000_plt_automacoes_canvas.sql`)

- **Super admin:** `plt_usuarios.super_admin` (grant select por coluna — E-50), marcado para o dono por e-mail (conferido no banco real em 02/10 02:07 UTC: admin ativo, MDM-084-001; 4 admins ativos); `plt_privado.fn_eh_super_admin()`; a política de leitura da trilha (`plt_logs_atividade_leitura`) passou a super admin + a própria.
- **Auditoria → super admin:** as duas portas da migration 50 extraídas POR SCRIPT (scratchpad `extrair-auditoria.mjs` + `encaixar-auditoria.mjs`, substituição por função — E-51) com só o gate e a frase trocados.
- **Check de tipos:** + `etiqueta_adicionada`, `etiqueta_removida`, `card_desarquivado`; a 51 valida no fim e o `validate` da 42 virou comentário (E-19).
- **Tabelas novas:** `plt_etiquetas`, `plt_campos`, `plt_campos_valores` (sem FK para `pedidos` — D-19), `plt_automacoes` (nasce desligada por gatilho), `plt_automacao_execucoes` (também guarda quem espera). Coluna `plt_cards.etiquetas bigint[]` (projeção pelo gatilho `plt_eventos_projetar_marcas`).
- **Recriadas por inteiro:** `fn_validar_api` (da 40: + o motor arquiva), `fn_validar_chegada_estoque` (da 37: a regra vale também para o motor), `fn_tiny_estoque_marcar` (da 42: + `card_desarquivado` — a peça livre que volta ao ESTOQUE volta a contar no Tiny).
- **Motor:** gatilho ADIADO `plt_eventos_automacoes` (constraint trigger deferrable initially deferred) → `fn_automacoes_evento` → `fn_automacoes_disparar` → `fn_automacao_continuar` (passo a passo, cada um num bloco protegido) → `fn_automacao_acao` / `fn_automacao_condicao`. Marca do motor: `plt.automacao_canvas='on'` + `dados.automacao_id` (`fn_evento_do_motor`). Cadeia: `dados.automacao_profundidade` (limite 5) + disjuntor de 50 execuções por transação (`plt.automacao_execucoes_gesto`). Pedidos: gatilho ADIADO `plt_pedidos_automacoes` (after update of situacao) — à prova de falha. Relógio `plt-automacoes-relogio` (1/min) só existe com "parado há" ligado ou execução esperando (`fn_automacoes_relogio_ajustar`, padrão E-72).
- **Portas:** etiqueta (salvar/arquivar/excluir), campo (salvar/arquivar/excluir/definir), `plt_fn_desarquivar_card`, automações (lista, uma, salvar, ligar, arquivar, execuções), `plt_fn_automacao_chamada` (só `service_role` — a Edge Function `api`).
- **Exemplos desligados:** "parado há 3 dias avisa o líder" e "peça danificada avisa os admins".
- **Erros no caminho:** (1) "syntax error at end of input" — o CASE dentro do IF do "esperar" sem parênteses (E-61 de novo, pego pelo harness na 1ª rodada; corrigido). (2) o harness reaplica a migration 38 no bloco da S26 (simula o grant de tabela do Supabase) e isso apaga o `grant select (super_admin)` — em produção a ordem 38 → 51 garante; o bloco 51 reaplica a 51 no começo (e no fim, com dados, provando a reaplicação).
- **Harness:** **707 verificações, tudo verde, 2 rodadas** (39 novas no bloco 51; bloco 50 ajustado para o super admin; o teste dos gatilhos de `pedidos` agora filtra `plt_pedidos_reagir%`).

## Aplicação no banco real (02/10)

- **03:13 UTC** — migration 51 aplicada (`--so`), com o OK do dono ("Pode aplicar"); integração `e2109f3a…`/65 col idêntica antes/depois, linhas idênticas. Conferido: super admin = só o dono (MDM-084-001); 2 exemplos desligados; gatilhos adiados no lugar; relógio NÃO agendado (nada que precise); check validado; leitura da marca liberada ao navegador. `get_advisors`: segurança — só os 14 WARN esperados das portas novas (gate dentro) + o INFO das 2 tabelas sem política (só pelas portas, de propósito); nenhuma porta para anônimo; desempenho — só INFO (chaves sem índice de `criada_por`/`atualizado_por`, índices novos ainda sem uso).
- A sessão da S29 conferiu do lado dela (03:15): `fn_upsert_pedido` intacta; ensaio desfeito do aviso de venda com o gatilho adiado forçado a disparar — 63 ms, sem erro. Depois ela foi encerrada (a conferência pós-06:00 ficou comigo).
- **Ensaio A-11 no banco real** (card de teste 589, FITAMENTO): 1ª tentativa deu "ignorada — o card já tinha saído" com o card parado na etapa → **E-78** (no modo imediato forçado, o gatilho "automacoes" rodava antes do "projetar" — ordem alfabética). Gatilhos renomeados (`plt_eventos_zzzz_automacoes`, `plt_pedidos_zz_automacoes`), harness com a prova do modo imediato (708 verdes), 51 reaplicada (`--so`, integração idêntica), ensaio repetido: A1 pôs a etiqueta e moveu (CONCLUÍDO → FURAÇÃO · A FURAR pela rota da etapa), A2 em cadeia (prof 1) conferiu a etiqueta e tirou — 58 ms, desfeito.

## Teste ao vivo com o dono logado (02/10, ~00:30 de Natal)

1. Menu: "Configurações" e "Super admin" no lugar; o grupo Super admin com Automações e Auditoria; o ícone de tema no rodapé (foto).
2. Lista das automações com os dados reais (os 2 exemplos desligados, o QUANDO em português).
3. **Configurações → Utilitários pela tela:** etiqueta "Teste automação" (violeta) e campo "Teste automação" (texto, nas peças).
4. **Automação montada pelo canvas** (seletores reais): "Teste — chegou na furação" = QUANDO entrou em FURAÇÃO · A FURAR → pôr "Teste automação" → preencher o campo = "veio da automação"; salva → **nasceu desligada** (aviso "desligada até você publicar").
5. **Desligada não dispara:** o card 589 foi solto no CONCLUÍDO do FITAMENTO (gesto real do dono, perfeito estado) → chegou na FURAÇÃO, nenhuma execução, nenhuma etiqueta.
6. 2ª automação pelo canvas: "Teste — etiqueta posta arquiva" (QUANDO "Teste automação" posta → arquivar). As duas ligadas pela lista (dois toques).
7. Card de volta à fila do FITAMENTO e solto de novo no CONCLUÍDO → **A1 concluída** (etiqueta + campo), **A2 em cadeia (prof 1) arquivou**.
8. **"Trazer de volta" pelo histórico da A2** → o card voltou (FURAÇÃO · A FURAR, com a etiqueta). As duas de teste **desligadas** no fim.
9. **No quadro da FURAÇÃO**, o card mostra a pílula "Teste automação" e a linha "Teste automação: veio da automação" (foto não saiu — janela do app atrás).
10. **Rodada do dono** (D-105): o editor virou área de trabalho — menu recolhido na entrada (reabre), canvas na tela toda, barra com Salvar/Publicar, abas Editor | Execuções, gaveta do bloco com X. Conferido por medida: menu 72px no editor → 240px ao reabrir/sair; canvas 1446×636 numa tela de 1518×698; a aba Execuções troca o canvas pela lista; a gaveta abre (416px) e fecha.

11. **Rodada do dono — "Se… senão", a escolha por grupos e o filtro no padrão** (D-106; pedidos: *"coloque separador lógico condicionais tipo, if (com um else embutido como segunda saída)"*, *"ajuste a hierarquia disso aqui, está tudo fora de esquadro"*, *"esse modal de select não está no padrão do sistema"*):
    - **Banco (ainda na migration 51, a reaplicar com o OK do dono):** `fn_automacao_validar_passos` recursiva (5 níveis; 40 passos contando os caminhos; nada depois do `se_senao`; mensagens com o nome do bloco certo — "Só se" ou "Se… senão"); `fn_automacao_contar_passos` (a lista); `fn_automacao_continuar` com o ramo `se_senao` (plano = já rodado + caminho; grava `passos_previstos` na espera e no fim; resultado `sim`/`senao`); exclusão de etiqueta/campo confere em qualquer nível (`jsonb_path_exists` com `$.**`). Scripts de troca no scratchpad (`se-senao-validar.mjs`, `se-senao-2.mjs`), com conferência de contagem e de cifrões.
    - **Harness:** bloco novo "Se… senão" (9 conferências: passo depois recusado; passo quebrado dentro do caminho recusado; sem condição recusado com o nome; 40 contando caminhos; caminho Sim com espera no meio retomando DENTRO do caminho; caminho Senão; etiqueta e campo usados só no caminho não se excluem; a lista conta 5) — **tudo verde**.
    - **Tela:** `desenho.ts` (ligação com `saida` opcional; `sequencia` em profundidade — o Sim antes do Senão; `passosDaSequencia` monta a árvore; `podeLigar`/`ligar`/`desligar`/`inserirDepois` por saída; tirar o "Se… senão" mantém o Sim; `trocarPasso` acerta as ligações; `montarDesenho` refaz os caminhos dos passos com o Senão descendo), `catalogo.ts` (`se_senao`, `GRUPOS_PASSO`, descrições curtas), `icones.tsx` (`Split`), `resumo.ts` ("Se …"), `PainelBloco` ("Vai pelo caminho Sim se" + explicação; o tipo não vira "se" ao trocar a condição), `CanvasAutomacao` (duas bolinhas + pílulas + dois "+"; tratador por `data-*` — A-49), `Execucoes` (sim/senão como resultado normal), `Automacoes.tsx` (escolha por grupos, título com o caminho). Filtros "Mostrar" (`FiltroPill`) em Automações e Utilitários no lugar da caixinha.
    - **Testes:** `desenho.test.ts` (+5), `resumo.test.ts` (+2), `Automacoes.test.tsx` (+1: o "+" do Senão abre "Que bloco vem no caminho Senão?" e salva os caminhos). Tipos, padrão de código, 117 testes da tela e a montagem — verdes.
    - **Conferido no navegador (1280×800):** a escolha por grupos alinhada (3 colunas, alturas iguais); o "Se… senão" com Sim/Senão e um bloco em cada caminho (o Senão uma linha abaixo).
    - ⚠️ E-79 (heredoc grande quebrou no terminal → script por arquivo).

**Ficaram no banco (teste, combinado com o dono):** a etiqueta e o campo "Teste automação", as 2 automações de teste (desligadas) e o card 589 com a etiqueta/campo e os eventos do teste (a história fica — RNF-05).

## Diário

- 01/10 noite · leituras, mapeamento, ensaio do gatilho adiado; perguntas ao dono; respostas; branch criada de 06c269c.
- ⚠️ Na leitura usei `cd` no shell (duas vezes) e o app trocou a pasta da sessão para `_docs` — o E-74 de novo. Voltei com `change_directory`; nada escrito fora. Registrado como E-77.
