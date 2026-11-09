import { useState } from 'react'
import type { ReactNode } from 'react'
import { CalendarCheck, CalendarDays, CheckCircle2 } from 'lucide-react'
import { Botao, Campo } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { hojeNaFabrica } from '@/dashboards/tempos/formato'
import { diaNaFabrica, diaPorExtenso, problemaDoDia } from './diaDaEntrega'

export interface ConfirmarEntregaProps {
  /** O número do pedido (o leitor de tela ouve de qual entrega são os botões). */
  numero: number
  /** A pergunta de sempre, quando não há aviso. */
  pergunta?: string
  /**
   * O aviso do pedido que ainda aparece em produção (a frase pronta). Com ele
   * na tela, os dois botões de confirmar valem como a confirmação explícita.
   */
  aviso?: string | null
  /** Quando o pedido chegou à plataforma — o limite de baixo do dia, se a tela souber. */
  chegouEm?: string | null
  carregando: boolean
  /** `lg` no painel do entregador (celular na rua); `md` na lista da logística. */
  tamanho?: 'md' | 'lg'
  /** O dia escolhido (AAAA-MM-DD), ou nulo = hoje. */
  aoConfirmar: (dia: string | null) => void
  aoCancelar: () => void
  /** O que mais o painel pede antes de confirmar (comprovantes, observação). */
  children?: ReactNode
}

/**
 * O QUE APARECE DEPOIS DE TOCAR EM "ENTREGUE" (SESSAO-47 — pedido do dono), o
 * mesmo nos dois lugares em que se registra entrega (ROTAS → Entregas e as
 * Entregas do dia do entregador):
 *
 *   · "Confirmar entrega" — entrega com a data de hoje;
 *   · "Ainda não" — fecha sem registrar;
 *   · "Marcar como entregue no dia..." — abre a escolha do dia e confirma a
 *     entrega já com esse dia (nunca um dia que ainda não chegou; o banco
 *     confere de novo, e também o dia em que o pedido chegou à plataforma).
 *
 * Com peças ainda em produção, o aviso continua na tela e os dois botões de
 * confirmar valem como o "entregar mesmo assim" de antes — quem usa o
 * componente manda a confirmação junto.
 */
export function ConfirmarEntrega({
  numero,
  pergunta,
  aviso,
  chegouEm,
  carregando,
  tamanho = 'md',
  aoConfirmar,
  aoCancelar,
  children,
}: ConfirmarEntregaProps) {
  const [escolhendo, setEscolhendo] = useState(false)
  const [dia, setDia] = useState('')
  // em qual botão a pessoa tocou — o "carregando" gira só nele
  const [tocou, setTocou] = useState<'hoje' | 'dia' | null>(null)
  const hoje = hojeNaFabrica()
  const minimo = diaNaFabrica(chegouEm)
  const problema = dia ? problemaDoDia(dia, chegouEm, hoje) : null
  // o texto comprido quebra a linha DENTRO do botão (a altura da casa é fixa)
  const alto = cn(tamanho === 'lg' ? 'min-h-toque-lg' : 'min-h-toque-md', 'py-1.5 text-center')

  return (
    <div
      role="group"
      aria-label={`Confirmar a entrega do pedido ${numero}`}
      className="flex flex-col gap-3"
    >
      {aviso ? (
        <p
          role="alert"
          className="rounded-dm border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto"
        >
          {aviso}
        </p>
      ) : (
        pergunta && (
          <p className={cn('text-sm text-texto-suave', tamanho === 'md' && 'sm:text-right')}>
            {pergunta}
          </p>
        )
      )}

      {children}

      {escolhendo && (
        // na lista da logística (tela larga) o campo fica junto dos botões, à direita
        <div className={cn(tamanho === 'md' && 'sm:ml-auto sm:w-80')}>
          <Campo
            rotulo="Em que dia foi entregue?"
            type="date"
            value={dia}
            min={minimo ?? undefined}
            max={hoje}
            onChange={(e) => setDia(e.target.value)}
            erro={problema ?? undefined}
            ajuda="Vale até hoje — não dá para marcar um dia que ainda não chegou."
          />
        </div>
      )}

      <div
        className={cn(
          'gap-2',
          tamanho === 'lg'
            ? 'grid grid-cols-1 sm:grid-cols-2'
            : 'flex flex-wrap items-center justify-end',
        )}
      >
        {escolhendo ? (
          <Botao
            type="button"
            tamanho={tamanho}
            icone={<CalendarCheck />}
            style={{ height: 'auto' }}
            className={alto}
            disabled={!dia || problema !== null || carregando}
            carregando={carregando && tocou === 'dia'}
            onClick={() => {
              setTocou('dia')
              aoConfirmar(dia)
            }}
          >
            {dia && !problema
              ? `Marcar como entregue em ${diaPorExtenso(dia)}`
              : 'Escolha o dia da entrega'}
          </Botao>
        ) : (
          <>
            <Botao
              type="button"
              tamanho={tamanho}
              icone={<CheckCircle2 />}
              style={{ height: 'auto' }}
              className={alto}
              disabled={carregando}
              carregando={carregando && tocou === 'hoje'}
              onClick={() => {
                setTocou('hoje')
                aoConfirmar(null)
              }}
            >
              Confirmar entrega
            </Botao>
            <Botao
              type="button"
              tamanho={tamanho}
              variante="secundaria"
              icone={<CalendarDays />}
              style={{ height: 'auto' }}
              className={alto}
              disabled={carregando}
              onClick={() => setEscolhendo(true)}
            >
              Marcar como entregue no dia...
            </Botao>
          </>
        )}
        <Botao
          type="button"
          tamanho={tamanho}
          variante="fantasma"
          className={cn(tamanho === 'lg' && !escolhendo && 'sm:col-span-2')}
          disabled={carregando}
          onClick={aoCancelar}
        >
          Ainda não
        </Botao>
      </div>
    </div>
  )
}
