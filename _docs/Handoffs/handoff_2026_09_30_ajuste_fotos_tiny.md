---
titulo: Handoff — Ajuste · as fotos dos produtos vieram do Tiny e aparecem inteiras
tipo: handoff
data: 2026-09-30
atualizado: 2026-09-30
tags: [handoff, ajuste, estoque, fotos, tiny, d-81]
---

# 📋 Handoff — Fotos dos produtos do Tiny (30/09/2026)

**Branch:** `ajuste-fotos-tiny` (montada a partir da `main` sem mexer na pasta principal, onde outra sessão trabalhava)
**Banco:** nenhuma mudança de forma — só dados: a foto de 144 produtos, gravada pela porta que a câmera do Estoque já usa, com o dono logado
**Memória:** `_docs/Plataforma/Execucao/AJUSTE - Fotos dos produtos do Tiny.md` · **Decisão:** D-81 · **Aprendizado:** A-38, E-68

## 1. Objetivo

*"Coloque as imagens dos produtos de acordo com o que está no Tiny — acho que o Tiny não envia as imagens via API e eu preciso dessas imagens na plataforma por questões de design."* O dono se ofereceu para logar no Tiny e na plataforma.

**Mudança de rumo no caminho:** o Tiny **manda** as fotos — o link vem junto com o cadastro do produto, que o banco já guardava. Não foi preciso abrir o Tiny, só a plataforma. E, vendo as fotos na tela: *"a visualização da foto está ruim, ela provavelmente é em pé, porém o view dela na plataforma está deitado, ajuste isso"* — o quadro passou a mostrar a foto inteira.

## 2. O que foi feito

### Dados (banco real, com o OK do dono)
- **144 produtos ganharam foto** (146 fotos): 122 móveis e o resto insumos, kits e revenda. As fotos foram **copiadas** para a biblioteca da plataforma (a mesma da câmera do Estoque e do tablet) — não dependem do Tiny no ar.
- Subiram **reduzidas** como as da câmera (44 MB → 5,7 MB); as **18 que eram recortes com fundo transparente** ganharam fundo branco (senão ficariam pretas).
- **Cada foto ficou no histórico com o nome do dono** (subiram pela sessão dele, pela mesma porta da câmera).
- Os 2 produtos com duas fotos no Tiny (549 e 2026): a 1ª é a capa; a 2ª ficou na biblioteca do produto (aparece no tablet).
- Só recebeu foto quem estava sem. **47 móveis ativos seguem sem foto** porque o Tiny também não tem.

### Front
- `FotoProduto`: a foto aparece **inteira** (`object-contain`) sobre **fundo branco** — nunca mais cortada; sem foto, o ícone como antes.
- `CartaoProdutoEstoque`: o quadro da foto passou de **deitado** (`h-40`, 2:1) para **quadrado** (`aspect-square`) — 121 das 144 fotos são quadradas.
- `ModalProdutoEstoque` (o detalhe): a foto grande num **quadrado centralizado**.
- As miniaturas das listas (busca, Configurações, "Ver os outros produtos") também deixaram de cortar.
- `reduzirImagem` (a redução da câmera do Estoque): **fundo branco** antes de desenhar — foto recortada não sai mais com fundo preto (você pediu para corrigir junto).

## 3. Decisões tomadas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| Todas as 144 (resposta do dono) | Só os 122 móveis | O dono escolheu todas |
| Copiar para a plataforma | Mostrar o link do Tiny direto | A tela não fica refém do Tiny |
| Subir com o dono logado, pela porta da câmera | Script com chave de serviço | Nenhuma senha/chave manuseada; histórico com o nome dele |
| Fundo branco nos recortes | Manter transparente | No tema escuro o móvel "flutuaria" e móvel preto sumiria |
| Quadro quadrado + foto inteira | Quadro em pé | Em pé cortaria as deitadas e deixaria 20+ cartões altos demais; o quadrado encaixa 121 de 144 |
| Cópia automática **depois** (resposta do dono) | Fazer agora | Exige mudança no sistema — desenhar e aprovar antes |

## 4. Bugs

### Resolvidos
- A foto do produto era cortada no cartão e no detalhe (o móvel em pé virava uma faixa do meio).
- **Foto com fundo transparente virava fundo PRETO pela câmera** do Estoque (achado nesta sessão, corrigido com o seu OK). Provado na página: a mesma imagem recortada sai com o canto branco (255,255,255) e o móvel intacto; o controle sem a correção dá o canto preto (0,0,0).

### Descobertos
- Nenhum pendente.

## 5. Arquivos alterados

```
src/logistica/componentes/FotoProduto.tsx            (foto inteira sobre branco)
src/logistica/componentes/CartaoProdutoEstoque.tsx   (quadro quadrado)
src/logistica/componentes/ModalProdutoEstoque.tsx    (detalhe: quadrado centralizado)
src/lib/imagem.ts                                    (redução da câmera: fundo branco)
_docs: D-81 · A-38, E-68 · Esquema do Banco (imagem_caminho) · Modelo de Sistema (cartão e foto) ·
       execução · mapa · próximos passos · este handoff
```

## 6. Impacto nos números visíveis

Nenhum número mudou. Visual: os cartões do Estoque ficaram **mais altos** (a foto quadrada) — no celular, um cartão por tela; no tablet, dois por linha.

## 7. Notas do cofre atualizadas

- [[PLT - Decisoes de Produto]] (D-81) · [[PLT - Memoria de Aprendizado]] (A-38, E-68) · [[SUPA - Esquema do Banco]] · [[PLT - Modelo de Sistema]] · [[000 - MAPA DO PROJETO]] · [[000 - PROXIMOS PASSOS]]

## 8. Ficou pendente

### Aguardando decisão de negócio
- **Cópia automática da foto** (você pediu "automático depois"): quando entrar produto novo ou a foto mudar no Tiny, a plataforma copia sozinha. O Claude desenha e traz para aprovar.

### Próximo passo sugerido
- A logística pôr foto nos 47 móveis que o Tiny não tem (pela câmera do cartão) — ou pôr no Tiny, e a cópia automática traz.

## 9. Como validar

1. **Fábrica → Logística → Estoque**: os cartões do Top 20+ mostram a foto **inteira** (armário, sapateira e estante de pé, sem corte).
2. Toque na foto de um produto → o detalhe mostra a foto grande, inteira, num quadrado.
3. No celular e no tablet: uma coluna / duas colunas, sem rolagem para o lado.
4. Pela câmera do cartão, suba uma imagem PNG de fundo transparente num produto de teste → o fundo aparece branco (e troque de volta, se quiser).

```sql
-- 144 = 144, e nenhuma capa sem arquivo
select count(*) filter (where jsonb_array_length(raw->'anexos')>0) com_foto_no_tiny,
       count(*) filter (where jsonb_array_length(raw->'anexos')>0 and imagem_caminho is not null) com_foto_na_plataforma
from produtos;
```

**Conferido nesta sessão:** banco (144/144, 146 arquivos, 5,7 MB, 144 registros no histórico, 0 capa sem arquivo) · tela no computador, celular (375) e tablet (768) sem rolagem lateral, câmera com 44 px · console sem erro · checagem de tipos, lint e 84/84 testes.

## Ver também

[[handoff_2026_09_28_ajuste_estoque_contagem_top20]] · [[handoff_2026_09_30_estoque_sincronizado_tiny]] · [[PLT - Decisoes de Produto]]
