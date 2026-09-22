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
  /** SESSAO-22 (D-49): quando foi arquivado — tudo fica no nome dele; pendências foram ao líder. */
  arquivado_em: string | null
  /** Tema visual escolhido no Meu Perfil (SESSAO-13): um dos 10 temas Domoby. */
  tema: string
  /** Caminho da foto de perfil no bucket plt-imagens, quando existir. */
  foto_caminho: string | null
  /** Módulos liberados (SESSAO-19/D-46): 'fabrica' e/ou 'comercial'. Admin vê tudo. */
  modulos: Modulo[]
}

export type Modulo = 'fabrica' | 'comercial'

/**
 * O gate de módulo do front (D-46) — espelho do plt_privado.fn_tem_modulo do
 * banco: admin sempre tem; os demais dependem da lista. O front só decide o
 * que MOSTRAR; quem nega de verdade é o banco.
 */
export function temModulo(perfil: Perfil | null, modulo: Modulo): boolean {
  if (!perfil) return false
  return perfil.papel === 'admin' || perfil.modulos.includes(modulo)
}

export interface VinculoSetor {
  setor_id: number
  lider_do_setor: boolean
  setor: { id: number; nome: string; codigo: string }
}

/** Colunas de plt_usuarios que o front pode ler. NUNCA usar select('*') aqui:
 *  cpf/convite_token/pin_hash são revogados e derrubariam a consulta inteira. */
export const COLUNAS_PERFIL =
  'id, nome, usuario, email, telefone, matricula, papel, senha_padrao, ativo, arquivado_em, tema, foto_caminho, modulos'
