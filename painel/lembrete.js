#!/usr/bin/env node
// Lembrete que o Claude Code recebe a cada mensagem (gancho UserPromptSubmit).
// O texto fica em .claude/lembrete.txt, pra ser fácil de mudar.
'use strict';

const fs = require('fs');
const path = require('path');

const arquivo = path.join(__dirname, '..', '.claude', 'lembrete.txt');
try {
  process.stdout.write(fs.readFileSync(arquivo, 'utf8'));
} catch {
  process.stdout.write('[Lembrete] Se a mensagem trouxer algo novo do negócio (feedback, ideia, decisão, tarefa, correção), salve no arquivo certo (AGENTS.md, seção 4) e avise numa linha.');
}
