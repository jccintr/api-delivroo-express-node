import bcryptjs from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import Rider from '../models/rider.js';
import { generateVerificationCode,sendRiderVerificationAccountEmail,sendAccountVerifiedEmail,sendRiderPasswordResetEmail }  from '../utils/sendEmailV2.js'


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
    const emailVerificationCode = generateVerificationCode();
    
    const newRider = new Rider({
      name,
      email,
      password: hashedPassword,
      phone,
      doc: doc || null,
      vehicle: vehicle || null,
      emailVerificationCode
    });

    await newRider.save();

    // envia o email para o usuário com o código de verificação da conta
   
    sendRiderVerificationAccountEmail(newRider.email,emailVerificationCode);

    const { password: _, emailVerificationCode: __, resetPasswordCode: ___, ...riderData } = newRider._doc;
    

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
      'name email phone password avatar doc active emailVerifiedAt accountApprovedAt vehicle online'
    );

    if (!rider) {
      return res.status(400).json({ error: 'Email ou senha inválidos.' });
    }


    const isPasswordValid = await bcryptjs.compare(password, rider.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Email ou senha inválidos.' });
    }

     if (!rider.active) {
      return res.status(403).json({ error: 'Conta desativada.' });
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
      'name email phone avatar doc active emailVerifiedAt accountApprovedAt vehicle online'
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

export const verifyAccount = async (req,res) => {

    try {
        const riderId = req.user?.id
        const {code} = req.body;
       
        const rider = await Rider.findById(riderId).select('name email phone avatar doc active accountApprovedAt vehicle online emailVerificationCode emailVerifiedAt');
        if(rider.emailVerifiedAt){
            return res.status(400).json({error:'Conta já verificada.'});
        }
        if(rider.emailVerificationCode === code){
            rider.emailVerifiedAt = new Date();
            rider.emailVerificationCode = null;
            await rider.save();
            sendAccountVerifiedEmail(rider.email);
            return res.status(200).json(rider);
        } else {
            return res.status(403).json({error:'Código de verificação inválido.'});
        }
    } catch(error){
       console.error('Erro no validateToken:', error);
       return res.status(500).json({ error: 'Erro interno do servidor.' });
    }

}

export const resendAccountVerificationCode = async (req, res) => {
  try {
    const riderId = req.user?.id;

    const rider = await Rider.findById(riderId).select('email emailVerifiedAt emailVerificationCode');

    if (!rider) {
      return res.status(404).json({ error: 'Rider não encontrado.' });
    }

    if (rider.emailVerifiedAt) {
      return res.status(400).json({ error: 'Conta já verificada.' });
    }

    // Gera novo código
    const code = generateVerificationCode();
    rider.emailVerificationCode = code;
    await rider.save();

    // Envia e-mail
    await sendRiderVerificationAccountEmail(rider.email, code);

    return res.status(200).json({message: 'Código de verificação reenviado.', });
  } catch (error) {
      console.error('Erro no resendVerificationCode:', error);
      return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const requestPasswordCode = async (req, res) => {
  try {
    const { email } = req.body;

    // Resposta genérica — não revela se o e-mail existe
    const genericResponse = {
      message: 'Se este e-mail estiver cadastrado, enviaremos um código de verificação.',
    };

    const rider = await Rider.findOne({ email }).select(
      'email active resetPasswordCode resetPasswordCodeExpiresAt'
    );

    // E-mail não cadastrado: mesma resposta (não envia nada)
    if (!rider) {
      return res.status(200).json(genericResponse);
    }

    // Conta desativada: também não revela
    if (rider.active === false) {
      return res.status(200).json(genericResponse);
    }

    // Gera código e define expiração (15 minutos)
    const code = generateVerificationCode();
    rider.resetPasswordCode = code;
    rider.resetPasswordCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await rider.save();

    // Envia e-mail (não bloqueia a resposta genérica se falhar — opcional)
    try {
      await sendRiderPasswordResetEmail(rider.email, code);
    } catch (mailError) {
      console.error('Erro ao enviar e-mail de recuperação:', mailError);
      // Ainda retorna 200 para não vazar informação
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error('Erro no requestPasswordCode:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const verifyPasswordCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    const rider = await Rider.findOne({ email }).select(
      'email active resetPasswordCode resetPasswordCodeExpiresAt'
    );

    // Mesma mensagem genérica — não revela se o e-mail existe
    if (!rider || rider.active === false) {
      return res.status(403).json({ error: 'Código inválido ou expirado.' });
    }

    const expired = !rider.resetPasswordCodeExpiresAt || rider.resetPasswordCodeExpiresAt < new Date();

    if (!rider.resetPasswordCode || rider.resetPasswordCode !== code || expired ) {
      return res.status(403).json({ error: 'Código inválido ou expirado.' });
    }

    // Código válido — não invalida ainda (só no reset da senha)
    return res.status(200).json({ message: 'Código verificado com sucesso.', });
  } catch (error) {
    console.error('Erro no verifyPasswordCode:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const resetPassword = async (req, res) => {
    const { email,code,password } = req.body;
}
  