import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Users } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import {
  definirEquipe,
  listarEntregadores,
  nomeDaRota,
  rotasDoDia,
  salvarDetalheEntrega,
} from './api'

/**
 * A equipe da rota (SESSAO-30 · D-115 → SESSAO-31 · D-128: cada rota do
 * caminhão no dia tem a sua — troca de turno): quem programa escolhe um ou
 * mais entregadores; eles passam a ver as entregas dessa rota na tela
 * "Entregas do dia". Só carrega ao abrir (regra 17).
 */
export function ModalEquipe({
  alvo,
  aoFechar,
}: {
  alvo: {
    dia: string
    caminhaoId: number
    caminhaoNome: string
    rota: number
    variasRotas: boolean
  } | null
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [escolhidos, setEscolhidos] = useState<Set<string> | null>(null)

  const { data: pessoas = [], isPending: carregandoPessoas } = useQuery({
    queryKey: ['entregadores'],
    queryFn: listarEntregadores,
    enabled: alvo !== null,
    staleTime: 5 * 60_000,
  })
  const { data: rotas = [], isPending: carregandoEquipe } = useQuery({
    queryKey: ['rotas-do-dia', alvo?.dia],
    queryFn: () => rotasDoDia(alvo!.dia),
    enabled: alvo !== null,
  })
  const atuais = new Set(
    rotas
      .find((r) => r.caminhao_id === alvo?.caminhaoId && r.rota === alvo?.rota)
      ?.equipe.map((m) => m.id) ?? [],
  )
  const marcados = escolhidos ?? atuais
  const nomeAlvo = alvo
    ? `${alvo.caminhaoNome}${alvo.variasRotas ? ` · ${nomeDaRota(alvo.rota)}` : ''}`
    : 'caminhão'

  const salvar = useMutation({
    mutationFn: () => definirEquipe(alvo!.dia, alvo!.caminhaoId, [...marcados], alvo!.rota),
    onSuccess: async () => {
      notificar({
        titulo: `Equipe do ${nomeAlvo} salva`,
        descricao:
          marcados.size === 0
            ? 'Ninguém escolhido.'
            : `${marcados.size} pessoa(s) veem estas entregas.`,
        tom: 'perfeito',
      })
      aoFechar()
      await clienteQuery.invalidateQueries({ queryKey: ['rotas-do-dia'] })
      await clienteQuery.invalidateQueries({ queryKey: ['entregas-do-dia'] })
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para salvar a equipe',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  function alternar(id: string) {
    const novo = new Set(marcados)
    if (novo.has(id)) novo.delete(id)
    else novo.add(id)
    setEscolhidos(novo)
  }

  return (
    <Modal
      aberto={alvo !== null}
      aoFechar={(v) => !v && aoFechar()}
      titulo={`Quem leva o ${nomeAlvo}`}
      descricao={alvo ? new Date(`${alvo.dia}T12:00:00`).toLocaleDateString('pt-BR') : undefined}
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-texto-suave">
          Quem for marcado vê as entregas desta rota neste dia, na tela "Entregas do dia". Cada rota
          do caminhão tem a sua equipe (troca de turno).
        </p>
        {(carregandoPessoas || carregandoEquipe) && (
          <p className="text-sm text-texto-fraco">Carregando…</p>
        )}
        {!carregandoPessoas && pessoas.length === 0 && (
          <p className="text-sm text-texto-suave">
            Ninguém cadastrado como entregador ainda — em Configurações → Gestão da equipe, use
            "Entregador".
          </p>
        )}
        <ul className="flex flex-col divide-y divide-borda rounded-dm border border-borda">
          {pessoas.map((p) => (
            <li key={p.id}>
              <label className="flex min-h-toque-md cursor-pointer items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--dm-acao)]"
                  checked={marcados.has(p.id)}
                  onChange={() => alternar(p.id)}
                />
                <span className="flex-1 text-texto">{p.nome}</span>
                {!p.entregador && <span className="text-xs text-texto-fraco">da ROTAS</span>}
              </label>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Botao icone={<Users />} carregando={salvar.isPending} onClick={() => salvar.mutate()}>
            Salvar a equipe
          </Botao>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
        </div>
      </div>
    </Modal>
  )
}

/** O detalhe da entrega (D-115): "cliente só recebe depois das 10h" — o entregador vê no card. */
export function ModalDetalheEntrega({
  pedido,
  aoFechar,
}: {
  pedido: { card_id: number; numero: number; detalhe: string | null } | null
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [texto, setTexto] = useState(pedido?.detalhe ?? '')
  const salvar = useMutation({
    mutationFn: () => salvarDetalheEntrega(pedido!.card_id, texto),
    onSuccess: async () => {
      notificar({ titulo: `Detalhe do pedido ${pedido?.numero} salvo`, tom: 'perfeito' })
      aoFechar()
      await clienteQuery.invalidateQueries({ queryKey: ['programadas'] })
      await clienteQuery.invalidateQueries({ queryKey: ['entregas-do-dia'] })
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para salvar',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })
  return (
    <Modal
      aberto={pedido !== null}
      aoFechar={(v) => !v && aoFechar()}
      titulo={`Detalhe da entrega — pedido ${pedido?.numero ?? ''}`}
      descricao="O entregador vê isto no card da entrega."
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          salvar.mutate()
        }}
      >
        <Campo
          rotulo="Detalhe"
          placeholder="Ex.: cliente só pode receber depois das 10h"
          maxLength={300}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoFocus
        />
        <div className="flex flex-wrap gap-2">
          <Botao type="submit" icone={<Save />} carregando={salvar.isPending}>
            Salvar
          </Botao>
          <Botao type="button" variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
        </div>
      </form>
    </Modal>
  )
}
