import bcryptjs from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import Store from '../models/store.js';


export const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Verifica se o email já existe
    const existingStore = await Store.findOne({ email });
    if (existingStore) {
      return res.status(400).json({ error: 'Email já cadastrado.' });
    }

    // Hash da senha
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);
   
    const newStore = new Store({
      name,
      email,
      password: hashedPassword,
     });

    await newStore.save();

    const { password: _, ...storeData } = newStore._doc;

    return res.status(201).json({
      message: 'Conta criada com sucesso.',
      store: storeData
    });
  } catch (error) {
    console.error('Erro no register:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};