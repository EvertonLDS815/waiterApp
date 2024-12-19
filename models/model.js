const mongoose = require('mongoose');
mongoose.connect(process.env.DB_URI);

// Schemas 
// Schema para produto
const productSchema = new mongoose.Schema({
    name: { type: String, require: true },
    price: { type: Number, require: true },
    imageURL: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });
  
const Product = mongoose.model('product', productSchema);

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
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'product', required: true },
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

module.exports = { Product, Table, Order, User, Waiter };