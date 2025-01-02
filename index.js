const express = require('express');
const cors = require('cors');
require('dotenv').config();
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const port = 3000 || process.env.PORT;
mongoose.connect(process.env.DB_URI);

// Schemas 
// Schema para Usuário (User)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['waiter', 'admin'], default: 'waiter' },
});
const User = mongoose.model('user', userSchema);

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  imageURL: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });
const Product = mongoose.model('product', productSchema);

const tableSchema = new mongoose.Schema({
  number: { type: Number, required: true },
});
const Table = mongoose.model('table', tableSchema);

const orderSchema = new mongoose.Schema({
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'table', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  items: [
      {
          productId: { type: mongoose.Schema.Types.ObjectId, ref: 'product', required: true },
          quantity: { type: Number, required: true },
      },
  ],
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
});

const Order = mongoose.model('order', orderSchema);

app.use(express.json());
app.use(cors({
  origin: [
    'http://10.0.0.110:3001',
    'http://10.0.0.110:3002'
  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const server = http.createServer(app);
const io = new Server(server);;


// Create User
app.post('/user', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const user = new User({ email, password: hashedPassword });
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({error: err});
  }
});

// Login User
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && await bcrypt.compare(password, user.password)) {
      // Configura o token com duração de 1 dia
      const token = jwt.sign(
        { userId: user._id }, 
        process.env.JWT_SECRET, 
        { expiresIn: '1d' } // Duração de 1 dia
      );
      return res.status(201).json( {token});
    } else {
      return res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post('/admin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verifica se o role é 'waiter'
    if (user.role === 'waiter') {
      return res.status(403).json({ error: "Access denied for waiters" });
    }

    // Verifica a senha
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Gera o token
    const token = jwt.sign(
      { userId: user._id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1d' } // Duração de 1 dia
    );

    return res.status(201).json({ token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});



const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    // Verifica se o token existe
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // Tenta verificar e decodificar o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Armazena o ID do usuário no request para acesso posterior
    req.userId = decoded.userId;
    next();
  } catch (err) {
    // Diferencia erros de token expirado e outros erros de token
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token. Access denied.' });
    } else {
      return res.status(400).json({ error: 'An error occurred during authentication.' });
    }
  }
};

// Get Email only
app.get('/user', auth, async (req, res) => {
  try {
    const response = await User.findById(req.userId);
    if (!response) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(response);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/user/:id', async (req, res) => {

  const {id} = req.params;
  try {
    const user = await User.findOneAndUpdate(
      {_id: id},
      [
        {
          $set: {
            role: {
              $cond: { if: { $eq: ["$role", "Admin"] }, then: "Waiter", else: "Admin" },
            },
          },
        },
      ],
      { new: true } // Retorna o documento atualizado
    );

    if (!user) {
      return res.status(404).json({ error: "Product not found or unauthorized" });
    }
    return res.status(200).json(user);
  } catch (err) {
    return res.status(500).json(err);
  }
});
// Configuração do Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Pasta onde as imagens serão salvas
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`); // Nome único para a imagem
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif/; // Tipos de arquivo permitidos
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = fileTypes.test(file.mimetype);

    if (extname && mimeType) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas!'));
    }
  },
});
// Rota Products
app.get('/products', auth, async (req, res) => {
  try {
    const products = await Product.find().sort({createdAt: 1});
    return res.status(200).json(products);
  } catch (err) {
    return res.status(500).json(err);
  }
});
app.post('/product', upload.single('image'), async (req, res) => {
  try {
    const { name, price } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Imagem é obrigatória' });
    }

    const imageURL = `/uploads/${req.file.filename}`; // Caminho da imagem

    const product = new Product({
      name,
      price,
      imageURL,
    });

    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// rota table
app.get('/tables', async (req, res) => {
try {
  const table = await Table.find();
  return res.status(200).json(table);
  
} catch (err) {
  return res.status(500).json(err);
}
});

app.get('/table/:id', async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }
    return res.json(table);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/table', async (req, res) => {
  try {
    const { number } = req.body;
    const table = new Table({number});

    await table.save();
    return res.status(201).json(table);
  } catch (err) {
    return res.status(500).json({ error: err.message });
}
});
app.patch('/table/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { number } = req.body;

    // Validações básicas
    if (!id || !number) {
      return res.status(400).json({ error: 'ID e número são obrigatórios' });
    }

    // Atualiza o campo "number"
    const updatedTable = await Table.findByIdAndUpdate(
      id,
      { number },
      { new: true } // Retorna o documento atualizado
    );

    if (!updatedTable) {
      return res.status(404).json({ error: 'Mesa não encontrada' });
    }

    return res.status(200).json(updatedTable);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar o número da mesa' });
  }
});

app.delete('/table/:id', async (req, res) => {
  try {
    const {id} = req.params;
    await Table.findOneAndDelete({_id: id});
    return res.sendStatus(204);
    
  } catch (err) {
    return res.status(500).json(err);
  }
});

// rota orders
app.get('/orders', async (req, res) => {
  try {
    const order = await Order.find().sort({createdAt: 1}).populate('userId').populate('tableId').populate('items.productId');
    return res.status(200).json(order);
  } catch (err) {
    return res.status(500).json(err);
  }
});

app.get('/order/table/:id', async (req, res) => {
  try {
    const { id } = req.params; // Pega o 'id' da tabela da URL

    // Encontra a ordem onde o 'tableId' é igual ao 'id' fornecido
    const order = await Order.findOne({ tableId: id }).populate('userId').populate('tableId').populate('items.productId');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    return res.status(200).json(order); // Retorna os dados da ordem
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.post('/order', auth, async (req, res) => {
  try {
    const order = req.body;
    if (order.items.length === 0) {
      return res.status(400).json('Continue sem pedir seu miseravi!');
    }

    const createdOrder = await Order.create(order);
    const orderDetails = await Order.findById(createdOrder._id)
      .populate('userId')
      .populate('tableId')
      .populate('items.productId');

    io.emit('orders@new', orderDetails);
    return res.status(201).json(orderDetails);  // Envia a resposta para o frontend
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.patch('/order/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const updatedOrder = await Order.findOneAndUpdate(
      {_id: id},
      [
        {
          $set: {
            status: {
              $cond: { if: { $eq: ["$status", "pending"] }, then: "completed", else: "pending" },
            },
          },
        },
      ],
      { new: true } // Retorna o documento atualizado
    );

    if (!updatedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.sendStatus(204);
  } catch (err) {
    res.status(500).json(err);
  }
});

app.delete('/order/:id', async (req, res) => {
try {
  const {id} = req.params;
  const order = await Order.findOneAndDelete({_id: id});
  await Table.findOneAndDelete(order.tableId);
  return res.sendStatus(204);
  
} catch (err) {
  return res.status(500).json(err);
}
});

server.listen(port, '0.0.0.0', () => console.log(`Server is running on http://localhost:${port}`));