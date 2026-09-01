import bcryptjs from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import Store from '../models/store.js';
import City from '../models/city.js';
import { generateVerificationCode,sendStoreVerificationAccountEmail,sendStoreAccountVerifiedEmail,sendStorePasswordResetEmail }  from '../utils/sendEmailV2.js'
import cloudinary from '../utils/cloudinary.js';
import { geocodeAddress } from '../utils/googleMaps.js';
import { buildStoreAddressText } from '../utils/address.js';


export const register = async (req, res) => {
  try {
    const { name, email, password, phone, cityId } = req.body;

    // verifica se a cidade existe e está ativa
    const city = await City.findById(cityId).select('_id active');

    if (!city) {
      return res.status(400).json({ error: 'Cidade não encontrada.' });
    }
    
    if (!city.active) {
      return res.status(400).json({ error: 'Cidade não está disponível para cadastro.' });
    }
    
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
      city: cityId,
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
      'name email phone password avatar doc active address emailVerifiedAt city'
    ).populate('city', 'name state');

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
      'name email phone avatar doc active address emailVerifiedAt city'
    ).populate('city', 'name state');

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

export const resendAccountVerificationCode = async (req, res) => {
  try {
    const storeId = req.user?.id;

    const store = await Store.findById(storeId).select('email emailVerifiedAt emailVerificationCode');

    if (!store) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }

    if (store.emailVerifiedAt) {
      return res.status(400).json({ error: 'Conta já verificada.' });
    }

    // Gera novo código
    const code = generateVerificationCode();
    store.emailVerificationCode = code;
    await store.save();

    // Envia e-mail
    await sendStoreVerificationAccountEmail(store.email, code);

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

export const resetPassword = async (req, res) => {
  try {
    const { email, code, password } = req.body;

    const store = await Store.findOne({ email }).select('email active password resetPasswordCode resetPasswordCodeExpiresAt' );

    if (!store || store.active === false) {
      return res.status(403).json({ error: 'Código inválido ou expirado.' });
    }

    const expired = !store.resetPasswordCodeExpiresAt || store.resetPasswordCodeExpiresAt < new Date();

    if (!store.resetPasswordCode || store.resetPasswordCode !== code || expired ) {
      return res.status(403).json({ error: 'Código inválido ou expirado.' });
    }

    // Atualiza a senha
    const salt = await bcryptjs.genSalt(10);
    store.password = await bcryptjs.hash(password, salt);

    // Invalida o código
    store.resetPasswordCode = null;
    store.resetPasswordCodeExpiresAt = null;

    await store.save();

    return res.status(200).json({
      message: 'Senha redefinida com sucesso.',
    });
  } catch (error) {
    console.error('Erro no resetPassword:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const storeId = req.user?.id;
    const { name, phone, doc, address } = req.body;

    const store = await Store.findById(storeId)
      .select('name email phone avatar doc active emailVerifiedAt address city')
      .populate('city', 'name state');

    if (!store) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }

    if (!store.emailVerifiedAt) {
      return res.status(403).json({ error: 'Conta ainda não verificada.' });
    }

    if (store.active === false) {
      return res.status(403).json({ error: 'Conta desativada.' });
    }

    if (name !== undefined) store.name = name;
    if (phone !== undefined) store.phone = phone;
    if (doc !== undefined) store.doc = doc || null;

    let locationWarning = false;

    if (address !== undefined && address !== null) {
      const previousAddress = store.address ? store.address.toObject() : {};
      // city/state saíram do address — vêm do model City
      const ADDRESS_TEXT_FIELDS = ['street', 'number', 'complement', 'district', 'zipCode'];

      const mergedAddress = {
        street: address.street !== undefined ? address.street : previousAddress.street,
        number: address.number !== undefined ? address.number : previousAddress.number,
        complement: address.complement !== undefined ? address.complement : previousAddress.complement,
        district: address.district !== undefined ? address.district : previousAddress.district,
        zipCode: address.zipCode !== undefined ? address.zipCode : previousAddress.zipCode,
        latitude: previousAddress.latitude,
        longitude: previousAddress.longitude,
      };

      const addressTextChanged = ADDRESS_TEXT_FIELDS.some(
        (field) => (mergedAddress[field] || '') !== (previousAddress[field] || '')
      );
      const missingLocation =
        previousAddress.latitude == null || previousAddress.longitude == null;

      store.address = mergedAddress;

      if (addressTextChanged || missingLocation) {
        const addressText = buildStoreAddressText(mergedAddress, store.city);

        if (addressText) {
          try {
            const geocoded = await geocodeAddress(addressText);

            if (geocoded) {
              store.address.latitude = geocoded.latitude;
              store.address.longitude = geocoded.longitude;
            } else if (addressTextChanged) {
              store.address.latitude = null;
              store.address.longitude = null;
              locationWarning = true;
            }
          } catch (error) {
            console.error('Erro ao geocodificar endereço da loja:', error);
            if (addressTextChanged) {
              locationWarning = true;
            }
          }
        }
      }
    }

    await store.save();

    return res.status(200).json({ ...store.toObject(), locationWarning });
  } catch (error) {
    console.error('Erro no updateProfile:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    const storeId = req.user?.id;

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
    }

    const store = await Store.findById(storeId).select('avatar');
    if (!store) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }

    // Remove avatar antigo no Cloudinary (se existir public_id salvo)
    // Opcional: se você guardar avatarPublicId no model

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'delivroo/stores',
          public_id: `store_${storeId}`,
          overwrite: true,
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      uploadStream.end(req.file.buffer);
    });

    store.avatar = result.secure_url;
    await store.save();

    return res.status(200).json({
      message: 'Avatar atualizado com sucesso.',
      avatar: result.secure_url,
    });
  } catch (error) {
    console.error('Erro no uploadAvatar:', error);
    if (error.message?.includes('File too large')) {
      return res.status(400).json({ error: 'Imagem muito grande. Máximo 2 MB.' });
    }
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};