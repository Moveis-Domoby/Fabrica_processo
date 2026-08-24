import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tabela, type ColunaTabela } from './Tabela'

interface Linha {
  id: number
  nome: string
}

const dados: Linha[] = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, nome: `Item ${i + 1}` }))
const colunas: ColunaTabela<Linha>[] = [{ chave: 'nome', cabecalho: 'Nome', celula: (l) => l.nome }]

function montar(porPagina = 10) {
  return render(
    <Tabela
      legenda="Tabela de teste"
      colunas={colunas}
      dados={dados}
      chaveDe={(l) => l.id}
      porPagina={porPagina}
    />,
  )
}

describe('Tabela', () => {
  it('mostra só a primeira página e informa o intervalo', () => {
    montar()
    expect(screen.getAllByText('Item 1').length).toBeGreaterThan(0)
    expect(screen.queryByText('Item 11')).not.toBeInTheDocument()
    expect(screen.getByText(/Mostrando/i)).toHaveTextContent('Mostrando 1–10 de 25')
  })

  it('avança e volta de página', async () => {
    const usuario = userEvent.setup()
    montar()

    await usuario.click(screen.getByRole('button', { name: /próxima/i }))
    expect(screen.getAllByText('Item 11').length).toBeGreaterThan(0)
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: /anterior/i }))
    expect(screen.getAllByText('Item 1').length).toBeGreaterThan(0)
  })

  it('desabilita Anterior na primeira página e Próxima na última', async () => {
    const usuario = userEvent.setup()
    montar(20)
    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled()

    await usuario.click(screen.getByRole('button', { name: /próxima/i }))
    expect(screen.getByRole('button', { name: /próxima/i })).toBeDisabled()
    expect(screen.getByText(/Mostrando/i)).toHaveTextContent('Mostrando 21–25 de 25')
  })

  it('mostra o estado vazio sem paginação', () => {
    render(
      <Tabela
        legenda="Vazia"
        colunas={colunas}
        dados={[]}
        chaveDe={(l) => l.id}
        vazio="Nada por aqui ainda."
      />,
    )
    expect(screen.getByText('Nada por aqui ainda.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /próxima/i })).not.toBeInTheDocument()
  })
})
