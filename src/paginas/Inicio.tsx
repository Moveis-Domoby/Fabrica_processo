import { Link } from 'react-router'
import { ArrowRight, Palette } from 'lucide-react'
import { Botao } from '@/componentes/ui'

export function Inicio() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl">Plataforma de Produção</h1>
        <p className="max-w-2xl text-texto-suave">
          Esta é a <strong className="text-texto">fundação</strong> do repositório, entregue na
          SESSAO-01: nenhuma tela de negócio ainda — só a base de estilização que todas as sessões
          seguintes vão seguir.
        </p>
      </div>

      <div className="rounded-dm-lg border border-borda bg-superficie p-5">
        <h2 className="text-lg">O que já existe</h2>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-texto-suave">
          <li>Tokens da marca Domoby (amarelo sobre grafite) e dos 3 estados de qualidade</li>
          <li>Componentes base: botão, campo, seleção, modal, notificação, selo de estado</li>
          <li>Tabela com paginação embutida por padrão</li>
          <li>
            Documento de estilização em <code className="text-texto">docs/design-system.md</code>
          </li>
        </ul>
        <div className="mt-5">
          <Link to="/design">
            <Botao icone={<Palette />}>
              Ver o design system
              <ArrowRight aria-hidden className="size-[1.15em]" />
            </Botao>
          </Link>
        </div>
      </div>
    </div>
  )
}
