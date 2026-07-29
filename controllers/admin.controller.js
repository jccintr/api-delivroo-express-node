import bcryptjs from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import Admin from '../models/admin.js';

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Verifica se o email já existe
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Email já cadastrado.' });
    }

    // Hash da senha
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);
   
    const newAdmin = new Admin({
      name,
      email,
      password: hashedPassword,
    });

    await newAdmin.save();

    const { password: _, ...adminData } = newAdmin._doc;

    return res.status(201).json({
      message: 'Conta criada com sucesso.',
      admin: adminData
    });
  } catch (error) {
    console.error('Erro no register:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email }).select(
      'name email password active'
    );

    if (!admin) {
      return res.status(400).json({ error: 'Email ou senha inválidos.' });
    }

    if (!admin.active) {
      return res.status(403).json({ error: 'Conta desativada.' });
    }

    const isPasswordValid = await bcryptjs.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Email ou senha inválidos.' });
    }

    const token = jsonwebtoken.sign(
      { adminId: admin._id },
      process.env.JWT_SECRET_ADMIN
    );

    const { password: _, ...rest } = admin._doc;

   
    return res.status(200).json({
      ...rest,
      token
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const validateToken = async (req, res) => {
  try {
    const adminId = req.user?.id || req.body.adminId;

    const admin = await Admin.findById(adminId).select(
      'name email active'
    );

    if (!admin) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (!admin.active) {
      return res.status(403).json({ error: 'Conta desativada.' });
    }

    
    return res.status(200).json(admin);
  } catch (error) {
    console.error('Erro no validateToken:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const createAdminUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Verifica se o email já existe
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Email já cadastrado.' });
    }

    // Hash da senha
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);
   
    const newAdmin = new Admin({
      name,
      email,
      password: hashedPassword,
    });

    await newAdmin.save();

    const { password: _, ...adminData } = newAdmin._doc;

    return res.status(201).json({
      message: 'Conta criada com sucesso.',
      admin: adminData
    });
  } catch (error) {
    console.error('Erro no register:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};