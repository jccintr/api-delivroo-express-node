import bcryptjs from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import Store from '../models/store.js';
import { generateVerificationCode,sendStoreVerificationAccountEmail,sendStoreAccountVerifiedEmail,sendStorePasswordResetEmail }  from '../utils/sendEmailV2.js'



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
    const emailVerificationCode = generateVerificationCode();
    const newStore = new Store({
      name,
      email,
      phone,
      password: hashedPassword,
      emailVerificationCode
     });

    await newStore.save();
    sendStoreVerificationAccountEmail(newStore.email,emailVerificationCode);
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

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const store = await Store.findOne({ email }).select(
      'name email phone password avatar doc active'
    );

    if (!store) {
      return res.status(400).json({ error: 'Email ou senha inválidos.' });
    }


    const isPasswordValid = await bcryptjs.compare(password, store.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Email ou senha inválidos.' });
    }

     if (!store.active) {
      return res.status(403).json({ error: 'Conta desativada.' });
    }

    

    const token = jsonwebtoken.sign(
      { storeId: store._id },
      process.env.JWT_SECRET_STORE
    );

    const { password: _, ...rest } = store._doc;

   
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
    const storeId = req.user?.id || req.body.storeId;

    const store = await Store.findById(storeId).select(
      'name email phone avatar doc active'
    );

    if (!store) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }

    if (!store.active) {
      return res.status(403).json({ error: 'Conta desativada.' });
    }

    
    return res.status(200).json(store);
  } catch (error) {
    console.error('Erro no validateToken:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const verifyAccount = async (req,res) => {

    try {
        const storeId = req.user?.id
        const {code} = req.body;
       
        const store = await Store.findById(storeId).select('name email phone avatar doc active emailVerificationCode emailVerifiedAt ');

        if(store.emailVerifiedAt){
            return res.status(400).json({error:'Conta já verificada.'});
        }
        if(store.emailVerificationCode === code){
            store.emailVerifiedAt = new Date();
            store.emailVerificationCode = null;
            await store.save();
            sendStoreAccountVerifiedEmail(store.email);
            return res.status(200).json(store);
        } else {
            return res.status(403).json({error:'Código de verificação inválido.'});
        }
    } catch(error){
       console.error('Erro no validateToken:', error);
       return res.status(500).json({ error: 'Erro interno do servidor.' });
    }

}

export const requestPasswordCode = async (req, res) => {
  try {
    const { email } = req.body;

    // Resposta genérica — não revela se o e-mail existe
    const genericResponse = {
      message: 'Se este e-mail estiver cadastrado, enviaremos um código de verificação.',
    };

    const store = await Store.findOne({ email }).select(
      'email active resetPasswordCode resetPasswordCodeExpiresAt'
    );

    // E-mail não cadastrado: mesma resposta (não envia nada)
    if (!store) {
      return res.status(200).json(genericResponse);
    }

    // Conta desativada: também não revela
    if (store.active === false) {
      return res.status(200).json(genericResponse);
    }

    // Gera código e define expiração (15 minutos)
    const code = generateVerificationCode();
    store.resetPasswordCode = code;
    store.resetPasswordCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await store.save();

    // Envia e-mail (não bloqueia a resposta genérica se falhar — opcional)
    try {
      await sendStorePasswordResetEmail(store.email, code);
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

    const store = await Store.findOne({ email }).select(
      'email active resetPasswordCode resetPasswordCodeExpiresAt'
    );

    // Mesma mensagem genérica — não revela se o e-mail existe
    if (!store || store.active === false) {
      return res.status(403).json({ error: 'Código inválido ou expirado.' });
    }

    const expired = !store.resetPasswordCodeExpiresAt || store.resetPasswordCodeExpiresAt < new Date();

    if (!store.resetPasswordCode || store.resetPasswordCode !== code || expired ) {
      return res.status(403).json({ error: 'Código inválido ou expirado.' });
    }

    // Código válido — não invalida ainda (só no reset da senha)
    return res.status(200).json({ message: 'Código verificado com sucesso.', });
  } catch (error) {
    console.error('Erro no verifyPasswordCode:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};