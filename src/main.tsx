import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Só o subconjunto latino: o galpão não precisa baixar cirílico e devanágari.
import '@fontsource-variable/inter/wght.css'
import '@fontsource/poppins/latin-500.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'
import './estilos/global.css'

import { App } from './App'

const clienteQuery = new QueryClient({
  defaultOptions: {
    queries: {
      // A rede do galpão oscila: nova tentativa vale a pena, ruído não.
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

const raiz = document.getElementById('root')
if (!raiz) throw new Error('Elemento #root não encontrado no index.html')

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={clienteQuery}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
