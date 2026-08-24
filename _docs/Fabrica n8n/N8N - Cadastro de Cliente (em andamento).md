---
titulo: n8n — Cadastro de Cliente (migração 5, EM ANDAMENTO)
tipo: workflow
status: em-andamento
atualizado: 2026-08-13
tags: [n8n, tiny, formulario, cadastro, em-andamento]
---

# 🧾 Migração 5 — Formulário → Cadastro de cliente no Tiny (EM ANDAMENTO)

> [!warning] Estado em 13/08/2026
> **Nada foi construído ainda.** A automação do Plugga continua ativa. Levantamento feito, arquitetura decidida, endpoints confirmados. **Bloqueado aguardando: o CSV da aba `Respostas ao formulário 1` salvo na pasta `Domoby`** para mapear as colunas reais antes de escrever qualquer código.

## Por que esta exige mais cuidado que as anteriores

É a primeira automação que **escreve dentro do Tiny**. Card duplicado se apaga; **cliente duplicado ou com CPF errado contamina a base do ERP** — nota fiscal, histórico e o painel de recompra da loja (que casa clientes por CPF/telefone; ver cofre da loja). E quem preenche o formulário é **o próprio cliente** → CPF torto, campo vazio e reenvio duplicado são o caso normal, não a exceção.

## O que existe no Plugga (automação `cadastro de cliente`)

- **Gatilho:** Google Sheets "Nova linha adicionada" — planilha **Dados do pedido (respostas)**, aba **Respostas ao formulário 1**, coluna gatilho `Carimbo de data/hora (A)`
- **Ação:** Olist — "Incluir ou atualizar cliente/fornecedor"
- **Mapeamento visto nos prints:** Tipo=`Cliente` · Situação=`Ativo` · Tipo de pessoa=`Física` · Nome=col B · CPF=col "CPF - Para emissão de nota fiscal" · Endereço: Rua=col D · Número=col N · Complemento=col O · Bairro=col E · CEP=col G · Cidade=col F ("Cidade/UF") · UF=col P ("Estado") · Telefone=col C · E-mail=col I (também como e-mail de NF-e) · Observações gerais=col "Alguma observação sobre seu pedido"

> [!warning] Inconsistências nos prints que o CSV precisa esclarecer
> A coluna D se chama "Endereço: Rua" mas o exemplo era `Vila São Paulo` (parece bairro?); existem col F "Cidade/UF" **e** col P "Estado" separadas. **Não mapear às cegas.**

## Arquitetura decidida

```
Google Sheets Trigger (aba de respostas, linha nova; polling por minuto)
  → Normalizar e validar (Code)
  → Tiny · contatos.pesquisa (por CPF)
  → Já existe?
      ├─ sim → Tiny · contato.alterar
      └─ não → Tiny · contato.incluir
```

Workflow **separado** do fluxo do Tiny (gatilho e ciclo de vida diferentes). O Google Sheets Trigger aqui é seguro — a aba de respostas do Forms só recebe linhas no fim, sem fórmula, sem o deslize que duplicava a PCP.

## Endpoints confirmados (API v2)

| Endpoint | Uso |
|---|---|
| `POST /api2/contatos.pesquisa.php` | busca por `cpf_cnpj` — decide incluir vs alterar |
| `POST /api2/contato.incluir.php` | payload `{contatos: [{contato: {...}}]}` |
| `POST /api2/contato.alterar.php` | identifica por `id` → `codigo` → `cpf_cnpj` (não precisa do id!) |

Campos relevantes do payload: `nome, tipo_pessoa (F/J), cpf_cnpj, endereco, numero, complemento, bairro, cep, cidade, uf, fone, email, email_nfe, situacao (A), obs, tipos_contato [{tipo: Cliente}]`.

## Blindagens planejadas no Code

| Campo | Tratamento |
|---|---|
| CPF | só dígitos + **validação real do dígito verificador** |
| CPF inválido | cadastrar **sem CPF** + aviso em `obs`: `⚠️ CPF informado não passou na validação: {valor}` — decisão aprovada pelo usuário: melhor cliente sem CPF que CPF errado |
| Nome | trim + colapso de espaços |
| CEP / telefone | só dígitos |
| Campo vazio | não enviar (em vez de string vazia) |

## Próximos passos

1. Usuário salva o CSV das respostas na pasta conectada
2. Mapear colunas reais → escrever o Code de validação
3. Montar os 5 nodes, testar com uma resposta real, publicar
4. Desativar `cadastro de cliente` no Plugga

## Ver também

[[N8N - Visao Geral da Migracao]] · [[N8N - API Tiny v2 vs v3]]
