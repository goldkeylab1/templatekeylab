# Receita: criar uma área nova

> Uma área é uma pasta de um assunto (vendas, financeiro, produto, clientes...). Ela vira um item no menu do painel sozinha.

## Quando usar

"quero uma área pra X", "um lugar pra guardar X", ou um perfil de negócio pede uma área.

## Perguntas (uma por vez, só o que faltar)

1. Qual o nome da área? (ex.: Vendas)
2. Pra que ela serve, numa frase?
3. O que você quer guardar nela? (3 a 5 coisas)
4. Tem algo que anda por etapas? Vira um quadro do kanban.
5. Tem números pra acompanhar? Vira um arquivo de perguntas.

## Passo a passo

1. Crie a pasta na raiz, em minúsculas, sem acento e com hífen (ex.: `vendas/`).
2. Copie `modelos/area/LEIA-ME.md` pra dentro dela e preencha: título, descrição, tabela de arquivos, regras, pedidos prontos e a seção "Menu do painel":
   - **Nome no menu:** curto, 1 ou 2 palavras.
   - **Ícone:** um destes: maleta, megafone, pasta, codigo, globo, carrinho, pessoas, video, livro, grafico, dinheiro, estrela, raio, coracao, loja, caixa, alvo, predio, foguete, lampada, chave.
   - **Ordem:** um número de 41 a 89 (o menu vai do menor pro maior).
3. Pra cada coisa a guardar, copie o molde certo e tire o `_` do nome:

   | É... | Molde | Vira |
   |---|---|---|
   | informação que se preenche uma vez | `modelos/area/_molde-configurar.md` | perguntas que contam no "Comece aqui" |
   | trabalho que anda por etapas | `modelos/area/_molde-quadro.md` | um quadro no Kanban |
   | coisas que se acumulam | `modelos/area/_molde-registro.md` | blocos `###`, o mais novo em cima |
   | um jeito de fazer (processo) | `modelos/receita.md` | uma receita em `<area>/metodo/` |

4. No AGENTS.md, acrescente a pasta no "8. Mapa da pasta" e uma linha na tabela da seção 4 ("Se o dono falar de X, salve em Y").
5. Diga: "Pronto. A área X já aparece no menu do painel."

## Regras

- Comece pequeno: 2 ou 3 arquivos. Dá pra crescer depois.
- Não repita o que já existe em `negocio/` ou `memoria/`: aponte pra lá.
