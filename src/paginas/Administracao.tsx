import { Link } from 'react-router'
import { CalendarClock, KeyRound, Settings2, UsersRound } from 'lucide-react'
import { Botao } from '@/componentes/ui'

/**
 * Rota exclusiva de ADMIN (RF-24) — hoje serve de prova da navegação por papel
 * (operador e líder são barrados aqui, inclusive por URL direta).
 * O painel admin completo é a SESSAO-14.
 */
export function Administracao() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl">Administração</h1>
        <p className="mt-1 max-w-2xl text-texto-suave">
          {/* O painel completo é a SESSAO-14 — código fora da tela (D-27). */}
          Área exclusiva do admin. A consolidação completa (setores, etapas, automações, chaves
          de API) chega em breve — por enquanto, a gestão de pessoas vive na Equipe.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/equipe">
          <Botao variante="secundaria" icone={<UsersRound />}>
            Gestão da equipe
          </Botao>
        </Link>
        <Link to="/estrutura">
          <Botao variante="secundaria" icone={<Settings2 />}>
            Setores e etapas
          </Botao>
        </Link>
        {/* SESSAO-07/D-29: horários de funcionamento, pausas e correção retroativa. */}
        <Link to="/administracao/tempo">
          <Botao variante="secundaria" icone={<CalendarClock />}>
            Controle de tempo
          </Botao>
        </Link>
        {/* SESSAO-11: chaves de API e webhooks de saída. */}
        <Link to="/administracao/api">
          <Botao variante="secundaria" icone={<KeyRound />}>
            API e integrações
          </Botao>
        </Link>
      </div>
    </div>
  )
}
