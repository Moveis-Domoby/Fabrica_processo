import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Package, TabletSmartphone, UsersRound } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { ROTULO_PAPEL } from '@/autenticacao/tipos'
import { buscarSetores } from '@/kanban/api'

/** A casa de cada papel (RF-24): operador vê o mínimo; líder e admin veem mais. */
export function Inicio() {
  const { perfil, vinculos, ehLider } = useSessao()
  const souAdmin = perfil?.papel === 'admin'

  const { data: setores = [] } = useQuery({ queryKey: ['setores'], queryFn: () => buscarSetores() })

  if (!perfil) return null // a guarda já cuidou; isto só acalma o TypeScript

  const nomeCurto = perfil.nome.split(' ')[0]
  const meusSetores = vinculos.map((v) => v.setor.nome).join(' · ')

  // Quadros que esta pessoa abre: os setores dela (admin vê todos — RF-24).
  const idsVinculados = new Set(vinculos.map((v) => v.setor_id))
  const quadros = setores.filter((s) => (souAdmin ? true : idsVinculados.has(s.id)))
  const ehDoPcp = vinculos.some((v) => v.setor.codigo === 'pcp')
  const veExpedicao =
    souAdmin || vinculos.some((v) => ['pcp', 'estoque', 'rotas'].includes(v.setor.codigo))

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

      <section aria-label="Quadros de produção" className="flex flex-col gap-3">
        <h2 className="text-lg">Quadros</h2>
        {quadros.length === 0 && !veExpedicao && (
          <p className="rounded-dm-lg border border-borda bg-superficie p-5 text-texto-suave">
            Você ainda não está em nenhum setor — fale com a liderança para ser vinculado.
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quadros.map((setor) => {
            const ehPcp = setor.codigo === 'pcp'
            if (ehPcp && !souAdmin && !ehDoPcp) return null
            return (
              <Link
                key={setor.id}
                to={ehPcp ? '/pcp' : `/setores/${setor.id}`}
                className="flex min-h-toque-galpao items-center gap-3 rounded-dm-lg border border-borda bg-superficie p-4 font-marca text-lg font-semibold text-texto transition-colors hover:border-acao-ativa hover:bg-superficie-sutil"
              >
                <ClipboardList aria-hidden className="size-6 shrink-0 text-texto-suave" />
                {setor.nome}
                {setor.papel_no_fluxo === 'terminal' && (
                  <span className="ml-auto text-xs font-sans font-medium text-texto-fraco">
                    fim de linha
                  </span>
                )}
              </Link>
            )
          })}
          {veExpedicao && (
            <Link
              to="/expedicao"
              className="flex min-h-toque-galpao items-center gap-3 rounded-dm-lg border border-borda bg-superficie p-4 font-marca text-lg font-semibold text-texto transition-colors hover:border-acao-ativa hover:bg-superficie-sutil"
            >
              <Package aria-hidden className="size-6 shrink-0 text-texto-suave" />
              Expedição
              <span className="ml-auto text-xs font-sans font-medium text-texto-fraco">
                pedido completo
              </span>
            </Link>
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link to="/tablet">
          <Botao variante="secundaria" icone={<TabletSmartphone />}>
            Tela do setor
          </Botao>
        </Link>
        {ehLider && (
          <Link to="/equipe">
            <Botao variante="secundaria" icone={<UsersRound />}>
              Equipe
            </Botao>
          </Link>
        )}
      </div>
    </div>
  )
}
