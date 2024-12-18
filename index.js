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
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const waiter = mongoose.model('User', UserSchema);

app.listen(port, () => console.log(`Server is running on http://localhost:${port}`));