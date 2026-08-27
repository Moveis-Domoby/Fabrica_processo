import { Navigate, Route, Routes } from 'react-router'
import { Layout } from '@/componentes/Layout'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ProvedorSessao } from '@/autenticacao/ProvedorSessao'
import { RotaProtegida } from '@/autenticacao/guardas'
import { Inicio } from '@/paginas/Inicio'
import { DesignSystem } from '@/paginas/DesignSystem'
import { Entrar } from '@/paginas/Entrar'
import { Convite } from '@/paginas/Convite'
import { TrocarSenha } from '@/paginas/TrocarSenha'
import { Equipe } from '@/paginas/Equipe'
import { ModoTablet } from '@/paginas/ModoTablet'
import { Administracao } from '@/paginas/Administracao'
import { PCP } from '@/paginas/PCP'
import { QuadroSetor } from '@/paginas/QuadroSetor'
import { Expedicao } from '@/paginas/Expedicao'
import { Estrutura } from '@/paginas/Estrutura'

export function App() {
  return (
    <ProvedorSessao>
      <ProvedorNotificacao>
        <Layout>
          <Routes>
            {/* públicas: login e convite — sem autocadastro (D-21) */}
            <Route path="/entrar" element={<Entrar />} />
            <Route path="/convite/:token" element={<Convite />} />
            <Route path="/design" element={<DesignSystem />} />

            {/* qualquer papel logado e aprovado */}
            <Route element={<RotaProtegida />}>
              <Route path="/" element={<Inicio />} />
              <Route path="/trocar-senha" element={<TrocarSenha />} />
              <Route path="/tablet" element={<ModoTablet />} />
              {/* kanban (SESSAO-04): as páginas conferem o acesso por setor */}
              <Route path="/pcp" element={<PCP />} />
              <Route path="/setores/:id" element={<QuadroSetor />} />
              <Route path="/expedicao" element={<Expedicao />} />
            </Route>

            {/* líder (de algum setor) ou admin */}
            <Route element={<RotaProtegida nivel="lider" />}>
              <Route path="/equipe" element={<Equipe />} />
              <Route path="/estrutura" element={<Estrutura />} />
            </Route>

            {/* só admin */}
            <Route element={<RotaProtegida nivel="admin" />}>
              <Route path="/administracao" element={<Administracao />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </ProvedorNotificacao>
    </ProvedorSessao>
  )
}
