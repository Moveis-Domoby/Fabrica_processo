import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ListChecks } from 'lucide-react'
import { Botao, Paginacao } from '@/componentes/ui'
import { listarReservasPresasTiny } from '@/logistica/api'
import { formatarQuantidade, idadeDaLeitura } from '@/logistica/estoque'

const POR_PAGINA = 20

/**
 * As reservas presas no Tiny (↪️ D-76 / RF-108, pedido do dono em 30/09): o
 * "disponível multiempresa" que a equipe olha é saldo − reservado, e o Tiny
 * guarda reserva de pedido que já saiu. A lista diz, produto a produto, quanto
 * o Tiny reserva além dos pedidos abertos — para a equipe limpar LÁ. Só
 * carrega ao abrir, uma página por vez (regra 17).
 */
export function ReservasPresasTiny({ ativo, agora }: { ativo: boolean; agora: number }) {
  const [aberto, setAberto] = useState(false)
  const [pagina, setPagina] = useState(1)
  const { data: linhas = [], isPending, isError, error } = useQuery({
    queryKey: ['estoque', 'tiny', 'reservas-presas', pagina],
    queryFn: () =>
      listarReservasPresasTiny({ limite: POR_PAGINA, deslocamento: (pagina - 1) * POR_PAGINA }),
    enabled: ativo && aberto,
    placeholderData: keepPreviousData,
  })
  const total = linhas[0]?.contagem_total ?? 0
  const unidades = linhas[0]?.total_presas ?? 0

  return (
    <section aria-label="Reservas presas no Tiny" className="flex flex-col gap-2">
      <Botao
        variante="fantasma"
        className="self-start"
        icone={<ListChecks />}
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        {aberto ? 'Esconder as reservas presas no Tiny' : 'Ver as reservas presas no Tiny'}
      </Botao>
      {aberto && (
        <div className="flex flex-col gap-2">
          {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
          {isError && (
            <p className="text-sm text-danificado-texto">
              {error instanceof Error ? error.message : 'Não deu para ver as reservas presas no Tiny.'}
            </p>
          )}
          {!isPending && !isError && linhas.length === 0 && (
            <p className="text-sm text-texto-suave">
              Nenhuma reserva presa: o que o Tiny reserva bate com os pedidos abertos.
            </p>
          )}
          {linhas.length > 0 && (
            <>
              <p className="text-sm text-texto-suave">
                <span className="font-medium text-texto tabular-nums">
                  {formatarQuantidade(total)} {total === 1 ? 'produto' : 'produtos'} com{' '}
                  {formatarQuantidade(unidades)} {unidades === 1 ? 'unidade reservada' : 'unidades reservadas'} a
                  mais no Tiny.
                </span>{' '}
                São reservas de pedidos que já saíram: elas derrubam o disponível multiempresa. Para limpar, abra o
                produto no Tiny, aba de reservas, e tire as dos pedidos que já foram entregues ou cancelados.
              </p>
              <div className="rounded-dm-lg border border-borda bg-superficie px-4">
                <ul className="divide-y divide-borda">
                  {linhas.map((l) => (
                    <li
                      key={l.tiny_id}
                      className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium text-texto">
                          {l.codigo ? `SKU ${l.codigo} · ` : ''}
                          {l.descricao}
                        </span>
                        <span className="text-xs text-texto-suave tabular-nums">
                          O Tiny reserva {formatarQuantidade(l.reservado_tiny)} · pedidos abertos{' '}
                          {formatarQuantidade(l.pedidos_abertos)} · saldo no Tiny {formatarQuantidade(l.saldo_tiny)}{' '}
                          · lido {idadeDaLeitura(l.lido_em, agora)}
                        </span>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-atencao-texto tabular-nums">
                        {formatarQuantidade(l.presas)} {l.presas === 1 ? 'presa' : 'presas'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
          {total > POR_PAGINA && (
            <Paginacao
              paginaAtual={pagina}
              totalPaginas={Math.ceil(total / POR_PAGINA)}
              totalItens={total}
              porPagina={POR_PAGINA}
              aoMudarPagina={setPagina}
              className="rounded-dm-lg border border-borda bg-superficie"
            />
          )}
        </div>
      )}
    </section>
  )
}
