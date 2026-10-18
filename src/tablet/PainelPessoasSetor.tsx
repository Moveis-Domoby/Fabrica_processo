import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DoorOpen, LogIn, Pause } from 'lucide-react'
import { AvatarPessoa, Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { listarMotivos } from '@/rotas/api'
import type { Motivo } from '@/rotas/api'
import type { OperadorIdentificado } from '@/autenticacao/api'
import type { PresencaDoSetor } from '@/kanban/quadro'
import { ModalPinOperador } from './ModalPinOperador'
import { pessoaEntrar, pessoaPausar, pessoaSair } from './api'

type Acao = 'pausar' | 'sair' | 'entrar'

const ROTULO_ACAO: Record<Acao, string> = {
  pausar: 'Pausar tudo',
  sair: 'Sair do setor',
  entrar: 'Entrar no setor',
}

const ROTULO_ESTADO: Record<PresencaDoSetor['estado'], string> = {
  trabalhando: 'Trabalhando',
  ausente: 'Ausente',
  deriva: 'Fora de setor',
}

/**
 * SESSAO-36 (D-146 resposta 9): o ícone do canto superior direito do tablet —
 * as PESSOAS ativas no setor, cada uma com Pausar · Sair (e o Entrar para quem
 * chega). Cada gesto pede o PIN DA PRÓPRIA PESSOA; Pausar e Sair pedem UM
 * motivo (pausa e saída têm listas separadas — resposta 6).
 */
export function PainelPessoasSetor({
  aberto,
  aoFechar,
  setorId,
  setorNome,
  presencas,
  aoFeito,
}: {
  aberto: boolean
  aoFechar: () => void
  setorId: number
  setorNome: string
  presencas: PresencaDoSetor[]
  aoFeito: () => void
}) {
  const notificar = useNotificacao()
  const [pedindoPin, setPedindoPin] = useState<{ acao: Acao; pessoa: PresencaDoSetor | null } | null>(null)
  const [motivando, setMotivando] = useState<{
    acao: 'pausar' | 'sair'
    operador: OperadorIdentificado
  } | null>(null)
  const [motivoId, setMotivoId] = useState<number | null>(null)
  const [outro, setOutro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const tipoMotivo = motivando?.acao === 'sair' ? 'saida' : 'pausa'
  const { data: motivos = [] } = useQuery({
    queryKey: ['motivos', tipoMotivo],
    queryFn: () => listarMotivos(tipoMotivo),
    enabled: motivando !== null,
    staleTime: 10 * 60_000,
  })

  function fecharTudo() {
    setPedindoPin(null)
    setMotivando(null)
    setMotivoId(null)
    setOutro('')
  }

  async function executar(acao: Acao, operador: OperadorIdentificado, motivo?: { id: number | null; texto: string | null }) {
    setEnviando(true)
    try {
      if (acao === 'entrar') {
        await pessoaEntrar(setorId, operador.usuario_id)
        notificar({ titulo: `${operador.nome} entrou no setor`, tom: 'perfeito' })
      } else if (acao === 'pausar') {
        const n = await pessoaPausar(motivo?.id ?? null, motivo?.texto ?? null, operador.usuario_id)
        notificar({
          titulo: n > 0 ? `${n} card(s) pausado(s) — ${operador.nome} fica ausente` : `${operador.nome} fica ausente`,
          tom: 'perfeito',
        })
      } else {
        await pessoaSair(motivo?.id ?? null, motivo?.texto ?? null, operador.usuario_id)
        notificar({ titulo: `${operador.nome} saiu do setor`, tom: 'perfeito' })
      }
      fecharTudo()
      aoFeito()
    } catch (excecao) {
      notificar({
        titulo: 'Não deu certo',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      })
    } finally {
      setEnviando(false)
    }
  }

  function aoIdentificado(operador: OperadorIdentificado) {
    const pedido = pedindoPin
    setPedindoPin(null)
    if (!pedido) return
    if (pedido.acao === 'entrar') {
      void executar('entrar', operador)
      return
    }
    // Pausar/Sair pedem o motivo (um só, aplicado a todos os cards da pessoa)
    setMotivando({ acao: pedido.acao, operador })
    setMotivoId(null)
    setOutro('')
  }

  return (
    <>
      <Modal
        aberto={aberto && !motivando}
        aoFechar={(estaAberto) => {
          if (!estaAberto) aoFechar()
        }}
        titulo={`Pessoas no setor ${setorNome}`}
        descricao="Cada gesto pede o PIN da própria pessoa."
      >
        <div className="flex flex-col gap-3">
          {presencas.length === 0 ? (
            <p className="text-sm text-texto-suave">
              Ninguém deu entrada neste setor ainda — a primeira ação com o PIN (ou o Entrar abaixo)
              faz a entrada.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {presencas.map((p) => (
                <li
                  key={p.usuario_id}
                  className="flex flex-wrap items-center gap-2 rounded-dm border border-borda bg-superficie p-2"
                >
                  <AvatarPessoa nome={p.nome} foto={p.foto} tamanho="md" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-texto">{p.nome}</span>
                    <span
                      className={cn(
                        'text-xs',
                        p.estado === 'trabalhando' ? 'text-perfeito-forte' : 'text-atencao-texto',
                      )}
                    >
                      {ROTULO_ESTADO[p.estado]}
                    </span>
                  </span>
                  <span className="flex gap-1">
                    <Botao
                      variante="secundaria"
                      tamanho="sm"
                      icone={<Pause />}
                      className="min-h-toque-md"
                      disabled={enviando}
                      onClick={() => setPedindoPin({ acao: 'pausar', pessoa: p })}
                    >
                      Pausar
                    </Botao>
                    <Botao
                      variante="secundaria"
                      tamanho="sm"
                      icone={<DoorOpen />}
                      className="min-h-toque-md"
                      disabled={enviando}
                      onClick={() => setPedindoPin({ acao: 'sair', pessoa: p })}
                    >
                      Sair
                    </Botao>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Botao
            variante="primaria"
            tamanho="lg"
            larguraTotal
            icone={<LogIn />}
            disabled={enviando}
            onClick={() => setPedindoPin({ acao: 'entrar', pessoa: null })}
          >
            Entrar neste setor
          </Botao>
          <p className="text-xs text-texto-fraco">
            Pausar deixa a pessoa AUSENTE (a entrada no setor fica); Sair encerra a entrada — sem
            entrar em outro setor, ela fica fora até voltar.
          </p>
        </div>
      </Modal>

      {/* O motivo (um só) do Pausar/Sair — listas separadas (resposta 6). */}
      <Modal
        aberto={motivando !== null}
        aoFechar={(estaAberto) => {
          if (!estaAberto) setMotivando(null)
        }}
        titulo={motivando?.acao === 'sair' ? 'Por que sair do setor?' : 'Por que pausar tudo?'}
        descricao={motivando ? `O gesto sai no nome de ${motivando.operador.nome}.` : undefined}
      >
        <div className="flex flex-col gap-3">
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Motivo">
            {motivos
              .filter((m: Motivo) => m.ativo)
              .map((m: Motivo) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={motivoId === m.id}
                  onClick={() => setMotivoId(m.id)}
                  className={cn(
                    'min-h-toque-lg rounded-dm border-2 px-3 py-2 text-left text-sm font-medium',
                    motivoId === m.id ? 'border-acao-ativa bg-acao/15' : 'border-borda bg-superficie',
                  )}
                >
                  {m.texto}
                </button>
              ))}
            <button
              type="button"
              role="radio"
              aria-checked={motivoId === 0}
              onClick={() => setMotivoId(0)}
              className={cn(
                'min-h-toque-lg rounded-dm border-2 px-3 py-2 text-left text-sm font-medium',
                motivoId === 0 ? 'border-acao-ativa bg-acao/15' : 'border-borda bg-superficie',
              )}
            >
              Outro
            </button>
          </div>
          {motivoId === 0 && (
            <Campo
              rotulo="Qual o motivo?"
              value={outro}
              onChange={(e) => setOutro(e.target.value)}
              autoComplete="off"
            />
          )}
          <Botao
            tamanho="lg"
            larguraTotal
            carregando={enviando}
            disabled={motivoId === null || (motivoId === 0 && !outro.trim())}
            onClick={() => {
              const m = motivando
              if (!m) return
              void executar(m.acao, m.operador, {
                id: motivoId === 0 ? null : motivoId,
                texto: outro.trim() || null,
              })
            }}
          >
            Confirmar
          </Botao>
        </div>
      </Modal>

      <ModalPinOperador
        acao={pedindoPin ? ROTULO_ACAO[pedindoPin.acao] : null}
        setorId={setorId}
        aoFechar={() => setPedindoPin(null)}
        aoIdentificado={aoIdentificado}
        esperadoId={pedindoPin?.pessoa?.usuario_id}
        esperadoNome={pedindoPin?.pessoa?.nome}
      />
    </>
  )
}
