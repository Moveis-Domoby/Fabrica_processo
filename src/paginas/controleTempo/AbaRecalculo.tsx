import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { BadgeEstado, Botao, Campo, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { buscarSetores } from '@/kanban/api'
import { useAoVivo } from '@/lib/aoVivo'
import {
  buscarRecalculos,
  CHAVE_TEMPO,
  mensagemDoErro,
  pedirRecalculo,
  useDepoisDeSalvar,
  type PedidoRecalculo,
} from './api'
import { EstadoDaLeitura, Explicacao } from './comum'
import { dataHora, diaIso } from './formato'

function situacao(p: PedidoRecalculo) {
  if (p.erro) return <BadgeEstado tamanho="sm" estado="danificado" rotulo="Parou com erro" />
  if (p.concluido_em) return <BadgeEstado tamanho="sm" estado="perfeito" rotulo="Pronto" />
  if (p.iniciado_em) return <BadgeEstado tamanho="sm" estado="informativo" rotulo="Recalculando" />
  return <BadgeEstado tamanho="sm" estado="neutro" rotulo="Na fila" />
}

/**
 * Aba "Recálculo" (SESSAO-42 · F2): os pedidos de recálculo com o progresso.
 * AO VIVO pelo websocket da área "tempos" (o banco avisa quando o recálculo
 * anda) — sem relógio. E o recálculo de um período pedido à mão.
 */
export function AbaRecalculo() {
  const consulta = useQuery({ queryKey: CHAVE_TEMPO.recalculos, queryFn: buscarRecalculos })
  useAoVivo('tempos', [CHAVE_TEMPO.recalculos])
  const itens = consulta.data ?? []
  const [formAberto, setFormAberto] = useState(false)

  return (
    <div className="flex flex-col gap-5">
      <Explicacao>
        Toda mudança de horário, calendário, hora extra, regra ou modelo pede ao banco para refazer
        os tempos — aqui você acompanha o andamento, que se atualiza sozinho. Se precisar, peça o
        recálculo de um período à mão.
      </Explicacao>

      <div>
        <Botao icone={<RefreshCw />} onClick={() => setFormAberto(true)}>
          Recalcular um período
        </Botao>
      </div>

      <EstadoDaLeitura carregando={consulta.isPending} erro={consulta.error} />

      {consulta.isSuccess && itens.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Nenhum recálculo pedido ainda.
        </p>
      )}

      {itens.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Recálculos">
          {itens.map((p) => {
            const total = p.total ?? 0
            const feitos = Math.min(p.feitos ?? 0, total)
            const pct = total > 0 ? Math.round((feitos / total) * 100) : p.concluido_em ? 100 : 0
            return (
              <li
                key={p.id}
                className="flex flex-col gap-2 rounded-dm border border-borda bg-superficie p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {situacao(p)}
                  <span className="font-medium text-texto">{p.motivo || 'Recálculo'}</span>
                  <span className="text-sm text-texto-suave">
                    · {p.setor ?? 'Todos os setores'} ·{' '}
                    {p.alcance === 'tudo' ? 'refaz os tempos' : 'só reclassifica as passagens'}
                  </span>
                </div>
                <p className="text-sm text-texto-suave">
                  De {p.de ? dataHora(p.de) : 'o começo'} até {dataHora(p.ate)}
                  {p.por ? ` · pedido por ${p.por}` : ' · pedido sozinho'} em{' '}
                  {dataHora(p.criado_em)}
                </p>
                {total > 0 && !p.concluido_em && (
                  <div className="flex items-center gap-3">
                    <div
                      role="progressbar"
                      aria-label={`Andamento: ${p.motivo || 'recálculo'}`}
                      aria-valuemin={0}
                      aria-valuemax={total}
                      aria-valuenow={feitos}
                      className="h-2.5 flex-1 overflow-hidden rounded-full bg-superficie-sutil"
                    >
                      <div className="h-full rounded-full bg-acao" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="shrink-0 text-xs text-texto-suave tabular-nums">
                      {feitos} de {total} ({pct}%)
                    </span>
                  </div>
                )}
                {p.concluido_em && (
                  <p className="text-xs text-texto-fraco">
                    Terminou {dataHora(p.concluido_em)}
                    {total > 0 ? ` · ${total} ${total === 1 ? 'item' : 'itens'}` : ''}
                  </p>
                )}
                {p.erro && <p className="text-sm text-danificado-forte">{p.erro}</p>}
              </li>
            )
          })}
        </ul>
      )}

      {formAberto && <ModalRecalcular aoFechar={() => setFormAberto(false)} />}
    </div>
  )
}

function ModalRecalcular({ aoFechar }: { aoFechar: () => void }) {
  const notificar = useNotificacao()
  const depoisDeSalvar = useDepoisDeSalvar()
  const { data: setores = [] } = useQuery({ queryKey: ['setores'], queryFn: () => buscarSetores() })
  const [hoje] = useState(() => diaIso(new Date()))
  const [de, setDe] = useState(hoje)
  const [ate, setAte] = useState(hoje)
  const [setor, setSetor] = useState('todos')
  const falta = !de || !ate ? 'Escolha o período.' : ate < de ? 'O fim vem depois do começo.' : null

  const pedir = useMutation({
    mutationFn: () => pedirRecalculo(de, ate, setor === 'todos' ? null : Number(setor)),
    onSuccess: () => {
      notificar({ titulo: 'Recálculo pedido', descricao: 'Já entrou na fila.', tom: 'perfeito' })
      aoFechar()
      void depoisDeSalvar(CHAVE_TEMPO.recalculos)
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para pedir o recálculo',
        descricao: mensagemDoErro(erro),
        tom: 'danificado',
      }),
  })

  return (
    <Modal
      aberto
      aoFechar={(a) => !a && aoFechar()}
      titulo="Recalcular um período"
      descricao="Refaz os tempos do período escolhido com as regras e o calendário de hoje."
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao
            disabled={falta !== null}
            carregando={pedir.isPending}
            onClick={() => pedir.mutate()}
          >
            Recalcular
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo
            rotulo="De"
            type="date"
            max={hoje}
            value={de}
            onChange={(e) => setDe(e.target.value)}
          />
          <Campo
            rotulo="Até"
            type="date"
            max={hoje}
            value={ate}
            onChange={(e) => setAte(e.target.value)}
          />
        </div>
        <Selecao
          rotulo="Setor"
          valor={setor}
          opcoes={[
            { valor: 'todos', rotulo: 'Todos os setores' },
            ...setores
              .filter((s) => s.papel_no_fluxo !== 'terminal')
              .map((s) => ({ valor: String(s.id), rotulo: s.nome })),
          ]}
          aoMudar={setSetor}
        />
        {falta && <p className="text-sm text-atencao-texto">{falta}</p>}
      </div>
    </Modal>
  )
}
