---
titulo: Handoff — SESSAO-06 Qualidade nas Transições
tipo: handoff
data: 2026-08-27
atualizado: 2026-08-27
tags: [handoff, sessao, plataforma, qualidade, d-09]
---

# 📋 Handoff — SESSAO-06 · Qualidade nas Transições

**Branch:** `sessao-06-qualidade` · **Repositório:** `contatodomoby/Fabrica_processo`
**Banco:** projeto `axnzldwgwsmepukdiljx` (org **Tech**) — migration 15 **aplicada em 27/08 com autorização dada na conversa**
**Demanda:** [[SESSAO-06 - Qualidade nas Transicoes]] · **Memória de execução:** `docs/execucao/SESSAO-06.md`

## 1. Objetivo da sessão

A dupla atestação da D-09 (revisada: sem foto, sem disputa/pausa) virou regra de banco e gesto de tela. As respostas do dono no início viraram a **[[PLT - Decisoes de Produto#D-25|D-25]]**: notificação para os **líderes dos dois setores + admins** · etapa **DANIFICADO garantida pelo sistema** em cada setor · **saída do PCP sem marcação** · ROTAS aceita registro unilateral e **chegada em ESTOQUE avisa os admins** (logística fica no planejamento) · **API só chega em PCP/ROTAS** (sem qualidade) · movimentação de etapa **dentro** do setor sem qualidade.

## 2. O que foi feito

### Banco (migration 15 — `plt_qualidade_gatilhos`)

- **Regras por TRIGGER** (valem até para a service_role — M-14), com erros já em português:
  - **Mover entre setores saindo de setor de PRODUÇÃO pela interface exige a marcação 🟢🟡🔴** vinculada (`evento_referencia_id`), da mesma transição, do mesmo autor, nunca reaproveitada. Saída do PCP/terminal e origem `api`/`automacao` passam livres (RF-86/D-25).
  - **Iniciar exige o parecer do recebedor** quando a chegada teve marcação; o parecer responde **só à chegada atual**, uma vez, e é gesto de pessoa (Q-19).
- **Reações automáticas** (M-01 — o humano decide, o sistema executa a consequência):
  - Parecer **🔴** (confirmado OU divergente para 🔴) → evento `movimentacao_etapa` automático para a **etapa DANIFICADO** do setor, **criada sozinha na primeira vez** (`plt_etapas.eh_danificado`; uma por setor; etapa homônima cadastrada à mão é promovida, não duplicada).
  - **Marcação 🟡/🔴** e **parecer divergente** → `plt_notificacoes` para líderes dos 2 setores + admins (**autor excluído** — ninguém se auto-avisa), com o relato exato: quem marcou o quê, setores, os dois pareceres (Q-18).
  - **Chegada em ESTOQUE** → aviso aos admins (lá não há "iniciar", ninguém confirmaria; o aviso substitui a segunda atestação — D-25).
  - Cada lote de avisos vira evento **`notificacao_enviada`** (append-only, destinatários no `dados`).
- **2 RPCs novas** (padrão E-11 — total agora **8 WARN esperados** nos advisors): `plt_fn_mover_card` (marcação + movimentação **numa transação**) e `plt_fn_registrar_parecer`.

### Front

- **ModalMoverCard**: saindo de setor de produção, aparece o bloco obrigatório com os 3 estados (BadgeEstado + descrição; o texto do 🟡 é o do dono — Q-16). Sem marcar, não move — o front avisa e o banco trava.
- **Recebimento (`ModalParecer`)**: card com entrega marcada mostra a faixa *"{SETOR} entregou como {estado} — confirme ao iniciar"*; o **Iniciar abre a confirmação primeiro**: *"O setor X (Fulano) marcou como Y — você concorda?"*, com "Concordo com X" na opção igual e aviso de divergência antes de confirmar. 🟢/🟡 seguem direto para o Iniciar; **🔴 não inicia** — o card acabou de ir para DANIFICADO.
- **Coluna DANIFICADO** com selo vermelho no cabeçalho do quadro.
- **Linha do tempo**: cada chegada mostra *Entrega de {setor} ({pessoa}): estado* · *Recebimento de {pessoa}: estado* · selo **"divergência — liderança avisada"** e a observação do recebedor; eventos de qualidade na lista crua com badge.
- **Sino de notificações** no topo (`src/notificacoes/`): contador de não lidas, painel fixo na borda direita (bug de estouro em tela estreita pego pelo F-07 e corrigido), toque marca como lida, "marcar todas".

## 3. Verificação executada (critérios de aceite)

| Critério | Resultado |
|---|---|
| Impossível mover card entre setores sem marcar estado | ✅ trigger (`test:banco`) + navegador: "Marque o estado da peça para mover (D-09)" e RPC recusa |
| Impossível iniciar sem responder à confirmação de recebimento | ✅ trigger re-testado nas 2 rodadas + navegador: Iniciar abre o parecer primeiro |
| Divergência registra os dois pareceres e NÃO trava o card | ✅ view `divergente=true`, card seguiu; provado no banco real (🟡 SECC → parecer 🔴 FITAMENTO) |
| 🟡/🔴/divergência notificam líder/admin com o relato exato | ✅ `test:banco` (líder do setor recebedor notificado no 🟡) + produção: marcação 🔴 do operador.teste.um chegou ao sino do Wallace com o relato completo |
| 🔴 confirmado → DANIFICADO; API move sem exigir estado | ✅ coluna DANIFICADO criada sozinha no navegador + `test:banco` (move via `origem='api'` passa sem estado; chegada em ESTOQUE avisou admins) |
| Linha do tempo conta a história de qualidade completa | ✅ navegador (entrega 🟡, recebimento 🔴, divergência, observação) + 2 testes novos de unidade |
| PR + handoff + memória de aprendizado | ✅ este documento (PR dispensado — D-20; **merge na main autorizado na conversa**) · E-18 registrado |

Mais: `test:banco` TUDO VERDE (2 rodadas, **+14 verificações**, integração com impressão digital idêntica) · tsc · lint · Vitest **17/17** · build ok · migration aplicada no banco real com contagens intactas · advisors com os **8 WARN esperados** (endpoints de propósito — E-11). F-07: 375px e 768px sem rolagem horizontal do body; modal em folha inferior no celular.

## 4. Como validar de novo (do zero)

1. `npm run test:banco` → tudo verde.
2. `npm run dev` → entrar como admin → **SECC** → **Mover** um card → escolher outro setor de produção → tentar Mover sem marcar (bloqueia) → marcar 🟡 → Mover.
3. No setor de destino: o card mostra *"SECC entregou como 🟡"* → **Iniciar** → responder o parecer. Concordando 🟢/🟡, o Iniciar acontece na sequência; escolhendo 🔴, a coluna **DANIFICADO** aparece com o card dentro e nada inicia.
4. Botão de **histórico** do card → a chegada mostra entrega, recebimento, divergência e observação.
5. Com outro usuário fazendo a marcação 🟡/🔴 (ou divergindo), o **sino** do admin/líder ganha o aviso com o relato — toque marca como lida.
6. Mover unidade **do PCP** para qualquer setor: nenhuma marcação é pedida (D-25).

## 5. Estado que ficou no banco (permanente por desenho — append-only)

- Card do **pedido 13207** (Cadeira Tiffany): SECC → FITAMENTO com 🟡 (Wallace), parecer 🔴 divergente com observação *"quina lascada no transporte"* → está na etapa **DANIFICADO da FITAMENTO** (etapa criada pelo fluxo).
- Card do **pedido 13192**: marcação 🔴 avulsa por `operador.teste.um` (SECC→CNC, sem mover) feita para provar a notificação — o badge do card ficou 🔴; 1 notificação para o Wallace (lida).

## 6. Ficou pendente / limitações conhecidas

- **Autor excluído do próprio aviso**: enquanto você for o único admin e fizer os dois gestos, nenhuma notificação nasce (não há a quem avisar). Com operadores/líderes de verdade, o fluxo completo roda — foi provado com o operador de teste. Se preferir que o admin-autor TAMBÉM receba, é um ajuste de uma linha (me diga).
- **Logística no aviso de ESTOQUE**: notifica só admins por ora — "logística" ainda não existe como entidade (o PCP é a logística — D-22). Fica no planejamento, como você pediu (D-25).
- **Gesto de toque sob emulação**: cliques de automação travam sob emulação touch (E-18) — o layout mobile/tablet foi conferido visualmente; o toque REAL se prova no tablet físico na SESSAO-07.
- Advisor pré-existente do Auth (*leaked password protection disabled*) — sugestão: ligar na SESSAO-08, junto do endurecimento para ir ao ar.
- Chunk do build segue ~770 kB (code-split — pendência herdada) · Q-30 (modo escuro) e Q-42 (notificação externa WhatsApp/e-mail) continuam em aberto.
- **Lembrete de segurança (de novo):** a senha do admin foi dita em chat nesta sessão — **trocar antes de a plataforma ir ao ar** (você já disse que vai).

## 7. Notas do cofre atualizadas

[[PLT - Decisoes de Produto]] (**D-25**) · [[SESSAO-06 - Qualidade nas Transicoes]] (respostas de 27/08, status) · [[SUPA - Esquema do Banco]] (migration 15) · [[PLT - Memoria de Aprendizado]] (**E-18**) · `docs/design-system.md` (marcação, parecer, sino) · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]].

## Ver também

[[SESSAO-06 - Qualidade nas Transicoes]] · [[handoff_2026_08_27_sessao05_timers]] · [[PLT - Decisoes de Produto]] · [[SUPA - Esquema do Banco]]
