import { X } from 'lucide-react'
import { Botao, Selecao } from '@/componentes/ui'
import { FiltroDoQuadro } from '@/kanban/componentes/FiltroDoQuadro'
import type { CandidatosProgramacao, EstadoFiltro, PrevisaoFiltro } from './api'
import {
  OPCOES_ORDEM,
  SEM_FILTROS,
  TODAS,
  lerBairro,
  opcoesBairro,
  opcoesCidade,
  opcoesEstado,
  opcoesPrevisao,
  temFiltro,
  valorDoBairro,
} from './filtrosProgramacao'
import type { EscolhaDosFiltros, OrdemDaLista } from './filtrosProgramacao'

/**
 * SESSAO-41 (D-199, pedido do dono): os filtros da lista "Sem programação" —
 * a busca (cliente, nº do pedido, bairro, cidade, móvel), a situação, a
 * previsão de entrega, a cidade, o bairro e a ordem. As opções e os "quantos"
 * vêm na MESMA resposta da lista (nenhuma requisição a mais).
 */
export function FiltrosProgramar({
  escolha,
  aoMudar,
  dados,
}: {
  escolha: EscolhaDosFiltros
  aoMudar: (escolha: EscolhaDosFiltros) => void
  dados: CandidatosProgramacao | undefined
}) {
  const mudar = (parte: Partial<EscolhaDosFiltros>) => aoMudar({ ...escolha, ...parte })
  const bairroAtual = escolha.bairro ? valorDoBairro(escolha.bairro, escolha.cidade ?? '') : TODAS

  return (
    <div className="@container/filtros flex flex-col gap-3">
      <FiltroDoQuadro
        texto={escolha.busca}
        aoMudar={(busca) => mudar({ busca })}
        rotulo="Buscar pedido"
        placeholder="Buscar: cliente, nº do pedido, bairro, cidade ou móvel"
        className="sm:w-full"
      />
      <div className="grid grid-cols-2 gap-3 @lg/filtros:grid-cols-3">
        <Selecao
          rotulo="Situação"
          opcoes={opcoesEstado(dados?.contagens)}
          valor={escolha.estado ?? TODAS}
          aoMudar={(v) => mudar({ estado: v === TODAS ? null : (v as EstadoFiltro) })}
        />
        <Selecao
          rotulo="Previsão de entrega"
          opcoes={opcoesPrevisao(dados?.contagens)}
          valor={escolha.previsao ?? TODAS}
          aoMudar={(v) => mudar({ previsao: v === TODAS ? null : (v as PrevisaoFiltro) })}
        />
        <Selecao
          rotulo="Cidade"
          opcoes={opcoesCidade(dados?.cidades ?? [], escolha.cidade)}
          valor={escolha.cidade ?? TODAS}
          // o bairro é da cidade: trocar a cidade solta o bairro
          aoMudar={(v) => mudar({ cidade: v === TODAS ? null : v, bairro: null })}
        />
        <Selecao
          rotulo="Bairro"
          opcoes={opcoesBairro(dados?.bairros ?? [], escolha.cidade, escolha.bairro)}
          valor={bairroAtual}
          aoMudar={(v) => {
            const escolhido = lerBairro(v)
            mudar(
              escolhido
                ? { bairro: escolhido.bairro, cidade: escolhido.cidade || escolha.cidade }
                : { bairro: null },
            )
          }}
        />
        <Selecao
          rotulo="Ordenar por"
          opcoes={OPCOES_ORDEM}
          valor={escolha.ordem}
          aoMudar={(v) => mudar({ ordem: v as OrdemDaLista })}
          className="col-span-2"
        />
      </div>
      {temFiltro(escolha) && (
        <Botao
          variante="fantasma"
          tamanho="sm"
          icone={<X />}
          className="self-start"
          onClick={() => aoMudar({ ...SEM_FILTROS, ordem: escolha.ordem })}
        >
          Limpar filtros
        </Botao>
      )}
    </div>
  )
}
