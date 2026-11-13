# Ajuda

> Perguntas curtas, respostas curtas. O painel mostra este arquivo no menu Ajuda, com busca.
> Pra IA: pra criar uma pergunta nova, use o formato: "## Tema", "### Pergunta?", a resposta curta embaixo e, se quiser, uma linha "Peça pra IA: `o pedido`".

## Começar

### O que é esta pasta?

É o cérebro do seu negócio: quem você é, o que vende, pra quem, a sua marca, as suas metas e o que funciona. Tudo em arquivos de texto. A sua IA lê, aprende e organiza, e o painel mostra tudo de um jeito fácil.

### Preciso saber programar?

Não. Você conversa com a IA e usa o painel. Só precisa instalar o Node uma vez, pro painel abrir.

Peça pra IA: `Me ajude a instalar o que falta pra abrir o painel.`

### Qual IA eu uso?

Qualquer uma que mexa em arquivos: Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot ou Windsurf. No Claude Code tudo é automático (o resumo do dia, o lembrete de aprender e o salvar sozinho). Nas outras, a IA segue as regras do AGENTS.md.

IA que só conversa (ChatGPT ou Claude no site) também serve. Veja "Uso uma IA que só conversa".

### Por onde eu começo?

1. Abra esta pasta na sua IA.
2. Escreva: configurar.
3. Responda as perguntas (dá pra pular).
4. Abra o painel e veja o "Comece aqui".

Peça pra IA: `configurar`

### Quanto custa?

A pasta e o painel são grátis. A IA que você usar tem o preço dela (várias têm plano grátis).

### Funciona sem internet?

O painel funciona, porque roda no seu computador. A IA e o GitHub precisam de internet.

## Configurar

### Como configuro o meu negócio?

Escreva "configurar" pra IA. Ela pergunta o tipo do seu negócio e o resto, uma coisa por vez, e já anota nos arquivos. Ou responda direto no painel: Comece aqui, botão Responder.

Peça pra IA: `configurar`

### Posso configurar sem IA?

Pode. No painel: Comece aqui, botão Responder em cada parte. Ou abra os arquivos de `negocio/` e escreva depois dos dois-pontos.

### Não sei responder uma pergunta. E agora?

Deixe vazia e siga. Dá pra voltar depois. Se a pergunta não serve pro seu negócio, escreva: não se aplica.

### Errei uma resposta. Como corrijo?

No painel: Meu negócio, abra o arquivo, mude a resposta e clique em Salvar. Ou só conte pra IA o certo.

Peça pra IA: `Na verdade, o certo é: `

### Como vejo o que falta configurar?

No menu "Comece aqui". Ele mostra o que está pronto, o que falta e o próximo passo.

### O meu negócio é um canal, um software, um site ou uma loja. Muda alguma coisa?

Muda. Na configuração, a IA pergunta o tipo e cria as áreas certas: software ganha roadmap e bugs, loja ganha produtos e pedidos, e assim por diante. Os perfis ficam em `modelos/perfis/`.

Peça pra IA: `Meu negócio é um [tipo]. Crie as áreas certas pra ele.`

### Tenho mais de um negócio. E agora?

Use uma pasta pra cada negócio (baixe o modelo de novo). Cada um tem o seu cérebro, o seu painel e o seu GitHub.

## A IA e a memória

### Como a IA aprende?

Depois de cada mensagem sua, ela vê se tem algo pra guardar (feedback, ideia, decisão, correção, tarefa) e anota no arquivo certo, sozinha. No fim da resposta ela avisa: "Anotei: ...".

### Preciso rodar algum comando pra ela lembrar?

Não. Ela aprende enquanto vocês conversam. Se quiser uma faxina geral de vez em quando, peça: revisa tudo.

Peça pra IA: `revisa tudo`

### Onde fica o que ela aprendeu?

Na pasta `memoria/` e em `marketing/o-que-funciona.md`. No painel: Feedbacks (o que ela aprendeu), Ideias, Dashboard (as tarefas) e Meu negócio (preferências e decisões).

### Ela anotou uma coisa errada. Como arrumo?

Diga pra ela: "isso está errado, o certo é...". Ou arrume no painel: abra o arquivo e clique em Editar o texto.

Peça pra IA: `Você anotou errado. O certo é: `

### Como faço a IA esquecer algo?

Peça pra ela apagar. Ou apague a linha no arquivo (no painel: Editar o texto).

Peça pra IA: `Apague da memória: `

### A IA não está seguindo as regras. E agora?

Peça pra ela ler as regras de novo. IAs mais simples esquecem em conversas longas: comece uma conversa nova de vez em quando.

Peça pra IA: `Leia o AGENTS.md de novo e siga as regras.`

### Uso uma IA que só conversa (ChatGPT ou Claude no site). Funciona?

Funciona, com um passo a mais. No painel, clique em "Copiar o cérebro" (em Comece aqui ou em Ajustes) e cole no começo da conversa. O que ela sugerir anotar, você anota pelo painel.

### Como mudo uma regra da IA?

Conte a regra pra ela. Se for preferência sua, ela anota em `memoria/preferencias.md`. Se for regra do negócio, em "Regras do meu negócio", no fim do AGENTS.md.

Peça pra IA: `A partir de agora, sempre `

### A IA vai mexer nos meus arquivos sem pedir?

Só pra anotar o que você contou (feedback, ideia, decisão, tarefa), e ela sempre avisa numa linha. Coisa grande ela pergunta antes.

## Painel

### Como abro o painel?

Dois cliques em `ABRIR-PAINEL.command` (Mac) ou `ABRIR-PAINEL.bat` (Windows). Ou peça pra IA. O endereço é http://localhost:4747.

Peça pra IA: `abre o painel`

### O painel não abre. E agora?

Quase sempre falta o Node. Baixe em nodejs.org (a versão LTS), instale e tente de novo. No Mac, se aparecer "não é possível abrir", clique com o botão direito no arquivo e depois em Abrir.

Peça pra IA: `O painel não abre. Me ajude.`

### Como mudo pra tema claro ou escuro?

No pé do menu tem 3 botões: o sol (claro), o círculo meio a meio (igual ao computador) e a lua (escuro). Também em Ajustes.

### Como coloco o meu logo?

Ajustes, depois Logo, depois Escolher. Ou ponha o arquivo em `arquivos/marca/` com o nome `logo.png`.

### Como mudo as cores do painel?

Ajustes, depois Cor principal: escolha e clique em Salvar cor. Ela vai pro `negocio/marca.md` e troca o rosa do painel. Quer o rosa de volta? Desligue "Usar as cores da minha marca".

### Como uso o cronograma?

No Dashboard: escreva a tarefa, escolha a data (se tiver) e clique em Adicionar. Clique na bolinha pra marcar como feita. Ou só conte pra IA: "amanhã preciso ligar pro fornecedor".

Peça pra IA: `Anote no cronograma: `

### Como uso o kanban?

Arraste os cartões de uma coluna pra outra. Clique num cartão pra editar, mudar de coluna ou apagar. Dá pra criar colunas e quadros novos.

### Posso ter mais de um quadro no kanban?

Pode. Kanban, botão Novo quadro. O marketing já vem com a "Pauta de conteúdo", e cada projeto ganha o seu.

### O painel se atualiza sozinho?

Sim. Quando a IA muda um arquivo, a tela muda junto, em segundos.

### Posso usar o painel no celular?

Não. Ele roda só no seu computador, só pra você. É de propósito, por segurança.

### Como desligo o painel?

Feche a janela do terminal que abriu com ele. Ou peça pra IA.

Peça pra IA: `desliga o painel`

## GitHub

### Por que GitHub?

É uma cópia da sua pasta na nuvem. Se o computador quebrar ou você apagar algo sem querer, nada se perde. E dá pra voltar pra qualquer versão antiga.

### Como ligo a minha pasta no GitHub?

Peça pra IA: salvar no github. Ela te guia: criar a conta, criar um repositório PRIVADO e ligar a pasta. Leva uns 5 minutos.

Peça pra IA: `salvar no github`

### Qual o jeito mais fácil, sem comando nenhum?

1. Crie uma conta em github.com.
2. Instale o GitHub Desktop (desktop.github.com) e entre na conta.
3. Clique em File, depois Add Local Repository, e escolha esta pasta.
4. Clique em Publish repository e deixe marcado "Keep this code private".

Pra salvar depois: Commit e Push no GitHub Desktop, ou o botão "Salvar agora" do painel.

### Peguei o modelo pelo botão "Use this template". Já está no GitHub?

Está, se você escolheu Private na hora de criar. No seu repositório, clique em Code e depois em Open with GitHub Desktop, e use a pasta que ele baixar.

### O meu repositório está público. E agora?

Deixe privado agora: no GitHub, abra o repositório, Settings, Change visibility, Private. O painel avisa quando está público e não salva até você arrumar.

### Como salvo?

O botão "Salvar agora" (no Dashboard ou em Ajustes), ou peça pra IA: salvar. Pra salvar sozinho depois de cada mudança, ligue "Salvar sozinho" em Ajustes.

Peça pra IA: `salvar`

### Como pego a minha pasta num computador novo?

No GitHub Desktop: File, Clone Repository, e escolha o seu repositório. Ou peça pra IA no computador novo.

### O que nunca vai pro GitHub?

Senhas, chaves e o arquivo `.env` ficam de fora (o `.gitignore` tira). Vídeos e arquivos .zip também, porque são grandes demais. Mesmo assim: nunca escreva senha nos arquivos.

### Como instalo o Git?

No Mac: abra o Terminal e digite `git --version`. Se ele pedir, clique em Instalar. No Windows: baixe em git-scm.com e instale clicando em Avançar. O GitHub Desktop já traz o que precisa.

## Marketing

### Como a IA descobre o que funciona no meu marketing?

Ela compara os seus conteúdos que foram melhor com os que foram pior, transforma as diferenças em testes e só vira regra o que os seus números provarem. Fica tudo em `marketing/`.

### Onde coloco os meus números?

Exporte da rede (YouTube Studio, Instagram, TikTok) ou tire um print, e ponha em `marketing/numeros/`. Depois peça: analisa meus números.

Peça pra IA: `analisa meus números`

### Como estudo um vídeo que viralizou?

Mande o link (ou o vídeo) pra IA e peça pra estudar. Ela anota em `marketing/virais/` e transforma em teste.

Peça pra IA: `Estude esse vídeo que viralizou: `

### Como faço um roteiro?

Peça pra IA. Ela usa a sua voz (`negocio/voz.md`) e a sua fórmula (`marketing/o-que-funciona.md`).

Peça pra IA: `Escreva um roteiro sobre: `

### O que é um teste?

Mudar UMA coisa (o título, o começo, o horário) e medir UM número pra ver se melhora. Fica em `marketing/testes.md`.

Peça pra IA: `Qual teste eu faço agora?`

### Por que o "O que funciona" está vazio?

Porque ele só aceita o que os SEUS números provaram. Mande números e estude virais, e ele vai enchendo.

## Expandir

### Quero uma área nova (vendas, financeiro, produto, clientes).

Peça pra IA. Ela cria a pasta, os arquivos e o item no menu do painel.

Peça pra IA: `Quero uma área nova pra: `

### Quero um projeto novo (cliente, site, app, lançamento).

Peça pra IA. Ela cria a pasta em `projetos/`, com o resumo e um quadro de tarefas.

Peça pra IA: `Crie um projeto novo pra: `

### Quero automatizar uma tarefa que eu repito.

Transforme em receita. A IA escreve o passo a passo e segue toda vez que você pedir.

Peça pra IA: `Quero uma receita pra: `

### Quero uma pergunta nova no "Meu negócio".

Peça pra IA. Ou abra o arquivo (Editar o texto) e escreva uma linha assim: `- **Pergunta:**`

Peça pra IA: `Acrescente esta pergunta no meu negócio: `

### Quero mudar o painel (uma tela nova, um botão).

Peça pra IA. Muita coisa nem precisa de código: área nova vira menu sozinha, e quadro novo aparece no Kanban.

Peça pra IA: `Quero mudar o meu painel: `

### Quero ligar outras ferramentas (Notion, Google Agenda, Canva).

Depende da sua IA. No Claude Code são os conectores (MCP). Peça pra IA ver o que dá pra ligar.

Peça pra IA: `Quero ligar esta ferramenta: `

### Como deixo tudo em ordem de vez em quando?

Peça uma revisão. A IA confere o que está velho, repetido ou faltando, e arruma.

Peça pra IA: `revisa tudo`
