import { body } from 'express-validator';

export const registerStoreValidator = [
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
