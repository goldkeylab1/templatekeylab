# Receita: configurar o negócio

> A entrevista que monta o cérebro. Curta, uma pergunta por vez, salvando a cada resposta.

## Quando usar

- "configurar", "começar", "instalar", "primeira vez", ou o `painel/contexto.js` mostra a configuração abaixo de 100%.
- "configurar só a marca" (ou outra parte): vá direto pra parte pedida.

## Antes de começar

1. Rode `node painel/contexto.js --sem-painel` (se puder rodar comandos) pra ver o que falta.
2. Explique em 2 linhas: "Vou te fazer perguntas curtas, uma de cada vez. Não sabe? É só dizer 'pula'. Eu anoto tudo nos arquivos."

## Passo 1: o tipo de negócio

Pergunte, com as opções numeradas: "Qual é o seu negócio? Pode escolher mais de um."

1. Canal ou criador de conteúdo (YouTube, Instagram, TikTok) → `modelos/perfis/criador.md`
2. Software, app ou SaaS → `modelos/perfis/software.md`
3. Site, blog ou loja online → `modelos/perfis/site-ou-loja.md`
4. Serviços (agência, freela, consultoria) → `modelos/perfis/servicos.md`
5. Negócio local (loja, restaurante, clínica, salão) → `modelos/perfis/negocio-local.md`
6. Curso, mentoria ou produto digital → `modelos/perfis/produto-digital.md`
7. Outro → `modelos/perfis/outro.md`

Anote em `negocio/empresa.md` ("Tipo de negócio") e leia o perfil escolhido.

## Passo 2: as perguntas, na ordem

Pergunte só o que estiver vazio, nesta ordem:

1. `negocio/empresa.md`
2. `negocio/publico.md`
3. `negocio/oferta.md`
4. `negocio/marca.md`
5. `negocio/voz.md`
6. `negocio/estrategia.md`
7. `negocio/concorrentes.md`
8. `marketing/canais.md`
9. `marketing/estrategia.md`
10. As perguntas extras do perfil

Como perguntar:

- Uma pergunta por mensagem, com as palavras do arquivo e um exemplo curto.
- Perguntas pequenas e ligadas (nome e cidade, por exemplo) podem ir juntas, no máximo 3.
- "Pula" ou "não sei": deixe vazio e siga.
- Não serve pro negócio: escreva "não se aplica".
- Resposta longa: o resumo vai na pergunta; o detalhe vai em "Mais detalhes" do mesmo arquivo.
- Salve logo depois de cada resposta, editando só a linha da pergunta. Não deixe pro fim.
- A cada arquivo pronto, diga numa linha: "Pronto: Público. Agora: Oferta."
- O dono quer parar? Pare, diga o que falta e que dá pra continuar escrevendo "configurar".

## Passo 3: a marca no painel

- Peça a cor principal. Se ele disser só o nome da cor, converta pra código com # e confirme.
- Peça o logo: ele arrasta o arquivo pra `arquivos/marca/` (com o nome `logo.png`) ou usa o painel (Ajustes, Logo).
- Anote em `negocio/marca.md` ("Cor principal" e "Logo"). O painel troca as cores sozinho.

## Passo 4: aplicar o perfil

Pra cada perfil escolhido:

1. Crie as áreas que ele pede, seguindo `receitas/nova-area.md` e os moldes de `modelos/area/`. Antes, confirme com o dono em uma linha.
2. Copie as regras do perfil pra "11. Regras do meu negócio", no fim do AGENTS.md.
3. Diga o que criou, uma linha por item.

## Passo 5: GitHub

Siga `receitas/salvar-no-github.md`.

## Passo 6: fechar

1. Rode `node painel/contexto.js` e mostre a porcentagem.
2. No cronograma, marque como feitas as tarefas `#comecar` que já foram feitas, e crie uma tarefa pra cada parte que ficou faltando.
3. Abra o painel: `node painel/ligar.js --abrir`.
4. Termine com: "Pronto! Agora é só conversar comigo sobre o seu dia a dia. Eu anoto sozinho o que for importante."
