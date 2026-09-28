import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Hash, X } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { abrirParticular, criarCanal } from '../api'
import { chaveConversa } from '../consultas'
import type { ConversaResumo, Pessoa } from '../tipos'
import { SeletorPessoas } from './SeletorPessoas'

/** O resumo local de uma conversa recém-aberta — nada é relido para mostrá-la. */
function resumoLocal(parcial: Partial<ConversaResumo> & Pick<ConversaResumo, 'conversa_id' | 'tipo'>): ConversaResumo {
  return {
    titulo: null,
    foto_caminho: null,
    outro_id: null,
    outro_ativo: null,
    papel: 'membro',
    pode_escrever: true,
    administra: false,
    membros: 2,
    atividade_em: new Date().toISOString(),
    ultima_id: null,
    ultima_previa: null,
    ultima_autor_id: null,
    ultima_autor_nome: null,
    ultima_lida_id: 0,
    nao_lidas: 0,
    total_nao_lidas: null,
    ...parcial,
  }
}

/** Nova conversa particular: escolhe a pessoa e a conversa abre (a mesma, se já existir). */
export function ModalNovaConversa({
  eu,
  aberto,
  aoFechar,
  aoAbrir,
}: {
  eu: string
  aberto: boolean
  aoFechar: () => void
  aoAbrir: (conversaId: number) => void
}) {
  const clienteQuery = useQueryClient()
  const notificar = useNotificacao()
  const abrir = useMutation({
    mutationFn: (pessoa: Pessoa) => abrirParticular(pessoa.id).then((id) => ({ id, pessoa })),
    onSuccess: ({ id, pessoa }) => {
      clienteQuery.setQueryData(
        chaveConversa(eu, id),
        resumoLocal({
          conversa_id: id,
          tipo: 'particular',
          titulo: pessoa.nome,
          foto_caminho: pessoa.foto_caminho,
          outro_id: pessoa.id,
          outro_ativo: true,
        }),
      )
      aoFechar()
      aoAbrir(id)
    },
    onError: (e) => notificar({ titulo: 'Não deu para abrir a conversa', descricao: e.message, tom: 'danificado' }),
  })

  return (
    <Modal
      aberto={aberto}
      aoFechar={(v) => !v && aoFechar()}
      titulo="Nova conversa"
      descricao="Escolha com quem conversar. Só vocês dois leem a conversa."
    >
      <SeletorPessoas
        eu={eu}
        multiplo={false}
        selecionados={abrir.variables ? [abrir.variables.id] : []}
        aoAlternar={(pessoa) => !abrir.isPending && abrir.mutate(pessoa)}
      />
    </Modal>
  )
}

/** Novo canal (só líder e admin — o banco confere): nome + quem entra. Quem cria administra. */
export function ModalNovoCanal({
  eu,
  aberto,
  aoFechar,
  aoCriar,
}: {
  eu: string
  aberto: boolean
  aoFechar: () => void
  aoCriar: (conversaId: number) => void
}) {
  const clienteQuery = useQueryClient()
  const [nome, setNome] = useState('')
  const [escolhidos, setEscolhidos] = useState<Pessoa[]>([])
  const [erro, setErro] = useState('')

  const criar = useMutation({
    mutationFn: () => criarCanal(nome.trim(), escolhidos.map((p) => p.id)),
    onSuccess: (id) => {
      clienteQuery.setQueryData(
        chaveConversa(eu, id),
        resumoLocal({
          conversa_id: id,
          tipo: 'canal',
          titulo: nome.trim(),
          papel: 'administrador',
          administra: true,
          membros: escolhidos.length + 1,
        }),
      )
      // A lista NÃO é relida aqui: o sinal "entrou" chega pelo websocket (o
      // criador também recebe) e relê a 1ª página uma vez só — medido ao vivo.
      setNome('')
      setEscolhidos([])
      aoFechar()
      aoCriar(id)
    },
    onError: (e) => setErro(e.message),
  })

  function alternar(pessoa: Pessoa) {
    setEscolhidos((atual) =>
      atual.some((p) => p.id === pessoa.id) ? atual.filter((p) => p.id !== pessoa.id) : [...atual, pessoa],
    )
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={(v) => !v && aoFechar()}
      titulo="Novo canal"
      descricao="Um canal de grupo. Você administra: muda o nome, põe e tira pessoas."
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            icone={<Hash />}
            carregando={criar.isPending}
            onClick={() => {
              setErro('')
              if (!nome.trim()) {
                setErro('Dê um nome ao canal.')
                return
              }
              criar.mutate()
            }}
          >
            Criar canal
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo
          rotulo="Nome do canal"
          prefixo={<Hash />}
          maxLength={60}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          erro={erro || undefined}
        />
        {escolhidos.length > 0 && (
          <ul aria-label="Quem vai entrar" className="flex flex-wrap gap-1.5">
            {escolhidos.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => alternar(p)}
                  aria-label={`Tirar ${p.nome}`}
                  className="inline-flex min-h-toque-md items-center gap-1 rounded-full border border-borda-forte bg-superficie-sutil px-3 text-sm text-texto hover:bg-superficie"
                >
                  {p.nome.split(' ')[0]}
                  <X aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <SeletorPessoas
          eu={eu}
          multiplo
          selecionados={escolhidos.map((p) => p.id)}
          aoAlternar={alternar}
        />
      </div>
    </Modal>
  )
}
