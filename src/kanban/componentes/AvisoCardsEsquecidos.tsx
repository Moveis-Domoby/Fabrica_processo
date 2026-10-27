import { AlarmClock, Pause, UserCheck } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import { horaDoAviso, nomeDoEsquecido } from '../cardEsquecido'
import type { CardEsquecido } from '../cardEsquecido'

/**
 * SESSAO-41 · ajuste do dono (D-198): a pergunta do CARD ESQUECIDO no quadro
 * do setor — no tablet, quem responde digita o PIN (a tela pede depois do
 * toque). Vem no MESMO pedido do quadro (`esquecidos`), mesmo que o card esteja
 * fora da primeira página da coluna; some sozinha quando alguém responde ou o
 * card para (o canal do setor relê o quadro).
 */
export function AvisoCardsEsquecidos({
  itens,
  ocupado,
  aoResponder,
}: {
  itens: CardEsquecido[]
  ocupado: boolean
  aoResponder: (item: CardEsquecido, aindaTem: boolean) => void
}) {
  if (itens.length === 0) return null
  return (
    <section
      aria-label="Cards esquecidos"
      className="mb-3 flex flex-col gap-2 rounded-dm-lg border-2 border-atencao-borda bg-atencao-fundo p-3"
    >
      {itens.map((item) => (
        <div
          key={item.card_id}
          className="flex flex-col gap-3 lg:flex-row lg:items-center"
          role="alert"
        >
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <AlarmClock aria-hidden className="mt-0.5 size-7 shrink-0 text-atencao-texto" />
            <div className="min-w-0">
              <p className="text-lg font-semibold text-texto">
                Ainda tem alguém neste card? — {nomeDoEsquecido(item)}
              </p>
              <p className="text-sm text-texto-suave">
                Rodando há mais de 2 h sem parar
                {item.executor ? `, com ${item.executor}` : ''} · aviso das{' '}
                {horaDoAviso(item.aviso_em)}. Se ninguém está nele, pause: o tempo depois do aviso
                não conta como trabalho.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Botao
              tamanho="lg"
              icone={<UserCheck />}
              disabled={ocupado}
              onClick={() => aoResponder(item, true)}
            >
              Sim, ainda tem gente
            </Botao>
            <Botao
              tamanho="lg"
              variante="secundaria"
              icone={<Pause />}
              disabled={ocupado}
              onClick={() => aoResponder(item, false)}
            >
              Não, pausar o card
            </Botao>
          </div>
        </div>
      ))}
    </section>
  )
}
