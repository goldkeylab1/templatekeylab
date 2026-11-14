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

1. Abra esta pasta na sua IA e diga oi.
2. A IA abre o painel no navegador e começa a configurar com você.
3. Responda as perguntas (dá pra pular).
4. Quer continuar outro dia? Escreva: configurar.

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

No Claude Code (e no chat do painel) tem mais uma garantia: um **anotador** escondido confere a conversa a cada 5 mensagens suas e sempre no fim, e anota o que a IA deixou passar (por exemplo, quando ela estava focada numa tarefa grande). Ele usa o Haiku, o modelo mais barato, e só lê as mensagens novas. O que ele anotou aparece no Dashboard, em "A IA anotou sozinha".

### Preciso rodar algum comando pra ela lembrar?

Não. Ela aprende enquanto vocês conversam, e o anotador confere depois. Se quiser uma faxina geral de vez em quando, peça: revisa tudo.

### Como desligo o anotador?

Em Ajustes → **Aprender sozinho**. Ali também dá pra trocar o modelo dele (Haiku gasta menos; Sonnet é mais cuidadoso) e ver as últimas vezes que ele rodou. Ele usa um pouco do seu plano do Claude. Mensagens curtinhas ("ok", "valeu") não contam, e sem nada novo ele nem chama a IA.

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

Ele abre sozinho quando você começa uma conversa com a IA (se ainda não estiver aberto). Pra abrir na mão: dois cliques em `ABRIR-PAINEL.command` (Mac) ou `ABRIR-PAINEL.bat` (Windows), ou peça pra IA. O endereço é http://localhost:4747 (ou o próximo número livre). Não quer que ele abra sozinho? Ajustes → Sobre o painel → "Abrir o painel sozinho".

Peça pra IA: `abre o painel`

### O painel não abre. E agora?

Quase sempre falta o Node. Baixe em nodejs.org (a versão LTS), instale e tente de novo. No Mac, se aparecer "não é possível abrir", clique com o botão direito no arquivo e depois em Abrir.

Peça pra IA: `O painel não abre. Me ajude.`

### Dá pra deixar o menu menor?

Dá. Clique no quadradinho que fica na borda de cima do menu, à direita: ficam só os ícones (passe o mouse em cima pra ver o nome). Pra abrir de novo, clique nele outra vez. O painel lembra da sua escolha.

### Onde abro o chat com a IA?

No botão redondo do canto de baixo, à direita, em qualquer tela. Ou em **Conversar com a IA**, no menu.

### Como mudo pra tema claro ou escuro?

Em Ajustes → Aparência → Tema: claro, escuro ou automático (igual ao computador).

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

### Dá pra conversar com a IA dentro do painel?

Dá. Clique em **Conversar com a IA**, no menu. Abre um chat do lado, com a IA que você já tem instalada no computador (Claude Code, Codex ou Gemini), usando a sua conta. Ela segue as mesmas regras e, quando muda um arquivo, a tela se atualiza na hora.

Os botões de "Pedir pra IA" do painel mandam o pedido direto pro chat. A conversa fica só no seu computador (`painel/.chat.json`) e não vai pro GitHub.

### Dá pra escolher o modelo da IA no chat?

Dá. No topo do chat, em **Modelo**. No Claude Code:

- **Sempre o mais novo:** Opus (o mais inteligente), Sonnet (equilibrado) ou Haiku (o mais rápido).
- **Versão fixa:** Fable 5.2, Opus 5.5, Sonnet 5.5 ou Haiku 5.5.
- **Outro...:** você escreve o nome de qualquer modelo que a sua conta tenha.

Do lado fica o **Esforço**: o quanto a IA pensa antes de responder (Baixo, Médio, Alto, Extra alto ou Máximo). Mais esforço dá uma resposta melhor, mas mais lenta, e gasta mais do seu plano. "Padrão" usa o que você escolheu no próprio Claude Code.

A troca vale pras próximas mensagens, na mesma conversa. Embaixo de cada resposta aparecem o modelo e o esforço usados.

### O chat diz que o meu Claude Code é antigo. E agora?

Os modelos mais novos (e o esforço Extra alto) precisam de um Claude Code recente. Abra o terminal, rode `claude update` e clique em **Já atualizei**, no topo do chat.

### O chat diz "Nenhuma IA instalada". E agora?

Instale o Claude Code (recomendado), o Codex ou o Gemini. Abra o terminal, rode o nome dele (`claude`, `codex` ou `gemini`) e entre na sua conta. Depois clique em "Já instalei: procurar de novo".

### Como procuro alguma coisa no painel?

Aperte **Cmd+K** (Mac) ou **Ctrl+K** (Windows), ou clique em **Procurar** no menu. A busca olha em todos os arquivos: tarefas, feedbacks, roteiros, a estratégia. Não precisa acento.

### O que é o quadro "Pra arrumar" do Dashboard?

São as coisas velhas ou esquecidas: teste que passou do dia de julgar, decisão pra rever, tarefa atrasada há semanas, feedback que ninguém viu, números sem análise. Só aparece quando tem algo. Clique na estrela pra pedir pra IA arrumar.

### Onde ficam os roteiros e textos que a IA escreveu?

No menu **Saídas**. Cada um tem o botão **Copiar o texto**, já sem as marcas do markdown, pronto pra colar na rede social, no e-mail ou no WhatsApp.

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

## Mentalidade

### O que é o menu Mentalidade?

É o lugar do seu jeito de pensar. Com o mesmo jeito de pensar, o resultado não muda: por isso a mudança começa por dentro. A tela é uma jornada, nesta ordem:

1. **Entenda:** por que começar por dentro (pensamento → sentimento → ação → resultado) e que você pode mudar.
2. **O jeito de pensar de quem prospera:** 7 ideias curtas.
3. **Troca de crenças:** as ideias que te seguram, trocadas pelas que libertam.
4. **O seu objetivo de vida:** a vida dos seus sonhos, sem limites, por área (saúde, família, dinheiro, trabalho, casa, viagens, quem você se torna, o dia perfeito e o porquê). Travou? Toque em **Me ajude a sonhar**: a IA pergunta área por área e dá ideias.
5. **O quadro dos sonhos:** duas opções. **Copiar prompt para uma IA de imagem** libera quando você descreve todas as áreas da vida: o painel monta o prompt com tudo o que você escreveu, no formato certo (deitado, 16:9). Você cola numa IA de imagem (ChatGPT, Gemini...) e gera. Depois, em **Vincular meu quadro dos sonhos**, coloca a imagem. Ela aparece no seu sonho e no "Ver e sentir".
6. **Todo dia:** a frase do dia (são 52, e você pode escrever as suas) e a prática de 5 minutos.
7. **Diário:** escreva o quanto quiser, com a data de hoje ou a que escolher. Dá pra editar e apagar.

No fim, cada arquivo explica pra que serve, por que usar e como usar. O seu sonho também aparece de leve no painel todo: no menu, no Kanban e no "Comece aqui".

Peça pra IA: `Me ajude a sonhar: me pergunte área por área da minha vida.`

### Como a IA ajuda na mentalidade?

Ela anota o seu sonho, as suas gratidões e as suas boas ações quando você conta. Quando você fala algo como "isso não é pra mim", ela mostra a crença com carinho e te ajuda a trocar. E, no "o que eu faço hoje", ela lembra do passo rumo ao seu sonho e pergunta quem você vai ajudar.

Peça pra IA: `Faz comigo a prática de 5 minutos agora.`

### Como troco uma crença que me trava?

Em Mentalidade → Troca de crenças → **Ver todas**. Lá você:

- escreve a crença que te trava e a nova, e guarda;
- não sabe a nova? Toque em **Pedir pra IA sugerir a nova**: ela mostra de onde a crença costuma vir e sugere crenças de prosperidade, abundância e sucesso;
- não sabe quais são as suas? Toque em **Me ajude a descobrir**: a IA faz perguntas curtas, uma de cada vez;
- reconheceu uma das mais comuns? Toque em **Também tenho essa**.

Peça pra IA: `Tenho uma crença que me trava: `

### Como coloco as minhas frases do dia?

Em Mentalidade → Todo dia, no cartão da frase:

- **Outra frase:** troca por outra, se aquela não tocou hoje;
- **Escrever a minha:** você escreve uma frase sua (curta, no presente, "Eu sou...", "Eu tenho..."). As suas aparecem dia sim, dia não;
- **Ver todas:** as 52 frases, por tema, e as suas. Lá tem o botão **Criar frases pra mim**: a IA lê o seu sonho e as suas crenças e cria frases feitas pra você.

### Como uso o diário?

Em Mentalidade → Diário (ou em **Ver o diário inteiro**):

- escreva o quanto quiser. A data de hoje já vem marcada; quer outra? É só trocar;
- os botões **Agradeço por**, **Hoje eu ajudei** e **Vitória do dia** começam uma linha pra você;
- cada nota tem o lápis (editar) e a lixeira (apagar). Dá pra mudar a data na hora de editar;
- as notas ficam organizadas por data, a mais nova em cima. Se a página fechar no meio, o que você estava escrevendo volta.

Também dá pra contar pra IA (`Hoje eu agradeço por: `): ela anota no diário.

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

### Onde vejo os meus testes?

Em Marketing → **Testes**. Lá aparecem os testes rodando, quantos dias faltam pra julgar e o que virou regra. O dia de julgar também aparece no cronograma do Dashboard. Na hora de julgar, clique em **Julgar**, escreva o que o número mostrou e escolha: virou regra, não funciona ou testar de novo.

### Onde vejo o gráfico dos meus números?

Em Marketing → **Números**. O gráfico sai dos placares que a IA escreve quando analisa os seus números (`marketing/numeros/placar-...md`). Cada barra é um conteúdo. A linha tracejada é a mediana (o do meio).

Peça pra IA: `analisa meus números`

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
