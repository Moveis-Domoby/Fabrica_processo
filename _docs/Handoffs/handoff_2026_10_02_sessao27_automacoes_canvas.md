---
titulo: Handoff — 2026-10-02 · SESSAO-27 · Automações em canvas (+ Configurações, Super admin, Utilitários)
tipo: handoff
data: 2026-10-02
atualizado: 2026-10-02
tags: [handoff, sessao, sessao-27, automacao, canvas, etiquetas, campos-customizados, super-admin]
---

# 📋 Handoff — 02/10/2026 · SESSAO-27 · Automações em canvas

**Branch:** `sessao-27-automacoes-canvas` (nasceu da branch da S29 — a Auditoria vai junto para a `main` no merge). **Banco:** migration 51 **aplicada** (02/10 03:13 UTC) e **reaplicada** com o "Se… senão" (04:11 UTC), as duas com o OK do dono, integração idêntica. **Site e Edge Function `api`:** ainda **não publicados** — esperam o "pode subir" do dono. Memória técnica: [[SESSAO-27]] (`Plataforma/Execucao/SESSAO-27.md`).

## 1. Objetivo da sessão

A demanda: [[SESSAO-27 - Automacoes em Canvas]] — automações montadas num **canvas** (estilo n8n), começando por "entrou na etapa X → mover / arquivar / etiqueta". O dono abriu o escopo no início (respostas de 01/10, na execução):

- *"A automação em canvas deve ser para **tudo**, comercial, api, pedidos, e **só eu vou construir** essas coisas, então eu vou saber quando ligar"* → mover pode (revisa a D-03), e quem cria é só ele (D-99).
- *"Crie uma aba … chamada **Utilitários**, lá dentro coloque para cadastrar **etiquetas e campos customizados**"*; etiquetas *"quantas eu quiser"*, com nó de **tirar etiqueta**; nó de **trazer de volta** (D-100, D-101).
- **Reorganização:** o canvas é **só do super admin**; o antigo "Painel admin" vira **Configurações**; a engrenagem do rodapé vira o **seletor de tema**; nasce o **Painel super admin** (só o usuário dele) com **Auditoria** e **Automações** (D-102).
- Catálogo: todos os QUANDO propostos + *"alimente com outros nós que você imagine fazer sentido"*; FAÇA com preencher campo, avisar no sino, chamar endereço de fora, esperar (D-103).

**Mudanças de rumo durante o teste ao vivo (02/10, madrugada):**
1. *"Está pequeno demais … deve abrir uma área de workflow com foco no trabalho … fecha inclusive o menu esquerdo"* → depois: *"deixa apenas que feche o menu automaticamente quando entrar, mas a pessoa pode abrir novamente … as últimas execuções ficam ocultas tipo n8n … permita fechar"* o painel lateral → **D-105** (o editor vira área de trabalho).
2. *"Ajuste a hierarquia disso aqui, está tudo fora de esquadro"* (a janela "Que bloco vem depois?") e *"coloque separador lógico condicionais tipo, if (com um else embutido como segunda saída)"* → **D-106** (o "Se… senão" + a escolha por grupos).
3. *"Esse modal de select não está no padrão do sistema"* (a caixinha "Ver as arquivadas") → filtro **"Mostrar"** no padrão dos painéis.

## 2. O que foi feito

### Front
- **Navegação:** grupos **Configurações** (`/configuracoes/*`; os antigos `/admin/*` redirecionam) e **Super admin** (`/super-admin/automacoes`, `/super-admin/auditoria`), guarda de rota pelo `super_admin` do cadastro; **seletor de tema** no rodapé (ícone + seletor pequeno).
- **Utilitários** (`/configuracoes/utilitarios`): abas Etiquetas · Campos customizados; cadastrar, editar, arquivar, excluir (só sem uso — o banco recusa e manda arquivar); filtro "Mostrar: Ativas | Com as arquivadas".
- **Etiquetas no card** (pílulas, várias) no quadro, no tablet e no card do pedido do PCP; **campos no card** ("Nome: valor", até 3 + "no histórico") e no detalhe do pedido, com edição à mão pelo admin.
- **Automações** (`src/automacoes/*`, `src/paginas/Automacoes.tsx`): lista (selo Ligada/Desligada, a frase do QUANDO, última vez, disparos em 24 h, Ligar/Desligar em dois toques, "Mostrar: Ativas | Arquivadas", paginada no servidor) e o **editor-área de trabalho**: menu recolhido na entrada (reabre), canvas na tela toda, barra fina (voltar · nome · selo · abas **Editor | Execuções** · Salvar · **Publicar** = salva e liga / Desligar · arquivar), gaveta do bloco à direita com X.
- **Canvas próprio** (sem biblioteca): blocos arrastáveis, ligações em SVG (tocar escolhe, botão tira), "+" ao lado de cada bloco, zoom e "caber na tela" (ajusta sozinho ao abrir), blocos soltos tracejados ("solto — não roda").
- **"Se… senão"**: duas saídas (Sim verde, Senão vermelho), um "+" em cada; a escolha do bloco vem **por grupos** (Lógica · No card · Etiquetas e campos · Avisos e integrações), cartões do mesmo tamanho.
- **Execuções:** cada disparo com o selo da situação, o que disparou em língua de gente, a condição, cada passo com o resultado e **"Trazer de volta"** quando a automação arquivou.
- **Tablet/celular:** botões da lista, do histórico e da barra do editor em 44px; o nome não espreme; sem rolagem lateral.

### Banco (migration 51 — `20261002120000_plt_automacoes_canvas.sql`)
- `plt_usuarios.super_admin` (só o dono) + `fn_eh_super_admin`; Auditoria passa a exigir super admin.
- Tabelas novas: `plt_etiquetas`, `plt_campos`, `plt_campos_valores`, `plt_automacoes` (nasce desligada — garantido por gatilho), `plt_automacao_execucoes`; coluna `plt_cards.etiquetas` (projeção por evento). Tipos de evento novos: etiqueta posta/tirada, card trazido de volta.
- **O motor:** gatilho ADIADO sobre os eventos (roda no fechamento do gesto, depois da projeção — nome "zzzz", E-78) e outro em `pedidos` (situação mudou, à prova de falha); cada passo num bloco protegido (a falha vira registro, não desfaz o gesto nem a gravação do Tiny); cadeia limitada a 5 e disjuntor de 50 por gesto; relógio só existe com "parado há" ligado ou alguém esperando.
- **"Se… senão"** (reaplicação): validação recursiva (5 níveis, 40 passos contando os caminhos, nada depois dele), o executor troca o plano pelo caminho escolhido (a espera dentro do caminho retoma certo), a lista conta os passos dos caminhos, e etiqueta/campo usado só num caminho conta como usado.
- 2 exemplos de fábrica, **desligados**.

### Edge Functions
- `api`: rota nova **`POST /api/automacoes/:id/disparar`** (chamada de fora pelo n8n, com a chave da API) — **escrita, NÃO publicada** (espera o OK).

## 3. Decisões tomadas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| D-99 · Só o super admin cria/liga automações; serve para tudo | Líder no próprio setor (Q-41 da demanda) | Resposta do dono: "só eu vou construir" |
| D-100/101 · Etiquetas e campos customizados em Configurações → Utilitários; campo vale em peças e/ou pedidos (no card do pedido grava NO pedido) | Etiqueta só em Configurações gerais | Pedido do dono |
| D-102 · Configurações + Painel super admin; engrenagem → tema | Manter o "Painel admin" | Pedido do dono |
| D-103 · Motor por gatilho ADIADO (na hora, sem fila nem relógio); a automação obedece às regras de uma pessoa | Fila com relógio de 1 min (padrão da S11) | Relógio à toa vetado (D-80); o adiado vê o estado final do gesto |
| D-105 · O editor é área de trabalho (menu recolhido, execuções numa aba, gaveta que fecha) | Editor dentro da página | "Está pequeno demais" |
| D-106 · "Se… senão" com os caminhos DENTRO do passo; nada depois dele | Caminhos que se reencontram (grafo com junção) | Sem pedido; complica a tela e o executor |

## 4. Bugs

### Resolvidos (no caminho)
- E-78 — o motor rodava antes da projeção em modo imediato forçado → gatilho "zzzz" (prova permanente no harness).
- E-80 — o "caber na tela" não rodava ao abrir (no celular abria cortado) → ajusta quando o quadro ganha tamanho.
- Botões de 36px no tablet, nome da automação espremido para uma letra no tablet → corrigidos.

### Descobertos
- Nenhum problema novo fora da sessão.

## 5. Arquivos alterados

```
supabase/migrations/20261002120000_plt_automacoes_canvas.sql   (nova)
supabase/migrations/20260930120000_plt_estoque_sincronizado_tiny.sql  (o validate do check virou comentário — E-19)
supabase/testes/testar-migrations.mjs                          (bloco 51 + ajustes do 50)
supabase/functions/api/index.ts                                (rota /automacoes/:id/disparar — não publicada)
src/App.tsx · src/componentes/Layout.tsx · src/autenticacao/{tipos.ts,guardas.tsx}
src/perfil/SeletorTemaRapido.tsx · src/auditoria/rotulos.ts · src/paginas/Auditoria.tsx
src/estilos/{tokens.css,global.css}
src/utilitarios/*  ·  src/paginas/Utilitarios.tsx
src/automacoes/{catalogo.ts,desenho.ts,resumo.ts,api.ts,icones.tsx} + componentes/{CanvasAutomacao,PainelBloco,Execucoes}.tsx
src/paginas/Automacoes.tsx (+ testes) · kanban (pílulas e campos no card) · src/paginas/PCP.tsx
```

## 6. Impacto nos números visíveis

Nenhum número de painel muda. O que aparece de novo: pílulas de etiqueta e linhas de campo nos cards (só onde houver), e "Automático" como autor na linha do tempo quando foi a automação.

## 7. Notas do cofre atualizadas

- [[PLT - Decisoes de Produto]] (D-99…D-106) · [[PLT - Requisitos]] (RF-118…126) · [[PLT - Modelo de Sistema]] (canvas, área de trabalho, "Se… senão", escolha por grupos, filtros "Mostrar") · [[SUPA - Esquema do Banco]] (+ o DDL: os 3 gatilhos da plataforma em `pedidos`) · [[PLT - API Aberta]] · [[PLT - Memoria de Aprendizado]] (E-77…E-80, A-47…A-50) · [[SESSAO-27]] (execução) · [[SESSAO-27 - Automacoes em Canvas]] (Resultado) · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]] · [[000 - PROXIMOS PASSOS]]

## 8. Ficou pendente

### Aguardando decisão do dono
1. **Subir para o site** (merge na `main` + publicação): leva junto a Auditoria da S29 (que ele já viu). O banco já está pronto para as telas novas.
2. **Publicar a Edge Function `api`** com a rota de disparo de fora — só necessária quando ele quiser chamar uma automação pelo n8n.
3. Os dados de teste no banco (combinados): etiqueta e campo "Teste automação", as 2 automações de teste (desligadas), o card de teste 589 com etiqueta/campo. Ficam até ele dizer.

### A conferir
- **A conferência diária com o Tiny das 3h (06:00 UTC) de 03/10** é a primeira com o gatilho novo em `pedidos` no ar: conferir que a rodada fechou sem falha e sem aviso das automações nos registros (o ensaio da S29 com o gatilho forçado deu 63 ms, sem erro).

### Próximo passo sugerido
- Com o "pode subir": merge na `main`, conferir a publicação no site e montar a 1ª automação real (o dono, no canvas). Depois, a [[SESSAO-28 - Rota Calculada no Mapa]] fecha o Bloco 5.

## 9. Como validar

**Na tela (logado como o dono, super admin):**
1. Menu: "Configurações" e "Super admin" (com Automações e Auditoria); o ícone de tema no rodapé troca o tema.
2. Configurações → Utilitários: criar uma etiqueta e um campo; "Mostrar: Com as arquivadas" lista as arquivadas.
3. Super admin → Automações → **Nova**: o menu recolhe; tocar no QUANDO e escolher "O card entrou numa etapa" (setor/etapa reais); "+" → **Se… senão** (grupo Lógica) → condição "o card tem a etiqueta"; "+" do **Sim** → Preencher campo; "+" do **Senão** → Pôr etiqueta; **Salvar** (nasce desligada) → **Publicar** (liga).
4. Mover um card de teste para a etapa escolhida → abrir **Execuções**: o disparo mostra "se … → caminho Sim/Senão" e o passo feito; o card mostra a pílula/linha do campo.
5. Desligar a automação (dois toques) e repetir o gesto → nenhuma execução nova.
6. No tablet: a lista, o liga/desliga e as execuções com botões grandes.

**No banco (leitura):**
```sql
-- automações e situação
select id, nome, ligada, plt_privado.fn_automacao_contar_passos(passos) as passos from public.plt_automacoes order by id;
-- últimas execuções
select id, automacao_nome, situacao, avaliacao, resultado from public.plt_automacao_execucoes order by id desc limit 10;
-- os gatilhos da plataforma em pedidos (devem ser 3)
select tgname, tgdeferrable from pg_trigger where tgrelid = 'public.pedidos'::regclass and not tgisinternal order by tgname;
```

**Checklist final:** `npm run test:banco` (2 rodadas, tudo verde) ✅ · `npx tsc -b` ✅ · `npm run lint` ✅ · `npm test` (117) ✅ · `npm run build` ✅ · tablet/celular ✅ · checkpoint da integração antes/depois (idêntica nas 3 aplicações) ✅ · `get_advisors` (sem novidade) ✅ · task list conferida ✅.
