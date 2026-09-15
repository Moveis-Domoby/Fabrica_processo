import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { format } from 'date-fns'
import { Download, BarChart2 } from 'lucide-react'
import { Toaster, toast } from 'react-hot-toast'
import { KPICards } from '../components/KPICards'
import { FilterBar } from '../components/FilterBar'
import { CustomersTable } from '../components/CustomersTable'
import { ItemsModal } from '../components/ItemsModal'
import { CriarListaModal } from '../components/ListasDisparo/CriarListaModal'
import { AdicionarListaModal } from '../components/ListasDisparo/AdicionarListaModal'
import { ListasDropdown } from '../components/ListasDropdown'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useDisparosData } from '../hooks/useDisparosData'
import { useFilterOptions } from '../hooks/useFilterOptions'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import type { GroupedCustomer, FilterState } from '../types'

/**
 * O painel principal do módulo Comercial — o `view === 'main'` do App.tsx do
 * recompra, portado 1:1 (SESSAO-20/D-46). O que mudou, e SÓ isto:
 *   · o view-state virou rota: Dashboard → /comercial/dashboard, lista →
 *     /comercial/listas/{id};
 *   · o alternador Sol/Lua local saiu — o tema agora é o da plataforma
 *     (Meu Perfil, D-41), com os temas esmeralda herdados do recompra;
 *   · a casca (sidebar, voltar, sino) vem do Layout da casa (D-36).
 * Filtros, KPIs, tabela, modais e textos são os do painel antigo.
 */
export function PainelRecompra() {
  const navigate = useNavigate()
  const { disparosMap } = useDisparosData()
  const { availableItems, availablePurchaseCounts } = useFilterOptions()

  const [filters, setFilters] = useState<FilterState>({
    dateFilter: 'all',
    customDateStart: '',
    customDateEnd: '',
    selectedItems: ['all'],
    purchaseCount: ['all'],
    specificMonth: format(new Date(), 'yyyy-MM'),
    specificDay: format(new Date(), 'yyyy-MM-dd'),
    specificYear: format(new Date(), 'yyyy'),
    searchQuery: '',
    inactiveBeforeDate: '',
    recompraMinDays: '',
    recompraMaxDays: '',
    spendAmount: '',
    spendType: 'total',
    spendMode: 'above',
  })

  // [DT-F5] O input de busca atualiza `filters` a cada tecla (a UI responde na
  // hora), mas quem consome dados (KPIs, tabela, modal) recebe uma versão com o
  // searchQuery segurado por 350ms — as RPCs só disparam quando o usuário para
  // de digitar.
  const debouncedSearchQuery = useDebouncedValue(filters.searchQuery, 350)
  const effectiveFilters = useMemo(
    () => ({ ...filters, searchQuery: debouncedSearchQuery }),
    [filters, debouncedSearchQuery],
  )

  const [modalCustomer, setModalCustomer] = useState<GroupedCustomer | null>(null)
  const [isCriarListaOpen, setIsCriarListaOpen] = useState(false)
  const [isAdicionarListaOpen, setIsAdicionarListaOpen] = useState(false)
  const [selectedForLista, setSelectedForLista] = useState<GroupedCustomer[]>([])

  const handleExportDailySummaryCSV = async () => {
    toast.error('Exportação diária indisponível na nova versão paginada. Refatoração pendente.')
  }

  return (
    <div className="comercial w-full">
      <Toaster position="top-right" />
      <header className="mb-6 sm:mb-8 flex justify-between items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-primary leading-tight">
            Painel de Recompra
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
            Análise de métricas e exportação de leads para marketing.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ListasDropdown
            isActive={false}
            onSelectLista={(id) => navigate(`/comercial/listas/${id}`)}
          />
          <button
            onClick={() => navigate('/comercial/dashboard')}
            className="bg-primary text-primary-foreground flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors text-sm hover:bg-primary/90 shadow-sm"
            title="Abrir Dashboard Analítico"
          >
            <BarChart2 size={16} />
            <span className="hidden sm:inline">Dashboard</span>
          </button>
          <button
            onClick={handleExportDailySummaryCSV}
            className="bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors text-sm"
            title="Exportar resumo diário (Auditoria)"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Auditoria Diária</span>
          </button>
        </div>
      </header>

      <ErrorBoundary>
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          availableItems={availableItems.length ? availableItems : ['all']}
          availablePurchaseCounts={availablePurchaseCounts}
        />

        <KPICards filters={effectiveFilters} />

        <CustomersTable
          filters={effectiveFilters}
          onViewItems={(customer) => setModalCustomer(customer)}
          disparosMap={disparosMap}
          onCriarLista={(customers) => {
            setSelectedForLista(customers)
            setIsCriarListaOpen(true)
          }}
          onAdicionarALista={(customers) => {
            setSelectedForLista(customers)
            setIsAdicionarListaOpen(true)
          }}
        />
      </ErrorBoundary>

      {modalCustomer && (
        <ItemsModal
          isOpen={true}
          onClose={() => setModalCustomer(null)}
          customerName={modalCustomer?.nome || modalCustomer?.telefone || 'Cliente'}
          telefone={modalCustomer?.telefone}
          filters={effectiveFilters}
        />
      )}

      <CriarListaModal
        isOpen={isCriarListaOpen}
        onClose={() => setIsCriarListaOpen(false)}
        filteredData={selectedForLista}
        onListasCriadas={(listas) => {
          setIsCriarListaOpen(false)
          if (listas.length > 0) {
            navigate(`/comercial/listas/${listas[0].id}`)
          }
        }}
      />
      <AdicionarListaModal
        isOpen={isAdicionarListaOpen}
        onClose={() => setIsAdicionarListaOpen(false)}
        filteredData={selectedForLista}
        onListaAdicionada={(listaId) => {
          setIsAdicionarListaOpen(false)
          navigate(`/comercial/listas/${listaId}`)
        }}
      />
    </div>
  )
}
