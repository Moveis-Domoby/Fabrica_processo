---
id: D-82
aliases: [D-82, D-082]
titulo: "A foto do Tiny chega sozinha à plataforma — a da câmera fica, a apagada no Tiny também"
tipo: decisao
data: 2026-09-30
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-081 - As fotos dos produtos vem do Tiny e aparecem inteiras sem|D-81]]"]
area: [tiny-n8n]
tags: [decisao, area/tiny-n8n]
---
# D-82 · A foto do Tiny chega sozinha à plataforma — a da câmera fica, a apagada no Tiny também (30/09/2026) — ↪️ D-81

**Pedido do dono (30/09):** *"faça essa parada aí das fotos mudarem quando mudarem no Tiny"*.

**Decidido (respostas do dono em 30/09):**

- **Produto novo com foto no Tiny, ou foto principal trocada no Tiny → a plataforma copia sozinha** (reduzida e com fundo branco, como a câmera; a cópia antiga sai da biblioteca). Tempo: produto novo ~20 min (entra pelo ciclo de 15 min do catálogo); foto trocada num produto que já existe, **na manhã seguinte** — o Tiny não avisa mudança de produto, e a releitura completa do catálogo é de madrugada.
- **A foto posta pela câmera fica** (*"A da câmera fica"*): o Tiny só atualiza as fotos que vieram dele.
- **Foto apagada no Tiny: a plataforma mantém a última** (*"Mantém a última"*).
- **Só a foto principal** (a 1ª do Tiny) vira capa; as outras não são copiadas sozinhas.
- **Nada rodando à toa:** o relógio do banco confere de 5 em 5 minutos, sem custo, e só chama a função do servidor quando há foto para copiar (a lição da migration 43 — o dono não quer execução sem trabalho).
- **Construir, testar e ligar sem nova pergunta** (*"Constrói, testa e liga"*).

**Como ficou (técnico):** migration 44 — `produtos.imagem_tiny` (o link do Tiny da foto copiada; nulo = foto da câmera ou sem foto; as 144 da carga de 30/09 marcadas pelo histórico daquela carga); a câmera (`plt_fn_estoque_definir_imagem`) zera `imagem_tiny`; portas só da chave de serviço (`plt_fn_fotos_tiny_pendentes`, `plt_fn_foto_tiny_definir`, `plt_fn_foto_tiny_falhou`, `plt_fn_fotos_tiny_conferir`); relógio `plt-fotos-tiny` (pg_cron */5) → `plt_privado.fn_fotos_tiny_relogio` → Edge Function **`fotos-tiny`** (verify_jwt desligado; quem chama prova com o segredo guardado em `plt_webhooks`, conferido pelo banco). A função baixa só do armazém do Tiny, reduz com a ImageScript (≤ 1280 px, JPEG 82, fundo branco; WebP sobe como veio), grava em `produtos/{pasta}/tiny-{md5}.{ext}`, até 3 por chamada (limite de CPU). Link que falha espera 24 h (histórico `estoque_foto_tiny_falhou`). **O n8n não foi tocado** — a função lê o que o fluxo do catálogo já grava em `produtos.raw`.

**Descartadas:** ramo no fluxo único do n8n (sem redução de imagem lá e mexeria no fluxo da outra frente); função chamada de 5 em 5 min direto pelo relógio (execução à toa — o dono vetou isso na 43); gatilho na tabela `produtos` (mexeria no caminho de escrita da integração: um erro ali derrubaria o catálogo — [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 2#A-9|A-09]]); guardar a origem da foto só no nome do arquivo (as 144 de hoje não seriam reconhecidas sem renomear os arquivos).
