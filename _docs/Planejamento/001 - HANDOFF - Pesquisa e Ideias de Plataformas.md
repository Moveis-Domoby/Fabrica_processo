---
titulo: HANDOFF — Pesquisa, Linha de Produção e Ideias de Plataformas
tipo: handoff
data: 2026-08-13
atualizado: 2026-08-13
tags: [handoff, visao, ideias, roadmap, fabrica, producao, logistica]
---

# 🚀 HANDOFF — A fábrica Domoby e o que construir em cima dela

> [!abstract] O que é este documento
> **(1)** O retrato da empresa (pesquisa externa + números reais da planilha), **(2)** a **linha de produção real**, mapeada dos quadros do Trello e dos vídeos da fábrica, e **(3)** o banco de ideias de plataformas com foco em **controle operacional e logístico**. As ideias são propostas — nada está construído além do que as notas `N8N -` documentam. O detalhe quadro a quadro vive em [[FAB - Estrutura de Producao (Trello e ClickUp)]].

---

## PARTE 1 · A empresa em resumo

- **Móveis Domoby Ltda** (CNPJ da filial `27.556.613/0002-47`, confere com o webhook do Tiny) — fábrica de **móveis em MDF** com **metalurgia própria** para linha industrial. Fábrica no bairro **Planalto, Natal-RN**; loja na Rua Mira Mangue 1405. [Site](https://www.domoby.com.br/) com posicionamento "qualidade a preços justos"; frete grátis (logística própria) em Natal e região.
- **Números da operação** (planilha COMPLETO, 469 pedidos, 29/06–11/08/2026): **~10,7 pedidos/dia** · ticket médio **R$ 913** (mediana R$ 649) · entrega concentrada: Natal 62% + Parnamirim 27% · best-sellers estáveis (armário multiuso c/ chave, mesas executivas/Boss, estantes Basic, sapateiras) · **93% dos itens com dimensões L×A×P parseáveis no nome**.
- **Aquisição** (resumo — detalhe não é escopo deste cofre): Instagram [@moveisdomoby](https://www.instagram.com/moveisdomoby/), 90,3 mil seguidores, ~2 mi views/mês; **92% dos pedidos** chegam marcados "Instagram" e **73% são primeira compra**; a venda fecha no DM/WhatsApp, não no site. Guardado aqui só o que importa para a fábrica: **a demanda é contínua, digital e concentrada geograficamente — e a produção precisa acompanhar picos de alcance.**
- 🔎 **Linha de receita descoberta nos quadros:** além dos móveis próprios, a fábrica **presta serviço de corte CNC, canaletado e fitamento para terceiros** (SF Madeiras, Acrivan, Italínea, Requinte, Ecorematte, pessoas físicas…) — 269 cards de terceiros finalizados no FITAMENTO e 84 no CNC. Também há um cliente/parceiro B2B recorrente ("Greenpallets").

---

## PARTE 2 · A linha de produção real

Mapeada dos quadros do Trello em 13/08/2026 (detalhe completo: [[FAB - Estrutura de Producao (Trello e ClickUp)]]):

```
1-PCP ─→ 3-SECC (corte reto) ─┐
     └─→ 2-CNC (CNC/canaletado)┴→ 5-FITAMENTO → 4-CENTRO FURAÇÃO
     → 7-MONTAGEM → 8-EMBALAGEM (limpeza→caixa) → 9-LOGISTICA (expedição)
     → ROTA (listas por caminhão/motorista/data: "3ª Rota - SHAOLIN (04/08)"…) → ENTREGUE

6-METALURGICA (bases metalon: produção→pintura) corre em paralelo e encontra na montagem.
Apoio: 0-ESTOQUE · CHAPAS MDF · DASHBOARD-MONTAGEM · ALINHAMENTO DE DEMANDA · OTIMIZAÇÃO
```

**O que já existe de instrumentação:** List Time Tracker + campos "Início/Fim montagem" na MONTAGEM · imagens 3D nos cards · tag `(CUTPLANNING)` (plano de corte parcial) · rotas organizadas por motorista e data · estoque vertical de acabados em porta-pallets (visível nos vídeos da fábrica).

**As dores que os próprios quadros denunciam:**

| Dor | Evidência nos quadros |
|---|---|
| Peça pronta perdida no galpão | lista **NÃO ENCONTRADO: 52 cards** na LOGISTICA |
| Card parado sem alerta | PEDIDO PARADO (3–5 dias), STAND BY (20) |
| Handoff manual entre 10 quadros | listas-espelho dos setores vizinhos em cada quadro |
| Serviço p/ terceiros sem fluxo próprio | 350+ cards `Terceirizado` misturados à produção |
| Dano sem tabulação | listas DANIFICADO em 5 quadros, motivo só no título |
| Sobras de chapa sem sistema | card "Organização de sobras" na SECC |
| Conhecimento preso em pessoa | "(CHAMAR GUILHERME PARA ORIENTAÇÃO)" no título |
| Histórico virando ruído | ROTA "A FAZER" com 660 cards antigos; CANCELADO 189 |

---

## PARTE 3 · Banco de ideias — controle operacional e logístico

> [!tip] Como ler
> Ordenadas por dependência. Cada uma: o que é / por que muda o jogo / com o que se constrói. ⭐ = pedido explícito do dono. As dores da Parte 2 são o critério de prioridade.

> [!important] Critério de projeto que rege todas as ideias abaixo
> A visão-alvo do dono está em [[FAB - Processo Alvo - Um Clique Um Evento]]: **um clique por acontecimento, e o clique dispara o resto** (timer do setor seguinte, roteiro por produto pulando etapas, cockpit único para a logística). As ideias C e D são na prática o mesmo sistema sob essa visão; os quadros do Trello são estrutura de referência, **não** fonte de dados (movimentação manual, números não confiáveis).

### A · Catálogo estruturado de produtos (a fundação)
Tabela (Supabase) por produto: dimensões parseadas (93% já vêm no nome), peso/volumes desmontado, roteiro de setores, tempo-padrão, e depois a BOM (chapas, fitas, ferragens, metalon). **Sem isso, carga, insumo e custo são impossíveis; com isso, viram consulta.** O n8n alimenta produto novo automaticamente.

### B · ⭐ Mapeamento formal dos setores
Uma nota `FAB -` por setor com entrada/saída/máquinas/gargalos/regras (SECC vs CNC, o que dispara STAND BY…). As **7 perguntas abertas** já estão listadas em [[FAB - Estrutura de Producao (Trello e ClickUp)]]. É conversa com a equipe, não código — e destrava todo o resto.

### C · ⭐ Rastreio físico por unidade (QR) — mata o "NÃO ENCONTRADO"
Etiqueta com QR impressa quando o card `(k/n)` nasce; bipe de entrada/saída em cada setor e **bipe de posição no estoque** (endereçamento simples do porta-pallet: rua/coluna/nível). O card do móvel responde "onde está?" sozinho. **52 móveis prontos estão perdidos hoje** — essa ideia se paga na primeira semana. Base: n8n gera QR, página mobile registra no Supabase.

### D · ⭐ Tempos por setor + alerta de parado
Cada movimento vira `{unidade, setor, entrou, saiu, quem}` no Supabase (via bipe da ideia C ou webhook do ClickUp). Painéis: fila por setor, tempo médio por produto, gargalo do dia, **alerta automático de card parado > X dias** (hoje o PEDIDO PARADO depende de alguém olhar). Aproveita o embrião que a MONTAGEM já tem (Time Tracker + Início/Fim montagem).

### E · ⭐ Estoque de acabados + insumos
**Acabados:** saldo por SKU com posição física (ideia C); reserva automática quando entra pedido; kanban de mínimo por best-seller (produção para estoque já acontece — listas ESTOQUE — mas sem sistema). **Insumos:** o quadro CHAPAS MDF vira tabela com baixa por BOM e ponto de reposição pelo consumo real; **sobras de chapa cadastradas** com dimensão (resolve a "Organização de sobras" e alimenta o plano de corte).

### F · ⭐ Logística: cargas, rotas e caminhão
1. **Calculadora de carga:** volumetria dos pedidos prontos (dimensões da ideia A) vs capacidade do caminhão; ordem de carregamento inversa à rota.
2. **Montador de rota:** hoje a rota é arrastar cards para a lista "{n}ª Rota - {MOTORISTA} ({data})". Automatizar: agrupar EXPEDIÇÃO por zona (89% em Natal+Parnamirim), sugerir a rota do dia por motorista, gerar a sequência com os links de Maps que já existem.
3. **App do motorista:** a rota no celular; entrega concluída com foto/observação → baixa automática no card + WhatsApp ao cliente; ocorrência padronizada para **NÃO ENCONTRADO / RETORNOU / CANCELADO** com motivo obrigatório.
4. **Painel do caminhão:** onde está cada veículo/rota agora (posição do celular do motorista em expediente).

### G · Fluxo próprio para o serviço de terceiros (corte/canaletado/fita)
Hoje 350+ cards `Terceirizado` se misturam à produção própria. Separar num fluxo de **ordem de serviço**: recebimento do material → serviço → SEPARADO/IDENTIFICADO → **aviso automático de "pronto para retirada"** ao cliente → registro de retirada. Ganhos: fila própria (não briga com pedido de cliente final), histórico por cliente B2B, e base para precificar o serviço direito. *(É também um funil de receita quase invisível hoje — quanto fatura o terceirizado por mês? Ninguém sabe sem isso.)*

### H · Qualidade: DANIFICADO com motivo tabulado
As listas DANIFICADO já existem em 5 quadros e o motivo já é escrito no título ("porta danificada em furos dobradiças"). Falta só estruturar: ao mover para DANIFICADO, formulário rápido (setor, peça, motivo de lista fechada, foto) → Supabase → **pareto mensal de defeito por setor**. Três meses disso apontam onde investir (treino, máquina, fornecedor).

### I · Custo real por móvel
Colheita de A+D+E: tempo por setor × custo-hora + insumos da BOM = margem real por produto (incluindo o serviço de terceiros da ideia G). Hoje o preço não enxerga o custo de produção.

### J · Faxina e higiene dos quadros (quick win, quase grátis)
660 cards mortos na ROTA "A FAZER", 189 CANCELADO, ~1.123 no ClickUp PCP. Workflow n8n de arquivamento automático (card entregue/cancelado há > N dias → arquivar) + o caça-duplicatas já existente. Quadro limpo é pré-requisito para qualquer métrica confiável.

### K · Manutenção preventiva como fluxo
O card "Engraxar caixas de cola" mostra que manutenção já vive no Trello, manualmente. Padronizar: agenda recorrente por máquina (seccionadora, CNC, coladeira, furadeira) criada automaticamente pelo n8n, com checklist e registro de execução. Barato e evita a parada não planejada — o pior gargalo possível.

### L · Plano de corte (nesting) integrado — horizonte longo
A tag `(CUTPLANNING)` mostra que já existe ferramenta parcial. Evoluir: lote do dia → plano de corte por chapa considerando **as sobras cadastradas** (ideia E) → aproveitamento medido. Depende de A, B e E maduros; decisão build vs buy fica para lá.

---

## PARTE 4 · Roadmap sugerido (foco operacional)

| Horizonte | O quê | Critério |
|---|---|---|
| **Agora (dias)** | P1 alerta de erro n8n · migração 5 · levantar automações 6 e 7 · **J (faxina dos quadros)** | fundação e ruído zero |
| **30 dias** | **B (mapeamento com a equipe)** · A (catálogo/parser) · decisão C-vs-webhook | conversa antes de código |
| **90 dias** | **C (QR + endereçamento — mata o NÃO ENCONTRADO)** · D (tempos + alerta de parado) · F1 (calculadora de carga) | ataca as 2 maiores dores |
| **6 meses** | E completo · F2/F3 (rotas + app do motorista) · G (terceirizados) · H (qualidade) · K (manutenção) | colheita |
| **Depois** | I (custo real) · F4 (painel do caminhão) · L (nesting) | precisa das anteriores |

> [!warning] Princípios (aprendidos nas migrações — valem para tudo acima)
> 1. **Copiar o real antes de construir** — mapear com a equipe antes de automatizar (foi o que deu 100% nas migrações).
> 2. **Medir depende do gesto humano** — bipe/QR vence "lembrar de arrastar card"; card movido em lote no fim do dia é dado-ficção.
> 3. **Evento > polling** — construir sobre o webhook do pedido, nunca sobre varredura de planilha.
> 4. **Um dono por dado** — duas fontes de verdade se derrubam.
> 5. **Alerta de erro antes de crescer** — cada sistema novo é um lugar novo para falhar em silêncio.
> 6. **Quadro limpo antes de métrica** — 660 cards mortos transformam qualquer dashboard em mentira.

---

## Fontes

- Quadros do Trello da produção (prints de 13/08/2026, todos os setores + ROTA)
- [Site oficial](https://www.domoby.com.br/) · [Instagram @moveisdomoby](https://www.instagram.com/moveisdomoby/) · [Registro empresarial](https://www.econodata.com.br/consulta-empresa/27556613000247-MOVEIS-DOMOBY-LTDA)
- Números internos: aba COMPLETO (469 pedidos, 29/06–11/08/2026), calculados em 13/08/2026
- Vídeos públicos da fábrica no Instagram (galpão, porta-pallets, montagem)

## Ver também

[[000 - MAPA DO PROJETO]] · [[FAB - Estrutura de Producao (Trello e ClickUp)]] · [[N8N - Visao Geral da Migracao]] · [[N8N - Pendencias e Riscos]]
