import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Handshake, Play, UserPlus, X } from 'lucide-react'
import { Botao, Selecao, useNotificacao } from '@/componentes/ui'
import { AvatarChat } from '@/chat/componentes/AvatarChat'
import { SeletorPessoas } from '../lancamento/Seletores'
import { definirResponsavelDoSetor } from './api'
import type { ResponsaveisDoSetor } from './api'

type Pessoas = Record<string, { nome: string; foto: string | null }>

function Pessoa({ id, pessoas }: { id: string; pessoas: Pessoas }) {
  const nome = pessoas[id]?.nome ?? 'alguém'
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-texto">
      <AvatarChat nome={nome} foto={pessoas[id]?.foto ?? null} tamanho="sm" />
      <span className="min-w-0 break-words">{nome}</span>
    </span>
  )
}

/**
 * SESSAO-38 (pedido do dono, item 2.4 — D-152): os RESPONSÁVEIS do card, por
 * setor. Quem pegou o card em cada setor sai da história (o evento é a
 * tabela-mãe — M-02) e não se muda; o líder, o PCP e o admin definem quem
 * pega nos PRÓXIMOS setores (o banco recusa o setor já trabalhado).
 */
export function ResponsaveisPorSetor({
  cardId,
  setores,
  pessoas,
  somenteVer,
}: {
  cardId: number
  setores: ResponsaveisDoSetor[]
  pessoas: Pessoas
  /** No tablet a janela é só para ver (D-136). */
  somenteVer: boolean
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [definindo, setDefinindo] = useState(false)
  const [setorEscolhido, setSetorEscolhido] = useState('')

  const comAlgo = setores.filter(
    (s) => s.executado || s.atual || s.planejados.length > 0 || s.auxiliaram.length > 0,
  )
  const planejaveis = somenteVer ? [] : setores.filter((s) => s.pode_planejar)

  const mudar = useMutation({
    mutationFn: definirResponsavelDoSetor,
    onSuccess: async (_r, vars) => {
      notificar({
        titulo: vars.por ? 'Responsável definido — a pessoa foi avisada' : 'Responsável tirado',
        tom: 'perfeito',
      })
      setDefinindo(false)
      await clienteQuery.invalidateQueries({ queryKey: ['card-janela', cardId] })
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para mudar o responsável',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })

  const nome = (id: string) => pessoas[id]?.nome ?? 'alguém'

  return (
    <div className="flex flex-col gap-2">
      {comAlgo.length === 0 && (
        <p className="text-sm text-texto-fraco">Ninguém pegou este card ainda.</p>
      )}
      {comAlgo.length > 0 && (
        <ul className="flex flex-col divide-y divide-borda rounded-dm border border-borda">
          {comAlgo.map((s) => (
            <li key={s.setor_id} className="flex flex-col gap-1.5 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-texto">{s.setor_nome}</span>
                {s.atual && (
                  <span className="rounded-full bg-info-fundo px-2 py-0.5 text-xs font-medium text-info-texto">
                    o card está aqui
                  </span>
                )}
              </div>
              {s.executaram.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1 text-xs text-texto-suave">
                    <Play aria-hidden className="size-3.5 text-perfeito-forte" />
                    {s.executaram.length === 1 ? 'Pegou' : 'Pegaram'}
                  </span>
                  {s.executaram.map((id) => (
                    <Pessoa key={id} id={id} pessoas={pessoas} />
                  ))}
                </div>
              )}
              {s.auxiliaram.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1 text-xs text-texto-suave">
                    <Handshake aria-hidden className="size-3.5" />
                    {s.auxiliaram.length === 1 ? 'Ajudou' : 'Ajudaram'}
                  </span>
                  {s.auxiliaram.map((id) => (
                    <Pessoa key={id} id={id} pessoas={pessoas} />
                  ))}
                </div>
              )}
              {s.planejados.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1 text-xs text-texto-suave">
                    <UserPlus aria-hidden className="size-3.5" />
                    {s.executado ? 'Estava definido' : 'Vai pegar'}
                  </span>
                  {s.planejados.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1">
                      <Pessoa id={id} pessoas={pessoas} />
                      {s.pode_planejar && !somenteVer && (
                        <Botao
                          variante="fantasma"
                          tamanho="sm"
                          icone={<X />}
                          className="px-2"
                          aria-label={`Tirar ${nome(id)} de ${s.setor_nome}`}
                          disabled={mudar.isPending}
                          onClick={() =>
                            mudar.mutate({ cardId, setorId: s.setor_id, usuarioId: id, por: false })
                          }
                        />
                      )}
                    </span>
                  ))}
                </div>
              )}
              {s.executado && s.executaram.length === 0 && s.auxiliaram.length === 0 && (
                <span className="text-xs text-texto-fraco">Já trabalhado aqui.</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {planejaveis.length > 0 &&
        (definindo ? (
          <div className="flex flex-col gap-2 rounded-dm border border-borda p-3">
            <Selecao
              rotulo="Setor"
              opcoes={planejaveis.map((s) => ({ valor: String(s.setor_id), rotulo: s.setor_nome }))}
              valor={setorEscolhido}
              aoMudar={setSetorEscolhido}
              placeholder="Escolha o próximo setor"
            />
            {setorEscolhido && (
              <SeletorPessoas
                escolhidas={[]}
                aoMudar={(lista) => {
                  const p = lista[0]
                  if (p)
                    mudar.mutate({
                      cardId,
                      setorId: Number(setorEscolhido),
                      usuarioId: p.id,
                      por: true,
                    })
                }}
              />
            )}
            <Botao
              variante="secundaria"
              tamanho="sm"
              className="self-start"
              onClick={() => setDefinindo(false)}
            >
              Cancelar
            </Botao>
          </div>
        ) : (
          <Botao
            variante="fantasma"
            tamanho="sm"
            icone={<UserPlus />}
            className="self-start"
            onClick={() => {
              setSetorEscolhido('')
              setDefinindo(true)
            }}
          >
            Definir quem pega no próximo setor
          </Botao>
        ))}
    </div>
  )
}
