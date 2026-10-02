import { Campo, Selecao } from '@/componentes/ui'
import type { CampoCustomizado, ValorCampo } from './tipos'

/**
 * O campo de digitar/escolher o VALOR de um campo customizado, no tipo dele
 * (SESSAO-27 · D-101): texto, número, data, lista de opções ou sim/não. Usado
 * no painel das automações e na edição à mão do admin no card/pedido.
 */
export function EntradaValorCampo({
  campo,
  valor,
  aoMudar,
  rotulo = 'Valor',
}: {
  campo: CampoCustomizado
  valor: unknown
  aoMudar: (valor: ValorCampo | null) => void
  rotulo?: string
}) {
  if (campo.tipo === 'lista')
    return (
      <Selecao
        rotulo={rotulo}
        valor={valor ? String(valor) : undefined}
        aoMudar={(v) => aoMudar(v)}
        opcoes={campo.opcoes.map((o) => ({ valor: o, rotulo: o }))}
        placeholder="Escolha a opção"
      />
    )
  if (campo.tipo === 'sim_nao')
    return (
      <Selecao
        rotulo={rotulo}
        valor={valor === true || valor === 'true' ? 'sim' : valor === false || valor === 'false' ? 'nao' : undefined}
        aoMudar={(v) => aoMudar(v === 'sim')}
        opcoes={[
          { valor: 'sim', rotulo: 'Sim' },
          { valor: 'nao', rotulo: 'Não' },
        ]}
        placeholder="Sim ou não"
      />
    )
  return (
    <Campo
      rotulo={rotulo}
      type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'data' ? 'date' : 'text'}
      value={valor === null || valor === undefined ? '' : String(valor)}
      maxLength={campo.tipo === 'texto' ? 500 : undefined}
      onChange={(e) => {
        const v = e.target.value
        if (v === '') return aoMudar(null)
        aoMudar(campo.tipo === 'numero' ? Number(v) : v)
      }}
    />
  )
}
