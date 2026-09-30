---
titulo: Ajuste — Fotos dos produtos copiadas do Tiny para a plataforma (e mostradas inteiras)
tipo: execucao
data: 2026-09-30
tags: [execucao, ajuste, estoque, fotos, tiny, d-73, d-81]
---

# Ajuste — Fotos dos produtos do Tiny (30/09/2026)

**Pedido do dono (30/09):** *"coloque as imagens dos produtos de acordo com o que está no Tiny — acho que o Tiny não envia as imagens via API e eu preciso dessas imagens na plataforma por questões de design"*. No meio, vendo o resultado: *"a visualização da foto está ruim, ela provavelmente é em pé, porém o view dela na plataforma está deitado, ajuste isso"*.

**Respostas do dono (30/09):** todos os 144 produtos com foto no Tiny (não só os móveis) · copiar agora e **a cópia automática fica como próximo passo** (desenhar e trazer para aprovação).

**Numeração usada:** D-81 · A-38 · E-68 (combinada com a sessão do estoque sincronizado, que trabalhava na mesma pasta e ficou com D-76…D-80, E-69/E-70, A-39/A-40). **Branch:** `ajuste-fotos-tiny`, montada a partir da `main` por índice temporário (a pasta principal estava com outra sessão ativa — nada de checkout lá).

## Tarefas

- [x] Ler regras, memória de aprendizado, handoff do estoque (D-73), esquema do banco (`produtos.raw`, `imagem_caminho`)
- [x] Conferir se o Tiny manda as imagens → **manda**: `raw->'anexos'[].anexo` (links públicos do S3 do Tiny)
- [x] Levantar números e pedir o OK do dono (gravação em produção) → OK: todos os 144; automático depois
- [x] Montar a lista das fotos e conferir contra o banco (impressão digital idêntica)
- [x] Baixar as 146 fotos para pasta local ignorada pelo git (`.claude/fotos-tiny/`, servida pelo Vite)
- [x] Inspecionar formato/transparência (a extensão mente; 18 recortes transparentes)
- [x] Dono logou na plataforma (painel do navegador, `localhost:5173`, banco real)
- [x] 1 produto primeiro (327) → conferido no banco, no histórico e na tela
- [x] Os outros 143 → 145 fotos, 79 s, zero falha
- [x] Conferir no banco: 144/144 com foto, 146 arquivos, nenhuma capa sem arquivo, 144 registros no histórico
- [x] Apagar a cópia local
- [x] **Pedido no meio:** foto cortada no quadro deitado → medir proporções (121 quadradas, 16 em pé, 7 deitadas) → quadro quadrado + foto inteira sobre branco (cartão, detalhe, miniaturas)
- [x] Verificação da tela: 1280, celular 375 e tablet 768 (sem rolagem lateral; câmera 44px), console sem erro, tsc, lint, 84/84 testes
- [x] Cofre: D-81, A-38, E-68, esquema, modelo de sistema, mapa, próximos passos, handoff
- [x] OK do dono para publicar (*"Pode publicar"*) e para corrigir junto o fundo preto da câmera (*"Sim, corrige junto"*)
- [x] `reduzirImagem`: fundo branco antes do `drawImage` → provado na página (canto 255,255,255 com a correção; controle sem ela: 0,0,0) · tsc ✅ · eslint ✅ · 84/84 ✅
- [ ] Mesclar na `main` e publicar (Vercel) · limpar a pasta principal (compartilhada)

## O que se descobriu

- **O Tiny manda as imagens pela API.** O `produto.obter` (v2) traz `anexos: [{anexo: url}]`, e o `fn_upsert_produto` já guarda o retorno inteiro em `produtos.raw`. `imagens_externas` vem vazio em todos. A premissa do dono ("o Tiny não envia") não se confirmou — não foi preciso abrir o Tiny.
- Links `https://s3.amazonaws.com/tiny-anexos-us/erp/<conta>/<md5>.<ext>`: **públicos** (200 sem login), **sem CORS** (o navegador não baixa direto de `localhost`) → cópia local servida pelo Vite na mesma origem (`/.claude/fotos-tiny/…` — o Vite serve arquivo da raiz do projeto, e `.claude/` é ignorada pelo git).
- **Números (30/09):** 492 produtos no catálogo; **144 com foto no Tiny, 146 fotos** (2 produtos com 2 fotos: SKU 549 e 2026); 5 sem SKU (pasta `produtos/tiny-{id}`, caminho que o app já usa); nenhum SKU repetido entre eles; 139 ativos. Por classe: fabricados 121 ativos + 1 inativo · matéria-prima 11 · kits 2 · simples 4 ativos + 4 inativos · variação 1. **47 fabricados ativos sem foto no Tiny.** Nenhum produto tinha foto na plataforma antes.
- **A extensão do Tiny mente:** 91 arquivos `.jpeg` são PNG por dentro; 3 `.png` são JPEG; 1 `.jpg` é WebP. **95 PNG com canal alfa, mas só 18 com transparência real** (>1% de pixels com alfa < 250, medido no navegador). 13 fotos acima de 1280 px (maior 2000 px); maior arquivo 1,7 MB; total 44 MB.
- **Transparência vira PRETO na redução do app:** `reduzirImagem` desenhava no canvas e exportava JPEG sem pintar o fundo — PNG recortado subido pela câmera do Estoque ficava com fundo preto. Nesta carga: fundo **branco** antes de desenhar; e, com o OK do dono, a própria `reduzirImagem` foi corrigida igual.
- **Proporção das 144 capas (medida depois da carga):** 121 quadradas, 16 em pé, 7 deitadas; razão largura/altura de 0,56 a 2,26, mediana 1,00. O quadro do cartão era `h-40` com `object-cover` (322×160 na tela do dono — 2:1 deitado): mostrava só a faixa do meio de um móvel em pé (a sapateira aparecia como parede).

## Decisões técnicas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| Copiar a foto para o bucket `plt-imagens` (pasta do produto) | Mostrar o link do Tiny direto | A tela não depende do Tiny no ar; mesmo caminho da câmera e do tablet (D-73/D-28) |
| Subir pelo cliente do app com o dono logado (`enviarFotoProduto` → `plt_fn_estoque_definir_imagem`) | Script com a chave de serviço / Edge Function | Nenhuma credencial manuseada; cada foto registrada no histórico com o nome do dono (D-40); zero código novo em produção |
| 1ª foto = capa; 2ª foto vai só para a biblioteca do produto (tablet), via `enviarImagemProduto` | Descartar a 2ª | Nada do Tiny se perde |
| Redução igual à do app (lado ≤ 1280, JPEG 0,82; original só se já for JPEG, ≤ 1280 e menor) + fundo branco | Subir o original | Mesmo padrão das fotos da câmera; leve para a rede do galpão (44 → 5,7 MB); formato conferido pelos bytes, não pela extensão |
| Só preenche quem está sem foto | Sobrescrever | Não apagar foto que a logística venha a pôr |
| Lista das fotos conferida por impressão digital (md5 da lista inteira no banco × no arquivo) | Conferir no olho | Os 146 endereços foram transcritos; A-14 garante que nenhum saiu errado |
| Quadro **quadrado** (`aspect-square`) + `object-contain` sobre `bg-white` no `FotoProduto` | Quadro em pé; manter `cover` e só aumentar | 121/144 quadradas encaixam sem sobra; em pé e deitadas aparecem inteiras; sobra branca = fundo das fotos; em pé cortaria as deitadas e alongaria 20+ cartões |
| Detalhe: quadrado centralizado `mx-auto aspect-square w-full max-w-sm sm:max-w-md` | Faixa larga `h-64 sm:h-80` com contain | Na faixa larga a foto quadrada ficaria pequena no meio de muito branco |
| Sem foto: ícone continua em `superficie-sutil` (o branco só quando há foto) | Branco sempre | O vazio não deve parecer uma foto branca |
| Branch montada por índice temporário (`GIT_INDEX_FILE` + `commit-tree`) a partir da `main`; edições do cofre refeitas sobre a `main` nova com `patch` | Checkout de branch na pasta principal | Outra sessão ativa na pasta (e o dono não quer worktree nova); a `main` andou no meio (a sessão do estoque mesclou) — o `patch` aplicou sem rejeito |

## Comandos / passos

1. Leitura no banco (só leitura): contagem por classe de `raw->'anexos'`, chaves do `raw`, formato dos anexos, lista das pendentes (`imagem_caminho is null`).
2. `manifesto.txt` (tiny_id;sku;ordem;arquivo) → md5 `a7bfff927b1b70ed6eb964919f265f8a` idêntico no Node e no banco (146 linhas).
3. `node baixar.mjs` (scratchpad) → 146/146 baixadas em `.claude/fotos-tiny/` (ignorada pelo git).
4. Preview `plataforma` (5173) — Vite serve `/.claude/fotos-tiny/*` na mesma origem (conferido: 200, 18.331 bytes).
5. Inspeção por bytes (`inspecionar.mjs`) e transparência real no navegador (canvas 256px, alfa < 250).
6. Dono logado → `import('/src/logistica/api.ts')` + `import('/src/tablet/api.ts')` no console da página do Vite (A-34) → 327 primeiro → `produtos/327/capa-…jpg` (8 KB), conferido no banco (capa, 1 arquivo na pasta, registro no histórico) e na tela.
7. Os 143 restantes em laço sequencial dentro da página (estado em `window`) → 79 s, 0 falha; 126 reduzidas, 17 originais; 549 e 2026 com a 2ª foto na biblioteca.
8. Conferência final no banco: 144 com foto no Tiny = 144 com foto na plataforma; 0 foto sem Tiny; 0 capa sem arquivo; 146 arquivos em `produtos/`, 5,7 MB; 144 produtos com o registro `estoque_foto_definida` desta carga.
9. `rm -r .claude/fotos-tiny`.
10. Proporções das 144 capas medidas no navegador (URL pública do bucket) → quadro quadrado.
11. `FotoProduto.tsx` (contain + branco quando há foto), `CartaoProdutoEstoque.tsx` (`aspect-square`), `ModalProdutoEstoque.tsx` (quadrado centralizado). Conferido: 1280 (armário, sapateira, estante 15 nichos e o balcão recortado inteiros), 375 (foto 342×342, sem rolagem lateral, câmera 44×44), 768 (345×345, 2 colunas), console sem erro. `tsc` ✅ · `eslint` ✅ · `vitest` 84/84 ✅ · prettier: os 3 arquivos já estavam fora do padrão na `main`; só as linhas mexidas foram formatadas.
12. Branch `ajuste-fotos-tiny` montada por índice temporário a partir da `main` 2f441f4 (a sessão do estoque mesclou no meio; as edições do cofre, feitas sobre a d958705, foram reaplicadas com `patch` sem rejeito). Autor `contatodomoby` (E-33).
13. OK do dono → `src/lib/imagem.ts`: `fillRect` branco antes do `drawImage`. Prova na página, sem gravar nada: PNG 1600² transparente com ruído → JPEG 1280², 2.143 → 147 KB, canto (255,255,255), meio intacto; controle sem o fundo: canto (0,0,0).

## Erros e acertos (registrados na memória de aprendizado)

- **E-68:** naveguei a aba no meio da carga e perdi o estado da página; `decode()` de imagem preguiçosa travou o script.
- **A-38:** o Tiny manda a foto (e ela já estava no `raw`); a extensão mente; transparente vira preto; medir a proporção antes de escolher o quadro.
