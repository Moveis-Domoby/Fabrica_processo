import { lazy, Suspense, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronDown, Copy, Info, Save, Undo2 } from 'lucide-react'
import { Botao, Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import {
  buscarExpediente,
  CHAVE_TEMPO,
  mensagemDoErro,
  salvarExpediente,
  useDepoisDeSalvar,
  type FaixaSemana,
  type SetorExpediente,
} from './api'
import { ConfirmarAcao, EditorFaixas, EstadoDaLeitura, Explicacao } from './comum'
import { DIAS, faixasPorDia, problemaNasFaixas, resumoSemana } from './formato'

// O "desligar o tempo agora" só baixa e lê quando a seção abre (Lei §2).
const DesligarTempo = lazy(() =>
  import('./DesligarTempo').then((m) => ({ default: m.DesligarTempo })),
)

/** A semana do galpão: segunda primeiro, domingo no fim. */
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0]

/**
 * Aba "Expediente e intervalos" (SESSAO-42 · F2): por setor, as faixas de cada
 * dia da semana — o intervalo (almoço) é o espaço entre duas faixas. Uma
 * leitura (plt_fn_tempo_expediente); salvar manda TODAS as faixas do setor.
 */
export function AbaExpediente() {
  const consulta = useQuery({ queryKey: CHAVE_TEMPO.expediente, queryFn: buscarExpediente })
  const setores = consulta.data ?? []
  const [setorId, setSetorId] = useState<number | null>(null)
  const escolhido = setores.find((s) => s.id === setorId) ?? setores[0] ?? null
  const [desligarAberto, setDesligarAberto] = useState(false)

  return (
    <div className="flex flex-col gap-5">
      <Explicacao>
        O horário de trabalho de cada setor. Fora dele o tempo não conta. Para o almoço, use duas
        faixas no mesmo dia (ex.: 07:30 às 12:00 e 13:00 às 18:00) — o espaço entre elas é o
        intervalo.
      </Explicacao>
      <p className="flex max-w-3xl items-start gap-2 rounded-dm border border-info-borda bg-info-fundo p-3 text-sm text-info-texto">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        Mudar o horário refaz os tempos desde o começo do uso da plataforma. O recálculo anda
        sozinho — acompanhe na aba Recálculo.
      </p>

      <EstadoDaLeitura carregando={consulta.isPending} erro={consulta.error} />

      {setores.length > 0 && escolhido && (
        <>
          <Selecao
            className="sm:max-w-sm"
            rotulo="Setor"
            valor={String(escolhido.id)}
            opcoes={setores.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
            aoMudar={(v) => setSetorId(Number(v))}
          />
          <EditorSemana
            key={`${escolhido.id}-${consulta.dataUpdatedAt}`}
            setor={escolhido}
            setores={setores}
          />

          <section aria-labelledby="resumo-expediente" className="flex flex-col gap-2">
            <h3 id="resumo-expediente" className="text-base font-semibold">
              Todos os setores
            </h3>
            <ul className="flex flex-col gap-1.5">
              {setores.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-pressed={s.id === escolhido.id}
                    onClick={() => setSetorId(s.id)}
                    className={cn(
                      'flex min-h-toque-md w-full flex-col items-start gap-0.5 rounded-dm border px-3 py-2 text-left text-sm transition-colors sm:flex-row sm:items-center sm:gap-3',
                      s.id === escolhido.id
                        ? 'border-acao-ativa bg-superficie-sutil font-medium'
                        : 'border-borda bg-superficie hover:bg-superficie-sutil',
                    )}
                  >
                    <span className="font-medium text-texto sm:w-40 sm:shrink-0">{s.nome}</span>
                    <span className="text-texto-suave">{resumoSemana(s.faixas)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* Recolhida: só monta (e só lê) no clique */}
      <section className="rounded-dm-lg border border-borda bg-superficie">
        <button
          type="button"
          aria-expanded={desligarAberto}
          aria-controls="desligar-tempo-conteudo"
          onClick={() => setDesligarAberto((a) => !a)}
          className="flex min-h-toque-md w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="font-semibold text-texto">
            Desligar o tempo agora e correção retroativa
          </span>
          <ChevronDown
            aria-hidden
            className={cn('size-5 shrink-0 transition-transform', desligarAberto && 'rotate-180')}
          />
        </button>
        {desligarAberto && (
          <div id="desligar-tempo-conteudo" className="border-t border-borda p-4 sm:p-5">
            <Suspense fallback={<EstadoDaLeitura carregando erro={null} />}>
              <DesligarTempo />
            </Suspense>
          </div>
        )}
      </section>
    </div>
  )
}

function EditorSemana({ setor, setores }: { setor: SetorExpediente; setores: SetorExpediente[] }) {
  const notificar = useNotificacao()
  const depoisDeSalvar = useDepoisDeSalvar()
  const original = faixasPorDia(setor.faixas)
  const [dias, setDias] = useState<[string, string][][]>(original)
  const [confirmarCopia, setConfirmarCopia] = useState(false)

  const mudou = JSON.stringify(dias) !== JSON.stringify(original)
  const problemas = dias.map((d) => problemaNasFaixas(d))
  const temProblema = problemas.some(Boolean)
  const semanaVazia = dias.every((d) => d.length === 0)

  const paraFaixas = (): FaixaSemana[] =>
    dias.flatMap((faixas, dia) =>
      [...faixas]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([ini, fim]) => [dia, ini, fim] as FaixaSemana),
    )

  const salvar = useMutation({
    mutationFn: (copiarParaTodos: boolean) =>
      salvarExpediente(setor.id, paraFaixas(), copiarParaTodos),
    onSuccess: (n, copiarParaTodos) => {
      setConfirmarCopia(false)
      notificar({
        titulo: copiarParaTodos
          ? `Horário copiado para ${n} ${n === 1 ? 'setor' : 'setores'}`
          : 'Expediente salvo',
        descricao: 'Os tempos estão sendo refeitos com o horário novo.',
        tom: 'perfeito',
      })
      void depoisDeSalvar(CHAVE_TEMPO.expediente)
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para salvar o expediente',
        descricao: mensagemDoErro(erro),
        tom: 'danificado',
      }),
  })

  const outrosDeProducao = setores.filter(
    (s) => s.id !== setor.id && (s.papel === 'producao' || s.papel === 'entrada'),
  ).length

  return (
    <section
      aria-label={`Expediente de ${setor.nome}`}
      className="flex flex-col gap-4 rounded-dm-lg border border-borda bg-superficie p-4 sm:p-5"
    >
      {semanaVazia && (
        <p className="text-sm text-atencao-texto">
          Sem nenhuma faixa, o tempo deste setor conta o dia inteiro, todos os dias.
        </p>
      )}
      <ul className="flex flex-col divide-y divide-borda">
        {ORDEM_DIAS.map((dia) => (
          <li key={dia} className="flex flex-col gap-2 py-3 sm:flex-row sm:gap-4">
            <span className="font-medium text-texto capitalize sm:w-24 sm:shrink-0 sm:pt-2.5">
              {DIAS[dia]}
            </span>
            <div className="min-w-0 flex-1">
              <EditorFaixas
                rotulo={DIAS[dia]}
                faixas={dias[dia]}
                aoMudar={(faixas) =>
                  setDias((atuais) => atuais.map((d, i) => (i === dia ? faixas : d)))
                }
                maximo={10}
                textoVazio={semanaVazia ? 'Sem faixa.' : 'Folga — o tempo não conta neste dia.'}
              />
            </div>
          </li>
        ))}
      </ul>

      {dias[1].length > 0 && (
        <div>
          <Botao
            variante="fantasma"
            icone={<Copy />}
            onClick={() =>
              setDias((atuais) =>
                atuais.map((d, i) =>
                  i >= 2 && i <= 5 ? atuais[1].map((f) => [...f] as [string, string]) : d,
                ),
              )
            }
          >
            Usar o horário de segunda de terça a sexta
          </Botao>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-borda pt-4 sm:flex-row sm:flex-wrap sm:justify-end">
        <Botao
          variante="fantasma"
          icone={<Undo2 />}
          disabled={!mudou || salvar.isPending}
          onClick={() => setDias(original)}
        >
          Desfazer
        </Botao>
        <Botao
          variante="secundaria"
          icone={<Copy />}
          disabled={temProblema || salvar.isPending || outrosDeProducao === 0}
          onClick={() => setConfirmarCopia(true)}
        >
          Copiar para todos os setores
        </Botao>
        <Botao
          icone={<Save />}
          disabled={!mudou || temProblema}
          carregando={salvar.isPending && salvar.variables === false}
          onClick={() => salvar.mutate(false)}
        >
          Salvar o expediente
        </Botao>
      </div>

      <ConfirmarAcao
        aberto={confirmarCopia}
        aoFechar={() => setConfirmarCopia(false)}
        titulo="Copiar para todos os setores?"
        descricao={`O horário que está na tela agora passa a valer para o PCP e para todos os setores de produção (o de cada um é trocado por este). Os tempos de todos eles são refeitos desde o começo.`}
        rotuloConfirmar="Copiar para todos"
        carregando={salvar.isPending && salvar.variables === true}
        aoConfirmar={() => salvar.mutate(true)}
      />
    </section>
  )
}
