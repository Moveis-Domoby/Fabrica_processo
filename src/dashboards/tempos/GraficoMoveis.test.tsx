import { cloneElement, type ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { GraficoMoveis } from './GraficoMoveis'

/**
 * SESSAO-47 (Bloco C) — o tipo do gráfico é escolhido em "Configurar painel":
 * empilhadas por montador (o desenho de sempre), barras só com o total, ou uma
 * linha por montador. O navegador de teste não tem tamanho de tela — o gráfico
 * recebe um tamanho fixo no lugar do contêiner que mede a página.
 */
vi.mock('recharts', async (original) => {
  const real = await original<typeof import('recharts')>()
  return {
    ...real,
    ResponsiveContainer: ({ children }: { children: ReactElement<Record<string, unknown>> }) =>
      cloneElement(children, { width: 640, height: 320 }),
  }
})

const dados = [
  { rotulo: '08/11', total: 3, topo: 1e-6, a: 2, b: 1 },
  { rotulo: '09/11', total: 5, topo: 1e-6, a: 1, b: 4 },
]
const series = [
  { chave: 'a', cor: 'red' },
  { chave: 'b', cor: 'blue' },
]

function desenhar(tipo: 'empilhadas' | 'barras' | 'linhas') {
  return render(<GraficoMoveis tipo={tipo} dados={dados} series={series} dica={() => null} />)
}

describe('o gráfico de móveis por dia', () => {
  it('empilhadas: uma barra por montador em cada dia, e o total em cima', () => {
    const { container } = desenhar('empilhadas')
    // as duas séries + a barra invisível que segura o total em cima da pilha
    expect(container.querySelectorAll('.recharts-bar')).toHaveLength(3)
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(0)
    expect(container.textContent).toContain('3')
    expect(container.textContent).toContain('5')
  })

  it('barras: uma barra só por dia, com o total', () => {
    const { container } = desenhar('barras')
    expect(container.querySelectorAll('.recharts-bar')).toHaveLength(1)
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(0)
    expect(container.textContent).toContain('5')
  })

  it('linhas: uma linha por montador, nenhuma barra', () => {
    const { container } = desenhar('linhas')
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(2)
    expect(container.querySelectorAll('.recharts-bar')).toHaveLength(0)
  })
})
