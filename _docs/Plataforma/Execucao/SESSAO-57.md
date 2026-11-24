---
titulo: Diário de execução — SESSAO-57 · o pino certo
tipo: execucao
data: 2026-11-24
tags: [execucao, sessao-57, rotas, mapa, geocodificacao]
---

# Diário — SESSAO-57 · O pino certo (24/11/2026, madrugada — fila do Escritório)

Demanda: [[SESSAO-57 - O Pino Certo]] · Handoff: [[handoff_2026_11_24_sessao57_pino_certo]]

Mesa: worktree `sessao-57-pino-certo`, nascida do ramo da 56 (`1e338a2`). Número 57 conferido livre em todas as worktrees e ramos.

## Task list (espelho da demanda)

1. ✅ Frente 1 — `candidatosGeoapify` (modo livre) marca o lugar (bairro/cidade) e o separa da rua/casa.
2. ✅ Frente 1 — rua reconhecível no texto digitado exige nome parecido (≥ 0,75).
3. ✅ Frente 1 — `geocodificar` responde `resolvido: false` + `aproximado` + `lugar`; não grava como rua.
4. ✅ Frente 1 — decisão do cache (abaixo).
5. ✅ Frente 1 — as três janelas: aviso âmbar, Salvar travado até arrastar ou "Salvar assim mesmo".
6. ✅ Frente 1 — o 13961 como teste.
7. ✅ Frente 2 — pino não arrastado pede confirmação.
8. ✅ Frente 2 — pino longe do CEP (1,5 km), chamada leve `{ conferir: { cep } }`, serviço fora não bloqueia.
9. ✅ Frente 3 — "N pedidos com o pino a conferir" em Já programadas, toque filtra, sem leitura a mais.
10. ✅ Testes, lint, build; validação no navegador; demanda, diário, handoff, reporte.

## Decisões técnicas

- **Sem migration.** Nada no banco muda: o lugar aproximado do endereço digitado vai para a própria linha do cache (`fonte = 'aprox_bairro' | 'aprox_cidade'`, `resolvido = false`, o ponto do lugar só para registro). A frente 3 conta na tela.
- **Cache do endereço digitado:** as chaves `avulsa:` **não leem mais o cache** — a busca digitada é um toque da pessoa e procura sempre. Motivo: a versão de antes gravou o lugar como se fosse a rua (o próprio 13961 está gravado assim — fonte `geoapify`, resolvido); ler o cache devolveria o ponto errado com cara de achado. O resultado continua gravado (serve de registro/diagnóstico). Custo: uma consulta à Geoapify por toque em "Achar no mapa".
- **Tipos de lugar da Geoapify:** suburb, district, postcode → bairro; city, county → cidade; state, country, unknown → descartados no modo livre. Amenity entra como "rua" (o nome é conferido quando há rua no texto).
- **Rua reconhecível no texto:** o 1º pedaço antes da vírgula começa pelo tipo do logradouro (Rua, Av., Travessa…, com as abreviações de sempre); o número do fim sai ("125", "nº 125", "s/n"). Sem rua reconhecível (um lugar, uma referência): vale a 1ª rua/casa que vier, como antes.
- **Escolha do lugar:** o 1º lugar que a Geoapify devolveu (ela ordena pela relevância).
- **Conferência do CEP:** `pontoParaConferir` em `fluxo.ts` usa o mesmo `peloCep` dos degraus (o serviço de CEP gratuito, sem chave); CEP geral (…000) ou torto = sem conferência. Na tela, a conferência só roda no clique de salvar e guarda o ponto de cada CEP enquanto a janela está aberta.
- **Quando confere:** só quando há pino NOVO (na parada avulsa em edição, o pino que já estava salvo não pergunta; no "Editar endereço", o pino do banco intocado não pergunta).
- **Frente 3:** "o ponto aproximado da cidade" = o ponto dos pedidos aproximados que a própria lista trouxe (a busca devolve o mesmo ponto para toda a cidade). Contam os programados de hoje (dia da fábrica) em diante. O toque mostra as **rotas inteiras** que têm um pino a conferir (como a busca da aba — o mapa e a ordem não se quebram, e "Salvar ordem" nunca vê uma rota pela metade).
- **O cartão** do pedido marcado à mão no centro da cidade ganha o aviso âmbar "O pino foi salvo no centro da cidade, não na casa — confira o ponto" com "Ajustar o pino"; a janela aberta dali trata o ponto como aproximado (salvar sem mover pergunta).

## Arquivos

- `supabase/functions/geocodificar/busca.ts` — `lugar` no candidato; `NivelDoLugar`, `LugarAproximado`; `ruaDoTextoLivre`; `escolherLivre`; Geoapify e Photon marcam o lugar.
- `supabase/functions/geocodificar/fluxo.ts` — consulta `aproximado`; `cepDeRua`, `pontoParaConferir`.
- `supabase/functions/geocodificar/index.ts` — `{ conferir: { cep } }`; `aproximado`/`lugar` na resposta; `avulsa:` sem cache; fonte `aprox_*` com `resolvido = false`.
- `src/rotas/api.ts` — `PontoAchado`, `acharPontoDoEndereco` com o aproximado, `pontoDoCepParaConferir`.
- `src/rotas/conferirPino.ts` (novo) — textos, CEP de rua, `useConferirPino`.
- `src/rotas/AvisosDoPino.tsx` (novo) — `AvisoRuaNaoAchada`, `PerguntaNoRodape`.
- `src/rotas/ModalParadaAvulsa.tsx`, `ModalPontoNoMapa.tsx`, `JanelaEnderecoPedido.tsx` — frentes 1 e 2.
- `src/rotas/pinoAConferir.ts` (novo), `AbaJaProgramadas.tsx`, `CartaoPedido.tsx` — frente 3.
- Testes: `src/rotas/pinoCerto.test.ts` (novo), `pinoCerto.telas.test.tsx` (novo), `buscaGeoapify.test.ts` (2 testes ajustados ao contrato novo: o digitado que só acha o bairro deixou de ser "achou").

## Comandos e ocorrências

- `tsc --noEmit` e `npm run lint`: limpos.
- 1ª bateria completa: 1 falha por tempo (5 s) no 1º teste de tela novo — a máquina carregada; os blocos de tela novos ganharam 20 s de limite (os outros da casa já sofrem disso, ver a 56).
- **Armadilha (de novo):** script Python com aspas dentro de heredoc quebra no bash desta máquina — escrever o script num arquivo; e o Python no Windows grava CRLF em modo texto (corrigido de volta para LF antes do commit).
- O print sem caminho do navegador cai na raiz da mesa — mover para a pasta de telas e passar o caminho completo.

## Validação no navegador

Site local (porta 5187) contra o banco de produção, usuário de teste. A função nova **não está publicada**: a resposta dela foi simulada **só dentro do navegador** (interceptando a chamada à função, nada foi ao banco) para ver as telas. Na aba Programar (montagem — nada é gravado até programar): parada avulsa "TESTE AGENTE pino certo" com o endereço do 13961 → aviso âmbar, Salvar travado; "Salvar assim mesmo" libera; Salvar → "O pino está a 4,9 km do CEP…" com Voltar / Salvar assim mesmo; computador, 375 e 768 sem rolagem lateral. Cancelado no fim (nada ficou). "Ajustar o pino" sem mover: provado pelos testes (não havia pedido aproximado na lista, e salvar num pedido real é proibido). Já programadas: nenhum pedido com o pino a conferir na lista de agora — os de 24/11 já foram todos marcados à mão e nenhum aproximado sobrou para reconhecer o centro de Natal (limite da conta na tela, ver o handoff).

## Lições (para a Memória de Aprendizado depois da dieta)

- L1 — Resposta "de lugar" de um geocodificador nunca é "achou": todo modo de busca precisa separar rua de lugar, inclusive o "livre", senão a tela mostra o pino com cara de certo.
- L2 — Cache de busca gravado com regra errada contamina as consultas seguintes; quando a regra muda, o cache daquela classe de chave precisa ser ignorado ou versionado.
- L3 — Conta feita "na tela" depende do que a tela tem: reconhecer "o centro da cidade" pelos aproximados da própria lista falha quando não sobra nenhum aproximado nela.
- L4 — Para ver na tela uma função ainda não publicada, simular a resposta dela dentro do navegador de teste (interceptar a chamada) — sem tocar no banco.
