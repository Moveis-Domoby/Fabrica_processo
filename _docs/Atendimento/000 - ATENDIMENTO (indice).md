---
titulo: Atendimento — índice (memória do Vigia + automações DataCrazy)
tipo: nota
criado: 2026-09-03
atualizado: 2026-09-17
tags: [atendimento, comercial]
---

# 👁️ Atendimento — memória comercial e automações DataCrazy

> [!info] Origem desta pasta
> Esta documentação nasceu no cofre da loja (projeto "Painel de Recompra", pasta `_Docs/`) e foi migrada para o cofre unificado da fábrica em **17/09/2026**, porque o comercial virou módulo da plataforma. Ela funde duas pastas antigas: a **memória do Vigia** (estudo dos atendimentos humanos no WhatsApp/Instagram) e a documentação técnica das **automações do DataCrazy**. Contexto geral do projeto em [[000 - MAPA DO PROJETO]]; a integração do módulo comercial com o CRM está em [[PLT - Comercial - Integracao DataCrazy]].

## O que é isto

Esta pasta é a **memória viva do comportamento de vendas da Domoby**. Ela nasceu de uma leitura direta do Multiatendimento do **DataCrazy** (acesso admin, somente leitura — nenhuma conversa foi respondida, movida ou alterada) e da dissecação do fluxo de follow-up no editor de automações. O papel aqui não é elogiar nem punir: é **vigiar o padrão**. O que o cliente perguntou, o que foi respondido, o que **deveria** ter sido respondido, e quanto dinheiro escorreu na diferença entre os dois.

## Em que ordem ler

| # | Nota | O que guarda |
|---|---|---|
| 1 | [[ATD - Por que Convertemos Pouco]] | **O diagnóstico. Comece por aqui se tiver 5 minutos.** As 5 causas da baixa conversão, com placar por vendedor. |
| 2 | [[ATD - Recepcao e Follow-up]] | Avaliação das mensagens automáticas do ponto de vista do cliente: as de recepção e os 7 disparos de follow-up. |
| 3 | [[ATD - FAQ e Respostas Padrao]] | O que o cliente mais pergunta e a resposta que fecha, não a que informa. Inclui os roteiros de objeção. |
| 4 | [[ATD - Equipe - Felipe Padrao Ouro]] | **A régua.** Felipe Alves é o gerente — o padrão dele é a referência contra a qual os outros dois são medidos, e os buracos do próprio padrão também estão anotados. |
| 5 | [[ATD - Equipe - Gessica]] | Comportamento da Gessica Silva, atendimentos avaliados, plano de correção. |
| 6 | [[ATD - Equipe - Gabriel]] | Comportamento do Gabriel Ferreira, atendimentos avaliados, plano de correção. |
| 7 | [[ATD - Follow-up DataCrazy - Defeitos]] | **Comece por aqui na parte técnica.** 15 defeitos do fluxo `Follow up - atualização`, com evidência e severidade. |
| 8 | [[ATD - Follow-up DataCrazy - Anatomia]] | O fluxo destrinchado: gatilho, trava de entrada, as 7 etapas, os tempos reais, a volumetria de execuções por nó. |
| 9 | [[ATD - Follow-up DataCrazy - Fluxo v2]] | O redesenho: régua nova, trava de conversa viva, encerramento único, e a decisão de HSM. |
| 10 | [[ATD - Follow-up DataCrazy - Especificacao Importavel]] | **A proposta virou arquivo.** `Follow-up-v2-24h-Domoby.json` — 67 blocos, 5 mensagens dentro da janela de 24h, sem template pago e sem depender do vendedor. Entra desligada. |

O arquivo `Follow-up-v2-24h-Domoby.json` (o fluxo importável) vive nesta mesma pasta, ao lado das notas.

## O resumo de uma linha (lado técnico)

> A automação de follow-up funciona tecnicamente, mas **7 de cada 10 leads que entram nela nunca recebem nem a primeira mensagem**, **a sétima mensagem nunca foi enviada uma única vez** e **nenhum lead jamais foi marcado como perdido** — então a perda é invisível no funil.

## Onde tudo mora

- **Editor de automações:** `crm.datacrazy.io/flow` · Conta: Móveis Domoby
- **Banco:** tudo que foi lido está gravado no **Supabase da fábrica** (projeto `axnzldwgwsmepukdiljx`), tabela única `public.vig_conhecimento_vendas` — uma linha por atendimento analisado, por pergunta frequente, por resposta padrão, por objeção e por conclusão, separadas pela coluna `tipo`. As mensagens cruas ficam em `mensagens` (jsonb). As linhas da análise técnica das automações usam `tipo` `resposta_padrao` e `conclusao`, tag `automacao_fluxo`. O detalhe do esquema está em [[SUPA - Esquema do Banco]].

## Regras desta memória

1. **Felipe é a régua, não o teto.** Onde o padrão dele também falha, está registrado — senão a loja inteira herda o erro do gerente.
2. **Nada de achismo.** Toda afirmação aqui tem conversa (ou contador de execução do editor) por trás. Quando é leitura minha e não fato observado, está escrito "leitura do vigia".
3. **Atualizar faz parte.** Rodada nova de análise = atualizar estas notas e inserir as linhas no Supabase, não criar arquivo paralelo.
4. **Isto não é avaliação de RH.** É diagnóstico de processo. A maior parte da perda encontrada **não é culpa do vendedor** — é do desenho do atendimento.
5. **Nada foi alterado no DataCrazy.** A leitura técnica foi feita extraindo o JSON do fluxo do próprio editor; nenhum nó foi criado, editado, movido de propósito ou salvo. Ao navegar pelo canvas o editor marca a automação como "alterada" — se aparecer o aviso *"Sair do site? As alterações não serão salvas"*, clicar em **Sair**.

## Ver também

[[000 - MAPA DO PROJETO]] · [[PLT - Comercial - Integracao DataCrazy]] · [[SUPA - Esquema do Banco]]
