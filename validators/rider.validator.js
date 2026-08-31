import { body } from 'express-validator';

export const registerValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Nome é obrigatório')
    .isLength({ min: 3 }).withMessage('Nome deve ter pelo menos 3 caracteres'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email é obrigatório')
    .isEmail().withMessage('Email inválido'),

  body('password')
    .notEmpty().withMessage('Senha é obrigatória')
    .isLength({ min: 3 }).withMessage('Senha deve ter pelo menos 3 caracteres'),

  body('phone')
    .trim()
    .notEmpty().withMessage('Telefone é obrigatório'),

  body('vehicleType')
    .optional()
    .isIn(['Carro', 'Moto', 'Bicicleta']).withMessage('Tipo de veículo inválido. Deve ser Carro, Moto ou Bicicleta'),
  
  body('cityId')
  .notEmpty().withMessage('Cidade é obrigatória')
  .isMongoId().withMessage('ID da cidade inválido'),
];

export const loginValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email é obrigatório')
    .isEmail().withMessage('Email inválido'),

  body('password')
    .notEmpty().withMessage('Senha é obrigatória'),
];

export const accountVerificationValidator = [
  body('code')
    .trim()
    .notEmpty().withMessage('Código de verificação é obrigatório')
    .isString().withMessage('Código de verificação deve ser uma string')
];

export const resetPasswordValidator = [
 
  body('email')
    .trim()
    .notEmpty().withMessage('Email é obrigatório')
    .isEmail().withMessage('Email inválido'),

    body('code')
    .notEmpty().withMessage('Código é obrigatório'),
    

  body('password')
    .notEmpty().withMessage('Senha é obrigatória')
    .isLength({ min: 3 }).withMessage('Senha deve ter pelo menos 3 caracteres'),

 
];

export const updateProfileValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage('Nome deve ter pelo menos 3 caracteres.'),
  body('phone')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Telefone inválido.'),
  body('doc')
    .optional({ nullable: true })
    .trim(),
];

export const updateVehicleValidator = [
 
   body('vehicleType')
   .isIn(['Carro', 'Moto', 'Bicicleta']).withMessage('Tipo de veículo inválido. Deve ser Carro, Moto ou Bicicleta'),
];

// Aceita tanto o formato antigo (ExponentPushToken[...]) quanto o atual
// (ExpoPushToken[...]) do SDK da Expo — mesma checagem de formato usada
// em utils/pushNotifications.js antes de enviar.
export const updatePushTokenValidator = [
  body('pushToken')
    .trim()
    .notEmpty().withMessage('Push token é obrigatório')
    .matches(/^Expo(nent)?PushToken\[.+\]$/).withMessage('Push token com formato inválido'),
];