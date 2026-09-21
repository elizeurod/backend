const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/loja', async (req, res) => {
  const [rows] = await db.query(`
    SELECT
      p.id AS produto_id, p.nome AS produto,
      n.id AS nivel_id, n.nome AS nivel, n.preco,
      n.tipo_validade, n.duracao_dias, n.estoque
    FROM produtos p
    JOIN niveis n ON n.produto_id = p.id
    WHERE p.ativo = TRUE AND n.estoque > 0
    ORDER BY p.id, n.preco
  `);
  res.json(rows);
});

module.exports = router;