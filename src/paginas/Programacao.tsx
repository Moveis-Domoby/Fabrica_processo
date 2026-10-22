import { useCallback } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { CalendarCheck, CalendarDays, Route, Truck } from 'lucide-react'
import { Abas } from '@/componentes/ui'
import type { Aba } from '@/componentes/ui'
import { useAcessoLogistica } from '@/logistica/acesso'
import { AbaCalendario } from '@/rotas/AbaCalendario'
import { AbaJaProgramadas } from '@/rotas/AbaJaProgramadas'
import { AbaProgramar } from '@/rotas/AbaProgramar'

type AbaProgramacao = 'programar' | 'programadas' | 'calendario'

const ABAS: Aba<AbaProgramacao>[] = [
  { valor: 'programar', rotulo: 'Programar', icone: <Truck /> },
  { valor: 'programadas', rotulo: 'Já programadas', icone: <CalendarCheck /> },
  // SESSAO-39 (D-175): o calendário — um MODO de ver a programação (o do ClickUp do dono)
  { valor: 'calendario', rotulo: 'Calendário', icone: <CalendarDays /> },
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
 *   escolhido (`?dia=&caminhao=&rota=`) acende no mapa e a ordem dele se
 *   arrasta e se salva. ↪️ SESSAO-31 (D-128): o caminhão faz várias rotas no
 *   dia — cada rota com a sua ordem e a sua equipe. O "dia lá em cima" da versão anterior saiu: o dia agora se escolhe
 *   ao programar, e as programações de todos os dias estão nesta aba.
 *
 * - **Calendário** (SESSAO-39 · D-175) — a programação num calendário de
 *   semana (domingo a sábado) ou de mês, como o da lista ROTAS do ClickUp:
 *   cada pedido no seu dia, na cor da situação; a barra na rota abre a rota
 *   em "Já programadas".
 *
 * Cada aba só busca o que ela mostra, e só quando está aberta (regra 17).
 */
export function Programacao() {
  const { perfil, semAcesso, tenhoAcesso } = useAcessoLogistica()
  const [parametros, setParametros] = useSearchParams()
  const pedida = parametros.get('aba')
  const aba: AbaProgramacao =
    pedida === 'programadas' || pedida === 'calendario' ? pedida : 'programar'
  const diaFoco = parametros.get('dia')
  const caminhaoFoco = Number(parametros.get('caminhao'))
  const rotaFoco = Math.max(1, Number(parametros.get('rota')) || 1)
  const foco =
    diaFoco && caminhaoFoco > 0 ? { dia: diaFoco, caminhaoId: caminhaoFoco, rota: rotaFoco } : null

  const irPara = useCallback(
    (proxima: AbaProgramacao, focoNovo?: { dia: string; caminhaoId: number; rota: number }) => {
      setParametros((atual) => {
        const novos = new URLSearchParams(atual)
        if (proxima === 'programar') novos.delete('aba')
        else novos.set('aba', proxima)
        if (focoNovo) {
          novos.set('dia', focoNovo.dia)
          novos.set('caminhao', String(focoNovo.caminhaoId))
          novos.set('rota', String(focoNovo.rota))
        }
        return novos
      })
    },
    [setParametros],
  )
  const focar = useCallback(
    (dia: string, caminhaoId: number, rota: number) =>
      irPara('programadas', { dia, caminhaoId, rota }),
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
              ? 'Marque os pedidos que vão, arraste para acertar a ordem, veja a rota pelas ruas (é só sugestão — a decisão é sua) e confirme com o dia, o caminhão e a rota.'
              : aba === 'calendario'
                ? 'A programação no calendário: cada pedido no dia da rota ou, sem rota, no dia da previsão de entrega — na cor da situação. Toque num pedido na rota para abrir a rota.'
                : 'Tudo o que já está programado, por dia, caminhão e rota. Escolha uma rota para ver no mapa e acertar a ordem.'}
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
        ) : aba === 'calendario' ? (
          <AbaCalendario
            ativa={tenhoAcesso}
            aoFocar={focar}
            aoProgramar={() => irPara('programar')}
          />
        ) : (
          <AbaJaProgramadas ativa={tenhoAcesso} foco={foco} aoFocar={focar} />
        )}
      </div>
    </div>
  )
}
