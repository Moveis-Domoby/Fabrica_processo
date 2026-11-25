---
titulo: Handoff — 2026-11-25 · o cofre em dia depois da subida de 25/11 (só documentação)
tipo: handoff
data: 2026-11-25
atualizado: 2026-11-25
tags: [handoff, cofre, documentacao]
---

# 📋 Handoff — 25/11/2026 · o cofre em dia depois da subida de 25/11 (fila do Escritório)

Diário técnico: [[COFRE-2026-11-25]] · a subida que isto documenta: [[handoff_2026_11_25_subida_atualizada]].

> **Só documentação.** Nenhum arquivo fora de `_docs/` mudou. Nada a ligar no banco, nenhuma função a publicar, o site não remonta.

## 1. O que o dono pediu

A subida de 25/11 entrou no ar por volta das 05:00 (banco e site) e a 56 e a 57 estavam no ar desde 24/11 — mas a documentação ainda dizia "esperando o dono", "em desenvolvimento", "não aplicada". O pedido: pôr tudo em dia, sem apagar o texto antigo (marcar com ↪️ 25/11 e escrever o novo ao lado).

## 2. O que foi feito

- **As sete demandas** (a dieta da documentação, as datas certas, o selo "Entregue em parte", o Comercial, as telas de uma leitura, a busca de endereço e o pino certo) dizem agora **"no ar"**, com o dia (24 ou 25/11) e a ligação para o handoff da subida. O status antigo ficou copiado na linha ↪️ logo abaixo do título.
- **A Ordem das Sessões:** as linhas 49 e 52 a 56 em "no ar"; a subida de 25/11 marcada como ligada; a linha das rotinas do banco continua "pronta no ramo", com o acréscimo: a parte 1 (avisos, reservas e fotos) entra pela fila na noite de 25/11, e a virada do Comercial espera o dono guardar a chave no cofre de segredos da Supabase (vazio em 25/11).
- **Os handoffs** das sessões 52 a 56 (e, a mais, os da 49 e da 57) ganharam uma linha no topo, "↪️ no ar". O resto deles não foi tocado: é história.
- **Os Próximos Passos** abrem com a seção nova **"▶️ Agora (25/11)"**: o que está no ar desde 24 e 25/11, uma frase cada, e os seis itens do que falta. A de 18/11 virou "(anterior)".
- **O banco:** as quatro notas do domínio dizem "no ar" ao lado de cada "não aplicada" (e ao lado do "fica para outro dia" da função antiga do Comercial, que foi apagada com a autorização do dono). O arquivo do esquema ganhou uma seção com as 12 atualizações de 24 e 25/11 **na ordem em que foram aplicadas**, com o nome de cada porta criada, recriada ou removida.
- **Os mapas:** o mapa das sessões e oito mapas de área mostram "no ar" ao lado de cada uma dessas sessões.
- **A mais, pelo mesmo fato:** o débito técnico do Comercial (quatro itens marcados como resolvidos em 25/11), a nota dos dados do Comercial (a função antiga não existe mais) e as dívidas da lei de desempenho (as duas da sessão das telas de uma leitura, "no ar").

## 3. Como testar, passo a passo

Não há tela nova. É conferir a leitura, no Obsidian:

1. Abrir **Próximos Passos**: a primeira seção é "▶️ Agora (25/11)", com "No ar desde 24/11", "No ar desde 25/11" e "O que falta" (seis itens).
2. Abrir a **Ordem das Sessões**: as linhas 49 e 52 a 57 com ✅; a linha 34 com o ↪️ de 25/11.
3. Abrir qualquer uma das demandas 52 a 55: o status no alto diz "no ar em 25/11" e a linha ↪️ liga para o handoff da subida.
4. Abrir o **mapa das sessões**: a primeira linha é esta entrega; a subida de 25/11 aparece como ligada.

## 4. Critérios de aceite

- ✅ **1. Status das demandas** — as sete, no campo de status e no topo.
- ✅ **2. Ordem das Sessões** — 49, 52–55 em "no ar (25/11)"; a 56 em "no ar (24/11)"; a subida "ligada"; a linha da 34 com as duas frases.
- ✅ **3. Handoffs das 52–56** — uma linha no topo de cada um; o resto intacto.
- ✅ **4. Próximos Passos** — a seção nova, em português de gente; a de 18/11 como "(anterior)".
- ✅ **5. Esquema do banco** — o arquivo com a seção nova, na ordem de produção; as notas do domínio dizendo "no ar".
- ✅ **6. Mapas** — o das sessões e os de área.
- ⚠️ **7. Índice da memória abaixo do teto** — **não deu**; ficou como aviso (seção 9).
- ✅ **8. Verificador** — zero erro (seção 8).
- ✅ **Não fazer** — nada de código, banco, funções ou n8n; nada sobre o ClickUp; o ramo das rotinas não foi tocado.

## 5. Decisões

Nenhuma decisão de produto nova. As provisórias das entregas que subiram continuam esperando o dono, onde já estavam listadas: a seção 5 do [[handoff_2026_11_24_subida_juntar_entregas|handoff da subida de 24/11]] e a seção 5 do [[handoff_2026_11_25_subida_atualizada|handoff da subida de 25/11]].

## 6. O que está no ar e o que não está — para o publicador

- **Banco:** nada a ligar. Nenhuma atualização do banco nova; nenhuma grava, muda ou apaga dado.
- **Funções do servidor:** nada a publicar.
- **Site:** não remonta — só `_docs/` mudou, e o pulo da documentação está ligado.
- **Ordem de ligar:** juntar este ramo na main e enviar. É um passo só.
  - *Antes:* a main no mesmo ponto de onde este ramo partiu (`f4b872e`) ou à frente só com cofre; se outra entrega mexeu nas mesmas notas, juntar ficando com o texto dos dois.
  - *Depois:* `node scripts/cofre/verificar.mjs` na main com zero erro; a publicação do site **não** dispara (o envio é só de documentação).
- **O arquivo do esquema** (`_docs/Supabase-fabrica/supabase-fabrica-schema.sql`) é lido pela bateria do banco: a seção nova é **só comentário**, e a bateria foi rodada com ele (seção 7).

## 7. Testes

Nenhuma tela nem código mudou; os comandos foram rodados mesmo assim, na mesa:

- **Lint:** limpo.
- **Montagem do site:** compila.
- **Testes de tela:** **124 arquivos, 864 testes, todos verdes.**
- **Bateria do banco** (lê o arquivo do esquema que mudou): **2.128 verdes, nenhuma vermelha** ("tudo verde — migrations idempotentes, integração intacta, eventos imutáveis"), inclusive a prova que depende da hora.
- **Navegador:** não usado — não há tela nova nem mudada.
- **Desempenho:** nada tocado (só documentação).

## 8. O cofre

`node scripts/cofre/verificar.mjs --gerar` e `node scripts/cofre/verificar.mjs`: **✅ zero erro**, 11 avisos — os mesmos de antes: handoffs e diários antigos acima do teto, o índice da memória acima do teto de índice (63,9 KB), um número de lição citado que não existe, ligações para trechos. Camada 1: 31,1 KB de 40 KB. 503 lições, 359 decisões, 16 mapas.

Notas novas: este handoff, o diário [[COFRE-2026-11-25]] e duas lições ([[Memoria - Banco e SQL 2#A-267|A-267]] — o arquivo do esquema é carregado pela bateria, a plataforma entra só em comentário; [[Memoria - Git Shell e Windows 2#E-331|E-331]] — roteiro longo se grava em arquivo, não se passa pelo shell). Próximos livres: **D-403 · E-332 · A-268 · Q-75 · dívida 49**.

## 9. Ficou pendente

- **O índice da memória segue acima do teto** (64 KB para 60). Quase tudo nele é a lista que o verificador escreve sozinho, uma linha por lição; o texto das lições já mora nas notas de tema, então não há o que mover. Para baixar é preciso mexer no roteiro que gera a lista (encurtar a linha de cada lição ou partir o índice em dois) — fica para uma entrega que possa mexer em roteiro.
- **Três handoffs e uma demanda ficaram um pouco maiores** com a linha nova do topo (os handoffs da 52, da 54 e da 55 já estavam acima do teto de handoff; continuam como aviso).
- O que a subida deixou com o dono continua valendo e está na seção "O que falta" dos [[000 - PROXIMOS PASSOS|Próximos Passos]].

### Aguardando decisão do dono

Nada novo desta entrega.

### Próximo passo sugerido

Juntar na main e enviar. Depois, as rotinas do banco (parte 1) na noite de 25/11.
