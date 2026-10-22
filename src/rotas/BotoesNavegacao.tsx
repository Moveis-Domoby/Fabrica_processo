import { useMemo } from 'react'
import { Navigation, Route } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import type { TamanhoBotao, VarianteBotao } from '@/componentes/ui/Botao'
import {
  linkGoogleMapsParada,
  linkWaze,
  linksGoogleMaps,
  paradaNavegavel,
  rotuloDaParte,
} from './navegacao'

type ComEndereco = Parameters<typeof paradaNavegavel>[0]

/**
 * SESSAO-39 (D-174): "Abrir a rota no Google Maps" — a rota que a plataforma
 * montou, na MESMA ordem, num link oficial (sem chave, sem custo). Rota com
 * mais de 9 paradas sai em partes ("Paradas 1 a 6", "Paradas 7 a 10 e a
 * volta"), cada uma começando onde a anterior terminou.
 */
export function BotaoRotaGoogleMaps({
  paradas,
  origem = 'fabrica',
  posicoes,
  tamanho = 'md',
  variante = 'secundaria',
}: {
  /** As paradas NA ORDEM da tela. */
  paradas: ComEndereco[]
  /** 'fabrica' (a rota inteira) ou 'aqui' (de onde o aparelho está — o entregador). */
  origem?: 'fabrica' | 'aqui'
  /** Os números das paradas como a tela mostra (padrão: 1, 2, 3…). */
  posicoes?: number[]
  tamanho?: TamanhoBotao
  variante?: VarianteBotao
}) {
  const partes = useMemo(
    () => linksGoogleMaps(paradas.map(paradaNavegavel), { origem, posicoes }),
    [paradas, origem, posicoes],
  )
  if (partes.length === 0) return null
  return (
    <>
      {partes.map((p) => (
        <a key={p.url} href={p.url} target="_blank" rel="noreferrer" className="contents">
          <Botao variante={variante} tamanho={tamanho} icone={<Route />}>
            {partes.length > 1
              ? `Google Maps · ${rotuloDaParte(p, partes.length)}`
              : rotuloDaParte(p, 1)}
          </Botao>
        </a>
      ))}
    </>
  )
}

/** Uma parada: o Google Maps e o Waze já navegando até ela (de onde o aparelho está). */
export function BotoesParada({ parada }: { parada: ComEndereco }) {
  const p = paradaNavegavel(parada)
  const google = linkGoogleMapsParada(p)
  const waze = linkWaze(p)
  return (
    <>
      {google && (
        <a href={google} target="_blank" rel="noreferrer" className="contents">
          <Botao variante="secundaria" icone={<Navigation />} className="w-full">
            Google Maps
          </Botao>
        </a>
      )}
      {waze && (
        <a href={waze} target="_blank" rel="noreferrer" className="contents">
          <Botao variante="secundaria" icone={<Navigation />} className="w-full">
            Waze
          </Botao>
        </a>
      )}
    </>
  )
}
