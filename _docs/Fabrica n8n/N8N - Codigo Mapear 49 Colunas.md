---
titulo: n8n — Código do node "Mapear 49 colunas"
tipo: codigo
atualizado: 2026-08-13
tags: [n8n, codigo, tiny, google-sheets]
---

# 🧩 Código — node "Mapear 49 colunas"

> [!abstract] Contexto
> Code node do workflow [[N8N - Workflow Tiny para Planilha]]. Mode: **Run Once for All Items**. Recebe `retorno.pedido` de `pedido.obter.php` e devolve as 49 colunas na ordem exata do cabeçalho da aba COMPLETO. Verificado célula a célula contra 1.982 pedidos reais.

```js
// ============================================================================
// DOMOBY - Tiny (Olist) -> Google Sheets "COMPLETO"
// ============================================================================

// --- tabelas de tradução -----------------------------------------------------
const SITUACOES = {
  aberto: 'Em aberto',
  aprovado: 'Aprovado',
  preparando_envio: 'Preparando envio',
  faturado: 'Faturado',
  pronto_envio: 'Pronto para envio',
  enviado: 'Enviado',
  entregue: 'Entregue',
  nao_entregue: 'Não entregue',
  cancelado: 'Cancelado',
};

const FORMAS_PGTO = {
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  boleto: 'Boleto',
  multiplas: 'Múltiplas',
};

// --- helpers -----------------------------------------------------------------
const txt = (v) => (v === null || v === undefined ? '' : String(v));

// 2 casas decimais, ponto como separador (padrão do Plugga)
const dec2 = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n.toFixed(2) : '';
};

// quantidade sem casas decimais ("1.00" -> "1", "2.50" -> "2.5")
const qtdInt = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return '';
  return String(Number.isInteger(n) ? n : n);
};

// número puro para as colunas que hoje chegam numéricas na planilha
const numOuVazio = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : '';
};

// Blindagem contra o auto-parse do Google Sheets.
// Com valueInputOption=USER_ENTERED o apóstrofo inicial força texto literal e
// NÃO é gravado no valor da célula.
const texto = (v) => {
  const s = txt(v);
  return s === '' ? '' : "'" + s;
};

// normaliza array que o Tiny devolve como objeto único quando há 1 elemento
const lista = (v) => (Array.isArray(v) ? v : v ? [v] : []);

// --- corpo -------------------------------------------------------------------
const saida = [];

for (const entrada of $input.all()) {
  const p = entrada.json?.retorno?.pedido ?? entrada.json?.pedido ?? entrada.json;
  if (!p || !p.numero) continue;

  const cli = p.cliente || {};
  const ent = p.endereco_entrega || {};

  const itens = lista(p.itens).map((x) => x.item || x);
  const parcelas = lista(p.parcelas).map((x) => x.parcela || x);
  const marcadores = lista(p.marcadores).map((x) => x.marcador || x);

  // ---- colunas derivadas dos itens ----
  const sku = itens.map((i) => txt(i.codigo)).join(', ');

  const listaItens = itens
    .map((i) =>
      [
        `Produto: ${txt(i.id_produto)}`,
        `Código: ${txt(i.codigo)}`,
        `Descrição: ${txt(i.descricao)}`,
        `Unidade: ${txt(i.unidade)}`,
        `Quantidade: ${dec2(i.quantidade)}`,
        `Valor unitário: ${dec2(i.valor_unitario)}`,
      ].join(', ')
    )
    .join(' / ');

  const quantProdutos = itens.map((i) => qtdInt(i.quantidade)).join(', ');
  const resumoItens = itens
    .map((i) => `${txt(i.descricao)} - ${qtdInt(i.quantidade)}`)
    .join(', ');
  const valorPorProduto = itens.map((i) => dec2(i.valor_unitario)).join(', ');

  // ---- parcelas ----
  const parcelasTxt = parcelas
    .map((c) =>
      [
        `Dias de vencimento: ${txt(c.dias)}`,
        `Vencimento: ${txt(c.data)}`,
        `Valor: ${dec2(c.valor)}`,
        `Obs: ${txt(c.obs)}`,
        // o Plugga grava a string literal "null" quando o campo vem nulo
        `Forma de pagamento: ${c.forma_pagamento ?? 'null'}`,
        `Meio de pagamento: ${c.meio_pagamento ?? 'null'}`,
      ].join(', ')
    )
    .join(' / ');

  // ---- forma de pagamento ----
  // O Tiny já manda "multiplas" no nível do pedido quando as formas divergem.
  // Fallback: derivar das parcelas.
  let formaPgto;
  const bruta = txt(p.forma_pagamento);
  if (bruta) {
    formaPgto = FORMAS_PGTO[bruta.toLowerCase()] ?? bruta;
  } else {
    const distintas = [...new Set(parcelas.map((c) => txt(c.forma_pagamento)).filter(Boolean))];
    if (distintas.length > 1) formaPgto = 'Múltiplas';
    else if (distintas.length === 1) formaPgto = FORMAS_PGTO[distintas[0].toLowerCase()] ?? distintas[0];
    else formaPgto = '';
  }

  // ---- linha final: 49 colunas, na ordem exata do cabeçalho ----
  saida.push({
    json: {
      'DATA': txt(p.data_pedido),
      'PREVISÃO': txt(p.data_prevista),
      'PEDIDO tiny': numOuVazio(p.numero),
      'PEDIDO ecommerce': '',
      'PEDIDO no e-commerce': '',
      'NOME': txt(cli.nome),
      'SKU': texto(sku),
      'LISTA DE ITENS DO PEDIDO': texto(listaItens),
      'QUANT. PRODUTOS': texto(quantProdutos),
      'RESUMO DOS ITENS': texto(resumoItens),
      'PRODUTO 3': '',
      'MARCADORES': texto(marcadores.map((m) => txt(m.descricao)).join(', ')),
      'ENDEREÇO': txt(cli.endereco),
      'NÚMERO': texto(cli.numero),
      'BAIRRO': txt(cli.bairro),
      'CIDADE': txt(cli.cidade),
      'UF': txt(cli.uf),
      'COMPLEMENTO': texto(cli.complemento),
      'CEP': texto(cli.cep),
      'CPF/CNPJ': texto(cli.cpf_cnpj),
      'RG': '',
      'E-MAIL': txt(cli.email),
      'TELEFONE': texto(cli.fone),
      'OBS': texto(p.obs),
      'OBS INTERNA': texto(p.obs_interna),
      // entrega: sem fallback para o endereço do cliente — o Plugga deixa vazio
      'ENDEREÇO (entrega)': txt(ent.endereco),
      'NÚMERO (entrega)': texto(ent.numero),
      'BAIRRO (entrega)': txt(ent.bairro),
      'CIDADE (entrega)': txt(ent.cidade),
      'UF (entrega)': txt(ent.uf),
      'CEP (entrega)': texto(ent.cep),
      'COMPLEMENTO (entrega)': texto(ent.complemento),
      'NOME (entrega)': txt(ent.nome_destinatario),
      'CPF/CNPJ (entrega)': '',
      'TELEFONE (entrega)': '',
      'SITUAÇÃO': SITUACOES[txt(p.situacao).toLowerCase()] ?? txt(p.situacao),
      'FRETE': texto(dec2(p.valor_frete)),
      'MEIO DE PAGAMENTO': txt(p.meio_pagamento),
      'FORMA DE PAGAMENTO': formaPgto,
      'PARCELAS': texto(parcelasTxt),
      'QTD PARCELAS': numOuVazio(parcelas.length),
      'FORMA DE ENVIO': txt(p.forma_envio),
      'VALOR P/PRODUTO': texto(valorPorProduto),
      'TOTAL': numOuVazio(p.total_pedido),       // líquido
      'TOTAL 2': numOuVazio(p.total_pedido),     // duplicata exata de TOTAL
      'VALOR TOTAL': texto(dec2(p.total_produtos)), // bruto dos produtos
      'URL DE RASTREAMENTO': txt(p.url_rastreamento),
      'CÓD. RASTREAMENTO': txt(p.codigo_rastreamento),
      'VENDEDOR': txt(p.nome_vendedor),
    },
  });
}

return saida;
```

> [!note] Formatos replicados do Plugga
> - **LISTA DE ITENS**: blocos `Produto: … Valor unitário: …` juntados por ` / `
> - **PARCELAS**: idem; campo nulo grava a string literal `null`
> - **RESUMO DOS ITENS**: `{descrição} - {qtd inteira}`, juntados por `, `
> - Decimais com ponto, dinheiro com 2 casas, datas dd/mm/yyyy
> - Formas de pagamento customizadas (`CARTÃO - JAMAD - 10X`, `Vale/Carteira`, `Permuta`, `Pix - terceiros`) passam sem tradução

## Ver também

[[N8N - Workflow Tiny para Planilha]]
