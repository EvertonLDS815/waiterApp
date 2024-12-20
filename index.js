const express = require('express');
const cors = require('cors');
require('dotenv').config();
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000 || process.env.PORT;
const { Product, Table, Order, User } = require('./models/model');

app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
    console.error(err);
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
      res.json({ token });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({error: 'Access denied. No token provided.'});
    }
  
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.userId;
      next();
    } catch (err) {
        return res.status(400).json(err);
    }
};

// Get Email only
app.get('/user', auth, async (req, res) => {
  try {
    const {email} = await User.findById(req.userId);
    if (!email) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(email);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/users/:id', auth, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      req.userId,
      [
        {
          $set: {
            role: {
              $cond: { if: { $eq: ["$role", "user"] }, then: "waiter", else: "user" },
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
    console.error(err);
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
app.get('/product', auth, async (req, res) => {
  try {
    const product = await Product.find();
    return res.status(200).json(product);
    
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
app.post('/table', async (req, res) => {
  try {
    const { number } = req.body;
    const table = new Table({number});

    await table.save();
    console.log(table)
    return res.status(201).json(table);
  } catch (err) {
    console.log(err);
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
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar o número da mesa' });
  }
});

// rota table
app.get('/orders', async (req, res) => {
  try {
    const order = await Order.find();
    return res.status(200).json(order);
    
  } catch (err) {
    return res.status(500).json(err);
  }
});

app.post('/order', async (req, res) => {
  try {
    const order = req.body;
    const neworder = new Order(order);

    await neworder.save();
    return res.status(201).json(neworder);
  } catch (err) {
    return res.status(500).json(err);
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
    console.error(err);
    res.status(500).json(err);
  }
});

app.delete('/order/:id', async (req, res) => {
try {
  const {id} = req.params;
  await Order.findOneAndDelete({_id: id});
  return res.sendStatus(204);
  
} catch (err) {
  return res.status(500).json(err);
}
});

app.listen(port, () => console.log(`Server is running on http://localhost:${port}`));