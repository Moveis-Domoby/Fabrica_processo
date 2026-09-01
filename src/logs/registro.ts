import { supabase } from '@/lib/supabase'

/**
 * Registro de atividade (SESSAO-13): toda atividade de usuário gera log no
 * banco, append-only. As mutações já viram log sozinhas por trigger
 * (plt_eventos, plt_tarefas, plt_usuarios); esta porta cobre o que só o
 * navegador enxerga — navegação entre telas e gestos sem tabela.
 *
 * Fogo-e-esquece de propósito: registrar nunca pode atrapalhar o gesto.
 */
export function registrarAtividade(
  acao: string,
  rota?: string,
  contexto?: Record<string, unknown>,
): void {
  void supabase
    .rpc('plt_fn_registrar_log', {
      p_acao: acao,
      p_rota: rota ?? null,
      p_contexto: contexto ?? {},
    })
    .then(({ error }) => {
      if (error && import.meta.env.DEV) console.warn('registro de atividade falhou:', error.message)
    })
}
