import { Navigate, Route, Routes } from 'react-router'
import { Layout } from '@/componentes/Layout'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ProvedorSessao } from '@/autenticacao/ProvedorSessao'
import { RotaProtegida } from '@/autenticacao/guardas'
import { Inicio } from '@/paginas/Inicio'
import { Entrar } from '@/paginas/Entrar'
import { Convite } from '@/paginas/Convite'
import { TrocarSenha } from '@/paginas/TrocarSenha'
import { Equipe } from '@/paginas/Equipe'
import { TelaSetor } from '@/paginas/TelaSetor'
import { Administracao } from '@/paginas/Administracao'
import { ControleTempo } from '@/paginas/ControleTempo'
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
            {/* A rota /design saiu: o modelo de sistema vive no cofre (D-27). */}

            {/* qualquer papel logado e aprovado */}
            <Route element={<RotaProtegida />}>
              <Route path="/" element={<Inicio />} />
              <Route path="/trocar-senha" element={<TrocarSenha />} />
              {/* A tela do chão de fábrica (SESSAO-07): fila do setor + PIN. */}
              <Route path="/tablet" element={<TelaSetor />} />
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
              {/* Controle de tempo do admin (SESSAO-07/D-29). */}
              <Route path="/administracao/tempo" element={<ControleTempo />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </ProvedorNotificacao>
    </ProvedorSessao>
  )
}
