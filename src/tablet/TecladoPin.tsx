import { Delete } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import { cn } from '@/lib/cn'

export interface TecladoPinProps {
  pin: string
  aoMudar: (pin: string) => void
  aoConfirmar: (pin: string) => void
  conferindo?: boolean
  desabilitado?: boolean
}

/**
 * SESSAO-36: o teclado de PIN na tela — pontos + dígitos + OK, sem teclado do
 * sistema (D-06: o ciclo inteiro só com toques). Reaproveitado pela tela de
 * entrada do tablet (PIN do setor) e pelo "quem é você?" das ações (PIN da
 * pessoa).
 */
export function TecladoPin({ pin, aoMudar, aoConfirmar, conferindo, desabilitado }: TecladoPinProps) {
  function digito(d: string) {
    if (pin.length >= 6) return
    aoMudar(pin + d)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div aria-label={`PIN: ${pin.length} dígito(s)`} className="flex h-6 items-center gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn('size-3 rounded-full border border-borda-forte', i < pin.length && 'bg-texto')}
          />
        ))}
      </div>

      <div className="grid w-full max-w-xs grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Botao key={d} variante="secundaria" tamanho="lg" onClick={() => digito(d)} aria-label={`Dígito ${d}`}>
            {d}
          </Botao>
        ))}
        <Botao
          variante="fantasma"
          tamanho="lg"
          icone={<Delete />}
          aria-label="Apagar dígito"
          onClick={() => aoMudar(pin.slice(0, -1))}
        />
        <Botao variante="secundaria" tamanho="lg" onClick={() => digito('0')} aria-label="Dígito 0">
          0
        </Botao>
        <Botao
          tamanho="lg"
          carregando={conferindo}
          disabled={pin.length < 4 || desabilitado}
          onClick={() => aoConfirmar(pin)}
        >
          OK
        </Botao>
      </div>
    </div>
  )
}
