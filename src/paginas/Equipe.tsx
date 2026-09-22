import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  Check,
  Copy,
  KeyRound,
  MessageCircle,
  RotateCcw,
  Trash2,
  UserRoundPlus,
} from 'lucide-react'
import { Botao, Campo, Modal, Selecao, Tabela, useNotificacao } from '@/componentes/ui'
import type { ColunaTabela } from '@/componentes/ui'
import { supabase } from '@/lib/supabase'
import { useSessao } from '@/autenticacao/sessao-contexto'
import {
  arquivarUsuario,
  criarUsuario,
  desarquivarUsuario,
  excluirUsuario,
  pinDefinir,
} from '@/autenticacao/api'
import type { UsuarioCriado } from '@/autenticacao/api'
import { COLUNAS_PERFIL, ROTULO_PAPEL } from '@/autenticacao/tipos'
import type { Papel, Perfil } from '@/autenticacao/tipos'
import { buscarSetores } from '@/kanban/api'

interface LinhaEquipe extends Perfil {
  setores: string
}

async function buscarEquipe(): Promise<LinhaEquipe[]> {
  const [pessoas, vinculos] = await Promise.all([
    supabase.from('plt_usuarios').select(COLUNAS_PERFIL).order('nome'),
    supabase
      .from('plt_usuario_setores')
      .select('usuario_id, lider_do_setor, setor:plt_setores(nome)'),
  ])
  const setoresPorPessoa = new Map<string, string[]>()
  for (const v of (vinculos.data ?? []) as unknown as {
    usuario_id: string
    lider_do_setor: boolean
    setor: { nome: string }
  }[]) {
    const lista = setoresPorPessoa.get(v.usuario_id) ?? []
    lista.push(v.lider_do_setor ? `${v.setor.nome} (líder)` : v.setor.nome)
    setoresPorPessoa.set(v.usuario_id, lista)
  }
  return ((pessoas.data ?? []) as Perfil[]).map((p) => ({
    ...p,
    setores: (setoresPorPessoa.get(p.id) ?? []).join(' · ') || '—',
  }))
}

const FORMULARIO_VAZIO = {
  nome: '',
  email: '',
  usuario: '',
  cpf: '',
  telefone: '',
  papel: 'operador' as Papel,
  pin: '',
}

/** Gestão mínima de usuários e convites (RF-20/RF-21) — o painel completo é a SESSAO-14. */
export function Equipe() {
  const { perfil, vinculos } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const souAdmin = perfil?.papel === 'admin'
  const meusSetoresLiderados = useMemo(
    () => vinculos.filter((v) => v.lider_do_setor).map((v) => v.setor_id),
    [vinculos],
  )

  const { data: equipe = [], isPending: carregandoEquipe } = useQuery({
    queryKey: ['equipe'],
    queryFn: buscarEquipe,
  })
  // D-49: arquivado sai da lista do dia a dia — vive atrás do botão "Arquivados".
  const [verArquivados, setVerArquivados] = useState(false)
  const ativos = useMemo(() => equipe.filter((p) => !p.arquivado_em), [equipe])
  const arquivados = useMemo(() => equipe.filter((p) => p.arquivado_em), [equipe])
  const { data: setores = [] } = useQuery({ queryKey: ['setores'], queryFn: () => buscarSetores() })

  // Líder só cadastra nos setores em que é líder (a Edge Function confere de novo).
  const setoresDisponiveis = souAdmin
    ? setores
    : setores.filter((s) => meusSetoresLiderados.includes(s.id))

  const [modalNovo, setModalNovo] = useState(false)
  const [formulario, setFormulario] = useState(FORMULARIO_VAZIO)
  const [setoresEscolhidos, setSetoresEscolhidos] = useState<Map<number, boolean>>(new Map())
  const [erroFormulario, setErroFormulario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [criado, setCriado] = useState<(UsuarioCriado & { nome: string }) | null>(null)
  const [linkCopiado, setLinkCopiado] = useState(false)

  const [alvoPin, setAlvoPin] = useState<LinhaEquipe | null>(null)
  const [pinNovo, setPinNovo] = useState('')
  const [erroPin, setErroPin] = useState('')
  const [salvandoPin, setSalvandoPin] = useState(false)

  // Arquivar / excluir (SESSAO-22 / D-49) — modais da casa, nada do navegador.
  const [alvoArquivar, setAlvoArquivar] = useState<LinhaEquipe | null>(null)
  const [alvoExcluir, setAlvoExcluir] = useState<LinhaEquipe | null>(null)
  const [erroDestino, setErroDestino] = useState('')
  const [processando, setProcessando] = useState(false)

  async function aoArquivar() {
    if (!alvoArquivar) return
    setProcessando(true)
    setErroDestino('')
    try {
      const resumo = await arquivarUsuario(alvoArquivar.id)
      notificar({
        titulo: `${alvoArquivar.nome} arquivado(a)`,
        descricao:
          `Tudo segue registrado no nome dele(a). Realocado ao líder: ` +
          `${resumo.cards_realocados} card(s) delegado(s) e ${resumo.tarefas_realocadas} tarefa(s)` +
          (resumo.execucoes_encerradas > 0
            ? `; ${resumo.execucoes_encerradas} execução(ões) encerrada(s) no ato.`
            : '.'),
        tom: 'perfeito',
      })
      setAlvoArquivar(null)
      await clienteQuery.invalidateQueries({ queryKey: ['equipe'] })
    } catch (excecao) {
      setErroDestino(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.')
    } finally {
      setProcessando(false)
    }
  }

  async function aoReativar(pessoa: LinhaEquipe) {
    try {
      await desarquivarUsuario(pessoa.id)
      notificar({
        titulo: `${pessoa.nome} reativado(a)`,
        descricao: 'As pendências realocadas no arquivamento não voltam — realoque à mão se precisar.',
        tom: 'perfeito',
      })
      await clienteQuery.invalidateQueries({ queryKey: ['equipe'] })
    } catch (excecao) {
      notificar({
        titulo: 'Não deu para reativar',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      })
    }
  }

  async function aoExcluir() {
    if (!alvoExcluir) return
    setProcessando(true)
    setErroDestino('')
    try {
      await excluirUsuario(alvoExcluir.id)
      notificar({
        titulo: `${alvoExcluir.nome} excluído(a)`,
        descricao: 'Cadastro, vínculos, tarefas e a conta de acesso foram apagados de verdade.',
        tom: 'perfeito',
      })
      setAlvoExcluir(null)
      await clienteQuery.invalidateQueries({ queryKey: ['equipe'] })
    } catch (excecao) {
      setErroDestino(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.')
    } finally {
      setProcessando(false)
    }
  }

  function alternarSetor(id: number) {
    setSetoresEscolhidos((atual) => {
      const novo = new Map(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.set(id, false)
      return novo
    })
  }

  function alternarLiderDe(id: number) {
    setSetoresEscolhidos((atual) => {
      const novo = new Map(atual)
      if (novo.has(id)) novo.set(id, !novo.get(id))
      return novo
    })
  }

  async function aoCriar() {
    const dados = formulario
    if (!dados.nome.trim()) return setErroFormulario('Informe o nome.')
    if (!dados.email.includes('@')) return setErroFormulario('Informe um e-mail válido.')
    if (!/^[a-z0-9._-]{3,32}$/.test(dados.usuario.trim().toLowerCase()))
      return setErroFormulario(
        'Nome de usuário: 3 a 32 caracteres, só letras, números, ponto, hífen ou underline.',
      )
    if (dados.cpf.replace(/\D/g, '').length !== 11)
      return setErroFormulario('Informe o CPF completo — a matrícula é gerada a partir dele.')
    if (setoresEscolhidos.size === 0)
      return setErroFormulario('Escolha pelo menos um setor.')
    if (dados.pin && !/^[0-9]{4,6}$/.test(dados.pin))
      return setErroFormulario('PIN: 4 a 6 dígitos, só números.')

    setErroFormulario('')
    setEnviando(true)
    try {
      const resultado = await criarUsuario({
        nome: dados.nome.trim(),
        email: dados.email.trim(),
        usuario: dados.usuario.trim().toLowerCase(),
        cpf: dados.cpf.replace(/\D/g, ''),
        telefone: dados.telefone.trim() || undefined,
        papel: souAdmin ? dados.papel : 'operador',
        setores: [...setoresEscolhidos.entries()].map(([setor_id, lider]) => ({
          setor_id,
          lider: souAdmin ? lider : false,
        })),
        pin: dados.pin || undefined,
      })
      setCriado({ ...resultado, nome: dados.nome.trim() })
      setModalNovo(false)
      setFormulario(FORMULARIO_VAZIO)
      setSetoresEscolhidos(new Map())
      setLinkCopiado(false)
      await clienteQuery.invalidateQueries({ queryKey: ['equipe'] })
    } catch (excecao) {
      setErroFormulario(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  const linkConvite = criado ? `${window.location.origin}/convite/${criado.convite_token}` : ''
  const mensagemWhats = criado
    ? `Olá, ${criado.nome}! Seu acesso à Plataforma Domoby está pronto. Abra este link para o primeiro acesso: ${linkConvite}`
    : ''

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(linkConvite)
      setLinkCopiado(true)
      notificar({ titulo: 'Link copiado', tom: 'perfeito' })
    } catch {
      notificar({ titulo: 'Não consegui copiar', descricao: 'Selecione o link e copie à mão.', tom: 'atencao' })
    }
  }

  async function aoSalvarPin() {
    if (!alvoPin) return
    if (!/^[0-9]{4,6}$/.test(pinNovo)) {
      setErroPin('PIN: 4 a 6 dígitos, só números.')
      return
    }
    setErroPin('')
    setSalvandoPin(true)
    try {
      await pinDefinir(alvoPin.id, pinNovo)
      notificar({ titulo: `PIN de ${alvoPin.nome} definido`, tom: 'perfeito' })
      setAlvoPin(null)
      setPinNovo('')
    } catch (excecao) {
      setErroPin(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.')
    } finally {
      setSalvandoPin(false)
    }
  }

  const colunas: ColunaTabela<LinhaEquipe>[] = [
    { chave: 'matricula', cabecalho: 'Matrícula', celula: (p) => <span className="tabular-nums">{p.matricula}</span> },
    { chave: 'nome', cabecalho: 'Nome', celula: (p) => p.nome, ocultarNoCelular: true },
    { chave: 'usuario', cabecalho: 'Usuário', celula: (p) => p.usuario },
    { chave: 'papel', cabecalho: 'Papel', celula: (p) => ROTULO_PAPEL[p.papel] },
    { chave: 'setores', cabecalho: 'Setores', celula: (p) => p.setores },
    {
      chave: 'situacao',
      cabecalho: 'Situação',
      celula: (p) =>
        p.arquivado_em ? (
          <span className="inline-flex items-center gap-1 text-texto-fraco">
            <Archive aria-hidden className="size-3.5" />
            arquivado
          </span>
        ) : p.senha_padrao ? (
          <span className="text-atencao-forte">aguardando 1º acesso</span>
        ) : (
          <span className="text-perfeito-forte">ativo</span>
        ),
    },
    {
      chave: 'acoes',
      cabecalho: 'Ações',
      celula: (p) => (
        <span className="flex flex-wrap items-center gap-1.5">
          {!p.arquivado_em && (
            <Botao
              variante="secundaria"
              tamanho="sm"
              icone={<KeyRound />}
              onClick={() => {
                setAlvoPin(p)
                setPinNovo('')
                setErroPin('')
              }}
            >
              PIN
            </Botao>
          )}
          {/* Arquivar/excluir é gesto de admin (o banco confere de novo — D-49). */}
          {souAdmin && p.id !== perfil?.id && (
            p.arquivado_em ? (
              <Botao
                variante="secundaria"
                tamanho="sm"
                icone={<RotateCcw />}
                onClick={() => void aoReativar(p)}
              >
                Reativar
              </Botao>
            ) : (
              <>
                <Botao
                  variante="secundaria"
                  tamanho="sm"
                  icone={<Archive />}
                  aria-label={`Arquivar ${p.nome}`}
                  className="toque-seguro px-2"
                  onClick={() => {
                    setErroDestino('')
                    setAlvoArquivar(p)
                  }}
                />
                <Botao
                  variante="perigo"
                  tamanho="sm"
                  icone={<Trash2 />}
                  aria-label={`Excluir ${p.nome}`}
                  className="toque-seguro px-2"
                  onClick={() => {
                    setErroDestino('')
                    setAlvoExcluir(p)
                  }}
                />
              </>
            )
          )}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl">Equipe</h1>
          <p className="mt-1 text-texto-suave">
            {souAdmin
              ? 'Cadastro e convites de toda a fábrica.'
              : 'Cadastro e convites dos setores em que você é líder.'}
          </p>
        </div>
        <span className="flex flex-wrap items-center gap-2">
          {/* D-49: os arquivados moram aqui — fora da lista do dia a dia. */}
          <Botao
            variante="secundaria"
            icone={<Archive />}
            aria-pressed={verArquivados}
            className={verArquivados ? 'border-acao-ativa' : undefined}
            onClick={() => setVerArquivados((v) => !v)}
          >
            {verArquivados ? 'Voltar aos ativos' : `Arquivados (${arquivados.length})`}
          </Botao>
          <Botao icone={<UserRoundPlus />} onClick={() => setModalNovo(true)}>
            Novo usuário
          </Botao>
        </span>
      </div>

      <Tabela
        legenda={verArquivados ? 'Usuários arquivados' : 'Usuários da plataforma'}
        colunas={colunas}
        dados={verArquivados ? arquivados : ativos}
        chaveDe={(p) => p.id}
        tituloCelular={(p) => p.nome}
        vazio={
          carregandoEquipe
            ? 'Carregando…'
            : verArquivados
              ? 'Ninguém arquivado.'
              : 'Ninguém cadastrado ainda.'
        }
      />

      {/* ---------- Novo usuário ---------- */}
      <Modal
        aberto={modalNovo}
        aoFechar={setModalNovo}
        titulo="Novo usuário"
        descricao="A pessoa nasce com a senha padrão e troca no primeiro acesso. A matrícula sai sozinha do CPF."
        tamanho="galpao"
        rodape={
          <>
            <Botao variante="secundaria" onClick={() => setModalNovo(false)}>
              Cancelar
            </Botao>
            <Botao carregando={enviando} onClick={() => void aoCriar()}>
              Cadastrar e gerar convite
            </Botao>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo
            rotulo="Nome completo"
            value={formulario.nome}
            onChange={(e) => setFormulario({ ...formulario, nome: e.target.value })}
          />
          <Campo
            rotulo="CPF"
            inputMode="numeric"
            ajuda="Só os números. A matrícula MDM vem dos 3 primeiros dígitos."
            value={formulario.cpf}
            onChange={(e) => setFormulario({ ...formulario, cpf: e.target.value })}
          />
          <Campo
            rotulo="E-mail"
            type="email"
            value={formulario.email}
            onChange={(e) => setFormulario({ ...formulario, email: e.target.value })}
          />
          <Campo
            rotulo="Nome de usuário"
            autoCapitalize="none"
            ajuda="É com ele que a pessoa entra (ou com o e-mail)."
            value={formulario.usuario}
            onChange={(e) => setFormulario({ ...formulario, usuario: e.target.value })}
          />
          <Campo
            rotulo="Telefone (opcional)"
            inputMode="tel"
            value={formulario.telefone}
            onChange={(e) => setFormulario({ ...formulario, telefone: e.target.value })}
          />
          {souAdmin ? (
            <Selecao
              rotulo="Papel"
              opcoes={[
                { valor: 'operador', rotulo: 'Operador' },
                { valor: 'lider', rotulo: 'Líder' },
                { valor: 'admin', rotulo: 'Admin' },
              ]}
              valor={formulario.papel}
              aoMudar={(v) => setFormulario({ ...formulario, papel: v as Papel })}
            />
          ) : (
            <Campo rotulo="Papel" value="Operador" disabled ajuda="Líder cadastra operadores." />
          )}
          <Campo
            rotulo="PIN do tablet (opcional)"
            inputMode="numeric"
            ajuda="4 a 6 dígitos. Identifica a pessoa no tablet do setor."
            value={formulario.pin}
            onChange={(e) => setFormulario({ ...formulario, pin: e.target.value })}
          />
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-texto">Setores</legend>
          <ul className="mt-2 flex flex-col divide-y divide-borda rounded-dm border border-borda">
            {setoresDisponiveis.map((setor) => {
              const marcado = setoresEscolhidos.has(setor.id)
              const lider = setoresEscolhidos.get(setor.id) ?? false
              return (
                <li key={setor.id} className="flex min-h-toque-md items-center justify-between gap-3 px-3 py-1.5">
                  <label className="flex flex-1 cursor-pointer items-center gap-3 py-1.5">
                    <input
                      type="checkbox"
                      className="size-5 accent-[var(--dm-acao)]"
                      checked={marcado}
                      onChange={() => alternarSetor(setor.id)}
                    />
                    <span className="text-texto">{setor.nome}</span>
                  </label>
                  {souAdmin && marcado && (
                    <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-texto-suave">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--dm-acao)]"
                        checked={lider}
                        onChange={() => alternarLiderDe(setor.id)}
                      />
                      líder deste setor
                    </label>
                  )}
                </li>
              )
            })}
          </ul>
        </fieldset>

        {erroFormulario && (
          <p className="mt-3 text-sm text-danificado-forte" role="alert">
            {erroFormulario}
          </p>
        )}
      </Modal>

      {/* ---------- Convite gerado ---------- */}
      <Modal
        aberto={criado !== null}
        aoFechar={(aberto) => {
          if (!aberto) setCriado(null)
        }}
        titulo="Convite pronto"
        descricao={
          criado
            ? `${criado.nome} foi cadastrado(a) com a matrícula ${criado.matricula}. Mande o link pelo WhatsApp — a senha padrão você fala pessoalmente.`
            : undefined
        }
        rodape={
          <>
            <Botao variante="secundaria" onClick={() => setCriado(null)}>
              Fechar
            </Botao>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(mensagemWhats)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Botao icone={<MessageCircle />} className="w-full sm:w-auto">
                Enviar pelo WhatsApp
              </Botao>
            </a>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="rounded-dm border border-borda bg-superficie-sutil p-3 text-sm break-all text-texto">
            {linkConvite}
          </p>
          <Botao
            variante="secundaria"
            icone={linkCopiado ? <Check /> : <Copy />}
            onClick={() => void copiarLink()}
          >
            {linkCopiado ? 'Copiado' : 'Copiar link'}
          </Botao>
        </div>
      </Modal>

      {/* ---------- Definir PIN ---------- */}
      <Modal
        aberto={alvoPin !== null}
        aoFechar={(aberto) => {
          if (!aberto) setAlvoPin(null)
        }}
        titulo={alvoPin ? `PIN de ${alvoPin.nome}` : 'PIN'}
        descricao="O PIN identifica a pessoa no tablet compartilhado do setor. Ele é guardado protegido — ninguém consegue lê-lo depois."
        rodape={
          <>
            <Botao variante="secundaria" onClick={() => setAlvoPin(null)}>
              Cancelar
            </Botao>
            <Botao carregando={salvandoPin} onClick={() => void aoSalvarPin()}>
              Salvar PIN
            </Botao>
          </>
        }
      >
        <Campo
          rotulo="PIN novo"
          inputMode="numeric"
          type="password"
          ajuda="4 a 6 dígitos, só números."
          value={pinNovo}
          onChange={(e) => setPinNovo(e.target.value)}
          erro={erroPin || undefined}
        />
      </Modal>

      {/* ---------- Arquivar usuário (D-49) ---------- */}
      <Modal
        aberto={alvoArquivar !== null}
        aoFechar={(aberto) => {
          if (!aberto) setAlvoArquivar(null)
        }}
        titulo={alvoArquivar ? `Arquivar ${alvoArquivar.nome}` : 'Arquivar'}
        descricao="A pessoa perde o acesso, mas tudo o que ela fez continua registrado no nome dela."
        rodape={
          <>
            <Botao variante="secundaria" onClick={() => setAlvoArquivar(null)}>
              Cancelar
            </Botao>
            <Botao icone={<Archive />} carregando={processando} onClick={() => void aoArquivar()}>
              Arquivar agora
            </Botao>
          </>
        }
      >
        <div className="flex flex-col gap-2 text-sm text-texto">
          <p>No ato do arquivamento:</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-texto-suave">
            <li>
              <strong className="text-texto">Execução aberta é encerrada</strong> — o tempo até
              aqui fica no nome dela.
            </li>
            <li>
              <strong className="text-texto">Cards delegados e tarefas abertas passam ao líder
              direto</strong> do setor de cada um, para realocar (sem líder, vêm para você).
            </li>
            <li>Dá para reativar depois — as pendências realocadas não voltam.</li>
          </ul>
          {erroDestino && (
            <p className="text-danificado-forte" role="alert">
              {erroDestino}
            </p>
          )}
        </div>
      </Modal>

      {/* ---------- Excluir usuário (D-49) ---------- */}
      <Modal
        aberto={alvoExcluir !== null}
        aoFechar={(aberto) => {
          if (!aberto) setAlvoExcluir(null)
        }}
        titulo={alvoExcluir ? `Excluir ${alvoExcluir.nome}` : 'Excluir'}
        descricao="Excluir apaga de verdade — não tem volta."
        rodape={
          <>
            <Botao variante="secundaria" onClick={() => setAlvoExcluir(null)}>
              Cancelar
            </Botao>
            <Botao
              variante="perigo"
              icone={<Trash2 />}
              carregando={processando}
              onClick={() => void aoExcluir()}
            >
              Excluir de vez
            </Botao>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm text-texto">
          <p>
            Somem de verdade: o cadastro, os vínculos com setores, as tarefas dela, a foto e a
            conta de acesso. Serve para <strong>cadastro errado ou nunca usado</strong> — quem já
            tem história na plataforma não pode ser excluído (a história não se apaga); para
            esses, o caminho é arquivar.
          </p>
          {erroDestino && (
            <div className="flex flex-col gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo p-3">
              <p className="text-atencao-texto" role="alert">
                {erroDestino}
              </p>
              {/* O "não" do sistema vem com a saída certa (padrão da casa). */}
              {alvoExcluir && /história/i.test(erroDestino) && (
                <Botao
                  icone={<Archive />}
                  className="self-start"
                  onClick={() => {
                    const pessoa = alvoExcluir
                    setAlvoExcluir(null)
                    setErroDestino('')
                    setAlvoArquivar(pessoa)
                  }}
                >
                  Arquivar em vez disso
                </Botao>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
