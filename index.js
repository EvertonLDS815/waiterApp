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

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const port = 3000 || process.env.PORT;            
app.use(express.json());                                                                                  
mongoose.connect(process.env.DB_URI, {
  useNewUrlParser: true, 
  useUnifiedTopology: true }
)
.then(() => {
  console.log('✅ MongoDB conectado');

  // Somente agora iniciamos o servidor
  server.listen(port, () => console.log(`Server is running on http://localhost:${port}`));
})
.catch((err) => {
  console.error('❌ Erro ao conectar ao MongoDB:', err.message);
});

// Schemas 
// Schema para Usuário (User)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Waiter', 'Admin'], default: 'Waiter' },
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

app.use(cors({
  origin: [
    'http://10.0.0.110:3001',
    'http://10.0.0.110:3002',
    'https://adminapp-el.netlify.app',
    'https://waiterapp-el.netlify.app'
  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const server = http.createServer(app);
const io = new Server(server);


// Login User
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ error: 'Email não encontrado' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    // ✅ Geração do token JWT
    const token = jwt.sign(
      { userId: user._id },           // payload
      process.env.JWT_SECRET,         // chave secreta
      { expiresIn: '1d' }             // validade de 1 dia
    );

    // ✅ Retorna o token no JSON
    res.status(200).json({
      message: 'Login bem-sucedido',
      token,
      user: {
        _id: user._id,
        email: user.email,
        // outros campos públicos se necessário
      }
    });

  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Create User
app.post('/create', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Verifica se já existe usuário com esse email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "Email already in use" });
    }

    // Criptografa a senha antes de salvar
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    return res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    console.error("Erro no cadastro:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
// Login Admin
app.post('/admin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ error: "Access denied!" });
    }

    // Verifica se o role é 'waiter'
    if (user.role === 'Waiter') {
      return res.status(403).json({ error: "Access denied for waiters!" });
    }

    // Verifica a senha
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials!" });
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

app.get('/user', auth, async (req, res) => {
  try {
  const user = await User.find();
  return res.status(200).json(user);
  } catch (err) {
    return res.status(500).json(err);
  }
});

// Get Email only
app.get('/user/email', auth, async (req, res) => {
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
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'meu-projeto', // Nome da pasta
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif'],
    public_id: (req, file) => {
      const nameWithoutExt = path.parse(file.originalname).name; // remove extensão
      return `${Date.now()}-${nameWithoutExt}`; // nome único sem duplicar a extensão
    },
  },
});

const upload = multer({storage});

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

    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: 'Imagem é obrigatória' });
    }

    const imageURL = req.file.path; // URL direta do Cloudinary

    const product = new Product({
      name,
      price,
      imageURL,
    });

    await product.save();

    io.emit('products@new', product);

    res.status(201).json(product);
  } catch (error) {
    console.error('❌ Erro ao salvar produto:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/product/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Encontra o produto primeiro
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    // Remove a imagem do Cloudinary
    // Aqui assumimos que product.imageURL é algo como "meu-projeto/1758026546-nome.jpg"
    // Se tiver a URL completa, podemos extrair o public_id:
    const publicId = product.imageURL
      .split('/')
      .slice(-2)
      .join('/')
      .split('.')[0]; // remove a extensão

    await cloudinary.uploader.destroy(publicId);

    // Remove o produto do banco de dados
    await Product.findByIdAndDelete(id);

    // Emite evento para o frontend
    io.emit('order@deleted', product);

    return res.sendStatus(204);
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
});

// rota table
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

app.get('/order/checked', auth, async (req, res) => {
  try {
    const order = await Order.find({ userId: req.userId}).populate('userId').populate('tableId').populate('items.productId');
    

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
    
    
    const orderChecked = await Order.findById(updatedOrder._id).populate('userId').populate('tableId').populate('items.productId');
    if (!updatedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }
    

    io.emit('order@checked', orderChecked);

    return res.status(200).json(orderChecked);
  } catch (err) {
    res.status(500).json(err);
  }
});

app.delete('/order/:id', async (req, res) => {
try {
  const { id } = req.params;
  try {
    const deletedOrder = await Order.findByIdAndDelete(id);
    if (deletedOrder) {
      io.emit('order@deleted', deletedOrder); // Certifique-se de que deletedOrder tem _id
      res.status(200).send(deletedOrder);
    } else {
      res.status(404).send({ error: 'Pedido não encontrado' });
    }
  } catch (error) {
    console.error('Erro ao deletar pedido:', error);
    res.status(500).send({ error: 'Erro no servidor' });
  }
  
} catch (err) {
  return res.status(500).json(err);
}
});