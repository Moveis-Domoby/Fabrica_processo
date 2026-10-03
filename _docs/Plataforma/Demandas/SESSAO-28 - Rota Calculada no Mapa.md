---
titulo: "SESSAO-28 — Rota calculada no mapa"
tipo: demanda
status: entregue
data: 2026-09-18
atualizado: 2026-10-03
tags: [plataforma, demanda, bloco-5, rotas, mapa]
---

# 🎯 SESSAO-28 — Rota calculada no mapa

> Sétima e última sessão do **Bloco 5**. A linha da rota na Programação deixa de ser reta ponto-a-ponto e vira **rota calculada nas ruas de verdade**, partindo da fábrica da Móveis Domoby — continuando **sugestão inicial** para noção de distância, nunca decisão automática.

## O que é

No mapa da Programação (`/fabrica/rotas/programacao`), a linha entre as paradas passa a ser a **rota real pelas ruas** (respeitando contramão e viário), calculada com **ponto de partida fixo na fábrica da Móveis Domoby**, com distância e tempo estimados por trecho e totais.

## Requisitos cobertos

Evolução do escopo da S15 (a nota do Modelo de Sistema que proíbe chamar a linha de "rota calculada" cai — agora ela É calculada). Registrar em [[PLT - Requisitos]].

## Decisões que regem esta demanda

**D-39 (mantida na essência: grátis e sem chave)** — decisão do dono em 18/09: **OSRM** (motor de rotas aberto sobre dados OSM) agora; trânsito ao vivo e **trecho interditado no dia programado** ficam como evolução futura registrada (exigem API paga — Google Routes) · princípio de sempre: **é só sugestão — a decisão é humana** · D-27 (sem códigos internos na UI).

## Comportamento esperado

1. **Ponto de partida principal: a fábrica da Móveis Domoby** (endereço/coordenada cadastrados uma vez — confirmar na pergunta 1). A rota do dia parte da fábrica → paradas na ordem atual → (pergunta 2: volta à fábrica?).
2. **Linha calculada nas ruas** substituindo a polyline reta: geometria devolvida pelo OSRM (perfil de carro), que já **prevê contramão e sentido do viário**. A ordem das paradas continua a atual (vizinho mais perto + ajuste humano); o cálculo só desenha e mede o caminho real.
3. **Distância e tempo por trecho e totais** visíveis (a distância haversine atual vira distância de rota); as sugestões de proximidade (raio 5 km) continuam como estão.
4. **Honestidade da sugestão:** um aviso curto na tela diz que a rota é sugestão inicial (sem trânsito ao vivo nem interdições do dia). "Interdição no dia programado" fica registrada nesta demanda como **evolução futura** — depende de API paga; se um dia o dono quiser, é decisão nova.
5. **Sem chave e com respeito ao serviço:** servidor público do OSRM com User-Agent identificado e **cache no banco** (mesma filosofia do `plt_geocache`): rota calculada para o mesmo conjunto/ordem de paradas não recalcula à toa; recalcula quando a programação muda. Pedido sem endereço geocodificável segue o comportamento atual (entra na programação, não plota — Q-65).
6. Falha do serviço de rota **não quebra a tela**: sem rota calculada, o mapa mostra a linha reta antiga com aviso — nunca tela morta.

## Perguntar ao dono no início da sessão (ritual de sempre; só codar com o OK)

1. Endereço exato (ou coordenada) da fábrica para o ponto de partida — e ele fica fixo em configuração?
2. A rota termina na última entrega ou **volta para a fábrica** (ida e volta)?
3. O tempo estimado do OSRM (sem trânsito) pode aparecer na tela, ou prefere só distância para não criar expectativa de horário?
4. Servidor público do OSRM basta agora (grátis, sem garantia de SLA), ou já quer avaliar hospedar o motor no VPS da casa (o mesmo do n8n) para independência?

## Fora do escopo

Trânsito ao vivo, interdições do dia e horários de chegada garantidos (API paga — evolução futura registrada) · reordenação automática ("otimização de rota" de verdade continua fora — a ordem é humana) · app do motorista · mudanças na geocodificação (Nominatim/`plt_geocache` ficam como estão).

## Critérios de aceite

- [x] Rota do dia desenhada pelas ruas partindo da fábrica, na ordem das paradas; nada de linha reta cruzando quarteirão (verificado com uma programação real e screenshot no handoff).
- [x] Distância e tempo por trecho e totais exibidos; distância bate com a realidade (conferência manual de uma rota conhecida).
- [x] Reprogramar (incluir/remover/reordenar parada) recalcula; reabrir a mesma programação usa o cache (conferir na aba Network — regra "cada tela requisita só o que mostra").
- [x] Serviço de rota fora do ar → linha reta antiga + aviso; a tela continua funcionando.
- [x] Aviso de "sugestão inicial" visível; nota do [[PLT - Modelo de Sistema]] sobre a linha atualizada.
- [x] Decisão OSRM + partida na fábrica registrada em [[PLT - Decisoes de Produto]] (revisão consciente da D-39, com a evolução paga anotada).

## Notas para o Claude Code

Ritual completo do [[CLAUDE - Regras do Claude Code (repo)]]: leituras na ordem (+ [[SESSAO-15 - Logistica e ROTAS com Caminhoes]] e a memória `Execucao/SESSAO-15.md` — o terreno do mapa está lá), demanda 2×, (a)(b)(c) antes de codar com OK do dono, task list espelho, memória em `Execucao/SESSAO-28.md` na hora, E-NN/A-NN na hora.
Terreno: Leaflet 1.9.4 + react-leaflet 5.0.0 já no projeto; `MapaProgramacao.tsx` e `proximidade.ts` são o ponto de partida · a chamada ao OSRM sai por Edge Function (padrão `geocodificar`: serializada, identificada, cache em tabela `plt_` — o navegador não chama serviço de terceiro direto) · cache com chave determinística do conjunto ordenado de paradas · Leaflet já pesa ~150 kB no bundle: é a deixa para o `React.lazy` na tela de Programação (pendência antiga registrada) · lógica pura testável em módulo próprio, como `proximidade.ts` (Vitest).
**Checklist de validação final obrigatório e marcado item a item:** `npm run test:banco` (2 rodadas) · `npx tsc -b` · `npm run lint` · `npm test` · `npm run build` · F-07 (mapa expandido no celular; ESC recolhe) · ⏸️ checkpoint antes de aplicar migration/deploy de function (F-08) · `get_advisors` · task list conferida · handoff + notas do cofre atualizadas.

## Resultado (preencher ao entregar)

✅ **Entregue em 02/10/2026** — [[handoff_2026_10_02_sessao28_rota_calculada]] · execução em `Execucao/SESSAO-28.md`.

- **Respostas do dono:** partida na **Rua Tancredo Neves, Planalto** (−5,84800 · −35,25428); **volta para a fábrica**; **tempo à vista** ("só dirigindo"); servidor = o **site gratuito** (a pergunta 4 foi reexplicada em uma frase — E-82). E duas novidades pedidas por ele: **ordem à mão com "Salvar ordem"** (D-109) e **a rota de cada caminhão do dia no mapa** (D-110). Tudo em D-108…D-110.
- **Banco:** migration 54 (a rota guardada no cache do mapa — sem tabela nova; a ordem das paradas; o gesto "Salvar ordem" com uma linha na Auditoria). **Função:** `calcular-rota` (serviço público da FOSSGIS, identificado, trocável por configuração).
- **Aceite:** programação real de 22/09 (31,9 km, 42 min, pelas pontes da Zona Norte); fábrica → Midway Mall 9,5 km × 9,7/10,2 km no Google; reabrir = 1 leitura, 0 chamada; serviço fora → linha reta tracejada + aviso (provado antes de publicar a função).

## Ver também

[[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[SESSAO-15 - Logistica e ROTAS com Caminhoes]] · [[PLT - Decisoes de Produto]]
