import bcryptjs from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import Admin from '../models/admin.js';
import Rider from '../models/rider.js';
import { sendRiderAccountApprovedEmail } from '../utils/sendEmailV2.js';

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

// Aprovar conta do Rider
export const approveRider = async (req, res) => {
  try {
    const { id } = req.params;

    const rider = await Rider.findById(id);

    if (!rider) {
      return res.status(404).json({ error: 'Entregador não encontrado.' });
    }

    if (!rider.documentImage) {
      return res.status(400).json({ error: 'Documento ainda não enviado.' });
    }

    if (rider.accountApprovedAt) {
      return res.status(400).json({ error: 'Conta já aprovada.' });
    }

    rider.accountApprovedAt = new Date();
    await rider.save();

    // Envia e-mail de congratulação (não bloqueia a resposta em caso de falha)
    try {
      await sendRiderAccountApprovedEmail(rider.email, rider.name);
    } catch (mailError) {
      console.error('Erro ao enviar e-mail de aprovação do rider:', mailError);
    }

    const { password: _, ...riderData } = rider._doc;

    return res.status(200).json({
      message: 'Conta aprovada com sucesso.',
      rider: riderData
    });
  } catch (error) {
    console.error('Erro no approveRider:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// Ativar ou desativar conta do Rider
export const setRiderActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'O campo "active" deve ser true ou false.' });
    }

    const rider = await Rider.findById(id);

    if (!rider) {
      return res.status(404).json({ error: 'Entregador não encontrado.' });
    }

    rider.active = active;
    await rider.save();

    const { password: _, ...riderData } = rider._doc;

    return res.status(200).json({
      message: active ? 'Conta ativada com sucesso.' : 'Conta desativada com sucesso.',
      rider: riderData
    });
  } catch (error) {
    console.error('Erro no setRiderActive:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};