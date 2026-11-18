import { Botao, Modal } from '@/componentes/ui';

export interface ModalConfirmacaoProps {
  aberto: boolean;
  titulo: string;
  /** O que acontece se a pessoa confirmar — a mesma frase que o navegador mostrava. */
  descricao?: string;
  /** O verbo do gesto ("Excluir lista", "Parar o disparo") — nunca um "OK" solto. */
  rotuloConfirmar: string;
  rotuloCancelar?: string;
  /** Gesto que destrói (excluir, remover, encerrar) — o botão fica vermelho. */
  perigo?: boolean;
  /** Enquanto o gesto roda: o botão gira e a janela não fecha. */
  carregando?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}

/**
 * SESSAO-54 (DT-D24): a janela de confirmação do Comercial — o modal da casa no
 * lugar da pergunta nativa do navegador. Uma decisão curta, com botão de
 * toque: no celular sobe do rodapé e o gesto fica em cima, no alcance do polegar.
 * Fechar pelo X, pelo ESC ou por fora vale como "Voltar" (nada acontece).
 */
export function ModalConfirmacao({
  aberto,
  titulo,
  descricao,
  rotuloConfirmar,
  rotuloCancelar = 'Voltar',
  perigo = false,
  carregando = false,
  aoConfirmar,
  aoCancelar,
}: ModalConfirmacaoProps) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={(abrir) => {
        if (!abrir && !carregando) aoCancelar();
      }}
      titulo={titulo}
      rodape={
        <>
          <Botao variante="secundaria" tamanho="lg" disabled={carregando} onClick={aoCancelar}>
            {rotuloCancelar}
          </Botao>
          <Botao
            variante={perigo ? 'perigo' : 'primaria'}
            tamanho="lg"
            carregando={carregando}
            onClick={aoConfirmar}
          >
            {rotuloConfirmar}
          </Botao>
        </>
      }
    >
      {/* a explicação no corpo da janela (o corpo vazio deixaria uma faixa em branco) */}
      <p className="text-base text-texto">{descricao ?? 'Confirme para continuar.'}</p>
    </Modal>
  );
}
