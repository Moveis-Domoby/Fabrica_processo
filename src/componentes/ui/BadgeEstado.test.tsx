import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BadgeEstado } from './BadgeEstado'
import { DESCRICAO_ESTADO } from './estados'

describe('BadgeEstado', () => {
  it('sempre acompanha o estado de um texto (nunca só cor)', () => {
    render(<BadgeEstado estado="atencao" />)
    expect(screen.getByText('Estado de atenção')).toBeInTheDocument()
  })

  it('mantém o texto do dono para o estado de atenção (D-09 / Q-16)', () => {
    expect(DESCRICAO_ESTADO.atencao).toBe(
      'Levemente danificado, porém ainda dá pra seguir e tentar consertar.',
    )
  })
})
