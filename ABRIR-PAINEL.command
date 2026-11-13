#!/bin/bash
# Dois cliques aqui abrem o painel no navegador (Mac).
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Falta instalar o Node (é de graça). Vou abrir o site: baixe a versão LTS e instale."
  open "https://nodejs.org"
  echo ""
  read -r -p "Depois de instalar, aperte Enter pra fechar e abra este arquivo de novo." _
  exit 1
fi
node painel/ligar.js --abrir
sleep 2
