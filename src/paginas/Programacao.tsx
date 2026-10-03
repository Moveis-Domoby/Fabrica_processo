import { useCallback } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { CalendarCheck, Route, Truck } from 'lucide-react'
import { Abas } from '@/componentes/ui'
import type { Aba } from '@/componentes/ui'
import { useAcessoLogistica } from '@/logistica/acesso'
import { AbaJaProgramadas } from '@/rotas/AbaJaProgramadas'
import { AbaProgramar } from '@/rotas/AbaProgramar'

type AbaProgramacao = 'programar' | 'programadas'

const ABAS: Aba<AbaProgramacao>[] = [
  { valor: 'programar', rotulo: 'Programar', icone: <Truck /> },
  { valor: 'programadas', rotulo: 'Já programadas', icone: <CalendarCheck /> },
]

/**
 * ROTAS → Programação (SESSAO-15 / D-39 / D-45 → SESSAO-28 / D-108…D-110 →
 * ajustes de 03/10, D-111): duas abas FILHAS da mesma tela (não são rotas —
 * D-36), na URL (`?aba=`) para o Voltar e o link funcionarem:
 *
 * - **Programar** — os pedidos lançados SEM programação: marcar sobe para "Na
 *   rota" (arrastar muda a ordem), a rota pelas ruas da fábrica à fábrica com
 *   trechos e totais, os móveis de cada pedido, e Programar = dia + caminhão.
 * - **Já programadas** — todas as programações não entregues (e as entregues,
 *   se pedir), por dia e por caminhão, cada caminhão com a sua cor; o caminhão
 *   escolhido (`?dia=&caminhao=`) acende no mapa e a ordem dele se arrasta e se
 *   salva. O "dia lá em cima" da versão anterior saiu: o dia agora se escolhe
 *   ao programar, e as programações de todos os dias estão nesta aba.
 *
 * Cada aba só busca o que ela mostra, e só quando está aberta (regra 17).
 */
export function Programacao() {
  const { perfil, semAcesso, tenhoAcesso } = useAcessoLogistica()
  const [parametros, setParametros] = useSearchParams()
  const aba: AbaProgramacao = parametros.get('aba') === 'programadas' ? 'programadas' : 'programar'
  const diaFoco = parametros.get('dia')
  const caminhaoFoco = Number(parametros.get('caminhao'))
  const foco = diaFoco && caminhaoFoco > 0 ? { dia: diaFoco, caminhaoId: caminhaoFoco } : null

  const irPara = useCallback(
    (proxima: AbaProgramacao, focoNovo?: { dia: string; caminhaoId: number }) => {
      setParametros((atual) => {
        const novos = new URLSearchParams(atual)
        if (proxima === 'programar') novos.delete('aba')
        else novos.set('aba', proxima)
        if (focoNovo) {
          novos.set('dia', focoNovo.dia)
          novos.set('caminhao', String(focoNovo.caminhaoId))
        }
        return novos
      })
    },
    [setParametros],
  )
  const focar = useCallback(
    (dia: string, caminhaoId: number) => irPara('programadas', { dia, caminhaoId }),
    [irPara],
  )

  if (semAcesso) return <Navigate to="/" replace />
  if (!perfil) return null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl sm:text-3xl">
            <Route aria-hidden className="size-7 text-texto-suave" />
            Programação de caminhão
          </h1>
          <p className="mt-1 max-w-2xl text-texto-suave">
            {aba === 'programar'
              ? 'Marque os pedidos que vão, arraste para acertar a ordem, veja a rota pelas ruas (é só sugestão — a decisão é sua) e confirme com o dia e o caminhão.'
              : 'Tudo o que já está programado, por dia e por caminhão. Escolha um caminhão para ver a rota dele no mapa e acertar a ordem.'}
          </p>
        </div>
        <Abas
          rotulo="Programação"
          abas={ABAS}
          valor={aba}
          aoMudar={(v) => irPara(v)}
          idBase="programacao"
        />
      </div>

      <div role="tabpanel" id="programacao-painel" aria-labelledby={`programacao-aba-${aba}`}>
        {aba === 'programar' ? (
          <AbaProgramar ativa={tenhoAcesso} aoProgramar={focar} />
        ) : (
          <AbaJaProgramadas ativa={tenhoAcesso} foco={foco} aoFocar={focar} />
        )}
      </div>
    </div>
  )
}
