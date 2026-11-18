---
id: D-49
aliases: [D-49, D-049]
titulo: "Saída de usuário: excluir de fato só sem história; arquivar realoca as pendências ao líder"
tipo: decisao
data: 2026-09-22
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [acesso-usuarios]
tags: [decisao, area/acesso-usuarios]
---
# D-49 · Saída de usuário: excluir de fato só sem história; arquivar realoca as pendências ao líder (22/09/2026)

**Decidido (pedido do dono no fechamento da SESSAO-22):** *"adiciona a possibilidade de excluir e de arquivar um usuário: se excluir, tudo o que estava no nome dele é de fato excluído; arquivar, tudo ainda fica no nome dele, porém as pendências dele são transferidas ao líder direto dele, para que o líder possa realocar"* — com modais próprios da casa, nada de caixa do navegador.

- **ARQUIVAR** (qualquer usuário): perde o acesso (`ativo=false` + `arquivado_em`), **tudo fica registrado no nome dele**; no ato, a **execução aberta é encerrada** (o tempo até ali é dele — evento, nunca edição), e **cards delegados + tarefas abertas passam ao líder direto** do setor de cada pendência (setor sem líder, ou o arquivado É o líder → vão para o admin que arquivou). Reversível (**reativar**); as pendências realocadas não voltam.
- **EXCLUIR** (só cadastro **sem história** — nunca gerou evento/log/meta): some **de verdade** — linha, vínculos, notificações, tarefas dele, visualizações, presenças, horários, foto e a **conta de login**. Quem já tem história **não pode ser excluído** (eventos e trilha são append-only — regra crítica 5/D-40, a história não se apaga): o sistema recusa explicando e **oferece o arquivar na hora** (mesmo padrão do caminhão em uso). Card delegado ao excluído volta a ficar sem dono **por evento**.
- **Quem pode: só admin.** Ninguém arquiva/exclui a si mesmo; o último admin ativo não se arquiva.

**Descartadas:** apagar história de produção junto com o usuário (revogaria a regra crítica 5 e furaria a medição — se um dia for desejado, é decisão nova aqui); abrir o gesto a líderes.
