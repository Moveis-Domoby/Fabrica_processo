import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, CirclePause, RefreshCw, Send } from 'lucide-react'
import { Botao, useNotificacao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { ehSuperAdmin } from '@/autenticacao/tipos'
import { cn } from '@/lib/cn'
import { ligarEntregaTiny, reenviarEntregaTiny, situacaoEntregaTiny } from './api'

/**
 * "Entregue vai ao Tiny" (SESSAO-30 · D-113): a chave que faz a entrega
 * registrada na plataforma (e o desfazer) mudar a situação do pedido no Tiny,
 * pela fila do banco. Nasce DESLIGADA — o dono liga depois de provar com um
 * pedido real. O admin vê a situação; só o super admin liga, desliga e manda
 * de novo o pedido que parou. Lido só aqui (regra 17), sem relógio.
 */
export function CartaoEntregaTiny() {
  const { perfil } = useSessao()
  const superAdmin = ehSuperAdmin(perfil)
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [confirmando, setConfirmando] = useState(false)

  const { data: s, isPending } = useQuery({
    queryKey: ['tiny-entrega'],
    queryFn: situacaoEntregaTiny,
  })
  const ligada = Boolean(s?.ligado_desde)

  const chave = useMutation({
    mutationFn: (ligar: boolean) => ligarEntregaTiny(ligar),
    onSuccess: async (_d, ligar) => {
      setConfirmando(false)
      notificar({
        titulo: ligar ? '"Entregue vai ao Tiny" ligado' : '"Entregue vai ao Tiny" desligado',
        descricao: ligar
          ? 'A próxima entrega registrada na plataforma muda o pedido no Tiny.'
          : 'A plataforma para de mexer no Tiny; o fluxo do ClickUp segue como sempre.',
        tom: 'perfeito',
      })
      await clienteQuery.invalidateQueries({ queryKey: ['tiny-entrega'] })
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu certo',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })
  const reenviar = useMutation({
    mutationFn: reenviarEntregaTiny,
    onSuccess: async () => {
      notificar({ titulo: 'Mandado de novo ao Tiny', tom: 'perfeito' })
      await clienteQuery.invalidateQueries({ queryKey: ['tiny-entrega'] })
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu certo',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  if (isPending || !s) return null

  return (
    <section
      aria-label="Entregue vai ao Tiny"
      className={cn(
        'flex flex-col gap-3 rounded-dm-lg border bg-superficie p-4',
        ligada ? 'border-perfeito-borda' : 'border-borda',
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        {ligada ? (
          <CircleCheck aria-hidden className="size-6 text-perfeito-forte" />
        ) : (
          <CirclePause aria-hidden className="size-6 text-texto-suave" />
        )}
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-texto">Entregue vai ao Tiny</h2>
          <p className="text-sm text-texto-suave">
            {ligada
              ? `Ligado desde ${new Date(s.ligado_desde!).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}: a entrega registrada aqui deixa o pedido "Entregue" no Tiny, e o desfazer volta.`
              : 'Desligado: a entrega registrada aqui vale só na plataforma. O fluxo do ClickUp continua mudando o Tiny como sempre.'}
          </p>
        </div>
        {superAdmin &&
          (confirmando ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-texto-suave">
                {ligada ? 'Desligar?' : 'Ligar agora?'}
              </span>
              <Botao
                tamanho="sm"
                carregando={chave.isPending}
                onClick={() => chave.mutate(!ligada)}
              >
                Sim
              </Botao>
              <Botao tamanho="sm" variante="fantasma" onClick={() => setConfirmando(false)}>
                Não
              </Botao>
            </span>
          ) : (
            <Botao
              variante={ligada ? 'secundaria' : 'primaria'}
              icone={<Send />}
              onClick={() => setConfirmando(true)}
            >
              {ligada ? 'Desligar' : 'Ligar'}
            </Botao>
          ))}
      </div>
      {ligada && (
        <p className="text-sm text-texto-suave tabular-nums">
          {s.esperando === 0
            ? 'Nada esperando o Tiny.'
            : `${s.esperando} pedido(s) esperando o Tiny responder.`}
          {s.pausado && ' O Tiny não está respondendo — novas tentativas a cada 15 minutos.'}
          {s.ultimo_ok_em &&
            ` Última resposta boa: ${new Date(s.ultimo_ok_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.`}
        </p>
      )}
      {s.parados.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-danificado-texto">
            O Tiny não aceitou depois de 8 tentativas:
          </p>
          <ul className="flex flex-col divide-y divide-borda rounded-dm border border-borda px-3">
            {s.parados.map((p) => (
              <li key={p.pedido_id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="font-medium tabular-nums">Pedido {p.numero}</span>
                <span className="text-texto-suave">→ {p.situacao}</span>
                <span className="flex-1 text-texto-fraco">{p.erro}</span>
                {superAdmin && (
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    icone={<RefreshCw />}
                    carregando={reenviar.isPending && reenviar.variables === p.pedido_id}
                    onClick={() => reenviar.mutate(p.pedido_id)}
                  >
                    Mandar de novo
                  </Botao>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
