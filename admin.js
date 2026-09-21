const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();

// Login do admin
router.post('/admin/login', async (req, res) => {
  const { usuario, senha } = req.body;

  if (usuario !== process.env.ADMIN_USER || senha !== process.env.ADMIN_PASS) {
    return res.status(401).json({ erro: 'Credenciais de admin inválidas' });
  }

  const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

// Middleware de admin
function autenticarAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Sem token' });
  try {
    const dados = jwt.verify(token, process.env.JWT_SECRET);
    if (!dados.admin) throw new Error();
    req.admin = dados;
    next();
  } catch {
    res.status(401).json({ erro: 'Token de admin inválido' });
  }
}

// ===== ROTAS DO ADMIN =====

// Dashboard: estatísticas gerais
router.get('/admin/dashboard', autenticarAdmin, async (req, res) => {
  const [[clientes]] = await db.query('SELECT COUNT(*) AS total FROM clientes');
  const [[vendas]] = await db.query("SELECT COUNT(*) AS total, COALESCE(SUM(valor_pago),0) AS receita FROM pedidos WHERE status='pago'");
  const [[licencas]] = await db.query('SELECT COUNT(*) AS total FROM licencas');
  const [[ativas]] = await db.query("SELECT COUNT(*) AS total FROM licencas WHERE status='ativa'");

  res.json({
    clientes: clientes.total,
    vendas: vendas.total,
    receita: vendas.receita,
    licencas: licencas.total,
    licencas_ativas: ativas.total
  });
});

// Listar todos os produtos com níveis
router.get('/admin/produtos', autenticarAdmin, async (req, res) => {
  const [rows] = await db.query(`
    SELECT p.id AS produto_id, p.nome AS produto, p.descricao, p.ativo,
           n.id AS nivel_id, n.nome AS nivel, n.preco, n.estoque,
           n.tipo_validade, n.duracao_dias
    FROM produtos p
    LEFT JOIN niveis n ON n.produto_id = p.id
    ORDER BY p.id, n.preco
  `);
  res.json(rows);
});

// Criar novo produto
router.post('/admin/produtos', autenticarAdmin, async (req, res) => {
  const { nome, descricao } = req.body;
  const [r] = await db.query(
    'INSERT INTO produtos (nome, descricao) VALUES (?, ?)',
    [nome, descricao || '']
  );
  res.json({ id: r.insertId, nome, descricao });
});

// Criar novo nível para um produto
router.post('/admin/niveis', autenticarAdmin, async (req, res) => {
  const { produto_id, nome, preco, estoque, tipo_validade, duracao_dias } = req.body;
  const [r] = await db.query(
    `INSERT INTO niveis (produto_id, nome, preco, estoque, tipo_validade, duracao_dias)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [produto_id, nome, preco, estoque, tipo_validade, duracao_dias || null]
  );
  res.json({ id: r.insertId });
});

// Atualizar estoque de um nível
router.put('/admin/niveis/:id/estoque', autenticarAdmin, async (req, res) => {
  const { estoque } = req.body;
  await db.query('UPDATE niveis SET estoque = ? WHERE id = ?', [estoque, req.params.id]);
  res.json({ sucesso: true });
});

// Listar todos os clientes
router.get('/admin/clientes', autenticarAdmin, async (req, res) => {
  const [rows] = await db.query(`
    SELECT c.id, c.nome, c.email, c.criado_em,
           (SELECT COUNT(*) FROM pedidos WHERE cliente_id = c.id AND status='pago') AS total_compras
    FROM clientes c
    ORDER BY c.criado_em DESC
  `);
  res.json(rows);
});

// Listar todas as licenças (com dados do cliente e produto)
router.get('/admin/licencas', autenticarAdmin, async (req, res) => {
  const [rows] = await db.query(`
    SELECT l.id, l.chave, l.status, l.dispositivo_id, l.expira_em, l.criado_em,
           c.nome AS cliente, c.email,
           p.nome AS produto, n.nome AS nivel
    FROM licencas l
    JOIN pedidos pe ON pe.id = l.pedido_id
    JOIN clientes c ON c.id = pe.cliente_id
    JOIN niveis n ON n.id = pe.nivel_id
    JOIN produtos p ON p.id = n.produto_id
    ORDER BY l.criado_em DESC
  `);
  res.json(rows);
});

// Revogar licença
router.put('/admin/licencas/:id/revogar', autenticarAdmin, async (req, res) => {
  await db.query("UPDATE licencas SET status='revogada' WHERE id = ?", [req.params.id]);
  res.json({ sucesso: true });
});

// Desvincular dispositivo (para trocar de PC)
router.put('/admin/licencas/:id/desvincular', autenticarAdmin, async (req, res) => {
  await db.query(
    "UPDATE licencas SET dispositivo_id = NULL, ativada_em = NULL WHERE id = ?",
    [req.params.id]
  );
  res.json({ sucesso: true });
});

module.exports = router;