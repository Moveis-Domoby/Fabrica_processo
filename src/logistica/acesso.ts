import { useQuery } from '@tanstack/react-query'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarSetores } from '@/kanban/api'

/**
 * Quem é a logística nas telas (D-22/D-25/D-45): admin, gente do PCP (a
 * entrada — o PCP É a logística) e dos terminais (ESTOQUE/ROTAS). É o mesmo
 * gate de plt_privado.fn_pode_ver_expedicao — o banco decide de verdade;
 * aqui só se evita mostrar tela vazia para quem não tem acesso.
 */
export function useAcessoLogistica() {
  const { perfil, vinculos, carregando } = useSessao()
  const souAdmin = perfil?.papel === 'admin'
  const { data: setores = [], isPending } = useQuery({
    queryKey: ['setores'],
    queryFn: () => buscarSetores(),
    enabled: perfil !== null,
  })
  const setoresDaLogistica = new Set(
    setores.filter((s) => s.papel_no_fluxo !== 'producao').map((s) => s.id),
  )
  const tenhoAcesso = souAdmin || vinculos.some((v) => setoresDaLogistica.has(v.setor_id))
  // Só afirma "sem acesso" quando já se sabe quem é e quais setores existem.
  const semAcesso = !carregando && !isPending && setores.length > 0 && !tenhoAcesso
  return { perfil, souAdmin, tenhoAcesso, semAcesso, setores }
}
