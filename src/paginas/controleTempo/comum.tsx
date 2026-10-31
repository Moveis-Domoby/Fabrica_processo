import { useId, type ReactNode } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Botao, Modal } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { minutosEntre, problemaNasFaixas } from './formato'

/** Liga/desliga com papel de interruptor — o leitor de tela diz "ligado"/"desligado". */
export function Interruptor({
  ligado,
  rotulo,
  aoMudar,
  desabilitado,
}: {
  ligado: boolean
  rotulo: string
  aoMudar: (ligado: boolean) => void
  desabilitado?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={desabilitado}
      onClick={() => aoMudar(!ligado)}
      className={cn(
        'toque-seguro relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        ligado ? 'border-acao bg-acao' : 'border-borda-forte bg-superficie-sutil',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block size-5 rounded-full bg-white shadow-sm transition-transform',
          ligado ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  )
}

/** Carregando / erro da porta da aba — o mesmo jeito em todas. */
export function EstadoDaLeitura({ carregando, erro }: { carregando: boolean; erro: Error | null }) {
  if (carregando)
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-texto-fraco">
        <Loader2 aria-hidden className="size-4 animate-spin" />
        Carregando…
      </p>
    )
  if (erro)
    return (
      <p role="alert" className="text-sm text-danificado-forte">
        {erro.message}
      </p>
    )
  return null
}

export function Explicacao({ children }: { children: ReactNode }) {
  return <p className="max-w-3xl text-sm text-texto-suave">{children}</p>
}

/** Modal de "tem certeza?" — a ação perigosa ou que vale para muitos. */
export function ConfirmarAcao({
  aberto,
  aoFechar,
  titulo,
  descricao,
  rotuloConfirmar,
  perigo = false,
  carregando = false,
  aoConfirmar,
}: {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  descricao: string
  rotuloConfirmar: string
  perigo?: boolean
  carregando?: boolean
  aoConfirmar: () => void
}) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={(a) => !a && aoFechar()}
      titulo={titulo}
      descricao={descricao}
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao
            variante={perigo ? 'perigo' : 'primaria'}
            carregando={carregando}
            onClick={aoConfirmar}
          >
            {rotuloConfirmar}
          </Botao>
        </>
      }
    />
  )
}

/**
 * As faixas de um dia (expediente da semana ou dia trabalhado do calendário):
 * cada faixa com começo e fim; o intervalo (almoço) aparece escrito entre
 * duas faixas.
 */
export function EditorFaixas({
  rotulo,
  faixas,
  aoMudar,
  maximo = 6,
  sugestao = ['07:30', '12:00'],
  textoVazio = 'Sem faixa — o tempo não conta neste dia.',
}: {
  /** Para o leitor de tela: "segunda", "o dia trabalhado"… */
  rotulo: string
  faixas: [string, string][]
  aoMudar: (faixas: [string, string][]) => void
  maximo?: number
  sugestao?: [string, string]
  textoVazio?: string
}) {
  const idBase = useId()
  const ordenadas = faixas
  const proximaSugestao = (): [string, string] => {
    if (faixas.length === 0) return sugestao
    const ultimoFim = [...faixas].sort((a, b) => a[1].localeCompare(b[1]))[faixas.length - 1][1]
    // depois da última: 1 h de intervalo e mais umas horas (ex.: 13:00–18:00)
    const [h, m] = ultimoFim.split(':').map(Number)
    const comeco = Math.min(h + 1, 22)
    const fim = Math.min(comeco + 5, 23)
    const doisDigitos = (n: number) => String(n).padStart(2, '0')
    return [`${doisDigitos(comeco)}:${doisDigitos(m)}`, `${doisDigitos(fim)}:${doisDigitos(m)}`]
  }
  const problema = problemaNasFaixas(faixas)

  return (
    <div className="flex flex-col gap-2">
      {ordenadas.length === 0 && <p className="text-sm text-texto-suave">{textoVazio}</p>}
      {ordenadas.map(([ini, fim], i) => {
        const anterior = i > 0 ? ordenadas[i - 1] : null
        const intervalo = anterior ? minutosEntre(anterior[1], ini) : null
        return (
          <div key={i} className="flex flex-col gap-1">
            {anterior && intervalo !== null && intervalo > 0 && (
              <p className="text-xs text-texto-fraco">
                Intervalo de {anterior[1]} às {ini} (
                {intervalo >= 60
                  ? `${Math.floor(intervalo / 60)}h${intervalo % 60 ? ` ${intervalo % 60}min` : ''}`
                  : `${intervalo}min`}
                )
              </p>
            )}
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor={`${idBase}-${i}-ini`}>
                Começo da faixa {i + 1} de {rotulo}
              </label>
              <input
                id={`${idBase}-${i}-ini`}
                type="time"
                value={ini}
                onChange={(e) =>
                  aoMudar(faixas.map((f, j) => (j === i ? [e.target.value, f[1]] : f)))
                }
                className="h-toque-md w-full min-w-0 rounded-dm border border-borda-forte bg-superficie px-2 text-texto sm:w-32"
              />
              <span aria-hidden className="text-texto-suave">
                às
              </span>
              <label className="sr-only" htmlFor={`${idBase}-${i}-fim`}>
                Fim da faixa {i + 1} de {rotulo}
              </label>
              <input
                id={`${idBase}-${i}-fim`}
                type="time"
                value={fim}
                onChange={(e) =>
                  aoMudar(faixas.map((f, j) => (j === i ? [f[0], e.target.value] : f)))
                }
                className="h-toque-md w-full min-w-0 rounded-dm border border-borda-forte bg-superficie px-2 text-texto sm:w-32"
              />
              <Botao
                variante="fantasma"
                icone={<Trash2 />}
                aria-label={`Tirar a faixa ${i + 1} de ${rotulo}`}
                className="shrink-0 px-3"
                onClick={() => aoMudar(faixas.filter((_, j) => j !== i))}
              />
            </div>
          </div>
        )
      })}
      {faixas.length < maximo && (
        <div>
          <Botao
            variante="secundaria"
            tamanho="md"
            icone={<Plus />}
            aria-label={`Pôr uma faixa em ${rotulo}`}
            onClick={() => aoMudar([...faixas, proximaSugestao()])}
          >
            Faixa
          </Botao>
        </div>
      )}
      {problema && <p className="text-sm text-danificado-forte">{problema}</p>}
    </div>
  )
}
