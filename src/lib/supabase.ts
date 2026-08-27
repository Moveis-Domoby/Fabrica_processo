import { createClient } from '@supabase/supabase-js'

// Só a chave PÚBLICA (anon) entra no front — a service_role nunca (regra 4).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chaveAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !chaveAnon) {
  throw new Error(
    'Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local — copie do .env.example e preencha.',
  )
}

export const supabase = createClient(url, chaveAnon)
