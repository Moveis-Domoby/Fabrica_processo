import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { BadgeEstado, Botao, Campo, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import type { Estado } from '@/componentes/ui'
import {
  buscarCalendario,
  CHAVE_TEMPO,
  mensagemDoErro,
  removerExcecao,
  salvarExcecao,
  useDepoisDeSalvar,
  type ExcecaoCalendario,
  type FaixaDia,
  type SetorSimples,
  type TipoExcecao,
} from './api'
import { ConfirmarAcao, EditorFaixas, EstadoDaLeitura, Explicacao } from './comum'
import { diaIso, diaLocal, MESES, problemaNasFaixas } from './formato'

const TIPO_EXCECAO: Record<TipoExcecao, { rotulo: string; estado: Estado }> = {
  feriado: { rotulo: 'Feriado', estado: 'informativo' },
  trabalhado: { rotulo: 'Dia trabalhado', estado: 'perfeito' },
  parado: { rotulo: 'Dia parado', estado: 'atencao' },
}

const FAIXAS_SUGERIDAS: FaixaDia[] = [
  ['07:30', '12:00'],
  ['13:00', '18:00'],
]

interface Rascunho {
  id: number | null
  setorId: string // '' = a fábrica toda
  dia: string
  tipo: TipoExcecao
  descricao: string
  faixas: FaixaDia[]
}

/**
 * Aba "Calendário" (SESSAO-42 · F2): as exceções ao expediente — feriado, dia
 * trabalhado (com o horário; ex.: liberar um sábado) e dia parado — da fábrica
 * toda ou de um setor. Uma leitura por ano (até 400 dias na porta).
 */
export function AbaCalendario() {
  const notificar = useNotificacao()
  const depoisDeSalvar = useDepoisDeSalvar()
  const [ano, setAno] = useState(() => new Date().getFullYear())
  const consulta = useQuery({
    queryKey: CHAVE_TEMPO.calendario(ano),
    queryFn: () => buscarCalendario(`${ano}-01-01`, `${ano}-12-31`),
  })
  const excecoes = consulta.data?.excecoes ?? []
  const setores = consulta.data?.setores ?? []

  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [paraRemover, setParaRemover] = useState<ExcecaoCalendario | null>(null)

  const remover = useMutation({
    mutationFn: (id: number) => removerExcecao(id),
    onSuccess: () => {
      setParaRemover(null)
      notificar({ titulo: 'Exceção removida', tom: 'perfeito' })
      void depoisDeSalvar(CHAVE_TEMPO.calendarioTodos)
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para remover',
        descricao: mensagemDoErro(erro),
        tom: 'danificado',
      }),
  })

  const porMes = new Map<number, ExcecaoCalendario[]>()
  for (const e of excecoes) {
    const mes = diaLocal(e.dia).getMonth()
    porMes.set(mes, [...(porMes.get(mes) ?? []), e])
  }

  const novo = () =>
    setRascunho({
      id: null,
      setorId: '',
      dia: ano === new Date().getFullYear() ? diaIso(new Date()) : `${ano}-01-01`,
      tipo: 'feriado',
      descricao: '',
      faixas: FAIXAS_SUGERIDAS,
    })

  return (
    <div className="flex flex-col gap-5">
      <Explicacao>
        Os dias que fogem do expediente normal. Os feriados nacionais já vêm cadastrados; os de
        Natal e do Rio Grande do Norte você cadastra aqui. Para liberar um sábado, cadastre um "Dia
        trabalhado" com o horário. Mudou um dia, os tempos daquele dia são refeitos sozinhos.
      </Explicacao>

      <div className="flex flex-wrap items-center gap-2">
        <Botao
          variante="secundaria"
          icone={<ChevronLeft />}
          aria-label="Ano anterior"
          className="px-3"
          onClick={() => setAno((a) => a - 1)}
        />
        <span
          className="min-w-16 text-center text-lg font-semibold tabular-nums"
          aria-live="polite"
        >
          {ano}
        </span>
        <Botao
          variante="secundaria"
          icone={<ChevronRight />}
          aria-label="Próximo ano"
          className="px-3"
          onClick={() => setAno((a) => a + 1)}
        />
        <Botao icone={<Plus />} className="ml-auto" onClick={novo}>
          Nova exceção
        </Botao>
      </div>

      <EstadoDaLeitura carregando={consulta.isPending} erro={consulta.error} />

      {consulta.isSuccess && excecoes.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Nenhuma exceção em {ano} — vale o expediente normal todos os dias.
        </p>
      )}

      {[...porMes.entries()].map(([mes, itens]) => (
        <section key={mes} aria-labelledby={`mes-${mes}`} className="flex flex-col gap-2">
          <h3 id={`mes-${mes}`} className="text-base font-semibold capitalize">
            {MESES[mes]}
          </h3>
          <ul className="flex flex-col gap-2">
            {itens.map((e) => {
              const data = diaLocal(e.dia)
              return (
                <li
                  key={e.id}
                  className="flex flex-col gap-2 rounded-dm border border-borda bg-superficie p-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex items-baseline gap-2 sm:w-32 sm:shrink-0">
                    <span className="text-lg font-semibold tabular-nums">
                      {String(data.getDate()).padStart(2, '0')}/
                      {String(data.getMonth() + 1).padStart(2, '0')}
                    </span>
                    <span className="text-sm text-texto-suave">
                      {data.toLocaleDateString('pt-BR', { weekday: 'short' })}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <BadgeEstado
                        tamanho="sm"
                        estado={TIPO_EXCECAO[e.tipo].estado}
                        rotulo={TIPO_EXCECAO[e.tipo].rotulo}
                      />
                      <span className="text-sm font-medium text-texto">
                        {e.setor ?? 'Fábrica toda'}
                      </span>
                    </div>
                    {e.descricao && <p className="text-sm text-texto">{e.descricao}</p>}
                    {e.tipo === 'trabalhado' && e.faixas.length > 0 && (
                      <p className="text-sm text-texto-suave">
                        {e.faixas.map(([i, f]) => `${i}–${f}`).join(' e ')}
                      </p>
                    )}
                    {e.por && <p className="text-xs text-texto-fraco">Cadastrado por {e.por}</p>}
                  </div>
                  <div className="flex gap-2 sm:shrink-0">
                    <Botao
                      variante="secundaria"
                      icone={<Pencil />}
                      onClick={() =>
                        setRascunho({
                          id: e.id,
                          setorId: e.setor_id === null ? '' : String(e.setor_id),
                          dia: e.dia.slice(0, 10),
                          tipo: e.tipo,
                          descricao: e.descricao ?? '',
                          faixas: e.faixas.length > 0 ? e.faixas : FAIXAS_SUGERIDAS,
                        })
                      }
                    >
                      Editar
                    </Botao>
                    <Botao
                      variante="fantasma"
                      icone={<Trash2 />}
                      aria-label={`Remover ${TIPO_EXCECAO[e.tipo].rotulo.toLowerCase()} de ${e.dia.slice(8, 10)}/${e.dia.slice(5, 7)}`}
                      className="px-3"
                      onClick={() => setParaRemover(e)}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {rascunho && (
        <ModalExcecao
          rascunho={rascunho}
          setores={setores}
          aoFechar={() => setRascunho(null)}
          aoSalvar={(dia) => {
            setRascunho(null)
            const anoSalvo = diaLocal(dia).getFullYear()
            if (anoSalvo !== ano) setAno(anoSalvo)
            void depoisDeSalvar(CHAVE_TEMPO.calendarioTodos)
          }}
        />
      )}

      <ConfirmarAcao
        aberto={paraRemover !== null}
        aoFechar={() => setParaRemover(null)}
        titulo="Remover esta exceção?"
        descricao="O dia volta a seguir o expediente normal e os tempos dele são refeitos."
        rotuloConfirmar="Remover"
        perigo
        carregando={remover.isPending}
        aoConfirmar={() => paraRemover && remover.mutate(paraRemover.id)}
      />
    </div>
  )
}

function ModalExcecao({
  rascunho: inicial,
  setores,
  aoFechar,
  aoSalvar,
}: {
  rascunho: Rascunho
  setores: SetorSimples[]
  aoFechar: () => void
  aoSalvar: (dia: string) => void
}) {
  const notificar = useNotificacao()
  const [r, setR] = useState<Rascunho>(inicial)
  const problemaFaixas = r.tipo === 'trabalhado' ? problemaNasFaixas(r.faixas) : null
  const falta = !r.dia
    ? 'Escolha o dia.'
    : r.tipo === 'trabalhado' && r.faixas.length === 0
      ? 'O dia trabalhado precisa do horário.'
      : problemaFaixas

  const salvar = useMutation({
    mutationFn: () =>
      salvarExcecao({
        id: r.id,
        setorId: r.setorId === '' ? null : Number(r.setorId),
        dia: r.dia,
        tipo: r.tipo,
        descricao: r.descricao.trim(),
        faixas: r.faixas,
      }),
    onSuccess: () => {
      notificar({ titulo: 'Calendário salvo', tom: 'perfeito' })
      aoSalvar(r.dia)
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para salvar',
        descricao: mensagemDoErro(erro),
        tom: 'danificado',
      }),
  })

  return (
    <Modal
      aberto
      aoFechar={(a) => !a && aoFechar()}
      titulo={r.id === null ? 'Nova exceção no calendário' : 'Editar exceção'}
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            disabled={falta !== null}
            carregando={salvar.isPending}
            onClick={() => salvar.mutate()}
          >
            Salvar
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo
          rotulo="Dia"
          type="date"
          value={r.dia}
          onChange={(e) => setR({ ...r, dia: e.target.value })}
        />
        <Selecao
          rotulo="O que acontece"
          valor={r.tipo}
          opcoes={[
            { valor: 'feriado', rotulo: 'Feriado — a fábrica não trabalha' },
            { valor: 'trabalhado', rotulo: 'Dia trabalhado — com horário' },
            { valor: 'parado', rotulo: 'Dia parado — não trabalhou' },
          ]}
          aoMudar={(v) => setR({ ...r, tipo: v as TipoExcecao })}
        />
        <Selecao
          rotulo="Onde"
          valor={r.setorId === '' ? 'fabrica' : r.setorId}
          opcoes={[
            { valor: 'fabrica', rotulo: 'Fábrica toda' },
            ...setores.map((s) => ({ valor: String(s.id), rotulo: s.nome })),
          ]}
          aoMudar={(v) => setR({ ...r, setorId: v === 'fabrica' ? '' : v })}
        />
        <Campo
          rotulo="Descrição"
          ajuda="Ex.: Dia de Nossa Senhora da Apresentação; sábado de mutirão."
          maxLength={120}
          value={r.descricao}
          onChange={(e) => setR({ ...r, descricao: e.target.value })}
        />
        {r.tipo === 'trabalhado' && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-texto">Horário do dia</legend>
            <EditorFaixas
              rotulo="o dia trabalhado"
              faixas={r.faixas}
              aoMudar={(faixas) => setR({ ...r, faixas })}
              maximo={6}
              textoVazio="Ponha pelo menos uma faixa de horário."
            />
          </fieldset>
        )}
        {falta && !problemaFaixas && <p className="text-sm text-atencao-texto">{falta}</p>}
      </div>
    </Modal>
  )
}
