import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  Equal,
  FileClock,
  HandHelping,
  Layers,
  Loader2,
  Scissors,
  ShieldAlert,
  Undo2,
  Wrench,
} from 'lucide-react'
import { AvatarPessoa, Botao, Campo, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { listarMotivos } from '@/rotas/api'
import {
  decidirTempo,
  type Decisao,
  type MapaPessoas,
  type Origem,
  type Situacao,
} from '@/dashboards/tempos/api'
import { contraPadrao, duracao, primeiroNome } from '@/dashboards/tempos/formato'

/** Uma pessoa: a foto (ou as iniciais) e o primeiro nome. */
export function ChipPessoa({ id, pessoas }: { id: string; pessoas: MapaPessoas }) {
  const p = pessoas[id]
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <AvatarPessoa nome={p?.nome ?? null} foto={p?.foto ?? null} tamanho="xs" />
      <span>{primeiroNome(p?.nome ?? 'Alguém')}</span>
    </span>
  )
}

/** Quem montou (dupla = os dois); sem ninguém = "Sem montador". */
export function Montadores({ ids, pessoas }: { ids: string[]; pessoas: MapaPessoas }) {
  if (ids.length === 0) return <span className="text-texto-fraco">Sem montador</span>
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {ids.map((id, i) => (
        <span key={id} className="inline-flex items-center gap-2">
          {i > 0 && (
            <span aria-hidden className="text-texto-fraco">
              +
            </span>
          )}
          <ChipPessoa id={id} pessoas={pessoas} />
        </span>
      ))}
    </span>
  )
}

/**
 * O tempo contra o padrão do modelo. Verde, laranja e vermelho são da
 * QUALIDADE (D-09 / regra das dashboards): aqui é seta + texto, sem cor de estado.
 */
export function ContraPadrao({
  segundos,
  padrao,
  faixaPct,
  mostrarPadrao = true,
}: {
  segundos: number | null
  padrao: number | null
  faixaPct: number
  mostrarPadrao?: boolean
}) {
  const c = contraPadrao(segundos, padrao, faixaPct)
  if (!c) return <span className="text-texto-fraco">sem padrão ainda</span>
  const Icone = c.tipo === 'rapido' ? ArrowDown : c.tipo === 'lento' ? ArrowUp : Equal
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      <Icone aria-hidden className="size-3.5 shrink-0 text-texto-suave" />
      <span className={cn(c.tipo !== 'media' && 'font-medium')}>{c.texto}</span>
      {mostrarPadrao && <span className="text-texto-fraco">(padrão {duracao(padrao)})</span>}
    </span>
  )
}

const ROTULO_SITUACAO: Partial<Record<Situacao, string>> = {
  conferir: 'Para conferir',
  sem_registro: 'Sem registro',
  retrabalho: 'Retrabalho',
  admin: 'Gesto de administrador',
  descartada: 'Descartada',
}

function Selo({
  icone,
  children,
  forte = false,
}: {
  icone?: ReactNode
  children: ReactNode
  forte?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        forte
          ? 'border border-acao-ativa bg-superficie text-texto'
          : 'bg-superficie-sutil text-texto-suave',
      )}
    >
      {icone}
      {children}
    </span>
  )
}

/** Os selos de uma montagem: a situação e o que aconteceu com ela (nunca só cor — M-12). */
export function SelosSituacao({
  situacao,
  motivo,
  lote,
  ajudantes = [],
  retrabalho,
  cortado,
  decidida,
  origem,
}: {
  situacao: Situacao
  motivo: string | null
  lote?: boolean
  ajudantes?: string[]
  retrabalho?: boolean
  cortado?: boolean
  decidida?: boolean
  origem?: Origem
}) {
  const rotulo = ROTULO_SITUACAO[situacao]
  return (
    <span className="flex flex-wrap gap-1">
      {rotulo && (
        <Selo
          forte={situacao === 'conferir'}
          icone={<ShieldAlert aria-hidden className="size-3" />}
        >
          {situacao === 'conferir' && motivo ? `Para conferir · ${motivo.toLowerCase()}` : rotulo}
        </Selo>
      )}
      {decidida && situacao === 'valida' && (
        <Selo icone={<Undo2 aria-hidden className="size-3" />}>Considerada à mão</Selo>
      )}
      {lote && <Selo icone={<Layers aria-hidden className="size-3" />}>Lote</Selo>}
      {ajudantes.length > 0 && (
        <Selo icone={<HandHelping aria-hidden className="size-3" />}>Com ajuda</Selo>
      )}
      {retrabalho && situacao !== 'retrabalho' && (
        <Selo icone={<Wrench aria-hidden className="size-3" />}>Retrabalho</Selo>
      )}
      {cortado && (
        <Selo icone={<Scissors aria-hidden className="size-3" />}>
          Cortado no fim do expediente
        </Selo>
      )}
      {origem === 'trello' && (
        <Selo icone={<FileClock aria-hidden className="size-3" />}>Histórico do Trello</Selo>
      )}
    </span>
  )
}

/** A cobertura do registro: quantos móveis que passaram pelo setor têm tempo. */
export function Cobertura({ total, comTempo }: { total: number; comTempo: number }) {
  if (total === 0) return null
  const pct = Math.round((100 * comTempo) / total)
  return (
    <p className="text-sm text-texto-suave">
      <span className="font-semibold text-texto tabular-nums">{pct}%</span> dos móveis com tempo
      registrado{' '}
      <span className="tabular-nums">
        ({comTempo} de {total})
      </span>
      {pct < 100 && ' — os outros passaram sem ninguém iniciar o card.'}
    </p>
  )
}

export function Carregando() {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-texto-fraco">
      <Loader2 aria-hidden className="size-4 animate-spin" />
      Carregando…
    </p>
  )
}

export function ErroLeitura({ erro }: { erro: Error }) {
  return (
    <p
      role="alert"
      className="rounded-dm-lg border border-borda bg-superficie p-4 text-sm text-danificado-forte"
    >
      {erro.message}
    </p>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-dm-lg border border-borda bg-superficie p-4 text-sm text-texto-suave">
      {children}
    </p>
  )
}

export function Painel({
  titulo,
  dica,
  children,
  className,
}: {
  titulo: string
  dica?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-4 sm:p-5',
        className,
      )}
    >
      <div>
        <h2 className="text-lg">{titulo}</h2>
        {dica && <p className="text-xs text-texto-fraco">{dica}</p>}
      </div>
      {children}
    </section>
  )
}

const OUTRO = '__outro'
const ROTULO_DECISAO: Record<Decisao, string> = {
  considerar: 'Considerar na média',
  descartar: 'Descartar da média',
  desfazer: 'Desfazer a decisão',
}

/**
 * Considerar / Descartar / Desfazer um tempo, com motivo (a lista "Motivos de
 * conferência" de Utilitários + "Outro" com texto) — o padrão de sempre, o
 * motivo é obrigatório. A plataforma grava um fato no card (Auditoria); o
 * histórico do Trello grava na trilha.
 */
export function ModalDecidir({
  alvo,
  aoFechar,
}: {
  alvo: { origem: Origem; id: number; decisao: Decisao; titulo: string } | null
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const cliente = useQueryClient()
  const [escolha, setEscolha] = useState('')
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const { data: motivos = [] } = useQuery({
    queryKey: ['motivos', 'conferencia'],
    queryFn: () => listarMotivos('conferencia'),
    enabled: alvo !== null,
    staleTime: 10 * 60_000,
  })
  const motivo =
    escolha === OUTRO ? texto.trim() : (motivos.find((m) => String(m.id) === escolha)?.texto ?? '')

  function fechar() {
    setEscolha('')
    setTexto('')
    setErro(null)
    aoFechar()
  }

  async function confirmar() {
    if (!alvo) return
    if (motivo.length < 3) {
      setErro('Escolha o motivo (ou escreva em "Outro").')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      await decidirTempo(alvo.origem, alvo.id, alvo.decisao, motivo)
      notificar({
        titulo: alvo.decisao === 'desfazer' ? 'Decisão desfeita' : 'Decisão gravada',
        tom: 'perfeito',
      })
      await cliente.invalidateQueries({ queryKey: ['tempos-producao'] })
      fechar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      aberto={alvo !== null}
      aoFechar={(aberto) => !aberto && fechar()}
      titulo={alvo ? ROTULO_DECISAO[alvo.decisao] : ''}
      descricao={alvo?.titulo}
      rodape={
        <>
          <Botao variante="secundaria" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao variante="primaria" carregando={salvando} onClick={() => void confirmar()}>
            Confirmar
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Selecao
          rotulo="Motivo"
          placeholder="Escolha o motivo"
          opcoes={[
            ...motivos.map((m) => ({ valor: String(m.id), rotulo: m.texto })),
            { valor: OUTRO, rotulo: 'Outro' },
          ]}
          valor={escolha}
          aoMudar={setEscolha}
        />
        {escolha === OUTRO && (
          <Campo
            rotulo="Qual o motivo?"
            value={texto}
            maxLength={300}
            onChange={(e) => setTexto(e.target.value)}
          />
        )}
        {erro && (
          <p role="alert" className="text-sm text-danificado-forte">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}

/** Os botões de decidir de uma montagem (só para quem decide — líder do setor ou admin). */
export function BotoesDecidir({
  origem,
  id,
  situacao,
  decidida,
  titulo,
  aoPedir,
}: {
  origem: Origem
  id: number
  situacao: Situacao
  decidida: boolean
  titulo: string
  aoPedir: (alvo: { origem: Origem; id: number; decisao: Decisao; titulo: string }) => void
}) {
  if (decidida) {
    return (
      <Botao
        variante="fantasma"
        tamanho="sm"
        onClick={() => aoPedir({ origem, id, decisao: 'desfazer', titulo })}
      >
        Desfazer
      </Botao>
    )
  }
  return (
    <span className="flex flex-wrap gap-1">
      {situacao !== 'valida' && (
        <Botao
          variante="secundaria"
          tamanho="sm"
          onClick={() => aoPedir({ origem, id, decisao: 'considerar', titulo })}
        >
          Considerar
        </Botao>
      )}
      {situacao !== 'descartada' && (
        <Botao
          variante="fantasma"
          tamanho="sm"
          onClick={() => aoPedir({ origem, id, decisao: 'descartar', titulo })}
        >
          Descartar
        </Botao>
      )}
    </span>
  )
}
