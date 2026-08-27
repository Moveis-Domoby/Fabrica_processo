export type Papel = 'operador' | 'lider' | 'admin'

export const ROTULO_PAPEL: Record<Papel, string> = {
  operador: 'Operador',
  lider: 'Líder',
  admin: 'Admin',
}

/**
 * A pessoa logada, como o front a enxerga.
 * CPF e convite_token NÃO aparecem aqui de propósito: a leitura dessas colunas
 * é revogada no banco (migration 11) — a tela identifica pela matrícula.
 */
export interface Perfil {
  id: string
  nome: string
  usuario: string
  email: string
  telefone: string | null
  matricula: string
  papel: Papel
  senha_padrao: boolean
  ativo: boolean
}

export interface VinculoSetor {
  setor_id: number
  lider_do_setor: boolean
  setor: { id: number; nome: string; codigo: string }
}

/** Colunas de plt_usuarios que o front pode ler. NUNCA usar select('*') aqui:
 *  cpf/convite_token/pin_hash são revogados e derrubariam a consulta inteira. */
export const COLUNAS_PERFIL =
  'id, nome, usuario, email, telefone, matricula, papel, senha_padrao, ativo'
