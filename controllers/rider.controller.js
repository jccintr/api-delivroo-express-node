import bcryptjs from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import Rider from '../models/rider.js';


export const register = async (req, res) => {
  try {
    const { name, email, password, phone, doc, vehicleType } = req.body;

    // Verifica se o email já existe
    const existingRider = await Rider.findOne({ email });
    if (existingRider) {
      return res.status(400).json({ error: 'Email já cadastrado.' });
    }

    // Hash da senha
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);
    const vehicle = {
        type: vehicleType,
        model: null,
        color:null,
        plate:null,
    }
    const newRider = new Rider({
      name,
      email,
      password: hashedPassword,
      phone,
      doc: doc || null,
      vehicle: vehicle || null
    });

    await newRider.save();

    const { password: _, ...riderData } = newRider._doc;

    return res.status(201).json({
      message: 'Conta criada com sucesso.',
      rider: riderData
    });
  } catch (error) {
    console.error('Erro no register:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const rider = await Rider.findOne({ email }).select(
      'name email phone password avatar doc active veiculo rating online'
    );

    if (!rider) {
      return res.status(400).json({ error: 'Email ou senha inválidos.' });
    }

    if (!rider.active) {
      return res.status(403).json({ error: 'Conta desativada.' });
    }

    const isPasswordValid = await bcryptjs.compare(password, rider.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Email ou senha inválidos.' });
    }

    const token = jsonwebtoken.sign(
      { riderId: rider._id },
      process.env.JWT_SECRET_RIDER
    );

    const { password: _, ...rest } = rider._doc;

   
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
    const riderId = req.user?.id || req.body.riderId;

    const rider = await Rider.findById(riderId).select(
      'name email phone avatar doc active vehicle rating online position'
    );

    if (!rider) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (!rider.active) {
      return res.status(403).json({ error: 'Conta desativada.' });
    }

    
    return res.status(200).json(rider);
  } catch (error) {
    console.error('Erro no validateToken:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};