import { Navigate, Route, Routes } from 'react-router'
import { Layout } from '@/componentes/Layout'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ProvedorSessao } from '@/autenticacao/ProvedorSessao'
import { RotaProtegida } from '@/autenticacao/guardas'
import { MeuPainel } from '@/paginas/MeuPainel'
import { Entrar } from '@/paginas/Entrar'
import { Convite } from '@/paginas/Convite'
import { TrocarSenha } from '@/paginas/TrocarSenha'
import { Equipe } from '@/paginas/Equipe'
import { TelaSetor } from '@/paginas/TelaSetor'
import { ControleTempo } from '@/paginas/ControleTempo'
import { Dashboards } from '@/paginas/Dashboards'
import { Expedicao } from '@/paginas/Expedicao'
import { Rotas } from '@/paginas/Rotas'
import { Afazeres } from '@/paginas/Afazeres'
import { AdminApi } from '@/paginas/AdminApi'
import { Estrutura } from '@/paginas/Estrutura'
import { MeuPerfil } from '@/paginas/MeuPerfil'
import { Estoque } from '@/paginas/Estoque'
import { PedidosAguardo } from '@/paginas/PedidosAguardo'
import { Danificados } from '@/paginas/Danificados'
import { Programacao } from '@/paginas/Programacao'
import { Caminhoes } from '@/paginas/Caminhoes'
import { ProducaoSetor, RedirecionarSetorAntigo } from '@/navegacao/ProducaoSetor'

/**
 * Lei de navegação (SESSAO-13): toda rota é /pai/filho — pai nunca é rota
 * navegável, só direciona ao primeiro filho. Fora da lei ficam apenas as
 * rotas de casca, sem navegação por natureza: /entrar, /convite, /trocar-senha
 * e /tablet (o modo do galpão). Toda rota antiga redireciona para a nova —
 * nenhum bookmark de tablet pode quebrar.
 */
export function App() {
  return (
    <ProvedorSessao>
      <ProvedorNotificacao>
        <Layout>
          <Routes>
            {/* públicas: login e convite — sem autocadastro (D-21) */}
            <Route path="/entrar" element={<Entrar />} />
            <Route path="/convite/:token" element={<Convite />} />

            {/* qualquer papel logado e aprovado */}
            <Route element={<RotaProtegida />}>
              <Route path="/trocar-senha" element={<TrocarSenha />} />

              {/* Início — a casa: pendências, avisos e o cockpit de metas */}
              <Route path="/inicio/meu-painel" element={<MeuPainel />} />
              <Route path="/inicio/afazeres" element={<Afazeres />} />
              {/* filho sem item de menu: abre pelo bloco do usuário no rodapé */}
              <Route path="/inicio/meu-perfil" element={<MeuPerfil />} />

              {/* Controle de Produção — um filho por setor cadastrado */}
              <Route path="/producao/:codigo" element={<ProducaoSetor />} />

              {/* Logística (SESSAO-15 / D-38) */}
              <Route path="/logistica/expedicao" element={<Expedicao />} />
              <Route path="/logistica/estoque" element={<Estoque />} />
              <Route path="/logistica/pedidos-em-aguardo" element={<PedidosAguardo />} />
              <Route path="/logistica/danificados" element={<Danificados />} />

              {/* ROTAS (D-39): Entregas e Programação */}
              <Route path="/rotas/entregas" element={<Rotas />} />
              <Route path="/rotas/programacao" element={<Programacao />} />

              {/* o modo do galpão: sem navegação nenhuma (D-06/D-28) */}
              <Route path="/tablet" element={<TelaSetor />} />
            </Route>

            {/* líder (de algum setor) ou admin */}
            <Route element={<RotaProtegida nivel="lider" />}>
              <Route path="/dashboards/geral" element={<Dashboards />} />
              <Route path="/admin/equipe" element={<Equipe />} />
              <Route path="/admin/setores-e-etapas" element={<Estrutura />} />
            </Route>

            {/* só admin */}
            <Route element={<RotaProtegida nivel="admin" />}>
              <Route path="/admin/tempo" element={<ControleTempo />} />
              <Route path="/admin/api" element={<AdminApi />} />
              <Route path="/admin/caminhoes" element={<Caminhoes />} />
            </Route>

            {/* pais nunca navegam: cada um direciona ao primeiro filho */}
            <Route path="/inicio" element={<Navigate to="/inicio/meu-painel" replace />} />
            <Route path="/producao" element={<Navigate to="/producao/pcp" replace />} />
            <Route path="/logistica" element={<Navigate to="/logistica/expedicao" replace />} />
            <Route path="/rotas" element={<Navigate to="/rotas/entregas" replace />} />
            <Route path="/dashboards" element={<Navigate to="/dashboards/geral" replace />} />
            <Route path="/admin" element={<Navigate to="/admin/equipe" replace />} />

            {/* rotas antigas → novas (bookmarks dos tablets não quebram) */}
            <Route path="/afazeres" element={<Navigate to="/inicio/afazeres" replace />} />
            <Route path="/pcp" element={<Navigate to="/producao/pcp" replace />} />
            <Route element={<RotaProtegida />}>
              <Route path="/setores/:id" element={<RedirecionarSetorAntigo />} />
            </Route>
            <Route path="/expedicao" element={<Navigate to="/logistica/expedicao" replace />} />
            <Route path="/equipe" element={<Navigate to="/admin/equipe" replace />} />
            <Route path="/estrutura" element={<Navigate to="/admin/setores-e-etapas" replace />} />
            <Route path="/administracao" element={<Navigate to="/admin/equipe" replace />} />
            <Route path="/administracao/tempo" element={<Navigate to="/admin/tempo" replace />} />
            <Route path="/administracao/api" element={<Navigate to="/admin/api" replace />} />

            {/* nenhuma rota solta na raiz: tudo desemboca no Meu painel */}
            <Route path="/" element={<Navigate to="/inicio/meu-painel" replace />} />
            <Route path="*" element={<Navigate to="/inicio/meu-painel" replace />} />
          </Routes>
        </Layout>
      </ProvedorNotificacao>
    </ProvedorSessao>
  )
}
