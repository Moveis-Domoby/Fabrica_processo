import { supabase } from '../supabase';
import { addDiasUteisSemDomingo, addDiasCorridos } from './timers';
import type { ListaDisparoMembro, ListaDisparo, StatusMembroDisparo, StatusListaDisparo } from '../../types';
import { normalizarTelefone } from '../utils/phone';
import { DISPARO_LIBERADO, MOTIVO_DISPARO_TRAVADO } from '../../travas';

export async function registrarEnvio(membro: ListaDisparoMembro, janelaRespostaDias: number) {
  const dataEnvio = new Date();
  const prazoResposta = addDiasUteisSemDomingo(dataEnvio, janelaRespostaDias);

  const { error: membroError } = await supabase
    .from('listas_disparo_membros')
    .update({
      status: 'aguardando_resposta',
      data_envio: dataEnvio.toISOString(),
      prazo_resposta_limite: prazoResposta.toISOString()
    })
    .eq('id', membro.id);

  if (membroError) throw membroError;

  const { error: eventoError } = await supabase
    .from('listas_disparo_eventos')
    .insert({
      lista_id: membro.lista_id,
      tipo_evento: 'envio_registrado',
      descricao: `Envio registrado para ${membro.nome_cliente || membro.telefone}`
    });

  if (eventoError) throw eventoError;
}

export async function registrarResposta(membro: ListaDisparoMembro, janelaResultadoDias: number) {
  const dataResposta = new Date();
  const prazoResultado = addDiasCorridos(dataResposta, janelaResultadoDias);

  const { error: membroError } = await supabase
    .from('listas_disparo_membros')
    .update({
      status: 'respondido_aguardando_resultado',
      data_resposta: dataResposta.toISOString(),
      prazo_resultado_limite: prazoResultado.toISOString()
    })
    .eq('id', membro.id);

  if (membroError) throw membroError;

  const { error: eventoError } = await supabase
    .from('listas_disparo_eventos')
    .insert({
      lista_id: membro.lista_id,
      tipo_evento: 'resposta_recebida',
      descricao: `Resposta recebida de ${membro.nome_cliente || membro.telefone}`
    });

  if (eventoError) throw eventoError;
}

export async function criarListaRascunho(nome: string, membros: any[]): Promise<ListaDisparo> {
  const novaLista = {
    nome,
    status: 'rascunho' as StatusListaDisparo,
    janela_resposta_dias: 3, // 3 dias úteis
    janela_resultado_dias: 7,
    custo_disparo: 0,
  };

  const { data: lista, error: listaError } = await supabase
    .from('listas_disparo')
    .insert(novaLista)
    .select()
    .single();

  if (listaError) throw listaError;

  const membrosParaInserir = membros.map(m => ({
    lista_id: lista.id,
    nome_cliente: m.nome,
    telefone: normalizarTelefone(m.telefone),
    status: 'aguardando_envio' as StatusMembroDisparo,
    snapshot_total_gasto: m.faturamento_total,
    snapshot_qtd_compras: m.quantidade_pedidos,
    snapshot_ultima_compra: m.ultima_compra.toISOString()
  }));

  // [DT-D8] upsert com ignoreDuplicates em vez de insert: antes, um único
  // telefone duplicado (violando UNIQUE (lista_id, telefone)) abortava o
  // lote inteiro e a lista já criada no passo anterior ficava vazia e órfã.
  const { error: membrosError, count: membrosInseridos } = await supabase
    .from('listas_disparo_membros')
    .upsert(membrosParaInserir, { onConflict: 'lista_id,telefone', ignoreDuplicates: true, count: 'exact' });

  if (membrosError) throw membrosError;

  const duplicados = membrosParaInserir.length - (membrosInseridos ?? membrosParaInserir.length);
  const { error: eventoError } = await supabase
    .from('listas_disparo_eventos')
    .insert({
      lista_id: lista.id,
      tipo_evento: 'lista_criada',
      descricao: duplicados > 0
        ? `Lista "${nome}" criada com ${membrosInseridos ?? membros.length} membros (${duplicados} telefone(s) duplicado(s) ignorado(s))`
        : `Lista "${nome}" criada com ${membros.length} membros`
    });

  if (eventoError) throw eventoError;

  return lista as ListaDisparo;
}

export async function salvarMensagem(listaId: string, mensagem: string) {
  const { error } = await supabase
    .from('listas_disparo')
    .update({ mensagem_utilizada: mensagem })
    .eq('id', listaId);
  
  if (error) throw error;
}

export async function iniciarFila(listaId: string, intervaloSegundos: number, tarifaAplicada?: number): Promise<void> {
  // Trava da união (D-46): marcar a lista como `disparando` é armar a fila —
  // no cutover o cron nasce e mandaria tudo. Até lá, nenhum caminho passa.
  if (!DISPARO_LIBERADO) {
    throw new Error(MOTIVO_DISPARO_TRAVADO);
  }
  // Update list with the interval and optional message cost
  const payload: any = { 
    status: 'disparando', 
    intervalo_disparo_segundos: intervaloSegundos 
  };
  
  if (tarifaAplicada !== undefined) {
    payload.tarifa_aplicada = tarifaAplicada;
  }

  const { error: listaError } = await supabase
    .from('listas_disparo')
    .update(payload)
    .eq('id', listaId);

  if (listaError) throw listaError;

  const { error: eventoError } = await supabase
    .from('listas_disparo_eventos')
    .insert({
      lista_id: listaId,
      tipo_evento: 'envio_registrado',
      descricao: `Fila de disparo iniciada — um envio a cada ${intervaloSegundos}s.`,
    });

  if (eventoError) throw eventoError;
}


export async function finalizarDisparo(listaId: string) {
  // Para a fila imediatamente (status -> em_andamento)
  // Os timers de resposta/resultado continuam correndo normalmente
  const { error } = await supabase
    .from('listas_disparo')
    .update({ status: 'em_andamento' })
    .eq('id', listaId);

  if (error) throw error;

  await supabase.from('listas_disparo_eventos').insert({
    lista_id: listaId,
    tipo_evento: 'lista_encerrada',
    descricao: 'Disparo interrompido manualmente — fila encerrada antes do fim. Membros já enviados continuam com seus timers ativos.',
  });
}

export async function encerrarLista(listaId: string) {
  // Encerra completamente: congela tudo, dados consolidados, sem mais ações

  // 1) Fecha imediatamente todos os membros ainda pendentes
  const agora = new Date().toISOString();
  const { error: membrosError } = await supabase
    .from('listas_disparo_membros')
    .update({
      status: 'perdido',
      motivo_perda: 'lista_encerrada_manualmente',
      data_resultado: agora,
    })
    .eq('lista_id', listaId)
    .in('status', ['aguardando_envio', 'aguardando_resposta', 'respondido_aguardando_resultado']);

  if (membrosError) throw membrosError;

  // 2) Fecha a lista
  const { error } = await supabase
    .from('listas_disparo')
    .update({ status: 'encerrada' })
    .eq('id', listaId);

  if (error) throw error;

  await supabase.from('listas_disparo_eventos').insert({
    lista_id: listaId,
    tipo_evento: 'lista_encerrada',
    descricao: 'Lista encerrada manualmente. Membros pendentes encerrados como perdido. Dados consolidados — nenhum envio ou contagem adicional será realizado.',
  });
}


export async function adicionarMembrosALista(listaId: string, membros: any[]) {
  const membrosParaInserir = membros.map(m => ({
    lista_id: listaId,
    nome_cliente: m.nome,
    telefone: normalizarTelefone(m.telefone),
    status: 'aguardando_envio' as StatusMembroDisparo,
    snapshot_total_gasto: m.faturamento_total,
    snapshot_qtd_compras: m.quantidade_pedidos,
    snapshot_ultima_compra: m.ultima_compra.toISOString()
  }));

  // [DT-D8] upsert com ignoreDuplicates — mesmo motivo de criarListaRascunho:
  // um telefone já existente na lista não pode abortar o lote inteiro.
  const { error: membrosError, count: membrosInseridos } = await supabase
    .from('listas_disparo_membros')
    .upsert(membrosParaInserir, { onConflict: 'lista_id,telefone', ignoreDuplicates: true, count: 'exact' });

  if (membrosError) throw membrosError;

  const duplicados = membrosParaInserir.length - (membrosInseridos ?? membrosParaInserir.length);
  const { error: eventoError } = await supabase
    .from('listas_disparo_eventos')
    .insert({
      lista_id: listaId,
      tipo_evento: 'membros_adicionados',
      descricao: duplicados > 0
        ? `Foram adicionados ${membrosInseridos ?? membros.length} novos membros à lista (${duplicados} telefone(s) já estavam na lista e foram ignorados).`
        : `Foram adicionados ${membros.length} novos membros à lista.`
    });

  if (eventoError) throw eventoError;
}

export async function removerMembroDaLista(membroId: string, listaId: string, nomeCliente: string) {
  const { error } = await supabase
    .from('listas_disparo_membros')
    .delete()
    .eq('id', membroId);
    
  if (error) throw error;
  
  await supabase
    .from('listas_disparo_eventos')
    .insert({
      lista_id: listaId,
      tipo_evento: 'membro_removido',
      descricao: `Membro ${nomeCliente} foi removido da lista.`
    });
}

export async function removerMembrosDaListaBulk(membroIds: string[], listaId: string) {
  const { error } = await supabase
    .from('listas_disparo_membros')
    .delete()
    .in('id', membroIds);
    
  if (error) throw error;
  
  await supabase
    .from('listas_disparo_eventos')
    .insert({
      lista_id: listaId,
      tipo_evento: 'membros_removidos',
      descricao: `Foram removidos ${membroIds.length} membros da lista.`
    });
}
