# O painel por dentro

> Pra IA (e pra quem programa): o mapa do código do painel. Pra só usar o painel, não precisa ler isto.

## Como funciona

- **Node puro, sem dependências.** Nada de `npm install`. Precisa do Node 18 ou mais novo.
- **Os dados são os arquivos .md** da pasta. O painel lê e escreve neles; não existe banco de dados.
- **Só no computador:** o servidor escuta em `127.0.0.1` (porta 4747, ou a próxima livre até 4766). Ele recusa pedidos que não venham do `localhost` e, nos POST, exige o cabeçalho `X-KeyLab: 1`.
- **Ao vivo:** o servidor vigia a pasta (`lib/vigia.js`) e avisa a página por `/api/eventos`. A página recarrega os dados sozinha. Mudou algo em `public/`? A página inteira recarrega.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `servidor.js` | O servidor: as rotas `/api/...` e os arquivos de `public/` |
| `ligar.js` | Liga em segundo plano (`--abrir` abre o navegador, `--parar` desliga) |
| `contexto.js` | O resumo pra IA no começo da conversa (o gancho SessionStart do Claude Code). Também liga o painel |
| `lembrete.js` | O lembrete de "aprender sozinho" a cada mensagem (o gancho UserPromptSubmit). O texto fica em `.claude/lembrete.txt` |
| `salvar.js` | Salva no GitHub. `--auto` só salva se "Salvar no GitHub sozinho: sim" (o gancho Stop) |
| `anotar.js` | O anotador (ganchos Stop, PreCompact e SessionEnd): lê só as mensagens novas da conversa (o `.jsonl` do Claude Code), a cada 5 mensagens do dono e no fim, e chama o Haiku pra anotar o que ficou pra trás. A marca de até onde leu fica em `painel/.anotador.json`; o que anotou, em `painel/.anotador.log`. `node painel/anotar.js --agora` roda na hora. Não roda com `PAINEL_ANOTADOR=1` (a própria sessão dele) nem na pasta do modelo |
| `lib/md.js` | Ler e escrever .md: campos (`- **Pergunta:** resposta`), seções, registros (`### `), datas |
| `lib/itens.js` | O texto das tarefas e cartões: `@DD/MM`, `#tag`, `✓ DD/MM HH:MM` |
| `lib/cronograma.js` | `memoria/cronograma.md` |
| `lib/kanban.js` | Os quadros: todo .md com a linha do marcador de kanban (menos `modelos/` e arquivos com `_`) |
| `lib/registros.js` | Feedbacks, ideias e aprendizados |
| `lib/areas.js` | As áreas do menu (pastas com `LEIA-ME.md` e "Nome no menu") e os arquivos de cada uma |
| `lib/status.js` | O "Comece aqui": arquivos com o marcador de configurar, mais o GitHub |
| `lib/git.js` | O estado do GitHub e o salvar (commit, push, aviso se o repositório estiver público) |
| `lib/marca.js` | Nome, cor e logo (`negocio/marca.md` e `arquivos/marca/`) |
| `lib/ajuda.js` | As perguntas de `AJUDA.md` |
| `lib/cerebro.js` | O "Copiar o cérebro" pra IAs que só conversam |
| `lib/testes.js` | Os testes (`marketing/testes.md`) e as decisões (`memoria/decisoes.md`): ler, julgar e os prazos ("Julgar em", "Rever em") que vão pro cronograma |
| `lib/numeros.js` | Os placares (`marketing/numeros/placar-*.md`): lê a tabela "## Os números" pro gráfico |
| `lib/saidas.js` | O que a IA criou (`saidas/`): a lista e o texto limpo pra copiar |
| `lib/busca.js` | A busca geral (Cmd+K) em todos os arquivos de texto, sem acento |
| `lib/saude.js` | O "Pra arrumar" do Dashboard: testes e decisões vencidos, tarefas velhas, feedbacks e ideias esquecidos, números sem análise |
| `lib/anotador.js` | O anotador visto pelo painel: ligado ou parado (e por quê), o modelo e o que ele anotou (Ajustes e o Dashboard) |
| `lib/chat.js` | O chat: chama a IA instalada (Claude Code completo; Codex e Gemini em modo simples) nesta pasta e manda a resposta aos poucos por `/api/eventos` (evento `chat`). A conversa, o modelo (`--model` no Claude Code, `-m` no Codex e no Gemini) e o esforço (`--effort`, só no Claude Code; os níveis aceitos saem do `claude --help`) ficam em `painel/.chat.json` |
| `public/index.html` | A página |
| `public/estilo.css` | O visual. As cores ficam em variáveis no topo (tema claro e escuro) |
| `public/app.js` | O menu, as rotas (`#/tela`), o tema, a cor da marca e o ao vivo |
| `public/ui.js` | Peças comuns: `h()` pra criar elementos, `api()`, avisos, janelas, datas e o leitor de markdown |
| `public/icones.js` | Os ícones (desenhados à mão, 24x24) |
| `public/busca.js` | A janela da busca geral (Cmd+K) |
| `public/chat.js` | A aba do chat com a IA. `pedirIA(texto)` (em `ui.js`) manda um pedido pro chat, ou copia se não tiver IA instalada |
| `public/telas/*.js` | Uma tela por arquivo. Cada uma exporta `montar(alvo, ctx)` |

## Telas

| Rota | Arquivo |
|---|---|
| `#/comece` | `telas/comece.js` |
| `#/dashboard` | `telas/dashboard.js` |
| `#/kanban` | `telas/kanban.js` |
| `#/area/<pasta>` | `telas/area.js` (Meu negócio, Marketing, Projetos e as áreas novas) |
| `#/arquivo?c=<caminho>` | `telas/arquivo.js` (perguntas viram formulário; `&editar=1` abre o texto) |
| `#/feedbacks` | `telas/feedbacks.js` |
| `#/ideias` | `telas/ideias.js` |
| `#/testes` | `telas/testes.js` (fica dentro de Marketing) |
| `#/numeros` | `telas/numeros.js` (fica dentro de Marketing) |
| `#/saidas` | `telas/saidas.js` |
| `#/ajuda` | `telas/ajuda.js` |
| `#/ajustes` | `telas/ajustes.js` |

## Atalhos de uma área

No `LEIA-ME.md` de uma área, a linha `- **Telas (opcional):** testes, numeros` põe cartões dessas telas no topo da página da área (as telas conhecidas estão em `TELAS_EXTRAS`, no `telas/area.js`).

## Tela nova, passo a passo

1. Crie `public/telas/<nome>.js` exportando `async function montar(alvo, ctx)`. Use `h()` e `api()` de `ui.js`.
2. Ponha a tela em `TELAS`, no topo de `public/app.js`, e no menu em `itensDoMenu()`.
3. Precisa de dados novos? Crie a leitura em `lib/` e a rota em `GET` ou `POST` no `servidor.js`.
4. Use só as variáveis de cor do `estilo.css` (`--tinta`, `--rosa`, `--vidro`...), pra funcionar no claro e no escuro.
5. Mudou o servidor? `node painel/ligar.js --parar` e abra de novo.
