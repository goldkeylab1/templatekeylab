# Receita: criar um projeto novo

## Quando usar

"projeto novo", "cliente novo", "vou fazer um site", "vou fazer um lançamento".

## Perguntas (uma por vez)

1. Qual o nome do projeto?
2. O que é, numa frase?
3. Pra quem (cliente ou público)?
4. Qual o objetivo, com número? (ex.: 100 vendas, site no ar)
5. Qual o prazo?

## Passo a passo

1. Crie `projetos/<nome-do-projeto>/` (minúsculas, sem acento, com hífen).
2. Copie `modelos/projeto/LEIA-ME.md` e `modelos/projeto/tarefas.md` pra dentro.
3. Preencha o LEIA-ME com as respostas.
4. Em `tarefas.md`, troque o título pelo nome do projeto e ponha as primeiras tarefas em "A fazer" (peça ao dono, ou sugira de 3 a 5 e confirme).
5. Ponha o prazo no cronograma: `- [ ] Entregar <projeto> @DD/MM #projeto`.
6. O código ou os arquivos do projeto ficam em outro lugar? Anote o caminho no LEIA-ME.
7. Diga: "Projeto criado. Ele aparece no menu Projetos, e as tarefas dele no Kanban."

## Quando o projeto acabar

Mude o status pra "entregue", anote o que aprendeu em `memoria/aprendizados.md` e pergunte se é pra arquivar (mover pra `projetos/_arquivados/`).
