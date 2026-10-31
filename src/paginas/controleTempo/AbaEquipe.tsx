import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Selecao, Botao, AvatarPessoa, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { buscarSetores } from '@/kanban/api'
import {
  buscarEquipe,
  CHAVE_TEMPO,
  mensagemDoErro,
  salvarEquipe,
  useDepoisDeSalvar,
  type PapelPainel,
  type PessoaPainel,
} from './api'
import { EstadoDaLeitura, Explicacao } from './comum'

const OPCOES_PAPEL: { valor: PapelPainel | null; rotulo: string }[] = [
  { valor: 'titular', rotulo: 'Titular' },
  { valor: 'apoio', rotulo: 'Apoio' },
  { valor: null, rotulo: 'Fora do painel' },
]

/**
 * Aba "Equipe no painel" (SESSAO-42 · F2): quem aparece no painel de tempos
 * de cada setor de produção — titular ou apoio — e a letra que a TV mostra
 * (única no setor). Os setores vêm do cache da abertura; uma leitura por
 * setor escolhido (plt_fn_tempo_equipe).
 */
export function AbaEquipe() {
  const { data: todos = [] } = useQuery({ queryKey: ['setores'], queryFn: () => buscarSetores() })
  const deProducao = todos.filter((s) => s.papel_no_fluxo === 'producao')
  const [setorId, setSetorId] = useState<number | null>(null)
  const escolhido = setorId ?? deProducao[0]?.id ?? null

  const consulta = useQuery({
    queryKey: CHAVE_TEMPO.equipe(escolhido ?? 0),
    queryFn: () => buscarEquipe(escolhido!),
    enabled: escolhido !== null,
  })
  const pessoas = consulta.data?.pessoas ?? []
  const setores = consulta.data?.setores.length ? consulta.data.setores : deProducao

  return (
    <div className="flex flex-col gap-5">
      <Explicacao>
        Quem aparece no painel de tempos de cada setor (a TV do galpão). Titular é quem é do setor;
        apoio é quem ajuda de vez em quando. A letra é como a pessoa aparece na TV — uma por pessoa
        em cada setor.
      </Explicacao>

      {setores.length > 0 && escolhido !== null && (
        <Selecao
          className="sm:max-w-sm"
          rotulo="Setor"
          valor={String(escolhido)}
          opcoes={setores.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
          aoMudar={(v) => setSetorId(Number(v))}
        />
      )}

      <EstadoDaLeitura
        carregando={consulta.isPending && escolhido !== null}
        erro={consulta.error}
      />

      {consulta.isSuccess && pessoas.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Ninguém para mostrar neste setor.
        </p>
      )}

      {pessoas.length > 0 && escolhido !== null && (
        <ul className="flex flex-col divide-y divide-borda rounded-dm-lg border border-borda bg-superficie">
          {pessoas.map((p) => (
            <LinhaPessoa
              key={`${p.usuario_id}-${p.papel}-${p.letra}`}
              setorId={escolhido}
              pessoa={p}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function LinhaPessoa({ setorId, pessoa }: { setorId: number; pessoa: PessoaPainel }) {
  const notificar = useNotificacao()
  const depoisDeSalvar = useDepoisDeSalvar()
  const [letra, setLetra] = useState(pessoa.letra ?? '')

  const salvar = useMutation({
    mutationFn: (v: { papel: PapelPainel | null; letra: string | null }) =>
      salvarEquipe(setorId, pessoa.usuario_id, v.papel, v.letra),
    onSuccess: (resposta) => {
      notificar({
        titulo:
          resposta.papel === null
            ? `${pessoa.nome} saiu do painel`
            : `${pessoa.nome}: ${resposta.papel === 'titular' ? 'titular' : 'apoio'}, letra ${resposta.letra}`,
        tom: 'perfeito',
      })
      void depoisDeSalvar(CHAVE_TEMPO.equipe(setorId))
    },
    onError: (erro) => {
      setLetra(pessoa.letra ?? '')
      notificar({
        titulo: 'Não deu para mudar o painel',
        descricao: mensagemDoErro(erro),
        tom: 'danificado',
      })
    },
  })

  const letraLimpa = letra.trim().toUpperCase()
  const letraMudou = pessoa.papel !== null && letraLimpa !== (pessoa.letra ?? '')
  const letraValida = /^[A-Z]{1,2}$/.test(letraLimpa)

  return (
    <li className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <AvatarPessoa nome={pessoa.nome} foto={pessoa.foto} tamanho="sm" />
        <div className="min-w-0">
          <p className="truncate font-medium text-texto">{pessoa.nome}</p>
          {!pessoa.do_setor && <p className="text-xs text-texto-suave">Não é do setor</p>}
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label={`Lugar de ${pessoa.nome} no painel`}
        className="flex flex-wrap gap-1"
      >
        {OPCOES_PAPEL.map((o) => {
          const ativo = pessoa.papel === o.valor
          return (
            <button
              key={o.rotulo}
              type="button"
              role="radio"
              aria-checked={ativo}
              disabled={salvar.isPending}
              onClick={() => !ativo && salvar.mutate({ papel: o.valor, letra: null })}
              className={cn(
                'min-h-toque-md rounded-dm border px-3 text-sm transition-colors disabled:opacity-60',
                ativo
                  ? 'border-acao-ativa bg-acao font-semibold text-acao-texto'
                  : 'border-borda-forte bg-superficie text-texto-suave hover:bg-superficie-sutil',
              )}
            >
              {o.rotulo}
            </button>
          )
        })}
      </div>

      {pessoa.papel !== null && (
        <div className="flex items-center gap-2">
          <label htmlFor={`letra-${pessoa.usuario_id}`} className="text-sm text-texto-suave">
            Letra na TV
          </label>
          <input
            id={`letra-${pessoa.usuario_id}`}
            value={letra}
            maxLength={2}
            autoCapitalize="characters"
            onChange={(e) => setLetra(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            className="h-toque-md w-16 rounded-dm border border-borda-forte bg-superficie px-2 text-center text-lg font-semibold text-texto uppercase"
          />
          {letraMudou && (
            <Botao
              variante="secundaria"
              disabled={!letraValida}
              carregando={salvar.isPending}
              onClick={() => salvar.mutate({ papel: pessoa.papel, letra: letraLimpa })}
            >
              Salvar letra
            </Botao>
          )}
        </div>
      )}
    </li>
  )
}
