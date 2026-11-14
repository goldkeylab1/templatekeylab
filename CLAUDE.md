# Claude Code

As regras desta pasta estão no AGENTS.md (valem pra qualquer IA). Siga tudo de lá.

@AGENTS.md

## Só no Claude Code

- O resumo do começo (`node painel/contexto.js`) já roda sozinho, pelo gancho em `.claude/settings.json`. Não rode de novo. Ele liga o painel e abre no navegador se não tiver aba aberta. Se ele disser "PRIMEIRA VEZ", siga a seção 1 do AGENTS.md: guie a configuração já na primeira resposta.
- Toda mensagem do dono chega com um lembrete de "aprender sozinho". Siga a seção 4 do AGENTS.md.
- Um anotador escondido (`painel/anotar.js`, com o Haiku) confere a conversa a cada 5 mensagens do dono, antes de ela ser resumida e no fim, e anota o que ficou pra trás. Ele liga e desliga em Ajustes ("Anotar sozinho" em `memoria/preferencias.md`) e não roda na pasta do próprio modelo.
- As receitas também são comandos: /configurar, /salvar, /abrir-painel, /o-que-fazer-hoje, /nova-area, /novo-projeto, /nova-receita, /revisar-tudo, /personalizar-painel, /analisar-numeros, /estudar-viral, /escolher-tema, /escrever-roteiro e /planejar-semana.
- Com "Salvar no GitHub sozinho: sim" em `memoria/preferencias.md`, o gancho do fim de cada resposta já salva. Não rode o salvar de novo.
