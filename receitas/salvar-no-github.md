# Receita: salvar no GitHub

> Uma cópia da pasta na nuvem, PRIVADA, pra nunca perder nada.

## Quando usar

"salvar", "github", "backup", "não quero perder", ou o `painel/contexto.js` mostra que o GitHub não está ligado.

## Já está ligado?

Rode `node painel/salvar.js "o que mudou, em poucas palavras"` e mostre o resultado em uma linha. Pronto.

## Ainda não está ligado

### 1. Veja o que já existe

Se puder rodar comandos:

- `git --version`: falta o Git? No Mac, `xcode-select --install`. No Windows, https://git-scm.com/download/win (Avançar em tudo).
- `git remote -v`: se aparecer `goldkeylab1/templatekeylab`, é o modelo, não o repositório do dono. Vai trocar no Caminho B (ou o GitHub Desktop resolve no Caminho A).
- `gh --version`: o GitHub CLI ajuda muito, se estiver instalado.

### 2. Escolha o caminho com o dono

Pergunte: "Você prefere um programa com botões (GitHub Desktop) ou que eu faça pelos comandos?"

**Caminho A: GitHub Desktop (sem comando).** Passe um passo por vez e espere o dono dizer "feito":

1. Crie uma conta em https://github.com (se ainda não tiver).
2. Instale o GitHub Desktop (https://desktop.github.com) e entre na conta.
3. No GitHub Desktop: File → Add Local Repository → escolha esta pasta. Se ele disser que não é um repositório, clique em "create a repository" ali mesmo.
4. Clique em "Publish repository" e deixe MARCADO "Keep this code private".
5. Pra salvar depois: escreva um resumo em "Summary", clique em "Commit to main" e depois em "Push origin". Ou use o botão "Salvar agora" do painel.

**Caminho B: pelos comandos (com o GitHub CLI).**

1. Sem o `gh`? No Mac, `brew install gh`. No Windows, `winget install GitHub.cli`. Sem nenhum dos dois, use o Caminho A.
2. `gh auth login`: o dono escolhe GitHub.com, HTTPS e "Login with a web browser", e segue no navegador.
3. A pasta ainda não é repositório? `git init -b main`.
4. O `origin` aponta pro modelo? `git remote remove origin`.
5. Crie e envie, PRIVADO: `gh repo create nome-do-negocio --private --source=. --remote=origin --push` (o nome em minúsculas, com hífen).
6. `gh auth setup-git`, pra o salvar funcionar sozinho depois.

### 3. Confira se está privado

- `gh repo view --json visibility` tem que mostrar PRIVATE. Ou peça pro dono abrir o repositório e ver o cadeado "Private".
- Está público? Pare e peça pra deixar privado: no GitHub, Settings → Change visibility → Private.

### 4. Salvar sozinho

Pergunte: "Quer que eu salve sozinho no GitHub depois de cada mudança? (recomendo)"
Anote em `memoria/preferencias.md`: "Salvar no GitHub sozinho: sim" (ou "não").

### 5. Feche

1. Rode `node painel/salvar.js "Primeiro salvamento"`.
2. Marque como feita a tarefa do GitHub no cronograma.
3. Diga: "Pronto. A sua pasta está no GitHub, privada. Se o computador quebrar, nada se perde."

## Nunca

- Subir num repositório público.
- Usar `git push --force` ou apagar o histórico.
- Subir senha, chave ou o arquivo `.env` (o `.gitignore` já tira).
- Subir arquivo com mais de 100 MB (o GitHub recusa). Ponha no `.gitignore` e avise.

## Erros comuns

| Erro | O que fazer |
|---|---|
| "Authentication failed" ou pede usuário | Caminho A (GitHub Desktop), ou `gh auth login` e `gh auth setup-git` |
| "rejected" ou "fetch first" | `git pull --rebase` e salve de novo |
| "Please tell me who you are" | `git config user.name "Nome"` e `git config user.email "o e-mail do GitHub"` |
| "Repository not found" | O link está errado: `git remote set-url origin LINK-CERTO` |
