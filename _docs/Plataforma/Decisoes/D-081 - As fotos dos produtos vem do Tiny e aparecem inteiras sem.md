---
id: D-81
aliases: [D-81, D-081]
titulo: "As fotos dos produtos vêm do Tiny e aparecem inteiras, sem corte"
tipo: decisao
data: 2026-09-30
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-073 - Foto de cada produto no estoque so a logistica e o admin|D-73]]"]
area: [estoque, tiny-n8n]
tags: [decisao, area/estoque, area/tiny-n8n]
---
# D-81 · As fotos dos produtos vêm do Tiny e aparecem inteiras, sem corte (30/09/2026) — ↪️ D-73

**Pedido do dono (30/09):** *"coloque as imagens dos produtos de acordo com o que está no Tiny… eu preciso dessas imagens na plataforma por questões de design"*; e, vendo o resultado: *"a visualização da foto está ruim, ela provavelmente é em pé, porém o view dela na plataforma está deitado, ajuste isso"*.

**Decidido (respostas do dono em 30/09):**

- **Todas as fotos do Tiny entram** (*"Todos os 144"*): móveis, insumos, kits e revenda. Feito em 30/09: 144 produtos, 146 fotos, copiadas para a biblioteca da plataforma (a foto não depende do Tiny no ar), registradas no histórico com o nome do dono. Só preencheu quem estava sem foto; 47 móveis ativos seguem sem foto porque o Tiny não tem.
- **Daqui para frente, cópia automática** (*"Quero automático depois"*): quando o produto entrar ou mudar a foto no Tiny, a plataforma copia sozinha — **próximo passo, a desenhar e aprovar** (não feito ainda). Até lá, produto novo ganha foto pela câmera do Estoque ou por uma nova cópia pedida ao Claude.
- **A foto aparece inteira, nunca cortada:** o quadro do cartão virou **quadrado** (121 das 144 fotos são quadradas; 16 em pé, 7 deitadas) e a foto se encaixa nele; a sobra fica **branca** (o fundo das fotos do catálogo), em qualquer tema. No detalhe do produto, a foto grande num quadrado centralizado. As miniaturas das listas também deixaram de cortar.
- **Foto recortada (fundo transparente) sobe com fundo branco** também pela câmera do Estoque (*"Sim, corrige junto"*) — antes saía com fundo preto.

**Como ficou (técnico):** nenhuma mudança no banco. O Tiny manda o link público da foto em `produtos.raw->'anexos'` (o `produto.obter` que o n8n já grava); a carga subiu pelo cliente do app com o dono logado (`enviarFotoProduto` → `plt_fn_estoque_definir_imagem`), redução igual à do app (lado ≤ 1280 px, JPEG 0,82) com **fundo branco** nas 18 fotos recortadas (transparentes). `FotoProduto` passou a `object-contain` sobre branco; o cartão, `aspect-square`; `reduzirImagem` pinta o fundo de branco antes de desenhar.

**Descartadas:** mostrar o link do Tiny direto (a tela dependeria do Tiny no ar); quadro em pé (cortaria as deitadas e deixaria o cartão alto demais para 20+ cartões); manter o corte e só aumentar o quadro (continuaria cortando as em pé).
