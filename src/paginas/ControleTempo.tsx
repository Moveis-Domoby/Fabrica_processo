import { lazy, Suspense, type ComponentType } from 'react'
import { useSearchParams } from 'react-router'
import {
  Boxes,
  CalendarDays,
  Clock,
  Hourglass,
  RefreshCw,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import { Abas, type Aba } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { EstadoDaLeitura } from './controleTempo/comum'

type AbaTempo =
  'expediente' | 'calendario' | 'hora-extra' | 'regras' | 'equipe' | 'modelos' | 'recalculo'

function pedaco<M extends Record<string, unknown>>(carregar: () => Promise<M>, nome: keyof M) {
  return lazy(() => carregar().then((m) => ({ default: m[nome] as ComponentType })))
}

// Cada aba é um pedaço próprio: o código e a leitura dela só chegam no clique.
const PAINEIS: Record<AbaTempo, ComponentType> = {
  expediente: pedaco(() => import('./controleTempo/AbaExpediente'), 'AbaExpediente'),
  calendario: pedaco(() => import('./controleTempo/AbaCalendario'), 'AbaCalendario'),
  'hora-extra': pedaco(() => import('./controleTempo/AbaHoraExtra'), 'AbaHoraExtra'),
  regras: pedaco(() => import('./controleTempo/AbaRegras'), 'AbaRegras'),
  equipe: pedaco(() => import('./controleTempo/AbaEquipe'), 'AbaEquipe'),
  modelos: pedaco(() => import('./controleTempo/AbaModelos'), 'AbaModelos'),
  recalculo: pedaco(() => import('./controleTempo/AbaRecalculo'), 'AbaRecalculo'),
}

const TODAS: Aba<AbaTempo>[] = [
  { valor: 'expediente', rotulo: 'Expediente e intervalos', icone: <Clock aria-hidden /> },
  { valor: 'calendario', rotulo: 'Calendário', icone: <CalendarDays aria-hidden /> },
  { valor: 'hora-extra', rotulo: 'Hora extra', icone: <Hourglass aria-hidden /> },
  { valor: 'regras', rotulo: 'Regras por setor', icone: <SlidersHorizontal aria-hidden /> },
  { valor: 'equipe', rotulo: 'Equipe no painel', icone: <Users aria-hidden /> },
  { valor: 'modelos', rotulo: 'Modelos', icone: <Boxes aria-hidden /> },
  { valor: 'recalculo', rotulo: 'Recálculo', icone: <RefreshCw aria-hidden /> },
]

/**
 * Configurações → Controle de tempo (SESSAO-42 · F2): uma tela de abas, uma
 * porta do banco por aba, lida só quando a aba abre (regra 17). A aba ativa
 * mora na URL (`?aba=`). O administrador vê as sete; o líder de setor vê só a
 * Hora extra (a porta dela já filtra os setores dele).
 */
export function ControleTempo() {
  const { perfil } = useSessao()
  const [parametros, setParametros] = useSearchParams()
  const souAdmin = perfil?.papel === 'admin'
  const abas = souAdmin ? TODAS : TODAS.filter((a) => a.valor === 'hora-extra')
  const padrao: AbaTempo = souAdmin ? 'expediente' : 'hora-extra'
  const pedida = parametros.get('aba')
  const aba = abas.find((a) => a.valor === pedida)?.valor ?? padrao
  const Painel = PAINEIS[aba]

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">Controle de tempo</h1>
        <p className="mt-1 max-w-2xl text-texto-suave">
          {souAdmin
            ? 'Quando o tempo conta, o que entra na média e como os tempos são refeitos. O que já foi registrado nunca muda — estes ajustes valem para o cálculo.'
            : 'A hora extra dos setores que você lidera.'}
        </p>
      </div>

      {abas.length > 1 && (
        <Abas
          rotulo="Partes do controle de tempo"
          idBase="controle-tempo"
          abas={abas}
          valor={aba}
          aoMudar={(valor) => {
            const novos = new URLSearchParams(parametros)
            if (valor === padrao) novos.delete('aba')
            else novos.set('aba', valor)
            setParametros(novos, { replace: true })
          }}
        />
      )}

      <div
        role={abas.length > 1 ? 'tabpanel' : undefined}
        id="controle-tempo-painel"
        aria-labelledby={abas.length > 1 ? `controle-tempo-aba-${aba}` : undefined}
      >
        <Suspense fallback={<EstadoDaLeitura carregando erro={null} />}>
          <Painel />
        </Suspense>
      </div>
    </div>
  )
}
