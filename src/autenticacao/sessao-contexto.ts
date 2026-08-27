import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Perfil, VinculoSetor } from './tipos'

export interface EstadoSessao {
  /** true enquanto ainda não se sabe se há sessão/perfil — as guardas esperam. */
  carregando: boolean
  sessao: Session | null
  /** null = sem cadastro aprovado na plataforma (conta não acessa nada). */
  perfil: Perfil | null
  vinculos: VinculoSetor[]
  /** admin, papel líder ou líder de pelo menos um setor. */
  ehLider: boolean
  recarregarPerfil: () => Promise<void>
  sair: () => Promise<void>
}

export const ContextoSessao = createContext<EstadoSessao | null>(null)

export function useSessao(): EstadoSessao {
  const estado = useContext(ContextoSessao)
  if (!estado) throw new Error('useSessao() precisa estar dentro de <ProvedorSessao>.')
  return estado
}
