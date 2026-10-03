---
titulo: Execução — SESSAO-28 · Rota calculada no mapa
tipo: execucao
data: 2026-10-02
atualizado: 2026-10-02
tags: [execucao, sessao-28, rotas, mapa, osrm, bloco-5]
---

# 🔧 Execução — SESSAO-28 · Rota calculada no mapa

**Pasta:** a principal (`Domoby - fabrica`), sem worktree (pedido do dono). **Branch:** `sessao-28-rota-calculada`, criada em 02/10 da `main` = `origin/main` (**c38355e**). A sessão vizinha "Automações em Canvas" (a frente do autor do campo limpo) confirmou por mensagem que **terminou** e liberou a pasta; a branch dela já tinha sido apagada (incluída na main).
**Demanda:** [[SESSAO-28 - Rota Calculada no Mapa]] (lida 2×) · terreno: [[SESSAO-15 - Logistica e ROTAS com Caminhoes]] + `Execucao/SESSAO-15.md` · handoff lido: [[handoff_2026_10_02_sessao27_automacoes_canvas]].
**Numeração (conferida com a sessão vizinha):** migration **54** (`20261004120000`), **D-108** em diante, **E-82** em diante, **A-54** em diante.

## Leituras (02/10)

CLAUDE (repo + cofre), Memória de Aprendizado (inteira), Decisões (índice + D-01…D-18, D-27, D-33, D-36, D-38/39, D-45, D-47, D-92/93), Visão Geral, Requisitos (rotas), Ordem das Sessões, Perguntas em Aberto (Q-65), Modelo de Sistema (mapa/ROTAS), Esquema do Banco (logística/ROTAS), handoff da S27, código: `MapaProgramacao.tsx`, `proximidade.ts`, `Programacao.tsx`, `rotas/api.ts`, Edge `geocodificar`, migrations 25 e 39 (programação, geocache, log), harness (bloco da S15).

## Achados do terreno (só leitura)

1. **O mapa só mostra a seleção que se está montando** (os pedidos "sem programação" marcados). Depois de "Programar", os pedidos saem do mapa e vão para a lista "Programados para o dia", sem mapa.
2. **A ordem é sempre automática** (vizinho mais perto a partir do 1º da lista); a tela não tem como reordenar.
3. **A porta `plt_fn_programacao`** devolve sem programação + programados do dia escolhido, com lat/long do `plt_geocache` — o caminhão de cada programado já vem (dá para desenhar a rota de cada caminhão sem consulta nova).
4. **`fn_logar_programacao`** loga TODO update de `plt_programacoes` como `entrega_reprogramada` — uma mudança só de ordem viraria N linhas "Reprogramou a entrega".
5. **`plt_fn_programacao` muda de forma (ganha `ordem`)** → drop + create, e as migrations 25 e 39 (que a criam com `create or replace`) precisam do drop antes (E-17), senão a 2ª rodada do harness quebra.
6. **Endereço da fábrica:** não existia no cofre. O dono mandou (02/10): *Rua Tancredo Neves - Planalto, Natal - RN, 59073-351* + print do Google Maps. No OSM a rua está grafada **"Rua Trancredo Neves"** (way 94390715) — por isso o Nominatim não acha (devolveu "Rua Tiago Queiroz"). Ponto fixado pela geometria do OSM cruzada com o print: **−5.84800, −35.25428** (sobre a Rua Tancredo Neves, ~50 m da Rua Abreulândia, entre ela e a Travessa Abreulândia — onde o pino do print está). O motor de rotas encaixa o ponto na própria Rua Tancredo Neves (0,2 m).
7. **Servidores públicos de rota** (conferido em 02/10): `router.project-osrm.org` e `routing.openstreetmap.de/routed-car` (os dois da FOSSGIS) responderam 200 em < 1 s para fábrica → centro de Natal → fábrica: 9,7 km ida / 9,2 km volta (a diferença é a contramão), 18,97 km e 23 min no total. Regras: 1 pedido/s, User-Agent identificado, uso leve; o servidor de demonstração diz "não comercial"; sem garantia de ficar no ar.

## Respostas do dono (02/10) — o OK da sessão

1. **Partida:** *"Rua Tancredo Neves - Planalto, Natal - RN, 59073-351"* (com o print do mapa).
2. **Volta:** *"Volta para a fábrica"*.
3. **Tempo:** *"Pode mostrar, já dá para ter alguma ideia"*.
4. **Servidor:** *"Que miséria é isso? Não entendi nada"* → reexplicado em uma frase, com a escolha feita: **site gratuito da internet** (o OSRM público), sem decisão dele (E-82).
5. **Mapa da rota programada:** *"Sim, faça mostrar"* — a rota de cada caminhão do dia também aparece no mapa.
6. **Ordem à mão:** *"Faça a possibilidade de poder reordenar à mão também, a sugestão de rota é a mais próxima, porém deve sim ser possível alguém alterar as ordens e ver em tempo real clicando em um botão de salvar"*.

## Task list (espelho da demanda + respostas)

- [ ] T1 · Decisões no cofre (revisão consciente da D-39: rota pelas ruas no serviço gratuito, partida e volta na fábrica, tempo visível; ordem à mão com salvar; mapa com a rota de cada caminhão) + evolução paga anotada
- [ ] T2 · Migration 54: `plt_geocache.rota` (o cache da rota — sem tabela nova, D-47) · `plt_programacoes.ordem` · `fn_logar_programacao` (só ordem não loga por linha) · `plt_fn_programar_entrega` (trocar dia/caminhão zera a ordem) · `plt_fn_ordenar_rota` (nova, com 1 linha na trilha) · `plt_fn_programacao` (+ `ordem`; drop nas 25 e 39 — E-17)
- [ ] T3 · Harness: bloco da 54 (escopo próprio — E-70)
- [ ] T4 · Edge Function `calcular-rota` (serviço público, User-Agent, só pessoa ativa, cache no banco, falha não grava)
- [ ] T5 · Lógica pura testável (`src/rotas/rotaRuas.ts` + Vitest): chave da rota, decodificar a linha, ordem a partir da fábrica, ordem manual, formatar tempo
- [ ] T6 · Mapa: linha pelas ruas, a fábrica marcada, ida e volta, distância/tempo totais, aviso de "sugestão inicial", serviço fora → linha reta + aviso
- [ ] T7 · Trechos com distância/tempo + reordenar à mão (subir/descer) + "Salvar ordem" / "Voltar à sugestão"
- [ ] T8 · O mapa mostra "montando agora" ou a rota de cada caminhão do dia
- [ ] T9 · `React.lazy` na tela de Programação (Leaflet fora do pacote principal)
- [ ] T10 · Auditoria: rótulo do gesto novo
- [ ] T11 · Validação: `test:banco` 2 rodadas · `tsc -b` · lint · `npm test` · build · F-07 (mapa expandido no celular; ESC recolhe) · Network (cache) · serviço fora · ⏸️ checkpoint antes de aplicar/publicar · `get_advisors` · programação real + screenshot
- [ ] T12 · Cofre: Requisitos, Modelo de Sistema (nota da linha), Esquema do Banco, Ordem, Mapa, demanda (Resultado), handoff, memória

## Decisões técnicas (02/10)

- **Cache da rota em `plt_geocache`** (D-47 — sem tabela nova): coluna `rota jsonb`; chave `rota:carro:` + "lon,lat" (5 casas) separados por `;` — legível, sem hash, nunca colide com o md5 dos endereços (a porta do mapa só junta por md5). `endereco` guarda a descrição ("rota de N paradas (fábrica → … → fábrica)"); `fonte = 'osrm'`; `resolvido=false` = "não existe caminho" (não insiste por 7 dias); serviço fora = **nada gravado** (503 → a tela cai na linha reta e tenta de novo depois).
- **A tela lê o cache direto** (`plt_geocache` por `chave`, a policy de leitura de sempre) e só chama a Edge Function quando não acha — reabrir a mesma programação = 1 leitura barata, 0 chamada ao serviço. A Edge recalcula a chave pelos pontos (nunca confia na de fora) e devolve a dela; se divergir da tela, `console.warn` (formato mudou num lado só).
- **Edge Function `calcular-rota`**: molde da `geocodificar` (JWT de pessoa ativa, User-Agent `PlataformaProducaoDomoby/1.0` + contato opcional do segredo `PLT_GEOCODIFICACAO_CONTATO`), servidor padrão `https://routing.openstreetmap.de/routed-car` (FOSSGIS, perfil carro) trocável pelo segredo `PLT_ROTAS_SERVIDOR`; 2 a 42 pontos; tempo limite 12 s; `overview=full&geometries=polyline`.
- **A ordem (D-109):** `plt_programacoes.ordem` (nula = sugestão); `plt_fn_ordenar_rota(dia, caminhão, ids[])` grava e deixa UMA linha `rota_ordem_salva` na trilha; lista vazia = volta ao automático; `fn_logar_programacao` não loga mudança SÓ de ordem (senão N "Reprogramou"); `plt_fn_programar_entrega` zera a ordem ao trocar dia/caminhão; `plt_fn_programacao` devolve `ordem` (drop+create — e as migrations 25 e 39 ganharam o `drop function if exists` antes do create, E-17).
- **Front:** lógica pura em `src/rotas/rotaRuas.ts` (fábrica fixa, chave, decodificar a linha, sugestão a partir da fábrica, ordem efetiva rascunho → salva → sugestão, subir/descer, pontos fábrica→…→fábrica, linha reta, tempo legível) + 13 testes; `useRotaPelasRuas` (espera 600 ms a pessoa parar de mexer; uma consulta por sequência, guardada na visita); `PainelRota` (paradas, trechos, totais, aviso de sugestão inicial, subir/descer 44 px, Voltar à sugestão / Salvar ordem); `MapaProgramacao` (fábrica "F" grafite, linha pelas ruas ou reta tracejada, enquadra só quando o CONJUNTO de pontos muda); `Programacao` (escolha "Montando agora" × caminhões do dia; ao Programar, a ordem vai junto se o caminhão já tinha ordem salva ou a montagem foi ajustada — novos no fim; programar no dia da tela passa o mapa para o caminhão); `React.lazy` na Programação (pacote próprio de 179,6 kB — o Leaflet saiu do principal); Auditoria: "Salvou a ordem das paradas", `card_ids` fora da tela, rótulos "Paradas na rota"/"Voltou à ordem sugerida".
- **Ponto da fábrica: −5.84800, −35.25428** (ver achado 6).

## Arquivos

- **Novos:** `supabase/migrations/20261004120000_plt_rota_calculada.sql` · `supabase/functions/calcular-rota/index.ts` · `src/rotas/rotaRuas.ts` + `rotaRuas.test.ts` · `src/rotas/useRotaPelasRuas.ts` · `src/rotas/PainelRota.tsx`
- **Alterados:** `src/rotas/MapaProgramacao.tsx` (reescrito) · `src/rotas/api.ts` (`ordem`, `ordenarRota`, `buscarRotaPelasRuas`) · `src/paginas/Programacao.tsx` · `src/App.tsx` (lazy) · `src/auditoria/rotulos.ts` · `src/estilos/global.css` (`.plt-fabrica`) · migrations 25 e 39 (só o `drop function if exists` da porta do mapa) · `supabase/testes/testar-migrations.mjs` (bloco 54)

## Diário

- [02/10] Leituras + perguntas ao dono; respostas recebidas. Branch criada. E-82 registrado (pergunta em jargão).
- [02/10] D-108/D-109/D-110 no cofre (+ ↩️ na D-39). Migration 54 escrita; **`test:banco` 2 rodadas TUDO VERDE de primeira** (14 verificações novas no bloco 54). Edge Function escrita. Lógica pura + 13 testes (1ª versão do teste tinha Petrópolis × Centro empatados a 10,38/10,39 km de Ponta Negra — trocado por Zona Norte; o teste pegou o empate antes de virar ordem instável).
- [02/10] `tsc -b` limpo · `lint` limpo · `npm test` **134/134** · `build` ok (Programação em pacote próprio 179,6 kB; o aviso de pacote > 500 kB do principal já existia).
- [02/10] Servidor de preview: o da sessão vizinha (5173, mesma pasta) foi parado com a permissão dela e subido o desta sessão; login do dono ainda ativo. Produção (só leitura, 03/10 01:33 UTC): 4 pedidos lançados não entregues, 4 programações — **22/09, "Baú cinza (teste da sessão)", 3 pedidos reais** (2 com ponto, 1 sem: Parnamirim) — a programação real do aceite.
- [02/10] **Na tela, ANTES de publicar a função:** dia 22/09 → caminhão → rota F→13114→13156→F + 13146 "sem ponto no mapa — fora da conta"; o serviço "não respondeu" (a função ainda não existe) → **linha reta tracejada + aviso, 22,0 km em linha reta, tela viva** (o critério "serviço fora do ar" provado de verdade). Descer o 13114 → ordem trocada na hora, "Salvar ordem" + "Voltar à sugestão" aparecem; voltar → ordem sugerida, botões somem (nada salvo).
- [02/10] Achado na tela: o nome comprido do caminhão estourava o botão (texto 48 px num botão de 44). `h-auto` não venceu: o juntador de classes não reconhece `h-toque-md` como altura → `style={{ height: 'auto' }}` + `min-h-toque-md`; medido 66 px, texto dentro. F-07 a 375: sem rolagem lateral, nada fora da borda; Expandir/Reprogramar/Tirar eram 36 px (herança da S15) → 44 px; mapa expandido = 375×812 `fixed`, ESC recolhe (343×384 `relative`).
