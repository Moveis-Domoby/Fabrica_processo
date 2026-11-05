import { useEffect, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileClock, Link2, Plus } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { buscarNomesSemModelo, ligarNomeTrello, type NomeSemModelo } from '@/dashboards/tempos/api'
import { buscarModelos, mensagemDoErro } from './api'
import { EstadoDaLeitura } from './comum'

/**
 * SESSAO-43 (F4) — Configurações → Controle de tempo → Modelos: os NOMES DO
 * HISTÓRICO DO TRELLO que não casaram com nenhum modelo. Ligar um nome a um
 * modelo (ou criar o modelo) faz o histórico daquele nome entrar no modelo e
 * refaz a situação e o padrão — e vale para a plataforma também (o card novo
 * com esse nome cai no mesmo modelo). A lista só é pedida no clique (Lei §3).
 */
export function NomesDoTrello() {
  const [aberto, setAberto] = useState(false)
  const [ligando, setLigando] = useState<NomeSemModelo | null>(null)
  const consulta = useInfiniteQuery({
    queryKey: ['tempo', 'trello-sem-modelo'],
    queryFn: ({ pageParam }) => buscarNomesSemModelo(pageParam),
    initialPageParam: null as { n: number; chave: string } | null,
    getNextPageParam: (ultima) => {
      const u = ultima.itens.at(-1)
      return ultima.tem_mais && u ? { n: u.cartoes, chave: u.chave } : undefined
    },
    enabled: aberto,
  })
  const itens = consulta.data?.pages.flatMap((p) => p.itens) ?? []
  const primeira = consulta.data?.pages[0]

  return (
    <section className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg">
          <FileClock aria-hidden className="size-5 text-texto-suave" />
          Nomes do Trello sem modelo
        </h2>
        {!aberto && (
          <Botao variante="secundaria" onClick={() => setAberto(true)}>
            Ver os nomes
          </Botao>
        )}
      </div>
      <p className="max-w-3xl text-sm text-texto-suave">
        O histórico de montagens que veio do Trello usa o nome do cartão. Os nomes que não casaram
        com nenhum modelo ficam aqui: ligue cada um ao modelo certo (ou crie o modelo) e o histórico
        dele passa a contar no padrão daquele móvel.
      </p>
      {aberto &&
        (consulta.isPending || consulta.error ? (
          <EstadoDaLeitura carregando={consulta.isPending} erro={consulta.error} />
        ) : itens.length === 0 ? (
          <p className="text-sm text-texto-suave">Todos os nomes do histórico já têm modelo.</p>
        ) : (
          <>
            <p className="text-sm text-texto-suave">
              {primeira?.nomes} {primeira?.nomes === 1 ? 'nome' : 'nomes'} · {primeira?.cartoes}{' '}
              montagens sem modelo — do mais frequente para o menos.
            </p>
            <ul className="flex flex-col divide-y divide-borda">
              {itens.map((n) => (
                <li key={n.chave} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{n.sugestao ?? n.exemplo}</span>
                    <span className="truncate text-xs text-texto-fraco" title={n.exemplo}>
                      ex.: {n.exemplo}
                    </span>
                  </div>
                  <span className="text-sm text-texto-suave tabular-nums">
                    {n.cartoes} {n.cartoes === 1 ? 'montagem' : 'montagens'}
                  </span>
                  <Botao
                    variante="secundaria"
                    tamanho="sm"
                    icone={<Link2 aria-hidden />}
                    onClick={() => setLigando(n)}
                  >
                    Ligar
                  </Botao>
                </li>
              ))}
            </ul>
            {consulta.hasNextPage && (
              <Botao
                variante="secundaria"
                carregando={consulta.isFetchingNextPage}
                onClick={() => void consulta.fetchNextPage()}
              >
                Ver mais
              </Botao>
            )}
          </>
        ))}
      {ligando && <ModalLigar nome={ligando} aoFechar={() => setLigando(null)} />}
    </section>
  )
}

function ModalLigar({ nome, aoFechar }: { nome: NomeSemModelo; aoFechar: () => void }) {
  const notificar = useNotificacao()
  const cliente = useQueryClient()
  const [texto, setTexto] = useState(nome.sugestao ?? '')
  const [busca, setBusca] = useState((nome.sugestao ?? '').split(' - ')[0] ?? '')
  const [novo, setNovo] = useState(nome.sugestao ?? '')
  useEffect(() => {
    const t = setTimeout(() => setBusca(texto.trim()), 300)
    return () => clearTimeout(t)
  }, [texto])
  const modelos = useQuery({
    queryKey: ['tempo', 'modelos-para-ligar', busca],
    queryFn: () => buscarModelos({ busca, soSugeridos: false, depois: null }),
    enabled: busca.length >= 2,
  })
  const ligar = useMutation({
    mutationFn: (alvo: { modeloId: number | null; nomeNovo: string | null }) =>
      ligarNomeTrello(nome.chave, alvo.modeloId, alvo.nomeNovo),
    onSuccess: async () => {
      notificar({
        titulo: 'Nome ligado ao modelo',
        descricao: 'O histórico desse nome já entra no padrão do modelo.',
        tom: 'perfeito',
      })
      await cliente.invalidateQueries({ queryKey: ['tempo'] })
      await cliente.invalidateQueries({ queryKey: ['tempos-producao'] })
      aoFechar()
    },
    onError: (e) =>
      notificar({ titulo: 'Não deu para ligar', descricao: mensagemDoErro(e), tom: 'danificado' }),
  })

  return (
    <Modal
      aberto
      aoFechar={(a) => !a && aoFechar()}
      titulo="Ligar o nome a um modelo"
      descricao={nome.exemplo}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Campo
            rotulo="Procurar o modelo"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoFocus
          />
          {busca.length >= 2 &&
            (modelos.isPending ? (
              <EstadoDaLeitura carregando erro={null} />
            ) : (modelos.data?.itens ?? []).length === 0 ? (
              <p className="text-sm text-texto-suave">Nenhum modelo com esse nome.</p>
            ) : (
              <ul className="flex max-h-60 flex-col overflow-y-auto">
                {(modelos.data?.itens ?? []).map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      disabled={ligar.isPending}
                      onClick={() => ligar.mutate({ modeloId: m.id, nomeNovo: null })}
                      className="min-h-toque-md w-full rounded-dm px-3 text-left text-sm hover:bg-superficie-sutil"
                    >
                      {m.nome}
                      {!m.confirmado && (
                        <span className="ml-2 text-xs text-texto-fraco">(sugerido)</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </div>
        <div className="flex flex-col gap-2 border-t border-borda pt-3">
          <p className="text-sm text-texto-suave">Ou crie um modelo novo com este nome:</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <Campo
                rotulo="Nome do modelo novo"
                value={novo}
                maxLength={160}
                onChange={(e) => setNovo(e.target.value)}
              />
            </div>
            <Botao
              variante="primaria"
              icone={<Plus aria-hidden />}
              carregando={ligar.isPending}
              disabled={novo.trim().length < 2}
              onClick={() => ligar.mutate({ modeloId: null, nomeNovo: novo.trim() })}
            >
              Criar e ligar
            </Botao>
          </div>
        </div>
      </div>
    </Modal>
  )
}
