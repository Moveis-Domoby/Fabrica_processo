-- ============================================================================
-- Manutenção de 16/10/2026 (SESSAO-33 — D-141: "a imagem de teste do
-- comprovante no pedido 13622 → o dono autorizou tirar")
--
-- O quê: o anexo 1 — "TESTE - comprovante de exemplo.png" (PNG, 37 KB), posto
-- pelo dono em 15/10 ~05:40 UTC no cartão do pedido 13622 (Loja Domoby) para
-- provar os anexos (A-64). É o ÚNICO anexo do pedido.
--
-- Como: pelo caminho normal da plataforma — a MESMA porta do botão "Tirar" da
-- janela do card (public.plt_fn_anexo_remover), em nome do dono (quem enviou):
--   · o anexo some da tela para todos (removido_em / removido_por);
--   · um fato novo 'anexo_removido' entra no histórico do cartão (append-only —
--     regra 5: nada é apagado; correção é fato novo);
--   · o ARQUIVO continua guardado no armário e só o admin o vê (D-125 resp. 8).
-- Ninguém escuta esse fato (conferido em 16/10: nenhum webhook nem automação).
--
-- Ensaio no banco real em 16/10 ~20:36 UTC, numa transação desfeita (A-11):
-- resultado 'tirado', removido_por = o dono, 1 fato 'anexo_removido', 0 anexos
-- visíveis no cartão; conferido depois que nada ficou gravado.
--
-- Rodar UMA vez (E-88), só com o "pode" do dono na conversa. Repetir não faz
-- nada (a porta devolve 'ja_estava').
-- Desfazer: não há "desremover" pela tela; se precisar, o admin vê o anexo
-- removido na janela do card (o arquivo segue no armário).
-- ============================================================================
do $$
declare
  v_r text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '39c2c41f-afc0-4ffa-aae8-63c3df35627a', 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', '39c2c41f-afc0-4ffa-aae8-63c3df35627a', true);
  perform set_config('role', 'authenticated', true);
  v_r := public.plt_fn_anexo_remover(1);
  perform set_config('role', 'none', true);
  raise notice 'anexo 1 (pedido 13622): %', v_r;
end $$;

-- Conferência (depois):
-- select a.removido_em, (select count(*) from public.plt_eventos e
--         where e.tipo = 'anexo_removido' and e.dados->>'anexo_id' = '1') as fatos
--   from public.plt_anexos a where a.id = 1;
