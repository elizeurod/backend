const express = require('express');
const db = require('../db');
const { autenticar } = require('./auth');
const router = express.Router();

// Lista as licenças do cliente logado
router.get('/minhas-licencas', autenticar, async (req, res) => {
  const [rows] = await db.query(`
    SELECT l.chave, l.status, l.expira_em, l.criado_em,
           n.nome AS nivel, p.nome AS produto
    FROM licencas l
    JOIN pedidos pe ON pe.id = l.pedido_id
    JOIN niveis n ON n.id = pe.nivel_id
    JOIN produtos p ON p.id = n.produto_id
    WHERE pe.cliente_id = ?
    ORDER BY l.criado_em DESC
  `, [req.cliente.id]);
  res.json(rows);
});

// Validação usada pelo software do cliente (pública)
router.post('/validar', async (req, res) => {
  const { chave, dispositivo_id } = req.body;

  const [rows] = await db.query('SELECT * FROM licencas WHERE chave = ?', [chave]);
  if (rows.length === 0) return res.json({ valido: false, motivo: 'inexistente' });

  const lic = rows[0];
  if (lic.status !== 'ativa') return res.json({ valido: false, motivo: lic.status });

  if (lic.expira_em && new Date(lic.expira_em) < new Date()) {
    await db.query("UPDATE licencas SET status='expirada' WHERE id=?", [lic.id]);
    return res.json({ valido: false, motivo: 'expirada' });
  }

  if (!lic.dispositivo_id) {
    await db.query(
      'UPDATE licencas SET dispositivo_id = ?, ativada_em = NOW() WHERE id = ?',
      [dispositivo_id, lic.id]
    );
  } else if (lic.dispositivo_id !== dispositivo_id) {
    return res.json({ valido: false, motivo: 'em uso em outro dispositivo' });
  }

  res.json({ valido: true, vitalicia: lic.expira_em === null, expira_em: lic.expira_em });
});

module.exports = router;