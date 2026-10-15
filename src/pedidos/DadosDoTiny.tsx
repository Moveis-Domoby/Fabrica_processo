import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { dadosDoTiny } from './api'
import { diaEHora, moeda, rotuloDoCampo } from './formato'

type Valor = unknown

const ehObjeto = (v: Valor): v is Record<string, Valor> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Vazio não ocupa a tela: '', nulo, lista vazia, objeto vazio. */
function vazio(v: Valor): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0 || v.every(vazio)
  if (ehObjeto(v)) return Object.values(v).every(vazio)
  return false
}

/**
 * O Tiny embrulha cada linha numa chave só ({"item": {...}}, {"parcela":
 * {...}}, {"marcador": {...}}) — desembrulha para ler direto.
 */
function desembrulhar(v: Valor): Valor {
  if (ehObjeto(v)) {
    const chaves = Object.keys(v)
    if (chaves.length === 1 && ehObjeto(v[chaves[0]])) return v[chaves[0]]
  }
  return v
}

/**
 * Dinheiro só onde o campo É dinheiro ("valor_frete", "total_pedido", "preco") —
 * nunca num código ("id_lista_preco" é o código da lista, não um preço).
 */
const CAMPO_DINHEIRO = /(^|_)(valor|total|preco|desconto|frete|despesas|saldo)(_|$)/i
const ehCodigo = (chave: string) => /^(id|codigo)(_|$)/i.test(chave)
const ehDinheiro = (chave: string) => CAMPO_DINHEIRO.test(chave) && !ehCodigo(chave)

function textoDoValor(chave: string, v: Valor): string {
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  if (typeof v === 'number') return ehDinheiro(chave) ? moeda(v) : v.toLocaleString('pt-BR')
  const s = String(v)
  if (ehDinheiro(chave) && /^-?\d+(\.\d+)?$/.test(s.trim())) return moeda(Number(s))
  return s
}

/** Escalares primeiro (em ordem de nome), depois os grupos — sempre a mesma leitura. */
function ordenar(entradas: [string, Valor][]): [string, Valor][] {
  const peso = (v: Valor) => (Array.isArray(v) || ehObjeto(v) ? 1 : 0)
  return [...entradas].sort(
    ([a, va], [b, vb]) =>
      peso(va) - peso(vb) || rotuloDoCampo(a).localeCompare(rotuloDoCampo(b), 'pt-BR'),
  )
}

/** Um registro do Tiny em pares "campo: valor" — grupos e listas viram blocos dentro. */
export function RegistroDoTiny({
  dados,
  nivel = 0,
}: {
  dados: Record<string, Valor>
  nivel?: number
}) {
  const entradas = ordenar(Object.entries(dados).filter(([, v]) => !vazio(v)))
  if (entradas.length === 0) return <p className="text-sm text-texto-suave">Sem dados.</p>
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]',
        nivel > 0 && 'border-l border-borda/70 pl-3',
      )}
    >
      {entradas.map(([chave, v]) => {
        const valor = desembrulhar(v)
        if (Array.isArray(valor)) {
          const itens = valor.map(desembrulhar).filter((x) => !vazio(x))
          const simples = itens.every((x) => !ehObjeto(x) && !Array.isArray(x))
          return (
            <Par key={chave} rotulo={rotuloDoCampo(chave)}>
              {simples ? (
                <span>{itens.map((x) => textoDoValor(chave, x)).join(' · ')}</span>
              ) : (
                <ol className="flex flex-col gap-2">
                  {itens.map((x, i) => (
                    <li key={i} className="flex flex-col gap-1">
                      {itens.length > 1 && (
                        <span className="text-xs text-texto-suave tabular-nums">{i + 1}º</span>
                      )}
                      {ehObjeto(x) ? (
                        <RegistroDoTiny dados={x} nivel={nivel + 1} />
                      ) : (
                        <span>{textoDoValor(chave, x)}</span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </Par>
          )
        }
        if (ehObjeto(valor)) {
          return (
            <Par key={chave} rotulo={rotuloDoCampo(chave)}>
              <RegistroDoTiny dados={valor} nivel={nivel + 1} />
            </Par>
          )
        }
        return (
          <Par key={chave} rotulo={rotuloDoCampo(chave)}>
            <span className="whitespace-pre-line break-words">{textoDoValor(chave, valor)}</span>
          </Par>
        )
      })}
    </dl>
  )
}

function Par({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-sm text-texto-suave">{rotulo}</dt>
      <dd className="min-w-0 text-sm text-texto">{children}</dd>
    </>
  )
}

/** Um grupo que abre no clique (o pedido já vem aberto). */
function Grupo({
  titulo,
  inicial = false,
  children,
}: {
  titulo: string
  inicial?: boolean
  children: ReactNode
}) {
  const [aberto, setAberto] = useState(inicial)
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="inline-flex min-h-toque-md w-fit items-center gap-1.5 rounded-dm pr-2 text-sm font-medium text-texto hover:text-texto"
      >
        <ChevronRight
          aria-hidden
          className={cn('size-4 text-texto-suave transition-transform', aberto && 'rotate-90')}
        />
        {titulo}
      </button>
      {aberto && (
        <div className="transition-[opacity,transform] duration-200 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:transition-none">
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * "DADOS DO TINY" (área Pedidos — D-134: "com TODOS os dados fornecidos pelo
 * Tiny"): o registro inteiro que o Tiny mandou do pedido, do cliente, das
 * notas e das contas — só busca quando o botão abre. Nada se traduz por
 * conta: os nomes dos campos só ficam legíveis; o vazio não aparece.
 */
export function DadosDoTinyPainel({ pedidoId }: { pedidoId: number }) {
  const consulta = useQuery({
    queryKey: ['pedido-tiny', pedidoId],
    queryFn: () => dadosDoTiny(pedidoId),
    gcTime: 0,
    staleTime: 0,
  })
  if (consulta.isPending)
    return <p className="text-sm text-texto-fraco">Carregando os dados do Tiny…</p>
  if (consulta.isError || !consulta.data) {
    return (
      <p className="text-sm text-danificado-texto">
        {consulta.error instanceof Error ? consulta.error.message : 'Não deu para carregar.'}
      </p>
    )
  }
  const t = consulta.data
  return (
    <div className="flex flex-col gap-3">
      {t.atualizado_em && (
        <p className="text-xs text-texto-suave">
          Como o Tiny mandou — conferido pela última vez em {diaEHora(t.atualizado_em)}.
        </p>
      )}
      <Grupo titulo="Pedido" inicial>
        {t.pedido ? (
          <RegistroDoTiny dados={t.pedido} />
        ) : (
          <p className="text-sm text-texto-suave">O Tiny não mandou o registro deste pedido.</p>
        )}
      </Grupo>
      {t.cliente && !vazio(t.cliente) && (
        <Grupo titulo="Cliente">
          <RegistroDoTiny dados={t.cliente} />
        </Grupo>
      )}
      {t.notas_fiscais.length > 0 && (
        <Grupo titulo={`Notas fiscais (${t.notas_fiscais.length})`}>
          <div className="flex flex-col gap-4">
            {t.notas_fiscais.map((nf, i) => (
              <RegistroDoTiny key={i} dados={nf} />
            ))}
          </div>
        </Grupo>
      )}
      {t.contas_receber.length > 0 && (
        <Grupo titulo={`Contas a receber (${t.contas_receber.length})`}>
          <div className="flex flex-col gap-4">
            {t.contas_receber.map((cr, i) => (
              <RegistroDoTiny key={i} dados={cr} />
            ))}
          </div>
        </Grupo>
      )}
    </div>
  )
}
