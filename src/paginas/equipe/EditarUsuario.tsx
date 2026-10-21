import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Cake, Check, Handshake, ImageUp, KeyRound, RotateCcw, Trash2 } from 'lucide-react'
import { AvatarPessoa, Botao, Campo, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { supabase } from '@/lib/supabase'
import { editarUsuario, pinDefinir } from '@/autenticacao/api'
import { ehSoEntregador } from '@/autenticacao/tipos'
import type { Papel, Perfil } from '@/autenticacao/tipos'
import { definirEntregador } from '@/rotas/api'
import { definirNascimento, enviarFotoPerfil, lerNascimento } from '@/perfil/api'
import { reduzirImagem } from '@/lib/imagem'
import type { Setor } from '@/kanban/tipos'

/** A linha da Equipe com os vínculos (a caneta precisa saber os setores e quem é líder). */
export interface PessoaDaEquipe extends Perfil {
  setores: string
  vinculos: { setor_id: number; lider: boolean }[]
}

const OPCOES_NIVEL = [
  { valor: 'operador', rotulo: 'Operador' },
  // SESSAO-37 (D-147): só os setores de produção, chat e afazeres.
  { valor: 'producao', rotulo: 'Linha de produção' },
  // SESSAO-37 (D-147): produção só de olhar + módulo de logística.
  { valor: 'logistica', rotulo: 'Logística' },
  { valor: 'lider', rotulo: 'Líder' },
  { valor: 'admin', rotulo: 'Admin' },
  // SESSAO-30 (D-115): vê só "Entregas do dia".
  { valor: 'entregador', rotulo: 'Entregador (só ROTAS)' },
]

/**
 * A CANETA da Equipe (pedido do dono, 19/10 — "remova essas opções laterais e
 * deixe apenas uma caneta para editar qualquer informação do usuário"): tudo
 * de uma pessoa num lugar só — foto, dados, nível, setores (e quem é líder),
 * auxiliar em todo setor, PIN, aniversário e, no fim, arquivar/excluir.
 * O líder vê só o PIN (como antes); o resto é do admin — e o servidor confere.
 */
export function EditarUsuario({
  pessoa,
  setores,
  souAdmin,
  meuId,
  aoFechar,
  aoArquivar,
  aoExcluir,
  aoReativar,
}: {
  pessoa: PessoaDaEquipe
  setores: Setor[]
  souAdmin: boolean
  meuId: string | undefined
  aoFechar: () => void
  aoArquivar: (p: PessoaDaEquipe) => void
  aoExcluir: (p: PessoaDaEquipe) => void
  aoReativar: (p: PessoaDaEquipe) => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const arquivado = pessoa.arquivado_em !== null
  const eraEntregador = ehSoEntregador(pessoa)

  const [nome, setNome] = useState(pessoa.nome)
  const [usuario, setUsuario] = useState(pessoa.usuario)
  const [email, setEmail] = useState(pessoa.email)
  const [telefone, setTelefone] = useState(pessoa.telefone ?? '')
  const [nivel, setNivel] = useState<string>(eraEntregador ? 'entregador' : pessoa.papel)
  const [vinculos, setVinculos] = useState<Map<number, boolean>>(
    () => new Map(pessoa.vinculos.map((v) => [v.setor_id, v.lider])),
  )
  const [podeAuxiliar, setPodeAuxiliar] = useState(Boolean(pessoa.pode_auxiliar))
  const [pin, setPin] = useState('')
  const [nascimentoEditado, setNascimentoEditado] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const entradaFoto = useRef<HTMLInputElement>(null)

  const nascimento = useQuery({
    queryKey: ['equipe', 'nascimento', pessoa.id],
    queryFn: () => lerNascimento(pessoa.id),
    enabled: souAdmin,
    gcTime: 0,
  })
  const valorNascimento = nascimentoEditado ?? nascimento.data ?? ''

  const reler = () => clienteQuery.invalidateQueries({ queryKey: ['equipe'] })
  const falhou = (titulo: string) => (e: unknown) =>
    notificar({ titulo, descricao: e instanceof Error ? e.message : undefined, tom: 'danificado' })

  // ---------- salvar o cadastro (dados + nível + setores + auxiliar + aniversário) ----------
  const salvar = useMutation({
    mutationFn: async () => {
      const entregador = nivel === 'entregador'
      const papel = (entregador ? 'operador' : nivel) as Papel
      const lista = new Map(vinculos)
      // o entregador fica ligado à ROTAS (o banco confere de novo)
      const rotas = setores.find((s) => s.codigo === 'rotas')
      if (entregador && rotas) lista.set(rotas.id, lista.get(rotas.id) ?? false)
      await editarUsuario({
        usuario_id: pessoa.id,
        nome: nome.trim(),
        usuario: usuario.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        telefone: telefone.trim() || undefined,
        papel,
        setores: [...lista.entries()].map(([setor_id, lider]) => ({ setor_id, lider })),
      })
      if (entregador !== eraEntregador) await definirEntregador(pessoa.id, entregador)
      if (podeAuxiliar !== Boolean(pessoa.pode_auxiliar)) {
        const { error } = await supabase.rpc('plt_fn_usuario_pode_auxiliar', {
          p_usuario: pessoa.id,
          p_pode: podeAuxiliar,
        })
        if (error) throw new Error(error.message)
      }
      if (nascimentoEditado !== null) await definirNascimento(pessoa.id, nascimentoEditado || null)
    },
    onSuccess: async () => {
      notificar({ titulo: `Cadastro de ${nome.trim()} salvo`, tom: 'perfeito' })
      await reler()
      aoFechar()
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'Não deu certo. Tente de novo.'),
  })

  function aoSalvar() {
    setErro('')
    if (!nome.trim()) return setErro('Informe o nome.')
    if (!/^[a-z0-9._-]{3,32}$/.test(usuario.trim().toLowerCase()))
      return setErro('Nome de usuário: 3 a 32 caracteres, só letras, números, ponto, hífen ou underline.')
    if (!email.includes('@')) return setErro('Informe um e-mail válido.')
    if (!['admin', 'logistica'].includes(nivel) && nivel !== 'entregador' && vinculos.size === 0)
      return setErro('Escolha pelo menos um setor.')
    salvar.mutate()
  }

  // ---------- PIN (admin e líder) ----------
  const gravarPin = useMutation({
    mutationFn: () => pinDefinir(pessoa.id, pin),
    onSuccess: () => {
      notificar({ titulo: `PIN de ${pessoa.nome} definido`, tom: 'perfeito' })
      setPin('')
    },
    onError: falhou('Não deu para gravar o PIN'),
  })

  // ---------- foto (admin) ----------
  const gravarFoto = useMutation({
    mutationFn: async (arquivo: File) => {
      const reduzida = await reduzirImagem(arquivo, 512)
      const final = new File([reduzida.dados], `foto.${reduzida.extensao}`, {
        type: reduzida.dados.type || arquivo.type,
      })
      await enviarFotoPerfil(pessoa.id, final, pessoa.foto_caminho)
    },
    onSuccess: async () => {
      notificar({ titulo: `Foto de ${pessoa.nome} gravada`, tom: 'perfeito' })
      await reler()
    },
    onError: falhou('Não deu para gravar a foto'),
  })

  function alternarSetor(id: number) {
    setVinculos((atual) => {
      const novo = new Map(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.set(id, false)
      return novo
    })
  }
  function alternarLider(id: number) {
    setVinculos((atual) => {
      const novo = new Map(atual)
      if (novo.has(id)) novo.set(id, !novo.get(id))
      return novo
    })
  }

  const ehEu = pessoa.id === meuId

  return (
    <Modal
      aberto
      aoFechar={(v) => !v && aoFechar()}
      titulo={`Editar ${pessoa.nome}`}
      descricao={`Matrícula ${pessoa.matricula}${arquivado ? ' · arquivado(a)' : ''}`}
      tamanho="galpao"
      rodape={
        souAdmin && !arquivado ? (
          <>
            <Botao variante="secundaria" onClick={aoFechar}>
              Cancelar
            </Botao>
            <Botao icone={<Check />} carregando={salvar.isPending} onClick={aoSalvar}>
              Salvar alterações
            </Botao>
          </>
        ) : (
          <Botao variante="secundaria" onClick={aoFechar}>
            Fechar
          </Botao>
        )
      }
    >
      <div className="flex flex-col gap-5">
        {/* ---------- foto ---------- */}
        <div className="flex items-center gap-3">
          <AvatarPessoa nome={pessoa.nome} foto={pessoa.foto_caminho} tamanho="lg" />
          {souAdmin && !arquivado && (
            <>
              <input
                ref={entradaFoto}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const arquivo = e.target.files?.[0]
                  e.target.value = ''
                  if (arquivo) gravarFoto.mutate(arquivo)
                }}
              />
              <Botao
                variante="secundaria"
                tamanho="sm"
                icone={<ImageUp />}
                carregando={gravarFoto.isPending}
                onClick={() => entradaFoto.current?.click()}
              >
                Trocar foto
              </Botao>
            </>
          )}
        </div>

        {/* ---------- dados, nível e setores (admin) ---------- */}
        {souAdmin && !arquivado && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo rotulo="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
              <Campo
                rotulo="Nome de usuário"
                autoCapitalize="none"
                ajuda="É com ele que a pessoa entra (ou com o e-mail)."
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
              />
              <Campo
                rotulo="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Campo
                rotulo="Telefone (opcional)"
                inputMode="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
              <Selecao
                rotulo="Nível de acesso"
                opcoes={OPCOES_NIVEL}
                valor={nivel}
                aoMudar={setNivel}
              />
              <Campo
                rotulo="Aniversário"
                type="date"
                prefixo={<Cake />}
                min="1900-01-01"
                max={new Date().toLocaleDateString('en-CA', { timeZone: 'America/Fortaleza' })}
                value={valorNascimento}
                disabled={nascimento.isPending}
                ajuda="O chat publica os parabéns no dia. Em branco = sem data."
                onChange={(e) => setNascimentoEditado(e.target.value)}
              />
            </div>
            {ehEu && nivel !== 'admin' && (
              <p className="text-sm text-atencao-texto">
                Você não pode tirar o seu próprio nível de admin — peça a outro admin.
              </p>
            )}

            <fieldset>
              <legend className="text-sm font-medium text-texto">
                Setores
                {['admin', 'logistica'].includes(nivel) && (
                  <span className="ml-1 font-normal text-texto-fraco">(opcional neste nível)</span>
                )}
              </legend>
              <ul className="mt-2 flex flex-col divide-y divide-borda rounded-dm border border-borda">
                {setores.map((setor) => {
                  const marcado = vinculos.has(setor.id)
                  const lider = vinculos.get(setor.id) ?? false
                  return (
                    <li
                      key={setor.id}
                      className="flex min-h-toque-md items-center justify-between gap-3 px-3 py-1.5"
                    >
                      <label className="flex flex-1 cursor-pointer items-center gap-3 py-1.5">
                        <input
                          type="checkbox"
                          className="size-5 accent-[var(--dm-acao)]"
                          checked={marcado}
                          onChange={() => alternarSetor(setor.id)}
                        />
                        <span className="text-texto">{setor.nome}</span>
                      </label>
                      {marcado && (
                        <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-texto-suave">
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--dm-acao)]"
                            checked={lider}
                            onChange={() => alternarLider(setor.id)}
                          />
                          líder deste setor
                        </label>
                      )}
                    </li>
                  )
                })}
              </ul>
            </fieldset>

            <label className="flex cursor-pointer items-center gap-3 rounded-dm border border-borda px-3 py-2">
              <input
                type="checkbox"
                className="size-5 accent-[var(--dm-acao)]"
                checked={podeAuxiliar}
                onChange={(e) => setPodeAuxiliar(e.target.checked)}
              />
              <Handshake aria-hidden className="size-4 text-texto-suave" />
              <span className="text-sm text-texto">
                Pode ajudar em qualquer setor{' '}
                <span className="text-texto-suave">(não só nos dele)</span>
              </span>
            </label>

            {erro && (
              <p className="text-sm text-danificado-forte" role="alert">
                {erro}
              </p>
            )}
          </>
        )}

        {/* ---------- PIN (admin e líder) ---------- */}
        {!arquivado && (
          <form
            className="flex flex-wrap items-end gap-2 rounded-dm border border-borda p-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (/^[0-9]{2,4}$/.test(pin)) gravarPin.mutate()
            }}
          >
            <div className="w-40">
              <Campo
                rotulo="PIN novo"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                placeholder="2 a 4 dígitos"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </div>
            <Botao
              type="submit"
              variante="secundaria"
              icone={<KeyRound />}
              carregando={gravarPin.isPending}
              disabled={!/^[0-9]{2,4}$/.test(pin)}
            >
              Gravar PIN
            </Botao>
            <p className="w-full text-xs text-texto-fraco">
              Identifica a pessoa no tablet do setor. Ninguém consegue ler o PIN depois — para
              trocar, grave um novo. Não pode repetir o PIN de outra pessoa nem de um setor.
            </p>
          </form>
        )}

        {/* ---------- arquivar / excluir / reativar (admin, nunca a si mesmo) ---------- */}
        {souAdmin && !ehEu && (
          <div className="flex flex-wrap items-center gap-2 border-t border-borda pt-4">
            {arquivado ? (
              <Botao variante="secundaria" icone={<RotateCcw />} onClick={() => aoReativar(pessoa)}>
                Reativar
              </Botao>
            ) : (
              <>
                <Botao variante="secundaria" icone={<Archive />} onClick={() => aoArquivar(pessoa)}>
                  Arquivar
                </Botao>
                <Botao variante="perigo" icone={<Trash2 />} onClick={() => aoExcluir(pessoa)}>
                  Excluir
                </Botao>
              </>
            )}
            <span className="text-xs text-texto-fraco">
              Arquivar tira o acesso e guarda tudo no nome dela; excluir só vale para quem ainda não
              tem nada registrado.
            </span>
          </div>
        )}
      </div>
    </Modal>
  )
}
