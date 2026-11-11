#!/bin/sh
# A Vercel roda este roteiro antes de montar o site (o "ignoreCommand" do vercel.json —
# SESSAO-48, D-303). Saída 0 = PULA a montagem (o site no ar segue o mesmo); 1 = MONTA.
#
# Pula só quando há publicação anterior neste ramo e, desde ela, só mudou documentação
# (_docs/, Claude outputs/, *.md). Qualquer dúvida monta: sem publicação anterior (a 1ª do
# ramo), commit anterior fora do clone raso da Vercel (10 commits) ou erro do git.
#
# Mora num arquivo porque o "ignoreCommand" do vercel.json aceita no máximo 256 caracteres
# (o comando inteiro, com 363, derrubou a publicação de 11/11 na validação — E-268).
if [ -n "$VERCEL_GIT_PREVIOUS_SHA" ] && git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . ':(exclude)_docs' ':(exclude)Claude outputs' ':(exclude)*.md'; then
  echo 'Desde a ultima publicacao so mudou documentacao: montagem pulada (o site no ar segue o mesmo).'
  exit 0
fi
echo 'Mudou codigo (ou nao ha publicacao anterior para comparar): monta.'
exit 1
