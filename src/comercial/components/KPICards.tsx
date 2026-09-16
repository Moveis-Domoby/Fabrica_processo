import { Users, ShoppingCart, DollarSign, Repeat, UserPlus } from 'lucide-react';
import { useScorecardsData } from '../hooks/useScorecardsData';

interface KPICardsProps {
  filters: any;
}

export function KPICards({ filters }: KPICardsProps) {
  // [DT-F1 + DT-F3, corrigido] Antes, este componente recalculava start/end
  // em JS (fuso local do navegador) e só mandava essas duas datas para a
  // RPC — os outros filtros (busca, itens, recompra, gasto...) eram
  // ignorados pelos KPIs, e o fuso local podia deslocar a janela em
  // algumas horas em relação ao que a tabela de clientes calculava em SQL.
  // Agora passamos os filtros crus direto para a RPC, que resolve a data
  // em SQL — exatamente como fn_filter_customers já faz para a tabela.
  const { data: scorecards } = useScorecardsData(filters);
  
  const totalClientes = scorecards.total_clients;
  const totalPedidos = scorecards.total_orders;
  const faturamentoTotal = scorecards.total_revenue;
  
  const recorrentes = scorecards.recurrents;
  const novos = totalClientes - recorrentes;
  const taxaRecompra = scorecards.recurrence_rate.toFixed(1);

  // O número usa container query (.num-*): escala com a largura REAL do card,
  // então nunca vaza nem precisa ser cortado/escondido — em qualquer largura,
  // número de colunas ou nível de zoom. O grid usa auto-fit: a quantidade de
  // colunas segue o espaço disponível, não o breakpoint do viewport (que não
  // enxerga a sidebar). h-full + items-stretch deixam todos da mesma altura.
  const cardBase = "bg-card text-card-foreground h-full p-4 rounded-xl shadow-sm border border-border border-t-[3px] border-t-primary flex items-stretch justify-between gap-3";
  const iconBase = "size-10 rounded-full flex shrink-0 items-center justify-center self-center";
  const textoBase = "num-bloco flex flex-1 flex-col";

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-3 sm:gap-4 mb-6 sm:mb-8 items-stretch">
      <div className={cardBase}>
        <div className={textoBase}>
          <p className="text-xs font-medium text-muted-foreground leading-tight">Total Clientes</p>
          <h3 className="num-curto font-bold mt-auto tabular-nums">{totalClientes}</h3>
        </div>
        <div className={`${iconBase} bg-primary/10 text-primary`}>
          <Users size={20} />
        </div>
      </div>

      <div className={cardBase}>
        <div className={textoBase}>
          <p className="text-xs font-medium text-muted-foreground leading-tight">Total Pedidos</p>
          <h3 className="num-curto font-bold mt-auto tabular-nums">{totalPedidos}</h3>
        </div>
        <div className={`${iconBase} bg-serie-2/10 text-serie-2`}>
          <ShoppingCart size={20} />
        </div>
      </div>

      <div className={cardBase}>
        <div className={textoBase}>
          <p className="text-xs font-medium text-muted-foreground leading-tight">Faturamento</p>
          <h3 className="num-moeda font-bold mt-auto tabular-nums whitespace-nowrap">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(faturamentoTotal)}
          </h3>
        </div>
        <div className={`${iconBase} bg-serie-3/10 text-serie-3`}>
          <DollarSign size={20} />
        </div>
      </div>

      <div className={cardBase}>
        <div className={textoBase}>
          <p className="text-xs font-medium text-muted-foreground leading-tight">Novos / Rec.</p>
          <div className="num-par mt-auto flex items-baseline gap-1 whitespace-nowrap">
            <h3 className="font-bold text-foreground tabular-nums">{novos}</h3>
            <span className="text-[0.7em] font-medium text-muted-foreground tabular-nums">/ {recorrentes}</span>
          </div>
        </div>
        <div className={`${iconBase} bg-serie-4/10 text-serie-4`}>
          <UserPlus size={20} />
        </div>
      </div>

      <div className={cardBase}>
        <div className={textoBase}>
          <p className="text-xs font-medium text-muted-foreground leading-tight">Taxa de Recompra</p>
          <h3 className="num-curto font-bold mt-auto tabular-nums">{taxaRecompra}%</h3>
        </div>
        <div className={`${iconBase} bg-serie-5/10 text-serie-5`}>
          <Repeat size={20} />
        </div>
      </div>
    </div>
  );
}
