import { useId, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Save, Undo2 } from 'lucide-react'
import { Botao, Campo, Selecao, useNotificacao } from '@/componentes/ui'
import {
  buscarRegras,
  CHAVE_TEMPO,
  mensagemDoErro,
  salvarDataOficial,
  salvarRegras,
  useDepoisDeSalvar,
  type ChaveRegra,
  type RegrasSetor,
} from './api'
import { EstadoDaLeitura, Explicacao, Interruptor } from './comum'
import { diaIso } from './formato'

type ChaveNumero = Exclude<
  ChaveRegra,
  'pausar_fim_expediente' | 'retrabalho_fora' | 'admin_fora' | 'avisar_pulo' | 'permite_lote'
>
type ChaveLiga = Exclude<ChaveRegra, ChaveNumero>

interface RegraNumero {
  tipo: 'numero'
  chave: ChaveNumero
  rotulo: string
  ajuda?: string
  min: number
  max: number
  /** Pode ficar vazio (vira "sem"/"desligado"). */
  vazio?: boolean
  /** Mostrado em horas, guardado em minutos. */
  emHoras?: boolean
  decimal?: boolean
}
interface RegraLiga {
  tipo: 'liga'
  chave: ChaveLiga
  rotulo: string
  ajuda?: string
}
type Regra = RegraNumero | RegraLiga

const NUMEROS: Record<ChaveNumero, RegraNumero> = {
  minimo_min: {
    tipo: 'numero',
    chave: 'minimo_min',
    rotulo: 'Passagem mínima (min)',
    ajuda: 'Passagem mais curta que isso fica fora da média.',
    min: 0,
    max: 120,
  },
  teto_min: {
    tipo: 'numero',
    chave: 'teto_min',
    rotulo: 'Teto (horas úteis; vazio = sem teto)',
    ajuda: 'Passagem mais longa que isso fica fora da média.',
    min: 10 / 60,
    max: 24,
    vazio: true,
    emHoras: true,
    decimal: true,
  },
  fator_longo: {
    tipo: 'numero',
    chave: 'fator_longo',
    rotulo: 'Vezes a mediana do modelo',
    min: 1.2,
    max: 20,
    decimal: true,
  },
  base_minima: {
    tipo: 'numero',
    chave: 'base_minima',
    rotulo: 'Montagens de base (pelo menos)',
    min: 2,
    max: 100,
  },
  faixa_media_pct: {
    tipo: 'numero',
    chave: 'faixa_media_pct',
    rotulo: 'Faixa "na média" (±%)',
    ajuda: 'Até essa diferença do tempo padrão, a passagem conta como "na média".',
    min: 1,
    max: 50,
  },
  janela_padrao_dias: {
    tipo: 'numero',
    chave: 'janela_padrao_dias',
    rotulo: 'Janela do tempo padrão (dias)',
    ajuda: 'Quantos dias para trás entram no cálculo do tempo padrão de cada modelo.',
    min: 7,
    max: 730,
  },
  volta_rapida_min: {
    tipo: 'numero',
    chave: 'volta_rapida_min',
    rotulo: 'Volta para a fila em até (min) = clique errado',
    ajuda: 'O card que volta para a fila dentro desse tempo não conta como passagem.',
    min: 0,
    max: 60,
  },
  aviso_esquecido_min: {
    tipo: 'numero',
    chave: 'aviso_esquecido_min',
    rotulo: 'Aviso de card esquecido (min; vazio = desligado)',
    ajuda: 'Depois desse tempo rodando, quem está com o card recebe um aviso.',
    min: 10,
    max: 1440,
    vazio: true,
  },
  sem_resposta_min: {
    tipo: 'numero',
    chave: 'sem_resposta_min',
    rotulo: 'Sem resposta ao aviso vira pausa em (min)',
    min: 5,
    max: 240,
  },
}

const GRUPOS: { titulo: string; regras: (Regra | 'longo')[] }[] = [
  {
    titulo: 'O que entra na média',
    regras: [
      NUMEROS.minimo_min,
      NUMEROS.teto_min,
      'longo',
      NUMEROS.faixa_media_pct,
      NUMEROS.janela_padrao_dias,
      NUMEROS.volta_rapida_min,
      { tipo: 'liga', chave: 'retrabalho_fora', rotulo: 'Retrabalho fora da média' },
      {
        tipo: 'liga',
        chave: 'admin_fora',
        rotulo: 'Gestos de administrador fora da média',
        ajuda: 'O card mexido por um administrador (e não pela equipe) não entra na média.',
      },
    ],
  },
  {
    titulo: 'Fim do expediente e avisos',
    regras: [
      {
        tipo: 'liga',
        chave: 'pausar_fim_expediente',
        rotulo: 'Pausar sozinho no fim do expediente',
        ajuda: 'No fim do horário, o card rodando pausa sozinho e quem estava sai do setor.',
      },
      NUMEROS.aviso_esquecido_min,
      NUMEROS.sem_resposta_min,
      {
        tipo: 'liga',
        chave: 'avisar_pulo',
        rotulo: 'Avisar quando pular a execução',
        ajuda: 'Avisa quando um móvel passa pelo setor sem ninguém iniciar a execução.',
      },
    ],
  },
  {
    titulo: 'Montagem',
    regras: [
      {
        tipo: 'liga',
        chave: 'permite_lote',
        rotulo: 'Montar em lote',
        ajuda: 'Deixa a pessoa montar vários cards juntos e concluir o lote de uma vez.',
      },
    ],
  },
]

type Rascunho = Record<ChaveRegra, string | boolean>

function paraRascunho(s: RegrasSetor): Rascunho {
  const r = {} as Rascunho
  for (const n of Object.values(NUMEROS)) {
    const v = s[n.chave]
    r[n.chave] =
      v === null || v === undefined
        ? ''
        : n.emHoras
          ? String(Math.round(((v as number) / 60) * 100) / 100)
          : String(v)
  }
  for (const k of [
    'pausar_fim_expediente',
    'retrabalho_fora',
    'admin_fora',
    'avisar_pulo',
    'permite_lote',
  ] as ChaveLiga[])
    r[k] = s[k]
  return r
}

/** O valor que vai para o banco (ou um erro de preenchimento). */
function valorDoCampo(n: RegraNumero, texto: string): { valor: number | null } | { erro: string } {
  const limpo = texto.trim().replace(',', '.')
  if (limpo === '') return n.vazio ? { valor: null } : { erro: `Preencha "${n.rotulo}".` }
  const numero = Number(limpo)
  if (!Number.isFinite(numero)) return { erro: `"${n.rotulo}" precisa ser um número.` }
  if (!n.decimal && !Number.isInteger(numero))
    return { erro: `"${n.rotulo}" precisa ser um número inteiro.` }
  if (numero < n.min || numero > n.max) {
    const fmt = (x: number) =>
      n.emHoras ? `${Math.round(x * 60)} min` : String(x).replace('.', ',')
    return {
      erro: n.emHoras
        ? `"${n.rotulo}" vai de ${fmt(n.min)} a ${n.max} horas.`
        : `"${n.rotulo}" vai de ${fmt(n.min)} a ${fmt(n.max)}.`,
    }
  }
  return { valor: n.emHoras ? Math.round(numero * 60) : numero }
}

/**
 * Aba "Regras por setor" (SESSAO-42 · F2): o que entra na média de cada setor
 * de produção, o fim do expediente, os avisos e a montagem em lote — e a data
 * a partir da qual os dados são oficiais. Uma leitura (plt_fn_tempo_regras);
 * salvar manda só o que mudou.
 */
export function AbaRegras() {
  const consulta = useQuery({ queryKey: CHAVE_TEMPO.regras, queryFn: buscarRegras })
  const setores = consulta.data?.setores ?? []
  const [setorId, setSetorId] = useState<number | null>(null)
  const escolhido = setores.find((s) => s.setor_id === setorId) ?? setores[0] ?? null

  return (
    <div className="flex flex-col gap-5">
      <Explicacao>
        As regras que decidem quais passagens entram na média de cada setor e como o tempo se
        comporta no fim do expediente. Mudou uma regra de conta, os tempos são refeitos sozinhos; os
        avisos e a montagem em lote valem dali em diante.
      </Explicacao>

      <EstadoDaLeitura carregando={consulta.isPending} erro={consulta.error} />

      {consulta.data && (
        <DataOficial
          key={`oficial-${consulta.dataUpdatedAt}`}
          atual={consulta.data.config?.data_oficial ?? null}
        />
      )}

      {setores.length > 0 && escolhido && (
        <>
          <Selecao
            className="sm:max-w-sm"
            rotulo="Setor"
            valor={String(escolhido.setor_id)}
            opcoes={setores.map((s) => ({ valor: String(s.setor_id), rotulo: s.nome }))}
            aoMudar={(v) => setSetorId(Number(v))}
          />
          <EditorRegras key={`${escolhido.setor_id}-${consulta.dataUpdatedAt}`} setor={escolhido} />
        </>
      )}
    </div>
  )
}

function DataOficial({ atual }: { atual: string | null }) {
  const notificar = useNotificacao()
  const depoisDeSalvar = useDepoisDeSalvar()
  const [dia, setDia] = useState(atual?.slice(0, 10) ?? '')
  const [hoje] = useState(() => diaIso(new Date()))
  const salvar = useMutation({
    mutationFn: () => salvarDataOficial(dia),
    onSuccess: () => {
      notificar({ titulo: 'Data oficial salva', tom: 'perfeito' })
      void depoisDeSalvar(CHAVE_TEMPO.regras)
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para salvar a data',
        descricao: mensagemDoErro(erro),
        tom: 'danificado',
      }),
  })
  return (
    <section
      aria-label="Dados oficiais"
      className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-4 sm:flex-row sm:items-end sm:p-5"
    >
      <div className="sm:max-w-xs sm:flex-1">
        <Campo
          rotulo="Dados oficiais a partir de"
          type="date"
          min="2026-01-01"
          max={hoje}
          value={dia}
          onChange={(e) => setDia(e.target.value)}
          ajuda="Os números das telas de tempo contam a partir desse dia."
        />
      </div>
      <Botao
        icone={<Save />}
        disabled={!dia || dia === (atual?.slice(0, 10) ?? '')}
        carregando={salvar.isPending}
        onClick={() => salvar.mutate()}
        className="sm:mb-7"
      >
        Salvar a data
      </Botao>
    </section>
  )
}

function EditorRegras({ setor }: { setor: RegrasSetor }) {
  const notificar = useNotificacao()
  const depoisDeSalvar = useDepoisDeSalvar()
  const original = paraRascunho(setor)
  const [r, setR] = useState<Rascunho>(original)
  const idBase = useId()

  // o que mudou (já no formato do banco) e os erros de preenchimento
  const mudancas: Partial<Record<ChaveRegra, number | boolean | null>> = {}
  const erros: string[] = []
  for (const n of Object.values(NUMEROS)) {
    if (r[n.chave] === original[n.chave]) continue
    const v = valorDoCampo(n, r[n.chave] as string)
    if ('erro' in v) erros.push(v.erro)
    else if (v.valor !== setor[n.chave]) mudancas[n.chave] = v.valor
  }
  for (const k of Object.keys(r) as ChaveRegra[]) {
    if (typeof r[k] === 'boolean' && r[k] !== original[k]) mudancas[k] = r[k] as boolean
  }
  const quantas = Object.keys(mudancas).length

  const salvar = useMutation({
    mutationFn: () => salvarRegras(setor.setor_id, mudancas),
    onSuccess: () => {
      notificar({ titulo: `Regras de ${setor.nome} salvas`, tom: 'perfeito' })
      void depoisDeSalvar(CHAVE_TEMPO.regras)
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para salvar as regras',
        descricao: mensagemDoErro(erro),
        tom: 'danificado',
      }),
  })

  const campoNumero = (n: RegraNumero) => (
    <Campo
      rotulo={n.rotulo}
      ajuda={n.ajuda}
      inputMode={n.decimal ? 'decimal' : 'numeric'}
      value={r[n.chave] as string}
      onChange={(e) => setR({ ...r, [n.chave]: e.target.value })}
      className="sm:max-w-40"
    />
  )

  return (
    <section
      aria-label={`Regras de ${setor.nome}`}
      className="flex flex-col gap-5 rounded-dm-lg border border-borda bg-superficie p-4 sm:p-5"
    >
      {GRUPOS.map((g) => (
        <fieldset key={g.titulo} className="flex flex-col gap-4">
          <legend className="mb-2 text-base font-semibold text-texto">{g.titulo}</legend>
          {g.regras.map((regra) => {
            if (regra === 'longo')
              return (
                <div key="longo" className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-texto">Longa demais</p>
                  <p className="text-sm text-texto-suave">
                    A passagem que passa de{' '}
                    <strong className="text-texto">{String(r.fator_longo) || '…'} vezes</strong> a
                    mediana do modelo fica fora da média — desde que o modelo tenha pelo menos{' '}
                    <strong className="text-texto">{String(r.base_minima) || '…'} montagens</strong>{' '}
                    de base.
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-md">
                    {campoNumero(NUMEROS.fator_longo)}
                    {campoNumero(NUMEROS.base_minima)}
                  </div>
                </div>
              )
            if (regra.tipo === 'numero') return <div key={regra.chave}>{campoNumero(regra)}</div>
            const idAjuda = `${idBase}-${regra.chave}`
            return (
              <div key={regra.chave} className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-texto">{regra.rotulo}</p>
                  {regra.ajuda && (
                    <p id={idAjuda} className="text-sm text-texto-suave">
                      {regra.ajuda}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                  <span className="text-xs text-texto-suave" aria-hidden>
                    {r[regra.chave] ? 'Ligado' : 'Desligado'}
                  </span>
                  <Interruptor
                    ligado={r[regra.chave] as boolean}
                    rotulo={regra.rotulo}
                    aoMudar={(ligado) => setR({ ...r, [regra.chave]: ligado })}
                  />
                </div>
              </div>
            )
          })}
        </fieldset>
      ))}

      {erros.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-danificado-forte" role="alert">
          {erros.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-borda pt-4 sm:flex-row sm:justify-end">
        <Botao
          variante="fantasma"
          icone={<Undo2 />}
          disabled={quantas === 0 && erros.length === 0}
          onClick={() => setR(original)}
        >
          Desfazer
        </Botao>
        <Botao
          icone={<Save />}
          disabled={quantas === 0 || erros.length > 0}
          carregando={salvar.isPending}
          onClick={() => salvar.mutate()}
        >
          {quantas > 1 ? `Salvar as ${quantas} mudanças` : 'Salvar'}
        </Botao>
      </div>
    </section>
  )
}
