# Receita: abrir o painel

## Abrir

1. Rode `node painel/ligar.js --abrir`. Ele liga em segundo plano e abre o navegador.
2. Mostre o link que ele imprimir (normalmente http://localhost:4747).

Não pode rodar comandos? Diga pro dono: dois cliques em `ABRIR-PAINEL.command` (Mac) ou `ABRIR-PAINEL.bat` (Windows).

## Desligar

`node painel/ligar.js --parar`

## Se não abrir

| O que aparece | O que fazer |
|---|---|
| "node: command not found" ou "'node' não é reconhecido" | Instalar o Node (versão LTS) em https://nodejs.org. Depois fechar e abrir o terminal |
| No Mac: "não é possível abrir" ou "desenvolvedor não identificado" | Botão direito no arquivo → Abrir → Abrir. Ou rode `xattr -d com.apple.quarantine ABRIR-PAINEL.command` e `chmod +x ABRIR-PAINEL.command` |
| "Não achei uma porta livre" | Rode `node painel/ligar.js --parar` e tente de novo, ou reinicie o computador |
| A página abre em branco ou dá erro | Rode `npm start` pra ver o erro no terminal e arrume (o mapa do código está em `painel/README.md`) |
| A tela não mudou depois de editar um arquivo | Recarregue a página (Cmd+R ou F5) |

O painel precisa do Node 18 ou mais novo: `node --version`.
