-- ============================================================================
-- SESSAO-41 · F3 (D-192) — a revisão de segurança (pedido do dono, 26/10):
-- "revisar políticas de segurança para bloquear testes comuns que hackers e
-- pessoas mal-intencionadas fazem… injeção de SQL no login, teste de força
-- bruta, edição de acesso via API e coisas do tipo".
--
-- O que a auditoria de 27/10 achou (banco real, só leitura): toda regra de
-- escrita das tabelas é "para quem está logado" e confere a pessoa — o
-- visitante (sem login) não consegue gravar nada. Mas os PRIVILÉGIOS padrão da
-- Supabase ainda davam ao visitante INSERT/UPDATE/DELETE/TRUNCATE em quase
-- todas as tabelas (inclusive todas as colunas de plt_usuarios), e TRUNCATE a
-- quem está logado — TRUNCATE não passa pelas regras de linha. Uma camada só
-- segurava. Aqui a segunda camada: quem não entrou não escreve em nada; nenhum
-- papel do navegador esvazia tabela; o mesmo vale para tabela nova (privilégio
-- padrão). Leitura NÃO muda (cada tabela continua com a sua regra).
--
-- Seguro para o que está no ar: nenhuma tela grava sem login (a entrada passa
-- pela função de login, com a chave de serviço); o n8n e as funções usam a
-- chave de serviço (outro papel, que não muda).
-- ============================================================================
set local lock_timeout = '5s';

-- 1 · o visitante (sem login) não grava em nada — tabelas, visões e sequências
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon;
revoke usage, update on all sequences in schema public from anon;

-- 2 · ninguém do navegador esvazia tabela (TRUNCATE ignora as regras de linha)
revoke truncate on all tables in schema public from authenticated;

-- 3 · o mesmo para o que nascer depois (privilégio padrão de quem cria as tabelas)
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon;
alter default privileges in schema public
  revoke usage, update on sequences from anon;
alter default privileges in schema public
  revoke truncate on tables from authenticated;
