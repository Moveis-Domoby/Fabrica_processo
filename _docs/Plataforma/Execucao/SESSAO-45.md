---
titulo: Diário de execução — SESSAO-45 (rotas no mapa certo, liberar peça na Expedição, PCP honesto)
tipo: execucao
data: 2026-11-04
tags: [execucao, sessao-45]
---

# Diário — SESSAO-45 (04/11/2026, noite)

Demanda: [[SESSAO-45 - Rotas no Mapa Certo Liberar Peca na Expedicao e PCP Honesto]] · Handoff: [[handoff_2026_11_04_sessao45_rotas_expedicao_pcp]]
Ramo `sessao-45-rotas-mapa-expedicao-pcp` (pasta principal, a partir da `main` 4f5ecdf, sem outra sessão ativa). Numeração usada: D-217…D-220, E-178…E-179, A-137…A-140; migration `20261105010000`.

## Task list (espelha a demanda)

1. ✅ Rota indo ao Google Maps com endereço errado (13784 e outros)
2. ✅ "Endereço não encontrado no mapa" (13793 — o dono escreveu 13783 — e os outros)
3. ✅ Layout de "Já programadas"
4. ✅ Expedição: liberar a peça pronta para outro pedido
5. ✅ PCP "mentindo" sobre o estoque (vídeo do 13811)
6. ✅ Banco, função e site no ar, conferidos na tela; rastro dos testes apagado
7. ✅ Cofre: diário, handoff, decisões, aprendizados, esquema, ordem, mapa

## 1 · O raio-x (só leitura no banco real; nada gravado)

- Leitura por script local só-leitura (`pg` com `default_transaction_read_only`), no scratchpad.
- **13784** (Rua Desembargador Lins Bahia 173, Rocas, Natal): o ponto do cache era o MEIO de um trecho da rua (Photon). O Google Maps recebia **a coordenada** e mostrava o endereço mais perto dela — na prova, o pino caiu na esquina perto do Hospital Onofre Lopes; o mesmo link pelo **endereço escrito** abre "R. Des. Lins Bahia, 173 - Rocas" (conferido no navegador).
- **Auditoria dos 179 pontos do cache** contra o Nominatim (consultado daqui — do servidor da Supabase ele responde 403): 29 de 151 comparáveis a mais de 1 km, 10 a mais de 3 km. Causa: o Photon devolve a rua pelo NOME e Natal tem dezenas de ruas repetidas (Rua São João em 7 bairros, Rua Mira Mangue em 3, Rua Ceilândia no Planalto × Pajuçara); a busca antiga pegava o 1º resultado (`limit=1`) e só conferia a cidade — e lia a cidade na posição errada quando o endereço vinha sem bairro ("RN" virava a cidade).
- **13793** (Av Machado de Assis 400, bosque das colinas, São José de Mipibu): o mapa aberto chama aquela parte de São José de Mipibu de "Taborda" (localidade "Residencial Bosque das Colinas") → a conferência de cidade da busca antiga recusava. A parada avulsa achava porque a busca de texto livre não conferia cidade.
- Função `geocodificar`: o Nominatim recusa (403) toda chamada do servidor desde 03/10 — confirmado nos registros de 04/11.
- **Layout:** os botões (Detalhe/Reprogramar/Tirar) estavam no MESMO flex do cartão, ao lado; com o cartão em `min-w-0 flex-1`, ele encolhia até uma palavra por linha.
- **Vídeo do 13811** (14:23 UTC): o pedido chegou às 14:19 com 2× a mesa 162 (com gaveta); às 14:20 a venda reservou as 2 peças livres do estoque (regra da venda que reserva). O PCP dizia "2 no estoque" (as 2 reservadas para ele); o cartão do Estoque mostrava "0 em estoque" (o número grande é o LIVRE) e as 2 dentro de "4 reservados em venda" (junto com 2 prontas de outro pedido) — **as duas telas falavam de peças diferentes com a mesma palavra "estoque"**. Às 14:42 o Tiny trocou o item para a mesa 189 (sem gaveta); às 18:49 o PCP mandou produzir; às 18:51–18:52 a logística contou a 189 para 0 e deu baixa de 1 da 162 (o galpão tinha menos do que a plataforma). E a conta do chip do PCP somava **toda peça livre do mesmo SKU a todo pedido** que tinha o item, sem limite — 5 livres apareciam como "5 no estoque" em cada pedido, mesmo no que precisa de 1.

## 2 · O que foi feito

### Banco — `supabase/migrations/20261105010000_plt_rotas_mapa_expedicao_pcp.sql` (montada das versões VIVAS, pg_get_functiondef de 04/11)
- `plt_fn_geo_marcar(chave, endereco, lat, lon)` — logística/admin; confere `md5(lower(endereco)) = chave`; grava `plt_geocache` com `fonte = 'manual'`; lat/lon nulos = desmarcar (apaga só o manual); registro em `plt_logs_atividade` (`mapa_ponto_marcado/desmarcado`, sem o endereço); avisa a área `rotas`.
- `plt_fn_programadas` (drop + create, mesma assinatura de entrada) **+ `cep`, `geo_manual`**; `plt_fn_entregas_do_dia` **+ `cep`, `geo_manual`** no JSON.
- `plt_privado.fn_liberar_peca_avaliar(peca, numero)` (a regra única, sem erro, devolve o motivo), `plt_fn_liberar_peca_destino` (conferência, só leitura) e `plt_fn_liberar_peca(peca, para_numero, motivo, relancar, chave)` (o gesto: `unidade_desvinculada` na peça → a vaga do pedido de origem reabre; no destino, unidade nova PRONTA na Expedição na vaga que esperava o mesmo móvel (`card_criado`, como a peça do estoque); a peça antiga `card_arquivado` pela maquinaria da entrega; "não por enquanto" = `plt_fn_pcp_standby`; aviso `pedido_peca_liberada` ao PCP; idempotente pela chave do toque; recusa explicada para pedido programado + "não por enquanto").
- `plt_fn_pcp_quadro` (mesma assinatura): a conta das peças do estoque por item, limitada ao que falta liberar; `pedido_resumo.pecas_reservadas`.
- `fn_avisos_catalogo` + `pedido_peca_liberada` (público PCP).
- Nenhuma tabela, nenhuma coluna; nada em tabela da integração.

### Função `geocodificar` v10 (`supabase/functions/geocodificar/index.ts` + `busca.ts`)
- Regra pura em `busca.ts` (testada no Vitest em `src/rotas/buscaEndereco.test.ts` com respostas reais): endereço partido de trás para a frente; abreviações por extenso; títulos (Vereador × Governador) não separam ruas; CEP com ponto aceito; candidatos de várias consultas (Photon com `bbox` do RN, `limit 10`; Nominatim estruturado quando aceitar) pontuados por nome, bairro/localidade, CEP (exato/faixa), cidade e casa com número; sem prova do lugar não serve; rua de mesmo nome longe e nada que desempate = "não achei".
- O ponto `manual` nunca é trocado; o que a busca antiga gravou antes de `VERSAO_BUSCA` (05/11 00:00 UTC — o mesmo instante na tela) é refeito uma vez; o Nominatim que recusa fica 1 h sem ser chamado.
- Simulação contra os 172 endereços do cache: 158 achados (antes 160); +4 que não eram achados (São José de Mipibu, São Gonçalo do Amarante 2×, Extremoz); 6 que tinham ponto ERRADO passam a "não achei" (ex.: "Avenida litorâne" × "Avenida Bugueiro…", "Estrada RN 313" × "Rota Sul") — esses ganham o "Marcar no mapa".

### Telas
- `src/rotas/navegacao.ts`: o lugar = endereço escrito com CEP ("Rua X, 173 - Bairro, Cidade - UF, 59010-190"); o ponto só se `pontoConfirmado` (marcado à mão ou pino da avulsa) ou sem rua; partes do link encolhem se passariam de 2048 caracteres.
- `CartaoPedido`: "Marcar no mapa" (não encontrado) e "Acertar o ponto no mapa" / "Ponto marcado à mão · acertar" (achado) → `ModalPontoNoMapa` (busca de texto + pino arrastável, "Salvar o ponto", "Voltar à busca automática").
- `AbaJaProgramadas`: o cartão ocupa a largura; os botões numa linha própria, embaixo (pedido e parada avulsa).
- `paradasAvulsas.lugarDaAvulsa`: `ponto_confirmado` quando há pino.
- `api.precisaGeocodificar`: o resolvido antes de `VERSAO_BUSCA` é procurado de novo uma vez.
- Expedição: "Liberar para outro pedido" no cartão com peça pronta → `ModalLiberarPeca` (as perguntas do dono, conferência ao digitar o número, "Sim, produzir de novo" / "Não por enquanto").
- PCP: o chip diz "N reservada(s) + M livre(s) no estoque", com a explicação; Estoque (cartão e janela do produto): com reserva no galpão, o número grande vira "livres no estoque" e aparece "+ N no estoque reservadas para venda (pedido X)".

## 3 · Comandos e verificação

- Bateria do banco (`npm run test:banco`): **1.471 verdes, 1 vermelho já antigo** ("as 7 portas novas = as antigas" do painel de vendas — falha na `main` sem esta sessão, registrado na SESSAO-44). Bloco SESSAO-45: 13 verdes.
- Front: `tsc -b` limpo, `eslint src` limpo, **385 testes verdes** (59+1 arquivos), `vite build` ok.
- Desempenho: a conta nova do PCP, no banco real, 3,6 ms para os 13 cards de pedido do PCP (aquecida, 3 execuções).
- Aplicação: `npm run banco:aplicar -- --confirmar --so 20261105010000_…` — integração do Tiny idêntica (`e2109f3a…`, linhas idênticas). Função `geocodificar` publicada pelo conector (v10, `verify_jwt` ligado). Site: `push sessao-45:main` (65fd2e0), Vercel "success".
- Advisors: segurança só +3 avisos esperados (portas com login: `plt_fn_geo_marcar`, `plt_fn_liberar_peca`, `plt_fn_liberar_peca_destino`); desempenho sem nada novo.
- Tela publicada (navegador do app, logado pelo dono): "Já programadas" em 1600 px e 375 px (sem rolagem lateral), link do Google Maps com o endereço escrito, a janela "Marcar no mapa" (aberta e cancelada — nada salvo), Expedição "Liberar para outro pedido" (conferência recusando o 13649 — cancelado no Tiny — e aceitando o 13652; cancelada sem confirmar), chip do PCP ("1 livre no estoque"), Entregas do dia com os links por endereço. O 13793 ganhou o ponto às 23:56 UTC pela busca nova.

## 4 · Erros e como foram resolvidos

- **E-178** — a bateria reaplica a migration dos filtros da Programação (20261027080000) depois da nova; ela só derrubava a assinatura de 5 argumentos e o `create or replace` da de 6 batia no retorno novo ("cannot change return type"). → a 080000 passa a derrubar também a de 6 (reaplicável; em produção nada muda); a nova entra na cadeia de reaplicação do bloco 38; o bloco 82 deixa a conta das peças do estoque fora da comparação (mudou de propósito; conferido que a nova nunca passa da antiga).
- **E-179** — remendos por script com `\d` dentro de heredoc perderam as barras; e o `sed` que tentou trocar o ajudante de CRLF quebrou o próprio script. → regex mexida com a ferramenta de edição; scripts de remendo escritos pelo Write.

## 4b · Ajuste do dono (05/11, madrugada) — "a rota precisa do endereço exato do cliente, não do ponto marcado; o ponto pode servir para ajuste; não pode acontecer endereço não encontrado" (D-221)

Task list do ajuste: 1) ver como a rota e a busca tratam o endereço ✅ · 2) Google Maps/Waze sempre pelo endereço ✅ · 3) nunca "não encontrado": degraus ✅ · 4) testes e simulação com os endereços reais ✅ · 5) publicar e conferir na tela · 6) rastro e cofre.

- O dono marcou à mão um ponto (Nísia Floresta) às 01:45 UTC de 05/11 — o registro é dele; nada a apagar.
- **Navegação** (`src/rotas/navegacao.ts`, `paradasAvulsas.ts`): saiu o `pontoConfirmado` — o link vai SEMPRE pelo endereço escrito (na avulsa, o digitado); o ponto só sem rua escrita. Testes do 13784 com ponto marcado à mão e da avulsa com pino.
- **Busca em degraus** (`supabase/functions/geocodificar/busca.ts` + `index.ts`): `escolherPerto` (rua de mesmo nome perto da âncora: 1,5 km do CEP, 2 km do bairro), `pontoDoCep` (cidade e UF iguais; CEP de rua só com a rua OU o bairro batendo; CEP geral …000 = centro da cidade), `consultaBairro`/`consultaCidade`, `escolherLugar` (bairro: nome igual, senão o nome do pedido dentro do do mapa e sem o mapa dizer outro bairro; cidade: nome igual). Ordem: rua → CEP (âncora ou ponto `aprox_cep`) → bairro (âncora ou `aprox_bairro`) → CEP geral/cidade (`aprox_cidade`). Buscador falhando nos degraus = "tentar depois" (nada gravado). O livre (avulsa/janela) não desce degraus. `VERSAO_DEGRAUS` (05/11 03:00 UTC, função e tela juntas): o "não achei" anterior é refeito uma vez.
- **Banco** — migration `20261105020000_plt_rotas_ponto_aproximado.sql`: `plt_fn_programacao` (+ `cep`, `geo_manual`, `geo_aproximado`) e `plt_fn_programadas` (+ `geo_aproximado`), drop + create das versões vivas, mesmas permissões. Nenhuma tabela/coluna (o degrau mora em `plt_geocache.fonte`). A 20261027040000 passa a derrubar a Programação antes de recriá-la e devolve as permissões (E-178: a bateria a reaplica); a nova entrou na cadeia do bloco 38. Teste novo no bloco SESSAO-45 (aproximado nas duas listas, rua não, permissões).
- **Telas**: `CartaoPedido` — "Ponto aproximado no mapa (pelo CEP/bairro/centro da cidade) · acertar"; o raro sem ponto diz "Ainda sem ponto no mapa da rota — o Google Maps vai pelo endereço"; títulos dizem que o Google vai pelo endereço. `ModalPontoNoMapa` — o aviso de que o ponto é só do mapa da rota e o texto do aproximado.
- **Serviços de CEP** (A-141): AwesomeAPI com ponto bom (mediana 217 m) e limite de uso (429 depois de ~38 seguidas); BrasilAPI v2 com coordenadas inúteis (mediana 5,5 km).
- **E-180**: `cat >` sem heredoc travou um comando e criou arquivo vazio fora do repo — apagado.

## 5 · Rastro dos testes

- Nada gravado em pedido, peça, evento ou ponto de verdade (as janelas foram abertas e canceladas).
- Apagados no fim (com a trava dos registros desligada e religada na MESMA transação): os 10 registros de navegação do teste de tela (ids 14556734–14556743, 23:50–00:01 UTC, só rotas que eu visitei) e a linha de cache da busca de texto da janela do mapa (`avulsa:65409ad6…`). A trava ficou ligada (conferido).
- Os registros da plataforma Supabase (chamadas HTTP da função) não são apagáveis por nós — não têm dado do pedido.
