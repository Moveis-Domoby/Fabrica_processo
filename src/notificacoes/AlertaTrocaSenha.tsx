import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react'
import { AvatarPessoa, Botao, Modal, useNotificacao } from '@/componentes/ui'
import { ouvirCanal, topicoDaPessoa } from '@/chat/canais'
import { buscarAvisos } from './api'
import type { Aviso } from './api'
import { buscarPedidosSenha, decidirPedidoSenha } from './pedidosSenha'
import type { PedidoSenha } from './pedidosSenha'

const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''

/**
 * SESSAO-41 (D-191, pedido do dono): o pedido de "Esqueci minha senha" é uma
 * notificação de URGÊNCIA — "um aviso na tela mesmo com um botão de liberar
 * troca, ou de não liberar". Só para administradores. Abre sozinho quando chega
 * um pedido (o aviso vem pelo canal ao vivo do sino — nada de relógio) e pelo
 * toque no aviso do sino (`?senhas=1`). A lista dos pedidos só é buscada com o
 * aviso aberto (Lei §3).
 */
export function AlertaTrocaSenha({ usuarioId }: { usuarioId: string }) {
  const clienteQuery = useQueryClient()
  const notificar = useNotificacao()
  const [parametros, setParametros] = useSearchParams()
  const pedidoNoEndereco = parametros.get('senhas') === '1'
  const [dispensados, setDispensados] = useState<Set<number>>(() => new Set())

  // Lê o MESMO cache do sino (ele busca e o canal ao vivo atualiza) — sem pedido próprio.
  const { data: avisos = [] } = useQuery({
    queryKey: ['avisos', usuarioId],
    queryFn: () => buscarAvisos(usuarioId, 20),
    enabled: false,
    staleTime: Infinity,
  })
  const urgentes = avisos.filter((a) => a.tipo === 'senha_pedido' && a.lida_em === null)
  const aberto = pedidoNoEndereco || urgentes.some((a) => !dispensados.has(a.id))

  // D-200 (28/10): quando OUTRO administrador (ou esta pessoa em outra aba)
  // decide, o banco avisa no canal pessoal — o aviso sai e a lista relê na hora
  // (antes ficava o pedido antigo na tela até sair e entrar).
  useEffect(
    () =>
      ouvirCanal(topicoDaPessoa(usuarioId), (evento, dados) => {
        if (evento !== 'senha_decidida') return
        if (dados.sem_pendentes === true) {
          const lidaEm =
            typeof dados.lida_em === 'string' ? dados.lida_em : new Date().toISOString()
          clienteQuery.setQueryData<Aviso[]>(['avisos', usuarioId], (atual) =>
            atual?.map((a) =>
              a.tipo === 'senha_pedido' && a.lida_em === null ? { ...a, lida_em: lidaEm } : a,
            ),
          )
        }
        void clienteQuery.invalidateQueries({ queryKey: ['senha-pedidos'] })
      }),
    [usuarioId, clienteQuery],
  )

  // O pedido que chega com a janela já aberta entra na lista (a chave muda com o aviso novo).
  const ultimoUrgente = urgentes.reduce((maior, a) => Math.max(maior, a.id), 0)
  const pedidos = useQuery({
    queryKey: ['senha-pedidos', ultimoUrgente],
    queryFn: buscarPedidosSenha,
    enabled: aberto,
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
  const pendentes = (pedidos.data ?? []).filter((p) => p.situacao === 'pendente')
  const decididos = (pedidos.data ?? []).filter((p) => p.situacao !== 'pendente').slice(0, 5)

  function fechar() {
    setDispensados(new Set([...dispensados, ...urgentes.map((a) => a.id)]))
    if (pedidoNoEndereco) {
      const sem = new URLSearchParams(parametros)
      sem.delete('senhas')
      setParametros(sem, { replace: true })
    }
  }

  const decidir = useMutation({
    mutationFn: ({ pedido, liberar }: { pedido: PedidoSenha; liberar: boolean }) =>
      decidirPedidoSenha(pedido.id, liberar),
    onSuccess: async (resultado, { pedido, liberar }) => {
      notificar({
        tom: liberar ? 'perfeito' : 'informativo',
        titulo: !resultado.mudou
          ? 'Outro administrador já tinha decidido este pedido.'
          : liberar
            ? `Troca liberada para ${pedido.pessoa.nome} até ${hora(resultado.liberado_ate)} — só no aparelho que pediu.`
            : `Troca não liberada para ${pedido.pessoa.nome}.`,
      })
      const lista = await pedidos.refetch()
      // sem pedido esperando, o aviso urgente sai (o banco já marcou como lido)
      if (!(lista.data ?? []).some((p) => p.situacao === 'pendente')) {
        const agora = new Date().toISOString()
        clienteQuery.setQueryData<Aviso[]>(['avisos', usuarioId], (atual) =>
          atual?.map((a) =>
            a.tipo === 'senha_pedido' && a.lida_em === null ? { ...a, lida_em: agora } : a,
          ),
        )
      }
    },
    onError: (erro) => notificar({ titulo: erro.message, tom: 'danificado' }),
  })

  return (
    <Modal
      aberto={aberto}
      aoFechar={(abrir) => !abrir && fechar()}
      titulo="Pedido urgente: troca de senha"
      descricao="Libere só se tiver certeza de que foi a própria pessoa — confirme com ela. A liberação vale 2 horas, para uma troca, e só no aparelho de onde ela pediu."
      rodape={
        <Botao variante="fantasma" onClick={fechar}>
          {pendentes.length > 0 ? 'Decidir depois' : 'Fechar'}
        </Botao>
      }
    >
      {pedidos.isPending ? (
        <p className="text-sm text-texto-suave">Carregando os pedidos…</p>
      ) : pedidos.isError ? (
        <p className="text-sm text-danificado-forte">{pedidos.error.message}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {pendentes.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-texto-suave">
              <ShieldCheck aria-hidden className="size-4 shrink-0" />
              Nenhum pedido esperando decisão.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {pendentes.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 rounded-dm-lg border border-atencao-borda bg-atencao-fundo p-3"
                >
                  <div className="flex items-center gap-3">
                    <AvatarPessoa nome={p.pessoa.nome} foto={p.pessoa.foto} />
                    <div className="min-w-0">
                      <p className="font-medium text-texto">{p.pessoa.nome}</p>
                      <p className="text-xs text-texto-suave">
                        {p.pessoa.usuario ? `${p.pessoa.usuario} · ` : ''}pediu às{' '}
                        {hora(p.pedido_em)}
                      </p>
                    </div>
                    <ShieldAlert
                      aria-hidden
                      className="ml-auto size-5 shrink-0 text-atencao-texto"
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Botao
                      icone={<KeyRound />}
                      larguraTotal
                      disabled={decidir.isPending}
                      onClick={() => decidir.mutate({ pedido: p, liberar: true })}
                    >
                      Liberar troca
                    </Botao>
                    <Botao
                      variante="secundaria"
                      icone={<ShieldX />}
                      larguraTotal
                      disabled={decidir.isPending}
                      onClick={() => decidir.mutate({ pedido: p, liberar: false })}
                    >
                      Não liberar
                    </Botao>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {decididos.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-texto-suave">Decididos nas últimas 24 horas</p>
              <ul className="flex flex-col gap-1 text-xs text-texto-suave">
                {decididos.map((p) => (
                  <li key={p.id}>
                    {p.pessoa.nome} —{' '}
                    {p.situacao === 'liberado'
                      ? `liberado por ${p.decidido_por ?? 'um administrador'} até ${hora(p.liberado_ate)}`
                      : p.situacao === 'usado'
                        ? 'senha trocada'
                        : `não liberado por ${p.decidido_por ?? 'um administrador'}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
