import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ListChecks } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface LinhaLista {
  id: string
  nome: string
  status: string
  total_membros: number
}

/**
 * /comercial/listas — o índice das campanhas. No painel antigo as listas só
 * eram alcançadas pelo dropdown do cabeçalho (que continua existindo); esta
 * página é a cola mínima que a rota-filha da lei de navegação exige (D-36):
 * a MESMA consulta do dropdown, em página, levando ao detalhe. Nenhum fluxo
 * novo nasce aqui — criar lista continua sendo pelo Painel de Recompra.
 */
export function ListasDisparoIndice() {
  const navigate = useNavigate()
  const [listas, setListas] = useState<LinhaLista[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    async function buscar() {
      const { data: listasData } = await supabase
        .from('listas_disparo')
        .select('id, nome, status, criado_em')
        .order('criado_em', { ascending: false })
      const { data: scoresData } = await supabase
        .from('vw_scorecards_lista')
        .select('lista_id, total_membros')
      if (!ativo) return
      setListas(
        (listasData ?? []).map((lista) => ({
          id: lista.id,
          nome: lista.nome,
          status: lista.status,
          total_membros:
            scoresData?.find((s) => s.lista_id === lista.id)?.total_membros ?? 0,
        })),
      )
      setCarregando(false)
    }
    buscar()
    return () => {
      ativo = false
    }
  }, [])

  return (
    <div className="comercial w-full">
      <header className="mb-6">
        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-primary leading-tight">
          Listas de Disparo
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
          Suas campanhas de reativação. Para criar uma lista nova, selecione clientes no
          Painel de Recompra.
        </p>
      </header>

      {carregando ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : listas.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground bg-card border border-border rounded-xl">
          Nenhuma lista criada.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listas.map((lista) => (
            <button
              key={lista.id}
              onClick={() => navigate(`/comercial/listas/${lista.id}`)}
              className="text-left bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors shadow-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <ListChecks size={16} className="text-primary shrink-0" />
                <span className="font-semibold text-sm text-foreground truncate">
                  {lista.nome}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground capitalize">
                  {lista.status.replace('_', ' ')}
                </span>
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full whitespace-nowrap">
                  {lista.total_membros} leads
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
