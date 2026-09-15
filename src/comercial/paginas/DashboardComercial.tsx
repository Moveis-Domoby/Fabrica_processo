import { useNavigate } from 'react-router'
import { AnalyticsDashboard } from '../components/AnalyticsDashboard'
import { ErrorBoundary } from '../components/ErrorBoundary'

/**
 * /comercial/dashboard — o Dashboard Analítico do recompra (Recharts), portado
 * 1:1 (SESSAO-20/D-46). O `view === 'dashboard'` virou rota; o botão de voltar
 * interno do painel leva de volta ao Painel de Recompra, como no antigo.
 * Q-66: consolidar (ou não) com o pai Dashboards é assunto de outra sessão.
 */
export function DashboardComercial() {
  const navigate = useNavigate()
  return (
    <div className="comercial w-full">
      <ErrorBoundary>
        <AnalyticsDashboard onBack={() => navigate('/comercial/recompra')} />
      </ErrorBoundary>
    </div>
  )
}
