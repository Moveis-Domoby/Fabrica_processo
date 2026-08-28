---
titulo: Handoff — SESSAO-07 Tela do Setor (Tablet)
tipo: handoff
data: 2026-08-28
atualizado: 2026-08-28
tags: [handoff, sessao, plataforma, tablet, d-27, d-28, d-29]
---

# 📋 Handoff — SESSAO-07 · Tela do Setor (Tablet)

**Branch:** `sessao-07-tela-setor` (mesclada na `main` — autorização do bloco noturno D-26)
**Banco:** projeto `axnzldwgwsmepukdiljx` — **migration 16 aplicada em 28/08** (integração intacta, contagens idênticas)
**Demanda:** [[SESSAO-07 - Tela do Setor Tablet]] · **Memória de execução:** `docs/execucao/SESSAO-07.md`
**Decisões que nasceram no aval do bloco:** [[PLT - Decisoes de Produto#D-28|D-28]] (card do operador) · [[PLT - Decisoes de Produto#D-29|D-29]] (controle de tempo) — além da D-27 executada aqui.

## 1. O que foi feito

### Prelúdio D-27 (padrões do sistema inteiro)

- **Menu lateral** no lugar da barra superior: coluna fixa no computador, gaveta no celular (hambúrguer + overlay); sino/usuário/sair no rodapé da sidebar. `/tablet` renderiza **sem navegação** (tela cheia).
- **Modelo de sistema no cofre:** `docs/design-system.md` migrou para [[PLT - Modelo de Sistema]] (fonte única); rota e página `/design` removidas; os dois `CLAUDE.md` e o `README` apontam o caminho novo.
- **Microinteração do `Botao`:** elevação de 2px + sombra suave no hover/foco, assenta no toque — herdada por todo botão.
- **Varredura de códigos internos:** nenhuma string visível com D-NN/RF-NN/Q-NN — nem no front, nem nas **mensagens de erro do banco** (migration 16 recriou `fn_gerar_matricula`, `fn_validar_execucao`, `fn_validar_qualidade`, `fn_reagir_qualidade` com os códigos movidos para comentários do fonte).

### A tela do setor (`/tablet`)

- **Modo setor:** o dispositivo escolhe o setor uma vez (fica salvo no aparelho); conta com um vínculo só abre direto no setor da pessoa (celular pessoal — D-06). Fila em tela cheia, cards ordenados por chegada, **o mais antigo esperando ganha destaque** (borda âmbar + ampulheta + texto).
- **Card do operador (D-28):** dados do produto (descrição, código, unidade k/n, pedido, previsão), etiqueta da etapa, tempo grande, estado de qualidade — **nenhum dado de cliente**. Botão de **Fotos** abre a galeria do produto (bucket `plt-imagens`; admin/líder anexa, operador vê — pronta para a biblioteca de peças).
- **Toda ação pede o PIN (D-06):** Receber · Iniciar · Finalizar · Mover abrem o "quem é você?" — o operador **toca no próprio nome** (lista dos membros do setor) e digita o PIN num **teclado na tela** (zero teclado do sistema). O gesto sai registrado no nome de quem digitou: RPCs ganharam `p_operador_id` (migration 16) e os inserts de iniciar/finalizar usam o id do operador.
- **Tempo real + som (D-28):** mudança em `plt_cards` chega por Realtime e a fila atualiza na hora; card novo toca **dois toques curtos e baixos** (WebAudio, sem arquivo). Polling de 20s segue como rede de segurança.
- Recebimento pendente é **inconfundível** (faixa âmbar + botão primário "Receber") e o Iniciar passa pela confirmação — o banco também trava (SESSAO-06).

### Controle de tempo do admin (D-29) — `/administracao/tempo`

- **Horário de funcionamento por setor E por pessoa** (dias da semana + início/fim). Sem horário = conta o dia inteiro; com os dois, vale a interseção.
- **Desligar o tempo agora** de um setor/pessoa, até religar (lista âmbar com botão Religar).
- **Correção retroativa** ("esqueci de desligar") com motivo — seção emoldurada de vermelho, o botão de risco.
- **Nada altera o registrado:** eventos intactos; o desconto vive em `plt_privado.fn_tempo_util` (multirange, fuso America/Fortaleza), que a SESSAO-10 usa nos dashboards.

## 2. Verificação executada

| Critério da demanda | Resultado |
|---|---|
| Ciclo receber → iniciar → finalizar → mover+marcar só com toques | ✅ PIN por teclado na tela; **testado no navegador contra o banco real**: Iniciar e Finalizar via PIN do `Operador Teste Um` (PIN 1234) sob sessão de admin — eventos saíram no nome do operador. Mover+marcar por PIN provado no `test:banco` (RPC com `p_operador_id`) |
| Dois operadores no mesmo tablet, autores distintos | ✅ provado no banco (`test:banco`: sessão exec.um agindo, autor exec.dois) e na tela (sessão Wallace, autor Operador Teste Um). Teste com o segundo PIN físico fica no passo a passo abaixo |
| Card novo aparece em tempo real | ✅ `plt_cards` na publicação realtime (confirmado por SQL) + invalidação por canal + polling de segurança; som discreto na chegada |
| Recebimento pendente inconfundível; iniciar passa pela confirmação | ✅ faixa âmbar + botão Receber; trigger do banco continua travando por baixo |
| Prelúdio D-27 completo | ✅ sidebar, modelo de sistema no cofre (sem rota /design), microinteração, varredura (front + banco) |
| PR + handoff com screenshots | ⚠️ merge direto (D-20/D-26). **Screenshots ficaram pendentes**: o painel de preview do bloco noturno não compõe frames sem ninguém olhando (A-13) — a conferência foi por DOM/JS (estrutura, gaveta mobile, sem rolagem horizontal em 375px). Tire os prints na revisão da manhã (2 min) |

Mais: `test:banco` TUDO VERDE (2 rodadas, **+8 verificações novas**: mensagens sem código, autor por PIN, gate do operador, tempo útil com horário/pausa/interseção) · tsc · lint · Vitest 17/17 · build ok · migration aplicada com integração intacta · advisors: **os mesmos 8 WARN esperados** (endpoints de propósito) + leaked-password (pré-existente; fica para a sessão de publicação — D-30).

## 3. Como validar (do zero, ~5 min)

1. `npm run dev` → entre como admin → repare no **menu lateral** (no celular, hambúrguer).
2. Menu → **Tela do setor** → escolha **SECC** → a fila abre em tela cheia.
3. No card, toque **Iniciar** → toque no nome **Operador Teste Um** → PIN `1234` no teclado da tela → o card entra em execução **no nome dele** (não no seu).
4. **Finalizar** com o mesmo PIN → o card volta à fila. Toque **Mover** → PIN → escolha destino + estado 🟢🟡🔴 → o evento sai no nome do operador (confira no histórico do card).
5. **Fotos** no card → anexe uma imagem (você é admin) → ela aparece na galeria.
6. **Administração → Controle de tempo** → desligue o tempo da SECC → religue; cadastre um horário seg–sex 07–17; teste a correção retroativa.
7. Abra a tela do setor em outro dispositivo/aba e crie/mova um card para o setor: ele aparece sozinho, com o som.

## 4. Decisões provisórias do bloco (para você confirmar)

- **Verificação de tela na 07** apesar da regra "a cada 2–3 sessões": foi ENXUTA (DOM/JS, sem screenshots) porque a sessão trocou o layout inteiro — as próximas conferências visuais ficam para a 10 e a 12.
- **Imagens públicas para leitura** (bucket `plt-imagens` público): foto de móvel não é dado sensível e simplifica o tablet; escrita continua só admin/líder. Se preferir bucket privado com URL assinada, é ajuste pequeno.
- **"Espera há X" da tela do setor usa tempo corrido** (não desconta horário/pausa) — é sinal de fila, não métrica; o desconto do D-29 entra nos números da SESSAO-10.
- **Membros no modal de PIN**: a lista vem dos vínculos do setor; se a conta do dispositivo não puder ler os vínculos (RLS), o modal cai para o campo de matrícula/usuário. Testado com sessão admin; teste com uma conta de operador na revisão.

## 5. Ficou pendente / limitações conhecidas

- **Screenshots** em tablet e celular (critério da demanda) — pendência da manhã (A-13).
- **Conta de dispositivo por tablet**: criar os usuários `tablet.secc` etc. é gesto seu (Equipe → novo usuário, papel operador, vínculo no setor). A tela funciona com qualquer conta vinculada.
- **Card que SAI do setor para um setor que a conta não enxerga** não gera aviso realtime (RLS) — o polling de 20s cobre.
- Chunk do build segue ~770 kB (pendência herdada) · advisor do leaked password fica para a sessão de publicação (D-30).
- **Troque a senha do admin** (ficou em chat de novo — lembrete permanente do plano).

## 6. Notas do cofre atualizadas

[[PLT - Decisoes de Produto]] (D-28…D-34 + complemento D-26) · [[PLT - Modelo de Sistema]] (nasceu — e ganhou as seções da SESSAO-07) · [[SUPA - Esquema do Banco]] (migration 16) · [[PLT - Memoria de Aprendizado]] (A-12, A-13) · [[PLT - Perguntas em Aberto]] (Q-24/31/32/50/51/52 ✅; Q-60/62 ⏸️) · [[000 - ORDEM DAS SESSOES]] · os dois `CLAUDE.md` · `README.md`.

## Ver também

[[SESSAO-07 - Tela do Setor Tablet]] · [[handoff_2026_08_27_sessao06_qualidade]] · [[PLT - Plano Noturno Sessoes 07-12]]
