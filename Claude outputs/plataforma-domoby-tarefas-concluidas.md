# Plataforma Domoby — o que já está pronto (para o ClickUp)

Lista para subir como tarefas e subtarefas e marcar como concluída.

---

## 1. Criação de login na plataforma
- Entrada por nome de usuário ou e-mail
- Cadastro só por convite (link enviado pelo responsável)
- Troca de senha obrigatória no primeiro acesso
- Níveis de permissão: operador, líder e admin
- Matrícula automática do colaborador
- Acesso liberado por área: Fábrica e/ou Comercial

## 2. Cadastro da estrutura da fábrica
- Setores criados: PCP, CNC, SECC, Centro de Furação, Fitamento, Metalurgia, Montagem, Embalagem
- Etapas internas de cada setor (fila, em execução, destinos)
- Estoque, ROTAS e Danificados como destinos finais
- Cadastro da equipe e vínculo de cada pessoa ao seu setor

## 3. Quadro de produção (kanban)
- Card por pedido e card por unidade (1 de 3, 2 de 3…)
- PCP libera o pedido e escolhe o setor de destino
- Mover card entre setores e etapas
- Linha do tempo de cada peça, com todo o histórico
- Aviso no card quando o pedido é alterado ou cancelado no Tiny
- Quadro rápido: 10 cards por coluna com "Ver mais"
- Peça movida cai direto na fila do setor de destino

## 4. Controle de tempo
- Tempo de fila (do setor) e tempo de execução (da pessoa)
- Cronômetro automático por peça e por etapa
- Tempo que o pedido ficou no PCP
- Uma peça por pessoa por vez
- Pausa da execução pelo líder para encaixar urgência, com desconto do tempo
- Horário de funcionamento por setor e por pessoa
- Desligar/religar a contagem e correção retroativa com justificativa

## 5. Qualidade entre setores
- Três estados: perfeito, atenção e danificado
- Quem entrega marca o estado; quem recebe dá o parecer
- Peça marcada como danificada vai para a lista de Danificados
- Aviso automático aos líderes quando há atenção, dano ou divergência

## 6. Tela do chão de fábrica (tablet)
- Modo tablet sem menus, fila em tela cheia
- Operador se identifica pelo PIN, no teclado da própria tela
- Botões grandes: receber, iniciar, finalizar, mover e concluir
- Peça parada há mais tempo aparece em destaque
- Atualização em tempo real e aviso sonoro de peça nova
- Fotos do produto no card, sem nenhum dado do cliente

## 7. Entrada automática de pedidos
- Pedido novo do Tiny vira card no PCP sozinho
- Pedido reenviado não duplica
- Alteração e cancelamento no Tiny aparecem no card
- Aviso aos admins quando o pedido cancelado já estava em produção

## 8. Logística e estoque
- Estoque de peças prontas com código de produção e busca
- Pedidos em aguardo, esperando completar
- Lançar pedido completo para ROTAS
- Danificados com destino, resolução e arquivamento
- Expedição

## 9. ROTAS e entregas
- Lista de entregas por pedido
- Card com cliente, endereço, WhatsApp e mapa
- Programação da entrega por dia e por caminhão
- Mapa com os pontos, ordem de parada sugerida e pedidos próximos
- Cadastro de caminhões com placa e foto
- Marcação de pedido entregue

## 10. Dashboards
- Visão do dia, para TV do galpão, com o gargalo em destaque e atualização sozinha
- Tempo por setor (fila x execução)
- Pessoas: produtividade e metas
- Qualidade: perfeito, atenção, danificado e divergências
- Filtros por período e por setor
- Visualizações salvas e compartilháveis

## 11. Meu Painel (tela inicial)
- O que me espera: qualidade a atestar, delegados a mim, tarefas abertas e em execução
- Avisos recentes
- Metas com barra de andamento e ritmo esperado
- Metas por pessoa ou por setor, diárias, semanais ou mensais

## 12. Tarefas e delegação
- Meus afazeres e afazeres do time
- Delegação direta pelo líder ou por sorteio automático
- Tarefa avulsa com tempo opcional
- Reatribuição de peças entre pessoas

## 13. Navegação e identidade visual
- Menu em dois níveis, recolhível, presente em todas as telas
- Botão voltar em toda tela e sino de notificações no topo
- Meu perfil: nome, e-mail, telefone, senha e foto
- 10 temas visuais, do claro ao escuro
- Tela de login com a marca Domoby
- Funciona em computador, tablet e celular
- Registro de toda atividade feita na plataforma

## 14. Painel administrativo
- Equipe: cadastro, papéis e setores
- Setores e etapas
- Controle de tempo
- Caminhões
- Chaves de acesso e integrações

## 15. Integrações (API aberta)
- Chave de acesso por integração, com revogação imediata
- Criar, mover e consultar peças por integração
- Envio automático de eventos para o n8n
- Manual de uso da integração

## 16. Conectar plataforma comercial
- Painel de Recompra recriado dentro da plataforma
- Dashboard comercial: faturamento, sazonalidade, top clientes e top itens
- Listas de disparo (campanhas de reativação)
- Histórico e auditoria de cada campanha
- Permissão separada: quem acessa a Fábrica e quem acessa o Comercial
- Dados do painel antigo transferidos e conferidos número a número

## 17. Ajustar integração com DataCrazy
- Integração de disparo por WhatsApp recriada dentro da plataforma
- Retorno das respostas dos clientes ligado
- Disparo mantido travado até a virada definitiva

---

## ⚠️ Ainda NÃO concluído (não marcar)
- Publicação definitiva para uso nos tablets do galpão
- Virada final do comercial (desligar o sistema antigo e liberar o disparo)
- Últimos ajustes da produção (filas, pausa e tempo de PCP) aguardando aprovação final
