import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, KeyRound, Plus, Webhook as WebhookIcon, XCircle } from 'lucide-react'
import { Botao, Campo, Selecao, Tabela, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import {
  EVENTOS_WEBHOOK,
  alternarWebhook,
  criarChaveApi,
  criarWebhook,
  entregasRecentes,
  listarChavesApi,
  listarWebhooks,
  revogarChaveApi,
} from '@/admin/api'

function quando(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'
}

/**
 * Gestão da API aberta (SESSAO-11 / Q-50 / RF-52 — só admin):
 * chaves (o valor aparece UMA vez; revogar corta na hora) e webhooks de
 * saída (URL + eventos assinados + últimas entregas da fila).
 */
export function AdminApi() {
  const { perfil } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const { data: chaves = [] } = useQuery({ queryKey: ['chaves-api'], queryFn: listarChavesApi })
  const { data: webhooks = [] } = useQuery({ queryKey: ['webhooks'], queryFn: listarWebhooks })
  const { data: entregas = [] } = useQuery({
    queryKey: ['webhook-entregas'],
    queryFn: entregasRecentes,
    refetchInterval: 30_000,
  })

  function aoErro(titulo: string) {
    return (excecao: unknown) =>
      notificar({
        titulo,
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      })
  }

  // ----- chaves -----
  const [nomeChave, setNomeChave] = useState('')
  const [escopoChave, setEscopoChave] = useState<'leitura' | 'escrita'>('escrita')
  const [chaveRecemCriada, setChaveRecemCriada] = useState<string | null>(null)

  const criarChaveMutacao = useMutation({
    mutationFn: () =>
      criarChaveApi({ nome: nomeChave, escopo: escopoChave, criadaPor: perfil!.id }),
    onSuccess: async (valor) => {
      setChaveRecemCriada(valor)
      setNomeChave('')
      await clienteQuery.invalidateQueries({ queryKey: ['chaves-api'] })
    },
    onError: aoErro('Não deu para criar a chave'),
  })
  const revogarMutacao = useMutation({
    mutationFn: revogarChaveApi,
    onSuccess: async () => {
      notificar({ titulo: 'Chave revogada — parou de funcionar agora', tom: 'atencao' })
      await clienteQuery.invalidateQueries({ queryKey: ['chaves-api'] })
    },
    onError: aoErro('Não deu para revogar'),
  })

  // ----- webhooks -----
  const [nomeWebhook, setNomeWebhook] = useState('')
  const [urlWebhook, setUrlWebhook] = useState('')
  const [segredoWebhook, setSegredoWebhook] = useState('')
  const [eventosEscolhidos, setEventosEscolhidos] = useState<string[]>([
    'card_criado',
    'movimentacao_setor',
  ])

  const criarWebhookMutacao = useMutation({
    mutationFn: () =>
      criarWebhook({
        nome: nomeWebhook,
        url: urlWebhook,
        eventos: eventosEscolhidos,
        segredo: segredoWebhook || undefined,
        criadoPor: perfil!.id,
      }),
    onSuccess: async () => {
      notificar({ titulo: 'Webhook criado', tom: 'perfeito' })
      setNomeWebhook('')
      setUrlWebhook('')
      setSegredoWebhook('')
      await clienteQuery.invalidateQueries({ queryKey: ['webhooks'] })
    },
    onError: aoErro('Não deu para criar o webhook'),
  })
  const alternarMutacao = useMutation({
    mutationFn: (parametros: { id: number; ativo: boolean }) =>
      alternarWebhook(parametros.id, parametros.ativo),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['webhooks'] }),
    onError: aoErro('Não deu para atualizar'),
  })

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl sm:text-3xl">API e integrações</h1>
        <p className="mt-1 max-w-2xl text-texto-suave">
          A porta de integrações da plataforma: chaves de acesso e webhooks de saída. O guia com
          exemplos está em <code className="text-texto">docs/api.md</code> no repositório.
        </p>
      </div>

      {/* ---------------- Chaves ---------------- */}
      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-lg">
          <KeyRound aria-hidden className="size-5 text-texto-suave" />
          Chaves de API
        </h2>

        {chaveRecemCriada && (
          <div className="flex flex-col gap-2 rounded-dm-lg border-2 border-acao-ativa bg-superficie p-4">
            <p className="text-sm font-medium text-texto">
              Copie AGORA — esta chave não aparece de novo:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-dm bg-superficie-sutil px-3 py-2 text-sm break-all text-texto">
                {chaveRecemCriada}
              </code>
              <Botao
                variante="secundaria"
                tamanho="sm"
                icone={<Copy />}
                onClick={() => {
                  void navigator.clipboard.writeText(chaveRecemCriada)
                  notificar({ titulo: 'Chave copiada', tom: 'perfeito' })
                }}
              >
                Copiar
              </Botao>
              <Botao variante="fantasma" tamanho="sm" onClick={() => setChaveRecemCriada(null)}>
                Já guardei
              </Botao>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Campo
            rotulo="Nome da chave"
            placeholder="ex.: n8n produção"
            value={nomeChave}
            onChange={(e) => setNomeChave(e.target.value)}
          />
          <Selecao
            rotulo="Escopo"
            opcoes={[
              { valor: 'escrita', rotulo: 'Leitura e escrita' },
              { valor: 'leitura', rotulo: 'Só leitura' },
            ]}
            valor={escopoChave}
            aoMudar={(v) => setEscopoChave(v as 'leitura' | 'escrita')}
          />
          <div className="flex items-end">
            <Botao
              icone={<Plus />}
              disabled={!nomeChave.trim()}
              carregando={criarChaveMutacao.isPending}
              onClick={() => criarChaveMutacao.mutate()}
            >
              Gerar chave
            </Botao>
          </div>
        </div>

        <Tabela
          legenda="Chaves de API cadastradas"
          colunas={[
            { chave: 'nome', cabecalho: 'Nome', celula: (c) => c.nome },
            {
              chave: 'prefixo',
              cabecalho: 'Prefixo',
              celula: (c) => <code className="text-sm tabular-nums">{c.prefixo}…</code>,
            },
            {
              chave: 'escopo',
              cabecalho: 'Escopo',
              celula: (c) => (c.escopo === 'escrita' ? 'leitura e escrita' : 'só leitura'),
            },
            {
              chave: 'uso',
              cabecalho: 'Último uso',
              celula: (c) => <span className="tabular-nums">{quando(c.ultimo_uso_em)}</span>,
              ocultarNoCelular: true,
            },
            {
              chave: 'estado',
              cabecalho: 'Estado',
              celula: (c) =>
                c.revogada_em ? (
                  <span className="text-sm font-medium text-danificado-texto">
                    revogada {quando(c.revogada_em)}
                  </span>
                ) : (
                  <span className="text-sm font-medium text-perfeito-texto">ativa</span>
                ),
            },
            {
              chave: 'acoes',
              cabecalho: '',
              alinhamento: 'direita',
              celula: (c) =>
                c.revogada_em ? null : (
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    icone={<XCircle />}
                    carregando={revogarMutacao.isPending}
                    onClick={() => revogarMutacao.mutate(c.id)}
                  >
                    Revogar
                  </Botao>
                ),
            },
          ]}
          dados={chaves}
          chaveDe={(c) => c.id}
          tituloCelular={(c) => c.nome}
          vazio="Nenhuma chave ainda — gere a primeira acima."
        />
      </section>

      {/* ---------------- Webhooks ---------------- */}
      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-lg">
          <WebhookIcon aria-hidden className="size-5 text-texto-suave" />
          Webhooks de saída
        </h2>
        <p className="text-sm text-texto-suave">
          Quando um evento assinado acontece, a plataforma faz um POST na URL — é assim que o n8n
          (ou qualquer sistema) reage ao que acontece aqui. A fila tenta até 5 vezes, a cada
          minuto.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Campo
            rotulo="Nome"
            placeholder="ex.: n8n — avisos"
            value={nomeWebhook}
            onChange={(e) => setNomeWebhook(e.target.value)}
          />
          <Campo
            rotulo="URL de destino"
            placeholder="https://…"
            value={urlWebhook}
            onChange={(e) => setUrlWebhook(e.target.value)}
          />
          <Campo
            rotulo="Segredo (opcional)"
            ajuda="Se preenchido, o POST leva a assinatura HMAC no header X-Assinatura."
            value={segredoWebhook}
            onChange={(e) => setSegredoWebhook(e.target.value)}
          />
        </div>

        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="mb-1 w-full text-sm font-medium text-texto">Eventos assinados</legend>
          {EVENTOS_WEBHOOK.map((evento) => (
            <button
              key={evento}
              type="button"
              role="checkbox"
              aria-checked={eventosEscolhidos.includes(evento)}
              onClick={() =>
                setEventosEscolhidos((atuais) =>
                  atuais.includes(evento)
                    ? atuais.filter((e) => e !== evento)
                    : [...atuais, evento],
                )
              }
              className={cn(
                'min-h-toque-md rounded-dm border px-3 text-sm font-medium transition-colors',
                eventosEscolhidos.includes(evento)
                  ? 'border-acao-ativa bg-acao text-acao-texto'
                  : 'border-borda-forte bg-superficie text-texto-suave',
              )}
            >
              {evento}
            </button>
          ))}
        </fieldset>

        <div>
          <Botao
            icone={<Plus />}
            disabled={!nomeWebhook.trim() || !/^https?:\/\//.test(urlWebhook) || eventosEscolhidos.length === 0}
            carregando={criarWebhookMutacao.isPending}
            onClick={() => criarWebhookMutacao.mutate()}
          >
            Criar webhook
          </Botao>
        </div>

        <Tabela
          legenda="Webhooks cadastrados"
          colunas={[
            { chave: 'nome', cabecalho: 'Nome', celula: (w) => w.nome },
            {
              chave: 'url',
              cabecalho: 'URL',
              celula: (w) => <span className="break-all text-sm">{w.url}</span>,
            },
            {
              chave: 'eventos',
              cabecalho: 'Eventos',
              celula: (w) => <span className="text-xs">{w.eventos.join(', ')}</span>,
              ocultarNoCelular: true,
            },
            {
              chave: 'ativo',
              cabecalho: 'Estado',
              celula: (w) => (
                <Botao
                  variante={w.ativo ? 'secundaria' : 'fantasma'}
                  tamanho="sm"
                  onClick={() => alternarMutacao.mutate({ id: w.id, ativo: !w.ativo })}
                >
                  {w.ativo ? 'ativo — desativar' : 'inativo — ativar'}
                </Botao>
              ),
            },
          ]}
          dados={webhooks}
          chaveDe={(w) => w.id}
          tituloCelular={(w) => w.nome}
          vazio="Nenhum webhook ainda."
        />

        {entregas.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-base">Últimas entregas da fila</h3>
            <ul className="flex flex-col gap-1.5">
              {entregas.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center gap-2 rounded-dm border border-borda px-3 py-2 text-sm"
                >
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      e.situacao === 'enviada' && 'bg-perfeito-fundo text-perfeito-texto',
                      e.situacao === 'pendente' && 'bg-superficie-sutil text-texto-suave',
                      e.situacao === 'falha' && 'bg-danificado-fundo text-danificado-texto',
                    )}
                  >
                    {e.situacao}
                  </span>
                  <span className="text-texto-suave tabular-nums">{quando(e.criada_em)}</span>
                  <span className="text-xs text-texto-fraco tabular-nums">
                    tentativas: {e.tentativas}
                  </span>
                  {e.ultimo_erro && (
                    <span className="text-xs text-danificado-texto">· {e.ultimo_erro}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
