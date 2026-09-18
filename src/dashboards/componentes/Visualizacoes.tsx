import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BookmarkPlus, RefreshCw, Trash2 } from 'lucide-react'
import { Botao, Campo, Selecao, useNotificacao } from '@/componentes/ui'
import {
  atualizarVisualizacao,
  excluirVisualizacao,
  salvarVisualizacao,
} from '@/dashboards/api'
import type { ConfiguracaoPainel, VisualizacaoSalva } from '@/dashboards/api'

/**
 * O controle de visualizações salvas (RF-32/33), compartilhado pelas 4 telas.
 * A configuração salva agora carrega a TELA + os filtros; selecionar uma
 * visualização de outra tela navega até ela (usePainelDash.aplicarVisualizacao).
 */
export function Visualizacoes({
  usuarioId,
  config,
  visualizacoes,
  selecionadaId,
  aoAplicar,
}: {
  usuarioId: string
  config: ConfiguracaoPainel
  visualizacoes: VisualizacaoSalva[]
  selecionadaId: string
  aoAplicar: (id: string) => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [nomeNova, setNomeNova] = useState('')

  const invalidar = () => clienteQuery.invalidateQueries({ queryKey: ['visualizacoes'] })
  const aoErro = (titulo: string) => (excecao: unknown) =>
    notificar({
      titulo,
      descricao: excecao instanceof Error ? excecao.message : undefined,
      tom: 'danificado',
    })

  const salvarMutacao = useMutation({
    mutationFn: () => salvarVisualizacao({ usuarioId, nome: nomeNova, configuracao: config }),
    onSuccess: async () => {
      notificar({ titulo: `Visualização "${nomeNova.trim()}" salva`, tom: 'perfeito' })
      setNomeNova('')
      await invalidar()
    },
    onError: aoErro('Não deu para salvar'),
  })
  const atualizarMutacao = useMutation({
    mutationFn: () => atualizarVisualizacao(Number(selecionadaId), config),
    onSuccess: async () => {
      notificar({ titulo: 'Visualização atualizada', tom: 'perfeito' })
      await invalidar()
    },
    onError: aoErro('Não deu para atualizar'),
  })
  const excluirMutacao = useMutation({
    mutationFn: () => excluirVisualizacao(Number(selecionadaId)),
    onSuccess: async () => {
      notificar({ titulo: 'Visualização excluída', tom: 'perfeito' })
      aoAplicar('')
      await invalidar()
    },
    onError: aoErro('Não deu para excluir'),
  })

  return (
    <details className="rounded-dm-lg border border-borda bg-superficie">
      <summary className="min-h-toque-md cursor-pointer list-none px-4 py-2.5 text-sm font-medium text-texto-suave select-none [&::-webkit-details-marker]:hidden">
        Visualizações salvas
        {selecionadaId && (
          <span className="ml-2 rounded-full bg-superficie-sutil px-2 py-0.5 text-xs text-texto">
            {visualizacoes.find((v) => String(v.id) === selecionadaId)?.nome}
          </span>
        )}
      </summary>
      <div className="flex flex-col gap-3 border-t border-borda p-4">
        <Selecao
          rotulo="Aplicar uma visualização"
          opcoes={[
            { valor: 'atual', rotulo: 'Painel padrão de fábrica' },
            ...visualizacoes.map((v) => ({ valor: String(v.id), rotulo: v.nome })),
          ]}
          valor={selecionadaId || 'atual'}
          aoMudar={(v) => aoAplicar(v === 'atual' ? '' : v)}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="max-w-xs flex-1">
            <Campo
              rotulo="Salvar esta tela com estes filtros como…"
              placeholder="ex.: Meu dia a dia"
              value={nomeNova}
              onChange={(e) => setNomeNova(e.target.value)}
            />
          </div>
          <Botao
            variante="secundaria"
            icone={<BookmarkPlus />}
            disabled={!nomeNova.trim()}
            carregando={salvarMutacao.isPending}
            onClick={() => salvarMutacao.mutate()}
          >
            Salvar
          </Botao>
          {selecionadaId && (
            <>
              <Botao
                variante="secundaria"
                icone={<RefreshCw />}
                carregando={atualizarMutacao.isPending}
                onClick={() => atualizarMutacao.mutate()}
              >
                Atualizar a selecionada
              </Botao>
              <Botao
                variante="fantasma"
                icone={<Trash2 />}
                carregando={excluirMutacao.isPending}
                onClick={() => excluirMutacao.mutate()}
              >
                Excluir
              </Botao>
            </>
          )}
        </div>
      </div>
    </details>
  )
}
