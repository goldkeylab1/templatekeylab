// Erro com mensagem simples pra mostrar no painel.
'use strict';

class ErroPainel extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

const MUDOU = 'A lista mudou enquanto você mexia (talvez a IA tenha editado). Já recarreguei: tente de novo.';

module.exports = { ErroPainel, MUDOU };
