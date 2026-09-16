import { Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import { Layout } from '@/componentes/Layout'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ProvedorSessao } from '@/autenticacao/ProvedorSessao'
import { RotaModulo, RotaProtegida } from '@/autenticacao/guardas'
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
import { PainelRecompra } from '@/comercial/paginas/PainelRecompra'
import { DashboardComercial } from '@/comercial/paginas/DashboardComercial'
import { ListasDisparoIndice } from '@/comercial/paginas/ListasDisparoIndice'
import { ListaDetalhe } from '@/comercial/paginas/ListaDetalhe'

/** /producao/{codigo} antigo → /fabrica/producao/{codigo} (bookmark não quebra). */
function RedirecionarProducaoAntiga() {
  const { codigo } = useParams()
  return <Navigate to={`/fabrica/producao/${codigo}`} replace />
}

/** Prefixo antigo → novo preservando o resto do caminho (ex.: /logistica/*). */
function RedirecionarComPrefixo({ de, para }: { de: string; para: string }) {
  const { pathname } = useLocation()
  return <Navigate to={pathname.replace(de, para)} replace />
}

/**
 * Lei de navegação (SESSAO-13): toda rota é /pai/filho — pai nunca é rota
 * navegável, só direciona ao primeiro filho. Fora da lei ficam apenas as
 * rotas de casca, sem navegação por natureza: /entrar, /convite, /trocar-senha
 * e /tablet (o modo do galpão). Toda rota antiga redireciona para a nova —
 * nenhum bookmark de tablet pode quebrar.
 *
 * ↪️ SESSAO-20 (D-46): "Fábrica" virou pai de Controle de Produção, Logística
 * e ROTAS (/fabrica/producao|logistica|rotas/...), e nasceu o pai "Comercial"
 * (/comercial/...). Acesso por módulo (plt_usuarios.modulos): sem o módulo,
 * o grupo some do menu e a URL direta redireciona (RotaModulo). /tablet
 * continua intocada.
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

              {/* o modo do galpão: sem navegação nenhuma (D-06/D-28) */}
              <Route path="/tablet" element={<TelaSetor />} />

              {/* Fábrica (D-46) — Controle de Produção, Logística e ROTAS */}
              <Route element={<RotaModulo modulo="fabrica" />}>
                <Route path="/fabrica/producao/:codigo" element={<ProducaoSetor />} />
                <Route path="/fabrica/logistica/expedicao" element={<Expedicao />} />
                <Route path="/fabrica/logistica/estoque" element={<Estoque />} />
                <Route path="/fabrica/logistica/pedidos-em-aguardo" element={<PedidosAguardo />} />
                <Route path="/fabrica/logistica/danificados" element={<Danificados />} />
                <Route path="/fabrica/rotas/entregas" element={<Rotas />} />
                <Route path="/fabrica/rotas/programacao" element={<Programacao />} />
              </Route>

              {/* Comercial (D-46) — o Painel de Recompra dentro da plataforma */}
              <Route element={<RotaModulo modulo="comercial" />}>
                <Route path="/comercial/recompra" element={<PainelRecompra />} />
                <Route path="/comercial/dashboard" element={<DashboardComercial />} />
                <Route path="/comercial/listas" element={<ListasDisparoIndice />} />
                <Route path="/comercial/listas/:id" element={<ListaDetalhe />} />
              </Route>
            </Route>

            {/* líder (de algum setor) ou admin */}
            <Route element={<RotaProtegida nivel="lider" />}>
              <Route element={<RotaModulo modulo="fabrica" />}>
                <Route path="/dashboards/geral" element={<Dashboards />} />
              </Route>
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
            <Route path="/fabrica" element={<Navigate to="/fabrica/producao/pcp" replace />} />
            <Route path="/fabrica/producao" element={<Navigate to="/fabrica/producao/pcp" replace />} />
            <Route path="/fabrica/logistica" element={<Navigate to="/fabrica/logistica/expedicao" replace />} />
            <Route path="/fabrica/rotas" element={<Navigate to="/fabrica/rotas/entregas" replace />} />
            <Route path="/comercial" element={<Navigate to="/comercial/recompra" replace />} />
            <Route path="/dashboards" element={<Navigate to="/dashboards/geral" replace />} />
            <Route path="/admin" element={<Navigate to="/admin/equipe" replace />} />

            {/* rotas antigas → novas (bookmarks dos tablets não quebram) */}
            <Route path="/producao" element={<Navigate to="/fabrica/producao/pcp" replace />} />
            <Route path="/producao/:codigo" element={<RedirecionarProducaoAntiga />} />
            <Route
              path="/logistica/*"
              element={<RedirecionarComPrefixo de="/logistica" para="/fabrica/logistica" />}
            />
            <Route
              path="/rotas/*"
              element={<RedirecionarComPrefixo de="/rotas" para="/fabrica/rotas" />}
            />
            <Route path="/afazeres" element={<Navigate to="/inicio/afazeres" replace />} />
            <Route path="/pcp" element={<Navigate to="/fabrica/producao/pcp" replace />} />
            <Route element={<RotaProtegida />}>
              <Route path="/setores/:id" element={<RedirecionarSetorAntigo />} />
            </Route>
            <Route path="/expedicao" element={<Navigate to="/fabrica/logistica/expedicao" replace />} />
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
