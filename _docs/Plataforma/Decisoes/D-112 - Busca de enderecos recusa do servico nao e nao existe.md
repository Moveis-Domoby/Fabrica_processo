---
id: D-112
aliases: [D-112]
titulo: "Busca de endereços: recusa do serviço não é \"não existe\"; um segundo buscador gratuito quando o primeiro recusa"
tipo: decisao
data: 2026-10-03
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-039 - ROTAS programacao de caminhao com mapa e sugestao caminhoes|D-39]]"]
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-112 · Busca de endereços: recusa do serviço não é "não existe"; um segundo buscador gratuito quando o primeiro recusa (03/10/2026) — ↪️ D-39

**Contexto:** na carga de teste, os 18 endereços saíram "não encontrado no mapa"; a mesma busca feita fora do servidor achou 15. Provado em 03/10: o buscador gratuito (Nominatim) responde **"acesso proibido" (HTTP 403)** a todo pedido que sai do nosso servidor, e a função antiga gravava a recusa como "endereço não existe" por 7 dias.

**Decidido (respostas do dono):** *"Sim, conserta"* e, sobre trocar de buscador, *"Sim, use o outro"*:
- **Recusa/limite/fora do ar não grava nada** — a tela tenta de novo depois; só "não existe" de verdade fica guardado.
- Três tentativas por endereço (completo → sem o CEP → rua e cidade); **nunca "só a cidade/bairro"**; a cidade do resultado é conferida.
- Quando o primeiro buscador recusa, a consulta vai ao **Photon** — outro buscador gratuito, sem chave, sobre o mesmo mapa aberto. O cache guarda **quem respondeu**.
- A resposta do serviço fica no **registro da função** (sem o endereço — dado pessoal).

**Descartadas:** buscar o endereço no navegador de quem usa (o ritmo e a identificação que o serviço exige não se garantem lá); serviço pago com chave.
