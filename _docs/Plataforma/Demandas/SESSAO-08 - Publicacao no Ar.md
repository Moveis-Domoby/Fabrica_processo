---
titulo: "SESSAO-08 — Publicação no Ar"
tipo: demanda
status: rascunho
data: 2026-08-27
atualizado: 2026-08-27
tags: [plataforma, demanda, sessao, deploy, infraestrutura]
---

# 🎯 SESSAO-08 — Publicação no Ar

> [!info] Por que esta sessão existe (D-23)
> Criada no replanejamento de 27/08: **nenhuma sessão cobria hospedar a plataforma**, e sem isso nada chega ao tablet do galpão — a tela do setor (SESSAO-07) ficaria linda no localhost de uma máquina só. É a ponte entre "funciona na máquina do dono" e "a fábrica usa".

## O que é

A plataforma publicada numa URL estável, acessível dos tablets dos setores e dos celulares da equipe, com um processo de publicação repetível que toda sessão seguinte usa para entregar em produção.

## Requisitos cobertos

RNF-06 (novo: plataforma publicada e acessível do galpão; deploy repetível) · viabiliza na prática o RF-25 (operação em tablet/celular — D-06).

## Decisões que regem

D-23 (posição no plano; **a partir desta sessão a permissão da D-19 acaba** — plataforma com gente usando → regra crítica 2 do CLAUDE.md volta na íntegra: nada no banco/produção sem aprovação explícita naquela conversa) · D-06 (dispositivos) · D-15 (stack: build Vite estático + Supabase gerenciado — não há backend próprio para hospedar além das Edge Functions, que já vivem no Supabase) · regra crítica 4 (segredos: as chaves `VITE_*` vão no build; nada de service_role no front).

## Comportamento esperado

- **Hospedagem escolhida e justificada** (Q-62: VPS Hostinger que já roda o n8n, Vercel, Cloudflare Pages… — o Claude Code compara custo/manutenção/rede do galpão e recomenda; o dono bate o martelo).
- **URL estável** que os tablets e celulares salvam (ícone na tela inicial / PWA básico se couber sem inchar o escopo).
- **Processo de deploy documentado e repetível** (uma linha de comando ou push → publica), incluindo variáveis de ambiente por ambiente e como publicar as próximas sessões sem quebrar quem está usando.
- **Verificação nos dispositivos reais do galpão** (Q-60: cobertura do wi-fi nos setores — testar onde os tablets vão ficar; registrar o que se descobrir).
- Checklist de "agora é produção de verdade": convites/senhas dos ~30 usuários reais são gesto do dono; os usuários de teste da SESSAO-03 são desativados quando ele decidir.

## Perguntar ao dono no início da sessão

- Q-62 · Hospedagem (trazer a comparação pronta para ele só escolher).
- Q-60 · Wi-fi do galpão: cobre todos os setores? Aceita o risco de queda (sem modo offline nesta fase)?
- Domínio: subdomínio de algum domínio que a Domoby já tem, ou URL da hospedagem serve por ora?

## Fora do escopo

Modo offline (Q-60 — se virar necessidade, é decisão nova) · CI/CD sofisticado · monitoramento/alertas (conversa com a P1 do cofre, mas não é desta sessão) · migração dos cards vivos do ClickUp (Q-25).

## Critérios de aceite

- [ ] Plataforma acessível pela URL num tablet e num celular DENTRO do galpão, com login funcionando.
- [ ] Deploy repetível documentado: uma mudança trivial publicada de novo em minutos, sem passo manual obscuro.
- [ ] Nenhum segredo além das chaves públicas (`VITE_*`) no bundle — conferido.
- [ ] Registro no cofre: hospedagem escolhida e por quê (Q-62 ✅), estado real do wi-fi por setor (Q-60).
- [ ] Handoff + memória de aprendizado; a partir daqui, toda sessão publica em produção com aprovação explícita (D-19 encerrada).

## Notas para o Claude Code

Ler [[handoff_2026_08_27_sessao04_kanban]] (estado atual) e o `.env.example` do repo. O build já sai limpo (`npm run build`); o aviso de chunk de 740 kB é candidato a code-split — só se couber sem virar refatoração.
