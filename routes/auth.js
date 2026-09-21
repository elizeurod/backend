const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();

// Cadastro de cliente
router.post('/cadastro', async (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha)
    return res.status(400).json({ erro: 'Preencha todos os campos' });

  const hash = await bcrypt.hash(senha, 10);
  try {
    const [r] = await db.query(
      'INSERT INTO clientes (nome, email, senha_hash) VALUES (?, ?, ?)',
      [nome, email, hash]
    );
    res.json({ id: r.insertId, nome, email });
  } catch (e) {
    res.status(400).json({ erro: 'Email já cadastrado' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  const [rows] = await db.query('SELECT * FROM clientes WHERE email = ?', [email]);
  if (rows.length === 0) return res.status(401).json({ erro: 'Credenciais inválidas' });

  const cliente = rows[0];
  const ok = await bcrypt.compare(senha, cliente.senha_hash);
  if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas' });

  const token = jwt.sign({ id: cliente.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, nome: cliente.nome });
});

// Middleware de autenticação
function autenticar(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Sem token' });
  try {
    req.cliente = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido' });
  }
}

module.exports = router;
module.exports.autenticar = autenticar;