---
titulo: Handoff — SESSAO-57 · o pino certo (a busca digitada não finge que achou, e o pino salvo à mão é conferido)
tipo: handoff
data: 2026-11-24
tags: [handoff, sessao-57, rotas, mapa, geocodificacao]
---

# 📋 Handoff — SESSAO-57 · O pino certo (24/11/2026, madrugada — fila do Escritório)

Demanda: [[SESSAO-57 - O Pino Certo]] · Diário: [[SESSAO-57]]

> ⏳ **NADA ESTÁ NO AR.** Tudo está só no ramo `sessao-57-pino-certo` desta mesa (por cima do ramo da 56). Nenhuma atualização de banco (esta sessão não tem), a função `geocodificar` não foi publicada, o site não foi publicado.
> ⚠️ O link deste handoff no [[000 - MAPA DO PROJETO]] não foi feito (as notas grandes ficam para depois da dieta — seção 6).

## 1. Objetivo

O dono (24/11, 01:07): o pino do 13961 estava estranho mesmo depois de "Achar no mapa". O Cowork achou a causa: a busca digitada aceitava o bairro ou a cidade como se fosse a rua (13961, ~5 km da casa), e o pino salvo à mão sem arrastar ficou no centro de Natal (13840).

## 2. O que foi feito

### Frente 1 — a busca digitada não finge que achou
- No endereço digitado ("Achar no mapa" da parada avulsa, de "Ajustar o pino"/"Marcar no mapa" e de "Editar endereço"), só **rua ou casa** vira o ponto. Se o texto começa por uma rua ("Rua…", "Av.…"), o nome do resultado precisa ser parecido com ela.
- Quando o mapa só acha o **bairro** ou a **cidade**, a função responde "não achei" com o lugar junto (onde abrir o mapa). A janela abre o mapa ali, com o aviso âmbar: *"Não achei a rua no mapa — o pino está no bairro Nova Esperança. Arraste até a casa antes de salvar."* (ou *"no centro de Natal"*). O Salvar fica travado até arrastar o pino — ou até tocar em **"Salvar assim mesmo"**, no próprio aviso.
- O site de antes continua funcionando com a função nova (ele lê esse caso como "não achei", como sempre).

### Frente 2 — o pino salvo à mão é conferido
- **Pino não arrastado:** salvar com o pino no ponto aproximado que a janela abriu → no rodapé: *"Você não moveu o pino — ele está no centro de Natal. Arraste até a casa ou confirme."* com **Voltar** e **Salvar assim mesmo** (o caso 13840).
- **Pino longe do CEP:** endereço com CEP de rua (não terminado em 000) e pino a mais de 1,5 km do ponto do CEP → *"O pino está a 4,9 km do CEP deste endereço. Confira antes de salvar."* com Voltar e Salvar assim mesmo. O ponto do CEP vem do serviço de CEP que a função já usava, numa chamada leve, só no clique de salvar. Serviço sem resposta → salva normal, nada bloqueia.
- Vale nas três janelas. Na parada avulsa, o CEP é lido do próprio texto do endereço (quando escrito).

### Frente 3 — a lista para a logística
- Em Rotas → Programação → **Já programadas**, um botão âmbar: **"N pedidos com o pino a conferir"** — programados de hoje em diante com o ponto ainda aproximado, ou marcados à mão exatamente no ponto aproximado da cidade. O toque mostra só as rotas que têm esses pedidos (as rotas inteiras); tocar de novo mostra todas.
- O cartão do pedido marcado à mão no centro da cidade avisa: *"O pino foi salvo no centro da cidade, não na casa — confira o ponto"*, com **Ajustar o pino**.
- Sem leitura a mais (a conta é feita com o que a aba já traz). Nenhum pino foi mexido.

## 3. Como testar (depois de ligar)

1. **Rua que o mapa não conhece (o 13961).** Rotas → Programação → Programar → "Adicionar parada avulsa". Título "teste", endereço *"Rua Veredas do Peruaçu 125, Nova Esperança, Parnamirim, 59144-158"* → "Achar no mapa". Deve aparecer o aviso âmbar "Não achei a rua no mapa — o pino está no bairro…" e o botão "Salvar a parada" apagado. Arraste o pino → o botão acende. (Ou toque em "Salvar assim mesmo" no aviso.) Cancele no fim — nada é gravado na montagem.
2. **Pino longe do CEP.** No mesmo passo 1, com o pino onde a busca deixou, "Salvar assim mesmo" e "Salvar a parada" → o rodapé pergunta "O pino está a X km do CEP deste endereço…". "Voltar" não salva; "Salvar assim mesmo" salva.
3. **Ajustar o pino sem mover.** Num pedido com o aviso "Endereço aproximado… ajustar o pino": "Ajustar o pino" → "Salvar o ponto" sem mexer → aparece "Você não moveu o pino — ele está no centro de [cidade]…". "Voltar" volta; arraste o pino e salve → salva direto (se não estiver longe do CEP).
4. **Editar endereço.** Num pedido de teste, "Editar endereço" → "Achar no mapa" com uma rua que não existe → o mesmo aviso e o Salvar travado.
5. **A lista.** Já programadas: com algum pedido de hoje em diante com ponto aproximado, aparece "N pedidos com o pino a conferir"; o toque mostra só essas rotas. Hoje (24/11, madrugada) a lista não mostra nada — ver a seção 5.
6. **Celular (375) e tablet (768):** os avisos e a pergunta do rodapé cabem sem rolar para o lado.

**Provado por teste automático:** o 13961 com resposta de exemplo da Geoapify (só bairro/cidade → não achou; rua com outro nome → não serve; a rua certa → achou), a conferência do CEP (serviço fora não bloqueia, CEP geral não pergunta), as perguntas da tela nas três situações e a conta da lista — 29 testes novos (19 da regra e 10 de tela).

## 4. Para ligar com o dono (nesta ordem)

1. **Atualização do banco:** **nenhuma** nesta sessão.
2. **Publicar a função `geocodificar`** (os três arquivos: `index.ts`, `busca.ts`, `fluxo.ts`). Ela é compatível com o site de hoje. Depois de publicar, o "Achar no mapa" do site de hoje passa a dizer "não achei" quando só acha o bairro/a cidade (antes punha o pino lá como se fosse a casa) — isso já é a correção.
3. **Publicar o site** (subir para a main) — por cima da 56 (que precisa estar publicada antes, ou junto).
4. **Acertar os pinos na tela** (logística): o 13961 e o 13840 (o CEP do 13840 é de outra rua de Mãe Luiza — confirmar o endereço com o cliente).

## 5. Pendências e limites

- **A lista "pino a conferir" só reconhece o centro da cidade se a própria lista tiver um pedido ainda aproximado daquela cidade.** Hoje (24/11) os pedidos da rota de 24/11 estão todos marcados à mão — nenhum aproximado sobrou — então o 13840 **não aparece** na lista. Para pegar sempre, o banco precisaria dizer "este pino manual é igual ao ponto aproximado da cidade" na leitura que já existe (uma atualização do banco pequena) — fica para o dono decidir.
- **"Ajustar o pino" sem mover não foi visto na tela de verdade:** não havia pedido com ponto aproximado e salvar em pedido real é proibido na fila; está provado pelos testes.
- **As telas da frente 1 e 2 foram vistas com a resposta da função simulada dentro do navegador** (a função nova não está publicada).
- ClickUp não mexido (regra da fila).

## 6. Provisórias (o dono confirma ou muda)

1. **1,5 km** do ponto do CEP para perguntar (da demanda).
2. **A busca digitada não usa mais a memória de buscas** — cada "Achar no mapa" procura de novo (a memória antiga tinha o bairro gravado como se fosse a rua). Custa uma consulta por toque.
3. **O lugar que vem no lugar da rua** é o primeiro que o mapa devolve; a área do CEP conta como bairro.
4. **"Salvar assim mesmo" no aviso** libera o botão Salvar (não salva sozinho).
5. **Só o pino novo é conferido:** o pino que já estava salvo (parada em edição, endereço sem mexer no pino) não pergunta.
6. **O toque na lista mostra as rotas inteiras** que têm um pino a conferir (não só os pedidos soltos), para o mapa e a ordem não se quebrarem.
7. **A lista conta de hoje em diante pelo dia da fábrica.**

## 7. Para entrar nas notas depois da dieta

- **[[PLT - Decisoes de Produto]]:** a busca digitada só aceita rua/casa (lugar = "não achei" + onde abrir o mapa); o Salvar travado até arrastar ou "salvar assim mesmo"; a conferência do pino (não arrastado, longe do CEP 1,5 km, serviço fora não bloqueia); a lista "pino a conferir"; + as 7 provisórias da seção 6.
- **[[PLT - Memoria de Aprendizado]]:** as lições L1–L4 do diário.
- **[[SUPA - Esquema do Banco]]:** `plt_geocache` — nas chaves `avulsa:`, `fonte = 'aprox_bairro' | 'aprox_cidade'` com `resolvido = false` (o lugar achado no lugar da rua, só registro); as chaves `avulsa:` não são mais lidas pela função.
- **[[PLT - Lei de Desempenho e Escala]]:** nenhuma dívida nova (a conferência do CEP é no clique, com tempo limite e sem bloquear; a lista é conta na tela). Registrar: "Achar no mapa" deixou de usar o cache (uma consulta externa por toque — escolha consciente, ver provisória 2).
- **[[PLT - Modelo de Sistema]]:** a pergunta no rodapé da janela (aviso âmbar + Voltar + "Salvar assim mesmo") como padrão reutilizável.
- **[[000 - MAPA DO PROJETO]]:** o link deste handoff.

## 8. Arquivos alterados

```
supabase/functions/geocodificar/busca.ts · fluxo.ts · index.ts   (NÃO publicada)
src/rotas/api.ts
src/rotas/conferirPino.ts (novo) · AvisosDoPino.tsx (novo) · pinoAConferir.ts (novo)
src/rotas/ModalParadaAvulsa.tsx · ModalPontoNoMapa.tsx · JanelaEnderecoPedido.tsx
src/rotas/AbaJaProgramadas.tsx · CartaoPedido.tsx
src/rotas/pinoCerto.test.ts (novo) · pinoCerto.telas.test.tsx (novo) · buscaGeoapify.test.ts
_docs/Plataforma/Demandas/SESSAO-57 - O Pino Certo.md · _docs/Plataforma/Execucao/SESSAO-57.md · este handoff
```

## 9. Validação no navegador (24/11, ~01:24–01:30)

Site local contra o banco de produção, usuário de teste. Prints em `C:\Users\wccau\.escritorio\telas\domoby\sessao-57-pino-certo\` (01 a 05).

| Item | Resultado | Prints |
|---|---|---|
| Já programadas abre normal | ✅ 6 entregas; nenhum "pino a conferir" (todos marcados à mão — seção 5) | 01 |
| Rua não achada (parada avulsa, resposta da função simulada) | ✅ aviso âmbar com o bairro, Salvar travado; "Salvar assim mesmo" libera | 02 |
| Pino longe do CEP | ✅ "O pino está a 4,9 km do CEP…" com Voltar / Salvar assim mesmo | 03 |
| Celular 375 e tablet 768 | ✅ sem rolagem lateral, botões grandes | 04, 05 |
| "Ajustar o pino" sem mover | ⚪ só pelos testes (sem pedido aproximado na lista; salvar em pedido real é proibido) | — |

Nada foi gravado: a parada de teste ficou só na montagem e foi cancelada.

## 10. Validação dos endereços um por um, no site publicado (24/11, ~03:00 Brasília)

Detalhe no diário [[SESSAO-57]] (seção "Validação dos endereços um por um"). Resumo:

| | Resultado |
|---|---|
| Pontos de rua já gravados (Geoapify, Photon, à mão) | ✅ todos a ≤ 0,7 km do CEP (13984 a 1,1 km, avenida longa) |
| Rota de 24/11 (6 pedidos) | ✅ todos no lugar; 13840 no ponto do CEP, mas o CEP é de outra rua — confirmar com o cliente |
| Busca nova em 34 endereços | ⚠️ acha a rua em 18; 16 vão para o centro da cidade |
| Serviço de CEP | ❌ recusa a função por excesso (HTTP 429) — o degrau do CEP e a conferência "pino longe do CEP" não funcionam |
| Aba Programar | ❌ 8 pedidos no centro da cidade sem o aviso de "ajustar o pino" (a lista não manda o campo do aviso) — 13964, 13971, 13969, 13957, 13979, 13975, 13977, 13952 |

Nada foi corrigido nem alterado (ficaram só 34 linhas de registro da busca digitada no cache). Decisões com o dono: o aviso na aba Programar, outro caminho para o ponto do CEP, e acertar os 8 pinos.
