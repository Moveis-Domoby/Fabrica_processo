import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { normalizePhone } from '../lib/utils';

export interface DisparoEntry {
  lista_id: string;
  lista_nome: string;
  status: string;
  data_envio: string | null;
  data_resposta: string | null;
  valor_ganho: number | null;
  motivo_perda: string | null;
}

export interface DisparosMap {
  [normalizedPhone: string]: DisparoEntry[];
}


export function useDisparosData() {
  const [disparosMap, setDisparosMap] = useState<DisparosMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        // Busca todos os membros com o nome da lista em join
        const { data, error } = await supabase
          .from('listas_disparo_membros')
          .select(`
            telefone,
            status,
            data_envio,
            data_resposta,
            valor_ganho,
            motivo_perda,
            lista_id,
            listas_disparo ( nome )
          `)
          .not('data_envio', 'is', null); // só quem de fato foi disparado

        if (error) throw error;

        const map: DisparosMap = {};
        (data ?? []).forEach((m: any) => {
          const phone = normalizePhone(m.telefone ?? '');
          if (!phone) return;
          if (!map[phone]) map[phone] = [];
          map[phone].push({
            lista_id: m.lista_id,
            lista_nome: m.listas_disparo?.nome ?? '—',
            status: m.status,
            data_envio: m.data_envio,
            data_resposta: m.data_resposta,
            valor_ganho: m.valor_ganho,
            motivo_perda: m.motivo_perda,
          });
        });

        setDisparosMap(map);
      } catch (e) {
        console.error('[useDisparosData]', e);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  return { disparosMap, loadingDisparos: loading };
}
