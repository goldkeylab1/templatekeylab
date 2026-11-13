# Receita: mudar o painel

## Antes, veja se dá sem código

| O dono quer... | Sem código |
|---|---|
| um item novo no menu | crie uma área (`receitas/nova-area.md`) |
| um quadro novo | Kanban → Novo quadro (ou um .md com o marcador de kanban) |
| uma pergunta nova | uma linha `- **Pergunta:**` no arquivo certo |
| uma pergunta nova na Ajuda | `AJUDA.md` (## tema, ### pergunta, a resposta e a linha "Peça pra IA:") |
| outra cor ou outro logo | Ajustes, ou `negocio/marca.md` |
| outro nome no painel | Ajustes, ou `memoria/preferencias.md` |

## Se precisar de código

O mapa do código está em `painel/README.md`. Regras:

1. Nada de instalar bibliotecas (sem `npm install`). Só o Node.
2. Uma tela = um arquivo em `painel/public/telas/`. O servidor fica em `painel/servidor.js`; a leitura dos arquivos, em `painel/lib/`.
3. Os dados ficam nos arquivos .md, nunca num banco de dados.
4. Use as cores das variáveis do topo de `painel/public/estilo.css`, pra o tema claro e o escuro continuarem funcionando.
5. Textos da tela curtos e simples, como o resto do painel.
6. Teste com `npm start`: confira no tema claro e no escuro, com a janela larga e estreita.
7. Mudou algo em `painel/public/`? A página recarrega sozinha. Mudou o servidor (`painel/servidor.js` ou `painel/lib/`)? Rode `node painel/ligar.js --parar` e abra de novo.
