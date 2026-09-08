import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Botao, Campo, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarEtapasAtivas, buscarSetores } from '@/kanban/api'
import { membrosDoSetor } from '@/tablet/api'
import { atualizarMeta, criarMeta, usuariosAtivos } from './api'
import type { IndicadorMeta, MetaPainel, PeriodoMeta } from './api'
import { ROTULO_INDICADOR } from './progresso'

/**
 * Criar/editar meta (SESSAO-14 / D-37; SESSAO-15 / D-45). Quem pode criar o
 * quê é regra de RLS no banco; aqui as opções só refletem o papel: admin
 * escolhe qualquer pessoa ou setor, líder escolhe o território dele, operador
 * cria para si. O dono da meta não muda depois de criada (regra do banco) —
 * na edição fica travado. A meta de UNIDADES pode mirar uma etapa ("concluir
 * X cards na etapa Y") — o liderado só executa e a meta contabiliza sozinha.
 */

const OPCOES_INDICADOR = (Object.keys(ROTULO_INDICADOR) as IndicadorMeta[]).map((i) => ({
  valor: i,
  rotulo: ROTULO_INDICADOR[i],
}))

const OPCOES_PERIODO: { valor: PeriodoMeta; rotulo: string }[] = [
  { valor: 'diaria', rotulo: 'Diária (reinicia a cada dia)' },
  { valor: 'semanal', rotulo: 'Semanal (segunda a domingo)' },
  { valor: 'mensal', rotulo: 'Mensal' },
]

const QUALQUER_ETAPA = 'qualquer'

export function ModalMeta({
  aberta,
  aoFechar,
  meta,
}: {
  aberta: boolean
  aoFechar: () => void
  /** Sem meta = criar; com meta = editar (dono travado). */
  meta?: MetaPainel | null
}) {
  const { perfil, vinculos } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const souAdmin = perfil?.papel === 'admin'
  const setoresQueLidero = vinculos.filter((v) => v.lider_do_setor)

  // O modal monta só quando aberto (e com key por meta) — o estado inicial
  // vem direto da prop, sem effect.
  const [titulo, setTitulo] = useState(meta?.titulo ?? '')
  const [indicador, setIndicador] = useState<IndicadorMeta>(meta?.indicador ?? 'unidades')
  const [periodo, setPeriodo] = useState<PeriodoMeta>(meta?.periodo ?? 'semanal')
  const [alvo, setAlvo] = useState(meta ? String(meta.alvo) : '')
  const [dono, setDono] = useState(
    meta ? (meta.setor_id ? `s:${meta.setor_id}` : `u:${meta.usuario_id}`) : 'eu',
  )
  const [etapa, setEtapa] = useState(meta?.etapa_id ? String(meta.etapa_id) : QUALQUER_ETAPA)

  const { data: setores = [] } = useQuery({ queryKey: ['setores'], queryFn: () => buscarSetores() })
  const { data: etapas = [] } = useQuery({
    queryKey: ['etapas-ativas'],
    queryFn: buscarEtapasAtivas,
    enabled: aberta,
    staleTime: 5 * 60_000,
  })
  const { data: pessoas = [] } = useQuery({
    queryKey: ['usuarios-ativos'],
    queryFn: usuariosAtivos,
    enabled: aberta && souAdmin,
    staleTime: 5 * 60_000,
  })
  // Líder: as pessoas que ele pode mirar são os membros dos setores que lidera.
  const { data: membrosLiderados = [] } = useQuery({
    queryKey: ['membros-liderados', setoresQueLidero.map((v) => v.setor_id).join(',')],
    queryFn: async () => {
      const listas = await Promise.all(setoresQueLidero.map((v) => membrosDoSetor(v.setor_id)))
      const vistos = new Map<string, { id: string; nome: string }>()
      for (const lista of listas)
        for (const m of lista) vistos.set(m.usuario_id, { id: m.usuario_id, nome: m.nome })
      return [...vistos.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    },
    enabled: aberta && !souAdmin && setoresQueLidero.length > 0,
    staleTime: 5 * 60_000,
  })

  const opcoesDono = useMemo(() => {
    const opcoes = [{ valor: 'eu', rotulo: `Para mim (${perfil?.nome ?? ''})` }]
    const pessoasVisiveis = souAdmin ? pessoas : membrosLiderados
    for (const p of pessoasVisiveis) {
      if (p.id === perfil?.id) continue
      opcoes.push({ valor: `u:${p.id}`, rotulo: p.nome })
    }
    const setoresVisiveis = souAdmin
      ? setores
      : setores.filter((s) => setoresQueLidero.some((v) => v.setor_id === s.id))
    for (const s of setoresVisiveis) {
      opcoes.push({ valor: `s:${s.id}`, rotulo: `Setor ${s.nome}` })
    }
    return opcoes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id, souAdmin, pessoas, membrosLiderados, setores])

  // A etapa mirada (D-45): meta de setor → etapas daquele setor; meta de
  // pessoa → qualquer etapa, com o nome do setor na frente.
  const setorDaMeta = dono.startsWith('s:') ? Number(dono.slice(2)) : null
  const opcoesEtapa = useMemo(() => {
    const nomeDoSetor = new Map(setores.map((s) => [s.id, s.nome]))
    const candidatas = etapas.filter(
      (e) => !e.eh_danificado && (setorDaMeta === null || e.setor_id === setorDaMeta),
    )
    return [
      { valor: QUALQUER_ETAPA, rotulo: 'Qualquer etapa' },
      ...candidatas.map((e) => ({
        valor: String(e.id),
        rotulo:
          setorDaMeta === null ? `${nomeDoSetor.get(e.setor_id) ?? ''} · ${e.nome}` : e.nome,
      })),
    ]
  }, [etapas, setores, setorDaMeta])
  const etapaValida = opcoesEtapa.some((o) => o.valor === etapa) ? etapa : QUALQUER_ETAPA

  const salvarMutacao = useMutation({
    mutationFn: async () => {
      const alvoNumero = Number(alvo.replace(',', '.'))
      if (!Number.isFinite(alvoNumero) || alvoNumero <= 0) {
        throw new Error('Informe um alvo maior que zero.')
      }
      const etapaId = etapaValida === QUALQUER_ETAPA ? null : Number(etapaValida)
      if (meta) {
        await atualizarMeta(meta.meta_id, { titulo, indicador, periodo, alvo: alvoNumero, etapaId })
        return
      }
      await criarMeta({
        titulo,
        indicador,
        periodo,
        alvo: alvoNumero,
        usuarioId: dono === 'eu' ? perfil!.id : dono.startsWith('u:') ? dono.slice(2) : null,
        setorId: setorDaMeta,
        etapaId,
        criadaPor: perfil!.id,
      })
    },
    onSuccess: async () => {
      notificar({ titulo: meta ? 'Meta salva' : 'Meta criada', tom: 'perfeito' })
      await clienteQuery.invalidateQueries({ queryKey: ['metas'] })
      aoFechar()
    },
    onError: (excecao: unknown) =>
      notificar({
        titulo: 'Não deu para salvar a meta',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  const rotuloAlvo =
    indicador === 'tempo_util' ? 'Alvo do período (em horas)' : 'Alvo do período (quantidade)'

  return (
    <Modal
      aberto={aberta}
      aoFechar={(a) => {
        if (!a) aoFechar()
      }}
      titulo={meta ? 'Editar meta' : 'Nova meta'}
      descricao="O andamento é calculado sozinho, do trabalho registrado — ninguém digita progresso."
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            variante="primaria"
            carregando={salvarMutacao.isPending}
            onClick={() => salvarMutacao.mutate()}
          >
            {meta ? 'Salvar' : 'Criar meta'}
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {meta ? (
          <p className="rounded-dm bg-superficie-sutil px-3 py-2 text-sm text-texto-suave">
            Meta de <strong className="text-texto">{meta.setor_nome ?? meta.usuario_nome}</strong> —
            o dono não muda; para medir outra pessoa ou setor, crie uma meta nova.
          </p>
        ) : (
          <Selecao rotulo="Meta de quem?" opcoes={opcoesDono} valor={dono} aoMudar={setDono} />
        )}
        <Selecao
          rotulo="O que medir"
          opcoes={OPCOES_INDICADOR}
          valor={indicador}
          aoMudar={(v) => setIndicador(v as IndicadorMeta)}
        />
        {indicador === 'unidades' && (
          <Selecao
            rotulo="Em qual etapa?"
            opcoes={opcoesEtapa}
            valor={etapaValida}
            aoMudar={setEtapa}
            ajuda="Ex.: concluir X cards na etapa Y — só as execuções encerradas nessa etapa contam."
          />
        )}
        <Selecao
          rotulo="Período"
          opcoes={OPCOES_PERIODO}
          valor={periodo}
          aoMudar={(v) => setPeriodo(v as PeriodoMeta)}
        />
        <Campo
          rotulo={rotuloAlvo}
          inputMode="decimal"
          value={alvo}
          onChange={(e) => setAlvo(e.target.value)}
          placeholder={indicador === 'tempo_util' ? 'ex.: 40' : 'ex.: 45'}
        />
        <Campo
          rotulo="Nome da meta (opcional)"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="ex.: Unidades fitadas da semana"
        />
      </div>
    </Modal>
  )
}
