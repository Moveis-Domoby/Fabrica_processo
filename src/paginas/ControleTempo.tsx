import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, PauseCircle, PlayCircle, Trash2 } from 'lucide-react'
import { Botao, Campo, Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarNomesUsuarios, buscarSetores } from '@/kanban/api'
import {
  criarHorarios,
  criarPausa,
  listarHorarios,
  listarPausas,
  religarPausa,
  removerHorario,
} from '@/admin/api'

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

type Escopo = 'setor' | 'usuario'

/**
 * Controle de tempo do admin (SESSAO-07 / D-29 — pedido do dono):
 *   1. horário de funcionamento por setor E por usuário — fora dele o tempo
 *      não conta nos números;
 *   2. desligar o tempo de um setor/pessoa AGORA, até religar;
 *   3. o botão de risco: correção retroativa ("esqueci de desligar, ontem tal
 *      setor não funcionou").
 * Nada aqui mexe no que já foi registrado — os eventos são dado fixo; o
 * desconto acontece só no cálculo das métricas.
 */
export function ControleTempo() {
  const { perfil } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const { data: setores = [] } = useQuery({ queryKey: ['setores'], queryFn: () => buscarSetores() })
  const { data: nomesUsuarios = new Map<string, string>() } = useQuery({
    queryKey: ['usuarios', 'nomes'],
    queryFn: buscarNomesUsuarios,
    staleTime: 5 * 60_000,
  })
  const usuarios = [...nomesUsuarios.entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const { data: horarios = [] } = useQuery({ queryKey: ['horarios'], queryFn: listarHorarios })
  const { data: pausas = [] } = useQuery({ queryKey: ['pausas'], queryFn: listarPausas })

  const invalidar = (chave: string) => () =>
    clienteQuery.invalidateQueries({ queryKey: [chave] })

  function aoErro(titulo: string) {
    return (excecao: unknown) =>
      notificar({
        titulo,
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      })
  }

  // ---------- nomes ----------
  const nomeDoAlvo = (escopo: Escopo, setorId: number | null, usuarioId: string | null) =>
    escopo === 'setor'
      ? (setores.find((s) => s.id === setorId)?.nome ?? `setor ${setorId}`)
      : (nomesUsuarios.get(usuarioId ?? '') ?? 'pessoa')

  // ---------- escolha de alvo (compartilhada pelos três blocos) ----------
  const [escopo, setEscopo] = useState<Escopo>('setor')
  const [setorAlvo, setSetorAlvo] = useState('')
  const [usuarioAlvo, setUsuarioAlvo] = useState('')
  const alvoEscolhido = escopo === 'setor' ? setorAlvo !== '' : usuarioAlvo !== ''
  const alvoParametros = {
    escopo,
    setorId: setorAlvo ? Number(setorAlvo) : undefined,
    usuarioId: usuarioAlvo || undefined,
  }

  // ---------- horários ----------
  const [diasEscolhidos, setDiasEscolhidos] = useState<number[]>([1, 2, 3, 4, 5])
  const [horaInicio, setHoraInicio] = useState('07:00')
  const [horaFim, setHoraFim] = useState('17:00')

  const criarHorarioMutacao = useMutation({
    mutationFn: () =>
      criarHorarios({ ...alvoParametros, dias: diasEscolhidos, horaInicio, horaFim }),
    onSuccess: () => {
      notificar({ titulo: 'Horário salvo', tom: 'perfeito' })
      void invalidar('horarios')()
    },
    onError: aoErro('Não deu para salvar o horário'),
  })
  const removerHorarioMutacao = useMutation({
    mutationFn: removerHorario,
    onSuccess: invalidar('horarios'),
    onError: aoErro('Não deu para remover'),
  })

  // ---------- desligar agora / religar ----------
  const desligarMutacao = useMutation({
    mutationFn: () => criarPausa({ ...alvoParametros, criadoPor: perfil!.id }),
    onSuccess: () => {
      notificar({
        titulo: 'Tempo desligado',
        descricao: 'Fica desligado até você religar aqui.',
        tom: 'atencao',
      })
      void invalidar('pausas')()
    },
    onError: aoErro('Não deu para desligar'),
  })
  const religarMutacao = useMutation({
    mutationFn: religarPausa,
    onSuccess: () => {
      notificar({ titulo: 'Tempo religado', tom: 'perfeito' })
      void invalidar('pausas')()
    },
    onError: aoErro('Não deu para religar'),
  })

  // ---------- correção retroativa (o botão de risco) ----------
  const [retroInicio, setRetroInicio] = useState('')
  const [retroFim, setRetroFim] = useState('')
  const [retroMotivo, setRetroMotivo] = useState('')
  const retroMutacao = useMutation({
    mutationFn: () =>
      criarPausa({
        ...alvoParametros,
        inicio: new Date(retroInicio).toISOString(),
        fim: new Date(retroFim).toISOString(),
        retroativa: true,
        motivo: retroMotivo,
        criadoPor: perfil!.id,
      }),
    onSuccess: () => {
      notificar({ titulo: 'Correção registrada', tom: 'perfeito' })
      setRetroInicio('')
      setRetroFim('')
      setRetroMotivo('')
      void invalidar('pausas')()
    },
    onError: aoErro('Não deu para registrar a correção'),
  })

  const pausasAbertas = pausas.filter((p) => p.fim === null)
  const pausasFechadas = pausas.filter((p) => p.fim !== null)

  const quando = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl sm:text-3xl">Controle de tempo</h1>
        <p className="mt-1 max-w-2xl text-texto-suave">
          Aqui você define QUANDO o tempo conta. O que já foi registrado não muda nunca — estes
          ajustes valem só para o cálculo das métricas.
        </p>
      </div>

      {/* Alvo compartilhado */}
      <section className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-5">
        <h2 className="text-lg">De quem é o tempo?</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Selecao
            rotulo="Escopo"
            opcoes={[
              { valor: 'setor', rotulo: 'Setor inteiro' },
              { valor: 'usuario', rotulo: 'Uma pessoa' },
            ]}
            valor={escopo}
            aoMudar={(v) => setEscopo(v as Escopo)}
          />
          {escopo === 'setor' ? (
            <Selecao
              rotulo="Setor"
              opcoes={setores.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
              valor={setorAlvo}
              aoMudar={setSetorAlvo}
            />
          ) : (
            <Selecao
              rotulo="Pessoa"
              opcoes={usuarios.map((u) => ({ valor: u.id, rotulo: u.nome }))}
              valor={usuarioAlvo}
              aoMudar={setUsuarioAlvo}
            />
          )}
          <div className="flex items-end">
            <Botao
              variante="secundaria"
              icone={<PauseCircle />}
              disabled={!alvoEscolhido}
              carregando={desligarMutacao.isPending}
              onClick={() => desligarMutacao.mutate()}
            >
              Desligar o tempo agora
            </Botao>
          </div>
        </div>
        <p className="text-xs text-texto-suave">
          Desligado, o tempo desse setor/pessoa não conta até você religar na lista abaixo.
        </p>
      </section>

      {/* Pausas abertas */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg">Tempo desligado agora</h2>
        {pausasAbertas.length === 0 && (
          <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
            Nada desligado — todo mundo contando normalmente.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {pausasAbertas.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-dm border border-atencao-forte bg-atencao-fundo px-4 py-3"
            >
              <PauseCircle aria-hidden className="size-5 shrink-0 text-atencao-texto" />
              <span className="text-sm font-medium text-atencao-texto">
                {nomeDoAlvo(p.escopo, p.setor_id, p.usuario_id)}
              </span>
              <span className="text-xs text-atencao-texto">desligado desde {quando(p.inicio)}</span>
              <Botao
                variante="secundaria"
                tamanho="sm"
                icone={<PlayCircle />}
                className="ml-auto"
                carregando={religarMutacao.isPending}
                onClick={() => religarMutacao.mutate(p.id)}
              >
                Religar
              </Botao>
            </li>
          ))}
        </ul>
      </section>

      {/* Horário de funcionamento */}
      <section className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-5">
        <h2 className="flex items-center gap-2 text-lg">
          <CalendarClock aria-hidden className="size-5 text-texto-suave" />
          Horário de funcionamento
        </h2>
        <p className="text-sm text-texto-suave">
          Fora do horário, o tempo não conta. Sem horário cadastrado, conta o dia inteiro. Com
          horário do setor E da pessoa, vale o que estiver dentro dos dois.
        </p>

        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="mb-1 w-full text-sm font-medium text-texto">Dias da semana</legend>
          {DIAS_CURTOS.map((dia, indice) => (
            <button
              key={dia}
              type="button"
              role="checkbox"
              aria-checked={diasEscolhidos.includes(indice)}
              onClick={() =>
                setDiasEscolhidos((atuais) =>
                  atuais.includes(indice)
                    ? atuais.filter((d) => d !== indice)
                    : [...atuais, indice].sort(),
                )
              }
              className={cn(
                'min-h-toque-md rounded-dm border px-3 text-sm font-medium transition-colors',
                diasEscolhidos.includes(indice)
                  ? 'border-acao-ativa bg-acao text-acao-texto'
                  : 'border-borda-forte bg-superficie text-texto-suave',
              )}
            >
              {dia}
            </button>
          ))}
        </fieldset>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Campo
            rotulo="Começa às"
            type="time"
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
          />
          <Campo
            rotulo="Termina às"
            type="time"
            value={horaFim}
            onChange={(e) => setHoraFim(e.target.value)}
          />
          <div className="flex items-end">
            <Botao
              disabled={!alvoEscolhido || diasEscolhidos.length === 0 || horaFim <= horaInicio}
              carregando={criarHorarioMutacao.isPending}
              onClick={() => criarHorarioMutacao.mutate()}
            >
              Salvar horário
            </Botao>
          </div>
        </div>

        {horarios.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {horarios.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center gap-2 rounded-dm border border-borda px-3 py-2 text-sm"
              >
                <span className="font-medium text-texto">
                  {nomeDoAlvo(h.escopo, h.setor_id, h.usuario_id)}
                </span>
                <span className="text-texto-suave">
                  {DIAS[h.dia_semana]} · {h.hora_inicio.slice(0, 5)}–{h.hora_fim.slice(0, 5)}
                </span>
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  icone={<Trash2 />}
                  aria-label="Remover este horário"
                  className="ml-auto"
                  onClick={() => removerHorarioMutacao.mutate(h.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Correção retroativa — o botão de risco */}
      <section className="flex flex-col gap-3 rounded-dm-lg border-2 border-danificado-forte/40 bg-superficie p-5">
        <h2 className="flex items-center gap-2 text-lg">
          <AlertTriangle aria-hidden className="size-5 text-danificado-forte" />
          Correção retroativa
        </h2>
        <p className="text-sm text-texto-suave">
          Para o "esqueci de desligar": marque um período passado em que o setor/pessoa escolhido
          acima <strong className="text-texto">não funcionou</strong>. O período deixa de contar
          nas métricas — e nada do que foi registrado se altera.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo
            rotulo="Não contou desde"
            type="datetime-local"
            value={retroInicio}
            onChange={(e) => setRetroInicio(e.target.value)}
          />
          <Campo
            rotulo="Até"
            type="datetime-local"
            value={retroFim}
            onChange={(e) => setRetroFim(e.target.value)}
          />
        </div>
        <Campo
          rotulo="Motivo"
          ajuda="Fica registrado junto da correção (ex.: 'setor parado por falta de energia')."
          value={retroMotivo}
          onChange={(e) => setRetroMotivo(e.target.value)}
        />
        <div>
          <Botao
            variante="perigo"
            disabled={!alvoEscolhido || !retroInicio || !retroFim || retroFim <= retroInicio}
            carregando={retroMutacao.isPending}
            onClick={() => retroMutacao.mutate()}
          >
            Registrar período sem contagem
          </Botao>
        </div>
      </section>

      {/* Histórico de pausas fechadas */}
      {pausasFechadas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg">Histórico de pausas</h2>
          <ul className="flex flex-col gap-1.5">
            {pausasFechadas.slice(0, 15).map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded-dm border border-borda px-3 py-2 text-sm text-texto-suave"
              >
                <span className="font-medium text-texto">
                  {nomeDoAlvo(p.escopo, p.setor_id, p.usuario_id)}
                </span>
                <span className="tabular-nums">
                  {quando(p.inicio)} → {p.fim ? quando(p.fim) : ''}
                </span>
                {p.retroativa && (
                  <span className="rounded-full bg-superficie-sutil px-2 py-0.5 text-xs">
                    retroativa
                  </span>
                )}
                {p.motivo && <span className="text-xs">· {p.motivo}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
