---
id: D-337
aliases: [D-337]
titulo: "Uma nota por decisão, com nome em português; a citação vira ligação com apelido; número pulado não ganha nota"
tipo: decisao
data: 2026-11-18
status: provisoria
revisa: []
revisada_por: []
complementa: ["[[D-336 - A leitura por camadas obrigatoria ate 40 KB o mapa da area|D-336]]"]
area: [processo]
tags: [decisao, area/processo, provisoria]
---
# D-337 · ⏳ PROVISÓRIA — Uma nota por decisão, com nome em português; a citação vira ligação com apelido; número pulado não ganha nota (18/11/2026, SESSAO-49) — ↪️ D-336

1. **O nome da nota** é `D-NNN - o que a decisão faz` (três dígitos, sem acento) — é o que aparece no grafo e na lista de arquivos do Obsidian, em português.
2. **A citação é uma ligação com apelido:** o leitor vê o id curto e o Obsidian abre a nota. O `aliases` do frontmatter **não** serve de destino de ligação (só ajuda a busca e o completar) — por isso a ligação leva o nome do arquivo. O verificador escreve as ligações sozinho (`--ligar`), a primeira de cada id em cada seção.
3. **O texto da decisão é o original**, sem reescrever; o título original vira o primeiro título da nota.
4. **Estado no frontmatter:** `vigente`, `provisoria` (a que espera o dono — vale até ele dizer o contrário), `revisada` (outra decisão a revisou) ou `substituida`. As relações "revisa" e "revisada por" valem dos dois lados.
5. **Área:** uma ou duas, das quinze áreas dos mapas. Na migração foi dada por palavra-chave e conferida à mão em 80 decisões; pode ser corrigida no frontmatter a qualquer hora (o índice e os mapas se refazem).
6. **Número pulado não ganha nota:** os números reservados por sessões em paralelo e nunca usados (entre eles o 44 e o 64) não têm texto em lugar nenhum; criar a nota seria inventar decisão. O índice lista os números sem decisão.
7. **As lições** seguem a mesma ideia por tema: o id é o título dentro da nota do tema, e a citação aponta para ele. Na migração o tema foi dado por palavra-chave (a manchete pesando mais); lição no tema errado pode ser movida de nota — o índice se refaz.

**Por que provisória:** a demanda pedia a nota de decisão com nome longo e supunha que o apelido abriria a ligação; a forma que funciona foi escolha da sessão.
