// O ÚNICO reapontamento de dados do porte (D-46): o módulo Comercial usa o
// client Supabase da FÁBRICA. Os arquivos portados do recompra importam
// '../lib/supabase' como sempre importaram — este adaptador entrega o client
// da casa sem tocar em nenhum deles.
export { supabase } from '@/lib/supabase'
