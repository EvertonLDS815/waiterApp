const express = require('express');
const cors = require('cors');
require('dotenv').config();
const multer = require('multer');
const path = require('path');

const app = express();
const port = 3000 || process.env.PORT;
const { Product, Table, Order, User, Waiter } = require('./models/model');

app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rota User
app.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    return res.status(200).json(users);
  } catch (err) {
    return res.status(500).json(err);
  }
});
app.post('/user', async (req, res) => {
  try {
    const user = await User.create();
    return res.status(201).json(user);
  } catch (err) {
    return res.status(500).json(err);
  }
});
app.get('/user/:id', async (req, res) => {
  try {
    const {id} = req.params;
    const user = await User.find({_id: id});
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
app.get('/product', async (req, res) => {
  try {
    const product = await Product.find();
    return res.status(200).json(product);
    
  } catch (err) {
    return res.status(500).json(err);
  }
});
app.post('/product', upload.single('image'), async (req, res) => {
  try {
    const { name, description, price } = req.body;

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



app.listen(port, () => console.log(`Server is running on http://localhost:${port}`));