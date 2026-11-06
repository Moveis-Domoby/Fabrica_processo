import { createContext } from 'react'

/**
 * A vaga do título na barra escura do topo (celular e tablet em pé) — ajuste
 * do dono de 06/11 (3ª volta): *"coloque o nome do setor, o botão de voltar e o
 * ícone informativo para o header principal"*. A casca (`Layout`) guarda o
 * elemento da vaga; o `CabecalhoDaTela` leva para lá a setinha, o nome e o
 * **?** quando a tela é estreita. `null` = sem vaga (computador, tablet do
 * setor, telas fora da casca): o título fica na página.
 */
export const VagaDoTitulo = createContext<HTMLElement | null>(null)
