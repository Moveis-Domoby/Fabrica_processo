---
titulo: Plataforma — Memória de Aprendizado (Claude Code + Cowork)
tipo: memoria-aprendizado
data: 2026-08-19
atualizado: 2026-08-24
tags: [plataforma, memoria, aprendizado, erros, acertos]
---

# 🧠 PLT — Memória de Aprendizado

> [!danger] LEITURA OBRIGATÓRIA em TODA construção
> Este arquivo é a memória compartilhada de aprendizado do **Claude Code e do Cowork**. Regras:
> **1.** Ler SEMPRE no início de qualquer sessão de construção ou idealização — sem exceção.
> **2.** Errou → anota NA HORA (1 linha). Corrigiu → anota a correção NA MESMA linha.
> **3.** Acertou algo que deve virar padrão → anota. Descobriu fórmula, modelo mental ou possibilidade → anota.
> **4.** Escrita RESUMIDA: 1 linha por entrada, com ID e data. Nunca apagar entrada — superada ganha `↩️`.
> **5.** Lição que virou lei → promover ao [[CLAUDE - Regras do Claude Code (repo)]] e marcar aqui `→ promovida`.

## 🔴 Erros e correções (E-NN)

- [2026-08-13] **E-01** · Gatilho de automação em aba de fórmula posicional (DADOS/PCP) duplicava cards → **correção:** gatilho só em dado bruto/evento, nunca em derivado. → promovida
- [2026-08-11] **E-02** · OAuth de usuário em fluxo servidor-a-servidor expirou e derrubou produção → **correção:** Service Account para máquina-a-máquina. → promovida
- [2026-08-??] **E-03** · Token do Tiny vazou num print e teve que ser trocado → **correção:** credencial nunca em chat/print/nota; colar direto na ferramenta. → promovida
- [2026-08-11] **E-04** · Trocar o Document ID num node do n8n resetou opções silenciosamente ("Column to match on", Cell Format) → **correção:** após trocar qualquer referência, reconferir TODAS as opções do node/config. Lição geral: mudanças de referência podem resetar configuração sem avisar.
- [2026-08-11] **E-05** · `dados.id` ≠ `dados.numero` no Tiny causou teste errado → **correção:** nunca presumir qual campo é a chave; conferir na doc/fonte antes.
- [2026-08-19] **E-06** (Cowork) · Colei um `file_uuid` truncado no commit de arquivos → 1 arquivo rejeitado (HTTP 400) → **correção:** reenviado e commitado; **regra:** IDs sempre copiados por inteiro e todo commit conferido pelo `"rejected":[]` no resultado.
- [2026-08-24] **E-08** (Cowork) · Escrevi o prompt do Bloco 1 com ~200 linhas repetindo decisões que já estavam no cofre → **correção:** reescrito em 3 linhas apontando só o caminho; regra permanente em F-06 e D-17.
- [2026-08-13] **E-07** · Dois renovadores do token v3 do Tiny se derrubam mutuamente → **correção:** regra do dono único por credencial/recurso. → promovida
- [2026-08-24] **E-09** (Claude Code) · `sed`/`perl` no Git Bash do Windows não casaram padrão contendo a barra invertida de caminho Windows (mangling de argumento do MSYS) e a substituição falhou calada três vezes → **correção:** edição de string com caminho feita via `node -e` usando `String.fromCharCode(92)`; e **sempre conferir o resultado da substituição**, nunca assumir que rodou.

## 🟢 Acertos que viraram padrão (A-NN)

- [2026-08-11] **A-01** · **Copiar o real antes de construir**: engenharia reversa da planilha antes de migrar deu 100% de paridade (1.982 pedidos) — mapear o comportamento existente célula a célula antes de replicar.
- [2026-08-11] **A-02** · **Evento > polling**: construir sobre webhook/evento, nunca varredura — o workflow Tiny nasceu assim e não perde nada.
- [2026-08-11] **A-03** · Manter a mesma URL/UUID de webhook ao migrar sistema → zero janela de integração desligada.
- [2026-08-17] **A-04** · **Dupla escrita antes do corte** (P15): novo destino recebe em paralelo até provar paridade, só então corta.
- [2026-08-19] **A-05** (Cowork) · Entrevista de decisões com IDs (`D-NN`) ANTES de arquitetar → dúvida respondida vira decisão registrada; ninguém rediscute do zero.
- [2026-08-19] **A-06** (Cowork) · Demanda com "Fora do escopo" explícito evita o "aproveitar para fazer" — manter em toda SESSAO-NN.
- [2026-08-24] **A-07** (Claude Code) · **Classe do Tailwind nunca se monta por interpolação** (`bg-marca-${n}`): o gerador varre texto LITERAL no código — classe montada em tempo de execução não existe no CSS final e o elemento sai transparente. Escrever por extenso. Vale para qualquer ferramenta que gere CSS varrendo o fonte.
- [2026-08-24] **A-08** (Claude Code) · **Cor de marca e cor de estado não podem ser da mesma família**: o amarelo Domoby virou cor de AÇÃO, e o 🟡 de qualidade (D-09) foi renderizado em âmbar-laranja. Dois amarelos com sentidos diferentes na mesma tela, sob luz ruim, é erro esperando acontecer.

## 🧠 Modelos mentais (M-NN)

- **M-01** · **Automatizar consequências, não decisões** — o humano decide (PCP, destino, qualidade); o sistema executa o resto do clique (timer, contagem, notificação).
- **M-02** · **O evento é a tabela-mãe** — append-only; timers, filas, dashboards e produtividade são TODOS derivados de eventos, nunca estado editável.
- **M-03** · **Medir depende do gesto humano** — gesto fácil no momento certo vence disciplina; card movido em lote no fim do dia é dado-ficção.
- **M-04** · **Um dono por dado** — duas fontes de verdade se derrubam (planilha vs banco, dois renovadores de token).
- **M-05** · **Dado limpo antes de métrica** — 660 cards mortos transformam qualquer dashboard em mentira.
- **M-06** · **Dupla atestação onde há conflito de interesse** — quem entrega marca, quem recebe confirma (D-09); vale para qualquer handoff entre partes com incentivos diferentes.
- **M-07** · **O que não está escrito na demanda não existe** — presumir requisito é a origem da alucinação; dúvida de negócio → perguntar, nunca preencher.
- **M-08** · [2026-08-24] **Fila é do setor, execução é da pessoa** — tempo sem dono individual atribui-se ao coletivo (fila longa = gargalo = contratar), tempo com gesto individual atribui-se a quem clicou. Nunca inverter.
- **M-09** · [2026-08-24] **Número de sessão é ID, não ordem** — a ordem de execução vive só no índice [[000 - ORDEM DAS SESSOES]]; renumerar arquivos para reordenar cria lixo e quebra links.
- **M-10** · [2026-08-24] **Configurável > adivinhado** — onde o dono conhece o detalhe e o sistema não (etapas internas de cada setor), entregar o CADASTRO e semear vazio. Chutar estrutura operacional gera trabalho de desfazer e dado errado. (Origem: D-14.)
- **M-11** · [2026-08-24] **Timer é propriedade da etapa, não feature avulsa** — toda etapa cadastrada já nasce contando tempo para quem chega nela; assim medir não depende de ninguém "ligar" nada.
- **M-12** · [2026-08-24] **Estado nunca se comunica só por cor** — ícone e texto sempre juntos. Daltonismo é comum e a iluminação do galpão é ruim; cor sozinha é informação que parte da equipe não recebe.

## 🧪 Fórmulas e receitas (F-NN)

- **F-01** · Ciclo de sessão Claude Code: ler demanda 2x → ler decisões + design system + ESTA memória → listar dúvidas → task list → branch → codar computando tudo em `docs/execucao/SESSAO-NN.md` → conferir task list contra a demanda → PR → handoff.
- **F-02** · Ciclo de banco: ler [[SUPA - Esquema do Banco]] → escrever migration → aprovação explícita do dono → aplicar → atualizar `supabase-fabrica-schema.sql` + nota.
- **F-03** · Ciclo de erro: errou → registrar E-NN aqui NA HORA → corrigir → completar a linha com a correção → se virou lei, promover ao CLAUDE.md.
- **F-04** · Commit no vault: sempre conferir `"rejected":[]` no resultado; ID rejeitado → reenviar o arquivo, nunca "assumir que foi".
- **F-05** · Integração nova: replicar formato real observado (payload/célula/card verdadeiro), não o formato deduzido da documentação.
- **F-06** · [2026-08-24] **Prompt do Claude Code é mínimo: só o caminho.** Se está no cofre, não se repete no prompt — texto duplicado vira segunda fonte de verdade que envelhece sozinha (viola M-04). O Cowork entrega o prompt **no chat**, pronto para colar. (Erro do Cowork corrigido: primeiro prompt do Bloco 1 nasceu com ~200 linhas replicando as decisões → reescrito para 3 linhas.)

- **F-07** · [2026-08-24] **Ciclo de verificação de tela:** `tsc` → `lint` → testes → abrir em viewport de CELULAR **e** de TABLET e medir o DOM (altura de alvo de toque, rolagem horizontal) ANTES de declarar pronto. Foi assim que apareceram o dado repetido no card do celular e o hook com nome fora da convenção.

## 💡 Possibilidades a explorar (X-NN)

- **X-01** · Automação de destino via API quando os padrões de roteiro emergirem dos dados reais (D-03) — os eventos acumulados vão REVELAR o roteiro típico por produto.
- **X-02** · QR/bipe por unidade como gesto físico de chão de fábrica (ideia C do handoff) — candidato natural a substituir/complementar o toque no tablet nas etapas.
- **X-03** · Tiny→PCP: decidir na SESSAO-10 entre trigger no banco vs chamada do n8n à API — registrar prós/contras medidos, não teóricos.
- **X-04** · Tempo acumulado por produto pode gerar "tempo-padrão" automático por item — insumo futuro para peso de produtividade (⏸️ D-04) e para custo real (ideia I).

## Ver também

[[CLAUDE - Regras do Claude Code (repo)]] · [[PLT - Decisoes de Produto]] · [[000 - ORDEM DAS SESSOES]]
