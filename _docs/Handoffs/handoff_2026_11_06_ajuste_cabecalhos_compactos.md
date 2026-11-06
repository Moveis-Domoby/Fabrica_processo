---
titulo: Handoff — 2026-11-06 — Ajuste dos cabeçalhos compactos e do padrão visual
tipo: handoff
data: 2026-11-06
atualizado: 2026-11-06
tags: [handoff, ajuste, layout, modelo-de-sistema]
---

# 📋 Handoff — 2026-11-06 — Cabeçalhos compactos e o padrão visual novo

Diário completo (todas as voltas, decisões e armadilhas): [[AJUSTE - Cabecalhos compactos e menu lateral]].
O padrão novo está no [[PLT - Modelo de Sistema]] (seção "Cabeçalho da tela e menu compacto").

## 1. Objetivo

O dono, com o print da MONTAGEM: *"faz um tempo que não altero o layout do sistema, mas vi que isso está bem feio — analisar rota por rota e diminuir o tamanho desses headers e coisas assim de TODAS AS TELAS, SEM EXCEÇÃO"*. Ao longo da madrugada vieram mais ~30 pedidos em 12 voltas (o dono olhando a tela), terminando em: *"ao finalizar tudo, abra todas as telas, sem exceção, e faça diversos testes… se não ficou [quebrado], pode publicar"*.

Mudança de rumo registrada: na 4ª volta eu entendi "exclui o header de cima, deixe como padrão" como TIRAR a barra escura — era o contrário (a barra vira padrão em toda tela) — E-232.

## 2. O que foi feito

### Front
- **Cabeçalho único** (`src/componentes/CabecalhoDaTela.tsx`) em TODA tela da casca: setinha de voltar, nome da tela e o **?** (a explicação) moram na **barra escura de cima** (44 px, em toda tela, também no computador — `VagaDoTitulo` + portal); na página fica só a **linha das ações** (busca, abas, botões) com um traço leve embaixo, **presa no topo** do `md` para cima (`--dm-topo-fixo`).
- **Barra lateral** mais estreita (208 + 196 px), letra de 13 px, itens de 36 px no mouse; no topo só logo + recolher; no rodapé: Modo TV (novo, ao vivo) · Modo tablet · usuário · **⋯** (Tema · Botões flutuantes · Sair). **Lupa e sino só na barra escura.**
- **Botões flutuantes**: por cima do menu, transparência de 0 a 100 (vista própria no ⋯, faixa da casa; **0% = somem de vez**), faixa do pé reservada (folga no fim das páginas, barras fixas de baixo acima deles).
- **Títulos em Inter** (Poppins só na logo, no Modo TV e no topo do tablet); rolagem fina; **sem rodapé com a marca**; "Plataforma de Produção" → **"Sistema Domoby"**.
- **Login** em tela inteira: metade grafite com a logo, metade clara com o formulário; explicações no "i".
- **Telas mexidas além do padrão**: quadro do setor numa linha (Etapas · filtro · ordem; o "soltar aqui começa o tempo" virou o ícone verde, o tablet mantém o texto); Estoque (busca + Cadastrar + abas numa linha); Todos os pedidos (busca + Selecionar numa linha); Programação (parada avulsa no topo do mapa com o "i", painel da rota enxuto, mapa em **tela cheia** com Recolher e "Ver pedidos", card do caminhão de "Já programadas" sem espremer); Setores e etapas enxuta (textos no "i"); Equipe (matrícula numa linha, setores em pílulas); Configurações → Avisos na largura toda; Expedição/Entregas/Danificados/Peça por peça/Insumos com a busca na linha presa; PCP/Controle de tempo/Utilitários/Auditoria com as abas na linha presa; Trocar senha na barra; títulos iguais ao menu.
- **Modo TV**: seleção da casa (não a lista nativa), relógio com **segundos** ao vivo, **trocar o dia** (‹ › "Voltar para hoje" — aparecem só quando o banco responder `pode_trocar_dia`).
- Textos da varredura: plurais, datas e decimais em português, códigos internos com nome de gente (histórico do pedido, Auditoria), textos que não quebram no meio, filtro "Filtrar: pedido ou móvel".

### Banco
- **Arquivo escrito, NÃO aplicado** (falta o OK do dono): `supabase/migrations/20261106020000_plt_modo_tv_ao_vivo_e_dia.sql` — (1) ligar/desligar o Modo TV avisa a pessoa ao vivo (evento `perfil` no canal dela; a casca relê o perfil); (2) `plt_fn_modo_tv(p_setor_id, p_dia)` — o dia escolhido (sem dia = hoje; futuro e >400 dias recusados; devolve `pode_trocar_dia`/`e_hoje`), derrubando a versão de 1 parâmetro. Ensaio (`npm run test:banco`): a conferência nova passa; aplicar com `npm run banco:aplicar -- --confirmar --so 20261106020000_plt_modo_tv_ao_vivo_e_dia.sql`. Depois de aplicar: atualizar `supabase-fabrica-schema.sql` e o [[SUPA - Esquema do Banco]] (regra 10).

### Edge Functions
- Nenhuma.

## 3. Decisões tomadas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| Um componente de cabeçalho para todas as telas + 3–4 frentes paralelas por grupo de arquivos | Editar tela a tela sem componente | ~45 telas; o padrão precisava ser um só (A-193) |
| Barra escura de cima em TODA tela, com o título | Título dentro da página / tirar a barra | Pedido do dono (4ª volta, corrigindo o meu engano) |
| Linha das ações presa só do `md` para cima | Presa também no celular | No celular ela pode ter 2–3 andares e comeria a tela |
| Setas do dia da TV só com `pode_trocar_dia` | Mostrar sempre | O site pode subir antes do banco sem botão quebrado |
| Modo TV e topo do tablet ficaram como estavam (tamanho) | Diminuir também | Decisão do dono na 1ª volta (TV lida de longe; tablet do chão de fábrica) |

## 4. Bugs

### Resolvidos
- Card do caminhão em "Já programadas" espremido (texto letra a letra) — base mínima no texto.
- Coluna do mapa da Programação mais alta que a tela (fim inalcançável) e a barra de baixo cobrindo conteúdo.
- Botões flutuantes tapando o "Programar" e os últimos itens das listas.
- Total ao lado do título sumindo na barra escura (cor "suave" sobre o grafite).

### Descobertos (da varredura de todas as telas — vêm do BANCO e são de antes deste ajuste; NÃO corrigidos: precisam de OK para mexer no banco)
1. **Pedido 13686 em "A entregar"** (Entregas): lançado para ROTAS em 20/10 e cancelado no Tiny depois; `plt_fn_rotas` não exclui pedido cancelado (`pc.lancado_rotas_em` segue preenchido, o card do pedido no PCP não arquivado). Único caso hoje.
2. **Visão do dia × quadros**: "na fila 84" na Limpeza (o quadro tem A LIMPAR 38 + CANCELADO 44 + NÃO ENCONTRADO 4); "em execução agora 3" contando execuções PAUSADAS; "aguardando lançamento para ROTAS 16" contando 4 já programados; as filas não contam o card avulso (SECC 1×2, Fitamento 7×9, Furação 6×7); "espera mais antiga" em dias corridos × o quadro em horas de expediente.
3. **Stand-by**: 7 no painel de Motivos × 6 no PCP e na Expedição.
4. **Calendário (Programação)**: "Fora do calendário: 6 sem rota com a previsão vencida" conta 3 que aparecem na grade (`dados.fora` vem da porta do calendário).
Observações de dado (não erro de tela): motivo de pausa "Banheiro/Aguá/café" com acento errado e "Almoço" duplicado nos motivos (dados em Utilitários); webhook "Estoque de peças - teste" ativo; usuário "teste 21"; caminhões sem placa; "melhor da semana" com 6 min × padrão 31 (caso para Conferir).

## 5. Arquivos alterados

```
src/componentes/{CabecalhoDaTela,BotaoVoltar,MenuDoUsuario,vagaDoTitulo,Layout}.tsx + ui/{Dica,Modal}.tsx
src/estilos/global.css · src/main.tsx · src/lib/opacidadeFlutuantes.ts · index.html
src/busca/BotaoBuscaGeral.tsx · src/perfil/SeletorTemaRapido.tsx · src/notificacoes/SinoNotificacoes.tsx
src/paginas/** (todas as telas da casca + Entrar, TrocarSenha) · src/pedidos/** · src/rotas/** · src/logistica/componentes/**
src/comercial/** (cabeçalhos, títulos, textos) · src/dashboards/tempos/api.ts · src/paginas/dashboards/**
src/kanban/componentes/{QuadroKanban,CartaoUnidade,FiltroDoQuadro}.tsx · src/auditoria/** · src/automacoes/resumo.ts
supabase/migrations/20261106020000_plt_modo_tv_ao_vivo_e_dia.sql (NÃO aplicado) · supabase/testes/testar-migrations.mjs
```

## 6. Impacto nos números visíveis

Nenhum número mudou (só desenho e textos). A Visão do dia, o stand-by do painel de Motivos e o aviso do calendário seguem com as divergências listadas em 4 — eram assim antes.

## 7. Notas do cofre atualizadas

- [[PLT - Modelo de Sistema]] — a seção "Cabeçalho da tela e menu compacto" e as anotações ↪️ 06/11 nas seções antigas
- [[AJUSTE - Cabecalhos compactos e menu lateral]] — o diário das 12 voltas
- [[PLT - Memoria de Aprendizado]] — E-232, A-193, A-194, A-195

## 8. Ficou pendente

- **OK do dono para aplicar o banco** (Modo TV ao vivo + trocar o dia) — sem ele, a TV mostra hoje e o botão Modo TV aparece ao recarregar.
- **Os 4 dados que não batem** (item 4) — uma rodada própria, com investigação de cada porta e o OK para o banco.
- **ClickUp**: este ajuste não tem tarefa (o Claude Code não cria tarefa por conta própria — regra 19).
- As 2 falhas antigas do ensaio do banco (Dashboard comercial em 8 períodos; o fluxo do n8n de ponta a ponta) — já falhavam antes deste ajuste.
