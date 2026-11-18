---
titulo: "Memória de aprendizado — Modelos Formulas e Possibilidades"
tipo: memoria-tema
tema: modelos
atualizado: 2026-11-18
tags: [memoria, aprendizado, tema/modelos]
---

# 🧠 Memoria - Modelos Formulas e Possibilidades

> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (`### E-NNN`); o próximo número livre está no índice.

## 🧠 Modelos mentais (M-NN)

### M-1

- **M-01** · **Automatizar consequências, não decisões** — o humano decide (PCP, destino, qualidade); o sistema executa o resto do clique (timer, contagem, notificação).

### M-2

- **M-02** · **O evento é a tabela-mãe** — append-only; timers, filas, dashboards e produtividade são TODOS derivados de eventos, nunca estado editável.

### M-3

- **M-03** · **Medir depende do gesto humano** — gesto fácil no momento certo vence disciplina; card movido em lote no fim do dia é dado-ficção.

### M-4

- **M-04** · **Um dono por dado** — duas fontes de verdade se derrubam (planilha vs banco, dois renovadores de token).

### M-5

- **M-05** · **Dado limpo antes de métrica** — 660 cards mortos transformam qualquer dashboard em mentira.

### M-6

- **M-06** · **Dupla atestação onde há conflito de interesse** — quem entrega marca, quem recebe confirma ([[D-009 - Qualidade em 3 estados em TODA transicao com dupla atestacao|D-09]]); vale para qualquer handoff entre partes com incentivos diferentes.

### M-7

- **M-07** · **O que não está escrito na demanda não existe** — presumir requisito é a origem da alucinação; dúvida de negócio → perguntar, nunca preencher.

### M-8

- **M-08** · [2026-08-24] **Fila é do setor, execução é da pessoa** — tempo sem dono individual atribui-se ao coletivo (fila longa = gargalo = contratar), tempo com gesto individual atribui-se a quem clicou. Nunca inverter.

### M-9

- **M-09** · [2026-08-24] **Número de sessão é ID, não ordem** — a ordem de execução vive só no índice [[000 - ORDEM DAS SESSOES]]; renumerar arquivos para reordenar cria lixo e quebra links. **↩️ Revisado em 27/08/2026 ([[D-023 - Replanejamento da jornada a partir da 5 posicao|D-23]] complemento):** o dono preferiu **número = ordem** — a renumeração foi feita UMA vez, por script no repositório inteiro (76 referências + 8 arquivos renomeados), com de-para registrado no índice. O aviso original continua valendo como custo: renumerar de novo paga esse preço de novo.

### M-10

- **M-10** · [2026-08-24] **Configurável > adivinhado** — onde o dono conhece o detalhe e o sistema não (etapas internas de cada setor), entregar o CADASTRO e semear vazio. Chutar estrutura operacional gera trabalho de desfazer e dado errado. (Origem: [[D-014 - Etapas internas cadastro livre cada uma com timer proprio|D-14]].)

### M-11

- **M-11** · [2026-08-24] **Timer é propriedade da etapa, não feature avulsa** — toda etapa cadastrada já nasce contando tempo para quem chega nela; assim medir não depende de ninguém "ligar" nada.

### M-12

- **M-12** · [2026-08-24] **Estado nunca se comunica só por cor** — ícone e texto sempre juntos. Daltonismo é comum e a iluminação do galpão é ruim; cor sozinha é informação que parte da equipe não recebe.

### M-13

- **M-13** · [2026-08-26] **Estado guardado é projeção; evento é a verdade.** A posição do card fica gravada para a tela ser rápida, mas é escrita SÓ por trigger a partir do evento. Onde houver as duas coisas, a que se edita à mão tem que ser nenhuma.

### M-14

- **M-14** · [2026-08-26] **Trava que precisa valer para todos não pode morar no RLS** — a `service_role` ignora RLS por natureza do Postgres. Regra que vale até para a chave mais poderosa vira TRIGGER.

### M-15

- **M-15** · [2026-09-27] **O dono pensa em TELA, não em tabela** — para ele "Pedidos em aguardo já existe" (a aba), e o lugar final da peça de pedido "já mudou". Propor "criar um 3º fim de linha" soou como inventar coisa (SESSAO-24). Decisão técnica de onde o dado mora se apresenta na língua da tela ("a aba que já existe passa a ser o lugar da peça"); o setor/tabela por baixo é detalhe do Claude.

### M-16

- **M-16** · [2026-09-27] **Enquanto a plataforma não estiver em uso no galpão, card é TESTE — o pedido é real.** Na SESSAO-24 levei ao dono o destino de uma peça 🔴 de herança (a 502, nascida na validação ao vivo da S22) e ele respondeu: *"ninguém tá usando essa bomba, tudo que tu tá vendo aí é teste ainda, mas os pedidos são reais"*. → Sujeira de card de teste não vira pergunta de negócio: tratar pelo caminho mais simples e seguro (evento, origem `api`, reversível pela história) e só REGISTRAR. Pergunta ao dono só quando mexe em pedido/cliente (real) ou em regra. Vale até o dono avisar que a fábrica começou a usar (SESSAO-08 — [[D-030 - Publicacao adiada nenhum deploy no bloco noturno|D-30]]).

## 🧪 Fórmulas e receitas (F-NN)

### F-1

- **F-01** · Ciclo de sessão Claude Code: ler demanda 2x → ler decisões + design system + ESTA memória → listar dúvidas → task list → branch → codar computando tudo em `docs/execucao/SESSAO-NN.md` → conferir task list contra a demanda → PR → handoff.

### F-2

- **F-02** · Ciclo de banco: ler [[SUPA - Esquema do Banco]] → escrever migration → aprovação explícita do dono → aplicar → atualizar `supabase-fabrica-schema.sql` + nota.

### F-3

- **F-03** · Ciclo de erro: errou → registrar E-NN aqui NA HORA → corrigir → completar a linha com a correção → se virou lei, promover ao CLAUDE.md.

### F-4

- **F-04** · Commit no vault: sempre conferir `"rejected":[]` no resultado; ID rejeitado → reenviar o arquivo, nunca "assumir que foi".

### F-5

- **F-05** · Integração nova: replicar formato real observado (payload/célula/card verdadeiro), não o formato deduzido da documentação.

### F-6

- **F-06** · [2026-08-24] **Prompt do Claude Code é mínimo: só o caminho.** Se está no cofre, não se repete no prompt — texto duplicado vira segunda fonte de verdade que envelhece sozinha (viola [[Memoria - Modelos Formulas e Possibilidades#M-4|M-04]]). O Cowork entrega o prompt **no chat**, pronto para colar. (Erro do Cowork corrigido: primeiro prompt do Bloco 1 nasceu com ~200 linhas replicando as decisões → reescrito para 3 linhas.)

### F-7

- **F-07** · [2026-08-24] **Ciclo de verificação de tela:** `tsc` → `lint` → testes → abrir em viewport de CELULAR **e** de TABLET e medir o DOM (altura de alvo de toque, rolagem horizontal) ANTES de declarar pronto. Foi assim que apareceram o dado repetido no card do celular e o hook com nome fora da convenção. **↪️ 28/09:** no celular, conferir também com a gaveta do menu FECHADA que a borda esquerda é do conteúdo (`document.elementFromPoint(x, y)` para x de 0 a ~60) — foi assim que a faixa da barra 2 apareceu ([[Memoria - Front Telas e React 1#E-48|E-48]]); e medida de transição só vale com o painel do navegador visível (oculto, a transição não anda — `getAnimations().forEach(a => a.finish())` prova o estado final).

### F-9

- **F-09** · [2026-09-08] **Verificação ao vivo sem painel que compõe frames ([[Memoria - Testes e Validacao ao Vivo#A-13|A-13]], 2ª geração):** clique de automação por coordenada/ref falha calado quando o painel de preview não renderiza; o que prova o gesto é (1) disparar o handler REAL via JS (`botao.click()`, `input.form.requestSubmit()`, valor via setter nativo + `input` event), (2) para o `Selecao` (Radix Select): `pointerdown` sintético no gatilho abre a lista e **`keydown Enter` no `[role=option]` focado seleciona** (pointerup/click sintéticos não), (3) upload de arquivo via `DataTransfer` + `change`, e (4) conferir o resultado no BANCO (evento/log com o autor), nunca só no DOM. Screenshot volta a funcionar de vez em quando — tentar de novo para o handoff.

### F-8

- **F-08** · [2026-08-26] **Ciclo de banco, versão completa:** ler [[SUPA - Esquema do Banco]] → ler o CÓDIGO das funções que já escrevem nas tabelas → escrever migrations idempotentes → testar contra o esquema real duas vezes → aprovação do dono → aplicar conferindo impressão digital antes/depois → `get_advisors` → atualizar `supabase-fabrica-schema.sql` + a nota do esquema.

## 💡 Possibilidades a explorar (X-NN)

### X-1

- **X-01** · Automação de destino via API quando os padrões de roteiro emergirem dos dados reais ([[D-003 - Destino do card manual hoje automacao via API amanha|D-03]]) — os eventos acumulados vão REVELAR o roteiro típico por produto.

### X-2

- **X-02** · QR/bipe por unidade como gesto físico de chão de fábrica (ideia C do handoff) — candidato natural a substituir/complementar o toque no tablet nas etapas.

### X-3

- **X-03** · Tiny→PCP: decidir na SESSAO-09 (entrada via n8n) entre trigger no banco vs chamada do n8n à API — registrar prós/contras medidos, não teóricos.

### X-4

- **X-04** · Tempo acumulado por produto pode gerar "tempo-padrão" automático por item — insumo futuro para peso de produtividade (⏸️ [[D-004 - Produtividade e bonificacao|D-04]]) e para custo real (ideia I).
