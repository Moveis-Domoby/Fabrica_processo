import { useState } from 'react'
import { Copy, Eye, EyeOff, Trash2 } from 'lucide-react'
import { Botao, Campo, Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import type { Etapa, Setor } from '@/kanban/tipos'
import { PilulaEtiqueta } from '@/utilitarios/PilulaEtiqueta'
import { EntradaValorCampo } from '@/utilitarios/EntradaValorCampo'
import type { CampoCustomizado, Etiqueta } from '@/utilitarios/tipos'
import {
  CONDICOES,
  DESTINOS_AVISO,
  ESTADOS_PECA,
  GATILHOS,
  PASSOS,
  SITUACOES_PEDIDO,
  TIPOS_CARD,
} from '../catalogo'
import type { Gatilho } from '../catalogo'
import { enderecoChamada } from '../api'
import type { Passo } from '../desenho'

export interface DadosAutomacao {
  setores: Setor[]
  etapas: Etapa[]
  etiquetas: Etiqueta[]
  campos: CampoCustomizado[]
  pessoas: { id: string; nome: string }[]
}

const QUALQUER = 'qualquer'
const numOuNulo = (v: string) => (v === QUALQUER || v === '' ? null : Number(v))
const textoDe = (v: unknown) => (v === null || v === undefined || v === '' ? QUALQUER : String(v))

/** Setor + etapa (reais, do cadastro), com "qualquer" opcional. */
function EscolhaLugar({
  dados,
  setorId,
  etapaId,
  aoMudar,
  rotuloSetor = 'Setor',
  permitirQualquerSetor = true,
  rotuloQualquerSetor = 'Qualquer setor',
  rotuloQualquerEtapa = 'Qualquer etapa',
  semRotas = false,
}: {
  dados: DadosAutomacao
  setorId: unknown
  etapaId: unknown
  aoMudar: (setorId: number | null, etapaId: number | null) => void
  rotuloSetor?: string
  permitirQualquerSetor?: boolean
  rotuloQualquerSetor?: string
  rotuloQualquerEtapa?: string
  semRotas?: boolean
}) {
  const setor = setorId === null || setorId === undefined || setorId === '' ? null : Number(setorId)
  const etapas = dados.etapas.filter((e) => e.setor_id === setor)
  const setores = dados.setores.filter((s) => !(semRotas && s.codigo === 'rotas'))
  return (
    <div className="flex flex-col gap-3">
      <Selecao
        rotulo={rotuloSetor}
        valor={textoDe(setor)}
        aoMudar={(v) => aoMudar(numOuNulo(v), null)}
        opcoes={[
          ...(permitirQualquerSetor ? [{ valor: QUALQUER, rotulo: rotuloQualquerSetor }] : []),
          ...setores.map((s) => ({ valor: String(s.id), rotulo: s.nome })),
        ]}
        placeholder="Escolha o setor"
      />
      {setor !== null && etapas.length > 0 && (
        <Selecao
          rotulo="Etapa"
          valor={textoDe(etapaId)}
          aoMudar={(v) => aoMudar(setor, numOuNulo(v))}
          opcoes={[
            { valor: QUALQUER, rotulo: rotuloQualquerEtapa },
            ...etapas.map((e) => ({
              valor: String(e.id),
              rotulo: e.eh_fila ? `${e.nome} (fila)` : e.eh_danificado ? `${e.nome} (danificados)` : e.nome,
            })),
          ]}
        />
      )}
    </div>
  )
}

function EscolhaEtiquetas({
  etiquetas,
  escolhidas,
  aoMudar,
}: {
  etiquetas: Etiqueta[]
  escolhidas: number[]
  aoMudar: (ids: number[]) => void
}) {
  const ativas = etiquetas.filter((e) => e.arquivada_em === null || escolhidas.includes(e.id))
  if (ativas.length === 0)
    return (
      <p className="rounded-dm border border-borda bg-superficie-sutil p-3 text-sm text-texto-suave">
        Nenhuma etiqueta cadastrada ainda — cadastre em Configurações → Utilitários.
      </p>
    )
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium text-texto">Etiquetas</legend>
      {ativas.map((e) => (
        <label key={e.id} className="inline-flex min-h-toque-md items-center gap-2">
          <input
            type="checkbox"
            className="size-5 accent-marca-500"
            checked={escolhidas.includes(e.id)}
            onChange={(ev) =>
              aoMudar(ev.target.checked ? [...escolhidas, e.id] : escolhidas.filter((id) => id !== e.id))
            }
          />
          <PilulaEtiqueta etiqueta={e} />
        </label>
      ))}
    </fieldset>
  )
}

function EscolhaCampo({
  campos,
  campoId,
  aoMudar,
}: {
  campos: CampoCustomizado[]
  campoId: unknown
  aoMudar: (id: number) => void
}) {
  const ativos = campos.filter((c) => c.arquivado_em === null || c.id === Number(campoId))
  if (ativos.length === 0)
    return (
      <p className="rounded-dm border border-borda bg-superficie-sutil p-3 text-sm text-texto-suave">
        Nenhum campo customizado cadastrado ainda — cadastre em Configurações → Utilitários.
      </p>
    )
  return (
    <Selecao
      rotulo="Campo"
      valor={campoId ? String(campoId) : undefined}
      aoMudar={(v) => aoMudar(Number(v))}
      opcoes={ativos.map((c) => ({ valor: String(c.id), rotulo: c.nome }))}
      placeholder="Escolha o campo"
    />
  )
}

/** O painel do bloco QUANDO: o tipo do gatilho e os filtros dele. */
export function PainelQuando({
  gatilho,
  config,
  dados,
  automacaoId,
  aoMudar,
}: {
  gatilho: Gatilho
  config: Record<string, unknown>
  dados: DadosAutomacao
  automacaoId: number | null
  aoMudar: (gatilho: Gatilho, config: Record<string, unknown>) => void
}) {
  const notificar = useNotificacao()
  const definicao = GATILHOS.find((g) => g.valor === gatilho)
  const cfg = (mais: Record<string, unknown>) => aoMudar(gatilho, { ...config, ...mais })
  const estados = Array.isArray(config.estados) ? (config.estados as string[]) : []
  const horas = Number(config.horas ?? 0)
  const emDias = horas >= 24 && horas % 24 === 0

  return (
    <div className="flex flex-col gap-4">
      <Selecao
        rotulo="Quando"
        valor={gatilho}
        aoMudar={(v) => aoMudar(v as Gatilho, v === 'card_parado' ? { horas: 24 } : v === 'qualidade_marcada' ? { estados: ['danificado'] } : {})}
        opcoes={GATILHOS.map((g) => ({ valor: g.valor, rotulo: `${g.grupo} · ${g.rotulo}` }))}
      />
      {definicao && <p className="text-sm text-texto-suave">{definicao.descricao}</p>}

      {(gatilho === 'card_entrou' || gatilho === 'card_iniciado') && (
        <EscolhaLugar
          dados={dados}
          setorId={config.setor_id}
          etapaId={config.etapa_id}
          aoMudar={(s, e) => cfg({ setor_id: s, etapa_id: e })}
        />
      )}
      {gatilho === 'card_parado' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Campo
              rotulo="Parado há"
              type="number"
              min={1}
              value={horas ? String(emDias ? horas / 24 : horas) : ''}
              onChange={(e) => {
                const n = Math.max(1, Math.round(Number(e.target.value) || 1))
                cfg({ horas: emDias ? n * 24 : n })
              }}
            />
            <Selecao
              rotulo="Em"
              valor={emDias ? 'dias' : 'horas'}
              aoMudar={(v) => cfg({ horas: v === 'dias' ? Math.max(1, Math.round(horas || 1)) * 24 : Math.max(1, emDias ? horas / 24 : horas) })}
              opcoes={[
                { valor: 'horas', rotulo: 'horas' },
                { valor: 'dias', rotulo: 'dias' },
              ]}
            />
          </div>
          <EscolhaLugar
            dados={dados}
            setorId={config.setor_id}
            etapaId={config.etapa_id}
            rotuloQualquerSetor="Qualquer setor de produção"
            aoMudar={(s, e) => cfg({ setor_id: s, etapa_id: e })}
          />
        </>
      )}
      {gatilho === 'qualidade_marcada' && (
        <>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium text-texto">Marcada como</legend>
            {ESTADOS_PECA.map((e) => (
              <label key={e.valor} className="inline-flex min-h-toque-md items-center gap-2 text-sm text-texto">
                <input
                  type="checkbox"
                  className="size-5 accent-marca-500"
                  checked={estados.includes(e.valor)}
                  onChange={(ev) =>
                    cfg({ estados: ev.target.checked ? [...estados, e.valor] : estados.filter((x) => x !== e.valor) })
                  }
                />
                {e.rotulo}
              </label>
            ))}
          </fieldset>
          <EscolhaLugar
            dados={dados}
            setorId={config.setor_id}
            etapaId={null}
            rotuloSetor="No setor"
            aoMudar={(s) => cfg({ setor_id: s, etapa_id: null })}
          />
        </>
      )}
      {gatilho === 'card_arquivado' && (
        <EscolhaLugar dados={dados} setorId={config.setor_id} etapaId={null} rotuloSetor="No setor" aoMudar={(s) => cfg({ setor_id: s })} />
      )}
      {(gatilho === 'etiqueta_posta' || gatilho === 'etiqueta_tirada') && (
        <Selecao
          rotulo="Etiqueta"
          valor={textoDe(config.etiqueta_id)}
          aoMudar={(v) => cfg({ etiqueta_id: numOuNulo(v) })}
          opcoes={[
            { valor: QUALQUER, rotulo: 'Qualquer etiqueta' },
            ...dados.etiquetas.filter((e) => e.arquivada_em === null).map((e) => ({ valor: String(e.id), rotulo: e.nome })),
          ]}
        />
      )}
      {gatilho === 'pedido_situacao' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Selecao
            rotulo="De"
            valor={textoDe(config.de)}
            aoMudar={(v) => cfg({ de: v === QUALQUER ? null : v })}
            opcoes={[{ valor: QUALQUER, rotulo: 'Qualquer situação' }, ...SITUACOES_PEDIDO]}
          />
          <Selecao
            rotulo="Para"
            valor={textoDe(config.para)}
            aoMudar={(v) => cfg({ para: v === QUALQUER ? null : v })}
            opcoes={[{ valor: QUALQUER, rotulo: 'Qualquer situação' }, ...SITUACOES_PEDIDO]}
          />
        </div>
      )}
      {gatilho === 'chamada_externa' && (
        <div className="flex flex-col gap-2 rounded-dm border border-borda bg-superficie-sutil p-3 text-sm text-texto-suave">
          {automacaoId ? (
            <>
              <span>O n8n (ou outro sistema) chama este endereço com POST e a chave da API (de escrita):</span>
              <code className="break-all rounded bg-superficie px-2 py-1 text-xs text-texto">{enderecoChamada(automacaoId)}</code>
              <Botao
                variante="secundaria"
                tamanho="sm"
                icone={<Copy />}
                className="self-start"
                onClick={() => {
                  void navigator.clipboard?.writeText(enderecoChamada(automacaoId))
                  notificar({ titulo: 'Endereço copiado', tom: 'perfeito' })
                }}
              >
                Copiar o endereço
              </Botao>
              <span>
                No corpo, opcional: o card (<code>card_id</code>) ou o número do pedido (<code>pedido</code>) e
                outros dados livres (<code>dados</code>). A chave vai no cabeçalho <code>X-Chave-API</code>.
              </span>
            </>
          ) : (
            <span>Salve a automação para ver o endereço que o n8n chama.</span>
          )}
        </div>
      )}
    </div>
  )
}

/** O painel de um bloco FAÇA. */
export function PainelPasso({
  passo,
  dados,
  segredo,
  aoMudar,
  aoRemover,
}: {
  passo: Passo
  dados: DadosAutomacao
  segredo: string | null
  aoMudar: (passo: Passo) => void
  aoRemover: () => void
}) {
  const [verSegredo, setVerSegredo] = useState(false)
  const definicao = PASSOS.find((p) => p.valor === passo.tipo)
  const mudar = (mais: Record<string, unknown>) => aoMudar({ ...passo, ...mais })
  const campo = dados.campos.find((c) => c.id === Number(passo.campo_id))
  const etiquetasEscolhidas = Array.isArray(passo.etiquetas) ? (passo.etiquetas as number[]).map(Number) : []
  const valores = Array.isArray(passo.valores) ? (passo.valores as string[]) : []

  return (
    <div className="flex flex-col gap-4">
      {definicao && <p className="text-sm text-texto-suave">{definicao.descricao}</p>}

      {passo.tipo === 'mover' && (
        <>
          <EscolhaLugar
            dados={dados}
            setorId={passo.setor_id}
            etapaId={passo.etapa_id}
            permitirQualquerSetor={false}
            rotuloSetor="Para o setor"
            rotuloQualquerEtapa="A fila do setor"
            semRotas
            aoMudar={(s, e) => mudar({ setor_id: s, etapa_id: e })}
          />
          <p className="text-xs text-texto-suave">
            Valem as regras de sempre: o estoque só recebe peça perfeita e sem dono, Pedidos em aguardo só peça de
            pedido vivo, e o card do pedido não sai do PCP. Etapa que "manda para" outro setor leva o card até lá.
            Para as ROTAS, só pelo "Lançar para ROTAS".
          </p>
        </>
      )}

      {(passo.tipo === 'arquivar' || passo.tipo === 'desarquivar') && (
        <p className="rounded-dm border border-borda bg-superficie-sutil p-3 text-sm text-texto-suave">
          {passo.tipo === 'arquivar'
            ? 'O card sai dos quadros. Nada se apaga — a história fica, e dá para trazer de volta.'
            : 'O card arquivado volta para onde estava. Use depois do "O card foi arquivado".'}
        </p>
      )}

      {passo.tipo === 'etiqueta_por' && (
        <EscolhaEtiquetas etiquetas={dados.etiquetas} escolhidas={etiquetasEscolhidas} aoMudar={(ids) => mudar({ etiquetas: ids })} />
      )}

      {passo.tipo === 'etiqueta_tirar' && (
        <>
          <label className="inline-flex min-h-toque-md items-center gap-2 text-sm text-texto">
            <input
              type="checkbox"
              className="size-5 accent-marca-500"
              checked={Boolean(passo.todas)}
              onChange={(e) => mudar({ todas: e.target.checked, etiquetas: e.target.checked ? [] : etiquetasEscolhidas })}
            />
            Tirar todas as etiquetas
          </label>
          {!passo.todas && (
            <EscolhaEtiquetas etiquetas={dados.etiquetas} escolhidas={etiquetasEscolhidas} aoMudar={(ids) => mudar({ etiquetas: ids })} />
          )}
        </>
      )}

      {passo.tipo === 'campo' && (
        <>
          <EscolhaCampo campos={dados.campos} campoId={passo.campo_id} aoMudar={(id) => mudar({ campo_id: id, valor: null, limpar: false })} />
          {campo && (
            <>
              <label className="inline-flex min-h-toque-md items-center gap-2 text-sm text-texto">
                <input
                  type="checkbox"
                  className="size-5 accent-marca-500"
                  checked={Boolean(passo.limpar)}
                  onChange={(e) => mudar({ limpar: e.target.checked })}
                />
                Limpar o campo (em vez de preencher)
              </label>
              {!passo.limpar && <EntradaValorCampo campo={campo} valor={passo.valor} aoMudar={(v) => mudar({ valor: v })} />}
              <p className="text-xs text-texto-suave">
                {campo.em_pecas && campo.em_pedidos
                  ? 'Vale nas peças e nos pedidos: na peça grava nela; no card do pedido, grava no pedido.'
                  : campo.em_pecas
                    ? 'Vale só nas peças.'
                    : 'Vale só nos pedidos (no card do pedido, grava no pedido).'}
              </p>
            </>
          )}
        </>
      )}

      {passo.tipo === 'avisar' && (
        <>
          <Selecao
            rotulo="Quem recebe"
            valor={passo.destino ? String(passo.destino) : undefined}
            aoMudar={(v) => mudar({ destino: v })}
            opcoes={DESTINOS_AVISO}
            placeholder="Escolha quem recebe"
          />
          {passo.destino === 'pessoa' && (
            <Selecao
              rotulo="Pessoa"
              valor={passo.usuario_id ? String(passo.usuario_id) : undefined}
              aoMudar={(v) => mudar({ usuario_id: v })}
              opcoes={dados.pessoas.map((p) => ({ valor: p.id, rotulo: p.nome }))}
              placeholder="Escolha a pessoa"
            />
          )}
          {(passo.destino === 'lideres' || passo.destino === 'setor') && (
            <Selecao
              rotulo="Do setor"
              valor={textoDe(passo.setor_id)}
              aoMudar={(v) => mudar({ setor_id: numOuNulo(v) })}
              opcoes={[{ valor: QUALQUER, rotulo: 'O setor onde o card está' }, ...dados.setores.map((s) => ({ valor: String(s.id), rotulo: s.nome }))]}
            />
          )}
          <Campo rotulo="Título" value={String(passo.titulo ?? '')} maxLength={120} onChange={(e) => mudar({ titulo: e.target.value })} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-texto">Mensagem</span>
            <textarea
              value={String(passo.mensagem ?? '')}
              maxLength={500}
              rows={4}
              onChange={(e) => mudar({ mensagem: e.target.value })}
              className="rounded-dm border border-borda-forte bg-superficie px-3 py-2 text-base text-texto"
            />
          </label>
          <p className="text-xs text-texto-suave">
            Dá para usar: {'{pedido}'} · {'{produto}'} · {'{setor}'} · {'{etapa}'} · {'{situacao}'} · {'{automacao}'}
          </p>
        </>
      )}

      {passo.tipo === 'chamar' && (
        <>
          <Campo
            rotulo="Endereço (o webhook do n8n, por exemplo)"
            value={String(passo.url ?? '')}
            maxLength={500}
            placeholder="https://"
            onChange={(e) => mudar({ url: e.target.value.trim() })}
          />
          <div className="flex flex-col gap-2 rounded-dm border border-borda bg-superficie-sutil p-3 text-xs text-texto-suave">
            <span>
              Vai um POST com os dados do card e do pedido. O cabeçalho <code>X-Assinatura</code> leva a assinatura do
              corpo com a chave desta automação — o n8n confere para saber que veio da plataforma.
            </span>
            {segredo ? (
              <span className="flex flex-wrap items-center gap-2">
                <code className="break-all rounded bg-superficie px-2 py-1 text-texto">{verSegredo ? segredo : '••••••••••••••••'}</code>
                <Botao variante="fantasma" tamanho="sm" icone={verSegredo ? <EyeOff /> : <Eye />} onClick={() => setVerSegredo((v) => !v)}>
                  {verSegredo ? 'Esconder a chave' : 'Mostrar a chave'}
                </Botao>
              </span>
            ) : (
              <span>Salve a automação para ver a chave.</span>
            )}
          </div>
        </>
      )}

      {passo.tipo === 'esperar' && (
        <div className="grid grid-cols-2 gap-3">
          <Campo
            rotulo="Esperar"
            type="number"
            min={1}
            value={String(passo.quantidade ?? 1)}
            onChange={(e) => mudar({ quantidade: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
          />
          <Selecao
            rotulo="Em"
            valor={String(passo.unidade ?? 'horas')}
            aoMudar={(v) => mudar({ unidade: v })}
            opcoes={[
              { valor: 'minutos', rotulo: 'minutos' },
              { valor: 'horas', rotulo: 'horas' },
              { valor: 'dias', rotulo: 'dias' },
            ]}
          />
        </div>
      )}

      {passo.tipo === 'se' && (
        <>
          <Selecao
            rotulo="Só segue se"
            valor={passo.condicao ? String(passo.condicao) : undefined}
            aoMudar={(v) => aoMudar({ tipo: 'se', condicao: v })}
            opcoes={CONDICOES}
            placeholder="Escolha a condição"
          />
          {(passo.condicao === 'tem_etiqueta' || passo.condicao === 'nao_tem_etiqueta') && (
            <Selecao
              rotulo="Etiqueta"
              valor={passo.etiqueta_id ? String(passo.etiqueta_id) : undefined}
              aoMudar={(v) => mudar({ etiqueta_id: Number(v) })}
              opcoes={dados.etiquetas.filter((e) => e.arquivada_em === null).map((e) => ({ valor: String(e.id), rotulo: e.nome }))}
              placeholder="Escolha a etiqueta"
            />
          )}
          {(passo.condicao === 'campo_igual' || passo.condicao === 'campo_vazio' || passo.condicao === 'campo_preenchido') && (
            <>
              <EscolhaCampo campos={dados.campos} campoId={passo.campo_id} aoMudar={(id) => mudar({ campo_id: id, valor: null })} />
              {passo.condicao === 'campo_igual' && campo && (
                <EntradaValorCampo campo={campo} valor={passo.valor} aoMudar={(v) => mudar({ valor: v })} />
              )}
            </>
          )}
          {passo.condicao === 'no_setor' && (
            <EscolhaLugar
              dados={dados}
              setorId={passo.setor_id}
              etapaId={passo.etapa_id}
              permitirQualquerSetor={false}
              aoMudar={(s, e) => mudar({ setor_id: s, etapa_id: e })}
            />
          )}
          {(passo.condicao === 'situacao_pedido' || passo.condicao === 'tipo_card') && (
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-medium text-texto">
                {passo.condicao === 'situacao_pedido' ? 'Situação (qualquer uma das marcadas)' : 'O card é'}
              </legend>
              {(passo.condicao === 'situacao_pedido' ? SITUACOES_PEDIDO : TIPOS_CARD).map((o) => (
                <label key={o.valor} className="inline-flex min-h-toque-md items-center gap-2 text-sm text-texto">
                  <input
                    type="checkbox"
                    className="size-5 accent-marca-500"
                    checked={valores.includes(o.valor)}
                    onChange={(e) => mudar({ valores: e.target.checked ? [...valores, o.valor] : valores.filter((v) => v !== o.valor) })}
                  />
                  {o.rotulo}
                </label>
              ))}
            </fieldset>
          )}
        </>
      )}

      <Botao variante="secundaria" icone={<Trash2 />} onClick={aoRemover} className={cn('self-start')}>
        Tirar este bloco
      </Botao>
    </div>
  )
}
