---
titulo: SESSAO-46 — Tech · Sugestão de melhoria (quadro, bolinha e teste de quem sugeriu)
tipo: demanda
data: 2026-11-05
status: ✅ entregue
tags: [plataforma, demanda, sessao-46, tech, sugestoes, kanban, notificacoes]
---

# SESSAO-46 — Tech · Sugestão de melhoria

> Demanda ditada pelo dono direto na conversa (05/11/2026), sem arquivo do Cowork. O texto abaixo é o pedido dele, sem enfeite; as respostas às dúvidas vieram na mesma conversa e valem como parte da demanda.

## O pedido (palavras do dono)

> Criar um novo setor nas abas laterais chamado **tech**; dentro dele uma única rota por enquanto, a **"Sugestão de melhoria"**. O conteúdo dessa rota é um **kanban** para acompanhamento de uma melhoria sendo implementada — **backlog, fazendo, finalizada, recusada**, e a fila é **"Solicitações"**.
>
> Criar também uma **bolinha que acompanha todos os usuários em todo o sistema, com exceção do modo tablet**; essa bolinha tem um botão de **sugerir melhoria** que abre um modal com os campos: **um arquivo** (áudio, vídeo, arquivo em qualquer formato, ou um print colado com Ctrl+V), **um campo dizendo se é bug, melhoria ou implementação nova**, **um campo de digitação com no mínimo 30 caracteres** — todos obrigatórios — e **uma tag de nível de necessidade de 1 a 10**.
>
> Quando a melhoria for sugerida, aparece um **card para qualquer pessoa acompanhar** as sugestões já fornecidas. A **conclusão** da sugestão gera uma **notificação automática** para quem sugeriu, avisando que **já pode testar** — ou que **foi recusada**. Assim que ela testa, ela **aprova** ou **retorna com uma nova sugestão em cima dessa última** — basta clicar na **notificação** ou nas **pendências do painel inicial**.
>
> Ao finalizar a implantação, avisar a outra sessão para combinarem se não terá conflito — mas só depois de finalizar e testar tudo na tela, no navegador já logado no sistema.

## Respostas do dono (05/11, na conversa)

1. **Quem move os cards:** **só o dono (super admin)**. Todo o resto da equipe só acompanha.
2. **Recusa:** o **motivo é obrigatório** e vai junto no aviso para quem sugeriu.
3. **Devolução depois do teste:** **o formulário inteiro de novo** (arquivo, tipo, texto de 30+ letras e nível) — o tipo e o nível já vêm preenchidos da anterior.
4. **Banco e site:** pode subir a atualização do banco quando estiver ensaiada, testar na tela e **publicar o site** no fim.

## Critérios de aceite

- [x] Menu lateral com o grupo **Tech** → **Sugestão de melhoria** (`/tech/sugestao-de-melhoria`), visível a todos os níveis (inclusive linha de produção e entregador); `/tech` leva à tela.
- [x] O quadro com as 5 colunas na ordem **Solicitações · Backlog · Fazendo · Finalizada · Recusada**, cada uma paginada no servidor com "Ver mais", ao vivo por websocket.
- [x] Só o super admin move (arrastando ou pela ficha); recusar pede o motivo.
- [x] A bolinha em toda tela logada (fora do `/tablet`), com **Sugerir melhoria** e o atalho para o quadro; ela também mostra o que a pessoa tem para testar.
- [x] O formulário só envia com: pelo menos 1 arquivo (escolher, arrastar, gravar áudio ou colar print com Ctrl+V), o tipo, o texto com 30+ letras e o nível de 1 a 10.
- [x] Ao ir para **Finalizada**: aviso no sino "pronta para testar" + pendência no Meu painel; ao ir para **Recusada**: aviso com o motivo.
- [x] Clicar no aviso ou na pendência abre a sugestão com **Aprovar** e **Devolver com nova sugestão** (formulário inteiro, tipo e nível preenchidos); a nova cai em Solicitações ligada à anterior.
- [x] Toda ação gera registro de atividade (D-40); escrita idempotente; nada de relógio.
- [x] Testado na tela, logado, no navegador; outra sessão avisada no fim.

## Ver também

[[000 - ORDEM DAS SESSOES]] · [[PLT - Decisoes de Produto]] · [[SESSAO-46]] (diário de execução)
