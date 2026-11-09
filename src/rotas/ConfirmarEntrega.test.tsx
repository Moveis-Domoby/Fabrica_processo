import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { hojeNaFabrica, somarDias } from '@/dashboards/tempos/formato'
import { ConfirmarEntrega } from './ConfirmarEntrega'
import { diaPorExtenso } from './diaDaEntrega'
import { fraseEntregaIncompleta } from './estadoPedido'

/**
 * SESSAO-47 (pedido do dono): depois de tocar em "Entregue" aparecem os três
 * botões — "Confirmar entrega", "Ainda não" e "Marcar como entregue no dia...".
 * O dia nunca passa de hoje (no fuso da fábrica) nem fica antes de o pedido
 * chegar à plataforma; com peças em produção, o aviso fica e os dois botões de
 * confirmar valem como a confirmação explícita.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const HOJE = hojeNaFabrica()
const ONTEM = somarDias(HOJE, -1)
const AMANHA = somarDias(HOJE, 1)

function desenhar(extra: Partial<Parameters<typeof ConfirmarEntrega>[0]> = {}) {
  const aoConfirmar = vi.fn()
  const aoCancelar = vi.fn()
  render(
    <ConfirmarEntrega
      numero={13818}
      pergunta="Confirmar a entrega do pedido inteiro?"
      carregando={false}
      aoConfirmar={aoConfirmar}
      aoCancelar={aoCancelar}
      {...extra}
    />,
  )
  return { aoConfirmar, aoCancelar }
}

describe('ConfirmarEntrega — os três botões depois do "Entregue"', () => {
  it('mostra "Confirmar entrega", "Ainda não" e "Marcar como entregue no dia..." — com estes textos', () => {
    desenhar()
    expect(screen.getByRole('button', { name: 'Confirmar entrega' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ainda não' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Marcar como entregue no dia...' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Confirmar a entrega do pedido inteiro?')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('"Confirmar entrega" entrega com a data de hoje (sem dia); "Ainda não" fecha sem registrar', async () => {
    const { aoConfirmar, aoCancelar } = desenhar()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    expect(aoConfirmar).toHaveBeenCalledWith(null)
    await userEvent.click(screen.getByRole('button', { name: 'Ainda não' }))
    expect(aoCancelar).toHaveBeenCalledTimes(1)
    expect(aoConfirmar).toHaveBeenCalledTimes(1)
  })

  it('"Marcar como entregue no dia..." abre a escolha do dia (até hoje) e confirma já com o dia', async () => {
    const { aoConfirmar } = desenhar()
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como entregue no dia...' }))
    const campo = screen.getByLabelText('Em que dia foi entregue?')
    expect(campo).toHaveAttribute('type', 'date')
    expect(campo).toHaveAttribute('max', HOJE)
    expect(campo).not.toHaveAttribute('min')
    // sem dia escolhido, nada a confirmar
    expect(screen.getByRole('button', { name: 'Escolha o dia da entrega' })).toBeDisabled()
    fireEvent.change(campo, { target: { value: ONTEM } })
    await userEvent.click(
      screen.getByRole('button', { name: `Marcar como entregue em ${diaPorExtenso(ONTEM)}` }),
    )
    expect(aoConfirmar).toHaveBeenCalledWith(ONTEM)
    expect(aoConfirmar).toHaveBeenCalledTimes(1)
  })

  it('o dia de amanhã é recusado na tela: o botão não confirma e a tela diz o porquê', async () => {
    const { aoConfirmar } = desenhar()
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como entregue no dia...' }))
    fireEvent.change(screen.getByLabelText('Em que dia foi entregue?'), {
      target: { value: AMANHA },
    })
    expect(screen.getByText(/Esse dia ainda não chegou/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Escolha o dia da entrega' })).toBeDisabled()
    expect(aoConfirmar).not.toHaveBeenCalled()
  })

  it('quando a tela sabe quando o pedido chegou, o dia não pode ser anterior à chegada', async () => {
    const chegou = somarDias(HOJE, -2)
    desenhar({ chegouEm: `${chegou}T15:00:00-03:00` })
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como entregue no dia...' }))
    const campo = screen.getByLabelText('Em que dia foi entregue?')
    expect(campo).toHaveAttribute('min', chegou)
    fireEvent.change(campo, { target: { value: somarDias(HOJE, -3) } })
    expect(screen.getByText(/O pedido chegou à plataforma em/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Escolha o dia da entrega' })).toBeDisabled()
    fireEvent.change(campo, { target: { value: chegou } })
    expect(
      screen.getByRole('button', { name: `Marcar como entregue em ${diaPorExtenso(chegou)}` }),
    ).toBeEnabled()
  })

  it('com peças ainda em produção o aviso aparece e os dois botões de confirmar continuam valendo', async () => {
    const aviso = fraseEntregaIncompleta(0, 1)
    const { aoConfirmar } = desenhar({ aviso })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Este pedido ainda aparece em produção na fábrica (0 de 1 peça pronta). Confirmar a entrega encerra tudo dele.',
    )
    // o aviso toma o lugar da pergunta de sempre
    expect(screen.queryByText('Confirmar a entrega do pedido inteiro?')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    expect(aoConfirmar).toHaveBeenLastCalledWith(null)
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como entregue no dia...' }))
    // o aviso segue na tela enquanto a pessoa escolhe o dia
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Em que dia foi entregue?'), {
      target: { value: ONTEM },
    })
    await userEvent.click(
      screen.getByRole('button', { name: `Marcar como entregue em ${diaPorExtenso(ONTEM)}` }),
    )
    expect(aoConfirmar).toHaveBeenLastCalledWith(ONTEM)
  })

  it('enquanto a entrega está sendo registrada, nenhum botão aceita outro toque', () => {
    desenhar({ carregando: true })
    expect(screen.getByRole('button', { name: 'Confirmar entrega' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Marcar como entregue no dia...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ainda não' })).toBeDisabled()
  })
})
