# Memória de Execução — SESSAO-06 · Qualidade nas Transições (D-09/D-25)

> Computar TUDO enquanto executa (regra 8). Branch: `sessao-06-qualidade`.

## Task list (espelho da demanda + D-25)

- [x] Ler demanda 2x + decisões + design system + memória de aprendizado
- [x] Dúvidas de negócio respondidas → D-25 registrada no cofre
- [x] Branch `sessao-06-qualidade` criada
- [x] **Banco (migration 15):**
  - [x] Etapa DANIFICADO garantida por setor (automática — D-25 letra a)
  - [x] Trigger: mover ENTRE setores via interface exige marcação 🟢🟡🔴 vinculada (exceto saída do PCP/entrada e de terminal; API passa livre — RF-86)
  - [x] Trigger: iniciar exige parecer quando a chegada teve marcação (senão livre)
  - [x] Parecer 🔴 (confirmado OU divergente para 🔴) → card vai para etapa DANIFICADO (evento automático)
  - [x] Notificações automáticas no banco: 🟡/🔴 na marcação, divergência no parecer → líderes dos 2 setores + admins (autor excluído); chegada em ESTOQUE → admins (logística: planejamento)
  - [x] Evento `notificacao_enviada` registrado (append-only)
  - [x] Erros do banco em português (padrão SESSAO-05)
- [x] **Front:**
  - [x] ModalMoverCard: marcação obrigatória com os 3 estados + texto do 🟡 (Q-16)
  - [x] Recebimento: "O setor X marcou como Y — você concorda?" antes do primeiro Iniciar (ModalParecer)
  - [x] Linha do tempo conta a história de qualidade (segmento + eventos crus + vitest)
  - [x] Sino de notificações (líder/admin) — canal plataforma
- [x] **Testes:** `test:banco` 2 rodadas (+14 verificações) · tsc · lint · vitest 17/17 · build · F-07 (375px e 768px sem rolagem horizontal; interação sob emulação touch — E-18)
- [x] **Critérios de aceite conferidos um a um** (tabela no handoff)
- [x] Migration aplicada no banco real (autorização de 27/08 nesta conversa) — integração intacta, advisors = 8 WARN esperados
- [x] Teste no navegador com acesso do dono (senha NUNCA gravada em arquivo)
- [x] Handoff em `_docs/Handoffs/` + memória de aprendizado (E-18) + esquema do banco + design system atualizados

## Decisões técnicas

- **Nenhuma tabela nova.** Tipos de evento (`qualidade_marcada`, `qualidade_parecer`, `notificacao_enviada`), view `plt_vw_qualidade_transicoes` e `plt_notificacoes` já existem (SESSAO-02).
- Regras por **trigger** em `plt_privado` (M-14 — valem até para service_role), estendendo o padrão da migration 14.
- Marcação = evento `qualidade_marcada` gravado ANTES da `movimentacao_setor`, vinculados por `evento_referencia_id` na movimentação. Mover+marcar em **uma RPC** (`plt_fn_mover_card_qualidade`) para atomicidade (padrão E-11: endpoint de propósito, gate interno).
- Parecer = `qualidade_parecer` com `evento_referencia_id` → marcação. Divergência é DERIVADA pela view (tipo `divergencia_registrada` não é usado — evitar duplicar verdade, M-04).
- DANIFICADO: coluna `eh_danificado` em `plt_etapas` + função que garante a etapa no setor na hora do parecer 🔴 (criação preguiçosa — setor sem dano nunca vê a coluna).
- Notificação criada por trigger AFTER INSERT (security definer), com corpo relatando exatamente o que aconteceu (Q-18).

## Log de execução

- [27/08] Branch criada. D-25 registrada. Demanda e índice atualizados no cofre.
- [27/08] **Migration 15** (`20260827180000_plt_qualidade_gatilhos.sql`): coluna `plt_etapas.eh_danificado` + índice único parcial; `fn_garantir_etapa_danificado` (criação preguiçosa, `on conflict` promove etapa homônima); `fn_rotulo_estado`; `fn_validar_qualidade` (BEFORE INSERT — marcação obrigatória saindo de produção via interface, parecer da chegada atual 1x, iniciar só após parecer); `fn_reagir_qualidade` (AFTER INSERT — 🔴→DANIFICADO via evento `movimentacao_etapa` origem automacao; notificações líderes dos 2 setores + admins, exclui o autor; chegada em ESTOQUE→admins; evento `notificacao_enviada` com destinatários no `dados`); RPCs `plt_fn_mover_card` (marcação+movimentação atômicas) e `plt_fn_registrar_parecer`. Agora são **8 WARN esperados** nos advisors (6 + 2 RPCs novas).
- [27/08] **test:banco** ajustado: o cenário SESSAO-05 SECC→FITAMENTO agora marca qualidade antes de mover (a regra nova pegou o teste antigo — correto) e ganhou o parecer do líder antes do iniciar. **+14 verificações** da SESSAO-06. Resultado: TUDO VERDE nas 2 rodadas, integração intacta, primeira execução.
- Detalhe de desenho: ordem alfabética dos triggers importa — `projetar` (AFTER) roda antes de `reagir_qualidade`, então a reação já vê o card projetado. `validar_execucao` (BEFORE, "e") roda antes de `validar_qualidade` ("q") — sem dependência entre eles.
- [27/08] **Front**: `moverCard` virou RPC (removido `usuarioId` — o banco identifica pelo auth); `buscarPareceresPendentes` filtra a marcação da CHEGADA ATUAL no cliente (o banco recusa parecer antigo de qualquer jeito); `ModalParecer` auto-inicia após parecer 🟢/🟡, não após 🔴 (o card acabou de ir para DANIFICADO); sino em `src/notificacoes/`.
- [27/08] **Aplicado no banco real** (15 migrations idempotentes, impressão digital idêntica, contagens intactas). Advisors: 8 WARN esperados (E-11) + 1 WARN pré-existente do Auth (leaked password protection — fica para a SESSAO-08).
- [27/08] **Verificação no navegador** (login do dono): mover sem marcar bloqueado → 🟡 SECC→FITAMENTO → banner de pendência → Iniciar abriu o parecer → divergência para 🔴 com observação → coluna DANIFICADO criada sozinha + card nela + sem auto-iniciar → linha do tempo com a história completa. Notificação real: marcação 🔴 por operador.teste.um → aviso chegou ao sino do Wallace com o relato exato → marcado como lido.
- [27/08] **Bug pego pelo F-07 e corrigido na hora**: painel do sino ancorado no próprio sino estourava a borda esquerda (menu quebra linha) → painel agora é `fixed` na borda direita da página.
- [27/08] **E-18 registrado**: cliques de automação estouram timeout sob emulação touch do preview — inspeção visual + JS; gesto de toque real fica para o tablet físico (SESSAO-07).
