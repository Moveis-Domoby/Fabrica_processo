---
titulo: "SESSAO-54 — Comercial: janelas da plataforma no lugar dos alertas do navegador, e a função antiga preparada para sair"
tipo: demanda
status: 🔨 feita no ramo `sessao-54-comercial-janelas-e-limpeza` (18/11/2026, madrugada) — nada na main, nada no banco; espera a revisão e o OK do dono
data: 2026-11-18
atualizado: 2026-11-18
origem: o débito técnico do Comercial ([[PLT - Comercial - Debito Tecnico]]), conferido em 18/11 — itens DT-D24, DT-BD4 e DT-G16. Pedido gravado na fila do Escritório (`_escritorio/handoffs/sessao-54-comercial-janelas-e-limpeza-prompt-claude-code.md`).
tags: [plataforma, demanda, comercial, debito-tecnico, modal, banco]
---

# 🎯 SESSAO-54 — Comercial: janelas da plataforma e limpeza da função antiga

> **Leva da fila de 18/11 (o dono dormindo):** trabalho sem perguntas de negócio; o que faltar vira decisão provisória registrada no diário ([[SESSAO-54]]) e no handoff. Esta demanda **não** está linkada na [[000 - ORDEM DAS SESSOES]] (regra da leva — a nota é das que não se editam nesta noite).

## O que é

O Comercial ainda fala com a pessoa pelas caixas do navegador (o "OK/Cancelar" cinza) em duas telas — a tabela de clientes e o detalhe da lista de disparo — e o banco ainda guarda uma função antiga, sem tela nenhuma, que devolve dado de cliente. Esta demanda troca as caixas pelas janelas e avisos da plataforma e deixa pronta, em arquivo, a remoção da função.

## Requisitos cobertos

Nenhum requisito novo — é pagamento de dívida do módulo Comercial: **DT-D24** (alertas nativos), **DT-BD4** (função legada com dado pessoal) e, opcional, **DT-G16** (ordenação da tabela só na página).

## Decisões que regem esta demanda

- **D-27** (modelo de sistema: componente da casa, nada de código interno em texto de tela) e a seção `<Modal>` / `useNotificacao()` do [[PLT - Modelo de Sistema]].
- **D-06** (mobile-first: botão de toque) e **D-36** (lei de layout).
- **D-46** (a trava do disparo fica no código; nenhum caminho novo de envio).
- Regras 2 e 3 do `CLAUDE.md`: exclusão no banco **só com o OK do dono** — a migration fica em arquivo.
- Lei de Desempenho e Escala (regra 18): porta tocada com plano medido; a tela nova tolera o banco de antes.

## Comportamento esperado

1. **Alertas do navegador → janelas e avisos da plataforma (DT-D24).** São 16 chamadas de `alert()`/`confirm()` em 2 arquivos: `src/comercial/components/CustomersTable.tsx` e `src/comercial/components/ListasDisparo/ListasDisparoDetalhe.tsx`.
   - Trocar pelo modal e pelos avisos do sistema, como no resto da plataforma.
   - Confirmação que destrói ou dispara algo vira modal próprio, com botão de toque.
   - O comportamento (o que acontece em cada escolha) **não muda**.
2. **A função antiga com dados de clientes (DT-BD4).** `fn_dashboard_transitions` veio na cópia do painel de recompra e não é usada.
   - Confirmar no código que nada a chama, e apagar o gancho morto, se existir.
   - Escrever a migration que a remove, **só em arquivo**. Aplicar é com o OK do dono, porque é exclusão.
3. **Se couber (opcional): a ordenação da tabela de clientes no servidor (DT-G16).** Hoje "mais antiga primeiro" inverte só a página 1, e não o resultado inteiro.
   - Só fazer se der para manter a porta compatível com quem já a chama.
   - Se não der, deixar registrado como próximo passo.

## Fora do escopo

- Qualquer coisa fora do módulo Comercial (`src/comercial/` e as funções dele): nada da fábrica, das rotinas agendadas ou das notas grandes.
- Aplicar migration, publicar, mexer no n8n, push/merge — nada sai do computador nesta sessão.
- Os outros itens do débito técnico do Comercial (seleção só da página, polling antigo, tipos de evento etc.).
- Editar as notas grandes (Decisões, Memória de Aprendizado, Esquema do Banco, Lei de Desempenho, Mapa, Ordem das Sessões, Próximos Passos) — o que iria para elas fica no diário e na seção "Para entrar nas notas depois da dieta" do handoff.

## Critérios de aceite

- [x] Zero `alert()`/`confirm()` no Comercial; cada confirmação com modal do sistema e o mesmo efeito de antes.
- [x] A migration de remoção pronta em arquivo e a prova de que nada chama a função.
- [x] Lint, build e testes do Comercial passando.
- [x] Celular (375) e tablet (768) sem rolagem lateral nas telas tocadas.

## Notas para o Claude Code

- **Banco:** só em arquivo de migration; recriar cada função a partir da última versão nas migrations; numeração a partir de `20261118120000_`; faixas novas na bateria de testes; o que precisar ser conferido no banco vivo vai para "Para ligar com o dono" no handoff.
- **Ciclo do `CLAUDE.md`:** task list espelhando a demanda; diário contínuo; commits pequenos; lint, build e testes (falha que já existia antes, só registrar); plano ×100 das portas novas ou tocadas, quando der para medir.
- **Outras mesas trabalham ao mesmo tempo:** a SESSAO-49 (dieta da documentação) reorganiza as notas grandes; a SESSAO-34 mexe nas rotinas agendadas do banco; as SESSÕES 52 a 55 cuidam cada uma da sua área.

## Leitura da sessão

- `CLAUDE.md` da raiz do repositório e o do cofre;
- esta demanda (duas vezes);
- [[PLT - Comercial - Debito Tecnico]] (DT-D24, DT-BD4, DT-G16, DT-BD5, DT-F4, DT-F7) e [[PLT - Comercial - Telas]];
- [[PLT - Modelo de Sistema]] — os componentes `<Modal>`, `<Botao>` e `useNotificacao()`;
- [[PLT - Lei de Desempenho e Escala]] — §6 (paginação), §7.2/§7.4/§7.6 (índices, portas, migrações) e §12 (checklist);
- [[SUPA - Comercial - Dominio de Dados]] e as migrations do Comercial (`20260915120000`, `20260915180000`, `20261016110000`) — a última versão de cada função sai delas;
- as lições de vitrine da memória de aprendizado (A-117, A-200, A-227) para conferir tela logada sem login.

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)

- [Comercial - Janelas da plataforma no lugar dos alertas do navegador e limpeza de uma função antiga](https://app.clickup.com/t/17tya50wqt6)

*Nesta sessão (modo fila) o ClickUp não foi tocado — quem move e conclui é o dono.*

## Resultado (18/11/2026, madrugada)

Ver o diário [[SESSAO-54]] e o handoff [[handoff_2026_11_18_sessao54_comercial_janelas_e_limpeza]].
