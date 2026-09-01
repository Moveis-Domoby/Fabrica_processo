import { Navigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { buscarSetores } from '@/kanban/api'
import { PCP } from '@/paginas/PCP'
import { QuadroSetor } from '@/paginas/QuadroSetor'

/**
 * Lei de navegação (SESSAO-13): /producao/{codigo} é o filho de Controle de
 * Produção — um por setor cadastrado, dinâmico. O codigo de plt_setores é o
 * slug da rota; o quadro do PCP é a tela própria da entrada.
 */
export function ProducaoSetor() {
  const { codigo } = useParams()
  const { data: setores = [], isPending } = useQuery({
    queryKey: ['setores'],
    queryFn: () => buscarSetores(),
  })

  if (isPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status">
        <Loader2 aria-hidden className="size-8 animate-spin text-texto-fraco" />
        <span className="sr-only">Carregando…</span>
      </div>
    )
  }

  if (codigo === 'pcp') return <PCP />

  const setor = setores.find((s) => s.codigo === codigo)
  if (!setor) return <Navigate to="/inicio/meu-painel" replace />

  // Os terminais têm casa própria: Estoque na Logística, ROTAS nas entregas.
  if (setor.codigo === 'estoque') return <Navigate to="/logistica/estoque" replace />
  if (setor.codigo === 'rotas') return <Navigate to="/rotas/entregas" replace />

  return <QuadroSetor setorId={setor.id} />
}

/** O quadro do setor ESTOQUE morando em /logistica/estoque (D-36/D-38). */
export function LogisticaEstoque() {
  const { data: setores = [], isPending } = useQuery({
    queryKey: ['setores'],
    queryFn: () => buscarSetores(),
  })

  if (isPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status">
        <Loader2 aria-hidden className="size-8 animate-spin text-texto-fraco" />
        <span className="sr-only">Carregando…</span>
      </div>
    )
  }

  const estoque = setores.find((s) => s.codigo === 'estoque')
  if (!estoque) return <Navigate to="/inicio/meu-painel" replace />
  return <QuadroSetor setorId={estoque.id} />
}

/**
 * Redirecionamento dos bookmarks antigos: /setores/{id} → a rota nova do
 * mesmo setor. Nenhum link salvo nos tablets pode quebrar.
 */
export function RedirecionarSetorAntigo() {
  const { id } = useParams()
  const setorId = Number(id)
  const { data: setores = [], isPending } = useQuery({
    queryKey: ['setores'],
    queryFn: () => buscarSetores(),
  })

  if (isPending) return null
  const setor = setores.find((s) => s.id === setorId)
  if (!setor) return <Navigate to="/inicio/meu-painel" replace />
  if (setor.codigo === 'estoque') return <Navigate to="/logistica/estoque" replace />
  if (setor.codigo === 'rotas') return <Navigate to="/rotas/entregas" replace />
  return <Navigate to={`/producao/${setor.codigo}`} replace />
}
