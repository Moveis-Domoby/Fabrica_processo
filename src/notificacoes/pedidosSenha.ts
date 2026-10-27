import { supabase } from '@/lib/supabase'

/** SESSAO-41 (D-191): os pedidos de troca de senha, para os administradores decidirem. */
export interface PedidoSenha {
  id: number
  situacao: 'pendente' | 'liberado' | 'recusado' | 'usado'
  pedido_em: string
  liberado_ate: string | null
  decidido_em: string | null
  decidido_por: string | null
  pessoa: { id: string; nome: string; usuario: string | null; foto: string | null; papel: string }
}

export async function buscarPedidosSenha(): Promise<PedidoSenha[]> {
  const { data, error } = await supabase.rpc('plt_fn_senha_pedidos')
  if (error) throw new Error(`Não deu para carregar os pedidos de senha: ${error.message}`)
  return (data ?? []) as PedidoSenha[]
}

export async function decidirPedidoSenha(
  pedidoId: number,
  liberar: boolean,
): Promise<{ situacao: string; liberado_ate: string | null; mudou: boolean }> {
  const { data, error } = await supabase.rpc('plt_fn_senha_decidir', {
    p_pedido_id: pedidoId,
    p_liberar: liberar,
  })
  if (error) throw new Error(error.message)
  return data as { situacao: string; liberado_ate: string | null; mudou: boolean }
}
