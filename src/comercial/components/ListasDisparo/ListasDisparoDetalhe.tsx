import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { ListaDisparo, ListaDisparoMembro, ListaDisparoEvento, ScorecardsLista } from '../../types';
import { differenceInSeconds } from 'date-fns';
import { ArrowLeft, Save, Copy, Send, Download, Clock, CheckCircle2, XCircle, Trash2, History, Check, Loader2, StopCircle, Flag, Pencil, X } from 'lucide-react';
import { salvarMensagem, removerMembrosDaListaBulk, iniciarFila, finalizarDisparo, encerrarLista } from '../../lib/disparo/api';
import Papa from 'papaparse';
import { AuditoriaModal } from './AuditoriaModal';
import { DispararModal } from './DispararModal';
import { MembroAuditoriaModal } from './MembroAuditoriaModal';
import { DISPARO_LIBERADO, MOTIVO_DISPARO_TRAVADO } from '../../travas';

interface ListasDisparoDetalheProps {
  listaId: string;
  onBack: () => void;
}

export function ListasDisparoDetalhe({ listaId, onBack }: ListasDisparoDetalheProps) {
  const [lista, setLista] = useState<ListaDisparo | null>(null);
  const [membros, setMembros] = useState<ListaDisparoMembro[]>([]);
  const [eventos, setEventos] = useState<ListaDisparoEvento[]>([]);
  const [scorecards, setScorecards] = useState<ScorecardsLista | null>(null);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState('');
  const [isSavingMsg, setIsSavingMsg] = useState(false);
  const [isAuditoriaOpen, setIsAuditoriaOpen] = useState(false);
  const [isDispararOpen, setIsDispararOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isEditingNome, setIsEditingNome] = useState(false);
  const [nomeEditado, setNomeEditado] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [membroAuditoria, setMembroAuditoria] = useState<ListaDisparoMembro | null>(null);

  // Fetch completo com loading spinner — usado apenas na carga inicial
  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: listaData } = await supabase.from('listas_disparo').select('*').eq('id', listaId).single();
    if (listaData) {
      setLista(listaData as ListaDisparo);
      setMensagem(listaData.mensagem_utilizada || '');
    }
    const { data: scoreData } = await supabase.from('vw_scorecards_lista').select('*').eq('lista_id', listaId).single();
    if (scoreData) setScorecards(scoreData as ScorecardsLista);
    const { data: membrosData } = await supabase.from('listas_disparo_membros').select('*').eq('lista_id', listaId).order('nome_cliente');
    if (membrosData) setMembros(membrosData as ListaDisparoMembro[]);
    const { data: eventosData } = await supabase.from('listas_disparo_eventos').select('*').eq('lista_id', listaId).order('criado_em', { ascending: false });
    if (eventosData) setEventos(eventosData as ListaDisparoEvento[]);
    setLoading(false);
  }, [listaId]);

  // Fetch silencioso — sem spinner, usado pelo polling para evitar piscar a tela
  const fetchDataSilent = useCallback(async () => {
    const { data: listaData } = await supabase.from('listas_disparo').select('*').eq('id', listaId).single();
    if (listaData) {
      setLista(listaData as ListaDisparo);
      setMensagem(prev => prev || listaData.mensagem_utilizada || '');
    }
    const { data: scoreData } = await supabase.from('vw_scorecards_lista').select('*').eq('lista_id', listaId).single();
    if (scoreData) setScorecards(scoreData as ScorecardsLista);
    const { data: membrosData } = await supabase.from('listas_disparo_membros').select('*').eq('lista_id', listaId).order('nome_cliente');
    if (membrosData) setMembros(membrosData as ListaDisparoMembro[]);
  }, [listaId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling silencioso a cada 8s enquanto a lista estiver disparando ou em_andamento
  useEffect(() => {
    if (lista?.status !== 'disparando' && lista?.status !== 'em_andamento') return;
    const interval = setInterval(fetchDataSilent, 8000);
    return () => clearInterval(interval);
  }, [lista?.status, fetchDataSilent]);

  const handleIniciarEdicaoNome = () => {
    setNomeEditado(lista?.nome ?? '');
    setIsEditingNome(true);
  };

  const handleCancelarEdicaoNome = () => {
    setIsEditingNome(false);
    setNomeEditado('');
  };

  const handleSalvarNome = async () => {
    const nomeTrimmed = nomeEditado.trim();
    if (!nomeTrimmed || nomeTrimmed === lista?.nome) {
      handleCancelarEdicaoNome();
      return;
    }
    try {
      setIsRenaming(true);
      const nomeAnterior = lista?.nome ?? '';
      const { error } = await supabase
        .from('listas_disparo')
        .update({ nome: nomeTrimmed })
        .eq('id', listaId);
      if (error) throw error;
      await supabase.from('listas_disparo_eventos').insert({
        lista_id: listaId,
        tipo_evento: 'lista_renomeada',
        descricao: `Lista renomeada de "${nomeAnterior}" para "${nomeTrimmed}".`,
      });
      setLista(prev => prev ? { ...prev, nome: nomeTrimmed } : prev);
      setIsEditingNome(false);
    } catch (e: any) {
      alert('Erro ao renomear: ' + e.message);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleSalvarMensagem = async () => {
    try {
      setIsSavingMsg(true);
      await salvarMensagem(listaId, mensagem);
      alert('Mensagem salva com sucesso!');
    } catch (e: any) {
      alert('Erro ao salvar: ' + e.message);
    } finally {
      setIsSavingMsg(false);
    }
  };

  const handleFinalizarDisparo = async () => {
    if (!window.confirm('Parar o disparo agora? Os contatos já enviados continuam com seus timers de resposta/resultado ativos.')) return;
    try {
      await finalizarDisparo(listaId);
      await fetchDataSilent();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    }
  };

  const handleEncerrarLista = async () => {
    if (!window.confirm('Encerrar a lista completamente? Os dados serão consolidados e nenhum envio ou contagem adicional será realizado. Esta ação não pode ser desfeita.')) return;
    try {
      await encerrarLista(listaId);
      await fetchData();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    }
  };

  const handleExcluirLista = async () => {
    if (window.confirm('Tem certeza que deseja excluir esta lista? Todos os membros e histórico vinculados a ela serão perdidos. Esta ação não pode ser desfeita.')) {
      try {
        const { error } = await supabase.from('listas_disparo').delete().eq('id', listaId);
        if (error) throw error;
        onBack();
      } catch (e: any) {
        alert('Erro ao excluir lista: ' + e.message);
      }
    }
  };

  const handleCopiarMensagem = () => {
    navigator.clipboard.writeText(mensagem);
    alert('Mensagem copiada!');
  };

  const handleRegistrarEnvio = async (membro: ListaDisparoMembro) => {
    if (!lista) return;
    // Trava da união (D-46): além do botão desabilitado, a chamada em si não
    // sai — nenhum caminho dispara WhatsApp por aqui até o cutover.
    if (!DISPARO_LIBERADO) {
      alert(MOTIVO_DISPARO_TRAVADO);
      return;
    }
    try {
      const { error } = await supabase.functions.invoke('disparar-membro-individual', {
        body: { membro_id: membro.id },
      });
      if (error) throw error;
      fetchData();
    } catch (e: any) {
      alert('Erro ao disparar membro: ' + (e?.message ?? e));
    }
  };



  const handleRemoverMembroBulk = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Tem certeza que deseja remover ${selectedIds.size} membros da lista?`)) return;
    try {
      await removerMembrosDaListaBulk(Array.from(selectedIds), listaId);
      setIsSelectionMode(false);
      setSelectedIds(new Set());
      fetchData();
    } catch (e: any) {
      alert('Erro ao remover membros: ' + e.message);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === membros.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(membros.map(m => m.id)));
    }
  };

  const handleToggleCustomer = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleExportarCSV = () => {
    if (membros.length === 0) return;
    const csvData = membros.map(m => ({
      Nome: m.nome_cliente,
      Telefone: m.telefone,
      Status: m.status,
      Motivo_Perda: m.motivo_perda || '',
      Valor_Gasto: m.snapshot_total_gasto
    }));
    const csv = Papa.unparse(csvData, { delimiter: ';' });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Lista_${lista?.nome}_export.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!lista) return <div>Lista não encontrada</div>;

  const totalAguardandoEnvio = membros.filter(m => m.status === 'aguardando_envio').length;
  const totalEnviados = membros.filter(m => m.status !== 'aguardando_envio').length;
  const totalMembros = membros.length;
  const progressoPct = totalMembros > 0 ? Math.round((totalEnviados / totalMembros) * 100) : 0;

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <button onClick={onBack} className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          {isEditingNome ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={nomeEditado}
                onChange={e => setNomeEditado(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSalvarNome(); if (e.key === 'Escape') handleCancelarEdicaoNome(); }}
                className="text-2xl font-bold bg-muted border border-primary/40 rounded-md px-2 py-0.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary w-full max-w-sm"
              />
              <button
                onClick={handleSalvarNome}
                disabled={isRenaming}
                className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                title="Salvar nome"
              >
                {isRenaming ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              </button>
              <button
                onClick={handleCancelarEdicaoNome}
                className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                title="Cancelar"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h2 className="text-2xl font-bold text-foreground">{lista.nome}</h2>
              <button
                onClick={handleIniciarEdicaoNome}
                className="p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-all"
                title="Renomear lista"
              >
                <Pencil size={15} />
              </button>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Status: <span className="font-medium capitalize">{lista.status.replace('_', ' ')}</span></p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsAuditoriaOpen(true)} className="flex items-center gap-2 text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors shadow-sm font-medium">
            <History size={16} /> <span className="hidden sm:inline">Auditoria</span>
          </button>
          <button onClick={handleExcluirLista} className="flex items-center gap-2 text-sm bg-destructive/10 text-destructive px-3 py-1.5 rounded-lg hover:bg-destructive/20 transition-colors shadow-sm font-medium">
            <Trash2 size={16} /> <span className="hidden sm:inline">Excluir</span>
          </button>
        </div>
      </div>

      {/* Scorecards */}
      {scorecards && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
          <ScoreCard title="Membros" value={scorecards.total_membros} />
          <ScoreCard title="Enviados" value={scorecards.total_enviados} />
          <ScoreCard title="Erros Envio" value={scorecards.total_erros_envio ?? 0} />
          <ScoreCard title="Resposta %" value={`${scorecards.taxa_resposta_pct ?? 0}%`} />
          <ScoreCard title="Conversão %" value={`${scorecards.taxa_conversao_pct ?? 0}%`} />
          <ScoreCard title="Custo Disparo" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(scorecards.custo_total_real ?? 0)} />
          <ScoreCard title="Receita" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(scorecards.receita_gerada ?? 0)} />
          <ScoreCard title="Ticket Médio" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(scorecards.ticket_medio ?? 0)} />
          <ScoreCard title="ROI %" value={scorecards.roi_pct != null ? `${scorecards.roi_pct}%` : '—'} />
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content */}
        <div className="flex-1 space-y-6">
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
              <h3 className="font-semibold">Membros da Lista</h3>
              <div className="flex gap-2">
                {isSelectionMode ? (
                  <>
                    <button onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }} className="flex items-center gap-2 text-sm bg-muted text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted/80">
                      Cancelar
                    </button>
                    <button onClick={handleRemoverMembroBulk} disabled={selectedIds.size === 0} className="flex items-center gap-2 text-sm bg-destructive/10 text-destructive px-3 py-1.5 rounded-lg hover:bg-destructive/20 disabled:opacity-50">
                      <Trash2 size={16} /> Remover da lista ({selectedIds.size})
                    </button>
                  </>
                ) : (
                  <>
                    {lista && lista.status !== 'encerrada' && lista.status !== 'disparando' && (
                      <button onClick={() => setIsSelectionMode(true)} className="flex items-center gap-2 text-sm bg-destructive/10 text-destructive px-3 py-1.5 rounded-lg hover:bg-destructive/20">
                        <Trash2 size={16} /> Remover
                      </button>
                    )}
                    <button onClick={handleExportarCSV} className="flex items-center gap-2 text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20">
                      <Download size={16} /> Exportar CSV
                    </button>
                    {lista.status === 'disparando' ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 text-sm bg-orange-500/10 text-orange-500 px-3 py-1.5 rounded-lg font-medium">
                          <Loader2 size={16} className="animate-spin" />
                          Disparando... ({totalEnviados}/{totalMembros})
                        </div>
                        <button
                          id="btn-finalizar-disparo"
                          onClick={handleFinalizarDisparo}
                          className="flex items-center gap-2 text-sm bg-yellow-500/10 text-yellow-500 px-3 py-1.5 rounded-lg hover:bg-yellow-500/20 font-medium"
                        >
                          <StopCircle size={16} /> Finalizar disparo
                        </button>
                      </div>
                    ) : lista.status !== 'encerrada' && (
                      <button
                        id="btn-disparar-lista"
                        onClick={() => setIsDispararOpen(true)}
                        disabled={!DISPARO_LIBERADO}
                        title={DISPARO_LIBERADO ? undefined : MOTIVO_DISPARO_TRAVADO}
                        className="flex items-center gap-2 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
                      >
                        <Send size={16} /> Disparar
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="overflow-x-auto max-h-[1000px]">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                  <tr>
                    {isSelectionMode && (
                      <th className="px-4 py-3 w-12 text-center">
                        <button
                          type="button"
                          onClick={handleToggleSelectAll}
                          className={`w-5 h-5 flex items-center justify-center rounded border transition-colors mx-auto ${
                            membros.length > 0 && selectedIds.size === membros.length
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-border bg-background hover:border-primary/50'
                          }`}
                        >
                          {membros.length > 0 && selectedIds.size === membros.length && <Check size={14} strokeWidth={3} />}
                        </button>
                      </th>
                    )}
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">Telefone</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Prazo</th>
                    <th className="px-4 py-3 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {membros.map(m => (
                    <tr key={m.id} className={`hover:bg-muted/30 ${selectedIds.has(m.id) ? 'bg-primary/5' : ''}`}>
                      {isSelectionMode && (
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleCustomer(m.id)}
                            className={`w-5 h-5 flex items-center justify-center rounded border transition-colors mx-auto ${
                              selectedIds.has(m.id)
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-border bg-background hover:border-primary/50'
                            }`}
                          >
                            {selectedIds.has(m.id) && <Check size={14} strokeWidth={3} />}
                          </button>
                        </td>
                      )}
                      <td className="px-4 py-3">{m.nome_cliente}</td>
                      <td className="px-4 py-3">{m.telefone}</td>
                      <td className="px-4 py-3">
                        <MembroStatusBadge status={m.status} />
                      </td>
                      <td className="px-4 py-3">
                        <CountdownTimer membro={m} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {m.status === 'aguardando_envio' && (
                          <button
                            onClick={() => handleRegistrarEnvio(m)}
                            disabled={!DISPARO_LIBERADO}
                            title={DISPARO_LIBERADO ? 'Enviar agora' : MOTIVO_DISPARO_TRAVADO}
                            className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Send size={12} /> Enviar
                          </button>
                        )}
                        {m.status === 'aguardando_resposta' && (
                          <span className="text-xs bg-yellow-500/15 text-yellow-500 border border-yellow-500/25 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 font-medium select-none">
                            <Clock size={11} /> Aguardando resposta
                          </span>
                        )}
                        <button
                          onClick={() => setMembroAuditoria(m)}
                          title="Ver histórico do cliente"
                          className="text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground px-2 py-1 rounded inline-flex items-center gap-1 transition-colors"
                        >
                          <History size={12} /> Histórico
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Barra de progresso — visível durante o disparo */}
          {lista.status === 'disparando' && (
            <div className="bg-card border border-border rounded-xl shadow-sm p-4 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-foreground flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-orange-500" />
                  Progresso do disparo
                </span>
                <span className="text-muted-foreground">{totalEnviados} de {totalMembros} enviados ({progressoPct}%)</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${progressoPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Banner de lista encerrada */}
          {lista.status === 'encerrada' && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 flex items-center gap-3">
              <Flag size={18} className="text-green-500 shrink-0" />
              <div>
                <p className="font-semibold text-green-500 text-sm">Lista encerrada</p>
                <p className="text-xs text-muted-foreground">Dados consolidados — nenhuma ação adicional será realizada nesta lista.</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Direita */}
        <div className="w-full lg:w-80 space-y-4">
          <div className="bg-card border border-border rounded-xl shadow-sm p-4 sticky top-4">
            {/* [DT-D10, corrigido] Este campo só salva texto em
                listas_disparo.mensagem_utilizada — o envio real ao DataCrazy
                (enviar-proximo-disparo / disparar-membro-individual) manda só
                {nome, telefone, membro_id, lista_id} no payload do webhook; o
                CONTEÚDO da mensagem é definido dentro da automação do
                DataCrazy, não aqui. O título "Mensagem Utilizada" + botão
                "Salvar" ao lado de "Copiar" sugeria que salvar aqui já
                enviava/aplicava a mensagem. Renomeado para deixar claro que é
                só uma referência para colar manualmente no DataCrazy. */}
            <h3 className="font-semibold mb-1">Mensagem de Referência</h3>
            <p className="text-xs text-muted-foreground mb-2">
              Anotação para você — não é enviada automaticamente. Copie e cole no gatilho da automação no DataCrazy.
            </p>
            <textarea
              className={`w-full h-64 bg-background border border-input rounded-lg p-3 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none resize-none ${
                lista.status === 'encerrada' ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              value={mensagem}
              onChange={e => lista.status !== 'encerrada' && setMensagem(e.target.value)}
              readOnly={lista.status === 'encerrada'}
              placeholder="Digite a mensagem de referência..."
            />
            {lista.status !== 'encerrada' && (
              <div className="flex gap-2 mt-3">
                <button onClick={handleCopiarMensagem} className="flex-1 flex justify-center items-center gap-2 bg-muted hover:bg-muted/80 text-foreground py-2 rounded-lg text-sm transition-colors">
                  <Copy size={16} /> Copiar
                </button>
                {/* [DT-D17, corrigido] Rótulo estava invertido: mostrava "Salvo"
                    ENQUANTO isSavingMsg=true (salvamento em andamento) e voltava
                    para "Salvar" depois de já ter salvo — o oposto do que o
                    texto deveria comunicar. */}
                <button onClick={handleSalvarMensagem} disabled={isSavingMsg} className="flex-1 flex justify-center items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm transition-colors">
                  <Save size={16} /> {isSavingMsg ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            )}
          </div>

          {/* Botão "Parar contagem" — visível em qualquer status ativo (não encerrado) */}
          {lista.status !== 'encerrada' && lista.status !== 'rascunho' && (
            <button
              id="btn-parar-contagem"
              onClick={handleEncerrarLista}
              className="w-full flex items-center justify-center gap-2 bg-destructive/10 hover:bg-destructive/20 text-destructive py-2.5 rounded-xl text-sm font-medium transition-colors border border-destructive/20"
            >
              <Flag size={16} /> Parar contagem e encerrar lista
            </button>
          )}
        </div>
      </div>

      <AuditoriaModal 
        isOpen={isAuditoriaOpen} 
        onClose={() => setIsAuditoriaOpen(false)} 
        eventos={eventos} 
      />

      <DispararModal
        isOpen={isDispararOpen}
        onClose={() => setIsDispararOpen(false)}
        totalAguardandoEnvio={totalAguardandoEnvio}
        onConfirm={async (intervaloSegundos, tarifaAplicada) => {
          await iniciarFila(listaId, intervaloSegundos, tarifaAplicada);
          await fetchData();
        }}
      />

      {membroAuditoria && (
        <MembroAuditoriaModal
          isOpen={true}
          onClose={() => setMembroAuditoria(null)}
          membro={membroAuditoria}
          eventos={eventos}
        />
      )}
    </div>
  );
}

function ScoreCard({ title, value }: { title: string, value: string | number }) {
  return (
    <div className="bg-card border border-border p-3 rounded-xl shadow-sm">
      <p className="text-xs text-muted-foreground font-medium mb-1">{title}</p>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function MembroStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string, color: string }> = {
    'aguardando_envio': { label: 'Aguardando', color: 'bg-gray-500/10 text-gray-500' },
    'aguardando_resposta': { label: 'Resposta', color: 'bg-yellow-500/10 text-yellow-500' },
    'respondido_aguardando_resultado': { label: 'Em Negociação', color: 'bg-blue-500/10 text-blue-500' },
    'ganho': { label: 'Ganho', color: 'bg-green-500/10 text-green-500' },
    'perdido': { label: 'Perdido', color: 'bg-red-500/10 text-red-500' }
  };
  const cfg = map[status] || { label: status, color: 'bg-gray-500/10 text-gray-500' };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${cfg.color}`}>{cfg.label}</span>;
}

function CountdownTimer({ membro }: { membro: ListaDisparoMembro }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    let targetDateStr: string | null = null;
    if (membro.status === 'aguardando_resposta') targetDateStr = membro.prazo_resposta_limite;
    if (membro.status === 'respondido_aguardando_resultado') targetDateStr = membro.prazo_resultado_limite;

    if (!targetDateStr) return;

    const targetDate = new Date(targetDateStr);
    
    const update = () => {
      const diff = differenceInSeconds(targetDate, new Date());
      if (diff <= 0) {
        setTimeLeft('Expirado');
      } else {
        const d = Math.floor(diff / (3600 * 24));
        const h = Math.floor((diff % (3600 * 24)) / 3600);
        const m = Math.floor((diff % 3600) / 60);
        setTimeLeft(`${d}d ${h}h ${m}m`);
      }
    };

    update();
    const interval = setInterval(update, 60000); // update every minute
    return () => clearInterval(interval);
  }, [membro]);

  if (membro.status === 'ganho') return <span className="text-green-500 flex items-center gap-1"><CheckCircle2 size={14}/> Finalizado</span>;
  if (membro.status === 'perdido') {
    const motivoLabel: Record<string, string> = {
      'sem_resposta_no_prazo': 'Sem resposta',
      'prazo_resultado_expirado': 'Prazo expirado',
      'negocio_perdido_crm': 'Negócio perdido',
      'erro_envio_mensagem': 'Erro no envio',
      'lista_encerrada_manualmente': 'Lista encerrada',
    };
    const label = membro.motivo_perda ? (motivoLabel[membro.motivo_perda] ?? membro.motivo_perda.replace(/_/g, ' ')) : 'Perdido';
    return <span className="text-red-500 flex items-center gap-1"><XCircle size={14}/> {label}</span>;
  }
  if (!timeLeft) return <span className="text-muted-foreground">-</span>;

  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${timeLeft === 'Expirado' ? 'text-red-500' : 'text-orange-500'}`}>
      <Clock size={12} /> {timeLeft}
    </span>
  );
}
