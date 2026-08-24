---
titulo: Protocolo de Trabalho
tipo: processo
atualizado: 2026-08-06
tags: [processo, protocolo, memoria]
---

# 🤝 Protocolo de Trabalho

> [!abstract] O combinado
> Este cofre é a memória de longo prazo do projeto. Cada conversa nova com a IA **começa do zero** — o que faz a memória funcionar é o arquivo `CLAUDE.md` na raiz do projeto, que é lido automaticamente e contém as regras abaixo.

## Onde fica o quê

```
Planilha de recompra/
├── CLAUDE.md              ← instruções permanentes, lidas toda sessão
└── Obsidian/
    └── CLAUDE/            ← este cofre (a memória)
        ├── 000 - MAPA DO PROJETO      ← comece sempre por aqui
        ├── Modelos Mentais/
        ├── Banco de Dados/
        ├── Integracoes/
        ├── Telas/
        ├── Debito Tecnico/
        ├── Templates/
        └── Handoffs/
```

O `CLAUDE.md` é curto e operacional — só as regras. **O conteúdo mora aqui no cofre.**

---

## O ciclo de uma sessão

### 1. Você abre uma conversa e pede algo

Não precisa mandar ler o cofre — o `CLAUDE.md` já manda. Mas se quiser garantir, ou se a tarefa for delicada, vale dizer: *"leia a nota X antes"*.

### 2. A IA lê antes de agir

Ela vai ler o mapa e a nota da área que vai tocar. É por isso que ela não vai perguntar de novo "o que é `vendas_marketing`?" nem redescobrir que o telefone não é normalizado.

### 3. A IA trabalha

### 4. A IA atualiza o cofre e escreve o handoff

Atualizar a documentação **faz parte da tarefa**. Ao final ela deve: atualizar a nota da área, marcar bugs resolvidos no índice de débito técnico, registrar problemas novos, e criar o handoff da sessão.

---

## A divisão de responsabilidade

> [!tip] Quem escreve o quê
> Não faz sentido a IA escrever tudo. O que funciona:

### 🤖 A IA escreve — o técnico
O que mudou no código · qual bug foi corrigido e por quê · qual decisão de implementação foi tomada · o que quebrou no caminho · números e assinaturas de função.

Isso ela tem na cabeça no momento em que faz. Você não tem por que digitar.

### 👤 Você escreve — o de negócio
Por que quer determinada métrica · o que a equipe comercial reclamou · qual campanha performou mal e sua hipótese · qual a prioridade real · o que o cliente pediu.

**Isso a IA não tem como saber** — e é justamente o contexto que faz ela decidir melhor depois.

> [!example] Por que isso importa, na prática
> Está catalogado que o "Ticket Médio" do gráfico de frequência divide faturamento por **clientes** em vez de **pedidos**.
>
> Mas ninguém sabe se o que você quer ver ali é *ticket por pedido* ou *gasto médio por cliente no segmento*. São métricas diferentes e as duas são legítimas.
>
> **Uma linha sua numa nota resolve isso para sempre.** Sem ela, cada sessão vai adivinhar de novo — e possivelmente adivinhar diferente.

---

## Como você anota (é simples)

Não precisa formatar nada. Abra a nota da área, escreva em português normal, salve. Se estiver com pressa, crie uma nota solta chamada `INBOX` e jogue lá — a IA organiza depois.

Coisas que valem muito a pena anotar assim que acontecem:
- Uma reclamação específica de usuário sobre um número
- Uma decisão de negócio ("recorrente para nós é quem comprou 2× em 12 meses, não na vida")
- Uma prioridade que mudou
- Algo que você testou e não funcionou como esperava

---

## Comandos úteis para você usar comigo

| Se você quiser... | Diga |
|---|---|
| garantir o contexto antes de uma tarefa delicada | *"leia o cofre antes de mexer nisso"* |
| registrar o que acabamos de fazer | *"atualiza o Obsidian"* |
| fechar a sessão direito | *"escreve o handoff de hoje"* |
| entender algo sem mexer em nada | *"me explica X consultando o cofre"* |
| revisar se a documentação está em dia | *"confere se o cofre bate com o código atual"* |

---

## ⚠️ Limites honestos deste arranjo

> [!warning] O que esperar de verdade
> - **Não é infalível.** Numa tarefa longa e complexa, a instrução de atualizar o cofre pode ficar em segundo plano. Vale conferir de vez em quando.
> - **O cofre pode ficar desatualizado** se uma sessão alterar o código e esquecer da nota. Se algo parecer estranho, **o código é a verdade** — e a nota precisa ser corrigida.
> - **Terminar a sessão pedindo o handoff** é o hábito que mais garante que nada se perca. Custa uma frase.
> - **Nada aqui é mágico:** são arquivos `.md` de texto puro no seu disco, versionados no git junto com o código. Você pode ler, editar e apagar qualquer um deles com qualquer editor.

## Ver também

- [[000 - MAPA DO PROJETO]] · [[TEMPLATE - Handoff de Sessao]] · [[DT - Indice de Problemas Conhecidos]]
