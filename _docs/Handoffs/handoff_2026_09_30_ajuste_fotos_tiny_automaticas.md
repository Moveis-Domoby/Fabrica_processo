---
titulo: Handoff — Ajuste · a foto do Tiny chega sozinha à plataforma
tipo: handoff
data: 2026-09-30
atualizado: 2026-09-30
tags: [handoff, ajuste, estoque, fotos, tiny, d-82]
---

# 📋 Handoff — Fotos do Tiny automáticas (30/09/2026)

**Branch:** `ajuste-fotos-tiny-auto` (montada fora da pasta principal, onde outra sessão trabalhava) — **mesclada na `main` em 30/09** (D-20; você pediu "constrói, testa e liga")
**Banco:** migration **44** aplicada em 30/09, **sozinha**; integração do Tiny idêntica antes/depois (`e2109f3a…`)
**Servidor:** função nova **`fotos-tiny`** publicada · relógio **`plt-fotos-tiny`** ligado
**Memória:** `_docs/Plataforma/Execucao/AJUSTE - Fotos do Tiny automaticas.md` · **Decisão:** D-82 · **Requisito:** RF-109 · **Aprendizado:** A-41, E-72

## 1. Objetivo

*"Faça essa parada aí das fotos mudarem quando mudarem no Tiny."* — o próximo passo que você pediu depois da cópia das 144 fotos ([[handoff_2026_09_30_ajuste_fotos_tiny]]).

Suas respostas: **a foto da câmera fica** (o Tiny não a troca) · **foto apagada no Tiny: fica a última** · **"Constrói, testa e liga"**.

## 2. O que foi feito

### Como funciona agora
- **Produto novo com foto no Tiny** → a foto aparece na plataforma em **~20 minutos**.
- **Foto principal trocada no Tiny** num produto que já existe → troca na plataforma **na manhã seguinte** (o Tiny não avisa mudança de produto; a releitura completa do catálogo é de madrugada).
- A foto chega **reduzida e com fundo branco**, como a da câmera; a cópia antiga sai da biblioteca (o tablet não mostra duas).
- **Foto posta pela câmera nunca é trocada.** Foto apagada no Tiny: a plataforma **mantém a última**.
- Cada cópia fica no **histórico como feita pelo sistema**. Se o Tiny falhar ao entregar uma foto, fica registrado e ele tenta de novo no dia seguinte.
- **Nada rodando à toa:** o banco confere de 5 em 5 minutos (uma conta interna de 0,08 s) e **só chama a função quando há foto nova** — sem foto nova, nenhuma chamada.
- **O fluxo do n8n não foi tocado.**

### Banco (migration 44)
- `produtos.imagem_tiny` — de onde veio a foto (o link do Tiny); vazio = foto da câmera. As **144 de hoje** já nasceram marcadas como do Tiny.
- A câmera (`plt_fn_estoque_definir_imagem`) passa a marcar a foto como "da câmera".
- Portas só da chave de serviço: o que falta copiar, gravar a cópia, registrar a falha, conferir o segredo.
- Endereço da função + segredo (gerado no próprio banco) nos webhooks de saída; relógio `plt-fotos-tiny`.

### Servidor
- Edge Function **`fotos-tiny`**: baixa só do armazém de fotos do Tiny, reduz (até 1280 px, fundo branco), grava na pasta do produto e apaga a cópia antiga; até 3 fotos por chamada. Só aceita quem traz o segredo (quem confere é o banco).

## 3. Decisões tomadas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| A cópia mora no banco + função do servidor | Um ramo no fluxo do n8n | O fluxo é da outra frente e o n8n não reduz imagem |
| O banco só chama a função quando há foto nova | Chamar de 5 em 5 minutos sempre | Você não quer nada rodando à toa (mesma regra do fluxo do estoque) |
| Só a foto principal (a 1ª do Tiny) | Copiar todas | É a que aparece no cartão; as outras ficariam só no tablet |
| Anotação de origem da foto no produto | Deduzir pelo nome do arquivo | As 144 de hoje não seriam reconhecidas sem renomear os arquivos |
| Segredo gerado e conferido pelo banco | Chave no relógio | Nenhuma chave passa por chat, arquivo ou código |

## 4. Bugs

### Resolvidos
- Nenhum bug antigo.

### Descobertos
- Nenhum pendente. (No caminho, um erro meu na mudança do banco foi pego pelos testes antes de chegar perto de produção — E-72.)

## 5. Arquivos alterados

```
supabase/migrations/20260930170000_plt_fotos_tiny_automaticas.sql   (nova — migration 44, aplicada)
supabase/functions/fotos-tiny/index.ts                              (nova — Edge Function publicada)
supabase/testes/testar-migrations.mjs                               (bloco "Fotos do Tiny", 23 verificações)
_docs: D-82 · RF-109 · A-41, E-72 · Esquema do Banco · nota do n8n (fotos não passam por ele) ·
       execução · mapa · próximos passos · este handoff
```

## 6. Impacto nos números visíveis

Nenhum número mudou. Visual: nenhum — as fotos continuam as mesmas; daqui para frente elas acompanham o Tiny.

## 7. Notas do cofre atualizadas

- [[PLT - Decisoes de Produto]] (D-82) · [[PLT - Requisitos]] (RF-109) · [[PLT - Memoria de Aprendizado]] (A-41, E-72) · [[SUPA - Esquema do Banco]] · [[N8N - Tiny Fabrica Produtos para Banco]] · [[000 - MAPA DO PROJETO]] · [[000 - PROXIMOS PASSOS]]

## 8. Ficou pendente

### Aguardando decisão de negócio
- Nada.

### Próximo passo sugerido
- Se quiser a foto trocada no Tiny aparecendo **no mesmo dia** (e não na manhã seguinte), a releitura do catálogo no n8n pode rodar mais vezes por dia — é mexer no fluxo da outra frente; fica para quando você quiser.
- Os **47 móveis sem foto** no Tiny: pôr a foto no Tiny (chega sozinha) ou pela câmera do Estoque.

## 9. Como validar

1. No Tiny da fábrica, ponha uma foto num produto que **não tem foto** (ou cadastre um produto novo com foto).
2. Em até ~20 minutos (produto novo) ou na manhã seguinte (produto que já existia), abra **Fábrica → Logística → Estoque** e procure o produto: a foto aparece inteira, com fundo branco.
3. Ponha uma foto pela **câmera** num produto e troque a foto dele no Tiny: a da câmera continua.

```sql
-- fotos que ainda faltam copiar (0 = tudo em dia)
select count(*) from public.plt_fn_fotos_tiny_pendentes(20);
-- últimas cópias automáticas
select criado_em, contexto ->> 'sku' as sku, contexto ->> 'caminho' as foto
  from public.plt_logs_atividade where acao = 'estoque_foto_tiny' order by criado_em desc limit 10;
```

**Conferido nesta sessão:** testes do banco (586 verificações, 23 novas; teste de mutação) · aplicação só da 44 com a integração idêntica · 144 marcadas = 144 iguais ao Tiny, 0 pendentes · permissões (portas só do servidor; câmera para quem está logado) · função barra quem não tem o segredo (401) · **ponta a ponta em 3 produtos** (recorte transparente → fundo branco, 19 KB; foto de 1,7 MB → 131 KB; WebP como veio; cópia antiga apagada; histórico como sistema) · relógio sem chamar nada quando não há foto nova · alertas do Supabase: nada novo.

## Ver também

[[handoff_2026_09_30_ajuste_fotos_tiny]] · [[handoff_2026_09_30_estoque_sincronizado_tiny]] · [[PLT - Decisoes de Produto]]
