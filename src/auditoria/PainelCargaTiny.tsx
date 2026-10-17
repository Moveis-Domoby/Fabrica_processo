import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CircleCheck,
  CircleDashed,
  Download,
  Pause,
  Play,
  RefreshCw,
  Sigma,
  TriangleAlert,
} from 'lucide-react'
import { Botao, useNotificacao } from '@/componentes/ui'
import {
  buscarCargaTiny,
  fazerCargaTiny,
  ligarMudancasTiny,
  type AcaoCargaTiny,
  type ContaTiny,
  type LinhaCensoTiny,
} from '@/auditoria/api'

const CONTA: Record<ContaTiny, string> = { loja: 'Loja', fabrica: 'Fábrica' }

const GESTO: Record<AcaoCargaTiny, { titulo: string; depois: (n: number) => string }> = {
  contar: {
    titulo: 'A contagem entrou na fila',
    depois: (n) =>
      `${n} buscas ao Tiny. Em alguns minutos, toque em "Atualizar" para ver os números.`,
  },
  carregar: {
    titulo: 'A carga começou',
    depois: (n) =>
      `${n} itens na fila, com a vez mais baixa: as vendas e a conferência passam na frente. Leva algumas horas.`,
  },
  pausar: {
    titulo: 'Carga pausada',
    depois: () =>
      'As vendas e a conferência da madrugada continuam passando. Retome quando quiser.',
  },
  retomar: { titulo: 'Carga retomada', depois: () => 'A fila volta a buscar o que falta.' },
}

function numero(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : n.toLocaleString('pt-BR')
}

/** Os números da fila param no teto (o banco não varre o resto): "mais de 10.000". */
function numeroFila(n: number, teto: number): string {
  return n >= teto ? `mais de ${teto.toLocaleString('pt-BR')}` : n.toLocaleString('pt-BR')
}

function dinheiro(n: number | null | undefined): string {
  return n === null || n === undefined
    ? '—'
    : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function quando(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function rotuloJanela(janela: string | null): string {
  if (!janela || janela === 'tudo') return 'tudo'
  if (janela === 'antes') return 'antes de 2025'
  const [ano, mes] = janela.split('-')
  return mes && ano ? `${mes}/${ano}` : janela
}

/** Uma linha da conferência: o tipo de dado de uma conta, com os meses dentro. */
interface GrupoConferencia {
  chave: string
  conta: ContaTiny
  rotulo: string
  tiny: number | null
  aqui: number | null
  contando: boolean
  meses: LinhaCensoTiny[]
}

function agrupar(linhas: LinhaCensoTiny[]): GrupoConferencia[] {
  const grupos = new Map<string, GrupoConferencia>()
  for (const l of linhas) {
    const chave = `${l.conta}:${l.recurso}`
    const g = grupos.get(chave) ?? {
      chave,
      conta: l.conta,
      rotulo: l.rotulo ?? l.recurso,
      tiny: 0,
      aqui: 0,
      contando: false,
      meses: [],
    }
    g.meses.push(l)
    if (!l.lido || l.tiny === null || l.aqui === null) g.contando = true
    g.tiny = g.contando ? null : (g.tiny ?? 0) + (l.tiny ?? 0)
    // só pedidos, notas e contas a receber da loja vão mês a mês, e o "aqui"
    // deles é do mês; o resto é uma janela só (o cadastro inteiro)
    g.aqui = g.contando ? null : (g.aqui ?? 0) + (l.aqui ?? 0)
    grupos.set(chave, g)
  }
  return [...grupos.values()]
}

function Situacao({
  tiny,
  aqui,
  contando,
}: {
  tiny: number | null
  aqui: number | null
  contando: boolean
}) {
  if (contando || tiny === null || aqui === null)
    return (
      <span className="inline-flex items-center gap-1 text-texto-suave">
        <CircleDashed aria-hidden className="size-4" /> contando…
      </span>
    )
  if (tiny === aqui)
    return (
      <span className="inline-flex items-center gap-1 text-perfeito-forte">
        <CircleCheck aria-hidden className="size-4" /> bateu
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-atencao-forte">
      <TriangleAlert aria-hidden className="size-4" />
      {tiny > aqui ? `faltam ${numero(tiny - aqui)} aqui` : `${numero(aqui - tiny)} a mais aqui`}
    </span>
  )
}

/**
 * Auditoria → Carga do Tiny (SESSAO-33 · D-142/D-143): o dono conta no Tiny,
 * começa, pausa e retoma a carga completa, vê se bateu (quantos no Tiny ×
 * quantos aqui, mês a mês nos pedidos, notas e contas a receber da loja), as
 * somas das contas a pagar, o andamento por tipo de dado e os erros — e liga a
 * consulta de hora em hora (8h às 20h). A aba inteira numa requisição; sem
 * relógio na tela: "Atualizar" faz uma leitura (Lei §4).
 */
export function PainelCargaTiny() {
  const notificar = useNotificacao()
  const cliente = useQueryClient()
  const consulta = useQuery({ queryKey: ['auditoria', 'carga-tiny'], queryFn: buscarCargaTiny })

  const gesto = useMutation({
    mutationFn: (acao: AcaoCargaTiny) => fazerCargaTiny(acao),
    onSuccess: async (r, acao) => {
      notificar({
        titulo: GESTO[acao].titulo,
        descricao: GESTO[acao].depois(r.linhas),
        tom: 'perfeito',
      })
      await cliente.invalidateQueries({ queryKey: ['auditoria', 'carga-tiny'] })
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu certo',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })
  const mudancas = useMutation({
    mutationFn: (ligar: boolean) => ligarMudancasTiny(ligar),
    onSuccess: async (_r, ligar) => {
      notificar({
        titulo: ligar ? 'Consulta de hora em hora ligada' : 'Consulta de hora em hora desligada',
        descricao: ligar ? 'Das 8h às 20h, o que mudar no Tiny chega em até 1 hora.' : undefined,
        tom: 'perfeito',
      })
      await cliente.invalidateQueries({ queryKey: ['auditoria', 'carga-tiny'] })
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para mudar a consulta',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })

  const painel = consulta.data
  const grupos = useMemo(() => agrupar(painel?.censo.linhas ?? []), [painel])

  if (consulta.isError) {
    return (
      <p className="rounded-dm-lg border border-danificado-forte bg-superficie p-4 text-sm text-danificado-forte">
        {consulta.error instanceof Error
          ? consulta.error.message
          : 'Não deu para carregar a carga do Tiny.'}
      </p>
    )
  }
  if (consulta.isPending || !painel) return <p className="text-sm text-texto-suave">Carregando…</p>

  const ocupado = gesto.isPending
  const { teto } = painel.fila
  // há o que pausar: a carga ou a contagem ainda têm o que ler
  const cargaAndando =
    !painel.pausada &&
    (painel.carga.por_recurso.some((r) => r.pendentes + r.em_andamento > 0) ||
      painel.censo.linhas.some((l) => !l.lido))
  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="A fila agora"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-dm-lg border border-borda bg-superficie p-4 text-sm"
      >
        <span className="text-texto">
          Na fila agora:{' '}
          <strong className="tabular-nums">{numeroFila(painel.fila.pendentes, teto)}</strong> por
          ler
          {' · '}
          <strong className="tabular-nums">{numeroFila(painel.fila.esperando, teto)}</strong>{' '}
          esperando a nova tentativa
          {' · '}
          <strong className="tabular-nums">{numero(painel.fila.em_andamento)}</strong> em andamento
          {painel.pausada && (
            <span className="text-atencao-forte">
              {' · carga pausada: '}
              <strong className="tabular-nums">
                {numeroFila(painel.fila.pausados, teto)}
              </strong>{' '}
              esperando o "Retomar"
            </span>
          )}
          {painel.fila.erros > 0 && (
            <span className="text-danificado-forte">
              {' · '}
              <strong className="tabular-nums">{numeroFila(painel.fila.erros, teto)}</strong> com
              erro
            </span>
          )}
        </span>
        <Botao
          variante="fantasma"
          tamanho="sm"
          icone={<RefreshCw aria-hidden />}
          carregando={consulta.isFetching}
          onClick={() => void consulta.refetch()}
          className="ml-auto"
        >
          Atualizar
        </Botao>
      </section>

      <section
        aria-label="Contar e carregar"
        className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-4"
      >
        <p className="text-sm text-texto-suave">
          <strong className="text-texto">Contar no Tiny</strong> pergunta quantos há de cada coisa
          (alguns minutos; não traz nada). <strong className="text-texto">Começar a carga</strong>{' '}
          traz tudo o que falta das duas contas, devagar, sempre atrás das vendas e da conferência
          da madrugada.
        </p>
        <div className="flex flex-wrap gap-2">
          <Botao
            variante="secundaria"
            icone={<Sigma aria-hidden />}
            carregando={ocupado && gesto.variables === 'contar'}
            disabled={ocupado}
            onClick={() => gesto.mutate('contar')}
          >
            Contar no Tiny
          </Botao>
          <Botao
            variante="primaria"
            icone={<Download aria-hidden />}
            carregando={ocupado && gesto.variables === 'carregar'}
            disabled={ocupado}
            onClick={() => gesto.mutate('carregar')}
          >
            Começar a carga
          </Botao>
          {cargaAndando && (
            <Botao
              variante="fantasma"
              icone={<Pause aria-hidden />}
              carregando={ocupado && gesto.variables === 'pausar'}
              disabled={ocupado}
              onClick={() => gesto.mutate('pausar')}
            >
              Pausar
            </Botao>
          )}
          {painel.pausada && (
            <Botao
              variante="fantasma"
              icone={<Play aria-hidden />}
              carregando={ocupado && gesto.variables === 'retomar'}
              disabled={ocupado}
              onClick={() => gesto.mutate('retomar')}
            >
              Retomar
            </Botao>
          )}
        </div>
      </section>

      <section aria-label="Bateu com o Tiny?" className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-texto">Bateu com o Tiny?</h2>
        {grupos.length === 0 ? (
          <p className="rounded-dm-lg border border-borda bg-superficie p-4 text-sm text-texto-suave">
            Ainda não houve contagem. Toque em "Contar no Tiny".
          </p>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-dm-lg border border-borda bg-superficie">
            {grupos.map((g) => (
              <li
                key={g.chave}
                className="flex flex-col gap-1 border-b border-borda px-4 py-3 last:border-b-0"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium text-texto first-letter:uppercase">{g.rotulo}</span>
                  <span className="text-texto-fraco">{CONTA[g.conta]}</span>
                  <span className="text-texto-suave">
                    no Tiny <strong className="text-texto tabular-nums">{numero(g.tiny)}</strong> ·
                    aqui <strong className="text-texto tabular-nums">{numero(g.aqui)}</strong>
                  </span>
                  <span className="ml-auto">
                    <Situacao tiny={g.tiny} aqui={g.aqui} contando={g.contando} />
                  </span>
                </div>
                {g.meses.length > 1 && (
                  <details className="text-sm">
                    <summary className="flex min-h-toque-md cursor-pointer items-center text-texto-suave hover:text-texto">
                      Ver mês a mês
                    </summary>
                    <ul className="grid grid-cols-1 gap-x-4 gap-y-0.5 pb-1 sm:grid-cols-2">
                      {g.meses.map((m) => (
                        <li
                          key={m.janela ?? 'tudo'}
                          className="flex flex-wrap items-baseline gap-x-2 tabular-nums"
                        >
                          <span className="w-28 text-texto-suave">{rotuloJanela(m.janela)}</span>
                          <span className="text-texto">
                            {numero(m.tiny)} × {numero(m.aqui)}
                          </span>
                          <Situacao tiny={m.tiny} aqui={m.aqui} contando={!m.lido} />
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-texto-fraco">
          A contagem compara o Tiny e a plataforma no momento em que foi feita — depois da carga,
          conte de novo. Os contatos do Tiny incluem fornecedores e transportadoras; "aqui" conta os
          clientes que já têm o cadastro do Tiny.
        </p>
      </section>

      {painel.carga.somas.length > 0 && (
        <section aria-label="As somas das contas a pagar" className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-texto">As somas das contas a pagar</h2>
          <ul className="flex flex-col overflow-hidden rounded-dm-lg border border-borda bg-superficie text-sm">
            {painel.carga.somas.map((s) => (
              <li
                key={`${s.conta}:${s.janela}`}
                className="flex flex-wrap items-baseline gap-x-3 border-b border-borda px-4 py-2 tabular-nums last:border-b-0"
              >
                <span className="w-28 text-texto-suave">{rotuloJanela(s.janela)}</span>
                <span className="text-texto-fraco">{CONTA[s.conta]}</span>
                <span className="text-texto">
                  no Tiny {dinheiro(s.tiny)} · aqui {dinheiro(s.aqui)}
                </span>
                <span className="ml-auto text-texto-suave">
                  {!s.lido
                    ? 'lendo…'
                    : Math.abs(Number(s.tiny ?? 0) - Number(s.aqui ?? 0)) < 0.005
                      ? 'bateu'
                      : 'diferente'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {painel.carga.por_recurso.length > 0 && (
        <section aria-label="A carga, tipo por tipo" className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-texto">
            A carga, tipo por tipo{' '}
            <span className="text-sm font-normal text-texto-fraco">
              (começou {quando(painel.carga.rodada)})
            </span>
          </h2>
          <ul className="flex flex-col overflow-hidden rounded-dm-lg border border-borda bg-superficie text-sm">
            {painel.carga.por_recurso.map((r) => (
              <li
                key={`${r.conta}:${r.recurso}`}
                className="flex flex-wrap items-baseline gap-x-3 border-b border-borda px-4 py-2 last:border-b-0"
              >
                <span className="font-medium text-texto first-letter:uppercase">
                  {r.rotulo ?? r.recurso}
                </span>
                <span className="text-texto-fraco">{CONTA[r.conta]}</span>
                <span className="ml-auto text-texto-suave tabular-nums">
                  {numero(r.lidos)} lidos
                  {r.pendentes > 0 ? ` · ${numero(r.pendentes)} por ler` : ''}
                  {r.em_andamento > 0 ? ` · ${numero(r.em_andamento)} em andamento` : ''}
                  {r.nao_existem > 0 ? ` · ${numero(r.nao_existem)} não existem no Tiny` : ''}
                  {r.erros > 0 ? ` · ${numero(r.erros)} com erro` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {painel.erros.length > 0 && (
        <section aria-label="Os últimos erros" className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-texto">Os últimos erros</h2>
          <ul className="flex flex-col overflow-hidden rounded-dm-lg border border-borda bg-superficie text-sm">
            {painel.erros.map((e, i) => (
              <li
                key={`${e.recurso}:${e.referencia}:${i}`}
                className="flex flex-col gap-0.5 border-b border-borda px-4 py-2 last:border-b-0"
              >
                <span className="text-texto">
                  <span className="first-letter:uppercase">{e.rotulo ?? e.recurso}</span> ·{' '}
                  {CONTA[e.conta]} · {e.referencia}
                  <time className="ml-2 text-xs text-texto-fraco">{quando(e.quando)}</time>
                </span>
                <span className="break-words text-texto-suave">{e.erro ?? 'sem descrição'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        aria-label="O que mudou no Tiny"
        className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-4 text-sm"
      >
        <p className="text-texto-suave">
          <strong className="text-texto">O que o Tiny não avisa</strong> (produtos e clientes
          alterados): uma consulta por hora, das 8h às 20h — quando nada mudou, é uma pergunta só.{' '}
          {painel.mudancas.ligada === null
            ? ''
            : painel.mudancas.ligada
              ? `Ligada${painel.mudancas.ultima ? ` · última em ${quando(painel.mudancas.ultima)}` : ''}.`
              : 'Desligada.'}
        </p>
        <div>
          <Botao
            variante={painel.mudancas.ligada ? 'secundaria' : 'primaria'}
            carregando={mudancas.isPending}
            onClick={() => mudancas.mutate(!painel.mudancas.ligada)}
          >
            {painel.mudancas.ligada
              ? 'Desligar a consulta de hora em hora'
              : 'Ligar a consulta de hora em hora'}
          </Botao>
        </div>
        <p className="text-texto-suave">
          <strong className="text-texto">API nova do Tiny:</strong> loja{' '}
          {painel.api_nova.loja.ligada
            ? `ligada (renovada ${quando(painel.api_nova.loja.renovada_em)})`
            : 'desligada'}
          {' · '}fábrica{' '}
          {painel.api_nova.fabrica.ligada
            ? `ligada (renovada ${quando(painel.api_nova.fabrica.renovada_em)})`
            : 'desligada — ligue em Configurações → API e integrações'}
          .
        </p>
      </section>
    </div>
  )
}
