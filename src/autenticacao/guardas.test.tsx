import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ContextoSessao, type EstadoSessao } from './sessao-contexto'
import { RotaModoTv, RotaProtegida } from './guardas'
import type { Perfil } from './tipos'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const perfil = (p: Partial<Perfil>): Perfil =>
  ({
    id: 'p1',
    nome: 'Painel',
    usuario: 'painel',
    email: 'p@p',
    telefone: null,
    matricula: null,
    papel: 'operador',
    senha_padrao: false,
    ativo: true,
    arquivado_em: null,
    tema: 'claro',
    foto_caminho: null,
    modulos: [],
    ...p,
  }) as Perfil

function abrir(caminho: string, p: Perfil) {
  const sessao: EstadoSessao = {
    carregando: false,
    sessao: {} as EstadoSessao['sessao'],
    perfil: p,
    vinculos: [],
    ehLider: p.papel === 'admin',
    recarregarPerfil: async () => {},
    sair: async () => {},
  }
  return render(
    <ContextoSessao.Provider value={sessao}>
      <MemoryRouter initialEntries={[caminho]}>
        <Routes>
          <Route element={<RotaProtegida />}>
            <Route path="/inicio/meu-painel" element={<p>meu painel</p>} />
            <Route path="/dashboards/tempos-de-producao" element={<p>tempos</p>} />
            <Route element={<RotaModoTv />}>
              <Route path="/dashboards/modo-tv" element={<p>a tv</p>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </ContextoSessao.Provider>,
  )
}

// SESSAO-43 (F3): a conta só da TV vive na TV; o admin com a permissão abre a TV;
// quem não tem a permissão não abre.
describe('as guardas do Modo TV', () => {
  it('a conta só da TV que tenta outra tela cai na TV', () => {
    abrir('/inicio/meu-painel', perfil({ modulos: ['tv'] }))
    expect(screen.getByText('a tv')).toBeInTheDocument()
  })

  it('a conta só da TV que tenta a tela de tempos também cai na TV', () => {
    abrir('/dashboards/tempos-de-producao', perfil({ modulos: ['tv'] }))
    expect(screen.getByText('a tv')).toBeInTheDocument()
  })

  it('quem não tem a permissão não abre a TV (volta ao painel)', () => {
    abrir('/dashboards/modo-tv', perfil({ modulos: ['fabrica'] }))
    expect(screen.getByText('meu painel')).toBeInTheDocument()
  })

  it('o admin abre a TV (com ou sem o botão); quem tem a permissão junto da fábrica também', () => {
    abrir('/dashboards/modo-tv', perfil({ papel: 'admin', modulos: ['fabrica'] }))
    expect(screen.getByText('a tv')).toBeInTheDocument()
  })
})
