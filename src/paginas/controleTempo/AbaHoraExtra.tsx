import { useState } from 'react'
import { useInfiniteQuery, useMutation } from '@tanstack/react-query'
import { Ban, Plus } from 'lucide-react'
import { BadgeEstado, Botao, Campo, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { useAgora } from '@/kanban/tempo'
import {
  buscarHorasExtras,
  cancelarHoraExtra,
  CHAVE_TEMPO,
  mensagemDoErro,
  salvarHoraExtra,
  useDepoisDeSalvar,
  type HoraExtra,
  type PessoaHoraExtra,
  type SetorSimples,
} from './api'
import { ConfirmarAcao, EstadoDaLeitura, Explicacao } from './comum'
import { dataHora, paraCampoDataHora, soHora } from './formato'

const MAXIMO_HORAS = 16

/**
 * Aba "Hora extra" (SESSAO-42 · F2 · resposta 3): a hora extra autorizada —
 * do setor inteiro ou de uma pessoa. É a única aba que o líder de setor vê (a
 * porta já devolve só os setores dele). Lista por cursor (início + id), a
 * próxima página só no "Ver mais".
 */
export function AbaHoraExtra() {
  const notificar = useNotificacao()
  const depoisDeSalvar = useDepoisDeSalvar()
  const agora = useAgora()
  const consulta = useInfiniteQuery({
    queryKey: CHAVE_TEMPO.horasExtras,
    queryFn: ({ pageParam }) => buscarHorasExtras(pageParam),
    initialPageParam: null as { inicio: string; id: number } | null,
    getNextPageParam: (ultima) => {
      const fim = ultima.itens[ultima.itens.length - 1]
      return ultima.tem_mais && fim ? { inicio: fim.inicio, id: fim.id } : undefined
    },
  })
  const primeira = consulta.data?.pages[0]
  const itens = consulta.data?.pages.flatMap((p) => p.itens) ?? []
  const setores = primeira?.setores ?? []
  const pessoas = primeira?.pessoas ?? []

  const [formAberto, setFormAberto] = useState(false)
  const [paraCancelar, setParaCancelar] = useState<HoraExtra | null>(null)

  const cancelar = useMutation({
    mutationFn: (id: number) => cancelarHoraExtra(id),
    onSuccess: () => {
      setParaCancelar(null)
      notificar({ titulo: 'Hora extra cancelada', tom: 'perfeito' })
      void depoisDeSalvar(CHAVE_TEMPO.horasExtras)
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para cancelar',
        descricao: mensagemDoErro(erro),
        tom: 'danificado',
      }),
  })

  const situacao = (h: HoraExtra) => {
    if (h.cancelada_em) return <BadgeEstado tamanho="sm" estado="atencao" rotulo="Cancelada" />
    const ini = Date.parse(h.inicio)
    const fim = Date.parse(h.fim)
    if (agora >= ini && agora < fim)
      return <BadgeEstado tamanho="sm" estado="perfeito" rotulo="Valendo agora" />
    if (agora < ini) return <BadgeEstado tamanho="sm" estado="informativo" rotulo="Programada" />
    return <BadgeEstado tamanho="sm" estado="neutro" rotulo="Já passou" />
  }

  return (
    <div className="flex flex-col gap-5">
      <Explicacao>
        A hora extra autorizada pelo líder do setor ou pelo administrador. Dentro dela o tempo conta
        normalmente, e a pausa sozinha do fim do expediente acontece no fim da hora extra, não no
        fim do horário normal. Pode ser do setor inteiro ou de uma pessoa, com até {MAXIMO_HORAS}{' '}
        horas.
      </Explicacao>

      <div>
        <Botao icone={<Plus />} disabled={setores.length === 0} onClick={() => setFormAberto(true)}>
          Registrar hora extra
        </Botao>
      </div>

      <EstadoDaLeitura carregando={consulta.isPending} erro={consulta.error} />

      {consulta.isSuccess && itens.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Nenhuma hora extra registrada ainda.
        </p>
      )}

      {itens.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Horas extras">
          {itens.map((h) => {
            const mesmoDia = new Date(h.inicio).toDateString() === new Date(h.fim).toDateString()
            return (
              <li
                key={h.id}
                className="flex flex-col gap-2 rounded-dm border border-borda bg-superficie p-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {situacao(h)}
                    <span className="font-medium text-texto">{h.setor}</span>
                    <span className="text-sm text-texto-suave">
                      · {h.pessoa ?? 'Setor inteiro'}
                    </span>
                  </div>
                  <p
                    className={
                      h.cancelada_em
                        ? 'text-sm text-texto-suave line-through tabular-nums'
                        : 'text-sm text-texto tabular-nums'
                    }
                  >
                    {dataHora(h.inicio)} → {mesmoDia ? soHora(h.fim) : dataHora(h.fim)}
                  </p>
                  {h.motivo && <p className="text-sm text-texto-suave">{h.motivo}</p>}
                  {h.por && <p className="text-xs text-texto-fraco">Registrada por {h.por}</p>}
                </div>
                {!h.cancelada_em && (
                  <Botao
                    variante="secundaria"
                    icone={<Ban />}
                    className="sm:shrink-0"
                    onClick={() => setParaCancelar(h)}
                  >
                    Cancelar
                  </Botao>
                )}
              </li>
            )
          })}
        </ul>
      )}

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

      {formAberto && (
        <ModalHoraExtra
          setores={setores}
          pessoas={pessoas}
          aoFechar={() => setFormAberto(false)}
          aoSalvar={() => {
            setFormAberto(false)
            void depoisDeSalvar(CHAVE_TEMPO.horasExtras)
          }}
        />
      )}

      <ConfirmarAcao
        aberto={paraCancelar !== null}
        aoFechar={() => setParaCancelar(null)}
        titulo="Cancelar esta hora extra?"
        descricao="O período volta a seguir o expediente normal e os tempos dele são refeitos."
        rotuloConfirmar="Cancelar a hora extra"
        perigo
        carregando={cancelar.isPending}
        aoConfirmar={() => paraCancelar && cancelar.mutate(paraCancelar.id)}
      />
    </div>
  )
}

function horarioPadrao(): [string, string] {
  const inicio = new Date()
  inicio.setHours(18, 0, 0, 0)
  const fim = new Date(inicio)
  fim.setHours(20, 0, 0, 0)
  return [paraCampoDataHora(inicio), paraCampoDataHora(fim)]
}

function ModalHoraExtra({
  setores,
  pessoas,
  aoFechar,
  aoSalvar,
}: {
  setores: SetorSimples[]
  pessoas: PessoaHoraExtra[]
  aoFechar: () => void
  aoSalvar: () => void
}) {
  const notificar = useNotificacao()
  const [setorId, setSetorId] = useState(setores.length === 1 ? String(setores[0].id) : '')
  const [quem, setQuem] = useState('setor')
  const [[inicio, fim], setPeriodo] = useState<[string, string]>(horarioPadrao)
  const [motivo, setMotivo] = useState('')

  const pessoasDoSetor = pessoas.filter(
    (p) => setorId !== '' && p.setores.includes(Number(setorId)),
  )
  const horas = inicio && fim ? (Date.parse(fim) - Date.parse(inicio)) / 3_600_000 : 0
  const falta =
    setorId === ''
      ? 'Escolha o setor.'
      : !inicio || !fim
        ? 'Diga quando começa e quando termina.'
        : horas <= 0
          ? 'A hora extra termina depois de começar.'
          : horas > MAXIMO_HORAS
            ? `Uma hora extra tem no máximo ${MAXIMO_HORAS} horas — divida em duas.`
            : null

  const salvar = useMutation({
    mutationFn: () =>
      salvarHoraExtra({
        setorId: Number(setorId),
        usuarioId: quem === 'setor' ? null : quem,
        inicio: new Date(inicio).toISOString(),
        fim: new Date(fim).toISOString(),
        motivo: motivo.trim(),
      }),
    onSuccess: () => {
      notificar({ titulo: 'Hora extra registrada', tom: 'perfeito' })
      aoSalvar()
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para registrar a hora extra',
        descricao: mensagemDoErro(erro),
        tom: 'danificado',
      }),
  })

  return (
    <Modal
      aberto
      aoFechar={(a) => !a && aoFechar()}
      titulo="Registrar hora extra"
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao
            disabled={falta !== null}
            carregando={salvar.isPending}
            onClick={() => salvar.mutate()}
          >
            Registrar
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Selecao
          rotulo="Setor"
          valor={setorId}
          opcoes={setores.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
          aoMudar={(v) => {
            setSetorId(v)
            setQuem('setor')
          }}
        />
        <Selecao
          rotulo="Quem"
          valor={quem}
          desabilitado={setorId === ''}
          opcoes={[
            { valor: 'setor', rotulo: 'O setor inteiro' },
            ...pessoasDoSetor.map((p) => ({ valor: p.id, rotulo: p.nome })),
          ]}
          aoMudar={setQuem}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo
            rotulo="Começa"
            type="datetime-local"
            value={inicio}
            onChange={(e) => setPeriodo([e.target.value, fim])}
          />
          <Campo
            rotulo="Termina"
            type="datetime-local"
            value={fim}
            onChange={(e) => setPeriodo([inicio, e.target.value])}
          />
        </div>
        <Campo
          rotulo="Motivo"
          ajuda="Ex.: pedido grande para entregar na segunda."
          maxLength={200}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        {falta && <p className="text-sm text-atencao-texto">{falta}</p>}
      </div>
    </Modal>
  )
}
