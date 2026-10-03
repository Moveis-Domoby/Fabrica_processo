---
titulo: Handoff — 2026-10-02 · SESSAO-28 · Rota calculada no mapa
tipo: handoff
data: 2026-10-02
atualizado: 2026-10-03
tags: [handoff, sessao, sessao-28, rotas, mapa, osrm, bloco-5]
---

# 📋 Handoff — 02/10/2026 · SESSAO-28 · Rota calculada no mapa (fecha o Bloco 5)

**Branch:** `sessao-28-rota-calculada` (nasceu da `main` = `origin/main`, c38355e). **Banco:** migration 54 **aplicada** em 03/10 ~01:40 UTC (22:40 de 02/10 em Natal), sozinha via `--so`, integração idêntica (`e2109f3a…`, 65 colunas, linhas idênticas), com o OK do dono (*"Pode fazer tudo"*). **Edge Function `calcular-rota`:** **publicada** (v1, `verify_jwt` ligado; conteúdo conferido igual ao do repositório; sem login → 401). **Site:** ver §8. Memória técnica: [[SESSAO-28]] (`Plataforma/Execucao/SESSAO-28.md`).

## 1. Objetivo da sessão

A demanda: [[SESSAO-28 - Rota Calculada no Mapa]] — a linha da Programação deixa de ser reta e vira **rota pelas ruas**, partindo da fábrica, com distância e tempo; continua **sugestão**, nunca decisão. Respostas do dono no início (02/10):

1. Partida: *"Rua Tancredo Neves - Planalto, Natal - RN, 59073-351"* (+ print do Google Maps).
2. *"Volta para a fábrica"*.
3. Tempo: *"Pode mostrar, já dá para ter alguma ideia"*.
4. Servidor: *"Que miséria é isso? Não entendi nada"* → reexplicado em uma frase com a escolha feita (o site gratuito; se cair, a tela volta à linha reta) — E-82.
5. Mostrar a rota já programada de cada caminhão: *"Sim, faça mostrar"*.
6. *"Faça a possibilidade de poder reordenar à mão também … ver em tempo real clicando em um botão de salvar"*.

## 2. O que foi feito

### Na tela (ROTAS → Programação)
- **Rota pelas ruas, da fábrica à fábrica:** marcador grafite **"F"** na Rua Tancredo Neves (−5,84800 · −35,25428); linha contínua seguindo as ruas (contramão e sentido das vias respeitados — ida e volta saem por caminhos diferentes quando a rua obriga).
- **Trechos e totais:** cada parada mostra o trecho que chega nela ("da fábrica: 12,9 km · 16 min"), a **volta à fábrica** é o último trecho; no topo, "31,9 km · 42 min dirigindo · ida e volta da fábrica"; o mesmo resumo no canto do mapa.
- **Aviso fixo:** *"Sugestão inicial: sem trânsito ao vivo nem interdições do dia. O tempo é só dirigindo, sem as paradas das entregas."*
- **Serviço fora do ar:** linha reta **tracejada** + distâncias em linha reta + aviso; a tela segue funcionando.
- **Ordem à mão (D-109):** botões subir/descer (44 px) em cada parada → o mapa redesenha na hora; **"Salvar ordem"** grava para todos; **"Voltar à sugestão"** desfaz. A sugestão é "o mais perto primeiro" **a partir da fábrica**.
- **Rota de cada caminhão do dia (D-110):** botões "Montando agora (N)" e um por caminhão programado ("Baú … · 3 parada(s)"). Programar no dia da tela passa o mapa para a rota daquele caminhão; o pedido novo entra **no fim** da rota salva.
- **Parada sem ponto no mapa:** fica na lista ("sem ponto no mapa — fora da conta da rota"), pode ser movida, não entra no cálculo.
- **Mais leve:** a tela de Programação (com o mapa) carrega só quando é aberta — pacote próprio de ~180 kB, fora do principal.
- **Auditoria:** "Salvou a ordem das paradas" (com quem, quando, paradas e se voltou à sugestão).

### Banco (migration 54 — `20261004120000_plt_rota_calculada.sql`)
- `plt_geocache.rota` — o cache da rota (sem tabela nova, D-47); `plt_programacoes.ordem`; `plt_fn_ordenar_rota` (nova); `fn_logar_programacao` e `plt_fn_programar_entrega` recriadas; `plt_fn_programacao` drop+create com `ordem` (e o drop nas migrations 25 e 39 — E-17). Detalhe em [[SUPA - Esquema do Banco]].

### Edge Function `calcular-rota`
- Molde da `geocodificar`: só pessoa ativa, User-Agent identificado, servidor público da FOSSGIS (`routing.openstreetmap.de/routed-car`) trocável pelo segredo `PLT_ROTAS_SERVIDOR`; chave recalculada pelos pontos; falha não grava; "sem caminho" grava por 7 dias.

## 3. Decisões tomadas

- **D-108** — rota pelas ruas, partida e volta na fábrica, distância e tempo à vista, serviço gratuito; evolução paga (trânsito, interdição do dia, horário garantido) registrada. ↩️ revisa a linha reta da D-39.
- **D-109** — ordem à mão com "Salvar ordem"; trocar dia/caminhão zera.
- **D-110** — o mapa mostra a rota de cada caminhão do dia.

## 4. Bugs

### Resolvidos (no caminho)
- **E-83** — a rota pelas ruas aparecia **tracejada** (herdava o estilo da linha reta) e o mapa expandido **não reenquadrava** — só a foto mostrou; corrigidos e conferidos na foto e no DOM.
- Nome comprido do caminhão estourava o botão → o botão cresce (A-54).
- Resumo do mapa cobria o + / − do zoom em mapa estreito → não cobre mais.
- Expandir / Reprogramar / Tirar tinham 36 px (herança da SESSAO-15) → 44 px.

### Descobertos
- Nenhum problema novo fora da sessão.

## 5. Arquivos alterados

- **Novos:** `supabase/migrations/20261004120000_plt_rota_calculada.sql` · `supabase/functions/calcular-rota/index.ts` · `src/rotas/rotaRuas.ts` + `rotaRuas.test.ts` · `src/rotas/useRotaPelasRuas.ts` · `src/rotas/PainelRota.tsx` · `_docs/Handoffs/imagens/sessao28_rota_pelas_ruas.jpg`
- **Alterados:** `src/rotas/MapaProgramacao.tsx` · `src/rotas/api.ts` · `src/paginas/Programacao.tsx` · `src/App.tsx` · `src/auditoria/rotulos.ts` · `src/estilos/global.css` · migrations 25 e 39 (só o drop da porta do mapa) · `supabase/testes/testar-migrations.mjs` (bloco 54)

## 6. Critérios de aceite (a demanda)

| Critério | Resultado |
|---|---|
| Rota do dia pelas ruas partindo da fábrica, na ordem das paradas; nada de linha reta cruzando quarteirão (programação real + foto) | ✅ programação real de 22/09 (caminhão de teste, pedidos reais 13114 · 13156 · 13146): F → Igapó → Potengi → F pelas pontes, 31,9 km, linha contínua — foto abaixo |
| Distância e tempo por trecho e totais; distância bate com a realidade | ✅ trechos 12,9 / 3,9 / 15,1 km com tempo; rota conhecida fábrica → Midway Mall: **9,5 km aqui × 9,7 e 10,2 km no Google Maps** (o Google reconheceu o ponto de partida como "Fábrica Domoby, Rua Tancredo Neves") |
| Reprogramar (incluir/remover/reordenar) recalcula; reabrir usa o cache (aba Network) | ✅ reordenar → nova rota (31,8 km, trechos com o sentido das ruas); tirar o 13146 e programar de volta → entrou no fim; **reabrir a mesma programação = 1 leitura do cache e nenhuma chamada ao serviço** (contado com o observador de requisições) |
| Serviço fora do ar → linha reta + aviso; tela funcionando | ✅ provado de verdade antes de publicar a função: linha tracejada, 22,0 km em linha reta, aviso, tela viva |
| Aviso de "sugestão inicial" visível; nota do Modelo de Sistema atualizada | ✅ |
| Decisão registrada (revisão consciente da D-39, evolução paga anotada) | ✅ D-108…D-110 |

![[sessao28_rota_pelas_ruas.jpg]]
*A rota do caminhão de teste em 22/09 com o mapa expandido: F (fábrica, Planalto) → 1 → 2 (Zona Norte) → F; a volta sai por outro caminho por causa do sentido das ruas.*

## 7. Notas do cofre atualizadas

[[PLT - Decisoes de Produto]] (D-108…D-110 + ↩️ na D-39) · [[PLT - Memoria de Aprendizado]] (E-82, E-83, A-54) · [[PLT - Requisitos]] (RF-127…RF-130) · [[PLT - Modelo de Sistema]] (a linha agora é calculada; painel da rota; escolha do mapa) · [[SUPA - Esquema do Banco]] (migration 54) · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]] · [[000 - PROXIMOS PASSOS]] · a demanda (Resultado) · [[SESSAO-28]] (execução).

## 8. Ficou pendente

- **Site:** a publicar com o OK que o dono já deu (*"Pode fazer tudo"*) — o resultado da publicação fica registrado abaixo.
- **Teste deixou rastro (combinado):** no caminhão de teste de 22/09, 5 linhas na Auditoria (salvou a ordem, tirou o 13146, programou de novo, salvou com ele no fim, voltou à sugestão) e 2 rotas guardadas no cache (as duas ordens das 2 paradas com ponto: 31,9 e 31,8 km). O caminhão voltou ao estado de antes (os 3 pedidos no mesmo dia/caminhão, sem ordem salva).
- **Evolução futura (decisão nova, se o dono quiser):** trânsito ao vivo, interdição do dia, horário garantido — serviço pago.
- **Servidor próprio de rotas:** só se o gratuito falhar com frequência — é trocar a configuração da função.

### Próximo passo sugerido
- **O Bloco 5 está fechado.** O dono decide o próximo pacote (ver [[000 - PROXIMOS PASSOS]] — horizonte depois do Bloco 5).

## 9. Como validar

**Na tela (logado):**
1. Fábrica → ROTAS → **Programação**; dia **22/09/2026** → botão **"Baú cinza (teste da sessão) · 3 parada(s)"**.
2. O mapa mostra o **F** e a linha contínua pelas ruas; o painel abaixo mostra "F · Saída da fábrica", as paradas com "da fábrica…/da parada anterior…", "Volta à fábrica" e o total com o tempo "dirigindo".
3. **Descer** a 1ª parada → o mapa redesenha (depois de ~1 s) e aparecem **Salvar ordem** / **Voltar à sugestão**. Salvar → aviso "Ordem das paradas salva"; recarregar a página → a ordem continua. **Voltar à sugestão** + **Salvar ordem** → "A rota voltou à ordem sugerida".
4. **Expandir** o mapa (tela cheia, enquadrado) → **ESC** recolhe. No celular: tudo cabe, botões grandes.
5. Super admin → Auditoria → "Salvou a ordem das paradas".

**No banco (leitura):**
```sql
-- ordem salva por caminhão/dia
select data_entrega, caminhao_id, card_id, ordem from public.plt_programacoes order by data_entrega, caminhao_id, ordem nulls last;
-- rotas guardadas
select chave, (rota->>'distancia_m')::int as metros, consultado_em from public.plt_geocache where fonte = 'osrm' order by consultado_em desc;
-- a trilha do gesto novo
select id, usuario_id, contexto from public.plt_logs_atividade where acao = 'rota_ordem_salva' order by id desc limit 5;
```

**Checklist final:** `npm run test:banco` (2 rodadas, tudo verde, +14 verificações) ✅ · `npx tsc -b` ✅ · `npm run lint` ✅ · `npm test` (134) ✅ · `npm run build` ✅ · F-07 (mapa expandido no celular 375×812; ESC recolhe; nada fora da borda; botões 44 px) ✅ · checkpoint antes de aplicar/publicar ✅ (OK do dono) · integração idêntica antes/depois ✅ · `get_advisors` (só o +1 aviso esperado da porta nova; desempenho sem novidade) ✅ · task list conferida ✅.
