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
import { aplicarTema, temaGuardado } from './perfil/tema'
import { preCarregar } from './navegacao/pedacos'
import { iniciarMedicao } from './lib/medicao'
import { aplicarOpacidade, opacidadeGuardada } from './lib/opacidadeFlutuantes'
import { aoPedacoSumido, contextoDaCarga } from './lib/recarga'

// SESSAO-48 (frente 5): como esta página foi aberta (navegou, atualizou, aba
// descartada, ou a própria plataforma recarregou — e por quê), lido JÁ: o
// porquê guardado na aba é consumido aqui e vai na 1ª abertura para a trilha.
contextoDaCarga()

// O último tema usado neste navegador entra ANTES do primeiro quadro pintado —
// sem isso a tela pisca clara até o perfil chegar. O perfil confirma depois.
aplicarTema(temaGuardado())
// ↩️ 06/11: a transparência dos botões flutuantes escolhida neste aparelho.
aplicarOpacidade(opacidadeGuardada())

// SESSAO-32 (Lei §9): o pedaço da 1ª tela começa a baixar junto com a casca —
// não espera o React montar para descobrir que precisa dele.
preCarregar(
  ['/', '/entrar'].includes(window.location.pathname)
    ? '/inicio/meu-painel'
    : window.location.pathname,
)

// SESSAO-32 (D-137): a plataforma mede a própria velocidade em cada abertura.
iniciarMedicao()

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
// SESSAO-32 (Lei §3): os setores chegam na abertura do app e quase nunca mudam
// — nenhuma tela relê a lista por ter passado 30 s. Quem edita um setor
// invalida a chave e a lista nova vem na hora.
clienteQuery.setQueryDefaults(['setores'], { staleTime: Infinity })

// SESSAO-32 (Lei §9): com o pacote dividido por tela, quem ficou com a
// plataforma aberta desde antes de uma atualização pode pedir um pedaço que
// não existe mais (o nome muda a cada versão). Recarrega a página — a versão
// nova traz os pedaços novos.
// ↩️ SESSAO-48 (frente 5): mostra "Atualizando a plataforma…" e recarrega UMA
// vez por versão (a guarda fica na aba — nunca em laço); sem internet, ou se a
// mesma versão falhar de novo, só o aviso com o botão "Atualizar".
window.addEventListener('vite:preloadError', aoPedacoSumido)

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
