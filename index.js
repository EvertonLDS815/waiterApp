const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const port = 3000 || process.env.PORT;

app.use(express.json());
app.use(cors());

mongoose.connect(process.env.DB_URI);

// Schemas
// Schema para Mesa (Table)
const TableSchema = new mongoose.Schema({
  number: { type: Number, required: true, unique: true }, // Número da mesa
});

const Table = mongoose.model('table', TableSchema);

// Schema para Pedido (Order)
const OrderSchema = new mongoose.Schema({
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'table', required: true }, // Relacionamento com mesa
  waiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'waiter', required: true }, // Garçom responsável
  items: [
    {
      name: { type: String, required: true }, // Nome do item
      quantity: { type: Number, required: true }, // Quantidade do item
    },
  ],
  createdAt: { type: Date, default: Date.now }, // Data do pedido
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' }, // Status do pedido
});

const Order = mongoose.model('order', OrderSchema);

// Schema para Usuário (User)
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'waiter'], default: 'user' }, // Papel do usuário
});

const User = mongoose.model('user', UserSchema);
const Waiter = mongoose.model('waiter', UserSchema);

module.exports = { Table, Order, User, Waiter };

app.listen(port, () => console.log(`Server is running on http://localhost:${port}`));