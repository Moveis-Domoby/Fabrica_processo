---
titulo: Handoff — SESSAO-46 · Tech → Sugestão de melhoria (quadro, bolinha, teste de quem sugeriu)
tipo: handoff
data: 2026-11-05
tags: [handoff, sessao-46, tech, sugestoes, kanban, notificacoes]
---

# 📋 Handoff — SESSAO-46 · Tech → Sugestão de melhoria (05/11/2026)

Demanda: [[SESSAO-46 - Tech - Sugestao de Melhoria]] · Diário: [[SESSAO-46]] (`_docs/Plataforma/Execucao/SESSAO-46.md`) · Decisões: D-260…D-266

## 1. Objetivo

O dono pediu (05/11, madrugada, direto na conversa): um setor novo **Tech** no menu com a rota **"Sugestão de melhoria"** — um kanban Solicitações · Backlog · Fazendo · Finalizada · Recusada que todos acompanham —, uma **bolinha** em toda tela (menos o modo tablet) com **Sugerir melhoria** (arquivo/áudio/vídeo/print colado, tipo, texto 30+, nível 1–10, tudo obrigatório), e o ciclo: finalizada → aviso "pode testar" (ou "recusada") → quem sugeriu **aprova** ou **devolve com nova sugestão**, pelo aviso ou pela pendência do painel inicial. Respostas do dono às 4 dúvidas: só ele (super admin) move; recusa com motivo obrigatório; devolução com o formulário inteiro (tipo e nível já marcados); pode subir banco e site.

## 2. O que foi feito (banco NO AR em 05/11 ~02:20 de Natal; site — ver §8)

### Banco — `supabase/migrations/20261105230000_plt_sugestoes_melhoria.sql` (100% aditiva)
- Tabelas **`plt_sugestoes`** (projeção) e **`plt_sugestao_fatos`** (história, imutável); gatilho que mantém a projeção, abre/fecha a pendência "Testar a sugestão #N" (tarefa do Sistema da pessoa, privada) e cria os avisos **"Sugestão #N pronta para testar"** e **"Sugestão #N recusada"** (com o motivo).
- Armário privado **`plt-sugestoes`** (50 MB por arquivo, qualquer formato; envia só na própria pasta; todos os logados leem).
- Ao vivo pelo tópico **`plt-aviso:sugestoes`** com política própria (não recria a função de quem ouve — sem conflito com a SESSAO-43).
- Portas: criar (idempotente; devolução com `origem_id`), mover (só super admin; recusa com motivo), aprovar (só o autor), quadro (5 colunas + total; "Ver mais" por cursor), ficha.
- Ensaio ×100 no banco real (5 mil sugestões, desfeito): quadro 23 ms · "Ver mais" 3 ms · ficha 13 ms.

### Front — `src/tech/` + `src/paginas/SugestaoMelhoria.tsx`
- Menu: pai **Tech** → **Sugestão de melhoria** para todo nível (inclusive produção e entregador); `/tech` leva à tela.
- **Bolinha** amarela arrastável (`BolhaSugestao.tsx`) com Sugerir melhoria, "Para você testar" (número na bolinha) e o atalho do quadro.
- **Formulário** (`ModalSugerir.tsx`): escolher/arrastar arquivo, **colar print com Ctrl+V**, **gravar áudio**, tipo, texto com contador, nível 1–10; só envia completo.
- **Quadro**: 5 colunas, 20 por coluna + "Ver mais", arrasto só para o super admin (Recusada pede o motivo), ao vivo.
- **Ficha** (`?sugestao=N`): selos, Aprovar / Devolver, motivo da recusa, texto, sugestões ligadas, arquivos com prévia/player, Mover para (super admin), história.
- **Aviso do sino** e **pendência** (Meu painel — bloco "Sugestões para você testar"; Meus afazeres) abrem a ficha.

## 3. Decisões tomadas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| Pendência = tarefa do Sistema da pessoa (D-264) | Uma lista própria no Meu painel com leitura nova | Chega na abertura e fica ao vivo sem requisição (Lei §2/§4); ninguém conclui à mão |
| Aviso e pendência acham a sugestão pelo número no título | Coluna nova no aviso | Exigiria recriar a abertura do app — conflito com a SESSAO-43 em paralelo |
| Avisos novos fora de Configurações → Avisos | Entrar no catálogo | Recriar o catálogo também colide com a 43; são resposta ao pedido da própria pessoa |
| Política própria do canal ao vivo (A-190) | Recriar a função de quem ouve | 100% aditiva, sem conflito |
| Ordem: abertas pelo nível (maior primeiro); fechadas pela mais recente (D-266) | Ordem manual | Não pedido; o nível já diz a urgência |

## 4. Bugs

### Resolvidos no caminho
- E-231 — o texto para leitor de tela do cartão esticava a página para o lado (achado no teste de tela; corrigido).

### Descobertos
- E-230 — o ensaio de volume gastou a numeração: as sugestões do teste nasceram **#5001–#5003** (ver §8).

## 5. Como testar (passo a passo)

1. Entrar como qualquer pessoa → menu **Tech → Sugestão de melhoria**: o quadro com as 5 colunas.
2. Tocar na **bolinha amarela** (lâmpada) → **Sugerir melhoria**. Tentar enviar vazio: o botão fica preso e a linha "Para enviar, falta…" diz o quê.
3. Colar um print com **Ctrl+V** (ou escolher/arrastar um arquivo, ou "Gravar áudio" — no celular/computador, fora do painel do app), escolher **Bug/Melhoria/Implementação nova**, escrever 30+ letras, escolher o **nível** → **Enviar sugestão**: abre a ficha da sugestão nova; o cartão aparece em **Solicitações** para todo mundo.
4. Como **dono**: arrastar o cartão para Backlog → Fazendo → **Finalizada** (ou usar "Mover para" na ficha). Para **Recusada**: pede o motivo.
5. Como **quem sugeriu**: o sino mostra "Sugestão #N pronta para testar"; o Meu painel mostra "Sugestões para você testar"; a bolinha mostra o número. Tocar → **Aprovar** (fica "Aprovada por quem sugeriu") ou **Devolver com nova sugestão** (formulário inteiro, tipo e nível marcados → a nova cai em Solicitações com "devolução da #N").
6. Como outra pessoa (não dona): o quadro abre, a ficha abre, mas não há arrasto nem "Mover para"; o banco recusa se alguém tentar.

**Testado na tela (05/11, logado como o dono, cópia local ligada ao banco real):** bolinha → formulário (print colado por Ctrl+V, arquivo pelo botão, vídeo arrastado), envio, ficha com prévia da imagem, mover pela ficha e pelo arrasto, Finalizada → número na bolinha + aviso no sino + bloco no Meu painel (tudo ao vivo), aviso → ficha → Devolver → nova #5002 ligada à #5001, Aprovar, arrasto para Recusada → motivo → aviso com o motivo; celular (375 px) sem rolagem lateral e alvos ≥ 44 px; nenhum erro no console. O microfone não pôde ser testado no painel do app (ele bloqueia o microfone).
**Bateria do banco:** bloco SESSAO-46 todo verde (1.496 ✔); o único vermelho é o antigo "as 7 portas novas = as antigas" (o mesmo da `main` antes desta sessão). **Testes de tela:** 410 verdes. Tipos e lint limpos; build ok.

## 6. Impacto nos números visíveis

Nenhum número existente muda. O "Delegados a mim" do Meu painel deixa de contar a pendência de teste (ela tem bloco próprio).

## 7. Notas do cofre atualizadas

- [[SESSAO-46 - Tech - Sugestao de Melhoria]] (nova) · [[SESSAO-46]] (diário)
- [[PLT - Decisoes de Produto]] (D-260…D-266) · [[PLT - Memoria de Aprendizado]] (E-230, E-231, A-190, A-191)
- [[SUPA - Esquema do Banco]] · [[PLT - Modelo de Sistema]] · [[PLT - Lei de Desempenho e Escala]] (andamento + dívida da ficha)
- [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]]

## 8. Ficou pendente / precisa de decisão

1. **O rastro do teste de tela** ficou no banco: as sugestões **#5001–#5003** (marcadas "TESTE DA SESSAO") aparecem no quadro, com os avisos, as 2 pendências já fechadas e os registros de atividade. Os 4 arquivos do teste já foram apagados do armário. Apagar o resto exige desligar por instantes a proteção dos registros de atividade, e o ambiente desta sessão recusou isso (é mexer em auditoria) — **o dono decide**: deixar como está, ou autorizar a limpeza (a numeração então volta a começar do 1).
2. Confirmar as provisórias **D-264, D-265, D-266**.
3. Gravar áudio: conferir num celular/computador de verdade (o painel do app bloqueia o microfone).
4. ClickUp: esta demanda não tem tarefas lá (veio direto da conversa) — o dono decide se cria.
5. Dívida de desempenho: a ficha abre com 2 leituras (a ficha e os links dos arquivos) — registrada na lei.
6. **Combinar com a SESSAO-43** (em paralelo na pasta principal): numeração do cofre (esta usou D-260…D-266, E-230/E-231, A-190/A-191) e a dívida sem número na lei.
