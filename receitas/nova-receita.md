# Receita: criar uma receita nova

> Receita é o passo a passo de uma tarefa que se repete. Você segue toda vez, sempre igual.

## Quando usar

"receita nova", "automatiza isso", "quero fazer isso sempre igual", ou você fez a mesma tarefa pela segunda vez.

## Perguntas (uma por vez)

1. Que tarefa é? (ex.: responder orçamento)
2. Que frases você fala quando quer isso? (ex.: "faz um orçamento", "manda proposta")
3. O que eu preciso ler antes? (arquivos)
4. Quais são os passos? (se o dono não souber, proponha e confirme)
5. Onde salvo o resultado?

## Passo a passo

1. Copie `modelos/receita.md` pra `receitas/<nome>.md` (minúsculas, sem acento, com hífen) e preencha. Se for de uma área, ponha em `<area>/metodo/`.
2. Acrescente uma linha na tabela da seção 6 do AGENTS.md: quando o dono disser... siga o arquivo.
3. No Claude Code, crie também `.claude/skills/<nome>/SKILL.md`, com este conteúdo:

   ```
   ---
   name: <nome>
   description: <o que faz>. Use quando o dono disser "<frase 1>" ou "<frase 2>".
   ---
   Abra e siga o arquivo `receitas/<nome>.md`.
   ```

4. Teste: faça a tarefa uma vez seguindo a receita e ajuste o que ficou confuso.
5. Diga: "Receita criada. Da próxima vez é só dizer: <frase>."

Ideias de receitas: `modelos/catalogo-de-receitas.md`.
