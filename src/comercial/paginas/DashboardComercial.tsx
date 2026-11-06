import { AnalyticsDashboard } from '../components/AnalyticsDashboard'
import { ErrorBoundary } from '../components/ErrorBoundary'

/**
 * /comercial/dashboard — o Dashboard Analítico do recompra (Recharts), portado
 * 1:1 (SESSAO-20/D-46). O `view === 'dashboard'` virou rota. ↩️ 06/11
 * (cabeçalhos compactos): o voltar é a setinha do cabeçalho, como em toda tela.
 * Q-66: consolidar (ou não) com o pai Dashboards é assunto de outra sessão.
 */
export function DashboardComercial() {
  return (
    <div className="comercial w-full">
      <ErrorBoundary>
        <AnalyticsDashboard />
      </ErrorBoundary>
    </div>
  )
}
