import { Link } from 'react-router'
import { ArrowRight, Palette, TabletSmartphone, UsersRound } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { ROTULO_PAPEL } from '@/autenticacao/tipos'

/** A casa de cada papel (RF-24): operador vê o mínimo; líder e admin veem mais. */
export function Inicio() {
  const { perfil, vinculos, ehLider } = useSessao()
  if (!perfil) return null // a guarda já cuidou; isto só acalma o TypeScript

  const nomeCurto = perfil.nome.split(' ')[0]
  const meusSetores = vinculos.map((v) => v.setor.nome).join(' · ')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl">Olá, {nomeCurto}!</h1>
        <p className="text-texto-suave">
          {ROTULO_PAPEL[perfil.papel]} · matrícula{' '}
          <span className="tabular-nums">{perfil.matricula}</span>
          {meusSetores && <> · {meusSetores}</>}
        </p>
      </div>

      <div className="rounded-dm-lg border border-borda bg-superficie p-5">
        <h2 className="text-lg">Sua fila de trabalho</h2>
        <p className="mt-2 text-texto-suave">
          O kanban dos setores chega na próxima sessão (SESSAO-04). Aqui vai aparecer a fila do
          seu setor, com os cards e os botões de iniciar e finalizar.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/tablet">
          <Botao variante="secundaria" icone={<TabletSmartphone />}>
            Modo tablet (PIN)
          </Botao>
        </Link>
        {ehLider && (
          <Link to="/equipe">
            <Botao variante="secundaria" icone={<UsersRound />}>
              Equipe
            </Botao>
          </Link>
        )}
        {perfil.papel === 'admin' && (
          <Link to="/design">
            <Botao variante="fantasma" icone={<Palette />}>
              Design system
              <ArrowRight aria-hidden className="size-[1.15em]" />
            </Botao>
          </Link>
        )}
      </div>
    </div>
  )
}
