---
titulo: "SESSAO-57 — O pino certo: a busca digitada não finge que achou, e o pino salvo à mão é conferido"
tipo: demanda
status: entregue
data: 2026-11-24
atualizado: 2026-11-24
tags: [plataforma, demanda, sessao-57, rotas, mapa, geocodificacao]
---

# 🎯 SESSAO-57 — O pino certo

> Pedido do dono em 24/11, 01:07 ("sim, coloque"), depois de achar estranho o pino do pedido 13961 mesmo usando "Achar no mapa". Diagnóstico do Cowork pelo banco vivo e por bases públicas de CEP (só leitura). Executada pela fila do Escritório, por cima da [[SESSAO-56 - Busca de Endereco pela Geoapify e Tela que Avisa]].

## O que é

A busca digitada ("Achar no mapa") devolvia o bairro ou a cidade como se fosse a rua, e o pino salvo à mão não era conferido — dois pinos da rota de 24/11 estavam no lugar errado (13961 a ~5 km da casa; 13840 no centro de Natal). Para a logística: a tela avisa, não deixa salvar sem arrastar, confere o pino contra o CEP e mostra quantos pedidos estão com o pino a conferir.

## O diagnóstico (banco vivo, 24/11 ~01:05)

- **13961** — "Rua Veredas do Peruaçu 125, Nova Esperança, Parnamirim", CEP 59144-158. Ponto manual (-5.909406, -35.251107), salvo às 01:04 depois de "Achar no mapa" (busca digitada `avulsa:…`, fonte `geoapify`). A referência pública do CEP é (-5.9453, -35.2769), ~5 km. A Geoapify não conhece a rua e devolveu um lugar; o modo `livre` aceitava qualquer resultado e `escolher` pegava o 1º.
- **13840** — "Rua José de Souza Cruz 1570, Mãe Luiza, Natal", CEP 59014-430. O ponto manual de 23/11 14:34 é exatamente o ponto aproximado do centro de Natal (-5.805398, -35.2080905): salvaram sem arrastar. O CEP é de outra rua de Mãe Luiza (confirmar com o cliente).
- Os outros da rota de 24/11 estão coerentes (13960, 13959, 13976 pelo bairro; 13962 pela referência da rua).
- No banco: 29 endereços resolvidos desde 00:40 — 18 pela Geoapify como rua e 11 como `aprox_cidade`.

## Comportamento esperado

### Frente 1 · a busca digitada não aceita bairro ou cidade como se fosse a rua
- `candidatosGeoapify` no modo `livre` separa **rua ou casa** (building, street, amenity) de **lugar** (suburb, district, postcode → bairro; city, county → cidade).
- Com a rua reconhecível no texto ("Rua/Av… " no começo), o candidato precisa ter o nome parecido (`semelhancaNome` ≥ 0,75).
- Só achou lugar → a função responde `resolvido: false` + `aproximado: 'bairro' | 'cidade'` + `lugar` (o nome), com o ponto do lugar só como sugestão de onde abrir o mapa. Não grava como rua.
- Nas três janelas que usam "Achar no mapa": o mapa abre no bairro/na cidade com o aviso âmbar *"Não achei a rua no mapa — o pino está no [bairro/centro da cidade]. Arraste até a casa antes de salvar."*; o Salvar só libera depois de arrastar ou de "Salvar assim mesmo".
- O 13961 vira teste com resposta de exemplo no formato da Geoapify.

### Frente 2 · o pino salvo à mão é conferido
- Pino não arrastado (igual ao ponto aproximado que a tela abriu) → *"Você não moveu o pino — ele está no centro de [cidade]. Arraste até a casa ou confirme."* (o 13840).
- Pino longe do CEP (provisória: 1,5 km; CEP de rua, não terminado em 000) → *"O pino está a X km do CEP deste endereço. Confira antes de salvar."* com "Salvar assim mesmo" e "Voltar". O ponto do CEP vem do serviço de CEP que a função já usa, numa chamada leve (`{ conferir: { cep } }`). Serviço sem resposta não bloqueia nada.
- Vale para "Editar endereço" do pedido, a parada avulsa e "Ajustar o pino".

### Frente 3 · a lista para a logística (só leitura)
- Em Rotas, junto do aviso de "ajustar o pino": "N pedidos com o pino a conferir" — programados de hoje em diante com ponto aproximado, ou com pino manual igual ao ponto aproximado da cidade. O toque filtra.
- Sem leitura a mais ao abrir a tela (a conta é na tela). Nenhum acerto automático de dado.

## Fora do escopo

- Acertar os pinos do 13961 e do 13840 (fica para a logística, na tela).
- Mexer na Ordem das Sessões, no ClickUp, no n8n, em segredo ou credencial.
- Publicar a função, o site ou aplicar migration (quem sobe é o dono).

## Critérios de aceite

- [x] A busca digitada de uma rua que o mapa não conhece mostra o aviso e não libera Salvar sem arrastar.
- [x] "Ajustar o pino" sem mover pede confirmação.
- [x] O pino longe do CEP pede confirmação; o serviço de CEP fora não bloqueia.
- [x] "N pedidos com o pino a conferir" em Rotas, com o toque que filtra, sem leitura a mais.
- [x] A função continua compatível com o site de antes (campos novos opcionais; `resolvido: false` tratado como hoje).
- [x] O 13961 como teste com a resposta de exemplo da Geoapify.

## Notas para o Claude Code

- Sem migration (nada no banco muda). Função `geocodificar` alterada e **não publicada**.
- Notas grandes do cofre não são editadas (a dieta da documentação não está na base): tudo no diário [[SESSAO-57]] e na seção "Para entrar nas notas depois da dieta" do handoff.

## Resultado (preencher ao entregar)

Entregue em 24/11/2026 pela fila do Escritório — handoff: [[handoff_2026_11_24_sessao57_pino_certo]].
