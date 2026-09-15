import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useRevenueChartData(start: Date | null, end: Date | null) {
  const [data, setData] = useState<{ month_str: string; revenue: number; orders: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const pStart = start ? start.toISOString() : null;
        const pEnd = end ? end.toISOString() : null;

        const { data: result, error } = await supabase.rpc('fn_dashboard_revenue_chart', {
          p_start: pStart,
          p_end: pEnd
        });

        if (error) throw error;
        
        if (result) {
          setData(result.map((r: any) => ({
            month_str: r.month_str,
            revenue: Number(r.revenue),
            orders: Number(r.orders)
          })));
        }
      } catch (err) {
        console.error('Error fetching revenue chart data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [start, end]);

  return { data, loading };
}
