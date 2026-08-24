import { Route, Routes } from 'react-router'
import { Layout } from '@/componentes/Layout'
import { ProvedorNotificacao } from '@/componentes/ui'
import { Inicio } from '@/paginas/Inicio'
import { DesignSystem } from '@/paginas/DesignSystem'

export function App() {
  return (
    <ProvedorNotificacao>
      <Layout>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/design" element={<DesignSystem />} />
          <Route path="*" element={<Inicio />} />
        </Routes>
      </Layout>
    </ProvedorNotificacao>
  )
}
