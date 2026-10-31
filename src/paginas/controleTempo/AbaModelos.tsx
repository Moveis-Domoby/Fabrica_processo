import { useEffect, useState } from 'react'
import { useInfiniteQuery, useMutation } from '@tanstack/react-query'
import { Check, Combine, Search, Split } from 'lucide-react'
import { BadgeEstado, Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import {
  buscarModelos,
  CHAVE_TEMPO,
  confirmarModelo,
  juntarModelos,
  mensagemDoErro,
  separarModelo,
  useDepoisDeSalvar,
  type ModeloTempo,
} from './api'
import { EstadoDaLeitura, Explicacao, Interruptor } from './comum'
import { formatarSegundos } from './formato'

type Acao =
  | { tipo: 'confirmar'; modelo: ModeloTempo }
  | { tipo: 'separar'; chave: string; exemplo: string; de: string }
  | { tipo: 'juntar' }

/**
 * Aba "Modelos" (SESSAO-42 · F2): as cores do mesmo móvel são o mesmo modelo —
 * o sistema sugere, o administrador confirma, junta ou separa. Busca com
 * espera de 300 ms; a lista vem por cursor (nome + id) e a próxima página só
 * no "Ver mais".
 */
export function AbaModelos() {
  const notificar = useNotificacao()
  const depoisDeSalvar = useDepoisDeSalvar()
  const [texto, setTexto] = useState('')
  const [busca, setBusca] = useState('')
  const [soSugeridos, setSoSugeridos] = useState(false)
  const [selecionados, setSelecionados] = useState<Map<number, string>>(new Map())
  const [acao, setAcao] = useState<Acao | null>(null)

  // a busca só sai depois de 300 ms sem digitar
  useEffect(() => {
    const espera = setTimeout(() => setBusca(texto.trim()), 300)
    return () => clearTimeout(espera)
  }, [texto])

  const consulta = useInfiniteQuery({
    queryKey: CHAVE_TEMPO.modelos(busca, soSugeridos),
    queryFn: ({ pageParam }) => buscarModelos({ busca, soSugeridos, depois: pageParam }),
    initialPageParam: null as { nome: string; id: number } | null,
    getNextPageParam: (ultima) => {
      const fim = ultima.itens[ultima.itens.length - 1]
      return ultima.tem_mais && fim ? { nome: fim.nome, id: fim.id } : undefined
    },
  })
  const modelos = consulta.data?.pages.flatMap((p) => p.itens) ?? []
  const sugeridos = consulta.data?.pages[0]?.sugeridos ?? 0

  const alternar = (m: ModeloTempo) =>
    setSelecionados((atual) => {
      const novo = new Map(atual)
      if (novo.has(m.id)) novo.delete(m.id)
      else novo.set(m.id, m.nome)
      return novo
    })

  const aoTerminar = (titulo: string) => {
    setAcao(null)
    notificar({ titulo, descricao: 'As médias estão sendo refeitas.', tom: 'perfeito' })
    void depoisDeSalvar(CHAVE_TEMPO.modelosTodos)
  }
  const aoFalhar = (titulo: string) => (erro: unknown) =>
    notificar({ titulo, descricao: mensagemDoErro(erro), tom: 'danificado' })

  return (
    <div className="flex flex-col gap-5">
      <Explicacao>
        Um modelo é um móvel, sem contar a cor: as cores do mesmo móvel são o mesmo modelo, e o
        tempo padrão é medido por modelo. O sistema sugere os modelos sozinho; você confirma, junta
        dois que são o mesmo móvel ou separa um nome que caiu no modelo errado.
      </Explicacao>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:max-w-sm sm:flex-1">
          <Campo
            rotulo="Buscar modelo"
            type="search"
            prefixo={<Search />}
            placeholder="Nome do móvel"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <div className="flex min-h-toque-md items-center gap-3">
          <Interruptor ligado={soSugeridos} rotulo="Só os a confirmar" aoMudar={setSoSugeridos} />
          <span className="text-sm text-texto">
            Só os a confirmar{sugeridos > 0 && <span className="tabular-nums"> ({sugeridos})</span>}
          </span>
        </div>
      </div>

      <EstadoDaLeitura carregando={consulta.isPending} erro={consulta.error} />

      {consulta.isSuccess && modelos.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          {busca || soSugeridos ? 'Nenhum modelo com esse filtro.' : 'Nenhum modelo ainda.'}
        </p>
      )}

      <ul className="flex flex-col gap-2" aria-label="Modelos">
        {modelos.map((m) => {
          const marcado = selecionados.has(m.id)
          return (
            <li
              key={m.id}
              className={cn(
                'flex flex-col gap-3 rounded-dm border bg-superficie p-3',
                marcado ? 'border-acao-ativa' : 'border-borda',
              )}
            >
              <div className="flex items-start gap-3">
                <label className="flex size-toque-md shrink-0 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    className="size-5 accent-acao"
                    checked={marcado}
                    onChange={() => alternar(m)}
                    aria-label={`Marcar ${m.nome} para juntar`}
                  />
                </label>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-texto">{m.nome}</span>
                    {m.confirmado ? (
                      <BadgeEstado tamanho="sm" estado="perfeito" rotulo="Confirmado" />
                    ) : (
                      <BadgeEstado tamanho="sm" estado="atencao" rotulo="A confirmar" />
                    )}
                  </div>
                  <p className="text-xs text-texto-suave tabular-nums">
                    {m.passagens} {m.passagens === 1 ? 'passagem' : 'passagens'}
                  </p>
                  {m.padrao && m.padrao.length > 0 && (
                    <p className="text-sm text-texto-suave">
                      Tempo padrão:{' '}
                      {m.padrao
                        .map(
                          (p) =>
                            `${p.setor} ${formatarSegundos(p.mediana_s)} (${p.n} ${p.n === 1 ? 'montagem' : 'montagens'})`,
                        )
                        .join(' · ')}
                    </p>
                  )}
                </div>
                {!m.confirmado && (
                  <Botao
                    variante="secundaria"
                    icone={<Check />}
                    className="shrink-0"
                    onClick={() => setAcao({ tipo: 'confirmar', modelo: m })}
                  >
                    Confirmar
                  </Botao>
                )}
              </div>
              {m.chaves.length > 0 && (
                <details className="pl-0 sm:pl-14">
                  <summary className="min-h-toque-md cursor-pointer py-2 text-sm text-texto-suave">
                    {m.chaves.length} {m.chaves.length === 1 ? 'nome de móvel' : 'nomes de móvel'}{' '}
                    neste modelo
                  </summary>
                  <ul className="flex flex-col gap-1">
                    {m.chaves.map((k) => (
                      <li key={k.chave} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-texto">
                          {k.exemplo ?? k.chave}
                        </span>
                        {m.chaves.length > 1 && (
                          <Botao
                            variante="fantasma"
                            icone={<Split />}
                            className="shrink-0"
                            onClick={() =>
                              setAcao({
                                tipo: 'separar',
                                chave: k.chave,
                                exemplo: k.exemplo ?? k.chave,
                                de: m.nome,
                              })
                            }
                          >
                            Separar
                          </Botao>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          )
        })}
      </ul>

      {consulta.hasNextPage && (
        <div>
          <Botao
            variante="secundaria"
            carregando={consulta.isFetchingNextPage}
            onClick={() => void consulta.fetchNextPage()}
          >
            Ver mais
          </Botao>
        </div>
      )}

      {selecionados.size > 0 && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-dm-lg border border-borda-forte bg-superficie p-3 shadow-lg">
          <span className="text-sm text-texto">
            {selecionados.size} {selecionados.size === 1 ? 'modelo marcado' : 'modelos marcados'}
          </span>
          <Botao variante="fantasma" onClick={() => setSelecionados(new Map())}>
            Desmarcar
          </Botao>
          <Botao
            icone={<Combine />}
            className="ml-auto"
            disabled={selecionados.size < 2}
            onClick={() => setAcao({ tipo: 'juntar' })}
          >
            Juntar
          </Botao>
        </div>
      )}

      {acao?.tipo === 'confirmar' && (
        <ModalNome
          titulo="Confirmar o modelo"
          descricao="Confira o nome — é como o modelo aparece nas telas de tempo."
          inicial={acao.modelo.nome}
          rotuloBotao="Confirmar"
          aoFechar={() => setAcao(null)}
          executar={(nome) => confirmarModelo(acao.modelo.id, nome)}
          aoTerminar={() => aoTerminar('Modelo confirmado')}
          aoFalhar={aoFalhar('Não deu para confirmar')}
        />
      )}
      {acao?.tipo === 'separar' && (
        <ModalNome
          titulo="Separar num modelo novo"
          descricao={`"${acao.exemplo}" sai de ${acao.de} e vira um modelo próprio. Dê o nome dele.`}
          inicial={acao.exemplo}
          rotuloBotao="Separar"
          aoFechar={() => setAcao(null)}
          executar={(nome) => separarModelo(acao.chave, nome)}
          aoTerminar={() => aoTerminar('Modelo separado')}
          aoFalhar={aoFalhar('Não deu para separar')}
        />
      )}
      {acao?.tipo === 'juntar' && (
        <ModalJuntar
          modelos={[...selecionados.entries()].map(([id, nome]) => ({ id, nome }))}
          aoFechar={() => setAcao(null)}
          aoTerminar={() => {
            setSelecionados(new Map())
            aoTerminar('Modelos juntados')
          }}
          aoFalhar={aoFalhar('Não deu para juntar')}
        />
      )}
    </div>
  )
}

function ModalNome({
  titulo,
  descricao,
  inicial,
  rotuloBotao,
  aoFechar,
  executar,
  aoTerminar,
  aoFalhar,
}: {
  titulo: string
  descricao: string
  inicial: string
  rotuloBotao: string
  aoFechar: () => void
  executar: (nome: string) => Promise<unknown>
  aoTerminar: () => void
  aoFalhar: (erro: unknown) => void
}) {
  const [nome, setNome] = useState(inicial)
  const mutacao = useMutation({
    mutationFn: () => executar(nome.trim()),
    onSuccess: aoTerminar,
    onError: aoFalhar,
  })
  return (
    <Modal
      aberto
      aoFechar={(a) => !a && aoFechar()}
      titulo={titulo}
      descricao={descricao}
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao
            disabled={nome.trim().length < 2}
            carregando={mutacao.isPending}
            onClick={() => mutacao.mutate()}
          >
            {rotuloBotao}
          </Botao>
        </>
      }
    >
      <Campo
        rotulo="Nome do modelo"
        maxLength={160}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
    </Modal>
  )
}

function ModalJuntar({
  modelos,
  aoFechar,
  aoTerminar,
  aoFalhar,
}: {
  modelos: { id: number; nome: string }[]
  aoFechar: () => void
  aoTerminar: () => void
  aoFalhar: (erro: unknown) => void
}) {
  const [destino, setDestino] = useState<number>(modelos[0]?.id ?? 0)
  const mutacao = useMutation({
    mutationFn: () =>
      juntarModelos(
        destino,
        modelos.filter((m) => m.id !== destino).map((m) => m.id),
      ),
    onSuccess: aoTerminar,
    onError: aoFalhar,
  })
  return (
    <Modal
      aberto
      aoFechar={(a) => !a && aoFechar()}
      titulo="Juntar modelos"
      descricao="Os modelos marcados são o mesmo móvel. Escolha o que fica — os outros entram nele."
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao carregando={mutacao.isPending} onClick={() => mutacao.mutate()}>
            Juntar em um
          </Botao>
        </>
      }
    >
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-2 text-sm font-medium text-texto">O modelo que fica</legend>
        {modelos.map((m) => (
          <label
            key={m.id}
            className="flex min-h-toque-md cursor-pointer items-center gap-3 rounded-dm px-2 hover:bg-superficie-sutil"
          >
            <input
              type="radio"
              name="modelo-destino"
              className="size-5 accent-acao"
              checked={destino === m.id}
              onChange={() => setDestino(m.id)}
            />
            <span className="text-texto">{m.nome}</span>
          </label>
        ))}
      </fieldset>
    </Modal>
  )
}
