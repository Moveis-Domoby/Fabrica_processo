import { divIcon } from 'leaflet'

/**
 * SESSAO-41 (D-196): os desenhos da PARADA AVULSA no mapa — HTML desenhado
 * pelo próprio Leaflet (divIcon), nada de imagem externa. Só número e cor
 * entram no HTML (nunca o texto que a pessoa escreveu).
 */

const TAMANHO = 28

/**
 * O marcador da parada avulsa: um QUADRADO (o pedido é círculo) na cor da
 * marca, com o contorno da rota e "A" + o número da parada na rota. Apagado =
 * a parada já marcada (feita ou não feita).
 */
export function iconeParadaAvulsa(numero: number | null, cor: string, apagada = false) {
  const texto = numero === null ? 'A' : `A${Math.trunc(numero)}`
  const fundo = apagada ? '#E5E7EB' : '#F1C24B'
  const letra = apagada ? '#6B7280' : '#1F1E21'
  const contorno = /^#[0-9a-f]{3,8}$/i.test(cor) ? cor : '#1F1E21'
  return divIcon({
    className: '',
    iconSize: [TAMANHO, TAMANHO],
    iconAnchor: [TAMANHO / 2, TAMANHO / 2],
    popupAnchor: [0, -TAMANHO / 2],
    html: `<div style="width:${TAMANHO}px;height:${TAMANHO}px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border-radius:6px;border:3px solid ${contorno};background:${fundo};color:${letra};font:700 11px/1 system-ui,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.35)">${texto}</div>`,
  })
}

/** O pino arrastável da janela da parada (para acertar o lugar exato). */
export function iconePino() {
  return divIcon({
    className: '',
    // a ponta do pino (o canto reto girado) fica a ~31 px do topo, no meio
    iconSize: [32, 36],
    iconAnchor: [16, 31],
    html: '<div style="position:relative;width:32px;height:36px"><div style="position:absolute;left:3px;top:0;width:26px;height:26px;box-sizing:border-box;border-radius:50% 50% 50% 0;transform:rotate(-45deg);transform-origin:center;background:#F1C24B;border:3px solid #1F1E21;box-shadow:0 2px 4px rgba(0,0,0,.4)"></div><div style="position:absolute;left:12px;top:9px;width:8px;height:8px;border-radius:50%;background:#1F1E21"></div></div>',
  })
}
