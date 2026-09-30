---
titulo: Ajuste — A foto do Tiny chega sozinha à plataforma
tipo: execucao
data: 2026-09-30
tags: [execucao, ajuste, estoque, fotos, tiny, d-82]
---

# Ajuste — Fotos do Tiny automáticas (30/09/2026)

**Pedido do dono (30/09):** *"faça essa parada aí das fotos mudarem quando mudarem no Tiny"* — o próximo passo que ele pediu na cópia manual ([[AJUSTE - Fotos dos produtos do Tiny]], D-81).

**Respostas do dono (30/09):** a foto da **câmera fica** (o Tiny não a troca) · foto **apagada no Tiny: mantém a última** · **"Constrói, testa e liga"** (aplicar e publicar se os testes passarem, sem nova pergunta).

**Numeração:** migration **44** · D-82 · A-41 · E-72 · RF-109 (reservados por mensagem às sessões "Ajuste Estoque 2" e "Sincronização estoque"; a 43 já era da sincronização). **Branch:** `ajuste-fotos-tiny-auto`, montada fora da pasta principal (cópia da `main` por `git archive` no scratchpad + junção do `node_modules`; commit por índice temporário) — a pasta principal estava com a sessão "Ajuste Estoque 2" ativa.

## Tarefas

- [x] Ler: nota do fluxo do Tiny da fábrica (não há webhook de produto; novos a cada 15 min, alterações na varredura das 03:15), handoff do estoque sincronizado, a migration 43 (o dono vetou execução à toa: "o banco chama só quando há trabalho")
- [x] Levantar no banco real (só leitura): gatilhos em `produtos` (nenhum), a regra do backfill (casa as 144), índice do histórico (`acao, criado_em`), extensões (pg_net, pg_cron, pgcrypto, vault), webhooks de saída, `fn_upsert_produto` não toca `imagem_*`
- [x] Medir a redução no servidor: ImageScript no Node — ≤ 150 ms de CPU por foto (1024 px PNG 1,7 MB → 131 KB); WebP não lê
- [x] Plano ao dono (3 perguntas) → respostas acima
- [x] Migration 44 + bloco do harness (23 verificações) → **586 verdes**; teste de mutação (tirar "a câmera vence" → 2 vermelhos)
- [x] Edge Function `fotos-tiny`
- [x] Avisar as sessões → aplicar a 44 sozinha (`--so`) → integração idêntica
- [x] Conferir no banco real (coluna, 144 marcadas, 0 pendentes, endereço/segredo, relógio, permissões)
- [x] Publicar a função (verify_jwt desligado, autenticação própria) → código publicado conferido
- [x] 401 sem segredo / segredo errado; 405 no GET
- [x] Ponta a ponta em 3 produtos (recorte transparente, WebP, 1,7 MB)
- [x] Relógio na volta das 04:40 UTC: 76 ms, sem chamar a função
- [x] Advisors: nada novo
- [x] Cofre: D-82, RF-109, A-41, E-72, esquema, nota do n8n, execução, handoff, mapa, próximos passos
- [x] Mesclar na `main` (push `ajuste-fotos-tiny-auto:main`)

## Desenho

```
Tiny ──(n8n: catálogo a cada 15 min + varredura 03:15)──► produtos.raw->'anexos'   (nada novo no n8n)
pg_cron plt-fotos-tiny (*/5, SQL interno)
   └► plt_privado.fn_fotos_tiny_relogio(): há pendência? ── não ─► 'nada_a_fazer' (nenhuma chamada)
                                                      └─ sim ─► net.http_post(fotos-tiny, X-Segredo)
Edge Function fotos-tiny
   ├► plt_fn_fotos_tiny_conferir(segredo)  → 401 se não confere
   ├► plt_fn_fotos_tiny_pendentes(3)
   └► por produto: baixa (só s3 tiny-anexos) → reduz (≤1280, JPEG 82, fundo branco; WebP como veio)
        → storage plt-imagens/produtos/{pasta}/tiny-{md5}.{ext} (upsert)
        → plt_fn_foto_tiny_definir → {gravou, atual, anterior}
        → apaga a cópia antiga do Tiny / o arquivo que não gravou
        → erro: plt_fn_foto_tiny_falhou (o link espera 24 h)
```

**A regra de "falta copiar"** (num lugar só, no banco): tem foto no Tiny (1º anexo, do armazém do Tiny) E (`imagem_caminho` nulo OU (`imagem_tiny` não nulo E diferente do link atual)) E o link não falhou nas últimas 24 h. Câmera: `imagem_tiny` nulo → nunca entra. Tiny sem foto → nunca entra (fica a última).

## Decisões técnicas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| Banco + Edge Function | Ramo no fluxo único do n8n | O n8n é da outra frente e não reduz imagem; a função reduz (ImageScript) e mora ao lado do storage |
| Relógio interno que só chama com pendência | Função chamada de 5 em 5 min pelo cron | O dono vetou execução à toa (migration 43) |
| Coluna `imagem_tiny` | Origem no nome do arquivo (`tiny-…`) | As 144 de hoje (`capa-…`) não seriam reconhecidas sem renomear os arquivos; a coluna é 1 texto |
| Backfill pelo histórico da carga (03:35–03:45 UTC de 30/09, caminho igual ao registrado) | Marcar todas as fotos existentes | Uma foto trocada pela câmera depois não casa (caminho diferente) — reaplicar nunca desfaz escolha de ninguém |
| Segredo gerado no banco, conferido pelo banco | Chave anônima no cron (padrão do Comercial) / HMAC | Nenhuma chave no repo nem no chat; o PGlite não tem pgcrypto (HMAC não testaria); troca/desliga pelo `plt_webhooks` |
| Arquivo `tiny-{md5 do Tiny}` com upsert | `capa-{timestamp}` | O mesmo link dá o mesmo arquivo: chamada repetida não duplica |
| Até 3 por chamada | Tudo numa chamada | Teto de 2 s de CPU por chamada da Edge Function |
| Falha espera 24 h (pelo histórico) | Coluna de tentativas | Zero coluna; índice `acao, criado_em` já existe |

## Comandos / passos

1. Cópia isolada: `git archive origin/main | tar -x` no scratchpad + `.env.local` copiado (nada exibido) + junção do `node_modules`.
2. `node supabase/testes/testar-migrations.mjs` → 1ª rodada quebrou (E-72: `cron.job` planejado na mesma condição) → IFs aninhados → **586 ✔**. Mutação: sem `imagem_tiny = null` na câmera → 2 ✘; arquivo restaurado (md5 igual).
3. `node supabase/aplicar-migrations.mjs --confirmar --so 20260930170000_plt_fotos_tiny_automaticas.sql` → integração idêntica (`e2109f3a…`, 65 colunas).
4. Deploy `fotos-tiny` (MCP, verify_jwt=false) → conteúdo conferido com `get_edge_function`.
5. `curl` sem segredo → 401; segredo errado → 401; GET → 405.
6. Ponta a ponta: `update produtos set imagem_tiny = imagem_tiny || '#teste-30-09'` em 1399, 566 e 146 → `select plt_privado.fn_fotos_tiny_relogio()` → `chamado` → resposta 200: 3 gravados (1399: PNG 1,7 MB → JPEG 131 KB; 566: recorte → JPEG 19 KB fundo branco — conferido na imagem; 146: WebP 3 KB como veio); cópias `capa-…` antigas fora (400 no link público); 1 arquivo por pasta; histórico `estoque_foto_tiny` com usuário nulo; 0 pendentes; 0 falhas.
7. Relógio 04:40 UTC: `succeeded`, 76 ms, nenhuma resposta nova da função.
8. `get_advisors security`: só o WARN conhecido da câmera (`plt_fn_estoque_definir_imagem` para `authenticated`, de propósito).
