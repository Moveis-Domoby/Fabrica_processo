import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TipoGrafico } from './painel'

export interface SerieDoGrafico {
  /** A chave do valor em cada ponto. */
  chave: string
  cor: string
}

/** Um dia (ou semana): o rótulo do eixo, o total e quanto cada série fez. */
export type PontoDoGrafico = { rotulo: string; total: number } & Record<string, number | string>

interface Tamanhos {
  /** Letra do eixo de baixo, do eixo do lado e do total em cima da barra. */
  eixoX: number
  eixoY: number
  total: number
  /** Folga de cima (o total em cima da barra) e recuo da esquerda. */
  topo: number
  esquerda: number
  /** O canto de cima da pilha arredondado (a tela; a TV sempre foi reta). */
  arredondar: boolean
}
const TAMANHO_DA_TELA: Tamanhos = {
  eixoX: 11,
  eixoY: 11,
  total: 11,
  topo: 18,
  esquerda: -12,
  arredondar: true,
}
/** A TV é lida de longe. */
const TAMANHO_DA_TV: Tamanhos = {
  eixoX: 16,
  eixoY: 14,
  total: 18,
  topo: 28,
  esquerda: -8,
  arredondar: false,
}

const COR_DO_TOTAL = 'var(--dm-serie-1)'

/**
 * SESSAO-47 (Bloco C) — o gráfico "móveis por dia" da aba Período e da TV, num
 * desenho só, no tipo que o administrador escolheu em "Configurar painel":
 *  · empilhadas — uma barra por dia, empilhada por montador, com o total em cima
 *    (o desenho de sempre — o padrão);
 *  · barras — uma barra por dia só com o total;
 *  · linhas — uma linha por montador.
 * Sem animação (a TV relê a cada móvel que sai; e a foto sem janela não anima) e
 * sempre com o total à vista (em cima da barra; nas linhas, na dica do ponto).
 */
export function GraficoMoveis<P extends PontoDoGrafico>({
  tipo,
  dados,
  series,
  dica,
  deLonge = false,
}: {
  tipo: TipoGrafico
  dados: P[]
  series: SerieDoGrafico[]
  /** O que a dica mostra ao passar o mouse (ou tocar) num dia. */
  dica: (ponto: P) => ReactNode
  /** A TV: letras maiores, lidas de longe. */
  deLonge?: boolean
}) {
  const tamanhos = deLonge ? TAMANHO_DA_TV : TAMANHO_DA_TELA
  const margem = { top: tamanhos.topo, right: 8, left: tamanhos.esquerda, bottom: 0 }
  const eixos = (
    <>
      <CartesianGrid stroke="var(--dm-borda)" strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey="rotulo"
        tick={{ fontSize: tamanhos.eixoX, fill: 'var(--dm-texto-suave)' }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        allowDecimals={false}
        tick={{ fontSize: tamanhos.eixoY, fill: 'var(--dm-texto-suave)' }}
        axisLine={false}
        tickLine={false}
      />
    </>
  )
  const conteudoDaDica = ({
    active,
    payload,
  }: {
    active?: boolean
    payload?: readonly { payload?: unknown }[]
  }) => {
    const ponto = payload?.[0]?.payload as P | undefined
    if (!active || !ponto) return null
    return dica(ponto)
  }
  const total = (
    <LabelList
      dataKey="total"
      position="top"
      formatter={(v: unknown) => (Number(v) > 0 ? String(v) : '')}
      style={{ fill: 'var(--dm-texto)', fontSize: tamanhos.total, fontWeight: 700 }}
    />
  )

  if (tipo === 'linhas') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={margem}>
          {eixos}
          <Tooltip cursor={{ stroke: 'var(--dm-borda-forte)' }} content={conteudoDaDica} />
          {series.map((s) => (
            <Line
              key={s.chave}
              dataKey={s.chave}
              type="linear"
              isAnimationActive={false}
              stroke={s.cor}
              strokeWidth={2.5}
              dot={{ r: 3, fill: s.cor, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={dados} margin={margem}>
        {eixos}
        <Tooltip cursor={{ fill: 'var(--dm-superficie-sutil)' }} content={conteudoDaDica} />
        {tipo === 'barras' ? (
          <Bar dataKey="total" isAnimationActive={false} fill={COR_DO_TOTAL} radius={[4, 4, 0, 0]}>
            {total}
          </Bar>
        ) : (
          <>
            {series.map((s, i) => (
              <Bar
                key={s.chave}
                dataKey={s.chave}
                stackId="m"
                isAnimationActive={false}
                fill={s.cor}
                stroke="var(--dm-superficie)"
                strokeWidth={1}
                radius={tamanhos.arredondar && i === series.length - 1 ? [4, 4, 0, 0] : undefined}
              />
            ))}
            {/* o total em cima de TODA barra: uma barra invisível de altura ínfima no topo da pilha (a de altura zero não ganha rótulo) */}
            <Bar
              dataKey="topo"
              stackId="m"
              fill="transparent"
              legendType="none"
              isAnimationActive={false}
            >
              {total}
            </Bar>
          </>
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}
