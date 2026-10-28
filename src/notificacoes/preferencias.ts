import { supabase } from '@/lib/supabase'

/**
 * D-202 (28/10, pedido do dono): os avisos que cada pessoa recebe — escolhidos
 * em Configurações → Avisos. O catálogo, o padrão de cada aviso e quem pode
 * recebê-lo moram no banco (fn_avisos_catalogo); o aviso desligado nem nasce.
 */
export interface EscolhaAviso {
  tipo: string
  grupo: string
  grupo_nome: string
  nome: string
  descricao: string | null
  /** Urgente: aparece travado, sempre ligado. */
  obrigatorio: boolean
  /** Erro de automação/integração: ligado por padrão só para o super admin. */
  erro: boolean
  padrao: boolean
  ligado: boolean
  recebidos_30d: number
}

export interface PessoaAvisos {
  id: string
  nome: string
  papel: string
}

export interface TelaAvisos {
  pessoa: PessoaAvisos & { super_admin: boolean }
  avisos: EscolhaAviso[]
  /** Só para o administrador: as pessoas ativas, para escolher de quem. */
  pessoas: PessoaAvisos[] | null
}

/** A tela inteira numa requisição. Sem pessoa = os meus avisos. */
export async function buscarTelaAvisos(usuarioId?: string | null): Promise<TelaAvisos> {
  const { data, error } = await supabase.rpc('plt_fn_avisos', { p_usuario_id: usuarioId ?? null })
  if (error) throw new Error(`Não deu para carregar os avisos: ${error.message}`)
  return data as TelaAvisos
}

export async function definirAviso(
  tipo: string,
  ligado: boolean,
  usuarioId?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_aviso_definir', {
    p_tipo: tipo,
    p_ligado: ligado,
    p_usuario_id: usuarioId ?? null,
  })
  if (error) throw new Error(error.message)
}
