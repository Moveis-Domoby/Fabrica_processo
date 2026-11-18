---
id: D-106
aliases: [D-106]
titulo: "O \"Se… senão\": a condição com DUAS saídas, cada uma com os próprios passos"
tipo: decisao
data: 2026-10-02
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-103 - As regras do motor na hora no banco nunca derruba o gesto|D-103]]"]
area: [painel-chat-automacoes]
tags: [decisao, area/painel-chat-automacoes]
---
# D-106 · O "Se… senão": a condição com DUAS saídas, cada uma com os próprios passos (02/10/2026) — ↪️ D-103

**Pedido do dono no teste ao vivo:** *"coloque separador lógico condicionais tipo, if (com um else embutido como segunda saída), coisas assim também"* — e, na mesma mensagem, *"ajuste a hierarquia disso aqui, está tudo fora de esquadro"* (a janela de escolher o próximo bloco).

- **Bloco novo "Se… senão"** (no grupo Lógica, ao lado do "Só se…" e do "Esperar"): testa as MESMAS condições do "Só se…" (etiqueta, campo, setor, situação do pedido, tipo de card). Bateu → segue pelo caminho **Sim**; não bateu → pelo caminho **Senão**. No canvas, o bloco tem **duas bolinhas de saída**, com o nome de cada uma (Sim em verde, Senão em vermelho) e **um "+" para cada**.
- **Depois do "Se… senão" não há "continuação comum"**: os passos seguintes moram DENTRO dos caminhos (o banco recusa passo depois dele na mesma sequência). Caminho vazio = a automação termina ali. Caminhos dentro de caminhos valem até **5 níveis**; o limite de **40 passos conta os dos caminhos**.
- **Pôr um "Se… senão" no meio** de uma sequência: quem vinha depois passa a seguir pelo **Sim**. **Tirar** um "Se… senão": o caminho Sim continua no lugar dele; o Senão fica **solto** (não roda — a tela avisa).
- Como o banco guarda: o passo `se_senao` leva `entao` e `senao` (listas de passos) dentro dele. O executor, ao avaliar, troca o resto do plano pelo caminho escolhido e **guarda o plano** — o "esperar" dentro de um caminho retoma no lugar certo. No histórico: "se … → caminho Sim/Senão — condição bateu/não bateu". Etiqueta ou campo usado só dentro de um caminho também conta como "já usado" (não se exclui; arquiva).
- **A escolha do bloco** passa a vir **por grupos** (Lógica · No card · Etiquetas e campos · Avisos e integrações), cartões do mesmo tamanho, ícone num quadrado, nome e uma frase curta.

**Descartadas:** caminhos que se reencontram depois do "Se… senão" (junção — vira grafo com várias entradas por bloco; complica sem pedido); "senão" como bloco separado ligado depois do "Só se…" (o dono pediu o else **embutido** como segunda saída).
