const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { autenticar } = require('./auth');
const router = express.Router();

// Gera chave no formato A1B2-C3D4-E5F6
function gerarChave() {
  const partes = [];
  for (let i = 0; i < 3; i++) {
    partes.push(crypto.randomBytes(2).toString('hex').toUpperCase());
  }
  return partes.join('-');
}

// Compra (simula pagamento aprovado na hora)
router.post('/comprar', autenticar, async (req, res) => {
  const { nivel_id } = req.body;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [niveis] = await conn.query(
      'SELECT * FROM niveis WHERE id = ? FOR UPDATE',
      [nivel_id]
    );
    if (niveis.length === 0) throw new Error('Nível não existe');

    const nivel = niveis[0];
    if (nivel.estoque <= 0) throw new Error('Sem estoque');

    // Cria pedido como pago
    const [pedido] = await conn.query(
      `INSERT INTO pedidos (cliente_id, nivel_id, valor_pago, status)
       VALUES (?, ?, ?, 'pago')`,
      [req.cliente.id, nivel_id, nivel.preco]
    );

    // Subtrai estoque
    await conn.query('UPDATE niveis SET estoque = estoque - 1 WHERE id = ?', [nivel_id]);

    // Calcula expiração
    let expira_em = null;
    if (nivel.tipo_validade === 'dias') {
      const d = new Date();
      d.setDate(d.getDate() + nivel.duracao_dias);
      expira_em = d;
    }

    // Gera chave e insere licença
    const chave = gerarChave();
    await conn.query(
      'INSERT INTO licencas (pedido_id, chave, expira_em) VALUES (?, ?, ?)',
      [pedido.insertId, chave, expira_em]
    );

    await conn.commit();
    res.json({ sucesso: true, chave, expira_em });
  } catch (e) {
    await conn.rollback();
    res.status(400).json({ erro: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;