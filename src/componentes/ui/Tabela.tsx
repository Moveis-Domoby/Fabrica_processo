import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Paginacao } from './Paginacao'

/** Quantidade padrão por página (RNF-02: tela com muitos dados sempre pagina). */
export const POR_PAGINA_PADRAO = 20

export interface ColunaTabela<T> {
  chave: string
  cabecalho: string
  celula: (item: T) => ReactNode
  /** Alinhamento do conteúdo; use `direita` para números e durações. */
  alinhamento?: 'esquerda' | 'centro' | 'direita'
  /** Não aparece na lista de cards do celular (ex.: já está no título). */
  ocultarNoCelular?: boolean
  /** Não aparece na tabela do tablet/desktop. Raro. */
  ocultarNaTabela?: boolean
  larguraClasse?: string
}

export interface TabelaProps<T> {
  /** Descrição da tabela para leitor de tela — obrigatória. */
  legenda: string
  colunas: ColunaTabela<T>[]
  dados: T[]
  chaveDe: (item: T) => string | number
  porPagina?: number
  vazio?: ReactNode
  /** Título do card na versão celular (o "assunto" da linha). */
  tituloCelular?: (item: T) => ReactNode
  className?: string
}

const ALINHAMENTO = {
  esquerda: 'text-left',
  centro: 'text-center',
  direita: 'text-right',
} as const

/**
 * Tabela do design system, com **paginação embutida por padrão** (RNF-02).
 *
 * Mobile-first (D-06): abaixo de `sm` a tabela vira lista de cards empilhados —
 * tabela rolando na horizontal é inutilizável com luva e uma mão só.
 */
export function Tabela<T>({
  legenda,
  colunas,
  dados,
  chaveDe,
  porPagina = POR_PAGINA_PADRAO,
  vazio = 'Nada por aqui ainda.',
  tituloCelular,
  className,
}: TabelaProps<T>) {
  const [pagina, setPagina] = useState(1)

  const totalPaginas = Math.max(1, Math.ceil(dados.length / porPagina))
  const paginaSegura = Math.min(pagina, totalPaginas)

  const visiveis = useMemo(
    () => dados.slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina),
    [dados, paginaSegura, porPagina],
  )

  const colunasTabela = colunas.filter((c) => !c.ocultarNaTabela)
  const colunasCelular = colunas.filter((c) => !c.ocultarNoCelular)

  return (
    <div
      className={cn('overflow-hidden rounded-dm-lg border border-borda bg-superficie', className)}
    >
      {dados.length === 0 ? (
        <p className="p-8 text-center text-texto-suave">{vazio}</p>
      ) : (
        <>
          {/* ---------- Celular: cards empilhados ---------- */}
          <ul className="divide-y divide-borda sm:hidden">
            {visiveis.map((item) => (
              <li key={chaveDe(item)} className="flex flex-col gap-2 p-4">
                {tituloCelular && (
                  <div className="font-medium text-texto">{tituloCelular(item)}</div>
                )}
                <dl className="flex flex-col gap-1.5">
                  {colunasCelular.map((coluna) => (
                    <div key={coluna.chave} className="flex items-center justify-between gap-3">
                      <dt className="text-sm text-texto-suave">{coluna.cabecalho}</dt>
                      <dd className="text-right text-sm text-texto">{coluna.celula(item)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>

          {/* ---------- Tablet e acima: tabela de verdade ---------- */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">{legenda}</caption>
              <thead>
                <tr className="border-b border-borda bg-superficie-sutil">
                  {colunasTabela.map((coluna) => (
                    <th
                      key={coluna.chave}
                      scope="col"
                      className={cn(
                        'px-4 py-3 text-sm font-semibold whitespace-nowrap text-texto-suave',
                        ALINHAMENTO[coluna.alinhamento ?? 'esquerda'],
                        coluna.larguraClasse,
                      )}
                    >
                      {coluna.cabecalho}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {visiveis.map((item) => (
                  <tr key={chaveDe(item)} className="hover:bg-superficie-sutil">
                    {colunasTabela.map((coluna) => (
                      <td
                        key={coluna.chave}
                        className={cn(
                          'px-4 py-3 align-middle text-texto',
                          ALINHAMENTO[coluna.alinhamento ?? 'esquerda'],
                        )}
                      >
                        {coluna.celula(item)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Paginacao
            paginaAtual={paginaSegura}
            totalPaginas={totalPaginas}
            totalItens={dados.length}
            porPagina={porPagina}
            aoMudarPagina={setPagina}
          />
        </>
      )}
    </div>
  )
}
