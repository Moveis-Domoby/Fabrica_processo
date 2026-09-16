import { Navigate, useNavigate, useParams } from 'react-router'
import { ListasDisparoDetalhe } from '../components/ListasDisparo/ListasDisparoDetalhe'

/**
 * /comercial/listas/{id} — o detalhe da campanha do recompra, portado 1:1
 * (SESSAO-20/D-46): membros, scorecards, auditoria, mensagem de referência.
 * Os botões de disparo estão atrás da trava da união (travas.ts) até o
 * cutover. O "voltar" interno leva ao índice das listas.
 */
export function ListaDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  if (!id) return <Navigate to="/comercial/listas" replace />
  return (
    <div className="comercial w-full">
      <ListasDisparoDetalhe listaId={id} onBack={() => navigate('/comercial/listas')} />
    </div>
  )
}
