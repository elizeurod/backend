const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/loja'));
app.use('/api', require('./routes/comprar'));
app.use('/api', require('./routes/licencas'));
app.use('/api', require('./routes/admin'));   // ← ADICIONE ESTA LINHA

app.listen(process.env.PORT, () => {
  console.log(`Servidor rodando na porta ${process.env.PORT}`);
});